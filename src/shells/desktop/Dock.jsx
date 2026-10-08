import { DiceFiveIcon } from '@phosphor-icons/react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import * as DM from '@radix-ui/react-dropdown-menu'
import { useRef, useState } from 'react'
import { useBook } from '../../apps/bookshelf/hooks'
import { APPS, getApp, rootAppId } from '../../apps/registry'
import { useNav } from '../../lib/nav'
import { openPicker } from '../../stores/picker'
import { useSettings } from '../../stores/settings'
import { useWindows } from '../../stores/windows'
import { BookCover } from '../../ui/BookCover'
import { Glass } from '../../ui/Glass'

const BASE = 50
const MAG = 78
const RANGE = 150

// Dock 에 고정된 동작 아이콘 (창을 열지 않는 앱처럼 보이는 버튼)
const PICKER = {
  id: 'picker',
  name: '다음 책 뽑기',
  Icon: DiceFiveIcon,
  color: '#9b5cf6',
  tint: 'from-violet-300 to-purple-600',
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')

/**
 * 앱 아이콘. 설정(dockIconStyle)에 따라
 * - tinted: 앱 색을 반투명하게 깐 색조 유리 + 흰 그림
 * - clear: 거의 무색인 맑은 유리 + 앱 색 그림
 * - solid: 예전처럼 불투명한 그라데이션 (책장은 public/icon.svg)
 * 유리 아이콘은 따로 블러를 주지 않습니다. Dock 이 이미 뒤를 흐리고 있어서, 겹쳐 줘도 Dock 표면만 흐려집니다.
 */
export function AppIcon({ app, size = '100%' }) {
  const { Icon } = app
  const style = useSettings((s) => s.dockIconStyle)
  if (style !== 'solid' && app.color) {
    const c = rgb(app.color)
    const tinted = style !== 'clear'
    return (
      <span
        className="glass-icon flex aspect-square items-center justify-center rounded-[22%]"
        style={{
          width: size,
          color: tinted ? '#fff' : app.color,
          background: tinted
            ? `linear-gradient(to bottom, rgb(${c} / 0.62), rgb(${c} / 0.34))`
            : 'linear-gradient(to bottom, rgb(255 255 255 / 0.34), rgb(255 255 255 / 0.1))',
        }}
      >
        <Icon weight="fill" className="glass-icon-glyph relative h-[58%] w-[58%]" />
      </span>
    )
  }
  // 그림 아이콘이 있는 앱 (책장: 앱 아이콘과 같은 public/icon.svg)
  if (app.image) {
    return (
      <img
        src={`${import.meta.env.BASE_URL}${app.image}`}
        alt=""
        draggable={false}
        className="aspect-square drop-shadow-[0_2px_3px_rgb(0_0_0/0.25)]"
        style={{ width: size }}
      />
    )
  }
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
function DockItem({ mouseX, label, running, onClick, clickOpensMenu = false, menu, children }) {
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
          if (clickOpensMenu) setOpen(true)
          else onClick()
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

/** 책 더미 안의 표지 한 권 (아래로 갈수록 살짝 비껴 쌓임) */
function StackCover({ bookId, depth }) {
  const book = useBook(bookId)
  const tilt = [0, -7, 6][depth]
  return (
    <span
      className="absolute inset-0 flex items-end justify-center"
      style={{ zIndex: 3 - depth, transform: `translate(${depth * 3}px, ${-depth * 2}px) rotate(${tilt}deg)` }}
    >
      {book ? (
        <BookCover book={book} rounded="rounded-[2px_5px_5px_2px]" className="h-full w-auto" />
      ) : (
        <AppIcon app={getApp('bookDetail')} />
      )}
    </span>
  )
}

/** 메뉴 한 줄: 작은 표지 + 제목 */
function BookMenuRow({ bookId, minimized }) {
  const book = useBook(bookId)
  return (
    <span className={`flex min-w-0 max-w-64 items-center gap-2.5 ${minimized ? 'opacity-60' : ''}`}>
      {book && <BookCover book={book} rounded="rounded-[2px]" className="w-5 shrink-0" />}
      <span className="truncate">{book?.title ?? '책 정보'}</span>
    </span>
  )
}

/**
 * 열린 책 정보 창들을 Dock 의 한 칸에 겹쳐 쌓습니다. (macOS 에서 브라우저 창 여러 개가 한 아이콘에 모이듯이)
 * 한 권이면 누르자마자 그 창으로, 여러 권이면 위에 목록이 떠서 고릅니다. 닫기는 모두 닫습니다.
 */
function BookStack({ mouseX, wins, restore, closeAll, showAll }) {
  const byZ = [...wins].sort((a, b) => b.z - a.z) // 가장 최근에 본 창이 맨 위
  const many = wins.length > 1
  const menu = [
    ...byZ.map((w) => ({ label: <BookMenuRow bookId={w.props.bookId} minimized={w.minimized} />, onSelect: () => restore(w) })),
    'sep',
    ...(many ? [{ label: '모두 보기', onSelect: showAll }] : []),
    { label: many ? `모두 닫기 (${wins.length})` : '닫기', onSelect: closeAll },
  ]
  return (
    <DockItem
      mouseX={mouseX}
      label={many ? `책 정보 ${wins.length}개` : '책 정보'}
      running={wins.some((w) => !w.minimized)}
      onClick={() => restore(byZ[0])}
      clickOpensMenu={many}
      menu={menu}
    >
      <span className="relative block aspect-square w-full">
        {byZ.slice(0, 3).map((w, i) => (
          <StackCover key={w.id} bookId={w.props.bookId} depth={i} />
        ))}
        {many && (
          <span className="absolute -right-1 -top-1 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white shadow">
            {wins.length}
          </span>
        )}
      </span>
    </DockItem>
  )
}

export function Dock() {
  const nav = useNav()
  const mouseX = useMotionValue(Infinity)
  const { windows, update, focus, close, showApp, hideApp, quitApp } = useWindows()
  // Dock 오른쪽 칸: 책 정보 창 더미 하나 + 그 밖의 최소화된 창
  const bookWins = windows.filter((w) => w.appId === 'bookDetail')
  const tiles = windows.filter((w) => w.minimized && w.appId !== 'bookDetail')
  const restore = (w) => {
    update(w.id, { minimized: false })
    focus(w.id)
  }

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
        <DockItem mouseX={mouseX} label={PICKER.name} onClick={openPicker}>
          <AppIcon app={PICKER} />
        </DockItem>
        {(bookWins.length > 0 || tiles.length > 0) && <span className="mx-1 mb-1 h-11 w-px self-end bg-ink/20" />}
        {bookWins.length > 0 && (
          <BookStack
            mouseX={mouseX}
            wins={bookWins}
            restore={restore}
            showAll={() => [...bookWins].sort((a, b) => a.z - b.z).forEach(restore)}
            closeAll={() => bookWins.forEach((w) => close(w.id))}
          />
        )}
        {tiles.map((w) => (
          <DockItem
            key={w.id}
            mouseX={mouseX}
            label={getApp(w.appId).name}
            onClick={() => restore(w)}
            menu={[
              { label: '복원', onSelect: () => restore(w) },
              'sep',
              { label: '닫기', onSelect: () => close(w.id) },
            ]}
          >
            <span className="flex aspect-square w-full items-center justify-center rounded-[22%] bg-surface p-[12%] shadow">
              <AppIcon app={getApp(w.appId)} />
            </span>
          </DockItem>
        ))}
      </Glass>
    </div>
  )
}
