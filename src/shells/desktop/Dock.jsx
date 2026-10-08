import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import * as DM from '@radix-ui/react-dropdown-menu'
import { useRef, useState } from 'react'
import { useBook } from '../../apps/bookshelf/hooks'
import { APPS, getApp, rootAppId } from '../../apps/registry'
import { useNav } from '../../lib/nav'
import { useWindows } from '../../stores/windows'
import { BookCover } from '../../ui/BookCover'
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
const HOLD_MS = 450

/** Dock 메뉴 항목: [{ label, onSelect, disabled }] 또는 'sep' */
function DockMenu({ items }) {
  return (
    <DM.Portal>
      <DM.Content side="top" align="center" sideOffset={14} className={menuCls}>
        {items.map((it, i) =>
          it === 'sep' ? (
            <DM.Separator key={i} className="mx-2 my-1 h-px bg-line" />
          ) : (
            <DM.Item key={i} className={itemCls} disabled={it.disabled} onSelect={it.onSelect}>
              {it.label}
            </DM.Item>
          ),
        )}
      </DM.Content>
    </DM.Portal>
  )
}

/**
 * Dock 아이콘. macOS 처럼 우클릭하거나 꾹 누르고 있으면 메뉴가 아이콘 위에 열립니다.
 * (마우스 제스처 같은 확장 프로그램이 우클릭을 가로채도 꾹 누르기는 동작합니다)
 */
function DockItem({ mouseX, label, running, onClick, menu, children }) {
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const holdTimer = useRef(null)
  const openedByHold = useRef(false)
  const distance = useTransform(mouseX, (x) => {
    const r = ref.current?.getBoundingClientRect()
    return r ? x - (r.left + r.width / 2) : Infinity
  })
  const size = useSpring(useTransform(distance, [-RANGE, 0, RANGE], [BASE, MAG, BASE]), {
    stiffness: 400,
    damping: 28,
    mass: 0.2,
  })

  const startHold = (e) => {
    if (!menu || e.button !== 0) return
    openedByHold.current = false
    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => {
      openedByHold.current = true
      setOpen(true)
    }, HOLD_MS)
  }
  const cancelHold = () => clearTimeout(holdTimer.current)

  return (
    <DM.Root open={open} onOpenChange={setOpen} modal={false}>
      <motion.button
        ref={ref}
        style={{ width: size, height: size }}
        whileTap={{ scale: 0.88 }}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onContextMenu={(e) => {
          if (!menu) return
          e.preventDefault()
          cancelHold()
          setOpen(true)
        }}
        onClick={() => {
          // 꾹 눌러 메뉴를 연 경우엔 손을 뗄 때 생기는 클릭을 무시
          if (openedByHold.current) {
            openedByHold.current = false
            return
          }
          onClick()
        }}
        aria-label={label}
        aria-haspopup={menu ? 'menu' : undefined}
        className="group relative flex shrink-0 items-end justify-center"
      >
        {/* 메뉴 위치 기준점 (아이콘 위쪽 가운데) */}
        <DM.Trigger asChild>
          <span aria-hidden="true" tabIndex={-1} className="pointer-events-none absolute left-1/2 top-0 size-0" />
        </DM.Trigger>
        <span
          className={`glass glass-strong pointer-events-none absolute -top-11 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium opacity-0 transition-opacity ${open ? '' : 'group-hover:opacity-100'}`}
        >
          {label}
        </span>
        {children}
        {running && <span className="absolute -bottom-[7px] size-1 rounded-full bg-ink/70" />}
      </motion.button>
      {menu && <DockMenu items={menu} />}
    </DM.Root>
  )
}

/** 책 정보 창: 그 책의 표지로 보여 줍니다 */
function BookTile({ bookId, children }) {
  return children(useBook(bookId) ?? null)
}

export function Dock() {
  const nav = useNav()
  const mouseX = useMotionValue(Infinity)
  const { windows, update, focus, close, showApp, hideApp, quitApp } = useWindows()
  // Dock 오른쪽 칸: 최소화된 창 + 열려 있는 책 정보 창 (여러 권을 띄워도 Dock 에서 골라 갈 수 있게)
  const tiles = windows.filter((w) => w.minimized || w.appId === 'bookDetail')

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
        {tiles.length > 0 && <span className="mx-1 mb-1 h-11 w-px self-end bg-ink/20" />}
        {tiles.map((w) => {
          const restore = () => {
            update(w.id, { minimized: false })
            focus(w.id)
          }
          const tile = (label, icon) => (
            <DockItem
              key={w.id}
              mouseX={mouseX}
              label={label}
              running={!w.minimized}
              onClick={restore}
              menu={[
                { label: w.minimized ? '복원' : '보기', onSelect: restore },
                ...(w.minimized ? [] : [{ label: '최소화', onSelect: () => update(w.id, { minimized: true }) }]),
                'sep',
                { label: '닫기', onSelect: () => close(w.id) },
              ]}
            >
              {icon}
            </DockItem>
          )
          if (w.appId === 'bookDetail') {
            return (
              <BookTile key={w.id} bookId={w.props.bookId}>
                {(book) =>
                  tile(
                    book?.title ?? '책 정보',
                    <span className="flex aspect-square w-full items-end justify-center">
                      {book ? (
                        <BookCover book={book} rounded="rounded-[2px_5px_5px_2px]" className="h-full w-auto" />
                      ) : (
                        <AppIcon app={getApp(w.appId)} />
                      )}
                    </span>,
                  )
                }
              </BookTile>
            )
          }
          return tile(
            getApp(w.appId).name,
            <span className="flex aspect-square w-full items-center justify-center rounded-[22%] bg-surface p-[12%] shadow">
              <AppIcon app={getApp(w.appId)} />
            </span>,
          )
        })}
      </Glass>
    </div>
  )
}
