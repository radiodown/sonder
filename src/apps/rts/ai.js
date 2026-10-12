import { BUILDINGS, MAP_H, MAP_W, TILE, UNITS, UPGRADES } from './data'
import { canPlace, ent, message, missingReq, nearestMineral, nextLevel, orderBuild, orderGather, orderMove, research, train } from './engine'
import { AI_SLOTS, RAMP_INSIDE, teamRect } from './map'

/**
 * 벌레 AI. 플레이어와 같은 규칙으로 자원을 캐고, 정해진 순서로 건물을 올리고, 업그레이드를 하고,
 * 정해진 시각마다 모은 군대를 모두 보내 습격합니다. 그 사이 본진에 들어온 적은 막습니다.
 */

/** 짓는 순서 (인구수 건물은 따로 알아서 짓습니다). 부서지면 다시 짓습니다 */
const PLAN = ['barracks', 'refinery', 'lab', 'factory', 'barracks', 'armory', 'turret', 'starport', 'hq', 'refinery', 'turret', 'factory', 'starport', 'barracks', 'turret']

const RESEARCH = ['infWeapon', 'stim', 'infArmor', 'range', 'siege', 'vehWeapon', 'plating', 'engine', 'shipWeapon']
const RESEARCH_AT = Object.fromEntries(Object.entries(BUILDINGS).flatMap(([b, d]) => (d.research ?? []).map((k) => [k, b])))

/** 건물마다 만들 유닛 비율 */
const MIX = {
  barracks: [['ranged', 3], ['melee', 2]],
  factory: [['tank', 2], ['walker', 1]],
  starport: [['fighter', 2], ['bomber', 1]],
}

const rallyPoint = (TEAM) => {
  const [tx, ty] = teamRect(TEAM, ...RAMP_INSIDE, 1, 1)
  return { x: tx * TILE + 16, y: ty * TILE + 16 }
}

export function aiState(game, TEAM = 1) {
  game.ais ??= {}
  return (game.ais[TEAM] ??= { think: 0, nextWave: game.diff.firstWave, wave: 0 })
}

