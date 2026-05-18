# 한글(HWP) 자동 서식 엔진 - 본문 서식 정리에 집중
# Windows 내장 PowerShell + 한컴 COM API
#
# 지원 입력 형식:
#   A. 한국 공문서 표준 (행정안전부 기준)
#      Ⅰ., Ⅱ.   → 대제목
#      1., 2.    → 중제목
#      가., 나.  → 소제목
#      1), 2)    → 항
#      가), 나)  → 호
#      (1), (2)  → 목
#      ◦, ○     → 본문 글머리
#      -         → 하위 항목
#      ▪        → 강조
#      ※        → 참고
#
#   B. 마크다운 (ChatGPT/Claude 출력 그대로)
#      #        → 대제목
#      ##       → 중제목
#      ###      → 소제목
#      ####     → 항
#      -, *     → 글머리
#        -      → 하위 (들여쓰기)
#      | a | b | → 표
#      **bold** → 굵게 (마커 제거)
#
# 자동 위계 감지: 문서에 Ⅰ/# 있으면 L1, 없으면 1./## 부터 L1

param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    [string]$InputTextFile = ""    # 텍스트 입력 모드: 이 파일의 텍스트를 새 한글 문서로 작성 후 서식 적용
)

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Result($obj) {
    Write-Output ($obj | ConvertTo-Json -Compress)
}

# 텍스트 입력 모드: $FilePath는 결과를 저장할 경로 (없으면 새로 생성)
$IsTextInputMode = ($InputTextFile -ne "" -and (Test-Path -LiteralPath $InputTextFile))

# 일반 모드: 기존 파일 존재해야 함
if (-not $IsTextInputMode -and -not (Test-Path -LiteralPath $FilePath)) {
    Write-Result @{ ok = $false; error = "파일을 찾을 수 없습니다: $FilePath" }
    exit 1
}

# 텍스트 입력 모드면 FilePath가 아직 존재 안 할 수 있으니 디렉터리만 확인
if ($IsTextInputMode) {
    $parent = [System.IO.Path]::GetDirectoryName($FilePath)
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        Write-Result @{ ok = $false; error = "저장 폴더가 없습니다: $parent" }
        exit 1
    }
    $AbsPath = [System.IO.Path]::GetFullPath($FilePath)
} else {
    $AbsPath = (Resolve-Path -LiteralPath $FilePath).Path
}
$ext = [System.IO.Path]::GetExtension($AbsPath).ToLower()
if ($ext -eq "") { $ext = ".hwpx"; $AbsPath = $AbsPath + ".hwpx" }
$format = if ($ext -eq '.hwpx') { "HWPX" } else { "HWP" }

# ── 한글 COM 연결 ─────────────────────────────────────────────
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
    Write-Result @{ ok = $false; error = "한글 COM 연결 실패. 한글 설치 여부 확인.`n$($connectErrors -join '; ')" }
    exit 1
}
try { $hwp.RegisterModule("FilePathCheckerModuleExample", "FilePathCheckerModule") | Out-Null } catch {}

# 파일 열기 또는 빈 문서 시작
if (-not $IsTextInputMode) {
    try { $hwp.Open($AbsPath, $format, "") | Out-Null }
    catch {
        Write-Result @{ ok = $false; error = "파일 열기 실패: $_" }
        exit 1
    }
}
try { if ($hwp.XHwpWindows.Count -gt 0) { $hwp.XHwpWindows.Item(0).Visible = $true } } catch {}

# ── 문서 텍스트 추출 (인코딩 자동 감지) ──────────────────────────
$rawText = $null

