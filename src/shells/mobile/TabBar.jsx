import { BookOpenIcon, BooksIcon, GearSixIcon, NotePencilIcon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Glass } from '../../ui/Glass'

const TABS = [
  { path: '/', label: '책장', Icon: BooksIcon },
  { path: '/reading', label: '읽는 중', Icon: BookOpenIcon },
  { path: '/reviews', label: '독후감', Icon: NotePencilIcon },
  { path: '/settings', label: '설정', Icon: GearSixIcon },
]

/** iOS 26 스타일 떠 있는 유리 탭 알약. 검색은 화면 맨 위에서 끌어내려 엽니다 (Screen). */
export function TabBar({ current, hidden, onTab }) {
  return (
    <motion.nav
      initial={false}
      animate={{ y: hidden ? 140 : 0, opacity: hidden ? 0 : 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-30 flex items-end gap-3 px-5"
    >
      <Glass refract className="pointer-events-auto mb-2 flex h-[62px] flex-1 items-center rounded-full p-1">
        {TABS.map(({ path, label, Icon }) => {
          const active = current === path
          return (
            <button
              key={path}
              onClick={() => onTab(path)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-colors ${active ? 'text-accent' : 'text-ink'}`}
            >
              {active && (
                <motion.span
                  layoutId="tab-bubble"
                  className="absolute inset-0 rounded-full bg-black/[0.06] dark:bg-white/[0.12]"
                  transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                />
              )}
              <Icon size={24} weight={active ? 'fill' : 'regular'} className="relative" />
              <span className="relative text-[10px] font-semibold">{label}</span>
            </button>
          )
        })}
      </Glass>
    </motion.nav>
  )
}
