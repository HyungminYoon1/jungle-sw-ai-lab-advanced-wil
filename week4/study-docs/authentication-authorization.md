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

## 실패·반례와 자주 발생하는 오해

| 오해·잘못된 사용 | 수정된 이해 |
|---|---|
| Login 성공이 곧 모든 API 허용을 뜻한다. | Login은 Authentication만 만든다. 각 요청의 Authorization은 계속 필요하다. |
| UI에서 조회 버튼을 숨기면 인가가 끝난다. | Client UI는 우회할 수 있으므로 Server가 직접 API 요청을 검사해야 한다. |
| 모든 보안 `403`은 Role 부족이다. | CSRF 실패도 `403`일 수 있으므로 인증 상태·Method·Token 조건을 함께 본다. |
| Controller에서 Role별 `if`를 작성하면 된다. | HTTP 접근 규칙은 Security Filter Chain에서 먼저 검사하고 Domain·Application 책임과 분리한다. |
| Security를 추가한 뒤 기존 `404` Test가 `401`이 되면 무조건 회귀다. | 익명 요청이 Controller 전에 차단된 의도한 계약 변경인지 먼저 확인한다. |

## 학습 점검 질문

1. 이 Lab의 Role Matrix에서 로그인하지 않은 사용자의 없는 Ticket 조회가 기존 `404`가 아니라 `401`이 되어야 하는 이유는 무엇인가?
2. 로그인한 `USER`와 `AGENT`가 같은 조회 URI에서 서로 다른 결과를 받는 결정 지점은 어디인가?
3. 익명 `POST`의 인증 실패를 확인할 때 왜 유효한 CSRF Token을 넣어야 하는가?
4. Form Login의 기본 Redirect와 보호 API의 `401`을 어떻게 분리할 것인가?

## 자료 범위

- 포함: Servlet Filter 기반 인증·인가 흐름, `401`·`403`, 최소 Role Matrix와 Test 조건
- 포함하지 않음: OAuth2·JWT, Method Security, Resource 소유권, 다중 Organization과 Production 권한 모델

## 참고 자료

- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [Spring Security — Servlet Architecture](https://docs.spring.io/spring-security/reference/servlet/architecture.html)
- [Spring Security — Authorize HTTP Requests](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)
- [Spring Security — Form Login](https://docs.spring.io/spring-security/reference/servlet/authentication/passwords/form.html)
