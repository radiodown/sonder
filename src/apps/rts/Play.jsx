import { ArrowCounterClockwiseIcon, ListIcon, PlayIcon, TrophyIcon } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { selectActive, useWindows } from '../../stores/windows'
import { confirmDialog } from '../../ui/ConfirmDialog'
import { aiState, aiThink } from './ai'
import { getCommands } from './commands'
import { BUILDINGS, DIFFICULTIES, MAP_H, MAP_W, TILE, UNITS } from './data'
import * as E from './engine'
import { CommandCard, SelectionPanel, TopBar } from './Hud'
import { clock, saveResult } from './records'
import { draw, drawMinimap, makeFog, makeTerrain } from './render'

const WORLD_W = MAP_W * TILE
const WORLD_H = MAP_H * TILE
const MINI = 136
const EDGE = 14
const PAN_SPEED = 900

/** 한 판. 시뮬레이션·그리기는 rAF 에서, HUD 는 0.1초마다 다시 그립니다 */
export function Play({ win, difficulty, onExit, onRestart }) {
  const [game] = useState(() => E.createGame(difficulty))
  const ui = useRef(null)
  ui.current ??= {
    cam: { x: 0, y: 0 },
    view: { w: 1, h: 1 },
    sel: new Set(),
    mode: null, // { kind: 'build', type } | { kind: 'target', cmd }
    menu: null, // 'build'
    mouse: { x: 0, y: 0, in: false },
    drag: null,
    pan: null,
    miniDrag: false,
    keys: new Set(),
    groups: {},
    lastGroup: null,
    lastClick: null,
    hover: 0,
    marker: null,
    speed: 1,
    paused: false,
    auto: false,
    lastPing: null,
    result: null,
    idleIdx: 0,
  }
  const s = ui.current
  const [, setTick] = useState(0)
  const bump = () => setTick((t) => t + 1)
  const rootRef = useRef(null)
  const viewRef = useRef(null)
  const canvasRef = useRef(null)
  const miniRef = useRef(null)
  const active = useWindows((st) => selectActive(st)?.id === win.id)

  useEffect(() => {
    s.auto = !active || win.minimized
  }, [active, win.minimized, s])

  const say = (text) => E.message(game, text)
  const selected = () => [...s.sel].map((id) => E.ent(game, id)).filter(Boolean)
  const ownSel = () => selected().filter((e) => e.team === 0)

  const clampCam = () => {
    const { w, h } = s.view
    s.cam.x = w >= WORLD_W ? (WORLD_W - w) / 2 : Math.min(Math.max(s.cam.x, 0), WORLD_W - w)
    s.cam.y = h >= WORLD_H ? (WORLD_H - h) / 2 : Math.min(Math.max(s.cam.y, 0), WORLD_H - h)
  }
  const centerOn = (x, y) => {
    s.cam.x = x - s.view.w / 2
    s.cam.y = y - s.view.h / 2
    clampCam()
  }
  const onScreen = (e) => e.x >= s.cam.x && e.x <= s.cam.x + s.view.w && e.y >= s.cam.y && e.y <= s.cam.y + s.view.h

  // 정제소는 잉크 샘에 딱 맞춰 붙습니다
  const buildSpot = (type, wx, wy) => {
    const d = BUILDINGS[type]
    if (d.onGeyser) {
      const gz = game.list
        .filter((e) => e.cat === 'res' && e.type === 'geyser')
        .sort((a, b) => Math.hypot(a.x - wx, a.y - wy) - Math.hypot(b.x - wx, b.y - wy))[0]
      if (gz && Math.hypot(gz.x - wx, gz.y - wy) < 3 * TILE) return { tx: gz.tx, ty: gz.ty }
    }
    return { tx: Math.round(wx / TILE - d.w / 2), ty: Math.round(wy / TILE - d.h / 2) }
  }

  const mark = (x, y, color) => {
    s.marker = { x, y, t: performance.now(), color }
  }

  const centerHome = () => {
    const hq = game.list.find((e) => e.team === 0 && e.type === 'hq')
    if (hq) centerOn(hq.x + 120, hq.y - 80)
  }

  // ── 시작 ──
  useEffect(() => {
    const d = DIFFICULTIES[difficulty]
    say(`벌레가 ${clock(d.firstWave)}에 처음 습격합니다. 사서로 종이를 모으고 열람실을 지으세요`)
    rootRef.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 크기 ──
  useEffect(() => {
    const el = viewRef.current
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const first = s.view.w <= 1
      s.view = { w: r.width, h: r.height }
      const c = canvasRef.current
      c.width = Math.round(r.width * dpr)
      c.height = Math.round(r.height * dpr)
      // 크기를 처음 알았을 때 본진으로
      if (first) centerHome()
      else clampCam()
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 휠로 화면 이동 (트랙패드 두 손가락) ──
  useEffect(() => {
    const c = canvasRef.current
    const onWheel = (e) => {
      e.preventDefault()
      s.cam.x += e.deltaX
      s.cam.y += e.deltaY
      clampCam()
    }
    c.addEventListener('wheel', onWheel, { passive: false })
    return () => c.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 게임 루프 ──
  useEffect(() => {
    const assets = { terrain: makeTerrain(game), fog: makeFog() }
    const mini = miniRef.current
    const dpr = window.devicePixelRatio || 1
    mini.width = MINI * dpr
    mini.height = MINI * dpr
    let raf
    let last = performance.now()
    let hudT = 0
    let miniT = 0
    let cursor = ''

    const frame = (now) => {
      const real = Math.min(0.1, (now - last) / 1000)
      last = now
      if (!s.paused && !s.auto && !game.over) {
        let left = real * s.speed
        while (left > 1e-4) {
          const d = Math.min(left, 1 / 30)
          E.step(game, d)
          aiThink(game, d)
          left -= d
        }
      }
      if (game.pings.length) s.lastPing = game.pings[game.pings.length - 1]
      if (game.over && !s.result) {
        s.result = saveResult(difficulty, game.over.winner === 0, game.over.time)
        bump()
      }

      // 방향키·화면 가장자리로 이동
      if (!s.auto) {
        let dx = 0
        let dy = 0
        if (s.keys.has('ArrowLeft')) dx--
        if (s.keys.has('ArrowRight')) dx++
        if (s.keys.has('ArrowUp')) dy--
        if (s.keys.has('ArrowDown')) dy++
        if (s.mouse.in && !s.pan) {
          if (s.mouse.x < EDGE) dx--
          if (s.mouse.x > s.view.w - EDGE) dx++
          if (s.mouse.y < EDGE) dy--
          if (s.mouse.y > s.view.h - EDGE) dy++
        }
        if (dx || dy) {
          s.cam.x += Math.sign(dx) * PAN_SPEED * real
          s.cam.y += Math.sign(dy) * PAN_SPEED * real
          clampCam()
        }
      }

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      const cdpr = canvas.width / Math.max(1, s.view.w)
      ctx.setTransform(cdpr, 0, 0, cdpr, 0, 0)
      const wx = s.mouse.x + s.cam.x
      const wy = s.mouse.y + s.cam.y
      const ghost = s.mode?.kind === 'build' && s.mouse.in ? { type: s.mode.type, ...buildSpot(s.mode.type, wx, wy) } : null
      const box = s.drag && Math.hypot(s.drag.x1 - s.drag.x0, s.drag.y1 - s.drag.y0) >= 5 ? s.drag : null
      draw(ctx, game, assets, s.cam, s.view, { sel: s.sel, hover: s.hover, ghost, box, marker: s.marker })

      const want = s.mode ? 'crosshair' : s.hover && E.ent(game, s.hover)?.team === 1 ? 'pointer' : 'default'
      if (want !== cursor) canvas.style.cursor = cursor = want

      miniT -= real
      if (miniT <= 0) {
        miniT = 0.1
        const mctx = mini.getContext('2d')
        mctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        drawMinimap(mctx, game, assets, s.cam, s.view, MINI)
      }
      hudT -= real
      if (hudT <= 0) {
        hudT = 0.1
        for (const id of s.sel) {
          const e = E.ent(game, id)
          if (!e || !E.visibleToPlayer(game, e)) s.sel.delete(id)
        }
        bump()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 명령 ──
  const sel = selected()
  const cmds = game.over ? [] : getCommands(game, s, sel)

  const runCmd = (c) => {
    if (c.disabled) {
      if (c.reason) say(c.reason)
      return
    }
    const err = c.run()
    if (typeof err === 'string') say(err)
    bump()
  }

  const setSel = (ids) => {
    s.sel = new Set(ids)
    s.menu = null
    s.mode = null
    bump()
  }

  const pointerPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    return { x, y, wx: x + s.cam.x, wy: y + s.cam.y }
  }

  const rightClick = (wx, wy) => {
    const own = ownSel()
    if (!own.length) return
    const target = E.entityAt(game, wx, wy)
    const kind = E.smartOrder(game, own, wx, wy, target)
    if (kind || own.some((b) => b.cat === 'building')) mark(wx, wy, kind === 'attack' ? '#ff5a4f' : '#3ddc84')
  }

  const modeClick = (wx, wy, shift) => {
    const m = s.mode
    const own = ownSel()
    const units = own.filter((e) => e.cat === 'unit')
    if (m.kind === 'build') {
      const spot = buildSpot(m.type, wx, wy)
      const cx = (spot.tx + BUILDINGS[m.type].w / 2) * TILE
      const cy = (spot.ty + BUILDINGS[m.type].h / 2) * TILE
      const workers = units.filter((u) => UNITS[u.type].worker).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))
      const w = workers.find((x) => x.order.t !== 'build' && x.order.t !== 'construct') ?? workers[0]
      if (!w) {
        s.mode = null
        return
      }
      const err = E.orderBuild(game, w, m.type, spot.tx, spot.ty)
      if (err) say(err)
      else {
        mark(cx, cy, '#3ddc84')
        if (!shift) s.mode = null
      }
      return
    }
    const t = E.entityAt(game, wx, wy)
    if (m.cmd === 'attack') {
      if (t && t.team === 1) E.orderAttack(game, units, t)
      else E.orderMove(game, units, wx, wy, true)
      mark(wx, wy, '#ff5a4f')
    } else if (m.cmd === 'move') {
      E.orderMove(game, units, wx, wy)
      mark(wx, wy, '#3ddc84')
    } else if (m.cmd === 'gather') {
      const ok = t && ((t.cat === 'res' && t.type === 'mineral') || (t.type === 'refinery' && t.team === 0 && t.done))
      if (!ok) return say('종이 더미나 다 지은 잉크 공방을 고르세요')
      E.orderGather(game, units, t)
      mark(t.x, t.y, '#f5d76e')
    } else if (m.cmd === 'rally') {
      for (const b of own) if (b.cat === 'building' && BUILDINGS[b.type].trains) b.rally = t?.cat === 'res' ? { x: t.x, y: t.y, id: t.id } : { x: wx, y: wy }
      mark(wx, wy, '#3ddc84')
    }
    if (!shift) s.mode = null
  }

  const finishDrag = () => {
    const d = s.drag
    s.drag = null
    if (Math.hypot(d.x1 - d.x0, d.y1 - d.y0) < 5) {
      const e = E.entityAt(game, d.x0 + s.cam.x, d.y0 + s.cam.y)
      const now = performance.now()
      if (!e) {
        if (!d.shift) setSel([])
        return
      }
      const dbl = s.lastClick && s.lastClick.id === e.id && now - s.lastClick.t < 350
      s.lastClick = { id: e.id, t: now }
      if ((dbl || d.ctrl) && e.team === 0 && e.cat === 'unit') {
        const same = game.list.filter((u) => u.cat === 'unit' && u.team === 0 && u.type === e.type && onScreen(u)).map((u) => u.id)
        setSel(d.shift ? [...s.sel, ...same] : same)
      } else if (d.shift && e.team === 0 && e.cat === 'unit' && selected().every((x) => x.team === 0 && x.cat === 'unit')) {
        const next = new Set(s.sel)
        if (next.has(e.id)) next.delete(e.id)
        else next.add(e.id)
        setSel(next)
      } else setSel([e.id])
      return
    }
    const us = E.unitsInRect(game, d.x0 + s.cam.x, d.y0 + s.cam.y, d.x1 + s.cam.x, d.y1 + s.cam.y)
    // 군대와 사서가 섞이면 군대만
    const army = us.filter((u) => !UNITS[u.type].worker)
    const pick = (army.length ? army : us).map((u) => u.id)
    if (pick.length || !d.shift) setSel(d.shift ? [...s.sel, ...pick] : pick)
  }

  const onPointerDown = (e) => {
    rootRef.current.focus({ preventScroll: true })
    const p = pointerPos(e)
    if (e.button === 1) {
      e.preventDefault()
      s.pan = { x: e.clientX, y: e.clientY, cx: s.cam.x, cy: s.cam.y }
      e.currentTarget.setPointerCapture(e.pointerId)
      return
    }
    if (game.over) return
    if (e.button === 2) {
      if (s.mode) s.mode = null
      else rightClick(p.wx, p.wy)
      bump()
      return
    }
    if (e.button !== 0) return
    if (s.mode) {
      modeClick(p.wx, p.wy, e.shiftKey)
      bump()
      return
    }
    s.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const p = pointerPos(e)
    s.mouse = { x: p.x, y: p.y, in: true }
    if (s.pan) {
      s.cam.x = s.pan.cx - (e.clientX - s.pan.x)
      s.cam.y = s.pan.cy - (e.clientY - s.pan.y)
      clampCam()
      return
    }
    if (s.drag) {
      s.drag.x1 = p.x
      s.drag.y1 = p.y
    }
    s.hover = E.entityAt(game, p.wx, p.wy)?.id ?? 0
  }

  const onPointerUp = () => {
    if (s.pan) s.pan = null
    if (s.drag) finishDrag()
  }

  // ── 미니맵 ──
  const miniPos = (e) => {
    const r = miniRef.current.getBoundingClientRect()
    return { wx: ((e.clientX - r.left) / r.width) * WORLD_W, wy: ((e.clientY - r.top) / r.height) * WORLD_H }
  }
  const onMiniDown = (e) => {
    rootRef.current.focus({ preventScroll: true })
    const p = miniPos(e)
    if (e.button === 2) {
      if (!game.over) rightClick(p.wx, p.wy)
      return
    }
    if (e.button !== 0) return
    if (s.mode?.kind === 'target' && !game.over) {
      modeClick(p.wx, p.wy, e.shiftKey)
      bump()
      return
    }
    s.miniDrag = true
    e.currentTarget.setPointerCapture(e.pointerId)
    centerOn(p.wx, p.wy)
  }
  const onMiniMove = (e) => {
    if (!s.miniDrag) return
    const p = miniPos(e)
    centerOn(p.wx, p.wy)
  }

  // ── 키보드 ──
  const onKeyDown = (e) => {
    if (e.metaKey) return
    const k = e.key
    if (k === 'F10' || k === 'Pause') {
      e.preventDefault()
      if (!game.over) s.paused = !s.paused
      return bump()
    }
    if (k.startsWith('Arrow')) {
      e.preventDefault()
      s.keys.add(k)
      return
    }
    if (game.over) return
    if (k === 'Escape') {
      e.preventDefault()
      if (s.mode) s.mode = null
      else if (s.menu) s.menu = null
      else {
        const c = cmds.find((x) => x.hot === 'ESCAPE')
        if (c) runCmd(c)
      }
      return bump()
    }
    if (e.code.startsWith('Digit')) {
      e.preventDefault()
      const n = e.code.slice(5)
      const own = ownSel()
      if (e.ctrlKey || e.altKey) {
        if (!own.length) return
        s.groups[n] = own.map((x) => x.id)
        say(`${n}번 부대 지정 (${own.length})`)
      } else if (e.shiftKey) {
        s.groups[n] = [...new Set([...(s.groups[n] ?? []), ...own.map((x) => x.id)])]
      } else {
        const ids = (s.groups[n] ?? []).filter((id) => E.ent(game, id))
        if (!ids.length) return
        const now = performance.now()
        if (s.lastGroup?.n === n && now - s.lastGroup.t < 350) {
          const list = ids.map((id) => E.ent(game, id))
          centerOn(list.reduce((a, x) => a + x.x, 0) / list.length, list.reduce((a, x) => a + x.y, 0) / list.length)
        }
        s.lastGroup = { n, t: now }
        setSel(ids)
      }
      return bump()
    }
    if (k === 'F1') {
      e.preventDefault()
      const idle = game.list.filter((u) => u.team === 0 && u.cat === 'unit' && UNITS[u.type].worker && u.order.t === 'idle')
      if (!idle.length) return say('쉬는 사서가 없습니다')
      const w = idle[s.idleIdx++ % idle.length]
      setSel([w.id])
      centerOn(w.x, w.y)
      return
    }
    if (k === 'F2') {
      e.preventDefault()
      setSel(game.list.filter((u) => u.team === 0 && u.cat === 'unit' && !UNITS[u.type].worker).map((u) => u.id))
      return
    }
    if (k === ' ') {
      e.preventDefault()
      if (s.lastPing) centerOn(s.lastPing.x, s.lastPing.y)
      return
    }
    // 한글 입력 상태여도 되도록 물리 키(code)로 봅니다
    if (e.code.startsWith('Key') && !e.ctrlKey && !e.altKey) {
      const c = cmds.find((x) => x.hot === e.code.slice(3))
      if (c) {
        e.preventDefault()
        runCmd(c)
      }
    }
  }

  const exit = async () => {
    if (game.over) return onExit()
    const was = s.paused
    s.paused = true
    bump()
    if (await confirmDialog({ title: '게임을 그만둘까요?', message: '이번 판은 기록에 남지 않습니다.', confirmLabel: '그만두기', destructive: true })) onExit()
    else s.paused = was
    bump()
  }

  const ai = aiState(game)
  const msgs = game.msgs.filter((m) => game.time - m.t < 4.5)
  const t0 = game.teams[0]
  const t1 = game.teams[1]

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={(e) => s.keys.delete(e.key)}
      onBlur={() => s.keys.clear()}
      onContextMenu={(e) => e.preventDefault()}
      className="flex h-full select-none flex-col bg-[#15110e] text-white outline-none"
    >
      <TopBar
        game={game}
        ui={s}
        nextWave={ai.nextWave}
        onTogglePause={() => {
          if (!game.over) s.paused = !s.paused
          bump()
        }}
        onSpeed={() => {
          s.speed = s.speed === 1 ? 1.5 : s.speed === 1.5 ? 2 : 1
          bump()
        }}
        onExit={exit}
      />

      <div ref={viewRef} className="relative min-h-0 flex-1 overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 size-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => {
            s.mouse.in = false
            s.hover = 0
          }}
        />

        <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-1">
          {msgs.map((m, i) => (
            <div key={`${m.t}-${i}`} className="rounded-md bg-black/60 px-3 py-1 text-[13px] font-medium text-white shadow">
              {m.text}
            </div>
          ))}
        </div>

        {s.mode && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <div className="rounded-md bg-black/60 px-3 py-1 text-[12px] text-white/85">
              {s.mode.kind === 'build'
                ? `${BUILDINGS[s.mode.type].names[0]}을(를) 지을 곳을 고르세요 · Shift 로 여러 개 · 오른쪽 클릭이나 Esc 로 취소`
                : { attack: '공격할 대상이나 지점을 고르세요', move: '이동할 곳을 고르세요', gather: '종이 더미나 잉크 공방을 고르세요', rally: '집결지를 고르세요' }[s.mode.cmd]}
            </div>
          </div>
        )}

        {!game.over && (s.paused || s.auto) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
            {s.paused ? (
              <button
                onClick={() => {
                  s.paused = false
                  bump()
                }}
                className="flex items-center gap-2 rounded-xl bg-white/12 px-5 py-3 text-[15px] font-semibold ring-1 ring-white/20 hover:bg-white/20"
              >
                <PlayIcon size={18} weight="fill" /> 일시정지 · 계속하기
              </button>
            ) : (
              <span className="rounded-xl bg-black/50 px-4 py-2 text-[13px] text-white/80">다른 창을 보는 동안 멈춰 있습니다. 이 창을 누르면 이어집니다</span>
            )}
          </div>
        )}

        {game.over && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/55 backdrop-blur-[3px]">
            <div className="w-[340px] rounded-2xl bg-[#221b16]/95 p-6 text-center shadow-2xl ring-1 ring-white/10">
              <TrophyIcon size={40} weight="duotone" className={game.over.winner === 0 ? 'mx-auto text-[#ffd25a]' : 'mx-auto text-white/30'} />
              <h2 className="mt-2 text-[22px] font-bold">{game.over.winner === 0 ? '승리!' : '패배'}</h2>
              <p className="mt-1 text-[13px] text-white/60">
                {game.over.winner === 0 ? '벌레 둥지를 모두 무너뜨렸습니다' : '도서관이 벌레에게 먹혔습니다'} · {DIFFICULTIES[difficulty].label} · {clock(game.over.time)}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-left text-[12px]">
                {[
                  ['만든 유닛', t0.stats.made, t1.stats.made],
                  ['처치', t0.stats.killed, t1.stats.killed],
                  ['잃음', t0.stats.lost, t1.stats.lost],
                  ['모은 자원', t0.stats.gathered, t1.stats.gathered],
                ].map(([label, a, b]) => (
                  <div key={label} className="col-span-2 flex justify-between border-b border-white/5 py-1">
                    <dt className="text-white/55">{label}</dt>
                    <dd className="tabular-nums">
                      <span className="text-[#7fb2ee]">{a}</span>
                      <span className="text-white/30"> : </span>
                      <span className="text-[#f6a77f]">{b}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              {s.result && (
                <p className="mt-3 text-[12px] text-white/50">
                  이 난이도 {s.result.wins}승 {s.result.losses}패{s.result.best != null && ` · 최고 기록 ${clock(s.result.best)}`}
                </p>
              )}
              <div className="mt-5 flex gap-2">
                <button onClick={onExit} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/10 py-2 text-[13px] font-medium hover:bg-white/15">
                  <ListIcon size={15} /> 메뉴
                </button>
                <button onClick={onRestart} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#2f7de1] py-2 text-[13px] font-semibold hover:bg-[#3b8af0]">
                  <ArrowCounterClockwiseIcon size={15} /> 다시 하기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex h-[156px] shrink-0 gap-2 border-t border-white/10 bg-[#1f1915] p-2.5">
        <canvas
          ref={miniRef}
          style={{ width: MINI, height: MINI }}
          className="shrink-0 cursor-pointer rounded-md ring-1 ring-white/15"
          onPointerDown={onMiniDown}
          onPointerMove={onMiniMove}
          onPointerUp={() => (s.miniDrag = false)}
        />
        <div className="flex min-w-0 flex-1 rounded-lg bg-black/20">
          <SelectionPanel
            game={game}
            sel={sel}
            onPick={(e, shift) => setSel(shift ? [...s.sel].filter((id) => id !== e.id) : [e.id])}
            onCancelQueue={(b, i) => {
              if (b.team === 0) E.cancelQueue(game, b, i)
              bump()
            }}
          />
        </div>
        <CommandCard game={game} cmds={cmds} onRun={runCmd} />
      </div>
    </div>
  )
}
