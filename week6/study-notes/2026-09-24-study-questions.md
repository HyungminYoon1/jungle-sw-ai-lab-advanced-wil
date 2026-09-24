# 2026-09-24 — PostgreSQL 실패 근거와 Browser·Session 수직 흐름

> 날짜: 2026-09-24
> 학습 주제: `Optional`, Credential CORS, Transaction Rollback, Spring Context 재생성, JSON 검증, DOM Event, Response Race, Session·CSRF
> 상태: In Progress — PostgreSQL Focused Test와 MockMvc CSRF Test는 통과했으며, 실제 Ticket UI와 Browser·Security·PostgreSQL E2E는 아직 실행하지 않음

## 핵심 질문

1. 존재하지 않는 ID가 `Optional.empty()`에서 `404`로 이어질 때 어느 Callback이 실행되는가?
2. 예외 발생 여부만으로 Transaction Rollback을 증명할 수 없는 이유는 무엇인가?
3. Spring Context A와 B를 사용하는 Test는 무엇을 증명하고 JVM 재시작은 왜 증명하지 못하는가?
4. HTTP 성공, JSON 문법 성공과 올바른 Ticket 구조는 어떻게 다른가?
5. 동적으로 추가한 Button을 Event Delegation으로 처리할 때 Listener와 `closest()`는 각각 어떤 역할을 하는가?
6. `textContent`와 `innerHTML`은 Server 문자열을 어떻게 다르게 처리하는가?
7. Response Race는 왜 발생하며 `AbortController`는 무엇을 취소하고 무엇을 Rollback하지 못하는가?
8. 같은 Origin UI에서도 CSRF Token이 필요한 이유는 무엇인가?
9. JSESSIONID와 CSRF Header는 각각 누가 요청에 추가하는가?
10. `postgres,local-browser` Profile 조합에서 사용자 인증 정보와 Ticket은 각각 어디에 저장되는가?

## 없는 Ticket이 `404`가 되는 흐름

존재하지 않는 ID를 실제 PostgreSQL에서 조회하면 `JdbcTemplate.query()`가 빈 List를 반환한다. 그 뒤 흐름은 다음과 같다.

```text
빈 List
→ stream().findFirst()
→ Optional.empty()
→ map(...) Lambda 미실행
→ orElseThrow(...)의 Exception 생성 함수 실행
→ TicketNotFoundException
→ TicketApiExceptionHandler
→ 404 Not Found
```

처음에는 `Optional.empty().map(...)`의 Lambda가 실행된다고 생각했다. 하지만 `map`은 값이 있을 때만 Callback을 실행한다. 빈 `Optional`은 그대로 다음 연산으로 전달되고, `orElseThrow`에서 예외가 만들어진다.

권한이 있는 `AGENT` 요청이라면 Security를 통과해 Controller와 Service에 진입한 뒤 위 흐름에서 `404`가 된다. 익명 사용자의 `401`과 Role이 부족한 `USER`의 `403`은 Controller 이전 Security 경계에서 발생한다.

## Credential CORS와 CSRF는 서로 다른 통제다

Preflight는 실제 요청 전에 Browser가 보내는 `OPTIONS` 요청이며 Session Cookie를 포함하지 않는다. 따라서 Security가 CORS 처리보다 먼저 Preflight를 일반 인증 요청처럼 검사하면 익명 요청으로 거부할 수 있고, Browser는 실제 요청을 보내지 않는다.

Credential이 포함된 Cross-Origin 실제 요청에는 다음 조건이 필요하다.

```text
Client
→ credentials: "include"

Server
→ 구체적인 허용 Origin
→ Access-Control-Allow-Credentials: true
```

Credential Response에서 `Access-Control-Allow-Origin: *`를 사용할 수 없다. `*`는 “없음”이 아니라 모든 Origin을 뜻하며, Credential을 허용할 때에는 허용 Origin을 명시해야 한다.

Preflight는 모든 Cross-Origin 요청에서 발생하지 않는다.

