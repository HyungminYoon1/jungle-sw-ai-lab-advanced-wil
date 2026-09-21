# Learning Note — Fetch의 HTTP 오류와 CORS 기초

> 작성일: 2026-09-21
> 최종 수정일: 2026-09-22
> 상태: Ready — 학습자료 작성은 실험 완료 근거가 아님
> 선행 자료: [JavaScript Promise와 Async/Await 기초](../../week5/study-docs/javascript-promise-async-await-basics.md), [Browser JavaScript Event Loop 입문](../../week5/study-docs/browser-javascript-event-loop-basics.md)
> 핵심 질문: `fetch`의 Promise 상태, HTTP Status, Body 해석과 UI 상태를 어떻게 구분할 것인가?

## 먼저 잡을 전체 그림

`fetch`를 이해할 때는 “성공 또는 실패” 하나로만 나누면 혼란이 생긴다. 최소한 다음 단계를 따로 본다.

```text
1. Browser가 요청을 시작할 수 있는가?
        ↓
2. JavaScript가 읽을 수 있는 HTTP Response를 받았는가?
        ↓
3. HTTP Status가 업무상 성공인가?
        ↓
4. Response Body를 기대한 형식으로 해석할 수 있는가?
        ↓
5. Application이 그 결과를 어떤 UI 상태로 표시하는가?
```

예를 들어 Server가 `404 Not Found`를 반환했다면 HTTP 요청 자체는 왕복했고 `Response`도 도착했다. 다만 요청한 Ticket이 없다는 업무 결과다. 반대로 Server에 연결할 수 없었다면 읽을 `Response` 자체가 없다.

## HTTP Request와 Response를 먼저 구분한다

Browser와 Server의 기본 HTTP 흐름은 다음과 같다.

```text
Browser
  │
  │ HTTP Request
  │ GET /tickets/1
  ▼
Server
  │
  │ HTTP Response
  │ Status: 200
  │ Body: {"id":1,"title":"로그인 오류"}
  ▼
Browser
```

Request는 Client가 Server에 요구하는 내용을 담는다.

```text
Request
├─ Method: GET·POST 등
├─ Target: /tickets/1
├─ Headers: 요청에 관한 부가 정보
└─ Body: 생성·수정할 데이터가 필요할 때 사용
```

Response는 Server가 처리한 결과를 담는다.

```text
Response
├─ Status: 요청 처리 결과를 나타내는 HTTP 상태 코드
├─ Headers: Content-Type 등 응답에 관한 부가 정보
└─ Body: HTML·JSON 등 실제 표현 데이터
```

`404 Not Found`도 Server가 보낸 HTTP Response다. 업무상 원하는 Ticket을 찾지 못했다는 뜻이지, Response 자체가 없다는 뜻은 아니다. Server에 연결하지 못한 Network 실패에는 읽을 HTTP Status와 Body가 없다.

## `fetch()`를 호출하면 무엇을 받는가

```javascript
const responsePromise = fetch("/tickets/1");
```

`fetch()` 호출은 최종 Ticket을 바로 반환하지 않는다. 현재 호출자에게 `Promise<Response>`를 먼저 반환한다.

```text
fetch(url)
→ Network 작업 시작 요청
→ Promise<Response> 즉시 반환
→ 현재 JavaScript는 다음 줄을 계속 실행할 수 있음
→ Response를 사용할 수 있게 되면 Promise 결과 결정
```

Network 처리가 끝날 때까지 JavaScript Main Thread가 빈 반복문을 돌며 기다리는 것은 아니다. Promise가 결정되면 `then` Handler 또는 `await` 뒤의 나머지 부분이 Microtask로 이어진다.

### Promise를 먼저 반환하는 이유

Network 왕복은 현재 JavaScript 실행보다 오래 걸릴 수 있다. Response가 올 때까지 Main Thread 전체를 붙잡고 기다리면 Click과 Rendering도 지연된다. `fetch`는 최종 결과 대신 그 결과를 나타내는 Promise를 먼저 반환하므로 현재 호출 흐름이 계속 진행될 수 있다.

```javascript
console.log("A");

const responsePromise = fetch("/tickets/1");

console.log("B");
```

이 Code에서 `fetch`는 Promise를 반환하고 호출을 끝내므로 Response보다 `B`가 먼저 출력될 수 있다.

### `await fetch(...)`가 미루는 범위

