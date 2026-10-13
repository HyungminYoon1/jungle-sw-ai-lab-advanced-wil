# 10월 12일 학습 노트 배포 설정과 인증 DB 연결

배포 전에 필요한 객체를 연결하는 것과, 연결한 객체로 실제 AI 작업을 실행하는 것을 구분했다. 개인정보 처리기가 없는 활성 Provider는 기동에 실패하고, AI 기능을 끄면 문의 접수와 PostgreSQL 저장은 유지할 수 있다고 예상했다. 이 두 예상을 설정·접수 Test로 확인했다.

이번 노트는 10/12 학습 회차를 정리한다. 이어서 진행한 전체 회귀·CI·ECR 업로드는 실제 실행일이 10/13이므로 [별도 보고서](../lab-reports/2026-10-13-deployment-image-ecr-publish.md)에 그 날짜를 유지했다. 남은 학습은 10/13에 재개한다.

## 설정값이 있어도 필요한 객체가 없으면 실행할 수 없다

Key 파일이나 설정값이 존재한다고 Provider의 모든 의존성이 준비되는 것은 아니다. 현재 Configuration은 `Environment`·`ProviderLimits`·`AiInputPrivacyGuard`를 받아 Provider를 만든다.

여기서 `AiInputPrivacyGuard privacy`는 Spring에 등록된 개인정보 처리기 객체를 전달받는 매개변수다. 해당 Bean이 없으면 객체 조립 단계에서 실패하며 외부 AI 요청까지 가지 않는다. Key가 잘못되어 외부 Provider가 거부하는 경우와는 실패 단계가 다르다.

나는 개인정보 처리기가 없는 경우를 Spring 조립 실패·AI 미전송으로 설명했다. 부족한 의존성을 빈 검사기로 대신하면 안 된다는 점도 기존 전송 보호 조건과 연결해 이해했다.

## Key를 교체하는 것과 Image를 다시 만드는 것은 다르다

처음에는 Provider가 앱 내부 객체라면 Key를 바꿀 때 Image도 다시 Build해야 한다고 생각했다. 그러나 JAR에 들어 있는 것은 설정을 읽고 객체를 만드는 코드다. 실제 Key는 Application이 시작할 때 전달받는다.

같은 Image로 새 Task를 시작해 교체한 Key를 전달하면, 같은 코드가 새 JVM에서 다른 설정의 Provider를 만든다. 이미 실행 중인 Container의 환경 변수와 Provider가 자동으로 바뀌는 것은 아니다. 나는 JAR의 코드는 그대로이고 새 객체는 새 Key를 사용할 수 있다고 설명했다.

Secret을 읽는 Role도 처음에는 Task Role이라고 답했다. ECS Agent가 가져와 전달하면 Execution Role, Java가 AWS API로 직접 조회하면 Task Role이다. Role은 실행 시점보다 요청 주체를 기준으로 구분한다.

## DB 연결과 인증 SQL 권한을 구분한다

DB 설정이 전달돼도 Network 경로와 Security Group이 막히면 접속할 수 없다. 나는 이 문제를 Task Role에 관리자 권한을 추가하는 것으로 해결할 수 없다고 설명했다.

`password authentication failed`는 DB 서버에 도달한 뒤 Password 인증에 실패한 상황이다. 처음에는 이를 계정 권한 부족이라고 표현했지만, 로그인 실패와 인증 뒤 테이블의 SELECT·INSERT 권한 부족은 구분해야 한다. SQL 권한 부족은 `permission denied`와 같은 별도의 오류로 확인한다.

DB의 Inbound는 App의 특정 IP보다 App Security Group을 참조하도록 계획한다. 같은 VPC에서 교체한 Task에도 같은 Group을 연결하면 Private IP가 바뀌어도 DB 규칙을 매번 새 IP로 바꿀 필요가 없다. App의 8080을 ALB에서만 받도록 제한하는 것과, App이 허용된 Outbound·인터넷 경로로 외부 AI를 호출하는 것도 별개다.

## AI를 끄는 것과 문의 접수를 끄는 것은 다르다

Provider와 Worker를 모두 꺼도 DB·로그인 설정이 정상이라면 사용자의 문의를 접수할 수 있다. 인증된 USER가 유효한 CSRF Token으로 접수했을 때 응답은 `201`, 새 Job은 `PENDING`, 자동 Provider 호출은 0회로 예상했다.

보완한 Test에서는 Provider·Worker·Scheduler Bean의 부재와 실제 PostgreSQL의 Ticket·Message·Job 각 1건, Job의 `PENDING`·예약 0건을 함께 확인했다. 이 구성에서는 자동 AI 처리를 시작할 객체가 없지만, 접수 Transaction은 정상적으로 Commit된다.

