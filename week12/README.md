# Week 12 고객 후속 대화 구현과 최종 회고

> 기간: 2026-11-03 화요일 ~ 2026-11-09 월요일. 11/6 세미나 참석으로 해당 학습은 11/5에 진행
> 상태: Completed. 11/9 최종 문답과 주간 WIL, 전체 회고, 수료 후 진행안을 마감했다. 통합 블로그 작성과 포럼 등록도 작성자가 완료했다고 확인했다.
> 핵심 질문: 고객의 추가 문의를 안전하게 저장하고 담당자의 확인까지 연결하며, 실제 검증한 범위를 설명할 수 있는가?

11주차에서 이어지는 고객 후속 메시지와 현재 담당자의 명시적 확인을 우선한다. 공식 답변, 대화 조회와 배정/인계의 V10을 기반으로 작은 단위로 확장하고, 마지막 이틀에는 재현성과 학습 결과를 정리한다. 취업 활동 우선과 기술 작업 주 6시간 기준은 유지한다.

## 구현과 학습 진행

두 저장소의 문서 정합성과 공개 결과는 [11/4 최종 검토 기록](./lab-reports/2026-11-04-final-review-publication.md)에서 확인한다. 과거 실행의 테스트 개수를 합산하지 않으며, 로컬 검증과 원격 CI를 따로 기록한다.

11/5에는 저장 응답과 POST 전 실패, Pool과 Thread의 수명 및 검사 범위를 학습했다. 11/6에서 옮긴 새 고객 글, 늦은 확인, 인계와 재배정도 코드 및 검증 기록에 대조했고, Ticket 행 잠금과 배정별 확인 지점의 문답까지 마쳤다. [11/5 학습 기록](./study-notes/2026-11-05-study-questions.md)

11/7에는 권한, 동시 저장, Rollback, 응답 유실과 기존 데이터 보존의 소스 및 기존 실행 근거를 대조했다. 같은 Ticket의 잠금 대기, Commit 실패와 응답 유실, 최초 문의 참조와 행 값 보존을 문답으로 확인했다. 이번 회차의 새 테스트 실행은 0건이며 마지막 답변까지 기록했다. [11/7 학습 기록](./study-notes/2026-11-07-study-questions.md)

11/8에는 브라우저, 서버 통합 검사와 CI의 기존 실행 근거를 구분하고 기준 Commit 및 작업 트리 변경을 기록하는 방법을 점검했다. 기존 UUID의 재확인과 저장 이력이 없는 요청의 버전 검사를 문답으로 확인했다. 새 테스트 실행은 0건이다. [11/8 학습 기록](./study-notes/2026-11-08-study-questions.md)

