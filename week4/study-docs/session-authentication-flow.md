# Learning Note — Form Login과 Session 인증 과정

> 작성일: 2026-09-11
> 문서 성격: 교육자료 — 사용자 이해 확인이나 Runtime 검증 근거가 아님
> 공식 문서 기준: 2026-09-11 현재 Spring Security Reference 7.1.1
> Lab 상태: Security Starter 추가·Spring Security 7.1.1 해석 확인, 명시적 인증·Session 구현 `NOT_IMPLEMENTED`

## 핵심 질문

> 최초 Login Request의 Password 검증 결과는 어떻게 `SecurityContext`가 되고, 다음 Request에서는 Session ID만으로 그 인증 상태를 어떻게 복원하는가?

## 이 자료를 별도로 만든 이유

기존 [Authentication·Authorization 자료](./authentication-authorization.md)는 인증과 인가의 차이 및 `401`·`403` 계약을 설명하고, [Password·Session·CSRF 자료](./password-session-csrf.md)는 각 Credential과 방어 수단의 역할을 비교한다. 그러나 다음 두 과정이 구성요소별로 충분히 나뉘어 있지 않았다.

1. 최초 Login에서 Username·Password가 검증되고 인증 결과가 Session에 저장되는 과정
2. 후속 Request에서 Password 없이 `SecurityContextHolder`가 다시 채워지는 과정

이 문서는 그 공백을 보완한다. Class 이름을 외우는 것이 아니라 각 구성요소가 무엇을 입력받고 어떤 결과를 다음 단계에 넘기는지 이해하는 것이 목표다.

## 먼저 읽는 5분 이야기

이 절에서는 Spring Class 이름을 외우지 않는다. 한 사용자가 회원가입하고 Login한 뒤 Ticket을 조회하는 이야기만 먼저 이해한다.

### 먼저 구분할 두 질문

- Authentication: “지금 요청한 사용자가 누구인가?”를 확인한다.
- Authorization: “확인된 사용자가 이 행동을 해도 되는가?”를 판단한다.

Password가 맞다는 사실은 Authentication을 성공시킬 뿐이다. Login에 성공해도 모든 행동이 자동으로 허용되지는 않으며, 후속 Request마다 Authorization이 필요하다.

### 회원가입부터 Ticket 조회까지

```text
1. 회원가입
   Password를 그대로 저장하지 않고 단방향 계산 결과를 저장

2. Login
   사용자가 입력한 Password 후보와 저장된 결과가 대응하는지 확인

3. Login 성공
   Server가 인증된 사용자와 Role을 Session에 보관
   Browser에는 그 Session을 찾을 번호표인 Session ID Cookie를 전달

4. 후속 Ticket 조회
   Browser가 Session ID Cookie를 자동 전송
   Server가 번호에 해당하는 Session과 인증 정보를 찾음

5. 권한 검사
   Ticket 조회에 필요한 Role과 현재 사용자의 Role을 비교
```

### 놀이공원 번호표로 비유하기

| 기술 개념 | 비유 | 실제 역할 |
|---|---|---|
| Session ID Cookie | 방문객이 가진 번호표 | Browser가 Server Session을 찾을 때 보내는 불투명한 식별 값 |
| `HttpSession` | 번호별로 구분된 Server 서류함 | 여러 Request 사이에 Server-side 상태를 유지 |
| `SecurityContext` | 서류함 안의 확인된 회원 카드 | 인증된 사용자와 Authority가 담긴 상태 |
| `SecurityContextHolder` | 현재 요청 담당자의 책상 | 이번 Request를 처리하는 동안 Context를 쉽게 조회하게 함 |
| Authorization | 입구의 이용 자격 확인 | 현재 사용자의 Authority와 Request 규칙을 비교 |

번호표 자체에 사용자 이름과 Role 전체가 적혀 있는 것은 아니다. Server가 번호표로 자기 서류함을 찾아야 인증 정보를 알 수 있다. 번호표를 다른 사람이 탈취하면 기존 Session을 가로챌 수 있으므로, 실제 Session ID는 예측하기 어렵게 만들고 Cookie·HTTPS·Session Fixation 방어로 보호해야 한다.

### 후속 Ticket 조회 한 건을 따라가기

Login한 `AGENT`가 존재하는 Ticket을 조회한다고 가정한다.

