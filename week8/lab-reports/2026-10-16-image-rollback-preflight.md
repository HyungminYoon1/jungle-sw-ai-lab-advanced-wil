# Image Rollback 사전 호환성 점검

> 실행일: 2026-10-16 KST
> 상태: Source 비교·고정 Source Enum 확인, 별도 P의 로컬 PostgreSQL V7/V8·Spring·MockMvc·UI·JAR와 Docker Image 실행 검증 완료. 이후 P 전체 원격 CI·ECR 업로드도 완료했으며 별도 보고서에 연결. Cloud Image Rollback은 NOT_RUN

## 점검 기준

직전 Cloud 검증의 프로그램은 Source `2e2cc403f73972d5c0f87ab81342b776e7777f6b`, Image Digest `sha256:1ec1ed5b0a4853b87fac7d1ded3937cf961be19f3d6e010608019e7b55cae39b`다. 사전 점검 당시 Lab HEAD `127d1f6`과 비교했으며, 당시의 미커밋 복원 자료는 유지했다. Source 비교 중 AWS 리소스나 운영 데이터를 변경하지 않았다.

10/10 Image는 현재 RDS CA 파일과 배포 사용자 Configuration이 없으므로 현재 명세의 직접 복귀 대상으로 선택하지 않는다. 이번 점검은 그보다 뒤의 실제 Cloud 기준 Image와 후속 Source 사이에 남은 위험을 확인한다.

## 새 실패 코드가 만드는 비호환 경로

다음 Source를 대조했다.

- 고정 Commit의 `AiJobFailureCode.java`: 개인정보 검사 실패 두 코드가 없음
- 고정 Commit의 `AiSuggestionQueryService.java`: FAILED의 실패 문자열을 `AiJobFailureCode.valueOf`로 변환하며 알 수 없는 값은 `AI_RESULT_INCONSISTENT`로 처리
- 현재 `V8__allow_privacy_scan_failures.sql`: 기존 코드에 더해 `PRIVACY_SCAN_TIMEOUT`·`PRIVACY_SCAN_INVALID_RESULT` 저장을 허용
- 현재 Java Enum과 `ai-suggestion-ui.mjs`: 위 두 코드를 추가로 허용

따라서 후속 프로그램이 새 실패 코드를 저장하면, Row가 보존돼도 원래 Cloud 프로그램의 AI 상태 조회는 그 값을 해석하지 못할 수 있다. 단순히 Table·Column을 삭제하지 않았다는 이유로 전체 읽기 호환성을 승인할 수 없다. 일반 Ticket 조회와 해당 AI 상태 조회의 실패도 구분한다.

## 실행한 소규모 확인

Git에서 고정 Commit의 실제 Enum Source를 읽고 package 선언만 제외해 JShell에 전달했다. 환경 변수·API Key·DB Password를 읽지 않았고 파일이나 DB를 수정하지 않았다.

| 변환할 값 | 실제 결과 |
|---|---|
| PROVIDER_REFUSED | Enum 변환 성공 |
| PRIVACY_SCAN_TIMEOUT | IllegalArgumentException·변환 거부 |
| PRIVACY_SCAN_INVALID_RESULT | IllegalArgumentException·변환 거부 |

이 확인은 이전 Enum이 새 값을 해석하지 못한다는 근거다. 전체 이전 JAR·Image의 기동, Flyway의 V8 이력 처리나 HTTP Status를 실제로 재현한 Test가 아니다. 기존 704개 Java·246개 JavaScript 회귀를 이번 점검에서 다시 실행하지 않았다.

## 후속 제안과 검증 경계

기존 A → 읽기 준비 P → 새 값 저장 B 순서를 제안한다. P는 기존 Source를 기준으로 새 두 실패 코드의 서버·Browser 읽기만 준비하고, 새 검사 실패를 기록하는 처리 기능과 V8 적용은 아직 활성화하지 않는 버전이다. P가 실제 후속 Schema·데이터를 읽는지 먼저 검증한 다음 B에서 P로 돌아오는 실험을 준비한다.

