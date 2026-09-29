param(
  [string]$WorkbookPath = (Join-Path $PSScriptRoot '..\outputs\smartcross-sk-taman-melawati-2-concept-boq-20260922\SmartCross_SK_Taman_Melawati_2_Concept_BoQ.xlsx'),
  [string]$PdfPath = (Join-Path $PSScriptRoot '..\tmp\pdfs\SmartCross_Concept_BoQ_QA.pdf')
)

$ErrorActionPreference = 'Stop'
$WorkbookPath = [System.IO.Path]::GetFullPath($WorkbookPath)
$PdfPath = [System.IO.Path]::GetFullPath($PdfPath)
New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($PdfPath)) | Out-Null

$expected = @('00_Read_Me','01_Executive_Summary','02_Function_to_BoQ','03_Design_Basis','04_Detailed_BoQ','05_Civil_and_Roadworks','06_Field_Equipment','07_Power_and_Electrical','08_Network_and_Comms','09_Software_Integration','10_Cybersecurity_Privacy','11_Test_Commission','12_Training_Doc_Spares','13_OPEX_5Year_TCO','14_Assumptions_RFI','15_Risk_Contingency','16_OODA_Simpson_Bloom_DRAG','17_Options_Comparison','18_Source_Traceability','19_Approval_Gates')
$formulaErrors = @()
$sheetInfo = @()
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
  $wb = $excel.Workbooks.Open($WorkbookPath,0,$true)
  $excel.CalculateFullRebuild()
  foreach($ws in $wb.Worksheets){
    $used=$ws.UsedRange
    $rows=$used.Rows.Count; $cols=$used.Columns.Count
    for($r=1;$r -le $rows;$r++){
      for($c=1;$c -le $cols;$c++){
        $v=$used.Cells.Item($r,$c).Text
        if($v -match '^#(REF!|VALUE!|DIV/0!|NAME\?|N/A|NUM!|NULL!|SPILL!|CALC!)$'){ $formulaErrors += "$($ws.Name)!$($used.Cells.Item($r,$c).Address()):$v" }
      }
    }
    $sheetInfo += [pscustomobject]@{Name=$ws.Name;Rows=$rows;Columns=$cols;Charts=$ws.ChartObjects().Count;ConditionalFormats=$used.FormatConditions.Count}
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($used)
  }
  $names=@($wb.Worksheets | ForEach-Object {$_.Name})
  $missing=@($expected | Where-Object {$_ -notin $names})
  $extra=@($names | Where-Object {$_ -notin $expected})
  $checks=[ordered]@{
    Workbook=$WorkbookPath
    SheetCount=$wb.Worksheets.Count
    MissingSheets=$missing
    ExtraSheets=$extra
    FormulaErrors=$formulaErrors
    DetailedBoQItems=$wb.Worksheets.Item('04_Detailed_BoQ').UsedRange.Rows.Count-4
    ExecutiveChartCount=$wb.Worksheets.Item('01_Executive_Summary').ChartObjects().Count
    DetailedQuantityStatusValidation=$wb.Worksheets.Item('04_Detailed_BoQ').Range('J5').Validation.Type
    ReadMeWarning=$wb.Worksheets.Item('00_Read_Me').Range('A4').Text
    BaseCostDisplay=$wb.Worksheets.Item('01_Executive_Summary').Range('B6').Text
    FiveYearTcoDisplay=$wb.Worksheets.Item('13_OPEX_5Year_TCO').Range('H19').Text
    SheetInfo=$sheetInfo
  }
  if(Test-Path $PdfPath){ Remove-Item -LiteralPath $PdfPath -Force }
  $wb.ExportAsFixedFormat(0,$PdfPath)
  $checks['QaPdf']=$PdfPath
  $checks | ConvertTo-Json -Depth 5
  $wb.Close($false)
} finally {
  if($excel){$excel.Quit(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel)}
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
