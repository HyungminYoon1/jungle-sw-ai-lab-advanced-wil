# 2026-08-27 — Spring Validation·Exception Handler·ProblemDetail 학습 및 구현 기록

> 작성일: 2026-08-27
> 목적: HTTP 입력 실패와 Application 실패가 발견되는 경계를 구분하고, 이를 안전한 `ProblemDetail` 응답으로 변환하는 흐름을 설명·구현·검증한다.
> 상태: Partially Completed — 선택한 구현과 Test·실제 HTTP Trace는 완료했으나 Exception 전파와 구성요소별 책임은 8월 28일 오전에 다시 설명한다.

---

## 오늘의 범위

- 이월된 정상 `POST /api/tickets`·`GET /api/tickets/{id}` 실제 호출
- JSON 변환, 요청 DTO Validation과 Domain 불변조건 검증의 경계
- `HandlerExceptionResolver`, `@ExceptionHandler`, `@RestControllerAdvice`와 `ResponseEntityExceptionHandler`
- `400 Bad Request`, `404 Not Found`, 대표 `500 Internal Server Error`
- RFC 9457 `ProblemDetail`과 내부 정보가 없는 안전한 오류 Body
- MockMvc와 실제 Server `curl.exe` Trace의 검증 범위 비교

## 개념 점검에서 확인한 내용

### JSON 문법 오류와 공백 제목은 다른 단계에서 실패한다

잘못된 JSON은 `HttpMessageConverter`가 Request Body를 읽는 단계에서 `HttpMessageNotReadableException`으로 실패한다. 이때 `CreateTicketRequest` DTO는 생성되지 않고 Controller 메서드 본문도 실행되지 않는다.

공백 제목 JSON은 문법적으로 유효하므로 DTO가 먼저 생성된다. 이후 `@Valid`가 Validation을 요청하고 `@NotBlank` 제약조건 위반으로 `MethodArgumentNotValidException`이 발생한다. 이때 Domain `Ticket`, Service 호출과 Repository 저장은 발생하지 않는다.

`@NotBlank`는 HTTP 요청 DTO 경계를 보호하고 `Ticket` 생성자 검증은 Controller 밖의 모든 생성 경로에서 Domain 불변조건을 보호한다. 두 검증은 같은 위치의 중복이 아니라 서로 다른 경계의 방어선이다.

### ID `abc`와 ID `999`는 실패 의미가 다르다

- `GET /api/tickets/abc`: URI 전송 자체는 성공했지만 `abc`를 Controller 인수 `long`으로 변환하지 못한다. Controller와 Repository 조회 전 Type mismatch로 실패하므로 `400`이다.
- `GET /api/tickets/999`: ID 형식은 유효하여 Controller·Service·Repository까지 실행된다. Repository가 `Optional.empty()`를 반환하고 Service가 조회 Use Case 실패로 해석하므로 `404`다.

Path Variable 변환에는 Request Body가 없으므로 `HttpMessageConverter`가 관여하지 않는다.

### Repository 부재부터 HTTP 404까지의 책임

```text
TicketRepository
  → Optional.empty()
TicketApplicationService
  → TicketNotFoundException 발생
DispatcherServlet·HandlerExceptionResolver
  → 처리 가능한 Exception Handler 탐색
TicketApiExceptionHandler
  → 404 ProblemDetail 구성
HttpMessageConverter
  → ProblemDetail을 application/problem+json으로 직렬화
```

`TicketNotFoundException`은 조회 실패를 표현할 뿐 `HttpStatus`나 `ProblemDetail`을 알지 않는다. HTTP `404`와 Client용 오류 Body는 Web Boundary인 Controller Advice가 결정한다.

현재처럼 여러 오류 응답을 같은 형식으로 유지하려면 Service가 부재를 Application Exception으로 표현하고 Advice에서 공통 변환하는 방식이 적합하다. 단일 Endpoint에서 Body 없는 404만 필요하다면 Controller가 `Optional.empty()`를 직접 변환하는 단순한 방식도 가능하다.

### Exception은 반환값이 아니다

`service.findById(id)`가 정상 종료하면 `TicketResult`가 반환되고 다음 Controller 코드가 실행된다. `TicketNotFoundException`이 발생하면 `result`에는 아무 값도 저장되지 않으며 Controller 메서드의 다음 줄도 실행되지 않는다. 실행 흐름은 호출 경로를 빠져나가 `HandlerExceptionResolver`의 예외 처리 절차로 이동한다.

