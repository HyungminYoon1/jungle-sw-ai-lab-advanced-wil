# Week 6 학습 계획 — Browser·PostgreSQL·Test 수직 마감

> 작성일: 2026-09-21
> 기간: 2026-09-21 ~ 2026-09-27
> 필수 학습일: 2026-09-21 ~ 2026-09-24
> 상태: In Progress
> 모드: `DEEP_LEARNING_MODE`
> 핵심 질문: Browser의 Session 요청이 실제 PostgreSQL 영속성까지 이어지고, 각 계층의 실패를 Test와 Trace로 구분할 수 있는가?

## Context

Week 5에는 Task·Microtask·Timer, 중첩 Microtask, Main Thread Blocking, `requestAnimationFrame`, Promise Executor·Chain·`throw`·`catch`와 기본 `async`·`await` 실행 근거를 확보했다. Fetch 이후 CORS·UI 상태·Event Delegation·XSS·Race·Coverage·Lint·E2E는 완료하지 못했다.

Week 3에는 PostgreSQL Constraint·Transaction·Lock·Index와 Query Plan을 SQL로 학습했지만 Application의 PostgreSQL Repository Adapter, Migration과 Testcontainers Integration Test를 구현하지 않았다. In-memory Test는 실제 PostgreSQL 영속성 근거가 아니다.

Week 6에는 두 미완료 범위를 하나의 수직 흐름으로 연결한다. Comment, 검색, 알림과 Dashboard 같은 수평 기능은 추가하지 않는다.

## 시작 Baseline

2026-09-21 읽기 전용 Source Audit 기준:

| 대상 | 확인 결과 | 상태 |
|---|---|---|
| WIL Repository | `main`, 원격과 같은 Commit, Week 5 Study Note 미커밋 | 기록 정리 필요 |
| Helpdesk Lab | `main`, Working Tree Clean | 확인 |
| PostgreSQL Dependency | JDBC·JPA·PostgreSQL Driver 없음 | `NOT_IMPLEMENTED` |
| Migration | Flyway·Liquibase와 Migration File 없음 | `NOT_IMPLEMENTED` |
| Database Integration | Testcontainers 없음 | `NOT_RUN` |
| Frontend | 정적 Resource와 Browser UI 없음 | `NOT_IMPLEMENTED` |
| Docker·CI | Dockerfile·Compose·GitHub Actions 없음 | Week 8 범위 |
| Java 회귀 | 마지막 공개 근거는 Week 4의 42개 통과 | 이번 주 재실행 전 현재 근거로 확대하지 않음 |

Secret, Credential과 환경 변수 값은 확인하거나 출력하지 않는다. 필요한 경우 존재 여부만 확인한다.

## 완료 목표

### 개념

- `fetch`의 HTTP 오류와 Network 오류를 Promise 상태와 분리해 설명한다.
- CORS Simple Request·Preflight와 허용 Header를 Network Trace로 구분한다.
- Browser Event·Rendering·비동기 상태와 Race를 설명한다.
- Domain Repository Port와 PostgreSQL Adapter의 책임을 구분한다.
- Migration, Constraint, Transaction과 Application 오류 Mapping을 설명한다.
- Unit·Security Integration·Database Integration·Browser E2E의 증명 범위를 구분한다.

### 구현

- Ticket Schema Migration
- PostgreSQL Repository Adapter
- 실제 PostgreSQL Testcontainers Integration Test
- Ticket 생성·조회 최소 Browser UI
- Loading·Success·Not Found·Forbidden·Network Error 표시
- Source에 Credential을 두지 않는 격리된 Local Runtime 사용자·데이터 준비 경로
- Session·Role·CSRF를 유지한 실제 Server 흐름
- Coverage와 정적 분석의 최소 실행 경로

### 검증

- In-memory와 PostgreSQL Repository 계약 비교
- Migration 전후 Schema 재현
- Constraint·Transaction 실패와 Rollback
- Application 재시작 뒤 Ticket 영속성
- Browser → Security → Controller → Application → PostgreSQL Trace
- 대표 Browser E2E 또는 Gate 실패와 정확한 `NOT_RUN` 사유
- Java·JavaScript 회귀 결과

## Adapter 선택 Gate

Spring JDBC와 Spring Data JPA를 동시에 구현하지 않는다. 다음 질문으로 한 구현을 선택하고 이유를 기록한다.

1. 이번 수직 흐름에서 직접 관찰하려는 SQL·Mapping·Transaction 경계는 무엇인가?
2. ORM 관계 Mapping과 N+1을 지금 실제로 재현할 Domain 관계가 있는가?
3. Repository Port를 Framework Annotation과 분리할 수 있는가?
4. Migration과 Testcontainers 실행 근거를 가장 작게 만들 수 있는 선택은 무엇인가?

선택 전 두 Adapter를 모두 생성하지 않는다. 선택 결과는 Decision 또는 Lab Report에 남기며, 다른 방식은 완료한 것으로 표현하지 않는다.

## 9월 21일 — 기록 정리·Fetch·CORS·Persistence 설계

| 순서 | 내용 | 종료 조건 |
|---:|---|---|
| 1 | Week 5 실제 학습 근거와 미실시 범위 확정·Commit | Working Tree와 Commit 범위 설명 |
| 2 | Promise·`async`·`await` 지연 회상 | 원본·후속 Promise와 성공·실패 전달을 자료 없이 설명 |
| 3 | Fetch `2xx`·`404`·Network 실패 비교 | `response.ok` 누락 Case와 Reject Case 실행 |
| 4 | 두 Local Origin CORS Spike | Simple·Preflight·허용 Header를 Console·Network에서 구분 |
| 5 | Ticket Schema·Repository Port와 Adapter 선택 | 선택 이유, Transaction·오류 Mapping과 Test 목록 작성 |

