# 2026-09-22 Study Questions — Fetch·CORS와 PostgreSQL Adapter

> 상태: Partially Completed — 실행 근거는 확보했지만 일부 개념의 독립 설명과 실패 검증은 9월 23일로 이월
> 실행 환경: Local Node HTTP Server와 실제 Browser
> 근거 범위: Fetch·CORS 실행 비교, Spring JDBC Adapter·Flyway Migration과 실제 PostgreSQL Testcontainers Integration Test
> 9월 23일 이월: `Optional.empty()` 흐름, Credential 포함 CORS와 Security의 `OPTIONS` 처리, UI 오류 Mapping·JSON 형식 검증, Transaction Rollback·Application 재시작 뒤 영속성
> 후속 범위: 실제 Browser·Security·PostgreSQL E2E

## 오늘 이해한 핵심 흐름

HTTP 요청의 결과를 하나의 성공·실패로만 보지 않고 다음 단계로 나누어 이해했다.

```text
Network에서 Response를 얻었는가?
        ↓
HTTP Status가 무엇인가?
        ↓
Body를 기대한 형식으로 해석할 수 있는가?
        ↓
그 결과를 어떤 UI 상태로 표시할 것인가?
```

`fetch()`는 Ticket을 바로 반환하지 않고 `Promise<Response>`를 반환한다. 호출 직후 Promise는 `pending`이며, Browser가 JavaScript에 전달할 Response를 얻으면 `fulfilled`, Response를 얻지 못했다고 판단하면 `rejected`가 된다.

HTTP `404`는 Server가 보낸 Response이므로 Fetch Promise가 `fulfilled`될 수 있다. 반면 Server에 연결할 수 없는 경우에는 Response와 HTTP Status가 없으며 Promise가 `rejected`된다.

## 실제 Browser에서 확인한 결과

| 요청 | Response | Fetch Promise | Status·`ok` | Body 처리 | 최종 UI |
|---|---|---|---|---|---|
| 존재하는 Ticket | 있음 | `fulfilled` | `200`·`true` | JSON 해석 성공 | `showTicket(ticket)` |
| 존재하지 않는 Ticket | 있음 | `fulfilled` | `404`·`false` | 404 분기의 `return`으로 미실행 | `showNotFound()` |
| Server가 없는 Port | 없음 | `rejected` | 없음 | 실행할 Response Body 없음 | `showNetworkError(error)` |
| CORS 미허용 Cross-Origin `GET` | JavaScript에는 없음 | `rejected` | JavaScript에는 없음 | 실행할 수 없음 | `showNetworkError(error)` |
| CORS 허용 Cross-Origin `GET` | 있음 | `fulfilled` | `200`·`true` | JSON 해석 성공 | `showTicket(ticket)` |
| Preflight 거부 JSON `POST` | JavaScript에는 없음 | `rejected` | JavaScript에는 없음 | 실행할 수 없음 | `showNetworkError(error)` |
| Preflight 허용 JSON `POST` | 있음 | `fulfilled` | `201`·`true` | JSON 해석 성공 | `showTicket(ticket)` |

`404` 요청에서도 현재 Page는 이동하지 않았다. API를 `fetch`한 결과는 JavaScript에 전달되며, Frontend가 `showNotFound()` 같은 Code로 UI를 변경해야 한다.

이번 404 Response에는 JSON 오류 Body가 있었지만 현재 Code는 Status 분기에서 종료했으므로 Body를 읽지 않았다. Server의 오류 Message를 사용하려면 404 분기에서 `response.json()`을 별도로 호출하고, 오류 Body 자체가 잘못된 경우도 처리해야 한다.

## 처음 이해에서 교정한 점

### 연결 실패 뒤 Promise 상태

처음에는 Server 연결 실패 뒤 Fetch Promise의 최종 상태를 `pending`이라고 답했다. `pending`은 Browser가 결과를 기다리는 중간 상태다. 연결 실패가 확정되면 최종 상태는 `rejected`이고, `await`는 실패 이유를 발생시켜 `catch`로 이동한다.

