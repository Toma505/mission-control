"use client"

import { Search, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Notifications } from './notifications'
import { CommandPalette } from './command-palette'
import { PreferencesModal } from './preferences-modal'
import { ProfileMenu } from './profile-menu'
import { WindowControls } from './window-controls'
import { BackButton } from './back-button'

export function Header() {
  const [prefsOpen, setPrefsOpen] = useState(false)

  useEffect(() => {
    const handler = () => setPrefsOpen(true)
    window.addEventListener('open-preferences', handler)
    return () => window.removeEventListener('open-preferences', handler)
  }, [])

  function openPalette() {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
  }

  return (
    <>
      <CommandPalette />
      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
      <header className="h-12 px-6 flex items-center justify-between relative shrink-0 electron-drag">
        {/* Centered app name */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <span className="text-[13px] font-medium text-[var(--text-muted)]/60 tracking-normal select-none">Mission Control</span>
        </div>

        <div className="electron-no-drag">
          <BackButton fallbackHref="/" variant="header" />
        </div>

        {/* Right-side actions */}
        <div className="flex items-center gap-2 electron-no-drag">
          {/* Search trigger */}
          <button
            onClick={openPalette}
            className="flex items-center gap-2 pl-3 pr-2 py-1 glass-inset rounded-lg text-[13px] text-[var(--text-muted)]/50 hover:text-[var(--text-muted)]/70 hover:bg-white/[0.04] transition-all duration-200 w-48"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="px-1.5 py-0.5 rounded text-[10px] font-medium text-[var(--text-muted)]/40 bg-white/[0.04] border border-white/[0.06]">
              Ctrl+K
            </kbd>
          </button>

          {/* Notifications */}
          <Notifications />

          {/* Preferences */}
          <button
            onClick={() => setPrefsOpen(true)}
            className="w-7 h-7 rounded-[8px] flex items-center justify-center hover:bg-white/[0.06] transition-all duration-200"
            title="Preferences"
          >
            <Settings className="w-[15px] h-[15px] text-[var(--text-muted)]" />
          </button>

          {/* Profile */}
          <ProfileMenu />

          {/* Window controls */}
          <WindowControls className="flex items-center ml-2 -mr-2" />
        </div>
      </header>
    </>
  )
}
