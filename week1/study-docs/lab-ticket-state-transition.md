# Lab Report — Ticket 상태 전이와 캡슐화 반례

> 작성일: 2026-08-19
> 후속 검증일: 2026-08-20
> 주차: Week 1
> 과정 영역: 객체지향
> 상태: Completed — JShell 수동 및 JUnit 자동 검증

## 한눈에 보기

- 질문: 필드가 `private`이어도 범용 Setter가 있으면 Ticket의 상태 전이 규칙과 불변조건이 깨지는가?
- 예상: 의도가 드러나는 행동을 제공하는 `Ticket`은 잘못된 전이를 거부하지만, `UnsafeTicket`은 `OPEN → RESOLVED` 직접 변경과 `null` 대입을 허용할 것이다.
- 관찰: JShell에서 예상한 예외와 정상 전이를 확인했으며, 실패 후 `Ticket`의 기존 상태가 보존되었다. `UnsafeTicket`에서는 잘못된 상태 변경이 그대로 허용되었다. 이후 같은 Ticket 규칙을 JUnit Test 10개로 자동 검증했다.
- 결론: `private`은 외부의 직접 필드 접근만 제한한다. 객체의 규칙을 보호하려면 변경 인터페이스 자체가 허용된 행동과 검증을 표현해야 한다.

## 학습 배경

캡슐화를 단순히 모든 필드를 `private`으로 만드는 것으로 이해해도 되는지, 그리고 상태 전이 규칙을 Ticket과 Service 중 어디에서 지켜야 하는지 확인하기 위해 실험했다.

관련 개념은 [캡슐화, 불변조건, 상태 전이 학습 노트](./learning-encapsulation-and-invariants.md)에 정리했다.

## 범위

### 포함

- Ticket 생성 시 제목 검증과 초기 상태 확인
- `OPEN → IN_PROGRESS → RESOLVED` 정상 전이
- 허용되지 않은 상태 전이 거부와 실패 후 상태 보존
- 범용 Setter가 있는 `UnsafeTicket` 반례

### 포함하지 않음

- 사용자 인증과 권한 검증
- Repository, Database와 트랜잭션
- 동시성 상황의 상태 전이

## 예상과 실패 조건

| Case | 입력·조건 | 예상 결과 | 실패로 볼 조건 |
|---|---|---|---|
| 정상 전이 | `OPEN`에서 `startProgress()`, 이어서 `resolve()` | `IN_PROGRESS`, `RESOLVED` 순서로 변경 | 순서가 다르거나 예외 발생 |
| 잘못된 전이 | `OPEN`에서 바로 `resolve()` | `IllegalStateException`, 상태는 `OPEN` 유지 | 상태가 변경되거나 예외가 없음 |
| 완료 후 재시작 | `RESOLVED`에서 `startProgress()` | `IllegalStateException`, 상태는 `RESOLVED` 유지 | 상태가 변경되거나 예외가 없음 |
| 잘못된 제목 | 공백 또는 `null` 제목으로 생성 | `IllegalArgumentException` | 객체가 생성됨 |
| Setter 반례 | `UnsafeTicket`에 `RESOLVED`, 이어서 `null` 대입 | 두 값이 모두 그대로 저장됨 | 대입이 거부됨 |

## 환경

| 항목 | 실제 값 |
|---|---|
| OS·Shell | Windows, PowerShell |
| Language·Runtime | Java 25.0.4, Temurin OpenJDK 25.0.4 LTS |
| 도구 | JShell 25.0.4 |
| Test Framework | 사용하지 않음 — JUnit 미실행 |
| Source 기준 | 이 문서의 최소 재현 코드 |

## 방법

1. PowerShell에서 `jshell`을 실행했다.
2. `TicketStatus`와 `Ticket`을 정의했다.
3. 정상 전이와 허용되지 않은 전이를 차례로 실행했다.
4. 예외 발생 후 `status()`를 다시 호출해 기존 상태가 보존되는지 확인했다.
5. 공백 및 `null` 제목으로 생성을 시도했다.
6. `UnsafeTicket`을 별도로 정의하고 범용 Setter로 잘못된 상태를 직접 대입했다.

## 최소 구현·Fixture

```java
enum TicketStatus {
    OPEN, IN_PROGRESS, RESOLVED
}

class Ticket {
    private final String title;
    private TicketStatus status = TicketStatus.OPEN;

    Ticket(String title) {
        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException(
                "title must not be blank"
            );
        }

        this.title = title;
    }

    void startProgress() {
        if (status != TicketStatus.OPEN) {
            throw new IllegalStateException(
                "only OPEN ticket can start progress"
            );
        }

        status = TicketStatus.IN_PROGRESS;
    }

    void resolve() {
        if (status != TicketStatus.IN_PROGRESS) {
            throw new IllegalStateException(
                "only IN_PROGRESS ticket can be resolved"
            );
        }

        status = TicketStatus.RESOLVED;
    }

    TicketStatus status() {
        return status;
    }
}
```

