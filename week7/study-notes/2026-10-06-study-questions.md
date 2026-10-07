# 2026-10-06 핵심 질문과 Worker 실행·복구

> 상태: 진행 중 — 재시도·복구·실제 JVM Process 재시작과 실제 AI의 Browser·자동 Worker·PostgreSQL 흐름 확인, 수동 내용 평가·독립 복습·WIL은 남음
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

## 조회는 AI 실행을 시작하지 않는다

Job이 `PENDING`이고 제안이 없을 때, 담당자의 단순 조회는 현재 상태만 반환해야 한다고 답했다. 작업 실행은 Worker의 책임이고 조회는 DB에 저장된 진행 상태와 결과를 읽는 책임이다. 조회할 때마다 새 Job·예약·AI 호출을 만들면 화면 확인이나 반복 조회가 실행·비용을 늘리는 원인이 된다.

이 읽기 전용 원칙을 계약에 반영하고 `GET /api/tickets/{id}/ai-suggestion`으로 연결했다. 기존 내부 결과 조회와 HTTP용 조회는 분리했다. 조회 API를 추가한 것과 실제 Browser에서 화면 흐름을 확인한 것은 별도의 근거다.

HTTP 조회 성공과 AI 작업 성공도 다르다. AI 작업이 `FAILED`여도 그 상태를 DB에서 정상적으로 읽었다면 `200`으로 실패 상태를 전달해야 한다고 답했다. 이번 조회가 성공했는지는 HTTP Status로, 앞선 AI 작업의 결과는 응답에 담긴 Job Status로 구분한다. DB 조회 자체가 실패한 경우를 정상 조회나 AI 작업 실패로 바꾸어 표현해서는 안 된다.

Job 미등록을 `FAILED`로 표시하면 Ticket 생성 실패로 오해할 우려가 있다고 답했다. 더 직접적인 문제는 등록되지 않은 작업을 등록 뒤 실패한 작업으로 표현한다는 것이다. Ticket 존재 여부·Job 등록 여부·등록된 Job의 결과는 각각 다른 사실이다. 제안이 없다는 이유만으로 `FAILED`라고 하거나 조회 중 새 Job을 만들지 않는다.

조회 응답은 `ticketId`·`job`·`suggestion`을 나눈다. Job이 없는 정상 조회에서는 `job: null`로 부재를 표현하지만, 등록된 작업의 대기·실패·명시적 보류는 실제 Job 상태를 유지한다. DB 조회 오류를 `null`로 숨기는 것은 정상적으로 부재를 확인한 것과 다르다.

유효한 `ABSTAIN`이라면 Job은 남기고 `status: "ABSTAINED"`·`suggestion: null`로 응답해야 한다고 답했다. 제안이 없다는 사실만으로 작업 미등록·실패·명시적인 제안 생성 보류를 구분할 수는 없다. 등록된 Job의 상태를 함께 읽어야 한다.

### 고객 안내와 담당자용 조회는 구분한다

나는 일반 고객에게 내부 요약 실패의 원인을 바로 공개하기보다, 최종 실패 뒤 담당자가 답변할 예정이라는 안내를 하는 방향을 제안했다. 원문 오류 대신 고정 실패 코드를 전달하는 것도 제안했다. 이번에 만드는 조회 API는 AGENT 전용이므로 고객의 화면 안내와 담당자의 처리 원인 확인은 서로 다른 계약이다.

AI 제안은 공식 답변이 아니다. Ticket 접수·AI Job 처리·담당자의 공식 답변을 한 상태로 표현하면 안 된다. 고객 안내를 마련할 때도 실제 접수 여부와 답변 절차를 기준으로 해야 하며, AI 실패만으로 빠른 답변이 보장된다고 약속하지 않는다.

같은 시점의 조회에서 `SUCCEEDED`와 제안 부재가 함께 나타나면 안전한 `500` 조회 오류로 처리하고, 정상 조회한 `FAILED`는 `200`과 담당자용 고정 실패 코드로 전달하는 권장안을 승인했다. Provider 원문 오류를 공개하거나 조회가 Job을 고치는 방식은 사용하지 않는다. Codex가 이 계약으로 API와 Test를 작성했다. 일반 USER는 `403`이고 고객용 공식 답변·안내 기능을 함께 만든 것은 아니다.

### 조회가 읽은 시점도 맞춰야 한다

Worker가 제안과 Job 완료를 같은 Transaction으로 저장해도, 조회가 두 번의 SELECT 사이에 그 Commit을 만나면 이전 상태와 새 제안이 섞일 수 있다. 이번 HTTP 조회는 최초 Message에 연결된 Job·제안·분류를 한 SELECT로 읽는다. `readOnly`는 상태를 고치지 않는 책임이고, 같은 Snapshot으로 읽는 것은 서로 다른 시점의 값을 섞지 않는 책임이다.

