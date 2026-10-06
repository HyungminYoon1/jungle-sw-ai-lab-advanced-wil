# Attempt별 결과 기록과 조건부 RUNNING 복구

> 실행일: 2026-10-06
> 상태: 실제 PostgreSQL·통제된 Provider·같은 JVM의 새 Spring Context 검증 완료
> 전체 회귀: Java 384개·JavaScript 104개 통과, ESLint 오류 0
> 이번 검증의 유료 AI 호출: 0회

## 목적과 검토 범위

Lease가 만료된 RUNNING을 복구할 때 결과 불명과 재시도 미승인 거절을 구분하도록 구현했다. 예약 원장에 Attempt별 안전한 결과 코드를 남기고, 기존 결과 조회와 실제 실행권 획득을 분리했다.

Lab의 README·실행권 Repository/Service·Processor·Worker·결과 Service·입력 Repository·V3~V7·관련 Test와 WIL의 계약·비동기 자료·오늘 Note·주간 계획을 확인했다. 관련 파일은 `VERIFIED`, 두 저장소 전체는 선택한 범위의 `PARTIAL` 검토다. 전역 환경 변수 값이나 Credential은 읽거나 출력하지 않았고, Provider Adapter·UI·운영 배포의 새 동작 검증은 이번 범위에 포함하지 않았다.

## 결정한 정책

### Job의 마지막 오류 대신 Attempt의 결과를 사용한다

Job의 `last_failure_code`는 이전 시도의 오류가 남아 있을 수 있다. 새 Attempt가 생겼다면 그 Attempt의 결과 분류를 복구 판단에 사용한다. 모든 만료 RUNNING의 재호출·Job 오류 코드만의 판단·Attempt별 기록 중 세 번째 안을 승인받아 적용했다.

- `UNCONFIRMED`: 해당 Attempt의 결과 분류가 Commit되지 않았다. 실제 미전송·미실행을 의미하지 않는다.
- `OUTCOME_UNKNOWN`: 결과 불명이라는 관찰을 Commit했다.
- `AUTO_RETRY_BLOCKED`: 결과 불명 복구 경로의 자동 재호출은 미승인이다.

확인한 Provider 실패·거절과 구조 검증 실패는 먼저 금지 코드를 기록한다. 승인된 Rate Limit 대기·Field 보완은 이후 별도의 PENDING 경로를 Commit한다. 그 경로가 없다면 Lease 만료나 재시작이 금지를 해제하지 않는다. 한 Attempt에 저장한 금지는 불명 상태로 바꾸지 않으며, 이전 Attempt의 기록은 현재 실행에 반영하지 않는다.

### 과거 예약을 새 복구 권한으로 바꾸지 않는다

V7 이전 예약에는 결과 분류가 없다. 이를 모두 복구 가능한 미확인 상태로 바꾸면 과거에 확인한 미승인 거절도 재호출할 수 있다. 기존 원장에는 보수적인 `AUTO_RETRY_BLOCKED`, V7 이후 새 예약에는 `UNCONFIRMED`를 적용했다. 과거의 실제 거절을 증명하는 이행이 아니라 복구 권한을 새로 부여하지 않는 결정이다.

원문·기존 Job의 정책 Snapshot·횟수·기한·원장 식별자·제안은 유지한다. 기존의 미실행 PENDING과 승인해 저장한 대기 경로는 새 예약을 만들 수 있다. 원본 Provider 응답·Prompt·Secret·검증된 객체를 영속 보관하는 Table은 추가하지 않았다.

### 조회 뒤에도 실제 Claim에서 확인한다

Worker는 메모리에 검증 객체가 있으면 DB 저장 재시도를 우선한다. PENDING 처리가 없는 Tick에서 결과 미확인·불명 RUNNING의 복구 후보를 조회한다. DB의 Job·제안을 확인한 뒤 실제 Claim은 아래 조건을 다시 검사한다.

