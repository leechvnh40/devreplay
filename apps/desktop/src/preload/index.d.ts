import type { DevReplayApi } from '@devreplay/shared'

declare global {
  interface Window {
    devReplay: DevReplayApi
  }
}
