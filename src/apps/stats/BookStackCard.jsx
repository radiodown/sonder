import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { db } from '../../db/db'
import { hashString } from '../../ui/bookColors'
import { Card } from './charts'

// 책 두께 어림: 종이 한 쪽 약 0.06mm + 앞뒤 표지 2mm. 쪽수를 모르면 300쪽으로 칩니다.
const UNKNOWN_PAGES = 300
const thicknessMm = (b) => 2 + (b.pageCount > 0 ? b.pageCount : UNKNOWN_PAGES) * 0.06

// 비교할 것들 (cm)
const LANDMARKS = [
  { cm: 25, label: '앉아 있는 고양이' },
  { cm: 45, label: '의자 높이' },
  { cm: 75, label: '책상 높이' },
  { cm: 130, label: '초등학생 키' },
  { cm: 180, label: '냉장고' },
  { cm: 210, label: '방문' },
  { cm: 305, label: '농구 골대' },
  { cm: 550, label: '기린' },
  { cm: 900, label: '아파트 3층' },
  { cm: 2500, label: '대왕고래 길이' },
  { cm: 3000, label: '10층 아파트' },
  { cm: 55500, label: '롯데월드타워' },
]

// 책 더미 색 (책등 보기와 비슷한 차분한 색)
const SLAB_COLORS = ['#33658a', '#c8553d', '#e9c46a', '#4a6c5d', '#7b6d8d', '#86bbd8', '#b5838d', '#2f4858', '#d9d4c7', '#6d6875']

const fmtCm = (cm) => (cm >= 100 ? `${(cm / 100).toFixed(cm >= 1000 ? 0 : 1)}m` : `${cm.toFixed(1)}cm`)

const STACK_H = 200 // 그림 높이(px)

/** 지금까지 다 읽은 책을 쌓으면 얼마나 될까: 책이 하나씩 떨어져 쌓이는 그림 + 비교 */
export function BookStackCard() {
  const books = useLiveQuery(() => db.books.where('status').equals('done').toArray(), [], null)
  if (!books) return null

  const sorted = [...books].sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0)) // 먼저 읽은 책이 아래
  const totalMm = sorted.reduce((s, b) => s + thicknessMm(b), 0)
  const cm = totalMm / 10
  const passed = [...LANDMARKS].reverse().find((l) => cm >= l.cm)
  const next = LANDMARKS.find((l) => cm < l.cm)
  const guessed = sorted.filter((b) => !(b.pageCount > 0)).length
  // 그림이 넘치지 않게 1px 당 mm 를 맞춥니다 (적을 땐 실제보다 크게)
  const scale = Math.min(4, STACK_H / Math.max(totalMm, 1))

  return (
    <Card title="쌓아 보면" sub={sorted.length ? `다 읽은 책 ${sorted.length}권을 한 줄로 쌓으면` : '다 읽은 책이 아직 없어요'}>
      <div className="flex items-end gap-4">
        <div className="relative flex w-24 shrink-0 flex-col-reverse items-center" style={{ height: STACK_H }}>
          {sorted.map((b, i) => {
            const h = hashString(`${b.title}|${b.isbn ?? ''}`)
            return (
              <motion.div
                key={b.id}
                title={b.title}
                initial={{ y: -STACK_H, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30, delay: Math.min(i * 0.05, 2) }}
                className="shrink-0 rounded-[1.5px]"
                style={{
                  height: Math.max(1, thicknessMm(b) * scale),
                  width: `${72 + (h % 28)}%`,
                  marginLeft: `${(h % 9) - 4}%`, // 살짝 삐뚤게
                  background: SLAB_COLORS[h % SLAB_COLORS.length],
                  boxShadow: 'inset 0 -1px 0 rgb(0 0 0 / 0.15)',
                }}
              />
            )
          })}
          <div className="absolute -bottom-1 h-1 w-full rounded-full bg-ink/15" />
        </div>

        <div className="min-w-0 flex-1 pb-1">
          <p className="text-3xl font-bold tabular-nums tracking-tight">{fmtCm(cm)}</p>
          {passed && <p className="mt-1 text-sm">🎉 {passed.label}보다 높아요</p>}
          {next && (
            <p className="mt-1 text-xs text-ink-2">
              다음은 {next.label} ({fmtCm(next.cm)}) · {fmtCm(next.cm - cm)} 남음
            </p>
          )}
          {guessed > 0 && <p className="mt-2 text-[11px] text-ink-3">쪽수를 모르는 {guessed}권은 300쪽으로 쳤어요</p>}
        </div>
      </div>
    </Card>
  )
}
