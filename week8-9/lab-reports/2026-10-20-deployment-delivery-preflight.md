# 새 Code의 배포 전달 전 확인

> 확인일: 2026-10-20 KST
> Lab Source: 최초 전달 `57c4334`, Test 설정 분리 수정 `d8ca65f`
> 결과: 최초 CI의 Test 설정 의존성을 재현·수정하고 새 Source의 CI·Image Build 통과. AWS 비용은 접근 거부로 미확인이며, 사용자가 이번 Image 한 개의 비용 조회 선행 조건을 해제해 ECR 전달을 이어감

## 로컬과 원격 Source

처음 확인했을 때 Lab의 작업 트리는 깨끗했고 원격 main보다 로컬 Commit 10개가 앞서 있었다. `git ls-remote`로 확인한 당시 원격 main은 `d0a55ce5d0a9b3942416be6ff331e12cfba1f1e4`였다. 당시 최근 원격 CI Run `38931225504`는 이 이전 Source의 성공 결과이며 새 로컬 Source의 CI 근거로 쓰지 않았다.

미전달 변경에는 Request·접수 Commit·Worker Log 연결, 로컬 Process Transport, 후속으로 분리한 V2 독립 검증/치환·오프라인 모델 실험, 합성 실행 구성과 Test 도구가 포함된다. V2·실제 모델은 실행용 구성에 연결하지 않았다. 변경된 파일 47개를 목록으로 확인했고 전달 Workflow·명세 Template과 관련 문서를 점검했다. 이 목록 확인을 47개 파일 전체의 새 보안 감사로 표현하지 않는다.

## 전체 로컬 검증

Source `57c4334`에서 새 Shell 자식 Process의 실제 AI Key 환경 변수를 제거하고 Provider·Worker를 비활성으로 설정해 `mvn verify`를 실행했다. 사용자의 원래 Shell이나 전역 Key는 변경하지 않았다. Test가 명시적으로 조립한 통제 Provider·Worker와 실제 PostgreSQL은 각 Test의 범위에서 동작한다.

| 검증 | 결과 |
|---|---|
| Surefire 전체 Java | 1,009개, 실패·오류·건너뜀 0 |
| 패키징 후 Failsafe | 2개, 실패·오류·건너뜀 0 |
| 실행 종료 | 17:22:56 KST, BUILD SUCCESS |
| 소요 시간 | 4분 45초 |
| 실제 AI | 호출하지 않음 |

JavaScript 전체 279개와 ESLint, 세 Mode의 실제 Linux App·자원 검증은 앞선 [통합 실패 보고서](./2026-10-20-synthetic-runtime-failure-cleanup.md)의 결과다. 이번 전체 `verify`는 추가 로컬 회귀이며 원격 CI·ECR·Cloud 성공으로 바꾸어 기록하지 않는다.

## 전달 Workflow와 실행의 경계

현재 일반 Workflow는 Push에서 Java·JavaScript·Lint를 통과한 뒤 Image를 Build한다. ECR 업로드는 `workflow_dispatch`의 `publish_image=true`일 때만 별도 Publish Job이 수행한다. 그 실행의 검증 Image를 Artifact로 전달해 재Build 없이 기존 Repository에 추가하고, Push Digest와 ECR 조회 Digest를 비교한다.

기존 main 전용 OIDC Role·서울 Region·기존 ECR 대상은 유지한다. 이 Workflow에는 ECS Task 실행·RDS·ALB·IAM·DNS·Secret 변경이 없다. 고정 P를 전달하는 별도 Workflow는 Rollback 준비용이며 새 main Source의 검증으로 대신하지 않는다.

ECR 업로드도 현재 Task의 프로그램을 교체하지 않는다. 새 Code의 Cloud Log를 확인하려면 검증된 Manifest Digest와 기존 실행 명세를 대조하고, 별도 승인 범위에서 새 Task로 실행해야 한다. 첫 관측 단계는 AI 비활성을 유지해 접수·Request Log를 확인하고, Worker의 실제 처리는 뒤의 합성 AI 실험과 구분한다.

## 승인 후 Source 전달

사용자가 두 저장소의 Push·CI와 비용 확인 후 Image 한 개의 조건부 ECR 추가를 승인했다. 기존 Image는 유지하고 App·RDS·ALB·IAM·DNS·Secret·AI 활성화는 변경하지 않는 범위다. 비용을 확인할 수 없으면 ECR 업로드 전 멈추는 조건도 포함했다.

Lab main을 `57c433476902d97095ebd0613ec6a8aa8eb5ef33`까지 Fast-forward Push했다. 이 Source의 [CI Run 39396150055](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/39396150055)는 Java 1,009개 중 1개가 실패했다. 뒤의 JavaScript·Lint·Image Build와 패키징 후 Failsafe는 실행하지 않았다. WIL에는 별도 Workflow가 없어 문서 링크·UTF-8·줄바꿈·Diff를 로컬에서 확인한다.

