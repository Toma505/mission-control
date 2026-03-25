'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type Theme = 'dark' | 'midnight' | 'light'
export type AccentColor = 'blue' | 'purple' | 'cyan' | 'green' | 'orange' | 'rose'
export type SidebarPosition = 'left' | 'right'
export type FontSize = 'small' | 'medium' | 'large'
export type RefreshInterval = 15 | 30 | 60 | 120

export interface ThemeSchedule {
  enabled: boolean
  lightTheme: Theme
  darkTheme: Theme
  lightStart: string // "HH:MM" e.g. "07:00"
  darkStart: string  // "HH:MM" e.g. "19:00"
}

export interface Settings {
  theme: Theme
  accentColor: AccentColor
  sidebarPosition: SidebarPosition
  sidebarCollapsed: boolean
  fontSize: FontSize
  refreshInterval: RefreshInterval
  animationsEnabled: boolean
  compactMode: boolean
  themeSchedule: ThemeSchedule
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  accentColor: 'blue',
  sidebarPosition: 'left',
  sidebarCollapsed: false,
  fontSize: 'medium',
  refreshInterval: 30,
  animationsEnabled: true,
  compactMode: false,
  themeSchedule: {
    enabled: false,
    lightTheme: 'light',
    darkTheme: 'dark',
    lightStart: '07:00',
    darkStart: '19:00',
  },
}

interface SettingsContextType {
  settings: Settings
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  resetSettings: () => void
  /** True if the last save attempt failed (e.g., localStorage quota exceeded). Settings still apply for the current session. */
  saveWarning: boolean
}

const SettingsContext = createContext<SettingsContextType | null>(null)

const ACCENT_COLORS: Record<AccentColor, { primary: string; secondary: string; highlight: string }> = {
  blue:   { primary: '#3b82f6', secondary: '#8b5cf6', highlight: '#06b6d4' },
  purple: { primary: '#8b5cf6', secondary: '#a855f7', highlight: '#c084fc' },
  cyan:   { primary: '#06b6d4', secondary: '#0ea5e9', highlight: '#22d3ee' },
  green:  { primary: '#10b981', secondary: '#34d399', highlight: '#6ee7b7' },
  orange: { primary: '#f97316', secondary: '#fb923c', highlight: '#fdba74' },
  rose:   { primary: '#f43f5e', secondary: '#fb7185', highlight: '#fda4af' },
}

const THEME_VARS: Record<Theme, Record<string, string>> = {
  dark: {
    '--background': '#09090b',
    '--background-secondary': '#0f0f12',
    '--background-card': '#161618',
    '--background-elevated': '#1e1e21',
    '--border': '#2a2a2e',
    '--text-primary': '#ececef',
    '--text-secondary': '#87878f',
    '--text-muted': '#55555e',
    '--glass-bg': 'rgba(20, 20, 23, 0.6)',
    '--glass-bg-hover': 'rgba(28, 28, 32, 0.7)',
    '--glass-border': 'rgba(255, 255, 255, 0.06)',
    '--glass-border-hover': 'rgba(255, 255, 255, 0.1)',
    '--glass-shadow': '0 2px 20px rgba(0, 0, 0, 0.25), 0 0 1px rgba(255, 255, 255, 0.04) inset',
    '--sidebar-bg': 'rgba(12, 12, 14, 0.85)',
  },
  midnight: {
    '--background': '#020617',
    '--background-secondary': '#0f172a',
    '--background-card': '#1e293b',
    '--background-elevated': '#334155',
    '--border': '#334155',
    '--text-primary': '#f1f5f9',
    '--text-secondary': '#94a3b8',
    '--text-muted': '#64748b',
    '--glass-bg': 'rgba(15, 23, 42, 0.7)',
    '--glass-bg-hover': 'rgba(30, 41, 59, 0.7)',
    '--glass-border': 'rgba(148, 163, 184, 0.08)',
    '--glass-border-hover': 'rgba(148, 163, 184, 0.15)',
    '--glass-shadow': '0 2px 20px rgba(0, 0, 0, 0.4), 0 0 1px rgba(148, 163, 184, 0.05) inset',
    '--sidebar-bg': 'rgba(2, 6, 23, 0.9)',
  },
  light: {
    '--background': '#f8fafc',
    '--background-secondary': '#f1f5f9',
    '--background-card': '#ffffff',
    '--background-elevated': '#e2e8f0',
    '--border': '#cbd5e1',
    '--text-primary': '#0f172a',
    '--text-secondary': '#334155',
    '--text-muted': '#64748b',
    '--glass-bg': 'rgba(255, 255, 255, 0.8)',
    '--glass-bg-hover': 'rgba(241, 245, 249, 0.9)',
    '--glass-border': 'rgba(0, 0, 0, 0.1)',
    '--glass-border-hover': 'rgba(0, 0, 0, 0.15)',
    '--glass-shadow': '0 2px 20px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.06) inset',
    '--sidebar-bg': 'rgba(248, 250, 252, 0.95)',
  },
}

const FONT_SIZES: Record<FontSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mc-settings')
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) })
      }
    } catch {}
    setMounted(true)
  }, [])

  // Apply settings to DOM
  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement

    // Apply theme CSS vars
    const themeVars = THEME_VARS[settings.theme]
    for (const [key, value] of Object.entries(themeVars)) {
      root.style.setProperty(key, value)
    }

    // Apply accent color
    const accent = ACCENT_COLORS[settings.accentColor]
    root.style.setProperty('--accent-primary', accent.primary)
    root.style.setProperty('--accent-secondary', accent.secondary)
    root.style.setProperty('--accent-highlight', accent.highlight)

    // Apply font size
    root.style.fontSize = FONT_SIZES[settings.fontSize]

    // Apply animations
    if (!settings.animationsEnabled) {
      root.style.setProperty('--transition-duration', '0ms')
      root.classList.add('no-animations')
    } else {
      root.style.setProperty('--transition-duration', '200ms')
      root.classList.remove('no-animations')
    }

    // Compact mode
    if (settings.compactMode) {
      root.classList.add('compact')
    } else {
      root.classList.remove('compact')
    }

    // Light mode class toggle for Tailwind
    if (settings.theme === 'light') {
      root.classList.remove('dark')
    } else {
      root.classList.add('dark')
    }

    // Scrollbar styling for light mode
    root.dataset.theme = settings.theme
  }, [settings, mounted])

  // Theme schedule: auto-switch based on time of day
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

  const [saveWarning, setSaveWarning] = useState(false)

  function persistSettings(data: Settings) {
    try {
      localStorage.setItem('mc-settings', JSON.stringify(data))
      setSaveWarning(false)
    } catch (e) {
      // localStorage quota exceeded or unavailable (incognito, disabled, etc.)
      // Settings still apply for this session — just won't persist across restarts
      console.warn('[settings] Could not save to localStorage:', e)
      setSaveWarning(true)
    }
  }

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      persistSettings(next)
      return next
    })
  }

  function resetSettings() {
    setSettings(DEFAULT_SETTINGS)
    persistSettings(DEFAULT_SETTINGS)
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings, saveWarning }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
