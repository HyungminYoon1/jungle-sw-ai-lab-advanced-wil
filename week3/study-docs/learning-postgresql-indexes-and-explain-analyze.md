# Learning Note — PostgreSQL Index와 EXPLAIN ANALYZE

> 작성일: 2026-09-04
> 기준: PostgreSQL 17 공식 문서

## 핵심 질문

> PostgreSQL은 어떤 경우에 Index를 사용하고, `EXPLAIN (ANALYZE, BUFFERS)` 결과에서 그 선택이 실제로 유효했는지 어떻게 판단하는가?

## 학습 목표

이 자료를 학습한 뒤 다음 내용을 자신의 말로 설명하는 것이 목표다.

- Index가 조회를 돕는 별도 자료구조이며 읽기 성능과 쓰기 비용을 함께 만든다는 점을 설명한다.
- PostgreSQL의 기본 Index인 B-Tree가 적합한 비교 조건을 설명한다.
- 조건의 선택 비율과 데이터 분포가 Planner의 선택에 미치는 영향을 설명한다.
- Index가 있어도 Seq Scan이 선택될 수 있는 이유를 설명한다.
- 단일 Index와 복합 Index를 구분하고 복합 Index의 선행 Column이 중요한 이유를 설명한다.
- 독립 명령인 `ANALYZE`와 `EXPLAIN ANALYZE`를 구분한다.
- `EXPLAIN`의 예상치와 `EXPLAIN ANALYZE`의 실제치를 구분한다.
- `cost`, `rows`, `actual time`, `loops`, `Rows Removed by Filter`와 `Buffers`를 기초 수준에서 읽는다.
- 같은 Dataset과 Query를 유지한 채 Index 전후 실행 계획을 비교한다.

개인의 이해 상태와 실제 SQL 실행 결과는 날짜별 Study Note 또는 Lab Report에 기록한다. 이 문서는 특정 날짜의 진도와 독립적으로 다시 읽을 수 있는 개념 자료다.

## 한 문장 설명

Index는 자주 찾는 값과 Row 위치를 별도 구조로 정리해 조회 후보를 줄이고, `EXPLAIN ANALYZE`는 Planner의 예상과 실제 실행 결과를 비교하여 그 Index가 유효했는지 확인하게 하는 도구다.

## Index가 필요한 이유

Index가 없는 Table에서 조건에 맞는 Row를 찾으려면 PostgreSQL은 Table의 Row를 처음부터 끝까지 확인할 수 있다.

```text
Table 전체 확인
→ 각 Row가 WHERE 조건에 맞는지 검사
→ 조건에 맞는 Row 반환
```

이를 **Sequential Scan**, 실행 계획에서는 `Seq Scan`이라고 한다.

Index는 검색 대상 Column의 값과 해당 Table Row를 찾는 데 필요한 위치 정보를 별도로 관리한다. 적합한 Index를 사용하면 전체 Row가 아니라 조건에 맞을 가능성이 높은 범위부터 찾을 수 있다.

```text
Index에서 검색 범위 탐색
→ 후보 Row 위치 확인
→ 필요한 Table Row 접근
→ 결과 반환
```

Index는 원본 Table을 대신하는 저장소가 아니다. 기본적인 Index Scan에서는 Index로 후보 위치를 찾은 뒤 원본 Table의 Row를 다시 확인할 수 있다.

## B-Tree Index

PostgreSQL에서 `USING`을 생략하고 `CREATE INDEX`를 실행하면 기본적으로 B-Tree Index가 만들어진다.

```sql
CREATE INDEX tickets_status_idx
ON tickets (status);
```

B-Tree는 정렬 가능한 값을 순서대로 탐색할 수 있게 구성한다. 대표적으로 다음 조건에 적합하다.

```sql
column = value
column < value
column <= value
column > value
column >= value
column BETWEEN value1 AND value2
column IN (...)
column IS NULL
```

정렬 순서와 맞는 `ORDER BY`에도 도움이 될 수 있다. 그러나 Index가 존재한다는 사실만으로 PostgreSQL이 반드시 그 Index를 사용하는 것은 아니다.

