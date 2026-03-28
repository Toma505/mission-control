import { randomUUID } from 'crypto'
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'fs/promises'
import path from 'path'
import { jsPDF } from 'jspdf'
import { DATA_DIR } from '@/lib/connection-config'

export type ReportKind = 'agent_session_summary' | 'cost_report' | 'instance_health'
export type ReportFormat = 'pdf' | 'csv' | 'json'
export type ReportGranularity = 'daily' | 'weekly' | 'monthly'

export interface ReportDateRange {
  start: string
  end: string
}

export interface ReportBuilderInput {
  name: string
  kind: ReportKind
  format: ReportFormat
  granularity: ReportGranularity
  dateRange: ReportDateRange
  instanceIds: string[]
  agentIds: string[]
}

export interface ReportMetadata extends ReportBuilderInput {
  id: string
  createdAt: string
  fileName: string
  filePath: string
  sizeBytes: number
  previewSummary: Record<string, unknown>
}

interface ReportsStore {
  reports: ReportMetadata[]
}

interface CostEntry {
  id: string
  instanceId: string
  agentId: string
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  timestamp: string
  taskDescription: string
}

interface ReplayToolCall {
  name: string
  status: string
  durationMs?: number
  input?: string
  outputSummary?: string
}

interface ReplayFileChange {
  path: string
  summary: string
  before?: string
  after?: string
}

interface ReplayStep {
  id: string
  title: string
  timestamp: string
  input: string
  action: string
  result: string
  prompt?: string
  response?: string
  toolCalls?: ReplayToolCall[]
  fileChanges?: ReplayFileChange[]
}

interface ReplaySession {
  id: string
  sessionKey: string
  agentId: string
  instanceId: string
  model: string
  taskDescription: string
  startedAt: string
  completedAt?: string
  durationMs?: number
  status: string
  steps: ReplayStep[]
}

interface ManagedInstance {
  id: string
  name: string
  url: string
  enabled: boolean
  color?: string
  lastSeen?: string
  status?: 'online' | 'offline' | 'error'
  statusMessage?: string
  health?: {
    mode?: string
    model?: string
    uptime?: string
    agents?: number
    checkedAt: string
  }
}

interface AgentUptimeAgent {
  agentId?: string
  agentName?: string
  instanceId?: string
  uptimePct?: number
  onlineNow?: boolean
}

interface AgentUptimePayload {
  agents?: AgentUptimeAgent[]
}

export interface ReportPreview {
  generatedAt: string
  kind: ReportKind
  format: ReportFormat
  granularity: ReportGranularity
  dateRange: ReportDateRange
  selectedInstances: string[]
  selectedAgents: string[]
  summary: Record<string, string | number>
  sections: Array<{
    id: string
    title: string
    rows: Array<Record<string, string | number | boolean | null>>
  }>
}

export interface ReportFilters {
  instances: Array<{ id: string; label: string }>
  agents: Array<{ id: string; label: string }>
}

const REPORTS_META_FILE = path.join(DATA_DIR, 'reports.json')
const REPORTS_OUTPUT_DIR = path.join(DATA_DIR, 'reports')
const REPORTS_SEED_FILE = path.join(process.cwd(), 'data', 'reports.json')
const REPORTS_SEED_OUTPUT_DIR = path.join(process.cwd(), 'data', 'reports')

const COSTS_FILE = 'costs.json'
const REPLAYS_FILE = 'replays.json'
const INSTANCES_FILE = 'instances.json'
const UPTIME_FILE = 'agent-uptime.json'

function toIsoDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString()
}

function startOfDayIso(date = new Date()) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.toISOString()
}

function endOfDayIso(date = new Date()) {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy.toISOString()
}

function addDays(date: Date, offset: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + offset)
  return copy
}

async function readJsonWithFallback<T>(fileName: string, fallback: T): Promise<T> {
  const runtimePath = path.join(DATA_DIR, fileName)
  const seedPath = path.join(process.cwd(), 'data', fileName)

  for (const filePath of [runtimePath, seedPath]) {
    try {
      const text = await readFile(filePath, 'utf-8')
      return JSON.parse(text) as T
    } catch {
      // try next path
    }
  }

  return fallback
}

