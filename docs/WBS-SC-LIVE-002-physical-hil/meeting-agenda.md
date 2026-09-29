# Physical HIL Blocker-Closure Meeting Agenda

Meeting status: template; no meeting or approval is implied.

## Meeting details

- Meeting ID: TBD
- Date/time and timezone: TBD
- Chair: Physical HIL readiness coordinator - TBD
- Recorder: Evidence custodian - TBD
- Required attendees: project owner, authorised MPAJ representative, traffic-signal safety engineer, physical-HIL test lead, electrical/bench engineer, vendor representatives, IoT integration engineer, cybersecurity assessor, privacy/legal owner, QA lead and configuration manager.

## Purpose and decision boundary

Review every blocker for the target milestone **Ready for Independent Entry-Gate Review**. This meeting cannot declare Physical HIL Passed, approve roadside connection or authorise go-live.

## Pre-read

1. Physical HIL master plan.
2. Blocker-closure action register.
3. Requirements-to-test traceability matrix.
4. Equipment and interface register.
5. Approval and evidence register.
6. Software-only HIL rehearsal record.
7. Vendor questionnaire responses and proposed bench diagram, if available.

## Agenda

| Time | Topic | Lead | Required output |
|---|---|---|---|
| 00:00 | Safety moment, authority and no-roadside boundary | Traffic-signal safety engineer | Boundary acknowledged |
| 00:10 | Baseline and configuration status | Configuration manager | Baseline gaps recorded |
| 00:20 | APP-01 to APP-09 approval status | Coordinator | Named owners and due dates |
| 00:35 | Vendor protocol and firmware dossier | Vendor/IoT leads | Questionnaire gaps and actions |
| 00:50 | Bench inventory, wiring and isolation | Electrical/bench engineer | Inspection date and evidence plan |
| 01:10 | Cybersecurity and privacy controls | Cyber/privacy leads | Approval evidence plan |
| 01:25 | Durable audit, backup and restore | Evidence custodian | Storage test owner and date |
| 01:40 | Traceability, witnesses and entry/exit classification | QA lead | Review and future witness assignments |
| 01:55 | Rollback plan and stop-work readiness | Test lead | Approved procedure, prerequisites and future execution date |
| 02:10 | Review every BLOCKED action | Coordinator | Updated status, owner, target date |
| 02:25 | Candidate decision | Independent reviewer | BLOCKED or eligible for independent review |

## Mandatory questions

- Is every approval scoped, signed, dated and independently attributable?
- Do model, firmware and protocol records match the proposed physical assets?
- Is there objective proof of electrical and network isolation from public infrastructure?
- Can emergency stop, fail-safe and rollback be demonstrated without losing audit evidence?
- Does every simultaneous-feature case expect exactly one deterministic safe decision?
- Can every evidence item be retrieved and its digest verified?
- Are executed physical results, repeats and rollback proof reserved for HIL exit rather than used as circular entry prerequisites?

## Minutes and actions

Record decisions, dissent, hazards, action IDs, responsible roles, target dates and evidence locations. Blank or verbal-only items remain BLOCKED.
