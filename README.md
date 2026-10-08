# Library 2

나만의 책장. 데스크톱에서는 macOS, 모바일에서는 iOS 26 Liquid Glass 느낌으로 동작합니다.

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/
npm run preview
```

모바일 레이아웃 강제: `http://localhost:5173/?platform=mobile` (또는 설정 > 레이아웃)

## 구조

```
src/
├─ apps/            앱 (셸을 모름)
│  ├─ registry.jsx  ← 앱 등록. Dock/Spotlight 가 여기서 읽음
│  ├─ bookshelf/    책장: api(검색) · hooks(Dexie) · BookGrid · BookDetail · AddBook · ShelfWindow
│  └─ settings/
├─ shells/
│  ├─ desktop/      MenuBar · Dock · Window(react-rnd) · Spotlight(cmdk)
│  └─ mobile/       TabBar · Screen(큰 제목) · MobileShell(라우팅, Vaul 시트)
├─ ui/              Glass · Segmented · BookCover · StarRating
├─ stores/          Zustand (settings 는 localStorage 에 저장)
├─ db/              Dexie(IndexedDB) 스키마와 CRUD, 백업
└─ lib/             nav(앱→셸 이동 다리) · platform · theme
```

- 앱은 `useNav()` 의 `openBook / openAdd / openApp` 으로만 이동합니다. 데스크톱은 창을 열고, 모바일은 화면 push 나 시트를 엽니다.
- 새 앱 추가: `apps/registry.jsx` 에 항목 하나를 추가하면 Dock 과 Spotlight 에 나타납니다. 모바일 탭은 `shells/mobile/TabBar.jsx` 에서 추가합니다.

## 책장 보기

- 보기: 아이콘 / 목록(데스크톱은 Finder 표, 모바일은 iOS 목록) / 책등(나무 선반 위에 세운 책등)
- 정렬: 최근 추가 / 제목순(제목 → 저자) / 출판사순(출판사 → 저자 → 제목, 출판사 없는 책은 맨 뒤). 한국어 정렬 규칙(`Intl.Collator('ko')`)
- 크기: 데스크톱 슬라이더, 모바일 작게/보통/크게 (아이콘·책등)
- 선택은 설정 저장소(`shelfView`, `shelfSort`, `shelfScale`)에 남아 다시 열어도 유지됩니다.
- 책등: 단색의 심플한 책등. 두께는 쪽수, 높이는 책마다 조금씩 다릅니다 (같은 책은 항상 같은 모양·색). `apps/bookshelf/BookSpines.jsx`

## 독후감

- 한 책에 여러 편을 쓸 수 있습니다. Dexie `reviews` 테이블: `{ bookId, title, content(HTML), text(평문), createdAt, updatedAt }`
- 편집기: TipTap (`apps/reviews/ReviewEditor.jsx`). 입력하는 대로 저장되고, 제목·본문이 모두 빈 채로 닫으면 지워집니다 (메모 앱처럼).
  무거워서 `LazyReviewEditor` 로 처음 열 때만 내려받습니다.
- 데스크톱: Dock 의 "독후감" 앱 (목록 + 편집기), 책 정보 창, 파일 메뉴, Spotlight 검색
- 모바일: "독후감" 탭, 책 상세의 "독후감 쓰기". 책 상세에서 연 독후감은 `/book/:id/review/:rid` 로 쌓여서 뒤로 가면 책 상세로 돌아갑니다.
- 책을 지우면 그 책의 독후감도 지워집니다. 백업 파일과 Google Drive 동기화(형식 version 2)에 함께 들어갑니다.

## Liquid Glass

`ui/Glass.jsx` + `index.css` 의 `glass` 유틸리티.

1. 블러와 채도 (모든 브라우저)
2. 스펙큘러 테두리와 하이라이트 (모든 브라우저)
3. `refract` prop 을 주면 SVG 변위 맵으로 가장자리 굴절 (**Chromium 전용**. Safari/iOS 는 1과 2만 적용)

주의: `index.css` 에 `-webkit-backdrop-filter` 를 직접 쓰지 마세요. Tailwind(Lightning CSS)가 접두사를 자동으로 붙이는데, 직접 쓰면 표준 속성이 빠집니다.

## 책 검색 API

| 소스 | 키 | 용도 |
|---|---|---|
| Google Books | 불필요 | 기본 |
| Open Library | 불필요 | Google 이 실패(429 등)하거나 결과가 없을 때 보충 |
| 카카오 책 검색 | `VITE_KAKAO_REST_API_KEY` | 한국 책. 키가 있을 때만 사용 |

카카오 키는 클라이언트에 노출되므로 카카오 개발자 콘솔에서 **허용 도메인을 꼭 제한**하세요.
로컬에서는 `.env.local`, 배포 시에는 GitHub 저장소 Secrets 에 `KAKAO_REST_API_KEY` 로 넣습니다.

## Google Drive 저장

library 프로젝트와 같은 방식입니다 (`VITE_GOOGLE_CLIENT_ID`, `drive.appdata` 권한).

- 앱 전용 숨김 폴더(appDataFolder)에 `library2.json` 하나로 저장합니다. 다른 Drive 파일은 보지 못합니다.
- library 와 같은 클라이언트 ID 라서 appDataFolder 를 공유하지만, 파일 이름이 달라(`library.db` / `library2.json`) 서로 덮어쓰지 않습니다.
- **자동 저장**: 책이 바뀌면 3초 뒤 업로드합니다. 한 번 로그인(동의)한 기기에서만 동작합니다.
- **충돌 방지**: 업로드 전에 Drive 파일의 수정 시각을 확인합니다. 다른 기기가 더 최근에 저장했으면 자동 저장을 멈추고, 설정에서 "Drive 것 받기 / 이 기기 것으로 덮어쓰기" 중 하나를 고르게 합니다.
- **불러오기**는 이 기기의 책장을 Drive 의 것으로 통째로 바꿉니다 (확인을 받습니다).
- 코드: `lib/googleDrive.js`(API) · `stores/drive.js`(상태, 동기화, 자동 저장) · `apps/settings/driveActions.js`(확인 창, 문구)

Google Cloud 콘솔의 OAuth 클라이언트 "승인된 JavaScript 원본"에 개발 주소(예: `http://localhost:5173`)와 `https://<사용자명>.github.io` 가 있어야 합니다.
library 와 library2 의 개발 서버를 동시에 켜면 포트가 5174 로 바뀌어 로그인이 막힐 수 있습니다.

## 배포 (GitHub Pages)

저장소: https://github.com/radiodown/sonder → 주소: **https://radiodown.github.io/sonder/**

`.github/workflows/deploy.yml` 이 `main` 에 push 될 때 빌드하고 배포합니다. 처음 한 번만 저장소에서 설정하세요.

1. Settings > Pages > Build and deployment > Source: **GitHub Actions**
2. Settings > Secrets and variables > Actions 에 library 저장소와 같은 값으로 추가
   - `KAKAO_REST_API_KEY` (카카오 책 검색)
   - `GOOGLE_CLIENT_ID` (Google Drive 저장)
3. Google Cloud 콘솔 OAuth 클라이언트의 승인된 JavaScript 원본에 `https://radiodown.github.io` 가 있는지 확인
   (카카오 콘솔의 허용 도메인도 같은 주소)

`base: './'` 와 HashRouter 를 쓰므로 저장소 이름과 상관없이 동작합니다.
