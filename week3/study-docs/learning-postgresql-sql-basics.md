# Learning Note — PostgreSQL SQL 기초 문법

> 작성일: 2026-08-31
> 기준: PostgreSQL 17 공식 문서

## 핵심 질문

> SQL 문장은 어떤 요소로 구성되며, PostgreSQL에서 Table 구조·데이터·조회 결과와 Transaction을 어떻게 표현하는가?

## 학습 목표

이 자료를 학습한 뒤 다음 내용을 자신의 말로 설명하는 것이 목표다.

- SQL의 Keyword, Identifier, Literal, Operator와 Clause를 구분한다.
- 문자열 Literal의 작은따옴표와 Identifier의 큰따옴표를 구분한다.
- Table을 정의하는 문법과 데이터를 생성·조회·수정·삭제하는 문법을 구분한다.
- `NULL`, 빈 문자열과 공백 문자열의 차이를 설명한다.
- `NOT NULL`, `CHECK`, `UNIQUE`, `PRIMARY KEY`와 `FOREIGN KEY`의 보호 범위를 설명한다.
- `WHERE` 없는 `UPDATE`·`DELETE`의 위험을 설명한다.
- `BEGIN`, `COMMIT`과 `ROLLBACK`이 여러 SQL 문장을 하나의 작업 단위로 묶는 방식을 설명한다.
- SQL 문장과 `psql`의 Backslash Meta-command를 구분한다.

개인의 이해 상태와 실제 실행 결과는 날짜별 Study Note 또는 Lab Report에 기록한다. 이 문서는 특정 날짜의 진도와 독립적으로 다시 읽을 수 있는 개념 자료다.

## 권장 읽기 순서

이 문서를 처음부터 한 번에 암기할 필요는 없다. 다음 네 Block으로 나누어 읽는다.

1. SQL 문장의 기본 구성과 따옴표
2. Table·Constraint와 `NULL`
3. `INSERT`·`SELECT`·`UPDATE`·`DELETE`
4. `JOIN`·Transaction과 `psql`

첫 학습에서는 1~2번 Block을 설명할 수 있는 정도면 충분하다. 나머지는 실제 SQL 실험 직전에 다시 읽는다.

## 한 문장 설명

SQL은 Database에 저장할 구조와 규칙을 정의하고, 필요한 Row를 생성·조회·변경·삭제하며, 여러 변경을 하나의 Transaction으로 제어하기 위한 선언적 언어다.

## SQL 문장의 기본 구성

PostgreSQL은 SQL 입력을 Keyword, Identifier, Literal, Operator와 특수 기호 같은 Token의 연속으로 해석한다. 일반적인 SQL 명령은 세미콜론(`;`)으로 끝난다.

```sql
SELECT title
FROM tickets
WHERE status = 'OPEN';
```

위 문장은 다음 요소로 나눌 수 있다.

| 요소 | 예시 | 역할 |
|---|---|---|
| Keyword | `SELECT`, `FROM`, `WHERE` | SQL에서 미리 정한 의미를 가짐 |
| Identifier | `tickets`, `title`, `status` | Table·Column 같은 Database 객체 이름 |
| Literal | `'OPEN'` | SQL 문장에 직접 작성한 값 |
| Operator | `=` | 두 값을 비교하거나 계산 |
| Clause | `WHERE status = 'OPEN'` | 명령 안에서 특정 역할을 하는 절 |
| Terminator | `;` | 하나의 SQL 명령이 끝났음을 표시 |

SQL Keyword는 대소문자를 구분하지 않지만, Keyword는 대문자, 직접 정한 이름은 소문자 `snake_case`로 쓰면 읽기 쉽다.

```sql
SELECT created_at
FROM ticket_status_history;
```

### Identifier와 Literal의 따옴표

작은따옴표(`'`)는 문자열 값을 나타낸다.

```sql
SELECT *
FROM tickets
WHERE status = 'OPEN';
```

큰따옴표(`"`)는 Identifier를 감싼다.

```sql
SELECT "status"
FROM "tickets";
```

