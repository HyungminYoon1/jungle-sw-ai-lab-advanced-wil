# 2026-09-17 — Main Thread Rendering과 Promise의 기본 흐름

> 날짜: 2026-09-17
> 학습 주제: 중첩 Microtask, Main Thread Blocking, `requestAnimationFrame`, Promise Executor와 Chain

## 핵심 질문

1. Microtask 실행 중 새 Microtask가 등록되면 왜 다음 Timer Task보다 먼저 실행되는가?
2. DOM의 값이 바뀌었는데도 화면에 중간 상태가 보이지 않을 수 있는 이유는 무엇인가?
3. `requestAnimationFrame`을 두 번 사용하면 Browser가 중간 상태를 Paint할 기회를 어떻게 얻는가?
4. Promise Executor, `resolve`와 `then` Handler는 각각 언제 무엇을 하는가?
5. `then` Handler의 `return`은 원래 Promise와 다음 Promise 중 어느 쪽의 결과를 결정하는가?
6. Promise Handler에서 `throw`가 발생하면 뒤의 성공 Handler와 `catch`는 어떻게 동작하는가?

## 중첩 Microtask는 Queue가 빌 때까지 이어진다

[9월 16일 Study Note](./2026-09-16-study-questions.md)에서 다음 출력 순서를 확인했다.

```text
A → E → B → C → D
```

`B`는 첫 번째 Microtask이고, 그 실행 중 `C`를 출력할 새 Microtask를 등록한다. `D`는 Timer Task다.

처음에는 “`C`가 `B` 안에 정의되어 있기 때문에 `D`보다 먼저 실행된다”고 설명했다. Code의 위치만으로는 충분한 설명이 아니었다. 실행 순서를 결정하는 직접적인 이유는 새 Callback이 Microtask Queue에 추가되고, Event Loop가 다음 Task를 선택하기 전에 그 Queue를 빌 때까지 처리하기 때문이다.

```text
현재 Task 종료
→ Microtask Checkpoint 시작
→ B 실행
→ B가 C를 Microtask Queue에 추가
→ Queue가 아직 비어 있지 않으므로 C 실행
→ Microtask Queue가 빔
→ 다음 Timer Task의 D 실행
```

나는 처음에 “Queue가 종료될 때까지 처리한다”고 표현했지만, Queue 자체가 종료되는 것은 아니다. 더 정확한 표현은 “현재 Microtask Checkpoint에서 Queue가 빌 때까지 처리한다”이다.

## DOM 변경과 화면 Paint는 같은 순간이 아니다

다음 Click Handler는 DOM 값을 두 번 바꾸는 사이에 Main Thread를 약 0.5초 동안 점유한다.

```javascript
statusElement.textContent = "작업 중";

const startedAt = performance.now();

while (performance.now() - startedAt < 500) {
    // Main Thread를 점유하는 동기 작업
}

statusElement.textContent = "완료";
```

처음에는 반복문이 실행되는 동안 화면에 이미 최종값인 `"완료"`가 보일 것이라고 생각했다. 하지만 JavaScript가 DOM 값을 바꾼 시점과 Browser가 실제 Pixel을 Paint하는 시점은 다르다.

이 Handler가 하나의 Task 안에서 실행되는 동안의 상태는 다음과 같다.

```text
Click 전
→ 화면에는 기존 상태 "대기"가 그려져 있음

Click Task
→ DOM: "작업 중"
→ 긴 동기 반복문이 Main Thread 점유
→ DOM: "완료"

Task 종료 뒤 Rendering 기회
→ 최종 DOM 값 "완료"를 화면에 반영
```

긴 반복문이 실행되는 동안 DOM에는 `"작업 중"`이 저장되어 있다. 하지만 Browser는 같은 Main Thread에서 JavaScript를 실행하고 있으므로 중간 상태를 Paint할 기회를 얻지 못할 수 있다. 따라서 화면에는 새 `"완료"`가 미리 보이는 것이 아니라, Click 전에 마지막으로 그려진 `"대기"`가 계속 남는다.

일반 Browser에서 실행했을 때 실제 변화도 다음과 같았다.

```text
DOM:  대기 → 작업 중 → 완료
화면: 대기 ─────────→ 완료
             약 1초 Blocking
```

이 실험을 통해 DOM 상태와 실제 화면에 보이는 상태를 별도로 추적해야 한다는 점을 이해했다.

## 긴 동기 Code는 다른 작업도 지연시킨다

동기 반복문이 실행되는 동안에는 현재 Call Stack이 비워지지 않는다. 그 결과 다음 작업이 함께 지연될 수 있다.