if ($IsTextInputMode) {
    # 텍스트 입력 모드: 입력 파일에서 직접 읽음
    try {
        $bytes = [System.IO.File]::ReadAllBytes($InputTextFile)
        if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
            $rawText = [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
        } else {
            $rawText = [System.Text.Encoding]::UTF8.GetString($bytes)
        }
    } catch {
        Write-Result @{ ok = $false; error = "입력 텍스트 파일 읽기 실패: $_" }
        exit 1
    }
} else {
try {
    $tmp = [System.IO.Path]::GetTempFileName() + ".txt"
    $hwp.SaveAs($tmp, "TEXT", "") | Out-Null
    $bytes = [System.IO.File]::ReadAllBytes($tmp)

    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $rawText = [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
    } elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
        $rawText = [System.Text.Encoding]::Unicode.GetString($bytes, 2, $bytes.Length - 2)
    } elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
        $rawText = [System.Text.Encoding]::BigEndianUnicode.GetString($bytes, 2, $bytes.Length - 2)
    } else {
        $tryUtf8 = [System.Text.Encoding]::UTF8.GetString($bytes)
        $replacementCount = ([regex]::Matches($tryUtf8, "�")).Count
        $hasKorean = $tryUtf8 -match '[가-힣]'
        if ($hasKorean -and $replacementCount -lt 5) {
            $rawText = $tryUtf8
        } else {
            try {
                $rawText = [System.Text.Encoding]::GetEncoding(949).GetString($bytes)
            } catch { $rawText = $tryUtf8 }
        }
    }
    Remove-Item $tmp -ErrorAction SilentlyContinue
} catch {
    Write-Result @{ ok = $false; error = "문서 읽기 실패: $_" }
    exit 1
}
}   # end of else (text-input-mode else)

if ([string]::IsNullOrWhiteSpace($rawText)) {
    Write-Result @{ ok = $false; error = "문서가 비어있습니다." }
    exit 1
}

# ── 1단계: 라인 분류 ──────────────────────────────────────────
$lines = $rawText -split "`r?`n"

# 한국 공문 패턴
# - 항목 단계 (1./가./1)/가)/(1)/(가)) - 행안부 편람 기준
# - 글머리표 (□/○/-/·) - 공문서 표준 보조 위계
$PATTERNS = @{
    L_ROMAN     = '^\s*([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ])\.?\s*(.*)$'
    L_NUM_DOT   = '^\s*(\d{1,2})\.\s+(.+)$'
    L_HAN_DOT   = '^\s*([가나다라마바사아자차카타파하])\.\s+(.+)$'
    L_NUM_PAREN = '^\s*(\d{1,2})\)\s+(.+)$'
    L_HAN_PAREN = '^\s*([가나다라마바사아자차카타파하])\)\s+(.+)$'
    L_PARENNUM  = '^\s*\(\s*(\d{1,2})\s*\)\s+(.+)$'
    BULLET_SQ   = '^\s*[□■]\s*(.+)$'        # 1단계 □
    BULLET_CR   = '^\s*[○●◦]\s*(.+)$'        # 2단계 ○
    BULLET_DASH = '^\s*[-–—]\s+(.+)$'        # 3단계 -
    BULLET_DOT  = '^\s*[·•]\s*(.+)$'         # 4단계 ·
    EMPH        = '^\s*[▪▶▷◆]\s*(.+)$'
    NOTE        = '^\s*※\s*(.+)$'
}

# 마크다운에서 **bold** 마커 제거
function Strip-MdMarkers($text) {
    $t = $text
    $t = $t -replace '\*\*([^*]+)\*\*', '$1'
    $t = $t -replace '__([^_]+)__', '$1'
    $t = $t -replace '`([^`]+)`', '$1'
    return $t
}

