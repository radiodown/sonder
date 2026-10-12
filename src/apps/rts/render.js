import { BUILDINGS, MAP_H, MAP_W, TEAMS, TILE } from './data'
import { canPlace, ent, visibleToPlayer } from './engine'
import { BUILDING_RISE, drawBuildingSprite, drawUnitSprite } from './sprites'

/**
 * 캔버스 그리기. 지형은 처음 한 번 큰 캔버스에 그려 두고 매 프레임 잘라 씁니다.
 * 화면 좌표 = 월드 좌표 - cam.
 */

const WORLD_W = MAP_W * TILE
const WORLD_H = MAP_H * TILE
const SPINES = ['#b8473b', '#3f6fa8', '#4f8a4b', '#c99a3c', '#7c4f8f', '#2f7c7a', '#d07a3a', '#8a8f45']

// 같은 타일은 늘 같은 모양이 나오게 하는 작은 해시
const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

export function makeTerrain(game) {
  const c = document.createElement('canvas')
  c.width = WORLD_W
  c.height = WORLD_H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#e8dcc2'
  ctx.fillRect(0, 0, WORLD_W, WORLD_H)
  // 바닥: 마루 판자 느낌의 옅은 줄과 얼룩
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const h = hash(x, y)
    ctx.fillStyle = `rgba(120, 90, 50, ${0.03 + h * 0.05})`
    ctx.fillRect(x * TILE, y * TILE, TILE, TILE)
    if (h > 0.85) {
      ctx.fillStyle = 'rgba(90, 60, 30, 0.08)'
      ctx.beginPath()
      ctx.arc(x * TILE + h * 28, y * TILE + (1 - h) * 28, 2 + h * 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.strokeStyle = 'rgba(110, 80, 40, 0.07)'
  ctx.lineWidth = 1
  for (let y = 0; y <= MAP_H; y++) {
    ctx.beginPath()
    ctx.moveTo(0, y * TILE + 0.5)
    ctx.lineTo(WORLD_W, y * TILE + 0.5)
    ctx.stroke()
  }
  // 장애물: 책이 꽂힌 서가
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (!game.terrain[y * MAP_W + x]) continue
    const px = x * TILE
    const py = y * TILE
    ctx.fillStyle = '#5a3d26'
    ctx.fillRect(px, py, TILE, TILE)
    ctx.fillStyle = '#3e2919'
    ctx.fillRect(px, py + TILE - 4, TILE, 4)
    let bx = px + 2
    let i = 0
    while (bx < px + TILE - 3) {
      const h = hash(x * 7 + i, y * 13 + i)
      const w = 3 + Math.floor(h * 4)
      const bh = 18 + Math.floor(h * 8)
      ctx.fillStyle = SPINES[Math.floor(h * SPINES.length)]
      ctx.fillRect(bx, py + TILE - 4 - bh, Math.min(w, px + TILE - 2 - bx), bh)
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect(bx, py + TILE - 4 - bh + 3, Math.min(w, px + TILE - 2 - bx), 1.5)
      bx += w + 1
      i++
    }
  }
  // 장애물 덩어리 가장자리에 그림자
  ctx.fillStyle = 'rgba(40, 25, 10, 0.18)'
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (game.terrain[y * MAP_W + x] && y + 1 < MAP_H && !game.terrain[(y + 1) * MAP_W + x]) ctx.fillRect(x * TILE, (y + 1) * TILE, TILE, 6)
  }
  return c
}

/** 안개: 타일 하나 = 픽셀 하나인 작은 캔버스를 부드럽게 늘려 씁니다 */
export function makeFog() {
  const c = document.createElement('canvas')
  c.width = MAP_W
  c.height = MAP_H
  return { canvas: c, ctx: c.getContext('2d'), img: c.getContext('2d').createImageData(MAP_W, MAP_H) }
}

function updateFog(game, fog) {
  const d = fog.img.data
  for (let k = 0; k < MAP_W * MAP_H; k++) {
    d[k * 4] = 12
    d[k * 4 + 1] = 10
    d[k * 4 + 2] = 8
    d[k * 4 + 3] = game.vis[k] ? 0 : game.explored[k] ? 130 : 255
  }
  fog.ctx.putImageData(fog.img, 0, 0)
}

/**
 * 한 프레임 그리기.
 * ui: { sel: Set, hover, ghost: {type, tx, ty} | null, box: {x0,y0,x1,y1} | null, marker: {x, y, t, color} | null }
 */
