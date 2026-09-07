# Week 4 학습 계획 — 인증·인가·Session·CSRF

> 기간: 2026-09-07 ~ 2026-09-13
> 상태: In Progress — 9월 7일 학습 완료, 9월 11일 Security Baseline 구현 대기
> 사용 가능일: 월요일·금요일·토요일만
> 목표 시간: 하루 약 5시간, 총 15시간
> Hard Limit: 하루 6시간을 넘기지 않고 남는 항목은 Cut Line에 따라 이월

## 이번 주 학습 질문

> Spring Security의 인증 Filter, Session과 Server-side 권한 검사는 어떤 순서로 Request를 거절하거나 Application으로 전달하며, CSRF는 이 흐름에서 무엇을 보호하는가?

## 시작 Baseline

계획 작성 시점의 Source와 실행 근거를 구분한다.

| 항목 | 확인 상태 |
|---|---|
| WIL Repository | `main`, HEAD `f7c2206`, 계획 작성 전 Working Tree Clean |
| AI Helpdesk Lab | `main`, HEAD `cc34275`, 계획 작성 시 Working Tree Clean |
| 현재 Web API | `POST /api/tickets`, `GET /api/tickets/{id}` |
| 현재 저장소 | `InMemoryTicketRepository`; PostgreSQL Adapter 없음 |
| 현재 Security | Spring Security 의존성·사용자·인증 설정 없음 |
| Week 4 구현 전 Test | 2026-09-07 19:23 KST `mvnw.cmd test`, 33개 통과·실패 0·오류 0·건너뜀 0 |

이 결과는 Security 추가 전 현재 In-memory Application 회귀 기준선이다. 인증·인가·Session·CSRF 또는 PostgreSQL Adapter 동작 근거로 사용하지 않는다.

## 3일 Scope 결정과 근거

기술 심화 공지의 113개 학습 묶음을 다시 검토했을 때 Week 1~3의 실제 근거 범위는 33개였다. 남은 항목을 월·금·토 3일에 넓게 다루기보다, 현재 Lab에서 실패 원인과 방어 경계를 Test로 확인할 수 있는 한 가지 흐름을 끝까지 학습하는 편이 이번 과정의 목적에 맞다.

| 검토한 대안 | 판단 |
|---|---|
| 기존 Week 4 범위를 3일에 모두 압축 | XSS는 Browser UI, SQL Injection은 Database Adapter 등 관찰 선행 조건이 없고 주제별 실패 Test가 얕아지므로 제외 |
| 보안 학습 전체를 Week 5로 이동 | Browser 학습과 보안 Baseline을 동시에 시작해 Week 5 범위가 과도해지므로 제외 |
| Session 인증 수직 흐름만 완료 | 인증·인가, Password Hashing, Session·Cookie, Role, `401`·`403`과 CSRF를 하나의 흐름에서 연결할 수 있어 선택 |

따라서 기존 Ticket API에 최소 Role Matrix를 적용하는 세 번째 대안을 선택한다. Login은 익명 접근을 허용하고, Ticket 생성은 `USER`와 `AGENT`, 단건 조회는 `AGENT`만 허용한다. 이 계약은 인증과 Role 검사를 분리해 관찰하기 위한 학습용 기준이며 Resource 소유권이나 Production Helpdesk 권한 설계로 일반화하지 않는다.

이번 주 비범위는 Week 5에 자동으로 누적하지 않는다. 9월 12일 WIL 작성 전 Must 완료 여부를 검토하고, XSS·CORS는 Browser 흐름, SQL Injection은 PostgreSQL Adapter, HTTPS·Secure Cookie는 배포 환경이 생겼을 때 각각 다시 판단한다.

## 우선순위와 Cut Line

### Must — Week 4 완료에 필요

- 공지 키워드 Coverage와 3일 Scope Review
- 인증·인가, `401`·`403`, Password Hashing과 Session 설명
- Spring Boot Dependency Management로 Security 의존성 추가 후 실제 해석 Version 확인
- `USER`와 `AGENT`의 최소 Role Matrix 적용
- Session Login과 후속 Request 인증 Test
- CSRF Token 누락·정상 Request 비교 Test
- Secret·Password·Log 노출 점검, 전체 회귀 Test와 WIL

