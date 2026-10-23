# 10월 23일 학습 노트: 공식 답변, 제출 UUID와 저장 경계

> 학습일: 2026-10-23 KST
> 기록 마감: 2026-10-24 KST, 자정을 넘긴 같은 회차
> 상태: 오늘의 구현과 핵심 문답 마감. Week 10 전체 마감은 별도
> 범위: 고정 사용자 ID, 공식 답변과 정정, 대화 조회, 재전송 및 실패 결과 해석

## 기록을 남기는 이유

구현과 실행 수치는 [실습 보고서](../lab-reports/2026-10-23-official-reply-conversation-lab.md)에 이미 있다. 이 노트에는 코드를 보고 확인한 이해, 설명을 다시 구성한 부분과 아직 평가하지 않은 범위를 남긴다. 전체 문답이나 Test 결과를 반복해서 옮기지는 않는다.

오늘의 질문은 '같은 사용자, 같은 제출, 저장 성공을 각각 무엇으로 판단하는가?'였다. 정책은 [설계 문서](../official-reply-conversation-design-draft.md)의 P1~P8을 따르며 이번 복습으로 새 업무 정책을 추가하지 않았다.

## 코드와 연결해 확인한 내용

기준 코드는 Lab `edd2427`이다. 이후 문서 마감 Commit은 구현 버전과 구분한다.

- [TicketConversationService](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/blob/edd24278683b9e9042109b3658c03f6c75dbfe30/src/main/java/lab/helpdesk/ticket/application/TicketConversationService.java): 인증된 Actor, 재전송, 정정과 Transaction 경계
- [conversation-ui.mjs](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/blob/edd24278683b9e9042109b3658c03f6c75dbfe30/src/main/resources/static/conversation-ui.mjs): 조회 순번, 선택한 Ticket, 미확인 제출과 화면 상태
- [대화 HTTP 통합 Test](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/blob/edd24278683b9e9042109b3658c03f6c75dbfe30/src/test/java/lab/helpdesk/ticket/web/TicketConversationHttpIntegrationTest.java): 실제 PostgreSQL의 중복 방지, 실패와 기존 데이터 보존

| 주제 | 학습자가 설명한 판단 | 확인한 경계 |
|---|---|---|
| 고정 사용자 ID | 로그인 이름이 같아도 내부 사용자 ID가 다르면 이전 문의를 읽을 수 없음 | 로그인 표시 이름과 문의 소유권은 별개 |
| 제출 UUID | 같은 UUID, 본문과 정정 대상을 재확인하면 200, 추가 답변 Row는 0건 | 응답을 잃었어도 새 UUID로 자동 전송하지 않음 |
| Commit | Commit 실패 시 201을 반환하면 안 되며, 이미 저장된 문의와 AI 제안은 유지 | 메서드 안의 INSERT 성공과 Transaction의 최종 성공은 다름 |
| 정정 | 기존 공식 답변 82를 유지하고 이를 참조하는 새 OFFICIAL_REPLY를 저장 | 문의 Message를 정정 대상으로 쓰지 않으며 최초 AI 입력도 유지 |
| 권한 | USER의 답변은 403, 미확인 등록자 문의의 AGENT 답변은 409, 추가 canReply 필드는 400 | 화면 표시와 Browser 입력은 권한 근거가 아님 |
| 페이지 조회 | 마지막으로 반환한 ID를 다음 Cursor로 사용하고, 기존 50건에 나머지 20건을 이어 붙임 | 예시의 2건은 설명용이며 실제 화면 요청은 50건, API 최대는 100건 |
| 조회 시점 | 다음 조회 전에 새 답변이 Commit되면 남은 20건과 함께 21건을 읽을 수 있음 | 모든 페이지를 최초 조회 시점의 고정 Snapshot으로 읽는 설계가 아님 |
| 늦은 응답 | 선택한 Ticket뿐 아니라 가장 최근 조회 순번도 비교 | 같은 Ticket을 다시 읽은 경우에도 오래된 응답은 무시 |
| 저장 뒤 조회 실패 | 저장 성공을 확인했다면 대화 GET을 재시도하고 답변 POST를 반복하지 않음 | POST 응답 자체를 잃은 '결과 미확인'과 구분 |
| Test 해석 | messageCount()가 2인지 확인해도 기존 본문과 참조 값 보존은 별도로 검사해야 함 | Row 개수, 내용 보존, 화면 판단, 실제 DB Commit은 서로 다른 검증 대상 |

화면에서 오래된 POST 응답을 무시해도 서버에서 이미 Commit된 답변은 취소되지 않는다고 설명했다. 현재 화면의 선택 상태가 DB 저장 여부를 결정하는 것은 아니다.

## 설명을 보완한 지점

### 1. 충돌과 새 답변을 구분

같은 제출 ID로 본문을 바꾸는 경우 학습자는 '400번대 실패, 기존 본문은 변경하면 안 됨'이라고 답했으나 정확한 Status는 기억하지 못했다. 이 계약은 `409 REPLY_REQUEST_CONFLICT`로 설명했다. 409를 독립적으로 다시 답하는 평가까지 마쳤다고 기록하지 않는다.

