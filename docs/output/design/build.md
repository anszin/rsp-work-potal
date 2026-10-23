# 빌드 및 운영 설계서 — 플랫폼팀 업무 포탈 (현행 기준)

## 문서 정보

| 항목 | 내용 |
|---|---|
| 대상 영역 / 요건 | 전체. 7.현행분석서 9절 역산 (2026-10-16 실행 결과) |
| 상태 | ☑ 작성 중 ☐ 검토 중 ☐ 확정 ☐ 해당 없음 |
| 결정자 | 안성진 |
| 마지막 검토일 | 2026-10-19 (초안) |

## 적용 여부

- 적용 여부: 적용. 현행 빌드·배포 기록. **CI 없음, 테스트 0건, Dockerfile 저장소 밖**
- 근거: 실제 실행 (9.1절), `vercel.json`, `HANDOVER.md`, `.env.example`
- 재검토 조건: CI 도입, 마이그레이션 도구 도입, A-11 운영 노출

## 개발·빌드·테스트·배포 흐름

| 단계 | 방식 또는 명령 | 상태 | 근거 / 확인 시점 |
|---|---|---|---|
| 로컬 개발 (BE) | `./gradlew bootRun --args='--spring.profiles.active=local'` → H2 인메모리, `create-drop`, h2-console (permitAll 미설정, 접근 여부 미확인) | ☐ 계획됨 ☑ 검증됨 (설정 확인) ☐ 실행 미확인 | `application-local.yml` |
| 로컬 개발 (FE) | `npm run dev` → Vite :3000. `/api/*` → EC2 36016 (운영 백엔드 직결), AI 경로 → `localhost:8080` | ☑ 검증됨 (설정) | `vite.config.ts`. **로컬 프론트가 운영 백엔드를 호출** |
| 빌드 (BE) | `./gradlew build -x test` | ☑ 검증됨 — 성공 (2026-10-16) | 실행 |
| 빌드 (FE) | `npm run build` (`tsc -b && vite build`). Nexus 토큰 필요 (`~/.npmrc` / Vercel `NPM_RC`) | ☑ 검증됨 — 성공. 경고: 최대 청크 876 kB | 실행 |
| 타입 검사 (FE) | `tsc --noEmit` (strict) | ☑ 검증됨 — 성공 | 실행 |
| 테스트 (BE) | `./gradlew test` | ☑ 실행됨 — **대상 0건** (`src/test` 없음) | 실행 |
| 테스트 (FE) | 없음 (스크립트·도구 없음) | ☐ 계획됨 | — |
| 린트 (FE) | `npm run lint` → **실패** (eslint 미설치) | ☑ 검증됨 — 실패 | 실행 |
| 린트 (BE) | 없음 | ☐ 계획됨 | — |
| CI | **없음** | ☐ 계획됨 | `find` 0건 |
| 배포 (FE) | Vercel, `git push master` 트리거 (추론). `vercel.json`: `/api/*` → `http://54.180.246.95:36016`, 그 외 SPA | ☑ 검증됨 (설정) / 트리거 미확인 | `vercel.json`, `HANDOVER.md:15` |
| 배포 (BE) | **수동 파일 전송** — `bootJar` 산출물을 EC2 실행 경로의 **`app.jar` 로 덮어쓰기** → 8082 프로세스 재기동 → 외부에서 로그인 실패 401 로 반영 확인. 다른 파일명으로 전송하면 재기동해도 옛 코드 (2026-10-20 사례). 호스트 nginx 1.14.1 :36016 → Spring :8082. Dockerfile·compose·배포 스크립트 **저장소에 없음** | ☑ 실측 ☑ 절차 확인 (2026-10-20) | 운영 호출, `HANDOVER.md:190` |
| DB 스키마 | 기동 시 JPA `ddl-auto: update` 자동 반영. 마이그레이션 없음 | ☑ 검증됨 (설정) | `application.yml:15` |
| 시드 | 기동 시 admin 계정(없으면), 시스템 SYS001·SYS002(0건이면), 메뉴 권한 4역할×12키 | ☑ 검증됨 (코드) | `DataInitializer`, `MenuPermissionService.seedDefaults` |

