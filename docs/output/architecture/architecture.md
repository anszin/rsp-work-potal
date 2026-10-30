# 아키텍처 설계서 — 플랫폼팀 업무 포탈 (현행 기준)

## 문서 정보

| 항목 | 내용 |
|---|---|
| 대상 영역 / 요건 | 전체 (A-01 ~ A-12). 7.현행분석서 3·4절 역산 |
| 상태 | ☑ 작성 중 ☐ 검토 중 ☐ 확정 ☐ 해당 없음 |
| 결정자 | 안성진 |
| 마지막 검토일 | 2026-10-19 (초안) |

## 적용 여부

- 적용 여부: 적용. 운영 중 시스템의 **현행 구조 기록**. 모든 DEC 는 "지금 그렇게 되어 있다"이며 재확정 대상
- 근거: 7.현행분석서 (커밋 `d468664`)
- 재검토 조건: L1 10절 ①~④ (권한·식별 모델) 결정 시, A-11 AI 운영 노출 시

## 공통 개발 원칙 — 현행 대조

| 원칙 | 현행 | 차이 |
|---|---|---|
| N-tier (Presentation / Business / Infrastructure) | BE: `api/`(Controller) → `domain/*/service` → `domain/*/repository`. FE: `pages/`(Component) → `api/`(axios 모듈) | BE 는 3계층 준수, 예외 2곳 (`AuthController`·`RedmineController` 가 Repository 직접 호출). FE 는 **hooks 계층 없음** — 페이지 컴포넌트 안에 react-query 호출·상태·역할 분기가 모두 있음 |
| 횡단 관심사 공통화 | BE: `JwtAuthFilter`(인증), `GlobalExceptionHandler`(예외), `@PreAuthorize`(인가 일부). FE: axios 인터셉터(토큰 주입·401 처리) | 인가가 3곳에 분산(어노테이션·컨트롤러·서비스). FE 에 에러 표시 공통 없음(`alert`/`Callout` 제각각), 라우트 가드가 토큰 유무만 |
| 공통 패키지 | 없음 (단일 앱 ×2) | 해당 없음 |

## 시스템 경계와 책임

| 구성 요소 / 외부 시스템 | 책임 | 소유자 | 경계 / 제약 |
|---|---|---|---|
| work-portal-web (React SPA, Vercel) | 화면, 메뉴 권한 표시, 토큰 보관(localStorage) | 플랫폼팀 | `/api/*` → Vercel rewrite → EC2 36016. `VITE_AI_ENABLED` 미설정 |
| work-portal-api (Spring Boot, EC2 Docker :8082) | REST API 93개, 인증·인가, 스케줄러, 시드 | 플랫폼팀 | 호스트 nginx 36016 이 앞단. AI 경로 분기 없음 |
| PostgreSQL | 전 데이터. 스키마 = JPA 엔티티 (`ddl-auto: update`) | 플랫폼팀 | 마이그레이션 없음 |
| Redmine | 일감 원장 | 운영팀 | 포탈은 ID 만 보관. 실패 시 `FAILED` 기록 |
| Webex | 알림 채널 | — | 실패 삼킴 |
| SMTP | 계정 메일 | — | 실패 무시 |
| AI 서버 (사설망) | 채팅·RAG·프롬프트 | AI 담당 | 포탈 저장소 밖. 프론트 직접 호출, 인증 없음. 운영 미연결 |
| Nexus | SDK 패키지 | 사내 | 빌드 시만 |

## 기술 결정 (현행)

