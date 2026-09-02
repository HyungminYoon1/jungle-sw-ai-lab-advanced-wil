# 2026-09-02 — PostgreSQL Transaction과 Atomicity 실습

> 작성일: 2026-09-02
> 목적: 암묵적 Transaction과 명시적 Transaction Block을 구분하고, Ticket 현재 상태와 이력 저장의 정상 Commit·의도적 실패·Rollback을 실제 SQL로 확인한다.
> 상태: Completed

---

## 오늘의 질문

> Ticket의 현재 상태 변경과 상태 이력 추가 중 하나가 실패했을 때, 일부 변경만 남지 않도록 어떻게 하나의 작업 단위로 처리하는가?

## 시작 상태

- `ai_helpdesk_learning_lab` Database와 `tickets`, `ticket_status_history` Table은 9월 1일에 생성했다.
- `NOT NULL`, `CHECK`, Foreign Key의 대표 성공·실패 SQL과 `JOIN`을 재현했다.
- Transaction의 `BEGIN`, `COMMIT`, `ROLLBACK`은 개념으로만 접했으며 실제 원자성 실험은 `NOT_RUN`이었다.
- Spring Application의 PostgreSQL Driver·Migration·Adapter·Transaction Integration Test는 `NOT_IMPLEMENTED`였다.

## 핵심 개념 교정

### `BEGIN`이 없으면 Transaction도 없는가?

PostgreSQL은 개별 SQL 문장도 Transaction 안에서 실행한다. `psql`의 기본 `AUTOCOMMIT` 상태에서는 명시적인 Transaction Block 밖의 SQL이 성공하면 즉시 Commit된다.

```text
UPDATE 실행
→ 암묵적 Transaction 시작
→ UPDATE 성공
→ 자동 COMMIT
→ Transaction 종료
```

따라서 `BEGIN` 없이 성공한 `UPDATE` 뒤에 입력한 `ROLLBACK`은 이미 확정된 변경을 취소하지 못한다. `BEGIN`은 Transaction이라는 개념을 처음 만드는 명령이 아니라 여러 SQL 문장을 하나의 명시적인 Transaction Block으로 묶는 시작 경계다.

### 실패한 Transaction 상태

명시적인 Transaction 안에서 SQL 하나가 실패하면 Prompt가 `=!#`로 바뀌며 일반 `SELECT`도 실행되지 않는다. PostgreSQL은 후속 명령이 실패한 작업을 전제로 하는지 판단할 수 없으므로 Transaction을 실패 상태로 유지한다.

```text
database=*#  정상 Transaction Block
database=!#  실패한 Transaction Block
database=#   Transaction Block 밖
```

실패 상태에서는 `ROLLBACK`으로 작업 단위를 정리한 뒤 일반 SQL을 다시 실행한다. 오류 전에 Savepoint를 만들었다면 `ROLLBACK TO SAVEPOINT`로 해당 지점 이후만 취소할 수 있지만, Savepoint SQL은 오늘 직접 실행하지 않았다.

### Atomicity와 업무 규칙

Atomicity는 하나의 Transaction에 포함한 변경을 전부 반영하거나 전부 취소하는 성질이다. Transaction은 어떤 상태 전이가 업무적으로 허용되는지까지 자동으로 판단하지 않는다.

```text
Database CHECK
→ 현재 저장하려는 상태 값이 허용 목록에 있는지 확인

Ticket Domain
→ OPEN → IN_PROGRESS → RESOLVED라는 현재 업무의 상태 전이 순서 보호

Transaction
→ 현재 상태 변경과 이력 추가를 함께 확정하거나 함께 취소
```

Raw SQL로 `OPEN → RESOLVED`를 직접 변경하면 두 상태가 모두 허용 값이므로 현재 `CHECK`를 통과할 수 있다. 현재 학습 설계에서 전이 규칙의 책임은 Service가 아니라 `Ticket` Domain에 있고, Service는 Domain 행동과 저장·Transaction을 조정한다.

### Rollback의 범위

Database `ROLLBACK`은 같은 Transaction 안의 Database 변경을 취소하지만 이미 전송한 Email, 외부 API 호출, File 작성과 Java 객체의 Memory 상태까지 자동으로 되돌리지 않는다. 외부 Side Effect에는 취소 요청, 재시도나 보상 작업 같은 별도 설계가 필요하다.

Identity가 사용하는 Sequence 값도 일반 Row 변경처럼 Rollback되지 않는다. 발급된 ID의 공백만으로 Row가 삭제되거나 유실됐다고 판단할 수 없다.

## 잘못된 Database에서 확인한 실패 상태

