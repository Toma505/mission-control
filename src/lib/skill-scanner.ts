/**
 * Security scanner for OpenClaw skill/plugin zip files.
 * Extracts and analyzes code for suspicious patterns.
 */

export interface ScanFinding {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  file: string
  line?: number
  pattern: string
  description: string
}

export interface ScanReport {
  safe: boolean
  score: number // 0-100, higher = safer
  files: { name: string; size: number; type: string }[]
  findings: ScanFinding[]
  summary: string
}

interface PatternRule {
  pattern: RegExp
  severity: ScanFinding['severity']
  description: string
  name: string
}

const DANGEROUS_PATTERNS: PatternRule[] = [
  // Critical - code execution
  { pattern: /\beval\s*\(/, severity: 'critical', description: 'eval() can execute arbitrary code', name: 'eval()' },
  { pattern: /new\s+Function\s*\(/, severity: 'critical', description: 'Function constructor can execute arbitrary code', name: 'new Function()' },
  { pattern: /child_process/, severity: 'critical', description: 'child_process module allows shell command execution', name: 'child_process' },
  { pattern: /\bexec\s*\(/, severity: 'high', description: 'exec() can run shell commands', name: 'exec()' },
  { pattern: /\bexecSync\s*\(/, severity: 'critical', description: 'execSync() runs shell commands synchronously', name: 'execSync()' },
  { pattern: /\bspawn\s*\(/, severity: 'high', description: 'spawn() can launch child processes', name: 'spawn()' },
  { pattern: /\bspawnSync\s*\(/, severity: 'high', description: 'spawnSync() launches child processes synchronously', name: 'spawnSync()' },

  // High - network/data exfiltration
  { pattern: /\bfetch\s*\(\s*['"`]http/, severity: 'high', description: 'Hardcoded HTTP request could exfiltrate data', name: 'hardcoded fetch' },
  { pattern: /\.connect\s*\(\s*['"`]/, severity: 'high', description: 'Network connection to hardcoded address', name: 'network connect' },
  { pattern: /\bWebSocket\s*\(/, severity: 'medium', description: 'WebSocket connection could be used for C2', name: 'WebSocket' },
  { pattern: /\bXMLHttpRequest/, severity: 'medium', description: 'XMLHttpRequest can make network requests', name: 'XMLHttpRequest' },

  // High - file system abuse
  { pattern: /fs\.writeFile|fs\.writeFileSync|writeFile\s*\(/, severity: 'high', description: 'File write operation — could modify system files', name: 'file write' },
  { pattern: /fs\.unlink|fs\.unlinkSync|fs\.rmdir|fs\.rm\b/, severity: 'critical', description: 'File deletion operation', name: 'file delete' },
  { pattern: /fs\.chmod|fs\.chown/, severity: 'critical', description: 'File permission modification', name: 'permission change' },
  { pattern: /\/etc\/passwd|\/etc\/shadow|\.ssh\//, severity: 'critical', description: 'Access to sensitive system files', name: 'system file access' },
  { pattern: /\.\.\/\.\.\// , severity: 'high', description: 'Path traversal pattern', name: 'path traversal' },

  // Medium - crypto/obfuscation
  { pattern: /atob\s*\(|btoa\s*\(|Buffer\.from\s*\([^,]+,\s*['"]base64/, severity: 'medium', description: 'Base64 encoding/decoding — could hide malicious payloads', name: 'base64 encoding' },
  { pattern: /\\x[0-9a-fA-F]{2}\\x[0-9a-fA-F]{2}\\x[0-9a-fA-F]{2}/, severity: 'high', description: 'Hex-encoded strings — possible obfuscation', name: 'hex encoding' },
  { pattern: /\\u[0-9a-fA-F]{4}\\u[0-9a-fA-F]{4}\\u[0-9a-fA-F]{4}/, severity: 'medium', description: 'Unicode-encoded strings — possible obfuscation', name: 'unicode encoding' },

  // Medium - environment/secrets
  { pattern: /process\.env/, severity: 'low', description: 'Reads environment variables', name: 'env access' },
  { pattern: /API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL/i, severity: 'medium', description: 'References to secrets/credentials', name: 'secret reference' },
  { pattern: /require\s*\(\s*['"`]\./, severity: 'low', description: 'Dynamic local require', name: 'local require' },

  // Info - general observations
  { pattern: /require\s*\(\s*['"`](http|https|net|dgram|tls|dns)['"`]/, severity: 'high', description: 'Network module import', name: 'network module' },
  { pattern: /require\s*\(\s*['"`]os['"`]/, severity: 'medium', description: 'OS module import — can read system info', name: 'os module' },
  { pattern: /\bminified\b|;\s*var\s+\w=\w\(\w\);\s*var/, severity: 'medium', description: 'Possibly minified/obfuscated code', name: 'minified code' },
]

const CODE_EXTENSIONS = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs',
  '.py', '.sh', '.bash', '.bat', '.cmd', '.ps1',
  '.json', '.yaml', '.yml', '.toml',
])

const BINARY_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bin', '.com',
])

export function scanFileContent(fileName: string, content: string): ScanFinding[] {
  const findings: ScanFinding[] = []
  const lines = content.split('\n')

  for (const rule of DANGEROUS_PATTERNS) {
    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i])) {
        findings.push({
          severity: rule.severity,
          file: fileName,
          line: i + 1,
          pattern: rule.name,
          description: rule.description,
        })
      }
    }
  }

  // Check for very long lines (possible obfuscation)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > 1000) {
      findings.push({
        severity: 'medium',
        file: fileName,
        line: i + 1,
        pattern: 'long line',
        description: `Line is ${lines[i].length} chars — possibly minified or obfuscated`,
      })
    }
  }

  return findings
}

export function generateReport(
  files: { name: string; size: number; content?: string }[]
): ScanReport {
  const allFindings: ScanFinding[] = []
  const fileInfo: ScanReport['files'] = []

  for (const file of files) {
    const ext = file.name.includes('.') ? '.' + file.name.split('.').pop()!.toLowerCase() : ''

    // Flag binary executables
    if (BINARY_EXTENSIONS.has(ext)) {
      allFindings.push({
        severity: 'critical',
        file: file.name,
        pattern: 'binary executable',
        description: `Binary executable file detected (${ext})`,
      })
    }

    const type = CODE_EXTENSIONS.has(ext)
      ? 'code'
      : BINARY_EXTENSIONS.has(ext)
        ? 'binary'
        : 'other'

    fileInfo.push({ name: file.name, size: file.size, type })

    // Scan code files
    if (file.content && CODE_EXTENSIONS.has(ext)) {
      const fileFindings = scanFileContent(file.name, file.content)
      allFindings.push(...fileFindings)
    }
  }

  // Deduplicate findings (same file + pattern + line)
  const seen = new Set<string>()
  const dedupedFindings = allFindings.filter((f) => {
    const key = `${f.file}:${f.line}:${f.pattern}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Calculate safety score
  const severityWeights = { critical: 25, high: 15, medium: 5, low: 1, info: 0 }
  const totalPenalty = dedupedFindings.reduce(
    (sum, f) => sum + severityWeights[f.severity],
    0
  )
  const score = Math.max(0, 100 - totalPenalty)

  const criticalCount = dedupedFindings.filter((f) => f.severity === 'critical').length
  const highCount = dedupedFindings.filter((f) => f.severity === 'high').length

  let summary: string
  if (criticalCount > 0) {
    summary = `Found ${criticalCount} critical issue(s). This skill contains potentially dangerous code. Review carefully before installing.`
  } else if (highCount > 0) {
    summary = `Found ${highCount} high-severity issue(s). Some patterns need review before installation.`
  } else if (dedupedFindings.length > 0) {
    summary = `Found ${dedupedFindings.length} low/medium issue(s). Generally safe but review the findings.`
  } else {
    summary = 'No security issues detected. This skill appears safe to install.'
  }

  return {
    safe: criticalCount === 0 && highCount === 0,
    score,
    files: fileInfo,
    findings: dedupedFindings,
    summary,
  }
}
