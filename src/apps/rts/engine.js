import { BUILDINGS, DIFFICULTIES, MAP_H, MAP_W, MAX_SUPPLY, TILE, UNITS, UPGRADES, buildingName, unitName, unitStats } from './data'
import { buildMap } from './map'
import { findPath, inMap, nearestFree, toTile } from './path'

/**
 * 게임 상태와 규칙. React 를 모르고, 매 프레임 step(game, dt) 로 진행합니다.
 * 팀 0 = 플레이어(도서관), 1 = AI(벌레). 자원(종이 더미·잉크 샘)은 team -1.
 */

const N = MAP_W * MAP_H
// 잉크는 한 번에 한 명씩 공방에 들어가 짧게 캡니다. 오가는 시간이 캐는 시간의 두 배쯤이라 3명이면 꽉 찹니다 (스타크래프트 가스처럼)
const MINE_TIME = { paper: 2.4, ink: 0.55 }
const MINE_AMOUNT = { paper: 8, ink: 3 }
export const INK_WORKERS = 3
const REACH = 18 // 건물·자원에 '닿았다' 고 보는 거리 (몸 가장자리부터)

const newTeam = () => ({
  paper: 50,
  ink: 0,
  supplyUsed: 0,
  supplyCap: 0,
  ups: Object.fromEntries(Object.keys(UPGRADES).map((k) => [k, 0])),
  researching: {},
  statCache: {},
  income: 1,
  stats: { made: 0, lost: 0, killed: 0, gathered: 0 },
})

export function createGame(difficulty) {
  const map = buildMap()
  const diff = DIFFICULTIES[difficulty]
  const game = {
    difficulty,
    diff,
    time: 0,
    nextId: 1,
    terrain: map.terrain,
    blocked: Uint8Array.from(map.terrain),
    occ: new Int32Array(N), // 타일을 차지한 건물·자원 id
    list: [],
    ents: new Map(),
    teams: [newTeam(), newTeam()],
    effects: [],
    msgs: [],
    pings: [],
    vis: new Uint8Array(N),
    explored: new Uint8Array(N),
    visTimer: 0,
    overTimer: 0,
    over: null,
    pathBudget: 0,
    alertAt: -99,
    ai: null,
  }
  game.teams[1].income = diff.income
  game.teams[1].paper += diff.startBonus

  for (const [tx, ty] of map.minerals) addResource(game, 'mineral', tx, ty, 2, 1, 1500)
  for (const [tx, ty] of map.geysers) addResource(game, 'geyser', tx, ty, 2, 2, 5000)
  for (const spot of map.hqSpots) {
    if (!spot.start) continue
    const hq = addBuilding(game, spot.team, 'hq', ...spot.pos, true)
    for (let i = 0; i < 4; i++) {
      const p = spawnPoint(game, hq, null, 7)
      const w = addUnit(game, spot.team, 'worker', p[0], p[1])
      orderGather(game, [w], nearestMineral(game, hq.x, hq.y, w.id))
    }
  }
  recomputeSupply(game)
  computeVis(game)
  return game
}

// ───────── 엔티티 ─────────

function register(game, e) {
  e.id = game.nextId++
  game.list.push(e)
  game.ents.set(e.id, e)
  return e
}

function occupy(game, e, id) {
  for (let j = e.ty; j < e.ty + e.h; j++) for (let i = e.tx; i < e.tx + e.w; i++) {
    const k = j * MAP_W + i
    game.occ[k] = id
    game.blocked[k] = id || game.terrain[k] ? 1 : 0
  }
}

function addResource(game, type, tx, ty, w, h, amount) {
  const e = register(game, {
    cat: 'res',
    team: -1,
    type,
    tx, ty, w, h,
    x: (tx + w / 2) * TILE,
    y: (ty + h / 2) * TILE,
    amount,
    maxAmount: amount,
    busy: 0,
    refinery: 0,
  })
  occupy(game, e, e.id)
  return e
}

export function addUnit(game, team, type, x, y) {
  const d = UNITS[type]
  return register(game, {
    cat: 'unit',
    team,
    type,
    x, y,
    r: d.r,
    air: !!d.air,
    hp: d.hp,
    maxHp: d.hp,
    order: { t: 'idle' },
    target: null,
    path: null,
    cd: 0,
    facing: team === 0 ? -Math.PI / 4 : (Math.PI * 3) / 4,
    carry: null,
    guard: { x, y },
    acq: Math.random() * 0.3,
    bank: game.teams[team],
    stuckT: 0,
    lastX: x,
    lastY: y,
  })
}

export function addBuilding(game, team, type, tx, ty, done) {
  const d = BUILDINGS[type]
  const b = register(game, {
    cat: 'building',
    team,
    type,
    tx, ty, w: d.w, h: d.h,
    x: (tx + d.w / 2) * TILE,
    y: (ty + d.h / 2) * TILE,
    r: Math.min(d.w, d.h) * 16,
    hp: done ? d.hp : d.hp * 0.1,
    maxHp: d.hp,
    done,
    progress: 0,
    queue: [],
    rally: null,
    cd: 0,
    target: null,
    acq: 0,
    builder: 0,
    geyser: 0,
    amount: 0,
  })
  if (d.onGeyser) {
    const gz = game.list.find((e) => e.cat === 'res' && e.type === 'geyser' && e.tx === tx && e.ty === ty)
    gz.refinery = b.id
    b.geyser = gz.id
    b.amount = gz.amount
  }
  occupy(game, b, b.id)
  // 자리 위에 서 있던 지상 유닛은 비켜 줍니다
  for (const u of game.list) {
    if (u.cat !== 'unit' || u.air) continue
    if (game.blocked[toTile(u.y) * MAP_W + toTile(u.x)]) {
      const p = nearestFree(game.blocked, toTile(u.x), toTile(u.y))
      if (p) {
        u.x = p[0] * TILE + TILE / 2
        u.y = p[1] * TILE + TILE / 2
        u.path = null
      }
    }
  }
  return b
}

