# Week 1 종합 복습과 전이 학습 점검

> 작성일: 2026-08-22
> 목적: Week 1의 Java 객체지향·Exception·Collection·JUnit 학습을 새 사례에 적용하여 설명 가능한 범위와 추가 복습이 필요한 범위를 구분한다.
> 상태: Partially Completed — 전체 Test 재현과 기본 복습 완료, 다형성·합성의 독립 설명은 일요일·월요일에 추가 점검 예정

---

## 복습 질문

1. Ticket의 제목과 status != null은 왜 불변조건이고, 상태 전이 순서는 왜 현재 비즈니스 규칙인가?
-> Ticket의 제목은 객체 생성부터 생명주기 동안 null이나 공백이 아닌 유효한 값이어야 하고, 상태도 항상 null이 아니어야 하므로 불변조건이다. 반면 `OPEN → IN_PROGRESS → RESOLVED` 순서는 현재 실습에서 채택한 업무 절차다. 다른 제품에서는 바로 해결하거나 다시 여는 전이를 허용할 수 있으므로 보편적인 불변조건이 아니라 현재 비즈니스 규칙이다.

2. 예외가 발생해도 객체 상태가 자동으로 복구되지 않는 이유는 무엇인가?
-> 예외는 실행 흐름을 중단하거나 호출자에게 실패를 전달할 뿐, 이미 메모리에 반영된 객체 상태를 자동으로 되돌리지 않는다. 현재 Ticket은 상태를 변경하기 전에 조건을 검사하고 예외를 던지므로 상태가 유지된다. 상태 변경 후 예외가 발생했다면 별도의 복구 코드, 보상 처리 또는 Transaction이 필요하다.

3. assertThrows() 뒤에 상태를 assertEquals()로 다시 확인하는 이유는 무엇인가?
-> `assertThrows()`는 잘못된 행동이 올바른 예외로 거부됐는지를 확인한다. 이후 `assertEquals()`는 거부 과정에서 Ticket의 기존 상태가 훼손되지 않았는지를 별도로 확인한다. 두 Assertion은 “실패를 알렸다”와 “객체가 안전한 상태를 유지했다”라는 서로 다른 계약을 검증한다.

4. List.copyOf()가 캡슐화를 어떻게 돕고, 내부 요소까지 깊게 복사하는 것은 아닌 이유는 무엇인가?
-> `List.copyOf()`는 외부에서 `add()`, `remove()`, `set()`으로 구조를 변경할 수 없는 unmodifiable List를 반환하여 내부 컬렉션의 직접 변경을 막는다. 다만 원본이 이미 적절한 unmodifiable List라면 같은 객체가 재사용될 수도 있으므로 항상 새로운 List를 만든다고 말할 수는 없다. 또한 요소의 참조를 복사하는 얕은 복사이므로 요소 자체가 가변 객체라면 그 객체의 내부 상태까지 보호하지는 않는다.

5. VIP 추가 시 조건문 방식은 왜 기존 코드를 수정했으며 Strategy의 기존 Calculator는 왜 유지됐는가?
-> 조건문 방식은 `TicketPriority`에 VIP를 추가하면서 기존 `switch`가 모든 enum 값을 처리하지 못하게 되었고, 기존 `ConditionalResponseTimePolicy`에 VIP 분기를 추가해야 했다. 이는 새 정책이 기존 분기 코드에 변경 압력을 만든다는 사실을 보여준다. Strategy 방식의 Calculator는 구체적인 정책을 알지 않고 `ResponseTimePolicy`에 위임하므로 수정하지 않아도 됐다. 다만 `VipResponseTimePolicy`, 테스트와 새로운 Strategy를 연결하는 조립 코드는 추가됐으므로 모든 변경이 사라진 것은 아니다.

6. DIP와 Dependency Injection은 현재 코드에서 각각 어디에 나타나는가?
-> DIP는 `ResponseTimeCalculator`가 구체 Policy Class가 아니라 `ResponseTimePolicy`라는 추상화에 의존하는 구조에서 나타난다. DI는 Calculator의 생성자가 외부에서 실제 Policy 객체를 전달받는 부분에서 나타난다. 테스트 코드가 구현체를 생성하고 생성자에 전달하는 부분은 조립 역할을 한다. DI는 DIP를 적용할 때 사용할 수 있는 방법이지만, 구체 클래스만 주입한다면 DI를 사용해도 DIP를 만족한다고 할 수 없다.

---

## Week 1 계획 대비 결과

### 완료한 내용

- Java 25·Maven 재현, Ticket 캡슐화, Exception, Collection 개념, JUnit 10개, Policy 비교 6개, 총 16개 테스트

