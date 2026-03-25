import { BackupRestore } from '@/components/settings/backup-restore'

export default function BackupPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Backup & Restore</h1>
        <p className="text-sm text-text-muted mt-1">Export or import your Mission Control data</p>
      </div>
      <BackupRestore />
    </div>
  )
}
