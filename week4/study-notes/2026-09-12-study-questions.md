# 2026-09-12 — Security Baseline 완성과 권한·CSRF

> 날짜: 2026-09-12
> 상태: Ready — 9월 11일 미완료 구현 과업 이월
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
