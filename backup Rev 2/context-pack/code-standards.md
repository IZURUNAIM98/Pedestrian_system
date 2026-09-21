# Code Standards

## Agent Role
Senior full-stack smart-city safety product engineer

## Language & Framework
- Frontend: Next.js App Router + TypeScript, Tailwind CSS, shadcn/ui
- Backend: Node.js + Express
- Validation: Zod
- Testing: Vitest, Playwright

## Principles
- Plan before coding and preserve all existing functionality. Build the simulation-only MVP first using local mock data. Prioritise normal pedestrian crossings and school crossings in Ampang Jaya; exclude four-way junction scenarios. Use strongly typed TypeScript, reusable accessible components, responsive layouts, validated data models, and clear separation between detection, traffic-signal response, violations, incidents, alerts, and timeline stages. Do not connect to live MPAJ infrastructure, CCTV, IoT sensors, emergency services, or physical traffic lights. Treat AI outputs as simulated results, display confidence and safety disclaimers, and verify each feature before continuing. Keep the interface calm, trustworthy, readable, and suitable for future production use.

## Agent Token Discipline
- Do not load every context file blindly — follow the Context Usage Strategy in `project-overview.md`.
- Summarize the relevant section of a file before editing it; never paste whole files into working context.
- Reference only the context relevant to the current phase or task.
- If a required decision is missing from these files, ask before implementing — do not assume.
- Keep context files small when updating them: tables over prose, no instruction repeated across files, no restating what another file already says.

## Typing Rules
- Use strongly typed code; avoid `any` / untyped values.
- Model domain data with explicit types or schemas; no loose object shapes at module boundaries.
- Prefer pure, testable functions for business logic.

## Component Rules
- Keep components small, single-purpose, and composable.
- Separate presentational components from data/state logic.
- Reuse design-system primitives (see `ui-registry.md`) before creating new components.
- Co-locate component-specific styles and tests with the component.

## State Management Rules
- Prefer local component state; lift state only when shared.
- Derive values instead of duplicating state.
- Persist long-lived drafts deliberately (e.g., browser storage), and validate persisted data on load.

## Form & Validation Rules
- Validate all external and imported data at the boundary using Zod.
- Fail with clear, actionable error messages; never silently coerce bad input.

## Configuration Rules
- Read configuration only from variables and sources listed in `architecture.md` -> `Configuration`.
- Do not add environment variables, config keys, CLI flags, tfvars, scheduler settings, or secrets without updating `architecture.md`.
- Never log or expose values marked secret.

## Error Handling Rules
- Handle expected failures explicitly; never swallow errors without logging.
- Surface user-facing errors in plain language; keep technical detail in logs.
- Use appropriate exit codes / status codes for failures.

## File Naming Rules
- kebab-case for files and directories.
- Name files after the single thing they export.
- Keep one logical unit (component, module, schema) per file.

## Testing Rules
- Every feature ships with tests covering the happy path and at least one failure path.
- Use Vitest, Playwright as the test toolchain.
- Pure logic gets unit tests; user-critical flows get end-to-end coverage.

## Verification Commands
```bash
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright test
```

## Definition of Done
The Lintas AI Ampang Jaya simulator runs locally without errors and delivers the complete MVP. It supports normal and school crossing scenarios, moving vehicles and pedestrians, traffic-violation simulation, intelligent signal responses, incident alerts, and the seven-stage event timeline: Approach, Initiation, Detected, Escalation, Conflict, Response, and Outcome. All pages are responsive, accessible, readable, and consistent with the approved design system. Simulation-only boundaries and safety disclaimers are visible. Code passes linting, type checking, unit tests, browser tests, and the production build.

## Build Discipline
- Update `progress-tracker.md` after every implementation change.
- Record significant decisions in the Decision Log of `progress-tracker.md`.