const alive = (e) => e && !e.dead

export const ent = (game, id) => {
  const e = game.ents.get(id)
  return alive(e) ? e : null
}

/** 점에서 엔티티 몸 가장자리까지 거리 */
export function distTo(e, x, y) {
  if (e.cat === 'unit') return Math.hypot(e.x - x, e.y - y) - e.r
  const x0 = e.tx * TILE
  const y0 = e.ty * TILE
  const dx = Math.max(x0 - x, 0, x - (x0 + e.w * TILE))
  const dy = Math.max(y0 - y, 0, y - (y0 + e.h * TILE))
  return Math.hypot(dx, dy)
}

/** 두 엔티티 몸 가장자리 사이 거리 */
export const gap = (a, b) => distTo(b, a.x, a.y) - a.r

/** 사각형 엔티티에서 (x,y) 에 가장 가까운 테두리 바깥 점 */
function edgePoint(e, x, y, out = 14) {
  const x0 = e.tx * TILE
  const y0 = e.ty * TILE
  const cx = Math.min(Math.max(x, x0), x0 + e.w * TILE)
  const cy = Math.min(Math.max(y, y0), y0 + e.h * TILE)
  const dx = cx - e.x
  const dy = cy - e.y
  const len = Math.hypot(dx, dy) || 1
  return [cx + (dx / len) * out, cy + (dy / len) * out]
}

export function stats(game, u) {
  const t = game.teams[u.team]
  return (t.statCache[u.type] ??= unitStats(u.type, t.ups))
}

function attackOf(game, e) {
  if (e.cat === 'unit') return { ...UNITS[e.type].attack, ...stats(game, e) }
  const a = BUILDINGS[e.type].attack
  return a && e.done ? { ...a, airDmg: a.dmg, airRange: a.range } : null
}

const canHit = (atk, target) => !!atk && (target.air ? atk.air : atk.ground) && target.cat !== 'res'

export const isEnemy = (a, b) => a.team >= 0 && b.team >= 0 && a.team !== b.team

/** 플레이어 눈에 보이는지 (안개) */
export function visibleToPlayer(game, e) {
  if (e.team === 0) return true
  const k = toTile(e.y) * MAP_W + toTile(e.x)
  if (e.cat === 'unit') return !!game.vis[k]
  return !!game.explored[k]
}

export function message(game, text, team = 0) {
  if (team !== 0) return
  const last = game.msgs[game.msgs.length - 1]
  if (last && last.text === text && game.time - last.t < 1) return
  game.msgs.push({ text, t: game.time })
  if (game.msgs.length > 6) game.msgs.shift()
}

// ───────── 자원·인구 ─────────

function recomputeSupply(game) {
  for (const t of game.teams) {
    t.supplyUsed = 0
    t.supplyCap = 0
  }
  for (const e of game.list) {
    if (e.dead || e.team < 0) continue
    const t = game.teams[e.team]
    if (e.cat === 'unit') t.supplyUsed += UNITS[e.type].supply
    else {
      if (e.done) t.supplyCap += BUILDINGS[e.type].supply ?? 0
      for (const q of e.queue) if (q.kind === 'unit') t.supplyUsed += UNITS[q.key].supply
    }
  }
  for (const t of game.teams) t.supplyCap = Math.min(MAX_SUPPLY, t.supplyCap)
}

function afford(game, team, [p, i]) {
  const t = game.teams[team]
  if (t.paper < p) return '종이가 부족합니다'
  if (t.ink < i) return '잉크가 부족합니다'
  return null
}

function spend(game, team, [p, i], sign = 1) {
  const t = game.teams[team]
  t.paper -= p * sign
  t.ink -= i * sign
}

/** 팀이 가진 완성된 건물 종류 */
export function builtTypes(game, team) {
  const s = new Set()
  for (const e of game.list) if (e.cat === 'building' && e.team === team && e.done && !e.dead) s.add(e.type)
  return s
}

/** 요구 건물 중 없는 것 (이름) */
export function missingReq(game, team, req = []) {
  const have = builtTypes(game, team)
  const miss = req.filter((r) => !have.has(r))
  return miss.length ? miss.map((r) => buildingName(r, team)).join(', ') : null
}

export function nearestMineral(game, x, y, forId = 0, maxD = 14 * TILE) {
  let best = null
  let bd = Infinity
  for (const e of game.list) {
    if (e.cat !== 'res' || e.type !== 'mineral' || e.dead) continue
    const d = Math.hypot(e.x - x, e.y - y) + (e.busy && e.busy !== forId ? 40 : 0)
    if (d < bd && d < maxD) {
      bd = d
      best = e
    }
  }
  return best
}

function nearestDepot(game, team, x, y) {
  let best = null
  let bd = Infinity
  for (const e of game.list) {
    if (e.cat !== 'building' || e.team !== team || e.dead || !e.done || !BUILDINGS[e.type].depot) continue
    const d = Math.hypot(e.x - x, e.y - y)
    if (d < bd) {
      bd = d
      best = e
    }
  }
  return best
}

// ───────── 명령 ─────────