1. 같은 Job의 현재 Attempt이고 RUNNING인가?
2. 현재 Attempt의 코드가 `UNCONFIRMED` 또는 `OUTCOME_UNKNOWN`인가?
3. Lease와 Backoff가 끝났고 원래 전체 기한 안인가?
4. 같은 Job의 전체 생성 한도가 남았는가?
5. 기존 Suggestion이 없는가? 완료된 `ABSTAINED` 등은 상태 조건에서 제외되는가?

Claim은 `READ COMMITTED`의 짧은 Transaction이다. 먼저 Job Row를 `FOR UPDATE SKIP LOCKED`로 확보하고, 그 뒤의 SQL 문장에서 결과 코드와 위 조건을 읽는다. 결과 분류도 같은 Job Row Lock을 사용한다. Lock을 얻기 전 읽은 다른 Table의 Snapshot만으로 승인하지 않는다.

조건을 만족하면 Attempt·누적 예약을 증가시키고 원장 INSERT를 같은 Transaction으로 Commit한다. 그 뒤 Transaction 밖에서 Provider를 호출한다. 원장 INSERT가 실패하면 Attempt 증가도 Rollback하며 Provider 호출은 없다.

## SQL의 핵심 조건

실제 Claim에는 현재 Attempt의 원장이 존재하고 복구 허용 코드인지를 확인하는 조건이 있다.

```sql
AND EXISTS (
    SELECT 1 FROM ai_suggestion_attempts a
    WHERE a.job_id = j.id AND a.attempt_number = j.current_attempt
      AND a.result_code IN ('UNCONFIRMED', 'OUTCOME_UNKNOWN'))
AND NOT EXISTS (
    SELECT 1 FROM ticket_suggestions s WHERE s.job_id = j.id)
```

이 조건에 앞서 같은 Transaction에서 Job Row를 잠근다. 현재 Attempt·RUNNING·Lease+Backoff·전체 기한·생성 한도 조건도 UPDATE에 포함한다. 예약 INSERT는 그 UPDATE가 반환한 Claim에만 수행한다. 단순 SELECT 결과나 `SKIP LOCKED`만으로 외부 호출 권한을 얻는 것은 아니다.

## Test와 Row 확인

새 복구 Test 18개·Migration 1개·Context Test 추가 1개가 통과했다. 기존 Context의 결과 불명 사례도 새로운 조건부 복구 계약에 맞춰 수정했다. 최초 선택 실행의 52개가 통과했고, 후보 조회 직후 금지를 Commit하는 사례까지 보완한 최종 전체 회귀는 Java 384개·JavaScript 104개·ESLint 통과다. 실패·오류·건너뜀은 0이다.

```powershell
.\mvnw.cmd clean test
node --test 'src/test/js/*.test.mjs'
npx --yes --package eslint@10.11.0 eslint 'src/main/resources/static/*.mjs' 'src/test/js/*.mjs'
```

새 Migration Test의 첫 컴파일에서 Transaction 결과에 대한 AssertJ Overload의 타입 추론 오류가 발생했다. 반환값을 명시적인 `Optional<AiJobClaim>` 변수로 받은 뒤 선택 Test와 전체 Clean Test가 통과했다. DB 동작 실패와 Test 코드 컴파일 실패를 구분한다.

