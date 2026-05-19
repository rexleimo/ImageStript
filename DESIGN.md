# ImageStript Design System

## Visual Theme

Dark professional creative-tool interface. Inspired by desktop video editors (CapCut, DaVinci Resolve) — a focused workspace where the content takes center stage.

- **Canvas metaphor**: Central preview area as the "stage", surrounded by tool panels
- **Depth layering**: Background < Panel < Elevated controls < Modal overlays
- **Signature motif**: Rounded-square image frames with subtle inner glow on hover; purple accent glow on active states

## Color Roles

```css
--bg-canvas:      #0a0c10;    /* deepest background */
--bg-panel:       #14161c;    /* sidebar / panels */
--bg-elevated:    #1c1f28;    /* cards, inputs, buttons */
--bg-hover:       #252a36;    /* hover state */
--border-subtle:  #1e222e;    /* panel dividers */
--border-default: #2a3040;    /* component borders */
--border-active:  #3d3680;    /* focused/active borders */

--text-primary:   #e8eaf0;    /* headings, primary text */
--text-secondary: #8b92a8;    /* labels, descriptions */
--text-tertiary:  #5a6078;    /* placeholders, disabled */

--accent:         #7c6cf0;    /* primary purple */
--accent-hover:   #9184f4;    /* lighter on hover */
--accent-glow:    rgba(124, 108, 240, 0.25);
--accent-dim:     #3d3680;    /* active selection bg */

--success:        #34d399;
--success-bg:     rgba(52, 211, 153, 0.10);
--warning:        #fbbf24;
--warning-bg:     rgba(251, 191, 36, 0.10);
--danger:         #f87171;
--danger-bg:      rgba(248, 113, 113, 0.10);
```

## Typography Pair

- **Primary**: `"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
- **Mono**: `"SF Mono", "Fira Code", "JetBrains Mono", monospace` — for numeric values, file sizes
- **Scale**:
  - Display: 18px / 700 (app title)
  - Title: 14px / 600 (panel headers)
  - Body: 13px / 400 (labels, descriptions)
  - Caption: 11px / 500 uppercase tracking-wide (badges, section labels)
  - Mono: 12px / 400 tabular-nums (parameter values)

## Spacing Scale

- Base unit: 4px
- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-8`: 32px

Panel padding: 16px
Component gap: 8px–12px
Section gap: 16px–20px

## Radius Scale

- `--radius-sm`: 6px   (small buttons, inputs)
- `--radius-md`: 10px  (cards, panels)
- `--radius-lg`: 14px  (preview frames, modals)
- `--radius-xl`: 18px  (drop zones, empty states)
- `--radius-full`: 9999px (pills, badges)

## Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.30);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.35);
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.45);
--shadow-glow: 0 0 20px var(--accent-glow);
```

## Component States

### Buttons

- **Primary**: bg accent, white text, subtle glow shadow. Hover: brighter bg + lift 1px + larger glow. Active: press down.
- **Secondary**: bg elevated, border default, text primary. Hover: bg hover, border accent-dim.
- **Ghost**: transparent bg, text secondary. Hover: bg elevated, text primary.
- **Danger Ghost**: transparent bg, text secondary. Hover: bg danger-bg, text danger.
- **Icon Button**: 32×32, transparent, centered icon. Hover: bg elevated.

### Inputs / Sliders

- Track: bg border-default, height 3px, radius 2px
- Thumb: 14×14 circle, bg accent, shadow glow. Hover: scale 1.2
- Value label: mono font, tabular-nums

### File List Item

- Default: transparent bg, text secondary
- Hover: bg elevated
- Active: bg accent-dim, border 1px accent-glow, text primary
- Checkbox: 16×16 rounded 4px, border default. Checked: bg accent, white check icon

### Preview Frame

- Border: 1px border-default, radius-lg
- Image: object-fit contain, max 100%
- Hover: subtle inner shadow / border brightens

### Badge

- Pill shape (radius-full)
- Success: bg success-bg, text success
- Warning: bg warning-bg, text warning
- Neutral: bg elevated, text tertiary

### Toast

- Bottom-right stack
- bg elevated, border default, shadow-lg
- Icon left, text body
- Enter: slideUp + scale. Exit: fadeOut + slideDown

## Motion Principles

- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` for UI transitions
- **Duration**: 150ms for micro-interactions (hover, active), 250ms for layout changes
- **Patterns**:
  - Panel content: fadeIn
  - Toast: slideUp + scaleIn
  - Selection change: cross-fade images
  - Gallery hover: translateY(-2px) + shadow
- **Performance**: use `transform` and `opacity` only

## Layout Architecture

```
+--------------------------------------------------+
|  [Logo] ImageStript          [Add] [Clear]       |  Header (40px, draggable)
+----------+---------------------------------------+
|          |                                       |
| Sidebar  |         Main Preview Area             |
| (280px)  |         (flexible, centered)          |
|          |                                       |
| Files    |    [Before]        [After]            |
| Params   |                                       |
|          |    [Process] [Save] [Save All]        |
|          |                                       |
+----------+---------------------------------------+
|              Report / Status Bar                 |
+--------------------------------------------------+
```

- **Header**: minimal, draggable region, logo left, actions right
- **Sidebar**: fixed 280px, file list top, parameters bottom, divider between
- **Main**: flex 1, centered content, preview side-by-side or gallery grid
- **Report**: bottom bar, slides up when content available
