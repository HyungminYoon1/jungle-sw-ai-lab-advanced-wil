# 2026-09-18 — Async/Await 기본 흐름과 Week 5 후속 학습

> 날짜: 2026-09-18
> 상태: Partially Completed — Promise·Async/Await 기본 실행과 실패 전달 통과, Fetch 이후 미실시
> 실제 소요 시간: `NOT_RECORDED`
> 실행 환경: 일반 Browser Console, 제품·Version `NOT_RECORDED`

## 날짜 경계

9월 17일에는 Promise의 상태, Executor와 Handler의 실행 시점, Chain의 값 전달과 `throw`·`catch` 실패 전달을 학습했다. `async` Function이 항상 Promise를 반환한다는 개념 확인까지 9월 17일에 마쳤다.

`await` 기본 Case는 9월 17일에 제시했지만 사용자가 실제 Browser Console에서 실행한 시점은 9월 18일 00:30 KST 이후다. 따라서 개념 설명은 [9월 17일 Study Note](./2026-09-17-study-questions.md)에, Runtime 결과는 이 문서에 분리한다.

## `await` 기본 Case — Browser 실행

실행한 Code:

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

사용자가 전달한 Browser Console 출력:

```text
A
B
D
C 로그인 오류
undefined
```

실행 흐름:

```text
현재 동기 Code
→ A
→ showTitle() 호출
→ B
→ await에서 showTitle의 나머지 실행을 미룸
→ 호출자에게 제어 반환
→ D

Microtask
→ showTitle의 나머지 실행
→ C 로그인 오류
```

관찰:

- 이미 fulfilled된 Promise를 `await`해도 Async Function의 뒷부분은 현재 Call Stack에서 바로 이어서 실행되지 않았다.
- `await`는 Browser Main Thread 전체를 막지 않았으므로 호출자의 `D`가 먼저 실행됐다.
- `C 로그인 오류`는 Microtask에서 `showTitle`이 재개된 뒤 출력됐다.
- 마지막 `undefined`는 Browser Console이 입력문 평가 결과를 표시한 값이며 Promise 실패가 아니다.

판정: `ASYNC_AWAIT_BASIC_BROWSER_RUN_PASS`

## 동기·비동기 선행 개념 확인

Browser 실행 뒤 다음 두 항목을 자료 없이 설명하도록 요청했다.

```text
await가 미루는 것
await 동안 계속 실행될 수 있는 것
```

사용자는 두 항목 모두 아직 잘 모르겠다고 답하고, `await`가 동기·비동기 중 무엇인지와 동기·비동기의 기본 개념부터 자세한 설명을 요청했다.

판정: `BACKGROUND_KNOWLEDGE_REQUIRED`

- Browser 출력 순서를 재현한 사실과 그 원리를 독립적으로 설명하는 것은 별도 근거다.
- 이해되지 않은 상태에서 `try`·`catch`와 Fetch로 넘어가지 않는다.
- [JavaScript Promise와 Async/Await 기초](../study-docs/javascript-promise-async-await-basics.md)에 동기·비동기, Blocking·Non-blocking, 병렬 실행의 차이와 `await` 전후 실행 범위를 보완했다.
- 자료 보완은 이해 완료 근거가 아니며, 작은 동기·비동기 비교 Case부터 다시 확인한다.

### 선행 개념 설명 뒤 첫 재답변

사용자의 답변:

```text
await가 미루는 것: Promise 성공 값
await 동안 계속 실행될 수 있는 것: await이 기다리는 것을 제외한 나머지
```

교정이 필요한 지점:

- `await`가 성공 값 자체를 미루는 것은 아니다. 이미 fulfilled된 Promise도 사용할 수 있다.
- 미뤄지는 범위는 현재 Async Function에서 `await` 표현식의 결과에 의존하는 뒷부분이다.
- “나머지”는 범위가 모호하다. 먼저 현재 호출자의 나머지 동기 Code가 실행되고, 현재 Task와 Microtask 처리가 끝난 뒤 Event Loop가 다음 작업과 Rendering 기회를 선택할 수 있다.

