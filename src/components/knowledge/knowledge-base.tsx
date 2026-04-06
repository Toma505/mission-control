'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Database,
  Download,
  FileCode2,
  FileSearch,
  Loader2,
  Paperclip,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import type {
  KnowledgeAttachment,
  KnowledgeFileRecord,
  KnowledgeSearchResult,
} from '@/lib/knowledge-store'

interface KnowledgePayload {
  files: KnowledgeFileRecord[]
  attachments: KnowledgeAttachment[]
  summary: {
    fileCount: number
    chunkCount: number
  }
  results: KnowledgeSearchResult[]
}

interface AgentOption {
  name: string
  model: string
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

export function KnowledgeBase() {
  const [files, setFiles] = useState<KnowledgeFileRecord[]>([])
  const [attachments, setAttachments] = useState<KnowledgeAttachment[]>([])
  const [results, setResults] = useState<KnowledgeSearchResult[]>([])
  const [summary, setSummary] = useState({ fileCount: 0, chunkCount: 0 })
  const [agents, setAgents] = useState<AgentOption[]>([])
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [targetAgent, setTargetAgent] = useState('')
  const [sessionKey, setSessionKey] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedFiles = useMemo(
    () => files.filter((file) => selectedFileIds.includes(file.id)),
    [files, selectedFileIds],
  )

  async function loadKnowledge(queryOverride = '') {
    setLoading(true)
    setError(null)
    try {
      const search = queryOverride ? `?q=${encodeURIComponent(queryOverride)}` : ''
      const response = await apiFetch(`/api/knowledge${search}`, { cache: 'no-store' })
      const data = (await response.json()) as KnowledgePayload
      setFiles(Array.isArray(data.files) ? data.files : [])
      setAttachments(Array.isArray(data.attachments) ? data.attachments : [])
      setSummary(data.summary || { fileCount: 0, chunkCount: 0 })
      setResults(Array.isArray(data.results) ? data.results : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load knowledge base')
    } finally {
      setLoading(false)
    }
  }

  async function loadAgents() {
    try {
      const response = await fetch('/api/agents', { cache: 'no-store' })
      const data = await response.json()
      const nextAgents = Array.isArray(data.agents)
        ? data.agents.map((agent: { name?: string; model?: string }) => ({
            name: String(agent.name || 'unknown'),
            model: String(agent.model || ''),
          }))
        : []
      setAgents(nextAgents)
      if (!targetAgent && nextAgents[0]?.name) {
        setTargetAgent(nextAgents[0].name)
      }
    } catch {
      // ignore optional agent discovery failure
    }
  }

  useEffect(() => {
    void Promise.all([loadKnowledge(), loadAgents()])
  }, [])

  function toggleSelected(fileId: string) {
    setSelectedFileIds((current) =>
      current.includes(fileId)
        ? current.filter((id) => id !== fileId)
        : [...current, fileId],
    )
  }

  async function uploadFiles(list: FileList | File[]) {
    const filesToUpload = Array.from(list)
    if (filesToUpload.length === 0) return

    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      filesToUpload.forEach((file) => formData.append('files', file))

      const response = await apiFetch('/api/knowledge', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload files')
      }

      await loadKnowledge(query)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload files')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function runSearch() {
    setSearching(true)
    setError(null)
    try {
      await loadKnowledge(query.trim())
    } catch {
      // handled in loadKnowledge
    } finally {
      setSearching(false)
    }
  }

  async function attachSelected() {
    if (selectedFileIds.length === 0) {
      setError('Select at least one file to attach.')
      return
    }
    if (!targetAgent.trim()) {
      setError('Choose an agent before attaching context.')
      return
    }

    setAttaching(true)
    setError(null)
    try {
      const response = await apiFetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'attach',
          fileIds: selectedFileIds,
          agentId: targetAgent,
          sessionKey: sessionKey.trim() || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to attach knowledge')
      }
      setAttachments(Array.isArray(data.attachments) ? data.attachments : [])
      setSelectedFileIds([])
      setSessionKey('')
    } catch (attachError) {
      setError(attachError instanceof Error ? attachError.message : 'Failed to attach knowledge')
    } finally {
      setAttaching(false)
    }
  }

  async function removeFile(fileId: string) {
    setDeletingId(fileId)
    setError(null)
    try {
      const response = await apiFetch('/api/knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete file')
      }
      setSelectedFileIds((current) => current.filter((id) => id !== fileId))
      await loadKnowledge(query)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete file')
    } finally {
      setDeletingId(null)
    }
  }

