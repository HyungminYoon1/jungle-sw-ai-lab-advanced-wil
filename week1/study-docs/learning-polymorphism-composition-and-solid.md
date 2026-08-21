# Learning Note — Polymorphism, Composition과 SOLID

> 작성일: 2026-08-21
> 주차: Week 1
> 기준: Java SE 25
> 이해 상태: 개념 정리, Policy 비교 실험과 취약 개념 점검 완료

## 핵심 질문

> 새로운 Ticket Policy가 추가될 때 조건문, 상속과 Composition은 각각 어떤 변경을 요구하며 어떤 구조가 현재 문제에 더 단순한가?

## 한 문장 설명

Polymorphism은 하나의 공통 Type을 통해 서로 다른 구현을 호출하게 하고, Composition은 필요한 행동을 다른 객체와의 협력으로 구성하며, SOLID는 이런 분리가 실제 변경 비용과 계약 안정성을 개선하는지 판단하는 설계 원칙이다.

## 개념 관계

```text
Abstraction
└─ 공통 계약으로 중요한 행동을 표현
   └─ Polymorphism
      ├─ Inheritance 또는 Interface 구현으로 Type 관계 형성
      └─ Runtime의 실제 객체에 따라 다른 행동 실행

Composition
└─ 객체가 필요한 행동을 다른 객체에 위임
   └─ 공통 Interface를 사용하면 Strategy 교체 가능
```

Polymorphism과 Composition은 서로 경쟁하는 개념이 아니다. Composition으로 협력 객체를 보유하면서 그 객체의 공통 Type을 통해 Polymorphism을 사용할 수 있다.

## 핵심 개념

### Abstraction

Abstraction은 문제 해결에 필요한 핵심 행동과 계약을 드러내고, 호출자가 알 필요 없는 구현 세부사항은 구체 구현 안에 두는 과정이다.

예를 들어 호출자는 응답 목표 시간이 어떻게 계산되는지 모두 알지 않고 `targetResponseTime()`이라는 계약만 사용할 수 있다.

```java
interface ResponseTimePolicy {
    Duration targetResponseTime();
}
```

좋은 Abstraction은 현재 구현을 감추기 위해 임의로 만드는 이름이 아니다. 여러 구현이 필요하거나 호출자와 구현의 변경 이유를 분리해야 한다는 근거가 있을 때 가치가 생긴다.

### Inheritance

Inheritance는 하위 Class가 상위 Class의 접근 가능한 상태와 행동을 물려받고 더 구체적인 Type을 형성하는 방법이다.

Java Class는 하나의 Class만 직접 상속할 수 있지만 여러 Interface를 구현할 수 있다. Constructor는 상속되지 않으며, 상위 Class의 `private` Member도 하위 Class가 직접 상속해 접근하는 대상이 아니다.

Inheritance를 사용할 때의 핵심 질문은 코드 재사용 가능 여부가 아니라 다음 두 가지다.

- 하위 Type이 실제로 상위 Type의 한 종류인가?
- 하위 Type을 상위 Type 대신 사용해도 기존 계약이 깨지지 않는가?

`UrgentTicket extends Ticket`이 단순히 일부 Method를 재사용하기 위한 선택이라면 상태 규칙과 생명주기가 강하게 결합될 수 있다. 반대로 모든 Urgent Ticket이 Ticket 계약을 그대로 지키면서 의미 있는 특수화 관계를 형성한다면 상속을 검토할 수 있다.

### Polymorphism

Polymorphism은 공통 상위 Type 또는 Interface로 객체를 다루면서 실제 객체의 구현에 따라 다른 Method가 실행되는 성질이다.

```java
ResponseTimePolicy policy = new UrgentResponseTimePolicy();
Duration target = policy.targetResponseTime();
```

변수 Type은 `ResponseTimePolicy`지만 Runtime 객체가 `UrgentResponseTimePolicy`라면 해당 구현의 Method가 실행된다.

Polymorphism과 Inheritance는 같은 개념이 아니다.

- Class 상속은 Polymorphism을 만드는 한 방법이다.
- Interface 구현도 Polymorphism을 제공한다.
- 상속 계층이 있어도 공통 Type으로 교체해 사용하지 않으면 설계상 Polymorphism의 이점을 활용하지 못할 수 있다.

### Composition

Composition은 객체가 필요한 기능을 상속받는 대신 다른 객체를 Field나 Constructor 인수로 받아 협력하는 방식이다.

