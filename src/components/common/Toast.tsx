import { useToastStore } from '../../store/useToastStore'
import { useIsMobile } from '../../hooks/useIsMobile'

export function ToastHost() {
  const isMobile = useIsMobile()
  const message = useToastStore((s) => s.message)
  const undo = useToastStore((s) => s.undo)
  const undoLabel = useToastStore((s) => s.undoLabel)
  const dismiss = useToastStore((s) => s.dismiss)

  if (!message) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[100] flex justify-center px-3"
      style={{
        bottom: isMobile
          ? 'max(16px, calc(3.5rem + 12px + env(safe-area-inset-bottom, 0px)))'
          : 'max(16px, env(safe-area-inset-bottom, 0px))',
      }}
      role="status"
    >
      <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-[#1C1C1E] px-4 py-3 text-sm text-white shadow-lg ring-1 ring-white/10">
        <span className="flex-1">{message}</span>
        {undo && (
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-lg px-3 font-medium text-brand hover:bg-white/10"
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
          className="min-h-11 min-w-11 shrink-0 rounded-lg text-white/50 hover:bg-white/10"
          aria-label="关闭"
          onClick={dismiss}
        >
          ×
        </button>
      </div>
    </div>
  )
}
