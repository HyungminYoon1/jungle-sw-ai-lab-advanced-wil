# HTTP 접수와 AI Worker Log 연결 검증

> 실행일: 2026-10-19 KST
> Lab Commit: `051fd90` — `feat(observability): correlate receipt and worker processing logs`
> 결과: 로컬 핵심 Test 44개·전체 Java 724개 통과. AWS 배포·새 Cloud Log 검증은 미실행

## 구현 범위와 선택

기존 Filter는 응답 Header와 Request Attribute에 Request ID를 넣었지만 Handler Log에는 그 값을 넣지 않았다. Scheduler는 예외의 고정 경고만 남겼다. 접수와 비동기 작업을 찾을 수 있도록 세 Event를 연결했다.

| Event | 구현 위치 | 선택한 Field |
|---|---|---|
| `TICKET_RECEIPT_COMMITTED` | `TicketReceiptController`에서 접수 Service Proxy의 정상 반환 뒤 | Request·Ticket·Message·Job ID |
| `HANDLER_COMPLETED` | `HandlerTimingInterceptor.afterCompletion()` | Request ID·Handler·HTTP Status·경과 시간 |
| `AI_WORKER_TICK_RESULT` | `AiSuggestionWorkerScheduler.poll()`의 한 Tick 반환 뒤 | Job ID·Attempt·Outcome·Tick 경과 시간 |

HTTP 정보를 Service와 Repository에 전달하거나 별도 Trace 저장소를 도입하는 대신, 기존 Web 경계에서 접수 식별자만 연결했다. Service의 Transaction·인증 작성자 전달·Repository·DB Schema와 Worker 재시도 정책은 바꾸지 않았다. Controller에는 바깥 Transaction이 없으므로 Transactional Service Proxy의 정상 반환 뒤 접수 Commit이 끝나 있다.

기록 형식은 선택한 Field의 `key=value`다. Request ID에는 서버가 만든 정규 UUID만 사용하며 Client Header나 임의 Attribute를 Log 문자열로 사용하지 않는다. 원문·작성자·Provider 응답·검증 객체·Credential·Cookie·CSRF Token·Exception Message/Cause는 새 Event에 넣지 않는다.

Worker의 중간 결과를 최종 Job 상태로 바꾸지 않았다. `STORAGE_PENDING`·`NOT_CURRENT` 등을 원래 Outcome으로 남기고, Claim 없는 조회 불명 결과에는 Job·Attempt를 만들어 붙이지 않는다. 고정 예외 경고는 유지하고 `NO_JOB`·`STORAGE_RETRY_WAITING`은 제외했다. 실패 사유의 상세 고정 코드는 기존 Job 조회에서 확인한다.

## 실행과 결과

```powershell
.\mvnw.cmd "-Dtest=RequestIdFilterTest,HandlerTimingInterceptorTest,AiSuggestionWorkerSchedulerTest,WebInfrastructureIntegrationTest,DeploymentHttpObservationTest,TicketReceiptHttpIntegrationTest" test
.\mvnw.cmd test
```

| 검증 | 결과 |
|---|---|
| 핵심 6개 Test Class | 44개, 실패·오류·건너뜀 0 |
| 전체 Java 회귀 | 724개, 실패·오류·건너뜀 0 |
| 응답 ID와 접수 ID 연결 | 서버 UUID·접수 Log·Handler Log가 일치하고 실제 PostgreSQL의 Message·Job ID와 일치 |
| Commit 실패 | HTTP 500·Ticket/Message/Job 각각 0건·접수 Commit Event 없음 |
| Worker Log | 17개 Scheduler Unit Test에서 Outcome·Job·Attempt·시간과 입력 비출력 확인 |
| HTTP 전체 관측 | 실제 로컬 HTTP의 Health 200·보호 API 401이 Metric에 포함되는 기존 Test 재통과 |
| 파일 검사 | Lab 변경 파일 9개의 UTF-8 무BOM·LF, `git diff --check` 통과 |

Commit 실패는 PostgreSQL 17.6 Testcontainer의 빈 참조 Table과 `DEFERRABLE INITIALLY DEFERRED` FK로 만들었다. 모든 INSERT 문장이 끝날 수 있지만 Commit에서 제약을 확인해 실패하는 조건이다. 임시 제약·Table은 해당 Test DB에서만 만들고 정리했다. 기존 Message·Job INSERT 실패와 CSRF 거부에서도 접수 완료 Event가 없는 것을 확인했다.

Scheduler Unit Test는 통제된 처리 결과를 사용해 Log의 Field와 분기를 확인한다. 전체 회귀에는 기존 실제 PostgreSQL Worker·복구·JVM 재시작 Test도 포함된다. 실제 AI 모델의 응답 품질이나 새 Log의 CloudWatch 전달을 확인한 실험은 아니다. 이번 변경은 아직 Push·CI·ECR 업로드·AWS 배포하지 않았다. AWS 리소스의 현재 실행 상태와 비용도 이 로컬 검증에서는 다시 조회하지 않았다.

## 관측값을 해석하는 범위

`elapsedNanos`는 MVC Handler 관측 구간이며 Security 이전 단계·Network 왕복·비동기 AI 시간을 합친 값이 아니다. `tickElapsedNanos`도 한 번의 Tick 시간으로, 대기와 저장 재시도를 포함한 Job 전체 시간이 아니다.

Commit 뒤 접수 Log를 남겨도 DB와 Log가 하나의 Transaction이 되는 것은 아니다. Commit 직후 종료되면 접수 Row는 있어도 완료 Log는 없을 수 있다. 기록이 없다는 이유로 Row 없음·실패·새 Provider 호출 가능을 확정하지 않는다. 실제 DB 상태와 기존 예약·현재 Attempt를 먼저 확인한다.

## 다음 확인

- AGENT App Metric과 Cloud의 현재 Task·Log Stream·보관 비용 확인
- Process 종료 중 DB Connection과 Job·Attempt·예약·제안의 전후 상태 확인
- 개인정보 처리 Adapter·전체 AI 조립과 자원 측정은 별도 잔여 과업으로 유지

개념 설명은 [Process와 Health 자료](../study-docs/process-health-and-ci.md#request-id로-접수와-worker-log-연결하기), 문답과 이해 정리는 [10월 19일 학습노트](../study-notes/2026-10-19-study-questions.md)에 연결한다.
