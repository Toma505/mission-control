/**
 * Command engine for Agent Chat + Command Mode.
 * Maps slash commands and natural language intents to Mission Control actions.
 * Commands are executed server-side via MC's own APIs or directly via OpenClaw.
 */

export interface Command {
  id: string
  name: string
  description: string
  aliases: string[]
  category: 'mode' | 'agent' | 'cost' | 'system' | 'pipeline'
  usage: string
  /** Natural language patterns that trigger this command */
  patterns: RegExp[]
  /** If true, this command mutates state and should only trigger via explicit slash commands */
  mutating?: boolean
}

export interface CommandResult {
  ok: boolean
  message: string
  data?: Record<string, unknown>
}

export const COMMANDS: Command[] = [
  // ─── Mode commands ──────────────────────────────────
  {
    id: 'switch-mode',
    name: 'Switch Mode',
    description: 'Switch OpenClaw to a different AI mode',
    aliases: ['/mode', '/switch'],
    category: 'mode',
    usage: '/mode <best|standard|budget|auto>',
    mutating: true,
    patterns: [
      /^\/mode\s+(best|standard|budget|auto)$/i,
      /^\/switch\s+(best|standard|budget|auto)$/i,
    ],
  },
  {
    id: 'get-mode',
    name: 'Current Mode',
    description: 'Show the current AI mode and model',
    aliases: ['/status', '/current'],
    category: 'mode',
    usage: '/status',
    patterns: [
      /^\/(?:status|current|mode)$/i,
      /(?:what|which|show|get)\s+(?:is\s+)?(?:the\s+)?(?:current\s+)?mode/i,
      /what\s+model\s+(?:am\s+I|are\s+we)\s+(?:using|on|running)/i,
    ],
  },

  // ─── Agent commands ─────────────────────────────────
  {
    id: 'list-sessions',
    name: 'List Sessions',
    description: 'Show all active agent sessions',
    aliases: ['/sessions', '/agents'],
    category: 'agent',
    usage: '/sessions',
    patterns: [
      /^\/(?:sessions|agents)$/i,
      /(?:list|show|get)\s+(?:all\s+)?(?:active\s+)?sessions/i,
      /(?:how\s+many|what)\s+(?:sessions|agents)\s+(?:are|do)/i,
    ],
  },
  {
    id: 'agent-health',
    name: 'Agent Health',
    description: 'Check agent health and connectivity',
    aliases: ['/health', '/ping'],
    category: 'agent',
    usage: '/health',
    patterns: [
      /^\/(?:health|ping|check)$/i,
      /(?:check|show|get)\s+(?:agent\s+)?health/i,
      /(?:is\s+(?:the\s+)?agent|are\s+(?:the\s+)?agents?)\s+(?:ok|up|online|running|healthy)/i,
    ],
  },

  // ─── Cost commands ──────────────────────────────────
  {
    id: 'get-costs',
    name: 'Cost Summary',
    description: 'Show current spend and budget status',
    aliases: ['/costs', '/spend', '/budget'],
    category: 'cost',
    usage: '/costs',
    patterns: [
      /^\/(?:costs?|spend|budget)$/i,
      /(?:how\s+much|what)\s+(?:have\s+I|did\s+we|is\s+the)\s+(?:spent?|cost|used)/i,
      /(?:show|get|check)\s+(?:the\s+)?(?:cost|spend|budget|usage)/i,
      /(?:what.s|whats)\s+(?:the\s+|my\s+)?(?:spend|cost|budget)/i,
    ],
  },
  {
    id: 'set-budget',
    name: 'Set Budget',
    description: 'Set a daily budget limit',
    aliases: ['/budget-set'],
    category: 'cost',
    usage: '/budget-set <amount>',
    mutating: true,
    patterns: [
      /^\/budget-set\s+\$?(\d+(?:\.\d+)?)$/i,
    ],
  },

  // ─── System commands ────────────────────────────────
  {
    id: 'system-status',
    name: 'System Status',
    description: 'Full OpenClaw system status overview',
    aliases: ['/sys', '/system'],
    category: 'system',
    usage: '/sys',
    patterns: [
      /^\/(?:sys|system)$/i,
      /(?:show|get)\s+(?:full\s+)?system\s+status/i,
      /system\s+(?:status|overview|info)/i,
    ],
  },
  {
    id: 'view-logs',
    name: 'View Logs',
    description: 'Show recent agent logs',
    aliases: ['/logs'],
    category: 'system',
    usage: '/logs [lines]',
    patterns: [
      /^\/logs(?:\s+(\d+))?$/i,
      /(?:show|get|view|tail)\s+(?:the\s+)?(?:recent\s+)?logs/i,
      /(?:what.s|whats)\s+in\s+the\s+logs/i,
    ],
  },
  {
    id: 'list-plugins',
    name: 'List Plugins',
    description: 'Show installed OpenClaw plugins',
    aliases: ['/plugins'],
    category: 'system',
    usage: '/plugins',
    patterns: [
      /^\/plugins$/i,
      /(?:list|show|get)\s+(?:installed\s+)?plugins/i,
      /what\s+plugins\s+(?:are|do)/i,
    ],
  },

  // ─── Pipeline commands ──────────────────────────────
  {
    id: 'run-command',
    name: 'Run Command',
    description: 'Execute a raw OpenClaw console command',
    aliases: ['/run', '/exec'],
    category: 'pipeline',
    usage: '/run <command> [args]',
    patterns: [
      /^\/(?:run|exec)\s+(.+)$/i,
    ],
  },
]

/**
 * Try to match user input against known commands.
 * Returns the matched command + extracted params, or null.
 */
export function matchCommand(input: string): {
  command: Command
  params: Record<string, string>
} | null {
  const trimmed = input.trim()

  for (const cmd of COMMANDS) {
    for (const pattern of cmd.patterns) {
      const match = trimmed.match(pattern)
      if (match) {
        const params: Record<string, string> = {}

        // Extract params based on command type
        switch (cmd.id) {
          case 'switch-mode':
            params.mode = (match[1] || '').toLowerCase()
            break
          case 'set-budget':
            params.amount = match[1] || ''
            break
          case 'view-logs':
            params.lines = match[1] || '30'
            break
          case 'run-command':
            params.raw = match[1] || ''
            break
        }

        return { command: cmd, params }
      }
    }
  }

  return null
}

/**
 * Get command suggestions for partial input (autocomplete).
 */
export function getCommandSuggestions(input: string): Command[] {
  if (!input.startsWith('/')) return []

  const query = input.toLowerCase()
  return COMMANDS.filter(cmd =>
    cmd.aliases.some(a => a.startsWith(query)) ||
    cmd.name.toLowerCase().includes(query.slice(1))
  ).slice(0, 6)
}
