# Learning Note — HTTP 요청·응답 메시지

> 작성일: 2026-08-24
> 기준: RFC 9110 HTTP Semantics, RFC 9112 HTTP/1.1

## 핵심 질문

> Client와 Server는 하나의 HTTP 요청과 응답에서 어떤 정보로 행동의 의미, 데이터 형식과 처리 결과를 합의하는가?

## 학습 목표

이 자료를 학습한 뒤 다음 내용을 자신의 말로 설명하는 것이 목표다.

- HTTP Request와 Response의 Start Line, Header Section, 빈 줄과 Body를 구분한다.
- Resource, URI와 Representation의 차이를 Ticket 사례로 설명한다.
- Method, Request Target과 Status Code가 각각 무엇을 표현하는지 설명한다.
- Collection·개별 Resource·Query 조건을 URI에서 구분한다.
- `GET`과 `POST`의 안전성·멱등성 차이를 설명한다.
- `Content-Type`, `Accept`, `Location`과 `Content-Length`의 역할을 구분한다.
- Ticket 생성·조회에서 예상되는 정상·실패 HTTP 계약을 Code보다 먼저 작성한다.
- HTTP의 Stateless가 “Server가 아무 상태도 저장하지 않는다”는 뜻이 아닌 이유를 설명한다.
- 예상 메시지와 실제 `curl.exe` Trace를 구분하고, 관찰 후 차이를 기록한다.

뒤의 자가진단, 최소 실험과 설명 가능성 점검 질문을 이용해 각 목표를 확인할 수 있다.

## 시작 전 자가진단

자료를 읽기 전에 다음 질문에 짧게 답한다. 정답을 먼저 찾기보다 현재 이해와 불확실한 부분을 확인하는 것이 목적이며, 개인 답변은 날짜별 Study Note에 기록한다.

1. `POST /api/tickets`에서 `POST`와 `/api/tickets`는 각각 무엇을 뜻하는가?
2. `Content-Type`과 `Accept`는 모두 JSON을 가리킬 수 있는데 역할이 어떻게 다른가?
3. 생성 성공에 `200 OK`가 아니라 `201 Created`를 선택할 이유는 무엇인가?
4. HTTP가 Stateless라면 Server는 Ticket을 Memory나 Database에 저장할 수 없는가?
5. 같은 TCP 연결에서 연속으로 들어온 두 요청을 같은 사용자의 요청이라고 단정할 수 있는가?

## 한 문장 설명

HTTP 메시지는 Client가 Method·Target·Field·Content로 요청 의도를 전달하고, Server가 Status·Field·Content로 처리 결과를 반환하는 자기 설명적 Request·Response 교환이다.

## 먼저 구분할 경계: 의미와 전송 문법

HTTP를 학습할 때 “메시지가 무엇을 뜻하는가”와 “특정 Version이 Wire에서 어떻게 표현하는가”를 분리해야 한다.

| 구분 | 담당 내용 | 이 자료의 사용 방식 |
|---|---|---|
| HTTP Semantics | Method, Status, Field와 Content가 전달하는 의미 | 모든 HTTP Version에 공통인 설명 기준 |
| HTTP/1.1 Message Syntax | Start Line, CRLF, Field Line, 빈 줄과 Message Body | 사람이 읽을 수 있는 원문 예시 |
| HTTP/2·HTTP/3 | 각 Version 고유의 Frame과 전송 방식 | 상세 Framing·성능 비교는 다루지 않음 |

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

입문 설명에서는 전송할 데이터를 흔히 Body라고 부른다. RFC 9110의 Content는 전송 Coding을 해제한 뒤의 표현 데이터이고, RFC 9112의 Message Body는 HTTP/1.1 Framing에 포함된 Octet Stream이다. 이 자료에서는 둘의 차이를 인식하되 Transfer Coding 상세 구현은 범위에서 제외한다.

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

이 예시는 실제 Server에 전송한 Trace가 아니라 메시지 구조를 설명하기 위한 예상 예시다. `Content-Length: 28`은 위 JSON을 공백 없이 UTF-8로 Encoding한 정확한 Body를 기준으로 한 Octet 수다. JSON의 공백이나 값이 바뀌면 길이도 바뀌며, 실제 값은 Client가 계산하게 한다.

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

| Method | 핵심 의미 | Ticket 예시 |
|---|---|---|
| `GET` | Target Resource의 현재 선택된 Representation 전송을 요청 | `GET /api/tickets/{id}` 단건 조회 |
| `POST` | Target Resource가 Request Representation을 자신의 의미에 따라 처리하도록 요청 | `POST /api/tickets` Ticket 생성 |

`POST`가 언제나 생성을 뜻하는 것은 아니다. RFC의 의미는 Target Resource가 전달된 Representation을 자신의 규칙에 따라 처리하도록 요청하는 것이며, 새 Resource 생성은 대표적인 사용 사례다.

`GET` Request Content가 문법적으로 무조건 금지된다고 단정하지 않는다. 다만 일반적으로 정의된 의미가 없고 일부 구현이 이를 거부할 수 있으므로, 이 자료의 Ticket 조회 예시에서는 GET Body를 사용하지 않는다.

