import {
  ArrowCounterClockwiseIcon,
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  DownloadSimpleIcon,
  GoogleDriveLogoIcon,
  UploadSimpleIcon,
} from '@phosphor-icons/react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { exportBooks, importBooks } from '../../db/db'
import { disconnectDrive, setAutoSave, useDrive } from '../../stores/drive'
import { usePlatform } from '../../lib/platform'
import { confirmDialog } from '../../ui/ConfirmDialog'
import { SOLAR_PHASES, solarBackground, useSolarBackground } from '../../lib/solar'
import { GLASS_DEFAULTS, WALLPAPERS, WINDOW_DEFAULTS, useSettings, wallpaperId } from '../../stores/settings'
import { Segmented } from '../../ui/Segmented'
import { useCounts } from '../bookshelf/hooks'
import { driveLoad, driveSave, driveStatusText, resolveConflictByOverwrite } from './driveActions'

function Group({ title, children }) {
  return (
    <section>
      {title && <h2 className="mb-1.5 px-4 text-xs font-medium uppercase tracking-wide text-ink-2">{title}</h2>}
      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface/70 dark:bg-white/[0.06]">{children}</div>
    </section>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-2">
      <span className="text-[15px]">{label}</span>
      {children}
    </div>
  )
}

/** 설정용 슬라이더 한 줄: 이름 · 양 끝 설명 · 막대 */
function SliderRow({ label, min, max, step, value, onChange, left, right }) {
  return (
    <div className="px-4 py-2.5">
      <div className="mb-1.5 text-[15px]">{label}</div>
      <div className="flex items-center gap-3">
        <span className="w-8 shrink-0 text-xs text-ink-2">{left}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="h-1 min-w-0 flex-1 accent-[var(--accent)]"
        />
        <span className="w-8 shrink-0 text-right text-xs text-ink-2">{right}</span>
      </div>
    </div>
  )
}

/** 흐림·투명도 슬라이더 묶음. keys = [흐림 설정 키, 투명도 설정 키] */
function EffectSliders({ title, hint, keys: [blurKey, clarityKey], defaults, blurMax }) {
  const s = useSettings()
  const changed = s[blurKey] !== defaults.blur || s[clarityKey] !== defaults.clarity
  return (
    <div className="border-t border-line">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3">
        <span className="text-xs font-medium text-ink-2">
          {title} <span className="font-normal text-ink-3">· {hint}</span>
        </span>
        <button
          onClick={() => s.set({ [blurKey]: defaults.blur, [clarityKey]: defaults.clarity })}
          disabled={!changed}
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent disabled:text-ink-3"
        >
          <ArrowCounterClockwiseIcon size={12} weight="bold" /> 초기화
        </button>
      </div>
      <SliderRow
        label="흐림"
        min={0}
        max={blurMax}
        step={1}
        value={s[blurKey]}
        onChange={(v) => s.set({ [blurKey]: v })}
        left="또렷"
        right="뿌옇게"
      />
      <SliderRow
        label="투명도"
        min={0}
        max={1}
        step={0.05}
        value={s[clarityKey]}
        onChange={(v) => s.set({ [clarityKey]: v })}
        left="진하게"
        right="맑게"
      />
    </div>
  )
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-fill'}`}
    >
      <span
        className={`absolute top-[2px] size-[26px] rounded-full bg-white shadow transition-[left] ${checked ? 'left-[22px]' : 'left-[2px]'}`}
      />
    </button>
  )
}

const actionCls = 'flex w-full items-center gap-3 px-4 py-3.5 text-[15px] text-accent disabled:opacity-40'

function DriveGroup() {
  const d = useDrive()
  const busy = d.status === 'saving' || d.status === 'loading'

  if (!d.configured) {
    return (
      <Group title="Google Drive">
        <Row label="상태">
          <span className="text-sm text-ink-2">설정되지 않음</span>
        </Row>
        <p className="px-4 pb-3 text-xs text-ink-3">.env.local 에 VITE_GOOGLE_CLIENT_ID 를 넣으면 사용할 수 있습니다.</p>
      </Group>
    )
  }

  return (
    <Group title="Google Drive">
      <Row label={<span className="flex items-center gap-2"><GoogleDriveLogoIcon size={20} weight="fill" className="text-ink-2" />상태</span>}>
        <span className={`text-sm ${d.status === 'error' || d.status === 'conflict' ? 'text-red-500' : 'text-ink-2'}`}>{driveStatusText(d)}</span>
      </Row>
      {d.status === 'error' && <p className="px-4 py-2 text-xs text-red-500" data-selectable>{d.error}</p>}
      {d.status === 'conflict' && (
        <div className="flex flex-col gap-2 px-4 py-3 text-xs text-ink-2">
          다른 기기에서 Drive 에 더 최근에 저장해서 자동 저장을 멈췄습니다. 어느 쪽을 남길지 골라 주세요.
          <div className="flex gap-2">
            <button onClick={driveLoad} className="flex-1 rounded-lg bg-fill py-2 font-semibold text-accent">Drive 것 받기</button>
            <button onClick={resolveConflictByOverwrite} className="flex-1 rounded-lg bg-fill py-2 font-semibold text-accent">이 기기 것으로 덮어쓰기</button>
          </div>
        </div>
      )}
      <Row label="자동 저장">
        <Toggle label="자동 저장" checked={d.autoSave} onChange={setAutoSave} />
      </Row>
      <button onClick={driveSave} disabled={busy} className={actionCls}>
        <CloudArrowUpIcon size={20} /> Drive 에 저장
      </button>
      <button onClick={driveLoad} disabled={busy} className={actionCls}>
        <CloudArrowDownIcon size={20} /> Drive 에서 불러오기
      </button>
      {d.connected && (
        <button onClick={disconnectDrive} disabled={busy} className={`${actionCls} !text-red-500`}>
          이 기기에서 연결 해제
        </button>
      )}
    </Group>
  )
}

