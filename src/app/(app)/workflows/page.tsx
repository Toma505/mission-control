'use client'

import { useState } from 'react'
import { WorkflowList } from '@/components/workflows/workflow-list'
import { WorkflowCanvas } from '@/components/workflows/workflow-canvas'

export default function WorkflowsPage() {
  const [editing, setEditing] = useState<string | null | undefined>(undefined)

  // undefined = list view, null = new workflow, string = edit existing
  if (editing !== undefined) {
    return (
      <div className="h-[calc(100vh-4rem)]">
        <WorkflowCanvas
          workflowId={editing || undefined}
          onBack={() => setEditing(undefined)}
        />
      </div>
    )
  }

  return <WorkflowList onEdit={(id) => setEditing(id ?? null)} />
}
