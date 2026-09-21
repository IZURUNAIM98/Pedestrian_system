# UI Tokens

## Brand Adjectives
safe, precise, calm, trustworthy, accessible, operational, responsive

## Color Mode
Light

## Colors

| Token | Value |
| --- | --- |
| primary | `#0B5CAD` |
| background | `#F4F7FA` |
| surface | `#FFFFFF` |
| text | `#172033` |
| success | `#16803C` |
| error | `#C62828` |

## Typography

| Role | Font |
| --- | --- |
| Display | Inter |
| Body | Inter |
| Mono | JetBrains Mono |

## Radius

| Token | Value | Usage |
| --- | --- | --- |
| radius-sm | 8px | Inputs, chips, small controls |
| radius-md | 12px | Buttons, list items |
| radius-lg | 16px | Cards, panels, modals |

## Spacing

| Token | Value |
| --- | --- |
| space-1 | 4px |
| space-2 | 8px |
| space-3 | 12px |
| space-4 | 16px |
| space-6 | 24px |
| space-8 | 32px |
| space-12 | 48px |

## Borders

| Token | Value |
| --- | --- |
| border-default | 1px solid, low-contrast neutral derived from text at ~10% opacity |
| border-focus | 1.5px solid primary |

## Shadows

| Token | Value | Usage |
| --- | --- | --- |
| shadow-soft | 0 1px 3px rgba(0,0,0,0.06) | Cards at rest |
| shadow-raised | 0 4px 12px rgba(0,0,0,0.08) | Popovers, dropdowns |

## Motion

| Token | Value |
| --- | --- |
| duration-fast | 150ms |
| duration-base | 250ms |
| easing | ease-out |

## Accessibility Notes
- Body text contrast must be at least 4.5:1 against its background.
- Focus states must be visible (focus ring in primary color); never remove outlines without replacement.
- Never communicate state with color alone — pair with icon or text.
- Honor reduced-motion preferences by disabling non-essential transitions.

## Design Notes
Use a production-ready municipal safety dashboard with a high-contrast Safety Blue and Neutral Light colour system. Use blue for primary navigation and trusted system actions; green for safe or resolved states; amber for warnings; red only for critical incidents and emergency alerts. Use white surfaces, soft blue-grey backgrounds, clear borders, readable typography, generous spacing, accessible contrast, responsive layouts, and restrained animation. Preserve clear visual separation between simulation data, detected violations, incident escalation, emergency alerts, and normal traffic-signal states. Do not use red or green as the only way to communicate status; include labels and icons.