PENDING·RUNNING에 이전 실패 코드가 남아 있더라도 현재 작업이 최종 실패했다는 뜻은 아니다. 응답의 `failureCode`는 FAILED일 때만 담는다. 최초 Message의 Job이 없다면 최근 Message의 Job을 대신 가져오거나 새 Job을 만들지 않는다.

Codex가 반복 조회 전후의 여섯 Table을 비교하고 Provider·Claim·결과 저장 Service 미호출을 확인했다. 결과 저장 Transaction의 Commit 전에는 RUNNING·제안 없음, Commit 뒤에는 SUCCEEDED·모든 분류가 조회되는지도 확인했다. DB 예외는 Test용으로 주입해 응답·Log에 원문이 나오지 않는지 검사했다. 실제 DB 연결을 끊거나 실제 Browser로 이 API를 사용한 결과는 아니다. 새 Test 55개를 포함한 최신 회귀는 Java 444개·JavaScript 104개·ESLint 통과다. 구체적인 조건과 근거는 [AGENT 조회 Lab Report](../lab-reports/2026-10-06-agent-ai-suggestion-query-lab.md)에 모았다.

## 화면에 표시할 성공의 의미

Job이 `FAILED`여도 조회 HTTP가 `200`이면 `response.ok`는 `true`이며, 화면에 ‘AI 제안 성공’을 표시하면 안 된다고 답했다. 이번 요청으로 상태를 읽은 것과 앞선 AI 작업의 성공을 구분해야 한다.

`job.status: SUCCEEDED`·`reviewStatus: PENDING_REVIEW`에는 ‘AI 제안 생성 완료·담당자 검토 대기’가 맞다고 답했다. 제안 저장 완료는 요약의 사실성 검토나 고객 문의 해결까지 뜻하지 않는다. Ticket·Job·제안 검토 상태를 화면에서도 따로 표현한다.

Codex가 기존 Ticket 화면과 별도의 최소 담당자 조회 화면을 작성했다. 조회 버튼은 GET만 보내고 AI 실행·재시도는 시작하지 않는다. HTTP 오류와 작업 실패를 나누고, JSON·응답 구조 확인 뒤 Job 상태를 표시하며 요약은 `textContent`로 넣는다. 새 조회에서는 이전 결과를 지우고 늦은 응답이 최신 화면을 덮지 않게 현재 요청 번호도 확인한다.

새 Node Test 29개는 합성 Response·DOM Test Double과 Page 연결을 확인했고, 정적 Resource MockMvc Test 5개도 통과했다. 전체 Java 449개·JavaScript 133개·ESLint가 통과했다. 실제 Browser의 Session·PostgreSQL·자동 Worker를 함께 관찰한 결과는 다음 수직 검증에서 기록한다. [최소 화면 Lab Report](../lab-reports/2026-10-06-agent-ai-suggestion-ui-lab.md)

## 조회·Browser·평가에서 확인할 질문

아래 질문은 다음 수직 검증과 복습에서 이어서 확인한다.

- AGENT의 상태·제안 조회가 새 AI 호출을 시작하면 안 되는 이유는 무엇일까?
- Job이 `FAILED`인데도 상태 조회의 HTTP 응답이 `200`일 수 있는 이유는 무엇일까?
- Job이 아예 없는 경우와 `ABSTAINED`·`FAILED`라서 제안이 없는 경우를 응답에서 어떻게 구분할까?
- `SUCCEEDED`인데 제안이 없는 모순된 조회 결과를 정상적인 ‘제안 없음’으로 표현해도 될까?
- 담당자에게 보여줄 고정 실패 코드와 Provider의 원문 오류는 어떤 점이 다르며, 어느 것을 응답에 담아야 할까?
- 고정 실패 코드가 원문 오류보다 안전하더라도 고객과 AGENT에게 같은 정보를 공개해야 하는가?
- Browser가 접수 `201`을 받은 시점과 Job `SUCCEEDED`를 확인한 시점은 무엇이 다를까?
- Session·Role·CSRF Test와 실제 Browser 흐름은 각각 무엇을 확인할까?
- 구조·Category·Priority 후보 일치가 요약의 핵심 사실 보존까지 확인해 주지는 않는 이유는 무엇일까?
- 제안 문자열을 `textContent`로 표시해야 하는 이유와 Source·Log에 남기지 않아야 할 값은 무엇일까?

## Browser에서 접수하고 Worker가 처리하는 연결

접수 `201`은 Ticket·최초 Message·Job의 저장 완료를 뜻한다. AI 제안이 준비됐다는 뜻은 아니다. 이후 Scheduler가 Commit된 Job의 실행권과 호출 예약을 확보하고 Provider를 호출한다. AGENT 화면은 그 결과를 읽을 뿐이며, 조회 버튼을 눌러 AI를 실행하지 않는다.

