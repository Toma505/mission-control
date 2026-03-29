import { ShortcutCustomizer } from '@/components/settings/shortcut-customizer'

export default function SettingsShortcutsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Keyboard Shortcuts</h1>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary">
          Review every hotkey Mission Control ships with, then rebind the ones you want to make muscle memory.
        </p>
      </div>
      <ShortcutCustomizer />
    </div>
  )
}