처음에는 기본 `postgres` Database에 연결된 상태에서 실험을 시작했다.

```text
postgres=# BEGIN;
postgres=*# INSERT INTO tickets ...
```

`tickets` Table은 `ai_helpdesk_learning_lab`에 있으므로 다음 오류가 발생했다.

```text
오류: "tickets" 이름의 릴레이션(relation)이 없습니다
postgres=!#
```

같은 실패 상태에서 `SELECT`를 실행하자 Transaction을 종료하기 전까지 명령이 무시된다는 오류가 발생했다. `ROLLBACK` 뒤 Prompt는 `postgres=#`로 복귀했다. Transaction 밖에서 다시 실행한 `SELECT`는 현재 Database에 Table이 없다는 독립된 이유로 실패했지만 Prompt는 실패 상태에 머물지 않았다.

이 결과로 다음 두 경계를 확인했다.

- PostgreSQL의 Database는 분리되어 있으므로 현재 연결 대상을 먼저 확인해야 한다.
- 명시적인 Transaction의 오류는 `ROLLBACK` 전까지 해당 Transaction을 실패 상태로 유지한다.

## 올바른 Database 연결 확인

`psql` Meta-command로 학습용 Database에 연결했다.

```text
\connect ai_helpdesk_learning_lab
\conninfo
\dt
```

관찰 결과는 다음과 같다.

```text
Database: ai_helpdesk_learning_lab
User: postgres
Host: localhost
Port: 5432
Table: tickets, ticket_status_history
```

Credential 값은 명령이나 문서에 기록하지 않았다.

## Rollback 실험

### 실행

```sql
BEGIN;

INSERT INTO tickets (title)
VALUES ('Transaction rollback 실습')
RETURNING id, title, status;

SELECT id, title, status
FROM tickets
WHERE title = 'Transaction rollback 실습';

ROLLBACK;

SELECT id, title, status
FROM tickets
WHERE title = 'Transaction rollback 실습';
```

### 관찰

| 시점 | Prompt·결과 |
|---|---|
| `BEGIN` 직후 | `ai_helpdesk_learning_lab=*#` |
| `INSERT` 직후 | `id=5`, 제목 `Transaction rollback 실습`, 상태 `OPEN` |
| Transaction 내부 `SELECT` | `id=5` Row 1건 조회 |
| `ROLLBACK` 직후 | `ai_helpdesk_learning_lab=#` |
| Transaction 종료 후 `SELECT` | `0 rows` |

같은 Transaction은 자신이 아직 Commit하지 않은 변경을 조회할 수 있지만, `ROLLBACK` 뒤에는 해당 Row가 남지 않았다. 별도 두 번째 Session에서 미확정 Row가 보이지 않는지는 개념으로 설명했으며 실제 두 Session 실험은 `NOT_RUN`이다.

## 정상 Commit 실험

Ticket과 최초 상태 이력을 같은 Transaction에서 생성하고 Commit했다. 방금 발급된 Ticket ID는 같은 Session의 Sequence 값을 조회하여 이력의 Foreign Key로 사용했다.

```sql
BEGIN;

INSERT INTO tickets (title)
VALUES ('Transaction commit 실습')
RETURNING id, title, status;

INSERT INTO ticket_status_history (
    ticket_id,
    from_status,
    to_status
)
VALUES (
    currval(pg_get_serial_sequence('tickets', 'id')),
    NULL,
    'OPEN'
)
RETURNING id, ticket_id, from_status, to_status;

COMMIT;
```

Commit 뒤 `JOIN` 결과는 다음 한 Row였다.

```text
ticket_id      = 6
title          = Transaction commit 실습
current_status = OPEN
from_status    = NULL
to_status      = OPEN
```

Rollback된 Ticket의 `id=5`는 재사용되지 않았고 다음 정상 Ticket에 `id=6`이 발급됐다. `psql` 출력에서 `from_status`가 빈칸으로 보였지만 이는 `NULL` 표시이며 빈 문자열을 저장했다는 뜻이 아니다.

## 의도적 실패와 Atomicity 실험

`id=6` Ticket의 상태를 `IN_PROGRESS`로 바꾼 뒤 같은 Transaction에서 허용되지 않은 `CLOSED` 이력을 저장하도록 했다.

```sql
BEGIN;

UPDATE tickets
SET status = 'IN_PROGRESS',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 6
RETURNING id, title, status;

INSERT INTO ticket_status_history (
    ticket_id,
    from_status,
    to_status
)
VALUES (
    6,
    'OPEN',
    'CLOSED'
);
```

이력 `INSERT`는 `ticket_status_history_to_status_allowed` 위반으로 실패했다.

