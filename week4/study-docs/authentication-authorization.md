# Learning Note — Authentication·Authorization과 401·403

> 작성일: 2026-09-07
> 기준: RFC 9110, Spring Security Servlet Reference

## 핵심 질문

> Spring Security는 사용자가 누구인지 확인하는 단계와 그 사용자의 요청을 허용하는 단계를 어떻게 분리하며, 실패를 `401`과 `403`으로 어떻게 구분하는가?

## 학습 목표

- Authentication과 Authorization의 입력·결과를 구분한다.
- Session에서 복원한 인증 정보가 권한 검사와 Application 호출로 이어지는 흐름을 설명한다.
- `401`, `403`, Form Login Redirect와 CSRF `403`을 같은 실패로 취급하지 않는다.

## 한 문장 설명

Authentication은 요청을 보낸 주체를 확인해 인증 정보를 만들고, Authorization은 그 인증 정보와 요청 규칙을 비교해 해당 행동을 허용할지 결정한다.

## 핵심 개념

### Authentication — 누구인가

Form Login에서는 입력된 사용자 이름과 Password로 신원을 확인한다. 성공하면 Spring Security는 Principal과 Authority를 가진 `Authentication`을 `SecurityContext`에 둔다. 실패하면 인증된 상태를 만들지 않는다.

Password는 로그인 시 검증할 장기 Credential이다. 후속 요청마다 Password를 다시 보내는 대신, 인증 성공 뒤에는 Session과 같은 짧은 수명의 Credential로 인증 상태를 이어 간다.

### Authorization — 무엇을 할 수 있는가

Authorization은 이미 확인되었거나 Session에서 복원된 `Authentication`과 현재 HTTP 요청을 권한 규칙에 대입한다. 허용되면 Filter Chain이 계속되어 Spring MVC와 Controller에 도달하고, 거부되면 Application에 들어가기 전에 보안 실패로 끝날 수 있다.

`USER`와 `AGENT`는 사용자의 신원이 아니라 Authority를 묶어 표현한 Role이다. 같은 사용자라도 요청 Method·Path와 가진 Role에 따라 결과가 달라진다.

### `401`과 `403`

| 상황 | 의미 | 이 Lab의 예상 응답 |
|---|---|---:|
| 유효한 인증 정보가 없는 보호 API 요청 | 먼저 신원을 확인해야 함 | `401 Unauthorized` |
| 인증됐지만 필요한 Role이 없음 | 누구인지는 알지만 해당 행동을 허용하지 않음 | `403 Forbidden` |
| 인증된 안전하지 않은 요청에 CSRF Token이 없음 | Role과 별개인 요청 위조 방어 실패 | `403 Forbidden` |
| 기본 Form Login이 인증을 요구함 | Browser를 Login Page로 보내는 Entry Point 사용 가능 | `302 Redirect` 가능 |

HTTP 이름 때문에 `401`을 “인가 실패”라고 해석하기 쉽지만, RFC 9110에서 `401`은 대상 Resource에 필요한 유효한 인증 Credential이 없다는 뜻이다. 유효한 Credential이 있으나 충분하지 않다면 일반적으로 `403`으로 구분한다.

Spring Security의 `ExceptionTranslationFilter`는 인증·인가 예외를 HTTP 응답으로 바꾼다. 인증이 필요하면 `AuthenticationEntryPoint`, 인증된 사용자의 접근이 거부되면 `AccessDeniedHandler`를 사용한다. 따라서 Form Login의 Redirect와 API의 `401` 계약은 별도로 정해야 한다.

## 핵심 요청 흐름

```text
HTTP Request
→ SecurityContext를 Session 등에서 불러옴
→ 필요한 경우 CSRF Token 검사
→ Login Request라면 Authentication Filter가 Credential 검증
→ Authorization Filter가 Method·Path·Authority 검사
→ 허용되면 DispatcherServlet → Controller → Application
→ 거부되면 Entry Point 또는 AccessDeniedHandler가 응답
```

