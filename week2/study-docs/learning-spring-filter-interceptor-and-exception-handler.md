# Learning Note — Spring Filter·Interceptor·Exception Handler

> 작성일: 2026-08-28
> 기준: Spring Framework 7.0.9, Jakarta Servlet 6.1 공식 문서

## 핵심 질문

> 여러 HTTP 요청에 공통으로 적용할 처리가 필요할 때, Filter·Interceptor·Exception Handler 중 어느 경계에 책임을 두어야 하는가?

## 학습 목표

이 자료를 학습한 뒤 다음 내용을 자신의 말로 설명하는 것이 목표다.

- Filter·Interceptor·Exception Handler가 요청 처리 과정의 어느 위치에서 동작하는지 구분한다.
- 세 구성요소가 볼 수 있는 정보와 책임 범위의 차이를 설명한다.
- `FilterChain.doFilter()`, `preHandle()`, `postHandle()`과 `afterCompletion()`의 실행 의미를 구분한다.
- MVC 처리 과정의 Exception과 Filter 단계의 Exception이 같은 경로로 처리되지 않을 수 있음을 설명한다.
- 인증·인가, Logging, Handler별 공통 처리와 API 오류 응답에 적합한 경계를 선택한다.
- 공통 처리라는 이유만으로 Business Logic을 Filter나 Interceptor에 두면 안 되는 이유를 설명한다.

개인 답변, 구현 여부와 실행 결과는 날짜별 Study Note에 기록한다. 이 문서는 개념과 선택 기준을 설명하는 학습 자료로 사용한다.

## 선행 자료

- [Spring MVC 요청 흐름과 Annotation](./learning-spring-mvc-request-flow-and-annotations.md)
- [Spring Validation과 HTTP 오류 응답](./learning-spring-validation-and-error-responses.md)

## 한 문장 설명

Filter는 Servlet 수준에서 요청과 응답의 바깥쪽을 감싸고, Interceptor는 Spring MVC가 선택한 Handler의 실행 전후에 개입하며, Exception Handler는 MVC 처리 중 발생한 실패를 HTTP 오류 응답으로 변환한다.

## 전체 위치

일반적인 Spring MVC 요청 흐름을 단순화하면 다음과 같다.

```text
Client
  ↓
Servlet Filter Chain
  ↓
DispatcherServlet
  ↓
HandlerMapping
  ↓ Handler 선택
HandlerInterceptor.preHandle()
  ↓
HandlerAdapter
  ↓
Controller
  ↓
Application Service
  ↓
Repository·Domain
```

정상적으로 돌아오는 흐름은 바깥에서 안으로 들어간 순서의 반대 방향으로 진행된다.

```text
Controller 정상 반환
  ↓
HandlerInterceptor.postHandle()
  ↓
Response 처리 완료
  ↓
HandlerInterceptor.afterCompletion()
  ↓
FilterChain.doFilter() 다음 코드
  ↓
Client
```

이 Diagram은 핵심 위치를 이해하기 위한 단순화다. 비동기 요청, Forward·Include·Error Dispatch, 정적 Resource와 여러 Filter·Interceptor의 세부 순서는 별도 설정에 따라 달라질 수 있다.

## Filter

### 무엇인가

Filter는 Jakarta Servlet API의 구성요소다. Servlet Container가 관리하는 Filter Chain에서 동작하며, 일반적인 Spring MVC Application에서는 `DispatcherServlet`을 포함한 대상 Resource의 바깥쪽에서 요청과 응답을 감싼다.

Filter는 `FilterChain.doFilter(request, response)`를 호출하여 다음 Filter나 최종 Resource로 처리를 전달한다.

```text
Filter 전처리
  ↓
filterChain.doFilter()
  ↓
다음 Filter 또는 DispatcherServlet
  ↓
Filter 후처리
```

`doFilter()`를 호출하지 않으면 다음 단계로 요청이 전달되지 않는다. 이 경우 Filter가 Response를 완성하거나 요청을 중단할 책임까지 져야 한다.

### Filter가 적합한 경우

- 모든 요청 또는 넓은 URL 범위의 공통 처리
- Request ID·Correlation ID 생성과 전달
- 민감정보를 제외한 공통 Access Log
- Request·Response Wrapper가 필요한 처리
- 압축·Encoding처럼 Servlet Request·Response 자체와 가까운 처리
- Spring Security Filter Chain처럼 MVC보다 앞에서 적용해야 하는 보안 처리

