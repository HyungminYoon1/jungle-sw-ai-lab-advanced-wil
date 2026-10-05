# Java Provider Adapter와 단일 HTTP 전송 검증

> 실행일: 2026-10-06
> 환경: Java 25.0.4·Spring Boot 4.1.1·Spring AI 2.0.1·OpenAI Java SDK 4.49.0·PostgreSQL 17.6 Testcontainers
> 결과: Adapter HTTP Test 44개, 처리 PostgreSQL Test 19개, 전체 Java Clean Test 318개·JavaScript 104개 통과. ESLint 통과
> 실제 유료 Java AI 호출: LIVE_CONFIRMED — 합성 문의 한 건의 실제 AI 응답·PostgreSQL 제안 저장 확인, 별도 Live Test 1개 통과

## 추가한 연결

`AiSuggestionProvider` Port 뒤에 `SpringAiOpenAiSuggestionProvider`를 추가했다. Controller와 접수 Service는 외부 AI를 직접 호출하지 않는다. 기존 단일 Processor의 예약 Commit·입력 조회·전송용 복사본·외부 호출·검증·별도 결과 저장 경계를 유지한다.

Spring AI는 Starter가 아닌 Library로 추가하고 Client를 명시적으로 만든다. 전역 키를 자동 선택하지 않으며 일반 Application 실행이나 회귀 Test가 유료 요청을 시작하지 않는다. Model은 `gpt-6-luna`, Structured Output·`reasoning_effort=none`·`store=false`·600 출력 Token을 사용한다. 요약 상한 200은 실험 인자로 유지했다.

