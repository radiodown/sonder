import { ArrowUpRightIcon, CaretLeftIcon, GlobeIcon, NotePencilIcon, TrashIcon } from '@phosphor-icons/react'
import { AnimatePresence, animate, motion, useDragControls, useMotionValue } from 'motion/react'
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
import { StatsView } from '../../apps/stats/StatsView'
import { STATUSES, addReview, deleteReview } from '../../db/db'
import { NavContext, useNav } from '../../lib/nav'
import { markAppBack, wasSwipeBack } from '../../lib/swipeBack'
import { Glass } from '../../ui/Glass'
import { Segmented } from '../../ui/Segmented'
import { Screen } from './Screen'
import { TabBar } from './TabBar'

const FILTERS = [{ value: 'all', label: '전체' }, ...STATUSES.map((s) => ({ value: s.id, label: s.label }))]

/** 검색어가 있을 때 맨 위에 보이는 "온라인에서 찾기" 줄 */
function OnlineSearchRow({ query, onSearch }) {
  return (
    <button
      onClick={onSearch}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left active:opacity-70 dark:bg-white/[0.07]"
    >
      <GlobeIcon size={22} className="shrink-0 text-accent" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 text-[15px] font-semibold">온라인에서 ‘{query}’ 찾기</span>
        <span className="text-xs text-ink-2">책장에 없는 책을 검색해 추가합니다</span>
      </span>
      <ArrowUpRightIcon size={16} className="shrink-0 text-ink-3" />
    </button>
  )
}