PostgreSQL의 따옴표 없는 Identifier는 소문자로 변환된다. 반면 큰따옴표로 만든 Identifier는 대소문자를 구분하므로 이후에도 같은 표기를 계속 사용해야 한다.

```sql
CREATE TABLE "Tickets" (
    "Title" TEXT
);
```

위처럼 이름을 만들면 매번 `"Tickets"`, `"Title"`이라고 써야 한다. 특별한 이유가 없다면 따옴표 없는 소문자 `snake_case` 이름이 단순하다.

### 주석

한 줄 주석은 `--`, 여러 줄 주석은 `/* ... */`로 작성한다.

```sql
-- OPEN 상태 Ticket 조회
SELECT *
FROM tickets;

/*
 * 여러 줄 설명
 */
```

## SQL 명령을 목적에 따라 구분

다음 구분은 문법을 학습하기 위한 편의상 분류다. 각각이 별도의 실행 환경을 뜻하지는 않는다.

| 목적 | 대표 명령 | 설명 |
|---|---|---|
| 구조 정의 | `CREATE`, `ALTER`, `DROP` | Table·Column·Constraint 같은 구조를 정의하거나 변경 |
| 데이터 변경 | `INSERT`, `UPDATE`, `DELETE` | Row를 생성·수정·삭제 |
| 데이터 조회 | `SELECT` | 필요한 Row와 Column을 결과 집합으로 조회 |
| Transaction 제어 | `BEGIN`, `COMMIT`, `ROLLBACK` | 여러 변경의 완료·취소 경계를 제어 |

`DROP TABLE`은 Table 구조와 데이터를 제거하는 파괴적 명령이다. 학습 환경에서도 대상 이름과 현재 Database를 먼저 확인해야 한다.

## Table 구조 정의

### 최소 Ticket Table

```sql
CREATE TABLE tickets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT tickets_title_not_blank
        CHECK (btrim(title) <> ''),

    CONSTRAINT tickets_status_allowed
        CHECK (status IN (
            'OPEN',
            'IN_PROGRESS',
            'RESOLVED'
        ))
);
```

### PostgreSQL 문법과 Database 이식성의 경계

위 DDL은 여러 RDBMS에서 그대로 실행되는 중립 문법이 아니라 **PostgreSQL 17을 대상으로 한 예시**다.

| 목적 | PostgreSQL 예시 | 다른 Database로 바꿀 때 확인할 부분 |
|---|---|---|
| 식별 값 자동 생성 | `GENERATED ALWAYS AS IDENTITY` | 제품별 Identity·Auto Increment 문법과 동작 |
| 시점 저장 | `TIMESTAMPTZ` | 지원 Type과 Time Zone 처리 방식 |
| 앞뒤 공백 제거 | `btrim(title)` | 동등한 문자열 함수와 공백 처리 범위 |
| 허용 값 제한 | `CHECK (...)` | 해당 제품의 Constraint 문법과 실제 강제 여부 |

Database를 PostgreSQL에서 MariaDB 같은 다른 제품으로 바꾸려면 보통 다음 부분을 함께 바꾼다.

- Database별 DDL과 Migration
- JDBC Driver와 연결 설정
- `TicketRepository`를 구현하는 Database Adapter
- 실제 대상 Database를 사용하는 Integration Test

반면 `Ticket` Domain 규칙, Application Service와 `TicketRepository` Port는 특정 Database 문법을 직접 알지 않도록 유지한다. 이것이 “모든 Database에서 같은 DDL을 사용한다”는 뜻은 아니다. 저장 기술별 차이는 Migration과 Adapter 경계에 두고, 상위 Layer의 계약이 불필요하게 바뀌지 않게 하는 방식이다.

이식성을 높이기 위해 Database Constraint를 제거해서는 안 된다. Database를 교체한다면 새 제품의 문법으로 `NOT NULL`, `CHECK`, Key 같은 동등한 무결성 규칙을 다시 표현하고, Integration Test로 실제 동작을 확인해야 한다.