```text
Browser가 Session ID Cookie를 보냄
→ Servlet Container가 그 ID에 해당하는 HttpSession을 찾음
→ Spring Security가 Session의 SecurityContext를 찾음
→ 현재 Request의 SecurityContextHolder에 Context를 올림
→ Authentication에서 ROLE_AGENT를 확인
→ Ticket 조회 규칙의 ROLE_AGENT와 비교
→ 허용되면 Controller에 도달하고 200 응답
```

같은 요청에서도 인증 상태에 따라 결과가 달라진다.

| 상태 | 검사 결과 | 이 Lab의 결과 |
|---|---|---:|
| 유효한 Session이 없는 익명 | 누구인지 확인되지 않음 | `401` |
| 로그인한 `USER` | 누구인지는 알지만 조회 Role이 없음 | `403` |
| 로그인한 `AGENT` | 인증과 조회 Role을 모두 충족 | Ticket 존재 시 `200` |

Request가 끝나면 담당자의 책상에 해당하는 `SecurityContextHolder`는 정리된다. Server 서류함인 `HttpSession`은 만료나 Logout 전까지 남으므로 다음 Request에서 같은 인증 상태를 다시 찾을 수 있다.

여기까지의 이야기를 이해한 뒤 아래 Class 이름을 읽는다. 아래 내용은 새로운 원리가 아니라, 방금 본 각 책임을 Spring Security가 어떤 구성요소로 구현하는지 보여 주는 상세 지도다.

## 먼저 구분할 세 장소

| 장소·수명 | 보관하는 것 | 보관하지 않는 것 |
|---|---|---|
| Browser, 여러 Request 사이 | 불투명한 Session ID Cookie | `SecurityContext`, Role 전체, 원문 Password |
| Server의 `HttpSession`, 여러 Request 사이 | `SecurityContext`와 그 안의 인증된 `Authentication` | 매 Request마다 다시 받을 원문 Password |
| 현재 Request의 `SecurityContextHolder` | 현재 실행 흐름에서 사용할 `SecurityContext` | Browser에 전달할 영속 Session 상태 |

핵심은 `SecurityContextHolder`와 `HttpSession`이 같은 저장소가 아니라는 점이다. 기본 전략에서 `SecurityContextHolder`는 현재 Request를 처리하는 Thread에서 인증 정보를 쉽게 찾게 해 주고, `HttpSession`은 다음 Request까지 인증 상태를 이어 주는 Server-side 저장소다.

```text
Request 사이의 상태
Browser Session ID Cookie ↔ Server HttpSession[SecurityContext]

현재 Request의 상태
SecurityContextHolder → SecurityContext → Authentication → Principal + Authorities
```

## 주요 구성요소의 책임

| 구성요소 | 주된 입력 | 하는 일·출력 |
|---|---|---|
| `SecurityFilterChain` | HTTP Request | Spring MVC 앞에서 인증·인가·CSRF 관련 Filter를 순서대로 실행 |
| `SecurityContextHolderFilter` | `SecurityContextRepository`의 조회 결과 | 현재 Request에서 사용할 `SecurityContext`를 `SecurityContextHolder`에 준비 |
| `UsernamePasswordAuthenticationFilter` | Login Request의 Username·Password | 아직 인증되지 않은 `UsernamePasswordAuthenticationToken`을 만들어 `AuthenticationManager`에 전달 |
| `AuthenticationManager` | 인증 전 `Authentication` | Credential을 검증할 Provider에 인증을 위임하고 성공한 `Authentication` 또는 실패를 반환 |
| `ProviderManager` | 인증 전 `Authentication` | 지원 가능한 `AuthenticationProvider`를 찾아 순서대로 위임하는 대표 `AuthenticationManager` 구현 |
| `DaoAuthenticationProvider` | Username·Password 인증 Token | `UserDetailsService`와 `PasswordEncoder`를 이용해 사용자와 Password를 검증 |
| `UserDetailsService` | Username | 저장소에서 `UserDetails`, 저장된 Password Encoding과 Authority를 조회 |
| `PasswordEncoder` | 입력 Password 후보와 저장된 Encoding | `matches`로 두 값이 대응하는지 단방향 검증 |
| `SessionAuthenticationStrategy` | 새로 성공한 인증과 현재 Request·Response | Session Fixation 방어처럼 Login 성공 시 필요한 Session 정책 적용 |
| `SecurityContextRepository` | Request·Response와 `SecurityContext` | 인증 상태를 현재 Request와 이후 Request 사이에서 조회·저장하는 추상화 |
| `HttpSessionSecurityContextRepository` | `HttpSession` | `SecurityContext`를 Session과 연결하는 Repository 구현 |
| `AuthorizationFilter` | 현재 `Authentication`과 Request 규칙 | Method·Path·Authority를 비교해 허용하거나 접근 거부 |
| `ExceptionTranslationFilter` | 인증·인가 과정에서 발생한 보안 예외 | 인증 필요는 `AuthenticationEntryPoint`, 권한 부족은 `AccessDeniedHandler`를 통해 HTTP 응답으로 변환 |

