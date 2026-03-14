"use client"

import { Search, Bell, User } from 'lucide-react'

export function Header() {
  return (
    <header className="h-16 border-b border-border bg-background-secondary px-6 flex items-center justify-between">
      {/* Page Title - will be dynamic later */}
      <div>
        <h2 className="text-2xl font-bold text-text-primary">Mission Control</h2>
        <p className="text-sm text-text-secondary">Real-time overview of all systems</p>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search tasks..."
            className="pl-10 pr-4 py-2 bg-background-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary w-64"
          />
        </div>

        {/* Notifications */}
        <button className="w-9 h-9 rounded-lg bg-background-elevated border border-border flex items-center justify-center hover:bg-background-card transition-colors">
          <Bell className="w-4 h-4 text-text-secondary" />
        </button>

        {/* Profile */}
        <button className="w-9 h-9 rounded-lg bg-accent-primary flex items-center justify-center text-white font-semibold text-sm hover:bg-accent-primary/90 transition-colors">
          JA
        </button>
      </div>
    </header>
  )
}
