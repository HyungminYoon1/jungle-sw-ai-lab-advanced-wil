# Learning Note — JavaScript Promise와 Async/Await 기초

> 작성일: 2026-09-17
> 상태: Ready — 자료 작성은 완료 근거가 아니며 문답·실행 검증 필요
> 선행 자료: [Browser JavaScript Event Loop 입문](./browser-javascript-event-loop-basics.md)

## 학습 목표

이 문서는 다음 질문에 답하기 위한 입문 자료다.

1. Promise는 무엇을 나타내는 객체인가?
2. `pending`, `fulfilled`와 `rejected`는 무엇인가?
3. Promise Executor, `resolve`와 `then` Handler의 역할은 어떻게 다른가?
4. `resolve`를 호출해도 `then` Callback이 즉시 실행되지 않는 이유는 무엇인가?
5. Promise Chain은 값과 실패를 다음 단계로 어떻게 전달하는가?
6. `async`·`await`는 Promise와 어떤 관계인가?

## 한 문장 정의

Promise는 **지금은 결과가 없을 수 있지만, 나중에 성공 값 또는 실패 이유가 결정될 작업의 결과를 나타내는 JavaScript 객체**다.

Promise 자체를 다음 항목과 혼동하지 않는다.

- Promise는 새 Thread가 아니다.
- Promise는 Timer가 아니다.
- Promise는 Microtask Queue 자체가 아니다.
- Promise를 만들었다고 긴 동기 Code가 자동으로 Non-blocking이 되지 않는다.
- Promise는 나중에 정해질 결과와 그 결과를 받을 Handler를 연결하는 객체다.

## 왜 결과 객체가 필요한가

동기 Function은 호출 중 결과를 계산해 바로 반환할 수 있다.

```javascript
function add(left, right) {
    return left + right;
}

const result = add(2, 3);
console.log(result); // 5
```

Timer, Network Request와 같은 작업은 Function이 반환될 때 결과가 아직 없을 수 있다. 이때 실제 결과 대신 **나중 결과를 대표하는 Promise 객체**를 먼저 반환할 수 있다.

```javascript
function wait(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve("기다림 완료");
        }, milliseconds);
    });
}

const promise = wait(1000);
```

`wait(1000)`은 Promise를 곧바로 반환한다. `"기다림 완료"`라는 값은 약 1초 뒤 Timer Callback이 `resolve`를 호출할 때 결정된다.

## Promise 상태

Promise는 개념적으로 다음 상태 흐름을 가진다.

```text
               resolve(value)
pending ─────────────────────→ fulfilled
   │                              └─ 성공 값 보관
   │
   └─────────────────────────→ rejected
               reject(reason)      └─ 실패 이유 보관
```

- `pending`: 아직 성공 또는 실패가 결정되지 않음
- `fulfilled`: 성공 값이 결정됨
- `rejected`: 실패 이유가 결정됨

한 번 결정된 Promise는 다시 `pending`으로 돌아가지 않으며, 성공과 실패 사이를 바꾸지도 않는다. 첫 번째 결정이 적용된 뒤의 추가 `resolve`·`reject` 호출은 상태를 다시 바꾸지 않는다.

입문 범위에서 `resolve("ok")`처럼 일반 값을 전달하면 Promise가 그 성공 값으로 완료된다고 이해한다. 다른 Promise나 Thenable을 `resolve`에 전달할 때의 상태 동화 과정은 후속 범위다.

## 실제 작업, `resolve`와 `then`을 분리해서 보기

다음 세 가지는 서로 다른 일이다.

```text
1. 실제 작업
   → Timer 만료, Network Response 수신, File 읽기와 계산 등

2. Promise 결과 결정
   → resolve(value) 또는 reject(reason)

3. 결과를 사용한 후속 처리
   → then(handler) 또는 catch(handler)에 등록한 Function
```

다음 Code를 한 줄씩 본다.

