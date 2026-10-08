import { motion } from 'motion/react'
import { hashString } from '../../ui/bookColors'

const ROW_GAP = 20 // 줄 사이 간격(px). 각 줄 아래에 얇은 선반 선을 긋습니다.

// 모던한 단색 책등. [배경, 글자]
const SPINE_COLORS = [
  ['#1f2933', '#f5f5f7'],
  ['#2f4858', '#f5f5f7'],
  ['#33658a', '#f5f5f7'],
  ['#4a6c5d', '#f5f5f7'],
  ['#86bbd8', '#14212b'],
  ['#c8553d', '#fff8f0'],
  ['#e9c46a', '#2b2414'],
  ['#d9d4c7', '#2b2b2b'],
  ['#f2efe9', '#2b2b2b'],
  ['#7b6d8d', '#f5f5f7'],
  ['#b5838d', '#fffafa'],
  ['#6d6875', '#f5f5f7'],
]

/** 책등 하나. 두께는 쪽수, 높이는 책마다 조금씩 다르게(같은 책은 항상 같게). */
function Spine({ book, shelfHeight, onOpen }) {
  const h = hashString(`${book.title}|${book.isbn ?? ''}`)
  const pages = book.pageCount || 160 + (h % 360)
  const height = Math.round(shelfHeight * (0.8 + (h % 16) / 100))
  const width = Math.round(Math.min(Math.max(height * (0.14 + (Math.min(pages, 1000) / 1000) * 0.18), 22), 84))
  const [bg, fg] = SPINE_COLORS[h % SPINE_COLORS.length]
  const titleSize = Math.min(Math.max(width * 0.38, 9), 15)

  return (
    <motion.button
      onClick={() => onOpen(book.id)}
      whileHover={{ y: -8 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
      title={`${book.title}${book.authors?.length ? ` — ${book.authors.join(', ')}` : ''}`}
      aria-label={book.title}
      className="flex shrink-0 flex-col items-center rounded-[4px] py-[10%] shadow-[0_1px_2px_rgb(0_0_0/0.12)] ring-1 ring-inset ring-black/5 dark:ring-white/15"
      style={{ width, height, background: bg, color: fg }}
    >
      <span
        className="min-h-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-semibold leading-none tracking-tight [writing-mode:vertical-rl]"
        style={{ fontSize: titleSize }}
      >
        {book.title}
      </span>
      {width >= 28 && book.authors?.[0] && (
        <span
          className="mt-2 max-h-[30%] overflow-hidden text-ellipsis whitespace-nowrap leading-none opacity-60 [writing-mode:vertical-rl]"
          style={{ fontSize: Math.max(titleSize * 0.7, 8) }}
        >
          {book.authors[0]}
        </span>
      )}
    </motion.button>
  )
}

/** 책등 보기: 줄마다 얇은 선반 선 위에 단색 책등을 세웁니다. */
export function BookSpines({ books, onOpen, shelfHeight = 190 }) {
  const H = Math.round(shelfHeight)
  // 각 책을 높이 H 상자에 담아 줄 높이를 맞추고, 줄 바로 아래에 2px 선을 긋습니다.
  const background = `repeating-linear-gradient(to bottom, transparent 0 ${H}px, var(--shelf-line) ${H}px ${H + 2}px, transparent ${H + 2}px ${H + ROW_GAP}px)`

  return (
    <div className="flex flex-wrap items-end gap-x-1" style={{ background }}>
      {books.map((book) => (
        <div key={book.id} className="flex items-end" style={{ height: H, marginBottom: ROW_GAP }}>
          <Spine book={book} shelfHeight={H * 0.95} onOpen={onOpen} />
        </div>
      ))}
    </div>
  )
}