```java
final class ResponseTimeCalculator {
    private final ResponseTimePolicy policy;

    ResponseTimeCalculator(ResponseTimePolicy policy) {
        this.policy = policy;
    }

    Duration targetResponseTime() {
        return policy.targetResponseTime();
    }
}
```

`ResponseTimeCalculator`는 구체 정책의 계산 방식을 상속받지 않는다. 필요한 계산을 `ResponseTimePolicy`에 위임한다.

Composition 자체가 반드시 Interface를 요구하는 것은 아니다. 다만 협력 객체를 교체해야 한다면 공통 Interface와 함께 사용할 때 결합 범위를 줄이기 쉽다.

## `is-a`와 `has-a`

| 질문 | 관계 | 예시 |
|---|---|---|
| A는 B의 한 종류인가? | `is-a` | 특정 구현은 `ResponseTimePolicy`의 한 종류다. |
| A가 B를 사용하거나 보유하는가? | `has-a` | Calculator는 `ResponseTimePolicy`를 사용한다. |

`is-a`라는 문장이 자연스럽다는 이유만으로 상속을 선택해서는 안 된다. 상위 Type의 사전조건, 사후조건과 불변조건을 하위 Type도 지킬 수 있는지 함께 확인해야 한다.

## Inheritance와 Composition 비교

| 기준 | Inheritance | Composition |
|---|---|---|
| 관계 | 상위·하위 Type 관계 | 협력 객체 관계 |
| 재사용 방식 | 상위 구현과 상태를 물려받음 | 다른 객체에 행동을 위임 |
| 결합 | 상위 Class의 변경 영향이 하위 Class로 전달될 수 있음 | 협력 계약을 경계로 구현을 교체할 수 있음 |
| Runtime 교체 | 객체 생성 후 부모 Type 자체를 교체하지 않음 | 다른 협력 객체를 주입해 교체 가능 |
| 적합한 경우 | 안정적인 `is-a` 관계와 대체 가능성이 성립 | 행동이 독립적으로 변하거나 조합되어야 함 |
| 주요 위험 | 취약한 상위 Class, 깊은 계층과 예상 밖 Override | 작은 문제에도 Interface와 구현 Class가 늘어날 수 있음 |

Composition을 우선 검토한다는 말은 항상 Composition을 선택한다는 뜻이 아니다. 변경 가능성이 낮고 조건이 적은 문제에 여러 Interface와 Class를 도입하면 구조만 복잡해질 수 있다.

## Strategy

Strategy는 변경 가능한 알고리즘이나 판단 규칙을 공통 계약 뒤의 객체로 분리하고, 사용하는 객체가 그 Strategy와 협력하도록 만드는 설계 방식이다.

```text
ResponseTimeCalculator
└─ ResponseTimePolicy
   ├─ NormalResponseTimePolicy
   ├─ UrgentResponseTimePolicy
   └─ VipResponseTimePolicy
```

- 공통 Interface를 통한 호출은 Polymorphism을 사용한다.
- Calculator가 Policy 객체를 보유하고 위임하는 것은 Composition이다.
- 새 Policy 구현을 추가해도 Calculator의 핵심 계산 흐름을 유지할 수 있다.
- 어떤 Policy를 선택할지 결정하는 Factory, 설정 또는 조립 Code는 변경될 수 있다.

따라서 Strategy는 기존 Code를 전혀 수정하지 않는 구조가 아니다. 변경이 발생하는 위치를 핵심 흐름에서 구현과 조립 경계로 옮기는 구조다.

## SOLID

SOLID는 Class 개수를 늘리기 위한 규칙이 아니라 변경 이유, 계약과 의존성의 방향을 점검하는 다섯 가지 설계 원칙이다.

### SRP — Single Responsibility Principle

하나의 Module이나 Class는 하나의 Actor 또는 하나의 변경 이유에 책임을 가져야 한다.

- Method가 하나여야 한다는 뜻이 아니다.
- 여러 Method가 하나의 책임을 함께 수행할 수 있다.
- 서로 다른 이유로 변경되는 계산, 저장과 출력이 한 Class에 섞이면 분리를 검토한다.

예시에서 응답 시간 계산 규칙과 Ticket 저장 책임은 서로 다른 이유로 변경되므로 한 Class에 섞지 않는다.

### OCP — Open-Closed Principle

Software 요소는 기능 확장에는 열려 있고 안정된 핵심 Code의 반복 수정에는 닫혀 있도록 설계한다.

- 기존 Code를 절대 수정하지 않는다는 뜻이 아니다.
- 새 요구마다 같은 조건문과 기존 Test를 여러 곳에서 수정하는 신호가 있을 때 확장 지점을 검토한다.
- 확장 지점을 미리 과도하게 만들면 현재 문제보다 설계 비용이 커질 수 있다.

