import { motion } from 'motion/react'
import { useId } from 'react'

/** iOS/macOS 세그먼트 컨트롤. 선택 표시가 스프링으로 미끄러집니다. */
export function Segmented({ options, value, onChange, size = 'md', className = '' }) {
  const layoutId = useId()
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
  return (
    <div className={`inline-flex rounded-full bg-fill p-0.5 ${className}`} role="tablist">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            aria-label={o.ariaLabel}
            title={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={`relative flex-1 whitespace-nowrap rounded-full font-medium transition-colors ${pad} ${active ? 'text-ink' : 'text-ink-2'}`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-white shadow-sm dark:bg-white/20"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
