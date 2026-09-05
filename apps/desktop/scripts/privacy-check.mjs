import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const appRoot = join(import.meta.dirname, '..')
const targets = ['out/main/index.js', 'out/preload/index.js', 'src/main/fixtures/demo-fixture.ts']
const forbidden = [
  /(?:^|[^a-z])sk-[a-z0-9_-]{8,}/im,
  /googleDownloads/i,
  /[a-z]:[\\/]users[\\/][^\\/]+[\\/]/i,
  /李川豪/
]

for (const target of targets) {
  const content = readFileSync(join(appRoot, target), 'utf8')
  for (const pattern of forbidden) {
    if (pattern.test(content)) throw new Error(`Privacy check failed: ${target} matches ${pattern}`)
  }
}
console.log(`DEVREPLAY_PRIVACY_CHECK passed (${targets.length} files)`)
