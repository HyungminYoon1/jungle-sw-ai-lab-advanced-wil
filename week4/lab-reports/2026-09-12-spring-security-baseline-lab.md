# Lab Report — Spring Security Baseline과 Test 근거

> 학습 귀속일: 2026-09-11 — 자정을 넘긴 연장 Session
> 실제 실행 시각: 2026-09-12 00:41~00:42 KST
> 상태: 익명 API `401`·BCrypt·Test 전용 Form Login·Session·Role Matrix·CSRF 비교 완료 — 전체 Test 42개 통과
> 공개 원칙: 생성된 개발용 Credential 값은 기록하지 않는다.

## 실험 질문

1. Spring Security 의존성만 추가했을 때 기존 Standalone Controller Test와 실제 Spring Context Test는 각각 어떻게 달라지는가?
2. 익명 API Request를 Login Page로 Redirect하지 않고 `401`로 끝내면서도 기존 Web Infrastructure Test의 책임을 어떻게 보존할 것인가?
3. Test 전용 AGENT의 Form Login 결과를 후속 Request에 재사용했을 때 Password 없이 인증 상태가 복원되는가?

## 실험 경계

이번 단계에서는 `pom.xml`에 `spring-boot-starter-security`만 추가했다. 다음 항목은 추가하거나 변경하지 않았다.

- 사용자 정의 `SecurityFilterChain`
- `PasswordEncoder`
- 학습용 `USER`·`AGENT`
- Form Login·Session 설정
- Security Test 지원 의존성
- 기존 Test의 기대 Status

따라서 이 실행은 Spring Boot의 Default Auto-Configuration 영향을 관찰하는 실험이다. 이번 Lab이 선택한 접근 제어 정책의 구현 근거가 아니다.

## 변경 전 Baseline

2026-09-12 00:41 KST에 의존성을 추가하기 전 전체 Test를 다시 실행했다.

```powershell
.\mvnw.cmd test
```

| 항목 | 결과 |
|---|---|
| 전체 Test | 33개 |
| 실패 | 0 |
| 오류 | 0 |
| 건너뜀 | 0 |
| Build | `BUILD SUCCESS` |

이 결과는 Security가 없는 기존 In-memory Application의 회귀 기준선이다.

## 단일 변경과 해석된 Version

`pom.xml`에 Version을 직접 적지 않고 다음 Starter만 추가했다.

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

2026-09-12 00:41 KST에 Dependency Tree를 확인했다.

```powershell
.\mvnw.cmd dependency:tree "-Dincludes=org.springframework.security:*"
```

| 구성요소 | 실제 해석 Version |
|---|---:|
| Spring Boot Security Starter | 4.1.1 |
| Spring Security Config·Core·Crypto·Web | 7.1.1 |

Dependency Tree 명령은 `BUILD SUCCESS`로 끝났다.

## 의존성 추가 후 전체 Test

2026-09-12 00:42 KST에 설정과 Test를 바꾸지 않고 같은 명령을 다시 실행했다.

```powershell
.\mvnw.cmd test
```

| 항목 | 결과 |
|---|---|
| 전체 Test | 33개 |
| 통과 | 31개 |
| 실패 | 2개 |
| 오류 | 0 |
| 건너뜀 | 0 |
| Build | `BUILD FAILURE` |

실패는 모두 실제 Application Context와 MockMvc를 사용하는 `WebInfrastructureIntegrationTest`에서 발생했다.

| Test | 기존 기대 | 실제 결과 |
|---|---:|---:|
| `request_id_filter_is_registered` | `404` | `302` |
| `handler_timing_interceptor_is_registered` | `404` | `302` |

두 응답의 `Location`은 `/login`이었다. 기존 7개 `TicketControllerTest`는 모두 통과했다.

## 관찰 해석

### Standalone Controller Test

`TicketControllerTest`는 `MockMvcBuilders.standaloneSetup()`으로 Controller를 직접 구성한다. Application의 Security Filter Chain을 자동으로 포함하지 않는 현재 Test 경계이므로 기존 7개가 그대로 통과했다.

이 결과는 Validation, HTTP 변환, Problem Detail과 Application Service 위임 계약이 유지됐다는 근거다. 인증·인가 동작 근거는 아니다.

### 실제 Spring Context Test

`WebInfrastructureIntegrationTest`는 실제 Application Context를 사용한다. 의존성 추가로 Default Security Filter Chain이 생겼고, 익명 `GET /api/tickets/999`는 기존 Controller의 `404`까지 진행하지 않고 `/login`으로 Redirect됐다.

