'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'

type ExportType = 'costs' | 'usage' | 'operations' | 'all'
type ExportRange = '7d' | '30d' | '90d'

const RANGES: ExportRange[] = ['7d', '30d', '90d']

function getFilename(response: Response, fallback: string) {
  const contentDisposition = response.headers.get('Content-Disposition') || ''
  const match = contentDisposition.match(/filename="([^"]+)"/i)
  return match?.[1] || fallback
}

export function ExportButton({ type }: { type: ExportType }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string>('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2500)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleOutsideClick)
    }

    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  async function exportData(format: 'csv' | 'pdf', range: ExportRange) {
    setBusy(`${format}-${range}`)
    setNotice('')

    try {
      const url = `/api/export?type=${type}&format=${format}&range=${range}`

      if (format === 'csv') {
        const response = await fetch(url)
        if (!response.ok) throw new Error('Export failed')

        const blob = await response.blob()
        const link = document.createElement('a')
        const objectUrl = URL.createObjectURL(blob)
        link.href = objectUrl
        link.download = getFilename(response, `mission-control-${type}-${range}.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(objectUrl)
        setNotice('CSV downloaded')
      } else {
        const printWindow = window.open(url, '_blank', 'noopener,noreferrer')
        if (!printWindow) throw new Error('Print window blocked')
        setNotice('Opened print view')
      }

      setOpen(false)
    } catch {
      setNotice('Export failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="relative electron-no-drag" ref={ref}>
      <button
        onClick={() => setOpen((current) => !current)}
        className="glass hover:bg-[var(--glass-bg-hover)] inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-text-primary"
      >
        <Download className="w-4 h-4" />
        Export
      </button>

      {notice ? (
        <div className="absolute right-0 top-full mt-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-1.5 text-[11px] text-text-secondary shadow-lg backdrop-blur-xl">
          {notice}
        </div>
      ) : null}

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-[260px] rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3 shadow-2xl backdrop-blur-xl">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">CSV</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {RANGES.map((range) => (
                  <button
                    key={`csv-${range}`}
                    onClick={() => void exportData('csv', range)}
                    disabled={busy !== null}
                    className="glass flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs text-text-primary hover:bg-[var(--glass-bg-hover)] disabled:opacity-50"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    {busy === `csv-${range}` ? '...' : range}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">Print View</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {RANGES.map((range) => (
                  <button
                    key={`pdf-${range}`}
                    onClick={() => void exportData('pdf', range)}
                    disabled={busy !== null}
                    className="glass flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs text-text-primary hover:bg-[var(--glass-bg-hover)] disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {busy === `pdf-${range}` ? '...' : range}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
