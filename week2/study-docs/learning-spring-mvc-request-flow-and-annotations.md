# Learning Note — Spring MVC 요청 흐름과 Annotation

> 작성일: 2026-08-26
> 기준: Spring Framework Reference Documentation, Spring Boot Reference Documentation

## 핵심 질문

> HTTP 요청이 Spring MVC 내부에서 어떤 과정을 거쳐 Controller 메서드에 도달하며, 각 Annotation은 그 과정에서 어떤 정보를 Framework에 제공하는가?

## 학습 목표

이 자료를 학습한 뒤 다음 내용을 자신의 말로 설명하는 것이 목표다.

- Tomcat, `DispatcherServlet`, `HandlerMapping`, `HandlerAdapter`와 Controller의 역할을 구분한다.
- `@SpringBootApplication`의 위치가 Component Scan 범위에 미치는 영향을 설명한다.
- `@RestController`, `@Service`, `@Repository`가 각 Class의 역할을 어떻게 표현하는지 설명한다.
- `@RequestMapping`, `@GetMapping`, `@PostMapping`으로 요청 경로와 HTTP Method를 연결한다.
- `@RequestBody`, `@PathVariable`, `@RequestParam`의 입력 위치를 구분한다.
- `@Valid`를 사용하는 입력 검증과 Domain 객체의 불변조건 검증을 구분한다.
- IoC, DI와 DIP가 생성자 주입 코드에서 각각 어디에 나타나는지 설명한다.
- `@Primary`와 `@Qualifier`가 필요한 상황을 구분한다.

개인 답변과 이해 상태는 날짜별 Study Note에 기록하고, 이 문서는 개념과 예시를 설명하는 학습 자료로 사용한다.

## 시작 전 자가진단

1. `@RequestMapping`만 붙인 Class가 자동으로 Controller가 되는가?
2. `@RequestBody`와 `@RequestParam`은 요청의 어느 부분을 읽는가?
3. `@RestController`와 `@Controller`의 차이는 무엇인가?
4. `@Valid`가 있으면 Domain 객체의 생성자 검증을 제거해도 되는가?
5. 생성자가 하나뿐인 Spring Bean에도 `@Autowired`가 반드시 필요한가?
6. 같은 Interface의 구현 Bean이 두 개라면 Spring은 어느 객체를 주입해야 하는지 어떻게 결정하는가?

## 한 문장 설명

Spring MVC Annotation은 요청 경로, 입력 값의 출처, 객체의 역할과 의존 관계를 Framework에 알려주며, Spring은 이 정보를 이용해 HTTP 요청을 적절한 객체와 메서드에 연결한다.

## 전체 요청 흐름

`POST /api/tickets` 요청을 예로 들면 다음과 같은 흐름으로 처리된다.

```text
Client
  ↓ HTTP Request
Tomcat
  ↓
DispatcherServlet
  ↓ 조회 요청
HandlerMapping
  ↓ 선택된 Handler 반환
HandlerAdapter
  ↓ Argument 준비 및 메서드 호출
TicketController
  ↓ Use Case 위임
TicketApplicationService
  ↓ 생성·행동 요청
Ticket Domain
  ↓ 검증된 객체 반환
TicketApplicationService
  ↓ 저장 계약 호출
TicketRepository
  ↓
InMemoryTicketRepository
  ↓ 저장 결과 반환
TicketApplicationService
  ↓ Use Case 결과 반환
TicketController
  ↓ ResponseEntity와 응답 객체 반환
HandlerAdapter
  ↓ HttpMessageConverter
HTTP Response
```

생성 Use Case에서 Service는 `Ticket`을 생성하여 Domain 검증을 통과한 객체를 Repository에 저장한다. 조회 Use Case에서는 Repository에서 찾은 `Ticket`을 Service가 반환 결과로 변환할 수 있다. 위 흐름은 생성 요청의 대표적인 방향을 한눈에 보기 위한 개념도다.

### Tomcat

Tomcat은 Client의 HTTP 연결과 요청을 받아 Servlet 환경에서 처리할 수 있도록 전달한다. Server가 정상적으로 HTTP Response를 반환했다면 Tomcat까지 요청이 도착한 것이다.

