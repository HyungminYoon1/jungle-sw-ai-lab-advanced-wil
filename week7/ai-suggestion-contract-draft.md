# AI Suggestion 계약 초안

> 상태: 입력 모델·문의 보존·최종 처리 방향·복수 Category·문의 유형의 경계·전체 Priority·유효한 `ABSTAIN`의 기록 기준 합의 — Schema 세부값·나머지 작업 상태·복구 정책은 검토 중
> 작성일: 2026-09-29
> 최종 수정일: 2026-10-03
> 논리적 계약 Version: `v2.1-draft` — v2의 출력 구조를 유지하고 전체 Priority의 의미를 보완
> 구현 상태: 독립 OpenAI 비교에서 N01 응답 두 건 확인. Spring에 연결된 AI Provider·Suggestion API·Migration은 미구현

이 문서는 Week 7의 한 수직 흐름에 필요한 입력·출력·권한·저장·실패 계약을 검토하기 위한 초안이다. 출력 구조 v2는 단일 `category` 문자열을 복수 값을 담는 `categories` 목록으로 변경한 **우리 Application의 논리적 Schema 초안**이다. `v2.1-draft`에서는 구조를 바꾸지 않고 개별 문제와 누적·결합 영향을 함께 보는 Priority 기준을 추가했다. OpenAI 최소 비교에는 별도의 전송용 Schema와 이전 계약 `v2-draft`를 사용했다. 그 결과가 전체 논리적 계약이나 Spring 저장 흐름의 Test 통과를 뜻하지는 않는다. [최소 비교 기록](./lab-reports/2026-10-02-openai-structured-output-pilot.md)

## 현재 기준과 합의한 Ticket·Message 모델

- 현재 Lab의 `POST /api/tickets`는 제목만 받아 `USER`·`AGENT`가 생성할 수 있다. `GET /api/tickets/{id}`는 `AGENT`만 읽는다. AI 기능은 아직 없다.
- Ticket은 한 주제의 대화와 처리 상태를 관리하는 묶음이다. 고객 문의와 고객에게 게시한 응대팀 답변은 각각 `ticket_messages`의 Row로 두고 Ticket을 참조한다. Ticket과 Message의 관계는 1:N이다.
- 최초 문의도 Message 한 건이다. `tickets.description`에 같은 본문을 중복 저장하지 않는다. 앞서 검토한 nullable `description` Column 추가안은 이 모델로 대체한다. 해당 Column은 아직 구현되지 않았다.
- 새 접수는 제목과 공백이 아닌 최초 메시지 본문을 함께 받는다. Request Field 이름과 응답의 메시지 표현은 후속 검토에서 확정한다. 현재 제목만 보내던 Browser와 Test는 새 입력 계약에 맞춰 변경해야 한다.
- 기존 Ticket Row에는 메시지를 임의로 만들지 않는다. 기존 문의는 Message 0건인 상태로 계속 조회하며, 제목 복사·`없음` 문자열·AI 생성 글로 없는 원문을 채우지 않는다.
- Week 7에서는 최초 메시지 저장과 AI 연결만 구현한다. 후속 메시지·공식 답변 작성, 내부 메모와 대화 UI 확장은 Week 9 이후 범위다. AI Suggestion은 공식 답변 Message로 자동 게시하지 않는다.
- AI 입력은 Server가 조회한 제목과 최초 문의 메시지다. 작업에 입력 메시지 식별자를 연결하는 안을 사용하며, 메시지가 해당 Ticket에 속하는지도 검증한다. 대화 전체 입력·메시지 수정에 따른 Version 정책은 이번 초기 흐름에서 다루지 않는다.
- 최초 메시지 본문의 잠정 상한은 공백 제거 후 2,000 Unicode Code Point다. 길면 조용히 자르지 않고 새 접수를 `400`으로 거부한다. 상한과 문자 계산 방식은 다시 확인한다.

Message의 `body`는 `NOT NULL`과 공백·길이 검증의 대상으로 삼는다. 기존 Ticket에 Message가 없는 것과 존재하는 Message의 본문이 비어 있는 것은 다르다. 새 접수의 최초 Message 필수 규칙은 Application과 실제 PostgreSQL Test에서 확인한다. 메시지가 없는 기존 Ticket으로는 Provider를 호출하지 않는다.

## AI 전송 전 민감 정보와 보안 신호

문의의 처리 우선순위와 입력에서 관찰한 보안 신호를 분리하는 방향에 합의했다. 로그인 복구 뒤 만료 이유를 묻는 통상 문의는 본문에 Injection 의심 문구가 있어도 그 문구만으로 `HIGH`가 되지 않는다. 별도의 보안 신호 코드 후보는 `PROMPT_INJECTION_SUSPECTED`이며, 단순 문구 탐지만으로 실제 침해나 사용자의 악의를 확정하지 않는다. 탐지 기준·보안 위험 등급·안전한 기록 방식은 후속 검토한다.

보안 신호를 제안의 `categories`·`priority`에 섞거나 새 출력 Field로 추가하지 않는다. 현재 허용값에는 `SECURITY`·`LOW`·`OTHERS`가 없으며 기존 네 Field 계약은 유지한다. 실제 피해와 관측 결과에 따른 보안 대응은 고객 문의의 Priority와 별도로 판단한다. 새로운 관제 시스템이나 자동 사용자 차단은 이번 범위에 추가하지 않는다.

외부 AI로 전송할 복사본에서 요약·분류에 불필요한 주소·연락처·비밀값을 제거하거나 치환하는 방향에도 합의했다. 전처리는 Provider 호출 전에 Server에서 수행할 대상으로 삼는다. AI 출력에서 값을 지우는 것만으로 이미 이루어진 외부 전송을 막았다고 보지 않는다. 전송용 복사본 처리로 접수 원문의 DB Row를 덮어쓰지 않으며, 원문의 열람 권한·보관 기간·실수로 포함된 비밀값의 보관 정책은 별도 검토한다.

