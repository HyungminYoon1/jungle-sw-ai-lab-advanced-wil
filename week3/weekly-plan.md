# Week 3 학습 계획 — PostgreSQL·Transaction·Lock·Index

> 작성일: 2026-08-30
> 상태: Completed
> 기간: 2026-08-31 ~ 2026-09-06
> 핵심 질문: Database의 Transaction과 실행 계획이 Ticket의 일관성과 조회 성능에 어떤 영향을 주는가?
> 운영 Baseline: Git 상태 확인·Diff Review·작은 Commit과 기존 33개 Test 회귀 확인

## 계획 배경

Week 2에는 In-memory Repository를 이용한 Ticket 생성·조회 API와 대표 오류 계약을 구현했다. Filter·Interceptor·Exception Handler의 선택 기준은 설명하고 Test로 확인했지만 Exception 처리 Class·Method 이름을 자료 없이 즉시 재구성하는 데 시간이 걸렸다. 따라서 월요일 첫 Block에서 해당 흐름을 짧게 복습한 뒤 Week 3의 Database 학습으로 전환한다.

Database 공지는 정규화, RDB·NoSQL, Index, N+1, Connection Pool, Transaction·Isolation, Lock·Deadlock, Replication과 Query 최적화를 모두 제시한다. 한 주에 모든 항목을 구현하면 설정과 Framework 연결이 학습을 압도할 가능성이 높다. 이번 주에는 데이터 무결성, 동시성, 실행 계획이라는 하나의 흐름을 SQL로 깊게 확인하고, JPA·Testcontainers 적용은 그 결과를 설명할 수 있을 때만 최소 범위로 진행한다.

## 목표

| 구분 | 목표 | 완료 근거 |
|---|---|---|
| 복습 | Week 2 오류 흐름과 Filter·Interceptor 책임을 자료 없이 설명 | 세 흐름 설명과 대상 Test 범위 구분 |
| 개념 | Schema·Transaction·Lock·Index의 목적과 Trade-off 설명 | Learning Note 또는 Study Note |
| 실험 | 실패·동시 수정·Index 전후 실행 계획 재현 | SQL Trace, Transaction 결과와 `EXPLAIN ANALYZE` |
| 선택 적용 | 기존 Repository Port 뒤에 PostgreSQL Adapter를 필요한 범위만 연결 | 작은 Diff와 실제 PostgreSQL Integration Test |
| 공개 기록 | 완료·부분 완료·비범위와 다음 질문 정리 | 핵심 Lab Report와 Week 3 WIL |

## Baseline

| 항목 | 현재 상태 | 이번 주 확인 |
|---|---|---|
| 선행 이해 | HTTP 요청·Layer 흐름과 In-memory Repository 구현 | 월요일 Exception·공통 처리 복습 Gate |
| Java·Build | Temurin JDK 25.0.4, Maven 3.9.16, Spring Boot 4.1.1 | 새 Terminal에서 Version과 기존 33개 Clean Test 확인 |
| Source | `TicketRepository` Port와 `InMemoryTicketRepository`, 생성·단건 조회 API | Port·Domain 책임을 유지하고 Adapter만 필요한 범위로 추가 |
| PostgreSQL 환경 | PostgreSQL Server 17.11·`psql` Client 17.7, Service와 `ai_helpdesk_learning_lab` 인증 접속 `VERIFIED` | SQL Spike 결과를 날짜별 Note에 유지 |
| Transaction·동시성 SQL | 정상 Commit·실패 Rollback과 두 Session MVCC·Lock·Lost Update·Deadlock `USER_VERIFIED` | Index·실행 계획 학습으로 전환 |
| Index·실행 계획 SQL | 고정 100,000건 Dataset의 단일·복합 Index, 정렬·`LIMIT`과 Buffer 비교 `USER_VERIFIED` | Query Plan Lab Report로 결과·한계 유지 |
| 영속 의존성 | Driver·JPA·Migration·Testcontainers `NOT_IMPLEMENTED` | SQL 실험 뒤 필요한 Artifact를 공식 문서와 실제 Classpath로 확인 |
| Blocker | 핵심 SQL Spike의 즉시 Blocker 없음 | Application 연동은 Driver·Migration·Test 환경 선택 전 시작하지 않음 |

Credential은 존재 여부와 연결 성공만 확인하고 값을 Terminal·문서·Commit에 출력하지 않는다. PostgreSQL Version과 실행 환경은 실제 명령 결과로 확정했고, 9월 1일에는 학습용 Database를 생성하여 Table·Constraint SQL을 재현했다. 9월 3일 실험 중 Minor Update로 연결이 종료된 뒤 Server 17.11에 재접속했고 Commit되지 않은 변경이 남지 않은 것도 확인했다.

