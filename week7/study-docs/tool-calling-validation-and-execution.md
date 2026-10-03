# Tool Calling — 호출 요청과 실제 실행

Tool Calling을 이해하려면 함수 이름이 담긴 데이터와 실제 함수 실행을 구분해야 한다. 먼저 JavaScript의 함수 정의·호출·입력·`return`을 짚고, 요청을 검사하는 `dispatch`와 실제 Tool 함수의 역할을 연결한다.

## 함수 정의와 호출

`dispatch`는 JavaScript 문법이나 특별한 명령이 아니다. 이 자료에서는 요청을 검사하고 허용된 작업을 실행하는 함수에 개발자가 붙인 이름이다. 함수를 호출했다는 이유만으로 Queue에 작업이 등록되거나 Network 요청이 전송되는 것은 아니다. 무엇을 하는지는 함수 본문에 작성한 코드로 정한다.

다음 예제는 동기 함수의 실행 순서를 확인하는 코드다. 이 문서의 작은 예제들은 각각 별도로 실행한다.

```javascript
function dispatch() {
    console.log("함수 안");
    return "검사 결과";
}

console.log("호출 전");
const result = dispatch();
console.log("호출 후", result);
```

`function dispatch() { ... }`는 함수를 정의하는 부분이다. 중괄호 안에는 호출됐을 때 실행할 내용인 함수 본문이 있다. 정의만으로 본문의 출력문을 실행하지는 않는다.

`dispatch()`는 그 함수를 호출하는 표현이다. 호출한 곳에서 함수 본문으로 실행이 이동하고, `return`으로 함수 실행이 끝나면 반환값을 가지고 호출한 곳으로 돌아온다.

1. 바깥 코드에서 `"호출 전"`을 출력한다.
2. `dispatch()`를 호출해 함수 본문으로 들어간다. `result`에 넣을 값은 아직 받지 못했다.
3. 함수 안에서 `"함수 안"`을 출력한다.
4. `return "검사 결과"`가 현재 함수 실행을 끝내고 문자열을 반환한다.
5. 반환된 문자열이 `result`에 저장된다.
6. 바깥 코드가 이어서 `"호출 후"`와 `result`를 출력한다.

```text
호출 전
함수 안
호출 후 검사 결과
```

함수 자체를 다른 변수에 보관하는 것과 호출하는 것도 다르다. 앞의 함수를 다른 이름으로 보관하면 다음과 같이 호출할 수 있다.

```javascript
const handler = dispatch;   // 함수 참조를 보관한다. 본문은 실행하지 않는다.
const value = handler();    // 보관한 함수를 호출한다. 본문을 실행한다.
```

## 함수 입력과 요청 데이터

함수에 입력을 전달할 때에는 괄호 안에 값을 넣는다. 아래 예제에서 호출하는 쪽의 `requestData`가 함수 안의 매개변수 `request`로 전달된다.

```javascript
function readToolName(request) {
    return request.name;
}

const requestData = {
    name: "find_current_ticket",
    arguments: {}
};

const name = readToolName(requestData);
console.log(name); // find_current_ticket
```

`requestData`는 두 Property를 가진 객체다. `request.name`은 `name` Property의 값을 읽고, `request.arguments`는 `arguments` Property의 값을 읽는 표현이다. 여기서 `arguments`는 Tool에 전달할 인자 데이터를 담는 Property 이름이다.

`"find_current_ticket"`은 문자열이다. 문자열에 함수 이름을 적거나 그 문자열을 출력하는 것만으로 함수를 실행하지 않는다. 이 예제에서 호출한 함수는 `readToolName`이며, Ticket을 조회하는 함수는 호출하지 않았다.

### 인자 객체의 필드 수 확인

`Object.keys()`는 객체의 Property 이름들을 배열로 돌려주는 JavaScript 내장 함수다. 아래처럼 만든 일반 객체에서는 `length`로 필드 수를 확인할 수 있다.

```javascript
Object.keys({});                // []
Object.keys({}).length;         // 0

Object.keys({ ticketId: 7 });        // ["ticketId"]
Object.keys({ ticketId: 7 }).length; // 1
```

