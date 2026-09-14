# Learning Note — Browser JavaScript Event Loop 입문

> 작성일: 2026-09-14
> 대상: JavaScript 비동기 실행 순서를 처음 학습하는 단계
> 문서 성격: 학습자료 — 읽었다는 사실만으로 이해·실행 완료를 판정하지 않음
> 핵심 질문: `console.log`, Promise Callback과 Timer Callback은 왜 Source Code에 적힌 순서와 다르게 실행될 수 있는가?

## 먼저 알아야 할 전체 그림

JavaScript Code는 위에서 아래로 읽히지만 모든 Callback이 발견되는 즉시 실행되는 것은 아니다. 현재 실행 중인 Code, 나중에 실행할 Callback과 Browser의 화면 갱신이 서로 다른 위치에서 기다리기 때문이다.

처음에는 다음 단순화된 흐름만 잡는다.

```text
현재 Task 시작
    ↓
Call Stack에서 동기 Code를 끝까지 실행
    ↓
Microtask Queue가 빌 때까지 Callback 실행
    ↓
Browser가 필요하면 Rendering
    ↓
다음 Task 선택
    ↓
같은 과정 반복
```

이 그림은 입문을 위한 단순화다. 실제 Browser는 여러 Task Source와 Rendering 조건을 관리한다. 특히 화면 갱신은 매 반복마다 반드시 일어나는 것이 아니라 Browser가 필요하다고 판단할 때 일어날 수 있다.

## JavaScript Engine과 Browser는 같은 것이 아니다

JavaScript Language 자체가 Timer, Network와 화면을 모두 처리하는 것은 아니다. Browser는 JavaScript Engine과 함께 Timer, DOM, Network, User Event와 Rendering 기능을 제공하는 실행 환경이다.

```text
┌──────────────────────── Browser ────────────────────────┐
│                                                        │
│  JavaScript Engine                                     │
│  ┌──────────────────┐                                  │
│  │ Call Stack       │ 현재 실행 중인 Function          │
│  └──────────────────┘                                  │
│                                                        │
│  Browser 기능                                          │
│  Timer · DOM Event · Network · Rendering               │
│                                                        │
│  대기 중인 실행                                        │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ Microtask Queue  │  │ Task Queue(s)    │            │
│  │ Promise.then     │  │ Timer·Click 등   │            │
│  └──────────────────┘  └──────────────────┘            │
└────────────────────────────────────────────────────────┘
```

`setTimeout`은 JavaScript가 시간을 세며 멈춰 있는 명령이 아니다. Browser가 Timer를 관리하고, 지정한 시간이 지난 뒤 Callback을 다음 Task 후보로 둔다. `fetch`도 Network 작업을 Browser에 맡기고 결과를 Promise로 받는다.

## 여섯 가지 핵심 용어

### 1. Call Stack

현재 어떤 Function이 실행 중인지 쌓아 두는 구조다. Function이 다른 Function을 호출하면 위에 추가되고, 실행이 끝나면 빠진다.

```javascript
function second() {
    console.log("second");
}

function first() {
    second();
}

first();
```

실행 중 Stack의 개념적 변화는 다음과 같다.

```text
first 추가
→ second 추가
→ console.log 실행
→ second 종료
→ first 종료
→ Stack 비움
```

### 2. 동기 실행

현재 Call Stack에서 바로 실행되는 Code다. 일반적인 Function 호출, 계산과 `console.log`가 여기에 해당한다.

동기 Code는 중간에 Timer Callback이나 Promise Callback에게 자리를 빼앗기지 않고 현재 실행 단위를 끝까지 진행한다. 이를 `run-to-completion`이라고 부른다.

### 3. Task

Browser가 Event Loop에서 하나씩 선택해 실행하는 작업 단위다. 다음 항목은 대표적인 Task 시작 원인이다.

- 처음 `<script>`를 실행하는 일
- 사용자의 Click Event Callback
- 준비가 끝난 Timer Callback
- 일부 Browser Event Callback

입문 그림에서는 흔히 `Task Queue` 하나로 표현하지만 실제 표준과 Browser 구현에는 여러 Task Source가 있을 수 있다. 이번 학습에서는 “다음 Event Loop 차례에 실행될 큰 작업”이라는 의미로 사용한다.

### 4. Microtask

현재 Task가 끝난 직후, 다음 Task보다 먼저 처리되는 작은 작업이다.

대표적인 Microtask는 다음과 같다.

- `Promise.then`, `catch`, `finally`에 등록한 Callback
- `queueMicrotask`에 전달한 Callback
- `await` 뒤에 이어지는 Async Function의 나머지 부분