```javascript
async function loadTicket() {
    console.log("B");

    const response = await fetch("/tickets/1");

    console.log("C", response.status);
}

console.log("A");
loadTicket();
console.log("D");
```

개념 흐름은 다음과 같다.

```text
현재 실행
→ A
→ loadTicket 진입
→ B
→ fetch가 Promise 반환
→ await가 loadTicket의 나머지 부분을 미룸
→ 호출자에게 제어 반환
→ D

Response 도착 뒤 Microtask
→ loadTicket의 나머지 부분 재개
→ C와 Status 출력
```

`await`가 Browser 전체를 멈추는 것이 아니다. 현재 Async Function에서 `await` 뒤에 남은 부분만 미루고, 호출자와 Browser가 다른 작업을 처리할 기회를 준다.

## Promise 상태와 HTTP Status는 다른 축이다

가장 중요한 구분이다.

```text
Promise의 fulfilled / rejected
→ JavaScript가 사용할 Response를 얻었는가?

HTTP의 200 / 404 / 500
→ Server가 그 요청을 어떤 결과로 처리했는가?
```

Server가 `404`나 `500`을 반환해도 Browser가 그 Response를 정상적으로 받았다면 `fetch` Promise는 보통 `fulfilled`가 된다. `catch`로 자동 이동하지 않는다.

```javascript
fetch("/tickets/999")
    .then((response) => {
        console.log(response.status);
    })
    .catch((error) => {
        console.log("Response를 얻지 못함", error);
    });
```

Server가 실제로 `404` Response를 보냈다면 첫 번째 Handler에서 `404`를 확인할 수 있다. Network 연결 실패, 잘못된 Scheme, CORS에 의한 Response 차단처럼 JavaScript가 사용할 Response를 얻지 못한 경우에는 Promise가 `rejected`될 수 있다.

### `Response.ok`

`response.ok`는 HTTP Status가 `200` 이상 `299` 이하일 때 `true`다.

```javascript
async function fetchTicket(ticketId) {
    const response = await fetch(`/tickets/${ticketId}`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}
```

이 Code에서 `throw`는 `fetch`가 `404` 때문에 자동 실패한 것이 아니다. Application이 `response.ok`를 검사한 뒤 “이 HTTP 결과를 다음 단계의 실패로 취급하겠다”고 명시한 것이다.

## Response는 Ticket이 아니며 Body 해석도 별도다

`fetch` Promise가 fulfilled됐다고 Body가 이미 올바른 JSON이라는 뜻은 아니다.

```text
await fetch(...)
→ HTTP Response 객체
   ├─ status
   ├─ ok
   ├─ headers
   └─ 아직 읽어야 하는 body

await response.json()
→ Body를 해석해 만든 JavaScript 값
```

따라서 `response` 자체는 Ticket 데이터가 아니다. `response.json()`으로 Body를 읽어야 `ticket`으로 사용할 후보 값을 얻는다.

```javascript
const response = await fetch("/tickets/1");

if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
}

const ticket = await response.json();
```

여기에는 서로 다른 두 Promise 경계가 있다.

```text
첫 번째 await
→ Status와 Header를 포함한 Response를 얻음

두 번째 await
→ Response Body를 읽고 JSON으로 해석함
```

`200 OK`여도 Body가 잘못된 JSON이면 `response.json()`이 실패할 수 있다. 따라서 “HTTP 성공”과 “Body 해석 성공”은 같은 근거가 아니다.

JSON 해석이 성공해도 `{ id, title, status }`처럼 Application이 기대한 Property가 모두 있다는 사실까지 자동으로 검증되지는 않는다. 문법적으로 올바른 JSON인지와 Helpdesk가 기대하는 Ticket 형식인지는 다시 구분한다.

Response Body는 Stream이므로 같은 Body를 일반적으로 두 번 소비할 수 없다. Debugging할 때 `response.json()`을 호출한 뒤 다시 `response.text()`로 읽으려 하면 별도의 문제가 생길 수 있다.

## 다섯 가지 대표 결과를 구분하기

| 상황 | JavaScript가 읽을 `Response` | `fetch` Promise | 추가 판정 | 가능한 UI 상태 |
|---|---|---|---|---|
| `200 OK`, 올바른 JSON | 있음 | `fulfilled` | `ok === true`, JSON 성공 | Success |
| `404 Not Found` | 있음 | `fulfilled` | `ok === false` | Not Found |
| `500 Internal Server Error` | 있음 | `fulfilled` | `ok === false` | Server Error |
| Server 연결 불가 | 없음 | `rejected` | HTTP Status 없음 | Network Error |
| `200 OK`, 잘못된 JSON | 있음 | 첫 Promise는 `fulfilled` | `json()` Promise 실패 | Invalid Response |

