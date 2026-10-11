import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { api, ApiError, getBase, setBase } from '../api'

/** 管理员登录页（管理员 = 服务端 ADMIN_EMAIL 对应账号） */
export function LoginPage({ onLoggedIn }: { onLoggedIn: (user: { email: string }) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [base, setBaseState] = useState(getBase())
  const [showBase, setShowBase] = useState(!getBase())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      setBase(base)
      const user = await api.signIn(email.trim().toLowerCase(), password)
      if (user.role !== 'admin') {
        await api.signOut().catch(() => undefined)
        setError('该账号不是管理员')
        return
      }
      onLoggedIn(user)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) setError('服务地址不正确或服务不可用')
        else if (err.status === 401) setError('邮箱或密码不正确')
        else if (err.status === 429) setError('尝试过于频繁，请稍后再试')
        else setError(err.message)
      } else {
        setError('网络错误，请检查服务地址')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand)] text-lg font-bold text-white">
            ✓
          </div>
          <h1 className="text-lg font-semibold">滴答清单 · 管理后台</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">仅管理员账号可登录</p>
        </div>
        <form onSubmit={(e) => void submit(e)} className="card space-y-3 p-5">
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">邮箱</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-[var(--muted)]">密码</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
            />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <button type="submit" className="btn btn-primary w-full" disabled={busy || !email || !password}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : '登录'}
          </button>
          <button
            type="button"
            className="w-full text-center text-xs text-[var(--muted)] hover:underline"
            onClick={() => setShowBase((v) => !v)}
          >
            {showBase ? '收起服务设置' : '服务地址设置'}
          </button>
          {showBase && (
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--muted)]">Worker 地址（留空 = 同源）</span>
              <input
                className="input"
                type="url"
                value={base}
                onChange={(e) => setBaseState(e.target.value)}
                placeholder="https://dida-clone-sync.xxx.workers.dev"
              />
            </label>
          )}
        </form>
      </div>
    </div>
  )
}
