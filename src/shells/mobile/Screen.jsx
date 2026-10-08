import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { animate, motion, useMotionValue, useMotionValueEvent, useScroll, useTransform } from 'motion/react'
import { useRef, useState } from 'react'
import { useNav } from '../../lib/nav'
import { Glass } from '../../ui/Glass'

const PULL = 72 // 이만큼 끌어내렸다 놓으면 검색이 열립니다

/**
 * 맨 위에서 아래로 끌어내리면 검색을 엽니다 (iOS Spotlight 처럼).
 * 스크롤이 맨 위일 때 시작한 터치만 셉니다.
 */
function usePullToSearch(scrollRef, onTrigger) {
  const pull = useMotionValue(0)
  const startY = useRef(null)
  const [armed, setArmed] = useState(false)
  useMotionValueEvent(pull, 'change', (v) => setArmed(v >= PULL))

  const handlers = {
    onTouchStart: (e) => {
      startY.current = scrollRef.current?.scrollTop <= 0 ? e.touches[0].clientY : null
    },
    onTouchMove: (e) => {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      pull.set(dy > 0 && scrollRef.current.scrollTop <= 0 ? dy : 0)
    },
    onTouchEnd: () => {
      if (startY.current === null) return
      startY.current = null
      if (pull.get() >= PULL) {
        navigator.vibrate?.(8)
        onTrigger()
      }
      animate(pull, 0, { type: 'spring', stiffness: 400, damping: 35 })
    },
  }
  handlers.onTouchCancel = handlers.onTouchEnd
  return { pull, armed, handlers }
}

function PullIndicator({ pull, armed }) {
  const opacity = useTransform(pull, [12, PULL * 0.8], [0, 1])
  const y = useTransform(pull, [0, PULL * 2], [-24, 36])
  const scale = useTransform(pull, [0, PULL], [0.7, 1])
  return (
    <motion.div
      style={{ opacity, y, scale }}
      className="pointer-events-none absolute inset-x-0 top-[env(safe-area-inset-top)] z-20 flex justify-center"
      aria-hidden="true"
    >
      <Glass
        refract
        className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-semibold transition-colors ${armed ? 'text-accent' : 'text-ink-2'}`}
      >
        <MagnifyingGlassIcon size={16} weight="bold" />
        {armed ? '놓으면 검색' : '끌어내려 검색'}
      </Glass>
    </motion.div>
  )
}

/**
 * iOS 화면 틀: 큰 제목 → 스크롤하면 상단에 유리 바와 작은 제목이 나타납니다.
 * 맨 위에서 끌어내리면 검색이 열립니다. 하단은 탭바가 덮으므로 여백을 둡니다.
 */
export function Screen({ title, trailing, children }) {
  const nav = useNav()
  const ref = useRef(null)
  const { scrollY } = useScroll({ container: ref })
  const barOpacity = useTransform(scrollY, [24, 56], [0, 1])
  const { pull, armed, handlers } = usePullToSearch(ref, nav.openAdd)

  return (
    <div className="relative h-full">
      <motion.div
        style={{ opacity: barOpacity }}
        className="glass glass-flat pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 rounded-none"
      >
        <div className="flex h-11 items-center justify-center text-[17px] font-semibold">{title}</div>
      </motion.div>
      <PullIndicator pull={pull} armed={armed} />
      <div ref={ref} {...handlers} className="pt-safe h-full overflow-y-auto overscroll-contain pb-36">
        <div className="flex items-end justify-between gap-3 px-5 pb-3 pt-4">
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
          {trailing}
        </div>
        {children}
      </div>
    </div>
  )
}
