# Wave 4 — Codex Prompts

Copy-paste each prompt into Codex. Each should be its own branch.

---

## Prompt 1: Onboarding Wizard

Branch: `codex/onboarding-wizard`

```
Build a first-run onboarding wizard at src/app/(app)/onboarding/page.tsx.

Requirements:
- Multi-step wizard (4-5 steps) with progress indicator
- Step 1: Welcome screen with product overview
- Step 2: Connect to OpenClaw — URL + password input with live connection test
- Step 3: Set a monthly budget limit and pick a model preset (Fast/Balanced/Quality)
- Step 4: Optional — import API keys to the vault
- Step 5: Success screen with "Go to Dashboard" CTA
- Store onboarding completion flag in data/settings.json (onboardingComplete: true)
- If onboardingComplete is false or missing, redirect from dashboard to /onboarding
- Check logic in src/app/(app)/layout.tsx or a client wrapper
- Glass-morphism dark theme: glass classes, border-[var(--glass-border)], bg-white/[0.04]
- Animated transitions between steps (CSS or framer-motion if already installed)
- Skip button on every step (except step 1)
- Data: reads/writes via existing API routes (/api/connection, /api/settings, /api/key-vault)
- No new API route needed — reuse existing ones
- Sidebar: no entry (wizard is a one-time flow)
- Command palette: add entry with keywords ['onboarding', 'wizard', 'setup', 'first run', 'getting started']
```

---

## Prompt 2: Changelog / What's New

Branch: `codex/changelog`

```
Build an in-app changelog at src/app/(app)/changelog/page.tsx.

Requirements:
- Changelog page showing version history with release notes
- Each entry: version number, date, list of changes (grouped by Added/Improved/Fixed)
- Data: data/changelog.json — seed with v1.0 through v1.3 entries covering shipped features
- API: src/app/api/changelog/route.ts — GET (list entries), POST (add entry, auth required)
- "What's New" modal that auto-shows once after app update:
  - Compare latest changelog version vs data/settings.json lastSeenVersion
  - If newer version exists, show modal on dashboard load
  - Dismissing updates lastSeenVersion
  - Add modal component at src/components/changelog/whats-new-modal.tsx
  - Import modal in dashboard page or app layout
- Sidebar: add to workspaceNav with Sparkles icon, name "Changelog"
- Command palette: add entry with keywords ['changelog', 'release', 'update', 'whats new', 'version']
- Glass-morphism dark theme consistent with rest of app
```

---

## Prompt 3: Team Dashboard / Usage Leaderboard

Branch: `codex/team-dashboard`

```
Build a team usage dashboard at src/app/(app)/team-dashboard/page.tsx.

Requirements:
- Leaderboard view showing per-user and per-agent token usage rankings
- Time range selector: Today, This Week, This Month, All Time
- Metrics per entry: total tokens, total cost, sessions count, avg cost per session
- Bar chart visualization (use recharts, already installed)
- "Waste detector" section: highlights sessions with high token count but low completion rate
- Data: data/team-usage.json — seed with sample team data (3-4 users, 5-6 agents)
- API: src/app/api/team-dashboard/route.ts — GET with ?range= param
- Component: src/components/team/team-dashboard.tsx
- Sidebar: add to monitorNav with UsersRound icon, name "Team Usage"
- Command palette: add entry with keywords ['team', 'leaderboard', 'usage', 'ranking', 'waste']
- Glass-morphism dark theme, glass classes, consistent with cost dashboard styling
```

---

## Prompt 4: Favorites / Pinned Pages

Branch: `codex/pinned-pages`

```
Add a pinned/favorites system to the sidebar.

Requirements:
- Star icon on each sidebar item (appears on hover)
- Clicking star pins the page to a "Pinned" section at the top of the sidebar
- Pinned section shows above all nav sections, with a small "Pinned" label
- Drag-to-reorder within the pinned section (use native HTML drag-and-drop, no new deps)
- Persist pinned pages + order in data/settings.json under pinnedPages array
- Load/save via existing /api/settings route
- Unpin by clicking the star again or right-click → "Unpin"
- Maximum 8 pins (show toast if user tries to add more)
- Modify: src/components/layout/sidebar.tsx
- No new page needed
- No command palette entry needed
- Maintain existing glass-morphism styling
```

---

## Prompt 5: Quick Actions Widget

Branch: `codex/quick-actions`

```
Add a Quick Actions widget to the dashboard page.

Requirements:
- Widget card on the dashboard with 4-6 one-click action buttons:
  1. "Run Last Task" — re-triggers the most recent scheduled task
  2. "Health Check All" — pings all instances and shows results inline
  3. "Generate Weekly Report" — creates a report with this week's date range
  4. "Backup Now" — triggers a backup
  5. "Check Costs Today" — fetches today's spend and shows inline
  6. "Clear Notifications" — marks all notifications as read
- Each button shows a loading spinner while executing, then a brief success/error result
- Component: src/components/dashboard/quick-actions.tsx
- Import into the main dashboard page (src/app/(app)/page.tsx or equivalent)
- Actions call existing API routes — no new routes needed
- Glass-morphism card styling matching other dashboard widgets
- No sidebar or command palette entry needed (it's a dashboard widget)
```