### 부분 완료한 내용

- Git 운영 Baseline의 diff --staged, 복구 명령 설명

### 의도적으로 수행하지 않은 내용

- Spring, Database, UI, LLM, 실제 Helpdesk SLA 연결

### 처음 예상과 달랐던 점

- enum에 VIP만 추가했을 때 테스트가 아니라 컴파일 단계에서 실패했음.

### 아직 남은 질문

- 공통 Interface Type의 변수와 Runtime의 실제 객체를 연결하여 다형성을 자신의 말로 설명할 수 있는가?
- Composition에서 객체 보유, 책임 위임과 총비용 계산의 책임을 혼동하지 않고 설명할 수 있는가?
- DIP와 DI를 코드 위치뿐 아니라 의존 방향과 객체 전달 방식의 차이로 설명할 수 있는가?
- 위 질문은 2026-08-23 일요일 야간 또는 2026-08-24 월요일에 한 번에 하나씩 다시 점검한다.

---

## 전이 학습 점검

### 새 사례 — 배송비 정책

```java
interface DeliveryFeePolicy {

    int fee(int orderAmount);
}

final class StandardDeliveryFeePolicy
        implements DeliveryFeePolicy {

    @Override
    public int fee(int orderAmount) {
        return orderAmount >= 50_000 ? 0 : 3_000;
    }
}

final class ExpressDeliveryFeePolicy
        implements DeliveryFeePolicy {

    @Override
    public int fee(int orderAmount) {
        return 7_000;
    }
}

final class Checkout {

    private final DeliveryFeePolicy feePolicy;

    Checkout(DeliveryFeePolicy feePolicy) {
        this.feePolicy =
                Objects.requireNonNull(feePolicy);
    }

    int total(int orderAmount) {
        if (orderAmount < 0) {
            throw new IllegalArgumentException(
                    "order amount must not be negative");
        }

        return orderAmount
                + feePolicy.fee(orderAmount);
    }
}
```
### 1단계 — 다형성과 합성 핵심 점검

> 진행 상태: Partially Completed — 단계형 문답으로 핵심 동작을 확인했으며, 독립 설명은 후속 복습에서 다시 점검한다.

1. 역할 찾기
다음 역할에 해당하는 코드를 각각 찾으세요.
- 추상화: DeliveryFeePolicy
- 구체 구현: StandardDeliveryFeePolicy, ExpressDeliveryFeePolicy
- Strategy를 사용하는 Context: Checkout
- 외부에서 의존 객체를 받는 위치: Checkout(DeliveryFeePolicy feePolicy)

2. 실행 결과 예측
다음 결과와 그 이유를 설명하세요.

```java
var checkout = new Checkout(
        new StandardDeliveryFeePolicy());

checkout.total(40_000);
checkout.total(60_000);
```

```java
var checkout = new Checkout(
        new ExpressDeliveryFeePolicy());

checkout.total(40_000);
```
단순 계산뿐 아니라 어떤 구현체의 fee()가 호출되는지도 설명해야 합니다.
-> 답변: 첫 번째 `Checkout`에는 `StandardDeliveryFeePolicy` 객체가 주입된다. `40_000`원은 `50_000`원보다 작으므로 일반 배송비 `3_000`원이 적용되어 총비용은 `43_000`원이다. `60_000`원은 기준 이상이므로 배송비가 `0`원이고 총비용은 `60_000`원이다. 두 번째 `Checkout`에는 `ExpressDeliveryFeePolicy` 객체가 주입되며, 주문 금액과 관계없이 빠른 배송비 `7_000`원을 반환하므로 총비용은 `47_000`원이다.

3. Polymorphism은 정확히 어디에서 발생하는가?
다음 문장에서 다형성이 성립하는 이유를 설명하세요.

```java
DeliveryFeePolicy policy =
        new StandardDeliveryFeePolicy();

policy = new ExpressDeliveryFeePolicy();
```

다음 용어를 답변에 사용해 보세요.
- 공통 타입
- 실제 객체
- Runtime
- Method 구현 선택

-> 현재 이해: `policy` 변수의 선언 Type은 계속 `DeliveryFeePolicy`다. 첫 번째 대입 후에는 `StandardDeliveryFeePolicy` 객체를 가리키고, 재대입 후에는 기존 객체를 바꾸는 것이 아니라 `ExpressDeliveryFeePolicy` 객체를 가리킨다. `policy.fee()`를 호출하면 Runtime의 실제 객체에 따라 재정의된 Method가 선택된다.

