# Learning Note — Service 결과와 실패 표현 설계

> 작성일: 2026-08-29
> 기준: Java SE 25, HTTP Semantics와 현재 AI Helpdesk 학습 구조

## 핵심 질문

> Service는 성공 결과, 정상적인 결과 없음과 실제 처리 실패를 호출자에게 어떤 형태로 전달해야 하는가?

## 학습 목표

이 자료를 학습한 뒤 다음 내용을 자신의 말로 설명하는 것이 목표다.

- 정상 결과와 실패를 Method의 반환값과 Exception으로 어떻게 구분하는지 설명한다.
- 단건 조회와 목록 조회에서 “결과 없음”의 의미가 다른 이유를 설명한다.
- Exception, `Optional`, 별도 Result Type과 `null` 반환 방식의 장단점을 비교한다.
- Repository의 저장소 결과와 Service의 유스케이스 해석을 구분한다.
- Application 결과를 HTTP Status와 Body로 바꾸는 책임이 Web Boundary에 있는 이유를 설명한다.
- 저장소 조회 실패를 빈 목록으로 숨기면 안 되는 이유를 설명한다.

개인 답변, 실제 구현 여부와 실행 결과는 날짜별 Study Note에 기록한다. 이 문서는 특정 날짜의 진도와 독립적으로 다시 읽을 수 있는 개념 자료다.

## 선행 자료

- [Java Exception과 안전한 실패 처리](../../week1/study-docs/learning-java-exceptions.md)
- [Java Collections](../../week1/study-docs/learning-java-collections.md)
- [Spring Validation과 HTTP 오류 응답](./learning-spring-validation-and-error-responses.md)

## 한 문장 설명

Service 결과 설계는 Method가 성공 값, 정상적인 부재와 실제 실패를 서로 구분할 수 있는 계약으로 표현하고, 호출자가 각 결과에 맞는 다음 행동을 선택할 수 있게 만드는 작업이다.

## “결과가 없다”와 “조회에 실패했다”는 다르다

다음 두 상황은 겉으로는 Ticket을 받지 못했다는 점이 같지만 의미가 다르다.

### 정상적으로 조회했지만 결과가 없음

```text
상태가 RESOLVED인 Ticket 검색
→ Repository 조회 정상 완료
→ 조건에 맞는 Ticket 0건
→ 빈 목록 반환
```

조회 작업은 성공했다. 결과 개수가 0일 뿐이다.

### Repository 호출 자체가 실패함

```text
상태가 RESOLVED인 Ticket 검색
→ Database 연결 실패 또는 Query 실행 실패
→ 정상 결과를 만들 수 없음
→ Exception 발생
```

이 경우는 검색 결과가 0건이라는 뜻이 아니다. 조회 작업을 정상적으로 끝내지 못한 것이다.

따라서 Repository가 실제 실패를 잡아서 빈 목록으로 바꾸면 안 된다.

```java
// 잘못된 예시
try {
    return database.findAllByStatus(status);
} catch (RuntimeException exception) {
    return List.of();
}
```

위 코드는 다음 두 상황을 모두 `List.of()`로 만들어 버린다.

- 정상 조회 결과가 0건
- Database 오류로 조회하지 못함

호출자는 둘을 구분할 수 없다. 복구할 수 없는 실패를 숨기지 말고 전파하거나 의미 있는 상위 수준 Exception으로 변환해야 한다.

## Layer별 책임

### Repository

Repository는 저장소와 상호작용하고 저장소 관점의 결과를 반환한다.

```java
Optional<Ticket> findById(long id);

List<Ticket> findAllByStatus(
        TicketStatus status);
```

- 단건 값이 없으면 `Optional.empty()`
- 목록 검색 결과가 0건이면 빈 `List`
- 저장소 호출을 완료할 수 없으면 Exception

Repository는 동일한 부재가 현재 유스케이스에서 정상인지 실패인지까지 결정하지 않는다.

### Application Service

Service는 Repository 결과에 유스케이스 의미를 부여한다.

