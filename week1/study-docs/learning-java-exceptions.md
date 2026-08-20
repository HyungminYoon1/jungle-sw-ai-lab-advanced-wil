# Learning Note — Java Exception과 안전한 실패 처리

> 작성일: 2026-08-20
> 주차: Week 1
> 기준: Java SE 25

## 핵심 질문

> Java는 실패를 어떻게 표현하고 전달하며, Ticket 객체는 예외가 발생해도 자신의 상태 규칙을 어떻게 보호해야 하는가?

## 한 문장 설명

Java Exception은 정상 흐름으로 계속 처리할 수 없는 조건을 Type, Message, Cause와 Stack Trace를 가진 객체로 표현하고, 처리할 수 있는 호출 지점까지 실행 제어를 전달하는 방식이다.

## Exception이 필요한 이유

Method가 실패했을 때 `null`, `-1` 또는 임의의 Boolean 값만 반환하면 호출자가 그 값을 확인하지 않고 정상 결과처럼 사용할 수 있다. Exception은 정상 반환 경로와 실패 경로를 분리하고 다음 정보를 전달한다.

- 실패 종류를 나타내는 Exception Type
- 실패 상황을 설명하는 Message
- 실패를 발생시킨 원래 Cause
- 호출 경로를 보여 주는 Stack Trace

Exception이 발생하면 현재 실행 위치에서 가장 가까운 적절한 Handler로 제어가 이동한다. `throw` 이후의 문장은 실행되지 않지만, `throw` 이전에 이미 수행된 상태 변경이나 외부 작업이 자동으로 취소되는 것은 아니다.

## Java Exception 계층

```text
Object
└── Throwable
    ├── Error
    │   ├── OutOfMemoryError
    │   └── StackOverflowError
    └── Exception
        ├── IOException                 ← Checked Exception
        ├── ReflectiveOperationException ← Checked Exception
        └── RuntimeException            ← Unchecked Exception
            ├── IllegalArgumentException
            ├── IllegalStateException
            ├── NullPointerException
            └── UnsupportedOperationException
```

### `Throwable`

Java에서 던지고 잡을 수 있는 객체의 최상위 Type이다. Message, Cause, Stack Trace와 suppressed exception 정보를 제공한다.

### `Error`

JVM 또는 실행 환경의 심각한 문제를 주로 나타낸다. 일반 Application Code가 광범위하게 잡아서 정상 흐름으로 복구하려고 시도하는 대상이 아니다. `Error`와 그 하위 Type도 Unchecked에 포함된다.

### `Exception`

Application이 처리하거나 호출자에게 전달할 수 있는 실패 조건의 기본 Type이다. 그중 `RuntimeException` 계열인지에 따라 Compile 시 처리 의무가 달라진다.

## Checked Exception과 Unchecked Exception

| 구분 | 대표 Type | 호출자의 Compile 시 의무 | 주로 표현하는 조건 |
|---|---|---|---|
| Checked Exception | `IOException` | `catch`로 처리하거나 `throws`로 선언 | File·Network처럼 호출자가 복구 전략을 가질 수 있는 외부 실패 |
| Unchecked Exception | `RuntimeException` 하위 Type | `catch` 또는 `throws`를 강제하지 않음 | 잘못된 인수, 현재 상태 위반과 Programming 오류 |
| Unchecked Error | `Error` 하위 Type | `catch` 또는 `throws`를 강제하지 않음 | JVM·실행 환경의 심각한 실패 |

Checked와 Unchecked의 핵심 차이는 실패의 심각도가 아니라 Compiler가 호출자에게 처리 또는 선언을 강제하는지다.

### Checked Exception

Checked Exception이 Method 밖으로 전달될 수 있다면 다음 중 하나가 필요하다.

```java
try {
    loadTickets();
} catch (IOException exception) {
    // 이 위치에서 복구, 변환 또는 실패 응답 결정
}
```

또는 호출자가 처리하도록 선언한다.

```java
void importTickets() throws IOException {
    loadTickets();
}
```

`throws`는 예외를 처리하는 문법이 아니다. 현재 Method가 해당 Checked Exception을 호출자에게 전달할 수 있다는 계약을 선언한다.

### Unchecked Exception

