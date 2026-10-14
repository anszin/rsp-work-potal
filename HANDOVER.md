# 플랫폼팀 업무 포탈 — Claude 인수인계 스크립트

> 새 Claude 세션에 이 파일 내용을 붙여넣어 컨텍스트를 이어받으세요.
> 최종 갱신: 2026-10-14 (RSP 디자인시스템 SDK 전면 적용)

---

## 프로젝트 개요

**플랫폼팀 업무 포탈** — 리테일 플랫폼(편의점/마트/POS) 개발팀 내부용 업무 관리 시스템

- **저장소**: `D:\Projects\11.My\ai\rsp-work-potal` (또는 이동된 경로)
- **GitHub**: https://github.com/anszin/rsp-work-potal
- **브랜치**: master
- **배포**: 프론트 Vercel / 백엔드 자체 서버(Docker, AWS EC2)

---

## 기술 스택

| 영역 | 스택 |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, **RSP 디자인시스템 SDK**(`rsp-react-design-system`, shadcn/base-ui 기반), recharts |
| Backend | Spring Boot 3, Java 17, JPA, REST API |
| DB | PostgreSQL |
| Infra | Docker, Ubuntu, AWS EC2 |

> Tailwind 는 포탈에 직접 설치하지 않음. SDK 의 `styles.css` 에 빌드된 Tailwind 유틸리티가 포함되어 있음.

---

## 프로젝트 구조

```
rsp-work-potal/
├── frontend/work-portal-web/     # React 앱
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx              # 폰트·SDK CSS·포탈 CSS import, TooltipProvider·Toaster
│   │   ├── App.tsx               # 라우팅 (페이지는 React.lazy 지연 로딩)
│   │   ├── index.css             # 포탈 토큰(--c-*) → SDK 토큰 매핑, SDK 보정 규칙, 레이아웃
│   │   ├── api/                  # API 클라이언트
│   │   ├── context/              # Auth, Theme(다크모드)
│   │   ├── components/
│   │   │   ├── ui/               # ★ SDK 래퍼 (아래 표)
│   │   │   ├── Layout/           # SDK Sidebar 기반 레이아웃
│   │   │   ├── StatusBadge.tsx   # 요청 상태 뱃지 (Tag 기반)
│   │   │   └── ai/               # AI 위젯
│   │   └── pages/                # Dashboard, ChangeRequest, DeployRequest, Inventory, Finance,
│   │                             # MeetingMinutes, WeeklyReport, DailyCheck, KeyTask, Todo, WorkUnit,
│   │                             # SystemManagement, UserManagement, Notification, Ai*, UiShowcase(/ui)
└── backend/work-portal-api/      # Spring Boot 앱
    └── src/main/java/com/platform/portal/
        ├── api/                  # REST 컨트롤러
        ├── domain/               # todo, deploy, workunit ...
        └── service/RedmineService.java
```

---

## RSP 디자인시스템 SDK

### 설치 (Nexus)

- 패키지: `rsp-react-design-system` (사내 Nexus, 버전 `0.1.0-snapshot.N`)
- `package.json` 에 **Nexus tarball URL** 로 지정 (나머지 패키지는 npmjs 에서 설치)
  ```
  "rsp-react-design-system": "http://193.122.117.148:36099/repository/npm-group/rsp-react-design-system/-/rsp-react-design-system-0.1.0-snapshot.10.tgz"
  ```
  - 버전 올릴 때는 URL 의 `snapshot.N` 만 변경
  - 비스코프 패키지라 registry 를 Nexus 로 바꾸면 **모든 패키지가 Nexus 경유** → 매우 느림(최초 설치 14시간). SDK 팀에 스코프 배포(`@rsp/...`) 요청 권장
- Nexus 는 익명 접근 불가(401). 로컬은 `~/.npmrc` 의 `//193.122.117.148:36099/repository/npm-group/:_authToken=...` 사용
- **Vercel 빌드**: 환경변수 `NPM_RC` 에 위 authToken 라인 설정 필요 (아직 미설정 — push 전 필수)

### 포탈 래퍼 (`src/components/ui`)

페이지는 SDK 를 직접 쓰지 않고 아래 래퍼를 사용 (포탈 밀도 보정·React 18 대응 포함).