### Filter에 두지 말아야 하는 책임

- Ticket 상태 전이 같은 Domain 규칙
- Repository 조회와 저장
- 특정 Controller Method의 Annotation을 전제로 한 세밀한 판단
- MVC Exception을 `ProblemDetail`로 변환하는 API 오류 정책
- Request Body, `Authorization`, Cookie와 Token 값을 무조건 Log에 남기는 처리

Filter는 Controller가 선택되기 전에 실행될 수 있으므로 어떤 Controller Method가 처리할 요청인지 모를 수 있다.

### 개념 Code

```java
public final class RequestTimingFilter
        extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain)
            throws ServletException, IOException {

        long startedAt = System.nanoTime();

        try {
            filterChain.doFilter(request, response);
        } finally {
            long elapsedNanos =
                    System.nanoTime() - startedAt;

            // Method·Path·Status·소요 시간처럼
            // 안전한 정보만 기록한다.
        }
    }
}
```

이 Code는 실행 위치를 보여주기 위한 예시다. 실제 Logging 정책, 비동기 Dispatch, 중복 실행 방지와 민감정보 제외 규칙은 별도로 결정해야 한다.

### Filter Exception의 경계

Filter가 `filterChain.doFilter()`를 호출하기 전에 Exception을 발생시키면 요청이 `DispatcherServlet`까지 도달하지 않을 수 있다. 따라서 Controller와 Controller Advice를 대상으로 하는 `@RestControllerAdvice`가 모든 Filter Exception을 자동으로 처리한다고 가정하면 안 된다.

Filter 단계의 인증 실패나 공통 오류 응답은 해당 Filter Chain의 전용 처리 방식 또는 Spring Security의 구성요소처럼 그 경계에 맞는 정책을 사용해야 한다.

## Interceptor

### 무엇인가

`HandlerInterceptor`는 Spring MVC의 Handler 실행 Chain에 참여한다. `HandlerMapping`이 처리할 Handler를 선택한 뒤, `HandlerAdapter`가 실제 Handler를 호출하기 전후에 동작한다.

Filter와 달리 선택된 Handler 객체를 받을 수 있으므로 Controller Method와 가까운 공통 처리에 적합하다.

### 주요 Method

| Method | 실행 시점 | 핵심 용도 |
|---|---|---|
| `preHandle()` | Handler 실행 전 | 실행 허용 여부, Handler 관련 전처리 |
| `postHandle()` | Handler가 정상 실행된 뒤 | 정상 처리 후 작업 |
| `afterCompletion()` | 요청 처리가 완료된 뒤 | 정리 작업과 전체 소요 시간 관찰 |

`preHandle()`이 `true`를 반환하면 다음 Interceptor 또는 Handler로 진행한다. `false`를 반환하면 DispatcherServlet은 해당 Interceptor가 Response 처리를 완료했다고 본다.

`postHandle()`은 Handler가 성공적으로 실행된 뒤 호출된다. 예외로 정상 실행이 끝나지 않았다면 호출되지 않는다. REST Controller에서는 Response Body가 이미 작성되는 시점과 관계가 있으므로 `postHandle()`에서 Body를 임의로 바꾸는 설계를 피한다.

`afterCompletion()`은 이 Interceptor의 `preHandle()`이 성공하고 `true`를 반환한 경우에 요청 처리 완료 후 호출된다. Exception Resolver가 이미 처리한 Exception은 `afterCompletion()`의 `ex` 인수에 포함되지 않을 수 있으므로, 이 인수만으로 모든 오류를 집계한다고 가정하면 안 된다.

### Interceptor가 적합한 경우

- 선택된 Handler Method 정보를 사용해야 하는 공통 처리
- 특정 Controller 경로의 실행 시간 측정
- Locale이나 Handler 관련 Request 속성 설정
- 여러 Controller에서 반복되는 MVC 수준 전처리
- Handler 실행 전후의 공통 진단 정보 기록

### Interceptor에 두지 말아야 하는 책임

- Domain 규칙과 Use Case 실행
- Repository 접근
- 모든 정적 Resource까지 포함해야 하는 Servlet 수준 처리
- Request·Response Body Wrapper가 필요한 저수준 처리
- REST API Exception을 일관된 Body로 변환하는 책임
- Spring Security를 대신하는 자체 인증·인가 체계