/** 여러 유닛을 한 점으로. 격자 대형으로 흩어 세웁니다 */
export function orderMove(game, units, x, y, attack = false) {
  const n = units.length
  const cols = Math.ceil(Math.sqrt(n))
  const sorted = [...units].sort((a, b) => a.y - b.y || a.x - b.x)
  sorted.forEach((u, i) => {
    const ox = n > 1 ? ((i % cols) - (cols - 1) / 2) * 24 : 0
    const oy = n > 1 ? (Math.floor(i / cols) - (Math.ceil(n / cols) - 1) / 2) * 24 : 0
    setOrder(u, { t: attack ? 'amove' : 'move', x: x + ox, y: y + oy })
  })
}

function setOrder(u, order) {
  refundBuild(u)
  releaseMine(u)
  u.order = order
  u.target = null
  u.path = null
  u.stuckT = 0
}

/** 아직 자리를 잡지 못한 건설 명령이 바뀌거나 일꾼이 죽으면 비용을 돌려줍니다 */
function refundBuild(u) {
  const o = u.order
  if (o.t !== 'build' || o.settled) return
  o.settled = true
  const [p, i] = BUILDINGS[o.type].cost
  u.bank.paper += p
  u.bank.ink += i
}

function releaseMine(u) {
  if (u._mining && u._mining.busy === u.id) u._mining.busy = 0
  u._mining = null
}

export function orderAttack(game, units, target) {
  for (const u of units) {
    if (canHit(attackOf(game, u), target)) setOrder(u, { t: 'attack', id: target.id })
    else setOrder(u, { t: 'move', x: target.x, y: target.y })
  }
}

export function orderStop(units) {
  for (const u of units) {
    setOrder(u, { t: 'idle' })
    u.guard = { x: u.x, y: u.y }
  }
}

export function orderHold(units) {
  for (const u of units) setOrder(u, { t: 'hold' })
}

export function orderGather(game, units, res) {
  let list = units.filter((u) => UNITS[u.type].worker)
  if (!res || !list.length) return
  if (res.cat === 'building') {
    // 잉크 공방 하나에 3명까지. 넘치는 일꾼은 가까운 종이 더미로
    const busy = game.list.filter((w) => w.cat === 'unit' && !w.dead && w.order.t === 'gather' && w.order.id === res.id && !list.includes(w)).length
    list.sort((a, b) => Math.hypot(a.x - res.x, a.y - res.y) - Math.hypot(b.x - res.x, b.y - res.y))
    const extra = list.slice(Math.max(0, INK_WORKERS - busy))
    list = list.slice(0, Math.max(0, INK_WORKERS - busy))
    if (extra.length) {
      message(game, `${buildingName('refinery', res.team)}에는 ${INK_WORKERS}명까지만 일할 수 있습니다`, res.team)
      for (const u of extra) {
        const m = nearestMineral(game, u.x, u.y, u.id)
        if (m) setOrder(u, { t: 'gather', id: m.id, phase: u.carry ? 'return' : 'go' })
      }
    }
  }
  for (const u of list) setOrder(u, { t: 'gather', id: res.id, phase: u.carry ? 'return' : 'go' })
}

export function orderReturn(game, units) {
  for (const u of units) {
    if (!u.carry) continue
    setOrder(u, { t: 'gather', id: u.lastRes ?? 0, phase: 'return' })
  }
}

export function canPlace(game, team, type, tx, ty) {
  const d = BUILDINGS[type]
  if (tx < 0 || ty < 0 || tx + d.w > MAP_W || ty + d.h > MAP_H) return false
  if (d.onGeyser) {
    return game.list.some((e) => e.cat === 'res' && e.type === 'geyser' && !e.refinery && e.tx === tx && e.ty === ty && (team !== 0 || game.explored[ty * MAP_W + tx]))
  }
  for (let j = ty; j < ty + d.h; j++) for (let i = tx; i < tx + d.w; i++) {
    const k = j * MAP_W + i
    if (game.blocked[k]) return false
    if (team === 0 && !game.explored[k]) return false
  }
  // 적 지상 유닛이 서 있으면 안 됩니다
  const x0 = tx * TILE
  const y0 = ty * TILE
  return !game.list.some(
    (u) => u.cat === 'unit' && !u.dead && !u.air && u.team !== team && u.x > x0 - u.r && u.x < x0 + d.w * TILE + u.r && u.y > y0 - u.r && u.y < y0 + d.h * TILE + u.r,
  )
}

/** 일꾼에게 건설 명령. 비용은 바로 냅니다 (못 지으면 돌려받음). 실패하면 이유를 돌려줍니다 */
export function orderBuild(game, worker, type, tx, ty) {
  const d = BUILDINGS[type]
  const miss = missingReq(game, worker.team, d.req)
  if (miss) return `${miss}이(가) 필요합니다`
  if (!canPlace(game, worker.team, type, tx, ty)) return '여기에는 지을 수 없습니다'
  const err = afford(game, worker.team, d.cost)
  if (err) return err
  spend(game, worker.team, d.cost)
  setOrder(worker, { t: 'build', type, tx, ty })
  return null
}

export function orderResume(game, worker, b) {
  if (!UNITS[worker.type].worker || b.done || b.team !== worker.team) return
  setOrder(worker, { t: 'construct', id: b.id })
}

