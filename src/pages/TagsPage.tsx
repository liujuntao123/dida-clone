import { useState } from 'react'
import { Check, Pencil, Plus, Tag as TagIcon, Trash2, X } from 'lucide-react'
import { PageHeader } from '../components/common/PageHeader'
import { ColorPicker } from '../components/common/ColorPicker'
import { useAppStore } from '../store/useAppStore'
import { useToastStore } from '../store/useToastStore'
import { useBackHandler } from '../lib/backNav'
import { cn } from '../lib/cn'
import type { Tag } from '../types'

/** 无颜色时用于展示/存储的兜底灰色。 */
const NO_COLOR = '#9ca3af'

/**
 * 标签管理页：列表 + 新建/编辑表单（参考滴答清单「添加标签」页：
 * X 关闭 / 标题 / ✓ 保存，名称卡片 + 颜色卡片）。
 */
export function TagsPage() {
  const tags = useAppStore((s) => s.tags)
  const tasks = useAppStore((s) => s.tasks)
  const addTag = useAppStore((s) => s.addTag)
  const updateTag = useAppStore((s) => s.updateTag)
  const deleteTag = useAppStore((s) => s.deleteTag)
  const setActiveView = useAppStore((s) => s.setActiveView)
  const lastListView = useAppStore((s) => s.lastListView)
  const goBack = () => setActiveView(lastListView)
  const showToast = useToastStore((s) => s.show)

  const [mode, setMode] = useState<'list' | 'form'>('list')
  const [editing, setEditing] = useState<Tag | null>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>('#4d8ef7')
  // Android 返回键：标签表单页先回到标签列表
  useBackHandler(mode === 'form', () => {
    setMode('list')
    return true
  })

  const todoCount = (tagId: string) =>
    tasks.filter((t) => !t.parentId && t.status === 'todo' && t.tags.includes(tagId)).length

  const openAdd = () => {
    setEditing(null)
    setName('')
    setColor('#4d8ef7')
    setMode('form')
  }

  const openEdit = (t: Tag) => {
    setEditing(t)
    setName(t.name)
    setColor(t.color === NO_COLOR ? '' : t.color)
    setMode('form')
  }

  const save = () => {
    const clean = name.trim().replace(/^#/, '')
    if (!clean) return
    const dup = tags.find((t) => t.name === clean && t.id !== editing?.id)
    if (dup) {
      showToast('已存在同名标签')
      return
    }
    const finalColor = color || NO_COLOR
    if (editing) {
      updateTag(editing.id, { name: clean, color: finalColor })
      showToast('标签已更新')
    } else {
      addTag(clean, finalColor)
      showToast('标签已创建')
    }
    setMode('list')
  }

  if (mode === 'form') {
    return (
      <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--color-surface-2)]">
        <PageHeader
          title={editing ? '编辑标签' : '添加标签'}
          onBack={() => setMode('list')}
          right={
            <>
              {editing && (
                <button
                  type="button"
                  aria-label="删除标签"
                  className="flex min-h-11 min-w-11 items-center justify-center text-red-500 active:opacity-70"
                  onClick={() => {
                    if (!editing) return
                    if (!window.confirm(`删除标签「${editing.name}」？将从所有任务移除。`)) return
                    deleteTag(editing.id)
                    showToast('标签已删除')
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
            <TagIcon size={20} className="shrink-0 text-[var(--color-muted)]" />
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
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <div className="mt-3 flex min-h-12 items-center justify-between rounded-2xl bg-[var(--color-card)] px-4 text-[15px] text-[var(--color-muted)]">
            <span>上级标签</span>
            <span className="text-xs">暂不支持</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[var(--color-surface-2)]">
      <PageHeader
        title="标签"
        onBack={goBack}
        subtitle={`${tags.length} 个标签`}
        right={
          <button
            type="button"
            aria-label="添加标签"
            onClick={openAdd}
            className="flex min-h-11 min-w-11 items-center justify-center text-[var(--color-fg)] active:opacity-70"
          >
            <Plus size={22} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-3">
        {tags.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <TagIcon size={28} className="text-[var(--color-muted)]" />
            <p className="text-sm text-[var(--color-muted)]">暂无标签，点右上角 + 新建</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-[var(--color-card)]">
            {tags.map((t, i) => (
              <div
                key={t.id}
                className={cn('flex items-center pr-1', i > 0 && 'border-t border-[var(--color-border)]')}
              >
                <button
                  type="button"
                  className="flex min-h-12 flex-1 items-center gap-3 px-4 text-left active:bg-[var(--color-surface-2)]"
                  onClick={() => setActiveView({ kind: 'tag', id: t.id })}
                >
                  <TagIcon size={18} style={{ color: t.color }} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-[15px]">{t.name}</span>
                  <span className="text-sm text-[var(--color-muted)]">{todoCount(t.id) || ''}</span>
                </button>
                <button
                  type="button"
                  aria-label={`编辑标签 ${t.name}`}
                  className="flex min-h-11 min-w-11 items-center justify-center text-[var(--color-muted)] active:opacity-70"
                  onClick={() => openEdit(t)}
                >
                  <Pencil size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
