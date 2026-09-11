# 2026-09-11 — 회상 Gate와 Security Baseline 준비

> 날짜: 2026-09-11
> 상태: Closed — 자정을 넘긴 연장 Session의 개념 Gate·Security 의존성 단독 실험까지 기록
> 구현 상태: Starter 추가, 명시적 Security 계약 `NOT_IMPLEMENTED`
> 검증 상태: 변경 전 33개 통과; Starter 단독 상태 33개 중 31개 통과·2개 실패
> 이월: 명시적 Security 계약과 Login·Session·Role·CSRF는 2026-09-12 학습으로 이동

## 목적

9월 7일에 학습한 인증·인가, Password 검증, Session 복원과 CSRF 경계를 문서를 보지 않고 다시 설명한다. 회상 답변에서 개념 공백이 확인되면 구현을 먼저 진행하지 않고, 실패를 일으킨 계층과 HTTP Status를 구분할 수 있을 때까지 설명을 보완한다.

## 시작 상태

- WIL Repository와 AI Helpdesk Lab의 Working Tree는 학습 시작 시 Clean이었다.
- AI Helpdesk Lab에는 Spring Security 의존성·설정과 Security Integration Test가 아직 없다.
- 9월 7일에 통과한 기존 Java Test 33개는 Security 추가 전 In-memory Application 회귀 기준선이다.
- 학습 시작 시점에는 오늘 Test를 아직 실행하지 않았으므로, 9월 7일의 33개 통과를 9월 11일 실행 결과나 Security 근거로 대신 사용하지 않았다. 이후 23:40 KST에 변경 전 Baseline을 별도로 재실행한 결과는 아래에 기록한다.

## 문서를 보지 않고 한 최초 답변

| 질문 | 최초 답변 | 판정 |
|---|---|---|
| 존재하는 Ticket을 조회할 때 익명·`USER`·`AGENT`의 Status | "익명: 404(존재성도 감추기 위해), USER 403(권한 없음), AGEN 201(조회 성공)" | 보완 필요 |
| Session ID부터 `SecurityContextHolder`까지 인증 상태 복원 | "잘 모르겠습니다." | 다시 학습 필요 |
| 같은 Password의 두 Encoding이 달라도 `matches`가 모두 성공하는 이유 | "matches 가 한 번 더 인코딩을 해서 그 결과값이 같은지 여부를 확인하기 때문" | 일부 이해, 핵심 조건 보완 필요 |
| 익명 인증 실패 검증에서 CSRF Token 없는 POST보다 GET을 먼저 쓰는 이유 | "CSRF를 방어하기 위해해" | 질문의 Test 격리 이유를 설명하지 못함 |

이 표의 최초 답변은 사용자가 직접 회상한 범위다. 아래 교정 내용은 학습 안내이며, 사용자가 다시 설명하기 전에는 사용자의 이해로 간주하지 않는다.

## 교정 1 — HTTP Status는 정책과 요청 결과를 함께 본다

이번 Lab에서 이미 정한 최소 권한 계약은 다음과 같다.

| 존재하는 Ticket 단건 조회 | 결과 | 이유 |
|---|---:|---|
| 익명 | `401 Unauthorized` | 보호 자원에 필요한 인증 정보가 없음 |
| 로그인한 `USER` | `403 Forbidden` | 인증됐지만 조회 Role이 없음 |
| 로그인한 `AGENT` | `200 OK` | 인증과 조회 권한을 모두 통과해 기존 자원을 반환함 |

`404 Not Found`로 자원 존재 여부를 감추는 정책도 다른 시스템에서는 선택할 수 있다. 그러나 이번 Lab은 인증 실패와 인가 실패를 Test에서 분리해 관찰하려고 `401`과 `403`을 명시적으로 사용한다. `201 Created`는 새 자원을 만든 성공 응답이므로 기존 Ticket을 조회하는 `GET`의 성공 Status가 아니다.

## 교정 2 — Session 인증 상태 복원 순서

