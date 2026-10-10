import { useAppStore } from '../store/useAppStore'
import { ensureNotificationPermission } from '../lib/reminders'
import { LIST_COLORS } from '../lib/constants'
import { ThemeToggle } from '../components/common/ThemeToggle'

export function SettingsPage() {
  const lists = useAppStore((s) => s.lists)
  const updateList = useAppStore((s) => s.updateList)
  const deleteList = useAppStore((s) => s.deleteList)
  const tags = useAppStore((s) => s.tags)
  const deleteTag = useAppStore((s) => s.deleteTag)
  const theme = useAppStore((s) => s.theme)

  return (
    <div className="h-full overflow-auto bg-[var(--color-surface)] p-6">
      <h1 className="mb-6 text-lg font-semibold">设置</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-[var(--color-muted)]">外观</h2>
        <div className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-4 py-3">
          <span className="text-sm">当前主题：{theme === 'light' ? '浅色' : '深色'}</span>
          <ThemeToggle />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-[var(--color-muted)]">通知</h2>
        <button
          type="button"
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm text-white"
          onClick={() => void ensureNotificationPermission()}
        >
          请求浏览器通知权限
        </button>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          任务到点提醒依赖 Notification API；需保持页面打开。
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-[var(--color-muted)]">清单管理</h2>
        <ul className="space-y-2">
          {lists.map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2">
              <input
                type="color"
                value={l.color}
                disabled={!!l.isInbox}
                onChange={(e) => updateList(l.id, { color: e.target.value })}
                className="h-8 w-8 cursor-pointer rounded"
                list="list-colors"
              />
              <input
                value={l.name}
                disabled={!!l.isInbox}
                onChange={(e) => updateList(l.id, { name: e.target.value })}
                className="flex-1 bg-transparent text-sm outline-none disabled:opacity-60"
              />
              {!l.isInbox && (
                <button type="button" className="text-xs text-red-500" onClick={() => deleteList(l.id)}>
                  删除
                </button>
              )}
            </li>
          ))}
        </ul>
        <datalist id="list-colors">
          {LIST_COLORS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-muted)]">标签管理</h2>
        <ul className="space-y-2">
          {tags.map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm">
              <span style={{ color: t.color }}>#{t.name}</span>
              <button type="button" className="text-xs text-red-500" onClick={() => deleteTag(t.id)}>
                删除
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