Event Loop는 다음 Task로 넘어가기 전에 Microtask Queue가 빌 때까지 처리한다. 처리 중인 Microtask가 새 Microtask를 추가하면 그것도 같은 Checkpoint에서 계속 실행될 수 있다.

### 5. Rendering 기회

Browser는 보통 현재 Task와 이어진 Microtask 처리가 끝난 뒤 화면을 갱신할 기회를 가질 수 있다. 이 과정에는 Style 계산, Layout과 Paint 등이 포함될 수 있다.

긴 동기 Code가 Call Stack을 계속 점유하거나 Microtask가 끝없이 추가되면 Browser가 Click을 처리하거나 화면을 그릴 기회를 늦게 얻는다. 이것이 Main Thread Blocking과 화면 멈춤으로 이어질 수 있다.

### 6. Event Loop

실행할 Task를 선택하고, Task가 끝나면 Microtask를 처리하고, 필요한 Rendering 기회를 제공한 뒤 다음 Task로 넘어가는 반복 구조다.

Event Loop를 별도의 작업자 Thread라고 생각하지 않는다. 이번 범위에서는 Browser Main Thread가 무엇을 언제 실행할지 조정하는 반복 메커니즘으로 이해한다.

## Code를 만났을 때 먼저 분류한다

출력 순서를 바로 맞히려고 하지 말고 각 줄이 어디에서 실행되는지 먼저 분류한다.

| Code·상황 | 현재 즉시 실행되는 부분 | 나중에 실행되는 부분 | 분류 |
|---|---|---|---|
| `console.log("A")` | Log 출력 | 없음 | 현재 동기 실행 |
| `setTimeout(callback, 0)` | Timer 등록 | `callback` | 다음 Task 후보 |
| `Promise.resolve().then(callback)` | 해결된 Promise에 Handler 등록 | `callback` | Microtask |
| `queueMicrotask(callback)` | Callback 등록 | `callback` | Microtask |
| `button.addEventListener("click", callback)` | Listener 등록 | 실제 Click 뒤 `callback` | User Event Task |
| `requestAnimationFrame(callback)` | Callback 등록 | 다음 Paint 전에 가능한 `callback` | Rendering 단계와 연결 |

중요한 것은 “Function을 인자로 전달했다”와 “그 Function을 지금 호출했다”를 구분하는 것이다.

```javascript
setTimeout(printMessage, 0); // Function을 전달한다.
printMessage();             // Function을 지금 호출한다.
```

## `setTimeout(..., 0)`은 즉시 실행이 아니다

`0`은 Callback을 지금 Call Stack에 끼워 넣으라는 뜻이 아니다. Timer가 실행 가능한 최소 조건을 만족한 뒤 Callback을 Task로 예약한다는 뜻에 가깝다.

현재 Task에 긴 동기 Code가 남아 있으면 Timer Callback은 기다려야 한다.

> 실습 안전: 아래 예제는 Main Thread를 약 0.5초만 점유하도록 제한했다. Browser가 잠시 반응하지 않을 수 있으므로 `500`을 큰 값으로 늘리지 않는다.

```javascript
console.log("start");

setTimeout(() => {
    console.log("timer");
}, 0);

const blockUntil = performance.now() + 500;

while (performance.now() < blockUntil) {
    // 약 0.5초 동안 Main Thread를 점유한다.
}

console.log("end");
```

Timer의 대기 시간이 지났더라도 현재 Task가 끝나기 전에는 `timer` Callback이 실행되지 않는다. 이 예제는 실행 순서를 관찰하기 위한 것이며 정밀한 성능 측정 근거로 사용하지 않는다.

## Promise Callback도 발견 즉시 실행되지 않는다

이미 해결된 Promise라도 `.then` Callback은 현재 Code 중간에 바로 실행되지 않고 Microtask로 예약된다.

```javascript
console.log("before");

Promise.resolve().then(() => {
    console.log("promise callback");
});

console.log("after");
```

예상 출력은 다음과 같다.

```text
before
after
promise callback
```

현재 Script Task의 동기 Code인 `before`와 `after`가 먼저 끝나고, Call Stack이 빈 뒤 Microtask가 실행되기 때문이다.

## 첫 질문을 단계별로 추적한다

다음 Code가 원래 질문이다.

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

### 1단계: 각 부분 분류

