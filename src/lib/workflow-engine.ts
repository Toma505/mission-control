import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import { DATA_DIR, getEffectiveConfig } from '@/lib/connection-config'
import { runCommand } from '@/lib/openclaw'

export type WorkflowNodeType = 'trigger' | 'agent' | 'condition' | 'action' | 'transform' | 'output'

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  label: string
  position: { x: number; y: number }
  config: Record<string, unknown>
  inputs: string[]
  outputs: string[]
}

export interface WorkflowEdge {
  id: string
  source: string
  sourcePort: string
  target: string
  targetPort: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  createdAt: string
  updatedAt: string
  enabled: boolean
}

export interface WorkflowNodeExecutionResult {
  nodeId: string
  nodeLabel: string
  nodeType: WorkflowNodeType
  status: 'success' | 'failed' | 'skipped'
  startedAt: string
  finishedAt: string
  durationMs: number
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  error?: string
}

export interface WorkflowExecutionRecord {
  id: string
  workflowId: string
  workflowName: string
  status: 'success' | 'failed' | 'partial'
  triggerType: string
  triggerData: Record<string, unknown>
  startedAt: string
  finishedAt: string
  durationMs: number
  nodeResults: Record<string, WorkflowNodeExecutionResult>
}

interface ExecutionContext {
  workflow: Workflow
  triggerData: Record<string, unknown>
  nodeInputs: Map<string, Record<string, unknown>>
  nodeResults: Record<string, WorkflowNodeExecutionResult>
}

type WorkflowOutputMap = Record<string, unknown>
type WorkflowConditionOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'not_contains' | 'exists' | 'not_exists'

const BUDGET_FILE = path.join(DATA_DIR, 'budget.json')
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json')

const MODE_MODELS: Record<string, { primary: string; fallbacks: string[] }> = {
  best: {
    primary: 'anthropic/claude-opus-4-6',
    fallbacks: ['openrouter/google/gemini-3.1-pro'],
  },
  standard: {
    primary: 'anthropic/claude-sonnet-4-6',
    fallbacks: ['openrouter/google/gemini-3.1-pro'],
  },
  budget: {
    primary: 'openrouter/deepseek/deepseek-chat-v3-0324',
    fallbacks: ['openrouter/openai/gpt-4.1-nano', 'openrouter/google/gemini-2.5-flash'],
  },
  auto: {
    primary: 'anthropic/claude-sonnet-4-6',
    fallbacks: ['openrouter/google/gemini-3.1-pro', 'openrouter/deepseek/deepseek-chat-v3-0324'],
  },
}

const DEFAULT_BUDGET = {
  dailyLimit: 5,
  monthlyLimit: 50,
  autoThrottle: true,
  throttleMode: 'budget',
  alertThresholds: [50, 80, 95],
  updatedAt: new Date().toISOString(),
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizePortList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (typeof entry === 'string') return entry
      if (isRecord(entry) && typeof entry.id === 'string') return entry.id
      return ''
    })
    .filter(Boolean)
}

function normalizeNode(node: unknown): WorkflowNode {
  const source = isRecord(node) ? node : {}
  const positionSource = isRecord(source.position) ? source.position : {}

  return {
    id: typeof source.id === 'string' && source.id ? source.id : createId('workflow-node'),
    type: isWorkflowNodeType(source.type) ? source.type : 'action',
    label: typeof source.label === 'string' && source.label ? source.label : 'Untitled Node',
    position: {
      x: typeof positionSource.x === 'number' ? positionSource.x : 0,
      y: typeof positionSource.y === 'number' ? positionSource.y : 0,
    },
    config: isRecord(source.config) ? source.config : {},
    inputs: normalizePortList(source.inputs),
    outputs: normalizePortList(source.outputs),
  }
}

function normalizeEdge(edge: unknown): WorkflowEdge {
  const source = isRecord(edge) ? edge : {}

  return {
    id: typeof source.id === 'string' && source.id ? source.id : createId('workflow-edge'),
    source: typeof source.source === 'string' ? source.source : '',
    sourcePort: typeof source.sourcePort === 'string' ? source.sourcePort : 'out',
    target: typeof source.target === 'string' ? source.target : '',
    targetPort: typeof source.targetPort === 'string' ? source.targetPort : 'in',
  }
}