JSONB 포함 검색, 전문 검색이나 공간 데이터처럼 다른 검색 방식에는 GIN·GiST 등 다른 Index가 더 적합할 수 있다. 이 자료의 핵심 범위는 일반적인 동등·범위 검색에 쓰는 B-Tree다.

## Index의 비용

Index는 조회 속도를 위한 무료 기능이 아니다.

| 작업 | Index가 만드는 영향 |
|---|---|
| `SELECT` | 적합한 조건에서는 확인할 후보 Row를 줄일 수 있음 |
| `INSERT` | 새 Row뿐 아니라 관련 Index Entry도 추가해야 함 |
| `UPDATE` | Index 대상 값이 바뀌면 Index도 갱신해야 함 |
| `DELETE` | Table Row와 관련 Index 정리가 필요함 |
| 저장 공간 | Table과 별도로 Index Page를 저장함 |
| 운영 | 사용되지 않거나 중복된 Index도 유지 비용을 발생시킴 |

따라서 “검색에 사용될 수 있는 Column인가?”뿐 아니라 “실제 Query가 자주 사용하고 후보 Row를 충분히 줄이는가?”를 함께 확인해야 한다.

## 선택 비율과 선택도

다음과 같은 `tickets` Table을 가정한다.

```text
전체       100,000건
OPEN        99,000건
RESOLVED     1,000건
```

`status = 'RESOLVED'`는 전체의 1%만 선택한다. Index에서 1,000건의 후보를 찾는 것이 전체 100,000건을 확인하는 것보다 유리할 가능성이 높다.

반대로 `status = 'OPEN'`은 전체의 99%를 선택한다. Index로 99,000개의 위치를 찾고 Table을 다시 방문하는 것보다 Table을 순서대로 읽는 편이 저렴할 수 있다.

```text
희소한 값 조회
→ 후보 Row가 적음
→ Index 사용 가능성이 높음

흔한 값 조회
→ 후보 Row가 대부분임
→ Seq Scan 사용 가능성이 높음
```

실무 자료에서는 “선택도가 높다”라는 표현을 서로 반대 의미로 쓰기도 한다. 혼동을 줄이기 위해 이 자료에서는 다음처럼 수치로 표현한다.

```text
조건의 선택 비율 = 조건에 맞는 Row 수 / 전체 Row 수
```

선택 비율이 낮을수록 후보를 더 강하게 줄이는 조건이다.

## Index가 있어도 Seq Scan을 선택하는 이유

Planner는 “Index가 있는가?”가 아니라 “어떤 실행 방법의 예상 비용이 더 낮은가?”를 판단한다.

Index가 있어도 Seq Scan이 합리적일 수 있는 대표 조건은 다음과 같다.

- Table이 매우 작아 전체를 읽는 비용이 작다.
- 조건에 맞는 Row가 Table의 대부분이다.
- Query가 많은 Column을 반환하여 Table Row 접근이 많이 필요하다.
- 통계가 오래되었거나 데이터 분포를 충분히 반영하지 못한다.
- Index Column에 Query와 맞지 않는 연산이나 표현을 사용한다.
- 순차 접근이 다수의 분산된 Row 접근보다 저렴하다고 Planner가 추정한다.

따라서 실행 계획에서 `Seq Scan`을 발견했다고 바로 실패나 성능 문제로 판단해서는 안 된다. Table 크기, 예상 Row, 실제 Row와 Buffer 사용량을 함께 봐야 한다.

## Planner와 통계

PostgreSQL의 Planner는 실행 전에 여러 실행 방법의 비용을 추정한다. 이를 위해 Table 크기와 Column 값의 분포 같은 통계를 사용한다.

```sql
ANALYZE tickets;
```

독립 명령인 `ANALYZE`는 Query를 실행 계획과 함께 보여 주는 명령이 아니다. Table 데이터를 표본 조사하여 Planner가 사용할 통계를 수집한다.

```text
Table 데이터 변경
→ ANALYZE가 통계 수집
→ Planner가 조건에 맞을 Row 수 추정
→ 예상 비용이 낮은 실행 계획 선택
```

### 대표 통계

Planner가 참고하는 대표 통계는 Table 수준 정보와 Column 수준 정보로 나눌 수 있다.