이번 Adapter는 Chat Completions를 사용한다. 기존 Node 비교의 Responses API와 Model·업무 판단 기준을 맞추되 실제 호출 근거를 합치지 않는다. [Spring AI ChatModel 문서](https://docs.spring.io/spring-ai/reference/api/chat/openai-chat.html)

## 직접 확인한 HTTP 경계

| 경계 | 관찰한 결과 |
|---|---|
| 정상 요청 | 실제 직렬화 Body의 Model·Schema·출력 상한·User 입력 두 Field 확인, HTTP 1회 |
| 알려진 민감 값·API Credential 잔존 | 전송 전 거부, Server 수신 0회 |
| 요청 Byte 상한 초과 | 잘라내지 않고 거부, Server 수신 0회 |
| `429`·`500`·`408`·설정 오류 | 안전한 실패 종류로 전달, HTTP 1회 |
| Timeout | Server가 요청을 받은 뒤 Client 대기 종료, 재전송 없이 결과 불명 |
| Redirect | 목적지로 따라가지 않고 실패, HTTP 1회 |
| 유효한 `Retry-After` | 초·HTTP-date 최소 대기 전달, 긴 Hint도 줄이지 않음 |
| 거부·미완료·빈 Choices·잘못된 Envelope | 제안 문자열로 채택하지 않음, Prompt·응답 원문 미출력 |
| 사용량·반환 요금 조건 누락 | 0 비용으로 추정하지 않음 |

HTTP Server의 응답은 Test가 작성한 합성 JSON이다. 실제 HTTP·Spring AI·SDK는 실행했지만 실제 AI 모델이 해당 요약을 생성한 것은 아니다. SDK 자동 재시도뿐 아니라 HTTP Client의 연결 재시도와 Redirect도 껐다. 요청 32 KiB·응답 64 KiB 상한을 적용한다.

Spring AI가 빈 `choices`에서 Prompt를 Log에 남기는 경로를 확인했다. 그래서 응답 Envelope를 먼저 검사하고 SDK 오류의 원문·Cause를 새 예외에 복사하지 않는다. 거부 메시지도 고정 종류로만 전달한다.

요청별 Timeout만 가진 새 옵션을 만들었을 때 기본 Model이 `gpt-5-mini`로 덮어쓰인 문제는 최종 Body Assertion에서 발견됐다. 고정 옵션의 `mutate()`로 전체 설정을 복사한 뒤 Timeout만 변경해 `gpt-6-luna` 전송을 확인했다. 실제 유료 호출 전에 발견한 설정 오류다.

## PostgreSQL에서 추가로 확인한 것

Processor Test 두 개를 추가해 총 19개가 됐다. 미완료 Provider 응답은 `OUTPUT_INVALID` 실패이며 제안은 0건이다. 일시 거절의 최소 대기를 호출자에게 전달한 경우에는 기존 `RUNNING`과 예약 한 건을 보존하고 즉시 다시 호출하지 않는다. 두 경우 모두 접수 원문은 유지됐다.

일시 거절 정보를 전달한 것이 자동 재시도 Worker를 구현했다는 뜻은 아니다. 대기 기록·기한·남은 한도·현재 실행권을 확인한 새 예약은 후속 구현이다.

```powershell
.\mvnw.cmd "-Dtest=SpringAiOpenAiSuggestionProviderTest,AiSuggestionJobProcessorIntegrationTest" test
.\mvnw.cmd clean test
node --test src/test/js/*.test.mjs
npx --yes eslint@10.11.0 scripts/week7-*.mjs src/main/resources/static/*.mjs src/test/js/*.mjs
```

전체 Java 회귀는 실패·오류·건너뜀 0으로 통과했다. JavaScript의 실행기 Test 25개는 가짜 Java 결과로 기동·예산·판정·민감 진단 제외와 이전 비용 미확인 선택 실행의 경계를 확인했다. 실제 AI와 PostgreSQL 연결의 성공 근거는 아니다.

## 선택 Live 실험의 준비와 실행 결과

`week7-java-provider-live.mjs`는 기존 날짜별 비용 원장을 사용한다. Java 실행 전 보수적 $0.009004를 한 번 예약하고, 실제 사용량과 반환 요금 조건을 확인해 정산한다. 결과나 비용이 불명확하면 보류하고 추가 호출을 막는다. 이전 누적 비용을 임의로 0으로 만들지 않는다.

실험은 새 PostgreSQL Testcontainer에 합성 문의를 접수하고 실제 AI 호출 뒤 제안 Row·Job 완료·원문 보존을 확인하도록 준비했다. 일반 `mvn test`에서 Live Class는 제외된다. Helpdesk 전용 키·당일 확인·예산 예약이 필요하며 전역 키를 자동으로 사용하지 않는다. Dry run은 호출 0회로 통과했다.

### 이전 비용 미확인 시 한 건 실행 결정

- 맥락: 이미 별도 API 호출이 있었지만 이전 비용은 전달되지 않았다. 추가 비용 확인 없이 진행하라는 요청을 반영한다.
- 비교한 방식: 비용 확인까지 중단, 이전 비용을 0으로 간주, 미확인을 보존하며 명시적인 한 건만 진행.
- 결정과 이유: `--proceed-with-unknown-prior`에서만 새 원장의 이전 비용·하루 전체 합계를 `null`로 표시하고 이번 실행기의 사용량을 기록한다. 학습은 이어가되 확인하지 않은 비용을 확인한 것처럼 만들지 않는다. 이 경우 하루 전체가 $1 이내라는 판정은 하지 않는다.
- 경계: 예약 한 번만 허용한다. 기존 원장의 비용·보류·미정산 예약을 초기화하지 않고, 알려진 비용 옵션과 혼용하지 않는다. 실행 결과나 사용량이 불명확하면 기존 보류 절차를 유지한다. 기본 실행기와 다른 실험에는 이 예외가 자동 적용되지 않는다.
- 영향 파일: Lab의 일일 원장·Java Live 실행기·Live Experiment·실행기 Test·README, WIL의 이 보고서·주간 계획·10/6 Note.
- 후속 확인: 실제 호출 Metadata와 PostgreSQL 결과는 아래 Live 결과에 기록했다. 이 변경 당시 추가 Test 7개와 재실행한 전체 Java 318개·JavaScript 95개·ESLint는 무료 검증이었다.

### Windows 실행기 기동 오류와 수동 복구

사용자가 Live 명령의 `BUDGET_RECONCILIATION_REQUIRED`를 전달했다. 원장은 첫 예약 한 건과 $0.009004를 `UNKNOWN_COST`로 보류하고 있었고 진행 중 예약·Lock은 없었다. Live Test Report와 안전한 실행 결과는 생성되지 않았다.

API Key를 전달하지 않는 무료 점검에서 기존 자식 환경으로 `mvnw.cmd --version`을 실행했다. 종료 코드는 `0`이지만 Maven 출력은 없었다. 같은 환경에 `PATHEXT`만 추가하자 Maven 3.9.16·Java 25.0.4 출력이 확인됐다. 실행기의 Windows 환경 전달 오류를 재현한 것이며 과거 외부 실행·청구 여부를 0으로 확정한 근거로 사용하지 않는다.

- 수정: 필요한 `PATHEXT`·`COMSPEC`을 전달하고, 예약 전에 API Key 없는 `--preflight`를 실행한다. 종료 코드와 기대 Version 출력을 함께 확인한다. 민감 정보·Maven 원문 진단은 출력하지 않는다.
- 비교한 복구 방식: 원장 삭제·예약 초기화, 계속 차단, 기존 불명 예약을 보존한 한 번의 수동 기동 복구.
- 결정: `--recover-launcher-once`를 사용자가 명시한 경우에만 수정된 기동 점검 뒤 복구한다. 첫 보류 예약·금액·사유는 `heldEstimatedUsd`와 `launcherRecovery`로 유지하고 새 예약을 추가한다. 하루 전체 비용은 여전히 미확인이며 Runtime Job 재시도 정책을 바꾸지 않는다.
- 제한: 진행 중 예약, 비용 초과, 새로운 원장과 반복 복구는 거부한다. 추가 실행도 불명확하면 두 예약을 모두 보류하며 자동 재실행하지 않는다.
- 검증: 추가 JavaScript Test 9개, 전체 Java Clean Test 318개·JavaScript 104개와 ESLint 통과. API Key 없는 실제 Maven Preflight 통과. 같은 자식 환경에서 Live Class를 호출하되 활성화 조건은 주지 않아 한 건이 의도적으로 건너뛰어지는 것도 확인했다. 이 별도 기동 점검의 유료 호출은 0회였다.
- 영향 파일: Lab의 Java 실행기·일일 원장·Live 실험의 허용 예약 검증·실행기 Test·README, WIL의 이 보고서·주간 계획·10/6 Note.

### 실제 AI 응답과 PostgreSQL 저장

수정된 실행기를 Helpdesk 전용 PowerShell에서 실행했다. 새 PostgreSQL Testcontainer에 합성 문의 `SYNTHETIC_LOGIN_RECOVERY`를 접수한 뒤, `processNextPending()`을 한 번 호출해 실제 Spring AI 요청과 결과 저장을 연결했다. 사용자 출력과 Git 제외된 로컬 결과 파일을 대조했고, 별도 Live JUnit Report도 실패·오류·건너뜀 없이 한 건 통과했다.

| 확인 항목 | 결과 |
|---|---|
| 실제 Java Provider HTTP 전송 | 1회, `200` 응답 |
| 처리 결과 | `STORED`, Job `SUCCEEDED` |
| PostgreSQL 접수 원문 | 변경 없이 보존 |
| 같은 Job의 저장 결과 | Suggestion 1건·Category 1건 |
| Job 생성 예약 | `reservedGenerationCount = 1` |
| 반환 사용량 | 입력 1,169 Token·출력 54 Token |
| 해당 호출 비용 추정치 | `$0.000173125` |

실행기 원장의 `reservationsMade = 2`는 이전 기동의 불명 예약과 이번 기동 예약을 합한 값이다. 이번 Job의 생성 예약이나 확인된 HTTP 전송이 두 번이었다는 뜻은 아니다. 이전 보류 금액 `$0.009004`는 유지했고, 이전 비용과 하루 전체 합계는 미확인으로 남겼다.

이번에는 Service에서 접수하고 Processor를 직접 한 번 실행했다. 자동 Worker·HTTP 제안 조회·Browser E2E·Application 중단 복구는 다음 검증이다. 응답 요약의 수동 내용 평가는 `NOT_SCORED`로 남겼다.
