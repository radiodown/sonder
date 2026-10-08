import { CheckIcon, MagnifyingGlassIcon, PencilSimpleIcon, PlusIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { toast } from 'sonner'
import { addBook, db } from '../../db/db'
import { BookCover } from '../../ui/BookCover'
import { searchBooks } from './api'

function ResultRow({ book, owned, onAdd }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <BookCover book={book} className="w-12 shrink-0" rounded="rounded-[3px]" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{book.title}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-ink-2">
          {[book.authors.join(', '), book.publisher, book.publishedDate?.slice(0, 4)].filter(Boolean).join(' · ')}
        </p>
      </div>
      {owned ? (
        <span className="flex size-8 items-center justify-center rounded-full bg-fill text-ink-2" title="책장에 있음">
          <CheckIcon size={16} weight="bold" />
        </span>
      ) : (
        <button
          onClick={() => onAdd(book)}
          aria-label={`${book.title} 추가`}
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-transform active:scale-90"
        >
          <PlusIcon size={16} weight="bold" />
        </button>
      )}
    </li>
  )
}

function ManualForm({ onAdded }) {
  const [form, setForm] = useState({ title: '', authors: '', publisher: '', isbn: '', cover: '' })
  const field = (key, label, props = {}) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink-2">{label}</span>
      <input
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="rounded-xl bg-fill px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/50"
        {...props}
      />
    </label>
  )
  const submit = async (e) => {
    e.preventDefault()
    try {
      const id = await addBook({
        title: form.title.trim(),
        authors: form.authors.split(',').map((a) => a.trim()).filter(Boolean),
        publisher: form.publisher.trim(),
        isbn: form.isbn.replace(/[-\s]/g, ''),
        cover: form.cover.trim(),
        description: '',
        publishedDate: '',
        pageCount: 0,
        source: 'manual',
      })
      toast.success(`'${form.title}'을(를) 추가했습니다`)
      onAdded?.(id)
    } catch (err) {
      toast.error(err.message)
    }
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 py-3">
      {field('title', '제목 *', { required: true, autoFocus: true })}
      {field('authors', '저자 (쉼표로 구분)')}
      {field('publisher', '출판사')}
      {field('isbn', 'ISBN', { inputMode: 'numeric' })}
      {field('cover', '표지 이미지 URL', { type: 'url' })}
      <button className="mt-2 rounded-xl bg-accent py-3 text-sm font-semibold text-white active:opacity-80">추가</button>
    </form>
  )
}

/** 책 검색 후 추가. onAdded(id) 는 추가 직후 호출됩니다. initialQuery 를 주면 열자마자 그 검색어로 찾습니다. */
export function AddBook({ onAdded, autoFocus = true, initialQuery = '' }) {
  const [input, setInput] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery.trim())
  const [manual, setManual] = useState(false)
  const owned = useLiveQuery(async () => new Set(await db.books.orderBy('isbn').uniqueKeys()), [], new Set())

  const { data = [], isFetching, error } = useQuery({
    queryKey: ['search', query],
    queryFn: () => searchBooks(query),
    enabled: !!query,
    staleTime: 1000 * 60 * 10,
  })

  const add = async (book) => {
    try {
      const id = await addBook(book)
      toast.success(`'${book.title}'을(를) 책장에 추가했습니다`)
      onAdded?.(id)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setManual(false)
          setQuery(input.trim())
        }}
        className="flex items-center gap-2 rounded-xl bg-fill px-3"
      >
        <MagnifyingGlassIcon size={18} className="text-ink-2" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus={autoFocus}
          enterKeyHint="search"
          placeholder="제목, 저자 또는 ISBN"
          className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-ink-3"
        />
      </form>

      <div className="mt-1 min-h-0 flex-1 overflow-y-auto">
        {manual ? (
          <ManualForm onAdded={onAdded} />
        ) : (
          <>
            {isFetching && <p className="py-8 text-center text-sm text-ink-2">검색 중…</p>}
            {error && <p className="py-8 text-center text-sm text-red-500">{error.message}</p>}
            {!isFetching && query && !error && data.length === 0 && (
              <p className="py-8 text-center text-sm text-ink-2">검색 결과가 없습니다</p>
            )}
            {!isFetching && (
              <ul className="divide-y divide-line">
                {data.map((b, i) => (
                  <ResultRow key={b.isbn || i} book={b} owned={!!b.isbn && owned.has(b.isbn)} onAdd={add} />
                ))}
              </ul>
            )}
            <button
              onClick={() => setManual(true)}
              className="mx-auto my-4 flex items-center gap-1.5 text-sm font-medium text-accent"
            >
              <PencilSimpleIcon size={16} /> 직접 입력하기
            </button>
          </>
        )}
      </div>
    </div>
  )
}
