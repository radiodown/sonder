import { useState } from 'react'
import { createPortal } from 'react-dom'
import { anchorOf } from './stats'

/* 차트 공통 규칙 (dataviz 가이드):
 * - 막대 ≤24px, 끝만 4px 둥글게, 기준선에서 자람 · 격자는 1px 실선, 눈에 띄지 않게
 * - 글자는 항상 글자 색(ink), 막대 색으로 칠하지 않음 · 값은 골라서만 표시, 나머지는 툴팁
 */

/** 화면 고정 툴팁. 창(transform 이 걸린 요소) 안에서도 위치가 맞도록 body 에 띄웁니다. */
export function Tooltip({ tip }) {
  if (!tip) return null
  return createPortal(
    <div
      role="tooltip"
      className="glass glass-strong pointer-events-none fixed z-[11000] -translate-x-1/2 -translate-y-full rounded-lg px-2.5 py-1.5 text-xs text-ink"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      <div className="text-[13px] font-semibold tabular-nums">{tip.value}</div>
      <div className="text-ink-2">{tip.label}</div>
      {tip.detail && <div className="mt-0.5 text-ink-2">{tip.detail}</div>}
    </div>,
    document.body,
  )
}

function niceMax(max) {
  if (max <= 4) return 4
  const step = 10 ** Math.floor(Math.log10(max))
  return Math.ceil(max / step) * step
}

/**
 * 세로 막대 (한 계열). data: [{ label, value, tip? }]
 * 가장 큰 값 하나만 막대 위에 숫자를 붙이고, 나머지는 툴팁으로.
 */
export function ColumnChart({ data, unit = '', height = 132, labelEvery = 1 }) {
  const [tip, setTip] = useState(null)
  const top = niceMax(Math.max(...data.map((d) => d.value), 0))
  const maxIdx = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? 0) ? i : best), -1)
  const ticks = [0, top / 2, top]

  return (
    <div className="flex gap-2">
      {/* y축 눈금 */}
      <div className="relative w-6 shrink-0 text-right text-[10px] tabular-nums text-ink-3" style={{ height }}>
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - t / top) * 100}%` }}>
            {Number.isInteger(t) ? t : ''}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 h-px bg-[var(--viz-grid)]"
              style={{ top: `${(1 - t / top) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end">
            {data.map((d, i) => (
              <div
                key={d.label}
                className="group flex h-full flex-1 cursor-default items-end justify-center"
                onPointerEnter={(e) =>
                  setTip({ ...anchorOf(e.currentTarget.lastChild), value: `${d.value}${unit}`, label: d.tip ?? d.label })
                }
                onPointerLeave={() => setTip(null)}
                aria-label={`${d.tip ?? d.label} ${d.value}${unit}`}
              >
                <div
                  className="relative w-[60%] max-w-6 rounded-t-[4px] bg-[var(--viz-1)] transition-opacity group-hover:opacity-80"
                  style={{ height: `${(d.value / top) * 100}%` }}
                >
                  {i === maxIdx && d.value > 0 && (
                    <span className="absolute inset-x-0 -top-4 text-center text-[11px] font-semibold tabular-nums text-ink">
                      {d.value}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex text-[10px] text-ink-3">
          {data.map((d, i) => (
            <span key={d.label} className="flex-1 text-center">
              {i % labelEvery === 0 ? d.label : ''}
            </span>
          ))}
        </div>
      </div>
      <Tooltip tip={tip} />
    </div>
  )
}

/** 가로 막대 순위 (한 계열). 값은 막대 끝에. */
export function RankBars({ items, unit = '권', empty = '아직 없어요' }) {
  if (!items.length) return <p className="py-4 text-center text-sm text-ink-3">{empty}</p>
  const max = Math.max(...items.map((i) => i.value))
  return (
    <ol className="flex flex-col gap-2">
      {items.map((it) => (
        <li key={it.label} className="grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-3 text-[13px]">
          <span className="truncate text-ink-2" title={it.label}>
            {it.label}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-3.5 rounded-r-[4px] bg-[var(--viz-1)]"
              style={{ width: `${Math.max((it.value / max) * 85, 3)}%` }}
            />
            <span className="shrink-0 font-semibold tabular-nums text-ink">
              {it.value}
              {unit}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * 전체 중 비율 (가로 누적 막대). 조각 사이는 2px 간격, 범례에 이름·수·비율을 함께 적어
 * 색만으로 구분하지 않게 합니다.
 */
export function StackedBar({ parts }) {
  const total = parts.reduce((s, p) => s + p.value, 0)
  if (!total) return <p className="py-4 text-center text-sm text-ink-3">아직 책이 없어요</p>
  return (
    <div>
      <div className="flex h-4 gap-[2px] overflow-hidden rounded-[4px]">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <div
              key={p.label}
              title={`${p.label} ${p.value}권`}
              className="h-full"
              style={{ flexGrow: p.value, background: p.color }}
            />
          ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: p.color }} />
            <span className="text-ink-2">{p.label}</span>
            <span className="font-semibold tabular-nums">{p.value}</span>
            <span className="text-ink-3 tabular-nums">{Math.round((p.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 숫자 하나가 주인공인 타일 */
export function StatTile({ label, value, unit, sub }) {
  return (
    <div className="rounded-2xl bg-surface/70 p-4 dark:bg-white/[0.06]">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-[28px] font-semibold leading-none tracking-tight">{value ?? '—'}</span>
        {value != null && unit && <span className="text-sm text-ink-2">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-xs text-ink-3">{sub}</div>}
    </div>
  )
}

export function Card({ title, sub, action, className = '', children }) {
  return (
    <section className={`rounded-2xl bg-surface/70 p-4 dark:bg-white/[0.06] ${className}`}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {sub && <p className="mt-0.5 text-xs text-ink-2">{sub}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}
