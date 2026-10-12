import {
  ArrowLeftIcon,
  ArrowUDownLeftIcon,
  ArrowsOutLineHorizontalIcon,
  BookOpenIcon,
  CrosshairIcon,
  DropIcon,
  FastForwardIcon,
  FlagIcon,
  HammerIcon,
  HandGrabbingIcon,
  LightningIcon,
  NavigationArrowIcon,
  PauseIcon,
  PlayIcon,
  RocketIcon,
  ShieldCheckIcon,
  ShieldIcon,
  SignOutIcon,
  StopIcon,
  SwordIcon,
  UserIcon,
  XIcon,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { BUILDINGS, MAX_SUPPLY, TEAMS, TILE, UNITS, UPGRADES, unitStats } from './data'
import { entName, stats } from './engine'
import { orderLabel } from './commands'
import { clock } from './records'
import { iconURL } from './sprites'

const ICONS = {
  infWeapon: SwordIcon,
  infArmor: ShieldIcon,
  vehWeapon: SwordIcon,
  shipWeapon: CrosshairIcon,
  plating: ShieldCheckIcon,
  stim: LightningIcon,
  range: ArrowsOutLineHorizontalIcon,
  siege: CrosshairIcon,
  engine: RocketIcon,
  move: NavigationArrowIcon,
  stop: StopIcon,
  attack: SwordIcon,
  hold: ShieldIcon,
  gather: HandGrabbingIcon,
  return: ArrowUDownLeftIcon,
  build: HammerIcon,
  rally: FlagIcon,
  cancel: XIcon,
  back: ArrowLeftIcon,
}

export function GameIcon({ name, size = 20, team = 0, ...rest }) {
  // 유닛·건물은 게임 속 그림 그대로
  if (UNITS[name] || BUILDINGS[name]) {
    const px = Math.round(size * 1.6)
    return <img src={iconURL(UNITS[name] ? 'unit' : 'building', name, team)} width={px} height={px} alt="" draggable={false} className="pointer-events-none drop-shadow" />
  }
  const I = ICONS[name] ?? (name === 'mineral' ? BookOpenIcon : DropIcon)
  return <I size={size} weight="duotone" {...rest} />
}

const PaperDot = () => <span className="inline-block size-2.5 rounded-[2px] bg-[#f4ecd6] ring-1 ring-black/30" />
const InkDot = () => <span className="inline-block size-2.5 rounded-full bg-[#3b4aa0] ring-1 ring-white/30" />

export function Cost({ cost, supply, time, game }) {
  const t = game?.teams[0]
  const short = (have, need) => (t && have < need ? 'text-[#ff8a80]' : '')
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 tabular-nums">
      {cost && (
        <span className={`flex items-center gap-1 ${short(t?.paper, cost[0])}`}>
          <PaperDot />
          {cost[0]}
        </span>
      )}
      {cost?.[1] > 0 && (
        <span className={`flex items-center gap-1 ${short(t?.ink, cost[1])}`}>
          <InkDot />
          {cost[1]}
        </span>
      )}
      {supply > 0 && (
        <span className={`flex items-center gap-1 ${t && t.supplyUsed + supply > t.supplyCap ? 'text-[#ff8a80]' : ''}`}>
          <UserIcon size={11} weight="bold" />
          {supply}
        </span>
      )}
      {time && <span className="text-white/50">{time}초</span>}
    </span>
  )
}

const btn = 'flex h-7 items-center gap-1.5 rounded-md bg-white/8 px-2 text-[12px] font-medium text-white/85 hover:bg-white/15'

export function TopBar({ game, ui, nextWave, onTogglePause, onSpeed, onExit }) {
  const t = game.teams[0]
  const left = nextWave - game.time
  const full = t.supplyUsed >= t.supplyCap && t.supplyCap < MAX_SUPPLY
  return (
    <div className="window-drag flex h-12 shrink-0 items-center gap-4 border-b border-white/10 bg-[#1f1915] pl-[88px] pr-3 text-[13px] text-white">
      <span className="flex items-center gap-1.5 tabular-nums" title="종이 (건물·유닛의 기본 자원)">
        <PaperDot /> {Math.floor(t.paper)}
      </span>
      <span className="flex items-center gap-1.5 tabular-nums" title="잉크 (고급 유닛·업그레이드)">
        <InkDot /> {Math.floor(t.ink)}
      </span>
      <span className={`flex items-center gap-1.5 tabular-nums ${full ? 'text-[#ff8a80]' : ''}`} title="인구수">
        <UserIcon size={14} weight="bold" /> {t.supplyUsed}/{t.supplyCap}
      </span>
      <div className="ml-auto flex items-center gap-3" data-no-drag>
        <span className="tabular-nums text-white/60">{clock(game.time)}</span>
        {!game.over && (
          <span className={`rounded-md px-2 py-0.5 tabular-nums ${left < 30 ? 'bg-[#d9480f]/30 text-[#ffb08a]' : 'bg-white/8 text-white/75'}`} title="벌레가 이 시각마다 모은 군대를 모두 보냅니다">
            다음 습격 {clock(left)}
          </span>
        )}
        <button className={btn} onClick={onTogglePause} title="일시정지 (F10)">
          {ui.paused ? <PlayIcon size={13} weight="fill" /> : <PauseIcon size={13} weight="fill" />}
        </button>
        <button className={btn} onClick={onSpeed} title="게임 속도">
          <FastForwardIcon size={13} weight="fill" /> {ui.speed}×
        </button>
        <button className={btn} onClick={onExit} title="나가기">
          <SignOutIcon size={13} />
        </button>
      </div>
    </div>
  )
}