async function readReportsStore(): Promise<ReportsStore> {
  const store = await readJsonWithFallback<ReportsStore>(path.basename(REPORTS_META_FILE), { reports: [] })
  return {
    reports: Array.isArray(store?.reports) ? store.reports : [],
  }
}

async function writeReportsStore(store: ReportsStore) {
  await mkdir(path.dirname(REPORTS_META_FILE), { recursive: true })
  await writeFile(REPORTS_META_FILE, JSON.stringify(store, null, 2))
}

async function readCostEntries(): Promise<CostEntry[]> {
  const payload = await readJsonWithFallback<{ entries?: CostEntry[] }>(COSTS_FILE, { entries: [] })
  return Array.isArray(payload.entries) ? payload.entries : []
}

async function readReplaySessions(): Promise<ReplaySession[]> {
  const payload = await readJsonWithFallback<{ sessions?: ReplaySession[] }>(REPLAYS_FILE, { sessions: [] })
  return Array.isArray(payload.sessions) ? payload.sessions : []
}

async function readInstances(): Promise<ManagedInstance[]> {
  const payload = await readJsonWithFallback<{ instances?: ManagedInstance[] }>(INSTANCES_FILE, { instances: [] })
  return Array.isArray(payload.instances) ? payload.instances : []
}

async function readAgentUptime(): Promise<AgentUptimePayload> {
  return readJsonWithFallback<AgentUptimePayload>(UPTIME_FILE, {})
}

function withinDateRange(timestamp: string, range: ReportDateRange) {
  const value = new Date(timestamp).getTime()
  const start = new Date(range.start).getTime()
  const end = new Date(range.end).getTime()
  return value >= start && value <= end
}

