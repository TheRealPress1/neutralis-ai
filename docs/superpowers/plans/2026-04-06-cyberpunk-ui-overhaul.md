# Cyberpunk HUD UI Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Neutralis.ai from a clean dark dashboard into a cyberpunk HUD trading terminal with neon accents, grid overlays, corner tick-marks, scan-line animations, and terminal-grade typography — without adding new features or changing any data logic.

**Architecture:** Pure CSS/Tailwind + JSX class changes across 17 existing files. New CSS tokens and utility classes in globals.css form the foundation. Each component then swaps class names from the old silver palette to the new neon system. No new dependencies, no structural changes, no API modifications.

**Tech Stack:** Next.js 16 / React 19 / Tailwind CSS v4 / Geist + Italiana fonts (existing)

**Spec:** `docs/superpowers/specs/2026-04-06-cyberpunk-ui-overhaul-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/globals.css` | Modify | New color tokens, HUD panel class, grid overlay, scan line, skeleton, corner accents, glow utilities |
| `src/app/layout.tsx` | Modify | Update body bg color token |
| `src/app/page.tsx` | Modify | Hero neon glow, CTA buttons, feature cards, footer |
| `src/app/navbar.tsx` | Modify | Neon spotlight tint, active link styling |
| `src/app/dashboard/components/DashboardShell.tsx` | Modify | Nav overhaul, grid bg, tab indicator, live dot, transitions |
| `src/app/dashboard/components/StatsBar.tsx` | Modify | HUD panels, accent borders, neon P&L, mono labels |
| `src/app/dashboard/components/BalanceBar.tsx` | Modify | HUD panels, venue glow rings, connected states |
| `src/app/dashboard/components/PositionsTable.tsx` | Modify | Table headers, row hover, venue dots, P&L neon |
| `src/app/dashboard/components/ActivityFeed.tsx` | Modify | Timeline line, signal badges, guard detail styling |
| `src/app/dashboard/components/LivePanel.tsx` | Modify | Terminal log panel, neon status dots, automation toggle |
| `src/app/dashboard/components/ActivityTimeline.tsx` | Modify | Timeline gradient, entry cards, search input |
| `src/app/dashboard/components/MarketBrowser.tsx` | Modify | Search bar, venue pills, price coloring |
| `src/app/dashboard/components/MatchesTable.tsx` | Modify | Edge highlighting, venue badges |
| `src/app/dashboard/components/ApiKeyManager.tsx` | Modify | Connection cards, status dots, test button |
| `src/app/dashboard/components/SettingsPage.tsx` | Modify | Upgrade banner gradient |
| `src/app/dashboard/components/RiskProfileEditor.tsx` | Modify | Section headers, save button, input styling |
| `src/app/dashboard/components/AccessCodeGenerator.tsx` | Modify | Terminal output box, generate button, code rows |

---

## Task 1: CSS Foundation — Color Tokens + HUD Utilities

**Files:**
- Modify: `src/app/globals.css`

This task creates the entire design system foundation. Every subsequent task depends on these classes.

- [ ] **Step 1: Replace color tokens in `:root` and `@theme inline`**

In `src/app/globals.css`, replace the existing `:root` and `@theme inline` blocks with:

```css
:root {
  --bg-primary: #030306;
  --bg-secondary: #0a0c12;
  --bg-elevated: #0d1018;
  --border: #1a1e2a;
  --border-glow: rgba(0, 255, 170, 0.15);
  --neon-green: #00ffaa;
  --neon-blue: #00d4ff;
  --neon-purple: #a855f7;
  --neon-red: #ff3366;
  --neon-amber: #ffaa00;
  --text-primary: #e0e4ea;
  --text-secondary: #5a6578;
  --text-mono: #8892a0;
}

@theme inline {
  --color-bg-primary: var(--bg-primary);
  --color-bg-secondary: var(--bg-secondary);
  --color-bg-elevated: var(--bg-elevated);
  --color-border: var(--border);
  --color-border-glow: var(--border-glow);
  --color-neon-green: var(--neon-green);
  --color-neon-blue: var(--neon-blue);
  --color-neon-purple: var(--neon-purple);
  --color-neon-red: var(--neon-red);
  --color-neon-amber: var(--neon-amber);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-mono: var(--text-mono);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

- [ ] **Step 2: Update body styles**

Replace the existing `body { ... }` block:

```css
body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-geist-sans), sans-serif;
  position: relative;
}
```

- [ ] **Step 3: Update grain overlay opacity**

Change the grain overlay `opacity` from `0.03` to `0.02` (subtler on deeper black).

- [ ] **Step 4: Update vignette gradient**

Replace the vignette `body::after` background with:

```css
background: radial-gradient(ellipse at center, transparent 55%, rgba(3,3,6,0.25) 100%);
```

- [ ] **Step 5: Update hero glow to neon tones**

Replace the `.hero-glow::before` gradient:

```css
background: radial-gradient(
  ellipse at center,
  rgba(0, 255, 170, 0.15) 0%,
  rgba(0, 212, 255, 0.06) 35%,
  rgba(0, 255, 170, 0.02) 60%,
  transparent 80%
);
```

Replace the `.hero-glow::after` gradient:

```css
background: radial-gradient(
  ellipse at center,
  rgba(0, 212, 255, 0.05) 0%,
  transparent 70%
);
```

- [ ] **Step 6: Replace `.card-panel` with `.hud-panel`**

Remove the existing `.card-panel` block entirely. Add:

```css
/* ── HUD Panel ────────────────────────────────────── */
.hud-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  position: relative;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}
.hud-panel:hover {
  border-color: var(--border-glow);
  box-shadow: 0 0 20px rgba(0,255,170,0.04), inset 0 0 20px rgba(0,255,170,0.02);
}
/* Corner tick-marks */
.hud-panel::before,
.hud-panel::after {
  content: "";
  position: absolute;
  width: 10px;
  height: 10px;
  border-color: rgba(0,255,170,0.25);
  border-style: solid;
  pointer-events: none;
  z-index: 1;
}
.hud-panel::before {
  top: -1px;
  left: -1px;
  border-width: 1px 0 0 1px;
  border-radius: 0.75rem 0 0 0;
}
.hud-panel::after {
  bottom: -1px;
  right: -1px;
  border-width: 0 1px 1px 0;
  border-radius: 0 0 0.75rem 0;
}
```

- [ ] **Step 7: Add grid overlay class**

```css
/* ── Dashboard grid overlay ───────────────────────── */
.dashboard-grid {
  background-image:
    linear-gradient(rgba(0,255,170,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,255,170,0.02) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

- [ ] **Step 8: Add scan line animation**

```css
/* ── Scan line ────────────────────────────────────── */
@keyframes scanline {
  0% { transform: translateY(-100vh); }
  100% { transform: translateY(100vh); }
}
.scan-line::before {
  content: "";
  position: fixed;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0,255,170,0.06), transparent);
  animation: scanline 8s linear infinite;
  pointer-events: none;
  z-index: 97;
}
```

- [ ] **Step 9: Add neon glow pulse keyframe**

```css
/* ── Neon pulse ───────────────────────────────────── */
@keyframes neon-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
.neon-pulse {
  animation: neon-pulse 2s ease-in-out infinite;
}
```

- [ ] **Step 10: Add skeleton sweep loader**

```css
/* ── Skeleton sweep ───────────────────────────────── */
@keyframes skeleton-sweep {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-elevated) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: skeleton-sweep 1.5s ease infinite;
  border-radius: 0.375rem;
}
```

- [ ] **Step 11: Update button sheen to neon**

Replace `.btn-sheen::before` gradient:

```css
background: linear-gradient(
  120deg,
  transparent 30%,
  rgba(0, 255, 170, 0.2) 50%,
  transparent 70%
);
```

- [ ] **Step 12: Update nav spotlight to neon green tint**

Replace `.nav-spotlight` backgrounds with:

```css
.nav-spotlight {
  background:
    radial-gradient(
      180px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%),
      rgba(0, 255, 170, 0.6) 0%,
      rgba(0, 255, 170, 0.2) 35%,
      rgba(0, 255, 170, 0.06) 55%,
      transparent 70%
    ),
    radial-gradient(
      380px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%),
      rgba(0, 212, 255, 0.1) 0%,
      transparent 60%
    );
  filter: blur(2px);
  mix-blend-mode: screen;
}
```

- [ ] **Step 13: Update nav link glow**

```css
.nav-link-glow:hover {
  text-shadow: 0 0 8px rgba(0, 255, 170, 0.3);
}
```

- [ ] **Step 14: Update headline italic underline to neon**

Replace `.headline-italic::after` background:

```css
background: linear-gradient(90deg, transparent, rgba(0, 255, 170, 0.3), transparent);
```

- [ ] **Step 15: Update focus states to neon-blue**

```css
a:focus-visible,
button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--neon-blue);
  outline-offset: 2px;
}
```

- [ ] **Step 16: Add reduced motion override for new animations**

The existing `prefers-reduced-motion` block already handles all animations. No change needed.

- [ ] **Step 17: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ui): cyberpunk design system — neon tokens, HUD panel, grid overlay, scan line"
```

---

## Task 2: Dashboard Shell — Nav Bar + Layout

**Files:**
- Modify: `src/app/dashboard/components/DashboardShell.tsx`

- [ ] **Step 1: Add grid overlay + scan line to root container**

Change the root div class from:
```
min-h-screen bg-[#050608] text-[#e8e9ea]
```
to:
```
min-h-screen bg-bg-primary text-text-primary dashboard-grid scan-line
```

- [ ] **Step 2: Restyle the nav bar**

Replace the `<nav>` element's className from:
```
fixed top-0 z-50 w-full border-b border-[#1a1d21] bg-[#050608]/80 backdrop-blur-lg
```
to:
```
fixed top-0 z-50 w-full bg-bg-primary/85 backdrop-blur-xl
```

Add a gradient border below the nav by adding an inner div right before `</nav>`:
```jsx
<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-neon-green/20 to-transparent" />
```

- [ ] **Step 3: Restyle tab buttons**

Replace the active/inactive tab classes. Change:
```
bg-[#1a1d21] text-[#e8e9ea]
```
to (active):
```
text-neon-green
```

Change inactive:
```
text-[#9ca3af] hover:text-[#e8e9ea]
```
to:
```
text-text-secondary hover:text-text-primary
```

Add an active indicator line by wrapping the button text or adding a conditional bottom border. Replace the entire button element for each tab:

```jsx
<button
  key={item.id}
  onClick={() => setActiveTab(item.id)}
  className={`relative rounded-md px-3 py-1.5 text-xs font-mono font-medium uppercase tracking-wider transition-colors ${
    activeTab === item.id
      ? "text-neon-green"
      : "text-text-secondary hover:text-text-primary"
  }`}
>
  {item.label}
  {activeTab === item.id && (
    <span className="absolute bottom-0 left-1 right-1 h-px bg-neon-green" />
  )}
</button>
```

- [ ] **Step 4: Restyle the Upgrade button**

Change:
```
ml-2 rounded-md bg-[#e8e9ea] px-3 py-1.5 text-xs font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb]
```
to:
```
ml-2 rounded-md border border-neon-green/30 bg-neon-green/10 px-3 py-1.5 text-xs font-mono font-medium uppercase tracking-wider text-neon-green transition-colors hover:bg-neon-green/20
```

- [ ] **Step 5: Restyle the separator and exchange icons**

Change the separator span `bg-[#3b3f46]` to `bg-border`.

Change icon opacity classes from `opacity-85 transition-opacity hover:opacity-100` to:
```
opacity-60 transition-all hover:opacity-100 hover:drop-shadow-[0_0_4px_rgba(0,255,170,0.3)]
```

- [ ] **Step 6: Restyle the Live indicator**

Replace the connected/disconnected classes:

Connected:
```
bg-emerald-400/10 text-emerald-400
```
→
```
bg-neon-green/10 text-neon-green
```

Connected dot:
```
bg-emerald-400 animate-pulse
```
→
```
bg-neon-green neon-pulse shadow-[0_0_6px_rgba(0,255,170,0.6)]
```

Disconnected indicator:
```
bg-[#1a1d21] text-[#9ca3af]
```
→
```
bg-bg-elevated text-text-secondary
```

Disconnected dot:
```
bg-[#9ca3af]
```
→
```
bg-text-secondary
```

- [ ] **Step 7: Restyle the refresh button**

Change:
```
border border-[#1a1d21] text-[#9ca3af] transition-colors hover:border-[#c0c5cb] hover:text-[#e8e9ea]
```
to:
```
border border-border text-text-secondary transition-all hover:border-neon-green/30 hover:text-neon-green hover:shadow-[0_0_8px_rgba(0,255,170,0.1)]
```

Change the hover rotation from `group-hover:rotate-45` to `group-hover:rotate-180 transition-transform duration-500`.

- [ ] **Step 8: Update `<main>` background**

Change:
```
mx-auto max-w-6xl px-6 pt-20 pb-16
```
to:
```
mx-auto max-w-6xl px-6 pt-20 pb-16 relative
```

- [ ] **Step 9: Commit**

```bash
git add src/app/dashboard/components/DashboardShell.tsx
git commit -m "feat(ui): cyberpunk nav bar — neon tabs, gradient border, glow indicators"
```

---

## Task 3: StatsBar + BalanceBar — HUD Panels

**Files:**
- Modify: `src/app/dashboard/components/StatsBar.tsx`
- Modify: `src/app/dashboard/components/BalanceBar.tsx`

- [ ] **Step 1: Restyle StatsBar cards**

In `StatsBar.tsx`, replace every `card-panel rounded-xl` with `hud-panel`.

Replace the label class:
```
font-[family-name:var(--font-cormorant)] text-xs font-medium uppercase tracking-[0.15em] text-[#9ca3af]
```
with:
```
font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-text-secondary
```

Replace value class `font-mono text-2xl font-bold` with `font-mono text-3xl font-bold tabular-nums`.

Replace P&L color function `pnlColor` — change `text-emerald-400` to `text-neon-green` and `text-red-400` to `text-neon-red`.

In the color callback for Realized P&L, update:
- `text-emerald-400` → `text-neon-green drop-shadow-[0_0_8px_rgba(0,255,170,0.3)]`
- `text-red-400` → `text-neon-red drop-shadow-[0_0_8px_rgba(255,51,102,0.3)]`
- `text-[#e8e9ea]` → `text-text-primary`

Replace skeleton `animate-pulse rounded bg-[#12151a]` with `skeleton`.

- [ ] **Step 2: Restyle BalanceBar cards**

In `BalanceBar.tsx`, replace every `card-panel rounded-xl` with `hud-panel`.

Replace the venue icon container class:
```
flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1d21]
```
with (for Kalshi):
```
flex h-8 w-8 items-center justify-center rounded-lg bg-neon-blue/10 ring-1 ring-neon-blue/20
```
and for Polymarket:
```
flex h-8 w-8 items-center justify-center rounded-lg bg-neon-purple/10 ring-1 ring-neon-purple/20
```

Replace the venue icon text `text-sm font-bold text-[#e8e9ea]`:
- Kalshi: `text-sm font-bold text-neon-blue`
- Polymarket: `text-sm font-bold text-neon-purple`

Replace the label class same as StatsBar (mono text-[10px]).

Replace balance value `font-mono text-2xl font-bold text-[#e8e9ea]` with `font-mono text-3xl font-bold tabular-nums text-text-primary`.

Replace "Not connected" `text-sm text-[#3b3f46]` with `text-sm text-text-secondary`.

Replace the "Connect" link class:
```
mt-1 text-xs text-[#9ca3af] underline underline-offset-2 transition-colors hover:text-[#e8e9ea]
```
with:
```
mt-1 text-xs text-neon-blue transition-colors hover:text-neon-green
```

Replace portfolio value secondary text `text-[#9ca3af]` with `text-text-secondary` and `text-[#c0c5cb]` with `text-text-mono`.

Replace skeleton classes same as StatsBar.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/components/StatsBar.tsx src/app/dashboard/components/BalanceBar.tsx
git commit -m "feat(ui): cyberpunk stat cards — HUD panels, neon values, mono labels"
```

---

## Task 4: PositionsTable + ActivityFeed

**Files:**
- Modify: `src/app/dashboard/components/PositionsTable.tsx`
- Modify: `src/app/dashboard/components/ActivityFeed.tsx`

- [ ] **Step 1: Restyle PositionsTable**

Replace `card-panel rounded-xl` with `hud-panel`.

Replace header border `border-b border-[#1a1d21]` with `border-b border-border`.

Replace section title class (Cormorant) with:
```
font-mono text-xs font-medium uppercase tracking-[0.15em] text-text-secondary
```

Replace Open/Closed tab buttons — same pattern as DashboardShell tabs:
- Active: `bg-neon-green/10 text-neon-green`
- Inactive: `text-text-secondary hover:text-text-primary`

Replace the `venueBadge` function — change:
```
rounded border border-[#1a1d21] bg-[#0a0d10] px-2 py-0.5 text-xs uppercase
```
to venue-specific coloring:
```jsx
function venueBadge(venue: string) {
  const isKalshi = venue === "kalshi";
  const label = venue === "polymarket_us" ? "POLY US" : venue.toUpperCase();
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
      isKalshi
        ? "border-neon-blue/20 bg-neon-blue/5 text-neon-blue"
        : "border-neon-purple/20 bg-neon-purple/5 text-neon-purple"
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${isKalshi ? "bg-neon-blue" : "bg-neon-purple"}`} />
      {label}
    </span>
  );
}
```

Update `pnlColor` function:
- `text-emerald-400` → `text-neon-green`
- `text-red-400` → `text-neon-red`
- `text-[#9ca3af]` → `text-text-secondary`

Replace empty state `text-sm text-[#9ca3af]` with `font-mono text-sm text-text-secondary`.

Replace skeleton `animate-pulse rounded bg-[#12151a]` with `skeleton`.

- [ ] **Step 2: Restyle ActivityFeed**

Replace `card-panel rounded-xl` with `hud-panel`.

Replace header border and title same as PositionsTable.

Replace guard detail container:
```
mt-2 space-y-1 rounded border border-[#1a1d21] bg-[#050608] p-3
```
with:
```
mt-2 space-y-1 rounded border border-border bg-bg-primary p-3
```

In `GuardDetails`, update colors:
- `text-emerald-400` → `text-neon-green`
- `text-red-400` → `text-neon-red`
- `text-[#9ca3af]` → `text-text-secondary`
- Font mono values: `font-mono text-[#9ca3af]` → `font-mono text-text-mono`

Replace skeleton classes with `skeleton`.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/components/PositionsTable.tsx src/app/dashboard/components/ActivityFeed.tsx
git commit -m "feat(ui): cyberpunk tables — venue badges, neon P&L, HUD panels"
```

---

## Task 5: LivePanel — Terminal + Engine Health

**Files:**
- Modify: `src/app/dashboard/components/LivePanel.tsx`

- [ ] **Step 1: Update LEVEL_STYLES color mapping**

Replace the `LEVEL_STYLES` constant:

```typescript
const LEVEL_STYLES: Record<string, { dot: string; text: string }> = {
  info:   { dot: "bg-text-secondary",  text: "text-text-secondary" },
  warn:   { dot: "bg-neon-amber",      text: "text-neon-amber" },
  error:  { dot: "bg-neon-red",        text: "text-neon-red" },
  signal: { dot: "bg-neon-blue",       text: "text-neon-blue" },
  order:  { dot: "bg-neon-green",      text: "text-neon-green" },
  guard:  { dot: "bg-neon-purple",     text: "text-neon-purple" },
};
```

- [ ] **Step 2: Update WsDot component**

Replace:
```
bg-emerald-400
```
with:
```
bg-neon-green shadow-[0_0_6px_rgba(0,255,170,0.6)]
```

Replace:
```
bg-red-400
```
with:
```
bg-neon-red shadow-[0_0_6px_rgba(255,51,102,0.6)]
```

- [ ] **Step 3: Restyle all panel containers**

Find-and-replace throughout LivePanel.tsx:
- `card-panel` → `hud-panel` (all instances)
- `rounded-xl border border-[#1a1d21] bg-[#0e1117]` → `hud-panel` (all instances)
- `border-b border-[#1a1d21]` → `border-b border-border`
- `bg-[#050608]` → `bg-bg-primary`
- `bg-[#0e1117]` → `bg-bg-secondary`
- `bg-[#1a1d21]` → `bg-bg-elevated`
- `text-[#e8e9ea]` → `text-text-primary`
- `text-[#9ca3af]` → `text-text-secondary`
- `text-[#6b7280]` → `text-text-secondary`
- `border-[#1a1d21]` → `border-border`
- `border-[#22262d]` → `border-border`
- `text-emerald-400` → `text-neon-green`
- `bg-emerald-400` → `bg-neon-green`
- `text-red-400` → `text-neon-red`
- `bg-red-400` → `bg-neon-red`
- `text-amber-400` → `text-neon-amber`
- `text-blue-400` → `text-neon-blue`
- `text-purple-400` → `text-neon-purple`

- [ ] **Step 4: Restyle all section headers to mono**

Replace any Cormorant/serif header classes with:
```
font-mono text-xs font-medium uppercase tracking-[0.15em] text-text-secondary
```

- [ ] **Step 5: Restyle the pipeline log container as terminal**

Find the log scrolling container and add a darker inset background. It should use:
```
bg-[#040508] rounded-lg border border-border
```

Ensure log lines use `font-mono text-xs` throughout.

- [ ] **Step 6: Restyle the automation toggle**

The on/off toggle — update its active color from `bg-emerald-500` to `bg-neon-green`. Add `shadow-[0_0_8px_rgba(0,255,170,0.3)]` when active.

The kill switch button — change red styling to use `border-neon-red/50 text-neon-red hover:bg-neon-red/10`. When armed, add `neon-pulse` class.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/components/LivePanel.tsx
git commit -m "feat(ui): cyberpunk live panel — terminal logs, neon status, HUD engine health"
```

---

## Task 6: ActivityTimeline + MarketBrowser + MatchesTable

**Files:**
- Modify: `src/app/dashboard/components/ActivityTimeline.tsx`
- Modify: `src/app/dashboard/components/MarketBrowser.tsx`
- Modify: `src/app/dashboard/components/MatchesTable.tsx`

- [ ] **Step 1: Restyle ActivityTimeline**

Same color replacements as Task 5 Step 3 (find-and-replace old palette → new tokens).

Update `KIND_STYLE` map to use neon colors:
```typescript
const KIND_STYLE: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  signal:   { bg: "bg-neon-blue/10",   text: "text-neon-blue",   dot: "bg-neon-blue",   label: "Signal" },
  decision: { bg: "bg-neon-amber/10",  text: "text-neon-amber",  dot: "bg-neon-amber",  label: "Decision" },
  order:    { bg: "bg-neon-green/10",  text: "text-neon-green",  dot: "bg-neon-green",  label: "Order" },
  fill:     { bg: "bg-neon-green/10",  text: "text-neon-green",  dot: "bg-neon-green",  label: "Fill" },
  position: { bg: "bg-neon-purple/10", text: "text-neon-purple", dot: "bg-neon-purple", label: "Position" },
};
```

Replace all `card-panel` → `hud-panel`.

Restyle the search input. Replace any existing input classes with:
```
w-full rounded-lg bg-[#060810] border border-border px-4 py-2.5 text-sm text-text-primary font-mono placeholder:text-text-secondary focus:outline-none focus:border-neon-blue/50 focus:shadow-[0_0_8px_rgba(0,212,255,0.1)] transition-all
```

- [ ] **Step 2: Restyle MarketBrowser**

Replace `card-panel rounded-xl` with `hud-panel`.

Replace header title Italiana class with:
```
font-mono text-sm font-medium uppercase tracking-[0.1em] text-text-primary
```

Replace sub-tab toggle container `border border-[#1a1d21]` with `border border-border`.
Active sub-tab: `bg-neon-green/10 text-neon-green` instead of `bg-[#1a1d21] text-[#e8e9ea]`.
Inactive: `text-text-secondary hover:text-text-primary`.

Replace venue filter buttons with neon pills:
- Active: `border-neon-blue/30 bg-neon-blue/10 text-neon-blue`
- Inactive: `border-border text-text-secondary hover:text-text-primary`

Restyle the search input same as ActivityTimeline.

For market rows, replace all hardcoded color refs with token classes.

- [ ] **Step 3: Restyle MatchesTable**

Replace all hardcoded colors using the same find-and-replace pattern as Task 5 Step 3.

Replace `card-panel` → `hud-panel` if present.

Edge % column — add dynamic intensity. Where edge values are displayed, use:
```jsx
<span className={`font-mono ${edge > 5 ? "text-neon-green" : edge > 2 ? "text-neon-blue" : "text-text-mono"}`}>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/components/ActivityTimeline.tsx src/app/dashboard/components/MarketBrowser.tsx src/app/dashboard/components/MatchesTable.tsx
git commit -m "feat(ui): cyberpunk activity, markets, matches — neon badges, terminal search"
```

---

## Task 7: Connections + Settings + Founder Tools

**Files:**
- Modify: `src/app/dashboard/components/ApiKeyManager.tsx`
- Modify: `src/app/dashboard/components/SettingsPage.tsx`
- Modify: `src/app/dashboard/components/RiskProfileEditor.tsx`
- Modify: `src/app/dashboard/components/AccessCodeGenerator.tsx`

- [ ] **Step 1: Restyle ApiKeyManager**

Replace the `INPUT_CLASS` constant:
```typescript
const INPUT_CLASS =
  "w-full rounded-lg bg-[#060810] border border-border px-4 py-3 text-text-primary font-mono placeholder:text-text-secondary focus:outline-none focus:border-neon-blue/50 focus:shadow-[0_0_8px_rgba(0,212,255,0.1)] transition-all text-sm";
```

Apply the standard find-and-replace for all hardcoded colors (same as Task 5 Step 3).

Replace `card-panel` / `rounded-xl border border-[#22262d] bg-[#0e1117]` → `hud-panel`.

Connected status indicator — add neon dot:
```jsx
<span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-neon-green">
  <span className="h-1.5 w-1.5 rounded-full bg-neon-green shadow-[0_0_4px_rgba(0,255,170,0.6)]" />
  Connected
</span>
```

"Test Connection" button — restyle to:
```
rounded-lg border border-neon-blue/30 bg-neon-blue/10 px-4 py-2 text-sm font-mono text-neon-blue transition-all hover:bg-neon-blue/20
```

Delete button — restyle to:
```
rounded-lg border border-neon-red/30 px-4 py-2 text-sm font-mono text-neon-red transition-all hover:bg-neon-red/10
```

Save/Submit buttons — restyle to:
```
rounded-lg border border-neon-green/30 bg-neon-green/10 px-4 py-2.5 text-sm font-mono font-medium text-neon-green transition-all hover:bg-neon-green/20 hover:shadow-[0_0_12px_rgba(0,255,170,0.1)]
```

- [ ] **Step 2: Restyle SettingsPage**

Apply standard color replacements.

Upgrade banner — change border to gradient:
```
rounded-xl border border-neon-purple/30 bg-neon-purple/5 p-6
```

"PRO" badge — add glow:
```
rounded-full border border-neon-purple/50 bg-neon-purple/10 px-3 py-0.5 text-[10px] font-mono uppercase tracking-wider text-neon-purple
```

- [ ] **Step 3: Restyle RiskProfileEditor**

Apply standard color replacements.

Section title headers — change to:
```
font-mono text-xs font-medium uppercase tracking-[0.15em] text-text-secondary
```

Replace all input styling to match `INPUT_CLASS` from ApiKeyManager.

Save button — match the neon-green save button style from Step 1.

Preset selector cards:
- Active preset: `border-neon-green/30 bg-neon-green/5`
- Inactive: `border-border bg-bg-secondary hover:border-border-glow`

- [ ] **Step 4: Restyle AccessCodeGenerator**

Replace the container:
```
rounded-xl border border-[#22262d] bg-[#0e1117] p-6
```
with:
```
hud-panel p-6
```

Replace "Generate Code" button:
```
rounded-lg bg-[#e8e9ea] px-4 py-2 text-sm font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb] disabled:opacity-50
```
with:
```
rounded-lg border border-neon-green/30 bg-neon-green/10 px-4 py-2 font-mono text-sm font-medium text-neon-green transition-all hover:bg-neon-green/20 hover:shadow-[0_0_12px_rgba(0,255,170,0.1)] disabled:opacity-50
```

Code display `<code>` — restyle:
```
text-sm font-mono text-neon-green tracking-wider shrink-0
```

Replace code row containers:
```
border-[#22262d] bg-[#1a1d21]
```
with:
```
border-border bg-bg-elevated
```

And the dimmed redeemed variant:
```
border-[#22262d]/60 bg-[#1a1d21]/60
```
→
```
border-border/40 bg-bg-elevated/40
```

Replace claim status `text-emerald-400` → `text-neon-green`, `text-emerald-300` → `text-neon-green/80`.

Replace all `text-[#6b7280]` → `text-text-secondary`, `text-[#9ca3af]` → `text-text-secondary`, `text-[#eceef0]` → `text-text-primary`, `text-[#e8e9ea]` → `text-text-primary`.

Replace Delete and Copy button hover colors to neon equivalents.

Replace skeleton `animate-pulse` → `skeleton`.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/components/ApiKeyManager.tsx src/app/dashboard/components/SettingsPage.tsx src/app/dashboard/components/RiskProfileEditor.tsx src/app/dashboard/components/AccessCodeGenerator.tsx
git commit -m "feat(ui): cyberpunk connections, settings, founder — neon inputs, HUD cards"
```

---

## Task 8: Landing Page + Navbar

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/navbar.tsx`

- [ ] **Step 1: Restyle landing hero**

Replace root div:
```
min-h-screen bg-[#050608] text-[#e8e9ea]
```
→
```
min-h-screen bg-bg-primary text-text-primary
```

Replace subtitle `text-xs font-medium uppercase tracking-[0.2em] text-[#e0e1e3]`:
```
font-mono text-xs font-medium uppercase tracking-[0.25em] text-neon-green/80
```

Replace headline text colors:
- `text-[#f0f0f0]` → `text-text-primary`
- `text-[#f5f5f5]` → `text-text-primary`

Replace paragraph `text-lg text-[#c8ccd2]` → `text-lg text-text-secondary`.

Replace primary CTA button:
```
btn-sheen btn-pill inline-flex bg-[#e8e9ea] px-7 py-3 font-medium text-[#050608] transition-colors hover:bg-[#c0c5cb]
```
→
```
btn-sheen btn-pill inline-flex border border-neon-green/50 bg-neon-green/10 px-7 py-3 font-mono font-medium text-neon-green transition-all hover:bg-neon-green/20 hover:shadow-[0_0_20px_rgba(0,255,170,0.15)]
```

Replace secondary CTA:
```
btn-pill inline-flex border border-[#1a1d21] px-7 py-3 font-medium transition-colors hover:border-[#c0c5cb]
```
→
```
btn-pill inline-flex border border-border px-7 py-3 font-mono font-medium text-text-secondary transition-all hover:border-neon-blue/30 hover:text-neon-blue
```

- [ ] **Step 2: Restyle features section**

Replace section border `border-t border-[#1a1d21]` → `border-t border-border`.

Replace heading Italiana: keep font but add:
```
text-center text-3xl font-[family-name:var(--font-italiana)] font-normal uppercase tracking-[0.08em] text-text-primary
```

Replace feature `card-panel rounded-xl p-8` → `hud-panel p-8`.

Replace feature title Cormorant → keep but update color:
```
font-[family-name:var(--font-cormorant)] text-xl font-medium text-text-primary
```

Replace feature description `text-sm leading-relaxed text-[#9ca3af]` → `text-sm leading-relaxed text-text-secondary`.

- [ ] **Step 3: Restyle footer**

Replace `border-t border-[#1a1d21]` → `border-t border-border`.

Replace `text-[#9ca3af]` → `text-text-secondary`.

- [ ] **Step 4: Update navbar.tsx**

Apply standard color replacements — all hardcoded hex values → token classes.

The nav spotlight was already updated in globals.css (Task 1 Step 12).

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/navbar.tsx
git commit -m "feat(ui): cyberpunk landing — neon CTAs, HUD feature cards, green spotlight"
```

---

## Task 9: Final Polish + Visual QA

**Files:**
- Modify: `src/app/layout.tsx` (if body bg needs updating)
- All previously modified files (spot fixes)

- [ ] **Step 1: Update root layout body background**

In `src/app/layout.tsx`, if there's any hardcoded `bg-[#050608]` on the body or html element, change to reference the CSS variable (already set in globals.css).

- [ ] **Step 2: Global find-and-replace for any remaining old colors**

Search across all dashboard components for any remaining hardcoded hex values that should be tokens:

```bash
cd src/app/dashboard/components
grep -rn "#050608\|#0e1117\|#1a1d21\|#22262d\|#e8e9ea\|#9ca3af\|#c0c5cb\|#6b7280\|#3b3f46\|emerald-400\|red-400\|amber-400\|blue-400\|purple-400" *.tsx
```

Fix any remaining instances using the standard replacements.

- [ ] **Step 3: Verify `card-panel` is fully replaced**

```bash
grep -rn "card-panel" src/
```

If any remain, replace with `hud-panel`.

- [ ] **Step 4: Run the dev server and visually check each tab**

```bash
npm run dev
```

Open `http://localhost:3000` and verify:
- Landing hero has neon-green glow + green CTAs
- Dashboard grid overlay visible
- Scan line animation visible (very subtle)
- All 7 tabs render without errors
- Nav tabs show neon-green active indicator
- Stats cards have corner tick-marks
- P&L values glow green/red
- Live panel logs look terminal-like
- Market browser search has blue focus glow
- Connections page shows neon status indicators
- Settings inputs have blue focus ring

- [ ] **Step 5: Run the build to check for errors**

```bash
npm run build
```

Fix any type errors or build failures.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(ui): cyberpunk HUD overhaul — final polish and color cleanup"
```

---

## Summary

| Task | What | Files | Est. |
|------|------|-------|------|
| 1 | CSS foundation — tokens, HUD panel, grid, scan line | globals.css | 5 min |
| 2 | Nav bar — neon tabs, gradient border, live indicator | DashboardShell.tsx | 5 min |
| 3 | Stat + balance cards — HUD panels, neon values | StatsBar, BalanceBar | 4 min |
| 4 | Tables — venue badges, neon P&L | PositionsTable, ActivityFeed | 4 min |
| 5 | Live panel — terminal logs, engine health | LivePanel | 5 min |
| 6 | Activity + Markets — neon badges, search inputs | ActivityTimeline, MarketBrowser, MatchesTable | 5 min |
| 7 | Connections + Settings + Founder | ApiKeyManager, SettingsPage, RiskProfileEditor, AccessCodeGenerator | 5 min |
| 8 | Landing page + navbar | page.tsx, navbar.tsx | 4 min |
| 9 | Final polish + QA | All files | 5 min |
