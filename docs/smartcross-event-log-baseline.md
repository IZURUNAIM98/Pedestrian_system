# SmartCross Event Log Baseline

Frozen: 2026-09-21

## Authoritative behaviour retained

- Normal and School crossing scenario catalogues and seven-stage sequences.
- STOP-before-WALK, all-red clearance, crossing-clear verification, and sequential traffic release.
- Emergency priority, degraded-camera manual request, critical incident, heavy-traffic, recovery, and restoration state machines.
- Existing timestamps, IDs, raw messages, CCTV/radar/ANPR evidence, motion, signal states, reports, authentication, and simulation-only boundaries.

## Observed presentation baseline

The event log presented each raw engineering message as a three-column row: timestamp, internal category, and full message. Filtering used internal categories only (`sensor`, `detection`, `controller`, `safety`, `outcome`). Operator status, location, safety meaning, and required action were not independently labelled. Heavy-traffic records already carried structured direction, evidence, action, safety rule, and result fields, but the shared log did not expose that structure.

## Change boundary

This refinement derives an operator presentation from immutable event records. It does not alter event generation, sequence timing, scenario selection, actor motion, signal control, safety orchestration, notification boundaries, or authentication.
