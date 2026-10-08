import { DOMParser as PMDOMParser } from '@tiptap/pm/model'

// 블록 태그를 닫거나 <br>·<hr> 이 있으면 HTML 소스로 봅니다
const HTML_HINT = /<\/(p|h[1-6]|blockquote|ul|ol|li|div|pre)>|<(br|hr)\s*\/?>/i

/** 일반 텍스트로 붙여 넣은 내용이 HTML 소스처럼 생겼는지 */
export function looksLikeHtml(text) {
  const t = text.trim()
  return t.startsWith('<') && HTML_HINT.test(t)
}

/**
 * HTML 소스를 편집기에 맞게 다듬습니다. (편집기는 제목 2·3 만 씁니다)
 * - takeTitle 이면 맨 앞의 <h1> 을 꺼내 독후감 제목으로 돌려줍니다.
 * - 본문에 <h1> 이 남아 있으면 제목 단계를 하나씩 내리고(h1→h2, h2→h3), h4 이하는 h3 으로 맞춥니다.
 */
function prepare(source, takeTitle) {
  const doc = new DOMParser().parseFromString(source, 'text/html')
  const { body } = doc
  let title = ''
  const first = body.firstElementChild
  if (takeTitle && first?.tagName === 'H1') {
    title = first.textContent.trim()
    first.remove()
  }
  const shift = body.querySelector('h1') ? 1 : 0
  for (const h of body.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    const level = Math.min(3, Math.max(2, Number(h.tagName[1]) + shift))
    const next = doc.createElement(`h${level}`)
    next.append(...h.childNodes)
    h.replaceWith(next)
  }
  return { title, body }
}

/**
 * ProseMirror handlePaste 에서 부릅니다. HTML 소스를 서식으로 넣었으면 true.
 * (VS Code 처럼 색칠된 HTML 을 함께 주는 곳에서 복사해도, 일반 텍스트가 HTML 소스면 그쪽을 씁니다)
 */
export function pasteHtmlSource(view, event, { takeTitle, onTitle }) {
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!looksLikeHtml(text)) return false
  const { title, body } = prepare(text, takeTitle)
  if (title) onTitle(title)
  const slice = PMDOMParser.fromSchema(view.state.schema).parseSlice(body)
  view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView())
  return true
}
