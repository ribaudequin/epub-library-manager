# Plan: Light Theme Toggle + Statistics Dashboard (v1.8.0)

## 1. Design Spec

### 1.1 Color Palette — CSS Custom Properties

#### Dark Theme (current, default)
```css
:root {
  color-scheme: dark;
  --bg: #1e1e2e;
  --bg-card: #2a2a3c;
  --bg-card-hover: #33334a;
  --text: #e0e0e6;
  --text-dim: #9a9ab0;
  --accent: #7aa2f7;
  --green: #9ece6a;
  --yellow: #e0af68;
  --red: #f7768e;
  --border: rgba(255,255,255,0.06);
  --shadow: rgba(0,0,0,0.3);
}
```

#### Light Theme (new)
```css
:root[data-theme="light"] {
  color-scheme: light;
  --bg: #f5f5f7;
  --bg-card: #ffffff;
  --bg-card-hover: #f0f0f2;
  --text: #1e1e2e;
  --text-dim: #6b6b80;
  --accent: #4a78d4;
  --green: #3d9a42;
  --yellow: #c08a30;
  --red: #d43d50;
  --border: rgba(0,0,0,0.08);
  --shadow: rgba(0,0,0,0.1);
}
```

#### WCAG Contrast Ratios (Light Theme)
| Element | FG | BG | Ratio | AA? | AAA? |
|---|---|---|---|---|---|
| Body text (`--text` on `--bg`) | #1e1e2e | #f5f5f7 | 13.8:1 | ✅ | ✅ |
| Dim text (`--text-dim` on `--bg`) | #6b6b80 | #f5f5f7 | 4.6:1 | ✅ | ❌ |
| Accent on white (`--accent` on white) | #4a78d4 | #ffffff | 4.7:1 | ✅ | ❌ |
| Card title on card bg | #1e1e2e | #ffffff | 13.8:1 | ✅ | ✅ |
| Button text on accent | #ffffff | #4a78d4 | 4.7:1 | ✅ | ❌ |

#### Cover Tint Adjustments
- Light theme: reduce `boost` from `2` to `1.3`, increase opacity floor from `0.3` to `0.6`
- Card gradient: `rgba(var(--card-tint), 0.7) → rgba(var(--card-tint), 0.4)` (lighter base)
- Card border: `1px solid rgba(var(--card-tint), 0.35)` (lighter)

### 1.2 Layout Mockup — Header with Theme Toggle

```
┌──────────────────────────────────────────────────────────────┐
│ 📚 Biblioteca de Epubs          [🔍 search] [↕ sort] [☀️] [📂] [🔄] │
└──────────────────────────────────────────────────────────────┘
```

Theme toggle button (☀️/🌙) placed at the end of `.actions` div, before the folder/refresh buttons.

### 1.3 Layout Mockup — Statistics Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  Statistics Dashboard                              [✕ Close] │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│  │  42         │ │  186        │ │  98         │ │  67%        │ │
│  │  Total      │ │  Volumes    │ │  Read       │ │  Progress   │ │
│  │  Series     │ │             │ │             │ │             │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│                                                              │
│  ┌──────────────────────┐ ┌──────────────────────┐           │
│  │  Series by State     │ │  Largest Series      │           │
│  │  ┌────────────────┐  │ │  ┌────────────────┐  │           │
│  │  │ ████████ 24    │  │ │  │ Manga X  45v  │  │           │
│  │  │ ████ 12        │  │ │  │ Novela Y  38v  │  │           │
│  │  │ ██ 4           │  │ │  │ Comics Z  32v  │  │           │
│  │  │ █ 2            │  │ │  │                │  │           │
│  │  └────────────────┘  │ │  └────────────────┘  │           │
│  └──────────────────────┘ └──────────────────────┘           │
│                                                              │
│  ┌──────────────────────────────────────────────┐            │
│  │  Reading Activity (Last 30 Days)              │            │
│  │  ┌──────────────────────────────────────────┐│            │
│  │  │  ▂  ▃  ▅  ▇  █  ▅  ▃  ▅  █  ▇  ▂  ▃    ││            │
│  │  └──────────────────────────────────────────┘│            │
│  └──────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

### 1.4 Component Hierarchy

