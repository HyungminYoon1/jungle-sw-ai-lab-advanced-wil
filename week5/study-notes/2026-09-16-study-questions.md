# 2026-09-16 — Event Loop에서 Task와 Microtask가 실행되는 순서

> 날짜: 2026-09-16
> 학습 주제: 현재 Task, Microtask Queue, Timer Task의 실행 순서

## 핵심 질문

1. `queueMicrotask(...)` 호출과 전달한 Callback 실행은 각각 어느 시점에 일어나는가?
2. 현재 Task, Microtask와 다음 Timer Task는 어떤 순서로 처리되는가?
3. 먼저 등록한 Timer Callback보다 나중에 등록한 Microtask가 먼저 실행될 수 있는 이유는 무엇인가?
4. Microtask 실행 중 새 Microtask가 추가되면 다음 Task를 선택하기 전에 어디까지 처리되는가?
5. Console 출력 순서만으로 Browser의 실제 Paint 시점을 알 수 없는 이유는 무엇인가?

## 이번에 이해한 핵심

JavaScript에서 비동기 Callback을 등록했다고 해서 그 Callback이 즉시 실행되는 것은 아니다. 먼저 현재 Task의 동기 Code가 끝까지 실행된다. 그다음 Event Loop는 Microtask Queue가 빌 때까지 Callback을 처리하고, 이후에 새로운 Task를 선택한다.

```text
현재 Task의 동기 Code 실행
→ Microtask Queue가 빌 때까지 처리
→ Browser가 필요하면 Rendering할 기회를 얻음
→ Timer·Event 같은 다음 Task 실행
```

이번 학습에서는 `queueMicrotask`와 `setTimeout`을 함께 실행해 이 순서를 확인했다. 특히 다음 두 가지를 구분하는 것이 중요했다.

- `queueMicrotask(...)`나 `setTimeout(...)`을 호출하는 행위는 현재 동기 Code에서 실행된다.
- 두 함수에 전달한 Callback은 현재 위치에서 실행되지 않고 각 Queue에서 기다린다.

## `queueMicrotask` 호출과 Callback 실행은 다르다

다음 Code의 출력 순서를 먼저 예상했다.

```javascript
console.log("X");

queueMicrotask(() => {
    console.log("Y");
});

console.log("Z");
```

실제 출력 순서는 다음과 같다.

```text
X
Z
Y
```

처음에는 현재 Script에서 즉시 출력되는 값을 `X`만이라고 답했다. 최종 출력 순서는 맞혔지만, `Z`도 현재 Task에서 동기적으로 실행된다는 점을 빠뜨렸다.

내가 혼동한 것은 `queueMicrotask`의 호출과 전달한 Callback의 실행이었다. `queueMicrotask(...)` 호출 자체는 `X`와 `Z` 사이에서 실행된다. 하지만 그 호출은 `Y`를 출력하지 않고, `Y`를 출력할 Callback을 Microtask Queue에 등록하기만 한다.

```text
현재 Task
→ X 출력
→ Y Callback 등록
→ Z 출력

현재 Task가 끝난 뒤
→ Microtask Queue에서 Y 출력
```

따라서 “현재 실행 중인 함수 호출”과 “나중에 실행되도록 등록한 Callback”을 나누어 봐야 한다.

## Microtask가 Timer보다 먼저 실행되는 이유

다음으로 동기 Code, Microtask와 Timer를 한 예제에서 비교했다.

```javascript
console.log("start");

setTimeout(() => {
    console.log("timer");
}, 0);

queueMicrotask(() => {
    console.log("micro");
});

console.log("end");
```

Node.js와 Browser Console에서 확인한 프로그램 출력은 같았다.

```text
start
end
micro
timer
```

`start`와 `end`는 현재 Task의 동기 Code이므로 먼저 출력된다. `micro`는 현재 Task가 끝난 뒤 Microtask Queue에서 실행되고, `timer`는 그다음에 선택되는 Timer Task에서 실행된다.

처음에는 이 순서를 “Microtask의 우선순위가 Timer보다 높기 때문”이라고 표현했다. 결과를 기억하는 데에는 도움이 되지만, 동작 원리를 충분히 설명하지는 못한다. 내가 이해한 더 정확한 설명은 다음과 같다.

> 현재 Task가 끝나면 Event Loop는 Microtask Queue가 빌 때까지 처리하고, 그다음 새로운 Task를 선택한다. 따라서 먼저 등록된 Timer Callback이 있더라도 Microtask가 먼저 실행될 수 있다.

`setTimeout(callback, 0)`의 `0`도 “지금 즉시 실행”이라는 의미가 아니다. 최소 대기 시간이 지난 뒤 해당 Callback을 실행할 Timer Task가 선택될 수 있다는 의미에 가깝다.

## 실행 중 추가된 Microtask도 먼저 처리된다

