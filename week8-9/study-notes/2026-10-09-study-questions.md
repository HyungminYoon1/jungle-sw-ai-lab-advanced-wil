# 10월 9일 학습 노트 — 실행 설정에서 CI와 AWS 권한까지

Secret을 전달하는 것, Spring 객체를 조립하는 것, Job을 처리하는 것과 배포하는 것을 나누어 학습했다. Process 종료·Health·CI를 확인한 뒤 AWS의 OIDC·ECR 초기 설정까지 진행했다. AWS 설정의 실제 실행일은 10월 10일이며, 이 노트에서는 10월 9일 학습 회차로 정리한다.

## Secret을 읽는 것과 Provider를 만드는 것은 다르다

처음에는 Provider를 비밀값을 제공하는 객체로 이해했다. 이번 구성의 Provider는 반대로 비밀값을 받아 외부 AI 요청에 사용하는 객체다. 실행 환경에서 제공한 파일을 Spring이 Property로 읽고, Configuration이 그 값을 Provider 생성자에 전달한다.

```text
Secret 파일
  → configtree로 읽은 Environment의 설정값
  → Configuration이 만든 Provider Bean
  → Provider를 주입받은 Processor
  → Worker가 선택한 Job의 처리
```

`@Bean` 메서드의 매개변수로 Provider를 받는 것은 새 Provider를 만들라는 명령이 아니다. Spring이 등록된 객체의 참조를 전달하는 것이다. Provider와 Consumer는 다른 객체지만 Consumer가 받은 Provider는 이미 등록된 그 객체다.

따라서 설정값이 있어도 필요한 Bean이 없으면 의존성을 조립하지 못할 수 있다. Provider가 있어도 Worker가 비활성이면 자동 처리는 시작되지 않는다. 객체를 만들었다고 API Key가 유효하다고 알 수 있는 것도 아니다. 외부 AI 인증 실패는 실제 요청 뒤 Provider가 Key를 거부하는 단계이고, Browser의 Session 인증과도 다르다.

현재 등록 설정은 Provider 활성화와 Worker 활성화를 나누고, 필요한 Key·요약 상한·개인정보 처리기를 명시적으로 요구한다. 전역 `OPENAI_API_KEY`를 대체 값으로 읽지 않는다. 같은 Image에 다른 파일을 연결해 새 객체를 만들 수 있으므로 Key 변경만으로 Image를 다시 Build할 필요는 없다. 다만 기존 HTTP Client가 파일 변경을 감지해 인증 값을 자동 갱신하는 것은 아니므로 새 설정으로 Provider를 다시 구성해야 한다.

합성 Secret 실험에서는 파일 제공·읽기 권한·Property 일치·Main Provider 등록을 확인했다. 실제 Key 인증이나 전체 Worker·DB 실행은 별도로 남아 있다.

## 개인정보 탐지와 원문 치환을 분리한다

알려진 문자열만 바꾸는 규칙으로 모든 개인정보의 외부 전송을 막았다고 말할 수는 없다. 형식을 벗어난 연락처나 문맥에 의존하는 정보는 놓칠 수 있다. 로컬의 경량 모델을 추가하는 방안을 검토했지만, 검사기가 문의 전체를 다시 쓰게 하기보다 위치와 종류를 반환하도록 하고 Java가 해당 구간만 치환하는 방향으로 정했다.

DB에 저장한 문의 원문은 유지하고 AI 전송용 복사본을 만든다. 마스킹 때문에 로그인 복구 사실이나 문의 목적까지 사라지면 AI가 받은 입력의 의미가 달라진다. 이메일로 확인한 값은 이메일 자리표시자로 가리되, 종류를 모르는 연락처를 휴대폰이라고 추측하지 않는다.

위치 계약은 제목·본문 각각의 Unicode Code Point다. Java `String`의 인덱스는 UTF-16 단위이므로 그대로 사용할 수 없다. `"A😀B"`에서 `B`의 Code Point 위치는 2지만 Java 인덱스는 3이다. 시작과 끝을 `offsetByCodePoints()`로 변환한 뒤 원문 구간을 조립한다.

같은 필드·위치·종류의 중복은 한 번 처리한다. 범위가 겹치거나 같은 범위의 종류가 충돌하면 임의로 합치지 않고 전송을 중단한다. 제목과 본문의 같은 숫자 위치는 서로 다른 항목이다. 잘못된 위치를 본문 길이에 맞춰 보정하면 엉뚱한 내용까지 가릴 수 있다.

검사 Timeout과 정상 검사의 빈 목록도 구분해야 한다. 검사를 끝내지 못했다면 원문이나 제한적인 검사 결과만 보내는 방식으로 우회하지 않는다. 합의한 초기 정책은 접수한 Ticket·Message를 유지하고 전송을 멈추며, 실행권이 유효한 현재 Attempt의 Job에 `PRIVACY_SCAN_TIMEOUT` 또는 `PRIVACY_SCAN_INVALID_RESULT`를 남겨 실패 처리하는 것이다. 읽기 전용 조회나 자동 Polling이 새 검사를 시작해서도 안 된다.

