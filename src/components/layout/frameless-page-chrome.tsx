"use client"

import { useEffect, useState } from 'react'
import { WindowControls } from './window-controls'

type ElectronAPI = {
  getPlatform?: () => Promise<string>
}

export function FramelessPageChrome({ title = 'Mission Control' }: { title?: string }) {
  const [platform, setPlatform] = useState<string | null>(null)

  useEffect(() => {
    const electronAPI = (window as Window & { electronAPI?: ElectronAPI }).electronAPI

    if (!electronAPI?.getPlatform) return

    electronAPI.getPlatform()
      .then(setPlatform)
      .catch(() => setPlatform(null))
  }, [])

  if (platform === 'darwin' || platform === null) return null

  return (
    <div className="absolute inset-x-0 top-0 z-20 h-12 px-4 flex items-center justify-between electron-drag border-b border-white/[0.04] bg-[var(--background)]/75 backdrop-blur-md">
      <span className="text-[13px] font-medium text-[var(--text-muted)]/70 select-none">
        {title}
      </span>
      <WindowControls className="flex items-center -mr-2 electron-no-drag" />
    </div>
  )
}
