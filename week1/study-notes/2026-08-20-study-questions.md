# Java Exception·Collection과 JUnit 자동 검증 학습 점검

> 작성일: 2026-08-20
> 목적: Java Exception 처리와 Collection의 선택·가변성·캡슐화를 설명하고, Ticket 규칙을 JUnit으로 자동 검증한 근거를 기록
> 상태: Completed — 오전·오후 학습, 야간 Self Review와 최종 Test 재현 완료

---

## Exception 학습

1. new Ticket(null)은 왜 IllegalArgumentException인가?
-> `IllegalArgumentException`은 전달받은 인수가 잘못된 것을 의미하며, 예시로는 `new Ticket(null)`과 `new Ticket("   ")`가 있다.
null은 Ticket 생성자가 허용하지 않는 title 인수다. 객체의 현재 상태가 아니라 전달된 인수가 생성 규칙을 위반했으므로 IllegalArgumentException이 발생한다.

2. OPEN에서 resolve()를 호출하면 왜 IllegalStateException인가?
-> `IllegalStateException`은 객체의 현재 상태에서는 행동을 수행할 수 없다는 것을 의미하며, 예시로는 `OPEN`에서 `resolve()`를 실행하거나 `RESOLVED`에서 `startProgress()`를 실행하는 것이 있다.
resolve()에는 잘못된 인수가 없다. Ticket의 현재 상태가 OPEN이고, 이 행동은 IN_PROGRESS에서만 허용되므로 IllegalStateException이 발생한다.

3. Checked Exception과 Unchecked Exception은 호출자에게 어떤 차이를 만드는가?
-> Checked Exception과 Unchecked Exception의 핵심 차이는 Compiler가 호출자에게 예외의 처리 또는 선언을 강제하는지 여부다.
Checked Exception이 발생할 수 있으면 호출자는 try-catch로 처리하거나 자신의 throws 절에 선언하여 상위 호출자에게 전달해야 한다. 그렇지 않으면 Compile Error가 발생한다. IOException과 SQLException이 대표적인 예다.
Unchecked Exception은 RuntimeException 계열이며 Compiler가 catch 또는 throws 작성을 강제하지 않는다. 따라서 처리하지 않아도 Compile은 가능하지만, 예외가 발생하면 적절한 Handler를 찾을 때까지 전파된다. NullPointerException, IllegalArgumentException과 IllegalStateException이 대표적인 예다. 형식적으로 Error 계열도 Unchecked에 포함된다.

---

## Exception 추가 학습 질문

1. `Throwable`, `Error`, `Exception`과 `RuntimeException`은 어떤 관계인가?
-> `Throwable`은 Java 예외 처리의 최상위 클래스이며, 나머지는 이를 상속받는 하위 클래스들이다. 이들의 관계는 구조적인 상속 관계(Is-A)로 묶여 있다.

`Error`와 `Exception`은 `Throwable`을 직접 상속하며 서로 형제 관계다. `RuntimeException`은 `Exception`을 상속한다.

```text
Throwable
├─ Error
└─ Exception
   └─ RuntimeException
```

2. Checked Exception과 Unchecked Exception은 호출자의 Compile 과정에 어떤 차이를 만드는가?
-> Checked Exception과 Unchecked Exception은 컴파일러가 호출자(Caller)에게 "예외 처리 코드를 강제하느냐"에서 결정적인 차이를 만든다.

- Checked Exception: 컴파일러가 처리 또는 선언을 강제함 / `try-catch` 처리 또는 `throws` 선언 필요 / 누락 시 Compile Error 발생
- Unchecked Exception: 컴파일러가 처리 또는 선언을 강제하지 않음 / 예외 처리 생략 가능 / 처리하지 않아도 Compile 가능하지만 실행 중 예외가 발생할 수 있음

3. `throw`와 `throws`는 각각 어떤 역할을 하는가?
-> `throw`는 특정 예외 객체를 실제로 발생시키는 문장이다. `throws`는 메서드가 처리하지 않고 호출자에게 전파할 수 있는 예외 타입을 메서드 선언부에 표시한다.

