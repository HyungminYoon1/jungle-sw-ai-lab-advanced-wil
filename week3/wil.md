# Week 3 WIL — 값의 유효성에서 일관된 변경과 비용 기반 조회까지

> 기간: 2026-08-31 ~ 2026-09-06
> 상태: Completed
> 문서 상태: 공개 전 초안
> 핵심 질문: Database의 Transaction과 실행 계획이 Ticket의 일관성과 조회 성능에 어떤 영향을 주는가?

## 이번 주 요약

이번 주에는 PostgreSQL을 Application에 곧바로 연결하기보다 Schema·Transaction·동시성·Index가 해결하는 문제를 SQL로 먼저 분리해 확인했다. `CHECK`가 현재 값의 허용 범위를 보호하는 것과 Domain이 상태 전이 순서를 보호하는 것은 다른 책임이며, Transaction은 현재 상태 변경과 이력 저장을 하나의 완료 단위로 묶는다. 두 Session 실험에서는 MVCC 조회, Row Lock 대기, Lost Update, Version 충돌과 Deadlock이 서로 다른 현상임을 관찰했다. 100,000건 Dataset에서는 Index의 존재만이 아니라 선택도·정렬·`LIMIT`에 따라 Planner의 선택과 작업량이 달라졌다. PostgreSQL Adapter는 일요일 축소 경로의 Gate에 따라 구현하지 않고, 핵심 SQL 근거와 보류 조건을 먼저 마감했다.

## 시작점

- 알고 있다고 생각한 내용: Constraint가 잘못된 값을 막고, Transaction은 실패 시 변경을 되돌리며, Index는 조회를 빠르게 한다.
- 예상한 결과: 상태 Index가 있으면 조회에 사용되고, 두 SQL을 `BEGIN`으로 묶으면 중간 실패 시 모두 취소될 것으로 예상했다.
- 가장 불확실했던 부분: `CHECK`와 `NULL`, Sequence의 Rollback, 일반 조회와 Row Lock의 관계, Lost Update의 대조 조건, 선택도와 복합 Index의 실제 Plan
- 이번 주 비범위: Replication·Sharding·Production 부하, NoSQL 비교 구현, Cache와 Week 4 인증·인가

## 계획 대비 결과

| 목표 | 계획 | 실제 결과 | 상태 | 근거 |
|---|---|---|---|---|
| Schema·정규화·Constraint | 잘못된 Row와 갱신 이상 재현 | `NOT NULL`·`CHECK`·Foreign Key 실패와 비정규·정규 제목 변경 비교 | Completed | [9월 1일 기록](./study-notes/2026-09-01-study-questions.md), [9월 6일 마감 기록](./study-notes/2026-09-06-study-questions.md) |
| Transaction·Atomicity | 상태 변경과 이력 저장을 하나의 단위로 검증 | 정상 Commit과 이력 실패 뒤 전체 Rollback, Sequence 공백 확인 | Completed | [9월 2일 기록](./study-notes/2026-09-02-study-questions.md) |
| Isolation·Lock | 두 Session의 가시성·충돌 재현 | 일반 조회·`FOR UPDATE`, Lost Update·원자적 증가·Version 충돌·Deadlock 비교 | Completed | [동시성 Lab](./lab-reports/2026-09-03-postgresql-isolation-and-lock-lab.md) |
| Index·실행 계획 | Index 전후 Plan 비교 | 100,000건 Dataset의 Seq Scan·Index Scan·정렬·`LIMIT` 비교 | Completed | [Query Plan Lab](./lab-reports/2026-09-04-postgresql-index-and-query-plan-lab.md) |
| PostgreSQL Adapter | Gate 통과 시 기존 Port 뒤에 최소 적용 | Docker·연속 구현 시간 Gate에 따라 시작하지 않음 | Deferred | [9월 6일 마감 기록](./study-notes/2026-09-06-study-questions.md) |
| JPA N+1·Connection Pool | 선행 조건이 있을 때만 Spike | 관계 Mapping·실제 연결과 측정 질문이 없어 수행하지 않음 | Deferred | [주간 학습 계획](./weekly-plan.md) |

