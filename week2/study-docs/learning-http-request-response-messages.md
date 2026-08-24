# Learning Note — HTTP 요청·응답 메시지

> 작성일: 2026-08-24
> 주차: Week 2
> 기준: RFC 9110 HTTP Semantics, RFC 9112 HTTP/1.1
> 이해 상태: 학습 자료 준비 — 직접 설명·실제 Server `curl.exe` Trace `NOT_RUN`

## 핵심 질문

> Client와 Server는 하나의 HTTP 요청과 응답에서 어떤 정보로 행동의 의미, 데이터 형식과 처리 결과를 합의하는가?

## 학습 목표

이 자료를 학습한 뒤 다음 내용을 자신의 말로 설명하는 것이 목표다.

- HTTP Request와 Response의 Start Line, Header Section, 빈 줄과 Body를 구분한다.
- Method, Request Target과 Status Code가 각각 무엇을 표현하는지 설명한다.
- `Content-Type`, `Accept`, `Location`과 `Content-Length`의 역할을 구분한다.
- Ticket 생성·조회에서 예상되는 정상·실패 HTTP 계약을 Code보다 먼저 작성한다.
- HTTP의 Stateless가 “Server가 아무 상태도 저장하지 않는다”는 뜻이 아닌 이유를 설명한다.
- 예상 메시지와 실제 `curl.exe` Trace를 구분하고, 관찰 후 차이를 기록한다.

이 문서가 준비되었다는 사실만으로 위 목표를 완료한 것은 아니다. 직접 설명과 실제 Trace가 생기기 전까지 Week 2 Learning Evidence Gate는 완료 처리하지 않는다.

## 시작 전 자가진단

자료를 읽기 전에 다음 질문에 짧게 답한다. 정답을 먼저 찾기보다 현재 이해와 불확실한 부분을 남기는 것이 목적이다.

1. `POST /api/tickets`에서 `POST`와 `/api/tickets`는 각각 무엇을 뜻하는가?
2. `Content-Type`과 `Accept`는 모두 JSON을 가리킬 수 있는데 역할이 어떻게 다른가?
3. 생성 성공에 `200 OK`가 아니라 `201 Created`를 선택할 이유는 무엇인가?
4. HTTP가 Stateless라면 Server는 Ticket을 Memory나 Database에 저장할 수 없는가?
5. 같은 TCP 연결에서 연속으로 들어온 두 요청을 같은 사용자의 요청이라고 단정할 수 있는가?

## 한 문장 설명

HTTP 메시지는 Client가 Method·Target·Field·Content로 요청 의도를 전달하고, Server가 Status·Field·Content로 처리 결과를 반환하는 자기 설명적 Request·Response 교환이다.

## 먼저 구분할 경계: 의미와 전송 문법

HTTP를 학습할 때 “메시지가 무엇을 뜻하는가”와 “특정 Version이 Wire에서 어떻게 표현하는가”를 분리해야 한다.

| 구분 | 담당 내용 | 이번 자료의 사용 방식 |
|---|---|---|
| HTTP Semantics | Method, Status, Field와 Content가 전달하는 의미 | 모든 HTTP Version에 공통인 설명 기준 |
| HTTP/1.1 Message Syntax | Start Line, CRLF, Field Line, 빈 줄과 Message Body | 사람이 읽을 수 있는 원문 예시 |
| HTTP/2·HTTP/3 | 각 Version 고유의 Frame과 전송 방식 | 이번 주 상세 구현·비교 대상에서 제외 |

RFC 9110은 HTTP Version마다 메시지 전송 문법이 다르더라도 의미를 보존할 수 있는 공통 Message Abstraction을 정의한다. 따라서 아래의 HTTP/1.1 Text 예시를 HTTP/2·HTTP/3도 그대로 전송한다고 일반화하지 않는다.

## HTTP/1.1 메시지의 공통 형태

HTTP/1.1 메시지는 Start Line, Header Field, Header Section의 끝을 표시하는 빈 줄과 선택적 Message Body로 구성된다.