| Code | 분류 | 지금 일어나는 일 |
|---|---|---|
| `console.log("A")` | 동기 | `A` 출력 |
| `setTimeout(..., 0)` | 동기 등록 | `B` Callback이 나중 Task가 될 준비 |
| `Promise.resolve().then(...)` | 동기 등록 | `C` Callback을 Microtask에 예약 |
| `console.log("D")` | 동기 | `D` 출력 |

### 2단계: 현재 Script Task 종료

동기 Code가 끝날 때까지 출력된 것은 `A`, `D`다.

```text
A
D
```

### 3단계: Microtask 처리

다음 Task를 선택하기 전에 `C` Callback을 실행한다.

```text
C
```

### 4단계: 다음 Task 처리

Timer 조건을 만족해 기다리던 `B` Callback을 다음 Task에서 실행한다.

```text
B
```

따라서 전체 예상 순서는 다음과 같다.

```text
A
D
C
B
```

단순히 “Promise가 Timer보다 빠르다”라고 외우지 않는다. 더 정확한 이유는 현재 Task가 끝난 뒤 Microtask Queue를 먼저 비우고 다음 Task를 선택하기 때문이다.

## Promise Executor와 `.then` Callback은 다르다

`new Promise`에 전달한 Executor Function은 Promise를 만들 때 동기적으로 실행된다. 반면 `.then`에 전달한 Handler는 Microtask로 실행된다.

```javascript
console.log("A");

new Promise((resolve) => {
    console.log("B");
    resolve();
}).then(() => {
    console.log("C");
});

console.log("D");
```

예상 순서:

```text
A
B
D
C
```

`B`는 Executor 내부지만 현재 동기 실행이고, `C`만 `.then` Handler이므로 Microtask다.

## `async`·`await`는 Thread를 멈추지 않는다

Async Function은 호출 즉시 Promise를 반환한다. `await` 앞부분은 현재 호출 흐름에서 실행되고, `await` 뒤의 나머지 부분은 Promise가 처리된 뒤 이어진다.

```javascript
async function run() {
    console.log("B");
    await 0;
    console.log("C");
}

console.log("A");
run();
console.log("D");
```

예상 순서:

```text
A
B
D
C
```

`await`가 Browser Main Thread 전체를 멈췄다면 `D`보다 `C`가 먼저 나와야 한다. 실제 의미는 Async Function의 나머지를 나중에 이어서 실행할 수 있도록 현재 호출자에게 제어를 돌려주는 것이다.

## 중첩 Microtask는 언제 끝나는가

다음 Code에서는 첫 번째 Microtask가 실행되면서 새로운 Microtask를 추가한다.

```javascript
console.log("A");

queueMicrotask(() => {
    console.log("B");
    queueMicrotask(() => {
        console.log("C");
    });
});

setTimeout(() => {
    console.log("D");
}, 0);

console.log("E");
```

실행 전에 다음 표를 직접 채운다.

| 순서 | 예상 문자 | 이유 |
|---:|---|---|
| 1 |  | 현재 동기 실행 |
| 2 |  | 현재 동기 실행 |
| 3 |  | 첫 Microtask |
| 4 |  | 첫 Microtask가 추가한 Microtask |
| 5 |  | 다음 Timer Task |

Microtask는 처리 중 새로 추가된 Microtask까지 Queue가 빌 때까지 실행될 수 있다. 그래서 Microtask가 자기 자신과 같은 종류의 작업을 끝없이 추가하면 다음 Task와 Rendering이 오래 지연될 수 있다.

## Browser Rendering과 연결해서 본다

화면 내용을 바꾼 직후 긴 동기 Code를 실행하면 사용자는 변경된 화면을 바로 보지 못할 수 있다.

```javascript
statusElement.textContent = "작업 중";

runVeryLongSynchronousWork();

statusElement.textContent = "완료";
```

두 변경이 하나의 Task 안에서 일어나고 그동안 Main Thread가 계속 점유되면 Browser가 중간의 “작업 중” 상태를 Paint할 기회를 얻지 못할 수 있다. DOM 값이 바뀌었다는 사실과 Pixel이 화면에 그려졌다는 사실은 같은 시점이라고 단정하지 않는다.

이번 주에는 다음 질문으로 확장한다.

- Loading 상태를 DOM에 썼는데 사용자가 실제로 볼 기회가 있었는가?
- Promise가 끝난 뒤 Rendering Function은 어느 시점에 실행되는가?
- 긴 동기 계산이 Click과 화면 갱신을 왜 막는가?

## Browser와 Node의 관찰을 구분한다

간단한 동기 Code·Promise Microtask·Timer 비교는 Browser와 Node에서 같은 순서로 보일 수 있다. 그러나 Node는 Browser Rendering이 없고 자체 Event Loop Phase를 가진다.

