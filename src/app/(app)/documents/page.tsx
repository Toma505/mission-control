import { FileText, Folder, File } from 'lucide-react'

interface Document {
  name: string
  size: string
  modified: string
  type: string
}

async function getDocuments(): Promise<{ connected: boolean; documents: Document[] }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000'
  try {
    const res = await fetch(`${baseUrl}/api/documents`, { cache: 'no-store' })
    if (!res.ok) return { connected: false, documents: [] }
    return await res.json()
  } catch {
    return { connected: false, documents: [] }
  }
}

function formatSize(size: string): string {
  const bytes = parseInt(size)
  if (isNaN(bytes)) return size
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function DocumentsPage() {
  const { connected, documents } = await getDocuments()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Documents</h1>
        <p className="text-sm text-text-secondary">
          Workspace files and documentation
          {connected && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-status-active">
              <span className="w-1.5 h-1.5 rounded-full bg-status-active animate-pulse" />
              OpenClaw connected
            </span>
          )}
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-2xl bg-background-elevated mb-4">
            <FileText className="w-8 h-8 text-text-muted" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">No documents yet</h2>
          <p className="text-sm text-text-secondary max-w-md">
            {connected
              ? 'No files in the workspace directory. Documents will appear here as your agents create them.'
              : 'Connect OpenClaw to see workspace files here.'}
          </p>
        </div>
      ) : (
        <>
          <div className="glass rounded-2xl p-5">
            <p className="text-xs text-text-muted mb-1">Workspace Files</p>
            <p className="text-2xl font-bold text-text-primary">{documents.length}</p>
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-text-primary">Files</span>
                <span className="text-xs text-text-muted">/data/workspace</span>
              </div>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {documents.map((doc) => (
                <div key={doc.name} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                  {doc.type === 'folder' ? (
                    <Folder className="w-4 h-4 text-accent-highlight" />
                  ) : (
                    <File className="w-4 h-4 text-text-muted" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{doc.name}</p>
                    <p className="text-xs text-text-muted">{doc.modified}</p>
                  </div>
                  <span className="text-xs text-text-muted">{formatSize(doc.size)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
