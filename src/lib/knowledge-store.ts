import { randomUUID } from 'crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises'
import path from 'path'
import { PDFParse } from 'pdf-parse'
import { DATA_DIR } from '@/lib/connection-config'

export interface KnowledgeFileRecord {
  id: string
  name: string
  storedName: string
  mimeType: string
  extension: string
  sizeBytes: number
  addedAt: string
  chunkCount: number
  tokenCount: number
  preview: string
}

export interface KnowledgeChunk {
  id: string
  fileId: string
  order: number
  content: string
  termFreq: Record<string, number>
}

export interface KnowledgeAttachment {
  id: string
  fileIds: string[]
  agentId: string
  sessionKey?: string
  attachedAt: string
}

export interface KnowledgeIndex {
  version: number
  files: KnowledgeFileRecord[]
  chunks: KnowledgeChunk[]
  attachments: KnowledgeAttachment[]
}

export interface KnowledgeSearchResult {
  fileId: string
  fileName: string
  chunkId: string
  score: number
  snippet: string
  chunkOrder: number
}

const KNOWLEDGE_DIR = path.join(DATA_DIR, 'knowledge')
const KNOWLEDGE_INDEX_FILE = path.join(DATA_DIR, 'knowledge-index.json')
const KNOWLEDGE_SEED_DIR = path.join(process.cwd(), 'data', 'knowledge')
const KNOWLEDGE_SEED_INDEX_FILE = path.join(process.cwd(), 'data', 'knowledge-index.json')

const SUPPORTED_TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.yml',
  '.yaml',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.rb',
  '.php',
  '.css',
  '.scss',
  '.html',
  '.sql',
  '.sh',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
])

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'were', 'your',
  'into', 'when', 'will', 'just', 'about', 'them', 'their', 'there', 'while',
  'what', 'which', 'where', 'after', 'before', 'they', 'then', 'than', 'does',
  'been', 'being', 'also', 'into', 'onto', 'over', 'under', 'very', 'more',
  'less', 'some', 'such', 'each', 'only', 'like', 'much', 'many', 'make',
  'made', 'need', 'needs', 'using', 'used', 'user', 'agent', 'session',
])

function defaultIndex(): KnowledgeIndex {
  return {
    version: 1,
    files: [],
    chunks: [],
    attachments: [],
  }
}

function extensionFor(name: string) {
  return path.extname(name).toLowerCase()
}

function isPdfFile(name: string, mimeType: string) {
  return extensionFor(name) === '.pdf' || mimeType === 'application/pdf'
}

function isTextLikeFile(name: string, mimeType: string) {
  const extension = extensionFor(name)
  return mimeType.startsWith('text/') || SUPPORTED_TEXT_EXTENSIONS.has(extension)
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1 && !STOP_WORDS.has(part))
}

function buildTermFreq(tokens: string[]) {
  const termFreq: Record<string, number> = {}
  for (const token of tokens) {
    termFreq[token] = (termFreq[token] || 0) + 1
  }
  return termFreq
}

function makePreview(text: string, max = 180) {
  return text.replace(/\s+/g, ' ').trim().slice(0, max)
}

function chunkText(text: string, maxChars = 900, overlap = 180) {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const chunks: string[] = []
  let start = 0

  while (start < normalized.length) {
    let end = Math.min(start + maxChars, normalized.length)
    if (end < normalized.length) {
      const breakIndex = normalized.lastIndexOf('\n', end)
      if (breakIndex > start + 240) end = breakIndex
    }
    const slice = normalized.slice(start, end).trim()
    if (slice) chunks.push(slice)
    if (end >= normalized.length) break
    start = Math.max(end - overlap, start + 1)
  }

  return chunks
}

async function readIndex() {
  for (const filePath of [KNOWLEDGE_INDEX_FILE, KNOWLEDGE_SEED_INDEX_FILE]) {
    try {
      const raw = JSON.parse(await readFile(filePath, 'utf-8')) as Partial<KnowledgeIndex>
      return {
        version: 1,
        files: Array.isArray(raw.files) ? raw.files : [],
        chunks: Array.isArray(raw.chunks) ? raw.chunks : [],
        attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
      } satisfies KnowledgeIndex
    } catch {
      // continue
    }
  }

  return defaultIndex()
}

async function writeIndex(index: KnowledgeIndex) {
  await mkdir(path.dirname(KNOWLEDGE_INDEX_FILE), { recursive: true })
  await writeFile(KNOWLEDGE_INDEX_FILE, JSON.stringify(index, null, 2))
}

function safeStoredName(name: string, id: string) {
  const extension = extensionFor(name)
  const base = path.basename(name, extension).replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').slice(0, 48)
  return `${base || 'knowledge'}-${id}${extension || '.txt'}`
}

async function extractText(name: string, mimeType: string, buffer: Buffer) {
  if (isPdfFile(name, mimeType)) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    try {
      const parsed = await parser.getText()
      return parsed.text || ''
    } finally {
      await parser.destroy().catch(() => {})
    }
  }

  if (isTextLikeFile(name, mimeType)) {
    return buffer.toString('utf-8')
  }

  throw new Error('Unsupported file type. Upload PDF, TXT, Markdown, or code files.')
}

export async function listKnowledgeBase() {
  const index = await readIndex()
  return {
    files: index.files.sort((left, right) => new Date(right.addedAt).getTime() - new Date(left.addedAt).getTime()),
    attachments: index.attachments.sort((left, right) => new Date(right.attachedAt).getTime() - new Date(left.attachedAt).getTime()),
    summary: {
      fileCount: index.files.length,
      chunkCount: index.chunks.length,
    },
  }
}