### `DispatcherServlet`

`DispatcherServlet`은 Spring MVC 요청 처리의 중심 Servlet이다. 직접 모든 판단과 변환을 수행하는 것이 아니라 등록된 MVC 구성요소에 작업을 요청하고 전체 흐름을 조정한다.

### `HandlerMapping`

`HandlerMapping`은 Request Target, HTTP Method와 Mapping 정보를 비교하여 실행할 Handler를 찾는다. Annotation 기반 Controller에서는 `@RequestMapping`, `@GetMapping`, `@PostMapping` 등의 정보가 이 판단에 사용된다.

### `HandlerAdapter`

`HandlerAdapter`는 선택된 Handler를 Spring MVC가 정해진 방식으로 호출할 수 있게 한다. Annotation 기반 Controller에서는 메서드 Argument를 준비하고 Controller 메서드를 호출하며 반환값 처리를 연결한다.

### `HttpMessageConverter`

`HttpMessageConverter`는 HTTP Content와 Java 객체 사이의 변환을 담당한다.

- Request의 JSON Content를 요청 DTO로 역직렬화한다.
- 응답 객체를 JSON Content로 직렬화한다.
- `Content-Type`, `Accept`와 사용 가능한 Converter 구성이 변환 방식 선택에 관여한다.

`HttpMessageConverter`가 Use Case를 실행하거나 Domain 규칙을 판단하는 것은 아니다.

## Annotation을 상황별로 구분하기

Annotation은 하나의 범용 기능이 아니다. 어떤 대상을 Spring이 관리할지, 어떤 요청을 어느 메서드에 연결할지, 요청의 어느 부분에서 값을 읽을지를 각각 선언한다.

| 상황 | 대표 Annotation | 알려주는 내용 |
|---|---|---|
| Application 시작과 자동 구성 | `@SpringBootApplication` | Boot Application 구성의 시작점 |
| HTTP API Controller 등록 | `@RestController` | 요청을 처리하고 반환값을 Response Body로 사용 |
| Application Service 등록 | `@Service` | Use Case 조정 역할을 수행하는 Component |
| Repository 구현 등록 | `@Repository` | 저장소 역할을 수행하는 Component |
| 공통 요청 경로 지정 | `@RequestMapping` | Class 또는 Method의 공통 Mapping 조건 |
| GET 요청 연결 | `@GetMapping` | HTTP GET 요청을 Method에 연결 |
| POST 요청 연결 | `@PostMapping` | HTTP POST 요청을 Method에 연결 |
| Request Body 수신 | `@RequestBody` | HTTP Request Content를 Java 객체로 변환 |
| URI Path 값 수신 | `@PathVariable` | URI Template의 값을 Method Argument에 연결 |
| Query Parameter 수신 | `@RequestParam` | Query String 값을 Method Argument에 연결 |
| 입력 객체 검증 요청 | `@Valid` | Bean Validation 규칙 실행 요청 |
| 고정된 응답 Status 선언 | `@ResponseStatus` | Method 또는 Exception에 적용할 응답 Status 지정 |
| 기본 구현체 우선 선택 | `@Primary` | 여러 Bean 중 기본 후보 지정 |
| 이름으로 구현체 선택 | `@Qualifier` | 주입할 Bean 후보를 명시적으로 한정 |

## Bean 등록 Annotation

### `@SpringBootApplication`

`@SpringBootApplication`은 Spring Boot Application의 시작 Class에 붙인다. 주요 구성 기능에는 자동 구성과 Component Scan이 포함된다.

```java
package lab.helpdesk;

@SpringBootApplication
public class HelpdeskApplication {

    public static void main(String[] args) {
        SpringApplication.run(HelpdeskApplication.class, args);
    }
}
```

기본 Component Scan은 이 Class가 위치한 Package를 기준으로 하위 Package를 탐색한다.

```text
lab.helpdesk                  ← HelpdeskApplication
└─ ticket
   ├─ web                     ← TicketController
   ├─ application             ← TicketApplicationService
   └─ repository              ← InMemoryTicketRepository
```

이 구조에서는 하위 Package의 Component를 자동 탐색할 수 있다. 반대로 `HelpdeskApplication`보다 상위이거나 무관한 Package의 Class는 별도 Scan 설정 없이 자동 탐색된다고 가정할 수 없다.

