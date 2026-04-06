import { NextRequest, NextResponse } from 'next/server'
import { isAuthorized, unauthorizedResponse } from '@/lib/api-auth'
import {
  clearDeveloperLogs,
  createExtensionScaffold,
  getExtensionDevPayload,
  setDeveloperMode,
  validateManifestForPlugin,
  type DevTemplateId,
} from '@/lib/extensions-dev'

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const payload = await getExtensionDevPayload()
    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ error: 'Failed to load developer mode' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorizedResponse()

  try {
    const body = (await request.json().catch(() => null)) as
      | {
          action?: 'toggle'
          enabled?: boolean
        }
      | {
          action?: 'scaffold'
          name?: string
          template?: DevTemplateId
        }
      | {
          action?: 'validate'
          pluginId?: string
          manifestText?: string
        }
      | {
          action?: 'clearLogs'
        }
      | null

    if (!body?.action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    if (body.action === 'toggle') {
      await setDeveloperMode(body.enabled === true)
      return NextResponse.json({
        ok: true,
        message: body.enabled === true ? 'Developer mode enabled.' : 'Developer mode disabled.',
        payload: await getExtensionDevPayload(),
      })
    }

    if (body.action === 'scaffold') {
      const name = typeof body.name === 'string' ? body.name : ''
      const template =
        body.template === 'skill' || body.template === 'integration' || body.template === 'basic'
          ? body.template
          : 'basic'

      if (!name.trim()) {
        return NextResponse.json({ error: 'Plugin name is required.' }, { status: 400 })
      }

      const scaffold = await createExtensionScaffold(name, template)
      return NextResponse.json({
        ok: true,
        message: `Generated scaffold for ${scaffold.name}.`,
        scaffold,
        payload: await getExtensionDevPayload(),
      })
    }

    if (body.action === 'validate') {
      const result = await validateManifestForPlugin(
        typeof body.pluginId === 'string' ? body.pluginId : undefined,
        typeof body.manifestText === 'string' ? body.manifestText : undefined,
      )
      return NextResponse.json({
        ok: result.valid,
        validation: result,
        payload: await getExtensionDevPayload(),
      })
    }

    if (body.action === 'clearLogs') {
      await clearDeveloperLogs()
      return NextResponse.json({
        ok: true,
        message: 'Developer logs cleared.',
        payload: await getExtensionDevPayload(),
      })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Developer mode action failed',
      },
      { status: 500 },
    )
  }
}

