# 개발 요건 정의서 — F-AUTH-001 권한·식별 모델 적용

> **작성 주체** : 개발 담당자 (AI 요건 상세화 결과 반영)
> **입력** : **L1 10절 ①②④ 결정 (2026-10-20)** + 7.현행분석서 12절 #9·#10·#15·#17 + 설계 패키지(현행 기준)
> **인수 시스템** : L2 없음 → L1 결정과 현행분석서가 원본. 설계 패키지는 "현행 기준 작성 중"이며 이번 변경은 DEC-AS-04(인가 방식)를 **부분 적용**(소유자·담당자 판정을 서비스로)하되 재결정은 하지 않음 — 역할 검사는 `@PreAuthorize`, 소유자·담당자 검사는 서비스, 거부는 `AccessDeniedException`(403)
> **용도** : 개발 착수 기준 문서. 이 문서가 확정되어야 구현 단계로 진행합니다.

---

## 1. 문서 정보

| 항목 | 내용 | 항목 | 내용 |
|---|---|---|---|
| 요건 ID | F-AUTH-001 | 버전 | 0.1 |
| 원본 L2 요건서 | 없음 → `docs/output/2.기능영역정의서(L1).md` 10절 ①②④, 5절 권한 모델 | 확정일 | 2026-10-20 |
| 권장 저장 위치 | `4.개발요건정의서(L3)/F-AUTH-001_권한식별모델적용.md` | 상태 | ☐ 작성 중 ☐ 검토 중 ☑ 확정 |
| 개발 담당 | 안성진 (AI 구현 보조) | 현업 담당 | 안성진 |
| 참조 설계 문서 | `docs/output/design/architecture.md`, `api.md`, `design.md` | 관련 DEC | DEC-AS-03(인증), DEC-AS-04(인가, 부분 적용), DEC-AS-07(라우트 가드), DEC-API-03(오류), DEC-UI-07·08 |

---

## 2. 요건 요약

L1에서 확정한 권한·식별 모델을 코드에 적용한다. ① 보고류·To-Do에 소유자 검사(소유자 또는 관리자), ④ EXTERNAL을 요청자로 한정(배포 API 차단, 담당자 판정에서 제외, 배포 단계 완료 권한), #17 비밀번호 변경 강제를 프론트 가드와 백엔드 필터 양쪽에, ② username 정식 식별자에 따른 보고류·To-Do 응답의 이름 매핑. 회의록·업무단위는 ① 예외로 변경 없음. 권한 거부는 전부 `AccessDeniedException` → 403으로 통일한다(현행 배포 서비스는 500).

---

## 3. 확정 기능 요건

### R-001 주간보고 소유자 검사

| 항목 | 내용 |
|---|---|
| **출처** | L1 ①, 현행분석서 12절 #9 |
| **요건 내용** | 개인 주간보고 수정·삭제는 작성자 본인 또는 ADMIN/MANAGER만, 통합 주간보고 수정·삭제는 ADMIN/MANAGER만 |
| **선행 조건** | 인증된 사용자 |
| **현행 동작** | `WeeklyReportService.update/delete(id, …)` 가 id만 받아 검사 없이 처리 (`WeeklyReportService.java:68-79`). 컨트롤러 PUT/DELETE에 principal 전달 없음 (`WeeklyReportController.java:59-70`) |
| **처리 규칙** | 분기 조건 : `reportType == CONSOLIDATED` → `isAdminOrManager` 아니면 거부. `INDIVIDUAL` → `author.equals(username) ∥ isAdminOrManager` 아니면 거부<br>변경 : 서비스 시그니처 `update(id, req, actorUsername)`, `delete(id, actorUsername)`. 컨트롤러가 `@AuthenticationPrincipal` 전달. 역할은 `UserRepository.findByUsername` |
| **예외 처리** | 거부 → `AccessDeniedException("본인 보고서만 수정할 수 있습니다.")` → 403. 대상 없음 → 400 (현행) |
| **인수 조건** | **Given** MEMBER A의 개인 보고서 **When** A 수정 **Then** 200<br>**Given** 같은 보고서 **When** MEMBER B 수정·삭제 **Then** 403, 데이터 불변<br>**Given** 같은 보고서 **When** MANAGER 수정 **Then** 200<br>**Given** 통합 보고서 **When** MEMBER(작성자 아님) 삭제 **Then** 403 |
| **확정 경위** | L1 ① 결정 (안성진, 2026-10-20) |
| **관련 요건** | R-002, R-003 (같은 패턴) |
| **범위** | ☑ 이번 차수 |
| **검증** | `WeeklyReportOwnershipTest` 4케이스 |

