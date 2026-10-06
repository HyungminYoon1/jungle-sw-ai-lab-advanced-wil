# AGENT의 AI 작업 상태·제안 읽기 전용 조회

> 실행일: 2026-10-06
> 상태: AGENT 조회 API와 새 Test 55개 검증 완료
> 전체 회귀: Java Clean Test 444개·JavaScript 104개 통과, ESLint 오류 0
> 이번 유료 AI 호출: 0회
> Lab 구현 Commit: `4c50fef` — `feat(ai): add agent-only read-only suggestion query`

## 목적과 범위

담당자가 작업 상태를 확인하는 GET과 Worker가 AI 작업을 실행하는 일을 분리했다. 읽기 요청은 새 Job·실행권·예약·Provider 호출을 만들지 않고, 정상적으로 조회한 AI 실패와 조회 자체의 오류를 구분한다.

사용자가 AGENT 전용 조회·고정 실패 코드 공개·정합성 오류의 안전한 500을 승인했다. Codex가 Controller·Application Service·조회 Port·JDBC Adapter·DTO·Security 규칙·오류 Handler와 Test를 작성하고 실행했다. 기존 Worker·결과 저장 Service·Migration은 변경하지 않았다.

직접 확인한 Lab의 README, Ticket 조회·접수·결과 저장 관련 Source, V2~V4 DDL, Security·오류 Handler·관련 Test와 이번 조회 파일은 `VERIFIED`다. WIL의 계약·관련 학습자료·Note·계획과 수정 구간도 확인했다. 두 저장소 전체는 이번 과업의 관련 범위를 선택한 `PARTIAL` 검토이며 전체 Source Audit은 아니다.

## 구현한 경계

```text
GET /api/tickets/{id}/ai-suggestion
  → Security: 익명 401 / USER 403 / AGENT 허용
  → AiSuggestionQueryController: HTTP 입력·응답 변환
  → AiSuggestionQueryService: 읽기 전용 Transaction·결과 정합성 검사
  → AiSuggestionQueryRepository Port
  → JDBC Adapter: 단일 Parameterized SELECT
  → PostgreSQL: Ticket → 최초 Message → Job → Suggestion·Categories
```

API의 Controller·Service·Adapter는 `postgres` Profile에서만 등록한다. 기존 In-memory 실험의 저장·생성 경로는 유지한다. Job이 가리키는 입력 Message를 읽으며 가장 작은 Message ID를 최초 Message로 선택한다. 후속 Message나 최근 Job으로 조회 대상을 바꾸지 않는다.

Spring은 GET Mapping으로 HEAD도 처리하므로, GET Method에만 AGENT 규칙을 적용하면 HEAD가 일반 인증 규칙으로 넘어갈 수 있다. 새 조회 URI의 업무 요청 전체에 AGENT를 요구하고 HEAD의 익명 401·USER 403·AGENT 읽기를 추가 검증한다. 허용된 CORS Preflight는 기존 CORS Filter가 먼저 처리하며 새 POST 실행 기능은 추가하지 않았다. [Spring의 HEAD Mapping](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-requestmapping.html)

응답의 최상위 Field는 `ticketId`·`job`·`suggestion`이다. Job은 `id`·`status`·`failureCode`, Suggestion은 `id`·`summary`·`categories`·`priority`·`reviewStatus`만 공개한다. 생성 예약·정책·원문·Provider 오류 전체·Prompt·Credential은 응답에 추가하지 않는다. 정상 응답은 `Cache-Control: no-store`다.

## 상태별 HTTP 계약

| 확인한 사실 | HTTP | 응답·Controller 경계 |
|---|---:|---|
| 익명 / USER | 401 / 403 | Controller·조회 Service 미진입 |
| ID Type 불일치·비양수 | 400 | DB 조회 미실행 |
| AGENT가 없는 Ticket 조회 | 404 | Controller 진입, 정상 null 응답과 구분 |
| 기존 Ticket에 최초 Message 또는 그 Job이 없음 | 200 | `job: null`·`suggestion: null`, 새 Row 생성 없음 |
| PENDING·RUNNING | 200 | 해당 Job·제안 없음. 이전 실패 코드는 최종 실패로 공개하지 않음 |
| FAILED | 200 | 해당 Job·허용된 고정 실패 코드·제안 없음 |
| ABSTAINED | 200 | 해당 Job 유지·제안 없음. 작업 미등록·실패와 구분 |
| SUCCEEDED | 200 | 제안·전체 Category·Priority·검토 상태 복원 |
| SUCCEEDED인데 제안 부재 / 분류 부재 등 | 500 | `AI_RESULT_INCONSISTENT`, 조회가 Job을 고치지 않음 |
| DB 읽기 예외 | 500 | `AI_RESULT_QUERY_FAILED`, 원문·Cause는 응답·Log에 복사하지 않음 |

FAILED의 200은 조회가 성공했다는 뜻이지 AI 작업이 성공했다는 뜻이 아니다. AI 요약은 공식 답변도 아니므로 고객에게 담당자 답변을 약속하는 기능은 추가하지 않았다.