Spring 공식 문서는 Annotated Controller Path Matching과 불일치할 수 있으므로 Interceptor를 보안 계층의 기본 선택으로 권장하지 않는다. 인증·인가는 일반적으로 Spring Security처럼 Servlet Filter Chain과 통합된 구성을 우선한다.

### 개념 Code

```java
public final class HandlerTimingInterceptor
        implements HandlerInterceptor {

    private static final String STARTED_AT =
            HandlerTimingInterceptor.class.getName()
                    + ".startedAt";

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler) {

        request.setAttribute(
                STARTED_AT,
                System.nanoTime());

        return true;
    }

    @Override
    public void afterCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception exception) {

        Object startedAt = request.getAttribute(
                STARTED_AT);

        // Handler·Status·소요 시간처럼
        // 안전한 정보만 기록한다.
    }
}
```

요청별 값은 Singleton Bean의 가변 필드에 저장하지 않고 Request 속성이나 요청 범위의 안전한 저장 위치를 사용한다.

### 등록 위치

Interceptor는 일반적으로 `WebMvcConfigurer`에서 등록한다.

```java
@Configuration
public class WebConfiguration
        implements WebMvcConfigurer {

    @Override
    public void addInterceptors(
            InterceptorRegistry registry) {

        registry.addInterceptor(
                new HandlerTimingInterceptor());
    }
}
```

등록 자체가 목적은 아니다. 어떤 Handler 범위에 왜 적용하는지 먼저 정하고, 필요한 Path만 포함하거나 제외한다.

## Exception Handler

### 무엇인가

Exception Handler는 Spring MVC가 처리할 수 있는 Exception을 HTTP Status와 오류 Body로 변환한다. `HandlerExceptionResolver` 처리 체계가 적절한 Handler를 찾고, `@ExceptionHandler` Method나 `@RestControllerAdvice`가 변환 정책을 실행한다.

```text
Controller 처리 중 Exception
  ↓
HandlerExceptionResolver 처리 체계
  ↓
@ExceptionHandler Method
  ↓
ProblemDetail
  ↓
HttpMessageConverter
  ↓
HTTP 오류 Response
```

### Exception Handler가 적합한 경우

- Application의 조회 실패를 `404 Not Found`로 변환
- DTO Validation 실패를 `400 Bad Request`로 변환
- 잘못된 JSON을 안전한 `400 ProblemDetail`로 변환
- 예상하지 못한 내부 실패를 상세 정보가 없는 `500`으로 변환
- 여러 Controller의 오류 응답 형식을 일관되게 유지

### Exception Handler에 두지 말아야 하는 책임

- 실패한 Business 작업을 임의로 다시 실행
- 이미 변경된 객체 상태를 자동으로 복구
- Transaction 대신 Memory나 Database 상태를 Rollback
- 인증·인가의 핵심 판정
- 정상 요청의 공통 전처리

Exception Handler의 상세 내용은 [Spring Validation과 HTTP 오류 응답](./learning-spring-validation-and-error-responses.md)에서 다룬다. 이 문서에서는 다른 두 경계와의 비교에 집중한다.

## 세 구성요소 비교

| 기준 | Filter | Interceptor | Exception Handler |
|---|---|---|---|
| 소속 경계 | Jakarta Servlet | Spring MVC Handler Chain | Spring MVC 오류 처리 |
| 주요 위치 | DispatcherServlet 바깥쪽 | Handler 선택 후 실행 전후 | MVC Exception 발생 후 |
| Controller Method 정보 | 일반적으로 모름 | 알 수 있음 | 발생한 Handler·Exception 문맥 사용 가능 |
| Request·Response Wrapping | 가능 | 주된 용도 아님 | 하지 않음 |
| 정상 흐름 중단 | `doFilter()` 미호출 | `preHandle()`이 `false` 반환 | 이미 발생한 실패를 응답으로 변환 |
| 대표 용도 | 넓은 요청 공통 처리 | Handler별 공통 처리 | 일관된 API 오류 응답 |
| Business Logic 위치 | 부적합 | 부적합 | 부적합 |

## 상황별 선택

