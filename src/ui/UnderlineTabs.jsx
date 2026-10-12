import { motion } from 'motion/react'
import { useId } from 'react'

/** 글자 + 밑줄 탭. 화면을 나누는 내비게이션용 (필터·값 고르기는 Segmented). */
export function UnderlineTabs({ options, value, onChange, className = '' }) {
  const layoutId = useId()
  return (
    <div className={`flex gap-5 ${className}`} role="tablist">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative whitespace-nowrap py-2 text-[16px] font-semibold transition-colors ${active ? 'text-ink' : 'text-ink-3 active:text-ink-2'}`}
          >
            {o.label}
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-full bg-ink"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
