# AI 비동기 처리의 생애주기

문의가 접수된 시점과 AI 제안이 완성된 시점은 다르다. 문의 원문은 먼저 저장하고, AI는 그 원문을 읽어 별도로 제안을 만들 수 있다. 이때 중요한 것은 실행을 다른 곳으로 넘기는 방법뿐 아니라, 어디까지 처리했는지와 실패 후 무엇을 다시 시도할지를 구분하는 것이다.

이 자료는 문의 접수부터 AI 호출·검증·저장까지의 흐름과 Timeout, 재시도, 중단 후 복구를 설명한다. 상태 이름과 숫자는 개념 설명용 예시이며, Java나 Spring이 미리 정해주는 업무 상태가 아니다.

## 먼저 구분할 세 가지 데이터

- **원본**: Ticket은 대화 주제와 문의 처리 상태를, Message는 사용자가 작성한 본문을 보관한다. AI가 실패하더라도 접수된 원문은 유지한다.
- **작업 기록인 Job**: 어떤 Message로 제안을 만들지, 실행 상태와 시도 횟수는 무엇인지 기록한다. Job Row 자체가 AI를 실행하는 것은 아니다.
- **결과인 Suggestion**: 검증을 통과한 요약·분류·우선순위와 담당자의 검토 상태를 보관한다. 고객에게 게시된 공식 답변과는 다르다.

실제로 작업을 수행하는 Server Code를 Worker라고 부를 수 있다. Worker는 작업을 찾아 입력을 읽고 Provider를 호출하는 역할이다. 반드시 별도 Server나 Message Broker가 있어야 하는 것은 아니다. Provider는 Server가 AI 생성을 요청하는 외부 서비스 또는 별도로 운영하는 모델이다.

## 문의 접수와 AI 처리는 별도로 완료된다

사용자가 문의를 등록했다고 AI가 즉시 공식 답변까지 만들어야 하는 것은 아니다. 담당자를 위한 제안이라면 접수를 먼저 완료하고 이후에 생성해도 된다.

```text
문의 접수
  Browser → Security → Controller → Application Service
    → 접수 Transaction: Ticket + 최초 Message + PENDING Job 저장
    → Commit
    → Browser에 201 Created

접수 Commit 후 별도 AI 처리
  Worker가 Commit된 PENDING Job 조회
    → 실행 상태 기록
    → 입력 Message 조회
    → Provider 호출과 응답 수신
    → JSON·Schema·값 규칙 검증
    → 결과 Transaction: Suggestion 저장 + Job 완료 표시
    → Commit
    → 담당자가 작업 상태와 제안을 조회
```

이 설계에서 접수의 `201`은 Ticket·최초 Message의 저장과 처리할 Job 등록의 완료를 뜻한다. AI 호출이나 제안 저장 완료를 뜻하지 않는다. Worker는 Commit된 Job을 대상으로 실행하며, 접수 응답은 AI 완료를 기다리지 않는다. 이후 AI가 실패하더라도 이미 접수한 문의를 취소하지 않는다.

