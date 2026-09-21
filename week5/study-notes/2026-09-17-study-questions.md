# 2026-09-17 — 중첩 Microtask 재설명과 Event Loop 연장 학습

> 날짜: 2026-09-17
> 상태: Partially Completed — Event Loop·Rendering과 Promise 기본 실행 통과, `await` Runtime은 9월 18일 기록
> 실제 소요 시간: `NOT_RECORDED`
> 실행 근거: 일반 Browser Main Thread Blocking·이중 `requestAnimationFrame`, Node.js·Browser Promise 기본·실패 전달 `RUN_PASS`

## 날짜 경계

9월 16일에는 동기 Code, Microtask와 다음 Timer Task의 기본 순서를 독립적으로 설명하고 Node.js와 Browser Console에서 확인했다. 중첩 Microtask도 두 Runtime에서 `A → E → B → C → D`로 관찰했지만, `C`가 `D`보다 먼저 실행되는 이유를 Queue 처리 규칙으로 충분히 설명하지 못한 상태에서 날짜가 바뀌었다.

따라서 9월 16일 노트의 당시 판정은 `REVIEW_REQUIRED`로 보존하고, 9월 17일 첫 학습으로 재설명 결과를 기록한다.

## 중첩 Microtask 원인 재설명

사용자의 답변:

```text
B Microtask가 실행되는 동안
→ C Callback이 Microtask Queue에 추가된다.

Event Loop는
→ 그 Queue가 종료될 때까지 처리한다.

따라서
→ 다음 Timer Task의 D보다 C가 먼저 실행된다.
```

Callback이 들어가는 Queue와 `C`·`D`의 실행 순서를 올바르게 연결했다. 다만 Queue 자체가 “종료”되는 것은 아니므로 다음처럼 용어를 교정한다.

```text
현재 Task의 동기 Code 종료
→ Microtask Checkpoint 시작
→ B 실행
→ B 실행 중 C를 Microtask Queue에 추가
→ Microtask Queue가 빌 때까지 계속 처리
→ C 실행
→ 다음 Timer Task를 선택
→ D 실행
```

판정: `PASS_AFTER_TERMINOLOGY_CORRECTION`

- `B`와 `C`가 같은 Microtask Checkpoint에서 실행되는 이유를 설명했다.
- `C`가 `D`보다 늦게 등록됐더라도 Microtask Queue 소진이 다음 Task 선택보다 먼저라는 규칙을 연결했다.
- “Queue 종료”는 “Queue가 빌 때까지 처리”로 교정했다.

## 현재 Event Loop 판정

| 항목 | 판정 | 근거 날짜 |
|---|---|---|
| 단순 Task·Microtask·Timer 순서 | `PASS` | 9월 16일 예상·Node.js·Browser Console |
| 중첩 Microtask 출력 예상 | `PASS_AFTER_CORRECTION` | 9월 16일 |
| 중첩 Microtask Runtime 실행 | `RUN_PASS` | 9월 16일 Node.js·Browser Console |
| 중첩 Microtask 원인 설명 | `PASS_AFTER_TERMINOLOGY_CORRECTION` | 9월 17일 독립 재설명 |
| Main Thread Blocking 기본 Case | `RUN_PASS` | 9월 17일 일반 Browser 시각 관찰 |
| 이중 `requestAnimationFrame`·Performance Marker | `RUN_PASS` | 9월 17일 일반 Browser 시각 관찰·측정 |

중첩 Microtask까지의 Event Loop 실행 순서 Gate는 통과했다. 다음 단계는 긴 동기 Code가 Main Thread를 점유할 때 Timer, 사용자 입력과 Rendering 기회가 왜 지연되는지 확인하는 것이다.

## 다음 학습

