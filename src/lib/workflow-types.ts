/**
 * Shared types for the Workflow Builder.
 * Used by both the visual editor (frontend) and the execution engine (backend).
 */

export type NodeType = 'trigger' | 'agent' | 'condition' | 'action' | 'transform' | 'output'

export interface NodePort {
  id: string
  label: string
  type: 'input' | 'output'
}

export interface WorkflowNode {
  id: string
  type: NodeType
  label: string
  position: { x: number; y: number }
  config: Record<string, unknown>
  /** Named input ports */
  inputs: NodePort[]
  /** Named output ports */
  outputs: NodePort[]
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

export interface ExecutionResult {
  id: string
  workflowId: string
  workflowName: string
  status: 'running' | 'success' | 'failure' | 'partial'
  startedAt: string
  finishedAt?: string
  duration?: number
  nodeResults: Record<string, {
    status: 'success' | 'failure' | 'skipped'
    output?: string
    error?: string
    duration: number
  }>
  triggerData?: Record<string, unknown>
}

// ─── Node catalog ─────────────────────────────────────────

export interface NodeDefinition {
  type: NodeType
  subtype: string
  label: string
  description: string
  icon: string
  color: string
  defaultInputs: NodePort[]
  defaultOutputs: NodePort[]
  defaultConfig: Record<string, unknown>
  configFields: ConfigField[]
}

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'textarea' | 'boolean'
  options?: { label: string; value: string }[]
  placeholder?: string
  required?: boolean
}