export async function addKnowledgeFiles(files: Array<{ name: string; mimeType: string; buffer: Buffer }>) {
  const index = await readIndex()
  await mkdir(KNOWLEDGE_DIR, { recursive: true })
  await mkdir(KNOWLEDGE_SEED_DIR, { recursive: true })

  const added: KnowledgeFileRecord[] = []

  for (const file of files) {
    const text = await extractText(file.name, file.mimeType, file.buffer)
    const tokens = tokenize(text)
    const id = randomUUID()
    const storedName = safeStoredName(file.name, id)
    const chunks = chunkText(text).map((content, order) => {
      const chunkTokens = tokenize(content)
      return {
        id: randomUUID(),
        fileId: id,
        order,
        content,
        termFreq: buildTermFreq(chunkTokens),
      } satisfies KnowledgeChunk
    })

    const record: KnowledgeFileRecord = {
      id,
      name: file.name,
      storedName,
      mimeType: file.mimeType,
      extension: extensionFor(file.name),
      sizeBytes: file.buffer.byteLength,
      addedAt: new Date().toISOString(),
      chunkCount: chunks.length,
      tokenCount: tokens.length,
      preview: makePreview(text),
    }

    await writeFile(path.join(KNOWLEDGE_DIR, storedName), file.buffer)
    index.files.push(record)
    index.chunks.push(...chunks)
    added.push(record)
  }

  await writeIndex(index)

  return {
    added,
    summary: {
      fileCount: index.files.length,
      chunkCount: index.chunks.length,
    },
  }
}

export async function deleteKnowledgeFile(fileId: string) {
  const index = await readIndex()
  const target = index.files.find((file) => file.id === fileId)
  if (!target) return false

  index.files = index.files.filter((file) => file.id !== fileId)
  index.chunks = index.chunks.filter((chunk) => chunk.fileId !== fileId)
  index.attachments = index.attachments
    .map((attachment) => ({
      ...attachment,
      fileIds: attachment.fileIds.filter((id) => id !== fileId),
    }))
    .filter((attachment) => attachment.fileIds.length > 0)

  await writeIndex(index)

  try {
    await rm(path.join(KNOWLEDGE_DIR, target.storedName), { force: true })
  } catch {
    // ignore delete mismatch
  }

  return true
}

export async function searchKnowledge(query: string, limit = 12): Promise<KnowledgeSearchResult[]> {
  const index = await readIndex()
  const queryTerms = tokenize(query)
  if (queryTerms.length === 0) return []

  const totalChunks = Math.max(index.chunks.length, 1)
  const docFrequency = new Map<string, number>()

  for (const chunk of index.chunks) {
    const uniqueTerms = new Set(Object.keys(chunk.termFreq))
    for (const term of queryTerms) {
      if (uniqueTerms.has(term)) {
        docFrequency.set(term, (docFrequency.get(term) || 0) + 1)
      }
    }
  }

  const results = index.chunks
    .map((chunk) => {
      let score = 0
      for (const term of queryTerms) {
        const tf = chunk.termFreq[term] || 0
        if (!tf) continue
        const df = docFrequency.get(term) || 1
        const idf = Math.log((totalChunks + 1) / df)
        score += tf * (idf + 1)
      }

      if (score <= 0) return null
      const file = index.files.find((entry) => entry.id === chunk.fileId)
      if (!file) return null

      return {
        fileId: chunk.fileId,
        fileName: file.name,
        chunkId: chunk.id,
        score: Number(score.toFixed(3)),
        snippet: makePreview(chunk.content, 240),
        chunkOrder: chunk.order,
      } satisfies KnowledgeSearchResult
    })
    .filter((result): result is KnowledgeSearchResult => result !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)

  return results
}

export async function attachKnowledgeToAgent(input: {
  fileIds: string[]
  agentId: string
  sessionKey?: string
}) {
  const index = await readIndex()
  const fileIds = input.fileIds.filter((id) => index.files.some((file) => file.id === id))
  if (fileIds.length === 0) {
    throw new Error('Select at least one indexed file to attach.')
  }

  const agentId = input.agentId.trim()
  if (!agentId) {
    throw new Error('Agent is required.')
  }

  const sessionKey = input.sessionKey?.trim() || undefined
  const existing = index.attachments.find(
    (attachment) => attachment.agentId === agentId && (attachment.sessionKey || '') === (sessionKey || ''),
  )

  if (existing) {
    existing.fileIds = Array.from(new Set([...existing.fileIds, ...fileIds]))
    existing.attachedAt = new Date().toISOString()
  } else {
    index.attachments.unshift({
      id: randomUUID(),
      fileIds,
      agentId,
      sessionKey,
      attachedAt: new Date().toISOString(),
    })
  }

  await writeIndex(index)
  return index.attachments
}

export async function detachKnowledgeAttachment(attachmentId: string) {
  const index = await readIndex()
  const before = index.attachments.length
  index.attachments = index.attachments.filter((attachment) => attachment.id !== attachmentId)
  if (index.attachments.length === before) return false
  await writeIndex(index)
  return true
}

export async function getKnowledgeDownload(fileId: string) {
  const index = await readIndex()
  const file = index.files.find((entry) => entry.id === fileId)
  if (!file) return null

  const buffer = await readFile(path.join(KNOWLEDGE_DIR, file.storedName))
  return {
    file,
    buffer,
  }
}

export async function ensureKnowledgeSeedFiles() {
  await mkdir(KNOWLEDGE_SEED_DIR, { recursive: true })
}