`RuntimeException`과 그 하위 Type은 `catch`하거나 `throws`에 선언하도록 Compiler가 강제하지 않는다.

```java
public Ticket(String title) {
    if (title == null || title.isBlank()) {
        throw new IllegalArgumentException(
                "title must not be blank");
    }

    this.title = title;
}
```

강제되지 않는다는 말은 무시해도 된다는 의미가 아니다. 호출자는 Method 계약을 따라 올바른 인수와 상태를 준비해야 하고, Application 경계에서는 필요한 실패 응답과 기록 방식을 결정해야 한다.

## `throw`와 `throws`

| 문법 | 위치 | 역할 |
|---|---|---|
| `throw` | Method 본문 | 특정 `Throwable` 객체를 실제로 던진다. |
| `throws` | Method 또는 Constructor 선언부 | 밖으로 전달될 수 있는 Checked Exception Type을 선언한다. |

```java
void validateTitle(String title) {
    if (title == null || title.isBlank()) {
        throw new IllegalArgumentException("title must not be blank");
    }
}
```

```java
String readFirstLine(Path path) throws IOException {
    return Files.readAllLines(path).getFirst();
}
```

Unchecked Exception도 `throws`에 적을 수 있지만 Compile을 위해 필수는 아니다. API 계약을 명확하게 만드는 이점과 선언이 지나치게 장황해지는 비용을 함께 판단한다.

## Exception 전파와 호출 Stack

예외가 발생하면 Java Runtime은 현재 Method부터 호출 Stack을 거슬러 올라가며 해당 Type을 처리할 수 있는 `catch`를 찾는다.

```text
main()
  └── TicketService.resolveTicket()
        └── Ticket.resolve()
              └── IllegalStateException 발생
```

1. `Ticket.resolve()`의 남은 문장은 실행되지 않는다.
2. `Ticket.resolve()` 안에 적절한 `catch`가 없으면 호출자인 `TicketService`로 전파된다.
3. `TicketService`도 처리하지 않으면 그 호출자로 계속 전파된다.
4. 끝까지 Handler가 없으면 현재 Thread의 uncaught exception 처리로 넘어간다.

`catch`는 선언한 Type뿐 아니라 그 하위 Type도 처리한다. 따라서 구체적인 Type과 상위 Type을 함께 잡을 때는 구체적인 `catch`를 먼저 작성해야 한다.

## `try`, `catch`와 `finally`

```java
try {
    performOperation();
} catch (SpecificException exception) {
    recoverOrTranslate(exception);
} finally {
    releaseResource();
}
```

- `try`: 예외가 발생할 수 있는 실행 범위를 지정한다.
- `catch`: 처리할 수 있는 Type의 예외가 발생했을 때 실행한다.
- `finally`: 정상 완료, 예외 또는 `return` 등으로 `try`가 끝날 때 정리 작업을 수행한다.

JVM이 종료되는 등 실행 환경 자체가 끝나는 경우에는 `finally` 실행을 보장할 수 없다. 또한 `finally`에서 새 예외를 던지면 원래 예외를 가릴 수 있으므로 Resource 정리에는 try-with-resources를 우선 검토한다.

### 언제 `catch`해야 하는가

현재 Layer가 다음 중 하나를 실제로 수행할 수 있을 때 잡는 것이 적절하다.

- 입력을 다시 받거나 대체 값을 사용해 복구한다.
- 더 의미 있는 상위 수준 Exception으로 변환한다.
- HTTP 응답, CLI Exit Code처럼 경계의 실패 형식으로 변환한다.
- Resource 정리나 제한된 재시도처럼 명확한 조치를 수행한다.

처리 방법이 없다면 빈 `catch`로 숨기지 말고 적절한 호출자까지 전파한다.

## try-with-resources

File, Stream, Socket과 Database Resource처럼 사용 후 닫아야 하는 객체에는 `AutoCloseable` 기반 try-with-resources를 사용한다.

```java
try (var reader = Files.newBufferedReader(path)) {
    return reader.readLine();
}
```

Resource는 Block이 정상 종료되거나 예외로 종료되어도 자동으로 닫힌다. 여러 Resource가 있으면 선언의 역순으로 닫힌다.

