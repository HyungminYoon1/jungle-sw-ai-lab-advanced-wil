# Learning Note — Spring Validation과 HTTP 오류 응답

> 작성일: 2026-08-27
> 기준: Spring Framework 7.0.9, Spring Boot 4.1.1, Jakarta Validation 3.1, RFC 9457 공식 문서

## 핵심 질문

> 잘못된 HTTP 요청이나 Application 내부 실패가 발생했을 때, Spring MVC는 어느 경계에서 문제를 발견하고 어떻게 안전하고 일관된 HTTP 오류 응답으로 변환하는가?

## 학습 목표

이 자료를 학습한 뒤 다음 내용을 자신의 말로 설명하는 것이 목표다.

- JSON 변환, 요청 DTO 검증과 Domain 불변조건 검증을 구분한다.
- `@Valid`와 `@NotBlank`가 각각 맡는 역할을 설명한다.
- `@ExceptionHandler`, `@RestControllerAdvice`와 `ResponseEntityExceptionHandler`의 관계를 설명한다.
- `400 Bad Request`, `404 Not Found`와 `500 Internal Server Error`를 원인에 따라 구분한다.
- RFC 9457 `ProblemDetail`의 표준 필드와 사용 목적을 설명한다.
- 오류 응답에 내부 구현 정보와 Stack Trace를 노출하면 안 되는 이유를 설명한다.
- MockMvc 오류 Test가 예외 발생과 응답 계약, 실패 후 상태를 각각 어떻게 검증하는지 설명한다.

개인 답변, 실제 구현 여부와 실행 결과는 날짜별 Study Note에 기록한다. 이 문서는 날짜별 진도와 독립적으로 다시 읽을 수 있는 개념 자료다.

## 선행 자료

- [Spring MVC 요청 흐름과 Annotation](./learning-spring-mvc-request-flow-and-annotations.md)
- [HTTP 요청·응답 메시지](./learning-http-request-response-messages.md)

## 한 문장 설명

Validation은 요청이나 객체가 지켜야 할 조건을 검사하고, Exception Handler는 처리 과정에서 발생한 실패를 HTTP Status와 안전한 오류 Body로 변환하며, `ProblemDetail`은 그 오류 Body를 일관된 표준 형식으로 표현한다.

## 전체 오류 처리 흐름

정상 요청은 Controller, Application Service와 Domain을 거쳐 성공 응답으로 돌아온다. 오류 요청은 실패가 발견된 지점에서 정상 흐름을 중단하고 오류 응답 흐름으로 전환된다.

```text
Client
  ↓ HTTP Request
DispatcherServlet
  ↓
HttpMessageConverter
  ├─ JSON을 읽을 수 없음
  │    → HttpMessageNotReadableException
  │
  └─ 요청 DTO 생성
       ↓
     Bean Validation
       ├─ DTO 제약조건 위반
       │    → MethodArgumentNotValidException
       │
       └─ Controller 호출
            ↓
          Application Service·Domain·Repository
            ├─ Resource 부재
            ├─ Domain 규칙 위반
            └─ 예상하지 못한 내부 실패
                 ↓
          HandlerExceptionResolver
                 ↓
          @ExceptionHandler·Controller Advice
                 ↓
          ProblemDetail
                 ↓
          HTTP 400·404·500 Response
```

모든 오류가 같은 지점에서 발생하는 것은 아니다. 오류가 발견된 경계를 구분해야 적절한 Status와 처리 책임을 결정할 수 있다.

## 오류 응답도 API 계약이다

성공 응답만 API 계약인 것은 아니다. Client는 오류 응답을 보고 다음 행동을 결정한다.

- `400`: 요청을 수정해서 다시 보내야 하는가?
- `404`: 요청한 Resource가 존재하지 않는가?
- `500`: 같은 요청을 다시 시도하거나 운영자 확인이 필요한가?

Status만으로는 일반적인 오류 범주를 알 수 있다. 오류 Body는 어떤 요청 값이 잘못됐는지, Client가 무엇을 수정해야 하는지와 같은 추가 정보를 제공할 수 있다.

