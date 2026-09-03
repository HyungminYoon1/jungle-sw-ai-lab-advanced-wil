# Learning Note — PostgreSQL Isolation·MVCC·Lock

> 작성일: 2026-09-03
> 기준: PostgreSQL 17 공식 문서

## 핵심 질문

> 여러 Session이 같은 데이터를 동시에 읽고 변경할 때 PostgreSQL은 무엇을 보여주고, 언제 기다리게 하며, Application은 어떤 동시성 문제를 별도로 처리해야 하는가?

## 학습 목표

이 자료를 학습한 뒤 다음 내용을 자신의 말로 설명하는 것이 목표다.

- Session과 Transaction을 구분한다.
- Isolation Level이 동시 Transaction 사이의 가시성을 정하는 이유를 설명한다.
- PostgreSQL의 기본 Isolation Level인 `READ COMMITTED`의 Snapshot 경계를 설명한다.
- MVCC가 일반 조회와 쓰기의 충돌을 줄이는 방법을 설명한다.
- 일반 `SELECT`와 `SELECT FOR UPDATE`의 대기 여부를 구분한다.
- Row Lock의 획득 시점과 해제 시점을 설명한다.
- Lost Update가 발생하는 전형적인 읽기-계산-쓰기 흐름을 설명한다.
- Deadlock의 순환 대기 조건과 일관된 Lock 순서가 필요한 이유를 설명한다.
- 낙관적 Lock과 비관적 Lock의 선택 비용을 비교한다.

개인의 이해 상태와 실제 Session A·B 실행 결과는 날짜별 Study Note 또는 Lab Report에 기록한다. 이 문서는 특정 날짜의 진도와 독립적으로 다시 읽을 수 있는 개념 자료다.

## 먼저 구분할 세 개념

Isolation, MVCC와 Lock은 서로 경쟁하는 세 가지 기능이 아니다. 서로 다른 질문에 답한다.

| 개념 | 핵심 질문 | 역할 |
|---|---|---|
| Isolation | 다른 Transaction의 변경이 나에게 언제 보이는가? | 동시 Transaction 사이의 가시성과 허용할 이상 현상 결정 |
| MVCC | 읽기와 쓰기를 어떻게 함께 처리하는가? | 여러 Row Version과 Snapshot을 이용하여 일관된 조회 제공 |
| Lock | 같은 자원을 동시에 바꾸거나 잠그려 하면 어떻게 조정하는가? | 충돌하는 작업을 대기·실패 또는 순차 실행하게 함 |

짧게 표현하면 다음과 같다.

```text
Isolation = 무엇이 보이는가
MVCC      = 그 보기를 가능하게 하는 핵심 방식
Lock      = 충돌하는 변경을 어떻게 조정하는가
```

## Session과 Transaction

### Session

Session은 Client와 PostgreSQL Server 사이의 하나의 연결 문맥이다. 서로 다른 두 `psql` 창에서 각각 Database에 접속했다면 두 Session으로 볼 수 있다.

### Transaction

Transaction은 하나의 Session 안에서 실행되는 작업 단위다.

```text
Session A
└── BEGIN ... COMMIT 또는 ROLLBACK

Session B
└── BEGIN ... COMMIT 또는 ROLLBACK
```

한 Session에서 Transaction을 끝내도 다른 Session 자체가 종료되는 것은 아니다. 반대로 Session이 다르다고 항상 동시에 실행되는 것도 아니다. 같은 Row에 충돌하는 Lock을 요청하면 한 Session의 명령이 다른 Transaction을 기다릴 수 있다.

## Isolation이 필요한 이유

Transaction이 하나씩 순서대로만 실행된다면 다른 Transaction의 중간 상태를 어떻게 볼지 고민할 필요가 적다. 실제 Server에서는 여러 요청이 동시에 실행되므로 다음과 같은 질문이 생긴다.

- 다른 Transaction이 아직 Commit하지 않은 값을 읽어도 되는가?
- 같은 Transaction에서 같은 Row를 두 번 읽었을 때 값이 달라도 되는가?
- 내가 읽고 판단하는 사이에 다른 Transaction이 값을 바꿔도 되는가?
- 동시 실행 결과가 순차 실행으로 설명되지 않아도 되는가?

