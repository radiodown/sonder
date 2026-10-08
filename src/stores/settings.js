import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const WALLPAPERS = [
  { id: 'sequoia', name: 'Sequoia' },
  { id: 'sunset', name: 'Sunset' },
  { id: 'aurora', name: 'Aurora' },
  { id: 'graphite', name: 'Graphite' },
]

export const useSettings = create(
  persist(
    (set) => ({
      theme: 'system', // 'system' | 'light' | 'dark'
      wallpaper: 'sequoia',
      refraction: true,
      platform: 'auto', // 'auto' | 'desktop' | 'mobile'
      // 책장 보기
      shelfView: 'grid', // 'grid'(아이콘) | 'list'(목록) | 'spine'(책등)
      shelfSort: 'recent', // 'recent' | 'title' | 'publisher'
      shelfScale: 1, // 아이콘·책등 크기 배율 (0.6 ~ 1.6)
      readingGoals: {}, // { [연도]: 목표 권수 }
      set: (patch) => set(patch),
    }),
    { name: 'library2-settings' },
  ),
)
