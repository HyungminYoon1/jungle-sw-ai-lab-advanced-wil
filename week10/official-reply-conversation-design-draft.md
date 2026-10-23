# 공식 답변 작성과 대화 내역 조회 설계 초안

> 작성일: 2026-10-23
> 상태: Accepted / Locally Verified. P1~P8 합의 뒤 2026-10-23 구현 승인. V9, API와 최소 화면의 로컬 회귀 및 Browser 검증 완료
> 구현 전 조사 기준: Lab Source `832b1b74ab7666a5bf50c9aa702b14f97b517d59`, Flyway V1~V8
> 일정: [10/23, 24, 26 학습 및 구현 계획](./weekly-plan.md)

이 문서는 구현 전 조사와 P1~P8 정책 합의, 이후 기술 계약 및 구현 결과를 연결한다. 사용자가 10/23 남은 기술 설계와 작은 단위의 구현, Test 및 Commit을 요청해 착수했다. 정책 합의 자체가 아니라 이 별도 요청을 구현 근거로 삼았다. 그 구현 요청에는 새 AWS 실행, Push와 실제 AI 호출을 포함하지 않았으며, 이후 학습 마감 요청에서 두 저장소 Push를 별도로 승인했다.

## 확정한 기술 계약과 현재 구현

- `helpdesk_user_identities`의 BIGINT ID를 소유권과 작성자 FK로 사용한다. 서버 설정의 고정 UUID account key가 인증 Principal에 담기고, DB ID와 명시적으로 연결된다. 매 요청의 로그인 이름으로 소유자를 다시 찾지 않는다.
- 기존 Session 및 In-memory 인증을 유지한다. 인증 때마다 새 Principal을 만들어 Credential 제거가 다음 로그인에 영향을 주지 않게 했으며, 서로 다른 설정 계정에 같은 key를 주면 기동을 거부한다. 회원가입과 Password DB는 추가하지 않았다.
- V9가 기존 Message에 종류, 작성자 ID, 제출 UUID와 정정 참조를 추가한다. 기존 V8의 접수 Message는 INQUIRY이며, 구형 등록자와 작성자 ID는 NULL로 남긴다. 로그인 이름으로 과거 소유권을 채우지 않는다.
- 같은 Ticket의 정정 참조는 복합 FK로, 같은 작성자의 제출은 Unique로 제한한다. 대상이 공식 답변인지는 Application Service가 검사한다. 새 Message ID 발급 전에 Ticket을 짧게 잠가 같은 Ticket의 쓰기와 Cursor 순서를 맞춘다.
- `GET /api/tickets/{id}/messages`와 `POST /api/tickets/{id}/replies`를 추가했다. 작성자와 종류는 서버가 정하며, 답변 요청의 추가 필드와 잘못된 자료형은 거부한다. 기존 Ticket 및 AI 제안 조회는 AGENT 전용으로 유지했다.
- `/conversation.html`에서 답변과 정정, 제한된 대화 조회를 제공한다. 본문은 textContent로 표시하고 결과 미확인 제출은 같은 ID로만 명시적으로 재확인한다. Ticket 변경 후 늦은 응답은 이전 화면을 되살리지 못한다.

구체적인 SQL, API와 결정 이유는 Lab의 `docs/official-replies.md`에 기록했다. [실행 보고서](./lab-reports/2026-10-23-official-reply-conversation-lab.md)에 Commit, 실행 명령과 검증 한계를 구분하며 [학습 노트](./study-notes/2026-10-23-study-questions.md)에는 실제 코드 기반 문답을 기록했다. 아래 기존 코드 표는 구현 전 기준선이며 현재 Schema와 혼동하지 않는다.

## 목적과 범위

Ticket은 하나의 문의 주제와 처리 상태를 묶고 Message는 실제 대화 내용을 보관한다. 담당자가 직접 작성한 공식 답변을 Message로 추가하고, 권한이 있는 사용자가 최초 문의와 답변을 순서대로 조회하는 것이 이번 목표다.

AI Suggestion은 담당자 검토를 위한 제안이며 공식 답변이 아니다. AI Job이 SUCCEEDED이거나 제안의 검토 상태가 PENDING_REVIEW라는 이유로 고객에게 게시하거나 Ticket을 해결 처리하지 않는다. 공식 답변 저장과 대화 조회에는 새 AI Job과 외부 호출을 연결하지 않는 안을 제안한다.

고객의 추가 메시지 작성, 내부 메모, 답변 초안과 승인, 수정과 삭제, 첨부 파일과 이메일 알림은 이번 기능에 포함하지 않는다. Ticket 상태 변경과 고객 대화의 AI 재요약도 별도 후속 기능이다.

## 구현 전 코드에서 확인한 점

| 항목 | 현재 구현 | 설계에 주는 영향 |
|---|---|---|
| tickets | id, title, status. 등록자 필드 없음 | 고객 소유권을 현재 Ticket Row만으로 판단할 수 없음 |
| ticket_messages | ticket_id, body, author_username, created_at | 문의와 공식 답변의 구분이 필요 |
| 접수 Service | Ticket, Message, Job을 같은 Transaction에 저장 | 새 소유권 정보도 접수 Commit과 함께 보존해야 함 |
| 접수 권한 | USER와 AGENT 모두 허용 | AGENT가 작성한 Message도 최초 문의일 수 있음 |
| 기존 조회 | Ticket 단건과 AI 제안은 AGENT 전용 | 고객 대화 조회는 명시적인 신규 권한이며 기존 조회를 일괄 개방하지 않음 |
| Message Repository | 저장 메서드만 제공 | 대화 조회와 중복 요청 확인을 위한 Port 필요 |
| AI 입력 | Job의 input_message_id로 고정 | 답변 추가 후 최신 Message로 입력을 바꾸지 않음 |
| 구형 데이터 | V1 Ticket은 Message와 작성자 없이 존재 가능 | 가짜 원문이나 임의 소유자를 만들어 보충하지 않음 |