| 통계 | 확인 위치·Column | 의미 |
|---|---|---|
| 예상 Row 수 | `pg_class.reltuples` | Table에 존재하는 Row 수에 대한 근삿값 |
| Page 수 | `pg_class.relpages` | Table 또는 Index가 차지하는 Disk Page 수에 대한 정보 |
| `NULL` 비율 | `pg_stats.null_frac` | 해당 Column에서 `NULL`인 Row의 비율 |
| 서로 다른 값 수 | `pg_stats.n_distinct` | 고유 값 개수에 대한 추정치 또는 전체 Row 대비 비율 표현 |
| 자주 등장하는 값 | `pg_stats.most_common_vals` | 표본에서 자주 발견된 대표 값 목록 |
| 자주 등장하는 값의 빈도 | `pg_stats.most_common_freqs` | `most_common_vals`의 각 값이 나타나는 비율 |
| 값 분포 경계 | `pg_stats.histogram_bounds` | 자주 등장하는 값을 제외한 나머지 값의 분포를 구간으로 표현 |
| 물리 순서 상관관계 | `pg_stats.correlation` | Column 정렬 순서와 Table의 물리적 Row 순서가 얼마나 비슷한지 나타내는 값 |

`reltuples`와 `relpages`는 정확한 실시간 Count가 아니라 Planner가 비용을 추정하는 데 사용하는 근삿값이다. `n_distinct`가 양수이면 고유 값 개수의 추정값을 나타내고, 음수이면 전체 Row 수에 대한 비율 형태로 저장될 수 있다.

`most_common_vals`와 `most_common_freqs`를 함께 보면 `OPEN`처럼 유난히 자주 등장하는 값이 있는지 판단할 수 있다. `histogram_bounds`는 모든 값을 저장하는 목록이 아니라 값의 분포를 추정하기 위한 경계값이다.

`correlation`이 `1` 또는 `-1`에 가까우면 Column 순서와 물리적 Row 순서 사이의 관계가 강하고, `0`에 가까우면 관계가 약하다. Planner는 이 정보를 Index를 따라 여러 Table Page를 방문할 비용을 추정할 때 참고할 수 있다. 양수·음수는 정렬 방향을 나타내므로 절댓값도 함께 본다.

Table 수준 근삿값은 다음처럼 확인할 수 있다.

```sql
SELECT
    reltuples,
    relpages
FROM pg_class
WHERE oid = 'public.index_lab_tickets'::regclass;
```

Column 수준 통계는 직접 `pg_statistic`을 읽기보다 읽기 쉬운 View인 `pg_stats`에서 확인할 수 있다.

```sql
SELECT
    attname,
    null_frac,
    n_distinct,
    most_common_vals,
    most_common_freqs,
    histogram_bounds,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND tablename = 'index_lab_tickets';
```

이 통계는 Planner의 판단 근거이지 특정 Plan을 강제로 선택하는 설정이 아니다.

일반 운영에서는 Autovacuum이 Auto-analyze도 수행한다. 그러나 학습용 Fixture를 한 번에 대량 삽입한 직후에는 직접 `ANALYZE`를 실행하여 비교 조건을 명확히 하는 편이 좋다.

통계는 최신이어도 정확한 전체 목록이 아니라 표본을 바탕으로 한 추정 정보다. 따라서 예상 Row와 실제 Row가 항상 정확히 같을 필요는 없다. 차이가 지나치게 크다면 통계와 데이터 분포를 점검할 이유가 된다.

## `EXPLAIN`과 `EXPLAIN ANALYZE`

### `EXPLAIN`

```sql
EXPLAIN
SELECT *
FROM tickets
WHERE status = 'RESOLVED';
```

`EXPLAIN`은 Planner가 선택한 **예상 실행 계획**을 보여 준다. 위와 같은 `SELECT`를 실제로 끝까지 실행한 결과가 아니므로 예상 비용과 예상 Row가 중심이다.

### `EXPLAIN ANALYZE`

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM tickets
WHERE status = 'RESOLVED';
```

`ANALYZE` Option이 포함되면 Query를 실제로 실행하고 실제 시간·Row 수와 반복 횟수를 예상치 옆에 표시한다. `BUFFERS`는 실행 과정에서 접근한 Buffer 정보를 추가한다.

```text
EXPLAIN
→ 예상 계획만 확인

