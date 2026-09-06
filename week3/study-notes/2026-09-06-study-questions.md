# 2026-09-06 — Week 3 핵심 복습·정규화 보완과 주간 마감

> 작성일: 2026-09-06
> 학습 Session 시작: 2026-09-06 23:59 KST
> 학습 Session 종료: 2026-09-07 01:05 KST
> 목적: Schema·Transaction·동시성·Index의 핵심 이해를 자료 없이 점검하고, 비정규·정규 구조의 갱신 이상을 실제 SQL로 비교한 뒤 Week 3의 완료·부분 완료·보류 범위를 확정한다.
> 상태: Completed — Review Gate·정규화 보완 Spike와 Week 3 마감 완료

---

## 오늘의 마감 경로

남은 시간이 두 시간 미만이고 계획 시작 시점에 Docker Daemon을 사용할 수 없으므로 [주간 학습 계획](../weekly-plan.md)의 90분 마감 경로를 적용한다.

1. 30분: 네 핵심 질문에 자료 없이 답하고 가장 약한 질문을 교정한다.
2. 30분: 임시 Table에서 비정규·정규 구조의 제목 변경 결과를 비교한다.
3. 30분: 실제 근거와 완료·부분 완료·보류 상태를 정리하고 Week 3 WIL 초안을 마감한다.

PostgreSQL Adapter, JPA N+1, Connection Pool과 Week 4 인증·인가는 이번 Session에서 시작하지 않는다. 미수행 항목은 완료로 표시하지 않고 재개 조건을 남긴다.

## 시작 상태

| 항목 | 실제 상태 | 근거 경계 |
|---|---|---|
| WIL 저장소 | Working Tree Clean, `main`과 `origin/main` 동일 | 2026-09-06 23:59 KST `git status` |
| Lab 저장소 | Working Tree Clean, `main`과 `origin/main` 동일 | 2026-09-06 23:59 KST `git status` |
| 기존 Java 회귀 Test | 33개 통과, 실패·오류·건너뜀 0 | 2026-09-06 23:51 KST Codex 실행 |
| PostgreSQL | Windows Service 실행 중, `localhost:5432` 연결 수신 | 인증 없는 Service·`pg_isready` 확인 |
| Docker | CLI 29.7.2 확인, Daemon 연결 실패 | Testcontainers `NOT_RUN` |
| PostgreSQL Adapter | 구현 시작 전 | `NOT_IMPLEMENTED` |

Credential 값은 확인·출력·기록하지 않았다. PostgreSQL Service와 Port 확인은 Database 인증 접속이나 이번 정규화 SQL 실행 결과를 뜻하지 않는다.

## Review Gate — 최초 답변

자료와 AI 설명을 보기 전에 각 질문에 3~5문장으로 답한다. 최초 답변은 틀리더라도 지우지 않고, 이후 교정과 근거를 별도로 기록한다.

### 질문 1 — Constraint와 Domain 규칙

> `CHECK`와 `NOT NULL`을 왜 함께 사용하며, Database의 현재 값 Constraint와 `Ticket` Domain의 상태 전이 규칙은 무엇이 다른가?

최초 답변:

> check 는 제약조건을 거는 것입니다. not null 은 이름 그대로 null을 허용하지 않는 것입니다. DB Constraint 는 DB에 저장되는 데이터를 저장소 차원에서 통제하는 것이고, Domain 상태 전이 규칙은 도메인을 구성하는 java 클래스 코드 상에서 상태를 통제하는 것입니다.

판정: `PASS_WITH_CORRECTION`

교정:

- `NOT NULL`은 값이 `NULL`인 경우를 직접 거부한다.
- `CHECK`는 작성한 Boolean 조건식이 `FALSE`일 때 거부하지만 결과가 `NULL`·`UNKNOWN`이면 통과할 수 있다. 따라서 제목과 상태처럼 반드시 값이 있어야 하는 Column은 `NOT NULL`과 해당 `CHECK`를 함께 사용한다.
- Database Constraint는 저장하려는 현재 값·Row·관계의 허용 범위를 보호한다. `CHECK (status IN (...))`만으로 `OPEN → IN_PROGRESS → RESOLVED` 순서를 보장하지는 못한다.
- Domain 상태 전이 규칙은 Java 객체가 허용된 업무 행동과 순서만 수행하도록 통제한다. 단순히 “Java에 있다”가 아니라 현재 상태에서 허용되는 다음 행동을 보호한다는 점이 핵심이다.