구현 전 Runtime 계정은 InMemoryUserDetailsManager를 사용했다. 이번에는 이를 상속한 identity-aware Adapter로 고정 key를 보존하면서 기존 인증 방식을 유지했다. AGENT에는 USER Role도 함께 있으므로 AGENT 허용을 먼저 판별하고 일반 USER의 소유권 조건을 적용한다.

## 사용자와 먼저 검토할 핵심 정책

### P1. 누가 공식 답변을 언제 볼 수 있는가?

**합의, 2026-10-23:** AGENT는 전체 Ticket의 대화를 조회하고 답변을 작성한다. USER는 자신이 등록한 Ticket의 대화만 조회한다. 공식 답변은 저장 Commit 즉시 그 등록자에게 공개한다. 별도의 초안, 내부 메모나 승인 단계를 두지 않는다.

AGENT에게만 답변을 보여주는 안은 고객이 문의 결과를 확인할 수 없고, 초안과 승인 단계를 추가하는 안은 별도 상태와 권한이 필요하다. 이번에는 직접 작성해 공개하는 흐름으로 정했다. 화면에는 저장이 곧 고객 공개라는 점을 표시한다.

등록자 식별 방법과 구형 Ticket의 예외는 P4 및 P5에서 별도로 합의했다. username 자체를 소유권 키로 쓰지 않고 고정 사용자 ID를 사용한다. AGENT의 대리 접수 고객 지정은 이번 범위 밖이다.

### P2. 답변을 등록하면 Ticket 상태도 바뀌는가?

**합의, 2026-10-23:** 답변 등록은 Ticket 상태를 바꾸지 않는다. OPEN, IN_PROGRESS와 RESOLVED 모두 답변을 추가할 수 있으며, RESOLVED에서 추가하는 안내도 자동 재개로 취급하지 않는다.

답변이 있다는 것과 문제가 해결됐다는 것은 다른 판단이다. RESOLVED의 답변을 막는 대안 대신 해결 후 추가 안내를 허용하기로 했다. 상태 변경은 별도 동작이며 기존 상태 전이 규칙과 이번 비범위인 상태 변경 API는 바꾸지 않는다.

### P3. 공개한 답변을 수정하거나 삭제할 수 있는가?

**합의, 2026-10-23:** 첫 버전에서는 저장한 공식 답변을 수정하거나 삭제하지 않는다. 정정은 새 공식 답변으로 남겨 앞선 내용과 후속 설명을 함께 보존한다.

직접 수정과 삭제를 허용하면 수정 권한, 이력 보존과 이미 읽은 고객에게 보여줄 기준이 추가로 필요하다. 첫 버전에서는 추가 저장으로 한정하고, 오발송이나 개인정보 삭제 요구를 처리할 운영 절차는 후속으로 남긴다. 이 초안이 법적 보존 의무나 영구 보관 기간을 확정하는 것은 아니다.

### P4. 문의 등록자를 로그인 이름으로 식별할 것인가?

**합의, 2026-10-23:** 이름과 별개의 고정된 서버 사용자 ID로 소유권을 저장한다. 로그인 이름이 바뀌거나 나중에 다른 사람이 같은 이름을 쓰더라도 기존 문의의 소유자가 바뀌지 않아야 한다. Browser가 보낸 작성자나 사용자 ID는 소유권 근거로 쓰지 않는다.

현재 Authentication.getName()은 로그인 이름이며 기존 Message 작성 근거다. 고정 ID가 이미 있다는 뜻은 아니다. 인증된 계정과 영속 사용자 ID의 연결을 먼저 설계하고 검증해야 한다. 계정이 없다고 현재 요청의 이름만 보고 과거 소유자를 자동 생성하거나 연결하지 않는다. 탈퇴한 ID도 다른 사람에게 재사용하지 않는다.

로그인 이름을 고정하는 대안 대신 고정 ID를 선택했다. P7에 따라 기존 로그인을 유지하면서 최소 식별 구조와 명시적 계정 연결을 추가한다. 회원가입, Password 관리나 인증 체계 전체 교체는 이번 범위가 아니다. 공용 USER 계정 한 개로 서로 다른 고객의 격리를 증명하지 않는다.

### P5. 기존 문의의 등록자를 확인할 수 없다면?

**합의, 2026-10-23:** AGENT 조회만 허용하고 USER에게는 공개하지 않는다. 새 공식 답변 작성도 등록자 확인 전에는 거부한다. 저장 즉시 고객 공개라는 P1의 의미를 지키려면 누구에게 공개할지 먼저 확인할 필요가 있다.

Message가 없는 구형 Ticket이나 인증 계정과의 연결이 불명확한 Row에 현재 관리자 또는 임의의 사용자를 소유자로 넣지 않는다. 원문과 기존 데이터는 유지하고, 소유자를 확인하는 관리 절차는 후속으로 남긴다. AGENT 조회는 가능하지만 답변은 409 REQUESTER_UNCONFIRMED로 거부한다. 소유자를 모르는 Ticket에도 답변을 허용하는 대안은 이번에 채택하지 않았다.

### P6. 답변 저장 직후 Browser 연결이 끊겼다면?

