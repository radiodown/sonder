/**
 * 책장 앱 아이콘(public/icon.svg)의 그림만 떼어 낸 것. 바탕 없이 currentColor 로 칠해서
 * 유리 아이콘 위에 Phosphor 아이콘처럼 올릴 수 있습니다. (weight 는 Phosphor 와 맞추려고 받기만 함)
 */
// eslint-disable-next-line no-unused-vars
export function ShelfGlyph({ weight, ...props }) {
  return (
    <svg viewBox="96 112 320 320" fill="currentColor" aria-hidden="true" {...props}>
      <rect x="132" y="136" width="56" height="240" rx="12" />
      <rect x="204" y="136" width="56" height="240" rx="12" opacity=".85" />
      <rect x="290" y="146" width="56" height="240" rx="12" transform="rotate(-14 318 266)" opacity=".95" />
      <rect x="112" y="388" width="288" height="14" rx="7" opacity=".9" />
    </svg>
  )
}
