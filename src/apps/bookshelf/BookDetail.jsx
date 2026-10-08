import { NotePencilIcon, TrashIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useNav } from '../../lib/nav'
import { toast } from 'sonner'
import { STATUSES, deleteBook, updateBook } from '../../db/db'
import { BookCover } from '../../ui/BookCover'
import { Segmented } from '../../ui/Segmented'
import { StarRating } from '../../ui/StarRating'
import { useBook } from './hooks'
import { useBookReviews } from '../reviews/hooks'
import { ReviewRow } from '../reviews/ReviewList'

function Meta({ label, value }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <span className="text-ink-2">{label}</span>
      <span className="text-right font-medium" data-selectable>
        {value}
      </span>
    </div>
  )
}

function MemoField({ book }) {
  const [memo, setMemo] = useState(book.memo ?? '')
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-ink-2">메모</h2>
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        onBlur={() => memo !== (book.memo ?? '') && updateBook(book.id, { memo })}
        placeholder="이 책에 대한 생각을 적어보세요"
        rows={4}
        className="w-full resize-none rounded-2xl bg-fill/60 p-4 text-sm outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-accent/50"
      />
    </section>
  )
}

function BookReviews({ bookId }) {
  const nav = useNav()
  const reviews = useBookReviews(bookId)
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-2">독후감 {reviews?.length ? reviews.length : ''}</h2>
        <button
          onClick={() => nav.newReview(bookId)}
          className="flex items-center gap-1 text-sm font-semibold text-accent active:opacity-60"
        >
          <NotePencilIcon size={17} /> 독후감 쓰기
        </button>
      </div>
      {reviews?.length > 0 ? (
        <div className="rounded-2xl bg-fill/60 p-1">
          {reviews.map((r) => (
            <ReviewRow key={r.id} review={r} showBook={false} onClick={() => nav.openReview(r.id)} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-fill/60 px-4 py-5 text-center text-sm text-ink-3">아직 이 책의 독후감이 없어요</p>
      )}
    </section>
  )
}

/** 책 상세. 데스크톱 창과 모바일 화면이 함께 씁니다. */
export function BookDetail({ bookId, onDeleted }) {
  const book = useBook(bookId)

  if (book === undefined) return null
  if (!book) return <div className="p-10 text-center text-ink-2">책을 찾을 수 없습니다</div>

  const remove = async () => {
    if (!confirm(`'${book.title}'을(를) 책장에서 삭제할까요?
이 책의 독후감도 함께 삭제됩니다.`)) return
    await deleteBook(book.id)
    toast('책을 삭제했습니다')
    onDeleted?.()
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10">
      <div className="relative -mx-5 flex justify-center overflow-hidden px-5 pb-2 pt-6">
        {/* 표지 색이 번지는 배경 */}
        {book.cover && (
          <img src={book.cover} alt="" className="absolute inset-0 h-full w-full scale-150 object-cover opacity-40 blur-3xl" />
        )}
        <BookCover book={book} className="relative w-40" />
      </div>

      <div className="text-center">
        <h1 className="text-xl font-bold leading-tight" data-selectable>
          {book.title}
        </h1>
        <p className="mt-1 text-ink-2">{book.authors?.join(', ')}</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Segmented
          options={STATUSES.map((s) => ({ value: s.id, label: s.label }))}
          value={book.status}
          onChange={(status) => updateBook(book.id, { status })}
        />
        <StarRating value={book.rating} onChange={(rating) => updateBook(book.id, { rating })} />
      </div>

      <section className="divide-y divide-line rounded-2xl bg-fill/60 px-4">
        <Meta label="출판사" value={book.publisher} />
        <Meta label="출간일" value={book.publishedDate} />
        <Meta label="쪽수" value={book.pageCount ? `${book.pageCount}쪽` : ''} />
        <Meta label="ISBN" value={book.isbn} />
        <Meta label="추가한 날" value={new Date(book.createdAt).toLocaleDateString('ko-KR')} />
      </section>

      <BookReviews bookId={book.id} />

      <MemoField key={book.id} book={book} />

      {book.description && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-2">소개</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed" data-selectable>
            {book.description}
          </p>
        </section>
      )}

      <button
        onClick={remove}
        className="flex items-center justify-center gap-2 rounded-2xl bg-fill/60 py-3 text-sm font-semibold text-red-500 active:opacity-70"
      >
        <TrashIcon size={18} /> 책장에서 삭제
      </button>
    </div>
  )
}
