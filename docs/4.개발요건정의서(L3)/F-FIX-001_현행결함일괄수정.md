# 개발 요건 정의서 — F-FIX-001 현행 결함 일괄 수정 (1차)

> **작성 주체** : 개발 담당자 (AI 요건 상세화 결과 반영)
> **입력** : ~~L2 영역별요건서~~ → **7.현행분석서 + REQ-2026-001** (인수 시스템, L2 없음) + 설계 패키지(현행 기준, 작성 중)
> **용도** : 개발 착수 기준 문서. 이 문서가 확정되어야 구현 단계로 진행합니다.
>
> **방법론과 다른 점 (1차 적용)** : ① L2 가 없어 현행분석서 12절을 원본 요건으로 삼음 ② 원칙은 기능당 L3 1개이나, 1~10줄짜리 결함 6건을 R-001~R-006 으로 한 문서에 묶음. 각 R 은 독립적으로 구현·검증 가능 ③ 설계 패키지가 "확정"이 아닌 "작성 중(현행 기준)" 상태에서 진행 — 이번 수정은 설계 결정을 바꾸지 않음

---

## 1. 문서 정보

| 항목 | 내용 | 항목 | 내용 |
|---|---|---|---|
| 요건 ID | F-FIX-001 (REQ-2026-001) | 버전 | 0.1 |
| 원본 L2 요건서 | 없음 → `docs/7.현행분석서.md` 12절 | 확정일 | 2026-10-20 |
| 권장 저장 위치 | `4.개발요건정의서(L3)/F-FIX-001_현행결함일괄수정.md` | 상태 | ☐ 작성 중 ☐ 검토 중 ☑ 확정 → **구현·배포 완료** (2026-10-20) |
| 개발 담당 | 안성진 (AI 구현 보조) | 현업 담당 | 안성진 |
| 참조 설계 문서 | `docs/design/api.md`, `database.md`, `build.md` | 관련 DEC | DEC-API-03(오류), DEC-AS-03(인증), DEC-DB-01(삭제), DEC-DB-04(채번) |

---

## 2. 요건 요약

현행 분석에서 "결함"으로 확정된 8건 중 권한 모델과 무관한 6건을 고친다. 프론트 1건(일일점검 경로), 백엔드 5건(채번, 메일 로그, 비활성 사용자 차단, 서버 삭제 소속 검증, 사용자 삭제 안내). 백엔드는 테스트가 0건이므로 각 항목의 **현행 동작을 먼저 테스트로 고정**하고(실패 확인), 수정 후 통과시킨다. 설계 결정(DEC)은 바꾸지 않으며, 오류 상태 코드는 현행 매핑(400/403) 안에서 처리하고 401 하나만 추가한다.

---

## 3. 확정 기능 요건

### R-001 일일점검 시스템 목록 경로

| 항목 | 내용 |
|---|---|
| **출처** | 7.현행분석서 12절 #1, REQ-2026-001 5절 1번 |
| **요건 내용** | 일일점검 화면의 시스템 목록을 `api/systems.ts` 의 `getActiveSystems()` 로 가져온다 |
| **선행 조건** | 없음 |
| **처리 규칙** | 분기 조건 : 없음<br>계산식 : 없음<br>상태 전이 : 없음<br>현행 : `FE/pages/DailyCheck/index.tsx:27` `client.get('/api/systems')` → 실제 `/api/api/systems` → 404 → 빈 목록<br>변경 : `getActiveSystems()` 사용(변경·배포 등록 폼과 동일), `client` import 제거, 로컬 `SystemOption` 은 `System` 타입으로 대체 |
| **예외 처리** | 조회 실패 시 현행과 동일(빈 목록, react-query 기본) |
| **인수 조건** | **Given** : 활성 운영시스템 2개(SYS001, SYS002)<br>**When** : 일일점검 화면 진입 후 등록 폼 열기<br>**Then** : 시스템 선택에 2개가 표시되고, 네트워크 탭에 `/api/systems/active` 호출 1건, `/api/api/` 호출 0건 |
| **확정 경위** | 12절 #1 답변 "결함" (안성진, 2026-10-19). 목록 범위는 REQ 9절 미정 → 활성만으로 확정 (다른 폼과 일관) |
| **관련 요건** | — |
| **범위** | ☑ 이번 차수 ☐ 차기 이월 |
| **검증** | `tsc --noEmit` 통과 + 수동 확인(로컬 dev 는 운영 백엔드 직결이라 실제 데이터로 확인 가능). FE 테스트 도구 없음 → 테스트 제외, 사유 기록 |

