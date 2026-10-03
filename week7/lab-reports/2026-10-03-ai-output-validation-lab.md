# AI 응답의 출력 계약을 Java에서 검증하기

> 작성일: 2026-10-03
> 주차: Week 7
> 과정 영역: AI Native · Backend · Test
> 상태: Completed — 독립 출력 계약 Unit Test 범위

## 질문과 관찰

Model이 JSON을 반환해도 누락·추가 Field, 공백 요약, 잘못된 분류와 우선순위가 있을 수 있다. 독립 JavaScript 실험의 구조 검사를 실제 Server 언어인 Java로 옮겨 같은 계약의 경계를 확인했다.

새 Unit Test 64개, 전체 Java Clean Test 140개와 기존 JavaScript Test 54개가 통과했다. 이 검증기는 형식·값을 검사한다. 구조를 지킨 거짓 문장도 통과할 수 있다는 Case를 함께 실행했다.

## 구현과 실행 환경

- Lab Source: 실험 당시에는 `main`의 `effff07` 이후 작업 중 변경이었다. 검증기·Unit Test는 [44e6c02](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/commit/44e6c0294da986a973c7e676e00dcc910a4eb0cf)에 기록했다.
- Windows · Java 25 · Spring Boot 4.1.1 · Boot가 관리하는 Jackson 3.
- 구현: Lab의 `src/main/java/lab/helpdesk/ai/validation/AiSuggestionOutputValidator.java`.
- Test: Lab의 `src/test/java/lab/helpdesk/ai/validation/AiSuggestionOutputValidatorTest.java`.
- 순수 Java 검증기이며 Spring Bean·Provider·Worker·Suggestion 저장에는 연결하지 않았다.
- 입력은 Test가 만든 합성 JSON이다. 실제 Provider 호출과 Browser E2E는 이번 실험에서 실행하지 않았다.

## 검사 순서

```text
Model 출력 문자열
  → 하나의 JSON Object로 해석
  → decision·summary·categories·priority의 존재와 추가 Field 검사
  → SUGGEST: 요약·분류 목록·우선순위 검사
    또는 ABSTAIN: 나머지 세 Field의 명시적 null 검사
  → 계약 검사를 통과한 값 객체 반환
```

`UNDETERMINED`는 유효한 Enum이다. 누락·null을 그 값으로 채우지 않는다. 요약은 양끝 공백을 제외한 Unicode Code Point 수를 검사하되 반환 문자열을 수정하지 않는다. HTML처럼 생긴 문장도 Text로 보존하며, 실제 UI는 `textContent`를 사용해야 한다.

## 결과

| Case | 결과 |
|---|---|
| 정상 `SUGGEST`, 허용된 분류·우선순위 | 통과. 목록 순서와 요약 문자열 보존 |
| `UNDETERMINED`가 포함된 제안 | 통과. 임의의 `NORMAL`로 대체하지 않음 |
| 각 필수 Field 누락, `ticketId` 등 추가 | `AI_OUTPUT_FIELD_SET` |
| 잘못된 JSON, 중복 Property, 뒤에 붙은 추가 JSON | `AI_OUTPUT_JSON_SYNTAX` |
| Object가 아닌 JSON | `AI_OUTPUT_ROOT_SHAPE` |
| 빈·공백·긴 요약, 잘못된 Type | 해당 계약 오류 코드 |
| 빈·중복 분류, 허용값 밖 Enum | 해당 계약 오류 코드 |
| `ABSTAIN`과 세 Field의 명시적 null | 구조 통과 |
| `ABSTAIN`의 Field 누락·비-null 값 | 거부 |
| 200 Emoji와 201 Emoji | 200 통과, 201 거부. UTF-16 길이가 아닌 Code Point 기준 |
| 구조에 맞는 거짓 사실·HTML처럼 생긴 요약 | 통과. 내용 검토·화면 출력 경계가 따로 필요함 |

## 구현 선택과 후속 검토

| 선택 | 비교한 안과 이유 | 후속 확인 |
|---|---|---|
| 독립 Java 검증기 | Controller에 검사를 넣는 대신 AI 출력 경계에서 사용할 객체로 분리 | Provider Adapter·Application 연결은 후속 구현 |
| 상한을 생성자 설정으로 받음 | 200자를 Runtime 기본값으로 고정하지 않고 Test의 실험값으로 사용 | 실제 요약 상한 확정·설정 전달 |
| 중복 Property·추가 JSON 거부 | Parser가 마지막 값을 고르거나 첫 Object만 읽게 두지 않음 | 기존 JavaScript `JSON.parse`와 중복 Property 처리 차이는 유지 |
| 고정 코드만 가진 예외 | Parser 메시지·Cause에 입력이 포함될 수 있어 그대로 전달하지 않음 | Provider 경계의 안전한 오류 처리·Log Test |

이 선택은 Lab 검증기·Test와 README, WIL 계약·주간 계획·학습자료에 반영했다. 논리적 Field·Enum은 바꾸지 않았다. `ABSTAIN`을 허용할 구체적인 원문과 내용 평가 기대값은 계속 검토한다.

## 재현과 검증 범위

Lab Repository에서 다음 명령을 실행한다. 전체 Java Test는 일회용 PostgreSQL Testcontainer를 사용하므로 Docker Engine이 필요하다. 검증기만 실행할 때는 Database가 필요하지 않다.

```powershell
.\mvnw.cmd "-Dtest=AiSuggestionOutputValidatorTest" test
.\mvnw.cmd clean test
node --test src/test/js/*.test.mjs
```

실제 결과는 새 Unit 64개, 전체 Java 140개, JavaScript 54개이며 실패·오류·건너뜀은 0이었다. 전체 Java 종료 시각은 23:23 KST다. Codex가 구현과 실행을 담당했으며, 학습자가 코드의 핵심 정책을 자료 없이 설명하는 확인은 남아 있다.

검증 결과 객체만으로 저장·Job 완료·Tool 실행을 허용하지 않는다. 현재 실행권 확인과 결과 저장 Transaction, Provider 거부·Timeout·연결 실패, 전송 전 민감 정보 처리·전체 고정 평가는 다음 단계다.

## 참고 자료

- [AI 응답과 Structured Outputs 학습자료](../study-docs/structured-output-api-basics.md)
- [AI Suggestion 계약 초안](../ai-suggestion-contract-draft.md)
- [OpenAI Structured Outputs: 거부와 내용 오류](https://developers.openai.com/api/docs/guides/structured-outputs)
