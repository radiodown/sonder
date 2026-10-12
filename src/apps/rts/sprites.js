import { BUILDINGS, TEAMS, TILE, UNITS } from './data'

/**
 * 유닛·건물 그림. 한 번 그린 그림은 캔버스로 저장해 두고 매 프레임 붙여 씁니다.
 * 유닛은 오른쪽(+x)을 보는 모습으로 그리고 회전시켜 씁니다. 걷는 유닛은 다리 그림이 4장.
 * 건물은 비스듬히 내려다본 모습: 지붕(윗면) 아래에 앞쪽 벽이 보이고, 발자리 위로 BTOP px 만큼 솟습니다.
 */

const TAU = Math.PI * 2
const SS = 2 // 그림 해상도 배율 (레티나에서도 선명하게)
const BTOP = 30
const UNIT_SCALE = 1.35 // 그림은 부딪힘 반지름보다 조금 크게
const cache = new Map()

// ───────── 색 ─────────

const hex = (c) => {
  const n = parseInt(c.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
export function mix(a, b, t) {
  const A = hex(a)
  const B = hex(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')
}
const lit = (c, t) => mix(c, '#ffffff', t)
const dim = (c, t) => mix(c, '#000000', t)

const LIB = {
  team: TEAMS[0].color,
  dark: TEAMS[0].dark,
  light: TEAMS[0].light,
  cream: '#f4ead2',
  stone: '#eadfc6',
  wood: '#a06d40',
  woodDark: '#5e3b20',
  skin: '#f2c9a5',
  hair: '#4a3426',
  gold: '#e8b84a',
  steel: '#c3c8d1',
  window: '#ffd977',
}
const BUG = {
  team: TEAMS[1].color,
  shell: '#a3360f',
  dark: '#4a1505',
  light: '#ff9a5c',
  glow: '#ffbf2e',
  acid: '#a6e34f',
  flesh: '#b8574a',
  egg: '#f3dfa8',
  silk: '#efe6d6',
  ink: '#4b2a7a',
}
const SPINES = ['#b8473b', '#3f6fa8', '#4f8a4b', '#c99a3c', '#7c4f8f', '#2f7c7a', '#d07a3a', '#8a8f45']

// ───────── 그리기 도우미 ─────────

function ell(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU)
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}
function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1)
  for (const [t, c] of stops) g.addColorStop(t, c)
  return g
}
/** 윤이 나는 타원 (왼쪽 위에서 빛) */
function glossy(ctx, x, y, rx, ry, color, rot = 0, edge = 0.55) {
  const g = ctx.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 0, x, y, Math.max(rx, ry) * 1.1)
  g.addColorStop(0, lit(color, 0.5))
  g.addColorStop(0.45, color)
  g.addColorStop(1, dim(color, 0.45))
  ctx.fillStyle = g
  ell(ctx, x, y, rx, ry, rot)
  ctx.fill()
  ctx.strokeStyle = dim(color, edge)
  ctx.lineWidth = 0.9
  ctx.stroke()
}
function spec(ctx, x, y, rx, ry, a = 0.5, rot = 0) {
  ctx.fillStyle = `rgba(255,255,255,${a})`
  ell(ctx, x, y, rx, ry, rot)
  ctx.fill()
}
function glow(ctx, x, y, r, color, a = 0.8) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalAlpha = a
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 1
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = Math.ceil(w * SS)
  c.height = Math.ceil(h * SS)
  const ctx = c.getContext('2d')
  ctx.scale(SS, SS)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  return { c, ctx }
}

// ───────── 유닛 ─────────

/** 사람 발 (위에서 보면 몸 앞뒤로 살짝 나옴) */
function feet(ctx, f, color) {
  const s = [0, 2, 0, -2][f]
  ctx.fillStyle = color
  ell(ctx, 1 + s, -2.7, 2.4, 1.5)
  ctx.fill()
  ell(ctx, 1 - s, 2.7, 2.4, 1.5)
  ctx.fill()
}

/** 벌레 다리. xs: 다리가 붙는 x 위치들 */
function legs(ctx, f, xs, len, color, width = 1.1) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  xs.forEach((px, i) => {
    for (const s of [-1, 1]) {
      const ph = (f * Math.PI) / 2 + i * 2.1 + (s > 0 ? Math.PI : 0)
      const sw = Math.sin(ph) * 1.8
      const lean = (i - (xs.length - 1) / 2) * 2.2
      ctx.beginPath()
      ctx.moveTo(px, s * 1)
      ctx.lineTo(px + lean * 0.5 + sw * 0.4, s * len * 0.62)
      ctx.lineTo(px + lean + sw, s * len)
      ctx.stroke()
    }
  })
}

function pencil(ctx, x, y, len, w) {
  ctx.fillStyle = '#e88a9a'
  rrect(ctx, x - 3.5, y - w / 2, 3, w, 1)
  ctx.fill()
  ctx.fillStyle = '#c9ccd3'
  ctx.fillRect(x - 1, y - w / 2, 1.6, w)
  ctx.fillStyle = lin(ctx, 0, y - w / 2, 0, y + w / 2, [[0, '#ffe08a'], [0.5, '#f2c14e'], [1, '#c99418']])
  ctx.fillRect(x + 0.6, y - w / 2, len - 4, w)
  ctx.fillStyle = '#e7c497'
  ctx.beginPath()
  ctx.moveTo(x + len - 3.4, y - w / 2)
  ctx.lineTo(x + len, y)
  ctx.lineTo(x + len - 3.4, y + w / 2)
  ctx.fill()
  ctx.fillStyle = '#333'
  ctx.beginPath()
  ctx.moveTo(x + len - 1.2, y - 0.6)
  ctx.lineTo(x + len, y)
  ctx.lineTo(x + len - 1.2, y + 0.6)
  ctx.fill()
}

