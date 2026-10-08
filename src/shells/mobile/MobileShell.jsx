import { CaretLeftIcon, NotePencilIcon, TrashIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useMemo, useState } from 'react'
import { useLocation, useMatch, useNavigate } from 'react-router'
import { Toaster } from 'sonner'
import { Drawer } from 'vaul'
import { AddBook } from '../../apps/bookshelf/AddBook'
import { BookDetail } from '../../apps/bookshelf/BookDetail'
import { EmptyShelf } from '../../apps/bookshelf/BookGrid'
import { MobileShelfMenu } from '../../apps/bookshelf/ShelfOptions'
import { useShelfPrefs } from '../../apps/bookshelf/shelfPrefs'
import { ShelfView } from '../../apps/bookshelf/ShelfView'
import { useBooks } from '../../apps/bookshelf/hooks'
import { BookPicker } from '../../apps/reviews/BookPicker'
import { useReviews } from '../../apps/reviews/hooks'
import { LazyReviewEditor as ReviewEditor } from '../../apps/reviews/LazyReviewEditor'
import { ReviewRow } from '../../apps/reviews/ReviewList'
import { Settings } from '../../apps/settings/Settings'
import { STATUSES, addReview, deleteReview } from '../../db/db'
import { NavContext, useNav } from '../../lib/nav'
import { Glass } from '../../ui/Glass'
import { Segmented } from '../../ui/Segmented'
import { Screen } from './Screen'
import { TabBar } from './TabBar'

const FILTERS = [{ value: 'all', label: '전체' }, ...STATUSES.map((s) => ({ value: s.id, label: s.label }))]

function ShelfScreen() {
  const nav = useNav()
  const [filter, setFilter] = useState('all')
  const { sort } = useShelfPrefs()
  const books = useBooks(filter, sort)
  return (
    <Screen title="책장" trailing={<MobileShelfMenu />}>
      <div className="scrollbar-none overflow-x-auto px-5 pb-5">
        <Segmented options={FILTERS} value={filter} onChange={setFilter} size="sm" />
      </div>
      <div className="px-5">
        {books?.length === 0 && filter === 'all' ? (
          <EmptyShelf onAdd={nav.openAdd} />
        ) : books?.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-2">책이 없습니다</p>
        ) : (
          books && <ShelfView books={books} onOpen={nav.openBook} platform="mobile" />
        )}
      </div>
    </Screen>
  )
}

function SettingsScreen() {
  return (
    <Screen title="설정">
      <Settings />
    </Screen>
  )
}

const SCREENS = { '/': ShelfScreen, '/reviews': ReviewsScreen, '/settings': SettingsScreen }

/**
 * push 된 화면. iOS 처럼 화면 왼쪽 가장자리에서 오른쪽으로 밀면 뒤로 갑니다.
 * (가장자리에서만 시작해야 본문 스크롤·글 편집과 부딪히지 않습니다)
 */
function PushScreen({ onBack, trailing, z = 'z-20', children }) {
  const controls = useDragControls()
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 40 }}
      drag="x"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.9 }}
      onDragEnd={(_, info) => (info.offset.x > 100 || info.velocity.x > 600) && onBack()}
      className={`absolute inset-0 ${z} bg-[var(--app-bg)] shadow-[-10px_0_30px_rgb(0_0_0/0.15)]`}
    >
      <div className="absolute inset-y-0 left-0 z-20 w-5 touch-none" onPointerDown={(e) => controls.start(e)} />
      <div className="pointer-events-none absolute inset-x-4 top-[calc(env(safe-area-inset-top)+8px)] z-10 flex items-center justify-between">
        <Glass
          as="button"
          refract
          onClick={onBack}
          aria-label="뒤로"
          className="pointer-events-auto flex size-11 items-center justify-center rounded-full"
        >
          <CaretLeftIcon size={22} weight="bold" />
        </Glass>
        <div className="pointer-events-auto flex gap-2">{trailing}</div>
      </div>
      <div className="pt-safe h-full overflow-y-auto overscroll-contain pb-12">
        <div className="h-12" />
        {children}
      </div>
    </motion.div>
  )
}

function ReviewsScreen() {
  const nav = useNav()
  const reviews = useReviews()
  return (
    <Screen
      title="독후감"
      trailing={
        <Glass
          as="button"
          refract
          onClick={() => nav.newReview()}
          aria-label="새 독후감"
          className="mb-1 flex size-11 items-center justify-center rounded-full"
        >
          <NotePencilIcon size={22} />
        </Glass>
      }
    >
      <div className="px-4">
        {reviews?.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <NotePencilIcon size={44} className="text-ink-3" />
            <p className="text-sm text-ink-2">
              아직 쓴 독후감이 없어요.
              <br />책을 골라 첫 독후감을 써보세요.
            </p>
            <button onClick={() => nav.newReview()} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white">
              독후감 쓰기
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-surface p-1 dark:bg-white/[0.07]">
            {reviews?.map((r) => (
              <ReviewRow key={r.id} review={r} onClick={() => nav.openReview(r.id)} />
            ))}
          </div>
        )}
      </div>
    </Screen>
  )
}