### `@RestController`

`@RestController`는 HTTP API를 제공하는 Controller에 사용한다. 의미상 `@Controller`와 `@ResponseBody`를 결합한 Annotation이다.

```java
@RestController
@RequestMapping("/api/tickets")
public class TicketController {
}
```

반환 객체는 View 이름이 아니라 기본적으로 Response Body의 Content로 처리된다. JSON 변환이 가능한 객체라면 `HttpMessageConverter`가 JSON으로 직렬화할 수 있다.

### `@Controller`와 `@RestController`

| 구분 | 일반적인 반환값 처리 | 대표 용도 |
|---|---|---|
| `@Controller` | View 이름과 Model 처리 | Server-side HTML 화면 |
| `@RestController` | Response Body Content 처리 | JSON·XML 등의 HTTP API |

`@Controller`에서도 특정 메서드나 Class에 `@ResponseBody`를 함께 사용하면 Response Body를 반환할 수 있다. 따라서 둘은 절대적으로 HTML과 JSON만 반환하는 별개의 기술이 아니라 기본 반환값 처리 방식이 다르다.

### `@Service`

`@Service`는 Application Service 역할을 표현한다.

```java
@Service
public class TicketApplicationService {

    private final TicketRepository repository;

    public TicketApplicationService(TicketRepository repository) {
        this.repository = repository;
    }
}
```

Service는 Controller와 Repository 사이를 단순히 전달만 하는 객체가 아니라, 하나의 Use Case가 어떤 순서로 수행되는지 조정한다. Ticket의 불변조건과 상태 규칙은 Domain 객체가 보호하고, Service는 생성·저장·조회와 같은 작업 흐름을 조정한다.

### `@Repository`

`@Repository`는 저장소 구현 역할을 표현한다.

```java
@Repository
public class InMemoryTicketRepository implements TicketRepository {
}
```

현재 `InMemoryTicketRepository`는 Java Collection을 사용하여 실행 중인 Application Memory에 Ticket을 임시 저장한다. Application을 종료하거나 재시작하면 데이터가 사라진다. 이후 RDB 기반 구현체로 교체하더라도 Application Service는 `TicketRepository` Interface에 계속 의존할 수 있다.

### `@Component`

`@Component`는 Spring이 탐색하고 관리할 일반적인 Component를 표시한다. `@RestController`, `@Service`, `@Repository`는 더 구체적인 역할을 표현하는 Component 계열 Annotation이다.

역할이 명확하다면 일반적인 `@Component`보다 해당 역할을 드러내는 Annotation을 선택하는 편이 이해하기 쉽다.

## 요청 Mapping Annotation

### `@RequestMapping`

`@RequestMapping`은 Request Path, HTTP Method, Header, Content Type과 같은 Mapping 조건을 선언할 수 있다. Class 수준에서는 공통 Path를 지정하는 용도로 자주 사용한다.

```java
@RestController
@RequestMapping("/api/tickets")
public class TicketController {
}
```

`@RequestMapping`은 Mapping 정보이지 그 자체로 Controller Bean을 등록하는 Annotation이 아니다. Controller Class에는 `@Controller` 또는 `@RestController`가 필요하다.

### `@GetMapping`

`@GetMapping`은 HTTP GET 요청을 Method에 연결하는 단축 Annotation이다.

```java
@GetMapping("/{id}")
public ResponseEntity<TicketResponse> findById(
        @PathVariable long id) {
    // 조회 Use Case 호출
}
```

Class 수준의 `/api/tickets`와 Method 수준의 `/{id}`가 결합되어 `GET /api/tickets/{id}`를 처리한다.

### `@PostMapping`

`@PostMapping`은 HTTP POST 요청을 Method에 연결하는 단축 Annotation이다.

```java
@PostMapping
public ResponseEntity<TicketResponse> create(
        @RequestBody CreateTicketRequest request) {
    // 생성 Use Case 호출
}
```

Class 수준의 `/api/tickets`와 결합되어 `POST /api/tickets`를 처리한다.

### Method 전용 Mapping을 사용하는 이유

