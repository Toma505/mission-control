import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { DATA_DIR } from '@/lib/connection-config'

export type PromptVersion = {
  id: string
  savedAt: string
  name: string
  description: string
  category: string
  content: string
  variables: string[]
  tags: string[]
}

export type PromptTemplate = {
  id: string
  name: string
  description: string
  category: string
  content: string
  variables: string[]
  tags: string[]
  usageCount: number
  createdAt: string
  updatedAt: string
  versions: PromptVersion[]
}

type LegacyPrompt = Omit<PromptTemplate, 'versions'>

type PromptStore = {
  prompts: PromptTemplate[]
}

export const PROMPTS_FILE = path.join(DATA_DIR, 'prompts.json')
const LEGACY_PROMPTS_FILE = path.join(DATA_DIR, 'prompt-library.json')

function extractVariables(content: string): string[] {
  const varMatches = content.match(/\{\{(\w+)\}\}/g) || []
  return [...new Set(varMatches.map((value) => value.replace(/[{}]/g, '')))]
}

function versionId(prefix = 'version') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function normalizePrompt(prompt: PromptTemplate | LegacyPrompt): PromptTemplate {
  const variables = Array.isArray(prompt.variables) && prompt.variables.length > 0
    ? prompt.variables
    : extractVariables(prompt.content)

  const base: PromptTemplate = {
    ...prompt,
    variables,
    tags: Array.isArray(prompt.tags) ? prompt.tags : [],
    usageCount: Number.isFinite(prompt.usageCount) ? prompt.usageCount : 0,
    createdAt: prompt.createdAt || new Date().toISOString(),
    updatedAt: prompt.updatedAt || prompt.createdAt || new Date().toISOString(),
    versions: [],
  }

  const existingVersions = 'versions' in prompt && Array.isArray(prompt.versions)
    ? prompt.versions
    : []

  base.versions = existingVersions.length > 0
    ? existingVersions.map((version) => ({
        ...version,
        variables: Array.isArray(version.variables) && version.variables.length > 0
          ? version.variables
          : extractVariables(version.content),
        tags: Array.isArray(version.tags) ? version.tags : [],
      }))
    : [
        {
          id: versionId('version'),
          savedAt: base.updatedAt,
          name: base.name,
          description: base.description,
          category: base.category,
          content: base.content,
          variables,
          tags: base.tags,
        },
      ]

  return base
}

async function fileExists(filename: string) {
  try {
    await readFile(filename, 'utf-8')
    return true
  } catch {
    return false
  }
}

export async function readPromptStore(): Promise<PromptStore> {
  try {
    const raw = await readFile(PROMPTS_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as PromptStore
    return {
      prompts: Array.isArray(parsed.prompts) ? parsed.prompts.map(normalizePrompt) : [],
    }
  } catch {
    if (await fileExists(LEGACY_PROMPTS_FILE)) {
      try {
        const raw = await readFile(LEGACY_PROMPTS_FILE, 'utf-8')
        const legacyPrompts = JSON.parse(raw) as LegacyPrompt[]
        const migrated = {
          prompts: Array.isArray(legacyPrompts) ? legacyPrompts.map(normalizePrompt) : [],
        }
        await writePromptStore(migrated)
        return migrated
      } catch {
        return { prompts: [] }
      }
    }

    return { prompts: [] }
  }
}

export async function writePromptStore(store: PromptStore) {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(PROMPTS_FILE, JSON.stringify(store, null, 2))
}

export function buildPromptVersion(prompt: {
  name: string
  description: string
  category: string
  content: string
  tags: string[]
}, savedAt: string): PromptVersion {
  return {
    id: versionId('version'),
    savedAt,
    name: prompt.name,
    description: prompt.description,
    category: prompt.category,
    content: prompt.content,
    variables: extractVariables(prompt.content),
    tags: prompt.tags,
  }
}

export function createPromptId() {
  return `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function getPromptCategories(prompts: PromptTemplate[]) {
  return [...new Set(prompts.map((prompt) => prompt.category).filter(Boolean))].sort()
}

export function getPromptTags(prompts: PromptTemplate[]) {
  return [...new Set(prompts.flatMap((prompt) => prompt.tags).filter(Boolean))].sort()
}

export function filterPrompts(
  prompts: PromptTemplate[],
  search: string,
  category: string,
  tag: string,
) {
  const query = search.trim().toLowerCase()

  return prompts.filter((prompt) => {
    if (category && prompt.category !== category) return false
    if (tag && !prompt.tags.includes(tag)) return false
    if (!query) return true

    return [
      prompt.name,
      prompt.description,
      prompt.content,
      prompt.category,
      ...prompt.tags,
    ].some((value) => value.toLowerCase().includes(query))
  })
}