EXPLAIN (ANALYZE, BUFFERS)
→ Query 실제 실행
→ 예상과 실제 비교
→ Buffer 접근 확인
```

### 변경 Query 주의

`EXPLAIN ANALYZE`는 Query를 실제로 실행한다. 따라서 다음처럼 변경을 만드는 SQL에 사용하면 실제 데이터도 변경될 수 있다.

```sql
EXPLAIN ANALYZE
DELETE FROM tickets;
```

이 자료의 최소 예제에서는 `SELECT`에만 사용한다. `INSERT`, `UPDATE`, `DELETE`의 계획을 확인해야 한다면 Transaction과 Rollback 가능 범위, Trigger·Sequence·외부 Side Effect를 별도로 검토해야 한다.

## 실행 계획의 기본 구조

다음은 형식을 이해하기 위한 단순 예시다. 숫자와 Plan Node는 실제 환경에 따라 달라진다.

```text
Seq Scan on index_lab_tickets
  (cost=0.00..1986.00 rows=1000 width=30)
  (actual time=0.020..8.500 rows=1000 loops=1)
  Filter: (status = 'RESOLVED'::text)
  Rows Removed by Filter: 99000
  Buffers: shared hit=736
Planning Time: 0.200 ms
Execution Time: 8.700 ms
```

### `cost=startup..total`

```text
cost=0.00..1986.00
```

- 첫 번째 값: 첫 Row를 반환하기 전까지의 예상 Startup Cost
- 두 번째 값: 해당 Plan Node가 모든 Row를 반환할 때의 예상 Total Cost

Cost는 Millisecond가 아니다. Planner가 실행 방법을 비교하기 위해 사용하는 상대적인 비용 단위다.

### `rows`

```text
rows=1000
```

Planner가 해당 Node에서 반환될 것으로 예상한 Row 수다. `EXPLAIN ANALYZE`에서는 실제 `rows`와 비교하여 추정이 데이터 분포를 잘 반영했는지 확인한다.

### `width`

```text
width=30
```

반환 Row 하나의 평균 크기에 대한 예상 Byte 수다. 실제 응답 Body 크기를 정확히 측정한 값은 아니다.

### `actual time`

```text
actual time=0.020..8.500
```

- 첫 번째 값: 실제 첫 Row를 반환하기까지 걸린 시간
- 두 번째 값: 해당 Node가 실행을 마칠 때까지 걸린 시간

`loops`가 1보다 크면 Node의 `actual time`과 `rows`는 Loop당 평균으로 표시될 수 있으므로 전체 작업량을 판단할 때 반복 횟수도 함께 봐야 한다.

### `loops`

```text
loops=1
```

해당 Plan Node가 반복 실행된 횟수다. Join 안쪽 Node처럼 `loops`가 매우 크다면 한 번의 비용이 작아 보여도 전체 작업량이 커질 수 있다.

### `Rows Removed by Filter`

```text
Rows Removed by Filter: 99000
```

Scan으로 읽었지만 `WHERE` 조건에 맞지 않아 제외한 Row 수다. 큰 숫자는 많은 Row를 검사했다는 단서지만, 그것만으로 Index가 반드시 필요하다는 결론을 내리지는 않는다. Table 크기와 반환 비율을 함께 본다.

### `Sort Method`

실행 계획에 명시적인 `Sort` Node가 있다면 `EXPLAIN ANALYZE`는 실제 실행에서 사용한 정렬 방식과 Memory 또는 Disk 사용량을 표시할 수 있다.

```text
Sort Method: top-N heapsort  Memory: 27kB
Sort Method: quicksort       Memory: 71kB
Sort Method: external merge  Disk: ...
```

대표적인 해석은 다음과 같다.

| 출력 | 나타날 수 있는 조건 | 핵심 의미 |
|---|---|---|
| `top-N heapsort` | `LIMIT`으로 정렬 결과 중 소수만 필요함 | 모든 정렬 결과를 보관하지 않고 필요한 상위 N건을 유지할 수 있음 |
| `quicksort` | 전체 정렬 대상이 해당 작업의 Memory 범위에 들어감 | 전체 결과를 Memory 안에서 정렬함 |
| `external merge` | 정렬 대상이 Memory 범위를 넘어 임시 File을 사용함 | `Disk` 사용량과 `work_mem`·입력 Row 수를 함께 점검함 |

`LIMIT`이 있어도 입력이 정렬되어 있지 않다면 `Sort`는 후보 Row를 모두 받아 비교해야 할 수 있다. 반대로 Index가 `ORDER BY`와 맞는 순서를 이미 제공하면 명시적인 `Sort` Node 자체가 사라지고, 상위 `Limit`이 필요한 Row 수에서 Index 탐색을 중단할 수 있다.

Planner는 Query 구조, Index 순서, `LIMIT`과 예상 비용을 바탕으로 `Sort`가 필요한 Plan을 선택한다. Executor는 실제 입력과 Memory 조건에 따라 정렬을 수행하며, `EXPLAIN ANALYZE`의 `Sort Method`는 그 실행 결과다. 일반 SQL에서 개발자가 `quicksort` 같은 내부 정렬 방식을 직접 지정하지는 않는다.

`work_mem`은 System 전체 Memory가 아니라 개별 Sort·Hash 작업이 임시 Disk File을 사용하기 전에 쓸 수 있는 기본 Memory 한도다. 한 Query에 여러 작업이 있거나 여러 Session이 동시에 실행되면 각각 Memory를 사용할 수 있으므로, 단일 출력만 보고 Server 전체 Memory 사용량으로 해석하지 않는다.

### `Buffers`

```text
Buffers: shared hit=736 read=20
```

- `shared`: 일반 Table과 Index가 사용하는 PostgreSQL Shared Buffer 영역에 대한 통계
- `shared hit`: 필요한 Block이 PostgreSQL Shared Buffer에 이미 있어 그곳에서 찾았음
- `shared read`: 필요한 Block이 Shared Buffer에 없어 외부에서 Shared Buffer로 읽어 들였음

접근 경로를 단순화하면 다음과 같다.

```text
Executor가 Block 요청
→ Shared Buffer에서 발견
→ shared hit 증가
```

```text
Executor가 Block 요청
→ Shared Buffer에 없음
→ PostgreSQL이 OS에 Block 읽기 요청
→ OS Page Cache 또는 저장 장치에서 Block 제공
→ Shared Buffer에 적재
→ shared read 증가
```

따라서 `shared read=20`은 **20개 Block을 Shared Buffer로 읽어 들였다**는 뜻이다. 다음 의미로 확대해서 해석하면 안 된다.

- 물리 Disk를 정확히 20번 읽었다.
- OS System Call이 정확히 20번 발생했다.
- Disk I/O 시간이 특정 값만큼 발생했다.

OS Page Cache가 이미 Block을 보유하고 있었다면 실제 저장 장치 접근 없이도 `shared read`가 증가할 수 있다. 여러 Block이 한 번의 I/O 요청으로 처리되거나 Read-ahead가 개입할 수도 있으므로 Block 수와 I/O 호출 횟수는 같지 않다.

`shared hit`도 비용이 0이라는 뜻은 아니다. Block을 Shared Buffer에서 찾은 뒤 Row 확인, 조건 평가와 결과 생성에는 CPU와 Memory 접근 비용이 든다.

Block 수를 Byte 크기로 환산하려면 현재 PostgreSQL의 Block 크기를 확인한다.

```sql
SHOW block_size;
```

Block 크기가 기본값 `8192` Byte라면 `shared read=20`은 약 `160KiB`의 Block을 Shared Buffer로 읽은 것으로 계산할 수 있다. 이는 전송량을 이해하기 위한 크기 환산이며 물리 Disk I/O 횟수나 시간을 뜻하지 않는다.

Buffer 수와 실행 시간은 서로 관련되지만 같은 지표는 아니다. I/O 시간 정보가 필요하다면 `track_io_timing` 설정과 `I/O Timings` 출력도 별도로 확인해야 한다. 이 값 역시 Client Network와 Application 처리 시간까지 측정하지는 않는다.

### Planning Time과 Execution Time

- `Planning Time`: Parser·Planner가 실행 계획을 준비하는 데 사용한 시간
- `Execution Time`: PostgreSQL Executor가 Query를 실행하는 데 사용한 시간

Client와 Server 사이의 Network 전달, Application의 JSON 변환과 화면 Rendering까지 측정하는 값은 아니다.

## 자주 보는 Scan Node

| Plan Node | 기본 의미 | 함께 볼 항목 |
|---|---|---|
| `Seq Scan` | Table을 순서대로 확인 | Table 크기, 반환 비율, Filter 제거 Row |
| `Index Scan` | Index로 위치를 찾고 Table Row 접근 | Index 조건, Heap 접근량 |
| `Bitmap Index Scan` | Index에서 여러 Row 위치를 Bitmap으로 수집 | 보통 `Bitmap Heap Scan`과 함께 확인 |
| `Bitmap Heap Scan` | 모은 위치를 기준으로 Table Page 접근 | Heap Block과 재검사 조건 |
| `Index Only Scan` | 필요한 값이 Index에 있고 조건이 맞으면 Heap 접근을 줄임 | 실제 `Heap Fetches` 여부 |

`Index Only Scan`이라는 이름이 항상 Heap 접근 0회를 보장하는 것은 아니다. Row 가시성 확인을 위해 Heap을 방문할 수 있으므로 `Heap Fetches`를 함께 확인한다.

## 실행 계획은 아래에서 위로 읽는다

실행 계획은 Tree 구조다. 들여쓰기된 하위 Node가 먼저 데이터를 만들고 상위 Node가 그 결과를 처리한다.

```text
Limit
└─ Sort
   └─ Seq Scan
