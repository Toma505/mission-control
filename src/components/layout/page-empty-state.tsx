import Link from 'next/link'
import { type ReactNode } from 'react'

type EmptyStateAction = {
  label: string
  href: string
}

type PageEmptyStateProps = {
  icon: ReactNode
  title: string
  description: string
  primaryAction?: EmptyStateAction
  secondaryAction?: EmptyStateAction
}

export function PageEmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
}: PageEmptyStateProps) {
  return (
    <div className="glass rounded-2xl p-12 flex flex-col items-center justify-center text-center">
      <div className="p-4 rounded-2xl bg-background-elevated mb-4">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-2">{title}</h2>
      <p className="text-sm text-text-secondary max-w-md">{description}</p>

      {(primaryAction || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {primaryAction && (
            <Link
              href={primaryAction.href}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-primary)' }}
            >
              {primaryAction.label}
            </Link>
          )}
          {secondaryAction && (
            <Link
              href={secondaryAction.href}
              className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium text-text-secondary glass-inset hover:text-text-primary transition-colors"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
