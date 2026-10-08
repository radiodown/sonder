import { useEffect } from 'react'
import { toast } from 'sonner'
import { useBadges } from '../../stores/badges'
import { useBadgeList } from './useBadgeList'

/**
 * 새 배지를 받으면 알림을 띄웁니다. App 에 하나 둡니다.
 * 처음 실행할 때는 이미 자격이 있는 배지를 알림 없이 채웁니다 (한꺼번에 알림이 쏟아지지 않게).
 */
export function BadgeWatcher() {
  const list = useBadgeList()
  useEffect(() => {
    if (!list) return
    const { earned, initialized, award } = useBadges.getState()
    const fresh = list.filter((b) => b.done && !earned[b.id])
    if (!fresh.length) {
      if (!initialized) award([])
      return
    }
    award(fresh.map((b) => b.id))
    if (!initialized) return
    // 한꺼번에 여러 개를 받으면(예: 배지가 새로 늘어났을 때) 알림 하나로 묶습니다
    if (fresh.length > 3) {
      toast(`🏆 배지 ${fresh.length}개를 받았어요`, { description: fresh.map((b) => `${b.emoji} ${b.title}`).join('  ') })
      return
    }
    for (const b of fresh) {
      toast(`${b.emoji} 배지를 받았어요 · ${b.title}`, { description: b.desc })
    }
  }, [list])
  return null
}