실제 Filter의 전체 목록과 정확한 순서는 설정과 Version에 따라 달라진다. 여기서는 이번 Lab에서 관찰할 책임과 인과관계만 표시한다.

## `Authentication`은 입력과 결과라는 두 역할을 가진다

같은 `Authentication` Interface가 Login 전후에 서로 다른 상태를 나타낸다.

| 시점 | Principal | Credentials | Authorities | 의미 |
|---|---|---|---|---|
| Login 검증 전 | 입력된 Username | 입력된 Password | 아직 확정되지 않음 | `AuthenticationManager`에 전달할 인증 요청 |
| Login 성공 후 | 보통 `UserDetails` | 일반적으로 제거됨 | `ROLE_USER`, `ROLE_AGENT` 등 | 현재 인증된 사용자를 표현하는 결과 |

Login Filter가 Username과 Password를 읽었다는 사실만으로 인증된 것이 아니다. `AuthenticationManager`가 검증에 성공해 인증된 결과를 반환한 뒤에야 그 결과를 `SecurityContext`에 넣을 수 있다.

## 과정 A — 최초 Form Login

전체 흐름을 먼저 한 줄로 보면 다음과 같다.

```text
POST /login
→ Security Filter Chain과 CSRF 검사
→ UsernamePasswordAuthenticationFilter
→ 인증 전 UsernamePasswordAuthenticationToken
→ AuthenticationManager(보통 ProviderManager)
→ DaoAuthenticationProvider
→ UserDetailsService + PasswordEncoder.matches
→ 인증된 Authentication
→ SecurityContextHolder의 새 SecurityContext
→ Session 정책 적용과 SecurityContextRepository 저장
→ HttpSession + Session ID Cookie
```

### 1. Browser가 Login Request를 보낸다

Browser는 Username·Password를 `POST /login`에 담아 보낸다. Form Login의 `POST`도 상태를 변경하는 안전하지 않은 Method이므로 CSRF 보호가 켜져 있다면 유효한 CSRF Token이 필요하다.

Login 전부터 CSRF Token이나 Request Cache 때문에 Session Cookie가 존재할 수도 있다. 따라서 “Cookie가 있다” 또는 “Session이 있다”만으로 Login 성공을 판단할 수 없다.

### 2. Request가 Spring MVC보다 먼저 Security Filter Chain을 지난다

Servlet Container가 Request를 받아 Spring Security Filter Chain으로 전달한다. 이 단계는 `DispatcherServlet`과 Controller보다 앞에 있으므로, Security가 Request를 거절하면 Controller는 호출되지 않는다.

초기 Context를 준비하는 Filter는 Repository에서 기존 인증 상태를 찾아 `SecurityContextHolder`에 연결한다. 최초 Login이라면 보통 아직 인증된 Context가 없다.

### 3. CSRF Filter가 Login POST를 검사한다

유효한 Token이 없다면 Request는 Password 검증까지 가지 못하고 CSRF 실패 `403`으로 끝날 수 있다. 따라서 Login 실패 Test는 “CSRF 실패”와 “잘못된 Password”를 서로 다른 조건으로 작성해야 한다.

### 4. Login Filter가 인증 요청 객체를 만든다

`UsernamePasswordAuthenticationFilter`는 Request에서 Username·Password를 읽고 인증 전 `UsernamePasswordAuthenticationToken`을 만든다. 이 Token은 “사용자가 이렇게 주장하고 이런 Credential을 제시했다”는 입력이지, 이미 신원이 확인됐다는 증거가 아니다.

### 5. `AuthenticationManager`가 검증을 위임한다

Login Filter는 인증 전 Token을 `AuthenticationManager`에 전달한다. 가장 흔한 구현인 `ProviderManager`는 Token 종류를 처리할 수 있는 `AuthenticationProvider`를 선택한다.

