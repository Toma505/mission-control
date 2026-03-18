/**
 * Connection config persistence layer.
 * Reads/writes data/connection.json, falls back to process.env.
 * This enables the onboarding flow — users configure via UI instead of .env files.
 */

import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export interface ConnectionConfig {
  openclawUrl: string
  setupPassword: string
  openrouterApiKey: string
  openrouterMgmtKey?: string
  configuredAt: string
}

/** Shared data directory — uses MC_DATA_DIR in packaged Electron, falls back to ./data */
export const DATA_DIR = process.env.MC_DATA_DIR || join(process.cwd(), 'data')
const CONFIG_PATH = join(DATA_DIR, 'connection.json')

export async function readConnectionConfig(): Promise<ConnectionConfig | null> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8')
    const data = JSON.parse(raw)
    if (data.openclawUrl && data.setupPassword) return data
    return null
  } catch {
    return null
  }
}

export async function writeConnectionConfig(config: ConnectionConfig): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2))
}

/**
 * Returns effective config: file-based config takes priority, falls back to env vars.
 * This means existing .env.local setups keep working without migration.
 */
export async function getEffectiveConfig(): Promise<{
  openclawUrl: string
  setupPassword: string
  openrouterApiKey: string
  openrouterMgmtKey: string
}> {
  const fileConfig = await readConnectionConfig()

  return {
    openclawUrl: fileConfig?.openclawUrl || process.env.OPENCLAW_API_URL || '',
    setupPassword: fileConfig?.setupPassword || process.env.OPENCLAW_SETUP_PASSWORD || '',
    openrouterApiKey: fileConfig?.openrouterApiKey || process.env.OPENROUTER_API_KEY || '',
    openrouterMgmtKey: fileConfig?.openrouterMgmtKey || process.env.OPENROUTER_MGMT_KEY || '',
  }
}

export async function isAppConfigured(): Promise<boolean> {
  const config = await getEffectiveConfig()
  return !!config.openclawUrl && !!config.setupPassword
}
