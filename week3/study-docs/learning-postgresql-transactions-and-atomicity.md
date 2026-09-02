# Learning Note — PostgreSQL Transaction과 Atomicity

> 작성일: 2026-09-02
> 기준: PostgreSQL 17 공식 문서

## 핵심 질문

> PostgreSQL은 개별 SQL 문장과 여러 SQL 문장을 어떤 Transaction 경계에서 실행하며, `COMMIT`과 `ROLLBACK`은 무엇을 확정하거나 취소하는가?

## 학습 목표

이 자료를 학습한 뒤 다음 내용을 자신의 말로 설명하는 것이 목표다.

- `BEGIN`이 없어도 개별 SQL 문장이 Transaction 안에서 실행되는 이유를 설명한다.
- 암묵적 Transaction과 명시적인 Transaction Block을 구분한다.
- `psql`의 기본 자동 Commit 동작을 설명한다.
- `BEGIN`, `COMMIT`과 `ROLLBACK`의 실행 흐름을 설명한다.
- 명시적인 Transaction 안에서 오류가 발생한 뒤 `ROLLBACK`이 필요한 이유를 설명한다.
- Atomicity가 보장하는 범위와 보장하지 않는 범위를 구분한다.
- Ticket의 현재 상태 변경과 상태 이력 추가를 하나의 Transaction으로 묶는 이유를 설명한다.
- Transaction을 취소해도 Sequence 번호가 되돌아가지 않을 수 있는 이유를 설명한다.

개인의 이해 상태와 실제 실행 결과는 날짜별 Study Note 또는 Lab Report에 기록한다. 이 문서는 특정 날짜의 진도와 독립적으로 다시 읽을 수 있는 개념 자료다.

## 한 문장 설명

Transaction은 여러 Database 변경을 모두 반영하거나 모두 취소하는 하나의 작업 단위이며, PostgreSQL에서는 개별 SQL 문장도 Transaction 안에서 실행된다.

## `BEGIN`이 없으면 Transaction도 없는가?

아니다. PostgreSQL은 모든 SQL 문장을 Transaction 안에서 실행한다.

명시적인 `BEGIN`을 입력하지 않았다면 PostgreSQL은 개별 SQL 문장을 하나의 Transaction처럼 처리한다. 문장이 성공하면 Commit하고 실패하면 그 문장의 변경을 반영하지 않는다.

```text
UPDATE 입력
→ 암묵적 Transaction 시작
→ UPDATE 성공
→ COMMIT
```

여기서 `BEGIN`은 Transaction이라는 개념을 처음 만들어 내는 명령이 아니다. 여러 SQL 문장을 하나의 명시적인 **Transaction Block**으로 묶기 위한 시작 경계다.

```text
BEGIN
→ 첫 번째 SQL
→ 두 번째 SQL
→ COMMIT 또는 ROLLBACK
```

| 구분 | 경계 | 완료 방식 | 용도 |
|---|---|---|---|
| 개별 SQL의 암묵적 Transaction | SQL 문장 하나 | 성공하면 자동 Commit | 서로 독립적인 한 문장 실행 |
| 명시적인 Transaction Block | `BEGIN`부터 `COMMIT` 또는 `ROLLBACK`까지 | 사용자가 완료 명령 입력 | 여러 문장을 하나의 작업 단위로 처리 |

## `psql`의 자동 Commit

`psql`의 `AUTOCOMMIT`은 기본적으로 `on`이다. 이 상태에서는 명시적인 Transaction Block 밖에서 성공한 SQL 문장이 즉시 Commit된다.

```sql
UPDATE tickets
SET status = 'IN_PROGRESS'
WHERE id = 7;
```

위 명령이 성공했다면 다음과 같은 흐름이 이미 끝난 것이다.

```text
암묵적 BEGIN
→ UPDATE
→ 자동 COMMIT
```

그 뒤에 `ROLLBACK`을 입력해도 방금 변경을 취소할 수 없다. 되돌릴 활성 Transaction이 이미 끝났기 때문이다.

```sql
ROLLBACK;
```

이때 `psql`은 진행 중인 Transaction이 없다는 Warning을 표시할 수 있다.

현재 `psql`의 자동 Commit 설정은 다음 Meta-command로 확인할 수 있다.

```text
\echo :AUTOCOMMIT
```

자동 Commit을 끄는 설정도 존재하지만, Transaction 경계를 학습할 때는 기본값을 임의로 바꾸기보다 `BEGIN`, `COMMIT`과 `ROLLBACK`을 명시하여 의도를 드러내는 편이 이해하기 쉽다. 다른 Client나 Framework는 Transaction 경계를 자동으로 제어할 수 있으므로 사용하는 도구의 동작도 별도로 확인해야 한다.

## `BEGIN`, `COMMIT`과 `ROLLBACK`

