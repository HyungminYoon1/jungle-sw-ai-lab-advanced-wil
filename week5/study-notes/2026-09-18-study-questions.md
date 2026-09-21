# 2026-09-18 — Async/Await와 Promise 결과·실패 흐름

> 날짜: 2026-09-18
> 학습 주제: 동기·비동기 실행, `await`, Promise 상태, 성공·실패 Chain

## 핵심 질문

1. `await`는 JavaScript 전체를 멈추는가, 현재 Async Function의 어느 부분을 미루는가?
2. Timer를 등록하는 Function은 Callback이 실행될 때까지 기다린 뒤 반환하는가?
3. Promise 객체가 호출자에게 반환되는 시점과 그 결과가 결정되는 시점은 어떻게 다른가?
4. `pending`, `fulfilled`, `rejected`는 개발자가 만든 Property인가, JavaScript Runtime의 내부 상태인가?
5. `then` Handler와 `await` 뒤의 Code는 같은 성공 결과를 어떻게 다른 형태로 사용하는가?
6. `catch`의 `return`, `throw`, 명시적 반환 없음은 후속 Promise의 상태와 값을 각각 어떻게 결정하는가?

## `await`는 현재 Async Function의 나머지를 미룬다

다음 예제를 Browser Console에서 실행했다.

```javascript
async function showTitle() {
    console.log("B");

    const title = await Promise.resolve("로그인 오류");

    console.log("C", title);
}

console.log("A");
showTitle();
console.log("D");
```

프로그램 출력은 다음과 같았다.

```text
A
B
D
C 로그인 오류
```

실행 흐름을 나누면 다음과 같다.

```text
현재 동기 Code
→ A 출력
→ showTitle() 호출
→ B 출력
→ await에서 showTitle의 나머지 실행을 미룸
→ showTitle()은 호출자에게 Promise를 반환
→ 호출자의 D 출력

Microtask
→ showTitle의 await 아래 부분 재개
→ C 로그인 오류 출력
```

처음에는 `await`가 “Promise의 성공값을 미룬다”고 생각했다. 하지만 값 자체를 미루는 것이 아니다. 이번 Promise는 이미 `fulfilled` 상태인데도 `await` 아래의 Code는 현재 Call Stack에서 바로 이어서 실행되지 않았다.

정확히는 `await`가 현재 Async Function의 실행을 나누고, 기다린 결과가 준비되면 그 Function의 나머지를 나중에 재개한다. 그동안 호출자는 다음 동기 Code를 계속 실행할 수 있다.

따라서 `await`를 만났을 때는 다음 두 위치를 나누어 봐야 한다.

- 나중으로 미뤄지는 부분: 현재 Async Function에서 `await` 아래의 나머지
- 먼저 계속 실행되는 부분: Async Function을 호출한 쪽의 다음 동기 Code

`await`가 Browser Main Thread 전체를 멈추는 것은 아니다. 다만 `await` 이전이나 재개 이후에 긴 동기 Code를 실행한다면 그 Code는 여전히 Main Thread를 막을 수 있다.

## 동기 Function은 `return`할 때까지 호출자를 멈춘다

동기와 비동기를 구분하기 위해 일반 Function 호출부터 다시 살펴봤다.

```javascript
function makeTitle() {
    console.log("B");
    return "로그인 오류";
}

console.log("A");
const title = makeTitle();
console.log("C", title);
```

`makeTitle()`이 실행되는 동안에는 호출자의 `console.log("C", title)`을 실행할 수 없다. 현재 실행 위치가 `makeTitle` 안에 있고 아직 호출자에게 돌아오지 않았기 때문이다.

`return`은 두 가지를 호출자에게 돌려준다.

- Function이 계산한 반환값
- 호출 다음 줄에서 계속 실행할 수 있도록 제어권

만약 `makeTitle` 안에 1초 동안 실행되는 `while` 반복문이 있다면 호출자는 그동안 다음 줄로 진행하지 못한다. 같은 Main Thread의 다른 JavaScript와 Browser Paint도 지연될 수 있다. 이것이 동기 Blocking이다.

## Timer 등록은 기다림과 실행을 분리한다

다음 Code에서는 Timer를 등록한다.

