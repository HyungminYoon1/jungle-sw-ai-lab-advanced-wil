# 2026-08-28 — Exception 흐름 복습과 공통 요청 처리 경계 학습 기록

> 작성일: 2026-08-28
> 목적: 8월 27일에 구현한 Validation·Exception Handler의 실제 흐름을 한 단계씩 다시 설명하고, Filter·Interceptor·Exception Handler의 책임 경계를 비교한다.
> 상태: Partially Completed — 대표 오류 흐름과 구성요소 역할은 교정 후 연결했지만 이름과 순서를 자료 없이 즉시 재현하는 숙련도, 전체 Test 재현과 조건부 실험은 남았다.

---

## 오늘의 범위

- 공백 제목 `POST`의 DTO 생성·Validation 실패 흐름
- 존재하지 않는 Ticket 조회의 Repository 부재·Service Exception·HTTP `404` 변환 흐름
- 잘못된 ID Type과 잘못된 JSON의 실패 지점 구분
- `TicketResult`, `TicketResponse`와 `ResponseEntity<TicketResponse>`의 역할 구분
- Filter·Interceptor·Exception Handler 비교 자료 작성
- Filter와 Interceptor 선택 질문 시작

## 소크라테스식 복습 결과

### 공백 제목은 DTO 생성 이후 Validation에서 거부된다

대상 요청은 JSON 문법상 유효하다.

```json
{
  "title": "   "
}
```

따라서 `HttpMessageConverter`가 `CreateTicketRequest`를 생성한다. 이후 Controller 매개변수의 `@Valid`가 검증을 요청하고, `title`의 `@NotBlank` 위반으로 `MethodArgumentNotValidException`이 발생한다.

처음에는 이 실패를 `IllegalArgumentException`으로 답했지만 다음 두 경계를 구분했다.

- 요청 DTO의 `@NotBlank` 실패 → `MethodArgumentNotValidException`
- Controller 밖에서 `new Ticket("   ")` 실행 → Domain 생성자의 `IllegalArgumentException`

DTO 검증은 Controller 메서드 호출 전에 실패한다. 따라서 Controller 메서드 본문, `TicketApplicationService.create()`와 `TicketRepository.save()`는 실행되지 않으며 기존 Repository 상태는 유지된다.

### 공백 제목 오류 응답 흐름

```text
정상 JSON
→ HttpMessageConverter가 CreateTicketRequest 생성
→ @Valid가 검증 요청
→ @NotBlank 위반
→ MethodArgumentNotValidException
→ HandlerExceptionResolver 처리 체계
→ TicketApiExceptionHandler.handleMethodArgumentNotValid()
→ 400 ProblemDetail
→ HttpMessageConverter가 JSON으로 직렬화
→ Client
```

처음에는 오류 Body 직렬화를 Controller의 책임으로 답했지만, Controller 메서드는 이미 호출되지 않았으며 `ProblemDetail`을 JSON으로 쓰는 구성요소는 `HttpMessageConverter`임을 확인했다.

### 존재하지 않는 Ticket 조회 흐름

`GET /api/tickets/999`에서 `999`는 `long`으로 정상 변환된다. Request Body가 없으므로 별도 DTO는 생성하지 않는다.

```text
TicketController.findById(999L)
→ TicketApplicationService.findById(999L)
→ TicketRepository.findById(999L)
→ Optional.empty()
→ map() 내부 미실행
→ TicketResult 미생성
→ orElseThrow()가 TicketNotFoundException 발생
```

Exception이 발생하는 순간 Controller의 다음 줄은 실행되지 않는다. `TicketResponse`와 `ResponseEntity.ok()`도 생성되지 않고 Spring MVC 오류 처리 경로로 이동한다.

다음 흐름은 보기 없이 다시 연결했다.

```text
TicketNotFoundException
→ HandlerExceptionResolver
→ TicketApiExceptionHandler.handleTicketNotFound()
→ ProblemDetail
→ HttpMessageConverter
→ Client
```