Strategy 구조에서 새 Policy 구현을 추가할 수 있어도 조립 Code와 Test는 변경될 수 있다. OCP의 목표는 모든 변경 제거가 아니라 변경 파급 범위의 통제다.

### LSP — Liskov Substitution Principle

하위 Type이나 구현체를 상위 Type 대신 사용해도 호출자가 기대하는 계약과 프로그램의 올바른 동작이 깨지지 않아야 한다.

`ResponseTimePolicy` 구현은 다음과 같은 공통 계약을 지켜야 한다.

- 반환값이 `null`이 아니다.
- 목표 응답 시간이 음수가 아니다.
- 같은 입력 조건에서 계약상 허용되지 않은 Side Effect를 만들지 않는다.

특정 구현만 예외적으로 음수 시간을 반환한다면 Interface를 구현했다는 문법적 사실만으로 대체 가능성이 성립하지 않는다.

### ISP — Interface Segregation Principle

호출자가 사용하지 않는 Method에 의존하도록 강요하는 큰 Interface보다 호출자별로 필요한 작은 계약을 제공한다.

`ResponseTimePolicy`에 저장, 알림, 담당자 배정 Method까지 넣으면 응답 시간만 필요한 구현체도 불필요한 Method를 구현해야 한다.

작은 Interface가 항상 Method 하나만 가져야 한다는 뜻은 아니다. 함께 변경되고 같은 호출자가 사용하는 응집된 행동을 하나의 계약으로 묶는다.

### DIP — Dependency Inversion Principle

상위 수준 정책과 하위 수준 세부 구현이 서로의 구체 Class에 직접 의존하기보다 둘 다 안정된 Abstraction에 의존하도록 한다.

`ResponseTimeCalculator`가 `UrgentResponseTimePolicy`를 내부에서 직접 생성하면 구체 구현 선택과 계산 흐름이 결합된다. Constructor로 `ResponseTimePolicy`를 받으면 Calculator는 공통 계약에 의존한다.

DIP와 Dependency Injection은 같은 말이 아니다.

- DIP는 의존 방향을 설계하는 원칙이다.
- Dependency Injection은 외부에서 의존 객체를 전달하는 구현 방법이다.
- Spring Container가 없어도 Constructor Injection으로 적용할 수 있다.

## Ticket 응답 시간 Policy 변경 요구

오늘 비교에 사용할 가상의 요구는 다음과 같다.

- 일반 Ticket의 목표 응답 시간: 24시간
- 긴급 Ticket의 목표 응답 시간: 4시간
- 후속 변경: VIP Ticket의 목표 응답 시간 1시간 추가

이 Policy는 실제 Helpdesk 업무 흐름에 연결된 SLA 기능이 아니라 두 구조의 변경 범위를 비교하기 위한 독립 학습 Code다. `responsetime` Package에 조건문과 Strategy 구조를 나란히 구현했으며 기존 Ticket 상태 전이와는 연결하지 않았다.

### 조건문 방식

```java
Duration targetResponseTime(TicketPriority priority) {
    return switch (priority) {
        case NORMAL -> Duration.ofHours(24);
        case URGENT -> Duration.ofHours(4);
    };
}
```

VIP를 추가하면 예상되는 변경은 다음과 같다.

- `TicketPriority`에 값 추가
- 기존 `switch`에 Case 추가
- VIP Test 추가
- 다른 위치에도 같은 분기가 있다면 각각 수정

정책이 두세 개이고 한곳에서만 계산하며 거의 변경되지 않는다면 이 방식이 더 읽기 쉽고 경제적일 수 있다.

### Strategy·Composition 방식

```java
interface ResponseTimePolicy {
    Duration targetResponseTime();
}

final class UrgentResponseTimePolicy
        implements ResponseTimePolicy {

    @Override
    public Duration targetResponseTime() {
        return Duration.ofHours(4);
    }
}
```

VIP를 추가하면 예상되는 변경은 다음과 같다.

- `VipResponseTimePolicy` 구현 추가
- VIP Policy Test 추가
- Policy 선택 또는 조립 Code에 VIP 연결
- 기존 Calculator는 공통 계약이 유지되면 변경하지 않을 가능성이 큼

정책이 독립적으로 자주 변경되거나 실행 중 조합·교체되어야 한다면 Strategy의 비용이 정당화될 수 있다.

## 예상 변경 영향

