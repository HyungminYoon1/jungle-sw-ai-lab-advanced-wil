# 2026-08-29 — 공통 요청 처리와 예외 기반 조회 학습·구현 기록

> 작성일: 2026-08-29
> 목적: Filter·Interceptor·Exception Handler의 책임과 예외 기반 조회 흐름을 이해하고, 필요한 최소 구현과 Test로 확인한다.
> 상태: Completed — 8월 29일 야간에 시작한 학습 세션을 자정 이후까지 이어 최소 구현과 전체 Clean Test를 완료했다. WIL과 Week 3 계획은 8월 30일 작업으로 분리한다.

---

## 학습 세션 기록 기준

학습은 8월 29일 야간에 시작하여 중단 없이 8월 30일 01시대까지 이어졌다. 자정을 넘겼다는 이유만으로 하나의 구현·검증 흐름을 두 날짜로 나누면 학습 맥락이 흐려지므로 Filter·Interceptor 구현과 전체 Clean Test까지 8월 29일 학습 세션으로 기록한다. 실제 완료 시각이 자정 이후였다는 사실은 이 문장과 실행 근거에 남긴다.

- Filter·Interceptor 최소 구현과 관련 Test
- 새 Terminal에서 Java·Maven Version 확인과 전체 Clean Test 재현
- Week 2 진행 문서 갱신과 의미 단위별 Commit

CORS·Preflight 실험은 Week 2 필수 완료 조건에서 계속 제외한다. 오늘의 핵심 작업이 끝난 뒤 시간이 남을 때만 별도로 판단한다.

## 오늘의 완료 목표

1. Filter·Interceptor·Exception Handler의 책임과 실행 위치를 자료 없이 설명한다.
2. 단건 조회에서 Repository의 `Optional.empty()`가 Service의 조회 실패로 해석되는 이유를 설명한다.
3. 학습 목적에 필요한 최소 Filter와 Interceptor를 구현하고 관련 Test를 통과시킨다.
4. 새 Terminal에서 Java·Maven Version과 전체 Clean Test를 재현한다.
5. 실제 결과를 진행 문서에 반영하고 의미 단위별로 Commit한다.

## 현재까지 실제로 확인한 내용

### Interceptor Callback 점검

Controller가 정상 반환한 경우뿐 아니라 Exception이 발생한 경우까지 포함하여 실행 시간을 측정하려면 종료 시각 계산을 `afterCompletion()`에 두어야 한다고 답했다.

그 이유는 다음과 같다.

- `postHandle()`: Handler가 정상 실행된 경우에만 호출된다.
- `afterCompletion()`: 요청 처리 완료 뒤 호출되므로 성공과 실패 흐름을 함께 관찰하는 데 적합하다.

단, 해당 Interceptor의 `preHandle()`이 정상 완료되고 `true`를 반환해야 `afterCompletion()`이 호출된다. Exception Resolver가 이미 처리한 Exception은 `afterCompletion()`의 `ex` 인수에 나타나지 않을 수 있으므로 오류 판단을 `ex` 하나에만 의존하지 않고 최종 HTTP Status도 함께 관찰해야 한다.

```text
preHandle()
→ 시작 시각을 Request 속성에 저장

afterCompletion()
→ 종료 시각 계산
→ 최종 HTTP Status와 소요 시간 관찰
```

### 세 구성요소 선택 점검

다음 세 문제를 모두 올바르게 구분했다.

| 요구사항 | 선택 | 이유 |
|---|---|---|
| 모든 요청에 Request ID 부여 | Filter | Servlet 수준의 넓은 요청 범위에서 적용 |
| 선택된 Controller Method 이름을 포함한 실행 시간 측정 | Interceptor | Handler 정보를 사용할 수 있음 |
| `TicketNotFoundException`을 `404 ProblemDetail`로 변환 | Exception Handler | Application 실패를 HTTP 오류 계약으로 변환 |

오늘 기억할 기준은 다음 세 문장으로 제한했다.