- `throw`: 기존 또는 새로 생성한 예외 객체를 실제로 던질 때 사용
- `throws`: 메서드가 호출자에게 전파할 수 있는 예외 타입을 선언할 때 사용

4. `catch`하지 않은 Exception은 어떤 경로로 전파되는가?
-> 처리되지 않은 Exception은 호출 Stack을 역순으로 올라가면서 해당 예외를 처리할 수 있는 catch를 찾는다. Thread의 최상위까지 처리되지 않으면 Uncaught Exception Handler에 전달되고 해당 Thread가 종료된다. 종료되지 않은 다른 Non-daemon Thread가 없다면 Application도 종료된다.

5. `new Ticket(null)`과 `OPEN`에서 `resolve()`가 서로 다른 Exception Type을 사용하는 이유는 무엇인가?
-> new Ticket(null)은 생성자에 허용되지 않는 인수를 전달했으므로 IllegalArgumentException이 발생한다. 반면 OPEN Ticket에서 resolve()를 호출한 것은 인수 문제가 아니라 객체의 현재 상태에서 허용되지 않는 행동이므로 IllegalStateException이 발생한다.

6. 예외가 발생했다고 객체 상태가 자동으로 복구되지 않는 이유는 무엇인가?
-> Java에서 예외가 발생하더라도 객체의 상태가 자동으로 복구되지 않는 이유는 JVM이 메모리(Heap)에 기록된 값을 이전 상태로 되돌리는 롤백(Rollback) 기능을 기본적으로 제공하지 않기 때문이다.

예외 처리(`try-catch`)는 프로그램의 실행 흐름(Flow Control)을 제어할 뿐, 이미 변경된 메모리의 데이터(Data State)까지 역산하여 되돌려주지는 않는다.

7. `catch`하는 편보다 호출자에게 전파하는 편이 나은 경우는 언제인가?
-> 기본 원칙은 "해당 예외를 가장 잘 처리하거나 복구할 수 있는 적절한 위치(Layer)까지 예외를 올리는 것"이다.

- 현재 메서드에서 예외를 해결하거나 복구할 방법이 없을 때
- 예외가 발생했음을 호출자가 반드시 알아야 할 때
- 호출자에게 다른 대안(Fallback)을 선택할 기회를 주어야 할 때
- Transaction 경계 또는 상위 Layer가 실패를 인지하고 Rollback 여부를 결정해야 할 때
- 예외를 한곳에서 일괄 처리(Global Exception Handling)하고 싶을 때

8. try-with-resources가 `finally`에서 직접 Resource를 닫는 방식보다 안전한 이유는 무엇인가?
-> try-with-resources는 AutoCloseable을 구현한 Resource에 대해 정상 종료와 예외 발생 여부에 관계없이 close() 호출을 자동으로 시도한다. 또한 본문과 close()에서 모두 예외가 발생하면 본문의 예외를 주 예외로 유지하고, close()의 예외는 Suppressed Exception으로 보존한다. 따라서 finally에서 직접 자원을 닫는 방식보다 Resource 누수와 원래 예외가 가려질 위험을 줄인다.

9. Exception을 변환할 때 원래 Cause를 보존해야 하는 이유는 무엇인가?
-> 원래 예외가 발생한 원인과 위치(Root Cause), Stack Trace를 보존하여 정확한 디버깅을 가능하게 하기 위함이다.

10. 현재 Ticket에 Custom Exception이 반드시 필요하지 않은 이유는 무엇인가?
-> Java가 이미 제공하는 표준 예외(Standard Exception)만으로도 상황을 명확하고 충분히 설명할 수 있기 때문에 Custom Exception이 반드시 필요하지는 않는다.

---

## Java Collections 학습

