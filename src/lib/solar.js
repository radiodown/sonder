import { useEffect, useState } from 'react'

/**
 * macOS Mojave 의 "Solar Gradients" 같은 배경화면.
 * 무늬 없이 색 그라데이션만 있고, 해의 위치에 따라 하루 동안 새벽 → 낮 → 노을 → 밤으로 천천히 바뀝니다.
 *
 * 해 뜨고 지는 시각은 위치 권한 없이 서울(북위 37.5°)과 한국 표준시 기준 태양 남중(약 12:30)으로 어림합니다.
 * 계절에 따라 낮 길이가 달라집니다 (하지 약 14.7시간, 동지 약 9.6시간).
 */

const LAT = (37.5 * Math.PI) / 180
const SOLAR_NOON = 12.5 * 60 // 분

/** 오늘의 해 뜨는·지는 시각 (자정부터 분) */
function sunTimes(date) {
  const start = new Date(date.getFullYear(), 0, 0)
  const day = Math.floor((date - start) / 86_400_000)
  const decl = ((23.44 * Math.PI) / 180) * Math.sin(((2 * Math.PI) / 365) * (day - 81))
  // 해가 지평선에 걸리는 시간각 (대기 굴절 보정 -0.83°)
  const cosH = (Math.sin((-0.83 * Math.PI) / 180) - Math.sin(LAT) * Math.sin(decl)) / (Math.cos(LAT) * Math.cos(decl))
  const half = ((Math.acos(Math.min(1, Math.max(-1, cosH))) * 180) / Math.PI) * 4 // 1° = 4분
  return { sunrise: SOLAR_NOON - half, sunset: SOLAR_NOON + half }
}

// 하루의 단계. colors 는 [위 · 가운데 · 아래(지평선)], at 은 해 뜨는/지는 시각(또는 남중) 기준 분.
// 설정에서 한 단계로 고정할 수도 있습니다 (solarTime).
const NIGHT = ['#04060e', '#0a1230', '#18204a']
export const SOLAR_PHASES = [
  { id: 'dawn', label: '여명', from: 'sunrise', at: -40, colors: ['#151a44', '#3f3672', '#a8648c'] },
  { id: 'sunrise', label: '해돋이', from: 'sunrise', at: 0, colors: ['#33498f', '#c9849f', '#ffad7a'] },
  { id: 'morning', label: '아침', from: 'sunrise', at: 90, colors: ['#4c8bd4', '#9cc5ee', '#ffe1c4'] },
  { id: 'noon', label: '한낮', from: 'noon', at: 0, colors: ['#2b7ae0', '#6cb1f4', '#c8e5ff'] },
  { id: 'afternoon', label: '오후', from: 'sunset', at: -120, colors: ['#3779cc', '#86b6e8', '#ffe0b6'] },
  { id: 'golden', label: '황금빛', from: 'sunset', at: -40, colors: ['#3b5ba4', '#de946a', '#ffc369'] },
  { id: 'sunset', label: '노을', from: 'sunset', at: 0, colors: ['#29296a', '#a94c7c', '#ff875a'] },
  { id: 'dusk', label: '땅거미', from: 'sunset', at: 40, colors: ['#121843', '#462c6b', '#934670'] },
  { id: 'night', label: '밤', from: 'sunset', at: 100, colors: NIGHT },
]
// 시간 흐름용: 해 뜨기 전 밤 + 위 단계들
const KEYS = [{ from: 'sunrise', at: -100, colors: NIGHT }, ...SOLAR_PHASES]

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a, b, t) => {
  const [x, y] = [hex(a), hex(b)]
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(' ')})`
}
// 부드럽게 넘어가도록 (양 끝에서 천천히)
const ease = (t) => t * t * (3 - 2 * t)

/** 그 시각의 [위, 가운데, 아래] 색 */
export function solarColors(date = new Date()) {
  const { sunrise, sunset } = sunTimes(date)
  const base = { sunrise, noon: (sunrise + sunset) / 2, sunset }
  const keys = KEYS.map((k) => ({ t: base[k.from] + k.at, colors: k.colors }))
  const now = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60
  // 마지막 밤 → 다음 날 첫 밤까지는 그대로 밤
  if (now <= keys[0].t || now >= keys.at(-1).t) return NIGHT
  const i = keys.findIndex((k) => k.t > now)
  const [a, b] = [keys[i - 1], keys[i]]
  const t = ease((now - a.t) / (b.t - a.t))
  return a.colors.map((c, j) => mix(c, b.colors[j], t))
}

/** CSS background 값. phase 를 주면 그 단계로 고정합니다 ('auto' 또는 없으면 시각대로) */
export function solarBackground(date, phase = 'auto') {
  const fixed = SOLAR_PHASES.find((p) => p.id === phase)
  const [top, mid, bottom] = fixed ? fixed.colors : solarColors(date)
  return [
    // 지평선 쪽이 은은하게 밝아 보이도록
    `radial-gradient(130% 70% at 50% 105%, ${bottom}, transparent 70%)`,
    `linear-gradient(to bottom, ${top}, ${mid} 62%, ${bottom})`,
  ].join(', ')
}

/** 1분마다 다시 계산한 배경 (바뀌는 폭이 아주 작아서 넘어가는 게 눈에 띄지 않습니다) */
export function useSolarBackground(enabled = true, phase = 'auto') {
  const [now, setNow] = useState(() => new Date())
  const ticking = enabled && phase === 'auto'
  useEffect(() => {
    if (!ticking) return
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [ticking])
  return enabled ? solarBackground(now, phase) : undefined
}