- “ID로 특정 Ticket 한 개 조회”에서 부재 → 조회 유스케이스 실패로 해석할 수 있음
- “상태에 맞는 Ticket 목록 검색”에서 0건 → 정상적인 빈 결과로 해석할 수 있음
- “있으면 사용하고 없으면 기본값 적용”에서 부재 → 정상적인 선택적 결과로 해석할 수 있음

동일한 `Optional.empty()`라도 유스케이스 계약에 따라 의미가 달라질 수 있다.

### Web Boundary

Controller와 Exception Handler는 Application 결과와 실패를 HTTP 계약으로 변환한다.

```text
TicketResult
→ 200 OK + TicketResponse

빈 Ticket 목록
→ 200 OK + []

TicketNotFoundException
→ 404 Not Found + ProblemDetail

예상하지 못한 저장소 실패
→ 안전한 500 계열 오류 응답
```

Service는 `404`, `ProblemDetail`이나 `ResponseEntity`를 직접 만들지 않는다. Application 의미와 HTTP 전달 형식을 분리하기 위해서다.

## 네 가지 결과 표현 방식

### 1. Exception 기반

성공은 반환값으로 전달하고, 유스케이스를 정상적으로 완료할 수 없으면 Exception을 발생시킨다.

```java
public TicketResult findById(long id) {
    return repository.findById(id)
            .map(ticket -> toResult(id, ticket))
            .orElseThrow(
                    () -> new TicketNotFoundException(id));
}
```

```text
Ticket 존재
→ TicketResult 반환

Ticket 부재
→ TicketNotFoundException 발생
```

장점은 성공 경로가 단순하고 공통 Exception Handler에서 실패를 일관되게 처리하기 쉽다는 것이다.

주의할 점은 예상 가능한 부재까지 모두 Exception으로 표현하면 정상적인 선택 흐름이 숨겨질 수 있다는 것이다. Exception 이름과 Handler 관계를 모르면 Code만 보고 전체 흐름을 따라가기 어려울 수도 있다.

“예외 기반 조회 설계”는 Java나 Spring이 정의한 하나의 공식 Design Pattern 이름이 아니다. 조회 실패를 Exception 경로로 표현하기로 선택한 설계를 설명하는 표현이다.

### 2. `Optional` 기반

값이 있을 수도 있고 없을 수도 있다는 사실을 반환 Type에 드러낸다.

```java
public Optional<TicketResult> findOptionalById(
        long id) {
    return repository.findById(id)
            .map(ticket -> toResult(id, ticket));
}
```

호출자는 값이 없는 경우의 행동을 직접 선택한다.

```java
service.findOptionalById(id)
        .ifPresent(this::useTicket);
```

`Optional`은 “결과 없음”이 정상적으로 발생할 수 있고 호출자가 대체 동작을 선택해야 할 때 적합하다. Java API도 `Optional`을 `null` 대신 결과 없음의 가능성을 나타내는 Method 반환 Type으로 주로 사용하도록 설명한다.

장점은 부재 가능성이 Method Signature에 보인다는 것이다. 단점은 모든 호출자가 부재의 의미를 다시 해석해야 하고, 같은 변환 Code가 여러 경계에서 반복될 수 있다는 것이다.

### 3. 별도 Result Type 기반

성공과 예상 가능한 실패를 각각 명시적인 Type으로 표현한다.

```java
sealed interface FindTicketResult {

    record Found(TicketResult ticket)
            implements FindTicketResult {
    }

    record NotFound(long id)
            implements FindTicketResult {
    }
}
```

```java
public FindTicketResult findById(long id) {
    return repository.findById(id)
            .<FindTicketResult>map(ticket ->
                    new FindTicketResult.Found(
                            toResult(id, ticket)))
            .orElseGet(() ->
                    new FindTicketResult.NotFound(id));
}
```

호출자는 `Found`와 `NotFound`를 명시적으로 처리한다. 성공, 거부, 보류처럼 예상 가능한 결과 종류가 여러 개라면 Exception보다 계약을 읽기 쉬울 수 있다.