### `BEGIN` — 명시적인 작업 단위 시작

```sql
BEGIN;
```

이후의 SQL 변경은 `COMMIT`하기 전까지 확정되지 않는다.

### `COMMIT` — 작업 단위 확정

```sql
COMMIT;
```

Transaction 안에서 수행한 변경을 하나의 단위로 확정한다. 성공한 `COMMIT`이 끝난 뒤에는 같은 Session에서 나중에 입력한 `ROLLBACK`으로 해당 변경을 취소할 수 없다.

### `ROLLBACK` — 현재 작업 단위 취소

```sql
ROLLBACK;
```

현재 명시적인 Transaction Block에서 수행한 Database 변경을 취소하고 Transaction을 끝낸다.

```sql
BEGIN;

UPDATE tickets
SET status = 'IN_PROGRESS',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 7;

ROLLBACK;
```

위 `UPDATE`는 `ROLLBACK` 전에 같은 Transaction 안에서는 보이지만 최종적으로 Database에 확정되지 않는다.

## `psql` Prompt로 보는 Transaction 상태

기본 `psql` Prompt에는 Transaction 상태가 표시된다. Superuser로 접속한 예시는 다음과 같다.

| Prompt 예시 | 상태 |
|---|---|
| `database=#` | 명시적인 Transaction Block 밖 |
| `database=*#` | Transaction Block 안 |
| `database=!#` | 오류로 실패한 Transaction Block 안 |

일반 User의 Prompt는 마지막 문자가 `#` 대신 `>`일 수 있다. 중요한 부분은 Database 이름 뒤의 `=`, `=*`, `=!` 표시다.

```text
database=# BEGIN;
BEGIN
database=*#
```

```text
database=*# ROLLBACK;
ROLLBACK
database=#
```

## Transaction 안에서 SQL이 실패한 경우

명시적인 Transaction Block 안에서 SQL 하나가 실패하면 PostgreSQL은 해당 Transaction을 실패 상태로 둔다.

```sql
BEGIN;

INSERT INTO tickets (
    title,
    status
)
VALUES (
    '결제 오류',
    'CLOSED'
);
```

`status`에 `CLOSED`를 허용하지 않는 Constraint가 있다면 `INSERT`가 실패하고 Prompt가 다음과 같이 바뀔 수 있다.

```text
database=!#
```

이 상태에서는 일반 SQL을 계속 실행하는 것이 아니라 실패한 Transaction을 끝내야 한다.

```sql
ROLLBACK;
```

```text
오류 발생
→ Transaction 실패 상태
→ ROLLBACK
→ Transaction Block 밖으로 복귀
```

예외를 Java에서 `catch`했다고 Database Transaction이 자동으로 Commit 또는 Rollback된다고 단정할 수 없다. Application에서는 Spring Transaction 정책처럼 실제 Transaction 경계를 관리하는 구성과 예외 전파 방식을 함께 확인해야 한다.

## Atomicity — 모두 반영하거나 모두 취소

Atomicity는 하나의 Transaction에 포함된 변경을 부분적으로만 확정하지 않는 성질이다.

Ticket 상태를 바꾸면서 상태 이력도 반드시 남겨야 한다고 가정한다.

```sql
BEGIN;

UPDATE tickets
SET status = 'IN_PROGRESS',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 7;

INSERT INTO ticket_status_history (
    ticket_id,
    from_status,
    to_status
)
VALUES (
    7,
    'OPEN',
    'IN_PROGRESS'
);

COMMIT;
```

두 SQL을 별도로 Commit하면 다음과 같은 중간 실패가 생길 수 있다.

```text
tickets.status 변경 성공 및 Commit
→ 이력 INSERT 실패
→ 현재 상태는 바뀌었지만 이력은 없음
```

두 변경을 같은 Transaction으로 묶으면 이력 추가가 실패했을 때 상태 변경도 함께 취소할 수 있다.

```text
상태 UPDATE 성공
→ 이력 INSERT 실패
→ ROLLBACK
→ 두 변경 모두 미반영
```

## ACID에서 Atomicity의 위치

Transaction의 대표 성질을 ACID라고 부른다.

| 성질 | 핵심 질문 | 이 문서에서의 범위 |
|---|---|---|
| Atomicity | 작업이 전부 반영되거나 전부 취소되는가? | 핵심 학습 대상 |
| Consistency | 완료된 데이터가 정의된 규칙을 만족하는가? | Constraint와 Domain 규칙의 경계를 구분 |
| Isolation | 동시에 실행되는 Transaction이 서로에게 어떻게 보이는가? | 개념만 구분하고 상세 제외 |
| Durability | Commit된 결과가 장애 후에도 유지되는가? | 개념만 구분하고 상세 제외 |

