---
name: Accord
description: A warm-stone workspace with a night-violet rail, where operations are managed and proven; value certainty is drawn, not just labelled.
colors:
  accent-violet: "#5b3fa8"
  accent-violet-hover: "#4a3190"
  accent-wash: "#efeaf9"
  accent-line: "#d2c5ee"
  stone-ground: "#f4f2ed"
  paper-surface: "#fdfcf9"
  paper-sunken: "#f8f6f1"
  hairline: "#e5e1d8"
  hairline-strong: "#cfc9bd"
  ink: "#1d1824"
  ink-2: "#473f55"
  ink-3: "#675f73"
  ink-4: "#8a8296"
  night: "#130f1c"
  night-2: "#1d1829"
  night-line: "#2e2742"
  night-ink: "#f1ecf8"
  night-ink-2: "#b9aed0"
  night-accent: "#c9b3f0"
  night-critical: "#f4b0aa"
  estimated-fg: "#9a82d4"
  estimated-bg: "#e6def6"
  critical: "#b3261e"
  critical-wash: "#fcefed"
  critical-line: "#f1c7c3"
  high: "#a35607"
  high-wash: "#fdf1e1"
  high-line: "#efd3a8"
  medium: "#4d4659"
  medium-wash: "#eeebe4"
  low: "#655e70"
  low-wash: "#f1eee8"
  ok: "#1d7448"
  ok-wash: "#e8f4ed"
  ok-line: "#bfdfcc"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 480
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 480
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 560
    lineHeight: 1.5
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'tnum'"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 560
    letterSpacing: "0.05em"
  seq:
    fontFamily: "Geist Mono, ui-monospace, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    letterSpacing: "-0.01em"
  accent-phrase:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "inherit"
    fontWeight: 400
    letterSpacing: "-0.02em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
  4xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent-violet}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.accent-violet-hover}"
  button-secondary:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
  button-danger:
    backgroundColor: "{colors.critical}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
  card:
    backgroundColor: "{colors.paper-surface}"
    rounded: "{rounded.md}"
  card-night:
    backgroundColor: "{colors.night}"
    textColor: "{colors.night-ink}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "7px 12px"
    height: "38px"
  badge:
    backgroundColor: "{colors.paper-sunken}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "0 9px"
    height: "22px"
  nav-item:
    textColor: "{colors.night-ink-2}"
    rounded: "{rounded.sm}"
    height: "40px"
  nav-item-active:
    backgroundColor: "rgba(201, 179, 240, 0.14)"
    textColor: "{colors.night-ink}"
  tab:
    textColor: "{colors.ink-3}"
    height: "44px"
  dialog:
    backgroundColor: "{colors.paper-surface}"
    rounded: "{rounded.lg}"
    width: "520px"
  drawer:
    backgroundColor: "{colors.paper-surface}"
    width: "580px"
---

# Design System: Accord

## Overview

**Creative North Star: "The Ledger Under Night"**

Accord is a restrained editorial workspace for running a hybrid human and AI workforce and proving what it was allowed to do. Warm stone ground and paper surfaces carry the working day; a single night violet-black rail anchors navigation, and one violet accent marks interaction and verified value. The build was redesigned from a generic blue-and-white dashboard, and the replacement is deliberately quiet: hairline borders instead of shadows, pill buttons, tabular figures, almost no ornament.

Certainty is drawn. Verified value is solid violet, estimated value is a hatched pale violet, unmeasured value is an outlined dashed shape. The three are never summed or blended. The signature move is the monospace `#seq` sequence gutter: ids, scopes and sequence numbers are always Geist Mono, tabular and muted, and they anchor timelines, evidence and the event log, so order is read by sequence number, never by time.

The user pinned Geist, with Geist Mono for data and one italic Newsreader phrase for editorial voice. The overused-font warning on Geist is a user-confirmed exception recorded in `.impeccable/config.json`.

**Key Characteristics:**
- Warm stone and paper neutrals with violet-tinted ink, never pure grey or white.
- Night appears twice: the nav rail, and the Assure lane card on Overview (the pivot from managing to proving).
- Flat at rest; only overlays and the toast carry a shadow.
- Solid / hatched / outlined encodes verified / estimated / unmeasured everywhere value appears.
- Mono `#seq` gutter as the recurring structural device.

## Colors

A stone-and-paper field with one violet voice, a night chapter, and severity colors held strictly for severity.