1. Ticket의 상태 변경 이력을 저장한다면 List, Set, Map 중 무엇이 적합한가?
-> List가 가장 적합하다. 상태 변경 이력은 상태가 발생한 순서를 보존해야 하며, 같은 상태 값이 서로 다른 시점의 기록으로 나타나는 경우도 표현할 수 있어야 한다. Set은 중복을 허용하지 않으며 일반적인 Set 계약만으로는 순서를 기대할 수 없다. Map은 Key를 통한 조회가 필요할 때 적합하므로 단순한 시간순 이력에는 List가 더 자연스럽다.
현재 Ticket 규칙에서는 상태가 반복되지 않더라도, 이력의 핵심 요구사항인 발생 순서를 표현하기 위해 List를 선택한다. 실제 구현에서는 상태만 저장하기보다 다음과 같은 변경 이력 객체를 저장하는 방법도 고려할 수 있다.

```java
List<TicketStatusChange>
```

2. 객체의 내부 ArrayList를 그대로 반환하면 외부에서 어떤 일이 가능한가?
-> 외부에 내부 ArrayList와 같은 객체를 가리키는 참조가 반환된다. 따라서 외부에서 객체가 제공하는 상태 변경 메서드를 거치지 않고 add(), remove(), clear() 등을 호출하여 내부 데이터를 직접 변경할 수 있다. 그 결과 객체가 보호해야 하는 불변조건과 도메인 규칙이 우회될 수 있다.
Java는 기본형과 참조형 모두 값을 전달한다. 다만 참조형에서는 객체 자체가 아니라 객체를 가리키는 참조값이 전달되므로, 객체 안과 외부의 변수가 같은 ArrayList 객체를 가리킬 수 있다.

3. 필드가 private이어도 내부 List를 반환하면 캡슐화가 깨지는 이유는 무엇인가?
-> private은 외부에서 필드 이름으로 직접 접근하는 것을 막지만, 메서드를 통해 가변 객체의 참조가 외부로 노출되는 것까지 자동으로 막지는 않는다. 내부 List의 참조를 그대로 반환하면 외부도 같은 List 객체를 변경할 수 있게 된다. 그 결과 객체가 자신의 상태 변경을 통제하지 못하므로 캡슐화가 깨진다.

4. List.copyOf()는 이 문제를 어떻게 줄이는가?
-> List.copyOf()는 호출 시점의 요소를 포함하는 수정 불가능한 List를 반환한다. 외부에서 반환된 List에 add(), remove(), clear() 등을 호출하면 UnsupportedOperationException이 발생한다. 또한 원본 List에 나중에 요소를 추가하거나 제거해도 이전에 반환된 List에는 반영되지 않으므로 내부 Collection의 구조가 외부에 직접 노출되는 문제를 줄일 수 있다.

다만 다음 사항은 주의해야 한다.
- 항상 서로 다른 새 객체를 만든다고 보장되지는 않는다.
- 요소 자체를 복제하는 것이 아니라 요소의 참조를 복사하는 얕은 복사다.
- 요소가 가변 객체라면 요소의 내부 상태는 여전히 변경될 수 있다.
- 따라서 반환된 List는 수정 불가능하지만 반드시 깊은 의미의 불변 객체인 것은 아니다.

---

## JUnit 자동 검증 실행 기록

### 실행 구성

- Java: JDK 25
- Test Framework: JUnit 6.1.3
- Test 실행: Maven Surefire Plugin 3.5.5
- Build 실행: Maven Wrapper로 고정한 Maven 3.9.16

### 검증 범위

| 분류 | 검증 내용 | Test 수 |
|---|---|---:|
| 정상 | 새 Ticket의 `OPEN` 초기 상태, `IN_PROGRESS` 전이, `RESOLVED` 전이 | 3 |
| 경계 | `null`, 빈 문자열과 공백 문자열 제목 거부 | 3 |
| 거부 | 잘못된 상태 전이의 Exception Type과 실패 후 상태 보존 | 4 |
| Message | 서로 다른 대표 Exception Message | 3개 Assertion |

