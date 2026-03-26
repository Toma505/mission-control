const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function writeData(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
  console.log(`  + ${filename}`);
}

console.log('Populating demo data...\n');

// 1. Budget
writeData('budget.json', {
  dailyLimit: 25,
  monthlyLimit: 500,
  autoThrottle: true,
  throttleMode: 'budget',
  alertThresholds: [50, 75, 90],
  updatedAt: '2026-03-25T10:00:00.000Z'
});

// 2. Rich OpenRouter costs (30 days)
const days = [];
for (let i = 29; i >= 0; i--) {
  const d = new Date('2026-03-25');
  d.setDate(d.getDate() - i);
  const dayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const base = 3 + Math.random() * 12;
  days.push({
    date: dayStr,
    breakdown: [
      { type: 'standard', cost: +(base * 0.6).toFixed(2) },
      { type: 'premium', cost: +(base * 0.3).toFixed(2) },
      { type: 'cached', cost: +(base * 0.1).toFixed(2) }
    ],
    total: +base.toFixed(2)
  });
}
writeData('openrouter-costs.json', {
  period: 'Feb 24 - Mar 25',
  model: 'deepseek/deepseek-chat-v3-0324',
  days,
  updatedAt: '2026-03-25T18:00:00.000Z'
});

// 3. Cost history (30 days)
const costHistory = [];
for (let i = 29; i >= 0; i--) {
  const d = new Date('2026-03-25');
  d.setDate(d.getDate() - i);
  const or = +(4 + Math.random() * 10).toFixed(2);
  const anth = +(1 + Math.random() * 5).toFixed(2);
  costHistory.push({
    date: d.toISOString().split('T')[0],
    openrouter: or,
    anthropic: anth,
    railway: 5,
    subscriptions: 20,
    total: +(or + anth + 25).toFixed(2)
  });
}
writeData('cost-history.json', costHistory);

// 4. Alerts
writeData('alerts.json', {
  rules: [
    { id: 'alert-1', name: 'Daily spend over $20', enabled: true, type: 'spend_daily', condition: { metric: 'daily_spend', operator: 'gt', value: 20 }, action: 'notify', cooldownMinutes: 60, lastTriggered: '2026-03-24T15:30:00.000Z', createdAt: '2026-03-05T10:00:00.000Z' },
    { id: 'alert-2', name: 'Monthly budget 80%', enabled: true, type: 'budget_pct', condition: { metric: 'monthly_pct', operator: 'gte', value: 80 }, action: 'notify_and_throttle', cooldownMinutes: 120, createdAt: '2026-03-05T10:00:00.000Z' },
    { id: 'alert-3', name: 'Agent offline detection', enabled: true, type: 'agent_offline', condition: { metric: 'agent_status', operator: 'eq', value: 0 }, action: 'notify', cooldownMinutes: 30, lastTriggered: '2026-03-22T08:00:00.000Z', createdAt: '2026-03-10T14:00:00.000Z' },
    { id: 'alert-4', name: 'Credits below $50', enabled: true, type: 'credits_low', condition: { metric: 'credits_remaining', operator: 'lt', value: 50 }, action: 'notify', cooldownMinutes: 240, createdAt: '2026-03-12T09:00:00.000Z' },
    { id: 'alert-5', name: 'Spike detection (3x average)', enabled: false, type: 'custom', condition: { metric: 'daily_spend', operator: 'gt', value: 45 }, action: 'throttle', cooldownMinutes: 60, createdAt: '2026-03-18T16:00:00.000Z' },
  ],
  history: [
    { ruleId: 'alert-1', ruleName: 'Daily spend over $20', message: 'Daily spend reached $22.47 - exceeded $20 threshold', timestamp: '2026-03-24T15:30:00.000Z' },
    { ruleId: 'alert-3', ruleName: 'Agent offline detection', message: 'Agent "scout" went offline - no heartbeat for 15 minutes', timestamp: '2026-03-22T08:00:00.000Z' },
    { ruleId: 'alert-2', ruleName: 'Monthly budget 80%', message: 'Monthly spend at 82% of $500 budget ($410.50)', timestamp: '2026-03-21T12:00:00.000Z' },
    { ruleId: 'alert-1', ruleName: 'Daily spend over $20', message: 'Daily spend reached $21.30 - exceeded $20 threshold', timestamp: '2026-03-19T18:45:00.000Z' },
    { ruleId: 'alert-4', ruleName: 'Credits below $50', message: 'OpenRouter credits at $42.18 - below $50 threshold', timestamp: '2026-03-17T07:00:00.000Z' },
    { ruleId: 'alert-1', ruleName: 'Daily spend over $20', message: 'Daily spend reached $24.11 - exceeded $20 threshold', timestamp: '2026-03-15T20:00:00.000Z' },
    { ruleId: 'alert-3', ruleName: 'Agent offline detection', message: 'Agent "editor" went offline during scheduled maintenance', timestamp: '2026-03-13T03:00:00.000Z' },
  ]
});