### 질문 2 — Transaction과 Identity

> Ticket 상태 변경 뒤 이력 `INSERT`가 실패할 때 `ROLLBACK` 후 어떤 Row와 Identity 값이 남을 수 있으며, 그 이유는 무엇인가?

최초 답변:

> row는 transaction 이전 상태로 돌아가고, identity는 ROLLBACK의 영항없이 고유한 값을 생성합니다.

판정: `PASS`

교정:

- 같은 Transaction의 상태 변경과 이력 저장은 실패 후 `ROLLBACK`하면 둘 다 Transaction 시작 전 상태로 돌아간다.
- Identity가 사용하는 Sequence의 값 증가는 일반적인 Row 변경처럼 Rollback되지 않으므로 실패한 `INSERT`가 발급받은 번호가 다음 성공 Row에서 재사용되지 않을 수 있다.
- 따라서 Identity는 식별 값을 생성하지만 저장 Row 수와 일치하거나 빈틈없는 번호를 보장하지 않는다.

### 질문 3 — MVCC·Lock·Lost Update

> MVCC의 일반 `SELECT`, `FOR UPDATE` 대기, stale-read Lost Update와 Version 조건의 `UPDATE 0`은 각각 무엇을 보여 주는가?

최초 답변:

> select는 잠금을 획득하지 않은 일반적인 조회를 의미합니다. select ... for update는 데이터 수정 전, 대상 행(Row)에 배타적 잠금(Exclusive Lock)을 명시적으로 거는 락을 보여줍니다. 이 쿼리로 조회된 행은 다른 트랜잭션이 변경하거나, 똑같이 FOR UPDATE로 조회하려고 할 때 대기(Block)하게 만듭니다. Lost Update는 동시성 제어가 제대로 되지 않았을 때 발생하는 대표적인 데이터 정합성 오류를 보여줍니다. Version 조건의 UPDATE 0는 락을 걸지 않고 충돌을 사후에 감지하여 처리합니다.

판정: `PASS_WITH_CORRECTION`

교정:

- 일반 `SELECT`도 PostgreSQL 내부 Lock을 전혀 사용하지 않는 것은 아니다. 다만 대상 Row를 변경용으로 잠그지 않고 MVCC Snapshot에서 보이는 Version을 읽으므로 다른 Transaction의 미확정 변경을 직접 보지 않는다.
- `SELECT ... FOR UPDATE`는 조회한 Row를 변경 대상으로 잠근다. 다른 일반 `SELECT`는 계속 이전에 Commit된 Version을 읽을 수 있지만, 같은 Row를 변경하거나 호환되지 않는 Row Lock을 얻으려는 Transaction은 기다릴 수 있다.
- Lost Update는 두 Session이 같은 이전 값을 읽고 각각 계산한 뒤 나중 저장한 값이 먼저 저장한 값을 덮어쓰는 동시성 문제다.
- Version 조건의 `UPDATE 0`은 `WHERE id = ? AND version = ?`를 만족한 Row가 0개였다는 실행 결과다. PostgreSQL이 자동으로 낙관적 Lock Exception을 발생시킨 것이 아니므로 Application이 영향 Row 수를 확인해 충돌·재시도·실패로 해석해야 한다.

### 질문 4 — Index와 실행 계획

> 같은 `status` Index가 `RESOLVED` 약 1%에는 선택되고 `OPEN` 약 99%에는 선택되지 않은 이유와, 복합 Index·`LIMIT`이 `Sort`와 읽은 Row 수를 바꾼 이유는 무엇인가?

최초 답변:

> RESOLVED상태를 가진 row가 1%에 해당하므로 Index Scan을 하는 것이 Seq Scan 을 하는 것보다 유리하기 때문이고, OPEN 상태를 가진 rows는 99%정도 되므로, 마찬가지의 이유로 Seq Scan을 선택합니다. 복합 Index는 자주 사용하는 테이블(통상 2개 이상 테이블의 join)의 행에 인덱싱을 해서 더 빠르게 호출하기 위해 사용합니다. LIMIT의 효과는 전체를 탐색하지 않고, 조건 만족시 탐색을 중단시켜 탐색 비용을 줄이는 역할을 합니다.