### R-002 일일점검 소유자 검사

| 항목 | 내용 |
|---|---|
| **출처** | L1 ① |
| **요건 내용** | 수정·삭제는 보고자(reporter) 본인 또는 ADMIN/MANAGER만 |
| **현행 동작** | `DailyCheckReportService.update/delete` 검사 없음 (`DailyCheckReportService.java:52-68`) |
| **처리 규칙** | `reporter.equals(username) ∥ isAdminOrManager`. R-001과 동일 패턴 |
| **예외 처리** | 403 |
| **인수 조건** | **Given** A의 점검 **When** B 삭제 **Then** 403 / **When** A 또는 MANAGER **Then** 성공 |
| **확정 경위** | L1 ① |
| **범위** | ☑ 이번 차수 |
| **검증** | `DailyCheckOwnershipTest` 2케이스 |

### R-003 To-Do 소유자 검사

| 항목 | 내용 |
|---|---|
| **출처** | L1 ① |
| **요건 내용** | 수정·삭제는 담당자(assignee) 또는 협업자(collaborators 포함) 또는 ADMIN/MANAGER만 |
| **현행 동작** | `TodoService.update/delete` 검사 없음 (`TodoService.java:41-51`). 컨트롤러는 담당자 변경 권한만 관리자로 제한 (`TodoController.java:37-51`) |
| **처리 규칙** | `assignee.equals(username) ∥ collaborators.contains(username) ∥ isAdminOrManager`. 담당자 변경 규칙(관리자만)은 현행 유지 |
| **예외 처리** | 403 |
| **인수 조건** | **Given** A 담당, C 협업자인 To-Do **When** C 수정 **Then** 200 / **When** B(무관) 수정 **Then** 403 / **When** B 삭제 **Then** 403 |
| **확정 경위** | L1 ① |
| **범위** | ☑ 이번 차수 |
| **검증** | `TodoOwnershipTest` 3케이스 |

### R-004 배포 단계 완료 권한 (#10)

