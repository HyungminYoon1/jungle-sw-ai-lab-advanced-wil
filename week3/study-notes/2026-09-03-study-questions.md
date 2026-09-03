# 2026-09-03 — PostgreSQL Isolation·MVCC·Lock 실습

> 작성일: 2026-09-03
> 목적: 두 PostgreSQL Session에서 미확정 변경의 가시성, Row Lock 대기, Lost Update, 낙관적 Lock과 Deadlock을 직접 재현하고 각각의 차이를 설명한다.
> 상태: Completed

---

## 오늘의 질문

> 두 사용자가 같은 데이터를 동시에 읽고 수정할 때 PostgreSQL은 무엇을 보여 주고, 언제 기다리게 하며, Application은 어떤 충돌을 직접 판정해야 하는가?

## 시작 상태

- 9월 2일에 암묵적·명시적 Transaction과 `COMMIT`·`ROLLBACK`을 재현했다.
- `tickets`의 현재 상태 변경과 `ticket_status_history` 추가를 하나의 Transaction으로 묶어 Atomicity를 확인했다.
- 다른 Session에서 미확정 Row가 어떻게 보이는지와 Lock 대기·Deadlock은 아직 `NOT_RUN`이었다.
- Application의 PostgreSQL Adapter·JPA·Spring Transaction은 `NOT_IMPLEMENTED` 상태였다.

## 핵심 개념 점검과 교정

### 일반 `SELECT`와 MVCC

Session A가 `id=6` Ticket을 `OPEN`에서 `IN_PROGRESS`로 바꾸고 아직 Commit하지 않았을 때, Session B의 일반 `SELECT`는 기다리지 않고 마지막으로 Commit된 `OPEN`을 조회했다.

이는 다른 Session의 미확정 변경을 읽는 것이 아니다. PostgreSQL의 기본 `READ COMMITTED`에서 일반 조회는 문장이 시작될 때 사용할 수 있는 Commit된 Version을 읽는다.

### `SELECT ... FOR UPDATE`와 Lock 대기

같은 상황에서 Session B가 `SELECT ... FOR UPDATE`를 실행하면 단순 조회가 아니라 대상 Row의 변경 권한을 확보하려 한다. Session A가 이미 해당 Row Lock을 보유하므로 B는 기다렸다. `lock_timeout = '5s'`를 설정한 실험에서는 제한 시간이 지나 명령이 취소됐고, 실패 상태가 된 Transaction을 `ROLLBACK`으로 정리했다.

```text
일반 SELECT
→ 마지막으로 Commit된 Version을 바로 읽음

SELECT ... FOR UPDATE
→ 대상 Row의 Lock을 확보하려 함
→ 다른 Transaction이 보유 중이면 대기
```

### Lock 대기와 Deadlock

- Lock 대기: 한 Transaction이 다른 Transaction의 Lock 해제를 기다리는 상태다. Lock 보유자가 끝나면 진행할 수 있다.
- Deadlock: 둘 이상의 Transaction이 서로가 보유한 자원을 기다려 순환 대기가 생긴 상태다. 기다리기만 해서는 풀리지 않는다.

PostgreSQL은 실제 Deadlock 실험에서 Transaction 하나를 감지·중단해 순환을 끊었다. 관련 Transaction이 모두 자동으로 중단되는 것은 아니며, 어떤 Transaction이 희생자로 선택될지는 일반 규칙으로 단정하지 않는다.

### 같은 순서로 Row를 잠그는 이유

모든 처리 경로가 공통된 전체 순서로 Row를 잠그면 대기 방향이 한쪽으로 정렬되어 순환 대기가 생길 가능성이 크게 줄어든다. 이번 실험에서는 모든 Session이 `id=1` 다음 `id=2` 순서로 수정했다.

핵심은 숫자를 반드시 오름차순으로 사용한다는 것이 아니라, 시스템 전체가 같은 기준을 일관되게 지키는 것이다. 동일 순서도 Lock 대기 자체를 없애지는 않으며, 다른 경로가 순서를 어기면 Deadlock 가능성은 다시 생긴다.

### Lost Update 실험 설계 교정

