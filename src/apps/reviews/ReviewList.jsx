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

/** 본문 HTML 에서 처음 나오는 인용문 (칼럼 카드의 인용 한 줄) */
function firstQuote(html = '') {
  const m = html.match(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i)
  return m
    ? m[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim()
    : ''
}

/**
 * 모바일 독후감 목록의 카드. 한 편 한 편을 잡지의 칼럼처럼 보여 줍니다:
 * 책 이름 · 큰 제목 · 인용 한 줄 · 본문 앞부분 · 날짜와 읽는 시간, 오른쪽엔 표지, 바탕엔 표지 색이 은은하게.
 */
export function ReviewColumn({ review, onClick }) {
  const { book } = review
  const quote = firstQuote(review.content)
  let excerpt = review.text?.replace(/\s+/g, ' ').trim() ?? ''
  if (quote && excerpt.startsWith(quote)) excerpt = excerpt.slice(quote.length).trim()
  const chars = review.text?.replace(/\s/g, '').length ?? 0
  const minutes = Math.max(1, Math.round(chars / 500)) // 한국어 1분에 약 500자

  return (
    <button
      onClick={onClick}
      className="relative isolate flex w-full gap-4 overflow-hidden rounded-[22px] bg-surface p-4 text-left transition-transform active:scale-[0.98] dark:bg-white/[0.07]"
    >
      {/* 표지 색이 번지는 바탕 */}
      {book?.cover && (
        <img
          src={book.cover}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full scale-150 object-cover opacity-25 blur-2xl"
        />
      )}

      <span className="flex min-w-0 flex-1 flex-col">
        {book && (
          <span className="line-clamp-1 text-[11px] font-semibold uppercase tracking-wide text-ink-2">
            {book.title}
            {book.authors?.[0] && <span className="font-normal text-ink-3"> · {book.authors[0]}</span>}
          </span>
        )}
        <span className="mt-1.5 line-clamp-2 text-[19px] font-bold leading-snug">{review.title?.trim() || '제목 없음'}</span>

        {quote && (
          <span className="mt-2.5 line-clamp-2 border-l-2 border-accent pl-2.5 text-[13px] italic leading-relaxed text-ink-2">
            “{quote}”
          </span>
        )}
        {excerpt && (
          <span className={`mt-2 text-[13.5px] leading-relaxed text-ink-2 ${quote ? 'line-clamp-2' : 'line-clamp-4'}`}>{excerpt}</span>
        )}

        <span className="mt-3 text-[11px] text-ink-3">
          {formatReviewDate(review.updatedAt)} · {chars.toLocaleString()}자 · {minutes}분 읽기
        </span>
      </span>

      {book && <BookCover book={book} className="w-[68px] shrink-0 self-start" rounded="rounded-[3px_7px_7px_3px]" />}
    </button>
  )
}
