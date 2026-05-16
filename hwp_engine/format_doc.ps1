# 한글(HWP) 자동 서식 엔진 - PowerShell 버전
# Windows 내장 PowerShell 사용, 별도 설치 불필요
# 실행: powershell -ExecutionPolicy Bypass -File format_doc.ps1

$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Result($obj) {
    $json = $obj | ConvertTo-Json -Compress
    Write-Output $json
}

# 한글 COM 연결
try {
    $hwp = [System.Runtime.InteropServices.Marshal]::GetActiveObject("HWPFrame.HwpObject")
} catch {
    Write-Result @{ ok = $false; error = "한글 프로그램이 열려있지 않습니다. 한글을 먼저 실행하고 문서를 여세요." }
    exit 1
}

# 문서 텍스트 읽기
try {
    $tmp = [System.IO.Path]::GetTempFileName() + ".txt"
    $hwp.SaveAs($tmp, "TEXT", "") | Out-Null
    $rawText = [System.IO.File]::ReadAllText($tmp, [System.Text.Encoding]::UTF8)
    Remove-Item $tmp -ErrorAction SilentlyContinue
} catch {
    Write-Result @{ ok = $false; error = "문서 읽기 실패: $_" }
    exit 1
}

if ([string]::IsNullOrWhiteSpace($rawText)) {
    Write-Result @{ ok = $false; error = "문서가 비어있습니다." }
    exit 1
}

# ── 텍스트 파싱 ────────────────────────────────────────────────
$lines = $rawText -split "`r?`n"

function Get-LineType($line) {
    $s = $line.Trim()
    if ([string]::IsNullOrEmpty($s)) { return @{ type = "BLANK"; text = "" } }

    # 표 행 감지 (탭 또는 2칸 이상 공백으로 3토큰 이상)
    $parts = $s -split "(\t| {2,})" | Where-Object { $_.Trim() -ne "" -and $_ -notmatch "^ +$" }
    $cells = @($s -split "\t| {2,}" | Where-Object { $_.Trim() -ne "" })
    $hasTime = $s -match "\d{1,2}:\d{2}\s*[~\-]\s*\d{1,2}:\d{2}"
    $hasMoney = $s -match "(\d{1,3}(,\d{3})+|\d+)\s*원"

    if (($cells.Count -ge 3) -or ($hasTime -and ($s.Split(" ").Count -ge 3))) {
        if ($hasMoney) { return @{ type = "BUDGET_ROW"; cells = $cells } }
        return @{ type = "TABLE_ROW"; cells = $cells }
    }

    if ($s -match "^\s*(\d{1,2})\.\s+(.+)$") { return @{ type = "H1"; text = $s } }
    if ($s -match "^\s*([가나다라마바사아자차카타파하])\.\s+(.+)$") { return @{ type = "H2"; text = $s } }
    if ($s -match "^\s*(\d{1,2})\)\s+(.+)$") { return @{ type = "H3"; text = $s } }
    if ($s -match "^\s*([가나다라마바사아자차카타파하])\)\s+(.+)$") { return @{ type = "H4"; text = $s } }
    if ($s -match "^\s*([^\s:：][^:：]{0,15})\s*[:：]\s*(.+)$") { return @{ type = "KV"; text = $s } }

    return @{ type = "BODY"; text = $s }
}

$labeled = $lines | ForEach-Object { Get-LineType $_ }

# IR 노드 생성
$nodes = [System.Collections.ArrayList]::new()
$i = 0
while ($i -lt $labeled.Count) {
    $item = $labeled[$i]

    if ($item.type -eq "BLANK") { $i++; continue }

    if ($item.type -eq "TABLE_ROW" -or $item.type -eq "BUDGET_ROW") {
        $tableRows = [System.Collections.ArrayList]::new()
        $ttype = $item.type
        while ($i -lt $labeled.Count -and $labeled[$i].type -eq $ttype) {
            [void]$tableRows.Add($labeled[$i].cells)
            $i++
        }
        # 열 너비 통일
        $maxCols = ($tableRows | ForEach-Object { $_.Count } | Measure-Object -Maximum).Maximum
        $normRows = $tableRows | ForEach-Object {
            $r = $_
            while ($r.Count -lt $maxCols) { $r += "" }
            ,$r[0..($maxCols-1)]
        }
        [void]$nodes.Add(@{ type = "table"; rows = @($normRows); budget = ($ttype -eq "BUDGET_ROW") })
        continue
    }

    $levelMap = @{ H1=1; H2=2; H3=3; H4=4 }
    if ($levelMap.ContainsKey($item.type)) {
        [void]$nodes.Add(@{ type = "heading"; level = $levelMap[$item.type]; text = $item.text })
    } elseif ($item.type -eq "KV") {
        [void]$nodes.Add(@{ type = "kv"; text = $item.text })
    } else {
        [void]$nodes.Add(@{ type = "body"; text = $item.text })
    }
    $i++
}

