import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import type { ThemeMode } from '../types'

/** Apply theme to document + optional native StatusBar / theme-color. */
export function applyTheme(theme: ThemeMode) {
  const dark = theme === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = theme

  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  meta.content = dark ? '#000000' : '#f5f5f7'

  if (!Capacitor.isNativePlatform()) return
  void (async () => {
    try {
      // Light icons on dark bg; dark icons on light bg
      await StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark })
      await StatusBar.setBackgroundColor({ color: dark ? '#000000' : '#f5f5f7' })
    } catch {
      // StatusBar optional
    }
  })()
}

/** Read persisted theme before React mounts (zustand persist shape). */
export function readPersistedTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem('dida-clone-storage')
    if (!raw) return 'dark'
    const parsed = JSON.parse(raw) as { state?: { theme?: ThemeMode }; theme?: ThemeMode }
    const t = parsed.state?.theme ?? parsed.theme
    return t === 'light' || t === 'dark' ? t : 'dark'
  } catch {
    return 'dark'
  }
}