function makeReportFileBase(input: ReportBuilderInput) {
  const safeName = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || input.kind

  return `${safeName}-${Date.now()}`
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function groupCostEntries(entries: CostEntry[], granularity: ReportGranularity) {
  const grouped = new Map<string, { label: string; cost: number; inputTokens: number; outputTokens: number }>()

  for (const entry of entries) {
    const date = new Date(entry.timestamp)
    let key = ''
    let label = ''

    if (granularity === 'daily') {
      key = date.toISOString().slice(0, 10)
      label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else if (granularity === 'weekly') {
      const start = addDays(date, -date.getDay())
      start.setHours(0, 0, 0, 0)
      key = start.toISOString().slice(0, 10)
      label = `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    } else {
      key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
      label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    }

    const current = grouped.get(key) || {
      label,
      cost: 0,
      inputTokens: 0,
      outputTokens: 0,
    }

    current.cost += entry.cost
    current.inputTokens += entry.inputTokens
    current.outputTokens += entry.outputTokens
    grouped.set(key, current)
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => ({
      period: value.label,
      cost: Number(value.cost.toFixed(6)),
      inputTokens: value.inputTokens,
      outputTokens: value.outputTokens,
      totalTokens: value.inputTokens + value.outputTokens,
    }))
}

function buildBreakdown(entries: CostEntry[], key: 'agentId' | 'instanceId' | 'model') {
  const grouped = new Map<string, { id: string; cost: number; inputTokens: number; outputTokens: number; runs: number }>()

  for (const entry of entries) {
    const groupId = entry[key]
    const current = grouped.get(groupId) || {
      id: groupId,
      cost: 0,
      inputTokens: 0,
      outputTokens: 0,
      runs: 0,
    }
    current.cost += entry.cost
    current.inputTokens += entry.inputTokens
    current.outputTokens += entry.outputTokens
    current.runs += 1
    grouped.set(groupId, current)
  }

  return Array.from(grouped.values())
    .sort((left, right) => right.cost - left.cost)
    .map((item) => ({
      id: item.id,
      runs: item.runs,
      cost: Number(item.cost.toFixed(6)),
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
      totalTokens: item.inputTokens + item.outputTokens,
    }))
}

function buildCostPreview(input: ReportBuilderInput, entries: CostEntry[]): ReportPreview {
  const filtered = entries.filter((entry) => {
    if (!withinDateRange(entry.timestamp, input.dateRange)) return false
    if (input.instanceIds.length > 0 && !input.instanceIds.includes(entry.instanceId)) return false
    if (input.agentIds.length > 0 && !input.agentIds.includes(entry.agentId)) return false
    return true
  })

  const totalCost = filtered.reduce((sum, entry) => sum + entry.cost, 0)
  const totalInputTokens = filtered.reduce((sum, entry) => sum + entry.inputTokens, 0)
  const totalOutputTokens = filtered.reduce((sum, entry) => sum + entry.outputTokens, 0)

  return {
    generatedAt: new Date().toISOString(),
    kind: input.kind,
    format: input.format,
    granularity: input.granularity,
    dateRange: input.dateRange,
    selectedInstances: input.instanceIds,
    selectedAgents: input.agentIds,
    summary: {
      totalCost: Number(totalCost.toFixed(6)),
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      runs: filtered.length,
      activeAgents: new Set(filtered.map((entry) => entry.agentId)).size,
      activeInstances: new Set(filtered.map((entry) => entry.instanceId)).size,
    },
    sections: [
      {
        id: 'timeline',
        title: 'Cost timeline',
        rows: groupCostEntries(filtered, input.granularity),
      },
      {
        id: 'agents',
        title: 'Per-agent breakdown',
        rows: buildBreakdown(filtered, 'agentId'),
      },
      {
        id: 'instances',
        title: 'Per-instance breakdown',
        rows: buildBreakdown(filtered, 'instanceId'),
      },
      {
        id: 'records',
        title: 'Included sessions',
        rows: filtered
          .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
          .slice(0, 25)
          .map((entry) => ({
            timestamp: entry.timestamp,
            instanceId: entry.instanceId,
            agentId: entry.agentId,
            model: entry.model,
            taskDescription: entry.taskDescription,
            inputTokens: entry.inputTokens,
            outputTokens: entry.outputTokens,
            cost: entry.cost,
          })),
      },
    ],
  }
}

function buildAgentSessionPreview(input: ReportBuilderInput, sessions: ReplaySession[]): ReportPreview {
  const filtered = sessions.filter((session) => {
    const sessionTimestamp = session.completedAt || session.startedAt
    if (!withinDateRange(sessionTimestamp, input.dateRange)) return false
    if (input.instanceIds.length > 0 && !input.instanceIds.includes(session.instanceId)) return false
    if (input.agentIds.length > 0 && !input.agentIds.includes(session.agentId)) return false
    return true
  })

  const totalDurationMs = filtered.reduce((sum, session) => sum + Number(session.durationMs || 0), 0)
  const totalToolCalls = filtered.reduce(
    (sum, session) => sum + session.steps.reduce((stepSum, step) => stepSum + (step.toolCalls?.length || 0), 0),
    0,
  )
  const totalFileChanges = filtered.reduce(
    (sum, session) => sum + session.steps.reduce((stepSum, step) => stepSum + (step.fileChanges?.length || 0), 0),
    0,
  )

  return {
    generatedAt: new Date().toISOString(),
    kind: input.kind,
    format: input.format,
    granularity: input.granularity,
    dateRange: input.dateRange,
    selectedInstances: input.instanceIds,
    selectedAgents: input.agentIds,
    summary: {
      sessions: filtered.length,
      totalDurationMinutes: Number((totalDurationMs / 60000).toFixed(1)),
      toolCalls: totalToolCalls,
      fileChanges: totalFileChanges,
      avgStepsPerSession: filtered.length
        ? Number((filtered.reduce((sum, session) => sum + session.steps.length, 0) / filtered.length).toFixed(1))
        : 0,
    },
    sections: [
      {
        id: 'sessions',
        title: 'Session summaries',
        rows: filtered
          .sort((left, right) => new Date(right.completedAt || right.startedAt).getTime() - new Date(left.completedAt || left.startedAt).getTime())
          .map((session) => ({
            agentId: session.agentId,
            instanceId: session.instanceId,
            model: session.model,
            status: session.status,
            startedAt: session.startedAt,
            completedAt: session.completedAt || '',
            durationMinutes: Number(((session.durationMs || 0) / 60000).toFixed(1)),
            steps: session.steps.length,
            taskDescription: session.taskDescription,
          })),
      },
      {
        id: 'highlights',
        title: 'Decision highlights',
        rows: filtered.flatMap((session) =>
          session.steps.slice(0, 2).map((step) => ({
            agentId: session.agentId,
            title: step.title,
            action: step.action,
            result: step.result,
            toolCalls: step.toolCalls?.length || 0,
            fileChanges: step.fileChanges?.length || 0,
          })),
        ),
      },
    ],
  }
}

function fallbackInstanceHealth(instanceId: string) {
  return {
    instanceId,
    name: instanceId
      .split(/[-_]/g)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' '),
    status: 'unknown',
    model: 'unknown',
    mode: 'unknown',
    agents: 0,
    uptimePct: 0,
    lastSeen: '',
  }
}

function buildInstanceHealthPreview(
  input: ReportBuilderInput,
  instances: ManagedInstance[],
  uptime: AgentUptimePayload,
  costEntries: CostEntry[],
  replaySessions: ReplaySession[],
): ReportPreview {
  const knownIds = new Set<string>()
  const rows: Array<Record<string, string | number | boolean | null>> = []
  const uptimeAgents = Array.isArray(uptime.agents) ? uptime.agents : []

  for (const instance of instances) {
    if (input.instanceIds.length > 0 && !input.instanceIds.includes(instance.id)) continue
    knownIds.add(instance.id)

    const relatedUptime = uptimeAgents.filter((item) => item.instanceId === instance.id)
    const averageUptime = relatedUptime.length
      ? relatedUptime.reduce((sum, item) => sum + Number(item.uptimePct || 0), 0) / relatedUptime.length
      : 0

    rows.push({
      instanceId: instance.id,
      name: instance.name,
      status: instance.status || 'unknown',
      mode: instance.health?.mode || 'unknown',
      model: instance.health?.model || 'unknown',
      agents: Number(instance.health?.agents || relatedUptime.length || 0),
      uptimePct: Number(averageUptime.toFixed(1)),
      lastSeen: instance.lastSeen || instance.health?.checkedAt || '',
      enabled: instance.enabled,
      statusMessage: instance.statusMessage || '',
    })
  }

  const fallbackIds = new Set<string>()
  for (const entry of costEntries) fallbackIds.add(entry.instanceId)
  for (const session of replaySessions) fallbackIds.add(session.instanceId)

  for (const instanceId of fallbackIds) {
    if (knownIds.has(instanceId)) continue
    if (input.instanceIds.length > 0 && !input.instanceIds.includes(instanceId)) continue
    rows.push(fallbackInstanceHealth(instanceId))
  }

  const onlineCount = rows.filter((row) => row.status === 'online').length
  const warningCount = rows.filter((row) => row.status === 'error' || row.status === 'offline').length

  return {
    generatedAt: new Date().toISOString(),
    kind: input.kind,
    format: input.format,
    granularity: input.granularity,
    dateRange: input.dateRange,
    selectedInstances: input.instanceIds,
    selectedAgents: input.agentIds,
    summary: {
      instances: rows.length,
      online: onlineCount,
      attentionNeeded: warningCount,
      avgUptimePct: rows.length
        ? Number(
            (
              rows.reduce((sum, row) => sum + Number(row.uptimePct || 0), 0) /
              rows.length
            ).toFixed(1),
          )
        : 0,
    },
    sections: [
      {
        id: 'health',
        title: 'Instance health',
        rows,
      },
    ],
  }
}

function assertReportInput(input: Partial<ReportBuilderInput>): ReportBuilderInput {
  const now = new Date()
  const defaultRange = {
    start: startOfDayIso(addDays(now, -6)),
    end: endOfDayIso(now),
  }

  const kind = input.kind || 'cost_report'
  const format = input.format || 'pdf'
  const granularity = input.granularity || 'weekly'

  return {
    name: String(input.name || 'Mission Control Report').trim(),
    kind,
    format,
    granularity,
    dateRange: {
      start: toIsoDate(input.dateRange?.start, defaultRange.start),
      end: toIsoDate(input.dateRange?.end, defaultRange.end),
    },
    instanceIds: Array.isArray(input.instanceIds) ? input.instanceIds.map(String).filter(Boolean) : [],
    agentIds: Array.isArray(input.agentIds) ? input.agentIds.map(String).filter(Boolean) : [],
  }
}

export async function getReportFilters(): Promise<ReportFilters> {
  const [instances, costEntries, replaySessions] = await Promise.all([
    readInstances(),
    readCostEntries(),
    readReplaySessions(),
  ])

  const instanceMap = new Map<string, string>()
  const agentMap = new Map<string, string>()

  for (const instance of instances) {
    instanceMap.set(instance.id, instance.name)
  }

  for (const entry of costEntries) {
    if (!instanceMap.has(entry.instanceId)) instanceMap.set(entry.instanceId, entry.instanceId)
    if (!agentMap.has(entry.agentId)) agentMap.set(entry.agentId, entry.agentId)
  }

  for (const session of replaySessions) {
    if (!instanceMap.has(session.instanceId)) instanceMap.set(session.instanceId, session.instanceId)
    if (!agentMap.has(session.agentId)) agentMap.set(session.agentId, session.agentId)
  }

  return {
    instances: Array.from(instanceMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, label]) => ({ id, label })),
    agents: Array.from(agentMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, label]) => ({ id, label })),
  }
}

export async function listSavedReports() {
  const store = await readReportsStore()
  return store.reports.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

export async function buildReportPreview(rawInput: Partial<ReportBuilderInput>): Promise<ReportPreview> {
  const input = assertReportInput(rawInput)
  const [costEntries, replaySessions, instances, uptime] = await Promise.all([
    readCostEntries(),
    readReplaySessions(),
    readInstances(),
    readAgentUptime(),
  ])

  if (input.kind === 'cost_report') {
    return buildCostPreview(input, costEntries)
  }

  if (input.kind === 'agent_session_summary') {
    return buildAgentSessionPreview(input, replaySessions)
  }

  return buildInstanceHealthPreview(input, instances, uptime, costEntries, replaySessions)
}

function toCsv(rows: Array<Record<string, string | number | boolean | null>>) {
  if (rows.length === 0) return 'No data\n'

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>()),
  )

  const csvRows = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header]
          const serialized = value === null || value === undefined ? '' : String(value)
          return `"${serialized.replace(/"/g, '""')}"`
        })
        .join(','),
    ),
  ]

  return csvRows.join('\n')
}

