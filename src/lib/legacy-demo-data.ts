type NamedRecord = {
  name?: string
}

type AddressRecord = {
  address?: string
  name?: string
}

type PromptLikeRecord = {
  name?: string
}

type ActivitySeed = {
  agents?: Array<{ id?: string; label?: string }>
  weeks?: Array<Record<string, unknown>>
}

type TeamUsageStore = {
  users?: Array<{ name?: string }>
  agents?: Array<{ name?: string }>
  sessions?: Array<{ taskDescription?: string }>
}

type ReplayStore = {
  sessions?: Array<{ taskDescription?: string; agentId?: string }>
}

type CostTagRecord = {
  id?: string
  name?: string
}

type WorkflowRecord = {
  id?: string
  name?: string
}

type WorkflowExecutionRecord = {
  workflowId?: string
  workflowName?: string
}

type InstanceRecord = {
  name?: string
  url?: string
}

const LEGACY_DEMO_CLIENTS = new Set([
  'Acme Corp',
  'TechStart Labs',
  'CreativeFlow Agency',
  'DataPulse Inc',
  'NovaBrand',
])

const LEGACY_DEMO_DOCUMENTS = new Set([
  'Brand Voice Guide',
  'Content Calendar Q2',
  'Client Onboarding SOP',
  'API Rate Limits Reference',
  'Competitor Analysis - March',
  'Pricing Strategy v2',
])

const LEGACY_DEMO_OPERATIONS = new Set([
  'YouTube Ep. 47 Script',
  'AI Trends Research',
  'Client Brief: Acme Corp',
])

const LEGACY_DEMO_SCHEDULES = new Set([
  'Daily Briefing',
  'Discord Follow-ups',
])

const LEGACY_DEMO_PROMPTS = new Set([
  'Launch Readiness Review',
  'Agent Brief Builder',
  'Video Outline Sprint',
])

const LEGACY_DEMO_COST_TAG_IDS = new Set(['tag-1', 'tag-2', 'tag-3', 'tag-4', 'tag-5'])

const LEGACY_DEMO_COST_TAG_NAMES = new Set([
  'YouTube Production',
  'Client Work',
  'Research',
  'Internal Tools',
  'Content Pipeline',
])

const LEGACY_DEMO_REPLAYS = new Set([
  'Audit Mission Control launch channels and recommend the fastest path to launch',
  'Tighten a YouTube outline about Claude 4 and improve the hook',
  'Validate nightly backup workflow and report any failures',
])

const LEGACY_DEMO_INSTANCE_NAMES = new Set(['Production', 'Staging', 'Dev Local'])
const LEGACY_DEMO_INSTANCE_URLS = new Set([
  'https://clawdbot-railway-template-production-c7bb.up.railway.app',
  'https://clawdbot-staging.up.railway.app',
  'http://localhost:3033',
])

const LEGACY_STARTER_WORKFLOW_IDS = new Set([
  'workflow-template-budget-overnight',
  'workflow-template-alert-high-spend',
])

const LEGACY_INTERNAL_WORKFLOW_EXECUTION_PREFIXES = [
  'Budget QA ',
  'Mode QA ',
  'Condition QA ',
  'QA Workflow ',
]

const LEGACY_INTERNAL_WORKFLOW_EXECUTION_NAMES = new Set([
  'Reload Smoke',
  'Packaged Workflow Smoke',
])

const LEGACY_ACTIVITY_AGENTS = new Set(['default', 'scout', 'editor', 'support'])

const LEGACY_TEAM_USERS = new Set(['Ava Chen', 'Noah Brooks', 'Mia Patel'])

