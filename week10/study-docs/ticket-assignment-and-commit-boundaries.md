# 배정과 인계의 코드 읽기: 버전, Commit, 재확인과 권한 회수

> 작성일: 2026-10-24
> 코드 기준: Lab 로컬 Commit 2c8477a / Flyway V10
> 읽는 순서: 먼저 1절만 읽고, 필요할 때 나머지 절의 코드와 사례를 확인하면 된다.
> 목적: 실시간 문답 없이도 합의한 설계와 구현을 다시 이해하기 위한 자료. 새로운 구현이나 실행 결과는 아님

[확정 설계](../ticket-assignment-contract-draft.md)는 계약을, 이 문서는 그 계약이 필요한 이유와 코드의 읽는 순서를 설명한다. 실제 답변 및 미확인 부분은 [24일 학습 기록](../study-notes/2026-10-24-study-questions.md)에 따로 남겼다.

## 1. 먼저 읽을 핵심

- 담당자 ID는 '누가 담당하는가', 배정 버전은 '몇 번째 배정 상태인가'다. 같은 사람에게 돌아와도 같은 배정 상태는 아니다.
- DB 잠금은 저장 요청끼리의 순서를 정한다. 배정 버전은 오래된 화면에서 온 요청을 구분한다.
- Ticket의 현재 배정과 배정 이력은 같은 Transaction으로 확정한다. 기존에 접수한 문의는 이 Transaction의 실패로 없어지지 않는다.
- 새 요청은 현재 담당자와 버전을 검사한다. 이미 성공한 동일 제출의 재확인은 현재 서비스 조회 권한과 원래 제출 내용을 검사한다.
- 응답의 event는 과거 제출의 결과, assignment는 이번 요청에서 읽은 현재 배정이다. 화면의 현재 담당자는 assignment로 표시한다.
- 오류 응답이나 연결 끊김이 곧 Rollback 증거는 아니다. 결과를 모르면 같은 UUID와 원래 내용으로 DB 결과를 재확인한다.
- 직원 권한 회수는 DB Commit으로 확정한다. 기존 Session, Browser의 버튼이나 관리 측의 클릭만으로 현재 권한을 판단하지 않는다.

## 2. 이름이 비슷한 네 값을 구분하기

| 값 | 저장 또는 전달 위치 | 답하는 질문 |
|---|---|---|
| assignee_user_id | tickets | 현재 담당자가 누구인가? |
| assignment_version | tickets | 현재 배정은 몇 번째 상태인가? |
| expectedAssignmentVersion | Browser의 변경 요청 | 사용자가 어떤 배정 상태를 보고 제출했는가? |
| reply_assignment_version | ticket_messages | 이 답변을 저장할 때 유효했던 배정 버전은 무엇인가? |

clientRequestId(UUID)는 배정 버전과 또 다르다. 버전은 업무 상태를, UUID는 같은 사용자가 보낸 한 번의 제출을 식별한다. Worker의 Attempt나 Image 버전과도 관계없다.

```text
미배정, 버전 0
  → A가 담당하기를 Commit: A 담당, 버전 1
  → A에서 B로 인계 Commit: B 담당, 버전 2
  → B에서 A로 인계 Commit: A 담당, 버전 3
```

A가 버전 1에서 작성하던 초안은 마지막 상태에서도 오래된 초안이다. 담당자 ID만 비교하면 중간의 두 인계를 놓친다. 새 답변이므로 예상 버전 1과 현재 버전 3의 차이를 검사해야 한다.

조회, 답변 등록, 같은 제출의 재확인은 배정 버전을 증가시키지 않는다. 신규 배정 변경이 성공적으로 Commit될 때만 현재 배정 버전이 증가한다. 확인된 Rollback이면 새 버전도 남지 않는다. DB Sequence의 결번은 성공한 업무 횟수가 아니다.

## 3. 코드에서 따라갈 위치

아래 경로는 ai-helpdesk-learning-lab 저장소 내부 기준이다. 줄 번호는 변경될 수 있으므로 메서드 이름을 함께 찾는다.