로그인 성공 뒤의 핵심 흐름은 다음과 같다.

    Browser의 Session ID Cookie
        → Server가 해당 HttpSession 식별
        → SecurityContextRepository가 SecurityContext 조회
        → 요청 처리 Thread의 SecurityContextHolder에 복원
        → Authorization이 Authentication과 Authority를 사용해 접근 결정

Browser는 Password 대신 Session ID Cookie를 후속 요청에 자동으로 보낸다. Server는 Session ID 자체를 사용자 정보로 간주하는 것이 아니라, 그 ID로 찾은 `HttpSession`에서 인증 정보가 든 `SecurityContext`를 불러온다. 요청이 끝나면 Thread에 묶인 Context는 정리되어 다음 요청과 섞이지 않아야 한다.

최초 Login의 Password 검증부터 후속 Request의 Context 복원까지는 [Form Login과 Session 인증 과정](../study-docs/session-authentication-flow.md)에서 구성요소별로 다시 학습한다.

## 교정 3 — `matches`는 새 Salt로 일반 `encode`를 반복하지 않는다

Salt 기반 Password Encoder에서 저장된 Encoding에는 검증에 필요한 Salt와 Algorithm Parameter가 함께 들어 있다. `matches(candidate, encoded)`는 다음과 같이 동작한다.

1. 저장된 `encoded`에서 Salt와 Algorithm Parameter를 읽는다.
2. 입력받은 원문 후보에 그 Salt와 Parameter를 적용해 단방향 계산을 수행한다.
3. 계산 결과를 저장된 결과와 안전하게 비교한다.

검증 때 새 무작위 Salt를 만들어 일반 `encode`를 다시 호출한다면 결과가 달라져 비교할 수 없다. 저장된 값을 복호화할 필요도 없다. 각 Encoding은 자기 안에 든 서로 다른 Salt로 같은 원문 후보를 검증하므로, 두 문자열이 달라도 같은 원문에 대해 각각 `matches`가 성공할 수 있다.

## 교정 4 — GET을 먼저 쓰는 이유는 검증 변수 격리다

CSRF는 Browser가 Session Cookie 같은 Credential을 자동 첨부하는 점을 악용한 상태 변경 요청을 막는다. 그러나 익명 인증 실패를 확인하는 첫 Test에서 CSRF Token 없는 `POST`를 사용하면, CSRF Filter가 인증·인가 판단보다 먼저 요청을 `403`으로 거절할 수 있다.

이때 관찰한 `403`만으로는 "익명이라서 인증에 실패했다"고 증명할 수 없다. 일반적으로 CSRF 검사 대상이 아닌 보호된 `GET`을 먼저 호출하면 CSRF 변수를 제거하고 인증 정보 부재가 `401`을 만드는지 확인할 수 있다. 그 다음 인증된 사용자의 `POST`에서 Token 없음과 유효 Token을 비교해야 CSRF 경계를 별도로 증명할 수 있다.

## 재설명 Gate — 1차

### 질문 1 — `401`·`403`·`200`

사용자 재답변:

> 401 사용자 인증정보가 없어 접근 권한이 없음, 403 사용자 인증은 되었지만 티켓 소유주가 앙니라 티켓 접근 권한 없음, 200 성공

판정: `PARTIALLY_CORRECT`

- 익명의 `401`, `AGENT` 조회 성공의 `200`은 맞다.
- `401`은 Role에 따른 접근 권한 부족보다 유효한 인증 Credential이 없다는 데 초점을 둔다. Role이 부족한 인증 사용자의 실패가 `403`이다.
- 이번 Lab은 Ticket 소유권을 설계하거나 구현하지 않았다. 로그인한 `USER`가 `403`을 받는 이유는 소유주가 아니어서가 아니라, 조회에 필요한 `AGENT` Role이 없기 때문이다.

### 질문 2 — Session 인증 복원

사용자 재답변:

> 세션 ID를 통해 HttpSession 찾기, SecurityContext 꺼내기, SecurityContextHolder에 올리기

판정: 순서 회상 `PASS`, 구성요소 역할 이해 `REVIEW_IN_PROGRESS`

