# SmartCross Event Log Assurance Record

Date: 2026-09-21

## OODA, Bloom, and Simpson trace

| Lifecycle | Evidence |
|---|---|
| Observe / Remember / Perception | Baseline log and scenario event contracts frozen before editing. |
| Orient / Understand-Analyse / Set | Operator questions, engineering evidence, and invariant boundaries classified. |
| Decide / Evaluate / Guided Response | One reusable event-card template and severity policy selected. |
| Act / Apply-Create / Mechanism-Origination | Operator and Technical views, filters, tests, and traceability implemented. |

## Severity-to-detail and action policy

| Severity | Operator evidence | Permitted action |
|---|---:|---|
| Normal | None unless opened in Technical View | No action required |
| Monitoring | Up to 1 decision-relevant fact | Monitor |
| High | Up to 3 facts | Check CCTV or Manual review required |
| Critical / Emergency | Up to 5 safety-critical facts | Acknowledge or Emergency response initiated |

All raw evidence remains in each card's technical disclosure and the dedicated Technical View.

## Red Team findings register and DRAG closure

| ID | Scenario | Expected | Actual baseline | Severity | Evidence / reproduction | Component | DRAG amendment | Closure |
|---|---|---|---|---|---|---|---|---|
| RT-EL-001 | All | Rapid operator comprehension | Dense raw engineering sentence | High | Run any violation and inspect log | EventLog | Derive labelled event cards; retain raw detail | CLOSED |
| RT-EL-002 | All | Operator and engineering needs separated | One undifferentiated view | High | Inspect log controls | EventLog | Add default Operator View and retained Technical View | CLOSED |
| RT-EL-003 | All | Operational filters | Internal pipeline filters only | Medium | Filter options | EventLog | Add All, Traffic, Violation, Pedestrian, Emergency, Safety, System | CLOSED |
| RT-EL-004 | Violation/degraded/emergency | Explicit human action | Action embedded or absent | High | Run representative scenarios | Operator policy | Constrained action vocabulary | CLOSED |
| RT-EL-005 | Heavy traffic | Direction understood | `Both` exposed as engineering value | Medium | Start heavy-traffic simulation | Presentation mapper | Normalise to Both Directions | CLOSED |
| RT-EL-006 | Critical incident | Critical facts visible and full evidence retained | Raw detail visually overloaded | High | Run collision/fire case | Event card | Show up to five facts plus disclosure | CLOSED |
| RT-EL-007 | Cross-feature interaction | One deterministic safety explanation | Separate fields lacked hierarchy | High | Heavy traffic with pedestrian/emergency activity | Event card | Structured response, safety, action, and technical evidence | CLOSED |

Each amendment is presentation-only, governed by unit, type, lint, build, authentication, and existing scenario regression checks. No finding required a state-machine amendment.

## Regression and Closure Team report

The independent closure check must confirm before release:

- Original event count and chronology remain unchanged.
- Operator View is the default and Technical View reproduces original messages.
- Seven-stage timeline remains Approach, Initiation, Detected, Escalation, Conflict, Response, Outcome.
- Normal, School, violation, pedestrian, heavy-traffic, emergency-priority, degraded-sensor, critical incident, recovery, and restoration tests pass.
- STOP-before-WALK and route-clearance invariants pass.
- Authentication still redirects anonymous requests and permits the configured server-side credential flow.
- Production build and post-deployment smoke tests pass.

Final recommendation: **PASS only when every item above has current execution evidence.** Any failed check changes the recommendation to FAIL and returns the affected item to DRAG.
