import { motion } from 'motion/react'
import { BookCover } from '../../ui/BookCover'

export function BookGrid({ books, onOpen, minWidth = 120 }) {
  return (
    <div className="grid gap-x-5 gap-y-7" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minWidth}px, 1fr))` }}>
      {books.map((book) => (
        <motion.button
          key={book.id}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={() => onOpen(book.id)}
          className="group flex flex-col text-left"
        >
          <BookCover book={book} className="w-full" />
          <span className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug">{book.title}</span>
          <span className="mt-0.5 line-clamp-1 text-xs text-ink-2">{book.authors?.join(', ')}</span>
        </motion.button>
      ))}
    </div>
  )
}

export function EmptyShelf({ onAdd }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="text-5xl">📚</div>
      <p className="text-lg font-semibold">책장이 비어 있어요</p>
      <p className="text-sm text-ink-2">첫 번째 책을 추가해 보세요</p>
      {onAdd && (
        <button onClick={onAdd} className="mt-2 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white active:opacity-80">
          책 추가
        </button>
      )}
    </div>
  )
}
