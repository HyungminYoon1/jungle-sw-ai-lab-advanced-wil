# 실행 안내와 로컬 검증 근거 대조

> 기준일: 2026-11-04
> 범위: 현재 V13의 선택한 실행 절차/소스/기존 로그 대조, ESLint 재검증, 혼합 저장 집중 28건과 학습용 재현 명령 선택 2건
> 구분: 기존 감사, 이후 집중 Java 28건과 재현 명령 선택 2건을 구분한다. 기본 전체 Java/Node/Browser 재실행이나 Push/CI/Cloud/상용 AI 실행은 없음

## 확인한 문제와 정리

상태 기능의 통합 문답 뒤, 주간 계획의 실행 안내/검증 근거 대조로 진행했다. 같은 테스트를 반복해 날짜별 과업을 채우지 않고 기존 명령/결과/한계를 먼저 확인했다.

Lab README의 과거 주차별 실행 명령과 결과는 역사 기록으로 남기고, 현재 절차를 docs/local-verification.md로 모았다. Java/Spring/PostgreSQL, Node, ESLint와 별도 Browser 세 건을 분리했다. 현재 기본 회귀는 Maven verify이며 POM에 연결한 패키징 후 검사까지 포함한다. Maven test만으로 그 두 건까지 실행한 것으로 기록하지 않는다.

Week 12 Browser는 각 실험의 임의 App Port와 격리된 Testcontainers DB를 사용한다. 예전 Week 6의 고정 Port E2E 실행법과 섞지 않는다. 실제 계정/AI Key를 넣는 수동 앱 실행과도 다른 경로다. 새 가이드는 기존 Script/계층/권한/DB 계약을 바꾸지 않는다.

주간 계획 상단의 오래된 1,173+2/Node 399 요약은 본문의 최신 1,221+2/Node 418 근거에 맞춰 갱신했다. 과거 실행 기록 자체를 최신 실행처럼 바꾸지는 않았다.

## 실행별 증거와 한계

| 실행 | 이번에 대조한 근거 | 판정 범위 |
|---|---|---|
| 앞선 Maven verify | target/week12-status-verify.log의 Surefire 1,221/Failsafe 2, 실패/오류/Skip 0와 BUILD SUCCESS | 기본 Java/실제 PostgreSQL/패키징 검사. 별도 Browser와 실제 상용 AI/Cloud의 성공은 아님 |
| 앞선 Node test | target/week12-status-node-all.log의 418/통과 418/실패·취소·Skip 0 | JS 상태 처리/도구의 통제된 사례. DB Commit의 직접 증거와 구분 |
| 상태 Browser | target/week12-status-browser.log의 한 건/BUILD SUCCESS와 실제 POST 201/409/201/200/201/201, 상태 이력 6건 | 실제 로컬 Browser/Spring/DB. Provider 상호작용 0 |
| 답변 초안/확인 재선택 Browser | target/week12-status-browser-regression.log의 두 건/BUILD SUCCESS와 각 고정 결과 | 기존 화면의 관련 두 흐름. 다른 과거 실험 전체를 재실행한 결과는 아님 |
| ESLint 재검증 | 아래 result.json의 종료 코드 0/코드 기준/시각과 0 Byte 로그 | 해당 고정 Lint 규칙 통과. 업무/DB/모델 정확도 보장은 아님 |

위 실행 수는 중복 합산하지 않는다. 집중 Java 검사는 기본 전체에 포함하고, Browser 세 건은 별도다. Log/XML의 존재나 전체 파일 수만으로 이번 명령의 실행 수를 계산하지 않는다. 남아 있는 이전 XML도 섞일 수 있기 때문이다.

전체 Java를 실행한 코드 기준은 Lab af92b61이며, 현재 감사 시작점 1eca282와의 Git Diff는 README.md/docs/ticket-status.md 두 문서뿐임을 확인했다. 새로 전체 Java를 돌렸다는 뜻은 아니다. 이 대조와 Commit 정보는 코드 범위를 설명하는 근거이며 독립적인 서명/원격 CI 증명은 아니다.

## 실제 HTTP와 실제 AI의 구분

SyntheticDeploymentPrivacyPackagedIT 전체를 읽고 POM의 Failsafe 연결과 대조했다. 합성 검사 자식 프로그램은 실제 JAR에서 실행하고, Adapter가 보내는 HTTP도 실제다. 다만 응답 서버는 테스트에서 연 127.0.0.1의 가짜 서버다. 정상 사례의 Provider/HTTP 카운터 1을 상용 AI 요청 성공 1회라고 기록하면 안 된다. 반환 Model 문자열도 가짜 응답의 일부다.