```javascript
const promise = new Promise((resolve) => {
    setTimeout(() => {
        const result = "ticket-1"; // 실제 작업 결과가 준비됨
        resolve(result);           // Promise에 성공 결과를 알림
    }, 1000);
});

const nextPromise = promise.then((value) => {
    console.log(value);            // 나중에 결과를 사용
    return "화면 갱신 완료";
});
```

### `resolve(result)`가 하는 일

`resolve`가 Timer를 실행하거나 Ticket을 조회하는 것은 아니다. 위 Code에서는 Timer Callback 안에서 실제 결과 `"ticket-1"`이 이미 준비된 뒤 `resolve(result)`를 호출한다.

일반 값을 사용하는 이번 입문 Case에서 `resolve(result)`는 다음 의미다.

```text
promise
상태: pending
결과: 없음

resolve("ticket-1")
        ↓

promise
상태: fulfilled
결과: "ticket-1"
```

따라서 “`resolve`가 비동기 작업을 완료한다”보다 “작업 결과가 준비됐음을 Promise에 알리고 성공 결과를 결정한다”라고 표현하는 편이 정확하다.

`resolve`는 등록된 `then` Handler를 현재 Call Stack에서 직접 호출하지 않는다. 실행 가능한 Promise 반응은 Microtask로 처리된다.

### `then(handler)`가 하는 일

`handler`는 Function 값이다.

```javascript
const handler = (value) => {
    console.log(value);
};

promise.then(handler);
```

`promise.then(handler)`는 다음 의미다.

```text
"promise가 성공 값을 갖게 되면
그 값을 handler의 인자로 전달해서
handler를 나중에 실행해 주세요."
```

개념적으로는 Promise의 반응 목록에 Handler를 등록한다고 생각할 수 있다.

```text
promise
├─ 상태: pending
└─ 성공 반응 목록
   └─ handler(value)
```

`then`은 결과가 생길 때까지 현재 Thread를 멈춰 기다리지 않는다. Handler를 등록한 뒤 즉시 새 Promise인 `nextPromise`를 반환한다.

### 시간 순서로 다시 보기

| 시점 | 원래 `promise` | 일어난 일 |
|---|---|---|
| 생성 직후 | `pending` | Executor가 Timer를 등록 |
| `then` 호출 직후 | `pending` | 성공 Handler 등록, `nextPromise` 반환 |
| 약 1초 뒤 | `fulfilled("ticket-1")` | 실제 결과가 준비돼 `resolve` 호출 |
| 해당 Task 종료 뒤 | `fulfilled("ticket-1")` | Microtask에서 Handler가 값 수신 |
| Handler가 문자열 반환 | 그대로 fulfilled | `nextPromise`가 `fulfilled("화면 갱신 완료")` |

이 표에서 `resolve`는 원래 Promise의 결과를 결정하고, `then` Handler는 그 결과를 사용한다. 둘은 같은 Function도 아니고 같은 시점의 동작도 아니다.

## Promise 객체를 개념적으로 그리기

다음 그림은 실제로 접근 가능한 Field 구조가 아니라 동작 이해를 위한 개념도다.

```text
promise
├─ 상태: pending
├─ 결과: 아직 없음
└─ 반응 목록
   └─ then Handler
```

성공 값이 결정되면 다음처럼 생각할 수 있다.

```text
promise
├─ 상태: fulfilled
├─ 결과: "ticket-1"
└─ 등록된 then Handler
   └─ Microtask로 실행될 준비
```

## Executor, `resolve`와 `then`의 역할

```javascript
const promise = new Promise((resolve, reject) => {
    // 이 Function이 Executor다.
});
```

### Executor

- `new Promise(...)`가 실행될 때 즉시 호출된다.
- Promise로 나타낼 작업을 시작한다.
- JavaScript Runtime이 제공한 `resolve`와 `reject` Function을 인자로 받는다.
- Executor에서 처리되지 않은 Exception이 발생하면 생성 중인 Promise는 rejected 상태가 된다.