## 실행 절차

```java
var ticket = new Ticket("로그인 오류")
ticket.status()
ticket.resolve()
ticket.status()
ticket.startProgress()
ticket.status()
ticket.resolve()
ticket.status()
ticket.startProgress()
ticket.status()
new Ticket("   ")
new Ticket(null)
```

## 결과

| Case | 실제 결과 | 근거 | 예상과 일치 |
|---|---|---|---|
| Ticket 생성 | `OPEN` | `ticket.status()` 반환값 | Yes |
| `OPEN`에서 `resolve()` | `IllegalStateException`: `only IN_PROGRESS ticket can be resolved` | JShell 예외와 이후 `OPEN` 상태 | Yes |
| `OPEN → IN_PROGRESS` | `startProgress()` 후 `IN_PROGRESS` | `ticket.status()` 반환값 | Yes |
| `IN_PROGRESS → RESOLVED` | `resolve()` 후 `RESOLVED` | `ticket.status()` 반환값 | Yes |
| 완료 후 `startProgress()` | `IllegalStateException`: `only OPEN ticket can start progress` | JShell 예외와 이후 `RESOLVED` 상태 | Yes |
| 공백·`null` 제목 | `IllegalArgumentException`: `title must not be blank` | JShell 예외 | Yes |

이 코드에서는 생성자가 정상적으로 완료된 모든 Ticket의 초기 상태가 `OPEN`이 되도록 필드 초기값으로 정의했다. 이번 실행에서는 생성한 한 객체가 실제로 `OPEN`인지 확인했다.

상태를 변경하기 전에 조건을 검사하므로 검증이 실패하면 대입문까지 실행되지 않는다. 그 결과 실패 후에도 기존 상태가 보존되었다.

## 안전하지 않은 Ticket 반례

캡슐화 문제를 명확하게 드러내기 위해 외부에서 호출 가능한 범용 Setter를 가진 반례를 사용했다.

```java
class UnsafeTicket {
    private TicketStatus status = TicketStatus.OPEN;

    public void setStatus(TicketStatus status) {
        this.status = status;
    }

    TicketStatus status() {
        return status;
    }
}
```

```java
var unsafeTicket = new UnsafeTicket()
unsafeTicket.status()
unsafeTicket.setStatus(TicketStatus.RESOLVED)
unsafeTicket.status()
unsafeTicket.setStatus(null)
unsafeTicket.status()
```

### 반례 재현 결과

| 실험 | 실제 결과 | 의미 |
|---|---|---|
| 최초 상태 확인 | `OPEN` | 필드 초기값이 적용됨 |
| `OPEN → RESOLVED` 직접 변경 | `RESOLVED` 저장 | 상태 전이 규칙을 검사하지 않음 |
| `setStatus(null)` | 호출 성공 | `status != null` 불변조건을 검사하지 않음 |
| 변경 후 상태 확인 | `null` | 객체가 유효하지 않은 상태로 남음 |

`setStatus(TicketStatus)`에는 Java 타입 검사 때문에 임의의 문자열을 직접 전달할 수 없다. 그러나 `null`과 현재 상태에서 허용되지 않는 다른 `TicketStatus` 값은 전달할 수 있으므로 null 검사만으로는 상태 전이 규칙을 보호할 수 없다.

## Ticket과 UnsafeTicket 비교

| 구분 | `Ticket` | `UnsafeTicket` |
|---|---|---|
| 필드 접근 | `private` | `private` |
| 변경 인터페이스 | `startProgress()`, `resolve()` | `setStatus()` |
| 의도 표현 | 상태 변경의 이유가 드러남 | 값 대입만 드러남 |
| 상태 전이 검증 | 있음 | 없음 |
| `null` 대입 | 제공된 상태 변경 API 경로에서는 불가 | 허용됨 |
| 잘못된 요청의 결과 | 예외 발생 후 기존 상태 보존 | 검증 없이 잘못된 상태 저장 |

## 예상과 달랐던 점

도메인 동작에 대한 관찰은 예상과 일치했다. 실행 과정에서는 PowerShell 문법인 `Test-Path`를 JShell에 입력했을 때 Java 문법으로 해석되어 오류가 발생했다. 또한 두 Java 표현식을 구분 없이 한 번에 입력했을 때 `';' expected` 오류가 발생했다. 명령을 각각 올바른 실행 환경과 입력 단위로 다시 실행해 상태 전이 결과를 확인했다.

이 오류들은 Ticket의 도메인 규칙이 실패한 것이 아니라 Shell별 문법과 JShell 입력 단위를 혼동한 결과였다.

## 원리 설명

`Ticket`은 상태를 변경하기 전에 현재 상태가 동작의 사전조건을 만족하는지 검사한다. 조건을 만족하지 않으면 예외를 던져 대입문이 실행되지 않으므로 상태가 보존된다.