- 질문에서 요구한 `Session ID → HttpSession → SecurityContext → SecurityContextHolder` 순서를 정확히 설명했다.
- 더 자세히 말하면 Browser가 Cookie로 Session ID를 보내고, Servlet Container와 `SecurityContextRepository`가 Session의 Context를 찾아 현재 Request의 Holder에 복원한다.
- 후속 Request에서는 이 인증 상태를 사용하므로 Password를 다시 검증하지 않는다.
- 후속 확인에서 사용자는 순서는 말할 수 있지만 각 구성요소의 역할과 전체 인과관계는 아직 충분히 이해되지 않는다고 밝혔다. 따라서 순서 회상을 전체 개념 Gate 통과로 확대하지 않는다.
- 초심자용 설명을 학습한 뒤 “왜 `HttpSession`과 `SecurityContextHolder`가 둘 다 필요한가”까지 자신의 말로 설명하면 역할 이해를 다시 판정한다.

### 질문 3 — 저장된 Salt와 복호화 없는 검증

사용자 재답변:

> 저장된 Salt를 사용하며, Salt가 달라지면 결과값도 달라지기 때문에 복호화를 통해 원문 패스워드를 알 필요가 없음.

판정: `PARTIALLY_CORRECT`

- `matches`가 새 Salt가 아니라 저장된 Encoding의 Salt를 사용한다는 답은 맞다.
- Salt가 다르면 결과가 달라진다는 사실만으로 복호화가 불필요한 이유가 설명되지는 않는다.
- 직접 이유는 원문 후보에 저장된 Salt·Algorithm Parameter를 적용해 단방향 계산을 다시 수행하고, 그 계산 결과를 저장된 Digest와 비교할 수 있기 때문이다.

### 질문 4 — CSRF `403`과 인증 실패

사용자 재답변:

> 이미 정상적으로 로그인한(인증된) 사용자가 브라우저에서 올바른 폼이 아닌 경로로 POST 요청을 보내거나, 세션에 저장된 토큰과 전송된 토큰이 일치하지 않으면 403 에러가 발생합니다.

판정: `PARTIALLY_CORRECT`

- 인증된 사용자도 CSRF Token 누락·불일치로 `403`을 받을 수 있다는 핵심은 맞다. 따라서 `403` 자체가 인증 실패를 뜻하지 않는다는 방향도 맞다.
- CSRF 실패 조건은 “올바른 Form 경로인가”가 아니라 Server가 기대한 Token과 Request가 제출한 Token이 유효하게 일치하는가이다. 같은 Site의 정상 URI라도 Token이 없거나 틀리면 실패할 수 있다.
- 익명이면서 CSRF Token도 없는 `POST`에는 두 실패 조건이 동시에 있다. CSRF Filter가 먼저 `403`을 만들 수 있으므로 이 결과로 인증 실패를 증명할 수 없다. 보호된 `GET`으로 CSRF 변수를 제거해야 인증 부재의 `401`을 분리할 수 있다.

## 재설명 Gate — 2차

### 질문 1 — `USER` 조회의 `403`

사용자 재답변:

> 인증은 되었으나 인가가 없기 때문입니다.

판정: `PASS_WITH_PRECISION`

- 인증과 인가를 구분하고, 인증 성공만으로 조회가 허용되지 않는다는 핵심은 맞다.
- 더 정확히는 인가 자체가 없는 것이 아니라 인가 판단은 실행됐지만, `USER`의 `Authentication`에 조회 규칙이 요구하는 `AGENT` Authority가 없어 거부된 것이다.
- 이번 Lab에 없는 Ticket 소유권을 이유로 들지 않았으므로 이전 혼동은 교정됐다.

### 질문 2 — Session 인증 복원 순서

사용자 재답변:

> 세션 ID를 통해 HttpSession 찾기, SecurityContext 꺼내기, SecurityContextHolder에 올리기

판정: `PASS_FOR_SEQUENCE`

- 질문에서 요구한 `Session ID → HttpSession → SecurityContext → SecurityContextHolder` 순서는 정확하다.
- 현재 구현 재개 Gate는 새 교육자료에 맞춰 각 구성요소의 역할과 수명까지 요구한다. 이번 답변에는 그 설명이 없으므로 전체 Session 항목은 아직 완료 처리하지 않는다.

