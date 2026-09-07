# 2026-09-07 — Week 4 인증·인가 개념과 Security Test 계약

> 작성일: 2026-09-07
> Baseline 실행: 2026-09-07 19:23 KST
> 목적: Week 4 전체 학습 흐름을 확인하고, 인증·인가·Password·Session·CSRF의 최초 이해를 점검한 뒤 Spring Security 구현 전 실패 Test 계약을 확정한다.
> 상태: Completed — 9월 7일 개념 Gate·Security 구현 전 Baseline·Red Test 계약 완료

---

## 이번 주 학습 지도

| 날짜 | 핵심 질문 | 수행 범위 | 종료 근거 |
|---|---|---|---|
| 9월 7일 월요일 | 인증·인가·Session·CSRF가 한 요청에서 어떤 순서로 작동하는가 | 개념·공식 자료, 기존 Test Baseline, Role Matrix와 Red Test 계약 | 자신의 최초 답변과 교정, 현재 33개 Test, 구현 전 Test 목록 |
| 9월 11일 금요일 | Password 검증과 Login 성공을 후속 요청까지 어떻게 이어 가는가 | Security 의존성, `PasswordEncoder`, Form Login, Session Integration Test | 해석된 Version, Login 성공·실패와 Session 재사용 Test |
| 9월 12일 토요일 | 인증된 사용자의 권한 우회와 위조 요청을 어디에서 막는가 | Role Matrix, `401`·`403`, CSRF 누락·정상, 전체 회귀와 WIL | Security Filter를 포함한 Test, Secret 점검과 WIL |

화요일부터 목요일까지는 계획된 학습 Block이 없다. 월요일 미완료를 숨겨서 누적하지 않고 금요일 첫 Block에서 남은 질문과 Must 범위를 다시 확인한다.

## 오늘의 질문

> 인증되지 않은 요청, 인증됐지만 권한이 부족한 요청, 인증됐지만 CSRF Token이 없는 요청은 각각 어디에서 왜 실패하는가?

## 오늘의 완료 기준

- 아래 최초 답변을 자료 없이 작성하고 이후 교정과 구분한다.
- Authentication과 Authorization, `401`과 `403`을 Ticket API Case로 설명한다.
- PasswordEncoder·Session·Cookie·CSRF의 역할을 한 흐름으로 연결한다.
- 기존 Application Test를 현재 시점에 다시 실행한다.
- 금요일·토요일에 작성할 Security Test 이름, 조건과 예상 결과를 먼저 고정한다.
- Spring Security Production Code와 의존성은 오늘 추가하지 않는다.

## 시작 상태

| 항목 | 실제 상태 | 근거 경계 |
|---|---|---|
| WIL 저장소 | `main` HEAD `b1a826a`, Working Tree Clean, `origin/main`과 동일 | 학습 시작 전 `git status`·`git log` |
| Lab 저장소 | `main` HEAD `cc34275`, Working Tree Clean, `origin/main`과 동일 | 학습 시작 전·Test 후 `git status` |
| Spring Security | Dependency·`SecurityFilterChain`·사용자·인증 설정 없음 | `pom.xml`·Source 검색 |
| 현재 Web API | 인증 없이 Ticket 생성·단건 조회 Controller 호출 가능 | 기존 Source와 Standalone MockMvc Test |
| PostgreSQL Adapter | 없음 | 이번 주 자동 이월 대상 아님 |
| 현재 Java 회귀 Test | 33개 통과, 실패·오류·건너뜀 0 | 2026-09-07 19:23 KST `mvnw.cmd test` |

현재 33개 통과는 Security 추가 전 In-memory Application 회귀 기준선이다. 인증·인가·Session·CSRF 또는 PostgreSQL Adapter가 동작한다는 근거가 아니다.

## 최초 이해 Gate

Learning Note를 보기 전에 각 질문에 2~4문장으로 답한다. 틀린 답도 지우지 않고 이후에 `판정`과 `교정`을 추가한다.

### 질문 1 — Authentication과 Authorization

> Authentication과 Authorization은 각각 무엇을 입력으로 받아 어떤 결정을 내리는가?

사용자 최초 답변:

> Authentication는 로그인한 사용자가 맞는지 확인하는 작업이고, Authorization은 특정 작업에 대한 권한이 있는지를 확인하는 작업입니다. Authentication은 아이디와 패스워드 또는 세션이나 토큰 정보를 입력받아 확인하고, Authorization은 매 요청마다 사용자 정보를 함께 받아서 그것을 서버의 DB와 대조하여 검증합니다.

판정: `PASS_WITH_CORRECTION`

교정:

- 신원을 확인하는 Authentication과 허용 행동을 판단하는 Authorization의 핵심 구분은 맞다.
- Authentication은 최초 Login Credential을 검증하는 경우뿐 아니라, 후속 요청에서 Session 같은 Credential로 기존 인증 상태를 복원하는 과정도 포함한다.
- Authorization의 입력은 현재 `Authentication`의 Principal·Authority와 보호 대상인 Request·Resource·Action 및 Policy다. 매 요청마다 반드시 Database를 조회하는 것은 아니다. 이 Lab은 우선 Session에서 복원한 Role과 `SecurityFilterChain`의 Method·Path 규칙을 비교한다.

### 질문 2 — `401`과 `403`

> 로그인하지 않은 사용자의 Ticket 조회와 로그인한 `USER`의 Ticket 조회는 왜 서로 다른 Status가 되어야 하는가?

사용자 최초 답변:

> 반드시 서로 다른 HTTP Status가 되어야할 당연한 이유가 있는 것은 아니고, 그것이 일반적인 비즈니스 규칙이기 때문인 것 같습니다. 누구나 로그인 여부와 티켓을 만들 수 있고, 또 누구나 본인의 생성 여부와 관계없이 어떤 티켓이든 조회할 수 있는 오픈 서비스라면 굳이 서로 다른 상태일 필요가 없겠지요.

판정: `PASS_WITH_CORRECTION`

교정:

- Endpoint가 공개인지 보호되는지는 서비스 Policy이므로 항상 두 요청이 서로 달라야 하는 것은 아니라는 지적이 맞다. 원래 질문은 “이 Lab의 Role Matrix에서는”이라는 조건을 명시해야 더 정확하다.
- 이 Lab에서는 Ticket 조회를 `AGENT`에게만 허용하기로 했다. 익명 요청은 유효한 인증 정보가 없어 `401`, 인증된 `USER`는 신원은 확인됐지만 `AGENT` Role이 없어 `403`이다.
- 같은 URI라도 인증·인가를 통과한 `AGENT`만 Controller에 도달해, Ticket 존재 여부에 따라 기존 `200` 또는 `404`를 받는다.

### 질문 3 — Session과 Cookie

> Login 성공 뒤 Server와 Browser는 각각 무엇을 보관하며, 후속 요청은 Password 없이 어떻게 인증 상태를 복원하는가?

사용자 최초 답변:

> 서버는 사용자가 인증을 위해 한시적으로 사용 가능한 토큰을 발급하여 그 정보를 정보를 보관하며, 브라우저는 서버로부터 받은 토큰을 들고 있다가 요청을 할 때마다 토큰을 서보로 보냅니다.

판정: `PARTIALLY_CORRECT`

교정:

- Browser가 Server에서 받은 식별 값을 후속 요청마다 보낸다는 큰 흐름은 맞다.
- 이번 Session 방식에서 Server는 인증된 Principal·Authority가 포함된 `SecurityContext`를 `HttpSession`과 연결해 보관한다. Browser는 그 인증 정보 전체가 아니라 Session을 찾기 위한 불투명한 Session ID Cookie를 보관한다.
- 후속 요청에서 Browser가 Cookie를 보내면 Server가 해당 Session을 찾고 `SecurityContext`를 불러온다. Cookie가 존재한다는 사실만으로 Login 성공이 증명되는 것은 아니다.

### 질문 4 — CSRF

> Browser가 Session Cookie를 보내는데도 상태 변경 요청에 CSRF Token이 추가로 필요한 이유는 무엇인가?

사용자 최초 답변:

> 제3자가 쿠키를 위조할 수 있기 때문입니다.

판정: `PARTIALLY_CORRECT`

교정:

- 핵심 공격 조건은 제3자가 Cookie를 위조하는 것이 아니다. 공격자는 사용자의 정상 Session Cookie 값을 읽거나 만들지 못해도 된다.
- 사용자가 로그인한 상태라면 Browser가 대상 Site로 보내는 Cross-site 요청에 정상 Cookie를 자동으로 첨부할 수 있다. Server가 Cookie만 보면 사용자의 의도와 공격자가 유도한 요청을 구분하지 못할 수 있다.
- 그래서 상태 변경 요청에는 Browser가 자동으로 붙이지 않고 공격자가 알기 어려운 CSRF Token을 Form Field나 Header로 추가하게 한다. Token이 없거나 다르면 `CsrfFilter`가 요청을 거부한다.

### 질문 5 — PasswordEncoder

> 같은 원문을 Salt 기반 Encoder로 두 번 Encode한 결과가 달라도 두 결과에 대한 `matches`가 성공할 수 있는 이유는 무엇인가?

사용자 최초 답변:

> 인코딩 후에는 내용이 달라보여도, 디코딩하면 결과가 같기 때문입니다.

판정: `PARTIALLY_CORRECT` — 핵심 원리 교정 필요

교정:

- Password Hash는 복호화하거나 Decode해서 원문을 비교하지 않는다. 단방향이라는 말은 저장된 결과로 원문을 되찾는 절차가 없다는 뜻이다.
- Salt 기반 Encoder는 매 Encode마다 다른 Salt를 사용하므로 같은 원문도 다른 저장 결과가 나올 수 있다.
- `matches(raw, encoded)`는 저장 결과에 포함된 Salt와 Algorithm Parameter를 사용해 입력 원문 후보를 다시 검증하고 대응 여부를 판단한다. 각 저장 결과가 자신의 Salt를 가지고 있으므로 서로 다른 두 결과 모두 같은 원문과 Match할 수 있다.

## 최초 이해 Gate 판정

- 전체 판정: `PARTIALLY_CORRECT`
- 잘 설명한 부분: Authentication과 Authorization의 목적 구분, Endpoint 공개 여부와 Role 정책에 따라 Status 계약이 달라진다는 점
- 보완할 부분: Authorization이 매 요청마다 반드시 Database를 조회한다는 가정, Session ID와 Server-side 인증 정보의 구분
- 반드시 교정할 부분: CSRF는 Cookie 위조 공격이라는 설명, Password Hash를 Decode한다는 설명
- 다음 Gate: 질문 3~5를 교정 내용을 보지 않고 자신의 말로 다시 설명한다.

## 재설명 Gate — 1차

### Session과 Cookie 재답변

사용자 재답변:

> 세션 방식에서 서버는 세션 ID를 보관하며, HttpSession을 통해 사용자를 식별합니다. 브라우저는 세션 ID가 담긴 쿠키를 보관합니다.

판정: `PASS_WITH_CORRECTION`

- Browser가 Session ID Cookie를 보관한다는 구분은 맞다.
- Server는 Session ID 자체만 보관하는 것이 아니라, 그 ID로 찾을 `HttpSession` 상태와 Session에 연결된 `SecurityContext`의 Principal·Authority를 보관한다.
- 후속 요청에서 Cookie의 Session ID로 `HttpSession`을 찾고 `SecurityContext`를 복원하므로 Password를 다시 검증하지 않는다는 마지막 연결이 필요하다.

### CSRF 재답변

사용자 재답변:

> 사용자가 로그인한 상태에서 공격자가 요청을 유도하면 Browser가 사용자의 정상 Session Cookie를 자동으로 붙일 수 있기 때문입니다. CSRF Token은 Browser가 Cross-site 요청에 자동으로 붙이는 값이 아니므로, 사용자 요청에서 Token이 없거나 일치하지 않으면 Server가 상태 변경 요청을 거부할 수 있습니다.

판정: `PASS`

- 정상 Cookie의 자동 첨부가 공격 조건이라는 점과, 별도로 제출된 CSRF Token을 Server가 검증한다는 방어 원리를 정확히 설명했다.

### Password Hash 재답변

사용자 재답변:

> codex의 설명을 잘 이해하지 못했습니다. 'matches(원문 후보, encodedA)는 encodedA에 포함된 Salt와 Algorithm Parameter로 후보를 다시 계산하여 비교합니다. encodedB도 자신의 Salt로 같은 검증을 수행합니다. 그래서 결과 문자열은 달라도 같은 원문이 두 결과에 모두 Match할 수 있습니다.' 라는 것이 무슨 뜻인가요?

판정: `NOT_YET_UNDERSTOOD`

- 이해하지 못한 상태를 완료로 처리하지 않는다.
- 다음 설명에서는 “단방향이지만 같은 입력으로 앞 방향 계산은 반복 가능하다”와 “`encode`는 새 Salt를 만들지만 `matches`는 저장된 Salt를 다시 사용한다”를 단계별로 확인한다.

### 추가 질문 — Session + CSRF와 JWT

사용자 질문:

> CSRF 를 막기 위해 세션 + CSRF 토큰을 사용할 바에야, 어차피 토큰을 사용해야 한다면 애초에 JWT 방식을 사용하는 것이 더 합리적이지 않나요? 두 방식의 차이가 무엇인가요?

정리:

- Session ID, CSRF Token, JWT는 이름에 Token이 들어가거나 무작위 문자열처럼 보여도 서로 다른 질문에 답한다.
- JWT가 CSRF Token을 대체하지 않는다. JWT를 Cookie에 넣어 Browser가 자동 첨부하게 하면 CSRF 위험을 다시 고려해야 한다.
- `Authorization: Bearer` Header를 Client가 명시적으로 붙이는 구성에서 CSRF 공격면이 줄어드는 이유는 JWT 형식이 아니라 Browser가 외부 Site 요청에 그 Header를 자동 첨부하지 않기 때문이다.
- Session은 Server-side 상태와 쉬운 강제 만료가 장점이고, JWT는 분산된 Resource Server의 독립 검증에 유리하지만 발급·Key·만료·갱신·폐기와 Client 저장 위치를 함께 설계해야 한다.
- 이번 Lab은 단일 Application의 Form Login·Session·Role·CSRF Filter 흐름이 학습 대상이므로 Session을 유지하고 JWT 구현은 계획대로 범위 밖에 둔다.

## 재설명 Gate — 2차

### 저장된 Salt와 단방향 검증

사용자 재답변:

> encodedA에 저장된 Salt를 사용합니다. 단방향으로 인코딩을 진행해서 결과값이 같은지를 보므로, 디코딩이 필요없습니다.

판정: `PASS`

- `matches`가 새 Salt를 만들지 않고 저장된 Encoding의 Salt를 사용한다는 점을 정확히 설명했다.
- 사용자가 입력한 후보를 같은 단방향 함수로 앞 방향 계산하고 저장된 결과와 비교하므로 복호화가 필요 없다는 설명도 맞다.
- `PasswordEncoder`라는 Interface 이름 때문에 Encode라고 표현하지만, 암호화·복호화와 구분할 때는 단방향 Hash 또는 KDF 검증이라고 표현하면 더 명확하다.

### JWT 전달 위치와 CSRF

사용자 재답변:

> JWT를 Cookie에 넣으면 Browser가 자동으로 전송하므로 CSRF 위험이 남습니다. JWT를 Authorization: Bearer Header에 직접 넣으면 외부 Site가 일반 Form 요청만으로 그 Header를 자동 첨부할 수 없어 전형적인 CSRF 공격면이 줄어듭니다. 하지만 JavaScript가 접근 가능한 곳에 JWT를 보관하면 XSS로 Token이 탈취될 위험을 별도로 다뤄야 합니다.

판정: `PASS`

- JWT 형식 자체가 아니라 Credential의 자동 첨부 여부가 CSRF 공격면을 바꾼다는 점을 정확히 설명했다.
- Bearer Header 방식에서도 Client-side Token 저장과 XSS라는 별도 위험을 함께 구분했다.

### 2차 Gate 판정

- `PASS`: 저장된 Salt를 재사용하는 복호화 없는 Password 검증
- `PASS`: JWT의 Cookie·Bearer Header 전달 차이와 CSRF·XSS 위험 구분
- 남은 확인: Server가 Session ID만 보관한다는 표현을 보완하고, Session ID로 `HttpSession`과 `SecurityContext`를 복원하는 전체 흐름을 사용자가 직접 연결한다.

