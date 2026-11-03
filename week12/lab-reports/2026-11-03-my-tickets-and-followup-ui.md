# 내 문의 목록과 고객 후속 작성 검증

> 일자: 2026-11-03
> 상태: 로컬 PostgreSQL/MockMvc, 실제 Browser와 최종 전체 회귀 검증 완료
> Source: Lab 목록 API 7018c0b, 고객 작성 화면 104d031, Flyway V11 유지
> 기준: [기술 계약](../customer-followup-contract-draft.md), [첫 저장 검증](./2026-11-03-customer-followup-storage.md)

## 구현한 흐름

고객이 문의 번호를 기억하지 않아도 자신의 문의를 찾아 대화를 읽고 추가 글을 남기도록 연결했다. '내 문의'는 직원의 담당 업무 목록과 다르다. AGENT라도 이 경로에서는 본인이 등록한 문의만 반환한다. 서버는 Principal의 계정 키로 고정 사용자 ID를 찾아 매 Query에 requester 조건을 적용한다.

GET /api/my/tickets는 문의 번호/제목/상태/최근 활동 시각만 반환한다. 최근 활동은 마지막 공개 Message ID의 created_at이며, 인계나 확인 때문에 바뀌지 않는다. 소유자가 알려진 구형 빈 Ticket도 NULL 활동 시각으로 마지막에 반환한다. 기본 50/최대 100, 활동 시각과 Ticket ID의 Cursor를 사용한다. Cursor는 1,024 Byte 안의 버전/시각/양의 ID를 엄격하게 검사하며 권한 근거로 사용하지 않는다.

같은 시각/NULL 경계와 limit+1을 처리한다. 커서가 읽는 사이에 문의가 맨 위로 이동하면 다음 페이지에서 빠질 수 있으므로 첫 페이지부터 새로 조회한다. 이는 계속 바뀌는 활동 목록이며 고정 Snapshot이나 누락 없는 이벤트 원장이 아니다.

목록의 고정 링크로 대화를 선택하고 고객 추가 문의 Form을 표시한다. canFollowUp은 등록자 본인, canReply는 현재 직원 담당자 기준이다. 혼합 역할과 직원 권한 회수 후 고객 소유권도 구분한다. 실제 저장 권한은 서버가 다시 확인한다.

후속 Form은 body/UUID만 전송한다. 작성 종류는 서버 DTO에 추가하지 않고 Client의 미확인 제출 정보에 함께 보존한다. 저장 여부가 미확인일 때 다른 Form이나 본문으로 바꿔 보내지 않는다. 저장 성공을 확인한 뒤 GET만 실패하면 조회를 다시 한다. 문의 선택 변경과 pagehide에서 원문/초안/제출 정보를 지우고 Text만 렌더링한다.

후속 글은 Ticket 상태나 AI Job을 바꾸지 않는다. 고객 작성 화면과 담당자 AI 화면에 최초 문의 기준의 요약/분류/우선순위이며 이후 대화는 반영하지 않는다고 표시했다. 새 Migration, 일반 입력 AI 처리, Cloud나 운영 계정 기능은 추가하지 않았다.

## 실행과 실제 근거

```powershell
.\mvnw.cmd -B -ntp '-Dtest=MyTicketsHttpIntegrationTest' test
.\mvnw.cmd -B -ntp '-Dtest=TicketCustomerFollowupHttpIntegrationTest,TicketConversationHttpIntegrationTest,ConversationBrowserExperiment' test
.\mvnw.cmd -B -ntp verify
node --test --test-reporter=tap 'src/test/js/*.test.mjs'
npx --yes --package eslint@10.11.0 eslint 'src/main/resources/static/*.mjs' 'src/test/js/*.mjs'
```

| 검사 | 확인한 결과 |
|---|---|
| 목록 HTTP/PostgreSQL 27개 | 본인 범위, 빈 목록/구형 소유자 미확인 제외, 미연결 신원 거부, 직원 권한 회수 후 본인 목록, 엄격한 Query/Cursor와 NULL/동일 시각, 이동 뒤 새로고침 |
| 기존 대화/후속 HTTP 50개 | 기존 계약과 새 Capability 호환. 첫 저장 단위 26개/대화 24개와 겹침 |
| 실제 Browser 실험 1개 | 별도 합성 계정과 Session. 다른 고객의 빈 목록, 본인 목록→대화 링크/자동 선택, 후속 Form, CSRF, Text 표시와 재로그인 |
| Browser 뒤 JDBC 대조 | Message 6건: 최초 문의 1/공식 답변 4/고객 후속 1. 본문/인증 작성자/UUID/참조와 배정 버전 확인 |
| AI/원문 보존 | 최초 문의 유지, OPEN 유지, 기존 Job 1건 PENDING/예약 0/Attempt 0/제안 0, Provider mock 호출 0 |
| JavaScript/Lint | 전체 Node 345개와 ESLint 통과. 미확인 제출의 종류/UUID 보존, GET만 재시도, 늦은 조회/중복 페이지 포함 |
| 최종 전체 Java | Surefire 1,122개/패키징 후 Failsafe 2개, 실패/오류/Skip 0, BUILD SUCCESS. 집중 실행은 겹치며 Browser 1개는 기본 전체 수에서 제외 |

목록 Test의 첫 실행에서는 MockMvc HEAD 응답 본문이 비어 있을 것으로 예상해 한 건 실패했다. MockMvc는 GET 매핑 결과를 본문에 보존하므로 권한/무변경 검사로 바로잡았다. 실제 HTTP의 HEAD 본문 억제는 Browser fetch로 별도 확인했다. 운영 응답이나 권한을 완화해서 Test를 맞춘 것이 아니다.

새 URL 자동 선택에서 Browser 전역 URLSearchParams의 Lint 인식 문제가 있었고 window.URLSearchParams로 명시해 수정했다. 이후 Lint가 통과했다. 이 수정은 업무 정책이나 서버 권한 변경이 아니다.

Browser의 임시 암호와 Session 값, 인증 정보가 담긴 로그는 공개 출력하지 않는다. 화면 결과는 Lab의 무시되는 output/playwright 아래에 보관했다. 고객 화면에서 공격성 HTML 합성 문자열이 글자로 보이는 것을 이미지로도 확인했다. 실제 고객 데이터/비밀값을 사용한 검증은 아니다.

## 해석과 다음 단위

이 보고서는 104d031까지의 저장 API/목록/고객 화면 로컬 근거다. 그 검증 시점에는 원격 CI/Push, Image/AWS 배포, 실제 AI 호출을 진행하지 않았다. 전체 실행에서는 테스트 뒤 Surefire의 fork JVM 종료 제한 경고가 한 번 나왔다. 첫 저장 단위 로그에는 같은 문구가 없었으므로 이전 Hikari/종료 관련 기록과 동일한 원인이라고 단정하지 않는다. 결과/패키징 통과와 별개로 깨끗한 테스트 프로세스 종료는 미해결 항목이다. 인덱스 성능 측정이나 실제 운영 부하 검증도 아니다.

이후 배정 버전별 확인 저장/API는 [V12 보고서](./2026-11-03-customer-message-confirmations.md)에서 검증했다. 직원의 확인 표시/버튼과 해당 Browser 흐름은 남아 있다. 대화를 GET한 것만으로 확인을 만들지 않고 명시한 고객 Message ID까지 기록하는 계약을 유지한다. 저장소 공개 결과는 [전달 기록](./2026-11-03-documentation-publication.md)으로 구분하며 실제 학습시간과 남은 기술 예산은 미기록이다.
