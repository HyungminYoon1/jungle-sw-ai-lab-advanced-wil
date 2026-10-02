# AI API 응답과 Structured Outputs

AI API를 호출하면 HTTP 응답 안에 Model이 생성한 내용이 들어온다. HTTP 통신 성공, 생성 완료, JSON 문법, 출력 계약과 내용 정확성은 각각 다른 검사다. Structured Outputs는 생성할 구조를 제한하지만 원문에 충실한 요약인지까지 판단해 주지는 않는다.

## Prompt와 Schema의 역할

Prompt는 Model이 할 일을 설명한다. 문의를 요약하되 없는 사실을 만들지 말라는 지시와, 요약·분류·우선순위의 의미를 적는다. 고객 문의는 이 지시와 구분한 입력 데이터다.

Schema는 응답의 구조를 정한다. 어떤 Field가 필수인지, 문자열과 배열 중 무엇을 사용하는지, 어떤 Enum 값이 허용되는지를 표현한다.

| 방식 | Model에 전달하는 것 | Application에서 확인할 것 |
|---|---|---|
| Prompt-only | 자연어 지시로 JSON 요청 | JSON 문법부터 출력 규칙과 내용까지 |
| Structured Outputs | 같은 지시와 지원되는 JSON Schema | 완료·거부 확인, 남은 값 규칙과 내용 |

