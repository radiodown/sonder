import * as DM from '@radix-ui/react-dropdown-menu'
import { usePlatform } from '../../lib/platform'
import { useBook } from '../bookshelf/hooks'
import { FORMATS, exportReview } from './exportReview'
import { useReview } from './hooks'

const menuCls = 'glass glass-strong z-[10000] min-w-48 rounded-xl p-1.5 text-[13px] text-ink'
const itemCls =
  'flex cursor-default items-center justify-between gap-6 rounded-md px-2.5 py-1.5 outline-none data-[highlighted]:bg-accent data-[highlighted]:text-white'

/**
 * 독후감 공유(모바일) / 내보내기(데스크톱) 메뉴. children 이 메뉴를 여는 버튼입니다.
 * 공유 시트는 누른 직후에만 열리므로 독후감과 책을 미리 불러 둡니다.
 */
export function ReviewShareMenu({ reviewId, children }) {
  const review = useReview(reviewId)
  const book = useBook(review?.bookId)
  const mobile = usePlatform() === 'mobile'

  return (
    <DM.Root modal={false}>
      <DM.Trigger asChild disabled={!review}>
        {children}
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} className={menuCls}>
          <DM.Label className="px-2.5 pb-0.5 pt-1 text-[11px] font-semibold text-ink-2">
            {mobile ? '공유' : '내보내기'}
          </DM.Label>
          {FORMATS.map((f) => (
            <DM.Item
              key={f.id}
              className={itemCls}
              onSelect={() => review && exportReview(review, book, f.id, { share: mobile })}
            >
              <span>{f.label}</span>
              <span className="opacity-60">.{f.ext}</span>
            </DM.Item>
          ))}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}
