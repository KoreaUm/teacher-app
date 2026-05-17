# 한글(HWP) 자동 서식 엔진 - 학교 공문서 표준 양식
# Windows 내장 PowerShell 사용, 별도 설치 불필요
#
# 한국 학교 공문서 표준 항목 표시 체계 (행정안전부 공문서 작성 기준):
#   Ⅰ., Ⅱ.    → 대제목 (개요 1)
#   1., 2.     → 중제목 (개요 2)
#   가., 나.   → 소제목 (개요 3)
#   1), 2)     → 항    (개요 4)
#   가), 나)   → 호    (개요 5)
#   (1), (2)   → 목    (개요 6)
#   ◦, ○      → 본문 글머리
#   -          → 하위 항목
#   ▪, ▷     → 강조 본문
#   ※         → 참고/주의
#
# 자동 레벨 감지: 문서에 Ⅰ가 있으면 Ⅰ=L1, 1.=L2, 가.=L3
#               Ⅰ가 없으면 1.=L1, 가.=L2

param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    [string]$TemplatePath = ""
)

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Result($obj) {
    Write-Output ($obj | ConvertTo-Json -Compress)
}

# 파일 존재 확인
if (-not (Test-Path -LiteralPath $FilePath)) {
    Write-Result @{ ok = $false; error = "파일을 찾을 수 없습니다: $FilePath" }
    exit 1
}
$AbsPath = (Resolve-Path -LiteralPath $FilePath).Path

# 한글 COM 인스턴스 생성 (New-Object로 새 인스턴스 만들기)
$hwp = $null
$connectErrors = @()
foreach ($progId in @("HWPFrame.HwpObject", "HWPFrame.HwpObject.1")) {
    try {
        $hwp = New-Object -ComObject $progId
        if ($hwp) { break }
    } catch {
        $connectErrors += "New-Object($progId): $($_.Exception.Message)"
    }
}

if (-not $hwp) {
    Write-Result @{ ok = $false; error = "한글 COM 연결 실패. 한글 프로그램이 설치되어 있는지 확인하세요.`n상세: $($connectErrors -join '; ')" }
    exit 1
}

# 보안 모듈 등록 (한글 자동화 보안 팝업 우회)
try {
    $hwp.RegisterModule("FilePathCheckerModuleExample", "FilePathCheckerModule") | Out-Null
} catch {}

# 파일 열기 (사용자 파일에서 텍스트 읽기 위해)
try {
    $ext = [System.IO.Path]::GetExtension($AbsPath).ToLower()
    $format = if ($ext -eq '.hwpx') { "HWPX" } else { "HWP" }
    $hwp.Open($AbsPath, $format, "") | Out-Null
} catch {
    Write-Result @{ ok = $false; error = "파일 열기 실패: $_" }
    exit 1
}

# 창 보이기
try {
    if ($hwp.XHwpWindows.Count -gt 0) {
        $hwp.XHwpWindows.Item(0).Visible = $true
    }
} catch {}

# 문서 텍스트 읽기 (여러 인코딩 시도)
$rawText = $null
try {
    $tmp = [System.IO.Path]::GetTempFileName() + ".txt"
    $hwp.SaveAs($tmp, "TEXT", "") | Out-Null

    # 바이트 단위로 읽고 BOM/내용 확인 후 적절한 인코딩 선택
    $bytes = [System.IO.File]::ReadAllBytes($tmp)

    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        # UTF-8 BOM
        $rawText = [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
    }
    elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
        # UTF-16 LE BOM
        $rawText = [System.Text.Encoding]::Unicode.GetString($bytes, 2, $bytes.Length - 2)
    }
    elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
        # UTF-16 BE BOM
        $rawText = [System.Text.Encoding]::BigEndianUnicode.GetString($bytes, 2, $bytes.Length - 2)
    }
    else {
        # BOM 없음: UTF-8 → CP949(EUC-KR) 순으로 시도
        $tryUtf8 = [System.Text.Encoding]::UTF8.GetString($bytes)
        # 한글이 포함되어 있고 깨진 문자(U+FFFD)가 적으면 UTF-8 채택
        $replacementCount = ([regex]::Matches($tryUtf8, "�")).Count
        $hasKorean = $tryUtf8 -match '[가-힣]'
        if ($hasKorean -and $replacementCount -lt 5) {
            $rawText = $tryUtf8
        } else {
            # CP949 시도
            try {
                $cp949 = [System.Text.Encoding]::GetEncoding(949)
                $rawText = $cp949.GetString($bytes)
            } catch {
                $rawText = $tryUtf8  # 최후 수단
            }
        }
    }

    Remove-Item $tmp -ErrorAction SilentlyContinue
} catch {
    Write-Result @{ ok = $false; error = "문서 읽기 실패: $_" }
    exit 1
}