```javascript
function startTitleLater() {
    setTimeout(() => {
        console.log("C 로그인 오류");
    }, 1000);
}

console.log("A");
startTitleLater();
console.log("B");
```

처음에는 `startTitleLater()`가 약 1초 동안 내부에서 기다리기 때문에 `A → C → B`가 될 것으로 생각했다.

하지만 `startTitleLater()`가 현재 하는 일은 Timer Callback을 등록하는 것뿐이다. 등록을 마치면 Function 본문이 끝나고 호출자에게 즉시 돌아온다. Callback은 나중에 별도의 Timer Task에서 실행된다.

```text
현재 Task
→ A 출력
→ startTitleLater() 호출
→ Timer Callback 등록
→ startTitleLater() 종료
→ B 출력

약 1초 이후 선택된 Timer Task
→ C 로그인 오류 출력
```

Browser 출력도 `A → B → C 로그인 오류` 순서였다. 이때 1초는 Callback이 정확히 그 시각에 실행된다는 보장이 아니라, Timer Task가 실행될 수 있기 전의 최소 지연 조건에 가깝다.

이 예제에서 비동기라는 말은 JavaScript가 1초 동안 다른 Thread에서 Function 내부를 계속 실행한다는 뜻이 아니다. 지금은 Callback만 등록하고 호출자가 계속 진행하며, 나중에 Event Loop가 Callback을 실행할 Task를 선택한다는 뜻이다.

## Promise 객체는 즉시 반환되고 결과는 나중에 결정될 수 있다

Timer의 미래 결과를 Promise로 표현했다.

```javascript
function loadTitleLater() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve("로그인 오류");
        }, 1000);
    });
}

const titlePromise = loadTitleLater();

titlePromise.then((title) => {
    console.log(title);
});
```

처음에는 `loadTitleLater()`가 1초를 기다린 뒤 Promise를 반환하고, 호출 직후의 `titlePromise`는 `undefined`라고 생각했다. Promise 객체가 반환되는 시점, Promise 결과가 결정되는 시점과 Handler가 결과를 사용하는 시점을 한 사건으로 섞은 것이었다.

세 시점은 다음처럼 나뉜다.

```text
1. loadTitleLater() 호출
   → Promise Executor가 동기적으로 실행되어 Timer 등록
   → pending 상태의 Promise 객체를 즉시 반환

2. 나중 Timer Callback 실행
   → resolve("로그인 오류") 호출
   → 원래 Promise를 fulfilled 상태와 결과 "로그인 오류"로 결정

3. Timer Task 종료 뒤 Microtask
   → then Handler가 성공값 "로그인 오류"를 받아 실행
```

Browser에서 Log 순서를 나누어 확인했을 때도 Promise는 Timer Callback 실행 전에 호출자에게 반환됐다.

```text
Function 진입
→ Executor가 Timer 등록
→ pending Promise 반환
→ 호출자가 Promise 객체를 받음
→ 나중 Timer Callback 실행
→ resolve 호출
→ Timer Callback의 나머지 Code 종료
→ Microtask에서 then Handler 실행
```

`resolve`를 호출하자마자 현재 Timer Callback을 중단하고 `then` Handler로 이동하는 것도 아니다. `resolve` 뒤의 동기 Code가 먼저 끝나고, Handler는 Microtask에서 실행된다.

## Promise 상태와 Microtask는 서로 다른 개념이다

처음에는 `resolve`가 “Microtask 반환값을 바꾼다”고 설명했다. 이것은 Promise의 상태 저장과 Handler 실행 Queue를 섞은 표현이었다.

각 역할을 분리하면 다음과 같다.

```text
Promise 객체
→ 상태와 결과를 보관
→ pending / 결과 없음
→ fulfilled / 결과 "로그인 오류"

Microtask
→ 이미 결정된 결과를 사용할 then Handler를 나중에 실행
```

Microtask는 Promise의 값이나 상태를 보관하는 저장소가 아니다. 실행해야 할 Callback을 Queue에서 처리하는 작업 단위다.

## `pending`·`fulfilled`·`rejected`는 Runtime 내부 상태다

`pending`, `fulfilled`, `rejected`가 예제에서 임의로 만든 문자열인지 JavaScript에 정해진 값인지 궁금했다.

