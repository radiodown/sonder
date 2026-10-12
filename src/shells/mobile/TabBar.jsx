import { BooksIcon, ChartBarIcon, GearSixIcon, NotePencilIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Glass } from '../../ui/Glass'

const TABS = [
  { path: '/', label: '책장', Icon: BooksIcon },
  { path: '/reviews', label: '독후감', Icon: NotePencilIcon },
  { path: '/stats', label: '통계', Icon: ChartBarIcon },
  { path: '/settings', label: '설정', Icon: GearSixIcon },
]

const ACTION_W = 54 + 12 // 버튼 + 알약과의 간격
const SHOW = { type: 'spring', stiffness: 500, damping: 34 }

// 버튼이 사라질 때는 물방울이 알약에 스며들듯: 알약 쪽으로 끌려 늘어났다가(목으로 이어진 채) 가장자리 안으로 녹아들고,
// 알약은 받아들이며 한 번 출렁입니다. 나타날 때는 그 반대로 알약에서 떨어져 나옵니다. (null = 지금 값에서 시작)
const ABSORB = { duration: 0.3, times: [0, 0.3, 0.7, 1], ease: 'easeIn' }
const DROP = {
  on: { x: 0, scaleX: 1, scaleY: 1, opacity: 1, transition: SHOW },
  // 알약 가장자리를 지나 안쪽까지 파고든 다음에야 사라집니다
  off: {
    x: [null, -6, -40, -54],
    scaleX: [null, 1.14, 0.6, 0.3],
    scaleY: [null, 0.88, 0.6, 0.3],
    opacity: [null, 1, 0.9, 0],
    transition: ABSORB,
  },
}
const NECK = {
  on: { scaleX: [0.3, 1, 1], scaleY: [0, 1, 0], transition: { duration: 0.3, times: [0, 0.4, 1], ease: 'easeOut' } },
  off: { scaleX: [1, 1, 0.3], scaleY: [0, 1, 0], transition: { duration: 0.3, times: [0, 0.3, 1], ease: 'easeOut' } },
}
const PILL = {
  on: { scaleX: [null, 1.02, 1], scaleY: [null, 0.99, 1], transition: { duration: 0.35, times: [0, 0.3, 1] } },
  off: {
    scaleX: [null, 1, 1.045, 0.985, 1],
    scaleY: [null, 1, 0.96, 1.015, 1],
    transition: { duration: 0.6, times: [0, 0.4, 0.6, 0.8, 1], ease: 'easeInOut' },
  },
}
// 알약이 가운데로 옮겨 가는 건 물방울이 다 스며든 뒤에. 동시에 움직이면 물방울이 움직이는 과녁을 쫓는 것처럼 보입니다
const RECENTER = { delay: 0.18, duration: 0.34, ease: [0.32, 0.72, 0, 1] }

/**
 * iOS 26 스타일 떠 있는 유리 탭 알약. 검색은 화면 맨 위에서 끌어내려 엽니다 (Screen).
 * action 을 주면 알약 오른쪽에 그 화면의 주된 행동(책 추가 · 새 독후감) 버튼이 붙습니다: { key, label, Icon, onClick }
 */
export function TabBar({ current, hidden, onTab, action }) {
  // 사라지는 동안에도 아이콘이 남아 있게 마지막 행동을 기억합니다
  const [last, setLast] = useState(action)
  if (action && action.key !== last?.key) setLast(action)
  const shown = action ?? last
  // 처음부터 버튼이 있던 화면이면 그대로 보여 주고, 나중에 처음 생길 때는 알약에서 떨어져 나오게 합니다
  const [startOn] = useState(!!action)

  return (
    <motion.nav
      initial={false}
      animate={{ y: hidden ? 140 : 0, opacity: hidden ? 0 : 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="tabbar-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-center px-6"
    >
      {/* 알약 폭은 버튼이 있든 없든 같습니다. 버튼이 사라지면 늘어나는 대신 같은 크기로 가운데로 옮겨 갑니다.
          버튼과 목은 알약 오른쪽 가장자리에 붙어 있어서 알약이 옮겨 가도 함께 따라갑니다 */}
      <motion.div
        initial={false}
        animate={action ? 'on' : 'off'}
        variants={PILL}
        style={{ originX: 1 }}
        className="relative mb-2 shrink-0"
      >
        <Glass refract className="pointer-events-auto flex h-[54px] w-[min(400px,calc(100vw-48px-66px))] items-center rounded-full p-1">
          {TABS.map(({ path, label, Icon }) => {
            const active = current === path
            return (
              <button
                key={path}
                onClick={() => onTab(path)}
                aria-current={active ? 'page' : undefined}
                className={`relative flex h-full flex-1 flex-col items-center justify-center gap-px rounded-full text-ink`}
              >
                {active && (
                  <motion.span
                    layoutId="tab-bubble"
                    className="absolute inset-0 rounded-full bg-black/[0.06] dark:bg-white/[0.12]"
                    transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                  />
                )}
                <Icon size={21} weight={active ? 'fill' : 'regular'} className="relative" />
                <span className="relative text-[9.5px] font-semibold">{label}</span>
              </button>
            )
          })}
        </Glass>
        {/* 알약과 버튼을 잇는 목: 둘이 떨어지거나 합쳐지는 순간에만 잠깐 부풀었다 끊깁니다 */}
        <motion.div
          variants={NECK}
          style={{ originX: 0 }}
          className="glass absolute top-1/2 left-[calc(100%-2px)] -mt-[11px] h-[22px] w-4 rounded-full"
        />
        {shown && (
          <motion.div
            initial={startOn ? false : 'off'}
            variants={DROP}
            style={{ originX: 0 }}
            className={`absolute top-0 left-[calc(100%+12px)] ${action ? 'pointer-events-auto' : ''}`}
          >
            <Glass
              as="button"
              refract
              onClick={shown.onClick}
              aria-label={shown.label}
              tabIndex={action ? 0 : -1}
              className="relative flex size-[54px] items-center justify-center rounded-full text-ink"
            >
              {/* 버튼이 있는 화면끼리는 원은 그대로, 아이콘만 돌며 바뀝니다 */}
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={shown.key}
                  initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="flex"
                >
                  <shown.Icon size={24} weight="bold" />
                </motion.span>
              </AnimatePresence>
            </Glass>
          </motion.div>
        )}
      </motion.div>
      {/* 자리 폭을 버튼과 함께 줄이면, 가운데 정렬된 알약이 그만큼 부드럽게 가운데로 옮겨 갑니다 */}
      <motion.div
        initial={false}
        animate={{ width: action ? ACTION_W : 0 }}
        transition={action ? SHOW : RECENTER}
        className="shrink-0"
      />
    </motion.nav>
  )
}
