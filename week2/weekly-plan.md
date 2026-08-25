# Week 2 학습 계획 — HTTP·REST·Spring 요청 흐름

> 작성일: 2026-08-23
> 상태: Baseline v1
> 기간: 2026-08-24 ~ 2026-08-29
> 핵심 질문: 하나의 HTTP 요청이 Spring MVC의 각 Layer를 통과하는 흐름과 책임을 직접 추적할 수 있는가?
> 운영 Baseline: Git 상태 확인·Diff Review·작은 Commit과 기존 Unit Test 회귀 확인

## 계획 배경

Week 1에는 Framework 없이 `Ticket`이 제목 불변조건과 상태 전이 규칙을 보호하도록 구현하고, JUnit으로 정상·경계·거부 Case를 검증했다. 조건문과 Strategy에 같은 VIP 변경을 적용하면서 Composition·DIP·DI의 변경 범위를 관찰했다. 새 배송비 사례에서 남았던 다형성과 Composition의 독립 설명은 8월 24일 후속 질문에서 선언 Type·실제 객체·Method 호출 시점, 보유·위임과 구현 교체를 구분하여 확인했다.

Week 2에는 Spring 기능을 넓게 수집하지 않는다. 기존 Domain을 유지하면서 HTTP 요청 한 건이 Web Boundary, Controller, Application Service와 Repository를 지나 Domain에 도달하고 다시 HTTP 응답이 되는 과정을 추적한다. Layer 수나 Annotation 목록보다 각 단계의 입력·출력, 책임과 금지 의존성을 설명하고 정상·실패를 Test와 Trace로 재현하는 데 집중한다.

## 이번 주 핵심 질문

> 하나의 HTTP 요청이 Spring MVC의 각 Layer를 통과하는 흐름과 책임을 직접 추적할 수 있는가?

보조 질문은 다음 네 가지로 제한한다.

1. HTTP Request와 Response에서 Method, Status, Header와 Body는 각각 무엇을 표현하는가?
2. `POST /api/tickets`와 `GET /api/tickets/{id}`의 정상·실패 계약은 무엇인가?
3. Controller·Application Service·Repository·Domain은 각각 무엇을 알고 무엇을 몰라야 하는가?
4. MockMvc Test와 실제 `curl` Trace는 서로 무엇을 검증하고 무엇을 검증하지 못하는가?

## 목표

| 구분 | 목표 | 완료 근거 |
|---|---|---|
| 개념 | HTTP 메시지와 Spring MVC Request 처리 흐름을 자신의 말로 설명 | Request Flow 설명과 Learning Note |
| 계약 | Ticket 생성·조회와 대표 오류의 HTTP 계약을 구현 전에 정의 | Method·Path·Status·Header·Body 표와 Given–When–Then |
| 실험 | 정상·`400`·`404`·대표 `500` Request를 재현 | MVC Test 결과와 실제 `curl` Trace |
| 선택 적용 | In-memory Repository 기반 최소 Ticket API 구성 | Layer별 작은 Diff와 기존 Domain Test 회귀 확인 |
| 공개 기록 | 예상·관찰·해석, 완료·부분 완료·비범위를 기록 | Lab Report 또는 Learning Note와 Week 2 WIL |

## 작업 시간과 휴식

