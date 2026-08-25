# HTTP 학습 노트

> 작성일: 2026-08-24
> 목적: HTTP Message의 의미를 설명하고 Spring MVC Request Flow와 Layer 책임으로 연결한다.
> 상태: Completed — HTTP·Spring MVC 개념 설명과 기존 Clean Test 완료, Spring Context·Server·`curl.exe` 실행은 8월 25일로 이동

---

## 기본 개념 점검 질문

1. HTTP Request와 Response는 무엇인가?
-> HTTP Request는 Client가 Server에 원하는 처리나 Resource를 요청하는 메시지이고, HTTP Response는 Server가 처리 결과를 Client에 돌려주는 메시지이다. HTTP는 두 메시지의 구조와 의미를 정하는 Protocol이다.

2. Request Line의 Method·Target·Version은 각각 무엇인가?
-> Method는 Client가 요청하는 행동의 의미를 나타낸다. Target은 요청 대상 Resource를 식별하며, Version은 해당 HTTP/1.1 메시지에 적용되는 Protocol Version을 나타낸다.

3. Response Status는 무엇을 알려주는가?
-> Server가 Request를 처리한 결과를 표준화된 세 자리 Status Code로 알려준다. `2xx`는 성공, `4xx`는 Request나 Client 측 조건과 관련된 실패, `5xx`는 Server가 요청 수행에 실패한 경우를 나타낸다. Program은 Reason Phrase보다 Status Code를 기준으로 결과를 판단해야 한다.

4. Header와 Body는 어떤 역할을 하는가?
-> Header는 Message와 Content를 해석하거나 처리하는 데 필요한 부가 정보와 제어 정보를 전달한다. Body는 생성할 Ticket 정보나 조회된 Ticket처럼 실제로 전달하려는 Content를 담는다. HTTP/1.1 원문에서는 Header Section 뒤의 빈 줄이 Header와 Body의 경계를 표시한다.

5. Content-Type과 Accept는 어떻게 다른가?
-> `Content-Type`은 현재 Message Body가 어떤 Media Type인지 설명한다. Request의 `Content-Type`은 Client가 보내는 Body의 형식이고, Response의 `Content-Type`은 Server가 보내는 Body의 형식이다. `Accept`는 Client가 Response로 받을 수 있거나 선호하는 Media Type을 Server에 알리는 Request Header이다.

6. HTTP의 Stateless는 무엇을 의미하는가?
-> 각 Request의 의미를 다른 Request와의 자동 연결이나 보존에 의존하지 않고 독립적으로 이해할 수 있다는 뜻이다. Server가 Ticket이나 Session을 Memory·Database·Redis에 저장할 수 없다는 뜻은 아니다. 이전 상태가 필요하면 Client가 Resource ID나 Session Cookie처럼 현재 Request를 해석하는 데 필요한 정보를 다시 전달해야 한다.

7. HTTP/1.1·HTTP/2·HTTP/3와 TLS 1.2·1.3은 어떻게 다른가?
-> HTTP/1.1·HTTP/2·HTTP/3은 Request와 Response의 의미, 표현 방식과 전송 구조를 정의하는 HTTP Version이다. TLS 1.2·1.3은 통신 내용을 암호화하고 상대를 인증하며 전송 중 변조를 탐지하기 위한 보안 Protocol Version이다. HTTP와 TLS는 같은 종류의 Version이 아니며, HTTP/3은 QUIC 위에서 TLS 1.3의 보안 기능을 사용한다.

8. 현재 가장 확실하지 않은 부분은 무엇인가?
-> 학습 시작 시에는 Spring MVC가 Request를 `DispatcherServlet`·Controller 입력으로 변환하고 Response를 만드는 과정이 확실하지 않았다. 단계별 질문 후에는 Client부터 Repository까지의 개념 흐름과 각 구성요소의 책임을 설명할 수 있다. 다만 실제 Spring Boot Code, Application Context, Server와 `curl.exe` Trace는 아직 실행하지 않았으므로 Framework 동작을 검증한 상태는 아니다. HTTP/2·HTTP/3의 실제 Wire 표현도 이번 학습에서는 개념 수준으로만 확인했다.

## HTTP 메시지 구조 표시

```
POST /api/tickets HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Accept: application/json

{"title":"로그인 오류"}
```

- Method: `POST`
- Request Target: `/api/tickets`
- HTTP Version: `HTTP/1.1`
- Header: `Host`, `Content-Type`, `Accept`
- Header와 Body 사이의 빈 줄: `Accept` Header 다음의 빈 줄
- Body: `{"title":"로그인 오류"}`

### 예상 Response

```http
HTTP/1.1 201 Created
Location: /api/tickets/1
Content-Type: application/json

{"id":1,"title":"로그인 오류","status":"OPEN"}
```

*201, Location, Response Content-Type을 선택한 이유:

- `201 Created`: Request 처리 결과 새로운 Ticket Resource가 생성되었음을 나타낸다.
- `Location: /api/tickets/1`: 생성된 Ticket Resource를 조회할 수 있는 URI Reference를 알려준다.
- `Content-Type: application/json`: Response Body가 JSON 형식임을 알려준다.

이 Response는 구현 전에 작성한 예상 계약이다. 실제 Server 기동과 `curl.exe` Request·Response Trace는 아직 수행하지 않았으므로 `NOT_RUN`이다.

## Spring Boot·Spring MVC 연결 점검

