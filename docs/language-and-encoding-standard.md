# Language and character-encoding standard

This project displays English by default using Malaysian/British English conventions and the `en-MY` locale. Approved Malaysian proper nouns, locations, agencies, abbreviations, traffic terms, accessibility symbols and measurement units remain unchanged.

## Permanent requirements

- Save source, content, data, import and configuration files as UTF-8 without a byte-order mark (BOM), normalised to Unicode NFC.
- Next.js owns the document head and emits `<meta charset="utf-8">` from the root layout. The root language is `en-MY`.
- HTML responses must use `text/html; charset=utf-8`. JSON routes explicitly use `application/json; charset=utf-8`.
- All display strings must use the shared functions in `lib/text-standard.ts`. Do not add component-specific encoders, translators, capitalisers or state-humanising functions.
- Pass imported, database-derived or AI-generated payloads through `normaliseTextPayload(value, "import" | "database" | "ai")` before storage or display. Invalid text is rejected; it is never guessed, silently repaired or double-decoded.
- React escapes JSX text automatically. Use `escapeHtmlText` only when text must be serialised into raw HTML outside React. Never pass untrusted text to `dangerouslySetInnerHTML`.
- The approved display character set includes Latin English text and necessary punctuation, `…`, `%`, `&`, traffic units such as `km/h` and `m`, and the accessibility symbol `♿`. Mojibake, replacement glyphs, hidden controls and unintended non-Latin alphabets are forbidden.

## Enforcement

`npm run validate:text` strictly decodes all project source and content extensions as UTF-8, rejects BOMs, requires NFC, and reports forbidden character sequences, invisible characters and unintended alphabets. `npm run build` runs this check first. Runtime checks protect simulator, API, import, database and future AI-content boundaries.

Before merging or deploying, run:

```text
npm run validate:text
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Any intentional new alphabet or symbol requires a documented policy update and matching validator tests. Do not weaken the checks locally inside a component.
