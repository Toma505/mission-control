const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const standaloneRoot = path.join(repoRoot, '.next', 'standalone')

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

function replaceLinkWithRealCopy(linkPath) {
  const resolvedPath = fs.realpathSync(linkPath)
  const tempPath = `${linkPath}.__real__`

  fs.rmSync(tempPath, { recursive: true, force: true })
  fs.cpSync(resolvedPath, tempPath, {
    recursive: true,
    force: true,
    dereference: true,
  })
  fs.rmSync(linkPath, { recursive: true, force: true })
  fs.renameSync(tempPath, linkPath)
}

function dereferenceLinks(directoryPath) {
  for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name)
    const stats = fs.lstatSync(entryPath)

    if (stats.isSymbolicLink()) {
      replaceLinkWithRealCopy(entryPath)
      continue
    }

    if (stats.isDirectory()) {
      dereferenceLinks(entryPath)
    }
  }
}

function main() {
  if (!fs.existsSync(standaloneRoot)) {
    throw new Error(`Standalone output not found at ${standaloneRoot}`)
  }

  copyIfExists(path.join(repoRoot, 'public'), path.join(standaloneRoot, 'public'))
  copyIfExists(path.join(repoRoot, '.next', 'static'), path.join(standaloneRoot, '.next', 'static'))
  dereferenceLinks(standaloneRoot)
}

main()