**합의, 2026-10-23:** 같은 답변 제출 ID를 유지해 재전송할 수 있게 한다. 같은 Ticket과 작성자가 같은 ID, 같은 본문을 다시 보내면 기존 답변을 200으로 반환하고 새 답변을 만들지 않는다. 같은 ID에 본문이 다르면 409로 거부한다. 첫 저장은 Commit 뒤 201이다. P8의 정정 대상도 요청 내용에 포함하므로, 같은 ID로 정정 대상만 바꿔도 409다.

버튼 비활성화만으로는 서버가 저장한 뒤 응답만 잃은 경우를 막지 못한다. DB의 Unique 제약으로 같은 제출의 중복을 막는다. 저장한 본문 그대로 비교하며 공백을 지우거나 내용을 요약해서 같은 요청으로 판단하지 않는다. 수정한 새 답변은 새 제출 ID를 사용한다. ID를 잃고 새 ID로 다시 작성한 요청까지 같은 제출로 알아낸다고 주장하지 않는다.

### P7. 고정 ID를 도입하며 로그인 기능도 전부 바꿀 것인가?

**합의, 2026-10-23:** 현재 Session 로그인과 인증 계정 설정은 유지하고, 인증된 계정과 DB의 내부 사용자 ID를 명시적으로 연결하는 최소 구조부터 추가한다. 회원가입, Password 재설정, 계정 관리 화면이나 인증 저장소 전체 이전을 이번 답변 기능에 묶지 않는다.

계정 연결은 서버가 관리하고 재시작 후에도 같은 내부 ID를 사용해야 한다. 실제 연결 방법은 별도 기술 설계로 정하며, 로그인 이름만 같다는 이유로 자동 연결하거나 매번 새 ID를 발급하는 안은 사용하지 않는다. 신규 접수, 답변 작성과 USER 소유권 조회에 필요한 연결을 확인하지 못하면 해당 동작을 거부하고 임의의 ID로 대체하지 않는다. 기존 AGENT 전용 조회를 불필요하게 막는 방식으로 확대하지 않는다.

DB에 인증 계정과 Password 및 Role까지 함께 영속화하는 대안은 이번에 채택하지 않았다. 기존 인증 설정과 Secret 경로 및 회귀 범위까지 달라지므로, 고정 ID 연결부터 구현하고 인증 저장소 이전은 별도 과업으로 분리하기로 했다.

### P8. 정정 답변이 어느 답변을 고치는지 명시할 것인가?

**합의, 2026-10-23:** 정정도 새 OFFICIAL_REPLY로 저장하되, 정정 대상 Message ID를 선택해 함께 보관한다. 화면에는 정정 대상 답변을 표시하고 기존 답변의 본문, 작성자와 시각은 바꾸지 않는다. 일반 추가 안내에는 정정 대상을 지정하지 않는다.

대상은 같은 Ticket에 이미 저장된 공식 답변이어야 한다. 고객 문의, 다른 Ticket의 답변이나 존재하지 않는 ID는 거부한다. 앞선 정정 답변을 다시 정정하는 것은 가능하되 기존 답변을 자동 삭제하거나 그 Row에 무효 상태를 덮어쓰지 않는다. 정정도 저장 즉시 공개되며 별도 승인 Workflow는 없다.

본문에 '앞선 답변을 정정합니다'라고만 쓰는 대안 대신 명시적으로 연결하는 안을 선택했다. 본문이 같아도 같은 제출 ID로 정정 대상만 바꾼 요청은 다른 내용이므로 P6의 409 충돌에 포함한다. 정정 대상을 생략하거나 null로 보낸 일반 답변은 같은 '대상 없음'으로 비교하고, 본문에 정정 문구가 있다는 이유로 서버가 대상을 추측하지 않는다.

| 정책 | 현재 상태 | 사용자 결정 |
|---|---|---|
| P1 공개 시점과 조회 및 작성 권한 | 합의, 2026-10-23 | USER는 자기 대화, AGENT는 전체 조회와 답변. Commit 즉시 공개 |
| P2 Ticket 상태와 답변 허용 상태 | 합의, 2026-10-23 | 상태 변경 분리. RESOLVED에도 추가 안내, 자동 재개 없음 |
| P3 수정, 삭제와 정정 | 합의, 2026-10-23 | 기존 답변 보존, 새 정정 답변 추가 |
| P4 등록자 식별 | 합의, 2026-10-23 | 고정 사용자 ID 사용. 로그인 이름이나 Browser 입력으로 소유권 판정하지 않음 |
| P5 미확인 등록자의 기존 문의 | 합의, 2026-10-23 | AGENT 조회만 허용, 새 공식 답변은 확인 전 거부 |
| P6 같은 제출의 재전송 | 합의, 2026-10-23 | 같은 Ticket 및 작성자의 동일 ID와 요청 내용은 기존 결과 200. 본문 또는 정정 대상 변경은 409 |
| P7 인증과 내부 ID 연결의 범위 | 합의, 2026-10-23 | 기존 로그인 유지, 최소 ID 연결 추가. 인증 저장소 전체 이전은 제외 |
| P8 정정 대상 연결 | 합의, 2026-10-23 | 같은 Ticket의 기존 공식 답변 참조. 기존 Row는 보존하고 정정은 새 답변으로 공개 |

## 기술 검토 결과

이번 첫 기능의 핵심 업무 정책은 P1~P8로 정리됐다. 같은 범위 안에서 질문을 계속 늘리지 않고, 아래 기술 작업으로 구체화한다. 정책을 바꿔야 하는 충돌이나 새로운 위험이 발견될 때만 사용자에게 다시 확인한다.

