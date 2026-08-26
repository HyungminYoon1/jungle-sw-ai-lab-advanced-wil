# Spring MVC 정상 수직 Slice 구현·검증 기록

> 작성일: 2026-08-26
> 목적: Spring MVC 요청 흐름과 Layer 책임을 설명하고, In-memory Repository부터 Controller까지 Ticket 생성·단건 조회의 정상 경로를 단계적으로 구현·검증한다.
> 상태: Partially Completed — Repository·Application Service·Controller 구현, 정상 `POST`·`GET` MockMvc Test 2개와 전체 Test 24개 통과. 실제 Ticket API `curl`은 8월 27일로 이동

---

## 오전 — 요청 흐름과 Annotation 정리

### 요청 흐름 정리

Client가 HTTP Request를 보내면 Tomcat이 요청을 수신하고 `DispatcherServlet`에 전달한다. `DispatcherServlet`은 `HandlerMapping`을 통해 요청에 맞는 Controller 메서드를 찾고, `HandlerAdapter`를 통해 해당 메서드를 호출한다. Controller는 Use Case를 `TicketApplicationService`에 위임하며, Service는 Ticket Domain과 `TicketRepository`를 사용해 작업을 처리한다. 처리 결과가 Controller로 반환되면 Controller는 응답 객체나 `ResponseEntity`를 반환한다. 이후 `HttpMessageConverter`가 응답 객체를 JSON으로 변환하고, HTTP Response가 Client에게 전달된다.

```text
Client
  → Tomcat
  → DispatcherServlet
  → HandlerMapping
  → HandlerAdapter
  → TicketController
  → TicketApplicationService
  → Ticket Domain·TicketRepository
  → TicketController
  → HttpMessageConverter
  → HTTP Response
```

### 구성요소 책임 확인

- `HandlerMapping`: 요청 Path·HTTP Method와 Mapping 정보를 비교하여 실행할 Handler를 찾는다.
- `HandlerAdapter`: 선택된 Handler의 인수를 준비하고 Controller 메서드를 호출하며 반환값 처리를 연결한다.
- `@RestController`: Class를 HTTP API Controller로 등록하고 반환 객체를 Response Body로 처리한다.
- `@RequestMapping`: Class나 Method의 공통 Path와 Mapping 조건을 선언한다.
- `@PostMapping`: Ticket 생성 `POST` 요청을 메서드에 연결한다.
- `@GetMapping`: Ticket 조회 `GET` 요청을 메서드에 연결한다.
- `@RequestBody`: JSON Request Content를 요청 DTO로 변환하여 받는다.
- `@PathVariable`: URI Path의 Ticket ID를 메서드 인수로 받는다.
- `ResponseEntity`: 응답 Status·Header·Body를 함께 구성한다.
- `HttpMessageConverter`: Java 응답 객체를 JSON Response Body로 직렬화한다.

### IoC·DI·DIP 구분

- IoC: Spring Container가 Repository·Service·Controller 객체의 생성과 연결을 관리한다.
- DI: Spring이 생성한 `TicketRepository` 구현 객체를 `TicketApplicationService` 생성자에 전달한다.
- DIP: `TicketApplicationService`가 구체 Class인 `InMemoryTicketRepository`가 아니라 `TicketRepository` Interface에 의존한다.
- 구현 Bean이 하나면 Type으로 주입할 수 있다. 같은 Interface의 후보가 여러 개이고 선택 기준이 없다면 Context 시작에 실패하며, 필요한 경우 `@Primary`나 `@Qualifier`로 선택 기준을 표현한다.

## 오후·야간 — 정상 수직 Slice 구현

### 1. Repository Port와 In-memory 구현

`TicketRepository`에는 현재 Use Case에 필요한 계약만 두었다.

```java
long save(Ticket ticket);

Optional<Ticket> findById(long id);
```

