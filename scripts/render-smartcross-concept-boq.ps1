param(
  [string]$WorkbookPath = (Join-Path $PSScriptRoot '..\outputs\smartcross-sk-taman-melawati-2-concept-boq-20260922\SmartCross_SK_Taman_Melawati_2_Concept_BoQ.xlsx'),
  [string]$OutputDir = (Join-Path $PSScriptRoot '..\tmp\smartcross-boq-renders')
)

$ErrorActionPreference='Stop'
$WorkbookPath=[System.IO.Path]::GetFullPath($WorkbookPath)
$OutputDir=[System.IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$excel=New-Object -ComObject Excel.Application
$excel.Visible=$true
$excel.DisplayAlerts=$false
try{
  $wb=$excel.Workbooks.Open($WorkbookPath,0,$true)
  foreach($ws in $wb.Worksheets){
    $ws.Activate() | Out-Null
    $range=$ws.UsedRange
    $range.Select() | Out-Null
    $range.CopyPicture(1,2)
    Start-Sleep -Milliseconds 500
    $scale=[Math]::Min(1.0,1800.0/[Math]::Max(1,$range.Width))
    $w=[Math]::Max(500,[Math]::Round($range.Width*$scale))
    $h=[Math]::Max(300,[Math]::Round($range.Height*$scale))
    $chartObj=$ws.ChartObjects().Add(0,0,$w,$h)
    $chartObj.Activate() | Out-Null
    $chartObj.Chart.Paste() | Out-Null
    Start-Sleep -Milliseconds 400
    $safe=($ws.Name -replace '[^A-Za-z0-9_-]','_')
    $path=Join-Path $OutputDir "$safe.png"
    $chartObj.Chart.Export($path,'PNG') | Out-Null
    $chartObj.Delete()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($range)
    Write-Output $path
  }
  $wb.Close($false)
}finally{
  if($wb){try{$wb.Close($false)}catch{}}
  if($excel){try{$excel.Quit()}catch{};[void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)}
  [GC]::Collect();[GC]::WaitForPendingFinalizers()
}
