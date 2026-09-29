# SmartCross peak-hour simulation release

## Scope and implementation

Added the independently selectable **Peak-Hour Heavy Traffic and Queue Stabilisation** sequence to both crossing layouts. Existing Normal (20 conditions) and School (21 conditions) catalogues, stable scenario IDs, login gate and server-side credentials remain unchanged.

The pedestrian display now presents separate continuous phases: **Waiting Time** reaches zero, **Safe Signal Transition** shows amber and all-red clearance, and **Walking Time** starts independently at 15 and reaches zero. The pedestrian signal then returns to WAIT while clearance completes, with both vehicle approaches held at STOP until the crossing is clear. Controller events retain the displayed label, value, vehicle phase and resulting signal states for each active timer tick.

The pure controller measures each approach independently, confirms persistent congestion, adapts bounded shared-green windows, retains pedestrian requests, verifies stopped/clear conditions before WALK, completes pedestrian clearance before traffic release, and requires sustained recovery before reporting NORMAL / STABLE. Persistent spaced vehicles travel eastbound left-to-right in the lower lane and westbound right-to-left in the upper lane. Emergency passage waits for active pedestrian clearance. Redundant degraded sensing permits verified fixed-plan service; critical unverifiable sensing holds RED and retains demand.

Four presets, directional demands, arrival frequency, initial queues, timing/persistence controls, sensor health and optional emergency arrival are configurable. Runtime obstruction, late-arrival and occupied-clearance controls demonstrate interlocks. Directional metrics, seven-stage observations, outcome summary and chronological PDF audit are generated from the same controller state. Clearing the visible log does not delete the report evidence.

## Changed files

| File | Purpose |
| --- | --- |
| `lib/heavy-traffic.ts` | Validated configuration, pure state machine, persistent actors, directional evidence and recovery |
| `components/heavy-traffic-panel.tsx` | Configuration, playback, request, fault controls, metrics, timeline and report download |
| `components/dashboard.tsx` | Independent sequence selector |
| `components/crossing-view.tsx` | Peak-hour actors, signal/countdown overrides, health and live caption |
| `components/timeline-rail.tsx` | Accept sequence-specific stage names |
| `app/enhancements.css` | Responsive peak-hour layout and actor styling |
| `lib/pdf-report.ts` | Multipage chronological heavy-traffic PDF |
| `tests/heavy-traffic.test.ts` | Presets, spacing, immutability, wait bounds, clearance, sensing, emergencies and PDF contracts |
| `tests/e2e/heavy-traffic.spec.ts`, `scripts/verify-peak-hour.mjs` | Desktop/mobile queue recovery, countdown/RED protection, sensing, download and authenticated release smoke test |
| `scripts/build-deploy-bundle.mjs` | Include complete new runtime in compact reviewed production bundle |
| `smartcross-2.2.lock.json` | Refresh only reviewed application/test/bundle hashes |
| `context-pack/architecture.md`, `data-model.md`, `ui-registry.md`, `progress-tracker.md` | As-built contracts and execution status |

## Verification

76 unit/regression tests passed; lint and TypeScript passed. Source and independent compact production builds passed. All six focused desktop/mobile tests passed against the compact production bundle. The compact bundle passed authenticated baseline API and complete peak-hour recovery smoke checks, with no browser page errors; mirrored-zone geometry passed both crossing modes at 1400, 1000 and 412 px. A browser-downloaded 48-page full chronological report was rendered and visually reviewed; no extracted text extended outside page bounds. The full audit intentionally includes one observation per direction per simulation second.

Production deployment `dpl_BpFFkv1bhkspof7zhTyvqYHU1GmP` is READY at https://smartcross-v2-pedestrian-simulator.vercel.app/. Live login, authenticated baseline API and stable-recovery browser playback passed; no browser page errors or recent Vercel runtime errors were found. The release contains 22 application/configuration files; private environment files, documentation and the separate Phase 2 application were excluded.

The continuous pedestrian-timer amendment was published in production deployment `dpl_3ZNsY2nwvJWJUcpUECgnuQHjMmZa`. Its validation passed 77 unit/regression tests, lint, typecheck, source and compact production builds, six focused desktop/mobile browser tests, and dedicated live assertions for WAIT `20..0`, amber/all-red transition, WALK `15..0`, protected post-WALK clearance, retained login, stable recovery and zero page errors. Vercel reported READY with no recent runtime errors.

The broader historical browser suite was attempted, but is not reported as passing: its partial run exposed existing ambiguous `Crossing condition` labels and stale `Vehicle signal` accessible-name expectations (the current application uses separate Eastbound/Westbound labels). No unrelated signal behavior was changed to satisfy obsolete expectations. Running the production server on plain HTTP also prevents Playwright's request client from sending the Secure session cookie; the actual browser authenticated API request passes. Existing test-selector edits made for diagnosis were restored. The legacy browser suite needs a separately reviewed refresh before it can serve as a clean release gate.

## Assumptions, limitations and open safety issues

- This is a deterministic local demonstration, not a validated traffic-control or dispatch system. No authority notifications or real infrastructure commands are transmitted.
- Forty metres per approach is the immediate simulated monitoring range. Longer queues are explicitly simulated upstream estimates; no corridor-wide recovery is claimed.
- Provisional defaults: minimum/maximum green 8/20 s, amber 3 s, all-red 2 s, WALK 12 s (15 s in redundant degraded mode), pedestrian clearance 3 s, ordinary maximum request wait 40 s. Critical, emergency and occupied-route holds override the wait bound and are audited.
- Finite peak demand tapers for demonstrable recovery; arbitrary permanently excessive demand is not guaranteed to stabilise. An unfinished 480-second run reports a non-stable outcome.
- Queue distances, occupancy, confidence and emergency identification are synthetic. Rendering shows the monitored actors; upstream queues are labelled estimates. Sensor redundancy assumes adequate complementary evidence, not an unreliable AI input alone.
- Field deployment would require measured geometry, calibrated detectors, statutory timing/design review, verified emergency authorization, fail-safe hardware, independent safety assessment and authority approval. No such approvals are asserted.