const UNIT_ART = {
  worker: [
    (ctx, f) => {
      feet(ctx, f, '#3b2f2a')
      glossy(ctx, -0.6, 0, 4.2, 6, LIB.team)
      ctx.fillStyle = LIB.skin
      ell(ctx, 3.8, -4.2, 1.4, 1.3)
      ctx.fill()
      ell(ctx, 3.8, 4.2, 1.4, 1.3)
      ctx.fill()
      ctx.fillStyle = '#b8473b'
      rrect(ctx, 3.4, -3.5, 4.2, 7, 0.8)
      ctx.fill()
      ctx.fillStyle = LIB.cream
      ctx.fillRect(6.6, -3.1, 0.9, 6.2)
      ctx.fillStyle = LIB.gold
      ctx.fillRect(4.2, -0.4, 2, 0.8)
      glossy(ctx, 0.2, 0, 3.3, 3.3, LIB.skin, 0, 0.45)
      ctx.fillStyle = LIB.hair
      ctx.beginPath()
      ctx.arc(0.2, 0, 3.45, Math.PI * 0.5, Math.PI * 1.5)
      ctx.fill()
      glossy(ctx, -3.3, 0, 1.8, 1.8, LIB.hair)
      ctx.strokeStyle = '#222'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.arc(2.3, -1.1, 0.85, 0, TAU)
      ctx.moveTo(3.15, 1.1)
      ctx.arc(2.3, 1.1, 0.85, 0, TAU)
      ctx.stroke()
    },
    (ctx, f) => {
      legs(ctx, f, [-0.5, 1, 2.5], 6.5, BUG.dark)
      glossy(ctx, -4.6, 0, 4.2, 3.4, BUG.shell)
      ctx.strokeStyle = dim(BUG.shell, 0.4)
      ctx.lineWidth = 0.6
      for (const x of [-6, -4]) {
        ctx.beginPath()
        ctx.ellipse(x, 0, 0.8, 3, 0, -Math.PI / 2, Math.PI / 2)
        ctx.stroke()
      }
      glossy(ctx, 0.6, 0, 2.4, 1.9, BUG.team)
      glossy(ctx, 4.2, 0, 2.8, 2.6, BUG.shell)
      ctx.strokeStyle = BUG.dark
      ctx.lineWidth = 0.9
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(6.4, s * 1.4)
        ctx.quadraticCurveTo(8.2, s * 1.4, 8, s * 0.2)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(5.6, s * 1.6)
        ctx.quadraticCurveTo(8, s * 3, 10.5, s * 4.5)
        ctx.lineWidth = 0.6
        ctx.stroke()
        ctx.lineWidth = 0.9
      }
      ctx.fillStyle = BUG.glow
      ell(ctx, 5.2, -1.3, 0.7, 0.6)
      ctx.fill()
      ell(ctx, 5.2, 1.3, 0.7, 0.6)
      ctx.fill()
    },
  ],
  ranged: [
    (ctx, f) => {
      feet(ctx, f, '#2b2b35')
      glossy(ctx, -0.6, 0, 4.4, 6.2, LIB.team)
      ctx.fillStyle = LIB.dark
      ctx.save()
      ctx.rotate(-0.6)
      ctx.fillRect(-4, -0.7, 8, 1.4)
      ctx.restore()
      pencil(ctx, -2, 2.6, 17, 2.8)
      ctx.fillStyle = LIB.skin
      ell(ctx, 2.4, 2.6, 1.3, 1.3)
      ctx.fill()
      ell(ctx, 7, 2.6, 1.2, 1.2)
      ctx.fill()
      glossy(ctx, 0.2, -0.3, 3.9, 3.7, LIB.dark)
      ctx.strokeStyle = LIB.light
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.arc(0.2, -0.3, 3.9, -1.1, 1.1)
      ctx.stroke()
      spec(ctx, -0.8, -1.8, 1.5, 0.8, 0.45)
    },
    (ctx, f) => {
      legs(ctx, f, [-1.5, 0.5, 2.5], 6.2, BUG.dark)
      const g = ctx.createRadialGradient(-5.5, -1, 0, -4.5, 0, 5.2)
      g.addColorStop(0, '#e9ff9e')
      g.addColorStop(0.5, BUG.acid)
      g.addColorStop(1, '#3d6b12')
      ctx.fillStyle = g
      ell(ctx, -4.5, 0, 4.8, 4.2)
      ctx.fill()
      ctx.strokeStyle = '#2c4a0c'
      ctx.lineWidth = 0.8
      ctx.stroke()
      spec(ctx, -5.6, -1.8, 1.8, 0.9, 0.6)
      glossy(ctx, 1.6, 0, 3.3, 2.9, BUG.team)
      ctx.fillStyle = BUG.dark
      rrect(ctx, 3.8, -0.95, 6.4, 1.9, 0.9)
      ctx.fill()
      ctx.fillStyle = BUG.acid
      ell(ctx, 10.2, 0, 1.1, 1.1)
      ctx.fill()
      ctx.fillStyle = BUG.glow
      ell(ctx, 3.6, -1.6, 0.7, 0.6)
      ctx.fill()
      ell(ctx, 3.6, 1.6, 0.7, 0.6)
      ctx.fill()
    },
  ],
  melee: [
    (ctx, f) => {
      feet(ctx, f, '#2b2b35')
      glossy(ctx, -1, 0, 5, 7.2, LIB.team)
      glossy(ctx, -0.6, -5.8, 2.6, 1.9, LIB.light)
      glossy(ctx, -0.6, 5.8, 2.6, 1.9, LIB.light)
      // 사전 방패
      ctx.fillStyle = lin(ctx, 4.5, 0, 9.5, 0, [[0, '#5a1d15'], [1, '#8a3326']])
      rrect(ctx, 4.5, -7.6, 5, 15.2, 1.2)
      ctx.fill()
      ctx.fillStyle = LIB.cream
      ctx.fillRect(5.5, -7, 3, 14)
      ctx.strokeStyle = 'rgba(120,90,50,0.45)'
      ctx.lineWidth = 0.4
      for (let i = 0; i < 5; i++) {
        ctx.beginPath()
        ctx.moveTo(5.5 + i * 0.6, -7)
        ctx.lineTo(5.5 + i * 0.6, 7)
        ctx.stroke()
      }
      ctx.fillStyle = LIB.gold
      ctx.fillRect(4.5, -2, 5, 1.2)
      ctx.fillRect(4.5, 0.8, 5, 1.2)
      glossy(ctx, 0, 0, 3.7, 3.7, LIB.steel)
      ctx.strokeStyle = '#d9342b'
      ctx.lineWidth = 1.7
      ctx.beginPath()
      ctx.moveTo(-4.2, 0)
      ctx.lineTo(2.4, 0)
      ctx.stroke()
    },
    (ctx, f) => {
      legs(ctx, f, [-2.5, 0.5, 3], 7.6, BUG.dark, 1.3)
      glossy(ctx, -2, 0, 6.4, 5.4, BUG.shell)
      ctx.strokeStyle = dim(BUG.shell, 0.55)
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.moveTo(-8.2, 0)
      ctx.lineTo(3.5, 0)
      ctx.stroke()
      spec(ctx, -3, -2.6, 3, 1, 0.35)
      spec(ctx, -3, 2.2, 3, 0.9, 0.2)
      glossy(ctx, 3.8, 0, 2.8, 3.8, BUG.team)
      glossy(ctx, 6.5, 0, 2, 2.6, BUG.dark)
      ctx.strokeStyle = '#2e0d03'
      ctx.lineWidth = 1.8
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(7, s * 1.7)
        ctx.quadraticCurveTo(12.5, s * 5, 13.8, s * 0.6)
        ctx.stroke()
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(11, s * 3.6)
        ctx.lineTo(11.4, s * 2.2)
        ctx.stroke()
        ctx.lineWidth = 1.8
      }
    },
  ],
  tank: [
    (ctx) => {
      for (const [x, y] of [[-7.5, -9.5], [5.5, -9.5], [-7.5, 9.5], [5.5, 9.5]]) {
        ctx.fillStyle = '#2a2522'
        rrect(ctx, x - 3.5, y - 2.2, 7, 4.4, 1.6)
        ctx.fill()
        ctx.fillStyle = LIB.gold
        ell(ctx, x, y, 1, 1)
        ctx.fill()
      }
      ctx.fillStyle = lin(ctx, 0, -8.5, 0, 8.5, [[0, lit(LIB.wood, 0.25)], [1, dim(LIB.wood, 0.25)]])
      rrect(ctx, -11.5, -8.5, 21, 17, 2.5)
      ctx.fill()
      ctx.strokeStyle = LIB.team
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.strokeStyle = 'rgba(60,35,15,0.35)'
      ctx.lineWidth = 0.6
      for (const y of [-4.5, 0, 4.5]) {
        ctx.beginPath()
        ctx.moveTo(-10.5, y)
        ctx.lineTo(8.5, y)
        ctx.stroke()
      }
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = SPINES[i + 2]
        rrect(ctx, -10.4 + i * 1.75, -6.5, 1.55, 13, 0.4)
        ctx.fill()
      }
      glossy(ctx, 1.5, 0, 5.4, 5.4, LIB.team)
      ctx.fillStyle = lin(ctx, 0, -2.8, 0, 2.8, [[0, '#ffffff'], [0.5, LIB.cream], [1, '#c9b78f']])
      ctx.fillRect(2, -2.8, 15, 5.6)
      ctx.strokeStyle = 'rgba(140,110,70,0.5)'
      ctx.lineWidth = 0.6
      for (let x = 4; x < 16; x += 2.6) {
        ctx.beginPath()
        ctx.moveTo(x, -2.8)
        ctx.lineTo(x + 1.6, 2.8)
        ctx.stroke()
      }
      ctx.fillStyle = LIB.dark
      ctx.fillRect(15.5, -3.3, 2.4, 6.6)
      ctx.fillStyle = '#1a1a1a'
      ell(ctx, 18, 0, 0.9, 2.2)
      ctx.fill()
      spec(ctx, 0.2, -2, 2.2, 1.1, 0.5)
    },
    (ctx, f) => {
      legs(ctx, f, [-5, 0, 5], 11.5, BUG.dark, 1.7)
      glossy(ctx, -1, 0, 11, 8.6, BUG.shell)
      ctx.strokeStyle = dim(BUG.shell, 0.55)
      ctx.lineWidth = 0.9
      ctx.beginPath()
      ctx.moveTo(-12, 0)
      ctx.lineTo(9.5, 0)
      ctx.stroke()
      ctx.fillStyle = 'rgba(40,10,0,0.45)'
      for (const [x, y] of [[-6, -4], [-1, -5.5], [-6, 4], [-1, 5.5], [3.5, -3], [3.5, 3]]) {
        ell(ctx, x, y, 1.6, 1.2)
        ctx.fill()
      }
      glossy(ctx, 10.3, 0, 3, 3.6, BUG.dark)
      glow(ctx, -1, 0, 8, 'rgba(255,170,40,0.9)', 0.7)
      glossy(ctx, -1, 0, 4.2, 4.2, BUG.glow)
      ctx.fillStyle = lin(ctx, 0, -2.2, 0, 2.2, [[0, lit(BUG.dark, 0.3)], [1, BUG.dark]])
      rrect(ctx, 1.5, -2.2, 13, 4.4, 2)
      ctx.fill()
      ctx.fillStyle = BUG.glow
      ell(ctx, 14.5, 0, 1.2, 1.8)
      ctx.fill()
    },
  ],
  walker: [
    (ctx, f) => {
      const s = [0, 2.6, 0, -2.6][f]
      ctx.fillStyle = LIB.woodDark
      rrect(ctx, -3 + s, -10, 7.5, 3.8, 1.3)
      ctx.fill()
      rrect(ctx, -3 - s, 6.2, 7.5, 3.8, 1.3)
      ctx.fill()
      for (const y of [-6, 6]) {
        ctx.fillStyle = lin(ctx, 0, y - 1.6, 0, y + 1.6, [[0, '#e3e6ec'], [0.5, '#9aa1ad'], [1, '#5c6370']])
        ctx.fillRect(4, y - 1.6, 11.5, 3.2)
        ctx.fillStyle = LIB.team
        ctx.fillRect(13.5, y - 2, 2.2, 4)
      }
      ctx.fillStyle = lin(ctx, -8, 0, 8, 0, [[0, dim(LIB.wood, 0.2)], [1, lit(LIB.wood, 0.15)]])
      rrect(ctx, -8.5, -9, 15.5, 18, 2)
      ctx.fill()
      ctx.strokeStyle = LIB.woodDark
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.fillStyle = '#3a2516'
      ctx.fillRect(-7, -7.5, 12.5, 15)
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = SPINES[(row * 3 + i) % SPINES.length]
          ctx.fillRect(-6.6 + i * 2, -7 + row * 5, 1.7, 4.2)
        }
        ctx.fillStyle = LIB.wood
        ctx.fillRect(-7, -2.8 + row * 5, 12.5, 0.8)
      }
      glow(ctx, 7, 0, 5, 'rgba(127,208,255,1)', 0.7)
      glossy(ctx, 7, 0, 2.3, 2.3, '#7fd0ff')
    },
    (ctx, f) => {
      ctx.strokeStyle = BUG.dark
      ctx.lineWidth = 1.5
      for (let i = 0; i < 4; i++) {
        for (const s of [-1, 1]) {
          const ph = (f * Math.PI) / 2 + i * 1.7 + (s > 0 ? Math.PI : 0)
          const sw = Math.sin(ph) * 1.6
          const bx = 3 - i * 1.6
          const ang = (-0.9 + i * 0.6) * -1
          ctx.beginPath()
          ctx.moveTo(bx, s * 1.5)
          ctx.lineTo(bx + Math.cos(ang) * 7 + sw * 0.5, s * (7 + Math.abs(Math.sin(ang)) * 2))
          ctx.lineTo(bx + Math.cos(ang) * 13 + sw, s * 12.5)
          ctx.stroke()
        }
      }
      glossy(ctx, -5, 0, 6.5, 5.6, BUG.shell)
      ctx.fillStyle = BUG.glow
      ctx.beginPath()
      ctx.moveTo(-8, -1.6)
      ctx.lineTo(-5, 0)
      ctx.lineTo(-8, 1.6)
      ctx.lineTo(-2.5, 1.6)
      ctx.lineTo(-5, 0)
      ctx.lineTo(-2.5, -1.6)
      ctx.closePath()
      ctx.fill()
      glossy(ctx, 2.6, 0, 4, 3.8, BUG.team)
      for (const [x, y, r] of [[5.4, -1.2, 0.8], [5.4, 1.2, 0.8], [4.4, -2.4, 0.6], [4.4, 2.4, 0.6], [6.1, -0.4, 0.5], [6.1, 0.4, 0.5]]) {
        glow(ctx, x, y, r * 2.4, 'rgba(255,220,80,1)', 0.6)
        ctx.fillStyle = '#fff3a0'
        ell(ctx, x, y, r, r)
        ctx.fill()
      }
      ctx.strokeStyle = '#2e0d03'
      ctx.lineWidth = 1.2
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(6.2, s * 1.4)
        ctx.quadraticCurveTo(8.4, s * 1.8, 8.6, s * 0.4)
        ctx.stroke()
      }
    },
  ],
  fighter: [
    (ctx) => {
      ctx.fillStyle = lin(ctx, 0, -11, 0, 11, [[0, '#ffffff'], [0.48, '#eef2f7'], [0.52, '#d5dce6'], [1, '#c3cddb']])
      ctx.beginPath()
      ctx.moveTo(14, 0)
      ctx.lineTo(-10, -11)
      ctx.lineTo(-6, -1.4)
      ctx.lineTo(-8, 0)
      ctx.lineTo(-6, 1.4)
      ctx.lineTo(-10, 11)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#7d8aa0'
      ctx.lineWidth = 0.8
      ctx.stroke()
      ctx.fillStyle = LIB.team
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(-9.2, s * 10.2)
        ctx.lineTo(-5.4, s * 8.6)
        ctx.lineTo(-4.6, s * 6.6)
        ctx.lineTo(-8, s * 8)
        ctx.closePath()
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(110,125,150,0.7)'
      ctx.lineWidth = 0.6
      ctx.beginPath()
      ctx.moveTo(14, 0)
      ctx.lineTo(-8, 0)
      ctx.moveTo(13, -0.3)
      ctx.lineTo(-8.5, -6)
      ctx.moveTo(13, 0.3)
      ctx.lineTo(-8.5, 6)
      ctx.stroke()
      ctx.fillStyle = LIB.dark
      ell(ctx, 2, 0, 3, 1)
      ctx.fill()
    },
    (ctx) => {
      ctx.strokeStyle = BUG.dark
      ctx.lineWidth = 0.9
      legs(ctx, 1, [-0.5, 1, 2.5], 4.5, BUG.dark, 0.8)
      ctx.save()
      ell(ctx, -5.5, 0, 6.5, 3.6)
      ctx.clip()
      ctx.fillStyle = BUG.glow
      ctx.fillRect(-12, -4, 13, 8)
      ctx.fillStyle = '#1e0a04'
      for (const x of [-10.5, -7, -3.5]) ctx.fillRect(x, -4, 1.8, 8)
      ctx.restore()
      ell(ctx, -5.5, 0, 6.5, 3.6)
      ctx.strokeStyle = '#1e0a04'
      ctx.lineWidth = 0.8
      ctx.stroke()
      spec(ctx, -5, -1.6, 3.5, 0.9, 0.4)
      ctx.fillStyle = '#1e0a04'
      ctx.beginPath()
      ctx.moveTo(-11.5, -0.8)
      ctx.lineTo(-15, 0)
      ctx.lineTo(-11.5, 0.8)
      ctx.fill()
      glossy(ctx, 1, 0, 3, 2.7, BUG.dark)
      glossy(ctx, 4.8, 0, 2.5, 2.8, BUG.team)
      ctx.fillStyle = '#ffde59'
      ell(ctx, 5.5, -1.7, 1.1, 0.9)
      ctx.fill()
      ell(ctx, 5.5, 1.7, 1.1, 0.9)
      ctx.fill()
    },
  ],
  bomber: [
    (ctx) => {
      for (const s of [-1, 1]) {
        ctx.fillStyle = LIB.dark
        ctx.beginPath()
        ctx.moveTo(-11, s * 3)
        ctx.lineTo(-19, s * 10)
        ctx.lineTo(-17, s * 2)
        ctx.closePath()
        ctx.fill()
      }
      glossy(ctx, 0, 0, 17, 10, LIB.team)
      ctx.strokeStyle = 'rgba(15,40,80,0.35)'
      ctx.lineWidth = 0.7
      for (const k of [0.45, 0.8]) {
        ctx.beginPath()
        ctx.ellipse(0, 0, 17, 10 * k, 0, 0, TAU)
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(244,234,210,0.85)'
      ell(ctx, 0, 0, 15, 2.6)
      ctx.fill()
      glossy(ctx, 15.5, 0, 2.4, 2.8, LIB.gold)
      ctx.fillStyle = LIB.cream
      rrect(ctx, -3.5, -3.5, 7, 7, 1)
      ctx.fill()
      ctx.fillStyle = '#b8473b'
      ctx.fillRect(-3.5, -3.5, 1.6, 7)
      spec(ctx, -3, -5.5, 8, 2, 0.35)
    },
    (ctx) => {
      ctx.fillStyle = 'rgba(255,240,220,0.35)'
      ell(ctx, -3, -7, 10, 4.5, 0.3)
      ctx.fill()
      ell(ctx, -3, 7, 10, 4.5, -0.3)
      ctx.fill()
      legs(ctx, 1, [-3, 1, 5], 8, BUG.dark, 1.3)
      glossy(ctx, -2, -3.3, 9.5, 4.4, BUG.shell, 0.14)
      glossy(ctx, -2, 3.3, 9.5, 4.4, BUG.shell, -0.14)
      glossy(ctx, 7, 0, 4.2, 5.2, BUG.team)
      ctx.strokeStyle = '#2e0d03'
      ctx.lineWidth = 2.6
      ctx.beginPath()
      ctx.moveTo(8, 0)
      ctx.quadraticCurveTo(14, 0, 18, -3)
      ctx.stroke()
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(15, -1.2)
      ctx.lineTo(16.5, 1)
      ctx.stroke()
    },
  ],
}

