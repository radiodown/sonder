import { lazy, Suspense } from 'react'

// 편집기(TipTap)는 무거워서 독후감을 처음 열 때 내려받습니다.
const Editor = lazy(() => import('./ReviewEditor').then((m) => ({ default: m.ReviewEditor })))

export function LazyReviewEditor(props) {
  return (
    <Suspense>
      <Editor {...props} />
    </Suspense>
  )
}