```

이 계획은 다음 순서로 이해한다.

1. `Seq Scan`이 Row를 읽고 조건을 적용한다.
2. `Sort`가 결과를 정렬한다.
3. `Limit`이 필요한 개수만 반환한다.

처음에는 가장 안쪽 Scan Node, 예상·실제 Row 차이, Filter와 Buffer부터 확인한다. 모든 Cost 숫자를 한 번에 암기할 필요는 없다.

## 단일 Index와 복합 Index

### 단일 Index

```sql
CREATE INDEX tickets_status_idx
ON tickets (status);
```

한 Column을 중심으로 검색한다.

### 복합 Index

```sql
CREATE INDEX tickets_status_created_at_idx
ON tickets (status, created_at);
```

여러 Column을 정해진 순서로 함께 정렬한다. 다음 Query처럼 첫 Column은 동등 조건, 다음 Column은 범위 조건인 경우 유용할 수 있다.

```sql
SELECT id, title, status, created_at
FROM tickets
WHERE status = 'RESOLVED'
  AND created_at >= TIMESTAMPTZ '2026-01-01 00:00:00+09';
```

복합 B-Tree Index는 일반적으로 선행 Column에 조건이 있을 때 검색 범위를 가장 효과적으로 줄인다.

```text
Index (status, created_at)