다만 오류 Body는 Server 내부를 디버깅하기 위한 보고서가 아니다. Client가 HTTP 요청을 올바르게 수정하거나 실패를 분류하는 데 필요한 정보만 제공해야 한다.

## 검증 책임을 세 경계로 구분하기

### 1. HTTP Content 변환과 Binding

Spring MVC는 Request Content와 URI 값을 Controller 메서드 인수로 변환한다.

대표 실패는 다음과 같다.

- JSON 문법이 잘못되어 Request Body를 읽을 수 없다.
- JSON 필드 Type을 Java Type으로 변환할 수 없다.
- `/api/tickets/abc`의 `abc`를 `long`으로 변환할 수 없다.
- 필수 Request Body가 없다.

이 단계는 객체의 Business 규칙을 검사하는 것이 아니라, HTTP 입력을 Controller가 사용할 Java 값으로 변환할 수 있는지 검사한다.

잘못된 JSON은 일반적으로 `HttpMessageNotReadableException`으로 나타난다. Path Variable Type 변환 실패는 Type mismatch 계열 예외로 나타난다.

`GET /api/tickets/abc`는 HTTP URI 문법 자체가 잘못된 요청은 아니다. URI는 정상적으로 전송됐지만, 이 API가 Path Variable을 `long`으로 받기로 한 계약과 맞지 않아 변환에 실패한 것이다.

### 2. 요청 DTO 제약조건 검증

JSON을 Java 객체로 변환할 수 있어도 각 필드 값이 API 입력 조건을 만족하지 않을 수 있다.

```json
{
  "title": "   "
}
```

위 JSON은 문법적으로 유효하다. 그러나 Ticket 생성 요청에서 제목이 공백뿐이면 허용하지 않는다는 입력 규칙을 위반한다.

Jakarta Validation의 `@NotBlank`는 다음 값을 거부한다.

- `null`
- 빈 문자열 `""`
- 공백 문자만 있는 문자열 `"   "`

```java
import jakarta.validation.constraints.NotBlank;

public record CreateTicketRequest(
        @NotBlank(message = "title must not be blank")
        String title) {
}
```

`@NotBlank`가 실제 제약조건이다. `@Valid`는 그 객체 안에 선언된 제약조건을 검사하도록 요청한다.

```java
import jakarta.validation.Valid;

@PostMapping
public ResponseEntity<TicketResponse> create(
        @Valid @RequestBody CreateTicketRequest request) {
    // 생성 Use Case 호출
}
```

`@Valid` 자체는 `null`, 공백이나 길이를 판단하는 제약조건이 아니다. `@NotBlank`, `@NotNull`, `@Size`와 같은 제약조건을 찾아 검증하도록 연결하는 역할을 한다.

`@RequestBody` 객체 검증에 실패하면 일반적으로 `MethodArgumentNotValidException`이 발생한다. Controller 메서드 인수에 제약조건을 직접 선언하는 Method Validation 구조에서는 `HandlerMethodValidationException`이 발생할 수 있다. Controller 메서드 Signature에 따라 두 예외의 발생 경로가 달라질 수 있다.

### 3. Domain 불변조건 검증

요청 DTO에 `@NotBlank`를 붙였다고 `Ticket` 생성자의 검증을 제거하면 안 된다.

```java
public Ticket(String title) {
    if (title == null || title.isBlank()) {
        throw new IllegalArgumentException(
                "title must not be blank");
    }

    this.title = title;
}
```

Domain 객체는 HTTP Controller 외에도 다음 경로에서 생성될 수 있다.

- 다른 Application Service
- Batch 작업
- Message Consumer
- Unit Test
- 향후 추가되는 다른 입력 Adapter

따라서 책임은 다음처럼 나뉜다.

| 경계 | 대표 책임 | 예시 |
|---|---|---|
| HTTP 변환 | 전송된 값을 Java Type으로 변환 | JSON 문법, `String` → `long` 변환 |
| 요청 DTO Validation | HTTP 입력 조건을 빠르게 검사 | 제목의 `@NotBlank` |
| Domain | 모든 생성 경로에서 불변조건을 최종 보호 | Ticket 제목은 null·blank일 수 없음 |

