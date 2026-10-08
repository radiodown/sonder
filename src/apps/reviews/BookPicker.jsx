import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useBooks } from '../bookshelf/hooks'
import { BookCover } from '../../ui/BookCover'

/** 독후감을 쓸 책 고르기 (모바일 시트 안에서 씁니다. 데스크톱은 cmdk 대화상자) */
export function BookPicker({ onPick }) {
  const [search, setSearch] = useState('')
  const books = useBooks('all', 'recent', search)
  return (
    <div className="flex h-full flex-col">
      <label className="flex items-center gap-2 rounded-xl bg-fill px-3">
        <MagnifyingGlassIcon size={18} className="text-ink-2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="책 제목이나 저자"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-base outline-none placeholder:text-ink-3"
        />
      </label>
      <ul className="mt-1 min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {books?.map((b) => (
          <li key={b.id}>
            <button onClick={() => onPick(b.id)} className="flex w-full items-center gap-3 py-2.5 text-left active:opacity-60">
              <BookCover book={b} className="w-10 shrink-0" rounded="rounded-[3px]" />
              <span className="min-w-0">
                <span className="line-clamp-1 text-[15px] font-semibold">{b.title}</span>
                <span className="line-clamp-1 text-xs text-ink-2">{b.authors?.join(', ')}</span>
              </span>
            </button>
          </li>
        ))}
        {books?.length === 0 && (
          <li className="py-10 text-center text-sm text-ink-2">{search ? '찾는 책이 없습니다' : '먼저 책장에 책을 추가해 주세요'}</li>
        )}
      </ul>
    </div>
  )
}
