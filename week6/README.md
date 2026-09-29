# Week 6 — Browser·PostgreSQL·Test 수직 마감

Week 6은 Week 5의 Browser·Frontend·Test 미완료 범위와 Week 3에서 보류한 PostgreSQL Adapter를 한 수직 흐름으로 연결한다.

핵심 목표는 기능 수를 늘리는 것이 아니라 다음 실제 흐름을 검증하는 것이다.

```text
Browser → Session Security → Ticket API → Application → PostgreSQL → Response → UI
```

## 문서

- [Week 6 학습 계획](./weekly-plan.md)
- [Fetch의 HTTP 오류와 CORS 기초](./study-docs/fetch-http-cors-foundations.md)
- [Browser Ticket UI와 Session·CSRF 수직 흐름](./study-docs/browser-ticket-ui-session-csrf-flow.md)
- [Repository Port·PostgreSQL Adapter·Migration·Testcontainers](./study-docs/persistence-port-adapter-migration-testcontainers.md)
- [Spring JDBC와 JPA의 차이와 선택 기준](./study-docs/spring-jdbc-and-jpa-selection-guide.md)

- [9월 22일 Study Questions](./study-notes/2026-09-22-study-questions.md)
- [9월 24일 Study Questions](./study-notes/2026-09-24-study-questions.md)
- [9월 27일 Study Questions](./study-notes/2026-09-27-study-questions.md)
- [9월 28일 Study Questions](./study-notes/2026-09-28-study-questions.md)
- [9월 29일 Study Questions](./study-notes/2026-09-29-study-questions.md)
- [PostgreSQL Migration·Repository Adapter·Testcontainers Lab](./lab-reports/2026-09-22-postgresql-migration-repository-testcontainers-lab.md)
- [Browser·Session·CSRF·PostgreSQL 수직 흐름 Lab](./lab-reports/2026-09-29-browser-session-csrf-postgresql-e2e.md)
- [Coverage와 Assertion 차이 예제](./examples/coverage-oracle-demo.test.mjs)
- [Week 6 WIL](./wil.md)

계획이나 Code 작성만으로 완료 처리하지 않고, 실제 실행 결과와 아직 검증하지 않은 범위를 분리한다.

## 상태

- Week 5: `Partially Completed`
- Week 6 계획: 9월 29일까지 마감 작업을 진행하며, Week 7도 9월 29일부터 시작
- Week 6 실행: `Completed` — Local 구현·검증 Gate, 핵심 개념 독립 재설명, 블로그 게시·포럼 등록 완료
- GitHub Project Week 6 카드 5개: 완료 근거와 미측정 범위를 본문에 정리한 뒤 `Done`으로 변경
- 9월 22일 학습: `Partially Completed` — 실행 근거는 확보했지만 독립 설명과 일부 실패 검증은 9월 23일로 이월
- 9월 24일 학습: `In Progress` — 이월한 개념을 교정하고 Rollback·Context 재생성·CSRF Focused Test 근거 확보
- 9월 27일 학습: `In Progress` — Local Browser 사용자 Focused Test와 실제 Session·CSRF 흐름, CORS Simple GET·Preflight 실패 Trace 확인
- 9월 28일 학습: Credential CORS 허용·거부 Focused Test와 실제 `in-memory` Browser의 `401`·`403`·읽을 수 없는 응답 비교
- 9월 29일 학습: 최소 UI·JavaScript Test·PostgreSQL Browser E2E·품질 Gate 실행, WIL 작성과 블로그·포럼 게시 완료
- Credential CORS: 실패 기준선과 허용 설정을 각각 확인. 실제 Browser의 Cross-Origin `OPTIONS`·`POST 201`과 PostgreSQL Row 추가 검증
- PostgreSQL Adapter 방식: Spring JDBC `IMPLEMENTED`
- Flyway V1 Migration: 실제 PostgreSQL 17.6에서 `APPLIED`
- PostgreSQL Integration Test: 9월 22일 Adapter Baseline 5개, 이후 Rollback·Context 재생성 Focused Test 각 1개 `PASSED`
- 전체 Java Clean Test: 61개 `PASSED`, Failures·Errors·Skipped 0
- Transaction Rollback: 실제 PostgreSQL 17.6 Focused Test 1개 `PASSED`
- Spring Context 재생성 영속성: 같은 JVM·같은 PostgreSQL Container Focused Test 1개 `PASSED`
- `/api/csrf`와 같은 Session의 후속 POST: `in-memory` MockMvc Focused Test 9개 `PASSED`
- 최소 Ticket UI·Event Delegation·Response Race: 구현 및 Node Test 12개 `PASSED`; 실제 Browser의 동적 Button·안전한 Text 표시 확인
- Local Browser Runtime 사용자: Main Source Configuration `IMPLEMENTED`, Configuration·Form Login Focused Test 5개 `PASSED`
- 실제 Browser Session·CSRF Ticket 생성: `in-memory,local-browser`에서 익명 `401`, 인증 뒤 CSRF 없음 `403`, 유효 Token `201`을 `USER_VERIFIED`
- 실제 Browser·Server·PostgreSQL E2E: Local `postgres,local-browser`에서 AGENT 정상·USER `403`·CSRF 없음 `403`·익명 `401`, Cross-Origin POST와 새 Java Process 조회 `PASSED`
- Ticket UI Source Coverage: Line `85.51%`, Branch `77.05%`; 별도 Coverage 사각지대 실험과 ESLint 오류 0 확인
- Week 6 WIL: 블로그 게시·포럼 등록 완료 (사용자 확인). 핵심 흐름의 독립 재설명도 9월 29일 확인
