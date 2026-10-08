import { MagnifyingGlassIcon, XCircleIcon } from '@phosphor-icons/react'
import { animate, motion, useMotionValue, useScroll, useTransform } from 'motion/react'
import { useRef, useState } from 'react'

const BAR = 52 // 검색창 영역 높이
const OPEN_AT = 36 // 이만큼 펼친 뒤 놓으면 열린 채로 둡니다

/**
 * iOS 메일·메모처럼 제목 아래 숨은 검색창.
 * 맨 위에서 끌어내리면 손가락을 따라 펼쳐지고, 충분히 내렸다 놓으면 열린 채 고정됩니다.
 */
function usePullReveal(scrollRef, enabled) {
  const height = useMotionValue(0)
  const [open, setOpen] = useState(false)
  const startY = useRef(null)

  const settle = (next) => {
    setOpen(next)
    animate(height, next ? BAR : 0, { type: 'spring', stiffness: 420, damping: 36 })
  }

  const handlers = enabled
    ? {
        onTouchStart: (e) => {
          startY.current = !open && scrollRef.current?.scrollTop <= 0 ? e.touches[0].clientY : null
        },
        onTouchMove: (e) => {
          if (startY.current === null) return
          const dy = e.touches[0].clientY - startY.current
          // 손가락보다 조금 덜 따라오게 (고무줄 느낌)
          height.set(dy > 0 && scrollRef.current.scrollTop <= 0 ? Math.min(dy * 0.6, BAR) : 0)
        },
        onTouchEnd: () => {
          if (startY.current === null) return
          startY.current = null
          settle(height.get() >= OPEN_AT)
        },
        // 터치가 없는 환경(마우스·트랙패드)에서는 맨 위에서 위로 휠을 굴리면 엽니다
        onWheel: (e) => {
          if (!open && e.deltaY < -20 && scrollRef.current?.scrollTop <= 0) settle(true)
        },
      }
    : {}
  if (enabled) handlers.onTouchCancel = handlers.onTouchEnd
  return { height, open, handlers, close: () => settle(false) }
}

function SearchBar({ height, open, value, onChange, placeholder, onCancel }) {
  const opacity = useTransform(height, [BAR * 0.3, BAR], [0, 1])
  return (
    <motion.div style={{ height }} className="overflow-hidden px-4">
      <motion.div style={{ opacity }} className="flex h-[52px] items-start gap-3 pt-0.5">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-xl bg-fill px-3">
          <MagnifyingGlassIcon size={18} className="shrink-0 text-ink-2" />
          <input
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            enterKeyHint="search"
            tabIndex={open ? 0 : -1}
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
          />
          {value && (
            <button type="button" aria-label="검색어 지우기" onClick={() => onChange('')} className="text-ink-3">
              <XCircleIcon size={18} weight="fill" />
            </button>
          )}
        </label>
        {open && (
          <button type="button" onClick={onCancel} className="h-10 shrink-0 text-base text-accent">
            취소
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}

/**
 * iOS 화면 틀: 큰 제목 → 스크롤하면 상단에 유리 바와 작은 제목이 나타납니다.
 * search 를 주면 제목 아래에 끌어내려 여는 검색창이 생깁니다: { value, onChange, placeholder }
 * 하단은 탭바가 덮으므로 여백을 둡니다.
 */
export function Screen({ title, trailing, search, children }) {
  const ref = useRef(null)
  const { scrollY } = useScroll({ container: ref })
  const barOpacity = useTransform(scrollY, [24, 56], [0, 1])
  const reveal = usePullReveal(ref, !!search)

  return (
    <div className="relative h-full">
      <motion.div
        style={{ opacity: barOpacity }}
        className="glass glass-flat pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 rounded-none"
      >
        <div className="flex h-11 items-center justify-center text-[17px] font-semibold">{title}</div>
      </motion.div>
      <div ref={ref} {...reveal.handlers} className="pt-safe h-full overflow-y-auto overscroll-contain pb-36">
        <div className="flex items-end justify-between gap-3 px-5 pb-3 pt-4">
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
          {trailing}
        </div>
        {search && (
          <SearchBar
            height={reveal.height}
            open={reveal.open}
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder}
            onCancel={() => {
              search.onChange('')
              document.activeElement?.blur()
              reveal.close()
            }}
          />
        )}
        {children}
      </div>
    </div>
  )
}