## SQL·Transaction과 검증 근거

여러 SELECT를 Repeatable Read로 묶는 안과 단일 SELECT를 비교하고, 이번 HTTP 응답은 하나의 SELECT로 묶었다. PostgreSQL Read Committed의 일반 SELECT도 한 문장 안에서는 같은 Snapshot을 읽는다. `readOnly=true`만으로 여러 문장의 시점이 같아지는 것은 아니다. [PostgreSQL Transaction Isolation](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED)

기존 `ticket_messages.ticket_id` Index, Job의 입력 Message Unique, Suggestion의 Job Unique, Category의 복합 Primary Key가 참조 조회에 쓰일 수 있는 구조다. Index를 새로 만들거나 실행 계획의 성능 개선을 주장하지 않았다. 짧은 읽기 Transaction이며 Provider 대기·Row Lock은 없다. PostgreSQL 설계 스킬의 FK Index와 짧은 Transaction 지침을 반영했다.

새 Test 구성은 다음과 같다.

- `AiSuggestionQueryServiceTest` 20개: 비양수 ID, 없는 Ticket, DB 읽기 실패, 상태·제안의 모순, 알 수 없는 허용값·실패 코드와 분류 부재·중복을 Test Double로 검사했다.
- `AiSuggestionQueryHttpIntegrationTest` 34개: 실제 PostgreSQL·Spring Security·Form Login Session·MockMvc를 사용했다. 권한·다섯 상태·허용된 실패 코드·안전한 500·최초 Message의 고정된 조회를 확인했다.
- `AiSuggestionQueryProfileIntegrationTest` 1개: In-memory 실행에서는 조회 Controller·Service·JDBC Adapter가 없고 기존 저장소만 등록되는 것을 확인했다.

반복 조회 전후 `tickets`·`ticket_messages`·`ai_suggestion_jobs`·`ai_suggestion_attempts`·`ticket_suggestions`·`ticket_suggestion_categories`의 모든 Row 값을 비교했다. Provider·Claim·결과 저장 Service는 호출되지 않았다. 처리 기한이 지난 RUNNING도 조회가 FAILED로 변경하지 않았다.

다른 Connection의 결과 Transaction이 제안·분류·SUCCEEDED SQL을 실행하고 Commit 전 대기하는 동안, GET은 이전의 RUNNING·제안 없음을 읽었다. Writer가 Commit한 뒤 다시 조회하자 SUCCEEDED·전체 분류를 읽었다. Reader는 Writer의 Row Lock을 기다리지 않았다. 이는 실제 PostgreSQL의 Commit 가시성 검증이며 외부 AI를 대기시킨 실험은 아니다.

조회 안에서 Spring의 실제 Transaction·읽기 전용 표시와 PostgreSQL의 `SHOW transaction_read_only` 결과 `on`을 확인했다. DB 읽기 예외는 조회 Adapter에 Test용으로 주입했고, 그 원문을 응답·Log에 복사하지 않는지 검사했다. 실제 DB 연결 단절을 재현한 것은 아니다.

## 실행과 회귀

```powershell
.\mvnw.cmd "-Dtest=AiSuggestionQueryServiceTest,AiSuggestionQueryHttpIntegrationTest,AiSuggestionQueryProfileIntegrationTest" test
.\mvnw.cmd clean test
node --test 'src/test/js/*.test.mjs'
npx --yes --package eslint@10.11.0 eslint 'src/main/resources/static/*.mjs' 'src/test/js/*.mjs'
```

첫 선택 실행은 49개가 통과했다. 최초 Message에 Job이 없는 경우·읽기 전용 Transaction, HEAD의 권한과 미지원 POST 차단을 보강한 뒤 전체 Clean Test에서는 새 Test 55개를 포함한 Java 444개가 통과했다. Surefire XML 44개를 합산한 실패·오류·건너뜀은 모두 0이다. JavaScript 104개·ESLint도 통과했다.

변경 파일은 UTF-8 without BOM·LF를 유지했고 `git diff --check`와 상대 문서 링크 점검을 통과했다. 변경 Source·문서와 전체 Surefire XML에서 대표 API Key·BCrypt Encoding·기본 생성 Password 안내 Pattern은 0건이었다. 이 Pattern 점검을 모든 비밀값의 부재를 보장하는 전체 보안 Audit으로 해석하지 않는다.

## 남은 학습·검증

이번 근거는 Service Unit Test·실제 PostgreSQL·Security·MockMvc다. 실제 Browser가 새 조회 API로 제안을 표시하거나 유료 AI Worker가 자동으로 처리한 근거는 아니다. 다음은 명시적인 실제 AI Worker 연결·접수 201과 후속 결과 조회의 Browser 흐름, 안전한 Text 표시·수동 내용 평가·자료 없는 설명과 WIL이다.

관련 기록: [계약](../ai-suggestion-contract-draft.md), [신뢰 경계](../study-docs/ai-suggestion-trust-boundaries.md), [10월 6일 학습 노트](../study-notes/2026-10-06-study-questions.md), [주간 계획](../weekly-plan.md).
