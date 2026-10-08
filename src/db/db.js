import Dexie from 'dexie'

export const db = new Dexie('library2')

db.version(1).stores({
  books: '++id, isbn, title, status, createdAt, updatedAt',
})

// v2: 독후감. 한 책에 여러 편을 쓸 수 있습니다.
// { id, bookId, title, content(HTML), text(검색·미리보기용 평문), createdAt, updatedAt }
db.version(2).stores({
  books: '++id, isbn, title, status, createdAt, updatedAt',
  reviews: '++id, bookId, updatedAt',
})

// v3: 독서 활동 기록 (통계·캘린더 히트맵용)
// activity: { id, day: 'YYYY-MM-DD'(현지 날짜), at, type, bookId, ref? }
//   type: 'add'(책 추가) | 'start'(읽기 시작) | 'finish'(완독) | 'review'(독후감 작성) | 'memo'(메모 작성)
// books 에 startedAt / finishedAt 이 생깁니다. start/finish 기록은 이 두 날짜에서 만들어집니다.
db.version(3)
  .stores({
    books: '++id, isbn, title, status, createdAt, updatedAt',
    reviews: '++id, bookId, updatedAt',
    activity: '++id, day, type, bookId',
  })
  .upgrade(async (tx) => {
    // 기존 책: 정확한 날짜를 모르니 마지막 수정일을 시작/완독일로 둡니다 (책 정보에서 고칠 수 있음)
    await tx
      .table('books')
      .toCollection()
      .modify((b) => {
        if (b.status === 'done' && !b.finishedAt) b.finishedAt = b.updatedAt
        if (b.status === 'reading' && !b.startedAt) b.startedAt = b.updatedAt
      })
    const [books, reviews] = await Promise.all([tx.table('books').toArray(), tx.table('reviews').toArray()])
    await tx.table('activity').bulkAdd(deriveActivity(books, reviews))
  })

export const STATUSES = [
  { id: 'want', label: '읽고 싶은' },
  { id: 'reading', label: '읽는 중' },
  { id: 'done', label: '다 읽음' },
]

export function statusLabel(id) {
  return STATUSES.find((s) => s.id === id)?.label ?? ''
}

// ───────────── 활동 기록 ─────────────

/** 현지 시간 기준 'YYYY-MM-DD' */
export function dayKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const event = (type, bookId, at, ref) => ({ type, bookId, at, day: dayKey(at), ...(ref ? { ref } : {}) })

/** 기존 데이터(또는 활동 기록이 없는 옛 백업)에서 활동 기록을 만들어 냅니다. */
function deriveActivity(books, reviews) {
  const out = []
  for (const b of books) {
    out.push(event('add', b.id, b.createdAt))
    if (b.startedAt) out.push(event('start', b.id, b.startedAt))
    if (b.finishedAt) out.push(event('finish', b.id, b.finishedAt))
  }
  for (const r of reviews) {
    if (!isEmptyReview(r)) {
      out.push(event('review', r.bookId, r.createdAt, r.id))
      if (dayKey(r.updatedAt) !== dayKey(r.createdAt)) out.push(event('review', r.bookId, r.updatedAt, r.id))
    }
  }
  return out
}

/** 책의 시작·완독 기록을 startedAt / finishedAt 에 맞춰 다시 씁니다. */
async function syncDateEvents(book) {
  await db.activity
    .where('bookId')
    .equals(book.id)
    .filter((a) => a.type === 'start' || a.type === 'finish')
    .delete()
  if (book.startedAt) await db.activity.add(event('start', book.id, book.startedAt))
  if (book.finishedAt) await db.activity.add(event('finish', book.id, book.finishedAt))
}

/** 같은 날 같은 대상(ref)에 대한 기록은 한 번만 남깁니다 (독후감·메모를 여러 번 고쳐도 하루 1회). */
async function logOncePerDay(type, bookId, ref) {
  const now = Date.now()
  const day = dayKey(now)
  const exists = await db.activity
    .where('day')
    .equals(day)
    .filter((a) => a.type === type && a.ref === ref)
    .count()
  if (!exists) await db.activity.add(event(type, bookId, now, ref))
}

// ───────────── 책 ─────────────

export async function findByIsbn(isbn) {
  if (!isbn) return undefined
  return db.books.where('isbn').equals(isbn).first()
}

export async function addBook(book) {
  if (await findByIsbn(book.isbn)) throw new Error('이미 책장에 있는 책입니다')
  const now = Date.now()
  return db.transaction('rw', db.books, db.activity, async () => {
    const id = await db.books.add({
      status: 'want',
      rating: 0,
      tags: [],
      memo: '',
      ...book,
      createdAt: now,
      updatedAt: now,
    })
    await db.activity.add(event('add', id, now))
    return id
  })
}

/**
 * 책 정보를 고칩니다. 상태가 바뀌면 시작일·완독일을 함께 정리합니다.
 * - 읽는 중: 시작일이 없으면 오늘 (다시 읽기면 완독일은 지움)
 * - 다 읽음: 완독일 = 오늘
 * - 읽고 싶은: 시작일·완독일 지움
 */