- `Map<Long, Ticket>`을 사용해 ID로 Ticket을 저장하고 조회한다.
- 상태 변경 이력처럼 순서가 중요한 Collection에는 `List`가 적합하지만, 이번 저장소는 ID를 Key로 단건 조회하므로 `Map`을 선택했다.
- `nextId`는 Repository Instance Field이며 `1L`부터 시작한다. 저장할 때 현재 ID를 사용한 뒤 증가시킨다.
- 조회 결과가 없을 수 있음을 `null` 대신 `Optional<Ticket>`으로 표현한다.
- `@Repository`는 Spring Bean과 저장소 역할을 표시하지만 영속성을 제공하지 않는다. Application이 재시작되면 Memory의 Ticket은 사라진다.

Repository Test 3개로 다음을 확인했다.

- 저장한 Ticket을 반환된 ID로 조회할 수 있다.
- 존재하지 않는 ID는 `Optional.empty()`를 반환한다.
- Ticket을 연속 저장하면 `1L`, `2L` 순서로 ID가 발급된다.

### 2. Application Service와 결과 DTO

`TicketApplicationService`는 생성·조회 Use Case를 조정한다.

- `create(title)`: Ticket을 생성하고 Repository에 저장한 뒤 ID·제목·상태를 `TicketResult`로 반환한다.
- `findById(id)`: Repository의 `Optional<Ticket>`을 `Optional<TicketResult>`로 변환한다.
- Service는 HTTP Status나 JSON 구조를 알지 않는다.
- Ticket 제목 불변조건은 기존 Domain 생성자가 계속 보호한다.

`repository.save(ticket)`의 반환값은 저장 계약의 성공 결과인 ID다. Production Code에서 저장 직후 같은 객체를 다시 조회해 비교하는 절차는 추가하지 않았다. 대신 Service Test에서 반환된 ID로 Repository를 조회하여 Ticket이 실제로 저장됐는지 별도로 검증했다.

Service Test 3개로 다음을 확인했다.

- 생성 결과의 ID·제목·상태가 올바르고 Repository에도 Ticket이 저장된다.
- 저장된 Ticket을 Service에서 단건 조회할 수 있다.
- 존재하지 않는 ID는 `Optional.empty()`를 반환한다.

### 3. Web DTO와 Controller

- `CreateTicketRequest`: `{"title":"로그인 오류"}` Request Body를 받는 Web DTO다.
- `TicketResponse`: `TicketResult`를 HTTP 응답 표현으로 변환한다.
- `TicketController`: `TicketApplicationService`에 생성·조회 Use Case를 위임한다.

정상 생성 응답은 다음 계약으로 구현했다.

- Method·Path: `POST /api/tickets`
- Status: `201 Created`
- Header: `Location: /api/tickets/{id}`
- Body: 생성된 Ticket의 `id`, `title`, `status`

정상 단건 조회 응답은 다음 계약으로 구현했다.

- Method·Path: `GET /api/tickets/{id}`
- Status: `200 OK`
- Body: 조회한 Ticket의 `id`, `title`, `status`

존재하지 않는 ID의 `404` Status 분기는 구현되어 있지만 오류 Body와 MockMvc Test는 아직 추가하지 않았다. 공백 제목, 잘못된 JSON·ID 형식과 대표 내부 실패의 일관된 오류 변환도 아직 구현하지 않았다.

## MockMvc 검증

`MockMvcBuilders.standaloneSetup(controller)`로 Repository·Service·Controller를 직접 조립했다. 이 Test는 실행 중인 Tomcat이나 실제 Network 연결 없이 Spring MVC의 Mock Request·Response 처리를 검증한다.

### 정상 생성 Test

- JSON Body로 `POST /api/tickets` 요청
- `201 Created` 확인
- `Location: /api/tickets/1` 확인
- JSON Body의 `id`, `title`, `status` 확인

### 정상 단건 조회 Test