```text
실패한 history.id = 6
ticket_id          = 6
from_status        = OPEN
to_status          = CLOSED
Prompt             = ai_helpdesk_learning_lab=!#
```

이어 `ROLLBACK`한 뒤 `tickets`와 이력을 다시 `JOIN`했다.

```text
ticket_id      = 6
current_status = OPEN
history_id     = 5
from_status    = NULL
to_status      = OPEN
```

먼저 성공했던 `UPDATE`까지 취소되어 현재 상태는 `OPEN`으로 복구됐고, 실패한 `OPEN → CLOSED` 이력은 남지 않았다. 정상 Commit된 최초 이력 `history.id=5`만 유지됐다. 실패 과정에서 발급된 `history.id=6`은 Row로 저장되지 않았지만 Sequence 값은 회수되지 않는다. 다음 이력 ID가 실제로 `7`인지 확인하는 추가 `INSERT`는 실행하지 않았다.

## `BEGIN`이 없었다면 남았을 상태

동일한 `UPDATE`와 실패하는 이력 `INSERT`를 `BEGIN` 없이 실행하면 두 SQL은 서로 다른 암묵적 Transaction이 된다.

```text
Transaction 1
→ Ticket UPDATE 성공
→ 자동 COMMIT

Transaction 2
→ 이력 INSERT 실패
→ Transaction 2만 취소
```

이 경우 Ticket의 현재 상태는 `IN_PROGRESS`로 확정되지만 `OPEN → IN_PROGRESS` 이력은 남지 않아 두 저장 상태가 불일치한다. 두 변경을 같은 명시적 Transaction으로 묶은 이유가 여기에 있다.

## 실행 주체와 검증 경계

- 사용자 직접 실행: Database 연결 확인, Rollback 실험, 정상 Commit, 의도적 `CHECK` 실패와 최종 `JOIN`
- Codex 보조: 질문, 개념 교정, SQL 절차 제시와 실행 결과 해석
- 근거 형태: 사용자가 제공한 PostgreSQL 17.7 `psql` 출력
- Codex 독립 Database 재조회: `NOT_RUN`
- 두 번째 Session의 미확정 Row 가시성 확인: `NOT_RUN`
- Savepoint 실행: `NOT_RUN`
- Isolation·Lock·Deadlock 실험: `NOT_RUN`
- Spring Transaction Integration Test: `NOT_IMPLEMENTED`
- Java·Maven Test 재실행: `NOT_RUN`

오늘의 SQL Spike는 Database Transaction의 원자성을 확인한 근거이며 Spring Application이 PostgreSQL Transaction을 사용한다는 증거는 아니다. Application Adapter와 Integration Test는 핵심 SQL 동시성·실행 계획 학습 뒤 선택 적용 범위에서 판단한다.

## 오늘의 완료 판단

- 완료: 암묵적 Transaction과 명시적인 Transaction Block 구분
- 완료: `psql` 자동 Commit과 이미 Commit된 변경의 Rollback 불가 설명
- 완료: 실패한 Transaction Prompt와 `ROLLBACK` 복구 재현
- 완료: 같은 Transaction 안에서 미확정 Row 조회 후 전체 Rollback 재현
- 완료: Ticket과 최초 상태 이력의 정상 Commit 확인
- 완료: 상태 변경 뒤 이력 저장 실패 시 두 변경이 함께 취소되는 Atomicity 확인
- 완료: Transaction과 Domain 규칙, Database 밖 Side Effect의 책임 구분
- 완료: Rollback된 Row와 Sequence 번호 공백 구분
- 개념 확인·미실행: Savepoint와 다른 Session에서의 미확정 변경 비가시성
- 미수행: Isolation·Lock·Deadlock, Spring PostgreSQL 연동과 Integration Test

9월 2일 종료 조건인 “일부 변경만 남지 않는 이유와 검증 결과를 설명할 수 있는가?”를 실제 SQL로 확인했으므로 일일 상태는 `Completed`다.

## 다음 학습

- 두 개의 `psql` Session을 구분하여 같은 Ticket을 조회·수정한다.
- 각 Session의 `BEGIN`·SQL·`COMMIT` 순서와 보이는 값을 빠짐없이 기록한다.
- PostgreSQL 기본 Isolation Level에서 미확정 변경의 가시성과 Lock 대기를 관찰한다.
- Lost Update와 Deadlock은 실행 순서를 먼저 예측한 뒤 최소 사례로 재현한다.
- Spring PostgreSQL Adapter와 Transaction Integration Test는 핵심 SQL 실험 뒤 선택 범위를 다시 판단한다.