요청 DTO Validation과 Domain 검증은 중복 실수가 아니라 서로 다른 경계를 보호하는 방어선이다.

## Validation 구성

Bean Validation을 실행하려면 Validation API뿐 아니라 실제 검증 구현체가 Classpath에 있어야 한다. Spring Boot에서는 일반적으로 다음 Starter를 사용한다.

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

Spring Boot Parent를 사용하면 Boot가 관리하는 Version을 따를 수 있으므로 개별 Version을 직접 적지 않는다. 위 설정은 개념 예시이며, 실제 Dependency 추가와 Build 결과는 별도 실행 근거로 확인해야 한다.

## Exception은 어디에서 처리되는가

Controller 실행 전후에 예외가 발생하면 `DispatcherServlet`은 등록된 `HandlerExceptionResolver` Chain에 해결을 위임한다.

주요 처리 방식은 다음과 같다.

- Spring MVC 기본 예외를 Status로 변환하는 기본 Resolver
- `@ResponseStatus`가 선언된 예외를 처리하는 Resolver
- Controller나 Controller Advice의 `@ExceptionHandler`를 호출하는 Resolver

Exception Handler는 실패 원인을 없애거나 객체 상태를 자동으로 복구하지 않는다. 발생한 실패를 어떤 HTTP 응답으로 표현할지 결정하는 역할을 한다.

## `@ExceptionHandler`

`@ExceptionHandler`는 특정 Exception Type을 처리할 메서드를 선언한다.

```java
@ExceptionHandler(TicketNotFoundException.class)
public ProblemDetail handleTicketNotFound(
        TicketNotFoundException exception) {

    ProblemDetail problem = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND,
            "ticket not found");

    problem.setTitle("Not Found");
    return problem;
}
```

이 메서드는 다음 작업을 수행한다.

1. `TicketNotFoundException`을 처리 대상으로 선택한다.
2. HTTP Status를 `404 Not Found`로 정한다.
3. Client에게 제공할 안전한 설명을 만든다.
4. `ProblemDetail`을 Response Body로 반환한다.

`@ExceptionHandler`를 Controller Class 안에 두면 해당 Controller에만 적용된다. 여러 Controller에서 공통으로 사용할 오류 정책이라면 Controller Advice로 분리할 수 있다.

## `@RestControllerAdvice`

`@RestControllerAdvice`는 `@ControllerAdvice`와 `@ResponseBody`를 결합한 Annotation이다.

```java
@RestControllerAdvice
public class TicketApiExceptionHandler {

    @ExceptionHandler(TicketNotFoundException.class)
    public ProblemDetail handleTicketNotFound(
            TicketNotFoundException exception) {

        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND,
                "ticket not found");

        problem.setTitle("Not Found");
        return problem;
    }
}
```

- `@ControllerAdvice`: 여러 Controller에 공통으로 적용할 처리 Class를 등록한다.
- `@ResponseBody`: 반환값을 View가 아니라 HTTP Response Body로 처리한다.
- `@RestControllerAdvice`: REST API의 공통 오류 응답을 구성하기 편리하게 두 의미를 결합한다.

Controller 내부의 지역 `@ExceptionHandler`가 있으면 전역 Controller Advice보다 먼저 적용된다. 같은 오류를 여러 위치에서 중복 처리하면 어떤 정책이 적용되는지 이해하기 어려워지므로 책임 위치를 의도적으로 선택해야 한다.

## `ResponseEntityExceptionHandler`

Spring MVC는 `ResponseEntityExceptionHandler`라는 기반 Class를 제공한다. 이 Class는 Spring MVC의 내장 예외와 `ErrorResponseException`을 처리하고 오류 Body를 반환할 수 있는 공통 기반을 제공한다.

```java
@RestControllerAdvice
public class ApiExceptionHandler
        extends ResponseEntityExceptionHandler {

    // 필요한 Custom Exception Handler를 추가한다.
}
```

