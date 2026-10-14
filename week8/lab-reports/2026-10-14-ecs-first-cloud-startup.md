# ECS 첫 Cloud 기동과 DB 암호 전달 수정

> 실행일: 2026-10-14
> 상태: Cluster·Task Definition 등록, 첫 Task의 DB 인증 실패 뒤 종료 확인. 지정 암호 Parameter 동기화 후 추가 Task의 JDBC·Migration 7개·Spring 기동 성공. Task STOPPED·Cluster Running/Pending/Service 0개 확인

## 목적과 승인 범위

검증한 Image를 ECS Fargate에서 실제로 실행하고, 기존 Execution Role·여섯 Parameter·Private RDS·Log 연결을 확인한다. 첫 단계는 Provider·Worker를 끄고 진행한다.

- 서울의 `helpdesk-learning` Cluster와 Task Definition을 등록한다.
- 단독 Task 한 개를 `0.25 vCPU·512 MiB`로 실행하고 기동 확인 뒤 중지한다.
- 기존 Public Subnet과 공인 IPv4는 실행 준비의 외부 접속에 사용한다. App 8080 Inbound는 ALB Group만 허용한다.
- Task Role·ECS Exec·Service 자동 재실행·추가 유료 모니터링은 사용하지 않는다.
- 이 실행에서는 IAM 정책·ALB·DNS·DB 계정 권한을 변경하지 않는다.

첫 Task의 DB 인증 실패 후에는 사용자가 알고 있는 App 암호로 `/helpdesk/learning/db/password` 한 개만 직접 재등록하고, 같은 Image·실행 명세로 Task 한 개를 추가 실행해 확인 뒤 중지하도록 승인받았다. RDS 계정·암호·권한과 다른 Parameter는 이 조치에서 변경하지 않는다.

## 실제 실행 명세

| 항목 | 확인한 설정 |
|---|---|
| Cluster / Task Definition | `helpdesk-learning` / `helpdesk-learning:1` |
| 실행 환경 | Fargate On-Demand, Linux X86_64, `awsvpc` |
| 자원 | CPU `256` = 0.25 vCPU, Memory `512` MiB |
| Image Source | `2e2cc403f73972d5c0f87ab81342b776e7777f6b` |
| Image Manifest Digest | `sha256:1ec1ed5b0a4853b87fac7d1ded3937cf961be19f3d6e010608019e7b55cae39b` |
| Execution Role | 기존 `helpdesk-ecs-execution`, Task Role 없음 |
| Profile | `postgres,deployment` |
| AI | Provider·Worker 모두 비활성 |
| DB 연결 | Private RDS의 `helpdesk`, `verify-full`, Image의 공개 CA 파일 참조 |
| Secret | 기존 Standard SecureString 여섯 개의 ARN 참조. 실제 값은 읽거나 기록하지 않음 |
| Network | 학습 VPC의 Public-a Subnet 한 개, App Security Group 한 개, 공인 IPv4 사용 |
| Log | 기존 `/ecs/helpdesk-learning`, Stream Prefix `helpdesk`, 365일 보존 |
| 종료 | `stopTimeout=45`, 자동 Service 재실행 없음 |

Image의 기존 CI·업로드 근거는 [10월 13일 Image 전달 보고서](./2026-10-13-deployment-image-ecr-publish.md)에 있다. 공개 문서에는 실제 계정 ARN·RDS Endpoint·IP·Credential을 적지 않는다.

## Console 등록과 실제 기본값

### Log 자동 생성 옵션

로컬 Template의 `awslogs-create-group: "false"`는 자체 구조 Test를 통과했지만, ECS Console이 다음 오류로 등록을 거부했다.

```text
Log driver awslogs option 'awslogs-create-group' should only be set to 'true', else omit option.
```

