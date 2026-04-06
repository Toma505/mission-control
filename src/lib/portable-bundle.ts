import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import { normalizeSettings } from '@/lib/app-settings'
import { DATA_DIR } from '@/lib/connection-config'
import { readNotificationStore, type NotificationRecord, writeNotificationStore } from '@/lib/notifications-store'
import { readPromptStore, type PromptTemplate, writePromptStore } from '@/lib/prompt-library-store'
import {
  type ScheduleRun,
  type ScheduledTask,
  readScheduleRuns,
  readSchedules,
  writeScheduleRuns,
  writeSchedules,
} from '@/lib/schedules'
import { readTemplateStore, type AgentTemplate, writeTemplateStore } from '@/lib/agent-templates-store'
import {
  normalizeWorkflow,
  type Workflow,
  type WorkflowExecutionRecord,
} from '@/lib/workflow-engine'
import { isLegacyDemoCostTags, isLegacyInternalWorkflowExecution, isLegacyStarterWorkflow } from '@/lib/legacy-demo-data'

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')
const DEFAULT_SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')
const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json')
const WORKFLOW_HISTORY_FILE = path.join(DATA_DIR, 'workflow-history.json')
const COST_TAGS_FILE = path.join(DATA_DIR, 'cost-tags.json')
const SNAPSHOTS_FILE = path.join(DATA_DIR, 'config-snapshots.json')
const VAULT_FILE = path.join(DATA_DIR, 'key-vault.json')
const PACKAGE_JSON_FILE = path.join(process.cwd(), 'package.json')

export const PORTABLE_CATEGORIES = [
  'settings',
  'prompts',
  'templates',
  'workflows',
  'schedules',
  'costTags',
  'snapshots',
  'keyVault',
  'notifications',
] as const

export type PortableCategory = (typeof PORTABLE_CATEGORIES)[number]
export type PortableConflictResolution = 'keep' | 'overwrite'

export const MAX_PORTABLE_BUNDLE_BYTES = 100 * 1024 * 1024
const MAX_PORTABLE_TOTAL_ITEMS = 5000
const PORTABLE_CATEGORY_ITEM_LIMITS: Record<PortableCategory, number> = {
  settings: 1,
  prompts: 1000,
  templates: 500,
  workflows: 500,
  schedules: 1000,
  costTags: 1000,
  snapshots: 1000,
  keyVault: 1000,
  notifications: 5000,
}

export type PortableSettingsPayload = Record<string, unknown>

export interface CostTag {
  id: string
  name: string
  color: string
  description: string
  createdAt: string
}

export interface TaggedSession {
  sessionKey: string
  tagId: string
  assignedAt: string
  notes?: string
}

export interface CostTagsPayload {
  tags: CostTag[]
  assignments: TaggedSession[]
}

export interface ConfigSnapshot {
  id: string
  name: string
  createdAt: string
  data: {
    budget?: Record<string, unknown>
    mode?: string
    openclawUrl?: string
  }
}

export interface PortableKeyVaultEntry {
  id?: string
  name?: string
  provider?: string
  keyHash?: string
  keyPrefix?: string
  addedAt?: string
  lastUsed?: string
  isActive?: boolean
  notes?: string
  _key?: string
  [key: string]: unknown
}

export interface PortableNotificationsPayload {
  notifications: NotificationRecord[]
}

export interface PortableWorkflowPayload {
  workflows: Workflow[]
  executions: WorkflowExecutionRecord[]
}

export interface PortableSchedulesPayload {
  tasks: ScheduledTask[]
  runs: ScheduleRun[]
}

export interface PortableBundleData {
  settings: PortableSettingsPayload
  prompts: { prompts: PromptTemplate[] }
  templates: { templates: AgentTemplate[] }
  workflows: PortableWorkflowPayload
  schedules: PortableSchedulesPayload
  costTags: CostTagsPayload
  snapshots: { snapshots: ConfigSnapshot[] }
  keyVault: { keys: PortableKeyVaultEntry[] }
  notifications: PortableNotificationsPayload
}

export interface PortableBundleManifest {
  format: 'mission-control-bundle'
  schemaVersion: 1
  appVersion: string
  exportedAt: string
  itemCounts: Record<PortableCategory, number>
}