```text
start-line CRLF
header-field CRLF
header-field CRLF
CRLF
[message-body]
```

- Request의 Start Line은 Request Line이다.
- Response의 Start Line은 Status Line이다.
- `CRLF`는 Carriage Return과 Line Feed로 이루어진 줄 끝이다.
- 첫 번째 빈 줄은 Header Section의 끝을 나타낸다.
- Body가 항상 존재하는 것은 아니다.
- HTTP/1.1에서 Body의 존재와 길이는 `Content-Length`, `Transfer-Encoding`, Response Status와 연결 상태 등 Message Framing 규칙에 따라 결정된다.

입문 설명에서는 전송할 데이터를 흔히 Body라고 부른다. RFC 9110의 Content는 전송 Coding을 해제한 뒤의 표현 데이터이고, RFC 9112의 Message Body는 HTTP/1.1 Framing에 포함된 Octet Stream이다. 이번 학습에서는 둘의 차이를 인식하되 Transfer Coding 상세 구현은 범위에서 제외한다.

## Request 구조

HTTP/1.1 Request Line의 기본 구조는 다음과 같다.

```text
method SP request-target SP HTTP-version CRLF
```

Ticket 생성의 예상 요청을 원문 형태로 표현하면 다음과 같다.

```http
POST /api/tickets HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Accept: application/json
Content-Length: 28

{"title":"로그인 오류"}
```

이 예시는 아직 실제 Server에 전송한 Trace가 아니라 구현 전 예상 메시지다. `Content-Length: 28`은 위 JSON을 공백 없이 UTF-8로 Encoding한 정확한 Body를 기준으로 한 Octet 수다. JSON의 공백이나 값이 바뀌면 길이도 바뀌며, 실제 값은 Client가 계산하게 한다.

### Request 각 부분의 역할

| 부분 | 예시 | 의미 |
|---|---|---|
| Method | `POST` | Target Resource가 Request Content를 어떻게 처리하기를 원하는지 나타냄 |
| Request Target | `/api/tickets` | 요청이 향하는 Resource 식별 경로 |
| HTTP Version | `HTTP/1.1` | 이 연결에서 사용하는 메시지 문법 Version |
| `Host` | `localhost:8080` | 요청이 향하는 Host와 Port Authority |
| `Content-Type` | `application/json` | 이 요청에 포함된 Content의 Media Type |
| `Accept` | `application/json` | Client가 Response로 선호하는 Media Type |
| `Content-Length` | `28` | HTTP/1.1 Message Body의 Octet 수 |
| 빈 줄 | Header 뒤 한 줄 | Header Section이 끝났음을 표시 |
| Body | Ticket JSON | Server가 처리할 Request Content |

### `GET`과 `POST`

| Method | 핵심 의미 | 현재 Ticket Lab 사용 |
|---|---|---|
| `GET` | Target Resource의 현재 선택된 Representation 전송을 요청 | `GET /api/tickets/{id}` 단건 조회 |
| `POST` | Target Resource가 Request Representation을 자신의 의미에 따라 처리하도록 요청 | `POST /api/tickets` Ticket 생성 |

`POST`가 언제나 생성을 뜻하는 것은 아니다. RFC의 의미는 Target Resource가 전달된 Representation을 자신의 규칙에 따라 처리하도록 요청하는 것이며, 새 Resource 생성은 대표적인 사용 사례다.

`GET` Request Content가 문법적으로 무조건 금지된다고 단정하지 않는다. 다만 일반적으로 정의된 의미가 없고 일부 구현이 이를 거부할 수 있으므로, 현재 Ticket 조회 계약에서는 GET Body를 사용하지 않는다.

## Response 구조

HTTP/1.1 Status Line의 기본 구조는 다음과 같다.

```text
HTTP-version SP status-code SP [reason-phrase] CRLF
```

Ticket 생성 성공의 예상 Response는 다음과 같다.

```http
HTTP/1.1 201 Created
Location: /api/tickets/1
Content-Type: application/json
Content-Length: 51

{"id":1,"title":"로그인 오류","status":"OPEN"}
```

