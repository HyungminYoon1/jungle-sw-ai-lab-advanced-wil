# AI Suggestion 계약 초안

> 상태: 입력·접수·예약·결과 저장과 선택 Worker의 대기·저장 재시도·조건부 결과 불명 복구 확인 — 실제 JVM 재시작·조회·Browser는 남아 있음
> 작성일: 2026-09-29
> 최종 수정일: 2026-10-06
> 논리적 계약 Version: `v2.1-draft` — v2의 출력 구조를 유지하고 전체 Priority의 의미를 보완
> 구현 상태: PostgreSQL HTTP 접수·V3 실행권·V4 결과 저장·Spring AI Adapter·V5 대기 예약·V6 저장 재시도·V7 Attempt 결과와 선택 Worker의 조건부 복구 구현. 전체 무료 Java Clean Test 384개·JavaScript 104개와 ESLint 통과. 실제 Java AI→PostgreSQL 단일 Live 실험은 앞선 한 건이며, 실제 JVM 재시작·조회·Browser·수동 내용 평가는 후속 과제

이 문서는 Week 7의 한 수직 흐름에 필요한 입력·출력·권한·저장·실패 계약을 검토하기 위한 초안이다. 출력 구조 v2는 단일 `category` 문자열을 복수 값을 담는 `categories` 목록으로 변경한 **우리 Application의 논리적 Schema 초안**이다. `v2.1-draft`에서는 구조를 바꾸지 않고 개별 문제와 누적·결합 영향을 함께 보는 Priority 기준을 추가했다. OpenAI 최소 비교에는 별도의 전송용 Schema와 이전 계약 `v2-draft`를 사용했다. 그 결과가 전체 논리적 계약이나 Spring 저장 흐름의 Test 통과를 뜻하지는 않는다. [최소 비교 기록](./lab-reports/2026-10-02-openai-structured-output-pilot.md)

## 현재 기준과 합의한 Ticket·Message 모델

- 현재 Lab의 `POST /api/tickets`는 `in-memory`에서 제목만, `postgres`에서는 제목·본문을 받아 `USER`·`AGENT`가 접수할 수 있다. `GET /api/tickets/{id}`는 `AGENT`만 읽는다. Worker는 선택 활성화 설정이며 유료 Provider의 Runtime 자동 조립은 아직 추가하지 않았다.
- Ticket은 한 주제의 대화와 처리 상태를 관리하는 묶음이다. 고객 문의와 고객에게 게시한 응대팀 답변은 각각 `ticket_messages`의 Row로 두고 Ticket을 참조한다. Ticket과 Message의 관계는 1:N이다.
- 최초 문의도 Message 한 건이다. `tickets.description`에 같은 본문을 중복 저장하지 않는다. 앞서 검토한 nullable `description` Column 추가안은 이 모델로 대체한다. 해당 Column은 아직 구현되지 않았다.
- PostgreSQL의 새 접수 Request Field는 `title`·`body`로 확정했다. 제목과 공백이 아닌 최초 메시지 본문을 함께 받으며, 응답은 기존 `id`·`title`·`status`를 유지한다. 최초 Message·Job은 접수 Transaction으로 저장하고 응답을 AI 완료로 해석하지 않는다.
- 기존 Ticket Row에는 메시지를 임의로 만들지 않는다. 기존 문의는 Message 0건인 상태로 계속 조회하며, 제목 복사·`없음` 문자열·AI 생성 글로 없는 원문을 채우지 않는다.
- Week 7에서는 최초 메시지 저장과 AI 연결만 구현한다. 후속 메시지·공식 답변 작성, 내부 메모와 대화 UI 확장은 Week 9 이후 범위다. AI Suggestion은 공식 답변 Message로 자동 게시하지 않는다.
- AI 입력은 Server가 조회한 제목과 최초 문의 메시지다. 작업에 입력 메시지 식별자를 연결하는 안을 사용하며, 메시지가 해당 Ticket에 속하는지도 검증한다. 대화 전체 입력·메시지 수정에 따른 Version 정책은 이번 초기 흐름에서 다루지 않는다.
- 최초 메시지 본문은 앞뒤 Java `String.strip()` 공백을 제외한 2,000 Unicode Code Point로 제한한다. DTO와 Domain에서 검사하고 초과하면 자르지 않고 `400`으로 거부한다. 길이 계산용 복사본과 저장 원문을 구분해 통과한 본문은 공백까지 그대로 저장한다. Byte·사용자에게 보이는 글자 묶음·UTF-16 Code Unit의 개수와는 다른 기준이다.

Message의 `body`는 `NOT NULL`과 공백·길이 검증의 대상으로 삼는다. 기존 Ticket에 Message가 없는 것과 존재하는 Message의 본문이 비어 있는 것은 다르다. 새 접수의 최초 Message 필수 규칙은 Application과 실제 PostgreSQL Test에서 확인한다. 메시지가 없는 기존 Ticket으로는 Provider를 호출하지 않는다.

## AI 전송 전 민감 정보와 보안 신호

문의의 처리 우선순위와 입력에서 관찰한 보안 신호를 분리하는 방향에 합의했다. 로그인 복구 뒤 만료 이유를 묻는 통상 문의는 본문에 Injection 의심 문구가 있어도 그 문구만으로 `HIGH`가 되지 않는다. 별도의 보안 신호 코드 후보는 `PROMPT_INJECTION_SUSPECTED`이며, 단순 문구 탐지만으로 실제 침해나 사용자의 악의를 확정하지 않는다. 탐지 기준·보안 위험 등급·안전한 기록 방식은 후속 검토한다.

보안 신호를 제안의 `categories`·`priority`에 섞거나 새 출력 Field로 추가하지 않는다. 현재 허용값에는 `SECURITY`·`LOW`·`OTHERS`가 없으며 기존 네 Field 계약은 유지한다. 실제 피해와 관측 결과에 따른 보안 대응은 고객 문의의 Priority와 별도로 판단한다. 새로운 관제 시스템이나 자동 사용자 차단은 이번 범위에 추가하지 않는다.

외부 AI로 전송할 복사본에서 요약·분류에 불필요한 주소·연락처·비밀값을 제거하거나 치환하는 방향에도 합의했다. 전처리는 Provider 호출 전에 Server에서 수행할 대상으로 삼는다. AI 출력에서 값을 지우는 것만으로 이미 이루어진 외부 전송을 막았다고 보지 않는다. 전송용 복사본 처리로 접수 원문의 DB Row를 덮어쓰지 않으며, 원문의 열람 권한·보관 기간·실수로 포함된 비밀값의 보관 정책은 별도 검토한다.

종류가 의미를 보존하는 데 필요하다면 일괄 `[REDACTED]` 대신 `[EMAIL_REDACTED]`·`[PHONE_REDACTED]`처럼 값은 가리고 확인한 종류는 남긴다. 수단을 모르는 연락처는 `[CONTACT_REDACTED]`, 종류를 모르는 민감 값은 `[REDACTED]`로 치환한다. 임의로 종류를 추측하지 않으며, 같은 값에 서로 다른 종류를 지정한 설정은 거부한다. 알려진 값·종류를 받는 치환과 임의의 개인정보 탐지는 분리한다. 전처리에서 로그인 복구 사실이나 문의 목적을 삭제하지 않는다.

개인정보 전처리 실험에는 실제 AI 모델을 사용한다는 사용자 요청을 반영한다. 실제 개인정보·Credential은 넣지 않고 합성 자리표시자만 사용한다. 전처리 함수의 결과뿐 아니라 실제 HTTP 전송 직전 직렬화된 요청 Body의 모든 Model 입력을 검사한다. 작업 지시·제목·본문 등에 불필요한 값이 없는지 확인하고, AI 요약에 그 값이 없는지는 별도 출력 검사로 기록한다. Runtime 요청 원문이나 Credential을 Log로 출력하지 않는다. 10/5 실험의 하루 누적 상한은 $1로 승인됐다. 개인정보 예비 실험 6회와 고정 Dataset 비교 52회의 실제 결과를 [비교 기록](./lab-reports/2026-10-05-ai-output-policy-comparison.md)에 정리했다.