따라서 첫 Cloud 연결에서 AI를 끄고 서버·DB·로그인을 먼저 확인할 수 있다. 이후 개인정보 처리기·Provider·Worker를 연결해 전체 AI 흐름을 확인해야 한다.

## 이번 검증에서 확인한 것

Provider 등록 18개·Worker 설정 7개·접수 HTTP 18개, 총 43개 Test가 통과했다. 접수 HTTP Test는 실제 Security와 PostgreSQL을 사용하지만 요청은 MockMvc이고 사용자는 Test Fixture다. 실제 Browser·RDS 배포와는 구분한다.

새 Test는 Codex의 도움으로 보완했다. 나는 실패 단계와 접수 결과를 먼저 예상했고, 해당 조건을 확인하는 Test 결과와 연결했다. [실행 보고서](../lab-reports/2026-10-12-disabled-ai-receipt-and-wiring-tests.md)에 재현 명령과 결과를 정리했다.

이후 Codex가 별도의 `deployment` 사용자 구성을 추가했다. 외부 설정을 기존 PasswordEncoder로 처리하고, Local 구성과의 혼용·누락·공백·이름 충돌을 거부한다. 새 Unit Test 25개와 Main 사용자 Bean·MockMvc·PostgreSQL을 연결한 Integration Test 1개가 통과했다. 기존 관련 Test를 포함한 이번 Focused 실행은 72개이며, 앞선 43개를 다시 더하지 않는다. [배포 사용자 실행 보고서](../lab-reports/2026-10-12-deployment-users-and-receipt-tests.md)에 결과를 정리했다.

이 구현의 설명은 다음 학습에서 이어간다. 사용자 설정 검증을 실제 ECS Secret 전달이나 HTTPS 배포 완료로 표현하지 않는다.

## 사용자 저장소와 Ticket의 수명은 별개다

`deployment`는 로그인 사용자를 메모리에 구성하고 `postgres`는 Ticket의 JDBC 저장소를 선택한다. 나는 로그인 사용자 정보가 메모리에 있어도 Ticket은 PostgreSQL에 남고, 앱 종료가 Ticket 삭제를 뜻하지 않는다고 설명했다. Password 값만 바꿀 때와 Java Configuration을 추가할 때의 Build 필요 여부도 구분했다.

Codex가 변경 Source로 로컬 Image를 Build하고 JAR 안의 새 Configuration을 확인했다. Image 안에 Local Class도 함께 있지만 어느 사용자 Bean을 만들지는 활성 Profile로 구분한다. 이 확인은 JVM을 시작하지 않은 파일 검사이며, 실행 메모리·실제 로그인·Cloud 배포와는 별개다.

첫 연결용 Task Definition 초안과 구조 Test도 추가했다. JavaScript 전체 152개가 통과했으며, CPU·Memory·Cloud 참조는 아직 미확정 값으로 남겼다. 다음 학습에서는 이 실행 명세의 필드와 실제 자원 측정을 연결한다. [Image와 명세 보고서](../lab-reports/2026-10-12-deployment-image-and-ecs-draft.md)에 실행 결과를 정리했다.

## 비용은 상한보다 실제 필요량을 기준으로 정한다

월 3만 원은 최대 금액이며 그 근처까지 사용할 목표가 아니다. 필요한 기능·학습·보안·영속성을 유지하면서 실행 사양·수량·시간과 보관 비용을 줄이는 기준으로 정했다. 기존 60시간 비용표도 사용해야 할 분량이 아니라 초기 계산 예시다.

## Image 크기와 실행 메모리를 구분한다

나는 Task의 `memory`가 실행 중 사용할 메모리의 상한이며, Image의 크기만 비교해서 충분하다고 판단할 수 없다고 설명했다. 배포할 `image`도 로컬 ID가 아니라 업로드 뒤 확인한 ECR URI와 Manifest Digest로 지정해야 한다고 답했다.

이후 Codex가 같은 배포용 Image에 `0.25 CPU·512 MiB` 제한을 적용했다. AI를 끈 접수·PostgreSQL 저장·Role 조회와 순차 조회 30회를 독립 실행 두 번에서 확인했다. 최고 메모리는 약 312 MiB·211 MiB였고 메모리 부족 종료는 없었다. 이 값은 Heap만이 아니라 Container의 전체 사용량이며, 첫 연결의 후보 사양으로 사용한다.

