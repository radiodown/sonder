/**
 * 책벌레 전쟁의 규칙 표. 두 팀(도서관·벌레)은 이름만 다르고 건물·유닛·업그레이드가 똑같습니다.
 * 거리는 px (1타일 = 32px), 시간은 초.
 */

export const TILE = 32
export const MAP_W = 64
export const MAP_H = 64
export const MAX_SUPPLY = 200

export const TEAMS = [
  { name: '도서관', color: '#2f7de1', dark: '#1d4f91', light: '#9cc3f2' },
  { name: '벌레', color: '#d9480f', dark: '#8a2c06', light: '#f6a77f' },
]

/** 종이 = 미네랄, 잉크 = 가스 */
export const RES = { paper: '종이', ink: '잉크' }

/**
 * 유닛.
 * attack.range 는 몸 가장자리끼리의 거리. air/ground 는 공격할 수 있는 대상.
 * upg: 어느 업그레이드를 받는지 ('inf' 보병, 'veh' 기계, 'ship' 비행). wpn: 공격력 업그레이드 1단계당 오르는 양
 */
export const UNITS = {
  worker: {
    names: ['사서', '일벌레'],
    hp: 40, armor: 0, speed: 88, r: 7, sight: 7,
    cost: [50, 0], time: 12, supply: 1, from: 'hq', hot: 'Q',
    attack: { dmg: 5, cd: 1.1, range: 6, ground: true },
    worker: true, upg: 'inf', wpn: 0,
    desc: '종이와 잉크를 모으고 건물을 짓습니다.',
  },
  ranged: {
    names: ['연필병', '침벌레'],
    hp: 45, armor: 0, speed: 76, r: 7, sight: 8,
    cost: [50, 0], time: 15, supply: 1, from: 'barracks', hot: 'Q',
    attack: { dmg: 6, cd: 0.86, range: 128, ground: true, air: true },
    upg: 'inf', wpn: 1,
    desc: '지상과 공중을 모두 쏘는 기본 보병.',
  },
  melee: {
    names: ['사전병', '턱벌레'],
    hp: 110, armor: 1, speed: 86, r: 8, sight: 7,
    cost: [75, 25], time: 18, supply: 2, from: 'barracks', hot: 'W',
    attack: { dmg: 14, cd: 1.2, range: 6, ground: true },
    upg: 'inf', wpn: 2,
    desc: '튼튼한 근접 보병. 공중은 못 때립니다.',
  },
  tank: {
    names: ['책수레 포', '폭탄딱정벌레'],
    hp: 160, armor: 1, speed: 58, r: 12, sight: 10,
    cost: [150, 100], time: 30, supply: 2, from: 'factory', hot: 'Q',
    attack: { dmg: 30, cd: 2.4, range: 224, ground: true, splash: 40 },
    upg: 'veh', wpn: 3,
    desc: '멀리서 지상을 포격합니다. 주변에도 피해.',
  },
  walker: {
    names: ['책장 골렘', '거미'],
    hp: 130, armor: 1, speed: 70, r: 11, sight: 9,
    cost: [125, 50], time: 26, supply: 2, from: 'factory', hot: 'W', req: ['armory'],
    attack: { dmg: 12, cd: 1, range: 160, ground: true, air: true, airDmg: 20, airRange: 224 },
    upg: 'veh', wpn: 1, airWpn: 2,
    desc: '대공에 강한 기계. 공중에는 더 멀리, 더 세게.',
  },
  fighter: {
    names: ['종이비행기', '말벌'],
    hp: 120, armor: 0, speed: 125, r: 10, sight: 9, air: true,
    cost: [150, 100], time: 32, supply: 2, from: 'starport', hot: 'Q',
    attack: { dmg: 10, cd: 1, range: 150, ground: true, air: true },
    upg: 'ship', wpn: 1,
    desc: '빠른 전투기. 지상과 공중을 모두 공격.',
  },
  bomber: {
    names: ['비행선', '장수풍뎅이'],
    hp: 220, armor: 1, speed: 78, r: 14, sight: 9, air: true,
    cost: [200, 150], time: 40, supply: 3, from: 'starport', hot: 'W', req: ['armory'],
    attack: { dmg: 40, cd: 2.6, range: 110, ground: true, splash: 36 },
    upg: 'ship', wpn: 4,
    desc: '지상을 폭격하는 느린 비행 유닛.',
  },
}

