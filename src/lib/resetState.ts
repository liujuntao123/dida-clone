import { useAppStore } from '../store/useAppStore'
import { seedLists, seedTags, seedTasks } from './seed'

/** 登出后把本地应用状态重置为全新种子态（设备本地的数据留在云端，可重新登录取回） */
export function resetToSeed(): void {
  useAppStore.setState({
    lists: seedLists,
    tags: seedTags,
    tasks: seedTasks,
    activeView: { kind: 'smart', id: 'today' },
    selectedTaskId: null,
    sortBy: 'due',
    calendarMode: 'month',
    filter: { priorities: [], listIds: [], tagIds: [], query: '' },
    sidebarOpen: false,
    notifiedReminders: [],
  })
}
