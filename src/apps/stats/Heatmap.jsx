import { useEffect, useMemo, useRef, useState } from 'react'
import { dayKey } from '../../db/db'
import { Tooltip } from './charts'
import { READING_TYPES, TYPE_LABELS, anchorOf, heatLevel } from './stats'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 한 해를 일요일 시작 주 단위 열로 나눕니다. 해에 속하지 않는 칸은 null. */
function buildWeeks(year) {
  const first = new Date(year, 0, 1)
  const start = new Date(year, 0, 1 - first.getDay())
  const weeks = []
  for (let d = new Date(start); d.getFullYear() <= year; ) {
    const week = []
    for (let i = 0; i < 7; i++) {
      week.push(d.getFullYear() === year ? new Date(d) : null)
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    }
    weeks.push(week)
    if (d.getFullYear() > year) break
  }
  return weeks
}

function describe(cell) {
  if (!cell?.total) return '기록 없음'
  return READING_TYPES.filter((t) => cell[t])
    .map((t) => `${TYPE_LABELS[t]} ${cell[t]}`)
    .join(' · ')
}

/**
 * 캘린더 히트맵. 하루 독서 활동(읽기 시작·완독·독후감·메모)의 양을 파랑 한 가지의 진하기로.
 * 칸에 마우스를 올리거나 누르면 그날의 내용이 나옵니다.
 */
export function Heatmap({ year, byDay, cell: minCell = 13, gap = 3 }) {
  const weeks = useMemo(() => buildWeeks(year), [year])
  const [tip, setTip] = useState(null)
  const scrollRef = useRef(null)
  const [today] = useState(() => dayKey(Date.now()))
  const [width, setWidth] = useState(0)

  // 넓은 화면에서는 칸을 키워 카드 폭을 채우고(최대 20px), 좁으면 minCell 로 두고 가로 스크롤
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const cell = Math.max(minCell, Math.min(20, Math.floor((width + gap) / weeks.length - gap)))

  // 좁은 화면에서는 오늘이 오른쪽 가까이에 보이도록 (지난해는 연말까지)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const todayEl = el.querySelector('[data-today]')
    el.scrollLeft = todayEl ? todayEl.offsetLeft + todayEl.offsetWidth * 4 - el.clientWidth : el.scrollWidth
  }, [year, cell])

  const monthStarts = weeks.map((w, i) => {
    const firstOfMonth = w.find((d) => d && d.getDate() === 1)
    return firstOfMonth && (i > 0 || firstOfMonth.getMonth() === 0) ? `${firstOfMonth.getMonth() + 1}월` : ''
  })

  const show = (e, d) => {
    const key = dayKey(d.getTime())
    const c = byDay.get(key)
    setTip({
      ...anchorOf(e.currentTarget),
      value: c?.total ? `활동 ${c.total}회` : '활동 없음',
      label: d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }),
      detail: c?.total ? describe(c) : null,
    })
  }

  return (
    <div>
      <div className="flex gap-2">
        {/* 요일 */}
        <div className="flex shrink-0 flex-col pt-5 text-[10px] text-ink-3" style={{ gap }}>
          {WEEKDAYS.map((w, i) => (
            <span key={w} className="leading-none" style={{ height: cell, lineHeight: `${cell}px` }}>
              {i % 2 ? w : ''}
            </span>
          ))}
        </div>
        <div ref={scrollRef} className="scrollbar-none relative min-w-0 flex-1 overflow-x-auto" onPointerLeave={() => setTip(null)}>
          <div className="w-max">
            <div className="flex h-5 text-[10px] text-ink-3" style={{ gap }}>
              {monthStarts.map((m, i) => (
                <span key={i} className="whitespace-nowrap" style={{ width: cell }}>
                  {m}
                </span>
              ))}
            </div>
            <div
              className="flex"
              style={{ gap }}
              role="img"
              aria-label={`${year}년 독서 활동 히트맵`}
            >
              {weeks.map((w, i) => (
                <div key={i} className="flex flex-col" style={{ gap }}>
                  {w.map((d, j) => {
                    if (!d) return <span key={j} style={{ width: cell, height: cell }} />
                    const key = dayKey(d.getTime())
                    const future = key > today
                    const level = heatLevel(byDay.get(key)?.total)
                    return (
                      <span
                        key={j}
                        data-today={key === today ? '' : undefined}
                        onPointerEnter={(e) => !future && show(e, d)}
                        onClick={(e) => !future && show(e, d)}
                        className={`rounded-[3px] transition-transform hover:scale-125 ${key === today ? 'ring-1 ring-ink/50 ring-offset-1 ring-offset-transparent' : ''}`}
                        style={{
                          width: cell,
                          height: cell,
                          background: future ? 'transparent' : `var(--heat-${level})`,
                          boxShadow: future ? 'inset 0 0 0 1px var(--heat-0)' : undefined,
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* 범례 */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-ink-3">
        적음
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className="rounded-[3px]" style={{ width: 11, height: 11, background: `var(--heat-${l})` }} />
        ))}
        많음
      </div>
      <Tooltip tip={tip} />
    </div>
  )
}
