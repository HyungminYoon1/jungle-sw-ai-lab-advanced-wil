# 2026-09-27 — 실제 Browser Session·CSRF와 CORS 실패 경계

> 날짜: 2026-09-27
> 학습 세션: 2026-09-27 야간 시작, 2026-09-28 02:29 KST 정리
> 학습 주제: Local Browser 사용자, Form Login, Session 인증 복원, CSRF 실패·성공 비교, Credential CORS와 Preflight 실패
> 상태: In Progress — `in-memory,local-browser` 실제 Browser 흐름과 CORS 실패 기준선은 확인했으며, CORS 허용 설정·최소 UI·PostgreSQL Browser E2E·품질 Gate는 9월 28일에 계속 진행

## 핵심 질문

1. JSESSIONID Cookie가 존재한다는 사실만으로 인증 성공을 증명할 수 있는가?
2. Form Login의 `302 Location: /` 뒤 `/`에서 `404`가 발생해도 Login 성공일 수 있는 이유는 무엇인가?
3. HTTP `403`을 받은 `fetch`가 `rejected`가 아니라 `fulfilled`인 이유는 무엇인가?
4. Session Cookie와 CSRF Header는 각각 누가 요청에 추가하는가?
5. 같은 사용자와 Role로 보낸 두 Ticket 생성 요청이 `403`과 `201`로 달라진 직접적인 조건은 무엇인가?
6. Cross-Origin GET에서 Server가 `200`을 반환해도 JavaScript가 Response를 읽지 못할 수 있는 이유는 무엇인가?
7. Cookie 없는 Preflight가 인증 단계에서 `401`이 되면 실제 POST는 어떻게 되는가?
8. Chrome Network에 `POST` 행이 보이는 것과 Server가 실제 POST를 받은 것은 왜 같은 근거가 아닌가?
9. 오늘의 실제 Browser 근거가 PostgreSQL 저장까지 증명하지 못하는 이유는 무엇인가?

## Local Browser Runtime 사용자를 Source와 분리했다

`local-browser` Profile에서만 Local USER와 AGENT를 만드는 Configuration을 추가했다. 실제 사용자명과 Password는 Source에 고정하지 않고 외부 Property에서 읽는다.

```text
local-browser Profile
→ 외부 사용자 설정 읽기
→ PasswordEncoder로 Encoding
→ InMemoryUserDetailsManager
   ├─ ROLE_USER
   └─ ROLE_USER, ROLE_AGENT
```

필수 설정이 없거나 공백이면 Application Context가 조용히 임의 사용자로 실행되지 않고 시작에 실패하도록 했다. Configuration Focused Test 3개는 다음을 확인했다.

- USER·AGENT Role과 BCrypt `matches` 성공
- 필수 설정 누락 시 Context 시작 실패
- 공백 설정 시 Context 시작 실패

Main Application Context를 사용하는 MockMvc Integration Test 2개에서는 Test 전용 Security Configuration을 따로 만들지 않고 `in-memory,local-browser` Profile과 Main Source Configuration으로 USER·AGENT Form Login을 확인했다. 두 Test Class의 총 5개 Test는 실패·오류·건너뜀 없이 통과했다.

이 결과는 Main Source의 Runtime 사용자 구성이 Spring Context에 조립되어 Form Login에 사용된다는 근거다. 실제 Browser와 TCP 연결을 증명하는 Test는 아니므로 Browser 실행을 별도로 확인했다. 새 변경을 포함한 전체 Java 회귀 Test는 아직 실행하지 않았다.

## JSESSIONID 존재와 인증 상태를 구분했다

실제 Server를 `in-memory,local-browser` Profile로 실행하고 Browser에서 다음 순서로 관찰했다.

```text
익명 GET /api/csrf
→ 401 Unauthorized
→ JSESSIONID Cookie는 존재할 수 있음

Form Login 성공
→ POST /login 302 Found
→ Location: /

후속 GET /api/csrf
→ Browser가 JSESSIONID 전송
→ Server가 HttpSession 식별
→ SecurityContext 복원
→ /api/**의 authenticated 조건 통과
→ 200 OK
```

처음에는 Login 뒤 화면에 나타난 `/`의 `404`를 Login 실패로 생각했다. 하지만 Login 응답은 `/`로 이동하라는 `302`였고, 현재 Application에는 `/`를 처리할 정적 Resource나 Controller가 없어 Redirect 뒤 요청이 `404`가 된 것이었다. 같은 Browser Session으로 보호된 `/api/csrf`가 `200`을 반환한 것이 인증 복원의 직접적인 후속 근거였다.

