import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'

const globalForPrisma = globalThis as unknown as {
  _prisma: PrismaClient | undefined
}

function toPrismaPath(filePath: string) {
  return filePath.replace(/\\/g, '/')
}

function resolveDatabasePath() {
  if (process.env.DATABASE_URL?.startsWith('file:')) {
    return process.env.DATABASE_URL.slice('file:'.length)
  }

  const baseDir = process.env.MC_DATA_DIR || process.cwd()
  const fileName = process.env.MC_DATA_DIR ? 'mission-control.db' : 'dev.db'
  const dbPath = join(baseDir, fileName)

  mkdirSync(dirname(dbPath), { recursive: true })

  return toPrismaPath(dbPath)
}

function getPrisma(): PrismaClient {
  if (globalForPrisma._prisma) return globalForPrisma._prisma
  const client = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: resolveDatabasePath(),
    }),
  })
  if (process.env.NODE_ENV !== 'production') globalForPrisma._prisma = client
  return client
}

// Lazy proxy — PrismaClient won't be instantiated until first property access at runtime.
// This avoids the Prisma 7 build-time crash where the SQLite WASM engine isn't available.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