### Should — Must가 예상보다 빨리 끝날 때만

- 실제 HTTP Client로 Login 전후 `Set-Cookie`·`Cookie` Header 한 번 추적
- 인증 전후 Session ID 변화 관찰
- 로컬 HTTP에서 보인 Cookie 속성과 HTTPS에서만 검증할 속성 구분

### 먼저 자를 항목

1. 실제 HTTP Client Trace를 자동화 Test 근거와 분리해 보류한다.
2. Session Fixation과 Cookie 속성 관찰을 설명 Note로 제한한다.
3. Custom JSON Login API를 만들지 않고 Framework Form Login을 사용한다.

### 이번 주에 시작하지 않을 항목

- Browser XSS UI와 CORS 재실험
- SQL Injection과 Database Adapter
- Login Rate Limiter
- JWT·Refresh Token·OAuth2
- HTTPS 인증서·배포와 분산 Session

## 월요일 — 범위·계약·실패 예상

### Block 1 — Coverage와 Scope Review (약 1시간 30분)

- 기술 심화 공지 13개와 113개 학습 묶음 Inventory 확정
- Week 1~3 근거를 `Completed`, `Partially Covered`, `Planned`, `Deferred/Excluded`로 분류
- 3일 제약에 따라 Session 수직 흐름과 이월 조건 결정

**산출물:** Git 제외 Coverage Review와 이 문서의 공개 Scope 결정·Week 4 실행 계획

### Block 2 — 보안 계약과 공식 문서 학습 (약 2시간)

- Authentication·Authorization, `401`·`403`을 권한 표에 연결
- Password 원문 검증과 `PasswordEncoder` 경계 비교
- 인증 성공 정보를 Session에 보존하는 위치와 Cookie 역할 설명
- CSRF가 인증 자체가 아니라 Browser가 자동 첨부하는 Credential을 악용한 요청을 막는 이유 정리

**예상 결과:** 익명은 인증 단계에서 `401`, 인증된 `USER`의 조회는 권한 단계에서 `403`, `AGENT` 조회는 Application까지 진행한다.

### Block 3 — Baseline·Red Test 설계 (약 1시간 30분)

- Lab의 전체 Test를 다시 실행하고 Test 수·성공·실패를 기록
- Spring Security 추가 전 현재 Endpoint가 인증 없이 통과함을 Baseline으로 확인
- Security Filter를 포함할 Integration Test와 기존 Standalone Controller Test의 책임 결정
- Password·Role·Session·CSRF Test 이름과 Given-When-Then 작성

**중단 조건:** 기존 Test가 실패하면 Security 구현을 시작하지 않고 Baseline 실패 원인을 먼저 분리한다.

**월요일 결과:** Completed — 개념 설명 Gate, Security 추가 전 33개 Test Baseline과 Red Test 계약을 완료했다. Spring Security Production Code와 Security Integration Test는 아직 수행하지 않았다.

## 화요일~목요일 — 학습 Block 없음

개인 일정으로 작업을 배정하지 않는다. 월요일 미완료분도 이 기간에 숨겨서 누적하지 않고 금요일 첫 Block에서 우선순위를 다시 판단한다.

## 금요일 — Password·Session·인증 실패

### Block 1 — 15분 회상과 Scope 재확인 (약 30분)

- 문서를 보지 않고 인증·인가, Session·Cookie와 CSRF 관계를 설명
- 월요일 미완료와 현재 Test 상태 확인
- Must를 방해하는 Should 항목 제거

### Block 2 — Security 구성과 Password 검증 (약 2시간 30분)

- Spring Boot가 관리하는 Security·Security Test 의존성 추가
- `PasswordEncoder`와 학습용 `USER`·`AGENT` 구성
- Runtime Credential은 환경에서 주입하고 Test Credential은 명시적 Fixture로 분리
- API Request에는 `401`, 권한 부족에는 `403`이 되도록 계약 구성

**검증:** 같은 원문을 두 번 Encode한 값은 서로 달라도 둘 다 `matches`를 통과하고 잘못된 원문은 실패한다.

### Block 3 — Login·Session Integration Test (약 2시간)

