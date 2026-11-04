# 고객 후속 대화와 담당자 확인의 기술 계약 초안

> 작성일: 2026-11-03
> 상태: V11/V12와 11/4 직원 확인 화면의 로컬 PostgreSQL/Browser 및 전체 회귀 통과. 설계 선택의 학습 이해/운영 완료는 별도
> 설계 시작 기준: Lab 6eed98c, V10. 첫 저장 구현: 645b3df, V11
> 적용 범위: 로컬 PostgreSQL의 고객 후속 쓰기, 내 문의 목록, 담당자 확인과 기존 대화/업무 화면 보완

고객이 자신의 문의에 추가 내용을 남기고 담당자가 확인한 범위를 기록하는 흐름이다. 공식 답변, 배정/인계와 기존 AI 처리의 계약은 유지한다. 상태 변경/재개 API, 특정 답변 인용, 알림과 운영 계정 관리까지 이 기능에 포함하지 않는다.

업무 선택과 이유는 [정책 검토](../week11/customer-followup-policy-review.md), 실제 일정과 시간 배분은 [주간 계획](./weekly-plan.md)을 따른다. 3절 저장은 [첫 검증 보고서](./lab-reports/2026-11-03-customer-followup-storage.md), 4절 목록/고객 Form은 [목록과 화면 검증](./lab-reports/2026-11-03-my-tickets-and-followup-ui.md), 5~6절 확인 저장/API는 [확인 API 검증](./lab-reports/2026-11-03-customer-message-confirmations.md)에 근거를 남긴다. 11/4의 [직원 업무 표시/확인 버튼 검증](./lab-reports/2026-11-04-staff-confirmation-ui.md)은 이 기반에 화면과 실제 Browser를 연결한 별도 근거다.

## 1 유지할 경계

| 구분 | 계약 |
|---|---|
| 고객 작성 권한 | 인증 Principal의 고정 ID와 Ticket의 requester_user_id를 비교. 직원이기도 한 고객은 본인 자격으로 작성 |
| 상태 | OPEN/IN_PROGRESS/RESOLVED에 후속 작성 허용. 글이나 확인 기록으로 상태를 변경하지 않음 |
| 원문/정정 | 원문을 그대로 저장하고 보충/정정은 새 글. 특정 답변의 자동 참조나 기존 본문 변경 없음 |
| 공개 | Commit 직후 기존 소유권/서비스 직원 권한 범위에 공개. 고객 화면에는 고객/담당자 역할 표시 |
| AI | 후속 글/확인/조회 때문에 Job/예약/호출을 만들거나 최초 입력/제안을 바꾸지 않음 |
| 책임 분리 | Controller는 변환과 응답, Application은 인가/Transaction/흐름, Domain은 입력/종류 규칙, Repository는 SQL 담당 |

이미 Commit된 기존 Job이 독립적으로 진행되는 것과 이번 기능이 새 AI 처리를 유발하는 것은 구분한다. 통합 Test에서 Worker를 꺼 기존 Row 대조와 호출 0회를 확인한다. 화면의 AI 요약/분류/우선순위에는 최초 문의 기준과 추가 대화 미반영을 표시한다.

## 2 Message 확장과 Migration

V1~V11은 유지하고 비어 있던 V12에 명시적 확인 기록을 추가했다. 기존 공식 답변의 구형 NULL 배정 버전이나 미확인 고객/서비스를 임의로 채우지 않는다.

| Message 종류 | author_user_id | client_request_id | corrects_message_id | reply_assignment_version |
|---|---|---|---|---|
| INQUIRY | 기존 값 유지. 신규 접수는 고정 ID | NULL | NULL | NULL |
| OFFICIAL_REPLY | 필수 | 필수 | 기존 동일 Ticket 공식 답변 또는 NULL | 기존 계약 유지. 신규는 필수, 구형 Row의 NULL 보존 |
| CUSTOMER_FOLLOWUP | 필수 | 필수 | NULL | NULL |

