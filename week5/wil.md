# Week 5 WIL — Event Loop에서 Promise와 Rendering까지

> 기간: 2026-09-14 ~ 2026-09-20
> 상태: Partially Completed
> 문서 상태: 공개 완료 — 블로그 게시·포럼 등록 2026-09-21, 사용자 확인
> 핵심 질문: Browser의 비동기 실행과 Rendering을 이해하면서 최소 사용자 흐름을 신뢰할 수 있게 검증할 수 있는가?

## 이번 주 요약

이번 주에는 Browser JavaScript 학습의 출발점으로 Event Loop, Main Thread Rendering, Promise와 `async`·`await`의 기본 흐름을 공부했다. 실행 순서를 먼저 예상한 뒤 Node.js와 Browser Console에서 확인했고, DOM 값이 바뀌는 시점과 실제 화면이 갱신되는 시점도 별도의 실험으로 비교했다.

가장 크게 바뀐 이해는 “비동기 Code가 별도의 공간에서 동시에 실행된다”는 막연한 생각을 버리고, 현재 Task의 동기 Code, Microtask와 다음 Task가 어느 순서로 이어지는지 추적하게 된 것이다. Promise도 단순히 “나중에 실행되는 문법”으로 보지 않고 객체 반환, 결과 결정, Handler 실행을 서로 다른 시점으로 나누어 이해했다.

다만 계획했던 Fetch, CORS, Event Delegation, XSS Rendering 경계, Response Race, 최소 Ticket UI, Coverage, Lint와 Browser E2E는 수행하지 못했다. AI Helpdesk Lab Source도 변경하지 않았고 Java·JavaScript 자동화 Test를 새로 실행하지 않았다. 따라서 Week 5는 `Partially Completed`로 마감하고 남은 범위는 Week 6의 실제 Browser·Application·PostgreSQL 수직 흐름에 연결한다.

## 시작점

Week 4에는 Session 인증, Role 기반 인가와 CSRF를 Spring Security Test로 확인했다. Week 5를 시작하면서 다음 세 가지를 먼저 다시 설명했다.

- Browser는 Session ID Cookie를 보내고 Server는 `HttpSession`의 `SecurityContext`를 현재 요청에 복원한다.
- 로그인한 USER의 조회 `403`은 Role 인가 실패이고, CSRF Token 없는 상태 변경 요청의 `403`은 CSRF 검증 실패다.
- Security 기능 Test가 통과하는 것과 Password·Session ID·Token이 Log에 노출되지 않는 것은 서로 다른 검증이다.

그 뒤 Browser UI를 만들기 전에 JavaScript 실행 순서를 공부했다. 처음에는 Promise Microtask가 현재 동기 Code도 추월한다고 생각하거나, Promise 객체가 비동기 작업이 끝난 뒤 반환된다고 답했다. Rendering 실험에서도 DOM에 저장된 값과 사용자가 실제 화면에서 보는 값을 같은 시점의 상태로 혼동했다.

## 계획 대비 결과

| 범위 | 실제 결과 | 판정 |
|---|---|---|
| Week 4 지연 회상 | Session 복원, 두 `403`, 기능 Test와 Log 점검의 차이를 교정 뒤 설명 | `PASS_AFTER_CORRECTION` |
| Event Loop | 동기 Code → Microtask → 다음 Task 순서를 Node.js와 Browser에서 확인 | `RUN_PASS_AFTER_CORRECTION` |
| 중첩 Microtask | `A → E → B → C → D`를 실행하고 Queue가 빌 때까지 처리하는 원리를 설명 | `RUN_PASS_AFTER_CORRECTION` |
| Main Thread·Rendering | DOM 변경과 화면 Paint의 차이, 이중 `requestAnimationFrame` 비교를 관찰 | `RUN_PASS` |
| Promise·Async/Await | 상태·결과·Handler, Chain, 실패 복구와 `await` 이후 흐름을 교정 뒤 설명 | `RUN_PASS_AFTER_CORRECTION` |
| Fetch | HTTP 오류와 Network 실패 설명을 시작했으나 독립 설명·실행 근거 없음 | `EXPLAINED_NOT_ASSESSED` / `NOT_RUN` |
| CORS·Event Delegation·XSS·Response Race | 실행하지 않음 | `NOT_RUN` |
| 최소 Ticket UI·Coverage·Lint·Browser E2E | 구현·실행하지 않음 | `NOT_IMPLEMENTED` / `NOT_RUN` |
| Helpdesk Lab 적용·회귀 Test | Source 변경과 Java·JavaScript Test 실행 없음 | `NOT_IMPLEMENTED` / `NOT_RUN` |