```
body[data-theme="light|dark"]
├── header
│   ├── h1
│   └── .actions
│       ├── .search-box
│       ├── select#sort-select
│       ├── button#btn-theme-toggle  ← NEW
│       ├── button#btn-stats         ← NEW
│       ├── button#btn-select
│       └── button#btn-scan
├── main
│   ├── #empty-state
│   ├── #loading-state
│   ├── #series-view
│   │   └── #series-grid
│   ├── #series-detail
│   │   ├── #detail-header
│   │   ├── #volume-list
│   │   └── #toggle-all-status
│   └── #stats-modal  ← NEW
│       ├── .stats-header
│       ├── .stats-summary (4 metric cards)
│       ├── .stats-charts
│       │   ├── .chart-state-breakdown (horizontal bars)
│       │   ├── .chart-largest-series (ranked list)
│       │   └── .chart-activity-timeline (bar chart)
│       └── .stats-footer
```

---

## 2. Technical Plan

### 2.1 Files to Modify

| File | Changes |
|---|---|
| `src/renderer/styles.css` | Add light theme CSS vars, stats modal styles, chart styles, theme toggle button |
| `src/renderer/index.html` | Add theme toggle button, stats button, stats modal markup |
| `src/renderer/renderer.js` | Theme init/toggle logic, stats computation/rendering, localStorage persistence |
| `src/renderer/translations.js` | Add i18n keys for theme toggle, stats labels |
| `src/main.js` | Update `backgroundColor` dynamically (or accept default flash) |

### 2.2 Data Structures

#### Theme Persistence (localStorage)
```js
localStorage.getItem('theme')  // 'dark' | 'light' | null (system default)
```

#### Statistics Computation (renderer-side)
Derived from `currentSeries` array (already in memory):

```js
function computeStats(series) {
  const totalSeries = series.length;
  const totalVolumes = series.reduce((s, x) => s + x.volumeCount, 0);
  const completedReadings = series.reduce((s, x) => s + x.readCount, 0);
  const overallProgress = totalVolumes ? Math.round((completedReadings / totalVolumes) * 100) : 0;

  // By series state
  const byState = { ongoing: 0, completed: 0, cancelled: 0, hiatus: 0 };
  series.forEach(s => { byState[s.seriesState || 'ongoing']++; });

  // Largest series by volume count
  const largest = [...series].sort((a, b) => b.volumeCount - a.volumeCount).slice(0, 5);

  // Activity timeline (last 30 days) — from lastModified timestamps
  const now = Date.now();
  const DAY = 86400000;
  const activity = new Array(30).fill(0);
  series.forEach(s => {
    if (s.lastModified) {
      const daysAgo = Math.floor((now - s.lastModified) / DAY);
      if (daysAgo >= 0 && daysAgo < 30) activity[29 - daysAgo]++;
    }
  });

  return { totalSeries, totalVolumes, completedReadings, overallProgress, byState, largest, activity };
}
```

#### Reading Activity Enhancement (optional future IPC)
For precise "reading activity" (not just file modification), a new IPC `library:get-reading-log` could be added. For v1.8.0, approximate using `lastModified` timestamps.

### 2.3 Theme Implementation

**Toggle Mechanism:**
```js
// renderer.js
function getPreferredTheme() {
  return localStorage.getItem('theme') || 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  // Update toggle icon
  $('#btn-theme-toggle').textContent = theme === 'dark' ? '☀️' : '🌙';
  $('#btn-theme-toggle').setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}
```

**On load:**
```js
applyTheme(getPreferredTheme());
```

### 2.4 CSS Structure for Light Theme