- 작업 구간: 오전 10:00~12:00, 오후 13:00~18:00, 야간 19:00~23:00
- 점심 12:00~13:00과 저녁 18:00~19:00에는 과업을 배정하지 않는다.
- 매일 한 시간 이상의 Core Time에는 당일 Request 흐름과 막힌 부분을 Code나 Trace를 가리키며 설명한다.
- 일정은 분 단위 진도표가 아니라 각 Block의 종료 조건으로 운영한다.
- 8월 24일 월요일의 Week 1 복습·WIL 제출은 첫 학습 Block 중 최대 한 시간으로 제한한다.
- 날짜별 주제는 다른 개념을 금지하는 경계가 아니라 해당 Block의 주요 초점이다. 현재 Request 흐름을 이해하는 데 직접 도움이 되는 인접 개념은 같은 예시에서 함께 살펴본다.
- Week 2의 HTTP 메시지, REST 계약, Spring MVC 구현과 Test·Trace는 하나의 수직 흐름을 여러 번 깊게 확인하는 과정으로 운영한다. 이미 설명한 개념은 다음 날 처음부터 반복하지 않고 계약·Code·Test로 연결한다.
- 당일 종료 조건을 일찍 충족하면 다음 Block으로 진행할 수 있다. 일정이 지연되면 미완료 구현·실행 항목 한 개만 가장 가까운 관련 Block으로 이동하고, 이동 이유와 `NOT_RUN` 범위를 기록한다.

## 작성 시점 Baseline

| 항목 | 현재 상태 | 이번 주 시작 확인 |
|---|---|---|
| 선행 이해 | Ticket Domain 책임, Exception, JUnit과 DI·DIP 기초 학습 | 다형성·Composition을 새 사례에서 한 질문씩 재점검 |
| Java | Temurin JDK 25.0.4 실행 근거 있음 | 새 Terminal에서 `java`, `javac` Version 확인 |
| Build | Maven Wrapper에서 Maven 3.9.16 실행 근거 있음 | Wrapper Version과 Java Runtime 재확인 |
| Source | 순수 Java Ticket·Policy Production Code 9개와 Test Code 3개 | 기존 16개 Clean Test 재현 후 Spring 변경 시작 |
| Spring | Dependency·Application Context·Web Server 없음 | 공식 Stable과 Java·Maven 지원 범위 확인 후 Baseline 구성 |
| Week 1 문서 | WIL과 후속 개념 확인, 블로그 게시·정글 LMS 링크 제출 완료 | Week 2 HTTP 근거와 Week 1 완료 근거를 분리해 유지 |
| Blocker | 확인된 기술 Blocker 없음 | 설정이 반나절을 넘으면 API 구현을 미루고 최소 Context 기동만 검증 |