export function Settings() {
  const s = useSettings()
  const solar = useSolarBackground(true, s.solarTime)
  const solarNow = useSolarBackground() // '자동' 견본: 지금 시각의 색
  const mobile = usePlatform() === 'mobile' // 모바일에는 배경화면이 없어서 그 설정도 숨깁니다
  const counts = useCounts()
  const fileRef = useRef(null)

  const resetAll = async () => {
    const ok = await confirmDialog({
      title: '설정을 초기화할까요?',
      message: '테마 · 배경화면 · 유리 효과 · 책장 보기 설정이 처음 상태로 돌아갑니다.\n책 · 독후감 · 독서 목표는 그대로 남습니다.',
      confirmLabel: '초기화',
      destructive: true,
    })
    if (!ok) return
    s.reset()
    toast('설정을 초기화했습니다')
  }

  const download = async () => {
    const blob = new Blob([await exportBooks()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `library-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const upload = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const n = await importBooks(await file.text())
      toast.success(`${n}권을 가져왔습니다`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-7 px-4 pb-10">
      <Group title="화면">
        <Row label="테마">
          <Segmented
            size="sm"
            value={s.theme}
            onChange={(theme) => s.set({ theme })}
            options={[
              { value: 'system', label: '자동' },
              { value: 'light', label: '라이트' },
              { value: 'dark', label: '다크' },
            ]}
          />
        </Row>
        <Row label="레이아웃">
          <Segmented
            size="sm"
            value={s.platform}
            onChange={(platform) => s.set({ platform })}
            options={[
              { value: 'auto', label: '자동' },
              { value: 'desktop', label: 'Mac' },
              { value: 'mobile', label: 'iOS' },
            ]}
          />
        </Row>
        <EffectSliders
          title="유리 효과"
          hint="메뉴바 · Dock · 탭바 · 메뉴 · 사이드바"
          keys={['glassBlur', 'glassClarity']}
          defaults={GLASS_DEFAULTS}
          blurMax={30}
        />
        {!mobile && (
          <EffectSliders
            title="창"
            hint="창 본체 (글을 읽고 쓰는 곳)"
            keys={['windowBlur', 'windowClarity']}
            defaults={WINDOW_DEFAULTS}
            blurMax={60}
          />
        )}
      </Group>

      {!mobile && (
        <Group title="배경화면">
          <div className="grid grid-cols-4 gap-3 p-4">
            {WALLPAPERS.map((w) => (
              <button key={w.id} onClick={() => s.set({ wallpaper: w.id })} className="flex flex-col items-center gap-1.5">
                <span
                  className={`wallpaper-${w.id} aspect-[4/3] w-full rounded-lg ring-offset-2 ring-offset-transparent ${wallpaperId(s.wallpaper) === w.id ? 'ring-[3px] ring-accent' : 'ring-1 ring-line'}`}
                  style={w.id === 'solar' ? { background: solar } : undefined}
                />
                <span className="text-xs text-ink-2">{w.name}</span>
              </button>
            ))}
          </div>
          {wallpaperId(s.wallpaper) === 'solar' && (
            <div className="border-t border-line px-4 pb-4 pt-3">
              <p className="mb-2.5 text-xs text-ink-2">시간대 · 자동이면 지금 시각에 맞춰 바뀝니다</p>
              <div className="grid grid-cols-5 gap-x-2 gap-y-3">
                {[{ id: 'auto', label: '자동' }, ...SOLAR_PHASES].map((p) => {
                  const on = (s.solarTime ?? 'auto') === p.id
                  return (
                    <button key={p.id} onClick={() => s.set({ solarTime: p.id })} className="flex flex-col items-center gap-1">
                      <span
                        className={`size-9 rounded-full ring-offset-2 ring-offset-transparent ${on ? 'ring-[3px] ring-accent' : 'ring-1 ring-line'}`}
                        // 자동은 지금 시각의 색, 나머지는 그 단계의 색
                        style={{ background: p.id === 'auto' ? solarNow : solarBackground(null, p.id) }}
                      />
                      <span className={`text-[11px] ${on ? 'font-semibold text-ink' : 'text-ink-2'}`}>{p.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </Group>
      )}

      <DriveGroup />

      <Group title="데이터">
        <Row label="책장에 있는 책">
          <span className="text-ink-2">{counts?.all ?? 0}권</span>
        </Row>
        <button onClick={download} className="flex w-full items-center gap-3 px-4 py-3.5 text-[15px] text-accent">
          <DownloadSimpleIcon size={20} /> 백업 파일 내보내기
        </button>
        <button onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-3 px-4 py-3.5 text-[15px] text-accent">
          <UploadSimpleIcon size={20} /> 백업 파일 가져오기
        </button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={upload} />
      </Group>

      <Group>
        <button onClick={resetAll} className="flex w-full items-center gap-3 px-4 py-3.5 text-[15px] text-red-500">
          <ArrowCounterClockwiseIcon size={20} /> 설정 초기화
        </button>
      </Group>

      <p className="text-center text-xs text-ink-3">
        책 데이터는 이 브라우저에 저장되고, Google Drive 를 연결하면
        <br />
        앱 전용 숨김 폴더에 함께 저장됩니다. (다른 Drive 파일은 볼 수 없습니다)
      </p>
    </div>
  )
}
