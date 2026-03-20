import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import { NextRequest, NextResponse } from 'next/server'

import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { DATA_DIR } from '@/lib/connection-config'
import { sanitizeError } from '@/lib/sanitize-error'
import {
  createStarterWorkflowTemplates,
  executeWorkflow,
  normalizeWorkflow,
  type Workflow,
  type WorkflowExecutionRecord,
} from '@/lib/workflow-engine'

const WORKFLOWS_FILE = path.join(DATA_DIR, 'workflows.json')
const WORKFLOW_HISTORY_FILE = path.join(DATA_DIR, 'workflow-history.json')

interface WorkflowStore {
  workflows: Workflow[]
}

interface WorkflowHistoryStore {
  executions: WorkflowExecutionRecord[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readWorkflowStore(): Promise<WorkflowStore> {
  try {
    const text = await readFile(WORKFLOWS_FILE, 'utf-8')
    const parsed = JSON.parse(text) as { workflows?: unknown[] }
    const workflows = Array.isArray(parsed.workflows)
      ? parsed.workflows.map((workflow) => normalizeWorkflow(workflow))
      : createStarterWorkflowTemplates()

    return { workflows }
  } catch {
    return { workflows: createStarterWorkflowTemplates() }
  }
}

async function writeWorkflowStore(store: WorkflowStore) {
  await mkdir(path.dirname(WORKFLOWS_FILE), { recursive: true })
  await writeFile(
    WORKFLOWS_FILE,
    JSON.stringify(
      {
        workflows: store.workflows.map((workflow) => normalizeWorkflow(workflow)),
      },
      null,
      2
    )
  )
}

async function readHistoryStore(): Promise<WorkflowHistoryStore> {
  try {
    const text = await readFile(WORKFLOW_HISTORY_FILE, 'utf-8')
    const parsed = JSON.parse(text) as { executions?: WorkflowExecutionRecord[] }
    return { executions: Array.isArray(parsed.executions) ? parsed.executions : [] }
  } catch {
    return { executions: [] }
  }
}

async function appendHistory(entry: WorkflowExecutionRecord) {
  const store = await readHistoryStore()
  store.executions.push(entry)
  store.executions = store.executions.slice(-200)

  await mkdir(path.dirname(WORKFLOW_HISTORY_FILE), { recursive: true })
  await writeFile(WORKFLOW_HISTORY_FILE, JSON.stringify(store, null, 2))
}

export async function GET(request: NextRequest) {
  try {
    const store = await readWorkflowStore()
    const id = request.nextUrl.searchParams.get('id')

    if (id) {
      const workflow = store.workflows.find((item) => item.id === id)
      if (!workflow) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
      }
      return NextResponse.json({ workflow })
    }

    return NextResponse.json({ workflows: store.workflows })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to read workflows') },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const action = typeof body.action === 'string' ? body.action : ''
    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    const store = await readWorkflowStore()

    if (action === 'create') {
      const workflow = normalizeWorkflow(body.workflow)
      if (store.workflows.some((item) => item.id === workflow.id)) {
        return NextResponse.json({ error: 'Workflow id already exists' }, { status: 409 })
      }

      const created: Workflow = {
        ...workflow,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      store.workflows.push(created)
      await writeWorkflowStore(store)
      return NextResponse.json({ ok: true, workflow: created })
    }

    const workflowId = typeof body.id === 'string'
      ? body.id
      : typeof body.workflowId === 'string'
        ? body.workflowId
        : isRecord(body.workflow) && typeof body.workflow.id === 'string'
          ? body.workflow.id
          : ''

    if (action === 'update') {
      if (!workflowId) {
        return NextResponse.json({ error: 'Workflow id is required' }, { status: 400 })
      }

      const index = store.workflows.findIndex((item) => item.id === workflowId)
      if (index === -1) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
      }

      const current = store.workflows[index]
      const incoming = normalizeWorkflow({
        ...current,
        ...(isRecord(body.workflow) ? body.workflow : {}),
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      })

      store.workflows[index] = incoming
      await writeWorkflowStore(store)
      return NextResponse.json({ ok: true, workflow: incoming })
    }

    if (action === 'delete') {
      if (!workflowId) {
        return NextResponse.json({ error: 'Workflow id is required' }, { status: 400 })
      }

      const nextWorkflows = store.workflows.filter((item) => item.id !== workflowId)
      if (nextWorkflows.length === store.workflows.length) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
      }

      store.workflows = nextWorkflows
      await writeWorkflowStore(store)
      return NextResponse.json({ ok: true })
    }

    if (action === 'duplicate') {
      if (!workflowId) {
        return NextResponse.json({ error: 'Workflow id is required' }, { status: 400 })
      }

      const source = store.workflows.find((item) => item.id === workflowId)
      if (!source) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
      }

      const now = new Date().toISOString()
      const duplicate = normalizeWorkflow({
        ...source,
        id: `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `${source.name} (Copy)`,
        createdAt: now,
        updatedAt: now,
      })

      store.workflows.push(duplicate)
      await writeWorkflowStore(store)
      return NextResponse.json({ ok: true, workflow: duplicate })
    }

    if (action === 'toggle') {
      if (!workflowId) {
        return NextResponse.json({ error: 'Workflow id is required' }, { status: 400 })
      }

      const workflow = store.workflows.find((item) => item.id === workflowId)
      if (!workflow) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
      }

      workflow.enabled = typeof body.enabled === 'boolean' ? body.enabled : !workflow.enabled
      workflow.updatedAt = new Date().toISOString()
      await writeWorkflowStore(store)
      return NextResponse.json({ ok: true, workflow })
    }

    if (action === 'execute') {
      const workflow = isRecord(body.workflow)
        ? normalizeWorkflow(body.workflow)
        : store.workflows.find((item) => item.id === workflowId)

      if (!workflow) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
      }

      const triggerData = isRecord(body.triggerData) ? body.triggerData : {}
      const execution = await executeWorkflow(workflow, triggerData)
      await appendHistory(execution)

      return NextResponse.json({
        ok: true,
        execution,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to save workflow') },
      { status: 500 }
    )
  }
}