V9의 message_kind_fields와 V10의 inquiry_without_reply_assignment_version은 V11에서 확장했다. 같은 Ticket의 Message 참조와 message_submission_unique는 유지한다. 새 종류의 필수 필드는 명시적 NOT NULL 조건으로 검사하고, 고객 후속 글에 공식 답변의 배정/정정 값을 넣을 수 없게 한다.

고객은 특정 답변 ID를 지정하지 않고 Ticket에 후속 글을 추가한다. 서버가 가장 최근 답변을 자동 선택하지 않는다. correctsMessageId나 replyToMessageId를 보내면 허용하지 않은 필드로 거부한다. 기존 직원의 정정 답변 계약은 그대로다.

## 3 고객 후속 쓰기 API

`POST /api/tickets/{ticketId}/customer-messages`

허용하는 JSON 필드는 다음 두 개뿐이다. UUID는 합성 예시다.

```json
{
  "body": "안내대로 진행했지만 같은 오류가 계속됩니다.",
  "clientRequestId": "8a67b742-d585-4b53-af71-22883b268d9e"
}
```

Session의 USER/AGENT 자격과 CSRF를 확인한 뒤 서버에서 본인 소유권을 검사한다. 고객 경로에 직원 배정 버전을 요구하지 않는다. 작성자, 종류, 서비스, 상태와 Job 설정은 서버가 결정하며 고객 입력으로 받지 않는다.

입력은 기존 TicketMessage의 비공백/strip 기준 최대 2,000 Unicode Code Point 규칙을 재사용하고 저장 본문은 수정하지 않는다. 숫자/문자열 강제 변환과 추가 필드를 허용하지 않으며 UUID는 기존 canonical 검사와 맞춘다. 후속 API는 JSON 전체 파싱 전 실제 Stream 32 KiB 초과를 413으로 거부하며 Escape/공백/이모지 경계를 검증했다. Content-Length만 신뢰하지 않고 기존 전체 Jackson 설정을 바꾸지 않는다. 확인 API도 같은 실제 Byte 한도와 중복 속성/후행 JSON 검사를 구현하고 경계에서 검증했다.

### 저장과 재확인

1. 형식/본문을 검사하고 Principal의 고정 ID를 구한다.
2. 짧은 Transaction에서 Ticket을 FOR UPDATE로 잠근 뒤 DB의 requester_user_id를 확인한다.
3. 고객을 확인할 수 없는 Ticket이나 다른 고객의 문의에 이름 일치로 권한을 부여하지 않는다.
4. 같은 Ticket/작성자/UUID의 기존 Message가 있으면 종류와 원문, 관련 NULL 필드까지 비교한다.
5. CUSTOMER_FOLLOWUP의 같은 제출이면 200/추가 Row 0, 다른 종류나 내용이면 409 FOLLOWUP_REQUEST_CONFLICT다.
6. 새 CUSTOMER_FOLLOWUP을 INSERT하고 Commit을 마친 후 201과 저장된 공개 Message를 반환한다.

새 UUID의 같은 본문은 별도 제출이다. 기존 Unique가 공식 답변과 후속 글에 공유되므로 기존 replies 경로의 replay도 OFFICIAL_REPLY 종류를 확인하도록 함께 보완한다. 본문만 같거나 구형 공식 답변과 NULL 배정 버전이 같다는 이유로 다른 종류를 200으로 반환하지 않는다.

### HTTP 응답과 문의 해결 상태

HTTP의 200은 해당 요청이 성공했다는 뜻이며 결과 내용은 요청 메서드/작업에 따라 달라진다. 201은 새 리소스 생성, 409는 현재 상태와 요청의 충돌을 나타낸다. [RFC 9110의 200](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.1), [201](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.2), [409](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5.10)

이 후속 API에서는 아래 계약으로 구분한다. UUID의 범위와 200/409 재확인 방식은 우리 Application의 계약이다.