## 시간 배분

| 활동 | 계획 비율 | 종료 조건 |
|---|---:|---|
| 개념·공식 자료 | 25% | Schema·Transaction·Lock·Index의 역할을 흐름으로 설명 |
| 최소 재현 실험 | 40% | 예상·조건·관찰·해석과 실패 결과가 있음 |
| Helpdesk 선택 적용 | 20% | 기존 Port를 유지한 최소 Adapter와 Integration Test |
| 설명·Review·WIL | 15% | Query Plan·한계와 다음 질문 기록 |

월요일 Week 2 복습은 첫 학습 Block 하나로 제한한다. 복습이 길어지면 Database 시간을 줄이지 않고 남은 이름 암기를 후속 질문으로 이동한다.

## 학습 범위

### 포함

- 정규화, Key·관계와 Constraint
- ACID, Commit·Rollback과 Transaction 경계
- PostgreSQL Isolation Level과 MVCC의 관찰 가능한 결과
- Lost Update, Row Lock 대기와 간단한 Deadlock
- 단일·복합 Index와 선택도
- `EXPLAIN (ANALYZE, BUFFERS)`의 Plan Node·실제 Row·비용 해석
- PostgreSQL Migration·Repository Adapter와 실제 Database Integration Test의 최소 적용

### 포함하지 않음

- Replication, Sharding, High Availability와 Backup 운영
- RDB·NoSQL 두 Service 구현
- Production 규모 부하·성능 수치 주장
- Cache, Queue와 Search Engine
- 모든 Domain의 JPA Mapping과 전체 CRUD
- Week 4 인증·인가 선행 구현

### 조건부 후속·선정 제외

- JPA N+1은 실제 연관 Mapping과 SQL Log가 생긴 경우에만 재현한다.
- Connection Pool은 실제 PostgreSQL 연결 뒤 대기·고갈을 측정할 질문과 도구가 준비된 경우만 수행한다.
- 낙관적·비관적 Lock을 모두 구현하지 않는다. Lost Update 뒤 한 전략을 먼저 적용하고 시간이 남을 때 비교한다.
- 반정규화는 정규화 Schema의 Query Plan에서 실제 비용이 확인되기 전에는 적용하지 않는다.

## 학습 계획

| 학습 주제 | 상태 | 질문 | 방법 | 증거 |
|---|---|---|---|---|
| Week 2 오류·공통 처리 | 조건부 후속 | 실패를 누가 발견·해석·HTTP로 변환하는가? | 자료 없는 흐름 설명과 대상 Test Review | 8월 31일 Study Note |
| 정규화·Constraint | 핵심 학습 | 중복과 잘못된 상태를 Schema가 어떻게 막는가? | 비정규 Ticket 장부와 정규화 Schema 비교 | DDL·실패 SQL과 이상 현상 설명 |
| Transaction·ACID | 핵심 학습 | 여러 변경 중 하나가 실패하면 어떤 상태가 남는가? | `BEGIN`·오류·`ROLLBACK`, 정상 `COMMIT` 비교 | 전후 Row와 Transaction Trace |
| Isolation·Lock | 핵심 학습 | 두 Session이 같은 Ticket을 수정하면 무엇이 보이는가? | Lost Update, Lock 대기와 Deadlock 최소 재현 | Session A·B 실행 순서와 결과 |
| Index·실행 계획 | 핵심 학습 | 같은 Query에서 Planner 선택이 왜 달라지는가? | 고정 Dataset, Index 전후 `EXPLAIN ANALYZE` | Query Plan과 비용·Row 해석 |
| PostgreSQL Adapter | 선택 적용 | 기존 Domain·Port를 유지하면서 어떻게 영속화하는가? | Migration과 Adapter·Integration Test | 작은 Diff와 실제 PostgreSQL Test |
| JPA N+1 | 조건부 후속 | 연관 조회에서 Query가 실제로 반복되는가? | 관계 Mapping이 생긴 경우 SQL Log 비교 | Query 수와 개선 전후 결과 |
| Connection Pool | 조건부 후속 | 연결 대기가 실제 병목인가? | 선행 환경·측정 질문이 생길 때만 실험 | Pool Metric 또는 대기 결과 |

## Lab 계획