function Sheet({ open, onOpenChange, title, children }) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/30" />
        <Drawer.Content
          aria-describedby={undefined}
          className="glass glass-strong fixed inset-x-0 bottom-0 z-50 flex h-[92dvh] flex-col rounded-t-[34px] px-4 outline-none"
        >
          <Drawer.Handle className="!mt-2.5 !mb-1 !w-10 !bg-ink/25" />
          <div className="flex items-center justify-between py-2">
            <Drawer.Title className="text-[17px] font-semibold">{title}</Drawer.Title>
            <Drawer.Close className="text-[17px] font-semibold text-accent">완료</Drawer.Close>
          </div>
          <div className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

export function MobileShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const bookMatch = useMatch('/book/:id/*')
  const reviewOnly = useMatch('/review/:rid')
  const reviewOnBook = useMatch('/book/:id/review/:rid')
  const reviewMatch = reviewOnly ?? reviewOnBook
  const [addOpen, setAddOpen] = useState(false)
  const [pickOpen, setPickOpen] = useState(false)

  // 상세 화면 아래에는 마지막으로 보던 탭을 그대로 둡니다
  const [lastTab, setLastTab] = useState('/')
  const isTab = !!SCREENS[location.pathname]
  if (isTab && location.pathname !== lastTab) setLastTab(location.pathname)
  const tab = isTab ? location.pathname : lastTab
  const TabScreen = SCREENS[tab]

  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(tab, { replace: true }))

  const nav = useMemo(() => {
    // 책 상세에서 연 독후감은 책 상세 위에 쌓습니다 (뒤로 가면 책 상세로)
    const openReview = (rid) => {
      const book = location.pathname.match(/^\/book\/(\d+)/)
      navigate(book ? `/book/${book[1]}/review/${rid}` : `/review/${rid}`)
    }
    const writeFor = async (bookId) => openReview(await addReview(bookId))
    return {
      openBook: (id) => navigate(`/book/${id}`),
      openAdd: () => setAddOpen(true),
      openApp: (id) => navigate(id === 'settings' ? '/settings' : id === 'reviews' ? '/reviews' : '/'),
      openReview,
      newReview: (bookId) => (bookId ? writeFor(bookId) : setPickOpen(true)),
      writeFor,
    }
  }, [navigate, location.pathname])

  const removeReview = async (rid) => {
    if (!confirm('이 독후감을 삭제할까요?')) return
    back()
    await deleteReview(Number(rid))
  }

  return (
    <NavContext.Provider value={nav}>
      <div data-vaul-drawer-wrapper className="fixed inset-0 overflow-hidden bg-[var(--app-bg)]">
        <TabScreen />
        <AnimatePresence>
          {bookMatch && (
            <PushScreen key={`b${bookMatch.params.id}`} onBack={back}>
              <BookDetail bookId={bookMatch.params.id} onDeleted={back} />
            </PushScreen>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {reviewMatch && (
            <PushScreen
              key={`r${reviewMatch.params.rid}`}
              z="z-30"
              onBack={back}
              trailing={
                <>
                  <Glass
                    as="button"
                    refract
                    onClick={() => removeReview(reviewMatch.params.rid)}
                    aria-label="독후감 삭제"
                    className="flex size-11 items-center justify-center rounded-full"
                  >
                    <TrashIcon size={20} />
                  </Glass>
                  <Glass
                    as="button"
                    refract
                    onClick={() => document.activeElement?.blur()}
                    className="flex h-11 items-center rounded-full px-4 text-[15px] font-semibold text-accent"
                  >
                    완료
                  </Glass>
                </>
              }
            >
              <ReviewEditor
                reviewId={reviewMatch.params.rid}
                onOpenBook={(id) => navigate(`/book/${id}`)}
                toolbarClassName="top-[calc(env(safe-area-inset-top)+64px)]"
              />
            </PushScreen>
          )}
        </AnimatePresence>
        <TabBar
          current={tab}
          hidden={!!bookMatch || !!reviewMatch}
          onTab={(path) => navigate(path, { replace: true })}
        />
      </div>

      <Sheet open={addOpen} onOpenChange={setAddOpen} title="책 검색">
        <AddBook autoFocus={false} />
      </Sheet>
      <Sheet open={pickOpen} onOpenChange={setPickOpen} title="어떤 책의 독후감인가요?">
        <BookPicker
          onPick={(bookId) => {
            setPickOpen(false)
            nav.writeFor(bookId)
          }}
        />
      </Sheet>

      <Toaster position="top-center" theme="system" />
    </NavContext.Provider>
  )
}