따라서 이번 주 근거는 다음처럼 나눈다.

| 실행 환경 | 확인할 수 있는 것 | 확인할 수 없는 것 |
|---|---|---|
| Node | 기본 동기·Promise·Timer 출력 순서 | Browser DOM·Rendering |
| Browser Console | Browser에서의 기본 실행 순서 | 실제 화면 상태 변화 자체 |
| Browser Page·DevTools | DOM Event, Rendering과 Network | Production 환경 전체 |

Node 결과만으로 Browser Rendering을 확인했다고 쓰지 않는다.

## 흔한 오해

| 오해 | 교정 |
|---|---|
| Source Code의 위쪽 Callback이 무조건 먼저 실행된다. | Callback 종류와 Queue를 먼저 확인한다. |
| `setTimeout(..., 0)`은 즉시 실행된다. | 현재 Task가 끝난 뒤 가능한 다음 Task다. |
| 해결된 Promise의 `.then`은 동기 실행이다. | Handler는 Microtask로 예약된다. |
| `await`는 Browser Thread를 멈춘다. | Async Function의 나머지를 미루고 호출자에게 제어를 돌려준다. |
| Microtask는 항상 하나만 실행된다. | 다음 Task 전 Queue가 빌 때까지 처리된다. |
| DOM을 바꾸면 즉시 화면 Pixel도 바뀐다. | Browser가 Rendering 기회를 얻어야 보인다. |
| Node 출력은 Browser Rendering 근거다. | Node에는 DOM과 Browser Rendering이 없다. |

## 오늘 기억할 다섯 문장

1. 현재 Task의 동기 Code는 Call Stack에서 끝까지 실행된다.
2. `Promise.then`과 `queueMicrotask`의 Callback은 Microtask다.
3. Timer Callback은 시간이 지났다고 현재 Code를 중단시키지 않고 다음 Task를 기다린다.
4. Event Loop는 다음 Task 전에 Microtask Queue를 비운다.
5. Browser는 Task와 Microtask 처리 뒤 필요할 때 Rendering할 기회를 가질 수 있다.

## 학습 순서

1. 위 다섯 문장을 읽는다.
2. Code를 실행하지 않은 채 각 줄을 동기·Microtask·Task로 분류한다.
3. 출력 순서를 적는다.
4. Browser Console에서 실행한다.
5. 같은 기본 Case를 Node에서 실행한다.
6. 예상과 실제가 다르면 정답만 고치지 말고 잘못 분류한 줄을 찾는다.
7. 실제 출력과 자신의 설명을 날짜별 Study Note에 기록한다.

문서에 적힌 결과를 그대로 복사한 것은 자신의 예상 근거가 아니다. 새로운 중첩 Case를 자료 없이 분류하고 실행 결과를 설명할 수 있어야 개념 근거로 사용한다.

## 스스로 확인할 질문

1. Call Stack, Task와 Microtask는 각각 무엇을 보관하거나 기다리는가?
2. `setTimeout(..., 0)`의 Callback이 현재 Script보다 늦게 실행되는 이유는 무엇인가?
3. 해결된 Promise의 `.then` Callback이 다음 Timer Task보다 먼저 실행되는 이유는 무엇인가?
4. Promise Executor와 `.then` Handler는 실행 시점이 어떻게 다른가?
5. `await` 앞과 뒤의 Code는 어떻게 나뉘는가?
6. 중첩 Microtask가 다음 Task와 Rendering을 지연시킬 수 있는 이유는 무엇인가?
7. DOM 변경과 실제 Paint를 같은 순간이라고 단정할 수 없는 이유는 무엇인가?
8. Node 실행 결과만으로 Browser Rendering을 검증할 수 없는 이유는 무엇인가?

## 완료와 근거의 경계

- 이 문서를 생성하거나 읽은 것만으로 Event Loop 학습을 완료하지 않는다.
- 실행 전 예상, 실제 Browser·Node 관찰과 차이 설명이 있어야 첫 Spike 근거가 된다.
- Browser가 필요하면 Rendering한다는 설명은 실제 Paint Timing을 측정했다는 뜻이 아니다.
- 실제 Rendering 관찰은 별도의 Browser Page와 DevTools Evidence로 남긴다.
- Event Loop 전체 표준과 Node의 모든 Phase를 이번 입문 범위에서 학습했다고 주장하지 않는다.

## 공식 참고 자료

- [MDN — JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop)
- [MDN — Using microtasks](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide)
- [MDN — async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
- [MDN — Critical rendering path](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Critical_rendering_path)