-> 추가 점검: 위 동작을 다형성의 정의와 연결하여 AI의 단계형 질문 없이 자신의 말로 설명하는 과제는 일요일·월요일 복습으로 남긴다.

4. Composition은 정확히 어디에서 발생하는가?
Checkout이 DeliveryFeePolicy를 상속하지 않고 필드로 보유하는 이유를 설명하세요.
다음 질문도 함께 답하세요.
- Checkout은 배송비 계산을 직접 수행하는가?
- 어떤 객체에 작업을 위임하는가?
- 정책을 교체할 때 Checkout 자체를 바꿔야 하는가?

-> 현재 이해: `Checkout`은 `DeliveryFeePolicy` 객체를 `feePolicy` 필드로 보유하고 배송비 계산을 그 객체에 위임한다. 실제 정책 객체는 배송비만 계산하며, `Checkout`은 반환된 배송비와 주문 금액을 합산하여 총비용을 계산한다. 정책을 교체할 때는 `Checkout` 내부 코드를 수정하지 않고 생성자에 전달하는 객체를 바꿀 수 있다.

-> 추가 점검: Composition을 필드 보유, 책임 위임과 `has-a` 관계로 독립 설명할 수 있는지는 후속 복습에서 다시 확인한다.

5. DIP와 DI 구분
현재 코드에서 다음 두 항목을 각각 찾으세요.
- DIP가 적용된 의존 방향: `Checkout → DeliveryFeePolicy`
- DI가 수행되는 위치: 외부 호출자가 실제 정책 객체를 `Checkout(DeliveryFeePolicy feePolicy)` 생성자에 전달하는 부분
만약 생성자 인수 타입이 다음과 같다면 DIP를 만족하는지도 설명하세요.

```java
Checkout(
        StandardDeliveryFeePolicy feePolicy)
```

-> 현재 이해: DIP는 `Checkout`이 구체 정책이 아니라 `DeliveryFeePolicy`라는 공통 계약에 의존하는 구조에 나타난다. DI는 외부 호출자가 실제 정책 객체를 생성하여 `Checkout` 생성자에 전달하는 과정에서 수행된다. 생성자 인수 Type이 `StandardDeliveryFeePolicy`라면 외부 전달이라는 DI는 일어나지만, `Checkout`이 구체 구현에 직접 의존하므로 DIP는 만족하지 않는다.

-> 추가 점검: Interface Type 필드가 있더라도 `Checkout` 내부에서 `new StandardDeliveryFeePolicy()`를 직접 호출하면 구체 구현과 분리되지 않는 이유를 후속 복습에서 다시 설명한다.

### 2단계 — 변경 요구와 설계 판단

> 진행 상태: Deferred — 1단계 독립 설명을 다시 확인한 뒤 진행한다.

6. 회원 전용 정책 추가
새 요구사항이 생겼습니다.
회원 전용 배송비는 주문 금액과 관계없이 1,000원이다.

Strategy 방식으로 추가한다면 다음을 구분하세요.
- 새로 만들어야 하는 Class:
- 수정하지 않아도 되는 기존 Production Class:
- 변경되거나 추가되어야 하는 Test:
- 실제 구현체를 선택하는 조립 코드의 변경:

7. Strategy가 조건문을 완전히 없애는가?
다음 선택 코드가 별도로 존재한다고 가정합니다.

```java
DeliveryFeePolicy choose(MemberGrade grade) {
    return switch (grade) {
        case BASIC ->
                new StandardDeliveryFeePolicy();
        case EXPRESS ->
                new ExpressDeliveryFeePolicy();
    };
}
```

MEMBER 등급을 추가할 때 무엇을 수정해야 하는지 설명하세요.
그리고 다음 주장에 동의하는지 판단하세요.
Strategy를 사용하면 새로운 정책을 추가해도 기존 코드는 어떤 것도 수정하지 않는다.

8. 조건문과 Strategy 중 선택
다음 두 상황에서 어느 방식을 선택할지 이유와 함께 답하세요.
상황 A:
- 정책이 두 개뿐이다.
- 계산식이 한 줄이다.
- 앞으로 거의 변경되지 않는다.
- 분기가 한곳에만 있다.
상황 B:
- 국가·회원 등급마다 정책이 계속 추가된다.
- 정책마다 외부 환율 정보나 회원 정보를 사용한다.
- 정책별 변경 담당자와 변경 시기가 다르다.
- 실행 중 정책을 교체해야 한다.

9. 상속을 사용해도 되는가?
다음 설계를 검토하세요.

현재 예제의 `StandardDeliveryFeePolicy`는 `final`이므로 아래 코드는 실제로 컴파일되지 않는다. 여기서는 상속 관계의 적절성만 검토하기 위해 `final`을 제거했다고 가정한다.

