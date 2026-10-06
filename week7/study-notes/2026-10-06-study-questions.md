# 2026-10-06 핵심 질문과 Worker 실행·복구

> 상태: 진행 중 — 재시도·저장·조건부 복구 구현과 실제 JVM Process 재시작 검증, 유료 자동 처리·조회·Browser·평가는 남음
> 주제: 자동 Worker, 실패 유형별 재시도, 현재 Attempt, 중단 복구, 제안 조회와 Browser 흐름

10월 5일 학습 회차의 연장 실험까지는 [10월 5일 학습 노트](./2026-10-05-study-questions.md)에 모았다. 실제 실행일이 10월 6일인 Java AI→PostgreSQL 실험은 해당 날짜의 [Lab Report](../lab-reports/2026-10-06-java-provider-adapter-lab.md)에 남겼다. 이번에는 그 단일 처리기를 자동으로 실행하는 Worker와 재시도 조건을 살펴봤다.

## 재시도 간격과 전체 처리 기한은 다르다

내부 Backoff가 5초이고 Provider의 `Retry-After`가 15초라면 최소 대기는 15초다. 두 값을 더하는 것이 아니라 둘 다 만족하도록 더 긴 시간을 적용한다. 이 질문에는 15초라고 답했다.

처음에는 ‘Job의 남은 처리 기한이 10초’라는 말을 충분히 기다려줘야 하는 시간으로 생각했다. 설명을 듣고, **최소 대기는 다음 호출까지 기다려야 할 시간이고, 전체 기한은 이 Job을 처리할 수 있는 마지막 시각**이라는 차이를 정리했다.

예를 들어 지금부터 10초 뒤에 Job의 기한이 끝나고, Provider가 15초 뒤부터 재요청을 허용했다면 새로운 호출을 할 수 있는 시간대가 없다. 대기를 5초로 줄이거나 재시작하면서 기한을 새로 계산해서는 안 된다.

그렇다고 이미 접수한 문의를 취소하는 것은 아니다. 접수 Commit 전에 Message·Job 저장이 실패한 경우에는 접수 전체를 Rollback하지만, **접수 Commit 뒤 AI 실패나 시간 초과는 Ticket·Message를 취소할 이유가 아니다.** AI 작업의 실패를 원문과 따로 남긴다.

## 한 번의 시도 실패와 최종 FAILED

실패 뒤 자동 재시도가 더 있는지 질문하면서 두 경우를 구분했다.

- 한 번의 요청이 실패해도 재시도 가능한 원인이고 횟수·대기·기한 조건이 남아 있다면 다음 시도를 할 수 있다.
- Job을 최종 `FAILED`로 기록했다면 일반 Worker가 다시 실행하지 않는다. Application을 재시작해도 한도나 기한을 초기화하지 않는다.

관리자의 명시적 재시도는 아직 구현하지 않았다. 그런 기능을 추가하더라도 원인 해결과 재개 조건을 별도로 정해야 하며, 새 Job을 만들어 기존 한도를 우회하는 방식과는 구분해야 한다.

## Worker가 자주 확인하는 것과 AI를 자주 호출하는 것

`AiSuggestionJobProcessor`는 한 Job의 입력 처리·AI 호출·검증·저장을 담당한다. Worker는 이 처리기를 반복 실행하고, 허용된 실패의 다음 실행 시각을 DB에 기록한다.

Worker가 매초 DB를 확인하더라도 재시도 시각이 15초 뒤라면 그 전에는 추가 AI 호출을 하지 않는다. DB의 `PENDING` 상태뿐 아니라 `next_attempt_at`, 남은 전체 횟수와 처리 기한을 만족해야 새 실행권을 얻을 수 있다.

재시도를 기다리는 동안 DB Transaction이나 Row Lock을 잡아두지 않는다. 다음 요청의 실행권·예약을 새로 확보하고 Commit한 뒤 외부 호출을 진행한다. Rate Limit 재시도는 전체 생성 예약을 늘리지만 출력 보완 횟수를 늘리지는 않는다.

## 실행권이 바뀌면 이전 응답을 채택하지 않는다

Lease가 만료됐다고 바로 다시 호출해서는 안 된다. 현재 Attempt·Job 상태와 기존 결과를 다시 확인해야 한다고 답했다. B가 처음 조회했을 때 RUNNING이었더라도 그 뒤 A가 제안을 Commit했다면, B는 저장된 성공 결과를 확인하고 새 호출을 하지 않아야 한다.

B가 새 Attempt 2를 확보했다면 A의 Attempt 1 응답은 더 이상 반영할 수 없다. 응답이 구조 검증을 통과했더라도 마찬가지다. 이전 실행은 제안을 저장할 수도, 현재 Job을 FAILED로 바꿀 수도 없다. 조회 후에도 상태가 바뀔 수 있으므로 실제 저장 단계의 조건 검사가 필요하다.