```text
모든 요청의 바깥쪽 처리 → Filter
선택된 Controller 전후 처리 → Interceptor
Exception을 HTTP 오류로 변환 → Exception Handler
```

### Repository 부재와 Service의 조회 실패

`GET /api/tickets/999` 처리 중 Repository가 `Optional.empty()`를 반환했을 때 이를 Ticket 단건 조회 유스케이스의 실패로 해석하는 객체는 Service라고 답했다.

- Repository: 저장소 조회 결과만 반환한다.
- Service: 현재 작업이 특정 Ticket 단건 조회라는 의미를 알고 있으므로 부재를 조회 실패로 해석한다.
- Controller: HTTP 입력을 유스케이스 호출로 변환하고 성공 결과를 HTTP 응답으로 조립한다.
- Exception Handler: 발생한 Application 실패를 HTTP 오류 응답으로 변환한다.

현재 프로젝트는 Service가 `TicketNotFoundException`을 발생시키는 예외 기반 조회 설계를 사용한다. 성공은 `TicketResult` 반환으로, 부재 실패는 Exception 전파로 구분한다.

예외 기반 설계와 `Optional`, 별도 Result Type, `null` 반환 방식의 차이는 설명을 통해 확인했다.

### 목록 조회의 빈 결과 판단과 교정

`GET /api/tickets?status=RESOLVED`의 검색 결과가 0건인 상황에서도 단건 조회와 일관성을 유지하려면 `TicketNotFoundException`을 사용하는 것이 적절하다고 처음 답했다. 빈 목록만으로는 정상적인 0건과 Repository 오동작·호출 실패를 구분하기 어렵다는 이유를 제시했다.

교정 후 다음 두 상황의 의미가 다르다는 점을 확인했다.

- 정상적으로 목록을 검색했지만 조건에 맞는 Ticket이 0건 → 빈 목록 `[]`
- Database 연결이나 Query 실행 등 Repository 호출 자체가 실패 → Exception

Repository가 실제 실패를 빈 목록으로 바꾸지 않고 Exception으로 전달한다면 두 상황은 구분된다. 특정 ID 단건 조회는 지목한 Resource가 없어 유스케이스가 실패하지만, 조건 검색은 결과 집합의 크기가 0이어도 검색 자체는 성공할 수 있다.

따라서 현재 학습 계약에서는 다음처럼 구분한다.

```text
GET /api/tickets/999
→ TicketNotFoundException
→ 404 Not Found

GET /api/tickets?status=RESOLVED
→ 정상 검색 결과 0건
→ 200 OK + []

Repository 호출 실패
→ Exception
→ 안전한 500 계열 오류 응답
```

관련 개념을 독립적으로 복습할 수 있도록 [Service 결과와 실패 표현 설계](../study-docs/learning-service-result-and-failure-design.md)를 작성했다.

## 최소 구현

Lab에 다음 Production Code를 추가했다.

- `RequestIdFilter`: UUID Request ID를 Request 속성과 `X-Request-Id` Response Header에 저장하고 다음 Filter Chain을 호출
- `HandlerTimingInterceptor`: 요청별 시작 시각을 Request 속성에 저장하고 선택된 Controller Method 이름, 최종 HTTP Status와 경과 시간을 완료 로그에 기록
- `WebConfiguration`: Spring이 생성한 Interceptor를 생성자로 주입받아 MVC Interceptor Registry에 등록

요청 시작 시각은 Singleton Bean의 필드가 아니라 Request 속성에 저장했다. 여러 요청이 하나의 필드를 공유하여 시간이 섞이는 문제를 피하기 위해서다. Filter와 Interceptor에는 Ticket의 Domain 규칙이나 조회 Use Case를 넣지 않았다.

## 단위 Test와 전체 Context Test의 차이

`RequestIdFilterTest`에서는 Request ID 생성·공유와 다음 Filter Chain 호출을 확인했다. `HandlerTimingInterceptorTest`에서는 `preHandle()`이 `true`를 반환하고 시작 시각이 `Long` 값으로 Request 속성에 저장되는지 확인했다.