if ([string]::IsNullOrWhiteSpace($rawText)) {
    Write-Result @{ ok = $false; error = "문서가 비어있습니다." }
    exit 1
}

# 양식.hwpx 베이스 사용은 표지/도형 잔존 문제로 비활성화
# 사용자 파일을 그대로 사용

# ── 1단계: 라인 분류 ─────────────────────────────────────────
$lines = $rawText -split "`r?`n"

# 한국 공문서 표시 패턴 (우선순위 순)
$PATTERNS = @{
    L_ROMAN     = '^\s*([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ])\.?\s*(.*)$'           # Ⅰ., Ⅰ
    L_NUM_DOT   = '^\s*(\d{1,2})\.\s+(.+)$'                          # 1. 목적
    L_HAN_DOT   = '^\s*([가나다라마바사아자차카타파하])\.\s+(.+)$'    # 가. ...
    L_NUM_PAREN = '^\s*(\d{1,2})\)\s+(.+)$'                          # 1) ...
    L_HAN_PAREN = '^\s*([가나다라마바사아자차카타파하])\)\s+(.+)$'   # 가) ...
    L_PARENNUM  = '^\s*\(\s*(\d{1,2})\s*\)\s+(.+)$'                  # (1) ...
    BULLET_O    = '^\s*[◦○]\s*(.+)$'                                 # ◦ ...
    BULLET_DASH = '^\s*[-–—]\s+(.+)$'                                # - ...
    EMPH        = '^\s*[▪▶▷■◆]\s*(.+)$'                            # ▪ ...
    NOTE        = '^\s*※\s*(.+)$'                                    # ※ ...
}

function Classify-Line($line) {
    $s = $line.Trim()
    if ([string]::IsNullOrEmpty($s)) { return @{ type = 'BLANK' } }

    # 표 행 감지: 탭 또는 2칸+ 공백으로 3토큰 이상
    $cells = @($s -split "\t| {2,}" | Where-Object { $_.Trim() -ne "" })
    $hasTime = $s -match '\d{1,2}:\d{2}\s*[~∼\-]\s*\d{1,2}:\d{2}'
    if (($cells.Count -ge 3) -or ($hasTime -and ($s.Split(" ").Count -ge 3))) {
        return @{ type = 'TABLE_ROW'; cells = $cells }
    }

    foreach ($key in 'L_ROMAN','L_NUM_DOT','L_HAN_DOT','L_NUM_PAREN','L_HAN_PAREN','L_PARENNUM') {
        if ($s -match $PATTERNS[$key]) {
            return @{ type = $key; text = $s }
        }
    }
    foreach ($key in 'BULLET_O','BULLET_DASH','EMPH','NOTE') {
        if ($s -match $PATTERNS[$key]) {
            return @{ type = $key; text = $s }
        }
    }
    return @{ type = 'BODY'; text = $s }
}

$labeled = $lines | ForEach-Object { Classify-Line $_ }