익명 요청에도 Session이 만들어질 수 있으므로 JSESSIONID Cookie의 존재만으로 인증 성공을 판단할 수 없다. Server Session 안에 인증된 `SecurityContext`가 있고 보호된 요청에서 복원되는지를 확인해야 한다.

## CSRF 실패와 권한 실패를 같은 `403`으로 해석하지 않았다

로그인한 AGENT의 같은 Session으로 Ticket 생성 요청을 두 번 비교했다.

| 조건 | Token 없는 POST | 유효한 Token이 있는 POST |
|---|---:|---:|
| JSESSIONID | 포함 | 포함 |
| Authentication 복원 | 성공 | 성공 |
| CSRF Header | 없음 | 있음 |
| CSRF 검증 | 실패 | 성공 |
| Authorization | 도달 전 중단 | USER·AGENT 조건 통과 |
| Controller 진입 | 미진입 | 진입 |
| 응답 | `403 Forbidden` | `201 Created` |

처음에는 Token 없는 요청의 Authorization도 실패했다고 답했다. 현재 Filter Chain에서는 CSRF 검증에서 요청이 중단되므로 Role Authorization은 평가되지 않는다. AGENT는 Ticket 생성 Role 조건을 만족하므로 유효한 CSRF Token이 있었다면 Authorization을 통과한다.

Token 없는 요청도 Server로부터 실제 `403 Response`를 받았으므로 Fetch Promise는 `fulfilled`이고 `response.ok`는 `false`였다. 연결 실패나 CORS 차단처럼 JavaScript가 Response를 받지 못할 때 Fetch Promise가 `rejected`된다.

성공 요청의 흐름은 다음과 같다.

```text
GET /api/csrf
→ Response의 headerName과 token을 JavaScript가 읽음

POST /api/tickets
→ Browser가 JSESSIONID Cookie 자동 첨부
→ JavaScript가 응답받은 이름으로 CSRF Header 직접 첨부
→ CSRF·Authorization 통과
→ 201 Created와 Location Header
```

`x-csrf-token`처럼 소문자로 표시되어도 HTTP Header 이름은 대소문자를 구분하지 않는다. 실제 Session ID와 CSRF Token 값은 학습노트와 Source에 기록하지 않는다.

이번 `201 Location`은 새로 생성한 Resource의 URI를 알려주는 Header다. Login의 `302 Location`처럼 현재 Page를 Redirect하라는 뜻은 아니다.

## CORS는 Server 응답과 JavaScript 접근을 분리한다

다른 Origin인 `http://127.0.0.1:4173`에서 `http://127.0.0.1:8080`의 CSRF Endpoint를 요청했다.

```text
Cross-Origin GET /api/csrf
→ credentials: "include"
→ JSESSIONID 포함
→ OPTIONS 없음
→ Server 응답 200 OK
→ Access-Control-Allow-Origin 없음
→ Browser가 JavaScript에 Response를 전달하지 않음
→ Fetch rejected TypeError
```

GET과 사용자 정의 Header가 없는 요청은 Simple Request가 될 수 있으므로 Preflight 없이 Server에 도달했다. 이 결과로 CORS가 요청의 Server 도달 자체를 항상 막는 장치가 아니라, 허용되지 않은 Origin의 JavaScript가 Response를 읽지 못하게 하는 Browser 정책이라는 점을 실제로 확인했다.

## Preflight 실패와 실제 POST를 구분했다

`Content-Type: application/json`을 사용하는 Cross-Origin POST에서는 Browser가 먼저 Preflight를 보냈다.

```text
OPTIONS /api/tickets
Origin: http://127.0.0.1:4173
Access-Control-Request-Method: POST
Access-Control-Request-Headers: content-type
```

Preflight에는 JSESSIONID Cookie가 없었다. 현재 Application에는 Helpdesk CORS 허용 설정이 없으므로 Security가 이를 익명 보호 요청으로 처리해 `401 Unauthorized`를 반환했다. 응답에는 `Access-Control-Allow-Origin`도 없었다.

처음에는 Response에서 `content-type`을 보고 CORS 허용 Header가 있다고 생각했다. `Content-Type`은 Body의 Media Type이고, CORS에서 Origin 허용을 나타내는 Header의 정확한 이름은 `Access-Control-Allow-Origin`이다. Preflight Request의 `Access-Control-Request-Headers: content-type`도 Browser가 사용 허가를 묻는 값이지 Server의 허가 응답이 아니다.

Chrome Network 목록에 `POST` 행이 보여 실제 POST가 Server에 도달했다고 생각했다. 별도 자동화 Chrome에서 Browser Network Event를 확인한 결과는 다음과 같았다.

