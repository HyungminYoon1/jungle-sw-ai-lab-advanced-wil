# 2026-09-12 — Security Baseline 완성과 권한·CSRF

> 날짜: 2026-09-12
> 상태: In Progress — 문답 1~4와 Block 1 익명 API `401` 통과
> 시작 구현 상태: Security Starter만 추가, 명시적 보안 계약 `NOT_IMPLEMENTED`
> 시작 Test 상태: 33개 중 31개 통과·2개 실패, 오류 0·건너뜀 0
> Hard Limit: 최대 6시간

## 날짜 경계

9월 11일 학습은 자정을 넘겨 이어졌다. 회상·재설명, Security 변경 전 Baseline, Starter 추가와 Default Auto-Configuration 실험, `SavedRequest`와 인증된 `SecurityContext`의 구분까지를 9월 11일 학습 Session의 결과로 귀속한다.

Test 명령의 실제 실행 시각은 2026-09-12 00:41~00:42 KST였으며 이를 9월 11일 시각으로 바꾸지 않는다. 이 문서는 그 연장 Session에서 끝내지 못하고 9월 12일로 명시적으로 옮긴 구현·검증 과업만 다룬다.

## 시작 상태

| 항목 | 실제 상태 |
|---|---|
| Security Dependency | `spring-boot-starter-security` 추가 |
| 실제 해석 Version | Spring Security 7.1.1 |
| 사용자 정의 `SecurityFilterChain` | `NOT_IMPLEMENTED` |
| Password·사용자·Role | `NOT_IMPLEMENTED` |
| Login·Session·CSRF Test | `NOT_RUN` |
| 기존 Standalone Controller Test | 7개 통과 |
| 실제 Context Test | 2개 실패 — 기대 `404`, 실제 `/login` Redirect `302` |

현재 Red는 원인을 모르는 회귀가 아니다. Default Security가 실제 Context Request를 Controller 전에 막는다는 사실을 관찰하기 위해 설정과 기존 기대값을 바꾸지 않은 결과다. 상세 근거는 [Security Test 실행 근거](../study-docs/security-test-evidence.md)에 기록되어 있다.

## 오늘의 핵심 질문

> Default `/login` Redirect를 이번 API의 명시적 `401`·`403`·`200` 계약으로 바꾸고, Login 성공 뒤 같은 Session에서 인증 상태가 복원된다는 사실을 어떻게 서로 독립된 Test로 증명할 것인가?

## 우선순위

### Must

1. 실제 Filter Chain을 통과하는 익명 보호 `GET`의 `401`
2. Salt 기반 `PasswordEncoder`의 서로 다른 Encoding과 `matches`
3. Login 성공·실패와 후속 Request의 Session 재사용
4. `USER` 생성 허용, `USER` 조회 `403`, `AGENT` 조회 허용
5. 전체 회귀 Test와 실행 근거 기록

### Should

1. 인증된 `POST`에서 CSRF Token 없음·유효 조건 비교
2. Login 전후 Session ID 또는 Cookie 경계 관찰
3. Source·설정·Test Output의 Secret 노출 점검

CSRF는 Week 4의 선택 범위이지만, 앞선 Must를 이해하지 못한 상태에서 Test만 급히 추가하지 않는다. 6시간 안에 끝나지 않으면 `NOT_RUN`으로 남기고 WIL에 정확히 이월한다.

## 6시간 실행 순서

### Block 1 — Security Test 경계와 API `401` (최대 1시간 30분)

- Security Test 지원 의존성 추가와 실제 해석 Version 확인
- 기존 Web Infrastructure Test와 새 Security Integration Test의 책임 분리
- 익명 `GET /api/tickets/{id}`가 `401`이어야 한다는 Red Test 작성
- API 인증 진입점과 Form Login Redirect가 섞인 원인 설명
- 명시적 `SecurityFilterChain`의 최소 규칙으로 첫 Green 확인

**완료 근거:** 익명 보호 `GET`이 실제 Filter Chain에서 `401`이고 Controller에 도달하지 않는다.

### Block 2 — Password와 학습용 사용자 (최대 1시간 30분)

- 선택한 `PasswordEncoder`를 Bean으로 구성
- 같은 원문 2회 Encoding 결과의 차이, 두 `matches` 성공과 잘못된 원문 실패 Test
- Test Credential과 Runtime Credential의 경계 분리
- 최소 `USER`·`AGENT` 인증 Fixture 구성

**완료 근거:** Encoding 문자열이나 원문 Credential을 공개하지 않고 Password 검증 결과만 Test로 남긴다.

### Block 3 — Form Login과 Session 복원 (최대 1시간)

- Login 성공·실패 Test
- Login 성공 결과의 Session을 후속 Request에 재사용
- `SavedRequest`만 있는 Session과 인증된 `SecurityContext`가 저장된 Session 구분

**완료 근거:** 후속 Request가 Password 재전송 없이 인증 상태를 복원한다.

### Block 4 — Role Matrix (최대 1시간)

- `USER`의 Ticket 생성 허용
- `USER`의 Ticket 조회 `403`
- `AGENT`의 Ticket 조회 허용
- 익명 `401`과 인증된 사용자 `403`을 서로 다른 Test 조건으로 유지

