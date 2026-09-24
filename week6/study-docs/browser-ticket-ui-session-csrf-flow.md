# Learning Note — Browser Ticket UI와 Session·CSRF 수직 흐름

> 선행 자료: [Fetch의 HTTP 오류와 CORS 기초](./fetch-http-cors-foundations.md), [Session 인증 요청 흐름](../../week4/study-docs/session-authentication-flow.md)
> 핵심 질문: Browser가 받은 값을 안전한 Ticket UI로 표현하고, Session·CSRF를 유지한 상태 변경 요청을 Server와 PostgreSQL까지 어떻게 연결할 것인가?

## 전체 흐름부터 구분한다

최소 Ticket UI도 하나의 함수로 끝나지 않는다. 다음 경계를 순서대로 통과한다.

```text
사용자 Click
→ Event Delegation으로 Action과 Ticket ID 식별
→ 이전 조회 요청 취소 또는 최신 요청 식별
→ fetch
→ 읽을 수 있는 HTTP Response 존재 여부
→ HTTP Status Mapping
→ JSON 문법 해석
→ Ticket Property·Type 검증
→ 안전한 DOM 갱신
```

Ticket 생성은 인증·CSRF·영속성 경계가 추가된다.

```text
Form Login 성공
→ Browser가 JSESSIONID Cookie 보관
→ GET /api/csrf
→ JavaScript가 Header 이름과 Token을 받음
→ POST /api/tickets
   ├─ Browser가 JSESSIONID 자동 첨부
   └─ JavaScript가 CSRF Header 직접 추가
→ Security Filter Chain
→ TicketController
→ TicketApplicationService
→ JdbcTicketRepository
→ PostgreSQL
```

각 단계의 성공은 다음 단계의 성공을 자동으로 증명하지 않는다.

## HTTP 성공과 올바른 Ticket은 다르다

`response.ok === true`는 HTTP Status가 `2xx`라는 뜻이다. Response Body가 올바른 JSON이거나 Helpdesk의 Ticket 계약을 만족한다는 뜻은 아니다.

```text
fetch fulfilled
→ JavaScript가 읽을 Response를 얻음

response.ok === true
→ HTTP Status가 2xx

response.json() fulfilled
→ Body가 JSON 문법으로 해석됨

isTicket(body) === true
→ UI가 기대하는 Ticket Property와 Type을 만족
```

예를 들어 다음 Body는 JSON 문법은 올바르지만 Ticket 계약에는 맞지 않는다.

```json
{
  "id": "one",
  "status": "UNKNOWN"
}
```

`title`이 없고 `id`와 `status`의 값도 기대와 다르다. `response.json()`이 성공해도 그대로 `showTicket()`에 넘기면 `undefined`가 표시되거나 Runtime Error가 발생할 수 있다.

## Runtime에서 Ticket 구조를 검증한다

JavaScript는 Server가 보낸 JSON을 자동으로 `Ticket` Type으로 바꾸지 않는다. Runtime 검증 함수를 명시한다.

```javascript
const TICKET_STATUSES = new Set([
    "OPEN",
    "IN_PROGRESS",
    "RESOLVED"
]);

function isTicket(value) {
    return value !== null
        && typeof value === "object"
        && !Array.isArray(value)
        && Number.isInteger(value.id)
        && value.id > 0
        && typeof value.title === "string"
        && value.title.trim().length > 0
        && TICKET_STATUSES.has(value.status);
}
```

검사 순서에는 이유가 있다.

```text
value !== null
→ JavaScript에서 typeof null이 "object"인 특수 Case 제외

typeof value === "object"
→ 문자열·숫자 같은 값 제외

!Array.isArray(value)
→ 배열도 typeof 결과가 "object"이므로 별도 제외

Number.isInteger(value.id)
→ 숫자 Type이면서 정수인지 확인

title.trim().length > 0
→ 빈 문자열과 공백뿐인 제목 제외

TICKET_STATUSES.has(value.status)
→ UI가 처리할 수 있는 Status만 허용
```

`&&`는 앞 조건이 실패하면 뒤 조건을 평가하지 않는 단축 평가를 한다. `isTicket(body)`가 `false`이면 앞에 `!`를 붙인 결과는 `true`다.

```javascript
if (!isTicket(body)) {
    showInvalidResponse();
    return;
}

showTicket(body);
```

`return`이 있으므로 잘못된 값에 `showTicket()`을 실행하지 않는다.

### Frontend 검증은 보안 권한 검증이 아니다

Browser에 전달된 JavaScript와 JSON은 사용자가 개발자 도구에서 확인하거나 변경할 수 있다. Minify는 Code 크기를 줄일 수 있지만 보안 경계가 아니다.

