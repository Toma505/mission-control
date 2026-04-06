import { readFile } from 'fs/promises'
import path from 'path'

import { NextRequest, NextResponse } from 'next/server'

import { DATA_DIR } from '@/lib/connection-config'
import { isLegacyInternalWorkflowExecution } from '@/lib/legacy-demo-data'
import { sanitizeError } from '@/lib/sanitize-error'
import type { WorkflowExecutionRecord } from '@/lib/workflow-engine'

const WORKFLOW_HISTORY_FILE = path.join(DATA_DIR, 'workflow-history.json')

interface WorkflowHistoryStore {
  executions: WorkflowExecutionRecord[]
}

async function readHistoryStore(): Promise<WorkflowHistoryStore> {
  try {
    const text = await readFile(WORKFLOW_HISTORY_FILE, 'utf-8')
    const parsed = JSON.parse(text) as { executions?: WorkflowExecutionRecord[] }
    const executions = Array.isArray(parsed.executions) ? parsed.executions : []
    return {
      executions: executions.filter((execution) => !isLegacyInternalWorkflowExecution(execution)),
    }
  } catch {
    return { executions: [] }
  }
}

export async function GET(request: NextRequest) {
  try {
    const store = await readHistoryStore()
    const workflowId = request.nextUrl.searchParams.get('workflowId')
    const limitValue = request.nextUrl.searchParams.get('limit')
    const limit = Math.max(1, Math.min(Number(limitValue) || 50, 200))

    const executions = workflowId
      ? store.executions.filter((execution) => execution.workflowId === workflowId)
      : store.executions

    return NextResponse.json({
      executions: executions.slice(-limit).reverse(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to read workflow history') },
      { status: 500 }
    )
  }
}