## 핵심 학습

### Constraint는 현재 값, Domain은 허용된 변화 경로를 보호한다

- 질문: `CHECK (status IN (...))`가 있으면 Domain 상태 전이 규칙도 대체할 수 있는가?
- 최소 실험: `NOT NULL`·공백 `CHECK`·상태 `CHECK`와 Foreign Key의 성공·실패를 실행하고, SQL로 `OPEN → RESOLVED`를 직접 저장했다.
- 관찰: 허용 목록에 있는 `RESOLVED`는 `OPEN`에서 바로 저장해도 Database `CHECK`를 통과했다. `CHECK`는 식이 `FALSE`일 때 거부하지만 `NULL`로 평가되면 통과할 수 있어 필수 Column에는 `NOT NULL`도 필요했다.
- 원리 설명: Database Constraint는 현재 Row와 관계의 저장 가능 범위를 보호하고, Domain은 현재 상태에서 허용되는 다음 행동과 순서를 보호한다.
- 사용하지 않을 조건: 권한처럼 Ticket 외부 정보가 필요한 판단을 상태 객체 하나의 규칙으로 억지로 처리하지 않는다.

### 정규화는 중복된 사실의 갱신 이상을 줄인다

- 질문: 이력마다 Ticket 제목을 반복하면 일부 Row만 변경했을 때 무엇이 남는가?
- 최소 실험: 임시 비정규 이력 두 Row 중 한 Row의 제목만 바꾸고, 정규 구조에서는 부모 제목 한 건만 변경한 뒤 두 이력과 `JOIN`했다.
- 관찰: 비정규 구조에는 `로그인 오류`와 `SSO 로그인 오류`가 동시에 남았다. 정규 구조의 두 이력은 모두 부모의 현재 제목 `SSO 로그인 오류`를 조회했다.
- 원리 설명: 제목의 단일 진실 원천을 부모 Row에 두면 중복 수정 누락을 줄일 수 있다. 대신 `JOIN`, Foreign Key와 Transaction 경계 관리 비용이 추가된다.
- 사용하지 않을 조건: 이력 발생 당시의 제목 자체가 업무 증거라면 현재 부모 제목을 `JOIN`하는 구조만으로는 부족하며 Snapshot 또는 별도 Version 설계가 필요하다.

### Transaction은 변경 묶음을 보호하지만 Sequence와 외부 효과까지 되돌리지 않는다

- 질문: Ticket 상태 변경 뒤 이력 저장이 실패하면 일부 변경만 남는가?
- 최소 실험: 상태 `UPDATE`와 이력 `INSERT`를 같은 Transaction에 넣고, 허용되지 않은 `CLOSED` 이력으로 두 번째 SQL을 실패시켰다.
- 관찰: `ROLLBACK` 뒤 Ticket은 `OPEN`으로 돌아가고 실패 이력은 남지 않았다. 실패 중 소비된 Identity Sequence 값은 회수되지 않았다.
- 원리 설명: Atomicity는 같은 Database Transaction에 포함된 Row 변경을 함께 확정하거나 취소한다. Sequence 증가, 이미 전송한 외부 API와 Java Memory 상태는 같은 방식으로 자동 복구되지 않는다.
- 사용하지 않을 조건: 외부 Side Effect까지 Database Rollback으로 취소된다고 가정하지 않는다.

### MVCC, Lock과 충돌 검사는 서로 다른 문제를 다룬다

- 질문: 일반 조회, Lock 대기와 오래된 계산 결과는 어떻게 구분하는가?
- 최소 실험: 두 `psql` Session에서 미확정 Ticket 조회, `FOR UPDATE`, stale-read 저장, 원자적 증가, Version 조건과 반대·동일 Lock 순서를 비교했다.
- 관찰: 일반 `SELECT`는 A의 미확정 변경 대신 마지막 Commit 값을 읽었고, `FOR UPDATE`는 Lock을 기다렸다. 두 Session이 같은 이전 값으로 계산하면 Lost Update가 발생했고, 오래된 Version 조건은 Exception 대신 `UPDATE 0`을 반환했다. 역순 Lock은 Deadlock을 만들었지만 동일 순서는 단순 대기로 끝났다.
- 원리 설명: MVCC는 보이는 Row Version을 정하고, Row Lock은 충돌 작업의 순서를 정한다. 낙관적 Lock은 영향 Row 수를 Application이 충돌로 해석해야 하며, 일관된 Lock 순서는 순환 대기를 줄인다.
- 사용하지 않을 조건: 사용자 입력이나 외부 API를 기다리는 긴 Transaction에서 Row Lock을 유지하지 않는다.

