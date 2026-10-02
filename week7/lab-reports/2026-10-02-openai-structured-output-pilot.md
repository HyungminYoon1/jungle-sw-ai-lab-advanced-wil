# OpenAI 최소 비교와 요약 충실도 평가

> 학습일: 2026-10-02
> 상태: 실제 Provider 예비 응답 두 건 확인과 원문 대조 완료. 전체 고정 평가·Spring AI 연결·PostgreSQL 저장은 미실시
> 근거: 사용자가 Helpdesk 전용 PowerShell에서 실행하고 공유한 보고서. 별도로 API를 재호출하거나 계정 청구액을 조회하지 않음

같은 문의를 Prompt-only와 Structured Outputs로 한 번씩 보내 전달·생성·출력 검증을 확인했다. 두 응답은 형식 검증을 통과했지만, 첫 요약에는 로그인 성공 사실이 빠졌다. 이 기록에서는 실제 응답과 형식 판정, 원문을 읽고 내린 내용 판정을 나누어 정리한다.

## 입력과 실행 조건

제목은 “로그인 링크가 만료되었습니다”였다. 입력 본문은 평가용 합성 문의 N01이다.

> 제 계정에서 로그인 링크가 만료됐다는 안내가 나왔습니다. 새 링크를 받아 로그인에는 성공했습니다. 다른 사용자의 문제는 확인하지 못했고, 급한 문의는 아닙니다. 링크가 만료된 이유를 알고 싶습니다.

보존할 핵심 사실은 링크 만료, 새 링크로 로그인 성공, 만료 이유 문의다. 급한 문의가 아니라는 문장은 Priority의 근거다. 기대값은 평가자가 비교할 정보이며, Case별 정답을 Model 입력에 붙인 것은 아니다.

| 조건 | 예비 호출에서 사용한 값 |
|---|---|
| Provider와 Model | OpenAI · `gpt-6-luna` |
| 실행 코드 | Lab의 `scripts/week7-openai-pilot.mjs` |
| 호출 수 | Prompt-only 1회·Structured Outputs 1회, 합계 2회 |
| 공통 조건 | 같은 작업 지시·제목·본문·Model, 두 출력에 같은 검증기 적용 |
| 달라진 조건 | `text.format`: `text` 또는 `json_schema` |
| 생성 설정 | `reasoning.effort: none`, `service_tier: default`, `store: false` |
| 출력·대기 상한 | 600 Token·60,000ms |
| Prompt Version | `prompt-v1-pilot` |
| 전송용 Schema Version | `provider-schema-v1-pilot` |
| 호출 당시 논리적 계약 | `v2-draft` |
| Dataset Version | `dataset-v2-draft` |

사용자는 다음 명령을 Helpdesk 전용 키가 설정된 Process에서 실행했다. 이 문서에 Credential이나 환경 변수 값은 보관하지 않는다.

```powershell
node .\scripts\week7-openai-pilot.mjs --live --confirm-helpdesk-key
```

## 실제로 받은 두 응답

### Prompt-only 응답

```json
{
  "decision": "SUGGEST",
  "summary": "로그인 링크가 만료된 이유를 알고 싶어 합니다.",
  "categories": ["ACCOUNT"],
  "priority": "NORMAL"
}
```

### Structured Outputs 응답

```json
{
  "decision": "SUGGEST",
  "summary": "로그인 링크가 만료됐으나 새 링크를 받아 로그인에 성공했습니다. 링크가 만료된 이유를 문의합니다.",
  "categories": ["ACCOUNT"],
  "priority": "NORMAL"
}
```

| 관찰 항목 | Prompt-only | Structured Outputs |
|---|---:|---:|
| HTTP Status | 200 | 200 |
| Script의 결과 분류 | `VALID_OUTPUT` | `VALID_OUTPUT` |
| JSON·계약 검증 | 모두 통과 | 모두 통과 |
| 입력 Token | 518 | 630 |
| 출력 Token | 36 | 56 |
| Script에서 측정한 지연 | 3,120ms | 2,262ms |
| 사용량 기반 비용 추정 | $0.00008275 | $0.00010675 |

두 응답의 반환 Model은 `gpt-6-luna`, Service Tier는 `default`였다. 보고서의 `callsAttempted`는 2, `stopped`는 false, 남은 방식은 없었다. 지연 값은 Script에서 측정한 실행 시간이지 Model 내부 계산 시간만을 측정한 값은 아니다.

