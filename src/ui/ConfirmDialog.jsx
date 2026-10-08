import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { create } from 'zustand'

const useConfirm = create(() => ({ current: null }))

/**
 * 브라우저 기본 confirm() 대신 쓰는 유리 경고창. 확인을 누르면 true 로 끝나는 Promise 를 돌려줍니다.
 *   if (!(await confirmDialog({ title: '삭제할까요?', confirmLabel: '삭제', destructive: true }))) return
 */
export function confirmDialog({ title, message, confirmLabel = '확인', cancelLabel = '취소', destructive = false }) {
  return new Promise((resolve) => {
    // 이미 떠 있는 창이 있으면 취소로 닫고 새 것을 띄웁니다
    useConfirm.getState().current?.resolve(false)
    useConfirm.setState({ current: { title, message, confirmLabel, cancelLabel, destructive, resolve } })
  })
}

function settle(result) {
  const cur = useConfirm.getState().current
  if (!cur) return
  useConfirm.setState({ current: null })
  cur.resolve(result)
}

/** 앱에 한 번만 둡니다 (App.jsx) */
export function ConfirmHost() {
  const cur = useConfirm((s) => s.current)

  useEffect(() => {
    if (!cur) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        settle(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [cur])

  return (
    <AnimatePresence>
      {cur && (
        <motion.div
          key="confirm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/30 p-6"
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={cur.message ? 'confirm-message' : undefined}
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            className="glass glass-strong w-full max-w-[300px] rounded-[28px] p-5 text-center text-ink"
          >
            <h2 id="confirm-title" className="text-[17px] font-semibold leading-snug">
              {cur.title}
            </h2>
            {cur.message && (
              <p id="confirm-message" className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-ink-2">
                {cur.message}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              {/* 되돌릴 수 없는 동작이 많아서 기본 포커스는 취소에 둡니다 */}
              <button
                autoFocus
                onClick={() => settle(false)}
                className="h-11 flex-1 rounded-full bg-fill text-[15px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent/60 active:opacity-70"
              >
                {cur.cancelLabel}
              </button>
              <button
                onClick={() => settle(true)}
                className={`h-11 flex-1 rounded-full text-[15px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-accent/60 active:opacity-70 ${cur.destructive ? 'bg-red-500' : 'bg-accent'}`}
              >
                {cur.confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