export function draw(ctx, game, assets, cam, view, ui) {
  const { w, h } = view
  ctx.fillStyle = '#17120e'
  ctx.fillRect(0, 0, w, h)
  ctx.save()
  ctx.translate(-cam.x, -cam.y)

  // 보이는 범위만
  const sx = Math.max(0, cam.x)
  const sy = Math.max(0, cam.y)
  const sw = Math.min(WORLD_W, cam.x + w) - sx
  const sh = Math.min(WORLD_H, cam.y + h) - sy
  if (sw > 0 && sh > 0) ctx.drawImage(assets.terrain, sx, sy, sw, sh, sx, sy, sw, sh)

  const onScreen = (e, m = 64) => e.x > cam.x - m && e.x < cam.x + w + m && e.y > cam.y - m && e.y < cam.y + h + m
  const seen = (e) => visibleToPlayer(game, e)

  // 자원
  for (const e of game.list) {
    if (e.cat !== 'res' || !onScreen(e) || !seen(e)) continue
    if (e.type === 'mineral') drawPaper(ctx, e)
    else if (!e.refinery) drawInk(ctx, e)
    if (ui.sel.has(e.id)) selRing(ctx, e, '#f5d76e')
  }

  // 선택 고리는 몸보다 먼저 (밑에 깔리게)
  for (const id of ui.sel) {
    const e = ent(game, id)
    if (e && e.cat !== 'res' && seen(e)) selRing(ctx, e, e.team === 0 ? '#3ddc84' : '#ff5a4f')
  }

  // 건물과 지상 유닛: 아래쪽에 있는 것을 나중에 (앞에 오게)
  const ground = []
  for (const e of game.list) {
    if (e.cat === 'res' || e.air || !onScreen(e, 140) || !seen(e)) continue
    ground.push(e)
  }
  const depth = (e) => (e.cat === 'building' ? (e.ty + e.h) * TILE - 6 : e.y)
  ground.sort((a, b) => depth(a) - depth(b))
  for (const e of ground) {
    if (e.cat === 'building') drawBuildingSprite(ctx, e, game)
    else {
      drawUnitSprite(ctx, e, game.time)
      drawCarry(ctx, e)
    }
  }

  // 집결지
  for (const id of ui.sel) {
    const b = ent(game, id)
    if (!b || b.cat !== 'building' || b.team !== 0 || !b.rally) continue
    const r = b.rally.id ? ent(game, b.rally.id) ?? b.rally : b.rally
    ctx.setLineDash([5, 5])
    ctx.strokeStyle = 'rgba(61, 220, 132, 0.8)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(b.x, b.y)
    ctx.lineTo(r.x, r.y)
    ctx.stroke()
    ctx.setLineDash([])
    flag(ctx, r.x, r.y)
  }

  // 공중 유닛
  for (const e of game.list) {
    if (e.cat !== 'unit' || !e.air || !onScreen(e) || !seen(e)) continue
    drawUnitSprite(ctx, e, game.time)
  }

  // 건물 이름 (가리키거나 골랐을 때)
  for (const e of game.list) {
    if (e.cat === 'building' && (ui.sel.has(e.id) || ui.hover === e.id) && seen(e)) label(ctx, e)
  }

  // 체력 막대 (선택됐거나 다쳤을 때)
  for (const e of game.list) {
    if (e.cat === 'res' || !onScreen(e, 120) || !seen(e)) continue
    const picked = ui.sel.has(e.id) || ui.hover === e.id
    if (!picked && e.hp >= e.maxHp && (e.cat !== 'building' || e.done)) continue
    hpBar(ctx, e)
  }

  drawEffects(ctx, game)

  // 안개
  updateFog(game, assets.fog)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(assets.fog.canvas, -TILE / 2, -TILE / 2, WORLD_W + TILE, WORLD_H + TILE)
  // 경계 바깥
  ctx.fillStyle = '#17120e'
  ctx.fillRect(-2000, -2000, WORLD_W + 4000, 2000)
  ctx.fillRect(-2000, WORLD_H, WORLD_W + 4000, 2000)
  ctx.fillRect(-2000, 0, 2000, WORLD_H)
  ctx.fillRect(WORLD_W, 0, 2000, WORLD_H)

  // 건설 자리 미리보기
  if (ui.ghost) {
    const { type, tx, ty } = ui.ghost
    const d = BUILDINGS[type]
    const ok = canPlace(game, 0, type, tx, ty)
    for (let j = ty; j < ty + d.h; j++) for (let i = tx; i < tx + d.w; i++) {
      const bad = i < 0 || j < 0 || i >= MAP_W || j >= MAP_H || (!d.onGeyser && (game.blocked[j * MAP_W + i] || !game.explored[j * MAP_W + i]))
      ctx.fillStyle = bad || !ok ? 'rgba(255, 70, 60, 0.4)' : 'rgba(61, 220, 132, 0.35)'
      ctx.fillRect(i * TILE + 1, j * TILE + 1, TILE - 2, TILE - 2)
    }
    ctx.strokeStyle = ok ? '#3ddc84' : '#ff5a4f'
    ctx.lineWidth = 2
    ctx.strokeRect(tx * TILE, ty * TILE, d.w * TILE, d.h * TILE)
    if (BUILDINGS[type].attack) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.setLineDash([4, 6])
      ctx.beginPath()
      ctx.arc((tx + d.w / 2) * TILE, (ty + d.h / 2) * TILE, BUILDINGS[type].attack.range + 16, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // 명령을 내린 자리
  if (ui.marker) {
    const a = (performance.now() - ui.marker.t) / 450
    if (a < 1) {
      ctx.globalAlpha = 1 - a
      ctx.strokeStyle = ui.marker.color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(ui.marker.x, ui.marker.y, 4 + 12 * (1 - a), (4 + 12 * (1 - a)) * 0.6, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }

  // 공격 알림
  for (const p of game.pings) {
    const t = (game.time - p.t) % 1
    ctx.strokeStyle = `rgba(255, 80, 60, ${1 - t})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(p.x, p.y, 10 + t * 40, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()

  // 드래그 상자 (화면 좌표)
  if (ui.box) {
    const { x0, y0, x1, y1 } = ui.box
    ctx.fillStyle = 'rgba(61, 220, 132, 0.12)'
    ctx.strokeStyle = '#3ddc84'
    ctx.lineWidth = 1
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0))
    ctx.strokeRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1) + 0.5, Math.abs(x1 - x0), Math.abs(y1 - y0))
  }
}

function selRing(ctx, e, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.beginPath()
  if (e.cat === 'unit') ctx.ellipse(e.x, e.y + (e.air ? 14 : e.r * 0.35), e.r + 4, (e.r + 4) * 0.6, 0, 0, Math.PI * 2)
  else ctx.roundRect(e.tx * TILE - 2, e.ty * TILE - 2, e.w * TILE + 4, e.h * TILE + 4, 8)
  ctx.stroke()
}

function flag(ctx, x, y) {
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y - 16)
  ctx.stroke()
  ctx.fillStyle = '#3ddc84'
  ctx.beginPath()
  ctx.moveTo(x, y - 16)
  ctx.lineTo(x + 10, y - 12)
  ctx.lineTo(x, y - 8)
  ctx.fill()
}

function hpBar(ctx, e) {
  const wide = e.cat === 'building' ? e.w * TILE - 12 : Math.max(18, e.r * 2 + 4)
  const x = e.x - wide / 2
  const y = e.cat === 'building' ? e.ty * TILE - BUILDING_RISE[e.type] - 8 : e.y - e.r - (e.air ? 24 : 9)
  const p = Math.max(0, e.hp / e.maxHp)
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(x - 1, y - 1, wide + 2, 5)
  ctx.fillStyle = p > 0.6 ? '#3ddc84' : p > 0.3 ? '#f5c542' : '#ff5a4f'
  ctx.fillRect(x, y, wide * p, 3)
  if (e.cat === 'building' && !e.done) {
    const prog = e.progress / BUILDINGS[e.type].time
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(x - 1, y + 5, wide + 2, 5)
    ctx.fillStyle = '#7fc8ff'
    ctx.fillRect(x, y + 6, wide * prog, 3)
  }
}

function drawPaper(ctx, e) {
  const x0 = e.tx * TILE
  const y0 = e.ty * TILE
  const left = e.amount / e.maxAmount
  const stacks = Math.max(1, Math.ceil(left * 3))
  for (let s = 0; s < 3; s++) {
    if (s >= stacks) break
    const px = x0 + 6 + s * 18
    const height = 8 + left * 10
    for (let k = 0; k < height; k += 2.5) {
      ctx.fillStyle = k % 5 < 2.5 ? '#fbf7ec' : '#efe6d0'
      ctx.fillRect(px + (k % 3) - 1, y0 + 26 - k, 16, 2.5)
    }
    ctx.strokeStyle = 'rgba(90,70,40,0.35)'
    ctx.lineWidth = 1
    ctx.strokeRect(px - 1.5, y0 + 26 - height, 17, height + 2)
  }
}

function drawInk(ctx, e) {
  const g = ctx.createRadialGradient(e.x - 8, e.y - 8, 2, e.x, e.y, 30)
  g.addColorStop(0, '#5a6bb0')
  g.addColorStop(0.4, '#20285a')
  g.addColorStop(1, '#0d1030')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(e.x, e.y, 28, 22, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.ellipse(e.x - 9, e.y - 7, 7, 3.5, -0.5, 0, Math.PI * 2)
  ctx.fill()
}

/** 들고 있는 자원 */
function drawCarry(ctx, u) {
  if (!u.carry) return
  const x = u.x - Math.cos(u.facing) * 4
  const y = u.y - u.r - 5
  if (u.carry.kind === 'paper') {
    ctx.fillStyle = '#fbf7ec'
    ctx.strokeStyle = 'rgba(90,70,40,0.6)'
    ctx.lineWidth = 0.8
    ctx.fillRect(x - 4, y - 2, 8, 5)
    ctx.strokeRect(x - 4, y - 2, 8, 5)
    ctx.beginPath()
    ctx.moveTo(x - 3, y)
    ctx.lineTo(x + 3, y)
    ctx.stroke()
  } else {
    ctx.fillStyle = '#3b4aa0'
    ctx.beginPath()
    ctx.moveTo(x, y - 4)
    ctx.quadraticCurveTo(x + 4, y + 1, x, y + 3)
    ctx.quadraticCurveTo(x - 4, y + 1, x, y - 4)
    ctx.fill()
  }
}

function label(ctx, b) {
  ctx.font = '600 11px Pretendard, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const name = BUILDINGS[b.type].names[b.team]
  const y = b.ty * TILE + b.h * TILE + 14
  const w = ctx.measureText(name).width + 10
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath()
  ctx.roundRect(b.x - w / 2, y - 11, w, 15, 7)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.fillText(name, b.x, y)
}

function drawEffects(ctx, game) {
  for (const fx of game.effects) {
    const p = fx.t / fx.life
    const light = fx.team != null ? TEAMS[fx.team].light : '#fff'
    switch (fx.kind) {
      case 'bolt': {
        const x = fx.x1 + (fx.x2 - fx.x1) * p
        const y = fx.y1 + (fx.y2 - fx.y1) * p
        ctx.strokeStyle = light
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x - (fx.x2 - fx.x1) * 0.12, y - (fx.y2 - fx.y1) * 0.12)
        ctx.lineTo(x, y)
        ctx.stroke()
        break
      }
      case 'hit':
        ctx.fillStyle = `rgba(255, 240, 200, ${1 - p})`
        ctx.beginPath()
        ctx.arc(fx.x2, fx.y2, 3 + p * 4, 0, Math.PI * 2)
        ctx.fill()
        break
      case 'shell':
      case 'bomb': {
        const x = fx.kind === 'bomb' ? fx.x2 : fx.x1 + (fx.x2 - fx.x1) * p
        const y = fx.kind === 'bomb' ? fx.y2 - 30 * (1 - p) : fx.y1 + (fx.y2 - fx.y1) * p - Math.sin(p * Math.PI) * 30
        ctx.fillStyle = '#2b2b2b'
        ctx.beginPath()
        ctx.arc(x, y, 3.5, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'splash':
        ctx.strokeStyle = `rgba(255, 170, 60, ${1 - p})`
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(fx.x1, fx.y1, fx.r * (0.4 + p * 0.6), 0, Math.PI * 2)
        ctx.stroke()
        break
      case 'boom': {
        const g = ctx.createRadialGradient(fx.x1, fx.y1, 0, fx.x1, fx.y1, fx.r * (0.5 + p))
        g.addColorStop(0, `rgba(255, 230, 150, ${1 - p})`)
        g.addColorStop(0.5, `rgba(255, 120, 40, ${0.8 * (1 - p)})`)
        g.addColorStop(1, 'rgba(80, 40, 20, 0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(fx.x1, fx.y1, fx.r * (0.5 + p), 0, Math.PI * 2)
        ctx.fill()
        break
      }
    }
  }
}

/** 미니맵. size px 정사각형 */
export function drawMinimap(ctx, game, assets, cam, view, size) {
  const s = size / (MAP_W * TILE)
  ctx.clearRect(0, 0, size, size)
  ctx.drawImage(assets.terrain, 0, 0, size, size)
  for (const e of game.list) {
    if (!visibleToPlayer(game, e)) continue
    if (e.cat === 'res') {
      ctx.fillStyle = e.type === 'mineral' ? '#fbf7ec' : '#3b4aa0'
      ctx.fillRect(e.tx * TILE * s, e.ty * TILE * s, Math.max(2, e.w * TILE * s), Math.max(2, e.h * TILE * s))
    } else if (e.cat === 'building') {
      ctx.fillStyle = TEAMS[e.team].color
      ctx.fillRect(e.tx * TILE * s, e.ty * TILE * s, e.w * TILE * s, e.h * TILE * s)
    } else {
      ctx.fillStyle = e.team === 0 ? '#7fd0ff' : '#ff7a4a'
      ctx.fillRect(e.x * s - 1.5, e.y * s - 1.5, 3, 3)
    }
  }
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(assets.fog.canvas, 0, 0, size, size)
  for (const p of game.pings) {
    const t = (game.time - p.t) % 1
    ctx.strokeStyle = `rgba(255, 80, 60, ${1 - t})`
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(p.x * s, p.y * s, 3 + t * 10, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 1
  ctx.strokeRect(cam.x * s + 0.5, cam.y * s + 0.5, view.w * s, view.h * s)
}
