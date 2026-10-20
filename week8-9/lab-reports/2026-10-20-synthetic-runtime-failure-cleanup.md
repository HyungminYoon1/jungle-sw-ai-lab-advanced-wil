# 합성 App의 검사 실패와 자원 회수 검증

> 실행일: 2026-10-20 KST
> 실험 도구: Lab `57c4334`
> Main Image Source: `9f2074b`
> 결과: 정상·Timeout·비정상 종료의 분리 실행 세 건 통과. 실패 두 구성의 HTTP·제안 0건, 원문·예약 보존과 Process·Thread 회수 확인

## 실행 구성과 실패 주입

기존 로컬 `helpdesk:week8-synthetic-9f2074b`를 그대로 사용했다. Image ID는 `sha256:74c49616d364169f9a7f2b3b8bfa50068bb6d944719c8beb05b74862d72b7ce8`이다. Main·Dockerfile·pom.xml이 해당 Source와 같음을 확인했으며 새 Main Image를 만들거나 ECR에 올리지 않았다.

기존 실험 도구에 Test 전용 `ScanMode` 세 개를 추가했다. `NORMAL`은 기존 Main Scanner Bean을 그대로 사용한다. `TIMEOUT`·`NON_ZERO_EXIT`만 Test Configuration의 Primary Scanner를 선택하며, 고정 입력 제한과 Image의 Process Transport·Preparer·Guard·자동 Worker·DB 저장은 유지한다. Test 자식은 JAR의 합성 프로그램으로 정상 JSON을 출력한 다음 PID만 적은 증거 파일을 만들고, 각각 120초 대기하거나 Exit Code 7로 종료한다.

부모는 실패 상태뿐 아니라 JSON 출력 이후의 실행 증거와 해당 PID의 종료를 확인했다. 자식이 시작되지 못한 Timeout을 성공으로 세지 않는다. 선택 옵션·실패 자식은 Test Launcher에만 있으며 Main의 API·실행 설정·업무 정책·DB Schema는 변경하지 않았다. [구성 결정](../../plan/decisions/0010-fixed-synthetic-deployment-configuration.md)에 이 경계를 기록한다.

## 격리와 확인 범위

세 실행은 각각 새 Compose Project·새 PostgreSQL 17.6·합성 Secret 파일을 사용했고 실행 시간 일부가 겹쳤다. App은 0.25 CPU·512 MiB, 추가 Swap 0·비Root·읽기 전용·PID 제한을 유지했다. 내부 Network 하나와 공개 Port 없음, 같은 Image·실제 자원 상한도 대조했다. PostgreSQL은 별도 Container라 App 메모리에 포함하지 않는다.

Provider는 기존과 같이 Test Factory의 Spring AI Adapter·Loopback HTTP 응답이었다. 일반 Provider Configuration·실제 Key·실제 AI·탐지 모델·RDS TLS·Browser·Fargate는 실행하지 않았다. Service에 합성 작성자를 직접 전달했으므로 HTTP 접수 201이나 Browser 인증 작성자 선택의 새 검증도 아니다.

## 업무 결과

| 항목 | NORMAL | TIMEOUT | NON_ZERO_EXIT |
|---|---|---|---|
| 정상 허용 입력 | 성공 3건 | 실패 1건 | 실패 1건 |
| 허용 범위 밖 추가 입력 | 실패 1건 | 실패 1건 | 실패 1건 |
| 검사 실패 코드 | 해당 없음 | `PRIVACY_SCAN_TIMEOUT` | `ADAPTER_CONFIGURATION_ERROR` |
| Provider HTTP / 제안 수 | 3 / 3 | 0 / 0 | 0 / 0 |
| 모든 Ticket 상태 | OPEN | OPEN | OPEN |
| 문의별 Attempt / 예약 | 1 / 1 | 1 / 1 | 1 / 1 |
| 원문·합성 작성자 보존 | 확인 | 확인 | 확인 |
| 처리 후 검사 자식 / 개인정보 I/O Thread | 0 / 0 | 0 / 0 | 0 / 0 |
| App Exit Code / OOM Kill | 0 / 없음 | 0 / 없음 | 0 / 없음 |