### Index는 Dataset과 Query 형태에 맞을 때만 이득이다

- 질문: 같은 `status` Index를 왜 `RESOLVED`에는 사용하고 `OPEN`에는 사용하지 않는가?
- 최소 실험: `OPEN` 99,000건과 `RESOLVED` 1,000건을 만들고 단일·복합 Index 전후 `EXPLAIN (ANALYZE, BUFFERS)`를 비교했다.
- 관찰: 희소한 `RESOLVED`는 Index Scan, 흔한 `OPEN`은 Index가 있어도 Seq Scan이었다. 단일 Index는 최신 20건을 위해 1,000건과 `top-N heapsort`를 처리했지만 `(status, created_at DESC)`는 별도 Sort 없이 20건에서 멈췄다. `LIMIT`을 제거하면 Planner는 다시 단일 Index와 전체 정렬을 선택했다.
- 원리 설명: Planner는 Index 존재가 아니라 선택도, Heap 접근, 정렬과 예상 총비용을 비교한다. 복합 Index는 한 Table의 여러 Column으로 만들며 Column 순서가 지원 가능한 조건과 정렬을 결정한다.
- 사용하지 않을 조건: 한 번의 실행 시간이나 특정 Dataset의 Plan을 Production 성능 향상 비율로 일반화하지 않는다.

## 예상과 실제의 차이

| 예상 | 실제 관찰 | 원인 해석 | 이해가 바뀐 점 |
|---|---|---|---|
| `CHECK`가 허용 값과 `NULL`을 모두 거부한다. | `CHECK` 결과가 `NULL`이면 통과할 수 있다. | `CHECK`는 `FALSE`를 거부하고 필수 여부는 `NOT NULL`이 담당한다. | 값 조건과 존재 조건을 별도로 설계한다. |
| Rollback된 `INSERT`의 ID도 되돌아간다. | Row는 사라졌지만 다음 성공 Row에 더 큰 ID가 발급됐다. | Sequence 증가는 일반 Row 변경처럼 Rollback되지 않는다. | Identity를 빈틈없는 업무 번호로 사용하지 않는다. |
| 같은 값으로 두 번 저장해 최종 `1`이면 Lost Update다. | 순차 실행도 절대값 `1`을 두 번 저장하면 최종 `1`이다. | 같은 계산 방식에서 읽기 시점만 다른 순차·동시 대조가 필요했다. | 동시성 실험은 혼입 변수를 제거해야 한다. |
| Index가 있으면 해당 조건에서 사용된다. | `OPEN` 99%는 계속 Seq Scan이었다. | 대부분의 Heap Row를 읽을 때 순차 접근이 더 저렴할 수 있다. | Index 유무가 아니라 선택도와 Plan을 확인한다. |
| 복합 Index는 여러 Table의 Join용이다. | `(status, created_at DESC)`는 한 Table의 필터와 정렬을 함께 지원했다. | 복합 Index는 한 Table의 여러 Column으로 구성한다. | Column 순서와 실제 Query 조건을 함께 검토한다. |
| `LIMIT`은 항상 적은 Row만 읽게 한다. | 단일 Index에서는 1,000건을 읽고 정렬한 뒤 20건을 반환했다. | 필요한 정렬 순서를 제공하는 경로가 있어야 조기 종료할 수 있다. | `LIMIT`과 하위 Plan을 함께 읽는다. |

## 선택 적용과 독립 Spike