| Method | Response 수신 | HTTP Status | 실패 | Browser 실패 이유 |
|---|---:|---:|---:|---|
| `OPTIONS` | 예 | `401` | 아니요 | 없음 |
| `POST` | 아니요 | 없음 | 예 | `PreflightMissingAllowOriginHeader` |

Network의 `POST` 행은 JavaScript가 요청한 작업을 나타낼 수 있지만 실제 HTTP POST가 전송되어 Server Response를 받았다는 증거는 아니다. 이번에는 OPTIONS만 Response를 받았고, Browser는 실패한 Preflight 뒤 실제 POST 전송을 중단했다.

## 현재 실행 근거와 남은 범위

| 항목 | 현재 근거 | 상태 |
|---|---|---|
| Local Browser Runtime 사용자 | Main Source Configuration, Focused Test 3개 | `IMPLEMENTED` / `PASSED` |
| Main Context Form Login | MockMvc Integration Test 2개 | `PASSED` |
| 실제 Browser Session 복원 | 익명 `401`, Login `302`, 인증 뒤 `/api/csrf` `200` | `USER_VERIFIED` |
| 실제 Browser CSRF 실패·성공 | Token 없음 `403`, 유효 Token `201`과 Location | `USER_VERIFIED` |
| 위 Ticket 저장 위치 | `in-memory` Profile | PostgreSQL 근거 아님 |
| Credential CORS Simple GET | Server `200`, JavaScript Fetch `rejected` | 실패 기준선 확인 |
| JSON POST Preflight | OPTIONS `401`, 실제 POST Response 없음 | 실패 기준선 확인 |
| Helpdesk CORS 허용 설정 | 구현하지 않음 | `NOT_IMPLEMENTED` |
| 최소 Ticket UI·JavaScript Test | 구현하지 않음 | `NOT_IMPLEMENTED` / `NOT_RUN` |
| 실제 Browser·Session·CSRF·PostgreSQL E2E | 실행하지 않음 | `NOT_RUN` |
| 새 변경 포함 전체 Java 회귀 | Focused Test만 실행 | `NOT_RUN` |
| JavaScript Coverage·Lint | 실행하지 않음 | `NOT_RUN` |
| Week 6 WIL | 작성하지 않음 | `NOT_WRITTEN` |

## 최종적으로 정리한 이해

1. JSESSIONID는 Session을 찾는 식별자이며 그 존재 자체가 인증된 `SecurityContext`를 의미하지 않는다.
2. Login 성공 응답과 Redirect된 목적지의 `404`는 서로 다른 HTTP 요청의 결과다.
3. HTTP `403`은 읽을 Response가 있으므로 Fetch Promise가 `fulfilled`될 수 있다.
4. Browser는 Session Cookie를 자동 전송하지만 JavaScript는 CSRF Header를 직접 구성한다.
5. 같은 인증·Role에서도 유효한 CSRF Token의 유무와 일치 여부에 따라 `403`과 `201`이 달라진다.
6. CORS 실패는 Server가 응답하지 않았다는 뜻이 아니며, Server `200` 뒤에도 JavaScript 접근이 차단될 수 있다.
7. Credential 없는 Preflight가 Security에서 먼저 거부되면 Browser는 실제 인증 POST를 보내지 않는다.
8. Network 목록의 요청 행, Server가 받은 요청과 JavaScript가 읽은 Response를 각각 구분해야 한다.
9. 오늘의 실제 Browser Ticket 생성은 In-memory Repository를 사용했으므로 PostgreSQL E2E 근거가 아니다.

> 하나의 Status만 보고 실패 원인을 정하지 않고, Request Method·Cookie·CSRF Header·CORS Response Header·Controller 진입·Repository Profile을 함께 확인해야 한다.

## 다음 학습에서 다시 답할 핵심 질문

1. CORS 처리가 Security 인증보다 먼저 Preflight를 처리해야 하는 이유는 무엇인가?
2. Credential CORS에서 `Access-Control-Allow-Origin: *`를 사용할 수 없는 이유는 무엇인가?
3. Server는 `4173` Origin과 `Content-Type`, `X-CSRF-TOKEN` Header를 어디에서 명시적으로 허용해야 하는가?
4. CORS 허용 뒤 실제 POST는 JSESSIONID와 CSRF Token을 각각 어떻게 전달하는가?
5. 최소 UI의 HTTP 오류 Mapping·JSON 구조 검증·`textContent`·Event Delegation·Response Race를 어떻게 Test할 것인가?
6. 같은 Browser 흐름을 `postgres,local-browser` Profile로 실행할 때 어느 근거가 PostgreSQL 저장을 증명하는가?
7. Focused Test와 실제 Browser 확인 뒤 전체 Java·JavaScript 회귀를 별도로 실행해야 하는 이유는 무엇인가?