| 순서 | Lab | 실행 전 예상 | 완료 조건 | 상태 |
|---:|---|---|---|---|
| 0 | Week 2 복습·Source Baseline | 기존 33개 Test와 Layer 경계가 유지됨 | 세 오류 흐름 설명, Version·Clean Test 확인 | Completed |
| 1 | 비정규 Ticket 장부와 정규화 | 중복과 갱신 이상이 분리 Schema·Constraint에서 줄어듦 | 동일 변경의 정규화 전후 결과와 Trade-off 설명 | Completed |
| 2 | Transaction 원자성 | 중간 실패 후 `ROLLBACK`하면 일부 변경만 남지 않음 | 정상 Commit·의도적 실패 결과 비교 | Completed |
| 3 | 두 Session 동시 수정 | 격리·Lock 전략에 따라 대기·충돌·최종 값이 달라짐 | 실행 순서와 Lost Update 또는 Lock 결과 재현 | Completed |
| 4 | Index와 Query Plan | 데이터 분포와 조건에 따라 Seq Scan·Index Scan 선택이 달라짐 | [고정 Dataset에서 Index 전후 Plan 해석](./lab-reports/2026-09-04-postgresql-index-and-query-plan-lab.md) | Completed |
| 5 | PostgreSQL Repository Adapter | 기존 Port를 유지하면 Web·Service 계약 변경을 줄일 수 있음 | 실제 PostgreSQL 저장·조회 Integration Test 통과 | Deferred — 실행 Gate 미충족 |
| 6 | N+1·Pool 조건부 Spike | 선행 Mapping·부하가 없으면 실험 의미가 부족함 | 선행 조건 충족 시에만 별도 예상·관찰 기록 | Deferred |

## 일정

| 날짜 | 학습·예상 | 실험·관찰 | 선택 적용·기록 | 일일 종료 조건 | 상태 |
|---|---|---|---|---|---|
| 8월 31일 월요일 | Week 2 오류 흐름·Filter·Interceptor 복습, Week 2 WIL 최종 검토 | Java·Maven·전체 33개 Clean Test, PostgreSQL 17.7 환경·인증 접속 확인 | Week 2 WIL 게시 확인과 Week 3 기준선·Constraint 선행 학습 기록 | 복습 세 흐름 설명, Database 환경의 확인·미확인 상태 구분 | Completed |
| 9월 1일 화요일 | 관계·Key·1~3NF와 Constraint 학습 | 학습용 Database 생성, 정규화 Table·Constraint·Foreign Key·JOIN 재현 | DDL 선택과 사용자 실행 결과 기록 | 잘못된 Row가 Application이 아니라 DB Constraint에서도 거부됨 | Completed |
| 9월 2일 수요일 | ACID와 Transaction 경계, Commit·Rollback 예상 | 여러 Row 변경 중 의도적 실패와 Rollback 재현 | SQL 원자성 근거를 먼저 확정하고 Spring Transaction Integration Test는 선택 적용으로 유지 | 일부 변경만 남지 않는 이유와 검증 결과 설명 | Completed |
| 9월 3일 목요일 | Isolation·MVCC·Lock과 Deadlock 조건 학습 | 두 Session에서 Lost Update·Lock 대기·낙관적 충돌과 Deadlock 재현 | Study Note와 Isolation·Lock Lab Report 작성 | 동시성 문제와 각 해결 방식의 비용 설명 | Completed |
| 9월 4일 금요일 | B-Tree·선택도·복합 Index와 Planner 학습 | 고정 Dataset의 Index 전후 `EXPLAIN (ANALYZE, BUFFERS)` 비교 | [Study Note](./study-notes/2026-09-04-study-questions.md)와 [Query Plan Lab Report](./lab-reports/2026-09-04-postgresql-index-and-query-plan-lab.md) 작성 | Seq Scan·Index Scan 선택 이유와 쓰기 비용 설명 | Completed |
| 9월 5일 토요일 | 개인 일정으로 학습 미실시 | 실행 없음 | 남은 학습·적용·기록 과업을 9월 6일로 이월 | 기존 완료 근거를 유지하고 별도 일일 학습 기록을 만들지 않음 | Deferred — 9월 6일 이월 |
| 9월 6일 일요일 | 네 가지 핵심 질문을 자료 없이 답한 뒤 근거로 교정 | 임시 Table의 정규화 전후 갱신 이상 비교, Gate 통과 시 PostgreSQL Adapter·실제 DB Integration Test | 9월 6일 Study Note, Diff Review, Week 3 WIL과 다음 질문 정리 | 미완료 핵심 근거를 보완하고 Adapter 수행·보류 이유와 완료·부분 완료 범위를 기록 | Completed — 90분 축소 경로, Adapter Deferred |

## 9월 6일 일요일 실행 계획