1. 짧은 동기 Code와 약 0.5초 동기 Blocking Code를 비교한다.
2. DOM 변경과 실제 Paint가 같은 시점이 아님을 예측한다.
3. `requestAnimationFrame`과 Performance Marker로 Rendering 기회를 관찰한다.
4. 실행 결과를 보기 전에 출력 순서와 화면 변화부터 예상한다.

## Main Thread Blocking — 실행 전 예상

제시한 Click Handler의 핵심 Code:

```javascript
statusElement.textContent = "작업 중";

const startedAt = performance.now();

while (performance.now() - startedAt < 500) {
    // 약 0.5초 동안 Main Thread 점유
}

statusElement.textContent = "완료";
```

사용자의 최초 예상:

```text
첫 번째 대입 직후 DOM에 저장된 문자열: 작업 중
0.5초 반복문 동안 사용자가 화면에서 볼 문자열: 완료
반복문 동안 다른 Click Event를 즉시 처리할 수 있는가: 아니요
Task가 끝난 뒤 화면에 표시될 가능성이 높은 문자열: 완료
DOM 값 변경과 실제 화면 Paint가 같은 순간인가: 아니요
```

첫 번째 대입 직후 DOM 값, 다른 Click 처리 불가, Task 종료 뒤 최종 화면과 DOM·Paint의 시점 구분은 맞았다. 반복문 도중 보이는 문자열만 교정이 필요하다.

```text
Click 전
→ 화면에는 기존 상태가 Paint되어 있음

Click Task 실행
→ DOM 값을 "작업 중"으로 변경
→ 긴 동기 반복문이 Main Thread 점유
→ Browser가 중간 화면을 Paint할 기회를 얻지 못함
→ DOM 값을 "완료"로 다시 변경

Task 종료 뒤 Rendering 기회
→ 최종 DOM 값인 "완료"를 Paint
```

따라서 반복문이 실행되는 동안 사용자가 보는 것은 새 `"완료"`가 아니라 Click 전에 이미 그려져 있던 기존 화면이다. `"작업 중"`은 DOM을 거쳤지만 두 변경이 같은 Task 안에 있고 그 사이 Main Thread를 반환하지 않았으므로 화면에 나타나지 않을 수 있다.

교정 뒤 사용자가 다시 설명한 내용:

```text
반복문 실행 중 DOM 값: 작업 중
반복문 실행 중 화면에 보이는 값: 기존 상태
"작업 중"이 화면에 보이지 않을 수 있는 이유:
작업을 처리하는 동안 DOM의 갱신이 사용자 화면에 실시간으로 반영되지 않기 때문
```

DOM 값과 화면에서 보이는 값을 분리한 설명은 맞다. 마지막 이유는 다음처럼 실행 조건을 포함해 더 구체화한다.

> 두 DOM 변경이 같은 Task 안에서 일어나고, 그 사이 긴 동기 반복문이 Main Thread를 계속 점유하므로 Browser가 `"작업 중"`을 Paint할 Rendering 기회를 얻지 못한다.

판정: `PREDICTION_PASS_AFTER_CORRECTION` — Runtime 실행은 아직 `NOT_RUN`

## Main Thread Blocking — 첫 Browser 실행

Browser의 `about:blank` Page에 Button과 상태 Element를 만든 뒤, Click Handler 안에서 약 1초 동안 동기 반복문을 실행했다.

사용자가 전달한 결과:

```text
Click 전 화면: undefined
"작업 중" 표시 여부: 보이지 않음
멈춤이 끝난 뒤 화면: 변동 없음
Console 출력:
{domDuringTask: "작업 중", finalDom: "완료", blockedMs: 1000}
Console의 finalDom: 완료
```

Console 객체는 다음 사실을 확인한다.

- 첫 번째 대입 뒤 JavaScript가 읽은 DOM 값은 `"작업 중"`이었다.
- 약 1,000ms의 동기 Blocking이 실행됐다.
- Handler 종료 전 최종 DOM 값은 `"완료"`였다.