- Login 성공·실패 Test
- 로그인 전 보호 API 실패와 로그인 후 Session 재사용 성공 비교
- Test에서 Security Filter Chain이 실제 포함되었는지 확인

**중단 조건:** Redirect·`401` 계약이 섞이면 예외 Handler를 넓게 바꾸지 않고 API Entry Point와 Login 흐름을 분리해 원인을 기록한다.

## 토요일 — 인가·CSRF·회귀·WIL

### Block 1 — Role 우회 실패와 `401`·`403` (약 1시간 30분)

- `USER`의 Ticket 생성 성공
- `USER`의 Ticket 조회 직접 호출 `403`
- `AGENT`의 Ticket 조회 성공
- 화면 버튼 숨김과 Server-side Role 검사의 차이 설명

### Block 2 — CSRF 실패·정상 비교 (약 1시간 30분)

- 인증된 `POST /api/tickets`를 CSRF Token 없이 보내 `403` 확인
- 유효 Token을 포함해 요청이 Controller·Application까지 진행하는지 확인
- CSRF를 전역 비활성화하지 않고 Test 지원 API로 Token을 구성

### Block 3 — 회귀·보안 점검·WIL (약 2시간)

- 전체 Test 실행, Test 수와 실패·성공 기록
- Source·설정·Test Output·Log에서 원문 Password와 Secret 노출 여부 점검
- 가능하면 Login 전후 Cookie Header 또는 Session ID를 한 번 관찰
- Learning Note와 WIL 작성
- 미완료 항목을 아래 이월 Gate로 분류

## 검증 Matrix

| 관찰할 경계 | 최소 Test·Evidence | 완료 판단 |
|---|---|---|
| Password Hash | 같은 원문 2회 Encode, 두 `matches` 성공, 오답 실패 | Hash 값 자체를 공개하지 않고 Salt 효과 설명 가능 |
| 인증 실패 | 익명 보호 API 호출 | API 계약이 `401`이고 Application 미진입 |
| 인가 실패 | 로그인한 `USER`의 조회 호출 | `403`이며 UI 숨김과 무관한 Server 검사 |
| 권한 성공 | 로그인한 `AGENT`의 조회 호출 | 기존 성공 응답 계약 유지 |
| Session | Login 결과를 후속 Request에서 재사용 | 매 요청 Password 재전송 없이 인증 상태 복원 설명 가능 |
| CSRF | 인증된 POST의 Token 없음·유효 비교 | 없음은 `403`, 유효하면 다음 단계 진행 |
| 회귀 | 전체 Maven Test | 실행 시각·명령·Test 수·결과 기록 |
| Secret | 추적 Source와 공개 산출물 점검 | 원문 Credential·Token·환경 값 미노출 |

## Test 책임 분리

- 기존 Standalone Controller Test: Validation, HTTP 변환과 Problem Detail 계약을 빠르게 확인한다.
- Security Integration Test: 실제 Spring Context와 Filter Chain에서 인증·Session·Role·CSRF를 확인한다.
- Domain·Application Unit Test: Security Context를 알지 않고 Ticket 규칙과 Use Case를 계속 검증한다.
- 보안 도입으로 기존 공개 API 계약이 달라진 Test는 단순 회귀 실패가 아니라 의도한 계약 변경인지 먼저 분류한다.

## 이월 Gate

토요일 종료 시 각 항목을 다음 기준으로 처리한다.

| 상태 | 처리 |
|---|---|
| Must 완료 | Week 4 완료. Should 미완료는 WIL 한계로만 기록 |
| Test는 통과했지만 설명·근거 문서 미완료 | Week 4 `Partially Completed`; Week 5 첫 Block 전에 문서만 60분 이내 보완 |
| Session 또는 Role Matrix 미완료 | Week 4 `Partially Completed`; Week 5 Browser 작업 전에 Security Baseline을 우선 복구 |
| XSS·CORS | Week 5 핵심 Browser 흐름과 맞을 때만 선택 |
| SQL Injection | PostgreSQL Adapter가 생기기 전까지 이월하지 않음 |
| Rate Limiting | Login Baseline과 실패 측정 기준이 안정된 뒤 재검토 |
| HTTPS·Secure Cookie | Week 8 배포 환경에서 재검토 |