function addPdfText(doc: jsPDF, text: string, x: number, y: number, options: { fontSize?: number; fontStyle?: 'normal' | 'bold' } = {}) {
  doc.setFont('helvetica', options.fontStyle || 'normal')
  doc.setFontSize(options.fontSize || 11)
  const lines = doc.splitTextToSize(text, 515)
  doc.text(lines, x, y)
  return y + lines.length * ((options.fontSize || 11) + 3)
}

function ensurePdfSpace(doc: jsPDF, y: number, needed = 40) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed <= pageHeight - 36) return y
  doc.addPage()
  return 42
}

function buildPdfBuffer(input: ReportBuilderInput, preview: ReportPreview) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = 46

  y = addPdfText(doc, input.name, 40, y, { fontSize: 20, fontStyle: 'bold' })
  y = addPdfText(
    doc,
    `Type: ${input.kind.replace(/_/g, ' ')} | Format: ${input.format.toUpperCase()} | Range: ${new Date(input.dateRange.start).toLocaleDateString()} - ${new Date(input.dateRange.end).toLocaleDateString()}`,
    40,
    y + 6,
    { fontSize: 10 },
  )
  y += 10

  y = ensurePdfSpace(doc, y, 90)
  y = addPdfText(doc, 'Summary', 40, y, { fontSize: 14, fontStyle: 'bold' })
  for (const [key, value] of Object.entries(preview.summary)) {
    const formatted =
      key.toLowerCase().includes('cost') && typeof value === 'number'
        ? formatMoney(value)
        : typeof value === 'number'
          ? formatNumber(value)
          : String(value)
    y = addPdfText(doc, `${key}: ${formatted}`, 52, y + 4, { fontSize: 11 })
  }

  for (const section of preview.sections) {
    y = ensurePdfSpace(doc, y, 60)
    y = addPdfText(doc, section.title, 40, y + 8, { fontSize: 14, fontStyle: 'bold' })
    if (section.rows.length === 0) {
      y = addPdfText(doc, 'No data in this section.', 52, y + 4, { fontSize: 10 })
      continue
    }

    for (const row of section.rows.slice(0, 12)) {
      y = ensurePdfSpace(doc, y, 44)
      const text = Object.entries(row)
        .map(([key, value]) => `${key}: ${value === null || value === undefined ? '' : String(value)}`)
        .join(' | ')
      y = addPdfText(doc, text, 52, y + 4, { fontSize: 10 })
    }
  }

  return Buffer.from(doc.output('arraybuffer'))
}