| 항목 | 확정 및 구현한 내용 |
|---|---|
| 인증과 내부 ID 연결 | 명시적 UUID 연결, 인증 Principal과 서버 Actor, 이름 재사용 격리, 누락 및 중복 key 거부 |
| Schema와 Migration | V9의 BIGINT FK, 종류 CHECK, 같은 Ticket의 정정 FK와 제출 Unique. V1~V8 보존 |
| API와 오류 계약 | 엄격한 요청 변환, 정정과 일반 안내, 재전송 200 및 충돌 409, 안전한 400/403/404/500 |
| 구현과 Test 순서 | 데이터·인증, API·권한, 화면 순서로 구현. Focused PostgreSQL Test와 실제 Browser 확인 후 전체 회귀 |

실행 결과의 최종 상태는 보고서를 따른다. 계정 관리 전체, 고객 후속 메시지, 운영 삭제 및 보관 기간, 실제 고객 입력의 AI 활성화는 기존 후속 범위로 유지한다. 로컬 합성 계정과 데이터로 검증했으며 운영 배포 완료를 뜻하지 않는다.

## 데이터 구조 제안

답변 전용 Table을 따로 만들기보다 기존 Message에 목적을 명시하는 안이다. 문의와 답변 모두 Ticket과 1:N이며 AI 제안은 대화 Message로 합치지 않는다.

```text
Ticket 1 ── N Message (INQUIRY 또는 OFFICIAL_REPLY)
                   │
                   └─ 기존 최초 문의의 AI Job ── 검증된 Suggestion
                      공식 답변에는 새 Job을 만들지 않음
```

| 대상 | 제안 변경 | 목적과 제약 |
|---|---|---|
| 사용자 식별 저장소 | helpdesk_user_identities의 BIGINT ID, UNIQUE account_key UUID 및 login_username | P7에 따라 기존 로그인 유지. 고정 key로 같은 ID 연결, 회원가입이나 Password 저장 기능 추가 없음 |
| tickets.requester_user_id | 고정 사용자 ID 참조. 구형 데이터의 미확인 값은 NULL 허용 | 접수 시 서버가 등록자 저장. 고객이 지정하지 못함 |
| ticket_messages.author_user_id | 고정 사용자 ID 참조. 새 답변에 필수, 구형 미확인 값은 NULL 허용 | 새 답변의 작성자와 중복 제출 범위를 판별. 구형 Row를 이름만으로 임의 연결하지 않음 |
| ticket_messages.message_type | INQUIRY 또는 OFFICIAL_REPLY, NOT NULL | 작성자 Role이 아니라 접수 또는 답변 동작으로 결정 |
| ticket_messages.client_request_id | UUID, 공식 답변에 필수 | 같은 제출 재전송의 중복 저장 방지. 기존 문의는 NULL |
| 기존 author_username | 접수 및 작성 당시 인증 이름 보존 | 본문과 함께 기존 작성 근거 보존. 소유권 키로 사용하지 않음 |
| ticket_messages.corrects_message_id | 정정 대상 Message 참조, 일반 안내는 NULL | 같은 Ticket의 기존 공식 답변만 허용. 원래 답변은 갱신하지 않음 |
| 기존 body, created_at, ticket_id | 유지 | 서버 시각과 기존 외래 키 사용 |

P4와 P7에 따라 BIGINT 내부 ID와 UUID 계정 연결을 사용한다. 정정 참조는 (ticket_id, corrects_message_id)가 (ticket_id, id)를 참조하는 복합 FK다. 실제 SQL은 V9이며 이 문서의 표가 Migration을 대신하지 않는다.

message_type은 TEXT 또는 기존 스타일의 VARCHAR와 CHECK로 제한한다. OFFICIAL_REPLY는 author_user_id와 client_request_id가 모두 NULL이 아니어야 하고 INQUIRY에는 client_request_id와 corrects_message_id가 없는 조합을 DB 제약으로 검증하는 안이다. 구형 INQUIRY의 author_user_id는 미확인 상태를 허용하되 신규 접수는 서버가 연결을 확인해 저장한다. 새 답변 API는 본문과 제출 ID, 선택적 정정 대상만 받고 종류와 작성자 식별 정보는 서버에서 정한다.

다음 Index를 제안한다. 특정 성능 향상 수치는 측정 전 주장하지 않는다.

- 대화 순서 조회용 (ticket_id, id). 기존 ticket_id Index의 정리는 실제 계획 확인 후 판단한다.
- client_request_id가 있는 Row의 (ticket_id, author_user_id, client_request_id) Unique Index. 새 답변의 author_user_id와 client_request_id는 함께 필수다. UUID만으로 권한을 부여하지 않는다.
- 고정 ID의 외래 키와 필요한 참조 Index도 검토한다. 기존 author_username을 삭제하거나 모든 FK에 근거 없이 Index를 추가하지 않는다.
- 정정 대상은 같은 Ticket을 참조하도록 복합 FK 등의 DB 제약을 검토하고, Application Service는 이미 저장된 공식 답변인지 검사한다. 참조 무결성만으로 대상 Message의 종류까지 검증됐다고 가정하지 않는다.

### 기존 데이터와 Migration