## Resource·URI·Representation 구분

RFC 9110은 HTTP Request의 대상을 Resource라고 부른다. Resource의 종류를 File이나 Database Row로 제한하지 않으며, HTTP는 Resource와 상호작용하기 위한 공통 Interface를 정의한다. 대부분의 Resource는 URI로 식별한다.

Representation은 Resource 그 자체가 아니라 특정 시점의 Resource 상태를 통신 가능한 형식으로 표현한 정보다.

| 개념 | Ticket 예시 | 역할 |
|---|---|---|
| Resource | ID가 7인 Ticket | Server가 관리하는 식별 가능한 대상 |
| URI | `/api/tickets/7` | 해당 Resource를 식별하는 주소 |
| Representation | `{"id":7,"title":"로그인 오류","status":"OPEN"}` | Ticket 상태를 JSON으로 표현해 전달하는 Content |

같은 Ticket Resource도 Client의 `Accept`와 Server의 지원 범위에 따라 JSON이나 XML 등 서로 다른 Representation으로 표현될 수 있다. 표현 형식이 달라져도 같은 URI가 식별하는 Resource가 자동으로 다른 Resource가 되는 것은 아니다.

### Collection·개별 Resource·Query 조건

이 자료의 Ticket 예시에서는 URI를 다음과 같이 구분한다.

| URI | Ticket 예시의 해석 | 자료에서의 용도 |
|---|---|---|
| `/api/tickets` | Ticket Collection | `POST` 생성 Target |
| `/api/tickets/7` | ID가 7인 개별 Ticket | `GET` 단건 조회 Target |
| `/api/tickets?status=OPEN` | `status=OPEN` 조건을 적용한 Ticket Collection | Path와 Query 역할 비교 |

Path는 주로 Resource의 계층과 식별을 나타내고, Query는 같은 Path의 Target을 조건에 따라 선택하거나 변형하는 데 사용할 수 있다. Query의 용도가 Filtering으로 제한되는 것은 아니며, 이 자료에서는 `status` Filtering 사례를 사용한다.

### URI와 Method가 함께 의미를 만든다

HTTP는 Resource 식별과 Request 행동의 의미를 분리한다. URI가 대상을 식별하고 Method가 요청 의도를 표현한다.

```http
POST /api/tickets
GET /api/tickets/7
```

`/api/create-ticket`이 문법적으로 잘못된 URI라는 뜻은 아니다. 다만 Ticket 예시에서는 `POST`가 처리 의도를 이미 나타내므로 `/api/tickets`로 Resource를 표현한다. `GET /api/tickets?do=delete`처럼 안전한 Method에 상태 변경 행동을 숨기는 설계는 GET의 의미와 맞지 않는다.

### 안전성과 멱등성

- 안전한 Method는 Client가 Server 상태 변경을 요청하지 않는 읽기 중심 의미를 가진다.
- 멱등한 Method는 동일한 요청을 여러 번 수행해도 의도된 Server 효과가 한 번 수행한 것과 같다.

| Method | 안전한가? | 멱등한가? | Ticket 사례 |
|---|---|---|---|
| `GET` | 예 | 예 | 같은 Ticket 조회를 반복해도 조회 자체가 Ticket 상태를 바꾸지 않음 |
| `POST` | 아니요 | 아니요 | 같은 생성 요청을 반복하면 Ticket이 여러 개 생성될 가능성이 있으므로 한 번과 같은 효과라고 가정할 수 없음 |

Server가 GET Request를 Log에 남기는 부수 효과가 있더라도 Client가 요청한 의미가 조회라면 GET의 안전성 정의와 모순되지 않는다. 반대로 POST 처리 결과가 우연히 한 번만 반영되더라도 Client는 별도 계약 없이 POST를 멱등하다고 가정해서 자동 재시도하면 안 된다.

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

## Ticket API의 Method·Status 예시

아래 표는 Ticket 생성·조회 계약을 설계할 때 사용할 수 있는 예시다. 구체적인 오류 Body Field는 Application 계약에 맞게 별도로 정한다.

| Request | 결과 예시 | 선택 이유 |
|---|---|---|
| `POST /api/tickets` + 유효한 제목 | `201 Created`, `Location`, Ticket JSON | 새 Resource가 생성됨 |
| `GET /api/tickets/1` + 존재하는 ID | `200 OK`, Ticket JSON | 현재 Representation 조회 성공 |
| `POST /api/tickets` + 잘못된 JSON·공백 제목 | `400 Bad Request` | Request 형식이나 입력 계약을 충족하지 못함 |
| `GET /api/tickets/999999` + 존재하지 않는 ID | `404 Not Found` | Target Resource의 현재 Representation을 찾지 못함 |
| 처리되지 않은 내부 실패 | `500 Internal Server Error` | 예상하지 못한 Server 조건으로 요청 수행 실패 |

Status Class를 먼저 구분하면 개별 Code를 이해하기 쉽다.

