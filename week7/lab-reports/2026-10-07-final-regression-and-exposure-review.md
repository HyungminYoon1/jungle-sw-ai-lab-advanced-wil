# Week 7 전체 회귀 테스트와 공개·Log 점검

> 검증일: 2026-10-07
> 상태: 전체 회귀 테스트·선정한 노출 점검 완료
> 새 실제 AI 호출: 0회

## 회귀 결과

처음에는 구현 Lab의 Source를 변경하지 않고 현재 Code를 다시 검증했다. Docker 실행 전에는 Integration Test를 제외한 Java Test를 실행했고, Docker 실행 후에는 PostgreSQL Test를 포함한 기본 전체 Suite를 실행했다. 이후 사용자의 요청으로 공격성 입력·응답의 통합 Test 12개를 추가하고 전체 Java Suite를 다시 실행했다. 운영 Source·Prompt·Migration은 그대로 유지했다.

| 검증 | 실행 | 결과 |
|---|---|---|
| Java 부분 회귀 | `mvnw.cmd "-Dtest=*Test,!*IntegrationTest" test` | 233개 통과 |
| 공격 사례 추가 전 Java 전체 회귀 | `mvnw.cmd test` | 449개 통과, 실패·오류·건너뜀 0개 |
| 공격 사례 집중 실행 | `mvnw.cmd "-Dtest=AiSuggestionInjectionBoundaryIntegrationTest" test` | 신규 12개 통과, 실패·오류·건너뜀 0개 |
| 공격 사례 추가 후 Java 전체 회귀 | `mvnw.cmd test` | 461개 통과, 실패·오류·건너뜀 0개, BUILD SUCCESS |
| JavaScript 전체 회귀 | `node --test src/test/js/*.test.mjs`에 해당하는 9개 파일을 명시해서 실행 | 145개 통과, 실패·취소·건너뜀 0개 |
| ESLint | ESLint 10.11.0으로 Static UI·JavaScript Test·Week 7 Script 22개 검사 | 종료 코드 0 |

Java 전체 회귀는 실제 PostgreSQL Testcontainer를 사용한다. Provider 경계 Test는 통제된 로컬 HTTP 응답을 사용하며, 실제 OpenAI 호출 Experiment는 기본 Suite에 포함하지 않는다. Test 실행 Process에 API Key와 Live 승인 변수를 전달하지 않았고, 원문 Log 대신 결과 집계만 확인했다.

이번 실행은 `clean test`가 아닌 `test`다. 기존 Live Experiment의 산출물을 삭제하지 않았다. 실제 AI·Browser·Worker 연결은 기존 [10월 6일 실험](./2026-10-06-worker-browser-experiment-lab.md), 이번 전체 회귀는 현재 Code의 Test 결과로 구분한다. 새 [공격 사례 통합 검증](./2026-10-07-ai-injection-boundary-integration-lab.md)은 실제 Java·PostgreSQL에 합성 HTTP 응답을 연결했다. JavaScript·ESLint와 아래 공개·Log 점검은 신규 Java Test를 추가하기 전 확인한 범위다.

## 공개 대상 파일 점검

Git이 추적하거나 Ignore하지 않은 Text 파일을 대상으로 선택한 비밀값 패턴을 검사했다. WIL 143개·Lab 175개 파일에서 OpenAI Key·GitHub Token·AWS Access Key 형태와 Private Key Block이 발견되지 않았다. `.env` 내용과 환경 변수 값은 읽거나 출력하지 않았다. Git 제외 경로 전체를 검사한 결과는 아니다.

WIL의 로컬 경로 검사에서는 과거 Shell Prompt 예시의 자리표시자 한 곳만 검출됐다. 실제 사용자 디렉터리를 적은 경로가 아니며, 이번 변경 문서에는 로컬 절대 경로가 없다. `local/blog/wil`·`local/ai-experiments`·`local/codex`의 Ignore도 확인했다.

## Log 처리와 실행 근거

Main·Script의 Java·JavaScript 98개 파일에서 Log 호출 위치를 찾았다. 전체 Source 정밀 Review와는 구분하며, 다음 경계를 직접 확인했다.

- `AiSuggestionWorkerScheduler`: 오류 메시지·Cause 대신 고정 코드만 기록한다. Test는 Log Event의 내용과 Throwable 부재를 확인한다.
- `TicketApiExceptionHandler`: 접수 실패와 조회 실패의 응답·Log에 고정 코드나 예외 종류만 남긴다. 실패한 Message Row의 본문과 조회 예외의 합성 Marker가 나오지 않는 Test를 전체 회귀에 포함했다.
- `HandlerTimingInterceptor`: Handler·Status·경과 시간만 기록하며 Body·Cookie·CSRF Token을 기록하지 않는다.
- 독립 Node 실행기: CLI의 출력·오류 경로와 `safeReportJson`의 전달된 Key 치환을 확인했다. 기존 Pilot·비교 실행기는 전용 PowerShell 확인에 의존하고, Java·Worker Live 실행기는 Helpdesk 전용 변수도 요구한다. 이번에는 어느 Live 실행기도 실행하지 않았다.
- Provider 경계: 거부 응답과 잘못된 응답 Envelope가 원문 Prompt·오류 메시지를 Log에 복사하지 않는 Test를 확인했다.

선택한 Pattern 검사와 합성 Marker Test는 서로 다른 근거다. 이 점검은 명시한 출력 경계에 대한 확인이며, 모든 종류의 개인정보 탐지나 운영 환경 전체 보안 검토를 대신하지 않는다.

## Source 확인 범위

| Source | 확인 수준 | 범위 |
|---|---|---|
| Lab `README.md`·`pom.xml` | VERIFIED | 실행 계약·의존성·무료/Live 실행 분리 |
| 양쪽 저장소의 Git 상태·줄바꿈 설정 | VERIFIED | 사용자 변경 보존, 초기 점검 때 Lab 변경 없음, 이후 Test·README만 추가·수정, LF 유지 |
| 세 Main Log 처리 파일·Scheduler Test | VERIFIED | 파일 전체 확인 |
| 접수·조회·Provider 경계 Test와 6개 Node CLI | PARTIAL | 관련 Assertion·출력·오류 경로를 선택 확인 |
| Git 공개 대상 Text 파일 | PARTIAL | 선택한 Pattern 자동 검사이며 파일 전체 의미 검토는 아님 |
| Git 제외 원장·Blog·실행 산출물 전체 | NOT_INSPECTED | 이번 전체 검사 범위에서 제외. 기존 실험 근거와 별도 취급 |

## 문서와 Git

이번 평가 Report·학습노트·주간 계획의 UTF-8 without BOM·LF, 상대 링크와 로컬 절대 경로 부재를 확인했다. `git diff --check`도 통과했다. Lab은 공격 사례 Test·README만 변경했고, WIL의 기존 변경을 보존한 채 이번 문답과 검증 근거를 추가했다. 이 검증 시점에는 Commit·Push·외부 게시·Project 상태 변경을 하지 않았다.

검증 이후 [Week 7 WIL](../wil.md)을 작성하고 작성자가 표현과 내용을 검토했다. 10/7 블로그 게시·포럼 등록 완료를 작성자에게 확인했다. 주간 계획에는 10/5 회차 이후 추가한 2일과 실제 마감일 10/7을 반영했다.
