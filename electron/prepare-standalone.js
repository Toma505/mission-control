const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const standaloneRoot = path.join(repoRoot, '.next', 'standalone')
const tracedNodeModulesRoot = path.join(standaloneRoot, '.next', 'node_modules')

function copyIfExists(source, destination) {
  if (!fs.existsSync(source)) {
    return
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
  })
}

function removeIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return
  }

  fs.rmSync(targetPath, {
    recursive: true,
    force: true,
  })
}

function replaceLinkWithRealCopy(linkPath) {
  const resolvedPath = fs.realpathSync(linkPath)
  const tempPath = `${linkPath}.__real__`

  removeIfExists(tempPath)
  fs.cpSync(resolvedPath, tempPath, {
    recursive: true,
    force: true,
    dereference: true,
  })
  removeIfExists(linkPath)
  fs.renameSync(tempPath, linkPath)
}

function dereferenceNodeModuleLinks(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return
  }

  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name)
    const stats = fs.lstatSync(entryPath)

    if (stats.isSymbolicLink()) {
      replaceLinkWithRealCopy(entryPath)
      continue
    }

    if (stats.isDirectory()) {
      dereferenceNodeModuleLinks(entryPath)
    }
  }
}

function main() {
  if (!fs.existsSync(standaloneRoot)) {
    throw new Error(`Standalone output not found at ${standaloneRoot}`)
  }

  // Next standalone needs the static assets copied beside server.js, but on
  // Windows the traced output may use directory links. Recursively expanding
  // those links copies whole repo directories into standalone and bloats the
  // installer beyond NSIS limits.
  copyIfExists(path.join(repoRoot, 'public'), path.join(standaloneRoot, 'public'))
  copyIfExists(path.join(repoRoot, '.next', 'static'), path.join(standaloneRoot, '.next', 'static'))
  removeIfExists(path.join(standaloneRoot, 'release'))
  removeIfExists(path.join(standaloneRoot, 'HANDOFF.md'))
  removeIfExists(path.join(standaloneRoot, 'QA-CLEAN-MACHINE.md'))
  removeIfExists(path.join(standaloneRoot, 'BUILD_STATUS.md'))
  removeIfExists(path.join(standaloneRoot, 'tsconfig.tsbuildinfo'))
  removeIfExists(path.join(standaloneRoot, 'dev.db'))
  removeIfExists(path.join(standaloneRoot, 'prisma-review-existing.db'))
  dereferenceNodeModuleLinks(tracedNodeModulesRoot)
}

main()
