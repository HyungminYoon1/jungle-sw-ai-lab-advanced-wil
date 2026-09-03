# Lab Report — PostgreSQL 두 Session의 가시성·Lock·동시 갱신

> 작성일: 2026-09-03
> 주차: Week 3
> 과정 영역: Database
> 상태: Completed

## 한눈에 보기

- 질문: 두 Session이 같은 Row를 동시에 읽고 수정할 때 MVCC, Row Lock, 낙관적 Lock과 Deadlock은 어떤 결과를 만드는가?
- 예상: 일반 조회는 미확정 변경을 보지 않고, Lock이 필요한 문장은 대기하며, 오래된 Version과 순환 Lock은 별도 충돌로 나타난다.
- 관찰: 일반 `SELECT`는 마지막 Commit 값을 즉시 읽었고 `FOR UPDATE`는 대기했다. Version 조건은 `UPDATE 0`을 반환했으며 역순 Lock은 실제 Deadlock을 만들었다.
- 결론: 가시성, 단순 대기, Lost Update와 Deadlock은 서로 다른 문제다. 원자적 SQL, Version 충돌 검사와 일관된 Lock 순서는 각각 다른 위험을 줄인다.

## 학습 배경

9월 2일에는 Ticket 현재 상태와 상태 이력의 두 변경을 같은 Transaction으로 묶어 정상 Commit과 중간 실패 Rollback을 확인했다. 그러나 한 Session만으로는 다른 요청이 미확정 변경을 보는지, 같은 Row를 동시에 수정하면 누가 기다리는지, 오래된 계산이 어떻게 다른 갱신을 덮는지 확인할 수 없었다.

이번 Lab은 Spring·JPA를 먼저 연결하지 않고 PostgreSQL 두 Session에서 동시성 현상을 최소 SQL로 관찰하는 데 목적이 있다.

## 범위

### 포함

- PostgreSQL 기본 `READ COMMITTED`에서 미확정 변경의 가시성
- 일반 `SELECT`와 `SELECT ... FOR UPDATE`의 차이
- Application에서 읽고 계산한 절대값 저장과 Lost Update
- Database 내부 원자적 증가
- Version 조건을 이용한 낙관적 Lock 충돌
- 반대 Lock 순서의 Deadlock과 동일 순서의 예방 효과

### 포함하지 않음

- `REPEATABLE READ`·`SERIALIZABLE` 비교
- Production 수준의 동시 사용자 수·지연 시간 측정
- Spring Transaction, JPA `@Version` 또는 PostgreSQL Repository Adapter
- Ticket 업무 상태 전이의 동시성 정책 결정

## 예상과 실패 조건

| Case | 입력·조건 | 예상 결과 | 실패로 볼 조건 |
|---|---|---|---|
| MVCC 조회 | A가 Ticket을 미확정 수정하고 B가 일반 조회 | B는 마지막 Commit 값 조회 | B가 미확정 값을 읽거나 불필요하게 대기 |
| Row Lock | 같은 조건에서 B가 `FOR UPDATE` | A 종료까지 대기 또는 Timeout | 즉시 Lock을 얻어 두 Session이 동시에 수정 |
| Lost Update | A·B가 같은 값 0을 읽어 각각 1을 계산·저장 | 최종 값 1, 한 증가 유실 | 최종 값 2 |
| 원자적 증가 | 두 Session이 SQL 안에서 `value + 1` | Lock 직렬화 후 최종 값 2 | 최종 값 1 |
| 낙관적 Lock | A·B가 같은 Version을 읽고 조건부 갱신 | 첫 갱신 1건, 두 번째 갱신 0건 | 오래된 Version으로 두 번째 갱신 성공 |
| Deadlock | A는 `1→2`, B는 `2→1` 순서로 Lock | 순환 감지 후 한 Transaction 중단 | 두 Transaction이 무기한 대기 |
| 동일 순서 | A·B 모두 `1→2` 순서로 Lock | 단순 대기 후 모두 완료 | 순환 Deadlock 발생 |

## 환경

| 항목 | 실제 값 |
|---|---|
| OS | Windows 11 |
| Database | `ai_helpdesk_learning_lab` |
| PostgreSQL | Server 17.11, `psql` Client 17.7 |
| Isolation Level | `read committed` |
| Session | 서로 다른 PostgreSQL Backend PID를 가진 A·B |
| Source 기준 | 2026-09-03~04 사용자 제공 `psql` 실행 결과 |

실험 중 PostgreSQL Minor Update 전에는 Server 17.7이었다. Update가 기존 연결을 종료한 뒤 Server 17.11에 다시 연결했으며, 이후 동시 갱신 실험은 새 Session에서 계속했다. Credential 값은 기록하지 않았다.