WHERE status = ...
→ 선행 Column을 사용하므로 활용 가능성이 있음

WHERE status = ... AND created_at >= ...
→ status 범위를 먼저 찾고 created_at 범위를 좁힐 수 있음

WHERE created_at >= ...
→ 선행 status 조건이 없어 전체 Index 범위를 크게 줄이기 어려울 수 있음
```

마지막 Query에서 Index를 절대로 사용할 수 없다고 단정해서는 안 된다. Planner는 전체 Index Scan이나 다른 방법의 비용도 비교한다. 핵심은 선행 Column 조건이 있을 때 복합 B-Tree의 탐색 효율이 일반적으로 가장 좋다는 점이다.

“동등 조건 Column을 먼저, 범위 조건 Column을 뒤에 둔다”는 유용한 출발점이지만 절대 법칙은 아니다. 실제 Query 빈도, 데이터 분포, 정렬 조건과 실행 계획으로 검증해야 한다.

## Index 전후 비교 원칙

Index의 효과를 비교할 때는 Index 외의 조건을 가능한 한 동일하게 유지한다.

1. 별도 실습 Table과 고정된 Dataset을 준비한다.
2. 대량 입력 뒤 `ANALYZE`로 통계를 수집한다.
3. Index가 없는 상태에서 Query와 실행 계획을 기록한다.
4. 비교하려는 Index 하나를 생성한다.
5. 같은 SQL과 조건값으로 실행 계획을 다시 기록한다.
6. Plan Node, 예상·실제 Row, Filter 제거 Row와 Buffer를 비교한다.
7. 희소한 값과 흔한 값을 각각 조회하여 선택 비율의 영향을 확인한다.
8. Cache와 반복 실행의 영향을 구분하고 한 번의 시간만으로 일반화하지 않는다.

```text
고정해야 할 것
→ Table 구조
→ Row 수와 값 분포
→ Query Text와 조건값
→ PostgreSQL 설정

