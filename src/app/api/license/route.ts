/**
 * License status endpoint — used by middleware to gate first-launch routing.
 *
 * Checks whether a license.json file exists in the user data directory
 * with a key and email. The actual HMAC validation happens in Electron's
 * main process; this is a lightweight presence check so the server-side
 * middleware can decide between /activate and /setup.
 */

import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

const DATA_DIR = process.env.MC_DATA_DIR || join(process.cwd(), 'data')
// license.json lives one level above the data dir (in userData root)
const LICENSE_PATH = join(DATA_DIR, '..', 'license.json')

export async function GET() {
  try {
    const raw = await readFile(LICENSE_PATH, 'utf-8')
    // Strip UTF-8 BOM if present (e.g. from manual edits or scripts)
    const clean = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
    const data = JSON.parse(clean)

    // Basic structure check — key and email must be present
    if (data.key && data.email) {
      return NextResponse.json({ licensed: true })
    }

    return NextResponse.json({ licensed: false })
  } catch {
    // File doesn't exist or is unreadable — no license
    return NextResponse.json({ licensed: false })
  }
}