export function updateBook(id, patch) {
  return db.transaction('rw', db.books, db.activity, async () => {
    const book = await db.books.get(id)
    if (!book) return
    const now = Date.now()
    const next = { ...patch, updatedAt: now }
    if (patch.status && patch.status !== book.status) {
      if (patch.status === 'reading') {
        next.startedAt = book.startedAt ?? now
        next.finishedAt = null
      } else if (patch.status === 'done') {
        next.finishedAt = now
      } else {
        next.startedAt = null
        next.finishedAt = null
      }
    }
    await db.books.update(id, next)
    if ('status' in patch || 'startedAt' in patch || 'finishedAt' in patch) await syncDateEvents({ ...book, ...next })
    if ('memo' in patch && patch.memo?.trim() && patch.memo !== book.memo) await logOncePerDay('memo', id, `memo-${id}`)
  })
}

/** 책과 그 책의 독후감·활동 기록을 함께 지웁니다. */
export function deleteBook(id) {
  return db.transaction('rw', db.books, db.reviews, db.activity, async () => {
    await db.reviews.where('bookId').equals(id).delete()
    await db.activity.where('bookId').equals(id).delete()
    await db.books.delete(id)
  })
}

// ───────────── 독후감 ─────────────

export function addReview(bookId) {
  const now = Date.now()
  return db.reviews.add({ bookId, title: '', content: '', text: '', createdAt: now, updatedAt: now })
}

export function updateReview(id, patch) {
  return db.transaction('rw', db.reviews, db.activity, async () => {
    await db.reviews.update(id, { ...patch, updatedAt: Date.now() })
    const r = await db.reviews.get(id)
    if (r && !isEmptyReview(r)) await logOncePerDay('review', r.bookId, id)
  })
}

export function deleteReview(id) {
  return db.transaction('rw', db.reviews, db.activity, async () => {
    await db.activity.where('type').equals('review').filter((a) => a.ref === id).delete()
    await db.reviews.delete(id)
  })
}

/** 제목도 본문도 없는 독후감 (편집기를 닫을 때 정리합니다) */
export function isEmptyReview(r) {
  return !r.title?.trim() && !r.text?.trim()
}

// ───────────── 백업 / 동기화 ─────────────
// 형식: { app: 'library2', version: 3, books, reviews, activity }
//   version 1: books 만 · version 2: + reviews · version 3: + activity (없으면 books/reviews 로 만들어 냅니다)

export async function exportBooks() {
  const [books, reviews, activity] = await Promise.all([db.books.toArray(), db.reviews.toArray(), db.activity.toArray()])
  return JSON.stringify(
    { app: 'library2', version: 3, exportedAt: new Date().toISOString(), books, reviews, activity },
    null,
    2,
  )
}

function parseBackup(json) {
  const data = JSON.parse(json)
  if (!Array.isArray(data.books)) throw new Error('올바른 백업 파일이 아닙니다')
  const books = data.books
  const reviews = Array.isArray(data.reviews) ? data.reviews : []
  const activity = Array.isArray(data.activity) ? data.activity : deriveActivity(books, reviews)
  return { books, reviews, activity }
}

/** 백업 JSON 으로 책장 전체를 바꿉니다 (Drive 불러오기). id 를 유지해 열린 창/화면이 그대로 동작합니다. */
export async function replaceBooks(json) {
  const { books, reviews, activity } = parseBackup(json)
  await db.transaction('rw', db.books, db.reviews, db.activity, async () => {
    await Promise.all([db.books.clear(), db.reviews.clear(), db.activity.clear()])
    await db.books.bulkAdd(books)
    await db.reviews.bulkAdd(reviews)
    await db.activity.bulkAdd(activity.map(({ id: _id, ...a }) => a))
  })
  return books.length
}

/**
 * 백업 JSON 을 합칩니다. ISBN 이 같은 책은 새로 넣지 않고 기존 책에 독후감·기록만 붙입니다.
 * 추가된 권수를 돌려줍니다.
 */
export async function importBooks(json) {
  const { books, reviews, activity } = parseBackup(json)
  let added = 0
  await db.transaction('rw', db.books, db.reviews, db.activity, async () => {
    const bookMap = new Map() // 백업 속 책 id → 이 기기의 책 id
    const reviewMap = new Map()
    const newBooks = new Set()
    for (const { id: oldId, ...b } of books) {
      const dup = b.isbn && (await findByIsbn(b.isbn))
      if (dup) {
        bookMap.set(oldId, dup.id)
        continue
      }
      const id = await db.books.add(b)
      bookMap.set(oldId, id)
      newBooks.add(id)
      added++
    }
    for (const { id: oldId, bookId, ...r } of reviews) {
      if (bookMap.has(bookId)) reviewMap.set(oldId, await db.reviews.add({ ...r, bookId: bookMap.get(bookId) }))
    }
    for (const { id: _id, bookId, ref, ...a } of activity) {
      const target = bookMap.get(bookId)
      if (!target) continue
      // 이미 있던 책의 추가·시작·완독 기록은 이 기기 것을 그대로 둡니다
      if (!newBooks.has(target) && ['add', 'start', 'finish'].includes(a.type)) continue
      const newRef = a.type === 'review' ? reviewMap.get(ref) : a.type === 'memo' ? `memo-${target}` : undefined
      if (a.type === 'review' && !newRef) continue
      await db.activity.add({ ...a, bookId: target, ...(newRef ? { ref: newRef } : {}) })
    }
  })
  return added
}