  async function detach(attachmentId: string) {
    setError(null)
    try {
      const response = await apiFetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'detach', attachmentId }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to detach knowledge')
      }
      setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
    } catch (detachError) {
      setError(detachError instanceof Error ? detachError.message : 'Failed to detach knowledge')
    }
  }

  async function downloadFile(fileId: string) {
    setError(null)
    try {
      const response = await apiFetch(`/api/knowledge?download=${encodeURIComponent(fileId)}`)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Failed to download file',
        )
      }

      const disposition = response.headers.get('content-disposition') || ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const filename = match?.[1] || `knowledge-${fileId}`
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(downloadUrl)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Failed to download file')
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">
            <Database className="h-3.5 w-3.5 text-accent-primary" />
            Private local indexing
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Knowledge Base</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-secondary">
            Upload PDFs, notes, and code files, chunk and index them locally, then attach curated knowledge to an agent session without cloud sync.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.04] px-4 py-3 text-sm text-text-secondary">
            <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Files</div>
            <div className="mt-1 text-xl font-semibold text-text-primary">{summary.fileCount}</div>
          </div>
          <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.04] px-4 py-3 text-sm text-text-secondary">
            <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Indexed chunks</div>
            <div className="mt-1 text-xl font-semibold text-text-primary">{summary.chunkCount}</div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.08] px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              void uploadFiles(event.dataTransfer.files)
            }}
            className={`rounded-3xl border p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)] transition ${
              dragging
                ? 'border-accent-primary/50 bg-accent-primary/10'
                : 'border-[var(--glass-border)] bg-white/[0.04]'
            }`}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Upload local knowledge</h2>
                <p className="mt-1 text-xs text-text-muted">
                  PDF, TXT, Markdown, and common code files are chunked and indexed locally in `data/knowledge/`.
                </p>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-2xl bg-accent-primary px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                Upload files
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-[var(--glass-border)] bg-black/10 px-6 py-8 text-center">
              <UploadCloud className="mx-auto h-10 w-10 text-text-muted/40" />
              <p className="mt-3 text-sm font-medium text-text-primary">Drag files here to index locally</p>
              <p className="mt-1 text-sm text-text-muted">
                Nothing leaves the machine. We store files in `data/knowledge` and search against a local TF-IDF index.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(event) => {
                if (event.target.files) {
                  void uploadFiles(event.target.files)
                }
              }}
              className="hidden"
              accept=".pdf,.txt,.md,.markdown,.ts,.tsx,.js,.jsx,.json,.py,.go,.rs,.java,.rb,.php,.html,.css,.sql,.sh,.yml,.yaml"
            />
          </section>

          <section className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Search the knowledge base</h2>
                <p className="mt-1 text-xs text-text-muted">Run local relevance scoring across indexed chunks and inspect the best matching snippets.</p>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-3 py-2">
                <Search className="h-4 w-4 text-text-muted" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void runSearch()
                    }
                  }}
                  placeholder="Search docs, notes, or code"
                  className="w-56 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted/60"
                />
                <button
                  onClick={() => void runSearch()}
                  disabled={searching}
                  className="rounded-xl bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-text-primary transition hover:bg-white/[0.14] disabled:opacity-50"
                >
                  {searching ? 'Searching…' : 'Search'}
                </button>
              </div>
            </div>

            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-white/[0.02] px-4 py-8 text-center">
                <FileSearch className="mx-auto h-8 w-8 text-text-muted/30" />
                <p className="mt-3 text-sm text-text-muted">
                  {query.trim() ? 'No matching chunks yet. Try different terms or upload more files.' : 'Search results appear here once you run a query.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((result) => (
                  <div key={result.chunkId} className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-text-primary">{result.fileName}</div>
                        <div className="mt-1 text-xs text-text-muted">
                          Chunk {result.chunkOrder + 1} · score {result.score.toFixed(2)}
                        </div>
                      </div>
                      <div className="rounded-full border border-[var(--glass-border)] bg-white/[0.05] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-text-muted">
                        Relevance {result.score.toFixed(2)}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-text-secondary">{result.snippet}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Indexed files</h2>
                <p className="mt-1 text-xs text-text-muted">Select files to attach as session context or manage them one by one.</p>
              </div>
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-text-muted" /> : null}
            </div>

            {files.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-white/[0.02] px-4 py-8 text-center text-sm text-text-muted">
                No files indexed yet. Upload a document, PDF, or code file to start building local context.
              </div>
            ) : (
              <div className="space-y-3">
                {files.map((file) => {
                  const attachmentCount = attachments.filter((attachment) => attachment.fileIds.includes(file.id)).length
                  return (
                    <div key={file.id} className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <label className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedFileIds.includes(file.id)}
                            onChange={() => toggleSelected(file.id)}
                            className="mt-1 h-4 w-4 rounded border-[var(--glass-border)] bg-transparent"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <FileCode2 className="h-4 w-4 text-accent-primary" />
                              <div className="text-sm font-medium text-text-primary">{file.name}</div>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-text-muted">
                              <span>{formatBytes(file.sizeBytes)}</span>
                              <span>{file.extension || file.mimeType}</span>
                              <span>{file.chunkCount} chunks</span>
                              <span>{file.tokenCount} tokens</span>
                              <span>{formatDate(file.addedAt)}</span>
                              <span>{attachmentCount} attachment{attachmentCount === 1 ? '' : 's'}</span>
                            </div>
                            <p className="mt-2 text-sm text-text-secondary">{file.preview}</p>
                          </div>
                        </label>

                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => void downloadFile(file.id)}
                            className="inline-flex items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-white/[0.05] px-3 py-2 text-xs font-medium text-text-primary transition hover:bg-white/[0.1]"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </button>
                          <button
                            onClick={() => void removeFile(file.id)}
                            disabled={deletingId === file.id}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-xs font-medium text-red-100 transition hover:bg-red-500/[0.14] disabled:opacity-50"
                          >
                            {deletingId === file.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-accent-primary" />
              <h2 className="text-sm font-semibold text-text-primary">Attach to an agent session</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">Target agent</label>
                <select
                  value={targetAgent}
                  onChange={(event) => setTargetAgent(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3 text-sm text-text-primary outline-none"
                >
                  <option value="">Select an agent</option>
                  {agents.map((agent) => (
                    <option key={agent.name} value={agent.name}>
                      {agent.name} {agent.model ? `· ${agent.model}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] uppercase tracking-[0.14em] text-text-muted">Session key (optional)</label>
                <input
                  value={sessionKey}
                  onChange={(event) => setSessionKey(event.target.value)}
                  placeholder="agent:default:main"
                  className="w-full rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] px-4 py-3 text-sm text-text-primary outline-none"
                />
              </div>

              <div className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted">Selected files</div>
                {selectedFiles.length === 0 ? (
                  <p className="mt-2 text-sm text-text-muted">Choose one or more indexed files from the library first.</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedFiles.map((file) => (
                      <span key={file.id} className="inline-flex items-center gap-1 rounded-full border border-[var(--glass-border)] bg-white/[0.04] px-2.5 py-1 text-xs text-text-primary">
                        {file.name}
                        <button onClick={() => toggleSelected(file.id)} className="text-text-muted transition hover:text-text-primary">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => void attachSelected()}
                disabled={attaching || selectedFiles.length === 0 || !targetAgent}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent-primary px-4 py-3 text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {attaching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                Attach as context
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--glass-border)] bg-white/[0.04] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Current attachments</h2>
                <p className="mt-1 text-xs text-text-muted">Reusable context bundles saved locally and scoped per agent or session.</p>
              </div>
              <div className="rounded-full border border-[var(--glass-border)] bg-white/[0.05] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-text-muted">
                {attachments.length} active
              </div>
            </div>

            {attachments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--glass-border)] bg-white/[0.02] px-4 py-6 text-sm text-text-muted">
                No attachments yet. Select files and attach them to an agent when you want those documents to travel with a working session.
              </div>
            ) : (
              <div className="space-y-3">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="rounded-2xl border border-[var(--glass-border)] bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-text-primary">
                          {attachment.agentId}
                          {attachment.sessionKey ? <span className="text-text-muted"> · {attachment.sessionKey}</span> : null}
                        </div>
                        <div className="mt-1 text-xs text-text-muted">{formatDate(attachment.attachedAt)}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {attachment.fileIds.map((fileId) => {
                            const file = files.find((entry) => entry.id === fileId)
                            return (
                              <span key={fileId} className="rounded-full border border-[var(--glass-border)] bg-white/[0.04] px-2.5 py-1 text-xs text-text-primary">
                                {file?.name || fileId}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                      <button
                        onClick={() => void detach(attachment.id)}
                        className="rounded-xl border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-xs font-medium text-red-100 transition hover:bg-red-500/[0.14]"
                      >
                        Detach
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

