# REST Resource·URI와 Ticket API 계약 학습 점검

> 작성일: 2026-08-25
> 목적: HTTP Message 기초를 REST Resource·URI와 Ticket 생성·조회 계약으로 연결하고, 구현 전에 정상·실패 결과를 자연어로 설명한다.
> 상태: Completed — 오전 개념·오후 예상 계약·야간 Spring Boot 최소 기동과 Root Smoke Trace 완료

---

## 사용 방법

- [HTTP 요청·응답 메시지 Learning Note](../study-docs/learning-http-request-response-messages.md)의 Resource·URI·Representation Section을 먼저 읽는다.
- 질문은 한 번에 하나씩 자신의 말로 답한다.
- 오전에는 개념과 URI 선택 이유를 작성하고, 오후에는 Given–When–Then과 API 계약을 채운다.
- 예시 Status와 Header를 외우기보다 해당 선택이 Client에게 무엇을 알려주는지 설명한다.
- 이 문서의 Ticket API 예상 계약은 구현 결과가 아니다. Root Smoke Trace는 실제 실행 근거로 별도 기록하며, Ticket API Test·Trace는 실행 전까지 `NOT_RUN`이다.

## 오전 — Resource·URI·Representation

### 1. 세 개념 구분

Resource, URI와 Representation은 각각 무엇인가? ID가 7인 Ticket을 예로 들어 설명한다.

-> Resource는 서버가 식별하고 관리하는 개념적 대상이다. Java 객체나 DB 행으로 구현될 수 있지만 그 구현 자체와 동일한 개념은 아니다. URI는 Resource를 식별하고, Representation은 해당 Resource의 상태를 JSON·XML 등의 전송 가능한 형태로 표현한 것이다.


### 2. 생성 URI 선택

새 Ticket을 생성할 때 다음 중 어느 요청을 선택하는가? `Resource`와 `Method`라는 용어를 사용해 이유를 설명한다.

```http
POST /api/tickets
```

```http
POST /api/create-ticket
```

-> POST는 Target Resource가 Request Content를 자신의 의미에 따라 처리하도록 요청하는 Method다. 이 Ticket API에서는 /api/tickets가 새로운 Ticket을 생성하도록 계약했기 때문에 생성에 사용한다.


### 3. Collection과 개별 Resource

다음 URI가 각각 무엇을 식별하거나 선택하는지 설명한다.

- `/api/tickets`
- `/api/tickets/7`
- `/api/tickets?status=OPEN`

-> 답변은 아래와 같다
- `/api/tickets`: 식별 대상으로 티켓 자원의 전체 컬렉션(Collection)을 의미한다.
- `/api/tickets/7`: 컬렉션 내의 특정 단일 자원(아이디 7번)을 식별한다.
- `/api/tickets?status=OPEN`: 전체 컬렉션 중 특정 조건(상태가 OPEN)으로 필터링된 자원의 부분 집합을 선택한다.

`status` Query 조건은 URI 개념 비교를 위한 예시이며 이번 주 최소 구현 범위에는 포함하지 않는다.


### 4. Path와 Query 구분

`GET /api/tickets/7`의 `7`과 `GET /api/tickets?status=OPEN`의 `OPEN`은 각각 어떤 역할을 하는가? Spring Annotation 이름을 쓰지 않고 HTTP Target 관점에서 먼저 설명한다.

-> 7은 Path의 일부로서 개별 Ticket을 식별하고, OPEN은 Query Parameter의 값으로서 Ticket Collection에 적용할 조회 조건을 지정한다.


### 5. Resource와 JSON

다음 JSON이 Ticket Resource 자체가 아니라 Representation인 이유는 무엇인가? 같은 Ticket을 XML로 표현해도 같은 Resource일 수 있는 이유도 설명한다.

```json
{
  "id": 7,
  "title": "로그인 오류",
  "status": "OPEN"
}
```

-> 같은 Target URI에 JSON이나 XML을 요청하더라도 이 API에서 식별하는 Ticket Resource는 같다. JSON과 XML은 같은 Resource 상태를 서로 다른 Media Type으로 표현한 Representation이다.


### 6. 안전성과 멱등성

다음 두 용어의 차이를 설명한다.

- 안전한 Method
- 멱등한 Method