반대로 생성 한도를 모두 사용했다는 사실은 새 AI 호출을 막는 조건이다. Attempt가 바뀌지 않았고 원래 처리 기한 안이라면 이미 받은 유효한 응답의 저장까지 막는 것은 아니다.

## AI 재호출 대신 같은 객체를 저장한다

검증을 통과한 응답 객체가 메모리에 남아 있다면 다시 시도할 작업은 AI 생성이 아니라 DB 저장이다. 이번에는 **최초 저장을 포함한 총 3회·추가 저장 간 최소 5초**라는 기준을 승인했다. 저장 시도로 생성 예약·출력 보완 횟수·현재 Attempt를 늘리거나 전체 기한을 새로 계산하지 않는다.

저장 실패 뒤에는 곧바로 INSERT를 반복하지 않는다. 먼저 같은 Job의 현재 상태와 제안을 조회한다. Commit은 됐지만 응답만 잃은 경우라면 이미 저장된 결과를 사용해야 한다. 조회 자체가 실패했다면 ‘결과 없음’이 아니라 ‘아직 확인하지 못함’이다.

세 번째 저장도 실패했다면 결과를 다시 확인한 뒤, 결과가 없는 현재 실행만 저장 재시도 소진으로 종료한다. 원문은 유지한다. DB 장애로 종료 기록까지 실패했다면 실제 Row가 FAILED라고 확정할 수는 없다.

이번 저장 주기는 현재 Process의 메모리 객체를 이용한다. Process가 종료되면 그 객체는 사라지므로, 재시작 후 DB에 RUNNING이 남은 상황과 같은 방법으로 취급해서는 안 된다.

## 이번 구현에서 확인한 내용

Codex가 Java Worker·선택 활성화 설정과 Test를 작성·실행했다. 자동 실행은 기본적으로 꺼져 있고, 명시적으로 활성화하면서 Provider·개인정보 Guard·출력 검증기를 제공해야 한다. 기존 Application 실행이 전역 API Key를 읽어 유료 호출을 시작하는 구조는 추가하지 않았다.

실제 PostgreSQL과 통제된 Provider 응답으로 재시도 전 추가 예약 없음, 한도·기한 준수, 원문 보존, 최종 실패 제외와 경쟁 실행을 확인했다. 같은 DB를 유지한 새 Spring Context에서 대기 중 Job을 처리하고 재시도 시각·누적 횟수·원래 기한을 이어가는 것도 검증했다.

앞선 Worker 검증은 같은 JVM에서 Spring Context를 새로 만든 Test다. 이어서 조건부 결과 불명 `RUNNING` 복구와 아래의 실제 JVM Process 재시작을 연결했다. 새 Worker의 실제 AI 호출은 따로 확인할 과제로 남는다. 앞선 실제 AI 저장 한 건의 근거는 그대로 유지한다.

첫 Worker 단계에서는 새 Test 31개와 Java 349개·JavaScript 104개·ESLint가 통과했다. 이어서 저장 재시도 Test 12개·Migration 1개·설정 추가 2개를 더해 최신 회귀는 Java 364개·JavaScript 104개·ESLint 통과다. 두 검증 모두 유료 AI 호출은 0회다.

저장 재시도 Test는 실제 PostgreSQL에서 Rollback 뒤 같은 객체 재사용, 기존 Commit 확인, 조회 실패·이전 Attempt·기한·상한을 확인했다. 응답 유실은 Test용으로 주입하고 5초 경계는 통제된 Clock으로 검사했다. 실제 Process 중단으로 사라진 객체를 복원한 것은 아니다. 조건과 Row Assertion은 [Worker Lab Report](../lab-reports/2026-10-06-worker-rate-limit-and-context-restart-lab.md)와 [저장 재시도 Lab Report](../lab-reports/2026-10-06-validated-output-storage-retry-lab.md)에 모았다.

## Process가 끝나면 메모리의 요약도 사라진다

처음에는 DB 상태로 새 객체를 만들면 저장을 다시 할 수 있다고 생각했다. Job·원문 객체는 DB에서 복원할 수 있지만, 저장되지 않은 AI 요약은 다르다. 메모리에만 있던 `summary`·`categories`·`priority`는 Process 종료 후 Job 상태만으로 다시 만들 수 없다.

기존 제안이 Commit됐는지 먼저 조회하고, 없더라도 조회 실패와 구분해야 한다. 응답 객체가 사라진 상태에서 새 생성이 필요하다면 같은 Job의 복구 정책·예약·한도·기한을 적용한다. 새 Job이나 새 객체를 만든다고 한도가 다시 생기지는 않는다.