| 요구사항 | 우선 선택 | 이유 |
|---|---|---|
| 모든 요청에 Request ID 부여 | Filter | MVC 진입 전 넓은 범위에 적용 가능 |
| 선택된 Controller Method 이름을 포함한 실행 시간 측정 | Interceptor | Handler 정보를 사용할 수 있음 |
| `TicketNotFoundException`을 `404 ProblemDetail`로 변환 | Exception Handler | Application 실패를 HTTP 계약으로 변환하는 책임 |
| Ticket의 상태 전이 검증 | Domain `Ticket` | 객체 자신의 규칙이므로 세 구성요소의 책임이 아님 |
| Ticket 생성·조회 조정 | Application Service | Use Case 책임이므로 세 구성요소의 책임이 아님 |
| 인증·인가 | Spring Security Filter Chain | Interceptor보다 이른 경계에서 일관되게 적용 |
| CORS | Spring MVC CORS 구성 또는 `CorsFilter` | 임의의 Custom Handler보다 Framework 지원을 우선 |

## 정상 흐름과 예외 흐름 비교

### 정상 조회

```text
Filter 전처리
→ DispatcherServlet
→ Interceptor.preHandle()
→ TicketController
→ TicketApplicationService
→ TicketRepository
→ TicketResult
→ TicketResponse
→ Interceptor.postHandle()
→ Interceptor.afterCompletion()
→ Filter 후처리
→ Client
```

### 존재하지 않는 Ticket

```text
Filter 전처리
→ DispatcherServlet
→ Interceptor.preHandle()
→ TicketController
→ TicketApplicationService
→ TicketNotFoundException
→ HandlerExceptionResolver
→ TicketApiExceptionHandler
→ 404 ProblemDetail
→ Interceptor.afterCompletion()
→ Filter 후처리
→ Client
```

이 예외 흐름에서는 Handler가 정상 반환하지 않았으므로 `postHandle()`이 실행되지 않는다. Resolver가 처리한 Exception은 `afterCompletion()`의 `ex` 인수에서 보이지 않을 수 있다.

### Filter 전처리 실패

```text
Filter 전처리 중 Exception
→ DispatcherServlet에 도달하지 못함
→ Controller Advice가 처리한다고 보장할 수 없음
→ Filter Chain 또는 Container 경계의 오류 정책 필요
```

세 흐름을 구분해야 모든 오류를 한 Controller Advice가 자동으로 처리한다는 잘못된 가정을 피할 수 있다.

## Test 경계

### Filter Test

- Filter 전처리와 후처리가 실행되는지 확인한다.
- `doFilter()` 호출 여부에 따라 다음 Chain이 실행되는지 확인한다.
- Response Header·Status처럼 Filter가 맡은 결과만 검증한다.
- Standalone MockMvc에서는 필요한 Filter를 직접 추가한다.

```java
MockMvcBuilders
        .standaloneSetup(controller)
        .addFilters(filter)
        .build();
```

### Interceptor Test

- `preHandle()`의 `true`·`false`에 따른 Handler 실행 여부를 구분한다.
- 정상 완료와 Exception 발생 시 Callback 차이를 확인한다.
- Handler Method 정보가 필요한 판단을 검증한다.
- Standalone MockMvc에서는 필요한 Interceptor를 직접 추가한다.

```java
MockMvcBuilders
        .standaloneSetup(controller)
        .addInterceptors(interceptor)
        .build();
```

### Exception Handler Test

- Exception Type과 HTTP Status Mapping을 검증한다.
- `ProblemDetail`의 `title`, `status`, `detail`과 `instance`를 확인한다.
- 내부 Exception Class, Stack Trace와 로컬 경로가 Body에 없는지 확인한다.
- Standalone MockMvc에서는 Controller Advice를 직접 등록한다.

```java
MockMvcBuilders
        .standaloneSetup(controller)
        .setControllerAdvice(exceptionHandler)
        .build();
```

MockMvc는 선택한 MVC 구성요소의 동작을 빠르게 검증한다. 실제 Server 호출은 Servlet Container 등록, 전체 Filter Chain, Spring Application Context와 Network를 포함한 별도 근거다.

## 자주 발생하는 오해

### Filter는 Controller 전용 기능이다

아니다. Filter는 Servlet 수준에 속하며 Mapping에 따라 다른 Servlet이나 정적 Resource에도 적용될 수 있다.

### Interceptor는 Filter보다 항상 더 좋은 선택이다

아니다. Handler 정보가 필요하면 Interceptor가 적합하고, MVC보다 앞의 넓은 요청 처리나 Request·Response Wrapping이 필요하면 Filter가 적합하다.

### Interceptor에서 인증·인가를 직접 구현하면 충분하다