Username·Password 방식에서는 보통 `DaoAuthenticationProvider`가 선택된다. 다른 인증 방식을 추가하면 서로 다른 Provider가 같은 `AuthenticationManager` 아래에 함께 있을 수 있다.

### 6. 사용자 정보와 저장된 Password Encoding을 찾는다

`DaoAuthenticationProvider`는 `UserDetailsService`에 Username을 전달해 사용자를 찾는다. 반환된 `UserDetails`에는 식별 정보, 저장된 Password Encoding과 Authority가 들어 있다.

이 조회는 최초 Password Login에서 필요하다. Session으로 인증 상태를 복원하는 모든 후속 Request마다 같은 Password 조회·검증을 다시 수행한다는 뜻은 아니다.

### 7. Password 후보를 단방향으로 검증한다

`DaoAuthenticationProvider`는 `PasswordEncoder.matches(rawCandidate, storedEncoding)`로 입력 후보를 검증한다. 선택한 Encoder는 저장된 Encoding과 자기 설정에서 Salt·Algorithm Parameter 등 검증에 필요한 정보를 얻어 앞 방향 계산을 수행하며, 저장 값을 복호화하지 않는다. BCrypt처럼 저장 문자열에 Cost와 Salt가 포함되는 구현도 있지만 정확한 형식은 Encoder마다 다르다.

### 8. 성공한 `Authentication`을 만든다

사용자와 Password가 유효하면 Provider는 인증된 `Authentication`을 반환한다. 이 결과에는 Principal과 Authority가 포함된다. 성공 후 원문 Password 같은 민감한 Credentials는 일반적으로 제거해 Session에 오래 남지 않도록 한다.

### 9. 현재 Request의 `SecurityContextHolder`에 넣는다

Login Filter는 새 `SecurityContext`에 성공한 `Authentication`을 넣고 이를 `SecurityContextHolder`에 연결한다. 이제 현재 Request의 나머지 처리 과정은 인증된 사용자를 조회할 수 있다.

### 10. 다음 Request를 위해 Context를 저장한다

현재 Thread의 `SecurityContextHolder`만 채워서는 다음 Request까지 인증이 유지되지 않는다. Form Login 성공 흐름은 `SecurityContextRepository`를 통해 `SecurityContext`를 `HttpSession`과 연결해 저장한다.

기본 Session 정책은 Session Fixation을 줄이기 위해 Login 성공 시 Session ID를 바꿀 수 있다. 따라서 Login 전후 ID가 항상 같을 것이라고 가정하지 않고 실제 Runtime Test에서 확인한다.

### 11. Browser는 Session ID Cookie를 받는다

Response의 `Set-Cookie`를 통해 Browser가 Session ID를 저장한다. Cookie에는 보통 사용자 정보나 Role 자체가 아니라 Server Session을 찾기 위한 불투명한 식별 값이 들어 있다. 실제 Cookie 이름과 속성은 Runtime에서 확인하기 전까지 단정하지 않는다.

## Login 실패는 어디에서 끝나는가

| 실패 조건 | 실패 지점 | 관찰할 결과 |
|---|---|---|
| Login POST의 CSRF Token 없음·불일치 | CSRF Filter | `403`; Password 검증이 실행됐다는 근거가 아님 |
| 존재하지 않는 사용자 또는 틀린 Password | Authentication Provider | 인증 실패 Handler 실행; 인증된 Context가 저장되지 않아야 함 |
| 성공한 Context를 후속 Request용 Repository에 저장하지 않은 Custom Login | 인증 지속 처리 | 현재 Request에서만 인증된 것처럼 보이고 다음 Request는 다시 익명일 수 있음 |

기본 Form Login을 사용할 때는 Framework가 성공·실패 처리를 제공한다. Custom Login을 직접 만들면 `SecurityContextHolder` 설정만이 아니라 `SecurityContextRepository` 저장 책임까지 명시적으로 확인해야 한다.

## 과정 B — Login 뒤의 후속 Request

후속 Request에는 Password가 없다.

```text
GET /api/tickets/1 + Session ID Cookie
→ Servlet Container가 HttpSession 식별
→ SecurityContextRepository가 Session의 SecurityContext 조회
→ SecurityContextHolderFilter가 현재 SecurityContextHolder에 연결
→ AuthorizationFilter가 Authentication과 Request 규칙 비교
→ 허용되면 DispatcherServlet → Controller → Application
→ Request 종료 시 SecurityContextHolder 정리
```