-> 안전한 Method는 Client가 Resource 상태 변경을 요청하지 않는 Method다. Server Log나 조회 통계 같은 부수 효과가 발생할 수는 있다. 멱등한 Method는 동일한 요청을 여러 번 수행했을 때 의도된 Server 효과가 한 번 수행했을 때와 같은 Method다.


### 7. GET과 POST 비교

현재 Ticket 계약에서 `GET`은 왜 안전하고 멱등한가? 동일한 `POST /api/tickets`를 두 번 전송했을 때는 왜 같은 효과라고 가정할 수 없는가?

-> GET은 조회를 요청하므로 안전하며, 같은 조회를 반복해도 Ticket에 추가적인 변경 효과를 만들지 않으므로 멱등하다. 반면 동일한 POST /api/tickets 요청을 두 번 보내면 서로 다른 ID의 Ticket 두 개가 생성될 수 있으므로, 별도의 멱등성 계약 없이는 같은 효과라고 가정할 수 없다.


## 오후 — 생성·조회 Given–When–Then

아래 Scenario는 구현 전에 예상 계약을 확정하기 위한 자연어 설계다. 각 항목을 채운 뒤 Method·Path·Status·Header·Body 선택 이유를 설명한다.

### 1. 유효한 제목으로 Ticket 생성

- Given: 제목이 `"로그인 오류"`인 유효한 생성 요청 Body가 준비되어 있다.
- When: Client가 `POST /api/tickets`로 `Content-Type: application/json` Header와 `{"title":"로그인 오류"}` Body를 전송한다.
- Then: Server는 생성된 Ticket의 위치와 Representation을 반환한다. Ticket 한 건이 저장되며 이후 `GET /api/tickets/7` 요청에서 `200 OK`와 함께 조회할 수 있어야 한다.
- 예상 Status: `201 Created`
- 예상 Header: `Location: /api/tickets/7`, `Content-Type: application/json`
- 예상 Body: `{"id":7,"title":"로그인 오류","status":"OPEN"}`
- 선택 이유: `POST`는 Collection Resource가 요청 내용을 처리해 새 Ticket을 생성하도록 요청한다. `201 Created`는 새 Resource 생성을, `Location`은 생성된 Resource의 URI를 Client에게 알려준다.

### 2. 공백 제목으로 Ticket 생성 시도

- Given: 제목이 `"  "`인 유효하지 않은 생성 요청 Body가 준비되어 있다.
- When: Client가 `POST /api/tickets`로 `Content-Type: application/json` Header와 `{"title":"  "}` Body를 전송한다.
- Then: Server는 유효하지 않은 제목으로 인해 요청을 거부하고 오류 Body를 반환한다. 생성된 Resource가 없으므로 `Location` Header는 반환하지 않는다.
- 예상 Status: `400 Bad Request`
- 예상 오류 Body: `{"message":"title must not be blank"}`
- 실패 후 저장 상태: 새로운 Ticket은 저장되지 않으며 요청 전 저장 상태가 그대로 유지된다.
- 선택 이유: JSON 문법은 유효하지만 제목이 API 입력 규칙을 위반했다. Client가 입력을 수정할 수 있는 요청 오류이므로 `400 Bad Request`를 선택한다.

### 3. 존재하는 Ticket 단건 조회

- Given: ID가 `7`이고 제목이 `"로그인 오류"`, 상태가 `OPEN`인 Ticket이 이미 저장되어 있다.
- When: Client가 `Accept: application/json` Header와 함께 `GET /api/tickets/7` 요청을 전송한다.
- Then: Server는 `Content-Type: application/json` Header와 요청한 Ticket의 Representation을 반환한다.
- 예상 Status: `200 OK`
- 예상 Body: `{"id":7,"title":"로그인 오류","status":"OPEN"}`
- 선택 이유: 유효한 ID로 식별한 Resource가 존재하므로 조회 결과를 `200 OK`로 반환한다. `GET`은 Ticket 상태 변경을 요청하지 않는다.

### 4. 존재하지 않는 Ticket 단건 조회

- Given: ID가 `999`인 Ticket은 저장되어 있지 않다.
- When: Client가 `Accept: application/json` Header와 함께 `GET /api/tickets/999` 요청을 전송한다.
- Then: Server는 오류 Body를 반환한다. 조회 요청이므로 기존에 저장된 Ticket들의 상태는 변경되지 않는다.
- 예상 Status: `404 Not Found`
- 예상 오류 Body: `{"message":"ticket not found"}`
- 선택 이유: `999`는 숫자형 ID라는 API 계약을 만족하지만 해당 Resource가 존재하지 않으므로 `404 Not Found`를 선택한다.