다음과 같은 Framework 예외의 응답을 공통으로 다루거나 필요한 부분만 Customizing할 수 있다.

- `HttpMessageNotReadableException`
- `MethodArgumentNotValidException`
- `HandlerMethodValidationException`
- Type mismatch 계열 예외

Spring Boot는 `spring.mvc.problemdetails.enabled` 설정을 통해 내장 Spring MVC 예외를 Problem Details 형식으로 처리하는 구성을 제공한다. Boot 자동 구성에 맡길지, `ResponseEntityExceptionHandler`를 상속하여 직접 정책을 관리할지는 프로젝트의 오류 계약 범위에 따라 선택한다.

두 방식을 이해하지 않은 채 동시에 넓게 Customizing하면 같은 예외에 여러 Handler가 경쟁할 수 있다. 먼저 필요한 오류 계약을 정하고 최소 범위만 직접 처리한다.

## `ProblemDetail`

`ProblemDetail`은 RFC 9457의 Problem Details 형식을 Spring에서 표현하는 Class다. Status마다 서로 다른 임의 JSON 구조를 새로 만들지 않고 공통 필드를 사용해 오류를 표현할 수 있다.

### 표준 필드

| 필드 | 의미 | 예시 |
|---|---|---|
| `type` | 문제 종류를 식별하는 URI | `about:blank` |
| `title` | 문제 종류를 나타내는 짧고 안정적인 제목 | `Bad Request` |
| `status` | 이번 응답의 HTTP Status Code | `400` |
| `detail` | 이번 문제 발생에 대한 구체적인 설명 | `title must not be blank` |
| `instance` | 이번 문제 발생을 식별하는 URI | `/api/tickets` |

`type`을 별도로 지정하지 않으면 기본 의미는 `about:blank`다. 이는 HTTP Status 이상의 별도 문제 종류를 정의하지 않았다는 뜻이다. Spring Framework 7의 `ProblemDetail`은 `type`을 명시적으로 설정하지 않으면 JSON Member를 생략할 수 있으며, RFC 9457은 생략된 경우에도 `about:blank`로 해석하도록 정한다.

`title`은 같은 문제 종류에서 반복 요청마다 쉽게 바뀌지 않는 짧은 설명이다. `detail`은 이번 요청에서 무엇이 잘못됐는지 설명하며, Client가 요청을 수정하는 데 도움이 되는 내용에 집중한다.

Spring MVC에서 `ProblemDetail`을 반환하면 다음 처리가 적용된다.

- `status` 값이 실제 HTTP Status를 결정한다.
- `instance`를 직접 지정하지 않으면 현재 Request Path로 설정될 수 있다.
- JSON 응답은 `application/problem+json` Media Type이 우선 사용된다.

### 예시 오류 응답

