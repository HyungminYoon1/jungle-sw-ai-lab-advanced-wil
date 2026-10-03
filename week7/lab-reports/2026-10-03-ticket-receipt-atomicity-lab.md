# Ticket과 최초 Message 및 Job의 접수 원자성

> 실행일: 2026-10-03
> 주차: Week 7
> 근거: 실제 PostgreSQL Testcontainers와 Spring 접수 Service
> 상태: 접수 저장 실습 완료. HTTP 연결과 자동 AI 처리는 후속 단계

## 확인한 질문

Ticket 저장은 성공했지만 최초 Message나 Job 저장이 실패한다면, 실패한 접수의 Ticket이 DB에 남아도 될까? 이번 접수에서는 세 Row가 함께 저장되거나 함께 취소돼야 한다고 예상했다. 실제 PostgreSQL에서 앞선 INSERT 성공을 확인한 뒤 다음 저장을 실패시켜 이 경계를 검증했다.

코드 초안과 테스트 구성·실행은 Codex가 담당했다. 나는 문답에서 접수 Transaction과 이후 AI 처리의 분리, 현재 Attempt의 실행권과 호출 한도의 의미를 검토했다. 새 Java 코드의 독립 설명과 직접 수정은 다음 학습에서 확인한다.

## 구현 범위

기존 V1을 수정하지 않고 V2로 `ticket_messages`와 `ai_suggestion_jobs`를 추가했다. Message의 `ticket_id`와 Job의 `input_message_id`에는 Foreign Key를 두었다. 같은 Message의 초기 Job은 Unique Constraint로 최대 한 건만 등록한다. Message의 Ticket 조회 경계에는 Index를 추가했지만 성능 비교는 이번 실험에 포함하지 않았다.

새 `TicketReceiptApplicationService`는 `postgres` Profile에서 다음 저장을 한 Transaction으로 묶는다.

```java
@Transactional
public TicketReceiptResult receive(
        String title, String body, String authenticatedAuthorUsername) {
    Ticket ticket = new Ticket(title);
    TicketMessage message = new TicketMessage(body, authenticatedAuthorUsername);

    long ticketId = tickets.save(ticket);
    long messageId = messages.save(ticketId, message);
    long jobId = jobs.enqueue(messageId);

    return new TicketReceiptResult(
            new TicketResult(ticketId, ticket.title(), ticket.status()),
            messageId, jobId);
}
```

이 코드는 세 INSERT를 순서대로 실행한다. Spring이 관리하는 Service를 Proxy를 통해 호출하면 Transaction 처리가 적용된다. 이 실험처럼 바깥 Transaction 없이 호출한 경우, 메서드 본문이 정상 반환한 뒤 Commit이 성공해야 호출자에게 결과가 전달된다. JDBC 저장 실패의 Runtime Exception이 호출 밖으로 전달되면 앞선 저장도 Rollback한다. [Spring의 Transaction 설명](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)

기존 Controller는 여전히 제목만 받는 기존 Service를 사용한다. 새 접수 Service의 성공을 실제 `POST`의 세 Row 저장·`201` 검증으로 기록하지 않는다. Worker·Provider·Suggestion은 이 Service에 연결하지 않았다.

## 실제 실패를 만드는 방법

Test는 저장을 In-memory로 대체하지 않는다. 실제 JDBC Repository를 호출하는 기록용 Wrapper가 정상 반환한 저장 횟수만 센다. 그 뒤 테스트 전용 DB에 임시 `CHECK (false)`를 추가해 Message 또는 Job의 실제 INSERT를 실패시킨다. 각 Case가 끝나면 임시 Constraint를 제거한다.

예를 들어 Ticket 저장의 성공 횟수가 1이면 실제 INSERT가 ID를 반환한 것이다. 이후 Message INSERT에서 실패했을 때 최종 Ticket Row가 0건이라면, 처음부터 저장하지 않은 것이 아니라 앞선 저장까지 Rollback한 것으로 구분할 수 있다. 이 Java 기록용 Counter는 DB Transaction의 대상이 아니므로 DB Rollback 뒤에도 1로 남는다.

테스트 메서드 자체에는 `@Transactional`을 붙이지 않았다. Service의 실패 처리와 Transaction 종료가 끝난 뒤 새 조회로 Row 수를 확인한다. 정리 SQL은 접속 대상이 해당 일회용 Testcontainer인지 확인한 뒤 실행한다.

## 결과

