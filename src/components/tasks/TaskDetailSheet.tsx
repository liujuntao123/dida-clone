import { useState } from 'react'
import { Drawer } from 'vaul'
import { useAppStore } from '../../store/useAppStore'
import { TaskDetail } from './TaskDetail'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useBackHandler } from '../../lib/backNav'

/**
 * Mobile-only bottom sheet for task detail (vaul).
 * Desktop keeps the side panel inside TaskListPanel.
 *
 * NOTE: vaul requires an explicit height on Drawer.Content when using
 * snapPoints, otherwise the sheet is positioned off-screen.
 */
export function TaskDetailSheet() {
  const isMobile = useIsMobile()
  const selectedTaskId = useAppStore((s) => s.selectedTaskId)
  const setSelectedTaskId = useAppStore((s) => s.setSelectedTaskId)
  const open = isMobile && !!selectedTaskId
  const [snap, setSnap] = useState<number | string | null>(0.55)

  // Android 返回键：先关详情抽屉，再考虑视图回退
  useBackHandler(open, () => {
    setSelectedTaskId(null)
    setSnap(0.55)
    return true
  })

  if (!isMobile) return null

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setSelectedTaskId(null)
          setSnap(0.55)
        }
      }}
      snapPoints={[0.55, 0.92]}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content className="sheet-92 fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-[var(--color-card)] outline-none">
          <div className="mx-auto mt-2 mb-1 h-1 w-9 shrink-0 rounded-full bg-[var(--color-muted)]/40" />
          <Drawer.Title className="sr-only">任务详情</Drawer.Title>
          <Drawer.Description className="sr-only">查看并编辑所选任务</Drawer.Description>
          <div className="min-h-0 flex-1 overflow-hidden">
            <TaskDetail variant="sheet" />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
