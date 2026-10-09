# 합성 Secret 파일 Mount와 Provider 등록

실행일: 2026-10-09

## 실험 목적

같은 Helpdesk Image에 서로 다른 합성 파일을 연결하고, Container의 파일 접근부터 Spring의 Config Tree 읽기와 Main Provider 등록까지 확인했다. 실제 API Key는 사용하지 않았고 외부 AI 요청은 보내지 않았다.

## 구성

Lab의 기본 `compose.yaml`은 바꾸지 않았다. 별도 `compose.secret-probe.yaml`로 실험 Container를 만들고 다음 조건을 적용했다.

- 실행 사용자 `10001:10001`, 읽기 전용 Root Filesystem과 파일 Mount
- `network_mode: none`, Host 공개 Port 없음
- Worker·Scheduler 비활성, DataSource·Web Server 구성 없음
- `optional:configtree:/run/secrets/`로 파일 읽기
- `helpdesk.ai.provider.key` 파일과 요약 상한 200의 합성 구성

Provider는 실제 Main의 `AiSuggestionProviderConfiguration`이 등록했다. 개인정보 처리기는 이 실험의 합성 Fixture이며, 배포용 개인정보 검사기를 대신하는 구현은 아니다. Test 전용 Main과 기대값 파일은 실행 시 Mount했고 Image에는 넣지 않았다.

## 실행 결과

| Case | 제공 조건 | 실제 결과 |
|---|---|---|
| 값 A | Provider 활성, 합성 파일 A 제공 | 파일 읽기와 설정값 일치, Provider 등록·Consumer 주입 성공 |
| 값 B | 같은 Image, 다른 합성 파일 B 제공 | 다른 값을 읽고 같은 등록 흐름 성공 |
| 공백 | Provider 활성, 공백 파일 제공 | `HELPDESK_AI_PROVIDER_KEY_REQUIRED`로 기동 거부 |
| 누락 | Provider 활성, 해당 Service에 파일 미제공 | 같은 필수 값 오류로 기동 거부 |
| 비활성 | Provider·Worker 비활성, 파일 미제공 | 기동 성공, Provider·Consumer·검증기·Worker·Scheduler 미등록 |

다섯 Case의 Container가 같은 Image ID를 사용했다. 정상 Case는 비특권 사용자로 합성 파일을 읽었고, Docker의 Mount 정보에서도 읽기 전용임을 확인했다. 파일 내용과 기대값, Spring Property의 비교는 Boolean으로 출력했으며 값과 Digest는 출력하지 않았다. Provider 객체의 HTTP 시도 횟수는 0이었다.

실험 결과는 `SYNTHETIC_COMPOSE_SECRET_MOUNT_PROVIDER_WIRING`, `PASS`, `casesPassed: 5`다. 종료 후 이 실험이 만든 Container와 임시 합성 파일만 정리했다. 기존 Container·Volume은 수정하지 않았다.

관련 회귀는 Provider 등록·Config Tree·Worker 구성·개인정보 Guard·출력 검증기·Adapter의 6개 Test Class를 다시 실행했다. 총 170개가 실패·오류·건너뜀 없이 통과했다. Adapter의 요청 Test는 로컬 통제 응답을 사용한다.

## 재실행

Lab 저장소에서 실행한다. Image에는 Main Source만 넣고, `test-compile`로 만든 실험 클래스를 실행 시 연결한다.

```powershell
.\mvnw.cmd -B -ntp test-compile
docker build --pull=false --tag helpdesk:week8-secret-probe .
pwsh -NoProfile -File .\scripts\Verify-Week8SecretMount.ps1
```

스크립트는 합성 파일을 생성하고 별도 Compose Project를 사용한다. 호출자의 실제 Key를 읽지 않으며, 자식 Process에서는 전역·Helpdesk Key와 자동 `.env` 읽기를 사용하지 않는다. 오류는 고정 코드로 출력한다. 안전한 결과 JSON은 Git 제외 경로인 `target/week8-secret-probe/`에 남긴다.

관련 파일:

- `compose.secret-probe.yaml`
- `scripts/Verify-Week8SecretMount.ps1`
- `src/test/java/experiment/helpdesk/secret/ComposeSecretMountExperiment.java`
- `src/main/java/lab/helpdesk/ai/provider/AiSuggestionProviderConfiguration.java`

## 다음 연결

이번 결과는 합성 파일 제공·설정 읽기·Main Provider 조립을 확인한 것이다. 기본 App Compose의 실행용 Secret·개인정보 처리기·Worker·PostgreSQL 연결은 이어서 구성한다. 실제 AI 호출·Browser E2E·Cloud 배포 결과로 기록하지 않는다.

- [Spring 설정과 Bean의 연결](../study-docs/spring-settings-bean-and-secret-wiring.md)