다음 두 선언은 모두 POST Mapping을 표현할 수 있다.

```java
@RequestMapping(method = RequestMethod.POST)
```

```java
@PostMapping
```

`@PostMapping`은 의도가 더 짧고 직접적으로 드러난다. GET, POST, PUT, DELETE, PATCH에도 각각 대응하는 전용 Mapping Annotation이 있다.

## 요청 값 Binding Annotation

### `@RequestBody`

`@RequestBody`는 HTTP Request Content를 Java 객체로 변환하여 받는다.

```http
POST /api/tickets HTTP/1.1
Content-Type: application/json

{
  "title": "로그인 오류"
}
```

```java
public record CreateTicketRequest(String title) {
}

@PostMapping
public ResponseEntity<TicketResponse> create(
        @RequestBody CreateTicketRequest request) {
    // request.title() 사용
}
```

JSON 역직렬화는 Controller가 직접 문자열을 Parsing해서 수행하는 것이 아니라 적절한 `HttpMessageConverter`가 담당한다.

### `@PathVariable`

`@PathVariable`은 URI Path Template의 값을 받는다.

```http
GET /api/tickets/7
```

```java
@GetMapping("/{id}")
public ResponseEntity<TicketResponse> findById(
        @PathVariable long id) {
    // id는 7
}
```

`7`은 특정 Ticket Resource를 식별하는 Path의 일부다.

### `@RequestParam`

`@RequestParam`은 Query String 값을 받는다.

```http
GET /api/tickets?status=OPEN
```

```java
@GetMapping
public List<TicketResponse> findAll(
        @RequestParam TicketStatus status) {
    // status는 OPEN
}
```

Query Parameter는 Collection Resource에 조회 조건, 정렬, Paging과 같은 선택 조건을 전달할 때 자주 사용한다.

### `@PathVariable`과 `@RequestParam`

| 요청 | 의미 | Annotation |
|---|---|---|
| `/api/tickets/7` | ID가 7인 개별 Ticket | `@PathVariable` |
| `/api/tickets?status=OPEN` | OPEN 조건으로 Ticket Collection 조회 | `@RequestParam` |

Path와 Query의 의미는 API 계약에 따라 설계해야 한다. 단지 값을 받을 수 있다는 이유로 임의로 선택하지 않는다.

### `@RequestBody`와 `@RequestParam`

```text
Request Body:      {"title":"로그인 오류"}
Query Parameter:   ?status=OPEN
```

- Resource 생성에 필요한 구조화된 Content는 주로 `@RequestBody`로 받는다.
- 조회 조건과 같은 간단한 Query 값은 주로 `@RequestParam`으로 받는다.

## `@Valid`와 검증 책임

요청 DTO에 Bean Validation 제약조건을 선언하고 Method Argument에 `@Valid`를 붙이면 Spring MVC가 Controller Method 호출 과정에서 검증을 요청할 수 있다.

```java
public record CreateTicketRequest(
        @NotBlank String title) {
}

@PostMapping
public ResponseEntity<TicketResponse> create(
        @Valid @RequestBody CreateTicketRequest request) {
    // 생성 Use Case 호출
}
```

이 기능을 실제로 사용하려면 Jakarta Bean Validation API와 검증 구현체가 Application에 구성되어 있어야 한다.

### 검증을 두 경계로 나누기

| 검증 경계 | 예시 | 책임 |
|---|---|---|
| HTTP 입력 경계 | JSON 문법 오류, 필드 Type 불일치, DTO 제약조건 | Spring MVC, DTO와 Validation 구성 |
| Domain 경계 | Ticket 제목은 null 또는 blank일 수 없음 | `Ticket` 생성자와 Domain Method |

DTO에 `@NotBlank`가 있어도 `Ticket` 생성자 검증을 제거하면 안 된다. 다른 Service, Test, Batch 작업은 HTTP Controller를 거치지 않고 Ticket을 생성할 수 있기 때문이다.

반대로 Domain이 검증한다고 해서 HTTP 입력 검증이 무의미한 것도 아니다. HTTP 경계에서 요청 오류를 빠르게 발견하고 적절한 `400 Bad Request` 응답으로 변환하는 데 도움이 된다. 다만 Domain 규칙의 최종 보호 책임은 Domain 객체에 남는다.