| 요청 결과 | HTTP | 추가 Message Row | Ticket 상태 |
|---|---:|---:|---|
| 새 고객 후속 글의 Commit 완료 | 201 | 1 | 기존 상태 유지 |
| 같은 종류/원문/UUID의 저장 결과 재확인 | 200 | 0 | 기존 상태 유지 |
| 같은 UUID로 기존 공식 답변 대신 고객 후속 글 요청 | 409 | 0 | 기존 상태와 공식 답변 유지 |

이 200은 같은 고객 후속 제출이 이미 저장된 결과를 성공적으로 돌려주는 응답이다. 고객 문제가 해결됐는지는 HTTP 코드로 판정하지 않는다. '감사합니다'나 '같은 오류가 계속됩니다'도 유효한 후속 글로 저장하며 본문만으로 자동 해결/재개하지 않는다. 누가 명시적으로 해결/재개할지는 상태 API의 T02~T04에서 정한다.

반대 방향도 같다. CUSTOMER_FOLLOWUP에 사용한 UUID로 공식 답변을 요청하면 409 REPLY_REQUEST_CONFLICT이며 새 Row를 만들지 않는다. 기존 공식 답변이 없어 거부하는 것이 아니라 이미 다른 종류에 사용한 제출 키이기 때문이다. 배정 버전을 올바르게 보내도 이 충돌은 해소되지 않는다. 현재 담당자가 유효한 새 UUID/본문/배정 버전으로 첫 공식 답변을 작성하는 것은 허용하며 Commit 후 201이다. 요청을 다른 종류/새 UUID로 자동 변환하지 않는다.

고객 소유권 검사는 직원의 서비스 권한과 독립적이다. 현재 담당자 인계 때문에 본인의 후속 작성을 막지 않는다. Ticket 잠금은 저장 Transaction 동안만 보유하며 글을 작성하거나 AI/외부 HTTP를 기다리는 동안 유지하지 않는다.

## 4 내 문의 목록과 대화 조회

`GET /api/my/tickets?limit=50&cursor=...`

USER/AGENT 모두 본인의 고정 ID를 기준으로 조회한다. AGENT 계정이라도 이 경로는 서비스 전체 목록이 아니다. 요청에서 requesterId/serviceId를 선택하게 하지 않으며, 신원 연결이 없으면 403 IDENTITY_UNLINKED로 거부한다. 목록이 비어 있으면 200과 빈 items를 반환한다.

각 항목은 ticketId, title, status, lastActivityAt을 반환한다. 본문, 내부 작성자/담당자 ID와 인계 사유는 넣지 않는다. 첫 버전의 lastActivityAt은 Commit된 공개 Message 중 ID가 가장 큰 메시지의 created_at이다. 최초 문의/고객 후속 글/공식 답변을 포함하고 내부 배정/확인 기록을 제외한다. 같은 Ticket의 대화 순서와 맞추며 MAX(created_at)을 마지막 Message의 대용으로 쓰지 않는다. created_at은 작성 시각이며 Commit 완료 시각이나 정렬/동시성의 증거는 아니다.

기본 50, 최대 100건과 limit+1 조회를 사용한다. 정렬은 lastActivityAt DESC NULLS LAST, ticketId DESC로 둔다. Message가 없는 구형 본인 문의도 버리지 않고 NULL 활동 시각의 마지막 구간에서 반환한다. Cursor는 Base64url로 인코딩한 {v: 1, lastActivityAt, ticketId}이며 lastActivityAt의 NULL도 구분한다. 최대 1,024 Byte와 버전/시각/양의 ID/정확한 필드를 검사하고 잘못된 Cursor는 400이다. Cursor는 순서 위치이며 권한 증거가 아니다. 매 페이지에 인증된 requester_user_id 조건과 SQL 매개변수를 사용한다.