| 정의 | 의미 |
|---|---|
| `BIGINT` | 큰 범위의 정수 Type |
| `GENERATED ALWAYS AS IDENTITY` | PostgreSQL이 새 Row의 식별 값을 생성 |
| `PRIMARY KEY` | Row를 식별하며 중복과 `NULL`을 허용하지 않음 |
| `TEXT` | 길이를 미리 제한하지 않은 문자열 Type |
| `TIMESTAMPTZ` | Time Zone을 고려해 시점을 저장하는 Type |
| `DEFAULT` | 값을 생략했을 때 사용할 기본값 |
| `CONSTRAINT 이름` | Constraint에 명시적인 이름을 부여 |

`DEFAULT`는 입력을 거부하는 Constraint가 아니다. 값을 생략했을 때 채울 값을 정의할 뿐이다.

`updated_at`의 `DEFAULT CURRENT_TIMESTAMP`도 Row가 생성될 때의 기본값만 제공한다. 다른 Column을 `UPDATE`한다고 `updated_at`이 자동으로 바뀌지는 않는다. Application이나 실행 SQL이 `updated_at = CURRENT_TIMESTAMP`를 명시하거나 별도의 Database Trigger 정책이 있어야 한다.

### Identity와 Sequence 번호의 공백

PostgreSQL의 Identity Column은 내부 Sequence에서 값을 발급받는다. `INSERT`에서 Identity Column을 생략하면 새 값이 먼저 발급된 뒤 다른 Constraint가 검사될 수 있다.

```text
이력 ID 1 발급
→ Foreign Key 위반으로 INSERT 실패
→ Row는 저장되지 않지만 Sequence 값 1은 반환되지 않음

다음 INSERT
→ 이력 ID 2 발급
```

Sequence는 여러 Session에서 서로 다른 값을 안전하게 발급하기 위한 도구이며, 저장된 Row 수나 빈틈없는 일련번호를 보장하지 않는다. 따라서 Primary Key의 숫자 사이에 공백이 있어도 데이터 유실로 해석하면 안 된다.

서로 다른 Table의 Identity도 각각 독립적이다.

```text
ticket_status_history.id = 2
→ 이력 Row 자체의 식별자

ticket_status_history.ticket_id = 1
→ 이력이 참조하는 tickets.id
```

### Table 변경과 제거

```sql
ALTER TABLE tickets
ADD COLUMN description TEXT;
```

```sql
DROP TABLE tickets;
```

`ALTER TABLE`은 기존 구조를 바꾸고, `DROP TABLE`은 Table 자체를 제거한다. 이미 데이터가 있는 Table에 `NOT NULL` Column을 추가하거나 Constraint를 강화하면 기존 Row가 새 규칙을 만족하는지도 고려해야 한다.

## Constraint가 보호하는 범위

Constraint는 Application Code가 아닌 Database가 저장 가능한 Row의 범위를 제한하는 규칙이다.

| Constraint | 보호하는 내용 | 예시 |
|---|---|---|
| `NOT NULL` | Column 값이 `NULL`이 아님 | `title TEXT NOT NULL` |
| `CHECK` | 현재 Row의 Boolean 표현식이 허용됨 | `CHECK (btrim(title) <> '')` |
| `UNIQUE` | 한 Column 또는 Column 조합이 중복되지 않음 | `UNIQUE (external_id)` |
| `PRIMARY KEY` | Row를 식별하는 값이 고유하고 `NULL`이 아님 | `id BIGINT PRIMARY KEY` |
| `FOREIGN KEY` | 참조 값이 대상 Table에 존재함 | `ticket_id BIGINT REFERENCES tickets(id)` |

PostgreSQL의 일반적인 `UNIQUE` Constraint는 `NULL`들을 서로 같은 값으로 보지 않으므로 Nullable Column에는 여러 `NULL`이 저장될 수 있다. `NULL`도 하나만 허용하려는 계약이라면 `NOT NULL`과의 결합 또는 `NULLS NOT DISTINCT` 같은 별도 선택을 검토해야 한다.

### `NOT NULL`과 공백 문자열

```sql
title TEXT NOT NULL
```

이 정의는 `NULL`만 거부한다.

