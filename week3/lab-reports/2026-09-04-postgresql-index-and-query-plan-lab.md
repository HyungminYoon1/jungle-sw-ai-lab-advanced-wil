# Lab Report — PostgreSQL Index와 Query Plan 비교

> 작성일: 2026-09-04
> 주차: Week 3
> 과정 영역: Database
> 상태: Completed

## 한눈에 보기

- 질문: 같은 `status` 조건이라도 값의 분포와 `ORDER BY`·`LIMIT`에 따라 PostgreSQL은 왜 다른 Scan과 Index를 선택하는가?
- 예상: 희소한 `RESOLVED`는 Index가 유리하고, 대부분을 차지하는 `OPEN`은 Seq Scan이 유리할 수 있다. 정렬 순서와 맞는 복합 Index는 `LIMIT`이 있을 때 조기 종료할 수 있다.
- 관찰: 단일 `status` Index 후 `RESOLVED`는 Index Scan, `OPEN`은 Seq Scan이었다. `(status, created_at DESC)` Index는 최신 20건 Query에서 Sort를 없애고 20건에서 탐색을 중단했다.
- 결론: Index 효과는 존재 여부가 아니라 Dataset 분포와 실제 Query 형태에 따라 달라지며, 실행 계획·Row·Buffer를 같은 조건에서 비교해야 한다.

## 범위

### 포함

- PostgreSQL B-Tree 단일·복합 Index
- 불균등한 상태 분포를 가진 고정 100,000건 Fixture
- 독립 `ANALYZE`와 `pg_stats` 확인
- Index 전후 `EXPLAIN (ANALYZE, BUFFERS)` 비교
- 희소값·흔한 값, 정렬·`LIMIT`에 따른 Plan 변화

### 포함하지 않음

- Production 규모 Benchmark와 성능 향상 비율 주장
- Cold Cache·반복 횟수·동시 부하를 통제한 측정
- Index 저장 크기와 `INSERT`·`UPDATE` 쓰기 시간 측정
- 부분 Index, GIN·GiST·BRIN
- Spring·JPA Index Annotation과 Repository Adapter

## 환경과 검증 경계

| 항목 | 값·상태 |
|---|---|
| OS | Windows 11 |
| Database | `ai_helpdesk_learning_lab` |
| PostgreSQL | Server 17.11, `psql` Client 17.7의 기존 확인 Baseline |
| Block Size | `8192` Byte, 사용자 `SHOW block_size` 결과 |
| 실행 주체 | 사용자가 `psql`에서 직접 실행 |
| 실행 근거 | 사용자가 대화에서 제공한 실제 Plan과 SQL 출력 |
| Codex 독립 재실행 | `NOT_RUN` |
| Java·Spring 변경·Test | `NOT_RUN` — Application Source 변경 없음 |

PostgreSQL Version은 앞선 9월 3일 실험에서 확인한 Baseline이다. 이번 Lab에서는 Database 연결과 SQL 실행 결과가 확인됐지만 Version 명령을 다시 실행하지 않았다.

## Fixture

기존 Ticket 업무 Table을 변경하지 않고 별도 학습 Table을 만들었다.

```sql
CREATE TABLE index_lab_tickets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
```

`id`의 Primary Key로 `index_lab_tickets_pkey` B-Tree Index가 자동 생성됐다. 따라서 “Index 생성 전”은 모든 Index가 없는 상태가 아니라 별도 `status` Index가 없는 상태를 뜻한다.

100개 중 한 건만 `RESOLVED`가 되도록 100,000건을 입력했다.

```sql
INSERT INTO index_lab_tickets (
    status,
    created_at
)
SELECT
    CASE
        WHEN n % 100 = 0 THEN 'RESOLVED'
        ELSE 'OPEN'
    END,
    TIMESTAMPTZ '2026-01-01 00:00:00+09'
        + make_interval(mins => n)
FROM generate_series(1, 100000) AS generated(n);
```

실제 분포는 다음과 같았다.

```text
OPEN       99,000
RESOLVED    1,000
```

대량 입력 뒤 통계를 수집했다.