function Bar({ value, max, color }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, value / max)) * 100}%`, background: color }} />
    </div>
  )
}

const hpColor = (p) => (p > 0.6 ? '#3ddc84' : p > 0.3 ? '#f5c542' : '#ff5a4f')

export function SelectionPanel({ game, sel, onPick, onCancelQueue }) {
  if (!sel.length) {
    return (
      <div className="flex flex-1 flex-col justify-center gap-1 px-3 text-[12px] leading-relaxed text-white/45">
        <p>왼쪽 클릭·드래그로 선택, 오른쪽 클릭으로 이동·공격·채취</p>
        <p>F1 쉬는 사서 · F2 전체 병력 · Ctrl/Alt+숫자 부대 지정 · Space 마지막 알림 위치</p>
      </div>
    )
  }
  if (sel.length > 1) {
    return (
      <div className="flex flex-1 flex-wrap content-start gap-1 overflow-y-auto p-1">
        {sel.slice(0, 48).map((e) => (
          <button
            key={e.id}
            title={entName(e)}
            onClick={(ev) => onPick(e, ev.shiftKey)}
            className="relative flex size-10 items-center justify-center rounded-md bg-white/8 text-white hover:bg-white/15"
          >
            <GameIcon name={e.type} team={e.team} size={20} />
            <span className="absolute inset-x-1 bottom-1 h-1 rounded-full" style={{ background: hpColor(e.hp / e.maxHp) }} />
          </button>
        ))}
      </div>
    )
  }

  const e = sel[0]
  const team = TEAMS[e.team]
  const p = e.cat === 'res' ? 1 : e.hp / e.maxHp
  return (
    <div className="flex min-w-0 flex-1 gap-3 p-2 text-white">
      <div className="flex w-16 shrink-0 flex-col items-center gap-1.5">
        <div className="flex size-14 items-center justify-center rounded-xl" style={{ background: e.team >= 0 ? `${team.color}55` : '#ffffff14' }}>
          <GameIcon name={e.type} team={e.team} size={30} />
        </div>
        {e.cat !== 'res' && (
          <span className="text-[11px] tabular-nums text-white/70">
            {Math.ceil(e.hp)}/{e.maxHp}
          </span>
        )}
        {e.cat !== 'res' && <Bar value={e.hp} max={e.maxHp} color={hpColor(p)} />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 text-[12px]">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[15px] font-semibold">{entName(e)}</span>
          {e.team === 1 && <span className="rounded bg-[#d9480f]/40 px-1.5 text-[10px] text-[#ffcfb8]">적</span>}
        </div>
        {e.cat === 'unit' && <UnitInfo game={game} u={e} />}
        {e.cat === 'building' && <BuildingInfo game={game} b={e} onCancelQueue={onCancelQueue} />}
        {e.cat === 'res' && (
          <span className="text-white/70">
            남은 양 {e.refinery ? '— (정제소가 서 있음)' : Math.floor(e.amount)}
          </span>
        )}
      </div>
    </div>
  )
}

function UnitInfo({ game, u }) {
  const d = UNITS[u.type]
  const s = stats(game, u)
  const base = unitStats(u.type, Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])))
  const plus = (a, b) => (a > b ? <span className="text-[#7fd0ff]"> +{Math.round((a - b) * 10) / 10}</span> : null)
  const targets = [d.attack.ground && '지상', d.attack.air && '공중'].filter(Boolean).join('·')
  return (
    <>
      <span className="text-white/55">{u.team === 0 ? orderLabel(u) : d.desc}</span>
      <div className="mt-0.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-white/80">
        <span>
          공격력 {base.dmg}
          {plus(s.dmg, base.dmg)}
          {d.attack.airDmg != null && (
            <span className="text-white/50">
              {' '}
              (공중 {base.airDmg}
              {plus(s.airDmg, base.airDmg)})
            </span>
          )}
        </span>
        <span>
          방어력 {base.armor}
          {plus(s.armor, base.armor)}
        </span>
        <span>
          사거리 {Math.max(1, Math.round(s.range / TILE))}
          {s.airRange !== s.range && <span className="text-white/50"> (공중 {Math.round(s.airRange / TILE)})</span>}
        </span>
        <span>대상 {targets}</span>
      </div>
      {u.carry && <span className="text-white/60">{u.carry.kind === 'paper' ? '종이' : '잉크'} {u.carry.amt} 운반 중</span>}
    </>
  )
}

function BuildingInfo({ game, b, onCancelQueue }) {
  const d = BUILDINGS[b.type]
  if (!b.done) {
    return (
      <>
        <span className="text-white/55">짓는 중 {Math.floor((b.progress / d.time) * 100)}%</span>
        <Bar value={b.progress} max={d.time} color="#7fc8ff" />
        {b.team === 0 && !game.list.some((u) => u.order?.t === 'construct' && u.order.id === b.id) && (
          <span className="text-[#ffcf70]">일하는 사서가 없습니다. 사서로 오른쪽 클릭하면 이어 짓습니다</span>
        )}
      </>
    )
  }
  if (b.team !== 0 || !b.queue.length) {
    return (
      <>
        <span className="text-white/55">{d.desc}</span>
        {b.type === 'refinery' && <span className="text-white/70">남은 잉크 {Math.floor(b.amount)}</span>}
        {d.attack && <span className="text-white/70">공격력 {d.attack.dmg} · 사거리 {Math.round(d.attack.range / TILE)} · 지상·공중</span>}
      </>
    )
  }
  const q = b.queue[0]
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-white/70">{q.kind === 'unit' ? UNITS[q.key].names[0] : `${UPGRADES[q.key].name}${UPGRADES[q.key].levels > 1 ? ` ${q.lv}` : ''}`}</span>
        <Bar value={q.t} max={q.total} color="#ffe58a" />
        <span className="shrink-0 tabular-nums text-white/50">{Math.ceil(q.total - q.t)}초</span>
      </div>
      <div className="flex gap-1">
        {b.queue.map((it, i) => (
          <button
            key={i}
            title="눌러서 취소"
            onClick={() => onCancelQueue(b, i)}
            className={`flex size-8 items-center justify-center rounded-md ${i === 0 ? 'bg-[#ffe58a]/20' : 'bg-white/8'} hover:bg-[#ff5a4f]/30`}
          >
            <GameIcon name={it.key} size={16} />
          </button>
        ))}
      </div>
    </div>
  )
}

