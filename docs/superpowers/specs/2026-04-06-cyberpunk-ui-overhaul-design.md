# Neutralis.ai — Cyberpunk HUD UI Overhaul

**Date:** 2026-04-06
**Scope:** Visual overhaul of all dashboard pages + landing. No new features — pure aesthetic + polish.
**Vibe:** Sci-fi trading terminal. Animated grid lines, neon glow accents, real-time ticking numbers, matrix-style data streams. Think Bloomberg Terminal meets Ghost in the Shell.

---

## 1. Design System Overhaul

### Color Palette — "Neon Titanium"

Replace the muted silver palette with high-contrast cyberpunk colors:

| Token | Current | New | Use |
|-------|---------|-----|-----|
| `--bg-primary` | `#050608` | `#030306` | Deeper black base |
| `--bg-secondary` | `#0e1117` | `#0a0c12` | Card/panel bg |
| `--bg-elevated` | — | `#0d1018` | Hover/active states |
| `--border` | `#22262d` | `#1a1e2a` | Default borders |
| `--border-glow` | — | `rgba(0, 255, 170, 0.15)` | Active/focus border glow |
| `--neon-green` | — | `#00ffaa` | Primary accent — live/success states |
| `--neon-blue` | — | `#00d4ff` | Secondary accent — info/links |
| `--neon-purple` | — | `#a855f7` | Tertiary — signals/guards |
| `--neon-red` | — | `#ff3366` | Error/loss/kill switch |
| `--neon-amber` | — | `#ffaa00` | Warnings |
| `--text-primary` | `#eceef0` | `#e0e4ea` | Body text |
| `--text-secondary` | `#a1a8b3` | `#5a6578` | Muted text |
| `--text-mono` | — | `#8892a0` | Monospace data |

### Typography

- **Headlines:** Keep Italiana for brand, add `text-shadow: 0 0 30px rgba(0,255,170,0.15)` on hero
- **Labels:** Switch from Cormorant to Geist Mono uppercase with wide tracking — more terminal feel
- **Data values:** All numbers in Geist Mono, with tabular-nums for alignment
- **Font size bump:** Stat values from `text-2xl` to `text-3xl` for impact

### Micro-Interactions

- **Number transitions:** All stat values use CSS `transition` + JS counter animation when values change (count up/down over 400ms)
- **Glow pulse:** Active states get a subtle neon pulse keyframe (0.15 → 0.05 opacity, 2s ease)
- **Scan line:** Subtle horizontal scan line animation across panels (very low opacity, 8s cycle)
- **Data stream:** Background subtle matrix-rain in hero section only (canvas, very faded)
- **Tab switch:** Slide-in from right with 200ms ease-out, 5% opacity fade
- **Card hover:** Border shifts from `--border` to `--border-glow` + 1px box-shadow glow

---

## 2. Global CSS — New Effects