```text
POST + text/plain + 추가 Header 없음
→ Simple Request가 될 수 있어 Preflight 없음

POST + application/json
→ 일반적으로 Preflight 있음

GET + Authorization Header
→ Preflight 있음
```

Preflight가 없더라도 실제 상태 변경 요청은 Server에 도달할 수 있다. CORS는 Response 공유 정책이고 CSRF 방어를 대신하지 않는다. Credential CORS의 개념과 이전 Browser Spike는 확인했지만, 실제 Helpdesk Session Cookie를 사용한 Credential CORS 요청은 아직 실행하지 않았다.

## Transaction Rollback은 최종 Database 상태로 증명한다

처음에는 `jdbcTemplate.update()`가 Transaction을 시작한다고 생각했다. 실제 Test에서 Transaction 경계를 만든 호출은 다음 부분이다.

```java
transactionTemplate.executeWithoutResult(status -> {
    // 두 INSERT가 같은 Transaction에 참여
});
```

`JdbcTemplate`은 SQL을 실행하고 이미 열린 Transaction에 참여한다. `TransactionTemplate`은 Transaction 시작과 종료·Rollback 경계를 관리한다.

Focused Test의 근거는 다음 세 단계다.

```text
첫 번째 정상 INSERT
→ 영향 Row 수 1 확인

두 번째 공백 제목 INSERT
→ PostgreSQL CHECK Constraint 실패

Transaction 종료 뒤 SELECT COUNT(*)
→ 최종 Row 수 0
```

두 Case에서 모두 예외는 발생할 수 있다.

```text
Transaction 없음
→ 첫 번째 INSERT가 남고 두 번째만 실패할 수 있음
→ 최종 Row 수 1 가능

같은 Transaction
→ 두 번째 실패로 첫 번째 변경까지 Rollback
→ 최종 Row 수 0
```

따라서 예외 발생만으로는 Rollback을 증명하지 못한다. 첫 번째 변경이 실제 성공했다는 근거와 실패 뒤 최종 Row 수 0을 함께 확인해야 한다.

첫 Focused Test 시도는 Docker Engine이 실행되지 않아 PostgreSQL Container를 시작하지 못했다. 이는 Code 실패나 Rollback 결과가 아니라 Test 환경 준비 실패다. Docker Engine 준비 뒤 PostgreSQL 17.6 Testcontainer에서 해당 Test 1개를 다시 실행해 통과했다.

## Spring Context 재생성과 JVM Process 재시작은 다르다

Application 재시작의 의미를 구체적인 실행 단위로 나눴다.

```text
같은 JVM Process
│
├─ Context A
│  ├─ Repository A
│  ├─ Ticket 저장
│  └─ 첫 번째 try 블록 종료 시 close
│
├─ 같은 PostgreSQL Container 유지
│
└─ Context B
   ├─ Repository B 새로 생성
   └─ 같은 ID 조회
```

처음에는 Context A가 Context B를 시작할 때 종료된다고 답했다. 실제 종료 지점은 첫 번째 `try-with-resources` 블록의 닫는 중괄호이며, 그 지점에서 `firstApplication.close()`가 호출된다.

`isNotSameAs(firstRepository)`는 Repository A와 B의 Java 객체 정체성이 다르다는 것만 증명한다. Ticket 데이터가 같은지를 비교하는 Assertion이 아니다.

두 번째 Context에서 같은 ID의 Title과 Status를 조회한 결과는 다음 범위의 근거다.

> Spring Context와 Repository Bean을 새로 만들어도 같은 PostgreSQL Container에 저장된 Ticket Row를 다시 조회할 수 있다.

Focused Test 1개는 통과했지만 같은 JVM PID에서 실행됐다. 따라서 JVM Process 재시작, PostgreSQL Container 재시작, Docker Volume과 운영 환경의 장기 보존까지 증명한 것은 아니다.

## HTTP 성공과 Ticket 구조 검증을 분리했다

Browser가 처리하는 단계를 다음처럼 구분했다.

