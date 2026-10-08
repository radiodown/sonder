import { createContext, useContext } from 'react'

/**
 * 앱이 셸을 몰라도 이동할 수 있게 해주는 다리.
 * 데스크톱은 창을 열고, 모바일은 화면을 push 하거나 시트를 엽니다.
 */
export const NavContext = createContext({
  openBook: () => {},
  openAdd: () => {},
  openApp: () => {},
  openReview: () => {},
  /** bookId 가 없으면 책을 고르는 화면을 먼저 띄웁니다 */
  newReview: () => {},
})

export const useNav = () => useContext(NavContext)