// 5. Audit Log
writeData('audit-log.json', [
  { id: 'audit-1', timestamp: '2026-03-25T17:30:00.000Z', action: 'Mode changed', category: 'mode', details: 'Switched to Performance (claude-sonnet-4)', previous: 'Budget (deepseek-chat-v3)' },
  { id: 'audit-2', timestamp: '2026-03-25T16:00:00.000Z', action: 'Budget updated', category: 'budget', details: 'Monthly limit changed to $500', previous: '$300' },
  { id: 'audit-3', timestamp: '2026-03-25T14:30:00.000Z', action: 'Webhook created', category: 'webhook', details: 'Added Slack webhook "Team Alerts"' },
  { id: 'audit-4', timestamp: '2026-03-25T12:00:00.000Z', action: 'Alert rule created', category: 'alert', details: 'Created "Spike detection (3x average)"' },
  { id: 'audit-5', timestamp: '2026-03-25T10:00:00.000Z', action: 'Preset activated', category: 'preset', details: 'Activated preset "Performance Mode"', previous: 'Fast and Cheap' },
  { id: 'audit-6', timestamp: '2026-03-24T22:00:00.000Z', action: 'Backup created', category: 'backup', details: 'Manual backup snapshot "pre-deploy-v1.0.5"' },
  { id: 'audit-7', timestamp: '2026-03-24T18:00:00.000Z', action: 'Config restored', category: 'config', details: 'Restored config from snapshot "stable-march-22"' },
  { id: 'audit-8', timestamp: '2026-03-24T15:30:00.000Z', action: 'Alert triggered', category: 'alert', details: 'Daily spend over $20 - reached $22.47' },
  { id: 'audit-9', timestamp: '2026-03-24T10:00:00.000Z', action: 'License activated', category: 'license', details: 'Pro license activated on DESKTOP-TOMAS' },
  { id: 'audit-10', timestamp: '2026-03-23T20:00:00.000Z', action: 'Mode changed', category: 'mode', details: 'Switched to Budget (deepseek-chat-v3)', previous: 'Quality (claude-opus-4)' },
  { id: 'audit-11', timestamp: '2026-03-23T14:00:00.000Z', action: 'System update', category: 'system', details: 'Mission Control updated to v1.0.5' },
  { id: 'audit-12', timestamp: '2026-03-22T16:00:00.000Z', action: 'Budget updated', category: 'budget', details: 'Daily limit changed to $25', previous: '$15' },
  { id: 'audit-13', timestamp: '2026-03-22T08:00:00.000Z', action: 'Alert triggered', category: 'alert', details: 'Agent "scout" offline - no heartbeat for 15 minutes' },
  { id: 'audit-14', timestamp: '2026-03-21T12:00:00.000Z', action: 'Webhook fired', category: 'webhook', details: 'Slack notification sent - monthly spend at 82%' },
  { id: 'audit-15', timestamp: '2026-03-20T10:00:00.000Z', action: 'Preset created', category: 'preset', details: 'Created custom preset "Night Owl" with gemini-2.5-flash' },
]);

// 6. Notifications
writeData('notifications.json', [
  { id: 'notif-1', type: 'alert', title: 'Daily Spend Alert', message: 'Spend reached $22.47 today, exceeding your $20 daily limit', timestamp: '2026-03-25T15:30:00.000Z', read: false, href: '/alerts' },
  { id: 'notif-2', type: 'budget', title: 'Budget Threshold', message: 'Monthly spend at 72% of $500 budget', timestamp: '2026-03-25T12:00:00.000Z', read: false, href: '/forecast' },
  { id: 'notif-3', type: 'system', title: 'Update Available', message: 'Mission Control v1.0.6 is available with performance improvements', timestamp: '2026-03-25T09:00:00.000Z', read: false },
  { id: 'notif-4', type: 'webhook', title: 'Webhook Delivered', message: 'Slack alert "Team Alerts" delivered successfully', timestamp: '2026-03-24T22:00:00.000Z', read: true, href: '/webhooks' },
  { id: 'notif-5', type: 'alert', title: 'Agent Back Online', message: 'Agent "scout" reconnected after 12 minute outage', timestamp: '2026-03-24T08:15:00.000Z', read: true, href: '/agents' },
  { id: 'notif-6', type: 'info', title: 'Weekly Recap Ready', message: 'Your weekly usage report for Mar 17-23 is ready to view', timestamp: '2026-03-24T06:00:00.000Z', read: true, href: '/reports' },
  { id: 'notif-7', type: 'budget', title: 'Savings Opportunity', message: 'Switching to deepseek-chat-v3 for routine tasks could save ~$45/mo', timestamp: '2026-03-23T10:00:00.000Z', read: true, href: '/cost-compare' },
]);