```text
fetch fulfilled
→ 읽을 Response를 받음

response.ok
→ HTTP Status가 2xx인지 판정

response.json()
→ Body가 JSON 문법으로 해석되는지 판정

isTicket(body)
→ id·title·status의 Property와 Type 판정
```

처음에는 `response.ok`에 `200`을 답했다. `response.ok`는 Status 번호가 아니라 Boolean이며, 번호는 `response.status`에서 확인한다.

문법이 끝나지 않은 JSON은 `200 OK`여도 `response.json()`에서 rejected된다. 이 경우 `body`가 없으므로 Ticket 구조 검증까지 도달하지 않는다.

반대로 다음 값은 JSON 문법은 올바르지만 Ticket 계약에는 맞지 않는다.

```json
{
  "id": 1,
  "title": null,
  "status": "OPEN"
}
```

이때 `isTicket(body)`는 `false`, `!isTicket(body)`는 `true`다. `showInvalidResponse()` 뒤 `return`하므로 `showTicket(body)`는 실행하지 않는다.

Frontend의 `isTicket()`은 잘못된 UI와 Runtime Error를 막는 방어다. Browser에 전달된 JavaScript는 사용자가 볼 수 있고 수정할 수 있으므로 인증·인가를 대신하지 않는다. 사용자가 Frontend 검증을 제거해도 `AGENT` 전용 Ticket 접근은 Backend Security가 막아야 한다.

## Event Delegation에서 Listener와 탐색을 구분했다

동적으로 만든 Button마다 Listener를 붙이지 않고 계속 존재하는 상위 목록에 Listener 하나를 둔다.

```text
ticketList.addEventListener(...)
→ Listener 등록

event.target.closest(...)
→ 실제 Click Target에서 조건에 맞는 Button 탐색
```

처음에는 `closest()`가 Listener가 있는 위치라고 답했다. 실제 Listener는 `ticketList`에 있고, `closest()`는 Event가 발생한 Element에서 부모 방향으로 Button을 찾는다.

`data-ticket-id="12"`를 `button.dataset.ticketId`로 읽으면 값은 문자열 `"12"`다. JavaScript에는 일반 `int` Type이 따로 없으므로 `Number(...)`로 `number` Type으로 바꾸고 `Number.isInteger()`로 정수 여부를 확인한다.

```text
"12" string
→ Number("12")
→ 12 number
→ Number.isInteger(12) === true
```

## API 문자열은 `textContent`로 표시한다

처음에는 `textContent`가 HTML 문법으로 해석한다고 답했다. 올바른 구분은 반대다.

```text
innerHTML
→ 문자열을 HTML Markup으로 해석
→ Element와 Event Handler가 만들어질 수 있음

textContent
→ 문자열을 일반 글자로 Text Node에 삽입
```

Ticket 제목처럼 Server에서 받은 일반 문자열은 `titleElement.textContent = ticket.title`로 표시한다. 이 Frontend 방어와 Server의 입력·인가 검증은 서로 대체 관계가 아니다.

## Response Race와 `AbortController`

느린 Ticket 1 요청 뒤 빠른 Ticket 2 요청을 시작하면 응답 순서가 요청 순서와 달라질 수 있다.

```text
요청: Ticket 1 → Ticket 2
응답: Ticket 2 → Ticket 1
방어 없는 최종 UI: Ticket 1
```

새 요청을 시작할 때 이전 요청의 `AbortController.abort()`를 호출하면 이전 Fetch가 기본적인 경우 `AbortError`로 rejected될 수 있다. 의도적인 취소이므로 `showNetworkError()`를 실행하지 않고 조용히 종료한다.

처음에는 Server 연결 실패를 `500`이라고 답했다. 연결 실패에는 읽을 Response와 HTTP Status가 없다. `500`은 Server가 실제 Response를 보냈을 때이며 Fetch Promise는 `fulfilled`, `response.ok`는 `false`다.

```text
AbortError
→ 의도적인 이전 요청 취소

연결 실패
→ Fetch rejected, Response·Status 없음

HTTP 500
→ Fetch fulfilled, Response 있음, status 500
```

