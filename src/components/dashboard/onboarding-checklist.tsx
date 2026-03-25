'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, X } from 'lucide-react'

interface CheckItem {
  id: string
  label: string
  description: string
  href: string
  check: () => Promise<boolean>
}

const DISMISS_KEY = 'mc-onboarding-dismissed'

const checklistItems: CheckItem[] = [
  {
    id: 'connection',
    label: 'Connect to OpenClaw',
    description: 'Link your OpenClaw instance to enable live monitoring',
    href: '/setup?reconfigure=true',
    check: async () => {
      try {
        const res = await fetch('/api/connection')
        const data = await res.json()
        return data.connected === true
      } catch { return false }
    },
  },
  {
    id: 'budget',
    label: 'Set a daily budget',
    description: 'Protect against runaway API costs with spending limits',
    href: '/costs',
    check: async () => {
      try {
        const res = await fetch('/api/budget')
        const data = await res.json()
        return data.budget?.dailyLimit > 0 && data.budget?.updatedAt !== undefined
      } catch { return false }
    },
  },
  {
    id: 'alert',
    label: 'Create your first alert',
    description: 'Get notified when spending crosses a threshold',
    href: '/alerts',
    check: async () => {
      try {
        const res = await fetch('/api/alerts')
        const data = await res.json()
        return (data.rules || []).length > 0
      } catch { return false }
    },
  },
  {
    id: 'csv',
    label: 'Import cost data',
    description: 'Upload an OpenRouter CSV to see historical spending',
    href: '/costs',
    check: async () => {
      try {
        const res = await fetch('/api/costs')
        const data = await res.json()
        return (data.entries || []).length > 0
      } catch { return false }
    },
  },
  {
    id: 'mode',
    label: 'Try switching AI modes',
    description: 'Switch between Best, Budget, or Auto to control quality vs cost',
    href: '/costs',
    check: async () => {
      try {
        const res = await fetch('/api/mode')
        const data = await res.json()
        return data.connected === true
      } catch { return false }
    },
  },
]

export function OnboardingChecklist() {
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [dismissed, setDismissed] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissed(localStorage.getItem(DISMISS_KEY) === 'true')
    }

    Promise.all(
      checklistItems.map(async item => {
        const result = await item.check()
        return [item.id, result] as const
      })
    ).then(results => {
      setChecks(Object.fromEntries(results))
      setLoading(false)
    })
  }, [])

  const completedCount = Object.values(checks).filter(Boolean).length
  const allDone = completedCount === checklistItems.length

  if (dismissed || loading) return null
  if (allDone) return null

  const progress = Math.round((completedCount / checklistItems.length) * 100)

  return (
    <div className="glass rounded-2xl p-6 relative">
      <button
        onClick={() => {
          setDismissed(true)
          localStorage.setItem(DISMISS_KEY, 'true')
        }}
        className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <h2 className="text-lg font-semibold text-text-primary mb-1">Get Started</h2>
      <p className="text-xs text-text-secondary mb-4">Complete these steps to get the most out of Mission Control</p>

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent-primary,#3b82f6)] rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-text-muted font-medium">{completedCount}/{checklistItems.length}</span>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {checklistItems.map(item => {
          const done = checks[item.id] || false
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                done ? 'bg-white/[0.02] opacity-60' : 'bg-white/[0.04] hover:bg-white/[0.08]'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                done ? 'bg-emerald-400/20' : 'bg-white/[0.06]'
              }`}>
                {done ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-white/[0.15]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                  {item.label}
                </p>
                <p className="text-xs text-text-muted">{item.description}</p>
              </div>
              {!done && <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