`UnsafeTicket`은 필드가 `private`이지만 `setStatus()`가 전달받은 값을 검증하지 않고 대입한다. 따라서 필드 접근 제한만으로는 상태 전이 규칙이나 `status != null` 불변조건을 보호할 수 없다.

## Test와 검증

| 검증 | 대상 위험 | 결과 | 링크·근거 |
|---|---|---|---|
| JShell 수동 검증 | 잘못된 전이 허용, 실패 후 상태 변경 | Pass | [결과](#결과) |
| JShell 반례 검증 | 범용 Setter를 통한 규칙 우회와 `null` 대입 | Pass | [반례 재현 결과](#반례-재현-결과) |
| JUnit 자동 검증 | 회귀 시 생성·상태 전이 규칙이 깨지는 위험 | Pass | `.\mvnw.cmd clean test`: 10개 통과, `Failures: 0`, `Errors: 0`, `Skipped: 0` |

JUnit 기준선은 `cdcbee0`, 서로 다른 대표 Exception Message 3개 검증은 `944aede` Commit에 기록했다. `Pass`는 현재 단일 Ticket Domain에 작성한 정상·경계·거부 규칙이 수동 실험과 자동 Test에서 예상대로 관찰됐다는 뜻이다. 동시성, 영속화, 권한과 비범위 기능의 정확성을 의미하지 않는다.

## 선택적 적용

- Helpdesk Lab에 적용 여부: 적용 완료
- 적용 범위: Ticket 생성 규칙, 정상 상태 전이, 잘못된 전이 거부와 실패 후 상태 보존
- 자동 검증 범위: 정상 3개, 제목 경계 3개, 거부 전이 4개와 대표 Exception Message 3개

## 설명 가능성 점검

- AI 도움 없이 설명할 수 있는 흐름: Ticket 생성, 정상 전이, 잘못된 전이 거부와 실패 후 상태 보존
- 직접 수행한 작은 변경: `UnsafeTicket` 반례 실행, Ticket JUnit Test 작성과 대표 Exception Message 검증
- 후속 설명 가능 범위: `assertThrows()`가 반환한 예외 객체로 Message를 확인하고, 별도 Assertion으로 실패 후 상태를 검증하는 이유
- Self Review 질문: 상태 전이 검증과 사용자 권한 검증을 각각 어디에서 담당해야 하는가?

## AI 활용

| 작업 | AI 역할 | 직접 판단·수정·검증한 내용 |
|---|---|---|
| 개념 학습 | 캡슐화, 불변조건과 책임 분리 설명 보조 | 자신의 말로 정의와 확인 질문의 답 작성 |
| 실험 설계 | Ticket과 UnsafeTicket 예제 및 실행 순서 제안 | 로컬 JShell에서 직접 입력하고 결과 확인 |
| JUnit 실습 | 정상·경계·거부 Case와 대표 Message 검증 방법 제안 | Test 10개를 직접 작성·실행하고 `exception cannot be resolved` 오류 수정 |
| 문서 검토 | 과도한 표현, 용어와 증거 구분 검토 | 실제 실행 결과와 자동 검증의 한계를 확인 |

AI 대화 원문이나 민감한 환경 정보는 문서에 포함하지 않았다.

## 한계와 다음 질문

- 현재 결론이 유효한 조건: 이 문서와 AI Helpdesk Learning Lab에 정의된 단일 Ticket Domain
- 확인하지 않은 조건: 동시성, 영속화, 권한 검증과 여러 프로세스의 변경
- 다음 실험: 구체적인 변경 요구를 정한 뒤 분기와 Polymorphism·Composition 구조의 변경 영향을 비교한다.
- 조건부 후속: 새로운 상태 전이 요구가 생기면 실패 Test를 먼저 추가해 기존 규칙과 변경 범위를 확인한다.

## 재현 방법

### JShell 수동 검증

1. JDK 25가 설치된 PowerShell에서 `jshell`을 실행한다.
2. 이 문서의 `TicketStatus`, `Ticket`과 `UnsafeTicket`을 차례로 입력한다.
3. 실행 절차의 명령을 한 줄씩 입력한다.
4. 결과 표와 같은 상태 및 예외 유형·메시지가 나타나는지 확인한다.
5. `/exit`를 입력해 JShell을 종료한다.

### JUnit 자동 검증

1. AI Helpdesk Learning Lab의 Project Root에서 새 PowerShell을 연다.
2. `.\mvnw.cmd clean test`를 실행한다.
3. JDK 25로 Main·Test Source가 Compile되는지 확인한다.
4. `Tests run: 10`, 실패·오류·건너뜀 0개와 `BUILD SUCCESS`를 확인한다.

## 참고 자료

- [Oracle JDK 25 — Introduction to JShell](https://docs.oracle.com/en/java/javase/25/jshell/introduction-jshell.html)
- [JUnit User Guide](https://docs.junit.org/current/user-guide/)
