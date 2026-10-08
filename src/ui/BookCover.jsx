import { useState } from 'react'
import { bookColors } from './bookColors'

/** 표지 이미지. 없거나 로드 실패 시 제목으로 만든 그라데이션 표지를 보여줍니다. */
export function BookCover({ book, className = '', rounded = 'rounded-[4px_8px_8px_4px]' }) {
  const [failed, setFailed] = useState(false)
  const showImg = book.cover && !failed
  const [a, b] = bookColors(book)

  return (
    <div
      className={`relative aspect-[2/3] overflow-hidden [container-type:inline-size] ${rounded} shadow-[0_6px_16px_-6px_rgb(0_0_0/0.45),0_1px_2px_rgb(0_0_0/0.2)] ${className}`}
    >
      {showImg ? (
        <img
          src={book.cover}
          alt=""
          loading="lazy"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full flex-col justify-between p-[10%] text-white"
          style={{ background: `linear-gradient(160deg, ${a}, ${b})` }}
        >
          {/* 글자 크기를 표지 너비(cqw)에 맞춰, 목록의 작은 표지에서도 비율이 같게 보입니다 */}
          <span className="line-clamp-4 text-[13cqw] font-bold leading-tight">{book.title}</span>
          <span className="line-clamp-2 text-[8cqw] opacity-80">{book.authors?.join(', ')}</span>
        </div>
      )}
      {/* 책등 하이라이트 */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[6%] bg-gradient-to-r from-black/25 via-white/15 to-transparent" />
    </div>
  )
}