변경할 것
→ 비교 대상 Index의 존재 여부
```

Plan Node가 바뀌었는지와 읽은 Row·Buffer가 줄었는지를 먼저 본다. 작은 시간 차이만 보고 “몇 배 빨라졌다”고 결론 내리지 않는다.

## 최소 학습용 Fixture

다음 예제는 개념 설명을 위한 독립 Table이다. 기존 `tickets` 업무 데이터를 변경하지 않는다.

```sql
CREATE TABLE index_lab_tickets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

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
FROM generate_series(1, 100000) AS n;

ANALYZE index_lab_tickets;
```

이 데이터는 약 99%의 `OPEN`과 1%의 `RESOLVED`를 만든다. `id`는 Primary Key이므로 이미 Index가 생긴다. 따라서 Index 유무 비교는 `id`가 아니라 별도 Index가 없는 `status`로 진행한다.

### Index 생성 전 비교 Query

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

### Index 생성

```sql
CREATE INDEX index_lab_tickets_status_idx
ON index_lab_tickets (status);
```

같은 두 Query를 다시 실행한다. 예상되는 핵심은 다음과 같지만 실제 Plan은 환경과 통계에 따라 달라질 수 있다.

```text
RESOLVED 약 1%
→ Index Scan 또는 Bitmap 계열 Scan 가능성이 높음

