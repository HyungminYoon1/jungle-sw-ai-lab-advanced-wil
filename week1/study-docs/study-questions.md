# Ticket 객체와 JUnit 기초 학습 점검

> 작성일: 2026-08-19
> 목적: Ticket 객체 책임과 상태 전이 규칙을 설명하고, 이를 JUnit Test로 옮기기 위한 기초 이해를 자신의 말로 점검

1. `status`가 `private`인 이유는 무엇인가?
-> status를 private으로 선언하는 이유는 외부가 상태를 직접 변경하여 Ticket의 상태 전이 규칙을 우회하지 못하게 하기 위해서다. 외부에는 status()와 같이 제한된 조회 기능만 제공하고, 상태 변경은 Ticket이 허용한 행동을 통해서만 수행한다.

2. 범용 `setStatus()`를 제공하지 않는 이유는 무엇인가?
-> 범용 setStatus()를 제공하면 호출자가 원하는 상태를 직접 선택하면서 정상적인 상태 전이 순서를 우회하거나 null 같은 잘못된 값을 전달할 수 있다. startProgress()와 resolve()처럼 의도가 드러나는 메서드를 제공하면 Ticket이 전이 규칙을 직접 검사하고 보호할 수 있다.

3. `resolve()`가 Service가 아니라 Ticket 내부에서 전이를 검사하는 이유는 무엇인가?
-> IN_PROGRESS 상태에서만 해결할 수 있다는 규칙은 Ticket의 현재 상태만으로 판단할 수 있는 도메인 규칙이다. 따라서 Ticket이 직접 검사해야 어떤 Service나 테스트에서 사용하더라도 같은 규칙이 적용된다. Service에만 검사를 두면 다른 호출 경로에서 규칙을 우회할 수 있다.

4. 예외가 발생한 후에도 상태가 유지되는 이유는 무엇인가?
-> 메서드가 상태를 변경하기 전에 현재 상태가 유효한지 검사하고, 조건이 맞지 않으면 즉시 예외를 던지기 때문이다. 예외가 발생하면 상태를 변경하는 대입문까지 실행되지 않으므로 기존 상태가 유지된다.

5. 사용자 권한 검사는 왜 Ticket이 담당하지 않는가?
-> Ticket은 자신의 제목 불변조건과 상태 전이 규칙을 보호한다. 반면 사용자 권한 검사는 현재 요청한 사용자, 소유 관계와 역할처럼 Ticket 외부의 정보가 필요하므로 Application Service나 권한 정책이 담당하는 것이 적절하다. 반드시 별도의 AuthorizationService여야 하는 것은 아니며, 애플리케이션 구조에 따라 Service 또는 별도의 Policy 객체가 담당할 수 있다.

---

## Ticket Given–When–Then 시나리오 작성

> 목적: Ticket의 생성 규칙과 상태 전이 규칙을 JUnit Code로 옮기기 전에 자연어로 명확하게 설명한다.
> 개념 참고: [JUnit과 Unit Test 설계 Learning Note](./learning-junit-and-unit-test-design.md)

### 작성 기준

- Given: 입력값, 객체와 현재 상태를 구체적으로 적는다.
- When: 검증하려는 생성 또는 행동 한 가지를 적는다.
- Then: 기대하는 상태, 반환 결과 또는 예외 Type을 적는다.
- 거부 시나리오에서는 예외뿐 아니라 행동 후 Ticket 상태도 확인한다.
- 구현 Code가 아니라 외부에서 관찰할 수 있는 행동과 결과를 적는다.

### 시나리오 1 — 유효한 제목으로 Ticket 생성

- Given: 유효한 제목 "로그인 오류"
- When: 해당 제목으로 Ticket을 생성한다.
- Then:
  - 발생해야 하는 결과 또는 예외: Ticket 생성
  - 행동 후 Ticket 상태: OPEN
- 보호하려는 규칙: 유효한 제목으로 생성된 Ticket의 초기 상태는 OPEN이다.

### 시나리오 2 — `null` 제목으로 Ticket 생성

- Given: 제목 null, Ticket 없음
- When: Ticket 생성
- Then:
  - 발생해야 하는 결과 또는 예외: 잘못된 제목(IllegalArgumentException)이 발생한다.
  - 행동 후 Ticket 상태: Ticket이 생성되지 않아 상태를 조회할 수 없음
- 보호하려는 규칙: Ticket 제목은 null일 수 없다.

### 시나리오 3 — 빈 문자열로 Ticket 생성

- Given: 제목 빈 문자열, Ticket 없음
- When: Ticket 생성
- Then:
  - 발생해야 하는 결과 또는 예외: 잘못된 제목(IllegalArgumentException)이 발생한다.
  - 행동 후 Ticket 상태: Ticket이 생성되지 않아 상태를 조회할 수 없음
- 보호하려는 규칙: Ticket 제목은 빈 문자열일 수 없다.

### 시나리오 4 — 공백 문자열로 Ticket 생성

