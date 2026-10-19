# 고정 합성 입력의 배포 실행 구성 검증

> 실행일: 2026-10-19 KST
> Lab Commit: `9f2074b`
> 결과: 새 Unit 41개·패키징 후 PostgreSQL 2개 통과. 전체 Java `verify` 1,004개 + 패키징 후 2개, JavaScript 268개 통과

## 목적과 변경 범위

[배포 우선 결정](../../plan/decisions/0009-deployment-first-and-deferred-privacy-enhancement.md)에 따라 V2나 실제 탐지 모델을 추가 연결하지 않고, 고정 합성 문의의 실행 구성을 만들었다. [구성 결정](../../plan/decisions/0010-fixed-synthetic-deployment-configuration.md)에는 허용 입력·실패 코드·원문/예약 보존·별도 활성화를 기록했다.

Main의 `SyntheticDeploymentPrivacyConfiguration`은 `postgres,deployment,synthetic-ai`와 별도 활성 Property를 함께 요구한다. JAR 절대 경로와 검사/회수 시간도 필수다. Provider·Worker는 기존 독립 활성 설정을 유지하므로 개인정보 Bean 등록 자체가 외부 요청이나 Polling을 시작하지 않는다.

제목·본문 전체가 고정한 합성 문의와 정확히 일치해야 한다. 범위 밖 입력은 Process 시작 전에 거부하고 자식에서도 같은 조건을 재검사한다. 자식은 같은 Boot JAR의 전용 Java Main으로 고정 합성 이메일 위치 한 건만 반환한다. 실제 NER 모델이나 빈 정상 검사의 일반 입력 우회는 추가하지 않았다.

업무 Controller·Service·Job 정책·기존 V1/V2 구현·DB Migration은 변경하지 않았다. 실제 설정·Secret·AWS·IAM·DNS·RDS·ECR도 변경하지 않았다.

## 실제 실행 구성

- Host: Windows·PowerShell 7.6.7·Java 25.0.4, Spring Boot 4.1.1
- DB: 새 Linux PostgreSQL 17.6 Testcontainer. 기존 DB가 아님을 JDBC URL로 확인한 뒤 해당 Test DB만 정리
- 개인정보 Bean: Main의 조건부 구성과 V1 Preparer·Validator·Guard
- 검사 Process: 패키징한 Boot JAR의 실제 자식 JVM. 이 실행의 부모·자식 JVM은 Windows이며 새 Linux Image 실행은 아님
- AI Adapter: 실제 Spring AI/OpenAI Adapter를 Loopback HTTP 서버에 연결. Key는 임시 합성 값이며 실제 AI를 호출하지 않음
- Worker: Main Processor·Worker의 명시적 `runOnce()`. 자동 Scheduler는 끔

현재 JAR 안의 검사 프로그램·입력 제한 Class가 현재 컴파일 Class와 같은 Byte인지 Test에서 대조했다. 전체 JAR SHA-256은 `01d9325851465034903b6338fc67e436b7d68112e70fd1b52aa01089b3a07427`이다. 이는 이 로컬 JAR의 식별자이며 ECR Manifest Digest나 Cloud 실행 증거가 아니다.

## 확인한 결과

| Case | 실행과 전송 | PostgreSQL 결과 |
|---|---|---|
| 허용한 합성 문의 | 실제 자식 Process·V1 마스킹, Provider 메서드 1회·Loopback HTTP 1회. 제목과 복구 사실은 그대로이며 이메일만 `[EMAIL_REDACTED]`로 바뀐 Body 도착 | Job `SUCCEEDED`, 제안 1건. Ticket `OPEN`, 원문·작성자·Attempt/예약 1회·예약 Row 1건 유지 |
| 허용 목록 밖 문장 추가 | 입력 제한으로 거부. Provider 메서드 0회·HTTP 0회 | Job `FAILED`·`ADAPTER_CONFIGURATION_ERROR`, 제안 0건. 원문·작성자·Ticket `OPEN`·Attempt/예약 1회·예약 Row 1건 유지 |
| 거부 뒤 반복 Tick | 3회 모두 `NO_JOB`, 추가 Provider/HTTP 0회 | 같은 접수·예약 유지. 임의 횟수 초기화나 자동 재호출 없음 |

Unit Test는 Profile·활성 값 누락, 상대/존재하지 않는/손상된/필수 Class 없는 JAR, 시간 값 누락·잘못된 값·상한 초과와 고정 오류를 검사한다. 제목·본문·공백·연락처·복구 사실 변경, 잘못된 UTF-8·응답 계약 밖 요청도 거부한다. 자식 결과는 한 건의 V1 위치 정보이고 원문을 반환하지 않는다.

## 검증 명령과 결과

Lab Repository에서 Docker Engine이 실행 중인 상태로 실행했다.

```powershell
.\mvnw.cmd -B -ntp verify
node --test src/test/js/*.test.mjs
```

`verify`는 일반 Surefire Test 1,004개·65 Class와 패키징 후 Failsafe Test 2개·1 Class를 통과했다. 실패·오류·건너뜀은 모두 0건이다. 22:33:52에 종료했고 전체 시간은 4분 51초였다. 이 시간은 전체 검증 시간이며 개인정보 검사 한 번의 실행 시간으로 사용하지 않는다. 두 보고서 디렉터리의 이번 실행 XML 개수도 대조했다.

마지막 Review에서 Provider 메서드 호출 횟수를 HTTP 횟수와 별도로 세는 Assertion을 추가했다. Main 변경 없이 다음 명령으로 최신 통합 Test 2개를 다시 통과했고, 22:35:28 종료·실패/오류/건너뜀 0건이었다. 새 고유 Test가 두 개 더 늘어난 것이 아니라 같은 두 Case의 재검증이다.

```powershell
.\mvnw.cmd -B -ntp test-compile failsafe:integration-test failsafe:verify
```

JavaScript 전체 268개도 실패·취소·건너뜀 없이 통과했다. 변경 JS는 없으며 새 ESLint 실행 결과를 주장하지 않는다. 새 Source는 UTF-8 without BOM·LF이고 변경 Diff의 공백 오류는 없었다. 검증 후 구현·사용 안내를 같은 목적의 Lab Commit으로 묶었다.

Failsafe는 현재 JAR의 패키징 뒤 동작하도록 Maven에 연결했다. 기존 Actions의 `mvn verify`도 이 검사를 포함하지만 이번에는 Push·원격 CI·Image Build·ECR 업로드를 실행하지 않았다.

## 아직 확인하지 않은 것

새 Image에서의 Linux 실행, Provider Bean·Secret·자동 Scheduler를 포함한 전체 자동 조립과 Container CPU/메모리 현재값·Peak는 남아 있다. 자식 `-Xmx64m`은 자식 Heap 상한이지 App 전체 메모리 한도가 아니다.

실제 AI·일반 개인정보 탐지 정확도·Browser E2E·Cloud Log·누적 비용/보관량·남은 DNS 비교도 이번 Test에 포함하지 않았다. V2·모델 고도화는 후속으로 유지하고, 배포의 다음 선행 단계는 새 Image의 전체 실행과 자원 검증이다.