## 재설명 Gate — 최종

사용자 재답변:

> 로그인 성공 시 **Browser는 Session ID**를 쿠키에 저장하고, **Server는 HttpSession** 내부에 인증 정보인 **SecurityContext**를 보관합니다. 이후 브라우저가 `GET /tickets/1` 요청과 함께 쿠키에 담긴 Session ID를 전송하면, 서버는 이를 통해 해당하는 HttpSession을 식별합니다. 최종적으로 서버는 세션에서 **SecurityContext**를 꺼내어 해당 스레드의 SecurityContextHolder에 복원함으로써, 패스워드 입력 없이도 안전하게 인증된 사용자의 요청을 처리하게 됩니다.

판정: `PASS`

- Browser의 Session ID Cookie, Server의 `HttpSession`·`SecurityContext`, 요청 Thread의 `SecurityContextHolder`를 정확한 순서로 연결했다.
- Password를 다시 검증하지 않고 기존 인증 상태를 복원한다는 이유까지 설명했다.
- “안전하게”라는 표현은 Session ID의 예측 불가능성, Session Fixation 방어, Cookie 속성, HTTPS 같은 보호가 적용된다는 조건에서 성립한다. 이 Runtime 조건은 아직 검증하지 않았다.

### 9월 7일 개념 Gate 판정

- `PASS`: Authentication과 Authorization의 목적 및 입력 차이
- `PASS`: 공개 Endpoint 여부와 이 Lab의 `401`·`403` 계약 구분
- `PASS`: Session ID → `HttpSession` → `SecurityContext` → `SecurityContextHolder` 복원 흐름
- `PASS`: 정상 Session Cookie 자동 첨부를 이용하는 CSRF와 별도 Token 검증
- `PASS`: 저장된 Salt를 재사용하는 단방향 Password 검증
- `PASS`: JWT의 전달 위치에 따른 CSRF·XSS 위험 차이
- 결론: 9월 7일 개념 학습과 구현 전 Test 계약을 완료한다. Spring Security 구현과 Security Integration Test는 완료 근거에 포함하지 않는다.

## 오늘 사용할 Learning Note

- [Authentication·Authorization과 401·403](../study-docs/authentication-authorization.md)
- [PasswordEncoder·Session·Cookie·CSRF](../study-docs/password-session-csrf.md)

공식 Spring Security 문서의 현재 Web 표시는 7.1.1이다. Lab에는 Security Dependency가 아직 없어 실제 해석 Version은 확정하지 않았다. 금요일에 Spring Boot Dependency Management로 의존성을 추가한 뒤 `dependency:tree` 결과를 별도 실행 근거로 기록한다.

## Baseline 실행과 관찰

```powershell
.\mvnw.cmd test
```

| 관찰 항목 | 실행 전 예상 | 실제 관찰 | 차이와 해석 |
|---|---|---|---|
| 전체 Test | 기존 33개가 유지되어야 함 | 33개 통과, 실패 0, 오류 0, 건너뜀 0, `BUILD SUCCESS` | 예상과 일치; Week 4 변경 전 현재 기준선 확보 |
| 대표 Repository 실패 Test | 의도한 내부 실패가 Log에 남고 Test는 안전한 `500` 응답을 검증 | `simulated repository failure` Stack Trace 뒤 해당 Test 포함 전체 성공 | 출력의 `ERROR` Log는 의도한 Test Fixture이며 Build 실패가 아님 |
| Security Filter | 현재 Dependency·설정이 없어 Security 계약을 검증하지 않음 | Security 관련 Source 검색 결과 없음 | 이후 Security Test와 구분해야 함 |

## 구현 전 Red Test 계약

아래 이름은 Test 구현이 아니라 금요일·토요일에 고정할 실패 조건이다.

