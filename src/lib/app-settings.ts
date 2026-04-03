export type Theme = 'dark' | 'midnight' | 'light'
export type AccentColor = 'blue' | 'purple' | 'cyan' | 'green' | 'orange' | 'rose'
export type SidebarPosition = 'left' | 'right'
export type FontSize = 'small' | 'medium' | 'large'
export type RefreshInterval = 15 | 30 | 60 | 120

export interface ThemeSchedule {
  enabled: boolean
  lightTheme: Theme
  darkTheme: Theme
  lightStart: string
  darkStart: string
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
  onboardingComplete: boolean
  lastSeenVersion: string | null
  themeSchedule: ThemeSchedule
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  accentColor: 'blue',
  sidebarPosition: 'left',
  sidebarCollapsed: false,
  fontSize: 'medium',
  refreshInterval: 30,
  animationsEnabled: true,
  compactMode: false,
  onboardingComplete: false,
  lastSeenVersion: null,
  themeSchedule: {
    enabled: false,
    lightTheme: 'light',
    darkTheme: 'dark',
    lightStart: '07:00',
    darkStart: '19:00',
  },
}

export const ACCENT_COLORS: Record<AccentColor, { primary: string; secondary: string; highlight: string }> = {
  blue: { primary: '#3b82f6', secondary: '#8b5cf6', highlight: '#06b6d4' },
  purple: { primary: '#8b5cf6', secondary: '#a855f7', highlight: '#c084fc' },
  cyan: { primary: '#06b6d4', secondary: '#0ea5e9', highlight: '#22d3ee' },
  green: { primary: '#10b981', secondary: '#34d399', highlight: '#6ee7b7' },
  orange: { primary: '#f97316', secondary: '#fb923c', highlight: '#fdba74' },
  rose: { primary: '#f43f5e', secondary: '#fb7185', highlight: '#fda4af' },
}

export const THEME_VARS: Record<Theme, Record<string, string>> = {
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

export const FONT_SIZES: Record<FontSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
}

export function normalizeSettings(input: unknown): Settings {
  const value = (input && typeof input === 'object' ? input : {}) as Partial<Settings>
  const schedule: Partial<ThemeSchedule> =
    value.themeSchedule && typeof value.themeSchedule === 'object'
      ? value.themeSchedule
      : {}

  return {
    theme: value.theme === 'midnight' || value.theme === 'light' ? value.theme : DEFAULT_SETTINGS.theme,
    accentColor:
      value.accentColor === 'purple' ||
      value.accentColor === 'cyan' ||
      value.accentColor === 'green' ||
      value.accentColor === 'orange' ||
      value.accentColor === 'rose'
        ? value.accentColor
        : DEFAULT_SETTINGS.accentColor,
    sidebarPosition: value.sidebarPosition === 'right' ? 'right' : DEFAULT_SETTINGS.sidebarPosition,
    sidebarCollapsed: value.sidebarCollapsed === true,
    fontSize:
      value.fontSize === 'small' || value.fontSize === 'large' ? value.fontSize : DEFAULT_SETTINGS.fontSize,
    refreshInterval:
      value.refreshInterval === 15 ||
      value.refreshInterval === 60 ||
      value.refreshInterval === 120
        ? value.refreshInterval
        : DEFAULT_SETTINGS.refreshInterval,
    animationsEnabled: value.animationsEnabled !== false,
    compactMode: value.compactMode === true,
<<<<<<< HEAD
    onboardingComplete: value.onboardingComplete === true,
    lastSeenVersion: typeof value.lastSeenVersion === 'string' && value.lastSeenVersion ? value.lastSeenVersion : null,
    themeSchedule: {
      enabled: schedule.enabled === true,
      lightTheme:
        schedule.lightTheme === 'dark' || schedule.lightTheme === 'midnight'
          ? schedule.lightTheme
          : DEFAULT_SETTINGS.themeSchedule.lightTheme,
      darkTheme:
        schedule.darkTheme === 'light' || schedule.darkTheme === 'midnight'
          ? schedule.darkTheme
          : DEFAULT_SETTINGS.themeSchedule.darkTheme,
      lightStart: typeof schedule.lightStart === 'string' && schedule.lightStart ? schedule.lightStart : DEFAULT_SETTINGS.themeSchedule.lightStart,
      darkStart: typeof schedule.darkStart === 'string' && schedule.darkStart ? schedule.darkStart : DEFAULT_SETTINGS.themeSchedule.darkStart,
    },
  }
}