Ticket·최초 Message·Job을 같은 Transaction으로 저장하면 메시지 없는 빈 Ticket이나 작업 기록 없는 새 접수가 남는 일을 막을 수 있다. 대신 Message 또는 Job 저장이 실패하면 접수 전체가 Rollback된다. 결과 저장도 같은 원리로 Suggestion과 Job 완료 표시를 함께 Commit하도록 설계할 수 있다. Transaction은 묶인 변경을 함께 반영하거나 함께 취소하는 경계다. [PostgreSQL Transaction 문서](https://www.postgresql.org/docs/17/tutorial-transactions.html)

| 실패 시점 | 원본 Ticket·Message | AI 처리 |
|---|---|---|
| 접수 Commit 전 Message 또는 Job 저장 실패 | 새 접수 전체 Rollback | Provider를 호출하지 않음 |
| 접수 Commit 후 Provider 호출·출력 검증 실패 | 이미 접수한 원문 유지 | 제안 없이 실패·재시도 정책 적용 |
| 접수 Commit 후 Suggestion 저장 실패 | 이미 접수한 원문 유지 | 결과 저장의 재시도·복구 조건 확인 |

Provider를 기다리는 동안 접수·실행권 확보·결과 저장용 Transaction을 계속 열어두지 않는다. 외부 호출은 DB Transaction 밖에서 하고, 응답을 검증한 뒤 필요한 저장 작업만 짧게 묶는다. DB Rollback으로 이미 실행된 Provider 호출이나 그 비용을 되돌릴 수는 없다.

## 처리할 작업을 찾는 방법

앞의 예제는 접수할 때 실행할 Job도 같은 Transaction으로 기록하는 방법을 사용한다. 원문과 작업이 함께 Commit되므로 접수는 됐는데 실행할 작업 기록은 없는 틈을 막는다. 대신 Job 등록 실패도 접수 Transaction에 영향을 준다.

Worker는 Server 시작 시와 주기적인 조회로 실행 대상인 Job을 찾을 수 있다. 접수 후 메모리 알림은 실행을 앞당기는 보조 수단일 수 있지만 유일한 실행 근거로 삼지 않는다. Commit 뒤 알림 전에 Process가 종료돼도 DB의 `PENDING` Job을 다시 찾을 수 있어야 하기 때문이다. Job 저장과 재조회 가능성이 Provider의 정확히 한 번 실행까지 보장하지는 않는다.

업무 데이터와 처리할 작업을 같은 Transaction에 기록하는 원리는 [Transactional Outbox 설명](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)을 참고할 수 있다. 별도 Message Broker 대신 DB Job을 조회하는 설계에도 이 원리를 적용할 수 있다.

두 번째 방법은 Server가 저장된 Message 중 AI 처리 대상인 원문을 찾아 작업을 등록하는 것이다. 이 경우 접수 직후 메모리 작업 등록이 누락되더라도 원문에서 다시 찾을 수 있다. 다만 이미 처리 중이거나 재시도를 끝낸 Message를 매번 새 작업으로 만들지 않도록 처리 상태를 확인해야 한다.

접수 후 Job을 독립적으로 등록하는 방식도 가능하다. 이때 두 Commit 사이에 Process가 종료될 수 있으므로, 원문은 있는데 Job이 없는 경우를 찾아 보완하는 규칙이 필요하다.

핵심은 특정 Table 이름이 아니라 **처리할 원문을 놓치지 않고 찾을 수 있는가**다. 별도 Job Table을 쓰지 않더라도 처리 상태와 재시도 정보를 어디에 보관할지는 정해야 한다.

## 작업 상태와 제안 내용은 다르다

다음은 작업 상태를 나누는 한 가지 예다.

| 상태 예시 | 의미 |
|---|---|
| `PENDING` | 실행을 기다린다. |
| `RUNNING` | 처리를 시작했다고 기록했다. 완료 기록은 없다. |
| `SUCCEEDED` | 허용된 제안을 저장하고 결과 Transaction을 Commit했다. |
| `ABSTAINED` | 계약에 맞는 명시적 판단 보류를 결과로 기록했다. 별도 보류 상태를 채택하는 설계에서 사용한다. |
| `FAILED` | 정책상 허용한 처리를 끝냈지만 작업을 완료하지 못했다. |

한 번의 시도가 실패했다고 전체 Job을 반드시 `FAILED`로 끝내는 것은 아니다. 허용된 재시도가 남았다면 다음 시도를 기다리는 상태를 어떻게 표현할지 별도로 정한다.

`RUNNING`도 실제 실행의 완벽한 증거는 아니다. 그 값을 기록한 뒤 Process가 종료됐을 수 있다. 저장된 상태는 마지막으로 기록한 사실이며, 지금 Thread나 Provider가 계속 일하고 있다는 보장은 아니다.

또한 다음 세 상태는 동시에 성립할 수 있다.

```text
Ticket 상태: OPEN
AI Job 상태: SUCCEEDED
Suggestion 검토 상태: PENDING_REVIEW
```

이는 제안 생성·저장은 끝났지만 담당자의 검토와 문의 해결은 남아 있다는 뜻이다. `SUCCEEDED`가 요약의 사실성까지 확정하지도 않는다. 구조·값 검증과 원문 대조는 서로 다른 검사다.

### 판단을 보류한 필드가 있어도 유효한 제안일 수 있다

요약과 분류는 가능하지만 긴급도 근거가 부족하면 `priority: "UNDETERMINED"`처럼 표현할 수 있다. 이 값이 계약에서 허용되고 나머지 규칙도 맞다면 유효한 제안으로 저장할 수 있다.

이는 작업의 일부가 실패한 것과 다르다. AI가 판단하지 못한 범위를 명시한 결과다. 반면 필수 필드가 아예 없는 응답은 계약 위반이며, Server가 임의로 `UNDETERMINED`를 채워 명시적 판단 보류로 바꾸지 않는다.

## 단계별 성공과 전체 성공을 구분한다

AI 응답을 받고 검증까지 마쳤어도 DB 저장에서 실패할 수 있다.

| 단계 | 예시 결과 |
|---|---|
| Provider 응답 수신 | 성공 |
| JSON·Schema·값 규칙 검증 | 성공 |
| Suggestion 저장 Transaction | 실패·Rollback |
| 전체 제안 생성 작업 | 미완료 |

전체 상태 하나만으로는 실패 지점을 알기 어렵다. 최소 설계 후보로 전체 `status`와 실패한 단계인 `failed_stage`를 분리할 수 있다. 예를 들어 재시도까지 종료한 뒤 `status=FAILED`, `failed_stage=SAVE`를 기록하면 “응답 수신과 검증은 통과했지만 저장을 마치지 못했다”는 사실을 표현할 수 있다. Field 이름과 단계 구분은 Application이 정하는 계약이다.

이 방식은 순서대로 실행하는 흐름의 간단한 실패 진단 예다. 여러 시도의 이력이나 각 단계의 시작·종료 시각까지 자동으로 보존하는 것은 아니다.

DB 장애라면 `FAILED`를 기록하는 작업도 실패할 수 있다. 실제 Row에는 이전 `RUNNING`이 남을 수 있으므로, Code가 의도한 최종 상태와 실제 DB에 반영된 상태를 구분한다.

### Rollback이 Job을 자동으로 FAILED로 바꾸지는 않는다

결과 저장 전 Job이 `RUNNING`으로 Commit돼 있었다고 가정하자. 새 Transaction에서 제안 INSERT와 `SUCCEEDED` UPDATE를 실행했지만 이후 오류로 Rollback됐다면 두 변경은 모두 취소된다. DB에는 이전 `RUNNING`이 남는다. `FAILED`는 Transaction의 자동 오류 표시가 아니라 Application이 정한 업무 상태다. 그 상태가 필요하다면 현재 Attempt와 실패 정책을 확인해 별도로 기록하고 Commit해야 한다.

이는 이미 접수한 Ticket·Message를 Rollback하는 것과도 다르다. 접수 Commit, 호출 예약 Commit과 결과 저장 Commit은 별도 경계다. 결과 저장 실패로 앞선 Commit까지 취소되지는 않는다.

### 복수 분류는 한 제안에 속한 여러 Row일 수 있다

제안의 요약·우선순위를 부모 Table에, 복수 Category를 자식 Table에 보관할 수 있다. 분류가 `["ACCOUNT", "BILLING"]`이면 제안은 한 건, 분류는 두 Row다. 각 분류 Row는 같은 Suggestion을 참조한다. 이것은 Ticket이나 AI 작업을 두 건으로 분리하는 것과 다르다.

`(suggestion_id, category)`가 복합 Primary Key라면 같은 제안의 서로 다른 Category는 허용하지만 같은 조합의 중복은 거부한다. Foreign Key는 분류 Row가 존재하는 제안을 참조하게 한다. 부모 제안·모든 분류·Job 완료 UPDATE를 함께 묶으면 두 번째 분류 INSERT의 실패도 결과 전체를 되돌린다.

Foreign Key는 부모에 자식이 반드시 한 건 이상 있다는 규칙까지 보장하지 않는다. 일반 Row CHECK로 다른 Table의 개수를 검사해서도 안 된다. 최소 목록은 Application에서 검증하고 결과 Transaction으로 저장하거나, 직접 SQL 변경까지 허용하는 요구가 있다면 별도의 DB 강제 방법을 설계한다. [PostgreSQL CHECK의 범위](https://www.postgresql.org/docs/17/ddl-constraints.html#DDL-CONSTRAINTS-CHECK-CONSTRAINTS)

## Timeout은 실행 실패가 확정됐다는 뜻이 아니다

Server가 Provider 응답을 최대 10초 기다린다고 가정하자. 10초가 지나면 Server는 기다리기를 중단할 수 있다. 그러나 Provider가 요청을 받지 못했는지, 아직 생성 중인지, 생성을 끝냈지만 응답 전달이 실패했는지는 Timeout 하나만으로 알 수 없다.

평소 응답 시간이 짧다는 관찰은 대기 한도를 정하는 데 도움이 된다. 하지만 느린 요청에서 실제로 무엇이 일어났는지까지 증명하지 않는다. 호출자 측 대기 종료와 공급자 측 실행 종료는 별개다. [AWS의 Timeout·재시도 설명](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

따라서 “결과를 아직 확인하지 못함”과 “생성이 실행되지 않았음”을 구분한다. 그렇다고 무조건 재시도를 금지하는 것도 아니다. 중복 실행 가능성, 비용과 지연을 고려해 제한된 재시도 정책을 정한다.

## 재시도 간격과 총 시도 한도는 별개다

**재시도 간격**은 다음 요청까지 얼마나 기다릴지를 정한다. **총 시도 한도**는 같은 작업에 몇 번까지 요청할지를 정한다. 여기서는 처음 요청도 시도 횟수에 포함한다.

설명용 정책이 “총 2회까지”라면 두 번 요청한 뒤 오래 기다려도 세 번째 요청이 자동으로 허용되지 않는다. “총 3회까지”이고, 두 번만 시도했으며, 다음 요청의 대기 시간과 재시도 가능한 오류 조건을 만족한다면 세 번째 시도를 할 수 있다. 숫자 2와 3은 서로 다른 정책을 비교하기 위한 가정이다.

일시적인 오류는 재시도로 회복될 수 있지만, 잘못된 자격 증명이나 요청 설정은 같은 요청을 반복해도 해결되지 않을 수 있다. 재시도 여부를 실패 유형별로 판단한다. Backoff는 시도 사이의 대기 시간을 늘리는 방식이고, Jitter는 여러 요청이 같은 시점에 몰리지 않도록 대기 시간에 임의의 차이를 주는 방식이다. SDK의 자동 재시도와 Application의 재요청이 겹치는지도 확인한다. [AWS의 재시도 제한 지침](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html)

재시작할 때 시도 횟수를 0으로 되돌리면 정한 한도를 우회할 수 있다. 중단 후 재개까지 같은 작업의 예산에 포함하려면 횟수를 영속적으로 관리하고, 어떤 지점에서 횟수를 기록할지 정해야 한다. 외부 요청과 횟수 기록도 별개이므로 중간 종료의 처리 규칙이 필요하다.

### SDK 재시도와 제공자 내부 재처리는 다르다

SDK는 API 호출을 돕는 라이브러리이며, Server에 설치하면 우리 Server Process 안에서 실행된다. AI 제공자가 작성한 SDK라도 제공자 Server 내부의 프로그램과 같은 것은 아니다.

Worker가 SDK 메서드를 한 번 호출했는데 SDK가 최초 요청 뒤 두 번 재전송했다면, Job은 한 건이고 메서드 호출은 한 번이지만 Model 생성 HTTP 요청은 세 번 시도한 것이다. 호출 한도를 새 생성 요청 기준으로 정했다면 각 재전송도 같은 한도에 포함해야 한다. OpenAI Java SDK도 자동 재시도와 이를 조정하는 설정을 제공한다. [OpenAI Java SDK의 재시도 설명](https://developers.openai.com/api/reference/java#retries)

SDK 자동 재시도를 끄고 Application이 새 요청을 관리하거나, 각 SDK 재전송이 같은 예약·한도 경계를 거치게 만들 수 있다. 중요한 것은 여러 계층의 재시도가 한도를 우회하지 않게 하는 것이다. 한 번의 예약 뒤 SDK가 여러 요청을 보내는 문제는 사후 로그만 추가해서 해결되지 않는다. [OpenAI의 중첩 재시도 지침](https://developers.openai.com/api/docs/guides/rate-limits)

우리 Server는 한 번 요청했지만 AI 제공자가 자기 Server 안에서 처리를 다시 한 경우는 별개다. 공개되지 않은 내부 실행 횟수를 우리 로그로 알아낼 수 있다고 가정하지 않는다. 우리 호출 예약·전송 시도·확인된 결과와 제공자가 공개한 사용량을 구분하고, 각각을 제공자 내부 실행 횟수나 실제 청구액으로 바꾸어 해석하지 않는다.

로그는 이미 발생한 일을 관찰하고, 호출 예약은 앞으로 보낼 요청을 제한한다. Job ID·Attempt·요청 ID·오류 코드·지연과 확인한 사용량은 진단에 활용할 수 있지만, Credential·원문 Prompt·전체 응답을 그대로 출력하지 않는다. 확인하지 못한 사용량은 0이 아니라 미확인으로 남긴다.

### 같은 429라도 재시도 조건은 다르다

HTTP `429`라는 값만으로 잠시 기다리면 해결될 오류인지 알 수는 없다. 짧은 시간에 요청이 몰린 Rate Limit은 기다린 뒤 회복될 수 있지만, 크레딧이 소진된 경우에는 충전 등 원인이 해결돼야 한다. Provider가 반환한 오류 유형을 구분하고, 확인되지 않은 원인을 임의로 일시적인 제한으로 바꾸지 않는다. [OpenAI 오류 유형](https://developers.openai.com/api/docs/guides/error-codes)

일시적인 Rate Limit 응답의 `Retry-After: 15`는 다음 요청까지 최소 15초를 기다리라는 뜻이다. Application의 재시도 간격이 5초라면 더 긴 15초를 적용한다. 15초를 기다렸다는 사실만으로 새 요청이 허용되지는 않으며, 같은 Job의 남은 횟수·전체 처리 기한과 현재 실행권을 다시 확인해야 한다. Provider의 최소 대기보다 먼저 Job 기한이 끝난다면 더 일찍 호출해서는 안 된다. [OpenAI 재시도 지침](https://developers.openai.com/api/docs/guides/rate-limits)

대기 시간을 보내는 동안 DB Transaction과 Row Lock을 계속 유지할 필요는 없다. 오류와 다음 실행 가능 시각을 짧은 Transaction으로 기록하고, 실행 가능한 시점에 새 요청의 조건을 확인해 예약을 Commit하는 방식으로 연결할 수 있다. SDK 자동 재시도를 사용한다면 이 대기와 예약 경계를 우회하지 않는지도 확인한다.

첫 요청이 Rate Limit으로 실패했더라도 예약 횟수를 되돌리지는 않는다. 이후 허용된 새 요청은 전체 생성 예약을 한 번 더 사용한다. 누락된 출력 Field를 보완하는 요청과는 다르므로 출력 보완 횟수는 늘리지 않는다. 입력 원문을 이미 접수한 Transaction 역시 취소하지 않는다.

### Worker의 확인 간격과 Job의 재시도 간격

Worker가 매초 처리할 Job을 찾아도 같은 Job을 매초 Provider에 다시 보내는 것은 아니다. DB를 확인하는 간격과 개별 Job의 다음 호출을 허용하는 시각은 서로 다르다.

다음 호출이 15초 뒤부터 가능하다면 그 전의 조회에서는 새 실행권을 확보하지 않는다. 실행 가능한 시각이 된 뒤에도 `PENDING` 상태·남은 호출 한도·전체 처리 기한을 함께 확인한다. 기다리는 동안 Row Lock을 유지하는 대신 다음 실행 가능 시각을 DB에 남기면 Application 재시작 뒤에도 같은 대기 조건을 이어갈 수 있다.

한 번의 요청 실패와 Job의 최종 `FAILED`도 다르다. 허용된 재시도가 남은 Job은 다음 시도를 기다릴 수 있지만, 최종 `FAILED`는 일반 자동 처리 대상에서 제외한다. 관리자의 재개 기능은 원인 해결·추가 허용 조건·기록을 정하는 별도 정책이며, 기존 한도를 암묵적으로 초기화하는 반복문이 아니다.

### 남은 처리 기한은 반드시 기다려야 하는 시간이 아니다

‘전체 기한까지 10초 남았다’는 말은 10초를 기다려야 한다는 뜻이 아니라 처리할 수 있는 시간이 10초 남았다는 뜻이다. Provider의 최소 대기가 15초라면 그 대기를 지킨 새 호출은 기한 안에 시작할 수 없다. 대기를 줄여 호출하거나 전체 기한을 새로 시작하지 않는다.

AI 작업을 종료하는 것과 문의 접수를 취소하는 것도 구분한다. 접수 Transaction이 이미 Commit됐다면 AI 실패·기한 초과 뒤에도 Ticket·Message는 유지한다. Job에 실패를 기록하고 담당자가 원문을 확인할 수 있게 한다.

### 호출 예약과 Provider 실행은 다르다

한도를 먼저 확보하려면 외부 요청 전에 짧은 DB Transaction으로 실행권과 잔여 한도를 확인하고 한 번의 요청을 예약해 Commit할 수 있다. 이후 Provider를 Transaction 밖에서 호출하고 확인한 결과를 별도로 기록한다. Job을 등록했다는 사실, 호출을 예약했다는 사실, 실제 Provider 결과를 확인했다는 사실은 서로 다르다.

예약 Commit 직후 Process가 종료되면 실제 요청은 아직 전송되지 않았을 수도 있다. 반대로 요청은 접수됐지만 결과를 기록하기 전에 종료됐을 수도 있다. 따라서 예약 횟수만으로 Provider 실행·청구 횟수를 확정하지 않는다. 결과가 불명확한 예약을 자동 반환하면 재시작할 때 호출 한도를 반복 사용할 위험이 있다.

외부 호출까지 같은 DB Transaction 안에 넣어도 이 문제를 해결하지 못한다. 예를 들어 예약을 기록한 뒤 Provider가 요청을 실행했고, 전송 상태의 Commit 직전에 Process가 종료됐다고 가정하자. DB의 예약·전송 기록은 Rollback될 수 있지만 외부 AI 실행은 되돌아가지 않는다. **Transaction이 열린 동안 실행한 코드와 그 Transaction으로 함께 취소할 수 있는 작업은 다르다.** Spring도 원격 호출에 Transaction Context를 자동으로 전파하지 않는다. [Spring Transaction 설명](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative.html)

먼저 예약을 Commit하는 방식도 전송 여부를 완벽히 증명하지는 않는다. 불명확한 시도의 기록을 남겨 한도를 지키고, 가능한 Provider 결과 조회·공식적으로 지원되는 멱등성 기능과 복구 정책으로 후속 처리를 판단하는 방식이다. 구체적인 기록 이름과 복구 조건은 Application과 Provider의 계약에서 정한다.

### 정책 사본과 누적 예약 횟수를 함께 보관한다

Application 설정은 새 Job을 등록할 때 사용할 기본 정책이다. 실행 중인 Job의 정책은 등록 당시 DB에 저장한 사본, 즉 Snapshot에서 읽을 수 있다. 그러면 Application 설정을 바꾸거나 재시작해도 기존 Job의 한도와 시간 제한이 바뀌지 않는다. 설정 변경을 기존 Job에도 적용하려면 암묵적으로 덮어쓰지 말고 별도 정책 변경 절차를 정해야 한다.

상한과 누적 예약 횟수를 저장한다면 남은 횟수는 다음처럼 계산한다.

```text
남은 생성 횟수 = maxGenerationAttempts - reservedGenerationCount
```

상한이 5이고 누적 값이 4라면 다섯 번째 요청을 예약할 수 있다. 예약 값을 5로 증가시켜 Commit한 뒤 그 요청을 보낸다. Commit 뒤 값이 상한에 도달했다는 이유로 방금 허용한 다섯 번째 요청을 취소하지 않는다. 여섯 번째 새 요청을 예약하려 할 때 거부한다.

한도 확인과 증가를 서로 다른 Transaction으로 처리하면 두 Worker가 동시에 4를 읽고 각각 호출할 수 있다. 현재 상태·Attempt·남은 한도를 확인하고 실행권 변경·예약 횟수 증가·예약 원장 INSERT를 함께 묶는다. 원장 저장이 실패하면 실행권과 카운터도 Rollback되어야 한다. 이미 별도로 Commit한 접수 데이터는 그대로 남는다.

### Row Lock과 실행권은 다른 수명을 가진다

Row Lock은 DB Row를 변경하는 동안 다른 Transaction과의 경쟁을 제어한다. Transaction이 끝나면 Lock은 해제되지만 `RUNNING`·현재 Attempt·실행권 기한은 DB에 남는다. 이후 다른 Worker가 Lock을 얻을 수 있다는 사실만으로 기존 실행권을 교체할 수는 없다.

Queue 조회에서 `FOR UPDATE SKIP LOCKED`를 사용하면 다른 Transaction이 잠근 Job을 기다리지 않고 다음 후보를 확인할 수 있다. Queue의 작업 분배에는 유용하지만, 특정 Row의 최신 상태를 빠짐없이 조회하는 일반 조회를 대신하는 기능은 아니다. [PostgreSQL의 Locking Clause 설명](https://www.postgresql.org/docs/17/sql-select.html#SQL-FOR-UPDATE-SHARE)

Provider를 기다리는 동안에는 Lock을 유지하지 않는다. 결과가 돌아왔을 때 현재 Attempt와 상태를 보호된 변경 구간에서 다시 확인한다. Attempt 2로 교체된 뒤 Attempt 1의 응답이 늦게 도착했다면, 이전 응답이 Job 실패·완료 상태나 Suggestion을 바꾸지 못하게 한다. 일반 SELECT로 확인한 뒤 따로 저장하면 그 사이에 실행권이 바뀔 수 있다.

실행권 기한이 지났더라도 아직 다른 Attempt로 교체되지 않았다면 기존 응답은 여전히 현재 Attempt의 응답이다. 새 호출의 허용 조건과 이미 허용한 호출의 결과 반영 조건을 구분한다. Job 전체 처리 기한과 저장 정책은 별도로 적용한다.

### 독립 Transaction의 Commit 뒤에 Provider를 호출한다

Spring Service의 `@Transactional(propagation = REQUIRES_NEW)`는 바깥 Transaction이 있더라도 별도 Transaction을 시작한다. 실행권과 예약을 이 경계에서 Commit한 뒤 호출자에게 반환하면, 이후 Provider 호출이 바깥 Transaction의 Commit을 기다리지 않는다.

이 동작은 Spring이 관리하는 Service의 Transaction Proxy를 통해 호출할 때 적용된다. 같은 객체 내부에서 메서드를 직접 호출하거나 `new`로 만든 객체의 Annotation만 믿으면 같은 경계가 적용되는 것은 아니다. [Spring의 Transaction Propagation 설명](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-propagation.html), [Transaction Annotation과 Proxy](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)

독립 Transaction을 사용한다는 이유로 Worker 전체를 하나의 Transaction으로 묶지는 않는다. 실행권·예약 Commit, 외부 Provider 호출, 검증된 결과의 저장 Commit은 서로 다른 구간이다.

바깥 Transaction이 있는 상태에서 `REQUIRES_NEW`를 호출하면 추가 DB Connection이 필요하다. Connection Pool의 여유 없이 여러 Thread에서 중첩 호출하면 자원 부족이나 교착 상태를 만들 수 있다. Worker의 전체 흐름에는 Transaction을 열지 않고, 필요한 짧은 DB 작업만 Service 경계로 나누는 이유다.

### 전체 생성 요청과 출력 보완 요청을 함께 제한한다

전체 생성 요청 상한과 출력 보완 요청 상한은 서로 다른 조건이다. 최초 요청은 전체 횟수에만 포함하고, 누락된 Field를 보완하기 위한 새 생성 요청은 전체 횟수와 추가 보완 횟수에 모두 포함한다. 두 상한을 설정값으로 분리하면 남은 횟수와 실패 유형에 따라 다음 요청을 허용할지 판단할 수 있다. 남은 전체 횟수가 있다는 이유만으로 모든 오류를 재시도하지는 않는다.

예를 들어 전체 상한 4회·추가 보완 상한 2회라고 가정하자. 누락 → 누락 → 정상 응답이라면 전체 생성 요청 3회와 추가 보완 2회를 사용한다. 세 번째 응답도 누락이라면 전체 횟수가 한 번 남아 있어도 보완 상한에 도달했으므로 더 보완하지 않는다. 반대로 전체 상한 2회라면 보완 상한에 여유가 있어도 전체 2회에서 중단한다. 숫자는 정책 비교용 가정이며 보편적인 권장값이 아니다.

같은 누락이 반복되면 생성 결과뿐 아니라 요청 Schema·Server 검증 규칙·Adapter 변환을 살펴본다. 변환 Code가 Field를 버리는 오류라면 Provider를 다시 호출해도 해결되지 않는다. 단순한 반복만으로 원인을 확정하지는 않지만, 확인된 설정·변환 오류를 생성 재시도로 고치려 하지 않는다.

### 한 요청의 대기 시간과 Job 전체 처리 기한은 다르다

한 번의 Provider 요청에서 응답을 기다리는 한도와 Job 전체의 처리 기한도 분리한다. 한 요청의 대기 한도를 넘기면 가능한 기존 결과 조회·확인을 거쳐 제한적 재호출을 검토할 수 있다. 이전 결과를 끝내 확인하지 못했다면 중복 실행·비용 가능성을 감수하는 재시도다. 재시도 사이에는 간격을 두고 전체 횟수·시간 조건을 함께 확인한다.

Job 전체 처리 기한을 넘기면 새 생성 요청을 중단한다. 재시작할 때 횟수나 전체 기한을 새로 시작하지 않는다. 기한의 기준 시점과 Queue 대기 시간을 포함할지는 업무 정책에서 정한다. 생성 요청 상한에 도달해도 허용된 시간 안에서 기존 결과를 확인하는 것은 새 생성 요청과 다르다.

## AI 재호출과 DB 저장 재시도는 다른 작업이다

검증된 AI 응답 객체가 현재 Server 메모리에 남아 있고, 저장 Transaction의 Rollback까지 확인했다면 DB 저장을 다시 시도할 수 있다. 이미 사용할 결과가 있으므로 저장 오류를 해결하려고 AI에 새로 생성해 달라고 요청할 필요는 없다.

그렇다고 모든 저장 오류에 반복 INSERT를 보내는 것은 아니다. 저장할 값 자체가 제약을 위반했다면 원인을 고쳐야 한다. Commit 응답을 받지 못해 실제 반영 여부가 불명확하다면 먼저 같은 Job의 제안과 완료 상태를 확인하고, 중복 저장 방지 규칙에 따라 처리한다. Rollback 확인과 Commit 결과 불명확은 다른 경우다.

Job·제안·분류를 여러 SELECT로 조회할 때는 서로 다른 시점의 값을 조합하지 않는지도 확인한다. 읽기 전용 `REPEATABLE_READ` Transaction은 첫 조회의 Snapshot을 후속 조회에서도 사용한다. 조회가 시작된 뒤의 새 Commit까지 즉시 보장하는 것은 아니며 다음 조회에서 최신 결과를 확인할 수 있다. [PostgreSQL Isolation 설명](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-REPEATABLE-READ)

### 저장 시도와 결과 조회의 횟수를 구분한다

전체 생성 예약은 외부 AI에 새 결과를 요청할 때 사용한다. 저장 시도는 이미 검증한 객체를 결과 Transaction에 전달할 때 사용한다. 결과 조회는 저장 여부를 확인하는 읽기 작업이다. 조회에 실패했다고 저장 시도를 늘리거나 새 AI 호출을 허용해서는 안 된다.

예를 들어 최초 저장을 포함해 총 3회, 추가 저장 간격을 최소 5초로 정했다면 첫 저장 실패 뒤 같은 객체를 보관한다. 다음 실행 가능 시각 전에는 대기하고, 그 뒤 현재 Attempt·Job 상태·기존 제안을 조회한다. 저장된 정상 결과가 있으면 그것을 사용하고, 같은 Attempt가 아직 RUNNING이며 결과가 없다는 것을 확인한 경우에만 저장을 다시 시도한다.

일반 조회 후 다른 실행이 완료되거나 실행권을 교체할 수도 있다. 따라서 실제 저장 Transaction 안에서도 현재 Attempt·RUNNING·전체 처리 기한을 다시 확인한다. 이전 실행의 객체는 새 실행의 제안이나 실패 상태를 바꿀 수 없다. 생성 한도를 모두 사용했다는 이유만으로 현재 실행이 이미 얻은 유효한 응답을 버리는 것도 아니다.

저장 상한에 도달했을 때도 먼저 DB를 확인한다. 마지막 저장의 Commit은 성공했지만 응답만 잃었을 수 있기 때문이다. 결과가 없는 현재 실행이라면 저장 재시도 소진으로 종료한다. 종료 UPDATE의 결과마저 확인할 수 없다면 DB에 실패가 기록됐다고 단정하지 않는다. 이미 접수한 Ticket·Message는 유지한다.

대기 중에는 DB Transaction이나 Row Lock을 유지하지 않는다. 대기 시각을 확인하는 Worker의 다음 Tick에서 짧은 조회·저장을 수행한다. 한 Worker가 보관할 객체 수와 보관 기한도 제한해야 한다. 전체 처리 기한이 끝나면 추가 저장을 중단하고 객체를 해제할 수 있지만, 해제했다는 사실과 DB의 종료 상태가 Commit됐다는 사실은 별개다.

Process가 종료되면 메모리에만 있던 응답 객체는 사라진다. Job에 “검증 단계 성공”을 기록했다고 그 응답 내용까지 보존되는 것은 아니다. 재시작 후 저장만 재개하려면 결과를 안전하게 영속 보관하거나 Provider에서 다시 확인할 수 있어야 한다. 결과를 보관하는 방안에는 민감 정보·접근 권한·보관 기간을 별도로 정해야 하며, 전체 Prompt나 원본 응답을 무조건 저장하거나 Log에 출력하지 않는다.

## 제안 중복 방지와 Provider 중복 실행 방지는 다르다

다음은 두 호출이 실제로 실행됐다고 가정한 예다.

```text
첫 번째 Provider 요청 → 응답을 기다리다 Timeout, Provider에서는 계속 처리
두 번째 Provider 요청 → 정상 응답, 검증 후 제안 저장
첫 번째 요청도 나중에 생성 완료

Provider 실행: 2회
같은 Job의 DB 제안: 중복 저장을 막았다면 1건
```

같은 Job의 Suggestion을 최대 한 건으로 제한하는 DB 규칙은 결과 중복을 막는 장치다. 그 장치가 이미 발생한 두 AI 호출을 하나로 줄이거나 비용을 취소하지는 않는다.

반복 요청에도 같은 업무 효과를 유지하는 성질을 Idempotency, 즉 멱등성이라고 한다. Provider의 재시도 안전성이나 결과 조회 기능은 해당 API 계약을 확인해야 한다. HTTP도 반영 여부가 불명확한 비멱등 요청을 아무 조건 없이 자동 재시도하도록 권장하지 않는다. [RFC 9110의 멱등성과 재시도](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)

## 비동기 실행과 중단 후 복구는 다르다

Spring의 `@Async`는 호출자의 흐름과 별도로 작업을 실행하도록 `TaskExecutor`에 넘기는 기능이다. 작업을 DB에 저장하거나 재시작 후 미완료 작업을 다시 찾는 정책까지 대신 정해주는 기능은 아니다. [Spring의 비동기 실행 설명](https://docs.spring.io/spring-framework/reference/integration/scheduling.html#scheduling-annotation-support-async)

중단 후 복구를 설계할 때는 다음을 확인한다.

1. 처리할 원문과 작업 기록을 다시 찾을 수 있는가?
2. `RUNNING`이 남아 있을 때 실제 실행 중인지, 중단된 작업인지 어떻게 판단하는가?
3. 이전 Provider 호출 결과와 제안 저장의 완료 여부를 어디까지 확인할 수 있는가?
4. 남은 시도 한도와 중복 저장 방지 규칙을 지키며 어느 단계부터 재개할 것인가?

오래된 `RUNNING`을 모두 새 호출로 바꾸면 아직 실행 중인 요청을 중복 호출할 수 있다. 반대로 영원히 건드리지 않으면 중단된 작업이 남는다. 경과 시간은 판단 조건 중 하나로 사용할 수 있지만, 그것만으로 이전 실행이 끝났음을 증명하지는 않는다.

## Test에서 구분할 근거

다음은 실패 실험에서 확인할 항목이다. 실제 결과는 Test나 Database 관찰로 확인한다.

- Provider 실패: 호출 횟수와 실패 경로, Suggestion 0건, 이미 접수한 Ticket·Message 유지.
- 접수 실패: Message·Job 저장 오류로 접수 Transaction이 Rollback된 뒤 새 Ticket·Message·Job이 모두 없는지, Provider 호출도 없는지.
- 출력 검증 실패: Provider 호출은 했지만 Suggestion 저장 경로에는 진입하지 않았는지.
- 저장 실패: 유효한 응답 뒤 저장을 시도했지만 결과 Transaction 종료 후 제안이 없는지, 성공 상태만 남지 않았는지.
- 저장 재시도: 유효한 객체를 재사용할 때 Provider 호출 횟수는 늘지 않고, 제안은 한 건만 Commit되는지.
- 중단 복구: 같은 PostgreSQL을 유지하고 Application을 다시 시작했을 때 작업 기록·시도 횟수·제안을 확인해 정한 규칙으로 재개하는지.

Test Double의 호출 횟수는 실제 Provider의 실행·요금 근거가 아니다. 실제 PostgreSQL Test의 Row와 Transaction 근거도 Browser 화면 관찰과 구분한다.

## 핵심 질문

1. 문의 접수의 `201`은 무엇이 완료됐다는 뜻이며, 무엇의 완료는 뜻하지 않는가?
2. Job과 Suggestion을 분리하면 제안이 없다는 사실 외에 무엇을 알 수 있는가?
3. Timeout이 발생해도 이전 AI 요청이 실행 중일 수 있는 이유는 무엇인가?
4. 재시도까지 끝냈을 때 `status=FAILED`, `failed_stage=SAVE`는 무엇을 뜻하는가?
5. 긴급도가 `UNDETERMINED`인 유효한 제안과 DB 저장 실패는 어떻게 다른가?
6. 총 시도 한도를 모두 사용한 뒤 오래 기다리면 횟수가 다시 생기는가?
7. 같은 Job의 제안이 1건이라는 사실로 Provider도 1회만 실행했다고 말할 수 있는가?
8. 검증된 응답이 메모리에 남아 있는 경우와 Process 재시작으로 사라진 경우에 저장 재시도 조건은 어떻게 달라지는가?
9. Suggestion 저장과 Job 완료 표시를 같은 Transaction에 두는 이유는 무엇인가?
10. 메모리 Queue에 작업을 넣는 것과 재시작 후 작업을 복구하는 것은 왜 다른가?
11. 출력 보완 요청은 전체 생성 횟수와 보완 횟수 중 어느 쪽에 포함되며, 한쪽 상한만 남아 있으면 계속 보완할 수 있는가?
12. 한 요청의 대기 한도와 Job 전체 처리 기한을 넘긴 경우에는 각각 어떤 작업을 더 할 수 있는가?
13. Job 등록 실패로 새 접수가 Rollback되는 경우와, 접수 Commit 뒤 Provider 실패에도 원문이 남는 경우는 왜 모순되지 않는가?
14. Job을 같은 Transaction에 저장했더라도 Worker의 재조회가 필요한 이유는 무엇인가?
15. 호출 예약 횟수와 Provider 실행 횟수는 왜 다를 수 있으며, 외부 호출을 DB Transaction 안에 넣어도 그 차이를 없애지 못하는 이유는 무엇인가?
16. Application 설정을 바꿔도 기존 Job의 정책 Snapshot을 유지하면 어떤 혼란을 막을 수 있는가?
17. 상한 5회에서 예약 횟수를 4에서 5로 Commit한 뒤 다섯 번째 요청을 보내는 것은 왜 한도 위반이 아닌가?
18. Row Lock을 얻는 것과 현재 Attempt를 교체할 권한을 얻는 것은 어떻게 다른가?
19. 예약 원장 INSERT가 실패했을 때 실행권 변경도 되돌려야 하는 이유는 무엇인가?
20. 결과 Transaction에서 `SUCCEEDED` UPDATE까지 실행했더라도 Rollback 뒤 `RUNNING`이 남는 이유는 무엇인가?
21. `(suggestion_id, category)`의 복합 Primary Key와 Foreign Key는 각각 무엇을 보장하며, 최소 분류 한 건까지 보장하는가?
22. Commit 응답을 받지 못했을 때 AI를 다시 호출하기 전에 같은 Job의 결과를 확인해야 하는 이유는 무엇인가?
23. Worker의 SDK 메서드 호출은 한 번인데 Model 생성 HTTP 요청은 세 번일 수 있는 이유는 무엇인가?
24. 우리 Server의 SDK 재전송과 AI 제공자 Server 내부 재처리를 같은 횟수로 기록하면 어떤 문제가 생기는가?
25. 로그 기록과 호출 예약은 각각 언제 무엇을 확인하거나 제한하는가?
26. 일시적인 Rate Limit과 크레딧 부족이 같은 `429`여도 재시도 조건은 왜 다른가?
27. `Retry-After: 15`와 Application Backoff 5초가 함께 적용될 때 최소 대기는 얼마이며, 대기 뒤에도 무엇을 다시 확인해야 하는가?
28. Rate Limit 재시도는 전체 생성 횟수와 출력 보완 횟수에 각각 어떻게 반영되는가?
29. Worker가 매초 DB를 확인해도 재시도 시각 전에는 새 Provider 요청이 없는 이유는 무엇인가?
30. 최종 `FAILED`를 일반 자동 처리 대상에서 제외하는 것과 한 번의 요청 실패를 재시도하는 것은 어떻게 다른가?
31. 저장 여부의 조회가 실패했을 때 저장 시도를 늘리거나 곧바로 INSERT를 다시 보내면 안 되는 이유는 무엇인가?

입력·출력·권한·화면 표시의 검증은 [AI 제안의 신뢰 경계와 검증 근거](./ai-suggestion-trust-boundaries.md)를 참고한다.
