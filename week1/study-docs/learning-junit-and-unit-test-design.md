# Learning Note — JUnit과 단위 테스트 설계

> 작성일: 2026-08-19
> 주차: Week 1
> 이해 상태: 부분 설명 가능
> 기준: JUnit 6.1.3, Java 25

## 핵심 질문

> 객체의 규칙을 반복 가능하고 읽을 수 있는 Test로 표현하려면 JUnit의 어떤 구성 요소와 설계 원칙을 이해해야 하는가?

## 시작할 때의 이해

JShell에서 Ticket의 정상 상태 전이와 잘못된 전이를 직접 호출하여 결과를 관찰했다. 이를 통해 객체가 상태 전이 규칙을 지키는지는 확인했지만, 같은 검증을 반복하려면 명령을 다시 입력하고 결과를 사람이 해석해야 했다.

JUnit이 자동 Test Framework라는 점은 알고 있었지만 다음 항목은 구분하여 설명할 필요가 있었다.

- Test Code를 작성하는 API와 Test를 실행하는 Engine의 차이
- Maven의 `test` Phase와 JUnit의 관계
- 예상값과 실제값을 Assertion으로 비교하는 방법
- 예외 발생뿐 아니라 실패 후 객체 상태까지 검증하는 방법
- Test가 서로의 실행 순서와 변경 가능한 상태에 의존하지 않게 하는 이유

## 한 문장 설명

JUnit은 JVM에서 Test를 발견하고 실행하는 기반과 Java Test 작성 모델을 제공하며, 개발자가 입력·행동·기대 결과를 실행 가능한 계약으로 표현하고 변경 후에도 같은 규칙을 반복 검증할 수 있게 한다.

## 단위 Test란 무엇인가

단위 Test는 하나의 동작 단위를 통제된 조건에서 실행하고 관찰 가능한 결과가 기대와 같은지 확인하는 자동 Test다. 여기서 단위는 반드시 Method 하나를 뜻하지 않는다. 한 객체의 상태 전이, 여러 객체가 협력하는 작은 정책 또는 순수 함수 하나가 될 수 있다.

Ticket 예제에서 검증하려는 단위는 다음과 같다.

- 유효한 제목으로 생성된 Ticket의 초기 상태
- 현재 상태에서 허용되는 행동과 다음 상태
- 현재 상태에서 거부되는 행동과 예외 Type
- 거부된 행동 이후에도 유지되는 기존 상태

단위 Test는 구현 내부의 모든 줄을 확인하는 작업이 아니다. 외부에 공개된 행동을 통해 객체의 계약을 검증한다. 따라서 `private status` Field를 직접 읽는 대신 `status()`를 호출하고, `private` 검증 Method가 있다면 그 Method 자체보다 공개 행동의 결과를 확인한다.

## 수동 실험과 자동 Test의 차이

| 구분 | JShell 수동 실험 | JUnit 자동 Test |
|---|---|---|
| 실행 | 사람이 명령을 순서대로 입력 | Test Runner가 Test를 발견하고 반복 실행 |
| 판정 | 사람이 출력과 예외를 해석 | Assertion이 기대 결과와 실제 결과를 비교 |
| 반복성 | 입력 누락이나 순서 차이가 생길 수 있음 | 같은 Source와 설정이면 같은 검증을 재실행 |
| 회귀 확인 | 변경 후 실험을 다시 기억해 수행 | Build에서 전체 Test를 다시 실행 |
| 기록 | 별도 문서나 Terminal Log 필요 | Test Code와 Report가 실행 가능한 근거가 됨 |

자동 Test가 있다고 해서 결함이 없다는 의미는 아니다. 작성한 Case와 Assertion이 다루는 범위만 반복해서 검증할 수 있다.

## JUnit의 구성

2026-08-19 공식 문서 기준 JUnit 안정 Version은 6.1.3이며, JUnit은 Platform, Jupiter와 Vintage로 구성된다.

| 구성 요소 | 역할 | 현재 학습 범위 |
|---|---|---|
| JUnit Platform | JVM에서 Test Framework를 실행하는 기반과 `TestEngine` API 제공 | Maven과 IDE가 Test를 실행하는 기반으로 이해 |
| JUnit Jupiter | Test 작성 Programming Model, Extension Model과 Jupiter `TestEngine` 제공 | `@Test`, Assertion과 Lifecycle Annotation 사용 |
| JUnit Vintage | JUnit 3·4 Test를 Platform에서 실행하는 Engine | Deprecated이므로 신규 Ticket Test에는 사용하지 않음 |

