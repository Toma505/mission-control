import { randomUUID } from 'crypto'

import { NextRequest, NextResponse } from 'next/server'
import { validate as validateCronExpression } from 'node-cron'

import { appendAudit } from '@/app/api/audit-log/route'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { pushNotification } from '@/lib/notifications-store'
import { sanitizeError } from '@/lib/sanitize-error'
import {
  computeNextRunAt,
  describeCron,
  executeScheduleTask,
  getRunsForTask,
  getScheduleInstances,
  readScheduleRuns,
  readSchedules,
  writeScheduleRuns,
  writeSchedules,
  type ScheduledTask,
} from '@/lib/schedules'

function serializeTask(task: ScheduledTask) {
  return {
    ...task,
    humanReadable: describeCron(task.cronExpression),
    nextRunAt: task.enabled ? computeNextRunAt(task.cronExpression) : null,
  }
}

async function buildPayload() {
  const [scheduleStore, runStore, instances] = await Promise.all([
    readSchedules(),
    readScheduleRuns(),
    getScheduleInstances(),
  ])

  return {
    tasks: scheduleStore.tasks
      .map((task) => ({
        ...serializeTask(task),
        runs: getRunsForTask(runStore.runs, task.id),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    instances,
  }
}

function validateTaskInput(body: Record<string, unknown>) {
  const name = String(body.name || '').trim()
  const cronExpression = String(body.cronExpression || '').trim()
  const targetInstanceId = String(body.targetInstanceId || '').trim()
  const command = String(body.command || '').trim()
  const prompt = String(body.prompt || '').trim()
  const enabled = body.enabled !== false

  if (!name || !cronExpression || !targetInstanceId || !command) {
    return { error: 'Name, cron expression, target instance, and command are required.' }
  }

  if (!validateCronExpression(cronExpression)) {
    return { error: 'Cron expression is invalid.' }
  }

  return {
    value: {
      id: typeof body.id === 'string' ? body.id : randomUUID(),
      name,
      cronExpression,
      targetInstanceId,
      command,
      prompt,
      enabled,
      createdAt: typeof body.createdAt === 'string' ? body.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies ScheduledTask,
  }
}

export async function GET() {
  try {
    return NextResponse.json(await buildPayload())
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to load scheduled tasks.') },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const action = typeof body.action === 'string' ? body.action : 'create'
    const [scheduleStore, instances] = await Promise.all([readSchedules(), getScheduleInstances()])

    if (action === 'create') {
      const result = validateTaskInput(body)
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      if (!instances.some((instance) => instance.id === result.value.targetInstanceId)) {
        return NextResponse.json({ error: 'Target instance not found.' }, { status: 400 })
      }

      scheduleStore.tasks.push({
        ...result.value,
        lastRunAt: null,
        lastStatus: null,
        lastDurationMs: null,
        lastOutputSummary: null,
        nextRunAt: result.value.enabled ? computeNextRunAt(result.value.cronExpression) : null,
      })

      await writeSchedules(scheduleStore)
      appendAudit('Scheduled task created', 'system', `${result.value.name} (${result.value.cronExpression})`)
      return NextResponse.json({ ok: true, payload: await buildPayload() })
    }

    const taskId = typeof body.id === 'string' ? body.id : ''
    const taskIndex = scheduleStore.tasks.findIndex((task) => task.id === taskId)

    if (taskIndex === -1) {
      return NextResponse.json({ error: 'Scheduled task not found.' }, { status: 404 })
    }

    const currentTask = scheduleStore.tasks[taskIndex]

    if (action === 'update') {
      const result = validateTaskInput({
        ...currentTask,
        ...body,
        id: currentTask.id,
        createdAt: currentTask.createdAt,
      })
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      if (!instances.some((instance) => instance.id === result.value.targetInstanceId)) {
        return NextResponse.json({ error: 'Target instance not found.' }, { status: 400 })
      }

      scheduleStore.tasks[taskIndex] = {
        ...currentTask,
        ...result.value,
        nextRunAt: result.value.enabled ? computeNextRunAt(result.value.cronExpression) : null,
      }

      await writeSchedules(scheduleStore)
      appendAudit('Scheduled task updated', 'system', `${result.value.name} (${result.value.cronExpression})`)
      return NextResponse.json({ ok: true, payload: await buildPayload() })
    }

    if (action === 'toggle') {
      const nextEnabled = typeof body.enabled === 'boolean' ? body.enabled : !currentTask.enabled
      scheduleStore.tasks[taskIndex] = {
        ...currentTask,
        enabled: nextEnabled,
        updatedAt: new Date().toISOString(),
        nextRunAt: nextEnabled ? computeNextRunAt(currentTask.cronExpression) : null,
      }

      await writeSchedules(scheduleStore)
      appendAudit(
        'Scheduled task toggled',
        'system',
        `${currentTask.name} ${nextEnabled ? 'enabled' : 'disabled'}`
      )
      return NextResponse.json({ ok: true, payload: await buildPayload() })
    }

    if (action === 'delete') {
      const [removed] = scheduleStore.tasks.splice(taskIndex, 1)
      await writeSchedules(scheduleStore)
      appendAudit('Scheduled task deleted', 'system', removed.name)
      return NextResponse.json({ ok: true, payload: await buildPayload() })
    }

    if (action === 'runNow' || action === 'execute') {
      const source = action === 'execute' ? 'scheduler' : 'manual'
      const runStore = await readScheduleRuns()
      const result = await executeScheduleTask(currentTask)
      scheduleStore.tasks[taskIndex] = result.task
      runStore.runs.unshift(result.run)
      runStore.runs = runStore.runs.slice(0, 500)

      await Promise.all([writeSchedules(scheduleStore), writeScheduleRuns(runStore)])

      appendAudit(
        source === 'manual' ? 'Scheduled task run manually' : 'Scheduled task executed',
        'system',
        `${currentTask.name} finished with ${result.run.status}`
      )

      if (result.run.status === 'error') {
        await pushNotification({
          type: 'schedule_fired',
          title: 'Scheduled task failed',
          message: `${currentTask.name}: ${result.run.outputSummary}`,
          href: '/schedules',
          source: 'schedules',
          outputSummary: result.run.outputSummary,
        }).catch(() => null)
      } else {
        await pushNotification({
          type: 'schedule_fired',
          title: 'Scheduled task completed',
          message: `${currentTask.name} finished in ${Math.max(1, Math.round(result.run.durationMs / 1000))}s`,
          href: '/schedules',
          source,
          outputSummary: result.run.outputSummary,
        }).catch(() => null)
      }

      return NextResponse.json({
        ok: true,
        run: result.run,
        payload: await buildPayload(),
      })
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Failed to update scheduled tasks.') },
      { status: 500 }
    )
  }
}
