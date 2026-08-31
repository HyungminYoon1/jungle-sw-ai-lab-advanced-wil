# 2026-09-01 — PostgreSQL 학습용 Database 시작 확인

> 작성일: 2026-09-01
> 목적: 학습용 Database의 실제 존재 여부를 확인하고 Schema·Constraint SQL 실험의 시작 상태를 구분한다.
> 상태: In Progress

---

## 오늘의 질문

> PostgreSQL Server 접속 성공과 학습용 Database 준비 완료는 어떻게 구분하는가?

## 실행 전 상태

- PostgreSQL 17.7 Server와 기본 `postgres` Database 인증 접속은 8월 31일에 확인했다.
- `ai_helpdesk_learning_lab`이라는 학습용 Database가 실제로 존재하는지는 확인하지 않았다.
- Credential 값은 Command나 문서에 기록하지 않는다.

## 학습용 Database 존재 여부 확인

기본 `postgres` Database에서 Catalog를 조회했다.

```sql
SELECT datname
FROM pg_database
WHERE datname = 'ai_helpdesk_learning_lab';
```

관찰 결과는 다음과 같다.

```text
0 rows
```

## 결과 해석

- Query 자체는 성공했으므로 PostgreSQL Server와 현재 Database에 연결된 상태다.
- `pg_database`에서 조건에 맞는 Row가 0건이므로 `ai_helpdesk_learning_lab` Database는 현재 존재하지 않는다.
- 이 결과는 연결 실패나 Query 오류가 아니다.
- `CREATE DATABASE`는 아직 실행하지 않았으므로 학습용 Database 준비 상태는 `NOT_CREATED`다.
- Schema·Table·Constraint SQL도 아직 실행하지 않았으므로 해당 실험은 `NOT_RUN`이다.

## 현재 검증 경계

| 항목 | 상태 | 근거 |
|---|---|---|
| PostgreSQL 17.7 Server | `VERIFIED` | 8월 31일 Version·Service·접속 확인 |
| 기본 `postgres` Database 인증 접속 | `VERIFIED` | 8월 31일 `current_database()` 확인 |
| `ai_helpdesk_learning_lab` 존재 | `NOT_CREATED` | 9월 1일 `pg_database` 조회 결과 0건 |
| 학습용 Schema·Table | `NOT_RUN` | 생성 SQL 미실행 |
| Constraint 실패 재현 | `NOT_RUN` | DDL·DML 실험 미실행 |
| Spring Application PostgreSQL 연동 | `NOT_IMPLEMENTED` | Driver·Adapter·Integration Test 미구성 |

## 다음 단계

- 학습용 Database를 생성하기 전에 현재 접속 Database와 생성 대상 이름을 다시 확인한다.
- 생성 후 학습용 Database로 다시 접속하여 `current_database()` 결과를 확인한다.
- 비정규 Ticket 장부의 문제를 먼저 예측한 뒤 Table·Constraint를 작은 단계로 작성한다.
- `NOT NULL`, 공백 `CHECK`, 상태 값 `CHECK`, Key를 각각 성공·실패 SQL로 분리해 관찰한다.
