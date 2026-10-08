import * as DM from '@radix-ui/react-dropdown-menu'
import {
  BooksIcon,
  CloudArrowUpIcon,
  CloudCheckIcon,
  CloudIcon,
  CloudSlashIcon,
  CloudWarningIcon,
  MagnifyingGlassIcon,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { getApp, rootAppId } from '../../apps/registry'
import { driveLoad, driveSave, driveStatusText } from '../../apps/settings/driveActions'
import { useNav } from '../../lib/nav'
import { dateAtMinute, startTimelapse, useTimelapse } from '../../lib/timelapse'
import { useDrive } from '../../stores/drive'
import { openPicker } from '../../stores/picker'
import { useSettings } from '../../stores/settings'
import { selectActive, useWindows } from '../../stores/windows'
import { Glass } from '../../ui/Glass'
import { AboutDialog } from './AboutDialog'

function Menu({ label, bold, title, align = 'start', children }) {
  return (
    <DM.Root modal={false}>
      <DM.Trigger
        aria-label={title}
        title={title}
        className={`rounded-md px-2.5 py-0.5 text-[13px] outline-none hover:bg-white/25 data-[state=open]:bg-white/30 dark:hover:bg-white/10 dark:data-[state=open]:bg-white/15 ${bold ? 'font-bold' : 'font-medium'}`}
      >
        {label}
      </DM.Trigger>
      <DM.Portal>
        <DM.Content
          align={align}
          sideOffset={6}
          className="glass glass-strong z-[10000] min-w-56 rounded-xl p-1.5 text-[13px] text-ink"
        >
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}

function Item({ children, shortcut, ...props }) {
  return (
    <DM.Item
      className="flex cursor-default items-center justify-between gap-6 rounded-md px-2.5 py-1 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-accent data-[highlighted]:text-white"
      {...props}
    >
      <span>{children}</span>
      {shortcut && <span className="opacity-60">{shortcut}</span>}
    </DM.Item>
  )
}

const Sep = () => <DM.Separator className="mx-2 my-1 h-px bg-line" />

function DriveIcon({ d }) {
  const props = { size: 16, weight: 'bold' }
  if (d.status === 'saving' || d.status === 'loading') return <CloudArrowUpIcon {...props} className="animate-pulse" />
  if (d.status === 'error' || d.status === 'conflict' || d.status === 'needs-login') return <CloudWarningIcon {...props} />
  if (!d.connected) return <CloudSlashIcon {...props} />
  if (d.dirty) return <CloudIcon {...props} />
  return <CloudCheckIcon {...props} />
}

function DriveMenu() {
  const nav = useNav()
  const d = useDrive()
  if (!d.configured) return null
  const busy = d.status === 'saving' || d.status === 'loading'
  return (
    <Menu label={<DriveIcon d={d} />} title={`Google Drive: ${driveStatusText(d)}`} align="end">
      <DM.Label className="px-2.5 py-1 text-xs text-ink-2">Google Drive · {driveStatusText(d)}</DM.Label>
      <Sep />
      <Item disabled={busy} onSelect={driveSave}>
        Drive 에 저장
      </Item>
      <Item disabled={busy} onSelect={driveLoad}>
        Drive 에서 불러오기
      </Item>
      <Sep />
      <Item onSelect={() => nav.openApp('settings')}>Drive 설정…</Item>
    </Menu>
  )
}

/** 메뉴바 시계. (숨은 기능) 길게 누르면 Solar 타임랩스가 돌고, 그동안 시계도 타임랩스 시각을 보여 줍니다. */
function Clock() {
  const [now, setNow] = useState(() => new Date())
  const lapse = useTimelapse((s) => s.minute)
  const hold = useRef(null)
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000)
    return () => clearInterval(t)
  }, [])
  const shown = lapse === null ? now : dateAtMinute(lapse)
  const date = shown.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
  const time = shown.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
  const cancel = () => clearTimeout(hold.current)
  return (
    <span
      onPointerDown={() => {
        cancel()
        hold.current = setTimeout(startTimelapse, 700)
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      className={`select-none rounded-md px-2 text-[13px] font-medium tabular-nums ${lapse === null ? '' : 'bg-white/25 dark:bg-white/15'}`}
    >
      {date} {time}
    </span>
  )
}

export function MenuBar({ onSpotlight }) {
  const nav = useNav()
  const active = useWindows(selectActive)
  const { windows, close, minimize, toggleMaximize, focus, update, hideApp, quitApp } = useWindows()
  const setSettings = useSettings((s) => s.set)
  const appName = active ? getApp(rootAppId(active.appId)).name : 'Library'
  const driveConfigured = useDrive((s) => s.configured)
  const [aboutOpen, setAboutOpen] = useState(false)

  return (
    <>
      <Glass as="header" className="glass-flat relative z-[9500] flex h-7 items-center rounded-none px-2 text-ink">
        <Menu label={<BooksIcon size={16} weight="fill" className="-mt-px" />}>
          <Item onSelect={() => setAboutOpen(true)}>
            Library에 관하여
          </Item>
          <Sep />
          <Item onSelect={() => nav.openApp('settings')}>설정…</Item>
        </Menu>
        <Menu label={appName} bold>
          <Item onSelect={() => nav.openApp('settings')}>설정…</Item>
          <Sep />
          <Item disabled={!active} onSelect={() => active && hideApp(rootAppId(active.appId))}>
            {appName} 가리기
          </Item>
          <Sep />
          <Item disabled={!active} onSelect={() => active && quitApp(rootAppId(active.appId))}>
            {appName} 종료
          </Item>
        </Menu>
        <Menu label="파일">
          <Item onSelect={nav.openAdd}>새 책 추가…</Item>
          <Item onSelect={() => nav.newReview()}>새 독후감…</Item>
          <Item onSelect={openPicker}>다음 책 뽑기…</Item>
          <Item onSelect={() => nav.openApp('bookshelf')}>책장 열기</Item>
          {driveConfigured && (
            <>
              <Sep />
              <Item onSelect={driveSave}>Google Drive 에 저장</Item>
              <Item onSelect={driveLoad}>Google Drive 에서 불러오기</Item>
            </>
          )}
          <Sep />
          <Item disabled={!active} onSelect={() => active && close(active.id)}>
            창 닫기
          </Item>
        </Menu>
        <Menu label="보기">
          <Item onSelect={() => setSettings({ theme: 'light' })}>라이트 모드</Item>
          <Item onSelect={() => setSettings({ theme: 'dark' })}>다크 모드</Item>
          <Item onSelect={() => setSettings({ theme: 'system' })}>시스템 설정 따르기</Item>
        </Menu>
        <Menu label="윈도우">
          <Item disabled={!active} onSelect={() => active && minimize(active.id)}>
            최소화
          </Item>
          <Item disabled={!active} onSelect={() => active && toggleMaximize(active.id)}>
            확대/축소
          </Item>
          {windows.length > 0 && <Sep />}
          {windows.map((w) => (
            <Item
              key={w.id}
              onSelect={() => {
                update(w.id, { minimized: false })
                focus(w.id)
              }}
            >
              {w.id === active?.id ? '✓ ' : ''}
              {getApp(w.appId).name}
            </Item>
          ))}
        </Menu>

        <div className="flex-1" />
        <DriveMenu />
        <button
          onClick={onSpotlight}
          aria-label="Spotlight (⌘K)"
          title="Spotlight (⌘K)"
          className="rounded-md px-2 py-0.5 hover:bg-white/25 dark:hover:bg-white/10"
        >
          <MagnifyingGlassIcon size={15} weight="bold" />
        </button>
        <Clock />
      </Glass>
      {/* 헤더의 backdrop-filter 안에 두면 fixed 가 헤더 기준이 되어 밖에 둡니다 */}
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </>
  )
}
