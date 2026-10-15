# 개인정보 검사 실패의 DB 저장과 조회 계약

> 실행일: 2026-10-15
> 상태: 로컬 실패 저장·JSON·치환 검증 및 통제된 검사 응답의 Processor 연결 확인. 후속 실제 NER 평가에서 후보 채택 보류. 실행 Adapter·AWS 배포는 별도 단계

## 이번 구현 범위

기존 [개인정보 검사 실패 계약](../study-docs/privacy-detection-and-minimal-masking.md#검사-실패를-job에-기록한다)의 두 코드 `PRIVACY_SCAN_TIMEOUT`·`PRIVACY_SCAN_INVALID_RESULT`를 DB와 조회 화면에서 다룰 수 있도록 연결했다.

검사 모델을 선택하거나 실행한 것은 아니다. 검사 실패를 확인한 호출부가 사용할 저장 경계를 구현하고, 실제 PostgreSQL의 상태와 읽기 전용 조회·Worker 동작을 확인했다. Processor의 검사 호출·실패 분류와 Main의 배포용 검사기 조립은 후속 단계다.

## 구현 결정

### 별도 코드와 새 Migration

- **배경:** 검사 실패를 Provider Timeout이나 `ABSTAINED`로 저장하면 실패 단계가 달라진다. Java Enum만 늘리면 DB의 CHECK가 저장을 거부하거나 UI가 알려지지 않은 응답으로 판단한다.
- **검토한 안:** 기존 코드에 합치기, 기존 Migration 수정, 전용 코드 두 개와 새 Migration 추가.
- **결정:** Java와 UI의 허용값을 함께 늘리고 Flyway V8로 기존 CHECK의 허용값만 확장한다. V1~V7과 기존 Row·예약·정책 Snapshot·제안은 유지한다.
- **영향 파일:** Lab의 `AiJobFailureCode.java`, `V8__allow_privacy_scan_failures.sql`, `ai-suggestion-ui.mjs`와 관련 Test.
- **후속 검토:** 새 코드가 저장된 뒤에는 과거 Image의 Enum·UI가 이를 모를 수 있다. 실제 배포와 Rollback 전에 두 코드를 읽을 수 있는 정상 Image 기준선을 준비한다. RDS에는 아직 적용하지 않았다.

### 실패 기록은 하나의 짧은 Transaction

- **배경:** 자동 재시도 차단과 최종 실패를 별도 Commit하면 일부만 저장될 수 있다.
- **검토한 안:** Job 상태만 변경, 두 변경을 별도 저장, 같은 독립 Transaction에서 저장.
- **결정:** `failPrivacyScanIfCurrent()`에서 현재 Attempt를 확인하고 `AUTO_RETRY_BLOCKED`와 `FAILED`·고정 코드를 함께 저장한다. 일반 `failIfCurrent()`에 두 코드를 전달해도 같은 경로를 사용한다.
- **근거:** 늦은 Attempt나 완료된 Job을 바꾸지 않으며, DB 오류 또는 조건부 실패 시 부분 변경을 남기지 않는다. 이미 Commit한 접수와 예약 횟수는 삭제·초기화하지 않는다.
- **영향 파일:** Lab의 `AiSuggestionJobClaimService.java`와 새 PostgreSQL Test.
- **후속 검토:** 실제 검사 호출부에서 확인한 실패만 이 경계에 전달해야 한다. 실패 기록의 Commit을 확인하지 못했다면 최종 `FAILED` 저장 성공으로 취급하지 않는다.

## 검증 환경과 결과

Docker Desktop의 Linux Engine과 PostgreSQL `17.6-alpine` Testcontainer를 사용했다. Test 데이터 정리는 JDBC URL이 해당 Testcontainer와 일치하는지 확인한 뒤 그 DB에서만 수행했다. AWS RDS·실제 고객 데이터는 사용하지 않았다.

| 검증 | 결과 |
|---|---|
| 새 실패 저장 Integration Test | 8개 통과 |
| 새 V7 → V8 Migration Test | 1개 통과 |
| 관련 조회 Service·HTTP Test 포함 Focused Java | 총 65개 통과, 실패·오류·건너뜀 0 |
| Java 전체 Clean Test | 589개 통과, 실패·오류·건너뜀 0 |
| AI 조회 UI Unit Test | 29개 통과, 실패·건너뜀 0 |
| JavaScript 전체 | 232개 통과, 실패·건너뜀 0 |
| 변경 UI·Test ESLint | 통과 |

Focused 실행 뒤 `mvnw.cmd -B -ntp clean test`로 전체 Java 회귀를 별도로 실행했다. 총 4분 32초에 `BUILD SUCCESS`를 확인했다. 실제 PostgreSQL·Process 재시작을 포함한 기존 Test를 유지했고, 건너뛴 Test는 없다.

실행 명령은 Lab README의 ‘개인정보 검사 실패의 저장과 조회’ 절에 있다.

### 실제 PostgreSQL에서 확인한 것

- 두 코드 각각의 `FAILED`·고정 코드와 Attempt의 `AUTO_RETRY_BLOCKED` 저장.
- Ticket `OPEN`, 접수한 Message와 작성자 보존, Suggestion 0건, 생성 요청 예약 1건 유지.
- 실패 뒤 Worker Tick 세 번과 AGENT 조회 세 번에서 Provider Test Double 호출 0회, 여섯 Table의 비교 Digest 무변경.
- 익명 조회 `401`, USER 조회 `403`, AGENT 조회 `200`·`FAILED`·실패 코드·`suggestion=null`.
- 이전 Attempt의 실패·반복 실패·완료 후 늦은 실패가 기존 상태를 덮어쓰지 않음.
- Test 전용 CHECK로 두 번째 DB 쓰기를 거부했을 때 첫 Attempt 변경도 Rollback됨. 접수와 기존 예약은 유지됨.
- V7에서 만든 여섯 Table의 Row를 유지한 V8 적용, 두 코드의 허용과 알 수 없는 코드의 거부, Flyway Checksum 검증.

조회의 인증 주체는 Spring Security Test의 사용자 Fixture다. 실제 Browser 로그인·Cookie 교환을 확인한 Test는 아니다. JavaScript는 응답·DOM Test Double로 실패 표시와 이전 제안 제거, GET 한 건만 전송하는 동작을 확인했다.

## 아직 확인하지 않은 것

- 배포용 개인정보 탐지 모델의 채택·Job별 Timeout. 후속 1차 후보의 실제 탐지·CPU 관찰은 [별도 모델 실험 보고서](./2026-10-15-korean-privacy-ner-probe.md)에 기록한다.
- 실제 로컬 검사 실행 Adapter의 시간·응답 읽기 상한·자원 회수와 Main Bean 구성.
- 실제 탐지 모델을 사용한 전송 직전 Body·실행 자원 검증. 통제 응답과 실제 Adapter의 로컬 HTTP 전송은 아래 후속 절에서 확인한다.
- 새 Image·ECR·ECS 배포와 RDS의 V8 Migration.
- Cloud의 전체 AI 수직 흐름·실제 Browser·자원·중단 복구 검증.

Main의 Provider·Worker 활성화 설정은 바꾸지 않았고, API Key를 읽거나 외부 AI를 호출하지 않았다. 이번 과업에서는 AWS의 App·RDS·DNS·IAM·ALB도 변경하지 않았다. 앞선 [301 Redirect 실습](./2026-10-15-alb-http-https-redirect.md)과 실행 범위를 구분한다.

## 후속: 완료 표시와 JSON 검증

### 계약과 구현 결정

- **배경:** 빈 위치 목록만으로 검사 완료·미완료를 구분할 수 없다. 사용자는 완료된 탐지 0건도 개인정보 부재를 보장하지 않는다는 점을 확인했다.
- **검토한 안:** 빈 목록을 무조건 허용, 실패 시 빈 목록으로 대체, 완료 표시와 위치 목록을 함께 엄격히 검증.
- **결정:** `{completed, spans}`만 허용하고 `completed`가 Boolean `true`인 결과만 위치 검증·치환으로 전달한다. 미완료 응답은 고정된 Invalid Result로 거부하며, Timeout은 실행부가 실제 시간 초과를 확인했을 때만 분류한다.
- **근거:** 미완료·형식 위반을 탐지 0건으로 바꾸거나 Timeout으로 추측하지 않는다. 잘못된 항목만 버리고 일부 결과를 전송하지 않는다.
- **영향 파일:** Lab의 새 `AiPrivacyScanResultValidator.java`·Test와 README, 개인정보 학습자료.
- **후속 검토:** 실제 검사기의 완료 판정·입력 일치·응답 읽기 제한·Processor의 typed 예외 분류를 연결해야 한다. 모델이 정확하게 탐지했는지는 별도로 평가한다.

응답 UTF-8 Byte·항목 수 상한은 생성자의 필수 양수로 두고 실행 기본값을 정하지 않았다. JSON 중첩은 계약의 세 Container 단계로 제한한다. 항목 수는 중복 제거 전에 확인한다. 검사 결과의 타입을 자동 보정하거나 필드의 누락을 채우지 않는다.

### 추가 검증

```powershell
.\mvnw.cmd -B -ntp "-Dtest=AiPrivacyScanResultValidatorTest,AiInputSpanMaskerTest,AiInputPrivacyGuardTest" test
```

새 검증기 84개와 기존 범위 치환 47개·Guard 32개, 총 163개가 실패·오류·건너뜀 없이 통과했다. 완료된 빈 결과·미완료 응답·필드 누락/추가/중복·정수 자동 변환 거부·원문 Code Point 위치·중복과 겹침·응답 크기·항목 수·고정 예외를 확인했다. 전체 Maven Source·Test Compile도 성공했다.

이 단계에서는 전체 Java·DB 회귀를 다시 실행하지 않았고 163개의 Focused 실행으로 구분했다. 이후 Processor 연결 뒤의 회귀는 다음 절에 별도로 기록한다. 실제 검사 모델·외부 Provider·Browser·AWS는 실행하지 않았다.

## 후속: 검사 전처리와 Processor 연결

### 구현 결정

- **배경:** JSON 함수의 예외만으로 DB 실패 저장·전송 중단·현재 실행권 유지를 증명할 수 없다.
- **검토한 안:** Processor에서 JSON과 치환을 모두 직접 처리, 기존 Guard만 있으면 스캔을 생략, 별도 검사 전처리기를 필수 주입.
- **결정:** `AiPrivacyScanner` Port와 `AiScannedInputPreparer`를 추가하고 Processor·Worker 설정이 전처리기를 필수로 받도록 변경했다. 원문 검사 → JSON·범위 검증/치환 → 알려진 문자열 Guard 순서다. Main에 빈 검사기나 Fixture Bean은 추가하지 않았다.
- **근거:** 검증·치환 책임을 입력 경계에 두고, 기존 Provider의 직렬화 Body 검사·접수 Transaction·출력 검증·저장 경계는 유지한다. 검사 결과를 원문에 잘못된 순서로 적용하지 않는다.
- **영향 파일:** 두 새 입력 클래스, Processor·Worker 설정, 관련 Test의 명시적 조립, README·학습자료.
- **후속 검토:** 실제 로컬 탐지 Adapter·Main Bean·실행 상한을 측정·검증한 뒤 유료 Provider를 활성화한다.

전처리기는 설정한 검사 시간과 Job의 남은 시간 중 작은 값을 검사기에 전달하고, 반환 후 단조 시간으로 늦은 응답을 거부한다. 이 검사로 돌아오지 않는 호출을 강제로 중단했다고 주장하지 않는다. Adapter의 제한 시간 준수·응답 읽기 상한·자원 회수는 후속 구현 대상이다.

Processor는 typed Timeout·Invalid Result만 각각의 개인정보 코드로 저장한다. 예상하지 않은 구현 오류를 Privacy Timeout으로 추측하지 않고 기존 Adapter 오류와 구분한다. 검사 이후 Provider 예산을 다시 계산하고 현재 Attempt·Lease를 확인한다. 검사 대기에는 DB Transaction·Row Lock을 두지 않는다. 실패 기록 Commit이 실패하면 고정 오류 `AI_PRIVACY_FAILURE_RECORD_FAILED`로 전달하고 최종 `FAILED` 저장 성공으로 반환하지 않는다.

### 검증 범위

검사기 응답은 Test Double이고 Provider HTTP 응답도 합성 고정값이다. 반면 Processor·현재 실행권 검사·실패 기록·PostgreSQL·Spring AI·단일 전송 HTTP Client는 실제 코드를 사용했다. HTTP는 리터럴 Loopback으로만 전송하며, 실제 API Key나 외부 AI를 사용하지 않았다.

- 원문 Code Point 위치로 개인정보를 가리고 로그인 복구 사실을 보존한 실제 HTTP 요청과 검토 대기 제안 저장.
- 미완료·잘못된 JSON/타입/위치·중복 필드·추가 필드와 검사 Timeout을 모사한 typed 예외에서 전송 0회·실패 저장·원문/예약 유지.
- 실패 뒤 Worker Tick 세 번에서 재검사·Provider 호출·HTTP 전송 없음.
- 실패 기록의 두 번째 쓰기가 거부되면 첫 Attempt 변경도 Rollback되고, Processor가 `FAILED` 성공을 반환하지 않음.
- 검사 중 새 Attempt가 생기면 이전 실행의 실패 기록과 전송을 모두 거부. Lease·전체 기한 만료에도 전송하지 않음.
- 검사 후 Provider의 남은 시간 재계산. 시간 경계는 Test Clock으로 제어한 것이며 실제 CPU 실행시간 측정과 구분.
- 검사 시 별도 Transaction에서 동일 Job에 `FOR UPDATE NOWAIT` 성공: 실행권 예약은 Commit됐고 Lock을 유지하지 않음.
- Worker 활성화에 기존 Guard만 제공하면 조립 실패. 빈 검사기로 대체하지 않음.

기존 테스트와 합성 Experiment의 생성자 조립은 Test 전용 `AiPrivacyScanFixtures`로 명시적으로 바꿨다. 고정 완료 응답을 반환하는 Fixture일 뿐 실제 탐지기가 아니며, Main에는 등록하지 않았다.

### 최종 회귀 결과

| 검증 | 결과 |
|---|---|
| 새 검사 전처리기 Unit Test | 12개 통과 |
| 새 Processor·PostgreSQL·로컬 HTTP Pipeline Test | 15개 통과 |
| Worker 설정 Test | 8개 통과. 검사 전처리기 누락 시 조립 실패 포함 |
| 전체 Java Clean Test | 701개 통과, 실패·오류·건너뜀 0 |
| 전체 JavaScript Test | 232개 통과, 실패·취소·건너뜀 0 |
| Diff·UTF-8 no BOM·LF 검사 | 통과 |

첫 Focused 실행 126개가 통과한 뒤 Provider의 잔여 시간 재계산 Case와 호출 계수 검증을 추가하고 전체 회귀를 실행했다. 최종 `mvnw.cmd -B -ntp clean test`는 7분 25초에 `BUILD SUCCESS`로 종료했다. 실제 JVM Process 재시작 Test 5개와 기존 문의 접수·인증·CSRF·DB 회귀도 통과했다. V1~V7은 수정하지 않았다.

검사 대기 중 Transaction·Row Lock을 유지하지 않는 원칙을 PostgreSQL 검증 지침에 따라 확인했다. 실제 탐지 모델의 정확도·CPU·강제 Timeout은 검증하지 않았다. Main의 실제 검사 Adapter·Bean 조립, 새로운 Image·CI·Cloud의 전체 AI 흐름은 남아 있다. 이 후속 구현에서도 AWS 설정·실행 Image·RDS와 실제 API Key는 건드리지 않았으며 외부 AI 호출·Commit·Push를 하지 않았다.

## 실제 탐지 모델의 1차 후보 검토

후보 검토 시점에는 모델을 설치·실행하지 않았다. 실제 고객 원문·API Key를 읽거나 외부 추론 API를 호출하지 않았다. 당시 기본 Python에는 spaCy·PyTorch·Transformers·ONNX Runtime·Presidio Analyzer가 설치되지 않은 것을 확인했으며, 전역 Python에 설치하거나 다른 프로젝트의 모델 환경을 변경하지 않았다.

1차 로컬 실험 후보는 spaCy `ko_core_news_sm` 3.8.0이다. [개발사 Release](https://github.com/explosion/spacy-models/releases/tag/ko_core_news_sm-3.8.0)는 CPU용 한국어 Pipeline·모델 크기 13 MB·`CC BY-SA 4.0`을 명시한다. [개발사 Metadata](https://raw.githubusercontent.com/explosion/spacy-models/master/meta/ko_core_news_sm-3.8.0.json)의 NER Label은 `DT`·`LC`·`OG`·`PS`·`QT`·`TI`다. 이 목록을 이메일·전화번호·비밀번호 전용 탐지로 해석하지 않는다. 파일 크기도 실행 메모리 상한으로 해석하지 않는다.

다른 후보도 Model Card를 확인했다. [KoELECTRA-small](https://huggingface.co/Leo97/KoELECTRA-small-v3-modu-ner)은 한국어 NER 후보이나 확인한 Card에서 배포 라이선스를 식별하지 못했으므로 추가 확인 전 채택하지 않는다. [GLiNER PII](https://huggingface.co/urchade/gliner_multi_pii-v1)는 Apache 2.0 표기와 여러 PII 종류를 제공하지만 이번 문의에 대한 한국어 정확도·실행 자원을 확인하지 않았다. 이 두 모델을 성능 미달로 판정한 것은 아니다.

검토 당시의 검증안은 이메일·전화번호 등의 규칙과 한국어 NER를 조합하고, 이름 탐지와 영향 인원·업무 마감 보존을 각각 평가하는 것이었다. 당시 `SensitiveType`에는 이름 전용 값이 없어 Label 변환 정책부터 정해야 했다. 후보 검토만으로 Enum·마스킹 정책·배포 구성을 변경하지 않았다.

이후 사용자가 업무 사실 보존과 `PERSON` 추가를 승인했다. 별도 Container의 실제 모델 평가에서 12개 중 7개만 통과했으며, 이름 누락과 일반 문구 오탐이 있어 배포용 채택을 보류했다. PERSON 변경·Focused Java 178개·Python Unit 10개·실제 모델의 시간/메모리 관찰은 [후속 보고서](./2026-10-15-korean-privacy-ner-probe.md)로 분리한다. Job별 Timeout·취소·자원 회수와 Main 조립은 아직 남아 있다. AWS Task 크기·실행 설정은 변경하지 않았다.

## 참조 범위

개인정보 학습자료의 실패 계약과 변경한 Java·SQL·UI를 검토했다. 큰 주간 계획·Lab README는 다음 배치와 관련 구현 절을 선택해 확인했으며, 과거 회차의 전체 기록을 다시 검토한 것은 아니다. Week 8 전체 완료 검토와 구분한다.