### Grid Overlay
Faint grid pattern across the entire dashboard background (not landing):
```css
.dashboard-grid {
  background-image:
    linear-gradient(rgba(0,255,170,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,255,170,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

### Scan Line
```css
@keyframes scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}
.scan-line::before {
  content: "";
  position: fixed;
  left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(0,255,170,0.06), transparent);
  animation: scanline 8s linear infinite;
  pointer-events: none;
  z-index: 98;
}
```

### Panel Glow Border
```css
.hud-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  position: relative;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.hud-panel:hover {
  border-color: var(--border-glow);
  box-shadow: 0 0 20px rgba(0,255,170,0.05), inset 0 0 20px rgba(0,255,170,0.02);
}
```

### Corner Accents (HUD frame)
Top-left and bottom-right corner tick marks on panels — pure CSS:
```css
.hud-panel::before, .hud-panel::after {
  content: "";
  position: absolute;
  width: 12px; height: 12px;
  border-color: rgba(0,255,170,0.3);
  border-style: solid;
  pointer-events: none;
}
.hud-panel::before {
  top: -1px; left: -1px;
  border-width: 1px 0 0 1px;
}
.hud-panel::after {
  bottom: -1px; right: -1px;
  border-width: 0 1px 1px 0;
}
```

---

## 3. Navigation Overhaul

### Top Nav Bar
- **Background:** `rgba(3,3,6,0.85)` with `backdrop-blur-xl` (heavier blur)
- **Bottom border:** Replace solid with gradient: `linear-gradient(90deg, transparent, rgba(0,255,170,0.2), transparent)`
- **Logo:** Add subtle neon-green text-shadow on hover
- **Active tab indicator:** Replace bg highlight with bottom neon line (2px, `--neon-green`) + text color `--neon-green`
- **Inactive tabs:** `--text-secondary` → glow on hover
- **External links (Kalshi/Poly icons):** Ring glow on hover
- **Live indicator:** Stronger pulse animation, neon-green dot with box-shadow glow
- **Refresh button:** Rotate 360deg on click (not just 45deg)

### Tab Transitions
Active tab content slides in with `translateX(8px)` → `translateX(0)` + fade, 200ms.

---

## 4. Dashboard Tab

### Balance Cards
- Add HUD corner accents
- Venue icon gets a subtle colored ring (Kalshi = blue glow, Poly = purple glow)
- Balance value: `text-3xl font-mono` with tabular-nums
- "Not connected" state: pulsing dashed border + neon CTA button

### Stats Bar (4 KPI cards)
- Labels: `font-mono uppercase text-[10px] tracking-[0.2em]` in `--text-secondary`
- Values: `text-3xl font-mono font-bold`
- P&L positive: `--neon-green` with subtle text-shadow
- P&L negative: `--neon-red` with subtle text-shadow
- Each card gets a thin top-border accent line (1px gradient matching its semantic color)
- Skeleton loader: Replace solid pulse with animated gradient sweep (left-to-right)

### Positions Table
- Header row: `font-mono text-[10px] uppercase tracking-widest` in `--text-secondary`
- Row hover: subtle `--border-glow` left-border highlight
- Venue badge: Small colored dot (Kalshi=blue, Poly=purple) + text
- P&L cell: Color-coded with neon green/red, mono font
- Status badge: Outlined pill with neon color border, not filled
- Empty state: "No open positions" with scan-line animation behind text

### Activity Feed
- Timeline line: vertical dashed line in `--border`, dots color-coded by type
- Signal type badges: Outlined neon pills (green=pass, red=reject, blue=signal)
- Timestamps: `font-mono text-[10px]` right-aligned
- Expand animation: slide-down with 150ms ease

---

## 5. Live Tab

### Engine Health Panel
- WebSocket status indicators: Large neon dots with glow + box-shadow
- Connected: Pulsing `--neon-green` with `0 0 8px` shadow
- Disconnected: Solid `--neon-red`
- Market counts: Big mono numbers with label underneath
- Overall status: Full-width bar at top — green gradient if healthy, red if degraded

### Automation Controls
- ON/OFF toggle: Custom switch with neon-green track when active, subtle glow
- Kill switch: Red outlined button, armed state gets pulsing red border + warning icon
- Status text: Mono font, uppercase

### Pipeline Logs
- Terminal-style panel with dark inset background (`#040508`)
- Each log line: colored dot + timestamp + message, all mono
- Auto-scroll with "pinned to bottom" behavior
- Level colors: info=gray, warn=amber, error=red, signal=blue, order=green, guard=purple
- New log entries fade in from left (translateX -10px → 0, 150ms)

### Decision Feed
- Cards with HUD panel styling
- Verdict badge: PASS=neon-green outlined, REJECT=neon-red outlined
- Guard results: Expandable, each guard as a mini status line (checkmark/x + name)
- Edge %: Large mono number with color intensity based on magnitude

---

## 6. Activity Tab

### Timeline View
- Left vertical line: gradient from `--neon-green` at top to `--border` at bottom
- Each entry: dot on timeline + card extending right
- Signal type as outlined badge
- Guard details expandable with smooth reveal
- Search input: Dark inset with neon-blue focus ring

---

## 7. Markets Tab

### Market Browser
- Sub-tab toggle: Segmented control with neon underline indicator (not bg fill)
- Search bar: Full-width, dark inset bg, neon-blue focus glow
- Venue filter: Outlined pill buttons, active = neon border
- Market rows: Mono prices, alternating subtle bg stripes
- Price columns: YES prices in green tint, NO prices in red tint
- Spread highlight: If bid-ask spread is tight, subtle green glow on row

### Pairs/Matches Table
- Edge % column: Color-coded gradient (higher edge = more intense green)
- Venue pair: Show both venue badges side by side
- Confidence score: Mini progress bar with neon fill

---

## 8. Connections Tab

### API Key Manager
- Each venue connection: Full HUD panel with corner accents
- Connected state: Neon-green status dot + "CONNECTED" in mono uppercase
- Disconnected: Dashed border, "CONNECT" CTA button with neon glow
- Key display: Masked with `***` in mono, reveal on hover
- Test connection button: Outlined, loading state shows spinning neon ring
- Delete: Red outlined, confirm modal with red glow border
- File upload (PEM): Drop zone with dashed neon border, drag-hover glow

---

## 9. Settings Tab