## 형식 판정과 수동 내용 평가

Script는 JSON·필수 Field·허용값·공백·길이·중복 등을 검사했다. 두 응답의 `manualContentReview`는 모두 `NOT_SCORED`다. 아래 점수는 그 코드가 계산한 값이 아니라, 원문을 대조한 Codex의 판정과 사용자가 확인한 핵심 사실을 반영한 평가다.

| 내용 항목 | Prompt-only | Structured Outputs |
|---|---|---|
| 분류 | 로그인 링크 문의에 맞는 `ACCOUNT` | 로그인 링크 문의에 맞는 `ACCOUNT` |
| Priority | 급하지 않다는 원문의 `NORMAL` 근거와 일치 | 급하지 않다는 원문의 `NORMAL` 근거와 일치 |
| 핵심 사실 | 새 링크로 로그인에 성공했다는 사실 누락 | 링크 만료·로그인 성공·만료 이유 문의 보존 |
| 보완한 Rubric의 요약 점수 | 0점 — 핵심 누락 | 2점 — 핵심 사실 보존 |

로그인 성공은 이전에 안 되던 상태가 되는 상태로 바뀌었다는 정보다. 담당자는 로그인 복구가 필요한 문의와, 로그인은 됐지만 만료 이유를 묻는 문의에 다르게 대응해야 한다. 사용자는 이 사실을 핵심 정보라고 설명했다. 첫 요약에 거짓 사실이 추가된 것은 아니므로 오류 이유는 핵심 누락으로 기록한다.

예비 결과를 토의하며 핵심 사실 누락의 점수 문구를 명확하게 했다. 따라서 위 점수는 보완 후의 `rubric-v2.1-draft`를 적용한 수동 평가이며, 사전에 고정한 기준으로 수행한 블라인드 본 평가가 아니다. 계약의 전체 Priority도 호출 이후 `v2.1-draft`로 보완했다. 이전 Prompt와 Version은 새 조건의 평가와 분리해서 보관한다.

## 하루 누적 예산과 비용 추정

사용자가 승인한 $1은 10월 2일 Helpdesk API 실험 전체의 누적 상한이다. 호출 한 건마다 또는 Script 실행마다 새로 사용할 수 있는 $1이 아니다.

공유된 두 건의 사용량에 입력 $0.125/백만 Token, 출력 $0.5/백만 Token의 추정 단가를 적용하면 합계는 $0.0001895다. 이 단가는 실행 보고서의 비용 계산 조건이며, 실제 청구액을 조회한 결과가 아니다. 호출 전의 $0.00295725는 여유를 둔 계획용 추정치다.

현재 Script의 `budgetUsd` 검사는 실행 한 번의 계획용 비용을 대상으로 한다. 실행 사이의 누계를 저장하거나 계정의 하루 지출을 강제하는 기능은 없다. 다음 유료 실험 전에 이전 호출과 실패·재시도까지 포함한 누계를 관리해야 한다. 사용량을 확인하지 못한 호출은 비용 0으로 처리하지 않는다.

## 이번 비교에서 확인한 내용과 다음 단계

독립 Node Process에서 OpenAI 응답을 받아 같은 구조 검증기로 판정할 수 있음을 확인했다. 형식 통과만으로 핵심 사실 보존을 판단할 수 없다는 점도 두 요약을 원문과 비교해 확인했다. 한 문의를 방식별 한 번씩 실행한 결과이므로 어느 방식이 일반적으로 더 정확하거나 빠르다고 결론 내리지는 않는다.

Spring의 AI Provider Adapter, Message·Job·Suggestion Migration, PostgreSQL 저장과 Browser 흐름에는 아직 연결하지 않았다. 전체 비교 전에는 기대값·Rubric·Prompt와 누적 예산 관리 방식을 맞춘다. 기존 Dataset은 13건이며 두 방식·두 반복의 52회 비교는 아직 실행하지 않았다.

- [AI 제안 평가 Dataset과 Rubric 초안](../ai-suggestion-evaluation-draft.md)
- [AI Suggestion 계약 초안](../ai-suggestion-contract-draft.md)
- [10월 2일 핵심 질문과 이해 변화](../study-notes/2026-10-02-study-questions.md)