Isolation Level은 이런 현상을 어느 정도까지 허용할지 정한다. 강한 Isolation은 더 단순한 일관성 모델을 제공할 수 있지만 대기, 재시도와 관리 비용이 늘어날 수 있다.

## 대표적인 동시성 이상 현상

### Dirty Read

다른 Transaction이 아직 Commit하지 않은 값을 읽는 현상이다. 그 Transaction이 Rollback하면 읽었던 값은 확정된 적이 없는 값이 된다.

PostgreSQL의 `READ COMMITTED`에서는 Dirty Read가 발생하지 않는다.

### Nonrepeatable Read

한 Transaction에서 같은 Row를 다시 읽었는데, 그 사이 다른 Transaction이 Commit한 변경 때문에 값이 달라지는 현상이다.

PostgreSQL의 `READ COMMITTED`에서는 각 명령이 시작될 때 새 Snapshot을 사용하므로 발생할 수 있다.

### Phantom Read

같은 검색 조건으로 다시 조회했는데 다른 Transaction의 Commit 때문에 결과 Row 집합이 달라지는 현상이다.

예를 들어 첫 조회에는 `status = 'OPEN'`인 Row가 5개였지만 다음 조회에는 6개가 보일 수 있다.

### Serialization Anomaly

동시에 Commit된 여러 Transaction의 최종 결과를 어떤 순서의 단일 실행으로도 설명할 수 없는 현상이다.

PostgreSQL의 `SERIALIZABLE`은 이런 상황을 감지하면 일부 Transaction을 실패시킬 수 있다. Application은 해당 Transaction 전체를 처음부터 재시도할 준비가 필요하다.

### Lost Update

두 작업이 같은 이전 값을 바탕으로 각각 새 값을 계산한 뒤, 나중의 쓰기가 앞선 쓰기 결과를 덮어써서 변경 하나가 사라지는 문제다.

```text
초기 값: 10

Transaction A가 10을 읽음
Transaction B도 10을 읽음
Transaction A가 10 + 1 결과인 11을 저장
Transaction B도 자신이 읽은 10 + 1 결과인 11을 저장

기대한 값: 12
최종 값: 11
```

Lost Update는 모든 동시 `UPDATE`에서 자동으로 발생하는 것은 아니다. 다음처럼 Database 안에서 현재 값을 기준으로 한 문장으로 증가시키면 PostgreSQL은 충돌하는 Row를 순서대로 갱신할 수 있다.

```sql
UPDATE ticket_metrics
SET response_count = response_count + 1
WHERE ticket_id = 1;
```

반면 Application이 값을 먼저 읽고 계산한 뒤 별도의 `UPDATE`로 절대값을 저장하면 오래된 읽기 결과로 최신 변경을 덮어쓸 수 있다.

## PostgreSQL의 Isolation Level

PostgreSQL은 다음 동작을 제공한다.

| 요청한 Level | PostgreSQL의 주요 동작 |
|---|---|
| `READ UNCOMMITTED` | PostgreSQL에서는 `READ COMMITTED`처럼 동작 |
| `READ COMMITTED` | 각 SQL 명령 시작 시점의 Snapshot 사용, 기본값 |
| `REPEATABLE READ` | Transaction의 첫 비제어 명령 시점에 형성된 안정된 Snapshot 사용 |
| `SERIALIZABLE` | 순차 실행과 같은 결과를 보장하도록 충돌을 감시하고 필요하면 실패 처리 |

Isolation Level은 다음처럼 명시할 수 있다.

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;

SELECT id, status
FROM tickets
WHERE id = 1;

COMMIT;
```

더 강한 Level을 선택했다고 모든 문제가 조용히 해결되는 것은 아니다. `REPEATABLE READ`와 `SERIALIZABLE`에서는 충돌에 따라 Transaction이 실패할 수 있으므로 전체 재시도 정책이 필요하다.

## `READ COMMITTED`의 Snapshot 경계

PostgreSQL의 기본 Isolation Level은 `READ COMMITTED`다. 일반 `SELECT`는 그 명령이 시작되기 전에 Commit된 데이터만 본다.

다음 상황을 생각해본다.

```text
초기 Commit 상태: OPEN