`AiInputPrivacyGuard`는 알려진 합성 값과 종류를 받아 전송용 복사본을 만들고, 직렬화된 JSON 요청의 문자열 값·Property 이름을 검사하는 Java 구현이다. 치환·원문 재혼입 거부·종류 보존·업무 사실 보존을 포함한 Unit Test 32개에 이어 단일 Processor와 Spring AI Adapter의 전송 경로에도 연결했다. 임의의 개인정보 탐지기는 구현하지 않았다. 선택한 Test의 성공을 모든 민감 정보 탐지나 Injection 차단의 보장으로 확대하지 않는다. 입력과 지시 분리·개인정보 제거·후속 Tool 검증을 함께 적용하는 원칙은 [OpenAI 안전 설계 가이드](https://developers.openai.com/api/docs/guides/agent-builder-safety), 최소 전송·로그 마스킹 원칙은 [OpenAI 데이터 취급 가이드](https://developers.openai.com/plugins/guides/security-privacy)를 참고한다.

실험용 `AiInputPrivacyRequestBridge`는 요청의 사용자 입력에 담긴 JSON을 해석해 제목·본문을 치환하고, 검사한 직렬화 문자열을 반환한다. Node.js 실행기는 그 문자열을 변경하지 않고 전송한다. 제목·본문의 직렬화 순서를 고정한 Test를 포함해 Bridge Test 14개가 통과했다. 이후 공통 Prompt Test를 보완한 JavaScript 전체 74개도 통과했다. 실제 Java 전처리를 거친 Dry run의 호출 0회와 전용 PowerShell에서 실행한 실제 6회·52회는 별도 근거다. 이 Bridge는 Test Source에 둔 실험 도구이며 Spring Provider Adapter를 대신하지 않는다.

실험의 비용 관리에서는 메모리 누계만 두는 안 대신 호출 전 예약과 파일 누계 보존을 선택했다. 여러 번 실행해도 당일 상한을 이어서 확인하고, 중단 뒤 전송·사용량을 알 수 없는 호출을 무료로 간주하지 않기 위해서다. 실행기 외의 선행 비용은 최초 기록에 반영하며, 다른 실험이 실행 중이거나 미정산 예약이 남으면 새 호출을 거부한다. 합성 전송용 입력·선택한 응답·사용량은 Git 제외 실험 결과로 보관하고 원문 Prompt 전체·Header·Credential은 보관하지 않는다. 이 정책은 독립 평가 실행기 범위이며 Job의 호출 상한·Attempt 정책을 변경하지 않는다. 후속 검토는 실제 응답의 사용량과 일일 누계 대조다.

## 문의 접수와 AI 처리의 Transaction 경계 — 합의

사용자 문의는 AI와 독립적인 원본 업무 데이터다. 새 접수에서는 Ticket·최초 Message·그 Message를 입력으로 삼는 `PENDING` Job을 같은 짧은 PostgreSQL Transaction으로 Commit한다. Message나 Job 저장이 실패하면 접수 전체를 Rollback하고 성공 응답을 보내지 않는다. 접수가 Commit된 뒤 AI 호출·출력 검증·제안 저장이 실패해도 Ticket과 최초 Message는 유지한다.

```text
접수 Transaction
  → Ticket 저장
  → 최초 문의 Message 저장
  → 해당 Message의 PENDING Job 저장
  → Commit
  → Browser에 201 Created

별도 AI 처리
  → Worker가 Commit된 Job을 조회하고 실행권 확보
  → 저장된 입력 조회
  → Provider 호출: 접수 Transaction 밖에서 실행
  → 출력 검증
  → 유효한 Suggestion 저장
```

최종 방식은 B, 즉 접수 처리는 AI 완료를 기다리지 않고 `201`을 응답하며 Server가 별도로 AI를 처리하는 방식이다. 담당자가 수동으로 제안을 생성하는 별도 `POST /api/tickets/{id}/suggestions`는 초기 범위에서 제거한다. 접수의 `201`은 사용자 문의 저장과 처리할 Job 등록의 완료를 뜻하며 AI 제안 완료를 뜻하지 않는다. Worker의 실행 조건은 접수 Commit이며, Browser의 응답 수신을 확인한 뒤에만 실행한다는 뜻은 아니다.

원문을 먼저 Commit한 뒤 Job을 별도로 등록하는 안과 비교해, 같은 Transaction에 Job을 등록하는 안을 채택했다. 두 Commit 사이의 중단으로 문의만 있고 작업 기록은 없는 상태가 생기는 것을 막기 위해서다. 대신 Job 등록 실패도 접수 실패가 되는 선택을 명시한다. 이는 접수 완료 이후의 AI 실패로 원문을 취소하는 것과 다르다.

Job Row는 실행할 작업의 기록이지 AI 실행 자체가 아니다. Commit 직후 메모리 알림이 누락돼도 Server 시작 시와 주기적인 조회로 `PENDING` Job을 다시 찾도록 설계한다. 단일 Claim·예약·처리는 확인했으며 자동 조회·실행과 실제 중단 복구는 후속 구현이다. DB에 Job을 저장했다는 사실만으로 자동 복구 완료라고 하지 않는다. 단일 Application과 PostgreSQL을 사용하고 Message Broker는 추가하지 않는다.

업무 데이터와 처리할 작업을 같은 Transaction에 기록하는 원리는 [AWS의 Transactional Outbox 설명](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)을 참고했다. 이 Lab에서는 별도 Broker 전송 대신 DB Job을 Worker가 조회하는 설계에 적용한다. Provider 중복 실행·비용까지 정확히 한 번으로 만드는 장치는 아니다.

### 접수 저장의 첫 구현

`TicketReceiptApplicationService.receive`에서 Ticket·최초 Message·`PENDING` Job을 같은 Transaction으로 저장했다. 실제 PostgreSQL에서 정상 접수의 각 Row 1건, Message·Job INSERT 실패 뒤 세 Table의 Row 0건, 같은 Message의 중복 Job과 없는 부모를 참조하는 저장의 거부를 확인했다. V1에 만든 기존 Ticket을 V2 적용 뒤에도 보존하는 Test를 포함해 새 Test 15개가 통과했다. 전체 Java Clean Test는 76개, 기존 JavaScript 회귀는 54개 통과했다. [접수 원자성 실험](./lab-reports/2026-10-03-ticket-receipt-atomicity-lab.md)

첫 Service 실습 이후 10/5에는 PostgreSQL의 `POST /api/tickets`를 접수 Service에 연결했다. 작성자의 `author_username`은 `Authentication.getName()`에서 받은 이름 Snapshot이며 영속 User ID나 소유자 권한의 근거가 아니다. HTTP Test는 서로 다른 USER·AGENT의 로그인 Session을 사용해 작성자를 확인했다. 작성자·Role을 요청에 추가해도 저장 작성자는 서버의 인증 결과를 따른다. 기존 Parser의 추가 Field 처리는 바꾸지 않았고, 제공한 작성자·Role 값은 무시되는 것을 확인했다.

승인한 실행 모드 분리안에 따라 `in-memory`의 제목 전용 생성 실험을 별도 Controller로 보존하고, `postgres`에서만 새 접수 Controller와 Service를 활성화했다. 조회 Controller는 공통으로 사용하며 Controller에서 DB·Provider 호출이나 Profile별 저장 로직 분기를 하지 않는다. 저장 Profile은 둘 중 하나를 명시한다. 두 실행 모드의 `201`이 같은 저장 범위를 뜻하지 않는다.

실제 Security·MVC·JDBC·PostgreSQL을 사용하는 새 HTTP Test 17개와 Domain 길이 Test 4개, 전체 Java Clean Test 207개·JavaScript 79개가 통과했다. 원문·작성자·Job Commit, 본문 검증·CSRF·익명 거부, Message·Job 실패 시 Row 0건과 안전한 Log를 확인했다. UI의 새 본문 입력은 준비했으며 실제 Browser E2E는 아직 실행하지 않았다. [HTTP 접수 검증](./lab-reports/2026-10-05-ticket-receipt-http-lab.md)

V2는 Message와 초기 Job만 추가하며 Job 상태를 `PENDING`으로 제한한다. V3는 정책 Snapshot·현재 Attempt·호출 예약 원장·처리 기한과 `RUNNING`·`FAILED`를 추가한다. V4는 기존 Migration을 바꾸지 않고 Suggestion·복수 Category와 `SUCCEEDED`·`ABSTAINED`의 결과 저장을 추가한다. Job 등록·실행권 확보와 결과 저장 완료를 구분한다.

## Job 등록과 실행권의 경계 — 합의

- 같은 최초 Message의 초기 Job은 최대 한 건이다. `UNIQUE (input_message_id)`로 중복 등록을 막으며 같은 작업의 재시도는 기존 Job과 누적 한도를 사용한다. 새 Job을 만들어 한도를 초기화하지 않는다.
- Row Lock은 DB 변경 시의 경쟁을 막고, 저장된 상태·현재 Attempt는 Commit 뒤에도 실행권을 표현한다. Row Lock을 얻었다는 사실만으로 새 AI 호출을 허용하지 않는다. 재시도 조건·남은 생성 한도·전체 기한을 확인하고 실행권과 호출 예약을 함께 Commit한 뒤 Provider를 호출한다.
- AI 응답을 기다리는 동안 DB Transaction이나 Row Lock을 유지하지 않는다. 실행권의 유효 기한과 중단 복구 조건은 DB Lock의 수명과 별도로 정한다.
- 결과 반영 시에는 현재 Attempt와 작업 상태를 보호된 DB 변경 구간에서 확인한다. Suggestion 저장과 `SUCCEEDED` 기록은 같은 결과 저장 Transaction이다. 일반 SELECT로 확인한 뒤 저장하는 것만으로는 그 사이의 실행권 교체를 막지 못한다.
- 이전 Attempt의 늦은 성공·실패는 현재 Job과 제안을 변경하지 못한다. Schema 통과는 실행권이나 내용의 사실성을 대신하지 않는다.
- 생성 한도 소진은 새 생성 요청을 막는다. 현재 실행권과 검증 조건을 만족한 기존 응답의 저장까지 금지하지 않는다. 결과 저장 실패로 접수 완료된 Ticket·Message를 Rollback하지 않는다.

V2의 같은 Message 초기 Job Unique에 이어 V3의 실행권·호출 예약을 구현한다. 일반 조회는 실행 가능한 `PENDING` Job만 대상으로 하며, 기한이 지난 `RUNNING` Job의 재예약은 가능한 기존 결과 확인 뒤 호출할 별도 경로로 나눈다. 결과 확인 자체와 Provider 연결, Suggestion 저장은 이 실행권 구현과 구분한다.

## 제안 데이터와 작업 상태 — 최소 설계 잠정안

| 대상 | 책임 | 최소 정보 후보 |
|---|---|---|
| `tickets` | 대화 주제와 문의 처리 상태 | ID·제목·Ticket 상태 |
| `ticket_messages` | 실제 작성된 문의·답변 | ID·Ticket ID·본문·작성자 식별자·작성 시각 |
| `ai_suggestion_jobs` | 제안 생성 작업의 진행·결과 | ID·입력 Message ID·작업 상태·시도 횟수·안전한 실패 코드·처리 시각·Prompt/Schema Version |
| `ticket_suggestions` | 검증을 통과한 제안 내용 | ID·Job ID·요약·우선순위·담당자 검토 상태·생성 시각 |
| `ticket_suggestion_categories` | 한 제안의 복수 분류 | Suggestion ID·Category. 같은 조합은 한 건만 저장 |

Message의 작성자 정보는 Server의 인증 결과를 기준으로 결정한다. Browser가 다른 작성자 이름이나 Role을 보내더라도 그 값을 작성자 결정의 근거로 사용하지 않는다. Runtime 인증은 현재 In-memory 사용자 구성이라는 점을 유지하고, 사용자 영속 Table과 작성자 식별자의 관계는 별도 검토한다. 기존 `USER`·`AGENT` 권한을 소유자 기반 권한으로 조용히 변경하지 않는다.

| 작업 상태 후보 | 의미 | 해당 작업의 Suggestion |
|---|---|---:|
| `PENDING` | 실행 대기 | 0건 |
| `RUNNING` | 처리 중으로 기록됨 | 완료 전 0건 |
| `SUCCEEDED` | 출력 검증과 제안 저장 Commit 완료 | 1건 |
| `ABSTAINED` | 계약에 맞는 명시적 판단 보류 결과를 기록함 | 0건 |
| `FAILED` | 호출·검증·저장에서 최종 실패 | 0건 |

유효한 요약과 `UNDETERMINED`가 있는 제안은 저장할 수 있다. 이 경우 작업은 `SUCCEEDED`, 제안 검토는 `PENDING_REVIEW`, 문의 상태는 `OPEN`일 수 있다. 작업 성공은 내용의 정확성이나 문의 해결을 확정한 상태가 아니다. 작업 상태는 Model이 정하지 않고 Server가 실제 처리 결과로 결정한다.

유효한 `ABSTAIN`이면 Job을 `ABSTAINED`로 기록하고 Suggestion은 만들지 않으며 원본 Ticket·Message는 유지하는 기준에 합의했다. 이는 유효한 요약 자체를 만들 수 없어 제안 생성을 명시적으로 보류한 결과다. 요약은 만들 수 있지만 분류·긴급도만 모르는 경우에는 `SUGGEST`와 `UNDETERMINED`를 사용한다. Provider 거부·잘못된 JSON·필수 Field 누락을 `ABSTAIN`으로 바꾸지 않는다. 제목·본문 모두에서 문의 의미를 해석할 수 없는 사례를 아래에서 확인했으며, 추가 경계 사례와 조회 응답 표현은 계속 검토한다.

`ABSTAINED`도 결과 기록이 DB에 반영된 뒤에 확정할 상태다. DB 장애로 결과나 실패 상태를 기록하지 못하면 `RUNNING`이 남을 수 있으므로, 그 값만으로 실제 작업이 계속 실행 중이라고 단정하지 않는다.

학습은 기본 처리 Test → B 방식 연결 → 단일 Application·PostgreSQL의 최소 중단 복구 순서로 진행한다. 기본 처리 Test는 이미 Commit된 입력을 사용해 성공·잘못된 출력·Provider 실패·제안 저장 실패를 먼저 분리한다. 이는 API를 A 방식으로 완성하겠다는 뜻이 아니다. 이후 미완료 작업 조회·재처리 한도·같은 작업의 중복 제안 저장 방지를 확인한다. Kafka·RabbitMQ와 분산 Worker 운영은 추가하지 않는다.

## AI 출력의 논리적 Schema v2 — 잠정안

Model은 Server가 정한 작업 지시와 Ticket 본문을 구분해야 한다. Ticket 본문 속 “이전 지시를 무시하라”는 문장은 데이터이지 권한 있는 명령이 아니다. Model 출력에 Ticket ID, 사용자 Role, Ticket 상태 또는 실행할 Tool 이름을 받지 않는다.

```json
{
  "decision": "SUGGEST",
  "summary": "로그인 링크가 만료되어 재발급이 필요함",
  "categories": ["ACCOUNT"],
  "priority": "NORMAL"
}
```

| Field | 잠정 허용값·규칙 |
|---|---|
| `decision` | `SUGGEST` 또는 `ABSTAIN` |
| `summary` | `SUGGEST`일 때 공백 제거 후 1~200 Unicode Code Point의 일반 텍스트 |
| `categories` | `SUGGEST`일 때 항목이 하나 이상인 중복 없는 목록. 각 항목은 `ACCOUNT`, `BILLING`, `TECHNICAL`, `OTHER`, `UNDETERMINED` 중 하나. 단일 문의도 목록으로 표현하며 `UNDETERMINED`는 분류 근거 부족을 나타내는 예약값 |
| `priority` | `SUGGEST`일 때 `NORMAL`, `HIGH`, `UNDETERMINED` 중 하나. `UNDETERMINED`는 긴급도 판단 근거 부족을 나타내며, Ticket의 확정 우선순위가 아님 |

아래는 위 규칙을 표현한 **검토용 JSON Schema 초안**이다. Provider가 `oneOf`·`const`를 그대로 지원한다는 뜻은 아니다. Provider별 지원 범위를 확인한 뒤 전송용 Schema를 조정하더라도 Application 검증 규칙은 유지한다.

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["decision", "summary", "categories", "priority"],
  "properties": {
    "decision": { "enum": ["SUGGEST", "ABSTAIN"] },
    "summary": {},
    "categories": {},
    "priority": {}
  },
  "oneOf": [
    {
      "properties": {
        "decision": { "const": "SUGGEST" },
        "summary": { "type": "string", "minLength": 1, "maxLength": 200 },
        "categories": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": { "enum": ["ACCOUNT", "BILLING", "TECHNICAL", "OTHER", "UNDETERMINED"] }
        },
        "priority": { "enum": ["NORMAL", "HIGH", "UNDETERMINED"] }
      }
    },
    {
      "properties": {
        "decision": { "const": "ABSTAIN" },
        "summary": { "type": "null" },
        "categories": { "type": "null" },
        "priority": { "type": "null" }
      }
    }
  ]
}
```

네 Field는 모두 필수이고 그 밖의 Field는 거부한다. 이전 `category` Field를 함께 보내거나 문자열을 목록 대신 보내면 v2 계약을 통과하지 못한다. JSON의 `null`은 Field 누락과도 다른 값이며, 그 업무상 의미는 계약에서 정해야 한다. 기존 Ticket의 원문 부재는 Message가 없는 상태로 보존하고, 문의 유형 전체를 판단할 정보가 부족하면 `categories: ["UNDETERMINED"]`로 표현한다. 긴급도 판단 근거가 부족하면 `priority: "UNDETERMINED"`다. 해당 Field가 누락되거나 `SUGGEST`에서 `null`이 오면 Schema 실패다.

`items`는 목록의 각 항목, `minItems: 1`은 빈 목록 금지, `uniqueItems: true`는 같은 값의 중복 금지를 표현한다. 배열 순서를 Category의 중요도나 담당 부서의 처리 순서로 해석하지 않는다. [JSON Schema의 배열 검증 설명](https://json-schema.org/understanding-json-schema/reference/array)

유효한 요약이 있다면 분류나 긴급도가 불확실하더라도 다음처럼 판단한 범위와 판단하지 못한 범위를 함께 저장한다.

```json
{
  "decision": "SUGGEST",
  "summary": "로그인이 되지 않는다고 문의함",
  "categories": ["ACCOUNT"],
  "priority": "UNDETERMINED"
}
```

이 제안은 `PENDING_REVIEW`로 저장한다. `UNDETERMINED`를 `NORMAL`로 대체하면 판단하지 못한 상태를 보통 우선순위로 판단한 것처럼 바꾸게 된다. 원문에 없는 장애 규모나 긴급성을 추가해서도 안 된다.

`OTHER`는 분류 근거가 있으나 알려진 세 Category에 속하지 않는 경우다. 문의가 "문제가 생겼어요. 확인해주세요"뿐이어서 종류를 알 수 없다면 `categories: ["UNDETERMINED"]`로 표현한다. 이는 실제 문의 종류를 하나 더 추가하는 것이 아니라 판단 결과를 나타내는 예약값이다.

아래는 유효한 요약 자체를 만들 수 없어 제안 생성을 보류하는 `ABSTAIN`의 Schema 표현이다. 유효한 `ABSTAIN`을 Job의 `ABSTAINED`로 기록하고 Suggestion은 저장하지 않는 기준에 합의했다. 분류·긴급도만 불확실한 위 Case와 구분하며, 이 표현의 Field 조합은 독립 Java 검증기 Test에서 확인했다.

```json
{
  "decision": "ABSTAIN",
  "summary": null,
  "categories": null,
  "priority": null
}
```

### 확인한 `ABSTAIN` 허용 사례

중립적인 제목 `문의`와 본문 `ㅁㄴㅇㄹ ???`처럼, 제목과 본문을 함께 보아도 의미 있는 문의 내용을 해석할 수 없다면 `ABSTAIN`을 허용한다. 이 입력을 로그인 오류 등으로 요약하면 원문에 없는 문의를 만들어낸다. 반면 “문제가 생겼습니다. 확인해주세요.”는 문제 확인을 요청했다는 사실을 요약할 수 있으므로 `SUGGEST`와 분류·우선순위의 `UNDETERMINED`를 사용한다. 이 구분에 사용자 동의를 받았다.

짧은 문장·오타·외국어라는 이유만으로 보류하지 않는다. 제목에 이해할 수 있는 요청이 있다면 본문만 보고 보류할 수도 없다. 특정 문자열을 Code에서 발견하면 무조건 보류하는 규칙이 아니라 문의 의미에 대한 평가 기준이다. Java 구조 검증기가 이 판단까지 수행하는 것은 아니다.

이 사례는 기존 13건·52회 본 평가에 추가하지 않고 별도 학습 사례로 기록했다. 이 기준은 공통 Prompt `prompt-v3-abstain-draft`에 두 비교 방식 모두 반영했고, 이후 `prompt-v4-policy-alignment`에서도 유지한다. 이 별도 사례의 실제 AI 판단과 Job `ABSTAINED` 저장은 아직 실행·검증하지 않았다. 입력이 과제에 맞지 않을 때의 처리 기준을 Prompt에 명시하라는 [OpenAI 공식 가이드](https://developers.openai.com/api/docs/guides/structured-outputs#handling-user-generated-input)를 참고했다.

JSON 문법과 Schema가 맞아도 요약이 원문에 충실하다는 뜻은 아니다. Application은 Field·Type·허용값·공백·길이·추가 Field와 `decision`별 조합을 재검증한다. 내용의 사실성은 고정 평가 Dataset과 담당자의 원문 대조로 별도로 확인한다. Prompt-only와 Provider Schema 강제 방식은 같은 논리적 계약으로 비교한다.

형식·값 검증만으로 자유로운 문장의 모든 누락·왜곡을 자동 판별할 수는 없다. 코드가 알아낸 계약 위반은 저장 전에 거부하지만, 그 검사를 통과한 내용에도 오류가 남을 수 있다. 저장된 제안은 `PENDING_REVIEW`이며 원문을 보존한다. Dataset에서 확인한 품질을 이후 모든 요청의 사실성 보장으로 바꾸거나, 추가 AI 평가를 정답 판정기로 취급하지 않는다.

## Category와 Priority의 판단 기준

Category는 실제로 해결을 요청한 문제의 유형이지 장애 원인이나 책임 주체가 아니다. `ACCOUNT`·`BILLING`·`TECHNICAL`은 상하위 관계가 아닌 동등한 수준의 문의 유형으로 정의하고, 여러 유형이 해당하면 함께 담는 기준에 합의했다. 정상 기능의 안내 문구 개선은 요청 내용을 알지만 세 범주 밖인 `OTHER`라는 기준도 확인했다. 나머지 평가 Case별 기대값은 계속 검토한다.

| Category | 문의 유형 |
|---|---|
| `ACCOUNT` | 로그인·계정·비밀번호·접근 권한이 주된 문의 대상 |
| `BILLING` | 청구·결제·환불·청구 정보가 주된 문의 대상 |
| `TECHNICAL` | `ACCOUNT`·`BILLING`에 해당하지 않는 화면·파일·서비스 이용 등의 기술 문제. 모든 기술 문제의 상위 범주나 우리 Server의 결함 확정값이 아님 |
| `OTHER` | 문의 유형은 알 수 있지만 위 범주에 속하지 않는 경우. 예: 정상 기능의 안내 문구 개선 |
| `UNDETERMINED` | 문의 유형을 분류할 정보 자체가 부족한 경우 |

로그인·계정 또는 청구·결제 문제에는 해당 유형을 사용하고, 기술 문제라는 넓은 뜻만으로 `TECHNICAL`을 추가하지 않는다. 이유는 모든 문제를 하나로만 분류해야 해서가 아니라 위에서 정한 `TECHNICAL`의 범위에 해당하지 않기 때문이다. 로그인 실패와 PDF 미리보기 오류가 함께 있으면 `["ACCOUNT", "TECHNICAL"]`이다. 본문에 해당 단어가 등장했다는 이유만으로 선택하지 않는다.

“로그인이 안 된다”는 `ACCOUNT`, “서비스를 이용하지 못하지만 로그인 문제인지 화면 문제인지 모른다”는 기술적 이용 문제가 확인된 `TECHNICAL`로 분류한다. 후자의 분류 기준도 사용자와 확인했다. “문제가 생겼다”만으로는 증상을 알 수 없으므로 `UNDETERMINED`다. 원인 미확인을 분류 정보 부족과 혼동하지 않는다.

### 공식 가이드와 이 Lab의 선택

Microsoft는 구분하기 어려운 Class를 피하고, 로맨스·코미디와 별도의 로맨틱 코미디를 혼재시키기보다 두 유형을 함께 적용하는 예를 제시한다. AWS는 여러 Category가 동시에 적용되는 문서에 Multi-label을 선택하도록 안내한다. [Microsoft 분류 설계 가이드](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/language-service/custom-text-classification-transparency-note?view=foundry-classic), [AWS 분류 모드 선택](https://docs.aws.amazon.com/comprehend/latest/dg/create-custom-classifier-console.html)

상위·하위 중복도 보편적인 금지 규칙은 아니다. Google의 분류 V1 모델은 `/Science`와 `/Science/Astronomy`가 모두 해당하면 더 구체적인 결과만 반환하지만, V2 모델은 신뢰도 조건을 만족하면 둘을 함께 반환한다. [Google 분류 정책](https://docs.cloud.google.com/natural-language/docs/categories)

이 자료들은 공개 제품 가이드이며 각 회사 내부 Helpdesk의 운영 정책을 확인한 것은 아니다. 이 Lab은 범주의 의미를 명확히 하라는 가이드를 참고해 세 문의 유형을 동등한 수준으로 정의하고 복수 분류를 허용하는 안을 채택했다. `TECHNICAL`을 상위 범주로 두는 별도의 계층 설계는 채택하지 않는다. 출력 Field·Enum과 Ticket 자동 분리 금지는 유지하며, Prompt와 고정 평가의 기대값에도 같은 정의를 적용한다.

### 복수 Category 허용과 Ticket 자동 분리 금지

한 Message에서 독립적인 문제를 여러 개 제기하면 한 제안의 `categories`에 해당 유형을 함께 담는다. 로그인은 정상이라는 배경 설명은 로그인 문제로 분류하지 않는다. 로그인 실패와 중복 청구를 모두 해결해 달라는 문의에는 `["ACCOUNT", "BILLING"]`이 적합하다. 로그인 실패와 비밀번호 재설정 실패처럼 여러 문제가 같은 유형에 속하면 `["ACCOUNT"]` 한 항목으로 표현하고 요약에는 중요한 문제를 모두 보존한다.

단일 대표 Category를 고르는 방식과 복수 목록을 비교한 뒤 복수 목록을 채택했다. 제안의 목적은 담당자의 문의 이해를 돕는 것이며, 담당 부서 하나를 자동 배정하는 것이 아니다. 알려진 두 문제를 하나로 숨기거나 `OTHER`·`UNDETERMINED`로 바꾸지 않는다. Message·Job·Suggestion의 단위를 문제 수만큼 자동으로 늘리거나 Ticket을 분리하지 않는다.

별개의 문제 중 일부만 분류할 수 있다면 알려진 유형과 `UNDETERMINED`를 함께 담는다. “로그인이 안 되고, 별도로 다른 문제도 있지만 아직 구체적으로 설명하기 어렵다. 두 문제를 확인해 달라”는 문의에는 `["ACCOUNT", "UNDETERMINED"]`를 사용한다. 요약에도 로그인 불가와 별도 문제의 설명 부족을 함께 남긴다. 반면 로그인 실패의 원인만 모르는 문의에는 `["ACCOUNT"]`를 사용한다. `UNDETERMINED`는 별도의 미분류 문제를 보존하는 값이지, 이미 분류한 문제의 원인 미확인을 표시하는 값이 아니다. 이 병기 규칙은 사용자와 확인했다.

`priority`는 제안 전체에 하나인 기존 표현을 유지한다. 문제별 우선순위 Field나 자동 부서 배정은 추가하지 않는다. 전체 값은 아래의 합의한 기준으로 판단한다.

Priority는 처리 우선순위를 나타내며, 영향 범위·피해·긴급성을 별도로 판단한다. 다수의 이용 불가와 당일 업무 마감이 명시된 문의는 원인을 몰라도 `HIGH`로 판단할 근거가 있다. 원인은 Server뿐 아니라 조직의 공통 보안 정책·네트워크 등에도 있을 수 있지만, 원문에 없는 가설을 요약의 사실로 추가하지 않는다. AI의 Priority는 담당자의 검토 대상이며 Ticket의 확정 값을 자동으로 변경하지 않는다.

중복 출금과 환불을 요청한 문의도 이 Lab의 금전 피해 기준에서는 `HIGH`로 제안할 근거가 있다. 이는 사용자가 호소한 피해를 우선 확인하자는 판단이지, 멱등성 미구현이 원인이라는 확정이 아니다. 요약에는 두 번 출금됐다는 신고와 환불 요청을 보존하고, 원문에 없는 시스템 원인을 추가하지 않는다.

### 문의 전체의 Priority 기준 합의

개별 문제의 우선순위 중 가장 높은 값만 선택하면, 작은 문제들이 함께 발생해 우회 수단이 사라지거나 업무 영향이 커지는 상황을 놓칠 수 있다. 원문에 보고된 개별 영향과 누적·결합 영향을 함께 본다.

1. **`HIGH`**: 개별 문제 또는 누적·결합된 영향에 높은 우선순위를 줄 근거가 있다. 일부 문제의 영향이 불명확하더라도 확인된 다른 영향만으로 `HIGH`의 근거가 충분하면 전체는 `HIGH`다.
2. **`UNDETERMINED`**: `HIGH`의 근거를 확인하지 못했고, 문의 전체의 영향을 판단하는 데 필요한 정보도 부족하다. 통상 문의와 판단하지 못한 문제가 함께 있다고 모두 `NORMAL`로 바꾸지 않는다.
3. **`NORMAL`**: 보고된 개별·누적·결합 영향을 살펴봐도 통상적인 처리로 대응할 근거가 있다. 문제의 개수만으로 우선순위를 올리지 않는다.

예를 들어 미리보기와 다운로드가 각각 다른 확인 수단이었다면, 둘 다 실패했을 때는 자료를 확인할 수단이 없어진다. 원문에 당일 마감 업무를 진행하지 못한다는 영향까지 보고됐다면 전체를 `HIGH`로 제안할 근거가 된다. 두 오류가 같은 원인이라는 설명은 별도의 확인 없이 추가하지 않는다.

알 수 없는 부분은 요약과 원문에서 보존한다. 확인되지 않은 모든 잠재적 연쇄를 조사해야만 `NORMAL`을 사용할 수 있다는 뜻은 아니다. 판단에 필요한 정보의 부재와 근거 없는 가능성을 구분한다. 여러 Ticket의 관계는 한 Message만 입력받는 현재 범위에서 자동으로 확인할 수 없으며, 담당자의 종합 검토가 필요하다.

이 결정은 계약·평가 기준·학습자료에 반영한다. 평가 전 Prompt Version과 기대값을 맞추되, 이전 예비 호출이 새 규칙을 검증했다고 표시하지 않는다. 출력 Field·Enum·Ticket 상태 자동 변경 금지와 저장 경계는 그대로 유지한다.

### 실제 비교에 따른 공통 Prompt 보완

10/5의 52회 비교에서는 두 방식 모두 형식 검증을 통과했지만, 중복 출금의 Priority와 구체적 고장 위치를 모르는 서비스 이용 불가의 Category가 기존 기대값과 달랐다. 사용자는 이를 내용 판단 실패로 구분했고, 기대값 대신 공통 지시를 보완하는 안을 승인했다.

`prompt-v4-policy-alignment`는 보고된 금전 피해의 `HIGH`, 현재 결제가 정상인 방법 문의의 `NORMAL`, 기술적 이용 불가의 `TECHNICAL` 기준을 두 방식에 똑같이 명시한다. 원인 미확인과 문의 유형·영향 정보의 부족은 분리한다. Model·Dataset·기대값·Schema·Rubric과 이전 결과는 유지한다. 실제 52회 재비교에서는 두 방식 모두 형식·결정·분류·Priority 후보가 각각 26/26 일치했다. 요약·Injection 수동 평가는 남아 있다. 선택지·결정 이유·영향 파일과 실제 재비교 결과는 [비교 기록](./lab-reports/2026-10-05-ai-output-policy-comparison.md)에 남겼다.

## 출력 계약 검증의 첫 구현

순수 Java `AiSuggestionOutputValidator`에서 정확히 네 Field, `decision`별 조합, 공백이 아닌 요약, 분류 목록·허용 Enum을 검사했다. 누락 값을 채우거나 긴 요약을 자르지 않으며 원문 문자열과 `UNDETERMINED`를 보존한다. Test에서는 잠정 200자를 사용하고 상한은 생성자 설정으로 받는다. 실제 Runtime의 상한·설정 전달은 아직 확정하지 않았다.

중복 JSON Property와 뒤에 붙은 추가 JSON을 거부한다. 이는 기존 JavaScript `JSON.parse`의 중복 Property 처리와 다른 엄격한 Parser 선택이다. 예외에는 입력을 포함할 수 있는 Parser 메시지·Cause를 남기지 않고 고정 코드만 전달한다.

첫 구현에서 새 Unit Test 64개와 전체 Java Clean Test 140개·JavaScript 54개가 통과했다. 당시에는 독립 검증기였으며 이후 단일 Processor의 Provider·DB 저장 흐름에 연결했다. 반환 객체는 형식·값 계약의 검사 결과다. 요약의 사실성·`ABSTAIN` 적용 근거·현재 Attempt·저장 조건은 별도 경계다. Provider의 거부도 `ABSTAIN`으로 변환하지 않는다. [출력 검증 실험](./lab-reports/2026-10-03-ai-output-validation-lab.md)

## 필수 Field 누락과 제한된 재요청 — 잠정안

`categories`가 빠졌다는 사실만으로 AI가 의도적으로 판단을 보류했다고 해석하지 않는다. Model 출력 누락, Provider의 미완료 응답, Adapter 변환 오류는 구현 시 구분해서 확인한다. Application은 누락 값을 `["UNDETERMINED"]`로 채우거나 불완전한 제안을 저장하지 않는다.

완료된 Model 출력에서 필수 Field가 누락된 경우에는 설정한 보완 요청 상한 안에서 전체 결과를 다시 요청할 수 있다. "왜 빼먹었는가"에 대한 새 Model 설명만으로 원인을 확정하지 않고, 같은 최초 문의 메시지와 Prompt·Schema Version으로 필수 Field를 포함한 전체 응답을 다시 요구한다. 잘못된 원본 출력 전체를 새 지시로 붙이거나 두 응답의 일부 Field를 임의로 합치지 않는다.

- 필수 Field 누락을 보완하는 추가 생성 요청 상한도 별도 설정값으로 관리한다. 보완 요청은 이 상한과 같은 Job의 전체 생성 요청 한도를 모두 사용하므로, 어느 쪽이든 남은 횟수가 없으면 실행하지 않는다. 보완 상한을 1회, 전체 상한을 2회로 고정하지 않으며 Provider Adapter의 별도 재시도가 한도를 우회하지 않도록 구현 시 설정을 확인한다.
- 모든 보완 응답에 JSON·Schema·Application 값 검증을 다시 수행한다. 통과한 제안만 한 건 저장한다.
- 보완 요청의 재시도 조건을 만족하지 않거나 횟수·시간 한도에 도달하면 출력 검증 실패로 종료하고 제안은 저장하지 않는다. AI 작업의 실패로 기록하며 이미 완료된 문의 접수의 `201`을 AI 오류 `5xx`로 바꾸지 않는다. 조회 응답의 실패 표시와 안전한 오류 코드는 후속 검토에서 정한다.
- 같은 누락이 반복되면 요청 Schema·검증 규칙·Adapter 변환을 확인한다. 반복됐다는 사실만으로 원인을 확정하지 않지만, 새 생성으로 해결되지 않는 설정·변환 오류가 확인됐다면 남은 한도가 있어도 자동 재호출하지 않는다.
- Provider의 명시적 거부, 입력 부족, 인증·요금 오류, Timeout·연결 실패에는 이 Field 누락 재요청 규칙을 자동 적용하지 않는다.
- 이 재요청은 저장 전에 확인한 출력 오류를 대상으로 한다. DB Commit 후 Browser가 결과를 받지 못한 POST를 재시도하는 경우와 구분한다.
- 비교 실험에서는 첫 응답 실패와 재요청 후 성공을 따로 기록한다. 재요청으로 복구된 Case를 첫 응답 Schema 통과로 집계하지 않는다.
- 중단 후 복구에서 새 생성 요청을 보내는 경우에도 같은 Job의 전체 한도를 공유한다. 재시작 때 횟수를 초기화하거나 실패 원인별로 전체 한도를 새로 부여하지 않는다. 구체적인 상한과 실패 유형별 재시도 조건은 아래 기준에 따라 검토한다.

## 전체 생성 요청 한도와 실패 유형별 재시도

전체 생성 요청 한도는 설정값 `maxGenerationAttempts`로 관리하며 초기값은 3회로 승인했다. 최초 요청, 허용된 출력 보완·일시적인 Rate Limit 재시도와 중단 후 새 생성 요청은 같은 Job의 한도를 사용한다. 남은 횟수가 있다는 사실만으로 재시도가 허용되지는 않으며, 해당 실패 유형의 재시도 조건도 만족해야 한다.

Job 등록 시 적용할 호출 상한·시간 제한·정책 Version을 DB에 정책 Snapshot으로 함께 저장하는 안에 합의했다. 실행할 때마다 최신 Application 설정을 읽어 기존 Job에 덮어쓰는 안 대신, 재시작 후에도 해당 Job의 설정 사본을 사용한다. 변경한 설정은 새 Job부터 적용한다. 예를 들어 상한 3회인 Job이 2회를 예약했다면 Application의 새 기본값이 5회가 되어도 기존 Job의 남은 한도는 1회다. 같은 Job에 정책을 교체하거나 추가 호출을 허용하는 별도 예외 기능은 초기 구현에 포함하지 않는다.

AWS Step Functions는 정의를 변경해도 실행 중인 작업에 이전 정의를 유지한다. 이 원칙을 참고해 Job 처리 도중 설정이 암묵적으로 바뀌지 않게 하는 설계를 선택했다. [AWS 공식 문서](https://docs.aws.amazon.com/step-functions/latest/apireference/API_UpdateStateMachine.html) 이 Lab이 Step Functions를 사용하는 것은 아니다. V3는 정책 사본이 없는 기존 V2 Job에 승인한 초기값을 부여하고 `policy_snapshot_source=V2_MIGRATION`으로 표시한다. 새 접수는 Application 설정을 명시적으로 저장하고 `APPLICATION`으로 표시한다. 문의 원문·기존 ID는 바꾸지 않으며 Snapshot에 Credential이나 전체 Prompt를 저장하지 않는다.

횟수 표현은 상한과 누적 예약 횟수를 따로 보관하는 안으로 승인했다. `reservedGenerationCount`는 0부터 새 요청의 예약마다 1씩 증가한다. `reservedOutputRepairCount`는 출력 보완 예약 때만 증가하며 전체 예약 횟수에도 포함된다. 남은 횟수는 상한과 누적 값의 차이로 계산해 중복 저장하지 않는다. DB Column은 각각 `reserved_generation_count`·`reserved_output_repair_count`다.

상한 5회라는 예시에서는 예약 전 누적 값이 4이면 다섯 번째 요청을 예약할 수 있다. 같은 짧은 Transaction에서 실행 조건과 `reservedGenerationCount < maxGenerationAttempts`를 확인하고 5로 증가시켜 Commit한 뒤, 그 예약에 해당하는 요청을 전송한다. 값이 5가 됐다는 이유로 이미 허용한 다섯 번째 요청을 차단하지 않는다. 그다음 새 요청은 예약 전 값이 이미 상한이므로 거부한다. 두 Worker가 동시에 4를 읽고 각각 호출하도록 한도 확인과 증가를 분리해서는 안 된다.

새 생성 요청 전에는 짧은 DB Transaction에서 현재 실행권과 남은 한도를 확인하고 호출 한도 1회분을 예약해 Commit하는 기준에 합의했다. 예약을 Commit하지 못하면 외부 요청을 보내지 않는다. Commit 후 Provider를 DB Transaction 밖에서 호출하고, 확인한 응답·진행 결과는 이후의 짧은 Transaction으로 기록한다. 예약 횟수는 실제 Provider의 접수·실행·청구 횟수와 구분한다.

예약 Commit과 외부 전송 사이 또는 전송 후 결과 기록 전에 Application이 종료되면 전송·실행 여부가 불명확할 수 있다. 그런 예약을 미전송으로 단정해 자동 반환하지 않는다. 같은 DB Transaction 안에서 외부 요청을 보내고 전송 상태까지 기록하더라도, DB Rollback으로 Provider 실행을 취소할 수 없어 이 불확실성을 없애지 못한다. 가능한 기존 결과 확인과 정한 복구 정책을 적용하며, 실행권·예약 기록의 구체적인 Column과 조건부 갱신은 구현·Test에서 확인한다.

필수 Field 누락의 보완 요청 한도와 전체 생성 요청 한도는 서로 다른 조건이다. 보완 요청 상한도 설정값으로 분리하는 방향에 합의했다. 보완은 두 상한과 시간·오류 조건을 함께 만족할 때만 허용한다. 재시작 때 전체 생성 횟수뿐 아니라 보완 횟수도 초기화하지 않는다. SDK의 자동 재시도와 Application의 재호출이 한도를 우회하지 않는지도 확인한다.

승인한 초기 정책은 다음과 같다. 숫자는 이 Lab의 시작값이며 모든 Provider·업무에 적용하는 보편적인 한도가 아니다. 설정 Prefix는 `helpdesk.ai.job`이다.

| 설정 항목 | 초기값 | 의미 |
|---|---|---|
| `policyVersion` | `job-policy-v1` | Job에 저장하는 정책 Version |
| `maxGenerationAttempts` | 3 | 최초 요청을 포함한 같은 Job의 전체 새 생성 요청 상한 |
| `maxOutputRepairAttempts` | 1 | 필수 Field 누락의 추가 보완 상한. 전체 상한에도 포함 |
| `requestTimeoutMs` | 60,000 | 한 번의 Provider 요청에서 응답을 기다리는 시간 한도 |
| `attemptLeaseMs` | 120,000 | 한 Attempt의 실행권 기한. 요청 대기 한도보다 길게 설정 |
| `retryBackoffMs` | 5,000 | 출력 보완 예약 또는 중단 복구 재예약 전의 대기 시간 |
| `jobProcessingTimeoutMs` | 300,000 | 최초 실행권 확보부터 Job 전체 처리 기한까지의 시간 |

한 번의 요청에서 대기 한도를 넘긴 경우와 Job 전체 처리 기한을 넘긴 경우는 다르다. 전자는 가능한 기존 결과 조회·확인 후 남은 조건에 따라 제한적 재호출을 검토할 수 있다. 이전 요청의 결과가 불명확하다면 중복 실행·비용 가능성을 감수하는 재시도이며, 미실행이 확인됐다는 뜻은 아니다. 후자는 새 생성 요청을 중단한다. 전체 처리 기한의 기준은 최초 실행권 확보 시점이며 Queue 대기 시간은 제외한다. `first_started_at`·`processing_deadline_at`을 DB에 저장하고 재시작·재예약 때 초기화하지 않는다.

기존 Provider 요청의 상태·결과 조회와 검증된 응답의 DB 저장 재시도는 새 생성 요청과 구분한다. 두 작업도 무제한 반복하지 않도록 각각의 대기·종료 기준을 정한다. 요청 결과가 불명확하면 가능한 조회·확인을 먼저 수행하며, 조회 실패나 결과 부재만으로 미전송을 확정하지 않는다.

새 생성 요청 한도를 모두 사용했어도 허용된 시간 안에서 기존 결과를 확인하는 일까지 금지하지는 않는다. 허용된 결과 확인을 마쳤는데도 결과를 끝내 확인하지 못하고 더 이상 새 생성 요청을 허용할 수 없는 Job은 영원히 `RUNNING`으로 두지 않고 `FAILED`로 종료하는 기준에 합의했다. 실패 코드 후보는 `PROVIDER_OUTCOME_UNKNOWN`이다. 이는 우리 정책상 작업을 더 진행하지 못했다는 뜻이며 Provider의 미실행·실패나 비용 미발생을 확정하지 않는다. 원본 Ticket·Message는 유지한다. DB 장애로 종료 상태 저장에 실패하면 실제 Row에는 이전 상태가 남을 수 있으므로 기록 성공 여부도 확인한다.

기초 구현의 `AiSuggestionJobClaimService`는 `REQUIRES_NEW` Transaction에서 실행권 변경과 `ai_suggestion_attempts` 원장 INSERT를 함께 Commit한다. 원장에는 Job·Attempt·요청 종류·예약 시각만 남기며 실제 Provider 실행 성공을 기록한 것으로 해석하지 않는다. 이전 Attempt의 실패 기록·출력 보완은 현재 Attempt와 `RUNNING` 조건이 맞을 때만 반영한다. 정책 10개·Migration 1개·실행권 18개 Test와 전체 Java 236개·JavaScript 79개가 통과했다. [실행권·예약 검증](./lab-reports/2026-10-05-job-policy-and-reservation-lab.md)

검증된 응답을 저장하는 부분은 V4와 `AiSuggestionResultService`로 구현했다. Spring AI Adapter는 요청별 대기 한도·단일 전송을 적용하며, 선택 Worker에 Rate Limit 대기·현재 검증 객체의 DB 저장 재시도·DB 결과 확인 후의 조건부 RUNNING 복구를 연결했다. 원격 Provider 결과 조회는 아직 없다. 재예약 메서드가 기존 결과 조회를 대신하지 않으며 복구 Worker는 DB의 기존 결과 확인을 먼저 수행한다. 다른 실패 유형의 재시도 허용 여부는 별도로 검토한다.

### SDK 재시도와 호출 예약

Job 한 건, Java 메서드 호출 한 번, 외부로 보내는 Model 생성 HTTP 요청 한 번은 서로 다른 단위다. Worker가 한 번 호출한 SDK가 최초 요청 뒤 두 번 재전송한다면 같은 Job에서 외부 요청을 세 번 시도한다. 각 새 요청은 같은 Job의 생성 한도를 사용하며, 전송 전에 실행권·한도 예약을 Commit해야 한다. 실제 전송 여부가 불명확한 예약을 자동 반환하지 않는 기존 기준은 유지한다.

AI 제공자 서버 내부의 재처리는 우리 서버의 SDK 재전송과 다르다. 우리 요청이 한 번이었다면 호출 예약도 한 번이며, 제공자가 공개하지 않은 내부 실행 횟수를 임의로 더하지 않는다. 반대로 예약·HTTP 요청 횟수만으로 실제 AI 실행·청구 횟수까지 확정하지 않는다. 사용량·비용은 제공자가 반환하거나 공개한 정보의 범위에서 확인한다.

SDK 자동 재시도를 유지하면서 각 재전송을 예약 경계에 연결하는 안과, SDK 자동 재시도를 끄고 Worker가 새 요청을 관리하는 안을 비교했다. 기본 구현은 두 번째 안으로 정했다. 우리 서버에서 보내는 새 요청마다 같은 실행권·한도 정책을 적용하기 쉽고, SDK와 Worker의 중첩 재시도로 요청 수가 늘어나는 것을 막기 위해서다. SDK·HTTP Client의 Model 생성 자동 재시도는 끄며, 이를 실패 유형과 무관하게 무조건 재요청하는 Worker 반복문으로 대체하지 않는다. 사용자는 SDK 재전송도 호출 예약에 포함해야 한다는 기준에 동의했다. [OpenAI의 재시도와 전체 한도 지침](https://developers.openai.com/api/docs/guides/rate-limits)

로그는 이미 시도한 요청을 관찰하는 수단이고, 예약은 앞으로 보낼 요청을 제한하는 수단이다. 필요하다면 Job ID·Attempt·요청 ID·안전한 오류 코드·지연·확인한 사용량과 비용 추정치를 기록한다. Credential·원문 Prompt·전체 요청 및 응답은 출력하지 않으며, 확인하지 못한 사용량을 0으로 채우지 않는다.

Provider Adapter의 SDK·HTTP 자동 재시도 차단은 구현했고 로컬 HTTP Test에서 오류·Timeout 뒤에도 전송 한 번을 확인했다. 실제 AI 저장 실험의 확인된 HTTP 전송도 한 번이었다. 후속 Worker의 허용된 새 요청은 예약 Commit 뒤에만 전송되도록 연결한다. 시험 서버의 통제된 응답·실제 AI 호출·자동 Worker의 재예약은 서로 다른 근거로 기록한다.

### 일시적인 Rate Limit과 크레딧 부족의 재시도 기준

같은 HTTP `429`라도 일시적인 요청 제한과 크레딧·사용 한도 부족은 대응이 다르다. 모든 `429`를 같은 간격으로 반복하는 안 대신, Provider의 안전한 오류 코드로 원인을 구분하고 일시적인 Rate Limit에만 조건부 재시도를 허용하는 안에 합의했다. 해결되지 않은 인증·요금·설정 문제에는 남은 호출 횟수가 있어도 같은 요청을 반복하지 않는다.

| 확인한 실패 원인 | 새 생성 요청의 기준 |
|---|---|
| 일시적인 Rate Limit이며 유효한 `Retry-After`가 있음 | 지정한 최소 대기와 Job의 Backoff를 모두 지키고, 현재 실행권·남은 전체 횟수·처리 기한을 다시 확인한 뒤 제한적으로 재시도 |
| 크레딧 부족·사용 또는 지출 한도 도달 | 충전·한도 조정 등 원인 해결 전 자동 재요청하지 않음 |
| 오류 원인을 구분하지 못함 | `429`라는 Status만으로 일시적인 제한이라고 간주하지 않음 |

`Retry-After: 15`라면 최소 15초를 기다린다. Job의 `retryBackoffMs`가 5초여도 5초 뒤에 호출해서는 안 되며, 두 값은 더하는 대신 더 긴 대기를 적용한다. 기다리는 동안 DB Transaction이나 Row Lock을 유지하지 않는다. 후속 Worker에는 오류와 다음 실행 가능 시각을 짧은 DB Transaction으로 기록하고, 그 시각 전에는 재예약하지 않는 경로가 필요하다.

대기 후 새 실행권·호출 예약을 확보할 때 Job 상태·현재 Attempt·남은 전체 생성 횟수와 `processing_deadline_at`을 다시 확인한다. 새 요청 1회분을 예약해 Commit한 뒤 Provider를 호출한다. 이미 실패 응답을 받은 요청의 예약 횟수는 되돌리지 않으므로 최초 요청과 한 번의 재시도는 누적 예약 2회다. 이 재시도는 Field 보완이 아니므로 `reserved_output_repair_count`는 증가시키지 않는다. 전체 처리 기한을 새로 시작하거나 새 Job으로 한도를 초기화하지 않는다.

Provider가 요구한 최소 대기를 지키면 Job 전체 처리 기한에 도달하는 경우에는 더 일찍 재시도해 시간을 맞추지 않는다. 재시도가 금지되거나 종료돼도 앞서 접수한 Ticket·Message는 유지한다. 크레딧 부족은 명시적 판단 보류가 아니므로 `ABSTAINED`로 바꾸지 않는다. [OpenAI Rate Limit 지침](https://developers.openai.com/api/docs/guides/rate-limits), [OpenAI 오류 유형](https://developers.openai.com/api/docs/guides/error-codes)

Provider Adapter의 오류 분류·`Retry-After` 해석과 Processor의 최소 대기 전달에 이어, V5와 선택 Worker로 확인된 Rate Limit의 대기 기록·다음 예약·통제된 Provider 호출을 연결했다. `TEMPORARY_RETRY`를 출력 보완·결과 불명 `RECOVERY`와 분리하며 `PROVIDER_RATE_LIMITED`를 기록한다. 새 요청은 원래 정책 Snapshot·누적 한도·기한을 유지한다. [Worker 검증](./lab-reports/2026-10-06-worker-rate-limit-and-context-restart-lab.md)

Header가 없거나 유효하지 않은 경우와 다른 미승인 일시적 거절은 자동 재호출하지 않는다. 해당 Attempt에 `AUTO_RETRY_BLOCKED`를 Commit하고 현재 `RUNNING`을 유지하며 전체 기한 종료 규칙을 적용한다. Lease 만료나 Application 재시작으로 이 금지를 해제하지 않는다. 별도 Backoff·Jitter 허용안은 추가하지 않았다. 유효한 최소 대기가 기한보다 길면 그 시각을 그대로 저장하고, 새 Claim의 기한 조건과 만료 정리가 새 요청을 막는다.

### 선택 Worker의 활성화·최종 실패 경계

자동 활성화와 기본 꺼짐을 비교해, 기존 Application 실행이 외부 유료 호출을 시작하지 않도록 선택 활성화로 연결했다. `postgres`와 `helpdesk.ai.worker.enabled=true`가 필요하며 기본 확인 간격은 1초다. 확인 간격은 개별 Job의 재시도 대기를 대체하지 않는다. Provider·개인정보 Guard·출력 검증기를 명시적으로 제공하며 전역 Key·일반 개인정보 탐지·요약 Runtime 기본값을 새로 정하지 않았다.

최종 `FAILED`는 일반 Polling·대기 예약으로 다시 열지 않는다. 관리자 재개는 초기 구현에 포함하지 않으며, 이후에는 원인 해결·승인된 추가 조건을 별도로 정해야 한다. 새 Job·설정 변경으로 기존 한도와 기한을 초기화하지 않는 기준은 유지한다. 한 Tick 전체를 Transaction으로 묶는 대신 예약·상태 기록·결과 저장만 짧게 Commit한다.

영향 파일은 Lab의 `ai/job`·`ai/processing`·V5·관련 Test·README다. 이 단계의 새 Test 31개와 전체 Java 349개·JavaScript 104개·ESLint가 통과했다. 같은 JVM의 새 Spring Context에서 미실행·대기 Job의 자동 처리를 확인했고, 결과 불명 `RUNNING`은 Lease 만료만으로 재실행하지 않았다. 저장 재시도는 다음 절에서 연결했으며 결과 확인 후 복구·실제 JVM Process·유료 Worker·AGENT 조회와 Browser는 남아 있다.

### 검증된 객체의 저장 재시도 — 승인

검증을 통과한 응답이 현재 Process 메모리에 남아 있을 때에는 Provider를 다시 호출하지 않고 같은 객체의 DB 저장만 재시도한다. 최초 결과 저장을 포함한 총 상한은 3회, 추가 저장 사이의 최소 간격은 5초로 승인했다. 생성 호출 예약과 저장 시도는 별도 단위이며, 저장 재시도로 Attempt·생성 예약·출력 보완 횟수나 원래 처리 기한을 바꾸지 않는다.

매번 저장 전에 같은 Job의 현재 Attempt·상태와 기존 제안을 조회한다. 이미 Commit된 정상 결과는 그대로 사용하고, 이전 Attempt나 종료된 Job의 객체는 반영하지 않는다. 조회 실패와 결과 부재는 다르므로 조회 실패를 재저장 허가로 바꾸지 않는다. 일반 조회 뒤에도 실행권이 바뀔 수 있어 실제 결과 Transaction의 현재 Attempt 검사는 유지한다.

세 번의 저장 시도를 소진한 뒤에도 Commit 결과를 먼저 확인한다. 저장되지 않은 현재 RUNNING이면 안전한 저장 재시도 소진 코드로 종료하며, 이미 저장된 성공·보류나 교체된 Attempt를 덮어쓰지 않는다. 전체 기한이 먼저 끝나면 더 저장하지 않는다. DB 장애로 확인·종료 기록을 하지 못한 경우 성공·실패를 확정했다고 기록하지 않으며, 실제 Row는 마지막 Commit 상태일 수 있다.

선택지는 즉시 AI 재생성, 무제한 DB 재저장, 검증 객체를 재사용하는 제한된 재저장이다. 승인한 세 번째 안은 이미 얻은 결과를 보존하면서 불필요한 외부 호출과 반복 저장을 막는다. Worker 설정으로 상한·간격을 분리하되 이 단계에서는 현재 Process가 보관한 한 객체의 저장 주기에 적용한다. Process 종료 후 객체·저장 시도 이력을 복구하는 정책과 영속 보관은 별도 단계이며 기존 Job의 생성 정책 Snapshot은 유지한다.

단일 Worker는 저장 대기 객체를 한 건만 보관하고 그 처리를 마친 뒤 다음 Job을 처리한다. 무제한 메모리 Queue나 원본 Provider 응답의 영속 보관은 추가하지 않는다. 대기 중에는 Thread를 재우거나 DB Transaction을 유지하지 않고 다음 Tick에서 시각을 확인한다. 전체 기한에 도달하면 메모리 객체를 해제하며, DB 결과 확인이 실패했다면 미확인 상태를 반환한다. 향후 Process 복구·병렬 처리에서는 객체 보관과 종료 기록의 경계를 다시 검토한다.

영향 파일은 Lab의 `ai/processing`·실패 코드·V6·관련 Test와 README다. 저장 재시도 Test 12개·Migration 1개·설정 추가 2개와 전체 Java 364개·JavaScript 104개·ESLint가 통과했다. 기존 Commit 확인, 실제 Rollback 뒤 같은 객체 재저장, 조회 실패의 재저장 금지, 상한·5초 경계·현재 Attempt·기한과 원문 보존을 확인했다. 이번 유료 호출은 0회다. 응답 유실은 Test용 주입, 시간 경계는 통제된 Clock으로 검사했으며 실제 Process 중단 후 복구는 별도다. [저장 재시도 검증](./lab-reports/2026-10-06-validated-output-storage-retry-lab.md)

### Attempt별 결과 분류와 조건부 복구 — 승인

재시작 후 `RUNNING`·Lease 만료만으로 재호출하면, 결과 불명과 이미 확인한 미승인 거절을 혼동할 수 있다. Job의 마지막 오류 코드만 사용하는 안, 모든 만료 실행을 다시 호출하는 안, 예약 원장에 Attempt별 결과를 남기는 안을 비교해 세 번째 안으로 정했다. 현재 Attempt의 판단 근거를 이전 시도와 분리하고 재시도 금지를 재시작 뒤에도 유지하기 위해서다.

V7은 `ai_suggestion_attempts.result_code`에 안전한 코드만 추가한다.

| 코드 | 의미 | 만료 뒤의 결과 불명 복구 |
|---|---|---|
| `UNCONFIRMED` | 이 Attempt의 결과 분류가 아직 Commit되지 않음. 실제 미전송·미실행은 확정하지 않음 | 기존 결과 확인·Lease와 Backoff·전체 기한·남은 한도를 만족한 경우에만 후보 |
| `OUTCOME_UNKNOWN` | 결과 불명이라는 관찰을 Commit함 | 위 조건을 동일하게 적용 |
| `AUTO_RETRY_BLOCKED` | 결과 불명 복구를 통한 자동 재호출 미승인 | Lease가 만료돼도 복구 후보에서 제외 |

새 예약은 `UNCONFIRMED`다. Provider의 명시적 실패·거절이나 구조 검증 실패를 확인한 시도는 먼저 `AUTO_RETRY_BLOCKED`를 기록한다. 알려진 실패를 결과 불명 경로로 우회하지 않도록 하기 위해서다. 유효한 Rate Limit 대기나 필수 Field 보완은 그 다음 별도의 승인된 `PENDING` 예약 경로를 Commit하며, 새 Claim은 자신의 결과 코드로 시작한다. `OUTCOME_UNKNOWN`은 Timeout·연결 실패 등 불명 결과에 적용한다. 코드가 실제 AI 실행·사용량·청구를 증명하지는 않는다.

V7 이전 원장의 결과는 분류되지 않았다. 이를 모두 새 `UNCONFIRMED`로 바꿔 복구 후보를 확대하는 안 대신, 기존 예약은 `AUTO_RETRY_BLOCKED`로 보수적으로 이행한다. 이 값은 과거 거절을 관찰했다는 주장이 아니라 이전 기록에 자동 재호출 권한을 부여하지 않는 결정이다. 기존 문의·정책·횟수·기한·예약 식별자·제안은 유지한다. 미실행 `PENDING`이나 이미 승인해 저장한 대기 실행은 기존 경로로 새 예약을 만들 수 있다.

Worker는 현재 Process에 검증 객체가 있으면 저장 재시도를 우선한다. 그렇지 않고 처리할 PENDING이 없을 때 복구 후보를 찾는다. DB의 Job·제안을 조회한 뒤 현재 RUNNING·Attempt·결과 부재를 확인하며 조회 실패는 `RECOVERY_STATE_UNCONFIRMED`다. `ABSTAINED`는 제안이 없더라도 완료된 상태이므로 재생성하지 않는다. 현재 Adapter에는 원격 Provider 결과 조회가 없어 이를 수행했다고 기록하지 않는다.

후보 조회는 실행권이 아니다. 실제 복구 Claim은 짧은 `READ COMMITTED` Transaction에서 Job Row를 `FOR UPDATE SKIP LOCKED`로 확보한 다음, 별도 SQL의 새 Snapshot으로 결과 코드·현재 Attempt·RUNNING·Lease+Backoff·원래 전체 기한·남은 생성 한도·기존 제안 부재를 다시 확인한다. 결과 분류도 같은 Job Row를 잠근다. 경쟁 실행이 결과를 저장하거나 금지를 Commit했다면 새 예약을 만들지 않는다.

조건을 만족한 경우 새 Attempt 증가와 원장 INSERT를 함께 Commit한 뒤 Provider를 Transaction 밖에서 호출한다. 원장 INSERT 실패는 Attempt·누적 예약 증가도 Rollback하며 외부 호출은 하지 않는다. 이전 Attempt는 현재 결과·실패·결과 코드를 바꾸지 못하고, 금지된 Attempt를 불명 상태로 되돌려 재호출을 허용하지 않는다. 한도 소진은 새 요청을 막지만 여전히 현재인 유효한 응답의 저장을 막지는 않는다.

응답 관찰과 DB 기록 사이에는 여전히 중단 가능성이 있다. 거절을 받았더라도 결과 코드 Commit 전에 Process가 종료되거나 기록이 실패했다면 DB에는 `UNCONFIRMED`가 남을 수 있다. 확인 기록이 실패한 Tick은 즉시 재호출하지 않으며, 후속 복구에서도 미실행으로 단정하거나 예약을 반환하지 않는다. 이 구현은 외부 실행의 정확히 한 번을 보장하지 않는다. 결과 코드에는 Prompt·원본 응답·Secret을 보관하지 않고 검증 응답 객체의 영속 저장도 추가하지 않았다.

영향 파일은 Lab의 `ai/job`·`ai/processing`·V7·복구/Context/Migration Test와 README다. 새 Test 20개와 전체 Java Clean Test 384개·JavaScript 104개·ESLint가 통과했다. 같은 JVM의 새 Context에서 조건부 복구와 재시도 미승인 유지를 확인했으며 유료 호출은 0회다. 실제 JVM Process 중단·유료 Worker·AGENT 조회·Browser·수동 내용 평가가 후속 범위다. 새 실패 유형 허용이나 원격 결과 조회·응답 영속 보관을 추가할 때 이 경계를 다시 검토한다. [복구 검증 기록](./lab-reports/2026-10-06-attempt-results-and-running-recovery-lab.md)

## API·권한·응답 — 잠정안

| 요청·상황 | 예상 결과 | 저장·실행 경계 |
|---|---|---|
| `POST /api/tickets` — 인증된 `USER`·`AGENT`, 유효한 CSRF Token, 제목과 최초 메시지 | 접수 Commit 뒤 `201 Created` | Ticket·최초 Message·`PENDING` Job을 함께 저장하고 Server가 별도 AI 작업을 수행 |
| 새 접수의 공백·과도하게 긴 메시지 | `400` | Ticket·Message·Job 저장과 Provider 호출 없음 |
| 접수 Transaction에서 Message 또는 Job 저장 실패 | 접수 실패의 안전한 오류 응답 | Ticket·Message·Job은 함께 Rollback하며 Provider 호출 없음 |
| 익명의 보호된 `GET` / `USER`의 제안 조회 / CSRF 없는 접수 `POST` | 각각 `401` / `403` / `403` | 인증·인가·CSRF 실패를 분리해 Test. 거부된 요청에서 새 AI 작업을 만들지 않음 |
| 권한 있는 `AGENT`의 없는 Ticket ID 조회 | `404` | 조회가 AI 호출을 유발하지 않음 |
| 최초 메시지가 없는 기존 Ticket | 기존 Ticket 조회 유지 | Provider 호출·제안 저장·임의 원문 생성 없음 |
| 유효한 요약과 Category·Priority의 `UNDETERMINED` | 제안을 `PENDING_REVIEW`로 저장 | 이미 접수한 Ticket·Message는 변경하지 않음 |
| 유효한 `ABSTAIN` | Job은 `ABSTAINED`, Suggestion은 0건 | 원본 Ticket·Message 유지. 의미를 해석할 수 없는 입력 사례는 확인했으며 조회 표현과 실제 저장 검증은 후속 작업 |
| 완료된 AI 출력에서 필수 Field 누락 | 처음에는 저장하지 않고 설정된 전체·보완 상한과 시간·오류 조건 안에서 전체 재요청 | 재검증 성공 시 제안 한 건 저장. 더 이상 보완할 수 없으면 저장 없이 출력 오류 종료 |
| Provider Timeout·연결 실패·잘못된 출력·제안 저장 실패 | AI 작업의 실패 표시 | 접수 성공과 분리. 원본 Ticket·Message 유지, 검증되지 않은 제안 저장 없음 |
| `GET /api/tickets/{id}/ai-suggestion` — URI 후보 | `AGENT`에게 작업 상태와 존재하는 제안을 조회하는 안 | Ticket ID로 조회 가능하게 하되 URI·응답 구조·작업 미등록 표현은 미결정 |

기존 생성 권한 `USER`·`AGENT`와 조회 권한 `AGENT`는 유지한다. 고객의 자기 문의·대화 조회 권한은 이후 대화 기능을 구현할 때 별도 계약으로 정한다. 공식 답변 API와 수동 AI 재생성 API는 이번 범위에 없다.

CSRF Token은 Browser JavaScript가 Server에서 받은 Header 이름으로 접수 요청에 직접 붙인다. `201` 응답을 Browser가 받지 못해도 접수 Commit이 이미 끝났을 수 있으므로 자동 재시도하지 않는다. CORS 허용, Session 인증, CSRF와 AI 출력 검증은 서로 다른 경계다.

## 별도 저장소와 결과 Transaction — 합의한 구현

- 사용자 원문은 `ticket_messages.body`에 보관한다. 검증된 AI 결과는 Ticket·Message에 덮어쓰지 않고 `ticket_suggestions`에 저장한다.
- 접수 Transaction은 Application Service에서 Ticket·최초 Message·`PENDING` Job의 저장을 묶는다. Controller는 HTTP 입력·응답을 담당하며 직접 DB나 Provider를 호출하지 않는다. Worker는 Commit된 Job만 대상으로 삼고 Provider 응답을 기다리는 동안 DB Transaction을 유지하지 않는다.
- Suggestion은 Job ID를 Foreign Key로 참조하고 `UNIQUE (job_id)`로 같은 Job의 제안을 한 건으로 제한한다. Job에서 입력 Message와 Ticket을 추적한다. ID·시각·현재 Attempt는 Server와 DB가 결정하며 Model의 Field로 받지 않는다.
- `summary`·`priority`는 `NOT NULL`이며 요약의 공백과 Priority 허용값을 DB에서도 검사한다. 복수 Category는 `ticket_suggestion_categories`에 항목별로 저장하고 `(suggestion_id, category)`를 복합 Primary Key로 둔다. Foreign Key·허용값·중복을 DB에서 제한한다. 목록 순서는 중요도를 뜻하지 않으며 조회 시 Category 이름으로 정렬한다. 빈 목록은 Java 검증기에서 거부한다. 일반 Row CHECK가 자식 Row 한 건 이상이나 Job과 Suggestion의 상태 일치까지 보장한다고 해석하지 않는다.
- 요약 문자열과 `UNDETERMINED`를 그대로 저장·복원한다. 요약 길이 상한은 검증기 설정으로 받고 이번 Test의 200자를 Runtime 기본값이나 DB 길이 제한으로 새로 확정하지 않는다. V4는 요약을 TEXT로 저장하며 공백만 있는 값은 거부한다.
- 유효한 요약이 있는 제안은 Category·Priority가 `UNDETERMINED`여도 `PENDING_REVIEW`로 저장한다. 유효한 `ABSTAIN`은 Job을 `ABSTAINED`로 기록하고 제안 Row를 만들지 않는다. 잘못된 출력과 Provider 실패도 제안 Row를 만들지 않지만, 명시적 판단 보류와는 다른 실패 결과로 기록한다. AI 값만으로 Ticket 상태나 담당자의 확정 판단을 변경하지 않는다.
- 원본 Provider 응답, 전체 Prompt, Credential과 메시지 본문을 Job·Suggestion Table에 무조건 복사하거나 Log에 출력하지 않는다. 평가용 합성 Dataset과 실제 문의 원문의 보관 경계는 분리한다.
- 결과 Service는 현재 `RUNNING`·Attempt·전체 처리 기한을 `SELECT ... FOR UPDATE`로 확인한 뒤 같은 짧은 Transaction에서 Suggestion·모든 Category·`SUCCEEDED`를 저장한다. 완료 UPDATE가 실패하거나 0건이면 결과 변경을 모두 Rollback한다. 이미 Commit한 접수와 호출 예약은 유지한다. `ABSTAIN`이면 제안 없이 `ABSTAINED`만 결과 Transaction으로 Commit한다.
- Rollback은 결과 저장 전의 `RUNNING`으로 되돌리는 동작이며 `FAILED`를 자동 기록하지 않는다. 실패 상태 기록·자동 재시도는 별도 정책이다. 확인된 Rollback 뒤에는 메모리에 있는 검증 객체로 DB 저장만 다시 시도할 수 있다. Commit 여부가 불명확하면 같은 Job의 상태와 제안을 먼저 조회한다. 내부 조회 Service는 짧은 `REPEATABLE_READ` Transaction에서 여러 SELECT가 같은 Snapshot을 보게 한다. 조회 API·자동 재호출은 추가하지 않는다.
- 완료 후 반복 저장과 이전 Attempt는 `NOT_CURRENT`로 변경 없이 반환한다. 이 값만으로 기존 결과가 없다고 판단하지 않고 필요하면 DB 결과를 조회한다. 현재 Attempt의 유효 응답은 생성 한도를 모두 사용했거나 Lease만 만료됐어도 전체 처리 기한 안이면 저장할 수 있다. DB 예외의 실패 Row·응답 원문·Cause는 고정 `AI_RESULT_STORAGE_FAILED` 예외에 복사하지 않는다.
- Provider 호출은 PostgreSQL Transaction으로 되돌릴 수 없다. 중복 제안 저장 방지가 외부 호출·요금까지 정확히 한 번을 보장하는 것은 아니다. `RUNNING`의 중단 판정·복구 조건·시도 횟수 기록은 추가 설계가 필요하다.

### 저장 결정의 배경과 후속 검토

복수 Category를 단일 Column의 첫 항목으로 축소하면 문의 정보가 사라진다. PostgreSQL 배열·JSONB·별도 분류 Table을 비교하고, 사용자가 승인한 별도 Table 방식을 채택했다. 항목별 허용값·Foreign Key·복합 Primary Key를 직접 확인할 수 있고 분류 집합을 저장·복원하기 쉽다. 새 분류 검색 API나 대화 기능은 추가하지 않는다.

영향 파일은 Lab의 `V4__add_suggestions_and_result_completion.sql`, `ai/job`의 결과 Repository·상태 객체, `ai/suggestion`의 결과 Service·Suggestion Adapter와 새 Integration Test 두 Class다. 일반 `CHECK`로 다른 Table의 Row 수를 보장하지 않으며 최소 분류와 전체 완료의 원자성은 검증된 객체와 결과 Service가 지킨다. 직접 SQL Writer를 추가한다면 이 경계를 다시 검토한다. [PostgreSQL CHECK의 범위](https://www.postgresql.org/docs/17/ddl-constraints.html#DDL-CONSTRAINTS-CHECK-CONSTRAINTS)

새 결과 Test 18개·V3→V4 Migration Test 1개와 전체 Java Clean Test 255개·JavaScript 79개, ESLint가 통과했다. 실제 PostgreSQL에서 저장·복원·중복·이전 Attempt·부분 실패의 Rollback과 원문 보존을 확인했다. 이 Test는 합성 JSON을 Java 검증기에 통과시킨 뒤 저장한 것으로 Provider·Worker·Browser의 실행 근거와 구분한다. Commit 응답 유실은 직접 주입하지 않았으며 결과 재조회 기능을 확인했다. [제안 결과 저장 검증](./lab-reports/2026-10-05-suggestion-result-storage-lab.md)

단일 Processor의 실제 Provider·입력/출력 Guardrail·결과 저장 연결은 합성 문의 한 건에서 확인했다. 선택 Worker·제한된 저장 재시도는 통제된 Provider와 실제 PostgreSQL에서 검증했고, 담당자 조회·Browser와 실제 Process 재시작은 후속 과제다. 결과 조회의 `REPEATABLE_READ`는 조회 시작 후의 새 Commit까지 항상 보인다는 뜻이 아니므로 실제 저장 Transaction의 현재 상태 확인을 유지한다.

## 먼저 작성할 예상 Test

1. 기존 PostgreSQL Ticket Row를 Migration 뒤에도 조회하며 Message 0건을 보존한다. 본문을 조작해 Backfill하지 않고 Provider 0회·Suggestion 0건을 확인한다.
2. 새 접수의 공백·과도하게 긴 최초 본문은 `400`이며 Ticket·Message·Job Row가 없다. 실제 PostgreSQL에서 Message 저장 실패와 Message 저장 후 Job 저장 실패를 각각 재현한다. Transaction 종료 뒤 세 Table의 새 Row가 모두 0건이고 Provider 호출도 0회여야 한다. 정상 접수에서는 Ticket·최초 Message·`PENDING` Job을 각 한 건 Commit한다.
3. JSON 문법 실패, Field 누락·추가, Type·Enum 오류, 공백·긴 요약, `decision`과 나머지 Field의 모순은 저장하지 않는다. v2의 `categories` 누락·문자열·빈 목록·중복·허용값 밖 항목과 이전 `category` Field도 거부한다.
4. 유효한 요약과 Category·Priority의 `UNDETERMINED`는 저장·복원되고 `OTHER`·`NORMAL`로 바뀌지 않는다. Field 누락, `SUGGEST`의 `null`, 허용 목록 밖 값은 거부한다.
5. 실제 PostgreSQL에서 접수 Commit 뒤 Provider 실패·Invalid Output·제안 저장 Rollback을 각각 재현한다. 원본 Ticket 1건·최초 Message 1건과 그 값·Ticket 상태가 유지되고 해당 Job의 Suggestion은 0건이어야 한다. 유효 제안의 저장·복원과 Job 상태의 원자성도 확인한다.
6. 실제 Security Filter Chain에서 `USER`·`AGENT` 접수 허용, 익명 보호 GET `401`, `USER` 제안 조회 `403`, 유효하지 않은 CSRF의 접수 `403`을 분리한다. 거부된 접수는 Row·새 Provider 호출이 없어야 한다.
7. Browser는 요약을 `textContent`로 표시한다. 접수 `201`이 AI 완료를 뜻하지 않는지, 접수 응답을 못 받은 경우 `unknown`과 자동 재시도 금지를 확인한다.
8. Injection이 Category·Priority·Ticket ID·Ticket 상태를 강제로 바꾸거나 민감 값을 출력하도록 유도하는 대표 Case를 재현한다. 선택한 Case의 통과가 모든 유출 방지를 증명하지는 않는다.
9. 설정별 전체·보완 상한을 함께 검증한다. 가정한 전체 상한 4회·추가 보완 상한 2회에서 누락 → 누락 → 정상 응답이면 생성 요청 3회·보완 2회·제안 1건이다. 계속 누락되면 생성 요청 3회에서 보완 상한에 도달해 저장 0건으로 종료한다. 전체 상한 2회·보완 상한 2회라면 전체 2회에서 먼저 중단한다. 숫자는 Test 입력이며 Runtime 기본값이 아니다. 누락 값을 임의 보완하지 않으며, 명시적 거부나 확인된 설정·Adapter 오류에 같은 재요청을 적용하지 않는다.
10. 접수 Commit 직후 Worker 실행 전에 Application을 중단하고, 같은 PostgreSQL을 유지한 재시작에서 남은 `PENDING` Job을 찾는지 확인한다. 이후 미완료 Job 복구와 같은 Job의 제안 중복 저장 방지를 검증한다. 호출 중단·횟수 상한·결과 저장과 상태 갱신의 실패는 구체적인 복구 계약 확정 뒤 재현한다.
11. 복수 Category의 유효 제안을 한 건 저장·복원하며 목록의 항목을 잃지 않는다. 한 Category가 부적합하거나 목록 저장이 실패하면 제안·작업 완료 표시를 부분 저장하지 않는다. 분류 목록 때문에 Ticket·Message·Job을 자동으로 분리하지 않는다.
12. 유효한 `ABSTAIN`의 결과 기록 뒤 Job은 `ABSTAINED`, Suggestion은 0건이며 원본 Ticket·Message는 그대로다. Provider 거부·JSON 오류·Field 누락을 `ABSTAINED`로 기록하지 않는다. 상태 저장 실패까지 정상 보류로 표시하지 않는다.
13. 합성 민감 값을 넣은 입력을 전처리한 뒤 실제 AI 모델로 실험한다. 실제 전송 직전 직렬화된 요청 Body의 모든 Model 입력에서 불필요한 값이 제거·치환됐는지 확인한다. 요약에 값이 없다는 사실만으로 미전송을 판정하지 않는다. 접수 원문 보존과 출력·Log의 값 복사 여부도 별도로 확인한다. Unit Test·Fake Provider의 수신 인자 검사는 재현 가능한 보완 근거이며 실제 AI 실험을 대신하지 않는다. 실제 개인정보로 시험하지 않는다.
14. Injection 의심 신호와 문의 Priority를 분리한다. 통상 문의의 명령문만으로 `HIGH`나 `SECURITY` 분류가 되지 않으며 추가 출력 Field도 허용하지 않는다. 허용하지 않은 Tool·Ticket 상태 변경을 실행하지 않는지는 독립 Spike와 Application Test로 확인한다.
15. 요청 한 번의 Timeout 뒤에는 가능한 기존 결과 확인과 남은 조건을 거쳐 재호출하는지, Job 전체 처리 기한 뒤에는 새 생성 요청이 없는지 확인한다. 생성 상한을 모두 사용했어도 허용된 기존 결과 조회는 유지하며 재시작이 생성·보완 횟수나 전체 처리 기한을 초기화하지 않아야 한다.
16. 일시적인 `429`와 유효한 `Retry-After`를 재현해 최소 대기 전에는 새 요청·예약이 없고, 대기 뒤에도 횟수·기한·현재 실행권을 확인하는지 검증한다. 허용된 새 요청은 예약 Commit 뒤 전송하며 전체 예약만 증가하고 출력 보완 횟수는 유지한다. 기한이나 한도를 소진하면 전송하지 않으며 크레딧 부족의 `429`에도 자동 재요청하지 않는다. 이 제어 Test와 실제 AI의 Rate Limit 관찰은 구분한다.

## Java Provider Adapter의 구현 결정

기존 Port·Job 예약·결과 저장의 경계는 유지하고, Provider Port 뒤에 Spring AI 2.0.1의 OpenAI Adapter를 명시적으로 생성한다. Starter 자동 설정과 직접 HTTP 호출만 사용하는 안을 비교했다. Spring AI Library와 명시적 Client 구성을 선택해 학습 대상인 ChatModel을 사용하면서 전역 키의 자동 선택과 의도하지 않은 유료 호출을 막는다. 일반 Application 시작과 회귀 Test에는 Live Bean·Scheduler를 추가하지 않는다.

Node 평가의 Responses API와 Spring AI ChatModel의 Chat Completions API는 같은 실행 경로가 아니다. `gpt-6-luna`와 공통 업무 판단 기준은 유지하고 Java Prompt는 `prompt-v4-policy-alignment-chat-v1`로 표시한다. Schema가 통과해도 내용의 정확성이나 자동 처리 완료가 증명되는 것은 아니다. [Spring AI OpenAI ChatModel 문서](https://docs.spring.io/spring-ai/reference/api/chat/openai-chat.html)

SDK `maxRetries=0`만으로 HTTP Client의 연결 재시도까지 꺼지는 것은 아니다. 확인한 Spring AI HTTP 기본값은 연결 재시도를 사용하므로, 이번 Adapter의 단일 전송 Client는 SDK·연결 재시도와 자동 Redirect를 함께 끈다. 공식 HTTPS Endpoint만 공개 생성자로 사용하고 Test용 경로는 Literal Loopback으로 제한한다. 환경 Proxy는 사용하지 않는다. 직렬화된 최종 요청에는 설정한 민감 값과 API Credential이 없어야 하며, 요청 32 KiB·응답 64 KiB 상한을 적용한다. 작은 합성 입력과 제한된 출력의 실험 경계를 유지하기 위한 Byte 상한이며 유효한 입력을 잘라내지 않고 초과 요청은 전송 전에 거부한다.

명시적 거부는 `REFUSED`, 인증·크레딧·요청 설정 오류는 `CONFIGURATION`, 미완료·잘못된 응답 Envelope는 `INVALID_RESPONSE`, 확인된 일시 거절은 `TEMPORARY_REJECTION`으로 구분한다. 연결 실패·Timeout·불명확한 Server 오류는 `OUTCOME_UNKNOWN`이며 Provider 미실행으로 간주하지 않는다. 일시 거절의 유효한 `Retry-After`는 초 또는 HTTP-date에서 최소 대기 값으로 읽고 임의로 줄이지 않는다. 없거나 무효인 Hint는 즉시 재호출 허가가 아니다. Adapter는 자체 재시도를 하지 않는다. Processor는 일시 거절을 안전한 종류·대기 정보로 호출자에게 전달하며 현재 예약을 보존한다. 이후 선택 Worker에서 대기 기록·조건부 재예약을 연결한 근거는 위의 Worker 검증에 기록했다.

비교한 Log 처리 방식 중 전체 SDK 예외·Prompt·응답 복사 대신 고정 오류 코드와 안전한 전송 횟수·HTTP Status·Token 수만 사용한다. Spring AI가 빈 `choices`에서 Prompt를 Log에 남기는 경로를 피하도록 잘못된 Envelope를 먼저 거부한다. 반환 Model·Service Tier나 사용량이 확인되지 않으면 비용을 0으로 기록하지 않는다. 기존 파일 기반 하루 비용 원장과 연결할 Live 실험도 일반 회귀 Test에서 분리한다. [OpenAI 재시도 지침](https://developers.openai.com/api/docs/guides/rate-limits)

영향 파일은 Lab의 `pom.xml`, `ai/provider` Adapter·단일 HTTP Client·Prompt/Schema·안전한 예외와 Metadata, `ai/processing`의 실패 분기, Adapter HTTP Test·Processor PostgreSQL Test·README다. 실제 Java 호출·PostgreSQL 저장 한 건은 [Java Provider 실험](./lab-reports/2026-10-06-java-provider-adapter-lab.md)에 기록했다. 후속 검토는 자동 Worker의 대기·재시도·중단 복구, 일반 개인정보 탐지와 운영 키 보관·요약 Runtime 상한이다. 이 결정이 기존 SQL Migration이나 Ticket 상태 전이 규칙을 바꾸지는 않는다.

## 사용자와 검토할 질문

1. 문의 의미를 해석할 수 없는 입력의 `ABSTAIN`은 허용하기로 했다. 다른 경계 사례와 담당자에게 보여줄 조회 표현은 무엇으로 정할 것인가?
2. 같은 접수 Transaction에 등록한 Job의 실행권·시도 식별자를 어떻게 저장하고, 이전 실행의 늦은 응답이 현재 결과를 바꾸지 못하도록 할 것인가?
3. Category·Priority 목록과 요약 200자 상한은 적절한가? 저장한 Message·Job의 조회 응답은 어떻게 표현할 것인가?
4. 제안 한 건마다 Row를 추가하고, 아직 확정·적용 기능 없이 `PENDING_REVIEW`로만 두어도 되는가?
5. 승인한 전체·보완 상한과 시간 제한 안에서, 실패 유형별 재시도·기존 결과 조회·결과 저장 재시도의 종료 기준을 어떻게 연결할 것인가?
6. 작업 상태 이름·실패 코드·`RUNNING` 중단 판정과 담당자의 조회 표현은 무엇으로 정할 것인가?
7. 합의한 전체 Priority 기준을 Prompt와 평가 기대값에 어떻게 적용하고, 개별·결합 영향과 정보 부족을 어떤 Case로 확인할 것인가?

남은 질문에 대한 답변을 받아 아직 잠정인 조회·복구·설정 계약을 확정한다. 이미 확인한 Provider 실험·단일 처리·PostgreSQL 저장 근거는 유지하며 설계 합의·실제 구현·수동 내용 평가를 구분한다.

## 검토에 따른 변경

| 날짜 | 변경 | 이유 | 남은 검토 |
|---|---|---|---|
| 2026-09-30 | 긴급도만 불확실하면 `priority: null`인 유효 제안을 저장하는 잠정안으로 수정 | 긴급도를 판단하지 못해도 원문에 충실한 요약과 분류는 사용할 수 있음 | `ABSTAIN`의 정의·기록 방식, Category 불확실, 허용값·길이·권한·실패 응답 |
| 2026-09-30 | 판단 근거 부족은 Category·Priority의 `UNDETERMINED`로 명시하고, 저장하는 두 Column은 `NOT NULL` 후보로 변경 | 원문·결과의 부재와 판단하지 못한 상태의 의미를 구분 | `ABSTAIN`의 정의·기록 방식, 허용값·길이·권한·실패 응답 |
| 2026-09-30 | 누락 Field를 임의로 채우지 않고 전체 응답을 최대 1회 다시 요청하는 잠정안 추가 | 명시적 판단 보류와 계약 위반을 구분하면서 비용·지연과 반복 호출에 한도를 둠 | 재요청 한도, Provider 미완료·거부·Adapter 오류 분류, 작업 실패 코드·조회 표현 |
| 2026-09-30 | 최종 처리 B: 문의 접수 Commit·응답 후 Server의 별도 AI 처리, 수동 생성 API 제외 | AI는 보조 제안이며 AI 실패가 사용자 문의를 취소해서는 안 됨 | Job 등록·복구·조회 계약 |
| 2026-09-30 | 기본 처리 Test → B 연결 → 최소 중단 복구의 단계적 학습 | 출력 검증·Transaction·비동기·복구를 한 번에 구현하지 않고 실패 원인을 분리 | 단계별 실제 Test·Provider 호출 |
| 2026-09-30 | Ticket은 대화 묶음, 원문은 최초 Message로 분리 | 최초 문의와 후속 답변을 같은 메시지 모델로 다루고 본문 중복을 피함 | 작성자 식별자·API 표현·Migration. 후속 대화 기능은 Week 9 이후 |
| 2026-09-30 | Job과 Suggestion 책임 및 다섯 작업 상태의 잠정안 기록 | 제안 부재·실패·명시적 판단 보류와 담당자 검토 상태를 구분 | `ABSTAINED` 기록 방식·복구·호출 한도는 미확정 |
| 2026-10-02 | 10월 1일 학습 회차의 토의를 반영해 Category 범위·겹침 처리 잠정안을 추가하고 Priority와 원인 판단을 분리 | 여러 사용자의 이용 불가가 Server 장애를 확정하지는 않지만 영향과 긴급성은 우선순위 근거가 됨 | Category 범위·겹침 기준과 평가 기대값의 최종 확인 |
| 2026-10-02 | 단일 `category` 대신 복수 `categories` 목록을 채택하고 논리적 Schema를 v2로 변경. Ticket 자동 분리 금지 | 독립적인 복수 문제를 제안에 보존한다는 사용자 승인. 단일 대표값 선택 대신 목록을 사용 | 계약·평가 초안·학습자료·주간 계획에 반영. 빈 목록·중복·항목 검증, 저장 표현, 전체 Priority는 후속 검토·Test |
| 2026-10-02 | 별도의 미분류 문제가 있을 때만 알려진 Category와 `UNDETERMINED` 병기 | 알려진 문제와 설명 부족을 함께 보존하되, 원인 미확인을 문의 유형 미확인으로 오해하지 않는 규칙에 사용자 동의 | 계약·평가 기준·학습자료·학습노트에 반영. 고정 입력의 원문 대조로 확인하며 실제 Provider 평가·Lab Test는 후속 작업 |
| 2026-10-02 | 논리적 계약을 `v2.1-draft`로 구분하고 문의 전체의 Priority 기준 합의 | 사용자가 판단 보류의 보존과 작은 문제들의 누적·연쇄 가능성을 지적하고 보완안 승인 | Field·Enum은 유지. 계약·Rubric·학습자료에 반영하며 평가 전 Prompt·기대값을 정렬. Spring·저장 구현은 후속 작업 |
| 2026-10-02 | A03의 서비스 이용 불가를 `TECHNICAL`로 분류하는 기준 확인 | 문제의 원인이 불명확해도 기술적인 이용 문제라는 유형은 알 수 있다는 구분에 사용자 동의 | 평가 기대값과 학습노트에 반영. 원문에 없는 장애 원인은 추가하지 않으며 나머지 Category 범위·겹침 기준은 계속 검토 |
| 2026-10-02 | 세 문의 유형을 동등한 범주로 정의하고 복수 분류 허용. 상위 범주와 함께 출력하는 계층안은 채택하지 않음 | 사용자 요청으로 Microsoft·AWS·Google의 공개 가이드를 검토한 뒤, 명확한 경계와 복수 분류를 사용하는 안에 승인 | 계약·평가 초안·학습자료·학습노트에 반영. `OTHER` 경계 사례·나머지 기대값과 Prompt 정렬은 후속 검토. 실제 Provider·저장 Test는 별도 |
| 2026-10-03 | 정상 기능의 안내 문구 개선을 `OTHER`로 분류하는 경계 확인 | 요청 내용을 알지만 기존 세 범주 밖이라는 사용자 설명 | N04의 분류 기준에 반영. 다른 Case의 기대값·평가 조건은 계속 검토 |
| 2026-10-03 | 유효한 `ABSTAIN`은 Job `ABSTAINED`·Suggestion 0건으로 기록하고 원문 유지 | 명시적 제안 생성 보류와 호출·검증 실패를 구분하는 처리안에 사용자 승인 | 계약·평가 기준·학습노트에 반영. 구체적 적용 사례·조회 표현·DB 저장 Test와 복구 구현은 후속 작업 |
| 2026-10-03 | 문의 Priority와 보안 신호를 분리하고 AI 전송용 복사본에서 불필요한 민감 정보 제거 | 사용자가 Injection 의심 입력의 보안 경고와 전송 전 마스킹을 제안하고 분리·최소화 방향에 승인 | 출력 Field·Enum과 원문 모델은 유지. 전처리·탐지·안전한 기록과 실제 Test, 원문 보관 정책은 후속 검토 |
| 2026-10-03 | 전체 생성 요청 한도를 별도 설정값으로 분리하고 실패 유형별 재시도 조건과 함께 관리. 복구 한도를 소진한 결과 불명 Job은 사유를 남겨 `FAILED`로 종료 | 2회는 기술적 필연이 아닌 잠정값이라는 검토 후 사용자 승인. 재시작·실패 원인별 한도 초기화와 끝없는 `RUNNING`을 방지 | 전체 상한의 값·설정 적용 규칙·실패 유형별 조건·안전한 실패 코드·대기 기준과 실제 복구 Test는 후속 검토 |
| 2026-10-03 | 필수 Field 누락의 추가 보완 상한도 설정값으로 분리하고 요청 대기·재시도 간격·Job 전체 처리 기한을 구분 | 사용자가 추가 보완과 장시간 대기 후 제한적 재호출을 제안하고 설정 분리안 승인. 보완을 1회로 고정할 기술적 근거는 없음 | 구체적인 설정값·오류별 조건·전체 기한 기준 시점·기존 Job 설정 적용 규칙과 상한·시간·중단 복구 Test는 후속 검토 |
| 2026-10-03 | Ticket·최초 Message·`PENDING` Job을 같은 접수 Transaction으로 Commit하고 Provider는 밖에서 호출 | 별도 Job 등록 전에 중단되는 누락 구간을 막는 추천안에 사용자 승인. Job 등록 실패는 접수 Rollback, Commit 뒤 AI 실패는 원문 유지로 구분 | API 입력·작성자·DDL과 Application Service의 접수 원자성 구현, Job 조회·실행권·중단 복구 및 실제 PostgreSQL Test는 후속 작업 |
| 2026-10-03 | Message 작성자는 Browser의 주장 대신 Server의 인증 결과로 결정 | 사용자가 다른 작성자 이름을 보내도 로그인 사용자를 저장해야 한다고 확인 | 작성자 식별자의 저장 표현·인증 정보 전달과 위조 입력 Test는 후속 작업. 사용자 영속 Table·소유자 권한은 추가하지 않음 |
| 2026-10-03 | 호출 한도 예약을 먼저 Commit하고 Provider는 Transaction 밖에서 호출. 불명확한 예약은 자동 반환하지 않음 | 외부 전송과 DB 기록을 같은 Transaction에 넣어도 Provider 실행이 Rollback되지 않는다는 설명 후 사용자 동의 | 실행권·예약·확인 결과의 저장과 중단 지점별 Test는 후속 작업. 실제 전송·실행·청구 횟수와 예약 횟수는 구분 |
| 2026-10-03 | 초기 Message의 Job Unique, 같은 Job의 재시도, 짧은 실행권·결과 저장 Transaction과 이전 Attempt 차단 기준 합의 | 사용자 문답에서 중복 등록·중복 실행·생성 한도와 결과 저장을 구분 | Unique는 V2 Test로 확인. Worker·Attempt·한도 예약·결과 저장과 복구 Test는 후속 작업 |
| 2026-10-03 | HTTP 계약을 유지한 별도 PostgreSQL 접수 Service와 Message·PENDING Job V2 구현 | 사용자가 접수 원자성 실습에 동의. 저장 실패를 실제 DB에서 먼저 확인 | 이름 Snapshot·원문 보존·기존 Ticket 유지. 본문 길이·HTTP 입력·인증 작성자 연결은 미확정 또는 미실시이며 Worker·Suggestion은 추가하지 않음 |
| 2026-10-03 | Java 출력 계약 검증기와 Unit Test 64개 구현 | 계속 학습·구현 요청에 따라 합의한 Field·Enum을 독립 검증. 길이 상한은 설정으로 받고 Parser 오류는 고정 코드로 전달 | 전체 Java 140개·JavaScript 54개 통과. Runtime 연결·민감 정보 처리·Provider 실패·내용 검토·구체적인 보류 사례는 후속 확인 |
| 2026-10-03 | 제목·본문에서 문의 의미를 해석할 수 없는 입력을 `ABSTAIN` 허용 사례로 확인 | “문제가 생겼다”는 요청의 의미가 있지만 `ㅁㄴㅇㄹ ???`에는 해석할 문의 내용이 없다는 구분에 사용자 동의 | Field·Enum·13건·52회 유지. 공통 Prompt만 `prompt-v3-abstain-draft`로 정렬. 실제 Model 판단·작업 상태 저장과 추가 경계 사례는 후속 확인 |
| 2026-10-04 | 개인정보 전처리 확인을 Fake Provider 인자 검사만으로 끝내지 않고 실제 AI 실험·전송 직전 요청 검사로 구성 | 사용자 요청에 따라 실제 모델의 반응도 관찰하되, 요약 결과만으로 미전송을 판단하지 않음 | 이 계약·평가 초안·주간 계획에 반영. 합성 입력만 사용하며 실제 개인정보·Credential 출력 금지. 10/5 야간 또는 10/6 재개 전 당일 누적 예산 확인, 전처리·실험·안전한 Log 검증은 미실시 |
| 2026-10-05 | 종류별 치환·최종 Body 검사와 파일 기반 일일 누계의 독립 실행기를 사용해 6회·52회 실험 | 전송 전 검사와 실제 Model 관찰을 연결하고 기존 하루 비용을 이어서 관리 | 선택한 Java 110개·JavaScript 74개 통과. Spring Runtime 연결·제안 저장·복구는 후속 작업 |
| 2026-10-05 | 기대값은 유지하고 금전 피해·원인 미확인 구분을 공통 Prompt v4에 명시 | 두 방식에서 같은 판단 오류가 반복돼 합의한 정책을 명확히 전달하는 안에 사용자 승인 | Dataset·Schema·Rubric·Model 유지. 기존 52회 결과 보존, 재비교와 수동 채점은 남음 |
| 2026-10-05 | Profile별 생성 Controller와 `title`·`body`, 앞뒤 공백 제외 본문 2,000 Code Point 계약 확정 | 기존 In-memory 회귀를 보존하면서 PostgreSQL 접수의 본문·인증 작성자·Job을 연결하는 안에 사용자 승인 | HTTP Test 17개·Domain Test 4개, 전체 Java 207개·JavaScript 79개 통과. Browser E2E·Worker·AI 제안 저장은 후속 단계 |
| 2026-10-05 | 예상 밖 오류의 Log는 고정 코드·예외 종류만 기록 | DB Constraint 예외에 실패 Row의 본문이 포함될 수 있어 새 원문의 노출을 방지 | Message·Job INSERT 실패 Test에서 원문과 실패 Row 메시지 미출력 확인. 상세 진단이 필요하면 안전한 Metadata 기준을 별도 검토 |
| 2026-10-05 | Job 등록 시 정책 Snapshot을 저장하고 설정 변경은 새 Job부터 적용 | 실행마다 최신 설정을 읽는 안과 비교해 기존 작업의 호출·시간 한도를 유지하는 권장안에 사용자 승인 | 이 계약·학습노트에 반영. 누적 예약 횟수의 증가 표현은 권장안, 설정 초기값·기존 V2 Job 이행·Migration과 실제 DB 검증은 후속 작업 |
| 2026-10-05 | 누적 예약 증가 표현과 전체 3회·보완 1회, 대기 60초·실행권 120초·Backoff 5초·전체 300초의 초기값 승인 | 남은 횟수의 중복 저장을 피하고 재시작·설정 변경에도 기존 Job 한도를 유지 | 최초 Claim부터 전체 기한을 계산하고 Queue 대기는 제외. 기존 V2 Job은 V3 기본 정책으로 이행하며 출처를 표시 |
| 2026-10-05 | 일반 PENDING 조회와 결과 확인 후 RUNNING 재예약을 분리하고 실행권·예약 원장을 짧은 독립 Transaction으로 저장 | Lease 만료를 Provider 미실행으로 오해하지 않고, 동시 예약·늦은 이전 Attempt·원장 저장 실패를 분리 | 실제 PostgreSQL 검증은 실행권 단계. 자동 Worker·Provider 조회와 호출·Suggestion 결과 저장은 다음 단계 |
| 2026-10-05 | Suggestion·복수 Category·Job 완료를 같은 결과 Transaction에 저장하고 분류를 별도 Table로 분리 | 배열·JSONB와 비교한 권장안에 사용자 승인. Commit 불명확 시 AI 재호출 전에 DB 결과를 확인 | V4·결과 Service·Adapter·새 Test 19개, 전체 Java 255개·JavaScript 79개 통과. Row Lock·제약·원자성·원문 보존 확인. 일반 CHECK의 자식 최소 개수 한계, 요약 Runtime 상한·자동 저장 재시도·Worker·실제 Provider·Browser·재시작은 후속 검토 |
| 2026-10-05 | 우리 서버의 SDK 재전송도 같은 Job의 호출 예약에 포함하고 기본 구현에서 SDK 자동 재시도를 끄기로 합의 | 제공자 서버 내부 재처리와 구분하고, 함수 호출 한 번 뒤 여러 HTTP 요청이 생성 한도를 우회하는 것을 방지 | Provider Adapter·Worker·실제 전송 횟수 검증은 미구현. Job 한도·기존 예약·제공자 실행 및 청구 횟수의 구분은 유지 |
| 2026-10-05 | 일시적인 Rate Limit은 유효한 `Retry-After`·Job Backoff와 전체 횟수·기한·실행권 조건을 지켜 재예약, 크레딧 부족은 원인 해결 전 자동 재요청 금지 | 같은 `429`를 무조건 반복하는 안 대신 원인별 조건부 재시도 안에 사용자 승인. 대기 중 Lock을 유지하지 않고 새 요청마다 예약 Commit | 계약·학습자료·학습노트에 반영. 오류 분류·대기 기록·Worker 재시도·Test는 미구현. Header 부재·무효의 대기 정책과 정책 Version 이행은 후속 검토 |
| 2026-10-06 | 단일 Processor·Spring AI Adapter·최종 전송 Body 검사를 연결하고 실제 AI 응답을 PostgreSQL에 저장 | 기존 접수·예약·결과 Transaction과 출력 계약을 유지한 실제 연결 실험 | 무료 Java 318개·JavaScript 104개·ESLint와 별도 Live Test 1개 통과. 원문 보존·제안 1건·Job 완료 확인. 자동 Worker·복구·조회·Browser·수동 평가는 남음. 학습 내용은 10/5 회차에 포함 |
| 2026-10-06 | DB의 다음 실행 시각과 별도 TEMPORARY_RETRY로 조건부 재시도를 연결하고 Worker는 기본 꺼짐·명시적 의존성으로 활성화 | Backoff·최소 대기·전체 기한과 최종 FAILED 경계 설명 후 구현 진행 승인. 기존 한도·원문 보존·짧은 Transaction 유지 | V5·Worker·설정·Scheduler·Context의 새 Test 31개, 전체 Java 349개·JavaScript 104개·ESLint 통과. 유료 호출 0회. 결과 불명 자동 복구·실제 JVM·Browser·내용 평가는 후속 과제 |
| 2026-10-06 | 메모리의 검증 객체로 DB 저장만 총 3회·최소 5초 재시도하고 상한 뒤 현재 실행만 종료 | 현재 Attempt·기존 결과·기한 확인과 제한된 객체 재사용에 사용자 승인. 즉시 AI 재생성·무제한 저장은 채택하지 않음 | V6·Worker·Processor·설정, 새 Test 15개와 전체 Java 364개·JavaScript 104개·ESLint 통과. 원문·생성 예약 유지, 대기 중 DB Lock 없음. Process 종료 후 객체 복구·결과 불명 새 생성은 후속 검토 |

JSON의 `null`과 Field 누락의 차이는 [JSON Schema의 null 설명](https://json-schema.org/understanding-json-schema/reference/null)을 참고한다.
Transaction의 Commit·Rollback은 [PostgreSQL 공식 문서](https://www.postgresql.org/docs/17/tutorial-transactions.html)를 참고한다.