옵션을 생략하면 기본값이 false이므로 Template과 두 Test의 Assertion을 생략 형태로 수정했다. 사전 생성한 Log Group을 사용하고 `logs:CreateLogGroup` 권한은 추가하지 않았다. JAR·Image를 수정할 필요는 없었다. [AWS LogConfiguration](https://docs.aws.amazon.com/AmazonECS/latest/APIReference/API_LogConfiguration.html)

### Network 선택

Console에서 VPC를 선택하자 네 Subnet과 기본 Security Group이 자동 선택됐다. 실행 전에 선택 상태를 다시 읽고, Public-a 한 개와 App Group 한 개로 맞췄다. 입력한 기억이 아니라 최종 선택으로 범위를 확인했다.

Cluster에는 Service Connect Namespace·EC2·Container Insights를 추가하지 않았다. 선택하지 않은 기능의 목록 조회 오류나 전체 Repository·Task Family 목록 조회 거부를 해결하려고 IAM을 넓히지 않았다. 승인한 대상의 등록·단독 실행 결과로 확인했다.

## 첫 Task: 실행 준비 뒤 DB 인증 실패

첫 Task는 검증한 Image를 받아 JVM을 시작했다. 실행 Container의 Image Digest는 등록한 Manifest Digest와 같았고, CloudWatch에 Spring Log가 전달됐다.

| 시각(KST) | 관찰 |
|---|---|
| 21:16~21:18 | Cluster 생성과 Task Definition 첫 Revision 등록 |
| 21:24 | 단독 Task 한 개 실행 |
| 21:25:38 | JDBC Connection Pool 시작 시도 |
| 21:25:45 | `28P01`, App DB Password 인증 실패, Spring 기동 실패 |
| 21:26:18 | 필수 Container 종료 뒤 Task `STOPPED` |

```text
FATAL: password authentication failed for user "helpdesk_app"
SQL State : 28P01
```

`28P01`은 PostgreSQL의 `invalid_password`다. ECR 접근·Parameter 읽기·Network 연결 실패와 같은 단계가 아니다. `flywayInitializer`에서 DB 연결에 실패하면서 JDBC와 Repository의 Bean 조립 실패로 이어졌다. 바깥쪽의 Bean 오류만 보고 IAM 권한을 추가하지 않았다. [PostgreSQL 오류 코드](https://www.postgresql.org/docs/17/errcodes-appendix.html)

같은 SQLState가 여러 예외에 반복되어도 Task를 여러 번 실행했다는 의미는 아니다. 첫 실행은 한 개였다. Migration·Spring 준비·접수 API·Browser 로그인·AI 처리는 이 실행에서 완료하지 못했다.

Task는 자동으로 종료됐고, Cluster의 Running·Pending과 Service 수가 모두 0임을 확인했다. 실행 Task의 과금은 종료됐지만 RDS·Storage·Image·Log 보관 비용은 별개다.

## DB 암호 전달을 맞추는 조치

앞서 psql에서 `helpdesk_app`으로 로그인한 암호를 기준으로, 사용자가 Root에서 지정 Parameter 한 개의 값만 직접 재등록했다. 목록에서 Standard·SecureString과 수정 시각 `2026-10-14 21:47:08 KST`를 확인했다. 실제 암호는 읽거나 출력·캡처하지 않았다.

DB 자체의 계정·암호·권한이나 다른 Parameter는 바꾸지 않는다. Root에서 로그아웃한 뒤 비Root 배포 사용자로 돌아가 같은 Image·Task Definition으로 새 Task 한 개를 확인한다. ECS는 Task 시작 시 환경 변수 Secret을 전달하므로 변경한 값은 새 Task에서 받아야 한다. [ECS Secret 변경과 새 Task](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-ssm-paramstore.html)

## 추가 Task: 같은 Image로 JDBC·Flyway·Spring 기동 성공

비Root 배포 사용자로 돌아가 `helpdesk-learning:1`의 Task 한 개를 추가 실행했다. Image Digest·Execution Role·Network·자원·AI 비활성 설정은 첫 실행과 같았다. DB 인증·기동 결과는 다음과 같다.

| 시각(KST) | 실제 Log |
|---|---|
| 22:11 | 추가 Task 생성, Image Pull 6초, Fargate 1.4.0 |
| 22:12:19 | PostgreSQL JDBC Connection 추가, Hikari Pool 시작 완료 |
| 22:12:21 | Migration 7개 검증 성공, Schema History Table 생성 |
| 22:12:25 | Migration 7개 적용 성공, `public` Schema의 Version `v7` |
| 22:12:47 | `Started HelpdeskApplication in 77.91 seconds` |
| 22:14 | 승인한 단독 Task 중지 요청 |

```text
Successfully applied 7 migrations to schema "public", now at version v7
Started HelpdeskApplication in 77.91 seconds (process running for 86.802)
```

변경한 것은 지정 암호 Parameter 한 개의 값이었다. Image 재Build·Task Definition 새 Revision·IAM·TLS 검증 완화·DB 계정 재설정은 하지 않았다. 같은 실행 코드에 올바른 실행 설정을 전달해 첫 인증 실패를 해결했다.

77.91초는 이 Task의 Spring 기동 시간이지 API 응답시간이나 AI 지연이 아니다. `0.25 vCPU·512 MiB`에서 첫 기동은 성공했지만, 업무 부하·개인정보 검사·Worker를 포함한 용량 측정은 남아 있다.

App 8080 Inbound는 ALB Group만 허용했고 ALB는 아직 연결하지 않았다. 이 단계에서 Health·로그인·API 접수·업무 Row의 직접 SQL 대조·Browser E2E·AI 처리는 실행하지 않았다. Flyway 적용 결과는 실제 Task의 Log로 확인했다.

중지 요청 후 실제 ECS 상태가 `STOPPED`로 바뀐 것을 확인했고, 중지 소요 시간은 40초였다. 이전 로그인 세션에 남아 있던 Cluster 화면은 21:28의 오래된 표시였으므로 새로 불러왔다. 갱신 시각 22:17의 Cluster에서 Running·Pending·Service가 각각 0개인 것을 확인했다. Task 중지와 RDS·보관 리소스의 비용 중단은 서로 다른 상태다.

## 로컬 검사와 Cloud 실행을 구분한다

Log 옵션 수정 뒤 ECS Focused Test 15개·JavaScript 전체 209개와 ESLint가 통과했다. Java Source는 바꾸지 않았으며 이 변경으로 새 CI·Image Build·ECR Push를 진행하지 않았다.

구조 Test는 저장소의 규칙을 검사한다. 실제 ECS의 등록 검증·IAM 평가·Secret 전달·Spring 기동·업무 요청까지 대신하지 않으며, 이번 Console 거부와 실제 Task Log로 그 차이를 확인했다.

## 남은 확인

- ALB·DNS·HTTPS, 실제 Browser의 Session·Role·CSRF와 API 접수·DB Row 대조
- 전체 AI 조립·실제 처리·자원 관찰
- 재배포·이전 Image 복귀·별도 DB Snapshot 복원·최종 회귀와 WIL

상세 계정·TLS 흐름은 [프로그램과 DB 연결 학습자료](../study-docs/cloud-database-and-application-connection.md)에 정리한다. 위 잔여 범위는 Week 8 완료 기준에서 제외하지 않는다.
