# Week 1 WIL — private 필드에서 객체 책임과 검증 가능한 계약으로

> 기간: 2026-08-18 ~ 2026-08-22
> 상태: Completed
> 문서 상태: 게시·제출 완료 — 2026-08-24 후속 복습 반영, 블로그 게시 및 정글 LMS 링크 제출
> 핵심 질문: Framework 없이 객체가 자신의 상태와 규칙을 지키게 만들고, 그 계약을 Test로 설명할 수 있는가?

## 이번 주 요약

큰 AgentOps 제품을 구현하려던 계획을 중단하고 Java 객체지향과 JUnit을 설명·수정·검증할 수 있는 작은 AI Helpdesk Learning Lab으로 범위를 전환했다. Ticket이 제목과 상태 전이 규칙을 직접 보호하도록 구현하고 정상·경계·거부 Case를 JUnit으로 검증했다. 같은 VIP 정책을 조건문과 Strategy 구조에 적용하여 변경이 일어나는 위치와 추상화 비용을 비교했다. 8월 22일 새 배송비 사례에서는 다형성과 Composition의 독립 설명에 공백이 드러났지만, 8월 24일 후속 복습에서 선언 Type과 실제 객체, Method 호출 시점의 동적 바인딩, Composition의 보유·위임, Strategy에서의 다형성, DI와 DIP를 새로운 사례로 구분하여 설명했다.

## 시작점

- 알고 있다고 생각한 내용: Class와 Object, `private` 접근 제어자와 Service 중심 상태 변경 검증
- 예상한 결과: 모든 필드를 `private`으로 만들고 Service에서 상태를 검사하면 객체의 상태를 충분히 보호할 수 있다고 생각했다.
- 가장 불확실했던 부분: Exception 발생과 상태 보존의 관계, JUnit Test가 검증하는 계약, Polymorphism·Composition·DIP·DI의 코드상 위치
- 이번 주 비범위: Spring Boot, Database, Browser UI, LLM 연동과 AgentOps Lab 구현

## 계획 대비 결과

| 목표 | 계획 | 실제 결과 | 상태 | 근거 |
|---|---|---|---|---|
| 학습 우선 범위로 전환 | 제품 구현 대신 작은 공통 Lab 선택 | AgentOps Lab을 보류하고 AI Helpdesk Learning Lab으로 전환 | Completed | [학습 우선 범위 전환 Decision](../plan/decisions/0001-learning-first-scope.md) |
| Ticket이 자신의 규칙 보호 | Encapsulation·불변조건·상태 전이 학습 | 범용 Setter 없이 생성 규칙과 허용 상태 전이를 Ticket 내부에서 검사 | Completed | [Encapsulation과 불변조건](./study-docs/learning-encapsulation-and-invariants.md), [Ticket 상태 전이 Lab](./lab-ticket-state-transition.md) |
| JUnit으로 계약 검증 | 정상·경계·거부 Test 작성 | Ticket Test 10개와 대표 Exception Message 3개 검증 | Completed | [JUnit과 Unit Test 설계](./study-docs/learning-junit-and-unit-test-design.md), [8월 20일 학습 점검](./study-notes/2026-08-20-study-questions.md) |
| 조건문과 Strategy 비교 | 같은 변경 요구의 Diff 관찰 | NORMAL·URGENT 기준선에 VIP를 추가하고 두 구조의 변경 범위 비교 | Completed | [Polymorphism·Composition과 SOLID](./study-docs/learning-polymorphism-composition-and-solid.md), [8월 21일 학습 점검](./study-notes/2026-08-21-study-questions.md) |
| 새 사례에 개념 전이 | 코드를 보지 않고 흐름과 선택 설명 | 8월 24일 배송비 Policy 사례에서 선언 Type·실제 객체·동적 바인딩, Composition·Strategy와 DI·DIP를 구분해 설명 | Completed | [8월 22일 종합 복습](./study-notes/2026-08-22-study-questions.md), 이 문서의 8월 24일 후속 복습 |
| Git 운영 Baseline 점검 | 상태·Diff·복구 대상 구분 | 작은 Commit과 상태 확인은 적용했지만 `diff --staged`와 복구 명령 설명 점검은 남음 | Partially Completed | [Git 운영 Baseline](./study-docs/learning-git-operational-baseline.md) |

