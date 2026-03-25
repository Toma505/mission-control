import { ConfigSnapshots } from '@/components/settings/config-snapshots'

export default function SnapshotsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Config Snapshots</h1>
        <p className="text-sm text-text-muted mt-1">Save and restore your OpenClaw configuration</p>
      </div>
      <ConfigSnapshots />
    </div>
  )
}