```text
isTicket()
→ 잘못된 UI와 Runtime Error 방지

Backend 인증·인가
→ 실제 Ticket 접근 통제

Backend 입력·Domain·Database 검증
→ 저장 상태 보호
```

사용자가 자신의 Browser에서 `isTicket()`을 제거해도 `AGENT` 전용 Ticket에 접근할 수 있어서는 안 된다. 실제 접근 거부는 Server가 담당한다.

## JSON 문법 실패와 구조 실패를 나눈다

다음 Body는 JSON 문법이 끝나지 않았다.

```json
{"id": 1, "title":
```

이 경우 HTTP `200`이면 `response.ok`는 `true`일 수 있지만 `response.json()` Promise는 rejected된다. `body`가 만들어지지 않았으므로 `isTicket(body)`까지 도달하지 않는다.

```javascript
let body;

try {
    body = await response.json();
} catch (error) {
    showInvalidResponse();
    return;
}

if (!isTicket(body)) {
    showInvalidResponse();
    return;
}
```

`catch`가 실행됐다는 이유만으로 모두 Network Error라고 부르지 않는다.

```text
fetch() rejected
→ 읽을 Response를 얻지 못한 Network·CORS 계열 가능

response.json() rejected
→ Response는 받았지만 Body JSON 해석 실패
```

## `textContent`로 일반 문자열을 안전하게 표시한다

API에서 받은 제목은 HTML이 아니라 일반 문자열로 다룬다.

```javascript
titleElement.textContent = ticket.title;
```

`textContent`는 `<`와 `>`가 들어 있는 문자열도 Markup으로 Parsing하지 않고 Text Node로 넣는다.

```javascript
titleElement.innerHTML = ticket.title;
```

`innerHTML`은 문자열을 HTML로 해석한다. Server 데이터나 사용자 입력을 그대로 넣으면 Element와 Event Handler가 만들어질 수 있다.

```text
innerHTML
→ HTML Markup으로 해석

textContent
→ 일반 글자로 표시
```

최소 Ticket 항목은 DOM API로 만든다.

```javascript
function createTicketItem(ticket) {
    const item = document.createElement("li");

    const title = document.createElement("span");
    title.textContent = ticket.title;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = "open";
    button.dataset.ticketId = String(ticket.id);
    button.textContent = "상세 보기";

    item.append(title, button);
    return item;
}
```

## Event Delegation은 동적으로 만든 Button을 처리한다

API 응답 뒤 Button을 만들면 Page 초기화 시점에는 그 Button이 존재하지 않을 수 있다. 각 Button이 아니라 계속 존재하는 상위 목록에 Listener 하나를 둔다.

```text
ul#ticket-list  ← Click Listener
└─ li
   ├─ span
   └─ button    ← 자체 Listener 없음
      └─ span
```

Click Event는 실제 Target에서 부모 방향으로 전달된다. 이를 Event Bubbling이라고 한다.

```javascript
ticketList.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
        return;
    }

    const button = event.target.closest(
        "[data-action='open']"
    );

    if (button === null || !ticketList.contains(button)) {
        return;
    }

    const ticketId = Number(button.dataset.ticketId);

    if (!Number.isInteger(ticketId)) {
        showInvalidTicketId();
        return;
    }

    openTicket(ticketId);
});
```

`closest()`는 Listener를 등록하지 않는다. 실제 Click Target이 Button 내부의 `span`이어도 부모 방향으로 조건에 맞는 Button을 찾는다.

`dataset.ticketId`는 HTML의 `data-ticket-id`를 읽지만 결과 Type은 항상 문자열이다.

```text
data-ticket-id="12"
→ button.dataset.ticketId === "12"
→ Number(...) === 12
→ typeof 결과는 "number"
→ Number.isInteger(12) === true
```

JavaScript의 일반 `Number` Type에는 Java 같은 별도 `int` Type이 없다. 정수 여부는 `Number.isInteger()`로 검사한다.

## Response Race는 요청 순서와 응답 순서가 다른 문제다

사용자가 Ticket을 빠르게 바꾸면 먼저 시작한 느린 요청이 나중에 화면을 덮을 수 있다.

```text
요청 순서
Ticket 1 → Ticket 2

응답 순서
Ticket 2 → Ticket 1

방어가 없는 최종 UI
Ticket 1 ← 사용자의 최신 선택이 아님
```

`AbortController`로 이전 요청을 중단한다.

