import { MagnifyingGlassIcon, XCircleIcon } from '@phosphor-icons/react'
import { animate, motion, useMotionValue, useScroll, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useVisibleBottom } from '../../lib/visibleBottom'

const PULL = 52 // 이만큼 끌어내리면 검색창이 다 나타납니다
const OPEN_AT = 36 // 이만큼 내린 뒤 놓으면 열린 채로 둡니다

/**
 * 맨 위에서 끌어내려 여는 검색. 손가락을 따라 검색 화면이 나타나고, 충분히 내렸다 놓으면 열린 채 고정됩니다.
 * pull 은 끌어내린 거리(0 ~ PULL)입니다.
 */
function usePullReveal(scrollRef, inputRef, enabled) {
  const pull = useMotionValue(0)
  const [open, setOpen] = useState(false)
  const startY = useRef(null)

  const settle = (next) => {
    setOpen(next)
    animate(pull, next ? PULL : 0, { type: 'spring', stiffness: 420, damping: 36 })
    // 손을 뗀 그 순간(사용자 동작 안)에 포커스해야 iOS 가 키보드를 올립니다
    if (next) inputRef.current?.focus({ preventScroll: true })
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
          pull.set(dy > 0 && scrollRef.current.scrollTop <= 0 ? Math.min(dy * 0.6, PULL) : 0)
        },
        onTouchEnd: () => {
          if (startY.current === null) return
          startY.current = null
          settle(pull.get() >= OPEN_AT)
        },
        // 터치가 없는 환경(마우스·트랙패드)에서는 맨 위에서 위로 휠을 굴리면 엽니다
        onWheel: (e) => {
          if (!open && e.deltaY < -20 && scrollRef.current?.scrollTop <= 0) settle(true)
        },
      }
    : {}
  if (enabled) handlers.onTouchCancel = handlers.onTouchEnd
  return { pull, open, handlers, close: () => settle(false) }
}

const FIELD = 64 // 아래 검색창 줄 높이 (여백 포함)

/**
 * 아이폰 홈 화면을 끌어내리면 뜨는 검색처럼, 화면 전체를 흐린 유리로 덮고 검색창은 키보드 바로 위에 둡니다.
 * 끌어내리는 만큼(pull) 유리가 짙어지며 나타나고, 결과는 그 위쪽에 쌓입니다. children 은 (close) => 결과.
 */
function SearchOverlay({ pull, open, inputRef, value, onChange, placeholder, onClose, children }) {
  const { bottom, keyboard } = useVisibleBottom()
  const opacity = useTransform(pull, [0, PULL], [0, 1])
  const fieldY = useTransform(pull, [0, PULL], [24, 0])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <motion.div
      style={{ opacity }}
      aria-hidden={!open}
      className={`glass glass-flat fixed inset-0 z-40 rounded-none ${open ? '' : 'pointer-events-none'}`}
    >
      {/* 결과: 위에서부터 검색창 바로 위까지. 빈 곳을 누르면 닫힙니다 */}
      <div
        onClick={(e) => e.target === e.currentTarget && onClose()}
        className="pt-safe absolute inset-x-0 top-0 overflow-y-auto overscroll-contain px-5"
        style={{ height: keyboard ? bottom - FIELD : `calc(${bottom}px - ${FIELD}px - env(safe-area-inset-bottom))` }}
      >
        {/* 열려 있을 때만 그립니다 (닫혀 있는 동안 결과를 계산하지 않게) */}
        <div className="pt-4">{open && children(onClose)}</div>
      </div>
      {/* 키보드가 없으면 화면 아래(홈 인디케이터 위)에, 있으면 보이는 영역 아래끝(= 키보드 위)에 붙습니다 */}
      <div
        className="absolute inset-x-0"
        style={keyboard ? { top: 0, transform: `translateY(calc(${bottom}px - 100%))` } : { bottom: 'env(safe-area-inset-bottom)' }}
      >
        <motion.div style={{ y: fieldY }} className="flex h-16 items-center gap-3 px-4">
          <label className="flex h-12 flex-1 items-center gap-2 rounded-full bg-fill px-4 shadow-[0_2px_12px_rgb(0_0_0/0.08)]">
            <MagnifyingGlassIcon size={19} className="shrink-0 text-ink-2" />
            <input
              ref={inputRef}
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
                <XCircleIcon size={19} weight="fill" />
              </button>
            )}
          </label>
          <button type="button" onClick={onClose} tabIndex={open ? 0 : -1} className="h-12 shrink-0 text-base font-medium text-accent">
            취소
          </button>
        </motion.div>
      </div>
    </motion.div>
  )
}

/**
 * iOS 화면 틀. 제목은 화면에 쓰지 않고(탭바로 충분), 스크롤하면 상태 막대 뒤에 유리 바가 나타납니다.
 * header 는 맨 윗줄 왼쪽, trailing 은 같은 줄 오른쪽에 놓입니다.
 * stickyHeader 면 그 윗줄이 스크롤해도 맨 위에 붙어 있고, 유리 바도 그 줄까지 덮습니다 (화면 안 탭 같은 것).
 * search 를 주면 맨 위에서 끌어내려 화면 전체를 덮는 검색을 엽니다: { value, onChange, placeholder, results }
 *   results 는 (close) => 결과. 결과를 고를 때 close() 를 부르세요
 * 하단은 탭바가 덮으므로 여백을 둡니다.
 */
export function Screen({ title, header, trailing, search, stickyHeader = false, children }) {
  const ref = useRef(null)
  const inputRef = useRef(null)
  const { scrollY } = useScroll({ container: ref })
  // 붙는 줄은 처음부터 맨 위에 있으므로 내용이 그 밑으로 들어가자마자 바를 보입니다
  const barOpacity = useTransform(scrollY, stickyHeader ? [0, 16] : [24, 56], [0, 1])
  const reveal = usePullReveal(ref, inputRef, !!search)
  const closeSearch = () => {
    search.onChange('')
    inputRef.current?.blur()
    reveal.close()
  }

  return (
    <div className="relative h-full">
      <motion.div
        style={{ opacity: barOpacity }}
        className="glass glass-flat pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 rounded-none"
      >
        {stickyHeader && <div className="h-14" />}
      </motion.div>
      <div
        ref={ref}
        {...reveal.handlers}
        aria-label={title}
        className="pt-safe h-full overflow-y-auto overscroll-contain pb-36"
      >
        <div className={stickyHeader ? 'sticky top-[env(safe-area-inset-top)] z-20 mb-2 h-14' : 'relative'}>
          <div className={`flex h-full items-center gap-3 pl-5 pr-4 ${stickyHeader ? '' : 'min-h-4 pb-3 pt-2'}`}>
            <div className="min-w-0 flex-1">{header}</div>
            {trailing}
          </div>
        </div>
        {children}
      </div>
      {search && (
        <SearchOverlay
          pull={reveal.pull}
          open={reveal.open}
          inputRef={inputRef}
          value={search.value}
          onChange={search.onChange}
          placeholder={search.placeholder}
          onClose={closeSearch}
        >
          {search.results}
        </SearchOverlay>
      )}
    </div>
  )
}
