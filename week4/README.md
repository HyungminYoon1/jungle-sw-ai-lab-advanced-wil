# Week 4 — 인증·인가·Session·CSRF

> 기간: 2026-09-07 ~ 2026-09-13
> 상태: In Progress — 9월 7일 학습 완료, 9월 11일 Security Baseline 구현 대기
> 학습 가능일: 9월 7일 월요일, 9월 11일 금요일, 9월 12일 토요일
> 공통 실습: AI Helpdesk Learning Lab

## 핵심 질문

> 사용자가 누구인지 확인하는 것과 그 사용자가 할 수 있는 행동을 분리하고, Session과 CSRF가 만드는 성공·실패 경계를 Test로 설명할 수 있는가?

## 이번 주 Context

원래 Roadmap의 Week 4에는 인증·인가와 여러 Web 취약점이 함께 포함되어 있다. 이번 주는 3일만 사용할 수 있고 현재 Lab에는 Spring Security, 사용자 모델과 Database Adapter가 없다. 따라서 기존 Ticket 생성·조회 API에 최소 Role Matrix를 적용하는 Session 인증 수직 흐름만 필수 범위로 선택한다.

공지 키워드 전체 검토에서 공개 가능한 범위 결정과 이월 근거는 [상세 학습 계획](./weekly-plan.md)에 함께 기록한다. 상세 Source Audit은 공개 Repository에 포함하지 않는다.

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
- [Authentication·Authorization Learning Note](./study-docs/authentication-authorization.md): 인증·인가·`401`·`403` 설명과 Role Matrix
- [Password·Session·CSRF Learning Note](./study-docs/password-session-csrf.md): Hash·Session·Cookie·CSRF의 역할과 Test 경계
- `study-docs/security-test-evidence.md`: Test 실행, HTTP Trace와 Secret 점검 근거
- `wil.md`: 이해 변화, 실패 원인, 범위와 다음 질문

산출물 파일은 실제 학습과 검증이 시작될 때 추가한다. 빈 증거 문서를 미리 만들어 완료처럼 보이게 하지 않는다.

## 완료 기준

- [x] 인증과 인가, `401`과 `403`을 이번 API Case로 설명한다.
- [ ] 동일 Password를 두 번 Encode한 결과와 `matches` 결과를 Secret 노출 없이 검증한다.
- [ ] Form Login으로 Session이 생성되고 후속 Request가 Cookie로 인증되는 흐름을 Test한다.
- [ ] 익명·`USER`·`AGENT`의 권한 Matrix를 자동화 Test로 확인한다.
- [ ] 인증된 안전하지 않은 Request가 CSRF Token 없이 실패하고 유효 Token에서 통과하는지 비교한다.
- [ ] 기존 Test 전체 회귀 결과를 남긴다.
- [ ] 실행하지 않은 XSS·SQL Injection·Rate Limit·HTTPS를 완료로 표시하지 않는다.
- [ ] Week 4 WIL에 실패, 한계와 Week 5 이월 결정을 기록한다.

## 이번 주 비범위와 이월 후보

- Week 5 재검토: 실제 Browser UI의 XSS와 CORS
- PostgreSQL Adapter 이후: SQL Injection과 Parameterized Query
- Login Baseline 이후: Rate Limiting
- Week 8: HTTPS·TLS와 Secure Cookie
- 제외 유지: JWT·Refresh Token·OAuth2, Redis Session Cluster, File Upload 보안

## 관련 문서

- [2026-09-07 학습 질문과 구현 전 Test 계약](./study-notes/2026-09-07-study-questions.md)
- [Week 4 상세 학습 계획](./weekly-plan.md)
- [12주 주차별 Roadmap](../plan/weekly-roadmap.md)