JUnit 6.1.3은 Runtime에서 Java 17 이상을 요구한다. JDK 25는 이 조건을 충족한다. JUnit의 Major Version이 6이어도 Jupiter의 Java Package는 `org.junit.jupiter.api`를 사용한다.

## Maven에서 JUnit Test가 실행되는 흐름

```text
src/test/java의 Test Source
        ↓
Maven Compiler Plugin이 Test Source Compile
        ↓
Maven Surefire Plugin이 Test Class 탐색
        ↓
JUnit Platform이 등록된 TestEngine 호출
        ↓
Jupiter Engine이 @Test Method 발견·실행
        ↓
Assertion 결과를 Report와 Build 결과에 반영
```

JUnit은 Test Code가 사용하는 API와 Engine을 제공하는 Dependency다. Maven Surefire는 Maven의 `test` Phase에서 Test를 찾아 실행하는 Build Plugin이다. 두 역할은 서로 다르다.

### 최소 Maven 구성의 의미

다음 예시는 JUnit Jupiter와 Surefire의 관계를 보여 주기 위한 최소 구성이다. 기존 POM에 적용할 때는 이미 존재하는 `properties`, `dependencies`와 `build/plugins`에 병합해야 한다.

```xml
<properties>
    <junit.version>6.1.3</junit.version>
    <maven-surefire-plugin.version>3.5.5</maven-surefire-plugin.version>
</properties>

<dependencies>
    <dependency>
        <groupId>org.junit.jupiter</groupId>
        <artifactId>junit-jupiter</artifactId>
        <version>${junit.version}</version>
        <scope>test</scope>
    </dependency>
</dependencies>

<build>
    <plugins>
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-surefire-plugin</artifactId>
            <version>${maven-surefire-plugin.version}</version>
        </plugin>
    </plugins>
</build>
```

- `junit-jupiter`: Jupiter API와 Test Engine 등을 묶어 제공하는 Dependency
- `test` Scope: Main Source가 아니라 Test Compile과 실행 Classpath에서 사용
- `maven-surefire-plugin`: Unit Test를 탐색하고 JUnit Platform을 통해 실행
- JUnit 6: Maven Surefire·Failsafe 3.0.0 이상 필요

JUnit Artifact를 여러 개 직접 선언한다면 공식 문서는 JUnit BOM으로 Version을 정렬하는 방식을 권장한다. 한 개의 `junit-jupiter` 집계 Artifact에 Version을 선언하는 경우 해당 Artifact가 JUnit BOM을 전이적으로 사용한다.

### Test Class 발견 규칙

Surefire의 기본 Test Class 이름 Pattern에는 다음 형식이 포함된다.

- `Test*.java`
- `*Test.java`
- `*Tests.java`
- `*TestCase.java`

`TicketTest.java`는 기본 Pattern에 해당한다. `src/test/java` 아래에 파일이 있어도 이름이 탐색 Pattern과 맞지 않거나 Test Engine이 Test Classpath에 없다면 실제 Test가 실행되지 않을 수 있다.

`mvnw.cmd test`가 `BUILD SUCCESS`를 출력하더라도 발견된 Test가 0개라면 Ticket 규칙을 자동 검증한 것은 아니다. Build Lifecycle이 오류 없이 끝난 사실과 Domain Test가 실행된 사실을 구분해야 한다.

## Test Class와 Method

JUnit Jupiter의 일반 Test Class와 Test Method는 `public`일 필요가 없지만 `private`이면 안 된다. 특별한 이유가 없다면 Package-Private으로 작성할 수 있다.

```java
package lab.helpdesk.ticket;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class TicketTest {

    @Test
    void new_ticket_starts_open() {
        var ticket = new Ticket("로그인 오류");

        assertEquals(TicketStatus.OPEN, ticket.status());
    }
}
```

- `@Test`: Method를 Jupiter Test Method로 표시
- 반환 Type: 일반 `@Test` Method는 `void`
- Test Package: Main Source와 같은 `lab.helpdesk.ticket` Package를 사용
- Test 이름: 검증할 조건과 예상 결과가 드러나게 작성

## 핵심 Annotation

