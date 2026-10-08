import { PencilSimpleIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useNav } from '../../lib/nav'
import { useSettings } from '../../stores/settings'
import { BookCover } from '../../ui/BookCover'
import { Segmented } from '../../ui/Segmented'
import { BadgesCard } from './BadgesCard'
import { BookStackCard } from './BookStackCard'
import { Card, ColumnChart, RankBars, StackedBar, StatTile } from './charts'
import { Heatmap } from './Heatmap'
import { STATS_TABS } from './stats'
import { useStats } from './useStats'

const MONTHS = Array.from({ length: 12 }, (_, i) => `${i + 1}월`)
const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일']

/** 연간 목표: 진행 막대 + 지금 속도로 연말 예상 */
function GoalCard({ s }) {
  const goals = useSettings((st) => st.readingGoals ?? {})
  const set = useSettings((st) => st.set)
  const [editing, setEditing] = useState(false)
  const goal = goals[s.year]
  const save = (v) => {
    const n = Math.max(0, Math.min(999, Number(v) || 0))
    set({ readingGoals: { ...goals, [s.year]: n || undefined } })
    setEditing(false)
  }

  // 지금 속도 = 올해 지난 날 대비 완독 수
  const [pace] = useState(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    const end = new Date(now.getFullYear() + 1, 0, 1)
    return (end - start) / Math.max(now - start, 86_400_000)
  })
  const projected = s.isCurrentYear ? Math.round(s.finishedCount * pace) : null
  const pct = goal ? Math.min(100, Math.round((s.finishedCount / goal) * 100)) : 0

  return (
    <Card
      title={`${s.year}년 목표`}
      action={
        !editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs font-medium text-accent">
            <PencilSimpleIcon size={13} /> {goal ? '바꾸기' : '정하기'}
          </button>
        )
      }
    >
      {editing ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            save(new FormData(e.currentTarget).get('goal'))
          }}
        >
          <input
            name="goal"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={goal ?? 12}
            autoFocus
            className="w-20 rounded-lg bg-fill px-3 py-1.5 text-base tabular-nums outline-none focus:ring-2 focus:ring-accent/50"
          />
          <span className="text-sm text-ink-2">권 읽기</span>
          <button className="ml-auto rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white">저장</button>
        </form>
      ) : goal ? (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[34px] font-semibold leading-none tracking-tight">{s.finishedCount}</span>
            <span className="text-sm text-ink-2">/ {goal}권</span>
            <span className="ml-auto text-sm font-semibold tabular-nums">{pct}%</span>
          </div>
          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--viz-track)]"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={goal}
            aria-valuenow={s.finishedCount}
            aria-label="목표 진행"
          >
            <div className="h-full rounded-full bg-[var(--viz-1)]" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2.5 text-xs text-ink-2">
            {s.finishedCount >= goal
              ? '🎉 목표를 이뤘어요!'
              : s.isCurrentYear
                ? `지금 속도면 연말까지 약 ${projected}권 · 목표까지 ${goal - s.finishedCount}권 남음`
                : `목표보다 ${goal - s.finishedCount}권 적게 읽었어요`}
          </p>
        </>
      ) : (
        <p className="py-3 text-sm text-ink-2">
          한 해 동안 읽을 권수를 정해 보세요.
          {s.isCurrentYear && s.finishedCount > 0 && ` 지금 속도면 연말까지 약 ${projected}권이에요.`}
        </p>
      )}
    </Card>
  )
}