이는 설계 합의이며 실제 전처리·탐지 구현은 아직 없다. 평가에는 합성 자리표시자만 사용한다. 선택한 Test의 성공을 모든 민감 정보 탐지나 Injection 차단의 보장으로 확대하지 않는다. 입력 검증·개인정보 제거·후속 Tool 검증을 함께 적용하는 원칙은 [OpenAI 안전 설계 가이드](https://developers.openai.com/api/docs/guides/agent-builder-safety), 최소 전송·로그 마스킹 원칙은 [OpenAI 데이터 취급 가이드](https://developers.openai.com/plugins/guides/security-privacy)를 참고한다.

## 문의 접수와 AI 처리의 Transaction 경계 — 합의

사용자 문의는 AI와 독립적인 원본 업무 데이터다. 접수 단위는 Ticket과 최초 Message이며 둘을 같은 Transaction으로 Commit한다. Message 저장이 실패하면 빈 Ticket만 남기지 않는다. 접수가 Commit된 뒤 AI 호출·출력 검증·제안 저장이 실패해도 Ticket과 최초 Message는 유지한다.

```text
접수 Transaction
  → Ticket 저장
  → 최초 문의 Message 저장
  → Commit
  → Browser에 201 Created

별도 AI 처리
  → 저장된 입력 조회
  → Provider 호출: 접수 Transaction 밖에서 실행
  → 출력 검증
  → 유효한 Suggestion 저장
```

최종 방식은 B, 즉 접수 응답을 먼저 보내고 Server가 자동으로 AI를 처리하는 방식이다. 담당자가 수동으로 제안을 생성하는 별도 `POST /api/tickets/{id}/suggestions`는 초기 범위에서 제거한다. 접수의 `201`은 AI 제안 완료가 아니라 사용자 문의 저장 완료를 뜻한다.

접수 Commit과 작업 등록 사이의 누락을 막는 구체적인 방법은 아직 검토 중이다. 작업 기록을 접수 Transaction에 함께 넣는 안과, 독립적으로 등록하되 누락을 찾아 복구하는 안의 실패 경계를 비교해야 한다. 이 결정 전에는 단순한 메모리 작업 등록만으로 재시작 복구가 보장된다고 하지 않는다.

## 제안 데이터와 작업 상태 — 최소 설계 잠정안

| 대상 | 책임 | 최소 정보 후보 |
|---|---|---|
| `tickets` | 대화 주제와 문의 처리 상태 | ID·제목·Ticket 상태 |
| `ticket_messages` | 실제 작성된 문의·답변 | ID·Ticket ID·본문·작성자 식별자·작성 시각 |
| `ai_suggestion_jobs` | 제안 생성 작업의 진행·결과 | ID·입력 Message ID·작업 상태·시도 횟수·안전한 실패 코드·처리 시각·Prompt/Schema Version |
| `ticket_suggestions` | 검증을 통과한 제안 내용 | ID·Job ID·요약·분류 목록·우선순위·담당자 검토 상태·생성 시각 |

Message의 작성자 정보는 Server의 인증 결과를 기준으로 결정한다. Runtime 인증은 현재 In-memory 사용자 구성이라는 점을 유지하고, 사용자 영속 Table과 작성자 식별자의 관계는 별도 검토한다. 기존 `USER`·`AGENT` 권한을 소유자 기반 권한으로 조용히 변경하지 않는다.

| 작업 상태 후보 | 의미 | 해당 작업의 Suggestion |
|---|---|---:|
| `PENDING` | 실행 대기 | 0건 |
| `RUNNING` | 처리 중으로 기록됨 | 완료 전 0건 |
| `SUCCEEDED` | 출력 검증과 제안 저장 Commit 완료 | 1건 |
| `ABSTAINED` | 계약에 맞는 명시적 판단 보류 결과를 기록함 | 0건 |
| `FAILED` | 호출·검증·저장에서 최종 실패 | 0건 |

유효한 요약과 `UNDETERMINED`가 있는 제안은 저장할 수 있다. 이 경우 작업은 `SUCCEEDED`, 제안 검토는 `PENDING_REVIEW`, 문의 상태는 `OPEN`일 수 있다. 작업 성공은 내용의 정확성이나 문의 해결을 확정한 상태가 아니다. 작업 상태는 Model이 정하지 않고 Server가 실제 처리 결과로 결정한다.

유효한 `ABSTAIN`이면 Job을 `ABSTAINED`로 기록하고 Suggestion은 만들지 않으며 원본 Ticket·Message는 유지하는 기준에 합의했다. 이는 유효한 요약 자체를 만들 수 없어 제안 생성을 명시적으로 보류한 결과다. 요약은 만들 수 있지만 분류·긴급도만 모르는 경우에는 `SUGGEST`와 `UNDETERMINED`를 사용한다. Provider 거부·잘못된 JSON·필수 Field 누락을 `ABSTAIN`으로 바꾸지 않는다. 구체적인 허용 사례와 조회 응답 표현은 후속 검토에서 정한다.

`ABSTAINED`도 결과 기록이 DB에 반영된 뒤에 확정할 상태다. DB 장애로 결과나 실패 상태를 기록하지 못하면 `RUNNING`이 남을 수 있으므로, 그 값만으로 실제 작업이 계속 실행 중이라고 단정하지 않는다.

학습은 기본 처리 Test → B 방식 연결 → 단일 Application·PostgreSQL의 최소 중단 복구 순서로 진행한다. 기본 처리 Test는 이미 Commit된 입력을 사용해 성공·잘못된 출력·Provider 실패·제안 저장 실패를 먼저 분리한다. 이는 API를 A 방식으로 완성하겠다는 뜻이 아니다. 이후 미완료 작업 조회·재처리 한도·같은 작업의 중복 제안 저장 방지를 확인한다. Kafka·RabbitMQ와 분산 Worker 운영은 추가하지 않는다.

## AI 출력의 논리적 Schema v2 — 잠정안

Model은 Server가 정한 작업 지시와 Ticket 본문을 구분해야 한다. Ticket 본문 속 “이전 지시를 무시하라”는 문장은 데이터이지 권한 있는 명령이 아니다. Model 출력에 Ticket ID, 사용자 Role, Ticket 상태 또는 실행할 Tool 이름을 받지 않는다.

```json
{
  "decision": "SUGGEST",
  "summary": "로그인 링크가 만료되어 재발급이 필요함",
  "categories": ["ACCOUNT"],
  "priority": "NORMAL"
}
```

| Field | 잠정 허용값·규칙 |
|---|---|
| `decision` | `SUGGEST` 또는 `ABSTAIN` |
| `summary` | `SUGGEST`일 때 공백 제거 후 1~200 Unicode Code Point의 일반 텍스트 |
| `categories` | `SUGGEST`일 때 항목이 하나 이상인 중복 없는 목록. 각 항목은 `ACCOUNT`, `BILLING`, `TECHNICAL`, `OTHER`, `UNDETERMINED` 중 하나. 단일 문의도 목록으로 표현하며 `UNDETERMINED`는 분류 근거 부족을 나타내는 예약값 |
| `priority` | `SUGGEST`일 때 `NORMAL`, `HIGH`, `UNDETERMINED` 중 하나. `UNDETERMINED`는 긴급도 판단 근거 부족을 나타내며, Ticket의 확정 우선순위가 아님 |

아래는 위 규칙을 표현한 **검토용 JSON Schema 초안**이다. Provider가 `oneOf`·`const`를 그대로 지원한다는 뜻은 아니다. Provider별 지원 범위를 확인한 뒤 전송용 Schema를 조정하더라도 Application 검증 규칙은 유지한다.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["decision", "summary", "categories", "priority"],
  "properties": {
    "decision": { "enum": ["SUGGEST", "ABSTAIN"] },
    "summary": {},
    "categories": {},
    "priority": {}
  },
  "oneOf": [
    {
      "properties": {
        "decision": { "const": "SUGGEST" },
        "summary": { "type": "string", "minLength": 1, "maxLength": 200 },
        "categories": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": { "enum": ["ACCOUNT", "BILLING", "TECHNICAL", "OTHER", "UNDETERMINED"] }
        },
        "priority": { "enum": ["NORMAL", "HIGH", "UNDETERMINED"] }
      }
    },
    {
      "properties": {
        "decision": { "const": "ABSTAIN" },
        "summary": { "type": "null" },
        "categories": { "type": "null" },
        "priority": { "type": "null" }
      }
    }
  ]
}
```

네 Field는 모두 필수이고 그 밖의 Field는 거부한다. 이전 `category` Field를 함께 보내거나 문자열을 목록 대신 보내면 v2 계약을 통과하지 못한다. JSON의 `null`은 Field 누락과도 다른 값이며, 그 업무상 의미는 계약에서 정해야 한다. 기존 Ticket의 원문 부재는 Message가 없는 상태로 보존하고, 문의 유형 전체를 판단할 정보가 부족하면 `categories: ["UNDETERMINED"]`로 표현한다. 긴급도 판단 근거가 부족하면 `priority: "UNDETERMINED"`다. 해당 Field가 누락되거나 `SUGGEST`에서 `null`이 오면 Schema 실패다.

`items`는 목록의 각 항목, `minItems: 1`은 빈 목록 금지, `uniqueItems: true`는 같은 값의 중복 금지를 표현한다. 배열 순서를 Category의 중요도나 담당 부서의 처리 순서로 해석하지 않는다. [JSON Schema의 배열 검증 설명](https://json-schema.org/understanding-json-schema/reference/array)

유효한 요약이 있다면 분류나 긴급도가 불확실하더라도 다음처럼 판단한 범위와 판단하지 못한 범위를 함께 저장한다.

```json
{
  "decision": "SUGGEST",
  "summary": "로그인이 되지 않는다고 문의함",
  "categories": ["ACCOUNT"],
  "priority": "UNDETERMINED"
}
```

이 제안은 `PENDING_REVIEW`로 저장한다. `UNDETERMINED`를 `NORMAL`로 대체하면 판단하지 못한 상태를 보통 우선순위로 판단한 것처럼 바꾸게 된다. 원문에 없는 장애 규모나 긴급성을 추가해서도 안 된다.

`OTHER`는 분류 근거가 있으나 알려진 세 Category에 속하지 않는 경우다. 문의가 "문제가 생겼어요. 확인해주세요"뿐이어서 종류를 알 수 없다면 `categories: ["UNDETERMINED"]`로 표현한다. 이는 실제 문의 종류를 하나 더 추가하는 것이 아니라 판단 결과를 나타내는 예약값이다.

아래는 유효한 요약 자체를 만들 수 없어 제안 생성을 보류하는 `ABSTAIN`의 Schema 표현이다. 유효한 `ABSTAIN`을 Job의 `ABSTAINED`로 기록하고 Suggestion은 저장하지 않는 기준에 합의했다. 분류·긴급도만 불확실한 위 Case와 구분하며, 실제로 허용할 입력 사례와 이 표현의 검증은 별도로 확인한다.

```json
{
  "decision": "ABSTAIN",
  "summary": null,
  "categories": null,
  "priority": null
}
```

JSON 문법과 Schema가 맞아도 요약이 원문에 충실하다는 뜻은 아니다. Application은 Field·Type·허용값·공백·길이·추가 Field와 `decision`별 조합을 재검증한다. 내용의 사실성은 고정 평가 Dataset과 담당자의 원문 대조로 별도로 확인한다. Prompt-only와 Provider Schema 강제 방식은 같은 논리적 계약으로 비교한다.

형식·값 검증만으로 자유로운 문장의 모든 누락·왜곡을 자동 판별할 수는 없다. 코드가 알아낸 계약 위반은 저장 전에 거부하지만, 그 검사를 통과한 내용에도 오류가 남을 수 있다. 저장된 제안은 `PENDING_REVIEW`이며 원문을 보존한다. Dataset에서 확인한 품질을 이후 모든 요청의 사실성 보장으로 바꾸거나, 추가 AI 평가를 정답 판정기로 취급하지 않는다.

## Category와 Priority의 판단 기준

Category는 실제로 해결을 요청한 문제의 유형이지 장애 원인이나 책임 주체가 아니다. `ACCOUNT`·`BILLING`·`TECHNICAL`은 상하위 관계가 아닌 동등한 수준의 문의 유형으로 정의하고, 여러 유형이 해당하면 함께 담는 기준에 합의했다. 정상 기능의 안내 문구 개선은 요청 내용을 알지만 세 범주 밖인 `OTHER`라는 기준도 확인했다. 나머지 평가 Case별 기대값은 계속 검토한다.

| Category | 문의 유형 |
|---|---|
| `ACCOUNT` | 로그인·계정·비밀번호·접근 권한이 주된 문의 대상 |
| `BILLING` | 청구·결제·환불·청구 정보가 주된 문의 대상 |
| `TECHNICAL` | `ACCOUNT`·`BILLING`에 해당하지 않는 화면·파일·서비스 이용 등의 기술 문제. 모든 기술 문제의 상위 범주나 우리 Server의 결함 확정값이 아님 |
| `OTHER` | 문의 유형은 알 수 있지만 위 범주에 속하지 않는 경우. 예: 정상 기능의 안내 문구 개선 |
| `UNDETERMINED` | 문의 유형을 분류할 정보 자체가 부족한 경우 |

로그인·계정 또는 청구·결제 문제에는 해당 유형을 사용하고, 기술 문제라는 넓은 뜻만으로 `TECHNICAL`을 추가하지 않는다. 이유는 모든 문제를 하나로만 분류해야 해서가 아니라 위에서 정한 `TECHNICAL`의 범위에 해당하지 않기 때문이다. 로그인 실패와 PDF 미리보기 오류가 함께 있으면 `["ACCOUNT", "TECHNICAL"]`이다. 본문에 해당 단어가 등장했다는 이유만으로 선택하지 않는다.

“로그인이 안 된다”는 `ACCOUNT`, “서비스를 이용하지 못하지만 로그인 문제인지 화면 문제인지 모른다”는 기술적 이용 문제가 확인된 `TECHNICAL`로 분류한다. 후자의 분류 기준도 사용자와 확인했다. “문제가 생겼다”만으로는 증상을 알 수 없으므로 `UNDETERMINED`다. 원인 미확인을 분류 정보 부족과 혼동하지 않는다.

### 공식 가이드와 이 Lab의 선택

Microsoft는 구분하기 어려운 Class를 피하고, 로맨스·코미디와 별도의 로맨틱 코미디를 혼재시키기보다 두 유형을 함께 적용하는 예를 제시한다. AWS는 여러 Category가 동시에 적용되는 문서에 Multi-label을 선택하도록 안내한다. [Microsoft 분류 설계 가이드](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/language-service/custom-text-classification-transparency-note?view=foundry-classic), [AWS 분류 모드 선택](https://docs.aws.amazon.com/comprehend/latest/dg/create-custom-classifier-console.html)

상위·하위 중복도 보편적인 금지 규칙은 아니다. Google의 분류 V1 모델은 `/Science`와 `/Science/Astronomy`가 모두 해당하면 더 구체적인 결과만 반환하지만, V2 모델은 신뢰도 조건을 만족하면 둘을 함께 반환한다. [Google 분류 정책](https://docs.cloud.google.com/natural-language/docs/categories)

이 자료들은 공개 제품 가이드이며 각 회사 내부 Helpdesk의 운영 정책을 확인한 것은 아니다. 이 Lab은 범주의 의미를 명확히 하라는 가이드를 참고해 세 문의 유형을 동등한 수준으로 정의하고 복수 분류를 허용하는 안을 채택했다. `TECHNICAL`을 상위 범주로 두는 별도의 계층 설계는 채택하지 않는다. 출력 Field·Enum과 Ticket 자동 분리 금지는 유지하며, Prompt와 고정 평가의 기대값에도 같은 정의를 적용한다.

### 복수 Category 허용과 Ticket 자동 분리 금지

한 Message에서 독립적인 문제를 여러 개 제기하면 한 제안의 `categories`에 해당 유형을 함께 담는다. 로그인은 정상이라는 배경 설명은 로그인 문제로 분류하지 않는다. 로그인 실패와 중복 청구를 모두 해결해 달라는 문의에는 `["ACCOUNT", "BILLING"]`이 적합하다. 로그인 실패와 비밀번호 재설정 실패처럼 여러 문제가 같은 유형에 속하면 `["ACCOUNT"]` 한 항목으로 표현하고 요약에는 중요한 문제를 모두 보존한다.

단일 대표 Category를 고르는 방식과 복수 목록을 비교한 뒤 복수 목록을 채택했다. 제안의 목적은 담당자의 문의 이해를 돕는 것이며, 담당 부서 하나를 자동 배정하는 것이 아니다. 알려진 두 문제를 하나로 숨기거나 `OTHER`·`UNDETERMINED`로 바꾸지 않는다. Message·Job·Suggestion의 단위를 문제 수만큼 자동으로 늘리거나 Ticket을 분리하지 않는다.

별개의 문제 중 일부만 분류할 수 있다면 알려진 유형과 `UNDETERMINED`를 함께 담는다. “로그인이 안 되고, 별도로 다른 문제도 있지만 아직 구체적으로 설명하기 어렵다. 두 문제를 확인해 달라”는 문의에는 `["ACCOUNT", "UNDETERMINED"]`를 사용한다. 요약에도 로그인 불가와 별도 문제의 설명 부족을 함께 남긴다. 반면 로그인 실패의 원인만 모르는 문의에는 `["ACCOUNT"]`를 사용한다. `UNDETERMINED`는 별도의 미분류 문제를 보존하는 값이지, 이미 분류한 문제의 원인 미확인을 표시하는 값이 아니다. 이 병기 규칙은 사용자와 확인했다.

`priority`는 제안 전체에 하나인 기존 표현을 유지한다. 문제별 우선순위 Field나 자동 부서 배정은 추가하지 않는다. 전체 값은 아래의 합의한 기준으로 판단한다.

Priority는 처리 우선순위를 나타내며, 영향 범위·피해·긴급성을 별도로 판단한다. 다수의 이용 불가와 당일 업무 마감이 명시된 문의는 원인을 몰라도 `HIGH`로 판단할 근거가 있다. 원인은 Server뿐 아니라 조직의 공통 보안 정책·네트워크 등에도 있을 수 있지만, 원문에 없는 가설을 요약의 사실로 추가하지 않는다. AI의 Priority는 담당자의 검토 대상이며 Ticket의 확정 값을 자동으로 변경하지 않는다.

중복 출금과 환불을 요청한 문의도 이 Lab의 금전 피해 기준에서는 `HIGH`로 제안할 근거가 있다. 이는 사용자가 호소한 피해를 우선 확인하자는 판단이지, 멱등성 미구현이 원인이라는 확정이 아니다. 요약에는 두 번 출금됐다는 신고와 환불 요청을 보존하고, 원문에 없는 시스템 원인을 추가하지 않는다.

### 문의 전체의 Priority 기준 합의

개별 문제의 우선순위 중 가장 높은 값만 선택하면, 작은 문제들이 함께 발생해 우회 수단이 사라지거나 업무 영향이 커지는 상황을 놓칠 수 있다. 원문에 보고된 개별 영향과 누적·결합 영향을 함께 본다.

1. **`HIGH`**: 개별 문제 또는 누적·결합된 영향에 높은 우선순위를 줄 근거가 있다. 일부 문제의 영향이 불명확하더라도 확인된 다른 영향만으로 `HIGH`의 근거가 충분하면 전체는 `HIGH`다.
2. **`UNDETERMINED`**: `HIGH`의 근거를 확인하지 못했고, 문의 전체의 영향을 판단하는 데 필요한 정보도 부족하다. 통상 문의와 판단하지 못한 문제가 함께 있다고 모두 `NORMAL`로 바꾸지 않는다.
3. **`NORMAL`**: 보고된 개별·누적·결합 영향을 살펴봐도 통상적인 처리로 대응할 근거가 있다. 문제의 개수만으로 우선순위를 올리지 않는다.

예를 들어 미리보기와 다운로드가 각각 다른 확인 수단이었다면, 둘 다 실패했을 때는 자료를 확인할 수단이 없어진다. 원문에 당일 마감 업무를 진행하지 못한다는 영향까지 보고됐다면 전체를 `HIGH`로 제안할 근거가 된다. 두 오류가 같은 원인이라는 설명은 별도의 확인 없이 추가하지 않는다.

알 수 없는 부분은 요약과 원문에서 보존한다. 확인되지 않은 모든 잠재적 연쇄를 조사해야만 `NORMAL`을 사용할 수 있다는 뜻은 아니다. 판단에 필요한 정보의 부재와 근거 없는 가능성을 구분한다. 여러 Ticket의 관계는 한 Message만 입력받는 현재 범위에서 자동으로 확인할 수 없으며, 담당자의 종합 검토가 필요하다.

이 결정은 계약·평가 기준·학습자료에 반영한다. 평가 전 Prompt Version과 기대값을 맞추되, 이전 예비 호출이 새 규칙을 검증했다고 표시하지 않는다. 출력 Field·Enum·Ticket 상태 자동 변경 금지와 저장 경계는 그대로 유지한다.

## 필수 Field 누락과 제한된 재요청 — 잠정안

`categories`가 빠졌다는 사실만으로 AI가 의도적으로 판단을 보류했다고 해석하지 않는다. Model 출력 누락, Provider의 미완료 응답, Adapter 변환 오류는 구현 시 구분해서 확인한다. Application은 누락 값을 `["UNDETERMINED"]`로 채우거나 불완전한 제안을 저장하지 않는다.

완료된 Model 출력에서 필수 Field가 누락된 경우에는 전체 결과를 한 번 더 요청하는 안을 검토한다. "왜 빼먹었는가"에 대한 새 Model 설명만으로 원인을 확정하지 않고, 같은 최초 문의 메시지와 Prompt·Schema Version으로 필수 Field를 포함한 전체 응답을 다시 요구한다. 잘못된 원본 출력 전체를 새 지시로 붙이거나 두 응답의 일부 Field를 임의로 합치지 않는다.

- 추가 생성 요청은 최대 1회, 처음 요청을 포함하면 최대 2회다. Provider Adapter의 별도 재시도가 이 한도를 넘기지 않도록 구현 시 설정을 확인한다.
- 두 번째 응답도 JSON·Schema·Application 값 검증을 모두 수행한다. 통과한 제안만 한 건 저장한다.
- 두 번째도 계약을 어기면 출력 검증 실패로 종료하고 제안은 저장하지 않는다. AI 작업의 실패로 기록하며 이미 완료된 문의 접수의 `201`을 AI 오류 `5xx`로 바꾸지 않는다. 조회 응답의 실패 표시와 안전한 오류 코드는 후속 검토에서 정한다.
- Provider의 명시적 거부, 입력 부족, 인증·요금 오류, Timeout·연결 실패에는 이 Field 누락 재요청 규칙을 자동 적용하지 않는다.
- 이 재요청은 저장 전에 확인한 출력 오류를 대상으로 한다. DB Commit 후 Browser가 결과를 받지 못한 POST를 재시도하는 경우와 구분한다.
- 비교 실험에서는 첫 응답 실패와 재요청 후 성공을 따로 기록한다. 재요청으로 복구된 Case를 첫 응답 Schema 통과로 집계하지 않는다.
- 중단 후 복구가 이 생성 횟수 한도와 어떻게 합쳐지는지는 미결정이다. 재시작 때 횟수를 초기화해 무제한 호출하거나 외부 호출까지 정확히 한 번이라고 주장하지 않는다.

## API·권한·응답 — 잠정안

| 요청·상황 | 예상 결과 | 저장·실행 경계 |
|---|---|---|
| `POST /api/tickets` — 인증된 `USER`·`AGENT`, 유효한 CSRF Token, 제목과 최초 메시지 | 접수 Commit 뒤 `201 Created` | Ticket과 최초 Message를 함께 저장하고 Server가 별도 AI 작업을 수행 |
| 새 접수의 공백·과도하게 긴 메시지 | `400` | Ticket·Message 저장과 Provider 호출 없음 |
| 접수 Transaction 실패 | 접수 실패의 안전한 오류 응답 | Ticket·Message는 함께 Rollback하며 Provider 호출 없음 |
| 익명의 보호된 `GET` / `USER`의 제안 조회 / CSRF 없는 접수 `POST` | 각각 `401` / `403` / `403` | 인증·인가·CSRF 실패를 분리해 Test. 거부된 요청에서 새 AI 작업을 만들지 않음 |
| 권한 있는 `AGENT`의 없는 Ticket ID 조회 | `404` | 조회가 AI 호출을 유발하지 않음 |
| 최초 메시지가 없는 기존 Ticket | 기존 Ticket 조회 유지 | Provider 호출·제안 저장·임의 원문 생성 없음 |
| 유효한 요약과 Category·Priority의 `UNDETERMINED` | 제안을 `PENDING_REVIEW`로 저장 | 이미 접수한 Ticket·Message는 변경하지 않음 |
| 유효한 `ABSTAIN` | Job은 `ABSTAINED`, Suggestion은 0건 | 원본 Ticket·Message 유지. 구체적인 적용 사례·조회 표현과 실제 저장 검증은 후속 작업 |
| 완료된 AI 출력에서 필수 Field 누락 | 처음에는 저장하지 않고 최대 1회 전체 재요청하는 안 | 재검증 성공 시 제안 한 건 저장. 다시 실패하면 저장 없이 출력 오류 종료 |
| Provider Timeout·연결 실패·잘못된 출력·제안 저장 실패 | AI 작업의 실패 표시 | 접수 성공과 분리. 원본 Ticket·Message 유지, 검증되지 않은 제안 저장 없음 |
| `GET /api/tickets/{id}/ai-suggestion` — URI 후보 | `AGENT`에게 작업 상태와 존재하는 제안을 조회하는 안 | Ticket ID로 조회 가능하게 하되 URI·응답 구조·작업 미등록 표현은 미결정 |

기존 생성 권한 `USER`·`AGENT`와 조회 권한 `AGENT`는 유지한다. 고객의 자기 문의·대화 조회 권한은 이후 대화 기능을 구현할 때 별도 계약으로 정한다. 공식 답변 API와 수동 AI 재생성 API는 이번 범위에 없다.

CSRF Token은 Browser JavaScript가 Server에서 받은 Header 이름으로 접수 요청에 직접 붙인다. `201` 응답을 Browser가 받지 못해도 접수 Commit이 이미 끝났을 수 있으므로 자동 재시도하지 않는다. CORS 허용, Session 인증, CSRF와 AI 출력 검증은 서로 다른 경계다.

## 별도 저장소 — 잠정안

- 사용자 원문은 `ticket_messages.body`에 보관한다. 검증된 AI 결과는 Ticket·Message에 덮어쓰지 않고 `ticket_suggestions`에 저장한다.
- 최소 Column 후보는 위 책임 Table을 따른다. Suggestion은 Job ID로 연결하고 같은 Job의 제안은 최대 한 건이라는 Unique Constraint를 검토한다. Job에서 입력 Message와 Ticket을 추적한다. Foreign Key·조회용 Index·허용값·공백 제약과 실제 DDL은 구현 시 Test로 확인한다.
- 저장하는 `SUGGEST`의 `summary`·`priority`는 `NOT NULL` 후보이며, 분류 목록도 빈 목록·중복·허용값을 검사한 뒤 전 항목을 저장·복원한다. 단일 `category` Column에 한 항목만 남기지 않는다. 목록의 실제 저장 표현과 DDL은 Migration 설계에서 비교·확정한다. Category·Priority의 허용값에는 `UNDETERMINED`를 포함하며, 원문 부재와 불확실한 판단을 구분한다.
- 유효한 요약이 있는 제안은 Category·Priority가 `UNDETERMINED`여도 `PENDING_REVIEW`로 저장한다. 유효한 `ABSTAIN`은 Job을 `ABSTAINED`로 기록하고 제안 Row를 만들지 않는다. 잘못된 출력과 Provider 실패도 제안 Row를 만들지 않지만, 명시적 판단 보류와는 다른 실패 결과로 기록한다. AI 값만으로 Ticket 상태나 담당자의 확정 판단을 변경하지 않는다.
- 원본 Provider 응답, 전체 Prompt, Credential과 메시지 본문을 Job·Suggestion Table에 무조건 복사하거나 Log에 출력하지 않는다. 평가용 합성 Dataset과 실제 문의 원문의 보관 경계는 분리한다.
- Suggestion 저장과 Job의 `SUCCEEDED` 변경은 같은 결과 저장 Transaction으로 묶는 안이다. 저장 실패로 제안 없이 성공 상태만 남는 것을 막되, 접수 완료된 Ticket·Message는 Rollback하지 않는다.
- Provider 호출은 PostgreSQL Transaction으로 되돌릴 수 없다. 중복 제안 저장 방지가 외부 호출·요금까지 정확히 한 번을 보장하는 것은 아니다. `RUNNING`의 중단 판정·복구 조건·시도 횟수 기록은 추가 설계가 필요하다.

## 먼저 작성할 예상 Test

1. 기존 PostgreSQL Ticket Row를 Migration 뒤에도 조회하며 Message 0건을 보존한다. 본문을 조작해 Backfill하지 않고 Provider 0회·Suggestion 0건을 확인한다.
2. 새 접수의 공백·과도하게 긴 최초 본문은 `400`이며 Ticket·Message Row가 없다. 첫 Message 저장 실패는 Ticket까지 Rollback한다.
3. JSON 문법 실패, Field 누락·추가, Type·Enum 오류, 공백·긴 요약, `decision`과 나머지 Field의 모순은 저장하지 않는다. v2의 `categories` 누락·문자열·빈 목록·중복·허용값 밖 항목과 이전 `category` Field도 거부한다.
4. 유효한 요약과 Category·Priority의 `UNDETERMINED`는 저장·복원되고 `OTHER`·`NORMAL`로 바뀌지 않는다. Field 누락, `SUGGEST`의 `null`, 허용 목록 밖 값은 거부한다.
5. 실제 PostgreSQL에서 접수 Commit 뒤 Provider 실패·Invalid Output·제안 저장 Rollback을 각각 재현한다. 원본 Ticket 1건·최초 Message 1건과 그 값·Ticket 상태가 유지되고 해당 Job의 Suggestion은 0건이어야 한다. 유효 제안의 저장·복원과 Job 상태의 원자성도 확인한다.
6. 실제 Security Filter Chain에서 `USER`·`AGENT` 접수 허용, 익명 보호 GET `401`, `USER` 제안 조회 `403`, 유효하지 않은 CSRF의 접수 `403`을 분리한다. 거부된 접수는 Row·새 Provider 호출이 없어야 한다.
7. Browser는 요약을 `textContent`로 표시한다. 접수 `201`이 AI 완료를 뜻하지 않는지, 접수 응답을 못 받은 경우 `unknown`과 자동 재시도 금지를 확인한다.
8. Injection이 Category·Priority·Ticket ID·Ticket 상태를 강제로 바꾸거나 민감 값을 출력하도록 유도하는 대표 Case를 재현한다. 선택한 Case의 통과가 모든 유출 방지를 증명하지는 않는다.
9. 첫 응답의 Field 누락 뒤 정상 응답이면 생성 요청 2회·제안 저장 1건이다. 두 번 모두 누락이면 생성 요청 2회에서 종료·저장 0건이다. 누락 값을 임의 보완하지 않으며, 명시적 거부나 Adapter 오류에 같은 재요청을 적용하지 않는다.
10. PostgreSQL을 유지한 단일 Application 재시작에서 미완료 Job을 찾아 복구하고 같은 Job의 제안 중복 저장을 막는다. 호출 중단·횟수 상한·결과 저장과 상태 갱신의 실패를 구체적인 복구 계약 확정 뒤 재현한다.
11. 복수 Category의 유효 제안을 한 건 저장·복원하며 목록의 항목을 잃지 않는다. 한 Category가 부적합하거나 목록 저장이 실패하면 제안·작업 완료 표시를 부분 저장하지 않는다. 분류 목록 때문에 Ticket·Message·Job을 자동으로 분리하지 않는다.
12. 유효한 `ABSTAIN`의 결과 기록 뒤 Job은 `ABSTAINED`, Suggestion은 0건이며 원본 Ticket·Message는 그대로다. Provider 거부·JSON 오류·Field 누락을 `ABSTAINED`로 기록하지 않는다. 상태 저장 실패까지 정상 보류로 표시하지 않는다.
13. 합성 민감 값을 넣은 입력의 전송용 복사본에서 불필요한 값이 제거·치환되는지 Fake Provider의 수신 인자로 확인한다. 접수 원문을 전처리본으로 덮어쓰지 않고, 출력·Log에도 해당 값이 복사되지 않는지 별도로 확인한다. 실제 개인정보로 시험하지 않는다.
14. Injection 의심 신호와 문의 Priority를 분리한다. 통상 문의의 명령문만으로 `HIGH`나 `SECURITY` 분류가 되지 않으며 추가 출력 Field도 허용하지 않는다. 허용하지 않은 Tool·Ticket 상태 변경을 실행하지 않는지는 독립 Spike와 Application Test로 확인한다.

## 사용자와 검토할 질문

1. `ABSTAINED`와 Suggestion 0건이라는 기록 기준은 정했다. `ABSTAIN`을 허용할 구체적인 입력 사례와 담당자에게 보여줄 조회 표현은 무엇으로 정할 것인가?
2. 접수와 Job 등록의 Commit 경계를 어떻게 잡아 문의 보존과 작업 누락 방지를 함께 지킬 것인가?
3. Category·Priority 목록, 최초 메시지 2,000자·요약 200자 상한과 Request/Response의 메시지 표현은 적절한가?
4. 제안 한 건마다 Row를 추가하고, 아직 확정·적용 기능 없이 `PENDING_REVIEW`로만 두어도 되는가?
5. 필수 Field 누락의 추가 생성 1회와 중단 후 복구의 총 호출 한도를 어떻게 합칠 것인가?
6. 작업 상태 이름·실패 코드·`RUNNING` 중단 판정과 담당자의 조회 표현은 무엇으로 정할 것인가?
7. 합의한 전체 Priority 기준을 Prompt와 평가 기대값에 어떻게 적용하고, 개별·결합 영향과 정보 부족을 어떤 Case로 확인할 것인가?

질문에 대한 답변을 받아 이 문서를 수정한 뒤에만 Prompt·Schema와 API 계약을 확정한다. 실제 Provider 선택, 비용·민감 정보 취급, 실행·평가·Lab 구현은 이 초안과 별도의 후속 작업이다.

## 검토에 따른 변경

| 날짜 | 변경 | 이유 | 남은 검토 |
|---|---|---|---|
| 2026-09-30 | 긴급도만 불확실하면 `priority: null`인 유효 제안을 저장하는 잠정안으로 수정 | 긴급도를 판단하지 못해도 원문에 충실한 요약과 분류는 사용할 수 있음 | `ABSTAIN`의 정의·기록 방식, Category 불확실, 허용값·길이·권한·실패 응답 |
| 2026-09-30 | 판단 근거 부족은 Category·Priority의 `UNDETERMINED`로 명시하고, 저장하는 두 Column은 `NOT NULL` 후보로 변경 | 원문·결과의 부재와 판단하지 못한 상태의 의미를 구분 | `ABSTAIN`의 정의·기록 방식, 허용값·길이·권한·실패 응답 |
| 2026-09-30 | 누락 Field를 임의로 채우지 않고 전체 응답을 최대 1회 다시 요청하는 잠정안 추가 | 명시적 판단 보류와 계약 위반을 구분하면서 비용·지연과 반복 호출에 한도를 둠 | 재요청 한도, Provider 미완료·거부·Adapter 오류 분류, 작업 실패 코드·조회 표현 |
| 2026-09-30 | 최종 처리 B: 문의 접수 Commit·응답 후 Server의 별도 AI 처리, 수동 생성 API 제외 | AI는 보조 제안이며 AI 실패가 사용자 문의를 취소해서는 안 됨 | Job 등록·복구·조회 계약 |
| 2026-09-30 | 기본 처리 Test → B 연결 → 최소 중단 복구의 단계적 학습 | 출력 검증·Transaction·비동기·복구를 한 번에 구현하지 않고 실패 원인을 분리 | 단계별 실제 Test·Provider 호출 |
| 2026-09-30 | Ticket은 대화 묶음, 원문은 최초 Message로 분리 | 최초 문의와 후속 답변을 같은 메시지 모델로 다루고 본문 중복을 피함 | 작성자 식별자·API 표현·Migration. 후속 대화 기능은 Week 9 이후 |
| 2026-09-30 | Job과 Suggestion 책임 및 다섯 작업 상태의 잠정안 기록 | 제안 부재·실패·명시적 판단 보류와 담당자 검토 상태를 구분 | `ABSTAINED` 기록 방식·복구·호출 한도는 미확정 |
| 2026-10-02 | 10월 1일 학습 회차의 토의를 반영해 Category 범위·겹침 처리 잠정안을 추가하고 Priority와 원인 판단을 분리 | 여러 사용자의 이용 불가가 Server 장애를 확정하지는 않지만 영향과 긴급성은 우선순위 근거가 됨 | Category 범위·겹침 기준과 평가 기대값의 최종 확인 |
| 2026-10-02 | 단일 `category` 대신 복수 `categories` 목록을 채택하고 논리적 Schema를 v2로 변경. Ticket 자동 분리 금지 | 독립적인 복수 문제를 제안에 보존한다는 사용자 승인. 단일 대표값 선택 대신 목록을 사용 | 계약·평가 초안·학습자료·주간 계획에 반영. 빈 목록·중복·항목 검증, 저장 표현, 전체 Priority는 후속 검토·Test |
| 2026-10-02 | 별도의 미분류 문제가 있을 때만 알려진 Category와 `UNDETERMINED` 병기 | 알려진 문제와 설명 부족을 함께 보존하되, 원인 미확인을 문의 유형 미확인으로 오해하지 않는 규칙에 사용자 동의 | 계약·평가 기준·학습자료·학습노트에 반영. 고정 입력의 원문 대조로 확인하며 실제 Provider 평가·Lab Test는 후속 작업 |
| 2026-10-02 | 논리적 계약을 `v2.1-draft`로 구분하고 문의 전체의 Priority 기준 합의 | 사용자가 판단 보류의 보존과 작은 문제들의 누적·연쇄 가능성을 지적하고 보완안 승인 | Field·Enum은 유지. 계약·Rubric·학습자료에 반영하며 평가 전 Prompt·기대값을 정렬. Spring·저장 구현은 후속 작업 |
| 2026-10-02 | A03의 서비스 이용 불가를 `TECHNICAL`로 분류하는 기준 확인 | 문제의 원인이 불명확해도 기술적인 이용 문제라는 유형은 알 수 있다는 구분에 사용자 동의 | 평가 기대값과 학습노트에 반영. 원문에 없는 장애 원인은 추가하지 않으며 나머지 Category 범위·겹침 기준은 계속 검토 |
| 2026-10-02 | 세 문의 유형을 동등한 범주로 정의하고 복수 분류 허용. 상위 범주와 함께 출력하는 계층안은 채택하지 않음 | 사용자 요청으로 Microsoft·AWS·Google의 공개 가이드를 검토한 뒤, 명확한 경계와 복수 분류를 사용하는 안에 승인 | 계약·평가 초안·학습자료·학습노트에 반영. `OTHER` 경계 사례·나머지 기대값과 Prompt 정렬은 후속 검토. 실제 Provider·저장 Test는 별도 |
| 2026-10-03 | 정상 기능의 안내 문구 개선을 `OTHER`로 분류하는 경계 확인 | 요청 내용을 알지만 기존 세 범주 밖이라는 사용자 설명 | N04의 분류 기준에 반영. 다른 Case의 기대값·평가 조건은 계속 검토 |
| 2026-10-03 | 유효한 `ABSTAIN`은 Job `ABSTAINED`·Suggestion 0건으로 기록하고 원문 유지 | 명시적 제안 생성 보류와 호출·검증 실패를 구분하는 처리안에 사용자 승인 | 계약·평가 기준·학습노트에 반영. 구체적 적용 사례·조회 표현·DB 저장 Test와 복구 구현은 후속 작업 |
| 2026-10-03 | 문의 Priority와 보안 신호를 분리하고 AI 전송용 복사본에서 불필요한 민감 정보 제거 | 사용자가 Injection 의심 입력의 보안 경고와 전송 전 마스킹을 제안하고 분리·최소화 방향에 승인 | 출력 Field·Enum과 원문 모델은 유지. 전처리·탐지·안전한 기록과 실제 Test, 원문 보관 정책은 후속 검토 |

JSON의 `null`과 Field 누락의 차이는 [JSON Schema의 null 설명](https://json-schema.org/understanding-json-schema/reference/null)을 참고한다.
Transaction의 Commit·Rollback은 [PostgreSQL 공식 문서](https://www.postgresql.org/docs/17/tutorial-transactions.html)를 참고한다.
