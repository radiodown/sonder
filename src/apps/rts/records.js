/** 난이도별 전적. 이 브라우저에만 남는 기록이라 localStorage 에 둡니다 */
const KEY = 'library2-rts'

export function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

export function saveResult(difficulty, won, time) {
  const all = loadRecords()
  const r = all[difficulty] ?? { wins: 0, losses: 0, best: null }
  if (won) {
    r.wins++
    if (r.best == null || time < r.best) r.best = time
  } else r.losses++
  all[difficulty] = r
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // 저장 못 해도 게임은 계속
  }
  return r
}

export const clock = (sec) => {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
