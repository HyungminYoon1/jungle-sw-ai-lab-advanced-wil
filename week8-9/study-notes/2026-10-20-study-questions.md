# 10월 20일 검사 실패와 Cloud AI 배포 검증

> 상태: 학습 진행 중. 로컬 실패 검증·CI 복구·ECR/Task 전달 뒤 고정 합성 문의의 Cloud AI 처리·제안 저장·AGENT 조회를 확인했다. 10/21 연장 실행에서 AI 비활성 복귀·재로그인·기존 문의와 제안 보존 검증까지 마쳤으며 비용 확인 등은 남아 있다.

## 이번 연장 실행의 진행상황

10월 20일에 시작한 학습을 자정 이후에도 이어갔다. 아래 문의 접수·AI 저장·복귀 검증의 실제 실행일은 10월 21일 KST다.

| 확인한 흐름 | 실제 결과 |
|---|---|
| 실험 구성 | 같은 검증 Image의 명세 :7, 단일 Task에서 Provider·Worker·고정 합성 검사 활성화 |
| 문의 접수 | 실제 HTTPS 화면에서 합성 문의 한 건만 생성. Ticket·Message·Job 5, 접수 201 |
| AI 제안 | Job 5 SUCCEEDED, 생성 한도 1·보완 0·예약 1, Suggestion 1건 저장 |
| 저장한 제안 조회 | ACCOUNT·UNDETERMINED·PENDING_REVIEW. DB와 AGENT 화면 일치, Ticket은 OPEN 유지 |
| 기존 문의 | Ticket 1·2와 Message 1·2의 Row Hash 유지. 기존 Job 두 건은 합성 범위 밖 입력 거부로 FAILED·예약 1 |
| 실험 종료와 복귀 | 실험 Task STOPPED·종료 코드 143. AI 비활성 명세 :6의 새 Task와 Healthy Target 한 개 확인 |
| 재로그인 검증 | 이전 Session 거부 뒤 AGENT 재로그인. Ticket 1·2와 Job 1·2·5 조회 및 새 Task의 Handler 200 확인 |

추가 문의 접수·AI 재호출은 하지 않았다. RDS 설정·V8 Schema·DNS·기존 Secret도 유지했다. 현재 App의 Provider·Worker는 비활성이지만 DB에 저장한 제안은 계속 조회할 수 있다. 이번 실험의 예약 1건을 외부 HTTP 요청 횟수의 직접 계측값으로 읽지는 않는다.

## 회차 시작 때 정한 범위

어제 정상 처리 뒤 자식 Process가 남지 않는 것을 확인했다. 오늘은 전체 App에서 Timeout·비정상 종료가 발생해도 자원을 정리하고, 접수 원문과 예약을 유지하며 외부 전송을 막는지부터 확인한다. 개인정보 탐지 모델·인물 관계 V2 고도화는 후속으로 유지한다.

## 설명한 개념

Timeout은 기다림의 한도가 끝났다는 뜻이지 Process가 이미 종료됐다는 뜻이 아니다. 현재 Transport는 직접 시작한 Process의 실제 종료·Pipe·보조 Thread 회수까지 확인한다.

JSON 문법이 올바른 것과 검사 실행의 성공도 다르다. 정상 JSON을 출력했더라도 종료하지 않거나 현재 계약의 정상 종료 코드 0을 만족하지 못하면 결과를 사용하지 않는다. 검사 실패가 별도 Transaction으로 접수한 Ticket·Message까지 취소하는 것은 아니다.

개념과 추가 복습 질문은 [합성 실행 학습자료](../study-docs/synthetic-deployment-and-runtime-configuration.md)에 보완했다.

## 문답에서 구분한 실행 대상과 배포 산출물

처음에는 검사기의 Exit Code 7을 Helpdesk App 전체의 종료로 받아들여, App이 없어 답변을 받을 수 없으므로 외부 요청을 보내면 안 된다고 답했다. 이번에 종료된 것은 별도 검사 자식 Process이며 외부 AI 요청도 아직 보내기 전이라는 설명을 들었다. 이어진 확인에서는 부모 App이 Job 실패를 DB에 기록하고 다른 요청을 처리할 수 있다고 답했다.

