# Week 6 학습 계획 — Browser·PostgreSQL·Test 수직 마감

> 작성일: 2026-09-21
> 최종 수정일: 2026-09-22
> 기간: 2026-09-21 ~ 2026-09-27
> 집중 학습일: 2026-09-22 ~ 2026-09-24
> 문서 상태: Ready
> 실행 상태: Not Started — 계획과 Source Audit은 학습·구현 완료 근거가 아님
> 권장 학습 예산: 총 27시간 30분 — 실제 시간은 별도 기록하고 계획 시간을 수행 시간으로 대체하지 않음
> 모드: `DEEP_LEARNING_MODE`
> 핵심 질문: Browser의 Session 요청이 실제 PostgreSQL 영속성까지 이어지고, 각 계층의 실패를 Test와 Trace로 구분할 수 있는가?

## Context

Week 5에는 Task·Microtask·Timer, 중첩 Microtask, Main Thread Blocking, `requestAnimationFrame`, Promise Executor·Chain·`throw`·`catch`와 기본 `async`·`await` 실행 근거를 확보했다. Fetch 이후 CORS·UI 상태·Event Delegation·XSS·Race·Coverage·Lint·E2E는 완료하지 못했다.

Week 3에는 PostgreSQL Constraint·Transaction·Lock·Index와 Query Plan을 SQL로 학습했지만 Application의 PostgreSQL Repository Adapter, Migration과 Testcontainers Integration Test를 구현하지 않았다. In-memory Test는 실제 PostgreSQL 영속성 근거가 아니다.

Week 6에는 두 미완료 범위를 하나의 수직 흐름으로 연결한다. Comment, 검색, 알림과 Dashboard 같은 수평 기능은 추가하지 않는다.

## Week 5 미완료 범위의 Week 6 이월

Week 5에서 실행하지 못한 항목은 완료로 바꾸지 않고 다음 실행 위치와 GitHub Project 카드에 연결했다. PostgreSQL 항목은 Week 3에서 개념 학습 뒤 보류한 Application 적용 범위다.

| 이전 상태 | Week 6 실행 위치 | GitHub Project 카드 | 시작 상태 |
|---|---|---|---|
| Fetch HTTP 오류·Network 실패 `NOT_RUN` | 9월 22일 Fetch 비교 | Fetch·CORS와 Persistence 설계 | `Ready` |
| CORS·Preflight·Network Trace `NOT_RUN` | 9월 22일 두 Origin Spike | Fetch·CORS와 Persistence 설계 | `Ready` |
| PostgreSQL Adapter·Migration·Integration Test `NOT_IMPLEMENTED` / `NOT_RUN` | 9월 22~23일 실제 PostgreSQL 수직 Slice | PostgreSQL Migration·Repository Adapter·Integration Test | `Backlog` |
| UI 상태·Event Delegation·XSS·Race `NOT_RUN` | 9월 23~24일 최소 Ticket UI | 최소 Ticket UI·Event·XSS·Response Race | `Backlog` |
| 실제 API·Session·CSRF·PostgreSQL Browser E2E `NOT_RUN` | 9월 24일 실제 연결 | Session·CSRF·PostgreSQL 실제 Browser E2E | `Backlog` |
| Coverage·Lint·Test 계층·전체 회귀 `NOT_RUN` | 9월 24일 품질 Gate | Coverage·Lint·전체 회귀와 WIL 마감 | `Backlog` |

Week 5의 Event Loop·Rendering·Promise 학습과 WIL·포럼 제출 카드는 `Done`이다. 이는 수행한 범위의 기록·공개가 끝났다는 뜻이며, 위 이월 항목까지 Week 5에서 완료했다는 의미가 아니다.

## 이번 주 핵심 질문

1. `fetch`의 HTTP `404`와 Network 실패는 Promise 상태와 UI 상태에서 어떻게 다른가?
2. CORS는 Browser가 어느 응답을 읽지 못하게 막으며, Simple Request와 Preflight는 무엇이 다른가?
3. Domain Repository Port와 PostgreSQL Adapter는 각각 어떤 책임을 가지는가?
4. Migration은 수동 DDL과 달리 Schema를 어떻게 재현하고 Version을 관리하는가?
5. In-memory Test가 통과해도 실제 PostgreSQL Integration Test가 필요한 이유는 무엇인가?
6. Browser의 Session·CSRF 요청은 Security와 Application을 거쳐 실제 PostgreSQL까지 어떻게 이어지는가?
7. Unit·Security Integration·Database Integration·Browser E2E는 각각 무엇을 증명하고 무엇을 증명하지 못하는가?

