import { Clock } from 'lucide-react'

/** Placeholder for habits / clock tab — not pomodoro. */
export function HabitsView() {
  return (
    <div className="flex h-full flex-col bg-black text-white">
      <div className="flex min-h-12 items-center px-4 py-3">
        <h1 className="text-xl font-semibold">习惯</h1>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 pb-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1C1C1E]">
          <Clock size={28} className="text-[#FF7A45]" />
        </div>
        <p className="text-base text-white/90">暂无习惯</p>
        <p className="text-sm text-white/40">打卡习惯功能即将到来，先放松一下吧</p>
      </div>
    </div>
  )
}
