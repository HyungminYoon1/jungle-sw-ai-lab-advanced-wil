# Job 정책·실행권·예약 검증

> 상태: PostgreSQL 실행권·예약 기반 구현 및 Test 완료 — 자동 Worker·Provider·Suggestion 연결은 다음 단계
> 환경: Java 25, Spring Boot 4.1.1, PostgreSQL 17.6 Testcontainer

## 확인한 경계

문의 접수는 Ticket·최초 Message·`PENDING` Job을 함께 Commit한다. 그다음 실행권 확보는 별도 Transaction에서 Job을 `RUNNING`으로 바꾸고 누적 예약 횟수와 예약 원장을 함께 저장한다. 이번 실험은 두 번째 경계를 검증했다. 실행권 확보 뒤에 외부 AI를 실제로 호출한 실험은 아니다.

Job 등록 당시의 설정은 DB 정책 Snapshot으로 보존한다. 기본값은 전체 생성 3회·추가 출력 보완 1회, 요청 대기 60초·Attempt 실행권 120초·Backoff 5초·전체 처리 300초다. 전체 기한은 최초 실행권 확보 시점부터 계산하고 재예약 때 바꾸지 않는다. Queue 대기는 제외한다.

V1·V2를 수정하지 않고 V3를 추가했다. 기존 V2 Job은 승인한 초기 정책을 부여하고 `V2_MIGRATION`으로 표시한다. 새 접수는 설정값을 명시적으로 저장하고 `APPLICATION`으로 표시한다. 기존 문의 ID·본문·상태는 유지한다. Job과 예약 원장에 본문·전체 Prompt·Credential을 복사하지 않는다.

## 구현

- `AiJobPolicy`: Profile 전용 설정과 값 검증.
- `JdbcAiSuggestionJobRepository`: 접수 시 Job 정책 Snapshot 저장.
- `AiSuggestionJobClaimService`: `REQUIRES_NEW`로 실행권·예약의 독립 Commit 보장.
- `JdbcAiSuggestionJobExecutionRepository`: 조건부 실행권 변경·누적 한도·기한·이전 Attempt 차단.
- `ai_suggestion_attempts`: Job·Attempt·요청 종류·예약 시각의 원장. Provider 실행 성공 이력이 아니다.

일반 조회는 실행 가능한 `PENDING`을 `FOR UPDATE SKIP LOCKED`로 선택한다. Lock은 실행권 Transaction이 끝나면 해제한다. AI를 기다리는 동안 유지하지 않는다. Lease가 지난 `RUNNING`은 일반 조회가 자동 재예약하지 않으며, 결과 확인 뒤 호출할 복구 메서드를 분리했다. 그 메서드 자체가 Provider 결과를 조회하는 것은 아니다.

실패 기록과 보완 예약은 `RUNNING`과 현재 Attempt가 모두 맞을 때만 반영한다. Suggestion 성공 저장의 동일한 보호 경계는 아직 연결하지 않았다.

## 실행한 Test

| Test | 수 | 확인한 내용 |
|---|---:|---|
| `AiJobPolicyTest` | 10 | 기본값·설정 변경·Profile 선택·잘못된 값 거부 |
| `AiJobPolicyMigrationIntegrationTest` | 1 | V2 Job과 원문 보존, V3 정책 이행, 아직 시작하지 않은 Job의 기한·횟수 |
| `AiSuggestionJobExecutionIntegrationTest` | 18 | 실제 PostgreSQL의 실행권·예약·경쟁·Rollback·한도·기한 |

실행권 Test에서는 다음을 확인했다.

1. 첫 Claim 뒤 `RUNNING`·Attempt 1·예약 1건이 Commit되고 호출자에게 반환된다. 바깥 Transaction이 Rollback되어도 실행권의 독립 Commit은 유지된다.
2. 두 Worker가 한 Job을 동시에 찾으면 Claim은 한 건이다. 다른 Transaction이 잠근 Job은 건너뛰고 다른 후보를 가져온다.
3. 실행권이 유효하거나 Backoff가 남으면 복구 예약을 거부한다. 복구 경쟁에서도 같은 Attempt를 한 번만 교체한다.
4. 재예약 후 최초 시작·마감 시각과 누적 횟수는 유지된다. 이전 Attempt의 실패 기록·보완 예약은 DB를 변경하지 못한다.
5. 상한 5회에서는 다섯 번째 예약까지 허용하고 여섯 번째는 거부한다. 이미 현재인 마지막 Attempt의 실패 결과 반영은 별도 조건으로 허용한다.
6. 예약 원장 INSERT를 고의로 실패시키면 Job은 `PENDING`·Attempt 0·예약 0으로 Rollback된다. 이미 접수한 Ticket·Message 각 1건은 남는다.
7. 전체 처리 기한이 지나면 `JOB_PROCESSING_DEADLINE_EXCEEDED`로 끝내고 새 예약을 하지 않는다. Queue에서 오래 기다렸던 Job도 최초 Claim부터 기한을 계산한다.
8. 출력 보완은 대기 조건과 전체·보완 한도를 함께 사용한다. 보완 한도 0이면 최초 예약은 허용하지만 추가 보완은 거부한다.
9. 새 설정으로 등록한 Job은 새 정책을 사용한다. 새 Repository 객체로 복원한 기존 Job은 원래 정책·횟수·기한을 유지한다. 이 Case는 Spring Context나 JVM 재시작 Test가 아니다.

각 실행권 Test는 연결 대상이 해당 Testcontainer의 DB인지 확인한 뒤에만 Test Row를 정리한다. 예약 원장·Job·Message·Ticket 순서로 삭제하며 기존 로컬 DB나 Volume을 비우지 않았다. 시간 조건은 격리된 Test DB의 시각 Column을 조정해 재현했으며 실제로 60초·120초를 기다려 Provider 동작을 측정한 것은 아니다.

## 전체 회귀

```powershell
.\mvnw.cmd clean test
node --test src/test/js/*.test.mjs
npx --yes --package eslint@10.11.0 eslint scripts/week7-*.mjs src/main/resources/static/*.mjs src/test/js/*.mjs
```

Java 236개·JavaScript 79개가 통과했다. 실패·오류·Skip은 0이며 ESLint도 통과했다. 이번 실행에서 유료 API 호출은 0회였다.

## 다음 연결

자동 Worker의 Polling, 가능한 기존 Provider 결과 조회, 요청 대기 제한과 숨은 SDK 재시도 차단, 출력 검증과 Suggestion 결과 저장을 이어서 연결한다. 유효한 제안 저장과 Job `SUCCEEDED`, 유효한 `ABSTAIN` 기록은 결과 Transaction에서 함께 처리한다. 실제 AI 연결과 Browser의 새 접수 흐름은 별도 실행 근거로 남긴다.

정책의 이유와 합의는 [AI Suggestion 계약 초안](../ai-suggestion-contract-draft.md), 개념은 [AI 비동기 처리의 생애주기](../study-docs/ai-async-processing-lifecycle.md)를 참고한다.
