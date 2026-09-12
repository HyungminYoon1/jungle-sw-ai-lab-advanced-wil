# Learning Note — Spring Test Annotation과 Test Boundary

> 작성일: 2026-09-12
> 기준: Spring Boot 4.1.1, Spring Security 7.1.1, JUnit 6.1.3
> 적용 대상: AI Helpdesk Learning Lab의 Unit·Standalone MVC·Security Integration Test

## 핵심 질문

> Test Class에 붙인 Annotation은 무엇을 자동으로 준비하며, 그 결과 Test가 포함하거나 제외하는 System Boundary는 어디까지인가?

## 선행 자료

- [JUnit과 단위 테스트 설계](../../week1/study-docs/learning-junit-and-unit-test-design.md)
- [Authentication과 Authorization](./authentication-authorization.md)
- [Form Login과 Session 인증 과정](./session-authentication-flow.md)

이 자료는 JUnit의 Assertion과 Given–When–Then을 다시 설명하지 않는다. 대신 현재 Lab에서 보이는 Spring Test Annotation이 Application Context, MockMvc, Security Filter와 Test Double을 어떻게 준비하는지 설명한다.

## Annotation은 무엇인가

Java Annotation은 Class·Method·Field 등에 붙이는 Metadata다. Annotation이 Business Logic이나 Assertion을 직접 대신하지는 않는다. JUnit, Spring TestContext 또는 Spring Boot 같은 실행 주체가 Annotation을 읽고 정해진 준비·실행·정리 동작을 수행한다.

예를 들어 다음 세 Annotation은 서로 다른 질문에 답한다.

```java
@SpringBootTest
@AutoConfigureMockMvc
class SecurityIntegrationTest {

    @Test
    void anonymous_request_is_rejected() {
        // Request와 Assertion
    }
}
```

| Annotation | 답하는 질문 |
|---|---|
| `@Test` | 어떤 Method를 Test로 실행할 것인가? |
| `@SpringBootTest` | 어떤 Spring Boot Application Context를 준비할 것인가? |
| `@AutoConfigureMockMvc` | 그 Context의 MVC 요청을 어떤 Test Client로 실행할 것인가? |

세 Annotation이 있어도 기대 결과를 검사하는 Assertion이 없으면 원하는 계약을 증명할 수 없다. 반대로 Assertion이 있어도 Security Filter를 제외한 Test Boundary라면 실제 인증·인가 계약의 근거가 되지 않는다.

## 현재 Lab의 Test Boundary

| 대표 Test | 주요 Annotation·구성 | 포함 범위 | 포함하지 않는 범위 |
|---|---|---|---|
| `TicketTest` | `@Test` | 순수 Domain 객체와 JUnit | Spring Context·HTTP·Security |
| `TicketControllerTest` | `@BeforeEach`, `standaloneSetup()` | 직접 만든 Controller·Service·Repository와 MVC 변환 | Application Context·Security Filter |
| `PasswordEncoderIntegrationTest` | `@SpringBootTest`, `@Autowired` | 실제 Context의 `PasswordEncoder` Bean | HTTP Login·Session |
| `SecurityIntegrationTest` | `@SpringBootTest`, `@AutoConfigureMockMvc` | 실제 Context·MVC·등록된 Filter Chain | 실제 Network Port·Browser |
| `SessionAuthenticationIntegrationTest` | 위 두 개와 `@Import` | Test 전용 사용자로 Form Login 성공·실패, 같은 `MockHttpSession` 재사용, Role Matrix와 CSRF Token 비교 | 실제 Browser Cookie·Production 사용자 저장소 |
| `WebInfrastructureIntegrationTest` | 위 두 개와 `@ExtendWith(OutputCaptureExtension.class)` | 실제 Context·MVC·Filter와 Output Capture | 실제 외부 Log 수집 System |

Test 이름에 `IntegrationTest`가 들어 있다는 사실만으로 Integration 범위가 만들어지는 것은 아니다. Annotation, Builder와 주입된 Bean을 함께 확인해야 한다.

## `@Test` — 실행할 Test Method 표시

```java
import org.junit.jupiter.api.Test;

@Test
void anonymous_ticket_request_returns_unauthorized() {
    // 실행과 검증
}
```

`@Test`는 JUnit Jupiter가 해당 Method를 Test로 발견하고 실행하게 한다.