1. 현재 Lab이 `/api/tickets` 요청을 받을 수 없는 이유는 무엇인가?
-> 현재 Project에는 HTTP 요청 처리를 위한 Spring Web Dependency와 Spring Boot를 시작할 Application 실행 진입점이 없다. Dependency는 Server를 실행할 기능을 준비하고, `SpringApplication.run(...)`은 Application Context와 내장 Web Server 시작을 요청한다. Server가 기동되어도 해당 경로를 처리할 Controller가 없으면 일반적으로 `404 Not Found`가 반환된다.

2. HTTP Request는 어떤 순서로 처리되는가?
-> `Client → Tomcat → DispatcherServlet → TicketController → TicketApplicationService → TicketRepository 구현체` 순서로 전달된다. Tomcat이 Network Request를 먼저 받고, `DispatcherServlet`이 Spring MVC Handler를 찾아 Controller에 연결한다. 처리 결과는 반대 방향으로 돌아간다.

3. Component Scan은 Controller를 어떻게 발견하는가?
-> `@SpringBootApplication`이 있는 Package부터 하위 Package를 기본 탐색 범위로 사용한다. Application Class와 Controller는 Class 상속 관계가 아니라 Package 포함 관계다. 일반적인 Controller 등록에는 `@Controller` 또는 `@RestController`가 필요하다. `@Bean`을 사용하면 객체를 수동으로 Bean 등록할 수 있지만, `@Component`만으로 MVC Controller가 되는 것은 아니다.

4. Path Variable과 Query Parameter는 어떻게 받는가?
-> `@GetMapping("/{id}")`은 요청 경로 Pattern을 선언하고 `@PathVariable`은 `{id}`를 Method 인수에 연결한다. `/api/tickets?status=OPEN`의 `status`는 Mapping 경로에 Query String을 쓰는 대신 `@RequestParam`으로 받는다.

5. `400`, `404`, `500`은 어떻게 구분하는가?
-> 필수 Parameter 누락이나 값 변환 실패는 `400 Bad Request`, Mapping이나 대상 Resource를 찾지 못한 경우는 `404 Not Found`, Controller 실행 중 처리되지 않은 내부 예외는 `500 Internal Server Error`로 구분한다. Server가 실행되지 않았다면 HTTP Status가 아니라 연결 거부나 Timeout이 발생한다.

6. Controller가 Repository 구현체를 직접 호출하지 않는 이유는 무엇인가?
-> Controller는 HTTP 입력과 응답을 다루고 Application Service에 Use Case를 위임한다. Application Service는 Domain과 Repository를 조정하고, Repository는 저장과 조회를 담당한다. `Ticket`은 자신의 상태와 상태 변경 규칙을 보호한다.

7. DIP와 DI는 현재 구조에서 어떻게 다른가?
-> `TicketApplicationService`가 `TicketRepository` Interface를 인수와 Field Type으로 사용하는 의존 방향은 DIP다. 외부에서 `InMemoryTicketRepository` 객체를 생성해 Service 생성자에 전달하는 행위는 DI이며, 생성자는 주입 지점이다. 구체 구현 Type을 생성자 인수로 사용하면서 외부에서 객체를 전달하면 DI는 적용되지만 DIP는 적용되지 않는다.

8. 같은 Interface의 Bean이 여러 개라면 Spring은 어떻게 선택하는가?
-> 호환되는 Bean이 하나면 그 객체를 주입한다. 여러 후보가 있고 선택 기준이 없으면 임의로 고르지 않고 Application Context 시작에 실패한다. 기본 구현은 `@Primary`, 특정 구현 선택은 `@Qualifier`로 표현할 수 있다.

9. `ResponseEntity`와 `HttpMessageConverter`는 각각 무엇을 담당하는가?
-> `ResponseEntity.created(location)`은 `201 Created`와 `Location` Header를 설정하고, `.body(response)`는 Body로 사용할 Java 객체를 지정한다. `URI.create(...)`는 URI 객체를 만들 뿐 Status나 Header를 설정하지 않는다. 실제 Java 객체를 JSON으로 변환하는 주체는 `HttpMessageConverter`다.

## 2026-08-24 실행 근거와 검증 경계

- Week 1 WIL을 블로그에 게시하고 정글 LMS에 링크를 제출했다.
- 새 Terminal에서 Temurin JDK 25.0.4, `javac` 25.0.4와 Maven Wrapper 3.9.16을 확인했다.
- `.\mvnw.cmd clean test` 결과 기존 Test 16개가 실패·오류·건너뜀 없이 통과했고 `BUILD SUCCESS`를 확인했다.
- Spring Boot `4.1.1`을 이번 주 Baseline으로 선택했지만, Spring Dependency와 Application 실행 진입점은 아직 추가하지 않았다.
- Application Context·내장 Server·Controller·MockMvc는 `NOT_IMPLEMENTED`, 실제 `curl.exe` Trace는 `NOT_RUN`이다.
- Java Source를 변경하지 않았으며 최소 Context와 Server 기동은 8월 25일 야간 Block으로 이동한다.

## AI 활용과 직접 확인 범위

- AI가 보조한 부분: HTTP·Spring MVC 학습 순서, Ticket 예시, 오해를 확인하는 단계별 질문과 문서 정리
- 직접 설명한 부분: HTTP Message 구조, Stateless, Request 처리 순서, Status 구분, Layer 책임, DIP·DI와 Response 변환
- 직접 실행한 부분: JDK·Maven Version 확인과 기존 Test 16개 Clean Test
- 아직 직접 실행하지 않은 부분: Spring Boot Context·Server, Controller·MockMvc와 `curl.exe` Trace

## 다음 학습

- Resource·URI·Representation을 Ticket 사례로 구분한다.
- `POST` 생성과 `GET` 조회의 정상·실패 계약을 Given–When–Then으로 작성한다.
- 계약을 확정한 뒤 Spring Boot 최소 Context와 Server를 기동한다.