이 증거는 패키징된 검사 프로그램/전처리/Adapter/DB 연결과 허용 범위 밖 입력의 외부 전송 거부를 검증한다. 실제 모델의 개인정보 탐지 정확도나 요약 품질은 별도 평가 대상이다. 상용 AI를 사용했던 과거 실험을 이번에 재실행한 것도 아니다.

## 빈 Lint 로그를 보완한 실행

기존 target/week12-status-eslint.log는 0 Byte였다. 앞선 명령의 성공 기록이 있어도 빈 파일 자체만으로 실행 여부/성공을 입증할 수는 없다. 그래서 기존 Java/Node/Browser를 반복하지 않고 ESLint만 한 번 실행했다.

- 실행 기준: Lab 1eca282fc5b80faa7dce78413e79562ba629c71a, 시작 시 작업 트리 Clean
- 명령: npx.cmd --yes --package eslint@10.11.0 eslint src/main/resources/static/*.mjs src/test/js/*.mjs
- 결과: exitCode=0, passed=true, 로그 0 Byte
- 메타데이터: Lab의 target/verification-audit-20261104-dcfd36ca/result.json
- 함께 기록한 값: 명령/Commit/작업 트리 상태/시작·종료 UTC 시각/종료 코드/로그 크기

환경변수 값/목록, 개인 암호, Cookie/CSRF/API Key는 기록하지 않았다. target은 Git에서 제외한 로컬 생성물이며 clean 시 사라진다. 공개 기록에는 결과/조건/한계를 정리하고 필요한 실행 증거는 별도로 보존한다. 이 시점의 신규 검증은 Lint 한 번이며 기존 418개나 1,221+2개를 다시 수행한 것으로 세지 않는다. 이후 추가한 집중 Java 실행은 문서 아래에 별도로 기록한다.

작성한 문서는 변경 Markdown 8개를 대상으로 UTF-8/BOM 없음/LF, 코드 펜스, 상대 링크 193개와 앵커 19개를 검사했다. PowerShell 예제 5개도 구문 오류 0건을 확인했다. 이는 문서/구문 검사이며 예제의 Java/Node/Browser 명령을 이번에 실행했다는 뜻은 아니다.

## 소스 확인 범위

| 대상 | 범위 |
|---|---|
| Lab docs/ticket-status.md와 새 docs/local-verification.md | VERIFIED. 현재 계약/절차/한계 전체 |
| SyntheticDeploymentPrivacyPackagedIT | VERIFIED. 두 사례와 JAR/HTTP/DB/정리 흐름 전체. 비밀값은 가이드에 옮기지 않음 |
| POM/README | PARTIAL. Java 기준, Failsafe 설정과 현재/과거 실행 요구사항 절을 선택. README 전체 최신화가 아님 |
| Browser 세 클래스/Script | PARTIAL. 대상/ProcessBuilder/PowerShell 경로/격리 DB/Provider 검증과 기존 기록 연결. 이번 감사에서 실험 전체를 다시 실행하지 않음 |
| 기존 Log/Report | PARTIAL. 성공·개수·고정 증거 줄만 선택해 대조. Raw Log 전체 검토/재실행과 구분 |
| 이후 필수 사례 대조 | PARTIAL. 아래 표의 업무 Service/Query/화면과 검증 메서드를 선택해 확인. 새 혼합 저장 메서드/Helper와 변경 Diff는 전체 검토하고 해당 집중 클래스 28건 실행 |
| AWS/상용 AI/CI/과거 모든 Browser 실험 | NOT_INSPECTED. 이번 감사 범위 밖 |

## 다음 학습과 마감

새 글이 먼저 Commit된 경우의 선택 대상/최신 글/명시적 확인 검사, 해결이 먼저 Commit된 경우의 RESOLVED 유지/새 글 확인 필요에 사용자가 정확히 답했다. [학습 기록](../study-notes/2026-11-04-study-questions.md)에 답변을 남겼으며 모든 구현을 혼자 재현했다고 판정하지 않는다.

두 문항에서 사용자는 상용 AI 품질과 빈 Log만으로 통과를 주장하지 않는 판단은 했다. 다만 로컬 HTTP를 외부 HTTPS로 해석했고 추가로 필요한 기록은 모르겠다고 답했다. 요청 주소/수신 카운터와 실제 exitCode=0/logBytes=0 메타데이터로 보충했다. Lab 가이드 5절에 프로토콜/목적지와 프로그램 출력/실행 결과 기록의 구분을 추가했다. 실제 답변은 학습 기록에 보존하며 이해 완료로 확대하지 않는다. 이 설명을 위한 새 실행은 없다.

보충 뒤 사용자는 로컬 가짜 서버의 HTTP 요청임을 정확히 답했고, 메타데이터가 있는 빈 출력은 Lint 통과로 판단하되 DB 원문 보존은 별도 통합 검사라고 구분했다. 이번 두 사례의 이해 점검 결과이며 새 테스트 실행으로 기록하지 않는다.

남은 마감 산출물은 주간 WIL, 12주 회고, 10~12주 통합 블로그 초안과 다음 단계 계획이다. 제한 Pilot의 출시 조건은 후속으로 유지하고 새 기능/인프라를 이번 감사의 선행 조건으로 늘리지 않는다. 실제 학습 시간은 미기록이며 기존 주간 기준을 초기화하지 않는다.

주간 WIL/12주 회고 작성은 기존 계획의 11/9 일정을 유지한다. 그전에는 학습노트/실험보고서에 실제 진행을 누적하고 별도 WIL 초안을 앞당겨 만들지 않는다. 기능 검증이 선행 완료됐다고 주간 학습 전체를 조기 마감하지 않는다.

## 주간 필수 사례와 현재 소스 대조

이후 사용자가 오늘 남은 범위를 설명하고 계획대로 진행하도록 요청했다. 주간 계획의 필수 여덟 사례를 현재 소스와 연결했다. 아래 클래스명과 메서드는 Lab 저장소 기준이며, 소스 대조와 테스트 실행은 구분한다. 각 클래스 전체를 새로 실행한 것은 아니다.

| 계획의 사례 | 선택한 구현/검증 근거 | 대조 결과 |
|---|---|---|
| 1 본인 소유권/추가 필드 거부 | TicketCustomerFollowupHttpIntegrationTest의 owner_identity_and_csrf_are_required_even_for_staff / invalid_payloads_are_rejected_before_storage | 비등록자 직원도 고객 소유권을 대신하지 못하며 잘못된 입력은 저장하지 않음 |
| 2 새 저장/재확인/종류 충돌 | 같은 클래스의 exact_replay_is_200_changed_body_is_409_and_new_uuid_is_a_new_submission / shared_uuid_rejects_different_message_kinds_in_both_directions | 201/200/409와 추가 Row의 의미를 구분 |
| 3 고객 글/공식 답변 경합과 실패 보존 | 같은 클래스의 새 customer_and_official_reply_commit_in_parent_lock_order_without_skipping_a_page, 기존 failure_after_insert_preserves_existing_reply_assignment_and_nonempty_ai_result / actual_deferred_commit_failure_never_returns_201_or_erases_prior_rows | 두 종류의 직접 경합 사례가 없던 공백을 보완. 두 순서의 잠금/Commit/페이지 및 기존 데이터 보존 검사 통과 |
| 4 결과 미확인/조회 복구/늦은 응답 | conversation-ui.test.mjs의 unknown customer submission / saved customer submission with a failed refresh / latest read wins / late POST result 사례와 기존 응답 유실 Browser 보고서 | JS의 제출/화면 판단과 별도 실제 Browser/DB 근거를 구분 |
| 5 최초 문의 AI 범위 | follow-up HTTP의 상태별 원문/Job 대조, JdbcAiSuggestionQueryRepository의 INQUIRY 선택, ai-suggestions.html의 최초 문의 안내 | 후속 글로 새 AI 작업을 만들거나 초기 제안을 최신 대화의 평가로 표시하지 않음 |
| 6 확인 권한/버전/같은 Ticket/MAX | CustomerMessageConfirmationHttpIntegrationTest의 only_current_assignee_can_create_a_confirmation_and_version_is_not_automatically_updated / later_lower_confirmation_is_retained_but_progress_uses_customer_message_max_not_audit_id 및 읽기 전용 GET 사례 | 현재 배정의 명시적 확인과 누적 이력을 구분 |
| 7 새 글/인계/해결 상태의 발견 | 같은 클래스의 handoff_and_a_to_b_to_a_never_copy_old_progress_but_old_submission_replay_is_separate, AssignmentQueueConfirmationHttpIntegrationTest의 latest_customer_uses_message_id_and_excludes_later_official_replies_even_on_resolved_tickets | 과거 확인을 새 배정으로 복사하지 않고 RESOLVED의 새 고객 글도 확인 필요로 조회 |
| 8 내 목록/공개 활동/가변 Cursor | MyTicketsHttpIntegrationTest의 identity_scopes_get_and_head_and_does_not_expose_internal_data / last_public_message_id_defines_activity_not_max_timestamp_or_ticket_update / a_moved_ticket_requires_refresh_and_a_foreign_cursor_never_grants_ownership | 본인 범위와 공개 대화 기준 활동, 맨 앞으로 이동한 항목의 새로고침 필요를 구분 |

AI 조회의 실제 Controller는 ScopedTicketQueryService를 거쳐 현재 직원 권한을 검사한 뒤 내부 조회를 호출한다. 내부 AiSuggestionQueryService에 Actor 인자가 없다는 사실만으로 HTTP 경로의 인가가 없다고 판단하지 않는다. 기존 !postgres 전용 Controller도 PostgreSQL 실행 경로와 구분했다.

## 혼합 저장의 새 집중 실행

같은 종류의 동일 UUID 경합 검사와 고객 글/확인 경합은 있었지만, 고객 후속 글과 공식 답변의 직접 경합은 필수 사례에 비해 부족했다. 업무 구현의 결함을 확인한 것은 아니며 이미 있는 부모 Ticket 잠금 계약을 직접 검사하도록 보완했다.

첫 저장의 실제 Service가 테스트 소유 Transaction에 참여해 INSERT 뒤 Commit 전에 기다린다. 다른 종류의 두 번째 저장을 시작하고 정확한 두 PostgreSQL Backend PID의 차단 관계와 tickets FOR UPDATE 대기를 관찰한다. 두 번째 Repository INSERT는 아직 호출되지 않아야 한다. 단순 Sleep이나 INSERT 중 외래 키 대기만으로 이 조건을 통과시키지 않는다.

고객 먼저/직원 먼저 두 사례에서 앞선 Commit 뒤 다음 Message ID와 페이지 연결을 확인했다. 2건 제한은 페이지 경계를 만들기 위한 테스트 값이며 실제 화면이 대화를 2건으로 제한한다는 뜻이 아니다. 최초 원문 Row 전체와 기존 Ticket/배정/AI Row를 대조하고 Provider 상호작용 0회를 검사했다.

- 실행: mvnw.cmd -B -ntp -Dtest=TicketCustomerFollowupHttpIntegrationTest test
- 결과: 28건, 실패/오류/Skip 0, exitCode 0, BUILD SUCCESS. 신규 두 사례와 기존 26건의 재실행이다.
- 실행 기준: Lab dcf897d 위 테스트 수정본의 SHA-256을 메타데이터에 보존. 테스트와 설명은 Lab fd879eb로 Commit했다.
- 근거: target/week12-followup-reply-order.log / target/week12-followup-reply-order-result.json / 당시 Surefire XML. 이후 선택 실행 전에 XML을 아래 previous-class-report.xml로 보존했다. 이 28건 실행 이후 새 Dump와 남은 프로젝트 소유 fork JVM은 0이었다.
- 한계: 실제 로컬 PostgreSQL/Service/Repository 검사다. 새 실제 Browser/HTTP 응답 경합 실험이나 전체 Java/Node/Lint/CI 실행은 아니다. 앞선 전체 1,221+2와 이번 28을 합산하지 않는다.

선택한 필수 사례 대조와 이번 보완 뒤 추가 업무 코드/Schema 변경이 필요한 누락은 확인하지 못했다. 이후 두 저장 순서와 최초 AI 제안/현재 대화/확인/명시적 재개, 실제 요청과 화면의 통합 문답으로 연결했다. 사용자의 실제 답변과 해당 사례의 이해 점검은 학습노트에 기록했으며 새로운 실행 근거와 구분한다.

## 학습자 직접 재현을 위한 선택 명령 확인

이후 정한 통합 문답을 마치고 실행 안내의 작은 재현 대상으로 연결했다. 처음 안내하는 메서드 선택 인자가 두 파라미터 사례만 실행하는지 확인하기 위해 Lab의 TicketCustomerFollowupHttpIntegrationTest#customer_and_official_reply_commit_in_parent_lock_order_without_skipping_a_page를 선택해 Maven test를 실행했다. 같은 기존 두 사례의 참고 실행이며 새 검증 사례 두 건을 추가한 것이 아니다.

Lab fd879eb6758750afad6879e4c3a88094baa95b40의 Clean 작업 트리에서 2건/실패·오류·Skip 0, BUILD SUCCESS/exit 0을 확인했다. 새 Dump와 남은 소유 fork JVM은 0이었다. 명령/Commit/시각/종료 코드와 로그는 Lab target/week12-focused-reproduction-20261104의 result.json/maven.log에, 이번 XML은 focused-report.xml에 있다. 덮어쓰기 전 28건 XML은 previous-class-report.xml로 별도 보존했다.

Lab f226b53은 docs/local-verification.md 6절의 실행 순서/명령/예상 범위/로그 경로를 추가한 문서 Commit이다. PowerShell 예제 여섯 개의 구문 오류 0건과 UTF-8/BOM 없음/LF/링크/Diff를 검사했다. 실제 참고 실행은 Maven 선택 인자를 검증했고, 안내의 Tee-Object 파이프는 구문 점검과 구분했다.

학습자의 독립 실행은 아직 확인하지 않았다. 이후 학습자가 마지막 요약과 종료 코드를 확인하면 그 실제 결과를 학습노트에 기록한다. 앞선 전체 회귀/28건과 이번 2건은 중복 실행이므로 합산하지 않는다. 업무 코드/Schema/정책 변경, 전체 회귀나 Browser/CI/Cloud/상용 AI 실행은 없다.