실제 Filter 구성과 세부 순서는 설정에 따라 달라진다. 여기서 중요한 순서는 “인증 정보 준비 → 요청 권한 판단 → 허용된 요청만 Application 진입”이며, 안전하지 않은 Method는 권한 판단과 별개로 CSRF 검사에도 통과해야 한다는 점이다.

이 절은 전체 흐름의 요약이다. 최초 Password Login과 후속 Session Request의 구성요소별 과정은 [Form Login과 Session 인증 과정](./session-authentication-flow.md)에서 이어서 설명한다.

## AI Helpdesk 최소 권한 계약

| 요청 | 익명 | `USER` | `AGENT` |
|---|---:|---:|---:|
| Login | 허용 | 허용 | 허용 |
| `POST /api/tickets` | `401` | 허용 | 허용 |
| `GET /api/tickets/{id}` | `401` | `403` | 허용 |

이 표는 인증과 Role 검사를 관찰하기 위한 학습용 계약이다. Resource 소유권이나 실제 Helpdesk 조직 권한을 설계한 결과가 아니다.

## 실패 원인을 분리하는 최소 Test 조건

| 확인하려는 것 | 먼저 제거할 혼입 변수 | 예상 |
|---|---|---|
| 익명 사용자의 인증 실패 | `GET`처럼 CSRF 검사가 필요 없는 요청 사용 | `401`, Controller 미진입 |
| 익명 사용자의 `POST` 인증 실패 | 유효한 CSRF Token을 포함해 CSRF 실패를 제거 | `401`, 저장 없음 |
| `USER`의 조회 권한 실패 | 먼저 로그인된 Session을 준비 | `403`, 조회 Use Case 미진입 |
| `AGENT`의 조회 권한 성공 | 존재하는 Ticket을 준비 | 기존 `200` 계약 유지 |
| 보안 통과 뒤 Application 진입 | 권한 있는 사용자가 없는 ID 조회 | 보안 응답이 아니라 기존 `404` |

익명 `POST`에서 CSRF Token까지 빼면 `CsrfFilter`가 먼저 `403`을 만들 수 있다. 그 결과만 보고 인증 실패가 `403`이라고 결론 내리면 두 방어 경계를 섞은 것이다.

## MockMvc Test 경계 — 같은 URI의 `200`과 `401`이 모순이 아닌 이유

`MockMvc`라는 이름만으로 Test 범위가 정해지지 않는다. 어떤 Builder와 Spring Context로 `MockMvc`를 구성했는지에 따라 Request가 통과하는 구성요소가 달라진다.

### `standaloneSetup` — Controller 중심 Test

```text
Mock Request
→ 최소 Spring MVC 처리
→ 직접 등록한 Controller
→ 직접 등록한 Controller Advice
```

`MockMvcBuilders.standaloneSetup(controller)`는 Test가 전달한 Controller를 중심으로 최소 MVC 환경을 구성한다. Application의 전체 Spring Context를 시작하지 않으므로 실제 Application에 등록된 `SecurityFilterChain`이나 `FilterChainProxy`를 자동으로 찾아 적용하지 않는다.

현재 `TicketControllerTest`는 다음 구성요소를 Test Code에서 직접 조립한다.

- `InMemoryTicketRepository`
- `TicketApplicationService`
- `TicketController`
- `TicketApiExceptionHandler`

Security Filter를 직접 추가하지 않았으므로 이 Test의 Request는 인증·인가·CSRF 검사를 거치지 않는다. 따라서 기존 Ticket 조회가 `200`, 생성이 `201`, 없는 Ticket 조회가 `404`인지와 같은 Controller Web 계약을 빠르게 확인할 수 있다.

