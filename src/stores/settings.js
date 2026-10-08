import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const WALLPAPERS = [
  { id: 'solar', name: 'Solar' }, // 시간에 따라 색이 바뀜 (lib/solar.js)
  { id: 'graphite', name: 'Graphite' },
]

/** 저장된 값이 없어진 배경화면(예전 Sequoia·Sunset·Aurora)이면 Solar 로 */
export const wallpaperId = (id) => (WALLPAPERS.some((w) => w.id === id) ? id : 'solar')

export const GLASS_DEFAULTS = { blur: 5, clarity: 0.5 }
export const WINDOW_DEFAULTS = { blur: 40, clarity: 0.2 }

/** 투명도(0~1) → 유리 배경색 진하기 배율. 0.5 가 기본(1배), 1 이면 색 없이 맑은 유리 */
export const glassOpacity = (clarity) => 2 * (1 - clarity)
/** 투명도(0~1) → 창 배경 진하기 배율. 0.2 가 기본(1배 = 86%), 0 이면 불투명, 1 이면 아주 맑게 */
export const windowOpacity = (clarity) => 1.2 - clarity

// 기본값. 설정 초기화도 이 값으로 되돌립니다.
const DEFAULTS = {
  theme: 'system', // 'system' | 'light' | 'dark'
  wallpaper: 'solar',
  solarTime: 'auto', // 'auto'(시각대로) 또는 lib/solar.js 의 단계 id 로 고정
  // 유리 효과 (설정 > 화면 > 유리 효과)
  glassBlur: GLASS_DEFAULTS.blur, // 흐림 px
  glassClarity: GLASS_DEFAULTS.clarity, // 투명도 0(진함) ~ 1(맑음)
  // 데스크톱 창 본체 (설정 > 화면 > 창)
  windowBlur: WINDOW_DEFAULTS.blur,
  windowClarity: WINDOW_DEFAULTS.clarity,
  platform: 'auto', // 'auto' | 'desktop' | 'mobile'
  dockIconStyle: 'tinted', // Dock·Spotlight 앱 아이콘: 'tinted'(색조 유리) | 'clear'(투명 유리) | 'solid'(불투명)
  // 책장 보기
  shelfView: 'grid', // 'grid'(아이콘) | 'list'(목록) | 'spine'(책등)
  shelfSort: 'recent', // 'recent' | 'title' | 'publisher'
  shelfScale: 1, // 아이콘·책등 크기 배율 (0.6 ~ 1.6)
  readingGoals: {}, // { [연도]: 목표 권수 }
}

export const useSettings = create(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      /** 모든 설정을 기본값으로. 연간 독서 목표는 기록이라 남깁니다. */
      reset: () => set(({ readingGoals }) => ({ ...DEFAULTS, readingGoals })),
    }),
    { name: 'library2-settings' },
  ),
)