2026-08-24 기준 [Spring Boot 4.1.1 공식 출시 공지](https://spring.io/blog/2026/08/20/spring-boot-4-1-1-available-now/)와 [Spring Boot 프로젝트 페이지](https://spring.io/projects/spring-boot/)에서 `4.1.1`의 정식 출시를 확인했다. [Spring Boot 공식 System Requirements](https://docs.spring.io/spring-boot/system-requirements.html)는 현재 `4.1.0` 기준으로 Java 17 이상·Java 26 이하와 Maven 3.6.3 이상을 명시하므로, 출시 Version 근거와 4.1 계열 실행 요구사항 근거를 구분한다. 이번 주 Baseline은 Spring Boot `4.1.1`, JDK 25와 기존 Maven Wrapper 3.9.16을 사용하되, 최종 호환성은 Spring Initializr의 공식 생성 결과와 실제 Clean Build로 확인한다. Preview·Snapshot Version은 선택하지 않는다.

이 표의 Version과 Test 결과는 계획 작성 시점 근거다. 실제 구현 완료 여부는 주차 중 다시 실행한 결과로만 판단한다.

2026-08-24 새 Terminal에서 Temurin JDK 25.0.4, `javac` 25.0.4, Maven Wrapper 3.9.16을 다시 확인했다. `.\mvnw.cmd clean test`로 기존 Test 16개가 실패·오류·건너뜀 없이 통과하고 `BUILD SUCCESS`가 발생했다. Spring Boot Dependency와 Application Context 호환성은 아직 실행하지 않았으므로 별도 상태로 유지한다.

## 우선순위와 축소 기준

### Must

- HTTP Request·Response의 Method, Status, Header, Content Type과 Body 설명
- 구현 전 Ticket 생성·조회 API의 정상·실패 계약 작성
- Spring MVC Application Context 기동과 기존 16개 Unit Test 회귀 유지
- `POST /api/tickets`, `GET /api/tickets/{id}` 최소 수직 Slice
- Controller·Application Service·Repository·Domain 책임 분리
- `201`, `200`, `400`, `404`와 대표 `500` MVC Test
- 실제 Server에 대한 최소 한 개의 재현 가능한 `curl` Request·Response Trace
- Learning Note 또는 Lab Report 한 개와 Week 2 WIL

### Should

- Spring MVC의 `ProblemDetail` 기반 일관된 오류 Body
- Filter·Interceptor·Exception Handler의 실행 위치와 책임 비교
- CORS Simple Request와 Preflight Header 관찰
- 외부 Client부터 Domain까지의 흐름을 Text Diagram으로 설명

### Git 운영 Baseline

- 매 작업 시작 시 `git status --short --branch`로 두 저장소의 상태를 확인한다.
- Commit 전 `git diff`와 `git diff --staged`로 Source·Test·문서 범위를 구분한다.
- Spring Baseline, 정상 수직 Slice와 실패 계약을 가능한 한 서로 다른 의도의 작은 Commit으로 남긴다.
- 이미 공개한 Commit을 되돌려야 할 때만 `revert`를 사용하고, Working Tree·Index 복구와 혼동하지 않는다.
- Push는 Commit과 별도 단계로 취급한다.

### 먼저 줄이는 항목

일정이 지연되면 다음 순서로 줄인다.

1. CORS Code와 Preflight 실험을 후속으로 이동한다.
2. Filter·Interceptor는 개념 비교만 남기고 구현하지 않는다.
3. DNS·TCP Echo 같은 별도 Program을 만들지 않고 `curl` 연결 관찰만 남긴다.
4. 별도 `500` Production Endpoint를 만들지 않고 Test Double로만 실패 계약을 검증한다.
5. 전체 CRUD를 만들지 않고 생성·단건 조회만 유지한다.

다음 항목은 축소하지 않는다.

- 구현 전 Request·Response 계약 작성
- Controller에서 Domain 규칙과 저장 구현을 분리하는 책임 경계
- 기존 Domain Unit Test 회귀
- 최소 한 개의 실제 HTTP Trace
- 완료·부분 완료·미수행 범위 기록

### 일일 지연 복구 순서

1. 당일 주요 질문과 종료 조건을 먼저 확인한다.
2. 현재 예시를 이해하는 데 필요한 인접 개념은 함께 연결하되, 별도 구현과 깊은 설정 작업은 주요 결과 이후에 진행한다.
3. 기존 Clean Test처럼 다음 변경의 안전 기준이 되는 검증을 수행한다.
4. 외부 제출처럼 기한이 있는 작업을 확인한다.
5. 종료 조건을 일찍 충족하면 다음 Block으로 진행하고, 남은 구현·기동 준비는 가장 가까운 관련 Block으로 한 번만 이동한다.

## 권장 시간 배분

| 활동 | 계획 비율 | 종료 조건 |
|---|---:|---|
| 개념·공식 자료 | 30% | HTTP와 MVC 흐름을 Code 없이 먼저 설명 |
| 최소 재현 실험 | 35% | 정상·실패 Request의 예상·관찰·해석 확보 |
| Helpdesk 선택 적용 | 20% | 생성·조회 수직 Slice와 필요한 Test만 구현 |
| 설명·Review·WIL | 15% | Trace, 책임 설명, 미완료 질문과 다음 단계 기록 |

Spring 설정이나 Layer Boilerplate가 학습 시간의 절반을 넘으면 구현 범위를 줄인다. Application 기능 수를 늘리기 위해 개념·설명 시간을 줄이지 않는다.

## 학습 범위

### 포함

- HTTP Request Line·Response Status Line, Header, Body와 Content Type
- 주요 Method와 Status의 의미, Stateless와 Resource 중심 URI
- Spring Boot Application 기동과 DispatcherServlet 중심 MVC 흐름
- Constructor Injection과 Spring Container의 객체 조립 관찰
- Controller·Application Service·Repository Port·In-memory 구현·Domain 책임
- Request·Response DTO와 Domain 객체의 경계
- `ProblemDetail`을 후보로 한 일관된 오류 계약
- MockMvc와 실제 `curl` Trace

### 포함하지 않음

- PostgreSQL, JPA, Flyway와 Transaction
- Spring Security, Session, JWT와 OAuth2
- Browser UI, Template Engine과 JavaScript
- AI 기능, 실제 SLA와 응답 시간 Policy 연결
- Pagination, 검색, 수정·삭제, Comment와 이력
- Swagger·OpenAPI, Lombok, Docker와 Cloud
- GraphQL, WebSocket, Queue, Cache와 Load Balancing

### 조건부 후속·선정 제외

- Filter·Interceptor 구현은 요청 흐름을 설명하는 데 실제 공백이 확인된 경우만 수행한다.
- CORS는 Must Gate가 통과한 뒤 Simple Request와 Preflight 차이를 확인하는 작은 실험으로 제한한다.
- `curl`로 CORS Header를 관찰하는 것과 Browser가 Cross-Origin 응답 접근을 차단하는 것은 서로 다른 검증임을 기록한다.
- DNS·TCP는 별도 Network Program을 만드는 대신 `curl`의 연결 과정과 HTTP 전송 전후를 설명한다.
- HTTP Version Benchmark, TLS 인증서 실험과 Packet Capture는 현재 핵심 질문에서 제외한다.
- Spring WebFlux와 다른 Backend Framework 비교는 선정하지 않는다.

## 학습 계획

| 학습 주제 | 상태 | 질문 | 방법 | 증거 |
|---|---|---|---|---|
| HTTP 메시지와 Stateless | 핵심 학습 | Client와 Server는 어떤 정보로 요청과 응답 의미를 합의하는가? | RFC·공식 자료, 요청 예측과 `curl` 관찰 | Message 구조 설명과 Header Trace |
| REST Resource·오류 계약 | 핵심 학습 | Ticket 생성·조회에 적절한 URI, Method와 Status는 무엇인가? | 구현 전 Contract 표와 Given–When–Then | API 계약, 정상·실패 MVC Test |
| Spring MVC·Layer 책임 | 핵심 학습 | 요청은 어떤 객체를 거치며 각 Layer는 무엇을 몰라야 하는가? | 공식 문서, 작은 수직 Slice와 Call Flow 추적 | Flow Diagram, Source Diff와 설명 |
| HTTP Test·Trace | 핵심 학습 | MockMvc와 실제 HTTP 호출은 각각 무엇을 검증하는가? | MVC Test와 기동 Server `curl` 비교 | Test 결과와 재현 가능한 Trace |
| In-memory Ticket API | 선택 적용 | 기존 Domain 규칙을 Web과 저장 기술에서 분리할 수 있는가? | 생성·단건 조회만 구현 | 기존 Unit Test와 새 Web Test |
| Filter·Interceptor·Exception Handler | 조건부 후속 | 공통 처리는 어느 경계에 두어야 하는가? | 실행 위치·책임 비교 후 필요한 최소 실험 | 비교표 또는 Learning Note |
| CORS | 조건부 후속 | Browser의 Cross-Origin 요청은 어떤 Header와 Preflight 조건을 요구하는가? | Must 완료 후 Simple·OPTIONS Request | 요청·응답 Header 관찰 |

## 계획된 API 계약

아래 내용은 구현 전 예상 계약이며 실제 결과가 아니다. 구현 중 바뀌면 이유와 영향을 변경 기록에 남긴다.

### Ticket 생성

```http
POST /api/tickets
Content-Type: application/json

{"title":"로그인 오류"}
```

예상 정상 응답:

- Status: `201 Created`
- Header: 생성 Resource를 가리키는 `Location`
- Body: `id`, `title`, `status`

예상 실패:

- Body 누락·잘못된 JSON 또는 유효하지 않은 제목: `400 Bad Request`
- 오류 Body는 호출자가 잘못된 입력 범위를 이해할 수 있어야 하며 내부 Stack Trace를 포함하지 않는다.

### Ticket 단건 조회

```http
GET /api/tickets/{id}
Accept: application/json
```

예상 정상 응답:

- Status: `200 OK`
- Body: `id`, `title`, `status`

예상 실패:

- 존재하지 않는 ID: `404 Not Found`
- 잘못된 Path Variable 형식: `400 Bad Request`

### 대표 내부 실패

- Application Service 또는 Repository Test Double이 통제된 내부 예외를 발생시킨다.
- HTTP Boundary가 이를 `500 Internal Server Error`로 변환하는지 확인한다.
- 응답에는 내부 Class 이름, Stack Trace, 로컬 경로와 민감 값을 포함하지 않는다.
- 실패 재현만을 위한 Production Endpoint는 추가하지 않는다.

## Layer 책임과 금지 의존성

| 구성요소 | 입력 | 출력·협력 | 금지할 내용 |
|---|---|---|---|
| Controller | HTTP Path·Header·JSON DTO | Application Service 호출과 HTTP 응답 | 상태 전이 규칙, Map 저장, Repository 직접 구현 |
| Application Service | Use Case 입력 | Domain 생성·호출과 Repository 조정 | Servlet API, HTTP Status와 JSON 구조 |
| Domain `Ticket` | 제목과 행동 Method | 유효한 상태 또는 Domain 실패 | Spring Annotation, HTTP와 저장 기술 |
| Repository Port | 저장·조회 요청 | 저장된 Ticket 또는 부재 | Controller·HTTP 응답 지식 |
| In-memory Repository | Repository 계약 | Process 안의 ID·Ticket 보관 | Database Transaction을 검증했다는 주장 |
| Exception Handler | 알려진 Application·Domain·Web 실패 | Status, Header와 안전한 오류 Body | 무관한 모든 Exception의 원인 은폐 |

Controller에 규칙을 둔 실패 예제는 별도 Production 구조로 장기간 유지하지 않는다. 필요한 경우 Test나 작은 비교 Diff로 관찰한 뒤 Domain·Application 책임으로 되돌린다.

## Lab 계획

| 순서 | Lab | 실행 전 예상 | 완료 조건 | 상태 |
|---:|---|---|---|---|
| 0 | Week 1 경계 정리와 Source Baseline | 기존 Test 16개가 Spring 변경 전에도 재현됨 | 후속 질문과 Week 2 시작 범위가 분리되고 Clean Test 결과 확인 | Completed — WIL 게시·LMS 제출, JDK 25.0.4·Maven 3.9.16과 기존 Test 16개 `BUILD SUCCESS` 확인 |
| 1 | Spring Boot 최소 기동 | 공식 생성 구성으로 Application Context와 내장 Server가 기동됨 | JDK·Maven·Boot Version과 실패 시 원인을 기록 | Completed — Boot `4.1.1`, Java `25.0.4`, Tomcat `11.0.24`, Port `8080` 기동과 기존 Test 16개 통과 |
| 2 | HTTP Message Trace | `curl`에서 연결, Request, Status, Header와 JSON Body를 구분할 수 있음 | 한 Request의 원문과 각 부분의 의미를 설명 | Completed — Root `GET /`의 연결·Request·`404`·Header·JSON Body를 관찰하고 Ticket API 미검증 경계를 기록 |
| 3 | Ticket 생성·조회 수직 Slice | Web에서 기존 Ticket 규칙을 재사용하고 In-memory로 조회 가능 | `POST`·`GET` 정상 Test와 실제 호출 통과 | Planned |
| 4 | 오류 응답 계약 | 잘못된 입력과 부재·내부 실패가 서로 다른 Status로 변환됨 | `400`·`404`·대표 `500` Body와 상태 검증 | Planned |
| 5 | Layer 책임 비교 | Controller에 규칙·저장을 두면 변경과 Test 책임이 섞임 | 금지 의존성과 분리 후 Call Flow를 자신의 말로 설명 | Planned |
| 6 | CORS Simple·Preflight | 명시적 허용 전후 응답 Header가 달라짐 | Must 완료 시에만 Origin·OPTIONS 결과 기록 | Conditional |
| 7 | Clean 재현과 Week Review | 새 Terminal에서도 전체 Test와 Trace를 재현 가능 | 결과·미완료 범위가 Learning Note·WIL 초안에 반영됨 | Planned |

## 일정

| 날짜 | 오전 | 오후 | 야간 | 일일 종료 조건 | 상태 |
|---|---|---|---|---|---|
| 8월 24일 월요일 | Week 1 다형성·Composition 재점검과 WIL 제출을 최대 한 시간으로 마감, HTTP 현재 이해 기록 | HTTP Request·Response 구조, Method·Status·Header·Content Type 학습과 예상 작성 | WIL 외부 제출, JDK·Maven·Spring Boot 공식 Baseline과 기존 Clean Test를 우선 확인하고, 최소 Context 기동 준비가 남으면 화요일 기동 Block으로 한 번만 이동 | Week 1 후속과 Week 2 범위가 분리되고 HTTP 메시지 각 부분을 설명 | Completed — WIL 게시·LMS 제출, HTTP·Spring MVC 개념 설명, JDK·Maven과 기존 Test 16개 확인. Context·Server 기동은 계획에 따라 8월 25일로 이동 |
| 8월 25일 화요일 | 월요일에 정리한 HTTP·Stateless 설명을 반복하지 않고 REST Resource·URI와 생성·조회 계약으로 연결 | `POST`·`GET` 정상·실패 Given–When–Then과 API 계약 확정 | Spring Boot 최소 Application Context와 Server 기동, 첫 `curl` Trace | Code 작성 전에 Method·Status·Header·Body 예상 계약이 기록됨 | Completed — 오전 개념 설명, 오후 예상 계약, 야간 Boot `4.1.1`·Tomcat 기동과 Root `404` JSON Smoke Trace 완료. Ticket API·MockMvc는 다음 Block |
| 8월 26일 수요일 | DispatcherServlet·Controller·DI·IoC와 Layer 책임 학습 | In-memory Repository 기반 Ticket 생성·조회 수직 Slice 구현 | 정상 MVC Test와 실제 `POST`·`GET` 호출, Call Flow 설명 | Controller에서 Domain 규칙과 저장 구현을 분리한 정상 흐름이 재현됨 | Planned |
| 8월 27일 목요일 | Validation, Exception Handler와 `ProblemDetail` 학습 | 잘못된 JSON·제목과 존재하지 않는 ID의 `400`·`404` 계약 구현 | 대표 내부 실패의 `500` Test와 안전한 오류 Body Review | 정상과 세 실패 범주의 Status·Body 선택 이유를 설명 | Planned |
| 8월 28일 금요일 | Filter·Interceptor·Exception Handler 실행 위치 비교 | Must Gate와 전체 Test 보완, 필요할 때만 CORS Simple·Preflight 실험 | Request Trace에 Layer와 오류 흐름 표시, Learning Note·Lab Report 초안 | 조건부 항목을 수행하거나 보류한 이유와 Request 흐름이 기록됨 | Planned |
| 8월 29일 토요일 | 새 Terminal에서 Version·Clean Test·Application 기동 재현 | 실제 `curl` Trace와 정상·실패 계약 최종 확인, 불필요한 Code 제거 | 설명 가능성 점검, Week 2 WIL 초안과 다음 질문 정리 | Gate 결과와 완료·부분 완료·미수행 범위가 근거와 함께 기록됨 | Planned |

## 위험과 대응

| 위험 | 조기 신호 | 대응 | 상태 |
|---|---|---|---|
| Week 1 복습이 Week 2를 잠식 | 월요일 첫 Block 이후에도 같은 개념 질문을 계속함 | 한 시간 뒤 미완료 질문을 후속 목록에 남기고 HTTP 학습 시작 | Open |
| 인접 개념 탐색이 현재 핵심 질문을 대체 | HTTP 메시지를 이해하기 위한 연결을 넘어 Spring 내부 구현·설정에 학습 시간이 집중됨 | 같은 Request 흐름을 설명하는 연결은 허용하고, 별도 구현·깊은 설정은 현재 Block의 종료 조건을 확인한 뒤 진행 | Observed — 주요 초점과 수직 흐름 운영 원칙 추가 |
| Spring 설정이 학습을 압도 | Dependency·Plugin 오류 해결이 반나절을 넘김 | 공식 Initializr 최소 구성으로 축소하고 Context 기동까지만 검증 | Open |
| Controller에 책임 집중 | Controller가 상태 규칙, ID Map과 오류 Body를 모두 처리 | Use Case·Domain·Repository 책임을 다시 분리하고 Test 위치 Review | Open |
| Layer Class 수집 | 요청 흐름과 무관한 Interface·DTO·Config가 증가 | 생성·조회 한 흐름에 호출되지 않는 구조 제거 | Open |
| Test가 실제 HTTP를 대체 | MockMvc 성공만 있고 Header를 직접 관찰하지 않음 | 기동 Server에 `curl`을 보내 별도 Trace 남김 | Open |
| CORS·Filter 확장 | Must 실패가 남았는데 조건부 실험을 시작 | CORS·Filter 구현을 중단하고 핵심 계약으로 복귀 | Open |
| 기록 과다 | 문서 작성이 실험·설명보다 길어짐 | 핵심 Learning Note 또는 Lab Report 한 개와 WIL만 유지 | Open |
| 공개 정보 노출 | Trace에 로컬 경로·내부 오류·환경 값이 포함 | 공개 전 값이 아닌 존재·패턴 중심 점검과 필요한 Redaction | Open |

## 계획된 산출물

| 산출물 | 목적 | 생성 조건 | 상태 |
|---|---|---|---|
| [주차 안내](./README.md) | Week 2 질문과 범위 Index | 주차 시작 | Ready |
| [주간 학습 계획](./weekly-plan.md) | Baseline·일정·축소 기준 | 주차 시작 | Ready |
| [HTTP 요청·응답 메시지 Learning Note](./study-docs/learning-http-request-response-messages.md) | Message 구조·예상 계약과 자가점검 | RFC 기반 학습 자료 준비 | Ready — 순수 개념 자료로 유지하고 실제 Trace는 날짜별 Study Note에 분리 |
| [8월 25일 REST Resource·URI와 API 계약 학습 점검](./study-notes/2026-08-25-study-questions.md) | 개념 답변·예상 계약과 최소 기동 실행 근거 | 당일 학습과 실행 완료 | Completed — Given–When–Then·계약표, Boot 기동과 Root Smoke Trace 기록 |
| Ticket HTTP Request Flow Lab Report | Request·Response Trace와 정상·실패 재현 | 실제 Trace와 Test 결과 확보 후 | Planned |
| Week 2 WIL | 이해 변화, 실패와 다음 판단 | 토요일 실제 결과 후 | Planned |
| 공개 Checklist | Secret·경로·주장·Link 점검 | 게시 직전 | Planned |

Learning Note와 Lab Report를 모두 강제로 만들지 않는다. 한 문서가 핵심 질문, 실행 절차, 관찰과 설명을 충분히 담으면 그 문서를 우선하고 중복 문서는 생략한다.

## Learning Evidence Gate

- [x] HTTP Request·Response의 Method·Status·Header·Body 역할을 자신의 말로 설명한다.
- [x] 구현 전에 Ticket 생성·조회와 대표 실패의 예상 계약을 기록했다.
- [ ] 하나의 실제 Request가 Web Boundary부터 Domain과 Response까지 이동하는 흐름을 추적했다.
- [x] Controller·Application Service·Repository·Domain의 책임과 금지 의존성을 설명한다.
- [ ] 정상과 `400`·`404`·대표 `500`을 필요한 수준의 Test로 검증했다.
- [ ] MockMvc와 실제 `curl` Trace가 검증하는 범위를 구분한다.
- [x] 기존 16개 Unit Test를 포함한 전체 Clean Test가 통과한다.
- [ ] 예상과 실제가 달랐던 점과 원인을 기록했다.
- [ ] AI 도움 없이 핵심 흐름의 작은 변경과 관련 Test를 수행했다.
- [ ] CORS·Filter 등 조건부 항목의 수행·보류 이유가 있다.
- [ ] 완료·부분 완료·미수행 범위와 다음 질문을 WIL에 남겼다.
- [ ] 공개 자료에 Secret, 개인정보, 내부 URL과 로컬 절대 경로가 없다.

### Git 운영 Baseline 점검

- [ ] `status`, `diff`, `diff --staged`로 Spring 설정, Production Code, Test와 문서 변경을 구분한다.
- [ ] Spring Baseline, 정상 수직 Slice와 오류 계약을 의도 단위 Commit으로 나눈다.
- [ ] Working Tree·Index·공개된 Commit 중 복구 대상을 먼저 구분한다.
- [ ] Push 전 전체 Test와 공개 문서 범위를 다시 확인한다.

Git 점검은 별도 반나절 학습으로 운영하지 않는다. 실제 변경에서 공백이 확인된 항목만 짧게 보충한다.

## 계획 변경 기록

Baseline 이후 학습 항목을 조용히 추가하거나 삭제하지 않는다. API 범위, Layer 책임이나 조건부 실험이 바뀌면 날짜, 이유, 핵심 질문과 다음 주 영향을 이 표에 추가한다.

| 날짜 | 변경 | 이유 | 영향·검증 경계 |
|---|---|---|---|
| 2026-08-24 | 최소 Application Context·Server 기동 준비를 8월 25일 야간 기동 Block에 통합 | 23:00까지 HTTP와 Spring MVC 개념 설명, WIL 제출과 기존 Clean Test Baseline을 완료하여 월요일 종료 조건을 충족함 | 주간 API 범위는 바뀌지 않는다. Spring Code·Context는 `NOT_IMPLEMENTED`, 실제 `curl.exe` Trace는 `NOT_RUN`으로 유지한다. |
| 2026-08-25 | Spring Boot 최소 기동과 Root Smoke Trace 완료 | 구현 전 Ticket API 계약을 작성한 뒤 Boot 구성·Application 진입점·Server 실행을 작은 단계로 검증함 | Root `404`는 Context·Server·기본 오류 응답 근거로만 사용한다. Ticket Controller·MockMvc·실제 `POST`·`GET`은 다음 Block까지 `NOT_IMPLEMENTED`·`NOT_RUN`으로 유지한다. |

## 공식 학습 자료 Baseline

- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [RFC 9457 — Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html)
- [Spring Boot System Requirements](https://docs.spring.io/spring-boot/system-requirements.html)
- [Spring MVC Handler Methods](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-methods.html)
- [Spring MVC Error Responses](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html)
- [Spring Framework MockMvc](https://docs.spring.io/spring/reference/testing/mockmvc.html)
- [Spring Framework CORS](https://docs.spring.io/spring-framework/reference/web/webmvc-cors.html)

HTTP 의미와 REST 계약은 관련 RFC 원문을 기준으로 확인하고, Framework 사용법은 Spring 공식 문서를 우선한다. Tutorial의 결과를 실제 검증 근거로 대체하지 않는다.

## 관련 기준

- [심화과정 12주 학습 계획](../plan/advanced-track-12-week-plan.md)
- [주차별 Roadmap](../plan/weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](../plan/learning-and-content-plan.md)
- [Week 1 주차 안내](../week1/README.md)
- [Week 1 WIL 초안](../week1/wil.md)