Codex가 고정 합성 문의 한 건의 연결 실험을 작성하고 통제된 Provider로 먼저 실행 도구를 점검했다. 이후 Helpdesk 전용 PowerShell에서 실제 AI 모드를 실행했다. 실제 Browser의 USER 로그인, CSRF 없는 대조 POST `403`, 접수 화면의 정상 `201`, 자동 Worker·PostgreSQL 저장과 AGENT 조회 `200`을 확인했다. 원문과 인증 작성자는 그대로 보존됐고, 예약·제안·분류는 각각 1건이었다. 화면에 `SUCCEEDED`가 보이더라도 Ticket은 `OPEN`, 제안은 `PENDING_REVIEW`다.

비용 제한 없이 추가 실험을 진행하도록 승인했다. 이전 비용이 미확인이라는 사실이나 보류 기록까지 사라지는 것은 아니다. 일일 실험 비용 승인을 바꾼 것과 개별 Job의 생성 한도·현재 Attempt·기한은 다른 정책이다. 이번 생성 HTTP 요청은 1회였고 AGENT의 조회가 추가 AI 호출을 만들지는 않았다.

### 화면에 나온 요약과 내용 평가는 구분한다

이번 문의는 링크가 만료됐지만 새 링크로 로그인에는 성공했고, 급하지 않으며 만료 이유를 알고 싶다는 내용이다. 화면에는 ‘로그인 링크가 만료됐지만 새 링크로 로그인에 성공했으며, 만료 이유를 문의합니다. 급한 문의는 아닙니다.’라는 실제 AI 요약과 `ACCOUNT`·`NORMAL`이 표시됐다.

전달받은 실행 결과와 Codex의 화면 대조에서는 값이 DB와 일치했다. DB에 저장된 값이 화면에 잘 표시되는지와, 그 요약이 원문을 정확하게 담았는지는 별도로 확인해야 한다.

이번 원문과 실제 요약을 비교해 핵심 사실 누락이나 근거 없는 추측이 없다고 답했다. 링크 만료·새 링크로 로그인 성공·만료 이유 문의·급하지 않다는 사실이 보존됐으므로 기존 Rubric의 2점 조건에 해당한다. 이 한 건의 요약 점수는 2점으로 정리하고, `ACCOUNT`·`NORMAL`의 판단 근거는 이어서 확인한다.

실행 당시 Report의 `NOT_SCORED`는 그대로 두고 후속 평가를 이 노트와 Lab Report에 남긴다. 이번 평가는 고정 Dataset의 두 방식 비교와 별도다. 학습 중 요약을 평가했어도 Application의 담당자 검토를 완료한 것은 아니므로 제안의 `PENDING_REVIEW`를 바꾸지 않는다.

### 실행 환경에서 구분한 두 오류

전용 키를 설정한 환경 변수는 그 PowerShell Process와 자식 Process에만 적용된다. 새 창에서는 Helpdesk 키를 다시 설정해야 하며 논문용 `OPENAI_API_KEY`를 대신 가져오지 않는다. 키를 설정할 때는 가려진 입력을 사용하고 값은 화면에 출력하지 않는다.

`node .\scripts\...`의 상대 경로는 현재 작업 폴더를 기준으로 해석한다. `System32`에서 실행하면 Lab의 스크립트를 찾지 못하므로 Lab 폴더로 이동해야 한다. 키 누락과 파일 경로 오류로 중단된 두 실행에서는 AI가 호출되지 않았다. 성공한 실행에서는 실제 AI 호출 1회와 제안 저장을 별도로 확인했다.

### 연결 실험에서 다시 설명할 질문

- 접수 `201` 뒤 AI가 실패해도 원문을 유지해야 하는 이유는 무엇일까?
- Browser에 AI Key를 전달하지 않아도 USER의 접수와 AGENT의 조회를 연결할 수 있는 이유는 무엇일까?
- 화면과 DB가 일치해도 요약의 사실성 검토가 별도로 필요한 이유는 무엇일까?
- 비용 상한 해제가 같은 Job의 생성 예약 횟수를 초기화하거나 무제한 재시도를 허용하지 않는 이유는 무엇일까?

[연결 실험 Report](../lab-reports/2026-10-06-worker-browser-experiment-lab.md)와 [주간 계획](../weekly-plan.md)을 기준으로 수동 내용 평가·복습과 WIL을 이어서 진행한다. 실제 연결이 완료됐다는 실행 근거와 자료 없이 설명할 수 있다는 학습 근거는 구분한다.

관련 개념: [AI 비동기 처리의 생애주기](../study-docs/ai-async-processing-lifecycle.md), [Provider Adapter와 HTTP 재시도](../study-docs/ai-provider-adapter-and-http-retries.md), [HTTP 접수와 인증 작성자](../study-docs/http-receipt-and-authenticated-author.md).