## 9월 22일 — Migration·PostgreSQL Adapter·Integration Test

| 순서 | 내용 | 종료 조건 |
|---:|---|---|
| 1 | PostgreSQL Driver·Migration·Testcontainers 최소 의존성 | 선택 이유와 Version 기록, Clean Build |
| 2 | Ticket Schema Migration | 빈 Database에서 자동 적용, Constraint 확인 |
| 3 | PostgreSQL Repository Adapter | 생성·단건 조회가 실제 SQL로 동작 |
| 4 | Repository Integration Test | 실제 PostgreSQL Container에서 정상·중복·누락·Constraint Case 확인 |
| 5 | Transaction·Rollback Test | 실패 뒤 부분 데이터가 남지 않음을 확인 |
| 6 | In-memory 회귀 | 기존 Application 계약 유지 |

## 9월 23일 — 최소 UI·Event·XSS·Race와 실제 API 연결

| 순서 | 내용 | 종료 조건 |
|---:|---|---|
| 1 | Loading·Success·Not Found·Forbidden·Network Error 상태 표 | 상태와 허용 전이 확정 |
| 2 | Ticket 생성·조회 최소 HTML·CSS·JavaScript | UI 장식 없이 상태가 구분됨 |
| 3 | Event Bubbling·Delegation | 동적 Element와 잘못된 Target Case 실행 |
| 4 | `textContent`와 위험한 HTML 삽입 비교 | 무해한 Marker로 XSS Rendering 경계 설명 |
| 5 | 느린 Response Race와 `AbortController` | 이전 Response가 최신 UI를 덮는 실패와 완화 비교 |
| 6 | 실제 API 연결 | Session·Role·CSRF를 끄지 않고 PostgreSQL 결과 표시 |

## 9월 24일 — Test 품질·E2E·회귀·WIL

| 순서 | 내용 | 종료 조건 |
|---:|---|---|
| 1 | JavaScript 상태·HTTP Mapping Test | 대표 정상·실패 Test 통과 |
| 2 | Coverage 사각지대 실험 | 높은 Line Coverage와 결함 검출이 다름을 재현 |
| 3 | 정적 분석·Lint | Test와 다른 실패를 발견·수정 |
| 4 | Browser Network Trace | Request·Response·Cookie·Status·Timing 기록 |
| 5 | Browser E2E Gate와 대표 흐름 | 실제 Browser·Server·PostgreSQL 여부를 구분한 결과 |
| 6 | Java·JavaScript 전체 회귀 | Test 수·실패·오류·건너뜀과 환경 기록 |
| 7 | Secret·Log·경로 점검 | 공개 문서와 Report에 민감 값·로컬 절대 경로 없음 |
| 8 | Week 5 부분 완료와 Week 6 WIL | 계획 대비 완료·교정·미수행 경계 기록 |

## 실제 Browser E2E Gate

다음 조건을 모두 만족해야 실제 Backend E2E라고 기록한다.

1. Browser가 실제 Spring Server에 요청한다.
2. Security Filter Chain과 CSRF를 비활성화하지 않는다.
3. Test 전용 사용자와 데이터 준비가 Production 설정과 분리된다.
4. Repository는 In-memory가 아니라 실제 PostgreSQL Adapter다.
5. Migration이 빈 Database에 적용된다.
6. Credential 값이 Source·Console·Report에 나타나지 않는다.
7. Test가 Server와 Database를 재현 가능하게 시작·종료한다.

Gate 실패 시 격리 UI Test를 실제 Backend E2E라고 부르지 않는다. 실패 조건과 `NOT_RUN`을 기록하고 Security나 영속성을 우회하지 않는다.

## 수평 확장 비범위

- Comment 등록·조회
- Ticket 검색·Pagination·Dashboard
- Email·알림·파일 업로드
- 관리자 UI와 Design System
- React·SSR·전역 상태 Library
- JWT·OAuth2·분산 Session
- N+1·Connection Pool·Replication 제품 적용
- Docker·AWS 배포 — Week 8에서 현재 수직 흐름을 그대로 배포

## Cut Line

- 일정이 부족하면 UI Style, 추가 화면, 중복 Report와 편의 기능을 먼저 줄인다.
- PostgreSQL Adapter·Migration·실제 Integration Test를 In-memory Test로 대체하지 않는다.
- 실제 Browser E2E Gate를 통과하지 못하면 결과를 `Partially Completed`로 기록한다.
- 9월 24일까지 핵심 수직 흐름이 끝나지 않으면 Week 7 첫 Block에서 미완료 Gate를 먼저 닫되, 선택 학습 항목을 조용히 삭제하지 않는다.
- 완료 여부는 작성한 Code 양이 아니라 설명·정상/실패 재현·Test 또는 Trace 근거로 판정한다.

## 계획 변경 기록

| 날짜 | 변경 | 이유 | 영향 |
|---|---|---|---|
| 2026-09-21 | Week 5 미완료와 Week 3 PostgreSQL Adapter 보류분을 Week 6 한 수직 흐름으로 통합 | 기능 수를 늘리지 않되 선택 기술은 실제 서비스 연결 수준까지 깊게 구현한다는 사용자 결정과 기술 심화 공지 재검토 | AI Native는 Week 7, DevOps·System·AWS·HTTPS는 Week 8로 이동 |

## 공식 자료 Baseline

- PostgreSQL, Spring과 Browser Library의 정확한 Version·설정은 구현 직전 공식 문서에서 확인한다.
- 의존성이나 Cloud 상태처럼 바뀔 수 있는 정보는 기억으로 완료 처리하지 않는다.
- 실제 실행 Command, Test 결과와 환경은 Lab Report에 기록한다.
