# 2026-09-14 — Session 인증 복습과 Event Loop 첫 이해

> 날짜: 2026-09-14
> 학습 주제: Session 인증 복원, 두 종류의 `403`, Timer와 Microtask

## 핵심 질문

1. Browser와 Server는 Session 인증을 위해 각각 무엇을 보관하며, 후속 요청에서 인증은 어떤 객체 순서로 복원되는가?
2. 같은 `403 Forbidden`이어도 Authorization 실패와 CSRF 검증 실패를 어떻게 구분할 수 있는가?
3. 인증·인가 기능 Test가 통과해도 Secret Log 점검이 별도로 필요한 이유는 무엇인가?
4. `setTimeout(...)` 호출과 전달한 Callback은 각각 언제 실행되는가?
5. Promise Microtask는 현재 동기 Code와 다음 Timer Task 사이의 어느 시점에 실행되는가?

## Session 인증은 무엇을 복원하는가

Browser와 Server가 각각 무엇을 보관하는지 다시 정리했다.

처음에는 Browser가 Session과 사용자 정보를 함께 보관하는 것처럼 막연하게 생각했다. 하지만 Session 방식에서 Browser가 보관하고 후속 요청에 보내는 것은 Session ID가 담긴 Cookie다. Spring 기반 Application이라면 대표적으로 `JSESSIONID`가 이 역할을 한다.

Server는 `JSESSIONID`로 `HttpSession`을 찾고, 그 안에 저장된 `SecurityContext`를 현재 요청을 처리하는 `SecurityContextHolder`에 복원한다.

```text
Browser
└─ Cookie: JSESSIONID
       │
       ▼
Server
└─ HttpSession
   └─ SecurityContext
      └─ Authentication
         ├─ 사용자 식별 정보
         └─ Authority·Role

현재 요청
└─ SecurityContextHolder
   └─ 복원된 SecurityContext
```

이 구조를 통해 후속 요청에서는 Password를 다시 보내지 않아도 된다. Browser가 보낸 Session ID로 Server가 이전에 성공한 인증 결과를 찾아 현재 요청에 복원하기 때문이다.

여기서 바로잡은 핵심은 다음과 같다.

- Browser가 `SecurityContext`를 보관하는 것이 아니다.
- Browser는 Session ID만 보관하고 전송한다.
- 실제 인증 결과인 `Authentication`은 Server의 `SecurityContext` 안에 있다.
- `SecurityContextHolder`는 현재 요청을 처리하는 동안 인증 정보에 접근하는 위치다.

## 같은 `403`도 실패 원인은 다를 수 있다

두 요청이 모두 `403 Forbidden`을 반환하더라도 실패한 보안 단계는 다를 수 있다.

### AGENT 전용 Ticket을 USER가 조회한 경우

로그인한 `USER`에게는 유효한 `Authentication`이 있다. 하지만 요청한 자원이 `AGENT` Role을 요구하므로 Authorization 단계에서 거부된다.

```text
인증 성공
→ ROLE_USER 보유
→ AGENT 권한 조건 불충족
→ Authorization DENY
→ 403 Forbidden
```

### USER가 CSRF Token 없이 Ticket을 생성한 경우

이 요청을 보낸 `USER`도 인증되어 있을 수 있다. 그러나 Session Cookie가 자동으로 전송되는 상태 변경 요청에는 유효한 CSRF Token이 필요하다. Token이 없거나 일치하지 않으면 Authorization 판단이나 Controller 실행보다 앞에서 요청이 거부될 수 있다.

```text
인증된 Session Cookie 전송
→ 상태 변경 요청의 CSRF Token 검사
→ Token 없음 또는 불일치
→ CSRF 검증 실패
→ 403 Forbidden
```

처음에는 Status만 보면 실패 원인도 같다고 생각하기 쉬웠다. 이제는 `403`이라는 결과만 보지 않고 어느 Filter와 검사 단계에서 요청이 거부됐는지를 함께 확인해야 한다고 이해했다.