export const NODE_CATALOG: NodeDefinition[] = [
  // ─── Triggers ───
  {
    type: 'trigger',
    subtype: 'manual',
    label: 'Manual Trigger',
    description: 'Start workflow manually with a button press',
    icon: '▶',
    color: '#3b82f6',
    defaultInputs: [],
    defaultOutputs: [{ id: 'out', label: 'Start', type: 'output' }],
    defaultConfig: {},
    configFields: [],
  },
  {
    type: 'trigger',
    subtype: 'cron',
    label: 'Schedule',
    description: 'Run on a recurring schedule',
    icon: '⏰',
    color: '#3b82f6',
    defaultInputs: [],
    defaultOutputs: [{ id: 'out', label: 'Tick', type: 'output' }],
    defaultConfig: { cron: '0 * * * *' },
    configFields: [
      { key: 'cron', label: 'Cron Expression', type: 'text', placeholder: '0 * * * *', required: true },
    ],
  },
  {
    type: 'trigger',
    subtype: 'webhook',
    label: 'Webhook',
    description: 'Trigger from an external HTTP call',
    icon: '🔗',
    color: '#3b82f6',
    defaultInputs: [],
    defaultOutputs: [{ id: 'out', label: 'Payload', type: 'output' }],
    defaultConfig: { path: '/hooks/my-workflow' },
    configFields: [
      { key: 'path', label: 'Webhook Path', type: 'text', placeholder: '/hooks/my-workflow' },
    ],
  },
  {
    type: 'trigger',
    subtype: 'threshold',
    label: 'Cost Threshold',
    description: 'Trigger when spend exceeds a limit',
    icon: '💰',
    color: '#3b82f6',
    defaultInputs: [],
    defaultOutputs: [{ id: 'out', label: 'Alert', type: 'output' }],
    defaultConfig: { threshold: 10, metric: 'daily_spend' },
    configFields: [
      { key: 'metric', label: 'Metric', type: 'select', options: [
        { label: 'Daily Spend', value: 'daily_spend' },
        { label: 'Monthly Spend', value: 'monthly_spend' },
        { label: 'Credits Remaining', value: 'credits_remaining' },
      ]},
      { key: 'threshold', label: 'Threshold ($)', type: 'number', required: true },
    ],
  },

  // ─── Agent nodes ───
  {
    type: 'agent',
    subtype: 'command',
    label: 'Run Command',
    description: 'Execute an OpenClaw console command',
    icon: '⚡',
    color: '#8b5cf6',
    defaultInputs: [{ id: 'in', label: 'Input', type: 'input' }],
    defaultOutputs: [{ id: 'out', label: 'Result', type: 'output' }],
    defaultConfig: { cmd: 'openclaw.status', arg: '' },
    configFields: [
      { key: 'cmd', label: 'Command', type: 'text', placeholder: 'openclaw.status', required: true },
      { key: 'arg', label: 'Arguments', type: 'text', placeholder: '' },
    ],
  },
  {
    type: 'agent',
    subtype: 'chat',
    label: 'Agent Chat',
    description: 'Send a message to an agent session',
    icon: '💬',
    color: '#8b5cf6',
    defaultInputs: [{ id: 'in', label: 'Prompt', type: 'input' }],
    defaultOutputs: [{ id: 'out', label: 'Response', type: 'output' }],
    defaultConfig: { session: 'main', message: '' },
    configFields: [
      { key: 'session', label: 'Session', type: 'text', placeholder: 'main' },
      { key: 'message', label: 'Message', type: 'textarea', placeholder: 'What should the agent do?', required: true },
    ],
  },
  {
    type: 'agent',
    subtype: 'spawn',
    label: 'Spawn Agent',
    description: 'Start a new agent session with a task',
    icon: '🚀',
    color: '#8b5cf6',
    defaultInputs: [{ id: 'in', label: 'Task', type: 'input' }],
    defaultOutputs: [{ id: 'out', label: 'Session', type: 'output' }],
    defaultConfig: { agent: 'default', task: '' },
    configFields: [
      { key: 'agent', label: 'Agent Name', type: 'text', placeholder: 'default' },
      { key: 'task', label: 'Initial Task', type: 'textarea', placeholder: 'Describe the task...', required: true },
    ],
  },

  // ─── Conditions ───
  {
    type: 'condition',
    subtype: 'if',
    label: 'If / Else',
    description: 'Branch based on a condition',
    icon: '🔀',
    color: '#f59e0b',
    defaultInputs: [{ id: 'in', label: 'Value', type: 'input' }],
    defaultOutputs: [
      { id: 'true', label: 'True', type: 'output' },
      { id: 'false', label: 'False', type: 'output' },
    ],
    defaultConfig: { field: '', operator: 'gt', value: '' },
    configFields: [
      { key: 'field', label: 'Field', type: 'text', placeholder: 'e.g. total, status' },
      { key: 'operator', label: 'Operator', type: 'select', options: [
        { label: 'Greater than', value: 'gt' },
        { label: 'Less than', value: 'lt' },
        { label: 'Equals', value: 'eq' },
        { label: 'Contains', value: 'contains' },
        { label: 'Not empty', value: 'not_empty' },
      ]},
      { key: 'value', label: 'Compare Value', type: 'text' },
    ],
  },

  // ─── Actions ───
  {
    type: 'action',
    subtype: 'switch-mode',
    label: 'Switch Mode',
    description: 'Change the OpenClaw AI mode',
    icon: '🎛',
    color: '#10b981',
    defaultInputs: [{ id: 'in', label: 'Trigger', type: 'input' }],
    defaultOutputs: [{ id: 'out', label: 'Done', type: 'output' }],
    defaultConfig: { mode: 'budget' },
    configFields: [
      { key: 'mode', label: 'Mode', type: 'select', required: true, options: [
        { label: 'Best', value: 'best' },
        { label: 'Standard', value: 'standard' },
        { label: 'Budget', value: 'budget' },
        { label: 'Auto', value: 'auto' },
      ]},
    ],
  },
  {
    type: 'action',
    subtype: 'set-budget',
    label: 'Set Budget',
    description: 'Update the daily budget limit',
    icon: '💵',
    color: '#10b981',
    defaultInputs: [{ id: 'in', label: 'Trigger', type: 'input' }],
    defaultOutputs: [{ id: 'out', label: 'Done', type: 'output' }],
    defaultConfig: { dailyLimit: 10 },
    configFields: [
      { key: 'dailyLimit', label: 'Daily Limit ($)', type: 'number', required: true },
    ],
  },
  {
    type: 'action',
    subtype: 'wait',
    label: 'Wait',
    description: 'Pause execution for a duration',
    icon: '⏳',
    color: '#10b981',
    defaultInputs: [{ id: 'in', label: 'Trigger', type: 'input' }],
    defaultOutputs: [{ id: 'out', label: 'Done', type: 'output' }],
    defaultConfig: { seconds: 30 },
    configFields: [
      { key: 'seconds', label: 'Wait (seconds)', type: 'number', required: true },
    ],
  },

  // ─── Transform ───
  {
    type: 'transform',
    subtype: 'extract',
    label: 'Extract Field',
    description: 'Pull a specific value from the input data',
    icon: '🔍',
    color: '#06b6d4',
    defaultInputs: [{ id: 'in', label: 'Data', type: 'input' }],
    defaultOutputs: [{ id: 'out', label: 'Value', type: 'output' }],
    defaultConfig: { path: '' },
    configFields: [
      { key: 'path', label: 'JSON Path', type: 'text', placeholder: 'e.g. data.total', required: true },
    ],
  },
  {
    type: 'transform',
    subtype: 'template',
    label: 'Format Text',
    description: 'Build a message from template + data',
    icon: '📝',
    color: '#06b6d4',
    defaultInputs: [{ id: 'in', label: 'Data', type: 'input' }],
    defaultOutputs: [{ id: 'out', label: 'Text', type: 'output' }],
    defaultConfig: { template: 'Spend today: ${{total}}' },
    configFields: [
      { key: 'template', label: 'Template', type: 'textarea', placeholder: 'Use {{field}} for variables', required: true },
    ],
  },

  // ─── Outputs ───
  {
    type: 'output',
    subtype: 'log',
    label: 'Log',
    description: 'Write to workflow execution log',
    icon: '📋',
    color: '#ec4899',
    defaultInputs: [{ id: 'in', label: 'Message', type: 'input' }],
    defaultOutputs: [],
    defaultConfig: { level: 'info' },
    configFields: [
      { key: 'level', label: 'Level', type: 'select', options: [
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warn' },
        { label: 'Error', value: 'error' },
      ]},
    ],
  },
  {
    type: 'output',
    subtype: 'notify',
    label: 'Notification',
    description: 'Send a Mission Control notification',
    icon: '🔔',
    color: '#ec4899',
    defaultInputs: [{ id: 'in', label: 'Message', type: 'input' }],
    defaultOutputs: [],
    defaultConfig: { title: '', body: '' },
    configFields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'textarea' },
    ],
  },
  {
    type: 'output',
    subtype: 'webhook-out',
    label: 'Send Webhook',
    description: 'POST data to an external URL',
    icon: '📡',
    color: '#ec4899',
    defaultInputs: [{ id: 'in', label: 'Payload', type: 'input' }],
    defaultOutputs: [],
    defaultConfig: { url: '', method: 'POST' },
    configFields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://...', required: true },
      { key: 'method', label: 'Method', type: 'select', options: [
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
      ]},
    ],
  },
]

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  trigger: '#3b82f6',
  agent: '#8b5cf6',
  condition: '#f59e0b',
  action: '#10b981',
  transform: '#06b6d4',
  output: '#ec4899',
}

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  trigger: 'Triggers',
  agent: 'Agents',
  condition: 'Logic',
  action: 'Actions',
  transform: 'Transform',
  output: 'Outputs',
}