## 핵심 학습

### 현재 Task가 끝난 뒤 Microtask를 처리한다

다음 예제의 출력은 `start → end → micro → timer`였다.

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

`setTimeout(...)`과 `queueMicrotask(...)` 호출 자체는 현재 Script에서 실행된다. 이때 Callback을 각 실행 대기열에 등록할 뿐, Callback을 그 자리에서 실행하지 않는다.

```text
현재 Task의 동기 Code
→ Microtask Queue가 빌 때까지 처리
→ Browser가 필요하면 Rendering할 기회를 얻음
→ Timer·Event 같은 다음 Task
```

“Microtask의 우선순위가 높다”는 말만 외우는 대신, 현재 Task가 먼저 끝나야 한다는 조건까지 함께 설명할 수 있게 됐다.

### Microtask 안에서 추가한 Microtask도 다음 Task보다 먼저 실행될 수 있다

중첩 실험의 출력은 `A → E → B → C → D`였다. `B` Microtask가 실행되는 동안 `C` Microtask가 새로 추가됐고, Event Loop는 다음 Timer Task의 `D`를 선택하기 전에 Microtask Queue를 계속 처리했다.

처음에는 `C`가 `B` 안에 작성되어 있기 때문에 먼저 실행된다고 설명했다. Code가 중첩된 위치가 아니라 Callback이 어느 Queue에 언제 추가됐는지가 직접적인 원인이라는 점으로 설명을 수정했다.

### DOM 변경과 화면 Paint는 같은 순간이 아니다

Click Handler 하나에서 DOM을 `"작업 중"`으로 바꾼 뒤 긴 동기 반복문을 실행하고 바로 `"완료"`로 바꾸었다.

```text
DOM:  대기 → 작업 중 → 완료
화면: 대기 ─────────→ 완료
```

반복문 동안 DOM에는 `"작업 중"`이 저장되어 있었지만 Main Thread가 JavaScript를 실행하느라 Browser가 중간 상태를 Paint할 기회를 얻지 못했다. 그래서 사용자는 `"작업 중"`을 보지 못하고 `"대기"`에서 `"완료"`로 바로 바뀌는 화면을 보았다.

이중 `requestAnimationFrame` 실험에서는 이번 실행 조건에서 `대기 → 작업 중 → 완료`가 화면에 나타났다. 두 Callback 사이 Marker 간격은 `4.8ms`, 동기 Blocking 구간은 `1000.0ms`였다. 다만 `4.8ms`는 Callback Marker 사이의 관찰값이지 Paint 소요 시간이나 Frame Rate의 증거는 아니다.

### Promise 객체 반환, 결과 결정과 Handler 실행은 서로 다른 시점이다

Promise를 공부하면서 다음 세 순간을 분리했다.

1. `new Promise(executor)`를 실행하면 Promise 객체가 만들어지고 Executor는 즉시 실행된다.
2. 이번 예제의 `resolve("ticket-1")`는 Promise를 문자열 결과로 해결해 `fulfilled` 상태와 성공 결과를 결정한다.
3. `then(handler)`는 결과를 사용할 일을 등록하고, Handler는 현재 동기 Code가 끝난 뒤 Microtask에서 실행된다.

Browser에서 확인한 출력은 다음과 같았다.

```text
A
B
D
C ticket-1
```

`resolve("ticket-1")`가 `D`보다 먼저 호출됐더라도 `then` Handler는 즉시 실행되지 않았다. Promise의 결과가 이미 정해져 있고, 등록된 Handler가 이후 Microtask에서 그 값을 받는다는 점을 확인했다.

### Chain은 원래 Promise를 바꾸지 않는다

`then`과 `catch`는 원래 Promise의 상태를 다시 쓰는 대신 새로운 Promise를 반환한다. Handler의 종료 방식이 그 후속 Promise를 결정한다.

| Handler 종료 방식 | 후속 Promise |
|---|---|
| 값을 `return` | `fulfilled`, 반환값이 성공 결과 |
| `throw error` | `rejected`, 던진 값이 실패 이유 |
| `return` 없이 정상 종료 | `fulfilled`, 성공 결과는 `undefined` |

예를 들어 실패한 원본 Promise의 `catch`가 `"임시 제목"`을 반환하면 원본은 여전히 `rejected`다. 대신 `catch`가 반환한 후속 Promise가 `fulfilled("임시 제목")`이 된다. 실패를 계속 전달하려면 `catch` 안에서 Error를 다시 던져야 한다.

### `await`는 JavaScript 전체가 아니라 현재 Async Function의 나머지를 미룬다