- Service로 Given Ticket을 미리 저장
- 반환된 ID로 `GET /api/tickets/{id}` 요청
- `200 OK` 확인
- JSON Body의 `id`, `title`, `status` 확인

조회 Test의 Given을 POST 요청으로 만들지 않고 Service로 준비한 이유는 GET Test가 POST Mapping의 성공 여부에 의존하지 않게 하기 위해서다.

## 오류와 교정

GET Test를 처음 실행했을 때 다음 `NullPointerException`이 발생했다.

```text
Cannot invoke "TicketApplicationService.create(String)"
because "this.service" is null
```

`setUp()`에서 `TicketApplicationService service`라는 지역변수를 새로 선언하여 같은 이름의 Test Field를 가린 것이 원인이었다. Controller는 지역변수의 Service를 전달받아 POST Test가 통과했지만, GET Test가 참조한 `this.service` Field에는 값이 대입되지 않았다.

지역변수 선언을 제거하고 `this.service = new TicketApplicationService(repository)`로 Field에 대입한 뒤 두 Controller Test가 모두 통과했다.

## 실행 근거

2026-08-27 00:02 KST에 Lab 저장소에서 다음 명령을 다시 실행했다.

```powershell
.\mvnw.cmd clean test
```

결과는 다음과 같다.

- Production Source: 17개 Compile
- Test Source: 6개 Compile
- Ticket Domain Test: 10개
- 응답 시간 Policy Test: 6개
- Repository Test: 3개
- Application Service Test: 3개
- Controller MockMvc Test: 2개
- 전체: `Tests run: 24, Failures: 0, Errors: 0, Skipped: 0`
- Build: `BUILD SUCCESS`

Lab Source는 다음 의도 단위 Commit으로 구분했다.

- `c3a6a59 feat: add in-memory Ticket repository`
- `7f7f97c feat: add Ticket application service`
- `6e22bf4 test: add Spring MVC test support`
- `ff2964b feat: add Ticket HTTP create and lookup endpoints`

## 검증 경계

- Repository·Application Service·Controller 정상 경로: `IMPLEMENTED`
- 정상 `POST`·`GET` MockMvc Test: `RUN`
- 기존 Test를 포함한 전체 24개 Clean Test: `RUN`
- Spring Application Context의 Component Scan·실제 Bean 조립: 이번 MockMvc Test에서는 `NOT_RUN`
- 실제 Server에 대한 Ticket API `POST`·`GET` `curl.exe` Trace: `NOT_RUN`
- `400`·검증된 `404` 오류 Body·대표 `500` 계약: `NOT_IMPLEMENTED` 또는 `NOT_RUN`

Root `GET /` Smoke Trace는 8월 25일에 Application Context와 Tomcat 기동을 검증했다. 그러나 이번에 추가한 Ticket Controller가 실제 Spring Context에서 탐색되고 `/api/tickets`가 Network 요청에 응답하는지는 별도의 실행 근거가 필요하다.

## AI 활용과 직접 확인 범위

- AI가 보조한 부분: Repository·Service·Controller의 구현 순서, MockMvc 기본 구조, 실패 원인 분석과 문서 구조 정리
- 직접 설계·작성한 부분: Repository 계약과 In-memory 구현, Application Service·DTO·Controller, 각 계층 Test와 Given–When–Then
- 직접 실행한 부분: 계층별 Test, Controller Test와 전체 24개 Clean Test
- 다음에 직접 확인할 부분: 실제 Ticket API `curl` Trace, Validation·Exception Handler와 `400`·`404`·대표 `500` 오류 계약

## 다음 학습

1. 실제 Application을 기동하고 `POST /api/tickets`, `GET /api/tickets/{id}`를 `curl.exe`로 호출한다.
2. MockMvc와 실제 HTTP Trace가 검증하는 범위를 비교한다.
3. 입력 Validation과 Exception Handler를 학습하고 `400`·`404`·대표 `500` 오류 계약을 구현·검증한다.