구현한 `AiInputSpanMasker`는 **이미 주어진 위치 목록을 검증하고 치환하는 함수**다. 탐지 모델, 검사 결과의 JSON 검증과 실패 코드의 DB·Worker·UI 연결은 아직 구현하지 않았다. 범위 치환 Test의 통과와 개인정보 탐지의 정확도는 다른 근거다.

## SIGTERM은 정리할 기회를 주고 SIGKILL은 강제로 끝낸다

SIGTERM과 SIGKILL은 Linux가 Process에 전달하는 종료 Signal이다. SIGTERM에서는 JVM의 종료 Hook과 Spring의 종료 처리가 실행될 수 있지만, SIGKILL에서는 정리 코드를 실행할 기회가 없다.

HTTP Graceful Shutdown은 이미 처리 중인 요청을 마칠 기회를 준다. Spring이 20초를 허용해도 Docker가 1초 뒤 강제 종료하면 요청은 끝나지 못한다. 안쪽 HTTP 종료 유예와 바깥 Container 종료 유예를 함께 봐야 한다.

4초짜리 합성 요청의 비교에서는 충분한 대기 후 `200`으로 완료됐고, 1초 대기와 SIGKILL에서는 연결이 끊겼다. SIGTERM의 Exit Code가 `143`이어도 요청을 정상적으로 마친 경우가 있었다. `137` 역시 메모리 부족만을 뜻하지 않으므로 보낸 Signal·종료 대기·`OOMKilled`와 요청 결과를 함께 확인한다.

HTTP 요청을 마쳤다는 사실이 비동기 AI Job까지 완료됐다는 뜻은 아니다. 종료 중 DB·Job 상태의 전체 비교는 다음 실험에서 확인한다.

## Health와 Job 상태는 다른 대상을 가리킨다

처음에는 Health `UP`을 DB가 준비됐다는 뜻으로 좁게 생각했다. 실제로는 등록된 Health Indicator의 종합 결과다. DB를 사용하지 않는 실행도 `UP`일 수 있고, 등록하지 않은 외부 AI 기능까지 자동으로 검사하지는 않는다.

특정 Job의 `SUCCEEDED`는 검증된 제안과 성공 상태를 DB에 Commit한 결과다. 서버 Health는 정상인데 Provider 거부로 한 Job이 `FAILED`일 수도 있다. 최소 Health는 익명으로 허용하되 상세 설정이나 관리 기능을 공개하지 않고, HTTP Metric 한 개는 AGENT에게만 허용했다.

Log는 개별 요청·Job의 사건을 기록하고 Metric은 요청 수·Status·시간을 집계한다. Security에서 거부한 `401` 요청도 실제 HTTP Metric에 포함됐다. Controller에 들어온 요청만 보면 이런 실패를 놓칠 수 있다. Request ID·Job ID로 기록을 연결하는 것과 전체 요청을 집계하는 것은 서로 다른 관찰 방법이다.

## Java Build와 Browser JavaScript 검증을 나눈다

Java 프로젝트인데 왜 JavaScript Test를 실행하는지 궁금했다. Helpdesk JAR에는 백엔드 Class와 Browser에 제공할 HTML·JavaScript가 함께 들어 있다. Java 컴파일만으로 Fetch 응답 분기나 오래된 응답 무시 같은 UI 로직까지 검증되지는 않는다.

Node Test에는 Browser용 모듈의 Unit Test와 AI 실험 스크립트의 Test가 함께 있다. 이 Test들은 실제 Browser의 Cookie 전송·CORS 판단·Rendering을 모두 대신하는 E2E는 아니다.

실제 Actions의 첫 실행에서는 Windows용 Shell 선택에 의존한 Test 두 개가 Ubuntu에서 실패했다. Shell 선택을 Test에서 주입하도록 분리해 해결했다. 이어 별도 Branch에서 공백 제목 거부 조건을 제거하자 기존 UI Test 세 개가 실패하고 Image Build는 건너뛰어졌다. 기대값을 바꾸지 않고 조건을 복원했을 때 다시 통과했다.

CI 성공은 해당 Commit의 검사와 Image Build 성공이다. ECR 업로드, ECS 실행과 Cloud의 DB·Secret·HTTPS 설정까지 성공했다는 뜻은 아니다.

## AWS 신원과 권한은 두 단계로 확인한다

GitHub Actions가 Source를 읽고 Image를 만든다고 AWS에도 접근할 수 있는 것은 아니다. OIDC로 실행 신원을 증명하고 AWS STS에서 Role의 임시 Credential을 받은 뒤, 그 Role의 권한으로 ECR 작업을 요청한다.

| 구분 | 결정하는 것 |
|---|---|
| Trust Policy | 어떤 GitHub Repository·Branch 등의 실행이 Role을 사용할 수 있는가 |
| Permission Policy | 그 Role로 어느 AWS 자원에서 어떤 작업을 할 수 있는가 |

`id-token: write`는 GitHub에 OIDC Token을 요청하는 권한이다. AWS 자원을 수정하는 권한은 아니다. Registry 인증에 성공해도 Layer 업로드·Image 등록 권한이 없으면 Push는 실패할 수 있다. 여기서 Push는 Git Commit 업로드가 아니라 Container Image를 ECR에 올리는 작업이다.