Prompt-only와 JSON mode는 다르다. 자연어로 JSON을 요청하는 것만으로 API의 JSON mode가 켜지지 않는다. Responses API에서는 `text.format.type`으로 `text`, `json_object`, `json_schema`를 구분한다. [공식 OpenAI Structured Outputs 문서](https://developers.openai.com/api/docs/guides/structured-outputs)

## 실제 요청에 담기는 정보

Responses API의 주요 요청 Field는 다음과 같다.

```javascript
const request = {
    model: "gpt-6-luna",
    instructions: "문의 원문을 요약하고 정해진 Field의 JSON만 반환하세요.",
    input: [{
        role: "user",
        content: JSON.stringify({ title: "로그인 링크 만료", body: "새 링크로 로그인했으며 만료 이유가 궁금합니다." })
    }],
    reasoning: { effort: "none" },
    max_output_tokens: 600,
    service_tier: "default",
    store: false,
    text: { format: { type: "text" } }
};
```

`model`은 호출 대상, `instructions`는 작업 지시, `input`은 분석할 문의다. `max_output_tokens`는 출력 Token 상한이지 요약의 문자 수 상한이 아니다. 요약 200자 제한은 출력 후 별도로 검사한다. `service_tier: default`는 표준 처리 조건을 요청한다. `store: false`는 응답을 API에서 다시 조회할 수 있도록 저장하는 기능을 끄며, Provider의 모든 데이터 보관을 없앤다는 뜻은 아니다. [Responses API 요청 규격](https://developers.openai.com/api/reference/cli/resources/responses/methods/create), [응답 저장 설정](https://developers.openai.com/api/docs/guides/migrate-to-responses)

Structured Outputs에서는 같은 요청의 `text.format`을 다음 구조로 바꾼다.

```javascript
text: {
    format: {
        type: "json_schema",
        name: "helpdesk_suggestion",
        strict: true,
        schema: providerSchema
    }
}
```

API Key는 문의 Body나 Browser JavaScript에 넣지 않는다. 호출하는 Server 또는 Local Process가 환경 변수에서 받아 HTTP Authorization Header에 사용한다. Helpdesk의 Browser Session을 식별하는 `JSESSIONID`와도 별개의 값이다.

## HTTP 응답과 Model 출력은 두 겹이다

HTTP 응답 Body에는 생성 상태·출력·사용량 등의 정보를 담은 바깥 객체가 있다. 아래처럼 `output`의 메시지 내용 안에 Model이 생성한 JSON 문자열이 들어갈 수 있다.

```javascript
const apiResponse = {
    status: "completed",
    output: [{
        type: "message",
        role: "assistant",
        content: [{
            type: "output_text",
            text: '{"decision":"SUGGEST","summary":"새 링크로 로그인했으며 만료 이유를 문의함","categories":["ACCOUNT"],"priority":"NORMAL"}'
        }]
    }]
};
```

```text
HTTP Response
  → 응답 Body를 JSON으로 해석
  → 생성 완료 여부와 거부 확인
  → output의 Model 텍스트 추출
  → 그 텍스트를 다시 JSON으로 해석
  → 제안의 Field·Type·값 검사
  → 원문과 내용 대조
```

첫 JSON 해석은 Provider의 바깥 응답 객체를 읽는 것이다. 두 번째 해석은 Model이 만든 문자열을 제안 객체로 바꾸는 것이다. Model 텍스트가 잘못된 JSON이어도 바깥 API 응답 자체는 올바른 JSON일 수 있다.

일부 SDK의 `output_text`는 출력 텍스트를 꺼내는 편의 기능이다. 원시 HTTP 응답의 `output`을 사용할 때에는 출력 배열의 첫 항목이 항상 텍스트라고 가정하지 않는다. `message`와 `output_text` Type을 확인해 추출한다. 거부·미완료 응답은 정상 제안으로 해석하지 않는다. [공식 응답 처리 예시](https://developers.openai.com/api/docs/guides/structured-outputs)

## HTTP 200이 증명하지 못하는 것

HTTP 200을 받았더라도 생성이 미완료이거나 Model이 요청을 거부할 수 있다. 생성한 텍스트가 있어도 JSON 문법이나 Application의 규칙을 어길 수 있다.

```json
{
  "decision": "SUGGEST",
  "summary": "   ",
  "categories": ["ACCOUNT"],
  "priority": "NORMAL"
}
```

이 결과는 JSON 문법에는 맞지만 공백뿐인 요약이므로 사용할 수 없다. 필수 Field가 없는 것, `categories`가 문자열인 것, 중복 항목이 있는 것도 따로 검사한다. 값을 임의로 채우거나 잘라서 통과시키지 않는다.

구조와 값이 모두 맞아도 “새 링크로 로그인에 성공했다”는 원문을 “여전히 로그인할 수 없다”로 요약하면 내용은 틀렸다. 이 판단은 Schema가 아니라 원문 대조가 필요하다.

위 흐름의 원문 대조가 형식 검증기에서 자동으로 수행된다는 뜻은 아니다. 사람이나 별도로 설계한 평가가 내용을 비교해야 하며, 추가 AI 평가도 틀릴 수 있다. `VALID_OUTPUT` 같은 이름을 사용할 때에는 형식·값 계약 통과를 뜻하는지, 내용 검토까지 포함하는지를 명확히 정한다. Structured Outputs에도 내용 오류는 남을 수 있다. [공식 문서의 내용 오류 설명](https://developers.openai.com/api/docs/guides/structured-outputs#handling-mistakes)

## 전송용 Schema와 Application 계약

Provider가 지원하는 JSON Schema는 전체 표준의 일부다. Application의 논리적 Schema를 그대로 보내기보다 지원되는 구조로 표현하고, 표현하지 못한 규칙을 공통 검증기에 남긴다. 전송용 구조에 맞추려고 업무 규칙을 없애지 않는다. [지원 Schema 범위](https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas)

예를 들어 nullable Field를 전송용 Schema에서 허용하더라도 `SUGGEST`에서는 null을 거부해야 한다. 공백 제거 후 Unicode Code Point 길이, 분류 중복과 `decision`별 Field 조합도 Application 규칙이다. 두 비교 방식에 같은 규칙을 적용해야 한다.

## 실패와 사용량을 기록하는 방법

HTTP 인증·요금 오류, 연결 실패·Timeout, Provider 거부·미완료, JSON 문법 실패와 계약 위반을 구분한다. 출력이 없는 실패를 가짜 요약 0점으로 채우거나, 사용량을 알 수 없는데 비용 0원으로 기록하지 않는다.

연결 실패는 Provider가 실행하지 않았다는 증거가 아니다. 호출 뒤 응답만 잃었을 수 있으므로 자동 재호출 전에 실행 결과와 비용을 확인한다. 출력 상한과 재시도 제한은 비용 관리에 도움이 되지만, Local 스크립트의 추정치는 계정 전체의 강제 지출 한도가 아니다.

## 핵심 질문

1. HTTP Body의 JSON 해석과 Model 출력의 JSON 해석은 각각 무엇을 만드는가?
2. Structured Outputs가 구조를 제한해도 공통 출력 검증기와 원문 대조가 필요한 이유는 무엇인가?
3. 연결 실패 뒤 같은 문의를 즉시 다시 보내면 어떤 중복 실행과 비용 문제가 생길 수 있는가?
4. 출력 Token 상한과 요약의 Unicode Code Point 상한은 왜 다른가?

- [AI 제안의 신뢰 경계와 검증 근거](./ai-suggestion-trust-boundaries.md)
- [AI 비동기 처리의 생애주기](./ai-async-processing-lifecycle.md)
