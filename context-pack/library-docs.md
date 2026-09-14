# Library Docs

## Approved Libraries

| Library | Category | Purpose / Notes | Docs |
| --- | --- | --- | --- |
| Next.js App Router + TypeScript | Frontend | UI frameworks and styling | Official docs required before use. |
| Tailwind CSS | Frontend | UI frameworks and styling | Official docs required before use. |
| shadcn/ui | Frontend | UI frameworks and styling | Official docs required before use. |
| Node.js + Express | Backend / API | Server frameworks and runtimes | Official docs required before use. |
| PostgreSQL | Database | Data storage | Official docs required before use. |
| Prisma | ORM / DB Access | Database interaction layers | Official docs required before use. |
| Node.js crypto + Next.js cookies | Auth | Local demonstration access only; signed HTTP-only cookie, no added dependency | [Next.js authentication guidance](https://nextjs.org/docs/app/guides/authentication) |
| Zod | Validation | Input and schema validation | Official docs required before use. |
| Vitest | Testing | Test frameworks and tools | Official docs required before use. |
| Playwright | Testing | Test frameworks and tools | Official docs required before use. |
| Vercel | Deployment | Hosting and CI/CD | Official docs required before use. |
| Node.js script | Automation / Scripts | CLI tools, cron, services | Official docs required before use. |
| GitHub Actions | Automation / Scripts | CLI tools, cron, services | Official docs required before use. |
| Serverless function | Automation / Scripts | CLI tools, cron, services | Official docs required before use. |

## Installation Notes
Install with the project's standard package manager, pinning versions:

- Next.js App Router + TypeScript
- Tailwind CSS
- shadcn/ui
- Node.js + Express
- Prisma
- Zod
- Vitest
- Playwright

Platforms and services (configured, not installed as packages):

- PostgreSQL
- Vercel
- Node.js script
- GitHub Actions
- Serverless function

Rules:

- Pin exact or caret-bounded versions; commit the lockfile.
- Record any newly added dependency in this file before using it.

## Usage Rules
- Use only libraries listed in this file; propose additions by updating the Approved Libraries table first.
- Prefer the standard library or existing dependencies over adding new ones.
- Read the official docs for each library before first use; do not guess APIs.

## Optional Context Tools

Local, no-API tools enabled for this project. Use each only at the moment described — reflexive use wastes time and tokens.

### Codebase graph / report
- What: generates architecture and dependency maps. Selected tooling: `npx madge --image graph.svg src/` or `npx dependency-cruiser src` (or Graphify — https://graphify.net).
- Use when: verifying module boundaries before a refactor, or orienting in an unfamiliar area of the codebase.
- Don't: regenerate per change, or paste raw graph output into context — summarize the relevant slice.

### Mermaid CLI — diagram validation
- What: validates and renders Mermaid locally (`npx @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.svg`).
- Use when: a diagram in `architecture.md` or `build-plan.md` was edited.
- Don't: render on every read — validation is only needed after a change.

### markdownlint-cli2 — context file hygiene
- What: lints/formats markdown locally (https://github.com/DavidAnson/markdownlint-cli2; `npx markdownlint-cli2 "*.md"`).
- Use when: after editing any file in this context pack.
- Don't: lint the whole repository's markdown as part of this pack's checks.

### Token counter — context size checks
- What: local token estimation (e.g. a tiktoken script or `npx gpt-tokenizer`).
- Use when: a context file grows past roughly 1,500 words or starts repeating itself.
- Don't: micro-optimize short files — the budget applies to the pack, not to every line.

## Rejected Libraries

| Library | Reason Rejected | Alternative |
| --- | --- | --- |
| _None rejected yet_ | _No rejected libraries were specified during planning._ | _—_ |

Do not introduce a rejected library without recording a new decision in `progress-tracker.md`.
