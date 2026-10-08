import { useBadges } from '../../stores/badges'
import { BADGE_GROUPS } from './badges'
import { Card } from './charts'
import { useBadgeList } from './useBadgeList'

const fmt = (ts) => new Date(ts).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })

/** 업적 배지 모음: 분류별로 묶고, 받은 배지는 색이 있고 못 받은 배지는 흐리게 + 진행도 */
export function BadgesCard({ mobile }) {
  const list = useBadgeList()
  const earned = useBadges((s) => s.earned)
  if (!list) return null
  const got = list.filter((b) => b.done).length

  return (
    <Card title="배지" sub={`${list.length}개 중 ${got}개 받음`}>
      <div className="flex flex-col gap-5">
        {BADGE_GROUPS.map((g) => {
          const items = list.filter((b) => b.group === g.id)
          return (
            <section key={g.id}>
              <h4 className="mb-2 text-xs font-semibold text-ink-2">
                {g.label} <span className="font-normal text-ink-3">{items.filter((b) => b.done).length} / {items.length}</span>
              </h4>
              <ul className={`grid gap-2 ${mobile ? 'grid-cols-3' : 'grid-cols-6'}`}>
                {items.map((b) => (
                  <li
                    key={b.id}
                    title={b.desc}
                    className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center ${b.done ? 'bg-fill' : ''}`}
                  >
                    <span className={`text-[28px] leading-none ${b.done ? '' : 'opacity-30 grayscale'}`}>{b.emoji}</span>
                    <span className={`text-xs font-semibold ${b.done ? '' : 'text-ink-3'}`}>{b.title}</span>
                    <span className="text-[10px] leading-tight text-ink-3">
                      {b.done ? (earned[b.id] ? fmt(earned[b.id]) : '받음') : (b.progress ?? b.desc)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </Card>
  )
}
