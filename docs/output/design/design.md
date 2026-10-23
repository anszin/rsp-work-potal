# UI 및 사용자 경험 설계서 — 플랫폼팀 업무 포탈 (현행 기준)

## 문서 정보

| 항목 | 내용 |
|---|---|
| 대상 영역 / 요건 | 전체. 7.현행분석서 8절 역산. 화면 21개 |
| 상태 | ☑ 작성 중 ☐ 검토 중 ☐ 확정 ☐ 해당 없음 |
| 결정자 | 안성진 |
| 마지막 검토일 | 2026-10-19 (초안) |

## 적용 여부

- 적용 여부: 적용. 현행 화면·흐름 기록
- 근거: `FE/App.tsx`, `FE/components/Layout/index.tsx`, `FE/pages/*`, `HANDOVER.md` (SDK 래퍼 규칙)
- 재검토 조건: L1 ① (권한 → 라우트 가드), 디자인시스템 SDK 버전 변경 시

## 사용자 흐름과 정보 구조

| 사용자 | 시작 조건 | 주요 흐름 | 완료 상태 | 예외 상태 |
|---|---|---|---|---|
| 전체 | `/login` | 로그인 → (mustChangePassword 면 `/change-password` 1회) → `/` 대시보드 | 토큰 localStorage | 401 → 자동 로그아웃. 변경 강제 우회 가능 (#17) |
| EXTERNAL | 메뉴: 변경 관리만 | 변경 요청 등록 → 제출(REQUESTED) → 결과 확인 | 승인·반려 표시 | 메뉴 숨김만, URL 직접 접근 가능 |
| MEMBER | 메뉴 8개 (key_tasks·설정 제외) | 담당 시스템 요청 승인·완료, 배포 요청·단계 완료, 주간보고·회의록·일일점검, To-Do | — | 남의 보고 수정 가능 (#9) |
| MANAGER / ADMIN | 전 메뉴 | 승인·반려, 통합 주간보고, 시스템·사용자·메뉴 권한 관리, 공지 발송 | — | — |
| 정보 구조 | 사이드바 1단: 대시보드 + 9 메뉴 / 그룹 "AI 기능"(4, `AiGate`) / 그룹 "설정"(3). 접기(icon) 상태 localStorage | | | |

## 화면 및 상태

| 화면 / 접점 | 목적 | 표시 정보 | 사용자 행동 | 로딩·빈 결과·오류 상태 |
|---|---|---|---|---|
| 로그인 `/login` | 인증 | username, password | 로그인 | 오류: 인라인 메시지 |
| 비밀번호 변경 `/change-password` | 임시 비밀번호 교체 | 새 비밀번호 ×2 (8자) | 변경 → `refreshMe` | 수동 검증 |
| 대시보드 `/` | 집계 | 요청·배포·시스템·회의록 카드 (`can(key)` 로 카드 숨김, 쿼리는 전부 실행) | 카드 → 각 화면 이동 | `Loading`/`EmptyState` |
| 변경 관리 `/requests` (600줄) | 요청 상태 기계 | 목록(systemId·status 필터), 상세, 첨부, Redmine 링크(IP 하드코딩) | 등록·수정·상태 전환·동기화 | `alert`/`confirm` ×8, `apiError` 로컬 정의 |
| 배포 관리 `/deploys` (1,294줄) | 배포 상태 기계 | 목록, 상세, 단계 체크, recharts 차트 | 등록·승인·단계 완료 | `alert` ×8, `isAdmin` 변수명(실제 MANAGER 포함) |
| 인벤토리, 손익, 회의록, 일일점검 | 단순 CRUD | 목록 + 폼 | 등록·수정·삭제 | `Loading`/`EmptyState`. 일일점검 시스템 목록 비어 있음 (#1) |
| 주간보고 `/reports/weekly` (1,141줄) | 개인·통합 보고 | 주차 그룹 목록, 작성자 username 표시, 통합 편집 | 작성·통합·수정 | 역할별 UI 분기 |
| 중점과제 `/key-tasks` | 연간 과제 + 실적 + 업무단위 탭 | 분기별 표 | ADMIN·MANAGER 만 API 허용 (화면은 전 역할 진입 가능) | — |
| To-Do `/todos` (721줄) | 할 일 | 상태·우선순위, 체크리스트·링크·협업자·작업 로그 (JSON) | dnd-kit 정렬 | — |
| AI 어시스턴트 `/ai` (770줄) + 3화면 | 채팅(SSE, 에이전트 토글), RAG 문서 업로드(XHR 진행률), 지식 통계, 프롬프트 | 마크다운 렌더링 | — | `console.error`. 운영 미노출 |
| 시스템 관리, 사용자 관리(+메뉴 권한 탭), 공지 발송 `/admin/*` | 설정 | — | ADMIN·MANAGER | `toast` 는 AiPrompts 만 사용 |
| UI 쇼케이스 `/ui` | SDK 컴포넌트 검수 | — | — | **비로그인 공개** (의도 #8) |

## 디자인 결정 (현행)

| DEC-ID | 항목 | 결정 | 정본 / Figma 링크 | 접근성·반응형 기준 | 검증 방법 |
|---|---|---|---|---|---|
| DEC-UI-01 | 디자인시스템 | **RSP 디자인시스템 SDK** (`@lotte/rsp-react-design-system` 0.1.0-snapshot.10, shadcn/base-ui). 페이지는 SDK 직접 사용 금지, `components/ui/` 래퍼 15개 경유 | `HANDOVER.md` 래퍼 표. Figma 링크 없음 | SDK 기준 | `/ui` 쇼케이스 |
| DEC-UI-02 | 토큰 | 포탈 토큰 `--c-*` → SDK 토큰 `--rsp-color-*` 매핑 (`index.css`). 다크모드 `data-theme`·`.dark` | `FE/index.css` | — | — |
| DEC-UI-03 | 레이아웃 | SDK Sidebar, 220px, `collapsible="icon"`, 모바일 Sheet. `PageHeader` 공통 | `Layout/index.tsx` | 모바일: Sheet (주석 기준, 미검증) | — |
| DEC-UI-04 | 스타일 작성 | **인라인 `style={}` 지배적** (페이지당 100~170회). className 은 `page-header*`, `.portal-list` 등 소수. 색은 CSS 변수만 (hex 예외 1곳) | 코드 관찰 | — | **재결정 후보** |
| DEC-UI-05 | 피드백 | 로딩 `Loading`, 빈 `EmptyState` 공통. **에러 공통 없음** — `alert`/`confirm` 12파일, `Callout`, `toast` 1곳 | `components/ui/Feedback.tsx` | — | **L2 에서 통일** |
| DEC-UI-06 | 폼 | 라이브러리 없음. `useState` 객체 + 수동 검증 | 코드 관찰 | — | — |
| DEC-UI-07 | 접근 제어 표시 | 메뉴 숨김(`menuPermissions`)·카드 숨김(`can`)·화면 내 역할 분기. 라우트 가드는 토큰만 | `App.tsx`, `Layout` | — | L1 ① |
| DEC-UI-08 | 작성자 표시 | 보고류는 username, 요청류는 이름·부서 | 12절 #2 | — | L1 ② |

## 미결정 사항

| 항목 | 영향 화면 | 결정 필요 시점 |
|---|---|---|
| 라우트 가드 (역할·메뉴 권한·mustChangePassword) | 전체 | L1 ① / #17 수정 시 |
| 에러 표시 통일 (DEC-UI-05) — `alert` 제거, 공통 컴포넌트 또는 toast | 12 파일 | L2 |
| 인라인 스타일 → 클래스·토큰 전환 여부 (DEC-UI-04) | 500줄 초과 5 페이지 | 해당 페이지 변경 시 |
| 500줄 초과 페이지 분할 (DeployRequest 1,294 / WeeklyReport 1,141 / AiChat 770 / Todo 721 / ChangeRequest 600) | 5 페이지 | 해당 페이지 변경 시 |
| 중복 정의 정리 — `apiError` 5곳, 메뉴 라벨 2곳, Todo 상태 맵 3곳, `UserSummary` 2곳 | 다수 | L2 |
| 모바일 반응형 실제 검증 | Layout | — |
| 404 라우트 없음 | App | L2 |