Image 업로드용 Role, ECS Execution Role과 Application Task Role도 나눠야 한다. Execution Role은 ECS가 Image를 받고 Log·지정된 Secret을 준비하는 데 사용한다. Application 코드가 AWS API를 직접 호출할 때는 Task Role을 사용한다. ECS가 이미 전달한 Key를 Java가 읽는 경우와 Java가 Secrets Manager에 직접 요청하는 경우는 다르다.

이번에는 서울의 Private ECR, GitHub OIDC Provider와 `main`의 Image 업로드 Role만 구성했다. 실제 Repository의 ID 포함 Subject를 조회해 Trust Policy에 적용하고, 해당 ECR의 Push 작업만 허용했다. Codex가 Console에서 저장된 정책을 다시 확인했으며, 실제 STS 인증·Image 업로드·권한 거부 실험은 아직 하지 않았다.

## 이번 회차의 실행 근거

| 대상 | 확인한 결과 |
|---|---|
| 설정·Bean 조립 | 학습용 설정 Test 5개·기존 Worker 7개, Main 등록 관련 Test 총 170개 통과 |
| 합성 Secret Mount | 같은 Image의 파일 A·B, 누락·공백·비활성 등 5개 Case 통과. DB·실제 AI 없음 |
| 범위 치환 | 새 Test 47개와 기존 Guard 32개, 총 79개 통과. 탐지 모델·Worker 연결은 별도 |
| 로컬 관측·종료 | Java 551개·JavaScript 145개·ESLint·Image Build, 종료 Case 3개 확인 |
| 원격 CI | Shell 선택 보완 뒤 Java 551개·JavaScript 146개·ESLint·Image Build 성공. 별도 오류 Branch의 실패·복구 확인 |
| AWS 초기 설정 | OIDC Provider·Private ECR·업로드 Role 생성, 저장된 정책 대조 |

Test 수는 서로 겹치는 범위가 있어 합산하지 않는다. 이번 회차의 구현·Test·Console 조작은 Codex의 도움으로 진행했고, 설정 전달·실행 조건·실패 경계와 권한 차이를 문답으로 확인했다. 실제 AI 호출은 없었다.

## 다시 설명해볼 핵심 질문

1. Secret 파일·Property·Provider Bean·Worker 활성화는 각각 어떤 단계인가? API Key가 유효하다는 것은 어디에서 확인하는가?
2. 같은 Image에 새 Secret을 연결하는 것과 이미 생성한 HTTP Client의 Key를 바꾸는 것은 어떻게 다른가?
3. 알려진 문자열 치환·개인정보 탐지·범위 검증은 각각 무엇을 확인하는가? Timeout을 빈 목록으로 취급하면 어떤 보호가 사라지는가?
4. Code Point 위치를 Java 인덱스로 바꿔야 하는 이유와 제목·본문 위치를 따로 세는 이유는 무엇인가?
5. HTTP 종료 유예가 충분해도 Container가 먼저 강제 종료되면 요청·Job에 무엇이 남는가?
6. Health `UP`, HTTP `201`, Job `SUCCEEDED`와 CI 성공은 각각 어느 대상의 결과인가?
7. CI의 JavaScript 실패 뒤 Image Build가 실행되지 않은 이유는 무엇인가? Node Unit Test와 Browser E2E는 어떻게 다른가?
8. OIDC Token 요청·Role 사용·Registry 인증·Image Push는 각각 어떤 권한을 요구하는가?
9. Trust Policy와 Permission Policy, 업로드 Role·Execution Role·Task Role은 어떻게 구분하는가?

## 다음 학습

실제 OIDC 인증·ECR 업로드와 Commit·Digest 대응을 확인한 뒤 Network·RDS·ECS·Secret·ALB·DNS·HTTPS를 연결한다. 개인정보 탐지와 실패 저장의 실행용 연결, 종료 중 DB·Job 상태, Cloud 관측·Rollback·Backup 복원도 같은 Week 8에 남겨 둔다. 10월 11일은 제외하고, 분량이 부족하면 학습 내용을 빼지 않고 기간을 연장한다.

- [Spring 설정과 Bean 자료](../study-docs/spring-settings-bean-and-secret-wiring.md) · [합성 Secret 실험](../lab-reports/2026-10-09-synthetic-secret-mount-and-provider-wiring.md)
- [개인정보 탐지와 마스킹 자료](../study-docs/privacy-detection-and-minimal-masking.md) · [범위 치환 Test](../lab-reports/2026-10-09-ai-input-span-masking-unit-tests.md)
- [Process·Health·CI 자료](../study-docs/process-health-and-ci.md) · [로컬·CI 보고서](../lab-reports/2026-10-09-process-health-and-ci-baseline.md)
- [IAM·OIDC·ECR 자료](../study-docs/iam-oidc-ecr-and-deployment-roles.md) · [AWS 초기 설정 보고서](../lab-reports/2026-10-10-aws-oidc-ecr-baseline.md)
- [Week 8 주간 계획](../weekly-plan.md)
