# Week 3 학습 계획 — PostgreSQL·Transaction·Lock·Index

> 작성일: 2026-08-30
> 상태: In Progress
> 기간: 2026-08-31 ~ 2026-09-05
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
| 1 | 비정규 Ticket 장부와 정규화 | 중복과 갱신 이상이 분리 Schema·Constraint에서 줄어듦 | 동일 변경의 정규화 전후 결과와 Trade-off 설명 | Partially Completed |
| 2 | Transaction 원자성 | 중간 실패 후 `ROLLBACK`하면 일부 변경만 남지 않음 | 정상 Commit·의도적 실패 결과 비교 | Completed |
| 3 | 두 Session 동시 수정 | 격리·Lock 전략에 따라 대기·충돌·최종 값이 달라짐 | 실행 순서와 Lost Update 또는 Lock 결과 재현 | Completed |
| 4 | Index와 Query Plan | 데이터 분포와 조건에 따라 Seq Scan·Index Scan 선택이 달라짐 | [고정 Dataset에서 Index 전후 Plan 해석](./lab-reports/2026-09-04-postgresql-index-and-query-plan-lab.md) | Completed |
| 5 | PostgreSQL Repository Adapter | 기존 Port를 유지하면 Web·Service 계약 변경을 줄일 수 있음 | 실제 PostgreSQL 저장·조회 Integration Test 통과 | Planned |
| 6 | N+1·Pool 조건부 Spike | 선행 Mapping·부하가 없으면 실험 의미가 부족함 | 선행 조건 충족 시에만 별도 예상·관찰 기록 | Deferred |

## 일정

| 날짜 | 학습·예상 | 실험·관찰 | 선택 적용·기록 | 일일 종료 조건 | 상태 |
|---|---|---|---|---|---|
| 8월 31일 월요일 | Week 2 오류 흐름·Filter·Interceptor 복습, Week 2 WIL 최종 검토 | Java·Maven·전체 33개 Clean Test, PostgreSQL 17.7 환경·인증 접속 확인 | Week 2 WIL 게시 확인과 Week 3 기준선·Constraint 선행 학습 기록 | 복습 세 흐름 설명, Database 환경의 확인·미확인 상태 구분 | Completed |
| 9월 1일 화요일 | 관계·Key·1~3NF와 Constraint 학습 | 학습용 Database 생성, 정규화 Table·Constraint·Foreign Key·JOIN 재현 | DDL 선택과 사용자 실행 결과 기록 | 잘못된 Row가 Application이 아니라 DB Constraint에서도 거부됨 | Completed |
| 9월 2일 수요일 | ACID와 Transaction 경계, Commit·Rollback 예상 | 여러 Row 변경 중 의도적 실패와 Rollback 재현 | SQL 원자성 근거를 먼저 확정하고 Spring Transaction Integration Test는 선택 적용으로 유지 | 일부 변경만 남지 않는 이유와 검증 결과 설명 | Completed |
| 9월 3일 목요일 | Isolation·MVCC·Lock과 Deadlock 조건 학습 | 두 Session에서 Lost Update·Lock 대기·낙관적 충돌과 Deadlock 재현 | Study Note와 Isolation·Lock Lab Report 작성 | 동시성 문제와 각 해결 방식의 비용 설명 | Completed |
| 9월 4일 금요일 | B-Tree·선택도·복합 Index와 Planner 학습 | 고정 Dataset의 Index 전후 `EXPLAIN (ANALYZE, BUFFERS)` 비교 | [Study Note](./study-notes/2026-09-04-study-questions.md)와 [Query Plan Lab Report](./lab-reports/2026-09-04-postgresql-index-and-query-plan-lab.md) 작성 | Seq Scan·Index Scan 선택 이유와 쓰기 비용 설명 | Completed |
| 9월 5일 토요일 | 주간 핵심 질문 복습 | PostgreSQL Adapter·실제 DB Integration Test 또는 미완료 SQL 실험 보완 | Diff Review, Week 3 WIL과 다음 질문 정리 | 핵심 세 축의 근거 확보, 적용·보류 범위가 WIL에 기록됨 | Planned |

