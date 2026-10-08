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

export const STATUSES = [
  { id: 'want', label: '읽고 싶은' },
  { id: 'reading', label: '읽는 중' },
  { id: 'done', label: '다 읽음' },
]

export function statusLabel(id) {
  return STATUSES.find((s) => s.id === id)?.label ?? ''
}

export async function findByIsbn(isbn) {
  if (!isbn) return undefined
  return db.books.where('isbn').equals(isbn).first()
}

export async function addBook(book) {
  if (await findByIsbn(book.isbn)) throw new Error('이미 책장에 있는 책입니다')
  const now = Date.now()
  return db.books.add({
    status: 'want',
    rating: 0,
    tags: [],
    memo: '',
    ...book,
    createdAt: now,
    updatedAt: now,
  })
}

export function updateBook(id, patch) {
  return db.books.update(id, { ...patch, updatedAt: Date.now() })
}

/** 책과 그 책의 독후감을 함께 지웁니다. */
export function deleteBook(id) {
  return db.transaction('rw', db.books, db.reviews, async () => {
    await db.reviews.where('bookId').equals(id).delete()
    await db.books.delete(id)
  })
}

// ───────────── 독후감 ─────────────

export function addReview(bookId) {
  const now = Date.now()
  return db.reviews.add({ bookId, title: '', content: '', text: '', createdAt: now, updatedAt: now })
}

export function updateReview(id, patch) {
  return db.reviews.update(id, { ...patch, updatedAt: Date.now() })
}

export function deleteReview(id) {
  return db.reviews.delete(id)
}

/** 제목도 본문도 없는 독후감 (편집기를 닫을 때 정리합니다) */
export const isEmptyReview = (r) => !r.title?.trim() && !r.text?.trim()

// ───────────── 백업 / 동기화 ─────────────
// 형식: { app: 'library2', version: 2, books: [...], reviews: [...] }  (version 1 은 reviews 없음)

export async function exportBooks() {
  const [books, reviews] = await Promise.all([db.books.toArray(), db.reviews.toArray()])
  return JSON.stringify({ app: 'library2', version: 2, exportedAt: new Date().toISOString(), books, reviews }, null, 2)
}

function parseBackup(json) {
  const data = JSON.parse(json)
  if (!Array.isArray(data.books)) throw new Error('올바른 백업 파일이 아닙니다')
  return { books: data.books, reviews: Array.isArray(data.reviews) ? data.reviews : [] }
}

/** 백업 JSON 으로 책장 전체를 바꿉니다 (Drive 불러오기). id 를 유지해 열린 창/화면이 그대로 동작합니다. */
export async function replaceBooks(json) {
  const { books, reviews } = parseBackup(json)
  await db.transaction('rw', db.books, db.reviews, async () => {
    await db.books.clear()
    await db.reviews.clear()
    await db.books.bulkAdd(books)
    await db.reviews.bulkAdd(reviews)
  })
  return books.length
}

/**
 * 백업 JSON 을 합칩니다. ISBN 이 같은 책은 새로 넣지 않고 기존 책에 독후감만 붙입니다.
 * 추가된 권수를 돌려줍니다.
 */
export async function importBooks(json) {
  const { books, reviews } = parseBackup(json)
  let added = 0
  await db.transaction('rw', db.books, db.reviews, async () => {
    const idMap = new Map() // 백업 속 책 id → 이 기기의 책 id
    for (const { id: oldId, ...b } of books) {
      const dup = b.isbn && (await findByIsbn(b.isbn))
      if (dup) {
        idMap.set(oldId, dup.id)
        continue
      }
      idMap.set(oldId, await db.books.add(b))
      added++
    }
    for (const { id: _id, bookId, ...r } of reviews) {
      if (idMap.has(bookId)) await db.reviews.add({ ...r, bookId: idMap.get(bookId) })
    }
  })
  return added
}
