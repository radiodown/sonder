import { AnimatePresence } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Toaster } from 'sonner'
import { addReview } from '../../db/db'
import { NavContext } from '../../lib/nav'
import { useSettings } from '../../stores/settings'
import { selectActive, useWindows } from '../../stores/windows'
import { BookPickerDialog } from './BookPickerDialog'
import { Dock } from './Dock'
import { MenuBar } from './MenuBar'
import { Spotlight } from './Spotlight'
import { Window } from './Window'

export function DesktopShell() {
  const wallpaper = useSettings((s) => s.wallpaper)
  const windows = useWindows((s) => s.windows)
  const active = useWindows(selectActive)
  const open = useWindows((s) => s.open)
  const [spotlight, setSpotlight] = useState(false)
  const [picker, setPicker] = useState(false)

  const nav = useMemo(() => {
    const openReview = (reviewId) => open('reviews', { reviewId })
    const writeFor = async (bookId) => openReview(await addReview(bookId))
    return {
      openBook: (bookId) => open('bookDetail', { bookId }),
      openAdd: () => open('addBook'),
      openApp: (id) => open(id),
      openReview,
      newReview: (bookId) => (bookId ? writeFor(bookId) : setPicker(true)),
      writeFor,
    }
  }, [open])

  // 처음 켜면 책장 창을 엽니다
  useEffect(() => {
    if (useWindows.getState().windows.length === 0) open('bookshelf')
  }, [open])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSpotlight((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <NavContext.Provider value={nav}>
      <div className={`wallpaper-${wallpaper} fixed inset-0 flex flex-col overflow-hidden`}>
        <MenuBar onSpotlight={() => setSpotlight(true)} />
        {/* 창이 움직일 수 있는 영역 (메뉴바 아래) */}
        <main className="relative isolate flex-1">
          <AnimatePresence>
            {windows.map((w) => (
              <Window key={w.id} win={w} active={w.id === active?.id} />
            ))}
          </AnimatePresence>
        </main>
        <Dock />
        <Spotlight open={spotlight} onOpenChange={setSpotlight} />
        <BookPickerDialog open={picker} onOpenChange={setPicker} onPick={nav.writeFor} />
        <Toaster position="top-right" offset={40} theme="system" />
      </div>
    </NavContext.Provider>
  )
}