/** 그림 상자 한 변 (몸 반지름 + 다리·무기 여유) */
const unitBox = (type) => Math.ceil(UNITS[type].r * 2 * 1.9 + 14)

function unitSprite(type, team, f) {
  const key = `u-${type}-${team}-${f}`
  let s = cache.get(key)
  if (!s) {
    const size = unitBox(type)
    const { c, ctx } = makeCanvas(size, size)
    ctx.translate(size / 2, size / 2)
    UNIT_ART[type][team](ctx, f)
    s = { c, size }
    cache.set(key, s)
  }
  return s
}

/** 유닛 하나 (몸 + 그림자 + 날개·프로펠러·총구 불꽃) */
export function drawUnitSprite(ctx, u, time) {
  const air = u.air
  const working = u.order.t === 'construct' || (u.order.t === 'gather' && u.order.phase === 'mine')
  const moving = !!u.path || working
  const f = air ? 0 : moving ? Math.floor(time * (working ? 6 : 10) + u.id) % 4 : 0
  const s = unitSprite(u.type, u.team, f)
  const lift = air ? 16 + Math.sin(time * 2.5 + u.id) * 1.5 : 0
  const r = u.r

  ctx.fillStyle = air ? 'rgba(25,15,5,0.22)' : 'rgba(25,15,5,0.3)'
  ell(ctx, u.x + (air ? 6 : 1.5), u.y + (air ? 12 : 3), r * (air ? 1.4 : 1.35), r * (air ? 0.75 : 0.95))
  ctx.fill()

  ctx.save()
  ctx.translate(u.x, u.y - lift)
  ctx.rotate(u.facing)
  ctx.scale(UNIT_SCALE, UNIT_SCALE)

  // 벌레 날개 (그림 아래에 퍼덕임)
  if (air && u.team === 1) {
    const flap = 0.55 + Math.abs(Math.sin(time * 38 + u.id)) * 0.45
    ctx.fillStyle = 'rgba(235,245,255,0.45)'
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = 0.6
    const wl = u.type === 'bomber' ? 13 : 9
    for (const sgn of [-1, 1]) {
      ell(ctx, -1, sgn * wl * 0.6 * flap, wl * 0.75, wl * 0.4 * flap, sgn * 0.35)
      ctx.fill()
      ctx.stroke()
    }
  }

  ctx.drawImage(s.c, -s.size / 2, -s.size / 2, s.size, s.size)

  // 비행선 프로펠러
  if (u.type === 'bomber' && u.team === 0) {
    ctx.fillStyle = 'rgba(40,40,40,0.25)'
    ell(ctx, -18.5, 0, 1.2, 6)
    ctx.fill()
    const a = time * 30
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(-18.5, Math.sin(a) * 6)
    ctx.lineTo(-18.5, -Math.sin(a) * 6)
    ctx.stroke()
  }
  // 총구 불꽃
  if (u.firedAt != null && time - u.firedAt < 0.07 && UNITS[u.type].attack.range > 20) {
    const mx = s.size / 2 - 4
    glow(ctx, mx, u.type === 'ranged' && u.team === 0 ? 2.6 : 0, 6, u.team === 0 ? 'rgba(255,240,170,1)' : 'rgba(190,255,120,1)', 0.9)
  }
  ctx.restore()

  // 일하는 중이면 작은 불티
  if (working && Math.sin(time * 9 + u.id * 3) > 0.6) {
    const fx = u.x + Math.cos(u.facing) * (r + 4)
    const fy = u.y + Math.sin(u.facing) * (r + 4)
    ctx.fillStyle = u.order.t === 'construct' ? '#ffe36b' : u.team === 0 ? '#fff6dc' : BUG.acid
    ell(ctx, fx, fy, 1.4, 1.4)
    ctx.fill()
  }
}