- Spring Context를 만들지 않는다.
- MockMvc를 만들지 않는다.
- Transaction을 자동으로 시작하지 않는다.
- Security 사용자를 자동으로 넣지 않는다.

즉 `@Test`는 실행 대상을 표시할 뿐, Test 환경의 범위를 결정하는 나머지 설정은 다른 Annotation이나 직접 작성한 Code가 담당한다.

## `@BeforeEach` — 각 Test 직전의 준비

```java
@BeforeEach
void setUp() {
    repository = new InMemoryTicketRepository();
    service = new TicketApplicationService(repository);
}
```

JUnit은 각 `@Test` Method를 실행하기 전에 `@BeforeEach` Method를 실행한다. 현재 `TicketControllerTest`는 여기에서 Repository, Service, Controller와 Standalone MockMvc를 직접 만든다.

중요한 경계는 다음과 같다.

- `@BeforeEach`가 객체를 만들었으므로 Spring의 Component Scan이나 Dependency Injection 근거가 아니다.
- `MockMvcBuilders.standaloneSetup()`으로 만든 MockMvc에는 실제 Application의 Filter Bean이 자동으로 들어오지 않는다.
- 공통 준비를 숨기면 각 Test의 Given이 잘 보이지 않을 수 있으므로 실제 중복이 있을 때 사용한다.

## `@SpringBootTest` — Spring Boot Application Context 준비

```java
@SpringBootTest
class PasswordEncoderIntegrationTest {
    // Test Body
}
```

Spring Boot 4.1.1의 `@SpringBootTest`는 Spring TestContext를 통해 Spring Boot 기반 Application Context를 준비한다. 별도 `classes`를 지정하지 않으면 일반적으로 `@SpringBootConfiguration`을 찾아 Application 구성을 시작한다. 현재 Lab에서는 `HelpdeskApplication`과 그 아래에서 발견되는 Bean, Auto-Configuration이 대상이 된다.

### 기본 `webEnvironment`

`@SpringBootTest`의 기본값은 `webEnvironment = MOCK`이다.

- Web Application Context는 준비할 수 있다.
- 실제 TCP Port에서 Server를 시작하지 않는다.
- 실제 Browser나 Network Client를 사용한 Test가 아니다.

따라서 `@SpringBootTest`를 사용했다고 바로 End-to-End Test라고 부르면 안 된다.

### Test Method보다 먼저 실패할 수 있다

Context를 만드는 동안 필수 Bean이 없거나 Bean 생성이 실패하면 `@Test` Method 본문에 도달하기 전에 Test가 오류로 끝난다. `PasswordEncoderIntegrationTest`의 Red에서 발생한 `NoSuchBeanDefinitionException`이 이 경우다.

이는 Assertion 실패와 다르다.

| 구분 | 예시 | 의미 |
|---|---|---|
| Test 실패 | 기대 `401`, 실제 `302` | Test 본문과 Assertion까지 실행됐으나 결과가 다름 |
| Context 오류 | 필요한 Bean을 주입할 수 없음 | Test 본문 실행 전에 환경 준비 실패 |

### Context를 사용한다고 모든 외부 System이 실제가 되는 것은 아니다

현재 Application Context가 In-memory Repository를 사용하면 `@SpringBootTest`도 그 Bean을 사용한다. 실제 PostgreSQL Driver·Adapter·Container가 없는데 `@SpringBootTest`만 붙였다고 PostgreSQL Integration Test가 되지는 않는다.

## `@AutoConfigureMockMvc` — Context 기반 MockMvc 준비

```java
@SpringBootTest
@AutoConfigureMockMvc
class SecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
}
```

Spring Boot 4.1.1의 `@AutoConfigureMockMvc`는 Application Context의 MVC 구성을 바탕으로 `MockMvc`를 자동 구성한다. 기본값인 `addFilters = true`에서는 Context의 Filter도 MockMvc에 등록한다.

현재 Lab에서 이것이 중요한 이유는 Spring Security의 `FilterChainProxy`가 Request 처리에 참여해야 익명 `401`, Role `403`, CSRF와 Session 복원을 검증할 수 있기 때문이다.

```text
MockMvc Request
→ Context에 등록된 Servlet Filter
→ Spring Security Filter Chain
→ DispatcherServlet
→ Controller
```

### `standaloneSetup()`과의 차이

