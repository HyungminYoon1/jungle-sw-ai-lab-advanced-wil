# Week 2 — HTTP·REST·Spring 요청 흐름

> 상태: In Progress
> 기간: 2026-08-24 ~ 2026-08-29
> 핵심 질문: 하나의 HTTP 요청이 Spring MVC의 각 Layer를 통과하는 흐름과 책임을 직접 추적할 수 있는가?
> 운영 Baseline: Git 상태 확인·Diff Review·작은 Commit과 기존 Unit Test 회귀 확인
> 공통 실습: AI Helpdesk Learning Lab의 In-memory Ticket 생성·조회 API

이 문서는 Week 2의 질문, 선택 범위와 계획된 근거를 연결하는 Index다. 상세 일정과 축소 기준은 [주간 학습 계획](./weekly-plan.md)에서 관리하고, 실제 결과가 생긴 뒤 Learning Note·Lab Report와 WIL을 추가한다.

Week 1에서 Framework 없는 Ticket Domain의 규칙과 Unit Test를 확인했다. Week 2에는 그 Domain을 크게 확장하지 않고 HTTP 요청 한 건이 Web Boundary에서 Domain까지 이동하고 다시 응답으로 변환되는 흐름을 관찰한다. Spring Annotation과 Layer 수를 외우는 것보다 각 단계가 무엇을 받아 무엇으로 바꾸며, 어떤 책임을 가지면 안 되는지 설명하는 것이 목표다.

## 2026-08-24 시작 상태

- Week 1 배송비 Policy 후속 질문에서 선언 Type과 실제 객체, Method 호출 시점의 동적 바인딩, Composition의 보유·위임, Strategy와 DI·DIP 구분을 확인했다.
- 복습 결과를 Week 1 WIL에 반영하고 Week 1 핵심 학습을 `Completed`로 판정했다. WIL 외부 제출은 `NOT_RUN`이다.
- Week 2 전체 상태는 `In Progress`로 전환했지만, HTTP 현재 이해 기록과 주차 시작 후 새 Clean Test는 아직 수행하지 않았다.
- 아래 HTTP·REST·Spring 학습 항목은 실제 설명·Test·Trace 근거가 생기기 전까지 `Planned`를 유지한다.

## 핵심 질문

> 하나의 HTTP 요청이 Spring MVC의 각 Layer를 통과하는 흐름과 책임을 직접 추적할 수 있는가?

다음 흐름을 Request·Response, Code와 Test 근거로 설명할 수 있어야 한다.

```text
Client
  → HTTP Request
  → Spring MVC Web Boundary
  → Controller
  → Application Service
  → Domain·Repository
  → HTTP Response
```

## 시작 Baseline

- Java Runtime과 Compiler: Temurin JDK 25.0.4
- Build Tool: Maven Wrapper에서 Maven 3.9.16 사용
- 기존 Source: Framework 없는 `Ticket` Domain과 응답 시간 Policy 비교 Code
- 기존 자동 검증: Ticket Test 10개와 Policy 비교 Test 6개, 총 16개
- Spring 상태: 아직 Dependency·Application Context·Web Server가 없음
- Spring Boot 후보: 2026-08-23 기준 공식 Stable `4.1.1`