/** 오른쪽 클릭: 대상에 따라 공격·채취·이동·건설 재개 */
export function smartOrder(game, sel, x, y, target) {
  const units = sel.filter((e) => e.cat === 'unit')
  for (const b of sel) {
    if (b.cat === 'building' && b.team === 0 && BUILDINGS[b.type].trains) {
      b.rally = target && target.cat === 'res' ? { x: target.x, y: target.y, id: target.id } : { x, y }
    }
  }
  if (!units.length) return null
  if (target && isEnemy(units[0], target)) {
    orderAttack(game, units, target)
    return 'attack'
  }
  const workers = units.filter((u) => UNITS[u.type].worker)
  const others = units.filter((u) => !UNITS[u.type].worker)
  if (target && workers.length) {
    const isRes = target.cat === 'res' && target.type === 'mineral'
    const isRef = target.cat === 'building' && target.type === 'refinery' && target.team === 0 && target.done
    if (isRes || isRef) {
      orderGather(game, workers, target)
      if (others.length) orderMove(game, others, x, y)
      return 'gather'
    }
    if (target.cat === 'building' && target.team === 0 && !target.done) {
      for (const w of workers) orderResume(game, w, target)
      if (others.length) orderMove(game, others, x, y)
      return 'build'
    }
    if (target.cat === 'building' && target.team === 0 && BUILDINGS[target.type].depot) {
      const carrying = workers.filter((w) => w.carry)
      orderReturn(game, carrying)
      const rest = units.filter((u) => !carrying.includes(u))
      if (rest.length) orderMove(game, rest, x, y)
      return 'move'
    }
  }
  orderMove(game, units, x, y)
  return 'move'
}

export function train(game, b, type) {
  const d = UNITS[type]
  if (!b.done || !BUILDINGS[b.type].trains?.includes(type)) return '만들 수 없습니다'
  const miss = missingReq(game, b.team, d.req)
  if (miss) return `${miss}이(가) 필요합니다`
  if (b.queue.length >= 5) return '대기열이 가득 찼습니다'
  const t = game.teams[b.team]
  if (t.supplyUsed + d.supply > t.supplyCap) return t.supplyCap >= MAX_SUPPLY ? '최대 인구수입니다' : `인구수가 부족합니다. ${buildingName('supply', b.team)}를 지으세요`
  const err = afford(game, b.team, d.cost)
  if (err) return err
  spend(game, b.team, d.cost)
  b.queue.push({ kind: 'unit', key: type, t: 0, total: d.time })
  t.supplyUsed += d.supply
  return null
}

/** 다음 단계 (이미 최대거나 연구 중이면 null) */
export function nextLevel(game, team, key) {
  const t = game.teams[team]
  if (t.researching[key]) return null
  const lv = t.ups[key] + 1
  return lv > UPGRADES[key].levels ? null : lv
}

export function research(game, b, key) {
  const u = UPGRADES[key]
  if (!b.done || !BUILDINGS[b.type].research?.includes(key)) return '연구할 수 없습니다'
  const t = game.teams[b.team]
  if (t.researching[key]) return '이미 연구 중입니다'
  const lv = nextLevel(game, b.team, key)
  if (!lv) return '최대 단계입니다'
  if (b.queue.length >= 5) return '대기열이 가득 찼습니다'
  const cost = u.cost(lv)
  const err = afford(game, b.team, cost)
  if (err) return err
  spend(game, b.team, cost)
  t.researching[key] = true
  b.queue.push({ kind: 'upg', key, lv, t: 0, total: u.time(lv), cost })
  return null
}

export function cancelQueue(game, b, idx = b.queue.length - 1) {
  const q = b.queue[idx]
  if (!q) return
  b.queue.splice(idx, 1)
  if (q.kind === 'unit') {
    spend(game, b.team, UNITS[q.key].cost, -1)
    game.teams[b.team].supplyUsed -= UNITS[q.key].supply
  } else {
    spend(game, b.team, q.cost, -1)
    delete game.teams[b.team].researching[q.key]
  }
}

/** 짓는 중인 건물 취소: 75% 돌려받음 */
export function cancelBuilding(game, b) {
  if (b.done) return
  const [p, i] = BUILDINGS[b.type].cost
  spend(game, b.team, [Math.floor(p * 0.75), Math.floor(i * 0.75)], -1)
  destroy(game, b, null, true)
}

// ───────── 진행 ─────────

export function step(game, dt) {
  if (game.over) return
  game.time += dt
  game.pathBudget = 40
  recomputeSupply(game)

  for (const e of game.list) {
    if (e.dead) continue
    if (e.cat === 'unit') updateUnit(game, e, dt)
    else if (e.cat === 'building') updateBuilding(game, e, dt)
  }
  separate(game, dt)

  if (game.list.some((e) => e.dead)) {
    game.list = game.list.filter((e) => {
      if (e.dead) game.ents.delete(e.id)
      return !e.dead
    })
  }

  for (const fx of game.effects) fx.t += dt
  game.effects = game.effects.filter((fx) => fx.t < fx.life)
  game.pings = game.pings.filter((p) => game.time - p.t < 3)

  game.visTimer -= dt
  if (game.visTimer <= 0) {
    game.visTimer = 0.2
    computeVis(game)
  }

  game.overTimer -= dt
  if (game.overTimer <= 0) {
    game.overTimer = 0.5
    const left = [0, 0]
    for (const e of game.list) if (e.cat === 'building') left[e.team]++
    if (!left[1]) game.over = { winner: 0, time: game.time }
    else if (!left[0]) game.over = { winner: 1, time: game.time }
  }
}

function computeVis(game) {
  const { vis, explored } = game
  vis.fill(0)
  for (const e of game.list) {
    if (e.team !== 0) continue
    const sight = e.cat === 'unit' ? UNITS[e.type].sight : BUILDINGS[e.type].sight
    const cx = e.x / TILE
    const cy = e.y / TILE
    const r = sight + (e.cat === 'building' ? Math.max(e.w, e.h) / 2 : 0)
    for (let j = Math.max(0, Math.floor(cy - r)); j <= Math.min(MAP_H - 1, Math.ceil(cy + r)); j++) {
      for (let i = Math.max(0, Math.floor(cx - r)); i <= Math.min(MAP_W - 1, Math.ceil(cx + r)); i++) {
        const dx = i + 0.5 - cx
        const dy = j + 0.5 - cy
        if (dx * dx + dy * dy <= r * r) {
          vis[j * MAP_W + i] = 1
          explored[j * MAP_W + i] = 1
        }
      }
    }
  }
}