## 핵심 학습

### 객체가 규칙을 보호한다

- 질문: 필드가 `private`이면 Encapsulation이 완성되는가?
- 최소 실험: 상태를 자유롭게 바꾸는 `UnsafeTicket`과 의도가 드러나는 `startProgress()`·`resolve()`를 가진 Ticket을 JShell에서 비교했다.
- 관찰: `private` 필드라도 범용 Setter가 `null`이나 허용되지 않은 상태 전이를 받아들이면 외부가 객체를 잘못된 상태로 만들 수 있었다.
- 원리 설명: Encapsulation은 상태를 숨기는 데서 끝나지 않고, 객체가 제한된 행동을 통해 자신의 불변조건과 현재 비즈니스 규칙을 보호하게 하는 것이다.
- 사용하지 않을 조건: 사용자 권한처럼 현재 사용자와 소유 관계 등 객체 외부 정보가 필요한 판단까지 Ticket 내부에 넣지 않는다.

### Exception과 Test가 서로 다른 계약을 드러낸다

- 질문: 잘못된 상태 전이가 예외로 거부되면 객체 상태도 안전하다고 볼 수 있는가?
- 최소 실험: 잘못된 전이에서 `assertThrows()`로 Exception Type을 확인하고, 이어서 `assertEquals()`로 호출 전 상태가 유지되는지 검증했다.
- 관찰: 예외는 이미 변경된 메모리를 자동으로 복구하지 않는다. 현재 Ticket은 상태 대입 전에 조건을 검사하므로 실패 후 상태가 유지된다.
- 원리 설명: “실패를 올바른 Type으로 알렸다”와 “실패 후에도 객체가 안전한 상태를 유지했다”는 서로 다른 계약이다.
- 사용하지 않을 조건: Test 개수나 `BUILD SUCCESS`만으로 비범위 기능이나 실제 제품 동작까지 검증됐다고 주장하지 않는다.

### 조건문과 Strategy의 변경 비용을 비교한다

- 질문: 새로운 VIP 정책을 추가할 때 조건문과 Strategy는 각각 어떤 변경을 요구하는가?
- 최소 실험: NORMAL·URGENT 기준선에 VIP 1시간 정책을 두 구조로 차례대로 추가했다.
- 관찰: `TicketPriority`에 VIP만 추가하자 기존 `switch` 표현식이 모든 enum 값을 처리하지 못해 Test 실행 전에 컴파일에 실패했다. 조건문 방식은 기존 분기를 수정했고, Strategy 방식은 새 구현체를 추가하면서 기존 Calculator를 유지했다.
- 원리 설명: OCP는 기존 코드를 절대 수정하지 않는다는 뜻이 아니라, 예상되는 변경이 안정된 핵심 코드로 퍼지는 범위를 통제하는 원칙이다.
- 사용하지 않을 조건: 정책이 적고 계산이 단순하며 분기가 한곳뿐이라면 Strategy의 추가 Interface와 Class보다 `switch`가 더 경제적일 수 있다.

### 8월 24일 후속 복습에서 개념을 새 사례로 전이한다

