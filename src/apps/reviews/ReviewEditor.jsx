import {
  ListBulletsIcon,
  ListNumbersIcon,
  MinusIcon,
  QuotesIcon,
  TextBIcon,
  TextHOneIcon,
  TextHTwoIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
} from '@phosphor-icons/react'
import { CharacterCount, Placeholder } from '@tiptap/extensions'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import { db, deleteReview, isEmptyReview, updateReview } from '../../db/db'
import { useBook } from '../bookshelf/hooks'
import { BookCover } from '../../ui/BookCover'
import { Glass } from '../../ui/Glass'
import { formatReviewDate, useReview } from './hooks'

// 편집기가 열려 있는 독후감 id → 열린 수. StrictMode 의 mount→unmount→mount 에도
// 빈 독후감이 지워지지 않도록, 닫힌 뒤 한 틱 기다렸다가 아무도 열고 있지 않을 때만 정리합니다.
const openCount = new Map()

function useDiscardIfEmptyOnClose(id) {
  useEffect(() => {
    openCount.set(id, (openCount.get(id) ?? 0) + 1)
    return () => {
      openCount.set(id, openCount.get(id) - 1)
      setTimeout(async () => {
        if (openCount.get(id) > 0) return
        openCount.delete(id)
        const r = await db.reviews.get(id)
        if (r && isEmptyReview(r)) await deleteReview(id)
      }, 0)
    }
  }, [id])
}

