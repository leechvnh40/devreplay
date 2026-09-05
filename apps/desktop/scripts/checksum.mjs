import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const directory = join(import.meta.dirname, '../dist')
const installers = readdirSync(directory)
  .filter((name) => name.endsWith('-setup.exe'))
  .sort()
if (installers.length !== 1)
  throw new Error(`Expected one NSIS installer, found ${installers.length}`)
const filename = installers[0]
const digest = createHash('sha256')
  .update(readFileSync(join(directory, filename)))
  .digest('hex')
const checksum = `${digest}  ${filename}\n`
writeFileSync(join(directory, `${filename}.sha256`), checksum)
console.log(checksum.trim())
