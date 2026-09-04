# 2026-09-04 — PostgreSQL Index·EXPLAIN ANALYZE 실습

> 작성일: 2026-09-04
> 목적: 고정 Dataset에서 단일·복합 B-Tree Index 전후 실행 계획을 비교하고, PostgreSQL Planner가 선택 비율·정렬·`LIMIT`에 따라 다른 Plan을 선택하는 이유를 설명한다.
> 상태: Completed

---

## 오늘의 질문

> Index가 존재한다는 사실만으로 조회가 빨라지는가? PostgreSQL은 같은 Column의 값과 Query 형태가 달라질 때 왜 `Seq Scan`, 단일 `Index Scan`과 복합 `Index Scan`을 다르게 선택하는가?

## 시작 상태

- 9월 3일까지 Schema·Constraint, Transaction·Atomicity와 두 Session 동시성 실험을 완료했다.
- PostgreSQL Server 17.11과 `ai_helpdesk_learning_lab` Database 연결은 앞선 실험에서 확인했다.
- Index 학습용 Table·Dataset과 `status` Index는 아직 없었다.
- PostgreSQL Repository Adapter·JPA·Migration·Testcontainers는 `NOT_IMPLEMENTED` 상태였다.

## 핵심 개념 점검과 교정

### 독립 `ANALYZE`와 `EXPLAIN ANALYZE`

- 독립 `ANALYZE`: Table 데이터를 표본 조사하여 Planner가 사용할 통계를 갱신한다.
- `EXPLAIN`: Query를 실제로 실행하지 않고 예상 Plan과 비용을 보여 준다.
- `EXPLAIN ANALYZE`: Query를 실제로 실행하여 예상치와 실제 Row·시간을 함께 보여 준다.

`EXPLAIN ANALYZE`를 변경 SQL에 사용하면 실제 변경이 일어날 수 있으므로 이번 실습은 `SELECT`에만 사용했다.

### Planner 통계

100,000건 입력 뒤 `ANALYZE index_lab_tickets`를 실행했다. `status` 통계에서 다음을 확인했다.

```text
null_frac=0
n_distinct=2
most_common_vals={OPEN,RESOLVED}
most_common_freqs={0.9894,0.0106}
```

실제 분포는 `OPEN` 99,000건, `RESOLVED` 1,000건이었다. 통계는 전체 값을 정확히 저장한 목록이 아니라 표본을 이용한 추정치이므로 실제 비율 `0.99`, `0.01`과 조금 달라도 정상이다.

### 희소한 값과 흔한 값

`status` Index가 없을 때 두 조건 모두 642개 Table Block을 읽는 `Seq Scan`이었다.

- `RESOLVED`: 1,000건 반환, 99,000건 Filter 제거
- `OPEN`: 99,000건 반환, 1,000건 Filter 제거

단일 `status` Index를 추가한 뒤 `RESOLVED`는 `Index Scan`으로 바뀌었지만 `OPEN`은 계속 `Seq Scan`이었다. Planner는 Index 존재 여부가 아니라 조건이 선택하는 Row 비율과 예상 비용을 비교한다.

```text
RESOLVED 약 1%
→ Index로 후보를 크게 줄일 수 있음

OPEN 약 99%
→ Index와 Heap을 오가는 것보다 Table 순차 탐색이 유리할 수 있음
```

### Buffer와 물리적 분포

`RESOLVED` Row는 100개마다 한 건씩 입력되어 Table 전체에 고르게 흩어졌다. 단일 `status` Index는 1,000개의 후보 Entry를 바로 찾았지만, 실제 Row가 있는 Heap Block은 Table 전반에 분산되어 있어 실행 Buffer 수가 크게 줄지 않았다.

`Buffers: shared hit=642 read=3`은 물리 Disk를 정확히 세 번 읽었다는 뜻이 아니다. `read=3`은 세 Block을 PostgreSQL Shared Buffer로 읽어 들였다는 뜻이며 OS Page Cache가 개입했을 수 있다.

