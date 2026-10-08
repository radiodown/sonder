import { create } from 'zustand'
import { enableShake } from '../lib/shake'

/** "다음 책 뽑기" 창이 열려 있는지. 데스크톱·모바일 어디서든 openPicker() 로 엽니다. */
export const usePicker = create(() => ({ open: false }))

/** 탭·클릭 처리기 안에서 부르세요 (iOS 흔들기 권한을 이때 받습니다) */
export function openPicker() {
  enableShake()
  usePicker.setState({ open: true })
}

export function closePicker() {
  usePicker.setState({ open: false })
}