따라서 `Object.keys(request.arguments).length !== 0`은 “인자 객체에 필드가 하나 이상 있는가?”를 검사한다. `!==`는 같지 않은지를 비교하는 연산자다. `{}`이면 조건이 `false`, `{ ticketId: 7 }`이면 조건이 `true`가 된다.

## 요청 검사와 Tool 실행

`dispatch`는 요청을 검사하는 함수이고, `findCurrentTicket`은 검사를 통과했을 때 실제 Tool 작업을 하는 함수다. 다음 예제는 입력이 객체라는 전제에서 인자 검사와 실행 순서만 보여준다. 전체 요청 검증은 뒤에서 따로 확인한다.

```javascript
function findCurrentTicket(id) {
    console.log("Tool 실행", id);
    return { id, status: "OPEN" };
}

function dispatch(request) {
    console.log("요청 검사");

    if (Object.keys(request.arguments).length !== 0) {
        return { code: "INVALID_TOOL_ARGUMENTS", toolExecuted: false };
    }

    const ticket = findCurrentTicket(7);
    return { code: "TOOL_SUCCEEDED", toolExecuted: true, value: ticket };
}

const result = dispatch({
    name: "find_current_ticket",
    arguments: { ticketId: 7 }
});

console.log("처리 결과", result.code);
```

`dispatch`와 `findCurrentTicket`의 정의를 읽었다고 두 함수의 본문이 바로 실행되는 것은 아니다. 실제 흐름은 아래쪽의 `dispatch({ ... })` 호출에서 시작한다.

1. 요청 객체가 `dispatch`의 매개변수 `request`로 전달된다.
2. `"요청 검사"`를 출력한다.
3. 인자 객체에 `ticketId` 필드가 있으므로 필드 수는 `1`이다. `1 !== 0`은 `true`다.
4. `if` 안의 `return`이 실행된다. 이때 끝나는 것은 `if` 블록만이 아니라 현재 `dispatch` 함수 실행 전체다.
5. 아래의 `findCurrentTicket(7)`은 실행하지 않는다.
6. 반환된 오류 결과가 `result`에 저장되고, 바깥 코드가 결과의 `code`를 출력한다.

```text
요청 검사
처리 결과 INVALID_TOOL_ARGUMENTS
```

같은 예제에서 호출 입력만 `arguments: {}`로 바꾸면 필드 수가 `0`이 된다. 조건이 `false`이므로 `if` 안의 `return`을 건너뛰고 `findCurrentTicket(7)`을 호출한다. 그 함수가 돌려준 객체를 `ticket`에 저장한 뒤, `dispatch`가 성공 결과를 반환한다.

```text
요청 검사
Tool 실행 7
처리 결과 TOOL_SUCCEEDED
```

| 요청의 인자 | dispatch 호출 횟수 | 실제 Tool 호출 횟수 |
|---|---:|---:|
| `{ ticketId: 7 }` | 1 | 0 |
| `{}` | 1 | 1 |

“Tool 실행 0회”는 모든 함수가 실행되지 않았다는 뜻이 아니다. 요청을 검사하는 함수는 실행됐지만, 실제 Tool 함수를 호출하는 줄까지 도달하지 않았다는 뜻이다. `Object.keys()`처럼 검사에 사용하는 함수의 호출도 Tool 실행 횟수에 포함하지 않는다.

## 실제 Lab 코드의 입력

위 예제의 `dispatch(request)`는 객체를 바로 받지만, Lab의 `dispatch(rawCall)`는 요청이 담긴 JSON 문자열을 받는다. 문자열을 해석하는 단계를 거친 뒤 객체의 이름과 인자를 검사한다.

```javascript
const rawCall = '{"name":"find_current_ticket","arguments":{}}';
const call = JSON.parse(rawCall);

console.log(call.name);      // find_current_ticket
console.log(call.arguments); // {}
```

`JSON.parse()`는 문자열을 JavaScript 값으로 해석하는 함수다. Tool 이름이 담긴 문자열을 코드로 실행하는 함수가 아니다. 실제 Lab에서는 JSON 해석에 앞서 입력 타입과 크기를 확인하고, 해석 실패 및 잘못된 요청 구조도 거부한다.

