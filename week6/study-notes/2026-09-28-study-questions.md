# 2026-09-28 — Credential CORS와 Fetch 응답 경계

> 학습 주제: Preflight·실제 응답의 CORS 허용, `401`·`403`과 읽을 수 없는 응답, HTTP·JSON·Ticket 검증
> 상태: In Progress — CORS Focused Test와 `in-memory,local-browser` Browser 비교까지 확인. 최소 Ticket UI와 PostgreSQL Browser E2E는 아직 진행하지 않음

## 핵심 질문

1. Server가 응답에 넣는 `Access-Control-Allow-Origin`은 Browser에 무엇을 허용하는가?
2. Preflight가 성공해도 실제 요청의 인증·CSRF·인가가 실패할 수 있는 이유는 무엇인가?
3. 실제 요청이 Server에 도달했는데도 JavaScript가 HTTP Status를 읽지 못하는 경우는 언제인가?
4. 같은 `403`이라도 CSRF 실패와 Role 부족을 어떻게 구분할 것인가?
5. `response.ok`, `response.json()`과 `isTicket(body)`는 각각 무엇을 확인하는가?

## CORS가 허용하는 것은 응답에 대한 JavaScript의 접근이다

Origin은 Scheme·Host·Port의 조합이다. 같은 컴퓨터를 가리키더라도 `localhost`와 `127.0.0.1`은 Host가 다르므로 서로 다른 Origin이다. Server가 `http://127.0.0.1:4173`만 허용했다면 `http://localhost:4173`은 일치하지 않는다.

Cross-Origin 요청에서 Browser는 `Origin`을 보내고, Server는 허용할 경우 응답에 `Access-Control-Allow-Origin`을 넣는다. Session Cookie를 사용할 때에는 정확한 Origin과 `Access-Control-Allow-Credentials: true`가 함께 필요하다. `*`는 모든 Origin이라는 뜻이며, Credential을 포함한 요청의 응답을 공유하는 값으로 사용할 수 없다.

처음에는 `Access-Control-Allow-Origin`이 없으면 실제 요청 자체가 항상 Server에 도달하지 않는다고 생각했다. 지금은 요청 종류를 먼저 구분한다.

```text
Preflight가 필요한 요청
→ OPTIONS가 허용되지 않으면 Browser가 실제 요청을 보내지 않음

Preflight가 없는 단순 GET
→ 실제 GET은 Server에 도달할 수 있음
→ 실제 응답의 CORS 검사가 실패하면 JavaScript는 Response를 읽지 못함
```

Preflight와 실제 요청은 별개의 HTTP 요청이다. `OPTIONS`에는 Session Cookie가 없으며 Origin·Method·요청 Header 사용 가능 여부를 묻는다. 허용된 뒤 전송되는 실제 POST는 Session 인증, CSRF 검증과 Role 인가를 각각 통과해야 한다. 실제 응답에도 올바른 CORS Header가 있어야 JavaScript가 Status와 Body를 읽을 수 있다.

## Preflight는 Status뿐 아니라 허용 Header까지 확인했다

Helpdesk의 `local-browser` Profile에 구체적인 UI Origin 하나, `GET`·`POST`·`OPTIONS`, `Content-Type`·`X-CSRF-TOKEN`, Credential 허용을 설정했다. CORS 처리를 Security Filter Chain에 연결해 Cookie가 없는 Preflight를 일반 인증 검사보다 먼저 처리한다.

Focused Test에서 처음에는 Preflight가 `401`이었다. CORS Filter를 켠 뒤에는 `200`이 되었지만 `Access-Control-Allow-Origin`이 없어 여전히 Browser가 허용할 응답이 아니었다. 사용 중인 Spring Security가 찾는 `corsConfigurationSource` Bean으로 정책을 연결한 뒤에야 `200`과 필요한 `Access-Control-Allow-*` Header를 함께 확인했다. 그래서 나는 Preflight의 Status `200` 하나만으로 CORS 성공을 판정하지 않는다.

같은 Test Class에서는 허용되지 않은 Origin의 OPTIONS가 `403`이고 허용 Origin Header가 없으며 Controller에 진입하지 않는 것도 확인했다. 허용된 Origin의 익명 Ticket GET은 인증 실패 `401`을 반환하면서 CORS Header를 포함했다. 이는 UI가 CORS 실패와 인증 실패를 구분할 수 있도록 Server가 응답한다는 근거다.

## 실제 Browser에서 읽을 수 있는 응답과 없는 응답을 비교했다

다른 로컬 Page에서 처음 시도한 요청은 그 Page의 Content Security Policy에 먼저 막혔다. 이 `TypeError`만 보고 Helpdesk의 CORS 실패라고 결론 내릴 수 없었다. 별도의 빈 실험 Page를 사용해 Page 자체의 정책을 분리한 뒤 다시 관찰했다. Browser 실행 때 허용 Origin은 `http://127.0.0.1:4174`로 설정했고, 허용되지 않은 비교 Origin은 다른 Port를 사용했다.

