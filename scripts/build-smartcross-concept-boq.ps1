param(
  [string]$OutputDir = (Join-Path $PSScriptRoot '..\outputs\smartcross-sk-taman-melawati-2-concept-boq-20260922')
)

$ErrorActionPreference = 'Stop'

$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$OutputPath = Join-Path $OutputDir 'SmartCross_SK_Taman_Melawati_2_Concept_BoQ.xlsx'
$PreparedDate = Get-Date '2026-09-22'

$xlCenter = -4108
$xlLeft = -4131
$xlRight = -4152
$xlTop = -4160
$xlContinuous = 1
$xlThin = 2
$xlLandscape = 2
$xlOpenXMLWorkbook = 51
$xlColumnClustered = 51
$xlExpression = 2
$xlCellValue = 1
$xlEqual = 3
$xlNotEqual = 4
$xlTextValues = 1
$xlValidateList = 3
$xlValidAlertStop = 1
$xlBetween = 1

$navy = 0x633014
$blue = 0xA97031
$teal = 0x8C7A22
$lightBlue = 0xEBD9D0
$lightGrey = 0xF2F2F2
$amber = 0xCCFFFF
$lightRed = 0xCECEFF
$lightGreen = 0xE2F0D9
$white = 0xFFFFFF
$dark = 0x333333

function Set-CellValue($sheet, [int]$row, [int]$col, $value) {
  if ($value -is [int] -or $value -is [long] -or $value -is [decimal]) { $value = [double]$value }
  try {
    if ($value -is [double]) { $sheet.Cells.Item($row, $col).Value = $value }
    else { $sheet.Cells.Item($row, $col).Value2 = $value }
  }
  catch { throw "Cell write failed at $($sheet.Name)!R${row}C${col}; type=$($value.GetType().FullName); value=$value. $($_.Exception.Message)" }
}

function Write-Row($sheet, [int]$row, [int]$startCol, [object[]]$values) {
  for ($i = 0; $i -lt $values.Count; $i++) { Set-CellValue $sheet $row ($startCol + $i) $values[$i] }
}

function Write-Rows($sheet, [int]$startRow, [int]$startCol, [object[]]$rows) {
  for ($r = 0; $r -lt $rows.Count; $r++) { Write-Row $sheet ($startRow + $r) $startCol ([object[]]$rows[$r]) }
}

function Set-Title($sheet, [string]$title, [int]$lastCol) {
  $sheet.Cells.Item(2, 1).Value2 = $title
  $rng = $sheet.Range($sheet.Cells.Item(2, 1), $sheet.Cells.Item(2, $lastCol))
  $rng.Font.Name = 'Arial'; $rng.Font.Size = 15; $rng.Font.Bold = $true; $rng.Font.Color = $navy
  $rng.Borders.Item(9).LineStyle = $xlContinuous; $rng.Borders.Item(9).Weight = $xlThin; $rng.Borders.Item(9).Color = $blue
  $sheet.Rows.Item(2).RowHeight = 24
}

function Set-Header($sheet, [int]$row, [int]$firstCol, [int]$lastCol) {
  $rng = $sheet.Range($sheet.Cells.Item($row, $firstCol), $sheet.Cells.Item($row, $lastCol))
  $rng.Interior.Color = $navy; $rng.Font.Color = $white; $rng.Font.Bold = $true; $rng.Font.Name = 'Arial'; $rng.Font.Size = 10
  $rng.HorizontalAlignment = $xlCenter; $rng.VerticalAlignment = $xlCenter; $rng.WrapText = $true
  $rng.Borders.Color = $white; $rng.Borders.Weight = $xlThin
  $sheet.Rows.Item($row).RowHeight = 32
}

function Set-Section($sheet, [int]$row, [string]$label, [int]$lastCol) {
  $sheet.Cells.Item($row, 1).Value2 = $label
  $rng = $sheet.Range($sheet.Cells.Item($row, 1), $sheet.Cells.Item($row, $lastCol))
  $rng.Interior.Color = $lightBlue; $rng.Font.Bold = $true; $rng.Font.Color = $navy
  $rng.Borders.Item(9).LineStyle = $xlContinuous; $rng.Borders.Item(9).Weight = $xlThin; $rng.Borders.Item(9).Color = $blue
}

function Apply-BaseStyle($sheet) {
  $sheet.Cells.Font.Name = 'Arial'; $sheet.Cells.Font.Size = 10; $sheet.Cells.Font.Color = $dark
  $sheet.Activate() | Out-Null
  $excel.ActiveWindow.DisplayGridlines = $false
  try {
    $sheet.PageSetup.Orientation = $xlLandscape
    $sheet.PageSetup.Zoom = $false
    $sheet.PageSetup.FitToPagesWide = 1
    $sheet.PageSetup.LeftMargin = $excel.InchesToPoints(0.25)
    $sheet.PageSetup.RightMargin = $excel.InchesToPoints(0.25)
    $sheet.PageSetup.TopMargin = $excel.InchesToPoints(0.4)
    $sheet.PageSetup.BottomMargin = $excel.InchesToPoints(0.4)
  } catch {}
}

function Add-ListValidation($range, [string]$items) {
  try { $range.Validation.Delete() } catch {}
  $range.Validation.Add($xlValidateList, $xlValidAlertStop, $xlBetween, $items)
  $range.Validation.IgnoreBlank = $true
  $range.Validation.InCellDropdown = $true
}

function Finish-TableSheet($sheet, [int]$headerRow, [int]$lastRow, [int]$lastCol, [int[]]$widths) {
  $table = $sheet.Range($sheet.Cells.Item($headerRow, 1), $sheet.Cells.Item($lastRow, $lastCol))
  $table.VerticalAlignment = $xlTop
  $table.WrapText = $true
  $table.Borders.Item(9).LineStyle = $xlContinuous; $table.Borders.Item(9).Color = 0xD9D9D9
  $table.AutoFilter() | Out-Null
  $sheet.Activate() | Out-Null
  $excel.ActiveWindow.SplitRow = $headerRow
  $excel.ActiveWindow.FreezePanes = $true
  for ($i=0; $i -lt $widths.Count; $i++) { $sheet.Columns.Item($i+1).ColumnWidth = $widths[$i] }
  $sheet.Rows.Item("$($headerRow+1):$lastRow").RowHeight = 42
  try {
    $sheet.PageSetup.PrintTitleRows = "`$$headerRow`:`$$headerRow"
    $sheet.PageSetup.PrintArea = $sheet.Range($sheet.Cells.Item(1,1),$sheet.Cells.Item($lastRow,$lastCol)).Address()
  } catch {}
}

function Add-SimpleTableSheet($sheet, [string]$title, [object[]]$headers, [object[]]$rows, [int[]]$widths) {
  Set-Title $sheet $title $headers.Count
  Write-Row $sheet 4 1 $headers
  Set-Header $sheet 4 1 $headers.Count
  Write-Rows $sheet 5 1 $rows
  Finish-TableSheet $sheet 4 (4 + $rows.Count) $headers.Count $widths
}

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$excel.ScreenUpdating = $false