**완료 근거:** 실제 Filter Chain을 통과하는 `401`·`403`·성공 Case가 각각 존재한다.

### Block 5 — CSRF 최소 비교 (최대 45분)

- 인증된 `POST`의 CSRF Token 없음 `403`
- 유효 Token을 포함한 같은 요청이 Controller·Application으로 진행
- CSRF를 전역 비활성화하지 않음

**중단 조건:** Token 유무 외에 인증·인가 조건까지 달라지면 Test를 완료로 만들지 않고 실패 변수를 먼저 분리한다.

### Block 6 — 회귀·근거·WIL (최대 45분)

- 전체 Maven Test 실행과 Test 수·실패·오류·건너뜀 기록
- 생성된 개발용 Credential, 원문 Password, Session ID와 Token 값 비공개 확인
- 수행하지 않은 항목을 `NOT_RUN`으로 유지
- Week 4 WIL과 Week 5 이월 판단

## Cut Line

- Block 6의 최소 45분은 남겨 두고 구현을 중단한다.
- Session 또는 Role Matrix가 미완료이면 Week 4는 `Partially Completed`다.
- CSRF Test가 미완료이면 개념 학습과 Runtime 근거를 구분해 `NOT_RUN`으로 기록한다.
- 현재 Red 2개를 원인만 안다는 이유로 Green이나 회귀 완료로 표시하지 않는다.
- 하루 6시간을 넘겨 미완료를 숨기지 않는다.

## 시작 전 설명 Gate

1. API의 익명 실패에 Default `302` 대신 `401`을 선택하는 이유는 무엇인가?
2. 기존 Standalone Controller Test를 Security 근거로 바꾸지 않고 유지하는 이유는 무엇인가?
3. `SavedRequest`가 든 Session과 인증된 `SecurityContext`가 든 Session은 어떻게 다른가?
4. Login 성공 Test와 Session 재사용 Test를 분리하면 각각 무엇을 증명하는가?
5. 인증된 `POST`의 CSRF 실패를 검증할 때 어떤 조건을 동일하게 유지해야 하는가?

3번은 9월 11일 연장 Session에서 사용자가 자신의 말로 설명해 통과했다. 나머지는 각 구현 Block 직전에 설명하고 Test 결과와 함께 판정한다.

## 문답 1 — 익명 보호 `GET`

조건:

- Session Cookie 없는 익명 요청
- `GET /api/tickets/999`
- Security Starter만 있고 사용자 정의 `SecurityFilterChain`은 없음
- Controller까지 진행한다면 존재하지 않는 Ticket이므로 기존 결과는 `404`

최초 답변에서는 `GET`을 CSRF 실패로 분류했고, 인증이 없으면 Authorization도 수행되지 않는다고 보았다. 또한 `SavedRequest`를 새로운 사용자이기 때문에 생성하는 것으로 설명했으며 Controller 진입 여부를 적지 않았다.

교정 후 사용자가 설명한 최종 흐름:

> Cookie 없음
> → Session에서 복원되는 인증 정보 없음
> → `GET`은 CSRF 검증 대상이 아님
> → 보호된 주소가 요구하는 인증 조건을 만족하지 못해 접근 거부
> → Login 성공 후 원래 Request로 돌아갈 수 있도록 `SavedRequest` 저장
> → 현재 Default 응답은 `302 Location: /login`, 이번 API 목표는 `401`
> → Security Filter 단계에서 끝나므로 Controller는 실행되지 않음

판정: `PASS_AFTER_CORRECTION`

- CSRF 검증 대상과 인증·인가 실패를 분리했다.
- 익명 요청에도 Authorization 결정이 수행되며 그 결과가 접근 거부임을 설명했다.
- `SavedRequest`와 인증 상태를 구분하고, Default `302`와 목표 API `401`을 구분했다.
- 실제 실험의 `Handler = null`을 Controller 미진입과 연결했다.

이 판정은 개념 설명 근거다. 명시적 `401` Security Test와 Production 구성은 아직 `NOT_IMPLEMENTED`·`NOT_RUN`이다.

## 문답 2 — Login과 Session 인증 복원

최초 답변에서는 Login의 인증 입력을 Session ID로 보았고, Browser가 `SecurityContext`를 Cookie에 담아 보내는 것으로 설명했다. 또한 `SecurityContextHolder`를 `HttpSession`에 지속해서 저장되는 객체 구조에 포함했다.

교정 후 사용자가 설명한 최종 구분:

> Login `POST`의 인증 입력은 사용자명, 원문 Password 후보, CSRF 적용 시 CSRF Token이다.
> Server의 지속 저장 관계는 `HttpSession → SecurityContext → Authentication`이다.
> 후속 요청의 복원 흐름은 `JSESSIONID → HttpSession → SecurityContext → SecurityContextHolder`이다.

판정: `PASS_AFTER_CORRECTION`

