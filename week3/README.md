# Week 3 — PostgreSQL·Transaction·Lock·Index

> 기간: 2026-08-31 ~ 2026-09-05
> 상태: In Progress
> 핵심 질문: Database의 Transaction과 실행 계획이 Ticket의 일관성과 조회 성능에 어떤 영향을 주는가?
> 공통 실습: AI Helpdesk Learning Lab의 Ticket 저장·조회와 독립 SQL Spike

이 문서는 Week 3의 질문, 선택 범위와 실제 근거를 연결하는 Index다. 세부 일정과 축소 기준은 [주간 학습 계획](./weekly-plan.md)에서 관리한다. 재사용할 개념은 Learning Note, 날짜별 질문과 진행 결과는 Study Note, 재현 가능한 SQL·Query Plan은 Lab Report에 기록한다.

Week 2에는 In-memory Repository 기반 Ticket 생성·조회 API와 HTTP 오류 계약을 구현했다. Week 3에는 곧바로 JPA Annotation과 Repository Method를 늘리기보다 PostgreSQL에서 Schema, Transaction과 Query Plan이 실제로 어떤 문제를 해결하는지 SQL로 먼저 확인한다. 그 결과를 설명할 수 있을 때만 기존 `TicketRepository` Port 뒤에 PostgreSQL Adapter를 최소 범위로 연결한다.

## 월요일 시작 Gate — Week 2 복습

8월 31일 첫 학습 Block은 Week 2에서 바로 떠올리기 어려웠던 오류 흐름과 공통 요청 처리 책임을 복습한다.

다음 세 가지를 자료 없이 설명한다.

1. 공백 제목, 잘못된 JSON, 숫자가 아닌 ID와 존재하지 않는 ID가 각각 어디에서 실패하는가?
2. `TicketNotFoundException`이 Service에서 발생한 뒤 `ProblemDetail` Response가 되기까지 어떤 구성요소를 지나는가?
3. Request ID, 선택된 Handler 실행 시간과 Application Exception의 HTTP 변환을 각각 Filter·Interceptor·Exception Handler 중 어디에 두는가?

`TicketControllerTest`와 `WebInfrastructureIntegrationTest`가 검증하는 범위를 구분하고, 필요하면 대상 Test만 다시 실행한다. 복습 중 새 Production 기능은 추가하지 않는다. 한 학습 Block 안에 설명이 완성되지 않으면 남은 Class·Method 이름은 후속 질문으로 기록하고 Database 학습을 시작한다.

## 한눈에 보기

- 시작할 때의 이해: Ticket은 현재 Process Memory에만 저장되며 Database Transaction·Lock·Index는 아직 Code나 실제 PostgreSQL로 검증하지 않았다.
- 가장 중요한 실험: 두 Session의 동시 수정과 고정 Dataset의 Index 전후 `EXPLAIN ANALYZE` 비교
- 선택 적용: 기존 Repository Port를 유지한 PostgreSQL Adapter와 실제 PostgreSQL Integration Test
- 남은 질문: JPA Persistence Context·N+1과 Connection Pool을 핵심 SQL 실험 뒤 이번 주에 다룰 시간이 있는가?

## 선택 범위

### 핵심 학습

- 정규화, Primary·Foreign Key와 `NOT NULL`·`UNIQUE`·`CHECK` Constraint
- ACID, `BEGIN`·`COMMIT`·`ROLLBACK`과 실패한 작업의 원자성
- Isolation Level, Lost Update, Lock 대기와 Deadlock
- 단일·복합 Index, 선택도와 `EXPLAIN ANALYZE`

핵심은 용어를 나열하는 것이 아니라 다음 흐름을 실제 SQL로 관찰하는 것이다.

```text
Schema와 Constraint
→ 저장 가능한 상태의 경계

Transaction과 Lock
→ 여러 변경과 동시 요청의 일관성

Index와 Query Plan
→ 조회 방법과 비용
```

### 선택 적용

- PostgreSQL과 Migration을 이용한 Ticket 저장·단건 조회 Adapter
- 기존 `TicketRepository` Port와 Domain 규칙 유지
- Testcontainers 또는 동등한 실제 PostgreSQL 환경의 Integration Test
- SQL Log와 실제 Query를 근거로 한 JPA Persistence 경계 확인

선택 적용은 핵심 SQL 실험을 통과한 뒤 시작한다. In-memory 구현을 바로 삭제하거나 Controller가 Database에 직접 접근하도록 바꾸지 않는다.

### 조건부 후속

- JPA Lazy Loading과 N+1: 관계 Mapping이 실제로 추가되고 SQL Query 수를 관찰할 수 있을 때만 수행
- Connection Pool: 실제 PostgreSQL 연결이 구성된 뒤 Pool 대기·고갈을 측정할 환경과 질문이 있을 때만 수행
- 낙관적 Lock과 비관적 Lock 비교: Lost Update 재현 후 한 전략을 먼저 검증하고 시간이 남을 때 두 번째 전략 비교
- 반정규화: 정규화 Schema의 조회 비용을 실제 Query Plan으로 확인한 뒤에만 검토

### 이번 주 비범위

- RDB와 NoSQL로 같은 서비스를 각각 구현
- Replication, Sharding, Failover와 Production Capacity 설계
- Cache·Queue 추가와 측정 없는 성능 개선 주장
- 모든 Helpdesk Domain을 JPA Entity로 전환
- Week 4 인증·인가 기능 선행 구현

## 현재 Baseline