CORS 실패는 Browser가 Response를 JavaScript에 공개하지 않는 경우이므로 Script에서는 구체적인 Server Status 대신 Network 계열 실패처럼 보일 수 있다. 정확한 CORS 원인은 Browser Console과 Network Panel에서 함께 확인한다.

## `404` 처리 — Fetch API 요청과 Page Navigation은 다르다

“Browser가 `404`를 받았다”는 말만으로 화면 결과를 결정할 수 없다. 현재 페이지 안의 JavaScript가 API를 `fetch`한 것인지, Browser가 그 URL로 문서 이동한 것인지 먼저 구분한다.

### 현재 페이지에서 API를 `fetch`한 경우

```javascript
const response = await fetch("/tickets/999");
```

Server가 `404` JSON Response를 보내면 다음과 같이 처리된다.

```text
Server
→ Status 404와 JSON Body 반환

Browser Fetch
→ Response 객체를 JavaScript에 전달
→ Promise fulfilled
→ response.status === 404
→ response.ok === false

현재 Page
→ 자동으로 다른 404 Page로 이동하지 않음
```

Frontend가 아무 처리도 하지 않으면 현재 화면이 그대로 남거나 Loading 상태가 끝나지 않을 수 있다. Browser가 API Response의 Body를 전체 Page로 자동 Rendering하지 않는다.

Helpdesk의 Ticket 조회에서는 다음처럼 현재 조회 영역을 `Not Found` 상태로 바꾸는 것이 기본 대응이다.

```javascript
if (response.status === 404) {
    statusElement.textContent = "Ticket을 찾을 수 없습니다.";
    return;
}
```

### 주소창·일반 Link로 Page를 이동한 경우

```text
사용자가 /missing-page로 이동
→ Server가 Status 404와 HTML Body 반환
→ Browser가 받은 HTML 문서를 Rendering
```

이때 보이는 404 Page는 보통 Application Server, Web Server 또는 Framework가 만든 Response Body다. Browser가 모든 Site에 공통된 HTTP 404 Page를 자동 생성한 것이라고 단정하지 않는다.

Server가 유용한 HTML Body를 보내지 않았을 때의 표시는 Browser마다 다를 수 있다. 반면 Server 연결 자체가 실패해 HTTP Response가 없다면 Browser가 자체 Network 오류 Page를 표시할 수 있는데, 이것은 HTTP `404`가 아니다.

### Backend와 Frontend의 책임

```text
Backend
→ 실제 Resource가 없음을 판정
→ 정확한 HTTP 404 Status와 오류 Body 반환

Browser Frontend
→ API 404를 Not Found UI로 Mapping
→ 현재 영역에 Message를 표시하거나 필요한 경우 Route 이동
```

Client-side Frontend는 이미 받은 HTTP Status를 “반환”하는 주체가 아니다. Server가 Status를 반환하고 Frontend는 그 결과를 Rendering한다. Server-side Rendering이나 Backend Framework가 404 HTML까지 만드는 구조라면 Page 표현도 Server 측 책임일 수 있다.

## HTTP 결과와 UI 상태는 별도다

HTTP Status는 통신 결과이고, UI 상태는 사용자가 보게 될 Application 표현이다. Browser가 업무에 맞는 문구를 자동으로 정해 주지 않는다.

| 관찰 결과 | 권장 UI 상태 | 화면 예시 |
|---|---|---|
| 요청 진행 중 | Loading | `Ticket을 조회하는 중입니다.` |
| `200`과 올바른 Ticket Body | Success | Ticket 내용 표시 |
| `404` | Not Found | `Ticket을 찾을 수 없습니다.` |
| `403` | Forbidden | `조회 권한이 없습니다.` |
| `500` | Server Error | `요청 처리 중 오류가 발생했습니다.` |
| Response를 얻지 못함 | Network Error | `Server에 연결할 수 없습니다.` |
| JSON 또는 Ticket 형식 오류 | Invalid Response | `응답 형식이 올바르지 않습니다.` |
| 의도적으로 이전 요청 취소 | Aborted 또는 무표시 | 최신 요청 결과만 유지 |

