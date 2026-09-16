# 2026-09-16 — Event Loop 기본 순서 예상과 Runtime 비교

> 날짜: 2026-09-16
> 상태: Session Paused — 기본 Runtime 실행 통과, 중첩 Microtask 원인 재설명은 날짜 경계에서 미완료
> 실제 소요 시간: `NOT_RECORDED`
> 실행 근거: Node.js 기본 Case `RUN`, Browser Console 기본 Case `RUN`, Rendering Timing `NOT_RUN`

## 날짜와 학습 범위

9월 14일에는 Timer 등록과 Callback 실행 시점, 현재 동기 Code와 Promise Microtask의 순서를 혼동했다. 9월 15일에는 개인 일정으로 학습을 진행하지 못했다. 9월 16일에는 [9월 14일 Study Note](./2026-09-14-study-questions.md)의 미응답 Case부터 다시 시작했다.

이번 기록은 다음 범위까지만 다룬다.

- `queueMicrotask` 기본 Case의 독립 예상과 교정
- 현재 Task·Microtask·다음 Timer Task 순서의 독립 설명
- 같은 기본 Case의 Node.js 실행
- 같은 기본 Case의 Browser Console 실행
- Runtime 출력과 Browser Rendering 근거의 구분

중첩 Microtask, Main Thread Blocking, `requestAnimationFrame`, Promise·`async`·`await`, Fetch, CORS와 UI 상태 모델은 아직 수행하지 않았다.

## 1. 단순 `queueMicrotask` Case

제시한 Code:

```javascript
console.log("X");

queueMicrotask(() => {
    console.log("Y");
});

console.log("Z");
```

사용자의 최초 답변:

```text
현재 Script에서 즉시 출력되는 값: X
Microtask Queue에서 기다리는 값: Y
최종 출력 순서: X → Z → Y
Y가 Z보다 늦게 실행되는 이유:
queueMicrotask 호출 시 바로 실행하는 것이 아니라
현재 동기 실행에서 Callback 등록만 하기 때문
```

최종 출력 순서와 이유는 맞았다. 다만 현재 Script에서 동기적으로 출력되는 값은 `X`만이 아니라 `X`와 `Z`다. `queueMicrotask` 호출은 현재 Code에서 동기적으로 실행되지만, 전달한 Callback은 Microtask Queue에서 기다린다.

교정한 분류:

```text
현재 Script Task
→ X 출력
→ queueMicrotask Callback 등록
→ Z 출력

현재 Task 종료 뒤 Microtask
→ Y 출력

최종: X → Z → Y
```

판정: `PASS_AFTER_CORRECTION`

## 2. 동기 Code·Microtask·Timer Task Case

제시한 Code:

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

사용자는 실행 전에 다음처럼 예상했다.

```text
현재 Script에서 출력되는 값: start, end
Microtask Queue에서 기다리는 값: micro
다음 Task로 기다리는 값: timer
최종 출력 순서: start → end → micro → timer
```

출력 예상과 Queue 분류는 모두 맞았다. 처음에는 `micro`가 `timer`보다 먼저 실행되는 이유를 “Microtask Queue의 우선순위가 더 높기 때문”이라고 설명했다. 이를 막연한 우선순위 비교가 아니라 Event Loop의 처리 순서로 다시 설명했다.

사용자의 최종 설명:

> 현재 Task가 끝나면 Microtask Queue가 빌 때까지 처리하고, 그다음 새로운 Task를 선택하므로 `micro`가 `timer`보다 먼저 실행된다.

판정: `PASS`

## 3. Node.js 실행

> 실행 환경: Node.js `v22.23.2`

예상 뒤 같은 기본 Case를 Node.js에서 실행했다.

실제 출력:

```text
start
end
micro
timer
```

예상과 실제 출력이 일치했다.

판정: `NODE_BASIC_CASE_PASS`

이 결과는 이번 기본 Case에서 Node.js의 동기 Code, `queueMicrotask` Callback과 Timer Callback의 출력 순서를 확인한 근거다. Node.js에는 Browser DOM과 Rendering 과정이 없으므로 Browser Paint Timing의 근거는 아니다.

## 4. Browser Console 실행