새 Code의 Cloud 확인에는 Source를 전달·교체해야 한다고 답했지만 배포하는 산출물이 구체적이지 않았다. Source의 Test·Build → JAR를 포함한 Image → ECR 업로드 → 새 Task 실행 순서를 설명한 뒤, ECR 업로드만으로 기존 Task가 바뀌지 않으며 새 Image로 새 Task를 실행해야 한다고 답했다.

## 실제 실행으로 확인한 것

운영 코드 대신 Test 도구에 세 Mode를 추가했다. 같은 Main Image·0.25 CPU·512 MiB에서 정상 3건의 성공과 범위 밖 1건의 실패를 재확인했다. 별도 두 구성은 정상 JSON 뒤 대기·Exit Code 7을 각각 만들어 Timeout·비정상 종료의 최종 실패, HTTP·제안 0건과 원문·예약 보존을 확인했다. 세 실행 모두 검사 Process·개인정보 I/O Thread가 남지 않았고 OOM도 없었다.

최고 메모리는 정상 300.26 MiB·Timeout 460.54 MiB·비정상 종료 265.88 MiB였다. Timeout 구성은 처리 전부터 사용량이 높았으므로 차이를 Timeout 하나의 효과나 누수로 단정하지 않는다. 실제 모델이 없는 제한 실험의 값이며 Cloud 사양을 새로 확정하지 않았다.

관련 Java 129개·JavaScript 전체 279개가 통과했다. [실행 보고서](../lab-reports/2026-10-20-synthetic-runtime-failure-cleanup.md)에 조건·DB 결과·자원·회귀 범위를 정리했다. Provider 응답은 통제된 로컬 HTTP이며 실제 AI·AWS·Browser 결과가 아니다.

이어서 전체 로컬 `verify`의 Java 1,009개·패키징 후 2개도 통과했다. 처음 원격은 이전 Source였으므로 그 CI 성공을 새 코드의 결과로 읽지 않았다. [전달 준비](../lab-reports/2026-10-20-deployment-delivery-preflight.md)에서는 일반 Push의 검증과 수동 ECR 업로드, 업로드와 새 Task 실행을 구분했다.

사용자는 두 저장소 Push·CI와 비용 확인 후 Image 한 개의 조건부 ECR 추가를 승인했다. 비Root AWS 조회에서는 기존 Task 1개 실행·RDS 사용 가능·ALB 활성을 확인했지만 월간 누계와 예상 비용은 접근 거부로 읽지 못했다. 처음에는 ECR을 보류했고, 이후 사용자가 비용 조회를 뒤로 미루고 진행하도록 요청해 이번 한 개의 전달을 이어간다. 리소스·권한·Secret·AI 활성화는 변경하지 않았으며 비용 조회 실패를 비용 0원으로 해석하지 않는다.

첫 Push의 CI는 Java 1,009개 중 로그 검증 1개가 실패해 Image Build 전에 멈췄다. 앞선 Spring Test의 `WARN` 설정 때문에 다음 Unit Test가 기대한 `INFO` 로그를 받지 못한 문제를 같은 순서의 로컬 실행으로 재현했다. 두 로그 Test가 필요한 수준을 직접 설정하고 이전 값을 복원하도록 고쳤으며 운영 코드는 바꾸지 않았다. 수정 뒤 순서 고정 Test 28개가 통과했고 수정 Commit `d8ca65f`의 원격 CI도 Java 1,010개·패키징 후 2개·JavaScript 279개·Lint·Image Build까지 통과했다. 이는 AWS 장애나 IAM 오류의 수정과는 다른 Source 검증 단계다.