// ───────── 건물 ─────────

/** 비스듬히 본 상자: 지붕 + 앞벽. 지붕 색 그라데이션은 roofFill(ctx, x, y, w, h) 로 바꿀 수 있음 */
function box(ctx, x, y, w, h, hh, roof, wall, r = 4) {
  ctx.fillStyle = 'rgba(30,18,8,0.3)'
  rrect(ctx, x + 5, y + 6, w, h, r + 2)
  ctx.fill()
  const wy = y + h - hh
  ctx.fillStyle = lin(ctx, 0, wy, 0, y + h, [[0, wall], [1, dim(wall, 0.28)]])
  rrect(ctx, x, wy, w, hh, [0, 0, r, r])
  ctx.fill()
  ctx.strokeStyle = dim(wall, 0.55)
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.fillStyle = typeof roof === 'string' ? lin(ctx, 0, y - hh, 0, y + h - hh, [[0, lit(roof, 0.18)], [1, dim(roof, 0.12)]]) : roof
  rrect(ctx, x, y - hh, w, h, r)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.stroke()
  // 지붕 가장자리 하이라이트
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.beginPath()
  ctx.moveTo(x + r, y - hh + 1)
  ctx.lineTo(x + w - r, y - hh + 1)
  ctx.stroke()
  return { top: y - hh, wy }
}

function windowGlow(ctx, x, y, w, h, arch = true) {
  ctx.fillStyle = lin(ctx, 0, y, 0, y + h, [[0, '#fff2b8'], [1, '#f0a83a']])
  ctx.beginPath()
  if (arch) {
    ctx.moveTo(x, y + h)
    ctx.lineTo(x, y + w / 2)
    ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0)
    ctx.lineTo(x + w, y + h)
    ctx.closePath()
  } else ctx.rect(x, y, w, h)
  ctx.fill()
  ctx.strokeStyle = LIB.woodDark
  ctx.lineWidth = 0.9
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y + 1)
  ctx.lineTo(x + w / 2, y + h)
  ctx.stroke()
}

function shingles(ctx, x, y, w, h, color) {
  ctx.strokeStyle = dim(color, 0.3)
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 0.7
  for (let yy = y + 5; yy < y + h; yy += 5) {
    ctx.beginPath()
    ctx.moveTo(x + 2, yy)
    ctx.lineTo(x + w - 2, yy)
    ctx.stroke()
    for (let xx = x + ((yy / 5) % 2 ? 4 : 8); xx < x + w - 2; xx += 8) {
      ctx.beginPath()
      ctx.moveTo(xx, yy - 5)
      ctx.lineTo(xx, yy)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1
}

/** 유기적인 둔덕 (벌레 건물 바탕) */
function mound(ctx, cx, cy, rx, ry, color, seed = 1, shadow = true) {
  if (shadow) {
    ctx.fillStyle = 'rgba(30,10,0,0.3)'
    ell(ctx, cx + 4, cy + ry * 0.55, rx * 1.02, ry * 0.6)
    ctx.fill()
  }
  ctx.beginPath()
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * TAU
    const k = 1 + 0.06 * Math.sin(a * 5 + seed) + 0.04 * Math.sin(a * 9 + seed * 2)
    const x = cx + Math.cos(a) * rx * k
    const y = cy + Math.sin(a) * ry * k
    if (i) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
  }
  ctx.closePath()
  const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.5, 0, cx, cy, Math.max(rx, ry) * 1.15)
  g.addColorStop(0, lit(color, 0.35))
  g.addColorStop(0.5, color)
  g.addColorStop(1, dim(color, 0.5))
  ctx.fillStyle = g
  ctx.fill()
  ctx.strokeStyle = dim(color, 0.6)
  ctx.lineWidth = 1.2
  ctx.stroke()
}

function plates(ctx, cx, cy, rx, ry, rows, color) {
  ctx.strokeStyle = dim(color, 0.5)
  ctx.lineWidth = 1
  for (let i = 1; i <= rows; i++) {
    const k = i / (rows + 1)
    ctx.beginPath()
    ctx.ellipse(cx, cy - ry + ry * 2 * k, rx * Math.sin(Math.PI * k) * 0.98, ry * 0.35, 0, 0.15, Math.PI - 0.15)
    ctx.stroke()
  }
}