```sql
-- 실패: NULL은 허용되지 않음
INSERT INTO tickets (title)
VALUES (NULL);
```

```sql
-- NOT NULL만 있다면 성공할 수 있음
INSERT INTO tickets (title)
VALUES ('   ');
```

빈 문자열(`''`)과 공백이 들어 있는 문자열(`'   '`)은 `NULL`이 아니다.

### `CHECK (btrim(title) <> '')`

`btrim(title)`은 기본적으로 문자열 양끝의 일반 공백을 제거한다. `<>`는 “같지 않다”는 비교 Operator다.

```text
title                 = '   '
btrim(title)          = ''
btrim(title) <> ''    = FALSE
CHECK 결과            = 거부
```

```text
title                 = '  로그인 오류  '
btrim(title)          = '로그인 오류'
btrim(title) <> ''    = TRUE
CHECK 결과            = 허용
```

PostgreSQL의 `CHECK`는 표현식이 `TRUE`이면 통과하고 `FALSE`이면 거부한다. 중요한 예외는 표현식이 `NULL`로 평가될 때도 통과한다는 점이다.

```text
title                 = NULL
btrim(title)          = NULL
btrim(title) <> ''    = NULL
CHECK 결과            = 통과 가능
```

따라서 제목의 `NULL`과 공백 문자열을 모두 막으려면 두 규칙을 함께 사용한다.

```sql
title TEXT NOT NULL
    CHECK (btrim(title) <> '')
```

`btrim()`의 기본 동작은 Java `String.isBlank()`와 완전히 같지 않다. 기본 `btrim()`은 일반 공백을 제거하며 모든 종류의 Unicode 공백 문자를 같은 방식으로 처리한다고 단정할 수 없다. Application과 Database가 “blank”를 어디까지로 정의할지 계약을 명시해야 한다.

### 현재 값의 허용 범위와 상태 전이 규칙

```sql
CHECK (status IN (
    'OPEN',
    'IN_PROGRESS',
    'RESOLVED'
))
```

이 Constraint는 현재 `status`가 허용된 문자열 중 하나인지 검사한다. 다음 상태 전이 순서까지 검증하는 것은 아니다.

```text
OPEN → IN_PROGRESS → RESOLVED
```

상태 전이는 이전 상태와 요청한 행동을 함께 해석해야 하는 현재 Application의 업무 규칙이다. 현재 Row의 값만 검사하는 단순 `CHECK`와 목적이 다르다. 따라서 현 단계에서는 Ticket Domain이 전이 규칙을 보호하고, Database는 `NULL`과 허용되지 않은 상태 값 같은 저장 경계를 보호한다.

예를 들어 다음 SQL의 새 상태 값은 허용 목록에 있으므로 단순 `CHECK`만으로는 `OPEN`에서 `RESOLVED`로 바로 바뀌는 것을 거부하지 못한다.

```sql
UPDATE tickets
SET status = 'RESOLVED'
WHERE status = 'OPEN';
```

## Row 생성 — `INSERT`

Column 이름을 명시하면 Table의 Column 순서를 외울 필요가 없고 입력 의도가 분명해진다.

```sql
INSERT INTO tickets (
    title
)
VALUES (
    '로그인 오류'
);
```

`status`와 `created_at`을 생략하면 정의된 `DEFAULT` 값이 사용된다.

여러 Row를 한 번에 넣을 수도 있다.

```sql
INSERT INTO tickets (
    title,
    status
)
VALUES
    ('로그인 오류', 'OPEN'),
    ('결제 확인 요청', 'IN_PROGRESS');
```

### 생성 결과 바로 받기 — `RETURNING`

PostgreSQL의 `RETURNING`은 변경된 Row의 값을 추가 조회 없이 반환한다.

```sql
INSERT INTO tickets (
    title
)
VALUES (
    '로그인 오류'
)
RETURNING id, title, status, created_at;
```

자동 생성된 `id`나 `DEFAULT`로 채워진 값을 확인할 때 유용하다.

## Row 조회 — `SELECT`