### 1. Browser가 Cookie를 자동으로 첨부한다

Browser는 Domain·Path·SameSite·Secure 같은 조건에 맞으면 Session ID Cookie를 Request에 붙인다. 원문 Password를 다시 보내지 않는다.

### 2. Server가 `HttpSession`을 식별한다

Servlet Container는 Session ID를 사용해 Server-side `HttpSession`을 찾는다. Browser가 보내는 ID와 Server가 보관하는 Session 상태는 서로 다른 것이다.

Session이 만료됐거나 ID가 유효하지 않다면 기존 인증 상태를 찾을 수 없다. 이 경우 보호 API에서는 다시 인증이 필요한 요청으로 처리된다.

### 3. Repository가 `SecurityContext`를 불러온다

Session 기반 구성에서 `HttpSessionSecurityContextRepository`는 `HttpSession`에 연결된 `SecurityContext`를 찾는다. 현재 공식 문서의 기본 Repository 구성은 Request Attribute와 `HttpSession` 저장소를 함께 사용할 수 있지만, 여러 Request에 걸친 인증 지속을 담당하는 부분은 `HttpSession`이다.

### 4. 현재 Request의 `SecurityContextHolder`가 채워진다

`SecurityContextHolderFilter`는 Repository에서 찾은 Context를 현재 `SecurityContextHolder`에 연결한다. 기본 전략에서 `SecurityContextHolder`는 `ThreadLocal`을 사용하므로 같은 Request 실행 흐름의 Security·MVC·Application 구성요소가 현재 사용자를 조회할 수 있다.

`SecurityContextHolder`는 여러 Request 사이의 영속 저장소가 아니다. Request 처리가 끝나면 Thread Pool의 다음 Request와 인증 정보가 섞이지 않도록 Spring Security Filter Chain이 이를 정리한다.

### 5. Authorization이 매 Request마다 실행된다

`AuthorizationFilter`는 복원된 `Authentication`의 Authority와 현재 Method·Path 규칙을 비교한다. Login 성공은 신원을 확인했다는 뜻이지 모든 행동이 허용됐다는 뜻이 아니므로, 후속 Request마다 Authorization은 계속 필요하다.

### 6. 허용된 Request만 Application에 도달한다

규칙을 통과하면 Request가 `DispatcherServlet`, Controller와 Application으로 진행한다. 보안 단계에서 거절되면 Ticket의 존재 여부를 조회하는 Application Code까지 도달하지 않을 수 있다.

### 7. Password 검증은 반복하지 않는다

정상 Session에서 `Authentication`을 복원했다면 일반적인 후속 Request마다 `UserDetailsService`로 사용자를 다시 찾거나 `PasswordEncoder.matches`를 실행하지 않는다. 이것이 Password 없이 인증 상태를 이어 갈 수 있는 이유다.

그 결과 사용자 비활성화나 Role 변경을 기존 Session에 언제 반영할지는 별도 정책이 필요할 수 있다. 이번 Lab에서는 그 정책을 구현 범위에 넣지 않지만, “Authorization마다 반드시 Database와 대조한다”라고 가정하지 않는다.

## 과정 C — `401`·`403`·`200`은 어디에서 갈리는가

존재하는 `GET /api/tickets/{id}`를 기준으로 한다.

| 요청 상태 | `SecurityContextHolder`에서 보이는 상태 | 보안 결정 | 이 Lab의 HTTP 결과 |
|---|---|---|---:|
| 익명 | 유효한 인증 사용자 없음 | 인증부터 필요 | `401` |
| 로그인한 `USER` | 인증됨, `ROLE_USER` | 조회에 필요한 Role 부족 | `403` |
| 로그인한 `AGENT` | 인증됨, `ROLE_AGENT` | 조회 허용, Application 진입 | Ticket 존재 시 `200` |
| 로그인한 `AGENT`, 없는 Ticket | 인증됨, `ROLE_AGENT` | 보안 통과 뒤 Application이 조회 실패 판단 | `404` |