## 예약 원장은 실행 완료 로그가 아니다

예약 Row는 앞으로 보낼 생성 요청이 한도 1회를 사용했다는 기록이다. 실제 전송·AI 실행·청구까지 끝났다는 증거는 아니다. 예약 Commit 뒤 전송 전에 중단될 수도 있고, 전송 뒤 결과를 받지 못할 수도 있다.

Attempt 1을 2로 바꾼 뒤 예약 INSERT가 실패하는 예에서는 처음에 Attempt 변경을 되돌릴 필요가 없다고 답했다. 두 작업이 같은 Transaction이라는 설명을 듣고, **현재 Attempt와 예약 증가도 함께 Rollback돼야 한다**고 정리했다. 이후 DB에 남는 값은 `current_attempt=1`, `reserved_generation_count=1`이라고 답했다. 원장도 Attempt 1 한 건만 남고 Provider를 호출하면 안 된다.

## Lease 만료는 재시도 허가가 아니다

Rate Limit 응답을 받았지만 유효한 `Retry-After`가 없는 경우에는 자동 재호출하지 않는 기존 계약을 다시 확인했다. Lease가 끝났다는 사실은 시간 조건일 뿐, 금지된 요청을 허용하는 이유가 아니라고 이해했다.

그래서 예약 원장에 Attempt별 결과 분류를 남기는 방향을 승인했다. `UNCONFIRMED`는 분류가 아직 Commit되지 않은 상태, `OUTCOME_UNKNOWN`은 결과 불명이라는 관찰, `AUTO_RETRY_BLOCKED`는 결과 불명 경로로 자동 재호출하지 않는 상태다. 코드만 보고 실제 AI 실행 횟수를 확정하지 않는다.

복구 후보를 읽은 뒤에도 성공이나 금지 기록이 새로 Commit될 수 있다. 실제 Claim에서 같은 Job을 잠그고 조건을 다시 확인해야 한다. 반면 검증 객체가 아직 남아 있으면 새 생성보다 저장 재시도를 먼저 한다.

Codex가 V7·조건부 복구와 PostgreSQL Test를 추가했다. 새로운 결과 분류는 원문 응답이나 Secret을 보관하지 않는다. 새 Test 20개와 최신 전체 Java 384개·JavaScript 104개·ESLint가 통과했고 유료 호출은 0회다. 같은 JVM의 새 Context에서 조건부 복구와 재시도 미승인 유지를 확인했다. 조건과 Row Assertion은 [Attempt별 결과·복구 Lab Report](../lab-reports/2026-10-06-attempt-results-and-running-recovery-lab.md)에 모았다. 새로운 정책을 승인한 것과 흐름을 자료 없이 설명할 수 있는지는 구분하며 이어서 복습한다.

## 새 Context와 새 Java Process의 차이

Spring Context를 새로 만들면 Bean이 새 객체가 되지만, 같은 JVM에서 Test가 들고 있는 객체는 남을 수 있다. 실제 Process를 종료하면 Worker의 메모리 객체와 Thread도 사라진다. 재시작한 Application이 이어서 처리하려면 원문·Job·예약·정책을 DB에서 다시 읽어야 한다.

이번에는 Codex가 실제 자식 Java Process를 띄우고 첫 Process의 종료를 확인한 뒤 다른 PID의 Process를 시작하는 Test를 작성·실행했다. PostgreSQL은 계속 실행했다. 미실행 PENDING, 호출 전 예약, 관찰한 결과 불명, 재시도 미승인과 미래 대기의 다섯 사례를 확인했다.

중요한 비교는 **재시작이 호출 횟수를 0으로 만들거나 전체 기한을 새로 시작하지 않는다는 것**이다. 새 Application의 기본 생성 한도를 5회로 바꿔도 기존 Job은 등록 당시의 3회 Snapshot을 유지했다. `Retry-After` 없는 Rate Limit은 새 Worker에서도 추가 호출하지 않았다.

호출 전 중단 사례에서는 첫 Process의 호출이 0회이고 두 번째는 1회지만 예약은 총 2건이었다. 첫 예약을 실제 미전송으로 확인한 Test 조건에서도 운영 Worker가 예약을 자동 반환하지 않는 기존 계약을 적용했다. 예약 횟수와 Provider 호출 횟수의 차이를 이 사례에서 볼 수 있다.