1. V1~V8은 수정하지 않고 V9를 추가했다.
2. 조사한 V8 코드의 Message 쓰기는 접수 경로이므로 기존 Message는 INQUIRY로 유지했다. AGENT 작성 여부로 OFFICIAL_REPLY를 추론하지 않았다. 이 기준 밖에서 수동 반입한 데이터까지 분류했다고 주장하지 않는다.
3. 기존 Ticket과 Message의 고정 ID는 NULL로 남겼다. 과거 계정 연결을 독립적으로 확인하는 관리 기능은 이번에 구현하지 않았다. Job의 input_message_id는 바꾸지 않는다.
4. Message가 없는 구형 Ticket에도 원문이나 소유자를 보충하지 않았다. 미확인 등록자의 대화는 AGENT만 조회하며 답변은 거부한다.
5. 신규 접수는 등록자와 INQUIRY Message, 기존 Job을 한 Transaction에 저장한다. 등록자 저장 실패도 접수 전체 실패다.
6. Migration Test에서 기존 제목, 본문과 작성자, 상태, Job 입력 및 제안 내용의 보존을 확인한다.

V9와 Repository를 함께 검증하며 과거 Image가 새 DB에서 안전하게 쓰기를 수행한다고 가정하지 않는다. Cloud 재배포나 Image Rollback은 실행하지 않았다.

## API와 접근 제안

| API | 목적 | 권장 권한 |
|---|---|---|
| GET /api/tickets/{ticketId}/messages | Ticket 정보와 대화 페이지 | AGENT 전체, USER는 확인된 등록자만 |
| POST /api/tickets/{ticketId}/replies | 공식 답변 저장 | AGENT만, 등록자가 확인된 Ticket |

등록자 미확인 Ticket의 예외와 재전송 응답은 합의한 P5 및 P6를 따른다. P7에 따라 서버가 확인한 고정 ID를 사용하고 P8의 정정 대상을 요청과 대화 응답에 포함한다. 신규 API의 물리 구현과 오류 처리는 아래 기술 계약을 기준으로 검증한다.

기존 GET /api/tickets/{id}와 AI 제안 조회는 AGENT 전용을 유지한다. 고객 화면은 새 대화 API에 포함된 Ticket 제목과 상태를 사용한다. 신규 경로의 GET과 HEAD에도 같은 소유권 정책을 적용한다.

### 답변 요청과 성공 응답

```json
{
  "body": "확인한 내용을 안내드립니다.",
  "clientRequestId": "11111111-1111-4111-8111-111111111111"
}
```

새 답변 DTO에서 허용하지 않은 필드는 거부하는 안이다. 기존 문의 접수의 추가 필드 처리까지 전역 설정으로 바꾸지 않는다. 본문은 기존 Message와 같은 앞뒤 공백 제외 최대 2,000 Unicode Code Point, 비공백 조건을 적용하고 저장할 원문을 임의로 자르거나 HTML로 변환하지 않는다.

위 요청 예시는 일반 답변 기준이다. correctsMessageId를 생략하거나 null로 보내면 일반 추가 안내이며, 정정일 때는 양의 정수인 기존 공식 답변 ID를 지정한다. 아래 정정 요청도 같은 API를 사용한다. 이 API는 이후 구현 및 로컬 검증을 마쳤으며 운영 배포 여부와는 구분한다.

```json
{
  "body": "앞선 안내의 처리 일정을 정정합니다.",
  "clientRequestId": "22222222-2222-4222-8222-222222222222",
  "correctsMessageId": 82
}
```

신규 저장은 Commit 뒤 201과 Message ID를 반환한다. 같은 Ticket과 작성자의 같은 제출 ID, 같은 본문과 같은 정정 대상을 재전송하면 기존 Message를 200으로 반환하고 새 Row를 만들지 않는다. 같은 제출 ID로 본문이나 정정 대상을 바꾸면 409다. 이번 새 API는 별도 단건 Message GET을 만들지 않으므로 Location을 필수 응답으로 약속하지 않는다. 기존 Ticket 생성의 201과 Location 계약은 유지한다.

### 대화 응답

```json
{
  "ticket": { "id": 31, "title": "로그인 문의", "status": "OPEN" },
  "capabilities": { "canReply": true },
  "messages": [
    { "id": 81, "type": "INQUIRY", "body": "문의 원문", "createdAt": "2026-10-23T01:00:00Z", "correctsMessageId": null },
    { "id": 82, "type": "OFFICIAL_REPLY", "body": "담당자 안내", "createdAt": "2026-10-23T01:05:00Z", "correctsMessageId": null },
    { "id": 83, "type": "OFFICIAL_REPLY", "body": "앞선 안내의 처리 일정을 정정합니다.", "createdAt": "2026-10-23T01:10:00Z", "correctsMessageId": 82 }
  ],
  "page": { "nextAfterId": null, "hasMore": false }
}
```

예시의 모든 ID와 문장은 합성 값이다. 내부 작성자와 등록자의 식별 정보는 이 응답에 노출하지 않고 Message 종류로 문의와 담당자 답변을 표시하는 안이다. canReply는 서버가 실제 권한과 정책으로 계산하며 보안 검사를 대신하지 않는다.

조회는 id 오름차순으로 afterId 이후의 페이지를 읽고 기본 50건, 최대 100건으로 제한하는 안이다. 한 건을 더 읽어 hasMore를 계산하고 다음 페이지가 있을 때 마지막으로 반환한 ID를 nextAfterId로 제공한다. Ticket ID는 양수, afterId는 생략 시 0 또는 0 이상의 정수, limit은 1~100으로 검증하고 잘못된 값은 400으로 처리한다. 메시지가 없는 구형 Ticket은 권한이 있는 AGENT에게 빈 목록을 반환한다.

