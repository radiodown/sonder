/**
 * iOS Safari 의 가장자리 스와이프 뒤로가기 감지.
 * 브라우저가 이미 화면을 밀어내는 애니메이션을 보여 줬으므로, 그때는 앱의 닫힘 애니메이션을 건너뜁니다.
 * (가장자리에서 시작한 터치 직후에 popstate 가 오면 스와이프 뒤로가기로 봅니다.
 *  앱이 직접 뒤로 간 경우 — 뒤로 버튼, 앱의 스와이프 — 는 markAppBack() 으로 빼 둡니다)
 */
const EDGE = 30 // 화면 왼쪽 가장자리 폭(px)
const WINDOW = 800 // 터치가 끝나고 이 시간 안에 온 popstate 까지 인정(ms)

let edgeTouch = false
let edgeTouchEndedAt = 0
let swipePopAt = 0
let appBackAt = 0

if (typeof window !== 'undefined') {
  const opts = { capture: true, passive: true }
  window.addEventListener('touchstart', (e) => (edgeTouch = e.touches[0]?.clientX < EDGE), opts)
  const end = () => {
    if (edgeTouch) edgeTouchEndedAt = performance.now()
    edgeTouch = false
  }
  window.addEventListener('touchend', end, opts)
  window.addEventListener('touchcancel', end, opts)
  // 라우터보다 먼저 등록되어 먼저 불립니다
  window.addEventListener('popstate', () => {
    if (performance.now() - appBackAt < WINDOW) return
    if (edgeTouch || performance.now() - edgeTouchEndedAt < WINDOW) swipePopAt = performance.now()
  })
}

/** 방금 일어난 뒤로가기가 브라우저 스와이프였는지 */
export function wasSwipeBack() {
  return performance.now() - swipePopAt < 1000
}

/** 앱이 스스로 뒤로 갈 때 부릅니다 (이때는 앱의 닫힘 애니메이션을 그대로 보여 줌) */
export function markAppBack() {
  appBackAt = performance.now()
  swipePopAt = 0
}