시각이 있는 Cursor 다음은 더 오래된 시각, 같은 시각의 더 작은 Ticket ID, NULL 시각 구간이다. NULL 시각 Cursor 다음은 NULL 시각 중 더 작은 Ticket ID만 읽는다. 각 페이지는 한 SQL의 Snapshot으로 읽고 여러 페이지 전체를 고정하지 않는다. 숫자 ID는 기존 양의 Long 계약을 유지하고 Browser는 안전한 정수 범위를 벗어난 값을 조용히 반올림해 사용하지 않는다.

최근 활동은 새 Message로 바뀔 수 있어 여러 페이지 전체의 고정 Snapshot을 약속하지 않는다. Client는 Ticket ID로 중복을 정리하고 처음부터 새로고침해 위로 이동한 문의를 다시 찾는다. 누락 없는 업무 처리 원장이나 실시간 Push로 해석하지 않는다. NULL 구간을 포함한 Cursor와 동일 시각/새 글 도착 Case를 함께 검증한다.

기존 `GET /api/tickets/{ticketId}/messages?afterId=0&limit=50`는 Message ID 오름차순을 유지한다. CUSTOMER_FOLLOWUP을 고객 역할로 표시하고 기존 OFFICIAL_REPLY는 담당자 역할로 표시한다. 실제 작성자 ID나 로그인 이름은 공개하지 않는다. Capability에 canFollowUp을 추가하되 최종 쓰기 인가는 서버에서 다시 검사한다.

## 5 확인 기록의 저장 구조

V12 구현은 append-only `ticket_customer_message_confirmations`를 두고 현재 확인 지점은 해당 배정 기록의 최대 through_message_id로 계산한다. 별도의 가변 checkpoint Row와 이력을 동시에 갱신하지 않는다.

| 필드/제약 | 의미 |
|---|---|
| id | BIGINT IDENTITY Primary Key, 저장된 확인 기록 ID |
| ticket_id, assignment_version | NOT NULL/양수. 어느 문의의 어느 배정에서 확인했는지 |
| actor_user_id, client_request_id | NOT NULL. 확인자와 제출 UUID. 이 명령의 UNIQUE(ticket_id, actor_user_id, client_request_id) |
| through_message_id | 명시한 마지막 고객 Message ID, NOT NULL/양수 |
| recorded_at | NOT NULL TIMESTAMPTZ, 서버가 기록한 시각 |
| FK(ticket_id, assignment_version) | 기존 ticket_assignment_events(ticket_id, resulting_version) 참조 |
| FK(ticket_id, through_message_id) | 기존 ticket_messages(ticket_id, id) 참조 |

actor_user_id는 기존 고정 사용자 ID를 참조한다. 동일 Ticket/실제 배정의 참조는 DB가 지키고, 고객 Message 종류와 현재 담당자/서비스 활성 자격은 Application이 검사한다. FK만으로 작성 권한이 입증되지는 않는다. 기존 배정/Message Row와 확인 이력을 삭제하거나 새 담당자로 바꾸지 않는다.

확인 대상은 INQUIRY 또는 CUSTOMER_FOLLOWUP이다. 공식 답변이나 다른 Ticket의 ID는 거부한다. 같은 배정의 유효 확인 지점은 MAX(through_message_id)이므로 이미 80까지 확인한 뒤 71 확인이 늦게 저장돼도 80을 유지한다. 새 UUID의 명시적 확인은 기록을 추가하지만 그 때문에 유효 범위가 후퇴하지 않는다. 같은 UUID 재확인은 새 기록을 만들지 않는다.

여기서 마지막으로 Commit된 확인 요청은 71이며 가장 나중에 저장된 값이 80인 것은 아니다. DB에는 두 확인 기록을 남기고 같은 Ticket/배정 안의 최대 대상 ID로 유효 범위를 계산한다. 확인 기록 자체의 ID나 기록 시각이 가장 큰 Row를 선택하는 방식과 다르다. 작은 확인은 유효기간이 지난 것이 아니며 삭제/만료시키지 않는다. DB는 기록의 근거이고 범위를 후퇴시키지 않는 업무 규칙을 Query/Service에서 지킨다. [단계별 설명](./study-docs/confirmation-checkpoint-and-assignment.md)에 두 번호와 인계의 예를 정리했다.