하지만 `undefined`는 Click 전 Page 화면이 아니라 DevTools가 준비 Code를 평가한 결과다. 또한 최종 DOM 값은 `"완료"`인데 화면을 “변동 없음”으로 기록했으므로, Console 출력과 실제 Page Pixel 관찰이 섞였다.

판정:

- 동기 Blocking과 DOM 값 변화: `RUN_PASS`
- `"작업 중"` 중간 Paint 여부: `VISUAL_OBSERVATION_INCONCLUSIVE`
- 최종 `"완료"` Paint 여부: `VISUAL_OBSERVATION_INCONCLUSIVE`

Page를 직접 보이게 둔 통제된 재실행 전에는 Rendering 관찰을 완료로 판정하지 않는다.

### 첫 Page 구성 재확인

Console에서 상태를 `"대기"`로 초기화한 뒤 실제 Page를 확인했지만 사용자는 Button 외의 상태 문구를 볼 수 없다고 보고했다. 관찰 대상인 상태 Element가 사전에 보이지 않았으므로 이 구성으로는 중간 Paint와 최종 Paint를 비교할 수 없다.

판정: `SETUP_INCOMPLETE` — 상태가 명확히 보이는 Page를 다시 구성한 뒤 재실행

첫 실행은 시크릿 모드였음이 후속 답변에서 확인됐다. 상태 문구가 보이지 않은 원인은 이번 범위에서 확인하지 않았으므로 시크릿 모드의 일반적 동작이나 보안 정책 문제로 단정하지 않는다.

### 일반 Browser 재실행

같은 실험을 시크릿 모드가 아닌 일반 Browser에서 다시 실행했다. Browser 제품과 Version은 기록하지 않았다.

사용자가 관찰한 화면 변화:

```text
Click 전: 대기
Button Click
→ 약 1초 동안 새 중간 상태가 보이지 않음
→ 약 1초 뒤 바로 완료로 변경
```

앞선 Console 관찰에서는 Handler 안의 DOM 값이 `"작업 중"`을 거쳐 `"완료"`로 바뀌고 약 1,000ms 동안 Main Thread가 점유됐음을 확인했다. 일반 Browser의 시각 관찰에서는 화면이 중간 `"작업 중"`을 표시하지 않고 기존 `"대기"`에서 최종 `"완료"`로 바뀌었다.

```text
DOM:  대기 → 작업 중 → 완료
화면: 대기 ─────────→ 완료
             약 1초 Blocking
```

판정: `MAIN_THREAD_BLOCKING_BASELINE_RUN_PASS`

이 실행은 같은 Task 안의 긴 동기 Code 때문에 중간 DOM 상태를 Paint할 Rendering 기회를 얻지 못할 수 있음을 보여 준다. `requestAnimationFrame`과 Performance Marker를 사용한 비교 실행은 아직 `NOT_RUN`이다.

## 이중 `requestAnimationFrame` — 실행 전 예상

먼저 다음 실행 구조를 설명했다.

```text
Click Task
→ DOM을 "작업 중"으로 변경
→ 첫 번째 requestAnimationFrame 예약
→ Task 종료

첫 번째 Animation Frame Callback
→ 두 번째 requestAnimationFrame 예약
→ "작업 중"을 Paint할 Rendering 기회

두 번째 Animation Frame Callback
→ 약 1초 Blocking
→ DOM을 "완료"로 변경
→ Callback 종료 뒤 "완료"를 Paint할 Rendering 기회
```

사용자의 최초 예상:

```text
requestAnimationFrame을 한 번만 사용하고 그 Callback에서 바로 Blocking하면
"작업 중" 표시가 보장되는가: 아니요

두 번 사용하는 이유:
Browser가 "작업 중"을 Paint할 기회를 제공하기 위해

두 번째 Callback의 1초 Blocking 동안 화면에 보일 상태: 대기
Blocking 종료 후 화면에 보일 상태: 작업 중
```