```sql
ANALYZE index_lab_tickets;
```

`pg_stats`의 `status` 결과는 다음과 같았다.

| 통계 | 관찰값 |
|---|---|
| `null_frac` | `0` |
| `n_distinct` | `2` |
| `most_common_vals` | `{OPEN,RESOLVED}` |
| `most_common_freqs` | `{0.9894,0.0106}` |

실제 비율과 통계 추정치의 작은 차이는 `ANALYZE`가 표본을 사용하는 특성과 일치한다.

## 비교 Query

희소값과 흔한 값에 같은 형태의 Query를 사용했다.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status, created_at
FROM index_lab_tickets
WHERE status = 'RESOLVED';
```

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status, created_at
FROM index_lab_tickets
WHERE status = 'OPEN';
```

정렬·제한 비교에는 다음 Query를 사용했다.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status, created_at
FROM index_lab_tickets
WHERE status = 'RESOLVED'
ORDER BY created_at DESC
LIMIT 20;
```

모든 실행 시간은 한 번의 관찰값이다. Cache와 Background 작업을 통제한 Benchmark가 아니므로 Plan 선택과 작업량을 중심으로 비교한다.

## Case 1 — 별도 `status` Index 없음

| 조건 | Plan | 예상 Row | 실제 Row | Filter 제거 | 실행 Buffer | 실행 시간 |
|---|---|---:|---:|---:|---|---:|
| `RESOLVED` | `Seq Scan` | 1,060 | 1,000 | 99,000 | `shared hit=642` | 3.555ms |
| `OPEN` | `Seq Scan` | 98,940 | 99,000 | 1,000 | `shared hit=642` | 6.513ms |

두 Query 모두 Table의 642개 Block을 순차적으로 확인했다. 반환 Row 수와 Filter에서 제거한 Row 수의 합은 각각 전체 100,000건이다.

## Case 2 — 단일 `status` Index

다음 Index를 추가했다.

```sql
CREATE INDEX index_lab_tickets_status_idx
ON index_lab_tickets (status);
```

| 조건 | 선택 Plan | 예상 Row | 실제 Row | Filter 제거 | 실행 Buffer | 실행 시간 |
|---|---|---:|---:|---:|---|---:|
| `RESOLVED` | `Index Scan` | 1,060 | 1,000 | 표시 없음 | `shared hit=642 read=3` | 0.540ms |
| `OPEN` | `Seq Scan` | 98,940 | 99,000 | 1,000 | `shared hit=642` | 6.884ms |

Planner는 선택 비율이 약 1%인 `RESOLVED`에는 Index를 사용하고, 약 99%인 `OPEN`에는 Index가 있어도 Seq Scan을 사용했다.

`RESOLVED`가 매 100번째 Row에 배치되어 Heap 전체에 분산됐기 때문에 Index로 후보 수를 줄여도 많은 Heap Block을 방문했다. Index Scan Node의 Buffer는 Index와 Heap 접근을 함께 포함할 수 있으므로 `642`와 `3`을 각각 특정 구조의 정확한 Block 수로 단정하지 않는다.

한 번의 시간 결과는 당시 환경에서 작업량 변화와 함께 관찰된 값이지, 일반적인 “몇 배 향상” 근거가 아니다.

## Case 3 — 단일 Index와 최신 20건

복합 Index를 만들기 전에 정렬·`LIMIT` Query를 실행했다.

```text
Limit: 실제 20건
└─ Sort: top-N heapsort, Memory 27kB
   └─ status Index Scan: 실제 1,000건
