import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'

export type AgentTemplate = {
  id: string
  name: string
  description: string
  systemPrompt: string
  recommendedModel: string
  suggestedTools: string[]
  suggestedPlugins: string[]
  builtIn: boolean
  createdAt: string
  updatedAt: string
}

type TemplateStore = {
  templates: AgentTemplate[]
}

const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json')
const DEFAULT_TEMPLATES_FILE = path.join(process.cwd(), 'data', 'templates.json')

function normalizeStore(input: unknown): TemplateStore {
  const parsed = input as Partial<TemplateStore> | null | undefined
  return {
    templates: Array.isArray(parsed?.templates) ? parsed.templates : [],
  }
}

async function readDefaultTemplateStore(): Promise<TemplateStore> {
  try {
    const raw = await readFile(DEFAULT_TEMPLATES_FILE, 'utf-8')
    return normalizeStore(JSON.parse(raw))
  } catch {
    return { templates: [] }
  }
}

export async function readTemplateStore(): Promise<TemplateStore> {
  const defaults = await readDefaultTemplateStore()

  try {
    const raw = await readFile(TEMPLATES_FILE, 'utf-8')
    const parsed = normalizeStore(JSON.parse(raw))
    const persistedBuiltIns = parsed.templates.filter((template) => template.builtIn)
    const persistedCustom = parsed.templates.filter((template) => !template.builtIn)

    return {
      templates: [
        ...(defaults.templates.length > 0 ? defaults.templates : persistedBuiltIns),
        ...persistedCustom,
      ],
    }
  } catch {
    return defaults
  }
}

export async function writeTemplateStore(store: TemplateStore) {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(TEMPLATES_FILE, JSON.stringify(store, null, 2))
}

export function createTemplateId() {
  return `template_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function sanitizeTemplateList(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))]
}