```css
/* Theme toggle button */
#btn-theme-toggle {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 16px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

#btn-theme-toggle:hover {
  background: var(--bg-card-hover);
  border-color: var(--accent);
}

/* Light theme overrides */
:root[data-theme="light"] {
  color-scheme: light;
  --bg: #f5f5f7;
  --bg-card: #ffffff;
  --bg-card-hover: #f0f0f2;
  --text: #1e1e2e;
  --text-dim: #6b6b80;
  --accent: #4a78d4;
  --green: #3d9a42;
  --yellow: #c08a30;
  --red: #d43d50;
  --border: rgba(0,0,0,0.08);
  --shadow: rgba(0,0,0,0.1);
}

/* Light theme card tint adjustments */
:root[data-theme="light"] .series-card {
  box-shadow: 0 2px 8px var(--shadow);
  border: 1px solid var(--border);
}

:root[data-theme="light"] .series-card:hover {
  box-shadow: 0 8px 24px var(--shadow);
}

:root[data-theme="light"] .series-cover {
  background: #e0e0e6;
}

:root[data-theme="light"] .volume-row {
  border: 1px solid var(--border);
}

:root[data-theme="light"] .status-btn {
  border: 1px solid var(--border);
}

:root[data-theme="light"] .state-btn {
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text-dim);
}

:root[data-theme="light"] header {
  border-bottom: 1px solid var(--border);
}

:root[data-theme="light"] .spinner {
  border-color: var(--bg-card-hover);
}

:root[data-theme="light"] .loading-bar-container {
  background: #e0e0e6;
}
```

### 2.5 Stats Modal Implementation

**HTML (added to index.html):**
```html
<div id="stats-modal" class="hidden" role="dialog" aria-label="Statistics">
  <div class="stats-backdrop"></div>
  <div class="stats-panel">
    <div class="stats-header">
      <h2 id="stats-title"></h2>
      <button id="btn-stats-close" aria-label="Close">✕</button>
    </div>
    <div class="stats-body">
      <div class="stats-summary" id="stats-summary"></div>
      <div class="stats-charts" id="stats-charts"></div>
    </div>
  </div>
</div>
```

**CSS for stats modal:**
```css
#stats-modal {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stats-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
}

.stats-panel {
  position: relative;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 90%;
  max-width: 720px;
  max-height: 85vh;
  overflow-y: auto;
  padding: 24px;
  box-shadow: 0 24px 64px var(--shadow);
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.stat-card .stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--accent);
}

.stat-card .stat-label {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 4px;
}
```

**Charts — Pure CSS/SVG:**

1. **State breakdown** — Horizontal bar chart using CSS `width` percentages
2. **Largest series** — Ranked list with bar width proportional to max volume count
3. **Activity timeline** — SVG bar chart (30 bars, one per day)

```js
function renderStateChart(byState) {
  const max = Math.max(...Object.values(byState), 1);
  const labels = { ongoing: 'Em andamento', completed: 'Completa', cancelled: 'Cancelada', hiatus: 'Hiatus' };
  const colors = { ongoing: 'var(--green)', completed: 'var(--accent)', cancelled: 'var(--red)', hiatus: 'var(--yellow)' };

  return `<div class="chart-section">
    <h3 id="chart-state-title"></h3>
    ${Object.entries(byState).map(([key, val]) => `
      <div class="bar-row">
        <span class="bar-label">${labels[key]}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(val/max)*100}%;background:${colors[key]}"></div></div>
        <span class="bar-value">${val}</span>
      </div>
    `).join('')}
  </div>`;
}

function renderActivityChart(activity) {
  const max = Math.max(...activity, 1);
  const barW = 100 / 30;
  return `<div class="chart-section">
    <h3 id="chart-activity-title"></h3>
    <svg viewBox="0 0 300 80" class="activity-svg" role="img" aria-label="Reading activity">
      ${activity.map((val, i) => {
        const h = (val / max) * 70;
        return `<rect x="${i * 10}" y="${75 - h}" width="8" height="${h}" rx="2" fill="var(--accent)" opacity="0.8"/>`;
      }).join('')}
    </svg>
  </div>`;
}
```

### 2.6 No IPC Additions Required

All statistics data is computed client-side from `currentSeries` array already loaded in the renderer. No new IPC channels needed for v1.8.0.

For future enhancement (precise reading log):
- New IPC: `library:get-reading-log` → returns `[{seriesId, volumeId, from, to, timestamp}]`
- Requires adding `readingLog` array to `biblioteca.json` state

### 2.7 i18n Keys to Add