function normalizeName(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function isLegacyDemoClients(items: NamedRecord[]) {
  if (items.length === 0) return false
  return items.every((item) => LEGACY_DEMO_CLIENTS.has(normalizeName(item.name)))
}

export function isLegacyDemoDocuments(items: NamedRecord[]) {
  if (items.length === 0) return false
  return items.every((item) => LEGACY_DEMO_DOCUMENTS.has(normalizeName(item.name)))
}

export function isLegacyDemoOperations(items: AddressRecord[]) {
  if (items.length === 0) return false
  return items.every((item) => {
    const candidate = normalizeName(item.address) || normalizeName(item.name)
    return LEGACY_DEMO_OPERATIONS.has(candidate)
  })
}

export function isLegacyDemoSchedules(items: NamedRecord[]) {
  if (items.length === 0) return false
  return items.every((item) => LEGACY_DEMO_SCHEDULES.has(normalizeName(item.name)))
}

export function isLegacyDemoPrompts(items: PromptLikeRecord[]) {
  if (items.length === 0) return false
  return items.every((item) => LEGACY_DEMO_PROMPTS.has(normalizeName(item.name)))
}

export function isLegacyDemoCostTags(items: CostTagRecord[]) {
  if (items.length === 0) return false

  return items.every((item) => {
    const id = normalizeName(item.id)
    const name = normalizeName(item.name)
    return LEGACY_DEMO_COST_TAG_IDS.has(id) && LEGACY_DEMO_COST_TAG_NAMES.has(name)
  })
}

export function isLegacyDemoReplayStore(store: ReplayStore) {
  const sessions = Array.isArray(store.sessions) ? store.sessions : []
  if (sessions.length === 0) return false

  return sessions.every((session) => LEGACY_DEMO_REPLAYS.has(normalizeName(session.taskDescription)))
}

export function isLegacyDemoInstances(items: InstanceRecord[]) {
  if (items.length === 0) return false

  return items.every((item) => {
    const name = normalizeName(item.name)
    const url = normalizeName(item.url)
    return LEGACY_DEMO_INSTANCE_NAMES.has(name) && LEGACY_DEMO_INSTANCE_URLS.has(url)
  })
}

export function isLegacyDemoActivitySeed(seed: ActivitySeed) {
  const agents = Array.isArray(seed.agents) ? seed.agents : []
  const weeks = Array.isArray(seed.weeks) ? seed.weeks : []
  if (agents.length === 0 || weeks.length < 12) return false

  const agentIds = agents.map((agent) => normalizeName(agent.id)).filter(Boolean)
  if (agentIds.length === 0 || !agentIds.every((agentId) => LEGACY_ACTIVITY_AGENTS.has(agentId))) {
    return false
  }

  return weeks.every((week) =>
    Object.keys(week).every((key) => key === 'weekOf' || LEGACY_ACTIVITY_AGENTS.has(key)),
  )
}

export function isLegacyDemoTeamUsageStore(store: TeamUsageStore) {
  const users = Array.isArray(store.users) ? store.users : []
  const sessions = Array.isArray(store.sessions) ? store.sessions : []
  if (users.length < 3 || sessions.length === 0) return false

  const userNames = new Set(users.map((user) => normalizeName(user.name)).filter(Boolean))
  const hasLegacyUsers = [...LEGACY_TEAM_USERS].every((name) => userNames.has(name))
  if (!hasLegacyUsers) return false

  return sessions.some((session) => normalizeName(session.taskDescription).includes('launch'))
}

export function isLegacyStarterWorkflow(item: WorkflowRecord) {
  return LEGACY_STARTER_WORKFLOW_IDS.has(normalizeName(item.id))
}

export function isLegacyInternalWorkflowExecution(item: WorkflowExecutionRecord) {
  const workflowId = normalizeName(item.workflowId)
  if (LEGACY_STARTER_WORKFLOW_IDS.has(workflowId)) {
    return true
  }

  const workflowName = normalizeName(item.workflowName)
  if (LEGACY_INTERNAL_WORKFLOW_EXECUTION_NAMES.has(workflowName)) {
    return true
  }

  return LEGACY_INTERNAL_WORKFLOW_EXECUTION_PREFIXES.some((prefix) => workflowName.startsWith(prefix))
}
