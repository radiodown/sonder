import { BUILDINGS, BUILD_MENU, UNITS, UPGRADES } from './data'
import * as E from './engine'

/**
 * 선택에 따른 명령 카드 (오른쪽 아래 버튼들).
 * 각 명령: { id, label, icon, hot, run(), disabled?, reason?, cost?, supply?, time?, desc?, active? }
 * run() 은 바로 실행하거나 ui.mode / ui.menu 를 바꿉니다. 실패 이유는 문자열로 돌려줍니다.
 */
export function getCommands(game, ui, sel) {
  const own = sel.filter((e) => e.team === 0)
  const units = own.filter((e) => e.cat === 'unit')
  const buildings = own.filter((e) => e.cat === 'building')
  const target = (cmd) => () => {
    ui.mode = { kind: 'target', cmd }
  }

  if (units.length && ui.menu === 'build') {
    return [
      ...BUILD_MENU.map((type) => {
        const d = BUILDINGS[type]
        const miss = E.missingReq(game, 0, d.req)
        return {
          id: `b-${type}`,
          label: d.names[0],
          icon: type,
          hot: d.hot,
          cost: d.cost,
          time: d.time,
          desc: d.desc,
          disabled: !!miss,
          reason: miss && `${miss} 필요`,
          run: () => {
            const err = miss ? `${miss}이(가) 필요합니다` : afford(game, d.cost)
            if (err) return err
            ui.mode = { kind: 'build', type }
            ui.menu = null
          },
        }
      }),
      { id: 'back', label: '뒤로', icon: 'back', hot: 'ESCAPE', run: () => void (ui.menu = null) },
    ]
  }

  if (units.length) {
    const workers = units.filter((u) => UNITS[u.type].worker)
    const list = [
      { id: 'move', label: '이동', icon: 'move', hot: 'M', run: target('move'), active: ui.mode?.cmd === 'move' },
      { id: 'stop', label: '정지', icon: 'stop', hot: 'S', run: () => E.orderStop(units) },
      { id: 'attack', label: '공격', icon: 'attack', hot: 'A', run: target('attack'), active: ui.mode?.cmd === 'attack' },
      { id: 'hold', label: '위치 사수', icon: 'hold', hot: 'H', run: () => E.orderHold(units) },
    ]
    if (workers.length) {
      list.push(
        { id: 'gather', label: '채취', icon: 'gather', hot: 'G', run: target('gather'), active: ui.mode?.cmd === 'gather' },
        { id: 'return', label: '자원 반납', icon: 'return', hot: 'C', disabled: !workers.some((w) => w.carry), run: () => E.orderReturn(game, workers) },
        { id: 'build', label: '건설', icon: 'build', hot: 'B', run: () => void (ui.menu = 'build') },
      )
    }
    return list
  }

  if (!buildings.length) return []
  const type = buildings[0].type
  const same = buildings.filter((b) => b.type === type)
  const d = BUILDINGS[type]
  if (!same[0].done) {
    return [{ id: 'cancelb', label: '건설 취소', icon: 'cancel', hot: 'ESCAPE', desc: '비용의 75%를 돌려받습니다', run: () => same.forEach((b) => E.cancelBuilding(game, b)) }]
  }
  const ready = same.filter((b) => b.done)
  const freest = () => ready.reduce((a, b) => (b.queue.length < a.queue.length ? b : a))
  const list = []
  for (const u of d.trains ?? []) {
    const ud = UNITS[u]
    const miss = E.missingReq(game, 0, ud.req)
    list.push({
      id: `t-${u}`,
      label: ud.names[0],
      icon: u,
      hot: ud.hot,
      cost: ud.cost,
      supply: ud.supply,
      time: ud.time,
      desc: ud.desc,
      disabled: !!miss,
      reason: miss && `${miss} 필요`,
      run: () => E.train(game, freest(), u),
    })
  }
  for (const key of d.research ?? []) {
    const up = UPGRADES[key]
    const t = game.teams[0]
    const lv = E.nextLevel(game, 0, key)
    const busy = t.researching[key]
    list.push({
      id: `r-${key}`,
      label: up.levels > 1 ? `${up.name} ${lv ?? up.levels}` : up.name,
      icon: key,
      hot: up.hot,
      cost: lv ? up.cost(lv) : null,
      time: lv ? up.time(lv) : null,
      desc: up.desc,
      level: t.ups[key],
      levels: up.levels,
      disabled: !lv,
      reason: busy ? '연구 중' : !lv ? '완료' : null,
      run: () => {
        const b = ready.find((x) => x.queue.length === 0) ?? freest()
        return E.research(game, b, key)
      },
    })
  }
  if (d.trains) list.push({ id: 'rally', label: '집결지', icon: 'rally', hot: 'Y', desc: '새 유닛이 모일 곳. 오른쪽 클릭으로도 정합니다', run: target('rally'), active: ui.mode?.cmd === 'rally' })
  if (ready.some((b) => b.queue.length)) {
    list.push({
      id: 'cancelq',
      label: '취소',
      icon: 'cancel',
      hot: 'ESCAPE',
      desc: '마지막 대기열을 취소합니다',
      run: () => {
        const b = ready.find((x) => x.queue.length > 1) ?? ready.find((x) => x.queue.length)
        E.cancelQueue(game, b)
      },
    })
  }
  return list
}

function afford(game, [p, i]) {
  const t = game.teams[0]
  if (t.paper < p) return '종이가 부족합니다'
  if (t.ink < i) return '잉크가 부족합니다'
  return null
}

export const ORDER_LABEL = {
  idle: '대기',
  hold: '위치 사수',
  move: '이동 중',
  amove: '공격하며 이동',
  attack: '공격 중',
  build: '건설하러 가는 중',
  construct: '건설 중',
}

export function orderLabel(u) {
  if (u.order.t === 'gather') return u.order.phase === 'mine' ? '채취 중' : u.order.phase === 'return' ? '자원 나르는 중' : '자원으로 가는 중'
  if (u.target && (u.order.t === 'idle' || u.order.t === 'hold' || u.order.t === 'amove')) return '교전 중'
  return ORDER_LABEL[u.order.t] ?? ''
}