이들은 개발자가 `promise.state`에 직접 넣는 일반 Property가 아니다. ECMAScript Promise 사양에 정의되어 있고 JavaScript Runtime이 관리하는 `[[PromiseState]]` 내부 슬롯의 상태다. `if`나 `return`처럼 Source Code에 직접 사용하는 문법 Keyword도 아니다.

```text
새 Promise
→ pending

성공적으로 결정
→ fulfilled + 성공값

실패로 결정
→ rejected + 실패 이유
```

DevTools의 `Promise {<pending>}` 표시는 이 내부 상태를 관찰하기 위한 도구의 표현이다. 표준 공개 Property를 읽은 결과가 아니다.

Promise가 한 번 `fulfilled` 또는 `rejected`로 결정되면 원래 Promise의 상태와 결과를 다른 값으로 다시 바꾸지 않는다. 이후 `then`이나 `catch`로 값을 변환하거나 실패를 복구할 때는 원래 Promise를 수정하는 것이 아니라 새로운 후속 Promise가 만들어진다.

참고한 공식 자료:

- [ECMAScript — Promise Instances](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-properties-of-promise-instances)
- [MDN — Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)

## Handler는 작성한 Code만 실행한다

처음에는 `then` Handler가 결과를 “반영한다”고만 설명했다. 하지만 무엇에 어떻게 반영되는지는 Handler 본문에 달려 있다.

```javascript
titlePromise.then((title) => {
    console.log(title);
});
```

이 Handler는 성공값을 `title` 인자로 받아 Console에 출력한다. 화면을 자동으로 바꾸지는 않는다.

```javascript
titlePromise.then((title) => {
    statusElement.textContent = title;
});
```

이 Handler에는 DOM을 바꾸는 문장이 명시되어 있다. `statusElement.textContent = title`이 DOM Element의 Text를 변경한다.

처음에는 Code에 “화면을 다시 그린다”는 명령이 없는데 어떻게 화면이 바뀌는지 이해되지 않았다. JavaScript가 직접 Pixel을 그리는 것이 아니라 DOM을 변경하고, Browser가 이후 Rendering 기회에 Style·Layout·Paint를 수행한다는 점을 구분해야 했다.

```text
then Handler
→ statusElement.textContent 변경
→ DOM 변경

Browser
→ 이후 Rendering 기회에 화면 Pixel 반영
```

따라서 Promise가 성공했다고 화면이 자동으로 갱신되는 것도 아니고, DOM을 변경한 순간 Paint까지 즉시 끝나는 것도 아니다.

## `then`과 `await`은 같은 결과를 다른 구조로 사용한다

간단한 성공 흐름은 `then`과 `await` 두 방식으로 표현할 수 있다.

```javascript
titlePromise.then((title) => {
    statusElement.textContent = title;
});
```

```javascript
async function showTitle() {
    const title = await titlePromise;
    statusElement.textContent = title;
}
```

두 예제 모두 `titlePromise`의 성공값을 받아 DOM에 사용한다. 하지만 실행 구조가 완전히 같은 문법은 아니다.

- `then`은 Handler를 등록하고 다음 Chain을 나타내는 새 Promise를 즉시 반환한다.
- `await`는 현재 Async Function의 나머지를 미루고, 결과가 준비되면 `await` 아래에서 Function을 재개한다.
- Async Function 자체도 호출자에게 Promise를 반환한다.
- 실패는 `then`·`catch` Chain 또는 `await` 주변의 `try`·`catch`로 처리할 수 있다.

내가 기억할 차이는 다음과 같다.

```text
then 방식에서 나중에 실행되는 부분
→ 등록한 Handler

await 방식에서 나중에 실행되는 부분
→ 현재 Async Function에서 await 아래의 나머지
```

연속된 `await`는 Code 작성 방식에 따라 작업 시작을 직렬화할 수 있으므로, 두 문법이 보이는 모양만 바꾼 완전히 동일한 구조라고 단정해서는 안 된다.

## `throw` 뒤에는 정상 경로의 `return`이 실행되지 않는다

제목이 없을 때 오류를 던지는 흐름을 살펴봤다.

