from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                PageBreak, KeepTogether, Flowable)

OUT = Path('output/pdf/SmartCross_PreDeployment_Assessment.pdf')
OUT.parent.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor('#082733')
INK = colors.HexColor('#143641')
TEAL = colors.HexColor('#087f72')
MINT = colors.HexColor('#dff3e9')
PALE = colors.HexColor('#f4f5f1')
AMBER = colors.HexColor('#f4b942')
RED = colors.HexColor('#b42318')
LINE = colors.HexColor('#cfd9d8')

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='CoverKicker', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=TEAL, tracking=1.5, spaceAfter=8))
styles.add(ParagraphStyle(name='CoverTitle', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=28, leading=31, textColor=NAVY, spaceAfter=10))
styles.add(ParagraphStyle(name='H1x', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=NAVY, spaceBefore=4, spaceAfter=8))
styles.add(ParagraphStyle(name='H2x', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=TEAL, spaceBefore=6, spaceAfter=4))
styles.add(ParagraphStyle(name='Bodyx', parent=styles['BodyText'], fontName='Helvetica', fontSize=8.7, leading=12, textColor=INK, spaceAfter=5))
styles.add(ParagraphStyle(name='Smallx', parent=styles['BodyText'], fontName='Helvetica', fontSize=7.2, leading=9.2, textColor=INK))
styles.add(ParagraphStyle(name='Tinyx', parent=styles['BodyText'], fontName='Helvetica', fontSize=6.5, leading=8, textColor=INK))
styles.add(ParagraphStyle(name='WhiteTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=18, leading=22, textColor=colors.white))

def P(text, style='Bodyx'):
    return Paragraph(text, styles[style])

def table(data, widths, header=True, font=7.3):
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign='LEFT')
    commands = [('GRID', (0,0), (-1,-1), 0.35, LINE), ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('LEFTPADDING', (0,0), (-1,-1), 5), ('RIGHTPADDING', (0,0), (-1,-1), 5),
                ('TOPPADDING', (0,0), (-1,-1), 5), ('BOTTOMPADDING', (0,0), (-1,-1), 5)]
    if header:
        commands += [('BACKGROUND', (0,0), (-1,0), NAVY), ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                      ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold')]
        start = 1
    else: start = 0
    for r in range(start, len(data)):
        if r % 2 == 0: commands.append(('BACKGROUND', (0,r), (-1,r), PALE))
    t.setStyle(TableStyle(commands))
    return t

class Architecture(Flowable):
    def __init__(self, width=170*mm, height=76*mm):
        Flowable.__init__(self); self.width = width; self.height = height
    def draw(self):
        c = self.canv; x=0; y=0; w=self.width; h=self.height
        c.setFillColor(colors.HexColor('#eef3ef')); c.roundRect(x,y,w,h,5,fill=1,stroke=0)
        layers=[('FIELD / ROAD SIDE', 'CCTV • approach radar • pedestrian request • traffic lamps', colors.HexColor('#d8eee5')),
                ('EDGE / SAFETY CONTROLLER', '40 m approach model • deterministic state machine • local fallback', colors.HexColor('#cce8e5')),
                ('PLATFORM / REVIEW', 'event history • PDF report • role access • audit metadata', colors.HexColor('#dce6f2')),
                ('OPERATIONS / APPROVAL', 'human verification • incident workflow • pilot evidence', colors.HexColor('#f8e6bc'))]
        bh=(h-18)/4
        for i,(title,desc,bg) in enumerate(layers):
            yy=h-10-(i+1)*bh
            c.setFillColor(bg); c.roundRect(10,yy,w-20,bh-3,4,fill=1,stroke=0)
            c.setFillColor(NAVY); c.setFont('Helvetica-Bold',8); c.drawString(18,yy+bh-14,title)
            c.setFont('Helvetica',7); c.drawString(18,yy+7,desc)
            if i<3:
                c.setStrokeColor(TEAL); c.setLineWidth(1); c.line(w/2,yy-1,w/2,yy-7)
                c.line(w/2,yy-7,w/2-3,yy-4); c.line(w/2,yy-7,w/2+3,yy-4)

def footer(canvas, doc):
    canvas.saveState(); canvas.setStrokeColor(LINE); canvas.line(18*mm,12*mm,192*mm,12*mm)
    canvas.setFont('Helvetica',7); canvas.setFillColor(colors.HexColor('#557078'))
    canvas.drawString(18*mm,7*mm,'SmartCross • Pre-deployment readiness assessment • simulation evidence only')
    canvas.drawRightString(192*mm,7*mm,f'{doc.page}')
    canvas.restoreState()

story=[]
story += [Spacer(1,24*mm), P('SMARTCROSS / AIM READINESS REVIEW','CoverKicker'), P('Pre-deployment assessment','CoverTitle'),
          P('Detailed design and operational readiness assessment for the SmartCross pedestrian-safety simulator and its proposed controlled field pathway.','Bodyx'), Spacer(1,8*mm)]
decision = Table([[P('<b>DECISION</b>','Smallx'), P('<font color="#b42318"><b>NOT READY FOR LIVE DEPLOYMENT</b></font><br/>The current evidence supports a simulation and verification programme only.','Bodyx')]], colWidths=[32*mm,138*mm])
decision.setStyle(TableStyle([('BACKGROUND',(0,0),(0,0),NAVY),('TEXTCOLOR',(0,0),(0,0),colors.white),('BACKGROUND',(1,0),(1,0),colors.HexColor('#fbe4e2')),('BOX',(0,0),(-1,-1),0.8,RED),('VALIGN',(0,0),(-1,-1),'TOP'),('PADDING',(0,0),(-1,-1),8)])); story += [decision, Spacer(1,8*mm)]
story += [P('<b>Assessment purpose.</b> Apply the supplied AIM prompt to the as-built SmartCross baseline, distinguish evidence from proposal, expose mandatory blockers, and define the gates required before any controlled pilot.','Bodyx'), P('<b>Scope boundary.</b> This document does not authorise connection to live roadside equipment, emergency dispatch, enforcement, or production credentials.','Bodyx'), Spacer(1,20*mm), P('Prepared 18 September 2026 • SmartCross product name retained • owner: project engineering / authorised authority','Smallx'), PageBreak()]

story += [P('1. AIM assessment method','H1x'), P('The review follows Actor–Input–Mission: identify the actors and accountability, inventory the inputs and evidence available, then test whether the mission can be executed safely and audibly. Bloom’s progression is used to remember, understand, apply, analyse, evaluate and create the next verification artefacts.','Bodyx')]
story += [table([[P('Evidence class','Smallx'),P('Meaning','Smallx'),P('Treatment','Smallx')],
 [P('<b>VERIFIED</b>','Smallx'),P('Observed in source files or repeatable local test.','Smallx'),P('May support a gate when scope is explicit.','Smallx')],
 [P('<b>SIMULATED</b>','Smallx'),P('Generated by the browser simulator, not a field measurement.','Smallx'),P('Useful for workflow rehearsal only.','Smallx')],
 [P('<b>PROPOSED</b>','Smallx'),P('Target architecture, policy or integration idea.','Smallx'),P('Requires design approval and test evidence.','Smallx')],
 [P('<b>MISSING</b>','Smallx'),P('Required evidence is not present in the baseline.','Smallx'),P('Mandatory blocker until closed.','Smallx')]], [32*mm,65*mm,73*mm]), Spacer(1,8*mm)]
story += [P('AIM summary','H2x'), table([[P('Actor','Smallx'),P('Input','Smallx'),P('Mission / accountability','Smallx')],
 [P('Pedestrian / school user','Smallx'),P('Request button, crossing demand, accessible need','Smallx'),P('Receive a safe WALK phase; no user identity inferred.','Smallx')],
 [P('Roadside controller','Smallx'),P('Radar, CCTV classification, signal state, health','Smallx'),P('Hold STOP, grant WALK only under safe conflict state, log every transition.','Smallx')],
 [P('Operator / reviewer','Smallx'),P('Incident record, evidence summary, alarm and severity','Smallx'),P('Verify, dismiss or escalate; never rely on automated enforcement.','Smallx')],
 [P('Authority / responder','Smallx'),P('Approved notification workflow and incident facts','Smallx'),P('Own response decisions; any integration remains mock until authorised.','Smallx')]], [35*mm,62*mm,73*mm]), PageBreak()]

story += [P('2. Current baseline and operational design domain','H1x'), P('The as-built baseline is a browser-based SmartCross simulator with two scenarios: normal zebra crossing and school crossing. It includes animated vehicle approaches, pedestrian request and walk/wait timing, traffic-light states, marked crossing/stop/speed zones, violation history, role-gated access, PDF reporting, and mock critical-incident workflow.','Bodyx')]
story += [P('Confirmed baseline behaviours','H2x'), table([[P('Area','Smallx'),P('Current evidence','Smallx'),P('Readiness interpretation','Smallx')],
 [P('Simulation','Smallx'),P('Two crossing scenarios, violation options, vehicle motion and event history are represented in the application.','Smallx'),P('Suitable for training/rehearsal; not field proof.','Smallx')],
 [P('Safety invariant','Smallx'),P('STOP-before-WALK and conservative all-red/hold behaviour are required by the design intent.','Smallx'),P('Must be proven with automated and witnessed tests.','Smallx')],
 [P('Authentication','Smallx'),P('Protected access is part of the deployment baseline; credentials are retained server-side and excluded from this report.','Smallx'),P('Needs security review, rotation process and access audit.','Smallx')],
 [P('Reporting','Smallx'),P('Violation records can be rendered as a PDF report for review.','Smallx'),P('Evidence chain and retention policy remain to be approved.','Smallx')]], [32*mm,88*mm,50*mm])]
story += [P('Operational design domain (ODD)','H2x'), table([[P('Dimension','Smallx'),P('In-scope assumption','Smallx'),P('Boundary / evidence needed','Smallx')],
 [P('Location','Smallx'),P('Representative MPAJ mid-block road and school frontage.','Smallx'),P('Site survey, geometry, sightline and authority approval.','Smallx')],
 [P('Traffic','Smallx'),P('Left-hand traffic; one approach per direction; 40 m approach model.','Smallx'),P('Calibrated speed/distance and lane mapping.','Smallx')],
 [P('Weather / lighting','Smallx'),P('Conceptual daytime demonstration.','Smallx'),P('Rain, night, glare, occlusion and CCTV performance tests.','Smallx')],
 [P('Users','Smallx'),P('Pedestrians, school children as a protected group, cars and motorcycles.','Smallx'),P('Accessibility, crowding, wheelchair and supervised-school procedures.','Smallx')]], [32*mm,70*mm,68*mm]), PageBreak()]

story += [P('3. Target architecture and safety design','H1x'), P('The target design separates roadside observation, deterministic local control, review tooling and authority decisions. No browser workflow should directly command a live signal or responder.','Bodyx'), Architecture(), Spacer(1,6*mm), P('Design principles','H2x'), table([[P('Principle','Smallx'),P('Required implementation','Smallx')],
 [P('Local-first safety','Smallx'),P('If inputs are stale, conflicting or unavailable, enter an approved conservative hold; do not improvise a permissive signal.','Smallx')],
 [P('Pedestrian priority','Smallx'),P('A valid request starts a controlled sequence. WALK is granted only after traffic conflict is RED/all-red and remains available until the protected walk timer completes.','Smallx')],
 [P('Traceability','Smallx'),P('Record request, sensor state, controller phase, violation classifier, operator action and timestamps under one incident ID.','Smallx')],
 [P('Human accountability','Smallx'),P('Critical incidents require verification and an authorised decision. Simulation notifications must remain visibly mock.','Smallx')]], [42*mm,128*mm]), PageBreak()]

story += [P('4. Sensing, zones and signal-control sequence','H1x'), P('The visual model should show balanced, lane-centred approach detection on both sides of the road, CCTV in incoming and outgoing directions, stop lines at the crossing edge, and clearly labelled speed measurement zones. The 40 m range is a design assumption until calibrated on site.','Bodyx')]
story += [table([[P('Detection / control element','Smallx'),P('Expected behaviour','Smallx'),P('Acceptance evidence','Smallx')],
 [P('Approach radar / CCTV','Smallx'),P('Detect vehicles in the correct lane and direction before the stop line; do not place the zone over the centreline or crossing.','Smallx'),P('Surveyed geometry, replay test, false-positive/negative results.','Smallx')],
 [P('Speed measurement','Smallx'),P('Capture approach speed before the conflict zone; vehicle card displays current speed while moving.','Smallx'),P('Calibrated reference vehicle and timestamped record.','Smallx')],
 [P('Stop line / marked crossing','Smallx'),P('Define the protected conflict boundary and the point at which vehicles must stop.','Smallx'),P('Lane marking and controller-state test.','Smallx')],
 [P('Traffic signal','Smallx'),P('Remain vehicle-green until demand is accepted, then transition to amber/all-red; remain red while pedestrian is in the crossing and until walk timer completes.','Smallx'),P('State-machine trace with pedestrian entry/exit and timeout.','Smallx')],
 [P('Pedestrian timing','Smallx'),P('WAIT countdown before release; WALK countdown while crossing; clearance interval before vehicle release. Degraded input may still grant a request through the physical/request button under conservative timing.','Smallx'),P('Timing tolerance test, accessibility test, degraded-mode test.','Smallx')]], [41*mm,80*mm,49*mm]), Spacer(1,6*mm), P('Reference sequence','H2x'), P('IDLE → VEHICLE GREEN → pedestrian demand accepted → amber → all-red clearance → WALK (vehicles held RED) → pedestrian clears → clearance/verification → vehicle GREEN. Any conflict, emergency vehicle, sensor disagreement or critical violation forces the approved hold state and operator review.','Bodyx'), PageBreak()]

story += [P('5. Emergency, degraded and critical-event handling','H1x'), P('Emergency vehicle priority is a safety-critical extension, not an automatic entitlement. A detected emergency approach must be confirmed, bounded and coordinated with the controller. The simulation may show the sequence and mock notifications, but it must not dispatch responders.','Bodyx')]
story += [table([[P('Condition','Smallx'),P('Controller response','Smallx'),P('Review / notification','Smallx')],
 [P('Emergency vehicle approaching','Smallx'),P('Maintain current protected crossing until safe; clear conflicting movement, hold all-red as needed, then provide a time-bounded priority path in the correct lane and direction.','Smallx'),P('Operator verifies detection and records the priority transition.','Smallx')],
 [P('Unreliable AI input / degraded mode','Smallx'),P('Accept an authorised pedestrian request button; use conservative fixed timings, stop traffic, grant WALK, then return to verification before release.','Smallx'),P('Log degraded reason, input health, timing profile and recovery.','Smallx')],
 [P('Vehicle fire, smoke or explosion','Smallx'),P('Immediate all-red/hold, protect the crossing, render the fire indicator in the simulation and prevent normal resumption.','Smallx'),P('Critical incident: mock queues for MPAJ, police, fire/rescue and medical liaison; human verification required.','Smallx')],
 [P('Sensor conflict / stale reading','Smallx'),P('Reject stale data and enter approved fallback plan; never infer a safe permissive state.','Smallx'),P('Health event and audit trail; maintenance ticket.','Smallx')]], [42*mm,80*mm,48*mm]), PageBreak()]

story += [P('6. Cybersecurity, privacy and governance','H1x'), P('The simulator handles operationally sensitive concepts even when it is not connected to live infrastructure. Controls should therefore be designed as if the event records may later be reviewed by an authority, while retaining strict minimisation.','Bodyx')]
story += [table([[P('Control','Smallx'),P('Minimum requirement before pilot','Smallx'),P('Status','Smallx')],
 [P('Identity and access','Smallx'),P('Server-side session, role separation, secure secret storage, rate limiting, logout and access audit.','Smallx'),P('<font color="#b42318"><b>GAP</b></font>','Smallx')],
 [P('Transport / deployment','Smallx'),P('HTTPS, dependency scan, locked build, environment separation and rollback path.','Smallx'),P('<font color="#b42318"><b>GAP</b></font>','Smallx')],
 [P('Privacy','Smallx'),P('No ANPR, face recognition or identity inference; blur/avoid raw imagery; retention and deletion schedule approved.','Smallx'),P('<font color="#b42318"><b>GAP</b></font>','Smallx')],
 [P('Auditability','Smallx'),P('Immutable-ish event chain: incident ID, event sequence, actor, timestamp, state transition and export hash.','Smallx'),P('<font color="#b42318"><b>GAP</b></font>','Smallx')],
 [P('External notification','Smallx'),P('Mock-only recipients until authority, legal, security and responder interface approvals exist.','Smallx'),P('<font color="#087f72"><b>CONTROLLED</b></font>','Smallx')]], [36*mm,106*mm,28*mm]), PageBreak()]

story += [P('7. Mandatory gap register','H1x'), P('The following gaps prevent a live or limited-production decision. Owners and closure evidence must be named in the project gate record.','Bodyx')]
gaps=[('G-01','Field geometry and lane survey','Confirm stop lines, lane-centred detection zones, 40 m range and CCTV sightlines.','Authority + traffic engineer','Red'),('G-02','Signal-controller interface','Define approved interface, fail-safe states, timing limits and independent interlock.','Controls engineer','Red'),('G-03','Pedestrian timing validation','Test WAIT/WALK/clearance timing, button demand and degraded input.','Safety + accessibility lead','Red'),('G-04','Emergency priority procedure','Approve detection, confirmation, priority path and recovery sequence.','Emergency services + authority','Red'),('G-05','Cybersecurity test','Threat model, SAST/DAST, dependency review, secrets and session test.','Security lead','Red'),('G-06','Privacy impact assessment','Confirm no identity inference, evidence minimisation and retention/deletion.','Privacy officer','Amber'),('G-07','Evidence chain','Hash/export, clock synchronisation, audit immutability and report reconciliation.','Platform lead','Red'),('G-08','Operational procedures','Training, roles, escalation, maintenance, incident and rollback playbooks.','Operations lead','Amber'),('G-09','Pilot consent and approvals','Signed site, authority, school and responder approvals; public communication.','Programme owner','Red'),('G-10','Independent safety assurance','Independent review of hazard log, test results and residual risk.','Assurance lead','Red')]
rows=[[P('ID','Smallx'),P('Gap','Smallx'),P('Closure evidence','Smallx'),P('Owner','Smallx'),P('Priority','Smallx')]]
for a,b,c,d,e in gaps: rows.append([P(a,'Smallx'),P(b,'Smallx'),P(c,'Smallx'),P(d,'Smallx'),P(f'<font color="{RED if e=="Red" else "#a86b00"}"><b>{e}</b></font>','Smallx')])
story += [table(rows,[14*mm,35*mm,78*mm,30*mm,18*mm],font=6.5), PageBreak()]

story += [P('8. Verification, pilot and release gates','H1x'), table([[P('Gate','Smallx'),P('Scope','Smallx'),P('Exit evidence','Smallx')],
 [P('FAT','Smallx'),P('Simulator logic, all violation sequences, timing and PDF/event reconciliation.','Smallx'),P('Automated test report, traceable event records, no critical failures.','Smallx')],
 [P('Calibration','Smallx'),P('Site geometry, speed/range, lane direction and CCTV/radar placement.','Smallx'),P('Signed survey and calibration record.','Smallx')],
 [P('SAT / shadow mode','Smallx'),P('Observe without controlling live signals; compare detections and timing.','Smallx'),P('False positive/negative report and hazard review.','Smallx')],
 [P('Cyber/privacy review','Smallx'),P('Threat model, penetration testing, privacy impact and retention controls.','Smallx'),P('Accepted findings or risk sign-off.','Smallx')],
 [P('Controlled pilot','Smallx'),P('Restricted site, supervised operator, emergency fallback and daily review.','Smallx'),P('Pilot safety case, incident log, rollback rehearsal.','Smallx')],
 [P('Limited production','Smallx'),P('Only after authority acceptance and independent assurance.','Smallx'),P('Signed go/no-go with residual risk and monitoring plan.','Smallx')]], [27*mm,72*mm,76*mm]), Spacer(1,8*mm), P('Readiness decision','H2x')]
decision_rows=[[P('Decision','Smallx'),P('Assessment','Smallx')],[P('<b>Not Ready</b>','Smallx'),P('Selected. Mandatory blockers include field calibration, signal interface assurance, emergency procedure approval, cybersecurity/privacy evidence and independent safety assurance.','Smallx')],[P('Ready for Controlled Pilot','Smallx'),P('Not supported until Red gaps are closed and the shadow-mode gate passes.','Smallx')],[P('Ready for Limited Production','Smallx'),P('Not supported; requires authority acceptance, completed pilot and signed residual-risk decision.','Smallx')]]
story += [table(decision_rows,[55*mm,120*mm]), PageBreak()]

story += [P('9. Required approvals and conclusion','H1x'), P('Before deployment beyond simulation, the programme should obtain documented approval from the road authority, site owner/school where relevant, safety assurance lead, cybersecurity lead, privacy officer and the authorised emergency-service liaison. The notification workflow must remain explicitly mock until those interfaces are approved and tested.','Bodyx'), P('Conclusion','H2x'), P('SmartCross is a strong demonstrator for deterministic pedestrian-priority logic, visualised detection zones, violation replay and evidence-led review. It is not yet a deployable traffic-control product. The correct next step is to close the mandatory gap register through FAT, site calibration, shadow mode and an independently reviewed controlled pilot.','Bodyx'), Spacer(1,10*mm), Table([[P('<b>Release rule</b>','Smallx'),P('No live connection, signal command, responder notification or enforcement use until the selected gate is signed by the accountable authority and safety assurance owner.','Smallx')]], colWidths=[32*mm,143*mm], style=TableStyle([('BACKGROUND',(0,0),(0,0),NAVY),('TEXTCOLOR',(0,0),(0,0),colors.white),('BACKGROUND',(1,0),(1,0),MINT),('BOX',(0,0),(-1,-1),0.6,TEAL),('VALIGN',(0,0),(-1,-1),'TOP'),('PADDING',(0,0),(-1,-1),8)])), Spacer(1,15*mm), P('End of assessment • evidence should be refreshed when the as-built baseline, deployment target or authority requirements change.','Smallx')]

doc=SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=17*mm, bottomMargin=18*mm, title='SmartCross Pre-Deployment Assessment', author='SmartCross engineering')
doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUT.resolve())