실패 출력에서 Handler는 `null`이었다. 따라서 해당 Request가 Controller와 Handler Interceptor에 도달하지 않았음을 확인했다. 응답 Header에도 기존 Request ID Header가 없었다. 어느 Filter가 먼저 실행됐는지를 일반 규칙으로 확정하려면 별도 순서 검증이 필요하지만, 이번 실제 응답에서는 기존 Request ID 근거도 만들어지지 않았다.

Session에는 Saved Request가 생겼다. 이것은 Login 후 원래 Request로 돌아가기 위한 요청 저장 근거이며, 사용자가 이미 인증됐다는 뜻은 아니다.

## 왜 아직 `401`·`403` 계약 근거가 아닌가

Default 동작은 익명 API Request에 `401`을 반환하지 않고 Form Login용 `302` Redirect를 반환했다. 또한 다음 항목을 아직 구성하거나 검증하지 않았다.

- 익명 보호 API의 `401`
- 인증됐지만 권한이 없는 `USER` 조회의 `403`
- 허용된 `USER` 생성과 `AGENT` 조회
- Password Encoding과 `matches`
- Login 성공 뒤 Session 재사용
- 인증된 `POST`의 CSRF Token 없음·유효 비교

따라서 현재 상태는 “Security 의존성이 실제 Context Test에 영향을 주었다”는 실행 근거다. “Lab의 인증·인가 계약을 구현했다”는 근거가 아니다.

## Secret·Log 경계

Default Auto-Configuration은 실행 중 개발용 Credential을 생성해 Log에 안내했다. 값은 Console 공유 단계에서 가렸고 이 문서에도 복사하지 않았다. 이 Credential을 Application 설정이나 학습용 사용자로 재사용하지 않는다.

## 9월 12일 익명 API `401` Red-Green

> 실제 실행 시각: 2026-09-12 14:26~14:29 KST

### 비교 조건 수정

새 `SecurityIntegrationTest`는 실제 Application Context와 Security Filter Chain을 사용하고 다음 계약을 요구했다.

- 익명 `GET /api/tickets/999`
- 응답 `401`
- `Location` Header 없음
- Handler가 `null`, 즉 Controller 미진입

첫 실행에서는 새 Test만 `Accept: application/json`을 사용해 Default Security 상태에서도 `401`로 통과했다. 기존 `302` 실험의 `Accept: application/problem+json`과 조건이 달랐으므로 이 결과를 사용자 정의 정책의 Green 근거로 인정하지 않았다.

`Accept`를 기존 실험과 같은 `application/problem+json`으로 맞춘 뒤 다시 실행하자 기대 `401`, 실제 `302`로 실패했다. `Location: /login`, Handler `null`, Saved Request 저장도 함께 관찰했다.

| Red 실행 | 결과 |
|---|---:|
| Test | 1개 |
| 실패 | 1개 |
| 실제 Status | `302` |
| Redirect | `/login` |
| Controller | 미진입 |

이 비교는 `Accept`가 달랐던 첫 통과를 폐기하고 한 번에 응답 정책 하나만 바꾸기 위한 통제다. Default Security가 모든 JSON 계열 Media Type에 항상 같은 응답을 준다고 일반화하지 않는다.

### 최소 Green 구성

`SecurityConfiguration`에 다음 범위만 추가했다.

- `/api/**` Request는 인증 필요
- 익명 API 인증 실패는 `HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)`로 `401`
- 다른 Request는 현재 단계에서 허용
- 후속 Session Login 실험을 위해 Default Form Login 유지

Role별 규칙과 사용자·Password는 이 단계에 넣지 않았다. 변경 뒤 새 Security Test 1개는 실패·오류·건너뜀 없이 통과했다.

### 기존 Test 책임 복원

첫 전체 실행에서는 새 Security Test가 통과했지만 기존 `WebInfrastructureIntegrationTest` 2개가 기대 `404`, 실제 `401`로 실패했다. 이는 익명 Request가 Controller와 Handler Interceptor 전에 차단된 결과다.

Test Scope에 `spring-security-test`를 추가했고 실제 해석 Version 7.1.1을 확인했다. Web Infrastructure Test의 각 Request에는 `AGENT` Role의 Test Double을 명시적으로 결합했다. 이 Test Double은 Password Login이나 Session 복원을 거치지 않으며, 기존 Test가 Request ID Filter와 Handler Timing Interceptor를 검증하기 위한 인증 선행 조건일 뿐이다.

