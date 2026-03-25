'use client'

import { useState } from 'react'
import {
  Download,
  Upload,
  Archive,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  HardDrive,
  Clock,
} from 'lucide-react'

type ElectronAPI = {
  createBackup?: () => Promise<BackupResult>
  restoreBackup?: () => Promise<BackupResult>
}

function getElectronAPI(): ElectronAPI | undefined {
  return typeof window !== 'undefined'
    ? (window as Window & { electronAPI?: ElectronAPI }).electronAPI
    : undefined
}

type BackupResult = {
  ok: boolean
  path?: string
  fileCount?: number
  restored?: number
  createdAt?: string
  error?: string
}

export function BackupRestore() {
  const [backupStatus, setBackupStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle')
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle')
  const [backupResult, setBackupResult] = useState<BackupResult | null>(null)
  const [restoreResult, setRestoreResult] = useState<BackupResult | null>(null)

  async function handleBackup() {
    const api = getElectronAPI()
    if (!api?.createBackup) return
    setBackupStatus('working')
    setBackupResult(null)

    try {
      const result = await api.createBackup!()
      if (result.ok) {
        setBackupStatus('success')
        setBackupResult(result)
      } else {
        setBackupStatus(result.error === 'Cancelled' ? 'idle' : 'error')
        setBackupResult(result.error === 'Cancelled' ? null : result)
      }
    } catch {
      setBackupStatus('error')
      setBackupResult({ ok: false, error: 'Backup failed unexpectedly' })
    }
  }

  async function handleRestore() {
    const api = getElectronAPI()
    if (!api?.restoreBackup) return
    setRestoreStatus('working')
    setRestoreResult(null)

    try {
      const result = await api.restoreBackup!()
      if (result.ok) {
        setRestoreStatus('success')
        setRestoreResult(result)
      } else {
        setRestoreStatus(result.error === 'Cancelled' ? 'idle' : 'error')
        setRestoreResult(result.error === 'Cancelled' ? null : result)
      }
    } catch {
      setRestoreStatus('error')
      setRestoreResult({ ok: false, error: 'Restore failed unexpectedly' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Archive className="w-5 h-5 text-accent-highlight" />
          <h3 className="text-base font-semibold text-text-primary">Backup & Restore</h3>
        </div>
        <p className="text-xs text-text-muted">
          Export all your Mission Control data — connection settings, alert rules, cost history, budgets, license, and preferences — to a single file. Restore anytime to get back to where you left off.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Backup card */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Download className="w-4 h-4 text-accent-primary" />
            <h4 className="text-sm font-semibold text-text-primary">Create Backup</h4>
          </div>
          <p className="text-xs text-text-muted mb-4">
            Saves all data files, desktop settings, and license info to a JSON backup file.
          </p>

          <button
            onClick={handleBackup}
            disabled={backupStatus === 'working'}
            className="w-full px-4 py-2.5 rounded-xl bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {backupStatus === 'working' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Creating backup...</>
            ) : (
              <><HardDrive className="w-4 h-4" /> Backup Now</>
            )}
          </button>

          {backupStatus === 'success' && backupResult && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-400/10 border border-emerald-400/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-emerald-400 font-medium">Backup created</p>
                <p className="text-[10px] text-text-muted mt-0.5">{backupResult.fileCount} files saved</p>
              </div>
            </div>
          )}

          {backupStatus === 'error' && backupResult && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/20">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-400">{backupResult.error}</p>
            </div>
          )}
        </div>

        {/* Restore card */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <Upload className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-text-primary">Restore Backup</h4>
          </div>
          <p className="text-xs text-text-muted mb-4">
            Overwrites current data with a previously saved backup. This cannot be undone.
          </p>

          <button
            onClick={handleRestore}
            disabled={restoreStatus === 'working'}
            className="w-full px-4 py-2.5 rounded-xl bg-white/[0.06] text-text-primary text-sm font-medium hover:bg-white/[0.1] transition-colors disabled:opacity-50 border border-white/[0.08] flex items-center justify-center gap-2"
          >
            {restoreStatus === 'working' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Restoring...</>
            ) : (
              <><Upload className="w-4 h-4" /> Restore from File</>
            )}
          </button>

          {restoreStatus === 'success' && restoreResult && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-400/10 border border-emerald-400/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-emerald-400 font-medium">Restore complete</p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {restoreResult.restored} files restored from {restoreResult.createdAt ? new Date(restoreResult.createdAt).toLocaleDateString() : 'backup'}
                </p>
                <p className="text-[10px] text-amber-400 mt-0.5">Restart the app to apply all changes</p>
              </div>
            </div>
          )}

          {restoreStatus === 'error' && restoreResult && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/20">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-400">{restoreResult.error}</p>
            </div>
          )}
        </div>
      </div>

      {/* Info box */}
      <div className="glass rounded-2xl p-4">
        <p className="text-[11px] text-text-muted leading-relaxed">
          <strong className="text-text-secondary">What&apos;s included:</strong> Connection config (encrypted), alert rules, cost history, budget settings, OpenRouter costs, license data, desktop preferences, and team data.
          <br />
          <strong className="text-text-secondary">What&apos;s excluded:</strong> The encryption key (tied to your OS account via safeStorage) and the SQLite database. After restoring, you may need to re-enter your OpenClaw password.
        </p>
      </div>
    </div>
  )
}
