# Process 종료·Health와 CI 실패·복구

> 실행일: 2026-10-09
> 결과: 로컬 관측·Container 종료 비교와 실제 GitHub Actions의 정상·실패·복구 확인. ECR Image 전달·Cloud Application 실행은 미수행

## 목적과 실행 환경

배포 전에 서버의 최소 Health, 요청 집계와 종료 동작을 확인했다. 개념 설명은 [Process·Health·CI 자료](../study-docs/process-health-and-ci.md)에 분리했다.

- Windows PowerShell 7.6.6, Java 25.0.4, Spring Boot 4.1.1
- Docker Desktop의 Linux Engine
- 실제 PostgreSQL Testcontainers를 포함한 Maven `verify`
- 로컬 Image: `helpdesk:week8-observation`
- 새로운 실제 AI 호출 0회, AWS 리소스 생성·DNS 변경 없음

## 최소 관측 설정

Lab의 `spring-boot-starter-actuator`와 `application.properties`를 추가했다.

| 요청 | 익명 | USER | AGENT |
|---|---|---|---|
| `GET`·`HEAD /actuator/health` | 허용 | 허용 | 허용 |
| `GET /actuator/metrics/http.server.requests` | 401 | 403 | 허용 |
| 기타 관리 Endpoint | 허용하지 않음 | 허용하지 않음 | 403 |

Health의 응답은 `status` 한 필드만 유지했다. 구성요소·상세·Discovery·JMX 노출은 껐고, 환경 변수·설정·Dump·Logger 변경·Shutdown Endpoint와 다른 Metric은 접근을 차단했다. 기존 Session·Role·CSRF 계약은 유지했다.

최초 Health Test에서는 기본 Probe 그룹 목록이 응답에 추가돼 한 필드 기대값과 달랐다. 현재 Baseline은 별도 Probe 그룹을 쓰지 않으므로 해당 기능을 비활성화했다. HEAD의 Body 생략은 MockMvc의 응답 객체만으로 판단하지 않고 실제 내장 HTTP Server와 JDK HTTP Client로 확인했다.

`DeploymentEndpointsIntegrationTest`의 19개 Case는 허용 범위·Role·민감 관리 경로 차단·설정값을 검증한다. AGENT Metric 조회 Test의 Timer는 접근 계약을 위한 Fixture다. 별도의 `DeploymentHttpObservationTest`는 실제 HTTP의 Health `200`·HEAD의 빈 Body·익명 Ticket `401`과 실제 MeterRegistry 집계를 검증한다. Security에서 거부된 `401` 요청도 집계에 들어갔다.

관련 설정 Test와 기존 Session·Security Test의 총 30개 Case가 통과했다. 이 관측 Test는 `in-memory` 실행이므로 RDS Health나 실제 AI Job 성공의 근거는 아니다.

## 같은 Image에서 종료 방식 비교

Test 전용 `ContainerLifecycleExperiment`는 4초 동안 처리하는 합성 GET Endpoint를 제공한다. 이 클래스는 `src/test`에 있으며 실행할 때만 읽기 전용 Mount했다. 완성된 Application Image에 실패 실험 Endpoint를 넣지 않았다.

`Verify-Week8ProcessLifecycle.ps1`에서 각 요청의 시작 Marker와 아직 완료되지 않은 상태를 확인한 뒤 종료했다.

- Container의 `/proc/1/status`에서 Java·PID 1 확인
- 읽기 전용 Root Filesystem, 비특권 사용자, Host Loopback Port
- Provider·Worker 비활성, DB·실제 Key 없이 실행
- 같은 실제 Image ID 대조
- Process 환경 변수·전체 실행 인자·원문 Log는 출력하지 않음

| 종료 방법 | 처리 중 요청 | HTTP Status | Exit Code | OOMKilled | 종료 소요 |
|---|---|---|---|---|---|
| SIGTERM, Container 대기 30초 | 응답 완료 | 200 | 143 | false | 약 4.49초 |
| SIGTERM, Container 대기 1초 | 연결 중단 | 확인 불가 | 137 | false | 약 1.83초 |
| SIGKILL | 연결 중단 | 확인 불가 | 137 | false | 약 0.59초 |

Application의 HTTP 종료 유예는 20초다. Container가 1초 뒤 강제 종료한 Case에서는 이 설정만으로 요청을 마칠 수 없었다. 기본 App Compose에는 바깥 종료 유예를 45초로 두었다. Worker·DB Connection·Job 상태의 전체 종료 결과는 별도 실험에서 이어간다.

### 처음 잘못 둔 기대값

