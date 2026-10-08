import { Command } from 'cmdk'
import { NotePencilIcon } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { BookCover } from '../../ui/BookCover'

const itemCls =
  'flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-white'

/** "어떤 책의 독후감을 쓸까요?" — Spotlight 와 같은 모양의 책 고르기 */
export function BookPickerDialog({ open, onOpenChange, onPick }) {
  const books = useLiveQuery(() => db.books.orderBy('updatedAt').reverse().toArray(), [], [])
  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="독후감을 쓸 책 고르기"
      overlayClassName="fixed inset-0 z-[9800]"
      contentClassName="glass glass-strong glass-refract fixed left-1/2 top-[18%] z-[9900] w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-[26px] text-ink"
    >
      <div className="flex items-center gap-3 px-5">
        <NotePencilIcon size={22} className="text-ink-2" />
        <Command.Input placeholder="어떤 책의 독후감을 쓸까요?" className="h-14 flex-1 bg-transparent text-lg outline-none placeholder:text-ink-3" />
      </div>
      <Command.List className="max-h-[50vh] overflow-y-auto border-t border-line p-2">
        <Command.Empty className="py-6 text-center text-sm text-ink-2">
          {books.length ? '찾는 책이 없습니다' : '먼저 책장에 책을 추가해 주세요'}
        </Command.Empty>
        {books.map((b) => (
          <Command.Item
            key={b.id}
            value={`${b.id} ${b.title} ${b.authors.join(' ')}`}
            onSelect={() => {
              onOpenChange(false)
              onPick(b.id)
            }}
            className={itemCls}
          >
            <BookCover book={b} className="w-6 shrink-0" rounded="rounded-[2px]" />
            <span className="truncate">{b.title}</span>
            <span className="ml-auto shrink-0 truncate text-xs opacity-60">{b.authors.join(', ')}</span>
          </Command.Item>
        ))}
      </Command.List>
    </Command.Dialog>
  )
}