- Java·Compiler: Temurin JDK 25.0.4
- Build: Maven Wrapper에서 Maven 3.9.16
- Spring Boot: 4.1.1
- Source: Controller·Application Service·Repository Port·In-memory Adapter·Ticket Domain
- 자동 검증: 전체 Test 33개 통과 근거
- Database: PostgreSQL 17.7, Windows Service 실행, `localhost:5432` 접속 대기와 기본 `postgres` Database 인증 접속 `VERIFIED`
- 학습용 Database: `ai_helpdesk_learning_lab` 생성·인증 접속과 현재 연결 대상 `VERIFIED`
- 학습 Schema: `public.tickets`, `public.ticket_status_history` DDL·Constraint·Foreign Key와 대표 성공·실패 SQL `USER_VERIFIED`
- Transaction SQL Spike: Ticket·최초 이력 정상 Commit과 의도적 이력 실패 뒤 전체 Rollback `USER_VERIFIED`
- 영속화: Driver·JPA·Migration·Testcontainers 모두 `NOT_IMPLEMENTED`

Version·Service·접속 상태와 인증 접속은 실제 명령으로 확인했다. Credential 값은 출력하거나 문서에 기록하지 않는다. SQL Spike의 Table·Constraint와 Transaction 원자성은 사용자가 `psql`에서 재현했지만 Spring Application 영속화와 두 Session 동시성 실험은 아직 완료되지 않았다.

## 상태

| 학습 주제 | 계획 상태 | 실제 상태 | 계획된 근거 |
|---|---|---|---|
| Week 2 오류·공통 처리 복습 | 조건부 후속 | Completed | 8월 31일 질문·교정 기록과 전체 33개 Clean Test |
| Schema·정규화·Constraint | 핵심 학습 | Partially Completed | 1~3NF 설명, 정규화 Table·Constraint 실패 SQL 완료; 비정규 Table 실제 비교 `NOT_RUN` |
| Transaction·Isolation·Lock | 핵심 학습 | Partially Completed | 정상 Commit·의도적 실패 Rollback 완료; 두 Session Isolation·Lock `NOT_RUN` |
| Index·실행 계획 | 핵심 학습 | Planned | 고정 Dataset의 Index 전후 Query Plan |
| PostgreSQL Repository Adapter | 선택 적용 | Planned | 기존 Port를 유지한 작은 Diff와 Integration Test |
| JPA N+1 | 조건부 후속 | Deferred | 실제 관계 Mapping과 Query 수가 생길 때 재검토 |
| Connection Pool 부하 | 조건부 후속 | Deferred | 실제 연결과 측정 환경이 생길 때 재검토 |

`Completed`는 설명, 직접 재현과 SQL·Test·Query Plan 근거가 함께 생긴 경우에만 사용한다.

## 문서 역할

| 위치 | 역할 |
|---|---|
| `study-docs/` | 날짜와 개인 진도에서 독립적인 Database 개념 자료 |
| `study-notes/` | 날짜별 질문·답변, 예상·관찰과 진행 상태 |
| Lab Report | 재현 가능한 SQL, 환경·결과와 Query Plan |
| `weekly-plan.md` | 주간 범위, 일정·축소 기준과 변경 기록 |

실제 파일이 생기기 전에는 Placeholder Link를 만들지 않는다.

## 학습 자료

- [PostgreSQL SQL 기초 문법](./study-docs/learning-postgresql-sql-basics.md) — SQL 기본 구성, Table·Constraint, CRUD·조회, Transaction과 `psql` Meta-command
- [PostgreSQL Transaction과 Atomicity](./study-docs/learning-postgresql-transactions-and-atomicity.md) — 암묵적 Transaction, 자동 Commit, 실패 상태, Atomicity·Sequence와 Rollback 경계

## 날짜별 학습 기록

- [2026-08-31 — Week 2 복습·WIL 제출과 Week 3 시작 기준선](./study-notes/2026-08-31-study-questions.md)
- [2026-09-01 — PostgreSQL Schema·Constraint와 정규화 실습](./study-notes/2026-09-01-study-questions.md)
- [2026-09-02 — PostgreSQL Transaction과 Atomicity 실습](./study-notes/2026-09-02-study-questions.md)

## Learning Evidence Gate

- [x] Week 2 복습 세 흐름을 설명하고 교정 결과를 Study Note에 기록한다.
- [x] 비정규 구조의 중복·갱신 이상과 1~3NF 분리 이유를 설명한다.
- [x] `tickets`·`ticket_status_history` DDL과 Constraint·Foreign Key 실패를 재현한다.
- [ ] 비정규 Table을 실제로 만들고 같은 변경의 정규화 전후 결과를 비교한다.
- [x] Transaction 중간 실패에서 Commit·Rollback 결과를 직접 확인한다.
- [ ] 두 Session에서 동시 수정과 Lock 대기 또는 충돌을 재현한다.
- [ ] 같은 Query의 Index 전후 `EXPLAIN ANALYZE`를 비교한다.
- [x] 기존 33개 Clean Test의 회귀를 유지한다.
- [ ] PostgreSQL 적용·보류 범위와 이유를 기록한다.
- [ ] 완료·부분 완료·미수행 범위를 Week 3 WIL에 남긴다.
- [ ] 공개 자료에 Secret, 개인정보, 내부 URL과 로컬 절대 경로가 없다.

## 공식 자료 Baseline

- [PostgreSQL — SQL Language](https://www.postgresql.org/docs/current/sql.html)
- [PostgreSQL — Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL — Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [PostgreSQL — Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [PostgreSQL — Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL — Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [Spring Boot — Testcontainers](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html)

## 관련 계획

- [Week 3 주간 학습 계획](./weekly-plan.md)
- [심화과정 12주 학습 계획](../plan/advanced-track-12-week-plan.md)
- [주차별 Roadmap](../plan/weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](../plan/learning-and-content-plan.md)