---

## Prompt 6: Activity Heatmap

Branch: `codex/activity-heatmap`

```
Build a GitHub-style activity heatmap at src/app/(app)/activity/page.tsx.

Requirements:
- Calendar heatmap showing agent activity over the past 12 months
- Each cell = one day, color intensity = number of sessions/tasks that day
- Tooltip on hover showing date and count
- Summary stats above: total sessions, most active day, current streak, longest streak
- Filter by agent (dropdown) or show all
- Data: data/activity.json — seed with 6 months of sample daily counts
- API: src/app/api/activity/route.ts — GET with optional ?agent= filter
- Component: src/components/activity/activity-heatmap.tsx
- Build the heatmap with plain divs/CSS grid (no external heatmap library)
- Color scale: 5 levels from bg-white/[0.02] (no activity) to emerald-500 (high activity)
- Sidebar: add to monitorNav with Calendar icon (or BarChart3), name "Activity"
- Command palette: add entry with keywords ['activity', 'heatmap', 'streak', 'calendar', 'history']
- Glass-morphism dark theme
```

---

## Prompt 7: Import/Export Bundle

Branch: `codex/import-export-bundle`

```
Build a portable config bundle export/import system.

Requirements:
- Page at src/app/(app)/portable/page.tsx
- Export: packages ALL user data into a single .mcbundle.json file:
  - Settings, pinned pages, prompts, templates, workflows, schedules, cost tags, snapshots, key vault (encrypted keys stay encrypted), notification preferences
  - Include a manifest with version, export date, and item counts
- Import: upload a .mcbundle.json, preview contents before applying, selective import (checkboxes per category)
- Conflict resolution: show diff when imported item already exists, let user pick "keep existing" or "overwrite"
- API: src/app/api/portable/route.ts — GET (export), POST (import with body)
- Component: src/components/portable/portable-manager.tsx
- Sidebar: add to workspaceNav with Archive icon, name "Portable"
- Command palette: add entry with keywords ['portable', 'bundle', 'import', 'export', 'migrate', 'transfer']
- Glass-morphism dark theme
```

---

## Prompt 8: Drag-and-Drop Sidebar Reorder

Branch: `codex/sidebar-reorder`

```
Add drag-and-drop reordering to all sidebar nav sections.

Requirements:
- Each nav section (Main, Monitor, Workspace) supports drag-to-reorder
- Drag handle icon (GripVertical from lucide) appears on hover left of each item
- Smooth drag animation with drop indicator line
- Use native HTML5 drag-and-drop API (no new dependencies)
- Persist custom order per section in data/settings.json under sidebarOrder object
- Load/save via existing /api/settings route
- "Reset to Default" button in each section header (appears only if order was customized)
- Modify: src/components/layout/sidebar.tsx
- No new page, API route, or command palette entry needed
- Maintain existing glass-morphism styling — drag ghost should match theme
```

---

## Prompt 9: Customizable Dashboard Widgets

Branch: `codex/dashboard-widgets`

```
Make the dashboard page customizable with draggable widget cards.

Requirements:
- Dashboard shows a grid of widget cards that users can rearrange
- Default widgets: Status Overview, Active Sessions, Cost Summary, Quick Actions, Recent Activity, Instance Health
- Each widget has a drag handle and a close (X) button
- "Add Widget" button opens a picker showing available (hidden) widgets
- Drag-and-drop reordering using native HTML5 DnD (no new deps)
- Persist widget layout (order + visibility) in data/settings.json under dashboardLayout
- Load/save via existing /api/settings route
- "Reset Layout" button restores defaults
- Modify: src/app/(app)/page.tsx (or dashboard page)
- New: src/components/dashboard/widget-grid.tsx — grid container with DnD logic
- Each widget is a self-contained component (some already exist, wrap them)
- No new sidebar or command palette entry needed
- Glass-morphism styling on all widget cards
```

---

## Prompt 10: Global Search

Branch: `codex/global-search`

```
Build a global search system that searches across all data sources.

Requirements:
- Enhance the existing command palette (src/components/layout/command-palette.tsx) with a "Search Everything" mode
- When user types in the command palette, search across:
  1. Pages (already works)
  2. Prompts (search prompt titles and content)
  3. Templates (search template names and descriptions)
  4. Sessions/Replays (search by session name or agent)
  5. Knowledge Base files (search file names)
  6. Changelog entries (search by version or change text)
  7. Scheduled tasks (search by name)
- API: src/app/api/search/route.ts — GET with ?q= param, returns grouped results
- Results grouped by category with category headers in the dropdown
- Each result shows: title, subtitle (source), and navigates to the relevant page on click
- Debounce search to 300ms
- Max 5 results per category, "Show all" link per category
- No new page needed — lives inside the command palette
- No sidebar entry needed
- Maintain existing command palette styling and keyboard navigation
```
