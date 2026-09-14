# Week 4 WIL — Session 인증과 요청별 접근 결정

> 기간: 2026-09-07 ~ 2026-09-13
> 보완·마감일: 2026-09-14
> 상태: Completed
> 문서 상태: 2026-09-14 블로그 게시·포럼 등록 완료 — 사용자 확인
> 핵심 질문: 인증 결과를 Session에 어떻게 보존하고, 후속 Request의 인증·Role·CSRF 실패를 어떻게 구분할 수 있는가?

## 이번 주 요약

이번 주에는 넓은 Web Security 목록을 한꺼번에 구현하지 않고 기존 Ticket API에 Session 인증 수직 흐름만 적용했다. Spring Security 의존성만 추가했을 때 실제 Context Test는 Controller의 기존 `404`까지 가지 않고 Login Page로 `302` Redirect됐다. 이 실패에서 시작해 익명 API `401`, BCrypt Password 검증, Test 전용 USER·AGENT의 Form Login과 Mock Session 복원, Role 기반 `403`, CSRF Token 누락 `403`을 한 단계씩 분리했다.

최종 42개 Test는 모두 통과했다. 그러나 Test 성공과 별개로 Log를 점검하자 자동 생성된 기본 보안 Password 안내가 두 Test Report에 남아 있었다. Runtime 사용자가 없는 현재 단계에서는 해당 기본 사용자 자동 구성을 제외했고, 일반 `clean test`와 Pattern 기반 재점검으로 안내와 Password·Session·CSRF 값이 Report에 남지 않은 것을 확인했다.

## 시작점

- Authentication은 Login 사용자가 맞는지 확인하고 Authorization은 행동 권한을 확인한다는 큰 구분은 알고 있었다.
- Session Login에서도 Browser가 Token을 보낸다는 정도로 이해했지만, Session ID와 `SecurityContext`를 어디에서 보관하는지 섞어서 설명했다.
- Salt가 다르면 Password Encoding이 달라진다는 점은 알았지만 처음에는 복호화하거나 새 Salt로 다시 Encoding한다고 생각했다.
- CSRF는 Cookie 위조 문제라고 생각했지만, 공격자가 Cookie를 읽지 못해도 Browser가 정상 Cookie를 자동 전송한다는 조건을 놓쳤다.
- Standalone Controller Test가 통과하면 실제 Security Filter Chain도 함께 검증된다고 볼 수 있는지 불확실했다.

## 계획 대비 결과

| 목표 | 실제 결과 | 상태 | 근거 |
|---|---|---|---|
| 3일 범위 결정 | Session 인증·Role·CSRF 수직 흐름만 Must로 선택 | Completed | [주간 계획](./weekly-plan.md) |
| 인증·인가 설명 | 익명·USER·AGENT의 `401`·`403`·성공과 Controller 진입 여부 구분 | Completed after correction | [9월 14일 기록](./study-notes/2026-09-14-study-questions.md) |
| Password 검증 | BCrypt 두 Encoding의 차이, 두 `matches` 성공과 오답 실패 | Completed | [Security Lab](./lab-reports/2026-09-12-spring-security-baseline-lab.md) |
| Form Login·Session | Test 전용 Login 성공·실패와 동일 Mock Session의 후속 인증 복원 | Completed | [Security Lab](./lab-reports/2026-09-12-spring-security-baseline-lab.md) |
| Role Matrix | USER 생성 `201`·조회 `403`, AGENT 조회 `200` | Completed | [Security Lab](./lab-reports/2026-09-12-spring-security-baseline-lab.md) |
| CSRF 비교 | 같은 USER·POST·Body에서 Token 없음 `403`, 유효 Token `201` | Completed after correction | [Security Lab](./lab-reports/2026-09-12-spring-security-baseline-lab.md) |
| Secret·Log 점검 | 자동 생성 Password 안내 발견·제거 후 42개 회귀와 Pattern 재점검 | Completed after fix | [9월 14일 기록](./study-notes/2026-09-14-study-questions.md) |
| 실제 Browser Cookie 관찰 | Must 완료 뒤에도 필요성이 낮아 Should로 종료 | `NOT_RUN` | 자동화 Test의 한계로 기록 |

## 핵심 학습

### 의존성 추가는 보안 계약의 완성이 아니다