### 질문 3 — 저장된 값으로 수행하는 단방향 검증

사용자 재답변:

> Salt 와 Parameter 로 단방향 계산한 뒤에 저장된 Digest와 비교합니다.

판정: `PASS`

- 앞선 답변에서 확인한 것처럼 새 Salt가 아니라 저장된 Encoding의 Salt·Parameter를 사용한다.
- 입력받은 원문 후보를 앞 방향으로 계산해 저장된 Digest와 비교한다는 직접 이유를 설명했으므로 복호화 없는 검증을 이해한 것으로 판정한다.

### 질문 4 — CSRF 실패와 인증 실패의 Test 격리

사용자 재답변:

> 동일한 정상 URI라도 Token이 없거나 일치하지 않으면 실패합니다.

판정: `NOT_YET_COMPLETE`

- 정상 URI에서도 CSRF Token 누락·불일치가 실패를 만든다는 점은 맞다.
- 그러나 익명이고 Token도 없는 `POST`에는 “인증 정보 없음”과 “CSRF Token 없음”이라는 두 실패 조건이 동시에 있다는 설명이 빠졌다.
- 이 `POST`의 `403`은 CSRF Filter가 먼저 거절한 결과일 수 있으므로 인증 실패를 증명하지 못한다. 보호된 `GET`은 일반적으로 CSRF 검사 대상이 아니어서 CSRF 조건을 제거하고, 인증 정보가 없을 때 `401`이 되는지만 확인할 수 있다.

## 재설명 Gate — 최종

### 질문 1 — Session 구성요소의 역할과 수명

사용자 재답변:

> Session ID Cookie는 세션 ID를 보관합니다. 브라우저 종료시점 또는 쿠키 만료시점까지입니다. HttpSession은 로그인 상태, 유저 프로필 등 서버가 클라이언트별로 유지해야 하는 영속적 상태 값을 보관합니다. 기한은 사용자 로그아웃 요청 또는 지정된 타임아웃까지입니다. SecurityContextHolder는 현재 요청을 처리 중인 스레드의 인증 정보 객체(Authentication)를 보관하며, 단일 HTTP 요청에 한정하여 보관합니다.

판정: `PASS_WITH_CORRECTION`

- Browser의 Session ID Cookie, Server의 Session 상태, 현재 Request Thread의 인증 상태를 위치와 수명으로 나눈 핵심은 맞다.
- Session Cookie는 `Max-Age`·`Expires`가 없는 경우 일반적으로 Browser Session 동안 유지되지만, 실제 종료·복원 동작과 만료는 Cookie 설정 및 Browser 정책에 따라 달라진다.
- `HttpSession`은 Database 같은 영속 저장소가 아니라 만료·무효화될 수 있는 Server-side 상태다. 이 학습에서 중요한 값은 Session에 연결된 `SecurityContext`이며, 수명은 Logout에 따른 무효화, 설정된 Timeout과 실제 Session 저장 방식의 영향을 받는다.
- `SecurityContextHolder`는 `Authentication`을 직접 보관한다고 줄여 말할 수 있지만, 정확히는 `Authentication`을 포함한 `SecurityContext`를 현재 Request의 Thread에 연결한다. 기본 전략에서는 Request가 끝나면 정리된다.

### 질문 2 — CSRF와 인증 실패 조건 분리

사용자 재답변:

> 익명(인증되지 않은) 사용자가 CSRF 토큰 없이 POST 요청을 보낼 경우 인증 실패로 401이 되거나 CSRF 검증 실패로 403이 됩니다. 보호된 GET 요청은 데이터의 '조회' 목적이므로 Spring Security의 CSRF 검증 대상에서 제외됩니다. 즉, 위의 두 실패 조건 중 'CSRF 검증 실패' 조건이 제거되며, 오직 인증 실패 조건만 남게 됩니다.

판정: `PASS_WITH_CORRECTION`

