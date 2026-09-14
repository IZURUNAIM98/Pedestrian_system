# AGENTS.md — How To Use This Context Pack

This folder is the generated context pack for **Lintas AI Link 2 – Seven-Stage Event Timeline Upgrade** (Full Application). It was produced by Context Editor from a structured project brief — deterministic generation, no AI calls. Read it before writing any code.

## Reading Order

| # | File | Purpose |
| --- | --- | --- |
| 1 | `project-overview.md` | Scope, users, success criteria, constraints |
| 2 | `architecture.md` | Stack, data flow, structure, security, operations |
| 3 | `data-model.md` | Data contracts, payloads, schemas, variables, and outputs |
| 4 | `code-standards.md` | Conventions, verification commands, definition of done |
| 5 | `build-plan.md` | Phased implementation order and acceptance criteria |
| 6 | `library-docs.md` | Approved and rejected dependencies |
| 7 | `ui-tokens.md` / `ui-rules.md` / `ui-registry.md` | Interface rules — read before any UI or output work |
| 8 | `progress-tracker.md` | Living status journal — update after every change |

## Operating Rules
- Build only what `project-overview.md` lists under **MVP Scope**; never implement anything under **Out of Scope**.
- Follow `code-standards.md` and run its verification commands before declaring any phase done.
- Work in the phase order defined in `build-plan.md`, starting with Phase 0.
- Update `progress-tracker.md` (status, decisions, change log) after every implementation change.

## Enabled Context Tools
- codebase graph / dependency report (`npx madge --image graph.svg src/` or `npx dependency-cruiser src` (or Graphify — https://graphify.net))
- Mermaid CLI diagram validation
- markdownlint-cli2 for context files
- token budget discipline

All local, no API calls. Usage rules — when to use each and when not to — are in `library-docs.md` under Optional Context Tools.