한 번의 `requestAnimationFrame`만으로 중간 Paint를 보장할 수 없다는 점과 두 번 사용하는 목적은 맞았다. 다만 화면 상태를 한 단계씩 늦게 예상했다.

```text
첫 번째 Frame 뒤
→ "작업 중"이 Paint될 기회

두 번째 Callback의 Blocking 동안
→ 마지막으로 Paint된 "작업 중"이 화면에 남음

두 번째 Callback 종료
→ DOM 최종값 "완료"
→ 이후 Rendering 기회에서 "완료" Paint
```

교정 뒤 사용자가 다시 설명한 내용:

```text
두 번째 Callback의 1초 Blocking 동안 화면: 작업 중
Blocking이 끝나고 다음 Rendering 기회를 얻은 뒤 화면: 완료

이유:
화면은 Rendering 기회가 있어야 갱신되며,
두 번째 Callback의 1초 Blocking 동안에는 Rendering하지 못하고
작업이 끝난 뒤 Rendering할 때 완료로 바뀐다.
```

설명 방향은 맞다. 첫 번째 Animation Frame 뒤 `"작업 중"`이 이미 Paint될 기회를 얻었기 때문에, 두 번째 Callback이 Main Thread를 점유하는 동안에는 마지막으로 그려진 `"작업 중"`이 화면에 남는다. Callback이 DOM을 `"완료"`로 바꾸고 끝난 뒤 다음 Rendering 기회에서 `"완료"`가 보인다.

판정: `PREDICTION_PASS_AFTER_CORRECTION` — 이중 `requestAnimationFrame` Runtime 실행은 아직 `NOT_RUN`

## 이중 `requestAnimationFrame` — Browser 실행

> 실행 환경: 시크릿 모드가 아닌 일반 Browser, 제품·Version `NOT_RECORDED`

사용자가 전달한 실제 관찰과 측정:

```text
Click 전 화면: 대기
두 번째 Callback의 약 1초 Blocking 동안 화면: 작업 중
Blocking 종료 뒤 화면: 완료
requestAnimationFrame Callback 간격: 4.8ms
동기 Blocking: 1000.0ms
```

실행 전 교정한 예상과 실제 화면 변화가 일치했다.

```text
기본 Blocking Case 화면
→ 대기 ─────────→ 완료

이중 requestAnimationFrame Case 화면
→ 대기 → 작업 중 ─────────→ 완료
                         약 1초 Blocking
```

첫 번째 Animation Frame Callback은 두 번째 Callback을 예약하고 끝났다. 그 뒤 Browser가 `"작업 중"`을 Paint할 기회를 얻었고, 두 번째 Callback이 Main Thread를 약 1초간 점유하는 동안 마지막으로 Paint된 `"작업 중"`이 화면에 남았다. 두 번째 Callback이 DOM을 `"완료"`로 바꾸고 끝난 뒤 화면도 `"완료"`로 바뀌었다.

측정값의 의미:

- `4.8ms`: 이번 실행에서 `first-raf`와 `second-raf` Marker 사이에 측정된 시간이다.
- `1000.0ms`: 두 번째 Callback 안의 동기 반복문이 Main Thread를 점유한 시간이다.
- `4.8ms`를 Monitor 주사율, Frame의 고정 길이 또는 Paint 소요 시간이라고 해석하지 않는다.
- Performance Marker는 JavaScript 지점 사이의 시간을 기록했다. 실제 `"작업 중"` 표시 여부의 근거는 사용자의 화면 관찰이다.

판정:

- 기본 Blocking과 이중 `requestAnimationFrame` 화면 비교: `RUN_PASS`
- Performance Marker 측정: `RUN_PASS`
- 정확한 Paint 시작·종료 시각 측정: `NOT_MEASURED`

## Promise 학습 시작 전 배경지식 확인