### 시작 기준선과 우선순위

2026년 9월 6일 계획 구체화 시점에 `ai-helpdesk-learning-lab` Working Tree는 깨끗했고 `mvnw.cmd test`에서 기존 Test 33개가 실패·오류·건너뜀 없이 다시 통과했다. 로컬 PostgreSQL Service는 실행 중이고 `localhost:5432`가 연결을 받고 있다. Docker CLI는 설치되어 있지만 Docker Daemon에는 연결되지 않았으므로 Testcontainers 경로는 Daemon을 실제로 확인한 뒤에만 진행한다.

일요일 학습은 시작 시각을 `T+00:00`으로 두는 상대 시간표다. 기본 경로는 휴식 30분을 포함해 4시간 55분이며, 날짜를 넘기더라도 중단 없이 이어진 학습은 하나의 9월 6일 학습 Session으로 기록하고 실제 종료 시각을 별도로 남긴다.

| 우선순위 | 반드시 남길 결과 | 범위 |
|---|---|---|
| P0 | 자료 없는 핵심 질문 답변, 비정규·정규 구조의 실제 비교, Week 3 완료·부분 완료·보류 판단과 WIL 초안 | 일요일 종료에 필수 |
| P1 | 기존 Port 뒤의 최소 PostgreSQL Adapter와 실제 PostgreSQL Integration Test | 아래 두 Gate를 모두 통과할 때만 수행 |
| 오늘 시작하지 않음 | JPA N+1, Connection Pool, Application 기본 Repository 교체, Week 4 인증·인가 | 후속 조건이 생길 때 재검토 |

### 시간대별 실행 순서

| 경과 시간 | Block | 수행 내용 | 종료 조건·산출물 |
|---|---|---|---|
| `T+00:00 ~ 00:15` | 시작 상태 고정 | 두 저장소의 `git status`를 확인하고 학습 시작 시각·현재 이해·예상을 먼저 적는다. Credential 값은 명령·문서에 넣지 않는다. | 기존 변경과 오늘 변경 범위가 구분되고 네 질문의 첫 답변을 AI·자료보다 먼저 시작함 |
| `T+00:15 ~ 00:55` | 핵심 질문 복습 | 아래 네 질문에 각각 3~5문장으로 답한 뒤 기존 Study Note·Lab Report와 대조해 다른 표현을 교정한다. | 네 답변과 근거 Link가 있고, Review Gate 판정이 기록됨 |
| `T+00:55 ~ 01:35` | 정규화 보완 Spike | 영구 업무 Table을 건드리지 않는 임시 비정규·정규 Table을 만들고, 같은 Ticket 제목 변경이 한 Row 누락으로 불일치하는 결과와 부모 Row 한 번 변경 후 JOIN 결과를 비교한다. | 실행 전 예상, 변경 전·후 `SELECT`, 갱신 이상과 분리 비용 해석이 있음 |
| `T+01:35 ~ 01:50` | 휴식 | 화면과 Database Session에서 벗어나 휴식한다. | 15분 뒤 다음 Gate로 복귀 |
| `T+01:50 ~ 02:05` | Adapter Gate | Review·정규화 결과, 남은 시간과 Docker Daemon을 확인한다. Daemon 시작·확인은 최대 10분만 사용한다. | 구현 경로 A 또는 축소 경로 B를 한 문장 이유와 함께 선택 |
| `T+02:05 ~ 03:35` | 경로 A: 최소 Adapter | 학습자가 먼저 예상·Test를 작성하고 PostgreSQL Adapter·Migration을 최소 범위로 구현한다. 대상 Test 후 전체 회귀 Test를 실행한다. | 실제 PostgreSQL 저장·재조회와 부재 조회 Test, 작은 Diff, 전체 Test 결과가 있음 |
| `T+02:05 ~ 02:50` | 경로 B: 적용 보류 | Gate 실패 원인을 교정하거나 정규화 해석을 보완하고, Adapter를 `Deferred`로 둔 이유와 재개 조건을 기록한다. H2나 Mock으로 실제 PostgreSQL 근거를 대체하지 않는다. | 보류 이유·재개 조건과 P0 근거가 있고 미완료를 완료로 표시하지 않음 |
| `T+03:35 ~ 03:50` | 휴식 | 구현 경로 A를 수행했을 때 두 번째 휴식을 갖는다. 경로 B에서는 이 Block을 생략하고 기록으로 이동할 수 있다. | 기록 전에 집중력 회복 |
| `T+03:50 ~ 04:35`<br>경로 B `T+02:50 ~ 03:35` | Study Note·WIL | 실제 수행 결과만 9월 6일 Study Note에 기록하고, WIL에는 시작 이해·예상·교정·근거·AI 역할·적용 판단·미완료 범위·다음 질문을 정리한다. | 실행 결과와 계획을 섞지 않은 Study Note와 Week 3 WIL 공개 전 초안 |
| `T+04:35 ~ 04:55`<br>경로 B `T+03:35 ~ 03:55` | 최종 Review | Source 변경 시 대상 Test와 전체 Test 결과를 다시 확인하고, 두 저장소의 상태·Diff·문서 Link·공개 경계를 검토한다. | `git diff --check`, 실제 Test 결과, Secret·개인정보·로컬 절대 경로 없음, 작은 Commit 후보가 구분됨 |