범위 밖 입력의 실패 코드는 세 실행 모두 기존 `ADAPTER_CONFIGURATION_ERROR`였다. 실패 구성은 Ticket·Message·예약 Row가 각각 2건이고 제안은 0건이었다. 추가 자동 Polling 뒤에도 최종 실패·예약 1회와 HTTP 0회를 유지했다. 예약은 검사를 시작하기 전에 Commit한 기록이므로 전송 0회와 모순되지 않는다.

Timeout의 허용 입력은 접수부터 실패 관찰까지 20.600초, 비정상 종료는 9.004초였다. 이 시간에는 Scheduler 대기·자식 기동·실패 저장·조회 간격이 포함된다. 20초 검사 예산과 3초 회수 예산을 사용했으며, 이 관찰값을 순수 검사 시간이나 실제 AI 응답 시간으로 해석하지 않는다. Health 200은 Job 처리 전 준비 단계에서 확인한 값이다.

## 자원 결과

| App cgroup 측정 | NORMAL | TIMEOUT | NON_ZERO_EXIT |
|---|---:|---:|---:|
| Job 전 현재 메모리 | 218.17 MiB | 400.12 MiB | 206.25 MiB |
| Job 후 현재 메모리 | 247.58 MiB | 407.74 MiB | 214.65 MiB |
| 마지막 측정까지 최고 메모리 | 300.26 MiB | 460.54 MiB | 265.88 MiB |
| OOM / OOM Kill Counter | 0 / 0 | 0 / 0 | 0 / 0 |
| 실험 Main 진입 후 Spring 기동 완료 | 80.416초 | 78.814초 | 83.499초 |

Timeout 실행은 Job 전부터 현재 사용량이 높았다. 이 결과만으로 Timeout이 정상 실행보다 약 160 MiB를 더 사용하게 했다고 단정하지 않는다. 실행 시점·JVM·Cache 등 조건의 영향은 분리하지 않았으며, 각 Mode도 한 번씩 관찰했다. Peak에는 부모·자식·Native 메모리·파일 Cache·실험 계측이 포함되고, 모델을 포함한 최종 Task 사양이나 장기 부하의 근거는 아니다.

## 회귀와 재현

새 Mode 계약 Unit Test 5개와 기존 관련 Test를 합친 Java 129개가 16:38:02 KST에 실패·오류·건너뜀 없이 통과했다. JavaScript 전체 279개, 변경 JS의 ESLint 10.11.0·PowerShell 문법·Diff 공백 검사도 통과했다. 전체 Java `verify`와 원격 CI는 이번에 실행하지 않았다.

```powershell
.\mvnw.cmd -B -ntp test-compile
.\scripts\Verify-Week8SyntheticRuntime.ps1 -Image helpdesk:week8-synthetic-9f2074b -ScanMode NORMAL
.\scripts\Verify-Week8SyntheticRuntime.ps1 -Image helpdesk:week8-synthetic-9f2074b -ScanMode TIMEOUT
.\scripts\Verify-Week8SyntheticRuntime.ps1 -Image helpdesk:week8-synthetic-9f2074b -ScanMode NON_ZERO_EXIT
```

Image의 Main Source가 바뀌었다면 그 Source의 검증 Image를 먼저 준비한다. 결과는 `target/week8-synthetic-runtime/<run-id>/results.json`에 남는다. 오늘 결과 파일의 저장 시각은 Timeout 16:40:15, 비정상 종료 16:40:27, 정상 16:40:59 KST였다.

세 실행 모두 정리 후 해당 Project의 Container·Network 0개와 합성 Secret 파일 제거를 다시 확인했다. JUnit Test Class가 Mount되지 않은 것도 확인했다. DB Volume 세 개와 Image는 보존했으며 기존 사용자 데이터는 삭제하지 않았다. AWS·IAM·DNS·Secret·원본 RDS와 유료 AI는 변경·호출하지 않았고 Push·CI·ECR 업로드도 하지 않았다.

## 다음 배포 단계

합성 구성의 정상 처리와 통합 실패·자원 회수까지 로컬에서 확인했다. 다음은 변경 검토와 승인한 전달 범위에 따른 Push·CI·ECR, 새 Log의 Cloud 관측과 실제 실행·보관 비용 확인이다. Cloud 실제 AI는 합성 입력·당일 호출/비용·Secret 참조·Task 명세를 별도로 확인한 뒤 진행한다. V2와 개인정보 모델 고도화는 후속 과업으로 유지한다.
