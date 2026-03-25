const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, '..', 'website')

// Shared colors matching the app's glass-morphism theme
const C = {
  bg: '#0a0a0e',
  sidebar: '#0d0d12',
  card: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.06)',
  text: '#f0f0f3',
  muted: '#8b8b95',
  dim: '#4a4a52',
  accent: '#3b82f6',
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#a855f7',
  cyan: '#06b6d4',
}

function sidebarSVG(activeIdx = 0) {
  const items = [
    'Dashboard', 'Operations', 'Agents', 'Chat', 'Replay',
    'Plugins', 'Skills', 'Presets', 'Workflows'
  ]
  const monitorItems = ['Costs', 'Analytics', 'Benchmarks', 'Compare', 'Forecast', 'Alerts']

  let y = 70
  let svg = `
    <rect x="0" y="0" width="220" height="720" fill="${C.sidebar}" />
    <rect x="219" y="0" width="1" height="720" fill="${C.border}" />
    <!-- Logo -->
    <rect x="20" y="20" width="34" height="34" rx="9" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.3)" stroke-width="1"/>
    <text x="30" y="42" font-family="Inter,system-ui,sans-serif" font-size="14" fill="${C.accent}" font-weight="700">MC</text>
    <text x="62" y="36" font-family="Inter,system-ui,sans-serif" font-size="13" fill="${C.text}" font-weight="700">Mission Control</text>
    <circle cx="62" cy="48" r="3" fill="${C.green}"/>
    <text x="70" y="52" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.muted}">Budget Mode</text>

    <text x="20" y="${y}" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}" font-weight="600" letter-spacing="1.2">CORE</text>
  `
  y += 16
  items.forEach((item, i) => {
    const active = i === activeIdx
    if (active) {
      svg += `<rect x="12" y="${y - 10}" width="196" height="30" rx="6" fill="rgba(59,130,246,0.1)"/>`
    }
    svg += `<text x="40" y="${y + 4}" font-family="Inter,system-ui,sans-serif" font-size="12" fill="${active ? C.accent : C.muted}" font-weight="${active ? '600' : '400'}">${item}</text>`
    y += 30
  })

  y += 10
  svg += `<text x="20" y="${y}" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}" font-weight="600" letter-spacing="1.2">MONITOR</text>`
  y += 16
  monitorItems.forEach((item) => {
    svg += `<text x="40" y="${y + 4}" font-family="Inter,system-ui,sans-serif" font-size="12" fill="${C.muted}" font-weight="400">${item}</text>`
    y += 30
  })

  // User profile at bottom
  svg += `
    <rect x="0" y="680" width="220" height="40" fill="transparent"/>
    <rect x="0" y="679" width="220" height="1" fill="${C.border}"/>
    <circle cx="36" cy="700" r="14" fill="rgba(113,113,122,0.3)"/>
    <text x="29" y="704" font-family="Inter,system-ui,sans-serif" font-size="11" fill="white" font-weight="600">T</text>
    <text x="56" y="696" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.text}" font-weight="500">Tomas</text>
    <text x="56" y="710" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}">claude-sonnet-4-6</text>
  `
  return svg
}

function statusCard(x, y, title, value, subtitle, dotColor) {
  return `
    <rect x="${x}" y="${y}" width="195" height="80" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
    <text x="${x+16}" y="${y+24}" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.dim}" font-weight="500">${title}</text>
    <circle cx="${x+16}" cy="${y+44}" r="4" fill="${dotColor}"/>
    <text x="${x+26}" y="${y+48}" font-family="Inter,system-ui,sans-serif" font-size="16" fill="${C.text}" font-weight="700">${value}</text>
    <text x="${x+16}" y="${y+66}" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.muted}">${subtitle}</text>
  `
}