function isWorkflowNodeType(value: unknown): value is WorkflowNodeType {
  return value === 'trigger'
    || value === 'agent'
    || value === 'condition'
    || value === 'action'
    || value === 'transform'
    || value === 'output'
}

function stableStringify(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function coerceComparable(value: unknown): string | number | boolean {
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value
  return stableStringify(value)
}

function getValueAtPath(source: unknown, pathValue: unknown): unknown {
  if (!pathValue || typeof pathValue !== 'string') return source
  const normalized = pathValue.trim()
  if (!normalized) return source

  const pathParts = normalized
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)

  let current: unknown = source
  for (const part of pathParts) {
    if (Array.isArray(current)) {
      const index = Number(part)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) return undefined
      current = current[index]
      continue
    }
    if (!isRecord(current) || !(part in current)) return undefined
    current = current[part]
  }

  return current
}

function resolveTemplateScope(context: ExecutionContext, node: WorkflowNode, nodeInputs: Record<string, unknown>) {
  const primaryPort = node.inputs.includes('in') ? 'in' : node.inputs[0]
  const primaryInput = primaryPort ? nodeInputs[primaryPort] : Object.values(nodeInputs)[0]

  const previousOutputs = Object.fromEntries(
    Object.entries(context.nodeResults).map(([nodeId, result]) => [nodeId, result.outputs])
  )

  return {
    trigger: context.triggerData,
    input: primaryInput,
    inputs: nodeInputs,
    config: node.config,
    workflow: {
      id: context.workflow.id,
      name: context.workflow.name,
    },
    nodes: previousOutputs,
    now: new Date().toISOString(),
  }
}

function renderTemplate(template: unknown, scope: Record<string, unknown>) {
  if (typeof template !== 'string' || !template) return ''
  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, pathValue: string) => {
    const resolved = getValueAtPath(scope, pathValue)
    if (resolved == null) return ''
    if (typeof resolved === 'string') return resolved
    return stableStringify(resolved)
  })
}

function matchesCondition(actual: unknown, operatorValue: unknown, expected: unknown) {
  const operator = (typeof operatorValue === 'string' ? operatorValue : 'eq') as WorkflowConditionOperator

  if (operator === 'exists') return actual !== undefined && actual !== null && actual !== ''
  if (operator === 'not_exists') return actual === undefined || actual === null || actual === ''

  if (operator === 'contains' || operator === 'not_contains') {
    const haystack = Array.isArray(actual) ? actual.map(stableStringify).join(' ') : stableStringify(actual)
    const needle = stableStringify(expected)
    const contains = haystack.toLowerCase().includes(needle.toLowerCase())
    return operator === 'contains' ? contains : !contains
  }

  const left = coerceComparable(actual)
  const right = coerceComparable(expected)

  if (typeof left === 'number' && typeof right === 'number') {
    switch (operator) {
      case 'gt':
        return left > right
      case 'gte':
        return left >= right
      case 'lt':
        return left < right
      case 'lte':
        return left <= right
      case 'ne':
        return left !== right
      case 'eq':
      default:
        return left === right
    }
  }

  switch (operator) {
    case 'gt':
      return String(left) > String(right)
    case 'gte':
      return String(left) >= String(right)
    case 'lt':
      return String(left) < String(right)
    case 'lte':
      return String(left) <= String(right)
    case 'ne':
      return String(left) !== String(right)
    case 'eq':
    default:
      return String(left) === String(right)
  }
}

function mergeInputValue(current: unknown, incoming: unknown): unknown {
  if (current === undefined) return incoming
  if (Array.isArray(current)) return [...current, incoming]
  return [current, incoming]
}

function getPrimaryInput(node: WorkflowNode, nodeInputs: Record<string, unknown>) {
  const preferredPorts = ['in', 'input', ...node.inputs]
  for (const port of preferredPorts) {
    if (port && Object.prototype.hasOwnProperty.call(nodeInputs, port)) {
      return nodeInputs[port]
    }
  }
  return Object.values(nodeInputs)[0]
}

function inferTriggerType(node: WorkflowNode) {
  const candidates = [node.config.triggerType, node.config.trigger, node.config.subtype]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate) return candidate
  }
  return 'manual'
}