| 구분 | 현재 상태 | 다음 작업 |
|---|---|---|
| 공식 답변과 배정/인계 | V10 기반. 후속 저장 645b3df, 목록 7018c0b, 고객 화면 104d031/V11 | 기존 권한, 제출 UUID, Commit과 데이터 보존 계약 유지 |
| 고객 후속 정책 | F01/F02/F03/F04/F05/F07/F11/F12/F13과 공개 대화 활동 시각 합의. V11/V12 계약과 구현으로 연결 | 합의한 범위를 유지하고 통합 사례에서 적용 |
| 후속 쓰기 API | V11, MockMvc/실제 PostgreSQL 및 전체 회귀 통과 | 종류 충돌과 Commit/보존 근거를 실제 코드로 확인 |
| 목록/고객 작성 화면 | PostgreSQL/MockMvc와 실제 합성 Browser 검증 완료 | 가변 Cursor와 저장/조회 실패의 학습 보충 |
| 배정별 명시적 확인 저장/API | 80e5de9/6b3ba1d, V12. 집중 43개와 당시 전체 Java 1,165+2 통과 | 기존 저장/인가/Commit 계약 유지 |
| 직원 업무 표시와 확인 버튼 | 11/4 목록 집중 8개/기존 75개, 당시 Node 366개/Lint와 실제 Browser/DB 대조 통과 | 후속 재선택 UI/검증은 아래 별도 근거. 서버 권한/Commit 계약 유지 |
| 확인 응답 유실/저장 후 GET 실패 | 11/4 별도 실제 Browser/PostgreSQL 실험 1개 통과. POST 3회/확인 Row 2건, 기존 업무 Snapshot 유지 | 결과 미확인 때 재선택을 열지 않는 기존 Browser 검증도 재실행 통과 |
| 인계/서비스 권한 회수 | 같은 Session의 재확인/새 쓰기/권한 회수 후 요청을 별도 Browser/DB로 검증. A 기록 1건 보존/B 새 배정은 NULL | 재선택 변경 뒤 기존 Browser 검증도 재실행 통과 |
| 배정 충돌 뒤 명시적 재선택 | Lab 30fb333. 당시 Node 380개/Lint와 집중 Browser 3개 통과. 실제 A→B→A의 409/201과 현재 배정 3의 확인 한 건 | 확인 영역의 복구 완료. 뒤의 답변 화면 변경 후에도 해당 Browser 회귀 통과 |
| 공식 답변 초안 복구 | Lab e2b7482/a02c196. Node 399개/Lint와 집중 Browser 4개 통과. 실제 409/201/201/200, 새 답변 2건과 기존 Row 보존 | 빈 초안/GET과 미확인 제출 보존을 구분. 저장과 응답의 경계는 WIL에 정리 |
| 선택 뒤 새 고객 글 | Lab 6348974. 기존 재선택 실험 한 개를 강화해 201/확인 필요 true와 새 글의 빈 선택을 대조 | 운영 코드/Schema 변경 없음. 서버 교차 실행의 기존 근거와 순차 Browser를 구분 |
| 테스트 JVM 자원 정리 | Lab ce92236/38af3ce. 기본 통합 21개에 클래스별 Context 정리, 대표 3개 실제 자원 검사와 전체 Java 1,173+2 통과 | 이번 실행의 종료 경고/새 Dump/남은 소유 fork JVM 0. 운영 종료 검증과 구분 |
| 상태 변경과 재개 | T01~T08 합의 후 V13/Domain/저장/API/화면 구현. 전체 Java 1,221+2/Node 418건/Lint와 대표 Browser 3건 통과 | 재확인/참조/버전/Commit과 새 글/해결의 두 순서 문답 확인. 독립 구현/운영 배포/실사용 출시 완료로 확대하지 않음 |
| 현재 실행 안내와 증거 대조 | Lab docs/local-verification.md와 선택 Log/소스 대조. 사용자의 6절 직접 재현 두 건/exit 0 확인 | 7절의 Agent 보완은 전체 Maven 1,223+2와 마지막 Failsafe 두 건의 근거를 분리. 전체 Java를 마지막 부분 설정 뒤 다시 실행한 것으로 세지 않음 |
| 필수 여덟 사례/혼합 메시지 경합 | Lab fd879eb. 고객 먼저/공식 답변 먼저의 정확한 부모 잠금 대기와 Commit/페이지/기존 Row 보존. 집중 Java 28건 통과 | 두 사례는 신규, 26건은 재실행. 앞선 전체 Java/Node/Browser 결과와 합산하지 않음 |
| 11/3 문답 | 제출/재개 분리와 종류 충돌, 첫 답변 201/1건. 새 30/20 사례의 최대 범위/이력 보존 답변 확인 | 기록 ID/대상 ID와 배정 범위 설명 보완. 인계 후 범위 재확인 진행 |
| 11/4 문답 | 통합 사례와 실제 요청 구성, 마지막 change/current/GET 실패의 답변 및 작은 검사 직접 실행 완료 | 경고 해석과 다음 마감 범위로 연결. 독립 구현/주간 전체 완료로 판정하지 않음 |
| 주간 기록과 최종 회고 | 11/9 문답과 작성 완료. Commit 실패와 응답 유실을 구분하고 최초 접수 사례에 적용. 통합 블로그 작성과 포럼 등록 완료 | 파일럿 준비 |

학회 참석으로 진행하지 못한 학습과 구현을 이번 일정으로 이월한다. 10/27까지의 합의 기록은 [Week 11](../week11/README.md)에 보존한다. 기간이 지났다는 이유로 미구현 기능이나 과거 주간 마감을 완료 처리하지 않는다.

## 학습 자료와 진행 순서