이 Response도 실제 실행 결과가 아니라 구현 전 예상 계약이다. `Content-Length: 51`은 표시한 JSON을 공백 없이 UTF-8로 Encoding한 경우의 Octet 수다. 실제 JSON Field 순서와 공백은 계약으로 간주하지 않으며, 실제 길이는 Server가 생성한 Body에 따라 달라진다.

### Response 각 부분의 역할

| 부분 | 예시 | 의미 |
|---|---|---|
| HTTP Version | `HTTP/1.1` | Response 메시지에 사용된 Protocol Version |
| Status Code | `201` | Request 처리 결과의 표준화된 의미 |
| Reason Phrase | `Created` | 사람이 읽기 위한 선택적 설명이며 Program 판단 기준으로 사용하지 않음 |
| `Location` | `/api/tickets/1` | 생성된 주 Resource를 가리키는 URI Reference |
| `Content-Type` | `application/json` | Response Content의 Media Type |
| Body | Ticket JSON | 생성 결과를 나타내는 Representation |

Client는 Reason Phrase 문자열이 아니라 세 자리 Status Code의 의미를 기준으로 처리한다. HTTP/2·HTTP/3에는 HTTP/1.1과 같은 Text Status Line이 없으므로 `Created` 문자열에 의존하지 않는다.

## Ticket API의 예상 Method·Status 계약

아래 표는 구현과 실제 검증 전의 예상 계약이다.

| Request | 예상 결과 | 선택 이유 | 현재 검증 상태 |
|---|---|---|---|
| `POST /api/tickets` + 유효한 제목 | `201 Created`, `Location`, Ticket JSON | 새 Resource가 생성됨 | `NOT_RUN` |
| `GET /api/tickets/1` + 존재하는 ID | `200 OK`, Ticket JSON | 현재 Representation 조회 성공 | `NOT_RUN` |
| `POST /api/tickets` + 잘못된 JSON·공백 제목 | `400 Bad Request` | 현재 계약에서 Client Request 오류로 처리 | `NOT_RUN` |
| `GET /api/tickets/999999` + 존재하지 않는 ID | `404 Not Found` | Target Resource의 현재 Representation을 찾지 못함 | `NOT_RUN` |
| 통제된 내부 예외 | `500 Internal Server Error` | 예상하지 못한 Server 조건으로 요청 수행 실패 | `NOT_RUN` |

Status Class를 먼저 구분하면 개별 Code를 이해하기 쉽다.

| 범위 | 분류 | 현재 예시 |
|---:|---|---|
| `2xx` | 요청이 성공적으로 처리됨 | `200`, `201` |
| `4xx` | Request 또는 Client 측 조건과 관련된 실패 | `400`, `404` |
| `5xx` | Server가 요청 수행에 실패 | `500` |

`4xx`가 항상 사용자의 실수라는 뜻은 아니며, `5xx`가 모든 Server 내부 예외를 그대로 공개해도 된다는 뜻도 아니다. 오류 Response에는 Stack Trace, 내부 Class 이름, 로컬 경로와 민감 값을 포함하지 않는다.

## 핵심 Header 구분

| Header | 주로 사용하는 방향 | 설명 | 자주 하는 오해 |
|---|---|---|---|
| `Content-Type` | Request·Response | 현재 Message Content의 Media Type | 받고 싶은 형식을 지정한다고 생각함 |
| `Accept` | 주로 Request | Response에서 선호하는 Media Type | 현재 Request Body 형식이라고 생각함 |
| `Location` | Response | Status·Method와 함께 특정 Resource를 가리킴 | 모든 성공 Response에 필수라고 생각함 |
| `Host` | HTTP/1.1 Request | Target Host와 Port Authority 전달 | Resource Path와 같은 정보라고 생각함 |
| `Content-Length` | Request·Response | HTTP/1.1 Body Framing을 위한 Octet 수 | 문자 개수라고 생각함 |

다음 두 문장을 구분해서 말할 수 있어야 한다.

```http
Content-Type: application/json
```