CPU 제한으로 계산이 잠시 기다리는 현상과 메모리가 부족해 종료되는 현상은 다르다. 전체 AI 실행과 동시 부하까지 같은 사양으로 충분한지는 후속 측정이 필요하다. [실험 보고서](../lab-reports/2026-10-12-deployment-resource-probe.md)에 조건과 수치를 정리했다.

나는 Worker와 개인정보 검사가 빠진 측정만으로 전체 AI 실행의 사양을 확정할 수 없으며, 해당 작업을 포함해 다시 측정해야 한다고 답했다. 메모리 부족 종료와 계산 지연에서는 각각 메모리·CPU를 먼저 점검한다고 설명했다. 응답 지연에는 DB·Network 대기도 영향을 주므로 CPU만으로 원인을 단정하지는 않는다.

## HTTPS와 DB TLS는 서로 다른 연결이다

Browser→ALB의 HTTPS와 App→RDS의 TLS를 별도로 준비한다. Codex가 서울 RDS의 공개 CA를 Image에 넣고 JDBC의 `verify-full`·`sslrootcert` 설정을 보완했다. 공개 CA는 서버 인증서의 서명을 확인할 기준이며, DB 사용자 인증에 쓰는 Password와 다른 값이다.

첫 Image는 Build에 성공했지만 실제 비Root 파일 읽기는 실패했다. 파일의 읽기 권한만 생각하면 안 되고 부모 디렉터리를 통과할 권한도 필요했다. 디렉터리 권한을 보완한 재Build에서는 파일 Hash·Mode와 비Root 읽기가 확인됐다. 이것은 파일 전달·권한 확인이며 실제 RDS 연결은 아니다. [공개 CA와 Image 보고서](../lab-reports/2026-10-12-rds-public-ca-and-image-preparation.md)에 결과를 남겼다.

실제 개인정보 탐지기 연결은 아직 남아 있다. 위치를 받아 치환하는 코드가 있다는 것과 개인정보를 찾아내는 모델이 연결돼 있다는 것은 구분한다. 첫 Cloud 연결은 합의한 AI 비활성 단계로 진행하되, 전체 AI 흐름과 추가 측정을 완료 기준에서 제외하지 않는다.

나는 Browser→ALB의 HTTPS와 App→RDS의 TLS가 별도 연결이며, Password가 맞더라도 인증서 이름이 접속한 RDS Endpoint와 다르면 `verify-full`에서 거부해야 한다고 설명했다.

## Secret 보관과 실행 설정의 전달

다음 연결은 저장소에 보관한 값 → ECS Agent의 읽기 → 새 Container의 환경 변수 → Spring 설정 → Java 객체다. `secrets.valueFrom`의 참조와 실제 Password는 다르다. Parameter Store의 암호화 보관도 실행 중 환경 변수·Log의 보호를 대신하지 않는다.

