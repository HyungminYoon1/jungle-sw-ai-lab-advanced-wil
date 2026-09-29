# 2026-09-29 Browser·Session·CSRF·PostgreSQL 수직 흐름 Lab

> 상태: Local 실행 검증 완료. 외부 배포·운영 환경 검증은 아님.
> 범위: 최소 Ticket UI, 실제 Browser, Spring Security, JDBC Adapter, PostgreSQL 17.6, JavaScript Test·Coverage·Lint

## 검증하려는 경계

```text
Browser Ticket UI
→ JSESSIONID와 CSRF Header
→ Spring Security 인증·인가
→ TicketController → TicketApplicationService
→ TicketRepository Port → JdbcTicketRepository
→ PostgreSQL Row
→ HTTP Response → UI
```

`MockMvc`의 Session 재사용 Test는 Server 측 Filter Chain 근거이지만 Browser가 Cookie와 Header를 실제로 구성했다는 근거는 아니다. 반대로 UI의 가짜 Fetch Test만으로 PostgreSQL 저장을 주장할 수도 없다. 이번에는 두 범위를 별도로 검사하고 실제 Browser 수직 흐름을 추가했다.

## 실행 환경과 재현 명령

- Java 25, Spring Boot 4.1.1, Node.js 22.23.2, Docker Engine, PostgreSQL `17.6-alpine`.
- 실제 Browser 검증은 Playwright CLI `0.1.21`을 사용한다. 검증 스크립트는 일회용 PostgreSQL Container와 Local Runtime USER·AGENT를 생성하고 종료 시 정리한다. Credential 값은 출력하지 않는다.
- Local Port `15432`, `18081`, `18082`가 비어 있어야 한다. 이 Script는 운영 Database나 배포 환경을 대상으로 하지 않는다.

```powershell
cd <Helpdesk Lab 저장소>
node --experimental-test-coverage --test src/test/js/ticket-ui.test.mjs
npx --yes --package eslint@10.11.0 eslint src/main/resources/static/*.mjs src/test/js/*.mjs
.\mvnw.cmd -q clean test
.\scripts\Verify-Week6BrowserE2E.ps1
```

## 실제 Browser와 Database 관찰

| 조건 | 관찰과 판정 |
|---|---|
| 빈 PostgreSQL | Flyway V1이 적용된 History Row 확인 |
| AGENT의 같은 Origin UI | Form Login 뒤 CSRF 정보를 읽고 Ticket 생성·조회 성공. 화면의 제목은 `textContent`로 들어가 Markup으로 해석되지 않음 |
| 생성 후 Database | Browser가 만든 Ticket과 동일한 제목의 PostgreSQL Row 1건 확인 |
| 동적 Ticket Button | 내부 `span`을 눌러도 상위 목록의 Event Delegation으로 조회 성공 |
| 다른 Local Origin의 Credential 요청 | Browser Network 이벤트에 `OPTIONS`와 `POST` 모두 존재. JavaScript가 실제 POST `201` Response를 읽고 PostgreSQL Row 총 2건 확인 |
| Java Process 종료·재시작 | PostgreSQL Container는 유지하고 새 Java PID로 실행한 뒤 기존 ID 조회 성공 |
| 인증된 USER의 AGENT 전용 조회 | UI에서 권한 부족 표시, `403` 계약 확인 |
| 인증된 USER의 CSRF Header 없는 POST | `403`, Database Row 수 증가 없음 |
| 익명 Ticket 조회 | 로그인 필요 표시, `401` 계약 확인 |

Cross-Origin 요청은 JSON Body와 사용자 정의 CSRF Header를 사용하므로 Preflight 대상이다. Playwright CLI의 일반 요청 목록에는 `POST`만 보여 `OPTIONS`가 없다고 오판할 수 있었다. Browser Network 이벤트를 별도로 수집하자 두 Method가 모두 나타났다. 이벤트 수집 배열은 `POST,OPTIONS` 순서일 수도 있었으므로 배열 순서 자체를 실제 전송 순서의 근거로 사용하지 않고, 두 Method의 존재와 읽을 수 있는 POST `201`, Database Row를 함께 확인했다. 허용 Origin의 Preflight `200`과 CORS 허용 Header는 별도 Spring Security Integration Test에서도 검증했다.

이 재시작 Test는 **새 Java Process와 같은 PostgreSQL Container** 사이의 영속성을 증명한다. PostgreSQL Container·Volume이나 Host 재시작 뒤 보존까지 증명하지 않는다.

## JavaScript 품질 Gate

| 검사 | 실행 결과 | 해석 |
|---|---:|---|
| Ticket UI Node Test | 12개 통과, 실패·건너뜀 0 | HTTP 상태, JSON 문법·Ticket 구조, CSRF, 이전 응답 Race, 알 수 없는 POST 결과를 작은 단위로 확인 |
| `ticket-ui.mjs` Coverage | Line `85.51%`, Branch `77.05%`, Function `100%` | 실제 Product Source 기준. Test File까지 합산한 `93.46%`를 Product Coverage로 쓰지 않음 |
| ESLint 10.11.0 | UI·Test Module 오류 0 | 지정한 정적 규칙 위반이 없다는 근거이며 동작 정확성 근거는 아님 |
| Lint 차이 실험 | 사용하지 않는 변수 한 줄을 Standard Input으로 넣자 `no-unused-vars` 오류 1건·Exit 1 | 실행 Test가 통과해도 정적 분석은 다른 결함을 찾을 수 있음 |
| Java `clean test` | 61개 통과, Failures·Errors·Skipped 0 | 기존 In-memory·Security 회귀와 PostgreSQL Integration Test를 함께 실행 |

Coverage의 한계는 [의도적으로 잘못된 Status Mapping 예제](../examples/coverage-oracle-demo.test.mjs)로도 재현했다. `401`을 `forbidden`으로 잘못 Mapping한 함수를 두 입력에서 실행했으므로 Line·Branch Coverage는 모두 `100%`였다. 그러나 결과가 단지 Truthy인지 확인하는 약한 Test는 통과했다. 정확한 문자열 `login-required`를 기대하는 Assertion은 같은 결함을 발견했다. Coverage는 실행 위치를 알려주지, 기대 결과가 올바르게 검증됐는지는 알려주지 않는다.

## 증명하지 않은 것

- 운영용 사용자 저장소, Credential 보관·회전 정책, 외부 배포와 HTTPS.
- PostgreSQL Container·Volume·Host 재시작 뒤의 복구 또는 Backup.
- 모든 Browser·Origin·Network 조건의 호환성. 이번 실제 E2E는 지정된 Local Browser와 두 Local Origin에 한정된다.
- 이 Lab 실행만으로 사용자의 개념 숙지까지 증명하지 않는다. 별도의 독립 설명 결과는 [9월 29일 학습노트](../study-notes/2026-09-29-study-questions.md)에 기록했다.

WIL 공개 문서에는 Session ID·Password·CSRF Token의 실제 값을 남기지 않는다.
