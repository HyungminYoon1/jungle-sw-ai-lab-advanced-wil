# Week 6 WIL — Browser 요청은 어디까지 도달했는가

> 기간: 2026-09-21 ~ 2026-09-29
> 문서 상태: 블로그 게시·포럼 등록 완료 (사용자 확인)
> 학습 상태: Completed — Local 수직 구현·검증, 핵심 개념 독립 설명 점검 완료.

## 이번 주 요약

이번 주에는 Week 5에서 남은 Browser·JavaScript 범위와 Week 3에서 미뤘던 PostgreSQL Adapter를 하나의 Ticket 생성·조회 흐름으로 연결했다. 화면을 많이 만드는 대신, Browser의 요청이 Session Security, Controller, Application Service, Repository Port와 JDBC Adapter를 지나 실제 PostgreSQL Row에 이르는지 확인했다.

가장 중요한 변화는 “응답을 봤다”를 한 가지 결과로 다루지 않게 된 점이다. `fetch`가 Response를 얻었는지, HTTP Status가 성공인지, Body가 JSON인지, Ticket 구조가 맞는지, 화면에 안전하게 표시됐는지, Database에 Row가 남았는지는 각각 다른 질문이다. Test도 한 종류로 묶지 않고 JavaScript Unit, Security Integration, PostgreSQL Integration, 실제 Browser E2E의 증명 범위를 나눴다.

## 계획 대비 결과

| 범위 | 실행 근거 | 판정 |
|---|---|---|
| Fetch·CORS | `200`·`404`·연결 실패와 허용·거부 Origin, Cookie 없는 Preflight 비교 | Local Browser 실험 완료 |
| PostgreSQL Adapter | Spring JDBC 구현, Flyway V1, 실제 PostgreSQL 17.6 Testcontainers Integration | 실행·Test 통과 |
| Transaction·영속성 | 중간 INSERT 실패 Rollback, Context 재생성, 별도 Java Process 재시작 뒤 같은 DB Row 조회 | 각 범위를 구분해 통과 |
| 최소 Ticket UI | 생성·단건 조회, HTTP 오류, 잘못된 JSON·Ticket, 안전한 문자열 표시, Event Delegation·Race 방어 | 구현·Browser 확인 |
| Session·CSRF·PostgreSQL E2E | 실제 Browser의 AGENT 생성·조회, Cross-Origin Preflight·POST, USER·익명·CSRF 실패 | Local E2E 통과 |
| 품질 Gate | Java 61개·JavaScript 12개 Test 통과, ESLint 오류 0, Coverage 사각지대 실험 | Local 실행 완료 |
| 운영 환경·배포·HTTPS | 이번 주 실행하지 않음 | Week 8 범위 |
| 블로그·포럼 | Week 6 블로그 게시와 포럼 등록을 사용자가 완료 | 완료 |
| 핵심 개념 독립 설명 | Session·CSRF·CORS, Fetch, PostgreSQL Rollback·복원, Response Race와 Test 범위를 자료 없이 재설명 | 완료 |

## Repository Port 뒤의 저장 구현을 교체했다

TicketController와 TicketApplicationService는 구체적인 SQL을 몰라야 한다. 저장 방식 변경을 흡수하는 곳은 `TicketRepository` Port 뒤의 Adapter다. `in-memory` Profile에는 기존 구현을 두고, `postgres` Profile에는 `JdbcTicketRepository`를 연결했다. 빈 Database에는 Flyway V1이 `tickets` Table과 Constraint를 만들었다.

조회에서는 Database Row를 Domain 객체로 복원한다. 이미 `IN_PROGRESS`로 저장된 Row를 `new Ticket(title)`로 새로 만들면 상태가 `OPEN`으로 초기화된다. `Ticket.restore(title, status)`를 사용해 저장된 상태를 유지하되 Domain의 유효성도 확인했다. Database `CHECK`는 현재 저장할 수 있는 Status 값의 목록을 제한하고, `OPEN → IN_PROGRESS → RESOLVED`라는 업무상 변화 순서는 Domain이 지킨다.

Transaction 실험에서는 첫 INSERT 성공 뒤 같은 Transaction의 두 번째 INSERT가 Constraint에 걸려 실패했다. Transaction 밖에서 최종 Row 수가 0인 것을 확인해 첫 INSERT까지 Rollback됐음을 검증했다. Exception이 발생했다는 사실만으로 Rollback을 주장하지 않았다.

## Browser에서는 같은 Status라도 실패 위치를 확인했다

Session Cookie는 Browser가 전송하고 Server는 Session의 인증 정보를 복원한다. 상태를 바꾸는 요청에는 JavaScript가 `/api/csrf`에서 받은 Header 이름과 Token을 직접 붙인다. 같은 인증 사용자라도 CSRF Header 없는 POST는 Security에서 `403`으로 중단되고, 유효한 Header가 있으면 Role 조건을 이어서 검사한다.