처음에는 두 Session이 모두 `0`을 읽고 `SET counter_value = 1`을 실행해 최종 값이 `1`인 결과를 관찰했다. 그러나 이 결과만으로는 동시성 때문에 갱신이 유실됐다고 충분히 설명할 수 없다. 두 작업을 순차 실행해도 둘 다 값을 `1`로 고정하면 최종 값은 `1`이기 때문이다.

따라서 같은 Application 계산 방식에서 읽기 시점만 다르게 한 대조가 필요하다.

```text
순차 대조
A가 0을 읽고 1을 저장·Commit
→ B가 최신 1을 읽고 2를 저장·Commit
→ 최종 값 2

동시 stale-read
A와 B가 모두 0을 읽고 각자 1을 계산
→ A가 1을 저장·Commit
→ B도 예전에 계산한 1을 저장·Commit
→ 최종 값 1
```

두 번째 경우에는 A의 증가 결과가 B의 오래된 계산 결과로 덮였다. 이것이 이번 실험에서 확인한 Lost Update다.

### Database 안의 원자적 증가

`SET counter_value = counter_value + 1`은 값을 Application으로 읽어 계산한 뒤 절대값을 저장하는 방식과 다르다. 동일 Row에 대한 두 `UPDATE` 중 뒤의 문장은 Row Lock을 기다린 뒤 최신 Commit 값을 기준으로 다시 평가됐다. 두 번의 증가 결과는 최종 `2`였다.

이는 Lost Update를 피할 수 있는 한 방법이지만 모든 복잡한 업무 계산을 SQL 한 문장으로 표현할 수 있다는 뜻은 아니다.

### 낙관적 Lock의 충돌 신호

두 Session이 모두 `counter_value=0`, `version=0`을 읽었다. A가 다음 조건으로 갱신해 `counter_value=1`, `version=1`을 Commit한 뒤, B가 오래된 `version=0` 조건으로 같은 SQL을 실행했다.

```sql
UPDATE concurrency_lab_counters
SET counter_value = 1,
    version = version + 1
WHERE id = 1
  AND version = 0;
```

B의 결과는 SQL Exception이 아니라 `UPDATE 0`이었다. PostgreSQL이 Application의 의도를 알고 자동 보정하거나 충돌 예외를 만들어 주지는 않는다. Application 또는 Framework가 영향받은 Row 수 `0`을 동시성 충돌로 해석해야 한다.

B가 최신 Row를 다시 읽어 `version=1`을 조건으로 재시도하자 `counter_value=2`, `version=2`로 갱신됐다. 재조회·재계산·재시도는 충돌 정책의 일부이며 무제한 반복해서는 안 된다.

## 실행 결과 요약

| 실험 | 관찰 결과 | 근거 상태 |
|---|---|---|
| 두 Session Baseline | 서로 다른 Backend PID, 같은 Database, `READ COMMITTED` 확인 | `USER_VERIFIED` |
| 미확정 변경과 일반 `SELECT` | A의 미확정 `IN_PROGRESS` 대신 마지막 Commit 값 `OPEN` 조회 | `USER_VERIFIED` |
| `SELECT ... FOR UPDATE` | 5초 Lock 대기 제한 후 취소, 실패 Transaction을 `ROLLBACK` | `USER_VERIFIED` |
| Lost Update | 두 Session의 오래된 계산값 저장 후 최종 `1` | `USER_VERIFIED` |
| Database 원자적 증가 | 두 `counter_value + 1` 실행 후 최종 `2` | `USER_VERIFIED` |
| 낙관적 Lock 충돌 | 오래된 `version=0` 갱신은 `UPDATE 0`; 재조회 후 재시도는 성공 | `USER_VERIFIED` |
| 역순 Row Lock | A는 `1→2`, B는 `2→1`로 잠가 실제 Deadlock 발생 | `USER_VERIFIED` |
| 동일 순서 Row Lock | 두 Session 모두 `1→2` 순서로 완료, 최종 두 Row 모두 `2` | `USER_VERIFIED` |
| 동일 순서 실험의 정확한 대기 시간 | 별도 시간 측정 없음 | `NOT_MEASURED` |

세부 SQL 순서와 환경·한계는 [PostgreSQL Isolation·Lock 동시성 Lab Report](../lab-reports/2026-09-03-postgresql-isolation-and-lock-lab.md)에 분리해 기록했다.

