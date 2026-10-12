import { BugIcon, PlayIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { Segmented } from '../../ui/Segmented'
import { DIFFICULTIES } from './data'
import { Play } from './Play'
import { clock, loadRecords } from './records'

const CONTROLS = [
  ['왼쪽 클릭 · 드래그', '선택 (더블 클릭·Ctrl+클릭: 화면의 같은 유닛 모두)'],
  ['오른쪽 클릭', '이동 · 공격 · 채취 · 건설 이어 하기 · 집결지'],
  ['A → 클릭', '공격하며 이동'],
  ['B', '사서 건설 메뉴'],
  ['Ctrl/Alt + 숫자', '부대 지정 (숫자 두 번: 그 부대로 화면 이동)'],
  ['F1 · F2', '쉬는 사서 · 전체 병력'],
  ['방향키 · 가장자리 · 휠', '화면 이동 (미니맵 클릭도)'],
  ['F10', '일시정지'],
]

/** 책벌레 전쟁: 시작 메뉴 → 한 판 */
export function RtsWindow({ win }) {
  const [difficulty, setDifficulty] = useState('normal')
  const [round, setRound] = useState(0) // 0 이면 메뉴, 아니면 판 번호 (다시 하기 = 새 key)

  if (round) {
    return <Play key={round} win={win} difficulty={difficulty} onExit={() => setRound(0)} onRestart={() => setRound((r) => r + 1)} />
  }

  const records = loadRecords()
  return (
    <div className="flex h-full flex-col">
      <div className="window-drag h-12 shrink-0" />
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-6 overflow-y-auto px-8 pb-8">
        <div className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-red-600 text-white shadow-lg">
            <BugIcon size={36} weight="duotone" />
          </div>
          <div>
            <h1 className="text-[26px] font-bold tracking-tight">책벌레 전쟁</h1>
            <p className="text-[13px] text-ink-2">책을 갉아먹으러 오는 벌레 떼로부터 도서관을 지키고, 벌레 둥지를 모두 무너뜨리세요.</p>
          </div>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-semibold text-ink-2">난이도</h2>
          <Segmented
            options={Object.entries(DIFFICULTIES).map(([value, d]) => ({ value, label: d.label }))}
            value={difficulty}
            onChange={setDifficulty}
            className="w-full"
          />
          <p className="text-[12px] text-ink-3">{DIFFICULTIES[difficulty].desc}</p>
          {records[difficulty] && (
            <p className="text-[12px] text-ink-2">
              {records[difficulty].wins}승 {records[difficulty].losses}패
              {records[difficulty].best != null && ` · 최고 기록 ${clock(records[difficulty].best)}`}
            </p>
          )}
        </section>

        <button
          onClick={() => setRound(1)}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-semibold text-white shadow-sm hover:brightness-110"
        >
          <PlayIcon size={16} weight="fill" /> 시작
        </button>

        <section className="flex flex-col gap-2 text-[12px]">
          <h2 className="text-[13px] font-semibold text-ink-2">자원과 기술</h2>
          <p className="leading-relaxed text-ink-2">
            사서로 <b className="text-ink">종이</b>를 캐고, 잉크 샘 위에 잉크 공방을 지어 <b className="text-ink">잉크</b>를 캡니다. 열람실(보병) → 제본소(기계) → 격납고(비행) 순으로 기술이 열리고,
            연구실과 인쇄소에서 공격력·방어력을 3단계까지 올립니다. 벌레도 똑같은 건물·유닛·업그레이드를 씁니다.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-semibold text-ink-2">조작</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
            {CONTROLS.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="font-medium">{k}</dt>
                <dd className="text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  )
}
