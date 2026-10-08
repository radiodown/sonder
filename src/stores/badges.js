import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 받은 배지와 받은 시각. 배지 자체는 기록에서 계산하고(apps/stats/badges.js), 여기는 "언제 처음 받았나"만 남깁니다.
 * initialized: 처음 한 번은 이미 받을 자격이 있는 배지를 알림 없이 조용히 채웁니다.
 */
export const useBadges = create(
  persist(
    (set) => ({
      earned: {}, // { [배지 id]: 받은 시각 }
      initialized: false,
      award: (ids, at = Date.now()) =>
        set((s) => ({ initialized: true, earned: { ...s.earned, ...Object.fromEntries(ids.map((id) => [id, at])) } })),
    }),
    { name: 'library2-badges' },
  ),
)