수정 후 관련 Test 3개와 전체 Test를 각각 실행했다.

| 최종 실행 | 결과 |
|---|---:|
| 전체 Test | 34개 |
| 실패 | 0개 |
| 오류 | 0개 |
| 건너뜀 | 0개 |
| Build | `BUILD SUCCESS` |

## 9월 12일 BCrypt Password Red-Green

> 실제 실행 시각: 2026-09-12 15:37~15:38 KST

### 설명 Gate

외부 AI가 작성한 답변은 참고 자료로만 검토하고 사용자의 이해 근거로 바로 인정하지 않았다. 사용자는 자료를 보지 않고 다음 흐름을 다시 설명했다.

> Login Password 후보와 저장된 Encoding에 포함된 Salt를 이용해 단방향 계산을 다시 수행하고, 그 결과가 저장된 값과 맞는지 비교하므로 원문을 복호화할 필요가 없다.

이번 Lab은 이 설명의 구현체를 `BCryptPasswordEncoder`로 한정한다. 모든 `PasswordEncoder` 구현의 내부 형식이 같다고 일반화하지 않는다.

### Red

실제 Application Context에서 `PasswordEncoder` Bean을 주입받는 Test를 먼저 추가했다. Production 구성에 해당 Bean이 없었으므로 Test 본문에 도달하기 전에 `NoSuchBeanDefinitionException`으로 종료됐다.

| Red 실행 | 결과 |
|---|---:|
| Test | 1개 |
| 실패 | 0개 |
| 오류 | 1개 |
| 원인 | `PasswordEncoder` Bean 없음 |

### Green

`SecurityConfiguration`에 기본 설정의 `BCryptPasswordEncoder` Bean을 추가했다. Test의 원문 후보는 실행 중 임의로 만들고 다음 Boolean 결과만 검증했다.

- 같은 후보의 `encodedA`와 `encodedB`는 서로 다름
- `matches(candidate, encodedA)` 성공
- `matches(candidate, encodedB)` 성공
- `matches(wrongCandidate, encodedA)` 실패

원문 후보와 두 Encoding 값은 Test Output·Log·문서에 출력하지 않았다. Target Test 1개가 통과한 뒤 전체 Test를 실행했다.

| 최종 실행 | 결과 |
|---|---:|
| 전체 Test | 35개 |
| 실패 | 0개 |
| 오류 | 0개 |
| 건너뜀 | 0개 |
| Build | `BUILD SUCCESS` |

## 9월 12일 Form Login·Session Red-Green

> 최종 회귀 실행 시각: 2026-09-12 18:01 KST

### 설명 Gate

사용자는 등록되지 않은 사용자로 Form Login을 시도하면 `Authentication` 생성과 `authenticated()` 검사가 실패하고, 기본 실패 Handler가 `302` Redirect를 사용할 수 있으며, Session 존재만으로 Login 성공을 증명할 수 없다고 예측했다.

후속 문답에서는 다음 경계를 구분했다.

- Session 없는 후속 보호 Request: 인증 복원 실패, `401`, Controller 미진입
- `USER` Session이 복원됐지만 `AGENT` 조건을 요구하는 Request: 인증 복원 성공, 인가 `DENY`, `403`, Controller 미진입
- `authenticated().withRoles(...)`: Session에서 복원된 인증 상태의 직접 근거
- `status().isForbidden()`: 해당 조건에서의 인가 거부 결과이며, 이것만으로 Session 복원을 단정하지 않음

### Red

실제 Application Context와 Security Filter Chain을 사용하는 `SessionAuthenticationIntegrationTest`를 추가했다. Test 전용 `UserDetailsService`는 빈 `InMemoryUserDetailsManager`로 먼저 구성해 임의 기본 사용자가 개입하지 않게 했다.

등록되지 않은 AGENT로 Form Login 성공을 요구한 결과는 다음과 같았다.

| Red 실행 | 결과 |
|---|---:|
| Test | 1개 |
| 실패 | 1개 |
| 오류 | 0개 |
| 실패 지점 | 인증된 `Authentication`이 있어야 한다는 Assertion |

### Login Green과 반례

Test 전용 AGENT를 추가하면서 원문 후보는 실행 중 임의로 만들고, Production `PasswordEncoder` Bean으로 Encoding한 값만 `UserDetailsService`에 등록했다. Credential 값은 Source Output·Log·문서에 출력하지 않았다.