### 전체 Column과 필요한 Column

```sql
SELECT *
FROM tickets;
```

`*`는 모든 Column을 의미한다. 실제 Code에서는 필요한 Column을 명시하면 계약과 데이터 사용 범위가 분명해진다.

```sql
SELECT id, title, status
FROM tickets;
```

### 조건 — `WHERE`

```sql
SELECT id, title, status
FROM tickets
WHERE id = 7;
```

```sql
SELECT id, title, status
FROM tickets
WHERE status IN ('OPEN', 'IN_PROGRESS');
```

대표 비교·논리 표현식은 다음과 같다.

| 표현식 | 의미 |
|---|---|
| `a = b` | 두 값이 같음 |
| `a <> b` | 두 값이 다름 |
| `a < b`, `a <= b` | 크기 비교 |
| `a IN (...)` | 목록 안의 값 중 하나와 일치 |
| `condition_a AND condition_b` | 두 조건이 모두 `TRUE` |
| `condition_a OR condition_b` | 하나 이상의 조건이 `TRUE` |
| `NOT condition` | 조건의 논리 결과를 반대로 바꿈 |

### `NULL` 비교

`NULL`은 빈 문자열이나 숫자 0이 아니라 “값을 알 수 없음”을 나타낸다. 일반 비교 Operator로 검사하지 않는다.

```sql
-- 잘못된 의도 표현: 결과가 TRUE가 아니라 NULL이 됨
SELECT *
FROM tickets
WHERE description = NULL;
```

```sql
-- NULL 여부를 명시적으로 검사
SELECT *
FROM tickets
WHERE description IS NULL;
```

```sql
SELECT *
FROM tickets
WHERE description IS NOT NULL;
```

### 정렬과 개수 제한

```sql
SELECT id, title, status, created_at
FROM tickets
ORDER BY created_at DESC, id DESC
LIMIT 10;
```

- `ASC`: 오름차순
- `DESC`: 내림차순
- `LIMIT`: 반환할 최대 Row 수
- `OFFSET`: 앞에서 건너뛸 Row 수

`ORDER BY`가 없으면 결과 순서를 보장한다고 생각하면 안 된다. `LIMIT`을 사용할 때는 원하는 결과가 안정적으로 선택되도록 `ORDER BY` 기준을 함께 정의한다.

### 집계와 Group

```sql
SELECT status, COUNT(*) AS ticket_count
FROM tickets
GROUP BY status
ORDER BY status;
```

`WHERE`는 Group을 만들기 전 Row를 거르고, `HAVING`은 집계가 끝난 Group을 거른다.

```sql
SELECT status, COUNT(*) AS ticket_count
FROM tickets
GROUP BY status
HAVING COUNT(*) >= 2;
```

## Row 수정 — `UPDATE`

```sql
UPDATE tickets
SET status = 'IN_PROGRESS'
WHERE id = 7
RETURNING id, status;
```

- `UPDATE tickets`: 변경할 Table
- `SET`: 새 값
- `WHERE`: 변경 대상 Row
- `RETURNING`: 변경된 결과

`WHERE`를 생략하면 Table의 모든 Row가 변경된다.

```sql
-- 모든 Ticket의 status가 바뀜
UPDATE tickets
SET status = 'RESOLVED';
```

학습 중에도 먼저 같은 `WHERE` 조건으로 `SELECT`하여 대상 Row를 확인하고, 여러 변경은 Transaction 안에서 실행하는 습관이 안전하다.

## Row 삭제 — `DELETE`

```sql
DELETE FROM tickets
WHERE id = 7
RETURNING id, title;
```

`DELETE`는 Row 전체를 제거한다. 특정 Column만 없애는 명령이 아니다. Column 값을 `NULL`로 바꾸려면 `UPDATE`를 사용하고 해당 Column이 `NULL`을 허용하는지 확인해야 한다.

`WHERE`를 생략하면 모든 Row가 삭제된다.

```sql
DELETE FROM tickets;
```

명령이 문법적으로 올바르다는 사실은 실행해도 안전하다는 뜻이 아니다.