/** TEAM 팀을 AI 로 움직입니다 (게임에서는 1. 0 은 시험용) */
export function aiThink(game, dt, TEAM = 1) {
  const ai = aiState(game, TEAM)
  const foe = 1 - TEAM
  ai.think -= dt
  if (ai.think > 0) return
  ai.think = 0.5

  const team = game.teams[TEAM]
  const mine = game.list.filter((e) => e.team === TEAM && !e.dead)
  const units = mine.filter((e) => e.cat === 'unit')
  const buildings = mine.filter((e) => e.cat === 'building')
  const workers = units.filter((u) => UNITS[u.type].worker)
  const army = units.filter((u) => !UNITS[u.type].worker)
  const hqs = buildings.filter((b) => b.type === 'hq' && b.done)
  const hq = hqs[0]
  const reserve = [0, 0]
  const canPay = ([p, i]) => team.paper - reserve[0] >= p && team.ink - reserve[1] >= i

  // ── 일꾼 ──
  for (const w of workers) {
    if (w.order.t !== 'idle' || !hq) continue
    // 일꾼이 적은 본부 쪽으로
    const base = hqs.reduce((a, b) => (nearWorkers(b) < nearWorkers(a) ? b : a))
    orderGather(game, [w], nearestMineral(game, base.x, base.y, w.id, 12 * TILE) ?? nearestMineral(game, w.x, w.y, w.id, 64 * TILE))
  }
  function nearWorkers(b) {
    return workers.filter((w) => Math.hypot(w.x - b.x, w.y - b.y) < 10 * TILE).length
  }
  for (const r of buildings) {
    if (r.type !== 'refinery' || !r.done || r.amount <= 0) continue
    const onGas = workers.filter((w) => w.order.t === 'gather' && w.order.id === r.id).length
    if (onGas < 3) {
      const w = workers.find((x) => x.order.t === 'gather' && !x.carry && ent(game, x.order.id)?.cat === 'res')
      if (w) orderGather(game, [w], r)
    }
  }
  const maxWorkers = game.diff.maxWorkers + (hqs.length - 1) * 8
  for (const h of hqs) if (h.queue.length === 0 && workers.length < maxWorkers) train(game, h, 'worker')

  // ── 건물 ──
  const count = (type) => buildings.filter((b) => b.type === type).length + workers.filter((w) => w.order.t === 'build' && w.order.type === type).length
  const tryBuild = (type) => {
    const d = BUILDINGS[type]
    if (missingReq(game, TEAM, d.req)) return
    // 확장은 자원이 넉넉할 때만
    if (type === 'hq' && hq && team.paper < d.cost[0] + 150) {
      reserve[0] += d.cost[0]
      return
    }
    if (!canPay(d.cost)) {
      reserve[0] += d.cost[0]
      reserve[1] += d.cost[1]
      return
    }
    const spot = findSpot(game, TEAM, type, hq ?? buildings[0], hqs)
    if (!spot) return 'nospot'
    const site = { x: (spot[0] + d.w / 2) * TILE, y: (spot[1] + d.h / 2) * TILE }
    const pool = workers.filter((w) => w.order.t === 'gather' && !w.carry && ent(game, w.order.id)?.cat === 'res')
    const builder = (pool.length ? pool : workers.filter((w) => w.order.t !== 'build' && w.order.t !== 'construct'))
      .sort((a, b) => Math.hypot(a.x - site.x, a.y - site.y) - Math.hypot(b.x - site.x, b.y - site.y))[0]
    if (builder) orderBuild(game, builder, type, ...spot)
  }

  if (!hq && workers.length && count('hq') === 0) tryBuild('hq')
  const pendingSupply = buildings.some((b) => b.type === 'supply' && !b.done) || workers.some((w) => w.order.t === 'build' && w.order.type === 'supply')
  const producers = buildings.filter((b) => b.done && BUILDINGS[b.type].trains).length
  if (team.supplyCap < 200 && team.supplyCap - team.supplyUsed < 3 + producers * 2 && !pendingSupply) tryBuild('supply')

  // 처음 본부 1개는 이미 있으니 계획의 'hq' 는 두 번째(확장)
  const want = { hq: 1 }
  for (const type of PLAN) {
    want[type] = (want[type] ?? 0) + 1
    if (count(type) < want[type] && tryBuild(type) !== 'nospot') break
  }

  // ── 연구 ──
  for (const key of RESEARCH) {
    const lv = nextLevel(game, TEAM, key)
    if (!lv || (UPGRADES[key].levels > 1 && lv > game.diff.upgradeLimit)) continue
    const at = buildings.find((b) => b.type === RESEARCH_AT[key] && b.done && b.queue.length === 0)
    if (!at) continue
    if (canPay(UPGRADES[key].cost(lv))) research(game, at, key)
    break
  }

  // ── 유닛 ──
  for (const b of buildings) {
    const mix = MIX[b.type]
    // 종이가 남아돌면 대기열을 하나 더 채웁니다
    if (!mix || !b.done || b.queue.length > (team.paper > 500 ? 1 : 0)) continue
    const ok = mix.filter(([type]) => !missingReq(game, TEAM, UNITS[type].req))
    let roll = Math.random() * ok.reduce((s, [, w]) => s + w, 0)
    const pick = ok.find(([, w]) => (roll -= w) < 0)?.[0] ?? ok[0][0]
    // 고른 유닛을 못 사면 (주로 잉크 부족) 살 수 있는 다른 유닛으로
    const buy = [pick, ...ok.map(([t]) => t)].find((t) => canPay(UNITS[t].cost))
    if (buy) train(game, b, buy)
  }

  // ── 군대 ──
  const players = game.list.filter((e) => e.team === foe && !e.dead)
  const nearest = (list, x, y) => list.reduce((best, e) => (!best || Math.hypot(e.x - x, e.y - y) < Math.hypot(best.x - x, best.y - y) ? e : best), null)
  const home = army.filter((u) => !u.wave)

  // 본진 방어: 우리 건물 근처에 들어온 적
  const intruder = players.find((p) => p.cat === 'unit' && buildings.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 9 * TILE))
  if (intruder) {
    const idle = home.filter((u) => u.order.t !== 'amove' && u.order.t !== 'attack')
    if (idle.length) orderMove(game, idle, intruder.x, intruder.y, true)
  } else {
    const rally = rallyPoint(TEAM)
    const loose = home.filter((u) => u.order.t === 'idle' && Math.hypot(u.x - rally.x, u.y - rally.y) > 5 * TILE)
    if (loose.length) orderMove(game, loose, rally.x, rally.y, true)
  }

  // 습격
  if (game.time >= ai.nextWave) {
    ai.wave++
    ai.nextWave += game.diff.interval
    const rally = rallyPoint(TEAM)
    const goal = nearest(players.filter((e) => e.cat === 'building'), rally.x, rally.y)
    if (home.length && goal) {
      for (const u of home) u.wave = true
      orderMove(game, home, goal.x, goal.y, true)
      message(game, `벌레의 ${ai.wave}번째 습격! (${home.length}마리)`)
    } else message(game, `벌레가 ${ai.wave}번째 습격을 준비하지 못했습니다`)
  }
  // 습격대가 목표를 부쉈으면 다음 건물로
  for (const u of army) {
    if (!u.wave || u.order.t !== 'idle') continue
    const goal = nearest(players.filter((e) => e.cat === 'building'), u.x, u.y)
    if (goal) orderMove(game, [u], goal.x, goal.y, true)
  }
}

/** 지을 자리: 정해 둔 자리 → 없으면 본부 둘레에서 둘레 한 칸이 비는 곳. 정제소는 우리 본부 근처 잉크 샘 */
function findSpot(game, TEAM, type, near, hqs) {
  const d = BUILDINGS[type]
  if (d.onGeyser) {
    const gz = game.list.find((e) => e.cat === 'res' && e.type === 'geyser' && !e.refinery && hqs.some((h) => Math.hypot(e.x - h.x, e.y - h.y) < 8 * TILE))
    return gz ? [gz.tx, gz.ty] : null
  }
  for (const [x, y] of AI_SLOTS[type] ?? []) {
    const [tx, ty] = teamRect(TEAM, x, y, d.w, d.h)
    if (canPlace(game, TEAM, type, tx, ty)) return [tx, ty]
  }
  if (!near) return null
  const cx = Math.floor(near.x / TILE)
  const cy = Math.floor(near.y / TILE)
  for (let r = 4; r < 16; r++) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue
      const tx = cx + i
      const ty = cy + j
      if (padClear(game, tx - 1, ty - 1, d.w + 2, d.h + 2) && canPlace(game, TEAM, type, tx, ty)) return [tx, ty]
    }
  }
  return null
}

function padClear(game, x, y, w, h) {
  if (x < 0 || y < 0 || x + w > MAP_W || y + h > MAP_H) return false
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (game.blocked[j * MAP_W + i]) return false
  return true
}
