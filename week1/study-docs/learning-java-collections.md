# Learning Note — Java Collection과 안전한 상태 노출

> 작성일: 2026-08-20
> 주차: Week 1
> 기준: Java SE 25

## 핵심 질문

> 여러 값을 목적에 맞는 자료구조로 관리하면서도 외부가 객체의 내부 상태를 임의로 변경하지 못하게 하려면 무엇을 구분해야 하는가?

## 한 문장 설명

Java Collections Framework는 여러 객체를 저장·조회·순회하는 공통 Interface와 구현체를 제공하며, 객체는 자료구조의 의미와 변경 권한을 선택하고 필요한 경우 복사본이나 읽기 전용 View로 내부 상태를 보호해야 한다.

## 용어 구분

세 표현은 이름이 비슷하지만 의미가 다르다.

| 표현 | 의미 | 예시 |
|---|---|---|
| Collections Framework | 여러 값을 다루는 Interface, 구현체와 Algorithm의 전체 체계 | `List`, `Set`, `Map`, `ArrayList`, `HashMap` |
| `Collection<E>` | 여러 Element를 하나의 그룹으로 다루는 최상위 핵심 Interface | `List<E>`, `Set<E>`, `Queue<E>`의 상위 Interface |
| `Collections` | Collection을 처리하거나 감싸는 `static` Utility Method 모음 | `sort()`, `unmodifiableList()` |

`Collection`은 Interface이고 `Collections`는 Class다. 이름 끝의 `s` 유무만으로 구분하지 말고 역할을 함께 이해해야 한다.

## 주요 Interface의 관계

다음은 학습에 필요한 역할만 단순화한 구조다. Java 25에는 순서가 정의된 Collection을 위한 `SequencedCollection` 계열도 존재하므로 실제 상속 관계 전체를 나타낸 그림은 아니다.

```text
Iterable<E>
└── Collection<E>
    ├── List<E>
    ├── Set<E>
    └── Queue<E>
        └── Deque<E>

Map<K, V>  ← Collection<E>과 별도의 계층
```

`Map`은 Element 한 종류의 모음이 아니라 Key와 Value의 대응 관계를 표현한다. 따라서 Collections Framework의 일부이지만 `Collection<E>`을 상속하지 않는다.

## `List`, `Set`, `Queue`, `Deque`와 `Map`

| Interface | 핵심 의미 | 중복 | 순서·접근 | Helpdesk 예시 |
|---|---|---|---|---|
| `List<E>` | 순서대로 값을 보관 | 일반적으로 허용 | 위치 Index와 순서 사용 | Ticket 상태 변경 이력 |
| `Set<E>` | 같은 값을 한 번만 보관 | 허용하지 않음 | 구현체에 따라 순서가 다름 | Ticket Tag 또는 권한 집합 |
| `Queue<E>` | 처리 전 값을 대기열로 관리 | 허용 가능 | 구현체가 정한 Head부터 처리 | 처리 대기 Ticket |
| `Deque<E>` | 양쪽 끝에서 삽입·삭제 | 허용 가능 | 앞과 뒤를 모두 사용 | Queue 또는 Stack 동작 |
| `Map<K,V>` | 고유한 Key로 Value 조회 | Key 중복 불가 | 구현체에 따라 순서가 다름 | Ticket ID로 Ticket 조회 |

### `List`

순서가 중요하고 같은 값이 여러 번 나타날 수 있을 때 사용한다.

```java
List<TicketStatus> history = new ArrayList<>();
history.add(TicketStatus.OPEN);
history.add(TicketStatus.IN_PROGRESS);
history.add(TicketStatus.RESOLVED);
```

Ticket 상태 이력은 발생 순서를 보존해야 하므로 `List`가 자연스럽다. 같은 상태가 정책상 다시 나타날 수 있는지는 별도의 Domain 규칙으로 결정한다.

### `Set`

중복을 허용하지 않는 집합을 표현한다. 두 Element가 같은지는 일반적으로 `equals()`와 `hashCode()` 계약의 영향을 받는다.

