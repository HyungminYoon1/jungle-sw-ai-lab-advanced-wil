# 선택 Worker·Rate Limit 대기와 Spring Context 재시작

> 실행일: 2026-10-06
> 상태: 실제 PostgreSQL·자동 Scheduler·통제된 Provider 검증 완료
> 전체 회귀: Java 349개·JavaScript 104개 통과, ESLint 오류 0
> 이번 검증의 유료 AI 호출: 0회

## 목적과 검토 범위

수동으로 한 번 호출하던 Processor를 선택 Worker에 연결했다. 확인할 것은 Provider를 무조건 반복 호출하는지 여부가 아니라, DB에 저장한 대기 시각·한도·현재 Attempt·전체 기한을 지키고 최종 실패를 다시 열지 않는지다.

Lab 저장소는 Worker·Processor·Job 실행권·V3~V5·관련 Test·README 중심으로 확인했다. WIL 저장소는 재시도 계약·학습 자료·10월 6일 Note·활성 주간 계획을 대조했다. 두 저장소 모두 `PARTIAL` 범위 검토이며 전체 Module Review는 아니다.

## 연결한 경계

- `AiSuggestionJobWorker`는 한 Tick에서 단일 Processor를 실행하고, 허용된 Rate Limit의 다음 시각을 기록한다.
- 재시도 예약은 상태를 `PENDING`으로 되돌리고 `next_attempt_at`을 저장한다. 그 순간 추가 호출 예약을 만들지는 않는다.
- 실제 다음 Claim이 시각·횟수·기한을 다시 확인하고 `TEMPORARY_RETRY` 예약을 Commit한다. 출력 보완 횟수는 늘리지 않는다.
- V5는 요청 종류·실패 코드 CHECK를 확장하며 기존 원문·정책·예약·제안과 V1~V4를 바꾸지 않는다.
- 선택 활성화는 `postgres`와 `helpdesk.ai.worker.enabled=true`다. 기본은 꺼짐, 확인 간격의 기본값은 1초다. Provider·개인정보 Guard·검증기를 별도로 제공해야 한다.

자동 활성화 대신 선택 활성화를 사용해 기존 실행이 외부 유료 호출을 시작하지 않게 했다. 메모리 Timer에만 대기 시각을 보관하는 방식 대신 기존 DB Column을 사용해 재시작 뒤에도 기다려야 할 시각을 유지했다. Rate Limit을 출력 보완이나 결과 불명 복구로 기록하지 않고 별도 종류로 구분했다.

DB 상태 변경만 짧은 Transaction으로 묶고 외부 호출·대기는 그 밖에서 수행한다. PostgreSQL 가이드의 짧은 Transaction·`SKIP LOCKED` 지침을 참고하면서 기존 Claim 구조를 유지했다.

## 실제 Test 결과

| 새 Test Class | 수 | 확인한 내용 |
|---|---:|---|
| `AiRateLimitRetryIntegrationTest` | 10 | 더 긴 최소 대기, 기한·상한, 원문 보존, 이전 Attempt·경쟁 예약·Transaction 경계 |
| `AiRateLimitRetryMigrationIntegrationTest` | 1 | V4 Job의 원문·정책·예약·기한을 V5에서 보존 |
| `AiSuggestionJobWorkerIntegrationTest` | 9 | 다음 예약 뒤 호출, 크레딧 실패 제외, 미승인 실패 미재전송, 출력 보완·경쟁 Tick |
| `AiSuggestionWorkerConfigurationTest` | 5 | 기본 꺼짐·Profile·명시적 Provider 필요·실제 기본값 Binding과 간격 검증 |
| `AiSuggestionWorkerSchedulerTest` | 2 | Tick 한 번과 원문·Cause 없는 고정 오류 Log |
| `AiSuggestionWorkerContextIntegrationTest` | 4 | 새 Context의 PENDING·대기 처리, FAILED와 결과 불명 RUNNING의 임의 재실행 방지 |
| 합계 | 31 | 기존 318개에 추가, 전체 Java 349개 통과 |