Session A
BEGIN
UPDATE: OPEN → IN_PROGRESS
아직 COMMIT하지 않음

Session B
일반 SELECT 실행
```

결과는 다음과 같다.

- Session A는 자신의 이전 변경을 볼 수 있으므로 `IN_PROGRESS`를 본다.
- Session B는 A의 미커밋 변경을 볼 수 없으므로 `OPEN`을 본다.
- Session B의 일반 `SELECT`는 Row Lock을 요구하지 않으므로 A의 종료를 기다리지 않는다.

`READ COMMITTED`에서는 같은 Transaction 안에서도 연속된 두 `SELECT`가 서로 다른 결과를 볼 수 있다.

```text
Session B의 첫 SELECT 시작 → OPEN
Session A가 IN_PROGRESS를 COMMIT
Session B의 두 번째 SELECT 시작 → IN_PROGRESS
```

각 명령이 시작될 때 새 Snapshot을 얻기 때문이다.

## MVCC — 여러 Version 중 보이는 것을 선택

MVCC는 **Multiversion Concurrency Control**, 즉 다중 버전 동시성 제어다.

개념적으로 한 Row가 변경될 때 기존 내용을 즉시 모든 관찰자에게 덮어쓰는 대신, Transaction 가시성 판단에 사용할 수 있는 Row Version을 관리한다.

```text
이전 Commit Version: status = OPEN
새 미커밋 Version:   status = IN_PROGRESS
```

같은 순간에도 Transaction에 따라 보이는 Version이 다를 수 있다.

- 변경한 Transaction 자신: 새 Version을 볼 수 있음
- 다른 Transaction: 자신의 Snapshot에서 볼 수 있는 Commit Version을 봄
- 새 Version이 Commit된 뒤 시작한 명령: 새 Version을 볼 수 있음

MVCC의 중요한 효과는 일반적인 읽기와 쓰기의 충돌을 줄인다는 점이다.

```text
일반 SELECT ← 이전에 Commit된 Version을 읽음
UPDATE      ← 새 Version을 만들며 Row를 변경
```

따라서 PostgreSQL에서는 일반적으로 읽기가 쓰기를 막지 않고, 쓰기가 일반 읽기를 막지 않는다. 다만 `SELECT FOR UPDATE`처럼 읽으면서 Lock까지 요구하거나 `ACCESS EXCLUSIVE` Table Lock이 걸린 경우는 별도다.

MVCC가 Lock을 없애는 것은 아니다. PostgreSQL은 MVCC와 Lock을 함께 사용한다.

## 일반 `SELECT`와 `SELECT FOR UPDATE`

### 일반 `SELECT`

```sql
SELECT id, status
FROM tickets
WHERE id = 1;
```

현재 Snapshot에서 보이는 값을 읽는다. 같은 Row를 다른 Transaction이 변경 중이어도 보통 마지막 Commit Version을 즉시 읽는다.

### `SELECT FOR UPDATE`

```sql
SELECT id, status
FROM tickets
WHERE id = 1
FOR UPDATE;
```

값을 읽는 것에서 끝나지 않고 조회한 Row를 이후 변경할 의도로 잠근다. 다른 Transaction은 해당 Row를 충돌하는 방식으로 변경하거나 다시 잠그려 할 때 기다린다.

이미 다른 Transaction이 같은 Row를 `UPDATE`했거나 충돌하는 Lock을 보유하고 있다면 `SELECT FOR UPDATE`도 그 Transaction이 끝날 때까지 기다린다.

```text
Session A가 Row를 UPDATE하고 미완료
→ Session B가 같은 Row를 SELECT FOR UPDATE
→ Session B 대기
→ Session A가 COMMIT 또는 ROLLBACK
→ Session B가 다시 진행
```

`READ COMMITTED`에서 A가 Commit했다면 B는 갱신된 Row가 자신의 검색 조건을 여전히 만족하는지 다시 확인하고, 만족하면 그 최신 Row를 잠가 반환한다. A가 Rollback했다면 A의 변경은 사라지고 B가 원래 Row를 잠글 수 있다.

## Row Lock의 범위와 생명주기

Row Lock은 같은 Row에 대한 충돌하는 Writer 또는 Locker를 막는다. 일반 조회 자체를 막는 용도는 아니다.

대표적인 충돌 작업은 다음과 같다.

- `UPDATE`
- `DELETE`
- `SELECT FOR UPDATE`
- 그 밖의 충돌하는 Row Lock 요청

획득한 Lock은 일반적으로 Transaction이 끝날 때 해제된다.

```text
BEGIN
→ Row Lock 획득
→ 필요한 검증과 변경
→ COMMIT 또는 ROLLBACK
→ Lock 해제
```

따라서 Lock을 획득한 뒤 사용자 입력이나 외부 API Response를 오래 기다리면 다른 Transaction의 대기 시간이 길어진다. Transaction 안에는 일관성을 위해 함께 처리해야 하는 Database 작업만 최소한으로 둔다.

## Lock 대기를 제한하는 방법

학습 실험에서 명령이 무기한 기다리는 상황을 피하려면 현재 Transaction에만 `lock_timeout`을 설정할 수 있다.

```sql
BEGIN;