다음 세 Test를 실행했다.

- 등록된 AGENT의 Form Login은 인증된 Username과 `ROLE_AGENT`를 만듦
- 같은 Username과 잘못된 Password 후보는 인증되지 않고 `/login?error`로 Redirect
- Login 결과의 동일 `MockHttpSession`만 후속 `GET /api/tickets/999`에 전달하면 `AGENT` Authentication이 복원되고 `TicketController#findById`까지 도달한 뒤 Ticket 부재로 `404`

두 번째 Request에는 Username·Password, `@WithMockUser`, `.with(user(...))`와 Authorization Header를 추가하지 않았다.

| 실행 | Test | 실패 | 오류 | 건너뜀 | Build |
|---|---:|---:|---:|---:|---|
| Login·Session 대상 | 3개 | 0개 | 0개 | 0개 | `BUILD SUCCESS` |
| 전체 회귀 | 38개 | 0개 | 0개 | 0개 | `BUILD SUCCESS` |

### 증명하지 않는 것

- `MockHttpSession` 객체를 직접 재사용했으므로 실제 Browser가 Session ID Cookie를 저장·전송했다는 Network 근거가 아니다.
- Test 전용 AGENT Fixture이므로 Production Runtime 사용자 저장소나 Credential 관리 근거가 아니다.
- 현재 API 규칙은 아직 인증 여부만 요구하므로 `USER` 조회 `403`과 `AGENT` 조회 허용의 Role Matrix 근거가 아니다.
- 인증된 `POST`의 CSRF Token 누락·유효 비교 근거가 아니다.

## 9월 12일 Role Matrix Red-Green

> 최종 Clean 회귀 실행 시각: 2026-09-12 19:01 KST

### 설명 상태

현재 `.requestMatchers("/api/**").authenticated()` 규칙에서 로그인한 USER의 조회 결과를 묻는 질문은 사용자가 무엇을 채워야 하는지 요청해 완성 예시로 설명했다. 따라서 이를 사용자의 독립 회상 통과로 기록하지 않고, 구현 뒤 `401`·`403`·`200` 흐름을 다시 설명하는 Gate를 남긴다.

### Red

Test 전용 USER로 Form Login한 뒤 같은 `MockHttpSession`으로 `GET /api/tickets/999`를 호출하고 `403`과 Controller 미진입을 요구했다.

| Red 실행 | 결과 |
|---|---:|
| Test | 1개 |
| 실패 | 1개 |
| 오류 | 0개 |
| 기대·실제 Status | 기대 `403`, 실제 `404` |

현재 규칙은 Role을 구분하지 않고 인증 여부만 검사했다. USER의 Authentication이 복원되자 Authorization을 통과했고, 존재하지 않는 Ticket 처리까지 진행해 `404`가 반환됐다.

### Green과 권한 성공 Case

Method와 Path를 함께 구분해 다음 순서로 규칙을 구성했다.

1. `POST /api/tickets`: `USER` 또는 `AGENT`
2. `GET /api/tickets/{id}`: `AGENT`
3. 나머지 `/api/**`: 인증된 사용자

Test 전용 `UserDetailsService`에는 실행 중 임의 Password를 Encoding한 USER와 AGENT를 등록했다. 값 자체는 Output·Log·문서에 출력하지 않았다.

- USER Login Session과 유효 CSRF Token으로 Ticket 생성: `201`, `TicketController#create` 진입
- USER Login Session으로 단건 조회: Authentication 복원, Authorization `DENY`, `403`, Controller 미진입
- AGENT Login Session으로 미리 준비한 존재하는 Ticket 조회: `200`, `TicketController#findById` 진입

| 실행 | Test | 실패 | 오류 | 건너뜀 | Build |
|---|---:|---:|---:|---:|---|
| Login·Session·Role 대상 | 6개 | 0개 | 0개 | 0개 | `BUILD SUCCESS` |
| 전체 Clean 회귀 | 41개 | 0개 | 0개 | 0개 | `BUILD SUCCESS` |

### 증명하지 않는 것

- Test 전용 USER와 AGENT를 사용했으므로 Production Runtime 사용자 저장소와 실제 운영 권한 설계 근거가 아니다.
- USER 생성 Test의 유효 CSRF Token은 Role 검사를 먼저 관찰하기 위한 조건이다. Token 누락과 유효 조건을 비교하지 않았으므로 CSRF 실험 완료 근거가 아니다.
- 실제 Browser Cookie 전송, Resource 소유권, Database Adapter와 PostgreSQL Integration 동작은 검증하지 않았다.