판정: `PARTIALLY_CORRECT`

교정:

- 희소한 `RESOLVED`와 흔한 `OPEN`의 Scan 선택 설명은 실제 Dataset·Query Plan과 일치한다.
- 복합 Index는 여러 Table을 뜻하지 않고 한 Index를 한 Table의 두 개 이상 Column으로 구성한 것이다. Join Column으로 만든 복합 Index가 Join에 도움을 줄 수는 있지만 그것이 정의는 아니다.
- 이번 `(status, created_at DESC)` 복합 Index는 `status='RESOLVED'` 범위 안에서 필요한 최신순을 이미 제공해 별도 `Sort`를 없앴다.
- `LIMIT`이 있다고 항상 전체 탐색을 피하는 것은 아니다. 필요한 순서를 Index가 제공한 이번 Case에서는 20건을 받은 뒤 중단했지만, 단일 `status` Index만 있을 때는 1,000건을 읽고 `top-N heapsort`한 뒤 20건을 반환했다.

## Review Gate 판정

- 판정: `PASS` — 2개 `PASS_WITH_CORRECTION`, 1개 `PASS`, 1개 `PARTIALLY_CORRECT`
- 통과 조건: 네 질문 중 최소 세 개를 원인과 결과가 이어지도록 설명하고, 각 답변을 실제 SQL·Query Plan 근거와 연결한다.
- 통과 근거: Constraint·Transaction·동시성 세 질문의 핵심 원인과 결과를 설명했다. Index 선택도 설명은 맞았고 복합 Index·`LIMIT`의 적용 조건을 교정했다.
- 가장 약한 질문: 질문 4의 복합 Index 정의와 `LIMIT` 조기 종료 조건
- 다음 행동: 정규화 보완 Spike에서 예상과 실제 결과를 비교한다.

## 정규화 보완 Spike

- 실행 전 예상: `WRITTEN`
- 임시 Table SQL 실행: `USER_VERIFIED`
- 변경 전·후 결과: `EXPECTED_RESULT_MATCHED`
- 갱신 이상과 Trade-off 해석: `WRITTEN`

### 실행 전 예상 — 사용자 답변

1. 비정규 이력 두 Row 중 한 Row의 제목만 변경하면?

   > 다른 하나의 제목은 변경되지 않으므로, 정합성 이슈가 발생합니다.

2. 정규 구조에서 부모 Ticket 제목을 한 번 변경하고 이력과 `JOIN`하면?

   > 현재 값 기준으로 단일 제목으로 표현됩니다.

3. 정규화로 얻는 이점과 추가되는 비용은?

   > 이점: 단일 진실의 원칙 유지, 비용: 테이블 join을 할 때마다 연산 비용 발생.

예상 판정: `PASS`

- 비정규 구조에서는 같은 Ticket을 설명하는 두 Row의 제목이 서로 달라지는 갱신 이상이 생긴다는 예측이다.
- 정규 구조에서는 제목을 부모 Ticket Row 한 곳에서 관리하므로 두 이력 Row를 현재 Ticket과 `JOIN`하면 같은 현재 제목이 조회된다는 예측이다. 이 구조는 이력 발생 당시 제목의 Snapshot을 보존하는 설계와는 다르다.
- 단일 진실 원천을 유지하는 이점과 `JOIN`의 실행·관계 관리 비용을 함께 설명했다. 실제 비용은 Dataset, Index와 실행 계획에 따라 달라지므로 `JOIN`이 항상 느리다고 단정하지 않는다.

기존 `tickets`, `ticket_status_history`와 Index 실험 Fixture는 변경하거나 삭제하지 않는다.

### 실행과 실제 결과

사용자가 `ai_helpdesk_learning_lab`에 접속하여 하나의 Transaction 안에서 임시 비정규·정규 Table을 만들고 직접 실행했다.

