import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { version } from '../../../package.json'

const YEAR = new Date().getFullYear()

const CREDITS = [
  { role: '만든 사람', names: ['hjjin'] },
  { role: '함께 만든 도구', names: ['Claude Code'] },
  { role: '책 정보', names: ['카카오 책 검색', 'Google Books', 'Open Library'] },
  { role: '글꼴', names: ['Pretendard'] },
  { role: '아이콘', names: ['Phosphor Icons'] },
  {
    role: '오픈소스',
    names: [
      'React',
      'Vite',
      'Tailwind CSS',
      'Motion',
      'Dexie.js',
      'TipTap',
      'Radix UI',
      'cmdk',
      'Vaul',
      'Sonner',
      'Zustand',
      'TanStack Query',
      'react-rnd',
      'Workbox',
    ],
  },
  { role: '영감', names: ['macOS', 'iOS Liquid Glass'] },
]

function CreditList() {
  return (
    <div className="flex flex-col gap-5 pb-5">
      {CREDITS.map(({ role, names }) => (
        <div key={role}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{role}</div>
          {names.map((n) => (
            <div key={n} className="text-[13px] leading-relaxed">
              {n}
            </div>
          ))}
        </div>
      ))}
      <div className="pt-2 text-[13px] text-ink-2">읽어 주셔서 고맙습니다 📚</div>
    </div>
  )
}

/** "Library에 관하여": 앱 정보와 영화 엔딩처럼 천천히 올라가는 크레딧 */
export function AboutDialog({ open, onClose }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          // 메뉴 항목은 마우스를 뗄 때 선택되고, 바로 이어지는 click 이 이 배경에 떨어집니다.
          // onClick 으로 닫으면 열리자마자 닫히므로, 바깥을 새로 누를 때(pointerdown)만 닫습니다.
          onPointerDown={(e) => e.target === e.currentTarget && onClose()}
          className="fixed inset-0 z-[10500] flex items-center justify-center bg-black/20 p-6"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Library에 관하여"
            initial={{ scale: 1.06, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 480, damping: 34 }}
            className="glass glass-strong flex w-[320px] flex-col items-center rounded-[26px] px-6 pb-5 pt-7 text-center text-ink"
          >
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="size-20 drop-shadow-lg" />
            <h2 className="mt-3 text-xl font-bold">Library 2</h2>
            <p className="text-[12px] text-ink-2">버전 {version}</p>
            <p className="mt-1 text-[13px] text-ink-2">나만의 책장</p>

            {/* 크레딧: 같은 목록을 두 번 이어 붙여 끊김 없이 돌고, 마우스를 올리면 멈춥니다 */}
            <div className="credits mt-5 h-44 w-full overflow-hidden [mask-image:linear-gradient(transparent,#000_18%,#000_82%,transparent)]">
              <div className="credits-roll">
                <CreditList />
                <div aria-hidden="true">
                  <CreditList />
                </div>
              </div>
            </div>

            <p className="mt-4 text-[11px] text-ink-3">© {YEAR} hjjin</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