| 코드 경로 | 읽을 지점 |
|---|---|
| src/main/java/lab/helpdesk/support/TicketAssignmentService.java | claim(), transfer(), private change() |
| src/main/java/lab/helpdesk/support/JdbcSupportRepository.java | ticket(), members(), submission(), change(), append() |
| src/main/java/lab/helpdesk/support/SupportAccess.java | staff(), optionalMember() |
| src/main/java/lab/helpdesk/support/web/TicketAssignmentController.java | claim(), transfer(), changed() |
| src/main/java/lab/helpdesk/ticket/application/TicketConversationService.java | reply(), replay() |
| src/main/resources/db/migration/V10__add_service_scoped_assignments.sql | 배정 상태, 같은 서비스 FK, 제출 UUID와 결과 버전 Unique |
| src/main/resources/static/assignment-ui.mjs | pending.body 보존, change-saved, saved-refresh-failed |
| src/main/resources/static/conversation-ui.mjs | pending, draftVersion, unknown-outcome |

담당하기와 인계의 핵심 저장 순서는 다음과 같다. 실제 코드에는 중간의 입력, 권한과 재확인 검사가 더 있다.

```java
var ticket = access.ticket(ticketId, true);
// 현재 서비스 권한 및 기존 제출의 동일 여부 검사
if (expected != ticket.version())
    throw new SupportException(ASSIGNMENT_VERSION_CONFLICT);
// 미배정 또는 인계 주체/대상의 자격 검사
repository.change(ticket, to);
var event = repository.append(ticket, actorId, request, type, to, reason);
```

true는 Ticket을 SELECT FOR UPDATE로 읽는다는 뜻이다. 이후 같은 Ticket을 변경하는 요청은 기다린다. Repository의 UPDATE는 담당자를 변경하면서 assignment_version을 1 증가시키고, 읽어둔 버전과 일치하는 Row만 변경한다. 이벤트 INSERT도 같은 Transaction에 참여한다.

잠금은 답변을 작성하는 수분 또는 수시간 동안 유지하지 않는다. 서버가 요청을 받아 DB를 검사하고 저장하는 짧은 구간에만 유지한다. 이 구간에서 외부 AI나 알림 API를 호출하지 않는다.

## 4. Commit은 어디서 일어나는가?

현재 HTTP 경로는 Controller가 Spring이 관리하는 Service를 외부에서 호출하는 구조다.

```text
Controller
  → Spring Transaction 처리: 시작
    → Service 본문: 잠금, 검증, UPDATE, INSERT, 결과 객체 반환
  → Spring Transaction 처리: Commit
  → Controller: 성공 결과를 받아 201 또는 200 응답 작성
  → Browser: 응답을 받을 수도, 연결이 끊겨 못 받을 수도 있음
```

public claim()/transfer()의 @Transactional이 경계다. 그 안의 private change()는 이미 시작한 Transaction에서 동작한다. private 메서드 호출마다 별도 Transaction을 만드는 것은 아니다. 다른 호출 경로에서 기존 Transaction에 참여하면 그 바깥 Transaction의 종료가 최종 경계이므로, '메서드 return은 언제나 Commit 완료'라고 일반화하지 않는다.

이 세 상황을 나눠야 한다.

| 관찰한 사실 | 판단 |
|---|---|
| INSERT/UPDATE 실행 성공 | 같은 Transaction의 코드에서는 결과를 볼 수 있지만 Commit 성공 증거는 아님 |
| 제약 위반 등으로 Commit 거부와 Rollback 확인 | 이번 새 배정/이력 또는 새 답변은 취소. 이미 Commit된 문의와 AI 결과는 유지 |
| Commit ACK 또는 HTTP 응답 유실 | 성공/실패를 단정할 수 없음. 같은 제출로 DB 결과를 확인 |

