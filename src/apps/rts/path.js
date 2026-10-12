import { MAP_H, MAP_W, TILE } from './data'

/**
 * 타일 길찾기 (A*, 8방향, 모서리 가로지르기 금지) + 직선으로 갈 수 있는 지점은 건너뛰기.
 * blocked: 0 이면 지나갈 수 있는 타일 (지형·건물·자원 모두 반영된 격자)
 */

const N = MAP_W * MAP_H
const g = new Float32Array(N)
const f = new Float32Array(N)
const from = new Int32Array(N)
const stamp = new Uint32Array(N) // 이번 탐색에서 본 노드인지
const closed = new Uint32Array(N)
let gen = 0

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
]

export const inMap = (tx, ty) => tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H
export const toTile = (px) => Math.floor(px / TILE)

/** 막히지 않은 가장 가까운 타일 (나선형으로 찾음) */
export function nearestFree(blocked, tx, ty, maxR = 12) {
  if (inMap(tx, ty) && !blocked[ty * MAP_W + tx]) return [tx, ty]
  for (let r = 1; r <= maxR; r++) {
    let best = null
    let bd = Infinity
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue
      const x = tx + i
      const y = ty + j
      if (!inMap(x, y) || blocked[y * MAP_W + x]) continue
      const d = i * i + j * j
      if (d < bd) {
        bd = d
        best = [x, y]
      }
    }
    if (best) return best
  }
  return null
}

/** 작은 이진 힙 (f 값 기준) */
class Heap {
  constructor() {
    this.a = []
  }
  push(n) {
    const a = this.a
    a.push(n)
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (f[a[p]] <= f[n]) break
      a[i] = a[p]
      i = p
    }
    a[i] = n
  }
  pop() {
    const a = this.a
    const top = a[0]
    const last = a.pop()
    if (a.length) {
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        if (l >= a.length) break
        const r = l + 1
        const c = r < a.length && f[a[r]] < f[a[l]] ? r : l
        if (f[a[c]] >= f[last]) break
        a[i] = a[c]
        i = c
      }
      a[i] = last
    }
    return top
  }
  get size() {
    return this.a.length
  }
}

/** px 선분이 막힌 타일을 지나지 않는지 (몸 반지름 r 만큼 양옆도 확인) */
export function lineClear(blocked, x0, y0, x1, y1, r = 6) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  if (len < 1) return true
  const nx = (-dy / len) * r
  const ny = (dx / len) * r
  const steps = Math.ceil(len / 8)
  for (let s = 0; s <= steps; s++) {
    const t = s / steps
    const x = x0 + dx * t
    const y = y0 + dy * t
    for (const k of [0, 1, -1]) {
      const tx = toTile(x + nx * k)
      const ty = toTile(y + ny * k)
      if (!inMap(tx, ty) || blocked[ty * MAP_W + tx]) return false
    }
  }
  return true
}

/**
 * px 좌표 (sx,sy) → (gx,gy) 의 경유점 목록 (px). 목표가 막혀 있으면 가장 가까운 빈 타일로,
 * 길이 없으면 목표에 가장 가까이 갈 수 있는 곳까지.
 */
export function findPath(blocked, sx, sy, gx, gy, r = 6) {
  if (lineClear(blocked, sx, sy, gx, gy, r)) return [[gx, gy]]
  const s = nearestFree(blocked, toTile(sx), toTile(sy), 3)
  const goal = nearestFree(blocked, toTile(gx), toTile(gy))
  if (!s || !goal) return [[gx, gy]]
  const goalFree = goal[0] === toTile(gx) && goal[1] === toTile(gy)
  const si = s[1] * MAP_W + s[0]
  const gi = goal[1] * MAP_W + goal[0]

  gen++
  const h = (i) => {
    const dx = Math.abs((i % MAP_W) - goal[0])
    const dy = Math.abs(((i / MAP_W) | 0) - goal[1])
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)
  }
  const open = new Heap()
  stamp[si] = gen
  g[si] = 0
  f[si] = h(si)
  from[si] = -1
  open.push(si)
  let best = si
  let bestH = f[si]
  let found = false
  while (open.size) {
    const cur = open.pop()
    if (closed[cur] === gen) continue
    closed[cur] = gen
    if (cur === gi) {
      found = true
      break
    }
    const ch = f[cur] - g[cur]
    if (ch < bestH) {
      bestH = ch
      best = cur
    }
    const cx = cur % MAP_W
    const cy = (cur / MAP_W) | 0
    for (const [dx, dy, cost] of DIRS) {
      const x = cx + dx
      const y = cy + dy
      if (!inMap(x, y)) continue
      const ni = y * MAP_W + x
      if (blocked[ni] || closed[ni] === gen) continue
      if (dx && dy && (blocked[cy * MAP_W + x] || blocked[y * MAP_W + cx])) continue
      const ng = g[cur] + cost
      if (stamp[ni] === gen && ng >= g[ni]) continue
      stamp[ni] = gen
      g[ni] = ng
      f[ni] = ng + h(ni)
      from[ni] = cur
      open.push(ni)
    }
  }

  const end = found ? gi : best
  const tiles = []
  for (let i = end; i !== -1; i = from[i]) tiles.push(i)
  tiles.reverse()
  const pts = tiles.map((i) => [(i % MAP_W) * TILE + TILE / 2, ((i / MAP_W) | 0) * TILE + TILE / 2])
  if (found && goalFree) pts[pts.length - 1] = [gx, gy]

  // 직선으로 닿는 경유점은 건너뜁니다
  const out = []
  let ax = sx
  let ay = sy
  let i = 0
  while (i < pts.length) {
    let j = pts.length - 1
    while (j > i && !lineClear(blocked, ax, ay, pts[j][0], pts[j][1], r)) j--
    out.push(pts[j])
    ;[ax, ay] = pts[j]
    i = j + 1
  }
  return out
}
