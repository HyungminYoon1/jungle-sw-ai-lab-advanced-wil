# 2026-11-03 고객 후속 저장과 종류별 재확인 검증

> 상태: Locally Verified — 645b3df 첫 저장 단위 당시의 기록. 목록/고객 화면/확인 API는 후속 보고서로 구분
> Source: Lab 645b3dfe0b48fdf549b708aecc40a25c967169fd, Flyway V11
> 기준: [기술 계약](../customer-followup-contract-draft.md), [학습 기록](../study-notes/2026-11-03-study-questions.md)

## 질문과 예상

고객 후속 글의 저장과 같은 제출 재확인을 Ticket의 해결 상태와 분리할 수 있는지 확인했다. 새 글은 Commit 후 201, 같은 종류/본문/UUID는 200과 추가 Row 0, 다른 종류나 내용은 409를 예상했다. 본인 소유권, 원문과 기존 AI 데이터의 보존을 실제 PostgreSQL에서 검증했다.

## 구현 범위

- V1~V10은 그대로 두고 V11에서 CUSTOMER_FOLLOWUP과 관련 필드 조합의 CHECK를 확장했다. 공식 답변의 기존 제출 Unique와 구형 NULL 배정 버전은 유지했다.
- POST /api/tickets/{ticketId}/customer-messages에 인증/CSRF, 고정 ID 소유권, 비공백/2,000 Code Point와 32 KiB 실제 읽기 한도를 적용했다. 허용 필드는 body/clientRequestId뿐이다.
- 같은 Ticket 잠금 뒤 본인과 기존 제출을 확인하고 새 Message를 저장한다. 공식 답변/후속 글 양쪽에서 메시지 종류를 검사해 다른 종류를 기존 성공으로 반환하지 않는다.
- 기존 대화 조회/Decoder가 새 종류를 처리하고 화면은 고객/담당자 역할로 Text를 표시하도록 호환을 보완했다. 고객 작성 Form이나 목록을 구현한 것은 아니다.

## 환경과 실행

Windows PowerShell 7, Java 25와 Docker Desktop을 사용했다. Engine이 꺼져 있어 기존 사용자 승인에 따라 실행했고, 격리 PostgreSQL 17.6-alpine Testcontainer에서 확인했다. 각 HTTP Test는 Testcontainer의 JDBC URL과 실제 연결을 대조한 뒤 자기 DB만 초기화한다.

```powershell
.\mvnw.cmd -B -ntp '-Dtest=TicketCustomerFollowupHttpIntegrationTest,CustomerFollowupMigrationIntegrationTest,TicketConversationHttpIntegrationTest,TicketAssignmentHttpIntegrationTest' test
.\mvnw.cmd -B -ntp verify
node --test --test-reporter=dot 'src/test/js/*.test.mjs'
npx --yes --package eslint@10.11.0 eslint 'scripts/week7-*.mjs' 'scripts/cloudshell-*.mjs' 'src/main/resources/static/*.mjs' 'src/test/js/*.mjs'
```

첫 집중 실행은 76개 중 오류 1건이었다. 권한 회수 사례가 남긴 합성 직원의 inactive 값이 다음 사례에 남아 배정 준비에서 거부됐다. Test의 BeforeEach에서 해당 합성 계정의 권한만 명시적으로 복원했다. 운영 Bootstrap의 INSERT-only 정책이나 접근 검사를 완화하지 않았고, 수정 뒤 전체 verify에서 검증했다.

## 실제 결과

| 검사 | 결과와 의미 |
|---|---|
| 고객 후속 HTTP 26개 | 모두 통과. 실제 Spring Security/MockMvc와 PostgreSQL의 저장/재확인/거부/실패 경계 |
| V10→V11 Migration 1개 | 기존 Ticket/Message/배정 Row와 구형 답변 유지, 필수 필드/정정/배정 값과 공유 UUID 제약 확인 |
| 전체 Java | Surefire 1,095개 통과, 실패/오류/Skip 0 |
| 패키징 후 Java | Failsafe 2개 통과, 실패/오류/Skip 0 |
| 전체 JavaScript/Lint | 333개와 ESLint 통과. 새 종류 수용과 공식 답변 응답으로 오인하지 않는 사례 포함 |
| Provider | 새 HTTP Test 모두 mock 상호작용 없음. Worker/Provider 비활성 |

집중 실행과 새 27개는 전체 1,095개에 포함하므로 더하지 않는다. JavaScript도 Node Test이며 실제 Browser를 새로 실행한 근거가 아니다.

## 중요한 실패 및 보존 사례

다른 고객과 비등록자 직원은 후속 작성이 거부됐다. 이름만 같은 신원 미연결 Session도 거부됐다. 직원이 본인 문의의 등록자인 경우에는 인계와 직원 권한 회수 후에도 고객 소유권으로 후속 작성이 가능했다.

OPEN/IN_PROGRESS/RESOLVED 각각에서 원문 저장과 상태/배정 유지, 기존 최초 Message/Job의 값 보존을 대조했다. 같은 UUID 동시 요청은 같은 Message ID와 한 번의 새 저장을 반환했다. 다른 종류의 UUID 충돌은 양쪽 방향에서 409였다.

기존 공식 답변/배정과 비어 있지 않은 AI 제안/분류/Attempt를 먼저 저장한 뒤 새 후속 INSERT 후 실패를 주입했다. 확인된 Rollback 뒤 기존 값이 모두 같았다. 별도 사례에서는 지연 FK 위반을 만들어 실제 Commit 시점에 실패하도록 했고, 201 대신 500과 기존 Row 보존을 확인했다. 행 수뿐 아니라 기존 본문/소유권/참조와 업무 Row 전체를 비교했다.

32 KiB의 실제 입력은 허용하고 한 Byte 초과는 413으로 거부했다. Content-Length를 작게 준 경우도 실제 Stream으로 제한했고 JSON Escape로 표현한 2,000개 이모지는 저장, 2,001개는 거부했다. 중복 속성/후행 JSON/추가 필드도 거부했다.

## 해석과 다음 단위

이 결과는 첫 저장 단위의 로컬 근거다. 그 시점에는 Commit ACK 유실 자체를 실제 네트워크에서 주입한 실험이나 새 Browser/Cloud/원격 CI가 없었다. 실제 AI 호출이나 운영 데이터도 사용하지 않았다. 기존 Hikari/Test JVM 종료 관련 경고를 이 기능으로 해결했다고 주장하지 않는다.

당시 다음 작업이었던 목록/고객 화면은 [후속 화면 보고서](./2026-11-03-my-tickets-and-followup-ui.md), 배정별 확인 저장/API는 [V12 보고서](./2026-11-03-customer-message-confirmations.md)에 별도로 기록했다. 저장소 Push/CI는 [전달 기록](./2026-11-03-documentation-publication.md)에서 확인한다. 첫 단위에서 runtime probe의 Schema 기대값을 11로 맞췄지만 과거 메모리/CPU 수치를 새 측정 결과로 바꾸지 않는다. 실제 소요 학습시간은 미기록이며 계획 배분을 실적으로 간주하지 않는다.
