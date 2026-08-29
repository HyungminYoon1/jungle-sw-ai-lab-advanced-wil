# 2026-08-30 — Week 2 WIL·Week 3 계획 작성 기록

> 작성일: 2026-08-30
> 목적: Week 2의 이해 변화와 검증 범위를 WIL 초안으로 정리하고, Week 3 Database 학습 범위와 월요일 복습 Gate를 확정한다.
> 상태: Completed — WIL 공개 전 초안과 Week 3 주차 안내·학습 계획을 작성했다.

---

## 날짜 기록 기준 교정

Filter·Interceptor 구현과 전체 33개 Clean Test는 8월 29일 야간에 시작해 중단 없이 자정 이후까지 이어진 하나의 학습 세션이다. 달력상 완료 시각은 8월 30일 01시대지만, 학습 맥락을 보존하기 위해 [8월 29일 학습·구현 기록](./2026-08-29-study-questions.md)에 합쳤다.

이 문서에는 그 세션이 끝난 뒤 별도로 수행한 다음 작업만 기록한다.

- Week 2 WIL 공개 전 초안 작성
- Week 3 학습 범위 검토와 주차 계획 작성
- Week 3 월요일 복습 Gate 반영

## Week 2 WIL 초안

`local/blog/wil/2026-08-31-week2-http-request-flow-and-error-boundaries.md`에 공개 전 초안을 작성했다.

초안에는 다음 내용을 담았다.

- HTTP Stateless와 In-memory 저장 상태의 차이
- 구현 전에 작성한 정상·실패 HTTP 계약
- Controller·Application Service·Repository·Domain의 책임
- Validation·Domain 검증과 `ProblemDetail` 오류 경계
- Filter·Interceptor·Exception Handler의 선택 기준
- MockMvc Test와 실제 `curl.exe` Trace가 증명하는 범위
- 자료 없이 즉시 설명하기 어려운 Exception 흐름과 후속 복습

`local/`은 Git 제외 경로이므로 WIL 초안은 WIL Repository Commit에 포함하지 않는다. 8월 31일 공개 전 문체·사실·Link를 다시 확인한 뒤 게시한다.

## Week 3 계획 범위

Week 3의 핵심 질문은 다음과 같다.

> Database의 Transaction과 실행 계획이 Ticket의 일관성과 조회 성능에 어떤 영향을 주는가?

Database 공지에는 정규화, RDB·NoSQL, Index, N+1, Connection Pool, Transaction·격리 수준, Lock·Deadlock, Replication과 Query 최적화가 함께 제시되어 있다. 한 주에 모두 구현하지 않고 다음 세 흐름을 핵심으로 묶었다.

1. Schema·Key·Constraint와 정규화로 데이터 무결성을 보호한다.
2. Transaction·Isolation·Lock으로 실패와 동시 수정에서 일관성을 관찰한다.
3. Index와 `EXPLAIN ANALYZE`로 조회 실행 계획과 비용을 비교한다.

PostgreSQL 영속 Adapter와 Testcontainers Integration Test는 핵심 SQL 실험을 설명한 뒤 수행하는 선택 적용으로 둔다. JPA N+1과 Connection Pool 고갈 실험은 선행 적용이 안정적이고 시간이 남을 때만 진행한다. Replication·Sharding·NoSQL 별도 구현은 이번 주 비범위다.

## 8월 31일 월요일 복습 Gate

Week 3의 첫 학습 Block에서는 새 Database 개념을 시작하기 전에 Week 2의 취약 개념을 짧게 복습한다. 복습은 다음 세 문제로 제한한다.

1. 공백 제목, 잘못된 JSON, 숫자가 아닌 ID와 존재하지 않는 ID의 실패 지점을 구분한다.
2. `TicketNotFoundException`이 Service에서 발생해 `ProblemDetail` Response가 되기까지의 흐름을 자료 없이 설명한다.
3. Request ID, 선택된 Handler 실행 시간과 Application Exception의 HTTP 변환을 각각 Filter·Interceptor·Exception Handler 중 어디에 둘지 이유와 함께 설명한다.

다음 조건을 충족하면 복습을 끝내고 Database 학습으로 이동한다.

- 세 흐름을 Code를 보지 않고 순서대로 설명한다.
- `TicketControllerTest`와 `WebInfrastructureIntegrationTest`가 각각 무엇을 검증하는지 구분한다.
- 필요한 경우 대상 Test만 다시 실행하고, 새 Production 기능은 추가하지 않는다.

복습이 한 Block을 넘기면 남은 이름 암기는 후속 질문으로 기록하고 Week 3 핵심 Database 학습을 시작한다.

## 생성한 Week 3 문서

- [Week 3 주차 안내](../../week3/README.md)
- [Week 3 학습 계획](../../week3/weekly-plan.md)

## AI 활용 경계

- AI 보조: 날짜 기록 경계 검토, Week 3 범위 축소, 일정·완료 조건과 문서 초안 구성
- 직접 판단: 8월 29일 학습 세션의 연속성, 월요일 복습 필요성, Week 3의 학습 우선순위 승인
- 실행하지 않은 항목: PostgreSQL 설치·기동, SQL·JPA Code 작성, Week 3 Test와 Query Plan