같은 `404`라도 제품 요구에 따라 현재 영역에 문구를 표시하거나 별도 Route로 이동할 수 있다. 중요한 것은 HTTP Status와 UI 상태 사이의 Mapping을 Frontend Code와 Test로 명시하는 것이다.

## `then`과 `await`로 같은 흐름 표현하기

### `then` 방식

```javascript
fetch("/tickets/1")
    .then((response) => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
    })
    .then((ticket) => {
        renderTicket(ticket);
    })
    .catch((error) => {
        renderError(error);
    });
```

### `async`·`await` 방식

```javascript
async function loadTicket() {
    try {
        const response = await fetch("/tickets/1");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const ticket = await response.json();
        renderTicket(ticket);
    } catch (error) {
        renderError(error);
    }
}
```

두 Code는 Promise 기반 흐름을 서로 다른 문법으로 표현한다. 어느 문법을 사용하든 다음 판정은 개발자가 작성해야 한다.

- 어떤 HTTP Status를 어떤 UI 상태로 바꿀지
- Body를 어떤 형식으로 해석할지
- Abort와 Network 실패를 어떻게 구분할지
- 오래된 Response가 최신 UI를 덮지 못하게 할지

## Origin이란 무엇인가

Origin은 다음 세 값의 조합이다.

```text
Scheme + Host + Port
```

예시:

| URL | `http://localhost:8080`과 같은 Origin인가? | 이유 |
|---|---|---|
| `http://localhost:8080/tickets` | 예 | Scheme·Host·Port 모두 같음 |
| `http://localhost:5500/index.html` | 아니요 | Port가 다름 |
| `https://localhost:8080/tickets` | 아니요 | Scheme이 다름 |
| `http://127.0.0.1:8080/tickets` | 아니요 | Host가 다름 |

따라서 UI를 `http://localhost:5500`, API를 `http://localhost:8080`에서 실행하면 같은 PC 안에서도 Cross-Origin 요청이다.

## Same-Origin Policy와 CORS

Browser의 Same-Origin Policy는 한 Origin의 Script가 다른 Origin의 자원을 마음대로 읽지 못하게 제한한다. CORS는 Server가 HTTP Header로 특정 Origin의 Browser Script에 Response 공유를 허용하는 규칙이다.

```text
Browser Script
→ 다른 Origin에 요청
→ Server가 CORS 허용 Header로 응답
→ Browser가 정책을 검사
→ 허용되면 JavaScript에 Response 공개
→ 허용되지 않으면 JavaScript가 Response를 읽지 못함
```

CORS를 다음과 혼동하지 않는다.

- CORS는 사용자 인증이 아니다.
- CORS는 Role 기반 Authorization이 아니다.
- CORS는 CSRF 방어를 대체하지 않는다.
- CORS는 Server 자체가 요청을 받지 못하게 하는 Firewall이 아니다.
- `curl`이나 API Client에서 성공했다는 사실은 Browser CORS 성공 근거가 아니다.

## Simple Request와 Preflight Request

### Simple Request

Method와 Header가 CORS Safelist 조건을 만족하면 Browser가 별도의 사전 허가 요청 없이 실제 요청을 먼저 보낼 수 있다. 하지만 Response에 올바른 CORS Header가 없으면 JavaScript는 그 Response를 읽지 못한다.

즉, “Preflight가 없다”와 “CORS 검사가 없다”는 같은 말이 아니다.

### Preflight Request

실제 Cross-Origin 요청이 허용되는지 먼저 묻기 위해 Browser가 `OPTIONS` 요청을 보낼 수 있다.

```text
Browser
→ OPTIONS Preflight
   Origin
   Access-Control-Request-Method
   Access-Control-Request-Headers

Server
→ 허용 여부 응답
   Access-Control-Allow-Origin
   Access-Control-Allow-Methods
   Access-Control-Allow-Headers

Browser
→ 허용된 경우에만 실제 요청 전송
```

Preflight 자체에는 Session Cookie 같은 Credential을 보내지 않는다. Server는 Credential 없는 사전 요청에도 올바른 CORS 정책을 응답하고, 허용된 뒤의 실제 요청에서 Credential 사용 여부를 별도로 결정한다.

JSON 생성 요청은 흔히 다음 Header를 사용한다.

```http
Content-Type: application/json
```

`application/json`은 CORS Safelisted Request Header의 허용 Content-Type에 포함되지 않으므로 Cross-Origin JSON `POST`는 일반적으로 Preflight 대상이 된다.