이후 [수동 ECR 전달](../lab-reports/2026-10-20-ecr-image-publication.md)도 같은 Source를 다시 검증하고 성공했다. 검증 Job이 만든 Image를 재Build 없이 Publish Job으로 옮겼고 ECR 조회 Digest와 Push 결과가 같았다. 새 Manifest Digest는 `sha256:0f53c6ce5532d44b4a0b3e8123c27498aeb466539ee02f00326eb111c9e9296a`다. 기존 Image·Task는 유지했으므로 새 코드의 Cloud Log나 실제 AI 배포까지 확인한 것은 아니다.

그다음 사용자가 AI 비활성 상태의 Task 한 개 교체를 승인했다. 기존 명세 `:4`의 Image만 바꾼 `:6`을 등록하고 새 Task를 기동했다. Cloud Log에서 DB 연결·V8 유지·추가 Migration 없음·Spring 시작을 확인했다. 새 Target의 Healthy를 확인한 뒤 기존 Target의 Draining을 기다리고 기존 Task를 중지했다. 최종 실행 Task는 새 명세 한 개이며 보류 중 Task는 없다.

사용자가 새 App에 AGENT로 재로그인한 뒤 Ticket 1·2의 기존 제목·OPEN 상태와 PENDING Job을 조회했다. 로그인 후 `/`의 404와 보호 API의 로그인 실패는 구분했다. 다만 기존 Session은 교체 전부터 만료돼 있었으므로 이번에는 Session 소실 시점을 증명했다고 하지 않는다. 별도 HTTPS 요청의 `X-Request-Id`와 새 Task의 `HANDLER_COMPLETED` Log도 일치했다. [Task 교체 실행 기록](../lab-reports/2026-10-20-ai-disabled-task-replacement.md)에 변경 범위·검증 필드·Log 검색 문법을 정리했다. RDS·DNS·Secret·IAM과 AI 비활성 설정은 유지했다.

