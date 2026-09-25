# Stage 17 `-04` baseline binding specification

Candidate: `RT-HIL-001-STAGE17-TRANSFER-20260925-04`

## Declared repository relationship

- Intended parent commit: `b0938e7c47302585837e34a10f0298255c732d4d`.
- Inherited repository files are permitted in the Git tree but are outside the 77-file candidate payload boundary.
- The 77 candidate payload files must remain byte-identical to `RT-HIL-001-STAGE17-TRANSFER-20260924-03`.
- Candidate metadata and repository-scoped verification tools are controlled separately by `baseline-binding-manifest.json`.

## Hash boundaries and verification order

1. Verify `baseline-binding-manifest.json` against `baseline-binding-manifest.sha256`.
2. Verify every metadata/tool file listed in `controlledMetadata`.
3. Verify `candidate-manifest.json` against both its hash in the binding manifest and `candidate-manifest.sha256`.
4. Verify all 77 payload paths against `candidate-manifest.json`.
5. Run controlled containment and controlled text validation only across paths listed by `candidate-manifest.json`.
6. Run targeted tests, regression tests, typecheck, lint, candidate-lock verification and the production build.
7. Repeat binding, payload-manifest and containment verification after the build.

The binding manifest does not hash itself. Its detached SHA-256 controls it and prevents self-reference. The binding manifest does not list its detached hash because that would create a second self-reference. Both files are transfer-controlled by the outer transfer manifest and detached ZIP checksum.

## Inclusion and exclusion rules

- Payload inclusion: exactly the 77 paths in `candidate-manifest.json`.
- Metadata/tool inclusion: exactly the paths in `baseline-binding-manifest.json` under `controlledMetadata`.
- Containment inspection: manifest-listed `.js`, `.json`, `.mjs`, `.ts` and `.tsx` payload files.
- Text validation: manifest-listed files with the extensions declared by `validate-controlled-text.mjs`.
- Excluded from candidate-scoped checks: inherited repository files not listed by the payload manifest; generated `.next`, `node_modules` and `tsconfig.tsbuildinfo`; Git metadata; transfer evidence outside the committed baseline.

The legacy `npm run verify:containment` and repository-wide `npm run validate:text` remain byte-identical payload artifacts from `-03`. For the repository-compatible `-04` baseline, the authoritative scoped commands are `node scripts/verify-controlled-containment.mjs` and `node scripts/validate-controlled-text.mjs`.

## Governance status

**Three technical `-02` findings closed; formal Stage 17 closure deferred pending authoritative artifacts.**

This package does not authorise physical HIL, roadside integration, deployment or live operation.
