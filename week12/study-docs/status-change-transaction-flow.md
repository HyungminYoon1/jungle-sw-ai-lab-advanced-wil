# 상태 변경은 무엇을 함께 저장하는가

> 기준: 2026-11-04 T05 설명 보충
> 상태: T01~T08 합의 뒤 V13/Service/API/화면을 로컬 구현했다. 1~7절의 값은 설명용 가상 예시이며, 실제 코드와 검증은 8절 및 실행 보고서로 구분
> 관련 정책: [T05/T06](../../week11/customer-followup-policy-review.md#4-상태-변경-api-전에-정할-정책), [실제 문답](../study-notes/2026-11-04-study-questions.md)

## 1 먼저 무엇을 저장하는가

상태 변경에는 현재 상태와 변경 이력이라는 두 정보가 있다.

| 저장 대상 | 역할 | 이번 예시 |
|---|---|---|
| 기존 Ticket Row의 현재 상태/상태 버전 | 지금 이 문의가 어디까지 처리됐는지 조회 | IN_PROGRESS/3을 RESOLVED/4로 수정 |
| 별도 상태 변경 이력 Row | 누가 무엇을 근거로 어떤 상태를 변경했는지 기록 | 담당자 A의 해결 처리 한 건 추가 |

문의 42는 이미 접수돼 Commit된 상태다. 담당자는 A, 배정 버전은 2라고 가정한다. 관련 공식 답변 82번도 이미 별도로 Commit됐다. 고객 글은 70번까지 있고 A가 그 범위를 명시적으로 확인했으며, 더 최신 글은 없다고 가정한다.

새 요청의 UUID는 설명용으로 K라고 부른다. 실제 요청에는 유효한 UUID가 필요하다. 이 예시는 구현 전에 작성했다. 이후 V13에 상태 버전과 이력을 추가했지만 문의 42/답변 82/고객 글 70은 실제 실행 결과가 아니다.

## 2 Service에서 처리하는 순서

Browser는 문의 42의 해결 요청과 자신이 본 배정 버전 2/상태 버전 3, 선택한 고객 범위 70, 관련 답변과 사유, UUID K를 보낸다고 가정한다. 작성자 신원은 기존 원칙대로 서버의 인증 정보에서 정한다.

Service의 하나의 DB Transaction에서 다음 순서로 처리하는 안이다.

1. Ticket Row를 잠그고 현재 자료를 읽는다. 요청자의 조회 권한을 확인한다.
2. 같은 Ticket/작성자/UUID의 저장된 제출이 있으면 내용을 비교한다. 같은 제출이면 기존 결과를 반환하고, 다른 내용이면 충돌로 거부한다.
3. 새 제출이면 현재 담당자/서비스 권한, 배정 버전, 상태 버전, 허용 전이, 관련 답변과 고객 확인 범위를 검사한다. 새 고객 글이 먼저 Commit됐다면 T06에 따라 오래된 해결 요청을 거부한다.
4. Ticket의 상태를 RESOLVED, 상태 버전을 4로 UPDATE한다.
5. 상태 변경 이력을 INSERT한다. 이력에는 이전/이후 상태, 결과 버전, 인증된 Actor, 사유, 관련 공식 답변과 확인 범위, UUID 및 서버 시각을 남기는 안이다.
6. 두 쓰기를 함께 Commit한다. Transaction 경계를 정상적으로 마친 뒤 Controller가 저장 성공 응답을 만든다.

예시에서는 UPDATE 다음 INSERT로 설명했다. 두 작업은 같은 Transaction에 포함되며 이력만 별도로 Commit하지 않는다. Controller에서 DB를 직접 수정하거나 외부 AI 요청을 이 Transaction 안에 넣지 않는다.

## 3 성공하면 남는 결과

| 항목 | 처리 전 | Commit 후 |
|---|---|---|
| 현재 담당자 | A | A |
| 배정 버전 | 2 | 2 |
| 현재 상태 | IN_PROGRESS | RESOLVED |
| 상태 버전 | 3 | 4 |
| UUID K의 상태 변경 이력 | 없음 | 1건 |
| 기존 문의 원문/공식 답변 | 이미 저장됨 | 그대로 유지 |

상태 변경 이력에는 이번 변경이 IN_PROGRESS/3에서 RESOLVED/4로 진행됐다는 근거를 남긴다. 이후 재개돼 현재 상태가 달라져도 이 이력을 현재 상태로 덮어쓰지 않는다.

## 4 중간에 실패하면

Ticket UPDATE가 성공한 뒤 이력 INSERT가 실패해 Rollback됐다고 가정한다. 이때 최종 상태는 다음과 같다.

- 현재 상태는 IN_PROGRESS, 상태 버전은 3이다.
- UUID K의 상태 변경 이력은 0건이다.
- 이미 Commit된 Ticket 자체와 문의 원문, 공식 답변은 남는다.

UPDATE 한 문장의 성공은 전체 변경의 Commit 성공과 다르다. 상태 변경 이력은 Commit된 변경을 기록하는 자료이며, 실패 원인의 진단 Log와도 구분한다. 실패 진단의 보관/공개 범위는 별도 운영 정책이다.

Commit 결과를 받기 전에 DB 연결이 끊긴 경우에는 위처럼 Rollback을 확인한 것으로 단정하지 않는다. 원래 UUID와 요청 내용을 유지해 저장 여부를 확인해야 한다.

## 5 상태 버전과 배정 버전이 다른 이유

배정 버전은 책임 담당자의 변경을 구분한다. 상태 버전은 처리 상태의 변경을 구분한다. A가 계속 담당하는 동안 해결 후 재개되면 상태 버전은 4에서 5로 증가하고 배정 버전은 2를 유지하는 안이다.

예를 들어 IN_PROGRESS/3 → RESOLVED/4 → OPEN/5 → IN_PROGRESS/6으로 돌아왔어도 담당자가 A라면 배정 버전은 그대로일 수 있다. 상태 문자열이 같아졌다는 이유로 버전 3의 오래된 해결 요청을 현재 버전 6의 요청으로 받아들이지 않는다.

## 6 응답을 잃었다면

두 쓰기의 Commit은 끝났는데 Browser가 응답을 받지 못할 수 있다. UUID K와 원래 내용을 재전송했을 때 이미 같은 기록이 있으면 추가 이력이나 버전 증가 없이 기존 결과를 돌려주는 안이다. 처음 요청이 저장되지 않았다면 현재 조건을 다시 검사해 첫 저장을 할 수 있는지는 별도로 판단한다.

과거 K가 저장한 결과 버전이 4이고 현재는 다른 변경으로 6이라면 과거 이력 4와 현재 상태 6을 나누어 설명한다. 재확인했다고 현재 상태를 4로 되돌리지 않는다. 현재 조회 권한의 검사는 기존 결과 조회에도 필요하다.

## 7 기존 코드에서 볼 수 있는 같은 구조

Lab의 TicketAssignmentService는 public claim/transfer에 @Transactional을 적용하고, 내부 change에서 기존 제출/권한/버전을 검사한 뒤 repository.change와 repository.append를 호출한다. 현재 배정 갱신과 배정 이력을 함께 저장하는 기존 구조다. 이 자료를 처음 설명할 때 그 구조를 참고했으며 이후 추가한 실제 상태 Service는 8절에서 확인한다.

Service 메서드 본문의 return만으로 Commit 성공을 판정하지 않는다. Spring의 트랜잭션 처리가 적용되는 호출 경로와 예외의 Rollback 규칙도 확인해야 한다. Annotation을 붙였다는 사실만으로 실제 Commit/Rollback 검증을 대체하지 않는다. [Spring 트랜잭션 경계](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-decl-explained.html), [@Transactional](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html), [Rollback 규칙](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html)

상태 변경의 정확한 필드, 오류/응답 형태와 재확인 순서는 T01~T08 합의 후 Lab docs/ticket-status.md에 구체화했다. [실행 보고서](../lab-reports/2026-11-04-ticket-status.md)에서 실제 검증 범위와 한계를 확인한다.

## 8 구현한 코드와 연결하기

Lab의 src/main/java/lab/helpdesk/ticket/application/TicketStatusService.java가 저장 순서를 조정한다. Controller는 입력 해석과 응답 변환을 담당하고, Service가 권한/업무 조건을 검사한다. DB 접근은 TicketStatusRepository와 JDBC Adapter에 둔다.

공개 메서드 changeStaff에는 @Transactional이 있고 내부 change를 호출한다. 핵심 순서는 다음과 같다. 아래 코드는 순서 설명이며 전체 구현을 대신하지 않는다.

```text
Ticket 잠금 획득
→ 새 SQL로 현재 상태/최신 고객 글/현재 배정의 확인 범위 조회
→ 현재 조회 권한 검사
→ 같은 Ticket/작성자/UUID의 기존 제출 확인
→ 새 제출이면 담당자/배정 버전/상태 버전/전이 조건 검사
→ 해결이면 공식 답변/선택 고객 글/최신 글/명시적 확인 검사
→ Ticket의 상태와 상태 버전 UPDATE
→ ticket_status_events INSERT
→ 현재 상태를 다시 읽고 Service 반환
→ 트랜잭션 Commit 성공 후 Controller가 201 반환
```

잠금을 기다렸던 SQL 문장 자체의 조회 결과에 의존하지 않고, 잠금을 얻은 뒤 새 SQL로 읽는다. 기다리는 동안 먼저 끝난 고객 글의 Commit을 보고 오래된 해결 요청을 거부하기 위해서다. 외부 AI나 네트워크 호출은 이 Transaction 안에 없다.

이미 같은 제출이 저장됐다면 새 변경 조건 검사 전에 기존 이력을 반환한다. 이때도 현재 조회 권한과 원래 요청 내용의 일치는 먼저 검사한다. Service가 반환하는 change는 그 제출의 이력이고 current는 다시 읽은 현재 상태다. 과거 해결 이력이 상태 버전 2여도 현재가 재개된 OPEN/3이면 둘을 함께 반환하며 상태를 2로 되돌리지 않는다.

담당자 요청은 POST /api/tickets/{id}/status-changes로 보내며 선택한 배정 버전과 상태 버전을 모두 포함한다. 등록자 본인의 재개는 별도 POST /api/tickets/{id}/customer-status/reopen을 쓰고 상태 버전/UUID/사유만 보낸다. 고객에게 내부 배정 버전을 입력하게 하지 않으며 실제 작성자와 요청 범위는 서버에서 정한다.

V13의 기존 Row는 상태 버전 0에서 시작한다. 이는 이번 기능을 도입한 기준값이며 과거 업무가 없었다는 뜻도, 과거 변경 이력을 복원했다는 뜻도 아니다. V1~V12를 고치거나 이미 저장된 원문/AI 제안을 바꾸지 않았다.

## 9 화면에서 실패를 복구하는 순서

- 저장한 이력과 201을 받았는데 현재 상태 GET만 실패하면 '처리 상태 새로고침'으로 GET만 다시 보낸다. 새 상태 변경을 제출하지 않는다.
- POST 응답을 받지 못했다면 같은 UUID/사유/버전/근거를 그대로 재확인한다. 현재 상태가 같아 보인다는 것만으로 특정 제출의 저장을 확정하지 않는다.
- 서버가 정확한 오류 코드로 오래된 요청을 거부했다면 사용자가 명시적으로 초안을 비우고 현재 상태/대화를 읽은 뒤 다시 결정한다. 이 초기화 자체는 GET만 수행한다.
- 새 고객 글을 다른 창에서 확인해도 기존 해결 초안의 선택 대상을 자동으로 늘리지 않는다. 직접 새 글을 확인하고 다시 선택한다.

화면 상태 제어는 static/ticket-status-ui.mjs, DOM 연결은 static/ticket-status-page.mjs에 있다. 대화 제목에는 이전 대화 조회의 상태를 반복 표시하지 않는다. 별도 상태 영역에서 읽은 값과 저장된 과거 이력이 서로 다른 기준이라는 점을 유지한다.

이 설명과 테스트 통과는 Codex가 작성/실행한 구현 근거다. 사용자의 독립 구현이나 모든 실패 경계의 이해 완료와는 구분한다.

## 10 고객 글 번호와 상태 이력 번호를 구분하기

해결 요청의 throughCustomerMessageId는 이미 저장된 고객 글을 가리키는 외래 참조다. 고객 글 70번을 보고 해결하려다 71번이 추가됐다면, 새 글을 읽고 다시 결정한 요청은 기존 71번을 참조한다. 아직 없는 72번을 만들거나 고르는 것이 아니다. 해결 처리 자체는 새 고객 Message를 만들지 않는다.

| 값 | 의미 | 누가 정하는가 |
|---|---|---|
| throughCustomerMessageId | 해결 판단에 포함한 기존 고객 글의 마지막 ID | 담당자가 불러온 글 중 직접 선택하고 서버가 최신 글/확인을 검사 |
| ticket_status_events.id | 새 상태 변경 이력 자체의 식별자 | DB가 별도로 배정 |
| resulting_status_version | 이 Ticket의 이번 변경 후 상태 버전 | 서버가 현재 버전에서 1 증가 |
| clientRequestId | 이번 명령의 동일 제출 재확인 기준 | Browser가 생성하고 결과 미확인일 때 그대로 유지 |

이미 해결 이력과 재개 이력이 Commit돼 있는 경우, 같은 해결 UUID를 재확인하는 요청은 이력을 0건 추가한다. 앞서 저장된 이력 수와 이번 요청이 추가한 Row 수는 다른 질문이다. 현재 화면은 새로 읽은 OPEN을 유지하고 과거 해결은 저장된 이력으로만 표시한다.

## 11 현재 조회 권한과 새 변경 조건은 다르다

TicketStatusService.change는 잠금 뒤 현재 자료를 읽고 다음 순서로 처리한다. 아래는 조건의 순서를 줄인 설명이며 실제 코드의 전체 검사를 대신하지 않는다.

```text
현재 자료 읽기 → 현재 조회 권한 검사
→ 같은 작성자/문의/UUID의 제출 조회
→ 이미 저장됐다면 원래 내용 비교 후 과거 이력과 현재 상태 반환
→ 기록이 없으면 현재 담당자/배정 버전/상태 버전/전이와 해결 근거 검사
→ 새 상태와 새 이력 저장
```

기존 이력의 재확인도 조회이므로 현재 조회 권한은 필요하다. 같은 UUID가 있다는 이유만으로 회수된 직원 권한을 되살리지는 않는다. 반면 현재 담당자인지, 현재 상태에서 새 해결이 가능한지 등은 새 상태 변경에 적용하는 조건이다. 이를 기존 제출 조회보다 먼저 검사하면, 이미 저장된 응답을 잃은 사용자가 인계/재개 뒤 원래 결과를 확인하지 못할 수 있다.

상태 문자열과 상태 버전도 구분한다. 배정은 그대로인 채 IN_PROGRESS/1 → RESOLVED/2 → OPEN/3 → IN_PROGRESS/4가 됐다면, 아직 저장되지 않은 버전 1의 새 해결 요청은 현재 버전 4와 충돌한다. 문자열이 같다는 이유로 새 요청의 버전을 자동 교체하지 않는다.

화면의 canResolve=false는 그 응답을 만들 때 새 해결 조건을 충족하지 않았다는 뜻이다. 결과 미확인인 과거 제출이 이미 저장돼 있는지까지 알려주는 값은 아니다. 그 제출은 원래 UUID/버전/근거로 재확인한다. 서버는 현재 조회 권한과 내용의 일치를 검사하고, 이미 저장됐다면 추가 변경 없이 기존 결과를 반환한다. 기록이 없다면 현재의 새 변경 조건을 통과해야 첫 저장이 가능하다.

## 12 Service 본문의 return과 Controller가 결과를 받는 시점

현재 Controller는 Spring이 주입한 TicketStatusService를 호출한다. 아래는 TicketStatusController.change의 실제 Service 호출 부분이다.

```java
var result = service.changeStaff(ticketId,
        CreateTicketStatusChangeRequest.readStaff(body),
        AuthenticatedActorFactory.from(authentication));
```

호출된 공개 changeStaff에는 @Transactional이 있다. 현재 동기식 HTTP 처리에서는 Controller가 Service의 실제 객체를 곧바로 호출하는 대신, Spring의 트랜잭션 처리가 둘러싼 호출 경로를 통과한다. 이 역할을 하는 대리 객체를 프록시라고 한다. 관련 [Spring 공식 설명](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-decl-explained.html)은 메서드 호출 전후를 트랜잭션 인터셉터/매니저가 관리하는 구조를 설명한다.

현재 호출은 다음 순서로 이해한다. Controller에 별도 외부 Transaction이 없는 이 프로젝트의 경로를 설명하는 것이며 모든 전파 설정을 일반화한 설명은 아니다.

```text
Controller가 service.changeStaff(...) 호출
→ Spring의 트랜잭션 처리 시작
→ Service 본문: 검증/UPDATE/INSERT 후 결과 객체 반환
→ Spring의 Commit 시도
→ Commit 성공 후 Controller의 result가 결과를 받음
→ Controller가 created에 따라 201 또는 200 응답을 구성
→ 응답을 Browser에 전달
```

따라서 Service 본문에서 결과 객체를 return했다는 사실만으로 Controller의 호출이 정상 완료됐다고 판단하지 않는다. Commit이 실패해 예외가 전파되면 위 var result 대입은 정상 완료되지 않고, 그 아래 성공 응답을 만드는 코드도 실행되지 않는다. HTTP 성공을 먼저 반환해 놓고 나중에 Commit하는 구현이 아니다.

기존 TicketStatusHttpIntegrationTest의 deferred_commit_failure_never_returns_success_and_preserves_previous_rows는 이를 구체적으로 확인한다. 격리된 테스트 DB에 지연 검사되는 외래 키와 테스트용 Trigger를 두어 상태 이력 INSERT까지 진행한 뒤 Commit 시점에 실패시킨다. 500과 실행 전후 DB Snapshot 일치를 함께 검사한다. 앞선 실행에서 통과한 사례이며 이번 문답을 위해 다시 실행한 것은 아니다. 운영 DB에 이런 장치를 설치한 것도 아니다.

반대로 Commit은 성공했지만 이후 응답 생성/전달에 문제가 생길 수도 있다. 이는 앞의 테스트와 다른 가상 실패 경계다. Browser가 받은 500이나 끊긴 연결만으로 Rollback을 확정하지 않는다. 원래 UUID/버전/사유/근거로 재확인하고 이미 저장됐다면 기존 결과만 받는다. 확정된 성공 이후 현재 상태 GET만 실패한 경우에는 GET만 다시 보낸다.

## 13 Ticket 잠금과 버전은 무엇을 각각 보호하는가

현재 JdbcTicketStatusRepository.lock은 다음 SQL을 실행한다.

```sql
SELECT id FROM tickets WHERE id=? FOR UPDATE
```

Service는 잠금을 얻은 뒤 required(ticketId)의 새 SQL로 현재 상태/배정과 최신 고객 글/확인 범위를 읽는다. 고객 후속 글도 TicketConversationService.followUp에서 access.ticket(ticketId,true)를 호출한 뒤 Message를 저장한다. 같은 Ticket의 판단과 저장이 이 부모 Row를 기준으로 순서를 갖게 하는 기존 구조다.

이 Row Lock은 서버가 해당 Transaction을 처리하는 동안 유지한다. Browser에서 사람이 글을 읽거나 초안을 작성하는 동안 Transaction을 열어 두는 방식이 아니다. 또 Ticket Row의 잠금을 자식 테이블 전체에 일괄 잠금을 거는 것으로 해석하지 않는다. 관련 쓰기 Service가 같은 부모 잠금/검사 순서를 따르는지가 중요하며 외래 키에 따른 잠금은 별도 동작이다. [PostgreSQL 17 Row Lock 설명](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)

READ COMMITTED에서 다른 Transaction의 변경은 새 조회 명령이 시작하기 전에 Commit된 자료를 기준으로 읽는다. 따라서 잠금 대기 전에 읽은 값을 재사용하지 않고, 잠금을 얻은 뒤 새 조회로 앞선 고객 글의 Commit을 확인한다. [PostgreSQL 17 격리 수준 설명](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED)

| 검사 장치 | 현재 코드에서 구분하는 것 |
|---|---|
| Ticket Row Lock | 한 서버 Transaction의 검사/저장과 같은 Ticket의 관련 쓰기 순서 |
| expectedAssignmentVersion | 작성 당시와 현재 담당 배정의 차이 |
| expectedStatusVersion | 작성 당시와 현재 상태 변경 버전의 차이 |
| throughCustomerMessageId와 최신 고객 글/확인 범위 비교 | 해결 초안 뒤 새 고객 글이 추가됐는지와 그 범위를 명시적으로 확인했는지 |

상태 버전은 상태 변경만 세므로 고객 글이 추가됐다는 이유만으로 증가하지 않는다. 예를 들어 담당자가 IN_PROGRESS/상태 1에서 80번까지 고른 뒤 새 고객 글 81번이 먼저 Commit돼도 상태 버전은 1일 수 있다. 상태 버전 비교만으로는 오래된 해결 대상을 발견할 수 없으며 현재 최신 글/선택 대상과 확인 범위도 검사해야 한다.

반대로 해결이 먼저 Commit된 뒤 새 고객 글이 저장됐다면 해결 당시의 이력은 유지한다. 새 글은 보존하고 확인 필요로 표시하며 RESOLVED에서 OPEN으로의 재개는 별도 명시적 요청이다. 이는 이미 합의한 T06의 두 순서이며 새 정책을 추가한 것이 아니다.

기존 TicketStatusHttpIntegrationTest의 customer_commit_before_waiting_resolution_is_seen_by_a_fresh_post_lock_statement와 resolution_commit_before_waiting_message_preserves_the_original_response_snapshot가 두 순서의 실행 근거다. 현재 학습 자료 보완은 해당 소스와 공식 설명을 대조한 것이며 새로운 동시 실행/성능 측정 결과는 아니다.

## 14 고객 글과 공식 답변을 함께 저장할 때

TicketConversationService의 followUp과 reply는 모두 access.ticket(ticketId,true)로 같은 부모 Ticket의 잠금을 얻은 다음 Message를 INSERT한다. 고객 소유권과 직원의 현재 담당 권한은 각 경로에서 따로 검사한다. 공통 잠금은 두 작성자가 같은 사람이 된다는 뜻이 아니라, 같은 Ticket의 저장 순서를 조정하는 장치다.

고객 글을 먼저 저장하는 경우를 예로 들면 다음과 같다. 반대로 공식 답변이 먼저여도 같은 구조다.

| 순서 | 고객 글 Transaction | 공식 답변 Transaction | 별도 대화 조회에서 보이는 새 글 |
|---|---|---|---|
| 1 | Ticket 잠금 획득, INSERT 완료, 아직 Commit 전 | 아직 시작 전 | 없음 |
| 2 | 같은 잠금 유지 | Ticket의 FOR UPDATE에서 대기, 아직 INSERT 전 | 없음 |
| 3 | Commit 성공, 잠금 해제 | 잠금 획득 후 현재 권한/배정 검사와 INSERT | 고객 글 |
| 4 | 종료 | Commit 성공 | 고객 글과 공식 답변 |

11/4 추가 테스트는 정확한 두 DB 연결의 차단 관계를 확인하고 두 번째 INSERT가 호출되지 않았는지도 검사한다. 이미 INSERT를 시작한 뒤 다른 이유로 기다리는 것과 구분한다. 두 Commit 후 페이지를 나눠 읽어도 두 글이 모두 나타나는지 확인했다. [실행 결과와 필수 사례 대조](../lab-reports/2026-11-04-local-verification-audit.md#혼합-저장의-새-집중-실행)에 신규 두 사례/집중 28건의 근거를 기록했다.

이 설명은 같은 Ticket의 관련 쓰기 경로가 공통 잠금 순서를 지키는 현재 구현에 대한 것이다. 모든 Ticket의 Message ID가 전체 DB의 Commit 순서를 보장한다는 뜻은 아니다. ID는 다른 Ticket의 INSERT나 Rollback 등으로 건너뛸 수 있으므로 연속 번호를 전제로 대화를 조회하지 않는다.

## 15 최초 AI 제안과 현재 고객 상황을 연결해 읽기

다음은 실제 실행 결과가 아닌 학습용 사례다. Message 31은 최초 로그인 문의, Job 90의 input_message_id는 31이고 저장된 AI 우선순위는 NORMAL이라고 가정한다. 담당자가 답변하고 명시적으로 해결한 뒤 고객이 Message 61을 남겼다.

> 같은 로그인 오류가 다시 발생했습니다. 현재 20명이 작업하지 못하고 있으며 오늘 17시까지 마감해야 합니다.

새 고객 글을 Commit하면 대화와 고객의 최근 활동에 반영한다. 이미 합의한 계약에 따라 Ticket은 RESOLVED를 유지하고 현재 배정에는 확인 필요가 생긴다. 최초 원문과 Job 입력 31, 저장된 최초 AI 제안도 유지한다. 후속 글 저장으로 새 AI Job/예약/호출을 만들지 않는다.

따라서 NORMAL은 61번의 영향 인원과 마감 시각을 평가한 값이 아니다. 화면도 AI 요약/분류/우선순위가 최초 문의 기준이라고 안내한다. 담당자는 새 대화를 읽고 필요한 안내와 명시적 확인을 진행하며, 고객 또는 현재 담당자가 별도 재개 요청으로 OPEN 전환을 결정할 수 있다. 확인 버튼, 글 저장과 재개는 서로 다른 행동이다.

이는 이후 문의를 무시하자는 정책이 아니다. 초기 제안의 근거 범위를 정확히 표시하고 인간 담당자의 최신 사실 확인과 구분하는 설계다. 이후 대화의 AI 재평가와 공식 업무용 분류/우선순위 관리의 확장은 실사용 설계의 R08/R17 후속으로 남아 있다. 현재 기능만으로 이 두 확장을 구현했다고 설명하지 않는다.

확인한 질문은 두 가지다. 같은 Ticket에서 확인한 ID/저장 순서를 전체 DB의 보장으로 확대해도 되는가? 최초 문의의 NORMAL을 새 글의 긴급성 판단으로 사용해도 되는가? 사용자는 두 경우 모두 아니라고 답하고, 같은 Ticket의 범위와 담당자의 새 영향 인원/마감 확인을 정확히 설명했다. 이번 두 사례의 적용을 확인했으며 구현/테스트 통과와 독립 구현 능력은 구분한다.

## 16 최근 활동과 확인 필요를 구분해 목록 읽기

고객의 '내 문의 목록'은 공개 대화에 무엇이 새로 생겼는지 찾는 화면이다. 담당자 업무 목록의 '확인 필요'는 현재 배정에서 어떤 고객 글까지 명시적으로 확인했는지 보여준다. 같은 Ticket을 표시하지만 두 값의 목적과 계산 대상이 다르다.

실제 SQL의 Message 종류 조건을 발췌하면 다음과 같다. JdbcMyTicketsRepository는 위 조건에서 가장 큰 Message ID의 작성 시각을 lastActivityAt으로 읽고, JdbcSupportRepository.queue는 아래 조건으로 최신 고객 Message를 찾는다.

```sql
-- 고객 목록의 공개 활동
m.message_type IN ('INQUIRY','CUSTOMER_FOLLOWUP','OFFICIAL_REPLY')
-- 담당자 목록의 최신 고객 글
m.message_type IN ('INQUIRY','CUSTOMER_FOLLOWUP')
```

TicketAssignmentService.queue는 최신 고객 글이 있고, 현재 배정의 유효 확인 지점이 없거나 최신 고객 글보다 작으면 needsConfirmation을 true로 만든다. 공식 답변 작성이나 GET은 확인 기록을 추가하지 않는다. 다음은 배정이 유지되는 학습용 예시다.

| 순서 | 고객 목록의 최근 활동 | 최신 고객 글 | 유효 확인 지점 | 확인 필요 |
|---|---|---:|---:|---|
| 고객 글 80번, 10:00 작성. 이전 확인은 70번 | 10:00 | 80 | 70 | true |
| 담당자가 80번까지 명시적으로 확인 | 10:00 | 80 | 80 | false |
| 공식 답변 81번, 10:05 작성 | 10:05 | 80 | 80 | false |
| 고객 후속 글 82번, 10:10 작성 | 10:10 | 82 | 80 | true |

80번을 확인하지 않고 81번 공식 답변만 작성했다면 확인 필요는 계속 true다. 답변 작성과 명시적 확인은 별개이기 때문이다. 이 값들은 문의 해결 상태나 AI 성공 여부도 대신하지 않는다.

두 목록의 페이지 경계도 다르다. 고객 목록은 공개 활동 시각 내림차순이므로 새 글이 생긴 문의가 이전 Cursor보다 앞으로 이동할 수 있다. 담당자 목록은 Ticket ID 오름차순이며 SQL의 id > afterId로 다음 페이지를 읽는다. 이미 Ticket 100번까지 읽은 뒤 20번에 새 고객 글이 생겨도 Ticket ID는 20이다. afterId=100의 다음 페이지로는 그 변경을 발견할 수 없으므로 afterId=0부터 다시 조회한다. 이때 GET은 확인/해결/AI 처리를 실행하지 않는다.

따라서 hasMore=false는 그 조회 경계 뒤의 페이지 유무에 대한 응답이다. 현재 모든 문의를 확인했다거나 이후 새 활동이 없다는 보장은 아니다. Ticket ID 중복 제거도 이미 반환된 항목의 표시 중복을 줄일 뿐, 응답에 포함되지 않은 변경을 찾아주지는 않는다. 알림이나 업무 누락 방지 체계를 이미 구현한 것으로 설명하지 않는다.

이번에는 docs/my-tickets.md, 두 Repository의 관련 조회, TicketAssignmentService의 계산과 my-tickets-ui.mjs의 새로고침/합치기를 대조했다. 기존 MyTicketsHttpIntegrationTest의 이동한 문의/공개 활동 사례, AssignmentQueueConfirmationHttpIntegrationTest의 답변 제외/새 고객 글 사례와 JS 중복 제거 검사를 선택해 읽었다. 위 표와 Ticket 20/100은 설명용 예시이며 새 실행 결과가 아니다. 코드/Schema 변경이나 테스트 재실행은 없다.