인가 단계가 익명 요청을 거절할 때 내부적으로 접근 거부 예외가 발생할 수 있다. `ExceptionTranslationFilter`는 현재 사용자가 인증되지 않았다면 `AuthenticationEntryPoint`를 시작하고, 이 Lab의 보호 API 계약에서는 `401`로 응답하게 한다. 이미 인증된 사용자의 권한이 부족하면 `AccessDeniedHandler`를 통해 `403`으로 응답한다.

Browser용 Form Login 설정은 같은 인증 필요 상황에서 Login Page로 `302` Redirect할 수 있다. 따라서 Browser Login 흐름과 JSON API의 `401` Entry Point를 구성과 Test에서 분리해야 한다.

## 같은 `403`이어도 원인은 다를 수 있다

| Request | 전제 | `403`의 원인 |
|---|---|---|
| 로그인한 `USER`의 `GET /api/tickets/{id}` | CSRF 검사 대상 아님 | 조회 Role 부족 |
| 권한 있는 사용자의 `POST /api/tickets`, CSRF Token 없음 | Authentication과 Role 충족 | CSRF 검증 실패 |
| 익명의 `POST /api/tickets`, CSRF Token 없음 | 인증도 없고 Token도 없음 | 먼저 실행된 CSRF Filter의 실패일 수 있어 인증 실패를 증명하지 못함 |

그래서 인증 실패는 먼저 보호된 `GET`으로 `401`을 확인한다. CSRF 실패는 인증과 허용 Role을 갖춘 사용자의 `POST`에서 Token 유무만 바꿔 확인한다. 하나의 Test에서 여러 실패 조건을 동시에 만들면 Status만으로 원인을 설명할 수 없다.

## 최소 Test 순서와 증명 범위

| 순서 | Test 조건 | 예상 | 이 Test가 증명하는 것 | 증명하지 않는 것 |
|---:|---|---:|---|---|
| 1 | Salt 기반 Encoder로 같은 가짜 Password를 두 번 Encode하고 각각 `matches` | 두 Encoding은 다르고 두 Match는 성공 | 선택한 Encoder의 Salt·검증 동작 | Login Filter·Session 동작 |
| 2 | 익명으로 보호된 Ticket `GET` | `401` | CSRF와 분리된 인증 필요 경계 | Password Login 성공 |
| 3 | 올바른 Test Credential로 Form Login | 성공 Handler 결과와 인증된 Session | Credential 검증과 인증 상태 저장 | 그 사용자의 모든 API 권한 |
| 4 | 3번의 같은 Session으로 Password 없이 보호 API 호출 | 사용자 Role에 맞는 결과 | Session에서 인증 상태 복원 | 새 Login Password 검증 |
| 5 | 로그인한 `USER`와 `AGENT`로 같은 Ticket `GET` | 각각 `403`, `200` | Server-side Role 검사 | CSRF 방어 |
| 6 | 인증·Role을 만족한 Ticket `POST`에서 CSRF Token만 누락·유효로 변경 | 각각 `403`, 기존 생성 결과 | CSRF Filter 경계 | 익명 인증 실패 |

Session Test의 핵심은 Session 내부 구현 필드 하나만 검사하는 것이 아니다. Login 결과의 동일 Session을 후속 Request에 사용했을 때 Password 없이 보호 API가 예상 권한으로 처리되는지를 관찰해야 한다.

## 자주 혼동하는 문장 교정

| 혼동하기 쉬운 문장 | 더 정확한 설명 |
|---|---|
| Server는 Session ID만 저장한다. | Browser는 Session ID Cookie를 보관하고, Server는 그 ID로 찾는 `HttpSession` 상태에 `SecurityContext`를 연결한다. |
| Session ID가 곧 `SecurityContext`다. | Session ID는 Server-side Session을 찾는 참조 Credential이고 `SecurityContext`는 Session에 연결된 인증 상태다. |
| `SecurityContextHolder`가 Login 상태를 계속 저장한다. | Holder는 현재 Request의 실행 흐름에서 Context를 제공하고, 여러 Request 사이의 지속은 `SecurityContextRepository`와 `HttpSession`이 담당한다. |
| 후속 Request마다 Password를 다시 Hash한다. | 정상 Session을 찾으면 저장된 `Authentication`을 복원하므로 Password 검증을 반복하지 않는다. |
| Authorization은 매번 사용자 DB를 조회한다. | 이번 Session 흐름은 복원된 `Authentication`의 Authority와 Request 규칙을 비교하며, DB 재조회 여부는 별도 설계다. |
| `403`이면 Role이 부족하다. | Role 부족과 CSRF 실패가 모두 `403`일 수 있으므로 인증 상태·Method·Token 조건을 함께 본다. |
| Cookie가 있으면 Login된 상태다. | 익명 상태에서도 CSRF나 Request Cache 때문에 Session이 생길 수 있어, 후속 보호 Request에서 인증 복원을 확인해야 한다. |

