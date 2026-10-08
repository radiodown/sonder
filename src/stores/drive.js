import { liveQuery } from 'dexie'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { db, exportBooks, replaceBooks } from '../db/db'
import {
  NeedsLoginError,
  downloadFromDrive,
  findDriveFile,
  hasDriveSession,
  isDriveConfigured,
  signOutDrive,
  uploadToDrive,
} from '../lib/googleDrive'

/**
 * Google Drive 동기화 상태.
 * status: 'idle' | 'saving' | 'loading' | 'error' | 'conflict' | 'needs-login'
 * - remoteTime: 이 기기가 마지막으로 보거나 쓴 Drive 파일의 modifiedTime.
 *   Drive 파일이 이보다 새로우면 다른 기기가 저장한 것 → 자동 저장을 멈추고 사용자에게 묻습니다.
 * - dirty: Drive 에 아직 올리지 않은 변경이 있음
 */
export const useDrive = create(
  persist(
    () => ({
      configured: isDriveConfigured(),
      connected: hasDriveSession(),
      autoSave: true,
      remoteTime: null,
      lastSyncedAt: null,
      dirty: false,
      status: 'idle',
      error: null,
    }),
    {
      name: 'library2-drive',
      partialize: ({ autoSave, remoteTime, lastSyncedAt, dirty }) => ({ autoSave, remoteTime, lastSyncedAt, dirty }),
    },
  ),
)

const set = useDrive.setState

export class ConflictError extends Error {
  constructor(remoteTime) {
    super('다른 기기에서 Google Drive 에 더 최근에 저장했습니다.')
    this.name = 'ConflictError'
    this.remoteTime = remoteTime
  }
}

let suppressNextChange = false

function fail(err) {
  if (err?.name === 'AbortError') return set({ status: 'idle' })
  if (err instanceof NeedsLoginError) return set({ status: 'needs-login', connected: false, error: err.message })
  if (err instanceof ConflictError) return set({ status: 'conflict', error: err.message })
  set({ status: 'error', error: err?.message || String(err) })
}

/**
 * Drive 에 저장합니다.
 * @param {{ interactive?: boolean, force?: boolean }} opts
 *   force=false 이면 Drive 쪽이 더 새로울 때 ConflictError 를 던집니다.
 */
export async function saveToDrive({ interactive = true, force = false } = {}) {
  set({ status: 'saving', error: null })
  try {
    const file = await findDriveFile(interactive)
    const { remoteTime } = useDrive.getState()
    if (!force && file && (!remoteTime || file.modifiedTime > remoteTime)) throw new ConflictError(file.modifiedTime)
    const res = await uploadToDrive(await exportBooks(), file?.id, interactive)
    set({ status: 'idle', connected: true, dirty: false, remoteTime: res.modifiedTime, lastSyncedAt: Date.now() })
  } catch (err) {
    fail(err)
    throw err
  }
}

/** Drive 의 데이터로 이 기기의 책장을 바꿉니다. 저장된 것이 없으면 false. */
export async function loadFromDrive() {
  set({ status: 'loading', error: null })
  try {
    const file = await downloadFromDrive(true)
    if (!file) {
      set({ status: 'idle', connected: true })
      return false
    }
    suppressNextChange = true
    await replaceBooks(file.text)
    set({ status: 'idle', connected: true, dirty: false, remoteTime: file.modifiedTime, lastSyncedAt: Date.now() })
    return true
  } catch (err) {
    suppressNextChange = false
    fail(err)
    throw err
  }
}

export function disconnectDrive() {
  signOutDrive()
  set({ connected: false, status: 'idle', error: null, remoteTime: null, lastSyncedAt: null })
}

export function setAutoSave(autoSave) {
  set({ autoSave })
  if (autoSave) scheduleAutoSave()
}

let timer = null
function scheduleAutoSave() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    const s = useDrive.getState()
    if (!s.configured || !s.autoSave || !s.dirty || !hasDriveSession()) return
    if (s.status === 'conflict' || s.status === 'saving' || s.status === 'loading') return
    saveToDrive({ interactive: false }).catch(() => {})
  }, 3000)
}

/** 책이나 독후감이 바뀌면 dirty 표시 후 자동 저장을 예약합니다. 앱 시작 시 한 번 호출합니다. */
export function startDriveAutoSave() {
  let first = true
  const watch = liveQuery(() => Promise.all([db.books.toArray(), db.reviews.toArray()])).subscribe(() => {
    if (first) {
      first = false
      if (useDrive.getState().dirty) scheduleAutoSave()
      return
    }
    if (suppressNextChange) {
      suppressNextChange = false
      return
    }
    set({ dirty: true })
    scheduleAutoSave()
  })
  return () => watch.unsubscribe()
}