## 시작 Baseline

2026-09-21 읽기 전용 Source Audit 기준:

| 대상 | 확인 결과 | 상태 |
|---|---|---|
| Week 5 Study Note | 핵심 질문·개념·오개념 교정 중심으로 재작성해 `b9aa942`에 Commit | 완료 |
| Helpdesk Lab | `main`, Working Tree Clean | 확인 |
| PostgreSQL Dependency | JDBC·JPA·PostgreSQL Driver 없음 | `NOT_IMPLEMENTED` |
| Migration | Flyway·Liquibase와 Migration File 없음 | `NOT_IMPLEMENTED` |
| Database Integration | Testcontainers 없음 | `NOT_RUN` |
| Frontend | 정적 Resource와 Browser UI 없음 | `NOT_IMPLEMENTED` |
| Docker·CI | Dockerfile·Compose·GitHub Actions 없음 | Week 8 범위 |
| Java 회귀 | 마지막 공개 근거는 Week 4의 42개 통과 | 이번 주 재실행 전 현재 근거로 확대하지 않음 |

Secret, Credential과 환경 변수 값은 확인하거나 출력하지 않는다. 필요한 경우 존재 여부만 확인한다.

## 학습 진행 원칙

1. 각 Block을 시작할 때 관련 핵심 질문에 먼저 답하고 예상 결과를 적는다.
2. 공식 자료와 최소 Spike로 개념을 확인한 뒤 Helpdesk Lab에 적용한다.
3. 정상 흐름만 실행하지 않고 대표 실패를 먼저 재현해 원인을 설명한다.
4. 작성한 Code를 완료 근거로 삼지 않고 Test·SQL·Network Trace와 재시작 결과를 확인한다.
5. Study Note는 대화 로그가 아니라 핵심 개념, 처음의 오해와 수정된 이해를 1인칭으로 정리한다.
6. WIL 문서 변경과 Helpdesk Lab 구현은 서로 다른 Repository와 Commit으로 분리한다.

## 바로 사용할 학습 자료

- Promise 회상: [JavaScript Promise와 Async/Await 기초](../week5/study-docs/javascript-promise-async-await-basics.md)
- Event Loop 회상: [Browser JavaScript Event Loop 입문](../week5/study-docs/browser-javascript-event-loop-basics.md)
- 9월 22일 Fetch·CORS: [Fetch의 HTTP 오류와 CORS 기초](./study-docs/fetch-http-cors-foundations.md)
- 9월 22~23일 Persistence: [Repository Port·PostgreSQL Adapter·Migration·Testcontainers](./study-docs/persistence-port-adapter-migration-testcontainers.md)

자료 작성은 실행 근거가 아니다. 실행 전 예상, 실제 Console·Network·Test 결과와 설명을 날짜별 Study Note와 Lab Report에 구분해 남긴다.

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

현재 Source Baseline에서는 Spring JDBC를 우선 후보로 둔다. Week 3에서 학습한 SQL·Constraint·Transaction과 Row Mapping을 직접 관찰할 수 있고, 현재 Domain에는 ORM 관계 Mapping과 N+1을 재현할 관계가 없기 때문이다. 다만 9월 22일 Gate에서 이 가정을 검토한 뒤 최종 선택한다.

## 9월 21일 — 미실시

예정했던 Fetch·CORS·Persistence 설계 학습은 실시하지 않았다. 계획 시간을 실제 수행 시간으로 기록하지 않으며, 범위를 삭제하지 않고 9월 22~24일 일정에 재배치한다.

## 9월 22일 — Fetch·CORS·Persistence 설계·Migration·Adapter

권장 순학습 시간: 10시간 30분

