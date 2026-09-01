# 2026-09-01 — PostgreSQL Schema·Constraint와 정규화 실습

> 작성일: 2026-09-01
> 목적: 학습용 Database를 만들고 Ticket Schema의 Key·Constraint·관계와 1~3NF 분리 이유를 실제 SQL로 확인한다.
> 상태: Completed

---

## 오늘의 질문

> 잘못된 Row를 Application보다 안쪽의 Database에서도 어떻게 거부하며, Ticket 현재 상태와 상태 이력을 왜 별도 관계로 분리하는가?

## 시작 상태

- PostgreSQL 17.7 Server와 기본 `postgres` Database 인증 접속은 8월 31일에 확인했다.
- Catalog 조회 결과 `ai_helpdesk_learning_lab` Database는 0건이었다.
- Schema·Table·Constraint SQL은 실행하지 않은 상태였다.
- Spring Application의 PostgreSQL Driver·Migration·Adapter·Integration Test는 구현하지 않았다.

## 학습용 Database 생성과 접속

기본 `postgres` Database에서 다음 SQL을 실행했다.

```sql
CREATE DATABASE ai_helpdesk_learning_lab;
```

`CREATE DATABASE` 성공 후 `psql` Meta-command로 연결을 바꿨다.

```text
\connect ai_helpdesk_learning_lab
\conninfo
```

`\conninfo`에서 `postgres` 사용자로 `localhost:5432`의 `ai_helpdesk_learning_lab` Database에 연결된 상태를 확인했다. Credential 값은 Command나 문서에 기록하지 않았다.

PowerShell에서 사용할 `psql -U ...` 명령을 이미 `psql`에 들어온 상태에서 입력하면 SQL로 해석되어 구문 오류가 발생한다. `PS C:\...>`에서는 Shell 명령, `database=#`에서는 SQL이나 Backslash Meta-command를 입력해야 한다. 미완성 Query Buffer는 `\r`로 초기화할 수 있다.

## `tickets` Table

[PostgreSQL SQL 기초 문법](../study-docs/learning-postgresql-sql-basics.md)의 DDL을 바탕으로 다음 구조를 생성했다.

| Column | 핵심 정의 |
|---|---|
| `id` | `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY` |
| `title` | `TEXT NOT NULL`과 공백 방지 `CHECK` |
| `status` | `TEXT NOT NULL DEFAULT 'OPEN'`과 허용 상태 `CHECK` |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

`\d tickets`에서 Identity, Primary Key, 두 `CHECK`, `NOT NULL`과 기본값이 실제 Table에 적용된 것을 확인했다.

### 성공·실패 입력

실행 전에 결과를 예측하고 각 SQL의 실제 결과와 저장 상태를 따로 확인했다.

| 순서 | 입력·변경 | 예상·관찰 결과 | 저장 상태 |
|---:|---|---|---|
| 1 | 제목 `로그인 오류`, 나머지 생략 | 성공, `id=1`, `status=OPEN`, 생성·수정 시각 동일 | Row 1건 저장 |
| 2 | `title=NULL` | `NOT NULL` 위반, 실패 Row에 `id=2` 발급 | 기존 Row만 유지 |
| 3 | `title='   '` | `tickets_title_not_blank` 위반, `id=3` 발급 | 기존 Row만 유지 |
| 4 | `status='CLOSED'` | `tickets_status_allowed` 위반, `id=4` 발급 | 기존 Row만 유지 |

다음 정상 입력에서 생략한 값을 `RETURNING`으로 확인했다.

```sql
INSERT INTO tickets (title)
VALUES ('로그인 오류')
RETURNING id, title, status, created_at, updated_at;
```

관찰한 핵심 값은 다음과 같다.

```text
id         = 1
status     = OPEN
created_at = 2026-09-01 16:42:06.328171+09
updated_at = 2026-09-01 16:42:06.328171+09
```

Constraint 실패 Row는 저장되지 않았지만 발급된 Identity 값은 Sequence에 반환되지 않아 재사용되지 않았다. Identity가 사용하는 Sequence는 저장 Row 수나 빈틈없는 번호를 보장하지 않는다.

### 현재 값 Constraint와 상태 전이 규칙

`id=1` Ticket을 다음 SQL로 `OPEN`에서 `RESOLVED`로 직접 바꿨다.

```sql
UPDATE tickets
SET status = 'RESOLVED',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1
RETURNING id, title, status, created_at, updated_at;
```

`RESOLVED`는 허용 목록에 있는 현재 값이므로 Database `CHECK`는 변경을 허용했다. `created_at`은 유지되고 `updated_at`만 `2026-09-01 17:24:31.105317+09`로 바뀌었다.

이 결과는 다음 책임 차이를 보여준다.

```text
Database CHECK
→ 현재 저장하려는 상태 값이 허용 목록에 있는지 확인

Ticket Domain
→ OPEN → IN_PROGRESS → RESOLVED라는 현재 업무의 전이 순서 보호
```

`OPEN → RESOLVED`는 Domain 규칙을 일부러 우회한 SQL Spike 결과이며 정상 업무 흐름으로 해석하지 않는다.

## `ticket_status_history` Table

Ticket 현재 상태와 변화 이력을 분리하여 다음 구조를 생성했다.

| Column | 핵심 정의 |
|---|---|
| `id` | 이력 Row의 Identity Primary Key |
| `ticket_id` | `NOT NULL`, `tickets(id)` Foreign Key |
| `from_status` | 생성 사건의 `NULL → OPEN`을 위해 Nullable, 값이 있으면 허용 상태 `CHECK` |
| `to_status` | `NOT NULL`, 허용 상태 `CHECK` |
| `changed_at` | `TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP` |

사용한 named Constraint는 다음과 같다.

