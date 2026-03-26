import { NextResponse } from 'next/server'
import { isConfigured, getOpenClawPlugins } from '@/lib/openclaw'
import { parseOpenClawPlugins, titleCaseFromPluginId } from '@/lib/openclaw-plugin-parser'

interface SkillPlugin {
  name: string
  id: string
  status: 'loaded' | 'disabled'
  description: string
  version: string
}

export async function GET() {
  if (!(await isConfigured())) {
    return NextResponse.json({ connected: false, plugins: [], loaded: 0, total: 0 })
  }

  try {
    const raw = await getOpenClawPlugins()
    const parsed = parseOpenClawPlugins(raw)

    const plugins: SkillPlugin[] = parsed.plugins.map(plugin => ({
      id: plugin.id,
      name: titleCaseFromPluginId(plugin.name),
      status: plugin.enabled ? 'loaded' : 'disabled',
      description: '',
      version: plugin.version,
    }))

    return NextResponse.json({
      connected: true,
      plugins,
      loaded: parsed.loaded,
      total: parsed.total,
    })
  } catch {
    return NextResponse.json({ connected: false, plugins: [], loaded: 0, total: 0 })
  }
}