export function CommandCard({ game, cmds, onRun }) {
  const [hover, setHover] = useState(null)
  const h = cmds.find((c) => c.id === hover)
  return (
    <div className="relative w-[272px] shrink-0">
      {h && (
        <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 w-72 rounded-lg bg-[#2a221c]/95 p-2.5 text-[12px] text-white shadow-xl ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{h.label}</span>
            <kbd className="rounded bg-white/10 px-1.5 text-[10px] text-white/70">{h.hot === 'ESCAPE' ? 'Esc' : h.hot}</kbd>
          </div>
          {(h.cost || h.time) && (
            <div className="mt-1">
              <Cost cost={h.cost} supply={h.supply} time={h.time} game={game} />
            </div>
          )}
          {h.desc && <p className="mt-1 text-white/65">{h.desc}</p>}
          {h.levels > 1 && <p className="mt-0.5 text-white/50">현재 {h.level}/{h.levels}단계</p>}
          {h.reason && <p className="mt-1 text-[#ff8a80]">{h.reason}</p>}
        </div>
      )}
      <div className="grid grid-cols-5 gap-1">
        {cmds.map((c) => (
          <button
            key={c.id}
            onClick={() => onRun(c)}
            onMouseEnter={() => setHover(c.id)}
            onMouseLeave={() => setHover(null)}
            className={`relative flex h-[50px] flex-col items-center justify-center rounded-lg text-white ring-1 transition-colors ${
              c.active ? 'bg-[#3ddc84]/25 ring-[#3ddc84]/60' : 'bg-white/8 ring-white/5 hover:bg-white/15'
            } ${c.disabled ? 'opacity-35' : ''}`}
          >
            <GameIcon name={c.icon} size={22} />
            <span className="absolute right-1 top-0.5 text-[9px] font-semibold text-white/50">{c.hot === 'ESCAPE' ? 'Esc' : c.hot}</span>
            {c.levels > 1 && <span className="absolute bottom-0.5 left-1 text-[9px] text-[#7fd0ff]">{c.level}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
