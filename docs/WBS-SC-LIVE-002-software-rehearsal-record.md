# WBS-SC-LIVE-002 Software-Only HIL Rehearsal Record

Execution date: 2026-09-22

## Authority and boundary

The project owner authorised proceeding with the next procedure. The procedure executed here is limited to deterministic replay in the local software test environment. Test-fixture evidence is not presented as external approval. No vendor device, bench controller, roadside controller, public-road network, external agency, production deployment, or physical output was connected.

## Procedure executed

1. Require every HIL entry-check category before accepting a rehearsal run.
2. Load timestamped replay observations through the observation guard.
3. Reject stale, duplicate and out-of-order observations.
4. Convert rejected observations to `DEGRADED_SAFE_HOLD` with vehicle STOP and pedestrian WAIT.
5. Evaluate accepted frames through the deterministic safety resolver.
6. Produce hash-linked shadow records and verify the chain.
7. Assert that no frame attempts physical actuation.

## Results

| Test | Result |
|---|---|
| Incomplete evidence blocks execution | PASS |
| Nominal replay produces deterministic records | PASS |
| Records are linked by the previous hash | PASS |
| Duplicate observation fails closed | PASS |
| Stale observation fails closed | PASS |
| Rejected data cannot release pedestrian WALK | PASS |
| Physical actuation attempted | NO |

## Current gate state

`SOFTWARE REHEARSAL PASSED - PHYSICAL HIL BLOCKED`

The owner authorisation item is recorded as received for continued preparation. The following remain external dependencies and are not inferred from that authorisation:

- MPAJ and qualified traffic-signal engineer safety approval.
- Vendor protocol and failure-mode package.
- Verified isolated bench or approved emulator.
- Cybersecurity and privacy approvals.
- Durable append-only audit storage.
- Approved rollback drill and physical isolation evidence.

No integrity-lock refresh or deployment was performed.