// 7. Webhooks
writeData('webhooks.json', [
  { id: 'wh-1', name: 'Team Alerts', url: 'https://hooks.slack.com/services/T0XXXXXX/B0XXXXXX/xxxxxxxxxxxx', type: 'slack', events: ['alert.triggered', 'budget.exceeded', 'agent.offline'], enabled: true, createdAt: '2026-03-10T10:00:00.000Z', lastFired: '2026-03-25T15:30:00.000Z', lastStatus: 200 },
  { id: 'wh-2', name: 'Discord Ops', url: 'https://discord.com/api/webhooks/12345/abcdef', type: 'discord', events: ['alert.triggered', 'mode.changed'], enabled: true, createdAt: '2026-03-15T14:00:00.000Z', lastFired: '2026-03-24T18:00:00.000Z', lastStatus: 204 },
  { id: 'wh-3', name: 'PagerDuty Escalation', url: 'https://events.pagerduty.com/integration/xxxx/enqueue', type: 'generic', events: ['budget.exceeded', 'agent.offline'], enabled: false, createdAt: '2026-03-18T09:00:00.000Z' },
]);

// 8. Prompt Library
writeData('prompt-library.json', [
  { id: 'p-1', name: 'YouTube Script Writer', description: 'Generates engaging YouTube video scripts with hooks, sections, and CTAs', category: 'content', content: 'Write a YouTube video script about {{topic}}. Include a compelling hook, 3-4 main sections, B-roll suggestions, and a strong CTA. Target: {{duration}} minutes. Tone: {{tone}}', variables: ['topic', 'duration', 'tone'], tags: ['youtube', 'content', 'video'], usageCount: 47, createdAt: '2026-03-05T10:00:00.000Z', updatedAt: '2026-03-24T16:00:00.000Z' },
  { id: 'p-2', name: 'Code Review Assistant', description: 'Thorough code review with security, performance, and style checks', category: 'development', content: 'Review this {{language}} code for security vulnerabilities, performance issues, code style, and edge cases. Provide line-by-line feedback with severity ratings.', variables: ['language', 'code'], tags: ['code', 'review', 'security'], usageCount: 34, createdAt: '2026-03-08T14:00:00.000Z', updatedAt: '2026-03-23T09:00:00.000Z' },
  { id: 'p-3', name: 'Email Drafter', description: 'Professional email drafts for various contexts', category: 'communication', content: 'Draft a {{type}} email to {{recipient}}. Context: {{context}}. Key points: {{points}}. Tone: {{tone}}. Max 3 paragraphs.', variables: ['type', 'recipient', 'context', 'points', 'tone'], tags: ['email', 'business'], usageCount: 28, createdAt: '2026-03-10T11:00:00.000Z', updatedAt: '2026-03-25T08:00:00.000Z' },
  { id: 'p-4', name: 'Data Analysis Pipeline', description: 'Structured data analysis with insights and visualizations', category: 'analytics', content: 'Analyze this dataset: {{data_description}}. Perform summary statistics, trend identification, anomaly detection, top {{n}} insights, and recommended visualizations.', variables: ['data_description', 'n', 'format'], tags: ['data', 'analytics'], usageCount: 19, createdAt: '2026-03-12T08:00:00.000Z', updatedAt: '2026-03-22T17:00:00.000Z' },
  { id: 'p-5', name: 'Bug Report Generator', description: 'Structured bug reports from user descriptions', category: 'development', content: 'Create a structured bug report from: {{description}}. Include title, steps to reproduce, expected vs actual behavior, environment: {{environment}}, and severity rating.', variables: ['description', 'environment'], tags: ['bug', 'qa'], usageCount: 15, createdAt: '2026-03-14T16:00:00.000Z', updatedAt: '2026-03-20T12:00:00.000Z' },
  { id: 'p-6', name: 'SEO Content Optimizer', description: 'Optimize content for search engines while keeping it natural', category: 'marketing', content: 'Optimize for SEO. Target: {{keyword}}. Secondary: {{secondary}}. Provide optimized title tag, meta description, header structure, internal linking suggestions, and readability score.', variables: ['keyword', 'secondary', 'content'], tags: ['seo', 'marketing'], usageCount: 22, createdAt: '2026-03-06T13:00:00.000Z', updatedAt: '2026-03-25T11:00:00.000Z' },
  { id: 'p-7', name: 'Meeting Notes Summarizer', description: 'Extract action items and key decisions from meeting transcripts', category: 'productivity', content: 'Summarize this meeting: {{transcript}}. Provide key decisions, action items with owners and deadlines, open questions, and next steps. Under 200 words.', variables: ['transcript'], tags: ['meetings', 'productivity'], usageCount: 41, createdAt: '2026-03-03T09:00:00.000Z', updatedAt: '2026-03-25T14:00:00.000Z' },
]);

// 9. Config Snapshots
writeData('config-snapshots.json', [
  { id: 'snap-1', name: 'pre-deploy-v1.0.5', createdAt: '2026-03-24T22:00:00.000Z', data: { budget: { dailyLimit: 25, monthlyLimit: 500 }, mode: 'budget', openclawUrl: 'https://clawdbot-railway-template-production-c7bb.up.railway.app' } },
  { id: 'snap-2', name: 'stable-march-22', createdAt: '2026-03-22T10:00:00.000Z', data: { budget: { dailyLimit: 15, monthlyLimit: 300 }, mode: 'quality', openclawUrl: 'https://clawdbot-railway-template-production-c7bb.up.railway.app' } },
  { id: 'snap-3', name: 'initial-setup', createdAt: '2026-03-05T10:00:00.000Z', data: { budget: { dailyLimit: 10, monthlyLimit: 100 }, mode: 'budget', openclawUrl: 'https://clawdbot-railway-template-production-c7bb.up.railway.app' } },
]);