| 비교 항목 | 조건문 | Strategy·Composition |
|---|---|---|
| 초기 Class 수 | 적음 | Interface와 구현체 때문에 많음 |
| 정책 전체 파악 | 한곳에서 쉬움 | 여러 구현체를 함께 봐야 함 |
| 새 정책 추가 | 기존 분기 수정 | 새 구현과 조립 변경 |
| 정책별 독립 Test | 가능하지만 한 대상에 집중 | 구현체별 분리 가능 |
| Runtime 교체 | 별도 분기 필요 | 협력 객체 교체 가능 |
| 과도한 설계 위험 | 조건 중복과 거대한 `switch` | 불필요한 Interface와 Class 증가 |

이 표를 오전의 가설로 작성한 뒤 오후에 같은 변경 요구를 두 구조에 적용해 실제 Diff와 Test로 확인했다.

## 실제 비교 결과

- 기준선 Commit `6fb3365`에서 NORMAL·URGENT 정책을 조건문과 Strategy로 각각 구현하고 전체 Test 14개를 통과했다.
- `TicketPriority`에 `VIP`만 먼저 추가하자 기존 `switch` 표현식이 모든 enum 값을 처리하지 못해 Test 실행 전 컴파일에 실패했다.
- 조건문 방식은 기존 `ConditionalResponseTimePolicy`의 `switch`에 VIP 분기를 추가해야 했다.
- Strategy 방식은 `VipResponseTimePolicy`를 추가했으며 기존 `ResponseTimePolicy`, `ResponseTimeCalculator`, NORMAL·URGENT 구현체는 수정하지 않았다.
- VIP 확장 Commit `3eb8b29`에서 전체 Test 16개가 실패·오류·건너뜀 없이 통과했다.
- 이번 실습에는 Factory나 DI Container가 없으므로 Test Code가 Strategy를 생성해 Calculator에 전달했다. 실제 Application에서도 새 구현을 선택하는 조립 경계는 변경될 수 있다.

현재처럼 정책이 세 개이고 계산이 단순하며 분기가 한곳뿐이라면 `switch`가 더 경제적이다. 정책이 반복적으로 추가되거나 각 정책의 계산 과정·의존성·교체 시점이 독립적으로 달라질 때 Strategy의 추상화 비용이 정당화될 수 있다. 따라서 OCP는 모든 수정을 없애는 규칙이 아니라 안정된 핵심으로 변경이 퍼지는 범위를 통제하는 원칙으로 관찰했다.

## 선택 기준

다음 조건이 많으면 조건문을 유지하는 편이 낫다.

- 정책 수가 적고 고정적이다.
- 분기가 한곳에만 존재한다.
- 정책이 독립적으로 교체되지 않는다.
- 각 정책이 같은 입력과 출력 구조를 사용한다.

다음 조건이 많으면 Strategy·Composition을 검토한다.

- 새 정책이 반복해서 추가된다.
- 정책별 변경 주기와 담당자가 다르다.
- 정책마다 필요한 의존성과 Test가 다르다.
- 실행 환경이나 요청에 따라 정책을 교체해야 한다.
- 같은 조건문이 여러 위치에 반복된다.

선택의 핵심은 Pattern 이름이 아니라 다음 변경에서 어느 파일과 계약이 영향을 받는지다.

## 현재 Ticket Domain의 적용 경계

이번 실습에서는 `OPEN → IN_PROGRESS → RESOLVED`를 단순화된 비즈니스 상태 전이 규칙으로 가정한다. 이는 모든 Ticket 시스템에 자연스럽게 적용되는 보편적인 불변조건이 아니다. 실제 허용 전이는 회사의 업무 절차와 제품 요구사항에 따라 달라질 수 있다.

현재 실습에서 `status != null`과 유효한 제목은 객체가 계속 지켜야 하는 불변조건이다. 반면 `OPEN`에서 바로 `RESOLVED`로 전이할 수 없다는 제약은 현재 비즈니스 요구로 채택한 상태 전이 규칙이다.

이 전이 규칙이 현재 요구사항으로 유지되는 동안에는 Ticket이 일관되게 보호해야 한다. 비즈니스 요구가 바뀌어 직접 해결이나 재오픈을 허용한다면 Source와 Test도 함께 변경해야 한다.

현재 전이 가능 여부는 Ticket 하나의 상태만으로 판단할 수 있으므로 Ticket 내부에서 검증한다. 단지 Strategy를 학습하기 위해 이 검증을 Ticket 밖으로 이동하면 기존 캡슐화 원칙이 약해질 수 있다.