| 조건 | Browser JavaScript에서 관찰한 결과 |
|---|---|
| 허용 Origin, 익명 Ticket GET, `credentials: "include"` | `fetch` fulfilled, `response.status === 401`, `response.ok === false` |
| 허용 Origin, JSON POST, CSRF Header 없음 | `fetch` fulfilled, `response.status === 403`, `response.ok === false` |
| 허용되지 않은 Origin, Ticket GET | `fetch` rejected, `TypeError`; 읽을 `response.status` 없음 |

이 Browser 비교는 `in-memory,local-browser` Profile에서 수행했다. 두 번째 요청의 `403`이라는 숫자만으로 일반적인 Client가 CSRF와 Role 부족을 항상 구분할 수 있는 것은 아니다. 이번 요청은 Token을 붙이지 않았다는 입력 조건을 알고 있다. 실제 Browser에서 유효한 Session·CSRF Token으로 Ticket을 생성하는 `201`이나 PostgreSQL 저장을 오늘 검증한 것은 아니다.

## 같은 Status를 원인과 섞지 않는다

CSRF Token이 없는 POST의 `403`과 인증된 USER의 AGENT 전용 조회 `403`은 원인이 다르다. 전자는 CSRF 검증에서 중단될 수 있고, 후자는 인증 뒤 Role 인가에서 거부된다. 따라서 모든 `403`에서 `/api/csrf`를 다시 호출해 POST를 자동 재시도하면 안 된다. 현재 `/api/csrf`가 `401`을 반환한다면 유효한 로그인 상태가 없으므로 로그인 안내가 먼저다.

`/api/csrf` 호출이 매번 새 Token을 발급한다는 뜻도 아니다. 현재 Session에 연결된 Token의 Header 이름과 값을 받아 후속 요청에 사용한다. `csrf.headerName`은 Header의 이름이고 `csrf.token`은 그 Header에 넣는 값이다. Browser는 Session Cookie를 자동으로 보낼 수 있지만 CSRF Header는 JavaScript가 직접 구성한다.

실제 POST가 Server에서 성공한 뒤 응답의 CORS 허용이 빠지는 경우도 생각했다. 이때 Browser JavaScript가 응답을 읽지 못한다고 해서 Server의 변경이 Rollback되는 것은 아니다. 이 상태를 단순한 저장 실패로 표시하고 POST를 자동 재시도하면 중복 생성 위험이 있다. 이 경우는 오늘 직접 만든 Ticket의 관찰 결과가 아니라 CORS와 Server 작업 순서에 대한 추론이다.

## HTTP 성공, JSON 해석과 Ticket 검증은 세 단계다

`fetch()`가 fulfilled됐다는 것은 JavaScript가 사용할 `Response`를 얻었다는 뜻이다. `response.ok`는 Status가 `2xx`인지 확인할 뿐 Body의 형식은 검사하지 않는다.

Node의 `data:` URL 최소 예제에서는 HTML Body를 가진 `Response`가 `200`으로 도착해 `fetch`는 fulfilled·`ok`는 `true`였다. 그 뒤 `response.json()`은 HTML을 JSON으로 해석하지 못해 `SyntaxError`로 rejected됐다. 뒤 단계의 실패가 앞서 결정된 Fetch Promise를 다시 rejected로 바꾸지는 않는다. 이 예제는 실제 Helpdesk Server 응답 Test가 아니다.

```text
Response 수신·HTTP 2xx
→ JSON 문법 해석
→ Ticket의 필드·Type·값 검증
→ 화면 표시
```

반대로 `{"id":1,"title":"","status":"OPEN"}`는 JSON으로 해석할 수 있지만, 빈 제목을 거부하는 Ticket 검증에서는 실패한다. 이때 `response.json()`은 성공하고 `isTicket(body)`는 `false`다. 두 실패 모두 UI에는 응답 형식 오류로 표시할 수 있으나, 연결 실패나 CORS 차단을 뜻하는 Network 오류로 기록하면 원인을 잘못 설명하게 된다. `isTicket`을 사용하는 실제 UI Test는 아직 작성하지 않았다.

## 현재 근거와 다음 단계

- CORS 허용·거부와 익명 실제 GET 응답을 검증하는 `LocalBrowserSessionIntegrationTest` 5개 통과, 실패·오류·건너뜀 0. 기존 Security Integration Test 두 Class도 다시 통과했다.
- 실제 Browser에서는 허용 Origin의 `401`·`403`을 JavaScript가 읽고, 허용되지 않은 Origin의 GET은 `TypeError`로 rejected되는 것을 확인했다.
- 이 근거는 Local In-memory 실행 범위다. 인증된 Cross-Origin 생성 `201`, 최소 Ticket UI·JavaScript Test, PostgreSQL Browser E2E와 새 변경 전체 회귀는 아직 확인하지 않았다.
- 다음에는 UI에서 `401`·`403`·읽을 Response가 없는 실패, JSON 해석 실패와 Ticket 구조 실패를 분리하고, 그 뒤 실제 Session·CSRF·PostgreSQL 흐름을 검증한다.

관련 학습자료: [Fetch의 HTTP 오류와 CORS 기초](../study-docs/fetch-http-cors-foundations.md), [Browser Ticket UI·Session·CSRF 흐름](../study-docs/browser-ticket-ui-session-csrf-flow.md)
