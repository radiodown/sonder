/**
 * macOS 처럼 스크롤하는 동안만 스크롤바를 보여 줍니다.
 * 스크롤 중인 요소에 data-scrolling 을 붙이고, 멈춘 뒤 잠시 후 뗍니다. (스타일은 index.css)
 */
export function installScrollbarFade(delay = 900) {
  const timers = new WeakMap()
  document.addEventListener(
    'scroll',
    (e) => {
      const el = e.target === document ? document.documentElement : e.target
      if (!(el instanceof Element)) return
      if (!el.hasAttribute('data-scrolling')) el.setAttribute('data-scrolling', '')
      clearTimeout(timers.get(el))
      timers.set(el, setTimeout(() => el.removeAttribute('data-scrolling'), delay))
    },
    { capture: true, passive: true },
  )
}