## 보안 기능 Test와 Secret Log 점검은 별도다

인증·인가 Test가 통과했다고 해서 민감 값이 Log에 출력되지 않는다는 사실까지 증명되는 것은 아니다.

예를 들어 다음 두 질문은 서로 다른 검증이 필요하다.

- 익명 요청이 차단되고 Role 규칙과 CSRF 방어가 동작하는가?
- Password, Session ID, Token이나 Credential이 Log에 노출되지 않는가?

첫 번째는 Request·Response와 Security 동작을 확인하는 기능 Test다. 두 번째는 실제 Log 출력과 금지 Pattern을 검사해야 한다. 보안 기능이 정상이어도 Debug Log나 예외 메시지가 비밀값을 출력할 수 있으므로 두 근거를 분리해야 한다.

## `setTimeout` 호출과 Callback 실행은 같은 시점이 아니다

Event Loop 학습은 다음 간단한 예제에서 시작했다.

```javascript
console.log("A");

setTimeout(() => {
    console.log("B");
}, 0);

console.log("C");
```

출력 순서는 `A → C → B`라고 올바르게 예상했지만, 처음에는 `setTimeout` 호출 자체도 다음 Event Loop에서 실행된다고 생각했다.

실제로는 `setTimeout(...)` 호출이 현재 Script에서 동기적으로 실행된다. 이 호출은 Timer를 등록하고 곧바로 반환한다. 나중에 실행되는 것은 `setTimeout` 함수 자체가 아니라 전달한 Callback이다.

```text
현재 Script
→ A 출력
→ setTimeout(...) 호출로 Timer Callback 등록
→ C 출력

이후 Timer Task
→ Callback 실행
→ B 출력
```

따라서 비동기 API를 이해할 때는 다음 둘을 분리해서 봐야 한다.

- 지금 실행되는 등록 함수
- 조건을 만족한 뒤 나중에 실행되는 Callback

## Microtask는 현재 동기 Code보다 먼저 실행되지 않는다

Timer와 Promise Handler를 함께 둔 예제에서는 처음 예상이 틀렸다.

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

처음에는 `C`가 `D`보다 먼저 실행되어 `A → C → D → B`가 될 것으로 생각했다. Promise Handler가 Timer보다 먼저 실행된다는 사실을 현재 동기 Code보다도 먼저 실행된다는 뜻으로 잘못 확대했기 때문이다.

올바른 실행 흐름은 다음과 같다.

```text
현재 Script의 동기 Code
→ A 출력
→ Timer Callback 등록
→ Promise Handler를 Microtask로 등록
→ D 출력

현재 Script가 끝난 뒤 Microtask
→ C 출력

다음 Timer Task
→ B 출력

최종 출력: A → D → C → B
```

이때 정리한 가장 중요한 문장은 다음과 같다.

> Microtask는 현재 동기 Code보다 먼저 실행되는 것이 아니라, 현재 동기 Code가 모두 끝난 뒤 다음 Task보다 먼저 실행된다.

## 최종적으로 정리한 이해

이번 학습에서 다음 오개념을 바로잡았다.

1. Browser는 인증 정보 전체가 아니라 Session ID Cookie를 보관한다.
2. 같은 `403`이어도 Authorization 실패와 CSRF 검증 실패는 원인이 다르다.
3. 보안 기능 Test와 Secret Log 노출 점검은 서로 다른 근거다.
4. `setTimeout(...)` 호출은 현재 동기 Code에서 실행되고, Callback만 나중 Task에서 실행된다.
5. Microtask는 남아 있는 현재 동기 Code를 추월하지 않는다.

Event Loop의 실행 순서는 다음 학습에서 실제 Node.js와 Browser Console로 확인했다. 실행 결과와 중첩 Microtask는 [9월 16일 Study Note](./2026-09-16-study-questions.md)에 정리했다.
