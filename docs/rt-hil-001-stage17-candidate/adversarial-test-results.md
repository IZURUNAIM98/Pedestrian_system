# RT-HIL-001 Adversarial Test Results

Executed 2026-09-24 with Node.js v24.14.0, npm 11.9.0, Vitest 4.1.11 and Zod 4.3.6.

The new closure-deficiency file contains 17 tests. Together with the prior RT-HIL-001 and safety files, the targeted command passed 71 tests in 5 files. Cases cover missing/unsupported schema versions, NaN, infinities, strict unknown fields, empty/oversized/invalid identifiers, source-kind mismatch, camera/radar disagreement, duplicate/reordered/stale/bad receipt time, direct/nested/prototype/constructor-shaped injection, forged shadow input, adapter mismatch, partial malformed batches and valid input after rejection.

Every invalid fusion evaluated through the trusted shadow boundary produced eastbound STOP, westbound STOP and pedestrian WAIT with a stable code and hash-valid rejection trace. Valid complete demand evidence retained protected WALK with both vehicle directions STOP.