### R-002 변경요청 채번 MAX+1

| 항목 | 내용 |
|---|---|
| **출처** | 12절 #4, REQ 5절 2번 |
| **요건 내용** | `ChangeRequestService.generateRequestNo()` 가 그 해 최대 일련번호+1 을 반환한다 |
| **선행 조건** | 없음 |
| **처리 규칙** | 분기 조건 : 그 해 건수 0 → `001`<br>계산식 : `CR-{yyyy}-{MAX(SUBSTRING(request_no, 9)) + 1, 3자리}`<br>상태 전이 : 없음<br>현행 : `countByYear(start, end) + 1`<br>변경 : `ChangeRequestRepository.maxSeqByYear(start, end)` native 쿼리 추가 — `DeployRequestRepository.maxSeqByYear` 와 동일 형식, 테이블·컬럼만 `change_requests`·`request_no`. `countByYear` 는 다른 사용처 없으면 삭제 |
| **예외 처리** | 동시 등록 시 unique 충돌은 현행과 동일(범위 밖, REQ 6절) |
| **인수 조건** | **Given** : 올해 변경요청 `CR-yyyy-001`, `002`, `003` 이 있고 `002` 를 삭제함<br>**When** : 변경요청을 새로 등록<br>**Then** : 번호가 `CR-yyyy-004` (현행은 `003` → unique 위반) |
| **확정 경위** | 12절 #4 답변 "결함". 배포 쪽 수정 커밋 `946f3d6` 과 동일 방식 |
| **관련 요건** | DEC-DB-04 |
| **범위** | ☑ 이번 차수 |
| **검증** | `ChangeRequestNumberingTest` — 고정 테스트: 위 Given/When 으로 현행 코드에서 `003` 이 나오는 것을 먼저 확인(실패하는 테스트), 수정 후 `004` 통과 |

### R-003 메일 발송 실패 로그

| 항목 | 내용 |
|---|---|
| **출처** | 12절 #5, REQ 5절 3번 |
| **요건 내용** | `UserService.create`·`resetPassword` 에서 메일 발송 예외를 삼키되 warn 로그를 남긴다 |
| **선행 조건** | 없음 |
| **처리 규칙** | 현행 : `catch (Exception ignored) {}` 2곳, `MailService` 로거 없음<br>변경 : `UserService` 에 `@Slf4j`, catch 에서 `log.warn("계정 메일 발송 실패 username={} to={}: {}", ...)`. 동작(성공 처리, 응답에 임시 비밀번호 포함)은 그대로 |
| **예외 처리** | 로그에 임시 비밀번호를 포함하지 않는다 |
| **인수 조건** | **Given** : SMTP 미설정 환경<br>**When** : 이메일이 있는 계정 생성<br>**Then** : 계정은 생성되고(현행), 로그에 WARN 1건, 로그 본문에 임시 비밀번호 없음 |
| **확정 경위** | 12절 #5 답변 "결함(경미)" |
| **관련 요건** | 코딩컨벤션 6절 "catch ignored 금지" |
| **범위** | ☑ 이번 차수 |
| **검증** | 코드 리뷰. 테스트 제외 — 사유: 외부 SMTP 실패를 재현하려면 mock 주입 구조가 필요하고 수정 크기(2줄)에 비해 과함 |

### R-004 비활성 사용자 인증 차단

