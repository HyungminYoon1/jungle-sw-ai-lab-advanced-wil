# 2026-09-29 — Browser에서 PostgreSQL까지 한 요청으로 연결하기

> 학습 범위: 최소 Ticket UI, Response Race, Session·CSRF, Credential CORS, PostgreSQL 영속성, Test·Coverage·Lint
> 상태: Completed — Local 수직 흐름과 품질 검증, 블로그·포럼 게시, 핵심 개념 독립 재설명 완료.

## 핵심 질문

1. `fetch`가 fulfilled인데도 화면에 Ticket을 표시하지 않아야 하는 경우는 무엇인가?
2. Ticket 1의 응답이 Ticket 2보다 늦게 오면 성공과 실패 분기에서 공통으로 확인해야 하는 값은 무엇인가?
3. Browser가 `JSESSIONID`를 자동 전송해도 JavaScript가 CSRF Header를 직접 구성해야 하는 이유는 무엇인가?
4. Cross-Origin `OPTIONS`가 성공한 뒤에도 실제 `POST`의 인증·CSRF·인가가 실패할 수 있는 이유는 무엇인가?
5. 같은 PostgreSQL Row를 새 Java Process가 읽는 결과와 새 PostgreSQL Container에서도 읽는 결과는 왜 서로 다른 근거인가?
6. Code의 Line Coverage가 `100%`여도 잘못된 `401` UI Mapping을 놓칠 수 있는 이유는 무엇인가?
7. Browser UI Test, Security Integration Test, PostgreSQL Integration Test와 실제 Browser E2E는 각각 무엇을 증명하는가?

## Response를 받는 것과 올바른 Ticket을 받는 것은 다르다

내가 구분할 세 단계는 다음과 같다.

```text
fetch가 Response를 읽을 수 있음
→ response.ok로 HTTP 성공 확인
→ response.json()으로 JSON 문법 해석
→ isTicket(body)로 Ticket의 필드·Type·값 확인
→ 화면 표시
```

`200 OK`는 Body가 Ticket이라는 보증이 아니다. JSON 문법이 틀리면 `response.json()`에서 실패한다. 문법이 맞아도 제목이 빈 문자열이라면 Ticket 검증에서 실패한다. 이때 화면은 `showTicket`으로 넘어가서는 안 된다. 반면 CORS 차단이나 연결 실패로 Response 자체를 읽지 못하면 확인할 HTTP Status가 없으므로 이를 임의로 `404`나 `500`이라고 부르지 않는다.

## 오래된 요청의 성공뿐 아니라 실패도 막는다

이전에는 늦게 온 Ticket 1의 성공 결과가 Ticket 2 화면을 덮는 경우만 Race로 떠올렸다. Ticket 2의 오류 화면을 표시한 뒤 Ticket 1의 늦은 실패가 도착해 Network Error 화면으로 바꾸는 것도 같은 문제다.

이번 최소 UI는 조회를 시작할 때 요청 번호를 증가시키고, 각 응답이 현재 번호인지 확인한 뒤에만 화면을 변경한다. `AbortController`는 이전 요청의 취소를 시도하지만, 취소만으로 모든 늦은 결과를 막는다고 가정하지 않는다. **성공·HTTP 오류·JSON 오류·읽을 Response가 없는 오류 분기 모두에서 최신 요청 여부를 확인한다.**

## Session, CSRF, CORS는 서로 다른 질문을 푼다

같은 Origin의 로그인 Browser에서는 후속 요청에 Session Cookie가 붙는다. Server는 그 ID로 Session의 인증 정보를 복원한다. 상태 변경 `POST`에는 Cookie만으로 부족하므로, JavaScript가 `/api/csrf` 응답의 `headerName`과 `token`으로 CSRF Header를 구성한다. Token이 없는 `POST`는 인증된 사용자라도 CSRF 단계에서 `403`이 될 수 있다.

다른 Origin의 JSON `POST`에는 Preflight가 선행된다. `OPTIONS`는 Cookie 없는 요청이므로 일반 로그인 검사에 먼저 막히지 않도록 CORS 처리가 앞서야 한다. Preflight가 통과했다는 것은 해당 Origin·Method·Header 조합을 Browser가 시도할 수 있다는 뜻이지, 뒤따르는 실제 `POST`가 로그인·CSRF·Role 검사를 통과한다는 뜻은 아니다.

## 실제 저장 근거와 그 한계

