import { MagnifyingGlassIcon, NotePencilIcon, TrashIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { deleteReview } from '../../db/db'
import { useNav } from '../../lib/nav'
import { useWindows } from '../../stores/windows'
import { Glass } from '../../ui/Glass'
import { useReviews } from './hooks'
import { LazyReviewEditor as ReviewEditor } from './LazyReviewEditor'
import { ReviewRow } from './ReviewList'

/** macOS 메모 앱 같은 독후감 창: 유리 사이드바 목록 + 편집기 */
export function ReviewsWindow({ win }) {
  const nav = useNav()
  const update = useWindows((s) => s.update)
  const [search, setSearch] = useState('')
  const reviews = useReviews(search)
  const selectedId = win.props.reviewId
  const select = (reviewId) => update(win.id, { props: { ...win.props, reviewId } })

  const remove = async () => {
    if (!selectedId || !confirm('이 독후감을 삭제할까요?')) return
    const idx = reviews?.findIndex((r) => r.id === selectedId) ?? -1
    const next = reviews?.[idx + 1] ?? reviews?.[idx - 1]
    await deleteReview(selectedId)
    select(next?.id)
    toast('독후감을 삭제했습니다')
  }

  return (
    <div className="flex h-full">
      <Glass as="aside" className="window-drag m-2 mr-0 flex w-72 shrink-0 flex-col rounded-[16px] pb-2 pt-12">
        <label className="mx-3 mb-2 flex h-8 items-center gap-1.5 rounded-lg bg-fill px-2.5">
          <MagnifyingGlassIcon size={15} className="text-ink-2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="독후감 검색"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-3"
          />
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          {reviews?.map((r) => (
            <ReviewRow key={r.id} review={r} selected={r.id === selectedId} onClick={() => select(r.id)} />
          ))}
          {reviews?.length === 0 && (
            <p className="px-3 py-10 text-center text-xs text-ink-2">{search ? '검색 결과가 없습니다' : '아직 쓴 독후감이 없어요'}</p>
          )}
        </div>
      </Glass>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="window-drag flex h-[52px] shrink-0 items-center justify-end gap-2 px-4">
          <button
            onClick={remove}
            disabled={!selectedId}
            aria-label="독후감 삭제"
            title="독후감 삭제"
            className="flex size-8 items-center justify-center rounded-full hover:bg-fill disabled:opacity-30"
          >
            <TrashIcon size={18} />
          </button>
          <button
            onClick={() => nav.newReview()}
            aria-label="새 독후감"
            title="새 독후감"
            className="flex size-8 items-center justify-center rounded-full bg-fill transition-transform active:scale-90"
          >
            <NotePencilIcon size={18} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedId ? (
            <ReviewEditor reviewId={selectedId} onOpenBook={nav.openBook} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 pb-16 text-center">
              <NotePencilIcon size={44} className="text-ink-3" />
              <p className="text-sm text-ink-2">왼쪽에서 독후감을 고르거나 새로 써보세요</p>
              <button onClick={() => nav.newReview()} className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white">
                새 독후감
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