| 구성 | 객체를 준비하는 주체 | 실제 Context Filter | 주된 목적 |
|---|---|---:|---|
| `MockMvcBuilders.standaloneSetup(controller)` | Test Code가 직접 준비 | 자동 포함 안 됨 | Controller의 HTTP 변환 계약 |
| `@SpringBootTest` + `@AutoConfigureMockMvc` | Spring Boot Context와 Auto-Configuration | 기본적으로 포함 | 실제 Bean 연결과 Filter Chain을 포함한 요청 |

### `addFilters = false` 주의

다음 설정은 Filter를 MockMvc에 추가하지 않는다.

```java
@AutoConfigureMockMvc(addFilters = false)
```

Controller 자체만 보고 싶은 일부 Test에는 선택할 수 있지만, 이 설정으로 통과한 요청은 Security Filter 동작 근거가 될 수 없다. 현재 Security Integration Test에서는 사용하지 않는다.

### 실제 Browser Test는 아니다

MockMvc는 Servlet 요청과 응답을 Process 안에서 모의 실행한다. 실제 Browser의 Cookie 저장 정책, TCP 연결, HTTPS와 Proxy 동작은 검증하지 않는다. Login 결과의 `MockHttpSession`을 다음 Request에 넘기는 Test는 Server-side Session 저장·복원을 확인하지만 실제 Browser가 `Set-Cookie`를 저장하고 다시 보냈다는 Network 증거는 아니다.

## `@Autowired` — Context에서 Test 대상 주입

```java
@Autowired
private PasswordEncoder passwordEncoder;
```

`@Autowired`는 Test 전용 Annotation이 아니라 Spring의 Dependency Injection Annotation이다. 다만 Spring TestContext가 Test Instance에 대한 Dependency Injection을 수행하므로 `@SpringBootTest` 같은 Context Test에서도 사용할 수 있다.

- `PasswordEncoderIntegrationTest`: Production 구성의 `PasswordEncoder` Bean을 주입
- `SecurityIntegrationTest`: Auto-Configuration이 만든 `MockMvc`를 주입

순수 JUnit Test에 `@Autowired`만 붙여도 Spring Context가 자동으로 생기지는 않는다. 해당 Test가 Spring TestContext와 연결되어 있어야 한다.

주입에 성공했다는 사실은 해당 Type의 Bean을 찾았다는 근거다. 그 Bean의 모든 동작이 올바르다는 근거는 아니므로 Test Method의 실행과 Assertion이 따로 필요하다.

## `@ExtendWith` — JUnit Extension 연결

```java
@ExtendWith(OutputCaptureExtension.class)
class WebInfrastructureIntegrationTest {
    // Test Body
}
```

`@ExtendWith`는 JUnit Jupiter의 Extension을 Test에 등록한다. Extension은 Test 전후 Callback, Parameter 해석과 추가 기능을 제공할 수 있다.

현재 `OutputCaptureExtension`은 Test 실행 중 출력된 내용을 `CapturedOutput` Parameter로 받을 수 있게 한다.

```java
@Test
void handler_log_is_written(CapturedOutput output) {
    // Request 실행
    assertThat(output.getAll()).contains("handler=");
}
```

이 Annotation이 Spring Security를 추가하거나 Login 사용자를 만드는 것은 아니다. Output을 포착하는 책임만 추가한다.

`@SpringBootTest` 자체가 `SpringExtension`과 연결되는 Meta-Annotation을 포함하므로 현재 Test Class에 다음 Annotation을 다시 붙일 필요는 없다.

```java
@ExtendWith(SpringExtension.class)
```

## `@WithMockUser` — 인증된 사용자를 미리 주입

```java
@Test
@WithMockUser(username = "authorization-test-user", roles = "USER")
void user_cannot_read_ticket() {
    // 보호 Request와 403 검증
}
```

`@WithMockUser`는 Spring Security Test가 Test 실행 전에 가짜 `SecurityContext`와 `Authentication`을 준비하게 한다. 지정한 사용자는 실제 UserDetails 저장소에 존재하지 않아도 된다.

따라서 다음 검증에 적합하다.

- 이미 인증된 `USER`가 어떤 Endpoint에서 `403`을 받는가?
- 이미 인증된 `AGENT`가 같은 Endpoint를 통과하는가?
- 현재 Request 규칙이 Authority를 올바르게 비교하는가?

하지만 다음 항목은 우회한다.

