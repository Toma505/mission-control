"use client"

import { Minus, Square, X } from 'lucide-react'

type ElectronAPI = {
  minimize?: () => void
  maximize?: () => void
  close?: () => void
}

export function WindowControls({ className = '' }: { className?: string }) {
  const electronAPI = (typeof window !== 'undefined'
    ? (window as Window & { electronAPI?: ElectronAPI }).electronAPI
    : undefined)

  return (
    <div className={className}>
      <button
        onClick={() => electronAPI?.minimize?.()}
        className="w-8 h-8 flex items-center justify-center hover:bg-white/[0.08] transition-colors rounded"
        title="Minimize"
      >
        <Minus className="w-3.5 h-3.5 text-[var(--text-muted)]" />
      </button>
      <button
        onClick={() => electronAPI?.maximize?.()}
        className="w-8 h-8 flex items-center justify-center hover:bg-white/[0.08] transition-colors rounded"
        title="Maximize"
      >
        <Square className="w-3 h-3 text-[var(--text-muted)]" />
      </button>
      <button
        onClick={() => electronAPI?.close?.()}
        className="w-8 h-8 flex items-center justify-center hover:bg-red-500/80 transition-colors rounded group"
        title="Close"
      >
        <X className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-white" />
      </button>
    </div>
  )
}