## 응답 Status와 Body 구성

### `ResponseEntity`

`ResponseEntity`는 Annotation이 아니라 Response Status, Header와 Body를 함께 구성하는 Class다. 생성된 Resource의 URI처럼 요청 결과에 따라 값이 달라지는 응답을 표현하기 좋다.

```java
var location = URI.create("/api/tickets/" + response.id());

return ResponseEntity
        .created(location)
        .body(response);
```

위 코드는 `201 Created`, `Location` Header와 응답 객체를 함께 구성한다.

### `@ResponseStatus`

`@ResponseStatus`는 Controller Method나 Exception Class 등에 고정된 HTTP Status를 선언할 때 사용할 수 있다.

```java
@ResponseStatus(HttpStatus.NO_CONTENT)
@DeleteMapping("/{id}")
public void delete(@PathVariable long id) {
    service.delete(id);
}
```

응답마다 Status나 Header를 동적으로 구성해야 한다면 `ResponseEntity`가 더 직접적이다. 현재 Ticket 생성처럼 생성된 ID를 이용해 `Location` Header를 만들어야 하는 경우에는 `ResponseEntity.created(location)`이 적합하다.

## IoC, DI와 DIP

### IoC

IoC는 객체 생성, 연결과 생명주기의 제어권을 Application 코드가 직접 보유하지 않고 Spring Container가 관리하는 원리다.

```text
Spring Container
├─ InMemoryTicketRepository Bean 생성
├─ TicketApplicationService Bean 생성
└─ Service 생성자에 Repository Bean 전달
```

### DI

DI는 필요한 의존 객체를 외부에서 전달하는 방법이다. 다음 코드에서는 생성자가 DI 지점이다.

```java
@Service
public class TicketApplicationService {

    private final TicketRepository repository;

    public TicketApplicationService(TicketRepository repository) {
        this.repository = repository;
    }
}
```

Service 내부에서 `new InMemoryTicketRepository()`를 호출하지 않는다. Spring이 적합한 Bean을 찾아 생성자에 전달한다.

### DIP

DIP는 상위 수준 정책이 구체 저장 기술이 아니라 추상화에 의존하도록 설계하는 원칙이다.

```java
private final TicketRepository repository;
```

Service가 `InMemoryTicketRepository`가 아닌 `TicketRepository` Interface에 의존하는 부분이 핵심이다.

```text
TicketApplicationService
        ↓ 의존
TicketRepository
        ↑ 구현
InMemoryTicketRepository
```

DI를 사용했다고 자동으로 DIP를 만족하는 것은 아니다. 생성자로 구체 Class만 전달받는다면 DI는 사용했지만 여전히 구체 구현에 직접 의존할 수 있다.

## `@Autowired`는 언제 필요한가

Spring Bean Class에 생성자가 하나만 있다면 일반적으로 생성자에 `@Autowired`를 생략할 수 있다.

```java
@Service
public class TicketApplicationService {

    private final TicketRepository repository;

    public TicketApplicationService(TicketRepository repository) {
        this.repository = repository;
    }
}
```

생략은 의존성 주입을 사용하지 않는다는 뜻이 아니다. Spring이 단일 생성자를 주입 지점으로 선택하는 것이다.

Field Injection보다 생성자 주입을 사용하면 다음 특성이 명확해진다.

- 객체 생성에 필요한 의존성을 생성자 Signature에서 확인할 수 있다.
- 필드를 `final`로 유지할 수 있다.
- Spring 없이도 Test에서 직접 의존 객체를 전달할 수 있다.
- 필수 의존성이 없는 불완전한 객체 생성을 막기 쉽다.

## 구현 Bean이 여러 개일 때

다음과 같이 같은 Interface의 구현체가 두 개라면 Type만으로 하나를 선택할 수 없다.

```text
TicketRepository
├─ InMemoryTicketRepository
└─ JpaTicketRepository
```

### `@Primary`

`@Primary`는 같은 Type의 후보가 여러 개일 때 기본으로 선택할 Bean을 지정한다.

```java
@Primary
@Repository
public class JpaTicketRepository implements TicketRepository {
}
```

### `@Qualifier`

