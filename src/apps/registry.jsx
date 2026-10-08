import { BooksIcon, GearSixIcon, MagnifyingGlassIcon, NotePencilIcon } from '@phosphor-icons/react'
import { AddBook } from './bookshelf/AddBook'
import { BookDetail } from './bookshelf/BookDetail'
import { ShelfWindow } from './bookshelf/ShelfWindow'
import { ReviewsWindow } from './reviews/ReviewsWindow'
import { Settings } from './settings/Settings'

/**
 * 앱 목록. 여기에 등록하면 Dock 과 Spotlight 에 나타납니다.
 *
 * - Window: 데스크톱 창 내용. ({ win, close }) 를 받습니다.
 * - titlebar: 'none' 이면 앱이 직접 툴바를 그립니다 (className="window-drag" 로 드래그 영역 지정).
 * - dock: Dock 에 고정할지
 * - windowKey: 같은 key 의 창은 하나만 열립니다
 * - parent: 이 창이 속한 앱 (책 정보·책 추가 창은 '책장' 앱의 창. 책장을 종료하면 함께 닫힙니다)
 */
export const APPS = [
  {
    id: 'bookshelf',
    name: '책장',
    Icon: BooksIcon,
    tint: 'from-orange-300 to-orange-600',
    size: { width: 980, height: 640 },
    titlebar: 'none',
    dock: true,
    Window: ShelfWindow,
  },
  {
    id: 'reviews',
    name: '독후감',
    Icon: NotePencilIcon,
    tint: 'from-amber-200 to-yellow-500',
    size: { width: 1000, height: 660 },
    titlebar: 'none',
    dock: true,
    Window: ReviewsWindow,
  },
  {
    id: 'addBook',
    name: '책 추가',
    parent: 'bookshelf',
    Icon: MagnifyingGlassIcon,
    tint: 'from-sky-300 to-blue-600',
    size: { width: 520, height: 600 },
    dock: false,
    Window: () => (
      <div className="h-full px-4 pb-2">
        <AddBook />
      </div>
    ),
  },
  {
    id: 'bookDetail',
    name: '책 정보',
    parent: 'bookshelf',
    Icon: BooksIcon,
    tint: 'from-orange-300 to-orange-600',
    size: { width: 520, height: 680 },
    dock: false,
    windowKey: (p) => `book-${p.bookId}`,
    Window: ({ win, close }) => <BookDetail bookId={win.props.bookId} onDeleted={close} />,
  },
  {
    id: 'settings',
    name: '설정',
    Icon: GearSixIcon,
    tint: 'from-zinc-300 to-zinc-500',
    size: { width: 600, height: 620 },
    dock: true,
    Window: () => (
      <div className="pt-2">
        <Settings />
      </div>
    ),
  },
]

/** 창이 속한 앱 id (Dock 의 앱 단위) */
export const rootAppId = (appId) => getApp(appId).parent ?? appId

export function getApp(id) {
  const app = APPS.find((a) => a.id === id)
  if (!app) throw new Error(`Unknown app: ${id}`)
  return app
}