export interface PortableBundle {
  manifest: PortableBundleManifest
  data: PortableBundleData
}

export interface PortableConflict {
  id: string
  category: PortableCategory
  label: string
  changedFields: string[]
  existing: unknown
  imported: unknown
}

export interface PortableCategoryPreview {
  category: PortableCategory
  importCount: number
  existingCount: number
  conflictCount: number
}

export interface PortableImportPreview {
  manifest: PortableBundleManifest
  categories: PortableCategoryPreview[]
  conflicts: PortableConflict[]
}

export interface PortableImportResult {
  manifest: PortableBundleManifest
  appliedCategories: PortableCategory[]
  importedCounts: Partial<Record<PortableCategory, number>>
  overwrittenCounts: Partial<Record<PortableCategory, number>>
  skippedCounts: Partial<Record<PortableCategory, number>>
}

interface WorkflowStore {
  workflows: Workflow[]
}

interface WorkflowHistoryStore {
  executions: WorkflowExecutionRecord[]
}

function stableJson(value: unknown) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function valuesEqual(left: unknown, right: unknown) {
  return stableJson(left) === stableJson(right)
}

function sanitizePlainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function limitFields(fields: string[]) {
  return fields.slice(0, 8)
}

function diffFields(left: unknown, right: unknown, prefix = ''): string[] {
  if (valuesEqual(left, right)) return []

  if (
    !left ||
    !right ||
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    Array.isArray(left) ||
    Array.isArray(right)
  ) {
    return [prefix || 'value']
  }

  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const keys = [...new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)])]
  const changes: string[] = []

  for (const key of keys) {
    changes.push(...diffFields(leftRecord[key], rightRecord[key], prefix ? `${prefix}.${key}` : key))
    if (changes.length >= 8) break
  }

  return changes
}

function normalizeIdentifierPart(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function findMatchIndex<T>(items: T[], candidate: T, keysForItem: (item: T) => string[]) {
  const candidateKeys = keysForItem(candidate).filter(Boolean)
  if (candidateKeys.length === 0) return -1

  return items.findIndex((item) => {
    const itemKeys = new Set(keysForItem(item).filter(Boolean))
    return candidateKeys.some((key) => itemKeys.has(key))
  })
}

function buildConflictId(category: PortableCategory, itemId: string) {
  return `${category}:${itemId}`
}

function ensurePortableCategorySelection(categories?: PortableCategory[]) {
  if (!Array.isArray(categories) || categories.length === 0) {
    return [...PORTABLE_CATEGORIES]
  }

  return PORTABLE_CATEGORIES.filter((category) => categories.includes(category))
}

async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filename, 'utf-8')) as T
  } catch {
    return fallback
  }
}

async function writeJsonFile(filename: string, payload: unknown) {
  await mkdir(path.dirname(filename), { recursive: true })
  await writeFile(filename, JSON.stringify(payload, null, 2))
}

async function readSettingsPayload(): Promise<PortableSettingsPayload> {
  try {
      return normalizeSettings(JSON.parse(await readFile(SETTINGS_FILE, 'utf-8'))) as unknown as PortableSettingsPayload
  } catch {
    try {
      return normalizeSettings(JSON.parse(await readFile(DEFAULT_SETTINGS_FILE, 'utf-8'))) as unknown as PortableSettingsPayload
    } catch {
      return normalizeSettings({}) as unknown as PortableSettingsPayload
    }
  }
}

async function writeSettingsPayload(settings: PortableSettingsPayload) {
  await writeJsonFile(SETTINGS_FILE, normalizeSettings(settings))
}

async function readWorkflowPayload(): Promise<PortableWorkflowPayload> {
  const workflowStore = await readJsonFile<{ workflows?: unknown[] }>(WORKFLOWS_FILE, {})
  const historyStore = await readJsonFile<{ executions?: WorkflowExecutionRecord[] }>(WORKFLOW_HISTORY_FILE, {})
  const workflows = Array.isArray(workflowStore.workflows)
    ? workflowStore.workflows.map((workflow) => normalizeWorkflow(workflow)).filter((workflow) => !isLegacyStarterWorkflow(workflow))
    : []
  const executions = Array.isArray(historyStore.executions)
    ? historyStore.executions.filter((execution) => !isLegacyInternalWorkflowExecution(execution))
    : []

  return {
    workflows,
    executions,
  }
}