- 질문: 배송비 Policy 사례에서 선언 Type, 실제 객체, Composition, 동적 바인딩, DI와 DIP를 서로 구분할 수 있는가?
- 첫 설명에서 확인된 공백: 동적 바인딩을 Interface Type과 외부 주입에만 연결했고, Strategy에서 다형성과 Composition이 함께 작동하는 지점을 완성하지 못했다.
- 보완 후 설명: 컴파일 시점에는 선언 Type의 Method 계약을 확인하고, 호출 시점에는 Runtime 실제 객체의 Override 구현이 선택된다. 이 동작은 DI 유무와 무관하다.
- Composition 설명: `CheckoutService`는 `ShippingFeePolicy` 참조를 Field로 보유하고 Constructor로 전달받은 협력 객체에 `calculate()` 처리를 위임한다. `final`은 객체 전체의 불변성을 보장하는 것이 아니라 Field 참조의 재대입을 제한한다.
- Strategy 설명: Service의 Field·Constructor·위임 구조는 유지하면서 주입하는 Policy 구현체를 교체하면, 같은 Interface 호출에서 Runtime 구현과 배송비 결과가 달라진다.
- DI·DIP 설명: 구체 `VipShippingFeePolicy`를 Constructor로 받아도 외부 전달이므로 DI이지만, Service가 구체 Type에 의존하므로 DIP는 만족하지 않는다. `ShippingFeePolicy` Abstraction에 의존할 때 두 개념을 함께 적용할 수 있다.
- 완료 판단: 새 사례의 후속 질문에서 객체 대입과 Method 호출 시점을 구분하고, 교체해도 유지되는 Service Code·위임 구조와 달라지는 Runtime 구현·결과를 도움 없이 설명했다.

## 예상과 실제의 차이

| 예상 | 실제 관찰 | 원인 해석 | 이해가 바뀐 점 |
|---|---|---|---|
| 모든 필드를 `private`으로 만들면 객체 상태가 보호된다. | 공개 Setter로 `RESOLVED`와 `null`을 직접 대입할 수 있었다. | 접근 제한과 유효한 상태 변경 규칙은 서로 다른 문제다. | 의도가 드러나는 행동과 변경 전 검증까지 Encapsulation에 포함해 생각하게 됐다. |
| 예외가 발생하면 객체도 자동으로 이전 상태로 돌아간다. | 상태를 먼저 바꾼 뒤 예외가 발생하면 변경 값이 그대로 남을 수 있다. | Java Exception은 실행 흐름을 바꾸지만 메모리를 자동 Rollback하지 않는다. | 현재 Ticket이 검증 후 변경 순서를 사용하는 이유를 상태 보존 Test와 연결했다. |
| VIP 추가 후 관련 Test에서 실패할 것이다. | enum 값만 추가한 단계에서 기존 `switch`가 완전하지 않아 컴파일에 실패했다. | Java `switch` 표현식은 가능한 값을 모두 처리해야 한다. | 변경 영향은 Test 실행뿐 아니라 Compile 단계에서도 드러날 수 있음을 확인했다. |
| Strategy라면 기존 코드는 전혀 바뀌지 않는다. | 기존 Calculator는 유지됐지만 새 구현, Test와 조립 코드는 추가됐다. | Strategy는 변경을 없애지 않고 변경 위치를 분리한다. | Pattern의 장점과 추상화 비용을 함께 비교하게 됐다. |
| DI를 사용하면 DIP도 자동으로 만족한다. | 구체 Class Type을 생성자로 전달해도 DI는 일어나지만 DIP는 만족하지 않을 수 있다. | DI는 객체 전달 방법이고 DIP는 추상화를 향한 의존 방향이다. | 객체 주입 여부와 의존 Type을 별도로 확인하게 됐다. |
| Interface Type으로 외부 주입할 때만 동적 바인딩이 일어난다. | DI가 없는 대입에서도 실제 Method 호출 시 Runtime 객체의 Override 구현이 선택됐다. | DI는 의존 객체 전달 방식이고, 동적 바인딩은 오버라이딩된 Instance Method 호출 규칙이다. | 선언 Type의 계약 확인과 Runtime 구현 선택을 서로 다른 시점으로 구분하게 됐다. |

## 선택 적용과 독립 Spike

- Helpdesk Lab에 적용한 내용: Ticket 제목 검증, 상태 전이, 실패 후 상태 보존과 JUnit Test
- 적용이 필요했던 이유: 객체가 자신의 규칙을 보호하고 Test가 그 계약을 설명하는 흐름을 하나의 Domain에서 관찰하기 위해서다.
- 독립 Spike로 분리한 내용과 이유: 응답 시간 Policy 비교는 실제 Helpdesk SLA 요구사항이 아니라 조건문과 Strategy의 변경 범위를 관찰하기 위한 독립 학습 코드로 두었다.
- 조건부 후속·선정 제외한 내용: 실제 SLA 연결, Spring, Database, 인증·권한, UI와 LLM 호출은 이번 주 질문에 필요하지 않아 시작하지 않았다.