- Login Form 제출
- Username·Password 조회와 `PasswordEncoder.matches`
- Login 성공 Handler
- Login 결과를 Session에 저장하는 과정
- 다음 Request에서 Session을 복원하는 과정

그러므로 `@WithMockUser` Test가 통과해도 실제 Form Login과 Session 지속이 동작한다고 주장할 수 없다.

### Request별 `user()`와의 차이

현재 `WebInfrastructureIntegrationTest`는 Annotation 대신 다음 Request Post-Processor를 사용한다.

```java
mockMvc.perform(
        get("/api/tickets/{id}", 999L)
                .with(user("infrastructure-test-agent")
                        .roles("AGENT")));
```

둘 다 실제 Password Login을 거치지 않고 인증 상태를 Test에 주입한다.

| 방식 | 적용 범위 | 적합한 경우 |
|---|---|---|
| `@WithMockUser` | Test Method 또는 Class | 여러 Request가 같은 가짜 사용자 전제를 공유할 때 |
| `.with(user(...))` | 해당 Request 하나 | Request마다 사용자나 Role을 명시하고 싶을 때 |

Infrastructure Test에서 `.with(user(...))`를 사용한 목적은 Password 인증을 증명하는 것이 아니라, Filter·Interceptor라는 원래 검증 대상에 도달하기 위한 인증 선행 조건을 만드는 것이다.

## `@TestConfiguration`과 `@Import` — Test 전용 Bean 구성

Form Login Test에는 입력 Credential과 대응하는 학습용 사용자가 필요하다. Production Source에 고정 원문 Credential을 넣지 않고 Test 전용 사용자 Fixture를 구성할 때 다음 조합을 검토할 수 있다.

```java
@TestConfiguration(proxyBeanMethods = false)
class LoginTestConfiguration {
    // Test 전용 UserDetailsService Bean
}

@SpringBootTest
@AutoConfigureMockMvc
@Import(LoginTestConfiguration.class)
class SessionAuthenticationIntegrationTest {
    // Login·Session Test
}
```

- `@TestConfiguration`: Test를 위해 추가할 Bean 구성을 표시한다.
- `@Import`: 해당 구성을 이 Test의 Application Context에 포함한다.
- `proxyBeanMethods = false`: 서로의 `@Bean` Method를 직접 호출해 Singleton 동작을 보장할 필요가 없는 독립적인 Factory Method 구성에 사용할 수 있다.

`@TestConfiguration`은 Test Fixture를 정의할 뿐이다. Credential 값 자체를 Log나 공개 문서에 출력하지 않고, Runtime Credential과 분리해야 한다.

Test 전용 Fixture를 추가했더라도 Production Runtime 사용자가 구성됐다는 의미는 아니다. Test 실행 결과와 현재 구현 상태는 날짜별 Study Note와 Lab Report에서 별도로 관리한다.

## `@WebMvcTest` — MVC Slice라는 다른 선택지

```java
@WebMvcTest(TicketController.class)
class TicketControllerSliceTest {
    // MVC Slice Test
}
```

`@WebMvcTest`는 전체 Application Context가 아니라 Spring MVC 구성요소에 집중하는 Slice Test다. Controller의 Mapping, 요청 변환과 응답 직렬화를 Spring MVC 환경에서 확인하되, Controller가 필요로 하는 Collaborator는 별도로 제공하거나 Test Double로 교체해야 할 수 있다.

현재 Lab은 Controller 단독 계약에는 명시적인 `standaloneSetup()`을 유지하고, 실제 Security Filter에는 `@SpringBootTest + @AutoConfigureMockMvc`를 사용한다. 따라서 지금 `@WebMvcTest`를 추가할 필요는 없다.

Security가 Classpath에 있다고 해서 모든 Slice Test가 현재 Production `SecurityFilterChain`을 정확히 포함한다고 추측하지 않는다. Slice에 포함된 Bean과 실제 거부·허용 결과를 확인한 뒤에만 Security 근거로 사용한다.

Spring Boot 4에서는 MVC Test Annotation의 Package가 이전 예제와 다를 수 있다. 현재 Lab의 실제 Import를 기준으로 사용한다.

```java
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
```

## `@MockitoBean` — Spring Bean을 Mockito Double로 교체할 때

