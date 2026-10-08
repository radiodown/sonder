import { BookCover } from '../../ui/BookCover'
import { formatReviewDate } from './hooks'

/** 메모 앱 같은 독후감 목록 행. selected 는 데스크톱 사이드바에서만 씁니다. */
export function ReviewRow({ review, selected, showBook = true, onClick }) {
  const excerpt = review.text?.replace(/\s+/g, ' ').trim()
  return (
    <button
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      className={`flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${selected ? 'bg-accent text-white' : 'hover:bg-black/[0.04] active:bg-black/[0.06] dark:hover:bg-white/5'}`}
    >
      {showBook && review.book && <BookCover book={review.book} className="mt-0.5 w-8 shrink-0" rounded="rounded-[3px]" />}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 text-sm font-semibold">{review.title?.trim() || '제목 없음'}</span>
        <span className={`mt-0.5 line-clamp-1 text-xs ${selected ? 'text-white/80' : 'text-ink-2'}`}>
          <span className="font-medium">{formatReviewDate(review.updatedAt)}</span>
          {'  '}
          {excerpt || '추가 텍스트 없음'}
        </span>
        {showBook && review.book && (
          <span className={`mt-0.5 line-clamp-1 text-xs ${selected ? 'text-white/70' : 'text-ink-3'}`}>{review.book.title}</span>
        )}
      </span>
    </button>
  )
}
