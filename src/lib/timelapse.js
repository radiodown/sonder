import { create } from 'zustand'

/**
 * 숨은 기능: 메뉴바 시계를 길게 누르면 Solar 배경화면이 24시간을 5초 만에 돌아 보여 줍니다.
 * minute 은 타임랩스 속 지금 시각(자정부터 분), 돌고 있지 않으면 null.
 */
export const useTimelapse = create(() => ({ minute: null }))

const DURATION = 5_000 // ms
const DAY_MIN = 24 * 60

/** 타임랩스 속 분 → 오늘 날짜의 그 시각 */
export function dateAtMinute(minute) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return new Date(d.getTime() + minute * 60_000)
}

export function startTimelapse() {
  if (useTimelapse.getState().minute !== null) return
  const now = new Date()
  const from = now.getHours() * 60 + now.getMinutes() // 지금 시각에서 출발해 한 바퀴 돌아 지금으로
  const t0 = performance.now()
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / DURATION)
    // 양 끝은 천천히, 가운데는 빠르게
    const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
    useTimelapse.setState({ minute: p < 1 ? (from + eased * DAY_MIN) % DAY_MIN : null })
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}