> 실행 환경: Browser DevTools Console, Browser 제품·Version `NOT_RECORDED`

사용자가 Browser Console에서 같은 기본 Case를 실행해 전달한 결과:

```text
start
VM312:11 end
VM312:8 micro
undefined
VM312:4 timer
```

프로그램의 `console.log` 출력만 추리면 다음과 같다.

```text
start
end
micro
timer
```

- `VM312:11` 같은 표시는 DevTools가 Console 입력에 부여한 임시 Source와 줄 번호다.
- `undefined`는 Console에 입력한 Code의 평가 결과이며 `console.log`로 출력한 값이 아니다.
- 따라서 프로그램 출력은 실행 전 예상과 일치한다.

“이 결과가 화면이 언제 그려지는지까지 증명하는가?”라는 질문에 사용자는 “아니오”라고 답했다.

판정: `BROWSER_BASIC_CASE_PASS`

Browser Console 결과는 이번 기본 Case의 JavaScript 실행 순서를 확인하지만, DOM 변경이 실제 Pixel로 Paint된 시점을 측정하지 않는다. Rendering Timing은 별도의 Browser Page, `requestAnimationFrame`과 Performance Marker 실험이 필요하다.

## 5. 현재까지의 Queue 변화

```text
현재 Script Task 시작
→ start 출력
→ Timer Callback을 이후 Task로 등록
→ Microtask Callback 등록
→ end 출력

현재 Script Task 종료
→ Microtask Queue가 빌 때까지 처리
→ micro 출력

다음 Task 선택
→ Timer Callback 실행
→ timer 출력
```

여기서 “Microtask Queue가 빌 때까지”는 처리 중인 Microtask가 새 Microtask를 추가하면 새로 추가된 작업도 같은 Checkpoint에서 이어서 처리될 수 있다는 뜻이다. 이 동작은 다음 중첩 Microtask Case에서 확인한다.

## 6. 중첩 Microtask — 실행 전 예상

제시한 Code:

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

사용자의 최초 예상:

```text
현재 Task에서 출력: A, E
처음 Microtask Queue에 들어가는 Callback: B
B를 출력하는 Callback 실행 중 새로 등록되는 Microtask: C
다음 Task에서 출력: B
최종 출력 순서: A → E → B → C → D
```

최종 출력 순서와 `A`·`E`·`B`·`C`의 분류는 맞았다. 다만 “다음 Task에서 출력”을 `B`라고 적은 부분은 앞의 분류 및 최종 순서와 모순된다.

```text
B
→ 첫 Microtask Callback에서 출력

C
→ B Callback이 실행되는 동안 등록된 새 Microtask에서 출력

D
→ setTimeout이 등록한 다음 Timer Task에서 출력
```

교정 뒤 사용자가 다시 분류한 내용:

```text
B가 실행되는 Queue: 현재 Task 뒤의 Microtask Queue
C가 실행되는 Queue: 현재 Task 뒤의 Microtask Queue
D가 실행되는 Queue: 다음 Task
```

표현을 더 정확히 하면 `B`와 `C`가 현재 Task 안에서 실행되는 것은 아니다. 현재 Task의 동기 Code가 끝난 직후 Microtask Checkpoint에서 `B`가 실행되고, `B`가 추가한 `C`도 Queue가 빌 때까지 같은 Checkpoint에서 실행된다. `D`는 그 뒤 선택되는 Timer Task에서 실행된다.

판정: `PREDICTION_PASS_AFTER_CORRECTION`

### Node.js 실행

> 실행 환경: Node.js `v22.23.2`

실제 출력:

```text
A
E
B
C
D
```

예상과 실제 출력이 일치했다.

판정: `NODE_NESTED_MICROTASK_PASS`

### Browser Console 실행

> 실행 환경: Browser DevTools Console, Browser 제품·Version `NOT_RECORDED`

사용자가 전달한 실제 결과:

```text
A
VM324:15 E
VM324:4 B
VM324:7 C
undefined
VM324:12 D
```

프로그램의 `console.log` 출력만 추리면 다음과 같다.

```text
A
E
B
C
D
```