async function ensureReportsDir() {
  await mkdir(REPORTS_OUTPUT_DIR, { recursive: true })
  await mkdir(REPORTS_SEED_OUTPUT_DIR, { recursive: true })
}

export async function generateReport(rawInput: Partial<ReportBuilderInput>) {
  const input = assertReportInput(rawInput)
  const preview = await buildReportPreview(input)
  const fileBase = makeReportFileBase(input)
  const fileName = `${fileBase}.${input.format}`
  const filePath = path.join(REPORTS_OUTPUT_DIR, fileName)
  let content: string | Buffer = ''

  if (input.format === 'json') {
    content = JSON.stringify({ metadata: input, preview }, null, 2)
  } else if (input.format === 'csv') {
    const csvSections = preview.sections
      .map((section) => `# ${section.title}\n${toCsv(section.rows)}`)
      .join('\n\n')
    content = csvSections
  } else {
    content = buildPdfBuffer(input, preview)
  }

  await ensureReportsDir()
  await writeFile(filePath, content)
  const fileStats = await stat(filePath)

  const metadata: ReportMetadata = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    fileName,
    filePath,
    sizeBytes: fileStats.size,
    previewSummary: preview.summary,
  }

  const store = await readReportsStore()
  store.reports = [metadata, ...store.reports].slice(0, 100)
  await writeReportsStore(store)

  return { metadata, preview }
}

