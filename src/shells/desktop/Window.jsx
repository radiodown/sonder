import { MinusIcon, ArrowsOutSimpleIcon, XIcon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Rnd } from 'react-rnd'
import { getApp } from '../../apps/registry'
import { useWindows } from '../../stores/windows'

function TrafficLights({ active, onClose, onMinimize, onZoom }) {
  const base = 'flex size-3 items-center justify-center rounded-full text-black/60 [&>svg]:opacity-0 group-hover/lights:[&>svg]:opacity-100'
  const off = 'bg-black/15 dark:bg-white/20'
  return (
    <div className="group/lights absolute left-[18px] top-[20px] z-20 flex gap-2" data-no-drag>
      <button aria-label="닫기" onClick={onClose} className={`${base} ${active ? 'bg-[#ff5f57]' : off}`}>
        <XIcon size={8} weight="bold" />
      </button>
      <button aria-label="최소화" onClick={onMinimize} className={`${base} ${active ? 'bg-[#febc2e]' : off}`}>
        <MinusIcon size={8} weight="bold" />
      </button>
      <button aria-label="확대" onClick={onZoom} className={`${base} ${active ? 'bg-[#28c840]' : off}`}>
        <ArrowsOutSimpleIcon size={8} weight="bold" />
      </button>
    </div>
  )
}

export function Window({ win, active }) {
  const { close, focus, update, minimize, toggleMaximize } = useWindows()
  const app = getApp(win.appId)
  const Content = app.Window
  const max = win.maximized

  return (
    <Rnd
      size={max ? { width: '100%', height: '100%' } : { width: win.width, height: win.height }}
      position={max ? { x: 0, y: 0 } : { x: win.x, y: win.y }}
      onDragStop={(_, d) => update(win.id, { x: d.x, y: d.y })}
      onResizeStop={(_, __, ref, ___, pos) =>
        update(win.id, { width: ref.offsetWidth, height: ref.offsetHeight, x: pos.x, y: pos.y })
      }
      onMouseDown={() => !active && focus(win.id)}
      minWidth={360}
      minHeight={240}
      bounds="parent"
      dragHandleClassName="window-drag"
      cancel="button,input,textarea,select,a,label,[data-no-drag]"
      disableDragging={max}
      enableResizing={!max && !win.minimized}
      style={{ zIndex: win.z, pointerEvents: win.minimized ? 'none' : 'auto' }}
    >
      <motion.div
        role="dialog"
        aria-label={app.name}
        initial={{ opacity: 0, scale: 0.92 }}
        animate={
          win.minimized
            ? { opacity: 0, scale: 0.15, y: window.innerHeight - win.y, transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } }
            : { opacity: 1, scale: 1, y: 0 }
        }
        exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        style={{ transformOrigin: '50% 100%' }}
        onDoubleClick={(e) => e.target.closest('.window-drag') === e.target && toggleMaximize(win.id)}
        className={`surface relative flex h-full flex-col overflow-hidden rounded-[22px] ring-1 ring-black/10 dark:ring-white/15 ${active ? 'shadow-[0_24px_70px_-12px_rgb(0_0_0/0.45)]' : 'shadow-[0_12px_40px_-12px_rgb(0_0_0/0.3)]'}`}
      >
        <TrafficLights
          active={active}
          onClose={() => close(win.id)}
          onMinimize={() => minimize(win.id)}
          onZoom={() => toggleMaximize(win.id)}
        />
        {app.titlebar !== 'none' && (
          <div className="window-drag flex h-[52px] shrink-0 items-center justify-center px-24 text-[13px] font-semibold">
            <span className={`truncate ${active ? '' : 'text-ink-3'}`}>{app.name}</span>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Content win={win} close={() => close(win.id)} />
        </div>
      </motion.div>
    </Rnd>
  )
}