// ── 유닛 ──

function updateUnit(game, u, dt) {
  u.cd = Math.max(0, u.cd - dt)
  const o = u.order
  const atk = attackOf(game, u)
  const worker = UNITS[u.type].worker

  switch (o.t) {
    case 'idle':
    case 'hold': {
      const hold = o.t === 'hold'
      const tgt = acquire(game, u, atk, dt, hold ? Math.max(atk.range, atk.airRange) : UNITS[u.type].sight * TILE, worker)
      if (tgt) {
        if (!hold && Math.hypot(u.x - u.guard.x, u.y - u.guard.y) > 8 * TILE) {
          // 너무 멀리 쫓아갔으면 제자리로
          u.target = null
          setOrder(u, { t: 'move', x: u.guard.x, y: u.guard.y, back: true })
        } else engage(game, u, tgt, atk, dt, !hold)
      }
      break
    }
    case 'move':
      if (moveTo(game, u, o.x, o.y, dt)) {
        setOrder(u, { t: 'idle' })
        u.guard = { x: u.x, y: u.y }
      }
      break
    case 'amove': {
      const tgt = acquire(game, u, atk, dt, UNITS[u.type].sight * TILE)
      if (tgt) engage(game, u, tgt, atk, dt, true)
      else if (moveTo(game, u, o.x, o.y, dt)) {
        setOrder(u, { t: 'idle' })
        u.guard = { x: u.x, y: u.y }
      }
      break
    }
    case 'attack': {
      const tgt = ent(game, o.id)
      if (!tgt || (u.team === 0 && !visibleToPlayer(game, tgt) && tgt.cat === 'unit')) {
        setOrder(u, { t: 'idle' })
        u.guard = { x: u.x, y: u.y }
      } else engage(game, u, tgt, atk, dt, true)
      break
    }
    case 'gather':
      gather(game, u, dt)
      break
    case 'build':
      buildStep(game, u, dt)
      break
    case 'construct':
      constructStep(game, u, dt)
      break
  }
}

/** 공격할 적 고르기 (0.3초마다). 이미 잡은 대상이 유효하면 유지 */
function acquire(game, u, atk, dt, radius, passive = false) {
  if (!atk) return null
  const cur = u.target && ent(game, u.target)
  if (cur && canHit(atk, cur) && gap(u, cur) <= radius + 2 * TILE) return cur
  u.target = null
  if (passive) return null
  u.acq -= dt
  if (u.acq > 0) return null
  u.acq = 0.3
  let best = null
  let bs = Infinity
  for (const e of game.list) {
    if (e.dead || !isEnemy(u, e) || !canHit(atk, e)) continue
    const d = gap(u, e)
    if (d > radius) continue
    if (u.team === 0 && !visibleToPlayer(game, e)) continue
    const harmless = !attackOf(game, e)
    const s = d + (e.cat === 'building' ? 220 : 0) + (harmless ? 80 : 0)
    if (s < bs) {
      bs = s
      best = e
    }
  }
  if (best) u.target = best.id
  return best
}

function engage(game, u, tgt, atk, dt, canMove) {
  u.target = tgt.id
  const range = tgt.air ? atk.airRange : atk.range
  const d = gap(u, tgt)
  if (d <= range) {
    u.path = null
    u.facing = Math.atan2(tgt.y - u.y, tgt.x - u.x)
    if (u.cd <= 0) fire(game, u, tgt, atk)
    u.stuckT = 0
  } else if (canMove) {
    const [gx, gy] = tgt.cat === 'unit' ? [tgt.x, tgt.y] : edgePoint(tgt, u.x, u.y, 4)
    moveTo(game, u, gx, gy, dt)
  } else u.target = null
}

function fire(game, a, tgt, atk) {
  const dmg = tgt.air ? atk.airDmg : atk.dmg
  a.cd = atk.cd
  a.firedAt = game.time
  damage(game, tgt, dmg, a)
  const kind = a.cat === 'building' ? 'bolt' : { worker: 'hit', melee: 'hit', tank: 'shell', bomber: 'bomb' }[a.type] ?? 'bolt'
  // 총구에서 나가게
  const ang = Math.atan2(tgt.y - a.y, tgt.x - a.x)
  const reach = a.cat === 'unit' ? a.r + 6 : 20
  const lift = a.air ? 16 : a.cat === 'building' ? 20 : 0
  game.effects.push({ kind, team: a.team, x1: a.x + Math.cos(ang) * reach, y1: a.y - lift + Math.sin(ang) * reach, x2: tgt.x, y2: tgt.y - (tgt.air ? 16 : 0), t: 0, life: kind === 'shell' ? 0.35 : kind === 'bomb' ? 0.4 : 0.15 })
  if (atk.splash) {
    game.effects.push({ kind: 'splash', team: a.team, x1: tgt.x, y1: tgt.y, r: atk.splash, t: 0, life: 0.45 })
    for (const e of game.list) {
      if (e === tgt || e.dead || e.air || !isEnemy(a, e) || e.cat === 'res') continue
      if (distTo(e, tgt.x, tgt.y) <= atk.splash) damage(game, e, dmg * 0.5, a)
    }
  }
}