async function writeWorkflowPayload(payload: PortableWorkflowPayload) {
  await writeJsonFile(WORKFLOWS_FILE, {
    workflows: payload.workflows.map((workflow) => normalizeWorkflow(workflow)),
  })
  await writeJsonFile(WORKFLOW_HISTORY_FILE, {
    executions: payload.executions.slice(-200),
  })
}

async function readCostTagsPayload(): Promise<CostTagsPayload> {
  const parsed = await readJsonFile<Partial<CostTagsPayload>>(COST_TAGS_FILE, {})
  const tags = Array.isArray(parsed.tags) ? parsed.tags : []
  const assignments = Array.isArray(parsed.assignments) ? parsed.assignments : []
  return {
    tags: isLegacyDemoCostTags(tags) ? [] : tags,
    assignments: isLegacyDemoCostTags(tags) ? [] : assignments,
  }
}

async function writeCostTagsPayload(payload: CostTagsPayload) {
  await writeJsonFile(COST_TAGS_FILE, payload)
}

async function readSnapshotsPayload(): Promise<{ snapshots: ConfigSnapshot[] }> {
  const snapshots = await readJsonFile<ConfigSnapshot[]>(SNAPSHOTS_FILE, [])
  return { snapshots: Array.isArray(snapshots) ? snapshots : [] }
}

async function writeSnapshotsPayload(payload: { snapshots: ConfigSnapshot[] }) {
  await writeJsonFile(SNAPSHOTS_FILE, payload.snapshots)
}

async function readRawKeyVaultPayload(): Promise<{ keys: PortableKeyVaultEntry[] }> {
  const keys = await readJsonFile<PortableKeyVaultEntry[]>(VAULT_FILE, [])
  return { keys: Array.isArray(keys) ? keys : [] }
}

async function writeRawKeyVaultPayload(payload: { keys: PortableKeyVaultEntry[] }) {
  await writeJsonFile(VAULT_FILE, payload.keys)
}

async function readNotificationsPayload(): Promise<PortableNotificationsPayload> {
  const store = await readNotificationStore()
  return { notifications: store.notifications }
}

async function writeNotificationsPayload(payload: PortableNotificationsPayload) {
  await writeNotificationStore({ notifications: payload.notifications })
}

async function getAppVersion() {
  const pkg = await readJsonFile<{ version?: string }>(PACKAGE_JSON_FILE, {})
  return pkg.version || '0.0.0'
}

function buildManifest(data: PortableBundleData, appVersion: string): PortableBundleManifest {
  return {
    format: 'mission-control-bundle',
    schemaVersion: 1,
    appVersion,
    exportedAt: new Date().toISOString(),
    itemCounts: {
      settings: Object.keys(data.settings).length > 0 ? 1 : 0,
      prompts: data.prompts.prompts.length,
      templates: data.templates.templates.length,
      workflows: data.workflows.workflows.length,
      schedules: data.schedules.tasks.length,
      costTags: data.costTags.tags.length,
      snapshots: data.snapshots.snapshots.length,
      keyVault: data.keyVault.keys.length,
      notifications: data.notifications.notifications.length,
    },
  }
}

function countPortableItems(data: PortableBundleData): Record<PortableCategory, number> {
  return {
    settings: Object.keys(data.settings).length > 0 ? 1 : 0,
    prompts: data.prompts.prompts.length,
    templates: data.templates.templates.length,
    workflows: data.workflows.workflows.length,
    schedules: data.schedules.tasks.length,
    costTags: data.costTags.tags.length,
    snapshots: data.snapshots.snapshots.length,
    keyVault: data.keyVault.keys.length,
    notifications: data.notifications.notifications.length,
  }
}