```java
Set<String> tags = new HashSet<>();
tags.add("LOGIN");
tags.add("LOGIN");
```

두 번째 `add()`는 같은 값을 다시 저장하지 않으며 `false`를 반환한다.

### `Queue`와 `Deque`

`Queue`는 처리할 값을 Head에서 꺼내는 대기열을 표현한다. 일반적인 FIFO가 많지만 모든 Queue가 FIFO인 것은 아니며 `PriorityQueue`처럼 다른 순서 정책을 사용할 수도 있다.

`Deque`는 앞과 뒤 양쪽에서 값을 추가하고 제거한다. FIFO Queue와 LIFO Stack을 모두 표현할 수 있다. Stack 동작이 필요하면 오래된 `Stack` Class보다 `Deque`와 `ArrayDeque`를 우선 검토한다.

### `Map`

Key 하나를 Value 하나에 대응시킨다. 같은 Key를 다시 `put()`하면 일반적으로 기존 Value가 교체된다.

```java
Map<Long, String> ticketTitles = new HashMap<>();
ticketTitles.put(1L, "로그인 오류");
ticketTitles.put(1L, "로그인 화면 오류");
```

Key 중복을 허용하지 않는다는 말은 두 Entry가 같은 Key로 동시에 유지되지 않는다는 의미다. Value는 중복될 수 있다.

## Interface Type과 구현체

변수와 Method 계약은 필요한 기능을 나타내는 Interface Type으로 선언하고, 생성 시 구체 구현체를 선택하는 방식이 일반적이다.

```java
List<TicketStatus> history = new ArrayList<>();
Set<String> tags = new HashSet<>();
Map<Long, TicketStatus> statusByTicketId = new HashMap<>();
Deque<Long> waitingTicketIds = new ArrayDeque<>();
```

이렇게 작성하면 호출자는 `ArrayList` 내부 구현보다 `List`가 약속한 동작에 의존한다. 구현체를 바꿔도 Interface 계약을 사용하는 Code의 변경 범위를 줄일 수 있다.

### 기본 구현체 선택

| 필요한 동작 | 먼저 검토할 구현체 | 주의점 |
|---|---|---|
| 일반적인 순서형 List | `ArrayList` | 중간 삽입·삭제가 매우 빈번한 요구인지 별도 확인 |
| 중복 없는 집합 | `HashSet` | 반복 순서를 보장한다고 가정하지 않음 |
| 삽입 순서를 유지하는 Set | `LinkedHashSet` | 순서가 실제 계약일 때 선택 |
| 정렬된 Set | `TreeSet` | 자연 순서 또는 `Comparator` 필요 |
| 양방향 Queue·Stack | `ArrayDeque` | 일반적으로 `null`을 Element로 사용하지 않음 |
| Key 기반 조회 | `HashMap` | 반복 순서를 보장한다고 가정하지 않음 |
| 삽입 순서를 유지하는 Map | `LinkedHashMap` | 순서 유지 비용과 필요를 함께 판단 |
| Key 정렬이 필요한 Map | `TreeMap` | 자연 순서 또는 `Comparator` 필요 |

구현체 이름만 외우기보다 중복, 순서, 조회 방식과 변경 패턴을 먼저 정한 뒤 선택한다.

## Generic과 Type 안전성

Generic은 Collection에 저장할 Element Type을 Compile 시점에 제한한다.

```java
List<TicketStatus> history = new ArrayList<>();
history.add(TicketStatus.OPEN);
```

다음과 같이 다른 Type을 넣으려 하면 Compile Error가 발생한다.

```java
history.add("OPEN");
```

Generic을 사용하지 않은 Raw Type은 잘못된 Type이 들어가는 시점을 늦추고 Runtime의 `ClassCastException` 위험을 높인다.

```java
List history = new ArrayList(); // Raw Type 사용을 피한다.
```

## `private final`과 Collection의 가변성

다음 선언에서 `final`은 `history`가 다른 List 객체를 다시 가리키지 못하게 할 뿐, List 내부 Element의 추가와 제거까지 막지 않는다.

