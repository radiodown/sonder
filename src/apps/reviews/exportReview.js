/**
 * 독후감 내보내기: 텍스트(.txt) · Markdown(.md) · HTML(.html)
 * 모바일은 공유 시트로, 데스크톱(또는 공유를 못 하는 브라우저)은 파일로 내려받습니다.
 */

export const FORMATS = [
  { id: 'txt', label: '텍스트', ext: 'txt', type: 'text/plain' },
  // 공유 시트가 text/markdown 을 받지 않는 브라우저가 많아서 형식은 text/plain 으로 둡니다
  { id: 'md', label: 'Markdown', ext: 'md', type: 'text/plain' },
  { id: 'html', label: 'HTML', ext: 'html', type: 'text/html' },
]

const fmtDate = (ts) => new Date(ts).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

// ───────────── 본문 HTML → 텍스트 / Markdown ─────────────

function inline(node, md) {
  let out = ''
  for (const n of node.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) {
      out += n.textContent
      continue
    }
    if (n.nodeType !== Node.ELEMENT_NODE) continue
    const inner = inline(n, md)
    switch (n.tagName) {
      case 'BR':
        out += md ? '  \n' : '\n'
        break
      case 'STRONG':
      case 'B':
        out += md && inner.trim() ? `**${inner}**` : inner
        break
      case 'EM':
      case 'I':
        out += md && inner.trim() ? `*${inner}*` : inner
        break
      case 'S':
      case 'DEL':
        out += md && inner.trim() ? `~~${inner}~~` : inner
        break
      case 'CODE':
        out += md ? `\`${inner}\`` : inner
        break
      case 'A':
        out += md && n.getAttribute('href') ? `[${inner}](${n.getAttribute('href')})` : inner
        break
      default:
        out += inner
    }
  }
  return out
}

const prefixLines = (text, first, rest = first) =>
  text
    .split('\n')
    .map((l, i) => (i === 0 ? first : rest) + l)
    .join('\n')

function blocks(node, md) {
  const out = []
  for (const n of node.childNodes) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (n.textContent.trim()) out.push(n.textContent.trim())
      continue
    }
    if (n.nodeType !== Node.ELEMENT_NODE) continue
    switch (n.tagName) {
      case 'H1':
      case 'H2':
      case 'H3':
      case 'H4': {
        const level = Math.max(2, Number(n.tagName[1])) // # 은 독후감 제목이 씁니다
        out.push(md ? `${'#'.repeat(level)} ${inline(n, md)}` : inline(n, md))
        break
      }
      case 'BLOCKQUOTE':
        out.push(prefixLines(blocks(n, md), md ? '> ' : '  │ '))
        break
      case 'UL':
      case 'OL': {
        const items = [...n.children].filter((li) => li.tagName === 'LI')
        out.push(
          items
            .map((li, i) => {
              const marker = n.tagName === 'OL' ? `${i + 1}. ` : md ? '- ' : '• '
              return prefixLines(blocks(li, md), marker, ' '.repeat(marker.length))
            })
            .join('\n'),
        )
        break
      }
      case 'HR':
        out.push(md ? '---' : '──────────')
        break
      case 'PRE':
        out.push(md ? `\`\`\`\n${n.textContent.replace(/\n$/, '')}\n\`\`\`` : n.textContent)
        break
      case 'P':
      case 'LI':
      default:
        // <li> 안처럼 블록 없이 글만 있는 경우도 여기로 옵니다
        if ([...n.children].some((c) => /^(P|UL|OL|BLOCKQUOTE|H\d|PRE|HR)$/.test(c.tagName))) out.push(blocks(n, md))
        else out.push(inline(n, md))
    }
  }
  return out.filter((b) => b !== '').join(md ? '\n\n' : '\n\n')
}

function bodyOf(review) {
  return new DOMParser().parseFromString(review.content || '', 'text/html').body
}

function bookLine(book) {
  if (!book) return ''
  const authors = book.authors?.length ? ` — ${book.authors.join(', ')}` : ''
  return `${book.title}${authors}`
}

function toText(review, book) {
  const head = [review.title || '제목 없음', bookLine(book) && `『${bookLine(book)}』`, fmtDate(review.updatedAt)]
  return `${head.filter(Boolean).join('\n')}\n\n${blocks(bodyOf(review), false)}\n`
}

function toMarkdown(review, book) {
  const meta = [bookLine(book) && `*${bookLine(book)}*`, fmtDate(review.updatedAt)].filter(Boolean).join(' · ')
  return `# ${review.title || '제목 없음'}\n\n${meta}\n\n${blocks(bodyOf(review), true)}\n`
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function toHtml(review, book) {
  const title = escapeHtml(review.title || '제목 없음')
  const meta = [bookLine(book) && `<cite>${escapeHtml(bookLine(book))}</cite>`, escapeHtml(fmtDate(review.updatedAt))]
    .filter(Boolean)
    .join(' · ')
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { max-width: 680px; margin: 48px auto; padding: 0 20px; font-family: Pretendard, -apple-system, system-ui, sans-serif; line-height: 1.75; color: #1d1d1f; }
  h1 { font-size: 2em; line-height: 1.25; margin-bottom: .2em; }
  .meta { color: #6e6e73; margin-bottom: 2.5em; }
  cite { font-style: normal; font-weight: 600; }
  blockquote { margin: 1.2em 0; padding: .2em 1em; border-left: 3px solid #d2d2d7; color: #424245; }
  hr { border: 0; border-top: 1px solid #d2d2d7; margin: 2.5em 0; }
  @media (prefers-color-scheme: dark) { body { background: #111; color: #f5f5f7; } .meta, blockquote { color: #a1a1a6; } blockquote, hr { border-color: #3a3a3c; } }
</style>
</head>
<body>
<h1>${title}</h1>
<p class="meta">${meta}</p>
${review.content || ''}
</body>
</html>
`
}

const BUILD = { txt: toText, md: toMarkdown, html: toHtml }

function fileName(review, book, ext) {
  const base = (review.title || book?.title || '독후감').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80)
  return `${base || '독후감'}.${ext}`
}

function download(file) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * 독후감을 파일로 만들어 공유하거나 내려받습니다.
 * share 가 true 이고 브라우저가 파일 공유를 지원하면 공유 시트를 엽니다.
 * (공유 시트는 사용자 동작 직후에만 열리므로, review·book 은 미리 불러와 둔 값을 넘깁니다)
 */
export async function exportReview(review, book, formatId, { share = false } = {}) {
  const f = FORMATS.find((x) => x.id === formatId)
  const file = new File([BUILD[f.id](review, book)], fileName(review, book, f.ext), { type: `${f.type};charset=utf-8` })
  if (share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: review.title || '독후감' })
    } catch (err) {
      if (err?.name !== 'AbortError') download(file)
    }
    return
  }
  download(file)
}
