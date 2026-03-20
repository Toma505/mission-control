'use client'

import { useEffect, useState, useRef } from 'react'
import {
  Users,
  UserPlus,
  Shield,
  Crown,
  Eye,
  UserCog,
  Trash2,
  ChevronDown,
  Loader2,
  Mail,
  Clock,
  History,
  CheckCircle2,
  AlertCircle,
  Settings,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  avatar?: string
  joinedAt: string
  lastActiveAt: string
  status: 'active' | 'invited' | 'deactivated'
}

interface AuditEntry {
  id: string
  timestamp: string
  userId: string
  userName: string
  action: string
  resource: string
  details: string
}

interface TeamData {
  name: string
  plan: string
  members: TeamMember[]
}

const ROLE_ICONS = {
  owner: Crown,
  admin: Shield,
  member: UserCog,
  viewer: Eye,
}

const ROLE_COLORS = {
  owner: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  admin: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  member: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  viewer: 'text-text-muted bg-white/[0.04] border-white/[0.06]',
}

const STATUS_DOT = {
  active: 'bg-emerald-400',
  invited: 'bg-amber-400 animate-pulse',
  deactivated: 'bg-red-400',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const AVATAR_GRADIENTS = [
  'from-blue-500 to-cyan-500',
  'from-violet-500 to-purple-500',
  'from-rose-500 to-pink-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-teal-500',
]

function getGradient(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

export function TeamDashboard() {
  const [team, setTeam] = useState<TeamData | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [roleDropdown, setRoleDropdown] = useState<string | null>(null)

  useEffect(() => {
    loadTeam()
  }, [])

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(timer)
  }, [message])

  async function loadTeam() {
    setLoading(true)
    setError('')
    try {
      const [teamRes, auditRes] = await Promise.all([
        fetch('/api/team?action=team', { cache: 'no-store' }),
        fetch('/api/team?action=audit', { cache: 'no-store' }),
      ])
      if (teamRes.ok) setTeam(await teamRes.json())
      if (auditRes.ok) {
        const auditData = await auditRes.json()
        setAudit(auditData.entries || [])
      }
    } catch {
      setError('Failed to load team data')
    } finally {
      setLoading(false)
    }
  }

  async function inviteMember() {
    if (!inviteName.trim() || !inviteEmail.trim()) return
    setActionBusy('invite')
    try {
      const res = await apiFetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invite',
          name: inviteName,
          email: inviteEmail,
          role: inviteRole,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessage({ ok: true, text: `Invited ${inviteName}` })
        setInviteName('')
        setInviteEmail('')
        setShowInvite(false)
        await loadTeam()
      } else {
        setMessage({ ok: false, text: data.error || 'Failed to invite' })
      }
    } catch {
      setMessage({ ok: false, text: 'Failed to invite member' })
    } finally {
      setActionBusy(null)
    }
  }

  async function removeMember(memberId: string) {
    setActionBusy(`remove-${memberId}`)
    try {
      const res = await apiFetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', memberId }),
      })
      const data = await res.json()
      setMessage({ ok: data.ok, text: data.ok ? 'Member removed' : data.error || 'Failed' })
      if (data.ok) await loadTeam()
    } catch {
      setMessage({ ok: false, text: 'Failed to remove member' })
    } finally {
      setActionBusy(null)
    }
  }

  async function updateRole(memberId: string, role: 'admin' | 'member' | 'viewer') {
    setActionBusy(`role-${memberId}`)
    setRoleDropdown(null)
    try {
      const res = await apiFetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-role', memberId, role }),
      })
      const data = await res.json()
      setMessage({ ok: data.ok, text: data.ok ? `Role updated to ${role}` : data.error || 'Failed' })
      if (data.ok) await loadTeam()
    } catch {
      setMessage({ ok: false, text: 'Failed to update role' })
    } finally {
      setActionBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-accent-primary" />
          <h1 className="text-3xl font-bold text-text-primary">Team</h1>
        </div>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-text-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-accent-primary" />
            <h1 className="text-3xl font-bold text-text-primary">Team</h1>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            {team?.name} · {team?.members.length} member{(team?.members.length || 0) !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAudit(!showAudit)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              showAudit
                ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20'
                : 'glass text-text-secondary hover:text-text-primary'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Audit Log
          </button>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-accent-primary text-white hover:bg-accent-primary/80 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Invite
          </button>
        </div>
      </div>

      {/* Message toast */}
      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
          message.ok
            ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-400'
            : 'border-red-400/20 bg-red-400/5 text-red-400'
        }`}>
          {message.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Invite form */}
      {showInvite && (
        <div className="glass rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-accent-primary" />
            Invite Team Member
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              placeholder="Name"
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
            />
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="Email"
              className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-accent-primary/50"
            />
            <div className="flex items-center gap-2">
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={inviteMember}
                disabled={!inviteName.trim() || !inviteEmail.trim() || actionBusy === 'invite'}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-accent-primary text-white hover:bg-accent-primary/80 disabled:opacity-50 transition-colors"
              >
                {actionBusy === 'invite' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['owner', 'admin', 'member', 'viewer'] as const).map(role => {
          const Icon = ROLE_ICONS[role]
          const count = team?.members.filter(m => m.role === role).length || 0
          return (
            <div key={role} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${ROLE_COLORS[role].split(' ')[0]}`} />
                <span className="text-xs font-medium text-text-secondary capitalize">{role}s</span>
              </div>
              <p className="text-2xl font-bold text-text-primary">{count}</p>
            </div>
          )
        })}
      </div>

      {/* Member list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Members</h2>
        {team?.members.map(member => {
          const Icon = ROLE_ICONS[member.role]
          const gradient = getGradient(member.id)
          const isOwner = member.role === 'owner'

          return (
            <div key={member.id} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-sm font-semibold shadow-lg`}>
                  {getInitials(member.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">{member.name}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${ROLE_COLORS[member.role]}`}>
                      <Icon className="w-3 h-3" />
                      {member.role}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[member.status]}`} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-text-muted flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {member.email}
                    </span>
                    <span className="text-[11px] text-text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {member.status === 'invited' ? 'Invited' : `Active ${timeAgo(member.lastActiveAt)}`}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {!isOwner && (
                  <div className="flex items-center gap-1.5">
                    {/* Role changer */}
                    <div className="relative">
                      <button
                        onClick={() => setRoleDropdown(roleDropdown === member.id ? null : member.id)}
                        className="p-2 rounded-lg hover:bg-white/[0.06] text-text-muted transition-colors"
                        title="Change role"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      {roleDropdown === member.id && (
                        <div className="absolute right-0 top-full mt-1 w-36 glass rounded-xl border border-white/[0.08] shadow-xl z-50 py-1">
                          {(['admin', 'member', 'viewer'] as const).map(role => (
                            <button
                              key={role}
                              onClick={() => updateRole(member.id, role)}
                              className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/[0.06] ${
                                member.role === role ? 'text-accent-primary' : 'text-text-secondary'
                              }`}
                            >
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                              {member.role === role && ' ✓'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => removeMember(member.id)}
                      disabled={actionBusy === `remove-${member.id}`}
                      className="p-2 rounded-lg hover:bg-red-400/10 text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Remove member"
                    >
                      {actionBusy === `remove-${member.id}` ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Audit Log */}
      {showAudit && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <History className="w-5 h-5 text-text-muted" />
            Audit Log
          </h2>
          {audit.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center">
              <History className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-secondary">No audit entries yet</p>
              <p className="text-xs text-text-muted mt-1">Actions will be logged as team members use Mission Control.</p>
            </div>
          ) : (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="divide-y divide-white/[0.04]">
                {audit.slice(0, 20).map(entry => (
                  <div key={entry.id} className="px-5 py-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[11px] font-bold text-text-muted">
                        {getInitials(entry.userName)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary">
                        <span className="font-medium">{entry.userName}</span>
                        {' '}
                        <span className="text-text-secondary">{entry.details}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-text-muted font-mono">{entry.action}</span>
                        <span className="text-[10px] text-text-muted">{timeAgo(entry.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