Executor 안에 있다는 이유만으로 Code가 나중에 실행되는 것은 아니다.

### `resolve(value)`

- 이번 입문 Case에서는 성공 값이 준비됐음을 Promise에 알린다.
- Promise의 성공 결과를 결정한다.
- `then` Handler를 현재 Call Stack 한가운데서 직접 호출하는 Function으로 이해하지 않는다.

### `reject(reason)`

- 작업이 실패했음을 Promise에 알린다.
- Promise의 실패 이유를 결정한다.
- 등록된 실패 Handler가 나중에 처리할 수 있게 한다.

### `then(onFulfilled)`

- 성공했을 때 실행할 Handler를 등록한다.
- 원래 Promise가 이미 fulfilled여도 Handler를 현재 줄에서 즉시 실행하지 않는다.
- Handler는 Microtask로 실행된다.
- `then`은 새 Promise를 반환한다.

## 한 줄씩 실행 흐름 추적

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

### 현재 Task의 동기 실행

```text
1. A 출력
2. new Promise 실행
3. Executor 즉시 실행
4. B 출력
5. resolve("ticket-1")로 Promise 결과 결정
6. then Handler 등록
7. D 출력
```

### 현재 Task가 끝난 뒤

```text
8. Microtask에서 then Handler 실행
9. C ticket-1 출력
```

최종 출력:

```text
A
B
D
C ticket-1
```

`resolve` 호출과 `then` Handler 실행은 같은 사건이 아니다.

```text
resolve
→ Promise의 결과 결정
→ 등록된 반응을 Microtask로 처리할 준비

현재 동기 Code 종료
→ Microtask Queue 처리
→ then Handler 실행
```

## 이미 성공한 Promise도 Handler는 나중에 실행된다

```javascript
const promise = Promise.resolve("ready");

promise.then((value) => {
    console.log(value);
});

console.log("current task");
```

출력은 다음과 같다.

```text
current task
ready
```

Promise가 이미 fulfilled라는 사실과 Handler가 동기적으로 실행된다는 말은 다르다. `then` Handler는 현재 동기 Code가 끝난 뒤 Microtask에서 실행된다.

## Promise Chain

`then`은 항상 다음 단계를 나타내는 새 Promise를 반환한다.

```javascript
const first = Promise.resolve(2);

const second = first.then((value) => {
    return value * 3;
});

second.then((value) => {
    console.log(value); // 6
});
```

개념 흐름:

```text
first fulfilled(2)
→ 첫 then Handler 실행
→ 6 반환
→ second fulfilled(6)
→ 다음 then Handler가 6을 받음
```

Handler에서 일반 값을 반환하면 다음 Promise의 성공 값이 된다. 다른 Promise를 반환하면 다음 단계는 그 Promise의 결과를 기다린다.

## 실패 전달과 `catch`

```javascript
Promise.resolve("ticket-1")
    .then(() => {
        throw new Error("조회 실패");
    })
    .catch((error) => {
        console.log(error.message);
    });
```

`then` Handler 안에서 Exception이 발생하면 `then`이 반환한 새 Promise는 rejected가 된다. `catch(handler)`는 앞 단계에서 전달된 실패를 처리한다.

입문 범위에서는 다음처럼 기억한다.

```text
Handler가 값 반환
→ 다음 Promise fulfilled

Handler가 Exception 발생
→ 다음 Promise rejected

Handler가 Promise 반환
→ 다음 단계가 그 Promise 결과를 기다림
```

## `async` Function

`async` Function은 호출하면 항상 Promise를 반환한다.

```javascript
async function loadNumber() {
    return 10;
}

const resultPromise = loadNumber();
```

`return 10`은 호출자에게 숫자 `10`을 직접 반환한다는 뜻이 아니다. `loadNumber()`가 반환한 Promise가 값 `10`으로 fulfilled된다.

## `await`

`await`는 Promise의 결과를 기다리는 동안 **Async Function의 나머지 실행을 나중으로 미룬다**. Browser Main Thread 전체를 멈추지 않는다.