역할을 다음처럼 구분했다.

- `TicketNotFoundException`: Application 조회 실패 신호
- `HandlerExceptionResolver`: 처리 가능한 예외 처리 방법을 탐색하는 Spring MVC 구성요소
- `@ExceptionHandler`: Exception Type과 처리 Method를 연결하는 Annotation
- `TicketApiExceptionHandler`: Application 실패를 HTTP 오류 계약으로 변환하는 프로젝트의 Web Boundary
- `ProblemDetail`: Client에게 전달할 표준 오류 정보 객체
- `HttpMessageConverter`: Java 객체를 HTTP Body로 직렬화

### Spring MVC 기본 예외와 사용자 정의 예외 처리

```text
공백 제목 DTO 검증 실패
→ MethodArgumentNotValidException
→ 재정의한 handleMethodArgumentNotValid()

존재하지 않는 Ticket
→ TicketNotFoundException
→ @ExceptionHandler로 연결한 handleTicketNotFound()
```

`ResponseEntityExceptionHandler`는 Spring MVC 기본 예외를 처리할 수 있는 상위 Class다. 프로젝트에서 새로 정의한 `TicketNotFoundException`은 기본 처리 Method가 없으므로 `@ExceptionHandler(TicketNotFoundException.class)`로 처리 관계를 명시한다.

### 잘못된 ID Type과 잘못된 JSON

```text
GET /api/tickets/abc
→ Path Variable "abc"를 long으로 변환 실패
→ MethodArgumentTypeMismatchException
→ Controller·Service·Repository 미호출
```

`abc`는 HTTP URI 문법 오류가 아니다. 현재 API가 Path Variable을 `long`으로 요구하므로 Java 인수 Binding 단계에서 실패한다.

닫는 중괄호가 없는 JSON은 `HttpMessageConverter`가 읽지 못하므로 DTO가 생성되지 않고 `HttpMessageNotReadableException`이 발생한다.

두 입력 실패를 다음처럼 구분했다.

| 입력 | DTO 생성 | Exception |
|---|---|---|
| 닫는 중괄호가 없는 JSON | 미생성 | `HttpMessageNotReadableException` |
| `"title": "   "`인 정상 JSON | 생성 | `MethodArgumentNotValidException` |
| `GET /api/tickets/abc` | Request Body DTO 없음 | `MethodArgumentTypeMismatchException` |

공백 제목 사례에서 처음에는 DTO 미생성과 `MethodArgumentTypeMismatchException`으로 혼동했지만, JSON 변환·DTO Validation·Path Variable Type 변환의 서로 다른 실패 지점을 다시 구분했다.

## 성공 응답 객체 역할

- `TicketResult`: Application Service의 작업 결과
- `TicketResponse`: Client에게 보낼 JSON Body의 `id`, `title`, `status`
- `ResponseEntity<TicketResponse>`: HTTP Status·Header·Body 전체
- `HttpMessageConverter`: `TicketResponse` Body를 JSON으로 직렬화

Ticket 생성의 `201 Created`와 `Location` Header는 `ResponseEntity`에 담고, Ticket의 `OPEN` 상태는 Body인 `TicketResponse`에 담는다.

## Source 연결

다음 Production Source의 책임을 확인했다.

- `TicketApplicationService.findById()`: Repository 조회, `TicketResult` 생성 또는 `TicketNotFoundException` 발생
- `TicketController.findById()`: 성공한 `TicketResult`를 `TicketResponse`와 `ResponseEntity`로 조립
- `TicketApiExceptionHandler`: MVC 기본 예외와 Application Exception을 안전한 `ProblemDetail`로 변환

`HttpStatus.NOT_FOUND`가 Service가 아니라 Web Boundary에 있어야 하는 이유를 설명하는 질문은 다음 복습으로 남겼다.