function inferActionKind(node: WorkflowNode) {
  const candidates = [node.config.action, node.config.kind, node.config.subtype]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate) return candidate.toLowerCase()
  }

  if (typeof node.label === 'string') {
    return node.label.toLowerCase().replace(/\s+/g, '-')
  }

  return 'action'
}

function inferTransformKind(node: WorkflowNode) {
  const candidates = [node.config.transform, node.config.kind, node.config.subtype]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate) return candidate.toLowerCase()
  }
  return 'template'
}

function inferOutputKind(node: WorkflowNode) {
  const candidates = [node.config.output, node.config.kind, node.config.subtype]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate) return candidate.toLowerCase()
  }
  return 'log'
}

async function readBudgetConfig() {
  try {
    const text = await readFile(BUDGET_FILE, 'utf-8')
    return { ...DEFAULT_BUDGET, ...JSON.parse(text) }
  } catch {
    return { ...DEFAULT_BUDGET }
  }
}

async function writeBudgetConfig(budget: Record<string, unknown>) {
  await mkdir(path.dirname(BUDGET_FILE), { recursive: true })
  await writeFile(BUDGET_FILE, JSON.stringify(budget, null, 2))
}

async function appendAlertHistory(ruleName: string, message: string) {
  await mkdir(path.dirname(ALERTS_FILE), { recursive: true })

  let existing: {
    rules?: unknown[]
    history?: { ruleId: string; ruleName: string; message: string; timestamp: string }[]
  } = {}

  try {
    existing = JSON.parse(await readFile(ALERTS_FILE, 'utf-8')) as typeof existing
  } catch {
    existing = {}
  }

  const history = Array.isArray(existing.history) ? existing.history : []
  history.push({
    ruleId: createId('workflow-alert'),
    ruleName,
    message,
    timestamp: new Date().toISOString(),
  })

  existing.history = history.slice(-100)
  if (!Array.isArray(existing.rules)) existing.rules = []

  await writeFile(ALERTS_FILE, JSON.stringify(existing, null, 2))
}

async function switchMode(modeValue: unknown) {
  const mode = typeof modeValue === 'string' ? modeValue.toLowerCase() : 'standard'
  const selectedMode = MODE_MODELS[mode]
  if (!selectedMode) {
    throw new Error(`Unsupported mode "${mode}"`)
  }

  const config = await getEffectiveConfig()
  if (!config.openclawUrl || !config.setupPassword) {
    throw new Error('OpenClaw connection is not configured')
  }

  const auth = 'Basic ' + Buffer.from(':' + config.setupPassword).toString('base64')

  const currentRes = await fetch(`${config.openclawUrl}/setup/api/config/raw`, {
    headers: { Authorization: auth },
    cache: 'no-store',
  })
  if (!currentRes.ok) {
    throw new Error('Could not read the current OpenClaw config')
  }

  const currentData = await currentRes.json() as { content?: string }
  const currentConfig = JSON.parse(currentData.content || '{}') as Record<string, unknown>

  if (!isRecord(currentConfig.agents)) currentConfig.agents = {}
  if (!isRecord((currentConfig.agents as Record<string, unknown>).defaults)) {
    (currentConfig.agents as Record<string, unknown>).defaults = {}
  }

  ;((currentConfig.agents as Record<string, unknown>).defaults as Record<string, unknown>).model = {
    primary: selectedMode.primary,
    fallbacks: selectedMode.fallbacks,
  }

  if (!isRecord(currentConfig.meta)) currentConfig.meta = {}
  ;(currentConfig.meta as Record<string, unknown>).lastTouchedAt = new Date().toISOString()

  const saveRes = await fetch(`${config.openclawUrl}/setup/api/config/raw`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: JSON.stringify(currentConfig, null, 2) }),
  })

  if (!saveRes.ok) {
    throw new Error('Could not save the updated OpenClaw config')
  }

  return {
    mode,
    model: selectedMode.primary,
  }
}