기존 Commit 실패 Test는 의도적으로 거부된 Transaction의 Rollback을 확인한다. 모든 연결 장애가 같은 결과라는 증거는 아니다. HTTP 5xx도 '저장 Row는 0건'이라는 뜻으로 해석하지 않는다.

## 5. 과거 제출 재확인과 현재 배정

다음은 서로 다른 인계 세 번이 이미 Commit된 예다.

```text
A 담당, 버전 1
  → A가 B에게 인계: B 담당, 버전 2 (A의 응답만 유실)
  → B가 C에게 인계: C 담당, 버전 3
  → C가 D에게 인계: D 담당, 버전 4
```

A가 첫 제출을 다시 확인할 때는 원래 UUID, 예상 버전 1, 대상 B와 같은 사유를 그대로 보낸다. 현재 버전 4로 원래 제출을 고쳐 보내지 않는다.

서버는 현재 서비스 권한 확인 뒤 같은 Ticket/Actor/UUID의 이벤트를 찾는다. 존재하면 종류, 원래 예상 버전, 대상과 사유를 비교한다. 동일하면 UPDATE/INSERT로 내려가지 않고 저장 결과를 반환한다.

```java
return new Change(event, assignment(ticket, member), false);
```

false는 새 변경을 만들지 않았다는 뜻이다. Controller는 200을 반환한다. 아래는 실제 응답 전체가 아니라 핵심 필드만 발췌한 예다. B는 ID 42, D는 ID 44다.

```json
{
  "event": { "toAgentId": 42, "assignmentVersion": 2 },
  "assignment": { "assigneeAgentId": 44, "version": 4 }
}
```

event는 'A의 그 제출로 B에게 인계한 적 있다'는 결과다. assignment는 '이번 요청에서 읽은 현재 담당자는 D'라는 정보다. 과거 이벤트를 조회해도 이후의 인계를 취소하지 않는다. 새 이력은 0건이고 배정 버전도 증가하지 않는다.

같은 UUID에서 예상 버전만 1에서 4로 바꾸면 원래 제출과 달라 409 ASSIGNMENT_REQUEST_CONFLICT다. 최신 DB 조회와 원래 제출의 재확인은 별도다. 이 재확인은 현재 서비스 조회 권한이 남아 있는 원래 Actor에게만 허용한다.

## 6. 인계와 공식 답변이 겹치는 경우

TicketConversationService.reply()도 같은 Ticket을 FOR UPDATE로 잠근다. 기존 제출 조회는 현재 담당자 검사보다 앞에 있지만, 서비스 권한과 고객 등록자 확인 뒤에 있다.

```java
var existing = repository.submission(ticketId, author, requestId);
if (existing.isPresent())
    return replay(existing.get(), body, correction, expectedVersion);

// 신규 답변의 필수값 검사 후
if (!Objects.equals(scope.assigneeAgentId(), author))
    throw new SupportException(SupportException.Code.NOT_ASSIGNEE);
if (scope.version() != expectedVersion)
    throw new SupportException(SupportException.Code.ASSIGNMENT_VERSION_CONFLICT);
```

| 순서 | 결과 |
|---|---|
| A의 답변 Commit 후 B에게 인계 Commit | A의 답변은 저장 당시 버전 1로 유지. 현재 담당자는 B, 배정 버전 2 |
| B에게 인계 Commit 후 A가 새 UUID로 답변 제출 | 현재 담당자가 아니므로 먼저 403 NOT_ASSIGNEE. 새 답변 0건 |
| 위 인계 뒤 A가 버전 1에서 이미 Commit한 동일 답변을 재확인 | 현재 서비스 조회 권한과 원래 내용이 같으면 200. 추가 답변 0건 |
| A→B→A 뒤 A가 버전 1의 새 초안 제출 | 현재 담당자는 맞지만 버전 3과 달라 409 ASSIGNMENT_VERSION_CONFLICT |

