import { useState } from 'react'
import { Pencil, Plus, Tag as TagIcon } from 'lucide-react'
import { PageHeader } from '../components/common/PageHeader'
import { EntityFormPage } from '../components/common/EntityFormPage'
import { useAppStore } from '../store/useAppStore'
import { useToastStore } from '../store/useToastStore'
import { useBackHandler } from '../lib/backNav'
import { PALETTE } from '../lib/constants'
import { cn } from '../lib/cn'
import type { Tag } from '../types'

/** 无颜色时用于展示/存储的兜底灰色。 */
const NO_COLOR = '#9ca3af'

/**
 * 标签管理页：列表 + 新建/编辑表单（参考滴答清单「添加标签」页：
 * 返回关闭 / 居中标题 / ✓ 保存，名称卡片 + 颜色卡片 + 删除行）。
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
  const [color, setColor] = useState<string>(PALETTE[4])
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
    setColor(PALETTE[tags.length % PALETTE.length])
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
      <EntityFormPage
        title={editing ? '编辑标签' : '添加标签'}
        icon={<TagIcon size={18} strokeWidth={2} />}
        iconColor={color || NO_COLOR}
        name={name}
        onNameChange={setName}
        color={color}
        onColorChange={setColor}
        canSave={!!name.trim()}
        onSave={save}
        onBack={() => setMode('list')}
        deleteLabel={editing ? '删除标签' : undefined}
        onDelete={
          editing
            ? () => {
                if (!editing) return
                if (!window.confirm(`删除标签「${editing.name}」？将从所有任务移除。`)) return
                deleteTag(editing.id)
                showToast('标签已删除')
                setMode('list')
              }
            : undefined
        }
      />
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
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-[var(--color-fg)] active:bg-[var(--color-surface-2)]"
          >
            <Plus size={22} strokeWidth={2} />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-3">
        {tags.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
            <TagIcon size={26} strokeWidth={1.5} className="text-[var(--color-muted)]/60" />
            <p className="text-xs text-[var(--color-muted)]">暂无标签，点右上角 + 新建</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-[var(--color-card)]">
            {tags.map((t, i) => (
              <div key={t.id} className={cn('flex items-center pr-1.5', i > 0 && 'row-divider')}>
                <button
                  type="button"
                  className="flex min-h-[52px] flex-1 items-center gap-3 px-4 text-left active:bg-[var(--color-surface-2)]"
                  onClick={() => setActiveView({ kind: 'tag', id: t.id })}
                >
                  <TagIcon size={18} strokeWidth={2} style={{ color: t.color }} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">{t.name}</span>
                  <span className="tnum text-xs text-[var(--color-muted)]">{todoCount(t.id) || ''}</span>
                </button>
                <button
                  type="button"
                  aria-label={`编辑标签 ${t.name}`}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-[var(--color-muted)] active:bg-[var(--color-surface-2)]"
                  onClick={() => openEdit(t)}
                >
                  <Pencil size={16} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