```text
fetch 호출 직후
→ pending

연결 실패 확인 뒤
→ rejected
→ catch
```

### Network Error에서 실행된 UI 함수

처음에는 연결 실패 Case의 마지막 UI 함수가 없다고 답했다. 실제 UI에 `Network Error — TypeError`가 표시된 것은 `catch` 안의 `showNetworkError(error)`가 실행됐기 때문이다.

`TypeError`는 HTTP Status가 아니다. 이번 실험에서는 Browser가 사용할 Response를 얻지 못해 Fetch Promise가 거부됐을 때 전달된 JavaScript Error의 이름이다.

## 현재 설명할 수 있는 것

```text
HTTP 404
→ Response 있음
→ Fetch Promise fulfilled
→ status=404, ok=false
→ Frontend의 Not Found 분기

연결 실패
→ Response 없음
→ Fetch Promise rejected
→ status와 ok 없음
→ catch의 Network Error 분기
```

`response.json()`은 Fetch Promise와 별개의 Promise를 반환한다. `200` Response를 받았더라도 JSON 문법이 잘못되면 Body 해석 단계에서 다시 실패할 수 있다.

## Cross-Origin Simple GET 비교

Page Origin은 `http://127.0.0.1:4173`이고 비교 API Origin은 `http://127.0.0.1:4174`였다. Scheme과 Host가 같아도 Port가 다르므로 서로 다른 Origin이다.

CORS 미허용 요청에서도 `4174` Server Log에 다음 요청이 남았고 Server는 `200`을 반환했다.

```text
GET /api/cors-blocked
```

하지만 Response에 `Access-Control-Allow-Origin` Header가 없었기 때문에 Browser가 Response를 JavaScript에 공개하지 않았다. 따라서 JavaScript에서 Response와 Status를 확인할 수 없었고 Fetch Promise는 `rejected`되어 `showNetworkError(error)`가 실행됐다.

CORS 허용 요청에서는 Server가 Page Origin을 다음 Response Header로 명시했다.

```http
Access-Control-Allow-Origin: http://127.0.0.1:4173
```

그 결과 JavaScript가 `200` Response를 받았고 JSON을 해석한 뒤 `showTicket(ticket)`을 실행했다.

두 요청의 Server Log에는 `OPTIONS` 없이 `GET`만 기록됐다. 이번 요청은 Simple Cross-Origin `GET`이어서 Preflight를 거치지 않고 본 요청이 먼저 전송됐다.

```text
CORS 미허용
→ Server는 GET을 받고 200 응답
→ Browser가 JavaScript의 Response 접근 차단
→ Fetch rejected

CORS 허용
→ Server는 GET을 받고 200 응답
→ Browser가 JavaScript에 Response 공개
→ Fetch fulfilled
```

연결 실패와 CORS 실패는 JavaScript에서 모두 `TypeError`와 Fetch 거부로 보일 수 있다. 둘을 구분하려면 `catch`만 보지 않고 Browser Console·Network 기록과 Server 요청 Log를 함께 확인해야 한다.

## JSON POST Preflight 비교

Cross-Origin JSON `POST`에는 `Content-Type: application/json`이 포함됐다. 이 Content Type은 CORS 안전 목록에 포함되지 않으므로 Browser가 본 요청보다 먼저 `OPTIONS` Preflight를 자동으로 보냈다.

거부 Case의 Server Log에는 다음 두 줄만 기록됐다.

```text
[Cross-Origin API] OPTIONS /api/preflight-blocked
[Preflight] origin=http://127.0.0.1:4173, method=POST, headers=content-type
```