Promise Executor와 `then` Handler의 실행 순서를 예상하는 문제를 제시했지만, 사용자는 Promise가 어떻게 동작하는지 잘 모른다고 밝혔다. 따라서 출력 순서 문제를 채점하거나 정답부터 암기하게 하지 않고 선행 개념 학습으로 전환했다.

기존 [Browser JavaScript Event Loop 입문](../study-docs/browser-javascript-event-loop-basics.md)은 Promise Callback의 Queue와 실행 시점은 설명하지만 다음 배경을 충분히 풀어 설명하지 않았다.

- 미래 결과를 나타내는 Promise 객체의 목적
- `pending`·`fulfilled`·`rejected` 상태
- Executor, `resolve`·`reject`와 `then` Handler의 서로 다른 역할
- `then`이 반환하는 새 Promise와 Chain
- Promise가 새 Thread가 아니며 동기 Blocking을 없애지 않는다는 경계

이에 [JavaScript Promise와 Async/Await 기초](../study-docs/javascript-promise-async-await-basics.md)를 추가했다.

현재 판정: `BACKGROUND_LEARNING` — 자료 작성은 이해 완료 근거가 아니며, 상태·역할 설명부터 확인한 뒤 실행 순서 문제로 돌아간다.

### 외부 검색 답변과 이해 상태

사용자는 Promise 상태·`resolve`·`then` 질문에 다음 답을 작성했으며, 두 번째와 세 번째 답은 Google 검색으로 얻었고 정확한 의미는 이해하지 못한다고 명시했다.

```text
pending:
비동기 작업의 최종 결과가 아직 결정되지 않은 상태

resolve(value):
비동기 작업을 성공적으로 완료 상태로 변경하고 value를 전달

then(handler):
Promise가 fulfilled되었을 때 실행할 Handler를 등록
```

기술 검토:

- `pending` 설명은 방향이 맞지만 외부 자료를 사용했으므로 독립 이해 근거로 판정하지 않는다.
- `resolve(value)`가 실제 비동기 작업 자체를 완료하는 것은 아니다. 일반 값을 사용하는 현재 Case에서는 이미 준비된 성공 결과를 Promise에 알리고 그 결과를 결정한다.
- `then(handler)`가 성공 Handler를 등록한다는 설명은 맞지만, “등록”은 결과가 준비되면 값을 인자로 받아 Microtask에서 실행될 Function을 연결한다는 뜻이다.
- `then`은 현재 실행을 멈추고 결과를 기다리지 않으며, 다음 Chain 단계를 나타내는 새 Promise를 즉시 반환한다.

판정: `EXTERNAL_SOURCE_ANSWER_NOT_ASSESSED`

사용자의 요청에 따라 개념 설명을 우선하고 [JavaScript Promise와 Async/Await 기초](../study-docs/javascript-promise-async-await-basics.md)에 실제 작업·`resolve`·`then`의 구분과 시간 순서 표를 보완했다.

## Event Loop·Rendering 학습 종료 상태

완료 또는 통과한 범위:

- 현재 Task·Microtask·다음 Task 기본 순서
- 중첩 Microtask의 Queue 소진
- Node.js·Browser Console 기본·중첩 Case 실행
- Main Thread Blocking에서 DOM 값과 Paint의 분리
- 기본 Blocking과 이중 `requestAnimationFrame` 화면 비교
- Performance Marker의 Callback 간격·Blocking 시간과 Paint 근거의 구분

완료로 표시하지 않는 범위:

- Promise 상태와 `resolve`·`then` 역할의 독립 재설명
- Promise Executor·Chain·실패 전달과 `async`·`await` 실행
- Fetch의 HTTP 오류·Network 오류
- CORS, UI 상태 모델과 이후 9월 17~18일 선택 범위

다음 시작점:

1. 검색 없이 `pending`, `resolve`와 `then`을 자신의 말로 다시 설명한다.
2. Promise Executor와 `then` Handler의 실행 시점을 구분한다.
3. 보류한 `A·B·C·D` 출력 순서를 예상한 뒤 Node.js와 Browser에서 실행한다.

Session 판정: `PARTIALLY_COMPLETED`

## Promise 학습 후속 확인

Promise를 결과가 나중에 들어오는 상자로 단순화하고 `resolve`와 `then`의 역할을 다시 설명했다.

사용자의 독립 답변:

```text
resolve:
만들어진 결과를 Promise에 알려주는 것

then:
나중에 실행할 일을 등록하는 것
```

판정: `BASIC_ROLE_PASS`

- `resolve`가 실제 Ticket을 만드는 작업과 Promise 결과 통지를 구분했다.
- `then`이 Handler를 지금 실행하는 것이 아니라 나중 실행할 일을 등록한다고 설명했다.
- `pending`·`fulfilled` 상태 변화와 Handler의 Microtask 실행 시점은 후속 확인이 필요하다.

### Promise 기본 상태 변화

제시한 흐름:

```javascript
const promise = new Promise((resolve) => {
    setTimeout(() => {
        resolve("ticket-1");
    }, 1000);
});

promise.then((value) => {
    console.log(value);
});
```

사용자의 독립 답변:

```text
Promise 생성 직후:
상태 pending, 결과 없음

pending 상태에서 then(handler) 호출:
Promise 상태가 fulfilled로 바뀌지 않음

resolve("ticket-1") 호출 뒤:
상태 fulfilled, 결과 "ticket-1"

then Handler가 나중에 전달받는 값:
"ticket-1"
```

판정: `BASIC_STATE_PASS`

- `then` 등록 자체가 Promise 상태를 바꾸지 않는다고 설명했다.
- 일반 값을 사용하는 현재 Case에서 `resolve(value)` 뒤 상태와 결과를 연결했다.
- 등록된 Handler가 Promise의 성공 값을 인자로 받는다고 설명했다.
- Executor와 `then` Handler의 실행 시점은 다음 Gate에서 확인한다.

### Executor와 `then` Handler 실행 시점 — 첫 예상

제시한 Code:

```javascript
console.log("A");

const promise = new Promise((resolve) => {
    console.log("B");
    resolve("ticket-1");
});

promise.then((value) => {
    console.log("C", value);
});

console.log("D");
```

사용자의 최초 예상:

```text
A: 현재 Stack
B: 현재 Stack
C: 현재 Stack
D: 현재 Stack
최종: A → B → C → D
```

`A`, Executor의 `B`와 `D`를 현재 동기 실행으로 분류한 것은 맞다. `C`만 교정이 필요하다.

```text
resolve("ticket-1")
→ Promise 결과를 fulfilled("ticket-1")로 결정
→ then Handler를 현재 Call Stack에서 직접 호출하지 않음

현재 동기 Code
→ A
→ B
→ resolve
→ then Handler 등록
→ D

현재 Task 종료 뒤 Microtask
→ C ticket-1
```

교정 뒤 사용자가 다시 설명한 내용:

```text
promise.then(...) 호출 자체:
현재 Stack에서 실행하고 C를 출력할 Handler를 등록

then에 전달한 Handler 내부:
지금 실행하지 않고 현재 Task 종료 뒤 Microtask에서 실행

최종:
A → B → D → C
```

판정: `PASS_AFTER_CORRECTION`

### Executor·`then` 기본 Case — Node.js 실행

> 실행 환경: Node.js `v22.23.2`

실제 출력:

```text
A
B
D
C ticket-1
```

예상과 실제 출력이 일치했다.

판정: `NODE_PROMISE_EXECUTOR_CASE_PASS`

Browser Console 실행은 아직 `NOT_RUN`이다.

### Executor·`then` 기본 Case — Browser Console 실행

사용자가 전달한 실제 프로그램 출력:

```text
A
B
D
C ticket-1
```

