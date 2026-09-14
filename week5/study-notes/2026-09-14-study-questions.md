# 2026-09-14 — Week 5 지연 회상과 Event Loop 입문

> 날짜: 2026-09-14
> 상태: Session Paused — Week 4 회상 통과, Event Loop 기본 순서 교정 중
> 실제 소요 시간: `NOT_RECORDED`
> 실행 근거: Browser Console·Node 모두 `NOT_RUN`

## 날짜 경계

9월 14일에는 Week 4 지연 회상과 Event Loop 입문 문답을 진행했다. Timer 기본 Case의 출력 순서는 맞혔지만 Timer 등록과 Callback 실행 시점을 혼동했고, Promise Microtask가 현재 Script의 동기 Code보다 먼저 실행된다고 잘못 예상했다.

Microtask 교정 뒤 제시한 확인 문제에는 날짜가 바뀌기 전 답하지 못했다. 따라서 Event Loop 학습은 완료로 판정하지 않고 나머지 예상·실행·정리를 9월 15일 야간으로 옮긴다.

## Week 4 지연 회상

### 1. Session 인증 복원

사용자는 다음 흐름을 설명했다.

```text
Browser
→ Cookie에 담긴 Session ID 전송

Server
→ 해당 ID로 Session 저장소 탐색
→ 그 안의 사용자 정보를 꺼냄
→ 현재 Request의 Context에 복원
```

핵심 방향은 맞았지만 구체적인 Spring Security 객체 이름을 다음처럼 교정했다.

```text
Browser Cookie의 JSESSIONID
→ HttpSession 탐색
→ SecurityContext 조회
→ 현재 Request의 SecurityContextHolder에 복원

HttpSession
└─ SecurityContext
   └─ Authentication
```

Browser가 보관하는 것은 `SecurityContext`가 아니라 Session ID Cookie다. `Authentication`에는 인증된 사용자 식별 정보와 Authority가 들어 있다.

### 2. 두 `403`의 구분

사용자의 답변:

```text
인증된 USER가 AGENT 전용 Ticket 조회
→ 인가 없음

인증된 USER가 CSRF Token 없이 Ticket 생성
→ CSRF Token 없음
```

이를 실행 단계의 용어로 정리하면 다음과 같다.

```text
AGENT 전용 조회
→ Role 조건 불충족
→ Authorization DENY
→ 403

Token 없는 상태 변경 요청
→ CSRF 검증 실패
→ 403
```

### 3. Test와 Log 점검의 차이

사용자의 답변:

> 보안 기능이 동작한다는 것과 비밀값이 Log에 출력된다는 것은 다른 문제이기 때문에 별도로 검증이 필요합니다.

기능 Test가 응답 Status와 인증·인가 동작을 검증하더라도 모든 Log 내용을 자동으로 검사한다고 볼 수 없다. 따라서 기능 회귀와 민감 값 Log Pattern 점검은 서로 다른 근거로 유지한다.

판정: `PASS_AFTER_CORRECTION`

## Event Loop 입문

### 1. Timer 기본 Case

제시한 Code:

```javascript
console.log("A");

setTimeout(() => {
    console.log("B");
}, 0);

console.log("C");
```

사용자는 최종 출력 `A → C → B`를 맞혔고 `B` Callback이 다음 Task에서 기다린다고 구분했다. 다만 `setTimeout` 호출 자체가 다음 Loop에서 호출된다고 설명했다.

교정:

```text
setTimeout(...) 호출
→ 현재 Script에서 동기적으로 실행되어 Timer 등록

전달한 Callback
→ Timer 조건을 만족한 뒤 나중 Task에서 실행
```

판정: `PARTIAL` — 출력 순서는 맞혔지만 등록과 Callback 실행의 구분을 독립적으로 다시 설명하지 않음

### 2. Promise Microtask 기본 Case

제시한 Code:

```javascript
console.log("A");

setTimeout(() => {
    console.log("B");
}, 0);

Promise.resolve().then(() => {
    console.log("C");
});

console.log("D");
```

사용자는 Microtask Queue의 `C`와 다음 Task의 `B`는 올바르게 분류했다. 그러나 동기 실행 종료 시 이미 출력된 값을 `A`만으로 보았고 최종 순서를 `A → C → D → B`로 예상했다.

교정한 실행 순서:

```text
현재 Script의 동기 Code
→ A 출력
→ Timer 등록
→ Promise Handler를 Microtask로 예약
→ D 출력

현재 Script 종료 뒤 Microtask
→ C 출력

다음 Timer Task
→ B 출력

최종: A → D → C → B
```

핵심 교정 문장:

> Microtask는 현재 동기 Code보다 먼저가 아니라, 현재 동기 Code가 모두 끝난 뒤 다음 Task보다 먼저 실행된다.

판정: `REVIEW_REQUIRED` — 정답 설명 뒤 새로운 Case에서 독립 확인하지 않음

### 3. 답하지 못한 확인 문제

```javascript
console.log("X");

queueMicrotask(() => {
    console.log("Y");
});

console.log("Z");
```

다음 세 항목은 9월 15일에 자료를 보지 않고 먼저 답한다.

```text
현재 Script에서 즉시 출력되는 값:
Script가 끝난 뒤 실행되는 값:
최종 출력 순서:
```

## 9월 14일 미실시 범위

- Event Loop 입문 문서 전체 학습: 완료 여부 미확인
- 단순 Microtask Case의 독립 재설명: `NOT_RUN`
- Promise Executor와 `async`·`await` 입문 Case: `NOT_RUN`
- Browser Console에서 기본 Case 실행: `NOT_RUN`
- Node에서 같은 기본 Case 실행: `NOT_RUN`
- 예상과 실제 차이에 대한 사용자 최종 요약: `NOT_RUN`

## 9월 15일 이월 Gate

1. Timer 등록과 Callback 실행 시점을 구분한다.
2. 현재 동기 Code, Microtask와 다음 Task의 순서를 자료 없이 설명한다.
3. 미응답 `X·Y·Z` Case와 Promise 기본 Case를 다시 예상한다.
4. Browser Console과 Node에서 실행한 뒤 예상과 실제를 기록한다.
5. 틀린 경우 정답만 바꾸지 않고 어느 Code를 잘못 분류했는지 설명한다.

9월 15일 야간 최대 90분 안에 이 Gate를 먼저 처리한다. 중첩 Microtask와 Main Thread Blocking은 기본 순서 교정 뒤 9월 16일에 진행한다.

## 근거 경계

- 이 문서는 9월 14일 대화에서 확인된 답변과 교정 내용을 기록한다.
- 교정 설명을 제공한 것은 사용자가 같은 내용을 독립적으로 다시 설명했다는 근거가 아니다.
- Browser와 Node 실행을 하지 않았으므로 실제 Runtime 출력 근거는 아직 없다.
- Week 4 지연 회상 통과를 Week 5 Event Loop 학습 완료로 확장하지 않는다.