- 하나의 익명 `POST`에 인증 정보 부재와 CSRF Token 부재라는 두 실패 조건이 동시에 있음을 구분했다.
- 보호된 `GET`에서 CSRF 조건을 제거하면 인증 정보 부재만 남고, 이 Lab의 계약상 `401`을 확인할 수 있다는 Test 격리를 정확히 설명했다.
- 같은 `POST`가 임의로 `401` 또는 `403` 중 하나를 선택하는 것은 아니다. 실제로 어느 Filter가 먼저 응답을 만드는지는 구성된 Filter Chain 순서와 Handler에 따라 결정된다. 구현 전 예상은 CSRF Filter가 먼저 누락을 발견해 `403`을 만드는 것이며, 실제 결과는 Integration Test로 확인한다.
- `GET`을 CSRF 검사에서 제외하는 근거는 단순히 이름이 조회이기 때문이 아니라, Server 상태를 바꾸지 않는 Safe Method로 사용해야 한다는 HTTP 의미와 Spring Security의 기본 보호 정책에 있다. 상태를 변경하는 `GET`을 만들면 안 된다.

## 구현 재개 Gate

다음 네 항목을 문서 없이 다시 설명할 수 있을 때 Security Baseline 구현을 시작한다.

- [x] 존재하는 Ticket 조회에서 익명·`USER`·`AGENT`가 각각 `401`·`403`·`200`을 받는 이유와 `201`이 아닌 이유
- [x] Session ID Cookie에서 `HttpSession`·`SecurityContext`·`SecurityContextHolder`로 이어지는 순서와 각 구성요소의 역할·수명
- [x] `matches`가 새 Salt가 아니라 저장된 Encoding의 Salt·Parameter를 사용하는 이유
- [x] CSRF Token 없는 `POST`의 `403`이 인증 실패를 증명하지 못하며, 보호된 `GET`이 인증 변수를 먼저 격리하는 이유

현재 판정은 `READY_FOR_IMPLEMENTATION`이다. 네 개념을 사용자가 자신의 말로 다시 설명했으므로 Security Baseline 구현을 시작할 수 있다.

다음 작업은 Security 의존성 추가, Password 검증 Test, 익명 `GET`의 `401`, Login Session 재사용, `USER`·`AGENT` Role Matrix, 인증된 `POST`의 CSRF 비교 순서로 진행한다.

## 구현 전 Test 경계 Gate — 1차

질문:

> `standaloneSetup`을 사용하는 `TicketControllerTest`가 계속 통과하더라도, 왜 그것만으로 Spring Security가 제대로 적용됐다고 증명할 수 없는가?

사용자 답변:

> 잘 모르겠습니다. 검색한 결과 `MockMvcBuilders.standaloneSetup()`은 Spring Security의 필터 체인(Filter Chain)을 완전히 배제한 채 컨트롤러 단독으로만 테스트를 수행하기 때문이라고 합니다.

판정: `TECHNICALLY_CORRECT_BUT_NOT_YET_OWN_EXPLANATION`

- 현재 `TicketControllerTest`는 Controller, Application Service와 Exception Handler를 직접 조립한 `MockMvc`다. Spring Application Context를 불러오지 않고 Security Filter도 명시적으로 추가하지 않았으므로 실제 `SecurityFilterChain`을 통과하지 않는다.
- 따라서 실제 Application의 익명 요청이 Security 단계에서 `401`로 차단되더라도, Standalone Test의 같은 Controller 호출은 Security가 없는 상태로 Controller까지 진행해 기존 `200`·`201`·`404` 계약을 계속 확인할 수 있다.
- “완전히 배제한다”는 표현은 일반화하면 지나치다. `standaloneSetup`에도 Filter를 직접 추가할 수 있지만, 자동으로 Application의 `FilterChainProxy`를 찾아 적용하지 않는다. 현재 Test에는 그런 명시적 추가가 없다.
- 이 Test가 계속 가치 없는 것은 아니다. Validation, HTTP 변환, Controller Advice와 Application 결과의 Web 계약을 빠르게 확인하는 책임으로 유지한다.
- Security 동작 근거는 실제 Spring Context와 Filter Chain을 포함하는 별도 Integration Test에서 확보한다.