Node.js 실행과 마찬가지로 실행 전 교정한 예상과 일치했다.

사용자의 원인 설명:

```text
B가 D보다 먼저인 이유:
Promise 객체 생성 후 즉시 실행

C가 D보다 나중인 이유:
then Handler를 등록하고 다음 Stack에서 결과 결정
```

`B` 설명은 Executor가 즉시 실행된다는 의미로 맞다. `C` 설명은 다음 두 사건을 섞었다.

```text
resolve("ticket-1")
→ Promise 결과는 이미 fulfilled("ticket-1")로 결정

promise.then(handler)
→ 이미 결정된 결과를 받을 Handler 등록

현재 Task 종료
→ Microtask에서 Handler 실행
→ C ticket-1 출력
```

판정:

- Browser Runtime 출력: `RUN_PASS`
- Executor 즉시 실행 설명: `PASS_AFTER_WORDING_CORRECTION`
- `resolve` 결과 결정과 Handler 실행 시점 설명: `REVIEW_REQUIRED`

교정 뒤 사용자가 다시 설명한 내용:

```text
resolve("ticket-1") 호출:
Promise의 결과가 이미 정해짐

promise.then(handler) 호출:
이미 결정된 결과를 받을 Handler 등록

현재 Task에서 D 출력 뒤:
Microtask에서 Handler가 이미 결정된 "ticket-1"을 받아 출력
```

판정: `PROMISE_EXECUTOR_BASIC_PASS_AFTER_CORRECTION`

- Promise 결과 결정과 Handler 등록을 구분했다.
- 현재 Task의 동기 Code와 `then` Handler의 Microtask 실행을 구분했다.
- Node.js와 Browser Console에서 `A → B → D → C ticket-1`을 확인했다.
- Promise Chain, 실패 전달과 `async`·`await`는 아직 `NOT_RUN`이다.

### Promise Chain — 값 전달

제시한 Code:

```javascript
const firstPromise = Promise.resolve(2);

const secondPromise = firstPromise.then((value) => {
    return value * 3;
});

secondPromise.then((value) => {
    console.log(value);
});
```

사용자의 독립 답변:

```text
첫 번째 Handler가 받는 값: 2
첫 번째 Handler가 반환하는 값: 6
반환값이 결과가 되는 Promise: secondPromise
두 번째 Handler가 받는 값: 6
firstPromise의 결과가 2에서 6으로 바뀌는가: 아니요
```

판정: `PROMISE_CHAIN_VALUE_PASS`

- 원래 `firstPromise`의 결과와 새 `secondPromise`의 결과를 분리했다.
- Handler 반환값이 `then`이 반환한 새 Promise의 결과가 된다고 설명했다.
- Chain의 Microtask 실행 순서와 실패 전달은 아직 확인하지 않았다.

### Promise 핵심 역할 — 압축 회상

Code 전체를 외우는 대신 `확정·예약·전달` 세 단어로 역할을 압축했다.

사용자의 독립 회상:

```text
resolve는 결과를 확정하고,
then은 후속 작업을 예약하며,
Handler의 return은 값을 다음 Promise로 전달한다.
```

판정: `PROMISE_CORE_MNEMONIC_RECALL_PASS`

- `resolve`, `then`과 Handler `return`의 역할을 서로 바꾸지 않고 설명했다.
- 이 판정은 직후 회상 근거이며 장기 기억을 증명하지 않는다.
- 다음 학습 시작 시 자료 없이 같은 세 역할을 지연 회상한 뒤 Promise Chain의 실행 순서로 확장한다.

### Ticket 객체를 사용한 Chain 적용

제시한 흐름:

```javascript
const ticketPromise = Promise.resolve({
    id: 1,
    title: "로그인 오류"
});

const titlePromise = ticketPromise.then((ticket) => {
    return ticket.title;
});
```