처음에는 `await`가 Promise의 값을 미룬다거나 JavaScript 실행 전체를 멈춘다고 생각했다. 실제로는 기다리는 Promise가 결정될 때까지 현재 Async Function의 `await` 뒤쪽 실행만 미룬다. 그동안 호출자는 다음 줄을 계속 실행할 수 있다.

```text
then 방식에서 나중에 실행되는 부분
→ then Handler

await 방식에서 나중에 이어지는 부분
→ 현재 Async Function의 await 뒷부분
```

두 문법은 같은 Promise 기반 흐름을 표현할 수 있지만 Control Flow를 조직하는 방식은 다르다. 어느 방식도 화면을 자동으로 갱신하지 않는다. `statusElement.textContent = title`처럼 DOM을 변경하는 Code가 있어야 DOM이 바뀌고, 실제 Pixel 갱신은 이후 Browser Rendering 단계에서 일어난다.

## 예상과 실제의 차이

| 처음의 예상·설명 | 실제 관찰·교정 | 이해가 바뀐 점 |
|---|---|---|
| Promise Microtask가 남아 있는 동기 Code보다 먼저 실행된다. | 현재 Task의 동기 Code가 끝난 뒤 Microtask가 실행됐다. | 현재 Task → Microtask → 다음 Task 순서로 추적한다. |
| 중첩된 Code 위치 때문에 `C`가 Timer보다 먼저 실행된다. | `C`가 Microtask Queue에 추가되고 Queue를 비운 뒤 Timer를 선택했다. | Code 모양이 아니라 Queue와 등록 시점을 본다. |
| DOM 값을 바꾸면 바로 화면에도 보인다. | 하나의 긴 Task 안에서 중간 DOM 상태가 Paint되지 않았다. | DOM Mutation과 Rendering을 분리한다. |
| Promise는 작업이 끝난 뒤 객체를 반환한다. | Promise 객체는 먼저 반환되고 결과는 나중에 결정될 수 있었다. | 객체 반환, 상태 결정과 Handler 실행을 나눈다. |
| `catch`가 성공값을 반환하면 원본 실패가 성공으로 바뀐다. | 원본은 그대로이고 후속 Promise가 성공했다. | Chain의 각 Promise를 별개 객체로 추적한다. |
| `await`는 JavaScript 전체를 멈춘다. | 현재 Async Function의 뒷부분만 미뤄지고 호출자는 계속 실행됐다. | 멈추는 범위를 Function 단위로 본다. |

## 실행과 검증 근거

| 근거 | 결과 | 증명 범위 |
|---|---|---|
| Node.js `v22.23.2`와 Browser Console의 기본 순서 실험 | `start → end → micro → timer` | 사용한 예제에서 동기 Code·Microtask·Timer 순서가 예상과 일치 |
| Node.js와 Browser Console의 중첩 Microtask 실험 | `A → E → B → C → D` | Microtask 실행 중 추가한 Microtask가 다음 Timer보다 먼저 실행 |
| Browser의 동기 Blocking 실험 | DOM은 중간 상태를 거쳤지만 화면은 `대기 → 완료` | DOM 값 변경과 실제 화면 표시가 같은 순간이 아님 |
| 이중 `requestAnimationFrame` 실험 | 이번 실행에서 `작업 중`을 표시한 뒤 Blocking과 `완료` 표시 | Rendering 기회를 나눈 조건에서 중간 상태가 보인 사례 |
| Promise·Timer Browser 실험 | Promise 객체 즉시 반환, 결과 결정 뒤 Handler 실행 | 객체 반환·결과 결정·Handler 실행의 시점 차이 |
| 문답과 실행 결과 재설명 | Promise Chain, `catch`, `async`·`await`를 교정 뒤 설명 | 현재 이해 범위이며 장기 기억이나 응용 능력의 완전한 증거는 아님 |

위 결과는 작은 Console·DOM Runtime 실험이다. 자동화된 JavaScript Test, 실제 Backend E2E, Network Panel Trace나 Helpdesk Application 회귀 Test의 근거가 아니다. Browser 제품과 Version도 기록하지 않았으므로 특정 Browser Version의 동작을 검증했다고 표현하지 않는다.

## 실패와 부분 완료