검색으로 찾은 설명은 기술 방향을 확인하는 자료이며 그 자체를 사용자의 이해 완료로 처리하지 않는다. 다음 Gate에서는 “실제 익명 Request는 `401`인데 Standalone Test의 기존 Ticket 조회는 `200`일 수 있는 이유”를 자신의 말로 설명한다.

관련 교육자료: [Authentication·Authorization과 401·403 — MockMvc Test 경계](../study-docs/authentication-authorization.md)

## 구현 전 Test 경계 Gate — 최종

사용자 재답변:

> 두 결과가 모순되지 않는 이유는 각 테스트가 바라보고 검증하는 대상(Layer)이 완전히 다르기 때문입니다. 실제 환경의 `401 Unauthorized`는 컨트롤러 이전 단계의 보안 필터 체인이 내린 결과이고, `standaloneSetup` 기반 테스트의 `200 OK`는 필터가 배제된 상태에서 컨트롤러 자체의 비즈니스 로직이 정상 수행된 결과입니다.

판정: `PASS_WITH_CORRECTION`

- Security Filter Chain의 `401`과 Standalone Test의 `200`이 서로 다른 Layer와 System Boundary의 결과이므로 모순되지 않는다는 핵심을 자신의 말로 설명했다.
- Controller에는 비즈니스 로직을 두지 않는 현재 Architecture를 유지한다. Standalone Test의 `200`은 “Controller 자체의 비즈니스 로직”보다 “Security 선행 조건을 제외한 Controller의 HTTP 변환과 Application Service 위임이 정상”인 결과라고 표현하는 것이 정확하다.
- Test 경계 Gate를 완료한다. 기존 Standalone Controller Test는 Web 계약 근거로 유지하고, Security 근거는 실제 Filter Chain을 포함한 Integration Test로 별도 확보한다.

## Security 변경 전 Baseline 재실행

2026-09-11 23:40 KST에 AI Helpdesk Lab Root에서 다음 명령을 실행했다.

```powershell
.\mvnw.cmd test
```

| 관찰 항목 | 실제 결과 | 해석 |
|---|---|---|
| 전체 Test | 33개 실행, 실패 0, 오류 0, 건너뜀 0, `BUILD SUCCESS` | Security 변경 전 현재 회귀 기준선 확인 |
| 실행 환경 표시 | Spring Boot 4.1.1, Java 25.0.4 | 현재 Test Process가 표시한 Version |
| 대표 Repository 실패 Log | `simulated repository failure` Stack Trace 출력 뒤 전체 Test 성공 | 의도한 `500` Test Fixture이며 Build 실패가 아님 |
| Mockito Agent 경고 | Dynamic Agent Loading 관련 경고 출력 | 현재 Test 실패는 아니며 Security 구현 결과와 무관 |

이 실행 시점에도 Spring Security Dependency와 설정은 없다. 따라서 33개 통과는 기존 In-memory Application의 Domain·Application·Web 계약 및 Web Infrastructure 회귀 근거일 뿐, 인증·인가·Session·CSRF가 동작한다는 근거가 아니다.

## 9월 11일 연장 Gate — Default Security와 비즈니스 계약

질문:

> Spring Security 기본 설정이 의존성 추가 직후 요청을 막아 주더라도, 왜 그 결과만으로 이번 Lab의 `401`·`403` 계약이 구현됐다고 판단하면 안 될까요?

사용자 답변:

> 의존성 추가 직후 모든 요청이 막히는 것은 Spring Security의 '기본 자동 설정(Default Auto-Configuration)'이 작동한 결과일 뿐, 비즈니스 계약이 올바르게 구현되었음을 의미하지 않기 때문입니다.

판정: `PASS`

- Framework의 Default 동작과 이 Lab이 결정한 접근 제어 정책을 구분했다.
- 단순히 요청이 거부됐다는 사실만으로는 익명 `401`, 인증됐지만 권한 없는 사용자 `403`, 허용된 사용자 `200`이라는 계약을 증명할 수 없다.
- 어떤 Endpoint가 공개·보호 대상인지, 어떤 Role이 허용되는지, 인증 실패와 인가 실패가 정확히 구분되는지를 실제 Filter Chain을 통과하는 Test로 검증해야 구현 근거가 된다.
- 따라서 의존성 추가 직후의 결과는 자동 설정을 관찰한 근거이고, 명시적인 Security 설정과 Role Matrix Test가 통과한 결과가 이번 Lab의 계약 근거다.