> 이 Message가 실제로 담고 있는 Content는 JSON이다.

```http
Accept: application/json
```

> Client는 Response Representation으로 JSON을 선호한다.

## Stateless의 정확한 의미

RFC 9110에서 HTTP가 Stateless라는 것은 각 Request Message의 의미를 다른 Request와의 연결 관계 없이 독립적으로 이해할 수 있다는 뜻이다.

```text
Request A ── 독립적으로 해석 가능
Request B ── 독립적으로 해석 가능
```

Stateless는 다음을 뜻하지 않는다.

- Server가 Ticket을 Memory나 Database에 저장할 수 없다.
- 로그인 Session을 구현할 수 없다.
- 같은 Client가 여러 Request를 보낼 수 없다.
- 하나의 TCP 연결에서 여러 Message를 교환할 수 없다.

Server가 Session을 저장하더라도 Client가 각 Request에 Session 식별 Cookie를 보내면 해당 Request를 해석할 수 있다. 반대로 같은 연결에서 연속으로 들어왔다는 사실만으로 두 Request를 같은 사용자의 것으로 단정하면 안 된다.

현재 Week 2에서는 인증·Session을 구현하지 않는다. Stateless의 의미만 설명하고 실제 Session 검증은 Week 4 범위로 남긴다.

## Request·Response 핵심 흐름

```text
Client
  1. Method·Target·Header·Content로 Request 구성
  2. HTTP Message 전송
Server
  3. Message Framing과 Header 해석
  4. Method·Target을 기준으로 처리 대상 선택
  5. Content를 Media Type에 맞게 해석
  6. 처리 결과를 Status·Header·Content로 구성
Client
  7. Status와 Header를 먼저 해석
  8. Content-Type에 맞게 Response Content 처리
```

이 단계에서는 Spring의 `@PostMapping`, Controller와 JSON 변환 Class를 외우지 않는다. 먼저 Framework 없이 Message 각 부분이 무엇을 전달하는지 설명한 뒤, 이후 Spring MVC가 어느 단계를 대신 수행하는지 연결한다.

## 예상과 실제를 구분하는 `curl.exe` 관찰 계획

현재 실제 HTTP Server와 Endpoint Trace는 검증하지 않았다. 아래 명령은 Application 기동 후 수행할 재현 절차이며 결과는 `NOT_RUN`이다.

### 사전 조건

- Spring Application과 Ticket Endpoint가 실제로 기동되어 있다.
- `localhost:8080`이 해당 Application의 실제 Listen 주소다.
- Trace에 Credential, Cookie, 내부 URL과 개인정보가 포함되지 않는다.

### Ticket 생성

PowerShell 7에서 다음과 같이 실행할 수 있다.

```powershell
curl.exe -v `
  -H 'Content-Type: application/json' `
  -H 'Accept: application/json' `
  --data '{"title":"로그인 오류"}' `
  http://localhost:8080/api/tickets
```

### Ticket 조회

생성 Response에서 실제 ID를 확인한 뒤 실행한다.

```powershell
curl.exe -v `
  -H 'Accept: application/json' `
  http://localhost:8080/api/tickets/1
```

### `curl.exe -v` 출력 읽기

| 접두 기호 | 의미 | HTTP Message 포함 여부 |
|---|---|---|
| `>` | Client가 보낸 Request Line·Header | 포함 |
| `<` | Server가 보낸 Status Line·Header | 포함 |
| `*` | 연결, DNS, TLS 등 `curl.exe` 진단 정보 | HTTP Header가 아님 |

Body는 별도의 출력 영역에 나타날 수 있다. `-v`의 진단 출력 전체를 HTTP Header라고 부르지 않는다.

### 관찰 기록 표

실행 전 예상과 실행 후 관찰을 분리하여 작성한다.