- 다른 Click이나 Keyboard Event 처리
- Timer Callback 실행
- Promise Handler 같은 Microtask 처리
- Browser의 Style 계산, Layout과 Paint

비동기 API를 사용했다는 사실만으로 Main Thread Blocking이 사라지는 것은 아니다. Callback 안에서 다시 긴 동기 Code를 실행하면 그 Callback이 끝날 때까지 화면과 다른 JavaScript 작업이 지연된다.

## 이중 `requestAnimationFrame`으로 중간 상태를 보여 주기

`"작업 중"`을 실제 화면에 먼저 표시한 뒤 긴 작업을 시작하려면 Browser에 Rendering 기회를 돌려줘야 한다. 이번에는 `requestAnimationFrame`을 중첩해 비교했다.

```text
Click Task
→ DOM을 "작업 중"으로 변경
→ 첫 번째 requestAnimationFrame 예약
→ Task 종료

첫 번째 Animation Frame Callback
→ 두 번째 requestAnimationFrame 예약
→ Callback 종료 뒤 "작업 중"을 Paint할 기회

두 번째 Animation Frame Callback
→ 약 1초 동안 Main Thread Blocking
→ DOM을 "완료"로 변경
→ Callback 종료 뒤 "완료"를 Paint할 기회
```

처음에는 두 번째 Callback의 Blocking 동안 화면에 `"대기"`가 남고, Blocking이 끝난 뒤 `"작업 중"`이 보일 것이라고 예상했다. 실제로는 첫 번째 Callback이 끝난 뒤 Browser가 이미 `"작업 중"`을 Paint할 기회를 얻는다. 따라서 두 번째 Callback이 Main Thread를 점유하는 동안 마지막으로 그려진 `"작업 중"`이 화면에 남는다.

일반 Browser에서 관찰한 화면은 다음과 같았다.

```text
Click 전: 대기
두 번째 Callback의 약 1초 Blocking 동안: 작업 중
Blocking 종료 뒤: 완료
```

기본 Blocking Case와 비교하면 차이가 더 분명하다.

```text
기본 Blocking
→ 대기 ─────────→ 완료

이중 requestAnimationFrame
→ 대기 → 작업 중 ─────────→ 완료
                         약 1초 Blocking
```

이번 실행에서 두 `requestAnimationFrame` Marker 사이의 간격은 `4.8ms`, 동기 Blocking 시간은 약 `1000.0ms`였다. 이 수치는 JavaScript Marker 사이의 시간과 반복문 실행 시간을 뜻한다. `4.8ms`를 Monitor 주사율, Frame의 고정 길이 또는 Paint 소요 시간으로 해석해서는 안 된다. 실제 Paint의 정확한 시작·종료 시각을 측정한 것은 아니며, `"작업 중"`이 보였다는 근거는 화면에서 직접 관찰한 변화다.

또한 `requestAnimationFrame`을 한 번 호출했다고 해서 그 Callback 안에서 Blocking하기 전에 중간 Paint가 반드시 끝난다고 가정하면 안 된다. 이번처럼 다음 Frame의 Callback으로 Blocking 작업을 넘기면 Browser가 그 사이 Rendering할 기회를 얻는 구조를 만들 수 있다.

## Promise는 미래의 결과를 나타내는 객체다

Promise를 처음 접했을 때는 `pending`, `resolve`, `then`의 정의를 읽어도 각 역할이 실제 작업 흐름에서 어떻게 나뉘는지 이해하기 어려웠다. 다음 세 문장으로 역할을 먼저 분리했다.

```text
resolve
→ 준비된 결과로 Promise의 상태와 결과를 결정한다.

then
→ 성공 결과를 받았을 때 나중에 실행할 Handler를 등록한다.

Handler의 return
→ then이 반환한 다음 Promise의 결과를 결정한다.
```

`resolve`는 Ticket을 만들거나 Network 요청을 실행하는 함수가 아니다. 그런 실제 작업은 별도의 Code가 수행한다. `resolve(value)`는 그 작업에서 얻은 결과를 Promise에 알려 주는 역할을 한다.

`then(handler)`도 Handler를 그 자리에서 바로 실행하지 않는다. 결과가 준비되면 성공 값을 인자로 받아 실행할 Function을 연결하고, Chain의 다음 단계를 나타내는 새 Promise를 즉시 반환한다.

## Executor는 동기적으로 실행되고 Handler는 Microtask에서 실행된다

다음 Code로 Promise 생성과 Handler 실행 시점을 비교했다.

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

처음에는 `C`도 현재 Stack에서 실행된다고 생각해 `A → B → C → D`를 예상했다. 하지만 `new Promise(executor)`가 호출되면 Executor의 `B`는 즉시 동기적으로 실행되는 반면, `then` Handler의 `C`는 Microtask에서 실행된다.

