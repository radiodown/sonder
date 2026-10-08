import { ArrowsClockwiseIcon, BookOpenIcon, DiceFiveIcon } from '@phosphor-icons/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { db, updateBook } from '../../db/db'
import { useNav } from '../../lib/nav'
import { enableShake, onShake } from '../../lib/shake'
import { closePicker, usePicker } from '../../stores/picker'
import { BookCover } from '../../ui/BookCover'
import { byline } from '../../ui/byline'

const ITEM = 196 // 표지 높이(180) + 간격
const VIEW = 300 // 릴 창 높이
const REEL = 28 // 한 번 돌릴 때 지나가는 표지 수 (마지막이 뽑힌 책)

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)]

/** 지나갈 표지들. 마지막 칸이 뽑힌 책이고, 그 앞은 아무 책이나 섞습니다. */
function makeReel(books) {
  const pick = pickRandom(books)
  const filler = Array.from({ length: REEL - 1 }, () => pickRandom(books))
  return { reel: [...filler, pick], pick }
}

/**
 * 다음 책 뽑기: '읽고 싶은' 책 중 한 권을 슬롯머신처럼 돌려 뽑습니다.
 * 모바일에서는 폰을 흔들어도 뽑힙니다 (닫혀 있으면 열리고, 열려 있으면 다시 뽑기).
 * 각 셸의 NavContext 안에 하나씩 둡니다.
 */
export function NextBookPicker({ mobile = false }) {
  const open = usePicker((s) => s.open)
  const nav = useNav()
  const books = useLiveQuery(() => db.books.where('status').equals('want').toArray(), [], [])
  const [spin, setSpin] = useState(null) // { reel, pick }
  const [done, setDone] = useState(false)
  const y = useMotionValue(0)
  const anim = useRef(null)

  const roll = useCallback(() => {
    if (!books.length) return
    anim.current?.stop()
    const next = makeReel(books)
    setSpin(next)
    setDone(false)
    y.set(0)
    anim.current = animate(y, -(REEL - 1) * ITEM, {
      duration: 2.6,
      ease: [0.15, 0.85, 0.25, 1], // 빠르게 돌다가 천천히 멈춤
      onComplete: () => setDone(true),
    })
  }, [books, y])

  const rollRef = useRef(roll)
  useLayoutEffect(() => {
    rollRef.current = roll
  })

  // 열 때마다 (책 목록이 준비되면) 바로 한 번 돌립니다
  const hasBooks = books.length > 0
  useEffect(() => {
    if (open && hasBooks) rollRef.current()
  }, [open, hasBooks])

  // 흔들기: 열려 있으면 다시 뽑기, 모바일에서 닫혀 있으면 열기.
  // 권한이 필요 없는 기기(Android 등)는 바로 센서를 켭니다. iOS 는 처음 열 때(탭) 권한을 받습니다.
  useEffect(() => {
    if (mobile && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission !== 'function')
      enableShake()
    return onShake(() => {
      if (usePicker.getState().open) rollRef.current()
      else if (mobile) usePicker.setState({ open: true })
    })
  }, [mobile])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && closePicker()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const pick = spin?.pick
  const start = async () => {
    await updateBook(pick.id, { status: 'reading' })
    toast.success(`'${pick.title}' 읽기를 시작했어요`)
    closePicker()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onPointerDown={(e) => e.target === e.currentTarget && closePicker()}
          className="fixed inset-0 z-[10800] flex items-center justify-center bg-black/30 p-6"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="다음 책 뽑기"
            initial={{ scale: 1.06, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 480, damping: 34 }}
            className="glass glass-strong flex w-full max-w-[340px] flex-col items-center rounded-[28px] px-5 pb-5 pt-5 text-center text-ink"
          >
            <h2 className="flex items-center gap-1.5 text-[17px] font-semibold">
              <DiceFiveIcon size={20} weight="fill" className="text-accent" /> 다음 책 뽑기
            </h2>

            {!books.length ? (
              <p className="py-12 text-sm text-ink-2">
                '읽고 싶은' 책이 없어요.
                <br />
                읽고 싶은 책을 담아 두면 여기서 뽑을 수 있어요.
              </p>
            ) : (
              <>
                {/* 릴: 가운데 칸이 뽑힌 자리, 위아래는 흐려집니다 */}
                <div
                  className="relative mt-3 w-full overflow-hidden [mask-image:linear-gradient(transparent,#000_28%,#000_72%,transparent)]"
                  style={{ height: VIEW }}
                >
                  <motion.div style={{ y, paddingTop: VIEW / 2 - ITEM / 2 }} className="flex flex-col items-center">
                    {spin?.reel.map((b, i) => (
                      <div key={i} className="flex shrink-0 items-center justify-center" style={{ height: ITEM }}>
                        <BookCover book={b} className="w-[120px]" />
                      </div>
                    ))}
                  </motion.div>
                </div>

                <div className="mt-1 min-h-[52px]">
                  {done && pick && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{pick.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-ink-2">{byline(pick)}</p>
                    </motion.div>
                  )}
                </div>

                <div className="mt-3 flex w-full gap-2">
                  <button
                    onClick={roll}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-fill text-[15px] font-semibold active:opacity-70"
                  >
                    <ArrowsClockwiseIcon size={17} weight="bold" /> 다시
                  </button>
                  <button
                    onClick={start}
                    disabled={!done}
                    className="flex h-11 flex-[1.4] items-center justify-center gap-1.5 rounded-full bg-accent text-[15px] font-semibold text-white active:opacity-70 disabled:opacity-40"
                  >
                    <BookOpenIcon size={17} weight="bold" /> 읽기 시작
                  </button>
                </div>
                <div className="mt-2 flex w-full items-center justify-between px-1 text-xs">
                  <button
                    onClick={() => {
                      closePicker()
                      nav.openBook(pick.id)
                    }}
                    disabled={!done}
                    className="font-medium text-accent disabled:opacity-40"
                  >
                    책 정보 보기
                  </button>
                  <span className="text-ink-3">
                    {mobile ? '📳 흔들어도 다시 뽑혀요' : `읽고 싶은 책 ${books.length}권 중`}
                  </span>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