`standaloneSetup`이 어떤 Filter도 사용할 수 없다는 뜻은 아니다. Test가 `.addFilters(...)` 또는 별도 Configurer로 Filter를 명시적으로 붙일 수 있다. 핵심은 실제 Application의 Security 구성이 자동으로 포함되지 않으며, 수동으로 일부 Filter를 붙인 결과도 Production `SecurityFilterChain` 전체가 올바르게 구성됐다는 근거가 되지는 않는다는 점이다.

### Spring Context 기반 MockMvc — Application 구성 Integration Test

```text
Mock Request
→ Application에 등록된 Servlet Filter
→ Spring Security FilterChainProxy
→ DispatcherServlet
→ Controller
→ Application
```

`@SpringBootTest`와 `@AutoConfigureMockMvc`를 사용하는 Test는 Application Context를 시작하고 그 Context의 Web 구성을 이용한다. Filter 자동 추가를 끄지 않았다면 Spring Security Dependency와 `SecurityFilterChain` Bean을 추가한 뒤 Security Filter도 Request 처리에 참여한다.

각 Annotation이 준비하는 Context·MockMvc·인증 Test Double의 범위는 [Spring Test Annotation과 Test Boundary](./spring-test-annotations-and-boundaries.md)에서 구분한다.

현재 `WebInfrastructureIntegrationTest`가 이 범주다. Security 도입 전에는 익명으로 없는 Ticket을 조회해 Controller까지 진입한 `404`와 Handler Timing Log를 확인한다. Security 도입 뒤 같은 익명 Request는 Controller 전에 `401`로 끝나는 것이 새로운 계약이므로, 기존 Infrastructure 목적을 계속 확인하려면 권한 있는 인증 조건을 명시해야 한다.

### 왜 두 Test 결과가 동시에 맞을 수 있는가

존재하는 Ticket을 조회하는 같은 URI를 예로 든다.

| Test 경계 | 포함한 구성요소 | 익명 Request 결과 | 결과가 증명하는 것 |
|---|---|---:|---|
| Standalone Controller Test | MVC·Controller·Service, Security Filter 없음 | `200` 가능 | Security를 제거한 상태의 Controller 성공 계약 |
| Security Integration Test | 실제 Spring Context·Security Filter·MVC·Controller | `401` | 실제 Filter Chain이 익명 Request를 Controller 전에 차단하는 계약 |

두 Test는 이름이 같은 URI를 호출해도 서로 다른 System Boundary를 검증하므로 결과가 모순되지 않는다. Standalone Test의 `200`은 “실제 익명 사용자가 조회할 수 있다”는 뜻이 아니라 “보안 선행 조건을 제외하면 Controller의 정상 조회 변환이 맞다”는 뜻이다.

### 각 Test가 맡아야 할 책임

| Test 종류 | 확인할 책임 | 이 Test만으로 주장하지 않을 것 |
|---|---|---|
| Standalone Controller Test | JSON 변환, Validation, Status·Header·Body, Controller Advice | 실제 인증·Session·Role·CSRF Filter 동작 |
| Security Integration Test | 익명 `401`, 인증된 권한 부족 `403`, Session 복원, CSRF 누락·정상, Application 진입 여부 | Domain 규칙의 모든 경계 Case |
| Application·Domain Unit Test | Ticket 생성·조회 규칙과 Repository Port 계약 | HTTP Filter와 Browser Cookie 동작 |

기존 Standalone Test를 모두 Integration Test로 바꿀 필요는 없다. 빠른 Controller 계약 Test는 유지하고, Security가 관찰 대상인 Case만 실제 Filter Chain을 포함한 별도 Test로 작성한다.

### Security Test가 실제 Filter를 포함했다는 최소 근거

성공 Case 하나만으로는 Filter가 빠져 있어도 Test가 통과할 수 있다. 다음처럼 거부와 허용을 짝지어 확인한다.

