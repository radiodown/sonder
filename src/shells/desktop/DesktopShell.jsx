import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Toaster } from 'sonner'
import { addReview } from '../../db/db'
import { NavContext } from '../../lib/nav'
import { solarBackground, useSolarBackground } from '../../lib/solar'
import { dateAtMinute, useTimelapse } from '../../lib/timelapse'
import { useSettings, wallpaperId } from '../../stores/settings'
import { selectActive, useWindows } from '../../stores/windows'
import { NextBookPicker } from '../../apps/bookshelf/NextBookPicker'
import { BookPickerDialog } from './BookPickerDialog'
import { Dock } from './Dock'
import { MenuBar } from './MenuBar'
import { Spotlight } from './Spotlight'
import { Window } from './Window'

/** Solar 타임랩스(메뉴바 시계 길게 누르기) 동안 배경화면 위에 덮는 층. 이것만 다시 그려서 창들은 영향받지 않습니다. */
function TimelapseLayer() {
  const minute = useTimelapse((s) => s.minute)
  return (
    <AnimatePresence>
      {minute !== null && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="pointer-events-none absolute inset-0"
          style={{ background: solarBackground(dateAtMinute(minute)) }}
        />
      )}
    </AnimatePresence>
  )
}

export function DesktopShell() {
  const wallpaper = wallpaperId(useSettings((s) => s.wallpaper))
  const solarTime = useSettings((s) => s.solarTime)
  const solar = useSolarBackground(wallpaper === 'solar', solarTime)
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
      <div
        className={`wallpaper-${wallpaper} fixed inset-0 flex flex-col overflow-hidden`}
        style={solar ? { background: solar } : undefined}
      >
        <TimelapseLayer />
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
        <NextBookPicker />
        <Toaster position="top-right" offset={40} theme="system" />
      </div>
    </NavContext.Provider>
  )
}
