import { useEffect } from 'react'
import { glassOpacity, useSettings, windowOpacity } from '../stores/settings'

/** <html data-theme> 를 설정과 동기화하고, 유리 굴절을 쓸 수 있는 브라우저면 data-refract 를 켭니다. */
export function useThemeSync() {
  const theme = useSettings((s) => s.theme)
  const blur = useSettings((s) => s.glassBlur)
  const clarity = useSettings((s) => s.glassClarity)
  const winBlur = useSettings((s) => s.windowBlur)
  const winClarity = useSettings((s) => s.windowClarity)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#161618' : '#f2f2f7')
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  // 유리 흐림·투명도: index.css 의 --glass-blur / --glass-opacity 를 덮어씁니다
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--glass-blur', `${blur}px`)
    root.setProperty('--glass-opacity', String(glassOpacity(clarity)))
    root.setProperty('--surface-blur', `${winBlur}px`)
    root.setProperty('--surface-opacity', String(windowOpacity(winClarity)))
  }, [blur, clarity, winBlur, winClarity])

  useEffect(() => {
    // backdrop-filter 의 url() 은 Chromium 계열에서만 렌더링됩니다. Safari/Firefox 는 블러만.
    // userAgentData 는 Chromium 계열에만 있습니다 (iOS 의 Chrome 은 WebKit 이라 없음).
    const chromium = 'userAgentData' in navigator
    document.documentElement.dataset.refract = chromium ? 'on' : 'off'
  }, [])
}