| 범위 | 분류 | Ticket 예시 |
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

이 자료에서는 Stateless의 의미를 Session 구현 방법과 구분하는 데 집중하며, 인증·Session 구현은 다루지 않는다.

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

HTTP 메시지를 학습할 때는 Spring의 `@PostMapping`, Controller와 JSON 변환 Class를 먼저 외우지 않는다. Framework 없이 Message 각 부분이 무엇을 전달하는지 설명한 뒤, Spring MVC가 어느 단계를 대신 수행하는지 연결한다.

## `curl.exe`로 메시지 관찰하기

아래 명령은 Ticket Endpoint가 기동된 환경에서 Request·Response Line, Header와 Body를 관찰하기 위한 예시다. Port와 ID는 실제 실행 환경에 맞게 바꾼다.

### 사전 조건

- Ticket Endpoint가 기동되어 있다.
- `localhost:8080`을 사용하는 경우 실제 Listen 주소와 일치하는지 확인한다.
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

실습할 때는 다음 항목을 기준으로 실행 전 예상과 실행 후 관찰을 분리한다. 실제 관찰 결과는 날짜별 Study Note 또는 Lab Report에 기록한다.

| 항목 | 실행 전 예상 | 실제 관찰 | 차이와 해석 |
|---|---|---|---|
| Request Line | `POST /api/tickets` |  |  |
| Request `Content-Type` | `application/json` |  |  |
| Response Status | `201 Created` |  |  |
| Response `Location` | `/api/tickets/{id}` |  |  |
| Response `Content-Type` | `application/json` |  |  |
| Response Body | `id`, `title`, `status` |  |  |

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

Server 실행 여부와 관계없이 다음 종이 실험부터 수행할 수 있다.

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

## 학습 점검 목록

- Resource·URI·Representation을 서로 구분한다.
- Collection·개별 Resource·Query 조건의 URI를 구분한다.
- `GET`과 `POST`의 안전성·멱등성 차이를 설명한다.
- Request Line·Status Line·Header·빈 줄·Body를 자신의 말로 설명한다.
- Method·Target·Status의 역할을 서로 구분한다.
- `Content-Type`, `Accept`, `Location`과 `Content-Length`를 구분한다.
- Ticket 생성·조회와 `400`·`404`·대표 `500`의 계약을 설명한다.
- Stateless를 Server 상태 저장 금지와 구분한다.
- HTTP/1.1 Text 예시와 Version 독립적인 HTTP Semantics를 구분한다.
- `curl.exe -v` Trace의 `>`, `<`, `*` Line을 구분한다.

## 자료 범위

이 문서는 HTTP Message, Resource·URI·Representation, `GET`·`POST`, 주요 Header·Status와 Stateless의 기본 의미를 다룬다. Ticket Request·Response와 `curl.exe` 명령은 개념을 적용하는 예시이며 실제 Application 실행 결과가 아니다.

Cache, 인증, CORS, Proxy, TLS, HTTP/2·HTTP/3 Framing과 성능 비교는 다루지 않는다. 실제 Ticket Application 구현, Test·Trace 결과와 학습 일정도 이 자료의 범위가 아니다.

## 참고 자료

- [RFC 9110 Section 3.1 — Resources](https://www.rfc-editor.org/rfc/rfc9110.html#section-3.1)
- [RFC 9110 Section 3.2 — Representations](https://www.rfc-editor.org/rfc/rfc9110.html#section-3.2)
- [RFC 9110 Section 4 — Identifiers in HTTP](https://www.rfc-editor.org/rfc/rfc9110.html#section-4)
- [RFC 9110 Section 3.3 — Connections, Clients, and Servers](https://www.rfc-editor.org/rfc/rfc9110.html#section-3.3)
- [RFC 9110 Section 6 — Message Abstraction](https://www.rfc-editor.org/rfc/rfc9110.html#section-6)
- [RFC 9110 Section 8.3 — Content-Type](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3)
- [RFC 9110 Section 9.2.1 — Safe Methods](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.1)
- [RFC 9110 Section 9.2.2 — Idempotent Methods](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)
- [RFC 9110 Section 9.3.1 — GET](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.1)
- [RFC 9110 Section 9.3.3 — POST](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.3.3)
- [RFC 9110 Section 10.2.2 — Location](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.2)
- [RFC 9110 Section 12.5.1 — Accept](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.1)
- [RFC 9110 Section 15 — Status Codes](https://www.rfc-editor.org/rfc/rfc9110.html#section-15)
- [RFC 9112 Section 2.1 — HTTP/1.1 Message Format](https://www.rfc-editor.org/rfc/rfc9112.html#section-2.1)
- [RFC 9112 Section 3 — Request Line](https://www.rfc-editor.org/rfc/rfc9112.html#section-3)
- [RFC 9112 Section 4 — Status Line](https://www.rfc-editor.org/rfc/rfc9112.html#section-4)
- [RFC 9112 Section 6 — Message Body](https://www.rfc-editor.org/rfc/rfc9112.html#section-6)