// 10. Cost Tags
writeData('cost-tags.json', {
  tags: [
    { id: 'tag-1', name: 'YouTube Production', color: '#ef4444', description: 'Video scripts, research, and editing tasks', createdAt: '2026-03-08T10:00:00.000Z' },
    { id: 'tag-2', name: 'Client Work', color: '#3b82f6', description: 'Billable client-facing tasks', createdAt: '2026-03-08T10:00:00.000Z' },
    { id: 'tag-3', name: 'Research', color: '#8b5cf6', description: 'Topic research and market analysis', createdAt: '2026-03-10T14:00:00.000Z' },
    { id: 'tag-4', name: 'Internal Tools', color: '#10b981', description: 'Building and maintaining internal automation', createdAt: '2026-03-12T08:00:00.000Z' },
    { id: 'tag-5', name: 'Content Pipeline', color: '#f59e0b', description: 'Social media, blogs, newsletters', createdAt: '2026-03-15T11:00:00.000Z' },
  ],
  assignments: [
    { sessionKey: 'agent:default:main', tagId: 'tag-1', assignedAt: '2026-03-25T10:00:00.000Z', notes: 'Weekly video script batch' },
    { sessionKey: 'agent:scout:research', tagId: 'tag-3', assignedAt: '2026-03-25T08:00:00.000Z', notes: 'AI trends deep dive' },
    { sessionKey: 'agent:editor:polish', tagId: 'tag-1', assignedAt: '2026-03-24T16:00:00.000Z', notes: 'Script revisions for ep. 47' },
    { sessionKey: 'agent:default:client-brief', tagId: 'tag-2', assignedAt: '2026-03-24T14:00:00.000Z', notes: 'Acme Corp brief' },
    { sessionKey: 'agent:scout:pipeline', tagId: 'tag-5', assignedAt: '2026-03-24T09:00:00.000Z', notes: 'Newsletter draft' },
    { sessionKey: 'agent:default:tooling', tagId: 'tag-4', assignedAt: '2026-03-23T15:00:00.000Z' },
  ]
});

// 11. Scheduled Reports
writeData('scheduled-reports.json', [
  { id: 'sr-1', name: 'Weekly Cost Summary', frequency: 'weekly', format: 'csv', includes: ['costs', 'models', 'alerts'], enabled: true, lastRun: '2026-03-24T06:00:00.000Z', nextRun: '2026-03-31T06:00:00.000Z', createdAt: '2026-03-10T10:00:00.000Z' },
  { id: 'sr-2', name: 'Monthly Usage Report', frequency: 'monthly', format: 'json', includes: ['costs', 'tokens', 'models', 'agents', 'alerts'], enabled: true, lastRun: '2026-03-01T06:00:00.000Z', nextRun: '2026-04-01T06:00:00.000Z', createdAt: '2026-03-05T10:00:00.000Z' },
  { id: 'sr-3', name: 'Daily Spend Check', frequency: 'daily', format: 'csv', includes: ['costs'], enabled: false, lastRun: '2026-03-24T06:00:00.000Z', nextRun: '2026-03-25T06:00:00.000Z', createdAt: '2026-03-18T14:00:00.000Z' },
]);

// 12. Team (enriched)
writeData('team.json', {
  name: 'OpenClaw Studio',
  plan: 'pro',
  createdAt: '2026-03-01T10:00:00.000Z',
  members: [
    { id: 'owner-1', name: 'Tomas', email: 'tomas@openclaw.dev', role: 'owner', joinedAt: '2026-03-01T10:00:00.000Z', lastActiveAt: '2026-03-25T18:00:00.000Z', status: 'active' },
    { id: 'member-2', name: 'Alex Chen', email: 'alex@openclaw.dev', role: 'admin', joinedAt: '2026-03-05T14:00:00.000Z', lastActiveAt: '2026-03-25T16:30:00.000Z', status: 'active' },
    { id: 'member-3', name: 'Sarah Kim', email: 'sarah@openclaw.dev', role: 'member', joinedAt: '2026-03-10T09:00:00.000Z', lastActiveAt: '2026-03-25T12:00:00.000Z', status: 'active' },
    { id: 'member-4', name: 'Jordan Reeves', email: 'jordan@openclaw.dev', role: 'member', joinedAt: '2026-03-15T11:00:00.000Z', lastActiveAt: '2026-03-24T20:00:00.000Z', status: 'active' },
    { id: 'member-5', name: 'DevOps Bot', email: 'devops@openclaw.dev', role: 'viewer', joinedAt: '2026-03-18T08:00:00.000Z', lastActiveAt: '2026-03-25T17:45:00.000Z', status: 'active' },
  ]
});

// 13. Subscriptions
writeData('subscriptions.json', [
  { id: 'sub-1', name: 'OpenRouter Pro', cost: 0, provider: 'openrouter', cycle: 'monthly' },
  { id: 'sub-2', name: 'Railway Hobby', cost: 5, provider: 'other', cycle: 'monthly' },
  { id: 'sub-3', name: 'Anthropic API', cost: 0, provider: 'anthropic', cycle: 'monthly' },
  { id: 'sub-4', name: 'GitHub Copilot', cost: 10, provider: 'other', cycle: 'monthly' },
  { id: 'sub-5', name: 'Vercel Pro', cost: 20, provider: 'other', cycle: 'monthly' },
]);

