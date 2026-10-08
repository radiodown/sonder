import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useRef } from 'react'
import * as CM from '@radix-ui/react-context-menu'
import { APPS, getApp, rootAppId } from '../../apps/registry'
import { useNav } from '../../lib/nav'
import { useWindows } from '../../stores/windows'
import { Glass } from '../../ui/Glass'

const BASE = 50
const MAG = 78
const RANGE = 150

export function AppIcon({ app, size = '100%' }) {
  const { Icon } = app
  return (
    <span
      className={`flex aspect-square items-center justify-center rounded-[22%] bg-gradient-to-b ${app.tint} text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_2px_6px_rgb(0_0_0/0.25)]`}
      style={{ width: size }}
    >
      <Icon weight="fill" className="h-[58%] w-[58%] drop-shadow-sm" />
    </span>
  )
}

const menuCls = 'glass glass-strong z-[10000] min-w-44 rounded-xl p-1.5 text-[13px] text-ink'
const itemCls =
  'flex cursor-default items-center rounded-md px-2.5 py-1 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent data-[highlighted]:text-white'

/** 우클릭 메뉴 항목: [{ label, onSelect, disabled }] 또는 'sep' */
function DockMenu({ items }) {
  return (
    <CM.Portal>
      <CM.Content className={menuCls}>
        {items.map((it, i) =>
          it === 'sep' ? (
            <CM.Separator key={i} className="mx-2 my-1 h-px bg-line" />
          ) : (
            <CM.Item key={i} className={itemCls} disabled={it.disabled} onSelect={it.onSelect}>
              {it.label}
            </CM.Item>
          ),
        )}
      </CM.Content>
    </CM.Portal>
  )
}

function DockItem({ mouseX, label, running, onClick, menu, children }) {
  const ref = useRef(null)
  const distance = useTransform(mouseX, (x) => {
    const r = ref.current?.getBoundingClientRect()
    return r ? x - (r.left + r.width / 2) : Infinity
  })
  const size = useSpring(useTransform(distance, [-RANGE, 0, RANGE], [BASE, MAG, BASE]), {
    stiffness: 400,
    damping: 28,
    mass: 0.2,
  })

  return (
    <CM.Root modal={false}>
      <CM.Trigger asChild>
        <motion.button
          ref={ref}
          style={{ width: size, height: size }}
          whileTap={{ scale: 0.88 }}
          onClick={onClick}
          aria-label={label}
          className="group relative flex shrink-0 items-end justify-center"
        >
          <span className="glass glass-strong pointer-events-none absolute -top-11 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
            {label}
          </span>
          {children}
          {running && <span className="absolute -bottom-[7px] size-1 rounded-full bg-ink/70" />}
        </motion.button>
      </CM.Trigger>
      {menu && <DockMenu items={menu} />}
    </CM.Root>
  )
}

export function Dock() {
  const nav = useNav()
  const mouseX = useMotionValue(Infinity)
  const { windows, update, focus, close, showApp, hideApp, quitApp } = useWindows()
  const minimized = windows.filter((w) => w.minimized)

  // 앱별 빠른 동작 (macOS Dock 메뉴처럼)
  const quickActions = {
    bookshelf: [{ label: '책 추가…', onSelect: nav.openAdd }],
    reviews: [{ label: '새 독후감…', onSelect: () => nav.newReview() }],
  }

  const appMenu = (app) => {
    const mine = windows.filter((w) => rootAppId(w.appId) === app.id)
    const running = mine.length > 0
    const quick = quickActions[app.id] ?? []
    return [
      ...quick,
      ...(quick.length ? ['sep'] : []),
      { label: running ? '보기' : '열기', onSelect: () => showApp(app.id) },
      ...(running
        ? [
            { label: '가리기', onSelect: () => hideApp(app.id), disabled: mine.every((w) => w.minimized) },
            'sep',
            { label: '종료', onSelect: () => quitApp(app.id) },
          ]
        : []),
    ]
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-[9000] flex justify-center">
      <Glass
        refract
        onMouseMove={(e) => mouseX.set(e.clientX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="pointer-events-auto flex h-[66px] items-end gap-2 rounded-[24px] px-2 pb-2"
      >
        {APPS.filter((a) => a.dock).map((app) => (
          <DockItem
            key={app.id}
            mouseX={mouseX}
            label={app.name}
            running={windows.some((w) => rootAppId(w.appId) === app.id)}
            onClick={() => showApp(app.id)}
            menu={appMenu(app)}
          >
            <AppIcon app={app} />
          </DockItem>
        ))}
        {minimized.length > 0 && <span className="mx-1 mb-1 h-11 w-px self-end bg-ink/20" />}
        {minimized.map((w) => {
          const restore = () => {
            update(w.id, { minimized: false })
            focus(w.id)
          }
          return (
            <DockItem
              key={w.id}
              mouseX={mouseX}
              label={getApp(w.appId).name}
              onClick={restore}
              menu={[
                { label: '복원', onSelect: restore },
                'sep',
                { label: '닫기', onSelect: () => close(w.id) },
              ]}
            >
              <span className="flex aspect-square w-full items-center justify-center rounded-[22%] bg-surface p-[12%] shadow">
                <AppIcon app={getApp(w.appId)} />
              </span>
            </DockItem>
          )
        })}
      </Glass>
    </div>
  )
}