실제 후속 실험에서도 이 구분을 확인했다. Starter만 추가하자 Standalone Controller Test 7개는 통과했지만 실제 Context Test 2개는 기존 `404` 대신 `/login` Redirect `302`를 반환해 실패했다. 상세 명령과 결과는 [Security Test 실행 근거](../study-docs/security-test-evidence.md)에 기록한다.

## 9월 11일 연장 Gate — SavedRequest와 인증 상태

질문:

> `SavedRequest`가 담긴 Session과 인증된 `SecurityContext`가 담긴 Session은 어떻게 다른가요?

사용자 답변:

> `SavedRequest`가 담긴 Session은 사용자가 인증 전에 가려고 했던 원래의 목적지(URL, 파라미터 등)를 기억했다가, 로그인 성공 후 그곳으로 보내주기 위한 것이고, `SecurityContext`가 담긴 Session은 이미 인증을 마친 사용자의 신원과 권한 정보(`Authentication`)를 유지하여, 다음 요청부터 매번 로그인하지 않게 하기 위한 것입니다.

판정: `PASS`

- `SavedRequest`가 인증 정보가 아니라 Login 성공 후 돌아갈 Request 정보라는 점을 구분했다.
- 인증된 `SecurityContext`에는 사용자의 신원과 Authority를 나타내는 `Authentication`이 있으며, 후속 Request의 인증 복원에 사용된다는 점을 설명했다.
- 따라서 Session이나 Session ID가 존재한다는 사실만으로 인증 완료를 주장하지 않고, 인증된 `SecurityContext`의 저장·복원 또는 후속 보호 Request 성공을 별도로 검증해야 한다.

## 9월 11일 Session 마감과 이월

자정을 넘긴 대화와 실험이지만 이 지점까지를 9월 11일 학습의 연장선으로 묶는다. 단, 실행 근거의 실제 시각은 바꾸지 않는다.

9월 11일에 완료한 범위:

- 인증·인가·Session·Password·CSRF 회상과 재설명 Gate
- Standalone Controller Test와 실제 Security Filter Chain Test의 책임 구분
- Security 변경 전 전체 Test 33개 통과 재확인
- Security Starter 추가와 Spring Security 7.1.1 해석 확인
- Default `/login` Redirect `302`와 실제 Context Test 2개 실패 관찰
- `SavedRequest`가 있는 Session과 인증된 `SecurityContext`가 있는 Session 구분

9월 12일로 옮긴 범위:

- Security Test 지원 의존성과 명시적 `SecurityFilterChain`
- API `401`과 권한 부족 `403`
- `PasswordEncoder`와 학습용 `USER`·`AGENT`
- Login 성공·실패와 Session 재사용
- Role Matrix, CSRF 비교, 전체 Green 회귀와 WIL

상세 실행 순서는 [2026-09-12 학습 계획](./2026-09-12-study-questions.md)에 기록한다.

## 근거 경계

- 사용자 근거: 위 최초 답변과 이후 사용자가 직접 다시 설명한 내용
- 학습 안내: 이 문서의 교정 설명
- 구현 근거: Security Starter만 추가; 명시적 Security 구성·Password·사용자·Role은 `NOT_IMPLEMENTED`
- 2026-09-11 Test 근거: 23:40 KST Security 변경 전 In-memory Java Test 33개 통과·실패 0·오류 0·건너뜀 0
- 9월 11일 연장 Session의 실제 실행 근거: 2026-09-12 00:41 KST 변경 전 33개 통과, 00:42 KST Starter 단독 상태 33개 중 31개 통과·2개 실패·오류 0·건너뜀 0
- 과거 회귀 근거: 2026-09-07 Security 추가 전 In-memory Java Test 33개 통과
- PostgreSQL Adapter와 Database Integration Test: 이번 학습 범위가 아니며 여전히 구현·실행 근거 없음
