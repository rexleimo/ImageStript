# ImageStript Design System

## Design Philosophy: "Permute-style" Minimalism

ImageStript follows the **Permute** school of Mac utility design — not the native macOS "inspector panel" pattern, nor the pro creative-tool "3-panel IDE" pattern. The core principles:

1. **Single-focus workspace** — One task, one view, minimal chrome
2. **Content is the interface** — The dropped files *are* the UI; no persistent sidebar needed
3. **Presets over parameters** — Smart defaults; advanced options tucked away
4. **Actions live with content** — Process/save buttons appear in-context, not in a distant toolbar
5. **Zero-state as invitation** — Empty state is a beautiful drop zone, not a sad "no files" message
6. **Progress is visible** — Each file shows its own status; no separate progress panel

## Visual Theme

Dark, minimal, native-feeling. The aesthetic borrows from modern Mac utilities (Permute, ImageOptim, HandBrake) rather than creative suites.

- **Depth**: Almost flat. No strong panel separation — subtle borders only
- **Background hierarchy**: Slightly lighter than pure black, but not "panel heavy"
- **Signature motif**: Large rounded drop zone with animated border; file cards with inline status badges

## Color Roles

```css
--bg-canvas:      #0c0e14;    /* deepest background — almost black */
--bg-surface:     #14161d;    /* cards, elevated items */
--bg-hover:       #1c1f28;    /* hover state */
--border-subtle:  #1e222e;    /* dividers */
--border-default: #2a3040;    /* card borders */
--border-active:  #7c6cf0;    /* drop zone active, processing */

--text-primary:   #f0f1f5;    /* headings */
--text-secondary: #8b92a8;    /* body, labels */
--text-tertiary:  #5a6078;    /* hints, disabled */

--accent:         #7c6cf0;    /* primary purple */
--accent-hover:   #9184f4;
--accent-glow:    rgba(124, 108, 240, 0.25);
--accent-dim:     #2d2852;

--success:        #34d399;
--success-bg:     rgba(52, 211, 153, 0.10);
--warning:        #fbbf24;
--warning-bg:     rgba(251, 191, 36, 0.10);
--danger:         #f87171;
--danger-bg:      rgba(248, 113, 113, 0.10);
```

## Typography

- **Primary**: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif`
- **Mono**: `"SF Mono", "Fira Code", monospace` — for file sizes, numeric values
- **Scale**:
  - App title: 15px / 600
  - Section: 13px / 500
  - Body: 12px / 400
  - Caption: 11px / 500 (badges, hints)
  - Mono: 11px / 400 tabular-nums

## Spacing

- Base: 4px
- Tight: 8px
- Default: 12px
- Relaxed: 16px
- Loose: 24px

## Radius

- `--radius-sm`: 8px   (buttons, badges)
- `--radius-md`: 12px  (cards, inputs)
- `--radius-lg`: 16px  (drop zone, modals)
- `--radius-xl`: 20px  (large cards)
- `--radius-full`: 9999px (pills)

## Shadows

Minimal use. Mac utilities don't rely on shadows for depth.

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.20);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.30);
--shadow-glow: 0 0 20px var(--accent-glow);
```

## Layout Architecture (Permute-style)

```
+--------------------------------------------------+
|  ImageStript                          [Lang] [?] |  Header (minimal)
+--------------------------------------------------+
|                                                  |
|                                                  |
|              [  Large Drop Zone  ]               |  Center (flexible)
|         Drag images here or click to browse      |
|                                                  |
|  +----------+  +----------+  +----------+        |  File cards (grid)
|  | file.jpg |  | file.png |  | file.webp|        |
|  | [Clean]  |  | [AI ✓]   |  | [...]    |        |
|  +----------+  +----------+  +----------+        |
|                                                  |
|              [  Process All  ]                   |  Action (centered, contextual)
|                                                  |
+--------------------------------------------------+
```

### States

**Empty State:**
- Full-height centered drop zone
- Animated dashed border (subtle pulse when dragging)
- Icon + short text + supported formats hint

**With Files:**
- Drop zone collapses to a compact "add more" strip at top
- File cards in a responsive grid (auto-fill, min 120px)
- Each card: thumbnail, filename, status badge (Clean / AI / Processing...)
- Click card to preview (modal or inline expand)

**Processing:**
- Cards show inline spinner + "Processing..." badge
- Main action button disabled, shows progress

**Post-Process:**
- Cards update with new status
- "Save" action appears per-card and as batch "Save All"

## Components

### Drop Zone

- Large, centered, rounded rectangle
- Dashed border (`--border-default`), 2px
- On drag-over: border becomes `--accent`, subtle background tint, icon scales up
- On drop: brief flash of `--accent-glow`, then collapse

### File Card

- Fixed aspect ratio (square or 4:3)
- Thumbnail: `object-fit: cover`
- Overlay at bottom: gradient + filename
- Top-right badge: status
  - `Clean` — green dot + text
  - `AI` — yellow warning
  - `Processing...` — spinner
- Hover: slight scale up (1.02), border brightens
- Selected: `--accent` border, glow shadow

### Action Button (Primary)

- Centered, prominent
- Large padding (14px 32px)
- `--accent` background, white text
- Icon + text
- States: default → hover (brighten + lift) → active (press) → disabled (opacity 0.4)

### Action Button (Secondary / Per-card)

- Small, inline with card
- Ghost style: transparent bg, `--text-secondary`
- Hover: `--bg-hover`

### Preset Selector

- Horizontal segmented control (not dropdown)
- Options: Subtle | Standard | Aggressive
- Active: filled `--accent`
- Advanced: chevron to expand parameter sliders below

### Parameter Sliders (Advanced, Collapsed)

- Only visible when expanded
- Minimal: label + slider + value
- Slider: thin track (3px), small thumb (12px circle)

### Toast

- Bottom-center (not corner — more native Mac feel)
- Brief, auto-dismiss
- Success: check icon + green accent
- Error: alert icon + red accent

## Motion Principles

- **Easing**: `cubic-bezier(0.25, 0.1, 0.25, 1)` — softer, more native
- **Duration**: 200ms for most transitions
- **Patterns**:
  - File cards: staggered fade-in (50ms delay each)
  - Drop zone collapse: height shrink + fade
  - Card hover: scale(1.02) + border-color
  - Processing: subtle pulse on card border
  - Toast: slideUp + fadeIn

## Comparison: Before vs After

| Aspect | Before (IDE-style) | After (Permute-style) |
|--------|-------------------|----------------------|
| Layout | 3 panels + header + bottom bar | Single workspace, contextual |
| File list | Persistent left sidebar thumbnail strip | Grid of cards, appears when files added |
| Preview | Side-by-side Before/After panels | Inline card + modal/expand for detail |
| Parameters | Persistent right panel | Collapsible, preset-first |
| Actions | Fixed bottom strip | Contextual, near content |
| Empty state | Small drop zone in sidebar | Full-screen invitation |
| Visual weight | Heavy borders, panels | Almost flat, cards float on canvas |

## Implementation Notes

1. Remove `panel-left`, `panel-right`, `action-strip` as persistent elements
2. Make `panel-center` the only persistent region
3. File grid replaces thumbnail list
4. Drop zone is the default view, collapses to "add more" bar when files exist
5. Preset selector + advanced toggle live above the grid
6. Primary action button is centered below the grid
7. Per-card actions (Save, Delete) appear on hover or as inline buttons
