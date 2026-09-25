# SmartCross

Simulation-only smart pedestrian-crossing prototype for Ampang Jaya. It models animated normal and school crossings with one no-violation baseline plus 20 shared driver and motorist violation cases, mirrored 40 m eastbound and westbound speed-detection zones, incoming and outgoing CCTV feeds on both approaches (40 m detection range), seven visible chronological stages per condition, a shared real-time traffic-light countdown with a verified 12-second protected-WALK window, safe traffic-signal responses, action-synchronised event records, PDF reporting, and a keyboard-accessible seven-stage simulation sequence. An emergency-priority mode demonstrates validated ambulance, police, and fire/rescue passage with pedestrian protection, conflicting-traffic clearance, and controlled recovery.

When simulated camera health falls below 75%, the normal camera-driven path is isolated and a pedestrian-actuated fallback becomes available. One request is latched, duplicate presses are ignored, and a conservative 15-second WALK is issued only after the simulated controller, radar, LiDAR, stop-line, and vehicle-presence checks establish RED and all-red protection. Any disagreement enters Safety Hold. Healthy-camera scenarios are unchanged.

## Safety boundary

This application uses local mock data. It does not connect to CCTV, roadside sensors, MPAJ systems, physical traffic lights, enforcement, or emergency services. A pedestrian `WALK` is only produced when conflicting vehicles are `STOP`. Critical events require explicit human confirmation and never dispatch responders.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:3100`.

The root route redirects anonymous visitors to `/access`. Demonstration credentials are configured in the ignored `.env.local` file and validated only by the server. This gate is suitable for a controlled prototype, not production identity or authorisation.

## Verification

```bash
npm run verify:smartcross-2.2-lock
npm run validate:text
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright install chromium
npx playwright test
```

`smartcross-2.2.lock.json` pins the exact SmartCross application, shared runtime, and contract-test files in this repository by SHA-256. The legacy filename and `/smartcross-2-2` route remain unchanged for compatibility. Phase 2 files are deliberately excluded so that work can continue independently. The deployment-bundle builder verifies this lock first and stops if a locked file has drifted; refreshing the manifest is an explicit owner-reviewed action.

The permanent English and UTF-8 rules, including runtime handling for imported, database-derived and AI-generated text, are documented in [docs/language-and-encoding-standard.md](docs/language-and-encoding-standard.md).

Accessibility commitments, evidence governance and potential MPAJ operational responsibilities are documented in [docs/accessibility-governance-and-mpaj-responsibilities.md](docs/accessibility-governance-and-mpaj-responsibilities.md).

## AIM and Bloom execution model

- Actor: MPAJ operators, planners, safety officers, testers, and demonstration users.
- Input: Crossing mode and deterministic scenario.
- Mission: Explain and trace a safe simulated response without implying live operational control.
- Bloom: remember the boundary, understand the inputs, apply a scenario, analyse seven chronological stages, evaluate the safety response, and create an offline report.

## Deployment

Production is published at `https://smartcross-v2-pedestrian-simulator.vercel.app/`. The demonstration login does not change the simulation-only boundary or connect the prototype to live systems.