// 14. Model Presets
writeData('model-presets.json', [
  { id: 'preset-1', name: 'Fast and Cheap', description: 'DeepSeek V3 for rapid, cost-effective tasks', model: 'deepseek/deepseek-chat-v3-0324', fallbacks: ['google/gemini-2.5-flash'], temperature: 0.7, maxTokens: 4096, isBuiltIn: true, createdAt: '2026-03-01T10:00:00.000Z' },
  { id: 'preset-2', name: 'Performance Mode', description: 'Claude Sonnet for balanced quality and speed', model: 'anthropic/claude-sonnet-4', fallbacks: ['anthropic/claude-haiku-3.5'], temperature: 0.5, maxTokens: 8192, isBuiltIn: true, createdAt: '2026-03-01T10:00:00.000Z' },
  { id: 'preset-3', name: 'Maximum Quality', description: 'Claude Opus for complex reasoning and analysis', model: 'anthropic/claude-opus-4', fallbacks: ['anthropic/claude-sonnet-4'], temperature: 0.3, maxTokens: 16384, isBuiltIn: true, createdAt: '2026-03-01T10:00:00.000Z' },
  { id: 'preset-4', name: 'Night Owl', description: 'Flash model for off-hours background tasks', model: 'google/gemini-2.5-flash', fallbacks: ['deepseek/deepseek-chat-v3-0324'], temperature: 0.7, maxTokens: 4096, systemPrompt: 'You are a background research assistant. Be thorough but concise.', isBuiltIn: false, createdAt: '2026-03-20T22:00:00.000Z' },
  { id: 'preset-5', name: 'Code Expert', description: 'Optimized for coding tasks with strict output', model: 'anthropic/claude-sonnet-4', fallbacks: ['deepseek/deepseek-coder-v3'], temperature: 0.2, maxTokens: 8192, systemPrompt: 'You are an expert software engineer. Write clean, tested, production-ready code.', isBuiltIn: false, createdAt: '2026-03-15T10:00:00.000Z' },
]);

// 15. Documents
writeData('documents.json', [
  { id: 'doc-1', name: 'Brand Voice Guide', type: 'markdown', size: 4200, tags: ['brand', 'voice', 'guidelines'], createdAt: '2026-03-05T10:00:00.000Z', updatedAt: '2026-03-22T14:00:00.000Z' },
  { id: 'doc-2', name: 'Content Calendar Q2', type: 'markdown', size: 8500, tags: ['content', 'planning', 'Q2'], createdAt: '2026-03-15T09:00:00.000Z', updatedAt: '2026-03-25T11:00:00.000Z' },
  { id: 'doc-3', name: 'Client Onboarding SOP', type: 'markdown', size: 3100, tags: ['clients', 'onboarding', 'sop'], createdAt: '2026-03-10T14:00:00.000Z', updatedAt: '2026-03-20T16:00:00.000Z' },
  { id: 'doc-4', name: 'API Rate Limits Reference', type: 'markdown', size: 1800, tags: ['api', 'reference', 'limits'], createdAt: '2026-03-12T11:00:00.000Z', updatedAt: '2026-03-18T09:00:00.000Z' },
  { id: 'doc-5', name: 'Competitor Analysis - March', type: 'markdown', size: 6200, tags: ['research', 'competitors', 'analysis'], createdAt: '2026-03-20T08:00:00.000Z', updatedAt: '2026-03-25T10:00:00.000Z' },
  { id: 'doc-6', name: 'Pricing Strategy v2', type: 'markdown', size: 2900, tags: ['pricing', 'strategy', 'business'], createdAt: '2026-03-08T15:00:00.000Z', updatedAt: '2026-03-24T13:00:00.000Z' },
]);

// 16. Clients
writeData('clients.json', [
  { id: 'client-1', name: 'Acme Corp', contact: 'mike@acmecorp.com', status: 'active', projects: 3, totalSpend: 2400, lastActivity: '2026-03-25T14:00:00.000Z', createdAt: '2026-03-01T10:00:00.000Z' },
  { id: 'client-2', name: 'TechStart Labs', contact: 'lisa@techstartlabs.com', status: 'active', projects: 1, totalSpend: 850, lastActivity: '2026-03-24T16:00:00.000Z', createdAt: '2026-03-08T09:00:00.000Z' },
  { id: 'client-3', name: 'CreativeFlow Agency', contact: 'james@creativeflow.io', status: 'active', projects: 2, totalSpend: 1600, lastActivity: '2026-03-23T11:00:00.000Z', createdAt: '2026-03-05T14:00:00.000Z' },
  { id: 'client-4', name: 'DataPulse Inc', contact: 'sarah@datapulse.ai', status: 'paused', projects: 1, totalSpend: 500, lastActivity: '2026-03-18T10:00:00.000Z', createdAt: '2026-03-12T08:00:00.000Z' },
  { id: 'client-5', name: 'NovaBrand', contact: 'chris@novabrand.co', status: 'active', projects: 4, totalSpend: 3200, lastActivity: '2026-03-25T17:00:00.000Z', createdAt: '2026-02-28T10:00:00.000Z' },
]);

