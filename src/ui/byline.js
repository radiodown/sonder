/**
 * 지은이·옮긴이 한 줄. 역자가 있으면 "헤르만 헤세 지음 · 김누리 옮김", 없으면 저자만.
 */
export function byline(book) {
  const authors = book.authors?.join(', ') ?? ''
  const translators = book.translators?.join(', ') ?? ''
  if (!translators) return authors
  return [authors && `${authors} 지음`, `${translators} 옮김`].filter(Boolean).join(' · ')
}