### 핵심 질문과 Review Gate

자료를 열기 전에 다음 질문에 먼저 답한다.

1. `CHECK`와 `NOT NULL`을 왜 함께 사용하며, Database의 현재 값 Constraint와 `Ticket` Domain의 상태 전이 규칙은 무엇이 다른가?
2. Ticket 상태 변경 뒤 이력 `INSERT`가 실패할 때 `ROLLBACK` 후 어떤 Row와 Identity 값이 남을 수 있으며, 그 이유는 무엇인가?
3. MVCC의 일반 `SELECT`, `FOR UPDATE` 대기, stale-read Lost Update와 Version 조건의 `UPDATE 0`은 각각 무엇을 보여 주는가?
4. 같은 `status` Index가 `RESOLVED` 약 1%에는 선택되고 `OPEN` 약 99%에는 선택되지 않은 이유와, 복합 Index·`LIMIT`이 `Sort`와 읽은 Row 수를 바꾼 이유는 무엇인가?

다음 조건을 모두 만족하면 Review Gate를 통과한다.

- 네 질문 중 최소 세 개를 원인과 결과가 이어지도록 설명한다.
- 각 답변을 기존 Study Note 또는 Lab Report의 실제 SQL·Query Plan 근거 한 개 이상과 연결한다.
- 틀린 답은 지우지 않고 최초 답변, 교정 내용과 이유를 남긴다.

세 개 미만이면 관련 Learning Note와 실행 결과만 30분 동안 다시 확인하고 Adapter를 시작하지 않는다. 그날 보완하지 못한 질문은 Week 4에 자동 누적하지 않고 중요도와 재검토 조건을 WIL에 적는다.

### 정규화 보완 Spike 완료 조건

- 임시 비정규 이력 Table에는 같은 `ticket_id`의 두 이력 Row와 반복된 `title`을 둔다.
- 제목을 한 Row에서만 변경했을 때 같은 Ticket에 서로 다른 제목이 남을 것으로 예상하고 실제 결과를 확인한다.
- 임시 정규 구조에서는 Ticket 부모 Row의 제목을 한 번만 변경하고, 두 이력 Row와 JOIN했을 때 같은 최신 제목이 조회되는지 확인한다.
- 정규화가 중복·갱신 이상을 줄이는 대신 JOIN과 관계 관리 비용을 만든다는 Trade-off를 설명한다.
- 개념 설명만 반복하지 않고 실제 SQL 출력이 있어야 기존 `Partially Completed` 상태를 다시 판정할 수 있다.

임시 Table을 사용해 기존 `tickets`, `ticket_status_history`와 Index 실험 Fixture를 변경하거나 삭제하지 않는다.

### Adapter Gate와 최소 구현 경계

다음 네 조건을 모두 만족할 때만 경로 A를 선택한다.

1. Review Gate를 통과했다.
2. 정규화 보완 Spike의 예상·실행·해석이 끝났다.
3. `docker version`에서 Docker Server 연결이 실제로 확인되어 Testcontainers를 실행할 수 있다.
4. 구현과 검증에 연속 90분 이상을 사용할 수 있다.

경로 A의 구현 범위는 다음으로 제한한다.

