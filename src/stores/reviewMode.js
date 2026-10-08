import { create } from 'zustand'

/**
 * 독후감 읽기/편집 모드. 열린 편집기는 한 번에 하나라서 전역 하나로 둡니다.
 * 내용이 있는 독후감은 읽기 모드로, 새(빈) 독후감은 편집 모드로 열립니다 (ReviewEditor 가 열 때 정함).
 * 편집/완료 버튼은 각 셸의 툴바에 있습니다.
 */
export const useReviewMode = create(() => ({ editing: false }))

export const setReviewEditing = (editing) => useReviewMode.setState({ editing })
