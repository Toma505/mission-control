import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { sanitizeError } from '@/lib/sanitize-error'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import { DATA_DIR } from '@/lib/connection-config'

/**
 * Team management API.
 * Handles team members, roles, invitations, and audit logging.
 */

const TEAM_FILE = path.join(DATA_DIR, 'team.json')
const AUDIT_FILE = path.join(DATA_DIR, 'audit-log.json')

// ─── Types ─────────────────────────────────────────────────

type Role = 'owner' | 'admin' | 'member' | 'viewer'

interface TeamMember {
  id: string
  name: string
  email: string
  role: Role
  avatar?: string
  joinedAt: string
  lastActiveAt: string
  status: 'active' | 'invited' | 'deactivated'
}

interface TeamData {
  name: string
  plan: 'free' | 'pro' | 'team'
  createdAt: string
  members: TeamMember[]
}

interface AuditEntry {
  id: string
  timestamp: string
  userId: string
  userName: string
  action: string
  resource: string
  details: string
  ip?: string
}

// ─── Permission matrix ─────────────────────────────────────

const PERMISSIONS: Record<Role, Set<string>> = {
  owner: new Set(['*']),
  admin: new Set([
    'team.view', 'team.invite', 'team.remove', 'team.role',
    'agents.view', 'agents.control', 'agents.config',
    'costs.view', 'costs.budget',
    'operations.view', 'operations.manage',
    'settings.view', 'settings.edit',
    'audit.view',
  ]),
  member: new Set([
    'team.view',
    'agents.view', 'agents.control',
    'costs.view',
    'operations.view', 'operations.manage',
    'settings.view',
  ]),
  viewer: new Set([
    'team.view',
    'agents.view',
    'costs.view',
    'operations.view',
    'settings.view',
  ]),
}

function hasPermission(role: Role, permission: string): boolean {
  const perms = PERMISSIONS[role]
  return perms.has('*') || perms.has(permission)
}

// ─── Persistence ───────────────────────────────────────────

async function readTeam(): Promise<TeamData> {
  try {
    const text = await readFile(TEAM_FILE, 'utf-8')
    return JSON.parse(text)
  } catch {
    // Default team with the owner
    const defaultTeam: TeamData = {
      name: 'My Workspace',
      plan: 'pro',
      createdAt: new Date().toISOString(),
      members: [
        {
          id: 'owner-1',
          name: 'Tomas',
          email: 'tomas@openclaw.dev',
          role: 'owner',
          joinedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          status: 'active',
        },
      ],
    }
    await writeTeam(defaultTeam)
    return defaultTeam
  }
}

async function writeTeam(team: TeamData): Promise<void> {
  await mkdir(path.dirname(TEAM_FILE), { recursive: true })
  await writeFile(TEAM_FILE, JSON.stringify(team, null, 2))
}

async function readAudit(): Promise<AuditEntry[]> {
  try {
    const text = await readFile(AUDIT_FILE, 'utf-8')
    return JSON.parse(text)
  } catch {
    return []
  }
}

async function appendAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
  const audit = await readAudit()
  audit.push({
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  })
  // Keep last 500 entries
  const trimmed = audit.slice(-500)
  await mkdir(path.dirname(AUDIT_FILE), { recursive: true })
  await writeFile(AUDIT_FILE, JSON.stringify(trimmed, null, 2))
}