## Filter·Interceptor·Exception Handler 학습 자료

세 구성요소의 위치·책임·선택 기준을 기존 Validation 문서에 추가하지 않고 별도 Learning Note로 작성했다.

- [Spring Filter·Interceptor·Exception Handler Learning Note](../study-docs/learning-spring-filter-interceptor-and-exception-handler.md)
- Commit: `c25498f docs: add Filter and Interceptor learning note`

이 문서는 순수 개념 자료로 유지하고 개인 이해 상태와 실제 수행 여부는 이 Study Note에 기록한다.

## 공통 처리 선택 질문

### 모든 요청의 Application 진입 시각

모든 HTTP 요청이 `DispatcherServlet`에 도달하기 전 Application Filter Chain 진입 시각을 기록하려면 Filter가 적합하다고 답했다.

다만 Filter가 측정하는 것은 Client의 전송 시작이나 Network 전체 시간이 아니다. Reverse Proxy, 앞선 Filter나 WAS 대기 이후 해당 Application 경계에 진입한 시점부터 관찰한다.

### 선택된 Controller Method 정보 사용

Controller Method 이름이나 Custom Annotation을 사용한 실행 시간 측정에는 Interceptor가 적합하다고 답했다. `HandlerInterceptor` Method의 인수 Type은 `Object handler`이며, Annotated Controller 요청에서는 이를 `HandlerMethod`로 확인하여 Method와 Annotation 정보를 읽을 수 있다.

요청별 시작 시각은 여러 요청이 공유할 수 있는 Interceptor Field가 아니라 Request 속성에 저장해야 한다.

## 실행·구현 경계

- Filter·Interceptor Production Code: `NOT_IMPLEMENTED`
- Filter·Interceptor Test: `NOT_RUN`
- CORS Simple·Preflight 실험: `NOT_RUN`
- 8월 27일 기준 전체 29개 Clean Test 이후 추가 Test: `NOT_RUN`
- Lab Source 변경: 없음

개념 비교를 위해 불필요한 Filter·Interceptor Class를 추가하지 않았다. 실제 설명 공백과 검증 목적이 확인될 때만 최소 구현한다.

## 현재 이해 상태

다음 내용은 교정 후 설명할 수 있다.

- JSON 문법 오류·DTO Validation·Path Variable Type 변환의 실패 지점
- Repository 부재부터 `404 ProblemDetail`까지의 역할 연결
- `TicketResult`, `TicketResponse`와 `ResponseEntity`의 차이
- 넓은 요청 공통 처리는 Filter, Handler 정보가 필요한 처리는 Interceptor라는 선택 기준

다음 내용은 아직 반복 복습이 필요하다.

- Exception Class와 Handler Method 이름을 자료 없이 즉시 재현
- `ResponseEntityExceptionHandler`, `HandlerExceptionResolver`와 프로젝트 Advice의 관계
- `postHandle()`과 `afterCompletion()`의 호출 조건
- Service가 HTTP Status를 몰라야 하는 이유의 독립 설명

## 다음 학습

1. `postHandle()`과 `afterCompletion()`을 성공·실패 흐름에서 비교한다.
2. Filter·Interceptor·Exception Handler 선택 문제를 반복한다.
3. Exception 흐름을 짧게 복습한 뒤 Source에서 다시 추적한다.
4. 새 Terminal에서 전체 Clean Test를 재현한다.
5. CORS는 핵심 Gate와 기록을 마친 뒤 시간이 남을 때만 수행한다.

## AI 활용 경계

- AI 보조: 한 문제씩 질문, 오답 교정, 역할 중심 Diagram과 Learning Note 구조 제안, Source 위치 안내
- 직접 수행: 질문 답변, 혼동 지점 표현, 구성요소 선택 판단과 학습자료 재검토
- 수행하지 않은 작업: Lab Code 수정, Test 실행, 실제 HTTP Trace와 CORS 실험