## PostgreSQL Update 중 연결 종료

실험 도중 PostgreSQL 17 Update로 기존 Session 연결이 종료됐다. 재접속 후 다음을 확인했다.

- Server: PostgreSQL 17.11
- `psql` Client: 17.7
- 학습용 Database와 `concurrency_lab_counters` Table 유지
- 중단 당시 Commit하지 않은 변경은 남지 않음
- 새로 연 두 Session의 Backend PID가 서로 다르고 Isolation Level은 모두 `read committed`

이 결과는 Server 재시작 중 미확정 Transaction이 Commit됐다는 근거가 없으면 완료된 변경으로 간주하면 안 된다는 점을 보여 준다. 영속 Schema와 Commit된 Row가 남은 것과 진행 중 Transaction의 변경이 Rollback된 것은 서로 다른 현상이다.

## Deadlock 재현에서 확인한 흐름

```text
Session A: id=1 Lock 보유
Session B: id=2 Lock 보유
Session A: id=2 대기
Session B: id=1 대기
→ 순환 대기
→ PostgreSQL이 B Transaction을 Deadlock 희생자로 중단
→ A의 대기 중 UPDATE가 진행 가능해짐
```

두 Session을 모두 `ROLLBACK`한 뒤 두 Counter Row는 다시 `0`이었다. 다음 동일 순서 실험에서는 두 Session 모두 `id=1 → id=2`로 수정하고 Commit했으며 최종 값은 두 Row 모두 `2`였다.

## 실행 주체와 검증 경계

- 사용자 직접 실행: 두 `psql` Session 구성, Transaction·조회·갱신·Commit·Rollback과 최종 Row 확인
- 사용자 직접 설명: MVCC 가시성, Lock 대기·Deadlock 차이와 동일 Lock 순서의 효과
- Codex 보조: 질문 순서, SQL 절차, 개념 교정과 실험 설계 보완
- 근거 형태: 사용자가 제공한 PostgreSQL `psql` 출력
- Codex 독립 Database 재조회: `NOT_RUN`
- `READ COMMITTED` 외 Isolation Level 비교: `NOT_RUN`
- 정확한 Lock 대기 시간·성능 측정: `NOT_MEASURED`
- Spring·JPA 낙관적 Lock 구현: `NOT_IMPLEMENTED`
- Java·Maven Test: Database SQL Spike에 Source 변경이 없어 `NOT_RUN`

이번 결과는 로컬 PostgreSQL 두 Session에서 SQL 동시성 동작을 확인한 학습 근거다. Production 부하·성능이나 Spring Application의 Transaction 동작을 검증한 결과는 아니다.

## 오늘의 완료 판단

- 완료: `READ COMMITTED`에서 다른 Session의 미확정 변경 비가시성 재현
- 완료: 일반 `SELECT`와 `SELECT ... FOR UPDATE`의 대기 차이 재현
- 완료: 불완전했던 Lost Update 실험을 순차 대조와 동시 stale-read로 교정
- 완료: Database 원자적 증가와 Application 계산 후 절대값 저장의 차이 확인
- 완료: Version 조건 기반 낙관적 Lock의 `UPDATE 0` 충돌 신호와 재시도 확인
- 완료: 역순 Lock의 실제 Deadlock과 PostgreSQL의 희생 Transaction 중단 확인
- 완료: 동일 Lock 순서에서 순환 대기가 사라지는 결과 확인
- 완료: Lock 대기와 Deadlock의 차이, 동일 순서 전략의 효과와 한계 설명

9월 3일 종료 조건인 “동시성 문제와 선택한 해결 방식의 비용을 설명할 수 있는가?”를 직접 SQL로 확인했으므로 일일 상태는 `Completed`다.

## 다음 학습

다음 순서로 진행한다.

1. B-Tree Index가 조회 후보를 줄이는 원리를 복습한다.
2. 선택도와 단일·복합 Index의 Column 순서를 구분한다.
3. 고정 Dataset과 Query를 정한 뒤 Index 전후 `EXPLAIN (ANALYZE, BUFFERS)`를 비교한다.
4. Seq Scan과 Index Scan 중 Planner가 실제로 무엇을 선택했는지 근거로 설명한다.