## Session Cookie가 필요한 Cross-Origin Fetch

`fetch`의 Credential 기본값은 `same-origin`이다. 다른 Origin의 API에 Session Cookie를 보내려면 Client와 Server 양쪽 조건이 맞아야 한다.

```javascript
fetch("http://localhost:8080/tickets/1", {
    credentials: "include"
});
```

Server Response에도 다음 조건이 필요하다.

```http
Access-Control-Allow-Origin: http://localhost:5500
Access-Control-Allow-Credentials: true
```

Credential이 포함된 CORS Response에서 `Access-Control-Allow-Origin: *`는 사용할 수 없다. 허용할 Origin을 명시해야 한다. Cookie의 `SameSite` 등 Cookie 정책도 별도로 만족해야 하므로 `credentials: "include"` 한 줄만으로 전송이 항상 보장되는 것은 아니다.

이 구조에서도 CSRF 방어는 사라지지 않는다. Browser가 Cookie를 자동 전송할 수 있기 때문에 상태 변경 요청에는 기존 Week 4에서 학습한 CSRF Token 경계를 유지해야 한다.

## CORS 실패를 Network Panel에서 확인하는 순서

민감한 Cookie 값이나 Token 값은 복사해 문서에 남기지 않는다. 다음 구조만 확인한다.

1. Page URL과 API URL의 Origin을 각각 적는다.
2. `OPTIONS` 요청이 있었는지 본다.
3. Preflight Request의 요청 Method·Header 항목을 확인한다.
4. Preflight Response의 허용 Origin·Method·Header를 확인한다.
5. 실제 요청이 전송됐는지 확인한다.
6. 실제 Response Status와 CORS Header를 확인한다.
7. Console의 CORS 오류와 Network 결과를 연결한다.

### 구분해서 기록할 세 결과

```text
Preflight 실패
→ 실제 요청이 전송되지 않을 수 있음

Simple Request의 CORS Response 실패
→ 실제 요청은 Server에 도착했지만 JavaScript가 Response를 읽지 못할 수 있음

허용된 CORS Response의 HTTP 403
→ CORS는 통과했지만 Security 또는 업무 Authorization이 거부했을 수 있음
```

`403`이라는 숫자만으로 CORS, CSRF와 Authorization 중 어느 단계가 원인인지 단정하지 않는다.

## `no-cors`는 일반적인 해결책이 아니다

`mode: "no-cors"`를 지정하면 읽을 수 없는 Opaque Response가 생길 수 있다. Status와 Body를 JavaScript에서 사용해야 하는 Helpdesk UI에는 해결책이 아니다.

```text
목표
→ 실제 API Status와 JSON Body를 읽어 UI 상태를 결정

Opaque Response
→ Status·Header·Body를 정상적으로 읽을 수 없음

결론
→ Server의 정확한 CORS 허용 정책을 구성해야 함
```

## Abort와 실패를 구분하기

`AbortController`로 요청을 취소하면 Promise가 rejected될 수 있다. 이것은 Server가 `500`을 반환한 것과 다르고, 연결 실패와도 원인이 다르다.

```javascript
const controller = new AbortController();

fetch("/tickets/1", { signal: controller.signal })
    .catch((error) => {
        if (error.name === "AbortError") {
            return;
        }

        renderNetworkError();
    });

controller.abort();
```

Week 6 UI에서는 최소한 다음을 구분할 필요가 있다.

- HTTP `404`
- HTTP `403`
- 실제 Network 또는 CORS 실패
- 의도적인 Abort
- JSON 해석 실패

## 오늘의 최소 실험 순서

아직 실행하지 않은 계획이다. 실행 전 예상표를 먼저 작성한다.

1. 같은 Origin에서 `200` Response를 요청한다.
2. 존재하지 않는 Ticket으로 `404` Response를 요청한다.
3. Server를 중지한 상태에서 같은 요청을 보낸다.
4. UI와 API를 다른 Port로 실행하고 CORS 허용 전 결과를 확인한다.
5. CORS를 정확한 Origin에만 허용하고 다시 확인한다.
6. JSON `POST`에서 `OPTIONS`와 실제 요청을 구분한다.
7. Session Cookie와 CSRF Token을 유지한 요청은 별도 단계에서 검증한다.

각 Case에서 다음 근거를 남긴다.