/** 건물. w·h 는 타일 크기. req: 먼저 완성돼 있어야 하는 건물 */
export const BUILDINGS = {
  hq: {
    names: ['도서관', '둥지'],
    w: 4, h: 3, hp: 1500, armor: 1, sight: 10,
    cost: [400, 0], time: 60, supply: 10, hot: 'C',
    trains: ['worker'], depot: true,
    desc: '본부. 사서를 만들고 자원을 받습니다.',
  },
  supply: {
    names: ['서가', '알무더기'],
    w: 2, h: 2, hp: 400, armor: 1, sight: 6,
    cost: [100, 0], time: 20, supply: 8, hot: 'S',
    desc: '인구수 +8',
  },
  refinery: {
    names: ['잉크 공방', '수액 빨대'],
    w: 2, h: 2, hp: 500, armor: 1, sight: 6,
    cost: [75, 0], time: 20, onGeyser: true, hot: 'R',
    desc: '잉크 샘 위에 짓습니다. 잉크를 캘 수 있게 됩니다.',
  },
  barracks: {
    names: ['열람실', '번데기 굴'],
    w: 3, h: 3, hp: 1000, armor: 1, sight: 7,
    cost: [150, 0], time: 40, req: ['hq'], hot: 'B',
    trains: ['ranged', 'melee'], research: ['stim', 'range'],
    desc: '보병을 만듭니다.',
  },
  lab: {
    names: ['연구실', '진화 굴'],
    w: 3, h: 2, hp: 850, armor: 1, sight: 7,
    cost: [125, 0], time: 35, req: ['hq'], hot: 'E',
    research: ['infWeapon', 'infArmor'],
    desc: '보병 공격력·방어력을 연구합니다. 감시탑을 지을 수 있게 됩니다.',
  },
  turret: {
    names: ['감시탑', '가시 촉수'],
    w: 2, h: 2, hp: 350, armor: 0, sight: 9,
    cost: [100, 0], time: 22, req: ['lab'], hot: 'T',
    attack: { dmg: 12, cd: 1, range: 200, ground: true, air: true },
    desc: '지상과 공중을 공격하는 방어 건물.',
  },
  factory: {
    names: ['제본소', '갑각 공방'],
    w: 3, h: 3, hp: 1250, armor: 1, sight: 7,
    cost: [200, 100], time: 50, req: ['barracks'], hot: 'F',
    trains: ['tank', 'walker'], research: ['siege'],
    desc: '기계 유닛을 만듭니다.',
  },
  armory: {
    names: ['인쇄소', '외피 공방'],
    w: 3, h: 2, hp: 750, armor: 1, sight: 7,
    cost: [100, 50], time: 45, req: ['factory'], hot: 'A',
    research: ['vehWeapon', 'shipWeapon', 'plating'],
    desc: '기계·비행 업그레이드. 골렘과 비행선을 열어 줍니다.',
  },
  starport: {
    names: ['격납고', '날개 둥지'],
    w: 3, h: 3, hp: 1300, armor: 1, sight: 7,
    cost: [150, 100], time: 45, req: ['factory'], hot: 'P',
    trains: ['fighter', 'bomber'], research: ['engine'],
    desc: '비행 유닛을 만듭니다.',
  },
}

/** 일꾼의 건설 메뉴 순서 */
export const BUILD_MENU = ['hq', 'supply', 'refinery', 'barracks', 'lab', 'turret', 'factory', 'armory', 'starport']

const step = (base, inc) => (lv) => [base[0] + inc * (lv - 1), base[1] + inc * (lv - 1)]