| DEC-ID | 결정 | 후보 / 대안 | 선택 근거 | 영향 | 상태 |
|---|---|---|---|---|---|
| DEC-AS-01 | BE 패키지: 웹 계층은 `api/` 한곳, 도메인은 `domain/{기능}/{dto,entity,repository,service}` 기능별 | 완전 레이어별 / 완전 기능별 | 코드 관찰 (근거 없음) | 컨트롤러 16개가 한 폴더 | 현행 — 유지 여부 재확정 |
| DEC-AS-02 | 외부 연동·스케줄러는 도메인 밖 `service/` | 도메인 내 포트/어댑터 | 코드 관찰 | Redmine 동기화 로직은 요청·배포 서비스 안 (L1 ⑦) | 현행 |
| DEC-AS-03 | 인증: JWT HS256, 24h, stateless, 매 요청 DB 재조회. role claim 발급만 하고 미사용 | 세션 / refresh token | 코드 관찰 | 비활성 사용자 미차단 (#19 결함) | 현행 — #19 수정 |
| DEC-AS-04 | 인가: `@PreAuthorize` + 컨트롤러 내 비교 + 서비스 내 비교 혼재 | 한 방식으로 통일 | 없음 (누적 결과) | 규칙 파악 어려움, 소유자 검사 없음 | **재결정** — L1 ① |
| DEC-AS-05 | FE 상태: react-query (서버 상태) + Context (Auth, Theme). 전역 상태 라이브러리 없음 | Zustand 등 | 코드 관찰 | AI 페이지 4개는 react-query 미사용 | 현행 — 유지 |
| DEC-AS-06 | FE UI: RSP 디자인시스템 SDK 를 `components/ui/` 래퍼로만 사용. 페이지는 SDK 직접 import 안 함 | SDK 직접 사용 | `HANDOVER.md` 규칙 | SDK 교체·보정이 래퍼 15개로 격리됨 | 현행 — 유지 |
| DEC-AS-07 | FE 라우트 가드: 토큰 유무만. 역할·메뉴 권한은 메뉴 숨김 | 라우트별 가드 | 코드 관찰 | URL 직접 입력 시 접근 가능 (API 가 막음) | 현행 — L1 ① 과 함께 |
| DEC-AS-08 | 오류: `GlobalExceptionHandler` 4종 매핑. 커스텀 예외 없음. 상태·권한 오류는 `IllegalStateException` → 500 | 도메인 예외 + 400/403/409 | 코드 관찰 | 클라이언트가 오류 종류 구분 불가 | **재결정** — L2 |
| DEC-AS-09 | 트랜잭션: 서비스 클래스 `readOnly=true` + 쓰기 메서드 `@Transactional` | — | 코드 관찰 (대부분 준수) | 예외 3개 서비스 | 현행 — 유지 |

## 주요 흐름

```text
[변경 요청]
EXTERNAL/MEMBER → POST /api/change-requests (DRAFT) → PATCH /status REQUESTED (요청자 본인)
  → ADMIN/MANAGER 또는 MEMBER+담당자: APPROVED/REJECTED → COMPLETED
  → POST /sync-redmine → RedmineService (실패 시 RedmineSyncStatus.FAILED, 진행)

[배포 요청]
담당자/관리자 → POST /api/deploy-requests (DRAFT) → REQUESTED (담당자·관리자)
  → APPROVED (RELEASE 는 관리자만) → createDeploySteps (서브시스템 서버별)
  → POST /steps/{id}/complete (누구나 #10) → 전 단계 완료 시 자동 COMPLETED + Webex ×2

[인증]
POST /api/auth/login → JWT → localStorage → axios 인터셉터 Bearer → JwtAuthFilter → DB 재조회 → SecurityContext
401 → 인터셉터가 token 삭제 + auth:unauthorized 이벤트 → AuthContext 초기화 → /login

[AI (운영 미연결)]
pages/Ai* → aiApi.ts fetch/XHR (인증 없음, memberId) → /api/{chat,agent,...} → (dev: Vite 프록시 → AI 서버 / 운영: Spring 403)
```

## 모듈 경계

| 모듈 | 책임 | 제공 / 의존 관계 |
|---|---|---|
| `BE/api` | HTTP 경계, 입력 검증(`@Valid`), 일부 인가 | → `domain/*/service`, `service/*` |
| `BE/domain/user`, `security`, `config` | 인증·역할·시드·CORS·RestTemplate 빈 | ← 전 모듈 |
| `BE/domain/system` | 운영시스템 기준 정보, 담당자 판정 | ← request, deploy, report(daily) |
| `BE/domain/request`, `deploy` | 요청 상태 기계, 채번, Redmine 동기화 호출 | → system, user, `service/Redmine`, `service/Webex` |
| `BE/domain/report`, `inventory`, `finance`, `keytask`, `workunit`, `todo`, `menu` | 단순 CRUD + 역할별 조회 범위 | → user (username) |
| `BE/service` | Redmine·Webex·Mail·FileStorage 어댑터, 스케줄러, 알림 | ← request, deploy, user |
| `FE/api` | axios 모듈 14 + aiApi (fetch) | ← pages |
| `FE/components/ui` | SDK 래퍼 15 | ← pages, Layout |
| `FE/components/Layout` | 사이드바·메뉴 정의·역할 표시 | → context/Auth |
| `FE/context` | Auth(token, user, menuPermissions), Theme | ← 전 모듈 |
| `FE/pages/*` | 화면 + 데이터 패칭 + 폼 + 역할 분기 (hooks 분리 없음) | → api, ui, context |

## 미결정 및 검증

| 항목 | 영향 | 결정 필요 시점 | 검증 방법 |
|---|---|---|---|
| 인가 방식 통일 (DEC-AS-04) | 전 컨트롤러·서비스 | L1 ① 결정 후 | 역할×API 매트릭스 테스트 |
| 오류 응답 체계 (DEC-AS-08) | 전 API, FE 에러 표시 | L2 | 상태 코드별 계약 테스트 |
| FE hooks 계층 도입 여부 | 500줄 초과 페이지 5개 | 해당 페이지 변경 시 | — |
| Redmine 동기화 위치 (L1 ⑦) | request, deploy, service | A-10 L2 전 | — |
| `nginx.conf` 용도 (L1 ⑩) | 배포 | 설계 단계 | — |
| CI·Dockerfile 저장소 편입 | 빌드·배포 재현성 | 설계 단계 | CI 에서 빌드·테스트 통과 |