## Test와 학습 증거

| 근거 | 확인한 위험·질문 | 결과 | Link |
|---|---|---|---|
| JShell Ticket·UnsafeTicket 실험 | `private`만으로 잘못된 상태 변경을 막을 수 있는가? | 범용 Setter의 우회와 Ticket 행동 Method의 거부를 직접 관찰 | [Ticket 상태 전이 Lab](./lab-ticket-state-transition.md) |
| Ticket Unit Test | 생성 규칙, 정상 전이와 잘못된 전이가 계약대로 동작하는가? | Test 10개 통과, 대표 Exception Message 3개와 실패 후 상태 보존 검증 | Source Commit `cdcbee0`, `944aede` |
| Policy 비교 Test | NORMAL·URGENT·VIP 정책이 두 구조에서 같은 결과를 내는가? | 조건문 Test 3개와 Strategy Test 3개 통과 | Source Commit `6fb3365`, `3eb8b29` |
| 2026-08-22 새 Terminal Clean Test | Toolchain과 전체 기준선을 다시 재현할 수 있는가? | JDK 25.0.4, Maven 3.9.16, Test 16개, 실패·오류·건너뜀 0, `BUILD SUCCESS` | [주차 안내의 검증 근거](./README.md#실제-검증-근거) |

위 결과는 Framework 없는 Ticket Domain과 독립 Policy 비교 코드의 계약을 검증한다. 실제 Helpdesk SLA, 동시성, 영속화, 사용자 권한과 비범위 기능의 정확성은 검증하지 않았다.

## 실패와 부분 완료

- 실패한 실험: VIP enum 값만 추가한 중간 단계에서 기존 `switch` 표현식이 컴파일되지 않았다. 분기를 추가하고 두 구조의 Test를 보완하여 원인을 확인했다.
- 후속 복습에서 드러난 공백: 첫 설명에서 동적 바인딩을 Interface Type과 외부 주입에만 연결했고, Strategy에서 다형성과 Composition이 함께 작동하는 지점을 완성하지 못했다. 추가 질문에서는 선언 Type과 실제 객체, 호출 시점, 보유·위임과 구현 교체를 구분하여 설명했다.
- 시간이 아니라 중요도 때문에 제외한 부분: 실제 SLA 연결과 Spring·Database·UI·LLM 기능은 Week 1 핵심 질문에 필요하지 않아 의도적으로 제외했다.
- 핵심 Gate와 분리한 미완료 범위: Git 운영 Baseline의 `diff --staged`, `restore --staged`와 `revert` 구분은 이후 실제 변경에서 짧게 재점검한다. 이 Baseline은 Week 1 핵심 학습 완료를 막지 않는다.

## 설명 가능성 점검

- AI 도움 없이 설명할 수 있는 흐름: Ticket 생성 규칙, 허용 상태 전이, 잘못된 전이의 Exception Type과 실패 후 상태 보존, List와 내부 가변 상태 노출 위험, 선언 Type과 Runtime 실제 객체의 Method 선택, Composition의 보유·위임, DI와 DIP의 차이
- 직접 수행한 작은 변경과 Test 수정: Ticket·Policy Source와 JUnit 작성, VIP 분기·Strategy 추가, Maven 실행, 컴파일 오류 수정과 Diff 관찰
- 동료 질문 또는 Self Review: 8월 19~22일 학습 점검 문서에서 객체 책임, Exception·Collection·JUnit과 Policy 변경 범위를 자신의 말로 답변하고 수정했다. 8월 24일에는 배송비 Policy 사례의 단계형 후속 질문으로 다형성·Composition·Strategy·DI·DIP를 다시 설명했다.
- 다음 학습 질문: 하나의 HTTP 요청에서 선언된 Web 계약과 Runtime 요청 처리 흐름을 Code·Test·Trace로 어떻게 연결할 수 있는가?

## AI 활용

| 작업 | AI가 수행한 일 | 직접 판단·수정·검증한 일 |
|---|---|---|
| 학습 | 개념 설명, 반례와 단계형 점검 질문 제안 | 답변 작성, 이해되지 않는 지점 확인과 재질문 |
| Code·Test | 최소 예제와 Test Case 초안 Review | Source와 JUnit 작성, 오류 수정, Maven 실행과 결과 확인 |
| 문서 | 구조와 표현의 기술적 오류 Review, WIL 초안 보조 | 학습 범위 결정, 답변 수정, 완료·부분 완료 범위 판단 |

AI가 작성하거나 고친 설명은 후속 질문에서 자신의 말로 다시 설명할 수 있을 때만 이해 완료로 판단한다. 대화 원문은 공개 학습 근거로 사용하지 않는다.

## 공개 기술 콘텐츠

- 작성한 Learning Note·Lab Report: Encapsulation과 불변조건, Ticket 상태 전이, Maven, JUnit, Exception, Collection, Polymorphism·Composition과 SOLID
- 기술 블로그 후보: 작은 Policy 변경 실험으로 본 조건문과 Strategy의 실제 변경 범위
- 아직 근거가 부족한 주장: Strategy가 조건문보다 항상 우수하다는 주장, 실제 Helpdesk 응답 시간 개선과 제품 품질 향상

## 회고

### 잘 작동한 학습 방식

- JShell에서 안전한 Ticket과 범용 Setter를 비교하자 `private`과 Encapsulation의 차이를 즉시 관찰할 수 있었다.
- 예외 발생과 상태 보존을 별도 Assertion으로 나누자 Test가 설명하는 계약이 분명해졌다.
- VIP라는 같은 변경을 두 구조에 적용한 뒤 Diff를 비교하자 OCP를 문구가 아니라 변경 범위로 판단할 수 있었다.

### 바꿀 학습 방식

- 개념 문서를 읽고 답을 한 번 작성한 것으로 완료하지 않고, 다른 Domain의 짧은 코드에서 같은 개념을 다시 찾는다.
- 여러 질문을 한꺼번에 풀기보다 변수 Type, 실제 객체, Method 호출, 필드 보유와 위임을 한 단계씩 확인한다.
- AI가 정리한 완성 문장보다 자신의 첫 답변과 수정 이유를 학습 근거로 남긴다.

## 다음 주

- 이어갈 핵심 질문: 하나의 HTTP 요청이 Spring의 각 Layer를 통과하는 흐름과 책임을 직접 추적할 수 있는가?
- 새로 선택할 학습 주제: 하나의 HTTP 요청이 Spring의 각 Layer를 통과하는 흐름과 책임
- 시작하지 않을 항목: PostgreSQL 영속화, 인증, Browser UI와 LLM 연동
- 첫 번째 최소 실험: HTTP Request·Response의 Method, Status와 Header를 관찰한 뒤 In-memory Ticket API의 최소 요청 흐름을 추적한다.

## 제출 전 보완 항목

- [x] 2026-08-24 월요일에 배송비 사례의 다형성·Composition을 한 질문씩 다시 설명한다.
- [x] 2026-08-24 후속 질문 결과를 완료 상태와 실패·보완 Section에 반영한다.
- [x] 공개 자료에서 Secret, 개인정보, 로컬 절대 경로, Placeholder와 깨진 Link가 없는지 확인한다.
- [x] 제출본의 상태와 다음 주 질문을 최종 확정한다.
- [x] WIL을 블로그에 게시하고 정글 LMS에 링크를 제출한다.

2026-08-24 블로그에 WIL을 게시하고 정글 LMS에 해당 링크를 제출했으므로 외부 제출 상태는 `Completed`다.

## 관련 자료

- [주간 학습 계획](./weekly-plan.md)
- [주차 안내](./README.md)
- [8월 19일 학습 점검](./study-notes/2026-08-19-study-questions.md)
- [8월 20일 학습 점검](./study-notes/2026-08-20-study-questions.md)
- [8월 21일 학습 점검](./study-notes/2026-08-21-study-questions.md)
- [8월 22일 종합 복습](./study-notes/2026-08-22-study-questions.md)
