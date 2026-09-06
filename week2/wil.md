# Week 2 WIL — Controller 작성에서 요청 경계와 실패 책임 설명으로

> 기간: 2026-08-24 ~ 2026-08-29
> 상태: Completed — 선택한 HTTP·Spring MVC 구현·Test·Trace 완료, CORS는 범위 축소로 Deferred
> 문서 상태: 2026-08-31 게시 완료 — 2026-09-07 저장소 표준 위치에 복원
> 핵심 질문: 하나의 HTTP 요청이 Spring MVC의 각 Layer를 통과하는 흐름과 책임을 직접 추적할 수 있는가?

## 이번 주 요약

Week 1의 Ticket Domain을 크게 확장하지 않고 `POST /api/tickets`와 `GET /api/tickets/{id}`를 Spring MVC 요청 흐름에 연결했다. 시작할 때는 Controller가 JSON을 반환하면 REST API가 완성된다고 생각했지만, 실제로는 요청 변환·검증·Use Case·저장·예외 변환이 서로 다른 경계에서 일어났다. 정상 응답뿐 아니라 잘못된 JSON, 공백 제목, ID 형식 오류, Resource 부재와 내부 실패를 Test와 실제 HTTP Trace로 구분했다. 선택한 필수 범위와 Filter·Interceptor 최소 구현은 완료했지만 CORS는 일정 축소 기준에 따라 보류했고, Exception 구성요소 이름을 자료 없이 즉시 회상하는 숙련도는 후속 복습으로 남겼다.

## 시작점

- 알고 있다고 생각한 내용: Controller를 만들고 JSON을 반환하면 최소 REST API를 구현할 수 있다고 생각했다.
- 예상한 결과: HTTP 입력 검증과 Domain 검증, 조회 부재와 내부 실패를 Controller 중심으로 처리해도 충분하다고 예상했다.
- 가장 불확실했던 부분: Spring MVC가 요청을 Java 객체로 바꾸는 과정, Exception이 Web 오류 응답으로 변환되는 과정, MockMvc와 실제 HTTP 호출의 검증 범위
- 이번 주 비범위: PostgreSQL·JPA·Transaction, 인증·인가, Browser UI, AI 기능, 전체 CRUD와 배포

## 계획 대비 결과

