# 데이터 설계서 — 플랫폼팀 업무 포탈 (현행 기준)

## 문서 정보

| 항목 | 내용 |
|---|---|
| 대상 영역 / 요건 | 전체. 7.현행분석서 6절 역산. 엔티티 19개 |
| 상태 | ☑ 작성 중 ☐ 검토 중 ☐ 확정 ☐ 해당 없음 |
| 결정자 | 안성진 |
| 마지막 검토일 | 2026-10-19 (초안) |

## 적용 여부

- 적용 여부: 적용. 현행 스키마 기록. **스키마 정본은 JPA 엔티티** (마이그레이션 파일 없음, `ddl-auto: update`)
- 근거: `BE/domain/*/entity/*.java`
- 재검토 조건: L1 ② (사용자 참조 방식), ⑨ (마이그레이션 도구) 결정 시. 운영 DB 덤프로 엔티티와의 차이 확인 시 (현행분석서 2.2 미조사)

## 데이터 소유와 저장소

| 데이터 | 정본 소유자 | 저장소 / 위치 | 이 서비스의 책임 |
|---|---|---|---|
| 사용자·역할 | 포탈 | `users` | 생성·비활성화·역할. 삭제는 물리 삭제 (FK 있으면 500, #22) |
| 운영시스템 계층 | 포탈 | `operation_systems`, `sub_systems`, `system_servers`, `system_managers` | 기준 정보. Redmine project key·Webex room 보관 |
| 변경·배포 요청 | 포탈 | `change_requests`, `deploy_requests` + `*_issues`, `deploy_steps` | 상태 기계, 채번, 첨부(로컬 디스크 `{id}_{원본명}`) |
| Redmine 일감·버전 | **Redmine** | Redmine DB | 포탈은 `redmine_issue_id`·`redmine_project_key`·`fixed_version` 만 참조 |
| 보고·To-Do·과제·손익·인벤토리 | 포탈 | 각 테이블 | CRUD. 작성자는 username 문자열 |
| 메뉴 권한 | 포탈 | `menu_permissions` | 기동 시 시드 (4역할×12키) |
| AI 대화·문서·프롬프트 | **AI 서버** | AI 서버 (pgvector) | 포탈은 보관하지 않음 |
| 첨부 파일 | 포탈 | 디스크 `UPLOAD_PATH` (기본값 yml·코드 불일치) | 경로를 `change_requests.attachment_path` 에 |

## 개념 모델

| 개념 / 엔티티 | 목적 | 식별자 | 상태 / 수명 | 관계 |
|---|---|---|---|---|
| User | 사용자 | id, username(unique, 불변), email(unique) | `active`, `mustChangePassword`. 물리 삭제 | ← ChangeRequest.requester, DeployRequest.requester/approver, SystemManager.user |
| OperationSystem | 운영시스템 | id, code(unique) | `active`. sortOrder | 1:N SubSystem, SystemManager. ← ChangeRequest, DeployRequest, DailyCheckReport |
| SubSystem | 서브시스템 | id, (system_id, code) unique | `active` | → OperationSystem. 1:N SystemServer |
| SystemServer | 배포 대상 서버 | id | stepOrder | → SubSystem |
| SystemManager | 시스템 담당자 | (system_id, user_id) unique | assignedAt | → OperationSystem, User |
| ChangeRequest | 변경 요청 | id, requestNo(unique, `CR-yyyy-nnn`) | Status: DRAFT→REQUESTED→APPROVED/REJECTED→COMPLETED. RedmineSyncStatus | → OperationSystem, SubSystem, User(requester). 1:N ChangeRequestIssue(cascade) |
| DeployRequest | 배포 요청 | id, deployNo(unique, `DR-yyyy-nnn`) | Status 동일. DeployType(4), DeployScope(2). parentDrId 자기 참조 | → OperationSystem, SubSystem, User ×2. 1:N Issue, DeployStep |
| DeployStep | 서버별 배포 단계 | id | PENDING→DONE. 전 단계 DONE → 요청 COMPLETED | → DeployRequest. completedBy(username) |
| InventoryItem | 수주·제안 | id | ItemType, ItemStatus(4) | 독립. client 문자열 |
| MeetingMinute / WeeklyReport / DailyCheckReport | 보고 3종 | id | WeeklyReport: ReportType INDIVIDUAL/CONSOLIDATED. DailyCheck: CheckStatus(3) | DailyCheck → OperationSystem. author/reporter = username |
| FinanceRecord | 월별 매출·지출 | id | Category REVENUE/EXPENSE | 독립 |
| KeyTask | 연간 중점과제 | id | 분기별 Plan/Result/Achievement/Reason ×4 | ← WorkUnit.keyTaskId (FK 없음) |
| WorkUnit | 업무단위 | id | Type(5), Status(3) | keyTaskId(Long). ← Todo.workUnitId |
| Todo | 할 일 | id | Status(5), Priority(3), SourceType(4)+sourceId 다형. JSON TEXT ×4 | workUnitId(Long), sourceId → ChangeRequest/DeployRequest (타입에 따라) |
| MenuPermission | 메뉴 노출 | (role, menu_key) unique | enabled | role enum |

## 무결성·보안·보존 (현행)

| DEC-ID | 항목 | 결정 | 근거 | 검증 방법 |
|---|---|---|---|---|
| DEC-DB-01 | 삭제 | 전부 물리 삭제. soft-delete 없음. `active` 플래그는 User·System·SubSystem 에만 있고 삭제와 별개 | 코드 관찰 | 사용자 삭제 시 FK 위반 500 (#22 결함) |
| DEC-DB-02 | 사용자 참조 | User FK (요청·배포·담당자) / username 문자열 (보고·To-Do·DeployStep). username 불변 | 12절 #2 미고려 | **L1 ② 재결정** |
| DEC-DB-03 | FK 없는 참조 | `work_units.key_task_id`, `todos.work_unit_id`, `todos.source_id`(다형), `deploy_requests.parent_dr_id` | 코드 관찰 | 참조 무결성 DB 미보장. L1 ⑥ |
| DEC-DB-04 | 채번 | DeployRequest: `MAX(seq)+1` (native). ChangeRequest: `count+1` (#4 결함, 삭제 후 중복) | `946f3d6` 이력 | #4 수정 후 동일 방식 |
| DEC-DB-05 | JSON 컬럼 | Todo 4컬럼 TEXT + Jackson AttributeConverter. 파싱 실패 시 빈 값, 로그 없음 (#3 보류) | 코드 관찰 | **값 객체 필드 삭제 금지** |
| DEC-DB-06 | 감사 컬럼 | `createdAt` 대부분(`@CreatedDate`). `updatedAt` 은 KeyTask·Todo·WorkUnit 만. 변경자·이력 없음 | 코드 관찰 | 로그·감사 정책 L1 설계 단계 결정 |
| DEC-DB-07 | 비밀값 | 비밀번호 BCrypt. 임시 비밀번호는 응답·메일에 평문 | 코드 관찰 | 11절 |
| DEC-DB-08 | 컬럼 명명 | snake_case, 테이블 복수형. 예외: `key_tasks.year` 예약어 그대로 | 코드 관찰 | — |
| DEC-DB-09 | 보존 | 보존 기간·삭제 정책 없음 | — | L2 |

## 변경 전략과 미결정

| 항목 | 영향 | 전환 / 롤백 방식 | 결정 필요 시점 |
|---|---|---|---|
| 마이그레이션 도구 도입 (L1 ⑨) | 전체. `ddl-auto: update` 는 컬럼 삭제·타입 변경 미반영 | 운영 DB 덤프 → baseline → 이후 Flyway/Liquibase. 롤백 불가 변경은 사전 백업 | 다음 스키마 변경 전 |
| 사용자 참조 통일 (DEC-DB-02) | 보고 3종, Todo, DeployStep 컬럼 추가·백필 | username → user_id 백필 스크립트. username 불변이라 1:1 매핑 가능 | L1 ② |
| 사용자 삭제 → 비활성화 (#22) | UserService.delete | 삭제 API 를 `active=false` 로 전환하거나 FK 존재 시 409 | 2차 |
| 운영 스키마 ≠ 엔티티 가능성 | 미조사 | 운영 DDL 덤프와 엔티티 비교 | 마이그레이션 baseline 시 |