| 항목 | 기록 내용 |
|---|---|
| 예상 | Promise 상태, HTTP Status, UI 상태 |
| Console | 오류 종류만 기록하고 민감 값 제외 |
| Network | `OPTIONS` 여부, 실제 요청 여부, Status |
| Code | `response.ok` 검사 위치와 오류 Mapping |
| 교정 | 예상과 실제가 다르면 어떤 축을 혼동했는지 |

## 흔한 오해

| 오해 | 교정 |
|---|---|
| HTTP `404`이면 `fetch`가 자동으로 rejected된다. | 읽을 수 있는 Response가 도착하면 보통 fulfilled이며 `ok`를 직접 검사한다. |
| `fetch`가 fulfilled면 Ticket 조회가 성공했다. | Promise 전달 성공과 HTTP·업무 성공은 별개다. |
| `200`이면 JSON도 올바르다. | Body 해석은 별도 Promise 경계다. |
| JSON 해석 성공이면 올바른 Ticket 객체다. | JSON 문법 성공과 기대 Property·Type 검증은 별개다. |
| API `fetch`가 `404`이면 Browser가 자동으로 404 Page를 표시한다. | Fetch Response는 JavaScript에 전달되며 현재 Page는 자동 이동하지 않는다. |
| 화면에 보이는 기본 404 Page는 Browser가 만들었다. | 문서 이동에서는 보통 Server나 Framework가 보낸 HTML Body를 Browser가 Rendering한다. |
| Frontend가 HTTP 404를 반환한다. | Server가 Status를 반환하고 Client Frontend는 이를 UI로 표현한다. |
| Preflight가 없으면 CORS 검사를 안 한다. | Simple Request도 Response 공유 정책을 검사한다. |
| CORS를 열면 인증과 CSRF가 해결된다. | CORS, 인증, 인가와 CSRF는 서로 다른 통제다. |
| `no-cors`를 쓰면 CORS가 해결된다. | 읽을 수 없는 Opaque Response는 API UI 요구를 충족하지 못한다. |
| API Client 성공이면 Browser도 성공한다. | Browser만 적용하는 CORS 정책은 Browser에서 확인해야 한다. |

## 핵심 질문

1. Server가 `404`를 반환했을 때 `fetch` Promise가 fulfilled될 수 있는 이유는 무엇인가?
2. `response.ok`와 Promise 상태는 각각 무엇을 판정하는가?
3. `200 OK` 뒤 `response.json()`이 실패할 수 있는 이유는 무엇인가?
4. JSON 해석 성공과 올바른 Ticket 형식 검증은 왜 다른가?
5. API `fetch`의 `404`와 Page Navigation의 `404`는 화면에 어떻게 다르게 나타나는가?
6. `404`에서 Backend와 Browser Frontend는 각각 무엇을 책임지는가?
7. HTTP Status와 UI 상태를 별도로 Mapping해야 하는 이유는 무엇인가?
8. Simple Request와 Preflight Request는 실제 요청을 보내는 순서가 어떻게 다른가?
9. CORS 실패와 HTTP `403`을 Network Panel에서 어떻게 구분할 수 있는가?
10. Cross-Origin Session 요청에서 Client와 Server가 각각 무엇을 설정해야 하는가?
11. CORS가 CSRF 방어를 대체하지 못하는 이유는 무엇인가?

## 완료와 근거의 경계

- 이 문서를 읽은 것만으로 Fetch·CORS 학습을 완료하지 않는다.
- `200`·`404`·연결 실패의 Promise 상태를 실행 전에 예상하고 실제 결과와 비교한다.
- 두 Origin 실험에서 `OPTIONS`와 실제 요청을 Network Panel로 구분한다.
- Session·CSRF를 끈 요청은 이번 Helpdesk의 실제 인증 흐름 근거로 사용하지 않는다.
- Console 출력만으로 Server 도달 여부를 단정하지 않고 Network Trace와 Server 측 근거를 함께 본다.

## 공식 참고 자료

- [MDN — Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [MDN — Response.ok](https://developer.mozilla.org/en-US/docs/Web/API/Response/ok)
- [MDN — 404 Not Found](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/404)
- [MDN — How Browsers Load Websites](https://developer.mozilla.org/en-US/docs/Learn_web_development/Getting_started/Web_standards/How_browsers_load_websites)
- [MDN — Cross-Origin Resource Sharing](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [MDN — Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy)
- [MDN — Access-Control-Allow-Credentials](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Credentials)
