# 가짜 Tool Calling의 검증 거부와 실행 실패

> 실행일: 2026-10-03 — 학습 회차는 10/2의 연장 구간으로 기록
> 근거: 독립 Node.js 스크립트와 가짜 함수 Test
> 범위: Provider 호출 0회, Database 작업 0회, 실제 Ticket 변경 0회

## 확인한 문제

AI가 함수 실행을 요청한 횟수와 Server가 함수를 실제 실행한 횟수를 구분한다. 허용하지 않은 이름·인자는 실행 전에 거부하고, 허용된 함수의 실행 중 실패는 별도로 기록한다.

Lab의 `scripts/week7-tool-calling-spike.mjs`와 `src/test/js/week7-tool-calling-spike.test.mjs`를 Codex가 작성하고 실행했다. Provider 응답은 직접 만든 JSON으로 대체했으며, 함수는 고정된 객체를 반환하거나 통제된 Exception을 발생시킨다. Spring Application의 AI 흐름에 연결한 것은 아니다.

## 실험 조건

- Server가 선택한 Ticket ID: `7`
- 허용 함수: `find_current_ticket`
- 허용 인자: 빈 객체 `{}`만
- 입력 크기: UTF-8 기준 최대 4096 Byte인 학습용 제한
- Case마다 새 Dispatcher 사용
- 자동 재시도 없음

4096 Byte는 이 Spike의 최소 경계 Test를 위한 값이며 Runtime 문의 본문의 길이 계약이 아니다. 입력 JSON도 함수 이름과 인자를 담은 단순화한 형태로, 실제 OpenAI 응답 Envelope와 구분한다.

## 실행 명령과 결과

Helpdesk Lab Root에서 실행했다.

```powershell
node --check scripts/week7-tool-calling-spike.mjs
node --check src/test/js/week7-tool-calling-spike.test.mjs
node scripts/week7-tool-calling-spike.mjs --run-fake-tools
node --test src/test/js/ticket-ui.test.mjs src/test/js/week7-openai-pilot.test.mjs src/test/js/week7-ai-evaluation.test.mjs src/test/js/week7-tool-calling-spike.test.mjs
```

| Case | 결과 코드 | Tool 실행 |
|---|---|---:|
| 정상 이름·빈 인자·정상 반환 | `TOOL_SUCCEEDED` | 1회 |
| 허용하지 않은 `resolve_ticket` | `TOOL_NOT_ALLOWED` | 0회 |
| 허용하지 않은 `ticketId` 인자 | `INVALID_TOOL_ARGUMENTS` | 0회 |
| 정상 이름·빈 인자·함수 내부 실패 | `TOOL_FAILED` | 1회 |

새 Spike Test 13개와 기존 UI 12개·Pilot 15개·평가 준비 14개를 함께 실행해 **54개 통과, 실패·건너뜀 0개**를 확인했다. Syntax Check 두 건도 통과했다. 기존에 설치된 ESLint 9.39.5로 Week 7 스크립트·UI·JavaScript Test를 검사했고 오류 없이 종료했다.

## Test에서 추가로 확인한 경계

- Server가 선택한 ID `7`이 가짜 함수에 전달된다.
- 금지 함수 이름과 Prototype 속성 이름은 실제 실행으로 연결되지 않는다.
- 추가 인자·잘못된 인자 Type, 깨진 JSON·잘못된 Root 구조·과도한 크기는 실행 전 거부한다.
- Root에 `ticketId`나 Role을 추가해도 Server 대상을 바꾸지 못한다.
- 검증 거부 뒤 자동으로 호출을 보완하거나 재시도하지 않는다.
- 함수 내부 실패는 실제 시도 1회로 집계하고 Exception Message·Stack을 결과에 복사하지 않는다.
- CLI는 고정된 가짜 Case만 실행하며 `--live`와 임의 인자는 거부한다.

실제 AI의 Tool 선택, Spring의 권한 검사, Job·Suggestion 저장과 PostgreSQL 실패 원자성은 이번 Test 대상이 아니다. Java·Database·Browser Test도 이번 변경에서 다시 실행하지 않았다. Tool 경계의 Code 실행은 확인했으며 자료 없는 설명은 후속 문답으로 확인한다.

- [Tool Calling — 호출 요청과 실제 실행](../study-docs/tool-calling-validation-and-execution.md)
