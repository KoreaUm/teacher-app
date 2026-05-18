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

$TAG_PATTERNS = @{
    TITLE       = '^\s*제목\s*[:：]\s*(.+)$'
    LEAD        = '^\s*(서론|요약|개요문)\s*[:：]\s*(.+)$'
    SECTION     = '^\s*(네모|중제목)\s*[:：]\s*(.+)$'
    CIRCLE      = '^\s*(원|동그라미)\s*[:：]\s*(.+)$'
    DASH        = '^\s*(바|하이픈)\s*[:：]\s*(.+)$'
    STAR        = '^\s*(별|별표)\s*[:：]\s*(.+)$'
    SCHEDULE    = '^\s*(시간계획표|일정표|시간표)\s*[:：]\s*(.+)$'
    ACTIONS     = '^\s*(지사님하실일|지사님 하실 일|기관장하실일|기관장 하실 일|하실일|하실 일)\s*[:：]\s*(.+)$'
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

    if ($s -match $TAG_PATTERNS.TITLE)   { return @{ type = 'MD_H1'; text = Strip-MdMarkers $matches[1] } }
    if ($s -match $TAG_PATTERNS.LEAD)    { return @{ type = 'LEAD'; text = Strip-MdMarkers $matches[2] } }
    if ($s -match $TAG_PATTERNS.SECTION) { return @{ type = 'TAG_SECTION'; text = Strip-MdMarkers $matches[2] } }
    if ($s -match $TAG_PATTERNS.CIRCLE)  { return @{ type = 'BULLET_CR'; text = 'ㅇ ' + (Strip-MdMarkers $matches[2]) } }
    if ($s -match $TAG_PATTERNS.DASH)    { return @{ type = 'BULLET_DASH'; text = '- ' + (Strip-MdMarkers $matches[2]) } }
    if ($s -match $TAG_PATTERNS.STAR)    { return @{ type = 'BULLET_DOT'; text = '￭ ' + (Strip-MdMarkers $matches[2]) } }
    if ($s -match $TAG_PATTERNS.ACTIONS) { return @{ type = 'BODY'; text = (Strip-MdMarkers ($matches[1] + ': ' + $matches[2])) } }
    if ($s -match $TAG_PATTERNS.SCHEDULE) {
        $payload = Strip-MdMarkers $matches[2]
        $cells = Convert-ScheduleLineToCells $payload
        return @{ type = 'TABLE_ROW'; cells = $cells }
    }

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
        if ($indent -ge 6)      { return @{ type = 'BULLET_DOT';  text = '￭ ' + $txt } }
        elseif ($indent -ge 4)  { return @{ type = 'BULLET_DASH'; text = '- ' + $txt } }
        elseif ($indent -ge 2)  { return @{ type = 'BULLET_CR';   text = 'ㅇ ' + $txt } }
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

function Convert-ScheduleLineToCells($text) {
    $t = ([string]$text).Trim()
    $m = [regex]::Match($t, '^\s*(\d{1,2}:\d{2})\s*[:~∼\-–]\s*(\d{1,2}:\d{2})\s*[:：]\s*(.+)$')
    if ($m.Success) {
        $rest = $m.Groups[3].Value.Trim()
        $parts = @($rest -split '\s*[:：]\s*' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
        $activity = if ($parts.Count -ge 1) { $parts[0] } else { $rest }
        $note = if ($parts.Count -ge 2) { ($parts[1..($parts.Count-1)] -join ' / ') } else { '' }
        return @("$($m.Groups[1].Value) ~ $($m.Groups[2].Value)", $activity, $note)
    }
    $parts2 = @($t -split '\s*[:：]\s*' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' })
    if ($parts2.Count -ge 3) { return @($parts2[0], $parts2[1], ($parts2[2..($parts2.Count-1)] -join ' / ')) }
    if ($parts2.Count -eq 2) { return @($parts2[0], $parts2[1], '') }
    return @($t, '', '')
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
            $normRows = [System.Collections.ArrayList]::new()
            foreach ($row in $rows) {
                $r = @($row)
                while ($r.Count -lt $maxCols) { $r += "" }
                [void]$normRows.Add([object[]]($r[0..($maxCols-1)]))
            }
            if ($maxCols -eq 3 -and $normRows.Count -gt 0 -and ([string]$normRows[0][0]) -match '^\d{1,2}:\d{2}\s*[~∼\-–]') {
                [void]$normRows.Insert(0, [object[]]@('시간', '내용', '비고'))
            }
            [void]$nodes.Add(@{ kind = 'table'; rows = $normRows })
        }
        continue
    }

    $lvl = Get-HeadingLevel $item.type
    if ($lvl -gt 0) {
        [void]$nodes.Add(@{ kind = 'heading'; level = $lvl; text = $item.text })
    } elseif ($item.type -eq 'LEAD')        { [void]$nodes.Add(@{ kind = 'lead';        text = $item.text }) }
    elseif ($item.type -eq 'TAG_SECTION')   { [void]$nodes.Add(@{ kind = 'section';     text = $item.text }) }
    elseif ($item.type -eq 'BULLET_SQ')     { [void]$nodes.Add(@{ kind = 'bullet_sq';   text = $item.text }) }
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
    H1 = @{ font='HY헤드라인M'; size=16; bold=$false; indent=400;                line=160; align=0; spaceBefore=500; spaceAfter=120 }   # Ⅰ. 장 제목
    H2 = @{ font='HY헤드라인M'; size=16; bold=$false; indent=0;                  line=160; align=0; spaceBefore=420; spaceAfter=100 }   # 1. 제목
    H3 = @{ font='휴먼명조';    size=15; bold=$true;  indent=0;                  line=150; align=0; spaceBefore=300; spaceAfter=0 }     # 가.
    H4 = @{ font='휴먼명조';    size=15; bold=$false; indent=$INDENT_UNIT;       line=150; align=0; spaceBefore=0;   spaceAfter=0 }
    H5 = @{ font='휴먼명조';    size=15; bold=$false; indent=($INDENT_UNIT*2);   line=150; align=0; spaceBefore=0;   spaceAfter=0 }
    H6 = @{ font='휴먼명조';    size=15; bold=$false; indent=($INDENT_UNIT*3);   line=150; align=0; spaceBefore=0;   spaceAfter=0 }
    # 행안부 업무계획 기준: 본문 15pt 휴먼명조, ㅇ/- 위계, 소제목 파란색
    BULLET_SQ   = @{ font='휴먼명조'; size=15; bold=$true;  color=0x0000FF; indent=0;            hanging=700; line=150; align=0; spaceBefore=1000; spaceAfter=0 }
    BULLET_CR   = @{ font='휴먼명조'; size=15; bold=$false; indent=0;                            hanging=700; line=150; align=0; spaceBefore=800;  spaceAfter=0 }
    BULLET_DASH = @{ font='휴먼명조'; size=15; bold=$false; indent=$INDENT_UNIT;                 hanging=500; line=150; align=0; spaceBefore=450;  spaceAfter=0 }
    BULLET_DOT  = @{ font='맑은 고딕'; size=12; bold=$false; indent=($INDENT_UNIT*1);            hanging=450; line=140; align=0; spaceBefore=250;  spaceAfter=0 }
    EMPH        = @{ font='맑은 고딕'; size=14; bold=$true;  indent=0;                            hanging=700; line=150; align=0; spaceBefore=300;  spaceAfter=0 }
    NOTE        = @{ font='맑은 고딕'; size=12; bold=$false; indent=$INDENT_UNIT;                 line=140; align=0; spaceBefore=300; spaceAfter=0 }
    BODY        = @{ font='휴먼명조'; size=15; bold=$false; indent=0;                             line=150; align=0; spaceBefore=0; spaceAfter=0 }
    LEAD        = @{ font='휴먼명조'; size=15; bold=$false; indent=0;                             line=150; align=0; spaceBefore=0; spaceAfter=60 }
    SECTION     = @{ font='휴먼명조'; size=15; bold=$true;  color=0x0000FF; indent=0; hanging=700; line=150; align=0; spaceBefore=1000; spaceAfter=0 }
    TH          = @{ font='맑은 고딕'; size=12; bold=$true;  align=1 }
    TD          = @{ font='맑은 고딕'; size=12; bold=$false; align=0 }
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

function Set-CharShape($hwp, $font, $sizePt, $bold, $color=$null) {
    try {
        $act = $hwp.HAction
        $pset = $hwp.HParameterSet.HCharShape
        $act.GetDefault("CharShape", $pset.HSet) | Out-Null
        foreach ($attr in $FONT_ATTRS) { Try-SetProp $pset $attr $font }
        Try-SetProp $pset 'Height' ($sizePt * 100)
        $boldVal = if ($bold) { 1 } else { 0 }
        Try-SetProp $pset 'Bold' $boldVal
        if ($null -ne $color) {
            Try-SetProp $pset 'TextColor' $color
            Try-SetProp $pset 'CharColor' $color
        } else {
            Try-SetProp $pset 'TextColor' 0
            Try-SetProp $pset 'CharColor' 0
        }
        try { $act.Execute("CharShape", $pset.HSet) | Out-Null } catch {}
    } catch {}
}

function Set-ParaShape($hwp, $indent, $line, $align, $spaceBefore=0, $spaceAfter=0, $hanging=0) {
    try {
        $act = $hwp.HAction
        $pset = $hwp.HParameterSet.HParaShape
        $act.GetDefault("ParagraphShape", $pset.HSet) | Out-Null
        $left = $indent + $hanging
        Try-SetProp $pset 'LeftMargin'      $left
        Try-SetProp $pset 'Indent'          (-1 * $hanging)
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
        $hanging = if ($s.ContainsKey('hanging')) { $s.hanging } else { 0 }
        $color = if ($s.ContainsKey('color')) { $s.color } else { $null }
        Set-ParaShape $hwp $s.indent $s.line $s.align $s.spaceBefore $s.spaceAfter $hanging
        Set-CharShape $hwp $s.font $s.size $s.bold $color
        Insert-Text $hwp $text
        Safe-Run $hwp "BreakPara"
    } catch {}
}

function Write-ColorRule($hwp, $color, $align=1, $spaceBefore=0, $spaceAfter=0) {
    try {
        Set-ParaShape $hwp 0 100 $align $spaceBefore $spaceAfter 0
        Set-CharShape $hwp '함초롬바탕' 10 $true $color
        Insert-Text $hwp '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        Safe-Run $hwp "BreakPara"
    } catch {}
}

function Write-LeadPara($hwp, $text, $isLastLead=$false) {
    try {
        $gray = 0x808080
        $act = $hwp.HAction
        $ps = $hwp.HParameterSet.HParaShape
        $act.GetDefault("ParagraphShape", $ps.HSet) | Out-Null
        Try-SetProp $ps 'LeftMargin' 0
        Try-SetProp $ps 'Indent' 0
        Try-SetProp $ps 'LineSpacing' 160
        Try-SetProp $ps 'LineSpacingType' 0
        Try-SetProp $ps 'AlignType' 0
        Try-SetProp $ps 'PrevSpacing' 0
        Try-SetProp $ps 'NextSpacing' 60
        Try-SetProp $ps 'BorderBottom' 0
        try { $act.Execute("ParagraphShape", $ps.HSet) | Out-Null } catch {}
        Set-CharShape $hwp $STYLE.LEAD.font $STYLE.LEAD.size $STYLE.LEAD.bold
        Insert-Text $hwp $text
        Safe-Run $hwp "BreakPara"

        if ($isLastLead) {
            Write-ColorRule $hwp $gray 0 0 200
        }
    } catch {
        Write-StyledPara $hwp $text $STYLE.LEAD
    }
}

function Normalize-SectionTitle($text) {
    $t = [string]$text
    $t = $t -replace '^\s*[□■]\s*', ''
    $t = $t -replace '^\s*\d{1,2}\.\s*', ''
    return $t.Trim()
}

function Write-SectionHeading($hwp, $text) {
    $title = Normalize-SectionTitle $text
    if ([string]::IsNullOrWhiteSpace($title)) { $title = [string]$text }
    Write-StyledPara $hwp ("□ " + $title) $STYLE.SECTION
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

    # HWP 버전에 따라 단락 테두리/도형 API가 조용히 실패하는 경우가 있어
    # 실제 색상 글자선을 먼저 넣고, 테두리는 보조 장식으로만 시도한다.
    Write-ColorRule $hwp $orange 1 150 80

    # 제목 단락 — 큰 글씨 + 가운데 정렬
    $act2 = $hwp.HAction
    $ps2 = $hwp.HParameterSet.HParaShape
    $act2.GetDefault("ParagraphShape", $ps2.HSet) | Out-Null
    Try-SetProp $ps2 'LeftMargin' 0
    Try-SetProp $ps2 'LineSpacing' 160
    Try-SetProp $ps2 'AlignType' 1                  # 가운데
    Try-SetProp $ps2 'PrevSpacing' 220
    Try-SetProp $ps2 'NextSpacing' 200
    Try-SetProp $ps2 'BorderTop'       0
    Try-SetProp $ps2 'BorderBottom'    0
    try { $act2.Execute("ParagraphShape", $ps2.HSet) | Out-Null } catch {}

    Set-CharShape $hwp 'HY헤드라인M' 32 $false
    Insert-Text $hwp $titleText
    Safe-Run $hwp "BreakPara"

    Write-ColorRule $hwp $red 1 40 160

    # 테두리 해제 (다음 단락이 영향 안 받게)
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
                Set-ParaShape $hwp 0 140 $cellStyle.align 0 0
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
                $fill.WinBrush.FaceColor = 15921906   # RGB(242,242,242) = #F2F2F2
            } catch {
                # 폴백: 직접 속성 시도
                foreach ($p in 'ColorFillFG','ColorFG','FaceColor','Color') {
                    Try-SetProp $pset2 $p 15921906
                }
            }
            try { $act2.Execute("CellBorderFill", $pset2.HSet) | Out-Null } catch {}
        } catch {}

        Safe-Run $hwp "CloseEx"
        Safe-Run $hwp "MoveDocEnd"
        Safe-Run $hwp "BreakPara"
    } else {
        Write-TextTableFallback $hwp $rows
    }
}