| Annotation | 실행 시점과 역할 | 사용 경계 |
|---|---|---|
| `@Test` | 하나의 Test Method를 표시 | 첫 Unit Test의 필수 Annotation |
| `@BeforeEach` | 각 Test Method 실행 전에 호출 | 여러 Test가 같은 준비 Code를 실제로 공유할 때 사용 |
| `@AfterEach` | 각 Test Method 실행 후에 호출 | File, Connection 같은 Resource 정리가 필요할 때 사용 |
| `@BeforeAll` | 해당 Class의 모든 Test 전 한 번 호출 | 비싼 공통 Resource 준비가 필요할 때 제한적으로 사용 |
| `@AfterAll` | 해당 Class의 모든 Test 후 한 번 호출 | Class 단위 Resource 정리에 사용 |
| `@DisplayName` | Report와 IDE에 표시할 이름 지정 | Method 이름만으로 의도가 충분하지 않을 때 선택 |
| `@Disabled` | Test를 실행 대상에서 제외 | 임시 회피가 완료로 남지 않도록 이유와 복구 조건 필요 |

기본 Test Instance Lifecycle에서는 `@BeforeAll`과 `@AfterAll` Method가 일반적으로 `static`이어야 한다. 현재 Ticket Test처럼 준비가 단순한 경우에는 `@BeforeEach`에 객체 생성을 숨기기보다 각 Test의 Given에 직접 작성하는 편이 조건을 읽기 쉽다.

## Assertion

Assertion은 실제 결과가 기대 결과와 같은지 판정한다. JUnit Jupiter의 기본 Assertion은 `org.junit.jupiter.api.Assertions` Class의 `static` Method다.

| Assertion | 확인하는 내용 | Ticket 예시 |
|---|---|---|
| `assertEquals(expected, actual)` | 값의 동등성 | 기대 상태와 `ticket.status()` 비교 |
| `assertTrue(condition)` | 조건이 `true`인지 | 필요한 Boolean 규칙 검증 |
| `assertFalse(condition)` | 조건이 `false`인지 | 금지 조건 검증 |
| `assertThrows(type, executable)` | 지정 Type 또는 하위 Type 예외 발생 | 잘못된 상태 전이 거부 |
| `assertThrowsExactly(type, executable)` | 정확히 같은 Type의 예외 발생 | 하위 Type까지 허용하면 안 되는 계약 |
| `assertDoesNotThrow(executable)` | 실행 중 예외가 발생하지 않음 | 예외 부재 자체가 중요한 계약 |
| `assertAll(executables...)` | 묶인 Assertion을 모두 실행 | 하나의 행동에서 여러 관찰 결과 확인 |

`assertEquals()`에서는 기대값을 먼저, 실제값을 나중에 전달한다.

```java
assertEquals(TicketStatus.OPEN, ticket.status());
```

순서를 반대로 적어도 비교 자체는 수행되지만 실패 Report의 expected와 actual이 뒤바뀌어 원인을 읽기 어려워진다.

### 예외 Assertion

`assertThrows()`는 예외 발생 여부만 확인하는 것이 아니라 실제로 발생한 예외 객체를 반환한다. 필요한 경우 Type 외에 Message도 추가로 검증할 수 있다.

```java
@Test
void open_ticket_cannot_be_resolved() {
    var ticket = new Ticket("로그인 오류");

    var exception = assertThrows(
            IllegalStateException.class,
            ticket::resolve);

    assertEquals(
            "only IN_PROGRESS ticket can be resolved",
            exception.getMessage());
}
```

`assertThrows(IllegalStateException.class, ...)`는 `IllegalStateException`의 하위 Type도 허용한다. 정확히 같은 Type만 허용하려면 `assertThrowsExactly()`를 사용한다.

예외 Message는 사용자나 다른 Component가 의존하는 계약일 때 검증한다. 단순한 내부 진단 문구라면 모든 문구를 고정하는 Test가 불필요한 변경 비용을 만들 수 있다.

## Given–When–Then

Given–When–Then은 JUnit Annotation이 아니라 Test의 조건, 행동과 결과를 읽기 쉽게 구분하는 작성 방식이다. Arrange–Act–Assert와 같은 흐름을 다른 용어로 표현한다.

| Given–When–Then | Arrange–Act–Assert | 의미 |
|---|---|---|
| Given | Arrange | 객체, 입력과 현재 상태 준비 |
| When | Act | 검증하려는 행동 한 가지 실행 |
| Then | Assert | 관찰 결과와 기대 결과 비교 |

```java
@Test
void open_ticket_starts_progress() {
    // Given
    var ticket = new Ticket("로그인 오류");

    // When
    ticket.startProgress();

    // Then
    assertEquals(TicketStatus.IN_PROGRESS, ticket.status());
}
```

