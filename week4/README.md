# Week 4 — 인증·인가·Session·CSRF

> 기간: 2026-09-07 ~ 2026-09-13
> 상태: Completed — 9월 14일 통합 회상·보안 점검·WIL 블로그 게시·포럼 등록 완료
> 학습 가능일: 9월 7일 월요일, 9월 11일 금요일, 9월 12일 토요일
> 보완·마감일: 9월 14일 월요일 — 9월 13일은 개인 일정으로 `NOT_RUN`
> 공통 실습: AI Helpdesk Learning Lab

## 핵심 질문

> 사용자가 누구인지 확인하는 것과 그 사용자가 할 수 있는 행동을 분리하고, Session과 CSRF가 만드는 성공·실패 경계를 Test로 설명할 수 있는가?

## 이번 주 Context

원래 Roadmap의 Week 4에는 인증·인가와 여러 Web 취약점이 함께 포함되어 있다. 이번 주는 3일만 사용할 수 있고 범위 결정 당시 Lab에는 Spring Security, 사용자 모델과 Database Adapter가 없었다. 따라서 기존 Ticket 생성·조회 API에 최소 Role Matrix를 적용하는 Session 인증 수직 흐름만 필수 범위로 선택했다. Security Starter, 익명 API `401`, BCrypt, Test 전용 USER·AGENT의 Form Login·Session 복원, Role Matrix와 CSRF Token 누락·유효 비교까지 42개 Test로 검증했다. 9월 14일에는 자동 생성 기본 Password 안내가 Test Report에 남는 문제를 발견해 기본 사용자 자동 구성을 제외하고, 일반 `clean test` 42개와 Pattern 기반 노출 점검을 다시 통과했다. 같은 날 사용자가 WIL 블로그 게시와 포럼 등록을 완료했다고 확인했다. 외부 게시물 URL과 포럼 등록 화면은 제공되지 않아 Codex가 독립적으로 확인하지 않았다. Runtime 사용자 모델과 Database Adapter는 없다.

공지 키워드 전체 검토에서 공개 가능한 범위 결정과 이월 근거는 [상세 학습 계획](./weekly-plan.md)에 함께 기록한다. 상세 Source Audit은 공개 Repository에 포함하지 않는다.

## 권장 학습 순서

처음부터 Spring Security Class 이름을 모두 외우지 않는다. 사용자에게 보이는 한 번의 Login과 후속 Request를 먼저 이해한 뒤 Framework 구성요소와 Test로 내려간다.

1. [Form Login과 Session 인증 과정](./study-docs/session-authentication-flow.md)의 `먼저 읽는 5분 이야기`로 회원가입·Login·후속 Request의 전체 순서를 잡는다.
2. [Password·Session·CSRF](./study-docs/password-session-csrf.md)의 초심자용 Password 예시로 `encode`와 `matches`를 구분한다.
3. [Authentication·Authorization](./study-docs/authentication-authorization.md)에서 `401`·`403`·`200`이 갈리는 이유를 확인한다.
4. [Spring Test Annotation과 Test Boundary](./study-docs/spring-test-annotations-and-boundaries.md)에서 Test가 실제 Context·Filter를 포함하는지 판별한다.
5. 다시 Session 인증 과정으로 돌아가 `AuthenticationManager`, `SecurityContextRepository`와 Filter의 실제 책임을 읽는다.
6. [9월 11일 회상 Gate](./study-notes/2026-09-11-study-questions.md)에서 순서 암기와 구성요소의 역할 이해를 나누어 점검한다.
7. [9월 12일 학습 계획](./study-notes/2026-09-12-study-questions.md)에 따라 명시적 Security 계약과 Test를 작은 Green 단계로 구현한다.
8. [9월 14일 마감 기록](./study-notes/2026-09-14-study-questions.md)에서 전체 흐름을 다시 설명하고 기능 Test와 Log Audit을 구분한다.

## 선택한 학습 범위

- Authentication과 Authorization, `401`과 `403`
- Password Hashing·Salt 효과·안전한 비교
- Spring Security Filter Chain과 Server-side Role 검사
- Form Login, 단일 Server Session과 Cookie
- CSRF Token 누락·정상 조건
- Secret·Password·Log 노출 점검

### 최소 권한 계약

| 요청 | 익명 | `USER` | `AGENT` |
|---|---:|---:|---:|
| Login | 허용 | 허용 | 허용 |
| Ticket 생성 | `401` | 허용 | 허용 |
| Ticket 단건 조회 | `401` | `403` | 허용 |

`USER=생성`, `AGENT=조회`는 현재 API만으로 인증과 Role 차이를 관찰하기 위한 학습용 계약이다. Resource 소유권과 실제 Helpdesk 운영 권한은 이번 주에 설계하지 않는다.