- Fetch의 `response.ok` 처리와 Network Reject 차이는 설명을 시작했지만 독립적으로 답하고 실행하지 못했다.
- 두 Origin CORS, Event Bubbling·Delegation과 XSS Rendering 경계 실험을 수행하지 않았다.
- 느린 Response가 최신 화면을 덮는 Race와 `AbortController` 비교를 수행하지 않았다.
- Loading·Success·Not Found·Forbidden·Network Error를 표현하는 최소 Ticket UI를 구현하지 않았다.
- Coverage와 Lint를 실행하지 않았고 Pure Unit·DOM Integration·Browser E2E의 증명 범위를 실제 Test로 비교하지 않았다.
- 실제 Spring Server를 통과하는 Browser E2E와 Network Panel 관찰은 `NOT_RUN`이다.
- AI Helpdesk Lab Source를 변경하지 않았고 Java 42개 회귀를 Week 5에 다시 실행하지 않았다. Week 4의 42개 통과 기록을 이번 주 실행 결과로 재사용하지 않는다.

## 설명 가능성 점검

- 자료 없이 설명한 내용: Session 인증 복원, 두 `403`의 원인, 현재 Task·Microtask·다음 Task의 기본 순서
- 실행 뒤 설명한 내용: 중첩 Microtask, DOM과 Paint의 차이, Promise 객체 반환과 Handler 실행 시점
- 교정 뒤 설명한 내용: Promise Chain의 새 객체, `catch`의 복구·재전파, `await`가 미루는 범위
- 아직 설명·실행 근거가 부족한 내용: Fetch 오류 경계, CORS, Event Delegation, XSS, Race 처리, Test 계층

## AI 활용

| 작업 | AI가 수행한 일 | 직접 판단·설명·확인한 일 |
|---|---|---|
| 학습 순서 | 선행 개념을 작은 질문과 예제로 나누고 오개념을 확인 | 실행 전에 출력 순서를 예상하고 틀린 설명을 다시 작성 |
| 실험 | Event Loop, Rendering과 Promise 최소 예제 제시 | Node.js·Browser에서 실행하고 실제 출력·화면 변화를 전달 |
| 개념 교정 | Callback 등록과 실행, DOM과 Paint, 원본·후속 Promise 차이 설명 | 자신의 말로 핵심 문장을 완성하고 추가 질문으로 이해 범위 확인 |
| 문서화 | Study Note와 WIL 구조·초안 작성 보조 | 실제 수행 여부와 `NOT_RUN` 경계를 확인하고 문체를 수정 |

AI가 제시한 설명이나 문장을 그대로 학습 완료 근거로 삼지 않았다. 직접 예상하고 실행하거나, 교정 뒤 자신의 말로 다시 설명한 범위만 현재 학습 근거로 기록했다.

## 공개 기록

- 게시 기술 블로그: 「심화과정 5주차 회고 - Event Loop와 Promise」
- 블로그 게시: 2026-09-21 `DONE`
- 포럼 등록: 2026-09-21 `DONE`
- 확인 근거: 사용자 완료 확인
- 독립 확인 범위: 외부 게시물 URL과 포럼 등록 화면은 제공되지 않아 Codex가 별도로 확인하지 않았다.

공개 제출은 완료했지만 Fetch 이후 학습·구현이 새로 수행된 것은 아니다. Week 5의 기술 범위 판정은 `Partially Completed`로 유지한다.

## 다음 주

- Fetch의 HTTP 오류와 Network 실패를 실제 실행으로 구분한다.
- CORS, Event Delegation, XSS Rendering 경계와 Response Race를 독립 Spike로 확인한다.
- 최소 Ticket UI를 실제 Session Security와 기존 API에 연결한다.
- PostgreSQL Adapter, Migration과 Testcontainers Integration Test를 구현해 재시작 뒤에도 데이터가 남는 수직 흐름을 만든다.
- Unit·Integration·Browser E2E가 각각 무엇을 증명하는지 실제 Test 결과로 구분한다.

## 관련 자료

- [Week 5 학습 계획](./weekly-plan.md)
- [9월 14일 Session 복습·Event Loop 입문](./study-notes/2026-09-14-study-questions.md)
- [9월 16일 Task·Microtask 실행 순서](./study-notes/2026-09-16-study-questions.md)
- [9월 17일 Rendering·Promise 기본 흐름](./study-notes/2026-09-17-study-questions.md)
- [9월 18일 Promise·Async/Await·실패 복구](./study-notes/2026-09-18-study-questions.md)
- [Browser JavaScript Event Loop 입문](./study-docs/browser-javascript-event-loop-basics.md)
- [동기·비동기와 Callback 기초](./study-docs/javascript-sync-async-foundations.md)
- [JavaScript Promise와 Async/Await 기초](./study-docs/javascript-promise-async-await-basics.md)
- [Week 6 Browser·PostgreSQL 수직 마감 계획](../week6/weekly-plan.md)