# ── 2단계: 최상위 레벨 자동 감지 ──────────────────────────────
# Ⅰ가 있으면 ROMAN이 L1, 없으면 NUM_DOT이 L1
$hasRoman = $labeled | Where-Object { $_.type -eq 'L_ROMAN' } | Select-Object -First 1
$topIsRoman = $null -ne $hasRoman

# 헤딩 레벨 매핑
function Get-HeadingLevel($type) {
    if ($topIsRoman) {
        switch ($type) {
            'L_ROMAN'     { return 1 }
            'L_NUM_DOT'   { return 2 }
            'L_HAN_DOT'   { return 3 }
            'L_NUM_PAREN' { return 4 }
            'L_HAN_PAREN' { return 5 }
            'L_PARENNUM'  { return 6 }
        }
    } else {
        switch ($type) {
            'L_NUM_DOT'   { return 1 }
            'L_HAN_DOT'   { return 2 }
            'L_NUM_PAREN' { return 3 }
            'L_HAN_PAREN' { return 4 }
            'L_PARENNUM'  { return 5 }
        }
    }
    return 0
}

# ── 3단계: IR 노드 생성 ──────────────────────────────────────
$nodes = [System.Collections.ArrayList]::new()
$i = 0
while ($i -lt $labeled.Count) {
    $item = $labeled[$i]
    if ($item.type -eq 'BLANK') { $i++; continue }

    if ($item.type -eq 'TABLE_ROW') {
        $rows = [System.Collections.ArrayList]::new()
        while ($i -lt $labeled.Count -and $labeled[$i].type -eq 'TABLE_ROW') {
            [void]$rows.Add($labeled[$i].cells)
            $i++
        }
        $maxCols = ($rows | ForEach-Object { $_.Count } | Measure-Object -Maximum).Maximum
        $normRows = $rows | ForEach-Object {
            $r = @($_)
            while ($r.Count -lt $maxCols) { $r += "" }
            ,$r[0..($maxCols-1)]
        }
        [void]$nodes.Add(@{ kind = 'table'; rows = @($normRows) })
        continue
    }

    $lvl = Get-HeadingLevel $item.type
    if ($lvl -gt 0) {
        [void]$nodes.Add(@{ kind = 'heading'; level = $lvl; text = $item.text })
    } elseif ($item.type -eq 'BULLET_O') {
        [void]$nodes.Add(@{ kind = 'bullet_o'; text = $item.text })
    } elseif ($item.type -eq 'BULLET_DASH') {
        [void]$nodes.Add(@{ kind = 'bullet_dash'; text = $item.text })
    } elseif ($item.type -eq 'EMPH') {
        [void]$nodes.Add(@{ kind = 'emph'; text = $item.text })
    } elseif ($item.type -eq 'NOTE') {
        [void]$nodes.Add(@{ kind = 'note'; text = $item.text })
    } else {
        [void]$nodes.Add(@{ kind = 'body'; text = $item.text })
    }
    $i++
}