Server가 `204`로 응답했어도 필요한 CORS 허용 Header를 보내지 않았으므로 Browser는 실제 `POST`를 전송하지 않았다. 따라서 Ticket 생성 Handler도 실행되지 않았고 Fetch Promise는 `rejected`됐다. Preflight의 HTTP 성공 Status만으로는 Cross-Origin 본 요청이 허용됐다고 볼 수 없다.

허용 Case의 Server는 `OPTIONS` Response에 다음 정보를 포함했다.

```http
Access-Control-Allow-Origin: http://127.0.0.1:4173
Access-Control-Allow-Methods: POST
Access-Control-Allow-Headers: Content-Type
```

Browser가 이를 확인한 뒤 실제 `POST`를 보냈고 Server Log에는 다음 순서가 남았다.

```text
[Cross-Origin API] OPTIONS /api/preflight-allowed
[Preflight] origin=http://127.0.0.1:4173, method=POST, headers=content-type
[Cross-Origin API] POST /api/preflight-allowed
[Ticket Create] allowed route POST handler executed
```

실제 `POST` Response에도 `Access-Control-Allow-Origin`이 포함됐기 때문에 Browser가 `201` Response를 JavaScript에 공개했다. JavaScript는 JSON을 해석하고 `showTicket(ticket)`을 실행했다.

Preflight와 실제 Response의 CORS 검사는 역할이 다르다. Preflight Response는 Browser가 본 요청을 보내도 되는지 결정하는 근거이고, 실제 Response의 CORS Header는 그 응답을 JavaScript에 공개해도 되는지 결정하는 근거다. Preflight를 통과해 실제 `POST`와 상태 변경이 실행됐더라도, 실제 Response의 `Access-Control-Allow-Origin`이 누락되거나 맞지 않으면 Browser는 그 Response를 JavaScript에 공개하지 않고 Fetch를 실패로 처리할 수 있다.

```text
Preflight 거부
→ OPTIONS만 Server 도달
→ 실제 POST와 Business Handler 미실행
→ Fetch rejected

Preflight 허용
→ OPTIONS 허용 확인
→ 실제 POST 도달
→ Business Handler 실행
→ 201 Response 공개
→ Fetch fulfilled
```

## PostgreSQL Adapter 설계에서 교정한 이해

현재 흐름은 `TicketController → TicketApplicationService → TicketRepository → InMemoryTicketRepository`다. Controller와 Application Service는 구체적인 저장 기술이 아니라 Repository Port에 의존하므로 PostgreSQL 도입의 변경은 Port 뒤쪽 Adapter에서 흡수해야 한다.

처음에는 올바른 상태 전이 규칙을 Service 계층이 지킨다고 답했다. 현재 Code에서는 `Ticket.startProgress()`와 `Ticket.resolve()`가 `OPEN → IN_PROGRESS → RESOLVED` 순서를 보호한다. Application Service는 Use Case를 조율하고 Domain 행동을 호출하지만, Ticket 자체의 상태 전이 불변식을 대신 구현하지 않는다.

Database의 `CHECK (status IN (...))`는 현재 값이 허용 목록에 있는지만 검사한다. `RESOLVED` 자체는 허용 값이므로 이전 값이 `OPEN`이어도 직접 갱신을 막지 못한다. Database Constraint는 저장 가능한 현재 상태를 보호하고 Domain은 허용된 변화 경로를 보호한다.

PostgreSQL Row는 Java `Ticket` 객체가 아니다. JDBC Adapter는 `ResultSet`의 SQL Type을 Java Type으로 읽고, Status 문자열을 `TicketStatus`로 바꾸며, 저장된 상태를 가진 Ticket으로 복원해야 한다. 이 Mapping 책임은 HTTP를 다루는 Controller나 Use Case를 조율하는 Service가 아니라 `JdbcTicketRepository`에 둔다.

