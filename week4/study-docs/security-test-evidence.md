# Lab Evidence — Spring Security Default Auto-Configuration과 익명 API `401`

> 학습 귀속일: 2026-09-11 — 자정을 넘긴 연장 Session
> 실제 실행 시각: 2026-09-12 00:41~00:42 KST
> 상태: 9월 11일 의존성 단독 실험과 9월 12일 익명 API `401` 최소 Baseline 완료
> 공개 원칙: 생성된 개발용 Credential 값은 기록하지 않는다.

## 실험 질문

1. Spring Security 의존성만 추가했을 때 기존 Standalone Controller Test와 실제 Spring Context Test는 각각 어떻게 달라지는가?
2. 익명 API Request를 Login Page로 Redirect하지 않고 `401`로 끝내면서도 기존 Web Infrastructure Test의 책임을 어떻게 보존할 것인가?

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

## 현재 증명 범위

| 항목 | 상태 |
|---|---|
| 실제 Filter Chain의 익명 API `401` | `IMPLEMENTED`·`RUN`·`PASS` |
| 익명 Request의 Redirect 없음 | `RUN`·`PASS` |
| 익명 Request의 Controller 미진입 | `RUN`·`PASS` |
| 인증 Test Double을 사용한 기존 Web Infrastructure 회귀 | `RUN`·`PASS` |
| Password Encoding과 `matches` | `NOT_IMPLEMENTED`·`NOT_RUN` |
| 실제 학습용 `USER`·`AGENT`와 Form Login | `NOT_IMPLEMENTED`·`NOT_RUN` |
| Login 성공 뒤 Session 재사용 | `NOT_IMPLEMENTED`·`NOT_RUN` |
| `USER` 조회 `403`·`AGENT` 조회 성공 | `NOT_IMPLEMENTED`·`NOT_RUN` |
| 인증된 `POST`의 CSRF Token 비교 | `NOT_IMPLEMENTED`·`NOT_RUN` |

상세 시간 제한과 Cut Line은 [2026-09-12 학습 계획](../study-notes/2026-09-12-study-questions.md)에 기록한다.