# ── 4단계: 스타일 사전 ────────────────────────────────────────
# 양식.hwpx의 실제 폰트/크기 분석 결과를 반영:
#   - Ⅰ:  나눔고딕 Light 20pt
#   - 1.: 맑은 고딕 16pt
#   - ◦:  휴먼명조 15pt
#   - 본문: 함초롬바탕 10pt
# 단, COM에서는 컬러 박스 재현 불가하므로 크기로 위계 표현
$STYLE = @{
    H1 = @{ font='나눔고딕 Light'; size=18; bold=$true;  indent=0;    line=180; align=0; spaceBefore=500; spaceAfter=300 }   # Ⅰ.
    H2 = @{ font='맑은 고딕';      size=15; bold=$true;  indent=0;    line=175; align=0; spaceBefore=400; spaceAfter=150 }   # 1.
    H3 = @{ font='휴먼명조';       size=13; bold=$true;  indent=300;  line=175; align=0; spaceBefore=200; spaceAfter=0 }     # 가.
    H4 = @{ font='휴먼명조';       size=12; bold=$true;  indent=600;  line=170; align=0; spaceBefore=100; spaceAfter=0 }     # 1)
    H5 = @{ font='휴먼명조';       size=11; bold=$false; indent=900;  line=170; align=0; spaceBefore=0;   spaceAfter=0 }     # 가)
    H6 = @{ font='휴먼명조';       size=11; bold=$false; indent=1200; line=170; align=0; spaceBefore=0;   spaceAfter=0 }     # (1)
    BULLET_O    = @{ font='휴먼명조';  size=12; bold=$false; indent=400;  line=175; align=0; spaceBefore=0; spaceAfter=0 }    # ◦
    BULLET_DASH = @{ font='휴먼명조';  size=11; bold=$false; indent=800;  line=170; align=0; spaceBefore=0; spaceAfter=0 }    # -
    EMPH        = @{ font='휴먼명조';  size=12; bold=$true;  indent=400;  line=175; align=0; spaceBefore=0; spaceAfter=0 }    # ▪
    NOTE        = @{ font='함초롬바탕'; size=10; bold=$false; indent=400;  line=160; align=0; spaceBefore=0; spaceAfter=0 }    # ※
    BODY        = @{ font='함초롬바탕'; size=11; bold=$false; indent=200;  line=170; align=0; spaceBefore=0; spaceAfter=0 }    # 일반 본문
    KV          = @{ font='함초롬바탕'; size=11; bold=$false; indent=200;  line=170; align=0; spaceBefore=0; spaceAfter=0 }    # 키:값
    TH          = @{ font='맑은 고딕'; size=10; bold=$true;  align=1 }
    TD          = @{ font='함초롬바탕'; size=10; bold=$false; align=0 }
}

$FONT_ATTRS = @('FaceNameHangul','FaceNameLatin','FaceNameHanja','FaceNameJapanese','FaceNameOther','FaceNameSymbol','FaceNameUser')

function Set-CharShape($hwp, $font, $sizePt, $bold) {
    try {
        $act = $hwp.HAction
        $pset = $hwp.HParameterSet.HCharShape
        $act.GetDefault("CharShape", $pset.HSet) | Out-Null
        foreach ($attr in $FONT_ATTRS) { Try-SetProp $pset $attr $font }
        Try-SetProp $pset 'Height' ($sizePt * 100)
        $boldVal = if ($bold) { 1 } else { 0 }
        Try-SetProp $pset 'Bold' $boldVal
        try { $act.Execute("CharShape", $pset.HSet) | Out-Null } catch {}
    } catch {}
}

function Try-SetProp($obj, $name, $value) {
    try { $obj.$name = $value } catch {}
}

function Set-ParaShape($hwp, $indent, $line, $align, $spaceBefore=0, $spaceAfter=0) {
    try {
        $act = $hwp.HAction
        $pset = $hwp.HParameterSet.HParaShape
        $act.GetDefault("ParagraphShape", $pset.HSet) | Out-Null

        # 들여쓰기: Indent는 일부 버전에서만 존재 → LeftMargin 사용
        Try-SetProp $pset 'LeftMargin'      $indent
        Try-SetProp $pset 'Indent'          0
        Try-SetProp $pset 'LineSpacing'     $line
        Try-SetProp $pset 'LineSpacingType' 0
        Try-SetProp $pset 'AlignType'       $align
        Try-SetProp $pset 'PrevSpacing'     $spaceBefore
        Try-SetProp $pset 'NextSpacing'     $spaceAfter

        try { $act.Execute("ParagraphShape", $pset.HSet) | Out-Null } catch {}
    } catch {}
}

function Insert-Text($hwp, $text) {
    try {
        $act = $hwp.HAction
        $pset = $hwp.HParameterSet.HInsertText
        $act.GetDefault("InsertText", $pset.HSet) | Out-Null
        Try-SetProp $pset 'Text' ([string]$text)
        try { $act.Execute("InsertText", $pset.HSet) | Out-Null } catch {}
    } catch {}
}