- Browser는 `SecurityContext`가 아니라 Session ID가 담긴 Cookie를 보관하고 전송한다.
- 인증 성공 결과는 인증된 `Authentication`이며, `SecurityContext`가 이를 보관한다.
- `SecurityContextHolder`는 `HttpSession`의 하위 저장 객체가 아니라 현재 요청을 처리하는 실행 흐름에서 복원된 `SecurityContext`를 제공한다.
- 유효한 Session의 후속 요청은 Password를 다시 검증하지 않고 이전 인증 결과를 복원한다.

이 판정은 사용자의 재설명에 대한 개념 근거다. Login 성공·실패 Test와 Session 재사용 Test는 아직 `NOT_RUN`이다.

## 문답 3 — Role 인가와 `401`·`403`·`200`

조건:

- 존재하는 Ticket에 대한 `GET`
- CSRF 검증 대상이 아님
- Endpoint는 `AGENT` Role만 허용
- Controller에 도달해 조회에 성공하면 `200`

최초 답변에서는 익명 사용자의 Authorization 결정을 `Null`, `USER`의 결정을 `Unauthorized`라고 표현했고, 근거 없이 `AGENT`가 `USER` Role도 함께 가진다고 가정했다. Status와 Controller 진입 여부는 올바르게 구분했다.

교정 후 사용자가 설명한 최종 흐름:

> 익명은 유효한 Login `Authentication`이 없고 Authorization은 `DENY`이므로 `401`이며 Controller에 진입하지 않는다.
> `ROLE_USER`는 인증되었지만 `AGENT` 조건에 대한 Authorization이 `DENY`이므로 `403`이며 Controller에 진입하지 않는다.
> `ROLE_AGENT`는 인증되었고 `AGENT` 조건에 대한 Authorization이 `GRANT`이므로 Controller에 진입하며, 존재하는 Ticket 조회 결과는 `200`이다.

판정: `PASS_AFTER_CORRECTION`

- Authorization의 일차 결정은 `GRANT` 또는 `DENY`다.
- 같은 `DENY`라도 유효한 Login 인증이 없으면 이번 API 계약의 `401`, 인증되었지만 권한이 부족하면 `403`으로 구분한다.
- 별도 Role 계층이나 복수 Role 부여 근거가 없으므로 `ROLE_AGENT`에 `ROLE_USER`까지 있다고 가정하지 않는다.
- `200`은 Authorization 자체의 결과가 아니라 `GRANT` 이후 Controller가 존재하는 Ticket을 정상 조회한 결과다.

이 판정은 사용자의 재설명에 대한 개념 근거다. 익명 `401`, `USER` 조회 `403`, `AGENT` 조회 성공 Security Test는 아직 `NOT_RUN`이다.

## 문답 4 — `302`와 `401`의 공통 차단 지점

`AuthenticationEntryPoint`라는 용어를 설명하기 전에 구현 결과 예측을 요구해 질문을 이해하기 어렵게 만들었다. 먼저 Default Web 방식과 목표 API 방식의 차이를 다음처럼 분리했다.

```text
익명 보호 Request
→ Security에서 차단
→ Default Web 방식: 302 Location: /login
→ 이번 API 방식: 401
→ 두 방식 모두 Controller 미진입
```

설명 후 사용자가 답한 내용:

> 응답이 `302`이든 `401`이든 접근이 거부된 요청은 Controller에 진입하지 못한다.

판정: `PASS`

이번 조건에서는 유효한 Login 인증이 없기 때문에 Security 단계에서 끝난다. `302`와 `401`은 Controller 진입 여부가 아니라 인증되지 않은 Client에게 인증 필요를 표현하는 방식의 차이다.

## Block 1 실행 — 익명 API `401`

> 실제 실행 시각: 2026-09-12 14:26~14:29 KST

### Red 조건 통제

새 실제 Context Test는 익명 `GET /api/tickets/999`에 `401`, `Location` 없음, Handler `null`을 요구했다. 첫 실행은 `Accept: application/json`을 사용해 Default Security 상태에서도 통과했지만, 기존 `302` 실험의 `Accept: application/problem+json`과 조건이 달라 유효한 Red-Green 비교로 인정하지 않았다.

`Accept`를 기존 조건과 같게 수정한 뒤에는 기대 `401`, 실제 `302 Location: /login`으로 Test 1개가 실패했고 Handler가 `null`임을 다시 확인했다.

### Green과 회귀

- `/api/**`는 인증이 필요하도록 최소 `SecurityFilterChain` 구성
- 익명 API 인증 실패에 `HttpStatusEntryPoint`의 `401` 적용
- Role별 규칙과 실제 사용자는 아직 추가하지 않음
- `spring-security-test` 7.1.1 확인
- 기존 Web Infrastructure Test에는 Request별 `AGENT` Test Double을 사용해 Controller·Interceptor 도달 조건만 제공
- 최종 전체 Test 34개 통과, 실패·오류·건너뜀 0

판정: `BLOCK_1_PASS`

이 실행으로 증명한 것은 실제 Filter Chain의 익명 API `401`, Redirect 없음, Controller 미진입과 기존 회귀다. PasswordEncoder·실제 Login·Session 재사용·Role Matrix·CSRF는 여전히 `NOT_IMPLEMENTED`·`NOT_RUN`이다.