Lab의 `createToolDispatcher`는 검사 함수와 실행 횟수 확인 함수를 담은 객체를 만든다. 그 객체를 `dispatcher` 변수에 보관하면 `dispatcher.dispatch(rawCall)`로 요청 검사 함수를 호출한다. 이때 점은 객체에 보관된 함수를 찾고, 뒤의 괄호는 그 함수를 호출하는 표현이다.

이 독립 실험의 Tool은 ID와 상태가 담긴 가짜 객체를 반환한다. 실제 AI Provider나 Database에 연결하지 않는다.

## AI가 함수 이름을 반환해도 함수는 아직 실행되지 않았다

Tool Calling에서 AI는 “이 함수를 이 인자로 호출해 달라”는 요청을 반환한다. Application이 그 요청을 받아 함수를 실행하고 결과를 돌려주는 단계는 별개다. [OpenAI Function Calling 가이드](https://developers.openai.com/api/docs/guides/function-calling)

따라서 다음 세 가지 횟수는 서로 다르다.

- Provider 호출 횟수: Server가 AI에게 생성 요청을 보낸 횟수.
- Tool 호출 요청 수: AI가 반환한 함수 실행 요청의 수.
- Tool 실행 횟수: 검증을 통과해 Server가 해당 함수를 실제 호출한 횟수.

AI가 요청을 한 건 반환했더라도 Server가 거부하면 Tool 실행은 0회다. 함수 실행 중 Exception이 발생했다면 실행은 1회이고 결과는 실패다.

## Server가 대상과 허용 범위를 정한다

읽기 전용 가짜 Tool을 예로 든다. 호출 요청에 사용하는 이름은 `find_current_ticket`이고, 실제로 실행하는 JavaScript 함수는 `findCurrentTicket`이다. Server는 현재 처리할 Ticket ID를 `7`로 정했고, AI에게는 인자가 빈 객체인 호출 요청만 허용한다.

```text
Server가 선택한 대상: Ticket 7
허용 함수: find_current_ticket
허용 인자: {}

AI의 호출 요청
  → JSON과 요청 구조 확인
  → 허용 함수 이름 확인
  → 인자가 빈 객체인지 확인
  → Server가 보관한 ID 7로 함수 실행
  → 성공 결과 또는 실행 실패 기록
```

아래 JSON은 이 원리를 확인하기 위한 단순화한 입력이다. 실제 Provider 응답에는 호출 식별자 등이 있고 `arguments`가 JSON 문자열로 전달될 수 있으므로, 이것을 그대로 API 응답 형식으로 사용하지 않는다.

```json
{
  "name": "find_current_ticket",
  "arguments": {}
}
```

`ticketId`가 양의 정수인지를 확인하는 것만으로 충분하지 않다. AI에게 공개한 Tool 입력 계약에는 `ticketId` 필드가 없다. AI가 `7`이나 `9999`를 보냈더라도 추가 인자로 거부한다. 반면 실제 JavaScript 함수에는 `findCurrentTicket(currentTicketId)`처럼 Server가 정한 ID를 전달한다. AI가 보내는 인자와 Server가 함수에 전달하는 값을 구분한다.

Server가 정한 ID라는 사실만으로 모든 접근 권한이 보장되는 것은 아니다. 실제 Application에 연결할 때에는 요청자·Job·Message와 대상 Ticket의 관계 및 권한도 Server가 확인해야 한다.

## 네 경우의 실제 실행 횟수

각 행은 독립된 요청이며 자동 재시도는 없다.

| 요청과 결과 | Tool 실행 횟수 | 이유 |
|---|---:|---|
| `find_current_ticket` + `{}`, 정상 반환 | 1 | 허용 이름·인자 검증 뒤 함수 실행 |
| `resolve_ticket` + `{}` | 0 | 허용 목록에 없는 함수이므로 실행 전 거부 |
| `find_current_ticket` + `{"ticketId":9999}` | 0 | 허용하지 않은 인자이므로 실행 전 거부 |
| `find_current_ticket` + `{}`, 함수 내부에서 Exception | 1 | 검증을 통과해 이미 실행한 뒤 실패 |

`resolve_ticket`의 거부는 막연히 “보안상 위험해서”가 아니라, Server가 정한 허용 목록에 없기 때문이다. AI가 반환한 이름으로 임의의 코드를 찾거나 `eval`로 실행하지 않는다.

## 검증 실패와 실행 실패를 코드에서 나눈다

아래는 학습용 Dispatcher의 핵심 부분이다. 이름·인자 검증 실패는 실제 Tool 함수 실행 전에 `return`한다. `isObject`는 `null`이나 배열이 아닌 객체인지 확인하는 보조 함수다. 인자 검사에서 `||`는 두 조건 중 하나라도 `true`이면 거부한다는 뜻이다.

```javascript
if (call.name !== "find_current_ticket") {
    return { code: "TOOL_NOT_ALLOWED", toolExecuted: false };
}

if (!isObject(call.arguments) || Object.keys(call.arguments).length !== 0) {
    return { code: "INVALID_TOOL_ARGUMENTS", toolExecuted: false };
}

executionCount += 1;
try {
    const value = findCurrentTicket(currentTicketId);
    return { code: "TOOL_SUCCEEDED", toolExecuted: true, value };
} catch {
    return { code: "TOOL_FAILED", toolExecuted: true };
}
```

`executionCount`는 모든 JavaScript 함수의 호출 횟수가 아니라 실제 Tool 호출 횟수다. 이 코드에서 `executionCount += 1`에 도달하지 않았다면 Tool을 실행하지 않았다. 요청 검사를 위한 `dispatch`·`isObject`·`rejected` 등의 함수 호출과는 구분한다. Tool 함수 안에서 실패하면 Counter는 이미 1 증가한 상태다. Exception이 발생했다는 사실과 실제 실행을 시도했다는 사실을 함께 기록할 수 있다.

오류 결과에는 안전한 코드만 남긴다. Exception Message·Stack·원문·Credential을 그대로 출력하지 않는다. 관리자에게 알릴 필요가 있는지는 별도의 운영 정책이며, 실패했다는 이유로 원문 전체를 전달하거나 자동 재시도하는 동작은 만들지 않는다.

## 출력 보완 요청과 Tool 재시도는 다르다

AI 제안의 필수 Field 누락을 보완하기 위해 설정된 전체·보완 상한 안에서 새 생성 요청을 보내는 정책과, 허용하지 않은 Tool을 다시 실행하는 것은 다른 문제다. 출력 보완 정책이 있다고 해서 금지된 함수·인자에 자동으로 적용하지 않는다.

재시도를 설계하려면 실패 종류, 실행 여부, Side Effect와 중복 위험을 먼저 확인해야 한다. 함수가 실행 중 실패한 경우에는 결과나 Side Effect가 이미 일부 발생했을 수도 있다.

AI 제안 생성과 Tool Calling도 구분한다. 제안의 `decision`·`summary`·`categories`·`priority`에 Tool 이름이나 Ticket ID를 추가하지 않는다. AI 제안은 검토할 데이터이지 Ticket 해결 명령이 아니다.

## 핵심 질문

1. `function dispatch() { ... }`와 `dispatch()` 중 함수 본문을 실제로 실행하는 것은 무엇인가?
2. `const handler = dispatch`와 `handler()`는 각각 무엇을 하는가?
3. `if` 안에서 `return`하면 현재 함수의 아래쪽 코드가 계속 실행되는가?
4. `{}`와 `{ ticketId: 7 }`에 `Object.keys(...).length`를 적용하면 각각 어떤 값이 나오는가?
5. 요청을 검사하는 `dispatch`가 실행됐어도 실제 Tool 실행 횟수가 0일 수 있는 이유는 무엇인가?
6. AI에게 허용한 Tool 인자는 `{}`인데, 실제 JavaScript 함수에는 ID를 전달하는 이유는 무엇인가?
7. 실행 횟수를 Tool 함수 호출 직전에 증가시키는 이유는 무엇인가?
8. 함수 실행 중 실패했다는 이유만으로 같은 요청을 다시 실행해도 되는가?

- [JavaScript 동기·비동기 기초와 함수 호출](../../week5/study-docs/javascript-sync-async-foundations.md)
- [AI 제안의 신뢰 경계와 검증 근거](./ai-suggestion-trust-boundaries.md)
- [AI API 응답과 Structured Outputs](./structured-output-api-basics.md)