## Fixture

Ticket 가시성 실험은 기존 `tickets.id=6` Row를 사용했다. Counter 동시성 실험은 Ticket 업무 데이터와 이력을 오염시키지 않도록 별도 Table에서 수행했다.

```sql
CREATE TABLE concurrency_lab_counters (
    id INTEGER PRIMARY KEY,
    counter_value INTEGER NOT NULL,
    version INTEGER NOT NULL DEFAULT 0
);

INSERT INTO concurrency_lab_counters (
    id,
    counter_value,
    version
)
VALUES
    (1, 0, 0),
    (2, 0, 0);
```

각 비교 실험 전에는 두 Session의 Transaction이 끝났는지 확인하고 필요한 Row를 `counter_value=0`, `version=0`으로 초기화했다.

## 방법과 관찰

### 1. Session과 Isolation Baseline

각 Terminal에서 다음 항목을 조회했다.

```sql
SELECT
    pg_backend_pid() AS backend_pid,
    current_database() AS database_name,
    current_setting('transaction_isolation') AS isolation_level;
```

두 Session은 서로 다른 Backend PID를 사용했고 Database는 모두 `ai_helpdesk_learning_lab`, Isolation Level은 모두 `read committed`였다.

### 2. 미확정 변경의 가시성과 `FOR UPDATE`

Session A에서 Ticket을 수정하고 Transaction을 열어 둔 상태로 유지했다.

```sql
BEGIN;

UPDATE tickets
SET status = 'IN_PROGRESS',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 6
RETURNING id, status, updated_at;
```

Session B의 일반 `SELECT`는 대기하지 않고 기존 Commit 값 `OPEN`과 이전 `updated_at`을 반환했다.

```sql
SELECT id, status, updated_at
FROM tickets
WHERE id = 6;
```

반면 다음 Lock 조회는 5초 뒤 `lock timeout`으로 취소됐다.

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';

SELECT id, status, updated_at
FROM tickets
WHERE id = 6
FOR UPDATE;
```

Session B를 `ROLLBACK`하고 A도 `ROLLBACK`한 뒤 두 Session 모두 다시 `OPEN`을 확인했다.

### 3. Lost Update 대조

Application이 값을 읽어 `현재 값 + 1`을 계산한 뒤 절대값을 저장한다고 가정했다.

순차 대조에서는 A가 `0`을 읽어 `1`로 Commit한 뒤 B가 최신 값 `1`을 읽어 `2`로 Commit했다. 최종 값은 `2`였다.

동시 stale-read에서는 A와 B가 모두 Commit 전 값 `0`을 먼저 읽고 각각 저장할 값 `1`을 계산했다. A가 `1`을 Commit한 뒤 B도 예전에 계산한 `1`을 저장했다. 최종 값은 `1`이었다.

```sql
UPDATE concurrency_lab_counters
SET counter_value = 1
WHERE id = 1;
```

초기 실험은 단순히 두 Session이 `SET counter_value = 1`을 실행한 결과만 비교해 대조가 부족했다. 순차 대조도 같은 계산 절차로 다시 구성하여 읽기 시점이 결과를 바꾼다는 점을 명확히 했다.

### 4. Database 내부 원자적 증가

두 Session에서 같은 SQL을 실행했다.

```sql
BEGIN;

UPDATE concurrency_lab_counters
SET counter_value = counter_value + 1
WHERE id = 1
RETURNING id, counter_value, version;
```

A가 Row Lock을 보유한 동안 B의 `UPDATE`는 기다렸다. A가 Commit한 뒤 B의 문장은 최신 Commit 값에 `1`을 더해 `2`를 반환했다. 두 Session이 Commit한 최종 값은 `counter_value=2`, `version=0`이었다.

### 5. Version 조건의 낙관적 Lock

A와 B가 모두 `counter_value=0`, `version=0`을 읽었다. A가 다음 SQL로 먼저 Commit했다.

```sql
UPDATE concurrency_lab_counters
SET counter_value = 1,
    version = version + 1
WHERE id = 1
  AND version = 0
RETURNING id, counter_value, version;
```

A의 결과는 `UPDATE 1`, `counter_value=1`, `version=1`이었다. B가 오래된 `version=0`으로 같은 SQL을 실행한 결과는 Exception이 아닌 `UPDATE 0`이었다.

B가 Row를 다시 읽고 새 값 `2`를 계산한 뒤 `version=1`을 조건으로 재시도하자 `UPDATE 1`, `counter_value=2`, `version=2`가 됐다.

### 6. 반대 순서 Lock과 Deadlock

초기값은 두 Row 모두 `0`이었다.

```text
Session A                         Session B
BEGIN                             BEGIN
UPDATE id=1                       UPDATE id=2
UPDATE id=2 → 대기                UPDATE id=1 → 순환 완성
                                  Deadlock 감지·Transaction 실패
