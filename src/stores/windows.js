import { create } from 'zustand'
import { getApp, rootAppId } from '../apps/registry'

let seq = 0

/**
 * macOS 창 관리자.
 * key 가 같은 창이 이미 있으면 새로 열지 않고 앞으로 가져옵니다 (예: 같은 책의 상세 창).
 */
export const useWindows = create((set, get) => ({
  windows: [],
  topZ: 10,

  open(appId, props = {}) {
    const app = getApp(appId)
    const key = app.windowKey ? app.windowKey(props) : appId
    const existing = get().windows.find((w) => w.key === key)
    if (existing) {
      get().update(existing.id, { minimized: false, props: { ...existing.props, ...props } })
      get().focus(existing.id)
      return existing.id
    }
    const { width = 720, height = 480 } = app.size ?? {}
    const offset = (get().windows.length % 6) * 28
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = Math.min(width, vw - 32)
    const h = Math.min(height, vh - 130)
    const id = `w${++seq}`
    const z = get().topZ + 1
    set((s) => ({
      topZ: z,
      windows: [
        ...s.windows,
        {
          id,
          key,
          appId,
          props,
          x: Math.max(16, Math.round((vw - w) / 2) + offset),
          y: Math.max(40, Math.round((vh - h) / 2.6) + offset),
          width: w,
          height: h,
          z,
          minimized: false,
          maximized: false,
        },
      ],
    }))
    return id
  },

  close(id) {
    set((s) => ({ windows: s.windows.filter((w) => w.id !== id) }))
  },

  /** 앱 종료: 그 앱에 속한 창을 모두 닫습니다 */
  quitApp(appId) {
    set((s) => ({ windows: s.windows.filter((w) => rootAppId(w.appId) !== appId) }))
  },

  /** 앱 가리기: 그 앱에 속한 창을 모두 최소화합니다 */
  hideApp(appId) {
    set((s) => ({ windows: s.windows.map((w) => (rootAppId(w.appId) === appId ? { ...w, minimized: true } : w)) }))
  },

  /** 앱 보기: 최소화된 창까지 모두 펼치고 가장 위 창에 포커스 */
  showApp(appId) {
    const mine = get().windows.filter((w) => rootAppId(w.appId) === appId)
    if (mine.length === 0) return get().open(appId)
    set((s) => ({ windows: s.windows.map((w) => (rootAppId(w.appId) === appId ? { ...w, minimized: false } : w)) }))
    get().focus(mine.reduce((a, b) => (b.z > a.z ? b : a)).id)
  },

  focus(id) {
    const z = get().topZ + 1
    set((s) => ({ topZ: z, windows: s.windows.map((w) => (w.id === id ? { ...w, z } : w)) }))
  },

  update(id, patch) {
    set((s) => ({ windows: s.windows.map((w) => (w.id === id ? { ...w, ...patch } : w)) }))
  },

  minimize(id) {
    get().update(id, { minimized: true })
  },

  toggleMaximize(id) {
    const w = get().windows.find((x) => x.id === id)
    if (w) get().update(id, { maximized: !w.maximized })
  },
}))

/** 최소화되지 않은 창 중 가장 위에 있는 창 */
export function selectActive(s) {
  let top = null
  for (const w of s.windows) if (!w.minimized && (!top || w.z > top.z)) top = w
  return top
}