| 순서 | 시간 | 내용 | 종료 조건 |
|---:|---:|---|---|
| 1 | 30분 | Promise·`async`·`await` 지연 회상 | 원본·후속 Promise와 성공·실패 전달을 자료 없이 설명 |
| 2 | 90분 | Fetch `2xx`·`404`·Network 실패 학습·실험 | `response.ok` 누락 Case와 Reject Case를 예상한 뒤 실행 |
| 3 | 120분 | 두 Local Origin CORS Spike | Simple·Preflight·허용 Header를 Console·Network에서 구분 |
| 4 | 120분 | Ticket Schema·Repository Port·Local Runtime Fixture와 Adapter 선택 | 선택 이유, Transaction·오류 Mapping과 Test 목록 작성 |
| 5 | 45분 | PostgreSQL Driver·Migration·Testcontainers 최소 의존성 | 선택 이유와 Version 기록, Clean Build |
| 6 | 75분 | Ticket Schema Migration | 빈 Database에서 자동 적용, Constraint 확인 |
| 7 | 120분 | PostgreSQL Repository Adapter | 생성·단건 조회 SQL과 Row Mapping 구현, Integration Test 전 상태로 구분 |
| 8 | 30분 | 핵심 질문 재설명과 Study Note | 첫 답변에서 바뀐 이해와 실행 근거 정리 |

위 시간은 휴식을 제외한 순학습 시간이다. 긴 Block 사이의 휴식과 식사 시간은 별도로 확보한다.

## 9월 23일 — PostgreSQL Integration Test와 최소 UI

권장 순학습 시간: 5시간 30분 — 6시간 가용 범위 안에 휴식 여유 포함

| 순서 | 시간 | 내용 | 종료 조건 |
|---:|---:|---|---|
| 1 | 105분 | Repository Integration Test | 실제 PostgreSQL Container에서 정상·누락·Constraint Case 확인 |
| 2 | 45분 | Transaction·Rollback Test | 실패 뒤 부분 데이터가 남지 않음을 확인 |
| 3 | 30분 | Loading·Success·Not Found·Forbidden·Network Error 상태 표 | 상태와 허용 전이 확정 |
| 4 | 105분 | Ticket 생성·조회 최소 HTML·CSS·JavaScript | UI 장식 없이 상태가 구분됨 |
| 5 | 45분 | Event Bubbling·Delegation | 동적 Element와 잘못된 Target Case 실행 |

위 시간은 휴식을 제외한 최대 순학습 시간이다. Database Integration 근거를 확보하지 못하면 최소 UI를 먼저 구현해 완료한 것처럼 처리하지 않고, 남은 실행 범위를 24일 첫 Block으로 명시적으로 넘긴다.

## 9월 24일 — XSS·Race·실제 API·Test 품질·E2E·회귀·WIL

권장 순학습 시간: 11시간 30분

| 순서 | 시간 | 내용 | 종료 조건 |
|---:|---:|---|---|
| 1 | 30분 | In-memory 회귀와 Database 학습 정리 | 기존 Application 계약 유지, 두 Adapter 근거 구분 |
| 2 | 45분 | `textContent`와 위험한 HTML 삽입 비교 | 무해한 Marker로 XSS Rendering 경계 설명 |
| 3 | 60분 | 느린 Response Race와 `AbortController` | 이전 Response가 최신 UI를 덮는 실패와 완화 비교 |
| 4 | 105분 | 실제 API 연결 | Session·Role·CSRF를 끄지 않고 PostgreSQL 결과 표시 |
| 5 | 30분 | UI·API 핵심 질문 재설명과 Study Note | DOM·Network·Security·Database 흐름을 자신의 말로 연결 |
| 6 | 60분 | JavaScript 상태·HTTP Mapping Test | 대표 정상·실패 Test 통과 |
| 7 | 45분 | Coverage 사각지대 실험 | 높은 Line Coverage와 결함 검출이 다름을 재현 |
| 8 | 45분 | 정적 분석·Lint | Test와 다른 실패를 발견·수정 |
| 9 | 120분 | Browser Network Trace·E2E Gate와 대표 흐름 | 실제 Browser·Server·Security·PostgreSQL 연결 결과 확보 |
| 10 | 60분 | Java·JavaScript 전체 회귀 | Test 수·실패·오류·건너뜀과 환경 기록 |
| 11 | 30분 | Secret·Log·경로 점검 | 공개 문서와 Report에 민감 값·로컬 절대 경로 없음 |
| 12 | 60분 | Week 6 WIL과 최종 재설명 | 계획 대비 완료·교정·미수행 경계와 핵심 질문 답변 기록 |