`@MockitoBean`은 Spring TestContext 안의 Bean을 Mockito Mock으로 재정의할 필요가 있을 때 사용하는 선택지다. 순수 Unit Test에서 객체를 직접 만들 수 있다면 Spring Context를 시작하기 위해 이 Annotation을 사용할 필요는 없다.

현재 Login·Session 수직 흐름에서는 실제 Security 구성과 Test 전용 사용자 Fixture를 관찰해야 하므로 핵심 Bean을 무분별하게 Mock으로 바꾸지 않는다. 특히 `PasswordEncoder`, `SecurityContextRepository`와 Filter를 Mock으로 교체하면 실제로 확인하려던 흐름을 우회할 수 있다.

## Login·Session Test에서 Annotation과 실행 Code의 역할

```java
@SpringBootTest
@AutoConfigureMockMvc
@Import(LoginTestConfiguration.class)
class SessionAuthenticationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void login_session_authenticates_follow_up_request() {
        // formLogin으로 인증
        // Login 결과의 Session 추출
        // 같은 Session으로 보호 Request 실행
        // 복원된 Authentication과 응답 검증
    }
}
```

| Code | 준비하거나 실행하는 것 | 증명에 필요한 추가 조건 |
|---|---|---|
| `@SpringBootTest` | 실제 Application Context | Context가 시작됐다는 사실만으로 Login 성공을 주장하지 않음 |
| `@AutoConfigureMockMvc` | Context 기반 MockMvc와 기본 Filter 등록 | 실제 거부·허용 응답으로 Filter 참여 확인 |
| `@Import(...)` | Test 전용 사용자 Bean 추가 | Production Credential과 분리 |
| `@Autowired MockMvc` | 준비된 Test Client 주입 | `perform()`과 Assertion 필요 |
| `@Test` | Method 실행 | Test 이름과 Assertion으로 계약 표현 |
| `formLogin()` | 실제 Form Login Request 생성 | `authenticated()` 등으로 성공 확인 |
| `.session(loginSession)` | 후속 Request에 같은 Session 연결 | 두 번째 Request에 가짜 사용자를 새로 주입하지 않음 |

Annotation은 Test의 무대를 준비한다. 실제 Test 증거는 그 무대에서 어떤 Request를 보냈고 무엇을 Assertion했는지까지 함께 읽어야 한다.

## 목적에 따른 선택

| 확인하려는 질문 | 권장 구성 | 피해야 할 잘못된 근거 |
|---|---|---|
| Domain 상태 전이가 맞는가? | JUnit `@Test`, 객체 직접 생성 | 불필요한 `@SpringBootTest` |
| Controller가 JSON과 Status를 변환하는가? | 현재의 `standaloneSetup()` | 이를 실제 Security 근거로 해석 |
| Production `PasswordEncoder` Bean이 동작하는가? | `@SpringBootTest` + `@Autowired` | 임의로 `new BCryptPasswordEncoder()`만 생성 |
| 실제 Filter Chain이 익명을 차단하는가? | `@SpringBootTest` + `@AutoConfigureMockMvc` | Filter 없는 Standalone 성공 Test |
| 이미 인증된 Role의 인가 규칙이 맞는가? | `@WithMockUser` 또는 `.with(user(...))` | 이것으로 Password Login까지 증명 |
| Form Login과 Session 복원이 동작하는가? | 실제 `formLogin()` 결과의 Session 재사용 | `@WithMockUser`로 인증 과정 우회 |
| 실제 Browser Cookie 속성이 맞는가? | 실제 Runtime·Browser 또는 Server Test | MockMvc Session 재사용만으로 단정 |

## 실패를 읽는 순서

### Test가 발견되지 않는다

1. Method에 JUnit Jupiter의 `@Test`가 있는가?
2. Test Class 이름이 Maven Surefire 탐색 Pattern과 맞는가?
3. JUnit Engine이 Test Classpath에 있는가?

### Test Method 전에 Context가 실패한다

1. `@SpringBootTest`가 어떤 Application 구성을 찾았는가?
2. 필요한 Bean이 실제 Context에 있는가?
3. Test 전용 구성이 `@Import`됐는가?
4. Context 오류를 Assertion 실패로 잘못 읽고 있지 않은가?

### 익명 Request가 예상과 달리 Controller까지 간다

1. Test가 `standaloneSetup()` 기반인가?
2. `@AutoConfigureMockMvc(addFilters = false)`를 사용했는가?
3. 실제 `SecurityFilterChain` Bean이 Context에 있는가?
4. 보호할 Path Matcher가 현재 URI와 일치하는가?

