import { useState } from 'react'
import { Check, Folder, Inbox, Pencil, Plus, Trash2, X } from 'lucide-react'
import { PageHeader } from '../components/common/PageHeader'
import { ColorPicker } from '../components/common/ColorPicker'
import { useAppStore } from '../store/useAppStore'
import { useToastStore } from '../store/useToastStore'
import { useBackHandler } from '../lib/backNav'
import { LIST_COLORS } from '../lib/constants'
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
  const [color, setColor] = useState<string>(LIST_COLORS[0])
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
    setColor(LIST_COLORS[lists.length % LIST_COLORS.length])
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
      <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--color-surface-2)]">
        <PageHeader
          title={editing ? '编辑清单' : '添加清单'}
          onBack={() => setMode('list')}
          right={
            <>
              {!editing?.isInbox && editing && (
                <button
                  type="button"
                  aria-label="删除清单"
                  className="flex min-h-11 min-w-11 items-center justify-center text-red-500 active:opacity-70"
                  onClick={() => {
                    if (!editing) return
                    if (!window.confirm(`删除清单「${editing.name}」？其中任务将移入收集箱。`)) return
                    deleteList(editing.id)
                    showToast('清单已删除')
                    setMode('list')
                  }}
                >
                  <Trash2 size={20} />
                </button>
              )}
              <button
                type="button"
                aria-label="保存"
                disabled={!name.trim()}
                className="flex min-h-11 min-w-11 items-center justify-center text-[var(--color-fg)] active:opacity-70 disabled:opacity-30"
                onClick={save}
              >
                <Check size={24} />
              </button>
            </>
          }
        />
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex min-h-14 items-center gap-3 rounded-2xl bg-[var(--color-card)] px-4">
            <Folder size={20} className="shrink-0 text-[var(--color-muted)]" />
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
              }}
              placeholder="名称"
              className="accent-caret min-h-14 w-full bg-transparent text-[16px] outline-none placeholder:text-[var(--color-muted)]"
            />
            {name && (
              <button
                type="button"
                aria-label="清空名称"
                onClick={() => setName('')}
                className="text-[var(--color-muted)]"
              >
                <X size={18} />
              </button>
            )}
          </div>

          <div className="mt-3 rounded-2xl bg-[var(--color-card)] p-4">
            <div className="mb-4 text-[15px] font-medium">颜色</div>
            <ColorPicker value={color} onChange={setColor} allowNone={false} />
          </div>
        </div>
      </div>
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
            className="flex min-h-11 min-w-11 items-center justify-center text-[var(--color-fg)] active:opacity-70"
          >
            <Plus size={22} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-3">
        <div className="overflow-hidden rounded-2xl bg-[var(--color-card)]">
          {inbox && (
            <button
              type="button"
              className="flex min-h-12 w-full items-center gap-3 px-4 text-left active:bg-[var(--color-surface-2)]"
              onClick={() => setActiveView({ kind: 'smart', id: 'inbox' })}
            >
              <Inbox size={18} className="shrink-0 text-brand" />
              <span className="min-w-0 flex-1 truncate text-[15px]">收集箱</span>
              <span className="text-sm text-[var(--color-muted)]">{todoCount(inbox.id) || ''}</span>
            </button>
          )}
          {customLists.map((l, i) => (
            <div
              key={l.id}
              className={cn(
                'flex items-center pr-1',
                (i > 0 || inbox) && 'border-t border-[var(--color-border)]',
              )}
            >
              <button
                type="button"
                className="flex min-h-12 flex-1 items-center gap-3 px-4 text-left active:bg-[var(--color-surface-2)]"
                onClick={() => setActiveView({ kind: 'list', id: l.id })}
              >
                <Folder size={18} style={{ color: l.color }} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[15px]">{l.name}</span>
                <span className="text-sm text-[var(--color-muted)]">{todoCount(l.id) || ''}</span>
              </button>
              <button
                type="button"
                aria-label={`编辑清单 ${l.name}`}
                className="flex min-h-11 min-w-11 items-center justify-center text-[var(--color-muted)] active:opacity-70"
                onClick={() => openEdit(l)}
              >
                <Pencil size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
