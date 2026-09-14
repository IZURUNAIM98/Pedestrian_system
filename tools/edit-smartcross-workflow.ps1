param(
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'

function Clean-WordText([string]$Text) {
    return $Text.Trim([char]13, [char]7, [char]9, [char]32)
}

function Set-ParagraphByPrefix($Document, [string]$Prefix, [string]$Replacement, [string]$Style = '') {
    foreach ($paragraph in $Document.Paragraphs) {
        $current = Clean-WordText $paragraph.Range.Text
        if ($current.StartsWith($Prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            $range = $paragraph.Range.Duplicate
            if ($range.End -gt $range.Start) { $range.MoveEnd(1, -1) | Out-Null }
            $range.Text = $Replacement
            if ($Style) { $paragraph.Range.Style = $Style }
            return $true
        }
    }
    throw "Paragraph not found: $Prefix"
}

function Set-CellText($Cell, [string]$Text) {
    $range = $Cell.Range.Duplicate
    $range.End = $range.End - 1
    $range.Text = $Text
}

function Set-TableRow($Table, [int]$RowIndex, [string[]]$Values) {
    for ($column = 1; $column -le $Values.Count; $column++) {
        Set-CellText $Table.Cell($RowIndex, $column) $Values[$column - 1]
    }
}

function Add-RequirementRow($Table, [string]$Criterion, [string]$Expectation, [string]$Evidence) {
    $row = $Table.Rows.Add()
    Set-CellText $row.Cells.Item(1) $Criterion
    Set-CellText $row.Cells.Item(2) $Expectation
    Set-CellText $row.Cells.Item(3) $Evidence
}

function Add-ParagraphHyperlink($Document, [string]$Prefix, [string]$Address, [string]$DisplayText) {
    foreach ($paragraph in $Document.Paragraphs) {
        if ((Clean-WordText $paragraph.Range.Text).StartsWith($Prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            $range = $paragraph.Range.Duplicate
            if ($range.End -gt $range.Start) { $range.MoveEnd(1, -1) | Out-Null }
            $Document.Hyperlinks.Add($range, $Address, $null, $null, $DisplayText) | Out-Null
            return
        }
    }
    throw "Hyperlink paragraph not found: $Prefix"
}

$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0

    $document = $word.Documents.Open($SourcePath, $false, $true)
    $document.SaveAs2($OutputPath, 16)
    $document.Close()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) | Out-Null
    $document = $word.Documents.Open($OutputPath, $false, $false)
    $document.TrackRevisions = $false

    Set-ParagraphByPrefix $document 'A methodology record for' 'A methodology record for the SmartCross V2 pedestrian-crossing simulator'
    Set-ParagraphByPrefix $document 'Prepared from the project conversation' 'Prepared from the project conversation, verified SmartCross V2 source and deployment record'

    $overview = 'This document converts the project dialogue into a repeatable methodology for designing, developing, challenging, refining, and validating SmartCross V2. The current pilot is limited to a straight two-way road with a zebra crossing in two modes: Normal and School. Normal provides 20 selectable conditions; School provides 21, including the school-zone condition. Three-arm and four-way junctions are future-phase studies and are not SmartCross V2 functions. The workflow retains violation-specific motion, emergency review, accessibility, Malaysian context, and a simulation-only safety boundary.'
    Set-ParagraphByPrefix $document 'This document converts the full project dialogue' $overview
    Set-ParagraphByPrefix $document 'The webpage is treated as' 'SmartCross V2 is a traceable research, simulation, training, and stakeholder-communication prototype. It is not a certified live traffic-control, enforcement, ANPR, emergency-dispatch, or public-safety system.'

    Set-ParagraphByPrefix $document 'The project used complementary methods.' 'The project uses complementary methods. OODA supplies the decision cycle; DRAG supplies debugging and refinement; localized Neufert analysis supplies spatial and human-scale evidence; Simpson''s Psychomotor Domain supplies progressive system and user actions; Bloom''s Taxonomy supplies cognitive progression; and AIM defines each prompt through Actor, Input, and Mission.'
    Set-ParagraphByPrefix $document 'Review the existing Lintas AI/Link 2 webpage' 'Review the existing SmartCross V2 application, its source, screenshots, attached references, prior prompts, two crossing modes, scenario catalogue, controller states, logs, reports, target links, and simulation-only boundary.'
    Set-ParagraphByPrefix $document 'Choose page structure, scenario types' 'Choose the two-mode page structure, violation-specific motion profile, seven-frame sequence, 12-second protected WALK, controller and signal states, evidence/log outputs, mock escalation logic, responsive layout, and validation strategy.'
    Set-ParagraphByPrefix $document 'Issue precise Codex prompts' 'Issue precise Codex prompts, inspect the generated SmartCross V2 interface, amend only bounded requirements, run every selectable Normal and School condition, verify the protected WALK invariant, record evidence, and prepare a deployment bundle only after local validation.'
    Set-ParagraphByPrefix $document 'OODA is cyclic:' 'OODA is cyclic: each screenshot, failed test, sequence mismatch, user observation, or feature request becomes new evidence for the next Observe stage without silently broadening the V2 pilot scope.'

    Set-ParagraphByPrefix $document 'DRAG prevents feature drift.' 'DRAG prevents feature drift. Each amendment must state what is retained, changed, excluded, and how it will be verified. For SmartCross V2, retain the straight two-way Normal/School scope, preserve scenario-specific motion and logs, enforce WALK only after conflicting traffic stops, and keep all emergency recipients fictional.'

    Set-ParagraphByPrefix $document 'Define the boundary:' 'Define the boundary: SmartCross V2 covers a straight two-way zebra crossing in Normal and School modes. Junction scenarios are outside the current V2 pilot.'
    Set-ParagraphByPrefix $document 'Audit the existing webpage before editing:' 'Audit SmartCross V2 before editing: routes, access gate, 20 Normal conditions, 21 School conditions, seven-frame motion profiles, 12-second protected WALK, event log, PDF report, mock notifications, visual language, responsive behaviour, links, and deployment address.'
    Set-ParagraphByPrefix $document 'Convert findings into requirements:' 'Convert findings into requirements: actors, fixed starting positions, inputs, sensors, frame-by-frame decisions, vehicle and pedestrian states, outputs, safety invariants, privacy notes, accessibility needs, emergency effects, and edge cases.'
    Set-ParagraphByPrefix $document 'Write an AIM-based Codex prompt' 'Write an AIM-based Codex prompt using Actor, Input, and Mission, with explicit acceptance criteria, preservation rules, safety invariants, and a requested change summary.'
    Set-ParagraphByPrefix $document 'Implement dashboard, simulator, event log' 'Implement or refine the dashboard, crossing scene, scenario controls, deterministic seven-frame motion, synchronized vehicle/pedestrian signals, event log, violation history, PDF report, and local mock notification workflow.'
    Set-ParagraphByPrefix $document 'Challenge the result using Simpson levels' 'Challenge every Normal and School selection using Simpson levels and Bloom progression; test perception, preparation, guided response, reliable operation, complex response, adaptation, and origination.'
    Set-ParagraphByPrefix $document 'Apply DRAG to defects in layout' 'Apply DRAG to defects in layout, language, actor position, speed, timing, detection, pedestrian clearance, collision/fire effects, event records, responsive behaviour, links, or deployment readiness.'
    Set-ParagraphByPrefix $document 'Validate the final user flow' 'Validate the complete local user flow and safety contracts. Build a clean deployment bundle and publish to the intended existing V2 project only after explicit owner approval.'

    Set-ParagraphByPrefix $document '6. Core system criteria' '6. SmartCross V2 core requirements' 'Heading 1'
    Set-ParagraphByPrefix $document 'The prompts became a requirements language.' 'The prompts are the project requirements language. A strong SmartCross V2 prompt contains Actor, Input, Mission, constraints, preservation rules, expected output, acceptance criteria, and verification evidence.'
    Set-ParagraphByPrefix $document 'Use active verb' 'Use active verb-object-classifier statements such as: "Identify pedestrian occupancy according to Perception classifiers"; "Prepare the school-crossing scenario according to Set classifiers"; and "Record a local mock notification according to Complex Overt Response classifiers."'

    Set-ParagraphByPrefix $document 'Do not present a mockup or simulator' 'Do not present SmartCross V2 as a certified traffic-control system, enforcement platform, ANPR service, safety guarantee, production sensor deployment, or live emergency-dispatch channel.'
    Set-ParagraphByPrefix $document 'Treat AI agents as decision-support components' 'Treat AI agents as decision-support components. They do not replace statutory approval, engineering responsibility, emergency command, human verification, or the local operator''s authority.'
    Set-ParagraphByPrefix $document 'Keep a change log for every Codex amendment:' 'Keep a change log for every Codex amendment: date, AIM prompt, components affected, preserved features, condition profiles tested, safety-contract results, visual evidence, limitations, approver, and deployment target.'

    Set-ParagraphByPrefix $document 'Frame the local problem and boundary.' 'Frame the straight two-way Normal/School crossing problem and its simulation-only boundary.'
    Set-ParagraphByPrefix $document 'Write an AIM-based Codex prompt with Bloom' 'Write an Actor-Input-Mission prompt with Bloom and Simpson classifiers plus explicit safety acceptance criteria.'
    Set-ParagraphByPrefix $document 'Build the smallest coherent webpage or simulator feature.' 'Build the smallest coherent SmartCross V2 feature without disturbing unrelated Normal/School behaviour.'
    Set-ParagraphByPrefix $document 'Publish only the validated, clearly labelled version.' 'Publish only the validated, clearly labelled simulation to the intended existing project after explicit owner approval.'

    Set-ParagraphByPrefix $document 'The project connects evidence, prompt design' 'SmartCross V2 connects evidence, prompt design, deterministic implementation, and verification. OODA keeps the work responsive; DRAG prevents uncontrolled iteration; localized Neufert analysis grounds the design in human scale and spatial reasoning; Simpson and Bloom make system actions and learning progression explicit; and AIM keeps Actor, Input, and Mission traceable. Together, these methods support a reviewable two-mode crossing simulator without implying live traffic control or emergency dispatch.'
    Set-ParagraphByPrefix $document 'Document status:' 'Document status: SmartCross V2 workflow and requirements baseline updated on 1 September 2026 from the available conversation, verified project source, tests, and deployment record. Update it when field evidence, authority decisions, code, safety validation, or deployment status changes.'
    Set-ParagraphByPrefix $document 'Difference between normal crossing and school crossing' 'Appendix A. Normal and School crossing comparison' 'Heading 1'
    Set-ParagraphByPrefix $document 'Link 1' 'SmartCross production reference - https://lintas-ai-pedestrian-simulator.vercel.app/'
    Set-ParagraphByPrefix $document 'Link 2' 'SmartCross V2 production - https://smartcross-v2-pedestrian-simulator.vercel.app/'
    Add-ParagraphHyperlink $document 'SmartCross production reference' 'https://lintas-ai-pedestrian-simulator.vercel.app/' 'SmartCross production reference - https://lintas-ai-pedestrian-simulator.vercel.app/'
    Add-ParagraphHyperlink $document 'SmartCross V2 production' 'https://smartcross-v2-pedestrian-simulator.vercel.app/' 'SmartCross V2 production - https://smartcross-v2-pedestrian-simulator.vercel.app/'

    Set-CellText $document.Tables.Item(1).Cell(2, 2) 'Current SmartCross V2 pilot: straight two-way zebra crossing with Normal and School modes; junctions remain future-phase work.'
    Set-CellText $document.Tables.Item(1).Cell(2, 3) 'OODA + DRAG + localized Neufert evidence + Simpson psychomotor assessment + Bloom progression + AIM (Actor, Input, Mission).'

    Set-CellText $document.Tables.Item(2).Cell(7, 2) 'Define a focused implementation request through Actor, Input, and Mission.'
    Set-CellText $document.Tables.Item(2).Cell(7, 3) 'Who acts, what evidence and constraints are provided, and what verified outcome must be delivered?'

    Set-CellText $document.Tables.Item(4).Cell(3, 2) 'Crossing distance, straight two-way approach layout, sight distance, waiting area, zebra route, and conflict points. Junction geometries are future-phase evidence only.'
    Set-CellText $document.Tables.Item(4).Cell(3, 3) 'Normal and School V2 scenes, fixed vehicle lanes, roadside detection, stop positions, and a direct protected pedestrian route.'
    Set-CellText $document.Tables.Item(4).Cell(4, 2) 'Synchronized signal sequence, pedestrian clearance, violation-specific vehicle movement, sensor state, collision/fire effects, and recovery timing.'
    Set-CellText $document.Tables.Item(4).Cell(4, 3) 'Deterministic seven-frame profiles, 12-second protected WALK, event log, PDF report, and local mock escalation.'

    $core = $document.Tables.Item(5)
    Set-TableRow $core 2 @('Scope fidelity', 'Straight two-way zebra crossing only. Normal has 20 selectable conditions; School has 21, including the school-zone condition. Junctions are not V2 functions.', 'Scenario catalogue, route review, source and test assertions.')
    Set-TableRow $core 3 @('Safety logic', 'Pedestrian WALK is released only after conflicting vehicles stop and remains protected for 12 seconds. Conflicting traffic remains stopped until pedestrian clearance.', 'Controller-clock tests, signal-state contracts, complete condition matrix.')
    Set-TableRow $core 4 @('Traceability', 'Every run records seven ordered frames, timestamps, sensor/controller state, actor speed/state, evidence, history, and PDF output from the same incident data.', 'Frame log, violation history, incident review and PDF comparison.')
    Set-TableRow $core 5 @('Realism', 'Vehicles begin stationary in their assigned opposing lanes and do not swap positions. Every selected condition follows its own path, timing, effect and final outcome.', 'Exhaustive Normal/School motion tests and browser observation.')
    Set-TableRow $core 6 @('Accessibility', 'Readable controls, strong contrast, keyboard operation, responsive layout, one Normal pedestrian, and an accessibly labelled School student group.', 'Accessibility audit, desktop/mobile browser tests and visual review.')
    Set-TableRow $core 7 @('Localization', 'MPAJ/Malaysian terminology, left-hand traffic, motorcycles, school frontage/courtyard and lower-speed school context without unverified site claims.', 'Language, scenario and location-claim audit.')
    Set-TableRow $core 8 @('Privacy/security', 'CCTV/plate evidence is synthetic; no live ANPR lookup, facial recognition, identity inference, external recipient or unnecessary personal data is connected.', 'Privacy note, generated evidence inspection and notification test.')
    Set-TableRow $core 9 @('Performance', 'Responsive simulator, stable navigation and synchronized animation/controller state across supported viewports.', 'Production build, desktop/mobile E2E and deployment smoke checks.')
    Add-RequirementRow $core 'Initial scene' 'Vehicle A and Vehicle B remain stationary at their established opposite-side idle positions until Run. Decorative start circles remain removed.' 'No-motion-before-run contract; zero vehicle-start-marker assertion.'
    Add-RequirementRow $core 'Mode distinction' 'Normal shows the public mid-block setting and one pedestrian. School shows the forecourt/courtyard and a compact student group while preserving shared safety logic.' 'Mode-switch visual and accessibility assertions.'
    Add-RequirementRow $core 'Critical incidents' 'Collision/fire effects appear only after the simulated trigger. FIRE / SMOKE and STOP signage remain separated and actors freeze under STOP/WAIT.' 'Critical-profile timing, visible-effect and terminal-state tests.'
    Add-RequirementRow $core 'Notification boundary' 'High/critical cases use a local mock queue for MPAJ and first responders. No external message or dispatch occurs.' 'Mock-workflow status, disclaimer and network-boundary review.'

    $promptTable = $document.Tables.Item(6)
    Set-CellText $promptTable.Cell(2, 1) 'ACTOR'
    Set-CellText $promptTable.Cell(2, 2) 'Act as the authorised SmartCross V2 implementation and verification agent, informed by Malaysian traffic engineering, UX, accessibility and IoT constraints.'
    Set-CellText $promptTable.Cell(2, 3) 'A bounded, accountable implementation role.'
    Set-CellText $promptTable.Cell(3, 2) 'Current source, Normal/School scenario catalogue, written sequence definitions, screenshots, test contracts, deployment target, and simulation-only constraints.'
    Set-CellText $promptTable.Cell(3, 3) 'A verified evidence and preservation inventory.'
    Set-CellText $promptTable.Cell(4, 2) 'Deliver the specified SmartCross V2 change while preserving all unrelated behaviour and proving the protected crossing invariant.'
    Set-CellText $promptTable.Cell(4, 3) 'An implemented, tested and traceable outcome.'

    Set-CellText $document.Tables.Item(7).Cell(7, 2) 'Adjust for the School mode, motorcycles, rain/night visibility, or vulnerable users while retaining the two-way V2 boundary.'

    foreach ($table in $document.Tables) {
        $table.Rows.Item(1).HeadingFormat = -1
        $table.Rows.AllowBreakAcrossPages = -1
        $table.TopPadding = 3
        $table.BottomPadding = 3
        $table.LeftPadding = 4
        $table.RightPadding = 4
    }

    $outputRegister = $document.Tables.Item(8)
    $outputRegister.AllowAutoFit = $false
    $outputRegister.Columns.Item(1).SetWidth(120, 0)
    $outputRegister.Columns.Item(2).SetWidth(240, 0)
    $outputRegister.Columns.Item(3).SetWidth(190, 0)

    foreach ($paragraph in $document.Paragraphs) {
        if ((Clean-WordText $paragraph.Range.Text).StartsWith('Appendix A.', [System.StringComparison]::OrdinalIgnoreCase)) {
            $paragraph.Range.ParagraphFormat.PageBreakBefore = -1
            $insertRange = $paragraph.Range.Duplicate
            $insertRange.Collapse(0)
            $insertRange.InsertAfter('The embedded comparison images are retained as historical design reference. Their percentages are not verified operational evidence; the current SmartCross V2 baseline is governed by Section 6 and its test evidence.' + [char]13)
            break
        }
    }
    Set-ParagraphByPrefix $document 'The embedded comparison images are retained' 'The embedded comparison images are retained as historical design reference. Their percentages are not verified operational evidence; the current SmartCross V2 baseline is governed by Section 6 and its test evidence.' 'Normal'

    $document.Fields.Update() | Out-Null
    $document.Save()
    $document.Close()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) | Out-Null
    $document = $null
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

Get-Item -LiteralPath $OutputPath | Select-Object FullName, Length, LastWriteTime
