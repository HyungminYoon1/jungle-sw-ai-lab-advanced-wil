# ADR-0005 로컬 개인정보 검사 Process의 실행과 종료

> 상태: Accepted — 로컬 Transport 구현·Test 완료. 실제 탐지 모델·실행 설정·Main Bean 조립은 별도 진행
> 결정일: 2026-10-19
> 결정 근거: 검사 요청에서 직접 시작한 Process만 종료한다는 문답과 이어서 구현·학습을 진행하라는 요청

## Context

`AiPrivacyScanner` Port와 결과 검증·마스킹, 실패 저장 경계는 있지만 실제 실행을 제한하는 Transport가 필요하다. 검사 함수가 반환한 뒤 시간을 비교하는 것만으로는 끝나지 않는 검사를 중단할 수 없다. Timeout을 반환하고 검사 Process나 I/O Thread를 남기면 App의 자원을 계속 사용한다.

한국어 탐지 후보의 품질 검토는 진행 중이다. 실행 제어를 먼저 검증하되 통제한 결과를 내는 Test 프로그램을 배포용 검사기로 등록하거나, 기존 채택 보류 모델을 자동 선택하지 않는다.

## 검토한 선택지

| 선택지 | 장점 | 문제 |
|---|---|---|
| 호출 Thread의 대기만 취소 | 구현이 작음 | 실제 검사 실행·자원 회수를 확인하지 못함 |
| 별도 HTTP 검사 서비스 | 실행 환경 분리 가능 | 새 서비스의 인증·Network·운영·비용 관리가 필요 |
| 기존 Port 뒤에 단일 로컬 Process Transport 추가 | 현재 계층과 실패 정책을 유지하고 실행 대상을 직접 관리 | 모델 Runtime·전체 자원 검증과 실행 파일 관리 필요 |

## Final Decision

Lab에 `ProcessAiPrivacyScanner`를 추가한다. 자동 Bean·설정 기본값·모델 설치·AWS 변경 없이 명시적으로 생성하는 Transport다. 관리자가 고정한 절대 실행 파일과 인자 목록을 `ProcessBuilder`에 직접 전달하며 Shell을 끼워 넣거나 문의로 명령을 만들지 않는다. 프로그램은 자식 Process를 만들거나 Daemon으로 분리되지 않는 단일 전경 실행을 전제로 한다.

제목·본문은 UTF-8 JSON의 `title`·`body`로 표준 입력에만 전달한다. 원문을 인자·파일·Log에 넣지 않는다. App의 환경 변수는 복사하지 않는다. 표준 출력은 제한된 결과, 표준 오류는 별도로 제한해 버리는 통로다. Parser·OS·I/O 오류의 Message/Cause나 전체 응답을 예외에 포함하지 않는다.

입력·응답·표준 오류의 Byte 상한과 종료 확인 시간은 명시적으로 전달한다. 입력 직렬화·쓰기·읽기·종료 대기는 한 단조 시간 예산을 공유한다. 네 개의 보조 Thread가 각각 쓰기·두 Stream 읽기·종료 대기를 수행하며, 하나의 실패나 Timeout이면 나머지 작업도 정리한다. 정상 결과는 응답을 끝까지 읽고 Exit Code 0·시간 조건을 만족한 뒤에만 반환한다.

중단할 대상은 이번 호출이 만든 `Process`다. 이름으로 전체 Python/Java Process를 찾거나 종료하지 않는다. 강제 종료 요청 뒤 실제 종료·Stream 닫힘·보조 Thread 종료를 확인한다. 별도 회수 예산 안에 확인하지 못하면 `AI_PRIVACY_PROCESS_CLEANUP_UNCONFIRMED`로 거부하고 성공으로 기록하지 않는다. 호출 Thread의 Interrupt 상태는 보존한다.

실제 실행 시간 초과는 기존 `PRIVACY_SCAN_TIMEOUT`, 응답 Byte 초과·빈 응답·잘못된 UTF-8은 기존 `PRIVACY_SCAN_INVALID_RESULT`로 전달한다. 시작 실패·비정상 종료·예상 밖의 I/O와 정리 오류는 기존 Processor의 `ADAPTER_CONFIGURATION_ERROR` 경로를 따른다. 새 Job 코드·DB Migration·재시도 정책은 추가하지 않는다. JSON·위치 검증과 치환은 기존 전처리기에 남긴다.

## Rationale

대기 취소와 실제 실행 종료를 구분하면서 Worker·Service·Repository의 책임을 바꾸지 않는다. 모델 선택과 무관하게 실행 제어·전송 차단·원문 보존을 검증할 수 있다. 이름 탐지·관계 보존의 JSON 계약이나 실제 모델 품질을 이 Transport의 성공으로 대신하지 않는다.

## Affected Files

- Lab Main: `ProcessAiPrivacyScanner.java`, `AiPrivacyScanResultValidator.InvalidScanResultException` 생성자의 공개 범위
- Lab Test: 실제 자식 JVM Fixture·실행 지원 코드, `ProcessAiPrivacyScannerTest`, `AiPrivacyScanPipelineIntegrationTest`
- Lab 안내: `README.md`의 실행 제한·검증 범위
- WIL: 개인정보 학습자료·10월 19일 학습노트·검증 보고서·주간 계획

## Validation과 Follow-up Review

Lab `0e3a49c`에서 실제 Windows 자식 JVM Test 24개·PostgreSQL Pipeline 20개를 포함한 핵심 150개와 전체 Java 754개가 통과했다. 정상 전송은 Loopback HTTP로 확인했으며 실제 탐지 모델·외부 AI는 사용하지 않았다. Test의 비상 정리도 PID와 시작 시각을 대조해 다른 Process를 종료하지 않는다.

이 Transport는 보안 Sandbox나 CPU·메모리·Network 격리가 아니다. Process 생성·OS 종료는 강제 실시간 보장이 아니며, 종료 확인 실패를 성공으로 바꾸지 않는다. 실제 모델의 자식 실행 여부·라이선스·무결성·탐지 품질·관계 보존과 실행 설정을 검토하고, Linux Container의 종료·전체 AI 자원을 측정한 뒤 Main 조립을 진행한다. Test의 Byte·시간 설정을 그대로 배포 기본값으로 확정하지 않는다.
