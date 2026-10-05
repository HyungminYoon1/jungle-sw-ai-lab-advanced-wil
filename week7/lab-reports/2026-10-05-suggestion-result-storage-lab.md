# PostgreSQL 제안과 분류 목록의 결과 저장 검증

> 실행일: 2026-10-05
> 환경: Java 25.0.4·Spring Boot 4.1.1·Docker 29.8.0·PostgreSQL 17.6 Testcontainers
> 결과: 새 Integration Test 19개, 전체 Java Clean Test 255개·JavaScript 79개 통과. 실패·오류·건너뜀 0, ESLint 통과

검증된 AI 출력 객체를 별도 제안으로 저장하고, 같은 결과 Transaction에서 모든 Category와 Job 완료 상태를 Commit했다. 분류 Row나 완료 UPDATE가 실패하면 결과 변경은 전부 Rollback되며 이미 접수한 Ticket·Message와 호출 예약은 유지됐다.

## 적용한 저장 구조

V1~V3는 바꾸지 않고 `V4__add_suggestions_and_result_completion.sql`을 추가했다. `ticket_suggestions`는 Job을 참조하며 `UNIQUE (job_id)`로 같은 Job의 제안을 한 건으로 제한한다. `ticket_suggestion_categories`는 Suggestion을 참조하고 `(suggestion_id, category)`를 복합 Primary Key로 사용한다. 복수 Category를 첫 항목으로 축소하지 않는다.

요약·우선순위는 `NOT NULL`이며 공백 요약과 허용 목록 밖 값을 DB에서도 거부한다. 요약 공백 CHECK에는 Java 검증기의 ECMAScript trim 공백 집합을 사용했다. 길이 상한은 검증기 인자이며 Test의 200자를 Runtime 기본값이나 DB 길이 제한으로 새로 확정하지 않았다. 담당자 검토는 `PENDING_REVIEW`이고 Ticket 상태를 자동으로 변경하지 않는다.

## 결과 저장 Transaction

`AiSuggestionResultService.complete()`는 `REQUIRES_NEW` 경계에서 현재 `RUNNING`·Attempt·전체 처리 기한을 `SELECT ... FOR UPDATE`로 확인한다. `SUGGEST`이면 부모 제안과 분류 목록을 INSERT한 뒤 Job을 `SUCCEEDED`로 변경한다. `ABSTAIN`이면 제안을 만들지 않고 `ABSTAINED`를 기록한다. 완료 UPDATE가 실패하거나 0건이면 결과 변경을 모두 되돌린다.

동시에 같은 Attempt를 완료하려는 두 호출 중 하나만 저장했다. 이전 Attempt, 이미 완료한 Job과 출력 보완 대기 상태는 `NOT_CURRENT`로 반환하며 Row를 바꾸지 않았다. 생성 횟수를 모두 예약했거나 Lease만 만료됐어도, 아직 현재 Attempt이고 전체 처리 기한 안이면 유효한 응답을 저장했다.

저장 중 DB 예외는 실패 Row·요약·Driver 메시지·Cause를 복사하지 않는 `AI_RESULT_STORAGE_FAILED`로 전달한다. Service가 자동으로 Job을 `FAILED`로 바꾸거나 AI를 다시 호출하지는 않는다.

## 실제 PostgreSQL에서 확인한 것