// ─── Image 1: Hero Dashboard ───
function generateDashboard() {
  const svg = `<svg width="1200" height="720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <clipPath id="rounded"><rect x="0" y="0" width="1200" height="720" rx="12"/></clipPath>
    </defs>
    <g clip-path="url(#rounded)">
    <rect width="1200" height="720" fill="${C.bg}" rx="12"/>

    <!-- Sidebar -->
    ${sidebarSVG(0)}

    <!-- Main content area -->
    <g transform="translate(240, 20)">
      <!-- Top bar -->
      <text x="0" y="24" font-family="Inter,system-ui,sans-serif" font-size="20" fill="${C.text}" font-weight="800">Mission Control</text>
      <text x="0" y="42" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.muted}">Real-time overview of all systems</text>
      <circle cx="228" cy="36" r="4" fill="${C.green}"/>
      <text x="236" y="40" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.green}">Live</text>

      <!-- Status Cards -->
      ${statusCard(0, 60, 'Status', 'Online', 'Heartbeat 1.2s · Memory 245MB', C.green)}
      ${statusCard(210, 60, 'AI Mode', 'Budget', 'deepseek-chat-v3-0324', C.green)}
      ${statusCard(420, 60, 'Channels', 'Discord', '#general: OK · DMs: OK', C.green)}
      ${statusCard(630, 60, 'Sessions', '3', 'Active agent sessions', C.accent)}

      <!-- Live connection bar -->
      <rect x="0" y="155" width="835" height="32" rx="8" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
      <circle cx="16" cy="171" r="3" fill="${C.green}"/>
      <text x="26" y="175" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.muted}">Connected to OpenClaw · v0.13.0 · Heartbeat: 1.2s · Memory: 245MB · Budget Mode · deepseek-v3</text>

      <!-- Activity Feed (left col) -->
      <rect x="0" y="200" width="510" height="480" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
      <text x="20" y="228" font-family="Inter,system-ui,sans-serif" font-size="14" fill="${C.text}" font-weight="700">Live Activity</text>

      <!-- Activity items -->
      ${['Agent processed user query in #general', 'Pipeline Scout completed (1,247 tokens)', 'Budget check: $2.34 today ($5.00 limit)', 'Mode auto-switch triggered → Budget', 'Discord DM: user123 started session', 'Pipeline Editor step running...', 'Webhook fired: Slack notification sent', 'Session replay saved (42 messages)'].map((text, i) => `
        <circle cx="32" cy="${260 + i * 48}" r="4" fill="${[C.accent, C.purple, C.amber, C.green, C.cyan, C.purple, C.accent, C.green][i]}"/>
        <text x="46" y="${264 + i * 48}" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.text}">${text}</text>
        <text x="46" y="${278 + i * 48}" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}">${['2s ago', '14s ago', '1m ago', '3m ago', '5m ago', '8m ago', '12m ago', '15m ago'][i]}</text>
      `).join('')}

      <!-- Right sidebar widgets -->
      <!-- Active Sessions -->
      <rect x="525" y="200" width="310" height="160" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
      <text x="545" y="228" font-family="Inter,system-ui,sans-serif" font-size="12" fill="${C.muted}" font-weight="500">Active Sessions</text>
      ${[['Main Agent', 'deepseek-v3 · 12.4K tokens', '2m'], ['Discord Channel', 'deepseek-v3 · 3.1K tokens', '5m'], ['Sub-agent: scout', 'deepseek-v3 · 890 tokens', '1m']].map(([name, detail, age], i) => `
        <text x="545" y="${258 + i * 40}" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.text}">${name}</text>
        <text x="545" y="${272 + i * 40}" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}">${detail}</text>
        <text x="810" y="${264 + i * 40}" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}" text-anchor="end">${age}</text>
      `).join('')}

      <!-- Cost Widget -->
      <rect x="525" y="375" width="310" height="140" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
      <text x="545" y="403" font-family="Inter,system-ui,sans-serif" font-size="12" fill="${C.muted}" font-weight="500">Today's Spend</text>
      <text x="545" y="432" font-family="Inter,system-ui,sans-serif" font-size="24" fill="${C.text}" font-weight="800">$2.34</text>
      <text x="620" y="432" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.dim}">/ $5.00 daily</text>
      <!-- Progress bar -->
      <rect x="545" y="450" width="270" height="6" rx="3" fill="rgba(255,255,255,0.06)"/>
      <rect x="545" y="450" width="126" height="6" rx="3" fill="${C.accent}"/>
      <text x="545" y="476" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.muted}">47% of daily budget · $17.60 this month</text>
      <text x="545" y="496" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.green}">↓ 23% less than yesterday</text>

      <!-- Quick Links -->
      <rect x="525" y="530" width="310" height="150" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
      <text x="545" y="558" font-family="Inter,system-ui,sans-serif" font-size="12" fill="${C.muted}" font-weight="500">Quick Links</text>
      ${[['Switch to Best Mode', C.amber], ['View Cost Analytics', C.accent], ['Check Alerts', C.red], ['Open Key Vault', C.purple]].map(([label, color], i) => `
        <rect x="545" y="${570 + i * 28}" width="270" height="24" rx="6" fill="rgba(255,255,255,0.03)"/>
        <circle cx="558" cy="${582 + i * 28}" r="3" fill="${color}"/>
        <text x="568" y="${586 + i * 28}" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.text}">${label}</text>
      `).join('')}
    </g>

    <!-- Window chrome dots -->
    <circle cx="18" cy="10" r="5" fill="${C.red}" opacity="0.8"/>
    <circle cx="34" cy="10" r="5" fill="${C.amber}" opacity="0.8"/>
    <circle cx="50" cy="10" r="5" fill="${C.green}" opacity="0.8"/>
    </g>
  </svg>`

  return sharp(Buffer.from(svg)).png().toFile(path.join(OUT, 'screenshot-dashboard.png'))
}

