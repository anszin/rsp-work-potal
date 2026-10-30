# API 및 연동 설계서 — 플랫폼팀 업무 포탈 (현행 기준)

## 문서 정보

| 항목 | 내용 |
|---|---|
| 대상 영역 / 요건 | 전체. 7.현행분석서 7절 역산. 제공 API 93개, 외부 연동 5 |
| 상태 | ☑ 작성 중 ☐ 검토 중 ☐ 확정 ☐ 해당 없음 |
| 결정자 | 안성진 |
| 마지막 검토일 | 2026-10-19 (초안) |

## 적용 여부

- 적용 여부: 적용. 현행 계약 기록
- 근거: `BE/api/*Controller.java`, `FE/api/*.ts`, `BE/service/*`
- 재검토 조건: L1 ① (인가), ③ (AI 인증), DEC-AS-08 (오류 응답) 결정 시

## 인터페이스 목록

### 제공 API (`/api/...`, JWT Bearer. 세부 엔드포인트는 7.현행분석서 7.1절)

| 인터페이스 | 제공자 / 소비자 | 목적 | 동기 / 비동기 | 인증·권한 | 상태 |
|---|---|---|---|---|---|
| `/auth` (2) | BE / FE | 로그인, 내 정보 | 동기 | permitAll / JWT | 현행 |
| `/users` (6) | BE / FE | 계정 CRUD, 비밀번호 초기화·변경 | 동기 | 목록 ADMIN·MANAGER·MEMBER, 생성은 서비스 내 판정(MEMBER→EXTERNAL 만), 수정·삭제·초기화 ADMIN·MANAGER | 현행 |
| `/systems` (18) | BE / FE | 시스템·서브시스템·서버·담당자 | 동기 | 쓰기 ADMIN·MANAGER. `listServers` 권한 없음 | 현행 |
| `/change-requests` (10) | BE / FE | 변경 요청 상태 기계, 첨부, Redmine 동기화 | 동기 | 상태 전환은 서비스 내 판정 (#14·#15) | 현행 |
| `/deploy-requests` (9) | BE / FE | 배포 요청 상태 기계, 단계 완료, Redmine | 동기 | 상태 전환 서비스 내 판정. 단계 완료 권한 없음 (#10) | 현행 |
| `/inventory` (5), `/finance` (6) | BE / FE | CRUD | 동기 | JWT | 현행 |
| `/meeting-minutes` (5), `/weekly-reports` (8), `/daily-checks` (5) | BE / FE | 보고 CRUD | 동기 | JWT. weekly by-week·consolidated 생성은 ADMIN·MANAGER. 소유자 검사 없음 (#9) | 현행 |
| `/key-tasks` (5), `/work-units` (4), `/todos` (4) | BE / FE | 과제·업무단위·할 일 | 동기 | key-tasks 전체 ADMIN·MANAGER. todos 역할별 범위 (컨트롤러 내) | 현행 |
| `/menu-permissions` (2) | BE / FE | 메뉴 권한 조회·수정 | 동기 | PUT ADMIN·MANAGER | 현행 |
| `/notifications/send` (1), `/redmine` (3) | BE / FE | Webex 공지, Redmine 트래커·일감 조회 | 동기 | ADMIN·MANAGER / JWT | 현행 |

### 외부 연동

| 인터페이스 | 제공자 / 소비자 | 목적 | 동기 / 비동기 | 인증·권한 | 상태 |
|---|---|---|---|---|---|
| Redmine REST (`/issues.json`, `/projects/{key}/versions.json`, `/issues/{id}.json`) | Redmine / BE | 일감 검색·생성·수정, 버전 생성, fixed_version | 동기 (RestTemplate 5s) | API key **URL 쿼리** | 현행 |
| Webex `POST /v1/messages` | Webex / BE | 배포 알림, 공지, DM | 동기, 실패 삼킴 | Bot token Bearer | 현행 |
| SMTP | Gmail / BE | 계정 메일 | 동기, 실패 무시 | 환경변수 | 현행 |
| AI 서버 `/api/{chat,agent/chat,conversations,documents,prompts,knowledge}` | AI 서버 / **FE 직접** | SSE 채팅, 업로드(XHR), 프롬프트, 지식 통계 | SSE·동기 | **없음** (memberId 전달) | 현행 — 운영 미연결 (#6·#7) |
| Nexus npm registry | Nexus / 빌드 | SDK 패키지 | — | `~/.npmrc` 토큰 | 현행 |

## 계약 결정 (현행)

| DEC-ID | 항목 | 결정 | 오류·재시도·멱등성 | 버전 / 호환성 | 검증 방법 |
|---|---|---|---|---|---|
| DEC-API-01 | 경로·동사 | `/api/{kebab-복수}`, `/{id}`, 하위 자원 중첩 (`/systems/{id}/subsystems/{subId}/servers`). 상태 전환은 `PATCH /{id}/status` | — | 버전 접두사 없음 | — |
| DEC-API-02 | 응답 형식 | 공통 래퍼 없음. DTO 직접 또는 `ResponseEntity<DTO>` 혼재. delete 는 204 또는 200 void 혼재. enum 은 엔티티 것 그대로 노출 | — | 호환성 정책 없음 | **L2 에서 통일 여부** |
| DEC-API-03 | 오류 응답 | `GlobalExceptionHandler`: AccessDenied 403, IllegalArgument 400, Validation 400, 그 외 500 (클래스명+메시지 노출). `IllegalStateException`(상태·권한) → **500** | 재시도 지침 없음 | — | **DEC-AS-08 재결정** |
| DEC-API-04 | 인증 | `Authorization: Bearer <JWT>`. 401 시 FE 인터셉터가 토큰 삭제·로그아웃 | — | — | — |
| DEC-API-05 | 멱등성 | POST 생성에 멱등 키 없음. 채번은 서버 (#4) | 동시 등록 시 unique 충돌 가능 | — | — |
| DEC-API-06 | 페이징 | 없음 (전체 목록). Redmine 조회만 offset | — | — | 데이터 증가 시 L2 |
| DEC-API-07 | Redmine 실패 | `RedmineService` 는 예외 재던짐 → 요청·배포 서비스는 catch 후 `RedmineSyncStatus.FAILED` 기록, 본 처리는 진행. `RedmineController` 는 500 전파 | 수동 재시도 (`POST /sync-redmine`) | — | FAILED 건 재동기화 시나리오 테스트 |
| DEC-API-08 | Webex·Mail 실패 | 삼킴 (Webex warn 로그 / Mail 로그 없음 #5) | 재시도 없음 | — | — |
| DEC-API-09 | 첨부 | 업로드 JSON Base64 (multipart 20MB 설정은 미사용). 다운로드 blob. 파일명 정제 없음 | — | — | 11절 |
| DEC-API-10 | AI 호출 | FE 가 fetch/XHR 로 직접, 인증 없음, `memberId` 클라이언트 지정. 운영 프록시 분기 없음 | — | — | **L1 ③ 재결정** |
| DEC-API-11 | CORS | `*` + credentials, SecurityConfig·WebConfig 중복. yml 값 미참조 | — | — | 11절 |

## 주요 요청 흐름

```text
[인증]   FE login → POST /api/auth/login → JWT(24h) → localStorage → 모든 요청 Bearer
         → JwtAuthFilter(검증·DB 재조회) → @PreAuthorize / 서비스 내 판정 → 응답
         실패: 401 → FE 토큰 삭제 → /login

[변경 요청 + Redmine]
         POST /change-requests (DRAFT) → PATCH /status REQUESTED → APPROVED
         → POST /{id}/sync-redmine → RedmineService.createIssue (key=쿼리)
            성공: ChangeRequestIssue 저장, SYNCED / 실패: FAILED (진행)

[배포 요청 + 단계 + Webex]
         APPROVED 전환 시 createDeploySteps (서브시스템 서버 수만큼)
         → POST /steps/{id}/complete → Webex "진행 n/n" → 전 단계 DONE → COMPLETED + Webex "전체 완료"

[스케줄] 매주 금 09:00 KST → 미제출 활성 사용자 (비EXTERNAL) → Webex DM

[AI]     FE → fetch /api/chat (SSE) → dev: Vite → AI 서버 / 운영: Spring 403 (미연결)
```

## 미결정 사항

| 항목 | 영향 인터페이스 | 결정 필요 시점 |
|---|---|---|
| 오류 응답 체계 (DEC-API-03) — 상태·권한 오류의 4xx 매핑, 메시지 노출 범위 | 전체 | L2 |
| 응답 래퍼·delete 상태 코드 통일 (DEC-API-02) | 전체 | L2 |
| 인가 규칙 명세 — 역할×API 매트릭스 (L1 ①·④) | users, change-requests, deploy-requests, 보고류, todos | L1 ① |
| AI 연동 인증·프록시 (DEC-API-10) | AI 6경로 | A-11 운영 노출 전 |
| Redmine API key 전달 방식 (헤더 `X-Redmine-API-Key` vs 쿼리) | Redmine | 설계 단계 |
| 페이징 도입 (DEC-API-06) | 목록 API | 데이터 증가 시 |