function Write-StyledPara($hwp, $text, $s) {
    try {
        Set-ParaShape $hwp $s.indent $s.line $s.align $s.spaceBefore $s.spaceAfter
        Set-CharShape $hwp $s.font $s.size $s.bold
        Insert-Text $hwp $text
        Safe-Run $hwp "BreakPara"
    } catch {}
}

function Safe-Run($hwp, $cmd) {
    try { $hwp.HAction.Run($cmd) | Out-Null } catch {}
}

function Write-Table($hwp, $rows) {
    $numRows = $rows.Count
    if ($numRows -eq 0) { return }
    $numCols = ($rows[0]).Count
    if ($numCols -eq 0) { return }

    # 표 생성 시도
    # 본문 너비 약 36000 HWPUNIT (A4 본문 폭 ≈ 150mm × 283 = 42450, 안전 35000)
    $totalWidth = 36000
    $colW = [int]($totalWidth / $numCols)
    $rowH = 1500

    $tableCreated = $false
    try {
        $act = $hwp.HAction
        $pset = $hwp.HParameterSet.HTableCreation
        $act.GetDefault("TableCreate", $pset.HSet) | Out-Null
        Try-SetProp $pset 'Rows'        $numRows
        Try-SetProp $pset 'Cols'        $numCols
        Try-SetProp $pset 'WidthType'   0           # 0 = 절대값 (HWPUNIT)
        Try-SetProp $pset 'HeightType'  0           # 0 = 자동
        Try-SetProp $pset 'WidthValue'  $totalWidth
        Try-SetProp $pset 'HeightValue' ($rowH * $numRows)

        # ColWidth/RowHeight 배열 채우기 (여러 방법 시도)
        $arrayOk = $false
        try {
            $pset.CreateItemArray("ColWidth", $numCols) | Out-Null
            for ($c = 0; $c -lt $numCols; $c++) {
                $set = $false
                # 방법1: SetItem
                try { $pset.ColWidth.SetItem($c, $colW); $set = $true } catch {}
                # 방법2: Item indexer
                if (-not $set) { try { $pset.ColWidth.Item($c) = $colW; $set = $true } catch {} }
                # 방법3: 직접 indexer
                if (-not $set) { try { $pset.ColWidth[$c] = $colW; $set = $true } catch {} }
            }
            $arrayOk = $true
        } catch {}
        try {
            $pset.CreateItemArray("RowHeight", $numRows) | Out-Null
            for ($r = 0; $r -lt $numRows; $r++) {
                try { $pset.RowHeight.SetItem($r, $rowH) | Out-Null } catch {
                    try { $pset.RowHeight.Item($r) = $rowH } catch {
                        try { $pset.RowHeight[$r] = $rowH } catch {}
                    }
                }
            }
        } catch {}

        $act.Execute("TableCreate", $pset.HSet) | Out-Null
        $tableCreated = $true
    } catch {
        # 표 생성 자체 실패 → 텍스트 폴백
    }

    if ($tableCreated) {
        # 셀 채우기
        for ($r = 0; $r -lt $numRows; $r++) {
            for ($c = 0; $c -lt $numCols; $c++) {
                $cellStyle = if ($r -eq 0) { $STYLE.TH } else { $STYLE.TD }
                $cellText = if ($c -lt $rows[$r].Count) { [string]$rows[$r][$c] } else { "" }

                Set-CharShape $hwp $cellStyle.font $cellStyle.size $cellStyle.bold
                Set-ParaShape $hwp 0 150 $cellStyle.align 0 0
                try { Insert-Text $hwp $cellText } catch {}

                if (-not ($r -eq ($numRows-1) -and $c -eq ($numCols-1))) {
                    Safe-Run $hwp "TableRightCell"
                }
            }
        }

        # 표 전체 선택 후 테두리 적용
        try {
            # 첫 셀로 이동
            Safe-Run $hwp "TableColBegin"
            Safe-Run $hwp "TableSelTable"
            # 모든 테두리 적용
            $act = $hwp.HAction
            $pset = $hwp.HParameterSet.HCellBorderFill
            $act.GetDefault("CellBorderFill", $pset.HSet) | Out-Null
            Try-SetProp $pset 'HasBorder' $true
            # 모든 방향 테두리 설정
            foreach ($dir in 'BorderTypeLeft','BorderTypeRight','BorderTypeTop','BorderTypeBottom','BorderTypeInsideHorz','BorderTypeInsideVert') {
                Try-SetProp $pset $dir 1   # 1 = 실선
            }
            foreach ($w in 'BorderWidthLeft','BorderWidthRight','BorderWidthTop','BorderWidthBottom','BorderWidthInsideHorz','BorderWidthInsideVert') {
                Try-SetProp $pset $w 3     # 가는 선
            }
            foreach ($col in 'BorderColorLeft','BorderColorRight','BorderColorTop','BorderColorBottom','BorderColorInsideHorz','BorderColorInsideVert') {
                Try-SetProp $pset $col 0   # 검정
            }
            try { $act.Execute("CellBorderFill", $pset.HSet) | Out-Null } catch {}
        } catch {}

        # 헤더 행(첫 행) 배경색 적용
        try {
            Safe-Run $hwp "TableColBegin"   # 첫 셀로
            Safe-Run $hwp "TableSelRow"     # 첫 행 선택
            $act2 = $hwp.HAction
            $pset2 = $hwp.HParameterSet.HCellBorderFill
            $act2.GetDefault("CellBorderFill", $pset2.HSet) | Out-Null
            Try-SetProp $pset2 'HasFill' $true
            Try-SetProp $pset2 'FillColorR' 230
            Try-SetProp $pset2 'FillColorG' 230
            Try-SetProp $pset2 'FillColorB' 230
            try { $act2.Execute("CellBorderFill", $pset2.HSet) | Out-Null } catch {}
        } catch {}

        # 표 밖으로 나가기
        Safe-Run $hwp "CloseEx"
        Safe-Run $hwp "MoveDocEnd"
        Safe-Run $hwp "BreakPara"
    } else {
        # 폴백: 표를 탭 구분 텍스트로 출력
        for ($r = 0; $r -lt $numRows; $r++) {
            $cellStyle = if ($r -eq 0) { $STYLE.TH } else { $STYLE.TD }
            $line = ($rows[$r] -join "  |  ")
            Set-CharShape $hwp $cellStyle.font $cellStyle.size $cellStyle.bold
            Set-ParaShape $hwp 400 170 0 0 0
            try { Insert-Text $hwp $line } catch {}
            Safe-Run $hwp "BreakPara"
        }
    }
}

