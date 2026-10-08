import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { computeStats } from './stats'

/** 선택한 해의 통계. 책·독후감·활동이 바뀌면 다시 계산됩니다. */
export function useStats(year) {
  return useLiveQuery(async () => {
    const [books, reviews, activity] = await Promise.all([db.books.toArray(), db.reviews.toArray(), db.activity.toArray()])
    return computeStats({ books, reviews, activity, year })
  }, [year])
}