```java
class ExpressDeliveryFeePolicy
        extends StandardDeliveryFeePolicy {
}
```

다음 질문에 답하세요.
- Express 정책은 정말 Standard 정책의 특수한 종류인가?
- 단순한 코드 재사용을 위해 상속한 것은 아닌가?
- 상위 Class의 규칙이 바뀌면 어떤 영향을 받는가?
- DeliveryFeePolicy를 직접 구현하는 편과 무엇이 다른가?

10. LSP 위반 찾기
공통 계약상 배송비는 0 이상이어야 한다고 가정합니다.

```java
final class BrokenDeliveryFeePolicy
        implements DeliveryFeePolicy {

    @Override
    public int fee(int orderAmount) {
        return -10_000;
    }
}
```

문법적으로 Interface를 구현했는데도 LSP를 위반하는 이유와 Checkout.total()에 발생할 문제를 설명하세요.

### 3단계 — 8월 20일 Exception·Collection·JUnit 전이 점검

> 진행 상태: Deferred — 다형성·합성 후속 복습과 Week 1 WIL 보완 순서를 우선한다.
아래 코드에는 의도적으로 문제가 있습니다.

```java
final class Order {

    private OrderStatus status =
            OrderStatus.CREATED;

    private final List<OrderItem> items =
            new ArrayList<>();

    void pay() {
        status = OrderStatus.PAID;

        if (items.isEmpty()) {
            throw new IllegalStateException(
                    "empty order cannot be paid");
        }
    }

    List<OrderItem> items() {
        return List.copyOf(items);
    }

    OrderStatus status() {
        return status;
    }
}
```

11. 예외가 발생한 뒤 상태 예측
Item이 없는 Order에서 pay()를 호출하면 다음을 설명하세요.
- 어떤 Exception이 발생하는가?
- 예외 후 status는 무엇인가?
- 왜 자동으로 CREATED로 복구되지 않는가?
- 코드를 어떤 순서로 바꿔야 하는가?

12. JUnit 테스트 설계
빈 Order에서 pay()를 호출하는 테스트를 Given–When–Then으로 작성하세요.
반드시 다음 두 검증을 분리해 포함해야 합니다.
- 올바른 Exception 발생
- 실패 후 CREATED 상태 유지

13. List.copyOf()의 보호 범위
다음 코드의 결과를 설명하세요.

아래 `order`에는 `OrderItem`이 한 개 이상 들어 있다고 가정한다.

```java
var exposedItems = order.items();
exposedItems.add(new OrderItem("노트북"));
```

이어서 OrderItem이 가변 객체이고 다음 Method를 제공한다고 가정합니다.
```java
exposedItems.get(0).rename("변경된 상품명");
```

List 구조 변경과 Element 내부 상태 변경이 각각 가능한지 구분하세요.

14. Collection 선택
Order 상태 변경 이력을 저장해야 합니다.
```
CREATED → PAID → SHIPPED → DELIVERED
```

다음 조건을 고려해 List, Set, Map 중 하나를 선택하고 이유를 설명하세요.
- 발생 순서가 중요하다.
- 같은 상태가 다시 등장할 수도 있다.
- 모든 전이 기록을 유지해야 한다.

자기 점검 방법
각 답변 끝에 확신도를 붙이세요.

```
-> 답변:
-> 확신도: 0 | 1 | 2
```

- 0: 거의 모르거나 추측함
- 1: 결론은 알지만 코드와 변경 범위로 설명하기 어려움
- 2: 코드의 필드·생성자·Method를 가리키며 이유와 Trade-off까지 설명 가능

---

## 8월 22일 현재 결론

- 새 Terminal에서 JDK 25.0.4와 Maven 3.9.16을 확인하고 `.\mvnw.cmd clean test`를 실행하여 Test 16개가 실패·오류·건너뜀 없이 통과했다.
- Ticket의 불변조건, 예외 발생과 상태 보존, `List.copyOf()`의 보호 범위, 조건문과 Strategy의 VIP 변경 범위는 기존 코드와 Test를 근거로 복습했다.
- 배송비 사례를 통해 선언 Type과 실제 객체, Composition의 필드 보유와 책임 위임, DIP와 DI의 차이를 단계적으로 확인했다.
- 다만 다형성과 Composition을 새 코드에서 즉시 찾아 독립적으로 설명하는 수준은 아직 확인하지 못했다.
- 일요일·월요일 추가 복습 후 이 문서의 후속 답변과 Week 1 WIL 초안을 보완한다.
