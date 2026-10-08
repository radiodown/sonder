import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'

/** 모든 독후감 (최근 수정 순), 각 항목에 book 을 붙여서 돌려줍니다. */
export function useReviews(search = '') {
  return useLiveQuery(async () => {
    const [reviews, books] = await Promise.all([db.reviews.orderBy('updatedAt').reverse().toArray(), db.books.toArray()])
    const byId = new Map(books.map((b) => [b.id, b]))
    const q = search.trim().toLowerCase()
    return reviews
      .map((r) => ({ ...r, book: byId.get(r.bookId) }))
      .filter((r) => !q || `${r.title} ${r.text} ${r.book?.title ?? ''}`.toLowerCase().includes(q))
  }, [search])
}

export function useBookReviews(bookId) {
  return useLiveQuery(
    async () => (bookId ? (await db.reviews.where('bookId').equals(Number(bookId)).sortBy('updatedAt')).reverse() : []),
    [bookId],
  )
}

/** undefined = 로딩 중, null = 없음 */
export function useReview(id) {
  return useLiveQuery(async () => (id ? ((await db.reviews.get(Number(id))) ?? null) : null), [id])
}

export function formatReviewDate(ts, withTime = false) {
  const d = new Date(ts)
  const today = new Date().toDateString() === d.toDateString()
  if (!withTime && today) return d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}
