"use client"

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type BackButtonProps = {
  fallbackHref?: string
  label?: string
  onBack?: () => void
  disabled?: boolean
  className?: string
  variant?: 'default' | 'header'
}

export function BackButton({
  fallbackHref,
  label = 'Back',
  onBack,
  disabled = false,
  className,
  variant = 'default',
}: BackButtonProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [hasHistory, setHasHistory] = useState(false)

  useEffect(() => {
    setHasHistory(window.history.length > 1)
  }, [pathname])

  const canGoBack = !disabled && (
    typeof onBack === 'function' ||
    hasHistory ||
    (!!fallbackHref && pathname !== fallbackHref)
  )

  function handleBack() {
    if (!canGoBack) return

    if (onBack) {
      onBack()
      return
    }

    if (hasHistory) {
      router.back()
      return
    }

    if (fallbackHref) {
      router.push(fallbackHref)
    }
  }

  return (
    <button
      onClick={handleBack}
      disabled={!canGoBack}
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg transition-colors',
        variant === 'header'
          ? 'h-8 px-3 text-[13px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] disabled:text-[var(--text-muted)]/35 disabled:hover:bg-transparent'
          : 'px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-white/[0.04] disabled:text-text-muted/40 disabled:hover:bg-transparent',
        className
      )}
      title={label}
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{label}</span>
    </button>
  )
}