function assertPortableBundleItemLimits(data: PortableBundleData) {
  const counts = countPortableItems(data)
  const totalItems = Object.values(counts).reduce((sum, count) => sum + count, 0)
  if (totalItems > MAX_PORTABLE_TOTAL_ITEMS) {
    throw new Error(`Portable bundles may include at most ${MAX_PORTABLE_TOTAL_ITEMS} total items.`)
  }

  for (const category of PORTABLE_CATEGORIES) {
    if (counts[category] > PORTABLE_CATEGORY_ITEM_LIMITS[category]) {
      throw new Error(
        `Portable bundle category "${category}" exceeds the ${PORTABLE_CATEGORY_ITEM_LIMITS[category]} item limit.`,
      )
    }
  }
}

function normalizeBundleData(input: unknown): PortableBundleData {
  const data = sanitizePlainObject(input)

  const prompts = sanitizePlainObject(data.prompts)
  const templates = sanitizePlainObject(data.templates)
  const workflows = sanitizePlainObject(data.workflows)
  const schedules = sanitizePlainObject(data.schedules)
  const costTags = sanitizePlainObject(data.costTags)
  const snapshots = sanitizePlainObject(data.snapshots)
  const keyVault = sanitizePlainObject(data.keyVault)
  const notifications = sanitizePlainObject(data.notifications)

  return {
    settings: normalizeSettings(data.settings) as unknown as PortableSettingsPayload,
    prompts: {
      prompts: Array.isArray(prompts.prompts) ? (prompts.prompts as PromptTemplate[]) : [],
    },
    templates: {
      templates: Array.isArray(templates.templates) ? (templates.templates as AgentTemplate[]) : [],
    },
    workflows: {
      workflows: Array.isArray(workflows.workflows)
        ? workflows.workflows.map((workflow) => normalizeWorkflow(workflow))
        : [],
      executions: Array.isArray(workflows.executions) ? (workflows.executions as WorkflowExecutionRecord[]) : [],
    },
    schedules: {
      tasks: Array.isArray(schedules.tasks) ? (schedules.tasks as ScheduledTask[]) : [],
      runs: Array.isArray(schedules.runs) ? (schedules.runs as ScheduleRun[]) : [],
    },
    costTags: {
      tags: Array.isArray(costTags.tags) ? (costTags.tags as CostTag[]) : [],
      assignments: Array.isArray(costTags.assignments) ? (costTags.assignments as TaggedSession[]) : [],
    },
    snapshots: {
      snapshots: Array.isArray(snapshots.snapshots) ? (snapshots.snapshots as ConfigSnapshot[]) : [],
    },
    keyVault: {
      keys: Array.isArray(keyVault.keys) ? (keyVault.keys as PortableKeyVaultEntry[]) : [],
    },
    notifications: {
      notifications: Array.isArray(notifications.notifications)
        ? (notifications.notifications as NotificationRecord[])
        : [],
    },
  }
}

export function normalizePortableBundle(input: unknown): PortableBundle {
  const source = sanitizePlainObject(input)
  const data = normalizeBundleData(source.data)
  assertPortableBundleItemLimits(data)
  const manifestInput = sanitizePlainObject(source.manifest)

  return {
    manifest: {
      format: 'mission-control-bundle',
      schemaVersion: 1,
      appVersion: typeof manifestInput.appVersion === 'string' ? manifestInput.appVersion : '0.0.0',
      exportedAt:
        typeof manifestInput.exportedAt === 'string' && manifestInput.exportedAt
          ? manifestInput.exportedAt
          : new Date().toISOString(),
      itemCounts: buildManifest(data, typeof manifestInput.appVersion === 'string' ? manifestInput.appVersion : '0.0.0')
        .itemCounts,
    },
    data,
  }
}

export async function buildPortableBundle(): Promise<PortableBundle> {
  const [settings, prompts, templates, workflows, schedulesStore, runsStore, costTags, snapshots, keyVault, notifications, appVersion] =
    await Promise.all([
      readSettingsPayload(),
      readPromptStore(),
      readTemplateStore(),
      readWorkflowPayload(),
      readSchedules(),
      readScheduleRuns(),
      readCostTagsPayload(),
      readSnapshotsPayload(),
      readRawKeyVaultPayload(),
      readNotificationsPayload(),
      getAppVersion(),
    ])

  const data: PortableBundleData = {
    settings,
    prompts,
    templates,
    workflows,
    schedules: {
      tasks: schedulesStore.tasks,
      runs: runsStore.runs,
    },
    costTags,
    snapshots,
    keyVault,
    notifications,
  }

  return {
    manifest: buildManifest(data, appVersion),
    data,
  }
}