첫 Script는 SIGTERM의 Exit Code를 `0`으로 기대해 실패했다. 실제로 요청은 `200`으로 완료했고 Exit Code는 `143`이었다. Linux OpenJDK의 종료 Signal 구현을 확인한 뒤 `128 + 15`를 기대하도록 수정했다. 첫 실패 Report는 덮어쓰지 않고 별도 보존했으며, 수정 후 3개 Case가 모두 통과했다. [OpenJDK Signal 처리](https://github.com/openjdk/jdk/blob/jdk-25-ga/src/java.base/unix/classes/java/lang/Terminator.java)

종료 요청의 종류, 외부 대기 제한, 요청 완료 여부를 함께 확인해야 한다. `137`이 나왔지만 두 Case 모두 OOM은 아니었다.

재현 명령은 Lab의 다음 순서다.

```powershell
.\mvnw.cmd -B -ntp verify
docker build --tag helpdesk:week8-observation .
pwsh -NoProfile -File .\scripts\Verify-Week8ProcessLifecycle.ps1
```

결과는 Git 제외 경로 `target/week8-process-lifecycle/results.json`, 최초 기대값 실패 기록은 같은 폴더의 `initial-exit-code-expectation.json`에 남겼다. 실험 Container는 모두 제거했고 기존 Container·Volume은 변경하지 않았다. Image와 Report는 남겨 두었다.

## 회귀와 Image Build

| 검증 | 결과 |
|---|---|
| Maven `verify` | Test 551개, 실패·오류·건너뜀 0, Build 성공 |
| JavaScript Unit Test | 145개, 실패·건너뜀 0 |
| ESLint 10.11.0 | Exit Code 0 |
| Docker Image Build | 성공 |
| Test 전용 종료 실험 Source 컴파일 | 성공 |
| 실제 Container 종료 비교 | 3개 Case 통과 |

Java 전체 회귀는 16:38 KST에 끝났다. 이후 추가한 종료 실험 클래스는 JUnit Test가 아니라 선택 실행용 Main이다. Test Source를 다시 컴파일하고 실제 Image에서 실행했다.

기존 `target/`에는 이전 Browser 실험 두 개의 Surefire XML도 남아 있다. 이번 회귀의 수는 폴더의 과거 Report를 합산하지 않고 해당 `verify` 실행의 `Tests run: 551`에서 확인했다.

## 실제 Actions의 실패와 복구

Lab의 `.github/workflows/verify.yml`에 Java·실제 PostgreSQL Test·JavaScript·ESLint·Image Build를 순서대로 작성했다. 기본 권한은 Source 읽기이며 Checkout Credential을 남기지 않는다. 일반 Workflow에는 AI Key·AWS 권한·ECR Push·ECS 배포를 넣지 않았다.

Workflow와 관련 변경을 Lab 저장소에 Commit·Push한 뒤 Ubuntu Runner의 결과를 확인했다.

| 실행 | Java Test | JavaScript Test | ESLint | Image Build |
|---|---|---|---|---|
| [최초 실행](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/37930542592) | 551개 통과 | 145개 중 2개 실패 | Skipped | Skipped |
| [정상 기준](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/37931481943) | 551개 통과 | 146개 통과 | 통과 | 성공 |
| [공백 제목 검증 제거](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/37932210172) | 551개 통과 | 146개 중 3개 실패 | Skipped | Skipped |
| [검증 복구](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/37932759484) | 551개 통과 | 146개 통과 | 통과 | 성공 |
| [main 문서 반영 후 재검증](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/37933813437) | 551개 통과 | 146개 통과 | 통과 | 성공 |

최초 실패는 Windows용 Maven 사전 점검의 Unit Test 두 개에서 발생했다. Process 실행은 가짜 함수로 대체했지만 Shell 선택은 실제 운영체제에 의존하고 있어 Ubuntu에서 기대값과 달랐다. Shell 선택 함수도 주입할 수 있도록 분리하고 Test를 보완했다. 실행기의 Windows 제한을 없애거나 Test를 건너뛴 것은 아니다. 수정 Commit은 `1ebd6f8`이며 Windows와 네트워크 없는 Linux·Node 24 환경에서도 JavaScript 146개를 통과했다.

의도한 실패는 별도 `codex/week8-ci-failure-recovery` Branch에서 재현했다. `ticket-ui.mjs`의 공백 제목 거부 조건 한 줄을 제거하자 기존 UI Test 세 개가 실패했고, ESLint와 Image Build는 실행되지 않았다. 기대값을 바꾸지 않고 조건을 복원해 다음 실행을 통과했다. 정상 기준 `1ebd6f8`과 복구 Commit `9d083ff`의 해당 파일 내용도 같았다. 실험의 오류·복구 Commit은 main에 합치지 않았다.

`Skipped`는 앞의 실패 때문에 검사를 수행하지 않았다는 뜻이다. 현재 Workflow의 후속 Step은 앞선 검사가 성공해야 실행되므로, 이 실험은 JavaScript Test 실패가 Image Build를 차단하는 것을 확인했다. ECR Push나 ECS 배포 Step은 아직 없다.

마지막 main 검증은 Commit `0908f81`에서 성공했다. Java 551개는 실패·오류·건너뜀 0이며 JavaScript 146개·ESLint·Image Build도 통과했다. 로컬 관측 실험 당시의 JavaScript 145개와 CI 보완 후 146개를 같은 실행의 수치로 섞지 않는다.

ECR Digest 전달, AWS Health·CloudWatch·HTTPS·Backup 복원은 남아 있다. AWS의 OIDC·ECR 초기 설정은 실제 실행일이 다른 [별도 보고서](./2026-10-10-aws-oidc-ecr-baseline.md)에 기록한다.

## 이번 구성에서 선택한 경계

- Health는 ALB 점검을 위해 익명으로 허용하되 최소 상태만 제공한다. 전체 관리 기능을 여는 대안은 사용하지 않는다.
- HTTP 요청 Metric 한 개만 AGENT에게 허용한다. 익명 공개나 전체 Metric 목록 공개는 하지 않는다.
- HTTP 종료 유예와 Container의 종료 유예를 함께 설정한다. AI Job의 복구는 기존 영속 상태·Attempt 정책으로 분리한다.
- CI의 검증과 실제 Cloud 배포를 나눈다. 배포 권한은 OIDC·Repository·Environment 범위를 확정한 뒤 추가한다.

관련 파일은 Lab의 `pom.xml`, `application.properties`, `SecurityConfiguration`, `compose.yaml`, 두 관측 Test, 종료 실험 Main·Script와 Actions Workflow다. Cloud 연결 시 DB Health·종료 중 Job·실제 CI 실패 차단·관측 정보의 공개 범위를 다시 점검한다.