## 9월 12일 CSRF 누락·유효 조건 비교

> 최종 Clean 회귀 실행 시각: 2026-09-12 23:42 KST

### 설명 Gate

사용자는 Token 없는 POST의 `403`과 유효 Token 요청의 통과를 먼저 예측했다. 두 요청의 유일한 차이를 처음에는 GET·POST Method 차이라고 답했지만, 두 요청 모두 같은 POST임을 확인한 뒤 `CSRF Token의 유무`라고 교정했다.

판정: `PASS_AFTER_CORRECTION`

### 비교 조건

| 조건 | Token 없음 | 유효 Token |
|---|---|---|
| 사용자 | 같은 Test 전용 USER | 같은 Test 전용 USER |
| 인증 | 같은 방식의 Login Session 복원 | 같은 방식의 Login Session 복원 |
| Method·URI | `POST /api/tickets` | `POST /api/tickets` |
| Body | 유효한 Ticket 생성 JSON | 유효한 Ticket 생성 JSON |
| Role 규칙 | USER 생성 허용 | USER 생성 허용 |
| CSRF Token | 없음 | `csrf()`로 유효 Token 추가 |
| 결과 | `403`, Controller 미진입 | `201`, `TicketController#create` 진입 |

Token 없는 Test도 `authenticated().withRoles("USER")`를 먼저 확인한다. 따라서 인증 복원 실패와 Role 부족을 원인에서 제외하고, 두 요청에서 의도적으로 바꾼 CSRF Token 조건을 `403`의 원인으로 해석할 수 있다.

### 실행 결과

별도의 Production CSRF 설정을 추가하지 않았다. Spring Security가 기본으로 활성화한 CSRF 방어를 Characterization Test로 고정했다.

| 실행 | Test | 실패 | 오류 | 건너뜀 | Build |
|---|---:|---:|---:|---:|---|
| Token 없는 POST 대상 | 1개 | 0개 | 0개 | 0개 | `BUILD SUCCESS` |
| Login·Session·Role·CSRF 대상 | 7개 | 0개 | 0개 | 0개 | `BUILD SUCCESS` |
| 전체 Clean 회귀 | 42개 | 0개 | 0개 | 0개 | `BUILD SUCCESS` |

### 증명하지 않는 것

- `csrf()`가 Test Request에 유효 Token을 구성했으므로 실제 Browser가 HTML Form이나 JavaScript에서 Token을 받아 전송하는 과정의 근거가 아니다.
- 실제 Cookie의 `SameSite`·`Secure`·`HttpOnly` 속성, Cross-site Browser 동작과 Network Header는 관찰하지 않았다.
- CSRF Token은 인증 정보를 만들거나 USER에게 Role을 부여하지 않는다. 이 Test는 이미 인증된 Session의 상태 변경 Request 검증만 다룬다.

## 현재 증명 범위

| 항목 | 상태 |
|---|---|
| 실제 Filter Chain의 익명 API `401` | `IMPLEMENTED`·`RUN`·`PASS` |
| 익명 Request의 Redirect 없음 | `RUN`·`PASS` |
| 익명 Request의 Controller 미진입 | `RUN`·`PASS` |
| 인증 Test Double을 사용한 기존 Web Infrastructure 회귀 | `RUN`·`PASS` |
| BCrypt Password Encoding과 `matches` | `IMPLEMENTED`·`RUN`·`PASS` |
| Test 전용 AGENT의 Form Login 성공·실패 | `IMPLEMENTED`·`RUN`·`PASS` |
| Login 성공 뒤 동일 Mock Session 재사용 | `IMPLEMENTED`·`RUN`·`PASS` |
| Production Runtime `USER`·`AGENT` 구성 | `NOT_IMPLEMENTED`·`NOT_RUN` |
| Test 전용 USER 생성 `201`·조회 `403`, AGENT 조회 `200` | `IMPLEMENTED`·`RUN`·`PASS` |
| 인증된 `POST`의 CSRF Token 누락·유효 비교 | `IMPLEMENTED`·`RUN`·`PASS` |

상세 시간 제한과 Cut Line은 [2026-09-12 학습 계획](../study-notes/2026-09-12-study-questions.md)에 기록한다.