// ─── Image 2: Cost Analytics & Forecast ───
function generateAnalytics() {
  const svg = `<svg width="1200" height="720" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="rounded2"><rect x="0" y="0" width="1200" height="720" rx="12"/></clipPath></defs>
    <g clip-path="url(#rounded2)">
    <rect width="1200" height="720" fill="${C.bg}" rx="12"/>
    ${sidebarSVG(1)}

    <g transform="translate(240, 20)">
      <text x="0" y="24" font-family="Inter,system-ui,sans-serif" font-size="20" fill="${C.text}" font-weight="800">AI Usage Forecast</text>
      <text x="0" y="42" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.muted}">Projected spending with actionable recommendations</text>

      <!-- Budget Gauge -->
      <rect x="0" y="60" width="260" height="220" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
      <circle cx="130" cy="155" r="70" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10"/>
      <circle cx="130" cy="155" r="70" fill="none" stroke="${C.green}" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="440" stroke-dashoffset="286" transform="rotate(-90 130 155)"/>
      <text x="130" y="150" font-family="Inter,system-ui,sans-serif" font-size="28" fill="${C.text}" font-weight="800" text-anchor="middle">35%</text>
      <text x="130" y="172" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.muted}" text-anchor="middle">of budget</text>
      <text x="130" y="250" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.muted}" text-anchor="middle">$17.60 of $50 used</text>

      <!-- Spend cards -->
      <rect x="275" y="60" width="270" height="220" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
      <text x="295" y="90" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.dim}">Today's Spend</text>
      <text x="295" y="116" font-family="Inter,system-ui,sans-serif" font-size="22" fill="${C.text}" font-weight="800">$0.22</text>
      <text x="295" y="136" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.muted}">Daily avg: $0.70</text>
      <text x="295" y="168" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.dim}">Month to Date</text>
      <text x="295" y="194" font-family="Inter,system-ui,sans-serif" font-size="22" fill="${C.text}" font-weight="800">$17.60</text>
      <text x="295" y="214" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.muted}">Day 25 of 31</text>
      <text x="295" y="254" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.dim}">Projected End of Month</text>
      <text x="295" y="270" font-family="Inter,system-ui,sans-serif" font-size="16" fill="${C.green}" font-weight="700">$21.83</text>

      <!-- Projections -->
      <rect x="560" y="60" width="275" height="220" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
      <text x="580" y="90" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.dim}">Remaining This Month</text>
      <text x="580" y="118" font-family="Inter,system-ui,sans-serif" font-size="24" fill="${C.text}" font-weight="800">~$4.23</text>
      <text x="580" y="140" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.muted}">6 days left</text>
      <text x="580" y="175" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.dim}">Days Until Budget Exceeded</text>
      <text x="580" y="200" font-family="Inter,system-ui,sans-serif" font-size="20" fill="${C.green}" font-weight="700">Never</text>
      <text x="580" y="218" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.muted}">On track to stay within budget</text>

      <!-- Recommendation card -->
      <rect x="0" y="300" width="835" height="80" rx="12" fill="rgba(34,197,94,0.05)" stroke="rgba(34,197,94,0.2)" stroke-width="1"/>
      <text x="24" y="330" font-family="Inter,system-ui,sans-serif" font-size="13" fill="${C.text}" font-weight="600">Switch to Gemini 2.5 Flash</text>
      <text x="24" y="352" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.muted}">Save ~$21.02/mo (96%) by switching your primary model. Same workload, fraction of the cost.</text>
      <text x="790" y="336" font-family="Inter,system-ui,sans-serif" font-size="16" fill="${C.green}" font-weight="800" text-anchor="end">-$21.02</text>
      <text x="790" y="354" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.muted}" text-anchor="end">/month</text>

      <!-- Cost Comparison mini -->
      <rect x="0" y="400" width="835" height="280" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
      <text x="24" y="430" font-family="Inter,system-ui,sans-serif" font-size="14" fill="${C.text}" font-weight="700">Multi-Provider Cost Comparison</text>
      <text x="24" y="448" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.muted}">Same workload estimated across 12 models</text>

      ${[
        ['#1', 'Local', 'Llama 3 70B (self-hosted)', 'Free', 0, C.green],
        ['#2', 'OpenAI', 'GPT-4.1 Nano', '$0.03', 2, C.green],
        ['#3', 'Google', 'Gemini 2.5 Flash', '$0.08', 4, C.green],
        ['#4', 'Deepseek', 'Deepseek V3', '$0.19', 8, C.green],
        ['#5', 'Anthropic', 'Claude Haiku 4.5', '$0.51', 20, '#60a5fa'],
        ['#6', 'Google', 'Gemini 3.1 Pro', '$1.21', 48, C.amber],
        ['#7', 'OpenAI', 'GPT-4.1', '$2.13', 85, C.amber],
        ['#8', 'Anthropic', 'Claude Sonnet 4.6', '$3.48', 100, C.red],
      ].map(([rank, provider, name, cost, barPct, color], i) => `
        <text x="32" y="${482 + i * 28}" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}" font-weight="600">${rank}</text>
        <text x="56" y="${482 + i * 28}" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.muted}">${provider}</text>
        <text x="130" y="${482 + i * 28}" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.text}" font-weight="500">${name}</text>
        <rect x="400" y="${472 + i * 28}" width="330" height="8" rx="4" fill="rgba(255,255,255,0.04)"/>
        <rect x="400" y="${472 + i * 28}" width="${barPct * 3.3}" height="8" rx="4" fill="${color}"/>
        <text x="800" y="${482 + i * 28}" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${color}" font-weight="700" text-anchor="end">${cost}</text>
      `).join('')}
    </g>

    <circle cx="18" cy="10" r="5" fill="${C.red}" opacity="0.8"/>
    <circle cx="34" cy="10" r="5" fill="${C.amber}" opacity="0.8"/>
    <circle cx="50" cy="10" r="5" fill="${C.green}" opacity="0.8"/>
    </g>
  </svg>`

  return sharp(Buffer.from(svg)).png().toFile(path.join(OUT, 'screenshot-analytics.png'))
}