## Version에 따라 혼동하기 쉬운 부분

오래된 자료는 `SecurityContextPersistenceFilter`가 Context를 불러오고 Request 종료 때 자동 저장하는 흐름을 주로 설명한다. 현재 Spring Security 공식 문서는 `SecurityContextHolderFilter`가 Repository에서 Context를 불러오며, 이 Filter 자체는 저장하지 않는다는 점을 구분한다.

두 Filter가 항상 함께 순서대로 실행된다고 외우지 않는다. 실제로 어떤 Filter와 저장 방식이 사용되는지는 Spring Security Version과 설정에 따라 확인해야 한다. 기본 Form Login과 달리 인증을 직접 구현하는 경우에는 성공한 `SecurityContext`를 `SecurityContextRepository`에 명시적으로 저장할 책임을 빠뜨리지 않아야 한다.

Lab의 Dependency Tree에서 Spring Security 7.1.1 해석을 확인했고, Starter 단독 상태의 실제 Context Test에서 Default `/login` Redirect를 관찰했다. 이것은 Default Filter Chain이 적용된 근거지만 아래에서 설명한 명시적 Login·Session 저장 흐름을 구현·검증한 근거는 아니다. 세부 실행 결과는 [Spring Security Baseline Lab Report](../lab-reports/2026-09-12-spring-security-baseline-lab.md)에 분리해 기록한다.

## 학습 점검 질문

1. Login Filter가 처음 만드는 `Authentication`과 성공 뒤 반환되는 `Authentication`은 무엇이 다른가?
2. `UserDetailsService`와 `PasswordEncoder`는 Login 과정에서 각각 무엇을 입력받고 무엇을 판단하는가?
3. `SecurityContextHolder`와 `HttpSession`은 저장 위치와 수명이 어떻게 다른가?
4. Login 성공 뒤 Browser와 Server는 각각 무엇을 보관하는가?
5. 후속 Request에서 `PasswordEncoder.matches`가 다시 실행되지 않아도 되는 이유는 무엇인가?
6. Session 방식에서 Authorization이 매 Request마다 실행돼도 사용자 Database 조회는 매번 필요하지 않을 수 있는 이유는 무엇인가?
7. 같은 `403`인 Role 부족과 CSRF 실패를 Test 조건으로 어떻게 구분할 수 있는가?
8. `Session ID → HttpSession → SecurityContext → SecurityContextHolder → Authorization`을 각 단계의 주체와 함께 설명할 수 있는가?

## 완료와 근거의 경계

- 이 문서를 작성하고 읽은 것만으로 사용자가 인증 과정을 이해했다고 판정하지 않는다.
- 사용자가 위 과정을 자신의 말로 다시 설명하면 개념 이해 근거가 된다.
- Spring Security Starter는 추가했지만 명시적 Security 구성과 Password·사용자·Role 구현은 `NOT_IMPLEMENTED`다.
- Login·Session·Role·CSRF Integration Test는 여전히 `NOT_RUN`이다.
- Default Filter Chain의 `/login` Redirect는 관찰했지만, Login 이후 Session ID 변화와 Cookie 속성은 여전히 `NOT_RUN`이다.

## 참고 자료

- [Spring Security — Servlet Authentication Architecture](https://docs.spring.io/spring-security/reference/servlet/authentication/architecture.html)
- [Spring Security — Form Login](https://docs.spring.io/spring-security/reference/servlet/authentication/passwords/form.html)
- [Spring Security — DaoAuthenticationProvider](https://docs.spring.io/spring-security/reference/servlet/authentication/passwords/dao-authentication-provider.html)
- [Spring Security — Persisting Authentication](https://docs.spring.io/spring-security/reference/servlet/authentication/persistence.html)
- [Spring Security — Authentication Persistence and Session Management](https://docs.spring.io/spring-security/reference/servlet/authentication/session-management.html)
- [Spring Security — Servlet Architecture](https://docs.spring.io/spring-security/reference/servlet/architecture.html)