- 질문: Spring Security Starter만 추가하면 Ticket API의 `401`·`403` 계약도 자동으로 완성되는가?
- 최소 실험: Security 설정을 작성하기 전에 기존 33개 Test를 그대로 실행했다.
- 관찰: Standalone Controller Test 7개는 통과했지만 실제 Application Context Test 2개는 기대 `404` 대신 `/login`으로 `302` Redirect됐다. Handler는 `null`이었다.
- 원리 설명: Default Security는 Request를 보호하지만 Helpdesk API가 원하는 Client 응답과 Role 정책을 알지 못한다. 이번 API에는 익명 접근을 Redirect가 아닌 `401`로 표현하는 Entry Point와 Method·Path별 Role 규칙이 필요했다.
- 사용하지 않을 조건: Framework가 기본으로 Request를 막았다는 사실을 비즈니스 권한 계약의 구현 완료로 표현하지 않는다.

### Login은 인증 결과를 만들고 Session은 그 결과를 후속 Request에 복원한다

최초 Login `POST`는 Username과 Password 후보를 보낸다. `UserDetailsService`가 저장된 Password Encoding과 Authority를 제공하고, `PasswordEncoder`가 후보를 검증하면 인증된 `Authentication`이 만들어진다. Server가 이를 `SecurityContext`에 넣어 `HttpSession`에 보존하고 Browser에는 Session ID Cookie만 전달한다.

```text
Login 입력
Username + Password 후보
        ↓
Authentication 생성
        ↓
HttpSession → SecurityContext → Authentication

후속 Request
JSESSIONID → HttpSession → SecurityContext → SecurityContextHolder
```

Browser가 보관하는 것은 `SecurityContext`가 아니다. 후속 Request에서는 Password를 다시 검증하는 대신 Session ID로 이전 인증 결과를 찾아 현재 처리 흐름에 복원한다.

이번 Test는 Login 결과의 `MockHttpSession`을 직접 후속 Request에 전달했다. 따라서 Server-side 인증 복원은 검증했지만 실제 Browser의 `Set-Cookie`·`Cookie` 교환을 관찰한 근거는 아니다.

### Password는 복호화하지 않고 후보를 검증한다

- 질문: 같은 후보를 두 번 Encode한 문자열이 다른데 왜 두 결과 모두 `matches`에 성공하는가?
- 최소 실험: 실행 중 임의 후보를 만들고 BCrypt로 두 번 Encode한 뒤 올바른 후보와 잘못된 후보를 비교했다.
- 관찰: 두 Encoding은 달랐고 올바른 후보는 두 값에 모두 Match했으며 잘못된 후보는 실패했다.
- 원리 설명: BCrypt Encoding에는 각 결과의 Salt와 비용 Parameter가 포함된다. `matches(candidate, encoded)`는 저장된 Encoding의 Parameter로 후보를 단방향 계산해 저장된 결과와 비교하므로 Password 원문을 복호화할 필요가 없다.
- 공개 경계: 후보와 Encoding 값 자체는 Assertion 결과나 문서에 출력하지 않았다.

### 같은 접근 거부라도 인증·인가·CSRF 원인은 다르다

| 요청 | Security 판단 | 최종 Status | Controller |
|---|---|---:|---|
| 익명 Ticket 조회 | 유효한 Login 인증 없음 | `401` | 미진입 |
| `USER` Ticket 조회 | 인증 성공, AGENT Role 없음 | `403` | 미진입 |
| `AGENT`의 존재하는 Ticket 조회 | 인증·Role 조건 통과 | `200` | 진입 |
| `USER`의 Token 없는 Ticket 생성 | 인증·Role 조건 충족, CSRF 검증 실패 | `403` | 미진입 |
| `USER`의 유효 Token Ticket 생성 | 모든 Security 조건 통과 | `201` | 진입 |

`401`, `403`, `200`은 Authorization의 세 가지 결과가 아니다. Authorization의 핵심 판단은 접근 허용 또는 거부이며, 유효한 Login 인증이 없는 거부는 이번 API에서 `401`, 인증됐지만 Role이 부족한 거부는 `403`으로 표현한다. `200`과 `201`은 허용 뒤 Application이 Request를 정상 처리한 결과다.

USER 조회와 Token 없는 USER 생성은 모두 `403`이지만 전자는 Role 인가 실패이고 후자는 CSRF 검증 실패다. Status만으로 원인을 단정하지 않고 인증 상태, Role 조건과 Token 유무를 함께 본다.

### CSRF Test는 Token 외의 조건을 같게 유지해야 한다

CSRF는 공격자가 Session Cookie 값을 읽거나 위조해서만 가능한 공격이 아니다. 사용자가 Login한 Browser를 다른 Site가 상태 변경 Request로 유도하면 Browser가 정상 Session Cookie를 자동 첨부할 수 있다. CSRF Token은 Cross-site 요청에 같은 방식으로 자동 첨부되지 않으므로 Server는 Session과 연결된 Token이 없거나 맞지 않는 Request를 거부할 수 있다.