비정규 이력은 같은 `ticket_id=100`과 제목 `로그인 오류`를 두 Row에 반복 저장했다. `history_id=2` 한 건의 제목만 변경한 결과는 다음과 같았다.

| `history_id` | `ticket_id` | `ticket_title` | `to_status` |
|---:|---:|---|---|
| 1 | 100 | `로그인 오류` | `OPEN` |
| 2 | 100 | `SSO 로그인 오류` | `IN_PROGRESS` |

같은 Ticket을 나타내는 두 이력 Row에 서로 다른 제목이 남아 실행 전 예상대로 갱신 이상이 발생했다.

정규 구조에서는 제목을 부모 Ticket Row에 한 번만 저장하고 이력은 `ticket_id`로 참조했다. 부모 제목 한 건을 `SSO 로그인 오류`로 변경한 뒤 두 이력을 `JOIN`한 결과는 다음과 같았다.

| `history_id` | `ticket_id` | 현재 `title` | `to_status` |
|---:|---:|---|---|
| 1 | 100 | `SSO 로그인 오류` | `OPEN` |
| 2 | 100 | `SSO 로그인 오류` | `IN_PROGRESS` |

정규 구조는 현재 제목의 단일 진실 원천을 유지해 일부 Row만 변경되는 문제를 줄인다. 대신 조회 시 `JOIN`, Foreign Key와 Transaction 경계를 관리해야 한다. 이 `JOIN` 결과는 이력 발생 당시 제목이 아니라 현재 Ticket 제목을 보여 주며, 과거 Snapshot이 요구되면 별도의 이력 설계가 필요하다.

마지막 `ROLLBACK` 뒤 `to_regclass('pg_temp.w3_denormalized_history_spike')`는 `NULL`을 반환했다. 임시 Table 생성과 데이터 변경은 남지 않았고 기존 영구 학습 Table도 수정하지 않았다.

## Week 3 마감 상태

| 범위 | 최종 상태 | 판단 근거 |
|---|---|---|
| Schema·Constraint·정규화 | `Completed` | Constraint 실패, 정규 Schema와 비정규·정규 갱신 결과 비교 |
| Transaction·Atomicity | `Completed` | 정상 Commit과 상태 변경·이력 실패의 전체 Rollback 재현 |
| Isolation·MVCC·Lock | `Completed` | 일반 조회·Lock 대기·Lost Update·Version 충돌과 Deadlock 재현 |
| Index·실행 계획 | `Completed` | 100,000건 Dataset의 Scan·정렬·`LIMIT` 실행 계획 비교 |
| PostgreSQL Repository Adapter | `Deferred` | 90분 축소 경로와 Docker·연속 구현 시간 Gate에 따라 시작하지 않음 |
| JPA N+1·Connection Pool | `Deferred` | 실제 관계 Mapping·PostgreSQL 연결과 측정 질문이 없어 조건 미충족 |

Adapter를 재개하려면 Docker Server 연결, 연속 90분 이상의 구현 시간, Migration·Test 격리 방식과 Domain 상태 복원 경계를 먼저 확정한다. 기본 `InMemoryTicketRepository`를 교체하거나 H2·Mock 결과를 실제 PostgreSQL Integration Test로 표현하지 않는다.

2026-09-07 00:59 KST에 별도 Lab 저장소의 `mvnw.cmd test`를 다시 실행해 기존 Test 33개가 실패·오류·건너뜀 없이 통과했고 `BUILD SUCCESS`를 확인했다. Application Source와 Database Adapter는 변경하지 않았다.

## AI 활용과 검증 경계

- Codex 수행: 저장소·환경 확인, 질문·임시 SQL 절차 제시, 답변·실행 결과 교정, Java 전체 회귀 Test와 문서 정리
- 사용자 직접 수행: 네 핵심 질문과 정규화 예상 답변, PostgreSQL 접속·임시 Table SQL·결과 조회·`ROLLBACK`
- 근거 형태: 사용자가 제공한 실제 `psql` 출력과 Codex가 실행한 Maven 전체 Test 결과
- Codex 독립 Database 인증 접속·SQL 실행: `NOT_RUN`
- Testcontainers: `NOT_RUN`
- PostgreSQL Adapter: `NOT_IMPLEMENTED`
