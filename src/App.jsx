import { usePlatform } from './lib/platform'
import { useThemeSync } from './lib/theme'
import { lazy, Suspense, useEffect } from 'react'
import { startDriveAutoSave } from './stores/drive'
import { RefractionFilter } from './ui/Glass'

// 플랫폼별 셸은 필요한 쪽만 내려받습니다
const DesktopShell = lazy(() => import('./shells/desktop/DesktopShell').then((m) => ({ default: m.DesktopShell })))
const MobileShell = lazy(() => import('./shells/mobile/MobileShell').then((m) => ({ default: m.MobileShell })))

export default function App() {
  useThemeSync()
  useEffect(() => startDriveAutoSave(), [])
  const platform = usePlatform()
  return (
    <>
      <RefractionFilter />
      <Suspense>{platform === 'mobile' ? <MobileShell /> : <DesktopShell />}</Suspense>
    </>
  )
}