## CI 실패의 재현과 Test 설정 분리

실패한 `HandlerTimingInterceptorTest`는 `INFO` Event 1건을 기대했지만 0건을 받았다. 앞선 Spring 통합 Test의 Root `WARN` 설정이 같은 Test JVM에 남아 있었고, Logger 수준을 명시하지 않은 Unit Test가 실행 순서에 의존했다. 같은 두 Class를 알파벳 순서로 로컬에서 실행해 Java 10개 중 동일한 1개 실패를 재현했다.

운영 로그 수준·Event·Controller·Worker의 업무 코드는 변경하지 않았다. Handler와 같은 패턴인 Worker Scheduler의 Log Test가 자기 Logger만 `INFO`로 설정하고 Test마다 이전 수준을 복원하도록 했다. Handler를 `WARN`으로 설정하면 `INFO`를 강제로 출력하지 않는 Case도 추가했다. 기존 민감 값·Exception 원문 미출력 Assertion은 유지한다.

```powershell
.\mvnw.cmd -B -ntp "-Dtest=AiPrivacyScanFailureIntegrationTest,AiSuggestionWorkerSchedulerTest,HandlerTimingInterceptorTest" "-Dsurefire.runOrder=alphabetical" test
```

수정 후 이 순서 고정 실행은 17:57:22 KST에 Java 28개·실패/오류/건너뜀 0개로 통과했다. Test 두 파일과 재현 안내를 `d8ca65f`로 Commit·Push했다. 수정 Source의 [CI Run 39397231695](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/39397231695)는 Java 1,010개·패키징 후 2개·JavaScript 279개·ESLint·Image Build까지 통과했다. Test의 실패·오류·건너뜀은 없으며 Verify Job은 4분 34초였다. 일반 Push라 ECR Publish는 실행하지 않았다.

최초 로컬 성공·CI 실패·수정 뒤 로컬 성공과 원격 성공을 각각 기록한다. CI Image ID는 `sha256:0f0331a514f8067249b5266e5688baf5d65ee03ceb522a4d70f275184be37e58`다. 이는 ECR Manifest Digest나 Cloud 실행 근거가 아니다. 수동 Publish 실행은 그 실행에서 다시 검증·Build한 Image를 Publish Job으로 전달한다.

## 현재 AWS 조회와 비용 조건

사용자가 helpdesk-deployer 로그인·MFA를 직접 완료한 뒤 서울의 지정 리소스를 읽기 전용으로 확인했다. 17:48~17:51 KST에 확인한 상태는 다음과 같다.

| 대상 | 확인한 상태 |
|---|---|
| ECS Cluster | 활성 Service 0개, 실행 Task 1개·보류 0개 |
| 실행 Task | `helpdesk-learning:4`, Fargate 0.25 vCPU·0.5 GiB, 10월 17일 00:05부터 실행 중 |
| 실행 Image | `sha256:7369d0471d58ed27add9b6a9fc1d9fb28c99e9de7e006620127fd01ecea3933b` |
| RDS `helpdesk-learning` | 사용 가능, PostgreSQL 17.11·db.t4g.micro·20 GiB·암호화·Single-AZ |
| ALB `helpdesk-learning` | 활성, Application·Internet-facing |
| Billing 월간 누계·예상 비용 | 모두 액세스 거부, 금액 미확인 |

ECS의 Container Health는 `알 수 없음`이었다. Task의 실행 상태와 ALB의 활성 상태만으로 새 Code·Target Health·업무 기능을 검증했다고 보지 않는다. RDS 화면의 `DescribeGlobalClusters` 거부도 남아 있지만 지정 DB의 `사용 가능` 상태와 구성은 읽을 수 있었다. 이번에는 DB 접속·Row 조회·새 Cloud Log 실험을 수행하지 않았다.

비용 화면의 접근 거부는 비용 0원이나 리소스 중지를 의미하지 않는다. 기존 Task·RDS·ALB가 유지되고 있어 실제 누계와 월 3만 원 상한의 비교는 미확인이다. Root 사용·IAM 확대·자동 중지/삭제는 하지 않았다. 처음 승인 조건에 따라 ECR을 보류한 뒤 사용자가 비용 조회를 뒤로 미루고 진행하도록 요청했다. 이에 이번 Image 한 개의 업로드에는 비용 조회를 선행 조건으로 두지 않는다. 월 상한을 충족했다고 기록하거나 이 요청을 무제한 리소스 실행·AI 호출 승인으로 넓히지 않는다.
