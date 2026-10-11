import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { StatusBar } from '@capacitor/status-bar'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { applyTheme, readPersistedTheme } from './lib/theme'
import { handleAppBack } from './lib/backNav'

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

  // Android 返回键：优先走应用内层级（抽屉 → 详情 → 全屏模块页 → 主页面），
  // 都退无可退时才退出应用。应用内不使用浏览器历史，不能直接 history.back()。
  App.addListener('backButton', ({ canGoBack }) => {
    if (handleAppBack()) return
    if (canGoBack) {
      window.history.back()
    } else {
      App.exitApp()
    }
  })
}
