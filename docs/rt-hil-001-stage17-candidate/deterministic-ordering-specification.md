# RT-HIL-001 Deterministic Ordering Specification

Candidate date: 2026-09-24

Each replay frame is a closed observation set. It is canonically ordered before sequence validation or fusion by: `observedAt`, `receivedAt`, fixed `DEVICE_KINDS` priority, `sourceId`, `sequence`, then canonical payload text. Array insertion order is never a tie-breaker.

An observation enters the frame when supplied to `fuseValidatedObservations`; the frame closes synchronously when that call begins. No temporal waiting or inferred trusted-time window is implemented. Observations older than `staleDataTimeoutMs`, more than 250 ms in the future, or with `receivedAt < observedAt` fail closed. A late event is rejected as stale. Duplicate or non-increasing per-source sequences fail closed. Equal timestamps use the remaining canonical keys. If the complete ordering/validation cannot be resolved, the frame produces vehicle STOP and pedestrian WAIT.

Sequence state is transactional: it is committed only if the complete canonical batch passes observation validation. A rejected batch therefore cannot poison the next valid batch. This ordering rule is software-only and does not close RT-HIL-007 trusted time.