| 조건 | 제안 응답과 부수 효과 |
|---|---|
| 익명 대화 GET | 401. DB 쓰기 없음 |
| USER의 타인 Ticket 또는 미확인 등록자 조회 | 없는 Ticket과 같은 404. 소유자나 존재 여부 미노출 |
| USER의 답변 POST, 유효 CSRF | 403. 답변 저장 Service 미호출 |
| CSRF 누락 또는 불일치 POST | 403. Controller와 저장 Service 미진입 |
| 인증되지 않은 POST, 유효 CSRF | 401. CSRF도 없으면 Filter 순서에 따라 403 가능 |
| 허용 사용자, 잘못된 ID 또는 본문 | 400. 신규 Row 없음 |
| AGENT, 존재하지 않는 Ticket | 404 |
| AGENT, 등록자 미확인 Ticket의 답변 | 409, REQUESTER_UNCONFIRMED |
| 허용 사용자, 다른 Ticket이나 문의 Message 등 잘못된 정정 대상 | 400, INVALID_CORRECTION_TARGET 제안. 대상의 본문이나 다른 Ticket 정보는 미노출 |
| 같은 제출 ID에 다른 본문 또는 정정 대상 | 409, REPLY_REQUEST_CONFLICT |
| 저장 또는 Commit 실패 | 안전한 500. 기존 Ticket과 Message 보존, 성공으로 기록하지 않음 |

이 오류 계약과 신규 예외의 고정 코드는 구현 전에 최종 대조한다. Application의 권한 거부와 충돌 예외가 기존의 일반 500 처리에 묻히지 않도록 전용 응답과 Test를 둔다. 본문, 작성자, Session과 CSRF 값, 내부 SQL 예외를 오류 응답이나 Log에 담지 않는다.

## Transaction, 중복 제출과 계층 책임

```text
Browser의 Session과 CSRF
  → Security의 Role 검사
  → Controller의 입력 변환
  → Application Service의 Ticket 권한과 정책 검사
  → 짧은 Transaction의 공식 답변 저장
  → Commit 뒤 응답
```

Controller에는 소유권 비교나 SQL을 넣지 않는다. Spring Authentication을 기반으로 확인한 서버 측 Actor를 Application에 전달하고, Application Policy가 권한과 상태를 판정한다. 인증 계정에서 고정 ID를 확인하는 책임도 분리해 설계하며 연결을 추측하지 않는다. Domain은 Message 종류와 본문 규칙을, Repository Port와 JDBC Adapter는 영속성과 원자적 중복 방지를 맡는다. 신규 기능은 postgres Profile에서만 제공하고 In-memory로 조용히 대체하지 않는다.

답변 저장은 Ticket Row의 짧은 잠금 안에서 최신 정책 조건을 확인한 뒤 수행하는 안이다. 모든 새 대화 쓰기는 같은 Ticket을 먼저 잠그고 Message ID를 발급하며, 같은 Ticket의 두 답변을 직렬화한다. ID 발급 순서 자체가 Commit 순서라는 가정은 하지 않는다. 미래 고객 Message 작성에도 이 규칙을 적용하거나 조회 Cursor를 다시 검토해야 한다.

답변 INSERT와 결과 판정 중 외부 AI나 다른 외부 서비스를 호출하지 않는다. Unique Index와 ON CONFLICT 계열의 원자적 처리를 사용하고, 실패로 중단된 Transaction 안에서 예외만 잡아 정상 조회를 계속하는 구현은 피한다. 같은 제출의 기존 Row, 본문과 정정 대상을 확인해 재전송 결과를 결정한다. 정정 대상 검증과 새 답변 저장도 같은 Ticket의 짧은 Transaction에서 수행한다.

권한과 요청 형식 검증 뒤 같은 제출의 기존 저장 결과부터 확인한다. 기존 결과와 본문 또는 정정 대상이 다르면 409이며, 새로운 제출일 때 정정 대상의 같은 Ticket 소속과 공식 답변 여부를 검사한다. 중복 요청의 충돌 판정과 새 요청의 잘못된 대상 거부가 뒤섞이지 않도록 Test한다.

Browser는 작성한 답변의 제출 ID를 재전송에도 유지한다. 본문이나 정정 대상을 고친 새 제출에는 새 ID를 사용한다. 결과가 불명확할 때 새 ID를 만들어 자동 재전송하지 않는다. 사용자 확인 후 같은 ID로 재전송해 기존 저장 결과를 확인할 수 있다. 사용자나 Ticket이 바뀌면 이전 제출 ID를 재사용하지 않는다.

이 중복 방지는 같은 Ticket, 작성자와 제출 ID의 범위다. Browser 새로고침 등으로 제출 ID를 잃은 뒤 새 ID로 다시 작성한 요청까지 같은 답변으로 식별한다고 주장하지 않는다. 본문이 같다는 이유만으로 서로 다른 제출을 합치지도 않는다.

신규 답변 Transaction의 실패는 그 답변만 취소한다. 이미 Commit된 문의, 기존 답변과 Suggestion은 되돌리지 않는다. 조회는 읽기 전용이며 Job, Attempt, 예약이나 Ticket 상태를 갱신하지 않는다.

## 최소 화면 제안

