# Project Overview

## Context Usage Strategy
Read in this order; stop as soon as you have what the current task needs:

1. `project-overview.md` — scope, users, success criteria (this file)
2. `architecture.md` — stack, data flow, structure, security, operations
3. `data-model.md` — entity contracts and schema rules
4. `code-standards.md` — conventions and verification commands
5. `build-plan.md` — the current phase only
6. `library-docs.md` — when adding or using a dependency
7. `ui-tokens.md`, `ui-rules.md`, `ui-registry.md` — before any interface work

Essential context for this project: MVP scope, constraints, data contracts, stack choices, design tokens, build phases.

Read only when relevant:
- `ui-tokens.md`, `ui-rules.md`, `ui-registry.md` — read only when building interface components.
- `progress-tracker.md` history tables — read only the current status and open items.

Build only what is listed under MVP Scope. Anything under Out of Scope must not be implemented. Update `progress-tracker.md` after every change.

Token budget: never load the whole pack at once. Pull the smallest set of sections that answers the current question, and re-read a file only after it changes.

## Project Type
Full Application

## Project Name
Lintas AI Link 2 – Seven-Stage Event Timeline Upgrade

## One-Line Pitch
An enhanced smart-crossing simulator that visualises every incident through a seven-stage, timestamped timeline while preserving Link 2’s existing safety, reporting, and simulation features.

## Problem Statement
Link 2 currently records simulation events but does not provide the clear seven-stage visual progression available in Link 4. Users need a traceable view of how each scenario moves through Approach, Initiation, Detected, Escalation, Conflict, Response, and Outcome. The simulator also needs better proportional use of desktop screen space without weakening existing event logs, incident workflows, safety rules, accessibility, or mobile responsiveness.

## Target Users
MPAJ traffic operators, smart-city planners, road-safety officers, emergency-response coordinators, system testers, project stakeholders, researchers, and authorised public demonstration users.

## Success Criteria
- The MVP is successful when every completed simulation produces seven correctly ordered, timestamped timeline stages and displays 100% completion; the original event log and all incident, emergency, reporting, filtering, and crossing functions remain operational; the desktop simulator uses available width proportionally; mobile screens display without page overflow; the timeline rail supports keyboard navigation; type checking, linting, production builds, contract tests, and focused desktop/mobile interaction tests pass for the updated flow; and deployment to the existing Link 2 address occurs only after the project owner’s approval.

## Constraints
- Modify Link 2 only
- Use Link 4 only as the timeline reference
- Preserve all existing Link 2 features
- Do not replace or remove the original event log
- Maintain deterministic simulation behaviour
- Keep all operations within simulation-only boundaries
- Do not connect to or control live traffic infrastructure
- Do not automatically contact real emergency services
- Display all seven timeline stages in the required order
- Generate a timestamp for every timeline stage
- Show 100% completion only after all seven stages finish
- Preserve existing incident and emergency workflows
- Preserve existing reporting, filtering, and crossing features
- Maintain all current safety rules and invariants
- Use available desktop width proportionally
- Prevent horizontal page overflow on narrow screens
- Maintain responsive mobile behaviour
- Make the mobile timeline keyboard accessible
- Use AIM methodology and Bloom’s taxonomy
- Run automated validation on the changed simulator flow
- Separate new issues from pre-existing test behaviour
- Do not publish without the project owner’s approval
- Deploy only to the existing Link 2 address

## Open Decisions Before Coding
_No blocking open decisions detected._

## MVP Scope

| Feature | Description | Status |
| --- | --- | --- |
| Smart Pedestrian and Vehicle Detection | The simulator detects pedestrians, vehicles, motorcycles, and traffic violations at normal and school crossings. | Planned |
| Intelligent Traffic-Light Response | The traffic signal changes according to pedestrian demand, vehicle movement, crossing status, and detected risks. | Planned |
| Incident Timeline and Emergency Alerts | The system records Approach, Initiation, Detected, Escalation, Conflict, Response, and Outcome stages and alerts MPAJ or first responders during life-threatening incidents. | Planned |

## Out of Scope (For Now)
- Live deployment of physical traffic lights and roadside sensors
- Automatic connection to MPAJ, police, hospital, and fire-rescue systems
- Real-time CCTV, LiDAR, radar, or IoT hardware integration
- Automatic cloud API integration
- AI-based recommendation engine
- Automatic traffic-law enforcement or issuing summonses
- Four-way junction crossing scenarios
- Predictive accident forecasting
- Public user accounts and personal data collection

## Risks Summary
- Simulation results may not represent real-world traffic conditions - validate with field data before operational use.
- Camera or sensor data may produce false detections - include manual review and confidence thresholds.
- Traffic violations may be classified incorrectly - label results as simulation outputs only.
- Emergency alerts may be delayed or inaccurate - require human confirmation before dispatch.
- Heavy rain, poor lighting, and occlusion may reduce detection accuracy - test adverse conditions separately.
- System performance may decrease with many simultaneous vehicles and pedestrians - apply load testing and monitoring.
- The prototype is not connected to live MPAJ infrastructure - clearly display simulation-only boundaries.
- Location and traffic data may be incomplete or outdated - identify data sources and update dates.
- Incorrect signal logic could create safety risks - conduct safety review before any real-world deployment.

See `build-plan.md` for mitigations and `progress-tracker.md` for live status.