두 단위 Test는 각 객체의 동작만 증명하며 Spring MVC 등록까지 증명하지 않는다. `WebInfrastructureIntegrationTest`에서는 전체 Application Context를 구성하여 다음을 별도로 확인했다.

- `GET /api/tickets/999`의 `404` Response에 `X-Request-Id` Header가 존재한다.
- 출력 로그에 `handler=TicketController#findById`, `status=404`, `elapsedNanos=`가 기록된다.

실행 시간은 매번 달라지므로 특정 숫자를 고정하지 않고 경과 시간 필드가 기록됐는지만 검증했다. Filter Test가 통과했다는 사실만으로 Interceptor 실행까지 단정하지 않았다.

## Spring Boot 4 MVC Test 의존성

`@AutoConfigureMockMvc` Import가 해석되지 않아 Project Test Classpath를 확인했다. 기존 `spring-boot-starter-test`에는 Spring Boot 4의 MVC 전용 Test 모듈이 포함되지 않아, 기존 Test 기능과 MVC Test 지원을 함께 제공하는 `spring-boot-starter-webmvc-test`로 교체했다.

Spring Boot Parent가 Version을 관리하므로 별도 Version은 적지 않았다. `test-compile`과 대상 통합 Test를 통과하여 Import와 Test 실행 경로를 확인했다.

## 실행 근거

8월 29일 야간에 시작하여 8월 30일 01시대에 끝난 같은 학습 세션에서 다음 환경을 확인했다.

```text
Java Runtime: Temurin OpenJDK 25.0.4
javac: 25.0.4
Maven Wrapper 실행 Maven: 3.9.16
Spring Boot: 4.1.1
```

각 단위 Test와 통합 Test를 개별 실행한 뒤 전체 Clean Test를 실행했다.

```text
Tests run: 33
Failures: 0
Errors: 0
Skipped: 0
BUILD SUCCESS
```

기존 29개 Test와 새 Web 공통 처리 Test 4개가 함께 통과했다. 실제 Server 기동과 `curl.exe` Request·Response Trace는 이 세션에서 다시 실행하지 않았다. 정상 `201`·`200`과 대표 `400`·`404` Trace는 8월 27일 근거이며, 이번 세션의 새 근거는 단위·통합 Test와 전체 Clean Build다.

## 종료 조건

- [x] Filter·Interceptor·Exception Handler의 선택 이유를 자료 없이 설명한다.
- [x] Filter·Interceptor 최소 구현과 관련 Test가 통과한다.
- [x] 새 Terminal에서 Java·Maven Version을 확인한다.
- [x] 전체 33개 Clean Test가 통과한다.
- [x] 관련 저장소의 구현과 진행 기록을 의미 단위별로 Commit한다.
- [ ] Week 2 WIL을 검토하고 게시한다. — 8월 30일 초안 정리, 8월 31일 제출 예정

## 후속 복습

Filter·Interceptor·Exception Handler의 선택 기준은 설명하고 Code로 확인했다. 다만 Exception 처리 구성요소의 클래스·메서드 이름과 전체 전파 순서는 자료 없이 즉시 떠올리는 데 시간이 걸렸다. 8월 31일 Week 3 첫 학습 Block에서 다음 흐름을 다시 설명한다.

```text
Exception 발생
→ HandlerExceptionResolver가 처리 방법 탐색
→ 선택된 Exception Handler가 ProblemDetail 생성
→ HttpMessageConverter가 Response Body로 변환
```

## AI 활용 경계

- AI 보조: 소크라테스식 질문, 오답 교정, 구현 단계와 Test 관찰 지점 제안, 오류 원인·의존성 설명, 문서 정리
- 직접 수행: 질문 답변, Production·Test Code 입력과 수정, Maven 명령 실행, 컴파일·대상 Test·전체 Clean Test 결과 확인
- 이번 세션 미수행: CORS·Preflight, 비동기 Dispatch, 실제 운영 Monitoring과 분산 Trace
