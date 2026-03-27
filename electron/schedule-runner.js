const fs = require('fs')
const path = require('path')
const cron = require('node-cron')

function createScheduleRunner({ getDataDir, getPort, getSessionToken, onRunResult }) {
  const scheduledJobs = new Map()
  const activeRuns = new Set()
  let reloadTimer = null
  let lastSignature = ''

  function getSchedulesPath() {
    return path.join(getDataDir(), 'schedules.json')
  }

  function readTasks() {
    try {
      const raw = JSON.parse(fs.readFileSync(getSchedulesPath(), 'utf-8'))
      return Array.isArray(raw?.tasks) ? raw.tasks : []
    } catch {
      return []
    }
  }

  function stopAllJobs() {
    for (const job of scheduledJobs.values()) {
      try { job.stop() } catch {}
      try { job.destroy() } catch {}
    }
    scheduledJobs.clear()
  }

  async function triggerTask(taskId) {
    if (!taskId || activeRuns.has(taskId)) return
    activeRuns.add(taskId)

    try {
      const response = await fetch(`http://127.0.0.1:${getPort()}/api/schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mc-token': getSessionToken(),
        },
        body: JSON.stringify({
          action: 'execute',
          id: taskId,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (typeof onRunResult === 'function') {
        onRunResult({
          ok: response.ok,
          taskId,
          payload,
        })
      }
    } catch (error) {
      if (typeof onRunResult === 'function') {
        onRunResult({
          ok: false,
          taskId,
          payload: { error: error instanceof Error ? error.message : 'Unknown schedule runner failure' },
        })
      }
    } finally {
      activeRuns.delete(taskId)
    }
  }

  function reloadSchedules() {
    const tasks = readTasks()
    const signature = JSON.stringify(
      tasks.map((task) => ({
        id: task.id,
        cronExpression: task.cronExpression,
        enabled: task.enabled,
      }))
    )

    if (signature === lastSignature) return
    lastSignature = signature

    stopAllJobs()

    for (const task of tasks) {
      if (!task?.enabled || !task?.cronExpression || !task?.id) continue
      if (!cron.validate(task.cronExpression)) continue

      const job = cron.schedule(task.cronExpression, () => {
        void triggerTask(task.id)
      })

      scheduledJobs.set(task.id, job)
    }
  }

  function start() {
    reloadSchedules()
    if (reloadTimer) clearInterval(reloadTimer)
    reloadTimer = setInterval(reloadSchedules, 15_000)
  }

  function stop() {
    if (reloadTimer) {
      clearInterval(reloadTimer)
      reloadTimer = null
    }
    stopAllJobs()
  }

  return {
    start,
    stop,
    reload: reloadSchedules,
  }
}

module.exports = { createScheduleRunner }