응답 시간처럼 독립적으로 달라질 수 있는 Policy는 별도 비교 대상으로 구현하되, 실제 요구 없이 Ticket의 상태 전이 책임과 결합하지 않는다.

- 오전: 개념과 변경 가설 정리 완료
- 오후: 조건문·Strategy 기준선과 VIP 확장 Diff 비교 완료
- 야간: Abstraction·LSP·DIP와 Ticket 책임 경계 재설명 완료

## 자주 발생하는 오해

| 오해 | 수정된 이해 |
|---|---|
| Polymorphism은 상속이다. | 상속은 Polymorphism을 구성하는 방법 중 하나이며 Interface 구현도 가능하다. |
| `if`나 `switch`는 모두 나쁘다. | 작은 고정 분기는 가장 단순하고 읽기 쉬운 선택일 수 있다. |
| Composition은 항상 상속보다 낫다. | 관계, 계약과 변경 축에 따라 선택한다. |
| OCP는 기존 Code를 절대 수정하지 않는 것이다. | 안정된 핵심의 반복 수정을 줄이고 변경 파급을 통제하는 것이다. |
| SRP는 Class에 Method가 하나여야 한다. | 하나의 응집된 변경 이유를 가져야 한다. |
| DIP는 DI Framework를 사용하는 것이다. | Abstraction을 향한 의존 방향이 원칙이고 DI는 구현 방법 중 하나다. |
| Interface가 많을수록 SOLID하다. | 실제 교체·확장 요구가 없는 Interface는 복잡성만 늘릴 수 있다. |

## 설명 가능성 점검 질문

1. Abstraction은 단순히 구현을 숨기는 것과 어떻게 다른가?
2. Polymorphism과 Inheritance가 같은 개념이 아닌 이유는 무엇인가?
3. Java에서 Interface Type 변수에 서로 다른 구현 객체를 대입할 수 있는 이유는 무엇인가?
4. Composition은 객체의 행동을 어떻게 구성하고 교체하는가?
5. 상속의 `is-a` 관계만 확인해서 충분하지 않은 이유는 무엇인가?
6. Strategy가 Polymorphism과 Composition을 함께 사용한다는 뜻은 무엇인가?
7. SRP의 하나의 책임을 Method 개수로 판단하면 안 되는 이유는 무엇인가?
8. OCP가 기존 Code를 절대 수정하지 않는다는 뜻이 아닌 이유는 무엇인가?
9. LSP가 깨진 구현체의 예를 하나 설명할 수 있는가?
10. DIP와 Dependency Injection은 어떻게 다른가?
11. 정책이 적고 고정적일 때 조건문이 Strategy보다 나을 수 있는 이유는 무엇인가?
12. 현재 Ticket 상태 전이 검증을 Strategy로 분리하지 않는 이유는 무엇인가?

## 학습 근거와 현재 상태

- 확인한 근거: Java SE 25 Class·Interface 명세와 Java 공식 Inheritance·Polymorphism 학습 자료
- 문서화한 내용: 개념 관계, SOLID 적용 경계, Ticket 응답 시간 Policy의 예상과 실제 변경 범위
- 실행한 근거: 기준선 Commit `6fb3365`, VIP 확장 Commit `3eb8b29`, 최종 JUnit 16개와 `BUILD SUCCESS`
- 완료 표현의 경계: 독립 학습 Code의 비교를 완료한 것이며 실제 Helpdesk SLA 기능이나 Strategy 구조의 보편적 우수성을 증명하지 않는다.

## AI 활용

- AI가 도운 부분: 개념 구조화, Ticket Policy 사례, 비교 기준, Code Review와 Self Review 질문 초안 작성
- 학습자가 직접 수행한 부분: 조건문·Strategy Source와 Test 작성, Maven 실행, Diff 관찰, 오류 수정과 질문 답변
- 적용 원칙: 설명하거나 수정할 수 없는 Pattern Code는 학습 결과로 간주하지 않는다.

## 참고 자료

- [Java Language Specification 25 — Classes](https://docs.oracle.com/javase/specs/jls/se25/html/jls-8.html)
- [Java Language Specification 25 — Interfaces](https://docs.oracle.com/javase/specs/jls/se25/html/jls-9.html)
- [Dev.java — Inheritance](https://dev.java/learn/inheritance/what-is-inheritance/)
- [Dev.java — Polymorphism](https://dev.java/learn/inheritance/polymorphism/)
- [Robert C. Martin — Design Principles and Design Patterns (archived PDF)](https://web.archive.org/web/20191116231621/https://fi.ort.edu.uy/innovaportal/file/2032/1/design_principles.pdf)