function damage(game, tgt, raw, src) {
  if (tgt.dead) return
  const armor = tgt.cat === 'unit' ? stats(game, tgt).armor : BUILDINGS[tgt.type].armor
  tgt.hp -= Math.max(0.5, raw - armor)
  tgt.hitAt = game.time
  if (tgt.team === 0 && game.time - game.alertAt > 12) {
    game.alertAt = game.time
    message(game, tgt.cat === 'building' ? '기지가 공격받고 있습니다!' : '유닛이 공격받고 있습니다!')
    game.pings.push({ x: tgt.x, y: tgt.y, t: game.time })
  }
  // 맞으면 반격하고, 근처의 쉬고 있는 아군도 돕습니다
  if (src && src.team >= 0) {
    const helpers = game.list.filter(
      (e) => e.cat === 'unit' && e.team === tgt.team && !e.dead && e.order.t === 'idle' && !e.target && !UNITS[e.type].worker && Math.hypot(e.x - tgt.x, e.y - tgt.y) < 7 * TILE,
    )
    for (const h of helpers) if (canHit(attackOf(game, h), src)) h.target = src.id
  }
  if (tgt.hp <= 0) destroy(game, tgt, src)
}

function destroy(game, e, src, silent = false) {
  e.dead = true
  e.hp = 0
  if (!silent && e.team >= 0) {
    game.teams[e.team].stats.lost++
    if (src && src.team >= 0) game.teams[src.team].stats.killed++
    game.effects.push({ kind: 'boom', x1: e.x, y1: e.y, r: e.cat === 'building' ? Math.max(e.w, e.h) * 18 : e.r * 2.2, t: 0, life: 0.6 })
  }
  if (e.cat === 'unit') {
    refundBuild(e)
    releaseMine(e)
  }
  if (e.cat === 'building') {
    occupy(game, e, 0)
    if (e.geyser) {
      const gz = game.ents.get(e.geyser)
      gz.refinery = 0
      gz.amount = e.amount
      occupy(game, gz, gz.id)
    }
    if (e.team === 0 && !silent) message(game, `${buildingName(e.type, 0)}이(가) 파괴됐습니다`)
  }
  if (e.cat === 'res') occupy(game, e, 0)
}

/**
 * (gx,gy) 쪽으로 한 걸음. 도착하면 true.
 * 지상 유닛은 길찾기 경로를 따라가고, 0.4초 넘게 지난 경로는 목표가 바뀌었을 때만 다시 찾습니다.
 */
function moveTo(game, u, gx, gy, dt) {
  const st = stats(game, u)
  if (Math.hypot(gx - u.x, gy - u.y) < 4) return true
  if (u.air) {
    stepToward(game, u, gx, gy, st.speed * dt)
    return Math.hypot(gx - u.x, gy - u.y) < 4
  }
  const goalMoved = !u.pathGoal || Math.hypot(u.pathGoal[0] - gx, u.pathGoal[1] - gy) > 20
  if (!u.path || (goalMoved && game.time - (u.pathAt ?? 0) > 0.4)) {
    if (game.pathBudget > 0) {
      game.pathBudget--
      u.path = findPath(game.blocked, u.x, u.y, gx, gy, u.r - 1)
      u.pathIdx = 0
      u.pathGoal = [gx, gy]
      u.pathAt = game.time
    } else if (!u.path) return false
  }
  let wp = u.path[u.pathIdx]
  while (wp && Math.hypot(wp[0] - u.x, wp[1] - u.y) < 5) {
    u.pathIdx++
    wp = u.path[u.pathIdx]
  }
  if (!wp) {
    u.path = null
    // 경로 끝까지 왔는데 목표에 못 닿으면 (막힌 곳) 그냥 도착으로 칩니다
    return true
  }
  stepToward(game, u, wp[0], wp[1], st.speed * dt)

  // 끼어서 못 움직이면 경로를 다시 찾고, 오래 끼면 포기
  u.stuckT += dt
  if (u.stuckT > 0.8) {
    const moved = Math.hypot(u.x - u.lastX, u.y - u.lastY)
    u.lastX = u.x
    u.lastY = u.y
    u.stuckT = 0
    if (moved < 10) {
      u.path = null
      u.stuckN = (u.stuckN ?? 0) + 1
      if (u.stuckN > 4 && Math.hypot(gx - u.x, gy - u.y) < 3 * TILE) {
        u.stuckN = 0
        return true
      }
    } else u.stuckN = 0
  }
  return false
}

function stepToward(game, u, x, y, max) {
  const dx = x - u.x
  const dy = y - u.y
  const d = Math.hypot(dx, dy)
  if (d < 0.01) return
  const s = Math.min(max, d)
  const nx = u.x + (dx / d) * s
  const ny = u.y + (dy / d) * s
  u.facing = Math.atan2(dy, dx)
  // 막힌 칸에 끼어 있으면 (방금 지은 건물 등) 어디로든 빠져나갈 수 있게
  if (u.air || free(game, nx, ny) || !free(game, u.x, u.y)) {
    u.x = nx
    u.y = ny
  } else if (free(game, nx, u.y)) u.x = nx
  else if (free(game, u.x, ny)) u.y = ny
  u.x = Math.min(Math.max(u.x, 4), MAP_W * TILE - 4)
  u.y = Math.min(Math.max(u.y, 4), MAP_H * TILE - 4)
}

const free = (game, x, y) => {
  const tx = toTile(x)
  const ty = toTile(y)
  return inMap(tx, ty) && !game.blocked[ty * MAP_W + tx]
}