function Classify-Line($line) {
    $s = $line.Trim()
    if ([string]::IsNullOrEmpty($s)) { return @{ type = 'BLANK' } }

    # 마크다운 표 행 (| a | b | c |)
    if ($s -match '^\|.*\|\s*$') {
        # 구분선 ( |---|---| ) 은 무시
        if ($s -match '^\|[\s\-:|]+\|\s*$') {
            return @{ type = 'MD_TABLE_SEP' }
        }
        $inner = $s.Trim('|')
        $cells = @($inner -split '\|' | ForEach-Object { Strip-MdMarkers ($_.Trim()) })
        return @{ type = 'TABLE_ROW'; cells = $cells }
    }

    # 일반 표 행 (탭 또는 2칸+ 공백으로 3토큰 이상)
    $cells = @($s -split "\t| {2,}" | Where-Object { $_.Trim() -ne "" })
    $hasTime = $s -match '\d{1,2}:\d{2}\s*[~∼\-]\s*\d{1,2}:\d{2}'
    if (($cells.Count -ge 3) -or ($hasTime -and ($s.Split(" ").Count -ge 3))) {
        return @{ type = 'TABLE_ROW'; cells = @($cells | ForEach-Object { Strip-MdMarkers $_ }) }
    }

    # 마크다운 헤더 (#, ##, ###, ####)
    if ($s -match '^####\s+(.+)$') { return @{ type = 'MD_H4'; text = Strip-MdMarkers $matches[1] } }
    if ($s -match '^###\s+(.+)$')  { return @{ type = 'MD_H3'; text = Strip-MdMarkers $matches[1] } }
    if ($s -match '^##\s+(.+)$')   { return @{ type = 'MD_H2'; text = Strip-MdMarkers $matches[1] } }
    if ($s -match '^#\s+(.+)$')    { return @{ type = 'MD_H1'; text = Strip-MdMarkers $matches[1] } }

    # 마크다운 글머리 — 들여쓰기 깊이로 4단계 위계 매핑 (공문서 표준)
    # 0칸: □ (1단계), 2칸: ○ (2단계), 4칸: - (3단계), 6칸+: · (4단계)
    if ($line -match '^(\s*)[-*]\s+(.+)$') {
        $indent = $matches[1].Length
        $txt = Strip-MdMarkers $matches[2]
        if ($indent -ge 6)      { return @{ type = 'BULLET_DOT';  text = '· ' + $txt } }
        elseif ($indent -ge 4)  { return @{ type = 'BULLET_DASH'; text = '- ' + $txt } }
        elseif ($indent -ge 2)  { return @{ type = 'BULLET_CR';   text = '○ ' + $txt } }
        else                    { return @{ type = 'BULLET_SQ';   text = '□ ' + $txt } }
    }

    # 한국 공문 패턴
    foreach ($key in 'L_ROMAN','L_NUM_DOT','L_HAN_DOT','L_NUM_PAREN','L_HAN_PAREN','L_PARENNUM') {
        if ($s -match $PATTERNS[$key]) {
            return @{ type = $key; text = Strip-MdMarkers $s }
        }
    }
    foreach ($key in 'BULLET_SQ','BULLET_CR','BULLET_DASH','BULLET_DOT','EMPH','NOTE') {
        if ($s -match $PATTERNS[$key]) {
            return @{ type = $key; text = Strip-MdMarkers $s }
        }
    }
    return @{ type = 'BODY'; text = Strip-MdMarkers $s }
}

$labeled = $lines | ForEach-Object { Classify-Line $_ }

# ── 2단계: 최상위 위계 감지 ──────────────────────────────────
# 한국식: Ⅰ가 있으면 ROMAN이 L1, 없으면 NUM_DOT이 L1
# 마크다운: # 가 있으면 MD_H1이 L1, 없으면 ## 이 L1
$hasRoman   = $labeled | Where-Object { $_.type -eq 'L_ROMAN' } | Select-Object -First 1
$hasMdH1    = $labeled | Where-Object { $_.type -eq 'MD_H1' }  | Select-Object -First 1
$topIsRoman = $null -ne $hasRoman
$topIsMdH1  = $null -ne $hasMdH1

function Get-HeadingLevel($type) {
    # 마크다운 헤더
    if ($type -eq 'MD_H1') { return 1 }
    if ($type -eq 'MD_H2') { return if ($topIsMdH1) { 2 } else { 1 } }
    if ($type -eq 'MD_H3') { return if ($topIsMdH1) { 3 } else { 2 } }
    if ($type -eq 'MD_H4') { return if ($topIsMdH1) { 4 } else { 3 } }

    # 한국 공문 마커
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
    if ($item.type -eq 'BLANK' -or $item.type -eq 'MD_TABLE_SEP') { $i++; continue }

    if ($item.type -eq 'TABLE_ROW') {
        $rows = [System.Collections.ArrayList]::new()
        while ($i -lt $labeled.Count -and ($labeled[$i].type -eq 'TABLE_ROW' -or $labeled[$i].type -eq 'MD_TABLE_SEP')) {
            if ($labeled[$i].type -eq 'TABLE_ROW') {
                [void]$rows.Add($labeled[$i].cells)
            }
            $i++
        }
        if ($rows.Count -gt 0) {
            $maxCols = ($rows | ForEach-Object { $_.Count } | Measure-Object -Maximum).Maximum
            $normRows = $rows | ForEach-Object {
                $r = @($_)
                while ($r.Count -lt $maxCols) { $r += "" }
                ,$r[0..($maxCols-1)]
            }
            [void]$nodes.Add(@{ kind = 'table'; rows = @($normRows) })
        }
        continue
    }

    $lvl = Get-HeadingLevel $item.type
    if ($lvl -gt 0) {
        [void]$nodes.Add(@{ kind = 'heading'; level = $lvl; text = $item.text })
    } elseif ($item.type -eq 'BULLET_SQ')   { [void]$nodes.Add(@{ kind = 'bullet_sq';   text = $item.text }) }
    elseif ($item.type -eq 'BULLET_CR')     { [void]$nodes.Add(@{ kind = 'bullet_cr';   text = $item.text }) }
    elseif ($item.type -eq 'BULLET_DASH')   { [void]$nodes.Add(@{ kind = 'bullet_dash'; text = $item.text }) }
    elseif ($item.type -eq 'BULLET_DOT')    { [void]$nodes.Add(@{ kind = 'bullet_dot';  text = $item.text }) }
    elseif ($item.type -eq 'EMPH')          { [void]$nodes.Add(@{ kind = 'emph';        text = $item.text }) }
    elseif ($item.type -eq 'NOTE')          { [void]$nodes.Add(@{ kind = 'note';        text = $item.text }) }
    else                                    { [void]$nodes.Add(@{ kind = 'body';        text = $item.text }) }
    $i++
}