- 별도 대화 화면에서 Ticket ID로 최초 문의와 공식 답변을 조회한다. 전체 Ticket 목록은 만들지 않는다.
- canReply인 AGENT에게만 공개 안내와 답변 입력을 표시한다. USER는 읽기만 가능하다.
- 본문은 textContent로 표시하고 줄바꿈만 보존한다. HTML과 Markdown 실행은 지원하지 않는다.
- 답변 저장 중 중복 클릭을 막되 서버의 중복 방지 Test도 별도로 둔다.
- 저장 성공, 권한 거부, 입력 오류, 결과 미확인과 로그인 필요를 구분한다. 결과 확인 전 본문을 지우지 않는다.
- 같은 화면에서 Ticket을 바꿀 때 이전 조회의 늦은 성공이나 오류가 새 대화를 덮어쓰지 않게 한다.
- 답변 저장 후 필요한 대화 페이지를 다시 조회하고 Message ID로 중복 표시를 막는다.
- 일반 안내와 정정을 구분하고 정정일 때 같은 Ticket의 공식 답변을 선택한다. 저장된 대화에는 정정 대상 ID를 표시하며 원래 답변을 지우거나 내용을 대체하지 않는다.
- 다른 계정으로 전환하거나 로그아웃하면 이전 대화와 작성 상태를 지운다. 답변 본문을 localStorage에 남기지 않는다.

## 검증 계획

| 계층 | 확인할 Case와 증거 |
|---|---|
| Domain | 공백, 경계 길이와 Emoji, 원문 보존, 문의와 공식 답변 구분 |
| Migration | V8 및 Message 없는 V1 Ticket의 보존, 등록자 미확인 유지, 잘못된 Role 추론 없음 |
| 등록자 식별 | 인증 계정과 고정 ID 연결. 로그인 이름 변경 또는 같은 이름의 다른 계정이 소유권을 넘겨받지 않음. 재시작 후 ID 유지 |
| 인증 연결 | 필요한 ID 연결이 없거나 잘못됐을 때 신규 접수 및 답변 쓰기와 USER 소유권 조회를 거부. 이름 대체나 자동 연결 없음 |
| 정정 | 같은 Ticket의 공식 답변 정정, 잘못된 대상 거부, 대상만 바꾼 같은 제출 ID 충돌, 생략 및 null의 동일 취급, 기존 Row 보존과 정정 표시 |
| PostgreSQL | 정상 1건, 중복 재전송 1건 유지, 본문 충돌 거부, 동시 제출과 원래 Row 보존, 저장 및 Commit 실패 |
| Security와 API | 서로 다른 USER 두 명의 격리, AGENT의 전체 조회, GET과 HEAD, 작성자 위조, CSRF와 미인증, 안전한 오류 |
| 기존 접수 회귀 | Ticket, INQUIRY, 등록자와 Job의 원자성. Job 실패 시 전체 접수 Rollback 유지 |
| AI 회귀 | 최초 INQUIRY와 기존 input_message_id 유지. 공식 답변 및 조회 후 Job과 Attempt, 예약, Suggestion 불변 |
| JavaScript | 응답 계약, textContent, 중복 클릭, 같은 제출 ID 재사용, 결과 미확인과 조회 Race |
| Browser와 DB | USER A 문의 등록, AGENT 답변, USER A 조회, USER B 거부. 재로그인 뒤 같은 답변 조회와 Row 대조 |

실제 PostgreSQL과 통제된 합성 계정을 사용한다. USER A와 B는 서로 다른 계정이며 실제 Credential을 기록하지 않는다. AI Provider와 Worker는 끄고, 답변 처리의 Provider 호출 0회는 Test Double 계측으로도 확인한다. 새 유료 AI 호출이나 Cloud 실행은 필요하지 않다.

Migration, Repository와 권한의 Focused Test부터 실행했다. 실제 Browser에서는 서로 다른 USER 두 명과 AGENT의 Session, CSRF, 답변과 정정, 원문 보존 및 재로그인을 확인했다. Java 및 JavaScript 전체 회귀와 최종 수치는 실행 보고서로 연결한다.

## 제안의 이유와 영향 범위

| 주제 | 비교한 안 | 이번 권장안과 이유 |
|---|---|---|
| 저장 구조 | 답변 전용 Table 또는 Message 확장 | Message 확장. 기존 Ticket 컨테이너와 대화 모델 유지 |
| 고객 식별 | 현재 계정으로 소유자 보충, username 고정, 영속 User ID 신설 | P4 및 P7 합의. 기존 로그인을 유지하고 고정 UUID와 BIGINT ID를 명시적으로 연결 |
| 공개와 상태 | 초안 및 승인, 저장 즉시 공개, 답변과 자동 해결 결합 | P1 및 P2 합의. 즉시 공개, 상태 분리, RESOLVED의 안내 허용 |
| 보존 | 덮어쓰기 또는 추가 저장 | P3 합의. 정정은 추가 저장, 삭제 운영 정책은 별도 |
| 기존 미확인 등록자 | 임의 할당, AGENT만 조회, AGENT 답변도 허용 | P5 합의. AGENT 조회만 허용하고 새 답변 거부, 잘못된 고객 공개 방지 |
| 재전송 | 버튼 방지만 또는 DB 중복 방지 | P6 합의. 제출 ID와 DB Unique로 같은 제출 키의 중복 방지 |
| 정정 대상 | 본문만 작성 또는 명시적 Message 참조 | P8 합의. 기존 답변을 덮어쓰지 않고 같은 Ticket의 공식 답변을 참조 |
| 순서와 조회량 | 전체 목록 또는 제한된 페이지 | Ticket별 짧은 쓰기 잠금과 제한된 ID Cursor. 실제 계획과 동시성 Test로 확인 |