이번 비교에서는 사용자, Login Session, `POST /api/tickets`, JSON Body와 Role 규칙을 같게 유지하고 CSRF Token 유무만 바꿨다. Token 없는 Request에서도 `USER` Authentication 복원을 먼저 Assertion했기 때문에 인증 실패와 Role 부족을 원인에서 제외할 수 있었다.

### Test Green과 Log 안전은 서로 다른 검증이다

9월 14일 첫 `clean test`는 42개가 모두 통과했다. 그 뒤 Surefire Report를 점검하자 Spring Boot가 자동 구성한 임시 기본 Password 안내가 두 곳에 남아 있었다. 기능 Test는 Status·Handler·인증 상태를 검증했지만 Log에 무엇이 기록되는지는 검증하지 않았기 때문이다.

Runtime 사용자는 아직 구현하지 않았고 Test 사용자는 별도 Test Configuration에서만 등록한다. 따라서 Application의 기본 사용자 자동 구성을 제외했다. 임시 Option으로 먼저 대조한 뒤 Source에 적용했고, 일반 명령의 전체 42개 Test와 Log Pattern을 다시 점검했다.

이 점검에서 추적 Source의 대표 Secret Literal, 추적 Credential 파일과 공개 Markdown의 로컬 절대 경로는 발견되지 않았다. 최종 Console·Surefire Report에서도 생성 Password 안내, BCrypt Encoding, Session ID와 CSRF Token 값은 발견되지 않았다. 이는 선택한 Pattern과 현재 Report 범위의 결과이며 모든 종류의 유출 가능성을 증명하는 절대 보장은 아니다.

## 예상과 실제의 차이

| 예상·초기 이해 | 실제 관찰·교정 | 이해가 바뀐 점 |
|---|---|---|
| Security 의존성을 추가하면 API 보안 계약도 생긴다. | Default는 익명 API를 Login Page로 `302` Redirect했다. | 기본 차단과 Application의 명시적 계약을 분리한다. |
| 기존 Controller Test가 Green이면 Security도 포함된다. | Standalone Test는 통과하고 실제 Context Test만 실패했다. | Test 구성에 Filter Chain이 포함됐는지 먼저 확인한다. |
| Login할 때 Browser가 Session ID를 인증 입력으로 보낸다. | 최초 Login은 Username·Password 후보, Session ID는 성공 뒤 후속 Request에서 사용한다. | 인증 결과 생성과 복원을 나눈다. |
| Browser가 `SecurityContext`를 보관한다. | Browser는 Session ID Cookie, Server는 `HttpSession` 안의 인증 결과를 보관한다. | Client 식별자와 Server 상태를 구분한다. |
| `403`이면 현재 권한이나 Token이 만료된 것이다. | USER 조회는 Role 부족, Token 없는 POST는 CSRF 검증 실패였다. | Status뿐 아니라 실패한 Security 단계를 확인한다. |
| 전체 Test가 Green이면 Secret 점검도 통과한 것이다. | 42개가 통과했지만 자동 생성 Password 안내가 Report에 있었다. | 기능 Assertion과 Output·Log Audit을 별도 근거로 남긴다. |

## Test와 검증 근거

| 단계 | 실행 결과 | 무엇을 증명하는가 |
|---|---|---|
| Security 변경 전 | 33개 통과 | In-memory Application 회귀 기준선 |
| Starter 단독 | 33개 중 2개 실패 | Default `302`가 실제 Context에 미친 영향 |
| 익명 API 계약 | 34개 통과 | `401`, Redirect 없음, Controller 미진입 |
| BCrypt | 35개 통과 | 서로 다른 Encoding과 `matches` 성공·실패 |
| Form Login·Session | 38개 통과 | Test Login 성공·실패와 Mock Session 인증 복원 |
| Role Matrix | 41개 통과 | USER·AGENT의 허용·거부 경계 |
| CSRF 비교 | 42개 통과 | 같은 POST에서 Token 없음·유효 조건의 차이 |
| 9월 14일 최종 회귀 | 42개 통과, 실패·오류·건너뜀 0 | 기본 사용자 자동 구성 제외 뒤 기존 계약 유지 |
| 최종 Output·Log 점검 | 선택한 민감 값 Pattern 0건 | 현재 Console·Surefire Report의 노출 경계 |

## 실패와 부분 완료

