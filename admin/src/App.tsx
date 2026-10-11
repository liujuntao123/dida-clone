import { useEffect, useState } from 'react'
import { Activity, Users as ListUsers, LogOut, ScrollText, Settings2 } from 'lucide-react'
import { api, clearToken, loadToken, type SessionUser } from './api'
import { LoginPage } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Users } from './pages/Users'
import { Logs } from './pages/Logs'
import { cn } from './cn'

type View = 'dashboard' | 'users' | 'logs'

const NAV: { id: View; label: string; icon: typeof Activity }[] = [
  { id: 'dashboard', label: '总览', icon: Activity },
  { id: 'users', label: '用户', icon: ListUsers },
  { id: 'logs', label: '日志', icon: ScrollText },
]

export default function App() {
  const [phase, setPhase] = useState<'loading' | 'anon' | 'authed'>('loading')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [view, setView] = useState<View>('dashboard')

  useEffect(() => {
    void (async () => {
      if (!loadToken()) {
        setPhase('anon')
        return
      }
      const me = await api.me().catch(() => null)
      if (me?.role === 'admin') {
        setUser(me)
        setPhase('authed')
      } else {
        clearToken()
        setPhase('anon')
      }
    })()
  }, [])

  if (phase === 'loading') {
    return <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">加载中…</div>
  }
  if (phase === 'anon') {
    return (
      <LoginPage
        onLoggedIn={(u) => {
          setUser({ id: '', email: u.email, name: u.email, role: 'admin' })
          setPhase('authed')
        }}
      />
    )
  }

  return (
    <div className="flex h-full">
      {/* 侧栏 */}
      <aside className="flex w-52 shrink-0 flex-col border-r border-[var(--line)] bg-white">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand)] text-sm font-bold text-white">
            ✓
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">滴答清单</p>
            <p className="text-[11px] text-[var(--muted)]">管理后台</p>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-2">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
                view === id ? 'bg-[var(--brand)]/10 font-medium text-[var(--brand)]' : 'text-[var(--muted)] hover:bg-gray-50',
              )}
              onClick={() => setView(id)}
            >
              <Icon size={16} strokeWidth={1.75} /> {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-[var(--line)] p-3">
          <p className="truncate px-1 text-xs text-[var(--muted)]">{user?.email}</p>
          <div className="mt-2 flex gap-1.5">
            <a
              className="btn flex-1 px-2 text-xs"
              href="./"
              target="_blank"
              rel="noreferrer"
              title="打开任务应用（同 Worker 部署时）"
            >
              <Settings2 size={13} /> 应用
            </a>
            <button
              className="btn flex-1 px-2 text-xs"
              onClick={() => {
                void api.signOut().catch(() => undefined)
                setUser(null)
                setPhase('anon')
              }}
            >
              <LogOut size={13} /> 登出
            </button>
          </div>
        </div>
      </aside>

      {/* 主内容 */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        {view === 'dashboard' && <Dashboard />}
        {view === 'users' && <Users />}
        {view === 'logs' && <Logs />}
      </main>
    </div>
  )
}
