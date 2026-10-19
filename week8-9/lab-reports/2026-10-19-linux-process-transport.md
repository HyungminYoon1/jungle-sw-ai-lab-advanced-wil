# Linux에서 검증한 Process 실행과 자원 회수

> 실행일: 2026-10-19 KST
> Lab Commit: `cf4b732`
> 결과: Linux의 같은 24개 Test를 CPU 1개·0.25개에서 각각 통과. 관련 Windows Java 63개·JavaScript 전체 268개 통과

## 배포에 앞서 확인한 것

Windows에서 통과한 코드가 Linux에서도 Process를 실행하고 회수하는지 확인했다. 인물 관계 V2와 모델 정확도 고도화는 [후속 과업으로 분리](../../plan/decisions/0009-deployment-first-and-deferred-privacy-enhancement.md)하고, 기존 `ProcessAiPrivacyScannerTest` 24개를 그대로 재실행했다. 실제 검사 응답은 합성 Fixture가 만들며 새로운 탐지 모델을 채택하지 않았다.

정상 완료·Exit Code 7·출력 초과/빈 응답·잘못된 UTF-8, 입력을 읽지 않는 실행과 유효 JSON 뒤에도 종료하지 않는 실행을 확인했다. Timeout·호출 Thread 중단 뒤 해당 Process와 Pipe·보조 Thread가 정리되는지, 별도로 실행한 다른 Process는 살아 있는지도 검사했다.

## 실행 구성

Lab의 `scripts/Verify-Week8LinuxProcessTransport.ps1`이 현재 Main/Test Class를 컴파일하고 공개 Test 의존성만 별도 디렉터리에 모은다. `junit-platform-launcher` 6.1.3은 Test Scope이며 실행용 App 의존성이나 Main Bean을 늘리지 않는다. Test 전용 `LinuxProcessTransportSuite`는 지정한 한 Class만 선택한다.

Host는 PowerShell 7.6.7, Docker Desktop의 Linux Engine 29.8.0이다. 기존 `helpdesk:week8-rds-tls-preflight` Image에서는 Java Runtime만 사용한다. Runtime Image ID는 `sha256:0573744e77424fc51f10432315cb99f1938b27e2025efcebeede93186c4a42c8`이며 ECR Manifest Digest로 기록하지 않는다.

현재 `target/classes`·`target/test-classes`·Test JAR 세 디렉터리를 읽기 전용으로 Mount하고 새 컴파일 Class를 실행했다. 기존 Image의 App JAR를 실행하거나 새 배포 Image를 Build한 것이 아니다. Mount 실행의 통과와 Image에 새 Code가 포함됐다는 확인은 별개다.

Container는 비Root `10001:10001`, 읽기 전용 파일 시스템·Network 없음·Capability 제거·추가 권한 차단·PID 128개 제한이다. Memory 한도와 Memory+Swap 합계 한도를 모두 512 MiB로 두어 추가 Swap을 허용하지 않고 실제 Docker 설정을 대조했다. Host Credential·환경 변수·Docker Socket·DB를 연결하지 않았다. 임시 쓰기는 `/tmp`의 32 MiB tmpfs에 제한했다.

## 실제 결과

| CPU 상한 | Test 성공 | 실패·중단·건너뜀 | Container 실행 시간 | Exit Code | OOM Kill |
|---|---:|---:|---:|---:|---|
| 1개 | 24/24 | 모두 0 | 28.988초 | 0 | 없음 |
| 0.25개 | 24/24 | 모두 0 | 42.016초 | 0 | 없음 |

위 시간은 JVM 기동과 24개 Test 전체, 의도적인 Timeout 대기를 포함한다. 개인정보 검사 1회나 AI 생성 시간, 순수 CPU 벤치마크의 수치가 아니다. 같은 Test를 두 환경에서 반복한 것이므로 서로 다른 48개 Test로 세지 않는다.

첫 실행 결과는 22:08:59에 기록했고 개발 중 Worktree였다. 기능 Commit 뒤 22:11:59에 기록한 0.25 CPU 실행은 `cf4b732`의 깨끗한 Worktree다. 두 실행의 Transport Source SHA-256은 `da9bc31412209b2a11180b8001a9ecf8dbd63df1f770f3e46ebfa59cbe1678f6`로 같았다. 각 실행의 Container는 정확한 생성 ID로 제거했고, 실험 Label로 재조회했을 때 남은 Container도 없었다. 기존 Image와 Volume은 유지했다.

Windows에서는 기존 Process 24개·Preparer 13개·Worker 설정 8개·Provider 설정 18개를 재실행해 63개가 실패·오류·건너뜀 없이 통과했다. Surefire XML의 네 Class 결과도 대조했다. JavaScript 전체 268개에는 새 Script Source 보호 Test 6개가 포함된다. 변경한 JS 파일의 ESLint와 PowerShell 문법 검사도 통과했다. 초기 Lint의 누락된 `URL` Import는 수정 후 다시 확인했다.

이 실행은 Spring App·Worker·실제 모델·PostgreSQL·AI를 시작하지 않았다. 따라서 전체 App이 0.25 CPU·512 MiB에서 충분히 동작한다거나 실제 개인정보를 정확히 탐지한다는 결과로 쓰지 않는다. 기존 전체 Java 754개와 앞선 V2 핵심 439개는 각각 당시 기록이며 이번 63개로 대체하지 않는다.

## 재현 명령

Lab Repository에서 기존 로컬 Runtime Image가 있는 상태로 실행한다.

```powershell
.\scripts\Verify-Week8LinuxProcessTransport.ps1
.\scripts\Verify-Week8LinuxProcessTransport.ps1 -CpuLimit 0.25
```

안전한 결과 JSON은 `target/week8-linux-process-*/results.json`에 남긴다. 테스트 결과의 개수·실패 타입·Exit Code·OOM·정리 여부만 기록하고 원문·환경 변수·Assertion 내용·예외 메시지는 출력하지 않는다. 의존성 준비를 위해 Maven은 공개 Artifact를 받을 수 있지만 실제 Linux Test Container의 Network는 차단한다.

기본 외부 시간 상한은 120초다. 중단 시 이번 실행이 만든 정확한 Container ID만 종료·제거하며 다른 Container·Image·Volume을 정리하지 않는다. 테스트용 Class Mount와 JUnit Launcher는 실행용 Image의 기본 진입점이 아니다.

## 다음 배포 단계

고정 합성 입력만 허용하는 실행 구성과 필수 설정 누락·기본 비활성 조건을 확인한다. V1 검증·Guard·실패 차단·원문/예약/실행권 보존을 유지한 전체 조립과 자원을 검증한 뒤 새 Image·CI·Cloud 실행 범위를 확인한다. 이번 작업에서는 AWS·DNS·IAM·RDS·Secret을 변경하거나 유료 AI·Push·원격 CI·ECR 업로드를 실행하지 않았다.
