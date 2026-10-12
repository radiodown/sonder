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
// 나타날 때는 탄성 있게, 사라질 때는 짧고 담백하게
const SHOW = { type: 'spring', stiffness: 500, damping: 34 }
const HIDE = { duration: 0.18, ease: [0.4, 0, 1, 1] }

/**
 * iOS 26 스타일 떠 있는 유리 탭 알약. 검색은 화면 맨 위에서 끌어내려 엽니다 (Screen).
 * action 을 주면 알약 오른쪽에 그 화면의 주된 행동(책 추가 · 새 독후감) 버튼이 붙습니다: { key, label, Icon, onClick }
 */
export function TabBar({ current, hidden, onTab, action }) {
  // 사라지는 동안에도 아이콘이 남아 있게 마지막 행동을 기억합니다
  const [last, setLast] = useState(action)
  if (action && action.key !== last?.key) setLast(action)
  const shown = action ?? last

  return (
    <motion.nav
      initial={false}
      animate={{ y: hidden ? 140 : 0, opacity: hidden ? 0 : 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="tabbar-bottom pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end justify-center px-6"
    >
      {/* 알약 폭은 버튼이 있든 없든 같습니다. 버튼이 사라지면 늘어나는 대신 같은 크기로 가운데로 옮겨 갑니다 */}
      <Glass refract className="pointer-events-auto mb-2 flex h-[54px] w-[min(400px,calc(100vw-48px-66px))] shrink-0 items-center rounded-full p-1">
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
      {/* 자리 폭을 버튼과 함께 줄이면, 가운데 정렬된 알약이 그만큼 부드럽게 가운데로 옮겨 갑니다 */}
      <motion.div
        initial={false}
        animate={{ width: action ? ACTION_W : 0 }}
        transition={action ? SHOW : HIDE}
        className="mb-2 flex shrink-0 justify-end"
      >
        {shown && (
          <motion.div
            initial={false}
            animate={action ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
            transition={action ? SHOW : HIDE}
            style={{ originX: 0 }}
            className={`shrink-0 ${action ? 'pointer-events-auto' : ''}`}
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
    </motion.nav>
  )
}