# ── 스타일 사전 ─────────────────────────────────────────────────
$STYLES = @{
    H1   = @{ font = "HY헤드라인M"; size = 15; bold = $true;  indent = 0;   line = 160; align = 0 }
    H2   = @{ font = "HY견고딕";    size = 12; bold = $false; indent = 200; line = 160; align = 0 }
    H3   = @{ font = "HY견고딕";    size = 11; bold = $false; indent = 400; line = 160; align = 0 }
    H4   = @{ font = "맑은 고딕";   size = 10; bold = $false; indent = 600; line = 160; align = 0 }
    BODY = @{ font = "맑은 고딕";   size = 10; bold = $false; indent = 200; line = 160; align = 0 }
    KV   = @{ font = "맑은 고딕";   size = 10; bold = $false; indent = 200; line = 160; align = 0 }
    TH   = @{ font = "맑은 고딕";   size = 10; bold = $true;  align = 1 }
    TD   = @{ font = "맑은 고딕";   size = 10; bold = $false; align = 0 }
}

$FONT_ATTRS = @("FaceNameHangul","FaceNameLatin","FaceNameHanja","FaceNameJapanese","FaceNameOther","FaceNameSymbol","FaceNameUser")

function Set-CharShape($hwp, $font, $sizePt, $bold) {
    $act = $hwp.HAction
    $pset = $hwp.HParameterSet.HCharShape
    $act.GetDefault("CharShape", $pset.HSet) | Out-Null
    foreach ($attr in $FONT_ATTRS) { $pset.$attr = $font }
    $pset.Height = $sizePt * 100
    $pset.Bold = if ($bold) { 1 } else { 0 }
    $act.Execute("CharShape", $pset.HSet) | Out-Null
}

function Set-ParaShape($hwp, $indent, $line, $align) {
    $act = $hwp.HAction
    $pset = $hwp.HParameterSet.HParaShape
    $act.GetDefault("ParagraphShape", $pset.HSet) | Out-Null
    $pset.Indent = $indent
    $pset.LineSpacing = $line
    $pset.LineSpacingType = 0
    $pset.AlignType = $align
    $act.Execute("ParagraphShape", $pset.HSet) | Out-Null
}

function Insert-Text($hwp, $text) {
    $act = $hwp.HAction
    $pset = $hwp.HParameterSet.HInsertText
    $act.GetDefault("InsertText", $pset.HSet) | Out-Null
    $pset.Text = $text
    $act.Execute("InsertText", $pset.HSet) | Out-Null
}

function Write-Paragraph($hwp, $text, $style) {
    Set-ParaShape $hwp $style.indent $style.line $style.align
    Set-CharShape $hwp $style.font $style.size $style.bold
    Insert-Text $hwp $text
    $hwp.HAction.Run("BreakPara") | Out-Null
}

function Write-Table($hwp, $rows) {
    $numRows = $rows.Count
    $numCols = ($rows[0]).Count

    $act = $hwp.HAction
    $pset = $hwp.HParameterSet.HTableCreation
    $act.GetDefault("TableCreate", $pset.HSet) | Out-Null
    $pset.Rows = $numRows
    $pset.Cols = $numCols
    $pset.WidthType = 0
    $pset.HeightType = 1
    $pset.CreateItemArray("ColWidth", $numCols) | Out-Null
    $colW = [int](8000 / $numCols)
    for ($c = 0; $c -lt $numCols; $c++) { $pset.ColWidth.SetItem($c, $colW) | Out-Null }
    $pset.CreateItemArray("RowHeight", $numRows) | Out-Null
    for ($r = 0; $r -lt $numRows; $r++) { $pset.RowHeight.SetItem($r, 1000) | Out-Null }
    $act.Execute("TableCreate", $pset.HSet) | Out-Null

    for ($r = 0; $r -lt $numRows; $r++) {
        for ($c = 0; $c -lt $numCols; $c++) {
            $isHeader = ($r -eq 0)
            $cellStyle = if ($isHeader) { $STYLES.TH } else { $STYLES.TD }
            $cellText = if ($c -lt $rows[$r].Count) { $rows[$r][$c] } else { "" }

            Set-CharShape $hwp $cellStyle.font $cellStyle.size $cellStyle.bold
            Set-ParaShape $hwp 0 140 $cellStyle.align
            Insert-Text $hwp $cellText

            if (-not ($r -eq ($numRows-1) -and $c -eq ($numCols-1))) {
                $hwp.HAction.Run("TableRightCell") | Out-Null
            }
        }
    }
    $hwp.HAction.Run("CloseEx") | Out-Null
    $hwp.HAction.Run("MoveDocEnd") | Out-Null
    $hwp.HAction.Run("BreakPara") | Out-Null
}

# ── 문서 지우고 다시 쓰기 ───────────────────────────────────────
try {
    $hwp.HAction.Run("MoveDocBegin") | Out-Null
    $hwp.HAction.Run("SelectAll") | Out-Null
    $hwp.HAction.Run("Delete") | Out-Null
    $hwp.HAction.Run("MoveDocBegin") | Out-Null

    foreach ($node in $nodes) {
        if ($node.type -eq "heading") {
            $styleKey = "H$($node.level)"
            $s = $STYLES[$styleKey]
            Write-Paragraph $hwp $node.text $s
        } elseif ($node.type -eq "kv") {
            Write-Paragraph $hwp $node.text $STYLES.KV
        } elseif ($node.type -eq "body") {
            Write-Paragraph $hwp $node.text $STYLES.BODY
        } elseif ($node.type -eq "table") {
            Write-Table $hwp $node.rows
        }
    }

    $hwp.HAction.Run("MoveDocBegin") | Out-Null

    Write-Result @{ ok = $true; blocks = $nodes.Count }
} catch {
    Write-Result @{ ok = $false; error = "서식 적용 중 오류: $_" }
    exit 1
}