type MergeStrategy<T> = {
  category: PortableCategory
  existing: T[]
  imported: T[]
  keysForItem: (item: T) => string[]
  labelForItem: (item: T) => string
}

function buildConflictsForList<T>(strategy: MergeStrategy<T>): PortableConflict[] {
  const conflicts: PortableConflict[] = []

  for (const item of strategy.imported) {
    const existingIndex = findMatchIndex(strategy.existing, item, strategy.keysForItem)
    if (existingIndex === -1) continue

    const existing = strategy.existing[existingIndex]
    if (valuesEqual(existing, item)) continue

    const itemId = strategy.keysForItem(item)[0] || strategy.labelForItem(item)
    conflicts.push({
      id: buildConflictId(strategy.category, itemId),
      category: strategy.category,
      label: strategy.labelForItem(item),
      changedFields: limitFields(diffFields(existing, item)),
      existing,
      imported: item,
    })
  }

  return conflicts
}

function applyListImport<T>(
  strategy: MergeStrategy<T>,
  resolutions: Record<string, PortableConflictResolution>,
) {
  const next = [...strategy.existing]
  let importedCount = 0
  let overwrittenCount = 0
  let skippedCount = 0

  for (const item of strategy.imported) {
    const existingIndex = findMatchIndex(next, item, strategy.keysForItem)
    if (existingIndex === -1) {
      next.push(item)
      importedCount += 1
      continue
    }

    const itemId = strategy.keysForItem(item)[0] || strategy.labelForItem(item)
    const resolution = resolutions[buildConflictId(strategy.category, itemId)] || 'keep'
    if (resolution === 'overwrite') {
      next[existingIndex] = item
      overwrittenCount += 1
    } else {
      skippedCount += 1
    }
  }

  return { next, importedCount, overwrittenCount, skippedCount }
}

function keysByIdAndName(item: { id?: string; name?: string }) {
  return [
    item.id ? `id:${normalizeIdentifierPart(item.id)}` : '',
    item.name ? `name:${normalizeIdentifierPart(item.name)}` : '',
  ].filter(Boolean)
}

function keysByIdAndHash(item: { id?: string; keyHash?: string; name?: string; provider?: string }) {
  return [
    item.keyHash ? `hash:${normalizeIdentifierPart(item.keyHash)}` : '',
    item.id ? `id:${normalizeIdentifierPart(item.id)}` : '',
    item.name && item.provider
      ? `name:${normalizeIdentifierPart(item.provider)}:${normalizeIdentifierPart(item.name)}`
      : '',
  ].filter(Boolean)
}

function sortByUpdatedAt<T extends { updatedAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || 0).getTime()
    const rightTime = new Date(right.updatedAt || 0).getTime()
    return rightTime - leftTime
  })
}