const BUILDING_ART = {
  hq: [
    (ctx, W, H) => {
      const { top, wy } = box(ctx, 4, 8, W - 8, H - 12, 24, dim(LIB.team, 0.15), LIB.stone)
      shingles(ctx, 4, top, W - 8, H - 12, LIB.team)
      // 돔
      glow(ctx, W / 2, top + 30, 30, 'rgba(255,255,255,0.35)', 0.5)
      glossy(ctx, W / 2, top + 28, 22, 16, '#5fb3c9')
      ctx.strokeStyle = 'rgba(20,60,80,0.45)'
      ctx.lineWidth = 0.8
      for (const k of [-0.6, -0.2, 0.2, 0.6]) {
        ctx.beginPath()
        ctx.ellipse(W / 2, top + 28, 22 * Math.abs(k), 16, 0, -Math.PI / 2, Math.PI / 2, k < 0)
        ctx.stroke()
      }
      glossy(ctx, W / 2, top + 13, 3.5, 3.5, LIB.gold)
      // 박공
      ctx.fillStyle = LIB.cream
      ctx.beginPath()
      ctx.moveTo(W / 2 - 34, wy + 1)
      ctx.lineTo(W / 2, wy - 14)
      ctx.lineTo(W / 2 + 34, wy + 1)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = dim(LIB.stone, 0.4)
      ctx.stroke()
      ctx.fillStyle = LIB.team
      ctx.beginPath()
      ctx.moveTo(W / 2 - 24, wy - 1)
      ctx.lineTo(W / 2, wy - 10)
      ctx.lineTo(W / 2 + 24, wy - 1)
      ctx.closePath()
      ctx.fill()
      // 기둥
      for (let i = 0; i < 7; i++) {
        const x = 14 + i * ((W - 36) / 6)
        ctx.fillStyle = 'rgba(0,0,0,0.18)'
        ctx.fillRect(x + 3, wy + 3, 6, 20)
        ctx.fillStyle = lin(ctx, x, 0, x + 6, 0, [[0, '#ffffff'], [1, '#d8cba9']])
        ctx.fillRect(x, wy + 2, 6, 20)
        ctx.fillStyle = LIB.cream
        ctx.fillRect(x - 1, wy + 1, 8, 2)
      }
      // 문
      ctx.fillStyle = lin(ctx, 0, wy + 6, 0, wy + 24, [[0, '#6b4024'], [1, '#3b2213']])
      rrect(ctx, W / 2 - 7, wy + 6, 14, 18, [7, 7, 0, 0])
      ctx.fill()
      ctx.fillStyle = LIB.gold
      ell(ctx, W / 2 + 4, wy + 16, 0.9, 0.9)
      ctx.fill()
      // 계단
      ctx.fillStyle = '#d8ccb0'
      ctx.fillRect(W / 2 - 22, H - 5, 44, 3)
      ctx.fillStyle = '#c4b694'
      ctx.fillRect(W / 2 - 26, H - 2, 52, 2.5)
      // 깃발
      for (const x of [10, W - 10]) {
        ctx.strokeStyle = '#4a4a4a'
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(x, top + 4)
        ctx.lineTo(x, top - 16)
        ctx.stroke()
        ctx.fillStyle = LIB.team
        ctx.beginPath()
        ctx.moveTo(x, top - 16)
        ctx.lineTo(x + (x < W / 2 ? 10 : -10), top - 12)
        ctx.lineTo(x, top - 8)
        ctx.fill()
      }
    },
    (ctx, W, H) => {
      mound(ctx, W / 2, H - 38, W / 2 - 6, 38, BUG.shell, 1)
      mound(ctx, W / 2, H - 52, W / 2 - 26, 28, BUG.team, 2, false)
      // 벌집 무늬
      ctx.save()
      ell(ctx, W / 2, H - 52, W / 2 - 28, 26)
      ctx.clip()
      ctx.strokeStyle = 'rgba(255,220,150,0.35)'
      ctx.lineWidth = 0.9
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 12; col++) {
          const x = 16 + col * 9 + (row % 2) * 4.5
          const y = H - 82 + row * 7.6
          ctx.beginPath()
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3 + Math.PI / 6
            ctx.lineTo(x + Math.cos(a) * 4.4, y + Math.sin(a) * 4.4)
          }
          ctx.closePath()
          ctx.stroke()
        }
      }
      ctx.restore()
      mound(ctx, W / 2, H - 72, 24, 17, BUG.shell, 3, false)
      spec(ctx, W / 2 - 8, H - 80, 9, 4, 0.3)
      // 입구
      ctx.fillStyle = '#1a0602'
      ell(ctx, W / 2, H - 22, 15, 9)
      ctx.fill()
      glow(ctx, W / 2, H - 22, 14, 'rgba(255,150,30,1)', 0.75)
      // 가시
      ctx.fillStyle = BUG.dark
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (1.05 + (i / 8) * 0.9)
        const x = W / 2 + Math.cos(a) * (W / 2 - 10)
        const y = H - 38 + Math.sin(a) * 36
        ctx.beginPath()
        ctx.moveTo(x - 3, y + 2)
        ctx.lineTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8)
        ctx.lineTo(x + 3, y + 2)
        ctx.fill()
      }
    },
  ],
  supply: [
    (ctx, W, H) => {
      const { top, wy } = box(ctx, 7, 12, W - 14, H - 18, 26, LIB.wood, LIB.woodDark, 3)
      ctx.strokeStyle = 'rgba(60,30,10,0.35)'
      ctx.lineWidth = 0.7
      for (let y = top + 6; y < wy; y += 6) {
        ctx.beginPath()
        ctx.moveTo(9, y)
        ctx.lineTo(W - 9, y)
        ctx.stroke()
      }
      ctx.fillStyle = '#2d1b0e'
      ctx.fillRect(10, wy + 2, W - 20, 22)
      for (let row = 0; row < 2; row++) {
        let x = 11
        let i = row * 3
        while (x < W - 12) {
          const w = 2.6 + ((i * 7) % 3)
          const h = 8 + ((i * 5) % 3)
          ctx.fillStyle = SPINES[i % SPINES.length]
          ctx.fillRect(x, wy + 3 + row * 11 + (10 - h), Math.min(w, W - 11 - x), h)
          ctx.fillStyle = 'rgba(255,255,255,0.25)'
          ctx.fillRect(x, wy + 5 + row * 11 + (10 - h), Math.min(w, W - 11 - x), 0.8)
          x += w + 0.6
          i++
        }
        ctx.fillStyle = LIB.wood
        ctx.fillRect(10, wy + 13 + row * 11, W - 20, 1.5)
      }
      glossy(ctx, W / 2, top + (wy - top) / 2, 6, 5, LIB.team)
      ctx.fillStyle = LIB.cream
      ctx.fillRect(W / 2 - 2.5, top + (wy - top) / 2 - 2, 5, 4)
    },
    (ctx, W, H) => {
      mound(ctx, W / 2, H - 16, W / 2 - 6, 13, BUG.flesh, 4)
      for (const [x, y, r] of [[W / 2 - 14, H - 26, 9], [W / 2 + 13, H - 27, 9], [W / 2, H - 36, 10], [W / 2 - 8, H - 18, 8], [W / 2 + 9, H - 17, 8]]) {
        glossy(ctx, x, y, r * 0.85, r, BUG.egg, 0, 0.45)
        ctx.strokeStyle = 'rgba(200,90,40,0.5)'
        ctx.lineWidth = 0.6
        ctx.beginPath()
        ctx.moveTo(x - r * 0.4, y + r * 0.6)
        ctx.quadraticCurveTo(x - r * 0.1, y, x + r * 0.2, y - r * 0.5)
        ctx.stroke()
        spec(ctx, x - r * 0.3, y - r * 0.45, r * 0.3, r * 0.2, 0.6)
      }
    },
  ],
  refinery: [
    (ctx, W, H) => {
      ctx.fillStyle = 'rgba(30,18,8,0.3)'
      ell(ctx, W / 2 + 4, H - 10, 26, 10)
      ctx.fill()
      const top = 6
      const bot = H - 12
      ctx.fillStyle = lin(ctx, 6, 0, W - 6, 0, [[0, '#1d2350'], [0.35, '#4a56a0'], [1, '#141838']])
      ctx.fillRect(8, top, W - 16, bot - top)
      ell(ctx, W / 2, bot, W / 2 - 8, 9)
      ctx.fill()
      ctx.fillStyle = lin(ctx, 6, 0, W - 6, 0, [[0, '#8c93a3'], [0.35, '#e6e9ef'], [1, '#6a7180']])
      for (const y of [top + 12, bot - 6]) {
        ctx.fillRect(8, y, W - 16, 3)
      }
      ctx.fillStyle = LIB.team
      ctx.fillRect(8, top + 20, W - 16, 3)
      glossy(ctx, W / 2, top, W / 2 - 8, 9, '#2a2f66')
      ctx.fillStyle = 'rgba(160,180,255,0.35)'
      ell(ctx, W / 2 - 4, top - 1, 10, 3)
      ctx.fill()
      ctx.fillStyle = '#9aa1ad'
      ctx.fillRect(W - 12, top + 4, 5, bot - top - 4)
      ctx.fillStyle = LIB.cream
      ctx.beginPath()
      ctx.moveTo(W / 2, top + 26)
      ctx.quadraticCurveTo(W / 2 + 7, top + 35, W / 2, top + 38)
      ctx.quadraticCurveTo(W / 2 - 7, top + 35, W / 2, top + 26)
      ctx.fill()
    },
    (ctx, W, H) => {
      mound(ctx, W / 2, H - 14, W / 2 - 4, 14, BUG.flesh, 5)
      ctx.strokeStyle = BUG.dark
      ctx.lineWidth = 3
      for (const a of [0.6, 2.5, 4.4]) {
        ctx.beginPath()
        ctx.moveTo(W / 2, H - 30)
        ctx.quadraticCurveTo(W / 2 + Math.cos(a) * 18, H - 26, W / 2 + Math.cos(a) * 24, H - 14 + Math.sin(a) * 6)
        ctx.stroke()
      }
      const g = ctx.createRadialGradient(W / 2 - 5, H - 40, 0, W / 2, H - 34, 20)
      g.addColorStop(0, '#c9a6ff')
      g.addColorStop(0.5, BUG.ink)
      g.addColorStop(1, '#1d0d33')
      ctx.fillStyle = g
      ell(ctx, W / 2, H - 34, 17, 15)
      ctx.fill()
      ctx.strokeStyle = BUG.flesh
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,120,120,0.5)'
      ctx.lineWidth = 0.8
      for (const k of [-1, 0, 1]) {
        ctx.beginPath()
        ctx.moveTo(W / 2 + k * 6, H - 48)
        ctx.quadraticCurveTo(W / 2 + k * 12, H - 34, W / 2 + k * 6, H - 20)
        ctx.stroke()
      }
      spec(ctx, W / 2 - 6, H - 42, 5, 3, 0.45)
    },
  ],
  barracks: [
    (ctx, W, H) => {
      const x = 5
      const w = W - 10
      const { top, wy } = box(ctx, x, 12, w, H - 16, 24, LIB.team, LIB.stone)
      const mid = top + (wy - top) / 2
      ctx.fillStyle = 'rgba(0,0,0,0.14)'
      ctx.fillRect(x + 1, mid, w - 2, wy - mid)
      shingles(ctx, x, top, w, wy - top, LIB.team)
      ctx.fillStyle = LIB.cream
      ctx.fillRect(x + 2, mid - 1.5, w - 4, 3)
      for (const sx of [x + 14, x + w - 34]) {
        ctx.fillStyle = 'rgba(168,220,240,0.9)'
        ctx.fillRect(sx, top + 8, 20, 10)
        ctx.strokeStyle = LIB.woodDark
        ctx.lineWidth = 0.8
        ctx.strokeRect(sx, top + 8, 20, 10)
      }
      for (let i = 0; i < 4; i++) {
        const wx = x + 10 + i * ((w - 26) / 3)
        windowGlow(ctx, wx, wy + 4, 8, 13)
      }
      ctx.fillStyle = lin(ctx, 0, wy + 6, 0, wy + 24, [[0, '#7a4a2a'], [1, '#432714']])
      rrect(ctx, W / 2 - 7, wy + 6, 14, 18, [3, 3, 0, 0])
      ctx.fill()
      ctx.strokeStyle = '#2b180b'
      ctx.beginPath()
      ctx.moveTo(W / 2, wy + 6)
      ctx.lineTo(W / 2, wy + 24)
      ctx.stroke()
      ctx.strokeStyle = '#4a4a4a'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(x + w - 8, top + 4)
      ctx.lineTo(x + w - 8, top - 18)
      ctx.stroke()
      ctx.fillStyle = LIB.team
      ctx.fillRect(x + w - 20, top - 18, 12, 7)
      ctx.fillStyle = LIB.cream
      ctx.fillRect(x + w - 16, top - 16.5, 5, 4)
    },
    (ctx, W, H) => {
      mound(ctx, W / 2, H - 30, W / 2 - 6, 28, BUG.shell, 6)
      ctx.fillStyle = '#1a0602'
      ell(ctx, W / 2, H - 16, 13, 8)
      ctx.fill()
      glow(ctx, W / 2, H - 16, 10, 'rgba(255,140,30,1)', 0.55)
      for (const [x, y, rot] of [[W / 2 - 20, H - 50, -0.5], [W / 2 + 2, H - 62, 0.1], [W / 2 + 22, H - 46, 0.6]]) {
        glow(ctx, x, y, 14, 'rgba(255,190,90,1)', 0.35)
        glossy(ctx, x, y, 8, 14, BUG.silk, rot, 0.35)
        ctx.strokeStyle = 'rgba(160,130,90,0.55)'
        ctx.lineWidth = 0.7
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath()
          ctx.ellipse(x + Math.sin(rot) * k * 4.5, y - Math.cos(rot) * k * 4.5 * -1, 7.6, 2.2, rot + 0.35, 0, Math.PI)
          ctx.stroke()
        }
      }
    },
  ],
  lab: [
    (ctx, W, H) => {
      const { top, wy } = box(ctx, 5, 10, W - 10, H - 14, 20, '#b9c3d6', LIB.stone)
      glossy(ctx, 30, top + 16, 17, 12, '#9ad7ec')
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 0.7
      for (const k of [-0.5, 0, 0.5]) {
        ctx.beginPath()
        ctx.moveTo(30 + k * 17, top + 6)
        ctx.lineTo(30 + k * 17, top + 26)
        ctx.stroke()
      }
      for (const [x, c] of [[W - 34, '#5fd17a'], [W - 18, '#e05fb0']]) {
        ctx.fillStyle = 'rgba(220,240,255,0.7)'
        ctx.beginPath()
        ctx.moveTo(x - 2.5, top + 4)
        ctx.lineTo(x + 2.5, top + 4)
        ctx.lineTo(x + 2.5, top + 10)
        ctx.lineTo(x + 8, top + 24)
        ctx.lineTo(x - 8, top + 24)
        ctx.lineTo(x - 2.5, top + 10)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = '#5c6370'
        ctx.stroke()
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.moveTo(x - 5.5, top + 17)
        ctx.lineTo(x + 5.5, top + 17)
        ctx.lineTo(x + 8, top + 24)
        ctx.lineTo(x - 8, top + 24)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#a06d40'
        ctx.fillRect(x - 2.5, top + 2, 5, 3)
      }
      for (let i = 0; i < 4; i++) {
        const cx = 18 + i * ((W - 36) / 3)
        ctx.fillStyle = '#7fd0ff'
        ell(ctx, cx, wy + 10, 4, 4)
        ctx.fill()
        ctx.strokeStyle = '#8c93a3'
        ctx.lineWidth = 1.4
        ctx.stroke()
      }
    },
    (ctx, W, H) => {
      mound(ctx, W / 2, H - 20, W / 2 - 6, 18, BUG.shell, 7)
      const cx = W / 2
      const cy = H - 34
      glossy(ctx, cx, cy, 20, 17, BUG.team)
      ctx.strokeStyle = BUG.dark
      ctx.lineWidth = 1.6
      ctx.beginPath()
      for (let t = 0; t < 4.4 * Math.PI; t += 0.15) {
        const r = 1.5 * Math.exp(0.21 * t)
        const x = cx + Math.cos(t) * r
        const y = cy + Math.sin(t) * r * 0.85
        if (t === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      spec(ctx, cx - 7, cy - 8, 6, 3, 0.35)
    },
  ],
  turret: [
    (ctx, W, H) => {
      ctx.fillStyle = 'rgba(30,18,8,0.3)'
      ell(ctx, W / 2 + 4, H - 10, 24, 10)
      ctx.fill()
      const top = 8
      const bot = H - 12
      ctx.fillStyle = lin(ctx, 10, 0, W - 10, 0, [[0, '#a89a80'], [0.35, '#efe4cc'], [1, '#867a62']])
      ctx.fillRect(10, top, W - 20, bot - top)
      ell(ctx, W / 2, bot, W / 2 - 10, 8)
      ctx.fill()
      ctx.strokeStyle = 'rgba(90,70,40,0.35)'
      ctx.lineWidth = 0.7
      for (let y = top + 6; y < bot; y += 6) {
        ctx.beginPath()
        ctx.moveTo(10, y)
        ctx.lineTo(W - 10, y)
        ctx.stroke()
      }
      ctx.fillStyle = LIB.team
      ctx.fillRect(10, top + 14, W - 20, 3)
      glossy(ctx, W / 2, top, W / 2 - 10, 8, '#d8ccb0')
      ctx.fillStyle = '#c4b694'
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (i / 6)
        ctx.fillRect(W / 2 + Math.cos(a) * (W / 2 - 13) - 2.5, top + Math.sin(a) * 6 - 4, 5, 5)
      }
    },
    (ctx, W, H) => {
      mound(ctx, W / 2, H - 16, W / 2 - 6, 14, BUG.flesh, 8)
      ctx.strokeStyle = BUG.dark
      ctx.lineWidth = 2
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU
        ctx.beginPath()
        ctx.moveTo(W / 2 + Math.cos(a) * 8, H - 20 + Math.sin(a) * 4)
        ctx.quadraticCurveTo(W / 2 + Math.cos(a) * 18, H - 18 + Math.sin(a) * 8, W / 2 + Math.cos(a) * 24, H - 14 + Math.sin(a) * 9)
        ctx.stroke()
      }
      glossy(ctx, W / 2, H - 26, 9, 12, BUG.shell)
    },
  ],
  factory: [
    (ctx, W, H) => {
      const x = 5
      const w = W - 10
      const { top, wy } = box(ctx, x, 12, w, H - 16, 24, '#8f96a3', '#d9c7a8')
      const teeth = 4
      const tw = (w - 4) / teeth
      for (let i = 0; i < teeth; i++) {
        const tx = x + 2 + i * tw
        ctx.fillStyle = lin(ctx, tx, 0, tx + tw, 0, [[0, '#6b7280'], [0.7, '#c9ced8'], [1, '#e9ecf1']])
        ctx.fillRect(tx, top + 3, tw - 1, wy - top - 6)
        ctx.fillStyle = 'rgba(168,220,240,0.85)'
        ctx.fillRect(tx + tw - 6, top + 4, 4, wy - top - 8)
      }
      // 굴뚝
      ctx.fillStyle = lin(ctx, W - 26, 0, W - 14, 0, [[0, '#8a3a2a'], [0.4, '#c7604a'], [1, '#6a2a1e']])
      ctx.fillRect(W - 26, top - 22, 12, 30)
      ctx.fillStyle = '#2a1a14'
      ell(ctx, W - 20, top - 22, 6, 2.4)
      ctx.fill()
      // 셔터 문
      ctx.fillStyle = lin(ctx, 0, wy + 4, 0, wy + 24, [[0, '#c3c8d1'], [1, '#7d8594']])
      ctx.fillRect(W / 2 - 16, wy + 4, 32, 20)
      ctx.strokeStyle = 'rgba(60,65,75,0.6)'
      ctx.lineWidth = 0.7
      for (let y = wy + 7; y < wy + 24; y += 3) {
        ctx.beginPath()
        ctx.moveTo(W / 2 - 16, y)
        ctx.lineTo(W / 2 + 16, y)
        ctx.stroke()
      }
      ctx.fillStyle = '#f2c14e'
      for (let i = 0; i < 8; i++) ctx.fillRect(W / 2 - 16 + i * 4, wy + 22, 2, 2)
      // 톱니
      ctx.fillStyle = LIB.gold
      ctx.beginPath()
      ctx.arc(x + 14, wy + 12, 5, 0, TAU)
      ctx.fill()
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4
        ctx.fillRect(x + 14 + Math.cos(a) * 6.5 - 1.5, wy + 12 + Math.sin(a) * 6.5 - 1.5, 3, 3)
      }
      ctx.fillStyle = '#d9c7a8'
      ell(ctx, x + 14, wy + 12, 2, 2)
      ctx.fill()
      windowGlow(ctx, x + w - 20, wy + 6, 9, 10, false)
      ctx.fillStyle = LIB.team
      ctx.fillRect(x + 2, wy, w - 4, 2.5)
    },
    (ctx, W, H) => {
      ctx.fillStyle = BUG.dark
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(W / 2 + s * 30, H - 30)
        ctx.quadraticCurveTo(W / 2 + s * 50, H - 40, W / 2 + s * 44, H - 14)
        ctx.lineTo(W / 2 + s * 38, H - 22)
        ctx.quadraticCurveTo(W / 2 + s * 40, H - 32, W / 2 + s * 28, H - 24)
        ctx.closePath()
        ctx.fill()
      }
      mound(ctx, W / 2, H - 36, W / 2 - 12, 32, BUG.shell, 9)
      plates(ctx, W / 2, H - 36, W / 2 - 12, 32, 4, BUG.shell)
      spec(ctx, W / 2 - 10, H - 56, 12, 5, 0.3)
      ctx.fillStyle = '#1a0602'
      ell(ctx, W / 2, H - 14, 12, 6)
      ctx.fill()
      glow(ctx, W / 2, H - 14, 10, 'rgba(255,140,30,1)', 0.5)
    },
  ],
  armory: [
    (ctx, W, H) => {
      const { top, wy } = box(ctx, 5, 10, W - 10, H - 14, 20, '#6d7482', LIB.stone)
      ctx.fillStyle = lin(ctx, 0, top + 6, 0, top + 22, [[0, '#f0f2f6'], [0.4, '#a7aebb'], [1, '#4f5563']])
      rrect(ctx, 14, top + 6, W - 28, 16, 8)
      ctx.fill()
      ctx.fillStyle = LIB.team
      for (const x of [14, W - 22]) {
        rrect(ctx, x, top + 4, 8, 20, 3)
        ctx.fill()
      }
      ctx.fillStyle = LIB.cream
      ctx.beginPath()
      ctx.moveTo(26, top + 20)
      ctx.lineTo(W - 26, top + 20)
      ctx.lineTo(W - 22, wy + 2)
      ctx.lineTo(22, wy + 2)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = 'rgba(40,40,40,0.5)'
      ctx.lineWidth = 0.8
      for (let y = top + 23; y < wy; y += 2.6) {
        ctx.beginPath()
        ctx.moveTo(30, y)
        ctx.lineTo(W / 2 + ((y * 7) % 20), y)
        ctx.stroke()
      }
      windowGlow(ctx, 14, wy + 5, 9, 10, false)
      windowGlow(ctx, W - 23, wy + 5, 9, 10, false)
      ctx.fillStyle = lin(ctx, 0, wy + 4, 0, wy + 20, [[0, '#7a4a2a'], [1, '#432714']])
      ctx.fillRect(W / 2 - 6, wy + 4, 12, 16)
    },
    (ctx, W, H) => {
      mound(ctx, W / 2, H - 16, W / 2 - 6, 14, BUG.flesh, 10)
      for (const [x, y, rot] of [[W / 2 - 18, H - 26, -0.3], [W / 2 + 16, H - 28, 0.4], [W / 2, H - 36, 0]]) {
        ctx.globalAlpha = 0.85
        glossy(ctx, x, y, 16, 9, '#d68a3a', rot, 0.5)
        ctx.globalAlpha = 1
        ctx.strokeStyle = 'rgba(90,40,10,0.55)'
        ctx.lineWidth = 0.8
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath()
          ctx.ellipse(x + k * 5 * Math.cos(rot), y + k * 5 * Math.sin(rot), 1.4, 8, rot, 0, TAU)
          ctx.stroke()
        }
        spec(ctx, x - 4, y - 4, 6, 2, 0.4, rot)
      }
    },
  ],
  starport: [
    (ctx, W, H) => {
      const x = 5
      const w = W - 10
      const hh = 26
      const roofG = lin(ctx, 0, 12 - hh, 0, H - 4 - hh, [[0, '#6c7b94'], [0.45, '#dfe6f1'], [1, '#56627a']])
      const { top, wy } = box(ctx, x, 12, w, H - 16, hh, roofG, '#cfd5df', 10)
      ctx.strokeStyle = 'rgba(40,50,70,0.3)'
      ctx.lineWidth = 0.8
      for (let xx = x + 8; xx < x + w - 4; xx += 9) {
        ctx.beginPath()
        ctx.moveTo(xx, top + 2)
        ctx.lineTo(xx, wy - 1)
        ctx.stroke()
      }
      ctx.fillStyle = LIB.team
      ctx.fillRect(x + 2, wy - 4, w - 4, 3)
      ctx.fillStyle = '#1d1a18'
      rrect(ctx, W / 2 - 24, wy + 3, 48, 22, [12, 12, 0, 0])
      ctx.fill()
      ctx.fillStyle = '#eef2f7'
      ctx.beginPath()
      ctx.moveTo(W / 2 + 10, wy + 16)
      ctx.lineTo(W / 2 - 8, wy + 10)
      ctx.lineTo(W / 2 - 4, wy + 16)
      ctx.lineTo(W / 2 - 8, wy + 22)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#f2c14e'
      for (let i = 0; i < 12; i++) if (i % 2 === 0) ctx.fillRect(W / 2 - 24 + i * 4, wy + 23, 4, 2)
    },
    (ctx, W, H) => {
      for (const s of [-1, 1]) {
        ctx.fillStyle = 'rgba(255,235,210,0.4)'
        ctx.strokeStyle = 'rgba(120,60,30,0.6)'
        ctx.lineWidth = 0.8
        ell(ctx, W / 2 + s * 28, H - 44, 22, 10, s * 0.5)
        ctx.fill()
        ctx.stroke()
        for (let k = 0; k < 4; k++) {
          ctx.beginPath()
          ctx.moveTo(W / 2 + s * 12, H - 40)
          ctx.lineTo(W / 2 + s * (30 + k * 4), H - 56 + k * 7)
          ctx.stroke()
        }
      }
      ctx.fillStyle = 'rgba(30,10,0,0.3)'
      ell(ctx, W / 2 + 4, H - 20, W / 2 - 8, 18)
      ctx.fill()
      ctx.strokeStyle = '#6b4424'
      ctx.lineWidth = 2.2
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU
        const a2 = a + 0.6
        ctx.beginPath()
        ctx.moveTo(W / 2 + Math.cos(a) * 34, H - 34 + Math.sin(a) * 22)
        ctx.lineTo(W / 2 + Math.cos(a2) * 30, H - 34 + Math.sin(a2) * 19)
        ctx.stroke()
      }
      ctx.fillStyle = '#2a0e05'
      ell(ctx, W / 2, H - 34, 26, 16)
      ctx.fill()
      for (const [x, y, rot] of [[W / 2 - 10, H - 36, 0.3], [W / 2 + 8, H - 30, -0.4], [W / 2 + 4, H - 40, 1.2]]) {
        glossy(ctx, x, y, 7, 3.5, '#f6ecd8', rot, 0.35)
      }
    },
  ],
}