```

| 항목 | 관찰값 |
|---|---|
| 최종 예상 비용 | `155.10` |
| 실행 Buffer | `shared hit=645` |
| 실행 시간 | `0.740ms` |

단일 Index는 `RESOLVED` 후보를 찾지만 `created_at DESC` 순서를 제공하지 않는다. 따라서 1,000건을 읽은 뒤 `top-N heapsort`로 최신 20건을 유지했다.

## Case 4 — 복합 Index와 최신 20건

정렬 조건과 맞는 복합 Index를 추가했다.

```sql
CREATE INDEX index_lab_tickets_status_created_at_idx
ON index_lab_tickets (status, created_at DESC);
```

실행 계획은 다음 구조로 바뀌었다.

```text
Limit: 실제 20건
└─ 복합 Index Scan: 실제 20건
```

| 항목 | 관찰값 |
|---|---|
| 명시적 `Sort` | 없음 |
| Index Scan 전체 예상 | `rows=1060`, `cost=0.42..1114.22` |
| `Limit` 반영 예상 비용 | `cost=0.42..21.43` |
| 실제 Index Scan Row | `20`, `loops=1` |
| 실행 Buffer | `shared hit=14 read=3` |
| 실행 시간 | `0.058ms` |

복합 Index가 `RESOLVED` 범위 안에서 `created_at DESC` 순서를 제공하므로 별도 Sort가 필요 없었다. 상위 `Limit`이 20건을 받은 뒤 하위 Node에 추가 Row를 요구하지 않아 실제 Index Scan도 20건에서 끝났다.

예상 `rows=1060`과 실제 `rows=20`의 차이는 통계 오류가 아니다. 전자는 Index Scan을 끝까지 실행할 경우의 예상이고 후자는 상위 `Limit`의 조기 종료 결과다.

상위·하위 Node에 반복 표시된 동일한 Buffer 수를 각각 더하지 않는다. `read=3`도 물리 Disk I/O가 정확히 세 번 발생했다는 뜻이 아니라 Shared Buffer로 세 Block을 읽어 들였다는 의미다.

## Case 5 — 복합 Index가 있어도 `LIMIT` 없음

`LIMIT 20`을 제거하고 `RESOLVED` 1,000건 전체를 최신순으로 조회했다.

```text
Sort: quicksort, Memory 71kB, 실제 1,000건
└─ 단일 status Index Scan: 실제 1,000건
```

| 항목 | 관찰값 |
|---|---|
| 최종 예상 비용 | `182.76` |
| 실행 Buffer | `shared hit=645` |
| 실행 시간 | `0.777ms` |

Planner는 총비용이 `1114.22`로 추정된 복합 Index 전체 Scan보다 단일 `status` Index로 후보를 찾고 1,000건을 정렬하는 방법을 선택했다. `LIMIT`은 반환 건수뿐 아니라 조기 종료 가능성과 실행 계획을 바꿀 수 있다.

## 결과 비교

| 질문 | 관찰에 근거한 답 |
|---|---|
| Index가 있으면 항상 사용되는가? | 아니다. `OPEN` 99% 조회에서는 Seq Scan이 유지됐다. |
| 희소값 Index Scan이면 Heap 접근도 항상 적은가? | 아니다. 실제 Row가 Table 전체에 흩어지면 많은 Heap Block을 방문할 수 있다. |
| 복합 Index는 단일 Index보다 항상 우수한가? | 아니다. 정렬·`LIMIT`과 전체 처리 비용에 따라 선택이 달라졌다. |
| `LIMIT`은 결과 건수만 바꾸는가? | 아니다. 정렬 방식과 Index 조기 종료 가능성을 바꿨다. |
| 실행 시간 한 번으로 성능을 일반화할 수 있는가? | 아니다. Dataset·Cache·반복 조건과 Plan 작업량을 함께 봐야 한다. |
| Index는 읽기만 개선하는 무료 구조인가? | 아니다. 별도 저장 공간과 쓰기 시 Entry·Page 유지 비용이 생긴다. |

## 예상과 달랐거나 교정한 점

1. Index Scan으로 바뀌어도 `RESOLVED` Heap Row가 분산돼 실행 Buffer 수가 즉시 한 자리로 줄지는 않았다.
2. 복합 Index를 추가하면 `Limit`이 아니라 `Sort`가 사라졌다. `Limit`은 Query가 요구한 20건 제한을 계속 담당했다.
3. 복합 Index Scan의 전체 비용 `1114.22`만 보고 Plan을 비교하면 안 됐다. `LIMIT`이 있는 Query의 최종 예상 비용은 상위 Node의 `21.43`이었다.
4. `LIMIT`을 제거하자 복합 Index 대신 단일 Index와 `quicksort`가 선택됐다.
5. B-Tree 쓰기 유지 구조를 “Bucket”이 아니라 “Index Entry와 Page”로 표현하는 것이 정확했다.

## Index 쓰기 비용

이번 Lab에서 쓰기 시간이나 Index 크기를 직접 측정하지는 않았다. 다만 생성한 Index 구조에 따라 다음 작업이 추가된다는 점을 설명했다.

```text
Ticket INSERT
→ Heap Row 추가
→ Primary Key Index Entry 추가
→ status Index Entry 추가
→ status·created_at 복합 Index Entry 추가

