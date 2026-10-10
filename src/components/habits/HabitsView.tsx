import { Clock } from 'lucide-react'

/** Placeholder for habits / clock tab — not pomodoro. */
export function HabitsView() {
  return (
    <div className="flex h-full flex-col bg-[var(--color-surface-2)] text-[var(--color-fg)]">
      <div
        className="flex min-h-12 items-center px-4 py-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <h1 className="flex-1 text-center text-xl font-semibold md:text-left">习惯</h1>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-card)]">
          <Clock size={28} className="text-brand" />
        </div>
        <p className="text-base text-[var(--color-fg)]/90">暂无习惯</p>
        <p className="text-sm text-[var(--color-muted)]">打卡习惯功能即将到来，先放松一下吧</p>
      </div>
    </div>
  )
}