판정: `ASYNC_AWAIT_SCOPE_REVIEW_REQUIRED`

다음 확인은 추상 문장 대신 실제 Code에서 미뤄지는 줄과 계속 실행되는 줄을 각각 지목한다.

### 실제 Code 범위 재확인

사용자의 답변:

```text
await 때문에 나중으로 미뤄지는 줄: showTitle()의 나머지 실행
showTitle이 멈춘 뒤 호출자에서 계속 실행되는 줄: console.log("D");
```

판정: `AWAIT_SCOPE_IDENTIFICATION_PASS`

- 현재 Async Function의 나머지와 호출자의 다음 줄을 구분했다.
- 다만 사용자는 정답을 식별한 뒤에도 기본 개념부터 다시 설명해 달라고 요청했다.
- 한 번의 줄 식별을 동기·비동기 전체 개념 이해로 확대하지 않는다.
- [JavaScript 동기·비동기 0단계](../study-docs/javascript-sync-async-foundations.md)를 별도 선행 자료로 추가하고 Function 호출·`return`부터 다시 학습한다.

## 동기 Function 호출과 `return`

일반 Function 호출에서 확인한 내용:

```javascript
function makeTitle() {
    console.log("B");
    return "로그인 오류";
}

console.log("A");
const title = makeTitle();
console.log("C", title);
```

사용자의 답변:

```text
makeTitle이 실행되는 동안 console.log("C", title)를 실행할 수 있는가:
아니요. 이전 작업이 끝날 때까지 대기하기 때문입니다.

return이 호출자에게 돌려주는 것:
반환값, 실행 위치
```

판정: `SYNC_FUNCTION_CALL_RETURN_PASS`

- 호출된 Function이 끝나기 전에는 호출자의 다음 줄을 실행하지 못한다고 구분했다.
- `return`이 반환값과 함께 호출자 쪽 실행 위치로 제어를 돌려준다고 설명했다.
- “이전 작업”은 현재 실행 위치가 `makeTitle` 안에 있고 아직 호출자로 복귀하지 않았다는 의미로 구체화했다.

## 오래 걸리는 동기 Function과 Blocking

약 1초 동안 동기 반복문을 실행하는 `makeTitleSlowly` Case를 제시했다.

사용자의 답변:

```text
while 반복문 실행 중 현재 실행 위치:
Function 안으로 이동

호출자의 console.log("C", title)를 실행할 수 없는 이유:
아직 Function 작업이 끝나지 않았기 때문
```

판정: `SYNC_BLOCKING_BASIC_PASS`

- 현재 실행 위치를 더 정확히는 `makeTitleSlowly` 안의 `while` 반복문이라고 구체화했다.
- Function이 아직 `return`하지 않아 실행 위치가 호출자로 돌아가지 않았다고 연결했다.
- 이 Case에서는 호출자뿐 아니라 Main Thread도 반복문에 점유돼 다른 JavaScript와 Paint가 지연될 수 있다.

## Timer Callback 등록과 실행 시점

다음 비동기 Timer Case를 제시했다.

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

### 최초 예상

사용자는 약 1초 동안 실행 위치가 `startTitleLater` 안에 머물며, Function이 끝난 뒤 `B`가 실행되므로 `A → C → B`라고 예상했다.

교정:

```text
startTitleLater의 현재 역할
→ Timer Callback 등록
→ Function 본문 종료
→ 호출자로 복귀

등록된 Callback
→ 약 1초 뒤 별도 Task에서 실행
```

### Browser 실행

사용자가 전달한 실제 출력:

```text
A
B
undefined
C 로그인 오류
```

- `B`는 `startTitleLater`가 Timer를 등록하고 즉시 종료한 뒤 출력됐다.
- `undefined`는 입력문 평가 결과이며 Timer 실패가 아니다.
- `C 로그인 오류`는 약 1초 뒤 Timer Callback Task에서 출력됐다.

교정 뒤 사용자의 독립 설명:

```text
startTitleLater가 지금 하는 일: Callback Function 등록
Timer Callback 실행 전에도 종료될 수 있는 이유: Callback 등록 후 해당 Function의 역할을 완료했기 때문
B가 C보다 먼저 출력되는 이유: startTitleLater가 종료되어 다음 줄인 console.log("B")가 실행되기 때문
```

판정: `TIMER_CALLBACK_PASS_AFTER_CORRECTION`

## Promise 객체 반환과 결과 결정 시점

Timer의 미래 결과를 Promise로 반환하는 다음 흐름을 학습했다.

```javascript
function loadTitleLater() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve("로그인 오류");
        }, 1000);
    });
}
```

### 최초 답변과 오개념

사용자의 최초 답변:

```text
loadTitleLater는 1초를 기다린 뒤 Promise를 반환한다.
호출 직후 titlePromise는 undefined다.
Microtask에서 진행한 Callback Function 반환이 결과를 확정한다.
```

세 답에는 Promise 객체를 반환하는 시점, Promise 결과가 결정되는 시점과 Handler가 결과를 사용하는 시점이 섞여 있었다.

```text
Promise 객체 반환
→ Timer Callback 실행 전, 즉시

Promise 결과 결정
→ Timer Callback 안에서 resolve("로그인 오류") 호출 시

then Handler 실행
→ 결정된 결과를 사용하는 후속 Microtask
```

판정: `PROMISE_RETURN_AND_SETTLEMENT_REVIEW_REQUIRED`

### 시점 분리 Browser 실험

`timerCallbackRan` Flag와 번호가 붙은 Log로 Promise 반환 전후를 관찰했다.

사용자가 전달한 실제 출력:

```text
1 시작
2 Function 진입
3 Executor 실행: Timer 등록
4 Promise 반환 직전 false
5 호출 직후 true false
Promise {<pending>}
6 Timer Callback 실행
7 resolve 호출 완료
8 then Handler 로그인 오류
```

관찰:

- `4 ... false`: Promise를 반환하기 직전까지 Timer Callback은 실행되지 않았다.
- `5 ... true false`: 호출자는 이미 Promise 객체를 받았지만 Timer Callback은 아직 실행되지 않았다.
- `Promise {<pending>}`: 마지막 `then(...)` 표현식이 새로 반환한 Promise를 DevTools가 평가 결과로 표시했다.
- `6`: Timer Callback이 나중 Task에서 실행됐다.
- `7`: `resolve` 뒤에도 같은 Timer Callback의 나머지 Code가 먼저 끝났다.
- `8`: Timer Task 종료 뒤 Microtask에서 `then` Handler가 성공 값을 받았다.

판정: `PROMISE_RETURN_TIMING_BROWSER_RUN_PASS`

이 실행은 반환 시점과 상태 변화의 Runtime 근거지만, 사용자의 독립 설명은 별도로 확인한다.

## Promise 상태·결과와 Microtask 구분

실행 뒤 사용자의 첫 재설명:

```text
loadTitleLater가 즉시 반환한 것: Promise 객체
약 1초 뒤 resolve가 변경한 것: Microtask 반환값
then Handler가 한 일: 나중에 받은 값으로 화면 갱신
```

판정: `PROMISE_STATE_RESULT_REVIEW_REQUIRED`

- 즉시 반환한 것이 Promise 객체라는 설명은 맞다.
- `resolve`가 바꾸는 것은 Microtask 반환값이 아니라 원래 Promise의 상태와 결과다.
- 이번 Handler는 화면을 갱신하지 않고 성공 값 `"로그인 오류"`를 받아 Console에 출력했다.
- Microtask는 값이나 상태 저장소가 아니라 `then` Handler를 나중에 실행하는 작업 단위다.

개념 구조:

```text
Timer Task
→ resolve("로그인 오류")

titlePromise
→ pending / 결과 없음
→ fulfilled / 결과 "로그인 오류"

Microtask
→ then Handler 실행
→ 결정된 성공 값 사용
```

