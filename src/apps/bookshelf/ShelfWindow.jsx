import { BookOpenIcon, BookmarkSimpleIcon, BooksIcon, CheckCircleIcon, MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useNav } from '../../lib/nav'
import { Glass } from '../../ui/Glass'
import { EmptyShelf } from './BookGrid'
import { useBooks, useCounts } from './hooks'
import { DesktopShelfControls } from './ShelfOptions'
import { useShelfPrefs } from './shelfPrefs'
import { ShelfView } from './ShelfView'

const FILTERS = [
  { id: 'all', label: '전체', Icon: BooksIcon },
  { id: 'want', label: '읽고 싶은', Icon: BookmarkSimpleIcon },
  { id: 'reading', label: '읽는 중', Icon: BookOpenIcon },
  { id: 'done', label: '다 읽음', Icon: CheckCircleIcon },
]

/** macOS 책장 창: 떠 있는 유리 사이드바 + 통합 툴바 */
export function ShelfWindow() {
  const nav = useNav()
  const [filter, setFilter] = useState('all')
  const { sort } = useShelfPrefs()
  const [search, setSearch] = useState('')
  const books = useBooks(filter, sort, search)
  const counts = useCounts()
  const current = FILTERS.find((f) => f.id === filter)

  return (
    <div className="flex h-full">
      <Glass as="aside" className="window-drag m-2 mr-0 flex w-52 shrink-0 flex-col rounded-[16px] px-2.5 pb-3 pt-12">
        <p className="px-2 pb-1 text-[11px] font-semibold text-ink-3">보관함</p>
        <nav className="flex flex-col gap-0.5">
          {FILTERS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] ${filter === id ? 'bg-black/[0.07] font-medium dark:bg-white/10' : 'hover:bg-black/[0.04] dark:hover:bg-white/5'}`}
            >
              <Icon size={17} weight={filter === id ? 'fill' : 'regular'} className="text-accent" />
              <span className="flex-1 text-left">{label}</span>
              <span className="text-xs text-ink-3">{counts?.[id] ?? ''}</span>
            </button>
          ))}
        </nav>
      </Glass>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="window-drag flex h-[52px] shrink-0 items-center gap-2.5 px-5">
          <h1 className="text-[15px] font-bold">{current.label}</h1>
          <div className="flex-1" />
          <DesktopShelfControls />
          <label className="flex h-8 w-40 items-center gap-1.5 rounded-full bg-fill px-3">
            <MagnifyingGlassIcon size={15} className="text-ink-2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색"
              className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-3"
            />
          </label>
          <button
            onClick={nav.openAdd}
            title="책 추가 (⌘N)"
            className="flex size-8 items-center justify-center rounded-full bg-fill transition-transform active:scale-90"
          >
            <PlusIcon size={16} weight="bold" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-2">
          {books && books.length === 0 && !search && filter === 'all' ? (
            <EmptyShelf onAdd={nav.openAdd} />
          ) : books && books.length === 0 ? (
            <p className="py-16 text-center text-sm text-ink-2">책이 없습니다</p>
          ) : (
            books && <ShelfView books={books} onOpen={nav.openBook} platform="desktop" />
          )}
        </div>
      </div>
    </div>
  )
}
