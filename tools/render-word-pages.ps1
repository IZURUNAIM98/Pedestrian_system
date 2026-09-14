param(
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
$word = $null
$document = $null
$powerPoint = $null
$presentation = $null
try {
    New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
    Get-ChildItem -LiteralPath $OutputDirectory -Filter 'page-*.png' -ErrorAction SilentlyContinue | Remove-Item -Force

    $word = New-Object -ComObject Word.Application
    $word.Visible = $true
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($SourcePath, $false, $true)
    $document.Activate()
    $pageCount = $document.ComputeStatistics(2)

    $powerPoint = New-Object -ComObject PowerPoint.Application
    $powerPoint.Visible = -1
    $presentation = $powerPoint.Presentations.Add()
    $presentation.PageSetup.SlideWidth = 612
    $presentation.PageSetup.SlideHeight = 792

    for ($pageNumber = 1; $pageNumber -le $pageCount; $pageNumber++) {
        $startRange = $document.GoTo(1, 1, $pageNumber)
        $start = $startRange.Start
        if ($pageNumber -lt $pageCount) {
            $nextRange = $document.GoTo(1, 1, $pageNumber + 1)
            $end = $nextRange.Start - 1
        }
        else {
            $end = $document.Content.End - 1
        }

        $pageRange = $document.Range($start, $end)
        $pageRange.Select()
        $word.Selection.CopyAsPicture()
        Start-Sleep -Milliseconds 350

        $slide = $presentation.Slides.Add($pageNumber, 12)
        $shapeRange = $slide.Shapes.PasteSpecial(2)
        $shape = $shapeRange.Item(1)
        $shape.LockAspectRatio = -1

        $maxWidth = 576
        $maxHeight = 756
        if (($shape.Width / $shape.Height) -gt ($maxWidth / $maxHeight)) {
            $shape.Width = $maxWidth
        }
        else {
            $shape.Height = $maxHeight
        }
        $shape.Left = (612 - $shape.Width) / 2
        $shape.Top = (792 - $shape.Height) / 2

        $outputPath = Join-Path $OutputDirectory ("page-{0}.png" -f $pageNumber)
        $slide.Export($outputPath, 'PNG', 1224, 1584)
    }

    [pscustomobject]@{
        Pages = $pageCount
        OutputDirectory = $OutputDirectory
        Images = (Get-ChildItem -LiteralPath $OutputDirectory -Filter 'page-*.png').Count
    }
}
finally {
    if ($presentation -ne $null) {
        try { $presentation.Close() } catch {}
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null
    }
    if ($powerPoint -ne $null) {
        try { $powerPoint.Quit() } catch {}
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint) | Out-Null
    }
    if ($document -ne $null) {
        try { $document.Close($false) } catch {}
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) | Out-Null
    }
    if ($word -ne $null) {
        try { $word.Quit() } catch {}
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