주석은 구조 학습에는 도움이 되지만 항상 필요하지는 않다. 준비·행동·검증이 짧고 명확하면 빈 줄과 변수 이름만으로도 같은 구조를 표현할 수 있다.

## 실패 후 상태 보존 Test

예외 Type만 검증하면 요청이 거부됐다는 사실은 확인할 수 있지만 객체가 잘못 변경되지 않았는지는 확인할 수 없다. Ticket의 불변조건을 검증하려면 예외 발생 후 상태도 관찰해야 한다.

```java
@Test
void failed_resolve_keeps_ticket_open() {
    // Given
    var ticket = new Ticket("로그인 오류");

    // When
    assertThrows(IllegalStateException.class, ticket::resolve);

    // Then
    assertEquals(TicketStatus.OPEN, ticket.status());
}
```

이 Test가 통과하는 이유는 예외가 상태를 자동 복구하기 때문이 아니다. `resolve()`가 상태를 변경하기 전에 현재 상태를 검사하고, 잘못된 경우 대입문에 도달하기 전에 예외를 던지기 때문이다.

## Ticket Test Case 설계

| 분류 | Given | When | Then |
|---|---|---|---|
| 정상 생성 | 유효한 제목 | Ticket 생성 | 상태는 `OPEN` |
| 경계 입력 | `null` 제목 | Ticket 생성 | `IllegalArgumentException` |
| 경계 입력 | 빈 문자열 | Ticket 생성 | `IllegalArgumentException` |
| 경계 입력 | 공백 문자열 | Ticket 생성 | `IllegalArgumentException` |
| 정상 전이 | `OPEN` Ticket | `startProgress()` | `IN_PROGRESS` |
| 정상 전이 | `IN_PROGRESS` Ticket | `resolve()` | `RESOLVED` |
| 거부 전이 | `OPEN` Ticket | `resolve()` | 예외, 상태는 `OPEN` |
| 거부 전이 | `IN_PROGRESS` Ticket | `startProgress()` | 예외, 상태는 `IN_PROGRESS` |
| 거부 전이 | `RESOLVED` Ticket | 상태 변경 행동 | 예외, 상태는 `RESOLVED` |

정상·경계·거부는 Test 개수를 채우기 위한 분류가 아니다. Domain 규칙의 허용 범위와 실패 경계를 빠뜨리지 않기 위한 관점이다.

## Test 이름

Test 이름은 구현 Method 이름만 반복하기보다 조건과 기대 결과를 드러낸다.

| 불명확한 이름 | 더 구체적인 이름 |
|---|---|
| `testTicket()` | `new_ticket_starts_open()` |
| `testResolve()` | `open_ticket_cannot_be_resolved()` |
| `testException()` | `failed_resolve_keeps_ticket_open()` |

한글 `@DisplayName`을 함께 사용할 수도 있지만 Method 이름만으로 충분히 읽힌다면 반드시 추가할 필요는 없다.

## Test 독립성과 Lifecycle

JUnit Jupiter의 기본 Test Instance Lifecycle은 `PER_METHOD`다. 각 Test Method를 실행하기 전에 Test Class의 새 Instance를 만들기 때문에 Test Instance Field가 다른 Test Method에 자동으로 공유되지 않는다.

Test는 다음 원칙을 지키는 것이 좋다.

- 다른 Test가 먼저 실행됐다고 가정하지 않는다.
- 여러 Test가 변경 가능한 `static` 상태를 공유하지 않는다.
- 각 Test가 필요한 객체와 상태를 직접 준비한다.
- 현재 시간, Random 값, Network와 외부 Database에 불필요하게 의존하지 않는다.
- 하나의 Test만 따로 실행해도 같은 결과가 나와야 한다.

JUnit의 기본 실행 순서는 반복 가능하지만 의도적으로 쉽게 예측할 수 없는 방식이다. Unit Test가 `@Order`나 Method 이름 순서에 의존한다면 독립성이 깨졌는지 먼저 점검한다.

## 좋은 Unit Test의 기준

| 기준 | 질문 |
|---|---|
| 읽기 쉬움 | Test 이름과 Given–When–Then만 보고 규칙을 이해할 수 있는가? |
| 집중 | 실패했을 때 어떤 행동 계약이 깨졌는지 알 수 있는가? |
| 결정적 | 같은 Code와 입력에서 항상 같은 결과가 나오는가? |
| 독립적 | 다른 Test의 실행 여부와 순서에 영향을 받지 않는가? |
| 빠름 | File, Network와 Database 없이 짧게 실행되는가? |
| 관찰 가능 | 구현 내부가 아니라 공개된 상태와 결과를 검증하는가? |