최소 UI를 실제 Browser에서 열고 AGENT가 로그인해 Ticket을 생성했다. 같은 Browser에서 CSRF 정보를 읽어 Header에 넣었고, 생성 뒤 PostgreSQL Row를 직접 확인했다. Browser의 동적 Button을 눌러 기존 Ticket을 다시 조회했다. 다른 Local Origin에서도 Browser Network 이벤트에 `OPTIONS`와 `POST`가 모두 관찰됐고, 실제 `POST`는 `201`이며 Database Row가 추가됐다.

Java Process를 종료하고 새 PID로 실행한 뒤에도 같은 PostgreSQL Container의 Row를 조회했다. 이것은 이전에 통과한 **같은 JVM 안의 Spring Context 재생성**보다 한 단계 강한 Application Process 재시작 근거다. 그러나 PostgreSQL Container를 새로 만든 실험은 아니므로 Database Container·Volume·Host 재시작 뒤 보존까지 주장하지 않는다.

## Coverage와 Test의 기대값은 별개다

Ticket UI Source의 Node Test는 12개 통과했다. `ticket-ui.mjs`의 Line Coverage는 `85.51%`, Branch Coverage는 `77.05%`였다. 이는 어떤 Code가 실행됐는지를 알려주지만 그 결과를 충분히 확인했는지는 알려주지 않는다.

[작은 Coverage 예제](../examples/coverage-oracle-demo.test.mjs)는 의도적으로 `401`을 `forbidden`으로 잘못 분류했다. 모든 줄과 분기를 실행해 Coverage는 `100%`여도, Truthy만 확인하는 약한 Assertion은 이 결함을 놓쳤다. 정확히 `login-required`를 기대하는 Assertion에서는 결함이 드러났다. Lint는 또 다른 종류의 검사다. 실제 Module의 정적 검사에는 오류가 없었고, 사용하지 않는 변수 예제를 넣자 `no-unused-vars`가 오류를 찾아냈다.

## 실행 근거와 남은 확인

- 실제 Browser·PostgreSQL E2E: Migration, AGENT 정상, Cross-Origin `OPTIONS`·`POST`, 새 Java Process 조회, USER `403`, CSRF 없음 `403`, 익명 `401` 통과.
- Java Clean Test: 61개 통과, Failures·Errors·Skipped 0. JavaScript Test: 12개 통과, 실패·건너뜀 0. ESLint: 오류 0.
- 이 숫자는 Local 실행 근거다. 외부 배포·운영 환경이나 Database Container 재시작 검증이 아니다.
- Week 6 블로그 게시와 포럼 등록을 마쳤다.

## 마감 복습에서 바로잡은 이해

자료 없이 다시 설명하면서 Ticket 생성 요청의 경로를 Browser의 Session Cookie와 JavaScript가 붙이는 CSRF Header부터 Security Filter, Controller, Service, Repository와 PostgreSQL Row까지 연결했다. `IN_PROGRESS` Row를 조회할 때는 새 Ticket을 만드는 대신 저장된 상태를 복원해야 한다. 같은 Transaction의 두 번째 INSERT가 실패했다면 첫 번째 INSERT도 남지 않아야 하며, 예외 발생만이 아니라 Transaction 종료 뒤 Database Row로 확인한다.

처음에는 Cross-Origin 사전 `OPTIONS`에도 `JSESSIONID`가 실린다고 답했다. 다시 구분해 보니 사전 요청에는 Cookie가 없고, 허용된 뒤의 실제 요청에는 `credentials` 설정과 Cookie 정책이 허용할 때 Cookie가 실릴 수 있다. 사전 요청의 성공은 실제 `POST`의 인증·CSRF·인가 성공을 보장하지 않는다. CSRF Header가 빠진 `POST`는 Controller에 도달하지 못하고 Ticket도 생성되지 않는다.

늦게 도착한 Ticket 1의 실패가 최신 Ticket 2의 `404` 화면을 덮어서는 안 된다. 화면을 바꾸는 성공·실패 분기에서 최신 요청 번호를 확인해야 한다. JavaScript Unit Test, 실제 PostgreSQL Integration Test와 Browser E2E가 각각 확인하는 범위도 구분했다. Line Coverage는 실행 가능한 줄이 실행된 비율이며, 잘못된 `401` 화면 Mapping을 찾으려면 실행 여부뿐 아니라 정확한 기대값을 Assertion해야 한다.

자세한 실행 조건과 관찰 범위는 [Browser 수직 흐름 Lab Report](../lab-reports/2026-09-29-browser-session-csrf-postgresql-e2e.md)에 분리해 기록했다.