function MonthlyTable({ s }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer select-none text-ink-2">표로 보기</summary>
      <table className="mt-2 w-full tabular-nums">
        <thead className="text-ink-3">
          <tr>
            <th className="py-1 text-left font-medium">월</th>
            <th className="py-1 text-right font-medium">완독</th>
            <th className="py-1 text-right font-medium">활동한 날</th>
          </tr>
        </thead>
        <tbody>
          {MONTHS.map((m, i) => {
            const prefix = `${s.year}-${String(i + 1).padStart(2, '0')}-`
            const days = [...s.byDay.keys()].filter((d) => d.startsWith(prefix)).length
            return (
              <tr key={m} className="border-t border-line">
                <td className="py-1">{m}</td>
                <td className="py-1 text-right">{s.monthly[i]}</td>
                <td className="py-1 text-right">{days}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </details>
  )
}

/**
 * 통계 화면. 데스크톱 창과 모바일 탭이 함께 씁니다.
 * - 요약: 독서 캘린더 · 목표 · 숫자
 * - 분석: 월별 · 요일별 · 작가/출판사
 * - 책장: 책장 전체 기준 (상태 · 별점 · 쌓아 보면 · 오래 기다린 책)
 * - 배지
 * 연도 선택은 '요약'과 '분석'에만 보이고, 탭을 오가도 유지됩니다.
 */
export function StatsView({ platform, tab = 'summary' }) {
  const nav = useNav()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const s = useStats(year)
  if (!s) return null
  const mobile = platform === 'mobile'
  const yearly = tab === 'summary' || tab === 'insights'

  return (
    <div className={`flex flex-col gap-4 ${mobile ? 'px-4' : 'px-6 pb-8'}`}>
      {yearly && s.years.length > 1 && (
        <div className="scrollbar-none overflow-x-auto">
          <Segmented
            size="sm"
            value={year}
            onChange={setYear}
            options={s.years.map((y) => ({ value: y, label: `${y}년` }))}
          />
        </div>
      )}

      {tab === 'summary' && (
        <>
          <Card title="독서 캘린더" sub="읽기 시작 · 완독 · 독후감 · 메모를 쓴 날">
            <Heatmap year={year} byDay={s.byDay} cell={mobile ? 11 : 13} gap={mobile ? 2.5 : 3} />
          </Card>

          <GoalCard s={s} />

          <div className={`grid gap-3 ${mobile ? 'grid-cols-2' : 'grid-cols-3'}`}>
            <StatTile
              label={s.isCurrentYear ? '올해 읽은 책' : `${year}년에 읽은 책`}
              value={s.finishedCount}
              unit="권"
              sub={s.isCurrentYear ? `이번 달 ${s.finishedThisMonth}권` : `한 달 평균 ${(s.finishedCount / 12).toFixed(1)}권`}
            />
            <StatTile
              label="연속 독서"
              value={s.isCurrentYear ? s.currentStreak : s.longestStreak}
              unit="일"
              sub={s.isCurrentYear ? `최장 ${s.longestStreak}일` : '그해 최장 기록'}
            />
            <StatTile label="활동한 날" value={s.activeDayCount} unit="일" sub={`활동 ${s.activityTotal}회`} />
            <StatTile
              label="읽은 쪽수"
              value={s.pages ? s.pages.toLocaleString() : null}
              unit="쪽"
              sub={s.pagesBookCount ? `쪽수가 있는 ${s.pagesBookCount}권 기준` : '쪽수 정보가 있는 책이 없어요'}
            />
            <StatTile
              label="한 권 읽는 데"
              value={s.medianDays}
              unit="일"
              sub={s.durationCount ? `중간값 · ${s.durationCount}권 기준` : '시작일·완독일이 있는 책이 없어요'}
            />
            <StatTile label="쓴 독후감" value={s.reviewsWritten} unit="편" />
          </div>

        </>
      )}

      {tab === 'insights' && (
        <>
          <Card title="월별 완독">
            <ColumnChart
              data={s.monthly.map((v, i) => ({ label: `${i + 1}`, value: v, tip: `${year}년 ${MONTHS[i]}` }))}
              unit="권"
              labelEvery={mobile ? 2 : 1}
            />
            <MonthlyTable s={s} />
          </Card>

          <div className={`grid gap-4 ${mobile ? '' : 'grid-cols-3'}`}>
            <Card title="요일별 활동" sub="어느 요일에 많이 읽었나">
              <ColumnChart data={s.weekday.map((v, i) => ({ label: WEEKDAYS[i], value: v, tip: `${WEEKDAYS[i]}요일` }))} unit="회" height={110} />
            </Card>
            <Card title="많이 읽은 작가">
              <RankBars items={s.topAuthors} empty="이 해에 다 읽은 책이 없어요" />
            </Card>
            <Card title="많이 읽은 출판사">
              <RankBars items={s.topPublishers} empty="이 해에 다 읽은 책이 없어요" />
            </Card>
          </div>
        </>
      )}

      {tab === 'shelf' && (
        <>
          <div className={`grid gap-4 ${mobile ? '' : 'grid-cols-2'}`}>
            <Card title="상태">
              <StackedBar
                parts={[
                  { label: '읽고 싶은', value: s.status.want, color: 'var(--viz-1)' },
                  { label: '읽는 중', value: s.status.reading, color: 'var(--viz-2)' },
                  { label: '다 읽음', value: s.status.done, color: 'var(--viz-3)' },
                ]}
              />
            </Card>
            <Card title="별점 분포">
              <ColumnChart data={s.ratings.map((v, i) => ({ label: `★${i + 1}`, value: v, tip: `별 ${i + 1}개` }))} unit="권" height={110} />
            </Card>
          </div>
          <div className={`grid gap-4 ${mobile ? '' : 'grid-cols-2'}`}>
            <BookStackCard />
            <Card title="오래 기다린 책" sub="읽고 싶은 책 중 가장 먼저 담은 책">
              {s.backlog.length ? (
                <ul className="flex flex-col gap-2.5">
                  {s.backlog.map((b) => (
                    <li key={b.id}>
                      <button onClick={() => nav.openBook(b.id)} className="flex w-full items-center gap-3 text-left active:opacity-60">
                        <BookCover book={b} className="w-7 shrink-0" rounded="rounded-[3px]" />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-1 text-[13px] font-medium">{b.title}</span>
                          <span className="text-xs text-ink-3">{b.authors?.[0]}</span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-ink-2">{b.waitingDays}일째</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-4 text-center text-sm text-ink-3">기다리는 책이 없어요</p>
              )}
            </Card>
          </div>
        </>
      )}

      {tab === 'badges' && <BadgesCard mobile={mobile} />}
    </div>
  )
}

/** 데스크톱 창: 통합 툴바(제목 · 탭) + 통계 */
export function StatsWindow() {
  const [tab, setTab] = useState('summary')
  return (
    <div className="flex h-full flex-col">
      <header className="window-drag relative flex h-[52px] shrink-0 items-center px-24">
        <h1 className="text-[15px] font-bold">통계</h1>
        <div className="absolute left-1/2 -translate-x-1/2">
          <Segmented size="sm" value={tab} onChange={setTab} options={STATS_TABS} />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto pt-1">
        <StatsView platform="desktop" tab={tab} />
      </div>
    </div>
  )
}