/** 업그레이드. levels 단계까지. cost(lv)·time(lv) 는 다음 단계 값 */
export const UPGRADES = {
  infWeapon: { name: '보병 공격력', levels: 3, cost: step([100, 100], 75), time: (lv) => 60 + 15 * (lv - 1), hot: 'Q', desc: '사서·보병 공격력 증가' },
  infArmor: { name: '보병 방어력', levels: 3, cost: step([100, 100], 75), time: (lv) => 60 + 15 * (lv - 1), hot: 'W', desc: '사서·보병 방어력 +1' },
  vehWeapon: { name: '기계 공격력', levels: 3, cost: step([100, 100], 75), time: (lv) => 65 + 15 * (lv - 1), hot: 'Q', desc: '포·골렘 공격력 증가' },
  shipWeapon: { name: '비행 공격력', levels: 3, cost: step([100, 100], 75), time: (lv) => 65 + 15 * (lv - 1), hot: 'W', desc: '비행 유닛 공격력 증가' },
  plating: { name: '기계·비행 장갑', levels: 3, cost: step([150, 150], 75), time: (lv) => 65 + 15 * (lv - 1), hot: 'E', desc: '기계·비행 유닛 방어력 +1' },
  stim: { name: '전투 자극', levels: 1, cost: () => [100, 100], time: () => 60, hot: 'E', desc: '보병 공격 속도 +50%, 이동 속도 +30%' },
  range: { name: '긴 연필', levels: 1, cost: () => [150, 150], time: () => 60, hot: 'R', desc: '연필병 사거리 +32' },
  siege: { name: '포격 모드', levels: 1, cost: () => [150, 150], time: () => 70, hot: 'E', desc: '포 사거리 +64, 공격력 +10' },
  engine: { name: '엔진 강화', levels: 1, cost: () => [100, 100], time: () => 60, hot: 'E', desc: '비행 유닛 이동 속도 +30%' },
}

/**
 * 난이도. income: AI 가 한 번에 캐는 양 배율, firstWave/interval: 습격 시각(초),
 * upgradeLimit: AI 가 올리는 공격력·방어력 최대 단계
 */
export const DIFFICULTIES = {
  easy: { label: '쉬움', income: 0.7, firstWave: 330, interval: 170, maxWorkers: 14, upgradeLimit: 1, startBonus: 0, desc: '첫 습격 5분 30초, 이후 2분 50초마다' },
  normal: { label: '보통', income: 1, firstWave: 270, interval: 140, maxWorkers: 18, upgradeLimit: 2, startBonus: 0, desc: '첫 습격 4분 30초, 이후 2분 20초마다' },
  hard: { label: '어려움', income: 1.35, firstWave: 210, interval: 110, maxWorkers: 22, upgradeLimit: 3, startBonus: 150, desc: '첫 습격 3분 30초, 이후 1분 50초마다. 벌레가 더 빨리 모읍니다' },
}

/** 업그레이드 반영한 공격력·방어력·사거리·속도 */
export function unitStats(type, ups) {
  const d = UNITS[type]
  const a = d.attack
  const lvW = d.upg === 'inf' ? ups.infWeapon : d.upg === 'veh' ? ups.vehWeapon : ups.shipWeapon
  const lvA = d.upg === 'inf' ? ups.infArmor : ups.plating
  const bio = d.upg === 'inf' && !d.worker
  const stim = bio && ups.stim ? 1 : 0
  let range = a.range
  let dmg = a.dmg + lvW * d.wpn
  if (type === 'ranged' && ups.range) range += 32
  if (type === 'tank' && ups.siege) {
    range += 64
    dmg += 10
  }
  return {
    dmg,
    airDmg: a.airDmg != null ? a.airDmg + lvW * (d.airWpn ?? d.wpn) : dmg,
    range,
    airRange: a.airRange ?? range,
    cd: a.cd / (stim ? 1.5 : 1),
    armor: d.armor + lvA,
    speed: d.speed * (stim ? 1.3 : 1) * (d.air && ups.engine ? 1.3 : 1),
  }
}

export const unitName = (type, team) => UNITS[type].names[team]
export const buildingName = (type, team) => BUILDINGS[type].names[team]