# ── 5단계: 문서 지우고 다시 쓰기 ────────────────────────────────
Safe-Run $hwp "MoveDocBegin"
Safe-Run $hwp "SelectAll"
Safe-Run $hwp "Delete"
Safe-Run $hwp "MoveDocBegin"

# 첫 노드가 BODY(짧은 제목)면 표지 페이지로 처리
$hasCoverPage = $false
if ($nodes.Count -gt 0 -and $nodes[0].kind -eq 'body' -and $nodes[0].text.Length -lt 60) {
    $title = $nodes[0].text
    # 표지: 위쪽 여백을 위한 빈 줄 8개
    $emptyStyle = @{ font='함초롬바탕'; size=11; bold=$false; indent=0; line=170; align=0; spaceBefore=0; spaceAfter=0 }
    for ($i=0; $i -lt 8; $i++) {
        Write-StyledPara $hwp '' $emptyStyle
    }
    # 큰 제목 (가운데 정렬)
    $titleStyle = @{ font='HY헤드라인M'; size=26; bold=$true; indent=0; line=200; align=1; spaceBefore=0; spaceAfter=0 }
    Write-StyledPara $hwp $title $titleStyle
    # 아래 여백
    for ($i=0; $i -lt 3; $i++) {
        Write-StyledPara $hwp '' $emptyStyle
    }
    # 부제: 작성일 (현재 연도 ○월)
    $year = (Get-Date).Year
    $subStyle = @{ font='함초롬돋움'; size=14; bold=$false; indent=0; line=180; align=1; spaceBefore=0; spaceAfter=0 }
    Write-StyledPara $hwp "$year. ○." $subStyle
    Write-StyledPara $hwp '' $emptyStyle
    # 학교/부서명 (사용자가 채울 자리)
    $orgStyle = @{ font='함초롬돋움'; size=16; bold=$true; indent=0; line=180; align=1; spaceBefore=0; spaceAfter=0 }
    Write-StyledPara $hwp '○○학교' $orgStyle
    # 페이지 나누기
    Safe-Run $hwp "BreakPage"
    $hasCoverPage = $true
    # 첫 노드(제목)는 본문에서 제외하기 위해 skip 카운트
    $skipFirst = $true
} else {
    $skipFirst = $false
}