- Spring JDBC, PostgreSQL Driver, PostgreSQL용 Migration과 Testcontainers에 필요한 의존성만 추가하고 Version은 Project의 Spring Boot Dependency Management를 우선한다.
- 이미 검증한 PostgreSQL `tickets` Schema·Constraint를 Migration으로 옮기고 새로운 업무 Column을 추가하지 않는다.
- `PostgresTicketRepository`가 기존 `TicketRepository`의 `save`·`findById`만 구현하게 한다.
- 기본 Application의 `InMemoryTicketRepository`는 교체하지 않고, Integration Test 설정에서만 PostgreSQL Adapter를 명시적으로 선택한다.
- 저장 뒤 새 Repository Instance로 다시 조회되는 Case, 존재하지 않는 ID가 빈 결과인 Case와 저장된 상태 복원 Case를 실제 PostgreSQL로 검증한다.
- 저장 상태 복원에 Domain API가 필요하면 실패 Test를 먼저 만들고 범용 Setter나 Reflection 대신 가장 작은 명시적 복원 경계를 추가한다.
- 대상 Integration Test가 통과한 뒤 기존 전체 Test를 실행하며, Controller·Service 계약은 변경하지 않는다.
- 경로 A의 실제 결과에 맞춰 Lab README와 Week 3 문서의 구현·Test 상태를 갱신하되, 실행하지 않은 Runtime 전환이나 Test를 완료로 표시하지 않는다.

Dependency·Docker 문제 해결이 30분을 넘거나 상태 복원 설계가 설명되지 않으면 구현을 중단하고 경로 B로 전환한다. Testcontainers를 실행하지 못한 Test를 `Passed`로 기록하거나 Local PostgreSQL·H2·Mock 결과를 같은 근거로 표현하지 않는다.

### 시간이 부족할 때의 90분 마감 경로

남은 시간이 두 시간 미만이면 처음부터 Adapter를 제외하고 다음 순서만 수행한다.

1. 30분: 네 핵심 질문에 짧게 답하고 가장 약한 한 질문을 근거로 교정한다.
2. 30분: 임시 Table의 정규화 전후 갱신 이상을 재현하고 결과를 저장한다.
3. 30분: 완료·부분 완료·보류 상태, Adapter 재개 조건과 Week 3 WIL 핵심 문단을 기록한다.

이 경로에서도 Week 3의 핵심 SQL 근거와 주간 판단을 먼저 마감한다. Adapter, JPA N+1, Connection Pool과 Week 4 구현은 시작하지 않는다.

## 위험과 대응

| 위험 | 조기 신호 | 대응 | 상태 |
|---|---|---|---|
| Week 2 복습이 월요일을 잠식 | 첫 Block 뒤에도 같은 이름 암기에 머묾 | 흐름 설명 결과와 남은 이름을 Note에 남기고 Database 시작 | Open |
| Database 설정이 학습을 압도 | 설치·Docker·Dependency 해결이 반나절을 넘김 | 실제 PostgreSQL 한 방식만 선택하고 Adapter를 뒤로 이동 | Open |
| 공지 주제를 모두 구현 | N+1·Pool·Replication까지 동시에 시작 | 핵심 세 축 외 항목을 조건부·비범위로 되돌림 | Open |
| 성능 수치 과장 | Dataset·Cache·반복 조건 없이 시간만 비교 | Query Plan·Row·Buffers를 기록하고 수치는 해당 환경으로 제한 | Open |
| 동시성 실험 비결정성 | Session 순서·격리 수준이 기록되지 않음 | A·B 단계, Transaction 경계와 최종 Row를 고정해 기록 | Open |
| 기존 Architecture 훼손 | Controller의 SQL 접근, Repository Port 우회 | Adapter를 Port 뒤에 두고 Domain·Service 계약 Review | Open |
| 기록 과다 | 문서 작성이 SQL 실험보다 길어짐 | 핵심 Learning Note 또는 Lab Report 한 개와 WIL만 유지 | Open |

## 계획된 산출물