/** 발자리 위로 솟는 높이 (체력 막대 위치용) */
export const BUILDING_RISE = { hq: 18, supply: 14, refinery: 4, barracks: 14, lab: 12, turret: 8, factory: 14, armory: 12, starport: 16 }

function buildingSprite(type, team) {
  const key = `b-${type}-${team}`
  let s = cache.get(key)
  if (!s) {
    const d = BUILDINGS[type]
    const W = d.w * TILE
    const H = d.h * TILE
    const { c, ctx } = makeCanvas(W + 8, H + BTOP + 6)
    ctx.translate(0, BTOP)
    BUILDING_ART[type][team](ctx, W, H)
    s = { c, W: W + 8, H: H + BTOP + 6 }
    cache.set(key, s)
  }
  return s
}

/** 건물 하나. 짓는 중이면 도서관은 비계 속에서 아래부터 올라가고, 벌레는 자라납니다 */
export function drawBuildingSprite(ctx, b, game) {
  const s = buildingSprite(b.type, b.team)
  const x0 = b.tx * TILE
  const y0 = b.ty * TILE - BTOP
  const t = game.time
  const p = b.done ? 1 : Math.min(1, b.progress / BUILDINGS[b.type].time)
  const H = b.h * TILE

  if (b.done) ctx.drawImage(s.c, x0, y0, s.W, s.H)
  else if (b.team === 0) {
    ctx.globalAlpha = 0.18
    ctx.drawImage(s.c, x0, y0, s.W, s.H)
    ctx.globalAlpha = 1
    const vis = (s.H - 6) * (0.15 + 0.85 * p)
    const sy = s.H - 6 - vis
    ctx.drawImage(s.c, 0, sy * SS, s.c.width, (vis + 6) * SS, x0, y0 + sy, s.W, vis + 6)
    // 비계
    ctx.strokeStyle = 'rgba(120,80,40,0.85)'
    ctx.lineWidth = 1.5
    const left = x0 + 3
    const right = x0 + b.w * TILE - 3
    const topY = y0 + BTOP - BUILDING_RISE[b.type] - 4
    const bottom = b.ty * TILE + H
    for (let x = left; x <= right + 0.1; x += (right - left) / Math.max(2, b.w)) {
      ctx.beginPath()
      ctx.moveTo(x, topY)
      ctx.lineTo(x, bottom)
      ctx.stroke()
    }
    for (let y = bottom - 2; y > topY; y -= 14) {
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(right, y)
      ctx.stroke()
    }
  } else {
    ctx.fillStyle = 'rgba(140,200,60,0.35)'
    ell(ctx, b.x, b.y + 6, b.w * 14, b.h * 10)
    ctx.fill()
    const k = 0.3 + 0.7 * p
    const ax = x0 + s.W / 2
    const ay = b.ty * TILE + H
    ctx.save()
    ctx.translate(ax, ay)
    ctx.scale(k, k * (0.92 + Math.sin(t * 4) * 0.04))
    ctx.globalAlpha = 0.6 + 0.4 * p
    ctx.drawImage(s.c, -s.W / 2, -(ay - y0), s.W, s.H)
    ctx.restore()
    ctx.globalAlpha = 1
  }

  if (!b.done) return
  // 움직이는 장식
  if (b.team === 0 && b.type === 'factory') {
    const busy = b.queue.length > 0
    for (let i = 0; i < (busy ? 4 : 2); i++) {
      const ph = (t * 0.5 + i / (busy ? 4 : 2)) % 1
      ctx.fillStyle = `rgba(200,200,200,${0.45 * (1 - ph)})`
      ell(ctx, x0 + b.w * TILE - 20 + ph * 10, y0 + BTOP - 34 - ph * 30, 4 + ph * 7, 4 + ph * 7)
      ctx.fill()
    }
  }
  if (b.team === 0 && b.type === 'starport') {
    const on = Math.floor(t * 2) % 2
    for (const [dx, dy] of [[8, 10], [b.w * TILE - 8, 10], [8, H - 4], [b.w * TILE - 8, H - 4]]) {
      ctx.fillStyle = on ? '#ff5a4f' : '#5a1a14'
      ell(ctx, x0 + dx, b.ty * TILE + dy - (dy < 20 ? 22 : 0), 2, 2)
      ctx.fill()
    }
  }
  if (b.team === 0 && b.queue.length && b.type !== 'factory') {
    glow(ctx, b.x, b.ty * TILE + H - 10, 14 + Math.sin(t * 6) * 2, 'rgba(255,220,120,1)', 0.35)
  }
  if (b.team === 1) {
    const pulse = 0.35 + 0.25 * Math.sin(t * 3 + b.id)
    glow(ctx, b.x, b.ty * TILE + H - 14, Math.min(b.w, b.h) * 10, 'rgba(255,170,40,1)', pulse * (b.queue.length ? 1 : 0.5))
  }
  if (b.type === 'turret') drawTurretHead(ctx, b, game)

  // 다치면 연기, 많이 다치면 불
  const hp = b.hp / b.maxHp
  if (hp < 0.55) {
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.6 + i / 3 + b.id * 0.13) % 1
      const sx = x0 + ((b.id * 37 + i * 29) % (b.w * TILE - 16)) + 8
      ctx.fillStyle = `rgba(60,55,50,${0.5 * (1 - ph)})`
      ell(ctx, sx + ph * 6, b.ty * TILE - ph * 34, 4 + ph * 8, 4 + ph * 8)
      ctx.fill()
    }
  }
  if (hp < 0.3) {
    for (let i = 0; i < 2; i++) {
      const sx = x0 + ((b.id * 53 + i * 41) % (b.w * TILE - 20)) + 10
      const sy = b.ty * TILE + 6 + i * 10
      const fl = 6 + Math.sin(t * 20 + i * 2) * 2
      ctx.fillStyle = 'rgba(255,140,30,0.85)'
      ctx.beginPath()
      ctx.moveTo(sx - 4, sy)
      ctx.quadraticCurveTo(sx, sy - fl * 2, sx + 4, sy)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,230,120,0.9)'
      ctx.beginPath()
      ctx.moveTo(sx - 2, sy)
      ctx.quadraticCurveTo(sx, sy - fl, sx + 2, sy)
      ctx.fill()
    }
  }
}

