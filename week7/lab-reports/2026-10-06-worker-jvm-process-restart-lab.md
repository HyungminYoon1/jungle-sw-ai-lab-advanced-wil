# 같은 PostgreSQL을 유지한 Worker JVM 재시작

> 실행일: 2026-10-06
> 상태: 실제 JVM Process 종료·재시작 5개 사례 검증 완료
> 전체 회귀: Java 389개·JavaScript 104개 통과, ESLint 오류 0
> Provider: 통제된 합성 응답, 이번 유료 AI 호출 0회

## 목적과 범위

앞선 Test는 같은 JVM에서 Spring Context를 바꾸는 방식이었다. 이번에는 첫 Java Process를 종료한 뒤 다른 PID의 Process로 같은 PostgreSQL을 연결했다. 원문·Job·예약·정책·시간 조건을 실제로 이어가는지 확인했다.

직접 확인한 Source는 Lab의 Application·Job 정책/실행권·접수 Service·Worker/Scheduler/설정·Migration·기존 Context Test·README와 WIL의 계약·학습자료·Note·주간 계획이다. 해당 파일은 `VERIFIED`, 두 저장소 전체는 관련 범위를 선택한 `PARTIAL` 검토다. 새로운 Test는 아래 두 파일이며 운영 Source·SQL Migration은 변경하지 않았다.

- `AiSuggestionWorkerProcessRestartIntegrationTest.java`: PostgreSQL을 유지하고 자식 Process를 시작·종료하며 Row를 비교한다.
- `AiWorkerProcessTestApplication.java`: 실제 Spring Application과 선택 Worker를 띄우는 Test 전용 진입점이다.

## 실험 구조

1. 부모 Test가 PostgreSQL 17.6 Testcontainer를 시작하고 Migration을 적용한다.
2. Process A가 접수·예약 또는 관찰한 결과 분류를 Commit하고 준비 신호를 보낸다.
3. 부모가 자신이 만든 A의 정확한 Process Handle로 강제 종료하고 종료 완료를 확인한다.
4. 필요한 사례에서만 해당 Test Row의 Lease 경계를 지난 시각으로 옮긴다.
5. 다른 PID의 Process B가 같은 DB를 연결하고 실제 Worker를 실행한다.
6. 부모가 같은 Ticket·Message·Job의 원문·상태·정책·예약·기한·제안 수를 확인한다.

Process B의 Application 기본 정책은 생성 상한 5회·새 Version으로 설정했다. 기존 Job은 A에서 저장한 `job-policy-v1`·3회 상한을 계속 사용했다. 새 Application 설정이 기존 Job Snapshot을 덮어쓰지 않는지를 함께 확인한 것이다.