```javascript
let activeController = null;
let latestRequestId = 0;

async function openTicket(ticketId) {
    activeController?.abort();

    const controller = new AbortController();
    activeController = controller;
    const requestId = ++latestRequestId;

    try {
        let response;

        try {
            response = await fetch(
                `/api/tickets/${ticketId}`,
                { signal: controller.signal }
            );
        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }

            showNetworkError();
            return;
        }

        if (response.status === 401) {
            showLoginRequired();
            return;
        }

        if (response.status === 403) {
            showForbidden();
            return;
        }

        if (response.status === 404) {
            showNotFound();
            return;
        }

        if (!response.ok) {
            showHttpError(response.status);
            return;
        }

        let ticket;

        try {
            ticket = await response.json();
        } catch (error) {
            if (error.name === "AbortError") {
                return;
            }

            showInvalidResponse();
            return;
        }

        if (!isTicket(ticket)) {
            showInvalidResponse();
            return;
        }

        if (requestId !== latestRequestId) {
            return;
        }

        showTicket(ticket);
    } finally {
        if (activeController === controller) {
            activeController = null;
        }
    }
}
```

JSON Body를 읽는 동안의 `AbortError`도 의도적 취소로 분리한다. `requestId` 비교는 이전 요청이 이미 다음 단계로 진행된 경우에도 오래된 결과가 최신 UI를 덮지 못하게 하는 마지막 방어다.

기본적인 취소 Case에서 `fetch` Promise는 `AbortError`로 rejected될 수 있다. 이는 의도적인 취소이므로 Network Error UI를 표시하지 않는다.

```text
AbortError
→ 이전 요청을 의도적으로 취소

연결 실패
→ 읽을 Response와 HTTP Status 없음

HTTP 500
→ Response 있음, fetch fulfilled, response.ok false
```

Client가 `abort()`했다고 이미 Server에 도달한 작업까지 반드시 취소되거나 Rollback되는 것은 아니다. 특히 상태 변경 POST는 Browser 요청 취소와 Server Transaction 결과를 별도로 확인해야 한다.

## Session Cookie와 CSRF Token은 전달 주체가 다르다

로그인 성공 뒤 Browser와 Server는 다음 정보를 나눠 가진다.

```text
Browser
→ Cookie에 JSESSIONID 보관

Server
→ HttpSession 안에 SecurityContext와 Authentication 보관
```

후속 요청에서는 Browser가 Session Cookie를 자동으로 붙이고 Server가 인증 결과를 복원한다.

```text
JSESSIONID
→ HttpSession
→ SecurityContext
→ 현재 요청의 SecurityContextHolder
```

CSRF Token Header는 Browser가 자동으로 붙이지 않는다. JavaScript가 Server에서 받은 Header 이름과 Token을 사용해 직접 추가한다.

## `/api/csrf` Endpoint를 사용하는 흐름

정적 HTML과 JavaScript가 CSRF Token을 얻을 수 있도록 Server가 다음과 같은 Endpoint를 제공할 수 있다.

```http
GET /api/csrf
```

개념적인 Response 구조는 다음과 같다. 실제 Token 값은 Source·Log·학습 문서에 기록하지 않는다.

```json
{
  "headerName": "X-CSRF-TOKEN",
  "token": "(실행 중 발급된 값)"
}
```

Spring MVC Controller Parameter의 `CsrfToken`은 Client가 Request Parameter로 보내는 값이 아니다. Spring Security가 현재 요청에 연결된 Token을 Argument Resolver를 통해 제공한다.

```java
@GetMapping
CsrfResponse csrf(CsrfToken csrfToken) {
    return new CsrfResponse(
            csrfToken.getHeaderName(),
            csrfToken.getToken());
}
```

`GET /api/csrf`는 기본적인 안전한 GET 요청이므로 CSRF Token을 먼저 첨부할 필요가 없다. 그러나 Endpoint가 인증을 요구한다면 JSESSIONID가 없을 때 인증 단계에서 `401`이 될 수 있다.

후속 POST는 다음 두 값을 함께 보낸다.

```javascript
const csrf = await loadCsrfToken();

await fetch("/api/tickets", {
    method: "POST",
    credentials: "same-origin",
    headers: {
        "Content-Type": "application/json",
        [csrf.headerName]: csrf.token
    },
    body: JSON.stringify({
        title: "로그인 오류"
    })
});
```

```text
JSESSIONID
→ Browser가 자동 첨부
→ 인증 결과 복원

CSRF Header
→ JavaScript가 직접 추가
→ Server가 Session의 예상 Token과 비교
```

같은 Username으로 로그인했더라도 새 Session에는 별도의 CSRF Token이 연결된다. 이전 Session의 Token을 새 Session 요청에 사용하면 일치하지 않아 `403`이 될 수 있다.

## Same-Origin UI여도 CSRF 방어는 유지한다

정상 UI와 API를 같은 Origin에 두면 정상 요청에는 CORS 검사가 필요하지 않다.

```text
UI  http://localhost:8080/
API http://localhost:8080/api/tickets
```

하지만 CSRF 공격은 공격자의 다른 Site가 상태 변경 요청을 유도하는 문제다. Same-Origin Policy나 CORS 때문에 공격자가 Response를 읽지 못하더라도, Cookie 정책에 따라 요청 자체가 Server에 도달할 수 있다.