새 Test 5개와 전체 Java 389개·JavaScript 104개·ESLint가 통과했다. Provider는 통제된 합성 응답이며 이번 유료 호출은 0회다. Lease와 대기 시각은 Test Row의 경계만 이동했다. 상세한 Row 비교는 [실제 JVM 재시작 Lab Report](../lab-reports/2026-10-06-worker-jvm-process-restart-lab.md)에 모았다. 실제 AI 자동 처리와 Browser는 다음 흐름에서 확인한다.

## 핵심 질문

1. 내부 Backoff가 5초이고 Provider의 `Retry-After`가 15초라면, 최소 몇 초 뒤 새 요청을 시도할 수 있을까?
2. Job의 전체 처리 기한이 10초밖에 남지 않았다면 대기를 줄여 호출해도 될까? 새 호출을 중단할 때 이미 접수한 Ticket·Message도 취소해야 할까?
3. 대기 조건을 만족한 뒤에도 현재 Attempt·남은 한도·전체 기한을 다시 확인해야 하는 이유는 무엇일까?
4. 일시적인 Rate Limit과 크레딧 부족이 모두 `429`일 수 있는데도 같은 재시도 규칙을 사용하지 않는 이유는 무엇일까?
5. Worker가 매초 DB를 확인하는 것과 같은 Job을 매초 AI에 보내는 것은 왜 다른가?
6. 최종 `FAILED`와 다음 시도를 기다리는 `PENDING`은 어떻게 다른가?

1번은 답변으로 확인했고, 2번은 설명을 듣고 접수·AI 실패의 경계를 확인했다. 현재 Attempt를 다시 확인해야 한다는 답변과 이후 성공·이전 응답 사례도 정리했다. 전체 흐름의 독립 설명은 이어서 복습한다.

## 자동 실행과 중단 복구의 핵심 질문

- Processor를 직접 한 번 호출한 실험에서 자동 Worker가 추가로 맡아야 하는 일은 무엇일까?
- 접수 Commit 뒤 Application이 종료됐을 때 재시작한 Worker는 실행 근거를 어디에서 찾을까?
- `RUNNING`과 실행권 기한 만료만으로 Provider 미실행을 단정할 수 없는 이유는 무엇일까?
- 이전 Attempt의 늦은 응답이 현재 Job과 제안을 바꾸지 못하도록 어느 저장 경계에서 확인해야 할까?
- 메모리에 검증된 객체가 남은 저장 재시도와 Process 종료 후 복구는 어떤 점이 다를까?
- 저장 직후 응답을 잃었을 때, 같은 객체를 다시 저장하기 전에 무엇을 확인해야 할까?
- 세 번의 저장 실패와 DB 조회 실패는 왜 서로 다른 판정일까?
- 예약 Row 한 건이 Provider 실제 실행 한 번을 뜻하지 않는 이유는 무엇일까?
- Attempt 2로 바꾼 뒤 원장 INSERT가 실패하면 현재 Attempt·누적 예약·원장에는 무엇이 남아야 할까?
- Lease가 만료됐어도 `AUTO_RETRY_BLOCKED`인 Job을 다시 호출하면 안 되는 이유는 무엇일까?
- Provider 거절을 DB에 기록하기 전에 중단됐다면 재시작한 Worker가 확정할 수 없는 것은 무엇일까?
- 같은 JVM에서 새 Context를 만드는 것과 실제 Java Process를 바꾸는 것은 어떤 점이 다를까?
- Application의 새 기본 한도가 5회여도 기존 Job의 3회 Snapshot을 유지해야 하는 이유는 무엇일까?

## 조회·Browser·평가에서 확인할 질문

- AGENT의 상태·제안 조회가 새 AI 호출을 시작하면 안 되는 이유는 무엇일까?
- Browser가 접수 `201`을 받은 시점과 Job `SUCCEEDED`를 확인한 시점은 무엇이 다를까?
- Session·Role·CSRF Test와 실제 Browser 흐름은 각각 무엇을 확인할까?
- 구조·Category·Priority 후보 일치가 요약의 핵심 사실 보존까지 확인해 주지는 않는 이유는 무엇일까?
- 제안 문자열을 `textContent`로 표시해야 하는 이유와 Source·Log에 남기지 않아야 할 값은 무엇일까?

Week 7의 남은 순서와 완료 기준은 [주간 계획](../weekly-plan.md)을 따른다. 실제 JVM 재시작까지 확인했고, 명시적인 실제 AI 자동 처리·AGENT 조회·Browser·수동 내용 평가와 WIL을 이어서 진행한다.

관련 개념: [AI 비동기 처리의 생애주기](../study-docs/ai-async-processing-lifecycle.md), [Provider Adapter와 HTTP 재시도](../study-docs/ai-provider-adapter-and-http-retries.md), [HTTP 접수와 인증 작성자](../study-docs/http-receipt-and-authenticated-author.md).