```http
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json
```

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "title must not be blank",
  "instance": "/api/tickets"
}
```

위 예시는 기본 `type`을 명시해 보여준 형태다. 실제 응답에서 `type` Member가 생략되어도 별도 Problem Type을 설정하지 않았다면 의미는 `about:blank`로 같다. API가 Member 자체의 존재까지 계약으로 정했다면 `setType()`으로 명시해야 한다.

Response Body의 `status`는 실제 HTTP Status Line과 일치해야 한다. Client는 Body의 숫자만 보는 것이 아니라 실제 HTTP Status를 기준으로 동작할 수 있기 때문이다.

## Ticket API 오류 분류

| 사례 | 발견 경계 | 적절한 Status | Client용 설명 예시 |
|---|---|---:|---|
| JSON 문법 오류 | `HttpMessageConverter` | `400` | `request body is malformed` |
| 제목이 null·공백 | 요청 DTO Validation | `400` | `title must not be blank` |
| ID가 `abc` | Path Variable Type 변환 | `400` | `ticket id must be a number` |
| ID 형식은 맞지만 Ticket이 없음 | 조회 Use Case 이후 Web 응답 변환 | `404` | `ticket not found` |
| 예상하지 못한 저장소·Application 실패 | Server 내부 처리 | `500` | `an unexpected server error occurred` |

### `400 Bad Request`

Client가 요청을 수정하면 해결할 수 있는 입력 문제에 사용한다.

- 읽을 수 없는 JSON
- 필수 Body 누락
- DTO 제약조건 위반
- Path Variable Type 변환 실패

모든 `IllegalArgumentException`을 무조건 `400`으로 처리하면 안 된다. 같은 Exception Type이 Programming Error나 다른 내부 문제에도 사용될 수 있기 때문이다. Handler는 자신이 HTTP 요청 오류라고 확실히 분류할 수 있는 실패만 좁게 처리해야 한다.

### `404 Not Found`

요청 형식과 ID Type은 유효하지만 해당 Resource가 없을 때 사용한다.

현재와 같은 작은 API에서는 Service의 `Optional.empty()`를 Controller가 `404`로 변환할 수 있다. 여러 Controller에서 같은 부재 정책을 반복하게 되면 Application 의미가 드러나는 `TicketNotFoundException`을 만들고 Controller Advice에서 공통 변환하는 방식도 고려할 수 있다.

어느 방식이 항상 정답인 것은 아니다.

| 방식 | 장점 | 주의점 |
|---|---|---|
| Controller가 `Optional.empty()`를 `404`로 변환 | 구조가 단순하고 예외 Class가 늘지 않음 | Controller마다 같은 변환이 반복될 수 있음 |
| Service가 `TicketNotFoundException`을 발생 | 공통 Handler에서 일관된 응답을 만들기 쉬움 | 단순한 부재를 예외 흐름으로 표현하는 비용이 생김 |

Domain과 Application 계층은 HTTP `404`를 직접 알 필요가 없다. Web Boundary가 부재 의미를 HTTP Status로 변환한다.

단건·선택적 단건·목록 조회에서 결과 없음의 의미와 Exception, `Optional`, Result Type 선택 기준은 [Service 결과와 실패 표현 설계](./learning-service-result-and-failure-design.md)에서 별도로 다룬다.

### `500 Internal Server Error`

Client 요청을 수정해서 해결할 수 없는 예상하지 못한 Server 내부 실패에 사용한다.

Client에게는 일반적인 메시지만 제공한다.

```json
{
  "title": "Internal Server Error",
  "status": 500,
  "detail": "an unexpected server error occurred"
}
```

다음 정보는 Response Body에 포함하지 않는다.

- Exception Class의 전체 이름
- Stack Trace
- Source File과 Line 번호
- 로컬 File 경로
- Database Query와 Table 구조
- 인증정보, Token과 개인정보

구체 원인은 Server Log와 내부 관찰 도구에서 확인한다. Client 응답과 내부 진단 정보는 목적과 공개 범위가 다르다.

## 예외 메시지를 그대로 반환하면 안 되는 이유

다음 코드는 단순하지만 안전한 오류 계약을 보장하지 못한다.

```java
problem.setDetail(exception.getMessage());
```

Exception 메시지는 다음 내용을 포함할 수 있다.

- 내부 Class·Method 이름
- 저장 기술이나 Query 정보
- File 경로
- 외부 시스템 응답
- 민감한 입력 값

따라서 알려진 Client 오류는 미리 정한 안전한 메시지로 변환하고, 예상하지 못한 내부 오류는 일반적인 메시지를 반환한다. 원래 Exception과 Cause는 내부 Log에서 보존하여 진단 가능성을 유지한다.

## Exception Handler가 해결하지 않는 것

Exception Handler는 다음 문제를 자동으로 해결하지 않는다.

- 이미 변경된 객체 상태의 복구
- Database Transaction Rollback 정책
- 실패한 외부 시스템 호출의 재시도
- 중복 요청 방지
- 사용자 권한 검사
- 잘못 설계된 Domain 규칙 수정

Exception Handler는 실패를 HTTP 응답으로 변환하는 Web Boundary의 책임이다. 상태 복구와 Transaction은 해당 계층의 별도 정책이 필요하다.

## MockMvc 오류 Test 설계

오류 Test는 Status 하나만 확인하지 않는다. 다음 항목을 분리해 검증한다.

1. 올바른 실패가 발생했는가?
2. HTTP Status가 계약과 일치하는가?
3. `Content-Type`이 `application/problem+json`과 호환되는가?
4. `title`, `status`, `detail`, `instance`가 의도한 의미를 가지는가?
5. 실패 후 Repository나 Domain 상태가 안전하게 유지되는가?
6. 내부 Class 이름, Stack Trace와 경로가 노출되지 않는가?

### 공백 제목 Test 예시

```java
mockMvc.perform(post("/api/tickets")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {
                          "title": "   "
                        }
                        """))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(
                MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(400))
        .andExpect(jsonPath("$.detail")
                .value("title must not be blank"));
```

실제 Test에서는 요청 전후 Repository 상태도 확인해야 한다. `400`이 반환됐지만 Ticket이 저장됐다면 응답 Status만 맞고 Use Case의 원자성은 깨진 것이다.

### 존재하지 않는 Ticket Test 예시

```java
mockMvc.perform(get("/api/tickets/{id}", 999L)
                .accept(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(status().isNotFound())
        .andExpect(content().contentTypeCompatibleWith(
                MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(404))
        .andExpect(jsonPath("$.detail")
                .value("ticket not found"));
```

### 대표 `500` Test

대표 내부 실패는 Test Double이나 Mock을 사용해 Application Service 또는 Repository가 통제된 Exception을 발생시키도록 구성한다.

- Production에 `/fail` 같은 고의 실패 Endpoint를 추가하지 않는다.
- Response가 `500`인지 확인한다.
- Body가 일반적인 안전한 메시지를 사용하는지 확인한다.
- Exception Class 이름, Stack Trace와 로컬 경로가 없는지 확인한다.

## Standalone MockMvc와 Controller Advice

`MockMvcBuilders.standaloneSetup(controller)`는 전달한 Controller를 중심으로 Test 환경을 직접 구성한다. 전체 Spring Application Context의 Component Scan을 실행하는 방식이 아니다.

따라서 Controller Advice도 직접 등록해야 한다.

```java
mockMvc = MockMvcBuilders
        .standaloneSetup(controller)
        .setControllerAdvice(
                new TicketApiExceptionHandler())
        .build();
```

Advice를 등록하지 않고 Standalone MockMvc를 실행하면 Production에서 기대한 전역 오류 변환이 Test에 적용되지 않을 수 있다.

반대로 Spring Application Context를 사용하는 MVC Test는 Bean 탐색과 Advice 연결까지 확인할 수 있지만 Test 범위와 실행 비용이 더 커진다. 현재 학습 목적에 따라 어느 경계를 검증하는지 명시해야 한다.

## 자주 발생하는 오해

### `@RequestBody`가 제목의 유효성까지 검사한다

아니다. `@RequestBody`는 Request Content를 Java 객체로 읽고 변환하도록 연결한다. 제목이 null·blank인지 판단하려면 제약조건과 Validation 또는 Domain 검증이 필요하다.

### `@Valid` 자체가 공백을 거부한다

아니다. 공백을 거부하는 제약조건은 `@NotBlank`다. `@Valid`는 객체 안의 제약조건 검증을 요청한다.

### DTO Validation이 있으면 Domain 검증은 제거해도 된다

아니다. DTO는 HTTP 입력 경계를 보호하고 Domain은 모든 생성 경로에서 불변조건을 보호한다.

### Exception이 발생하면 Spring이 객체 상태를 자동 복구한다

아니다. Exception Handler는 실행 흐름과 HTTP 응답을 처리한다. 이미 변경된 Memory 상태를 자동으로 되돌리지 않는다.

### 모든 RuntimeException은 `500`이다

아니다. Exception 상속 구조만으로 HTTP Status를 결정하지 않는다. Client 입력 오류로 명확하게 분류되는 RuntimeException은 `400`으로 변환될 수 있고, 예상하지 못한 내부 실패는 `500`으로 처리할 수 있다.

### 모든 IllegalArgumentException은 `400`이다

아니다. 같은 Type이 내부 Programming Error에도 사용될 수 있다. 발생 위치와 의미를 확인하고 구체적인 계약만 Mapping해야 한다.

### `ProblemDetail`은 Server 디버깅 정보를 전달하는 형식이다

아니다. HTTP API Client가 문제를 이해하기 위한 형식이다. Stack Trace와 내부 구현 정보는 포함하지 않는다.

### Standalone MockMvc가 Controller Advice를 자동으로 찾는다

아니다. 전체 Component Scan을 실행하지 않으므로 필요한 Advice를 Test 설정에 명시적으로 등록해야 한다.

### `GET /api/tickets/abc`는 HTTP URI 문법 오류다

아니다. HTTP 요청은 Server에 도달할 수 있다. API가 ID를 `long`으로 Binding하는 과정에서 값 변환에 실패하므로 `400`으로 분류하는 것이다.

## 설계 판단 순서

오류 Handler부터 작성하지 말고 다음 순서로 진행한다.

1. 실패 Scenario의 Given–When–Then을 작성한다.
2. Client가 수정할 수 있는 문제인지 Server 내부 문제인지 구분한다.
3. 적절한 HTTP Status를 정한다.
4. Client에게 필요한 안전한 `detail`을 정한다.
5. 실패가 발견되는 계층과 Exception Type을 확인한다.
6. 가장 좁은 책임 범위에 Handler를 둔다.
7. MockMvc로 Status·Body·상태 보존을 검증한다.
8. 실제 Server 호출로 Network·Tomcat·Context를 포함한 응답을 별도로 확인한다.

## 설명 연습 질문

1. 읽을 수 없는 JSON과 공백 제목은 모두 `400`이지만 어느 단계에서 각각 발견되는가?
2. `@Valid`와 `@NotBlank`는 각각 어떤 역할을 담당하는가?
3. 요청 DTO에 `@NotBlank`가 있어도 `Ticket` 생성자 검증을 유지해야 하는 이유는 무엇인가?
4. `@ExceptionHandler`와 `@RestControllerAdvice`의 적용 범위는 어떻게 다른가?
5. `ResponseEntityExceptionHandler`는 어떤 문제를 줄여주는가?
6. `ProblemDetail`의 `title`과 `detail`은 어떻게 다른가?
7. Body의 `status`와 실제 HTTP Status Line이 일치해야 하는 이유는 무엇인가?
8. ID `999`와 ID `abc` 조회는 왜 각각 `404`와 `400`인가?
9. 모든 `IllegalArgumentException`을 `400`으로 Mapping하면 어떤 문제가 생길 수 있는가?
10. 대표 `500` Test에서 Exception 메시지를 그대로 Body에 넣으면 안 되는 이유는 무엇인가?
11. Exception Handler가 이미 변경된 객체 상태를 자동 복구하지 않는 이유는 무엇인가?
12. Standalone MockMvc Test에서 Controller Advice를 직접 등록해야 하는 이유는 무엇인가?

## 자료 범위

이 자료는 Spring MVC의 요청 Validation과 REST API 오류 응답을 학습 범위로 삼는다. 다음 내용은 별도 학습 대상으로 남긴다.

- Database Transaction과 Rollback
- Spring Security 인증·인가 오류
- 다국어 Validation Message와 `MessageSource` 상세 구성
- 대규모 API의 Problem Type URI Registry 운영
- 분산 Trace ID와 Observability 연동
- Retry, Circuit Breaker와 외부 시스템 장애 복구
- Reactive Stack인 Spring WebFlux의 오류 처리

## 참고 자료

- [Spring Framework — Validation](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-validation.html)
- [Spring Framework — Exceptions](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-exceptionhandler.html)
- [Spring Framework — Controller Advice](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-advice.html)
- [Spring Framework — Error Responses](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html)
- [Spring Boot — Validation](https://docs.spring.io/spring-boot/reference/io/validation.html)
- [Spring Boot — Managed Dependency Coordinates](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html)
- [Jakarta Validation — `@NotBlank`](https://jakarta.ee/specifications/bean-validation/3.1/apidocs/jakarta/validation/constraints/notblank)
- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
