# JavaScript 동기·비동기 0단계 — 함수 호출, `return`과 `await`

> 작성일: 2026-09-18
> 상태: Ready — 자료 작성은 이해 완료 근거가 아니며 재설명·실행 검증 필요
> 후속 자료: [JavaScript Promise와 Async/Await 기초](./javascript-promise-async-await-basics.md)

## 이 문서에서 확인할 것

1. Function을 호출하면 실행 위치가 어떻게 이동하는가?
2. `return`은 값 외에 무엇을 호출자에게 돌려주는가?
3. 동기 Function이 오래 걸리면 왜 Browser가 멈추는가?
4. 비동기 Function은 최종 결과 대신 무엇을 먼저 반환하는가?
5. `await`는 정확히 어느 Function의 어느 부분을 미루는가?

Promise 상태와 Microtask 세부 규칙을 외우기 전에 위 다섯 질문부터 이해한다.

## 1. JavaScript는 현재 실행할 위치를 가진다

다음 Code는 위에서 아래로 실행된다.

```javascript
console.log("A");
console.log("B");
console.log("C");
```

```text
A
→ B
→ C
```

입문 단계에서는 “현재 JavaScript가 어느 줄을 실행하고 있는가”를 **실행 위치**라고 생각한다.

현재 실행 중인 Function이 다른 Function을 호출하면 실행 위치가 호출된 Function 안으로 이동한다.

## 2. Function을 호출하면 호출자에서 호출된 Function으로 이동한다

```javascript
function makeTitle() {
    console.log("함수 안");
    return "로그인 오류";
}

console.log("호출 전");
const title = makeTitle();
console.log("호출 후", title);
```

용어:

- 호출자: 다른 Function을 부른 쪽. 이 예제에서는 바깥 Script다.
- 호출된 Function: 실행을 요청받은 쪽. 이 예제에서는 `makeTitle`이다.

실행 흐름:

```text
바깥 Script
→ "호출 전" 출력
→ makeTitle() 호출

makeTitle 안
→ "함수 안" 출력
→ "로그인 오류" 반환

바깥 Script로 복귀
→ 반환값을 title에 저장
→ "호출 후 로그인 오류" 출력
```

구조로 그리면 다음과 같다.

```text
호출자 Script
    │
    │ makeTitle() 호출
    ▼
makeTitle 실행
    │
    │ return "로그인 오류"
    ▼
호출자 Script의 호출 다음 지점으로 복귀
```

## 3. `return`은 값과 실행 위치를 돌려준다

`return`은 두 가지 일을 한다.

```text
1. 현재 Function 실행을 끝낸다.
2. 호출자에게 값과 실행 위치를 돌려준다.
```

```javascript
function add(left, right) {
    return left + right;
    console.log("실행되지 않음");
}

const result = add(2, 3);
console.log(result); // 5
```

`return` 뒤의 Code는 실행되지 않는다. 호출자는 `add(2, 3)`을 호출했던 지점으로 돌아와 다음 줄을 계속 실행한다.

## 4. 이것이 동기 호출이다

동기 호출에서는 호출자가 호출된 Function의 완료를 기다린다.

```text
호출자 실행
→ Function 호출
→ 호출된 Function 완료까지 호출자 중단
→ return
→ 호출자 재개
```

“기다린다”는 것은 호출자가 별도로 움직이면서 시간을 세고 있다는 뜻이 아니다. 지금 실행 위치가 호출된 Function 안에 있으므로 호출자 다음 줄을 아직 실행할 수 없다는 뜻이다.

### 동기 작업이 길어지면

```javascript
function blockForOneSecond() {
    const startedAt = performance.now();

    while (performance.now() - startedAt < 1000) {
        // 현재 JavaScript 실행 위치가 이 반복문 안에 머문다.
    }
}

console.log("시작");
blockForOneSecond();
console.log("종료");
```

약 1초 동안 다음 상태가 된다.

```text
호출자
→ blockForOneSecond가 끝나지 않아 다음 줄로 갈 수 없음

Main Thread
→ 반복문을 계속 실행하므로 다른 JavaScript 실행과 Paint가 지연됨
```

동기는 나쁘다는 뜻이 아니다. 계산이 짧고 바로 결과를 내야 하는 많은 Code는 동기가 자연스럽다. 문제는 Main Thread에서 오래 걸리는 동기 작업이다.

## 5. 결과가 지금 준비되지 않는 작업

Network Request처럼 결과가 나중에 도착하는 작업을 생각한다.

```text
지금 Request 시작
→ Server 처리와 Network 이동
→ 나중에 Response 도착
```

Response가 올 때까지 JavaScript가 빈 반복문을 돌며 Main Thread를 계속 점유하면 Browser가 멈춘다.

비동기 방식에서는 다음처럼 흐름을 나눈다.

```text
지금
→ 작업 시작
→ 최종 결과 대신 미래 결과를 나타내는 객체를 먼저 반환
→ 호출자 계속 실행

나중
→ 결과 준비
→ 등록한 후속 처리 실행
```

JavaScript에서는 Promise가 미래 결과를 나타내는 객체로 자주 사용된다.

## 6. 비동기 Function을 호출해도 호출 자체는 지금 실행된다

```javascript
function loadTitleLater() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve("로그인 오류");
        }, 1000);
    });
}

console.log("A");
const titlePromise = loadTitleLater();
console.log("B");

titlePromise.then((title) => {
    console.log("C", title);
});
```

현재 실행:

```text
A
→ loadTitleLater 호출
→ Timer 등록
→ 최종 문자열 대신 Promise 반환
→ B
→ then Handler 등록
```

나중 실행:

```text
Timer Callback
→ resolve("로그인 오류")
→ Promise 성공 결과 결정

Promise Handler
→ C 로그인 오류
```

비동기 Function을 호출한다는 말이 그 Function의 모든 줄이 나중에 실행된다는 뜻은 아니다.

```text
지금 실행되는 부분
→ Function 호출
→ 작업 시작과 Handler 등록
→ Promise 반환

나중 실행되는 부분
→ 결과가 준비된 뒤의 Callback·Promise Handler
```

## 7. `async` Function은 Promise를 반환한다

```javascript
async function loadTitle() {
    return "로그인 오류";
}

const result = loadTitle();
```

`result`는 문자열이 아니다.

```text
result
→ Promise
→ 성공 값: "로그인 오류"
```

하지만 `async`가 붙었다는 이유만으로 Function 본문 전체가 나중에 실행되는 것은 아니다.

```javascript
async function example() {
    console.log("함수 시작");
    return "완료";
}

console.log("A");
const result = example();
console.log("B");
```

```text
A
→ 함수 시작
→ B
```

`example()`을 호출하면 Function 본문은 즉시 시작한다. `async`의 핵심은 호출 결과가 항상 Promise라는 점이다.

## 8. `await`는 현재 Async Function을 두 부분으로 나눈다

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

`showTitle`을 `await` 경계로 나눈다.

```text
첫 번째 부분
→ B 출력
→ await 오른쪽 식 평가

두 번째 부분
→ await 성공 값을 title에 대입
→ C 출력
```

실행 흐름:

```text
호출자 Script
→ A
→ showTitle() 호출

showTitle 첫 번째 부분
→ B
→ await 도착
→ showTitle 두 번째 부분을 지금 실행하지 않음
→ 호출자에게 실행 위치 반환

호출자 Script 재개
→ D

Microtask
→ showTitle 두 번째 부분 재개
→ title 대입
→ C 로그인 오류
```

핵심:

```text
await가 미루는 것
→ 현재 Async Function에서 await 결과를 사용하는 뒷부분

그동안 먼저 계속되는 것
→ 그 Async Function을 호출한 쪽의 남은 Code
```

이 예제에서는 다음과 같다.

```text
미뤄짐: showTitle 안의 title 대입 완료와 C 출력
계속됨: 호출자 Script의 D 출력
```

## 9. `await`는 성공 값 자체를 미루지 않는다

```javascript
Promise.resolve("로그인 오류")
```

위 Promise는 이미 성공 값이 결정돼 있다. 그래도 `await` 뒤의 Function 실행은 현재 Call Stack에서 바로 이어지지 않는다.

```text
이미 준비된 값
→ "로그인 오류"

await가 미루는 것
→ 그 값을 사용해야 하는 현재 Async Function의 뒷부분
```

따라서 “`await`가 Promise 성공 값을 미룬다”는 표현은 정확하지 않다.

## 10. `await`는 비동기 작업을 새로 만들지 않는다

```javascript
const result = await someOperation();
```

다음 순서로 본다.

```text
1. someOperation()을 먼저 호출한다.
2. 그 호출 결과를 Promise 방식으로 처리한다.
3. 현재 Async Function의 뒷부분을 미룬다.
4. 호출자에게 실행 위치를 돌려준다.
5. Promise 결과가 준비되면 현재 Async Function을 재개한다.
```

`someOperation()` 안에 긴 동기 반복문이 있다면 그 반복문은 먼저 실행되며 Main Thread를 막을 수 있다. `await`가 이미 실행 중인 동기 Code를 자동으로 다른 Thread로 옮기지는 않는다.

## 11. 질문에 대한 가장 짧은 답

### 동기란?

```text
호출자가 Function의 최종 결과가 반환될 때까지 호출 다음 줄로 진행하지 않는 실행 방식
```

### 비동기란?

```text
최종 결과가 준비되기 전에 호출자에게 제어를 돌려주고,
결과를 나중에 Callback이나 Promise Handler로 전달하는 실행 방식
```

### `await`는 동기인가, 비동기인가?

```text
Promise 기반 비동기 흐름을 다루는 문법이다.
현재 Async Function의 앞부분은 지금 실행하고,
await 뒤의 뒷부분은 나중에 재개한다.
```

Code 모양은 위에서 아래로 읽는 동기 Code와 비슷하지만 실행 경계는 비동기다.

## 12. 최소 기억 문장

```text
일반 Function 호출
→ return까지 호출자가 기다린다.

비동기 작업
→ 최종 결과 대신 Promise를 먼저 돌려준다.

await
→ 현재 Async Function의 뒷부분을 미루고 호출자를 계속 실행시킨다.
```

## 이해 확인과 근거 경계

- 이 문서를 읽은 사실은 개념 이해 완료 근거가 아니다.
- 실제 Code에서 호출자와 호출된 Function을 각각 지목한다.
- 동기 Case와 Promise Case에서 호출자가 각각 무엇을 받는지 설명한다.
- `await` Case에서 미뤄지는 줄과 계속 실행되는 호출자 줄을 구분한다.
- Browser 실행 결과와 자신의 설명이 일치한 뒤 후속 Promise 오류 처리로 이동한다.

## 공식 참고 자료

- [MDN — Introducing asynchronous JavaScript](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Async_JS/Introducing)
- [MDN — async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
- [MDN — await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await)
- [MDN — JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model)
