import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { useSettings } from '../../stores/settings'
import { evaluateBadges } from './badges'

/** 배지 목록 (받았는지·진행도 포함). 기록이 바뀌면 다시 계산됩니다. */
export function useBadgeList() {
  const goals = useSettings((s) => s.readingGoals)
  return useLiveQuery(async () => {
    const [books, reviews, activity] = await Promise.all([db.books.toArray(), db.reviews.toArray(), db.activity.toArray()])
    return evaluateBadges({ books, reviews, activity, goals })
  }, [goals])
}