$errors = @()
$processed = 0
$nodeIndex = -1
foreach ($node in $nodes) {
    $nodeIndex++
    if ($skipFirst -and $nodeIndex -eq 0) { continue }
    try {
        switch ($node.kind) {
            'heading' {
                $key = "H$($node.level)"
                if (-not $STYLE.ContainsKey($key)) { $key = "H6" }
                Write-StyledPara $hwp $node.text $STYLE[$key]
            }
            'bullet_o'    { Write-StyledPara $hwp $node.text $STYLE.BULLET_O }
            'bullet_dash' { Write-StyledPara $hwp $node.text $STYLE.BULLET_DASH }
            'emph'        { Write-StyledPara $hwp $node.text $STYLE.EMPH }
            'note'        { Write-StyledPara $hwp $node.text $STYLE.NOTE }
            'body'        { Write-StyledPara $hwp $node.text $STYLE.BODY }
            'table'       { Write-Table $hwp $node.rows }
        }
        $processed++
    } catch {
        $errors += "[$($node.kind)] $($_.Exception.Message)"
    }
}

Safe-Run $hwp "MoveDocBegin"

# 쪽번호 자동 삽입 (양식 베이스에 이미 있으면 중복될 수 있어 try만)
try {
    $act = $hwp.HAction
    $pset = $hwp.HParameterSet.HPageNumPosition
    $act.GetDefault("PageNumPos", $pset.HSet) | Out-Null
    Try-SetProp $pset 'Pos' 7              # 7 = 가운데 아래
    Try-SetProp $pset 'NumberFormat' 0     # 0 = 1, 2, 3
    Try-SetProp $pset 'SideChar' 1         # 1 = "- 1 -" 형식
    try { $act.Execute("PageNumPos", $pset.HSet) | Out-Null } catch {}
} catch {}

# 파일 저장 (원본 형식 그대로) - 실패해도 끝까지 시도
$saved = $false
try {
    $saveFormat = if ($ext -eq '.hwpx') { "HWPX" } else { "HWP" }
    $hwp.SaveAs($AbsPath, $saveFormat, "") | Out-Null
    $saved = $true
} catch {
    # HWP로 재시도
    try {
        $hwp.SaveAs($AbsPath, "HWP", "") | Out-Null
        $saved = $true
    } catch {
        $errors += "저장 실패: $($_.Exception.Message)"
    }
}

$topLevelName = if ($topIsRoman) { 'Roman' } else { 'Number' }
$resultObj = @{
    ok = $saved
    blocks = $processed
    totalBlocks = $nodes.Count
    topLevel = $topLevelName
    savedTo = $AbsPath
}
if ($errors.Count -gt 0) {
    $resultObj.warnings = $errors
}
if (-not $saved) {
    $resultObj.error = "파일을 저장하지 못했습니다."
}
Write-Result $resultObj
if (-not $saved) { exit 1 }
