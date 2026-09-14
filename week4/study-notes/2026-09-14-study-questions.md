# 2026-09-14 — Week 4 통합 회상과 Secret·Log 마감

> 날짜: 2026-09-14
> 상태: Session Completed — 통합 회상·보안 점검·최종 회귀 완료
> 9월 13일 상태: 개인 일정으로 `NOT_RUN`
> 시작 구현 상태: Session Security 핵심 Test 42개 통과, 보안 점검·WIL 미완료
> 종료 구현 상태: 기본 사용자 자동 구성 제외, 전체 Test 42개 통과

## 날짜와 범위

9월 13일에는 학습이나 구현을 진행하지 않았다. Week 4 기간 안에 끝내지 못한 다음 Must 항목만 9월 14일 보완 범위로 가져왔다.

1. Session·Role·CSRF 전체 흐름 회상
2. Source·설정·Test Output·Log의 Secret 노출 점검
3. 전체 Clean Test 재실행
4. Week 4 WIL 작성·검토와 다음 주 이월 판단

실제 Browser Cookie·Session ID 관찰은 Should 범위이므로 이번 마감에 억지로 포함하지 않는다.

## 오늘의 핵심 질문

> 같은 `403`이라도 Role 인가 실패와 CSRF 검증 실패를 어떻게 분리하고, Test가 모두 통과한 뒤에도 Log를 별도로 점검해야 하는 이유를 설명할 수 있는가?

## 통합 회상 Gate

### 1. Session 인증 복원

처음에는 사용자가 검색해서 얻은 설명을 제시했다. 내용의 방향은 맞았지만 외부 자료를 다시 적은 문장만으로 독립 이해를 판정하지 않았다. 구체적인 객체 관계를 그림으로 확인한 뒤 사용자가 다음과 같이 다시 설명했다.

> Browser가 `JSESSIONID`를 보내면 Server는 해당 Session ID의 `HttpSession`을 찾고, 그 안의 `SecurityContext`를 현재 Request의 `SecurityContextHolder`에 복원한다.

판정: `PASS`

이 설명에서 Browser가 보관하는 것은 `SecurityContext`가 아니라 Session ID Cookie다. Server의 지속 저장 관계와 현재 Request의 복원 관계는 다음처럼 구분한다.

```text
Server 저장: HttpSession → SecurityContext → Authentication
Request 복원: JSESSIONID → HttpSession → SecurityContext → SecurityContextHolder
```

### 2. Status와 Controller 진입 Matrix

사용자는 다음 다섯 Case의 Status와 Controller 진입 여부를 자료 없이 모두 구분했다.

| Case | Status | Controller |
|---|---:|---|
| 익명 사용자의 Ticket 조회 | `401` | 미진입 |
| 로그인한 `USER`의 Ticket 조회 | `403` | 미진입 |
| 로그인한 `AGENT`의 존재하는 Ticket 조회 | `200` | 진입 |
| 로그인한 `USER`의 CSRF Token 없는 Ticket 생성 | `403` | 미진입 |
| 로그인한 `USER`의 유효한 CSRF Token이 있는 Ticket 생성 | `201` | 진입 |

판정: `PASS`

`200`과 `201`은 Authorization의 결과 자체가 아니라 Security 검사를 통과한 뒤 Controller가 정상 처리한 결과다.

### 3. 같은 `403`의 서로 다른 원인

두 `403`의 원인을 다시 물었을 때 `USER` 조회는 권한 부족이라고 올바르게 설명했다. 반면 Token 없는 POST는 처음에 현재 권한이 유효하지 않거나 Token 갱신이 필요한 상태라고 설명했다.

교정한 최종 구분은 다음과 같다.

```text
USER의 Ticket 조회
→ Authentication 복원 성공
→ 조회에 필요한 AGENT Role 없음
→ Authorization DENY
→ 403

USER의 Token 없는 Ticket 생성
→ Authentication 복원 성공
→ USER는 생성 Role 조건 충족
→ CSRF 검증 실패
→ 403
```

사용자의 최종 답변: `CSRF 검증 실패`

판정: `PASS_AFTER_CORRECTION`

두 응답은 Status만 보면 같지만 원인은 다르다. 현재 Test는 Token 없는 POST에서도 `USER` Authentication이 복원됐음을 먼저 확인하고, 같은 Session·Method·URI·Body·Role 조건에서 Token 유무만 바꿔 원인을 격리한다.

### 통합 판정

판정: `PASS_AFTER_CORRECTION`

- Session 객체 흐름은 다시 설명했다.
- `401`·`403`·`200`·`201`과 Controller 진입 여부는 구분했다.
- Role 부족과 CSRF 검증 실패는 한 차례 교정 뒤 분리했다.
- 한 번의 통과는 장기 기억을 보장하지 않으므로 Week 5 시작 전에 짧은 지연 회상을 다시 수행한다.

## 전체 Test 재실행

2026-09-14 10:38 KST에 Lab에서 일반 명령으로 전체 Test를 다시 실행했다.

```powershell
.\mvnw.cmd clean test
```

| 항목 | 결과 |
|---|---:|
| Test | 42개 |
| 실패 | 0개 |
| 오류 | 0개 |
| 건너뜀 | 0개 |