# ── 4단계: 스타일 사전 (행정안전부 「행정업무운영 편람」 기준) ──
# 본문 폰트: 함초롬바탕 15pt / 줄간격 160% / 들여쓰기 1자(약 600 HWPUNIT)씩
# 한컴 한/글 "정부 공문서" 기본 스타일 준용
$INDENT_UNIT = 600   # 1자 들여쓰기 ≈ 600 HWPUNIT
$LINE_SPACE  = 160   # 표준 줄간격 %
$STYLE = @{
    H1 = @{ font='함초롬바탕'; size=16; bold=$true;  indent=0;                  line=$LINE_SPACE; align=0; spaceBefore=400; spaceAfter=150 }   # 1단계: 1.
    H2 = @{ font='함초롬바탕'; size=15; bold=$true;  indent=($INDENT_UNIT*1);   line=$LINE_SPACE; align=0; spaceBefore=200; spaceAfter=100 }   # 2단계: 가.
    H3 = @{ font='함초롬바탕'; size=15; bold=$false; indent=($INDENT_UNIT*2);   line=$LINE_SPACE; align=0; spaceBefore=100; spaceAfter=0 }     # 3단계: 1)
    H4 = @{ font='함초롬바탕'; size=15; bold=$false; indent=($INDENT_UNIT*3);   line=$LINE_SPACE; align=0; spaceBefore=0;   spaceAfter=0 }     # 4단계: 가)
    H5 = @{ font='함초롬바탕'; size=15; bold=$false; indent=($INDENT_UNIT*4);   line=$LINE_SPACE; align=0; spaceBefore=0;   spaceAfter=0 }     # 5단계: (1)
    H6 = @{ font='함초롬바탕'; size=15; bold=$false; indent=($INDENT_UNIT*5);   line=$LINE_SPACE; align=0; spaceBefore=0;   spaceAfter=0 }     # 6단계: (가)
    # 글머리표 4단계 위계 (□ → ○ → - → ·, 공문서 표준)
    BULLET_SQ   = @{ font='함초롬바탕'; size=15; bold=$false; indent=0;                  line=$LINE_SPACE; align=0; spaceBefore=0; spaceAfter=0 }
    BULLET_CR   = @{ font='함초롬바탕'; size=15; bold=$false; indent=$INDENT_UNIT;       line=$LINE_SPACE; align=0; spaceBefore=0; spaceAfter=0 }
    BULLET_DASH = @{ font='함초롬바탕'; size=15; bold=$false; indent=($INDENT_UNIT*2);   line=$LINE_SPACE; align=0; spaceBefore=0; spaceAfter=0 }
    BULLET_DOT  = @{ font='함초롬바탕'; size=15; bold=$false; indent=($INDENT_UNIT*3);   line=$LINE_SPACE; align=0; spaceBefore=0; spaceAfter=0 }
    EMPH        = @{ font='함초롬바탕'; size=15; bold=$true;  indent=$INDENT_UNIT;       line=$LINE_SPACE; align=0; spaceBefore=0; spaceAfter=0 }
    NOTE        = @{ font='함초롬바탕'; size=13; bold=$false; indent=$INDENT_UNIT;       line=$LINE_SPACE; align=0; spaceBefore=0; spaceAfter=0 }
    BODY        = @{ font='함초롬바탕'; size=15; bold=$false; indent=0;                  line=$LINE_SPACE; align=0; spaceBefore=0; spaceAfter=0 }
    TH          = @{ font='함초롬바탕'; size=14; bold=$true;  align=1 }
    TD          = @{ font='함초롬바탕'; size=14; bold=$false; align=0 }
}

