import { toast } from 'sonner'
import { ConflictError, loadFromDrive, saveToDrive, useDrive } from '../../stores/drive'
import { confirmDialog } from '../../ui/ConfirmDialog'

const quiet = (err) => err?.name === 'AbortError'

/** 사용자가 누른 "Drive 에 저장". 충돌이면 덮어쓸지 묻습니다. */
export async function driveSave() {
  try {
    await saveToDrive()
    toast.success('Google Drive 에 저장했습니다')
  } catch (err) {
    if (err instanceof ConflictError) return resolveConflictByOverwrite()
    if (!quiet(err)) toast.error(err.message)
  }
}

export async function resolveConflictByOverwrite() {
  const ok = await confirmDialog({
    title: 'Drive 에 더 최근 책장이 있어요',
    message:
      '다른 기기에서 저장한 책장입니다. 이 기기의 책장으로 덮어쓸까요?\n\nDrive 쪽을 받으려면 취소 후 "Drive 에서 불러오기"를 누르세요.',
    confirmLabel: '덮어쓰기',
    destructive: true,
  })
  if (!ok) return
  try {
    await saveToDrive({ force: true })
    toast.success('Google Drive 에 저장했습니다')
  } catch (err) {
    if (!quiet(err)) toast.error(err.message)
  }
}

/** 사용자가 누른 "Drive 에서 불러오기". 이 기기의 책장을 바꾸므로 확인을 받습니다. */
export async function driveLoad() {
  const { dirty } = useDrive.getState()
  const ok = await confirmDialog({
    title: 'Drive 에서 불러올까요?',
    message: dirty
      ? '이 기기에 Google Drive 에 저장하지 않은 변경이 있습니다.\nDrive 의 책장으로 바꾸면 그 변경은 사라집니다.'
      : '이 기기의 책장이 Google Drive 의 책장으로 바뀝니다.',
    confirmLabel: '불러오기',
    destructive: dirty,
  })
  if (!ok) return
  try {
    const found = await loadFromDrive()
    if (found) toast.success('Google Drive 에서 불러왔습니다')
    else toast('Google Drive 에 저장된 책장이 없습니다', { description: '먼저 "Drive 에 저장"을 눌러 주세요.' })
  } catch (err) {
    if (!quiet(err)) toast.error(err.message)
  }
}

const rtf = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' })

function ago(ts) {
  const sec = Math.round((ts - Date.now()) / 1000)
  if (sec > -45) return '방금'
  const min = Math.round(sec / 60)
  if (min > -60) return rtf.format(min, 'minute')
  const hr = Math.round(min / 60)
  if (hr > -24) return rtf.format(hr, 'hour')
  return new Date(ts).toLocaleDateString('ko-KR')
}

/** 상태를 한 줄 문구로 */
export function driveStatusText(s) {
  if (!s.configured) return '설정되지 않음'
  if (s.status === 'saving') return '저장 중…'
  if (s.status === 'loading') return '불러오는 중…'
  if (s.status === 'conflict') return '다른 기기의 변경과 충돌'
  if (s.status === 'needs-login') return '다시 로그인 필요'
  if (s.status === 'error') return '오류'
  if (!s.connected) return '연결 안 됨'
  if (s.dirty) return s.autoSave ? '곧 저장됨' : '저장 안 된 변경 있음'
  if (s.lastSyncedAt) return `${ago(s.lastSyncedAt)} 동기화됨`
  return '연결됨'
}