이 결과는 기존 In-memory Application과 Week 4 Security Test의 회귀 근거다. Runtime 사용자, 실제 Browser Cookie 흐름이나 PostgreSQL Adapter의 근거가 아니다.

## Secret·Log 노출 점검

### 첫 점검에서 발견한 문제

추적 Source·설정·공개 Markdown과 생성된 Surefire Report를 값이 아니라 Pattern의 존재 여부로 점검했다. 실제 고정 Secret·Token·Credential 파일은 찾지 못했지만, 두 통합 테스트 Report에서 Spring Boot의 자동 생성 기본 보안 Password 안내가 각각 한 번씩 발견됐다.

값은 확인하거나 기록하지 않았다. 이 Credential은 실제 운영 Credential이 아니라 자동 구성된 임시 개발용 값이지만, Password 값을 Log에 남기지 않는다는 이번 학습 계약에는 맞지 않는다. 또한 Test 42개가 모두 통과해도 별도 Log 점검은 실패할 수 있음을 보여 준다.

### 원인과 최소 변경

일반 Application Context에는 Runtime `UserDetailsService`가 없으므로 Spring Boot의 `UserDetailsServiceAutoConfiguration`이 기본 사용자를 만들고 Password를 안내했다. Session Test의 USER·AGENT는 Test 전용 Configuration에서만 제공되므로 이 자동 사용자는 이번 Lab 계약에 필요하지 않다.

먼저 임시 실행 Option으로 해당 자동 구성만 제외했다. Test 42개는 그대로 통과했고 생성 Password 안내는 0건이었다. 이 대조 결과를 확인한 뒤 Application 진입점에서 기본 사용자 자동 구성을 명시적으로 제외했다.

이 변경은 Runtime 사용자를 구현했다는 뜻이 아니다. 오히려 현재 Runtime 사용자가 없다는 상태를 분명하게 유지하며, 실제 사용자 저장소가 생길 때 별도 인증 구성으로 교체해야 한다.

### 최종 재검증

2026-09-14 10:43 KST에 별도 실행 Option 없이 다시 `clean test`를 실행했다.

| 항목 | 결과 |
|---|---:|
| Test | 42개 |
| 실패·오류·건너뜀 | 모두 0개 |
| Console의 생성 Password 안내 | 0건 |
| Surefire Report의 생성 Password 안내 | 0건 |
| Report의 BCrypt Encoding 값 | 0건 |
| Report의 Session ID 값 | 0건 |
| Report의 CSRF Token 값 | 0건 |

추적 파일에 대해서는 대표 Private Key·Access Token·JWT·BCrypt Literal과 민감 값의 직접 대입, 추적 `.env`·Credential 파일을 Pattern 기반으로 확인했으며 발견 건수는 0이었다. 공개 Markdown의 로컬 절대 경로도 0건이었다.

이 결과는 선택한 Pattern과 현재 생성 Report 범위의 점검 근거다. 모든 종류의 Secret 유출이 영원히 불가능하다는 보장은 아니다.

판정: `SECRET_LOG_AUDIT_PASS_AFTER_FIX`

## Week 4 마감 판단

### 완료한 Must

- Authentication·Authorization과 `401`·`403` 구분
- BCrypt Password Encoding과 `matches`
- Form Login과 Mock Session 인증 복원
- USER·AGENT Role Matrix
- CSRF Token 누락·유효 조건 비교
- 전체 Clean Test와 Secret·Log 점검
- Week 4 WIL 작성·검토, 블로그 게시·포럼 등록 완료 (사용자 확인)

### 완료로 표시하지 않는 범위

- Production Runtime 사용자 저장소와 실제 Credential 관리: `NOT_IMPLEMENTED`·`NOT_RUN`
- 실제 Browser의 `Set-Cookie`·`Cookie` Network Trace: `NOT_RUN`
- Cookie의 `SameSite`·`Secure`·`HttpOnly` Runtime 관찰: `NOT_RUN`
- PostgreSQL Adapter·Integration Test: `NOT_IMPLEMENTED`·`NOT_RUN`
- XSS·SQL Injection·Rate Limiting·HTTPS: Week 4 비범위

Week 4의 선택한 Must 범위는 완료했다. 실제 Browser Cookie 관찰은 Should였으므로 자동으로 Week 5 Must에 누적하지 않는다.

## WIL 공개와 포럼 등록

사용자는 2026-09-14에 Week 4 블로그 게시와 포럼 등록을 완료했다고 확인했다. 외부 게시물 URL과 포럼 등록 화면은 이 대화에 제공되지 않았으므로 Codex가 독립적으로 재확인하지는 않았다. 이 구분을 유지한 채 Week 4 공개 기록 절차를 완료로 처리한다.

## 다음 회상 질문

Week 5 시작 전에 자료 없이 다음 세 문장을 완성한다.

1. Browser가 후속 Request에서 보내는 것은 ______이고, Server가 복원하는 것은 ______이다.
2. 인증된 `USER`의 조회 `403`은 ______ 실패이고, 같은 USER의 Token 없는 생성 `403`은 ______ 실패다.
3. 전체 Test가 Green이어도 별도 Log 점검이 필요한 이유는 ______이다.
