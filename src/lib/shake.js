/**
 * 폰 흔들기 감지.
 * iOS 는 움직임 센서를 쓰려면 사용자 동작(탭) 안에서 권한을 받아야 합니다 → enableShake() 를 탭 처리기에서 부르세요.
 * Android 등 권한이 필요 없는 곳은 enableShake() 를 언제 불러도 바로 켜집니다.
 */
const THRESHOLD = 18 // m/s². 중력을 뺀 가속도가 이보다 크면 흔든 것으로 봅니다
const COOLDOWN = 1200 // 한 번 흔든 뒤 이만큼은 무시 (ms)

const listeners = new Set()
let installed = false
let last = 0

function onMotion(e) {
  const a = e.acceleration ?? e.accelerationIncludingGravity
  if (!a) return
  // accelerationIncludingGravity 만 주는 기기는 중력(약 9.8)을 대충 빼 줍니다
  const g = e.acceleration ? 0 : 9.8
  const force = Math.abs(Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0) - g)
  const now = performance.now()
  if (force < THRESHOLD || now - last < COOLDOWN) return
  last = now
  for (const fn of listeners) fn()
}

/** 센서를 켭니다. 켜졌으면 true. (iOS 에서 거절하면 false) */
export async function enableShake() {
  if (installed) return true
  if (typeof DeviceMotionEvent === 'undefined') return false
  try {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      if ((await DeviceMotionEvent.requestPermission()) !== 'granted') return false
    }
  } catch {
    return false
  }
  window.addEventListener('devicemotion', onMotion)
  installed = true
  return true
}

/** 흔들 때마다 fn 을 부릅니다. 해제 함수를 돌려줍니다 */
export function onShake(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