Browser에서 요청을 취소했다고 Server에 이미 도달한 상태 변경 작업이 반드시 Rollback되는 것은 아니다. Client 취소와 Server Transaction은 별도 근거가 필요하다.

## 같은 Origin에서도 Session과 CSRF를 함께 사용한다

같은 Origin UI는 정상 요청에서 CORS 검사가 필요 없지만 CSRF 방어까지 불필요한 것은 아니다. 공격자는 Response를 읽지 못해도 Cookie가 붙은 상태 변경 요청을 유도할 수 있기 때문이다.

```text
JSESSIONID
→ Browser가 자동 첨부
→ Server가 Authentication 복원

CSRF Header
→ JavaScript가 직접 추가
→ Server가 Session의 예상 Token과 비교
```

처음에는 Server가 Token을 보내면 Browser가 CSRF Header를 자동으로 붙인다고 답했다. 실제 Fetch Code가 응답의 `headerName`과 `token`을 읽어 Header를 직접 구성해야 한다. `credentials` 설정은 Cookie 전송과 관련되며 CSRF Header를 만들어 주지 않는다.

`GET /api/csrf`는 안전한 GET이므로 CSRF Token을 먼저 첨부하지 않는다. 다만 현재 `/api/**`는 인증을 요구하므로 JSESSIONID가 없으면 `401`이 될 수 있다.

## CSRF Endpoint의 현재 Test 근거

Lab에 `/api/csrf` Endpoint를 추가했다. Spring Security가 Controller Parameter에 현재 `CsrfToken`을 제공하고, Controller는 다음 두 Property만 응답한다.

```text
headerName
→ 후속 POST에 사용할 Header 이름

token
→ 그 Header에 넣을 현재 Token
```

실제 Token 값은 Console·문서에 기록하지 않았다.

Focused `SessionAuthenticationIntegrationTest` 9개가 통과했다. 새 Test는 다음을 확인했다.

```text
Test USER 로그인
→ 인증된 MockHttpSession
→ GET /api/csrf 200
→ Header 이름과 비어 있지 않은 Token 응답
→ 같은 Session과 Token Header로 POST /api/tickets
→ CSRF 검증 통과
→ TicketController#create 진입
→ 201 Created
```

이 Test는 `in-memory` Profile의 MockMvc Test다. 실제 Browser가 JSON을 읽고 JavaScript로 Header를 구성한 것이 아니며 PostgreSQL 저장 근거도 아니다. 후속 POST Test는 응답 JSON을 Browser처럼 다시 Parsing하지 않고 같은 요청의 Spring Security Attribute에서 Token 객체를 가져왔다. 따라서 실제 Browser E2E라고 부르지 않는다.

## Profile마다 선택하는 대상이 다르다

처음에는 `InMemoryUserDetailsManager`를 사용하면 Ticket도 메모리에 저장된다고 생각했다. 사용자 인증 저장과 Ticket 저장은 독립된 Port와 객체다.

```text
profiles = postgres,local-browser

local-browser
→ InMemoryUserDetailsManager
→ Local USER·AGENT 인증 정보

postgres
→ JdbcTicketRepository
→ PostgreSQL tickets Table
```

`LocalBrowserSecurityConfiguration`은 사용자를 저장하는 객체가 아니라 `InMemoryUserDetailsManager` Bean을 만들어 연결하는 설정이다. `in-memory` Profile이 활성화되지 않으면 `InMemoryTicketRepository`는 생성되지 않는다.

Application이 종료되면 Local USER·AGENT는 사라지지만 PostgreSQL이 계속 실행되면 Ticket Row는 남을 수 있다. Local Credential 실제 값은 Source가 아니라 Process Environment에서 주입해야 한다.

이 Profile 구성은 아직 설계와 설명 단계이며 `LocalBrowserSecurityConfiguration`은 구현하지 않았다.

## 현재 실행 근거와 남은 범위

