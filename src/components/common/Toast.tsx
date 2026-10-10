import { useToastStore } from '../../store/useToastStore'

export function ToastHost() {
  const message = useToastStore((s) => s.message)
  const undo = useToastStore((s) => s.undo)
  const undoLabel = useToastStore((s) => s.undoLabel)
  const dismiss = useToastStore((s) => s.dismiss)

  if (!message) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-3"
      style={{ bottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
      role="status"
    >
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-700">
        <span className="flex-1">{message}</span>
        {undo && (
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-lg px-3 font-medium text-blue-300 hover:bg-white/10"
            onClick={() => {
              undo()
              dismiss()
            }}
          >
            {undoLabel}
          </button>
        )}
        <button
          type="button"
          className="min-h-11 min-w-11 shrink-0 rounded-lg text-slate-300 hover:bg-white/10"
          aria-label="关闭"
          onClick={dismiss}
        >
          ×
        </button>
      </div>
    </div>
  )
}