[Spring Boot 공식 System Requirements](https://docs.spring.io/spring-boot/system-requirements.html)에 따르면 `4.1.1`은 Java 17 이상이 필요하고 Java 26까지 호환되며 Maven 3.6.3 이상을 지원한다. 따라서 현재 JDK 25와 Maven 3.9.16을 유지한다. Preview·Snapshot Version은 사용하지 않는다.

실제 Version과 Source 상태는 주차 시작 시 새 Terminal에서 다시 확인한다. 기억이나 문서의 이전 실행 결과만으로 현재 상태를 완료 처리하지 않는다.

## 선택 범위

### 핵심 학습

- HTTP Method, Status, Header, Content Type과 Stateless의 의미
- REST Resource·URI와 생성·조회 API의 Request·Response 계약
- Spring MVC 요청 처리 흐름과 DI·IoC
- Controller·Application Service·Repository·Domain의 책임과 금지 의존성
- 정상 응답과 대표 `400`, `404`, `500` 오류 응답
- MockMvc 기반 MVC Test와 실제 Server에 보내는 `curl` Trace의 차이

### 선택 적용

- 기존 `Ticket` Domain을 유지한 In-memory 생성·조회 API
- `POST /api/tickets`의 생성 요청과 `201 Created` 응답
- `GET /api/tickets/{id}`의 조회와 `200 OK`·`404 Not Found` 응답
- 제목 검증 실패의 `400 Bad Request` 응답
- 내부 구현 정보를 노출하지 않는 대표 `500 Internal Server Error` 응답 Test

아래 계약은 계획이며 아직 구현되거나 검증되지 않았다.

| Method·Path | 정상 결과 | 대표 실패 | 비고 |
|---|---|---|---|
| `POST /api/tickets` | `201 Created`, `Location` Header와 Ticket JSON | 제목이 없거나 공백이면 `400` | Request·Response DTO와 Domain 책임 구분 |
| `GET /api/tickets/{id}` | `200 OK`와 Ticket JSON | 존재하지 않으면 `404` | 조회 결과의 HTTP 변환 확인 |
| Test 전용 실패 경로 | 해당 없음 | 통제된 내부 예외를 `500`으로 변환 | Production 실패 Endpoint는 추가하지 않음 |

### 독립 Spike·조건부 후속

- DNS·TCP는 HTTP Request가 전송되기 전 연결 흐름을 설명할 수 있는 수준으로 짧게 관찰한다.
- Filter·Interceptor·Exception Handler는 실행 위치와 책임을 먼저 비교하고, 핵심 요청 흐름에 필요할 때만 최소 Code로 확인한다.
- CORS는 핵심 API와 오류 Test가 완료된 경우에만 Simple Request와 Preflight를 재현한다. Spring MVC는 CORS를 요청 Mapping 단계에서 처리하며, 명시적으로 허용하지 않은 Cross-Origin 요청에는 필요한 응답 Header가 추가되지 않는다. `curl`은 관련 Header를 관찰할 수 있지만 Browser처럼 CORS 정책을 강제하지 않으므로 검증 범위를 구분한다. 자세한 기준은 [Spring Framework CORS 문서](https://docs.spring.io/spring-framework/reference/web/webmvc-cors.html)를 따른다.

### 이번 주 비범위

- PostgreSQL, JPA, Migration과 Transaction
- 인증·인가, Session과 Spring Security
- Browser UI와 JavaScript Application
- AI 요약·분류, 외부 API와 실제 Helpdesk SLA 연결
- 전체 CRUD, 검색·Pagination, Comment와 이력 기능
- Swagger·OpenAPI, Lombok, Docker와 배포
- GraphQL, Message Queue, Cache와 Load Balancing
- 두 Backend Framework 비교 구현

## Layer 책임 Baseline

| Layer·구성요소 | 담당할 책임 | 두지 않을 책임 |
|---|---|---|
| Controller | HTTP 입력 변환, Use Case 호출, Status·Header·Body 구성 | Ticket 상태 규칙, 저장 구현과 범용 예외 은폐 |
| Application Service | 생성·조회 Use Case 조정과 협력 객체 호출 | HTTP Request·Response 객체와 JSON 표현 |
| Domain | 제목 불변조건과 상태 전이 규칙 보호 | HTTP Status, Header와 저장 기술 |
| Repository Port | Ticket 저장·조회에 필요한 계약 | HTTP 응답과 Controller 분기 |
| In-memory Repository | Process 안에서 ID와 Ticket 보관 | Database·Transaction 동작을 검증했다는 주장 |
| Exception Handler | 알려진 실패를 일관된 HTTP 오류 계약으로 변환 | 모든 예외를 같은 원인으로 간주하거나 내부 정보 노출 |

Spring MVC의 오류 응답은 RFC 9457 형식의 `ProblemDetail` 지원을 우선 검토한다. 구체 Contract는 구현 전 자연어와 Test로 먼저 확정하며, 자세한 동작은 [Spring Framework Error Responses 문서](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html)를 확인한다.

## Test와 Trace 경계

- 기존 순수 Java Unit Test 16개는 Spring 없이 Domain 회귀 기준선으로 유지한다.
- MockMvc는 실행 중인 Server 없이 Spring MVC의 전체 Request Handling을 Mock Request·Response로 검증한다. [Spring Framework MockMvc 문서](https://docs.spring.io/spring/reference/testing/mockmvc.html)
- 실제 `curl` 호출은 Application을 기동한 뒤 TCP 연결, Request·Response Line, Header와 JSON Body를 관찰하는 별도 근거로 남긴다.
- Test 개수보다 어떤 계약과 실패를 검증했는지 기록한다.
- 대표 `500`은 Test Double 또는 통제된 Test 구성으로 재현하며 Production에 고의 실패 Endpoint를 추가하지 않는다.

## 상태

| 학습 주제 | 분류 | 현재 상태 | 계획된 근거 |
|---|---|---|---|
| HTTP Request·Response 의미 | 핵심 학습 | Planned | 자신의 말로 쓴 흐름과 `curl` Trace |
| REST Resource·오류 계약 | 핵심 학습 | Planned | API 계약 표와 정상·실패 Test |
| Spring MVC·Layer 책임 | 핵심 학습 | Planned | Request 흐름 설명, 최소 수직 Slice와 Layer Test |
| In-memory Ticket API | 선택 적용 | Planned | 생성·조회 Diff와 MVC Test |
| Filter·Interceptor·Exception Handler | 조건부 후속 | Planned | 책임 비교와 필요한 최소 실험 |
| CORS Simple·Preflight | 조건부 후속 | Planned | Must 완료 후 Header 관찰 |

`Completed`는 설명, 직접 재현과 Test·Trace 근거가 함께 생긴 경우에만 사용한다. Application이 실행된다는 사실만으로 HTTP·REST·Layer 학습을 완료 처리하지 않는다.

## 계획된 공개 산출물

### 현재 문서

- [주차 안내](./README.md)
- [주간 학습 계획](./weekly-plan.md)
- [HTTP 요청·응답 메시지 Learning Note](./study-docs/learning-http-request-response-messages.md) — 학습 자료 준비, 직접 설명·실제 `curl.exe` Trace `NOT_RUN`

### 실제 근거가 생긴 뒤 보완·추가

- 현재 HTTP 요청·응답 메시지 Learning Note의 자가진단 답변과 예상·관찰 차이
- Ticket HTTP Request Flow Lab Report
- Week 2 WIL
- 공개 전 Checklist

실제 파일이 생기기 전에는 Placeholder Link를 만들지 않는다.

## Learning Evidence Gate

- [ ] HTTP Request·Response의 시작 Line, Header와 Body 역할을 설명한다.
- [ ] 하나의 요청을 Client부터 Domain과 Response까지 추적한다.
- [ ] Controller·Application Service·Repository·Domain의 책임과 금지 의존성을 설명한다.
- [ ] 구현 전에 생성·조회와 대표 실패의 예상 계약을 기록한다.
- [ ] 정상과 `400`·`404`·대표 `500`을 필요한 수준의 Test로 검증한다.
- [ ] MockMvc 결과와 실제 `curl` Trace가 각각 무엇을 검증하는지 구분한다.
- [ ] 기존 16개 Unit Test를 포함한 Clean Test를 재현한다.
- [ ] 적용·조건부 후속·비범위의 선택 이유를 기록한다.
- [ ] AI가 보조한 부분과 직접 작성·수정·검증한 범위를 구분한다.
- [ ] 완료·부분 완료·미수행 범위와 다음 질문을 WIL에 남긴다.
- [ ] 공개 자료에 Secret, 개인정보, 내부 URL과 로컬 절대 경로가 없다.

## Week 1 연결

- 2026-08-24 월요일 첫 학습 Block에서 Week 1 다형성·Composition 후속 개념 확인과 WIL 반영을 완료했다. 외부 제출은 실행하지 않았다.
- `Ticket`의 제목 불변조건과 상태 전이 규칙은 Domain에 유지한다.
- Week 1에서 구분한 DI·DIP를 Spring Container와 Constructor Injection 관찰로 연결하되, Annotation 암기로 대체하지 않는다.
- HTTP 현재 이해 기록부터 Week 2의 별도 학습 근거로 남기며, 완료되지 않은 HTTP 항목을 Week 1 복습 결과로 대신하지 않는다.

## 관련 계획

- [심화과정 12주 학습 계획](../plan/advanced-track-12-week-plan.md)
- [주차별 Roadmap](../plan/weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](../plan/learning-and-content-plan.md)
- [산출물 Template](../templates/README.md)