토요일에는 핵심 SQL 실험이 끝난 경우에만 JPA N+1 또는 Connection Pool 중 하나를 추가 검토한다. 두 항목을 모두 시작하지 않는다.

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
| Week 3 WIL | 이해 변화와 다음 판단 | 토요일 실제 결과 | Planned |

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
- [ ] JPA·N+1·Pool·비범위 선택 이유가 기록됐다.
- [ ] 완료·부분 완료·미수행 범위를 Week 3 WIL에 남겼다.
- [ ] Secret, 개인정보, 내부 URL과 로컬 절대 경로가 공개 자료에 없다.

## 계획 변경 기록

Baseline 이후 핵심 SQL 실험, PostgreSQL 적용 범위나 일정이 바뀌면 이유와 검증 경계를 기록한다.

| 날짜 | 변경 전 | 변경 후 | 이유 | 핵심 질문·다음 주 영향 | 근거 |
|---|---|---|---|---|---|
| 2026-08-30 | 8월 31일부터 곧바로 Week 3 Database 학습 시작 | 월요일 첫 Block에 Week 2 Exception·공통 처리 복습 Gate 추가 | Week 2 구현은 완료했지만 Exception 처리 이름과 흐름의 즉시 회상이 충분하지 않았음 | 한 Block 뒤 Database로 전환하여 Week 3 학습량은 유지 | [8월 30일 계획 기록](../week2/study-notes/2026-08-30-study-questions.md) |
| 2026-08-31 | PostgreSQL 환경 전체 `NOT_CHECKED` | PostgreSQL 17.7·Service·접속 대기·기본 Database 인증 접속 확인 | 기억이 아니라 실제 Version·Service·`pg_isready`·`psql` 결과로 기준선 확정 | 학습용 Database·Schema와 Application 연동은 별도 근거가 생길 때까지 미완료 유지 | [8월 31일 기록](./study-notes/2026-08-31-study-questions.md) |
| 2026-09-01 | 학습용 Database 존재 여부 `NOT_CHECKED` | 0건 확인 후 `ai_helpdesk_learning_lab` 생성·접속, 두 Table과 Constraint SQL 재현 | 연결 성공·Database 존재·Schema와 실패 결과를 각각 구분해 확인 | 정규화 개념과 Constraint는 확보했으며 비정규 Table 실제 비교·Transaction은 후속 범위 | [9월 1일 기록](./study-notes/2026-09-01-study-questions.md) |
| 2026-09-02 | Transaction·Lock 실행 근거를 하나의 별도 Lab Report로 기록 | Transaction 개념은 Learning Note, 실제 Commit·Rollback Trace는 Study Note에 기록하고 후속 Lab Report는 Isolation·Lock에 집중 | 같은 SQL 결과를 여러 문서에 중복하지 않고 개념·날짜별 실행·두 Session Trace의 역할을 분리 | Transaction 원자성은 완료하고 9월 3일 두 Session Isolation·Lock으로 진행 | [9월 2일 기록](./study-notes/2026-09-02-study-questions.md) |
| 2026-09-03 | Lost Update를 두 Session의 동일 절대값 저장 결과만으로 비교 | 같은 계산 방식의 순차 대조와 동시 stale-read를 분리하고, 원자적 증가·Version 충돌·역순과 동일 순서 Lock까지 재현 | 고정값 저장만으로는 순차 실행과 동시 갱신 유실을 구분할 수 없다는 한계를 학습 중 발견 | Isolation·Lock 범위를 완료하고 Index·실행 계획 학습으로 전환 | [9월 3일 기록](./study-notes/2026-09-03-study-questions.md), [Lab Report](./lab-reports/2026-09-03-postgresql-isolation-and-lock-lab.md) |

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