### Primary
- **Ceremonial Violet** (`accent-violet`): Interaction (primary buttons, links, selected tab underline, focus ring at 32% alpha), and the solid fill for verified value. Hover deepens to `accent-violet-hover`. Selected and highlighted states use `accent-wash` with an `accent-line` border.

### Secondary
- **Lilac Hatch** (`estimated-fg` on `estimated-bg`): Only for estimated value, drawn as 135-degree 2px/2px stripes with a 1px outline.
- **Night Lilac** (`night-accent`): The accent on night surfaces (active rail marker, links and "go" actions inside the Assure card, logo overlap in dark tone).

### Neutral
- **Stone Ground** (`stone-ground`): Page background. **Paper Surface** (`paper-surface`) for cards, inputs, panels; **Paper Sunken** (`paper-sunken`) for table heads, hover rows, drawer footers.
- **Hairline / Hairline Strong**: 1px dividers and card borders; control borders.
- **Ink, Ink 2, Ink 3**: Primary, secondary and muted text (all checked for AA in tests/contrast.test.ts). **Ink 4** is non-text only: dashed outlines, hover borders, the unmeasured stroke.
- **Night, Night 2, Night Line, Night Ink, Night Ink 2**: The rail and night card ground, hover, dividers, and text.

### Severity and state
- **Critical** (red) and **High** (amber) with wash and line companions: severity and denied outcomes only (badges, risk notes, danger button, denied verdict). **Medium** and **Low** are neutral-toned badges. **OK** green: allowed or confirmed state only. **Night Critical** is the red used on night surfaces.

### Named Rules
**The Three Value Marks Rule.** Verified is solid violet, estimated is hatched, unmeasured is outlined/dashed. Any new surface showing value uses these marks and never adds the three into one figure.

**The Reserved Hue Rule.** Violet is interaction and verified value; red/amber is severity and denial; green is allowed. No color is borrowed for decoration.

**The Night Is Rare Rule.** Night fills only the navigation rail, the Assure lane card, and the toast.

## Typography

**Display / Body Font:** Geist (with ui-sans-serif, system-ui fallbacks), self-hosted variable, 100-900
**Label/Mono Font:** Geist Mono (with ui-monospace, Consolas)
**Accent Font:** Newsreader italic (with Georgia), self-hosted variable

**Character:** Geist is cool and exact, set with tight negative tracking at large sizes and tabular figures globally (`font-feature-settings: 'tnum'`). Mono carries identifiers; the serif italic appears as a rare human aside.

### Hierarchy
- **Display** (480, 34px, 1.05, -0.04em): The verified-value amount and the verdict word only.
- **Headline** (480, 24px, 1.15, -0.035em): Page title (h1), balanced wrapping.
- **Title** (560, 16px / 14px h3; 520, 20px panel titles): Card and section headings.
- **Body** (400, 14px base, 13px for tables and secondary copy, 1.5): Prose capped near 68-70ch.
- **Label** (560, 12px, 0.05em uppercase): Table column heads only (and nav group heads at 11px, 0.09em).
- **Seq / Mono** (400, 12px, tabular, -0.01em, `ink-3`): `#seq` numbers, ids, scopes, chips.

Scale steps in use: 12, 13, 14, 16, 20, 24, 34px.

### Named Rules
**The One Italic Rule.** Newsreader italic appears only for one accent phrase (`accent-phrase`, violet) inside a page title and for empty-state titles (20px, ink). Nowhere else.

**The Mono Means Identity Rule.** If it is an id, scope or sequence number, it is Geist Mono, tabular, muted.

## Layout

Operate shell: a 244px night rail beside a fluid main column with a 56px sticky top bar (back link, simulated role selector, reset) on a translucent stone ground with an 8px backdrop blur. Pages are a flex column, max 1360px wide, centered, 24px gap, padding 24/32/40px. Spacing is a 4px base (4, 8, 12, 16, 20, 24, 32, 40). Overview opens with two working lanes (1.35fr / 1fr) rather than a row of metric cards; detail screens use a ~1.05fr / 1fr grid with a sticky side column; fact lists are two-column grids.

Responsive: at 1100px the rail collapses to a 72px icon rail (labels visually hidden); at 1000px lane and detail grids go single-column; at 720px the rail becomes a horizontal top strip with labels restored; below 700-760px fact grids and ledger rows stack. Interactive minimums: 44px for nav and tabs, 36px buttons (32px small), 38px inputs.

## Elevation & Depth

