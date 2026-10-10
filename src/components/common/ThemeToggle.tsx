import { Moon, Sun } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

export function ThemeToggle() {
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-lg p-2 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
      title={theme === 'light' ? '切换深色' : '切换浅色'}
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  )
}
