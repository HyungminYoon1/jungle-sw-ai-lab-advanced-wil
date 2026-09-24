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
- [PostgreSQL Migration·Repository Adapter·Testcontainers Lab](./lab-reports/2026-09-22-postgresql-migration-repository-testcontainers-lab.md)

계획이나 Code 작성만으로 완료 처리하지 않고, 실제 실행 결과와 아직 검증하지 않은 범위를 분리한다.

## 상태

- Week 5: `Partially Completed`
- Week 6 계획: `In Progress`
- Week 6 실행: `In Progress` — Fetch·CORS Spike, PostgreSQL Adapter, Rollback·Context 재생성 Focused Test와 MockMvc CSRF Endpoint Test 실행
- 9월 22일 학습: `Partially Completed` — 실행 근거는 확보했지만 독립 설명과 일부 실패 검증은 9월 23일로 이월
- 9월 24일 학습: `In Progress` — 이월한 개념을 교정하고 Rollback·Context 재생성·CSRF Focused Test 근거 확보
- CORS Simple `GET`·JSON `POST` Preflight: `USER_VERIFIED`; Credential 포함 CORS: `NOT_RUN`
- PostgreSQL Adapter 방식: Spring JDBC `IMPLEMENTED`
- Flyway V1 Migration: 실제 PostgreSQL 17.6에서 `APPLIED`
- PostgreSQL Integration Test: 5개 `PASSED`
- 9월 22일 전체 Java Clean Test 기준선: 49개 `PASSED`; 9월 24일 현재 변경 포함 전체 Clean Test: 53개 `PASSED`
- Transaction Rollback: 실제 PostgreSQL 17.6 Focused Test 1개 `PASSED`
- Spring Context 재생성 영속성: 같은 JVM·같은 PostgreSQL Container Focused Test 1개 `PASSED`
- `/api/csrf`와 같은 Session의 후속 POST: `in-memory` MockMvc Focused Test 9개 `PASSED`
- 최소 Ticket UI·Event Delegation·Response Race: `NOT_IMPLEMENTED` / `NOT_RUN`
- Local Browser Runtime 사용자: 책임과 Profile 조합만 확정, `NOT_IMPLEMENTED`
- 실제 Browser·Server·PostgreSQL E2E: `NOT_RUN`