```java
private final List<TicketStatus> history = new ArrayList<>();
```

다음 동작은 여전히 가능하다.

```java
history.add(TicketStatus.OPEN);
history.clear();
```

따라서 `private final`은 참조 재할당을 막지만 Collection 자체를 불변으로 만들지 않는다.

## 내부 Collection을 그대로 반환하는 문제

```java
final class UnsafeTicketHistory {

    private final List<TicketStatus> history = new ArrayList<>();

    List<TicketStatus> history() {
        return history;
    }
}
```

Field가 `private`이어도 반환된 List는 내부 Field와 같은 객체다. 호출자는 다음처럼 객체가 제공한 행동을 거치지 않고 내부 상태를 변경할 수 있다.

```java
var exposed = ticketHistory.history();
exposed.add(TicketStatus.RESOLVED);
exposed.clear();
```

이를 Representation Exposure 또는 내부 표현 노출이라고 한다. `private` 접근 제한만으로는 가변 객체의 참조가 외부로 새는 문제를 막을 수 없다.

## 방어적 복사

내부 List의 현재 상태만 외부에 제공하고 이후 변경을 분리하려면 복사본을 반환할 수 있다.

```java
final class SafeTicketHistory {

    private final List<TicketStatus> history = new ArrayList<>();

    List<TicketStatus> history() {
        return List.copyOf(history);
    }
}
```

`List.copyOf(history)`는 호출 시점의 Element를 가진 수정 불가능한 List를 반환한다. 원본 List에 이후 Element를 추가하거나 제거해도 반환된 List에는 반영되지 않는다.

복사본을 반환하면 외부 변경으로부터 내부 구조를 보호할 수 있지만, 호출할 때마다 복사 비용이 생길 수 있다. 먼저 객체 계약과 안전성을 정하고 실제 측정 근거가 있을 때 성능 대안을 검토한다.

## `List.of()`, `List.copyOf()`와 `Collections.unmodifiableList()`

| 방식 | 생성 목적 | 원본의 이후 구조 변경 반영 | 반환 List 직접 변경 | `null` Element |
|---|---|---|---|---|
| `List.of(a, b)` | 전달한 Element로 수정 불가능한 List 생성 | 별도 원본 List가 없음 | `UnsupportedOperationException` | 허용하지 않음 |
| `List.copyOf(source)` | Source의 수정 불가능한 Snapshot 생성 | 반영되지 않음 | `UnsupportedOperationException` | 허용하지 않음 |
| `Collections.unmodifiableList(source)` | Source를 읽기 전용 View로 노출 | 반영됨 | `UnsupportedOperationException` | Source 정책을 따름 |
| `new ArrayList<>(source)` | 독립적으로 변경 가능한 복사본 생성 | 반영되지 않음 | 변경 가능 | 구현체 정책을 따름 |

### 수정 불가능한 Snapshot

```java
var source = new ArrayList<String>();
source.add("OPEN");

var snapshot = List.copyOf(source);
source.add("IN_PROGRESS");
```

`snapshot`에는 `OPEN`만 남는다. Source가 이미 수정 불가능한 List라면 `List.copyOf()`가 같은 객체를 재사용할 수도 있으므로 반환 객체의 Identity에 의존해서는 안 된다.

### 수정 불가능한 View

```java
var source = new ArrayList<String>();
var view = Collections.unmodifiableList(source);

source.add("OPEN");
```

`view`를 통해 `add()`할 수는 없지만 `source` 변경은 `view`에서 보인다. View가 읽기 전용이라는 말은 Backing List가 변하지 않는다는 뜻이 아니다.

Snapshot과 View 중 무엇이 맞는지는 호출자가 과거 시점의 독립된 결과를 받아야 하는지, 객체의 현재 상태를 계속 관찰해야 하는지에 따라 결정한다.

## 수정 불가능과 불변의 차이

수정 불가능한 List는 `add()`, `remove()`와 `set()` 같은 구조 변경을 허용하지 않는다. 하지만 내부 Element가 가변 객체라면 그 객체의 상태는 여전히 바뀔 수 있다.