function Measure-CellWidth($value) {
    $sum = 0
    foreach ($ch in ([string]$value).ToCharArray()) {
        $code = [int][char]$ch
        if (($code -ge 0xAC00 -and $code -le 0xD7A3) -or ($code -ge 0x3130 -and $code -le 0x318F)) {
            $sum += 2
        } else {
            $sum += 1
        }
    }
    return $sum
}

function Pad-Cell($value, $width) {
    $text = [string]$value
    $need = [Math]::Max(0, $width - (Measure-CellWidth $text))
    return $text + (' ' * $need)
}

function Write-TextTableFallback($hwp, $rows) {
    try {
        $numRows = $rows.Count
        if ($numRows -eq 0) { return }
        $numCols = ($rows[0]).Count
        $widths = @()
        for ($c = 0; $c -lt $numCols; $c++) {
            $max = 4
            for ($r = 0; $r -lt $numRows; $r++) {
                $cell = if ($c -lt $rows[$r].Count) { [string]$rows[$r][$c] } else { "" }
                $max = [Math]::Max($max, [Math]::Min(32, (Measure-CellWidth $cell)))
            }
            $widths += ($max + 2)
        }
        $sepParts = @()
        foreach ($w in $widths) { $sepParts += ('-' * $w) }
        $sep = '+' + ($sepParts -join '+') + '+'

        Set-ParaShape $hwp 0 145 0 120 60 0
        Set-CharShape $hwp 'D2Coding' 11 $false
        Insert-Text $hwp $sep
        Safe-Run $hwp "BreakPara"

        for ($r = 0; $r -lt $numRows; $r++) {
            $parts = @()
            for ($c = 0; $c -lt $numCols; $c++) {
                $cell = if ($c -lt $rows[$r].Count) { [string]$rows[$r][$c] } else { "" }
                $parts += (' ' + (Pad-Cell $cell ($widths[$c] - 1)))
            }
            Set-ParaShape $hwp 0 145 0 0 0 0
            Set-CharShape $hwp 'D2Coding' 11 ($r -eq 0)
            Insert-Text $hwp ('|' + ($parts -join '|') + '|')
            Safe-Run $hwp "BreakPara"
            if ($r -eq 0) {
                Set-CharShape $hwp 'D2Coding' 11 $false
                Insert-Text $hwp $sep
                Safe-Run $hwp "BreakPara"
            }
        }
        Set-CharShape $hwp 'D2Coding' 11 $false
        Insert-Text $hwp $sep
        Safe-Run $hwp "BreakPara"
        Safe-Run $hwp "BreakPara"
    } catch {}
}