| 목표 | 계획 | 실제 결과 | 상태 | 근거 |
|---|---|---|---|---|
| HTTP 메시지와 Stateless 설명 | Method·Status·Header·Body와 Protocol 상태를 구분 | 메시지 구조를 설명하고 HTTP Stateless와 In-memory 저장 수명을 별개 문제로 구분 | Completed | [8월 24일 학습 점검](./study-notes/2026-08-24-study-questions.md), [HTTP 메시지 Learning Note](./study-docs/learning-http-request-response-messages.md) |
| 구현 전 API 계약 작성 | 생성·조회와 대표 실패의 Status·Header·Body 예상 | `201`·`200`·`400`·`404`·대표 `500` 계약을 Given–When–Then과 표로 먼저 작성 | Completed | [8월 25일 학습 점검](./study-notes/2026-08-25-study-questions.md) |
| Ticket 생성·조회 수직 Slice | Controller·Service·Repository·Domain 책임 분리 | In-memory Repository 기반 생성·단건 조회와 정상 MockMvc Test 구현 | Completed | [8월 26일 구현 기록](./study-notes/2026-08-26-study-questions.md) |
| 입력·부재·내부 실패 계약 | 대표 실패를 안전한 `ProblemDetail`로 변환 | 잘못된 JSON·공백 제목·ID 형식은 `400`, 부재는 `404`, 통제된 내부 실패는 `500`으로 검증 | Completed | [8월 27일 오류 응답 기록](./study-notes/2026-08-27-study-questions.md) |
| 공통 요청 처리 경계 비교 | Filter·Interceptor·Exception Handler의 위치와 책임 비교 | Request ID Filter, Handler Timing Interceptor와 전체 Context 등록 Test까지 최소 구현 | Completed | [8월 29일 공통 처리 기록](./study-notes/2026-08-29-study-questions.md) |
| Exception 흐름 설명 숙련 | 발생·전파·Handler 선택·응답 변환을 자료 없이 설명 | 대표 흐름과 책임은 설명했지만 일부 Class·Method 이름의 즉시 회상은 후속 복습으로 유지 | Partially Completed | [8월 28일 복습 기록](./study-notes/2026-08-28-study-questions.md), [8월 29일 공통 처리 기록](./study-notes/2026-08-29-study-questions.md) |
| CORS Header 관찰 | Must 완료 후 Simple·Preflight 비교 | 일정 축소 순서에 따라 필수 범위에서 제외 | Deferred | [주간 학습 계획](./weekly-plan.md#우선순위와-축소-기준) |

## 핵심 학습

### HTTP의 Stateless와 Application 저장 상태는 다른 문제다

- 질문: HTTP가 Stateless이기 때문에 In-memory Ticket이 서버 재시작 뒤 사라지는가?
- 최소 실험: 실제 Request·Response에서 Header와 Body를 구분하고, In-memory Repository의 저장 수명과 HTTP 요청 문맥을 따로 추적했다.
- 관찰: HTTP는 이전 요청 문맥을 다음 요청에 자동으로 연결하지 않지만, 실행 중인 JVM은 여러 요청 사이에도 Ticket을 보관했다. Process를 종료하면 Database가 없는 In-memory 데이터가 사라졌다.
- 원리 설명: Stateless는 Protocol의 요청 문맥에 관한 성질이고, 데이터 보존은 Application의 저장 방식에 관한 문제다. `Content-Type`은 현재 Body 형식, `Accept`는 받을 수 있는 응답 형식을 표현한다.
- 사용하지 않을 조건: 서버 재시작 뒤 데이터가 사라졌다는 사실만으로 HTTP Stateless를 설명하지 않는다.

### HTTP 계약은 구현 전에 실패 의미까지 정한다

- 질문: 생성·조회와 잘못된 요청은 어떤 Status·Header·Body로 구분해야 하는가?
- 최소 실험: 정상 생성, 공백 제목, 정상 조회, 존재하지 않는 숫자 ID와 숫자가 아닌 ID를 구현 전에 Given–When–Then으로 작성했다.
- 관찰: 생성은 `201 Created`와 `Location`, 생성된 Resource의 후속 조회는 `200 OK`였다. `999`는 형식이 유효하지만 Resource가 없어 `404`, `abc`는 숫자형 Path Variable로 변환할 수 없어 `400`이었다.
- 원리 설명: Status는 Controller의 편의가 아니라 요청 처리 결과의 의미를 표현한다. 특정 Resource 부재와 정상적인 빈 목록도 같은 실패로 취급하지 않는다.
- 사용하지 않을 조건: 모든 성공을 `200`, 모든 실패를 `500` 하나로 표현하지 않는다.

### Layer는 자신이 아는 의미만 변환한다

- 질문: Repository의 조회 부재를 어느 Layer에서 `404`로 바꾸어야 하는가?
- 최소 실험: Repository의 `Optional.empty()`, Service의 `TicketNotFoundException`, Exception Handler의 `404 ProblemDetail` 변환을 한 흐름으로 추적했다.
- 관찰: Repository는 값의 부재만 표현했고, Service는 단건 조회 Use Case의 실패라는 의미를 붙였다. Web Boundary가 그 Application 실패를 HTTP `404`로 변환했다.
- 원리 설명: Controller는 HTTP 표현, Service는 Use Case, Repository는 저장 계약, Domain은 자신의 불변조건을 담당한다. Service가 `ProblemDetail`을 만들면 Application 계층이 HTTP에 결합된다.
- 사용하지 않을 조건: 저장소 오류를 빈 목록이나 부재로 바꾸어 실제 장애를 숨기지 않는다.

### 입력 검증과 Domain 검증은 서로 다른 진입 경계를 보호한다

- 질문: Request DTO의 `@NotBlank`가 있으면 Ticket 생성자 검증을 제거해도 되는가?
- 최소 실험: 공백 제목, 닫히지 않은 JSON과 Controller를 거치지 않는 Domain 생성을 비교했다.
- 관찰: 공백 제목은 DTO 생성 뒤 Bean Validation에서, 잘못된 JSON은 DTO 생성 전 Message 변환에서 실패했다. Controller 밖에서도 Ticket을 만들 수 있으므로 Domain 검증은 계속 필요했다.
- 원리 설명: Web Validation은 잘못된 HTTP 입력을 Use Case 앞에서 거부하고, Domain 검증은 모든 호출 경로에서 객체 불변조건을 보호한다.
- 사용하지 않을 조건: 같은 검증 문구를 여러 계층에 복사해 하나의 책임처럼 다루지 않는다.

### Filter·Interceptor·Exception Handler는 실행 위치와 정보가 다르다

- 질문: 세 구성요소가 모두 공통 처리라면 무엇을 기준으로 선택하는가?
- 최소 실험: 모든 요청의 Request ID는 Filter, 선택된 Controller Method와 최종 상태·시간은 Interceptor, Application 실패의 HTTP 변환은 Exception Handler에 두었다.
- 관찰: Filter는 DispatcherServlet 전후에서 동작했고, Interceptor는 `HandlerMethod` 정보를 사용할 수 있었다. 전체 Application Context Test로 404 응답 Header와 완료 로그를 확인했다.
- 원리 설명: 공통 처리라는 이름보다 필요한 실행 경계와 정보로 구성요소를 선택한다. 요청별 시작 시각은 Singleton Bean Field가 아니라 Request 속성에 저장해야 동시 요청 간 값 혼합을 피할 수 있다.
- 사용하지 않을 조건: 인증·인가를 직접 Interceptor에 재구현하지 않고 Spring Security의 Filter Chain을 우선 검토한다.

### Test와 실제 호출은 서로 다른 경계를 증명한다

- 질문: MockMvc가 통과하면 실제 Server와 Network까지 검증했다고 볼 수 있는가?
- 최소 실험: Standalone MockMvc, 전체 Context MVC Test와 Port `8080`의 실제 `curl.exe` 요청을 구분해 실행했다.
- 관찰: MockMvc는 HTTP 계약을 빠르게 반복 검증했고, 실제 호출은 Network·Tomcat·Application Context·직렬화를 포함했다. 개별 Filter·Interceptor 단위 Test만으로 Spring 등록은 증명되지 않았다.
- 원리 설명: 객체 동작, Framework 조립과 실제 Network 경로는 서로 다른 Test가 증명한다.
- 사용하지 않을 조건: 한 종류의 성공 결과를 다른 실행 경로의 근거로 확대하지 않는다.

## 예상과 실제의 차이

| 예상 | 실제 관찰 | 원인 해석 | 이해가 바뀐 점 |
|---|---|---|---|
| Controller가 JSON을 반환하면 REST API 구현이 끝난다. | Controller 전후에 Message 변환, Validation, Service·Repository 호출과 예외 해석이 있었다. | 한 요청은 여러 책임 경계를 통과한다. | Endpoint 수보다 요청 한 건의 변환과 책임을 먼저 추적한다. |
| HTTP Stateless 때문에 서버 재시작 뒤 Ticket이 사라진다. | 실행 중에는 요청 사이에 Ticket이 남고 JVM 종료 뒤 사라졌다. | Protocol 문맥과 저장소 수명은 다른 층위다. | Session 상태와 영속 데이터도 저장 위치를 따로 확인한다. |
| 결과가 없으면 단건 조회와 목록 조회가 같은 Exception을 반환한다. | 단건 부재는 `404`, 정상 목록 검색 0건은 `200 []`가 자연스러웠다. | 요청이 특정 Resource를 지목했는지에 따라 부재 의미가 다르다. | Service 결과 설계를 Use Case 의미에 맞춰 결정한다. |
| 같은 `400`이면 같은 단계에서 실패한다. | 공백 제목은 Validation, 잘못된 JSON은 Message 변환, `abc` ID는 Type 변환에서 실패했다. | 같은 HTTP Status 안에도 실패 지점과 Exception이 다르다. | Status뿐 아니라 발생 경계와 변환 책임을 함께 추적한다. |
| `ProblemDetail.type`은 항상 JSON의 `about:blank`로 보인다. | 값을 명시하지 않으면 JSON Member가 생략될 수 있었다. | 생략된 경우에도 RFC 의미상 기본값으로 해석될 수 있다. | 계약으로 정하지 않은 표현 세부사항을 과도하게 단언하지 않는다. |
| 객체 단위 Test가 통과하면 Spring 등록도 검증된다. | Filter·Interceptor 단위 Test만으로 실제 MVC 등록은 확인되지 않았다. | 객체 동작과 Framework 조립은 다른 검증 대상이다. | 전체 Context Test를 별도 근거로 둔다. |

## 선택 적용과 독립 Spike

- Helpdesk Lab에 적용한 내용: 기존 Ticket Domain을 유지한 In-memory Repository, 생성·단건 조회 Service와 Controller, Validation·오류 응답, Request ID Filter와 Handler Timing Interceptor
- 적용이 필요했던 이유: 하나의 HTTP 요청을 Web Boundary부터 Domain과 Response까지 작은 수직 Slice로 추적하기 위해서다.
- 독립적으로 확인한 내용: 대표 `500`은 Production 실패 Endpoint를 추가하지 않고 통제된 Repository Test Double로 재현했다.
- 조건부 후속·선정 제외한 내용: CORS는 일정 축소 기준에 따라 Deferred로 두었고, PostgreSQL·인증·UI·AI·전체 CRUD는 핵심 질문에 필요하지 않아 시작하지 않았다.
- 저장 경계: In-memory Repository 결과를 Database 영속화나 Transaction 검증 근거로 표현하지 않는다.

## Test와 학습 증거

| 근거 | 확인한 위험·질문 | 결과 | Link |
|---|---|---|---|
| 기존 Java Clean Test | Spring 변경 전 Domain·Policy 기준선 유지 | 2026-08-24, 16개 통과·실패 0·오류 0·건너뜀 0 | [8월 24일 학습 점검](./study-notes/2026-08-24-study-questions.md) |
| Spring Boot 최소 기동·Root Trace | Application Context와 실제 Server가 기동하는가? | Boot `4.1.1`, Tomcat `11.0.24`, Port `8080`의 Root `404` JSON 관찰 | [8월 25일 학습 점검](./study-notes/2026-08-25-study-questions.md) |
| 정상 수직 Slice Test | Repository·Service·Controller의 생성·조회 계약 | 정상 MockMvc 2개를 포함한 전체 24개 Clean Test 통과 | [8월 26일 구현 기록](./study-notes/2026-08-26-study-questions.md) |
| 오류 계약 Test·HTTP Trace | `400`·`404`·대표 `500`의 발생·변환 경계 | 전체 29개 Test 통과, 실제 정상·`400`·`404` 호출 관찰, 대표 `500`은 Test Double로 검증 | [8월 27일 오류 응답 기록](./study-notes/2026-08-27-study-questions.md) |
| 공통 요청 처리 단위·통합 Test | Filter·Interceptor 동작과 Spring 등록 | 새 Test 4개를 포함한 전체 33개 Clean Test 통과 | [8월 29일 공통 처리 기록](./study-notes/2026-08-29-study-questions.md) |

8월 29일의 전체 Clean Test는 기존 계약과 새 공통 요청 처리 구성을 검증한다. 실제 Server와 `curl.exe` Trace는 그 세션에서 다시 실행하지 않았으며, 실제 정상·대표 실패 호출은 8월 27일 근거다.

## 실패와 부분 완료

- GET Controller Test의 `NullPointerException`은 `setUp()`의 지역변수가 같은 이름의 Field를 가린 것이 원인이었다. Field 대입으로 수정한 뒤 정상 생성·조회 Test를 통과했다.
- `TicketApiExceptionHandler`를 처음 Test Source에 두어 Standalone MockMvc만 통과하고 실제 Application Component Scan에는 포함되지 않는 구조가 됐다. Production Source로 옮겨 실제 구성 경계를 바로잡았다.
- `ProblemDetail.type`의 JSON Member 존재를 계약으로 단언한 Test를 실제 Framework 표현과 RFC 의미에 맞게 제거했다.
- Mockito의 동적 Agent 경고를 한 실패 Case 때문에 추가 설정으로 덮지 않고 수동 Repository Test Double로 교체했다.
- Exception 처리 구성요소의 역할은 설명했지만 Class·Method 이름과 전체 순서를 자료 없이 즉시 회상하는 숙련도는 `Partially Completed`로 남겼다.
- AI 도움 없이 핵심 흐름의 작은 변형과 관련 Test를 수행하는 별도 Gate는 완료하지 못했다.
- CORS Simple·Preflight, 비동기 Dispatch, 운영 Monitoring과 분산 Trace는 수행하지 않았다.

## 설명 가능성 점검

- AI 도움 없이 설명할 수 있는 흐름: HTTP 메시지 요소, Stateless와 저장 상태의 차이, 생성·조회 Status, Layer 책임, 단건 부재와 목록 0건, Filter·Interceptor·Exception Handler 선택 기준
- 직접 수행한 작은 변경과 Test: Repository·Service·Controller·DTO, Validation·오류 Handler, Filter·Interceptor와 Unit·MVC·전체 Context Test 작성·수정
- 직접 실행한 검증: Maven Clean Test, Application 기동, 실제 `curl.exe` 정상·실패 요청과 응답 관찰
- 아직 답변 속도를 높일 부분: Spring MVC Exception 구성요소의 정확한 Class·Method 이름과 전체 전파 순서
- 다음 학습으로 넘긴 질문: 저장된 상태의 정합성을 Database Constraint·Transaction·Lock·Index로 어떻게 보호하고 관찰할 것인가?

## AI 활용

| 작업 | AI가 수행한 일 | 직접 판단·수정·검증한 일 |
|---|---|---|
| 개념 학습 | HTTP·Spring MVC 학습 순서, 단계형 질문과 오답 교정 제안 | 자신의 답변 작성, Stateless·상태 저장과 Layer 책임 구분 |
| API 계약 | Given–When–Then 질문과 Status·Header·Body 검토 | 정상·실패 입력과 결과를 먼저 결정하고 구현 결과와 대조 |
| Code·Test | 구현 순서, Test 관찰 지점과 실패 원인 후보 제안 | Production·Test Code 입력·수정, Test Double 선택과 계약 확정 |
| 실행·문서 | 실행 결과 해석과 문서 구조화 보조 | Maven·Server·`curl.exe` 직접 실행, 실제 결과 확인과 완료·보류 판단 |

AI가 제안한 설명과 Code는 직접 실행하거나 자신의 말로 다시 설명한 범위만 학습 근거로 사용했다. 대화 원문, Credential과 로컬 절대 경로는 공개 문서에 포함하지 않았다.

## 공개 기술 콘텐츠

- 주간 근거로 참조한 Study Note: 8월 24일 HTTP 기초부터 8월 30일 WIL·다음 주 계획까지 7개 기록
- 작성한 Learning Note: HTTP 메시지, Spring MVC 요청 흐름, Validation·오류 응답, Service 결과·실패 설계, Filter·Interceptor·Exception Handler
- Lab Report를 별도로 만들지 않은 이유: 실제 HTTP Trace와 Test 경계가 8월 27일 Study Note에 이미 있어 중복 문서를 만들지 않았다.
- 게시 콘텐츠: HTTP 요청에서 오류 응답까지의 이해 변화를 하나의 글로 재구성해 2026-08-31 게시했다.
- 아직 근거가 부족한 주장: 실제 운영 성능, Database 영속성, CORS의 Browser 동작, 보안·분산 Trace와 Production 신뢰성

## 회고

### 잘 작동한 학습 방식

- 구현 전에 정상·실패 계약을 적어 두자 Framework 기본값에 끌려가지 않고 Status와 Body 선택 이유를 비교할 수 있었다.
- 하나의 요청을 Controller·Service·Repository·Domain과 응답까지 반복해서 추적하자 Layer를 Class 목록이 아니라 변환 책임으로 이해할 수 있었다.
- MockMvc, 전체 Context Test와 실제 `curl.exe`를 분리하자 각 결과가 증명하지 못하는 범위도 함께 설명할 수 있었다.

### 바꿀 학습 방식

- 구현 완료와 설명 숙련을 같은 상태로 처리하지 않고, 자료 없이 흐름을 재구성하는 짧은 복습 Gate를 다음 주 첫 Block에 둔다.
- Test가 통과하면 Source 위치와 Runtime 등록까지 별도로 확인한다.
- 조건부 항목은 Must Gate 뒤에도 핵심 질문을 흐리면 명시적으로 보류하고, 수행한 것처럼 일정표에서 지우지 않는다.

## 다음 주

- 이어갈 핵심 질문: Application 상태를 PostgreSQL에 저장할 때 Schema·Constraint·Transaction·Lock·Index는 각각 어떤 정합성과 비용을 만드는가?
- 새로 선택할 학습 주제: SQL·Schema·Constraint, Transaction·Rollback, Isolation·MVCC·Lock·Deadlock, Index와 `EXPLAIN (ANALYZE, BUFFERS)`
- 시작하지 않을 항목: Replication·Sharding·NoSQL 별도 구현, 근거 없는 JPA N+1·Connection Pool 최적화
- 첫 번째 최소 실험: Week 2 Exception 흐름을 짧게 복습한 뒤 PostgreSQL 연결 상태와 Database 생성 여부를 확인하고 최소 Ticket Schema를 작성한다.

## 관련 자료

- [Week 2 주간 학습 계획](./weekly-plan.md)
- [Week 2 주차 안내](./README.md)
- [8월 24일 HTTP·Spring MVC 학습 점검](./study-notes/2026-08-24-study-questions.md)
- [8월 25일 REST 계약·최소 기동 기록](./study-notes/2026-08-25-study-questions.md)
- [8월 26일 정상 수직 Slice 기록](./study-notes/2026-08-26-study-questions.md)
- [8월 27일 Validation·오류 응답 기록](./study-notes/2026-08-27-study-questions.md)
- [8월 28일 Exception 흐름 복습](./study-notes/2026-08-28-study-questions.md)
- [8월 29일 공통 요청 처리 기록](./study-notes/2026-08-29-study-questions.md)
- [8월 30일 WIL·Week 3 계획 기록](./study-notes/2026-08-30-study-questions.md)