export async function deleteSavedReport(id: string) {
  const store = await readReportsStore()
  const target = store.reports.find((report) => report.id === id)
  if (!target) return false

  store.reports = store.reports.filter((report) => report.id !== id)
  await writeReportsStore(store)

  try {
    await rm(target.filePath, { force: true })
  } catch {
    // ignore cleanup failure
  }

  return true
}

export async function readSavedReportFile(id: string) {
  const store = await readReportsStore()
  const target = store.reports.find((report) => report.id === id)
  if (!target) return null

  const buffer = await readFile(target.filePath)
  const ext = path.extname(target.fileName).toLowerCase()
  const contentType =
    ext === '.pdf'
      ? 'application/pdf'
      : ext === '.csv'
        ? 'text/csv; charset=utf-8'
        : 'application/json; charset=utf-8'

  return {
    fileName: target.fileName,
    buffer,
    contentType,
  }
}

export function getDefaultReportInput(): ReportBuilderInput {
  const now = new Date()
  return {
    name: 'Mission Control Report',
    kind: 'cost_report',
    format: 'pdf',
    granularity: 'weekly',
    dateRange: {
      start: startOfDayIso(addDays(now, -6)),
      end: endOfDayIso(now),
    },
    instanceIds: [],
    agentIds: [],
  }
}