```java
var mutableTitle = new StringBuilder("로그인 오류");
var titles = List.of(mutableTitle);

mutableTitle.append(" 수정");
```

List 구조는 그대로지만 Element의 상태가 바뀌었으므로 관찰 결과도 달라진다. `List.copyOf()`는 기본적으로 Element 참조를 복사하는 얕은 복사이며 Element 자체를 복제하지 않는다.

현재 예제의 `TicketStatus`는 `enum`이므로 Element 자체의 변경 문제는 없다.

## `UnsupportedOperationException`

Collection Interface의 일부 변경 Method는 Optional Operation이다. 구현체가 해당 변경을 지원하지 않으면 `UnsupportedOperationException`을 던질 수 있다.

```java
var states = List.of(TicketStatus.OPEN);
states.add(TicketStatus.RESOLVED);
```

`List.of()`로 만든 List는 수정 불가능하므로 `add()`에서 `UnsupportedOperationException`이 발생한다.

변수 Type이 `List`라고 해서 모든 구현체가 모든 변경 Method를 지원한다고 가정하면 안 된다. Method가 받거나 반환하는 Collection이 변경 가능한지 계약을 확인해야 한다.

## `equals()`와 `hashCode()`가 중요한 이유

`Set`은 중복 판단에, `Map`은 Key를 찾는 과정에 `equals()`와 `hashCode()` 계약을 사용한다. Hash 기반 Collection의 Element나 Key가 저장된 뒤 동일성 판단에 사용되는 값이 변경되면 조회와 제거가 예상대로 동작하지 않을 수 있다.

```java
Map<TicketKey, String> titles = new HashMap<>();
```

`TicketKey`가 가변 객체라면 Map에 넣은 뒤 Key의 `equals()`·`hashCode()` 결과에 영향을 주는 값을 바꾸지 않는 것이 안전하다. 식별 Key에는 불변 값 객체를 우선 검토한다.

## Ticket 상태 이력 JShell 예제

다음 실험은 Collection의 참조 공유와 방어적 복사를 확인하기 위한 예제다. 현재 Ticket Source에 상태 이력을 추가했다는 의미는 아니다.

```java
import java.util.*;

enum TicketStatus {
    OPEN, IN_PROGRESS, RESOLVED
}

var internalHistory = new ArrayList<TicketStatus>();
internalHistory.add(TicketStatus.OPEN);

var leakedHistory = internalHistory;
leakedHistory.add(TicketStatus.RESOLVED);

internalHistory
```

`leakedHistory`와 `internalHistory`가 같은 객체를 가리키므로 `internalHistory`에서도 `RESOLVED`가 관찰된다.

```java
var snapshot = List.copyOf(internalHistory);
internalHistory.add(TicketStatus.IN_PROGRESS);

internalHistory
snapshot
```

원본에는 `IN_PROGRESS`가 추가되지만 이전에 만든 `snapshot`은 바뀌지 않는다.

```java
snapshot.add(TicketStatus.OPEN);
```

수정 불가능한 List를 변경하려 했으므로 `UnsupportedOperationException`이 발생한다.

```java
var view = Collections.unmodifiableList(internalHistory);
internalHistory.add(TicketStatus.OPEN);

view
```

`view` 자체로 변경하지 않았지만 Backing List의 변경이 반영된다.

## 선택 기준

자료구조를 선택할 때 구현체 이름보다 다음 질문을 먼저 확인한다.

1. 같은 값을 여러 번 허용하는가?
2. Element의 encounter order 또는 정렬 순서가 계약인가?
3. Index, Key, Head 중 어떤 방식으로 값을 찾는가?
4. 호출자가 Collection을 변경할 수 있어야 하는가?
5. 반환값은 독립된 Snapshot인가, 현재 상태를 보여 주는 View인가?
6. Element 자체는 불변인가?
7. 여러 Thread가 동시에 접근하는가?

일반 `ArrayList`, `HashSet`과 `HashMap`은 동시 변경을 자동으로 안전하게 처리하지 않는다. 수정 불가능한 Wrapper를 사용했다고 Thread Safety까지 자동으로 확보되는 것도 아니다.