/** 겹친 유닛끼리 밀어내기. 일하는 일꾼은 서로 통과합니다 (일꾼 줄이 엉키지 않게) */
function separate(game, dt) {
  const us = game.list.filter((e) => e.cat === 'unit' && !e.dead)
  const ghost = (u) => UNITS[u.type].worker && (u.order.t === 'gather' || u.order.t === 'construct')
  for (let i = 0; i < us.length; i++) {
    const a = us[i]
    for (let j = i + 1; j < us.length; j++) {
      const b = us[j]
      if (a.air !== b.air) continue
      const min = a.r + b.r
      const dx = b.x - a.x
      if (dx > min || dx < -min) continue
      const dy = b.y - a.y
      if (dy > min || dy < -min) continue
      const d = Math.hypot(dx, dy)
      if (d >= min) continue
      if (ghost(a) || ghost(b)) continue
      const push = Math.min((min - d) * 0.5, 60 * dt)
      const nx = d > 0.01 ? dx / d : Math.cos(a.id)
      const ny = d > 0.01 ? dy / d : Math.sin(a.id)
      const am = moving(a)
      const bm = moving(b)
      const wa = am && !bm ? 0.2 : !am && bm ? 1.8 : 1
      const wb = 2 - wa
      nudge(game, a, -nx * push * wa, -ny * push * wa)
      nudge(game, b, nx * push * wb, ny * push * wb)
    }
  }
}

const moving = (u) => !!u.path || u.order.t === 'move'

function nudge(game, u, dx, dy) {
  const x = u.x + dx
  const y = u.y + dy
  if (u.air || free(game, x, y)) {
    u.x = x
    u.y = y
  }
}

// ── 일꾼 ──

function gather(game, u, dt) {
  const o = u.order
  let res = ent(game, o.id)
  const valid = (r) => r && ((r.cat === 'res' && r.type === 'mineral') || (r.cat === 'building' && r.type === 'refinery' && r.done && r.team === u.team && r.amount > 0))
  if (o.phase === 'return') {
    const depot = nearestDepot(game, u.team, u.x, u.y)
    if (!depot) return setOrder(u, { t: 'idle' })
    if (gap(u, depot) <= REACH) {
      if (u.carry) {
        const t = game.teams[u.team]
        t[u.carry.kind] += u.carry.amt
        t.stats.gathered += u.carry.amt
        u.carry = null
      }
      if (!valid(res)) res = nearestMineral(game, u.x, u.y, u.id)
      if (!res) return setOrder(u, { t: 'idle' })
      o.id = res.id
      o.phase = 'go'
      u.path = null
    } else moveTo(game, u, ...edgePoint(depot, u.x, u.y), dt)
    return
  }

  if (!valid(res)) {
    releaseMine(u)
    const alt = res?.cat === 'building' ? null : nearestMineral(game, u.x, u.y, u.id, 10 * TILE)
    if (!alt) return setOrder(u, { t: 'idle' })
    o.id = alt.id
    o.phase = 'go'
    u.path = null
    return
  }
  u.lastRes = res.id
  if (o.phase === 'go') {
    if (gap(u, res) <= REACH) {
      const other = res.busy && res.busy !== u.id && ent(game, res.busy)
      if (other && other.order.t === 'gather' && other.order.id === res.id && other.order.phase === 'mine') {
        // 다른 일꾼이 캐는 중이면 근처의 빈 더미로
        if (res.cat === 'res') {
          const alt = game.list.find((e) => e.cat === 'res' && e.type === 'mineral' && !e.dead && !e.busy && Math.hypot(e.x - res.x, e.y - res.y) < 4 * TILE)
          if (alt) {
            o.id = alt.id
            u.path = null
          }
        }
        return
      }
      res.busy = u.id
      u._mining = res
      o.phase = 'mine'
      u.mineT = res.cat === 'res' ? MINE_TIME.paper : MINE_TIME.ink
      u.path = null
    } else {
      const depot = nearestDepot(game, u.team, res.x, res.y)
      moveTo(game, u, ...edgePoint(res, depot ? depot.x : u.x, depot ? depot.y : u.y, 10), dt)
    }
    return
  }
  if (o.phase === 'mine') {
    u.mineT -= dt
    u.facing = Math.atan2(res.y - u.y, res.x - u.x)
    if (u.mineT > 0) return
    const kind = res.cat === 'res' ? 'paper' : 'ink'
    const amt = Math.min(res.amount, Math.round(MINE_AMOUNT[kind] * game.teams[u.team].income))
    res.amount -= amt
    u.carry = { kind, amt }
    releaseMine(u)
    if (res.cat === 'res' && res.amount <= 0) destroy(game, res, null, true)
    o.phase = 'return'
    u.path = null
  }
}

function buildStep(game, u, dt) {
  const o = u.order
  const d = BUILDINGS[o.type]
  const fake = { cat: 'building', tx: o.tx, ty: o.ty, w: d.w, h: d.h }
  if (gap(u, fake) <= REACH) {
    if (missingReq(game, u.team, d.req) || !canPlace(game, u.team, o.type, o.tx, o.ty)) {
      message(game, `${buildingName(o.type, u.team)}을(를) 지을 수 없습니다`, u.team)
      return setOrder(u, { t: 'idle' })
    }
    o.settled = true
    const b = addBuilding(game, u.team, o.type, o.tx, o.ty, false)
    b.builder = u.id
    setOrder(u, { t: 'construct', id: b.id })
  } else moveTo(game, u, (o.tx + d.w / 2) * TILE, (o.ty + d.h / 2) * TILE, dt)
}

