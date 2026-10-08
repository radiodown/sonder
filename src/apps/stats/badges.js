import { dayKey, isEmptyReview } from '../../db/db'
import { sunTimes } from '../../lib/solar'
import { READING_TYPES } from './stats'

/**
 * 업적 배지 64개. 책·독후감·활동 기록에서 그때그때 계산합니다 (따로 저장하는 건 "언제 처음 받았나" 뿐).
 * check(ctx) → { done, progress? } · progress 는 아직 못 받은 배지에 보여 줄 "3 / 5" 같은 글
 * id 는 받은 기록의 열쇠라서 한 번 정하면 바꾸지 않습니다.
 */

const DAY = 86_400_000

export const BADGE_GROUPS = [
  { id: 'finish', label: '완독' },
  { id: 'shelf', label: '책장' },
  { id: 'pages', label: '쪽수 · 두께' },
  { id: 'pace', label: '속도' },
  { id: 'streak', label: '꾸준함' },
  { id: 'time', label: '시간대' },
  { id: 'review', label: '독후감 · 메모' },
  { id: 'rating', label: '별점' },
  { id: 'taste', label: '작가 · 출판사' },
  { id: 'era', label: '시대' },
  { id: 'goal', label: '목표' },
]

// ───────────── 도우미 ─────────────

/** 기록이 있는 날들 중 가장 길게 이어진 일수 */
function longestStreak(days) {
  const sorted = [...days].sort()
  let best = 0
  let run = 0
  let prev = null
  for (const d of sorted) {
    const [y, m, dd] = d.split('-').map(Number)
    const t = new Date(y, m - 1, dd).getTime()
    run = prev !== null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = t
  }
  return best
}

const minutesOf = (ts) => {
  const d = new Date(ts)
  return d.getHours() * 60 + d.getMinutes()
}
const pubYear = (b) => {
  const y = parseInt(String(b.publishedDate ?? '').slice(0, 4), 10)
  return y > 0 ? y : null
}
const maxCount = (values) => {
  const map = new Map()
  for (const v of values) if (v) map.set(v, (map.get(v) ?? 0) + 1)
  return Math.max(0, ...map.values())
}
const distinct = (values) => new Set(values.filter(Boolean)).size

const count = (n, goal) => ({ done: n >= goal, progress: `${Math.min(n, goal).toLocaleString()} / ${goal.toLocaleString()}` })
const yes = (done) => ({ done })

/** 같은 형태의 단계별 배지를 한 번에 */
const tiers = (group, list, value) =>
  list.map(([id, emoji, title, desc, goal]) => ({ id, group, emoji, title, desc, check: (c) => count(value(c), goal) }))

// ───────────── 배지 ─────────────