- Helpdesk Lab에 적용한 내용: Application Source는 변경하지 않았고 학습용 PostgreSQL에 Ticket·상태 이력 Schema와 Constraint를 구성했다.
- 적용 대신 독립 Spike로 분리한 내용: Transaction·동시성·Index·정규화 비교는 업무 Table 오염과 Framework 설정 혼입을 줄이기 위해 SQL Fixture와 임시 Table에서 수행했다.
- PostgreSQL Adapter 보류 이유: 일요일은 두 시간 미만의 축소 경로였고 시작 시 Docker Server 연결과 연속 90분 구현 시간이 모두 확보되지 않았다.
- Adapter 재개 조건: Docker Server, Migration·Test 격리 방식, 상태 복원 Domain API와 연속 90분 이상의 구현 시간을 먼저 확보한다.
- 조건부 후속: JPA N+1은 실제 관계 Mapping과 Query 반복이 생길 때, Connection Pool은 실제 연결 대기·고갈을 측정할 질문이 생길 때만 수행한다.

## Test와 학습 증거

| 근거 | 확인한 위험·질문 | 결과 | Link |
|---|---|---|---|
| Constraint·정규화 SQL | 잘못된 Row와 중복된 제목의 갱신 이상 | Constraint 실패와 정규화 전후 차이 확인 | [9월 1일](./study-notes/2026-09-01-study-questions.md), [9월 6일](./study-notes/2026-09-06-study-questions.md) |
| Transaction SQL | 중간 실패 뒤 일부 변경 잔존 | 상태 변경과 실패 이력 모두 Rollback | [9월 2일](./study-notes/2026-09-02-study-questions.md) |
| 두 Session SQL | 가시성·Lock·동시 갱신 충돌 | MVCC·대기·Lost Update·Version·Deadlock 재현 | [동시성 Lab](./lab-reports/2026-09-03-postgresql-isolation-and-lock-lab.md) |
| Query Plan | Index가 실제 Query 작업량을 줄이는 조건 | 단일·복합 Index와 `LIMIT` Plan 비교 | [Query Plan Lab](./lab-reports/2026-09-04-postgresql-index-and-query-plan-lab.md) |
| Java 전체 회귀 Test | SQL 학습 중 기존 Application 계약 훼손 여부 | 2026-09-07 00:59 KST, 33개 통과·실패 0·오류 0·건너뜀 0 | 별도 Lab `mvnw.cmd test` |
| PostgreSQL Integration Test | Application Adapter의 실제 영속화 | `NOT_RUN` | Adapter `NOT_IMPLEMENTED` |

Java Test는 기존 In-memory Application 계약의 회귀 근거이며 PostgreSQL Adapter가 동작한다는 증거가 아니다.

## 실패와 부분 완료

- 실험 중 PostgreSQL Minor Update로 두 Session 연결이 종료됐다. 재접속 후 Commit된 Schema·Row는 유지되고 미확정 변경은 남지 않은 것을 확인했다.
- 최초 Lost Update 비교는 고정값 저장만 사용해 순차 실행과 동시 stale-read를 구분하지 못했다. 같은 계산 방식의 대조를 추가해 교정했다.
- 희소값 Index Scan에서도 Row가 Heap 전체에 분산돼 접근 Buffer가 즉시 한 자리로 줄지는 않았다.
- PostgreSQL Adapter·Migration·Testcontainers는 구현하거나 실행하지 않았다. Local SQL과 기존 Java Test를 Integration Test로 표현하지 않는다.
- `REPEATABLE READ`·`SERIALIZABLE`, 정확한 Lock 대기 시간, Index 크기·쓰기 성능과 Production 부하는 측정하지 않았다.

## 설명 가능성 점검

- AI 도움 없이 설명한 흐름: Constraint와 Domain 규칙, Rollback Row와 Identity, 일반 조회·`FOR UPDATE`·Lost Update·Version 충돌, 선택도에 따른 Scan 선택
- 직접 수행한 실험: DDL·Constraint 실패, Transaction, 두 Session 동시성, 100,000건 Query Plan과 임시 정규화 비교
- 교정한 부분: `CHECK`의 `NULL`, 일반 조회의 Lock 표현, 복합 Index 정의와 `LIMIT` 조기 종료 조건
- 아직 구현하지 않은 부분: Repository Adapter, 실제 PostgreSQL Integration Test, JPA N+1과 Connection Pool 측정