try {
  $wb = $excel.Workbooks.Add()
  while ($wb.Worksheets.Count -gt 1) { $wb.Worksheets.Item($wb.Worksheets.Count).Delete() }
  $sheetNames = @(
    '00_Read_Me','01_Executive_Summary','02_Function_to_BoQ','03_Design_Basis','04_Detailed_BoQ',
    '05_Civil_and_Roadworks','06_Field_Equipment','07_Power_and_Electrical','08_Network_and_Comms',
    '09_Software_Integration','10_Cybersecurity_Privacy','11_Test_Commission','12_Training_Doc_Spares',
    '13_OPEX_5Year_TCO','14_Assumptions_RFI','15_Risk_Contingency','16_OODA_Simpson_Bloom_DRAG',
    '17_Options_Comparison','18_Source_Traceability','19_Approval_Gates'
  )
  $wb.Worksheets.Item(1).Name = $sheetNames[0]
  for ($i=1; $i -lt $sheetNames.Count; $i++) { $wb.Worksheets.Add([Type]::Missing, $wb.Worksheets.Item($wb.Worksheets.Count)).Name = $sheetNames[$i] }
  foreach ($ws in $wb.Worksheets) { Apply-BaseStyle $ws }

  # 00 Read Me
  $s = $wb.Worksheets.Item('00_Read_Me'); $s.Tab.Color = $navy
  Set-Title $s 'SmartCross SK Taman Melawati 2 Concept BoQ' 8
  $s.Range('A4:H5').Merge(); $s.Range('A4').Value2 = 'CONCEPT / BUDGETARY BOQ - NOT FOR TENDER OR CONSTRUCTION'
  $s.Range('A4:H5').Interior.Color = $lightRed; $s.Range('A4:H5').Font.Bold = $true; $s.Range('A4:H5').Font.Size = 14; $s.Range('A4:H5').HorizontalAlignment = $xlCenter; $s.Range('A4:H5').VerticalAlignment = $xlCenter
  $meta = @(
    @('Purpose','Conceptual cost and scope baseline for one real-world SmartCross pedestrian-crossing pilot.'),
    @('Provisional location','SK Taman Melawati 2, Ampang Jaya. Exact crossing and equipment positions are unverified.'),
    @('Prepared date',$PreparedDate.ToString('yyyy-MM-dd')),
    @('Workbook version','1.0 Concept'),
    @('Cost basis date',$PreparedDate.ToString('yyyy-MM-dd')),
    @('Currency','Malaysian Ringgit (MYR / RM)'),
    @('Scope boundary','The simulator is a functional reference only. This workbook does not certify field design, authority approval, or operational readiness.'),
    @('Price basis','No written vendor quotations were supplied. Rate cells are blank and highlighted until defensible quotations are entered.'),
    @('DRAG definition','No approved repository definition was found. Working definition: Define - Review - Assess - Govern.')
  )
  Write-Rows $s 7 1 $meta
  Set-Section $s 18 'Status definitions' 8
  Write-Row $s 19 1 @('Status','Meaning','Use')
  Set-Header $s 19 1 3
  Write-Rows $s 20 1 @(
    @('TBC','Value cannot be established from current evidence.','Do not treat as zero.'),
    @('Provisional','Preliminary quantity or scope pending validation.','Refine after survey/design.'),
    @('Allowance','Budget placeholder awaiting quotation or design.','Replace with measured/quoted item.'),
    @('Optional','Enhancement outside minimum safety scope.','Price separately.'),
    @('Confidence: Low/Medium/High','Strength of current evidence, not device accuracy.','Review before procurement.')
  )
  Set-Section $s 27 'Colour legend' 8
  Write-Rows $s 28 1 @(
    @('Amber','Input required or rate/quantity missing.'),
    @('Red','Safety-critical unresolved item or blocker.'),
    @('Blue','Calculated field or controlled workbook output.'),
    @('Green','Evidence-backed or closed item.')
  )
  $s.Range('A28:A31').Font.Bold = $true
  $s.Range('A28:B28').Interior.Color = $amber; $s.Range('A29:B29').Interior.Color = $lightRed; $s.Range('A30:B30').Interior.Color = $lightBlue; $s.Range('A31:B31').Interior.Color = $lightGreen
  $s.Columns.Item(1).ColumnWidth=28; $s.Columns.Item(2).ColumnWidth=105; $s.Range('A7:B15').WrapText=$true; $s.Rows.Item('7:15').RowHeight=34

  # Detailed BoQ data
  $boq = @(
    @('1.1','SC-001','Preliminaries','Project controls','Mobilisation, insurances and site establishment','Approved mobilisation plan; public and school safety controls','TBC','item',1,'Allowance','One pilot site','', '', '', '', '', 'Written quotation required','TBC','TBC','TBC','TBC','CAPEX','Provisional','Engineering assumption','Low','MPAJ permit and contract requirements','Authority access','Includes controlled mobilisation.'),
    @('1.2','SC-002','Survey','Site investigation','Topographic, utility, condition and accessibility survey','Survey all approaches, crossing desire lines, utilities, drainage, lighting and mounting constraints','TBC','item',1,'Required','One complete site survey','', '', '', '', '', 'Licensed survey quotation','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','Authority survey requirements','Before detailed design','Safety blocker until complete.'),
    @('1.3','SC-003','Traffic','Traffic study','Classified vehicle, speed, queue and pedestrian counts','School-day and non-school observations; peak and off-peak; both directions','TBC','study',1,'Required','One multi-period study','', '', '', '', '', 'Traffic consultant quotation','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','JKR/MPAJ method to be confirmed','Site access and school calendar','Defines timing and detector coverage.'),
    @('2.1','SC-004','Civil','Traffic management','Temporary traffic management during works','Approved plan, barriers, marshals, school coordination and reinstatement controls','TBC','day','','TBC','Duration depends on approved method','', '', '', '', '', 'Contractor quotation','TBC','TBC','TBC','TBC','CAPEX','Provisional','Engineering assumption','Low','MPAJ/JKR approval required','Construction programme','Quantity TBC.'),
    @('2.2','SC-005','Civil','Foundations','Pole and cabinet foundations','Engineered reinforced foundations based on geotechnical and structural design','TBC','no.','','TBC','Depends on final pole/cabinet schedule','', '', '', '', '', 'Civil contractor quotation','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','Approved civil/structural drawings','Survey and soil conditions','Do not size from simulator graphics.'),
    @('2.3','SC-006','Civil','Ducts and chambers','Underground duct route and draw pits','Sealed ducts, draw pits, warning tape and spare capacity','TBC','m','','TBC','Measured route after utility survey','', '', '', '', '', 'Civil contractor quotation','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','MPAJ utility coordination','Utility survey','Avoid unverified trench length.'),
    @('2.4','SC-007','Civil','Road markings','Zebra, stop lines and school-zone markings','Authority-approved thermoplastic marking system and layout','TBC','m2','','TBC','Measured from approved marking plan','', '', '', '', '', 'Road-marking contractor quote','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','JKR/MPAJ approval required','Road geometry','Re-marking extent TBC.'),
    @('2.5','SC-008','Civil','Accessibility','Kerb ramps, tactile paving and accessible waiting areas','Continuous accessible path; grades, drainage and tactile arrangement approved','TBC','item','','TBC','Based on accessibility audit and detailed design','', '', '', '', '', 'Civil contractor quotation','TBC','TBC','TBC','TBC','CAPEX','Required','Standards-derived','Low','Applicable Malaysian accessibility requirements TBC by authority','Accessibility audit','Safety-critical unresolved layout.'),
    @('2.6','SC-009','Civil','Signs','Regulatory, warning and school-zone signs','Authority-approved sign faces, supports and visibility','TBC','no.','','TBC','Sign schedule after road-safety review','', '', '', '', '', 'Sign contractor quotation','TBC','TBC','TBC','TBC','CAPEX','Provisional','Engineering assumption','Low','JKR/MPAJ approval required','Road-safety audit','Existing signs not surveyed.'),
    @('3.1','SC-010','Field equipment','Approach video','Roadside AI/CCTV cameras for eastbound and westbound approaches','Outdoor camera suitable for analytics; coverage and privacy masks field validated','TBC','no.',2,'Provisional','One primary approach camera per direction','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Required','Documented','Medium','MCMC/SIRIM approval as applicable; privacy approval','Poles, power, network','Simulator documents bilateral camera coverage; real coverage unverified.'),
    @('3.2','SC-011','Field equipment','Secondary video','Outgoing/context cameras','Outdoor contextual coverage; no enforcement use without approval','TBC','no.',2,'Provisional','One contextual camera per direction','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Provisional','Documented','Medium','Privacy and evidence policy approval','Poles, power, network','Repository describes incoming/outgoing views.'),
    @('3.3','SC-012','Field equipment','Speed/presence detection','Bidirectional vehicle radar','Measures speed and presence for each approach; accuracy and range field validated','TBC','no.',2,'Provisional','One radar per eastbound/westbound approach','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Required','Documented','Medium','Type approval and calibration requirements TBC','Mounting and power','40 m per approach is provisional.'),
    @('3.4','SC-013','Field equipment','Pedestrian detection','Pedestrian presence/demand sensors','Detect waiting and occupied crossing zones with adverse-condition testing','TBC','no.',2,'Provisional','One detection field per side, final technology TBC','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Required','Engineering assumption','Low','Accessibility and safety case approval','Site geometry','Coverage zones require survey.'),
    @('3.5','SC-014','Field equipment','Secondary safety sensor','LiDAR or independent secondary detector','Independent safety input for conflict/crossing clearance; diversity to be justified','TBC','no.',2,'Provisional','One per side/coverage sector pending hazard analysis','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Required','Documented','Medium','Safety integrity approach TBC','Hazard analysis','Repository fallback uses simulated LiDAR check.'),
    @('3.6','SC-015','Field equipment','Pedestrian demand','Accessible push buttons','Weatherproof accessible demand unit with feedback and latching logic','TBC','no.',2,'Provisional','One accessible unit per crossing side','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Required','Documented','Medium','Accessibility approval required','Controller I/O','Fallback cannot bypass safety interlocks.'),
    @('3.7','SC-016','Field equipment','Accessible indication','Audible and tactile pedestrian indicators','Configurable, authority-approved audible/tactile indication','TBC','no.',2,'Provisional','One unit per crossing side','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Required','Engineering assumption','Low','Accessibility and nuisance-noise approval','Pedestrian signals','Operating hours TBC.'),
    @('3.8','SC-017','Field equipment','Pedestrian signals','Pedestrian WAIT/WALK signal heads','High-visibility heads with countdown only if authority approved','TBC','no.',2,'Provisional','One head per side; final visibility review may add repeats','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Required','Documented','Medium','Approved traffic-signal specification','Controller and poles','Protected phase only.'),
    @('3.9','SC-018','Field equipment','Vehicle signals','Three-aspect vehicle signal heads','LED signal heads with conflict monitoring; repeats subject to sight-distance review','TBC','no.',2,'Provisional','One primary head per approach','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Required','Documented','Medium','Approved traffic-signal specification','Controller and poles','Final number depends on geometry.'),
    @('3.10','SC-019','Field equipment','Signal controller','Safety-rated traffic-signal controller and cabinet','Deterministic interlocks, conflict monitor, manual mode, local logs and secure maintenance','TBC','no.',1,'Provisional','One crossing controller','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Required','Engineering assumption','Low','MPAJ/JKR controller approval required','Approved signal design','AI must not authorise WALK.'),
    @('3.11','SC-020','Field equipment','Edge compute','Industrial edge AI processing unit','Local inference, health monitoring, secure boot and continued operation without WAN','TBC','no.',1,'Provisional','One local edge processor','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Required','Engineering assumption','Low','Cybersecurity and thermal design approval','Camera and network compatibility','Separate from safety controller.'),
    @('3.12','SC-021','Field equipment','ANPR','ANPR capture component','Evidence capture only after legal, privacy and operational approval','TBC','no.',2,'Optional','One per approach if approved','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Optional','Optional','Low','PDPA applicability and authority policy','Legal approval','Excluded from minimum safety operation.'),
    @('4.1','SC-022','Electrical','Utility supply','Utility connection and metering allowance','Dedicated approved low-voltage supply with capacity study','TBC','item',1,'Allowance','One crossing supply point, subject to TNB/authority confirmation','', '', '', '', '', 'Utility/contractor quote required','TBC','TBC','TBC','TBC','CAPEX','Provisional','Engineering assumption','Low','Electricity Supply Act 1990; Electricity Regulations 1994','Supply application','Point and capacity unverified.'),
    @('4.2','SC-023','Electrical','Distribution','Isolator, distribution board and protective devices','Outdoor-rated coordinated protection with labelled emergency isolation','TBC','no.',1,'Provisional','One local distribution assembly','', '', '', '', '', 'Electrical contractor quote','TBC','TBC','TBC',1,'CAPEX','Required','Standards-derived','Medium','Electricity Regulations 1994; MS IEC 60364 as applicable','Load schedule','Competent-person design/testing.'),
    @('4.3','SC-024','Electrical','Power cabling','Underground and internal power cabling','Outdoor/underground-rated cable sized by approved load and voltage-drop calculation','TBC','m','','TBC','Measured route after design','', '', '', '', '', 'Electrical contractor quote','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','Electricity Regulations 1994','Duct route and load schedule','Quantity TBC.'),
    @('4.4','SC-025','Electrical','Protection','Earthing, bonding, surge and lightning protection','Site-specific risk assessment and coordinated protection','TBC','item',1,'Provisional','One integrated protection system','', '', '', '', '', 'Electrical contractor quote','TBC','TBC','TBC',1,'CAPEX','Required','Standards-derived','Medium','Electricity Regulations 1994; applicable MS/IEC standards','Soil and supply data','Test certificates required.'),
    @('4.5','SC-026','Electrical','Backup power','Online UPS and batteries','Supports safety controller, signals, edge and comms for approved autonomy','TBC','set',1,'Provisional','One system; autonomy and load TBC','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Required','Engineering assumption','Low','Approved load and autonomy calculation','Load schedule','Minimum autonomy is a blocker.'),
    @('4.6','SC-027','Electrical','Alternative supply','Solar or alternative backup power','Separately engineered option; not assumed feasible','TBC','set',1,'Optional','One optional system if site study supports it','', '', '', '', '', 'Vendor quote required','TBC','TBC','TBC','TBC','CAPEX','Optional','Optional','Low','Authority and electrical approval','Solar/resource study','Separate price.'),
    @('5.1','SC-028','Network','Industrial LAN','Managed industrial Ethernet switch and accessories','VLANs, monitoring, hardened configuration and environmental rating','TBC','no.',1,'Provisional','One cabinet switch','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Required','Engineering assumption','Low','MPAJ ICT standards TBC','Port count and topology','No unmanaged safety network.'),
    @('5.2','SC-029','Network','WAN security','Industrial router/firewall with secure VPN','Mutual authentication, least privilege, logging and remote-access approval','TBC','no.',1,'Provisional','One secured edge gateway','', '', '', '', '', 'Vendor datasheet and quote required','TBC','TBC','TBC',1,'CAPEX','Required','Engineering assumption','Low','MCMC type approval; MPAJ ICT policy','Carrier coverage','WAN not required for immediate safety.'),
    @('5.3','SC-030','Network','Backhaul','Primary 4G/5G/fibre service setup','Technology selected after coverage and service survey','TBC','item',1,'Allowance','One primary service','', '', '', '', '', 'Carrier quote required','TBC','TBC','TBC','TBC','CAPEX','Provisional','Engineering assumption','Low','MCMC and MPAJ requirements','Coverage survey','Recurring plan separated.'),
    @('5.4','SC-031','Network','Connectivity','Annual primary data plan','Adequate secure data allowance and service monitoring','TBC','year',1,'Allowance','One annual service','', '', '', '', '', 'Carrier quote required','TBC','TBC','TBC','TBC','OPEX','Required','Engineering assumption','Low','MPAJ procurement and MCMC requirements','Selected carrier','Annual recurring cost.'),
    @('5.5','SC-032','Network','Redundant backhaul','Diverse secondary communications path','Different carrier/medium where practical','TBC','year',1,'Optional','One secondary annual service','', '', '', '', '', 'Carrier quote required','TBC','TBC','TBC','TBC','OPEX','Optional','Optional','Low','MPAJ ICT approval','Coverage and risk assessment','Local safe operation still required.'),
    @('6.1','SC-033','Software','Edge runtime','SmartCross field edge runtime engineering','Production field service, device adapters, health supervision and local store','TBC','person-day','','TBC','Effort after interface specifications','', '', '', '', '', 'Integrator quotation required','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','Approved software requirements','Vendor protocols','Simulator code is not field-ready runtime.'),
    @('6.2','SC-034','Software','Safety integration','Traffic-signal controller integration','Certified/deterministic interface; AI advisory separated from signal authority','TBC','person-day','','TBC','Effort after controller selection','', '', '', '', '', 'Integrator quotation required','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','Authority-approved signal design','Controller protocol','Safety-critical.'),
    @('6.3','SC-035','Software','Analytics','Vehicle/pedestrian analytics configuration','Validated detection zones, confidence rules and health monitoring','TBC','person-day','','TBC','Effort after device and site selection','', '', '', '', '', 'Integrator quotation required','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','Validation protocol TBC','Field data','No single AI input authorises WALK.'),
    @('6.4','SC-036','Software','Operations','Event logging and seven-stage timeline','Timestamped Approach through Outcome record with audit trail','TBC','person-day','','TBC','Effort after data and retention design','', '', '', '', '', 'Integrator quotation required','TBC','TBC','TBC','TBC','CAPEX','Required','Documented','Medium','MPAJ operational requirements TBC','Data architecture','Durable append-only storage required.'),
    @('6.5','SC-037','Software','Dashboard','MPAJ operator dashboard and integration','Role-based dashboard, alarms, health and human review workflow','TBC','person-day','','TBC','Effort after MPAJ interface definition','', '', '', '', '', 'Integrator quotation required','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','MPAJ ICT/API approval','MPAJ interface specification','Prototype login is not production IAM.'),
    @('6.6','SC-038','Software','Emergency priority','Emergency vehicle priority integration','Validated request, pedestrian protection, clearance, priority and controlled recovery','TBC','person-day','','TBC','Effort after authorised interface defined','', '', '', '', '', 'Integrator quotation required','TBC','TBC','TBC','TBC','CAPEX','Provisional','Documented','Low','Police/fire/hospital and road-authority approval','Authorised request source','No automatic dispatch.'),
    @('6.7','SC-039','Software','Reporting','Incident reports, exports and backup/restore','Controlled evidence export, retention and restoration test','TBC','person-day','','TBC','Effort after evidence policy','', '', '', '', '', 'Integrator quotation required','TBC','TBC','TBC','TBC','CAPEX','Required','Documented','Medium','Privacy and records policy','Data architecture','Reports must state evidence status.'),
    @('6.8','SC-040','Software','Licensing','Annual software support/licence allowance','Edge analytics, device management and dashboard support','TBC','year',1,'Allowance','One annual bundle, itemise after vendors selected','', '', '', '', '', 'Vendor quotations required','TBC','TBC','TBC','TBC','OPEX','Required','Engineering assumption','Low','Procurement terms TBC','Architecture selection','No hidden subscriptions.'),
    @('7.1','SC-041','Cybersecurity','Identity','Device identity, certificates and key lifecycle','Unique identities, protected keys, rotation and revocation','TBC','item',1,'Allowance','One site certificate/device identity implementation','', '', '', '', '', 'Integrator quotation required','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','MPAJ security policy TBC','Device inventory','Covers field devices and services.'),
    @('7.2','SC-042','Cybersecurity','Hardening','Network segmentation, RBAC and secure configuration','Least privilege, disabled defaults, secure remote maintenance and baselines','TBC','person-day','','TBC','Effort after architecture selection','', '', '', '', '', 'Cybersecurity quotation required','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','MPAJ security policy TBC','Final architecture','Includes configuration records.'),
    @('7.3','SC-043','Cybersecurity','Assurance','Vulnerability assessment and penetration test','Independent scoped assessment before go-live and after material change','TBC','test',1,'Allowance','One pre-go-live assessment','', '', '', '', '', 'Independent tester quote required','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','MPAJ security acceptance criteria TBC','Stable build','Closure evidence required.'),
    @('7.4','SC-044','Privacy','Privacy assessment','Privacy impact, minimisation, masking and retention configuration','Document lawful purpose, access, retention, masking and disclosure controls','TBC','item',1,'Allowance','One pilot privacy assessment and configuration','', '', '', '', '', 'Privacy/legal quotation required','TBC','TBC','TBC','TBC','CAPEX','Required','Standards-derived','Medium','PDPA 2010 applicability and Amendment Act 2024; authority policy','Data flow and legal review','Public-authority applicability must be legally confirmed.'),
    @('7.5','SC-045','Cybersecurity','Monitoring','Annual cybersecurity monitoring and patch support','Alerting, log review, vulnerability/patch cycle and incident support','TBC','year',1,'Allowance','One annual managed service','', '', '', '', '', 'Service quotation required','TBC','TBC','TBC','TBC','OPEX','Required','Engineering assumption','Low','MPAJ security policy TBC','Support model','Annual recurring cost.'),
    @('8.1','SC-046','Testing','FAT','Factory acceptance test','Controller, devices, software, fail-safe logic and evidence witnessed off site','TBC','test',1,'Allowance','One integrated FAT campaign','', '', '', '', '', 'Integrator quotation required','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','Approved FAT plan','Completed build','Includes defect closure.'),
    @('8.2','SC-047','Testing','Calibration','Sensor coverage and speed validation','Field coverage, occlusion, speed accuracy, pedestrian detection and adverse conditions','TBC','test',1,'Allowance','One initial calibration/validation campaign','', '', '', '', '', 'Independent/test quotation required','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','Approved test method','Installed devices and traffic controls','Includes false-positive/negative evidence.'),
    @('8.3','SC-048','Testing','SAT/UAT','Site acceptance and user acceptance','Normal, school, congestion, emergency, degraded, critical and manual modes','TBC','test',1,'Allowance','One SAT/UAT campaign','', '', '', '', '', 'Integrator quotation required','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','Approved SAT/UAT plans','FAT closure','STOP-before-WALK witnessed.'),
    @('8.4','SC-049','Testing','Electrical certification','Electrical inspection, testing and certification','Competent-person test, certificates and defects closure','TBC','item',1,'Allowance','One complete installation certification','', '', '', '', '', 'Electrical contractor quote','TBC','TBC','TBC','TBC','CAPEX','Required','Standards-derived','Medium','Electricity Regulations 1994','Completed electrical works','Forms and records TBC by competent person.'),
    @('8.5','SC-050','Testing','Safety assurance','Independent road and functional safety review','Independent review of layout, timings, interlocks, degraded modes and residual risk','TBC','review',1,'Allowance','One independent review with closure cycle','', '', '', '', '', 'Independent reviewer quote','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','Authority safety acceptance criteria TBC','Design and test evidence','Go-live blocker.'),
    @('8.6','SC-051','Testing','Soak trial','Controlled operational soak and monitoring','Defined duration, supervised operation, incident review and rollback criteria','TBC','day','','TBC','Duration set by authority and safety plan','', '', '', '', '', 'Integrator/operator quote','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','Controlled trial approval','SAT/UAT and safety approval','No unsupervised go-live.'),
    @('9.1','SC-052','Handover','Training','Operator, maintainer and administrator training','Role-specific training with competency records and emergency procedures','TBC','session',3,'Provisional','One session for each role','', '', '', '', '', 'Integrator quotation required','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Medium','MPAJ training acceptance','Approved procedures','Attendance and assessment evidence.'),
    @('9.2','SC-053','Handover','Documentation','Operating, maintenance, as-built and configuration records','Controlled manuals, drawings, asset/warranty registers and recovery procedures','TBC','set',1,'Provisional','One controlled handover set','', '', '', '', '', 'Integrator quotation required','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Medium','MPAJ document control','Final installation','Electronic and approved hardcopy requirements TBC.'),
    @('9.3','SC-054','Spares','Critical spares','Initial critical spare holding','Failure/lead-time based spare list for sensors, signals, PSU and network items','TBC','set',1,'Allowance','One site/central spare set after vendor selection','', '', '', '', '', 'Vendor quotations required','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','Asset management policy TBC','Final equipment schedule','Percentages not assumed.'),
    @('10.1','SC-055','Maintenance','Preventive maintenance','Annual preventive maintenance, cleaning and calibration','Planned visits, health checks, cleaning, calibration and records','TBC','year',1,'Allowance','One annual service','', '', '', '', '', 'Service quotation required','TBC','TBC','TBC','TBC','OPEX','Required','Engineering assumption','Low','Approved maintenance plan','Installed equipment','Frequency to follow vendor and risk needs.'),
    @('10.2','SC-056','Maintenance','Annual testing','Annual safety, electrical and fail-safe verification','Repeat critical acceptance checks and close findings','TBC','year',1,'Allowance','One annual verification cycle','', '', '', '', '', 'Independent/service quote','TBC','TBC','TBC','TBC','OPEX','Required','Engineering assumption','Low','Authority operating approval','Approved test plan','Recurring cost.'),
    @('10.3','SC-057','Maintenance','Hardware lifecycle','Annual hardware replacement reserve','Evidence-based reserve after vendor service-life and failure data','TBC','year',1,'Allowance','One annual reserve, value TBC','', '', '', '', '', 'Vendor/service data required','TBC','TBC','TBC','TBC','OPEX','Required','Engineering assumption','Low','Asset management policy TBC','Vendor life data','Not priced without evidence.'),
    @('10.4','SC-058','Maintenance','Battery replacement','Planned battery replacement','Replacement at validated service interval and capacity test threshold','TBC','event',1,'Allowance','One event within five years if vendor data requires','', '', '', '', '', 'Vendor/service quote required','TBC','TBC','TBC','TBC','OPEX','Required','Engineering assumption','Low','Electrical maintenance requirements','UPS selection','Timing TBC.'),
    @('11.1','SC-059','Authority','Permits','Permit and authority inspection allowances','Road opening, traffic management, utilities, signal and inspection submissions','TBC','item',1,'Allowance','One coordinated approvals package','', '', '', '', '', 'Authority fee schedules/quotes required','TBC','TBC','TBC','TBC','CAPEX','Provisional','Engineering assumption','Low','MPAJ/JKR/TNB/MCMC as applicable','Confirmed jurisdiction','Fees not invented.'),
    @('11.2','SC-060','Project management','Governance','Design management, coordination and change control','Traceability, reviews, risk control, approvals and evidence configuration','TBC','person-day','','TBC','Effort after programme and procurement packaging','', '', '', '', '', 'Professional services quote','TBC','TBC','TBC','TBC','CAPEX','Required','Engineering assumption','Low','Contract governance requirements','Programme','Includes OODA/DRAG review cycles.')
  )

  # 04 Detailed BoQ
  $s = $wb.Worksheets.Item('04_Detailed_BoQ'); $s.Tab.Color=$blue
  Set-Title $s 'Detailed Bill of Quantities' 31
  $s.Range('A3:AE3').Merge(); $s.Range('A3').Value2='Enter only defensible quantities and written rates. Blank rate cells intentionally keep amounts unavailable.'; $s.Range('A3:AE3').Interior.Color=$amber; $s.Range('A3:AE3').Font.Bold=$true
  $headers=@('WBS code','BoQ item no.','Discipline','System/package','Item description','Minimum functional specification','Proposed make/model','Unit','Quantity','Quantity status','Quantity basis/calculation','Supply unit rate (MYR)','Installation unit rate (MYR)','Integration/configuration unit rate (MYR)','Total unit rate','Extended amount','Vendor/source','Lead time','Warranty','Expected service life','Critical spare % or qty','CAPEX/OPEX','Scope status','Evidence classification','Confidence level','Standard/specification reference','Dependency','Remarks','Low budget','Expected budget','High budget')
  Write-Row $s 4 1 $headers; Set-Header $s 4 1 31
  Write-Rows $s 5 1 $boq
  $lastBoqRow = 4 + $boq.Count
  for ($r=5; $r -le $lastBoqRow; $r++) {
    $s.Cells.Item($r,15).Formula = "=IF(COUNT(L$r:N$r)=0,`"`",SUM(L$r:N$r))"
    $s.Cells.Item($r,16).Formula = "=IF(OR(I$r=`"`",O$r=`"`"),`"`",I$r*O$r)"
    $s.Cells.Item($r,29).Formula = "=IF(P$r=`"`",`"`",P$r*0.85)"
    $s.Cells.Item($r,30).Formula = "=IF(P$r=`"`",`"`",P$r)"
    $s.Cells.Item($r,31).Formula = "=IF(P$r=`"`",`"`",P$r*1.25)"
  }
  $currencyRange=$s.Range("L5:P$lastBoqRow"); $currencyRange.NumberFormat='"RM" #,##0'
  $s.Range("AC5:AE$lastBoqRow").NumberFormat='"RM" #,##0'
  $s.Range("L5:N$lastBoqRow").Interior.Color=$amber
  Add-ListValidation $s.Range("J5:J$lastBoqRow") 'TBC,Provisional,Allowance,Optional,Required,Site-verified'
  Add-ListValidation $s.Range("V5:V$lastBoqRow") 'CAPEX,OPEX'
  Add-ListValidation $s.Range("W5:W$lastBoqRow") 'Required,Optional,Provisional,Excluded'
  Add-ListValidation $s.Range("X5:X$lastBoqRow") 'Observed,Documented,Site-verified,Standards-derived,Engineering assumption,Optional,Excluded'
  Add-ListValidation $s.Range("Y5:Y$lastBoqRow") 'Low,Medium,High'
  $s.Range("I5:I$lastBoqRow").FormatConditions.Add($xlExpression, [Type]::Missing, '=AND($W5<>"Optional",$I5="")') | Out-Null
  $s.Range("I5:I$lastBoqRow").FormatConditions.Item(1).Interior.Color=$lightRed
  $s.Range("L5:N$lastBoqRow").FormatConditions.Add($xlExpression, [Type]::Missing, '=AND($W5<>"Optional",COUNT($L5:$N5)=0)') | Out-Null
  $s.Range("L5:N$lastBoqRow").FormatConditions.Item(1).Interior.Color=$amber
  $s.Range("B5:B$lastBoqRow").FormatConditions.Add($xlExpression, [Type]::Missing, '=COUNTIF($B$5:$B$64,$B5)>1') | Out-Null
  $s.Range("B5:B$lastBoqRow").FormatConditions.Item(1).Interior.Color=$lightRed
  Finish-TableSheet $s 4 $lastBoqRow 31 @(10,12,16,20,34,48,18,10,10,14,34,15,15,18,15,16,24,12,12,15,14,12,14,18,12,26,24,35,15,15,15)
  $s.Rows.Item("5:$lastBoqRow").RowHeight=62

  # 01 Executive Summary
  $s=$wb.Worksheets.Item('01_Executive_Summary'); $s.Tab.Color=$navy
  Set-Title $s 'Executive Summary' 12
  $s.Range('A3:H3').Merge(); $s.Range('A3').Value2='CONCEPT / BUDGETARY BOQ - NOT FOR TENDER OR CONSTRUCTION'; $s.Range('A3:H3').Interior.Color=$lightRed; $s.Range('A3:H3').Font.Bold=$true; $s.Range('A3:H3').HorizontalAlignment=$xlCenter
  Write-Row $s 5 1 @('Cost measure','Expected (MYR)','Status','Basis') ; Set-Header $s 5 1 4
  $summaryRows=@(
    @('Base capital cost','','','Required CAPEX items with completed quantities and rates'),
    @('Provisional sums','','','Provisional CAPEX items'),
    @('Optional enhancements','','','Optional CAPEX items'),
    @('Risk contingency','','','Risk-specific allowances only; no flat percentage'),
    @('SST / tax','','','Editable rate applies only when confirmed'),
    @('Estimated implementation total','','','Base + provisional + contingency + tax; optional excluded'),
    @('Annual operating and maintenance cost','','','Year 1 OPEX with entered rates'),
    @('Five-year TCO - undiscounted','','','Implementation + escalated recurring costs'),
    @('Five-year TCO - discounted','','','Implementation + discounted recurring costs')
  ); Write-Rows $s 6 1 $summaryRows
  $s.Range('F5:G5').Merge(); $s.Range('F5').Value2='Editable financial assumptions'; Set-Header $s 5 6 7
  Write-Rows $s 6 6 @(@('SST / tax rate',0),@('OPEX escalation',0.03),@('Discount rate',0.04),@('Cost input completion',''))
  $s.Range('G6:G8').Interior.Color=$amber; $s.Range('G6:G8').NumberFormat='0.0%'
  $s.Range('G9').Formula="=COUNT('04_Detailed_BoQ'!L5:N$lastBoqRow)/(ROWS('04_Detailed_BoQ'!L5:N$lastBoqRow)*3)"; $s.Range('G9').NumberFormat='0.0%'
  $s.Range('B6').Formula="=IF(COUNT('04_Detailed_BoQ'!P5:P$lastBoqRow)=0,`"`",SUMIFS('04_Detailed_BoQ'!P5:P$lastBoqRow,'04_Detailed_BoQ'!V5:V$lastBoqRow,`"CAPEX`",'04_Detailed_BoQ'!W5:W$lastBoqRow,`"Required`"))"
  $s.Range('B7').Formula="=IF(COUNT('04_Detailed_BoQ'!P5:P$lastBoqRow)=0,`"`",SUMIFS('04_Detailed_BoQ'!P5:P$lastBoqRow,'04_Detailed_BoQ'!V5:V$lastBoqRow,`"CAPEX`",'04_Detailed_BoQ'!W5:W$lastBoqRow,`"Provisional`"))"
  $s.Range('B8').Formula="=IF(COUNT('04_Detailed_BoQ'!P5:P$lastBoqRow)=0,`"`",SUMIFS('04_Detailed_BoQ'!P5:P$lastBoqRow,'04_Detailed_BoQ'!V5:V$lastBoqRow,`"CAPEX`",'04_Detailed_BoQ'!W5:W$lastBoqRow,`"Optional`"))"
  $s.Range('B9').Formula="=IF(COUNT('15_Risk_Contingency'!K5:K14)=0,`"`",SUM('15_Risk_Contingency'!K5:K14))"
  $s.Range('B10').Formula='=IF(SUM(B6:B9)=0,"",SUM(B6:B7,B9)*G6)'
  $s.Range('B11').Formula='=IF(COUNT(B6:B10)=0,"",SUM(B6:B7,B9:B10))'
  $s.Range('B12').Formula="=IF(COUNT('13_OPEX_5Year_TCO'!C6:C15)=0,`"`",SUM('13_OPEX_5Year_TCO'!C6:C15))"
  $s.Range('B13').Formula="='13_OPEX_5Year_TCO'!H19"
  $s.Range('B14').Formula="='13_OPEX_5Year_TCO'!I19"
  for($r=6;$r -le 14;$r++){ $s.Cells.Item($r,3).Formula=('=IF(B{0}="","TBC - rates missing","Calculated")' -f $r) }
  $s.Range('B6:B14').NumberFormat='"RM" #,##0'; $s.Range('A6:D14').RowHeight=28
  Set-Section $s 17 'Management view' 12
  Write-Row $s 18 1 @('Cost class','Amount (MYR)'); Set-Header $s 18 1 2
  Write-Rows $s 19 1 @(@('Base CAPEX',''),@('Provisional CAPEX',''),@('Optional CAPEX',''),@('Contingency',''),@('O&M',''))
  $s.Range('B19').Formula='=IF(B6="",0,B6)'; $s.Range('B20').Formula='=IF(B7="",0,B7)'; $s.Range('B21').Formula='=IF(B8="",0,B8)'; $s.Range('B22').Formula='=IF(B9="",0,B9)'; $s.Range('B23').Formula='=IF(B12="",0,B12)'; $s.Range('B19:B23').NumberFormat='"RM" #,##0'
  $chart=$s.ChartObjects().Add(220,320,400,260); $chart.Chart.ChartType=$xlColumnClustered; $chart.Chart.SetSourceData($s.Range('A18:B23')); $chart.Chart.HasTitle=$true; $chart.Chart.ChartTitle.Text='Cost by class (RM)'; $chart.Chart.HasLegend=$false
  try { $chart.Chart.Axes(2).MinimumScale=0; $chart.Chart.Axes(2).MaximumScale=100000; $chart.Chart.Axes(2).MajorUnit=25000; $chart.Chart.Axes(2).TickLabels.NumberFormat='"RM" #,##0' } catch {}
  Set-Section $s 26 'Major uncertainty drivers' 12
  Write-Rows $s 27 1 @(@('1','Site geometry, utilities, drainage and pole positions are unverified.'),@('2','Authority signal layout, timing, accessibility and civil requirements are not approved.'),@('3','Vendor makes, protocols, warranties, lead times and written quotations are absent.'),@('4','Power supply point, load, battery autonomy and communications coverage are unknown.'),@('5','Legal basis, retention and external integrations for identifiable evidence are unresolved.'))
  $s.Columns.Item(1).ColumnWidth=32; $s.Columns.Item(2).ColumnWidth=20; $s.Columns.Item(3).ColumnWidth=22; $s.Columns.Item(4).ColumnWidth=54; $s.Columns.Item(6).ColumnWidth=24; $s.Columns.Item(7).ColumnWidth=16

  # 02 Function to BoQ
  $functionRows=@(
    @('Normal and school crossing modes','README; repository','Signal controller, signals, detectors','Mode configuration and approved timing plans','Site-specific approved design','Safety-critical','SC-013 to SC-020; SC-034','Required'),
    @('Eastbound and westbound monitoring','README; progress tracker','Two approach radars and bilateral cameras','Directional tracking and health supervision','Surveyed coverage and mounting','Safety-supporting','SC-010 to SC-014','Required'),
    @('Pedestrian demand and protected crossing','README; camera-fallback.ts','Pedestrian sensors, push buttons, WAIT/WALK heads','Demand latch and deterministic safety interlocks','Clearance calculation and accessibility approval','Safety-critical','SC-013 to SC-019; SC-034','Required'),
    @('Vehicle speed and approximate 40 m zones','README; progress tracker','Two calibrated radars','Speed/presence processing and audit','Field accuracy and sight-distance validation','Safety-supporting','SC-012; SC-047','Provisional'),
    @('Peak congestion and queue management','architecture; heavy-traffic.ts','Presence/speed detection and controller I/O','Adaptive plan, queue logic and audit','Traffic study and approved timing constraints','Safety-critical','SC-012; SC-034; SC-035','Required'),
    @('Emergency vehicle priority','emergency-priority.ts; types.ts','Detection/request interface and signals','Validation, clearance, priority and recovery','Authorised request source and agency procedures','Safety-critical','SC-019; SC-034; SC-038','Provisional'),
    @('Violation and crossing obstruction detection','simulation.ts; motion.ts','Video/radar/secondary sensing','Analytics, review workflow and evidence logs','Field validation and legal policy','Safety-supporting','SC-010 to SC-014; SC-035','Required'),
    @('ANPR evidence','simulation.ts; governance document','Optional ANPR cameras','Capture, masking, retention and human review','Explicit legal and operational approval','Privacy-sensitive','SC-021; SC-044','Optional'),
    @('Seven-stage event timeline','types.ts; README','Edge storage and operator workstation','Approach through Outcome log','Durable append-only design','Operationally critical','SC-036; SC-039','Required'),
    @('Normal, degraded, critical and manual modes','camera-fallback.ts; safety docs','Controller, local HMI, push buttons and secondary sensors','Mode supervision, safe hold and recovery','Hazard analysis and acceptance tests','Safety-critical','SC-014 to SC-020; SC-048','Required'),
    @('WAN-independent safe operation','README; architecture','Local controller, edge compute and UPS','Local runtime, store and health supervision','Load/autonomy calculation','Safety-critical','SC-019; SC-020; SC-026','Required'),
    @('MPAJ dashboard and notifications','README; governance document','Operator terminal and secure gateway','RBAC dashboard and approved interfaces','MPAJ specifications and human confirmation','Operationally critical','SC-029; SC-037','Provisional'),
    @('Automatic enforcement or dispatch','Repository boundary','None in minimum scope','Not implemented','Separate legal, authority and operational approval','Excluded','Explained exclusion','Excluded')
  )
  Add-SimpleTableSheet $wb.Worksheets.Item('02_Function_to_BoQ') 'Function-to-BoQ Traceability' @('SmartCross function','Evidence source','Required physical component','Software/integration component','Dependency','Safety criticality','BoQ reference','Inclusion status') $functionRows @(32,34,38,42,38,18,28,16)

  # 03 Design Basis
  $designRows=@(
    @('Pilot location','SK Taman Melawati 2, Ampang Jaya','Engineering assumption','Low','MPAJ / school / road authority','Confirm exact legal road reserve and crossing point'),
    @('Crossing form','Straight two-way road with one pedestrian crossing, based on SmartCross 2.2 reference','Documented','Medium','Lead traffic engineer','Do not infer site geometry from simulator'),
    @('Approaches','Eastbound and westbound: 2','Documented','Medium','Lead traffic engineer','Confirm traffic movements and lane count by survey'),
    @('Detection distance','Approximately 40 m per approach','Documented','Low','Traffic engineer / vendor','Validate sight distance, speed and sensor performance'),
    @('Operating modes','Normal, school, degraded, critical/safety and manual','Documented','Medium','MPAJ operations / safety assessor','Approve state transitions and authorities'),
    @('Pedestrian phase','STOP before WALK; route clear before WALK; no throughput override','Documented','High','Traffic-signal designer','Calculate site-specific timings'),
    @('Power architecture','Utility LV supply, protected distribution and UPS','Engineering assumption','Low','Electrical engineer / TNB','Confirm supply point, capacity and autonomy'),
    @('Communications','Local industrial LAN and secure approved backhaul','Engineering assumption','Low','MPAJ ICT / carrier','Coverage and fibre availability survey'),
    @('Edge/cloud boundary','Immediate safety decisions remain local; WAN/cloud non-essential to safe state','Documented','High','Safety assessor / MPAJ ICT','Independent verification required'),
    @('Retention/privacy','Minimum necessary data, access control, masking and approved retention','Standards-derived','Low','MPAJ legal / DPO-equivalent role','Legal applicability and schedule unresolved'),
    @('Availability','No uncontrolled crossing after camera, sensor, network or AI failure','Documented','High','Independent safety assessor','Hazard analysis and FMEA required'),
    @('Redundancy','Diverse safety inputs, local UPS and manual safe-hold capability','Engineering assumption','Low','Safety assessor','Validate independence and common-cause risks'),
    @('ANPR','Optional and disabled unless explicitly approved','Documented','High','MPAJ legal / enforcement liaison','Not required for crossing safety')
  )
  Add-SimpleTableSheet $wb.Worksheets.Item('03_Design_Basis') 'Design Basis and Controlled Assumptions' @('Design aspect','Current basis','Evidence classification','Confidence','Approval owner','Action / limitation') $designRows @(24,58,22,12,28,54)

  # Package sheets
  $civilRows=@(
    @('SC-004','Traffic management during installation','day','TBC','Approved work-zone plan and programme','Provisional','MPAJ / road authority'),@('SC-001','Site establishment','item',1,'One controlled pilot worksite','Allowance','Project manager'),@('SC-002','Survey and setting out','item',1,'Topographic, utility and condition survey','Required','Licensed surveyor'),@('SC-005','Foundations','no.','TBC','Final pole/cabinet schedule and structural design','TBC','Civil/structural engineer'),@('SC-006','Trenches, ducts and chambers','m','TBC','Measured approved route','TBC','Civil engineer'),@('SC-007','Road markings and zebra treatment','m2','TBC','Approved marking plan','TBC','Traffic engineer'),@('SC-008','Tactile paving, ramps and accessibility','item','TBC','Accessibility audit and detailed design','TBC','Accessibility reviewer'),@('SC-009','Signs and school-zone treatment','no.','TBC','Approved sign schedule','TBC','Road authority'),@('SC-059','Permits and inspection allowances','item',1,'One coordinated approval package','Allowance','Project manager'))
  Add-SimpleTableSheet $wb.Worksheets.Item('05_Civil_and_Roadworks') 'Civil and Roadworks Schedule' @('BoQ ref','Item','Unit','Qty','Quantity basis','Status','Validation owner') $civilRows @(14,42,10,10,48,16,26)
  $fieldRows=@(
    @('SC-010','Approach AI/CCTV cameras','no.',2,'One per approach','Provisional','Coverage and privacy validation'),@('SC-011','Context cameras','no.',2,'One per direction','Provisional','Field of view and evidence policy'),@('SC-012','Speed/presence radar','no.',2,'One per approach','Provisional','Accuracy and range validation'),@('SC-013','Pedestrian sensors','no.',2,'One per crossing side','Provisional','Waiting/occupancy zone testing'),@('SC-014','LiDAR/secondary safety sensors','no.',2,'Diverse input per side','Provisional','Hazard analysis'),@('SC-015','Accessible push buttons','no.',2,'One per side','Provisional','Reach, feedback and latching tests'),@('SC-016','Audible/tactile indicators','no.',2,'One per side','Provisional','Accessibility/noise approval'),@('SC-017','Pedestrian signal heads','no.',2,'One per side','Provisional','Visibility review'),@('SC-018','Vehicle signal heads','no.',2,'One per approach','Provisional','Sight-distance review'),@('SC-019','Traffic-signal controller','no.',1,'One crossing controller','Provisional','Authority acceptance'),@('SC-020','Industrial edge AI unit','no.',1,'One site processor','Provisional','Thermal/capacity/security design'),@('SC-021','ANPR components','no.',2,'One per approach if approved','Optional','Legal and operational approval'),@('SC-054','Critical spares set','set',1,'Lead-time/failure-based schedule','Allowance','Vendor data'))
  Add-SimpleTableSheet $wb.Worksheets.Item('06_Field_Equipment') 'Field Equipment Schedule' @('BoQ ref','Equipment','Unit','Qty','Quantity basis','Status','Required validation') $fieldRows @(14,42,10,10,42,16,44)
  $powerRows=@(
    @('SC-022','Utility connection / metering','item',1,'Provisional','Confirm point and capacity'),@('SC-023','Isolator, DB and protection','no.',1,'Provisional','Approved load/protection study'),@('SC-024','Power cabling','m','TBC','TBC','Measure route and size cable'),@('SC-025','Earthing, bonding, surge and lightning protection','item',1,'Provisional','Risk assessment and earth test'),@('SC-026','UPS and batteries','set',1,'Provisional','Approved autonomy/load calculation'),@('SC-027','Solar / alternative backup','set',1,'Optional','Site feasibility study'),@('SC-049','Electrical testing and certification','item',1,'Allowance','Competent-person certification'))
  Add-SimpleTableSheet $wb.Worksheets.Item('07_Power_and_Electrical') 'Power and Electrical Schedule' @('BoQ ref','Item','Unit','Qty','Status','Design / validation requirement') $powerRows @(14,48,10,10,16,58)
  $networkRows=@(
    @('SC-028','Industrial managed switch and accessories','no.',1,'CAPEX','Provisional','Final port count/topology'),@('SC-029','Router/firewall and secure VPN','no.',1,'CAPEX','Provisional','MPAJ ICT and type approval'),@('SC-030','Primary fibre / 4G / 5G setup','item',1,'CAPEX','Allowance','Coverage/service survey'),@('SC-031','Primary SIM/data plan','year',1,'OPEX','Allowance','Carrier quotation'),@('SC-032','Diverse secondary communications','year',1,'OPEX','Optional','Risk and coverage assessment'),@('SC-041','Device certificates and identity','item',1,'CAPEX','Allowance','Certificate lifecycle design'))
  Add-SimpleTableSheet $wb.Worksheets.Item('08_Network_and_Comms') 'Network and Communications Schedule' @('BoQ ref','Item','Unit','Qty','Class','Status','Basis / requirement') $networkRows @(14,46,10,10,12,16,52)
  $softwareRows=@(
    @('SC-033','SmartCross edge runtime','Production field service; device health; local store','Required','Simulator is functional reference only'),@('SC-034','Signal-controller integration','Deterministic, authority-approved interface','Required','AI remains outside WALK authority'),@('SC-035','AI analytics configuration','Site-trained/validated zones and health rules','Required','No accuracy assumed'),@('SC-036','Seven-stage event timeline','Durable timestamped Approach-to-Outcome record','Required','Append-only audit needed'),@('SC-037','Operator dashboard / MPAJ integration','RBAC, alarms, review and health','Required','MPAJ API/IAM not supplied'),@('SC-038','Emergency priority','Validated request, clearance, priority and recovery','Provisional','Agency workflow approval required'),@('SC-039','Reports, APIs, storage and backup','Controlled export and restoration test','Required','Retention and integration inputs TBC'),@('SC-040','Annual software licences/support','Itemised after product selection','Required','No hidden subscription allowance'),@('SC-021','ANPR integration','Legally approved evidence workflow only','Optional','Human review before any conclusion'))
  Add-SimpleTableSheet $wb.Worksheets.Item('09_Software_Integration') 'Software and Integration Schedule' @('BoQ ref','Component','Minimum outcome','Status','Boundary / dependency') $softwareRows @(14,36,58,16,58)
  $cyberRows=@(
    @('SC-041','Device identity and certificates','Unique identity, protected keys, rotation and revocation','Required','Architecture and PKI owner TBC'),@('SC-029','Encryption and VPN','Approved encrypted management and data channels','Required','MPAJ ICT requirements TBC'),@('SC-042','Segmentation, RBAC and hardening','Least privilege; secure defaults; controlled maintenance','Required','Final architecture required'),@('SC-036','Audit logging','Time-synchronised, tamper-evident and retained','Required','Durable storage unresolved'),@('SC-043','Vulnerability assessment and penetration testing','Independent assessment with closure evidence','Required','Stable build required'),@('SC-045','Patch and monitoring service','Documented lifecycle, alerting and incident support','Required','Annual recurring service'),@('SC-044','Privacy impact assessment','Purpose, minimisation, masking, access and retention','Required','Legal applicability must be confirmed'),@('SC-021','ANPR/identifiable evidence controls','Disabled unless explicitly approved','Optional','Separate legal/operational gate'))
  Add-SimpleTableSheet $wb.Worksheets.Item('10_Cybersecurity_Privacy') 'Cybersecurity and Privacy Schedule' @('BoQ ref','Control area','Minimum outcome','Status','Unresolved dependency') $cyberRows @(14,36,64,16,54)
  $testRows=@(
    @('TC-01','Factory acceptance test','Integrated controller/device/software bench','FAT report and defects closure','Required','Simpson 3'),@('TC-02','Sensor coverage and calibration','Both approaches; pedestrian zones; adverse conditions','Coverage/calibration records','Required','Simpson 4'),@('TC-03','Speed measurement validation','Compare against approved reference method','Accuracy evidence','Required','Simpson 4'),@('TC-04','Pedestrian detection performance','Representative users, aids, occlusion and weather','False-positive/negative evidence','Required','Simpson 5'),@('TC-05','Signal interlock and clearance','STOP before WALK; all-red; route clear','Witnessed timing/interlock record','Required','Simpson 5'),@('TC-06','Congestion management','Demand retained; clearance never shortened','Scenario evidence','Required','Simpson 5'),@('TC-07','Emergency priority','No conflicting pedestrian movement','Witnessed sequence','Required','Simpson 5'),@('TC-08','Mode tests','Normal, degraded, critical/safety and manual','Mode transition evidence','Required','Simpson 5'),@('TC-09','Power failure and recovery','UPS autonomy; safe shutdown/restart','Autonomy and recovery record','Required','Simpson 5'),@('TC-10','Communications failure','Local safe operation without WAN','Loss/recovery record','Required','Simpson 5'),@('TC-11','Cybersecurity closure','VA/PT findings resolved or accepted','Closure report','Required','Simpson 5'),@('TC-12','Accessibility testing','Push buttons, indications, route and timings','Accessibility acceptance','Required','Simpson 5'),@('TC-13','Soak test','Controlled live trial under supervision','Operational evidence','Required','Simpson 6'),@('TC-14','SAT/UAT and independent safety review','Authority/operator/safety acceptance','Signed records','Required','Simpson 6'),@('TC-15','Closure verification and go-live gate','All blockers closed with objective evidence','Approval record','Required','Simpson 7'))
  Add-SimpleTableSheet $wb.Worksheets.Item('11_Test_Commission') 'Testing and Commissioning Schedule' @('Test ID','Test','Scope','Evidence','Status','Simpson stage') $testRows @(12,38,60,42,14,16)
  $handoverRows=@(
    @('SC-052','Operator training','session',1,'Role procedures, alarms, manual safe hold and escalation','Attendance and competency record'),@('SC-052','Maintainer training','session',1,'Inspection, cleaning, calibration, isolation and restoration','Attendance and competency record'),@('SC-052','Administrator training','session',1,'Identity, logs, backups, patches and change control','Attendance and competency record'),@('SC-053','Operating manuals','set',1,'Approved operating and emergency procedures','Controlled document'),@('SC-053','Maintenance manuals','set',1,'Schedules, diagnostics, calibration and parts','Controlled document'),@('SC-053','As-built drawings and configuration','set',1,'Installed routes, addressing, settings and hashes','Approved as-built set'),@('SC-053','Asset and warranty registers','set',1,'Serials, dates, owners and service contacts','Accepted register'),@('SC-054','Tools, consumables and critical spares','set',1,'Vendor/risk-based schedule','Handover inventory'))
  Add-SimpleTableSheet $wb.Worksheets.Item('12_Training_Doc_Spares') 'Training, Documentation and Spares' @('BoQ ref','Deliverable','Unit','Qty','Minimum content','Acceptance evidence') $handoverRows @(14,42,10,10,58,42)

  # 13 OPEX and TCO
  $s=$wb.Worksheets.Item('13_OPEX_5Year_TCO'); Set-Title $s 'OPEX and Five-Year Total Cost of Ownership' 10
  Write-Row $s 4 1 @('Recurring item','BoQ ref','Year 1','Year 2','Year 3','Year 4','Year 5','5-year undiscounted','5-year discounted','Basis'); Set-Header $s 4 1 10
  $opexItems=@(@('Connectivity','SC-031'),@('Redundant communications','SC-032'),@('Software licences/support','SC-040'),@('Cybersecurity monitoring','SC-045'),@('Preventive maintenance/calibration/cleaning','SC-055'),@('Annual testing','SC-056'),@('Hardware replacement reserve','SC-057'),@('Battery replacement','SC-058'),@('Other approved recurring cost','TBC'),@('Operational support allowance','TBC'))
  for($i=0;$i -lt $opexItems.Count;$i++){
    $r=5+$i; Write-Row $s $r 1 @($opexItems[$i][0],$opexItems[$i][1],'','','','','','','','Rates sourced from Detailed BoQ; blanks remain unavailable')
    if($opexItems[$i][1] -ne 'TBC'){ $s.Cells.Item($r,3).Formula=('=IFERROR(INDEX(''04_Detailed_BoQ''!P5:P{0},MATCH(B{1},''04_Detailed_BoQ''!B5:B{0},0)),"")' -f $lastBoqRow,$r) }
    for($c=4;$c -le 7;$c++){ $prev=[char](64+$c-1); $s.Cells.Item($r,$c).Formula=('=IF({0}{1}="","",{0}{1}*(1+''01_Executive_Summary''!$G$7))' -f $prev,$r) }
    $s.Cells.Item($r,8).Formula=('=IF(COUNT(C{0}:G{0})=0,"",SUM(C{0}:G{0}))' -f $r)
    $s.Cells.Item($r,9).Formula=('=IF(COUNT(C{0}:G{0})=0,"",C{0}+D{0}/(1+''01_Executive_Summary''!$G$8)^1+E{0}/(1+''01_Executive_Summary''!$G$8)^2+F{0}/(1+''01_Executive_Summary''!$G$8)^3+G{0}/(1+''01_Executive_Summary''!$G$8)^4)' -f $r)
  }
  Write-Row $s 16 1 @('Annual OPEX total','','','','','','','','',''); $s.Range('A16:J16').Font.Bold=$true; $s.Range('A16:J16').Interior.Color=$lightBlue
  for($c=3;$c -le 9;$c++){ $letter=[char](64+$c); $s.Cells.Item(16,$c).Formula=('=IF(COUNT({0}5:{0}14)=0,"",SUM({0}5:{0}14))' -f $letter) }
  Write-Row $s 18 1 @('Implementation CAPEX incl. contingency and tax','','','','','','','','','Excludes optional items'); $s.Range('C18').Formula="='01_Executive_Summary'!B11"
  Write-Row $s 19 1 @('Five-year TCO','','','','','','','','',''); $s.Range('H19').Formula='=IF(OR(C18="",H16=""),"",C18+H16)'; $s.Range('I19').Formula='=IF(OR(C18="",I16=""),"",C18+I16)'; $s.Range('A19:J19').Font.Bold=$true; $s.Range('A19:J19').Interior.Color=$lightGreen
  $s.Range('C5:I19').NumberFormat='"RM" #,##0'; Finish-TableSheet $s 4 19 10 @(38,14,16,16,16,16,16,20,20,48)

  # 14 Assumptions/RFI
  $rfiRows=@(
    @('RFI-001','Exact crossing location, road reserve, lane and kerb geometry','Straight two-way crossing assumed only as functional reference','SC-002; SC-005 to SC-019','High','Critical','MPAJ / road authority','','Open',''),
    @('RFI-002','Topographic and underground utility survey','No route lengths or foundation positions assumed','SC-002; SC-005; SC-006; SC-024','High','High','Licensed surveyor / utilities','','Open',''),
    @('RFI-003','Traffic, speed, queue and pedestrian counts','Two monitored approaches; 40 m zones provisional','SC-003; SC-012; SC-035','High','Critical','Traffic engineer','','Open',''),
    @('RFI-004','Approved crossing layout, signal head schedule and timings','STOP-before-WALK principle only; timings require calculation','SC-017 to SC-019; SC-034; SC-048','High','Critical','Road authority / signal designer','','Open',''),
    @('RFI-005','Accessibility audit and user requirements','Two push buttons and indication units provisionally allowed','SC-008; SC-015 to SC-017','High','Critical','Accessibility reviewer / MPAJ','','Open',''),
    @('RFI-006','Power source, load, earthing, lightning risk and autonomy','One utility source and one UPS provisionally assumed','SC-022 to SC-027','High','Critical','Electrical engineer / TNB','','Open',''),
    @('RFI-007','Carrier/fibre coverage and MPAJ ICT architecture','One secure primary WAN allowed; safety remains local','SC-028 to SC-032','Medium','High','MPAJ ICT / carriers','','Open',''),
    @('RFI-008','Approved controller/device protocols and vendor schedules','Makes/models and interface effort remain TBC','SC-010 to SC-020; SC-033 to SC-039','High','Critical','MPAJ / vendors / integrator','','Open',''),
    @('RFI-009','Data controller role, lawful purpose, retention and ANPR approval','Minimum data; ANPR optional and disabled','SC-021; SC-036; SC-039; SC-044','High','Critical','MPAJ legal/privacy / enforcement','','Open',''),
    @('RFI-010','Emergency-priority request source and agency operating procedures','No automatic dispatch; interface provisional','SC-038','High','Critical','MPAJ / police / fire / hospital','','Open',''),
    @('RFI-011','Written vendor quotations, warranties, lead times and service lives','All unit rates remain blank','All priced rows','High','Medium','Procurement / vendors','','Open',''),
    @('RFI-012','Construction programme, permits and school access windows','Traffic management duration remains TBC','SC-001; SC-004; SC-059; SC-060','Medium','High','MPAJ / school / contractor','','Open','')
  )
  Add-SimpleTableSheet $wb.Worksheets.Item('14_Assumptions_RFI') 'Assumptions and Information Required Register' @('RFI no.','Missing information','Present assumption','Affected BoQ rows','Cost impact','Safety impact','Responsible party','Required response date','Status','Closure evidence') $rfiRows @(12,46,52,30,14,14,30,18,14,40)
  $s=$wb.Worksheets.Item('14_Assumptions_RFI'); Add-ListValidation $s.Range('I5:I100') 'Open,In progress,Closed,Not applicable'; $s.Range('F5:F100').FormatConditions.Add($xlExpression,[Type]::Missing,'=AND($F5="Critical",$I5<>"Closed")')|Out-Null; $s.Range('F5:F100').FormatConditions.Item(1).Interior.Color=$lightRed

  # 15 Risk and contingency plus red team
  $riskRows=@(
    @('R-01','Unknown site geometry/utilities','High','Major','TBC','Survey before design','Survey allowance only','MPAJ / designer','High','Provisional',''),
    @('R-02','Unsafe or unapproved timing/interlocks','Medium','Severe','TBC','Independent signal/safety design and witnessed tests','Safety review and test allowances','Signal designer','Medium','Required',''),
    @('R-03','Detector coverage/accuracy shortfall','High','Major','TBC','Field trials, diverse sensing and calibration','Calibration/secondary sensor allowances','Systems integrator','Medium','Required',''),
    @('R-04','Power outage exceeds autonomy','Medium','Severe','TBC','Load study, UPS sizing, power-fail safe state','UPS allowance; autonomy TBC','Electrical engineer','Medium','Required',''),
    @('R-05','WAN or cloud loss disrupts operations','Medium','Major','TBC','Local safety decisions and store-forward records','Local edge and UPS included','MPAJ ICT','Low','Required',''),
    @('R-06','Privacy/legal approval prevents ANPR','High','Moderate','TBC','Keep ANPR optional and disabled','No base contingency','MPAJ legal','Low','Optional',''),
    @('R-07','Vendor protocol/integration complexity','High','Major','TBC','Early interface disclosure and bench FAT','Integration effort TBC','Procurement / integrator','High','Provisional',''),
    @('R-08','Civil quantities increase after utility discovery','High','Major','TBC','Survey, trial pits and measured design','Risk-specific allowance after survey','Civil engineer','High','Provisional',''),
    @('R-09','Cybersecurity findings delay go-live','Medium','Major','TBC','Threat model, hardening, VA/PT and closure','Assurance allowance','MPAJ ICT','Medium','Required',''),
    @('R-10','School operations constrain works/trials','Medium','Moderate','TBC','Coordinate calendar and traffic management','Programme allowance after coordination','Project manager','Medium','Provisional','')
  )
  Add-SimpleTableSheet $wb.Worksheets.Item('15_Risk_Contingency') 'Risk, Contingency and Red-Team Review' @('Risk','Cause','Probability','Consequence','Cost exposure','Mitigation','Contingency basis','Risk owner','Residual risk','Inclusion in price','Contingency allowance (MYR)') $riskRows @(12,42,14,16,16,48,40,24,16,18,20)
  $s=$wb.Worksheets.Item('15_Risk_Contingency'); $s.Range('K5:K14').Interior.Color=$amber; $s.Range('K5:K14').NumberFormat='"RM" #,##0'; Add-ListValidation $s.Range('C5:C14') 'Low,Medium,High'; Add-ListValidation $s.Range('I5:I14') 'Low,Medium,High,Critical'
  Set-Section $s 17 'Red-team findings and closure' 11
  Write-Row $s 18 1 @('Finding ID','Challenge','Finding','Remediation','Evidence required','Closure status'); Set-Header $s 18 1 6
  Write-Rows $s 19 1 @(
    @('RT-BOQ-01','Unsupported prices','No quotations supplied; all rates blank','Obtain written quotations and record source/date','Supplier quotation and commercial evaluation','Open'),
    @('RT-BOQ-02','Unrealistic quantities','Civil routes and mounting quantities cannot be measured','Complete survey and approved layout','Survey, drawings and measured take-off','Open'),
    @('RT-BOQ-03','Single points of failure','Controller/edge/power architecture not selected','Complete hazard/FMEA and redundancy decision','Approved safety architecture','Open'),
    @('RT-BOQ-04','Backup power','Autonomy not established','Perform load and outage-risk study','Signed load/autonomy calculation','Open'),
    @('RT-BOQ-05','Degraded mode','Repository behavior is simulated, not certified','Specify deterministic controller behavior and HIL tests','Independent witnessed HIL/SAT evidence','Open'),
    @('RT-BOQ-06','Accessibility','Site route and audible/tactile needs unverified','Complete accessibility audit and user review','Approved accessibility design/test','Open'),
    @('RT-BOQ-07','Privacy/cybersecurity','Data roles, retention and MPAJ controls unknown','Complete PIA, threat model and security acceptance','Legal/security approvals and test closure','Open'),
    @('RT-BOQ-08','Testing/approval gates','No authority-approved acceptance plan','Approve FAT/SAT/UAT and go-live gates','Signed plans and gate records','Open'),
    @('RT-BOQ-09','Simulation confusion','Simulator features could be read as field capability','Keep observed/documented/assumed classifications visible','Traceability review sign-off','Addressed in workbook'),
    @('RT-BOQ-10','Duplicate cost risk','Integration appears in both devices and services','Use SC item numbers; reconcile quotations to one owner row','Commercial reconciliation','Open')
  )
  $s.Columns.Item(1).ColumnWidth=14; $s.Columns.Item(2).ColumnWidth=42; $s.Columns.Item(3).ColumnWidth=44; $s.Columns.Item(4).ColumnWidth=46; $s.Columns.Item(5).ColumnWidth=44; $s.Columns.Item(6).ColumnWidth=20

  # 16 Frameworks
  $frameworkRows=@(
    @('OODA - Observe / Simpson 1 / Bloom Remember / DRAG Define','Confirm site, users, hazards, functions and evidence','Repository, surveys, counts, utility/authority inputs','Verified baseline and RFI register','Survey and design basis','Lead ITS engineer','Survey records and traceability','Requirements review','Inputs classified and gaps assigned'),
    @('OODA - Orient / Simpson 2 / Bloom Understand-Analyse / DRAG Review','Map functions to physical architecture and Malaysian controls','Verified baseline and stakeholder requirements','Architecture, interfaces and hazard assumptions','All packages','Multidiscipline design team','Architecture, hazard log and interface schedule','Concept design review','Safety boundary and dependencies approved'),
    @('OODA - Decide / Simpson 3 / Bloom Evaluate / DRAG Assess','Select preliminary technology and procurement packages','Architecture, options and risk evidence','Recommended resilient concept','Equipment, software and procurement','MPAJ project board','Options evaluation and risk review','Concept approval','No safety item made optional'),
    @('OODA - Act / Simpson 3 / Bloom Create / DRAG Govern','Prototype and conduct FAT','Approved requirements and bench system','FAT evidence and defect register','Testing and integration','Integrator / witness','FAT report','FAT gate','Critical defects closed'),
    @('OODA repeat / Simpson 4 / Bloom Apply / DRAG Govern','Install, configure and calibrate','Approved construction design','Installed and calibrated system','Civil, field, power, network','Contractor / integrator','Inspection and calibration records','Installation gate','Works match approved design'),
    @('OODA repeat / Simpson 5 / Bloom Analyse-Evaluate / DRAG Assess','Demonstrate integrated operation and failures','Installed system and test plans','SAT/UAT and safety evidence','Testing/commissioning','Independent assessor / MPAJ','Witnessed tests','SAT/UAT gate','All critical modes pass'),
    @('OODA repeat / Simpson 6 / Bloom Evaluate / DRAG Review','Tune using validated field evidence','Controlled trial data','Approved parameter set','Analytics and timings','Traffic engineer / operator','Change-controlled tuning record','Trial review','No safety minimum weakened'),
    @('OODA repeat / Simpson 7 / Bloom Create / DRAG Govern','Approve as-built configuration and replication plan','Closed evidence set','Controlled go-live and handover baseline','All packages','Project owner','As-built, training and approval record','Go-live gate','All blockers closed objectively')
  )
  Add-SimpleTableSheet $wb.Worksheets.Item('16_OODA_Simpson_Bloom_DRAG') 'Integrated OODA, Simpson, Bloom and DRAG Workflow' @('Integrated framework stage','Activity','Input','Output','BoQ package','Responsible role','Evidence','Quality gate','Acceptance condition') $frameworkRows @(42,42,44,42,34,30,40,24,48)

  # 17 Options
  $optionRows=@(
    @('Safety controller and approved signal heads','Included','Included','Included','Required for all configurations'),@('Pedestrian detection and accessible push-button fallback','Included','Included','Included','Required; exact sensors/site layout TBC'),@('Two approach speed/presence radars','Included','Included','Included','Required for demonstrated bilateral function'),@('Primary approach cameras','Included','Included','Included','Minimum two, field validation required'),@('Independent secondary safety sensing','Included','Included','Included','Cannot be removed solely to reduce cost'),@('UPS and local safe operation without WAN','Included','Included','Included','Safety baseline; autonomy TBC'),@('Secure primary backhaul','Included','Included','Included','Operations path, not immediate safety dependency'),@('Diverse communications path','Excluded','Included','Included','Resilience option; local safe state remains mandatory'),@('Context cameras','Excluded','Included','Included','Supports evidence and redundancy'),@('ANPR','Excluded','Excluded','Optional','Requires separate legal/operational approval'),@('Enhanced analytics / smart-city data interfaces','Excluded','Limited','Included','Never given WALK authority'),@('CAPEX','TBC','TBC','TBC','Rates absent'),@('Annual recurring cost','TBC','TBC','TBC','Rates absent'),@('Principal risk','Less evidence context and comms resilience','Balanced resilient pilot','Highest integration/privacy complexity','All remain concept-only'))
  Add-SimpleTableSheet $wb.Worksheets.Item('17_Options_Comparison') 'Options Comparison' @('Feature / measure','Minimum safety-compliant pilot','Recommended resilient pilot','Enhanced smart-city configuration','Notes') $optionRows @(44,30,30,34,60)

  # 18 Sources
  $sourceRows=@(
    @('SRC-001','SmartCross production URL','SmartCross project','https://smartcross-v2-pedestrian-simulator.vercel.app/','Checked 2026-09-22','Public live page could not be retrieved by current web surface; repository deployment record used separately','Workbook boundary','Not independently observed this run','Codex','Browser CLI unavailable; web open returned internal error.'),
    @('SRC-002','README.md','SmartCross project','Repository file','Current working copy 2026-09-22','Simulation-only boundary; normal/school modes; bilateral 40 m zones; sensors; signals; fallback; emergency priority','SC-010 to SC-021; SC-033 to SC-039','Verified','Codex','Repository evidence.'),
    @('SRC-003','context-pack/progress-tracker.md','SmartCross project','Repository file','Status dated 2026-09-19','Current deployment record, testing claims and implemented functions','Function traceability','Verified as project record','Codex','Not equivalent to field acceptance.'),
    @('SRC-004','lib/types.ts and lib/simulation.ts','SmartCross project','Repository files','Current working copy','Seven stages, modes, evidence and simulated response contracts','SC-034 to SC-039','Verified','Codex','Code inspection only.'),
    @('SRC-005','lib/camera-fallback.ts','SmartCross project','Repository file','Current working copy','Degraded request latch, secondary checks, safety hold and protected interval','SC-014; SC-015; SC-019; SC-034','Verified','Codex','Simulation behavior, not certified controller logic.'),
    @('SRC-006','Accessibility, governance and MPAJ responsibilities','SmartCross project','docs/accessibility-governance-and-mpaj-responsibilities.md','2026-09-03','Accessibility, human review, privacy and authority responsibilities','SC-008; SC-015 to SC-017; SC-044','Verified','Codex','No MPAJ endorsement implied.'),
    @('SRC-007','Electricity Regulations 1994','Suruhanjaya Tenaga','https://www.st.gov.my/ms/node/5378','Official page checked 2026-09-22','Electrical installation, supervision, testing and competent-person framework','SC-022 to SC-027; SC-049','Verified official source','Codex','Applicability to final installation to be confirmed by competent person.'),
    @('SRC-008','Electrical installation guidance','Suruhanjaya Tenaga','https://www.st.gov.my/stakeholders/electricity/installation','Official page checked 2026-09-22','Licensed contractors/wiremen and installation registration/testing requirements','SC-022 to SC-027; SC-049','Verified official source','Codex','Final obligations depend on installation classification.'),
    @('SRC-009','Personal Data Protection Act 2010 and Amendment Act 2024 page','Personal Data Protection Commissioner','https://www.pdp.gov.my/ppdpv1/en/akta/pdp-act-2010-en/','Official page checked 2026-09-22','Privacy legal review required for identifiable evidence and processing','SC-021; SC-044','Verified official source','Codex','Application to local-authority processing requires legal confirmation.'),
    @('SRC-010','MCMC certification programme evidence','Malaysian Communications and Multimedia Commission','https://mcmc.gov.my/skmmgovmy/media/General/pdf2/MCMC-AR2019-ENG-SP-_organized.pdf','Official report accessed 2026-09-22','Communications equipment/cabling certification framework','SC-028 to SC-032','Verified official source','Codex','Specific device type approvals remain TBC.'),
    @('SRC-011','SK Taman Melawati 2 site data','Not supplied','Site survey / authority records required','TBC','Geometry, utilities, traffic, power, communications and mounting data','All site-dependent rows','Not verified','Codex','Primary concept-to-tender blocker.'),
    @('SRC-012','Vendor quotations and datasheets','Not supplied','Written quotations required','TBC','Makes, models, performance, lead times, warranties, rates and service lives','All priced rows','Not verified','Codex','No vendor pricing fabricated.')
  )
  Add-SimpleTableSheet $wb.Worksheets.Item('18_Source_Traceability') 'Source Traceability Register' @('Source ID','Title','Organisation','URL / document reference','Revision / date','Requirement extracted','Affected BoQ item','Verification status','Reviewer','Remarks') $sourceRows @(12,38,30,54,24,64,32,24,14,50)

  # 19 Approval gates
  $gateRows=@(
    @('G-01','Requirements approval','Functions, scope, exclusions and safety principles agreed','Approved requirements baseline','MPAJ project owner / road authority','Open','Concept review'),@('G-02','Site-survey acceptance','Topography, utilities, traffic, accessibility and condition records complete','Accepted survey package','MPAJ / designers','Open','Before design'),@('G-03','Design approval','Civil, signal, electrical, communications, cyber and privacy designs coordinated','Approved-for-construction design','Relevant authorities / designers','Open','No construction before approval'),@('G-04','BoQ review','Measured quantities, quotations and cost reconciliation complete','Tender-ready BoQ approval','Quantity surveyor / project owner','Open','Current workbook does not pass'),@('G-05','Safety review','Hazard analysis, timings, interlocks and degraded modes accepted','Independent safety acceptance','Independent assessor / road authority','Open','Go-live blocker'),@('G-06','Cybersecurity review','Threat model, architecture, hardening and test plan accepted','Cybersecurity approval','MPAJ ICT / security','Open','Go-live blocker'),@('G-07','Procurement approval','Compliant technical/commercial evaluation and funding','Purchase approval','MPAJ procurement / owner','Open','After design/BoQ'),@('G-08','FAT acceptance','Integrated bench tests pass and critical defects close','Signed FAT certificate','MPAJ witness / integrator','Open','Before delivery'),@('G-09','Installation acceptance','Works inspected against approved drawings','Installation acceptance','Designers / MPAJ','Open','Before energisation/SAT'),@('G-10','SAT/UAT','All operational and failure modes pass','Signed SAT/UAT records','MPAJ / authority / users','Open','Before trial'),@('G-11','Independent closure verification','Safety, cybersecurity and test findings objectively closed','Closure statement','Independent reviewers','Open','No self-closure'),@('G-12','Project-owner acceptance','Training, documents, spares, support and residual risk accepted','Handover certificate','MPAJ project owner','Open','Before go-live'),@('G-13','Controlled go-live','Permits, operations, rollback and monitoring ready','Time-bound controlled operating approval','Authorised authority','Open','May be stopped if criteria fail'))
  Add-SimpleTableSheet $wb.Worksheets.Item('19_Approval_Gates') 'Approval Gates' @('Gate','Approval','Entry criteria','Required evidence','Approver','Status','Notes') $gateRows @(10,32,58,42,32,14,42)
  $s=$wb.Worksheets.Item('19_Approval_Gates'); Add-ListValidation $s.Range('F5:F100') 'Open,In review,Approved,Rejected,Not applicable'; $s.Range('F5:F100').FormatConditions.Add($xlExpression,[Type]::Missing,'=AND($F5<>"Approved",$F5<>"Not applicable")')|Out-Null; $s.Range('F5:F100').FormatConditions.Item(1).Interior.Color=$lightRed

  # Global formatting and workbook calculation
  foreach($ws in $wb.Worksheets){
    $used=$ws.UsedRange
    $used.VerticalAlignment=$xlTop
    $used.Font.Name='Arial'
    try { $ws.PageSetup.CenterFooter='SmartCross Concept BoQ | Controlled review copy | Page &P of &N' } catch {}
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($used)
  }
  $wb.Worksheets.Item('00_Read_Me').Activate() | Out-Null
  $excel.CalculateFullRebuild()
  if(Test-Path $OutputPath){ Remove-Item -LiteralPath $OutputPath -Force }
  $wb.SaveAs($OutputPath,$xlOpenXMLWorkbook)
  $wb.Close($true)
  Write-Output $OutputPath
}
finally {
  if($excel){ $excel.Quit(); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) }
  [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}