| 항목 | 실행 전 예상 | 실제 관찰 | 차이와 해석 |
|---|---|---|---|
| Request Line | `POST /api/tickets` | `NOT_RUN` | `NOT_RUN` |
| Request `Content-Type` | `application/json` | `NOT_RUN` | `NOT_RUN` |
| Response Status | `201 Created` | `NOT_RUN` | `NOT_RUN` |
| Response `Location` | `/api/tickets/{id}` | `NOT_RUN` | `NOT_RUN` |
| Response `Content-Type` | `application/json` | `NOT_RUN` | `NOT_RUN` |
| Response Body | `id`, `title`, `status` | `NOT_RUN` | `NOT_RUN` |

## 실패·반례와 자주 발생하는 오해

| 오해 | 수정된 이해 |
|---|---|
| HTTP Message는 항상 사람이 읽는 Text Line으로 전송된다. | 이 문서의 원문은 HTTP/1.1 문법이다. HTTP/2·HTTP/3는 다른 Framing을 사용하지만 의미는 보존한다. |
| `Content-Type`은 받고 싶은 Response 형식이다. | 현재 Message Content의 Media Type이다. Response 선호 형식은 Request의 `Accept`로 표현할 수 있다. |
| `POST`는 무조건 Resource 생성 Method다. | Target Resource가 Request Representation을 자신의 의미에 따라 처리하도록 요청하며, 생성은 대표 사례다. |
| 모든 성공은 `200 OK`다. | 새 Resource 생성은 `201 Created`처럼 더 구체적인 Status가 의미를 전달한다. |
| `GET`에는 문법적으로 절대 Body를 넣을 수 없다. | Request Content에 일반적으로 정의된 의미가 없고 상호 운용 위험이 있으므로 현재 조회 계약에서 사용하지 않는다. |
| Stateless이므로 Server는 상태를 저장할 수 없다. | 각 Request의 의미가 독립적으로 해석된다는 뜻이며 Resource·Session 저장을 금지하지 않는다. |
| 같은 TCP 연결이면 같은 사용자다. | 연결과 Message의 관계만으로 사용자 Identity를 판단할 수 없다. |
| `curl.exe -v`의 `*` Line도 HTTP Header다. | `*`는 Client 진단 정보이며 `>`와 `<`가 Request·Response Line과 Header를 나타낸다. |

## 최소 학습 실험

실제 Server가 준비되기 전에는 다음 종이 실험부터 수행한다.

1. Ticket 생성 Request에서 Method, Target, Header와 Body에 서로 다른 표시를 한다.
2. 유효한 제목, 공백 제목과 잘못된 JSON의 예상 Status를 먼저 적는다.
3. 생성 성공 Response에서 `Location`이 가리켜야 할 Resource를 적는다.
4. `Content-Type`과 `Accept`의 방향을 바꾸었을 때 호출자가 무엇을 잘못 이해하게 되는지 설명한다.
5. 실제 Server가 준비되면 같은 예상표를 유지한 채 `curl.exe -v` 결과만 관찰 열에 추가한다.

## 설명 가능성 점검 질문

1. Request Line의 세 구성요소는 무엇인가?
2. Status Line에서 Program이 판단 기준으로 삼아야 하는 값은 무엇인가?
3. Header Section과 Body의 경계는 어떻게 표현되는가?
4. `Content-Type`과 `Accept`의 차이를 Request·Response 방향과 함께 설명할 수 있는가?
5. `Content-Length`가 Java의 `String.length()`와 항상 같지 않은 이유는 무엇인가?
6. `POST /api/tickets` 성공에 `201`과 `Location`을 사용하는 이유는 무엇인가?
7. 존재하지 않는 Ticket 조회와 예상하지 못한 Server 실패를 각각 어떤 Status로 구분할 것인가?
8. HTTP/1.1 원문 예시를 HTTP/2의 실제 Wire 형식이라고 부르면 안 되는 이유는 무엇인가?
9. HTTP가 Stateless여도 Server가 Ticket과 Session을 저장할 수 있는 이유는 무엇인가?
10. 예상 메시지와 실제 Trace가 다를 때 무엇을 먼저 확인할 것인가?

## Learning Evidence Gate

