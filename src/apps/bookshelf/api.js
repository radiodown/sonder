/**
 * 책 검색. 카카오(키가 있을 때)와 Google Books 결과를 합치고, 부족하면 Open Library 로 보충합니다.
 * 모든 결과는 같은 형태로 정규화됩니다:
 * { isbn, title, authors[], translators[], publisher, publishedDate, cover, description, pageCount, source }
 * 역자는 카카오만 알려 줍니다 (Google Books · Open Library 는 빈 배열)
 */
const KAKAO_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY

const cleanIsbn = (q) => q.replace(/[-\s]/g, '')
export const isIsbn = (q) => /^(97[89])?\d{9}[\dXx]$/.test(cleanIsbn(q))

const https = (url) => (url ? url.replace(/^http:/, 'https:') : '')

function pickIsbn13(str = '') {
  const parts = str.split(/\s+/).filter(Boolean)
  return parts.find((p) => p.length === 13) ?? parts[0] ?? ''
}

export function openLibraryCover(isbn) {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`
}

async function searchKakao(query) {
  if (!KAKAO_KEY) return []
  const params = new URLSearchParams({ query, size: '20' })
  if (isIsbn(query)) {
    params.set('query', cleanIsbn(query))
    params.set('target', 'isbn')
  }
  const res = await fetch(`https://dapi.kakao.com/v3/search/book?${params}`, {
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
  })
  if (!res.ok) throw new Error(`kakao ${res.status}`)
  const json = await res.json()
  return json.documents.map((d) => ({
    isbn: pickIsbn13(d.isbn),
    title: d.title,
    authors: d.authors ?? [],
    translators: d.translators ?? [],
    publisher: d.publisher ?? '',
    publishedDate: d.datetime ? d.datetime.slice(0, 10) : '',
    cover: https(d.thumbnail),
    description: d.contents ?? '',
    pageCount: 0,
    source: 'kakao',
  }))
}

async function searchGoogle(query) {
  const q = isIsbn(query) ? `isbn:${cleanIsbn(query)}` : query
  const params = new URLSearchParams({ q, maxResults: '20', printType: 'books' })
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`)
  if (!res.ok) throw new Error(`google ${res.status}`)
  const json = await res.json()
  return (json.items ?? []).map(({ volumeInfo: v }) => {
    const ids = v.industryIdentifiers ?? []
    const isbn =
      ids.find((i) => i.type === 'ISBN_13')?.identifier ?? ids.find((i) => i.type === 'ISBN_10')?.identifier ?? ''
    const img = https(v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? '').replace('&edge=curl', '')
    return {
      isbn,
      title: v.subtitle ? `${v.title}: ${v.subtitle}` : v.title,
      authors: v.authors ?? [],
      translators: [],
      publisher: v.publisher ?? '',
      publishedDate: v.publishedDate ?? '',
      cover: img || (isbn ? openLibraryCover(isbn) : ''),
      description: v.description ?? '',
      pageCount: v.pageCount ?? 0,
      source: 'google',
    }
  })
}

async function searchOpenLibrary(query) {
  const params = new URLSearchParams({
    limit: '20',
    fields: 'title,subtitle,author_name,publisher,first_publish_year,isbn,cover_i,number_of_pages_median',
  })
  params.set(isIsbn(query) ? 'isbn' : 'q', isIsbn(query) ? cleanIsbn(query) : query)
  const res = await fetch(`https://openlibrary.org/search.json?${params}`)
  if (!res.ok) throw new Error(`openlibrary ${res.status}`)
  const json = await res.json()
  return json.docs.map((d) => {
    const isbn = d.isbn?.find((i) => i.length === 13) ?? d.isbn?.[0] ?? ''
    return {
      isbn,
      title: d.subtitle ? `${d.title}: ${d.subtitle}` : d.title,
      authors: d.author_name ?? [],
      translators: [],
      publisher: d.publisher?.[0] ?? '',
      publishedDate: d.first_publish_year ? String(d.first_publish_year) : '',
      cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : '',
      description: '',
      pageCount: d.number_of_pages_median ?? 0,
      source: 'openlibrary',
    }
  })
}

/**
 * ISBN 으로 카카오에서 역자를 찾습니다. 역자 정보가 생기기 전에 추가한 책을 채울 때 씁니다.
 * 카카오 키가 없거나 실패하면 null (다음에 다시 시도), 역자가 없으면 [].
 */
export async function lookupTranslators(isbn) {
  if (!KAKAO_KEY || !isbn) return null
  try {
    const [hit] = await searchKakao(isbn)
    return hit ? hit.translators : []
  } catch {
    return null
  }
}

export async function searchBooks(query) {
  const q = query.trim()
  if (!q) return []
  const sources = [searchGoogle(q)]
  if (KAKAO_KEY) sources.unshift(searchKakao(q))
  let results = await Promise.allSettled(sources)
  // 결과가 없거나 실패(예: Google 요청 한도 429)하면 Open Library 로 보충합니다
  if (!results.some((r) => r.status === 'fulfilled' && r.value.length > 0)) {
    results = [...results, ...(await Promise.allSettled([searchOpenLibrary(q)]))]
  }
  if (results.every((r) => r.status === 'rejected')) throw new Error('검색 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.')
  const seen = new Set()
  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((b) => {
      const key = b.isbn || `${b.title}|${b.authors.join()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}