// ─── Routes ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const action = request.nextUrl.searchParams.get('action') || 'team'

    if (action === 'team') {
      const team = await readTeam()
      return NextResponse.json({
        ...team,
        members: team.members.map(m => ({
          ...m,
          // Don't expose email to viewers
          email: m.email.replace(/(.{2}).+(@.+)/, '$1***$2'),
        })),
        permissions: Object.fromEntries(
          Object.entries(PERMISSIONS).map(([role, perms]) => [
            role,
            perms.has('*') ? ['*'] : Array.from(perms),
          ])
        ),
      })
    }

    if (action === 'audit') {
      const audit = await readAudit()
      const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50')
      return NextResponse.json({
        entries: audit.slice(-limit).reverse(),
        total: audit.length,
      })
    }

    if (action === 'permissions') {
      return NextResponse.json({
        roles: ['owner', 'admin', 'member', 'viewer'],
        permissions: Object.fromEntries(
          Object.entries(PERMISSIONS).map(([role, perms]) => [
            role,
            perms.has('*') ? ['all permissions'] : Array.from(perms),
          ])
        ),
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Team API error') },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    let body: {
      action: string
      memberId?: string
      name?: string
      email?: string
      role?: Role
      teamName?: string
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const team = await readTeam()
    // For now, assume the first owner is the current user
    const currentUser = team.members.find(m => m.role === 'owner') || team.members[0]

    switch (body.action) {
      case 'invite': {
        if (!hasPermission(currentUser.role, 'team.invite')) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }
        if (!body.email || !body.name) {
          return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
        }
        if (team.members.some(m => m.email.toLowerCase() === body.email!.toLowerCase())) {
          return NextResponse.json({ error: 'Member already exists' }, { status: 409 })
        }

        const newMember: TeamMember = {
          id: randomUUID(),
          name: body.name,
          email: body.email,
          role: body.role || 'member',
          joinedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          status: 'invited',
        }
        team.members.push(newMember)
        await writeTeam(team)

        await appendAudit({
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'team.invite',
          resource: `member:${newMember.id}`,
          details: `Invited ${newMember.name} (${newMember.email}) as ${newMember.role}`,
        })

        return NextResponse.json({ ok: true, member: newMember })
      }

      case 'remove': {
        if (!hasPermission(currentUser.role, 'team.remove')) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }
        if (!body.memberId) {
          return NextResponse.json({ error: 'Member ID is required' }, { status: 400 })
        }

        const member = team.members.find(m => m.id === body.memberId)
        if (!member) {
          return NextResponse.json({ error: 'Member not found' }, { status: 404 })
        }
        if (member.role === 'owner') {
          return NextResponse.json({ error: 'Cannot remove the owner' }, { status: 403 })
        }

        team.members = team.members.filter(m => m.id !== body.memberId)
        await writeTeam(team)

        await appendAudit({
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'team.remove',
          resource: `member:${member.id}`,
          details: `Removed ${member.name} (${member.email})`,
        })

        return NextResponse.json({ ok: true })
      }

      case 'update-role': {
        if (!hasPermission(currentUser.role, 'team.role')) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }
        if (!body.memberId || !body.role) {
          return NextResponse.json({ error: 'Member ID and role are required' }, { status: 400 })
        }

        const validRoles: Role[] = ['admin', 'member', 'viewer']
        if (!validRoles.includes(body.role)) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        }

        const member = team.members.find(m => m.id === body.memberId)
        if (!member) {
          return NextResponse.json({ error: 'Member not found' }, { status: 404 })
        }
        if (member.role === 'owner') {
          return NextResponse.json({ error: 'Cannot change owner role' }, { status: 403 })
        }

        const oldRole = member.role
        member.role = body.role
        await writeTeam(team)

        await appendAudit({
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'team.role-change',
          resource: `member:${member.id}`,
          details: `Changed ${member.name}'s role from ${oldRole} to ${body.role}`,
        })

        return NextResponse.json({ ok: true, member })
      }

      case 'rename-team': {
        if (!hasPermission(currentUser.role, 'settings.edit')) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }
        if (!body.teamName?.trim()) {
          return NextResponse.json({ error: 'Team name is required' }, { status: 400 })
        }

        team.name = body.teamName.trim()
        await writeTeam(team)

        await appendAudit({
          userId: currentUser.id,
          userName: currentUser.name,
          action: 'team.rename',
          resource: 'team',
          details: `Renamed team to "${team.name}"`,
        })

        return NextResponse.json({ ok: true, name: team.name })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json(
      { error: sanitizeError(error, 'Team operation failed') },
      { status: 500 }
    )
  }
}