// 17. Cron Jobs
writeData('cron-jobs.json', [
  { id: 'cron-1', name: 'Daily Cost Snapshot', schedule: '0 6 * * *', command: 'snapshot-costs', enabled: true, lastRun: '2026-03-25T06:00:00.000Z', lastStatus: 'success', nextRun: '2026-03-26T06:00:00.000Z', createdAt: '2026-03-05T10:00:00.000Z' },
  { id: 'cron-2', name: 'Weekly Backup', schedule: '0 2 * * 0', command: 'create-snapshot', enabled: true, lastRun: '2026-03-23T02:00:00.000Z', lastStatus: 'success', nextRun: '2026-03-30T02:00:00.000Z', createdAt: '2026-03-05T10:00:00.000Z' },
  { id: 'cron-3', name: 'Alert Check', schedule: '*/5 * * * *', command: 'check-alerts', enabled: true, lastRun: '2026-03-25T17:55:00.000Z', lastStatus: 'success', nextRun: '2026-03-25T18:00:00.000Z', createdAt: '2026-03-10T10:00:00.000Z' },
  { id: 'cron-4', name: 'Newsletter Draft', schedule: '0 8 * * 1', command: 'draft-newsletter', enabled: false, lastRun: '2026-03-24T08:00:00.000Z', lastStatus: 'success', nextRun: '2026-03-31T08:00:00.000Z', createdAt: '2026-03-15T14:00:00.000Z' },
  { id: 'cron-5', name: 'Model Benchmark', schedule: '0 3 1 * *', command: 'run-benchmarks', enabled: true, lastRun: '2026-03-01T03:00:00.000Z', lastStatus: 'success', nextRun: '2026-04-01T03:00:00.000Z', createdAt: '2026-03-01T10:00:00.000Z' },
]);

// 18. Intelligence
writeData('intelligence.json', [
  { id: 'intel-1', type: 'insight', title: 'Cost Optimization Opportunity', description: 'Switching 40% of Claude Sonnet tasks to DeepSeek V3 could save $85/mo with less than 3% quality loss on routine tasks', priority: 'high', createdAt: '2026-03-25T10:00:00.000Z', status: 'actionable' },
  { id: 'intel-2', type: 'trend', title: 'Token Usage Growing 15% Weekly', description: 'Input tokens have grown 15% week-over-week for 3 consecutive weeks. Current trajectory would exceed budget by April 12.', priority: 'medium', createdAt: '2026-03-24T08:00:00.000Z', status: 'monitoring' },
  { id: 'intel-3', type: 'anomaly', title: 'Unusual Spike on March 17', description: 'Spend spiked to $15.11 on March 17, 5x the daily average. Root cause: large batch script generation run.', priority: 'low', createdAt: '2026-03-18T06:00:00.000Z', status: 'resolved' },
  { id: 'intel-4', type: 'recommendation', title: 'Enable Prompt Caching', description: 'Analysis shows 35% of your prompts share common system prompts. Enabling caching could reduce input costs by 20%.', priority: 'high', createdAt: '2026-03-23T14:00:00.000Z', status: 'actionable' },
  { id: 'intel-5', type: 'insight', title: 'Peak Usage Hours: 2-6 PM', description: 'Token consumption is highest between 2-6 PM. Consider scheduling batch tasks for off-peak hours at lower rates.', priority: 'medium', createdAt: '2026-03-22T12:00:00.000Z', status: 'monitoring' },
]);

// 19. Instances
writeData('instances.json', [
  { id: 'inst-1', name: 'Production', url: 'https://clawdbot-railway-template-production-c7bb.up.railway.app', status: 'online', uptime: '99.8%', lastPing: '2026-03-25T17:59:00.000Z', region: 'us-east-1', version: '1.0.5', createdAt: '2026-03-01T10:00:00.000Z' },
  { id: 'inst-2', name: 'Staging', url: 'https://clawdbot-staging.up.railway.app', status: 'online', uptime: '97.2%', lastPing: '2026-03-25T17:58:00.000Z', region: 'us-east-1', version: '1.0.6-rc1', createdAt: '2026-03-10T14:00:00.000Z' },
  { id: 'inst-3', name: 'Dev Local', url: 'http://localhost:3033', status: 'online', uptime: '100%', lastPing: '2026-03-25T17:59:00.000Z', region: 'local', version: '1.0.6-dev', createdAt: '2026-03-15T08:00:00.000Z' },
]);

