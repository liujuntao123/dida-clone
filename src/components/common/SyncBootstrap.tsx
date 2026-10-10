import { useEffect } from 'react'
import { startSyncRuntime } from '../../lib/syncBridge'

/** Mount once to enable pull-on-start + debounced push. */
export function SyncBootstrap() {
  useEffect(() => startSyncRuntime(), [])
  return null
}