위 시간은 휴식을 제외한 순학습 시간이다. 작성한 Code 양 때문에 WIL 시간을 줄이지 않고, 미검증 항목은 그대로 `NOT_RUN` 또는 `Partially Completed`로 남긴다.

## 산출물과 Commit 경계

- `week6/study-notes/`: 날짜별 핵심 질문, 처음의 이해와 수정된 개념
- `week6/lab-reports/`: PostgreSQL·Browser 수직 흐름의 재현 절차와 실행 결과
- `week6/wil.md`: 주간 이해 변화, 실제 완료·부분 완료·미수행 경계
- Helpdesk Lab: Migration·Adapter·Integration Test와 UI·E2E Source
- WIL Repository와 Helpdesk Lab 변경은 Repository별로 분리해 Commit한다.
- 외부 블로그 게시, 포럼 등록과 Push는 별도 요청 없이 수행하지 않는다.

## GitHub Project 실행 순서

| 순서 | 카드 | 상태 | 상태 변경 조건 |
|---:|---|---|---|
| 1 | Fetch·CORS와 Persistence 설계 | `Ready` | 실제 첫 예상·실험을 시작할 때 `In progress` |
| 2 | PostgreSQL Migration·Repository Adapter·Integration Test | `Backlog` | Adapter 선택과 Test 목록 확정 뒤 `Ready` |
| 3 | 최소 Ticket UI·Event·XSS·Response Race | `Backlog` | PostgreSQL 생성·조회 계약 확보 뒤 `Ready` |
| 4 | Session·CSRF·PostgreSQL 실제 Browser E2E | `Backlog` | 실제 Adapter·Migration·UI가 연결된 뒤 `Ready` |
| 5 | Coverage·Lint·전체 회귀와 WIL 마감 | `Backlog` | 대표 수직 흐름의 정상·실패 근거 확보 뒤 `Ready` |

계획 문서와 Project 카드 생성만으로 실행 상태를 `In Progress`로 올리지 않는다. 각 카드의 첫 실제 학습·구현 근거가 생길 때 상태를 변경한다.

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
| 2026-09-21 | `In Progress` 초안을 실행 전 `Ready` 계획으로 구분하고 9월 21~24일에 27시간 30분을 배정 | 계획 작성과 학습·구현 완료를 혼동하지 않고, 선택 범위를 줄이지 않은 실행 순서를 명확히 하기 위함 | 실제 첫 학습·실험 근거가 생길 때만 실행 상태를 `In Progress`로 변경 |
| 2026-09-21 | Week 5 이월 항목과 Week 6 Project 카드의 1:1 실행 위치를 기록 | 미완료 항목을 조용히 삭제하거나 중복 카드로 관리하지 않기 위함 | 첫 카드만 `Ready`, 선행 조건이 필요한 네 카드는 `Backlog` |
| 2026-09-22 | 9월 21일 미실시 범위를 9월 22~24일에 재배치 | 수행하지 않은 계획을 완료로 기록하지 않고 선택한 학습 범위를 유지하기 위함 | 총 27시간 30분과 완료 목표는 유지하고, 22일 8시간 30분·23일 9시간 45분·24일 9시간 15분의 순학습 일정으로 변경 |
| 2026-09-22 | 9월 23일 가용시간을 6시간 이하로 제한하고 Adapter는 22일, XSS·Race와 In-memory 회귀는 24일로 이동 | 제한된 날에 Integration Test와 최소 UI의 선행관계에 집중하고 학습 범위를 삭제하지 않기 위함 | 총 27시간 30분은 유지하고, 22일 10시간 30분·23일 5시간 30분·24일 11시간 30분의 순학습 일정으로 조정 |

## 공식 자료 Baseline

- PostgreSQL, Spring과 Browser Library의 정확한 Version·설정은 구현 직전 공식 문서에서 확인한다.
- 의존성이나 Cloud 상태처럼 바뀔 수 있는 정보는 기억으로 완료 처리하지 않는다.
- 실제 실행 Command, Test 결과와 환경은 Lab Report에 기록한다.