예상 영향은 Ticket과 Message Domain 및 Repository, 접수 Service, 신규 대화/답변 Service와 Controller, Security matcher, 신규 DTO와 오류 처리, 다음 Migration, 새 화면과 관련 Test다. 기존 AI 조회의 최초 Message 선택에는 INQUIRY 조건을 명시하는 방안을 함께 검토한다. 기존 input_message_id, Worker의 한도와 재시도 정책은 바꾸지 않는다.

핵심 정책 검토 뒤 구체적인 Schema와 API 및 Test 기준을 Lab 계약에 반영하고, 별도 구현 요청에 따라 업무 코드와 V9를 추가했다. 과거 회차의 비범위 및 미착수 기록은 당시 상태로 보존한다.

## 정책 검토 기록

| 날짜 | 확인한 결정과 근거 | 문서 영향과 후속 검토 |
|---|---|---|
| 2026-10-23 | 사용자가 P1에 동의하고 P2 상태 분리 및 RESOLVED 안내, P3 정정 추가 저장을 선택 | P1~P3를 합의로 변경. 기존 데이터와 로그인 이름 식별까지 승인된 것으로 확대하지 않음 |
| 2026-10-23 | 고객 소유권을 구현하려면 식별자와 구형 Row의 예외를 별도로 검토할 필요 | P4~P6를 다음 질문으로 분리. ID 필드와 Unique 키는 선택 전 조건부 제안. 구현량은 주간 가용시간에 따라 재배정 |
| 2026-10-23 | 사용자가 P4~P6의 고정 ID, 미확인 등록자 조회 및 답변 제한, 같은 제출의 중복 방지에 각각 동의 | P4~P6를 합의로 변경. 고정 ID 참조와 Unique 키를 맞추고 P7의 최소 인증 연결 및 P8의 정정 대상 연결을 다음 검토로 분리. 구현은 미착수 |
| 2026-10-23 | 사용자가 P7의 기존 로그인 유지 및 최소 ID 연결, P8의 정정 대상 참조에 각각 동의 | P1~P8 핵심 정책 합의 완료. 추가 필수 업무 정책은 현재 식별하지 못했으며 남은 기술 계약과 검증을 별도로 정리. 정정 필드 및 재전송 비교 범위 반영, 구현과 Commit은 미실행 |
| 2026-10-23 | 사용자가 기술 설계 구체화, 작은 단위의 구현·Test 및 Commit 요청 | Lab 계약, V9와 명시적 고정 ID 연결, API·권한, 최소 화면 구현. 로컬 검증으로 한정하며 Push·AWS·실제 AI는 미실행 |

## 확인한 Source와 미확인 범위

초안 작성 때 Lab의 고정 Source에서 아래 파일을 읽었다. 이후 변경한 파일과 현재 검증 범위는 실행 보고서에 별도로 기록한다. 아래 표는 초안 조사 범위이며 현재 구현 검증 결과를 대신하지 않는다.

- V1, V2와 V8 Migration, Ticket과 TicketStatus 및 TicketMessage
- TicketRepository와 TicketMessageRepository, JdbcTicketMessageRepository
- TicketReceiptApplicationService, TicketApplicationService, TicketReceiptController와 TicketController
- CreateTicketReceiptRequest와 TicketApiExceptionHandler
- SecurityConfiguration, LocalBrowserSecurityConfiguration과 DeploymentSecurityConfiguration
- JdbcAiSuggestionQueryRepository, JdbcAiSuggestionInputRepository와 JdbcAiSuggestionJobRepository
- ticket-ui.mjs와 ticket-page.mjs, TicketReceiptMigrationIntegrationTest

| Source 범위 | 검토 상태 | 선택 범위와 한계 |
|---|---|---|
| 위에 나열한 Domain, Migration, Service, Repository, Controller, Security와 UI Source 및 Migration Test | VERIFIED | 각 파일 전체 확인. 이 설계의 동작 Test를 실행한 것은 아님 |
| Lab README | PARTIAL | 현재 목적과 범위, Domain 규칙, 개발 규칙과 비범위 선택 검토. 과거 배포 절차는 제외 |
| 기존 접수 HTTP와 Security Test | PARTIAL | 관련 Case 목록 확인. 두 Test 파일 전체는 미검토 |
| 그 외 구현 Repository 전체 | NOT_INSPECTED | 파일 목록과 관련 경로를 선택했으며 전수 Code Review는 수행하지 않음 |

- [Lab 기준 Source](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/tree/832b1b74ab7666a5bf50c9aa702b14f97b517d59)
- [V2 Message와 Job Schema](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/blob/832b1b74ab7666a5bf50c9aa702b14f97b517d59/src/main/resources/db/migration/V2__create_ticket_messages_and_pending_jobs.sql)
- [현재 Security 계약](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/blob/832b1b74ab7666a5bf50c9aa702b14f97b517d59/src/main/java/lab/helpdesk/security/SecurityConfiguration.java)
- [깊은 수직 학습과 수평 확장의 경계](../plan/decisions/0002-depth-first-ai-assisted-expansion.md)
- [PostgreSQL 17의 Constraint](https://www.postgresql.org/docs/17/ddl-constraints.html), [INSERT와 ON CONFLICT](https://www.postgresql.org/docs/17/sql-insert.html), [Row Lock](https://www.postgresql.org/docs/17/explicit-locking.html), [조회 순서와 LIMIT](https://www.postgresql.org/docs/17/queries-limit.html)

PostgreSQL 설계 점검 지침은 외래 키 및 조회 Index, 기존 데이터 보존과 짧은 Transaction의 검토에 사용했다. Supabase로의 전환, RLS 도입이나 측정하지 않은 성능 향상은 제안하지 않는다.