Transaction을 사용했다는 사실만으로 데이터가 업무적으로 올바르다는 뜻은 아니다. Database는 선언된 Constraint를 검사할 수 있지만, 선언하지 않은 업무 규칙까지 추측하지 않는다.

예를 들어 현재 상태가 `OPEN`인 Ticket을 바로 `RESOLVED`로 바꾸는 SQL은 새 값 자체가 허용 목록에 있으므로 단순 `CHECK`를 통과할 수 있다. 현재 학습 설계에서는 상태 전이 규칙을 Ticket Domain이 보호한다.

## Transaction이 보장하지 않는 것

### 업무 규칙을 자동으로 판단하지 않는다

Transaction은 여러 변경의 완료 경계를 제공한다. 어떤 상태 전이가 허용되는지, 어떤 User에게 권한이 있는지까지 자동으로 판단하지 않는다.

### 영향받은 Row 수를 자동으로 업무 성공으로 해석하지 않는다

다음 `UPDATE`가 문법적으로 성공하더라도 조건에 맞는 Row가 없으면 `UPDATE 0`일 수 있다.

```sql
UPDATE tickets
SET status = 'IN_PROGRESS'
WHERE id = 999;
```

이는 SQL 오류가 아니므로 Transaction이 자동으로 실패하지 않는다. Application은 영향받은 Row 수와 조회 결과를 업무 의미에 맞게 해석해야 한다.

### Database 밖의 작업을 되돌리지 않는다

Database `ROLLBACK`은 일반적으로 다음 작업을 자동으로 취소하지 않는다.

- 이미 전송한 Email
- 외부 API 호출
- File System에 쓴 File
- Client에게 이미 보낸 HTTP Response
- Java 객체의 Memory 상태 변경

Database 변경과 외부 작업을 함께 다룰 때는 단순한 `ROLLBACK` 외에 별도의 일관성 설계가 필요하다.

### 이미 Commit된 변경을 취소하지 않는다

`COMMIT`이 성공한 Transaction과 자동 Commit이 끝난 개별 SQL은 나중에 입력한 `ROLLBACK`의 대상이 아니다. 이를 되돌리려면 원래 값을 복원하는 새로운 SQL과 별도의 Transaction이 필요하다.

## `ROLLBACK`과 Sequence 번호

Identity Column이 사용하는 Sequence 값은 일반 Row 변경과 다르게 동작한다. Transaction이 취소되더라도 이미 발급된 Sequence 번호는 재사용을 위해 되돌아가지 않는다.

```text
BEGIN
→ INSERT 과정에서 ID 5 발급
→ ROLLBACK
→ Row는 저장되지 않음
→ 다음 ID가 6일 수 있음
```

따라서 ID가 연속되지 않는다는 사실만으로 Row가 삭제됐거나 데이터가 유실됐다고 판단하면 안 된다. Primary Key의 목적은 Row를 고유하게 식별하는 것이며 빈틈없는 번호를 보장하는 것이 아니다.

## Savepoint — 일부 작업만 되돌리는 지점

Savepoint는 하나의 Transaction Block 안에서 중간 복구 지점을 만든다.

```sql
BEGIN;

UPDATE tickets
SET status = 'IN_PROGRESS'
WHERE id = 7;

SAVEPOINT before_history;

INSERT INTO ticket_status_history (
    ticket_id,
    from_status,
    to_status
)
VALUES (
    7,
    'OPEN',
    'CLOSED'
);

ROLLBACK TO SAVEPOINT before_history;

ROLLBACK;
```

`ROLLBACK TO SAVEPOINT`는 Savepoint 이후 변경만 취소하고 Transaction 자체는 유지한다. 반면 `ROLLBACK`은 Transaction 전체를 취소하고 끝낸다.

Savepoint는 부분 복구가 실제 요구사항일 때 사용하는 도구다. 모든 작업이 함께 성공해야 하는 단순한 Use Case에서는 전체 `ROLLBACK`이 의도를 더 분명하게 표현할 수 있다.

## 안전하게 Transaction을 확인하는 순서

학습 실험에서는 변경 전과 종료 후의 상태를 각각 확인해야 한다.

```sql
SELECT id, status, updated_at
FROM tickets
WHERE id = 7;
```

```sql
BEGIN;

UPDATE tickets
SET status = 'IN_PROGRESS',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 7
RETURNING id, status, updated_at;

ROLLBACK;
```

```sql
SELECT id, status, updated_at
FROM tickets
WHERE id = 7;
```

검증해야 할 내용은 서로 다르다.

- `UPDATE`가 의도한 Row를 변경했는가?
- `ROLLBACK`이 Transaction 안의 변경을 취소했는가?
- 종료 후 저장 상태가 실행 전 상태와 같은가?

