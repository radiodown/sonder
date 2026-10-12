import { NotePencilIcon, TrashIcon, XIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useNav } from '../../lib/nav'
import { toast } from 'sonner'
import { STATUSES, cancelReread, dayKey, deleteBook, deleteRead, updateBook } from '../../db/db'
import { BookCover } from '../../ui/BookCover'
import { confirmDialog } from '../../ui/ConfirmDialog'
import { Segmented } from '../../ui/Segmented'
import { StarRating } from '../../ui/StarRating'
import { byline } from '../../ui/byline'
import { lookupTranslators } from './api'
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

/** 시작일·완독일 고치기 (통계에 쓰입니다). 날짜만 고르면 그날 정오로 저장합니다. */
function DateRow({ label, value, onChange, max }) {
  const [today] = useState(() => dayKey(Date.now()))
  return (
    <label className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-ink-2">{label}</span>
      <input
        type="date"
        value={value ? dayKey(value) : ''}
        max={max ? dayKey(max) : today}
        onChange={(e) => e.target.value && onChange(new Date(`${e.target.value}T12:00`).getTime())}
        className="rounded-md bg-transparent text-right font-medium outline-none [color-scheme:inherit] focus:ring-2 focus:ring-accent/50"
      />
    </label>
  )
}

const fmtDay = (ts) => (ts ? new Date(ts).toLocaleDateString('ko-KR') : '?')

/** 지난 회독 목록. 다 읽음 → 읽는 중으로 바꾸면 그 회독이 여기로 옵니다. */
function PastReads({ book }) {
  if (!book.reads?.length) return null
  const remove = async (i) => {
    const ok = await confirmDialog({
      title: `${i + 1}회독 기록을 지울까요?`,
      message: '통계와 캘린더에서도 빠집니다.',
      confirmLabel: '지우기',
      destructive: true,
    })
    if (ok) deleteRead(book.id, i)
  }
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-ink-2">지난 독서</h2>
      <div className="divide-y divide-line rounded-2xl bg-fill/60 px-4">
        {book.reads.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-2.5 text-sm">
            <span className="text-ink-2">{i + 1}회독</span>
            <span className="ml-auto font-medium tabular-nums">
              {r.startedAt ? `${fmtDay(r.startedAt)} – ` : ''}
              {fmtDay(r.finishedAt)}
            </span>
            <button onClick={() => remove(i)} aria-label={`${i + 1}회독 기록 지우기`} className="text-ink-3 active:opacity-60">
              <XIcon size={14} weight="bold" />
            </button>
          </div>
        ))}
      </div>
    </section>
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
// 카카오는 소개를 앞부분만 잘라서 줍니다. 문장이 끝나지 않은 채 끊겼으면 … 을 붙입니다.
const SENTENCE_END = /[.!?。…"'”’」』)\]]\s*$/
function description(book) {
  const text = book.description.trimEnd()
  return book.source === 'kakao' && !SENTENCE_END.test(text) ? `${text}…` : text
}

/**
 * 역자 정보가 생기기 전에 추가한 책은 처음 열 때 ISBN 으로 역자를 찾아 채웁니다.
 * (찾았는데 없으면 [] 로 저장해서 다시 묻지 않고, 실패하면 다음에 열 때 다시 시도)
 */
function useTranslatorBackfill(book) {
  const missing = book && book.translators === undefined && book.source !== 'manual' && book.isbn
  useEffect(() => {
    if (!missing) return
    let alive = true
    lookupTranslators(book.isbn).then((translators) => {
      if (alive && translators) updateBook(book.id, { translators })
    })
    return () => {
      alive = false
    }
  }, [missing, book?.id, book?.isbn])
}

export function BookDetail({ bookId, onDeleted }) {
  const book = useBook(bookId)
  useTranslatorBackfill(book)

  if (book === undefined) return null
  if (!book) return <div className="p-10 text-center text-ink-2">책을 찾을 수 없습니다</div>

  const remove = async () => {
    const ok = await confirmDialog({
      title: `'${book.title}'을(를) 책장에서 삭제할까요?`,
      message: '이 책의 독후감도 함께 삭제됩니다.',
      confirmLabel: '삭제',
      destructive: true,
    })
    if (!ok) return
    await deleteBook(book.id)
    toast('책을 삭제했습니다')
    onDeleted?.()
  }

  const changeStatus = async (status) => {
    const reread = book.status === 'done' && status === 'reading' && book.finishedAt
    await updateBook(book.id, { status })
    if (reread)
      toast(`${(book.reads?.length ?? 0) + 2}회독을 시작했어요`, {
        description: '지난 완독 기록은 그대로 남겨 둡니다',
        action: { label: '되돌리기', onClick: () => cancelReread(book.id) },
      })
  }
  const round = (book.reads?.length ?? 0) + 1 // 지금 몇 번째 읽는지

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-5 pb-10">
      {/* 표지 색이 화면 전체에 번지는 배경. 스크롤해도 제자리에 있고, 아래로 갈수록 옅어집니다.
          (화면·창이 transform 을 가지고 있어서 fixed 는 그 화면·창 기준으로 붙습니다) */}
      {book.cover && (
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_30%,rgb(0_0_0/0.45))]">
          <img src={book.cover} alt="" className="h-full w-full scale-150 object-cover opacity-40 blur-3xl" />
        </div>
      )}
      <div className="flex justify-center pb-2 pt-6">
        <BookCover book={book} className="w-40" />
      </div>

      <div className="text-center">
        <h1 className="text-xl font-bold leading-tight" data-selectable>
          {book.title}
        </h1>
        <p className="mt-1 text-ink-2">{byline(book)}</p>
        {round > 1 && book.status !== 'want' && (
          <p className="mt-1.5 text-xs font-semibold text-accent">{book.status === 'done' ? `${round}번 읽은 책` : `${round}회독 중`}</p>
        )}
      </div>

      <div className="flex flex-col items-center gap-4">
        <Segmented
          options={STATUSES.map((s) => ({ value: s.id, label: s.label }))}
          value={book.status}
          onChange={changeStatus}
        />
        <StarRating value={book.rating} onChange={(rating) => updateBook(book.id, { rating })} />
      </div>

      <section className="divide-y divide-line rounded-2xl bg-fill/60 px-4">
        <Meta label="출판사" value={book.publisher} />
        <Meta label="출간일" value={book.publishedDate} />
        <Meta label="쪽수" value={book.pageCount ? `${book.pageCount}쪽` : ''} />
        <Meta label="ISBN" value={book.isbn} />
        <Meta label="추가한 날" value={new Date(book.createdAt).toLocaleDateString('ko-KR')} />
        {(book.status === 'reading' || book.status === 'done') && (
          <DateRow label="시작한 날" value={book.startedAt} max={book.finishedAt} onChange={(startedAt) => updateBook(book.id, { startedAt })} />
        )}
        {book.status === 'done' && (
          <DateRow label="다 읽은 날" value={book.finishedAt} onChange={(finishedAt) => updateBook(book.id, { finishedAt })} />
        )}
      </section>

      <PastReads book={book} />

      <BookReviews bookId={book.id} />

      <MemoField key={book.id} book={book} />

      {book.description && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-ink-2">소개</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed" data-selectable>
            {description(book)}
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