A의 대기 중 UPDATE 재개
ROLLBACK                          ROLLBACK
```

PostgreSQL 오류 상세에는 한 Backend가 상대 Transaction의 Lock을 기다리고 상대도 반대쪽 Lock을 기다리는 관계가 표시됐다. B가 희생자로 중단됐고, A의 대기 중 문장은 진행됐다. 이 선택을 모든 실행에서 B가 중단된다는 규칙으로 일반화하지 않는다.

두 Transaction을 모두 Rollback한 뒤 `id=1`, `id=2`는 다시 `counter_value=0`, `version=0`이었다.

### 7. 동일 순서 Lock

두 Session 모두 `id=1` 다음 `id=2` 순서로 갱신했다.

```text
Session A: id=1 → id=2 → COMMIT
Session B: id=1 → id=2 → COMMIT
```

B는 A가 보유한 첫 Row에서 진행 순서를 기다린 뒤 같은 방향으로 실행됐다. Deadlock은 발생하지 않았고 최종 결과는 다음과 같았다.

```text
id=1, counter_value=2, version=0
id=2, counter_value=2, version=0
```

정확한 대기 시간은 별도로 측정하지 않았다.

## 결과

| Case | 실제 결과 | 근거 | 예상과 일치 |
|---|---|---|---|
| 일반 조회 | A 미확정 값 대신 Commit된 `OPEN` 반환 | Session B `SELECT` 출력 | Yes |
| Lock 조회 | `FOR UPDATE`가 5초 뒤 Timeout | PostgreSQL Lock Timeout 오류 | Yes |
| Lost Update | 동시 stale-read 최종 `1`, 순차 대조 최종 `2` | Counter 최종 조회 | Yes |
| 원자적 증가 | 두 증가가 직렬화되어 최종 `2` | 각 `RETURNING`과 최종 조회 | Yes |
| 낙관적 Lock | 오래된 Version은 `UPDATE 0`, 재시도 후 값·Version `2` | 영향 Row 수와 최종 조회 | Yes |
| Deadlock | 역순 Lock에서 실제 Deadlock 감지 | PostgreSQL Deadlock 오류와 Backend 관계 | Yes |
| 동일 순서 | 두 Transaction 완료, 두 Row 최종 `2` | 최종 정렬 조회 | Yes |
| Update 중단 복구 | Commit 전 변경은 남지 않고 Table·Commit Row는 유지 | 재접속 후 Version·Row 조회 | Yes |

## 예상과 달랐던 점

1. Version 조건 충돌은 PostgreSQL이 자동으로 Exception을 발생시키지 않고 `UPDATE 0`으로 표현했다.
2. Deadlock이 생기면 관련 Transaction이 모두 중단되는 것이 아니라 PostgreSQL이 하나를 중단해 순환을 끊었다.
3. `SET counter_value = 1`만 두 번 실행한 초기 비교는 동시성과 순차 실행을 구분하지 못했다. 같은 계산 방식에서 두 번째 Session의 읽기 시점만 달리한 대조가 필요했다.
4. PostgreSQL Update로 연결이 끊겼지만 Commit된 Schema·Row는 유지되고 미확정 변경은 남지 않았다.

## 원리 설명

MVCC는 읽기가 다른 Transaction의 미확정 변경을 직접 보지 않도록 Version을 구분한다. 하지만 MVCC가 Application 수준의 오래된 계산까지 자동으로 감지해 주는 것은 아니다.

- 원자적 SQL: 계산과 저장을 한 SQL 문장 안에서 수행하고 Row Lock으로 직렬화한다.
- 비관적 Lock: 사용할 Row를 먼저 잠그며 충돌 시 기다리는 비용이 있다.
- 낙관적 Lock: 잠그지 않고 진행하되 Version이 달라진 갱신을 영향 Row 수로 감지하고 재시도·실패 정책을 적용한다.
- 동일 Lock 순서: 여러 Row를 잠글 때 순환 대기를 줄이지만 모든 코드 경로가 같은 규칙을 지켜야 한다.

Transaction은 가능한 짧게 유지하고, 사용자 입력이나 외부 API 응답을 기다리는 동안 Row Lock을 보유하지 않는다. `lock_timeout`은 학습 실험과 운영상 무한 대기를 피하는 보조 수단이지 Deadlock 설계를 대신하지 않는다.

## Test와 검증

| 검증 | 대상 위험 | 결과 | Link·근거 |
|---|---|---|---|
| 두 Session 수동 SQL | 미확정 변경 노출 | Pass | 일반 `SELECT`에서 Commit 값 확인 |
| Lock Timeout SQL | 잠금 대기 여부 | Pass | `FOR UPDATE` 5초 Timeout |
| 순차·동시 대조 | Lost Update 오해 | Pass | 최종 값 `2`와 `1` 비교 |
| 영향 Row 수 확인 | 낙관적 Lock 충돌 누락 | Pass | 오래된 Version에서 `UPDATE 0` |
| 역순 Lock | Deadlock 조건 | Pass | 실제 Deadlock 오류 확인 |
| 동일 순서 Lock | 예방 전략 | Pass | 두 Transaction Commit, 최종 값 `2·2` |
| Java·Spring Test | Application 연동 회귀 | `NOT_RUN` | Source·Dependency 변경 없음 |

## 선택적 적용

- Helpdesk Lab에 적용 여부: 아직 미적용
- 이유: 이번 질문은 PostgreSQL SQL 수준의 동시성 동작을 이해하는 것이며 Application Adapter는 아직 선택 적용 단계다.
- 적용한다면: `TicketRepository` Port 뒤 Adapter에서 Transaction 경계와 충돌 정책을 명시하고 실제 PostgreSQL Integration Test로 확인한다.
- 적용하지 않은 범위: JPA `@Version`, 비관적 Lock Query와 재시도 정책

## 설명 가능성 점검

- 설명할 수 있는 흐름: 미확정 Version 조회, Row Lock 대기, stale-read Lost Update, Version 충돌, 순환 대기
- 직접 수행한 변경: 두 Session SQL, Counter Fixture, 초기화·Commit·Rollback과 결과 조회
- 교정한 이해: `UPDATE 0`은 자동 Exception이 아니며 Deadlock은 모든 Transaction을 중단하지 않는다.
- 남은 부분: 다른 Isolation Level, 정확한 대기 시간과 Spring Application 적용

## AI 활용

| 작업 | AI 역할 | 직접 판단·수정·검증한 내용 |
|---|---|---|
| 개념 학습 | 순차 질문과 결과 해석 보조 | 사용자가 예상·관찰 차이를 설명하고 SQL 결과 확인 |
| SQL 실험 | 최소 재현 절차 제시 | 사용자가 두 Session에서 직접 실행·Rollback·재접속 |
| 실험 설계 교정 | Lost Update 대조의 혼입 변수 지적 지원 | 사용자가 고정값 갱신 비교의 한계를 먼저 제기 |
| 기록 | Study Note와 Lab Report 구조화 | 사용자 제공 출력 범위만 근거로 반영 |

## 한계와 다음 질문

- 현재 결론은 로컬 PostgreSQL 17, `READ COMMITTED`, 두 Session과 작은 Fixture에서 유효하다.
- 실제 동시 사용자 수, 처리량과 대기 시간은 측정하지 않았다.
- `REPEATABLE READ`·`SERIALIZABLE`의 Snapshot·직렬화 실패는 확인하지 않았다.
- Spring Transaction과 JPA Lock 전략이 같은 결과를 만드는지는 별도 Integration Test가 필요하다.
- 다음 실험은 고정 Dataset의 Index 전후 `EXPLAIN (ANALYZE, BUFFERS)` 비교다.

## 재현 시 주의사항

1. 두 Terminal이 같은 Database에 연결됐고 Backend PID는 다른지 확인한다.
2. 이전 Transaction을 `COMMIT` 또는 `ROLLBACK`해 초기 상태를 고정한다.
3. 각 단계의 실행 Session과 순서를 먼저 적고 SQL을 입력한다.
4. 대기 실험에는 제한된 `lock_timeout`을 사용한다.
5. Deadlock 실험이 끝나면 실패 Prompt를 확인하고 양쪽 Transaction을 모두 정리한다.
6. 최종 Row를 별도 `SELECT`로 확인한다.
7. 운영 데이터가 아니라 독립 Fixture에서 수행한다.

## 참고 자료

- [PostgreSQL 17 — Transaction Isolation](https://www.postgresql.org/docs/17/transaction-iso.html)
- [PostgreSQL 17 — Introduction to MVCC](https://www.postgresql.org/docs/17/mvcc-intro.html)
- [PostgreSQL 17 — Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html)
- [PostgreSQL 17 — Client Connection Defaults](https://www.postgresql.org/docs/17/runtime-config-client.html)
- [PostgreSQL Isolation·MVCC·Lock Learning Note](../study-docs/learning-postgresql-isolation-mvcc-and-locks.md)