SET LOCAL lock_timeout = '5s';

SELECT id, status
FROM tickets
WHERE id = 1
FOR UPDATE;

COMMIT;
```

`lock_timeout`은 Lock을 얻기 위해 지정 시간보다 오래 기다린 명령을 중단한다. 이 오류가 명시적인 Transaction 안에서 발생하면 해당 Transaction은 실패 상태가 되므로 `ROLLBACK`으로 정리한다.

```sql
ROLLBACK;
```

`lock_timeout`은 동시성 문제의 근본 해결책이 아니다. 무제한 대기를 막는 운영·실험상의 안전장치다.

즉시 Lock을 얻지 못하면 기다리지 않고 실패하게 하는 `NOWAIT`도 있다.

```sql
SELECT id, status
FROM tickets
WHERE id = 1
FOR UPDATE NOWAIT;
```

대기, 제한 시간 뒤 실패, 즉시 실패 중 무엇을 선택할지는 Use Case와 Client 재시도 정책에 따라 결정한다.

## Lost Update를 줄이는 대표 전략

### 한 SQL 문장에서 원자적으로 변경

가능하다면 읽기와 변경을 분리하지 않고 현재 Database 값을 기준으로 한 SQL 문장에서 처리한다.

```sql
UPDATE ticket_metrics
SET response_count = response_count + 1
WHERE ticket_id = 1
RETURNING response_count;
```

단순 계산에는 명확하고 효율적이지만 복잡한 Domain 판단을 SQL 한 문장으로 옮기는 것이 항상 적절한 것은 아니다.

### 조건부 `UPDATE`

읽었을 때의 조건이 여전히 유지되는 경우에만 변경한다.

```sql
UPDATE tickets
SET status = 'IN_PROGRESS',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1
  AND status = 'OPEN'
RETURNING id, status;
```

다른 Transaction이 먼저 상태를 바꿨다면 영향받은 Row가 0개가 된다. Application은 이를 단순 SQL 성공이 아니라 동시 변경 충돌 또는 현재 상태 불일치로 해석해야 한다.

### Version을 이용한 낙관적 Lock

Row에 Version을 두고 읽었던 Version과 같을 때만 변경한다.

```sql
UPDATE tickets
SET status = 'IN_PROGRESS',
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1
  AND version = 3;
```

영향받은 Row가 0개라면 누군가 먼저 변경했을 가능성이 있으므로 실패 처리하거나 최신 값을 다시 읽어 재시도한다.

장점은 충돌이 드문 상황에서 긴 Lock 대기를 줄일 수 있다는 것이다. 비용은 충돌 감지, 실패 해석과 재시도 코드가 필요하다는 점이다.

### `SELECT FOR UPDATE`를 이용한 비관적 Lock

충돌 가능성이 높다고 보고 판단하기 전에 Row를 잠근다.

```sql
BEGIN;

SELECT id, status
FROM tickets
WHERE id = 1
FOR UPDATE;

-- 현재 상태를 검증한 뒤 필요한 UPDATE 수행