“Test 하나에는 Assertion 하나만 있어야 한다”는 절대 규칙이 아니다. 하나의 행동 계약을 설명하기 위해 예외 Type과 실패 후 상태처럼 여러 관찰 결과가 필요하다면 여러 Assertion을 사용할 수 있다. 서로 다른 행동을 한 Test에 넣어 실패 원인을 흐리게 만드는 것이 문제다.

## 자주 혼동하는 내용

- `@Test`만 작성해도 자동으로 실행되는 것은 아니다. Test Engine과 Maven Surefire 또는 IDE Runner가 필요하다.
- `mvn test`의 `BUILD SUCCESS`만으로 Domain 규칙이 검증됐다고 판단하지 않는다. 발견·실행된 Test 개수를 함께 본다.
- Given–When–Then은 JUnit 문법이 아니라 Test를 읽기 쉽게 구성하는 방식이다.
- 예외가 발생한다고 객체 상태가 자동으로 복구되는 것은 아니다. 상태 변경과 예외 발생의 Code 순서가 상태 보존을 결정한다.
- Code Coverage가 높다고 중요한 경계와 실패 Case를 잘 검증했다는 의미는 아니다.
- 모든 Unit Test에 Mock이 필요한 것은 아니다. 현재 Ticket처럼 외부 Collaborator가 없는 객체는 실제 객체만으로 검증하는 편이 단순하다.
- `@BeforeEach`는 중복 제거를 위한 도구지만 중요한 Given을 과도하게 숨기면 Test 이해가 어려워질 수 있다.
- `private` Method를 직접 Test하기보다 공개 행동을 통해 그 결과를 검증한다.

## 현재 학습 범위의 경계

첫 Ticket Unit Test에서는 다음 기능만으로 충분하다.

- `@Test`
- `assertEquals()`
- `assertThrows()`
- Given–When–Then
- 독립적인 Test Fixture
- 정상·경계·거부 Case

다음 항목은 반복되는 실제 필요가 생길 때 검토한다.

- `@ParameterizedTest`: 같은 규칙을 여러 입력으로 반복할 때
- `@Nested`: 상태나 Scenario별 Test 구조가 커질 때
- Mockito와 Test Double: 외부 Collaborator를 격리해야 할 때
- Spring Test: Spring Container, HTTP 또는 Persistence Integration을 검증할 때
- Maven Failsafe: Unit Test와 Integration Test Lifecycle을 분리할 때

## 설명 가능성 점검 질문

1. JUnit Platform과 Jupiter는 각각 어떤 역할을 하는가?
2. JUnit Dependency와 Maven Surefire Plugin의 차이는 무엇인가?
3. `mvn test`가 성공했지만 Test가 0개라면 무엇이 검증된 것인가?
4. `assertThrows()`가 예외 객체를 반환하는 이유는 무엇인가?
5. 잘못된 상태 전이 Test에서 예외뿐 아니라 상태도 확인해야 하는 이유는 무엇인가?
6. Given–When–Then은 JUnit 기능인가, Test 구성 방식인가?
7. Test가 실행 순서에 의존하면 어떤 문제가 발생하는가?
8. `@BeforeEach`를 사용하지 않는 편이 더 읽기 쉬운 경우는 언제인가?

## 참고 자료

- [JUnit 6.1.3 — Overview](https://docs.junit.org/6.1.3/overview.html)
- [JUnit 6.1.3 — Writing Tests](https://docs.junit.org/6.1.3/writing-tests/intro.html)
- [JUnit 6.1.3 — Annotations](https://docs.junit.org/6.1.3/writing-tests/annotations.html)
- [JUnit 6.1.3 — Test Classes and Methods](https://docs.junit.org/6.1.3/writing-tests/test-classes-and-methods.html)
- [JUnit 6.1.3 — Assertions](https://docs.junit.org/6.1.3/writing-tests/assertions.html)
- [JUnit 6.1.3 — Exception Handling](https://docs.junit.org/6.1.3/writing-tests/exception-handling.html)
- [JUnit 6.1.3 — Test Instance Lifecycle](https://docs.junit.org/6.1.3/writing-tests/test-instance-lifecycle.html)
- [JUnit 6.1.3 — Test Execution Order](https://docs.junit.org/6.1.3/writing-tests/test-execution-order.html)
- [JUnit 6.1.3 — Build Support](https://docs.junit.org/6.1.3/running-tests/build-support.html)