- Given: 제목 공백 문자열, Ticket 없음
- When: Ticket 생성
- Then:
  - 발생해야 하는 결과 또는 예외: 잘못된 제목(IllegalArgumentException)이 발생한다.
  - 행동 후 Ticket 상태: Ticket이 생성되지 않아 상태를 조회할 수 없음
- 보호하려는 규칙: Ticket 제목은 공백 문자열일 수 없다.

### 시나리오 5 — `OPEN`에서 `startProgress()`

- Given: 유효한 제목으로 생성되어 상태가 OPEN인 Ticket
- When: startProgress()를 호출
- Then:
  - 발생해야 하는 결과 또는 예외: Ticket 상태 OPEN -> IN_PROGRESS
  - 행동 후 Ticket 상태: IN_PROGRESS
- 보호하려는 규칙: OPEN Ticket만 처리를 시작할 수 있다.

### 시나리오 6 — `IN_PROGRESS`에서 `resolve()`

- Given: 생성 후 startProgress()를 호출하여 상태가 IN_PROGRESS인 Ticket
- When: resolve()를 호출
- Then:
  - 발생해야 하는 결과 또는 예외: Ticket 상태 IN_PROGRESS -> RESOLVED
  - 행동 후 Ticket 상태: RESOLVED
- 보호하려는 규칙: IN_PROGRESS Ticket만 해결할 수 있다.

### 시나리오 7 — `OPEN`에서 `resolve()` 거부

- Given: Ticket 상태 OPEN
- When: resolve()를 호출
- Then:
  - 발생해야 하는 결과 또는 예외: 잘못된 상태 전이(IllegalStateException)가 발생한다.
  - 행동 후 Ticket 상태: OPEN
- 보호하려는 규칙: OPEN Ticket은 바로 해결할 수 없다.

### 시나리오 8 — `IN_PROGRESS`에서 `startProgress()` 거부

- Given: 유효한 제목으로 생성하고 startProgress()를 호출하여 상태가 IN_PROGRESS인 Ticket
- When: startProgress()를 다시 호출
- Then:
  - 발생해야 하는 결과 또는 예외: 잘못된 상태 전이(IllegalStateException)가 발생한다.
  - 행동 후 Ticket 상태: IN_PROGRESS
- 보호하려는 규칙: IN_PROGRESS Ticket은 다시 처리를 시작할 수 없다.

### 시나리오 9-A — RESOLVED에서 startProgress() 거부

- Given: startProgress()와 resolve()를 차례로 호출하여 상태가 RESOLVED인 Ticket
- When: startProgress()를 호출
- Then:
  - 발생해야 하는 결과 또는 예외: 잘못된 상태 전이(IllegalStateException)가 발생한다.
  - 행동 후 Ticket 상태: RESOLVED
- 보호하려는 규칙: RESOLVED Ticket은 다시 처리를 시작할 수 없다.

### 시나리오 9-B — RESOLVED에서 resolve() 재호출 거부

- Given: startProgress()와 resolve()를 차례로 호출하여 상태가 RESOLVED인 Ticket
- When: resolve()를 다시 호출
- Then:
  - 발생해야 하는 결과 또는 예외: 잘못된 상태 전이(IllegalStateException)가 발생한다.
  - 행동 후 Ticket 상태: RESOLVED
- 보호하려는 규칙: RESOLVED Ticket은 다시 해결할 수 없다.

---

## JUnit 핵심 개념을 자신의 말로 설명

1. Maven Surefire, JUnit Platform, Jupiter는 각각 어떤 역할을 담당하는가?
-> Maven Surefire는 Maven의 test 단계에서 테스트 클래스를 탐색하고 실행하는 플러그인이다.
JUnit Platform은 Surefire 같은 실행 도구와 JUnit 테스트 엔진을 연결하고 테스트 실행을 조정하는 기반이다.
Jupiter는 @Test, 생명주기 애너테이션, Assertion 같은 테스트 작성 API와 해당 테스트를 실행하는 Jupiter 엔진을 제공한다.

2. mvnw.cmd test가 BUILD SUCCESS였지만 실행된 테스트가 0개라면 무엇이 검증됐고 무엇은 검증되지 않았는가?
-> 실행된 테스트가 0개라면 프로젝트의 빌드 구성과 코드의 컴파일 상태만 검증되었고, 실제 비즈니스 로직의 정상 작동 여부는 전혀 검증되지 않았다. 비즈니스 로직이 무결한지, 잠재적 버그 또는 엣지 케이스에서 예상하지 못한 동작이 있는지 검증되지 않았다.
또한 회귀를 자동으로 조기에 탐지하고, 문제가 있는 변경의 병합이나 배포를 막는 검증 체계도 아직 마련되지 않았다.

3. OPEN Ticket에서 resolve()를 호출하는 테스트가 assertThrows()뿐 아니라 이후 상태를 assertEquals(OPEN, ...)로 확인해야 하는 이유는 무엇인가?
-> assertThrows()는 예외가 발생하는지만 확인할 뿐, 예외 발생 직전이나 직후에 객체의 상태가 안전하게 유지되었는지 여부는 검증하지 못하기 때문이다.