같은 1,000건이 Table의 연속된 위치에 모였다면 평균 Row 밀도를 기준으로 약 7개 Heap Block에 들어갈 수 있다. 그러나 실제 Node의 Buffer에는 Index와 Heap 접근이 함께 포함될 수 있으므로 전체 `shared hit`가 정확히 7이라고 단정하지 않았다.

### 복합 Index·정렬·`LIMIT`

다음 Query는 `RESOLVED` 필터 외에 최신순 정렬과 20건 제한을 요구했다.

```sql
SELECT id, status, created_at
FROM index_lab_tickets
WHERE status = 'RESOLVED'
ORDER BY created_at DESC
LIMIT 20;
```

단일 `status` Index만 있을 때는 1,000건을 찾고 `top-N heapsort`로 상위 20건을 골랐다.

```text
Index Scan 1,000건
→ Sort
→ Limit 20건
```

`(status, created_at DESC)` 복합 Index를 추가하자 `Sort` Node가 사라졌다. Index가 필요한 순서를 이미 제공하므로 상위 `Limit`은 최신 20건을 받은 시점에 탐색을 중단했다.

```text
복합 Index Scan 20건
→ Limit 20건
```

`Index Scan`의 예상 `rows=1060`은 끝까지 실행할 경우의 예상치이고, 실제 `rows=20`은 통계 오류가 아니라 상위 `Limit`의 조기 종료 결과다.

`LIMIT`을 제거하자 Planner는 복합 Index를 끝까지 읽는 대신 단일 `status` Index로 1,000건을 찾고 `quicksort`로 정렬했다. 복합 Index가 모든 형태의 Query에서 항상 더 우수한 것은 아니다.

### 정렬 방식의 최소 이해

- `top-N heapsort`: `LIMIT`으로 일부 결과만 필요할 때 나타날 수 있다.
- `quicksort`: 전체 정렬 대상이 해당 작업의 Memory 안에 들어갈 때 나타날 수 있다.
- `external merge`: 정렬 대상이 `work_mem`을 넘어 임시 Disk File을 사용할 때 나타날 수 있다.
- Index가 필요한 정렬 순서를 제공하면 명시적인 `Sort` Node가 사라질 수 있다.

이 내용은 실행 계획에 나타난 `Sort Method`를 읽기 위한 보충 범위다. 정렬 알고리즘 내부 구현과 `work_mem` 튜닝은 오늘의 핵심 범위로 확장하지 않았다.

### Index의 쓰기 비용

Index는 Table과 별도의 저장 공간을 차지한다. Ticket을 `INSERT`하거나 Index 대상인 `status`를 변경하면 원본 Table Row뿐 아니라 관련 B-Tree Index Entry와 Page도 추가·삭제·갱신해야 한다.

따라서 Index가 늘어나면 다음 비용도 증가할 수 있다.

- `INSERT`·`UPDATE`·`DELETE` 시 Index 유지 작업
- Index Page를 위한 저장 공간
- Cache와 I/O 사용량
- 사용되지 않거나 중복된 Index의 운영·관리 비용

초기 답변의 “Index Bucket”은 Hash 계열 구조로 오해될 수 있어, 이번 B-Tree 문맥에서는 “Index Entry와 Page”로 교정했다.

## 실행 결과 요약