1. [주간 계획](./weekly-plan.md)에서 7일 일정, 시간 배분과 완료 기준을 확인한다.
2. [고객 후속 정책 검토](../week11/customer-followup-policy-review.md)의 확정한 아홉 항목과 활동 시각 기준을 읽는다.
3. [기술 계약 초안](./customer-followup-contract-draft.md)의 Schema, API와 실패 사례를 확인하고 구현 뒤 실제 코드/Test와 대조한다.
4. [배정과 Commit 학습 자료](../week10/study-docs/ticket-assignment-and-commit-boundaries.md)는 권한/배정 버전의 복습에 필요한 부분만 재사용한다.
5. [11/3 학습 기록](./study-notes/2026-11-03-study-questions.md)에서 확인 범위와 HTTP 성공에 대한 실제 답변, 설명 보완과 남은 이해 점검을 확인한다.
6. [첫 저장 구현 보고서](./lab-reports/2026-11-03-customer-followup-storage.md)에서 26개 HTTP 사례와 Migration/전체 회귀 결과, 아직 실행하지 않은 Browser/Cloud 경계를 확인한다.
7. [목록과 고객 작성 화면 검증](./lab-reports/2026-11-03-my-tickets-and-followup-ui.md)에서 이후 실제 Browser/DB 대조와 목록 27개, 응답 유실/조회 복구와 남은 확인 기능을 구분한다.
8. [확인 지점과 배정 버전](./study-docs/confirmation-checkpoint-and-assignment.md)에서 확인 기록 ID/대상 Message ID, MAX와 인계 후 확인 범위를 단계적으로 구분한다.
9. [명시적 확인 API 검증](./lab-reports/2026-11-03-customer-message-confirmations.md)에서 V12/현재 담당자/배정 범위, 실제 동시성/Commit과 남은 직원 화면을 구분한다.
10. [문서·구현 전달](./lab-reports/2026-11-03-documentation-publication.md)에서 공개 검토, Push와 정확한 Commit의 CI 및 다음 회차를 확인한다.
11. [11/4 직원 업무 목록과 확인 화면](./lab-reports/2026-11-04-staff-confirmation-ui.md)에서 선택한 Message/배정 버전의 고정과 실제 Browser/DB 결과, 남은 검증을 확인한다.
12. [11/4 학습 기록](./study-notes/2026-11-04-study-questions.md)에서 현재 계약과 보편 원리를 구분해 달라는 요청, 실제 답변과 설계 대안의 설명을 확인한다.
13. [11/4 확인 응답 유실/조회 복구 실험](./lab-reports/2026-11-04-confirmation-recovery-browser.md)에서 실제 Commit 뒤 전달 차단과 GET만 재시도한 화면/DB 근거를 확인한다.
14. [11/4 인계/권한 회수 뒤 재확인](./lab-reports/2026-11-04-confirmation-authority-browser.md)에서 같은 UUID가 인가를 대체하지 않는 실제 Session/HTTP/DB 근거를 확인한다.
15. [11/4 배정 충돌 뒤 재선택](./lab-reports/2026-11-04-confirmation-reselection-ui.md)에서 정확한 오류 코드, GET만 하는 초기화와 새 선택/UUID의 실제 검증을 확인한다.
16. [11/4 공식 답변 초안 복구](./lab-reports/2026-11-04-reply-draft-review.md)에서 버전이 다른 초안의 명시적 새 작성, 미확인 정정의 보존과 Browser에서 발견한 후보 목록 유실의 수정을 확인한다.
17. [11/4 새 고객 글과 확인의 교차 흐름](./lab-reports/2026-11-04-confirmation-cross-flow.md)에서 선택 후 새 글의 도착을 재현한 Browser와 이미 있던 서버 잠금 검증, 상태의 기준 시점을 구분한다.
18. [테스트 통과와 JVM 종료](./study-docs/test-jvm-resource-lifecycle.md)에서 Context 캐시, 클래스별 DB와 연결 Pool의 수명 차이를 읽고 [실제 자원 정리 보고서](./lab-reports/2026-11-04-test-jvm-cleanup.md)의 실패/수정/전체 실행을 대조한다.
19. [상태 변경의 저장 순서](./study-docs/status-change-transaction-flow.md)에서 가상 예시와 실제 Service/화면을 구분하고, 기존 고객 글 참조/새 상태 이력 ID/두 버전/제출 UUID의 역할을 확인한다.
20. [상태 변경과 명시적 재개 검증](./lab-reports/2026-11-04-ticket-status.md)에서 실제 Commit 실패, 새 글/인계/권한 회수의 순서와 Browser 응답 유실/재확인, 최종 회귀 결과를 확인한다.
21. [현재 실행 안내와 검증 증거 대조](./lab-reports/2026-11-04-local-verification-audit.md)에서 별도 실행 대상과 가짜 AI 서버, 빈 Log/종료 코드 및 재현할 코드 기준을 구분한다.
22. [혼합 메시지 저장과 초기 AI 범위](./study-docs/status-change-transaction-flow.md#14-고객-글과-공식-답변을-함께-저장할-때)에서 새로 검증한 두 저장 순서를 읽고, 이어지는 사례의 최초 제안/후속 대화/명시적 재개를 구분한다.
23. [목록의 활동과 확인 필요](./study-docs/status-change-transaction-flow.md#16-최근-활동과-확인-필요를-구분해-목록-읽기)에서 두 목록의 계산 대상과 페이지 경계를 비교하고 처음부터 다시 조회해야 하는 경우를 확인한다.
24. [해결 검사부터 요청/화면까지](./study-docs/status-change-transaction-flow.md#17-확인-완료와-해결-결정의-경계)에서 canResolve/참조/인간 판단을 구분하고, 이어지는 18~19절의 실제 JSON 구성과 저장 결과/현재 화면을 연결한다.
25. [11/7 검증 근거 학습](./study-notes/2026-11-07-study-questions.md)에서 같은 Ticket의 저장 순서, 두 실패 경계와 접근 차단/기록 보존에 대한 실제 문답을 확인한다.
26. [11/8 재현 절차와 재확인 설계](./study-notes/2026-11-08-study-questions.md)에서 실행한 코드의 기준을 남기고 저장 이력과 상태 버전을 검사하는 순서를 확인한다.

11/3 전달에서는 Lab f325750의 원격 Java/JavaScript/Lint/Image 빌드가 통과했다. ECR 게시와 Cloud 실행은 없었으며 학습 저장소는 자동 CI가 없어 문서 검증과 원격 동기화를 별도로 확인한다.

매 회차 핵심 질문을 2~3개 묶어 예상과 이해를 확인한다. 고객 소유권과 직원 담당 권한, 응답 유실과 저장 실패, 조회와 명시적 확인의 차이에 집중한다. 기본 함수 문법과 이미 합의한 정책을 처음부터 반복하지 않는다.

11/3에는 F03의 주제 구분/원문 보존, F05의 Commit 직후 공개/역할 표시와 F12의 내 문의 목록 포함을 합의했다. 별도 직원 승인 대기 없이 기존 조회 범위를 유지하고, 고객은 실명/로그인 ID 대신 '고객/담당자'를 본다. 이어서 F13은 Ticket 단위의 일반 후속 글로 시작하고 특정 답변 인용은 후속으로 두기로 했다. 최근 활동은 마지막 공개 Message의 작성 시각이며 내부 인계/확인으로 갱신하지 않는다.

## 주간 기록과 후속 계획

11월 9일에는 Commit과 응답 유실의 차이를 최초 문의 접수에 적용했다. 같은 제출의 UUID와 입력을 유지하고, 동일 Ticket ID와 DB의 연결된 행을 대조하는 조건을 답했다. 계획 배분은 45분이며 실제 시간은 미기록이다. [11/9 학습 기록](./study-notes/2026-11-09-study-questions.md)

- [12주차 WIL](./wil.md)
- [12주 회고와 수료 후 4–8주 진행안](../plan/12-week-retrospective.md)

10–12주차 통합 블로그는 한 편으로 작성해 11월 9일 포럼에 등록했다. 전체 회고에는 기술 심화 공지의 12개 실습 분야에서 각각 공부한 범위를 주차별 근거와 연결했다.

수료 후에는 최초 접수 재확인부터 진행하고, 고객 계정 운영과 보관 및 삭제, 배포 후보는 Lab의 파일럿 출시 기준으로 확인한다. [Lab 로드맵](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/blob/main/docs/roadmap.md)