Cross-Origin 요청에서 CORS는 Browser JavaScript가 응답을 읽을 수 있는지에 관한 별도 경계다. JSON POST와 CSRF Header가 필요한 경우 Browser는 Cookie 없는 `OPTIONS`를 먼저 보낸다. Preflight가 통과해도 실제 POST의 Session·CSRF·Role 검사까지 통과했다고 뜻하지 않는다. 반대로 Preflight 없는 단순 GET은 Server가 처리했어도, 실제 응답에 CORS 허용 Header가 없으면 JavaScript는 Status조차 읽지 못할 수 있다.

이번 최소 UI는 `401` 로그인 필요, `403` 권한 부족, `404` Ticket 없음과 Response를 읽지 못하는 실패를 구분했다. 다만 일반적인 `403` 응답 하나만으로 CSRF 실패인지 Role 부족인지 단정하지 않는다. 이번 Test에서는 보낸 Header와 사용자 Role을 알고 있어 원인을 분리할 수 있었다.

## JSON이 유효한 것과 Ticket이 유효한 것은 다르다

`response.ok`는 `2xx`만 검사한다. 그다음 `response.json()`이 Body의 JSON 문법을 해석하고, `isTicket(body)`가 ID·제목·상태의 구조와 값까지 확인한다. `200`이면서 HTML Body라면 JSON 단계에서 실패한다. `{"id":1,"title":"","status":"OPEN"}`는 JSON이지만 Ticket 검증에서 실패한다. 이 두 경우 모두 `showTicket`으로 넘어가면 안 된다.

화면에 제목을 넣을 때에는 `textContent`를 사용했다. 실제 Browser에서 Markup처럼 보이는 제목을 생성해도 문자 그대로 표시되고 Element로 만들어지지 않는 것을 확인했다. 동적으로 추가한 Button의 내부 `span`을 클릭했을 때에는 상위 목록의 Event Delegation이 Button을 찾아 Ticket ID를 읽었다.

오래된 응답이 최신 화면을 덮는 Race도 성공 응답에만 한정되지 않는다. Ticket 2의 오류를 표시한 뒤 늦게 온 Ticket 1의 실패가 화면을 다시 바꿀 수 있다. 이전 조회를 `abort()`하고 요청 번호를 증가시키며, 성공·HTTP 오류·JSON 오류·Network 실패 모두에서 현재 번호인지 확인하도록 했다. 이 조건은 [Browser Ticket UI 학습자료](./study-docs/browser-ticket-ui-session-csrf-flow.md)의 예제에도 반영했다.

## Test 수와 Coverage를 의미에 맞게 읽었다

전체 Java Clean Test 61개와 Ticket UI JavaScript Test 12개가 실패·오류·건너뜀 없이 통과했다. 실제 Browser E2E에서는 빈 PostgreSQL Migration, Session·CSRF 생성·조회, Cross-Origin POST, 새 Java Process의 기존 Row 조회, USER 조회 `403`, CSRF 없음 `403`, 익명 조회 `401`을 확인했다.

`ticket-ui.mjs` Source의 Line Coverage는 `85.51%`, Branch Coverage는 `77.05%`였다. Test File까지 합산한 수치를 Product Source의 Coverage라고 하지 않았다. 별도 예제에서는 Line·Branch Coverage가 모두 `100%`여도 약한 Truthy Assertion이 잘못된 `401` Mapping을 놓쳤다. 정확한 기대값 Assertion은 그 결함을 찾았다. ESLint는 실제 Module 오류 0건이었고, 사용하지 않는 변수의 별도 예제에서는 정적 오류를 발견했다. Coverage, Assertion과 Lint는 서로 대체하지 않는다.

## 근거의 끝과 다음 주 경계

이번 새 Process 조회는 Java Application만 종료·재시작하고 같은 PostgreSQL Container를 유지한 실험이다. 같은 JVM 안의 Context 재생성보다 강한 근거지만 PostgreSQL Container·Volume이나 Host 재시작 뒤 복구 증거는 아니다. Local Runtime USER·AGENT는 메모리에만 있고, Ticket은 PostgreSQL에 저장된다. 이 구성을 운영용 인증 저장소로 표현하지 않는다.

Week 7은 9월 29일부터 시작한다. Week 6에는 Local 수직 검증을 마치고 블로그 글을 게시해 포럼에도 등록했다. 마지막 복습에서 Session·CSRF·CORS의 순서, Database Row 복원과 Rollback, 늦은 Response와 Test별 증명 범위를 내 말로 다시 설명했다. 처음에는 사전 `OPTIONS`에도 Cookie가 실린다고 답했지만, 사전 요청과 실제 `POST`를 구분해 바로잡았다. 외부 배포, HTTPS와 운영 안정성은 Week 8에서 현재 흐름을 대상으로 다루고, Comment·검색·Dashboard 같은 수평 확장은 이후로 남긴다.

실행 절차와 한계는 [PostgreSQL Lab](./lab-reports/2026-09-22-postgresql-migration-repository-testcontainers-lab.md)과 [Browser 수직 흐름 Lab](./lab-reports/2026-09-29-browser-session-csrf-postgresql-e2e.md)에 분리해 두었다.
