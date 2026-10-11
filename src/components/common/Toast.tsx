import { X } from 'lucide-react'
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
      <div className="animate-slide-up pointer-events-auto flex max-w-md items-center gap-1 rounded-full bg-[#1C1C1E]/95 py-1.5 pl-4 pr-1.5 text-sm text-white shadow-xl ring-1 ring-white/10 backdrop-blur">
        <span className="flex-1 py-1.5">{message}</span>
        {undo && (
          <button
            type="button"
            className="min-h-11 shrink-0 rounded-full px-3 font-medium text-brand active:bg-white/10"
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
          className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full text-white/45 active:bg-white/10"
          aria-label="关闭"
          onClick={dismiss}
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