function drawTurretHead(ctx, b, game) {
  const tgt = b.target && game.ents.get(b.target)
  const a = tgt && !tgt.dead ? Math.atan2(tgt.y - b.y, tgt.x - b.x) : -Math.PI / 2 + Math.sin(game.time * 0.6 + b.id) * 0.8
  const hx = b.x
  const hy = b.ty * TILE + (b.team === 0 ? 6 : 30)
  ctx.save()
  ctx.translate(hx, hy)
  ctx.rotate(a)
  if (b.team === 0) {
    glossy(ctx, 0, 0, 10, 10, LIB.team)
    pencil(ctx, 2, -3, 20, 3.4)
    pencil(ctx, 2, 3, 20, 3.4)
    glossy(ctx, 0, 0, 4, 4, LIB.gold)
  } else {
    ctx.fillStyle = BUG.dark
    for (let i = 0; i < 7; i++) {
      const sa = -0.9 + (i / 6) * 1.8
      ctx.beginPath()
      ctx.moveTo(Math.cos(sa + 0.18) * 8, Math.sin(sa + 0.18) * 8)
      ctx.lineTo(Math.cos(sa) * 19, Math.sin(sa) * 19)
      ctx.lineTo(Math.cos(sa - 0.18) * 8, Math.sin(sa - 0.18) * 8)
      ctx.fill()
    }
    glossy(ctx, 0, 0, 10, 9, BUG.shell)
    glow(ctx, 5, 0, 7, 'rgba(255,220,80,1)', 0.8)
    ctx.fillStyle = '#fff3a0'
    ell(ctx, 5, 0, 2.6, 2)
    ctx.fill()
  }
  ctx.restore()
  if (b.firedAt != null && game.time - b.firedAt < 0.07) {
    glow(ctx, hx + Math.cos(a) * 22, hy + Math.sin(a) * 22, 8, b.team === 0 ? 'rgba(255,240,170,1)' : 'rgba(190,255,120,1)', 0.9)
  }
}

/** 명령 카드·선택 패널에서 쓸 작은 그림 (data URL) */
export function iconURL(kind, type, team = 0) {
  const key = `icon-${kind}-${type}-${team}`
  let url = cache.get(key)
  if (!url) {
    const spr = kind === 'unit' ? unitSprite(type, team, 0) : buildingSprite(type, team)
    const c = document.createElement('canvas')
    c.width = 96
    c.height = 96
    const ctx = c.getContext('2d')
    if (kind === 'unit') {
      ctx.translate(48, 48)
      ctx.rotate(-Math.PI / 2)
      const k = 88 / spr.size
      ctx.drawImage(spr.c, (-spr.size / 2) * k, (-spr.size / 2) * k, spr.size * k, spr.size * k)
    } else {
      const k = Math.min(92 / spr.W, 92 / spr.H)
      ctx.drawImage(spr.c, 48 - (spr.W * k) / 2, 48 - (spr.H * k) / 2, spr.W * k, spr.H * k)
    }
    url = c.toDataURL()
    cache.set(key, url)
  }
  return url
}