| 래퍼 | SDK | 비고 |
|---|---|---|
| `Button` | Button | `variant: filled/outlined/text`, `size: xs/sm/md/lg`, `type="button"` 기본 |
| `IconButton` | Button + Tooltip | `label` 필수(aria-label·툴팁) |
| `Input`, `Textarea` | Input, Textarea | textarea 자동 높이 해제(rows 동작), **ref 전달 불가** |
| `Select` | Select | 기존 `<option>`/`<optgroup>` 그대로, `onValueChange(value: string)` |
| `Checkbox` | Checkbox | `onCheckedChange(checked)`, `label` |
| `RadioGroup` | RadioGroup | `options=[{value,label}]` |
| `Modal` | Dialog | `title`(문자열), `width`, `dismissible`(바깥 클릭, 기본 false), `closeOnEscape` |
| `TabBar` | Tabs(line) | 탭 목록만, 패널은 페이지에서 조건부 렌더링 |
| `Table*` | Table | SDK 그대로 재export |
| `Tag` | Badge | `tone: info/success/danger/warning/purple/teal/neutral` 또는 `color`/`bg` |
| `Panel` | Card | 카드형 박스, 패딩 16 |
| `Loading`, `EmptyState` | Spinner, Empty | |
| `toast` | toast | `toast.add({ title, type: 'success' \| 'error' })` |

기타 SDK 직접 사용: Pagination·Chart(배포관리), DropdownMenu(주간보고), Sheet(AI 대화 이력), ButtonGroup, Sidebar(Layout).

### 레이아웃 / 사이드바 (`components/Layout`)

- SDK Sidebar(`SidebarPrimitive collapsible="icon"`) — 펼침 220px / 접힘 아이콘만 48px(툴팁으로 메뉴명), 접힘 상태는 localStorage(`sidebar_open`) 유지, Ctrl+B 단축키
- 모바일(767px 이하)은 SDK 가 Sheet 로 전환, 좌상단 `.sidebar-mobile-trigger` 버튼
- 메뉴 아이콘: `lucide-react`
- 사이드바는 항상 어두운 색, 메뉴 글자 14px 고정 (index.css `[data-sidebar="sidebar"]`)
- 페이지는 `React.lazy` 지연 로딩, Layout 의 `<Suspense>` 로 사이드바 유지

### ⚠️ 반드시 알아야 할 주의사항

1. **포탈 CSS(unlayered)는 SDK(@layer) 규칙을 우선순위와 무관하게 이김**
   - `button { ... }`, `* { ... }` 같은 **태그 셀렉터 전역 규칙을 추가하면 SDK 컴포넌트가 깨짐** (실제로 `* { padding: 0 }` 때문에 SDK 버튼 여백이 사라졌었음)
   - 전역 규칙은 반드시 `:not([data-slot])` 로 SDK 컴포넌트 제외
2. **React 18 + SDK ref 문제**: SDK `Button` 은 forwardRef 가 없어 `render={<Button/>}` 로 Tooltip/Menu Trigger 에 넘기면 위치 기준(ref)을 잃음
   → Trigger 자체를 버튼으로 렌더링하고 `buttonVariants({ variant, size })` 클래스 적용 (IconButton, 주간보고 드롭다운 참고)
3. **z-index 체계**: 사이드바 200 < 모달·Sheet 1000 < 셀렉트·툴팁·드롭다운 10000 < 토스트 10001 (index.css 에서 SDK 기본 z-50 보정)
4. SDK Card 테두리는 바깥 box-shadow 링 → 스크롤 영역에서 잘려서 Panel 은 실제 `border` 로 대체함
5. SDK `DialogContent` 의 `title` 은 문자열만 가능

### 색상 토큰 (index.css)

- 포탈 토큰 `--c-*` 가 SDK `--rsp-color-*` 를 참조 → 다크모드 자동 전환
- 액션 색상은 SDK primary(초록) 대신 **secondary(파랑)** 사용
- 주요 토큰: `--c-bg/card/thead/border/border-in`, `--c-text/text-sub/text-muted`, `--c-action(-hover)`,
  태그 쌍 `--c-tag-{sys,done,err,warn,pri,teal,draft}-bg/-t`, 범주형 `--c-chart-1~8`, `--c-overlay`
- **하드코딩 hex 색상 금지** — 토큰 사용 (예외: 주간보고 인쇄 화면, 그림자)
- 사이드바는 테마와 무관하게 항상 어두운 색 (SDK sidebar 변수를 neutral 고정값으로 지정)

### 다크모드

- `ThemeContext` 가 `<html>` 에 `data-theme`(포탈) + `data-rsp-theme`(SDK rsp 토큰) + `.dark`(SDK shadcn 토큰) 를 함께 전환

### 글자 크기 체계

`11` caption(최소) · `12` 보조·표 헤더·작은 버튼·뱃지 · `13` 본문·입력·버튼·표(기본) · `14` 강조·탭 · `16` 카드/폼/모달 제목 · `20` 페이지 제목 · `24/28` 숫자 강조
— 그 외 크기(8~10, 15, 17 등) 사용 금지