- `fk_ticket_status_history_ticket`
- `ticket_status_history_from_status_allowed`
- `ticket_status_history_to_status_allowed`

`\d ticket_status_history`에서 Primary Key, 두 상태 `CHECK`와 `tickets(id)` Foreign Key가 적용된 것을 확인했다.

### Foreign Key와 Identity

존재하지 않는 `ticket_id=999` 이력을 저장하자 `fk_ticket_status_history_ticket` 위반으로 거부됐고 이력 Table은 0건을 유지했다. 실패 과정에서 이력 Identity 값 `1`은 소비됐다.

이후 실제 `tickets.id=1`을 참조하는 생성 이력과 상태 변경 이력을 저장했다.

```text
history.id = 2, ticket_id = 1, NULL → OPEN
history.id = 3, ticket_id = 1, OPEN → RESOLVED
```

`history.id`는 이력 Row 자체의 식별자이고, `ticket_id`는 부모 Ticket의 식별자다. 두 Table의 Identity와 Foreign Key 값은 역할이 다르다.

`to_status=CLOSED` 이력은 `ticket_status_history_to_status_allowed` 위반으로 거부됐다. 실패 이력에 Identity 값 `4`가 발급됐지만 기존 정상 이력 두 건은 그대로 유지됐다.

### `JOIN` 결과

`tickets`와 `ticket_status_history`를 `ticket_id`로 연결하여 시간순으로 조회했다.

```sql
SELECT
    t.id AS ticket_id,
    t.title,
    t.status AS current_status,
    h.id AS history_id,
    h.from_status,
    h.to_status,
    h.changed_at
FROM tickets AS t
INNER JOIN ticket_status_history AS h
    ON h.ticket_id = t.id
WHERE t.id = 1
ORDER BY h.changed_at, h.id;
```

결과는 생성과 상태 변경 이력 두 Row였다.

```text
history.id=2: NULL → OPEN
history.id=3: OPEN → RESOLVED
```

JOIN 결과에서 `title`과 현재 `status`가 이력마다 반복되어 보이지만 실제 `tickets` Row에는 한 번만 저장돼 있다. Query 결과의 반복과 저장 구조의 중복은 구분해야 한다. 이 JOIN이 보여주는 제목은 이력 당시 제목이 아니라 조회 시점의 현재 제목이다.

## 정규화 이해

### 1NF

`OPEN,IN_PROGRESS,RESOLVED`를 한 문자열 Column에 넣으면 각 상태를 독립적으로 조회·검증·수정하기 어렵다. 상태 이력을 Row로 나누어 한 값과 한 사건을 명시적으로 표현했다.

### 2NF

비정규 이력의 Key가 `(ticket_id, changed_at)`인데 `title`을 함께 저장하면 `title`은 전체 Key가 아니라 `ticket_id`에만 의존한다.

```text
ticket_id → title
(ticket_id, changed_at) → 상태 이력
```

상태 이력마다 제목이 반복되므로 갱신 이상이 발생할 수 있다. `title`은 `tickets`에 한 번 저장하고 이력은 `ticket_id`로 참조한다.

### 3NF

다음 비정규 관계를 개념으로 비교했다.

```text
ticket_id → requester_id
requester_id → requester_email
```

`requester_email`은 `ticket_id`가 아니라 `requester_id`에 직접 의존한다. 여러 Ticket에 이메일을 반복 저장하면 요청자 이메일 변경 시 모든 Ticket Row를 수정해야 한다. 실제 `requesters` Table은 오늘 만들지 않았으며, 이는 이행적 함수 종속을 이해하기 위한 예시다.

비정규 Table 자체를 실제로 생성하여 동일 변경의 전후 결과를 비교하지는 않았다. 따라서 정규화 Lab 전체는 `Partially Completed`로 유지한다.

## 실행 주체와 검증 경계

- 사용자 직접 실행: Database 생성·접속, DDL, DML, `\d`, Constraint 실패와 JOIN Query
- Codex 보조: 실행 전 질문, 결과 예측, 오류 원인 설명과 문서 정리
- 근거 형태: 사용자가 제공한 실제 `psql` 출력
- Codex 독립 재조회: `NOT_RUN`
- 비정규 Table 실제 비교: `NOT_RUN`
- Transaction·Rollback·동시 Session: `NOT_RUN`
- Spring Application PostgreSQL 연동: `NOT_IMPLEMENTED`

## 오늘의 완료 판단

- 완료: 학습용 Database 생성과 연결 대상 확인
- 완료: `tickets`·`ticket_status_history` DDL과 구조 확인
- 완료: `NOT NULL`·`CHECK`·Foreign Key 성공·실패 재현
- 완료: Identity Sequence 공백과 두 ID 역할 설명
- 완료: `JOIN`과 1~3NF 분리 이유 설명
- 부분 완료: 정규화 개념과 정규화 Schema는 확인했지만 비정규 Table 실제 비교는 미수행
- 미수행: Transaction 원자성, Isolation·Lock, Application 영속화

9월 1일의 종료 조건인 “잘못된 Row가 Application이 아니라 Database Constraint에서도 거부되는가?”를 실제 SQL로 확인했으므로 일일 상태는 `Completed`다.

## 다음 학습

- `BEGIN`·`COMMIT`·`ROLLBACK`으로 현재 상태 수정과 이력 저장을 하나의 완료 단위로 묶는다.
- 두 번째 SQL을 의도적으로 실패시켜 첫 번째 변경까지 취소되는지 확인한다.
- Transaction 실패와 Sequence 값의 Rollback 여부를 구분한다.
- 비정규 Table 실제 비교가 핵심 이해에 필요하면 작은 별도 SQL Spike로 보완한다.
- Spring Driver·JPA 적용은 핵심 SQL 실험을 설명할 수 있게 된 뒤 판단한다.
