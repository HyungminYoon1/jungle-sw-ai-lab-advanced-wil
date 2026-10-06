# 검증된 AI 응답의 제한된 DB 저장 재시도

> 실행일: 2026-10-06
> 상태: 실제 PostgreSQL·통제된 Provider와 Clock 검증 완료
> 전체 회귀: Java 364개·JavaScript 104개 통과, ESLint 오류 0
> 이번 검증의 유료 AI 호출: 0회

## 목적과 검토 범위

AI 응답은 검증을 통과했지만 DB 저장이 실패한 경우, 같은 객체를 재사용하는 저장 재시도를 Worker에 연결했다. AI를 다시 호출하는 경로와 분리하고 저장 횟수·간격·현재 실행권·기한을 확인했다.

Lab 저장소는 README·Worker·Processor·결과 Service·실행권 Repository·V3~V6와 관련 Test를 확인했다. WIL 저장소는 계약·비동기 학습 자료·10월 6일 Note·주간 계획을 대조했다. 관련 파일은 `VERIFIED`, 두 저장소 전체는 선택한 범위의 `PARTIAL` 검토다. Provider Adapter·UI·운영 배포의 새 검증은 이번 범위에 포함하지 않았다.

## 승인한 정책과 구현

- 최초 결과 저장을 포함한 총 3회, 추가 저장 간 최소 5초. Worker 설정으로 상한·간격을 분리했다.
- 한 Worker가 검증 객체 한 개만 보관한다. 새 Tick은 대기 시각과 원래 처리 기한을 확인하며 대기 중 Transaction·Row Lock·Sleep을 유지하지 않는다.
- 저장 전 Job·제안을 재조회한다. 이미 Commit된 정상 결과는 사용하고, 조회 실패는 `STORAGE_STATE_UNCONFIRMED`로 구분한다.
- 현재 Attempt가 바뀌거나 Job이 종료되면 이전 객체를 저장하지 않는다. 실제 결과 Transaction 안에서도 현재 Attempt·RUNNING·기한을 다시 확인한다.
- 상한 소진 뒤에도 Commit 결과를 먼저 확인한다. 결과가 없는 현재 실행만 `RESULT_STORAGE_RETRY_EXHAUSTED`로 마감하며, 기존 성공이나 새 Attempt를 덮어쓰지 않는다.
- 전체 기한이 먼저 끝나면 추가 저장을 중단한다. 종료 기록까지 확인되지 않았다면 실제 DB 상태를 확정하지 않는다.
- 생성 예약·출력 보완·Attempt·원래 기한은 저장 재시도로 변경하지 않는다. 접수 원문은 유지한다.

즉시 AI 재생성·무제한 재저장·제한된 객체 재사용 중 세 번째 안을 채택했다. 이미 받은 결과를 이용하면서 외부 호출을 늘리지 않고, 저장 장애에도 종료 기준을 둔다. 현재 Process의 한 객체에 대한 저장 주기이므로 저장 횟수와 응답을 새 DB Column에 영속 보관하지 않았다. Process 종료 후 복구는 별도 단계다. 결정·설정 범위와 후속 검토는 [계약](../ai-suggestion-contract-draft.md)에 함께 기록했다.

## 실제 Test 결과

| 추가한 Test | 수 | 확인한 내용 |
|---|---:|---|
| `AiSuggestionStorageRetryIntegrationTest` | 12 | 같은 객체 재사용, 5초 경계, 총 3회 종료, 기존 Commit 확인, 조회 실패, 이전 Attempt, 기한, ABSTAIN, 생성 상한, 종료 경쟁·불명 결과와 Transaction 경계 |
| `AiStorageRetryMigrationIntegrationTest` | 1 | V5 원문·정책·예약·성공 제안을 V6에서 보존하고 새 실패 코드 허용 |
| `AiSuggestionWorkerConfigurationTest` 추가분 | 2 | 실제 Binder의 기본 3회·5초와 설정 변경, 잘못된 횟수·간격 거부 |
| 추가 합계 | 15 | 기존 349개에 추가, 전체 Java 364개 통과 |

기존 Worker Test 9개·Processor Test 19개·결과 저장 Test 18개도 전체 회귀에서 통과했다. Java 실패·오류·건너뜀은 0이며 JavaScript 104개도 모두 통과했다.

```powershell
.\mvnw.cmd clean test
node --test 'src/test/js/*.test.mjs'
npx --yes --package eslint@10.11.0 eslint 'src/main/resources/static/*.mjs' 'src/test/js/*.mjs'
```

### Rollback 뒤 같은 객체 재사용

