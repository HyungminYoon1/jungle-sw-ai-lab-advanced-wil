# AI Provider Adapter와 HTTP 재시도

## Port와 Adapter의 역할

`AiSuggestionJobProcessor`는 AI에 제안을 요청해야 한다는 업무 흐름을 담당한다. 어떤 URL에 어떤 JSON을 보낼지는 `AiSuggestionProvider` Port 뒤의 Adapter가 담당한다.

Port의 `generate(...)`가 한 번 호출됐다고 실제 HTTP 요청도 한 번이었다고 단정할 수는 없다. SDK와 HTTP Client가 내부에서 자동 재시도하거나 Redirect를 따라갈 수 있기 때문이다. Job의 호출 한도를 관리하려면 각 계층에서 무엇을 세는지 구분해야 한다.

| 값 | 세는 대상 | 외부 실행 횟수와의 관계 |
|---|---|---|
| Job 수 | 처리할 입력과 처리 상태 | 한 Job에 여러 시도가 있을 수 있다 |
| 예약 수 | 우리 서버가 전송을 위해 확보한 생성 한도 | 예약 뒤 중단되면 전송 여부가 불명확할 수 있다 |
| HTTP 시도 수 | 우리 HTTP Client가 보내려 한 요청 | Timeout만으로 제공자의 실행·과금 여부를 알 수 없다 |

Provider 서버 내부의 재처리 횟수는 우리 서버의 SDK 재전송과도 다르다. 제공자의 실행·청구를 확인할 자료가 없다면 추측으로 횟수를 채우지 않는다.

## 재시도 설정은 한 곳만 확인하면 안 된다

SDK의 `maxRetries=0`과 HTTP Client의 연결 재시도 설정은 서로 다른 값이다. SDK 재시도를 꺼도 그 아래 Client가 연결 실패를 다시 처리할 수 있다. 자동 Redirect도 추가 HTTP 요청을 만들 수 있다.

우리 Adapter에서는 SDK·HTTP 연결 재시도와 자동 Redirect를 끄고, 새로운 생성 요청은 Job 정책을 통해 별도로 예약한다. HTTP Test에서는 의도적으로 `429`·`500`·Timeout 응답을 만들고 로컬 Server가 받은 요청 수가 한 번인지 확인한다. 직렬화된 입력 검사가 실패한 경우에는 요청 수가 0이어야 한다.

이 Test는 HTTP·SDK·Spring AI 연결을 실제로 실행하지만 Model의 답은 로컬 Server가 만든다. 실제 AI가 같은 요약을 생성했다는 근거는 아니다.

## HTTP 성공과 AI 제안의 성공은 다르다

AI API가 `200`을 반환해도 바로 Suggestion을 저장하지 않는다. 응답 바깥 Envelope가 올바른지, 명시적인 거부가 있는지, 출력이 완료됐는지부터 확인한다. Token 상한 때문에 출력이 잘렸다면 완전한 결과로 취급하지 않는다.

그다음 제안 JSON의 필수 Field·허용값·공백·길이·분기 조합을 Server 검증기로 확인한다. Structured Output은 형식을 맞추는 데 도움을 주지만 요약이 원문에 충실한지까지 보장하지 않는다. [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)

유효한 `ABSTAIN`은 AI가 판단을 보류한다는 업무 결과다. Provider의 명시적 거부, 네트워크 실패와 불완전한 출력은 다른 결과다. 거부와 실패를 `ABSTAIN`으로 바꾸면 어느 단계에서 문제가 생겼는지 가려진다.

## 일시적인 429와 크레딧 부족의 429

일시적인 Rate Limit은 대기 후 회복될 수 있다. 크레딧 부족이나 잘못된 키는 원인을 해결하지 않은 채 같은 요청을 반복해도 성공을 기대하기 어렵다. Status 숫자뿐 아니라 안전하게 식별한 실패 종류를 사용한다.

`Retry-After: 10`은 최소 10초 뒤에 다시 시도하라는 뜻이다. HTTP-date 형식도 있다. 내부 Backoff가 5초라면 더 긴 10초를 지켜야 한다. 그러나 10초를 기다렸다는 이유만으로 새로운 호출이 허용되지는 않는다. 현재 실행권·남은 호출 한도·Job 전체 기한을 다시 확인해야 한다. 기다리는 동안 DB Transaction이나 Row Lock을 유지하지 않는다.

Header가 없거나 잘못됐다면 즉시 재시도해도 된다는 뜻이 아니다. 별도의 Backoff 정책이 필요하다. SDK·HTTP Client·Worker에 겹친 재시도가 한도를 우회하지 않도록 한다. [OpenAI Rate Limits](https://developers.openai.com/api/docs/guides/rate-limits)

## 최종 요청 Body와 안전한 진단

개인정보 치환이 끝났어도 JSON을 만드는 과정에서 DB 원문을 다시 넣을 수 있다. 그래서 전송 직전의 직렬화된 Body를 검사한다. API Key는 인증 Header에만 사용하고 Model 입력에 섞이면 전송하지 않는다.

예외의 메시지나 Cause에 SDK 원문을 그대로 넣으면 Credential·Prompt·응답이 Log로 복사될 수 있다. 진단에는 고정 실패 코드·HTTP Status·시도 수·Token 수처럼 필요한 Metadata만 사용한다. 개인정보 Guard가 알려진 값만 검사한다면 일반적인 개인정보 탐지까지 구현했다고 해석하지 않는다.

## Spring AI의 ChatModel과 기존 Responses 실험

Model 이름이 같아도 API 경로와 입력 형식이 다르면 같은 실행 근거로 합치지 않는다. Spring AI의 `OpenAiChatModel`은 Chat Completions를 사용하고, 기존 독립 Node 실행기는 Responses API를 사용한다. 공통 업무 기준을 적용할 수는 있지만 API별 실행 결과를 따로 기록한다. [Spring AI OpenAI ChatModel](https://docs.spring.io/spring-ai/reference/api/chat/openai-chat.html)

요청별 Timeout만 바꾸려다가 새 옵션 객체의 기본 Model이 선택될 수도 있다. 명시적으로 정한 옵션을 복사한 뒤 필요한 값만 바꾸고, Test에서는 상수의 값이 아니라 최종 전송 Body의 Model·출력 상한·Schema를 확인한다.

## 핵심 질문

- 함수 호출 1회와 실제 HTTP 요청 1회는 왜 다른 근거일까?
- 예약 수 1과 제공자의 실행·청구 횟수 1은 왜 같다고 단정할 수 없을까?
- `429`가 왔다는 사실만으로 자동 재시도하면 어떤 문제가 생길까?
- `200`인데 출력이 미완료라면 어느 검증 단계에서 멈춰야 할까?
- 검증된 제안 객체의 DB 저장만 실패했을 때 왜 AI를 다시 호출하지 않을까?
