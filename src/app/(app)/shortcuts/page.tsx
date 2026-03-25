import { ShortcutCustomizer } from '@/components/settings/shortcut-customizer'

export default function ShortcutsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Keyboard Shortcuts</h1>
        <p className="text-sm text-text-secondary">Customize key bindings for quick navigation and actions</p>
      </div>
      <ShortcutCustomizer />
    </div>
  )
}