# ── 5단계: 문서 지우고 다시 쓰기 ─────────────────────────────
Safe-Run $hwp "MoveDocBegin"
Safe-Run $hwp "SelectAll"
Safe-Run $hwp "Delete"
Safe-Run $hwp "MoveDocBegin"

$errors = @()
$processed = 0
$firstH1Done = $false   # 문서 제목(첫 H1)에만 컬러 막대 장식 적용
$firstSectionDone = $false
foreach ($node in $nodes) {
    try {
        switch ($node.kind) {
            'heading' {
                if ($node.level -eq 1 -and -not $firstH1Done) {
                    Write-DecoratedTitle $hwp $node.text
                    $firstH1Done = $true
                } else {
                    if (($topIsMdH1 -and $node.level -eq 2) -or ((-not $topIsMdH1) -and $node.level -eq 1)) {
                        Write-SectionHeading $hwp $node.text
                        $firstSectionDone = $true
                    } else {
                        $key = "H$($node.level)"
                        if (-not $STYLE.ContainsKey($key)) { $key = "H6" }
                        Write-StyledPara $hwp $node.text $STYLE[$key]
                        $firstSectionDone = $true
                    }
                }
            }
            'lead'        {
                Write-LeadPara $hwp $node.text $true
            }
            'section'     {
                Write-SectionHeading $hwp $node.text
                $firstSectionDone = $true
            }
            'bullet_sq'   { Write-StyledPara $hwp $node.text $STYLE.BULLET_SQ }
            'bullet_cr'   { Write-StyledPara $hwp $node.text $STYLE.BULLET_CR }
            'bullet_dash' { Write-StyledPara $hwp $node.text $STYLE.BULLET_DASH }
            'bullet_dot'  { Write-StyledPara $hwp $node.text $STYLE.BULLET_DOT }
            'emph'        { Write-StyledPara $hwp $node.text $STYLE.EMPH }
            'note'        { Write-StyledPara $hwp $node.text $STYLE.NOTE }
            'body'        {
                if ($firstH1Done -and -not $firstSectionDone) {
                    Write-LeadPara $hwp $node.text $true
                } else {
                    Write-StyledPara $hwp $node.text $STYLE.BODY
                }
            }
            'table'       { Write-Table $hwp $node.rows; $firstSectionDone = $true }
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
