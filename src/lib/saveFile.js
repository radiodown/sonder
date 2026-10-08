/** 파일을 내려받습니다 */
export function download(file) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * share 가 true 이고 브라우저가 파일 공유를 지원하면 공유 시트를, 아니면 내려받기를 합니다.
 * 공유 시트는 사용자 동작 직후에만 열리므로, 파일은 미리 준비해 두고 바로 부르세요.
 */
export async function saveFile(file, { share = false, title } = {}) {
  if (share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
    } catch (err) {
      if (err?.name !== 'AbortError') download(file)
    }
    return
  }
  download(file)
}
