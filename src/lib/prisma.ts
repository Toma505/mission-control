import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'

const globalForPrisma = globalThis as unknown as {
  _prisma: PrismaClient | undefined
  _prismaSchemaReady: boolean | undefined
}

type SqliteBootstrapDb = {
  exec: (sql: string) => void
  close: () => void
}

type BetterSqlite3Ctor = new (filename: string) => SqliteBootstrapDb

const BetterSqlite3 = require('better-sqlite3') as BetterSqlite3Ctor

const SCHEMA_BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS "Agent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "tagline" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IDLE',
  "avatar" TEXT,
  "capabilities" TEXT NOT NULL DEFAULT '[]',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "AgentUptimeEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "agentName" TEXT NOT NULL,
  "model" TEXT,
  "status" TEXT NOT NULL,
  "bucketStart" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Task" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'BACKLOGGED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "tags" TEXT NOT NULL DEFAULT '[]',
  "dueDate" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  "completedAt" DATETIME
);

CREATE TABLE IF NOT EXISTS "TaskAgent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "agentId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  CONSTRAINT "TaskAgent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TaskAgent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Activity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "entityId" TEXT,
  "entityType" TEXT,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "metadata" TEXT,
  "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "agentId" TEXT,
  "taskId" TEXT,
  CONSTRAINT "Activity_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Activity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Commit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "message" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "relatedTaskId" TEXT
);

CREATE TABLE IF NOT EXISTS "Document" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "path" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tags" TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS "Client" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastActivity" DATETIME,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "CronJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "schedule" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "lastRun" DATETIME,
  "nextRun" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "SystemStatus" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "overall" TEXT NOT NULL DEFAULT 'ACTIVE',
  "message" TEXT NOT NULL,
  "lastChecked" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "agentsActive" INTEGER NOT NULL DEFAULT 0,
  "tasksInProgress" INTEGER NOT NULL DEFAULT 0,
  "systemLoad" REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "AgentUptimeEvent_bucketStart_idx" ON "AgentUptimeEvent"("bucketStart");
CREATE INDEX IF NOT EXISTS "AgentUptimeEvent_agentName_bucketStart_idx" ON "AgentUptimeEvent"("agentName", "bucketStart");
CREATE UNIQUE INDEX IF NOT EXISTS "AgentUptimeEvent_agentName_bucketStart_key" ON "AgentUptimeEvent"("agentName", "bucketStart");
CREATE UNIQUE INDEX IF NOT EXISTS "TaskAgent_agentId_taskId_key" ON "TaskAgent"("agentId", "taskId");
`

function toPrismaPath(filePath: string) {
  return filePath.replace(/\\/g, '/')
}

function resolveDatabaseFsPath() {
  if (process.env.DATABASE_URL?.startsWith('file:')) {
    return process.env.DATABASE_URL.slice('file:'.length)
  }

  const baseDir = process.env.MC_DATA_DIR || process.cwd()
  const fileName = process.env.MC_DATA_DIR ? 'mission-control.db' : 'dev.db'
  const dbPath = join(baseDir, fileName)

  mkdirSync(dirname(dbPath), { recursive: true })

  return dbPath
}

function resolveDatabasePath() {
  return toPrismaPath(resolveDatabaseFsPath())
}

function ensureSchema(dbPath: string) {
  if (globalForPrisma._prismaSchemaReady) return

  const db = new BetterSqlite3(dbPath)
  try {
    db.exec(SCHEMA_BOOTSTRAP_SQL)
    globalForPrisma._prismaSchemaReady = true
  } finally {
    db.close()
  }
}

function getPrisma(): PrismaClient {
  if (globalForPrisma._prisma) return globalForPrisma._prisma
  const dbPath = resolveDatabaseFsPath()
  ensureSchema(dbPath)
  const client = new PrismaClient({
    adapter: new PrismaBetterSqlite3({
      url: toPrismaPath(dbPath),
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
