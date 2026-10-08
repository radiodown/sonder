import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'

const collator = new Intl.Collator('ko', { numeric: true, sensitivity: 'base' })
const authorKey = (b) => (b.authors ?? []).join(', ')

/** 빈 값은 항상 뒤로 보내는 비교 */
function compareText(a, b) {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return collator.compare(a, b)
}

/**
 * - recent: 최근 추가 순
 * - title: 제목 → 저자
 * - publisher: 출판사 → 저자 → 제목 (출판사 없는 책은 맨 뒤)
 */
export function sortBooks(list, sort) {
  const by = {
    recent: (a, b) => b.createdAt - a.createdAt,
    title: (a, b) => compareText(a.title, b.title) || compareText(authorKey(a), authorKey(b)),
    publisher: (a, b) =>
      compareText(a.publisher?.trim(), b.publisher?.trim()) ||
      compareText(authorKey(a), authorKey(b)) ||
      compareText(a.title, b.title),
  }[sort] ?? ((a, b) => b.createdAt - a.createdAt)
  return list.sort(by)
}

export function useBooks(status = 'all', sort = 'recent', search = '') {
  return useLiveQuery(async () => {
    let list = status === 'all' ? await db.books.toArray() : await db.books.where('status').equals(status).toArray()
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((b) => `${b.title} ${b.authors.join(' ')} ${b.publisher ?? ''}`.toLowerCase().includes(q))
    return sortBooks(list, sort)
  }, [status, sort, search])
}

export function useBook(id) {
  // undefined = 로딩 중, null = 없음
  return useLiveQuery(async () => (id ? ((await db.books.get(Number(id))) ?? null) : null), [id])
}

export function useCounts() {
  return useLiveQuery(async () => {
    const c = { all: 0, want: 0, reading: 0, done: 0 }
    await db.books.each((b) => {
      c.all++
      c[b.status] = (c[b.status] ?? 0) + 1
    })
    return c
  }, [])
}