예외 기반 조회를 선택했으므로 Service의 반환형은 `Optional<TicketResult>`가 아니라 `TicketResult`로 변경했다. 부재는 `Optional.empty()`와 Exception으로 중복 표현하지 않는다.

### 성공 응답 객체의 역할

- `TicketResult`: Application Service의 작업 결과
- `TicketResponse`: Client에게 보낼 JSON Body 구조
- `ResponseEntity<TicketResponse>`: HTTP Status·Header·Body 전체

필드가 현재 같더라도 Application 결과와 Web 응답 계약을 분리하면 한쪽의 변경이 다른 계층으로 바로 퍼지는 것을 줄일 수 있다.

## 구현 내용

### 요청 검증

- `spring-boot-starter-validation` 추가
- `CreateTicketRequest.title`에 `@NotBlank(message = "title must not be blank")` 적용
- Controller의 생성 요청 인수에 `@Valid` 적용
- Domain `Ticket` 생성자 검증은 그대로 유지

### 조회 부재

- Application 계층에 `TicketNotFoundException` 추가
- `TicketApplicationService.findById()`가 성공 시 `TicketResult`, 부재 시 `TicketNotFoundException`을 반환·발생하도록 변경
- Controller의 `Optional` 분기 제거
- Advice가 `TicketNotFoundException`을 `404 Not Found`로 변환

### 공통 오류 응답

`TicketApiExceptionHandler`를 Production Source에 두고 `ResponseEntityExceptionHandler`를 상속했다.

- `MethodArgumentNotValidException` → `400`, `title must not be blank`
- `HttpMessageNotReadableException` → `400`, `request body is malformed`
- Ticket ID Type mismatch → `400`, `ticket id must be a number`
- `TicketNotFoundException` → `404`, `ticket not found`
- 예상하지 못한 `Exception` → `500`, `an unexpected server error occurred`

대표 `500`은 Production에 고의 실패 Endpoint를 만들지 않고 Repository 수동 Test Double이 통제된 `RuntimeException`을 발생시키는 방식으로 검증했다. 원래 Exception과 Stack Trace는 Server Log에 남기고 Client Body에는 포함하지 않았다.

## 자동 검증 근거

```powershell
.\mvnw.cmd clean test
```

```text
Tests run: 29
Failures: 0
Errors: 0
Skipped: 0
BUILD SUCCESS
```

| Test 묶음 | 개수 | 검증 범위 |
|---|---:|---|
| `TicketTest` | 10 | Domain 생성·상태 전이·상태 보존 |
| 조건문·Strategy Policy Test | 6 | 응답 시간 Policy 비교 회귀 |
| `InMemoryTicketRepositoryTest` | 3 | 저장·조회·ID 발급 |
| `TicketApplicationServiceTest` | 3 | 생성·조회와 부재 Exception |
| `TicketControllerTest` | 7 | 정상 `201`·`200`, `400` 세 범주, `404`, 대표 `500` |

`git diff --check`도 통과했다. 대표 `500` Test 중 출력된 `simulated repository failure` Stack Trace는 내부 진단 정보가 Server Log에 보존되는 것을 보여주는 의도된 출력이며 Test 실패가 아니다.

## 실제 HTTP Trace

Application을 실제 Tomcat Port `8080`에서 실행한 뒤 다음 결과를 확인했다.

| Request | Status | Content-Type·Header | Body 핵심 |
|---|---:|---|---|
| 정상 `POST /api/tickets` | `201` | `Location: /api/tickets/1`, `application/json` | `id: 1`, 제목, `OPEN` |
| 정상 `GET /api/tickets/1` | `200` | `application/json` | 저장된 Ticket JSON |
| 공백 제목 `POST /api/tickets` | `400` | `application/problem+json`, `Location` 없음 | `title must not be blank` |
| `GET /api/tickets/abc` | `400` | `application/problem+json`, `Location` 없음 | `ticket id must be a number` |
| `GET /api/tickets/999` | `404` | `application/problem+json`, `Location` 없음 | `ticket not found` |
| 잘못된 JSON `POST /api/tickets` | `400` | `application/problem+json`, `Location` 없음 | `request body is malformed` |

실제 `curl.exe`는 Network·Tomcat·Spring Application Context·Component Scan과 HTTP 직렬화까지 포함한다. Standalone MockMvc는 Server와 Network 없이 Controller 설정과 오류 계약을 빠르게 검증하며, Controller Advice를 직접 등록해야 한다.

대표 `500`은 실제 HTTP로 호출하지 않았다. Production 실패 Endpoint를 만들지 않는다는 범위를 유지하고 MockMvc Test로만 검증했다.

