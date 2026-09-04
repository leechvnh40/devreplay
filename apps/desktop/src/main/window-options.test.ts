import { describe, expect, it } from 'vitest'
import { createMainWindowOptions } from './window-options'

describe('main window security boundary', () => {
  it('isolates and sandboxes the renderer', () => {
    const options = createMainWindowOptions('C:\\devreplay\\preload.js')

    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false
    })
  })

  it('only loads the declared preload entry', () => {
    const options = createMainWindowOptions('C:\\devreplay\\preload.js')

    expect(options.webPreferences?.preload).toBe('C:\\devreplay\\preload.js')
    expect(options.webPreferences?.additionalArguments).toBeUndefined()
  })
})