async function setBudget(node: WorkflowNode, nodeInputs: Record<string, unknown>, scope: Record<string, unknown>) {
  const current = await readBudgetConfig()

  const dailyLimitValue = node.config.dailyLimit ?? node.config.daily ?? getValueAtPath(scope, node.config.dailyLimitPath)
  const monthlyLimitValue = node.config.monthlyLimit ?? node.config.monthly ?? getValueAtPath(scope, node.config.monthlyLimitPath)
  const autoThrottle = typeof node.config.autoThrottle === 'boolean' ? node.config.autoThrottle : current.autoThrottle
  const throttleMode = typeof node.config.throttleMode === 'string' ? node.config.throttleMode : current.throttleMode
  const inputValue = getPrimaryInput(node, nodeInputs)

  const nextBudget = {
    ...current,
    dailyLimit: Number.isFinite(Number(dailyLimitValue)) ? Number(dailyLimitValue) : current.dailyLimit,
    monthlyLimit: Number.isFinite(Number(monthlyLimitValue)) ? Number(monthlyLimitValue) : current.monthlyLimit,
    autoThrottle,
    throttleMode,
    updatedAt: new Date().toISOString(),
    workflowInput: inputValue ?? null,
  }

  await writeBudgetConfig(nextBudget)
  return nextBudget
}

async function sendWebhook(urlValue: unknown, payload: unknown, methodValue: unknown) {
  if (typeof urlValue !== 'string' || !urlValue) {
    throw new Error('Webhook URL is required')
  }

  const target = new URL(urlValue)
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('Webhook URL must use http or https')
  }

  const method = typeof methodValue === 'string' && methodValue ? methodValue.toUpperCase() : 'POST'
  const response = await fetch(target, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`Webhook request failed with status ${response.status}`)
  }

  return {
    ok: true,
    status: response.status,
  }
}

async function executeNode(node: WorkflowNode, context: ExecutionContext): Promise<WorkflowOutputMap> {
  const nodeInputs = context.nodeInputs.get(node.id) ?? {}
  const scope = resolveTemplateScope(context, node, nodeInputs)
  const primaryInput = getPrimaryInput(node, nodeInputs)

  switch (node.type) {
    case 'trigger':
      return {
        out: {
          triggerType: inferTriggerType(node),
          triggerData: context.triggerData,
          workflowId: context.workflow.id,
          workflowName: context.workflow.name,
          firedAt: new Date().toISOString(),
        },
      }

    case 'agent': {
      const command = typeof node.config.command === 'string'
        ? node.config.command
        : typeof node.config.cmd === 'string'
          ? node.config.cmd
          : ''
      if (!command) {
        throw new Error('Agent nodes require a command')
      }

      const argTemplate = typeof node.config.arg === 'string'
        ? node.config.arg
        : typeof node.config.args === 'string'
          ? node.config.args
          : typeof node.config.message === 'string'
            ? node.config.message
            : ''

      const renderedArg = argTemplate ? renderTemplate(argTemplate, scope) : stableStringify(primaryInput)
      const result = await runCommand(command, renderedArg)
      return {
        out: result,
        result,
      }
    }

    case 'condition': {
      const actual = getValueAtPath(
        primaryInput ?? scope,
        node.config.field ?? node.config.path ?? node.config.left
      )
      const matches = matchesCondition(actual, node.config.operator, node.config.value ?? node.config.right)
      return matches
        ? { true: { value: actual, matched: true } }
        : { false: { value: actual, matched: false } }
    }

    case 'action': {
      const actionKind = inferActionKind(node)

      if (['mode', 'mode-switch', 'switch-mode', 'mode_switch'].includes(actionKind)) {
        const result = await switchMode(node.config.mode)
        return { out: result }
      }

      if (['budget', 'set-budget', 'budget-set', 'budget_set'].includes(actionKind)) {
        const result = await setBudget(node, nodeInputs, scope)
        return { out: result }
      }

      if (actionKind === 'alert') {
        const title = renderTemplate(node.config.title ?? node.label, scope) || node.label
        const message = renderTemplate(node.config.message ?? node.config.body ?? primaryInput, scope) || 'Workflow alert'
        await appendAlertHistory(title, message)
        return {
          out: {
            title,
            message,
          },
        }
      }

      throw new Error(`Unsupported action node "${actionKind}"`)
    }

    case 'transform': {
      const transformKind = inferTransformKind(node)

      if (['extract', 'pick', 'field'].includes(transformKind)) {
        return {
          out: getValueAtPath(primaryInput, node.config.path ?? node.config.field),
        }
      }

      if (['template', 'format', 'format-text'].includes(transformKind)) {
        return {
          out: renderTemplate(node.config.template ?? '{{input}}', scope),
        }
      }

      if (['json-parse', 'json_parse', 'parse'].includes(transformKind)) {
        const text = renderTemplate(node.config.template ?? primaryInput, scope)
        return {
          out: text ? JSON.parse(text) : null,
        }
      }

      if (['json-stringify', 'json_stringify', 'stringify'].includes(transformKind)) {
        return {
          out: JSON.stringify(primaryInput ?? nodeInputs, null, 2),
        }
      }

      if (transformKind === 'merge') {
        return {
          out: {
            ...nodeInputs,
            input: primaryInput ?? null,
          },
        }
      }

      return { out: primaryInput ?? nodeInputs }
    }

    case 'output': {
      const outputKind = inferOutputKind(node)

      if (outputKind === 'log') {
        return {
          out: {
            level: typeof node.config.level === 'string' ? node.config.level : 'info',
            message: renderTemplate(node.config.message ?? primaryInput, scope) || stableStringify(primaryInput),
          },
        }
      }

      if (outputKind === 'notify') {
        const title = renderTemplate(node.config.title ?? node.label, scope) || node.label
        const body = renderTemplate(node.config.body ?? primaryInput, scope)
        await appendAlertHistory(title, body || 'Workflow notification')
        return {
          out: {
            title,
            body,
          },
        }
      }

      if (['webhook', 'webhook-out', 'webhook_out'].includes(outputKind)) {
        const payload = primaryInput ?? nodeInputs
        const response = await sendWebhook(node.config.url, payload, node.config.method)
        return { out: response }
      }

      throw new Error(`Unsupported output node "${outputKind}"`)
    }

    default:
      throw new Error(`Unsupported workflow node type "${node.type}"`)
  }
}

