import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { StatusBar } from '@capacitor/status-bar'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { applyTheme, readPersistedTheme } from './lib/theme'

/** Initialize Capacitor plugins when running as a native shell. */
export async function initCapacitor() {
  if (!Capacitor.isNativePlatform()) return

  try {
    // Draw edge-to-edge; CSS env(safe-area-inset-*) keeps chrome clear of notches / status bar.
    await StatusBar.setOverlaysWebView({ overlay: true })
    applyTheme(readPersistedTheme())
  } catch {
    // StatusBar may be unavailable on some devices
  }

  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body })
  } catch {
    // Keyboard plugin optional
  }

  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back()
    } else {
      App.exitApp()
    }
  })
}