사용자는 처음에 Ticket 객체 전체를 `titlePromise`의 결과로 답했다. Handler가 실제로 반환하는 `ticket.title`에 초점을 맞춰 교정한 뒤 다음과 같이 구분했다.

```text
ticketPromise의 결과: { id: 1, title: "로그인 오류" }
titlePromise의 결과: "로그인 오류"
```

판정: `PROMISE_CHAIN_TICKET_VALUE_PASS_AFTER_CORRECTION`

- 다음 Promise에는 이전 Promise의 결과가 자동 복사되는 것이 아니라 Handler의 반환값이 전달됨을 적용했다.
- Promise Chain의 실패 경로와 `catch`는 이 시점에는 아직 `NOT_RUN`이었다.

### Promise Chain — `throw` 실패 전달 Browser 실행

실행한 핵심 흐름:

```javascript
console.log("A");

Promise.resolve({ id: 1 })
    .then((ticket) => {
        console.log("B", ticket.id);
        throw new Error("Ticket 형식 오류");
    })
    .then(() => {
        console.log("C 저장 성공");
    })
    .catch((error) => {
        console.log("D", error.message);
    });

console.log("E");
```

사용자가 전달한 Browser Console 출력:

```text
A
E
B 1
D Ticket 형식 오류
undefined
```

관찰:

- 현재 동기 Code의 `A`, `E`가 먼저 출력됐다.
- 첫 번째 `then` Handler는 Microtask에서 `B 1`을 출력한 뒤 Exception을 발생시켰다.
- 그 Handler가 반환할 다음 Promise는 rejected가 됐고, 성공 Handler의 `C 저장 성공`은 실행되지 않았다.
- 뒤의 `catch`가 전달된 Error를 받아 `D Ticket 형식 오류`를 출력했다.
- 마지막 `undefined`는 이번 Code 평가 결과를 Console이 표시한 값이며 Promise 실패 출력이 아니다.

판정: `PROMISE_THROW_CATCH_BROWSER_RUN_PASS`

- `return → 다음 Promise fulfilled`, `throw → 다음 Promise rejected`의 실패 경로를 Browser에서 확인했다.
- `async`·`await` 변환과 `try`·`catch`는 이 시점에는 아직 `NOT_RUN`이었다.

### `async` Function의 반환값

제시한 Code:

```javascript
async function loadTitle() {
    return "로그인 오류";
}

const result = loadTitle();
```

사용자의 독립 답변:

```text
result의 종류: 성공한 Promise
result가 가진 성공 값: "로그인 오류"
```

판정: `ASYNC_FUNCTION_RETURN_PASS`

- `async` Function이 문자열을 호출자에게 직접 반환하는 것이 아니라 그 값으로 fulfilled된 Promise를 반환한다고 구분했다.
- `await` 기본 Case는 날짜 경계 뒤 Browser에서 실행했으므로 [9월 18일 Study Note](./2026-09-18-study-questions.md)에 기록한다.

## 근거 경계

- 오늘의 판정은 사용자의 독립 재설명에 대한 개념 근거다.
- 중첩 Microtask의 Node.js와 Browser Console 출력은 [9월 16일 Study Note](./2026-09-16-study-questions.md)의 근거다.
- Main Thread Blocking 기본 Case는 오늘 일반 Browser에서 실행했다.
- 이중 `requestAnimationFrame`과 Performance Marker 비교는 일반 Browser에서 `RUN_PASS`다.
- Marker는 Paint 자체의 시작·종료 시각을 측정하지 않았으므로 정확한 Paint Timing은 `NOT_MEASURED`다.
- Promise Executor·Handler, 값 전달과 `throw`·`catch`는 Node.js 또는 Browser Runtime과 교정 뒤 설명 근거가 있다.
- `await` Browser Runtime은 9월 18일 근거이며, Fetch·CORS·UI 상태 모델은 이 날짜에 `NOT_RUN`이다.