1. 익명 보호 `GET`이 `401`이고 Controller에 진입하지 않는다.
2. 인증된 `USER`의 조회가 `403`이다.
3. 인증된 `AGENT`의 같은 조회가 `200`이다.
4. 인증·Role을 만족한 `POST`가 CSRF Token 없이는 `403`, 유효 Token으로는 기존 생성 흐름까지 진행한다.
5. 실제 Form Login 결과의 Session을 후속 Request에 재사용하면 Password 없이 인증 상태가 복원된다.

`@WithMockUser`나 `user()`는 특정 인증 상태에서 Authorization을 확인하는 데 유용하지만, Username·Password 검증과 실제 Form Login 성공을 거쳐 Session이 만들어졌다는 사실까지 증명하지는 않는다. Form Login과 Session 지속은 별도의 Login Request 및 후속 Request Test로 확인한다.

## 실패·반례와 자주 발생하는 오해

| 오해·잘못된 사용 | 수정된 이해 |
|---|---|
| Login 성공이 곧 모든 API 허용을 뜻한다. | Login은 Authentication만 만든다. 각 요청의 Authorization은 계속 필요하다. |
| UI에서 조회 버튼을 숨기면 인가가 끝난다. | Client UI는 우회할 수 있으므로 Server가 직접 API 요청을 검사해야 한다. |
| 모든 보안 `403`은 Role 부족이다. | CSRF 실패도 `403`일 수 있으므로 인증 상태·Method·Token 조건을 함께 본다. |
| Controller에서 Role별 `if`를 작성하면 된다. | HTTP 접근 규칙은 Security Filter Chain에서 먼저 검사하고 Domain·Application 책임과 분리한다. |
| Security를 추가한 뒤 기존 `404` Test가 `401`이 되면 무조건 회귀다. | 익명 요청이 Controller 전에 차단된 의도한 계약 변경인지 먼저 확인한다. |
| Standalone Controller Test가 `200`이면 실제 익명 요청도 허용된다. | Standalone Test에 Security Filter가 없다면 보안 선행 조건을 제외한 Controller 계약만 확인한 것이다. |
| `@WithMockUser` 성공으로 Form Login과 Session까지 검증했다. | 준비된 인증 상태의 Authorization은 확인할 수 있지만 Password Login과 Session 지속은 별도 흐름이다. |

## 학습 점검 질문

1. 이 Lab의 Role Matrix에서 로그인하지 않은 사용자의 없는 Ticket 조회가 기존 `404`가 아니라 `401`이 되어야 하는 이유는 무엇인가?
2. 로그인한 `USER`와 `AGENT`가 같은 조회 URI에서 서로 다른 결과를 받는 결정 지점은 어디인가?
3. 익명 `POST`의 인증 실패를 확인할 때 왜 유효한 CSRF Token을 넣어야 하는가?
4. Form Login의 기본 Redirect와 보호 API의 `401`을 어떻게 분리할 것인가?
5. 실제 익명 조회는 `401`인데 Standalone Controller Test의 조회가 `200`이어도 모순이 아닌 이유는 무엇인가?
6. `@WithMockUser`를 사용한 권한 Test와 실제 Form Login·Session Test는 각각 무엇을 증명하는가?

## 자료 범위

- 포함: Servlet Filter 기반 인증·인가 흐름, `401`·`403`, 최소 Role Matrix, MockMvc Test 경계와 Test 조건
- 포함하지 않음: OAuth2·JWT, Method Security, Resource 소유권, 다중 Organization과 Production 권한 모델

## 참고 자료

- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [Spring Security — Servlet Architecture](https://docs.spring.io/spring-security/reference/servlet/architecture.html)
- [Spring Security — Authorize HTTP Requests](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)
- [Spring Security — Form Login](https://docs.spring.io/spring-security/reference/servlet/authentication/passwords/form.html)
- [Spring Security — Setting Up MockMvc and Spring Security](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/setup.html)
- [Spring Framework — MockMvc Setup Features](https://docs.spring.io/spring-framework/reference/testing/mockmvc/hamcrest/setup-steps.html)