이는 [Amazon의 Prepare·Activate 배포 원칙](https://aws.amazon.com/builders-library/ensuring-rollback-safety-during-deployments/)을 이 프로젝트의 단일 App에 적용하는 제안이다. 다중 서버·무중단 배포를 추가하거나 DB의 실패 사유를 바꾸는 안은 아니다. 이후 작성자가 P로 복귀해야 하는 이유와 실패 사유를 임의 변경하면 안 되는 이유를 답했고, P의 로컬 PostgreSQL 검증을 승인했다. 아래 결과는 그 승인 범위다. Commit·Push·ECR 업로드·Task 교체는 실행하지 않았다.

로컬 검증은 원본 Cloud DB가 아닌 PostgreSQL에서 V7 → V8 이후 새 실패 값을 저장하고, P의 기동·Migration 검증·기존 문의·AI 상태 조회·UI 계약을 확인하도록 계획했다. 아래에 실제 결과를 기록한다. 이 결과만으로 복귀 가능한 Cloud Image까지 확보했다고 기록하지 않는다. 실제 Cloud 전환은 Image·명세·AI 비활성·단일 Task·Draining·기존 DB/보안 조건과 승인 범위를 확인한 뒤 진행한다.

## 준비 버전 P의 로컬 결과

기준 `2e2cc40`에서 `codex/week8-rollback-prepare` Branch의 별도 Worktree를 만들었다. 기존 Lab main과 미커밋 복원 자료는 유지했다. 운영 변경은 Java Enum·UI의 새 두 코드 읽기뿐이다. Dockerfile·POM·운영 Migration V1~V7은 기준 Commit과 같으며, V8은 Test 전용 경로에만 복사했다. Fixture SHA-256은 후속 Source의 실제 V8과 일치했다.

검증 DB는 기존 Test 기준과 같은 PostgreSQL 17.6-alpine이며 RDS의 17.11·TLS 환경을 그대로 복제한 것은 아니다. 별도 일반 App 계정의 비Superuser·DB/Role 생성·Replication·RLS 우회 권한 없음과 최대 두 Connection의 App Pool을 사용했다. 최초 계정 준비 실패는 Bootstrap Superuser 자체를 강등하려던 문제였고, 초기 관리자가 일반 계정을 따로 생성하도록 고쳐 재실행했다. 실제 Password 값은 출력하지 않았다.

| 단계 | 실제 결과 |
|---|---|
| P의 V7 기동 | postgres,deployment·실제 Repository/Security·Migration 일곱 개 |
| V7의 새 코드 쓰기 | 두 코드 모두 DB Constraint 위반으로 거부 |
| V8 Fixture 적용 | 기존 여섯 Table 내용 Hash·V1~V7 Checksum/성공 이력 유지 |
| P의 V8 재기동 | 새 Spring Context·다른 Repository 객체·Flyway Validate 통과, 이력 변경 없음 |
| 새 두 실패 조회 | 각각 HTTP 200·Job FAILED·원래 failureCode·suggestion=null |
| 기존 데이터 | 다섯 Ticket/Message/Job, 원문·작성자·OPEN과 대기/기존 실패/성공 제안 보존 |
| 예약·제안 | Attempt 네 건·Suggestion 한 건·Category 두 건, 조회 전후 여섯 Table 내용 Hash 일치 |
| 신규 접수 | 여섯 번째 문의 201·PENDING·실행/생성 예약 0, Identity 충돌 없음 |
| 보안·자동 처리 | 익명 401·USER 조회 403·CSRF 없는 POST 403 유지. Provider·Worker·Scheduler Bean 없음 |
| UI | 새 두 코드 표시·이전 제안 제거, 알 수 없는 코드·추가 필드 거부 |

V8 DB 연결 때 P의 최신 파일이 V7이라는 Flyway 경고는 남았다. 기본 `*:future` 처리 아래 기동·검증이 통과했으며 검증을 끄거나 Ignore 규칙을 새로 넣지 않았다. 이는 모든 미래 Migration을 검증했다는 뜻이 아니다. 실제 확인한 V8·Row·API 계약과 P가 가진 V1~V7의 검증으로 범위를 한정한다. V8 파일의 일치는 별도 Fixture Hash로 확인했다. [Flyway 기본 설정](https://documentation.red-gate.com/fd/flyway-ignore-migration-patterns-setting-277579002.html)

관련 Java 56개·P Branch의 JavaScript 전체 177개가 실패·오류·건너뜀 없이 통과했고 ESLint도 통과했다. Maven verify로 포장한 JAR에는 운영 Migration 일곱 개만 있으며 Test Fixture는 없다. 수정한 두 산출물의 Hash도 검증한 target/classes와 일치했다. 원래 main의 전체 회귀 704/246 결과와 구분한다.

이 절의 실험은 같은 JVM의 두 Spring Context와 실제 PostgreSQL, MockMvc HTTP·JavaScript Unit Test다. 이후 Docker에서 수행한 실제 Process 실행은 아래에 따로 기록한다. 새 실패 Row는 합성 SQL Fixture이며 AI 개인정보 탐지·후속 B App·RDS·Cloud Image Rollback은 실행하지 않았다.

## P Docker Image 빌드와 로컬 HTTP 검증

AWS 리소스를 변경하지 않는 범위로 P Worktree에서 Image를 Build하고 로컬 실행을 검증했다. 운영 변경은 여전히 Enum·UI 두 파일이며 Dockerfile·POM·V1~V7은 기준 Source와 같다. 이 로컬 Build 당시 P 변경은 미커밋 상태였으므로 기준 Commit만으로 완성된 Image라고 표시하지 않는다. 이후 두 Commit으로 기록하고 원격 전달한 결과는 아래 별도 보고서에 연결한다.

| 항목 | 확인 결과 |
|---|---|
| Image Tag | `helpdesk:week8-rollback-prepare-20261016-local1` |
| 로컬 Image ID | `sha256:18d2ed349fc1e5f0ea65d625ab9c582df7859f211f9e5a7fbef44a0b22ffaf3b` |
| 실행 환경 | linux/amd64·UID/GID 10001:10001·postgres,deployment |
| 포장 | 운영 Migration 7개·V8/Test Fixture 없음·Enum/UI/운영 SQL Hash 일치 |
| 공개 CA | Source Hash 일치·root 소유 0444·디렉터리 0555·실행 사용자 쓰기 불가 |
| 연결·자원 | App은 Loopback 임의 Port, DB Host Port 없음·일반 App 계정·0.25 vCPU/512 MiB·Swap 없음 |

V7에서 P를 실행하고 실제 HTTP 로그인·접수·대기/성공/실패 조회를 확인했다. 이후 같은 DB에 외부의 Test 전용 V8을 적용했다. V8은 잠시 연결한 읽기 전용 디렉터리에서 Flyway가 적용하며 P Image 자체에는 넣지 않는다. V7까지의 이력과 여섯 업무 Table의 내용 Hash가 그대로인지 확인한 뒤 합성 새 실패 두 건을 추가했다.

Test Mount와 추가 Flyway 위치를 제거하고 같은 P Image로 새 Container/JVM을 실행했다. V8 DB에서도 기본 검증 설정으로 기동했고 Migration 이력을 바꾸지 않았다. 새 두 실패는 각각 HTTP 200·Job FAILED·원래 failureCode·suggestion=null이었고 기존 대기·성공·PROVIDER_REFUSED 조회도 통과했다. API를 읽기 전후 여섯 Table Hash가 같았다.

DB Process·Volume을 유지한 채 JVM만 교체했으므로 기존 Cookie의 보호된 조회는 401이 됐다. 재로그인 뒤 기존 문의·원문·작성자·OPEN과 예약·제안·분류를 조회했다. V8에서 새 문의도 201·PENDING·예약 0으로 접수돼 최종 Ticket/Message/Job 각 6건, 합성 Attempt 4건·Suggestion 1건·Category 2건이었다. 익명 401·USER 조회 403·CSRF 없는 POST 403은 그대로였다.

관련 검증을 재사용 가능한 선택형 Compose Mode로 만들었으며 JavaScript 소스 안전장치 Test 4개를 추가한 P 전체 181개와 ESLint가 통과했다. 기존 Java 56개 결과와 별개다. JSON 결과·Image 산출물 대조는 P Worktree의 Git 제외 `local/deployment/rollback-prepare/`에 보관한다.

고유 Compose Project 두 개에서 실행한 검증이 모두 PASS였다. 최종 재실행의 V7 준비 시간은 50.71초, cgroup 최고 메모리는 V7 204.86 MiB·정상 P의 V8 연결 200.85 MiB였다. 첫 실행을 포함한 관측 최고값은 313.64 MiB였고 OOM Event/Kill은 모든 측정에서 0이었다. 파일 Cache·측정 Process도 포함한 값이며 단계별 순차 조회 10회의 결과다. Worker·실제 개인정보 검사·동시 부하의 자원 검증은 아니다.

합성 Credential과 관찰한 Token/Cookie가 검증 종료 시 남아 있는 App·DB Log에 없는 것을 대조했다. 두 Project의 로컬 App·DB Container는 중지했고 Volume·Image는 보존했다. 실제 HTTP는 HttpClient로 확인했으므로 Browser E2E라고 부르지 않는다. 이 로컬 검증 중에는 AI·AWS API·CI·ECR·Cloud Task 교체를 하지 않았다.

이후 승인받아 `b668d9e`·`77359c9`로 P를 Commit·Push하고, main의 고정 Manifest를 사용하는 별도 Workflow에서 P 전체 Java 579개·JavaScript 181개·ESLint·Build를 통과한 Image 한 개를 ECR에 추가했다. Source Commit·원격 실행·Tag·Digest와 main의 별도 회귀 결과는 [P CI와 ECR 업로드 보고서](./2026-10-16-prepare-image-ci-ecr.md)에 기록한다. Cloud의 P 실행·Image Rollback은 여전히 하지 않았다.