`destroyForcibly()` 호출만으로 즉시 종료됐다고 간주하지 않고 `waitFor()`와 `isAlive()`로 확인했다. 출력 Pipe를 계속 읽어 Process의 출력 버퍼가 차서 멈추는 문제도 피했다. 긴 Classpath는 Credential이 없는 Java `@argfile`로 전달했다. [JDK Process API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Process.html), [Java argument file](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html#java-command-line-argument-files)

## 다섯 사례의 결과

| 종료 직전 DB 상태 | Process A의 통제된 Provider 호출 | Process B의 통제된 Provider 호출 | 재시작 후 Row |
|---|---:|---:|---|
| 접수 Commit, 미실행 PENDING | 0 | 1 | SUCCEEDED·예약 1건·제안 1건 |
| 예약 Commit, 호출 전 UNCONFIRMED | 0 | 1 | 조건부 RECOVERY, Attempt 2·예약 2건·제안 1건 |
| 관찰한 OUTCOME_UNKNOWN | 1 | 1 | 조건부 RECOVERY, Attempt 2·예약 2건·제안 1건 |
| 유효한 Retry-After 없는 Rate Limit | 1 | 0 | RUNNING·Attempt 1·예약 1건·제안 0건·AUTO_RETRY_BLOCKED 유지 |
| 유효한 Retry-After로 미래 재시도 대기 | 1 | 대기 중 0, 경계 뒤 1 | 미래 시각 유지, 이후 SUCCEEDED·예약 2건·제안 1건 |

금지·미래 대기 사례에서는 B의 Worker Tick을 직접 한 번 실행해 `NO_JOB`을 확인했다. 잠시 기다린 뒤 호출 횟수가 0이라는 사실만으로 판단하지 않았다. 허용 시각이 지난 뒤의 처리에는 실제 Scheduler를 사용했다.

모든 사례에서 Ticket·Message·Job은 각각 한 건이고 식별자가 유지됐다. Message 본문·작성자, Job의 입력 Message 연결과 Ticket의 `OPEN` 상태도 유지됐다. 성공 사례의 Category는 한 건이었다.

최초 Claim 전 PENDING은 재시작 뒤 첫 실행에서 전체 기한을 정한다. 이미 Claim한 사례는 `first_started_at`·`processing_deadline_at`을 그대로 유지한다. 전체 생성 예약과 원장 Row 수를 비교하고, Rate Limit 재시도가 출력 보완 횟수를 늘리지 않는 것도 확인했다.

호출 전 중단 사례는 **예약 두 건과 Provider 호출 한 번이 동시에 성립할 수 있음**을 보여준다. 이전 예약을 자동 반환하지 않고 같은 Job 안에서 새로운 실행권·예약을 확보했다. 이 호출 수는 통제된 Java Provider의 호출 수이며 외부 AI의 실행·청구 수가 아니다.

## 시간·보안·정리 경계

Lease와 Backoff 종료는 해당 Test Row의 Lease를 과거로 옮겨 확인했다. 미래 대기는 120초 뒤의 시각이 새 Process에서도 동일하고 그 전에는 호출하지 않는지 확인한 뒤, Test 소유 `next_attempt_at`만 과거로 이동했다. 120초를 실제로 기다린 결과로 기록하지 않는다.

DB 정리와 시각 이동은 Testcontainer의 JDBC URL을 확인한 뒤 이 격리 DB에서만 실행했다. 종료 대상도 Test가 생성한 Process뿐이다. 사용자 Application이나 다른 Java Process는 종료하지 않았다.

자식 Process에는 API Key·JVM 주입 옵션·전역 Spring 설정을 상속하지 않는다. 접속 정보는 Testcontainer의 값을 내부 환경으로 전달하며 인자·파일·Log에 출력하지 않는다. 자식의 표준 출력은 단계·PID·Row ID·호출 수만 전달하고 실패는 고정 코드로 표시한다. 원문·Token·Password·Provider 예외 원문을 출력하지 않는다.

PostgreSQL 설계 지침의 짧은 Transaction·Queue 선점 원칙을 검토했다. 외부 대기 중 Row Lock을 유지하는 새 방식은 추가하지 않았고 기존 예약·복구 경계를 Test로 확인했다.

## 실행과 회귀

```powershell
.\mvnw.cmd "-Dtest=AiSuggestionWorkerProcessRestartIntegrationTest" test
.\mvnw.cmd clean test
node --test 'src/test/js/*.test.mjs'
npx --yes --package eslint@10.11.0 eslint 'src/main/resources/static/*.mjs' 'src/test/js/*.mjs'
```

선택 Test 5개가 통과했고 전체 Clean Test에서 Java 389개·JavaScript 104개가 통과했다. ESLint도 통과했다. 실패·오류·건너뜀은 0이다. PID는 실행마다 달라지며 Test에서 두 값이 다르고 A의 종료가 확인됐는지 검사한다.

## 다음 흐름

이번 실험은 같은 PostgreSQL을 유지한 Java Process 복구다. Database Container·Volume 재시작, 외부 Provider 응답 도중의 중단·원격 결과 조회·Browser E2E는 별도 범위다. 실제 AI 자동 Worker 연결, AGENT의 작업·제안 조회, Browser·수동 내용 평가와 WIL을 이어간다.

관련 자료: [조건부 RUNNING 복구](./2026-10-06-attempt-results-and-running-recovery-lab.md), [비동기 처리의 생애주기](../study-docs/ai-async-processing-lifecycle.md), [10월 6일 학습 노트](../study-notes/2026-10-06-study-questions.md), [계약](../ai-suggestion-contract-draft.md).
