import { useEffect, useState } from 'react'

/**
 * 화면에 실제로 보이는 영역(visualViewport)의 아래쪽 위치.
 * iOS 는 키보드가 올라와도 레이아웃 크기가 그대로라, 키보드 위에 붙이려면 이 값을 따라가야 합니다.
 */
export function useVisibleBottom() {
  const read = () => {
    const vv = window.visualViewport
    if (!vv) return { bottom: window.innerHeight, keyboard: false }
    // 보이는 높이가 창보다 눈에 띄게 작으면 키보드가 올라온 것
    return { bottom: vv.offsetTop + vv.height, keyboard: window.innerHeight - vv.height > 80 }
  }
  const [state, setState] = useState(read)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setState(read())
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return state
}