function uniqueById<T extends { id?: string }>(items: T[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const id = item.id || stableJson(item)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function mergeAssignments(existing: TaggedSession[], imported: TaggedSession[]) {
  const seen = new Set(existing.map((assignment) => `${assignment.sessionKey}:${assignment.tagId}`))
  const merged = [...existing]

  for (const assignment of imported) {
    const key = `${assignment.sessionKey}:${assignment.tagId}`
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(assignment)
  }

  return merged
}

async function readCurrentPortableData(): Promise<PortableBundleData> {
  const [settings, prompts, templates, workflows, schedulesStore, runsStore, costTags, snapshots, keyVault, notifications] =
    await Promise.all([
      readSettingsPayload(),
      readPromptStore(),
      readTemplateStore(),
      readWorkflowPayload(),
      readSchedules(),
      readScheduleRuns(),
      readCostTagsPayload(),
      readSnapshotsPayload(),
      readRawKeyVaultPayload(),
      readNotificationsPayload(),
    ])

  return {
    settings,
    prompts,
    templates,
    workflows,
    schedules: {
      tasks: schedulesStore.tasks,
      runs: runsStore.runs,
    },
    costTags,
    snapshots,
    keyVault,
    notifications,
  }
}

export async function previewPortableImport(
  input: unknown,
  categories?: PortableCategory[],
): Promise<PortableImportPreview> {
  const bundle = normalizePortableBundle(input)
  const selectedCategories = ensurePortableCategorySelection(categories)
  const current = await readCurrentPortableData()
  const conflicts: PortableConflict[] = []
  const categoryPreview: PortableCategoryPreview[] = []

  for (const category of selectedCategories) {
    if (category === 'settings') {
      const hasImportedSettings = Object.keys(bundle.data.settings).length > 0
      const hasExistingSettings = Object.keys(current.settings).length > 0
      const settingConflicts =
        hasImportedSettings && hasExistingSettings && !valuesEqual(current.settings, bundle.data.settings)
          ? [
              {
                id: buildConflictId('settings', 'settings'),
                category: 'settings' as const,
                label: 'Settings',
                changedFields: limitFields(diffFields(current.settings, bundle.data.settings)),
                existing: current.settings,
                imported: bundle.data.settings,
              },
            ]
          : []
      conflicts.push(...settingConflicts)
      categoryPreview.push({
        category,
        importCount: hasImportedSettings ? 1 : 0,
        existingCount: hasExistingSettings ? 1 : 0,
        conflictCount: settingConflicts.length,
      })
      continue
    }

    if (category === 'prompts') {
      const items = buildConflictsForList<PromptTemplate>({
        category,
        existing: current.prompts.prompts,
        imported: bundle.data.prompts.prompts,
        keysForItem: keysByIdAndName,
        labelForItem: (item) => item.name,
      })
      conflicts.push(...items)
      categoryPreview.push({
        category,
        importCount: bundle.data.prompts.prompts.length,
        existingCount: current.prompts.prompts.length,
        conflictCount: items.length,
      })
      continue
    }

    if (category === 'templates') {
      const items = buildConflictsForList<AgentTemplate>({
        category,
        existing: current.templates.templates,
        imported: bundle.data.templates.templates,
        keysForItem: keysByIdAndName,
        labelForItem: (item) => item.name,
      })
      conflicts.push(...items)
      categoryPreview.push({
        category,
        importCount: bundle.data.templates.templates.length,
        existingCount: current.templates.templates.length,
        conflictCount: items.length,
      })
      continue
    }

    if (category === 'workflows') {
      const items = buildConflictsForList<Workflow>({
        category,
        existing: current.workflows.workflows,
        imported: bundle.data.workflows.workflows,
        keysForItem: keysByIdAndName,
        labelForItem: (item) => item.name,
      })
      conflicts.push(...items)
      categoryPreview.push({
        category,
        importCount: bundle.data.workflows.workflows.length,
        existingCount: current.workflows.workflows.length,
        conflictCount: items.length,
      })
      continue
    }

    if (category === 'schedules') {
      const items = buildConflictsForList<ScheduledTask>({
        category,
        existing: current.schedules.tasks,
        imported: bundle.data.schedules.tasks,
        keysForItem: keysByIdAndName,
        labelForItem: (item) => item.name,
      })
      conflicts.push(...items)
      categoryPreview.push({
        category,
        importCount: bundle.data.schedules.tasks.length,
        existingCount: current.schedules.tasks.length,
        conflictCount: items.length,
      })
      continue
    }

    if (category === 'costTags') {
      const items = buildConflictsForList<CostTag>({
        category,
        existing: current.costTags.tags,
        imported: bundle.data.costTags.tags,
        keysForItem: keysByIdAndName,
        labelForItem: (item) => item.name,
      })
      conflicts.push(...items)
      categoryPreview.push({
        category,
        importCount: bundle.data.costTags.tags.length,
        existingCount: current.costTags.tags.length,
        conflictCount: items.length,
      })
      continue
    }

    if (category === 'snapshots') {
      const items = buildConflictsForList<ConfigSnapshot>({
        category,
        existing: current.snapshots.snapshots,
        imported: bundle.data.snapshots.snapshots,
        keysForItem: keysByIdAndName,
        labelForItem: (item) => item.name,
      })
      conflicts.push(...items)
      categoryPreview.push({
        category,
        importCount: bundle.data.snapshots.snapshots.length,
        existingCount: current.snapshots.snapshots.length,
        conflictCount: items.length,
      })
      continue
    }

    if (category === 'keyVault') {
      const items = buildConflictsForList<PortableKeyVaultEntry>({
        category,
        existing: current.keyVault.keys,
        imported: bundle.data.keyVault.keys,
        keysForItem: keysByIdAndHash,
        labelForItem: (item) => String(item.name || item.id || item.keyHash || 'Vault Key'),
      })
      conflicts.push(...items)
      categoryPreview.push({
        category,
        importCount: bundle.data.keyVault.keys.length,
        existingCount: current.keyVault.keys.length,
        conflictCount: items.length,
      })
      continue
    }

    const items = buildConflictsForList<NotificationRecord>({
      category,
      existing: current.notifications.notifications,
      imported: bundle.data.notifications.notifications,
      keysForItem: (item) => [item.id ? `id:${normalizeIdentifierPart(item.id)}` : ''].filter(Boolean),
      labelForItem: (item) => item.title,
    })
    conflicts.push(...items)
    categoryPreview.push({
      category,
      importCount: bundle.data.notifications.notifications.length,
      existingCount: current.notifications.notifications.length,
      conflictCount: items.length,
    })
  }

  return {
    manifest: bundle.manifest,
    categories: categoryPreview,
    conflicts,
  }
}

export async function applyPortableImport(
  input: unknown,
  categories?: PortableCategory[],
  resolutions: Record<string, PortableConflictResolution> = {},
): Promise<PortableImportResult> {
  const bundle = normalizePortableBundle(input)
  const selectedCategories = ensurePortableCategorySelection(categories)
  const current = await readCurrentPortableData()
  const importedCounts: Partial<Record<PortableCategory, number>> = {}
  const overwrittenCounts: Partial<Record<PortableCategory, number>> = {}
  const skippedCounts: Partial<Record<PortableCategory, number>> = {}

  if (selectedCategories.includes('settings')) {
    const hasImportedSettings = Object.keys(bundle.data.settings).length > 0
    const conflictId = buildConflictId('settings', 'settings')
    const isConflict = hasImportedSettings && Object.keys(current.settings).length > 0 && !valuesEqual(current.settings, bundle.data.settings)
    if (hasImportedSettings && (!isConflict || resolutions[conflictId] === 'overwrite')) {
      await writeSettingsPayload(bundle.data.settings)
      importedCounts.settings = 1
      if (isConflict) overwrittenCounts.settings = 1
    } else if (isConflict) {
      skippedCounts.settings = 1
    }
  }

  if (selectedCategories.includes('prompts')) {
    const merged = applyListImport<PromptTemplate>(
      {
        category: 'prompts',
        existing: current.prompts.prompts,
        imported: bundle.data.prompts.prompts,
        keysForItem: keysByIdAndName,
        labelForItem: (item) => item.name,
      },
      resolutions,
    )
    await writePromptStore({ prompts: sortByUpdatedAt(merged.next) })
    importedCounts.prompts = merged.importedCount
    overwrittenCounts.prompts = merged.overwrittenCount
    skippedCounts.prompts = merged.skippedCount
  }

  if (selectedCategories.includes('templates')) {
    const merged = applyListImport<AgentTemplate>(
      {
        category: 'templates',
        existing: current.templates.templates,
        imported: bundle.data.templates.templates,
        keysForItem: keysByIdAndName,
        labelForItem: (item) => item.name,
      },
      resolutions,
    )
    await writeTemplateStore({ templates: sortByUpdatedAt(merged.next) })
    importedCounts.templates = merged.importedCount
    overwrittenCounts.templates = merged.overwrittenCount
    skippedCounts.templates = merged.skippedCount
  }

  if (selectedCategories.includes('workflows')) {
    const merged = applyListImport<Workflow>(
      {
        category: 'workflows',
        existing: current.workflows.workflows,
        imported: bundle.data.workflows.workflows,
        keysForItem: keysByIdAndName,
        labelForItem: (item) => item.name,
      },
      resolutions,
    )
    await writeWorkflowPayload({
      workflows: merged.next.map((workflow) => normalizeWorkflow(workflow)),
      executions: uniqueById([
        ...current.workflows.executions,
        ...bundle.data.workflows.executions,
      ]).slice(-200),
    })
    importedCounts.workflows = merged.importedCount
    overwrittenCounts.workflows = merged.overwrittenCount
    skippedCounts.workflows = merged.skippedCount
  }

  if (selectedCategories.includes('schedules')) {
    const merged = applyListImport<ScheduledTask>(
      {
        category: 'schedules',
        existing: current.schedules.tasks,
        imported: bundle.data.schedules.tasks,
        keysForItem: keysByIdAndName,
        labelForItem: (item) => item.name,
      },
      resolutions,
    )
    await writeSchedules({ version: 1, tasks: merged.next })
    await writeScheduleRuns({
      version: 1,
      runs: uniqueById([...current.schedules.runs, ...bundle.data.schedules.runs]).slice(-500),
    })
    importedCounts.schedules = merged.importedCount
    overwrittenCounts.schedules = merged.overwrittenCount
    skippedCounts.schedules = merged.skippedCount
  }

  if (selectedCategories.includes('costTags')) {
    const merged = applyListImport<CostTag>(
      {
        category: 'costTags',
        existing: current.costTags.tags,
        imported: bundle.data.costTags.tags,
        keysForItem: keysByIdAndName,
        labelForItem: (item) => item.name,
      },
      resolutions,
    )
    await writeCostTagsPayload({
      tags: merged.next,
      assignments: mergeAssignments(current.costTags.assignments, bundle.data.costTags.assignments),
    })
    importedCounts.costTags = merged.importedCount
    overwrittenCounts.costTags = merged.overwrittenCount
    skippedCounts.costTags = merged.skippedCount
  }

  if (selectedCategories.includes('snapshots')) {
    const merged = applyListImport<ConfigSnapshot>(
      {
        category: 'snapshots',
        existing: current.snapshots.snapshots,
        imported: bundle.data.snapshots.snapshots,
        keysForItem: keysByIdAndName,
        labelForItem: (item) => item.name,
      },
      resolutions,
    )
    await writeSnapshotsPayload({ snapshots: merged.next })
    importedCounts.snapshots = merged.importedCount
    overwrittenCounts.snapshots = merged.overwrittenCount
    skippedCounts.snapshots = merged.skippedCount
  }

  if (selectedCategories.includes('keyVault')) {
    const merged = applyListImport<PortableKeyVaultEntry>(
      {
        category: 'keyVault',
        existing: current.keyVault.keys,
        imported: bundle.data.keyVault.keys,
        keysForItem: keysByIdAndHash,
        labelForItem: (item) => String(item.name || item.id || item.keyHash || 'Vault Key'),
      },
      resolutions,
    )
    await writeRawKeyVaultPayload({ keys: merged.next })
    importedCounts.keyVault = merged.importedCount
    overwrittenCounts.keyVault = merged.overwrittenCount
    skippedCounts.keyVault = merged.skippedCount
  }

  if (selectedCategories.includes('notifications')) {
    const merged = applyListImport<NotificationRecord>(
      {
        category: 'notifications',
        existing: current.notifications.notifications,
        imported: bundle.data.notifications.notifications,
        keysForItem: (item) => [item.id ? `id:${normalizeIdentifierPart(item.id)}` : ''].filter(Boolean),
        labelForItem: (item) => item.title,
      },
      resolutions,
    )
    await writeNotificationsPayload({ notifications: uniqueById(merged.next).slice(-400) })
    importedCounts.notifications = merged.importedCount
    overwrittenCounts.notifications = merged.overwrittenCount
    skippedCounts.notifications = merged.skippedCount
  }

  return {
    manifest: bundle.manifest,
    appliedCategories: selectedCategories,
    importedCounts,
    overwrittenCounts,
    skippedCounts,
  }
}