## AI 활용

| 작업 | AI가 수행한 일 | 직접 판단·수정·검증한 일 |
|---|---|---|
| 개념 학습 | 질문 순서, 반례와 공식 문서 기준 설명 | 최초 답변 작성, 약한 개념 확인과 교정 수용 |
| SQL 실험 | 최소 재현 SQL과 Session 실행 순서 제시 | 사용자가 `psql`에서 예상·실행·오류·결과와 Rollback 확인 |
| 실험 설계 | Lost Update 대조와 Plan 해석의 혼입 변수 지적 | 사용자 결과를 순차·동시 Case와 Index 전후로 다시 비교 |
| 검증·문서 | Java 회귀 Test 실행과 Study Note·WIL 구조화 | 완료·보류 범위와 다음 조건 확인 |

AI가 제시한 SQL이나 설명은 사용자가 실행 결과를 확인하고 자신의 말로 원인과 결과를 설명한 범위만 학습 근거로 사용했다. 대화 원문, Credential과 로컬 절대 경로는 공개 문서에 포함하지 않았다.

## 공개 기술 콘텐츠

- 날짜별 Study Note: 8월 31일 복습부터 9월 6일 주간 마감까지
- 재사용 Learning Note: SQL 기초, Transaction·Atomicity, Isolation·MVCC·Lock, Index·실행 계획
- Lab Report: 두 Session 동시성, 고정 Dataset의 Index·Query Plan 비교
- 기술 블로그 후보: `UPDATE 0`을 낙관적 충돌로 해석하는 Application 책임, 선택도와 정렬이 Index 선택을 바꾸는 이유
- 아직 근거가 부족한 주장: Production 성능 향상 비율, Spring Transaction·JPA Lock의 실제 동작, Connection Pool 병목

## 회고

### 잘 작동한 학습 방식

- SQL 실행 전에 결과를 예상하고 실패·대조 Case를 분리하자 용어 암기보다 원인과 결과를 설명하기 쉬웠다.
- Application 연결 전에 두 Session과 고정 Dataset을 사용해 Transaction·동시성·Planner의 동작을 Framework와 분리해 관찰할 수 있었다.
- 네 가지 종합 질문에서 약한 답을 지우지 않고 복합 Index와 `LIMIT` 조건을 교정해 이해 변화가 남았다.

### 바꿀 학습 방식

- 동시성 실험은 처음부터 순차 대조와 동시 Case의 계산 절차를 같게 고정한다.
- Index 실험은 실행 시간보다 예상·실제 Row, Filter 제거 Row, Sort와 Buffer를 먼저 읽는다.
- 선택 적용은 학습 마지막 날에 설정부터 시작하지 않고, 필요한 환경과 연속 구현 시간을 주차 중간에 Gate로 확인한다.

## 다음 주

- 이어갈 핵심 질문: 인증된 사용자와 권한 있는 사용자를 Application이 어떤 경계에서 구분하고 실패를 안전한 HTTP 응답으로 표현하는가?
- 새로 선택할 학습 주제: Session·Cookie, 인증·인가와 대표 Web Security 실패 Case
- 자동으로 이어가지 않을 항목: PostgreSQL Adapter, JPA N+1, Connection Pool과 Week 3의 미측정 성능 항목
- PostgreSQL Adapter 재검토 조건: 실제 영속화가 다음 학습 질문에 필요하고 Docker·Migration·Test 격리와 연속 구현 시간이 확보될 때

## 관련 자료

- [Week 3 주간 학습 계획](./weekly-plan.md)
- [9월 6일 종합 복습·정규화 보완](./study-notes/2026-09-06-study-questions.md)
- [PostgreSQL 두 Session 동시성 Lab](./lab-reports/2026-09-03-postgresql-isolation-and-lock-lab.md)
- [PostgreSQL Index·Query Plan Lab](./lab-reports/2026-09-04-postgresql-index-and-query-plan-lab.md)