// ─── Image 3: Features Showcase (Alerts + Webhooks + Presets) ───
function generateFeatures() {
  const svg = `<svg width="1200" height="720" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="rounded3"><rect x="0" y="0" width="1200" height="720" rx="12"/></clipPath></defs>
    <g clip-path="url(#rounded3)">
    <rect width="1200" height="720" fill="${C.bg}" rx="12"/>
    ${sidebarSVG(7)}

    <g transform="translate(240, 20)">
      <text x="0" y="24" font-family="Inter,system-ui,sans-serif" font-size="20" fill="${C.text}" font-weight="800">Model Presets</text>
      <text x="0" y="42" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.muted}">One-click agent configuration</text>

      <!-- Preset cards grid -->
      ${[
        [C.green, 'Fast + Cheap', 'Deepseek V3 with nano fallbacks', '$0.27/M in', C.green],
        [C.accent, 'Balanced', 'Sonnet 4.6 with Gemini fallback', '$3.00/M in', C.accent],
        [C.purple, 'Maximum Quality', 'Opus 4.6 with Gemini Pro fallback', '$15.00/M in', C.purple],
        [C.cyan, 'Code Expert', 'Sonnet 4.6 optimized for code', '$3.00/M in', C.cyan],
        [C.amber, 'Long Context', 'Gemini 3.1 Pro for large docs', '$1.25/M in', C.amber],
      ].map(([iconColor, name, desc, price, color], i) => {
        const x = (i % 3) * 275
        const y = 60 + Math.floor(i / 3) * 150
        return `
          <rect x="${x}" y="${y}" width="260" height="130" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
          <circle cx="${x + 28}" cy="${y + 30}" r="10" fill="${iconColor}" opacity="0.2"/>
          <circle cx="${x + 28}" cy="${y + 30}" r="4" fill="${iconColor}"/>
          <text x="${x + 48}" y="${y + 34}" font-family="Inter,system-ui,sans-serif" font-size="14" fill="${C.text}" font-weight="700">${name}</text>
          <text x="${x + 20}" y="${y + 56}" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.muted}">${desc}</text>
          <text x="${x + 20}" y="${y + 80}" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${color}" font-weight="600">${price}</text>
          <rect x="${x + 20}" y="${y + 94}" width="80" height="24" rx="6" fill="${color}" opacity="0.15"/>
          <text x="${x + 38}" y="${y + 110}" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${color}" font-weight="600">Apply</text>
        `
      }).join('')}

      <!-- Webhook manager section -->
      <rect x="0" y="380" width="405" height="300" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
      <text x="24" y="410" font-family="Inter,system-ui,sans-serif" font-size="14" fill="${C.text}" font-weight="700">Webhook Integrations</text>
      ${[
        ['Slack — #alerts', 'alert.triggered, budget.exceeded', C.green, 'Active'],
        ['Discord — Ops Channel', 'agent.offline, mode.changed', C.green, 'Active'],
        ['PagerDuty', 'budget.exceeded', C.dim, 'Paused'],
      ].map(([name, events, color, status], i) => `
        <rect x="20" y="${430 + i * 72}" width="365" height="60" rx="8" fill="rgba(255,255,255,0.02)"/>
        <circle cx="40" cy="${456 + i * 72}" r="4" fill="${color}"/>
        <text x="52" y="${452 + i * 72}" font-family="Inter,system-ui,sans-serif" font-size="12" fill="${C.text}" font-weight="500">${name}</text>
        <text x="340" y="${452 + i * 72}" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${color}" font-weight="500" text-anchor="end">${status}</text>
        <text x="52" y="${470 + i * 72}" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}">${events}</text>
      `).join('')}

      <!-- Alerts section -->
      <rect x="420" y="380" width="415" height="300" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
      <text x="444" y="410" font-family="Inter,system-ui,sans-serif" font-size="14" fill="${C.text}" font-weight="700">Smart Alerts</text>
      ${[
        ['Daily budget > 80%', 'Notify + Auto-throttle', C.amber],
        ['Agent offline > 5min', 'Notify + Webhook', C.red],
        ['Monthly spend > $40', 'Notify', C.green],
        ['Error rate > 5%', 'Notify + Switch mode', C.green],
      ].map(([rule, action, color], i) => `
        <rect x="440" y="${430 + i * 58}" width="375" height="46" rx="8" fill="rgba(255,255,255,0.02)"/>
        <circle cx="460" cy="${446 + i * 58}" r="5" fill="${color}"/>
        <text x="474" y="${450 + i * 58}" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.text}" font-weight="500">${rule}</text>
        <text x="474" y="${466 + i * 58}" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}">${action}</text>
      `).join('')}
    </g>

    <circle cx="18" cy="10" r="5" fill="${C.red}" opacity="0.8"/>
    <circle cx="34" cy="10" r="5" fill="${C.amber}" opacity="0.8"/>
    <circle cx="50" cy="10" r="5" fill="${C.green}" opacity="0.8"/>
    </g>
  </svg>`

  return sharp(Buffer.from(svg)).png().toFile(path.join(OUT, 'screenshot-features.png'))
}