COMMIT;
```

장점은 Lock을 획득한 Transaction이 변경 판단을 수행하는 동안 다른 Writer의 개입을 막는다는 것이다. 비용은 대기 시간, 처리량 감소와 Deadlock 가능성이다.

## 낙관적 Lock과 비관적 Lock 비교

| 기준 | 낙관적 Lock | 비관적 Lock |
|---|---|---|
| 기본 가정 | 충돌이 드물다 | 충돌 가능성이 높다 |
| 주요 방식 | Version·기존 값 조건으로 충돌 감지 | 먼저 Row Lock 획득 |
| 충돌 시 | 변경 실패 후 재시도 또는 사용자에게 알림 | 다른 Transaction이 기다리거나 Timeout |
| 장점 | 평상시 Lock 대기가 적음 | 변경 순서를 명시적으로 직렬화하기 쉬움 |
| 비용 | 충돌 처리·재시도 설계 필요 | 대기·처리량 감소·Deadlock 가능성 |

어느 방식이 항상 우월한 것은 아니다. 실제 충돌 빈도, 응답 시간 요구, 재시도 가능성, 업무 규칙의 복잡도를 근거로 선택한다.

## Deadlock

Deadlock은 둘 이상의 Transaction이 서로 상대가 가진 Lock을 기다려 누구도 진행할 수 없는 순환 대기 상태다.

```text
Session A: Ticket 1 Lock 획득
Session B: Ticket 2 Lock 획득
Session A: Ticket 2 Lock 요청 → B를 기다림
Session B: Ticket 1 Lock 요청 → A를 기다림
```

PostgreSQL은 Deadlock을 감지하면 관련 Transaction 중 하나를 중단하여 나머지가 진행할 수 있게 한다. 어떤 Transaction이 중단될지는 Application이 의존해서는 안 된다.

Deadlock을 줄이는 가장 중요한 방법은 여러 자원을 항상 같은 순서로 잠그는 것이다.

```text
모든 Transaction이 Ticket ID 오름차순으로 Lock 획득

Ticket 1 → Ticket 2
Ticket 1 → Ticket 2
```

예를 들어 여러 Row를 먼저 잠가야 한다면 순서를 명시한다.

```sql
SELECT id, status
FROM tickets
WHERE id IN (1, 2)
ORDER BY id
FOR UPDATE;
```

추가 원칙은 다음과 같다.

- Transaction을 짧게 유지한다.
- Transaction 안에서 사용자 입력이나 외부 API를 기다리지 않는다.
- 필요한 Lock보다 과도하게 강한 Lock을 사용하지 않는다.
- Deadlock으로 중단된 Transaction 전체를 안전하게 재시도할 수 있게 설계한다.

## Isolation과 Domain 규칙의 경계

Isolation과 Lock은 동시 실행을 조정하지만 Ticket의 업무 규칙을 대신 정의하지 않는다.

예를 들어 Database가 다음 상태 값만 허용한다고 가정한다.

```text
OPEN, IN_PROGRESS, RESOLVED
```

이는 `RESOLVED`라는 값이 허용된다는 뜻이다. `OPEN → RESOLVED` 전이가 업무적으로 금지됐는지는 별도 규칙이다.

```text
Database Constraint
→ 저장 가능한 값의 집합 보호

Ticket Domain
→ 허용된 상태 전이 보호