배정 버전이 달라지면 별도 확인 범위다. A→B→A에서도 예전 A의 확인을 현재 배정으로 복사하지 않는다. 첫 배정/인계 이후 확인이 없는 상태와 새 고객 Message 도착을 화면에서 구분하고, 과거 글을 방금 들어온 글로 표시하지 않는다.

## 6 명시적 확인 API와 재확인

`POST /api/tickets/{ticketId}/customer-message-confirmations`

```json
{
  "clientRequestId": "4ec52bf2-e314-44de-ac8b-7cfc507e45a2",
  "expectedAssignmentVersion": 2,
  "throughMessageId": 71
}
```

Staff AGENT Session, CSRF와 활성 서비스 권한을 요구한다. 새 확인은 현재 담당자만 실행하고 배정 버전/대상 Message를 검사한다. SUPERVISOR도 먼저 자신에게 인계하는 기존 책임 원칙을 유지한다. 양의 Long 값, canonical UUID와 정확한 필드만 허용한다.

1. Ticket FOR UPDATE, 관련 membership FOR SHARE의 기존 잠금 순서를 따른다. 잠금 대기는 기존 2초와 SUPPORT_BUSY 처리를 재사용한다.
2. 현재 서비스 조회 권한을 확인한 뒤 같은 확인 UUID의 기록을 찾는다.
3. 같은 actor/Ticket/UUID의 같은 배정 버전/대상 ID면 200으로 기존 기록을 반환한다. 변경된 값은 409 CONFIRMATION_REQUEST_CONFLICT다.
4. 새 제출은 현재 담당자와 배정 버전을 검사한다. 확인 대상이 같은 Ticket의 고객 Message인지 검사하고 기록을 INSERT한다.
5. Commit 후에만 201을 반환한다. 기존 기록 재확인은 새 담당자의 확인을 INSERT하지 않는다.

응답은 당시의 confirmation과 DB에서 읽은 currentConfirmation을 분리한다. 전자는 그 제출의 assignmentVersion/throughMessageId/recordedAt, 후자는 현재 배정의 assignmentVersion/effectiveThroughMessageId/latestCustomerMessageId/needsConfirmation/canConfirm을 담는다. 확인 기록이 없으면 effectiveThroughMessageId는 NULL이며 latestCustomerMessageId보다 확인 지점이 작거나 없으면 needsConfirmation이다. 고객 Message가 아예 없으면 둘 다 NULL/확인 필요 없음으로 구분한다. 고객 화면에는 이 직원 전용 기록을 추가하지 않는다.

A의 배정 2 확인이 Commit된 뒤 B의 배정 3으로 인계됐다면, A가 여전히 서비스 조회 권한을 가진 경우 같은 제출을 200으로 재확인할 수 있다. 원래 확인은 배정 2의 기록이고 현재 배정 3의 확인을 대신하지 않는다. 권한이 사라지면 UUID만으로 과거 결과를 공개하지 않는다. 과거 제출이 없으면 현재 담당자/버전을 검사해 새 쓰기를 허용할지 결정한다.

`GET /api/tickets/{ticketId}/customer-message-confirmations/current`는 같은 서비스의 활성 직원이 현재 확인 상태를 읽는 경로다. 확인 상태는 한 SQL에서 현재 배정/고객 Message/확인 범위를 함께 투영해 서로 다른 배정의 값을 섞지 않는다. 기존 권한 Transaction과 membership 공유 잠금은 유지한다. 모든 GET/HEAD는 읽기만 한다.