일반적인 권장 방식이 아니다. 보안은 Path Matching 차이와 우회 가능성을 고려해야 하므로 Spring Security처럼 Servlet Filter Chain에 통합된 검증된 구성을 우선한다.

### Exception Handler가 모든 Filter Exception도 처리한다

아니다. DispatcherServlet에 도달하기 전에 Filter에서 실패하면 MVC의 HandlerExceptionResolver 경로가 실행되지 않을 수 있다.

### `postHandle()`은 성공과 실패 모두 실행된다

아니다. Handler가 정상 실행된 뒤 호출된다. 완료 후 정리에는 `afterCompletion()`의 목적이 더 가깝지만, Resolver가 처리한 Exception이 `ex`에 항상 전달되는 것도 아니다.

### 공통 기능은 모두 Filter나 Interceptor에 둔다

아니다. 여러 요청에서 반복된다는 사실보다 책임의 성격이 중요하다. Domain 규칙과 Use Case는 Domain과 Application Service에 남겨야 한다.

### Filter나 Interceptor의 필드에 요청 시작 시각을 저장한다

위험하다. 일반적으로 하나의 Bean Instance가 여러 요청을 처리할 수 있으므로 요청별 가변 값을 공유 필드에 저장하면 요청 간 값이 섞일 수 있다.

## 선택 판단 순서

공통 처리 위치를 정할 때 다음 순서로 판단한다.

1. Domain 규칙이나 Use Case인가?
   - 그렇다면 Filter·Interceptor·Exception Handler가 아니다.
2. 실패를 HTTP 오류 계약으로 바꾸는가?
   - 그렇다면 Exception Handler를 검토한다.
3. 선택된 Controller Method 정보가 필요한가?
   - 그렇다면 Interceptor를 검토한다.
4. Servlet 수준에서 넓은 Request·Response 처리가 필요한가?
   - 그렇다면 Filter를 검토한다.
5. 인증·인가인가?
   - 자체 Interceptor보다 Spring Security Filter Chain을 우선 검토한다.
6. Framework가 이미 제공하는 기능인가?
   - CORS·Security·Encoding의 기존 지원을 우선 사용한다.

## 설명 연습 질문

1. Filter와 Interceptor는 각각 어느 Framework 경계에 속하는가?
2. `FilterChain.doFilter()`를 호출하지 않으면 어떤 일이 생기는가?
3. `preHandle()`이 `false`를 반환하면 누가 Response를 완성해야 하는가?
4. `postHandle()`과 `afterCompletion()`은 어떤 차이가 있는가?
5. Handler Method Annotation을 확인해야 하는 처리는 어느 위치가 적합한가?
6. `TicketNotFoundException`을 `404`로 변환하는 책임은 왜 Interceptor가 아닌가?
7. Filter에서 발생한 Exception을 Controller Advice가 항상 처리하지 못하는 이유는 무엇인가?
8. 인증·인가에 자체 Interceptor보다 Spring Security를 우선하는 이유는 무엇인가?
9. Request Timing을 Singleton Bean의 필드에 저장하면 어떤 문제가 생길 수 있는가?
10. 현재 Ticket Lab에 Filter나 Interceptor 구현이 반드시 필요하지 않은 이유는 무엇인가?

## 자료 범위

이 자료는 Servlet 기반 Spring MVC에서 Filter·Interceptor·Exception Handler의 위치와 선택 기준을 학습 범위로 삼는다. 다음 내용은 별도 학습 대상으로 남긴다.

- Spring Security Filter Chain 내부 구조
- CORS Simple Request와 Preflight 실험
- 비동기 Servlet Dispatch와 `AsyncHandlerInterceptor`
- Log Correlation과 분산 Trace Context
- Micrometer Observation과 Production Monitoring
- WebFlux의 `WebFilter`
- Filter·Interceptor의 실행 순서 설정 상세

## 참고 자료

- [Jakarta Servlet 6.1 Specification — Filtering](https://jakarta.ee/specifications/servlet/6.1/jakarta-servlet-spec-6.1)
- [Spring Framework — Interceptors](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-config/interceptors.html)
- [Spring Framework API — `HandlerInterceptor`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/HandlerInterceptor.html)
- [Spring Framework API — `OncePerRequestFilter`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/filter/OncePerRequestFilter.html)
- [Spring Framework — Exceptions](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-exceptionhandler.html)
- [Spring Framework — Error Responses](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html)