$FONT_ATTRS = @('FaceNameHangul','FaceNameLatin','FaceNameHanja','FaceNameJapanese','FaceNameOther','FaceNameSymbol','FaceNameUser')

function Try-SetProp($obj, $name, $value) {
    try { $obj.$name = $value } catch {}
}

function Safe-Run($hwp, $cmd) {
    try { $hwp.HAction.Run($cmd) | Out-Null } catch {}
}

# ─── 도형(직사각형) 삽입 - 정식 API ─────────────────────────────
# 한컴 공식 API + pyhwpx 레퍼런스 기반
# CreationType=ShapeType("RectAngle"), Width/Height, FillBrush 하위셋
function Insert-Rectangle($hwp, $widthHwp, $heightHwp, $fillRgb) {
    try {
        $act = $hwp.HAction
        $set = $hwp.HParameterSet.HShapeObject
        $act.GetDefault("DrawObjCreator", $set.HSet) | Out-Null

        # ShapeType("RectAngle") 으로 enum 값 획득 (정확한 한컴 표기는 'RectAngle')
        $shapeOk = $false
        foreach ($name in 'RectAngle','Rectangle','RECTANGLE','rectangle') {
            try {
                $set.CreationType = $set.ShapeType($name)
                $shapeOk = $true; break
            } catch {}
        }
        if (-not $shapeOk) { return $false }

        Try-SetProp $set 'Width'       $widthHwp
        Try-SetProp $set 'Height'      $heightHwp
        Try-SetProp $set 'TreatAsChar' $true   # 글자처럼 취급 → 단락 흐름

        # 채우기: FillBrush 하위셋 + WinBrush.FaceColor
        try {
            $fill = $set.HSet.CreateItemSet("FillBrush", "FillBrush")
            $fill.WinBrush.FaceColor = $fillRgb
        } catch {}

        $act.Execute("DrawObjCreator", $set.HSet) | Out-Null
        Safe-Run $hwp "BreakPara"
        return $true
    } catch {
        return $false
    }
}

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