11/4 직원 업무 목록은 기존 id/title/status/createdAt/assignmentVersion에 latestCustomerMessageId, latestCustomerMessageAt, effectiveThroughMessageId, needsConfirmation과 canConfirm을 추가했다. 최신 고객 Message의 가장 큰 ID와 그 Row의 시각을 사용하고, 같은 SQL의 Snapshot에서 현재 배정의 확인 범위를 읽는다. 기존 UNASSIGNED/MINE, ID 순 페이지 계약을 유지하며 RESOLVED를 제외하지 않는다. 미배정은 담당자 없음으로 표시하며 누구의 확인도 만들지 않는다. canConfirm은 내 담당 목록과 고객 Message 존재를 기준으로 계산한다. 고객 Message가 없는 구형 문의의 고객 ID/시각/확인 지점은 NULL이며 두 Boolean은 false다.

직원 확인 영역의 노출은 대화 Capability의 canViewConfirmations로 구분한다. 이는 기존 활성 서비스 직원 검사 결과이며, 본인 고객 소유권이나 canReply만으로 직원 조회 권한을 추측하지 않는다. 실제 확인 API의 인가는 그대로 유지한다. 고객용 공개 Message DTO에 확인 이력을 추가하지 않고 Server/엄격한 Client Decoder를 함께 갱신한다.

Security에 새 후속/본인 목록은 USER 또는 AGENT, 확인 경로는 AGENT의 명시적 Matcher를 추가한다. 일반 authenticated fallback을 업무 인가의 대체로 사용하지 않고 Application 검사를 함께 적용한다. 새 경로를 위해 Session/CSRF를 끄지 않는다.

## 7 오류와 Commit 경계

| 상황 | 응답/처리 |
|---|---|
| 익명 API 요청 | 401. 쓰기 CSRF 누락은 Security에서 403이 먼저 나올 수 있음 |
| 잘못된 필드/종류/형식, 확인 대상 오류 | 400 INVALID_REQUEST 또는 INVALID_CONFIRMATION_TARGET |
| 본인이 아닌 고객의 문의 | 404 NOT_FOUND. 존재 여부를 공개하지 않음 |
| 등록자 미확인 고객 후속 글 | 404 NOT_FOUND. 이름으로 소유권을 메우지 않음 |
| 직원 서비스 권한 없음 | 기존 SUPPORT_NOT_FOUND/404 계약 유지 |
| 새 확인의 비담당자 | 403 NOT_ASSIGNEE |
| 새 확인의 구형 배정 버전 | 409 ASSIGNMENT_VERSION_CONFLICT |
| 같은 제출 키의 다른 내용/종류 또는 확인 대상 | 409의 명령별 충돌 코드 |
| Body Byte 한도 초과 | 413. 저장/AI 실행 없음 |
| 잠금 대기 초과 | 기존 안전한 503 SUPPORT_BUSY. 실패한 Transaction에서 조회를 계속하지 않음 |
| 저장 거부/확인된 Commit 실패와 Rollback | 안전한 500, 이번 새 Row만 취소. 기존 문의/답변/배정/AI 데이터 유지 |
| Commit ACK/HTTP 응답 유실 | 성공/실패를 단정하지 않고 원래 제출 정보로 명시적 재확인 |

확인 기록과 이번 저장 결과는 같은 짧은 Transaction으로 다룬다. 본문/확인 기록 저장 중에 외부 AI나 알림을 호출하지 않는다. Controller가 Service 결과를 받기 전에 Transaction Commit이 끝나도록 하고 INSERT RETURNING이나 행 수만으로 201을 선택하지 않는다.

## 8 화면과 페이지 수명

고객의 목록 선택 → 대화 조회 → 후속 작성과 직원의 업무 목록 → 대화 확인 → 명시적 확인을 연결한다. 합의한 역할 표시는 메시지 종류를 기준으로 하고 Ticket의 현재 담당자로 과거 작성자를 치환하지 않는다. 원문은 textContent로 표시하며 모든 업무 응답은 no-store를 유지한다.

결과 미확인 제출은 UUID/본문 또는 확인 대상/배정 버전을 메모리에 유지하고 자동으로 새 UUID를 만들지 않는다. 저장을 확인한 뒤 GET만 실패했다면 GET을 재시도한다. 확인 응답의 과거 confirmation으로 최신 assignment/currentConfirmation을 덮어쓰지 않는다.

