param(
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][string]$PdfPath
)

$ErrorActionPreference = 'Stop'
$word = $null
$document = $null
try {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $PdfPath) | Out-Null
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($SourcePath, $false, $true)
    $pages = $document.ComputeStatistics(2)
    $document.ExportAsFixedFormat($PdfPath, 17)
    [pscustomobject]@{
        Source = $SourcePath
        Pdf = $PdfPath
        Pages = $pages
        Paragraphs = $document.Paragraphs.Count
        Tables = $document.Tables.Count
        InlineShapes = $document.InlineShapes.Count
    }
}
finally {
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