## 이번 주 산출물

- `weekly-plan.md`: 3일 Block, Must·Should·Cut Line과 이월 규칙
- [Authentication·Authorization Learning Note](./study-docs/authentication-authorization.md): 인증·인가·`401`·`403`, Role Matrix와 MockMvc Test 경계
- [Password·Session·CSRF Learning Note](./study-docs/password-session-csrf.md): Hash·Session·Cookie·CSRF의 역할과 Test 경계
- [Form Login·Session 인증 과정 Learning Note](./study-docs/session-authentication-flow.md): 최초 Login, 인증 상태 저장과 후속 Request 복원 과정
- [Spring Test Annotation과 Test Boundary](./study-docs/spring-test-annotations-and-boundaries.md): JUnit·Spring Boot·Security Test Annotation이 준비하거나 우회하는 범위
- [Spring Security Baseline Lab Report](./lab-reports/2026-09-12-spring-security-baseline-lab.md): 의존성 단독 실험, Default `302`, 익명 API `401`, BCrypt, Form Login·Session, Role Matrix와 CSRF 비교 근거
- [Week 4 WIL](./wil.md): 이해 변화, 실패 원인, Test·Log 근거와 게시 완료 상태

산출물은 실제 학습과 실행 결과가 생긴 범위만 기록하며, 미수행 항목은 `NOT_IMPLEMENTED`·`NOT_RUN`으로 남긴다.

## 문서 역할

| 위치 | 역할 |
|---|---|
| `study-docs/` | 날짜와 개인 진도에서 독립적인 Security 개념 자료 |
| `study-notes/` | 날짜별 질문·답변, 이해 점검과 진행 상태 |
| `lab-reports/` | 재현 가능한 Test 조건·명령·결과와 증명 범위 |
| `weekly-plan.md` | 주간 범위, 일정·축소 기준과 변경 기록 |

## 완료 기준

- [x] 인증과 인가, `401`과 `403`을 이번 API Case로 설명한다.
- [x] 실제 Filter Chain에서 익명 API Request의 `401`, Redirect 없음과 Controller 미진입을 검증한다.
- [x] 동일 Password를 두 번 Encode한 결과와 `matches` 결과를 Secret 노출 없이 검증한다.
- [x] Test 전용 AGENT의 Form Login 결과를 같은 Mock Session의 후속 Request에 사용해 인증 상태 복원을 Test한다.
- [x] 익명·`USER`·`AGENT`의 권한 Matrix를 자동화 Test로 확인한다.
- [x] 인증된 안전하지 않은 Request가 CSRF Token 없이 실패하고 유효 Token에서 통과하는지 비교한다.
- [x] 기존 Test 전체 회귀 결과를 남긴다.
- [x] Source·설정·Test Output과 Log를 점검하고 발견한 기본 Credential 안내를 제거한 뒤 재검증한다.
- [x] 실행하지 않은 XSS·SQL Injection·Rate Limit·HTTPS를 완료로 표시하지 않는다.
- [x] Week 4 WIL에 실패, 한계와 Week 5 이월 결정을 기록하고 블로그 게시·포럼 등록을 완료한다. (2026-09-14 사용자 확인)

## 이번 주 비범위와 이월 후보

- Week 5 재검토: 실제 Browser UI의 XSS와 CORS
- PostgreSQL Adapter 이후: SQL Injection과 Parameterized Query
- Login Baseline 이후: Rate Limiting
- Week 8: HTTPS·TLS와 Secure Cookie
- 제외 유지: JWT·Refresh Token·OAuth2, Redis Session Cluster, File Upload 보안

## 관련 문서

- [2026-09-07 학습 질문과 구현 전 Test 계약](./study-notes/2026-09-07-study-questions.md)
- [2026-09-11 회상 Gate와 Security Baseline 준비](./study-notes/2026-09-11-study-questions.md)
- [2026-09-12 Security Baseline·권한·CSRF 학습 계획](./study-notes/2026-09-12-study-questions.md)
- [2026-09-14 통합 회상·Secret·Log 마감](./study-notes/2026-09-14-study-questions.md)
- [Form Login과 Session 인증 과정](./study-docs/session-authentication-flow.md)
- [Spring Test Annotation과 Test Boundary](./study-docs/spring-test-annotations-and-boundaries.md)
- [Spring Security Baseline Lab Report](./lab-reports/2026-09-12-spring-security-baseline-lab.md)
- [Week 4 WIL](./wil.md)
- [Week 4 상세 학습 계획](./weekly-plan.md)
- [12주 주차별 Roadmap](../plan/weekly-roadmap.md)