| 항목 | 내용 |
|---|---|
| **출처** | 12절 #19, REQ 5절 4번 |
| **요건 내용** | `active=false` 사용자는 로그인할 수 없고, 이미 발급된 토큰도 인증되지 않는다 |
| **선행 조건** | 없음 |
| **처리 규칙** | 분기 조건 : `user.isActive() == false`<br>현행 : `CustomUserDetailsService` 가 3인자 `User` 생성자(enabled 고정 true). `JwtAuthFilter` 는 enabled 미확인. 자격 증명 오류 포함 로그인 실패가 `handleAll` 500<br>변경 ① `CustomUserDetailsService`: `User.builder()...disabled(!user.isActive())` → `DaoAuthenticationProvider` 가 `DisabledException`<br>변경 ② `JwtAuthFilter`: `userDetails.isEnabled()` 가 false 면 SecurityContext 에 올리지 않음 → 익명 → 403<br>변경 ③ `GlobalExceptionHandler`: `AuthenticationException` → **401** `{"error": 메시지}`. 자격 증명 오류도 500 → 401 로 바뀜 (REQ 9절 미정 → 확정) |
| **예외 처리** | 삭제된 사용자(토큰만 남은 경우)는 현행대로 `UsernameNotFoundException` → 필터에서 예외 → 500. 이번 범위 밖(11절 잔류) |
| **인수 조건** | **Given** : `active=false` 사용자 U<br>**When** : U 가 올바른 비밀번호로 로그인<br>**Then** : 401<br>**Given** : U 의 유효한 JWT (비활성화 전 발급)<br>**When** : `GET /api/systems` (인증 필요 경로. `/api/auth/**` 는 permitAll 이라 검증에 부적합)<br>**Then** : 403 (인증 없음)<br>**Given** : `active=true` 사용자<br>**When** : 로그인 / 토큰 사용<br>**Then** : 현행과 동일 (200) |
| **확정 경위** | 12절 #19 답변 "결함". 401 통일은 REQ 9절 미정 → 이 문서에서 확정 |
| **관련 요건** | DEC-AS-03, DEC-API-03. FE `Login` 은 상태 코드 무관하게 catch → 메시지 표시이므로 영향 없음 |
| **범위** | ☑ 이번 차수 |
| **검증** | `InactiveUserAuthTest` (MockMvc) — 고정 테스트: 현행에서 비활성 로그인이 200 인 것을 먼저 확인, 수정 후 401/403/200 |

### R-005 서버 삭제 소속 검증

| 항목 | 내용 |
|---|---|
| **출처** | 12절 #20, REQ 5절 5번 |
| **요건 내용** | `OperationSystemService.deleteServer(subSystemId, serverId)` 는 서버가 그 서브시스템 소속일 때만 삭제한다 |
| **선행 조건** | 호출자 ADMIN/MANAGER (현행 `@PreAuthorize` 유지) |
| **처리 규칙** | 분기 조건 : `server.subSystem.id != subSystemId` → `IllegalArgumentException("서버가 해당 서브시스템에 속하지 않습니다")` → 400. 서버 없음 → `IllegalArgumentException("Server not found")` → 400<br>현행 : `serverRepository.deleteById(serverId)` 만 |
| **예외 처리** | 위 |
| **인수 조건** | **Given** : 서브시스템 A 에 서버 S<br>**When** : `deleteServer(B.id, S.id)`<br>**Then** : 400, S 는 남아 있음<br>**When** : `deleteServer(A.id, S.id)`<br>**Then** : 삭제됨 |
| **확정 경위** | 12절 #20 답변 "결함(경미)" |
| **관련 요건** | `listServers`·`addServer` 의 systemId 소속 검증은 범위 밖(11절) |
| **범위** | ☑ 이번 차수 |
| **검증** | `SystemServerDeleteTest` — 고정 테스트: 현행에서 B 로도 삭제되는 것을 확인, 수정 후 400 |

### R-006 이력 있는 사용자 삭제 안내