export const BADGES = [
  // 완독 (8)
  ...tiers(
    'finish',
    [
      ['first-finish', '📗', '첫 완독', '책 한 권을 끝까지 읽었어요', 1],
      ['finish-5', '📘', '다섯 권', '다 읽은 책 5권', 5],
      ['finish-10', '📚', '열 권', '다 읽은 책 10권', 10],
      ['finish-25', '🗂️', '스물다섯 권', '다 읽은 책 25권', 25],
      ['finish-50', '🏛️', '작은 도서관', '다 읽은 책 50권', 50],
      ['finish-100', '💯', '백 권', '다 읽은 책 100권', 100],
      ['finish-200', '🏰', '서재의 주인', '다 읽은 책 200권', 200],
      ['finish-500', '🌌', '책의 우주', '다 읽은 책 500권', 500],
    ],
    (c) => c.finished.length,
  ),

  // 책장 (7)
  ...tiers(
    'shelf',
    [
      ['add-1', '🪴', '첫 책 담기', '책장에 첫 책을 담았어요', 1],
      ['add-10', '🧺', '책 수집가', '책장에 책 10권', 10],
      ['add-50', '🗄️', '꽉 찬 책장', '책장에 책 50권', 50],
      ['add-100', '🏬', '책 부자', '책장에 책 100권', 100],
    ],
    (c) => c.books.length,
  ),
  {
    id: 'reading-3',
    group: 'shelf',
    emoji: '🤹',
    title: '동시에 세 권',
    desc: '읽는 중인 책이 3권 이상',
    check: (c) => count(c.books.filter((b) => b.status === 'reading').length, 3),
  },
  {
    id: 'want-20',
    group: 'shelf',
    emoji: '🛒',
    title: '위시리스트',
    desc: '읽고 싶은 책 20권',
    check: (c) => count(c.books.filter((b) => b.status === 'want').length, 20),
  },
  {
    id: 'finally',
    group: 'shelf',
    emoji: '⏳',
    title: '드디어',
    desc: '담아 두고 반년 넘게 지나 읽기 시작했어요',
    check: (c) => yes(c.books.some((b) => b.startedAt && b.createdAt && b.startedAt - b.createdAt >= 180 * DAY)),
  },

  // 쪽수 · 두께 (7)
  ...tiers(
    'pages',
    [
      ['pages-1k', '📄', '천 쪽', '다 읽은 쪽수 1,000쪽', 1000],
      ['pages-5k', '📑', '오천 쪽', '다 읽은 쪽수 5,000쪽', 5000],
      ['pages-10k', '📜', '만 쪽', '다 읽은 쪽수 10,000쪽', 10000],
      ['pages-30k', '🏔️', '삼만 쪽', '다 읽은 쪽수 30,000쪽', 30000],
      ['pages-100k', '🌋', '십만 쪽', '다 읽은 쪽수 100,000쪽', 100000],
    ],
    (c) => c.pages,
  ),
  {
    id: 'brick',
    group: 'pages',
    emoji: '🧱',
    title: '벽돌책',
    desc: '800쪽이 넘는 책을 다 읽었어요',
    check: (c) => yes(c.finished.some((b) => b.pageCount >= 800)),
  },
  {
    id: 'mega-brick',
    group: 'pages',
    emoji: '🗿',
    title: '초벽돌',
    desc: '1,200쪽이 넘는 책을 다 읽었어요',
    check: (c) => yes(c.finished.some((b) => b.pageCount >= 1200)),
  },

  // 속도 (5)
  {
    id: 'one-sitting',
    group: 'pace',
    emoji: '⚡',
    title: '단숨에',
    desc: '읽기 시작한 날 다 읽었어요',
    check: (c) => yes(c.durations.some((d) => d.sameDay)),
  },
  {
    id: 'in-a-week',
    group: 'pace',
    emoji: '🏃',
    title: '일주일 완독',
    desc: '시작하고 7일 안에 다 읽었어요',
    check: (c) => yes(c.durations.some((d) => d.days <= 7)),
  },
  {
    id: 'two-a-day',
    group: 'pace',
    emoji: '✌️',
    title: '하루 두 권',
    desc: '같은 날 두 권을 다 읽었어요',
    check: (c) => yes(maxCount(c.finished.map((b) => dayKey(b.finishedAt))) >= 2),
  },
  {
    id: 'slow-reader',
    group: 'pace',
    emoji: '🐢',
    title: '느긋하게',
    desc: '1년 넘게 붙잡고 있던 책을 끝냈어요',
    check: (c) => yes(c.durations.some((d) => d.days > 365)),
  },
  {
    id: 'month-5',
    group: 'pace',
    emoji: '🚀',
    title: '한 달 다섯 권',
    desc: '한 달에 5권을 다 읽었어요',
    check: (c) => count(maxCount(c.finished.map((b) => dayKey(b.finishedAt).slice(0, 7))), 5),
  },

  // 꾸준함 (7)
  ...tiers(
    'streak',
    [
      ['streak-3', '🌱', '사흘 연속', '3일 동안 빠짐없이 기록했어요', 3],
      ['streak-7', '🔥', '일주일 연속', '7일 동안 빠짐없이 기록했어요', 7],
      ['streak-14', '🌿', '2주 연속', '14일 동안 빠짐없이 기록했어요', 14],
      ['streak-30', '🌳', '한 달 연속', '30일 동안 빠짐없이 기록했어요', 30],
      ['streak-100', '🏆', '백일 연속', '100일 동안 빠짐없이 기록했어요', 100],
    ],
    (c) => c.streak,
  ),
  {
    id: 'every-month',
    group: 'streak',
    emoji: '🗓️',
    title: '사계절 독자',
    desc: '한 해 열두 달 모두 한 권 이상 다 읽었어요',
    check: (c) => {
      const byYear = new Map()
      for (const b of c.finished) {
        const k = new Date(b.finishedAt).getFullYear()
        byYear.set(k, (byYear.get(k) ?? new Set()).add(new Date(b.finishedAt).getMonth()))
      }
      return count(Math.max(0, ...[...byYear.values()].map((s) => s.size)), 12)
    },
  },
  {
    id: 'new-year',
    group: 'streak',
    emoji: '🎍',
    title: '새해 첫 독서',
    desc: '1월 1일에 독서 기록을 남겼어요',
    check: (c) => yes(c.reading.some((a) => a.day.endsWith('-01-01'))),
  },

  // 시간대 (5) — 직접 쓴 시각이 남는 독후감·메모 기준
  {
    id: 'dawn',
    group: 'time',
    emoji: '🌅',
    title: '새벽 독서',
    desc: '해 뜰 무렵에 독후감이나 메모를 썼어요',
    // Solar 배경화면과 같은 해돋이 시각 기준: 해 뜨기 1시간 전 ~ 30분 뒤
    check: (c) =>
      yes(
        c.writes.some((a) => {
          const { sunrise } = sunTimes(new Date(a.at))
          const m = minutesOf(a.at)
          return m >= sunrise - 60 && m <= sunrise + 30
        }),
      ),
  },
  {
    id: 'commute',
    group: 'time',
    emoji: '🚇',
    title: '출근길',
    desc: '아침 7~9시에 독후감이나 메모를 썼어요',
    check: (c) => yes(c.writes.some((a) => minutesOf(a.at) >= 7 * 60 && minutesOf(a.at) < 9 * 60)),
  },
  {
    id: 'lunch',
    group: 'time',
    emoji: '🍱',
    title: '점심시간',
    desc: '낮 12~1시에 독후감이나 메모를 썼어요',
    check: (c) => yes(c.writes.some((a) => minutesOf(a.at) >= 12 * 60 && minutesOf(a.at) < 13 * 60)),
  },
  {
    id: 'night-owl',
    group: 'time',
    emoji: '🦉',
    title: '올빼미',
    desc: '자정부터 새벽 4시 사이에 독후감이나 메모를 썼어요',
    check: (c) => yes(c.writes.some((a) => minutesOf(a.at) < 4 * 60)),
  },
  {
    id: 'weekend',
    group: 'time',
    emoji: '🛋️',
    title: '주말 독서가',
    desc: '주말 10일 동안 독서 기록을 남겼어요',
    check: (c) =>
      count(
        distinct(
          c.reading
            .filter((a) => {
              const [y, m, d] = a.day.split('-').map(Number)
              const w = new Date(y, m - 1, d).getDay()
              return w === 0 || w === 6
            })
            .map((a) => a.day),
        ),
        10,
      ),
  },

  // 독후감 · 메모 (9)
  ...tiers(
    'review',
    [
      ['first-review', '📝', '첫 독후감', '독후감을 처음 썼어요', 1],
      ['review-5', '✏️', '다섯 편', '독후감 5편', 5],
      ['review-10', '🖋️', '기록하는 사람', '독후감 10편', 10],
      ['review-30', '📓', '두꺼운 노트', '독후감 30편', 30],
      ['review-100', '🏅', '서평가', '독후감 100편', 100],
    ],
    (c) => c.reviews.length,
  ),
  {
    id: 'long-review',
    group: 'review',
    emoji: '📖',
    title: '장문가',
    desc: '3,000자가 넘는 독후감을 썼어요',
    check: (c) => yes(c.reviews.some((r) => (r.text ?? '').length >= 3000)),
  },
  {
    id: 'ruminate',
    group: 'review',
    emoji: '🔁',
    title: '곱씹기',
    desc: '한 책에 독후감을 3편 썼어요',
    check: (c) => count(maxCount(c.reviews.map((r) => r.bookId)), 3),
  },
  {
    id: 'first-memo',
    group: 'review',
    emoji: '🗒️',
    title: '첫 메모',
    desc: '책에 메모를 남겼어요',
    check: (c) => count(c.memos, 1),
  },
  {
    id: 'memo-10',
    group: 'review',
    emoji: '📌',
    title: '메모광',
    desc: '책 10권에 메모를 남겼어요',
    check: (c) => count(c.memos, 10),
  },

  // 별점 (4)
  {
    id: 'first-rating',
    group: 'rating',
    emoji: '⭐',
    title: '첫 별점',
    desc: '책에 별점을 매겼어요',
    check: (c) => count(c.rated.length, 1),
  },
  {
    id: 'five-star',
    group: 'rating',
    emoji: '🌟',
    title: '인생책',
    desc: '별 다섯 개를 준 책이 생겼어요',
    check: (c) => yes(c.rated.some((b) => b.rating >= 5)),
  },
  {
    id: 'one-star',
    group: 'rating',
    emoji: '🧊',
    title: '냉정한 평가',
    desc: '별 하나를 준 책이 있어요',
    check: (c) => yes(c.rated.some((b) => b.rating === 1)),
  },
  {
    id: 'critic',
    group: 'rating',
    emoji: '🎩',
    title: '평론가',
    desc: '책 20권에 별점을 매겼어요',
    check: (c) => count(c.rated.length, 20),
  },

  // 작가 · 출판사 (6)
  {
    id: 'author-3',
    group: 'taste',
    emoji: '💌',
    title: '눈여겨본 작가',
    desc: '한 작가의 책을 3권 다 읽었어요',
    check: (c) => count(c.topAuthor, 3),
  },
  {
    id: 'author-5',
    group: 'taste',
    emoji: '✍️',
    title: '애정하는 작가',
    desc: '한 작가의 책을 5권 다 읽었어요',
    check: (c) => count(c.topAuthor, 5),
  },
  {
    id: 'authors-20',
    group: 'taste',
    emoji: '🌍',
    title: '넓은 세계',
    desc: '서로 다른 작가 20명의 책을 다 읽었어요',
    check: (c) => count(distinct(c.finished.map((b) => b.authors?.[0])), 20),
  },
  {
    id: 'publishers-10',
    group: 'taste',
    emoji: '🏷️',
    title: '출판사 탐방',
    desc: '서로 다른 출판사 10곳의 책을 다 읽었어요',
    check: (c) => count(distinct(c.finished.map((b) => b.publisher?.trim())), 10),
  },
  {
    id: 'translated',
    group: 'taste',
    emoji: '🌐',
    title: '번역서',
    desc: '번역된 책을 다 읽었어요',
    check: (c) => count(c.translated, 1),
  },
  {
    id: 'translated-10',
    group: 'taste',
    emoji: '🗺️',
    title: '세계 문학 여행',
    desc: '번역된 책 10권을 다 읽었어요',
    check: (c) => count(c.translated, 10),
  },

  // 시대 (3)
  {
    id: 'classic',
    group: 'era',
    emoji: '🏺',
    title: '고전',
    desc: '1950년 이전에 나온 책을 다 읽었어요',
    check: (c) => yes(c.pubYears.some((y) => y <= 1950)),
  },
  {
    id: 'fresh',
    group: 'era',
    emoji: '🥐',
    title: '따끈한 신간',
    desc: '나온 해에 바로 다 읽었어요',
    check: (c) => yes(c.finished.some((b) => pubYear(b) === new Date(b.finishedAt).getFullYear())),
  },
  {
    id: 'time-traveler',
    group: 'era',
    emoji: '🕰️',
    title: '시간 여행자',
    desc: '다 읽은 책들의 출간 연도가 100년 넘게 차이 나요',
    check: (c) => yes(c.pubYears.length > 1 && Math.max(...c.pubYears) - Math.min(...c.pubYears) >= 100),
  },

  // 목표 (3)
  {
    id: 'goal-set',
    group: 'goal',
    emoji: '🧭',
    title: '목표 세우기',
    desc: '한 해 독서 목표를 정했어요',
    check: (c) => yes(Object.values(c.goals).some((g) => g > 0)),
  },
  {
    id: 'goal',
    group: 'goal',
    emoji: '🎯',
    title: '목표 달성',
    desc: '한 해 독서 목표를 채웠어요',
    check: (c) => yes(c.goalRatio >= 1),
  },
  {
    id: 'goal-double',
    group: 'goal',
    emoji: '🌠',
    title: '목표의 두 배',
    desc: '한 해 독서 목표의 두 배를 읽었어요',
    check: (c) => yes(c.goalRatio >= 2),
  },
]