단점은 단순한 조회에도 Type과 분기 Code가 늘어난다는 것이다. 예상하지 못한 Programming 오류나 저장소 장애까지 모두 Result Type에 넣어야 한다는 뜻은 아니다.

### 4. `null` 기반

값이 없을 때 `null`을 반환하는 방식이다.

```java
public TicketResult findById(long id) {
    return null;
}
```

반환 Type만 보아서는 `null` 가능성을 알기 어렵다. 호출자가 검사를 잊으면 `NullPointerException`이 발생할 수 있고, 부재·실패·미완성 구현의 의미도 구분하기 어렵다.

새로운 Java Application Code에서는 부재 의미가 있는 경우 `Optional`, 빈 Collection, Exception 또는 별도 Result Type 중 더 명확한 방식을 우선 검토한다.

## 방식 비교

| 방식 | 성공 | 부재 또는 예상 실패 | 장점 | 주의점 |
|---|---|---|---|---|
| Exception | 결과 객체 반환 | Exception 발생 | 성공 경로가 단순하고 공통 실패 처리에 유리 | 예상 가능한 정상 부재까지 남용할 수 있음 |
| `Optional<T>` | `Optional.of(value)` | `Optional.empty()` | 부재 가능성이 Signature에 드러남 | 호출자마다 부재 의미를 처리해야 함 |
| Result Type | `Found` 등 | `NotFound`, `Rejected` 등 | 예상 결과 종류가 명시적임 | Type과 분기 Code가 증가함 |
| `null` | 객체 반환 | `null` | 작성은 간단함 | 의미가 불명확하고 누락 검사 위험이 큼 |
| `List<T>` | 1개 이상의 요소 | 빈 목록 | 목록 조회의 개수를 자연스럽게 표현 | 실제 조회 실패를 빈 목록으로 숨기면 안 됨 |

Checked Exception과 Unchecked Exception의 선택은 별도 문제다. Exception 기반 설계를 선택했다고 반드시 Checked Exception을 사용해야 하는 것은 아니다.

## 단건 조회와 목록 조회

### 특정 단건 Resource 조회

```http
GET /api/tickets/999
```

URI가 특정 Ticket 하나를 지목한다. 현재 API 계약에서 ID `999`인 Ticket이 없다면 성공 Body를 만들 수 없으므로 Application의 `TicketNotFoundException`을 Web Boundary에서 `404 Not Found`로 변환한다.

### 조건에 맞는 목록 조회

```http
GET /api/tickets?status=RESOLVED
```

이 요청은 특정 Ticket 하나가 반드시 존재한다고 주장하지 않는다. 조건에 맞는 Ticket 집합을 요청한다. 정상적으로 검색했지만 일치하는 Ticket이 없다면 결과 집합의 크기가 0인 것이다.

```http
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
[]
```

여기서 빈 목록은 모호하지 않다. Method와 API 계약이 다음 의미를 구분하기 때문이다.

```text
정상 조회·0건
→ 빈 List
→ 200 OK + []

저장소 호출 실패
→ Exception
→ 500 계열 오류 계약
```

일관성은 “결과가 없으면 항상 같은 Exception을 사용한다”는 뜻이 아니다. 의미가 같은 상황을 같은 방식으로 처리한다는 뜻이다. 특정 단건의 부재와 정상적으로 비어 있는 검색 결과는 의미가 다르므로 서로 다른 계약을 가질 수 있다.

특별한 업무 규칙상 검색 결과가 반드시 한 건 이상이어야 한다면 목록 부재를 실패로 정할 수도 있다. 이 경우에는 일반 검색이 아니라 해당 유스케이스의 명시적인 계약으로 문서화하고 Test해야 한다.

## 선택 판단 순서

결과 Type이나 Exception부터 정하지 말고 다음 순서로 판단한다.

1. 호출자가 요청한 것은 특정 단건인가, 선택적 단건인가, 목록인가?
2. 결과 없음이 정상적으로 예상되는가?
3. 호출자가 부재에 따라 다른 동작을 선택해야 하는가?
4. 예상 가능한 결과 종류가 둘보다 많은가?
5. 실제 저장소 실패와 정상적인 결과 없음을 구분했는가?
6. Application 결과에 HTTP 개념이 섞이지 않았는가?
7. 각 성공·부재·실패 계약을 Test할 수 있는가?

