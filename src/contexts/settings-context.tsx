'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import { apiFetch } from '@/lib/api-client'
import {
  ACCENT_COLORS,
  DEFAULT_SETTINGS,
  FONT_SIZES,
  THEME_VARS,
  type AccentColor,
  type FontSize,
  type RefreshInterval,
  type Settings,
  type Theme,
  type ThemeSchedule,
} from '@/lib/app-settings'

export type { Theme, AccentColor, FontSize, RefreshInterval, ThemeSchedule, Settings }

interface SettingsContextType {
  settings: Settings
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  applySettings: (next: Settings) => void
  resetSettings: () => void
  saveWarning: boolean
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [mounted, setMounted] = useState(false)
  const [saveWarning, setSaveWarning] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      try {
        const response = await fetch('/api/settings', { cache: 'no-store' })
        const data = await response.json().catch(() => null)
        if (!cancelled && response.ok && data?.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[settings] Could not load persisted settings:', error)
          setSaveWarning(true)
        }
      } finally {
        if (!cancelled) {
          setMounted(true)
        }
      }
    }

    void loadSettings()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    const themeVars = THEME_VARS[settings.theme]

    for (const [key, value] of Object.entries(themeVars)) {
      root.style.setProperty(key, value)
    }

    const accent = ACCENT_COLORS[settings.accentColor]
    root.style.setProperty('--accent-primary', accent.primary)
    root.style.setProperty('--accent-secondary', accent.secondary)
    root.style.setProperty('--accent-highlight', accent.highlight)
    root.style.fontSize = FONT_SIZES[settings.fontSize]

    if (!settings.animationsEnabled) {
      root.style.setProperty('--transition-duration', '0ms')
      root.classList.add('no-animations')
    } else {
      root.style.setProperty('--transition-duration', '200ms')
      root.classList.remove('no-animations')
    }

    if (settings.compactMode) {
      root.classList.add('compact')
    } else {
      root.classList.remove('compact')
    }

    if (settings.theme === 'light') {
      root.classList.remove('dark')
    } else {
      root.classList.add('dark')
    }

    root.dataset.theme = settings.theme
  }, [mounted, settings])

  useEffect(() => {
    if (!mounted || !settings.themeSchedule?.enabled) return

    function checkSchedule() {
      const { lightStart, darkStart, lightTheme, darkTheme } = settings.themeSchedule
      const now = new Date()
      const mins = now.getHours() * 60 + now.getMinutes()
      const [lh, lm] = lightStart.split(':').map(Number)
      const [dh, dm] = darkStart.split(':').map(Number)
      const lightMins = lh * 60 + lm
      const darkMins = dh * 60 + dm

      const shouldBeLight = lightMins < darkMins
        ? mins >= lightMins && mins < darkMins
        : mins >= lightMins || mins < darkMins

      const target = shouldBeLight ? lightTheme : darkTheme
      if (target !== settings.theme) {
        updateSetting('theme', target)
      }
    }

    checkSchedule()
    const interval = setInterval(checkSchedule, 60_000)
    return () => clearInterval(interval)
  }, [mounted, settings.themeSchedule]) // eslint-disable-line react-hooks/exhaustive-deps

  async function persistSettings(next: Settings) {
    try {
      const response = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })

      if (!response.ok) {
        throw new Error('Save failed')
      }

      setSaveWarning(false)
    } catch (error) {
      console.warn('[settings] Could not persist settings:', error)
      setSaveWarning(true)
    }
  }

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => {
      const next = { ...current, [key]: value }
      void persistSettings(next)
      return next
    })
  }

  function applySettings(next: Settings) {
    setSettings(next)
    void persistSettings(next)
  }

  function resetSettings() {
    setSettings(DEFAULT_SETTINGS)
    void persistSettings(DEFAULT_SETTINGS)
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, applySettings, resetSettings, saveWarning }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
