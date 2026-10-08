import { useSyncExternalStore } from 'react'
import { useSettings } from '../stores/settings'

const QUERY = '(pointer: coarse) and (max-width: 1024px), (max-width: 700px)'

function subscribe(cb) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

const getSnapshot = () => window.matchMedia(QUERY).matches

/** 'desktop' | 'mobile'. URL 에 ?platform=mobile 로 강제할 수도 있습니다. */
export function usePlatform() {
  const auto = useSyncExternalStore(subscribe, getSnapshot)
  const pref = useSettings((s) => s.platform)
  const forced = new URLSearchParams(window.location.search).get('platform')
  if (forced === 'mobile' || forced === 'desktop') return forced
  if (pref !== 'auto') return pref
  return auto ? 'mobile' : 'desktop'
}
