# 배포용 사용자 구성과 문의 접수 검증

> 실행일: 2026-10-12 KST
> 결과: Focused Java Test 72개 통과, 실패·오류·건너뜀 0개
> 환경: Java 25, 실제 PostgreSQL 17.6 Testcontainer, MockMvc

## 배포용 사용자 연결

Lab의 `DeploymentSecurityConfiguration`을 추가했다. `deployment`는 실행 환경의 네 설정으로 USER·AGENT를 구성하고 `postgres`는 Ticket의 영속 저장소를 선택한다. 기존 BCrypt PasswordEncoder와 Session·Role·CSRF 계약을 유지한다.

필수 값 누락·빈 문자열·공백과 대소문자를 무시한 이름 충돌은 고정 오류 코드로 거부한다. `postgres`가 없거나 `local-browser`·`in-memory`와 혼용해도 기동을 거부하며 Local 값으로 대체하지 않는다. Unit Test는 Host의 환경 변수·System Property를 제외하고 합성 설정을 사용한다. Password·Hash는 Boolean Assertion으로 확인해 값이 출력되지 않도록 한다.

## Main 구성과 실제 PostgreSQL 연결

`DeploymentSecurityHttpIntegrationTest`는 Main의 사용자 Bean을 그대로 사용하고 합성 Credential만 Dynamic Property로 제공한다. Test 사용자 Bean으로 대체하지 않는다. 연결 URL이 해당 Testcontainer인지 확인하고, JdbcTicketRepository를 통해 생성한 Ticket을 다시 조회한다. 기존 DB를 정리하거나 삭제하지 않는다.

같은 Test에서 다음 결과를 확인했다.

- USER 로그인·Session 복원과 CSRF 없는 접수 `403`, Controller 미진입
- 유효한 CSRF 접수 `201`, `OPEN` Ticket의 PostgreSQL 저장·재조회
- 익명 조회 `401`·USER 조회 `403`의 Controller 미진입과 AGENT 조회 `200`
- AGENT의 AI 처리 상태 조회 `200`, Job `PENDING`
- Provider·Worker Bean 부재와 잘못된 Password의 인증 실패

## 실행과 결과

```powershell
.\mvnw.cmd -B -ntp "-Dtest=DeploymentSecurityConfigurationTest,DeploymentSecurityHttpIntegrationTest,LocalBrowserSecurityConfigurationTest,AiSuggestionProviderConfigurationTest,AiSuggestionWorkerConfigurationTest,TicketReceiptHttpIntegrationTest" test
```

| Test | 실행 수 |
|---|---:|
| `DeploymentSecurityConfigurationTest` | 25 |
| `DeploymentSecurityHttpIntegrationTest` | 1 |
| `LocalBrowserSecurityConfigurationTest` | 3 |
| `AiSuggestionProviderConfigurationTest` | 18 |
| `AiSuggestionWorkerConfigurationTest` | 7 |
| `TicketReceiptHttpIntegrationTest` | 18 |
| 합계 | 72 |

Maven은 `BUILD SUCCESS`, Surefire XML에서도 각 Suite의 수치를 대조했다. 새 Test는 26개다. 이전 Focused 실행의 43개는 이번 실행에도 포함돼 있으므로 두 실행 수를 합산하지 않는다. 전체 Java·JavaScript 회귀는 이번 실행 대상이 아니다.

## 배포로 이어갈 부분

이번 결과는 실제 Main 사용자 구성·Security·Service·JDBC·PostgreSQL을 연결한 MockMvc 검증이다. 실제 ECS Secret 전달, RDS·HTTPS·Browser Cookie와 AI Worker의 전체 실행은 이어서 검증한다. 외부 AI 호출과 AWS 리소스 생성은 하지 않았다. Controller·Domain·DB Schema·기존 Local 구성은 변경하지 않았다.

새 Java Source는 10/10에 업로드한 ECR Image에 포함되어 있지 않다. 배포 전 CI 검증과 새 Image Build·업로드·Digest 확인이 필요하다. 이번 실행에서는 ECR 업로드를 하지 않았다.

- [배포 사용자 구성 결정](../deployment-plan.md#배포용-사용자-구성-결정)
- [설정과 Bean 자료](../study-docs/spring-settings-bean-and-secret-wiring.md)
- [10월 12일 학습 노트](../study-notes/2026-10-12-study-questions.md)
