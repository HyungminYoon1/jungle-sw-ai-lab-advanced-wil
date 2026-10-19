# 합성 배포 구성의 자동 Worker와 자원 측정

> 실행일: 2026-10-19 KST
> 실험 도구 Commit: Lab `9067210`
> Image의 Main Source: `9f2074b`
> 결과: 같은 Image·0.25 CPU·512 MiB의 독립 실행 2회 통과. 각 실행에서 자동 성공 3건·범위 밖 실패 1건, OOM 없음

## 새 Image와 실행 범위

로컬 `helpdesk:week8-synthetic-9f2074b`를 새로 Build했다. Image ID는 `sha256:74c49616d364169f9a7f2b3b8bfa50068bb6d944719c8beb05b74862d72b7ce8`이다. 로컬 식별자이며 ECR 업로드 근거가 아니다. Test 도구 추가 전 Main Source `9f2074b`를 Label에 기록했고, 이번 도구 Commit은 Main·Dockerfile·Maven 설정을 변경하지 않았다.

App의 실제 Main JAR와 자동 Scheduler·Worker·Preparer·합성 검사 자식 JVM을 실행했다. 같은 Image에서 Test Launcher와 작은 Bridge만 읽기 전용 Mount했으며 `target/classes`나 전체 Test Class 디렉터리는 연결하지 않았다. 주요 Main Class가 `/app/helpdesk.jar`에서 로드됐는지도 확인했다.

일반 Provider Configuration은 비활성화하고 Test Factory가 같은 Spring AI Adapter를 `127.0.0.1`의 HTTP Fixture로 등록했다. 요약 응답은 통제된 합성값이며 실제 AI나 실제 Key를 사용하지 않았다. 이 선택은 [구성 결정](../../plan/decisions/0010-fixed-synthetic-deployment-configuration.md)에 기록한다. 자동 Worker가 처리하도록 두었고 실험 코드에서 `runOnce()`를 직접 호출하지 않았다.

## 격리와 측정 조건