## 운영 결정 (현행)

| DEC-ID | 항목 | 결정 | 관찰·경보·복구 기준 | 검증 방법 |
|---|---|---|---|---|
| DEC-OPS-01 | 로그 | slf4j, `com.platform.portal` INFO. 연동 계층만 로그. 접근 로그·요청 ID 없음 | 경보 없음 | — |
| DEC-OPS-02 | 외부 연동 실패 | Redmine: `FAILED` 기록 + 수동 재동기화. Webex: warn 삼킴. Mail: 무시 | 실패 집계 없음 | FAILED 건 목록 화면 있음(변경·배포 상세) |
| DEC-OPS-03 | 스케줄러 | `@EnableScheduling`, 매주 금 09:00 KST 주간보고 미제출 DM. 단일 인스턴스 전제 | 실행 여부 로그만 | 다중 인스턴스 시 중복 발송 |
| DEC-OPS-04 | 헬스체크 | actuator 없음 (`/actuator/health` 404) | — | — |
| DEC-OPS-05 | 환경 | `local`(H2) / 기본(PostgreSQL). stg 없음. 로컬 FE 는 운영 BE 직결 | — | — |
| DEC-OPS-06 | 파일 저장 | 로컬 디스크 `UPLOAD_PATH`. 기본값 yml(`/opt/rsp-work-portal/uploads`) ≠ 코드(`/opt/work-portal/uploads`). 백업 정책 없음 | — | 11절 |
| DEC-OPS-07 | TLS | Redmine 호출 trust-all RestTemplate (인증서·호스트명 검증 해제). 포탈 자체 HTTPS 는 Vercel 만, 36016 은 HTTP | — | 11절 |

## 환경·비밀값·미결정

| 항목 | 결정 또는 제약 | 노출 금지 사항 | 결정 필요 시점 |
|---|---|---|---|
| BE 환경변수 | `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `REDMINE_URL`, `REDMINE_API_KEY`, `REDMINE_CR_TRACKER_ID`, `WEBEX_BOT_TOKEN`, `WEBEX_ROOM_ID`, `MAIL_HOST/USERNAME/PASSWORD`, `UPLOAD_PATH`, `SITE_URL`, `CORS_ALLOWED_ORIGINS`(미참조), `SERVER_PORT`. 루트 `.env.example` 있음 | **`application.yml` 기본값에 JWT secret·Redmine API key(40자)·DB password 평문**. admin 초기 비밀번호 `admin123!` 코드 하드코딩 + 기동 로그 출력 | 설계 단계 — 기본값 제거·로그 제거 |
| FE 환경변수 | `VITE_API_BASE_URL`(기본 `/api`), `VITE_AI_ENABLED`(Vercel 미설정 → AI 숨김). Vercel `NPM_RC`(Nexus 토큰) | `.npmrc` 에 토큰 금지 (규칙 있음) | — |
| 하드코딩 주소 | 백엔드 IP `54.180.246.95:36016` (vite, vercel), Redmine 링크 `:3000` (페이지 2곳), GitLab `210.93.169.131:7805` (AiChat), Webex URL (2곳), `site-url` 기본값 (4파일) | — | 서버 이전 전 |
| CI 도입 | 없음. 최소: BE build + FE tsc·build. 테스트는 고정 테스트 작성 후 | — | 설계 단계 |
| Dockerfile·배포 절차 저장소 편입 | 운영 서버에만 존재 (추론) | — | 설계 단계 |
| 마이그레이션 도구 | L1 ⑨ | — | 다음 스키마 변경 전 |
| AI 운영 연결 | 36016 nginx 에 AI 경로 분기 + `VITE_AI_ENABLED` + 인증 (L1 ③) | — | A-11 운영 노출 전 |
| `nginx.conf` 용도 | L1 ⑩ | — | 설계 단계 |