| 항목 | 내용 |
|---|---|
| **출처** | 12절 #22, REQ 5절 6번 |
| **요건 내용** | 변경·배포 요청 또는 시스템 담당자 이력이 있는 사용자는 삭제하지 않고 안내 메시지를 반환한다 |
| **선행 조건** | 호출자 ADMIN/MANAGER, 본인 아님 (현행 유지) |
| **처리 규칙** | 분기 조건 : `changeRequestRepository.existsByRequesterId(id) \|\| deployRequestRepository.existsByRequesterIdOrApproverId(id, id) \|\| systemManagerRepository.existsByUserId(id)` → `IllegalArgumentException("요청·배포·담당자 이력이 있는 사용자는 삭제할 수 없습니다. 비활성화하세요.")` → 400<br>현행 : `deleteById` → DB FK 위반 → `handleAll` 500<br>Repository 메서드 3개 추가 (Spring Data 파생) |
| **예외 처리** | username 문자열 참조(보고·To-Do·DeployStep.completedBy)는 이력으로 보지 않음 — 삭제 가능, 현행 유지 (REQ 6절) |
| **인수 조건** | **Given** : 사용자 U 가 변경요청 1건의 requester<br>**When** : ADMIN 이 U 삭제<br>**Then** : 400 + 안내 메시지, U 존재<br>**Given** : 이력 없는 사용자 V<br>**When** : 삭제<br>**Then** : 삭제됨 (현행) |
| **확정 경위** | 12절 #22 답변 "결함". 상태 코드는 REQ 9절 미정 → 현행 매핑 400 (409 는 DEC-API-03 재결정 시) |
| **관련 요건** | DEC-DB-01, `database.md` 변경 전략 "사용자 삭제 → 비활성화" |
| **범위** | ☑ 이번 차수 |
| **검증** | `UserDeleteGuardTest` — 고정 테스트: 현행에서 예외 유형이 `DataIntegrityViolationException`(500) 인 것을 확인, 수정 후 `IllegalArgumentException` |

---

## 4. 비기능 요건

| 항목 | 기준 | 확정 경위 |
|---|---|---|
| 성능 / 응답시간 | R-002 native MAX 쿼리는 배포와 동일. R-006 exists 3회는 삭제 시에만 | 현행 수준 |
| 동시 처리 | 변경 없음 (채번 비원자성은 범위 밖) | REQ 6절 |
| 오프라인 동작 | 해당 없음 | |
| 데이터 보존 | 변경 없음 | |
| 권한 / 접근 제어 | 변경 없음. R-004 는 인증(active) 만 | L1 ①~④ 와 분리 |
| 보안 / 암호화 | R-003 로그에 비밀번호 금지 | 코딩컨벤션 |
| 장애 복구 | 해당 없음 | |

---

## 5. 인터페이스 / 연동

| 연동 대상 | 연동 방식 | 주고받는 데이터 | 비고 |
|---|---|---|---|
| 없음 | — | — | R-003 은 SMTP 호출 자체를 바꾸지 않음 |

**API 계약 변경 (FE 영향)**

| API | 현행 | 변경 | FE 영향 |
|---|---|---|---|
| `POST /api/auth/login` 실패 | 500 | **401** | `Login` 은 catch 후 고정 메시지 → 없음. axios 인터셉터의 401 처리는 토큰 삭제 → 로그인 화면엔 토큰 없으므로 무해 |
| `DELETE /api/users/{id}` 이력 있음 | 500 | **400** + 메시지 | `UserManagement` 의 `apiError` 가 `error` 필드 표시 → 메시지 그대로 노출 |
| `DELETE /api/systems/{id}/subsystems/{subId}/servers/{serverId}` 소속 불일치 | 200 (삭제됨) | **400** | 정상 UI 흐름에선 발생 안 함 |

---

## 6. 미확정 사항

| 미확정 항목 | 사유 | 영향 범위 | 결정 필요 시점 |
|---|---|---|---|
| 오류 코드 체계 (409 도입, `IllegalStateException` 매핑) | DEC-API-03 재결정 대상. 이번엔 기존 매핑 안에서 처리 | 전 API | L2 |
| 삭제된 사용자의 잔존 토큰 → 500 | R-004 범위 밖 | 인증 | L1 ① 후 |
| FE 테스트 도구 | R-001 은 수동 검증. vitest 도입은 build.md 미결정 | FE | 설계 단계 |
| 테스트 실행 방식 | `@SpringBootTest` + `local` 프로파일(H2) 로 전체 컨텍스트 기동. 기동 시 `DataInitializer` 시드(admin, SYS001·002) 가 테스트 데이터로 쓰임. 느리면 슬라이스 테스트로 전환 | 테스트 | 첫 실행 후 |

---