답변은 배정 버전을 증가시키지 않고 그때의 버전을 reply_assignment_version에 기록한다. 과거 답변의 작성자, 본문과 정정 참조를 새 담당자에게 맞춰 덮어쓰지 않는다. 구형 답변의 NULL 버전은 이미 저장된 동일 결과를 재확인하는 경우에만 허용한다. 새 답변에 가짜 0 또는 1을 넣어 구형 기록을 메우지 않는다.

## 7. 권한 회수: 요청 시각과 확정 시각

이 절은 오늘 실시간 문답에서 아직 답하지 않은 부분이다. 아래 정답과 설명은 Codex가 정리한 학습 자료이지, 사용자가 이미 설명했다는 기록은 아니다.

서비스 권한은 support_service_memberships.active에서 확인한다. 기존 Session에 ROLE_AGENT가 남아 있어도 DB의 해당 서비스 권한이 inactive면 직원 요청을 허용하지 않는다. 전체 계정 로그인 정지나 Session 삭제와는 다르다.

답변 요청은 구성원 Row를 SELECT ... FOR SHARE로 잠그고 active를 검사한다. 여러 공유 잠금은 함께 유지할 수 있지만 해당 Row를 회수하는 별도 UPDATE와는 충돌한다. 현재 공개 권한 관리 API는 없으며 회수 SQL은 Test/관리 절차에서 다룬다.

### 경우 A: 답변의 권한 확인이 먼저

```text
답변 Transaction: active=true 확인, 공유 잠금 보유
회수 Transaction: active=false UPDATE 시도 → 잠금 대기
답변 Transaction: 답변 Commit, 잠금 해제
회수 Transaction: UPDATE 진행, Commit → 회수 확정
```

회수 요청을 했다는 사실만으로 회수가 끝난 것은 아니다. 위 순서라면 A의 답변이 먼저 정상 Commit될 수 있다. 이미 끝난 Transaction이나 전송 중인 응답을 소급 취소하는 기능은 아니다.

### 경우 B: 회수 UPDATE가 먼저

```text
회수 Transaction: active=false UPDATE, 아직 미확정
답변 Transaction: FOR SHARE 조회 시도 → 잠금 대기
회수 Transaction: Commit
답변 Transaction: inactive 확인 → 거부, 새 답변 없음
```

만약 회수 쪽이 Commit 대신 Rollback했다면 미확정 inactive는 취소된다. 다른 조건이 유효하고 대기 제한도 넘기지 않았다면, 그 뒤 읽은 active=true를 근거로 처리한다. 단순히 회수 시도가 있었다는 이유로 허용/거부를 추측하지 않는다.

회수 Commit은 기존 Ticket의 담당자를 자동으로 NULL로 바꾸거나 배정 버전을 올리지 않는다. 과거 이력도 남는다. 서비스 지원관리자가 남은 업무를 다른 활성 직원에게 명시적으로 인계한다.

### 매번 권한을 확인하면 느리지 않은가?

추가 DB 조회와 잠금 비용은 있다. 인계의 구성원 조회는 해당 서비스의 Actor/대상 최대 두 명을 찾으며 (service_id, user_id) 기본키 Index가 있다. 그러나 Index 정의만으로 실제 지연이나 실행 계획을 측정했다고 할 수 없다.

권한 검사는 매 요청 필요하지만 모든 설계에서 반드시 DB를 매번 읽어야 하는 것은 아니다. 현재는 회수 직후 새 요청을 거부하는 계약을 단순하게 지키기 위해 DB를 확인한다. TTL만 둔 캐시는 회수 후에도 과거 허용값을 사용할 수 있어 그대로 대체하지 않는다. 성능이 문제라면 중복 조회, 실제 실행 계획, DB 왕복과 잠금 대기를 측정하고 무효화까지 포함한 설계를 검토한다. 이번에 캐시나 운영 권한을 변경하지 않았다.

## 8. 화면은 언제 무엇을 다시 요청하는가?