다음 실제 AI 실험을 준비하며 Worker의 실행 대상을 확인했다. 현재 SQL은 오래된 PENDING부터 선택하고 실행권·예약을 Commit한 뒤 입력 검사를 한다. 따라서 합성 입력 제한만으로 기존 Job의 상태 불변을 보장하지는 못한다. 새 실험 Job만 선택하는 안을 제시했으며, Claim뿐 아니라 복구·기한 만료 처리의 범위도 함께 확인해야 한다고 설명했다. 이 차이는 [합성 배포 학습자료](../study-docs/synthetic-deployment-and-runtime-configuration.md#job-선택과-외부-전송-전-검사는-다르다)에 추가했다.

기존 실행권·예약 PostgreSQL Integration Test 18개, Worker 구성 8개, 합성 입력 제한 9개를 로컬에서 다시 실행해 총 35개가 통과했다. 이는 현재 동작의 회귀 결과이며 새 Job 선택 제한을 구현한 결과는 아니다. 새 AWS 변경·실제 AI 호출은 하지 않았다.

이후 문답에서 Job 실패는 AI 처리 작업의 실패이며, Job 상태가 바뀌어도 원문이 남아 있으면 문의는 보존된다고 답했다. 이 두 답은 맞다. 기존 Job의 상태 불변까지 요구하는 것과 구분했으며, 새 Job 선택 기능을 추가하지 않고 승인한 두 기존 Job의 입력 거부를 허용하는 최소 실험으로 진행한다.

합성 실험용 부분 명세·Parameter 읽기 정책 초안과 설정 결합 Test를 Lab `e01ed83`에 정리했다. Java `verify` 1,014개·패키징 후 2개, JavaScript 286개와 ESLint가 통과했다. Main·Image는 바꾸지 않았고 기존 실행 명세에 설정을 이름별로 병합한다. 이 로컬 결과는 실제 Key 인증·Cloud AI 실행 결과가 아니다.

사용자는 새 Standard SecureString 한 개와 Execution Role의 해당 ARN 읽기 한 문장, 같은 Image·단일 Task의 합성 문의 한 건과 AI 비활성 `:6` 복귀를 승인했다. Private CloudShell의 psql 17.11·TLS 1.3으로 읽기 전용 조회한 결과 미완료는 Ticket 1·2의 PENDING 두 건뿐이고 Attempt·예약은 모두 0이었다. 기존 Ticket·Message Hash도 확보했다. 새 Job은 생성 1회·보완 0회이며 실패 뒤 추가 호출하지 않는다.

이어서 작성자가 Helpdesk 전용 Key를 직접 Standard SecureString으로 등록했다. Codex는 값을 열지 않고 목록의 이름·등급·유형을 확인했다. Execution Role의 지정 ARN 읽기 한 문장도 적용했고 저장된 JSON에서 원래 네 문장 보존을 확인했다. Root는 로그아웃했다.

같은 Image로 합성 실행 명세 `:7`을 등록하고 단일 Task를 실행했다. 첫 요청은 태그 전파만 선택해 RunTask의 직접 요청 태그 조건에서 거부됐고, 이전 기록과 대조해 `Project=helpdesk-learning`을 직접 넣어 해결했다. IAM을 넓히지 않았다. 기존 Job 1·2는 입력 범위 거부로 FAILED·예약 1이 됐지만 Ticket·Message Hash는 유지됐다. 따라서 ‘문의 원문 보존’과 ‘AI Job 상태 불변’은 다른 조건이라는 점을 실제 DB로 확인했다.

10/21 00:02 KST의 연장 실행에서 AGENT로 로그인한 뒤 고정 합성 문의 한 건만 접수했다. Ticket·Message·Job 5가 저장되고 접수 Handler는 201을 남겼다. 별도 Worker는 Job 5를 SUCCEEDED로 완료하고 제안 한 건을 저장했다. DB와 실제 AGENT 화면의 요약·ACCOUNT·UNDETERMINED·PENDING_REVIEW가 같았으며 원문과 Ticket OPEN도 유지됐다. 접수 약 0.928초와 Worker Tick 약 27.516초는 서로 다른 구간으로 읽는다.

실험 Task는 중지했고 AI 비활성 `:6`의 새 Task를 실행했다. Spring 기동·V8·Target Healthy와 읽기 전용 SQL의 데이터 보존을 확인했다. 이전 Session은 거부됐고, 작성자가 재로그인한 뒤 기존 Ticket 1·2와 Job 1·2·5를 다시 조회했다. 새 Task의 Handler Log도 모두 200이었다. 저장한 제안을 읽는 데는 Worker를 다시 켜거나 AI를 재호출할 필요가 없었다. [Cloud AI 실행 보고서](../lab-reports/2026-10-20-synthetic-cloud-ai-preflight.md)에 실제 시각·Row·관측 범위를 정리했다. 일반 개인정보 모델·인물 관계 V2는 켜지 않았으며 Token 사용량·원격 HTTP 횟수는 이번 Cloud Log에서 직접 계측하지 않았다.

## 이어갈 배포 학습

- 새 Source의 CI·ECR 전달과 Digest·실행 명세 대조, AI 비활성 Task 교체·새 Request Log·기존 문의 조회를 완료했다. 실제 비용·저장/보관량 확인은 남아 있다.
- 고정 합성 문의의 실제 Cloud AI 처리·제안 저장과 AI 비활성 복귀 뒤 재로그인·데이터 보존까지 확인했다. 기존 기한·예약은 초기화하지 않았다.
- 기존 Cloudflare DNS를 유지한 Route 53 비교, 최종 회귀·직접 설명·설정 수정·WIL과 보관 정리를 남은 순서로 유지한다.

## 이해 확인 질문

1. 정상 JSON을 출력한 검사기가 7로 종료했다면 그 결과로 외부 AI 요청을 보내도 되는가? 왜 그런가?
2. 로컬 실험의 통과가 AWS에서 실행 중인 기존 Task의 코드를 바꾸는가? 새 Code의 Cloud 검증 전에 무엇을 전달하고 교체해야 하는가?