Ticket 선택과 조회 순번을 함께 비교해 늦은 응답을 무시한다. pagehide에서 대화/초안/제출 정보를 정리하고 새로고침/이동 전 메모리 유실을 안내한다. LocalStorage에 원문이나 Secret을 영속 보관하지 않는다. 오래된 화면의 버튼이나 capability는 서버의 현재 권한 검사를 대체하지 않는다.

확인 대상 선택 시점에 throughMessageId와 expectedAssignmentVersion을 함께 고정한다. 같은 Ticket의 새 조회도 그 버전을 자동 치환하지 않는다. 확인 POST 성공을 확인한 뒤에는 저장 이력을 별도로 표시하고 GET으로 현재 상태를 다시 읽는다. 이 GET만 실패했다면 저장을 반복하지 않는다. 목록의 대화 링크는 검증한 Ticket ID만 같은 Origin의 주소에 넣는다.

11/4의 [재선택 UI](./lab-reports/2026-11-04-confirmation-reselection-ui.md)는 확인 POST의 409와 정확한 ASSIGNMENT_VERSION_CONFLICT 코드에만 명시적 초기화를 허용한다. 원래 선택은 일반 조회로 바꾸지 않으며, 사용자가 초기화 버튼을 누르면 선택을 비운 뒤 GET만 수행한다. 현재 상태/권한을 읽고 사용자가 고객 Message를 다시 선택해 제출할 때 새 UUID를 발급한다. GET 실패나 권한 없음 상태에서는 새 쓰기를 허용하지 않는다.

다른 409, 해석할 수 없는 오류 Body와 결과 미확인 응답은 이 초기화 조건이 아니다. 원래 제출 정보를 보존하고 자동 최신화/재전송하지 않는다. 저장 결과 조회가 배정 버전 검사보다 앞서는 현재 Service 계약을 근거로 조건을 좁혔다. 이 동작은 확인 영역에만 적용하며 다른 Form의 초안/버전 복구는 별도로 다룬다.

## 9 구현 단위와 검증

| 순서 | 구현 단위 | 필요한 근거 |
|---|---|---|
| 1 | V11 종류/제약, 고객 후속 저장과 기존 공식 답변의 종류 비교 | V10 기존 Row 유지, 종류별 제약, 권한/입력/중복/Commit 실패/원문 및 AI Row 보존 Test |
| 2 | 내 문의 Query/API와 고객 화면 | 본인 목록, NULL/동일 시각 Cursor, 새 글 도착, 대화 공개/역할 표시와 응답 유실 Test |
| 3 | V12 기록/API와 11/4 직원 업무 표시/직접 선택한 확인 버튼 | 새 글/늦은 확인/인계/재배정/권한 회수/재확인, GET 무변경. 실제 직원 Browser/DB 대조와 남은 실패 복구 검증을 구분 |
| 4 | 통합 검증과 문서 | 실제 PostgreSQL/대표 Browser/전체 회귀와 재현 절차, 정확한 Commit의 CI는 별도 기록 |

두 명의 새 Message 작성, 확인과 새 글, 인계와 확인, membership 회수와 확인의 경쟁을 Commit 순서별로 재현한다. 유효 범위 계산과 실제 INSERT/Commit을 구분하며 기존 데이터는 행 수뿐 아니라 본문/소유자/참조/배정/Job/Attempt/제안/분류 값까지 대조한다.

Index는 기존 (ticket_id,id)와 requester_user_id를 우선 검토하고 확인 범위용 (ticket_id,assignment_version,through_message_id DESC)를 후보로 둔다. Query와 FK에 맞춰 Migration에서 결정하고 EXPLAIN 없이 속도 향상 수치를 주장하지 않는다. 일반 문의 AI나 Cloud 실행은 이 검증의 선행 조건이 아니다.