새 UUID의 제출을 처음에는 '새 질의'라고 표현했다. 이 API에서는 새 OFFICIAL_REPLY이며 고객 INQUIRY나 새 AI Job이 아니다. 이후 정정과 최초 AI 입력 유지 문답에서는 이 구분을 확인했다.

### 2. 페이지 조회는 전체 대화를 포기하는 것이 아님

처음 설명에서 Cursor와 동시 저장을 함께 다뤄 이해가 어려웠다. '마지막으로 읽은 위치를 표시하는 책갈피'로 다시 설명했고, 학습자는 마지막 반환 ID가 15라면 Cursor는 15이고 더 읽을 글이 없으면 hasMore는 false라고 답했다.

전체 대화에 접근할 수 있는 기능과 한 HTTP 응답으로 전부 보내는 것은 다르다. 설명용 2건과 실제 50건 설정도 구분했다. 현재 화면은 오래된 글부터 수동으로 다음 페이지를 읽으며, 최신 글 자동 이동이나 실시간 갱신은 없다. 50건이 측정으로 입증한 최적값이라는 뜻도 아니다.

### 3. 성공한 저장과 성공한 화면 갱신은 다름

유효한 POST 201을 받은 뒤 GET이 실패하면 저장 성공은 알고 있지만 화면 갱신은 실패한 상태다. POST의 응답을 받지 못했다면 저장 여부 자체가 미확인이다. 후자는 같은 UUID, 본문과 정정 대상을 유지해 명시적으로 재확인하며 새 UUID로 자동 재전송하지 않는다.

## 화면 판단을 별도로 관찰한 실험

실제 createConversationClient에 제어된 fetch 응답을 전달했다. 실제 DB나 Provider를 사용하지 않은 화면 로직 실험이다.

| 조건 | 관찰한 요청 | 최종 화면 상태 |
|---|---|---|
| POST 201 뒤 대화 GET 503 | 답변 POST 1회, 최초 조회를 포함한 GET 2회, 제출 UUID 발급 1회 | reply-saved-refresh-failed |
| POST 응답을 받지 못함 | 답변 POST 1회, 최초 GET 1회, 제출 UUID 발급 1회 | unknown-outcome |

학습자는 이 결과가 화면의 판단 로직을 확인한 것이고 실제 DB Commit 성공은 별도 통합 Test로 검증해야 한다고 답했다. 이 두 관찰을 기존 JavaScript Test 316개에 추가 합산하지 않는다.

## 구현 결과와 역할 구분

오늘 앞서 실행한 로컬 전체 Java 1,042개와 패키징 후 2개, JavaScript 316개 및 Lint가 통과했다. 마지막 화면 정리 뒤 명시적 Browser 실험과 패키징 Test도 통과했다. Browser에서는 합성 USER 두 명과 AGENT의 권한, Session과 CSRF, 답변과 정정 및 DB Row를 대조했다. 자세한 시각, 실패 수정과 실행 명령은 실습 보고서를 따른다. 문답을 마친 뒤 전체 Test를 다시 실행한 것으로 쓰지 않는다.

- Codex: 기술 설계, 코드와 Test 작성, 로컬 실행, 화면 실험 및 기록 정리
- 학습자: P1~P8 정책 결정, 제시된 코드와 상황에 대한 판단, 설명이 불명확한 지점의 재질문
- 미평가: 코드를 보지 않은 전체 재구현, 학습자의 독립 명령 실행과 전체 실습 재현, Cursor와 늦은 Commit을 연결한 잠금 설계의 독립 설명

Test 개수만으로 기존 데이터 보존을 주장할 수 없다는 점과 화면 실험을 DB 검증으로 바꾸어 말하면 안 된다는 점까지 확인했다. 핵심 문답은 마쳤지만 모든 코드를 직접 작성하거나 독립 재현했다는 평가와는 구분한다.

## 다음 회차와 남은 범위

오늘은 여기서 학습과 구현을 종료한다. 학습 노트와 관련 문서를 정리하고 두 저장소를 Commit·Push하는 범위만 이어간다. 원격 CI 결과는 실습 보고서에 별도로 기록하며 ECR 업로드, Cloud 재배포나 실제 AI 호출은 하지 않는다.

10/24와 10/26의 초기 계획 중 이미 끝낸 구현과 핵심 문답은 다시 배정하지 않는다. 실제 가용시간과 주간 활동 기록을 확인하고 필요한 보충 또는 발견한 문제만 다룬다. 10/25는 휴무다. 주 6시간 경계는 유지하되 실제 소요시간이나 취업 활동을 추정해 채우지 않는다.

Week 10 전체 마감과 주간 WIL은 아직이며 10~12주차 블로그는 합의한 통합 한 편을 유지한다. 계정 관리, 고객 후속 메시지, Cross-tab 즉시 로그아웃, 종료 경고 진단, 운영 적용과 개인정보 고도화는 별도 후속이다.
