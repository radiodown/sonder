import { create } from 'zustand'

/**
 * 모바일 통계 화면에서 고른 탭과 연도. 아래 탭바로 다른 화면에 다녀와도 그대로 남습니다.
 * (탭 화면은 바꿀 때마다 새로 그려지므로 화면 안의 state 로는 기억할 수 없음)
 */
export const useStatsTab = create((set) => ({
  tab: 'summary',
  year: new Date().getFullYear(),
  setTab: (tab) => set({ tab }),
  setYear: (year) => set({ year }),
}))