| 산출물 | 목적 | 생성 조건 | 상태 |
|---|---|---|---|
| [주차 안내](./README.md) | Week 3 질문과 범위 Index | 주차 시작 | Ready |
| [주간 학습 계획](./weekly-plan.md) | Baseline·일정·축소 기준 | 주차 시작 | Ready |
| [PostgreSQL SQL 기초 Learning Note](./study-docs/learning-postgresql-sql-basics.md) | SQL·Table·Constraint·CRUD·Transaction 기초 개념 재사용 | SQL 개념 설명 자료가 필요할 때 | Ready |
| [PostgreSQL Transaction과 Atomicity Learning Note](./study-docs/learning-postgresql-transactions-and-atomicity.md) | 자동 Commit·실패 상태·Atomicity와 Rollback 경계 재사용 | Transaction 개념을 SQL 기초에서 분리해 설명할 때 | Ready |
| [PostgreSQL Isolation·MVCC·Lock Learning Note](./study-docs/learning-postgresql-isolation-mvcc-and-locks.md) | 동시 Transaction의 가시성·Snapshot·Lock 충돌과 해결 비용 재사용 | Isolation·MVCC·Lock 개념을 Transaction Atomicity에서 분리해 설명할 때 | Ready |
| [PostgreSQL Index와 EXPLAIN ANALYZE Learning Note](./study-docs/learning-postgresql-indexes-and-explain-analyze.md) | B-Tree·선택 비율·Planner 통계와 실행 계획 해석 재사용 | Index 실험 전 예상과 관찰 기준이 필요할 때 | Ready |
| [8월 31일 Study Note](./study-notes/2026-08-31-study-questions.md) | Week 2 복습과 Database 시작 상태 | 월요일 학습 진행 | Completed |
| [9월 1일 Study Note](./study-notes/2026-09-01-study-questions.md) | 학습용 Database, Schema·Constraint와 정규화 실험 기록 | 화요일 학습 진행 | Completed |
| [9월 2일 Study Note](./study-notes/2026-09-02-study-questions.md) | 정상 Commit과 의도적 실패·Rollback 실행 기록 | 수요일 학습 진행 | Completed |
| [9월 3일 Study Note](./study-notes/2026-09-03-study-questions.md) | Isolation·MVCC·Lock 개념 교정과 완료 판단 | 목요일 학습 진행 | Completed |
| [9월 4일 Study Note](./study-notes/2026-09-04-study-questions.md) | Index·Planner 개념 교정과 일일 완료 판단 | 금요일 학습 진행 | Completed |
| [Isolation·Lock Lab Report](./lab-reports/2026-09-03-postgresql-isolation-and-lock-lab.md) | 두 Session 동시성·대기와 실패 재현 | SQL 실행 결과 확보 | Completed |
| [Index·Query Plan Lab Report](./lab-reports/2026-09-04-postgresql-index-and-query-plan-lab.md) | Index 전후 실행 계획 비교 | 고정 Dataset 결과 확보 | Completed |
| [Week 3 WIL](./wil.md) | 이해 변화와 다음 판단 | 9월 6일 실제 결과 | Completed — 2026-09-07 블로그 게시·포럼 등록 완료 |

실제 파일이 생기기 전에는 Placeholder Link를 만들지 않는다. Learning Note와 Lab Report를 모두 강제로 만들지 않고, 한 문서가 질문·절차·관찰을 충분히 담으면 중복 문서는 생략한다.

## Learning Evidence Gate

- [x] 월요일 Week 2 복습 세 흐름을 설명하고 교정 결과를 기록했다.
- [x] 핵심 질문에 답하는 Schema·Transaction·Query Plan 설명이 있다.
- [x] SQL 실행 전에 예상 결과와 실패 조건을 기록했다.
- [x] Constraint·Foreign Key 실패를 직접 재현했다.
- [x] Transaction Rollback을 직접 재현했다.
- [x] 두 Session의 동시 수정·Lock 결과를 재현했다.
- [x] 고정 Dataset의 Index 전후 Query Plan이 있다.
- [x] 기존 33개 Clean Test 회귀가 유지된다.
- [ ] AI 도움 없이 SQL 또는 작은 Adapter 변경과 관련 Test를 수행했다.
- [x] JPA·N+1·Pool·비범위 선택 이유가 기록됐다.
- [x] 완료·부분 완료·미수행 범위를 Week 3 WIL에 남겼다.
- [x] Week 3 WIL을 블로그에 게시하고 포럼에 등록했다. (2026-09-07 사용자 확인)
- [x] Secret, 개인정보, 내부 URL과 로컬 절대 경로가 공개 자료에 없다.

## 계획 변경 기록

Baseline 이후 핵심 SQL 실험, PostgreSQL 적용 범위나 일정이 바뀌면 이유와 검증 경계를 기록한다.