본문 실행과 Resource 종료에서 모두 예외가 발생하면 본문의 예외가 우선 전달되고, 종료 중 예외는 suppressed exception으로 보존된다. `Throwable.getSuppressed()`로 확인할 수 있다.

## `IllegalArgumentException`과 `IllegalStateException`

두 Type 모두 `RuntimeException`의 하위 Type이므로 Unchecked Exception이다.

| 판단 질문 | 선택 | Ticket 예시 |
|---|---|---|
| 호출자가 전달한 값 자체가 허용되지 않는가? | `IllegalArgumentException` | `new Ticket(null)`, `new Ticket("   ")` |
| 인수와 무관하게 객체의 현재 상태에서 행동할 수 없는가? | `IllegalStateException` | `OPEN`에서 `resolve()` |

### 잘못된 인수

```java
if (title == null || title.isBlank()) {
    throw new IllegalArgumentException(
            "title must not be blank");
}
```

현재 Ticket 계약에서는 `null`, 빈 문자열과 공백 문자열을 모두 허용되지 않는 제목으로 취급한다.

`null`이라고 항상 `IllegalArgumentException`만 사용해야 하는 것은 아니다. Java API에는 필수 인수가 `null`일 때 `NullPointerException`을 사용하는 계약도 있다. 중요한 것은 API가 선택한 Type과 조건을 일관되게 문서화하고 Test하는 것이다.

### 잘못된 현재 상태

```java
public void resolve() {
    if (status != TicketStatus.IN_PROGRESS) {
        throw new IllegalStateException(
                "only IN_PROGRESS ticket can be resolved");
    }

    status = TicketStatus.RESOLVED;
}
```

`resolve()`에는 잘못된 인수가 없다. 문제는 Ticket의 현재 상태가 `resolve()`를 수행할 수 있는 상태가 아니라는 점이다.

## 예외는 객체 상태를 자동 복구하지 않는다

다음과 같이 상태를 먼저 변경하면 이후 예외가 발생해도 대입 결과는 그대로 남는다.

```java
void unsafeResolve() {
    var previousStatus = status;
    status = TicketStatus.RESOLVED;

    if (previousStatus != TicketStatus.IN_PROGRESS) {
        throw new IllegalStateException(
                "only IN_PROGRESS ticket can be resolved");
    }
}
```

`OPEN`에서 호출하면 예외가 발생하지만 상태는 이미 `RESOLVED`가 되어 객체 규칙이 깨진다.

현재 Ticket은 검증을 통과한 뒤에만 상태를 변경한다.

```java
void safeResolve() {
    if (status != TicketStatus.IN_PROGRESS) {
        throw new IllegalStateException(
                "only IN_PROGRESS ticket can be resolved");
    }

    status = TicketStatus.RESOLVED;
}
```

안전한 상태 변경의 기본 순서는 다음과 같다.

1. 입력값과 현재 상태를 검사한다.
2. 실패하면 상태를 변경하기 전에 예외를 던진다.
3. 필요한 계산을 지역 변수에서 마친다.
4. 모든 조건을 통과한 뒤 객체 상태를 변경한다.

여러 객체, Database 또는 외부 API가 함께 변경되는 작업에서는 이 순서만으로 원자성을 보장할 수 없다. 그 경우 Transaction이나 보상 작업이 필요하지만, 예외 자체가 자동 Rollback을 제공한다고 가정해서는 안 된다.

## Message와 Cause

좋은 Exception Message는 실패한 규칙과 필요한 조건을 알려 준다.

```text
only IN_PROGRESS ticket can be resolved
```

다음 원칙을 적용한다.

- 실패한 규칙이나 필요한 상태를 포함한다.
- 모호한 `invalid`나 `error`만 사용하지 않는다.
- Password, Token, 개인정보와 내부 Credential을 포함하지 않는다.
- Message가 외부 계약이 아니라면 문구 전체를 불필요하게 고정하지 않는다.

낮은 수준의 예외를 더 의미 있는 Type으로 변환할 때는 원래 Cause를 보존한다.

```java
try {
    importFile();
} catch (IOException exception) {
    throw new TicketImportException(
            "ticket import failed",
            exception);
}
```