## 관계와 `JOIN`

Ticket의 상태 변경 이력을 별도 Table로 분리하면 한 Ticket과 여러 이력 Row의 관계를 표현할 수 있다.

```sql
CREATE TABLE ticket_status_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_id BIGINT NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ticket_status_history_ticket
        FOREIGN KEY (ticket_id)
        REFERENCES tickets(id),

    CONSTRAINT ticket_status_history_from_status_allowed
        CHECK (
            from_status IS NULL
            OR from_status IN (
                'OPEN',
                'IN_PROGRESS',
                'RESOLVED'
            )
        ),

    CONSTRAINT ticket_status_history_to_status_allowed
        CHECK (to_status IN (
            'OPEN',
            'IN_PROGRESS',
            'RESOLVED'
        ))
);
```

`FOREIGN KEY` 역할을 하는 `REFERENCES tickets(id)`는 존재하지 않는 Ticket ID의 이력 Row가 저장되지 않도록 참조 무결성을 보호한다.

`from_status`가 `NULL`이면 이전 상태가 없는 생성 사건을 `NULL → OPEN`으로 표현할 수 있다. 일반 상태 변경은 `OPEN → IN_PROGRESS`처럼 두 상태를 모두 기록한다. 위 Row 단위 `CHECK`는 `NULL`이 최초 이력에서만 사용됐는지까지는 확인하지 못하므로, 생성 이력의 횟수와 상태 전이 순서는 Domain·Application 규칙 또는 별도 Database 정책이 보호해야 한다.

`tickets.status`는 현재 상태이고 `ticket_status_history`는 변화 이력이다. 두 값의 일관성을 유지하려면 현재 상태 수정과 이력 추가를 같은 Transaction으로 처리해야 한다.