## GitHub Project Draft Issue 등록

2026-09-07에 [Team6 Tasks Report Project](https://github.com/orgs/Jungle-SW-AI-Lab-Advanced-1st-Week1-4/projects/1/)의 기존 명명 규칙에 맞춰 다음 5개 Draft Issue를 등록했다.

| 실행 순서 | Draft Issue | 초기 상태 |
|---:|---|---|
| 1 | `[week 4][윤형민] 3일 Scope Review와 인증·인가 계약 확정` | `Done` |
| 2 | `[week 4][윤형민] PasswordEncoder·Session 로그인 Baseline 구현` | `Ready` |
| 3 | `[week 4][윤형민] Role Matrix와 401·403 권한 Test` | `Backlog` |
| 4 | `[week 4][윤형민] CSRF·Cookie 경계와 Secret 노출 검증` | `Backlog` |
| 5 | `[week 4][윤형민] 전체 회귀 Test·WIL과 Week 5 이월 판단` | `Backlog` |

첫 Issue는 Coverage Review, Scope Decision과 계획 문서가 검증되어 `Done`으로 두었다. 구현을 아직 시작하지 않은 항목은 완료 처리하지 않았고, 금요일 첫 항목만 `Ready`로 두었다.

## 공식 참고 자료

- [Spring Security — Password Storage](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html)
- [Spring Security — Persisting Authentication](https://docs.spring.io/spring-security/reference/servlet/authentication/persistence.html)
- [Spring Security — Session Management](https://docs.spring.io/spring-security/reference/servlet/authentication/session-management.html)
- [Spring Security — Authorize HTTP Requests](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)
- [Spring Security — CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)
- [Spring Security Test — CSRF](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/csrf.html)
- [Spring Security Test — Form Login](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/form-login.html)

## 변경 기록

- 2026-09-07: 기술 심화 공지 113개 Coverage 검토 결과와 개인 일정 제약을 반영해 Week 4를 월·금·토 Session 인증 수직 흐름으로 축소했다.
- 2026-09-07: XSS·CORS는 Week 5 후보, SQL Injection은 Database Adapter 이후, HTTPS는 Week 8로 분리하고 나머지 보안 주제를 자동 누적하지 않기로 했다.
- 2026-09-07: GitHub Project에 Week 4 Draft Issue 5개를 등록하고 준비 작업은 `Done`, 첫 구현 항목은 `Ready`, 나머지는 `Backlog`로 설정했다.
- 2026-09-07: 별도 ADR을 유지하지 않고 검토한 대안, 선택 이유와 재검토 조건을 이 주간 계획에 통합했다.
- 2026-09-07: Security 추가 전 Maven 전체 Test 33개를 다시 통과하고, 인증·인가와 Password·Session·CSRF Learning Note 및 구현 전 Test 계약을 작성했다. 사용자의 최초 설명과 Security 구현·Integration Test는 아직 완료하지 않았다.
- 2026-09-07: 최초 설명에서 인증·인가의 목적과 Policy에 따른 Status 차이는 확인했다. Session ID와 Server-side 인증 정보, 정상 Cookie를 이용하는 CSRF, 복호화 없는 Password Hash 검증은 교정 후 재설명 대상으로 남겼다.
- 2026-09-07: 재설명에서 CSRF 공격 조건과 Token 검증은 확인했다. Session 상태의 마지막 연결은 보정했고, Password Hash의 저장된 Salt 재사용과 JWT 전달 위치에 따른 CSRF 차이는 추가 학습 대상으로 남겼다.
- 2026-09-07: 2차 재설명에서 저장된 Salt를 사용하는 단방향 Password 검증과 JWT의 Cookie·Bearer Header 전달 차이를 확인했다. Session ID로 `HttpSession`·`SecurityContext`를 복원하는 흐름만 최종 확인 대상으로 남겼다.
- 2026-09-07: 최종 재설명에서 Session ID로 `HttpSession`·`SecurityContext`를 찾고 요청 Thread의 `SecurityContextHolder`에 인증을 복원하는 흐름을 확인해 월요일 개념 Gate를 완료했다.