Spring JDBC와 JPA 중 항상 우수한 하나가 있는 것은 아니다. 현재 Helpdesk에는 ORM 관계가 없고 이번 목표가 SQL·Constraint·Parameter Binding·Row Mapping을 직접 관찰하는 것이므로 Spring JDBC가 더 작은 수직 근거를 만든다. 자세한 비교는 [Spring JDBC와 JPA의 차이와 선택 기준](../study-docs/spring-jdbc-and-jpa-selection-guide.md)에 정리했다. 선택 그 자체와 이후 Adapter 구현·PostgreSQL 실행 근거는 구분한다.

JPA에서는 Managed Entity의 변경을 Persistence Context가 추적하고 Flush 때 SQL을 실행할 수 있다. 그러나 Flush는 Commit이 아니므로 같은 Transaction이 Rollback되면 Row 변경은 최종적으로 남지 않는다. 이 차이를 확인한 뒤 이번 Helpdesk Adapter 방식은 Spring JDBC로 결정했다.

## 실제 PostgreSQL 수직 Slice에서 확인한 것

구현 전 전체 회귀 기준선은 42개 Test 통과였다. Spring JDBC·Flyway·PostgreSQL Driver와 Testcontainers를 추가한 뒤 Profile을 다음처럼 분리했다.

```text
in-memory Profile
→ InMemoryTicketRepository
→ DataSource·Flyway 자동 설정 제외

postgres Profile
→ PostgreSQL Testcontainer Connection
→ Flyway V1 적용
→ JdbcTicketRepository

Profile 없음
→ 저장 Adapter를 임의로 선택하지 않고 Application 조립 실패
```

Migration은 `tickets` Table에 Identity ID, `title NOT NULL`, 공백 제목 `CHECK`, Status 허용 목록 `CHECK`를 정의한다. File을 작성한 사실만으로 Database에 적용됐다고 보지 않고, 빈 PostgreSQL 17.6 Container에서 Flyway가 Schema Version v1을 적용하는 Log와 실제 Table 접근으로 확인했다.

JDBC Adapter의 생성 흐름은 다음과 같다.

```text
Ticket
→ INSERT INTO tickets (title, status) VALUES (?, ?)
→ Parameter Binding
→ PostgreSQL이 생성한 id를 RETURNING
```

조회 때는 Row의 `title`과 `status` 문자열을 읽고, Status를 `TicketStatus`로 변환한 뒤 `Ticket.restore(title, status)`로 Domain 객체를 복원한다. 조회는 새 Ticket 생성 Use Case가 아니므로 `new Ticket(title)`만 호출해 무조건 `OPEN`으로 만들지 않는다. 또한 이미 저장된 `RESOLVED` 상태를 만들기 위해 업무 행동을 다시 재생하지 않는다.

실제 PostgreSQL Integration Test 5개에서 다음을 확인했다.

1. `postgres` Profile이 `JdbcTicketRepository`를 선택한다.
2. `IN_PROGRESS` Ticket을 저장하고 같은 제목·상태로 복원한다.
3. 존재하지 않는 ID는 빈 `Optional`을 반환한다.
4. 공백 제목의 직접 INSERT를 Database Constraint가 거부한다.
5. 알 수 없는 Status의 직접 INSERT를 Database Constraint가 거부한다.

집중 Test 5개와 전체 `clean test`를 실행했고, 최종 결과는 49개 통과, 실패·오류·건너뜀 0개였다. 이 중 기존 42개는 In-memory·Security 회귀이고 새 5개만 실제 PostgreSQL Integration Test다. Test 수를 섞어 “49개 모두 PostgreSQL Test”라고 표현하지 않는다.

In-memory Database나 H2 대신 실제 PostgreSQL이 필요한 이유도 구체화했다. PostgreSQL은 SQL 문법뿐 아니라 Identity, 자료형, Constraint, Driver, 생성 ID 반환, Transaction·Lock 동작이 H2나 Java Map 기반 저장소와 다를 수 있다. H2 호환 모드도 PostgreSQL Engine 자체는 아니다. 이번 Testcontainer 결과는 실제 PostgreSQL 17.6의 Migration·SQL·Row Mapping·Constraint 근거이지만, 외부 운영 Database·Backup·Application 재시작 뒤 데이터 보존 근거는 아니다.

