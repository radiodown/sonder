import { CaretDownIcon, CaretRightIcon, StarIcon } from '@phosphor-icons/react'
import { statusLabel } from '../../db/db'
import { BookCover } from '../../ui/BookCover'

const STATUS_DOT = { want: 'bg-sky-500', reading: 'bg-orange-500', done: 'bg-green-500' }

function Stars({ value }) {
  if (!value) return <span className="text-ink-3">—</span>
  return (
    <span className="flex text-amber-400" aria-label={`${value}점`}>
      {Array.from({ length: value }, (_, i) => (
        <StarIcon key={i} size={12} weight="fill" />
      ))}
    </span>
  )
}

const COLS = 'grid-cols-[minmax(0,2.6fr)_minmax(0,1.4fr)_minmax(0,1.3fr)_88px_76px_92px]'

function Head({ label, sortKey, sort, onSort, className = '' }) {
  const active = !!sortKey && sort === sortKey
  return (
    <button
      disabled={!sortKey}
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 truncate px-2 py-1.5 text-left font-medium ${active ? 'text-ink' : ''} ${sortKey ? 'hover:text-ink' : 'cursor-default'} ${className}`}
    >
      {label}
      {active && <CaretDownIcon size={10} weight="bold" />}
    </button>
  )
}

/** macOS Finder 목록 보기. 제목·출판사·추가한 날 머리글을 누르면 정렬됩니다. */
export function BookTable({ books, onOpen, sort, onSort }) {
  return (
    <div role="table" className="text-[13px]">
      <div role="row" className={`sticky top-0 z-[1] grid ${COLS} border-b border-line bg-surface text-xs text-ink-2 backdrop-blur`}>
        <Head label="제목" sortKey="title" sort={sort} onSort={onSort} className="pl-11" />
        <Head label="저자" />
        <Head label="출판사" sortKey="publisher" sort={sort} onSort={onSort} />
        <Head label="상태" />
        <Head label="별점" />
        <Head label="추가한 날" sortKey="recent" sort={sort} onSort={onSort} />
      </div>
      {books.map((b, i) => (
        <button
          key={b.id}
          role="row"
          onClick={() => onOpen(b.id)}
          className={`grid w-full ${COLS} items-center rounded-md text-left hover:bg-accent/10 ${i % 2 ? 'bg-black/[0.025] dark:bg-white/[0.03]' : ''}`}
        >
          <span className="flex min-w-0 items-center gap-2.5 px-2 py-1.5">
            <BookCover book={b} className="w-6 shrink-0" rounded="rounded-[2px]" />
            <span className="truncate font-medium">{b.title}</span>
          </span>
          <span className="truncate px-2 text-ink-2">{b.authors?.join(', ')}</span>
          <span className="truncate px-2 text-ink-2">{b.publisher || '—'}</span>
          <span className="flex items-center gap-1.5 px-2 text-ink-2">
            <span className={`size-2 rounded-full ${STATUS_DOT[b.status]}`} />
            {statusLabel(b.status)}
          </span>
          <span className="px-2">
            <Stars value={b.rating} />
          </span>
          <span className="px-2 tabular-nums text-ink-2">{new Date(b.createdAt).toLocaleDateString('ko-KR')}</span>
        </button>
      ))}
    </div>
  )
}

/** iOS 목록 보기 */
export function BookRows({ books, onOpen }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-surface dark:bg-white/[0.07]">
      {books.map((b) => (
        <button key={b.id} onClick={() => onOpen(b.id)} className="flex w-full items-center gap-3 pl-3 text-left active:bg-black/5">
          <BookCover book={b} className="my-2 w-11 shrink-0" rounded="rounded-[3px]" />
          <span className="flex min-w-0 flex-1 items-center gap-2 self-stretch border-b border-line py-2 pr-3">
            <span className="min-w-0 flex-1">
              <span className="line-clamp-1 text-[15px] font-semibold">{b.title}</span>
              <span className="line-clamp-1 text-[13px] text-ink-2">
                {[b.authors?.join(', '), b.publisher].filter(Boolean).join(' · ')}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                <span className={`size-1.5 rounded-full ${STATUS_DOT[b.status]}`} />
                {statusLabel(b.status)}
                {b.rating > 0 && <span className="text-amber-400">{'★'.repeat(b.rating)}</span>}
              </span>
            </span>
            <CaretRightIcon size={14} weight="bold" className="shrink-0 text-ink-3" />
          </span>
        </button>
      ))}
    </div>
  )
}
