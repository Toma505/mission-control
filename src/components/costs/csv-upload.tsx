'use client'

import { useState, useCallback } from 'react'
import { Upload, Check, AlertCircle } from 'lucide-react'

export function CsvUpload() {
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const handleUpload = useCallback(async (file: File) => {
    // Client-side validation
    if (file.size === 0) {
      setStatus('error')
      setMessage('The file is empty. Select a CSV with data.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setStatus('error')
      setMessage('File is too large (max 10 MB). Try exporting a shorter date range.')
      return
    }

    setStatus('uploading')
    setMessage('Processing...')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/costs/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setMessage(data.error || 'Upload failed')
        return
      }

      const provider = data.provider ? `${data.provider.charAt(0).toUpperCase()}${data.provider.slice(1)}` : ''
      if (data.type === 'costs') {
        setStatus('success')
        setMessage(`Imported ${data.days} days of ${provider} cost data. Total: $${data.total?.toFixed(2)}`)
      } else if (data.type === 'tokens') {
        setStatus('success')
        setMessage(`Imported ${data.rows} rows of ${provider} token data.`)
      }

      // Reload page after short delay to show new data
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      setStatus('error')
      if (!navigator.onLine) {
        setMessage('You appear to be offline. Reconnect and try again.')
      } else {
        setMessage('Could not reach the app server. Try restarting Mission Control.')
      }
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && file.name.endsWith('.csv')) {
        handleUpload(file)
      } else {
        setStatus('error')
        setMessage('Please drop a .csv file')
      }
    },
    [handleUpload]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleUpload(file)
    },
    [handleUpload]
  )

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`glass rounded-2xl p-6 border-2 border-dashed transition-all duration-200 text-center cursor-pointer ${
        dragging
          ? 'border-accent-primary bg-accent-primary/5'
          : 'border-white/[0.06] hover:border-white/[0.12]'
      }`}
      onClick={() => document.getElementById('csv-input')?.click()}
    >
      <input
        id="csv-input"
        type="file"
        accept=".csv"
        onChange={handleFileInput}
        className="hidden"
      />

      {status === 'idle' || status === 'uploading' ? (
        <>
          <Upload className="w-6 h-6 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-secondary">
            {status === 'uploading' ? 'Processing...' : 'Drop CSV here or click to upload'}
          </p>
          <p className="text-xs text-text-muted mt-1">
            Accepts cost or token CSVs from Anthropic or OpenAI
          </p>
        </>
      ) : status === 'success' ? (
        <>
          <Check className="w-6 h-6 text-status-active mx-auto mb-2" />
          <p className="text-sm text-status-active">{message}</p>
        </>
      ) : (
        <>
          <AlertCircle className="w-6 h-6 text-status-error mx-auto mb-2" />
          <p className="text-sm text-status-error">{message}</p>
          <button
            onClick={(e) => { e.stopPropagation(); setStatus('idle'); setMessage('') }}
            className="mt-2 px-3 py-1 rounded-lg bg-white/[0.06] text-xs text-text-secondary hover:bg-white/[0.1] transition-colors"
          >
            Try again
          </button>
        </>
      )}
    </div>
  )
}