// 20. Workflows
writeData('workflows.json', {
  templates: [
    { id: 'wf-1', name: 'Content Pipeline', description: 'Research, Draft, Edit, Publish', steps: ['research', 'draft', 'review', 'edit', 'publish'], triggers: ['manual', 'schedule'], enabled: true, runs: 23, lastRun: '2026-03-25T14:00:00.000Z', createdAt: '2026-03-05T10:00:00.000Z' },
    { id: 'wf-2', name: 'Client Brief to Deliverable', description: 'Intake brief, research, generate draft, quality check', steps: ['intake', 'research', 'generate', 'qa', 'deliver'], triggers: ['manual'], enabled: true, runs: 8, lastRun: '2026-03-24T16:00:00.000Z', createdAt: '2026-03-10T14:00:00.000Z' },
    { id: 'wf-3', name: 'Morning Report', description: 'Auto-generate daily summary of agent activity and costs', steps: ['gather-metrics', 'analyze', 'format', 'deliver'], triggers: ['schedule'], enabled: true, runs: 15, lastRun: '2026-03-25T06:00:00.000Z', createdAt: '2026-03-08T08:00:00.000Z' },
    { id: 'wf-4', name: 'Social Media Batch', description: 'Generate week of social posts from content calendar', steps: ['load-calendar', 'generate-posts', 'review', 'schedule'], triggers: ['manual'], enabled: false, runs: 3, lastRun: '2026-03-20T10:00:00.000Z', createdAt: '2026-03-18T15:00:00.000Z' },
  ]
});

// 21. Workflow History
writeData('workflow-history.json', [
  { id: 'wfr-1', workflowId: 'wf-1', workflowName: 'Content Pipeline', status: 'completed', startedAt: '2026-03-25T14:00:00.000Z', completedAt: '2026-03-25T14:12:00.000Z', duration: 720, tokensUsed: 45200, cost: 0.85 },
  { id: 'wfr-2', workflowId: 'wf-3', workflowName: 'Morning Report', status: 'completed', startedAt: '2026-03-25T06:00:00.000Z', completedAt: '2026-03-25T06:03:00.000Z', duration: 180, tokensUsed: 12400, cost: 0.18 },
  { id: 'wfr-3', workflowId: 'wf-2', workflowName: 'Client Brief to Deliverable', status: 'completed', startedAt: '2026-03-24T16:00:00.000Z', completedAt: '2026-03-24T16:25:00.000Z', duration: 1500, tokensUsed: 89000, cost: 2.45 },
  { id: 'wfr-4', workflowId: 'wf-1', workflowName: 'Content Pipeline', status: 'completed', startedAt: '2026-03-24T10:00:00.000Z', completedAt: '2026-03-24T10:15:00.000Z', duration: 900, tokensUsed: 52000, cost: 0.92 },
  { id: 'wfr-5', workflowId: 'wf-3', workflowName: 'Morning Report', status: 'failed', startedAt: '2026-03-24T06:00:00.000Z', completedAt: '2026-03-24T06:01:00.000Z', duration: 60, tokensUsed: 3200, cost: 0.04, error: 'OpenRouter rate limit exceeded' },
  { id: 'wfr-6', workflowId: 'wf-4', workflowName: 'Social Media Batch', status: 'completed', startedAt: '2026-03-20T10:00:00.000Z', completedAt: '2026-03-20T10:30:00.000Z', duration: 1800, tokensUsed: 67000, cost: 1.20 },
]);

// 22. Key Vault
writeData('key-vault.json', [
  { id: 'kv-1', name: 'OPENROUTER_API_KEY', provider: 'OpenRouter', maskedValue: 'sk-or-v1-****eee', addedAt: '2026-03-01T10:00:00.000Z', lastUsed: '2026-03-25T17:00:00.000Z', status: 'active' },
  { id: 'kv-2', name: 'ANTHROPIC_API_KEY', provider: 'Anthropic', maskedValue: 'sk-ant-****f2a', addedAt: '2026-03-05T14:00:00.000Z', lastUsed: '2026-03-25T16:00:00.000Z', status: 'active' },
  { id: 'kv-3', name: 'OPENAI_API_KEY', provider: 'OpenAI', maskedValue: 'sk-proj-****x9k', addedAt: '2026-03-10T09:00:00.000Z', lastUsed: '2026-03-22T10:00:00.000Z', status: 'active' },
  { id: 'kv-4', name: 'GOOGLE_AI_KEY', provider: 'Google', maskedValue: 'AIza****Qm8', addedAt: '2026-03-12T11:00:00.000Z', lastUsed: '2026-03-25T15:00:00.000Z', status: 'active' },
  { id: 'kv-5', name: 'DISCORD_WEBHOOK', provider: 'Discord', maskedValue: 'https://disc****def', addedAt: '2026-03-15T08:00:00.000Z', lastUsed: '2026-03-24T18:00:00.000Z', status: 'active' },
  { id: 'kv-6', name: 'SLACK_BOT_TOKEN', provider: 'Slack', maskedValue: 'xoxb-****abc', addedAt: '2026-03-10T10:00:00.000Z', lastUsed: '2026-03-25T15:30:00.000Z', status: 'active' },
]);

