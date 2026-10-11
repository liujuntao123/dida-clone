import { useState } from 'react'
import { Folder, Inbox, Pencil, Plus } from 'lucide-react'
import { PageHeader } from '../components/common/PageHeader'
import { EntityFormPage } from '../components/common/EntityFormPage'
import { useAppStore } from '../store/useAppStore'
import { useToastStore } from '../store/useToastStore'
import { useBackHandler } from '../lib/backNav'
import { PALETTE } from '../lib/constants'
import { cn } from '../lib/cn'
import type { TaskList } from '../types'

/** 清单管理页：列表 + 新建/编辑表单（名称 + 颜色）。 */
export function ListsPage() {
  const lists = useAppStore((s) => s.lists)
  const tasks = useAppStore((s) => s.tasks)
  const addList = useAppStore((s) => s.addList)
  const updateList = useAppStore((s) => s.updateList)
  const deleteList = useAppStore((s) => s.deleteList)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const lastListView = useAppStore((s) => s.lastListView)
  const goBack = () => setActiveView(lastListView)
  const showToast = useToastStore((s) => s.show)

  const [mode, setMode] = useState<'list' | 'form'>('list')
  const [editing, setEditing] = useState<TaskList | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PALETTE[0])
  // Android 返回键：清单表单页先回到清单列表，而不是直接退出模块页
  useBackHandler(mode === 'form', () => {
    setMode('list')
    return true
  })

  const todoCount = (listId: string) =>
    tasks.filter((t) => !t.parentId && t.status === 'todo' && t.listId === listId).length

  const openAdd = () => {
    setEditing(null)
    setName('')
    setColor(PALETTE[lists.length % PALETTE.length])
    setMode('form')
  }

  const openEdit = (l: TaskList) => {
    setEditing(l)
    setName(l.name)
    setColor(l.color)
    setMode('form')
  }

  const save = () => {
    const clean = name.trim()
    if (!clean) return
    if (editing) {
      updateList(editing.id, { name: clean, color })
      showToast('清单已更新')
    } else {
      addList(clean, color)
      showToast('清单已创建')
    }
    setMode('list')
  }

  if (mode === 'form') {
    return (
      <EntityFormPage
        title={editing ? '编辑清单' : '添加清单'}
        icon={<Folder size={19} strokeWidth={2} />}
        iconColor={color}
        name={name}
        onNameChange={setName}
        color={color}
        onColorChange={setColor}
        canSave={!!name.trim()}
        onSave={save}
        onBack={() => setMode('list')}
        deleteLabel={editing && !editing.isInbox ? '删除清单' : undefined}
        onDelete={
          editing && !editing.isInbox
            ? () => {
                if (!editing) return
                if (!window.confirm(`删除清单「${editing.name}」？其中任务将移入收集箱。`)) return
                deleteList(editing.id)
                showToast('清单已删除')
                setMode('list')
              }
            : undefined
        }
      />
    )
  }

  const inbox = lists.find((l) => l.isInbox)
  const customLists = lists.filter((l) => !l.isInbox)

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--color-surface-2)]">
      <PageHeader
        title="清单"
        onBack={goBack}
        subtitle={`${customLists.length} 个清单`}
        right={
          <button
            type="button"
            aria-label="添加清单"
            onClick={openAdd}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-[var(--color-fg)] active:bg-[var(--color-surface-2)]"
          >
            <Plus size={22} strokeWidth={2} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-3">
        <div className="overflow-hidden rounded-2xl bg-[var(--color-card)]">
          {inbox && (
            <button
              type="button"
              className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left active:bg-[var(--color-surface-2)]"
              onClick={() => setActiveView({ kind: 'smart', id: 'inbox' })}
            >
              <Inbox size={19} strokeWidth={2} className="shrink-0 text-brand" />
              <span className="min-w-0 flex-1 truncate text-sm">收集箱</span>
              <span className="tnum text-xs text-[var(--color-muted)]">{todoCount(inbox.id) || ''}</span>
            </button>
          )}
          {customLists.map((l, i) => (
            <div key={l.id} className={cn('flex items-center pr-1.5', (i > 0 || inbox) && 'row-divider')}>
              <button
                type="button"
                className="flex min-h-[52px] flex-1 items-center gap-3 px-4 text-left active:bg-[var(--color-surface-2)]"
                onClick={() => setActiveView({ kind: 'list', id: l.id })}
              >
                <Folder size={19} strokeWidth={2} style={{ color: l.color }} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm">{l.name}</span>
                <span className="tnum text-xs text-[var(--color-muted)]">{todoCount(l.id) || ''}</span>
              </button>
              <button
                type="button"
                aria-label={`编辑清单 ${l.name}`}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-[var(--color-muted)] active:bg-[var(--color-surface-2)]"
                onClick={() => openEdit(l)}
              >
                <Pencil size={16} strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>

        {customLists.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
            <Folder size={26} strokeWidth={1.5} className="text-[var(--color-muted)]/60" />
            <p className="text-xs text-[var(--color-muted)]">还没有自定义清单，点右上角 + 新建</p>
          </div>
        )}
      </div>
    </div>
  )
}