기존 Processor Test 19개도 다시 통과했다. 일시적 거절은 예외 자체 대신 Claim과 안전한 최소 대기 Metadata를 반환하도록 바꿨으며, Processor 내부에서 재전송하거나 임의로 대기 예약하지 않는다.

```powershell
.\mvnw.cmd clean test
node --test 'src/test/js/*.test.mjs'
npx --yes --package eslint@10.11.0 eslint 'src/main/resources/static/*.mjs' 'src/test/js/*.mjs'
```

Java 실패·오류·건너뜀은 0이며 JavaScript 104개도 실패·건너뜀 없이 통과했다. `git diff --check`로 변경 파일의 공백 오류를 점검했다.

변경 Text는 UTF-8 without BOM·LF를 확인했고 공개 문서의 로컬 절대 경로·깨진 상대 링크는 0건이었다. 변경 Source와 Surefire Report에서 대표 API Key Pattern·자동 생성 Password 안내·BCrypt 값의 해당 Pattern은 발견되지 않았다. 이 점검과 Scheduler의 원문·Cause 미출력 Assertion을 함께 확인했다.

## 대기·최종 실패에서 관찰한 결과

Backoff 5초·Provider 최소 대기 15초를 적용한 Row에는 최소 15초 뒤의 시각이 저장됐다. 그 전의 Tick은 새 예약이나 Provider 호출을 만들지 않았다. 실행 가능한 경계 뒤에는 예약 두 번째가 Commit되고 제안 한 건·Job `SUCCEEDED`가 저장됐다.

남은 기한 10초에 최소 대기 15초인 Case에서는 대기를 줄이지 않았다. 다음 시각이 기한보다 뒤에 남았고, 기한 종료 정리가 Job을 `FAILED`로 바꿨다. 원본 Ticket·Message와 이미 Commit한 첫 예약은 유지됐다. 상한 소진·크레딧 실패 뒤에도 최종 실패를 일반 Polling으로 다시 열지 않았다.

긴 대기를 실제로 모두 소모하는 대신, 저장 시각을 먼저 Assertion한 뒤 테스트 소유 Row의 시각을 실행 가능한 경계로 이동했다. 이는 Test의 경계 조절이며 Runtime에서 대기를 우회하는 Code가 아니다.

## Context 재시작의 범위

첫 Spring Context에서 접수 Commit 뒤 `close()`하고 같은 PostgreSQL에 새 Context를 연결했다. 새 Repository 객체·자동 Scheduler가 미실행 Job을 처리했다. 미래의 재시도 시각·원래 처리 기한·누적 횟수는 재시작 뒤에도 유지됐다.

다른 Job을 처리하는 Scheduler가 실제로 실행되는 동안에도 기존 `FAILED`는 변경되지 않았다. 결과 불명 `RUNNING`의 Lease를 만료시킨 Case도 새 Context가 임의로 재예약하지 않았다.

같은 JVM 안의 Spring Context 재시작 Test다. 실제 JVM Process 종료·재시작이나 PostgreSQL Container·Volume 재시작은 이번에 실행하지 않았다. Provider는 통제된 응답이며 실제 AI 저장 한 건은 [앞선 Java Provider 실험](./2026-10-06-java-provider-adapter-lab.md)에 별도로 남아 있다.

## 이어서 검증할 범위

- 결과 불명 RUNNING의 가능한 결과 확인·한도 안의 복구·늦은 이전 Attempt 차단.
- 검증된 객체의 자동 저장 재시도와 Process 중단 후 복구의 구분.
- 실제 JVM 재시작, 유료 Provider를 명시적으로 연결한 Worker와 안전한 Runtime 입력 처리.
- AGENT 상태·제안 조회, Session·CSRF·Browser 수직 흐름과 수동 내용 평가.

관련 기준: [계약 초안](../ai-suggestion-contract-draft.md), [10월 6일 학습 노트](../study-notes/2026-10-06-study-questions.md), [AI 비동기 처리의 생애주기](../study-docs/ai-async-processing-lifecycle.md).