### 5. 변환할 수 없는 ID 형식으로 조회

- Given: Ticket ID는 숫자 형식이어야 하지만 Client가 조회 ID로 `"abc"`를 준비했다.
- When: Client가 `Accept: application/json` Header와 함께 `GET /api/tickets/abc` 요청을 전송한다.
- Then: Server는 ID 형식 오류를 나타내는 Body를 반환한다. 새로운 Resource를 생성하거나 기존 저장 상태를 변경하지 않는다.
- 예상 Status: `400 Bad Request`
- 예상 오류 Body: `{"message":"invalid ticket id format"}`
- 존재하지 않는 ID 사례와 다른 이유: `999`는 유효한 ID 형식이므로 조회 후 Resource 부재를 `404 Not Found`로 표현한다. `abc`는 HTTP·URI 문법 자체가 아니라 API가 정한 숫자형 ID 형식을 위반하므로 `400 Bad Request`로 거부하는 계약이다. 실제 Repository 조회 전 거부 여부는 이후 Test에서 확인한다.

## 계약 요약표

답변을 마친 뒤 아래 표를 완성한다.

| Scenario | Method·Path | Request Header·Body | 예상 Status | Response Header·Body | 이유 |
|---|---|---|---|---|---|
| 정상 생성 | `POST /api/tickets` | `Content-Type: application/json`<br>`{"title":"로그인 오류"}` | `201 Created` | `Location: /api/tickets/7`<br>`Content-Type: application/json`<br>`{"id":7,"title":"로그인 오류","status":"OPEN"}` | 새 Ticket의 생성과 위치를 알린다. |
| 공백 제목 생성 | `POST /api/tickets` | `Content-Type: application/json`<br>`{"title":"  "}` | `400 Bad Request` | `Content-Type: application/json`<br>`{"message":"title must not be blank"}` | Client가 수정할 수 있는 입력 규칙 위반이다. |
| 정상 단건 조회 | `GET /api/tickets/7` | `Accept: application/json` | `200 OK` | `Content-Type: application/json`<br>`{"id":7,"title":"로그인 오류","status":"OPEN"}` | 식별한 Resource가 존재한다. |
| 존재하지 않는 ID 조회 | `GET /api/tickets/999` | `Accept: application/json` | `404 Not Found` | `Content-Type: application/json`<br>`{"message":"ticket not found"}` | ID 형식은 유효하지만 Resource가 없다. |
| 잘못된 ID 형식 조회 | `GET /api/tickets/abc` | `Accept: application/json` | `400 Bad Request` | `Content-Type: application/json`<br>`{"message":"invalid ticket id format"}` | API의 숫자형 ID 형식을 위반한다. |

## 설명 가능성 점검

- [x] Resource·URI·Representation을 Ticket 예시로 구분한다.
- [x] Collection, 개별 Resource와 Query 조건을 구분한다.
- [x] URI와 HTTP Method가 각각 무엇을 표현하는지 설명한다.
- [x] `GET`과 `POST`의 안전성·멱등성 차이를 설명한다.
- [x] 생성·조회 정상·실패 계약을 Given–When–Then으로 작성한다.
- [x] `201`, `200`, `400`, `404`와 `Location` 선택 이유를 설명한다.
- [x] 예상 계약과 실제 Test·Trace 결과를 구분한다.

## 현재 실행 경계

- Spring Boot Dependency·Application 진입점: `IMPLEMENTED` — Spring Boot `4.1.1`, Web MVC Starter·Maven Plugin과 `HelpdeskApplication`
- Application Context·내장 Server 기동: `RUN` — Java `25.0.4`, Tomcat `11.0.24`, Port `8080`
- MockMvc Test: `NOT_IMPLEMENTED`
- Root `/` `curl.exe` Smoke Trace: `RUN` — `404 Not Found` JSON 응답
- Ticket API `curl.exe` Trace: `NOT_RUN`

## 실행·관찰 기록

실행 전에 예상 열을 먼저 작성하고, 실제 Server가 준비된 뒤 관찰과 해석을 추가한다.

### Spring Boot 최소 기동·Root Smoke Trace

