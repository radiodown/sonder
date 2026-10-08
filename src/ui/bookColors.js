const PALETTE = [
  ['#ff9a8b', '#ff6a88'],
  ['#a1c4fd', '#6f86d6'],
  ['#84fab0', '#2bb57c'],
  ['#fbc2eb', '#a66cff'],
  ['#fdd819', '#e8a33d'],
  ['#5ee7df', '#3a7bd5'],
  ['#c3cfe2', '#7a8aa8'],
]

/** 문자열로 만든 안정적인 정수 (같은 책은 항상 같은 값) */
export function hashString(str = '') {
  let h = 0
  for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(h)
}

/** 표지가 없을 때 쓰는 책별 그라데이션 두 색 */
export function bookColors(book) {
  return PALETTE[hashString(book.title) % PALETTE.length]
}