## 구현 Code를 검토하며 교정한 이해

### 새 Ticket 생성과 저장 Row 복원

처음에는 조회에서 `Ticket.restore()`를 호출하는 이유를 “새 객체를 만들지 않기 때문”이라고 설명했다. 업무 의미에서는 새로운 Ticket을 생성하는 것이 아니라 기존 Ticket을 복원한다는 설명이 맞다. 다만 JVM 메모리에는 DB Row를 표현할 Java 객체가 필요하므로 `restore()` 내부에서도 새 `Ticket` 인스턴스는 생성된다.

```text
new Ticket(title)
→ 새로운 업무상 Ticket 생성
→ 초기 상태 OPEN

Ticket.restore(title, savedStatus)
→ 저장된 Ticket의 메모리 표현 복원
→ 저장된 상태 유지
```

따라서 차이는 Java 객체 생성 여부가 아니라 새로운 업무 객체의 초기 상태를 만드는가, 저장돼 있던 업무 객체의 상태를 되살리는가에 있다.

### Database 문자열과 Java Enum

PostgreSQL의 Status Column에서 읽은 값은 문자열이고, `Ticket.restore()`는 `TicketStatus` Enum을 요구한다. `TicketStatus.valueOf(storedStatus)`는 DB 문자열을 Domain Type으로 변환하고, Java가 모르는 값이면 복원을 즉시 실패시킨다.

처음에는 `valueOf()`의 이유를 주로 “DB에 넣을 값의 무결성 검증”이라고 생각했다. 그러나 이 Code는 DB에 쓰는 단계가 아니라 읽은 Row를 Mapping하는 단계다.

```text
Database CHECK
→ 잘못된 현재 값의 저장을 거부

TicketStatus.valueOf(...)
→ 저장 문자열을 Java Enum으로 변환
→ 예상하지 못한 값은 조용히 복원하지 않고 실패
```

정상 Schema에서는 `UNKNOWN`을 `CHECK`가 막지만, 과거 데이터·잘못된 Migration·수동 변경·다른 Schema 연결처럼 경계가 어긋난 경우에도 Application이 잘못된 Domain 객체를 만들지 않도록 한다.

### Parameter Binding과 생성 ID

`INSERT INTO tickets (title, status) VALUES (?, ?) RETURNING id`에서 첫 번째 Parameter는 제목이고 두 번째 Parameter는 `ticket.status().name()`이 반환한 문자열이다. Java의 Enum 객체를 그대로 저장하는 것이 아니라 `IN_PROGRESS` 같은 DB 표현으로 명시적으로 바꾼다.

생성 ID는 Java가 계산하지 않는다. PostgreSQL Identity가 만든 값을 같은 SQL의 `RETURNING id`로 돌려받는다.

```text
TicketStatus.IN_PROGRESS
→ name()
→ "IN_PROGRESS"
→ VARCHAR Column 저장

PostgreSQL INSERT
→ Identity가 id 생성
→ RETURNING id
→ Repository가 long id 반환
```

### 없는 ID 조회와 Optional

처음에는 `findFirst()`가 숫자 `1`을 반환하고 Service가 Ticket을 반환해 `200`이 된다고 생각했다. `findFirst()`의 `First`는 첫 번째 위치 번호를 뜻하는 것이 아니라, 원소가 있을 때 첫 번째 원소를 `Optional`로 감싼다는 의미다.

조회 권한이 있는 `AGENT`가 존재하지 않는 ID를 요청한 경우의 흐름은 다음과 같다.

```text
PostgreSQL 조회 Row 0개
→ JdbcTemplate.query(): 빈 List
→ stream().findFirst(): Optional.empty()
→ Service의 map(...): 실행하지 않음
→ orElseThrow(...): TicketNotFoundException
→ Exception Handler: 404 Not Found
```

