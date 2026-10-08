/**
 * 홈 화면에 추가해서 실행했는지 (주소창 없는 앱 모드).
 * iOS 는 navigator.standalone, 그 외는 display-mode 미디어 쿼리로 알 수 있습니다.
 * <html data-standalone> 를 붙여 CSS 에서 앱 모드 전용 배치를 씁니다.
 */
export function markStandalone() {
  const standalone = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
  if (standalone) document.documentElement.dataset.standalone = ''
}
