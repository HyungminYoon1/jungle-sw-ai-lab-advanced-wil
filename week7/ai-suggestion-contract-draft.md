# AI Suggestion 계약 초안

> 상태: 검토 중인 제안 — 사용자 확인 전에는 확정 계약이 아님
> 작성일: 2026-09-29
> 구현 상태: Lab의 AI Provider·Suggestion API·Migration·Test는 아직 없음

이 문서는 Week 7의 한 수직 흐름에 필요한 입력·출력·권한·저장·실패 계약을 검토하기 위한 초안이다. Provider별 Structured Output API 형식은 Provider를 선택한 뒤 공식 문서와 최소 호출로 확인한다. 아래의 `v1`은 **우리 Application의 논리적 계약 초안**이며, 실제 Provider 지원이나 Test 통과를 뜻하지 않는다.

## 현재 기준과 이미 합의한 입력 경계

- 현재 Lab의 `POST /api/tickets`는 제목만 받아 `USER`·`AGENT`가 생성할 수 있다. `GET /api/tickets/{id}`는 `AGENT`만 읽는다. AI 기능은 아직 없다.
- 새 Ticket 생성에는 공백이 아닌 `description`을 요구한다. 기존 Ticket의 본문 부재는 `NULL`로 남기고 조회할 수 있게 한다. 제목 복사·`없음` 문자열·AI 생성 글로 기존 본문을 채우지 않는다.
- 잠정 API 표현은 새 `POST /api/tickets` Body에 `title`과 `description`을 받으며, 생성·조회 응답에도 `description`을 포함하는 안이다. 기존 Row를 조회하면 그 값은 `null`이다. 기존 제목만 보내던 Client는 변경 뒤 `400`을 받으므로 Browser 입력과 Test도 함께 바꿔야 한다.
- 본문이 없는 Ticket의 AI 제안 요청은 Provider 호출 전에 거부한다. Provider에는 Client가 보낸 임의의 Ticket ID나 Prompt가 아니라 Server가 조회한 Ticket의 제목·본문만 작업 데이터로 전달한다.
- `description`의 잠정 상한은 공백 제거 후 2,000 Unicode Code Point다. 길면 조용히 자르지 않고 새 생성 요청을 `400`으로 거부한다. 상한과 문자 계산 방식은 구현·비용 검토 전에 다시 확인한다.

기존 Row가 있는 Database에는 새 Column을 일단 nullable로 추가한다. 값이 있는 경우 공백 문자열을 거부하는 DB `CHECK`를 제안한다. 이는 기존 Row와 새 생성 API의 규칙을 동시에 지키기 위한 단계적 방식이다. DB만으로는 새 Row의 `NULL`까지 구분해 막지 못하므로, 새 생성 경로의 Domain·Request 검증과 PostgreSQL Integration Test가 필요하다. 모든 Row에 실제 사용자 본문이 마련되기 전에는 `NOT NULL`을 강제하지 않는다.

## AI 출력의 논리적 Schema v1 — 잠정안

Model은 Server가 정한 작업 지시와 Ticket 본문을 구분해야 한다. Ticket 본문 속 “이전 지시를 무시하라”는 문장은 데이터이지 권한 있는 명령이 아니다. Model 출력에 Ticket ID, 사용자 Role, Ticket 상태 또는 실행할 Tool 이름을 받지 않는다.

```json
{
  "decision": "SUGGEST",
  "summary": "로그인 링크가 만료되어 재발급이 필요함",
  "category": "ACCOUNT",
  "priority": "NORMAL"
}
```

| Field | 잠정 허용값·규칙 |
|---|---|
| `decision` | `SUGGEST` 또는 `ABSTAIN` |
| `summary` | `SUGGEST`일 때 공백 제거 후 1~200 Unicode Code Point의 일반 텍스트 |
| `category` | `SUGGEST`일 때 `ACCOUNT`, `BILLING`, `TECHNICAL`, `OTHER` 중 하나 |
| `priority` | `SUGGEST`일 때 `NORMAL`, `HIGH` 중 하나. Ticket의 확정 우선순위가 아닌 제안값 |

