import { BookGrid } from './BookGrid'
import { BookRows, BookTable } from './BookList'
import { BookSpines } from './BookSpines'
import { useShelfPrefs } from './shelfPrefs'

// 플랫폼별 기본 크기 (배율 1 일 때)
const BASE = {
  desktop: { grid: 128, spine: 190 },
  mobile: { grid: 100, spine: 150 },
}

/** 보기 설정(아이콘/목록/책등)에 맞춰 책 목록을 그립니다. */
export function ShelfView({ books, onOpen, platform }) {
  const { view, sort, scale, setSort } = useShelfPrefs()
  const base = BASE[platform]
  if (view === 'list') {
    return platform === 'desktop' ? (
      <BookTable books={books} onOpen={onOpen} sort={sort} onSort={setSort} />
    ) : (
      <BookRows books={books} onOpen={onOpen} />
    )
  }
  if (view === 'spine') return <BookSpines books={books} onOpen={onOpen} shelfHeight={base.spine * scale} />
  return <BookGrid books={books} onOpen={onOpen} minWidth={Math.round(base.grid * scale)} />
}