| 항목 | 내용 |
|---|---|
| **출처** | L1 ④ 파생, 현행분석서 12절 #10 (결함) |
| **요건 내용** | 단계 완료는 해당 시스템 담당자(MEMBER) 또는 ADMIN/MANAGER만. EXTERNAL은 담당자로 등록돼 있어도 불가 |
| **현행 동작** | `DeployStepService.complete` 가 이미 DONE인지만 검사 (`DeployStepService.java:31-35`). 컨트롤러 `POST /steps/{stepId}/complete` `@PreAuthorize` 없음 (`DeployRequestController.java:76`) |
| **처리 규칙** | `isAdminOrManager ∥ (role == MEMBER && systemManagerRepository.existsBySystemIdAndUserId(dr.system.id, actor.id))` 아니면 거부. 전환·알림 로직은 현행 유지 (12절 #11·#12 의도) |
| **예외 처리** | `AccessDeniedException("해당 시스템의 담당자만 단계를 완료할 수 있습니다.")` → 403. 이미 완료는 현행 `IllegalStateException`(500) 유지 — 오류 체계 재결정 범위 |
| **인수 조건** | **Given** 시스템 S의 APPROVED 배포, 단계 1개 **When** S 담당자(MEMBER) 완료 **Then** 200, DONE / **When** EXTERNAL(S 담당자로 등록) **Then** 403 / **When** 무관 MEMBER **Then** 403 / **When** ADMIN **Then** 200 |
| **확정 경위** | L1 ④ A 결정 |
| **관련 요건** | R-005, R-006 |
| **범위** | ☑ 이번 차수 |
| **검증** | `DeployStepPermissionTest` 4케이스 |

### R-005 배포 상태 전환 규칙 통일 (#15)

| 항목 | 내용 |
|---|---|
| **출처** | L1 ④, 현행분석서 12절 #15 (미고려 → ④로 결정) |
| **요건 내용** | 배포 요청의 "시스템 담당자" 판정에서 EXTERNAL 제외. 권한 거부는 403 |
| **현행 동작** | `DeployRequestService.changeStatus` 의 `isSystemManager` 가 역할 무시 (`DeployRequestService.java:139-140`) → EXTERNAL 담당자가 비RELEASE 승인·제출·완료 가능. 권한 거부가 `IllegalStateException` → **500** (`:149-156`). `ChangeRequestService:191` 주석 "ADMIN 또는 시스템 담당자만"이 코드(MANAGER 포함, 담당자는 MEMBER 한정)와 다름 |
| **처리 규칙** | `isSystemManager = role == MEMBER && existsBySystemIdAndUserId(...)`. 제출·승인·반려·완료의 기존 분기(RELEASE는 관리자만, #14 제출 규칙 차이)는 유지. 권한 거부 3곳을 `AccessDeniedException`으로. CR 주석 정정 |
| **예외 처리** | 403. 전환표 위반(`%s → %s 전환 불가`)은 현행 500 유지 |
| **인수 조건** | **Given** S의 REQUESTED 비RELEASE 배포 **When** EXTERNAL(S 담당자) 승인 **Then** 403 (현행 200) / **When** MEMBER(S 담당자) 승인 **Then** 200 / **When** 무관 MEMBER 승인 **Then** **403** (현행 500) |
| **확정 경위** | L1 ④ |
| **범위** | ☑ 이번 차수 |
| **검증** | `DeployRequestPermissionTest` 3케이스 |

### R-006 EXTERNAL 배포 API 차단

| 항목 | 내용 |
|---|---|
| **출처** | L1 ④ |
| **요건 내용** | `/api/deploy-requests/**` 전체를 ADMIN/MANAGER/MEMBER만 호출 가능 |
| **현행 동작** | `DeployRequestController` 클래스·메서드에 `@PreAuthorize` 없음. 메뉴만 숨김 (`MenuPermissionService` 시드 `deploys=false`) |
| **처리 규칙** | 클래스 레벨 `@PreAuthorize("hasAnyRole('ADMIN','MANAGER','MEMBER')")`. GET 포함 |
| **예외 처리** | 403. **영향**: 대시보드가 역할 무관하게 `/deploy-requests` 를 조회(`Dashboard/index.tsx:88`, `enabled` 없음) → EXTERNAL은 403을 받고 react-query 에러 상태. 카드는 `can('deploys')` 로 이미 숨겨져 있어 화면 영향 없음. 콘솔 에러만 남음 → Q-002 |
| **인수 조건** | **Given** EXTERNAL 토큰 **When** `GET /api/deploy-requests` **Then** 403 / **Given** MEMBER 토큰 **Then** 200 |
| **확정 경위** | L1 ④ |
| **범위** | ☑ 이번 차수 |
| **검증** | `DeployApiRoleTest` (MockMvc) 2케이스 |

### R-007 비밀번호 변경 강제 — 프론트 가드 + 백엔드 필터 (#17)

| 항목 | 내용 |
|---|---|
| **출처** | 현행분석서 12절 #17 (결함), 결정 "둘 다" (안성진, 2026-10-20) |
| **요건 내용** | `mustChangePassword=true` 사용자는 비밀번호를 바꾸기 전까지 다른 API·화면을 쓸 수 없다 |
| **현행 동작** | 로그인 직후 `navigate('/change-password')` 1회뿐 (`Login/index.tsx:22`). `PrivateRoute` 는 토큰 유무만 (`App.tsx:32-35`). 백엔드에 `mustChangePassword` 참조 필터 없음. 로그인 응답에서 정상 JWT 발급 |
| **처리 규칙** | **BE**: `CustomUserDetailsService` 가 `mustChangePassword` 를 담은 `PortalUserDetails`(Spring `User` 상속) 반환. `JwtAuthFilter` 에서 인증 세팅 후 `mustChangePassword && !허용경로` 면 403 JSON `{"error":"비밀번호 변경이 필요합니다.","code":"PASSWORD_CHANGE_REQUIRED"}` 반환하고 체인 중단. 허용 경로: `/api/auth/**`, `POST /api/users/change-password`, `GET /api/menu-permissions` (Q-001)<br>**FE**: `PrivateRoute` 에서 `user?.mustChangePassword && pathname !== '/change-password'` → `<Navigate to="/change-password">`. `user` 는 새로고침 시 `refreshMe` 로 복원되므로 우회 불가. 로드 전(`user == null`)에는 현행처럼 렌더 — BE가 막음 |
| **예외 처리** | 403 + `code`. axios 인터셉터는 401만 처리하므로 403은 페이지 에러로 표시됨. FE 가드가 먼저 걸리므로 정상 흐름에선 안 보임 |
| **인수 조건** | **Given** `mustChangePassword=true` 사용자 U의 JWT **When** `GET /api/systems` **Then** 403, body.code = PASSWORD_CHANGE_REQUIRED / **When** `GET /api/auth/me` **Then** 200 / **When** `POST /api/users/change-password` (올바른 요청) **Then** 200, 이후 `GET /api/systems` 200<br>**FE (수동)**: U 로그인 → 새로고침 → URL에 `/requests` 입력 → `/change-password` 로 되돌아감 |
| **확정 경위** | 결정 "둘 다" |
| **범위** | ☑ 이번 차수 |
| **검증** | `PasswordChangeRequiredTest` (MockMvc) 3케이스 + FE 수동 |

### R-008 보고류·To-Do 응답에 이름 매핑 (②)

| 항목 | 내용 |
|---|---|
| **출처** | L1 ② A+ |
| **요건 내용** | 주간보고·회의록·일일점검·To-Do 응답에 `authorName`/`reporterName`/`assigneeName` 추가. 프론트 표시 위치에서 이름 우선, 없으면 username |
| **현행 동작** | Response DTO에 username만 (`WeeklyReportDto.java:43`, `MeetingMinuteDto.java:36`, `DailyCheckReportDto.java:33`, `TodoDto.java:52`). 화면은 username 표시 (`WeeklyReport/index.tsx` 17곳, `MeetingMinutes` 2곳, `DailyCheck:157`) |
| **처리 규칙** | 서비스 목록 조회 시 username 집합 → `UserRepository.findByUsernameIn` 1회 → `Map<username, name>` → DTO 생성자에 name 전달(기존 생성자 유지 + 오버로드). 사용자 없음(삭제됨) → name null → FE가 username 표시<br>FE: **표시 위치만** `r.authorName ?? r.author`. 비교(`isMine`)·그룹 키·필터는 username 유지 (Q-004) |
| **예외 처리** | 없음 |
| **인수 조건** | **Given** 이름 "안성진"인 `sungjin.an` 의 주간보고 **When** 목록 조회 **Then** `authorName == "안성진"`, `author == "sungjin.an"` / **Given** 삭제된 사용자의 보고 **Then** `authorName == null` |
| **확정 경위** | L1 ② |
| **범위** | ☑ 이번 차수 (BE + FE 표시) |
| **검증** | `ReportAuthorNameTest` 2케이스 + FE `tsc` + 수동 |

### R-009 개인 주간보고 단건 조회 소유자 검사 (리뷰 보완)

| 항목 | 내용 |
|---|---|
| **출처** | 2026-10-20 코드 리뷰 #1. L1 ① 의 읽기 범위 일관성 |
| **요건 내용** | `GET /api/weekly-reports/{id}` 개인 보고서는 작성자 본인 또는 ADMIN/MANAGER만. 통합 보고서는 현행대로 전원 조회 가능 |
| **현행 동작** | `WeeklyReportService.findById` 검사 없음 → 목록(`findAll`)은 MEMBER 에게 본인 것만 주면서 id 로 직접 조회하면 남의 개인 보고서가 읽힘. 기존부터 있던 구멍. FE 는 `weeklyApi.get` 미사용이라 화면 영향 없음 |
| **처리 규칙** | `reportType == INDIVIDUAL && !author.equals(actor) && !isAdminOrManager` → 403 |
| **인수 조건** | **Given** A 의 개인 보고서 **When** B 가 `GET /{id}` **Then** 403 / **When** A 또는 MANAGER **Then** 200 / **Given** 통합 보고서 **When** MEMBER **Then** 200 |
| **범위** | ☑ 이번 차수 |
| **검증** | `WeeklyReportReadTest` 3케이스 |

### R-010 세션 중 비밀번호 초기화 시 자동 이동 (리뷰 보완)

| 항목 | 내용 |
|---|---|
| **출처** | 코드 리뷰 #2 |
| **요건 내용** | 로그인 중 관리자가 비밀번호를 초기화해 서버 플래그가 바뀌면, 다음 API 호출의 403 `PASSWORD_CHANGE_REQUIRED` 를 받아 `/change-password` 로 이동 |
| **현행 동작** | axios 인터셉터는 401 만 처리 (`FE/api/client.ts`). `PrivateRoute` 는 로그인 시점의 `user.mustChangePassword=false` 를 그대로 봄 → 새로고침 전까지 정체불명 오류 |
| **처리 규칙** | 응답 인터셉터: `status 403 && data.code === 'PASSWORD_CHANGE_REQUIRED' && pathname !== '/change-password'` → `window.location.assign('/change-password')` (전체 리로드로 `refreshMe` 재실행 → 가드가 유지) |
| **인수 조건** | **Given** 로그인 세션, 관리자가 초기화 **When** 아무 화면 조작 **Then** `/change-password` 로 이동 (수동) |
| **범위** | ☑ 이번 차수 |
| **검증** | FE 테스트 도구 없음 → `tsc` + 수동 |

### R-011 새로고침 직후 가드 대기 (리뷰 보완)

| 항목 | 내용 |
|---|---|
| **출처** | 코드 리뷰 #3 |
| **요건 내용** | 토큰은 있고 `user` 가 아직 로드되지 않은 동안은 보호 화면을 렌더하지 않고 로딩 표시 |
| **현행 동작** | `PrivateRoute` 가 `user == null` 이면 자식을 렌더 → Dashboard 등 쿼리가 먼저 나가 `mustChangePassword` 사용자는 403 을 받고 콘솔 에러, 이후 리다이렉트 |
| **처리 규칙** | `token && !user` → `<Loading/>`. `refreshMe` 실패 시 토큰 제거 → `/login` (현행 유지) |
| **인수 조건** | **Given** `mustChangePassword=true` 사용자 **When** `/` 새로고침 **Then** 403 요청 0건, 바로 `/change-password` (수동, Network 탭) |
| **범위** | ☑ 이번 차수 |
| **검증** | `tsc` + 수동 |

---

## 4. 비기능 요건

| 항목 | 기준 | 확정 경위 |
|---|---|---|
| 성능 / 응답시간 | R-001~005 는 요청당 `findByUsername` 1회 추가(현행 CR 서비스와 동일). R-008 은 목록당 `findByUsernameIn` 1회 | 현행 수준 |
| 동시 처리 | 변경 없음 | |
| 오프라인 동작 | 해당 없음 | |
| 데이터 보존 | 스키마 변경 없음 (② A+) | L1 ② |
| 권한 / 접근 제어 | 역할 = `@PreAuthorize`, 소유자·담당자 = 서비스, 거부 = `AccessDeniedException` 403 | DEC-AS-04 부분 적용 |
| 보안 / 암호화 | R-007 로 임시 비밀번호 상태의 API 사용 차단 | #17 |
| 장애 복구 | 해당 없음 | |

---

## 5. 인터페이스 / 연동

**API 계약 변경 (FE 영향)**

| API | 현행 | 변경 | FE 영향 |
|---|---|---|---|
| `PUT/DELETE /api/weekly-reports/{id}`, `/daily-checks/{id}`, `/todos/{id}` 타인 건 | 200 | **403** | 화면이 본인 것만 수정 UI를 보여주는지 확인 필요 — 주간보고는 `isMine` 분기 있음. 회의록은 변경 없음 |
| `POST /api/deploy-requests/steps/{id}/complete` 권한 없음 | 200 | **403** | 배포 화면 `alert(apiError)` 로 표시 |
| `PATCH /api/deploy-requests/{id}/status` 권한 없음 | 500 | **403** | 동일 |
| `/api/deploy-requests/**` EXTERNAL | 200 | **403** | 대시보드 조용한 에러 (Q-002) |
| 모든 API, `mustChangePassword=true` | 200 | **403 + code** | `PrivateRoute` 가드로 정상 흐름에선 미발생 |
| 보고류·To-Do GET 응답 | — | `*Name` 필드 **추가** (호환) | 표시만 변경 |

---

## 6. 미확정 사항

| 미확정 항목 | 사유 | 영향 범위 | 결정 필요 시점 |
|---|---|---|---|
| Q-001 R-007 허용 경로 범위 | `/api/menu-permissions` 를 허용하지 않으면 `refreshMe` 가 에러를 삼켜 메뉴가 전부 보임(기본 허용) | 인증 필터 | L3 승인 시 → **제안: 허용** |
| Q-002 R-006 대시보드 EXTERNAL 403 | 조용한 에러를 그대로 둘지, `useQuery` 에 `enabled: can('deploys')` 를 넣을지 | Dashboard | L3 승인 시 → **제안: `enabled` 추가** (7개 쿼리 전부, 1줄씩) |
| Q-003 R-005 권한 거부 500→403 | 배포 화면이 500 메시지 형식에 의존하는지 | DeployRequest 페이지 | **제안: 403 으로** — `apiError` 는 `error` 필드만 읽어 형식 동일 |
| Q-004 R-008 FE 범위 | 표시 위치만 바꿀지, 비교 키까지 이름으로 갈지 | 3 페이지 | **제안: 표시만** — 동명이인 가능, username 이 식별자(L1 ②) |
| 오류 코드 체계 (409 등) | DEC-API-03 재결정 대상. 이번엔 403/400/500 현행 매핑 안에서 | 전 API | L2 |
| 인가 방식 완전 통일 (DEC-AS-04) | 이번엔 변경 대상 서비스만 패턴 적용. 나머지(시스템·사용자 등)는 그대로 | 전체 | 설계 단계 |

---

## 7. 요건 추적 매트릭스

| 원본 요건 | 요건 정의서 절 | 개발 요건 ID | 상태 |
|---|---|---|---|
| L1 ① 소유자 검사 | 10절 ① | R-001, R-002, R-003 | 변환 완료 |
| L1 ④ EXTERNAL / 12절 #10 | 10절 ④ | R-004 | 변환 완료 |
| L1 ④ / 12절 #15 | 10절 ④ | R-005 | 변환 완료 |
| L1 ④ 배포 API | 10절 ④ | R-006 | 변환 완료 |
| 12절 #17 | — | R-007 | 변환 완료 |
| L1 ② 이름 표시 | 10절 ② | R-008 | 변환 완료 |
| L1 ① 회의록·업무단위 | 10절 ① 예외 | — | 범위 제외 (현행 유지) |
| 12절 #11·#12·#14 | — | — | 범위 제외 (의도) |

---

## 8. 질의응답 이력

| Q-ID | 질문 | 응답 | 응답자 / 일자 |
|---|---|---|---|
| Q-001 | 비밀번호 변경 강제 시 허용 경로에 메뉴 권한 조회를 포함하나 | 포함 | 안성진 / 2026-10-20 |
| Q-002 | EXTERNAL 대시보드 403 처리 | 쿼리 7개에 `enabled: can(key)` | 안성진 / 2026-10-20 |
| Q-003 | 배포 권한 거부 500 → 403 | 403 | 안성진 / 2026-10-20 |
| Q-004 | 이름 매핑 FE 범위 | 표시만. 비교·키는 username | 안성진 / 2026-10-20 |

---

## 9. 완료 판정

| 판정 항목 | 기준 | 충족 |
|---|---|:---:|
| Blocker 질문 응답 | 100% | ☑ (Q-001~004 승인, 안성진 2026-10-20) |
| 미확정 사항 명시 및 영향 판단 | 완료 | ☑ |
| 이번 차수 범위 확정 | 완료 | ☑ (8건, 예외·의도 항목 제외 명시) |
| 전 요건에 확정 경위 기록 | 100% | ☑ |
| 추적 매트릭스 작성 | 완료 | ☑ |
| 참조 설계 문서 / DEC 연결 | 완료 | ☑ (DEC-AS-04 부분 적용 명시) |
| 구현 전 검증 기준 명시 | 완료 | ☑ (테스트 7클래스 ~20케이스, FE tsc + 수동 2) |

> ※ 위 항목이 모두 충족되어야 구현 단계로 진행합니다.

---

## 10. 구현 기록 (rsp-dev-build 가 채움)

| 일자 | 단계 | 결과 |
|---|---|---|
| 2026-10-20 | Red — MockMvc 테스트 7클래스 22케이스를 현행 코드에 실행 (HTTP 경유라 시그니처 변경과 무관) | 12 실패(전부 의도한 이유: 403 기대에 200/204/500, `authorName` 없음), 10 통과(현행 유지 케이스) |
| 2026-10-20 | 수정 — BE 신규 2(`UserLookup`, `PortalUserDetails`) + 수정 15(서비스 5, 컨트롤러 4, DTO 4, security 2), FE 6(App 가드, Dashboard `enabled` 6, api 타입 2, 표시 교체 12곳) | R-001~R-008 |
| 2026-10-20 | Green — 전체 테스트 29/29 (F-FIX-001 7 + F-AUTH-001 22), `tsc --noEmit` 통과 | 1차 실행 28/29 → 테스트 단언 오류(`[null]` 언래핑) 수정 후 29/29 |
| 2026-10-20 | 구현 중 결정 | R-008: 통합 보고서 항목(`WorkItem.author`)은 본문 JSON 에 직렬화되는 데이터라 이름 매핑 **제외**, username 유지 (L1 ② — 이름 스냅샷을 콘텐츠에 저장하지 않음). 표시 교체는 주간보고 7곳·회의록 2곳·일일점검 1곳 |
| 2026-10-20 | 배포 | ☑ FE Vercel 자동 (push `10fc8ad`). ☑ BE jar 수동 — **1차 실패**: 전송한 jar 가 실행 경로의 `app.jar` 를 덮어쓰지 않아 재기동해도 8월 20일자 코드가 그대로 서빙됨 (`weekly-reports` 응답에 `authorName` 없음, 로그인 실패 500 으로 확인). `app.jar` 교체 후 재기동 → 외부 실측 로그인 실패 **401** 로 반영 확인 (13:10) |
| 2026-10-21 | 보완 R-009~011 (코드 리뷰 3건) | Red: `WeeklyReportReadTest` 3케이스 중 1 실패(403 기대, 200). 수정: BE `findById(id, actor)` + 컨트롤러, FE `client.ts` 403 코드 처리, `PrivateRoute` 로딩 대기. Green: **32/32**, `tsc` 통과 |
| 2026-10-21 | 보완분 배포 | ☑ FE Vercel 자동 (push `5c8c416`). ☑ BE `gradlew clean bootJar test` 32/32 → jar 를 `app.jar` 로 교체·재기동 (안성진, 13:40 경). 외부 실측: 틀린 비밀번호 로그인 **401**, 비인증 `weekly-reports/{id}` **403** — 신 코드 서빙 확인. R-009(타인 개인 보고서 단건 403)는 계정 필요 → 수동 검증 항목에 포함 |
| | 수동 검증 (R-007 FE 가드, R-008 표시, R-009 타인 개인 보고서 단건 403, R-010 세션 중 초기화, R-011 새로고침 시 403 0건) | ☐ 미실시 — 안성진 |