## 7. 요건 추적 매트릭스

| 원본 요건 | 요건 정의서 절 | 개발 요건 ID | 상태 |
|---|---|---|---|
| 현행분석서 12절 #1 | REQ 5절 1 | R-001 | 변환 완료 |
| 12절 #4 | REQ 5절 2 | R-002 | 변환 완료 |
| 12절 #5 | REQ 5절 3 | R-003 | 변환 완료 |
| 12절 #19 | REQ 5절 4 | R-004 | 변환 완료 |
| 12절 #20 | REQ 5절 5 | R-005 | 변환 완료 |
| 12절 #22 | REQ 5절 6 | R-006 | 변환 완료 |
| 12절 #10 (단계 완료 권한) | REQ 3절 제외 | — | 차기 이월 (L1 ① 후) |
| 12절 #17 (비번 변경 강제) | REQ 3절 제외 | — | 차기 이월 |

---

## 8. 질의응답 이력

| Q-ID | 질문 | 응답 | 응답자 / 일자 |
|---|---|---|---|
| Q-001 | R-001 목록은 전체 시스템인가 활성만인가 | 다른 등록 폼(변경·배포)과 같이 활성만 | 안성진 / 2026-10-19 (REQ 9절) |
| Q-002 | R-004 로그인 실패를 401 로 바꾸면 자격 증명 오류도 바뀌는데 괜찮은가 | 401 로 통일. FE 는 상태 코드 무관 | 안성진 / 2026-10-19 |
| Q-003 | R-006 "이력"에 username 문자열 참조를 포함하나 | 포함 안 함. FK 3종만 | 안성진 / 2026-10-19 (REQ 6절) |
| Q-004 | R-006 상태 코드 400 vs 409 | 이번엔 400. 409 는 오류 체계 재결정 시 | 안성진 / 2026-10-19 |

> ※ Q-001~004 는 REQ 9절 미정 사항을 L3 작성 시 확정한 것. 실제 대화 확인은 L3 승인 시.

---

## 9. 완료 판정

| 판정 항목 | 기준 | 충족 |
|---|---|:---:|
| Blocker 질문 응답 | 100% | ☑ (Q-001~004 승인, 안성진 2026-10-20) |
| 미확정 사항 명시 및 영향 판단 | 완료 | ☑ |
| 이번 차수 범위 확정 | 완료 | ☑ (6건, 2건 이월) |
| 전 요건에 확정 경위 기록 | 100% | ☑ |
| 추적 매트릭스 작성 | 완료 | ☑ |
| 참조 설계 문서 / DEC 연결 | 완료 | ☑ (설계 패키지는 작성 중 상태) |
| 구현 전 검증 기준 명시 | 완료 | ☑ (테스트 4, 수동 1, 리뷰 1) |

> ※ 위 항목이 모두 충족되어야 구현 단계로 진행합니다.

---

## 10. 구현 기록 (rsp-dev-build)

| 일자 | 단계 | 결과 |
|---|---|---|
| 2026-10-20 | Red — 목표 동작 테스트 4클래스 7케이스를 현행 코드에 실행 | 5 실패(의도한 이유: 채번 003, 로그인 200, 토큰 200, 서버 삭제됨, FK 위반), 2 통과(현행 유지 항목) |
| 2026-10-20 | 수정 — BE 9파일(Repository 3, Service 3, security 2, 예외 핸들러 1), FE 1파일 | R-001~R-006 전부 |
| 2026-10-20 | Green — 전체 테스트 + `tsc --noEmit` | 7/7 통과, tsc 통과 |
| 2026-10-20 | 수동 검증 R-001 (운영) | ☑ 이상 없음 — 안성진 |
| 2026-10-20 | 배포 | ☑ FE Vercel 자동 (push `339d9e1`). BE jar 수동 전송·재기동 — **정정**: 이때 전송한 jar 는 실행 경로 `app.jar` 를 덮어쓰지 않아 R-002~R-006 은 운영에 반영되지 않았음 (확인 당시 FE 만 검증). F-AUTH-001 배포 시 `app.jar` 교체로 함께 반영, 로그인 실패 401 실측 (2026-10-20 13:10) |
