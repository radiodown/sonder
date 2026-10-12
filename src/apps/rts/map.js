import { MAP_H, MAP_W } from './data'

/**
 * 고정 맵 하나. 왼쪽 아래가 도서관(플레이어), 오른쪽 위가 벌레(AI).
 * 플레이어 쪽 절반만 적고 점대칭으로 뒤집어 양쪽을 똑같이 만듭니다.
 */

/** 장애물 사각형 [x, y, w, h] (타일) */
const WALLS = [
  // 본진 언덕: 동쪽 벽(입구 y 41~44 만 뚫림)과 북쪽 벽
  [20, 38, 2, 3],
  [20, 45, 2, 19],
  [0, 38, 20, 2],
  // 앞마당과 중앙 사이 바위
  [26, 44, 4, 3],
  [40, 50, 3, 6],
  [44, 40, 4, 3],
  // 3시 확장 쪽 바위
  [12, 28, 4, 4],
  [0, 20, 2, 18],
  // 중앙 서가
  [29, 29, 6, 6],
  [24, 34, 3, 2],
]

/** 기지 자리. hq: 도서관 자리, minerals: 종이 더미 [x, y] (2x1), geyser: 잉크 샘 [x, y] (2x2) */
const BASES = [
  {
    hq: [7, 52],
    minerals: [[2, 47], [2, 49], [2, 51], [2, 53], [2, 55], [2, 57], [4, 59]],
    geyser: [9, 58],
  },
  {
    hq: [30, 53],
    minerals: [[26, 60], [28, 60], [30, 60], [32, 60], [34, 60], [36, 59]],
    geyser: [37, 53],
  },
  {
    hq: [6, 26],
    minerals: [[2, 22], [2, 24], [2, 26], [2, 28], [2, 30], [4, 32]],
    geyser: [7, 21],
  },
]

/** AI 가 건물을 지을 자리 (플레이어 쪽 좌표로 적고 뒤집어 씁니다) */
export const AI_SLOTS = {
  supply: [[13, 61], [16, 61], [10, 61], [7, 61], [17, 57], [1, 61], [4, 40], [1, 40], [7, 40], [14, 54], [17, 54]],
  barracks: [[9, 44], [13, 47]],
  lab: [[5, 43]],
  factory: [[13, 51], [9, 47]],
  armory: [[10, 40]],
  starport: [[13, 43], [16, 50]],
  turret: [[17, 40], [17, 46], [12, 57]],
  hq: [[7, 52], [30, 53]],
}

/** 본진 입구 바로 안쪽 (AI 군대 집결지) */
export const RAMP_INSIDE = [17, 43]

const mirrorRect = (x, y, w, h) => [MAP_W - x - w, MAP_H - y - h]

/** 플레이어 쪽 좌표를 팀 쪽 좌표로 */
export function teamRect(team, x, y, w, h) {
  return team === 0 ? [x, y] : mirrorRect(x, y, w, h)
}

export function buildMap() {
  const terrain = new Uint8Array(MAP_W * MAP_H)
  const fill = (x, y, w, h) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (i >= 0 && j >= 0 && i < MAP_W && j < MAP_H) terrain[j * MAP_W + i] = 1
    }
  }
  for (const [x, y, w, h] of WALLS) {
    fill(x, y, w, h)
    fill(...mirrorRect(x, y, w, h), w, h)
  }

  const minerals = []
  const geysers = []
  const hqSpots = []
  for (const team of [0, 1]) {
    for (const b of BASES) {
      hqSpots.push({ team, start: b === BASES[0], pos: teamRect(team, ...b.hq, 4, 3) })
      for (const [x, y] of b.minerals) minerals.push(teamRect(team, x, y, 2, 1))
      geysers.push(teamRect(team, ...b.geyser, 2, 2))
    }
  }
  return { terrain, minerals, geysers, hqSpots }
}