- 첫 익명 API Red Test는 기존 실험과 다른 `Accept` Header를 사용해 Default 상태에서도 통과했다. 조건을 같게 고쳐 기대 `401`, 실제 `302`인 유효한 Red를 다시 만들었다.
- Role Matrix 전에는 인증만 확인했기 때문에 USER 조회가 기대 `403`이 아니라 Controller의 `404`까지 진행했다. 이를 권한 규칙 부재의 Red로 사용했다.
- CSRF 비교 설명에서 처음에는 두 Request의 차이를 GET과 POST라고 답했지만 실제 Test는 둘 다 같은 POST였다. Token 유무만 다르다는 점으로 교정했다.
- 통합 회상에서 Role 부족과 CSRF 실패를 한 번에 구분하지 못해 `PASS_AFTER_CORRECTION`으로 기록했다. 한 번의 재설명이 장기 기억을 보장하지는 않는다.
- 실제 Browser Cookie·CSRF Network Trace는 실행하지 않았다. `MockHttpSession` Test를 Browser 근거로 표현하지 않는다.
- Production Runtime 사용자와 Credential 저장소, PostgreSQL Adapter·Integration Test는 구현하지 않았다.
- XSS·SQL Injection·Rate Limiting·HTTPS와 JWT·OAuth2는 이번 선택 범위에 포함하지 않았다.

## 설명 가능성 점검

- 자료 없이 설명한 내용: `JSESSIONID → HttpSession → SecurityContext → SecurityContextHolder` 복원 흐름, 다섯 Request의 Status와 Controller 진입 여부
- 교정 뒤 설명한 내용: USER 조회 `403`은 Role 인가 실패이고 Token 없는 USER 생성 `403`은 CSRF 검증 실패라는 구분
- Test로 확인한 내용: Default `302`, API `401`, BCrypt, Form Login·Mock Session, Role Matrix와 CSRF 비교
- 아직 직접 관찰하지 않은 내용: 실제 Browser Cookie 교환, Cookie 속성과 Cross-site Request, Runtime 사용자 저장소

## AI 활용

| 작업 | AI가 수행한 일 | 직접 판단·설명·확인한 일 |
|---|---|---|
| 개념 학습 | 질문 순서, 객체 관계 그림과 반례 제시 | Session 복원 흐름과 Status·Controller Matrix 재설명 |
| Test 설계·구현 | Red-Green 단위 제안, Security 설정·Test Code 작성과 실행 | 실패 결과를 함께 확인하고 다음 작은 단계 진행 승인 |
| 이해 점검 | 같은 `403`의 원인을 분리하는 후속 질문 제시 | 잘못된 설명을 수정해 Role 인가 실패와 CSRF 검증 실패 구분 |
| 마감 검증 | 전체 Test와 값 비공개 Pattern Audit, 문서 작성 | Week 4 범위와 미수행 항목 확인, 블로그 게시·포럼 등록 완료 확인 |

AI가 작성한 설명이나 WIL 문장을 사용자의 이해로 바로 간주하지 않았다. 사용자가 자신의 말로 다시 설명한 범위와 실제 Test 결과를 구분해 기록했다.

## 공개 기록

- 게시 기술 블로그: 「심화과정 4주차 회고 - 세션 인증과 Role 기반 인가」
- 게시·포럼 등록일: 2026-09-14
- 확인 근거: 사용자 완료 확인
- 독립 확인 범위: 외부 게시물 URL과 포럼 등록 화면은 제공되지 않아 Codex가 별도로 확인하지 않았다.

## 다음 주

- Week 5의 핵심 Browser 흐름을 시작하기 전에 Session·Role·CSRF 세 문장을 짧게 지연 회상한다.
- XSS와 CORS는 실제 Browser UI와 Origin 조건을 관찰할 수 있을 때만 Week 5 범위로 선택한다.
- 실제 Cookie Trace는 자동으로 Must에 이월하지 않고 Mock Session 근거로 답할 수 없는 질문이 생길 때 수행한다.
- Runtime 사용자 저장소는 Password 정책과 영속화가 다음 학습 질문에 필요할 때 별도 수직 흐름으로 설계한다.

## 관련 자료

- [Week 4 주간 학습 계획](./weekly-plan.md)
- [9월 12일 Security 구현 기록](./study-notes/2026-09-12-study-questions.md)
- [9월 14일 통합 회상·보안 점검](./study-notes/2026-09-14-study-questions.md)
- [Spring Security Baseline Lab Report](./lab-reports/2026-09-12-spring-security-baseline-lab.md)
- [Form Login과 Session 인증 과정](./study-docs/session-authentication-flow.md)
- [Spring Test Annotation과 Test Boundary](./study-docs/spring-test-annotations-and-boundaries.md)