```text
현재 Task
→ A 출력
→ Promise Executor 실행
→ B 출력
→ resolve("ticket-1")로 결과 결정
→ then Handler 등록
→ D 출력

Microtask
→ Handler가 "ticket-1"을 받아 C 출력

최종: A → B → D → C ticket-1
```

Node.js `v22.23.2`와 Browser Console에서 모두 이 출력 순서를 확인했다.

여기서 다시 바로잡은 부분은 Promise의 결과가 결정되는 시점과 Handler가 실행되는 시점이다. `resolve("ticket-1")`를 호출하면 Promise 결과는 그 자리에서 결정될 수 있지만, 연결된 `then` Handler는 현재 Call Stack에서 직접 호출되지 않는다. 현재 Task가 끝난 뒤 Microtask에서 그 결과를 사용한다.

## `then`은 원래 Promise를 바꾸지 않고 새 Promise를 만든다

다음 Chain을 살펴봤다.

```javascript
const firstPromise = Promise.resolve(2);

const secondPromise = firstPromise.then((value) => {
    return value * 3;
});
```

첫 번째 Handler는 `2`를 받아 `6`을 반환한다. 이때 `firstPromise`의 결과가 `2`에서 `6`으로 바뀌는 것이 아니다. `then`이 반환한 `secondPromise`의 성공값이 `6`이 된다.

Ticket 객체에서도 같은 규칙이 적용된다.

```javascript
const ticketPromise = Promise.resolve({
    id: 1,
    title: "로그인 오류"
});

const titlePromise = ticketPromise.then((ticket) => {
    return ticket.title;
});
```

처음에는 `titlePromise`에도 Ticket 객체 전체가 들어간다고 생각했다. 하지만 다음 Promise의 결과는 이전 Promise의 값이 자동 복사되는 것이 아니라 Handler가 실제로 반환한 값으로 결정된다.

```text
ticketPromise의 성공값
→ { id: 1, title: "로그인 오류" }

titlePromise의 성공값
→ "로그인 오류"
```

## `throw`는 다음 Promise를 실패시키고 성공 경로를 건너뛴다

다음 흐름을 Browser에서 실행했다.

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

프로그램 출력은 다음과 같았다.

```text
A
E
B 1
D Ticket 형식 오류
```

`A`와 `E`는 현재 Task에서 실행되고, 첫 번째 `then` Handler는 Microtask에서 `B 1`을 출력한다. 그 안의 `throw` 때문에 Handler가 반환할 다음 Promise는 rejected가 된다. 따라서 성공 Handler의 `C 저장 성공`은 실행되지 않고, 뒤의 `catch`가 Error를 받는다.

Browser Console에 함께 표시된 `undefined`는 입력한 전체 표현식의 평가 결과일 뿐 Promise 실패 메시지가 아니다.

## `async` Function도 항상 Promise를 반환한다

```javascript
async function loadTitle() {
    return "로그인 오류";
}

const result = loadTitle();
```

`loadTitle()`은 문자열을 호출자에게 그대로 반환하지 않는다. `"로그인 오류"`를 성공값으로 가진 Promise를 반환한다. `async` Function 내부의 `return`은 그 Function이 반환하는 Promise의 성공값을 결정한다고 이해했다.

`await`가 Async Function의 실행을 어디에서 나누는지는 [9월 18일 Study Note](./2026-09-18-study-questions.md)에 이어서 정리했다.

## 최종적으로 정리한 이해

이번 학습의 핵심을 다음과 같이 정리했다.

1. Microtask 실행 중 추가된 Microtask도 Queue가 빌 때까지 같은 Checkpoint에서 처리될 수 있다.
2. DOM 값 변경과 화면 Paint는 같은 사건이 아니다.
3. 긴 동기 Code는 JavaScript뿐 아니라 사용자 입력과 Rendering도 지연시킨다.
4. `requestAnimationFrame`은 Browser의 Rendering 주기에 맞춰 다음 작업을 예약하지만, Callback 안의 긴 동기 작업까지 자동으로 해결하지는 않는다.
5. Promise Executor는 생성 시 동기적으로 실행되고, `then` Handler는 Microtask에서 실행된다.
6. `resolve`는 Promise 결과를 결정하고, `then` Handler의 `return`은 다음 Promise의 결과를 결정한다.
7. Handler의 `throw`는 다음 Promise를 rejected로 만들고 뒤의 성공 경로를 건너뛰게 한다.

Promise의 역할은 다음 문장으로 기억한다.

> `resolve`는 결과를 확정하고, `then`은 후속 작업을 예약하며, Handler의 `return`은 값을 다음 Promise로 전달한다.