- [ ] Request Line·Status Line·Header·빈 줄·Body를 자신의 말로 설명한다.
- [ ] Method·Target·Status의 역할을 서로 구분한다.
- [ ] `Content-Type`, `Accept`, `Location`과 `Content-Length`를 구분한다.
- [ ] Ticket 생성·조회와 `400`·`404`·대표 `500`의 예상 계약을 작성한다.
- [ ] Stateless를 Server 상태 저장 금지와 구분한다.
- [ ] HTTP/1.1 Text 예시와 Version 독립적인 HTTP Semantics를 구분한다.
- [ ] 실제 Server에 `curl.exe` Request를 보내고 예상·관찰·차이를 기록한다.
- [ ] Trace의 `>`, `<`, `*` Line을 구분한다.
- [ ] 공개 Trace에 Credential, Cookie, 개인정보, 내부 URL과 로컬 절대 경로가 없다.

## 근거와 현재 검증 경계

| 근거 | 확인한 내용 | 상태 |
|---|---|---|
| RFC 9110 | Message Abstraction, Stateless, Method, Header와 Status 의미 | 공식 원문 검토 |
| RFC 9112 | HTTP/1.1 Start Line, Header Section, 빈 줄과 Message Body 문법 | 공식 원문 검토 |
| Ticket 예상 Request·Response | 구현 전 계약과 학습 예시 | 예상, 실행 근거 아님 |
| 실제 Server `curl.exe` Trace | Wire에서 관찰한 Request·Response | `NOT_RUN` |
| Spring MVC·MockMvc | Framework 처리 흐름과 Test | `NOT_IMPLEMENTED` |

이 문서는 HTTP 표준의 전체 기능이나 실제 Ticket API 동작을 검증하지 않는다. Cache, 인증, CORS, Proxy, TLS, HTTP/2·HTTP/3 Framing과 성능 비교는 현재 학습 범위가 아니다.

## AI 활용

- AI가 도운 부분: 학습 순서, Ticket 예시, 오해·자가점검 질문과 관찰표 초안 구성
- 직접 확인한 공식 자료: RFC 9110과 RFC 9112의 Message, Method, Header, Status와 HTTP/1.1 문법
- 아직 직접 수행하지 않은 부분: 실제 Server 기동, `curl.exe` Trace, 예상과 실제 비교
- 완료 원칙: 자료를 읽은 사실이 아니라 직접 설명하고 실제 Message를 관찰한 범위만 학습 근거로 사용한다.

## 다음 학습

- 남은 질문: Ticket 생성·조회에 적절한 Resource URI, Method와 정상·실패 Status 계약은 무엇인가?
- 조건부 후속: 실제 Server가 준비된 뒤 `curl.exe` Trace를 기록하고 Spring MVC 처리 흐름과 연결한다.
- 다음 주제: REST Resource·URI·Stateless와 생성·조회 API 계약

## 참고 자료

- [RFC 9110 Section 3.3 — Connections, Clients, and Servers](https://www.rfc-editor.org/rfc/rfc9110.html#section-3.3)
- [RFC 9110 Section 6 — Message Abstraction](https://www.rfc-editor.org/rfc/rfc9110.html#section-6)
- [RFC 9110 Section 8.3 — Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3)
- [RFC 9110 Section 9.3.1 — GET](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.1)
- [RFC 9110 Section 9.3.3 — POST](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3)
- [RFC 9110 Section 10.2.2 — Location](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.2)
- [RFC 9110 Section 12.5.1 — Accept](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.1)
- [RFC 9110 Section 15 — Status Codes](https://www.rfc-editor.org/rfc/rfc9110.html#section-15)
- [RFC 9112 Section 2.1 — HTTP/1.1 Message Format](https://www.rfc-editor.org/rfc/rfc9112.html#section-2.1)
- [RFC 9112 Section 3 — Request Line](https://www.rfc-editor.org/rfc/rfc9112.html#section-3)
- [RFC 9112 Section 4 — Status Line](https://www.rfc-editor.org/rfc/rfc9112.html#section-4)
- [RFC 9112 Section 6 — Message Body](https://www.rfc-editor.org/rfc/rfc9112.html#section-6)
