// Populate data/ with rich fake data for website screenshots
const fs = require('fs')
const path = require('path')

const DATA = path.join(__dirname, '..', 'data')

function write(file, data) {
  fs.writeFileSync(path.join(DATA, file), JSON.stringify(data, null, 2))
  console.log(`  wrote ${file}`)
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function dateStr(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// ── Budget ──
write('budget.json', {
  dailyLimit: 8,
  monthlyLimit: 150,
  autoThrottle: true,
  throttleMode: 'budget',
  alertThresholds: [50, 80, 95],
  updatedAt: daysAgo(2)
})

// ── OpenRouter costs (rich multi-day data) ──
const orDays = []
const models = ['anthropic/claude-sonnet-4', 'deepseek/deepseek-chat-v3-0324', 'google/gemini-2.5-flash', 'openai/gpt-4o-mini']
for (let i = 29; i >= 0; i--) {
  const d = new Date()
  d.setDate(d.getDate() - i)
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const dateLabel = `${monthNames[d.getMonth()]} ${d.getDate()}`
  const base = 2.5 + Math.random() * 5.5
  orDays.push({
    date: dateLabel,
    breakdown: [
      { type: 'standard', cost: +(base * 0.6).toFixed(2) },
      { type: 'premium', cost: +(base * 0.4).toFixed(2) }
    ],
    total: +base.toFixed(2)
  })
}
write('openrouter-costs.json', {
  period: `${orDays[0].date}–${orDays[orDays.length-1].date}`,
  model: 'anthropic/claude-sonnet-4',
  days: orDays,
  updatedAt: new Date().toISOString()
})

// ── Cost history (30 days) ──
const costHistory = []
for (let i = 29; i >= 0; i--) {
  const or = 2 + Math.random() * 6
  const anth = 0.5 + Math.random() * 2
  const rw = 0.15
  costHistory.push({
    date: dateStr(i),
    openrouter: +or.toFixed(2),
    anthropic: +anth.toFixed(2),
    railway: rw,
    subscriptions: i % 30 === 0 ? 20 : 0,
    total: +(or + anth + rw + (i % 30 === 0 ? 20 : 0)).toFixed(2)
  })
}
write('cost-history.json', costHistory)

// ── Team ──
write('team.json', {
  name: 'OrqPilot HQ',
  plan: 'pro',
  createdAt: '2026-02-15T10:00:00.000Z',
  members: [
    { id: 'owner-1', name: 'Tomas', email: 'tomas@orqpilot.com', role: 'owner', joinedAt: '2026-02-15T10:00:00.000Z', lastActiveAt: daysAgo(0), status: 'active' },
    { id: 'member-2', name: 'Marcus R.', email: 'marcus@example.com', role: 'admin', joinedAt: '2026-02-20T14:00:00.000Z', lastActiveAt: daysAgo(0), status: 'active' },
    { id: 'member-3', name: 'Sarah K.', email: 'sarah@agency.io', role: 'member', joinedAt: '2026-03-01T09:00:00.000Z', lastActiveAt: daysAgo(1), status: 'active' },
    { id: 'member-4', name: 'Jake M.', email: 'jake@devops.co', role: 'viewer', joinedAt: '2026-03-10T11:00:00.000Z', lastActiveAt: daysAgo(3), status: 'active' }
  ]
})

// ── Alerts (active rules + recent history) ──
write('alerts.json', {
  rules: [
    { id: 'rule-1', name: 'Daily spend > $6', enabled: true, type: 'spend_daily', condition: { metric: 'daily_spend', operator: 'gt', value: 6 }, action: 'notify_and_throttle', cooldownMinutes: 60, lastTriggered: daysAgo(1), createdAt: daysAgo(20) },
    { id: 'rule-2', name: 'Monthly spend > $120', enabled: true, type: 'spend_monthly', condition: { metric: 'monthly_spend', operator: 'gt', value: 120 }, action: 'notify', cooldownMinutes: 1440, createdAt: daysAgo(20) },
    { id: 'rule-3', name: 'Credits below $10', enabled: true, type: 'credits_low', condition: { metric: 'credits_remaining', operator: 'lt', value: 10 }, action: 'notify', cooldownMinutes: 720, createdAt: daysAgo(15) },
    { id: 'rule-4', name: 'Agent offline > 5 min', enabled: true, type: 'agent_offline', condition: { metric: 'agent_offline_minutes', operator: 'gt', value: 5 }, action: 'notify', cooldownMinutes: 30, lastTriggered: daysAgo(5), createdAt: daysAgo(18) },
    { id: 'rule-5', name: 'Budget 90% used', enabled: true, type: 'budget_pct', condition: { metric: 'budget_pct', operator: 'gte', value: 90 }, action: 'throttle', cooldownMinutes: 1440, createdAt: daysAgo(14) }
  ],
  history: [
    { ruleId: 'rule-1', ruleName: 'Daily spend > $6', message: 'Daily spend hit $6.42 — auto-throttled to budget mode', timestamp: daysAgo(0) },
    { ruleId: 'rule-1', ruleName: 'Daily spend > $6', message: 'Daily spend hit $7.10 — auto-throttled to budget mode', timestamp: daysAgo(1) },
    { ruleId: 'rule-4', ruleName: 'Agent offline > 5 min', message: 'Agent offline for 8 minutes — reconnected automatically', timestamp: daysAgo(5) },
    { ruleId: 'rule-2', ruleName: 'Monthly spend > $120', message: 'Monthly spend reached $122.50', timestamp: daysAgo(7) },
    { ruleId: 'rule-1', ruleName: 'Daily spend > $6', message: 'Daily spend hit $6.85 — auto-throttled to budget mode', timestamp: daysAgo(3) }
  ]
})

// ── Audit log ──
const auditEntries = [
  { action: 'Mode changed', category: 'mode', details: 'Switched to standard (claude-sonnet-4)', previous: 'budget' },
  { action: 'Budget updated', category: 'budget', details: 'Daily limit changed to $8.00', previous: '$5.00' },
  { action: 'Alert triggered', category: 'alert', details: 'Daily spend > $6 — auto-throttled to budget mode' },
  { action: 'Preset applied', category: 'preset', details: 'Applied "Balanced" preset — claude-sonnet-4 + deepseek fallback' },
  { action: 'Webhook added', category: 'webhook', details: 'Added Discord webhook for alert notifications' },
  { action: 'Config snapshot created', category: 'config', details: 'Snapshot "pre-launch-config" saved' },
  { action: 'Backup created', category: 'backup', details: 'Full backup exported (14 files, 2.3 MB)' },
  { action: 'Mode changed', category: 'mode', details: 'Switched to best (claude-opus-4)', previous: 'standard' },
  { action: 'Budget updated', category: 'budget', details: 'Monthly limit changed to $150.00', previous: '$100.00' },
  { action: 'License activated', category: 'license', details: 'Pro license activated on this machine' },
  { action: 'Alert triggered', category: 'alert', details: 'Monthly spend reached $122.50' },
  { action: 'Mode changed', category: 'mode', details: 'Auto-throttled to budget (deepseek-chat-v3)', previous: 'standard' },
  { action: 'System update', category: 'system', details: 'Updated to v1.0.5' },
  { action: 'Preset created', category: 'preset', details: 'Created custom preset "Night Owl" — budget mode with deepseek' },
  { action: 'Config restored', category: 'config', details: 'Restored from snapshot "pre-launch-config"' },
].map((e, i) => ({
  id: `audit-${Date.now() - i * 3600000}-${Math.random().toString(36).slice(2, 6)}`,
  timestamp: daysAgo(i * 0.5),
  ...e
}))
write('audit-log.json', auditEntries)

// ── Notifications ──
write('notifications.json', [
  { id: 'n1', type: 'alert', title: 'Daily spend limit reached', message: 'Spent $6.42 today — auto-throttled to budget mode', timestamp: daysAgo(0), read: false, href: '/alerts' },
  { id: 'n2', type: 'budget', title: 'Budget 80% used', message: 'Monthly spend is at $120.80 of $150.00 limit', timestamp: daysAgo(1), read: false, href: '/costs' },
  { id: 'n3', type: 'system', title: 'Update available', message: 'Mission Control v1.0.6 is available with new features', timestamp: daysAgo(2), read: true },
  { id: 'n4', type: 'webhook', title: 'Webhook delivered', message: 'Alert notification sent to Discord #alerts channel', timestamp: daysAgo(0), read: true, href: '/webhooks' },
  { id: 'n5', type: 'info', title: 'Forecast updated', message: 'Projected monthly spend: $148.20 — within budget', timestamp: daysAgo(0), read: false, href: '/forecast' },
  { id: 'n6', type: 'alert', title: 'Agent reconnected', message: 'ClawdBot came back online after 8 min downtime', timestamp: daysAgo(5), read: true },
  { id: 'n7', type: 'budget', title: 'Weekly savings report', message: 'Auto-throttle saved $42.30 this week vs best-mode pricing', timestamp: daysAgo(3), read: true, href: '/forecast' },
  { id: 'n8', type: 'system', title: 'Backup completed', message: 'Full backup saved — 14 files, 2.3 MB', timestamp: daysAgo(4), read: true, href: '/backup' }
])

// ── Cost tags ──
write('cost-tags.json', {
  tags: [
    { id: 'tag-1', name: 'Content Pipeline', color: '#3b82f6', description: 'Video content generation pipeline costs', createdAt: daysAgo(20) },
    { id: 'tag-2', name: 'Discord Bot', color: '#22c55e', description: 'Discord conversation handling', createdAt: daysAgo(20) },
    { id: 'tag-3', name: 'Research', color: '#a855f7', description: 'Research and analysis tasks', createdAt: daysAgo(15) },
    { id: 'tag-4', name: 'Client Work', color: '#f59e0b', description: 'Billable client projects', createdAt: daysAgo(10) }
  ],
  assignments: [
    { sessionKey: 'agent:pipeline:scout', tagId: 'tag-1', assignedAt: daysAgo(2) },
    { sessionKey: 'agent:pipeline:editor', tagId: 'tag-1', assignedAt: daysAgo(2) },
    { sessionKey: 'agent:discord:main', tagId: 'tag-2', assignedAt: daysAgo(5) },
    { sessionKey: 'agent:research:deep', tagId: 'tag-3', assignedAt: daysAgo(3) },
    { sessionKey: 'agent:client:acme', tagId: 'tag-4', assignedAt: daysAgo(1) }
  ]
})

// ── Prompt library ──
write('prompt-library.json', [
  { id: 'p1', name: 'Content Scout Brief', description: 'Initial research prompt for video topics', category: 'Pipeline', content: 'Research the top 5 trending topics in {{niche}} on YouTube in the past 7 days. For each topic provide: title idea, search volume estimate, competition level, and a 2-sentence hook.', variables: ['niche'], tags: ['pipeline', 'research'], usageCount: 47, createdAt: daysAgo(25), updatedAt: daysAgo(2) },
  { id: 'p2', name: 'Script Editor', description: 'Polish and improve raw script drafts', category: 'Pipeline', content: 'Edit the following script for {{platform}}. Improve clarity, add hooks at retention drop points, and ensure the tone is {{tone}}. Keep it under {{maxWords}} words.\n\n{{script}}', variables: ['platform', 'tone', 'maxWords', 'script'], tags: ['pipeline', 'editing'], usageCount: 32, createdAt: daysAgo(24), updatedAt: daysAgo(1) },
  { id: 'p3', name: 'Discord Helper', description: 'Respond helpfully in Discord channels', category: 'Chat', content: 'You are a helpful assistant in the {{server}} Discord. Answer questions about {{topic}} concisely. Use code blocks for technical content. Be friendly but professional.', variables: ['server', 'topic'], tags: ['discord', 'chat'], usageCount: 156, createdAt: daysAgo(20), updatedAt: daysAgo(0) },
  { id: 'p4', name: 'Cost Analysis Report', description: 'Generate weekly cost analysis', category: 'Reports', content: 'Analyze the following API usage data and create a summary report:\n- Total spend: {{totalSpend}}\n- Top models by cost\n- Cost per task category\n- Recommendations to reduce spend by 20%+', variables: ['totalSpend'], tags: ['reports', 'costs'], usageCount: 8, createdAt: daysAgo(12), updatedAt: daysAgo(7) },
  { id: 'p5', name: 'Client Onboarding', description: 'Welcome message for new clients', category: 'Client', content: 'Welcome {{clientName}} to the platform. Walk them through: 1) Setting up their first agent, 2) Configuring budget limits, 3) Connecting Discord. Keep it warm and helpful.', variables: ['clientName'], tags: ['client', 'onboarding'], usageCount: 12, createdAt: daysAgo(10), updatedAt: daysAgo(5) }
])

// ── Key vault ──
write('key-vault.json', [
  { id: 'k1', name: 'OpenRouter Production', provider: 'OpenRouter', keyPrefix: 'sk-or-v1', keyHash: 'abc123', addedAt: daysAgo(30), lastUsed: daysAgo(0), isActive: true, notes: 'Primary production key', _key: 'sk-or-v1-****' },
  { id: 'k2', name: 'Anthropic Direct', provider: 'Anthropic', keyPrefix: 'sk-ant-a', keyHash: 'def456', addedAt: daysAgo(25), lastUsed: daysAgo(1), isActive: true, notes: 'Direct Anthropic access for benchmarks', _key: 'sk-ant-a****' },
  { id: 'k3', name: 'OpenAI Backup', provider: 'OpenAI', keyPrefix: 'sk-proj-', keyHash: 'ghi789', addedAt: daysAgo(20), isActive: false, notes: 'Backup key — not in active rotation', _key: 'sk-proj-****' },
  { id: 'k4', name: 'Discord Bot Token', provider: 'Discord', keyPrefix: 'MTI4MDk', keyHash: 'jkl012', addedAt: daysAgo(30), lastUsed: daysAgo(0), isActive: true, notes: 'ClawdBot Discord token', _key: 'MTI4MDk****' }
])

// ── Config snapshots ──
write('config-snapshots.json', [
  { id: 'snap-1', name: 'pre-launch-config', createdAt: daysAgo(5), data: { budget: { dailyLimit: 5, monthlyLimit: 100 }, mode: 'standard', openclawUrl: 'https://clawdbot.up.railway.app' }},
  { id: 'snap-2', name: 'high-performance-setup', createdAt: daysAgo(10), data: { budget: { dailyLimit: 15, monthlyLimit: 300 }, mode: 'best', openclawUrl: 'https://clawdbot.up.railway.app' }},
  { id: 'snap-3', name: 'budget-mode-baseline', createdAt: daysAgo(15), data: { budget: { dailyLimit: 3, monthlyLimit: 50 }, mode: 'budget', openclawUrl: 'https://clawdbot.up.railway.app' }}
])

// ── Scheduled reports ──
write('scheduled-reports.json', [
  { id: 'sr-1', name: 'Weekly Cost Summary', frequency: 'weekly', format: 'csv', includes: ['costs', 'tokens', 'budget'], enabled: true, lastRun: daysAgo(3), nextRun: daysAgo(-4), createdAt: daysAgo(20) },
  { id: 'sr-2', name: 'Daily Alert Digest', frequency: 'daily', format: 'json', includes: ['alerts', 'sessions'], enabled: true, lastRun: daysAgo(0), nextRun: daysAgo(-1), createdAt: daysAgo(15) },
  { id: 'sr-3', name: 'Monthly Full Report', frequency: 'monthly', format: 'csv', includes: ['costs', 'tokens', 'budget', 'alerts', 'sessions'], enabled: true, lastRun: daysAgo(25), nextRun: daysAgo(-5), createdAt: daysAgo(25) }
])

// ── Mode schedule ──
write('mode-schedule.json', {
  enabled: true,
  entries: [
    { id: 'ms-1', name: 'Business Hours — Standard', mode: 'standard', startTime: '09:00', endTime: '18:00', days: [1,2,3,4,5], enabled: true, createdAt: daysAgo(14) },
    { id: 'ms-2', name: 'Nights — Budget', mode: 'budget', startTime: '18:00', endTime: '09:00', days: [1,2,3,4,5], enabled: true, createdAt: daysAgo(14) },
    { id: 'ms-3', name: 'Weekends — Best', mode: 'best', startTime: '00:00', endTime: '23:59', days: [0,6], enabled: true, createdAt: daysAgo(14) }
  ],
  lastApplied: daysAgo(0),
  currentScheduleId: 'ms-1'
})

// ── Model presets (custom ones) ──
write('model-presets.json', [
  { id: 'preset-custom-1', name: 'Night Owl', description: 'Budget mode for overnight batch processing', model: 'deepseek/deepseek-chat-v3-0324', fallbacks: ['google/gemini-2.5-flash'], temperature: 0.3, isBuiltIn: false, createdAt: daysAgo(10) },
  { id: 'preset-custom-2', name: 'Client Premium', description: 'Maximum quality for client-facing deliverables', model: 'anthropic/claude-opus-4', fallbacks: ['anthropic/claude-sonnet-4'], temperature: 0.7, isBuiltIn: false, createdAt: daysAgo(8) }
])

// ── Workflows ──
write('workflows.json', {
  workflows: [
    {
      id: 'wf-1',
      name: 'Content Pipeline',
      description: 'Scout → Edit → Narrate → Assemble video content',
      enabled: true,
      trigger: { type: 'manual' },
      steps: [
        { id: 's1', type: 'agent', name: 'Scout Research', config: { model: 'claude-sonnet-4', prompt: 'Research trending topics' }},
        { id: 's2', type: 'agent', name: 'Script Editor', config: { model: 'claude-sonnet-4', prompt: 'Edit and polish script' }},
        { id: 's3', type: 'agent', name: 'Narrator', config: { model: 'deepseek-chat-v3', prompt: 'Generate narration' }},
        { id: 's4', type: 'agent', name: 'Assembly', config: { model: 'deepseek-chat-v3', prompt: 'Compile final output' }}
      ],
      createdAt: daysAgo(20),
      updatedAt: daysAgo(2)
    },
    {
      id: 'wf-2',
      name: 'Morning Briefing',
      description: 'Auto-generate daily cost + activity summary',
      enabled: true,
      trigger: { type: 'cron', cron: '0 8 * * *' },
      steps: [
        { id: 's1', type: 'api', name: 'Fetch Costs', config: { url: '/api/costs' }},
        { id: 's2', type: 'agent', name: 'Summarize', config: { model: 'deepseek-chat-v3', prompt: 'Summarize daily report' }}
      ],
      createdAt: daysAgo(12),
      updatedAt: daysAgo(1)
    }
  ]
})

// ── Workflow history ──
write('workflow-history.json', {
  executions: Array.from({ length: 15 }, (_, i) => ({
    id: `exec-${i}`,
    workflowId: i % 3 === 0 ? 'wf-2' : 'wf-1',
    workflowName: i % 3 === 0 ? 'Morning Briefing' : 'Content Pipeline',
    status: i === 0 ? 'running' : i === 4 ? 'failed' : 'completed',
    startedAt: daysAgo(i * 0.7),
    completedAt: i === 0 ? undefined : daysAgo(i * 0.7 - 0.02),
    duration: i === 0 ? undefined : Math.floor(30000 + Math.random() * 120000),
    stepResults: []
  }))
})

// ── Shortcuts (custom overrides) ──
write('shortcuts.json', [
  { id: 'cmd-palette', label: 'Command Palette', description: 'Open command palette', keys: 'Ctrl+K', action: 'command-palette' },
  { id: 'nav-dashboard', label: 'Go to Dashboard', description: 'Navigate to dashboard', keys: 'Ctrl+1', action: 'navigate:/' },
  { id: 'nav-costs', label: 'Go to Costs', description: 'Navigate to costs', keys: 'Ctrl+2', action: 'navigate:/costs' },
  { id: 'nav-agents', label: 'Go to Agents', description: 'Navigate to agents', keys: 'Ctrl+3', action: 'navigate:/agents' },
  { id: 'quick-mode', label: 'Quick Mode Switch', description: 'Cycle through modes', keys: 'Ctrl+M', action: 'cycle-mode' }
])

// ── Webhooks ──
write('webhooks.json', [
  { id: 'wh-1', name: 'Discord Alerts', url: 'https://discord.com/api/webhooks/1234567890/abcdef', events: ['alert.triggered', 'budget.exceeded', 'agent.offline'], enabled: true, lastDelivery: daysAgo(0), deliveryCount: 47, failCount: 1, createdAt: daysAgo(18) },
  { id: 'wh-2', name: 'Slack #ops', url: 'https://hooks.slack.com/services/T00/B00/xxx', events: ['alert.triggered', 'mode.changed'], enabled: true, lastDelivery: daysAgo(1), deliveryCount: 23, failCount: 0, createdAt: daysAgo(12) },
  { id: 'wh-3', name: 'Custom HTTP', url: 'https://api.example.com/webhooks/mc', events: ['budget.exceeded'], enabled: false, deliveryCount: 5, failCount: 2, createdAt: daysAgo(8) }
])

console.log('\nDone! All fake data populated.')