function FormatButton({ active, onClick, label, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()} // 편집기 포커스를 유지
      onClick={onClick}
      className={`flex size-8 shrink-0 items-center justify-center rounded-full transition-colors ${active ? 'bg-accent text-white' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
    >
      {children}
    </button>
  )
}

function FormatBar({ editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
    }),
  })
  const c = () => editor.chain().focus()
  const sz = 17
  return (
    <Glass className="scrollbar-none flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-1">
      <FormatButton label="제목" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>
        <TextHOneIcon size={sz} weight="bold" />
      </FormatButton>
      <FormatButton label="소제목" active={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()}>
        <TextHTwoIcon size={sz} weight="bold" />
      </FormatButton>
      <span className="mx-1 h-5 w-px shrink-0 bg-line" />
      <FormatButton label="굵게" active={s.bold} onClick={() => c().toggleBold().run()}>
        <TextBIcon size={sz} weight="bold" />
      </FormatButton>
      <FormatButton label="기울임" active={s.italic} onClick={() => c().toggleItalic().run()}>
        <TextItalicIcon size={sz} weight="bold" />
      </FormatButton>
      <FormatButton label="밑줄" active={s.underline} onClick={() => c().toggleUnderline().run()}>
        <TextUnderlineIcon size={sz} weight="bold" />
      </FormatButton>
      <FormatButton label="취소선" active={s.strike} onClick={() => c().toggleStrike().run()}>
        <TextStrikethroughIcon size={sz} weight="bold" />
      </FormatButton>
      <span className="mx-1 h-5 w-px shrink-0 bg-line" />
      <FormatButton label="글머리 기호" active={s.bullet} onClick={() => c().toggleBulletList().run()}>
        <ListBulletsIcon size={sz} weight="bold" />
      </FormatButton>
      <FormatButton label="번호 목록" active={s.ordered} onClick={() => c().toggleOrderedList().run()}>
        <ListNumbersIcon size={sz} weight="bold" />
      </FormatButton>
      <FormatButton label="인용" active={s.quote} onClick={() => c().toggleBlockquote().run()}>
        <QuotesIcon size={sz} weight="fill" />
      </FormatButton>
      <FormatButton label="구분선" onClick={() => c().setHorizontalRule().run()}>
        <MinusIcon size={sz} weight="bold" />
      </FormatButton>
    </Glass>
  )
}

function BookChip({ bookId, onOpenBook }) {
  const book = useBook(bookId)
  if (!book) return null
  return (
    <button
      type="button"
      onClick={() => onOpenBook?.(book.id)}
      className="flex max-w-full items-center gap-2.5 rounded-xl bg-fill/70 py-1.5 pl-1.5 pr-3 text-left active:opacity-70"
    >
      <BookCover book={book} className="w-7 shrink-0" rounded="rounded-[3px]" />
      <span className="min-w-0">
        <span className="line-clamp-1 text-[13px] font-semibold">{book.title}</span>
        <span className="line-clamp-1 text-xs text-ink-2">{book.authors?.join(', ')}</span>
      </span>
    </button>
  )
}

function EditorBody({ review, onOpenBook, autoFocus, toolbarClassName }) {
  const [title, setTitle] = useState(review.title)
  const saveTimer = useRef(null)
  const titleRef = useRef(null)
  useDiscardIfEmptyOnClose(review.id)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      Placeholder.configure({ placeholder: '이 책을 읽고 무엇을 느꼈나요?' }),
      CharacterCount,
    ],
    content: review.content || '',
    editorProps: { attributes: { class: 'review-prose', 'aria-label': '독후감 본문' } },
    onUpdate: ({ editor: e }) => {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => updateReview(review.id, { content: e.getHTML(), text: e.getText() }), 300)
    },
  })

  // 닫을 때 저장 대기 중인 내용을 바로 저장
  useEffect(
    () => () => {
      if (!saveTimer.current || !editor || editor.isDestroyed) return
      clearTimeout(saveTimer.current)
      updateReview(review.id, { content: editor.getHTML(), text: editor.getText() })
    },
    [editor, review.id],
  )

  // 새로 만든(빈) 독후감은 열자마자 제목에 커서를 둡니다. 처음 한 번만.
  const [focusOnMount] = useState(() => autoFocus && isEmptyReview(review))
  useEffect(() => {
    if (focusOnMount) titleRef.current?.focus()
  }, [focusOnMount])

  const count = useEditorState({ editor, selector: ({ editor: e }) => e?.storage.characterCount.characters() ?? 0 })

  return (
    <div className="flex min-h-full flex-col">
      <div className={`pointer-events-none sticky z-10 flex justify-center px-3 ${toolbarClassName}`}>
        <div className="pointer-events-auto max-w-full">{editor && <FormatBar editor={editor} />}</div>
      </div>
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 pb-24 pt-5">
        <p className="mb-3 text-center text-xs text-ink-3">
          {formatReviewDate(review.updatedAt, true)} · {count.toLocaleString()}자
        </p>
        <BookChip bookId={review.bookId} onOpenBook={onOpenBook} />
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            updateReview(review.id, { title: e.target.value })
          }}
          onKeyDown={(e) => {
            // 한글 조합 중 Enter 는 무시 (Safari 는 isComposing 대신 keyCode 229)
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && editor) {
              e.preventDefault()
              // commands.focus() 는 다음 프레임에 포커스를 옮겨서, 바로 이어 친 글자가 제목에 남습니다.
              editor.commands.setTextSelection(1)
              editor.view.focus()
            }
          }}
          placeholder="제목"
          aria-label="독후감 제목"
          className="mt-4 w-full bg-transparent text-[26px] font-bold leading-tight outline-none placeholder:text-ink-3"
        />
        <EditorContent editor={editor} className="mt-3 flex-1 cursor-text" onClick={() => editor?.commands.focus()} />
      </div>
    </div>
  )
}

/** 독후감 편집기. 데스크톱 창과 모바일 화면이 함께 씁니다. 입력하는 대로 저장됩니다. */
export function ReviewEditor({ reviewId, onOpenBook, autoFocus = true, toolbarClassName = 'top-2' }) {
  const review = useReview(reviewId)
  if (review === undefined) return null
  if (!review) return <div className="p-10 text-center text-sm text-ink-2">독후감을 찾을 수 없습니다</div>
  return (
    <EditorBody
      key={review.id}
      review={review}
      onOpenBook={onOpenBook}
      autoFocus={autoFocus}
      toolbarClassName={toolbarClassName}
    />
  )
}