```javascript
async function run() {
    console.log("B");

    const value = await Promise.resolve("ticket-1");

    console.log("C", value);
}

console.log("A");
run();
console.log("D");
```

실행 흐름:

```text
현재 동기 Code
→ A
→ run 호출
→ B
→ await에서 run의 나머지 실행을 미룸
→ 호출자에게 제어 반환
→ D

Microtask
→ run의 나머지 실행
→ C ticket-1
```

최종 출력:

```text
A
B
D
C ticket-1
```

## Promise가 해결하지 않는 것

다음 Code는 Promise Executor가 동기적으로 실행되므로 Main Thread를 그대로 막는다.

```javascript
new Promise((resolve) => {
    const startedAt = performance.now();

    while (performance.now() - startedAt < 1000) {
        // Main Thread Blocking
    }

    resolve();
});
```

Promise로 감쌌다는 이유만으로 CPU 작업이 다른 Thread로 이동하지 않는다. 실제 병렬 실행이 필요하면 Web Worker와 같은 별도 수단을 요구사항에 맞게 검토해야 한다.

## Code를 볼 때 확인할 순서

1. 현재 동기 Code는 무엇인가?
2. `new Promise`의 Executor에서 즉시 실행되는 부분은 무엇인가?
3. 성공 값은 언제 `resolve`되는가?
4. 실패 이유는 언제 `reject`되는가?
5. `then`·`catch` Handler는 어느 Promise에 등록되는가?
6. Handler는 어떤 값을 반환하거나 어떤 Exception을 발생시키는가?
7. 현재 Task가 끝난 뒤 어떤 Microtask가 실행되는가?

## 흔한 오해

| 오해 | 교정 |
|---|---|
| Promise를 만들면 새 Thread에서 실행된다. | Executor는 현재 호출 흐름에서 동기적으로 시작한다. |
| `resolve`가 `then` Handler를 즉시 호출한다. | 결과를 결정하며 Handler는 Microtask에서 실행된다. |
| fulfilled Promise의 `then`은 동기 실행이다. | 이미 결정됐어도 Handler는 Microtask다. |
| `then`은 원래 Promise 자체를 그대로 반환한다. | 다음 단계를 나타내는 새 Promise를 반환한다. |
| `await`가 Browser 전체를 멈춘다. | 해당 Async Function의 나머지를 미루고 호출자에게 제어를 돌려준다. |
| Promise로 긴 반복문을 감싸면 UI가 멈추지 않는다. | 동기 반복문은 그대로 Main Thread를 점유한다. |

## 첫 확인 질문

다음 질문은 자료를 읽은 뒤 Code를 실행하지 않고 답한다.

1. Promise는 작업 그 자체인가, 작업의 미래 결과를 나타내는 객체인가?
2. `pending`에서 이동할 수 있는 두 결과 상태는 무엇인가?
3. Executor와 `then` Handler 중 현재 동기 Code에서 실행되는 것은 무엇인가?
4. `resolve`의 역할과 `then` Handler의 역할은 어떻게 다른가?
5. Promise가 긴 동기 반복문을 자동으로 Non-blocking으로 만들지 못하는 이유는 무엇인가?

## 완료와 근거의 경계

- 이 문서를 작성하거나 읽은 것만으로 Promise 학습을 완료하지 않는다.
- 상태와 역할을 자신의 말로 설명한 뒤 실행 순서를 예상한다.
- 기본 Case를 Node.js와 Browser에서 실행하고 예상과 비교한다.
- 성공 Chain, 실패 전달과 `async`·`await` Case를 각각 최소 한 번 실행한다.
- Fetch의 HTTP 오류와 Network 오류는 Promise 기초를 통과한 뒤 별도 Spike에서 검증한다.

## 공식 참고 자료

- [MDN — Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
- [MDN — Using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)
- [MDN — async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
- [MDN — await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await)
