# 로컬 개인정보 검사 Process 실행과 회수 검증

> 실행일: 2026-10-19 KST
> Lab Commit: `0e3a49c` — `feat(privacy): bound local scanner process execution and cleanup`
> 결과: 핵심 Test 150개·전체 Java 754개 통과. 실제 Windows 자식 JVM·PostgreSQL·Loopback HTTP 사용

## 구현 범위

`ProcessAiPrivacyScanner`를 기존 `AiPrivacyScanner` Port 뒤에 추가했다. 관리자가 정한 절대 실행 파일·고정 인자 목록을 직접 실행하며, 제목·본문은 UTF-8 JSON으로 표준 입력에 전달한다. 원문을 인자·임시 파일·Log에 쓰지 않고 App 환경 변수도 복사하지 않는다.

입력·응답·표준 오류의 Byte 상한과 회수 예산을 명시적으로 받는다. 입력 쓰기·결과 읽기·오류 읽기·종료 대기를 네 보조 Thread에서 진행하며, 검사에는 하나의 시간 예산을 사용한다. 표준 오류는 크기를 제한해 버리고 출력 JSON과 합치지 않는다. 응답 전체·원문·Parser/OS 오류 Message와 Cause는 예외에 남기지 않는다.

응답을 끝까지 읽고 Exit Code 0과 시간 조건을 확인한 뒤 문자열을 반환한다. JSON·위치 검증과 마스킹은 기존 전처리기가 담당한다. 결과 검증기의 고정 `InvalidScanResultException`은 Transport도 만들 수 있도록 생성자만 공개했다. 필드·범위 검증 조건은 바꾸지 않았다.

Timeout·입출력 실패·호출 중단에서는 이번 호출의 `Process`를 강제 종료한 뒤 실제 종료·Stream 닫힘·보조 Thread 종료를 확인한다. Interrupt 표시는 회수 중 잠시 해제하고 호출자에게 복원한다. 회수 예산 안에 확인하지 못하면 고정 내부 오류를 던진다. 전체 Process 목록을 이름으로 찾아 종료하는 처리는 없다.

실제 모델·자동 Bean·실행 기본값·DB Migration·Job 재시도 정책은 추가하지 않았다. 기존 채택 보류 모델을 다시 선택하지 않았고 AWS·배포 Image·AI 활성화 설정도 변경하지 않았다. 선택과 후속 검토는 [실행 Transport 결정](../../plan/decisions/0005-local-privacy-process-transport.md)에 정리했다.

## 실제 Process Test

검사기 대신 Test 전용 자식 JVM이 합성 JSON·대기·잘못된 출력·비정상 종료를 만든다. 실제 OS Process와 Pipe를 사용하지만 한국어 탐지 정확도를 평가하는 모델은 아니다. Fixture는 PID와 시작 시각만 파일에 원자적으로 기록하며, 비상 정리도 두 값을 대조해 PID 재사용으로 다른 Process를 종료하지 않게 한다.

| 조건 | 확인한 결과 |
|---|---|
| 한글·이모지·따옴표·줄바꿈·Shell처럼 보이는 문자열 | 표준 입력의 제목·본문을 정확히 보존하고 지정 이메일 범위만 치환 |
| 완성된 빈 JSON·응답 Byte 경계 | 명시적 정상 결과만 반환하며 상한보다 1 Byte 많으면 거부 |
| 빈 응답·잘못된 UTF-8·출력 폭주 | `PRIVACY_SCAN_INVALID_RESULT`, 해당 Process·보조 Thread 종료 |
| 표준 오류 폭주·원문을 포함한 오류 출력·Exit Code 7 | 고정 실행 오류만 전달, Message/Cause·표준 오류 비출력 |
| 응답 없는 실행·입력을 읽지 않는 실행·JSON 출력 후 종료하지 않는 실행 | 2초 검사 예산에서 Timeout, 별도 회수 예산 3초, 호출은 7초 미만에 반환 |
| 호출 Thread 중단 | Interrupt 표시 보존, 해당 Process만 종료, 별도 실행 중인 다른 Fixture 유지 |
| 잘못된 실행 설정·입력 Byte 초과·이미 중단된 호출자 | 고정 오류로 거부하며 해당 검사 Process를 시작하지 않음 |