아래는 위 규칙을 표현한 **검토용 JSON Schema 초안**이다. Provider가 `oneOf`·`const`를 그대로 지원한다는 뜻은 아니다. Provider별 지원 범위를 확인한 뒤 전송용 Schema를 조정하더라도 Application 검증 규칙은 유지한다.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["decision", "summary", "category", "priority"],
  "properties": {
    "decision": { "enum": ["SUGGEST", "ABSTAIN"] },
    "summary": {},
    "category": {},
    "priority": {}
  },
  "oneOf": [
    {
      "properties": {
        "decision": { "const": "SUGGEST" },
        "summary": { "type": "string", "minLength": 1, "maxLength": 200 },
        "category": { "enum": ["ACCOUNT", "BILLING", "TECHNICAL", "OTHER"] },
        "priority": { "enum": ["NORMAL", "HIGH"] }
      }
    },
    {
      "properties": {
        "decision": { "const": "ABSTAIN" },
        "summary": { "type": "null" },
        "category": { "type": "null" },
        "priority": { "type": "null" }
      }
    }
  ]
}
```

네 Field는 모두 필수이고 그 밖의 Field는 거부한다. `SUGGEST`라면 세 값이 유효해야 한다. 정보가 부족하여 분류나 우선순위를 근거 있게 제안할 수 없다면 다음 형태의 `ABSTAIN`을 허용하는 안을 검토한다. `OTHER`는 알려진 Category에 속하지 않지만 판단 근거는 있는 경우이며, `ABSTAIN`을 대체하지 않는다.

```json
{
  "decision": "ABSTAIN",
  "summary": null,
  "category": null,
  "priority": null
}
```

JSON 문법과 Schema가 맞아도 요약이 원문에 충실하다는 뜻은 아니다. Application은 Field·Type·허용값·공백·길이·추가 Field와 `decision`별 조합을 재검증한다. 내용의 사실성은 고정 평가 Dataset과 담당자의 원문 대조로 별도로 확인한다. Prompt-only와 Provider Schema 강제 방식은 같은 논리적 계약으로 비교한다.

## API·권한·응답 — 잠정안

| 요청·상황 | 예상 결과 | 저장·실행 경계 |
|---|---|---|
| `POST /api/tickets/{id}/suggestions` — 인증된 `AGENT`, 유효한 CSRF Token, 충분한 본문 | 유효한 `SUGGEST` 저장 시 `201 Created`와 제안 ID·Field 반환 | 요청 Body에 원문 Prompt를 받지 않음. Server가 Ticket을 조회하고 Provider를 호출 |
| 같은 요청에서 `ABSTAIN` | `200 OK`와 보류 표시를 반환하는 안 | 제안 Row는 만들지 않고 담당자에게 직접 판단하도록 표시 |
| 인증 없음 / `USER` / CSRF Token 없음 | 기존 API 관례대로 각각 `401` / `403` / `403` | Controller와 Provider에 도달하지 않음 |
| 권한 있는 `AGENT`가 없는 Ticket ID 요청 | `404` | Provider 호출·저장 없음 |
| 본문이 `NULL`인 기존 Ticket | `409 Conflict` 제안 | Provider 호출·저장 없음. 기존 Ticket 조회는 계속 가능 |
| Provider Timeout·연결 실패·잘못된 출력 | 안전한 5xx 응답; 정확한 Status와 오류 구분은 검토 대기 | 검증되지 않은 Row 저장·Ticket 상태 변경 없음 |
| `GET /api/tickets/{id}/suggestions/{suggestionId}` | 해당 Ticket에 속한 제안을 `AGENT`에게만 반환 | Browser가 생성 응답을 놓친 경우 실제 저장 여부를 확인하는 경로 |

CSRF Token은 Browser JavaScript가 Server에서 받은 Header 이름으로 직접 붙인다. `201` 응답을 Browser가 받지 못해도 DB Commit이 이미 끝났을 수 있으므로 자동 재시도하지 않는다. `POST` 응답의 네트워크 실패를 곧바로 “저장 실패”라고 표시하지 않는다. CORS 허용, Session 인증, CSRF와 AI 출력 검증은 서로 다른 경계다.

## 별도 저장소 — 잠정안

- Ticket의 `description`은 사용자 원문이다. 검증된 AI 결과는 Ticket Row에 덮어쓰지 않고 별도 `ticket_suggestions` Table에 한 건씩 저장한다.
- 최소 Column 후보: `id`, `ticket_id` Foreign Key, `summary`, `category`, `priority`, `prompt_version`, `schema_version`, `review_status = PENDING_REVIEW`, `created_at`이다. `ticket_id` 조회용 Index와 허용값·공백 Constraint를 둔다. 실제 DDL은 구현 시 Test로 확인한다.
- `ABSTAIN`, 잘못된 출력과 Provider 실패는 제안 Row로 저장하지 않는다. AI 값만으로 Ticket 상태나 담당자의 확정 판단을 변경하지 않는다.
- 원본 Provider 응답, 전체 Prompt, Credential과 민감 원문을 이 Table에 저장하거나 Log에 출력하지 않는다. 평가용 합성 Dataset·실행 결과 기록과 실제 사용자 문의의 보관 경계는 분리한다.
- Provider 호출은 PostgreSQL Transaction으로 되돌릴 수 없다. 검증 완료 후 저장 Transaction이 실패하면 제안 Row와 Ticket 변경은 없어야 하지만 Provider 호출은 이미 있었을 수 있다.

## 먼저 작성할 예상 Test

1. 기존 PostgreSQL Row의 본문 `NULL`을 Migration 후에도 보존하고 `GET`으로 조회한다.
2. 새 생성의 공백·과도하게 긴 본문은 `400`이며 Ticket Row가 없다. 본문 없는 기존 Ticket의 제안 요청은 Provider 0회·Suggestion 0건이다.
3. JSON 문법 실패, Field 누락·추가, Type·Enum 오류, 공백·긴 요약, `decision`과 나머지 Field의 모순은 저장하지 않는다.
4. `ABSTAIN`은 `SUGGEST`로 저장되지 않는다. Injection이 Category·Priority·Ticket ID·Ticket 상태를 강제로 바꾸거나 민감 값을 출력하도록 유도하는 대표 Case를 재현한다. 선택한 Case의 통과가 모든 유출 방지를 증명하지는 않는다.
5. 실제 PostgreSQL에서 유효 제안만 저장·복원하고 Foreign Key·Constraint·저장 실패 후 Ticket 상태를 확인한다. 가짜 Repository Test와 구분한다.
6. 익명 `401`, `USER` `403`, CSRF 실패 `403`, `AGENT` 성공을 실제 Security Filter Chain에서 검증한다.
7. Browser는 요약을 `textContent`로 표시한다. 생성 응답을 못 받은 경우 결과를 `unknown`으로 두고 자동 재시도하지 않는다.

## 사용자와 검토할 질문

1. 정보가 부족한 문의에서 AI가 무리하게 Category·Priority를 채우지 않고 `ABSTAIN`을 반환하며 제안 Row를 남기지 않는 것이 맞는가?
2. `AGENT`만 제안을 생성·조회하는 권한과, 본문 없는 기존 Ticket의 `409`가 적절한가?
3. Category·Priority 목록과 본문 2,000자·요약 200자 상한은 학습용 문의에 맞는가?
4. 제안 한 건마다 Row를 추가하고, 아직 확정·적용 기능 없이 `PENDING_REVIEW`로만 두어도 되는가?

질문에 대한 답변을 받아 이 문서를 수정한 뒤에만 Prompt·Schema와 API 계약을 확정한다. 실제 Provider 선택, 비용·민감 정보 취급, 실행·평가·Lab 구현은 이 초안과 별도의 후속 작업이다.
