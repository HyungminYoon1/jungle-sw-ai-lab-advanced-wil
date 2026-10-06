# 담당자 최소 AI 조회 화면 — HTTP 성공과 작업 결과

> 실행일: 2026-10-06
> 상태: JavaScript·정적 Resource MockMvc 검증 완료
> 범위: 담당자용 조회 화면·응답 분기·Text 표시·Race 방어·Page 연결
> Lab Commit: `b882cb0` — `feat(ai): add minimal read-only agent suggestion UI`

## 화면이 표시하는 사실

`response.ok`가 `true`여도 AI Job이 `FAILED`이면 작업 실패로 표시한다. `SUCCEEDED`·`PENDING_REVIEW`는 ‘AI 제안 생성 완료·담당자 검토 대기’다. 사용자 문답에서 이 두 구분을 확인하고 화면에 연결했다.

| 조회 내용 | 화면 표시 |
|---|---|
| `job: null` | 등록된 AI 작업 없음 |
| `PENDING` | 처리 대기 |
| `RUNNING` | 처리 중 |
| `FAILED` | AI 처리 실패·허용된 고정 실패 코드 |
| `ABSTAINED` | 제안 생성 보류 |
| `SUCCEEDED`와 제안 | 요약·분류·우선순위와 담당자 검토 대기 |
| HTTP 조회 오류 | 로그인·권한·Ticket 부재·조회 오류를 구분 |
| 읽을 Response 없음 / JSON·구조 오류 | 응답 읽기 실패 / 잘못된 응답을 표시 |

제안 저장이 고객 문의 해결이나 담당자의 내용 검토를 뜻하지 않는다. 조회 실패를 AI Job의 `FAILED`로 바꾸어 표현하지 않는다.

## 구현 범위

Lab의 `/ai-suggestions.html`에 별도 조회 Form을 추가했고 `/tickets.html`에는 링크만 넣었다. 빈 화면과 Module은 기존 공개 정적 파일 정책을 유지한다. 데이터 API의 익명 `401`·USER `403`·AGENT 허용 규칙은 Server에 그대로 남는다.

조회 버튼을 누르면 같은 Origin GET을 한 번 보낸다. Session Cookie는 Browser의 인증 요청 흐름을 사용하고 CSRF Token 조회·자동 Polling·AI 실행·실패 재시도를 추가하지 않는다. 기존 API·조회 SQL·Worker·Migration·호출 정책도 바꾸지 않았다.

Client는 요청한 Ticket ID·정확한 필드 집합·허용값·명시적 null·Job과 Suggestion 관계를 확인한다. 공백 요약이나 없는 필드를 성공으로 보정하지 않는다. Runtime 요약 상한은 기존 Server 검증기의 주입 계약이며 UI에 별도 숫자를 정하지 않았다.

View는 요약을 `textContent`로 표시한다. `<strong>긴급</strong>`처럼 HTML 모양인 문자열도 그대로 유지한다. 새 조회에서는 이전 요약·실패 코드를 지우고, Abort Signal과 현재 요청 번호를 함께 확인한다. 늦은 이전 정상 응답·오류·JSON 해석이 최신 결과를 덮지 않는다.

## 점검한 Source

- VERIFIED: Lab의 새 `ai-suggestion-ui.mjs`·`ai-suggestion-page.mjs`·`ai-suggestions.html`·Node Test 두 파일·`AiSuggestionPageIntegrationTest`와 기존 Ticket UI·Page·HTML·Test·README·Security 설정·조회 DTO/Service·상태와 허용값 Enum.
- PARTIAL: 기존 조회 HTTP Integration Test는 이번 회차에서 Fixture·조립 부분을 확인하고 전체 34개 Test를 실행했다. WIL의 계약·계획은 이번 화면과 관련된 API·상태·현재 근거 구간을 선택해 대조했다. 다른 기능 전체를 다시 Audit한 것은 아니다.

## 자동 검증

| 검증 | 결과와 근거 |
|---|---|
| 새 Node Test | 29개 통과. 합성 Response·DOM Test Double·Page 연결 |
| 새 정적 Resource MockMvc Test | 5개 통과. `in-memory` Context에서 HTML·Module 제공, 기존 화면의 링크, 익명 데이터 GET `401`·Controller 미진입 |
| 전체 Java Clean Test | 449개 통과. 실패·오류·건너뜀 0, Surefire XML 45개 |
| 전체 JavaScript Test | 133개 통과. 실패·취소·건너뜀 0 |
| ESLint | 10.11.0, 오류 0 |
| 이번 회차 유료 AI 호출 | 0회 |

변경 파일의 UTF-8 without BOM·LF, Diff Check와 문서 상대 링크를 확인했다. 대표 API Key·BCrypt·기본 Password 안내 Pattern은 변경 파일과 Surefire Report에서 0건이었다. 이 Pattern 점검을 모든 Secret 탐지의 보장으로 해석하지 않는다.

HTTP `400`·`401`·`403`·`404`·`500`·`503`에는 JSON 해석이나 자동 재요청을 하지 않았다. HTTP `200`에서는 Job 부재와 다섯 상태가 서로 다른 View 상태로 연결됐다. 깨진 JSON·잘못된 응답·미지원 검토 상태는 제안을 표시하기 전에 거부했다.

DOM Test Double은 `innerHTML` 대입 시 실패하도록 구성했다. Page Test는 실제 HTML의 ID·Module 경로를 대조하고, 가짜 document·window에서 Submit의 페이지 이동 방지·GET·검토 대기 Text 연결을 실행했다. 이것은 실제 Browser의 DOM·Paint·Cookie 검증이 아니다.

첫 정적 HTML Test에서 MockMvc의 기본 문자셋 읽기로 한글 비교가 실패했다. HTML·Java Source가 정상 UTF-8이고 BOM이 없음을 확인했으며, 응답 Body를 UTF-8로 읽는 Assertion으로 수정했다. 파일의 한글이나 인코딩을 바꿔 맞춘 것은 아니다.

```powershell
node --test src/test/js/ai-suggestion-ui.test.mjs src/test/js/ai-suggestion-page.test.mjs
node --test src/test/js/*.test.mjs
npx --yes --package eslint@10.11.0 eslint src/main/resources/static/*.mjs src/test/js/*.mjs scripts/week7-*.mjs
.\mvnw.cmd clean test
```

## 다음 수직 검증

실제 Browser에서 문의 접수 `201`, 자동 Worker, 같은 PostgreSQL의 Job·제안, AGENT의 조회·안전한 Text 표시를 함께 확인한다. 기존 실제 Java AI 저장 한 건과 이번 UI 합성 Test를 그 수직 실행의 완료로 합치지 않는다. 요약·Injection 수동 평가와 WIL 공개 Gate도 유지한다.