예상과 실제 출력이 일치했다. `VM324:...`는 DevTools의 임시 Source·줄 번호이고, `undefined`는 Console 평가 결과이므로 프로그램 출력에서 제외한다.

“`C`는 `D`보다 나중에 등록되는데도 왜 먼저 실행되는가?”라는 질문에 사용자는 다음처럼 답했다.

> `B`가 실행되는 `queueMicrotask` 내부에서 정의되어 있기 때문

`C`가 `B`의 Callback 안에 있다는 위치만으로는 실행 순서를 충분히 설명하지 못한다. 실행 순서의 직접 원인은 다음과 같다.

```text
B Microtask 실행
→ C Callback을 Microtask Queue에 추가
→ Event Loop는 같은 Microtask Checkpoint에서 Queue가 빌 때까지 계속 처리
→ C 실행
→ 그 뒤 다음 Timer Task를 선택해 D 실행
```

판정: Browser 실행 `RUN_PASS`, 원인 설명 `REVIEW_REQUIRED`

## 현재 판정과 미실시 범위

| 항목 | 상태 | 근거 |
|---|---|---|
| Timer 등록과 Timer Callback 실행 구분 | `PASS` | 현재 호출은 등록, Callback은 이후 Task라고 설명 |
| 단순 `queueMicrotask` 순서 | `PASS_AFTER_CORRECTION` | `X → Z → Y` 예상과 동기 출력 범위 교정 |
| Task·Microtask·다음 Task 처리 규칙 | `PASS` | 사용자가 처리 순서를 독립적으로 재설명 |
| Node.js 기본 Case | `RUN_PASS` | `start → end → micro → timer` 관찰 |
| Browser Console 기본 Case | `RUN_PASS` | 같은 프로그램 출력 관찰 |
| Browser Rendering 근거 구분 | `PASS` | Console 출력이 Paint Timing을 증명하지 않는다고 답함 |
| 중첩 Microtask 예상 | `PASS_AFTER_CORRECTION` | `B`·`C`는 같은 Microtask Checkpoint, `D`는 다음 Task라고 재분류 |
| 중첩 Microtask Node.js 실행 | `RUN_PASS` | `A → E → B → C → D` 관찰 |
| 중첩 Microtask Browser 실행 | `RUN_PASS` | `A → E → B → C → D` 관찰 |
| 중첩 Microtask 원인 설명 | `REVIEW_REQUIRED` | Callback의 Code 위치가 아니라 Queue 추가와 Microtask Checkpoint 소진을 연결해야 함 |
| 동기 Blocking·`requestAnimationFrame`·Performance Marker | `NOT_RUN` | 아직 시작하지 않음 |
| Promise·`async`·`await` | `NOT_RUN` | 아직 시작하지 않음 |
| Fetch 오류 구분 | `NOT_RUN` | 아직 시작하지 않음 |
| CORS 두 Origin Spike | `NOT_RUN` | 아직 시작하지 않음 |
| Ticket 조회 UI 상태 모델 | `NOT_RUN` | 아직 시작하지 않음 |

Event Loop의 기본 실행 순서 Gate는 통과했다. 그러나 중첩 Microtask와 Rendering Timing을 아직 실행하지 않았으므로 Week 5의 Event Loop Lab 전체를 완료로 판정하지 않는다.

## 근거 경계

- 이 문서는 9월 16일 현재까지 사용자가 답하고 실제로 실행한 범위만 기록한다.
- Node.js와 Browser Console의 기본 출력이 같아도 두 Runtime의 모든 Event Loop 세부 동작이 같다고 일반화하지 않는다.
- Browser Console 출력은 실제 화면 Paint Timing을 측정한 근거가 아니다.
- 아직 실행하지 않은 9월 16일 후속 범위는 `NOT_RUN`으로 유지한다.
- 9월 16일 안에 실제 소요 시간을 기록하지 않았으므로 추정하지 않는다.
- 중첩 Microtask 원인에 대한 독립 재설명은 날짜가 바뀐 뒤 이루어졌으므로 이 문서의 9월 16일 판정을 소급 변경하지 않는다. 후속 판정은 [9월 17일 Study Note](./2026-09-17-study-questions.md)에 기록한다.
