# UI Rules

Token values live in `ui-tokens.md` — reference tokens by name here, never duplicate their values.

## Design Philosophy
- safe
- precise
- calm
- trustworthy
- accessible
- operational
- responsive

Use a production-ready municipal safety dashboard with a high-contrast Safety Blue and Neutral Light colour system. Use blue for primary navigation and trusted system actions; green for safe or resolved states; amber for warnings; red only for critical incidents and emergency alerts. Use white surfaces, soft blue-grey backgrounds, clear borders, readable typography, generous spacing, accessible contrast, responsive layouts, and restrained animation. Preserve clear visual separation between simulation data, detected violations, incident escalation, emergency alerts, and normal traffic-signal states. Do not use red or green as the only way to communicate status; include labels and icons.

## Layout Rules
- Full-height shell; content column centered with a comfortable max width.
- Generous whitespace between sections; never crowd controls.
- One primary action per screen; keep secondary actions visually quiet.

## Core Rules

| Rule | Requirement |
| --- | --- |
| Spacing | Generous, consistent spacing using the scale in `ui-tokens.md` |
| Corners | Rounded cards and controls (see radius tokens) |
| Borders | Minimal, subtle borders only where needed |
| Shadows | Soft, low-contrast shadows |
| Hierarchy | Clear typographic and visual hierarchy |
| Color usage | Limited palette anchored on the primary color |
| Motion | Subtle, purposeful micro-interactions |
| Accessibility | Sufficient contrast, semantic HTML, keyboard support |

## Form Rules
- Labels are small, uppercase, muted, letter-spaced, and programmatically associated with their inputs.
- Inputs are large, rounded, with subtle borders; helper text is small and muted.
- Validate gently: guide rather than block; show errors inline next to the field.

## Button Rules
- Primary: solid primary color, white text, rounded.
- Secondary: white/transparent background with subtle border.
- Destructive: red accent, used sparingly, with confirmation where data loss is possible.
- Disabled: lowered opacity, no pointer events, still announced to assistive tech.

## Empty State Rules
- Every list or table has a designed empty state with a short explanation and a next action.
- Never render a blank panel.

## Error State Rules
- Errors are inline, plain-language, and recoverable.
- Never show raw stack traces or codes to end users.

## Responsive Behavior
- Layout collapses gracefully to a single column on small screens.
- Touch targets are at least 40px; nothing depends on hover alone.

## Accessibility Rules
- All interactive elements are reachable and operable by keyboard.
- Icon-only buttons carry accessible names.
- Live status changes (validation, save state) are announced via polite live regions.