대표 Message는 다음 세 종류를 한 번씩 검증했다.

- `title must not be blank`
- `only OPEN ticket can start progress`
- `only IN_PROGRESS ticket can be resolved`

### 실행 결과

```powershell
.\mvnw.cmd clean test
```

```text
Tests run: 10, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

이 결과는 현재 단일 Ticket Domain에 작성한 10개 Test Case가 JDK 25에서 Compile되고 JUnit Platform을 통해 실행됐다는 뜻이다. 동시성, Database, 사용자 권한과 아직 구현하지 않은 기능까지 검증했다는 뜻은 아니다.

### 실행 중 오류와 수정

Exception Message를 검증하면서 `exception cannot be resolved` 오류가 발생했다. `assertThrows()`의 반환값을 변수에 저장하지 않은 상태에서 `exception.getMessage()`를 호출한 것이 원인이었다.

다음처럼 `assertThrows()`가 반환한 예외 객체를 지역 변수에 저장한 뒤 Message를 확인해 해결했다.

```java
var exception = assertThrows(
        IllegalStateException.class,
        ticket::resolve);

assertEquals(
        "only IN_PROGRESS ticket can be resolved",
        exception.getMessage());
```

이를 통해 `exception`은 자동으로 제공되는 이름이 아니라 직접 선언해야 하는 지역 변수이며, `assertThrows()`는 발생한 예외 객체를 반환한다는 점을 확인했다.

### Git 근거

- `cdcbee0` — `test: add Ticket unit test baseline`
- `944aede` — `test: verify Ticket exception messages`

### AI 활용과 직접 수행 범위

- AI가 보조한 부분: Test Case 순서, Given–When–Then 구성, 대표 Exception Message 선정과 Code Review
- 직접 수행한 부분: `pom.xml` 구성, Ticket Test 10개 작성, Maven 실행, 오류 원인 확인과 수정, Test 재실행 및 두 단계 Commit

---

## 복습

### 1. 테스트 케이스 검증 목적 설명

- 정상 동작
  - `new_ticket_starts_open`: 새로 생성된 Ticket의 초기 상태가 `OPEN`인지 검증한다.
  - `open_ticket_can_start_progress`: `OPEN` 상태에서 `startProgress()`를 호출하면 상태가 `IN_PROGRESS`로 변경되는지 검증한다.
  - `in_progress_ticket_can_be_resolved`: `IN_PROGRESS` 상태에서 `resolve()`를 호출하면 상태가 `RESOLVED`로 변경되는지 검증한다.

- 제목 경계값
  - `null_title_is_rejected`: 제목이 `null`이면 `IllegalArgumentException`이 발생하여 Ticket 생성이 거부되는지 검증한다.
  - `empty_title_is_rejected`: 제목이 빈 문자열이면 `IllegalArgumentException`이 발생하여 Ticket 생성이 거부되는지 검증한다.
  - `blank_title_is_rejected`: 제목이 공백 문자로만 구성되면 `IllegalArgumentException`이 발생하여 Ticket 생성이 거부되는지 검증한다.

- 잘못된 상태 전이
  - `open_ticket_cannot_be_resolved`: `OPEN` 상태에서 `resolve()`를 호출하면 `IllegalStateException`이 발생하고 상태가 `OPEN`으로 유지되는지 검증한다.
  - `in_progress_ticket_cannot_start_progress_again`: `IN_PROGRESS` 상태에서 `startProgress()`를 다시 호출하면 `IllegalStateException`이 발생하고 상태가 `IN_PROGRESS`로 유지되는지 검증한다.
  - `resolved_ticket_cannot_start_progress`: `RESOLVED` 상태에서 `startProgress()`를 호출하면 `IllegalStateException`이 발생하고 상태가 `RESOLVED`로 유지되는지 검증한다.
  - `resolved_ticket_cannot_be_resolved_again`: `RESOLVED` 상태에서 `resolve()`를 다시 호출하면 `IllegalStateException`이 발생하고 상태가 `RESOLVED`로 유지되는지 검증한다.


### 2. 예외 메시지 검토
다음 세 메시지가 각각 어떤 규칙을 설명하는지 확인합니다.
- `title must not be blank`
- `only OPEN ticket can start progress`
- `only IN_PROGRESS ticket can be resolved`

검토할 내용은 다음과 같습니다.
- 어떤 입력 또는 상태가 잘못되었는가?
- 호출자가 다음에 무엇을 해야 하는지 이해할 수 있는가?
- 실제 Ticket 규칙과 메시지가 일치하는가?
- 서로 다른 규칙인데 같은 모호한 메시지를 사용하지 않았는가?

모든 거부 테스트에서 메시지를 중복 검증할 필요는 없습니다. 현재처럼 서로 다른 규칙을 대표하는 메시지 3개를 검증하면 충분합니다.

`title must not be blank`에 대한 검토 답변:
- 잘못된 것: 제목이 `null`, 빈 문자열 또는 공백뿐인 문자열이다.
- 호출자가 해야 할 일: 내용이 있는 제목을 전달해야 한다.
- 실제 규칙과 일치하는가: 일치한다. Ticket은 유효한 제목으로만 생성되어야 한다.
- 더 명확하게 쓴다면: `title must not be null or blank`도 가능하다.
즉, "제목이 잘못됐다"에서 끝나지 않고 어떤 제목을 전달해야 하는지 알려준다.

`only OPEN ticket can start progress`에 대한 검토 답변:
- 잘못된 것: `IN_PROGRESS` 또는 `RESOLVED` 상태에서 `startProgress()`를 호출했다.
- 호출자가 해야 할 일: Ticket이 `OPEN` 상태일 때만 `startProgress()`를 호출해야 한다.
- 실제 규칙과 일치하는가: 일치한다.
- 모호한가: 필요한 현재 상태를 `OPEN`으로 명시하므로 명확하다.

`only IN_PROGRESS ticket can be resolved`에 대한 검토 답변:
- 잘못된 것: `OPEN` 또는 `RESOLVED` 상태에서 `resolve()`를 호출했다.
- 호출자가 해야 할 일: Ticket이 `IN_PROGRESS` 상태일 때만 `resolve()`를 호출해야 한다. `OPEN` 상태라면 먼저 `startProgress()`를 호출하고, 이미 `RESOLVED`라면 다시 해결하지 않아야 한다.
- 실제 규칙과 일치하는가: 일치한다.
- 모호한가: 해결이 허용되는 현재 상태를 `IN_PROGRESS`로 명시하므로 명확하다.

---

### 3. 상태 보존 검증 설명
다음 테스트를 다시 봅니다.
- `open_ticket_cannot_be_resolved`
- `in_progress_ticket_cannot_start_progress_again`
- `resolved_ticket_cannot_start_progress`
- `resolved_ticket_cannot_be_resolved_again`

각 테스트에서 다음 두 가지를 따로 검증하는 이유를 자신의 말로 설명해보세요.
핵심은 “예외가 발생했다”와 “객체가 안전한 상태를 유지했다”는 서로 다른 검증이라는 점입니다.

1. `assertThrows()`로 올바른 예외가 발생했는지 확인
-> 잘못된 상태에서 메서드를 호출했을 때 요청이 예상한 예외 타입으로 거부되는지 검증한다. 그러나 이것만으로는 예외가 발생하기 전에 객체 상태가 변경되지 않았다는 사실까지 알 수 없다.

2. `assertEquals()`로 실패 후 기존 상태가 유지되었는지 확인
-> 잘못된 요청이 거부된 뒤에도 Ticket이 호출 전 상태를 그대로 유지하여 객체의 상태 전이 규칙과 불변조건이 보호됐는지 검증한다.

**결론:** `assertThrows()`는 잘못된 행동이 거부됐는지를 검증하고, `assertEquals()`는 그 거부 과정에서 객체 상태가 훼손되지 않았는지를 검증한다.
