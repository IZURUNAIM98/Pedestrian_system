# RT-HIL-001 Stage 16 Verification Record

Date: 2026-09-24. Runtime: Node.js v24.14.0; npm 11.9.0; Next.js 16.3.1; TypeScript 5.9.3; Zod 4.3.6; Vitest 4.1.11.

| Check | Command | Result |
|---|---|---|
| Closure-deficiency plus affected target suite | `npm.cmd exec vitest run tests/rt-hil-001-closure-deficiencies.test.ts tests/observation-fusion.test.ts tests/live-integration-hil-rehearsal.test.ts tests/live-integration.test.ts tests/safety-orchestrator.test.ts` | PASS, 5 files and 71 tests |
| Complete regression | `npm.cmd test` | PASS, 14 files and 167 tests |
| TypeScript | `npm.cmd run typecheck` | PASS |
| ESLint | `npm.cmd run lint` | PASS |
| SmartCross integrity | `npm.cmd run verify:smartcross-2.2-lock` | PASS, 55 files |
| Text standard | `npm.cmd run validate:text` | PASS, 215 files after evidence-package completion and before candidate-manifest creation |
| Production build | `npm.cmd run build` | PASS, 9 of 9 static pages generated |

Regression coverage retains the Normal 20-condition and School 21-condition catalogues, pedestrian occupancy precedence, opposing-emergency safe hold, heavy-traffic pedestrian protection and degraded-mode safety. No physical, roadside, deployment, commit or push action occurred.