Transaction·Isolation·Lock
→ 여러 변경과 동시 실행의 일관성 보호
```

조건부 `UPDATE`나 Lock을 사용하더라도 현재 상태 전이 규칙을 어디에서 판단할지는 Architecture와 Use Case에 맞게 유지해야 한다.

## 자주 발생하는 오해

| 오해 | 수정된 이해 |
|---|---|
| 다른 Transaction이 Row를 수정 중이면 일반 `SELECT`도 항상 기다린다. | MVCC를 이용한 일반 `SELECT`는 보통 마지막 Commit Version을 읽는다. |
| `SELECT FOR UPDATE`는 단순 조회다. | Row를 읽으면서 충돌하는 변경을 막는 Lock을 요청한다. |
| MVCC를 사용하면 Lock이 필요 없다. | MVCC와 Lock은 함께 사용되며 Writer·Locker 충돌에는 Lock이 필요하다. |
| `READ COMMITTED`에서는 Transaction 내 모든 조회가 같은 Snapshot을 본다. | 각 명령 시작 시 새 Snapshot을 사용하므로 연속 조회 결과가 달라질 수 있다. |
| Isolation Level을 높이면 실패가 사라진다. | 더 강한 Level은 동시성 이상 대신 Serialization 실패와 재시도 비용을 만들 수 있다. |
| 모든 동시 `UPDATE`는 Lost Update를 만든다. | 한 SQL에서 현재 값을 기준으로 원자적으로 변경하면 순차 적용될 수 있다. |
| `lock_timeout`이 동시성 문제를 해결한다. | 무제한 대기를 제한할 뿐 충돌 원인과 업무 처리는 별도로 설계해야 한다. |
| PostgreSQL이 Deadlock을 감지하므로 예방할 필요가 없다. | 한 Transaction은 중단되며, 일관된 Lock 순서와 짧은 Transaction이 여전히 필요하다. |

## 학습 점검 질문

1. Session과 Transaction은 어떤 관계인가?
2. Isolation, MVCC와 Lock은 각각 어떤 질문에 답하는가?
3. PostgreSQL의 기본 Isolation Level은 무엇인가?
4. `READ COMMITTED`에서 일반 `SELECT`의 Snapshot은 언제 결정되는가?
5. 한 Transaction 안의 연속된 두 `SELECT`가 서로 다른 값을 볼 수 있는 이유는 무엇인가?
6. 변경한 Session은 왜 자신의 미커밋 값을 볼 수 있는가?
7. 다른 Session의 일반 `SELECT`가 미커밋 값을 보지 않는 이유는 무엇인가?
8. 일반 `SELECT`와 `SELECT FOR UPDATE`는 같은 Row가 변경 중일 때 어떻게 다르게 행동하는가?
9. Row Lock은 보통 언제 해제되는가?
10. `lock_timeout`은 무엇을 해결하고 무엇을 해결하지 못하는가?
11. Lost Update가 발생하는 읽기-계산-쓰기 순서를 설명할 수 있는가?
12. `SET value = value + 1` 형태의 한 SQL이 단순 Lost Update를 줄이는 이유는 무엇인가?
13. 조건부 `UPDATE`에서 영향받은 Row가 0개라면 Application은 무엇을 확인해야 하는가?
14. 낙관적 Lock과 비관적 Lock은 충돌을 각각 어떻게 처리하는가?
15. Deadlock의 순환 대기는 어떻게 만들어지는가?
16. 여러 Row를 항상 같은 순서로 잠그면 Deadlock 가능성이 줄어드는 이유는 무엇인가?
17. Isolation과 Lock이 Ticket 상태 전이 규칙을 대신할 수 없는 이유는 무엇인가?

## 자료 범위

### 포함

- Session과 Transaction 구분
- Isolation의 목적과 대표 이상 현상
- PostgreSQL `READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE`의 기본 차이
- MVCC와 Snapshot
- 일반 `SELECT`, `SELECT FOR UPDATE`와 Row Lock
- Lock 대기와 `lock_timeout`
- Lost Update와 낙관적·비관적 Lock의 기본 비교
- Deadlock 조건과 일관된 Lock 순서
- Isolation·Lock과 Domain 규칙의 경계

### 포함하지 않음

- 개인 Database의 실제 Session A·B 실행 결과
- 모든 Table Lock Mode의 상세 충돌 행렬
- MVCC 내부 Tuple Header와 Vacuum 구현 세부사항
- Serializable Snapshot Isolation의 내부 Algorithm
- Advisory Lock의 상세 사용법
- 분산 Lock과 여러 Database에 걸친 Transaction
- Spring `@Transactional`과 JPA Lock Annotation 구현
- Production 부하 수치와 Lock Monitoring 운영 절차

## 참고 자료

- [PostgreSQL 17 — Concurrency Control Introduction](https://www.postgresql.org/docs/17/mvcc-intro.html)
- [PostgreSQL 17 — Transaction Isolation](https://www.postgresql.org/docs/17/transaction-iso.html)
- [PostgreSQL 17 — Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html)
- [PostgreSQL 17 — `SET TRANSACTION`](https://www.postgresql.org/docs/17/sql-set-transaction.html)
- [PostgreSQL 17 — Client Connection Defaults](https://www.postgresql.org/docs/17/runtime-config-client.html)