```text
CORS
→ 다른 Origin의 Script가 Response를 읽을 수 있는지 통제

CSRF Token
→ Cookie가 자동 첨부된 상태 변경 요청의 정당성 검증
```

`SameSite` Cookie도 공격면을 줄이지만 CORS와 CSRF를 같은 통제로 취급하지 않는다. 이번 흐름에서는 Spring Security의 CSRF 방어를 끄지 않고 Token 전달을 직접 확인한다.

## Profile 이름과 저장 책임을 혼동하지 않는다

`InMemoryUserDetailsManager`와 `InMemoryTicketRepository`는 이름 일부가 같지만 서로 다른 데이터를 맡는다.

```text
profiles = postgres,local-browser

Spring Application Context
├─ local-browser
│  └─ InMemoryUserDetailsManager
│     └─ Local USER·AGENT 인증 정보
│
└─ postgres
   └─ JdbcTicketRepository
      └─ JdbcTemplate
         └─ PostgreSQL tickets Table
```

`LocalBrowserSecurityConfiguration`은 사용자 정보를 직접 저장하는 Database가 아니라 `InMemoryUserDetailsManager` Bean을 만들고 연결하는 Configuration이다.

```text
local-browser Profile
→ Local 학습용 UserDetailsService 활성화

postgres Profile
→ JdbcTicketRepository 활성화

in-memory Profile이 비활성
→ InMemoryTicketRepository는 생성되지 않음
```

Application이 종료되면 메모리의 Local USER·AGENT는 사라진다. PostgreSQL Process와 Storage가 유지되면 이미 저장한 Ticket Row는 Application과 별도로 남을 수 있다.

Local Credential의 실제 값은 Source Code에 저장하지 않고 Process Environment로 주입한다. Property 이름만 Source에 두고 값이 누락되면 자동 기본값으로 실행하지 않는 구성이 적절하다.

## Test와 실제 Browser 근거를 구분한다

| 근거 | 증명하는 것 | 증명하지 못하는 것 |
|---|---|---|
| `with(csrf())` MockMvc Test | Spring Security Test 지원으로 유효 Token 요청 구성 | `/api/csrf` Client 흐름 |
| `/api/csrf` MockMvc Test | 인증된 Session에서 Token 응답 계약 | Browser JavaScript 실행 |
| 같은 MockMvc Session의 후속 POST | Session 연결 Token으로 CSRF 검증·Controller 진입 | 실제 Network·PostgreSQL |
| JavaScript 격리 Test | UI 분기·DOM·Event·Race | 실제 Security·Database |
| 실제 Browser E2E | Browser·Session·CSRF·Controller·Database가 조립된 대표 흐름 | 검증하지 않은 운영 장애 전체 |

MockMvc Test가 `201`과 `TicketController#create` 진입을 확인했다면 인증·인가·CSRF를 통과하고 현재 Test Application 흐름이 정상 종료됐다는 근거다. Repository Profile이 `in-memory`라면 PostgreSQL 저장 근거는 아니다.

## 핵심 질문

1. `response.ok`, `response.json()`과 `isTicket()`은 각각 무엇을 검증하는가?
2. 잘못된 JSON 문법과 올바른 JSON 안의 잘못된 Ticket 구조는 어느 단계에서 갈라지는가?
3. `isTicket()`을 사용자가 제거해도 Backend Authorization이 유지돼야 하는 이유는 무엇인가?
4. API 문자열을 `innerHTML` 대신 `textContent`로 표시하는 이유는 무엇인가?
5. Event Delegation에서 Listener 등록과 `closest()`의 역할은 어떻게 다른가?
6. `dataset.ticketId`가 숫자처럼 보여도 `Number()`와 정수 검증이 필요한 이유는 무엇인가?
7. Response Race가 발생하면 왜 오래된 응답이 최신 UI를 덮을 수 있는가?
8. `AbortError`, Network 실패와 HTTP `500`은 Promise와 Response에서 어떻게 다른가?
9. JSESSIONID와 CSRF Header는 각각 누가 요청에 추가하는가?
10. Same-Origin UI에서도 상태 변경 요청에 CSRF 방어가 필요한 이유는 무엇인가?
11. `postgres,local-browser` Profile 조합에서 사용자 인증 정보와 Ticket은 각각 어디에 저장되는가?
12. MockMvc CSRF Test를 실제 Browser·PostgreSQL E2E라고 부를 수 없는 이유는 무엇인가?

## 공식 참고 자료

- [Spring Security — Cross Site Request Forgery](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)
- [MDN — Event bubbling](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling)
- [MDN — `Element.closest()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/closest)
- [MDN — `HTMLElement.dataset`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset)
- [MDN — `Node.textContent`](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent)
- [MDN — `AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