- POST의 201/200과 유효 결과로 저장을 확인한 뒤 GET만 실패하면 GET을 다시 요청한다.
- POST 결과 자체를 모르면 원래 UUID/예상 버전/본문 또는 대상/사유를 유지해 명시적으로 재확인한다.
- 결과 미확인 제출을 새 UUID나 최신 배정 버전으로 자동 교체하지 않는다.
- Ticket이나 조회 순번이 바뀐 뒤 도착한 오래된 응답은 화면에 반영하지 않는다. 이미 Commit된 DB 결과는 그대로다.
- canReply와 canTransfer는 화면 안내다. 서버는 쓰기 때 권한과 최신 배정을 다시 검사한다.
- 현재 제출은 메모리에만 있다. 페이지 이동/새로고침으로 키를 잃은 경우의 자동 복구는 구현하지 않았다. 본문/키/인증값을 임의로 Local Storage에 보관하는 변경도 하지 않는다.

## 9. 스스로 확인하기: 정답 포함

| 문제 | 정답과 이유 |
|---|---|
| 미배정 버전 0을 본 A/B 중 A가 먼저 Commit했다. 이후 B가 잠금을 얻었다 | B의 예상 0과 DB 1이 달라 새 배정은 충돌. 잠금을 얻었다는 것만으로 변경 자격이 생기지 않음 |
| 배정 UPDATE 뒤 이벤트 INSERT가 거부되고 Rollback이 확인됐다 | 이전 배정/버전 유지. 이미 Commit된 원문과 AI 데이터는 유지 |
| A→B의 과거 이벤트는 버전 2, 현재 D 담당 버전 4다 | event는 B/2, assignment는 D/4. 동일 재확인은 200, 새 이력 0건 |
| 새 답변의 현재 담당자는 B인데 A가 저장한다 | NOT_ASSIGNEE 검사에서 거부. 기존 동일 제출의 재확인과 구분 |
| 답변이 권한 공유 잠금을 먼저 얻고 회수 UPDATE는 기다린다 | 회수는 아직 확정 전. 답변이 먼저 Commit될 수 있음 |
| 회수 UPDATE가 먼저였지만 Rollback했다 | 회수 완료로 보지 않음. 이후 실제 권한과 다른 조건으로 판단 |

마지막 두 정답은 문서 설명으로 제공했다. 아직 사용자의 독립 답변으로 검증하지 않았다. 지금 추가 질문에 답하거나 이 문서를 한 번에 끝낼 필요는 없다.

## 10. 설계 완료와 실서비스 완료는 다르다

배정/인계의 Schema, API, 권한, 버전/UUID, 잠금/Commit과 화면 실패 경계는 확정했다. 현재 접수는 서버가 설정한 한 서비스로 연결하며 여러 제품의 고객 인증/접수 라우팅은 후속이다. 개인별 계정 수명, 고객 후속 메시지, 민감 내부 문의 ACL, 보관/삭제, 알림과 실제 운영 인수까지 완료한 것은 아니다.

기존 Java 1,068건과 패키징 후 2건, Node 331건 및 Browser 결과는 [실행 보고서](../lab-reports/2026-10-24-ticket-assignment-lab.md)에 있다. 이번 문서화로 새 Test, 부하 측정 또는 Commit ACK 유실 장애 실험을 수행했다고 하지 않는다. 업무 코드와 DB Schema, AWS 및 실제 AI 호출은 변경하지 않았다.

### 공식 자료를 더 읽고 싶을 때

- [Spring의 @Transactional 및 Proxy 설명](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html): 외부 호출과 Transaction 경계를 확인할 때 참고
- [PostgreSQL 17 Row-Level Locks](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS): FOR UPDATE, FOR SHARE와 잠금 충돌 확인
- [PostgreSQL 17 오류 코드](https://www.postgresql.org/docs/17/errcodes-appendix.html): 실패 종류와 결과 미확인을 구분할 때 참고. 08007 이름이 있다는 것이 모든 연결 장애에서 그 코드가 반환된다는 뜻은 아님

공식 자료는 동작 원리를 설명하고, 우리 정책과 실제 호출 순서는 고정한 Lab 코드 및 확정 설계로 확인한다.