### Risk Profile Editor
- Preset selector: 4 cards (Conservative/Moderate/Aggressive/Custom) with radio-style selection
- Active preset: Neon-green border + corner accents
- Sliders/inputs: Custom range inputs with neon track fill
- Section headers: Mono uppercase with faint horizontal rule
- Save button: Primary neon-green, glow on hover
- Upgrade banner: Gradient border (purple → blue), "PRO" badge with glow

---

## 10. Founder Tools Tab

### Access Code Generator
- Code display: Large mono font in a "terminal output" styled box
- Generate button: Neon-green with scan-line hover effect
- Copy button: Subtle, confirms with brief green flash

---

## 11. Landing Page

### Hero Section
- Keep breathing glow but shift to neon-green/blue tones
- Add faint animated grid in background (canvas or CSS)
- Headline: Italiana with very subtle neon text-shadow
- CTA buttons: Primary = neon-green fill with glow, Secondary = outlined with neon border
- Stats ticker: Animated counting numbers below hero (markets scanned, signals today, etc.)

### Nav Bar
- Same spotlight effect but with neon-green tint instead of white
- Active link: Neon underline

---

## 12. Shared Component Patterns

### Skeleton Loaders
Replace solid pulse with animated gradient sweep:
```css
@keyframes skeleton-sweep {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, #0a0c12 25%, #141820 50%, #0a0c12 75%);
  background-size: 200% 100%;
  animation: skeleton-sweep 1.5s ease infinite;
}
```

### Status Badges
Outlined pills, not filled:
- Pass/Success: `border-[--neon-green] text-[--neon-green]`
- Reject/Error: `border-[--neon-red] text-[--neon-red]`
- Signal/Info: `border-[--neon-blue] text-[--neon-blue]`
- Warning: `border-[--neon-amber] text-[--neon-amber]`
- Guard: `border-[--neon-purple] text-[--neon-purple]`

### Buttons
- **Primary:** `bg-[--neon-green]/10 border border-[--neon-green]/50 text-[--neon-green]` + glow on hover
- **Secondary:** `border border-[--border] text-[--text-secondary]` + border-glow on hover
- **Danger:** `border border-[--neon-red]/50 text-[--neon-red]` + red glow on hover

### Tables
- Header: `font-mono text-[10px] uppercase tracking-[0.2em] text-[--text-secondary]`
- Rows: Subtle alternating bg, hover highlights left border with accent color
- Monospace for all numerical data

### Inputs
- Dark inset background (`#060810`)
- Border: `--border` default, `--neon-blue` on focus with box-shadow glow
- Placeholder: `--text-secondary`

---

## 13. Performance Considerations

- All animations use `transform` and `opacity` only (GPU-composited)
- Grid overlay is a single CSS background on the layout div, not an extra element
- Scan line is a single fixed pseudo-element
- Canvas matrix-rain only on landing hero, destroyed on navigate
- `will-change` on animated elements, removed after animation
- Number counter animations use `requestAnimationFrame`, not setInterval
- Reduced motion: All animations disabled via `prefers-reduced-motion` media query

---

## 14. Files to Modify

| File | Changes |
|------|---------|
| `globals.css` | New color tokens, grid overlay, scan line, HUD panel, skeleton, button styles |
| `DashboardShell.tsx` | Nav overhaul, tab transitions, grid bg on dashboard container |
| `StatsBar.tsx` | New card styling, number animations, accent top borders |
| `BalanceBar.tsx` | HUD panels, venue glow rings, connected/disconnected states |
| `PositionsTable.tsx` | Table styling, venue badges, P&L colors, row hover |
| `ActivityFeed.tsx` | Timeline styling, signal badges, expand animation |
| `LivePanel.tsx` | Engine health panel, log terminal, automation controls |
| `ActivityTimeline.tsx` | Timeline gradient, entry cards, search input |
| `MarketBrowser.tsx` | Search bar, venue filters, price coloring, pairs table |
| `MatchesTable.tsx` | Edge highlighting, venue pairs, confidence bars |
| `ApiKeyManager.tsx` | Connection cards, status indicators, test/delete buttons |
| `SettingsPage.tsx` | Preset cards, upgrade banner |
| `RiskProfileEditor.tsx` | Slider styling, section headers, save button |
| `AccessCodeGenerator.tsx` | Terminal output box, generate button |
| `page.tsx` (landing) | Hero glow colors, grid bg, CTA buttons, nav tint |
| `navbar.tsx` | Neon spotlight, active link styling |
| `layout.tsx` (dashboard) | Grid background wrapper |

No new files needed — pure modification of existing components.

---

## 15. What This Does NOT Change

- No new features or pages
- No changes to API routes or data fetching logic
- No changes to auth flow
- No changes to Supabase queries
- No changes to TypeScript types
- No structural changes to component hierarchy
- No new dependencies (pure CSS + existing Tailwind)