### `@WithMockUser` Test는 통과하지만 실제 Login은 실패한다

`@WithMockUser`는 Password 인증을 우회하므로 모순이 아니다. 실제 Login Test에서 다음 흐름을 따로 확인한다.

```text
Form Parameter
→ Login Filter
→ UserDetailsService
→ PasswordEncoder.matches
→ Authentication
→ Session 저장
```

## 자주 혼동하는 문장

| 혼동하기 쉬운 문장 | 더 정확한 설명 |
|---|---|
| `@SpringBootTest`는 모든 것을 실제로 Test한다. | Application Context를 넓게 준비하지만 실제 Network·Browser·Database 포함 여부는 별도 구성에 달려 있다. |
| `@AutoConfigureMockMvc`가 있으면 실제 Server가 열린다. | 기본 MOCK 환경에서 Process 내부의 모의 Servlet 요청을 실행한다. |
| `@Autowired`가 객체를 새로 만든다. | Spring Context가 관리하는 Bean 중 주입 후보를 찾아 Test Instance에 연결한다. |
| `@WithMockUser`가 Login한다. | 이미 인증된 가짜 SecurityContext를 준비하므로 Password Login을 우회한다. |
| Annotation이 많을수록 더 완전한 Integration Test다. | 포함 범위와 관찰하려는 계약에 필요한 Annotation만 선택해야 실패 원인을 읽기 쉽다. |
| Test Class 이름이 `IntegrationTest`면 통합 Test다. | 이름이 아니라 실제 Context, 외부 의존성, Filter와 실행 조건이 경계를 결정한다. |

## 학습 점검 질문

1. `@Test`만 있는 `TicketTest`에서 `@Autowired` Field가 자동으로 주입되지 않는 이유는 무엇인가?
2. `@SpringBootTest`의 기본 MOCK 환경과 실제 Port를 여는 Test는 무엇이 다른가?
3. `@AutoConfigureMockMvc(addFilters = false)`인 Test가 익명 API `401`의 근거가 될 수 없는 이유는 무엇인가?
4. `@WithMockUser(roles = "AGENT")`가 통과해도 Password가 맞았다고 주장할 수 없는 이유는 무엇인가?
5. Login 결과의 Session 재사용 Test에서 후속 Request에 다시 `.with(user(...))`를 넣으면 무엇을 우회하게 되는가?
6. `PasswordEncoderIntegrationTest`에 `@AutoConfigureMockMvc`가 필요하지 않은 이유는 무엇인가?
7. `WebInfrastructureIntegrationTest`의 `@ExtendWith(OutputCaptureExtension.class)`는 어떤 추가 관찰을 가능하게 하는가?

## 자료 범위

- 포함: 현재 Lab에서 사용하는 JUnit·Spring Boot·Spring Security Test Annotation, MockMvc와 Context 경계
- 비교만 포함: `@WithMockUser`, `@TestConfiguration`, `@Import`, `@WebMvcTest`, `@MockitoBean`
- 포함하지 않음: 실제 Browser E2E Framework, Testcontainers, 실제 PostgreSQL Integration, Transaction Test Annotation 상세

이 문서는 Annotation과 Test Boundary를 설명하는 학습 자료다. 실제 Test 실행 시각, Red·Green 결과와 Test 개수는 Lab Report 또는 날짜별 Study Note에 기록한다.

## 참고 자료

- [JUnit 6.1.3 — Annotations](https://docs.junit.org/6.1.3/writing-tests/annotations.html)
- [Spring Boot 4.1.1 — `@SpringBootTest`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/test/context/SpringBootTest.html)
- [Spring Boot 4.1.1 — `@AutoConfigureMockMvc`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/webmvc/test/autoconfigure/AutoConfigureMockMvc.html)
- [Spring Boot 4.1.1 — `@TestConfiguration`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/test/context/TestConfiguration.html)
- [Spring Framework — TestContext Framework](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework.html)
- [Spring Framework — Testing Annotations](https://docs.spring.io/spring-framework/reference/testing/annotations.html)
- [Spring Security 7.1.1 — MockMvc Testing](https://docs.spring.io/spring-security/reference/servlet/test/)
- [Spring Security 7.1.1 — Form Login Testing](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/form-login.html)
