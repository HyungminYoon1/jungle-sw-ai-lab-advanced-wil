# AI 비활성 문의 접수와 Provider 조립 검증

> 실행일: 2026-10-12 KST
> 결과: Focused Java Test 43개 통과, 실패·오류·건너뜀 0개
> 환경: Java 25, Docker Engine 29.8.0, PostgreSQL 17.6 Testcontainer

## 확인할 계약

Key 설정이 있어도 개인정보 처리기 Bean이 없으면 활성 Provider를 조립할 수 없다. 이 실패는 외부 AI의 인증 거부가 아니라 Spring의 의존성 구성 실패다.

반대로 DB·인증이 정상이고 Provider·Worker를 모두 끈 구성에서는 문의 접수가 가능해야 한다. 접수 응답은 `201`, 새 Job은 `PENDING`, 자동 생성 예약은 0건으로 예상했다.

## Test 변경

Lab의 `TicketReceiptHttpIntegrationTest`에서 `helpdesk.ai.provider.enabled=false`와 `helpdesk.ai.worker.enabled=false`를 명시했다. 새 `receipt_succeeds_with_provider_and_worker_explicitly_disabled` Case는 다음을 함께 확인한다.

- Application Context에 Provider·Worker·Scheduler Bean이 없다.
- USER의 로그인 Session과 유효한 CSRF 요청이 접수 Controller에 도달해 `201`을 반환한다.
- Ticket·Message·Job이 실제 PostgreSQL에 각각 1건 저장된다.
- 해당 Job의 `status`는 `PENDING`, `reserved_generation_count`는 0이다.

DB 정리는 연결이 해당 Testcontainer인지를 확인한 뒤에만 실행한다. 운영 Source·Job 정책·Migration은 변경하지 않았다.

## 실행과 결과

Lab Repository에서 다음 명령을 실행했다.

```powershell
.\mvnw.cmd -B -ntp "-Dtest=AiSuggestionProviderConfigurationTest,AiSuggestionWorkerConfigurationTest,TicketReceiptHttpIntegrationTest" test
```

| Test | 실행 수 | 확인 대상 |
|---|---:|---|
| `AiSuggestionProviderConfigurationTest` | 18 | 합성 Config Tree·필수 설정·개인정보 처리기 누락·Provider 등록과 Worker 비활성 |
| `AiSuggestionWorkerConfigurationTest` | 7 | 기본 비활성·Profile·필수 의존성·설정 Binding |
| `TicketReceiptHttpIntegrationTest` | 18 | Security·MockMvc·Service·JDBC·실제 PostgreSQL, 새 AI 비활성 Case 포함 |
| 합계 | 43 | 실패·오류·건너뜀 0개, `BUILD SUCCESS` |

Surefire XML에서도 세 Suite의 수치와 신규 Case 한 건을 대조했다. 앞서 실행한 설정 Test 25개를 이번 43개에 다시 더하지 않는다.

## 결과 해석과 다음 연결

설정 Test는 개인정보 처리기 누락을 빈 처리기로 대체하지 않는 조건과 정상 Provider 생성만으로 HTTP 요청이 시작되지 않는 조건을 확인한다. 접수 Test에서는 실행 객체 부재와 예약 0건을 함께 확인해 자동 AI 처리가 비활성임을 검증했다. 실제 AI는 호출하지 않았다.

실제 PostgreSQL을 사용했지만 HTTP 요청은 MockMvc이고 로그인 사용자는 Test Fixture다. Cloud 계정·Secret·ECS·RDS·HTTPS의 배포 성공이나 Browser Cookie 전달을 검증한 결과는 아니다. 전체 Java·JavaScript 회귀도 이번 Focused 실행과 구분한다.

다음은 배포용 사용자·Secret 전달과 전체 객체 연결이다. ECS Agent의 Secret 읽기와 Java의 설정 읽기를 나누어 설명한 뒤 실행 Role·Network·비용·생성 범위를 확정한다.

- [설정과 Bean 학습자료](../study-docs/spring-settings-bean-and-secret-wiring.md)
- [IAM과 실행 Role 자료](../study-docs/iam-oidc-ecr-and-deployment-roles.md)
- [10월 12일 학습 노트](../study-notes/2026-10-12-study-questions.md)
- [Week 8 계획](../weekly-plan.md)