일반적인 출발점은 다음과 같다.

| 상황 | 먼저 검토할 표현 |
|---|---|
| 반드시 존재해야 성공하는 단건 조회 | Exception 또는 명시적 Result Type |
| 없어도 정상인 선택적 단건 조회 | `Optional<T>` |
| 조건에 맞는 목록 조회 | `List<T>`, 0건은 빈 목록 |
| 예상 가능한 업무 결과가 여러 종류 | 별도 Result Type |
| 예상하지 못한 저장소·시스템 실패 | Exception 전파 또는 의미 있는 Exception으로 변환 |

## 자주 발생하는 오해

### 예외 기반 설계를 선택했으므로 모든 조회 결과 없음은 Exception이다

아니다. 단건과 목록의 계약은 다르다. 목록의 0건은 정상 결과일 수 있다.

### 빈 목록은 저장소 실패와 구분할 수 없다

Repository가 실패를 빈 목록으로 숨기지 않는다면 구분할 수 있다. 빈 목록은 정상 조회 0건이고, 저장소 실패는 Exception 경로다.

### `Optional.empty()`는 곧 `404`다

아니다. `Optional.empty()`는 Java 값의 부재를 표현한다. 현재 유스케이스에서 실패인지 정상인지 Service가 해석하고, HTTP `404` 변환은 Web Boundary가 담당한다.

### Result Type을 사용하면 Exception이 전혀 필요 없다

아니다. Result Type은 주로 예상 가능한 성공·실패를 명시한다. Out of Memory, Programming 오류나 예기치 않은 저장소 장애까지 모두 정상 반환값으로 바꿔야 한다는 뜻은 아니다.

### Service가 `ResponseEntity`를 반환하면 가장 간단하다

당장은 간단해 보이지만 Application Service가 HTTP 전달 방식에 결합된다. 같은 유스케이스를 Batch나 Message Consumer에서 재사용하기 어려워질 수 있다.

## 설명 연습 질문

1. Repository의 `Optional.empty()`와 Service의 조회 실패는 어떻게 다른가?
2. 특정 ID 단건 조회에서 부재를 Exception으로 해석할 수 있는 이유는 무엇인가?
3. 상태별 목록 조회가 0건일 때 빈 목록이 자연스러운 이유는 무엇인가?
4. Repository가 실제 Database 오류를 빈 목록으로 바꾸면 어떤 문제가 생기는가?
5. `Optional<T>`가 잘 맞는 조회는 어떤 조회인가?
6. 별도 Result Type이 Exception보다 유리할 수 있는 경우는 언제인가?
7. `null` 반환이 부재 계약을 약하게 만드는 이유는 무엇인가?
8. Service가 `404`나 `ProblemDetail`을 직접 만들면 어떤 계층 결합이 생기는가?
9. 일관성이 모든 “결과 없음”을 같은 방식으로 처리한다는 뜻이 아닌 이유는 무엇인가?
10. 목록 결과 0건과 저장소 호출 실패를 Test에서 어떻게 따로 검증할 수 있는가?

## 자료 범위

이 자료는 동기식 Java Application Service의 결과와 실패 표현을 학습 범위로 삼는다. 다음 내용은 별도 학습 대상으로 남긴다.

- Database Transaction과 Rollback
- Retry와 Circuit Breaker
- 비동기·Reactive 결과 Type
- 대규모 시스템의 Error Code Registry
- Pagination과 검색 결과 Metadata
- 인증·인가 실패의 보안 응답 정책

## 참고 자료

- [Java SE 25 API — Optional](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Optional.html)
- [Java SE 25 API — List](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/List.html)
- [Java Language Specification 25 — Chapter 11. Exceptions](https://docs.oracle.com/javase/specs/jls/se25/html/jls-11.html)
- [RFC 9110 — HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [Spring Framework — Error Responses](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-rest-exceptions.html)
