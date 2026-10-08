import { useEffect } from 'react'
import { useSettings } from '../stores/settings'

/** <html data-theme> 와 data-refract 를 설정과 동기화합니다. */
export function useThemeSync() {
  const theme = useSettings((s) => s.theme)
  const refraction = useSettings((s) => s.refraction)

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

  useEffect(() => {
    // backdrop-filter 의 url() 은 Chromium 계열에서만 렌더링됩니다. Safari/Firefox 는 블러만.
    // userAgentData 는 Chromium 계열에만 있습니다 (iOS 의 Chrome 은 WebKit 이라 없음).
    const chromium = 'userAgentData' in navigator
    document.documentElement.dataset.refract = refraction && chromium ? 'on' : 'off'
  }, [refraction])
}