OPEN 약 99%
→ Index가 있어도 Seq Scan 가능성이 높음
```

실제 Plan이 예상과 다르면 실패가 아니다. 출력의 예상 Row, 실제 Row, Filter와 Buffer를 읽어 Planner가 그 선택을 한 이유를 찾는 것이 실습 목적이다.

## 실패·반례와 자주 발생하는 오해

| 오해·잘못된 사용 | 수정된 이해 |
|---|---|
| Index가 있으면 항상 사용한다. | Planner는 Seq Scan과 Index Scan 등의 예상 비용을 비교한다. |
| Seq Scan은 항상 느리다. | 작은 Table이나 많은 Row를 반환할 때 합리적일 수 있다. |
| Index는 많을수록 좋다. | 저장 공간과 쓰기·관리 비용이 증가한다. |
| `cost`는 Millisecond다. | Planner가 계획을 비교하는 상대 비용 단위다. |
| `EXPLAIN`이 실제 성능을 측정한다. | 실제 실행 결과는 `EXPLAIN ANALYZE`에서 확인한다. |
| 독립 `ANALYZE`와 `EXPLAIN ANALYZE`는 같은 기능이다. | 전자는 통계 수집, 후자는 Query 실제 실행과 계획 측정이다. |
| `Buffers: shared hit`는 Disk에서 읽었다는 뜻이다. | PostgreSQL Shared Buffer에서 찾았다는 뜻이다. |
| `shared read`는 반드시 물리 Disk 읽기다. | Shared Buffer로 읽은 Block이며 OS Cache가 개입할 수 있다. |
| 복합 Index의 뒤 Column만 조회하면 절대로 사용할 수 없다. | 효율이 낮을 수 있지만 실제 선택은 Planner의 비용 판단에 달려 있다. |
| 한 번 더 빨리 실행되면 Index 효과가 증명된다. | Cache·Background 작업이 영향을 주므로 Plan과 작업량을 함께 비교해야 한다. |
| Primary Key에 별도 Index를 또 만들어야 한다. | PostgreSQL은 Primary Key를 위해 Unique B-Tree Index를 자동 생성한다. |

## 대안과 사용 경계

| 선택지 | 적합한 조건 | 비용·위험 |
|---|---|---|
| Index 없음 | 작은 Table, 대부분의 Row를 읽는 Query | Table 증가 시 전체 Scan 비용 증가 |
| 단일 B-Tree | 한 Column의 동등·범위 검색이 자주 사용됨 | 쓰기와 저장 공간 비용 |
| 복합 B-Tree | 여러 Column 조건의 Query 형태가 안정적임 | Column 순서 의존, 중복 Index 위험 |
| 부분 Index | 일부 Row만 반복적으로 조회함 | Query 조건이 Index Predicate와 맞아야 함 |
| 다른 Index 종류 | JSONB, 전문 검색, 공간·시계열 등 특수 검색 | 자료형·연산자와 운영 비용을 별도 학습해야 함 |

이 자료는 단일·복합 B-Tree와 실행 계획 비교까지만 핵심 범위로 삼는다. 부분 Index, GIN·GiST·BRIN과 Index 운영 진단은 실제 Query 필요가 생겼을 때 확장한다.

## 학습 점검 질문

1. Index가 조회를 빠르게 할 수 있으면서도 `INSERT`·`UPDATE` 비용을 늘리는 이유는 무엇인가?
2. `status='OPEN'`이 전체의 99%라면 Index가 있어도 Seq Scan이 선택될 수 있는 이유는 무엇인가?
3. `ANALYZE tickets`와 `EXPLAIN ANALYZE SELECT ...`는 각각 무엇을 수행하는가?
4. `cost=0.00..100.00`이 실행 시간 100ms를 뜻하지 않는 이유는 무엇인가?
5. 예상 `rows`와 실제 `rows`의 차이가 매우 크다면 무엇을 점검해야 하는가?
6. `Rows Removed by Filter`가 많다는 사실만으로 Index를 만들어야 한다고 단정할 수 없는 이유는 무엇인가?
7. `Buffers: shared hit`와 `shared read`는 어떻게 다른가?
8. Index가 생긴 뒤에도 같은 Dataset과 Query를 사용해야 하는 이유는 무엇인가?
9. `(status, created_at)` 복합 B-Tree에서 선행 `status` 조건이 중요한 이유는 무엇인가?
10. 한 번의 실행 시간만으로 성능 향상 비율을 주장하면 안 되는 이유는 무엇인가?
11. `most_common_vals`와 `most_common_freqs`는 `status='OPEN'`의 예상 Row 수를 계산하는 데 어떻게 도움이 되는가?
12. `top-N heapsort`, `quicksort`, `external merge`가 각각 나타날 수 있는 조건은 무엇인가?

## 자료 범위

- 포함: B-Tree, 선택 비율, Planner 통계, 단일·복합 Index, 기본 Plan Node와 `EXPLAIN (ANALYZE, BUFFERS)` 해석
- 포함하지 않음: 실제 학습 실행 결과, JPA Index Annotation, N+1, Connection Pool, GIN·GiST·BRIN 상세, Production 성능 수치

이 자료에는 개인의 이해 상태, 실제 수행 여부, Test·Trace 결과, AI 활용과 다음 일정을 기록하지 않는다. 해당 내용은 날짜별 Study Note 또는 Lab Report에 기록한다.

## 참고 자료

- [PostgreSQL 17 — Indexes](https://www.postgresql.org/docs/17/indexes.html)
- [PostgreSQL 17 — Index Types](https://www.postgresql.org/docs/17/indexes-types.html)
- [PostgreSQL 17 — Multicolumn Indexes](https://www.postgresql.org/docs/17/indexes-multicolumn.html)
- [PostgreSQL 17 — Indexes and ORDER BY](https://www.postgresql.org/docs/17/indexes-ordering.html)
- [PostgreSQL 17 — Using EXPLAIN](https://www.postgresql.org/docs/17/using-explain.html)
- [PostgreSQL 17 — EXPLAIN](https://www.postgresql.org/docs/17/sql-explain.html)
- [PostgreSQL 17 — Planner Statistics](https://www.postgresql.org/docs/17/planner-stats.html)
- [PostgreSQL 17 — ANALYZE](https://www.postgresql.org/docs/17/sql-analyze.html)
- [PostgreSQL 17 — Resource Consumption](https://www.postgresql.org/docs/17/runtime-config-resource.html)
