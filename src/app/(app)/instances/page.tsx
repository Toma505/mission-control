'use client'

import { InstanceManager } from '@/components/instances/instance-manager'

export default function InstancesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text-primary">Multi-Instance Dashboard</h2>
        <p className="text-sm text-text-muted mt-1">
          Connect and monitor multiple OpenClaw instances from one place
        </p>
      </div>
      <InstanceManager />
    </div>
  )
}