Flat by default and layered tonally: stone ground, paper cards with a 1px hairline, sunken paper for heads and footers. Shadows exist only for things that float above the page: dialogs, drawers and the toast use `0 14px 44px rgba(19,15,28,.2), 0 2px 8px rgba(19,15,28,.08)` over a 42% night scrim. Depth is otherwise conveyed by the night surfaces. Focus is a 3px violet ring (`0 0 0 3px rgba(91,63,168,.32)`; `rgba(201,179,240,.45)` on night), inset on rows.

### Named Rules
**The Hairline Not Shadow Rule.** A card never casts a shadow; it earns its edge with a 1px hairline.

## Shapes

Soft but not bubbly. Controls that act (buttons, badges, chips, toast, role selector, count pills) are full pills (999px). Inputs, nav items, alerts, table-in-card segments are 8px; cards are 12px; dialogs 16px. People avatars are circles; AI worker avatars are 7px-rounded squares in mono, echoing the logo (a circle for people overlapping a rounded square for AI workers, overlap filled violet). Data bars are 2-3px radius. Timeline dots are 12px rings, dashed when they represent events after the case's decision.

## Components

### Buttons
- **Shape:** Pill, 36px tall (32px small, 36px square icon), 16px side padding, 13px, weight 520.
- **Primary:** Violet fill, white text; hover deepens to the hover violet.
- **Secondary:** Paper with a strong hairline; hover sunken paper.
- **Ghost:** Transparent, ink-2 text, wash on hover. **Danger:** critical red fill for destructive actions only.
- Disabled is 50% opacity. Transitions 0.18s on a quick ease-out (`cubic-bezier(.22,1,.36,1)`).

### Cards / Containers
- 12px radius, paper surface, 1px hairline, no shadow. Header padding 20/20/12, body 0/20/20. Night variant for the Assure lane: night fill, night-line dividers, night-lilac actions.

### Inputs / Fields
- 38px, 8px radius, paper with a strong hairline; focus swaps border to violet and adds the ring. Labels are 12px/560. Selectable choices are bordered rows that turn accent-wash when checked.

### Navigation
- Night rail: logo, grouped items (Overview; Operate: Work Queue, Workforce; Assure: Governance) with 11px uppercase group heads, 40px items, 8px radius. Active item has a faint lilac fill and a 3px lilac marker on the rail edge. Counts are small pills (critical uses a pale red pill). Tabs elsewhere are underlined with a 2px violet bar.

### Tables
- Sticky sunken head with 12px uppercase tracked labels; 12px/16px cell padding; hairline row dividers; clickable rows get sunken hover and accent-wash when selected. First cell of a row is a real button.

### Overlays
- Dialog (520px) and drawer (580px, from the right) share paper panels with bordered head and sunken foot; state-only motion (fade, rise 8px, slide 28px).

### Sequence gutter and timeline (signature)
- A 52px right-aligned mono `#seq` column, a rail line, a 12px status dot, then the event card. Order is by seq. Dot colors: ink-4 neutral, violet accent, green ok, red critical, dashed for post-decision events. The selected event takes accent-wash. "Authority at attempt" lines on case rows reuse the same mono muted voice.

### Value ledger and value marks
- The verified amount is 34px display weight 480, estimated and unmeasured at 16px, each with its swatch (solid / hatched / dashed outline). In-cell mini bars and the coverage bar reuse the same three fills.

### Verdict
- One word at display size, green for allowed, red for denied, then reason, a Then versus Now comparison, and mono evidence chips.

## Do's and Don'ts

### Do:
- **Do** mark value with solid, hatched and outlined fills, and keep the three figures separate.
- **Do** set every id, scope and sequence number in Geist Mono, tabular, ink-3.
- **Do** use hairline borders on stone/paper and reserve shadows for dialogs, drawers and the toast.
- **Do** use pill shapes for actions and 8/12/16px radii for containers.
- **Do** keep violet for interaction and verified value, red/amber for severity, green for allowed.
- **Do** put the single italic serif phrase in the page title and in empty-state titles only.
- **Do** keep text pairs at WCAG AA using ink / ink-2 / ink-3; use ink-4 for non-text only.

### Don't:
- **Don't** add or blend verified, estimated and unmeasured value into one number.
- **Don't** use shadows or colored side stripes to lift cards.
- **Don't** use night fills beyond the rail, the Assure card and the toast.
- **Don't** reintroduce the generic blue-and-white dashboard look or a row of metric cards.
- **Don't** use Newsreader for body, labels or numbers.