| 항목 | 현재 근거 | 상태 |
|---|---|---|
| 빈 `Optional`에서 `404`까지 | Code 흐름 재설명 | 이해 교정 |
| Credential CORS·Security `OPTIONS` | 개념 설명, Helpdesk Credential 실행 없음 | `NOT_RUN` |
| 복수 SQL Rollback | PostgreSQL 17.6 Focused Test 1개 통과 | `PASSED` |
| Spring Context 재생성 영속성 | 같은 JVM·같은 Container Focused Test 1개 통과 | `PASSED` |
| JSON·Ticket 구조 검증 | 예제 추론 | `NOT_IMPLEMENTED` |
| Event Delegation·안전한 DOM 출력 | 예제 추론 | `NOT_IMPLEMENTED` |
| Response Race·Abort | 예제 추론 | `NOT_RUN` |
| `/api/csrf`와 후속 POST | MockMvc `in-memory` Focused Test 9개 통과 | `PASSED` |
| Local Browser Runtime 사용자 | Profile 책임 설계 | `NOT_IMPLEMENTED` |
| 실제 Browser·Session·CSRF·PostgreSQL E2E | 실행하지 않음 | `NOT_RUN` |
| 현재 변경 포함 전체 Java 회귀 | 2026-09-24 23:57 KST Clean Test 53개, 실패·오류·건너뜀 0 | `PASSED` |

## 최종적으로 정리한 이해

1. `Optional.empty()`에서는 `map` Callback이 아니라 `orElseThrow`가 실행된다.
2. Rollback은 예외 자체가 아니라 앞선 성공과 실패 뒤 최종 Database 상태를 함께 봐야 한다.
3. Context 재생성 Test는 같은 JVM 안의 Spring Bean 재생성을 검증하며 Process 재시작과 다르다.
4. HTTP `2xx`, JSON 문법과 Ticket 구조는 서로 다른 검증 경계다.
5. Event Listener는 상위 목록에 등록하고 `closest()`는 실제 Action Button을 찾는다.
6. `textContent`는 문자열을 글자로 넣고 `innerHTML`은 HTML로 해석한다.
7. Abort는 Client의 이전 응답 처리를 막지만 Server 작업의 Rollback을 보장하지 않는다.
8. Session Cookie는 Browser가 자동으로 보내고 CSRF Header는 JavaScript가 직접 추가한다.
9. 같은 Origin은 CORS 경계를 줄이지만 CSRF 방어를 없애지 않는다.
10. 사용자 인증 정보의 In-memory 저장과 Ticket의 PostgreSQL 저장은 서로 독립적이다.

> 하나의 성공 응답만 보지 않고 Network·HTTP·JSON·UI·Security·Transaction·Database 경계를 분리해야 실제 수직 흐름에서 무엇이 통과했고 무엇이 아직 미검증인지 설명할 수 있다.

## 다시 답할 핵심 질문

1. 첫 INSERT 성공 뒤 두 번째 INSERT가 실패한 Test에서 최종 Row 수 0이 왜 Rollback의 핵심 근거인가?
2. Context B의 Repository가 A와 다른 객체라는 사실과 같은 Ticket을 조회했다는 사실은 각각 무엇을 증명하는가?
3. `200 OK`와 올바른 Ticket 객체를 구분하려면 어떤 세 검증이 추가로 필요한가?
4. 동적 Button Click에서 `addEventListener`, `closest`와 `dataset`은 각각 무엇을 담당하는가?
5. `AbortError`, Network 실패와 HTTP `500`을 Response 존재 여부로 어떻게 구분하는가?
6. `/api/csrf` GET과 후속 Ticket POST는 Cookie와 Token을 각각 어떻게 전달하는가?
7. `postgres,local-browser`에서 `InMemoryUserDetailsManager`와 `JdbcTicketRepository`는 어떤 데이터를 각각 보관하는가?
8. 현재 MockMvc Test를 실제 Browser·PostgreSQL E2E라고 부를 수 없는 이유는 무엇인가?
