/**
 * 지은이·옮긴이 한 줄. 역자가 있으면 "헤르만 헤세 · 김누리", 없으면 저자만.
 */
export function byline(book) {
  return [book.authors?.join(', '), book.translators?.join(', ')].filter(Boolean).join(' · ')
}