| 우선순위 | Test 계약 | 핵심 조건 | 예상 |
|---:|---|---|---|
| P0 | `same_password_encodes_differently_and_both_match` | 선택한 Salt 기반 Encoder로 같은 가짜 원문을 두 번 Encode | Encoding은 다르고 올바른 원문은 두 결과 모두 `matches`, 오답은 실패 |
| P0 | `form_login_success_persists_authentication_in_session` | Form Login 성공 응답의 Session을 후속 보호 요청에 재사용 | Password 재전송 없이 인증 복원 |
| P0 | `anonymous_ticket_request_returns_unauthorized` | CSRF가 필요 없는 `GET` 또는 유효 CSRF가 있는 `POST` | `401`, Application 미진입 |
| P0 | `authenticated_user_cannot_read_ticket` | 로그인한 `USER`로 단건 조회 | `403`, 조회 Use Case 미진입 |
| P0 | `authenticated_agent_can_read_ticket` | 로그인한 `AGENT`와 존재하는 Ticket | 기존 `200` 계약 유지 |
| P0 | `authenticated_post_requires_valid_csrf_token` | 로그인한 `USER`의 Token 누락과 유효 Token을 비교 | 누락은 `403`·저장 없음, 유효하면 기존 생성 흐름 진행 |

### 혼입 변수 제거 규칙

- Authentication 실패는 `GET` 또는 유효 CSRF가 있는 `POST`로 확인한다.
- Authorization 실패는 로그인된 Session을 먼저 준비하고 CSRF가 필요 없는 조회로 확인한다.
- CSRF 실패는 인증과 허용 Role을 먼저 만족시킨 뒤 Token만 바꾼다.
- 보안 Filter 통과는 권한 있는 사용자의 기존 `200`·`201` 또는 Application의 `404`로 확인한다.
- Standalone `TicketControllerTest`를 Security 근거로 사용하지 않고 실제 Filter Chain을 포함한 별도 Integration Test를 둔다.

## 현재 학습 결과와 검증 경계

- 완료: Week 4 3일 범위 확정, 공식 자료 확인, 두 Learning Note 작성, Security 추가 전 전체 33개 Test 재실행, Red Test 계약 초안, 사용자 최초 답변과 1차 판정
- 완료: 사용자가 정상 Session Cookie를 이용한 CSRF 공격 조건과 별도 Token 검증 원리를 재설명
- 완료: 사용자가 저장된 Salt를 이용한 복호화 없는 Password 검증과 JWT 전달 위치에 따른 CSRF·XSS 차이를 재설명
- 완료: 사용자가 Session ID로 Server-side `HttpSession`·`SecurityContext`를 찾고 요청 Thread의 `SecurityContextHolder`에 인증을 복원하는 흐름을 재설명
- `NOT_IMPLEMENTED`: Spring Security Dependency와 구성, PasswordEncoder, 학습용 사용자, Role Matrix
- `NOT_RUN`: Login·Session·`401`·`403`·CSRF Security Integration Test, 실제 Cookie Header Trace
- 비범위 유지: PostgreSQL Adapter, XSS UI, SQL Injection, Rate Limiting, JWT·OAuth2, HTTPS와 분산 Session

## AI 활용과 직접 확인 범위

- AI가 보조한 부분: 주간 학습 지도, 공식 문서 비교, Learning Note와 Red Test 계약 초안 작성
- Codex가 실행한 부분: 두 저장소 상태·Source 확인, 2026-09-07 Maven 전체 Test
- 사용자가 직접 수행한 부분: 다섯 최초 답변 작성, HTTP Status 반례 제시, Session·CSRF 재답변, Password Hash 미이해 지점 질문 후 재설명, JWT 전달 위치에 따른 위험 비교, Session 인증 복원 흐름 최종 설명
- 사용자가 이어서 수행할 부분: 금요일 회상 Gate, 구현의 작은 변경 설명·수정과 Test 결과 해석
- 아직 주장하지 않는 부분: Spring Security Runtime 동작, 실제 Session·Cookie Header와 Security Filter 실행, Cookie·HTTPS 보안 속성

## 다음 학습

1. 9월 11일 금요일 첫 Block에서 문서를 보지 않고 인증·인가, Password Hash, Session·Cookie와 CSRF를 15분 이내로 회상한다.
2. Spring Security Dependency를 추가한 뒤 실제 해석 Version을 확인하고 PasswordEncoder·Form Login·Session Red Test를 구현한다.
3. 현재 `NOT_IMPLEMENTED`·`NOT_RUN` 항목은 실행 근거가 생길 때까지 유지한다.
