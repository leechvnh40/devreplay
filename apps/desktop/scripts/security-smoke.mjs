import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import electronPath from 'electron'

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const child = spawn(electronPath, ['.'], {
  cwd: appDirectory,
  env: {
    ...process.env,
    DEVREPLAY_SECURITY_SMOKE: '1'
  },
  stdio: 'inherit',
  windowsHide: true
})

child.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})

child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