## `pending`·`fulfilled`·`rejected`의 출처

사용자는 세 상태가 이번 예제에서 설정한 것인지 JavaScript에 정의된 것인지 질문했다.

설명한 내용:

- `pending`, `fulfilled`, `rejected`는 예제에서 만든 문자열이 아니라 ECMAScript Promise 사양에 정의된 내부 상태다.
- 정확히는 `if`, `return`과 같은 문법 Keyword가 아니라 JavaScript Runtime이 관리하는 Promise의 `[[PromiseState]]` 내부 슬롯 값이다.
- 새 Promise는 `pending`과 빈 결과로 생성된다.
- 이번처럼 일반 문자열로 `resolve("로그인 오류")`를 호출하면 Runtime이 Promise를 `fulfilled`로 만들고 결과를 저장한다.
- `reject(reason)`을 호출하면 `rejected`와 실패 이유가 저장된다.
- 개발자가 `promise.state = "fulfilled"`처럼 직접 설정하는 일반 Property가 아니다.
- DevTools의 `Promise {<pending>}` 표시는 내부 상태를 관찰하기 위한 도구 표시이며 표준 공개 Property가 아니다.

참고한 공식 자료:

- [ECMAScript — Promise Instances](https://tc39.es/ecma262/multipage/control-abstraction-objects.html#sec-properties-of-promise-instances)
- [MDN — Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)

판정: `PROMISE_STATE_SOURCE_EXPLAINED_NOT_ASSESSED`

공식 정의를 설명한 사실은 사용자의 독립 이해 근거가 아니다. 후속 확인에서 일반 Property와 내부 상태, `resolve`의 역할을 짧게 다시 확인한다.

### Promise 상태·Handler 역할 후속 확인

사용자의 답변:

```text
pending과 fulfilled:
JavaScript가 관리하는 내부 상태

resolve("로그인 오류")가 변경하는 대상:
resolve를 포함하고 있는 Promise의 상태 및 결과

Microtask에서 then Handler가 하는 일:
나중에 처리된 결과를 반영
```

판정: `PROMISE_STATE_RESULT_PASS_HANDLER_ROLE_REVIEW`

- `pending`과 `fulfilled`가 개발자가 추가한 일반 Property가 아니라 Runtime 내부 상태라고 구분했다.
- 이번 일반 문자열 Case에서 `resolve`가 연결된 Promise의 상태와 결과를 결정한다고 설명했다.
- “결과를 반영”은 대상과 동작이 모호하다. Runtime은 성공 값을 Handler 인자로 전달하고, 실제 Console 출력·DOM 변경·값 변환은 개발자가 작성한 Handler 본문에 따라 달라진다.
- 다음 확인에서는 이번 Handler가 받은 값과 실제 실행한 문장을 Code에서 지목한다.

### `then` Handler의 실제 문장과 DOM·Paint 경계

사용자의 답변:

```text
이번 then Handler의 title 인자가 받은 값:
titlePromise 성공값

이번 Handler가 실제 실행한 문장:
"로그인 오류"

then Handler가 항상 자동으로 화면을 갱신하는가:
아니요. 개발자가 Handler에 화면 변경 Code를 작성했을 때만 화면이 갱신됩니다.
```

판정: `THEN_HANDLER_CODE_IDENTIFICATION_PARTIAL`

- 첫 답은 개념상 맞지만 이번 정확한 값은 `"로그인 오류"`다.
- 두 번째 답은 실행문이 아니라 인자 값이다. 이번 실행문은 `console.log("8 then Handler", title)`이다.
- Handler가 자동으로 화면을 갱신하지 않는다는 설명은 맞다.

사용자는 다음 Code에 “화면을 새로 그리라”는 문장이 없는데 화면 갱신 Code가 어디에 있는지 질문했다.

```javascript
titlePromise.then((title) => {
    statusElement.textContent = title;
});
```

설명:

- `statusElement`가 Page에 연결된 DOM Element를 가리킨다면 `textContent` 대입이 DOM 내용을 변경하는 문장이다.
- 이 문장은 Pixel을 직접 다시 그리는 명령이 아니다.
- JavaScript가 DOM 값을 바꾸면 Browser가 변경을 기록하고, 현재 Task와 Microtask 처리가 끝난 뒤 Rendering 기회를 얻을 때 필요한 Style·Layout·Paint를 수행한다.
- 따라서 더 정확한 표현은 “Handler가 DOM을 변경하고 Browser가 나중 Rendering 기회에 그 변경을 화면에 반영한다”다.
- Element가 Page에 연결되지 않았거나 숨겨져 있다면 DOM 값이 바뀌어도 사용자가 화면에서 보지 못할 수 있다.

기존 [Browser JavaScript Event Loop 입문](../study-docs/browser-javascript-event-loop-basics.md)의 “Browser Rendering과 연결해서 본다”에서 DOM 값 변경과 실제 Paint가 같은 순간이 아님을 다룬다.

판정: `DOM_MUTATION_AND_PAINT_EXPLAINED_NOT_ASSESSED`

사용자의 독립 답변:

```text
statusElement.textContent = title이 직접 변경하는 것: DOM
실제 화면 Pixel을 나중에 갱신하는 주체: Browser
```

판정: `DOM_MUTATION_AND_BROWSER_PAINT_PASS`

- JavaScript의 DOM 변경과 Browser의 실제 화면 Rendering을 서로 다른 단계로 구분했다.
- 정확한 Paint 시점 자체를 측정한 것은 아니므로 `PAINT_TIMING_NOT_MEASURED` 경계는 유지한다.

### `then`과 `await`의 성공 결과 사용

`then` 방식과 `await` 방식을 나란히 제시한 뒤 사용자가 다음과 같이 답했다.

```text
await titlePromise가 titlePromise의 상태를 변경하는가:
아니요.

titlePromise가 성공한 뒤 showTitle에서 실행되는 DOM 변경 문장:
statusElement.textContent = title;
```

판정: `AWAIT_RESULT_CONSUMPTION_PASS`

- `resolve`가 Promise 상태와 결과를 결정하고 `await`는 그 결과를 소비한다는 역할을 구분했다.
- `await` 뒤 재개되는 Async Function의 DOM 변경 문장을 정확히 지목했다.

사용자는 `then` 방식과 `await` 방식이 사실상 동일한지 추가로 질문했다. 간단한 순차 성공 흐름에서는 같은 결과와 비동기 경계를 만들 수 있지만, 다음 차이를 후속 설명한다.

- `then`은 Handler를 등록하고 새 Promise를 즉시 반환한다.
- `await`는 Async Function 안에서 현재 Function의 나머지를 미루며, 그 Async Function 자체가 Promise를 반환한다.
- 실패는 `then`·`catch` Chain 또는 `await` 주위의 `try`·`catch`로 표현한다.
- 여러 작업의 시작 시점은 문법만으로 정해지지 않으며 연속 `await`는 작성 방식에 따라 작업을 직렬화할 수 있다.
- 입문 성공 Case의 유사성을 두 문법의 모든 객체·참조·제어 흐름이 완전히 같다는 뜻으로 확대하지 않는다.

설명 직후 사용자는 두 방식에서 나중 실행되는 범위를 다음과 같이 구분했다.

```text
then 방식에서 나중에 실행되는 부분:
then Handler

await 방식에서 나중에 실행되는 부분:
현재 Async Function의 뒷부분
```

판정: `THEN_AWAIT_DEFERRED_SCOPE_PASS`

- `then` 방식에서는 등록한 Handler가 나중 Microtask에서 실행된다.
- `await` 방식에서는 `await` 위의 Code가 먼저 실행되고, 해당 Async Function의 `await` 아래 나머지가 나중 재개된다.
- 두 표현이 같은 성공 흐름을 만들 수 있어도 나중 실행되는 Code를 구성하는 방식은 다르다는 점을 구분했다.

### `then`·`catch`와 `async`·`await`의 실패 처리

Promise가 `Error("Ticket 조회 실패")`로 실패하는 경우에 대해 사용자는 다음 실행 문장을 지목했다.

```text
then 방식에서 실행되는 부분:
statusElement.textContent = error.message;

await 방식에서 실행되는 부분:
statusElement.textContent = error.message;
```

판정: `THEN_AWAIT_FAILURE_BRANCH_PASS`

- 첫 번째 문장은 `.catch()` Handler 안에서 실행된다.
- 두 번째 문장은 `try`·`catch`의 `catch` Block 안에서 실행된다.
- 단순한 순차 성공·실패 흐름은 두 방식으로 같은 의도를 표현할 수 있다.
- 다만 `.then()`은 Handler를 연결해 새 Promise를 만들고, `await`는 현재 Async Function의 나머지 실행을 미루므로 객체와 제어 흐름까지 완전히 같은 문법이라고 표현하지 않는다.

### `throw` 뒤의 실패 복구와 최종 성공값

제목이 비어 있으면 `throw new Error("제목 없음")`을 실행하고, 실패 처리부가 `"제목 미입력"`을 반환하는 두 예제를 비교했다.

사용자의 답변:

```text
then 방식의 catch Handler가 받은 오류 메시지: "제목 없음"
catch Handler 반환 뒤 resultPromise 상태: 성공
resultPromise 성공값: ticket.title
async 방식에서 throw 뒤 이동하는 곳: .catch((error)
```

판정: `PROMISE_FAILURE_RECOVERY_PARTIAL`

- 오류 메시지와 실패 처리부가 정상값을 반환하면 최종 Promise가 성공한다는 점은 맞게 설명했다.
- `throw`가 실행되면 같은 Block 아래의 `return ticket.title`은 실행되지 않는다. 따라서 최종 성공값은 `catch` Handler가 반환한 `"제목 미입력"`이다.
- `.then()` 방식은 `.catch((error) => { ... })` Handler로 이동한다.
- `async`·`await` 예제는 `try`와 짝을 이루는 `catch (error) { ... }` Block으로 이동한다.
- 두 실패 처리 문법을 구분하고 실제 실행된 `return`을 추적하는 재확인이 필요하다.

재확인에서 사용자는 실행되지 않은 반환문과 실제 최종값을 결정한 반환문을 다음과 같이 구분했다.

```text
throw 때문에 실행되지 않은 반환문:
return ticket.title;

실제로 resultPromise의 성공값을 결정한 반환문:
return "제목 미입력";
```

판정: `PROMISE_FAILURE_RECOVERY_PASS`

- `throw` 이후 같은 정상 경로의 문장은 건너뛴다는 점을 확인했다.
- 실패 처리부의 정상 `return`이 최종 Promise를 `fulfilled`로 복구하고 그 반환값이 성공값이 된다는 점을 확인했다.

### `catch`의 `return`과 다시 `throw`하기

실패 처리부가 정상값을 반환하는 Case와 같은 오류를 다시 던지는 Case의 최종 Promise를 비교했다.

사용자의 첫 답변:

```text
recoveredPromise 최종 상태: fulfilled
recoveredPromise 성공값: "Ticket 조회 실패"
propagatedPromise 최종 상태: error
propagatedPromise 실패 메시지: "Ticket 조회 실패"
```

판정: `PROMISE_RECOVER_VS_RETHROW_PARTIAL`

- `catch`가 `return "임시 제목"`을 실행하면 최종 성공값은 최초 오류 메시지가 아니라 `"임시 제목"`이다.
- Promise의 표준 최종 실패 상태 이름은 `error`가 아니라 `rejected`다.
- `throw error`로 다시 전달한 실패 이유는 Error Object이며 그 `message`는 `"Ticket 조회 실패"`다.
- 상태, 성공값, 실패 이유를 별도 항목으로 구분하는 재확인이 필요하다.

재설명 뒤 사용자는 다음과 같이 답했다.

```text
catch가 "임시 제목"을 반환한 뒤에도 originalPromise의 상태:
rejected

catch가 반환한 후속 Promise의 상태와 성공값:
fulfilled, "임시 제목"

textContent 대입문이 없을 때 화면이 자동으로 바뀌는가:
아니요. DOM을 변경하라는 Code가 없기 때문입니다.
```

판정: `PROMISE_RECOVER_VS_RETHROW_PASS`

- 원래 작업의 실패를 보존하는 원본 Promise와 실패 처리 결과를 나타내는 후속 Promise를 구분했다.
- Handler의 `return`이 후속 Promise의 성공값을 결정한다는 점을 설명했다.
- Promise 결과 결정과 DOM Mutation이 별도 동작임을 구분했다.

### `catch`가 명시적인 값을 반환하지 않는 경우

실패 Handler에 `return`과 `throw`가 모두 없으면 Function이 암묵적으로 `undefined`를 반환한다는 Case를 확인했다.

사용자의 첫 답변:

```text
명시적인 return이 없는 catch Handler의 반환값: undefined
후속 Promise의 상태: rejected
후속 Promise의 성공값: fulfilled
실패를 계속 전달하는 방법: error를 던진다
```

판정: `CATCH_IMPLICIT_UNDEFINED_PARTIAL`

- 암묵적 반환값이 `undefined`라는 점과 `throw error`로 실패를 계속 전달한다는 점은 맞게 설명했다.
- Handler가 `throw` 없이 정상 종료했으므로 후속 Promise의 상태는 `fulfilled`다.
- `fulfilled`는 성공값이 아니라 상태 이름이며, 이 Case의 성공값은 `undefined`다.
- Promise 상태와 그 상태가 보관하는 결과를 구분하는 재확인이 필요하다.

재확인 답변:

```text
handledPromise의 상태: fulfilled
handledPromise의 성공값: undefined
```

판정: `CATCH_IMPLICIT_UNDEFINED_PASS`

- 실패 Handler가 정상 종료하면 후속 Promise가 성공한다는 점을 확인했다.
- `fulfilled`라는 상태와 `undefined`라는 성공값을 서로 다른 항목으로 구분했다.

## 근거 경계

- Browser 제품과 Version을 기록하지 않았으므로 특정 Browser Version에 대한 근거로 사용하지 않는다.
- 출력 결과는 `await` 기본 성공 흐름의 Runtime 근거다.
- `await`에서 미뤄지는 Async Function의 나머지와 호출자의 다음 줄을 Code에서 구분했고 Browser 기본 Case를 실행했다. 장기 지연 회상은 아직 `NOT_RUN`이다.
- 동기 Function 호출·`return`과 Timer Callback 등록·실행의 차이는 설명 통과 근거가 있다.
- Promise를 Timer 실행 전에 반환한다는 사실을 Browser에서 관찰했고, `resolve`가 Promise의 상태와 결과를 결정한다는 점을 후속 문답에서 설명했다.
- `then`·`catch`와 `async`·`await`의 성공·실패 분기, 원본·후속 Promise와 실패 복구를 교정 뒤 설명했다.
- Fetch의 HTTP 오류·Network 오류는 설명을 시작했지만 답변·실행 근거가 없어 `EXPLAINED_NOT_ASSESSED`, Runtime은 `NOT_RUN`이다.
- CORS, Event Delegation, XSS, Race, 최소 UI, Coverage·Lint와 Browser E2E는 `NOT_RUN`이다.
- PostgreSQL Adapter·Migration·Testcontainers Integration Test는 이 날짜에 수행하지 않았다.

## 다음 학습

1. Promise·`async`·`await` 핵심 흐름을 자료 없이 지연 회상한다.
2. Fetch의 HTTP `404`와 Network 실패를 `response.ok`와 Promise Reject로 구분한다.
3. 두 Local Origin에서 CORS Simple Request·Preflight·허용 Header를 실행한다.
4. Week 6 계획에 따라 실제 PostgreSQL 영속성과 최소 Browser 흐름으로 연결한다.
