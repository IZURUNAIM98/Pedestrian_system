# Isolated Bench Inspection Checklist

Checklist status: unexecuted template. `PASS` requires objective evidence and authorised witnesses.

## Identification and baseline

- [ ] Run ID, date, location and authorised personnel recorded.
- [ ] Equipment register matches every physical item and firmware.
- [ ] Software/configuration hashes match the approved HIL manifest.
- [ ] Calibration certificates are current and traceable.
- [ ] Approved wiring drawing and point-to-point schedule are present.

## Physical and electrical isolation

- [ ] No cable reaches a roadside cabinet, operational signal or public infrastructure.
- [ ] All outputs terminate at the approved load bank/state monitor.
- [ ] Isolation devices and ratings match APP-05.
- [ ] Continuity, polarity, earthing, fusing and voltage/current limits verified.
- [ ] Emergency-stop design, rating, wiring and pre-energisation inspection method are approved; its executed performance test is reserved for HIL exit.
- [ ] Lockout/tagout and safe energisation procedure available.
- [ ] Photographs show connectors, isolation boundary, labels and terminations.

## Network isolation and security

- [ ] Dedicated offline/default-deny network confirmed.
- [ ] No Internet, production VPN, wireless bridge or operational route exists.
- [ ] Allowed ports/services match the approved topology.
- [ ] Device identities and certificates match the register.
- [ ] Temporary credentials are controlled and excluded from evidence.
- [ ] Packet capture confirms only approved endpoints/protocols.

## Signals, timing and read-back

- [ ] Initial physical state is approved all-red/WAIT or de-energised safe state.
- [ ] Every output channel maps to the intended load/read-back channel.
- [ ] Independent feedback distinguishes STOP, AMBER, GO, WAIT and WALK.
- [ ] Clock source, offset and drift are within approved bounds.
- [ ] Silence, missing feedback and unknown state are not interpreted as safe.

## Audit and recovery

- [ ] Append-only evidence service and signed/hash-linked record design are provisioned for the campaign.
- [ ] Access-control, tamper-detection, capacity, backup and restore procedures are approved; executed results are reserved for HIL exit.
- [ ] Rollback image and written recovery procedure are locally available.
- [ ] Emergency-stop and rollback tests have named future witnesses and approved procedures; executed results are reserved for HIL exit.

## Evidence explicitly reserved for HIL exit

Do not require the following to pass this entry inspection: executed signal sequences, deterministic repeat results, measured emergency-stop performance, power/network recovery outcomes, completed rollback drill, campaign audit records or campaign backup/restore results.

## Inspection disposition

- Result: PASS / FAIL / BLOCKED
- Unresolved action IDs: TBD
- Evidence paths and hashes: TBD
- Electrical/bench engineer: TBD
- Traffic-signal safety engineer: TBD
- Cybersecurity assessor: TBD
- Independent QA witness: TBD
- UTC completion date: TBD

Any unchecked mandatory item prevents isolated physical output enablement.