| Test 묶음 | 개수 | 확인한 근거 |
|---|---:|---|
| 정상 제안·복수 Category 저장 | 1 | 제안 1건·분류 2건·Job `SUCCEEDED`, 원문과 `OPEN` 유지 |
| 불확실한 값과 Text 보존 | 1 | `UNDETERMINED`·양끝 공백·HTML처럼 보이는 요약 그대로 복원 |
| 유효한 판단 보류 | 1 | Job `ABSTAINED`, 제안·분류 0건, 원문 유지 |
| 출력 계약 위반 | 1 | 누락 JSON의 검증 실패, 제안 0건과 원문 유지 |
| 이전 Attempt·보완 대기 | 2 | 늦은 성공·보류와 이전 응답을 저장하지 않음 |
| 새 호출 한도·Lease와 기존 결과 | 2 | 생성 상한 소진과 Lease 만료만으로 현재 응답 저장을 금지하지 않음 |
| 전체 처리 기한 | 1 | 기한 뒤 결과 저장 없음, 새 예약 없음 |
| 반복·동시 결과 저장 | 2 | 기존 제안 덮어쓰기 없음, 경쟁 호출에서 결과 한 건만 Commit |
| Category·완료 상태·보류 상태 실패와 Rollback | 4 | 결과 Row 0건·이전 `RUNNING` 유지, 동일 객체의 DB 저장 재시도에 예약 증가 없음 |
| DB Constraint | 1 | 같은 Job 제안·같은 Category 중복, 없는 부모 참조·허용값 밖 항목·Unicode 공백 요약 거부 |
| 결과 재조회 | 1 | 없는 Job·대기 Job·완료 Job과 제안 유무 구분 |
| 저장 경계 | 1 | Transaction 없는 변경과 `ABSTAIN`의 Suggestion INSERT 거부 |
| V3→V4 Migration | 1 | 기존 원문·Ticket 상태·Job 정책·현재 Attempt·예약 원장과 마감 시각 유지 |

`rollback_after_successful_sql_restores_running_instead_of_automatically_marking_failed`에서는 결과 Transaction 안의 제안 1건·분류 2건과 `SUCCEEDED`를 먼저 확인했다. 이후 오류를 발생시킨 뒤 Transaction 밖에서 결과 Row 0건과 `RUNNING`을 확인했다. INSERT·UPDATE 성공과 Commit 성공은 다른 사실이다.

완료 UPDATE를 DB CHECK로 거부한 Test에서도 부모 제안과 모든 분류가 사라졌다. 오류 조건을 제거한 뒤 메모리의 같은 검증 객체로 저장만 재시도하자 한 건이 Commit됐고 예약 원장은 여전히 한 건이었다. 모든 실패 Case에서 원문의 제목·본문·작성자와 Ticket 상태를 다시 대조했다.

Test DB의 연결 URL이 해당 Testcontainer와 같음을 확인한 뒤에만 데이터를 정리했다. 로컬 학습 DB에는 Migration·정리 SQL을 실행하지 않았다.

## 결과 조회와 남은 연결

`findStoredResult()`는 Job·제안·분류를 짧은 읽기 전용 `REPEATABLE_READ` Transaction에서 조회한다. 여러 SELECT 사이의 Commit 때문에 상태와 제안이 서로 다른 시점의 값으로 조합되는 일을 피한다. 조회 시작 후 완료된 새 결과는 다음 조회에서 확인할 수 있다.

빈 분류 목록은 Java 검증기에서 거부하며 전체 저장은 결과 Service가 묶는다. Foreign Key·복합 Primary Key·일반 Row CHECK만으로 부모에 자식 한 건 이상이나 Job과 제안의 상태 일치를 강제한 것은 아니다. 직접 SQL Writer를 추가할 때 이 경계를 다시 검토한다.

이번 Test는 합성 JSON을 실제 Java 검증기에 통과시켜 PostgreSQL에 저장했다. Provider를 호출하거나 자동 Worker·Browser를 실행하지 않았으며 이번 유료 API 호출은 0회다. 실제 Commit 응답 유실도 주입하지 않았다. 그 상황에서 사용할 결과 재조회 기능과 이미 Commit된 값을 확인했다. 자동 저장 재시도·실패 종료·중단 후 복구 정책은 다음 연결 단계에서 적용한다.

## 재현 명령

Lab Repository에서 실행한다.

```powershell
.\mvnw.cmd "-Dtest=AiSuggestionResultIntegrationTest,AiSuggestionResultMigrationIntegrationTest" test
.\mvnw.cmd clean test
node --test src/test/js/*.test.mjs
npx --yes --package eslint@10.11.0 eslint scripts/week7-*.mjs src/main/resources/static/*.mjs src/test/js/*.mjs
```

계약은 [AI Suggestion 계약 초안](../ai-suggestion-contract-draft.md), 개념은 [AI 비동기 처리의 생애주기](../study-docs/ai-async-processing-lifecycle.md), 앞선 실행권 검증은 [Job 정책·실행권·예약 검증](./2026-10-05-job-policy-and-reservation-lab.md)에 정리했다.