`ROLLBACK`이라는 문장이 성공했다는 사실만으로 원하는 Row가 복구됐다고 단정하지 않고, 종료 후 `SELECT`로 실제 상태를 확인한다.

## 자주 발생하는 오해

| 오해 | 수정된 이해 |
|---|---|
| `BEGIN`이 없으면 Transaction도 없다. | 개별 SQL도 Transaction 안에서 실행되며, `BEGIN`은 여러 문장의 명시적인 Transaction Block을 시작한다. |
| 성공한 `UPDATE` 뒤에 `ROLLBACK`을 입력하면 언제든 되돌릴 수 있다. | 자동 Commit 또는 명시적 `COMMIT`이 끝난 변경은 나중의 `ROLLBACK`으로 취소할 수 없다. |
| Transaction 안에서 한 SQL이 실패해도 다음 SQL을 계속 실행하면 된다. | 실패 상태를 정리하기 위해 전체 `ROLLBACK` 또는 사전에 정의한 Savepoint로의 복구가 필요하다. |
| Transaction이면 모든 데이터가 업무적으로 올바르다. | Transaction은 작업 경계를 제공하며 Domain 규칙과 권한 검사는 별도로 필요하다. |
| `UPDATE 0`은 SQL 오류다. | 문장은 성공했지만 조건에 맞는 Row가 없을 수 있으므로 Application이 결과를 해석해야 한다. |
| `ROLLBACK`하면 발급된 Identity 번호도 돌아온다. | Sequence 값은 일반적으로 회수되지 않으므로 번호에 공백이 생길 수 있다. |
| Database `ROLLBACK`은 외부 API나 Email도 취소한다. | Database 밖의 Side Effect는 별도 일관성 설계가 필요하다. |

## 학습 점검 질문

1. PostgreSQL에서 `BEGIN`을 입력하지 않은 `UPDATE`도 Transaction 안에서 실행되는 이유는 무엇인가?
2. `psql`의 기본 `AUTOCOMMIT` 상태에서 성공한 `UPDATE`를 나중의 `ROLLBACK`으로 취소할 수 없는 이유는 무엇인가?
3. 암묵적 Transaction과 명시적인 Transaction Block의 경계는 어떻게 다른가?
4. `COMMIT`과 `ROLLBACK`은 각각 현재 Transaction을 어떻게 끝내는가?
5. `database=*#`와 `database=!#` Prompt는 각각 어떤 상태를 나타내는가?
6. 명시적인 Transaction 안에서 Constraint 위반이 발생한 뒤 왜 `ROLLBACK`이 필요한가?
7. Ticket 상태 변경과 상태 이력 추가를 같은 Transaction으로 묶어야 하는 이유는 무엇인가?
8. Atomicity와 업무 규칙 검증은 왜 같은 개념이 아닌가?
9. `UPDATE 0`이 자동으로 Transaction 실패가 아닌 이유는 무엇인가?
10. `ROLLBACK` 이후에도 Identity 번호에 공백이 생길 수 있는 이유는 무엇인가?
11. Database `ROLLBACK`으로 되돌릴 수 없는 외부 작업에는 무엇이 있는가?
12. `ROLLBACK TO SAVEPOINT`와 전체 `ROLLBACK`은 어떻게 다른가?

## 자료 범위

### 포함

- PostgreSQL의 암묵적 Transaction
- 명시적인 Transaction Block
- `psql`의 기본 자동 Commit
- `BEGIN`, `COMMIT`, `ROLLBACK`
- 실패한 Transaction 상태
- Atomicity와 Ticket 상태·이력 예시
- Sequence와 Rollback의 경계
- Savepoint의 기본 개념

### 포함하지 않음

- Isolation Level별 상세 동작
- MVCC Snapshot
- Row Lock, Table Lock과 Deadlock
- Spring `@Transactional`의 전파 속성
- 분산 Transaction, Outbox와 Saga 구현
- Production 장애 복구 절차
- 개인 Database의 실제 실행 결과

## 참고 자료

- [PostgreSQL 17 — Transactions](https://www.postgresql.org/docs/17/tutorial-transactions.html)
- [PostgreSQL 17 — BEGIN](https://www.postgresql.org/docs/17/sql-begin.html)
- [PostgreSQL 17 — COMMIT](https://www.postgresql.org/docs/17/sql-commit.html)
- [PostgreSQL 17 — ROLLBACK](https://www.postgresql.org/docs/17/sql-rollback.html)
- [PostgreSQL 17 — SAVEPOINT](https://www.postgresql.org/docs/17/sql-savepoint.html)
- [PostgreSQL 17 — psql `AUTOCOMMIT`](https://www.postgresql.org/docs/17/app-psql.html#APP-PSQL-VARIABLES)
- [PostgreSQL 17 — Sequence Manipulation Functions](https://www.postgresql.org/docs/17/functions-sequence.html)