- 실행 시각: 2026-08-25 22:27~22:28 KST
- Build: Spring Boot 구성과 Application 진입점 추가 후 Unit Test 16개 통과, `BUILD SUCCESS`
- 기동: Spring Boot `4.1.1`, Java `25.0.4`, Tomcat `11.0.24`, Port `8080`

```powershell
curl.exe --verbose --include --header "Accept: application/json" http://localhost:8080/
```

| 항목 | 실제 관찰 | 해석 |
|---|---|---|
| 연결 | `localhost` → IPv6 Loopback `::1:8080` 연결 성공 | Client와 내장 Server 사이 TCP 연결이 성립했다. |
| Request Line | `GET / HTTP/1.1` | Root Resource 조회를 요청했다. |
| Request Header | `Accept: application/json` | Client가 JSON Representation을 요청했다. |
| Response Status | `HTTP/1.1 404` | Server는 동작하지만 `/`에 연결된 Controller가 없어 예상대로 Resource를 찾지 못했다. |
| Response Header | `Content-Type: application/json`, `Transfer-Encoding: chunked` | 오류 Body의 Media Type과 전송 방식을 설명한다. |
| Response Body | `{"timestamp":"2026-08-25T13:28:23.330Z","status":404,"error":"Not Found","path":"/"}` | Spring Boot 기본 오류 Representation이다. |
| 종료 | Server 종료 후 Port `8080` Listener 0개 | 실습 Process가 남아 있지 않다. |

`--verbose`는 `<` 접두사로 Response Header를 진단 출력하고 `--include`는 실제 Response Header를 Body 앞에 포함하므로 같은 Header가 두 번 보였다. Server가 Header를 중복 전송한 것은 아니다. 이 Trace는 Application Context·내장 Server·기본 오류 응답을 검증하지만 Ticket Controller나 `/api/tickets` 계약을 검증하지 않는다.

Maven 변경 직후 VS Code가 `HelpdeskApplication.java`에 오류 표시를 남겼다. Maven Clean Compile과 실제 Server 기동은 성공했고, `Java: Clean Java Language Server Workspace`와 Maven Project Reload 후 표시가 사라졌다. 따라서 Source 오류가 아니라 Editor가 갱신된 Dependency를 다시 읽지 못한 동기화 문제로 판단했다.

### Ticket API 예상 계약과 이후 관찰

| 항목 | 실행 전 예상 | 실제 관찰 | 차이와 해석 |
|---|---|---|---|
| Request Line | `POST /api/tickets` | `NOT_RUN` | `NOT_RUN` |
| Request `Content-Type` | `application/json` | `NOT_RUN` | `NOT_RUN` |
| Response Status | `201 Created` | `NOT_RUN` | `NOT_RUN` |
| Response `Location` | `/api/tickets/{id}` | `NOT_RUN` | `NOT_RUN` |
| Response `Content-Type` | `application/json` | `NOT_RUN` | `NOT_RUN` |
| Response Body | `id`, `title`, `status` | `NOT_RUN` | `NOT_RUN` |

## AI 활용 기록

- AI가 보조한 부분: 질문을 한 단계씩 제시하고 Given–When–Then의 조건·행동·결과 구분, HTTP 요소 명칭·JSON 표현과 실행 결과 해석을 교정했다.
- 직접 확인한 공식 자료·실행 결과: Spring Boot `4.1.1` 구성, Unit Test 16개 통과, Application Context·Tomcat 기동, Root `GET`의 `404` JSON 응답과 Server 종료를 직접 확인했다.
- 직접 판단·수정한 부분: 정상·실패 사례별 입력, Status, 오류 원인과 저장 상태를 답하고, Root `404`가 기동 성공 근거이지만 Ticket API 근거는 아니라는 경계를 구분했다.
- 설명하거나 재현하지 못한 부분: 실제 Ticket API Status·Header·Body, Spring의 ID 변환 실패 처리와 Repository 호출 여부는 아직 재현하지 않았다.

## 다음 학습

- 남은 질문: 예상한 Ticket 생성·조회 Status·Header·Body가 실제 Spring MVC 구현 결과와 일치하는가?
- 다음 실행: Controller·Application Service·Repository Port·In-memory 구현으로 정상 생성·조회 수직 Slice를 만들고 MVC Test와 실제 `curl.exe` 호출을 수행한다.
- 보류 항목과 이유: `400`·`404`·대표 `500` 오류 구현과 Repository 호출 여부 검증은 정상 수직 Slice 이후 진행한다.