status UPDATE
→ 새 Heap Tuple 생성
→ status를 포함하는 Index들의 관련 Entry 유지
```

정확한 내부 갱신량은 MVCC, HOT Update 가능 여부와 실제 변경 Column 등에 따라 달라질 수 있다. 이번 완료 근거는 “Index가 별도 저장 구조이고 쓰기 때 유지 비용이 생긴다”는 개념 설명이며, 쓰기 성능 수치는 `NOT_MEASURED`다.

## Test와 검증

| 검증 | 결과 | 의미 |
|---|---|---|
| Table·100,000건 Fixture 생성 | Pass | 고정된 불균등 분포 구성 |
| `ANALYZE`·`pg_stats` 확인 | Pass | Planner 추정 근거 확인 |
| Index 전후 희소값 Query | Pass | Seq Scan에서 Index Scan으로 변화 |
| 흔한 값 Query | Pass | Index가 있어도 Seq Scan 유지 |
| 단일·복합 Index 정렬 Query | Pass | Sort와 조기 종료 차이 확인 |
| `LIMIT` 제거 대조 | Pass | 단일 Index와 전체 Sort 재선택 확인 |
| 반복 Benchmark | `NOT_RUN` | 성능 향상 비율 주장 안 함 |
| Java·Spring Test | `NOT_RUN` | Source·Dependency 변경 없음 |

## 남아 있는 상태와 다음 질문

- `index_lab_tickets`와 생성한 두 보조 Index는 학습용 Database에 남아 있다. 삭제 SQL은 실행하지 않았다.
- Index 저장 크기와 쓰기 비용은 수치로 측정하지 않았다.
- Partial Index나 `Index Only Scan`은 이번 Lab에서 재현하지 않았다.
- 다음 선택 적용은 기존 `TicketRepository` Port 뒤 PostgreSQL Adapter와 실제 Database Integration Test다.
- Adapter를 시작하기 전 Schema Migration 도구와 Test 격리 방식을 먼저 결정해야 한다.

## 재현 시 주의사항

1. 같은 Database와 Table을 사용하는지 먼저 확인한다.
2. Primary Key Index는 이미 존재하므로 “Index 없음”의 범위를 정확히 적는다.
3. 대량 입력 뒤 `ANALYZE`를 실행한다.
4. Dataset·Query Text·조건값을 유지하고 비교 대상 Index만 바꾼다.
5. `EXPLAIN ANALYZE`는 Query를 실제로 실행한다는 점을 기억한다.
6. Plan은 아래 Scan Node부터 위쪽으로 읽는다.
7. 예상·실제 Row, Filter 제거 Row와 Buffer를 시간보다 먼저 비교한다.
8. 한 번의 실행 시간을 Production 성능으로 일반화하지 않는다.

## 참고 자료

- [PostgreSQL 17 — Indexes](https://www.postgresql.org/docs/17/indexes.html)
- [PostgreSQL 17 — Multicolumn Indexes](https://www.postgresql.org/docs/17/indexes-multicolumn.html)
- [PostgreSQL 17 — Indexes and ORDER BY](https://www.postgresql.org/docs/17/indexes-ordering.html)
- [PostgreSQL 17 — Using EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html)
- [PostgreSQL 17 — Planner Statistics](https://www.postgresql.org/docs/17/planner-stats.html)
- [PostgreSQL Index와 EXPLAIN ANALYZE Learning Note](../study-docs/learning-postgresql-indexes-and-explain-analyze.md)