두 Table의 관련 Row를 함께 조회할 때 `JOIN`을 사용한다.

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
WHERE t.id = 7
ORDER BY h.changed_at, h.id;
```

- `AS t`, `AS h`: 긴 Table 이름에 Alias 부여
- `INNER JOIN`: 양쪽에서 조건에 맞는 Row만 반환
- `ON`: 두 Table의 Row가 연결되는 조건

관계와 정규화의 구체적인 판단은 별도 학습 주제로 다룬다.

## 여러 변경의 경계 — Transaction

Ticket 상태와 상태 변경 이력을 항상 함께 바꿔야 한다고 가정한다.

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

- `BEGIN`: Transaction Block 시작
- `COMMIT`: 변경을 확정
- `ROLLBACK`: 현재 Transaction의 변경을 취소

두 번째 SQL에서 문제가 발견됐다면 다음처럼 취소할 수 있다.

```sql
ROLLBACK;
```

PostgreSQL에서는 `BEGIN`을 직접 쓰지 않은 개별 SQL 문장도 각각 하나의 Transaction 안에서 실행된다. 명시적인 `BEGIN`과 `COMMIT`은 여러 문장을 하나의 완료 단위로 묶을 때 사용한다.

Transaction을 사용한다는 사실만으로 모든 업무 규칙, 동시성 문제나 중복 요청이 자동으로 해결되는 것은 아니다. 원자성, Isolation과 Lock은 뒤의 실험에서 각각 구분한다.

## `psql`과 SQL의 차이

`psql`은 PostgreSQL Server에 연결하여 SQL을 입력하고 결과를 확인하는 Terminal Client다. SQL은 Server가 해석하지만, Backslash(`\`)로 시작하는 Meta-command는 `psql` Client가 처리한다.

```text
psql
├── SQL: SELECT, INSERT, UPDATE, DELETE, CREATE TABLE
└── Meta-command: \conninfo, \l, \c, \dt, \d, \q
```

| `psql` 명령 | 역할 |
|---|---|
| `\conninfo` | 현재 연결 정보 확인 |
| `\l` | Database 목록 확인 |
| `\c database_name` | 다른 Database에 연결 |
| `\dt` | 현재 Schema에서 보이는 Table 목록 확인 |
| `\d tickets` | `tickets` 구조 확인 |
| `\q` | `psql` 종료 |

Meta-command에는 일반적으로 SQL의 세미콜론을 붙이지 않는다.

```text
\dt
```

```sql
SELECT *
FROM tickets;
```

접속 명령에는 Secret을 직접 적지 않고 Password Prompt나 안전한 Credential 저장 방식을 사용한다.

```powershell
psql -h localhost -p 5432 -U ROLE_NAME -d DATABASE_NAME
```

`ROLE_NAME`과 `DATABASE_NAME`은 실제 환경에 맞게 바꿀 입력 위치를 나타내는 Placeholder다.

## 안전한 SQL 작성 순서

### 조회부터 확인

```sql
SELECT id, title, status
FROM tickets
WHERE id = 7;
```

변경할 Row가 맞는지 확인한 뒤 같은 조건으로 수정한다.

```sql
UPDATE tickets
SET status = 'IN_PROGRESS'
WHERE id = 7
RETURNING id, status;
```

### Column을 명시

```sql
INSERT INTO tickets (
    title,
    status
)
VALUES (
    '로그인 오류',
    'OPEN'
);
```

Table 정의 순서에만 의존하는 다음 방식보다 변경에 안전하고 읽기 쉽다.

```sql
INSERT INTO tickets
VALUES (
    DEFAULT,
    '로그인 오류',
    'OPEN',
    DEFAULT
);
```

### 변경 결과를 확인

`RETURNING`이나 별도 `SELECT`로 영향받은 Row와 결과를 확인한다. Query가 성공했다는 메시지만 보고 의도한 Row가 바뀌었다고 단정하지 않는다.

### 여러 변경은 Transaction으로 묶기

함께 성공하거나 함께 취소되어야 하는 SQL은 명시적인 Transaction 경계를 검토한다. 실행 중 오류가 발생했다면 현재 Transaction 상태를 확인하고 무조건 다음 SQL을 이어서 실행하지 않는다.

## 실패·반례와 자주 발생하는 오해

| 오해·잘못된 사용 | 수정된 이해 |
|---|---|
| `NOT NULL`이면 공백 제목도 막힌다. | `NULL`만 막는다. 빈 문자열과 공백 문자열은 별도 규칙이 필요하다. |
| `CHECK (btrim(title) <> '')`만 있으면 `NULL`도 막힌다. | `CHECK` 결과가 `NULL`이면 통과할 수 있으므로 `NOT NULL`을 함께 사용한다. |
| `btrim()`은 Java `String.isBlank()`와 같다. | 기본 제거 문자와 Unicode 공백 처리 범위가 다를 수 있으므로 계약을 별도로 확인한다. |
| 문자열은 큰따옴표로 쓴다. | 문자열 Literal은 작은따옴표, 큰따옴표는 Identifier에 사용한다. |
| `column = NULL`로 `NULL`을 찾는다. | `IS NULL` 또는 `IS NOT NULL`을 사용한다. |
| `UPDATE`·`DELETE`에서 `WHERE`를 생략하면 오류다. | 문법적으로 허용되며 모든 Row에 적용될 수 있어 더 위험하다. |
| `SELECT` 결과는 항상 같은 순서다. | `ORDER BY`가 없으면 순서를 보장하지 않는다. |
| `CHECK`로 상태 전이 순서까지 자동 보호된다. | 단순 `CHECK`는 현재 Row 값의 허용 범위를 검사하며 이전 상태를 포함한 전이 규칙과는 다르다. |
| `\dt`는 SQL이다. | `psql` Client가 처리하는 Meta-command다. |
| Transaction을 쓰면 중복 POST도 자동 방지된다. | Transaction 원자성과 API 멱등성은 서로 다른 문제다. |

## 학습 점검 질문

1. `NULL`, `''`와 `'   '`은 어떻게 다른가?
2. `NOT NULL`과 `CHECK (btrim(title) <> '')`을 함께 사용하는 이유는 무엇인가?
3. `CHECK` 표현식 결과가 `NULL`이면 왜 `NOT NULL`이 별도로 필요한가?
4. `PRIMARY KEY`와 `UNIQUE`의 공통점과 차이는 무엇인가?
5. 문자열 Literal과 Identifier에는 각각 어떤 따옴표를 사용하는가?
6. `WHERE description = NULL`이 의도대로 동작하지 않는 이유는 무엇인가?
7. `ORDER BY` 없이 `LIMIT 10`만 쓰면 어떤 문제가 생길 수 있는가?
8. `UPDATE`와 `DELETE`를 실행하기 전에 같은 `WHERE` 조건으로 `SELECT`하는 이유는 무엇인가?
9. `RETURNING`은 어떤 추가 조회를 줄일 수 있는가?
10. 상태 값의 허용 집합과 상태 전이 순서는 왜 서로 다른 규칙인가?
11. `FOREIGN KEY`가 보호하는 참조 무결성이란 무엇인가?
12. 여러 SQL 문장을 `BEGIN`과 `COMMIT`으로 묶는 이유는 무엇인가?
13. SQL 명령과 `psql` Meta-command는 어디에서 처리되는가?

## 자료 범위

### 포함

- PostgreSQL 17 기준 SQL Token과 기본 표기
- Table 정의와 대표 Constraint
- `INSERT`, `SELECT`, `UPDATE`, `DELETE`와 `RETURNING`
- `WHERE`, `ORDER BY`, `LIMIT`, 간단한 집계와 `JOIN`
- `NULL`과 Boolean 조건의 기초
- `BEGIN`, `COMMIT`, `ROLLBACK`
- 자주 사용하는 `psql` Meta-command

### 포함하지 않음

- 1~3NF의 구체적인 정규화 절차
- Isolation Level, MVCC, Row Lock과 Deadlock
- Index 구조와 `EXPLAIN (ANALYZE, BUFFERS)` 해석
- View, Function, Procedure와 Trigger 구현
- Role·권한과 Production 보안 설정
- JPA Mapping, Migration 도구와 Connection Pool
- 개인의 실제 Database 이름, Role, Credential과 실행 결과

## 참고 자료

- [PostgreSQL 17 — Lexical Structure](https://www.postgresql.org/docs/17/sql-syntax-lexical.html)
- [PostgreSQL 17 — Constraints](https://www.postgresql.org/docs/17/ddl-constraints.html)
- [PostgreSQL 17 — Identity Columns](https://www.postgresql.org/docs/17/ddl-identity-columns.html)
- [PostgreSQL 17 — Sequence Manipulation Functions](https://www.postgresql.org/docs/17/functions-sequence.html)
- [PostgreSQL 17 — Data Manipulation](https://www.postgresql.org/docs/17/dml.html)
- [PostgreSQL 17 — Inserting Data](https://www.postgresql.org/docs/17/dml-insert.html)
- [PostgreSQL 17 — Updating Data](https://www.postgresql.org/docs/17/dml-update.html)
- [PostgreSQL 17 — Deleting Data](https://www.postgresql.org/docs/17/dml-delete.html)
- [PostgreSQL 17 — Returning Data from Modified Rows](https://www.postgresql.org/docs/17/dml-returning.html)
- [PostgreSQL 17 — Queries](https://www.postgresql.org/docs/17/queries.html)
- [PostgreSQL 17 — Table Expressions](https://www.postgresql.org/docs/17/queries-table-expressions.html)
- [PostgreSQL 17 — Sorting Rows](https://www.postgresql.org/docs/17/queries-order.html)
- [PostgreSQL 17 — LIMIT and OFFSET](https://www.postgresql.org/docs/17/queries-limit.html)
- [PostgreSQL 17 — String Functions and Operators](https://www.postgresql.org/docs/17/functions-string.html)
- [PostgreSQL 17 — Transactions](https://www.postgresql.org/docs/17/tutorial-transactions.html)
- [PostgreSQL 17 — psql](https://www.postgresql.org/docs/17/app-psql.html)
- [MariaDB — CREATE TABLE](https://mariadb.com/kb/en/create-table/)
- [MariaDB — AUTO_INCREMENT](https://mariadb.com/kb/en/auto_increment/)
