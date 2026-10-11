import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" />
}

export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card px-4 py-3.5">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="tnum mt-1 text-2xl font-semibold leading-none">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-[var(--muted)]">{sub}</p>}
    </div>
  )
}

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'danger' | 'muted' | 'brand'; children: ReactNode }) {
  const map = {
    ok: 'bg-emerald-50 text-emerald-600',
    warn: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
    muted: 'bg-gray-100 text-gray-500',
    brand: 'bg-blue-50 text-blue-600',
  } as const
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${map[tone]}`}>
      {children}
    </span>
  )
}

export function EmptyRow({ colSpan, text = '暂无数据' }: { colSpan: number; text?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center text-xs text-[var(--muted)]">
        {text}
      </td>
    </tr>
  )
}

export function Page({ title, sub, actions, children }: { title: string; sub?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl p-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          {sub && <p className="mt-0.5 text-xs text-[var(--muted)]">{sub}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}