`@Qualifier`는 주입 지점에서 사용할 후보를 명시적으로 한정한다.

```java
public TicketApplicationService(
        @Qualifier("inMemoryTicketRepository")
        TicketRepository repository) {
    this.repository = repository;
}
```

현재 구현체가 `InMemoryTicketRepository` 하나뿐이라면 `@Primary`나 `@Qualifier`를 미리 추가할 필요는 없다. 실제로 후보가 둘 이상이 되어 선택 기준이 필요할 때 사용한다.

## Ticket Controller 개념 예시

다음 코드는 Annotation과 계층 연결을 이해하기 위한 개념 예시다. 실제 구현에서는 Application 계층의 반환 Type과 Web 응답 DTO 사이의 Mapping 정책을 프로젝트 구조에 맞게 결정해야 한다.

```java
@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    private final TicketApplicationService service;

    public TicketController(TicketApplicationService service) {
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<TicketResponse> create(
            @Valid @RequestBody CreateTicketRequest request) {
        var result = service.create(request.title());
        var response = TicketResponse.from(result);
        var location = URI.create("/api/tickets/" + response.id());

        return ResponseEntity.created(location).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<TicketResponse> findById(
            @PathVariable long id) {
        var result = service.findById(id);

        if (result.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        var response = TicketResponse.from(result.orElseThrow());
        return ResponseEntity.ok(response);
    }
}
```

### 이 예시에서 Annotation의 의미

1. `@RestController`: Class를 HTTP API Controller로 등록한다.
2. `@RequestMapping("/api/tickets")`: 공통 Resource Path를 지정한다.
3. `@PostMapping`: `POST /api/tickets`를 생성 Method에 연결한다.
4. `@RequestBody`: JSON Content를 요청 DTO로 변환한다.
5. `@Valid`: 요청 DTO의 Bean Validation 규칙 실행을 요청한다.
6. `@GetMapping("/{id}")`: `GET /api/tickets/{id}`를 조회 Method에 연결한다.
7. `@PathVariable`: Path의 Ticket ID를 Method Argument로 받는다.

`ResponseEntity`는 Annotation이 아니다. 앞에서 설명한 것처럼 Response Status, Header와 Body를 명시적으로 구성하는 Class다.

## 자주 발생하는 오해

### `@RequestMapping`만 붙이면 Controller다

아니다. `@RequestMapping`은 Mapping 조건을 제공한다. Controller 등록을 위해서는 `@Controller` 또는 `@RestController`와 같은 Component Annotation이 필요하다.

### `@RequestBody`가 JSON을 검증한다

`@RequestBody`의 핵심 역할은 Request Content를 Method Argument로 읽고 변환하도록 요청하는 것이다. JSON 문법·Type 변환 오류는 변환 과정에서 발견될 수 있지만, 제목이 유효해야 한다는 Domain 규칙 전체를 자동으로 보장하지 않는다.

### `@Valid`가 있으면 Domain 검증은 불필요하다

아니다. `@Valid`는 해당 HTTP 입력 경계의 검증을 요청한다. Domain 객체는 Controller를 거치지 않는 생성 경로에서도 스스로 불변조건을 지켜야 한다.

### `@Repository`가 붙으면 데이터가 영구 저장된다

아니다. `@Repository`는 객체의 역할과 Bean 탐색 정보를 표현한다. `InMemoryTicketRepository`에 붙여도 데이터는 Application Memory에만 존재하며 재시작하면 사라진다.

### `@Autowired`가 없으면 DI가 아니다

아니다. 단일 생성자는 `@Autowired` 없이도 Spring의 생성자 주입 지점으로 사용할 수 있다.

### Annotation이 Business Logic을 대신한다

아니다. Annotation은 Framework가 객체와 요청을 연결할 때 필요한 Metadata를 제공한다. Ticket 상태 전이와 같은 Business 규칙은 Domain 코드가 명시적으로 보호해야 한다.

## 상황별 선택 연습