Secret 비용을 확인한 뒤 Standard Parameter Store 권장안을 선택했다. 첫 App 설정은 Standard SecureString 여섯 개·Standard Throughput·`aws/ssm`을 사용한다. DB 접속과 USER·AGENT 로그인에 각각 다른 설정 이름을 사용하고 실제 값은 공개 문서에 넣지 않는다. 저장·기본 API 요금과 KMS 사용량도 구분한다. [배포 계획](../deployment-plan.md#secret-저장소-결정)에 선택 이유와 권한을 남겼다.

DB Password를 보관한 값을 바꾸는 것과 DB 사용자의 실제 Password를 바꾸는 것도 별개의 작업이다. 새 Task가 사용할 값과 DB가 인증할 값을 맞춰야 한다. 나는 필수 Parameter를 읽지 못한 상태에서 정상 기동할 수 없고, 저장소의 Password만 바꾼 상태에서 DB 인증도 성공한다고 볼 수 없다고 답했다.

Codex가 Task Definition의 여섯 참조를 SSM ARN 형식으로 맞추고 Execution Role의 권한 초안을 추가했다. 지정한 Parameter 읽기·해당 ECR Pull·지정 Log Group 전송만 포함하고 Task Role·GitHub 업로드 Role의 권한은 넓히지 않았다. 로컬 명세·권한 Test 13개와 JavaScript 전체 171개·ESLint가 통과했다. 이후 아래처럼 실제 Parameter를 등록했으며 AWS IAM 평가·ECS 전달은 다음 단계다.

로그인한 Chrome Console에서 서울의 기본 처리량·Standard Tier를 확인하고, USER·AGENT 로그인과 App용 DB 접속의 여섯 항목을 직접 등록했다. 생성 폼은 Standard·SecureString·`alias/aws/ssm`으로 준비했고 입력값은 채팅이나 Source에 남기지 않았다. 기존 다른 프로젝트의 항목은 사용하거나 덮어쓰지 않았다. Codex는 마지막 목록에서 여섯 이름·유형·계층을 확인했고 실제 값은 읽지 않았다.

이로써 접속 설정의 보관은 준비됐지만 DB 계정 생성과 새 Container 전달은 별도의 단계다. DB 접속 계정과 Helpdesk 로그인 계정의 목적을 구분해 등록했다. 이어 ECS Tasks가 사용할 새 Execution Role의 Trust Policy와 지정 리소스 Permission Policy를 함께 연결했다.

Trust Policy는 누가 Role을 사용할 수 있는지, Permission Policy는 그 Role로 어떤 작업을 할 수 있는지 정한다. 새 `helpdesk-ecs-execution` Role은 같은 계정·서울의 ECS Tasks만 신뢰하고, 해당 ECR Pull·여섯 Parameter 읽기·`/ecs/helpdesk-learning`의 Log Stream 쓰기만 허용한다. 나는 이 생성 범위를 승인했고, Codex는 새 Role과 인라인 정책을 생성한 뒤 저장된 두 JSON을 초안과 대조했다. 연결 정책은 한 개뿐이었고 기존 GitHub 업로드 Role과 다른 프로젝트의 Role은 변경하지 않았다. Trust 조건 Test 두 개 추가 뒤 JavaScript 전체 173개와 ESLint가 통과했다. 실제 ECS가 Role을 사용해 값을 읽고 전달하는지는 Task 실행에서 확인해야 한다.

Log는 초기 7일안보다 길게 1년 보존하도록 요청했다. 서울의 `/ecs/helpdesk-learning`이 Standard 클래스·365일 보존으로 생성됐고 목록에는 12개월로 표시됐다. 보존 기간은 각 Log Event에 적용되는 Group 설정이다. Group 자체를 1년 뒤 지우는 설정은 아니며 보존 기간만 바꾸기 위해 JAR·Image를 다시 만들지는 않는다. 실제 Task 출력의 전달과 보관량에 따른 비용은 다음 실행에서 확인한다.

## 실습 종료와 데이터 보관의 비용을 나눈다

실습하지 않을 때 비용을 최소화하는 방식으로 진행하도록 요청했다. 장기 휴지기에는 Task만 끄기보다, 마지막 Snapshot의 복원을 확인한 뒤 승인한 ALB·DB Instance를 정리하고 필요한 Image·데이터·설정을 남기는 절차를 준비했다. 실제 삭제는 하지 않았다.

App을 끄면 메모리 Session은 사라지고 다음 실습에서는 다시 로그인한다. Snapshot과 Image를 보관하는 비용은 남는다. 다음에는 중지·Backup·복원·삭제가 각각 무엇을 유지하거나 없애는지 내 말로 확인하고, 새 Endpoint와 Secret 참조를 실행 명세에 연결한다.

## Test 통과와 Image 업로드 그리고 실제 배포

같은 코드라도 확인하는 대상은 다르다. Test는 정한 입력에서 코드와 연결된 계층의 결과를 확인한다. Image Build는 실행에 필요한 파일을 묶고, ECR 업로드는 그 Image를 AWS의 저장소에 전달한다. ECS Task를 시작하기 전에는 그 Image로 AWS의 JVM이 실행된 것이 아니다.

이번 회차를 이어서 로컬 전체 Java 578개·JavaScript 173개와 ESLint가 통과했다. 같은 Source의 일반 CI와 수동 검증·업로드에서도 같은 Test 수와 Image Build 성공을 확인했다. 이전 Image는 유지하고 새 검증 Image 한 개를 추가했다. 지금 보관 중인 두 Image는 배포본을 선택할 수 있는 산출물이지, AWS에서 Helpdesk 두 개를 실행한 결과가 아니다.

Commit은 Source를, Local Image ID는 검증 Job과 Publish Job 사이에 전달한 Image를, Manifest Digest는 ECR에서 선택할 Image를 식별한다. 이번 업로드에서는 검증한 Image를 Publish Job에서 다시 Build하지 않고 사용했으며 Push 결과와 ECR 조회의 Digest를 대조했다. 새로운 Task를 시작할 때는 이 Digest와 실행 설정을 함께 확인해야 한다.

이 작업은 Codex가 변경 검토·회귀 실행·CI 확인·업로드와 기록을 진행했고, 나는 두 저장소의 Commit·Push와 검증 Image 한 개의 추가를 승인했다. App·RDS·ALB 실행은 별도 승인 대상으로 남겼다. 실제 ECS의 Parameter 읽기·Log 전달, RDS TLS와 HTTPS Browser 요청은 다음 실습에서 확인한다.

## 핵심 질문

1. Key 설정은 있지만 개인정보 처리기 Bean이 없다면 어느 단계에서 실패하며, 외부 AI 요청은 전송되는가?
2. Provider와 Worker를 모두 끈 정상 DB·인증 구성에서 문의 접수 응답, 새 Job 상태와 자동 호출 횟수는 무엇인가?
3. Context의 실행 객체 부재, HTTP `201`과 DB의 `PENDING`·예약 0건은 각각 무엇을 확인하는가?
4. AI를 끈 첫 배포를 확인한 뒤 전체 배포 완료까지 무엇을 더 연결해야 하는가?
5. ECS Agent가 Secret을 가져올 때와 Java가 AWS API로 직접 조회할 때 사용하는 Role은 각각 무엇인가?
6. Key만 바뀌었을 때 같은 Image로 새 Task를 시작할 수 있는 이유는 무엇인가?
7. Network 차단, Password 인증 실패, 인증 뒤 SQL 권한 부족은 각각 어느 단계에서 발생하는가?
8. App Security Group을 참조하면 같은 Group을 연결한 Task의 IP 변경에 어떻게 대응할 수 있는가?
9. 메모리 사용자 저장소를 사용하더라도 PostgreSQL의 Ticket이 앱 종료 뒤 남는 이유는 무엇인가?
10. Image 표시 Size와 Task의 `memory`를 직접 비교할 수 없는 이유는 무엇이며, 실행할 Image의 Digest는 어디서 확인하는가?
11. cgroup 전체 메모리와 JVM Heap은 왜 다르며, 순차 조회 통과만으로 전체 AI 실행의 자원까지 확정할 수 있는가?
12. Browser→ALB의 HTTPS가 App→RDS의 TLS까지 확인해 주는가? RDS의 인증서를 확인하는 Client는 누구인가?
13. 공개 CA 인증서와 DB Password는 각각 무엇을 확인할 때 사용하며, 파일이 있어도 디렉터리 통과 권한이 없으면 어떻게 되는가?
14. Parameter Store의 DB Password 값만 교체하면 DB 사용자의 실제 Password와 기존 Task도 자동 변경되는가?
15. ECS Agent의 Parameter 읽기가 거부됐다면 어떤 실행 단계부터 확인해야 하는가?
16. `desiredCount=0`과 ALB·RDS 정리는 각각 어떤 비용을 줄이는가? 장기 휴지기를 위해 DB를 정리하기 전에 무엇을 실제로 검증해야 하는가?
17. Test 통과·Image Build·ECR 업로드·ECS Task 실행은 각각 어떤 대상을 확인하는가?
18. Source Commit·Local Image ID·ECR Manifest Digest는 각각 언제 비교하며, 왜 같은 값이어야 하는 것은 아닌가?
19. USER·AGENT와 Secret 참조가 준비됐어도 실제 Cloud의 로그인·접수·AI 처리까지 완료했다고 말할 수 없는 이유는 무엇인가?

## 회차 마감과 다음 학습

이번 회차에서는 배포용 사용자·실행 설정·공개 CA와 자원을 로컬에서 검증하고, Standard Parameter 여섯 개·Execution Role·365일 보존 Log Group을 준비했다. 전체 회귀·CI·새 Image 전달까지 확인했지만 Week 8은 아직 진행 중이다.

10/13에는 먼저 배포 사용자 Configuration과 Task Definition의 핵심 설정을 다시 설명하고, 검증 Image·Network·RDS TLS·최소 비용과 생성 범위를 확인한다. 별도 실행 승인 뒤 AI를 끈 첫 Cloud 연결에서 Parameter 전달·Migration·로그인·접수·조회·Log를 확인하고, DNS·HTTPS·Cookie·CSRF의 Browser 검증으로 이어간다.

그 뒤 실제 개인정보 탐지기와 실패 코드의 DB·조회·UI 연결, Provider·Worker 전체 조립과 자원 측정을 진행한다. Cloud의 AI 수직 흐름·장애 추적·종료 중 DB와 Job·이전 Image 복귀·별도 Snapshot 복원·최종 복습과 WIL도 남아 있다. 하루에 모두 마치는 조건으로 내용을 줄이지 않는다.

[설정과 Secret 자료](../study-docs/spring-settings-bean-and-secret-wiring.md#standard-securestring을-전달하는-순서), [Image와 ECS 자료](../study-docs/image-publishing-and-ecs-execution.md), [IAM 실행 Role 자료](../study-docs/iam-oidc-ecr-and-deployment-roles.md)와 [현재 주간 재개 순서](../weekly-plan.md#10월-14일-재개-순서)에서 다음 학습을 확인한다.