## 예상과 실제가 달랐던 점

### 기본 `type` Member가 JSON에서 생략됐다

처음에는 `$.type == "about:blank"`까지 Test했지만 실제 `ProblemDetail` JSON에는 `type` Member가 없었다. Spring Framework 7에서 `type`을 명시적으로 설정하지 않으면 Member가 생략될 수 있고, RFC 9457은 이 경우 값을 `about:blank`로 간주한다. Member의 존재 자체를 계약으로 정하지 않았으므로 해당 단언을 제거했다.

### Handler 파일을 처음에 Test Source에 만들었다

`TicketApiExceptionHandler`를 처음 `src/test/java`에 생성하여 Standalone MockMvc에서는 동작했지만 실제 Application에는 포함되지 않는 구조가 됐다. 파일을 `src/main/java`로 옮겨 Production Component Scan 대상이 되도록 수정했다. Test가 통과해도 Production Source에 기능이 존재한다는 뜻은 아니라는 점을 확인했다.

### 기본 ID 변환 메시지는 Framework 표현에 묶여 있었다

기본 응답은 `Failed to convert 'id' with value: 'abc'`였다. Status는 올바르지만 Framework 문구에 결합되어 있고 Client가 해야 할 행동이 덜 명확했다. Type mismatch 처리를 좁게 재정의하여 `ticket id must be a number`로 고정했다.

### Mockito Agent 경고를 수동 Test Double로 제거했다

대표 `500` Test에서 Mockito를 사용했을 때 JDK 25의 동적 Java Agent 경고가 발생했다. 이 Test 하나를 위해 Build Agent 설정을 추가하지 않고 `TicketRepository`의 수동 Test Double로 교체했다. 이후 29개 Clean Test가 경고 없이 통과했다.

## 현재 이해 상태

다음 내용은 설명할 수 있다.

- JSON 문법 오류, DTO Validation과 Domain 불변조건 검증의 차이
- ID `abc`의 `400`과 ID `999`의 `404` 차이
- `ProblemDetail`의 `title`, `status`, `detail`, `instance` 역할
- MockMvc와 실제 `curl.exe` Trace의 검증 범위
- 대표 `500`에서 Client 메시지와 내부 Log를 분리하는 이유

다음 내용은 아직 말이나 Code를 보지 않고 바로 설명하기 어렵다.

- Exception이 Controller를 빠져나가 Advice까지 전달되는 전체 순서
- `HandlerExceptionResolver`, `ResponseEntityExceptionHandler`, `@ExceptionHandler`의 역할 차이
- Repository의 `Optional.empty()`부터 Service Exception과 HTTP 404까지의 책임 분리
- 정상 반환과 예외 종료가 Controller의 다음 줄 실행에 만드는 차이

구현과 Test 통과만으로 완전히 이해했다고 처리하지 않는다. 8월 28일 오전에 위 네 항목을 새 사례와 한 문제씩 다시 확인한다.

## 8월 28일 오전 복습 계획

1. 문서를 보지 않고 공백 제목 `POST`와 존재하지 않는 Ticket `GET`의 흐름을 각각 Text Diagram으로 작성한다.
2. 한 번에 한 질문씩 `Exception 발생 지점 → 전파 → Handler 선택 → ProblemDetail 직렬화` 순서를 답한다.
3. `TicketNotFoundException`, `@ExceptionHandler`, `HandlerExceptionResolver`를 객체·Annotation·Framework 구성요소로 분류한다.
4. `TicketResult`, `TicketResponse`, `ResponseEntity<TicketResponse>`의 역할을 다시 구분한다.
5. `TicketApplicationService.findById()`와 Advice의 404 Handler를 보고 각 줄의 책임을 설명한다.
6. 관련 Test만 실행한 뒤 전체 Clean Test를 재현한다.

복습 설명이 끝난 뒤에만 Filter·Interceptor·Exception Handler 실행 위치 비교로 넘어간다. CORS는 Must Gate가 유지되고 시간이 남을 때만 수행한다.

## AI 활용 경계

- AI 보조: 개념 질문, 오답 교정, 구현 순서와 Test Case 제안, Code·실행 결과 Review
- 직접 수행: Source·Test 입력과 수정, Maven Test·Application 기동·`curl.exe` 실행, 실제 응답 관찰과 최종 판단
- 남은 책임: 8월 28일 복습에서 자료를 보지 않고 흐름을 재구성하고 설명 가능한지 다시 확인