Microtask 안에서 새로운 Microtask를 등록하면 어떻게 되는지도 확인했다.

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

Node.js와 Browser Console의 프로그램 출력은 다음과 같았다.

```text
A
E
B
C
D
```

처음 분류할 때 `B`를 “다음 Task에서 출력된다”고 적었다. 하지만 `B`는 Timer Task가 아니라 현재 Task가 끝난 뒤 실행되는 첫 번째 Microtask다. `B`가 실행되는 동안 `C` Callback이 Microtask Queue에 추가되고, Event Loop는 Queue가 빌 때까지 계속 처리한다. 그 결과 `C`까지 실행된 다음에야 Timer Task의 `D`가 실행된다.

```text
현재 Task
→ A 출력
→ B Microtask 등록
→ D Timer Task 등록
→ E 출력

Microtask Checkpoint
→ B 출력
→ C Microtask 등록
→ 새로 등록된 C 출력

다음 Timer Task
→ D 출력
```

나는 처음에 `C`가 `D`보다 먼저 실행되는 이유를 “`C`가 `B`의 Callback 안에 정의되어 있기 때문”이라고 설명했다. 하지만 Code가 안쪽에 있다는 사실만으로 실행 순서가 정해지는 것은 아니다. 중요한 것은 `B`가 실행되는 동안 `C`가 어느 Queue에 추가되는지, 그리고 Event Loop가 다음 Task를 선택하기 전에 Microtask Queue를 어디까지 처리하는지다.

따라서 올바르게 이해한 이유는 다음과 같다.

> `B` Microtask가 `C`를 같은 Microtask Queue에 추가하고, Event Loop가 그 Queue가 빌 때까지 처리하므로 `C`가 다음 Timer Task의 `D`보다 먼저 실행된다.

## Node.js와 Browser에서 확인한 범위

기본 예제와 중첩 Microtask 예제를 Node.js `v22.23.2`와 Browser Console에서 각각 실행했다. 두 환경에서 이번 예제의 프로그램 출력은 예상과 일치했다.

Browser Console에는 `VM324:...` 같은 임시 Source 위치나 `undefined`가 함께 표시되기도 했다. 이것들은 예제의 `console.log`가 출력한 값이 아니다. `VM...`은 DevTools가 입력한 Code에 붙인 위치 정보이고, `undefined`는 Console이 보여 준 Code 평가 결과다.

이번 결과만으로 Node.js와 Browser의 Event Loop가 모든 세부 조건에서 같다고 일반화할 수는 없다. 다만 사용한 두 예제에서는 다음 순서를 공통으로 확인했다.

```text
동기 Code
→ Microtask
→ 중첩 실행 중 추가된 Microtask
→ Timer Task
```

## Console 출력 순서와 화면 Rendering은 별개다

Browser Console에서 `start → end → micro → timer` 순서를 확인했다고 해서 화면이 언제 다시 그려졌는지까지 알 수 있는 것은 아니다.

JavaScript가 DOM 값을 변경하는 시점과 Browser가 그 변경을 실제 화면 Pixel로 Paint하는 시점은 다를 수 있다. Console 출력은 JavaScript Callback의 실행 순서를 보여 주지만, Rendering 시점을 직접 측정하지 않는다.

이 구분을 통해 다음 두 질문은 서로 다른 실험이 필요하다는 점을 알게 됐다.

- 어떤 JavaScript Callback이 먼저 실행되는가?
- DOM 변경이 사용자 화면에 언제 보이는가?

두 번째 질문은 이후 학습에서 Main Thread Blocking과 `requestAnimationFrame`을 이용해 확인했다. 관련 내용은 [9월 17일 Study Note](./2026-09-17-study-questions.md)에 이어서 정리했다.

## 최종적으로 정리한 이해

이번 학습을 통해 Event Loop의 기본 순서를 다음과 같이 이해했다.

1. 현재 Task의 동기 Code는 중간에 Microtask나 Timer Callback이 등록되어도 끝까지 실행된다.
2. 현재 Task가 끝나면 Event Loop는 Microtask Queue가 빌 때까지 처리한다.
3. Microtask 실행 중 새 Microtask가 추가되면 같은 Microtask Checkpoint에서 이어서 처리될 수 있다.
4. `setTimeout(..., 0)`의 Callback도 별도의 다음 Task이므로 Microtask 처리 뒤에 실행된다.
5. Callback의 Code가 어디에 작성되어 있는지만 보지 말고, 어느 Queue에 언제 추가되는지를 추적해야 한다.
6. Console 출력 순서만으로 Browser의 실제 Paint 시점을 판단해서는 안 된다.

가장 기억해야 할 문장은 다음과 같다.

> 현재 Task를 끝내고, Microtask Queue를 비운 뒤, 다음 Task를 선택한다.
