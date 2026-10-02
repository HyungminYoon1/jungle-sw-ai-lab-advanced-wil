# Tool Calling — 호출 요청과 실제 실행

## AI가 함수 이름을 반환해도 함수는 아직 실행되지 않았다

Tool Calling에서 AI는 “이 함수를 이 인자로 호출해 달라”는 요청을 반환한다. Application이 그 요청을 받아 함수를 실행하고 결과를 돌려주는 단계는 별개다. [OpenAI Function Calling 가이드](https://developers.openai.com/api/docs/guides/function-calling)

따라서 다음 세 가지 횟수는 서로 다르다.

- Provider 호출 횟수: Server가 AI에게 생성 요청을 보낸 횟수.
- Tool 호출 요청 수: AI가 반환한 함수 실행 요청의 수.
- Tool 실행 횟수: 검증을 통과해 Server가 해당 함수를 실제 호출한 횟수.

AI가 요청을 한 건 반환했더라도 Server가 거부하면 Tool 실행은 0회다. 함수 실행 중 Exception이 발생했다면 실행은 1회이고 결과는 실패다.

## Server가 대상과 허용 범위를 정한다

읽기 전용 가짜 함수 `find_current_ticket`을 예로 든다. Server는 현재 처리할 Ticket ID를 `7`로 정했고, AI에게는 인자 없는 호출만 허용한다.

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

`ticketId`가 양의 정수인지를 확인하는 것만으로 충분하지 않다. 이 함수는 애초에 `ticketId` 인자를 받지 않는다. AI가 `7`이나 `9999`를 보냈더라도 추가 인자로 거부한다. 대상 선택을 Server에 남기기 위해서다.

Server가 정한 ID라는 사실만으로 모든 접근 권한이 보장되는 것은 아니다. 실제 Application에 연결할 때에는 요청자·Job·Message와 대상 Ticket의 관계 및 권한도 Server가 확인해야 한다.

## 네 경우의 실제 실행 횟수

각 행은 독립된 요청이며 자동 재시도는 없다.

| 요청과 결과 | 실행 횟수 | 이유 |
|---|---:|---|
| `find_current_ticket` + `{}`, 정상 반환 | 1 | 허용 이름·인자 검증 뒤 함수 실행 |
| `resolve_ticket` + `{}` | 0 | 허용 목록에 없는 함수이므로 실행 전 거부 |
| `find_current_ticket` + `{"ticketId":9999}` | 0 | 허용하지 않은 인자이므로 실행 전 거부 |
| `find_current_ticket` + `{}`, 함수 내부에서 Exception | 1 | 검증을 통과해 이미 실행한 뒤 실패 |

`resolve_ticket`의 거부는 막연히 “보안상 위험해서”가 아니라, Server가 정한 허용 목록에 없기 때문이다. AI가 반환한 이름으로 임의의 코드를 찾거나 `eval`로 실행하지 않는다.

## 검증 실패와 실행 실패를 코드에서 나눈다

아래는 학습용 Dispatcher의 핵심 부분이다. 이름·인자 검증 실패는 함수 실행 전에 `return`한다.

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

`executionCount += 1`에 도달하지 않았다면 함수를 실행하지 않았다. 함수 안에서 실패하면 Counter는 이미 1 증가한 상태다. Exception이 발생했다는 사실과 실제 실행을 시도했다는 사실을 함께 기록할 수 있다.

오류 결과에는 안전한 코드만 남긴다. Exception Message·Stack·원문·Credential을 그대로 출력하지 않는다. 관리자에게 알릴 필요가 있는지는 별도의 운영 정책이며, 실패했다는 이유로 원문 전체를 전달하거나 자동 재시도하는 동작은 만들지 않는다.

## 출력 보완 요청과 Tool 재시도는 다르다

AI 제안의 필수 Field 누락을 보완하기 위해 생성 요청을 한 번 더 보내는 정책과, 허용하지 않은 Tool을 다시 실행하는 것은 다른 문제다. 출력 보완 정책이 있다고 해서 금지된 함수·인자에 자동으로 적용하지 않는다.

재시도를 설계하려면 실패 종류, 실행 여부, Side Effect와 중복 위험을 먼저 확인해야 한다. 함수가 실행 중 실패한 경우에는 결과나 Side Effect가 이미 일부 발생했을 수도 있다.

AI 제안 생성과 Tool Calling도 구분한다. 제안의 `decision`·`summary`·`categories`·`priority`에 Tool 이름이나 Ticket ID를 추가하지 않는다. AI 제안은 검토할 데이터이지 Ticket 해결 명령이 아니다.

## 핵심 질문

1. AI가 호출 요청을 반환했지만 Server가 인자 검증에서 거부했다면, Tool 실행 횟수는 얼마인가?
2. 실행 횟수를 함수 호출 직전에 증가시키는 이유는 무엇인가?
3. `ticketId: 9999`가 양의 정수여도 이 함수에서는 거부하는 이유는 무엇인가?
4. 함수 실행 중 실패했다는 이유만으로 같은 요청을 다시 실행해도 되는가?

- [AI 제안의 신뢰 경계와 검증 근거](./ai-suggestion-trust-boundaries.md)
- [AI API 응답과 Structured Outputs](./structured-output-api-basics.md)