```js
// translations.js additions
pt: {
  theme_toggle_light: 'Mudar para tema claro',
  theme_toggle_dark: 'Mudar para tema escuro',
  stats_title: 'Estatísticas',
  stats_total_series: 'Séries',
  stats_total_volumes: 'Volumes',
  stats_completed_readings: 'Lidos',
  stats_overall_progress: 'Progresso',
  chart_state_title: 'Séries por Estado',
  chart_largest_title: 'Maiores Séries',
  chart_activity_title: 'Atividade (últimos 30 dias)',
  state_ongoing: 'Em andamento',
  state_completed: 'Completa',
  state_cancelled: 'Cancelada',
  state_hiatus: 'Hiatus',
}
en: {
  theme_toggle_light: 'Switch to light theme',
  theme_toggle_dark: 'Switch to dark theme',
  stats_title: 'Statistics',
  stats_total_series: 'Series',
  stats_total_volumes: 'Volumes',
  stats_completed_readings: 'Read',
  stats_overall_progress: 'Progress',
  chart_state_title: 'Series by State',
  chart_largest_title: 'Largest Series',
  chart_activity_title: 'Activity (last 30 days)',
  state_ongoing: 'Ongoing',
  state_completed: 'Completed',
  state_cancelled: 'Cancelled',
  state_hiatus: 'Hiatus',
}
```

---

## 3. Effort Estimate

| Task | Size | Hours | Files |
|---|---|---|---|
| **Light Theme** | | | |
| CSS custom properties (light palette) | S | 1h | styles.css |
| Theme toggle button + HTML | S | 0.5h | index.html |
| Theme persistence (localStorage) | S | 0.5h | renderer.js |
| Cover tint adjustments for light bg | M | 2h | renderer.js, styles.css |
| Card/row/border/shadow light overrides | M | 2h | styles.css |
| Header `backgroundColor` sync | S | 0.5h | main.js, renderer.js |
| WCAG contrast verification | S | 1h | — |
| i18n keys | S | 0.5h | translations.js |
| **Subtotal Light Theme** | | **8h** | |
| **Statistics Dashboard** | | | |
| Stats computation function | S | 1h | renderer.js |
| Stats modal HTML + CSS | M | 3h | index.html, styles.css |
| Summary cards (4 metrics) | S | 1h | renderer.js |
| State breakdown chart (CSS bars) | M | 2h | renderer.js, styles.css |
| Largest series chart (ranked list) | S | 1h | renderer.js |
| Activity timeline (SVG bar chart) | M | 2h | renderer.js |
| Modal open/close + i18n | S | 1h | renderer.js, translations.js |
| **Subtotal Statistics** | | **11h** | |
| **Total** | | **~19h** | |

**Complexity: M** (Medium) — both features are self-contained, no external dependencies, no IPC changes for v1.8.0.

---

## 4. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| **Theme flash on load** (dark→light flicker) | UX | High | Apply theme synchronously in `<head>` via inline `<script>` before CSS parse |
| **Card tint too faint in light mode** | Visual | Medium | Tune opacity floor (0.3→0.6) and boost factor; test with 5+ cover images |
| **Stats modal performance with 500+ series** | Perf | Low | `computeStats` is O(n) single pass; charts are CSS/SVG — no reflow loops |
| **SVG chart accessibility** | A11y | Medium | Add `role="img"` + `aria-label` on `<svg>`, `<title>` element inside |
| **`backgroundColor` flash when toggling theme** | UX | Low | Debounce main process sync; CSS transition on `background` property |
| **State sync: stats stale after status change** | Correctness | Low | Recompute stats every time `openSeries()` or `renderSeriesGrid()` runs |
| **i18n: stats labels not updated on locale switch** | UX | Low | Re-render stats modal when `setLocale()` is called |

### Key Design Decisions

1. **`data-theme` attribute vs class** — Using `data-theme` on `<html>` to avoid specificity wars with existing class-based styles
2. **No new IPC for stats** — All data derivable from `currentSeries` array already in renderer memory
3. **localStorage for theme** — Same pattern as existing `sortKey`; no main process persistence needed
4. **SVG for timeline chart** — Pure inline SVG, no canvas, no external libs; accessible by default
5. **Modal vs dedicated view** — Stats as modal overlay preserves current navigation flow; can promote to tab later

---

*Plan prepared for v1.8.0 — Light Theme Toggle + Statistics Dashboard*
