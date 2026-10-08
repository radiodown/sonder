import * as DM from '@radix-ui/react-dropdown-menu'
import { CaretDownIcon, CheckIcon, DiceFiveIcon, DotsThreeIcon, PlusIcon, SquaresFourIcon } from '@phosphor-icons/react'
import { useNav } from '../../lib/nav'
import { openPicker } from '../../stores/picker'
import { Glass } from '../../ui/Glass'
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

/** 모바일: 제목 옆 ⋯ 버튼 하나에 보기 · 정렬 · 크기를 모읍니다 (iOS 파일 앱처럼) */
export function MobileShelfMenu() {
  const p = useShelfPrefs()
  const nav = useNav()
  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild>
        <Glass
          as="button"
          refract
          aria-label="보기 옵션"
          className="flex size-11 shrink-0 items-center justify-center rounded-full outline-none"
        >
          <DotsThreeIcon size={24} weight="bold" />
        </Glass>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} className={`${menuCls} min-w-44 text-[15px]`}>
          <DM.Item onSelect={() => nav.openAdd()} className={`${itemCls} font-medium`}>
            <PlusIcon size={15} weight="bold" className="absolute left-2" />책 추가…
          </DM.Item>
          <DM.Item onSelect={openPicker} className={`${itemCls} font-medium`}>
            <DiceFiveIcon size={15} weight="bold" className="absolute left-2" />다음 책 뽑기
          </DM.Item>
          <DM.Separator className="mx-2 my-1 h-px bg-line" />
          <MenuLabel>보기</MenuLabel>
          <RadioItems
            options={VIEWS.map(({ value, label }) => ({ value, label }))}
            value={p.view}
            onChange={p.setView}
          />
          <DM.Separator className="mx-2 my-1 h-px bg-line" />
          <MenuLabel>정렬</MenuLabel>
          <RadioItems options={SORTS} value={p.sort} onChange={p.setSort} />
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
  )
}
