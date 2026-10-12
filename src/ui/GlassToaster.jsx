import { Toaster } from 'sonner'

/**
 * 유리 토스트. sonner 기본 모양은 끄고(unstyled) index.css 의 `glass` + `.toast-glass` 로 그립니다.
 * 위치·간격은 셸마다 다르게 넘깁니다.
 */
export function GlassToaster(props) {
  return (
    <Toaster
      theme="system"
      gap={10}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'glass glass-strong toast-glass',
          title: 'toast-title',
          description: 'toast-description',
          icon: 'toast-icon',
          actionButton: 'toast-action',
          cancelButton: 'toast-cancel',
        },
      }}
      {...props}
    />
  )
}
