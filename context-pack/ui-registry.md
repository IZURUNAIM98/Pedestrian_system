# UI Registry

## Styling System
Tailwind CSS, shadcn/ui

## Component Source
shadcn/ui registry components, extended with project-specific components.

## Component Index

| Component | Purpose | Props | State | Reuse |
| --- | --- | --- | --- | --- |
| AppShell | Page frame: nav + content | children | none | One per app |
| SidebarNav | Wizard navigation and completion state | active, onSelect, completed, disabledSteps | active step | One per wizard |
| StepIndicator | Numbered step state inside sidebar/footer | step, active, completed | none | Reuse for wizard steps |
| WizardFooter | Back/continue/generate navigation | previous, next, step count | active step | One per wizard |
| PageHeader | Screen title + description | title, description | none | One per screen |
| Button | Actions | variant, size, disabled | none | Never restyle ad hoc |
| Input | Single-line entry | value, onChange, placeholder | controlled | Always with a label |
| FormField | Label, hint, and field wrapper | label, hint, htmlFor | none | Use for every form control |
| TextareaField | Multi-line entry + label/hint | label, value, onChange, hint | controlled | One-per-line lists |
| ColorInput | Token color entry | label, value, onChange | controlled | Use in Look step |
| ChipSelector | Compact option selector | options, value, onChange | selected option | Use for small choice sets |
| MermaidEditor | Diagram source editor | code, onChange | controlled | Mermaid step only |
| MermaidPreview | Rendered diagram preview | code | render status | Pair with MermaidEditor |
| DataModelSection | Data contract editor | data, projectType, onChange | controlled | Data step only |
| DataEntityCard | One entity/resource/schema card | entity, labels, onChange | controlled | Repeat inside DataModelSection |
| DataFieldRow | One field/variable row | field, labels, onChange | controlled | Repeat inside DataEntityCard |
| SelectField | Option selection + label | label, value, options | controlled | Keyboard accessible |
| Card | Grouped content surface | children | none | Soft border, radius-lg |
| Table | Tabular data | columns, rows | sort/selection local | Must include EmptyState |
| EmptyState | Designed empty placeholder | message, action | none | Required for every list |
| ErrorBanner | Inline recoverable error | message, onRetry | none | Plain language only |
| FileExportList | Generated file selector | files, active, selected, onSelect | selected files | Export step only |
| MarkdownPreview | Generated markdown reader/editor | file, editing, onChange | edit mode | Export step only |
| DownloadButton | File or zip download action | files, mode | none | Export step only |
| Badge | Operational severity or status | severity, children | none | Pair colour with text |
| TimelineRail | Seven-stage incident trace | stages | selected stage | Arrow, Home, End keyboard support |
| CrossingView | Straight-road simulation scene | result | none | Normal and school modes |
| EventLog | Preserved chronological record | entries, filter | none | Includes empty state |
| Dashboard | Application shell and local workflow | none | view, scenario, history, review | One per app |
| AccessForm | Demonstration credential entry | none | error, submitting | `/access` only; server API validates credentials |

Check this index before creating any component; add a row when a new one is introduced.