// 23. Activities
writeData('activities.json', [
  { id: 'act-1', type: 'agent', agent: 'default', action: 'Script generated', details: 'YouTube script "Claude 4 Deep Dive" - 2,400 words', timestamp: '2026-03-25T17:30:00.000Z', tokens: 8500, cost: 0.42 },
  { id: 'act-2', type: 'agent', agent: 'scout', action: 'Research completed', details: 'AI trends analysis - 5 topics identified', timestamp: '2026-03-25T16:00:00.000Z', tokens: 12000, cost: 0.18 },
  { id: 'act-3', type: 'agent', agent: 'editor', action: 'Content polished', details: 'Script revision - readability improved by 15%', timestamp: '2026-03-25T15:00:00.000Z', tokens: 6200, cost: 0.31 },
  { id: 'act-4', type: 'workflow', action: 'Pipeline completed', details: 'Content Pipeline ran successfully in 12 min', timestamp: '2026-03-25T14:12:00.000Z', tokens: 45200, cost: 0.85 },
  { id: 'act-5', type: 'system', action: 'Alert triggered', details: 'Daily spend exceeded $20 threshold', timestamp: '2026-03-25T13:30:00.000Z' },
  { id: 'act-6', type: 'agent', agent: 'default', action: 'Email drafted', details: 'Client follow-up email for Acme Corp', timestamp: '2026-03-25T12:00:00.000Z', tokens: 3400, cost: 0.17 },
  { id: 'act-7', type: 'workflow', action: 'Morning report delivered', details: 'Daily summary generated and sent to Slack', timestamp: '2026-03-25T06:03:00.000Z', tokens: 12400, cost: 0.18 },
  { id: 'act-8', type: 'agent', agent: 'scout', action: 'Competitor scan', details: 'Weekly competitor analysis - 3 new features detected', timestamp: '2026-03-24T20:00:00.000Z', tokens: 18000, cost: 0.27 },
]);

// 24. Operations
writeData('operations.json', [
  { id: 'op-1', name: 'YouTube Ep. 47 Script', status: 'completed', agent: 'default', model: 'claude-sonnet-4', tokens: 24500, cost: 1.22, startedAt: '2026-03-25T14:00:00.000Z', completedAt: '2026-03-25T14:45:00.000Z', steps: 4 },
  { id: 'op-2', name: 'AI Trends Research', status: 'running', agent: 'scout', model: 'deepseek-chat-v3', tokens: 18200, cost: 0.27, startedAt: '2026-03-25T16:00:00.000Z', steps: 3 },
  { id: 'op-3', name: 'Client Brief: Acme Corp', status: 'completed', agent: 'default', model: 'claude-sonnet-4', tokens: 89000, cost: 2.45, startedAt: '2026-03-24T16:00:00.000Z', completedAt: '2026-03-24T16:25:00.000Z', steps: 5 },
  { id: 'op-4', name: 'Newsletter Draft', status: 'completed', agent: 'scout', model: 'deepseek-chat-v3', tokens: 15800, cost: 0.24, startedAt: '2026-03-24T10:00:00.000Z', completedAt: '2026-03-24T10:20:00.000Z', steps: 3 },
  { id: 'op-5', name: 'Social Media Batch', status: 'completed', agent: 'editor', model: 'gemini-2.5-flash', tokens: 67000, cost: 1.20, startedAt: '2026-03-20T10:00:00.000Z', completedAt: '2026-03-20T10:30:00.000Z', steps: 4 },
  { id: 'op-6', name: 'Competitor Analysis', status: 'completed', agent: 'scout', model: 'deepseek-chat-v3', tokens: 42000, cost: 0.63, startedAt: '2026-03-19T14:00:00.000Z', completedAt: '2026-03-19T14:35:00.000Z', steps: 4 },
  { id: 'op-7', name: 'Script Polish Ep. 46', status: 'completed', agent: 'editor', model: 'claude-sonnet-4', tokens: 31000, cost: 1.55, startedAt: '2026-03-18T15:00:00.000Z', completedAt: '2026-03-18T15:20:00.000Z', steps: 3 },
]);

// 25. Weekly Recaps
writeData('weekly-recaps.json', [
  { id: 'recap-1', week: 'Mar 17-23', totalSpend: 89.42, totalTokens: 2450000, topModel: 'deepseek-chat-v3', topAgent: 'default', alertsTriggered: 3, pipelinesRun: 12, highlights: ['Completed 5 YouTube scripts', 'Client deliverable for Acme Corp', 'Switched to budget mode mid-week'], createdAt: '2026-03-24T06:00:00.000Z' },
  { id: 'recap-2', week: 'Mar 10-16', totalSpend: 72.18, totalTokens: 1890000, topModel: 'claude-sonnet-4', topAgent: 'scout', alertsTriggered: 1, pipelinesRun: 8, highlights: ['Onboarded 2 new clients', 'Set up alert rules', 'First workflow automation'], createdAt: '2026-03-17T06:00:00.000Z' },
  { id: 'recap-3', week: 'Mar 3-9', totalSpend: 45.60, totalTokens: 1200000, topModel: 'deepseek-chat-v3', topAgent: 'default', alertsTriggered: 0, pipelinesRun: 3, highlights: ['Initial setup complete', 'First content pipeline run', 'Budget limits configured'], createdAt: '2026-03-10T06:00:00.000Z' },
]);

console.log('\nAll demo data populated!');
console.log(`Files created in: ${DATA_DIR}`);