| 필요한 작업 | 선택할 Annotation 또는 구성 |
|---|---|
| Class를 JSON API Controller로 등록 | `@RestController` |
| Ticket API의 공통 Path 지정 | `@RequestMapping("/api/tickets")` |
| 단건 조회 GET 연결 | `@GetMapping("/{id}")` |
| Ticket 생성 POST 연결 | `@PostMapping` |
| JSON 생성 요청 읽기 | `@RequestBody` |
| `/api/tickets/7`의 `7` 읽기 | `@PathVariable` |
| `?status=OPEN`의 `OPEN` 읽기 | `@RequestParam` |
| 요청 DTO의 제약조건 검사 요청 | `@Valid` |
| Method의 고정 응답 Status 선언 | `@ResponseStatus` |
| Use Case 조정 객체 등록 | `@Service` |
| In-memory 저장 구현 등록 | `@Repository` |
| 여러 구현체 중 기본 후보 지정 | `@Primary` |
| 여러 구현체 중 특정 후보 지정 | `@Qualifier` |

## 설명 가능성 점검 질문

1. Tomcat, `DispatcherServlet`, `HandlerMapping`과 `HandlerAdapter`는 각각 무엇을 담당하는가?
2. `@RestController`에 `@RequestMapping`이 함께 필요한 이유는 무엇인가?
3. `GET /api/tickets/7`과 `GET /api/tickets?status=OPEN`에는 각각 어떤 Binding Annotation이 필요한가?
4. `@RequestBody`가 붙은 Argument는 어떤 구성요소를 통해 JSON에서 Java 객체로 변환되는가?
5. 요청 DTO의 `@NotBlank`와 `Ticket` 생성자 검증이 함께 존재할 수 있는 이유는 무엇인가?
6. `TicketApplicationService(TicketRepository repository)`에서 IoC, DI와 DIP는 각각 어디에 나타나는가?
7. 구현체가 하나뿐일 때 `@Primary`와 `@Qualifier`를 사용하지 않아도 되는 이유는 무엇인가?
8. `InMemoryTicketRepository`에 `@Repository`를 붙여도 Application 재시작 후 데이터가 사라지는 이유는 무엇인가?
9. 생성자가 하나뿐일 때 `@Autowired`를 생략해도 DI가 수행되는 이유는 무엇인가?
10. `ResponseEntity`와 `@ResponseStatus` 중 하나가 Annotation이 아닌 것은 무엇이며, 어떤 정보를 구성하는가?

## 학습 점검 목록

- [ ] HTTP 요청이 Controller에 도달하는 과정을 순서대로 설명할 수 있다.
- [ ] Bean 등록 Annotation과 Request Mapping Annotation을 구분할 수 있다.
- [ ] `@RequestBody`, `@PathVariable`, `@RequestParam`의 입력 위치를 구분할 수 있다.
- [ ] DTO 입력 검증과 Domain 불변조건 검증의 책임을 구분할 수 있다.
- [ ] IoC, DI와 DIP를 생성자 주입 코드에서 각각 찾을 수 있다.
- [ ] 구현 Bean이 하나일 때와 여러 개일 때의 주입 후보 선택 차이를 설명할 수 있다.
- [ ] Annotation이 Business Logic을 대신하지 않는 이유를 설명할 수 있다.

## 자료 범위

이 자료는 Spring MVC의 Annotation 기반 요청 처리와 기본적인 Spring Bean 연결을 학습 범위로 삼는다. 다음 내용은 별도 학습 대상으로 남긴다.

- 전역 예외 처리와 `@RestControllerAdvice`
- `ProblemDetail` 기반 오류 응답
- Filter, Interceptor와 Spring Security Filter Chain
- JPA Entity Mapping과 Transaction
- Custom Argument Resolver와 Custom `HttpMessageConverter`
- Reactive Stack인 Spring WebFlux의 요청 처리 흐름

## 참고 자료

- [Spring Framework — Annotated Controllers](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann.html)
- [Spring Framework — Request Mapping](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-requestmapping.html)
- [Spring Framework — Method Arguments](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods/arguments.html)
- [Spring Framework — Classpath Scanning and Managed Components](https://docs.spring.io/spring-framework/reference/core/beans/classpath-scanning.html)
- [Spring Framework — Using `@Autowired`](https://docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired.html)
- [Spring Boot — Structuring Your Code](https://docs.spring.io/spring-boot/reference/using/structuring-your-code.html)