`ProcessAiPrivacyScannerTest` 24개가 통과했다. 회수 예산과 Byte 상한은 Test 설정이며 실제 모델의 배포 기본값으로 확정한 값은 아니다. Process 강제 종료를 OS가 수행하지 못하는 상황 자체를 만든 실험이나 Linux/Fargate 실행은 이번 검증에 포함하지 않는다.

## PostgreSQL 처리 흐름

기존 Pipeline Test에 실제 Process를 사용하는 다섯 Case를 추가했다. DB는 격리된 PostgreSQL 17.6 Testcontainer이고 외부 AI 역할은 로컬 HTTP 서버가 맡는다.

| 조건 | DB·전송 결과 |
|---|---|
| 정상 위치 JSON·Exit Code 0 | 실제 전송 Body의 이메일·알려진 민감 값 치환과 로그인 복구 사실 보존, 제안 1건·Job `SUCCEEDED`, Ticket `OPEN`·접수 원문 유지 |
| 끝나지 않는 Process | Process 종료 뒤 `FAILED`·`PRIVACY_SCAN_TIMEOUT`, 예약 1회 유지, 제안 0건·Provider 호출 0회·HTTP 전송 0회 |
| 잘못된 UTF-8 또는 출력 폭주 | `FAILED`·`PRIVACY_SCAN_INVALID_RESULT`, 원문·예약 유지, 제안·Provider/HTTP 전송 0건 |
| 정상 JSON을 출력한 Exit Code 7 | 기존 `ADAPTER_CONFIGURATION_ERROR`로 실패, 제안·Provider/HTTP 전송 0건·원문 유지 |

개인정보 실패 Case에서는 기존 검사 실패 저장·반복 Worker Polling의 자동 재시도 차단도 함께 확인했다. DB 실패 저장이 Rollback된 경우와 오래된 Attempt·Lease/기한 만료의 기존 Test도 재통과했다. 실제 상용 AI 요청은 0회다.

## 실행 결과

```powershell
.\mvnw.cmd -B -ntp "-Dtest=ProcessAiPrivacyScannerTest,AiScannedInputPreparerTest,AiPrivacyScanResultValidatorTest,AiPrivacyScanPipelineIntegrationTest,AiSuggestionWorkerConfigurationTest" test
.\mvnw.cmd -B -ntp test
```

- 핵심 5개 Class: 150개, 실패·오류·건너뜀 0. 17:39:21 KST 종료
- 최종 Source의 전체 Java: 60개 Class·754개, 실패·오류·건너뜀 0. 4분 38초, 17:44:59 KST 종료
- 새 실행 Test 24개·Pipeline 추가 5개가 전체 회귀에 포함된다. 기존 JVM 종료·재시작 Test 6개도 재통과했다.
- 첫 Test에서는 새 Fixture의 Guard 빈 설정 때문에 2개 오류가 났다. 합성 Guard 설정을 명시해 수정했고 운영 Guard의 필수 검증은 유지했다.
- Lab 변경 파일 7개는 UTF-8 무BOM·LF이며 `git diff --check`를 통과했다.

## 다음 연결

실제 모델의 탐지 품질·문맥/관계 보존 계약과 실행 설정을 정한 뒤 이 Transport에 연결한다. Linux Container에서 Process 종료와 모델·JVM·Worker를 합친 CPU/Peak 메모리를 확인하고 Main Bean을 조립한다. 이후 별도 승인한 Cloud 실행으로 이어간다. Process 실행 Test의 성공을 탐지 정확도나 실제 AI 배포 완료로 바꾸어 기록하지 않는다.

개념은 [개인정보 학습자료](../study-docs/privacy-detection-and-minimal-masking.md#로컬-검사-process의-실행과-회수), 문답은 [10월 19일 학습노트](../study-notes/2026-10-19-study-questions.md)에 연결한다.