### 크기(밀도) 보정

SDK 기본은 포탈 대비 커서 `data-portal-*` 속성 + index.css 로 보정:
버튼 xs22/sm28/md34/lg40px, 입력·select 34px·13px, 표 13px, 모달 간격 12px, Panel 패딩 16px

### 폰트

- Pretendard 가변 폰트를 **npm 패키지(`pretendard`)로 자체 제공** (CDN 미사용, dynamic subset)
- `--portal-font` 토큰, SDK 폰트 변수도 동일 지정

---

## Todo 도메인

### 프론트 (`src/pages/Todo/index.tsx`)
- 칸반 보드 + 모달 (width 860, 2단 레이아웃 `minmax(0,1fr)` 균등 분할)
- **관련자(collaborators)**: 담당자가 아닌 관련자는 읽기 전용으로 Todo 열람 가능
- **업무 로그(workLogs)**: 일별 업무 진행 기록 입력 가능 (날짜 + 내용) — 향후 주간보고와 연동 예정

### 백엔드
- `Todo` 엔티티: `collaborators` (JSON 배열), `workLogs` (JSON 배열)
- `AttributeConverter`: `StringListConverter`, `WorkLogListConverter`
- `findMine()`: 담당자 OR 관련자에 포함된 Todo 반환

### WorkUnit 유형
`PROJECT | OPERATION | PROPOSAL | PLANNING | OTHER`

---

## 배포 관리 페이지 (`src/pages/DeployRequest/index.tsx`)

- 유형/범위/상태: Tag 로 표시 (유형: 릴리즈=파랑, 핫픽스=빨강, 롤백=주황, 패치=회색 / 범위: 전점=초록, 일부점=보라)
- 예정일: `MM/DD` + D-day 뱃지 (D-day=빨강, D-3이하=주황, D-4이상=파랑, 지남=회색)
- 페이지네이션: SDK Pagination
- 통계 탭 시스템별 월간 추이: SDK Chart(recharts LineChart), 월 클릭 선택

---

## 레드마인 연동

- 구조: 프론트 → 백엔드(`/redmine/issues`, `/redmine/trackers`) → 레드마인
- 설정: `application.yml`의 `REDMINE_URL`, `REDMINE_API_KEY` 환경변수로 주입
- 레드마인 서버와 백엔드가 동일 EC2(Docker)에 있음
- `base-url`을 컨테이너 내부 주소(`http://localhost:포트` 또는 컨테이너명)로 변경 검토 중
- API 키 만료 이슈 있었음 → `.env.prod`의 `REDMINE_API_KEY` 최신값 확인 필요

---

## 백엔드 서버 운영

- Docker 컨테이너로 실행 중 (systemd 서비스 아님)
- 로그 확인: `docker logs <컨테이너명> --tail 50`
- 재시작: `docker restart <컨테이너명>`
- nginx가 36016 포트에서 리버스 프록시 → Spring Boot 8082

---

## 미완료 / 다음 작업 후보

1. **Vercel `NPM_RC` 설정 후 push** — 로컬 커밋 다수 미push (사용자 요청으로 모든 작업 후 마지막에 진행)
2. **주간보고 ↔ Todo 연동** (설계 완료, 구현 미착수)
   - Todo의 `workLogs`에서 이번 주 기록을 가져와 주간보고 중점과제별로 매핑
   - 주간보고는 매핑/코멘트 위주, 실제 업무 진행은 Todo로 관리
3. **레드마인 base-url 내부 주소로 변경** (Docker 네트워크 구성 확인 필요)
4. **백엔드 빌드 및 배포** (로컬 빌드 후 서버 수동 배포)
5. SDK 팀 요청 사항: 스코프 패키지 배포, 컴포넌트별 진입점(번들 크기), README 갱신(Button 등이 `/shadcn` 경로로 이동)
6. SDK 미적용으로 남긴 것: 클릭형 칩, 링크형 버튼, 강조 박스(알림·상태 타일), 주간보고 인쇄 화면, ref 사용 입력(AI 채팅 입력창 등)

---

## 코딩 스타일 / 선호 사항

- 한국어 주석 선호
- 간결하고 실용적인 코드 (불필요한 추상화 지양)
- 백엔드: 레이어드 아키텍처 (Controller → Service → Repository)
- 프론트: 함수형 컴포넌트, 커스텀 훅, **UI 는 `components/ui` 래퍼 사용**, 색상은 토큰
- 커밋 후 바로 push (`git push`) — 단, 현재는 Vercel 설정 전이라 push 보류 중
- 빌드/배포는 사용자가 직접 수행 (Claude가 빌드 요청 시 사용자 판단에 맡김)
