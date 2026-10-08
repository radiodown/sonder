import { BooksIcon, ListIcon, SquaresFourIcon } from '@phosphor-icons/react'
import { useSettings } from '../../stores/settings'

export const VIEWS = [
  { value: 'grid', label: '아이콘', Icon: SquaresFourIcon },
  { value: 'list', label: '목록', Icon: ListIcon },
  { value: 'spine', label: '책등', Icon: BooksIcon },
]

export const SORTS = [
  { value: 'recent', label: '최근 추가' },
  { value: 'title', label: '제목순' },
  { value: 'publisher', label: '출판사순', hint: '출판사 → 저자 → 제목' },
]

export const SIZE_STEPS = [
  { value: 0.75, label: '작게' },
  { value: 1, label: '보통' },
  { value: 1.3, label: '크게' },
]

/** 책장 보기 설정 (설정 저장소에 보관되어 다시 열어도 유지됩니다) */
export function useShelfPrefs() {
  const view = useSettings((s) => s.shelfView)
  const sort = useSettings((s) => s.shelfSort)
  const scale = useSettings((s) => s.shelfScale)
  const set = useSettings((s) => s.set)
  return {
    view,
    sort,
    scale,
    setView: (shelfView) => set({ shelfView }),
    setSort: (shelfSort) => set({ shelfSort }),
    setScale: (shelfScale) => set({ shelfScale }),
  }
}