| 상황 | 확인한 경계 |
|---|---|
| 결과 불명 뒤 Lease+Backoff 만료 | 같은 Job Attempt 2·원장 2건, 원래 정책·시작·마감 유지, 새 호출 뒤 제안 1건 |
| 예약 뒤 아직 호출하지 않은 미확인 실행 | 통제된 Provider 호출 1회와 원장 2건을 구분. 이전 예약을 자동 반환하지 않음 |
| 대기 Hint 없는 Rate Limit·다른 미승인 일시 거절 | 금지 코드 Commit, 만료 뒤 새 Worker의 추가 호출·예약 0회 |
| 이전 Rate Limit 오류 코드가 남은 새 Attempt | 이전 원장은 금지, 새 원장은 미확인. 현재 원장의 코드로 복구 판단 |
| 결과 조회 실패 | `RECOVERY_STATE_UNCONFIRMED`, 추가 예약·호출 없음 |
| 후보 조회 뒤 성공·금지 Commit | 실제 Claim 재검사로 새 예약·호출 없음 |
| 경쟁 Worker 두 개 | 복구 예약은 한 건 추가, 통제된 Provider 호출 1회·제안 1건 |
| 결과 분류가 Job Row Lock을 가진 동안의 선점 | 잠긴 선점 건너뛰기, 분류 Commit 뒤에도 금지 유지 |
| 복구 원장 INSERT 실패 | Attempt·예약 증가 Rollback, 기존 Job 값·원장 1건 유지, Provider 호출 없음 |
| 이전 Attempt의 결과 기록·금지 해제 시도 | 갱신 거부, 현재 코드·실행권 유지 |
| 전체 생성 한도 소진 | 추가 Claim 없음. 여전히 현재인 유효한 응답은 저장 가능 |
| 전체 기한 종료·완료된 ABSTAIN | 새 생성 없음, 기한 초과만 마감, 이미 접수한 원문 유지 |

응답은 통제된 합성값이고 실제 DB는 PostgreSQL 17.6 Testcontainer다. `FOR UPDATE NOWAIT`를 별도 Transaction에서 실행해 Provider 처리 중 Job Lock이 해제됐는지도 확인했다. 테스트 소유 DB URL을 확인한 뒤에만 정리·실패 주입 SQL을 실행했다. Lease·대기 경계는 테스트 Row의 시각을 이동하며 긴 Sleep 대신 검사했다.

V6→V7 Test는 이전 원장의 기존 Column·원문·정책 값이 유지되고 새 코드가 보수적으로 추가되는 것을 확인한다. 새 예약 기본값·허용 코드·잘못된 값·NULL 거부를 검사한다. 앞선 V5→V6 Test는 대상 Version을 6으로 고정해 이후 Migration과 검증 범위를 섞지 않는다.

새 Spring Context에서는 결과 불명 실행의 조건부 재개와 대기 Hint 없는 거절의 금지 유지, 다른 새 Job의 처리를 확인했다. 같은 JVM의 Context 재시작 Test이며 실제 JVM Process 종료·재시작 Test는 아니다.

## 여전히 남는 불확실성

Provider 응답 관찰과 DB 기록은 원자적으로 묶을 수 없다. 결과 코드 저장에 실패하면 Tick은 고정 오류 코드로 중단하며 DB에 관찰이 Commit됐다고 주장하지 않는다. 실패 주입 Test에서 실제 Provider Port는 한 번 호출됐지만 원장에는 `UNCONFIRMED`가 남는 것을 확인했다.

Process가 응답 기록 전에 종료돼도 같은 불확실성이 남을 수 있다. 후속 Worker는 확인할 수 있는 DB 결과를 먼저 읽고, 조건을 만족한 새 생성도 중복 외부 실행 가능성을 없애는 것은 아니라는 범위에서 수행한다. 현재 Provider Port에는 원격 결과 조회가 없다. 원격 확인이나 ‘Provider 정확히 한 번 실행’을 검증했다고 기록하지 않는다.

코드·범위·후속 검토는 [계약](../ai-suggestion-contract-draft.md)에 기록했다. 실제 JVM 중단·재시작, 명시적 유료 Worker 연결, AGENT 조회·Browser·수동 내용 평가와 WIL이 다음 과제다.

관련 자료: [AI 비동기 처리의 생애주기](../study-docs/ai-async-processing-lifecycle.md), [10월 6일 핵심 질문](../study-notes/2026-10-06-study-questions.md), [메모리 객체 저장 재시도](./2026-10-06-validated-output-storage-retry-lab.md).

후속 실험에서는 [서로 다른 JVM Process의 종료·재시작](./2026-10-06-worker-jvm-process-restart-lab.md)을 확인했다. 위 384개 회귀와 Context 결과는 이 단계의 기록으로 유지하며, 추가된 Process Test와 최신 회귀는 후속 보고서에서 구분한다.