| Case | 실제 저장 성공 관찰 | Transaction 종료 뒤 Row |
|---|---|---|
| 정상 접수 | Ticket·Message INSERT가 정상 반환하고 Job ID도 수신 | Ticket 1·Message 1·PENDING Job 1 |
| Message INSERT의 DB Constraint 실패 | Ticket 저장 1회 성공 | Ticket 0·Message 0·Job 0 |
| Job INSERT의 DB Constraint 실패 | Ticket·Message 저장 각각 1회 성공 | Ticket 0·Message 0·Job 0 |
| 공백 본문 또는 작성자 부재 | INSERT 전 Domain 검증 실패 | 세 Table 모두 0건 |
| 같은 Message로 두 번째 Job 등록 | Unique Constraint 위반 | 기존 세 Row 각 1건 유지 |
| 존재하지 않는 Ticket·Message 참조 | Foreign Key 위반 | 새 Row 없음 |
| V1에 Row 생성 후 V2 적용 | 기존 ID로 제목·IN_PROGRESS 조회 | 기존 Ticket 유지·Message 0·Job 0 |

`TicketReceiptIntegrationTest`의 14개 Case와 `TicketReceiptMigrationIntegrationTest` 1개, 총 **15개가 통과**했다. 전체 Java Clean Test는 **76개**, 기존 JavaScript 회귀는 **54개** 통과했고 실패·오류·건너뜀은 없었다. 이번 변경에서 기존 Browser E2E는 다시 실행하지 않았다.

## 단계별 선택과 남은 연결

- 기존 생성 Service에 HTTP 입력 변경까지 한 번에 넣는 안과 별도 접수 Service부터 검증하는 안 중 후자를 선택했다. 기존 흐름을 유지하면서 DB 저장 실패를 먼저 분리하기 위해서다. Controller의 새 Service 연결은 다음 단계다.
- 작성자는 `author_username`에 이름 Snapshot으로 저장한다. 사용자 영속 Table을 새로 만드는 대신 현재 단계의 저장 형태를 정한 것이며, 권한이나 소유권의 근거로 쓰지 않는다. Test는 합성 이름만 전달했다. 실제 인증 결과와 작성자의 연결은 아직 검증하지 않았다.
- 본문은 trim·절단·AI 보완 없이 그대로 저장한다. 이번 Application 검증은 null·공백 입력 거부이며, 초안의 2,000자 상한은 확정·구현하지 않았다. PostgreSQL의 `btrim()`은 기본 공백 문자 검사로 Application의 `isBlank()`와 동일한 범위가 아니다.
- V2의 Job은 `PENDING`만 허용한다. 현재 Attempt·호출 예약·유효 기한·다른 작업 상태는 Worker 구현 시 별도 Migration으로 추가한다. 같은 Message의 Unique는 초기 Job 중복 등록을 막지만 외부 AI의 중복 실행까지 막는 장치는 아니다.
- 기존 Ticket에는 없는 Message를 만들지 않는다. V1에서 V2로 실제 Migration을 수행해 기존 제목과 상태가 유지되는지 확인했다.

다음 실습에서는 접수 입력과 Server 인증 작성자를 연결한 뒤, 이미 Commit된 입력의 AI 처리와 결과 저장으로 진행한다. 고정 Dataset 평가·Guardrail·Security·Browser·중단 복구도 Week 7의 남은 과업이다.

## 재현

Helpdesk Lab에서 Docker Engine과 JDK 25를 사용할 수 있어야 한다. DB는 `postgres:17.6-alpine` 일회용 Testcontainer로 실행한다.

```powershell
.\mvnw.cmd "-Dtest=TicketReceiptIntegrationTest,TicketReceiptMigrationIntegrationTest" test
.\mvnw.cmd clean test
node --test src/test/js/ticket-ui.test.mjs src/test/js/week7-openai-pilot.test.mjs src/test/js/week7-ai-evaluation.test.mjs src/test/js/week7-tool-calling-spike.test.mjs
```

이 명령은 유료 AI를 호출하지 않는다. Testcontainer는 테스트 종료 시 정리되며 실제 Local Runtime DB를 대상으로 하지 않는다.

## 참고 자료

- [PostgreSQL Foreign Key와 Unique Constraint](https://www.postgresql.org/docs/17/ddl-constraints.html)
- [Spring Transaction의 적용과 기본 Rollback 규칙](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html)
- [Flyway의 Target Version](https://documentation.red-gate.com/fd/flyway-target-setting-277579044.html)