function constructStep(game, u, dt) {
  const b = ent(game, u.order.id)
  if (!b) return setOrder(u, { t: 'idle' })
  if (b.done) {
    if (b.type === 'refinery') {
      // 지은 일꾼 + 근처에서 종이 캐던 일꾼 2명이 바로 잉크를 캡니다
      const helpers = game.list
        .filter((w) => w !== u && w.team === u.team && w.cat === 'unit' && !w.dead && UNITS[w.type].worker && w.order.t === 'gather' && game.ents.get(w.order.id)?.cat === 'res')
        .sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))
        .slice(0, INK_WORKERS - 1)
      return orderGather(game, [u, ...helpers], b)
    }
    if (u.team === 0) return setOrder(u, { t: 'idle' })
    return orderGather(game, [u], nearestMineral(game, u.x, u.y, u.id))
  }
  const other = b.builder && b.builder !== u.id && ent(game, b.builder)
  if (other && other.order.t === 'construct' && other.order.id === b.id) return setOrder(u, { t: 'idle' })
  b.builder = u.id
  if (gap(u, b) > REACH) return void moveTo(game, u, ...edgePoint(b, u.x, u.y), dt)
  u.path = null
  const d = BUILDINGS[b.type]
  b.progress += dt
  b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * 0.9 * dt) / d.time)
  u.facing = Math.atan2(b.y - u.y, b.x - u.x)
  if (b.progress >= d.time) {
    b.done = true
    if (b.team === 0) message(game, `${buildingName(b.type, 0)} 완성`)
  }
}

// ── 건물 ──

function updateBuilding(game, b, dt) {
  if (!b.done) return
  b.cd = Math.max(0, b.cd - dt)
  const atk = attackOf(game, b)
  if (atk) {
    const tgt = acquire(game, b, atk, dt, atk.range)
    if (tgt && gap(b, tgt) <= (tgt.air ? atk.airRange : atk.range)) {
      if (b.cd <= 0) fire(game, b, tgt, atk)
    } else b.target = null
  }
  const q = b.queue[0]
  if (!q) return
  q.t += dt
  if (q.t < q.total) return
  b.queue.shift()
  const t = game.teams[b.team]
  if (q.kind === 'upg') {
    t.ups[q.key] = q.lv
    delete t.researching[q.key]
    t.statCache = {}
    const u = UPGRADES[q.key]
    message(game, `연구 완료: ${u.name}${u.levels > 1 ? ` ${q.lv}단계` : ''}`, b.team)
    return
  }
  const d = UNITS[q.key]
  const p = d.air ? [b.x, b.y] : spawnPoint(game, b, b.rally, d.r)
  const u = addUnit(game, b.team, q.key, p[0], p[1])
  t.stats.made++
  const rally = b.rally && (b.rally.id ? ent(game, b.rally.id) : b.rally)
  if (d.worker && (!b.rally || rally?.cat === 'res')) orderGather(game, [u], rally?.cat === 'res' ? rally : nearestMineral(game, b.x, b.y, u.id))
  else if (rally) setOrder(u, { t: 'move', x: rally.x, y: rally.y })
  u.guard = rally ? { x: rally.x, y: rally.y } : { x: u.x, y: u.y }
}

/** 건물 둘레에서 집결지에 가장 가까운 빈 칸 */
function spawnPoint(game, b, rally, r) {
  const toward = rally ?? { x: b.x + (b.team === 0 ? 40 : -40), y: b.y + (b.team === 0 ? -40 : 40) }
  let best = null
  let bd = Infinity
  for (let j = b.ty - 1; j <= b.ty + b.h; j++) for (let i = b.tx - 1; i <= b.tx + b.w; i++) {
    if (!inMap(i, j) || game.blocked[j * MAP_W + i]) continue
    const x = i * TILE + TILE / 2
    const y = j * TILE + TILE / 2
    const crowd = game.list.filter((u) => u.cat === 'unit' && !u.air && Math.hypot(u.x - x, u.y - y) < u.r + r).length
    const d = Math.hypot(toward.x - x, toward.y - y) + crowd * 30
    if (d < bd) {
      bd = d
      best = [x, y]
    }
  }
  if (best) return best
  const p = nearestFree(game.blocked, b.tx, b.ty + b.h)
  return p ? [p[0] * TILE + 16, p[1] * TILE + 16] : [b.x, b.y]
}

// ───────── 선택·조회 (UI 용) ─────────

/** 화면 좌표 클릭에 맞은 엔티티 (공중 유닛 > 지상 유닛 > 건물 > 자원) */
export function entityAt(game, x, y) {
  let best = null
  let bd = Infinity
  for (const e of game.list) {
    if (e.dead || e.cat !== 'unit' || !visibleToPlayer(game, e)) continue
    const dist = Math.hypot(e.x - x, e.y - y)
    if (dist > e.r + 4) continue
    const d = dist - (e.air ? 1000 : 0)
    if (d < bd) {
      bd = d
      best = e
    }
  }
  if (best) return best
  const k = toTile(y) * MAP_W + toTile(x)
  if (!inMap(toTile(x), toTile(y)) || !game.explored[k]) return null
  const id = game.occ[k]
  return id ? ent(game, id) : null
}

export function unitsInRect(game, x0, y0, x1, y1) {
  const [ax, bx] = x0 < x1 ? [x0, x1] : [x1, x0]
  const [ay, by] = y0 < y1 ? [y0, y1] : [y1, y0]
  return game.list.filter((e) => e.cat === 'unit' && e.team === 0 && !e.dead && e.x + e.r >= ax && e.x - e.r <= bx && e.y + e.r >= ay && e.y - e.r <= by)
}

export const entName = (e) => (e.cat === 'unit' ? unitName(e.type, e.team) : e.cat === 'building' ? buildingName(e.type, e.team) : e.type === 'mineral' ? '종이 더미' : '잉크 샘')