Cause를 함께 전달하면 `getCause()`와 Stack Trace에서 원래 실패 경로를 확인할 수 있다.

## Custom Exception을 만드는 기준

기본 Exception Type만으로도 호출자가 실패 의미를 충분히 구분할 수 있다면 새 Type을 만들 필요가 없다. 현재 Ticket의 제목 검증과 상태 전이는 `IllegalArgumentException`과 `IllegalStateException`으로 의도가 드러난다.

다음 조건에서는 Custom Exception을 검토할 수 있다.

- 호출자가 특정 Domain 실패를 별도로 처리해야 한다.
- 여러 하위 기술 예외를 하나의 Application 계약으로 변환해야 한다.
- 기본 Type으로는 실패 의미와 처리 경계를 구분하기 어렵다.

Custom Exception을 만들 때도 Checked와 Unchecked 중 무엇이 호출자 계약에 적합한지 별도로 결정해야 한다.

## 자주 발생하는 잘못된 처리

| 잘못된 처리 | 문제 |
|---|---|
| 빈 `catch` | 실패가 사라져 원인과 잘못된 결과를 찾기 어렵다. |
| 모든 곳에서 `catch (Exception)` | 처리할 수 없는 실패까지 한 방식으로 숨길 수 있다. |
| 잡은 뒤 같은 정보 없이 다시 던짐 | 불필요한 Code만 늘고 Cause를 잃을 수 있다. |
| 모든 Layer에서 Log 후 재전파 | 같은 실패가 중복 기록되어 관찰이 어려워진다. |
| 정상 분기와 반복 종료에 Exception 사용 | 일반 제어 흐름이 읽기 어렵고 실패 의미가 흐려진다. |
| 상태 변경 후 검증 | 예외가 발생해도 객체가 잘못된 상태로 남을 수 있다. |
| `Error`까지 광범위하게 잡고 계속 실행 | 복구하기 어려운 JVM 문제를 숨길 수 있다. |

## Exception Test에서 확인할 것

거부 Case는 예외 발생만 확인하면 충분하지 않을 수 있다.

```java
assertThrows(IllegalStateException.class, ticket::resolve);
assertEquals(TicketStatus.OPEN, ticket.status());
```

- 첫 Assertion: 잘못된 행동이 정해진 Exception Type으로 거부됐는가?
- 두 번째 Assertion: 실패 후에도 Ticket 상태가 보존됐는가?

Exception Message는 다른 Component가 의존하는 계약일 때 검증한다. 내부 진단 문구라면 Type과 상태 규칙을 우선 검증한다.

## 설명 가능성 점검 질문

1. `Throwable`, `Error`, `Exception`과 `RuntimeException`은 어떤 관계인가?
2. Checked Exception과 Unchecked Exception은 호출자의 Compile 과정에 어떤 차이를 만드는가?
3. `throw`와 `throws`는 각각 어떤 역할을 하는가?
4. `catch`하지 않은 Exception은 어떤 경로로 전파되는가?
5. `new Ticket(null)`과 `OPEN`에서 `resolve()`가 서로 다른 Exception Type을 사용하는 이유는 무엇인가?
6. 예외가 발생했다고 객체 상태가 자동으로 복구되지 않는 이유는 무엇인가?
7. `catch`하는 편보다 호출자에게 전파하는 편이 나은 경우는 언제인가?
8. try-with-resources가 `finally`에서 직접 Resource를 닫는 방식보다 안전한 이유는 무엇인가?
9. Exception을 변환할 때 원래 Cause를 보존해야 하는 이유는 무엇인가?
10. 현재 Ticket에 Custom Exception이 반드시 필요하지 않은 이유는 무엇인가?

## 참고 자료

- [Java Language Specification 25 — Chapter 11. Exceptions](https://docs.oracle.com/javase/specs/jls/se25/html/jls-11.html)
- [Java SE 25 API — Throwable](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Throwable.html)
- [Java SE 25 API — RuntimeException](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/RuntimeException.html)
- [Java SE 25 API — IllegalArgumentException](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/IllegalArgumentException.html)
- [Java SE 25 API — IllegalStateException](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/IllegalStateException.html)
- [Dev.java — Catching and Handling Exceptions](https://dev.java/learn/exceptions/catching-handling/)