각 실행은 새 Compose Project·새 PostgreSQL 17.6·합성 설정 파일을 사용했다. App·DB는 `internal: true`인 Network 한 개에만 연결하고 Host Port는 열지 않았다. 실행 전에 실제 Network·Project Label·Image·자원 상한을 대조했다. [Compose 내부 Network](https://docs.docker.com/reference/compose-file/networks/#internal)

App은 비Root `10001:10001`·읽기 전용 파일 시스템·PID 128개 제한이며 Capability를 제거했다. CPU 상한 0.25개, Memory와 Memory+Swap 합계는 모두 512 MiB로 설정했다. cgroup의 실제 Memory 상한 536,870,912 Byte·Swap 상한 0도 확인했다. PostgreSQL Container의 메모리는 App 한도에 포함하지 않는다. [Docker 자원 제한](https://docs.docker.com/engine/containers/resource_constraints/)

부모 App에서 `memory.current`·`memory.peak`·`memory.events`·`cpu.stat`을 읽었다. Peak는 마지막 측정 시점까지의 값이며 부모·자식·Native 메모리·파일 Cache·실험 계측도 포함한다. Counter는 초기화하지 않았다. 종료 후의 전체 생애 Peak나 JVM Heap만의 수치로 바꾸어 쓰지 않는다. [Linux 메모리 Counter](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html#memory-interface-files)

## 두 번의 결과

| 항목 | 첫 실행 | 두 번째 실행 |
|---|---:|---:|
| Job 처리 전 현재 메모리 | 236.71 MiB | 201.13 MiB |
| Job 처리 후 현재 메모리 | 263.17 MiB | 237.74 MiB |
| 마지막 측정까지 최고 메모리 | 310.79 MiB | 290.21 MiB |
| OOM / OOM Kill Counter | 0 / 0 | 0 / 0 |
| 실험 Main 진입 후 Spring 기동 완료 | 80.108초 | 84.086초 |
| 접수부터 성공 관찰까지 3건 | 17.217·5.993·6.493초 | 18.107·10.600·6.996초 |
| CPU 제한 대기 Period 누적 | 1,189 | 1,296 |
| 통제된 Provider HTTP | 3회 | 3회 |
| 성공 Job / 실패 Job | 3 / 1 | 3 / 1 |
| 종료 후 남은 검사 자식 / 개인정보 I/O Thread | 0 / 0 | 0 / 0 |

첫 결과는 23:01:27, 두 번째 결과는 23:04:54에 저장됐다. 서로 다른 새 Project·DB에서 같은 구성과 Case를 반복한 것이다. 수치 차이를 특정 최적화나 누수의 효과로 단정하지 않는다. Job 시간에는 Scheduler 대기·검사 자식 기동·HTTP/검증·DB 저장·상태 조회 간격이 포함되므로 Scanner 한 번의 시간이나 실제 AI 응답 시간으로 쓰지 않는다.

각 실행은 고정 합성 문의 세 건을 자동으로 처리했다. 받은 HTTP의 제목·본문은 기대한 전송 복사본과 정확히 일치했고 이메일만 가려졌다. Job은 `SUCCEEDED`, 제안은 각각 한 건이었다. 범위 밖 문장을 붙인 문의 한 건은 `ADAPTER_CONFIGURATION_ERROR`의 `FAILED`였고 추가 HTTP·제안은 없었다.

네 문의 모두 Ticket `OPEN`·원문·합성 작성자·Attempt/예약 1회를 확인했다. 전체 Ticket/Message/예약 Row는 각각 4건, 제안은 3건이었다. 실패 뒤 추가 관찰 동안 HTTP는 3회 그대로였다. 작성자는 Service에 직접 전달한 Fixture이므로 Browser 인증 결과에서 선택됐다는 새 근거는 아니다.

각 성공 직후와 App 종료 뒤 검사 자식 Process·개인정보 I/O Thread가 남지 않는 것을 확인했다. App Process도 종료 코드 0·OOM Kill 없음으로 끝났다. Health의 HTTP 200/UP과 Job 결과는 별도로 검사했다.

## 재현과 회귀 확인

```powershell
.\mvnw.cmd -B -ntp test-compile
.\scripts\Verify-Week8SyntheticRuntime.ps1 -Image helpdesk:week8-synthetic-9f2074b
```

이 Image는 위 명령 전에 Build했다. 다른 Source를 검증할 때는 실제 Commit을 Label·Tag에 맞춰 새 Image를 만들고 `-Image`로 선택한다. 결과는 `target/week8-synthetic-runtime/<run-id>/results.json`에 남는다.

관련 Java 회귀 124개는 23:07:07에 실패·오류·건너뜀 없이 통과했다. 새 Script Source 보호 8개를 포함한 JavaScript 전체 276개, 변경한 JS의 ESLint 10.11.0·PowerShell 문법 검사·Diff 공백 검사도 통과했다. Java Test Compile에는 두 Test 전용 Class가 추가됐다. 앞선 전체 Java `verify` 1,004개 + 패키징 후 2개는 직전 실행 결과이며 이번에는 전체 Java를 다시 실행하지 않았다.

## 정리와 다음 단계

두 실행의 Container·Network는 제거한 뒤 해당 Project Label로 남은 개수 0을 재조회했다. 합성 Secret 파일도 제거했고 Image와 DB Volume은 보존했다. 보존한 Volume은 `week8-synthetic-72a4bbd88fff_postgres-data`·`week8-synthetic-d5e35a95e893_postgres-data`다. 기존 사용자 Container·Volume·Source는 삭제하지 않았다.

실제 AI·일반 Provider Configuration/Key·개인정보 탐지 모델·RDS TLS·Browser·Fargate는 이 실험에서 실행하지 않았다. AWS·DNS·IAM·Secret·원본 RDS도 변경하지 않았고 Push·원격 CI·ECR 업로드도 하지 않았다.

측정한 합성 구성은 이 자원 제한에서 동작했지만 향후 로컬 개인정보 모델을 포함한 사양을 확정하지 않는다. 전체 App 구성에 고의 Timeout·비정상 종료를 넣은 자원 실험도 별도로 남아 있다. 앞선 독립 Transport의 Linux 24개 중 Timeout/회수 Case와 이번 정상 종료 자원 결과를 같은 실험으로 합치지 않는다.

새 Log의 Cloud 확인과 실제 과금/보관량, 남은 DNS 비교·회귀·WIL도 이어간다. 실제 AI와 Cloud 변경은 승인한 실행 범위를 다시 확인한 뒤 진행한다.