export function normalizeWorkflow(input: unknown): Workflow {
  const source = isRecord(input) ? input : {}
  const now = new Date().toISOString()
  const nodes = Array.isArray(source.nodes) ? source.nodes.map(normalizeNode) : []
  const edges = Array.isArray(source.edges) ? source.edges.map(normalizeEdge).filter((edge) => edge.source && edge.target) : []

  return {
    id: typeof source.id === 'string' && source.id ? source.id : createId('workflow'),
    name: typeof source.name === 'string' && source.name ? source.name : 'Untitled Workflow',
    description: typeof source.description === 'string' ? source.description : '',
    nodes,
    edges,
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : now,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : now,
    enabled: typeof source.enabled === 'boolean' ? source.enabled : true,
  }
}

export async function executeWorkflow(workflowInput: Workflow, triggerData: Record<string, unknown> = {}): Promise<WorkflowExecutionRecord> {
  const workflow = normalizeWorkflow(workflowInput)
  const startedAt = new Date()
  const startedAtIso = startedAt.toISOString()
  const nodeMap = new Map(workflow.nodes.map((node) => [node.id, node]))
  const incomingEdges = new Map<string, WorkflowEdge[]>()
  const outgoingEdges = new Map<string, WorkflowEdge[]>()

  for (const node of workflow.nodes) {
    incomingEdges.set(node.id, [])
    outgoingEdges.set(node.id, [])
  }

  for (const edge of workflow.edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue
    incomingEdges.get(edge.target)?.push(edge)
    outgoingEdges.get(edge.source)?.push(edge)
  }

  const triggerNodes = workflow.nodes.filter((node) => node.type === 'trigger')
  const rootNodes = triggerNodes.length > 0
    ? triggerNodes
    : workflow.nodes.filter((node) => (incomingEdges.get(node.id)?.length ?? 0) === 0)

  if (rootNodes.length === 0) {
    throw new Error('Workflow has no executable starting node')
  }

  const nodeInputs = new Map<string, Record<string, unknown>>()
  const nodeResults: Record<string, WorkflowNodeExecutionResult> = {}
  const resolvedInbound = new Map<string, Set<string>>()
  const terminalNodeStates = new Map<string, 'success' | 'failed' | 'skipped'>()
  const queue: string[] = []
  const queued = new Set<string>()

  for (const node of workflow.nodes) {
    resolvedInbound.set(node.id, new Set())
  }

  for (const node of rootNodes) {
    queue.push(node.id)
    queued.add(node.id)
  }

  const context: ExecutionContext = {
    workflow,
    triggerData,
    nodeInputs,
    nodeResults,
  }

  const advanceTarget = (targetNodeId: string) => {
    const targetNode = nodeMap.get(targetNodeId)
    if (!targetNode || terminalNodeStates.has(targetNodeId)) return

    const totalInbound = incomingEdges.get(targetNodeId)?.length ?? 0
    const resolvedCount = resolvedInbound.get(targetNodeId)?.size ?? 0
    if (resolvedCount < totalInbound) return

    const bufferedInput = nodeInputs.get(targetNodeId)
    const hasInput = !!bufferedInput && Object.keys(bufferedInput).length > 0

    if (totalInbound > 0 && !hasInput) {
      const now = new Date()
      nodeResults[targetNodeId] = {
        nodeId: targetNode.id,
        nodeLabel: targetNode.label,
        nodeType: targetNode.type,
        status: 'skipped',
        startedAt: now.toISOString(),
        finishedAt: now.toISOString(),
        durationMs: 0,
        inputs: {},
        outputs: {},
      }
      terminalNodeStates.set(targetNodeId, 'skipped')

      for (const edge of outgoingEdges.get(targetNodeId) ?? []) {
        resolvedInbound.get(edge.target)?.add(edge.id)
        advanceTarget(edge.target)
      }
      return
    }

    if (!queued.has(targetNodeId)) {
      queue.push(targetNodeId)
      queued.add(targetNodeId)
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()
    if (!nodeId) continue

    const node = nodeMap.get(nodeId)
    if (!node || terminalNodeStates.has(nodeId)) continue

    const nodeStart = new Date()
    const currentInputs = nodeInputs.get(nodeId) ?? {}

    try {
      const outputs = await executeNode(node, context)
      const nodeFinish = new Date()

      nodeResults[nodeId] = {
        nodeId: node.id,
        nodeLabel: node.label,
        nodeType: node.type,
        status: 'success',
        startedAt: nodeStart.toISOString(),
        finishedAt: nodeFinish.toISOString(),
        durationMs: nodeFinish.getTime() - nodeStart.getTime(),
        inputs: currentInputs,
        outputs,
      }
      terminalNodeStates.set(nodeId, 'success')

      for (const edge of outgoingEdges.get(nodeId) ?? []) {
        if (Object.prototype.hasOwnProperty.call(outputs, edge.sourcePort)) {
          const targetInputs = nodeInputs.get(edge.target) ?? {}
          targetInputs[edge.targetPort] = mergeInputValue(targetInputs[edge.targetPort], outputs[edge.sourcePort])
          nodeInputs.set(edge.target, targetInputs)
        }
        resolvedInbound.get(edge.target)?.add(edge.id)
        advanceTarget(edge.target)
      }
    } catch (error) {
      const nodeFinish = new Date()
      const message = error instanceof Error ? error.message : 'Workflow node failed'

      nodeResults[nodeId] = {
        nodeId: node.id,
        nodeLabel: node.label,
        nodeType: node.type,
        status: 'failed',
        startedAt: nodeStart.toISOString(),
        finishedAt: nodeFinish.toISOString(),
        durationMs: nodeFinish.getTime() - nodeStart.getTime(),
        inputs: currentInputs,
        outputs: {},
        error: message,
      }
      terminalNodeStates.set(nodeId, 'failed')

      for (const edge of outgoingEdges.get(nodeId) ?? []) {
        resolvedInbound.get(edge.target)?.add(edge.id)
        advanceTarget(edge.target)
      }
    }
  }

  for (const node of workflow.nodes) {
    if (terminalNodeStates.has(node.id)) continue

    const now = new Date()
    nodeResults[node.id] = {
      nodeId: node.id,
      nodeLabel: node.label,
      nodeType: node.type,
      status: 'skipped',
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      durationMs: 0,
      inputs: nodeInputs.get(node.id) ?? {},
      outputs: {},
      error: 'Node was not reached from any trigger',
    }
    terminalNodeStates.set(node.id, 'skipped')
  }

  const statuses = Object.values(nodeResults).map((result) => result.status)
  const hasFailure = statuses.includes('failed')
  const hasSuccess = statuses.includes('success')
  const finishedAt = new Date()

  return {
    id: createId('workflow-exec'),
    workflowId: workflow.id,
    workflowName: workflow.name,
    status: hasFailure ? (hasSuccess ? 'partial' : 'failed') : 'success',
    triggerType: rootNodes.some((node) => node.type === 'trigger')
      ? inferTriggerType(rootNodes[0])
      : 'manual',
    triggerData,
    startedAt: startedAtIso,
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    nodeResults,
  }
}

export function createStarterWorkflowTemplates(): Workflow[] {
  const now = new Date().toISOString()

  return [
    normalizeWorkflow({
      id: 'workflow-template-budget-overnight',
      name: 'Budget Mode Overnight',
      description: 'Switch Mission Control into budget mode overnight to cut spend automatically.',
      createdAt: now,
      updatedAt: now,
      enabled: false,
      nodes: [
        {
          id: 'trigger-cron-budget-night',
          type: 'trigger',
          label: 'Nightly Trigger',
          position: { x: 80, y: 120 },
          config: { triggerType: 'cron', cron: '0 0 * * *' },
          inputs: [],
          outputs: ['out'],
        },
        {
          id: 'action-budget-mode',
          type: 'action',
          label: 'Switch To Budget Mode',
          position: { x: 320, y: 120 },
          config: { action: 'mode_switch', mode: 'budget' },
          inputs: ['in'],
          outputs: ['out'],
        },
        {
          id: 'output-log-budget-mode',
          type: 'output',
          label: 'Log Result',
          position: { x: 560, y: 120 },
          config: {
            output: 'log',
            level: 'info',
            message: 'Workflow switched Mission Control into {{input.mode}} mode at {{now}}',
          },
          inputs: ['in'],
          outputs: [],
        },
      ],
      edges: [
        {
          id: 'edge-budget-trigger',
          source: 'trigger-cron-budget-night',
          sourcePort: 'out',
          target: 'action-budget-mode',
          targetPort: 'in',
        },
        {
          id: 'edge-budget-log',
          source: 'action-budget-mode',
          sourcePort: 'out',
          target: 'output-log-budget-mode',
          targetPort: 'in',
        },
      ],
    }),
    normalizeWorkflow({
      id: 'workflow-template-alert-high-spend',
      name: 'Alert on High Spend',
      description: 'Check incoming spend data and create an alert when it exceeds a configured threshold.',
      createdAt: now,
      updatedAt: now,
      enabled: false,
      nodes: [
        {
          id: 'trigger-manual-spend',
          type: 'trigger',
          label: 'Manual Trigger',
          position: { x: 80, y: 280 },
          config: { triggerType: 'manual' },
          inputs: [],
          outputs: ['out'],
        },
        {
          id: 'condition-spend-threshold',
          type: 'condition',
          label: 'Spend Above Threshold?',
          position: { x: 320, y: 280 },
          config: { field: 'amount', operator: 'gte', value: 100 },
          inputs: ['in'],
          outputs: ['true', 'false'],
        },
        {
          id: 'action-create-alert',
          type: 'action',
          label: 'Create Alert',
          position: { x: 580, y: 220 },
          config: {
            action: 'alert',
            title: 'High spend detected',
            message: 'Spend is at ${{input.value}} which exceeds the workflow threshold.',
          },
          inputs: ['in'],
          outputs: ['out'],
        },
        {
          id: 'output-log-high-spend',
          type: 'output',
          label: 'Log Alert',
          position: { x: 820, y: 220 },
          config: {
            output: 'log',
            level: 'warn',
            message: '{{input.message}}',
          },
          inputs: ['in'],
          outputs: [],
        },
      ],
      edges: [
        {
          id: 'edge-spend-trigger',
          source: 'trigger-manual-spend',
          sourcePort: 'out',
          target: 'condition-spend-threshold',
          targetPort: 'in',
        },
        {
          id: 'edge-spend-alert',
          source: 'condition-spend-threshold',
          sourcePort: 'true',
          target: 'action-create-alert',
          targetPort: 'in',
        },
        {
          id: 'edge-spend-log',
          source: 'action-create-alert',
          sourcePort: 'out',
          target: 'output-log-high-spend',
          targetPort: 'in',
        },
      ],
    }),
  ]
}