| 날짜 | 변경 전 | 변경 후 | 이유 | 핵심 질문·다음 주 영향 | 근거 |
|---|---|---|---|---|---|
| 2026-08-30 | 8월 31일부터 곧바로 Week 3 Database 학습 시작 | 월요일 첫 Block에 Week 2 Exception·공통 처리 복습 Gate 추가 | Week 2 구현은 완료했지만 Exception 처리 이름과 흐름의 즉시 회상이 충분하지 않았음 | 한 Block 뒤 Database로 전환하여 Week 3 학습량은 유지 | [8월 30일 계획 기록](../week2/study-notes/2026-08-30-study-questions.md) |
| 2026-08-31 | PostgreSQL 환경 전체 `NOT_CHECKED` | PostgreSQL 17.7·Service·접속 대기·기본 Database 인증 접속 확인 | 기억이 아니라 실제 Version·Service·`pg_isready`·`psql` 결과로 기준선 확정 | 학습용 Database·Schema와 Application 연동은 별도 근거가 생길 때까지 미완료 유지 | [8월 31일 기록](./study-notes/2026-08-31-study-questions.md) |
| 2026-09-01 | 학습용 Database 존재 여부 `NOT_CHECKED` | 0건 확인 후 `ai_helpdesk_learning_lab` 생성·접속, 두 Table과 Constraint SQL 재현 | 연결 성공·Database 존재·Schema와 실패 결과를 각각 구분해 확인 | 정규화 개념과 Constraint는 확보했으며 비정규 Table 실제 비교·Transaction은 후속 범위 | [9월 1일 기록](./study-notes/2026-09-01-study-questions.md) |
| 2026-09-02 | Transaction·Lock 실행 근거를 하나의 별도 Lab Report로 기록 | Transaction 개념은 Learning Note, 실제 Commit·Rollback Trace는 Study Note에 기록하고 후속 Lab Report는 Isolation·Lock에 집중 | 같은 SQL 결과를 여러 문서에 중복하지 않고 개념·날짜별 실행·두 Session Trace의 역할을 분리 | Transaction 원자성은 완료하고 9월 3일 두 Session Isolation·Lock으로 진행 | [9월 2일 기록](./study-notes/2026-09-02-study-questions.md) |
| 2026-09-03 | Lost Update를 두 Session의 동일 절대값 저장 결과만으로 비교 | 같은 계산 방식의 순차 대조와 동시 stale-read를 분리하고, 원자적 증가·Version 충돌·역순과 동일 순서 Lock까지 재현 | 고정값 저장만으로는 순차 실행과 동시 갱신 유실을 구분할 수 없다는 한계를 학습 중 발견 | Isolation·Lock 범위를 완료하고 Index·실행 계획 학습으로 전환 | [9월 3일 기록](./study-notes/2026-09-03-study-questions.md), [Lab Report](./lab-reports/2026-09-03-postgresql-isolation-and-lock-lab.md) |
| 2026-09-05 | 주간 복습·선택 적용·Week 3 기록을 토요일에 수행 | 해당 과업 전체를 9월 6일로 이월 | 개인 일정으로 학습 시간을 확보하지 못했으며 미실시 내용을 완료로 기록하지 않음 | Week 3 종료일을 하루 연장하되 Week 4 범위는 선행하지 않음 | 주간 일정 변경 |
| 2026-09-06 | 일요일에 핵심 복습, Adapter 또는 미완료 SQL 보완과 WIL을 수행 | 네 질문 Review Gate → 임시 Table 정규화 Spike → 환경·시간 Gate → Adapter 또는 축소 경로 → WIL의 상대 시간표로 구체화 | 남은 핵심 근거와 선택 적용을 같은 우선순위로 두면 설정 문제가 주간 마감을 방해할 수 있고, 계획 시점에 Docker Daemon이 실행되지 않았음 | 핵심 학습 근거와 정직한 Week 3 마감을 P0로 두며 Adapter·N+1·Pool을 Week 4에 자동 누적하지 않음 | 9월 6일 시작 환경 확인과 일요일 실행 계획 |
| 2026-09-07 | 9월 6일 Session의 Review·정규화·마감 결과 미확정 | Review Gate 통과, 임시 Table 정규화 비교·Rollback과 Week 3 WIL 완료; Adapter는 `Deferred` | 23:59에 시작한 하나의 Session이 자정을 넘겼고 90분 축소 경로와 실행 Gate를 적용함 | Week 3 핵심 SQL 학습은 완료하되 Adapter·N+1·Pool은 조건 없이 Week 4로 이월하지 않음 | [9월 6일 마감 기록](./study-notes/2026-09-06-study-questions.md), [Week 3 WIL](./wil.md) |
| 2026-09-07 | Week 3 WIL `Ready — 공개 전 초안` | 블로그 게시·포럼 등록 완료로 `Completed` | 사용자가 외부 게시와 포럼 등록 완료를 확인함 | Week 3 공개 기록 절차를 마감하되 PostgreSQL Adapter의 `Deferred` 상태는 유지 | 사용자 확인 |

## 공식 학습 자료 Baseline

- [PostgreSQL — SQL Language](https://www.postgresql.org/docs/current/sql.html)
- [PostgreSQL — Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL — Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [PostgreSQL — Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostgreSQL — Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL — Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [PostgreSQL — Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [Spring Boot — Testcontainers](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html)

## 관련 기준

- [심화과정 12주 학습 계획](../plan/advanced-track-12-week-plan.md)
- [주차별 Roadmap](../plan/weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](../plan/learning-and-content-plan.md)