function Set-ParaShape($hwp, $indent, $line, $align, $spaceBefore=0, $spaceAfter=0) {
    try {
        $act = $hwp.HAction
        $pset = $hwp.HParameterSet.HParaShape
        $act.GetDefault("ParagraphShape", $pset.HSet) | Out-Null
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

# ─── 단락 위/아래 컬러 테두리 (제목 장식용) ─────────────────────
# 도형 객체 대신 단락의 위/아래 테두리를 사용 → COM API 안정적
function Set-ParaBorder($hwp, $top, $bottom) {
    # $top, $bottom = @{ color=BGR; width=0~7; type=0~17 }; null이면 미적용
    try {
        $act = $hwp.HAction
        $pset = $hwp.HParameterSet.HParaShape
        $act.GetDefault("ParagraphShape", $pset.HSet) | Out-Null

        if ($top) {
            Try-SetProp $pset 'BorderTop'       $top.type
            Try-SetProp $pset 'BorderTopColor'  $top.color
            Try-SetProp $pset 'BorderTopWidth'  $top.width
        }
        if ($bottom) {
            Try-SetProp $pset 'BorderBottom'      $bottom.type
            Try-SetProp $pset 'BorderBottomColor' $bottom.color
            Try-SetProp $pset 'BorderBottomWidth' $bottom.width
        }
        try { $act.Execute("ParagraphShape", $pset.HSet) | Out-Null } catch {}
    } catch {}
}

# 빨강/주황 가로 막대로 장식된 큰 제목 작성 (범정부 오피스 스타일)
function Write-DecoratedTitle($hwp, $titleText) {
    # 색상 (BGR 정수)
    $orange = ((0x21) -shl 16) -bor ((0x69) -shl 8) -bor 0xE2   # ≈ #E26921 주황
    $red    = ((0x33) -shl 16) -bor ((0x33) -shl 8) -bor 0xCC   # ≈ #CC3333 빨강

    # 1) 위쪽 주황 막대 — 빈 단락 + 굵은 위 테두리
    Set-CharShape $hwp '함초롬바탕' 1 $false
    $act = $hwp.HAction
    $ps = $hwp.HParameterSet.HParaShape
    $act.GetDefault("ParagraphShape", $ps.HSet) | Out-Null
    Try-SetProp $ps 'LeftMargin' 0
    Try-SetProp $ps 'LineSpacing' 100
    Try-SetProp $ps 'AlignType' 0
    Try-SetProp $ps 'BorderTop'      0   # 위 테두리 없음
    Try-SetProp $ps 'BorderBottom'   0   # (제목 단락에서 처리)
    try { $act.Execute("ParagraphShape", $ps.HSet) | Out-Null } catch {}
    Safe-Run $hwp "BreakPara"

    # 2) 제목 단락 — 큰 글씨 + 위/아래 굵은 컬러 테두리
    $act2 = $hwp.HAction
    $ps2 = $hwp.HParameterSet.HParaShape
    $act2.GetDefault("ParagraphShape", $ps2.HSet) | Out-Null
    Try-SetProp $ps2 'LeftMargin' 0
    Try-SetProp $ps2 'LineSpacing' 160
    Try-SetProp $ps2 'AlignType' 1                  # 가운데
    Try-SetProp $ps2 'PrevSpacing' 300
    Try-SetProp $ps2 'NextSpacing' 200
    # 위 주황 테두리
    Try-SetProp $ps2 'BorderTop'       1            # 1 = 실선
    Try-SetProp $ps2 'BorderTopColor'  $orange
    Try-SetProp $ps2 'BorderTopWidth'  5            # 5 = 굵게
    # 아래 빨강 테두리
    Try-SetProp $ps2 'BorderBottom'      1
    Try-SetProp $ps2 'BorderBottomColor' $red
    Try-SetProp $ps2 'BorderBottomWidth' 5
    try { $act2.Execute("ParagraphShape", $ps2.HSet) | Out-Null } catch {}

    Set-CharShape $hwp 'HY헤드라인M' 22 $true
    Insert-Text $hwp $titleText
    Safe-Run $hwp "BreakPara"

    # 3) 테두리 해제 (다음 단락이 영향 안 받게)
    $act3 = $hwp.HAction
    $ps3 = $hwp.HParameterSet.HParaShape
    $act3.GetDefault("ParagraphShape", $ps3.HSet) | Out-Null
    Try-SetProp $ps3 'BorderTop'    0
    Try-SetProp $ps3 'BorderBottom' 0
    Try-SetProp $ps3 'AlignType'    0
    try { $act3.Execute("ParagraphShape", $ps3.HSet) | Out-Null } catch {}
}

function Write-Table($hwp, $rows) {
    $numRows = $rows.Count
    if ($numRows -eq 0) { return }
    $numCols = ($rows[0]).Count
    if ($numCols -eq 0) { return }

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
        Try-SetProp $pset 'WidthType'   0
        Try-SetProp $pset 'HeightType'  0
        Try-SetProp $pset 'WidthValue'  $totalWidth
        Try-SetProp $pset 'HeightValue' ($rowH * $numRows)

        try {
            $pset.CreateItemArray("ColWidth", $numCols) | Out-Null
            for ($c = 0; $c -lt $numCols; $c++) {
                try { $pset.ColWidth.SetItem($c, $colW) } catch {
                    try { $pset.ColWidth.Item($c) = $colW } catch {
                        try { $pset.ColWidth[$c] = $colW } catch {}
                    }
                }
            }
        } catch {}
        try {
            $pset.CreateItemArray("RowHeight", $numRows) | Out-Null
            for ($r = 0; $r -lt $numRows; $r++) {
                try { $pset.RowHeight.SetItem($r, $rowH) } catch {
                    try { $pset.RowHeight.Item($r) = $rowH } catch {
                        try { $pset.RowHeight[$r] = $rowH } catch {}
                    }
                }
            }
        } catch {}

        $act.Execute("TableCreate", $pset.HSet) | Out-Null
        $tableCreated = $true
    } catch {}

    if ($tableCreated) {
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

        # 모든 셀 테두리 + 헤더 행 배경색
        try {
            Safe-Run $hwp "TableColBegin"
            Safe-Run $hwp "TableSelTable"
            $act = $hwp.HAction
            $pset = $hwp.HParameterSet.HCellBorderFill
            $act.GetDefault("CellBorderFill", $pset.HSet) | Out-Null
            Try-SetProp $pset 'HasBorder' $true
            foreach ($dir in 'BorderTypeLeft','BorderTypeRight','BorderTypeTop','BorderTypeBottom','BorderTypeInsideHorz','BorderTypeInsideVert') {
                Try-SetProp $pset $dir 1
            }
            foreach ($w in 'BorderWidthLeft','BorderWidthRight','BorderWidthTop','BorderWidthBottom','BorderWidthInsideHorz','BorderWidthInsideVert') {
                Try-SetProp $pset $w 3
            }
            foreach ($col in 'BorderColorLeft','BorderColorRight','BorderColorTop','BorderColorBottom','BorderColorInsideHorz','BorderColorInsideVert') {
                Try-SetProp $pset $col 0
            }
            try { $act.Execute("CellBorderFill", $pset.HSet) | Out-Null } catch {}
        } catch {}

        # 헤더 행 배경색 (FillBrush 하위셋 정식 API)
        try {
            Safe-Run $hwp "TableColBegin"
            Safe-Run $hwp "TableSelRow"
            $act2 = $hwp.HAction
            $pset2 = $hwp.HParameterSet.HCellBorderFill
            $act2.GetDefault("CellBorderFill", $pset2.HSet) | Out-Null
            Try-SetProp $pset2 'HasFill' $true
            Try-SetProp $pset2 'FillType' 1
            # FillBrush 하위셋으로 색상 설정 (정식 API)
            try {
                $fill = $pset2.HSet.CreateItemSet("FillBrush", "FillBrush")
                $fill.WinBrush.FaceColor = 14474460   # RGB(220,220,220) = 0xDCDCDC
            } catch {
                # 폴백: 직접 속성 시도
                foreach ($p in 'ColorFillFG','ColorFG','FaceColor','Color') {
                    Try-SetProp $pset2 $p 14474460
                }
            }
            try { $act2.Execute("CellBorderFill", $pset2.HSet) | Out-Null } catch {}
        } catch {}

        Safe-Run $hwp "CloseEx"
        Safe-Run $hwp "MoveDocEnd"
        Safe-Run $hwp "BreakPara"
    } else {
        # 폴백: 텍스트로
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

# ── 5단계: 문서 지우고 다시 쓰기 ─────────────────────────────
Safe-Run $hwp "MoveDocBegin"
Safe-Run $hwp "SelectAll"
Safe-Run $hwp "Delete"
Safe-Run $hwp "MoveDocBegin"

$errors = @()
$processed = 0
$firstH1Done = $false   # 문서 제목(첫 H1)에만 컬러 막대 장식 적용
foreach ($node in $nodes) {
    try {
        switch ($node.kind) {
            'heading' {
                if ($node.level -eq 1 -and -not $firstH1Done) {
                    Write-DecoratedTitle $hwp $node.text
                    $firstH1Done = $true
                } else {
                    $key = "H$($node.level)"
                    if (-not $STYLE.ContainsKey($key)) { $key = "H6" }
                    Write-StyledPara $hwp $node.text $STYLE[$key]
                }
            }
            'bullet_sq'   { Write-StyledPara $hwp $node.text $STYLE.BULLET_SQ }
            'bullet_cr'   { Write-StyledPara $hwp $node.text $STYLE.BULLET_CR }
            'bullet_dash' { Write-StyledPara $hwp $node.text $STYLE.BULLET_DASH }
            'bullet_dot'  { Write-StyledPara $hwp $node.text $STYLE.BULLET_DOT }
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

# 저장
$saved = $false
try {
    $hwp.SaveAs($AbsPath, $format, "") | Out-Null
    $saved = $true
} catch {
    try {
        $hwp.SaveAs($AbsPath, "HWP", "") | Out-Null
        $saved = $true
    } catch {
        $errors += "저장 실패: $($_.Exception.Message)"
    }
}

$resultObj = @{
    ok = $saved
    blocks = $processed
    totalBlocks = $nodes.Count
    savedTo = $AbsPath
    inputType = if ($topIsMdH1) { 'markdown' } elseif ($topIsRoman) { 'korean-roman' } else { 'korean-num' }
}
if ($errors.Count -gt 0) { $resultObj.warnings = $errors }
if (-not $saved) { $resultObj.error = "파일 저장 실패" }
Write-Result $resultObj
if (-not $saved) { exit 1 }
