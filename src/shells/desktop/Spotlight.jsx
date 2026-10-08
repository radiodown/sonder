import { Command } from 'cmdk'
import { MagnifyingGlassIcon, NotePencilIcon } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { APPS } from '../../apps/registry'
import { db } from '../../db/db'
import { useNav } from '../../lib/nav'
import { BookCover } from '../../ui/BookCover'
import { AppIcon } from './Dock'

const itemCls =
  'flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm data-[selected=true]:bg-accent data-[selected=true]:text-white'

export function Spotlight({ open, onOpenChange }) {
  const nav = useNav()
  const books = useLiveQuery(() => db.books.toArray(), [], [])
  const reviews = useLiveQuery(() => db.reviews.orderBy('updatedAt').reverse().toArray(), [], [])
  const groupCls =
    '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-ink-2'

  const run = (fn) => {
    onOpenChange(false)
    fn()
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Spotlight"
      overlayClassName="fixed inset-0 z-[9800]"
      contentClassName="glass glass-strong glass-refract fixed left-1/2 top-[18%] z-[9900] w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-[26px] text-ink"
    >
      <div className="flex items-center gap-3 px-5">
        <MagnifyingGlassIcon size={22} className="text-ink-2" />
        <Command.Input
          placeholder="Spotlight 검색"
          className="h-14 flex-1 bg-transparent text-xl outline-none placeholder:text-ink-3"
        />
      </div>
      <Command.List className="max-h-[50vh] overflow-y-auto border-t border-line p-2 empty:hidden">
        <Command.Empty className="py-6 text-center text-sm text-ink-2">결과 없음</Command.Empty>
        <Command.Group heading="앱" className={groupCls}>
          {APPS.filter((a) => a.dock || a.id === 'addBook').map((app) => (
            <Command.Item key={app.id} value={`app ${app.name}`} onSelect={() => run(() => nav.openApp(app.id))} className={itemCls}>
              <AppIcon app={app} size={24} />
              {app.name}
            </Command.Item>
          ))}
        </Command.Group>
        {books.length > 0 && (
          <Command.Group heading="책" className={groupCls}>
            {books.map((b) => (
              <Command.Item
                key={b.id}
                value={`book ${b.id} ${b.title} ${b.authors.join(' ')}`}
                onSelect={() => run(() => nav.openBook(b.id))}
                className={itemCls}
              >
                <BookCover book={b} className="w-6 shrink-0" rounded="rounded-[2px]" />
                <span className="truncate">{b.title}</span>
                <span className="ml-auto shrink-0 truncate text-xs opacity-60">{b.authors.join(', ')}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {reviews.some((r) => r.title || r.text) && (
          <Command.Group heading="독후감" className={groupCls}>
            {reviews
              .filter((r) => r.title || r.text)
              .map((r) => (
                <Command.Item
                  key={r.id}
                  value={`review ${r.id} ${r.title} ${r.text.slice(0, 500)}`}
                  onSelect={() => run(() => nav.openReview(r.id))}
                  className={itemCls}
                >
                  <NotePencilIcon size={20} className="shrink-0 opacity-70" />
                  <span className="truncate">{r.title || '제목 없음'}</span>
                  <span className="ml-auto max-w-[45%] shrink-0 truncate text-xs opacity-60">{r.text.slice(0, 80)}</span>
                </Command.Item>
              ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  )
}