function ShelfScreen() {
  const nav = useNav()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const { sort } = useShelfPrefs()
  const books = useBooks(filter, sort, search)
  const q = search.trim()
  return (
    <Screen
      title="책장"
      header={
        <div className="scrollbar-none -my-1 overflow-x-auto py-1">
          <Segmented options={FILTERS} value={filter} onChange={setFilter} size="sm" />
        </div>
      }
      trailing={<MobileShelfMenu />}
      search={{ value: search, onChange: setSearch, placeholder: '제목, 저자, 출판사' }}
    >
      <div className="px-5">
        {q && <OnlineSearchRow query={q} onSearch={() => nav.openAdd(q)} />}
        {books?.length === 0 && filter === 'all' && !q ? (
          <EmptyShelf onAdd={() => nav.openAdd()} />
        ) : books?.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-2">{q ? `‘${q}’에 맞는 책이 책장에 없어요` : '책이 없습니다'}</p>
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

function StatsScreen() {
  return (
    <Screen title="통계">
      <StatsView platform="mobile" />
    </Screen>
  )
}

const SCREENS = { '/': ShelfScreen, '/reviews': ReviewsScreen, '/stats': StatsScreen, '/settings': SettingsScreen }

const PUSH_SPRING = { type: 'spring', stiffness: 380, damping: 40 }
const pushVariants = {
  in: { x: 0 },
  // 브라우저 스와이프로 이미 밀려난 화면은 다시 밀지 않고 바로 없앱니다 (애니메이션이 두 번 보이지 않게)
  out: (instant) => ({ x: '100%', transition: instant ? { duration: 0 } : PUSH_SPRING }),
}

// 여기서 시작한 터치는 뒤로가기 스와이프로 쓰지 않습니다 (입력·글 편집·가로 스크롤)
const NO_SWIPE = 'input, textarea, select, [contenteditable="true"], [data-no-swipe]'

/**
 * push 된 화면. 오른쪽으로 밀면 뒤로 버튼과 똑같이 뒤로 갑니다.
 * - 기본: iOS 처럼 화면 왼쪽 가장자리에서 시작해야 합니다 (글 편집과 부딪히지 않게)
 * - swipeAnywhere: 화면 어디서 시작해도 됩니다. 위아래 스크롤은 그대로 두고 가로로 밀 때만 끌려옵니다.
 */
function PushScreen({ onBack, trailing, z = 'z-20', swipeAnywhere = false, children }) {
  const controls = useDragControls()
  const x = useMotionValue(0)
  return (
    <motion.div
      style={{ x }}
      variants={pushVariants}
      custom={false}
      initial="out"
      animate="in"
      exit="out"
      transition={PUSH_SPRING}
      drag="x"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.9 }}
      dragDirectionLock
      onDragEnd={(_, info) => {
        if (info.offset.x > 100 || info.velocity.x > 600) {
          // 손을 뗀 자리에서 곧장 밀어냅니다. (제자리로 튕겨 돌아가는 탄성 애니메이션을 끊음)
          animate(x, window.innerWidth, { ...PUSH_SPRING, velocity: info.velocity.x })
          onBack()
        }
      }}
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
      <div
        className={`pt-safe h-full overflow-y-auto overscroll-contain pb-12 ${swipeAnywhere ? 'touch-pan-y' : ''}`}
        onPointerDown={swipeAnywhere ? (e) => !e.target.closest(NO_SWIPE) && controls.start(e) : undefined}
      >
        <div className="h-12" />
        {children}
      </div>
    </motion.div>
  )
}

function ReviewsScreen() {
  const nav = useNav()
  const [search, setSearch] = useState('')
  const reviews = useReviews(search)
  return (
    <Screen
      title="독후감"
      search={{ value: search, onChange: setSearch, placeholder: '제목, 내용, 책 이름' }}
      trailing={
        <Glass
          as="button"
          refract
          onClick={() => nav.newReview()}
          aria-label="새 독후감"
          className="flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <NotePencilIcon size={22} />
        </Glass>
      }
    >
      <div className="px-4">
        {reviews?.length === 0 && search.trim() ? (
          <p className="py-16 text-center text-sm text-ink-2">‘{search.trim()}’에 맞는 독후감이 없어요</p>
        ) : reviews?.length === 0 ? (
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
  const [addQuery, setAddQuery] = useState('')
  const [pickOpen, setPickOpen] = useState(false)

  // 상세 화면 아래에는 마지막으로 보던 탭을 그대로 둡니다
  const [lastTab, setLastTab] = useState('/')
  const isTab = !!SCREENS[location.pathname]
  if (isTab && location.pathname !== lastTab) setLastTab(location.pathname)
  const tab = isTab ? location.pathname : lastTab
  const TabScreen = SCREENS[tab]

  // 브라우저 스와이프 뒤로가기였다면 닫힘 애니메이션을 건너뜁니다
  const swiped = wasSwipeBack()

  const back = () => {
    markAppBack()
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(tab, { replace: true })
  }

  const nav = useMemo(() => {
    // 책 상세에서 연 독후감은 책 상세 위에 쌓습니다 (뒤로 가면 책 상세로)
    const openReview = (rid) => {
      const book = location.pathname.match(/^\/book\/(\d+)/)
      navigate(book ? `/book/${book[1]}/review/${rid}` : `/review/${rid}`)
    }
    const writeFor = async (bookId) => openReview(await addReview(bookId))
    return {
      openBook: (id) => navigate(`/book/${id}`),
      openAdd: (query) => {
        setAddQuery(typeof query === 'string' ? query : '')
        setAddOpen(true)
      },
      openApp: (id) => navigate({ settings: '/settings', reviews: '/reviews', stats: '/stats' }[id] ?? '/'),
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
        <AnimatePresence custom={swiped}>
          {bookMatch && (
            <PushScreen key={`b${bookMatch.params.id}`} onBack={back} swipeAnywhere>
              <BookDetail bookId={bookMatch.params.id} onDeleted={back} />
            </PushScreen>
          )}
        </AnimatePresence>
        <AnimatePresence custom={swiped}>
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

      <Sheet open={addOpen} onOpenChange={setAddOpen} title="책 추가">
        <AddBook autoFocus={false} initialQuery={addQuery} />
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