// ─── Image 4: Session Replay ───
function generateReplay() {
  const svg = `<svg width="1200" height="720" xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id="rounded4"><rect x="0" y="0" width="1200" height="720" rx="12"/></clipPath></defs>
    <g clip-path="url(#rounded4)">
    <rect width="1200" height="720" fill="${C.bg}" rx="12"/>
    ${sidebarSVG(4)}

    <g transform="translate(240, 20)">
      <text x="0" y="24" font-family="Inter,system-ui,sans-serif" font-size="20" fill="${C.text}" font-weight="800">Session Replay</text>
      <text x="0" y="42" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.muted}">Browse agent conversation history</text>

      <!-- Session list (left panel) -->
      <rect x="0" y="60" width="280" height="620" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
      <text x="20" y="90" font-family="Inter,system-ui,sans-serif" font-size="12" fill="${C.muted}" font-weight="500">Sessions</text>

      ${[
        ['#general — Agent Discussion', '42 messages · ~8.2K tokens', '2m ago', true],
        ['DM — user123', '18 messages · ~3.1K tokens', '15m ago', false],
        ['Pipeline: Video Scout', '6 messages · ~1.2K tokens', '1h ago', false],
        ['#development — Code Review', '31 messages · ~5.8K tokens', '2h ago', false],
        ['DM — editor_bot', '12 messages · ~2.4K tokens', '3h ago', false],
        ['Pipeline: Content Assembly', '8 messages · ~1.9K tokens', '5h ago', false],
      ].map(([name, detail, age, active], i) => `
        <rect x="12" y="${104 + i * 74}" width="256" height="62" rx="8" fill="${active ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)'}" ${active ? `stroke="rgba(59,130,246,0.3)" stroke-width="1"` : ''}/>
        <text x="24" y="${126 + i * 74}" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${active ? C.accent : C.text}" font-weight="${active ? '600' : '400'}">${name}</text>
        <text x="24" y="${142 + i * 74}" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}">${detail}</text>
        <text x="252" y="${126 + i * 74}" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}" text-anchor="end">${age}</text>
      `).join('')}

      <!-- Chat viewer (right panel) -->
      <rect x="295" y="60" width="540" height="620" rx="12" fill="${C.card}" stroke="${C.border}" stroke-width="1"/>
      <text x="315" y="90" font-family="Inter,system-ui,sans-serif" font-size="12" fill="${C.text}" font-weight="600">#general — Agent Discussion</text>
      <text x="315" y="106" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}">42 messages · Started 2m ago</text>

      <!-- Chat bubbles -->
      <!-- User message -->
      <rect x="440" y="125" width="375" height="50" rx="10" fill="rgba(59,130,246,0.12)"/>
      <text x="456" y="140" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.accent}" font-weight="600">user123</text>
      <text x="456" y="158" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.text}">Can you scout for trending AI topics this week?</text>

      <!-- Agent message -->
      <rect x="315" y="190" width="400" height="90" rx="10" fill="rgba(255,255,255,0.03)"/>
      <text x="331" y="206" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.purple}" font-weight="600">agent:main</text>
      <text x="331" y="224" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.text}">I'll start a scout pipeline for trending AI topics.</text>
      <text x="331" y="242" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.text}">Searching Twitter, Reddit, and HN for the past 7 days.</text>
      <text x="331" y="260" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}">deepseek-v3 · 247 tokens · $0.0001</text>

      <!-- User message -->
      <rect x="480" y="300" width="335" height="50" rx="10" fill="rgba(59,130,246,0.12)"/>
      <text x="496" y="316" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.accent}" font-weight="600">user123</text>
      <text x="496" y="334" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.text}">Focus on open source agent frameworks</text>

      <!-- Agent message -->
      <rect x="315" y="365" width="420" height="120" rx="10" fill="rgba(255,255,255,0.03)"/>
      <text x="331" y="382" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.purple}" font-weight="600">agent:main</text>
      <text x="331" y="400" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.text}">Found 12 trending topics. Top 3:</text>
      <text x="331" y="420" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.text}">1. CrewAI v3 multi-agent orchestration</text>
      <text x="331" y="438" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.text}">2. LangGraph state management patterns</text>
      <text x="331" y="456" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${C.text}">3. OpenClaw + Mission Control workflows</text>
      <text x="331" y="472" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}">deepseek-v3 · 892 tokens · $0.0003</text>

      <!-- More messages indicator -->
      <text x="315" y="510" font-family="Inter,system-ui,sans-serif" font-size="9" fill="${C.dim}">... 38 more messages</text>

      <!-- Token summary bar -->
      <rect x="315" y="625" width="500" height="36" rx="8" fill="rgba(255,255,255,0.02)" stroke="${C.border}" stroke-width="1"/>
      <text x="335" y="648" font-family="Inter,system-ui,sans-serif" font-size="10" fill="${C.muted}">Total: 8,247 tokens · $0.0028 · deepseek-chat-v3-0324 · 42 messages</text>
    </g>

    <circle cx="18" cy="10" r="5" fill="${C.red}" opacity="0.8"/>
    <circle cx="34" cy="10" r="5" fill="${C.amber}" opacity="0.8"/>
    <circle cx="50" cy="10" r="5" fill="${C.green}" opacity="0.8"/>
    </g>
  </svg>`

  return sharp(Buffer.from(svg)).png().toFile(path.join(OUT, 'screenshot-replay.png'))
}

// Also update the hero screenshot
function generateHero() {
  // Reuse dashboard as hero but at OG image size
  return generateDashboard()
}

async function main() {
  console.log('Generating website images...')
  await Promise.all([
    generateDashboard(),
    generateAnalytics(),
    generateFeatures(),
    generateReplay(),
  ])

  // Get file sizes
  const files = ['screenshot-dashboard.png', 'screenshot-analytics.png', 'screenshot-features.png', 'screenshot-replay.png']
  for (const f of files) {
    const stat = fs.statSync(path.join(OUT, f))
    console.log(`  ${f}: ${Math.round(stat.size / 1024)}KB`)
  }
  console.log('Done!')
}

main().catch(console.error)