익명 사용자는 Security에서 `401`, `USER`는 조회 인가에서 `403`으로 먼저 차단되므로 위 Repository 흐름까지 도달하지 않는다.

마지막 확인 질문에서는 `Optional.empty().map(...)`의 Lambda가 실행되고 `orElseThrow(...)`는 실행되지 않는다고 반대로 답했다. 올바른 흐름은 다음과 같다.

```text
Optional.empty()
→ map(...)의 Lambda는 실행되지 않음
→ 빈 Optional이 그대로 다음 단계로 전달됨
→ orElseThrow(...) 실행
→ TicketNotFoundException
```

Code에 적힌 결과를 읽는 것과 이 흐름을 자료 없이 설명하는 것은 다르다. 이 부분은 아직 독립적으로 설명할 수 있는 수준까지 마무리하지 못했으므로 9월 23일 첫 복습 항목으로 이월한다.

## Code 복습 핵심 질문

1. `restore()`도 새 Java 객체를 만드는데 왜 “새 Ticket 생성”과 다른가?
2. Database `CHECK`와 `TicketStatus.valueOf()`는 각각 어느 방향의 경계를 지키는가?
3. 두 SQL Parameter에는 각각 어떤 값이 Binding되는가?
4. `RETURNING id`의 ID는 누가 생성하는가?
5. 빈 List가 `Optional.empty()`와 `404`로 이어지는 순서는 무엇인가?
6. `Optional.empty().map(...)`의 Lambda와 그 뒤 `orElseThrow(...)` 중 무엇이 실행되는가?

## 9월 23일로 이월한 핵심 질문

1. `Optional.empty().map(...).orElseThrow(...)`에서는 어느 Callback이 실행되며, 그것이 어떻게 `404`로 이어지는가?
2. Credential이 포함된 Cross-Origin 요청에서 Client와 Server는 각각 무엇을 설정해야 하는가?
3. Spring Security Filter Chain은 `OPTIONS`와 실제 요청을 각각 어디에서 허용·거부하는가?
4. HTTP `401`·`403`·`404`와 Network Error를 Helpdesk UI 상태로 어떻게 분리할 것인가?
5. JSON 문법 검증 뒤 Ticket Property와 Type은 어느 경계에서 검증할 것인가?
6. 같은 Transaction의 중간 실패가 앞선 변경까지 Rollback한다는 것을 어떤 Test로 증명할 것인가?
7. Application만 재시작하고 PostgreSQL은 유지했을 때 저장한 Ticket이 남는다는 것을 어떻게 검증할 것인가?

Preflight Response와 실제 Response가 각각 CORS 허용 Header를 가져야 하는 이유는 설명할 수 있게 되었으므로 이월 질문에서 제외했다.

## 근거의 한계

- 이번 실험은 Local Node Server가 만든 최소 Response를 실제 Browser에서 관찰한 결과다.
- CORS 미허용·허용 Simple `GET`은 Browser 결과와 Server 요청 Log를 함께 확인했다.
- JSON `POST`의 Preflight 거부·허용은 Browser 결과와 `OPTIONS`·`POST` Server Log를 함께 확인했다.
- Cookie 같은 Credential을 포함한 CORS 요청은 아직 실행하지 않았으므로 `NOT_RUN`이다.
- 실제 PostgreSQL Repository는 Integration Test로 직접 호출했지만, Helpdesk Controller와 Security Filter Chain을 거치는 Browser 요청은 아직 실행하지 않았다.
- Server가 없는 Port의 실패를 관찰했으며 Timeout·DNS 실패·Abort를 각각 재현한 것은 아니다.
- PostgreSQL Adapter와 실제 Database Integration Test는 실행했지만, Transaction Rollback과 Application 재시작 뒤 데이터 보존은 `NOT_RUN`이며 9월 23일로 이월했다.