## 자주 발생하는 잘못된 사용

| 잘못된 사용 | 문제 |
|---|---|
| 내부 가변 List를 그대로 반환 | 외부가 객체의 규칙을 우회해 내부 상태를 변경할 수 있다. |
| `final List`를 불변으로 오해 | 참조 재할당만 막고 Element 추가·제거는 막지 않는다. |
| `HashSet`·`HashMap`의 반복 순서에 의존 | 구현체가 보장하지 않는 순서를 계약처럼 사용한다. |
| Raw Type 사용 | 잘못된 Type이 들어가 Runtime 오류로 늦게 발견될 수 있다. |
| 수정 불가능한 List의 Element도 불변이라고 가정 | 가변 Element의 상태는 계속 바뀔 수 있다. |
| `unmodifiableList()`를 Snapshot으로 오해 | Backing List의 변경이 View에 보인다. |
| 가변 객체를 HashMap Key로 사용 후 변경 | 조회·삭제가 예상과 다르게 동작할 수 있다. |
| Collection 구현체를 이유 없이 교체 | 실제 요구와 측정 없이 복잡성만 늘어난다. |

## Ticket 예제의 적용 경계

Collection 개념을 설명하기 위해 Ticket에 상태 이력 기능을 바로 추가할 필요는 없다. 예제 Source의 핵심 목적이 상태 전이와 예외 규칙을 검증하는 것이라면, 별도의 요구가 없는 이력 기능은 학습 범위를 불필요하게 넓힐 수 있다.

상태 이력이 실제 요구가 된다면 다음 계약을 먼저 결정한 뒤 적용한다.

- 이력에 저장할 값과 순서
- 중복 상태 허용 여부
- 외부에 Snapshot과 View 중 무엇을 제공할지
- Element가 불변인지
- 상태 전이와 이력 추가를 하나의 행동으로 유지할 방법

## 설명 가능성 점검 질문

1. Collections Framework, `Collection`과 `Collections`는 각각 무엇인가?
2. `List`, `Set`, `Queue`, `Deque`와 `Map`은 어떤 요구에서 선택하는가?
3. `Map`이 Collections Framework에 속하면서도 `Collection<E>`을 상속하지 않는 이유는 무엇인가?
4. 변수 Type은 `List`이고 생성 객체는 `ArrayList`인 이유는 무엇인가?
5. Generic이 잘못된 Element Type을 어떻게 방지하는가?
6. `private final List`가 불변 List를 의미하지 않는 이유는 무엇인가?
7. 내부 List를 그대로 반환하면 캡슐화가 어떻게 깨지는가?
8. `List.copyOf()`와 `Collections.unmodifiableList()`의 관찰 결과는 어떻게 다른가?
9. 수정 불가능한 List 안의 Element가 가변이면 어떤 문제가 남는가?
10. `UnsupportedOperationException`은 어떤 상황에서 발생하는가?
11. Ticket 상태 이력에 `List`가 적합한 이유는 무엇인가?
12. Ticket 예제에 상태 이력을 바로 추가하지 않아도 되는 이유는 무엇인가?

## 자료 범위

이 자료는 Java Collections Framework, 자료구조 선택, 가변성, Snapshot과 View의 차이를 설명한다. 개인의 답변과 학습 진행 상태는 [8월 20일 Study Note](../study-notes/2026-08-20-study-questions.md)에 기록한다.

## 참고 자료

- [Java SE 25 API — Collection](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Collection.html)
- [Java SE 25 API — List](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/List.html)
- [Java SE 25 API — Set](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Set.html)
- [Java SE 25 API — Queue](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Queue.html)
- [Java SE 25 API — Deque](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Deque.html)
- [Java SE 25 API — Map](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Map.html)
- [Java SE 25 API — Collections](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Collections.html)
- [Dev.java — The Collections Framework](https://dev.java/learn/api/collections-framework/)
- [Dev.java — Collections Factory Methods](https://dev.java/learn/api/collections-framework/factory-methods/)