/** 배지마다 { ...배지, done, progress } */
export function evaluateBadges({ books, reviews, activity, goals = {} }) {
  const finished = books.filter((b) => b.status === 'done' && b.finishedAt)
  const reading = activity.filter((a) => READING_TYPES.includes(a.type))
  const finishedByYear = (year) => finished.filter((b) => new Date(b.finishedAt).getFullYear() === Number(year)).length

  const ctx = {
    books,
    finished,
    reading,
    reviews: reviews.filter((r) => !isEmptyReview(r)),
    // 날짜를 고른 기록(시작·완독)은 시각이 정확하지 않아서, 직접 쓴 시각이 남는 독후감·메모만 봅니다
    writes: activity.filter((a) => a.type === 'review' || a.type === 'memo'),
    streak: longestStreak(new Set(reading.map((a) => a.day))),
    pages: finished.reduce((s, b) => s + (b.pageCount > 0 ? b.pageCount : 0), 0),
    durations: finished
      .filter((b) => b.startedAt && b.finishedAt >= b.startedAt)
      .map((b) => ({ days: (b.finishedAt - b.startedAt) / DAY, sameDay: dayKey(b.startedAt) === dayKey(b.finishedAt) })),
    memos: books.filter((b) => b.memo?.trim()).length,
    rated: books.filter((b) => b.rating > 0),
    topAuthor: maxCount(finished.map((b) => b.authors?.[0])),
    translated: finished.filter((b) => b.translators?.length).length,
    pubYears: finished.map(pubYear).filter(Boolean),
    goals,
    // 목표를 정한 해 중 가장 많이 채운 비율
    goalRatio: Math.max(0, ...Object.entries(goals).filter(([, g]) => g > 0).map(([y, g]) => finishedByYear(y) / g)),
  }
  return BADGES.map((b) => ({ ...b, ...b.check(ctx) }))
}