| Case | 실제 선택·결과 | 근거 상태 |
|---|---|---|
| Index 생성 전 `RESOLVED` | `Seq Scan`, 1,000건 반환·99,000건 제거, `shared hit=642` | `USER_VERIFIED` |
| Index 생성 전 `OPEN` | `Seq Scan`, 99,000건 반환·1,000건 제거, `shared hit=642` | `USER_VERIFIED` |
| 단일 `status` Index 후 `RESOLVED` | `Index Scan`, 실제 1,000건, `shared hit=642 read=3` | `USER_VERIFIED` |
| 단일 `status` Index 후 `OPEN` | Index가 있어도 `Seq Scan`, 실제 99,000건 | `USER_VERIFIED` |
| 단일 Index·정렬·`LIMIT 20` | 1,000건 Index Scan, `top-N heapsort`, 20건 반환 | `USER_VERIFIED` |
| 복합 Index·정렬·`LIMIT 20` | `Sort` 없음, 20건에서 중단, `shared hit=14 read=3` | `USER_VERIFIED` |
| 복합 Index 생성 후 `LIMIT` 없음 | 단일 Index 1,000건과 `quicksort` 선택 | `USER_VERIFIED` |
| Index 쓰기 성능·저장 크기 | 개념상 비용만 설명, 별도 수치 측정 없음 | `NOT_MEASURED` |

세부 Fixture, SQL과 Plan 비교는 [PostgreSQL Index·Query Plan Lab Report](../lab-reports/2026-09-04-postgresql-index-and-query-plan-lab.md)에 분리해 기록했다.

## 실행 주체와 검증 경계

- 사용자 직접 실행: Table·100,000건 Fixture·두 Index 생성, `ANALYZE`, 통계 조회와 `EXPLAIN (ANALYZE, BUFFERS)` 비교
- 사용자 직접 설명: 희소값과 흔한 값의 Scan 선택, 분산된 Heap Row의 Buffer 접근, 복합 Index·`LIMIT` 조기 종료와 Index 쓰기 비용
- Codex 보조: 질문 순서, SQL 절차, Plan 해석과 용어 교정
- 근거 형태: 사용자가 제공한 PostgreSQL `psql` 출력
- Codex 독립 Database 재조회: `NOT_RUN`
- 반복 Benchmark·Cold Cache 통제: `NOT_RUN`
- Index 저장 크기·쓰기 성능 측정: `NOT_MEASURED`
- Java·Maven Test: Application Source·Dependency 변경이 없어 `NOT_RUN`
- Production 성능 검증: `NOT_RUN`

한 번의 실행 시간을 일반적인 성능 향상 비율로 사용하지 않는다. 이번 수치는 로컬 학습용 Dataset과 당시 Cache 상태에서 Plan·작업량을 해석하기 위한 근거다.

## 오늘의 완료 판단

- 완료: 고정된 100,000건 Dataset과 불균등한 상태 분포 구성
- 완료: `ANALYZE` 통계와 실제 Row 분포 비교
- 완료: Index 전후 희소값·흔한 값의 `Seq Scan`·`Index Scan` 선택 비교
- 완료: `cost`, 예상·실제 `rows`, Filter 제거 Row와 Buffer 해석
- 완료: 단일·복합 Index와 `ORDER BY`·`LIMIT`의 Plan 변화 재현
- 완료: 복합 Index가 항상 우수하지 않은 이유 설명
- 완료: Index가 쓰기와 저장 공간에 만드는 비용 설명

9월 4일 종료 조건인 “Seq Scan·Index Scan 선택 이유와 쓰기 비용을 설명할 수 있는가?”를 고정 Dataset의 실제 실행 계획과 함께 확인했으므로 일일 상태는 `Completed`다.

## 다음 학습

1. 9월 6일에 Schema·Transaction·Lock·Index의 핵심 질문을 짧게 복습한다.
2. PostgreSQL Repository Adapter와 실제 Database Integration Test를 선택 적용할지 결정한다.
3. Adapter를 진행한다면 기존 `TicketRepository` Port와 Domain 규칙을 유지한다.
4. JPA N+1과 Connection Pool은 실제 관계 Mapping·연결 측정 조건이 생기지 않으면 `Deferred`로 유지한다.

## 관련 자료

- [PostgreSQL Index와 EXPLAIN ANALYZE](../study-docs/learning-postgresql-indexes-and-explain-analyze.md)
- [PostgreSQL Index·Query Plan Lab Report](../lab-reports/2026-09-04-postgresql-index-and-query-plan-lab.md)