```javascript
const resultPromise = Promise.resolve({ title: "" })
    .then((ticket) => {
        if (!ticket.title) {
            throw new Error("제목 없음");
        }

        return ticket.title;
    })
    .catch(() => {
        return "제목 미입력";
    });
```

처음에는 최종 성공값이 `ticket.title`이라고 생각했다. 하지만 `throw`가 실행되면 같은 Handler의 정상 경로에 있는 `return ticket.title`에는 도달하지 않는다.

```text
빈 title 확인
→ throw new Error("제목 없음")
→ 정상 경로의 return ticket.title 건너뜀
→ catch Handler 실행
→ return "제목 미입력"
→ resultPromise는 fulfilled("제목 미입력")
```

실패 처리부가 정상값을 반환하면 실패를 성공값으로 복구할 수 있다. 원래 오류가 없었던 일이 되는 것은 아니며, 실패한 원본 Promise와 복구 결과를 나타내는 후속 Promise는 서로 다른 객체다.

## `catch`의 종료 방식이 후속 Promise를 결정한다

같은 실패에서 `catch`가 어떻게 끝나는지 비교했다.

```javascript
const originalPromise = Promise.reject(
    new Error("Ticket 조회 실패")
);

const recoveredPromise = originalPromise.catch(() => {
    return "임시 제목";
});

const propagatedPromise = originalPromise.catch((error) => {
    throw error;
});

const handledPromise = originalPromise.catch(() => {
    // 명시적인 return이나 throw 없음
});
```

결과는 다음과 같다.

| Promise | 최종 상태 | 성공값 또는 실패 이유 |
|---|---|---|
| `originalPromise` | `rejected` | `Error("Ticket 조회 실패")` |
| `recoveredPromise` | `fulfilled` | `"임시 제목"` |
| `propagatedPromise` | `rejected` | 원래 Error Object |
| `handledPromise` | `fulfilled` | `undefined` |

처음에는 `recoveredPromise`의 성공값이 원래 오류 메시지라고 생각했다. 실제 성공값은 `catch` Handler가 반환한 `"임시 제목"`이다.

또한 실패 상태 이름을 `error`라고 적었지만 Promise의 표준 상태 이름은 `rejected`다. Error Object는 상태 이름이 아니라 실패 이유다.

명시적인 `return`이 없는 `catch` Handler는 일반 Function처럼 `undefined`를 반환한다. Handler가 `throw` 없이 정상 종료했으므로 후속 Promise는 `fulfilled`가 되고 성공값은 `undefined`다. 실패를 계속 전달하려면 `throw error`처럼 다시 던져야 한다.

이 비교를 통해 Promise를 설명할 때 다음 세 항목을 섞지 않아야 한다는 점을 배웠다.

- 상태: `pending`, `fulfilled`, `rejected`
- 성공 결과: 문자열·객체·`undefined` 같은 값
- 실패 이유: Error Object 또는 Reject된 값

## 최종적으로 정리한 이해

이번 학습에서 다음 오개념을 바로잡았다.

1. `await`는 성공값 자체나 JavaScript 전체를 멈추는 것이 아니라 현재 Async Function의 나머지를 미룬다.
2. Timer 등록 Function은 Callback 실행을 기다리지 않고 등록 뒤 호출자에게 돌아온다.
3. Promise 객체 반환, `resolve`를 통한 결과 결정과 Handler 실행은 서로 다른 시점이다.
4. Promise 상태는 Microtask에 저장되는 값이 아니라 Runtime이 Promise 객체에 관리하는 내부 상태다.
5. `then`이나 `await`이 화면을 자동으로 바꾸지 않으며, DOM 변경 Code가 명시적으로 있어야 한다.
6. `catch`가 값을 반환하면 후속 Promise는 복구되고, 다시 던지면 실패가 전파된다.
7. `catch`가 아무 값도 반환하지 않고 정상 종료하면 후속 Promise는 `fulfilled(undefined)`가 된다.

Promise의 전체 흐름은 다음 문장으로 정리할 수 있다.

> Promise 객체는 먼저 반환될 수 있고, 결과는 나중에 결정되며, Handler는 그 결과를 Microtask에서 사용해 새로운 Promise의 상태와 값을 만든다.