새 Message 종류를 저장한 뒤에는 그 값을 모르는 예전 Image로 단순 복귀할 수 없다. 향후 배포 시 CUSTOMER_FOLLOWUP을 읽는 준비 버전과 새 Schema의 호환을 검증하고, Image 복귀를 DB 데이터 되돌리기와 혼동하지 않는다. 현재 문서화로 Cloud 배포를 실행하지 않는다.

## 10 기술 선택 기록과 확인 범위

| 맥락과 선택지 | 초안의 선택과 이유 | 영향/후속 점검 |
|---|---|---|
| 후속 글 별도 테이블 또는 기존 Message 확장 | 기존 대화 순서/조회/중복 키를 재사용하고 CUSTOMER_FOLLOWUP 추가 | V11, Message/Service/DTO/UI. 양방향 종류 충돌 회귀 |
| 활동 시각을 Ticket의 모든 변경 또는 마지막 공개 Message에서 산정 | 합의한 공개 대화 기준. 마지막 ID의 created_at을 사용 | 목록 Query/Cursor. 인계/확인 무변경과 시각 경계 Test |
| 가변 확인 Row만 저장, Row+이력 이중 저장, 확인 기록+MAX | append-only 확인 기록 한 종류와 배정별 MAX. 제출 재확인과 확인자/배정 경과를 함께 보존 | V12, 확인 Service/Repository. 중복 키/권한/이력 보관은 향후 데이터 수명 정책과 함께 검토 |
| 확인 POST 성공 후 최신 ID를 서버가 대신 채움 또는 명시한 ID 유지 | 명시한 ID를 기록하고 현재 상태를 별도 반환 | 확인 API/UI. 새 글과 과거 응답의 경합 Test |
| 원문 문자 수만 제한 또는 Body Byte도 제한 | 후속/확인 API 모두 32 KiB 실제 Stream 제한과 경계 검증 | Web 입력 처리. Escape/공백/작은 Content-Length와 실제 입력 경계 검증 |
| 직원 확인 상태를 문의마다 추가 Query 또는 한 번의 목록 SQL로 조회 | 페이지를 제한한 뒤 현재 배정/최신 고객 글/MAX를 같은 SQL Snapshot에서 반환 | Support Repository/Service와 목록 DTO. 기존 ID 순서/세 상태/Index 유지, 성능 수치는 미측정 |
| 소유권/답변 가능 여부로 직원 UI를 추측 또는 명시적 읽기 Capability | canViewConfirmations를 기존 활성 직원 검사 결과로 반환 | Conversation Service/DTO/Decoder. 비담당 직원의 읽기와 권한 회수 후 본인 고객 자격을 구분 |
| 선택/제출을 새 상태에 자동 적응 또는 원래 범위 유지 | 선택 당시 배정 버전을 유지하고 저장된 이력과 GET 현재 상태를 분리 | 확인 Client/직원 UI. 새 글/인계/늦은 응답과 응답 유실 검증 |
| 페이지 재진입, 모든 오류의 제출 삭제, 자동 버전 교체 또는 알려진 충돌의 명시적 재선택 | 409/ASSIGNMENT_VERSION_CONFLICT만 재선택 허용. GET 뒤 빈 선택에서 사용자가 새로 고르게 해 의도하지 않은 확인 방지 | 확인 Client/Page/HTML과 Node/Browser 검증. Service/Schema/이력 삭제 변경 없음. 다른 Form과 결과 미확인 제출 복구는 별도 유지 |

초안 작성 시 검토한 Source는 Lab의 공식 답변/배정 계약, V2/V9/V10, Message/Conversation Service·Repository·DTO, SupportAccess와 배정 Service다. 이 관련 파일은 VERIFIED이며 당시 Security는 라우팅 규칙만 PARTIAL로 확인했다. 이후 첫 구현에서는 새 라우팅/Service/Repository/입력 처리와 V11을 수정하고 보고서의 실행 검증을 진행했다. 전체 저장소 감사나 전체 보안/성능 평가로 확대하지 않는다.
