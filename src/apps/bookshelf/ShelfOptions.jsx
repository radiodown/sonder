import * as DM from '@radix-ui/react-dropdown-menu'
import { CaretDownIcon, CheckIcon, DiceFiveIcon, SquaresFourIcon } from '@phosphor-icons/react'
import { openPicker } from '../../stores/picker'
import { Segmented } from '../../ui/Segmented'
import { SIZE_STEPS, SORTS, VIEWS, useShelfPrefs } from './shelfPrefs'

const menuCls = 'glass glass-strong z-[10000] rounded-xl p-1.5 text-[13px] text-ink'
const itemCls =
  'flex cursor-default items-center gap-2 rounded-md py-1.5 pl-7 pr-3 outline-none relative data-[disabled]:opacity-40 data-[highlighted]:bg-accent data-[highlighted]:text-white'

function RadioItems({ options, value, onChange }) {
  return (
    <DM.RadioGroup value={String(value)} onValueChange={(v) => onChange(options.find((o) => String(o.value) === v).value)}>
      {options.map((o) => (
        <DM.RadioItem key={o.value} value={String(o.value)} className={itemCls}>
          <DM.ItemIndicator className="absolute left-2">
            <CheckIcon size={13} weight="bold" />
          </DM.ItemIndicator>
          <span className="flex-1">{o.label}</span>
        </DM.RadioItem>
      ))}
    </DM.RadioGroup>
  )
}

const MenuLabel = ({ children }) => <DM.Label className="px-3 pb-0.5 pt-1.5 text-[11px] font-semibold text-ink-2">{children}</DM.Label>

/** 데스크톱 툴바: 보기 전환 · 정렬 메뉴 · 크기 슬라이더 */
export function DesktopShelfControls() {
  const p = useShelfPrefs()
  return (
    <>
      <Segmented
        size="sm"
        value={p.view}
        onChange={p.setView}
        options={VIEWS.map(({ value, label, Icon }) => ({ value, ariaLabel: label, label: <Icon size={15} weight="bold" /> }))}
      />
      <DM.Root modal={false}>
        <DM.Trigger className="flex h-7 items-center gap-1 rounded-full bg-fill px-3 text-xs font-medium outline-none data-[state=open]:bg-accent data-[state=open]:text-white">
          {SORTS.find((s) => s.value === p.sort)?.label}
          <CaretDownIcon size={10} weight="bold" />
        </DM.Trigger>
        <DM.Portal>
          <DM.Content align="end" sideOffset={6} className={`${menuCls} min-w-36`}>
            <MenuLabel>정렬</MenuLabel>
            <RadioItems options={SORTS} value={p.sort} onChange={p.setSort} />
          </DM.Content>
        </DM.Portal>
      </DM.Root>
      {p.view !== 'list' && (
        <label className="flex items-center gap-1.5 text-ink-2" title="크기">
          <SquaresFourIcon size={11} />
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.05}
            value={p.scale}
            onChange={(e) => p.setScale(Number(e.target.value))}
            aria-label="아이콘 크기"
            className="h-1 w-20 accent-[var(--accent)]"
          />
          <SquaresFourIcon size={16} />
        </label>
      )}
    </>
  )
}

// 모바일 정보 줄의 글자 버튼
const infoBtnCls = 'flex items-center gap-1 font-medium outline-none active:opacity-60'

/**
 * 모바일: 책 목록 맨 위의 작은 정보 줄. 왼쪽은 권수 · 정렬, 오른쪽은 보기 · 크기.
 * 아이콘 대신 지금 상태를 글자로 보여 주고, 누르면 그 자리에서 메뉴가 열립니다. (스크롤하면 함께 사라짐)
 */
export function MobileShelfInfo({ count }) {
  const p = useShelfPrefs()
  return (
    <div className="mb-3 flex items-center justify-between text-[13px] text-ink-2">
      <DM.Root modal={false}>
        <DM.Trigger className={infoBtnCls}>
          <span className="font-normal text-ink-3">{count}권 ·</span>
          {SORTS.find((s) => s.value === p.sort)?.label}
          <CaretDownIcon size={11} weight="bold" />
        </DM.Trigger>
        <DM.Portal>
          <DM.Content align="start" sideOffset={6} className={`${menuCls} min-w-40 text-[15px]`}>
            <MenuLabel>정렬</MenuLabel>
            <RadioItems options={SORTS} value={p.sort} onChange={p.setSort} />
          </DM.Content>
        </DM.Portal>
      </DM.Root>
      <DM.Root modal={false}>
        <DM.Trigger className={infoBtnCls}>
          {VIEWS.find((v) => v.value === p.view)?.label}
          <CaretDownIcon size={11} weight="bold" />
        </DM.Trigger>
        <DM.Portal>
          <DM.Content align="end" sideOffset={6} className={`${menuCls} min-w-40 text-[15px]`}>
            <MenuLabel>보기</MenuLabel>
            <RadioItems options={VIEWS.map(({ value, label }) => ({ value, label }))} value={p.view} onChange={p.setView} />
            {p.view !== 'list' && (
              <>
                <DM.Separator className="mx-2 my-1 h-px bg-line" />
                <MenuLabel>크기</MenuLabel>
                <RadioItems
                  options={SIZE_STEPS}
                  value={SIZE_STEPS.reduce((best, s) => (Math.abs(s.value - p.scale) < Math.abs(best.value - p.scale) ? s : best)).value}
                  onChange={p.setScale}
                />
              </>
            )}
          </DM.Content>
        </DM.Portal>
      </DM.Root>
    </div>
  )
}

/** 모바일 '읽고 싶은' 탭 맨 위: 다음 책 뽑기. 뽑는 대상이 바로 이 목록이라 여기에 둡니다. */
export function PickNextCard() {
  return (
    <button
      onClick={openPicker}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left active:opacity-70 dark:bg-white/[0.07]"
    >
      <DiceFiveIcon size={24} weight="duotone" className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">다음에 읽을 책 뽑기</span>
        <span className="text-xs text-ink-2">읽고 싶은 책 중에서 한 권 골라 드려요</span>
      </span>
    </button>
  )
}
