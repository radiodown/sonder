import { dayKey } from '../../db/db'

const DAY = 86_400_000
// 히트맵에 세는 활동 (책 추가는 독서가 아니라서 뺍니다)
export const READING_TYPES = ['start', 'finish', 'review', 'memo']
export const TYPE_LABELS = { start: '읽기 시작', finish: '완독', review: '독후감', memo: '메모' }

const yearOf = (ts) => new Date(ts).getFullYear()
const inYear = (ts, year) => !!ts && yearOf(ts) === year

/** 툴팁을 띄울 요소 위쪽 가운데 좌표 */
export function anchorOf(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top }
}

/** 활동 수 → 히트맵 단계(0~4) */
export function heatLevel(n) {
  if (!n) return 0
  if (n === 1) return 1
  if (n === 2) return 2
  if (n <= 4) return 3
  return 4
}

function median(nums) {
  if (!nums.length) return null
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** 'YYYY-MM-DD' 의 하루 뒤 */
function nextDay(key) {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + 1).getTime())
}

/** 정렬된 날짜 목록에서 가장 긴 연속 일수 */
function longestRun(days) {
  let best = 0
  let run = 0
  let prev = null
  for (const d of days) {
    run = prev && nextDay(prev) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

/** 오늘(또는 오늘 아직 기록이 없으면 어제)부터 거꾸로 이어진 연속 일수 */
function currentRun(daySet, now) {
  let cursor = new Date(now)
  if (!daySet.has(dayKey(cursor.getTime()))) cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1)
  let run = 0
  while (daySet.has(dayKey(cursor.getTime()))) {
    run++
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1)
  }
  return run
}

function topCounts(values, n = 5) {
  const map = new Map()
  for (const v of values) if (v) map.set(v, (map.get(v) ?? 0) + 1)
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
    .slice(0, n)
    .map(([label, value]) => ({ label, value }))
}

/**
 * 통계 전체를 계산합니다.
 * year 로 묶이는 것: 활동·완독·쪽수·월별·요일별·작가/출판사
 * 책장 전체 기준: 상태 분포·별점·오래 기다린 책
 */
export function computeStats({ books, reviews, activity, year, now = Date.now() }) {
  const thisYear = yearOf(now)
  const reading = activity.filter((a) => READING_TYPES.includes(a.type))

  // 연도 목록 (기록이 있는 해 + 올해)
  const years = [...new Set([thisYear, ...reading.map((a) => yearOf(a.at)), ...books.map((b) => b.finishedAt && yearOf(b.finishedAt)).filter(Boolean)])].sort(
    (a, b) => b - a,
  )

  // 날짜별 활동 (선택한 해)
  const byDay = new Map()
  for (const a of reading) {
    if (!a.day.startsWith(`${year}-`)) continue
    const cell = byDay.get(a.day) ?? { total: 0, start: 0, finish: 0, review: 0, memo: 0 }
    cell.total++
    cell[a.type]++
    byDay.set(a.day, cell)
  }
  const activeDays = [...byDay.keys()].sort()

  // 완독
  const finished = books.filter((b) => b.status === 'done' && inYear(b.finishedAt, year))
  const monthly = Array.from({ length: 12 }, (_, m) => finished.filter((b) => new Date(b.finishedAt).getMonth() === m).length)
  const withPages = finished.filter((b) => b.pageCount > 0)
  const durations = finished
    .filter((b) => b.startedAt && b.finishedAt >= b.startedAt)
    .map((b) => Math.max(1, Math.round((b.finishedAt - b.startedAt) / DAY)))

  // 요일별 활동 (월~일)
  const weekday = Array(7).fill(0)
  for (const [day, cell] of byDay) {
    const [y, m, d] = day.split('-').map(Number)
    weekday[(new Date(y, m - 1, d).getDay() + 6) % 7] += cell.total
  }

  const allReadingDays = new Set(reading.map((a) => a.day))
  const currentMonth = new Date(now).getMonth()

  return {
    year,
    years,
    isCurrentYear: year === thisYear,
    byDay,
    activeDayCount: activeDays.length,
    activityTotal: [...byDay.values()].reduce((s, c) => s + c.total, 0),
    finishedCount: finished.length,
    finishedThisMonth: year === thisYear ? monthly[currentMonth] : null,
    pages: withPages.reduce((s, b) => s + b.pageCount, 0),
    pagesBookCount: withPages.length,
    medianDays: median(durations),
    durationCount: durations.length,
    reviewsWritten: reviews.filter((r) => inYear(r.createdAt, year) && (r.title?.trim() || r.text?.trim())).length,
    currentStreak: year === thisYear ? currentRun(allReadingDays, now) : null,
    longestStreak: longestRun(activeDays),
    monthly,
    weekday,
    topAuthors: topCounts(finished.map((b) => b.authors?.[0])),
    topPublishers: topCounts(finished.map((b) => b.publisher?.trim())),
    // 책장 전체
    status: {
      want: books.filter((b) => b.status === 'want').length,
      reading: books.filter((b) => b.status === 'reading').length,
      done: books.filter((b) => b.status === 'done').length,
    },
    ratings: [1, 2, 3, 4, 5].map((r) => books.filter((b) => b.rating === r).length),
    backlog: books
      .filter((b) => b.status === 'want')
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, 5)
      .map((b) => ({ ...b, waitingDays: Math.floor((now - b.createdAt) / DAY) })),
  }
}