테스트 소유 PostgreSQL에 Category 저장을 거부하는 임시 CHECK를 추가했다. 첫 결과 Transaction 실패 뒤 `ticket_suggestions`와 `ticket_suggestion_categories`의 `COUNT(*)`는 모두 0이었다. 제약을 제거한 뒤 4,999ms 시점에는 추가 저장이 없었고, 5,000ms 경계에는 같은 검증 객체를 다시 전달해 제안·Category 각 1건과 `SUCCEEDED`를 확인했다.

Provider Test Double 호출은 1회, `ai_suggestion_attempts` Row와 생성 예약도 1이었다. `isSameAs`로 검증 객체의 정체성이 같은지 확인했고, Message 원문과 Ticket의 OPEN 상태도 유지됐다. 5초는 실제로 Sleep하지 않고 통제된 Clock을 이동해 검사했다.

같은 저장 장애를 유지한 경우 결과 저장은 총 3회만 시도했다. 다음 Tick은 새 저장 대신 재조회·조건부 종료를 수행했다. 실패 코드는 `RESULT_STORAGE_RETRY_EXHAUSTED`, 제안은 0건, 원문과 첫 생성 예약은 그대로였다.

### Commit 여부 불명확과 경쟁

실제 저장 Service가 Transaction을 Commit한 뒤 Test용 Decorator에서 응답 유실·조회 실패를 주입했다. Worker에는 `STORAGE_PENDING`이 반환됐지만 DB에는 제안 1건과 SUCCEEDED가 있었다. 조회를 복구한 뒤 기존 결과를 확인했으며 추가 저장·AI 생성은 없었다. 실제 네트워크를 끊은 실험과는 구분한다.

RUNNING 상태의 조회만 실패시킨 경우에는 재저장하지 않았고 저장 시도 횟수도 늘지 않았다. 조회가 복구된 뒤 같은 객체를 저장했다. 일반 조회 직후 다른 실행이 성공한 사례에서는 조건부 종료가 SUCCEEDED를 덮어쓰지 않았다. 종료 Commit 뒤 응답만 잃은 사례도 다음 조회에서 최종 FAILED를 확인했다.

현재 Attempt 2를 새로 확보한 뒤 이전 Attempt 1의 객체를 가진 Worker를 실행한 경우에는 `NOT_CURRENT`였고 새 실행은 RUNNING으로 유지됐다. 생성 한도가 1회로 소진된 경우에도 현재 객체의 DB 재저장은 성공했다.

### 기한과 보관 경계

원래 처리 기한을 끝낸 경우에는 추가 저장 없이 기한 초과로 마감했다. DB 조회가 계속 실패한 채 메모리의 보관 기한이 끝났다면 객체를 해제하고 `STORAGE_STATE_UNCONFIRMED`를 반환했다. 이 시점에 DB의 마지막 상태가 RUNNING일 수 있음을 확인했다. DB 접근을 복구한 뒤 기존 만료 정리가 Job을 종료했고 다음 새 Job을 처리했다.

대기 객체가 있더라도 Worker Tick 전체를 Transaction 안에서 호출하면 조회·저장 전에 거부됐다. 실제 결과 Service의 짧은 Transaction만 사용하는 구조를 유지했다.

## Migration·설정과 문서 점검

V6는 `RESULT_STORAGE_RETRY_EXHAUSTED`를 기존 실패 코드 CHECK에 추가한다. 적용된 V1~V5와 정책 Snapshot·원문·예약·기존 제안을 수정하지 않는다. 새 Column이나 응답 원문 보관은 추가하지 않았다.

설정 생성자를 추가한 첫 검증에서는 Binder가 생성자를 선택하지 못해 설정 Test 2개가 오류였다. Canonical Constructor에 `@ConstructorBinding`을 명시한 뒤 기본값·사용자 설정 Binding과 전체 회귀가 통과했다.

변경 파일의 `git diff --check`, UTF-8 without BOM·LF, 공개 문서 상대 링크·로컬 절대 경로와 대표 Secret Pattern을 점검했다. 대기 객체·결과 객체의 문자열 표현에는 응답 내용이 포함되지 않으며, 새로운 오류 분기도 원문·Cause를 출력하지 않는다.

## 다음 검증

현재 Process가 살아 있을 때의 저장 주기를 연결했다. Process가 종료되면 객체·저장 횟수는 사라진다. DB에 RUNNING과 예약만 남았다고 Provider가 미실행됐거나 검증 객체를 복원할 수 있다고 판단하지 않는다.

이어서 가능한 결과 확인 후 결과 불명 Job의 제한된 복구·실제 JVM 재시작, 명시적 유료 Worker 연결, AGENT 조회·Browser와 수동 내용 평가를 진행한다.

관련 기록: [10월 6일 핵심 질문](../study-notes/2026-10-06-study-questions.md), [비동기 처리 개념](../study-docs/ai-async-processing-lifecycle.md), [앞선 Worker·Context 재시작 검증](./2026-10-06-worker-rate-limit-and-context-restart-lab.md).
