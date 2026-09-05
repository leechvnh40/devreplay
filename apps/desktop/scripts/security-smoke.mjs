import { spawn } from 'node:child_process'
import { dirname, parse, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import electronPath from 'electron'

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packagedExecutable = process.env.DEVREPLAY_SECURITY_EXECUTABLE
const executablePath = packagedExecutable ?? electronPath
const runsFromAnotherWindowsDrive =
  process.platform === 'win32' &&
  parse(executablePath).root.toLowerCase() !==
    parse(process.env.SystemRoot ?? 'C:\\Windows').root.toLowerCase()
const child = spawn(
  executablePath,
  [...(runsFromAnotherWindowsDrive ? ['--no-sandbox'] : []), ...(packagedExecutable ? [] : ['.'])],
  {
    cwd: packagedExecutable ? dirname(packagedExecutable) : appDirectory,
    env: {
      ...process.env,
      DEVREPLAY_SECURITY_SMOKE: '1'
    },
    stdio: 'inherit',
    windowsHide: true
  }
)

child.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})

child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
