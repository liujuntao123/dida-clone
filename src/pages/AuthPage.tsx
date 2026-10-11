import { useState, type FormEvent } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '../lib/cn'
import { authApi, authErrorMessage } from '../lib/auth'
import { completeLogin } from '../lib/session'
import { getApiBase, getApiBaseOverride, setApiBaseOverride } from '../lib/config'
import { useSessionStore } from '../store/useSessionStore'

type Mode = 'login' | 'register'

/**
 * 登录 / 注册页。
 * 注册只需邮箱 + 密码（用户名由服务端从邮箱派生）；自托管者可在「高级选项」改服务地址。
 */
export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [advanced, setAdvanced] = useState(false)
  const [serverUrl, setServerUrl] = useState(getApiBaseOverride())
  const notice = useSessionStore((s) => s.notice)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !password) {
      setError('请输入邮箱和密码')
      return
    }
    if (mode === 'register') {
      if (password.length < 8) {
        setError('密码至少 8 位')
        return
      }
      if (password !== confirm) {
        setError('两次输入的密码不一致')
        return
      }
    }

    setApiBaseOverride(serverUrl)
    setBusy(true)
    try {
      if (mode === 'login') {
        await authApi.signInEmail({ email: trimmedEmail, password })
      } else {
        await authApi.signUpEmail({
          email: trimmedEmail,
          password,
          name: trimmedEmail.split('@')[0] || '用户',
        })
      }
      await completeLogin()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-dvh flex-col items-center justify-center overflow-y-auto bg-[var(--color-surface-2)] px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-brand)] text-xl font-bold text-white shadow-lg">
            ✓
          </div>
          <h1 className="text-xl font-semibold text-[var(--color-fg)]">滴答清单</h1>
          <p className="mt-1 text-xs text-[var(--color-muted)]">登录后多端同步你的任务</p>
        </div>

        <div className="rounded-2xl bg-[var(--color-card)] p-5 shadow-sm dark:ring-1 dark:ring-white/10">
          <div className="mb-4 flex rounded-xl bg-[var(--color-surface-2)] p-1">
            {(
              [
                ['login', '登录'],
                ['register', '注册'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={mode === id}
                className={cn(
                  'min-h-9 flex-1 rounded-lg text-sm font-medium transition',
                  mode === id
                    ? 'bg-[var(--color-card)] text-[var(--color-fg)] shadow-sm dark:ring-1 dark:ring-white/15'
                    : 'text-[var(--color-muted)]',
                )}
                onClick={() => {
                  setMode(id)
                  setError(null)
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={(e) => void submit(e)}>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs text-[var(--color-muted)]">邮箱</span>
              <input
                type="email"
                autoComplete="email"
                enterKeyHint="next"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="field-focus w-full rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--color-muted)]/60"
              />
            </label>
            <label className="mb-1 block">
              <span className="mb-1 block text-xs text-[var(--color-muted)]">密码</span>
              <input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                enterKeyHint={mode === 'register' ? 'next' : 'done'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? '至少 8 位' : '密码'}
                className="field-focus w-full rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--color-muted)]/60"
              />
            </label>
            {mode === 'register' && (
              <label className="animate-fade-in mb-1 mt-3 block">
                <span className="mb-1 block text-xs text-[var(--color-muted)]">确认密码</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  enterKeyHint="done"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="再输一遍"
                  className="field-focus w-full rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--color-muted)]/60"
                />
              </label>
            )}

            {(error || notice) && (
              <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-500">
                {error ?? notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="btn-primary mt-4 min-h-11 w-full text-sm disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> {mode === 'login' ? '登录中…' : '注册中…'}
                </>
              ) : mode === 'login' ? (
                '登录'
              ) : (
                '创建账号'
              )}
            </button>
          </form>

          <button
            type="button"
            aria-expanded={advanced}
            className="mt-4 flex w-full items-center justify-center gap-1 text-xs text-[var(--color-muted)] active:opacity-70"
            onClick={() => setAdvanced((v) => !v)}
          >
            高级选项
            <ChevronDown size={13} strokeWidth={2} className={cn('transition', !advanced && '-rotate-90')} />
          </button>
          {advanced && (
            <label className="animate-fade-in mt-3 block border-t border-[var(--color-surface-2)] pt-3">
              <span className="mb-1 block text-xs text-[var(--color-muted)]">
                服务地址（自托管 Worker，留空使用默认）
              </span>
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://dida-clone-sync.xxx.workers.dev"
                className="field-focus w-full rounded-xl bg-[var(--color-surface-2)] px-3 py-2.5 text-xs outline-none placeholder:text-[var(--color-muted)]/60"
              />
              <span className="mt-1.5 block break-all text-[11px] text-[var(--color-muted)]/80">
                当前：{getApiBase() || '同源服务'}
              </span>
            </label>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-[var(--color-muted)]/80">
          数据加密传输并保存在云端，支持离线使用
        </p>
      </div>
    </div>
  )
}
