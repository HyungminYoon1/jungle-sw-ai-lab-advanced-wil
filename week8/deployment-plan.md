# Week 8 AWS 배포와 비용 초안

> 상태: 일부 실행 — 배포 준비 변경의 CI 통과·검증 Image 추가, SSM·Execution Role·1년 보존 Log Group 구성 완료. 기존 Image 유지, App·RDS·ALB 실행과 DNS·HTTPS 연결은 남아 있음
> 요금 확인일: 2026-10-12
> 진행 반영일: 2026-10-13 — 두 저장소 Commit·Push, Java 578개·JavaScript 173개 CI 통과와 새 Image 추가 포함
> 계획 수정일: 2026-10-13 — 최소 비용·Log 365일 보존 유지, 새/기존 Image 식별과 App·RDS·ALB 별도 실행 승인 반영

## 확인한 조건

- AWS 계정과 기존 도메인이 있다.
- Region은 서울 `ap-northeast-2`로 정했다.
- 최대 12개월 동안 학습 환경을 보관하되, 실습할 때만 실행해도 된다.
- AWS 월 지출 상한은 최대 3만 원이다. 이 금액을 채우거나 근처까지 사용하는 목표가 아니다. 학습·Application의 목적을 달성하는 범위에서 지출을 최소화한다. 외부 AI 호출은 별도 당일 승인 범위로 관리한다.
- 학습용 주소는 `helpdesk.hmyoon.com`이며 기존 DNS는 Cloudflare에서 관리한다.
- AWS Console 접근과 OIDC·ECR·Image 업로드 Role을 구성했다. 이후 Standard Parameter 여섯 개를 직접 등록하고 별도 승인을 받아 ECS Execution Role과 1년 보존 Log Group을 생성했다. DNS 변경과 나머지 배포 리소스의 생성 범위는 확인 전이다.

ECR·ECS Fargate·RDS·ALB·DNS·HTTPS·Backup 복원은 [주간 계획](./weekly-plan.md)의 학습 범위를 그대로 유지한다. 비용을 줄이기 위해 해당 학습을 다른 서비스로 대체하거나 생략하지 않는다.

## 비용 최소화 기준

기존 비용표는 초기 후보의 사용량을 가정한 계산이다. 상한에 가까운 금액이라는 이유로 그 구성을 선택하지 않는다. 10/12에 작성자가 월 3만 원은 최대 금액이며 적게 사용할수록 좋다는 조건을 명확히 했다.

상한 안에서 여유 있게 자원을 배정하는 안과, 필요한 기능·학습을 충족하는 최소 구성·실행 시간으로 운영하는 안 중 후자를 적용한다. 데이터 영속성·보안·복원 검증을 포기하는 절약은 하지 않는다.

1. **실측에 따른 최소 크기:** 기존 1 vCPU·2 GiB는 확정 사양이 아니다. 기동·대표 요청·Worker 처리의 CPU·메모리·응답 결과와 필요한 여유를 확인해, 목적을 충족하는 가장 작은 구성을 선택한다.
2. **필요한 때만 실행:** 로컬·CI에서 먼저 검증하고, Cloud 실험에 필요한 동안만 실행한다. 리소스 생성·인증서 검증·종료 대기도 과금 시간에 포함해 불필요한 실행 대기를 줄인다. 월 60시간은 사용해야 할 시간이 아니다.
3. **실행과 보관을 따로 최소화:** 최대 12개월 보관은 12개월 상시 가동을 뜻하지 않는다. 필요한 Image·데이터·실행 근거와 재개 설정을 정하고, 실행 중지 뒤에도 남는 Storage·Backup·ALB·Log 등의 비용을 함께 비교한다.
4. **실제 필요한 수량만 선택:** Image 2 GB·Secret 3개·Backup 20 GB 등의 초기 가정을 실제 필요량으로 다시 계산한다. 불필요한 중복 리소스·추가 기능·긴 보존 기간을 상한 안이라는 이유만으로 선택하지 않는다.
5. **생성 전 총비용과 정리 방법 비교:** 단가뿐 아니라 실행·보관·복원용 임시 리소스·재생성 비용을 비교한다. 학습 목적을 충족하는 대안 중 총지출이 작은 안을 우선하며, 생성·삭제·DNS 변경은 기존 승인 경계를 유지한다.

다음 구성 확정 때 후보별 비용과 기능·검증 조건을 다시 비교한다. 지출 상한에는 실제 세금·환율·추가 사용량도 고려하며, 예산 알림만으로 초과가 자동 차단된다고 가정하지 않는다.

## 완료한 초기 설정·Image 업로드와 승인 범위

10월 9일 회차를 이어서 실제 10월 10일에 다음 세 항목만 생성했다. 저장된 Trust Policy와 Permission Policy를 다시 읽어 입력한 제한 조건과 일치하는지 확인했다. 자세한 실행 근거는 [OIDC·ECR 초기 설정 보고서](./lab-reports/2026-10-10-aws-oidc-ecr-baseline.md)에 남겼다.

| 항목 | 현재 설정 |
|---|---|
| ECR | 서울의 Private Repository `ai-helpdesk-learning-lab`, Immutable Tag·AES-256, Basic Scanning 유지 |
| GitHub OIDC Provider | `token.actions.githubusercontent.com`, Audience `sts.amazonaws.com` |
| Image 업로드 Role | `helpdesk-github-ecr-push`, 실제 Lab Repository의 ID 포함 Subject·`main`만 신뢰, 해당 ECR의 Push 작업만 허용 |

장기 Access Key는 만들지 않았다. 신규 KMS Key·Enhanced Scanning·서명·복제·Pull-through Cache는 추가하지 않았다. IAM은 추가 이용 요금 없이 제공되지만, ECR은 이후 Image 보관량과 전송량에 따른 요금이 있으므로 전체 AWS 비용이 0원이라는 뜻은 아니다. [IAM 요금 안내](https://aws.amazon.com/iam/faqs/), [ECR 요금 안내](https://aws.amazon.com/ecr/pricing/)

같은 날 승인한 수동 업로드에서는 실제 OIDC·STS 인증과 ECR Push를 확인했다. 일반 검증 Job에서 만든 Image를 재Build하지 않고 전달했으며, ECR에 Image 한 건이 저장됐다. Source Commit은 `77ce72c`, 실행 Platform은 `linux/amd64`다. 업로드 결과와 ECR 조회의 Manifest Digest가 같았고 Console에서도 같은 Tag·Digest를 확인했다. 일반 Push는 Publish Job을 실행하지 않는다. 실행 링크와 식별 정보는 [ECR 업로드 보고서](./lab-reports/2026-10-10-verified-image-ecr-publish.md)에 기록했다.

10/13에는 배포 준비 변경을 두 저장소에 목적별로 Commit·Push했다. Lab `2e2cc40`의 일반 CI 성공 뒤 수동 검증·업로드를 한 번 실행했고, 두 실행의 Java 578개·JavaScript 173개·ESLint·Image Build가 통과했다. 수동 실행의 검증 Image를 그대로 ECR에 한 개 추가했으며 Console에서 기존 `77ce72c`와 새 `2e2cc40`의 Tag·Digest가 함께 남아 있는 두 Image를 확인했다. [새 Image 업로드 보고서](./lab-reports/2026-10-13-deployment-image-ecr-publish.md)에 실행 링크와 Digest를 기록했다. App·RDS·ALB 실행은 이번 승인에서 제외했고 DNS·IAM 설정과 기존 Image는 변경하지 않았다.

10/10에는 Image 보관까지 진행하고 마감했다. ECS·RDS·ALB·NAT Gateway·DNS Record·ACM 인증서는 생성하거나 변경하지 않았다. 자동 Image 삭제 정책도 만들지 않았다. ECR 보관 비용은 남으며 아래 2 GB 비용 가정은 실제 청구량이 아닌 초기 계산 기준이다. 남은 과업은 10/11 야간 또는 10/12에 재개하고, 업로드 승인을 나머지 배포 리소스의 생성·과금·DNS 변경·삭제 승인으로 확대하지 않는다.

Root의 MFA 활성화와 활성 Access Key 부재를 확인했다. 일상적인 사람의 접근에 사용할 별도 신원 구성은 남아 있으며, Root Access Key를 CI에 제공하는 방식은 사용하지 않는다. [AWS Root 사용 권고](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html)

## 실습 구성 후보

```text
주소 조회: Browser의 DNS 조회 → Cloudflare DNS → ALB의 주소
HTTPS: Browser → ALB HTTPS 443 → Helpdesk Task → Private RDS PostgreSQL
```

기존 Cloudflare DNS를 유지하고 `helpdesk.hmyoon.com`을 ALB로 연결하는 CNAME을 DNS-only로 두는 구성을 제안한다. DNS-only는 Cloudflare가 주소 조회에 응답하되 HTTP 요청을 Proxy하지 않는 방식이다. 첫 실습에서 CDN·Proxy·이중 TLS 경로를 추가하지 않고 ALB의 인증서와 Source IP 접근 제한을 직접 확인하기 위한 선택이다. 이 경우 Cloudflare의 HTTP 보호 기능은 사용하지 않으므로 ALB의 Inbound 제한을 별도로 유지한다. [Cloudflare Proxy와 DNS-only](https://developers.cloudflare.com/dns/proxy-status/)

ACM이 발급하는 도메인 검증 CNAME과 서비스 주소를 ALB로 연결하는 CNAME은 서로 다른 Record다. 두 Record를 구분하고, 인증서 검증 Record는 Proxy하지 않는다. AWS의 인증서는 AWS 밖의 DNS에서도 검증할 수 있다. 아직 Record나 인증서를 만들지 않았다. [ACM DNS 검증](https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html)

기존 Roadmap에서 선택한 Route 53 학습은 삭제하지 않는다. Hosted Zone·NS 위임·Alias를 Cloudflare와 비교하고, 별도 학습 Zone에서 직접 DNS 조회하는 실습을 유지한다. 메인 도메인의 Nameserver를 옮기거나 기존 서비스를 변경할 필요는 없다. 별도 Zone 생성은 AWS 승인 범위에 포함하며 추가 비용을 따로 계산한다.

처음에는 Fargate Linux x86의 1 vCPU·2 GiB, RDS PostgreSQL의 `db.t4g.micro` Single-AZ·gp3 20 GB를 비용 계산 후보로 둔다. 실제 기동·최대 메모리·응답을 확인한 뒤 필요한 크기를 확정한다. 로컬 Process의 한 시점 메모리만으로 충분하다고 판단하지 않는다.

NAT Gateway 없이 Task의 Public IP로 외부 AI·ECR·Log·Secret에 접속하는 후보를 먼저 검토한다. Public IP가 있어도 App의 Inbound는 ALB Security Group에서만 허용하고, RDS는 App에서만 접근한다. RDS의 Public Access는 사용하지 않는다. Private Task와 NAT·VPC Endpoint의 대안 비용도 생성 전에 비교한다.

실행 중인 Task는 한 개로 유지하고 교체 중 잠깐의 접속 중단을 허용한다. 사용자·Role·Secret·Provider·개인정보 처리기·Worker의 배포용 조립이 끝난 뒤 전체 AI 흐름을 검증한다. 먼저 Worker를 끈 서버·DB 연결을 확인할 수는 있지만 이를 최종 학습 완료로 기록하지 않는다.

## 배포용 사용자 구성 결정

10/12에는 주간 계획의 학습용 USER·AGENT를 Main 구성으로 연결했다. Local 전용 설정을 그대로 공개 배포하는 안과, 별도의 Profile·설정 이름으로 배포 계정을 제공하는 안을 비교해 후자를 선택했다. 기존 Security Filter Chain·PasswordEncoder·메모리 Session과 PostgreSQL 저장 경계를 유지한다.

`postgres,deployment`에서 `DeploymentSecurityConfiguration`이 실행 환경의 사용자명·Password를 받아 기존 Encoder로 Hash를 만들고 `InMemoryUserDetailsManager`에 등록한다. USER는 USER 권한, AGENT는 USER·AGENT 권한을 가진다. 회원가입·영속 사용자 관리와 새 인증 방식을 추가하지 않고 필요한 학습용 계정만 제공한다.

Password를 미리 Hash한 값만 받도록 새 입력 계약을 추가하는 안 대신, 기존 Encoder를 그대로 사용하는 실행 시 Hashing을 적용했다. Secret 전달로 받은 원문은 Process 설정에도 남으므로 전체 환경 변수·Log·Dump를 출력하지 않는다. 전달 값과 Hash는 Source·JAR·Image에 넣지 않는다.

필수 값 누락·공백, 두 사용자명의 대소문자 무시 충돌과 Local·In-memory Profile 혼용은 기동 오류로 거부한다. Local 설정이나 기본 계정으로 대체하지 않는다. `deployment`는 AI Provider·Worker를 자동 활성화하지 않는다.

영향 파일은 Lab의 `DeploymentSecurityConfiguration`·두 관련 Test·README와 WIL의 설정 학습자료·10/12 노트다. 설정·Main 사용자·실제 PostgreSQL의 [Focused Test 72개](./lab-reports/2026-10-12-deployment-users-and-receipt-tests.md)가 통과했다. ECS의 실제 Secret 전달·접근 제한·HTTPS·Cookie와 전체 AI 조립은 다음 검증 대상으로 남긴다. Secret은 아래 Standard Parameter Store 결정으로 구체화했고 여섯 Parameter와 Execution Role을 등록했다.

## 첫 연결용 실행 명세 후보

10/12에 Lab의 `deploy/ecs/task-definition.template.json`을 작성했다. 기본 App을 처음부터 실제 AI 호출까지 켜는 안과, AI를 끈 서버·DB·로그인 연결 뒤 전체 AI 흐름을 추가 검증하는 안 중 후자를 첫 실행 단계로 두었다. 마지막 완료 기준에서 AI·개인정보 처리·Worker를 제외하는 결정은 아니다.

초안은 기존 Image 검증과 같은 Linux·X86_64를 사용한다. ARM64 전환은 별도 Build·실행 검증과 비용 비교 대상으로 두며, CPU·Memory는 자리표시자로 남겼다. Image 표시 Size와 실행 메모리를 혼동하지 않고 대표 작업의 측정을 기준으로 최소 크기를 정한다.

일반 Environment에 Credential을 적는 안 대신 Secret 참조를 선택했다. 참조 여섯 개는 DB 계정·USER·AGENT 입력이며, 이후 Standard Parameter Store를 선택해 지정한 여섯 ARN의 형태로 보완했다. 실제 참조의 로컬 복사본은 Lab의 Git 제외 경로 `local/deployment/`에서 관리한다.

첫 구성의 Main은 JDBC·외부 HTTP를 사용하므로 Task Role은 초안에서 생략하고 Execution Role을 참조한다. 새 AWS API 기능이나 ECS Exec을 추가할 때 다시 검토한다. 사전 생성 Log Group 참조·자동 생성 비활성과 기존 로컬 수준의 종료 대기 45초를 후보로 두었다. Native Forwarded Header·보안 Cookie 설정도 실제 ALB 접근 제한과 Browser 검증을 함께 확인한다.

영향 파일은 Lab의 실행 명세·안내·구조 Test·Git 제외 설정·README다. [로컬 Image와 명세 보고서](./lab-reports/2026-10-12-deployment-image-and-ecs-draft.md)에 파일 확인과 JavaScript 152개 통과를 기록했다. 등록 전 RDS CA 신뢰·TLS URL, Secret·Role·Log 참조, Service·Network·ALB·DNS·최소 비용·생성 범위는 추가 확정해야 한다. 초안 작성은 AWS 등록·과금·리소스 생성 승인을 뜻하지 않는다.

## RDS 서버 인증서 검증 준비

Browser→ALB의 HTTPS와 App→RDS TLS를 별도로 검증한다. 검증을 끄고 연결하는 안, 실행 때 CA를 다운로드하는 안, 검토한 공개 CA를 Image에 포함하는 안 중 마지막 안을 선택했다. 연결 실패 시 우회하지 않고 취득 위치·CA Version·파일 권한을 재현할 수 있게 하기 위한 선택이다.

서울의 공식 공개 Root CA 묶음을 Lab의 `docker/rds/`에 보관하고 Manifest의 SHA-256·취득 위치·확인일과 Test로 관리한다. 모든 PEM 제외를 풀지 않고 이 공개 파일 한 개만 Build Context에 허용했다. Root 소유 파일 `0444`·디렉터리 `0555`로 제공해 App의 비Root 사용자에게 읽기·통과 권한만 허용한다. 초기 `444` 디렉터리의 읽기 실패를 실제 Image 검사에서 잡아 수정했다.

실행 명세의 JDBC URL은 `verify-full`·CA 파일 경로를 명시하고 Endpoint·DB 이름만 미확정 값으로 남긴다. 기본 DB 계정·Migration·Controller/Service/Repository 경계는 변경하지 않으며 실제 RDS의 계정·권한·Network·인증서 검증은 연결 단계에서 확인한다.

영향 파일은 Lab의 Dockerfile·Build Context 제외 규칙·공개 CA/Manifest/안내·ECS 초안·관련 Test·README와 WIL의 Network 학습자료·노트·보고서다. [공개 CA와 Image 보고서](./lab-reports/2026-10-12-rds-public-ca-and-image-preparation.md)에 로컬 파일 확인을 기록했다. RDS의 실제 TLS·권한 거부·CA 갱신 시 재검증과 새 CI Image 업로드는 후속 항목이다. AWS 리소스 생성이나 과금 승인 범위는 확대하지 않았다.

## 서울 요금에 따른 계산

### Secret 저장소 결정

10/12에 첫 App에 전달할 여섯 설정을 기준으로 Parameter Store와 Secrets Manager를 비교하고, 작성자가 권장안을 승인했다. **서울의 Standard SecureString 6개·Standard Throughput·AWS 관리 Key `aws/ssm`**을 선택했다. 작성자가 Console에서 값을 직접 입력해 여섯 항목을 등록했고, 이름·Standard Tier·SecureString Type을 확인했다. 별도 승인을 받아 Execution Role도 생성했으며 실제 ECS 전달은 아직 검증하지 않았다.

| 비교 항목 | 선택한 Parameter Store | Secrets Manager 대안 |
|---|---|---|
| App 입력 6개 | 설정마다 별도 Parameter | JSON의 여러 Field를 한 Secret에 묶을 수도 있음 |
| 저장·기본 API 요금 | Standard 저장·Standard Throughput은 별도 요금 없음 | Secret당 월 0.40 USD, API 10,000회당 0.05 USD |
| 교체 | 운영자가 대상 시스템과 새 Task 적용을 맞춤 | 자동 교체 기능을 선택할 수 있으며 대상·권한·비용도 함께 구성 |
| 초기 추천 이유 | 짧은 값·소수 계정·명시적 교체라는 현재 조건을 충족 | 자동 교체 등의 필요가 생기면 다시 비교 |

요금은 [Parameter Store 공식 가격](https://aws.amazon.com/systems-manager/pricing/#Parameter_Store)과 [Secrets Manager 공식 가격](https://aws.amazon.com/secrets-manager/pricing/)에서 확인했다. 아래 비용 예시도 Standard Parameter Store로 갱신해 기존 Secrets Manager 3개·월 1.20 USD 가정은 사용하지 않는다.

`aws/ssm`은 AWS 관리 Key로 생성·보관의 월 요금이 없지만 KMS API 요청은 별도 사용량이다. 계정 전체의 월 20,000회 무료 요청 범위 안이면 이 Secret 구성은 추가 비용 0원으로 예상한다. 무료분을 이미 소진한 경우에는 서울의 요청 단가를 적용한다. Advanced Parameter·Higher Throughput·Customer-managed Key는 추가하지 않는다. AWS 관리 Key의 정책을 직접 세분화할 수 없으므로 Parameter 읽기 IAM 권한을 필요한 항목으로 제한하고, 독립적인 Key 접근 통제가 필요하면 Customer-managed Key 대안을 재검토한다. [KMS 요금](https://aws.amazon.com/kms/pricing/), [서울 KMS 단가](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/awskms/current/ap-northeast-2/index.json)

App 입력은 DB 사용자명·Password, USER 사용자명·Password, AGENT 사용자명·Password다. 운영용 DB 관리자 Credential과 이후 외부 AI Key의 보관·전달은 별도 Inventory와 승인 범위에서 확인한다. 첫 App의 6개를 전체 운영 Secret 수량으로 일반화하지 않는다.

ECS Agent에 필요한 `ssm:GetParameters`는 Execution Role의 지정 여섯 ARN에만 허용한다. App의 Task Role이나 GitHub 업로드 Role에 읽기 권한을 추가하지 않는다. Lab의 `execution-role-policy.template.json`에는 ECR의 해당 Repository Pull·사전 생성 Log Group의 Stream 쓰기·지정 Parameter 읽기만 포함했다. Registry 인증 Token의 `Resource: "*"`와 지정 Log Group 안의 Stream 범위를 제외하고 대상 전체를 허용하지 않는다. 기본 `aws/ssm` 대신 Customer-managed Key를 선택하면 해당 Key 복호화 권한을 재검토한다. 실제 Parameter ARN·계정 번호·비밀값은 공개 초안에 적지 않는다.

Parameter 이름은 `/helpdesk/learning/` 아래 `db/username`·`db/password`·`user/username`·`user/password`·`agent/username`·`agent/password`로 나눈다. 기존 같은 이름이 있으면 덮어쓰지 않으며 모두 Standard Tier를 명시한다. 계정 전체가 이미 Higher Throughput을 사용하는 경우에는 다른 프로젝트의 설정을 임의 변경하지 않고 비용·변경 범위를 확인한다. 저장소의 DB Password만 바꾸는 것이 DB 사용자의 실제 Password를 바꾸는 것은 아니므로 교체 시 대상 시스템과 새 Task를 함께 확인한다.

10/12 Chrome Console의 서울 설정은 기본 처리량 40 TPS·Standard 기본 Tier였다. Helpdesk 이름과의 충돌은 보이지 않았으며 기존 다른 프로젝트의 항목은 변경하지 않았다. 각 생성 폼에 이름·Standard·SecureString·`alias/aws/ssm`을 준비하고 값 입력·생성은 작성자가 직접 수행했다. 마지막 등록 뒤 목록에서 여섯 이름과 Type·Tier·존재를 함께 확인했다. 실제 사용자명·Password와 복호화 결과는 읽거나 기록하지 않았다. 목록 확인으로 Key의 저장 후 메타데이터나 실제 전달·인증 결과까지 확인한 것은 아니다.

Permission Policy와 별도로 ECS Tasks의 Trust Policy 초안을 추가했다. 같은 Account·서울 ECS 요청으로 `sts:AssumeRole`을 제한하고, Permission Policy는 기존 지정 ECR·여섯 Parameter·한 Log Group을 유지한다. 새 Role을 만드는 안과 기존 다른 용도의 Role을 수정하는 안 중 전자를 선택했다. 기존 Role의 권한을 넓히지 않고 실행 주체별 경계를 유지하기 위한 선택이다. 실제 생성과 권한 연결은 적용 직전 승인받았다.

새 Role `helpdesk-ecs-execution`과 인라인 정책 `helpdesk-execution-minimum`을 생성했다. Log 대상은 서울의 `/ecs/helpdesk-learning` 한 Group으로 제한했다. 필요한 작업·리소스를 한 인라인 정책에 적고 더 넓은 관리형 정책은 연결하지 않았다. Role 상세 화면에서 연결 정책 한 개, 저장된 Trust·Permission JSON과 승인한 초안의 일치를 확인했다. 기존 다섯 Role은 변경하지 않았다. Trust 조건 Test 두 개 추가 뒤 JavaScript 전체 173개와 ESLint가 통과했다. 이후 아래 보존 결정에 따라 Log Group도 생성했으며 실제 ECS의 Role 사용과 Parameter·Log 전달은 후속 실행으로 검증한다.

영향 파일은 Lab의 ECS 명세·Execution Role 정책 초안·구조 Test·실행 안내와 WIL의 이 계획·주간 계획·설정 및 복구 자료·10/12 노트다. Secret 저장 방식의 승인 뒤 값 등록은 작성자가 직접 수행했고 새 Role 생성·지정 권한 적용은 별도로 승인받았다. ECS·RDS·ALB·DNS 생성·과금·삭제 승인은 별도로 확인한다.

### Log 보존 결정

초기의 7일 보존안은 짧은 보관 비용을 줄이는 기준이었다. 작성자가 1년 보존을 요청해 서울의 `/ecs/helpdesk-learning` 하나를 Standard 클래스·365일 보존으로 생성했다. 생성 폼의 `12개월(365일)`과 생성 후 목록의 이름·Standard 클래스·12개월 보존을 확인했다. 별도 KMS Key·추가 Log Group·App·RDS·ALB는 생성하지 않았다.

365일은 각 Log Event의 보존 기간이며 Group 자체의 자동 삭제 기한이 아니다. 만료된 Event의 실제 삭제에는 지연이 있을 수 있다. Group의 보존 설정이므로 이를 바꾸기 위해 Image를 다시 Build하거나 Execution Role을 넓히지는 않는다. [AWS 보존 설정](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Working-with-log-groups-and-streams.html), [지원하는 보존 일수](https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/API_PutRetentionPolicy.html)

영향 파일은 Lab의 README·ECS 실행 안내와 WIL의 이 계획·주간 계획·10/12 노트다. 월 3만 원 상한과 최소 지출 조건은 유지하며 1년 동안 누적되는 Log 저장량을 비용 검토에 포함한다. 실제 Task의 Log Stream 생성·출력 전달과 Log 내용의 Secret 노출 점검은 후속 실행에서 확인한다.

### 첫 연결의 App 사양 후보

10/12에는 배포용 Image를 CPU·메모리 무제한으로 실행해 추측하는 안 대신, Fargate의 최소 후보인 `0.25 CPU·512 MiB` 제한을 적용했다. Swap을 막고 `postgres,deployment`·AI Provider/Worker 비활성의 기동·로그인·접수·실제 PostgreSQL 저장과 순차 조회를 확인했다. 기존 Compose 검증에 선택적인 Override를 연결해 HTTP·DB 검증 로직을 복제하지 않았다.

독립 실행 두 번에서 조회 30회씩과 접수·권한 확인이 통과했다. cgroup 최고 메모리는 312.42 MiB·211.43 MiB, OOM·OOM Kill은 모두 0회였다. 큰 실행 사양을 먼저 선택하는 대신 이를 AI 비활성 첫 Cloud 연결의 최소 후보로 둔다. 전체 AI 사양은 개인정보 검사·Provider·Worker를 연결한 추가 측정과 Cloud 실행을 거쳐 정한다. [자원 측정 보고서](./lab-reports/2026-10-12-deployment-resource-probe.md)

영향 파일은 Lab의 Compose 검증 스크립트·측정 Override·Source 보호 Test·README와 WIL의 학습자료·노트·보고서다. 측정은 로컬의 HTTP Client를 사용했고 실제 Browser·RDS·Fargate는 실행하지 않았다. Task Definition의 CPU·Memory 자리표시자는 아직 바꾸지 않았으며, 전체 구성의 최소 비용과 생성 범위를 확인한 뒤 확정한다.

### 첫 연결의 비용 예시

무료 이용이나 Credit은 적용 여부를 모르므로 실행·Storage 계산에서 빼지 않았다. App은 로컬에서 확인한 AI 비활성 최소 후보로 낮추고 Secret은 선택한 Parameter Store를 적용했다. 월 60시간 실행·DB 20 GB·유료 Backup 20 GB·Image 2 GB는 비교용 가정이지 사용할 목표량이 아니다. Backup의 할당 용량이나 로컬 Image 표시 크기를 실제 청구량으로 취급하지 않는다.

| 항목 | 단가 | 계산에 사용한 양 | 예상 USD |
|---|---:|---:|---:|
| Fargate vCPU | 0.04656 / vCPU·시간 | 0.25 vCPU × 60시간 | 0.6984 |
| Fargate 메모리 | 0.00511 / GB·시간 | 0.5 GB × 60시간 | 0.1533 |
| RDS Instance | 0.025 / 시간 | 60시간 | 1.5000 |
| ALB | 0.0225 / 시간 | 60시간 | 1.3500 |
| ALB LCU | 0.008 / LCU·시간 | 평균 1 LCU × 60시간 | 0.4800 |
| Public IPv4 | 0.005 / IP·시간 | ALB 2개·Task 1개 × 60시간 | 0.9000 |
| RDS gp3 Storage | 0.131 / GB·월 | 20 GB × 한 달 | 2.6200 |
| 유료 Backup Storage | 0.095 / GB·월 | 20 GB × 한 달 가정 | 1.9000 |
| ECR Image 보관 | 0.10 / GB·월 | 2 GB × 한 달 가정 | 0.2000 |
| Standard Parameter Store | 보관·Standard Throughput 추가 요금 없음 | Standard SecureString 6개 | 0.0000 |
| Cloudflare의 기존 DNS 사용 | 신규 AWS Hosted Zone 없음 | 기존 도메인 유지 | 0.0000 |
| 실행·보관 소계 | | | **9.8017** |
| 별도 Route 53 학습 Zone 후보 | 0.50 / 월 | 학습용 1개를 생성할 경우 | 0.5000 |
| Route 53 실습을 포함한 소계 | | | **10.3017** |

서울의 Fargate·ALB·RDS 단가는 AWS의 공개 지역별 요금 데이터에서 확인했다. [ECS 요금 데이터](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonECS/current/ap-northeast-2/index.json), [ALB 요금 데이터](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSELB/current/ap-northeast-2/index.json), [RDS 요금 데이터](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/ap-northeast-2/index.json)

IPv4·ECR·Secret·Hosted Zone의 기준은 공식 요금 안내를 사용했다. Cloudflare의 기존 DNS에는 신규 AWS Hosted Zone 요금이 붙지 않는다. Cloudflare의 기존 계약이나 도메인 갱신 비용은 이 신규 AWS 계산에 넣지 않았다. [IPv4 요금](https://aws.amazon.com/vpc/pricing/), [ECR 요금](https://aws.amazon.com/ecr/pricing/), [Secrets Manager 요금](https://aws.amazon.com/secrets-manager/pricing/), [Route 53 요금](https://aws.amazon.com/route53/pricing/)

계산용으로 1 USD = 1,600원, 세금 10%를 가정하면 Route 53 실습을 포함한 소계는 약 **18,130원**이다. 이는 현재 환율이나 실제 세율을 확정한 값이 아니다. Log·Data Transfer·KMS API·RDS의 추가 CPU Credit·그 밖의 사용량을 위한 2 USD를 더하면 약 **21,650원**이다. 여유분도 강제 상한이 아니며 실제 사용량에 따라 달라진다. 1년 보존으로 누적되는 Log 수집·저장 비용은 실제 양을 확인해 별도로 계산하고, 다른 부가 비용과 함께 여유분을 초과하면 예산을 다시 검토한다. [CloudWatch 요금](https://aws.amazon.com/cloudwatch/pricing/)

실습의 생성·기동·정리 대기 시간도 실행 시간에 넣는다.

60시간은 사용자 학습 시간을 제한한다는 뜻이 아니라 Cloud 리소스의 월 실행 시간에 대한 초기 계산 가정이다. ALB와 DB를 남겨 두는 시간을 포함하며, 더 오래 필요하면 가정을 먼저 바꿔 예산을 재검토한다. ALB의 IP 수와 LCU가 늘거나 Log·전송량이 여유분을 넘으면 비용도 증가한다.

같은 실행 후보를 730시간 유지하면 Route 53을 포함한 소계 약 67.05 USD·약 118,000원으로, 월 3만 원 조건에 맞지 않는다. Image·설정·Backup의 보관과 서버의 상시 실행을 분리하는 이유다. AI·개인정보 처리기·Worker를 모두 켠 실행 사양은 추가 측정 뒤 별도 계산한다.

## 실습하지 않을 때의 보관과 재개

| 대상 | 짧은 휴식 | 장기 휴지기 기본안 |
|---|---|---|
| ECS Task | 실행 수를 0으로 내리면 해당 Task 실행 비용 중단 | Task Definition·Image Digest·설정 보관 |
| ALB | Task가 없어도 시간·IPv4 요금 발생 | 설정 기록·대상 승인 뒤 삭제하고 다음 실습에서 재생성 |
| RDS Instance | 중지 가능. Storage·Backup 비용은 유지 | 최종 Snapshot과 별도 복원 검증 후 승인받아 Instance 삭제·재생성 |
| ECR | Image 보관료 유지 | 현재 검증 Image와 이전 정상 Image만 보관하는 것을 기준으로 추가 Version 필요성 검토 |
| Parameter·IAM·ACM | 실행과 별개로 보관 | 여섯 Standard Parameter·필요 Role·비수출 ACM 인증서와 검증 CNAME 유지 |
| Snapshot·Log | 실제 보관량·기간에 따른 요금 확인 | 검증한 최신 Snapshot을 기준으로 보관, Log는 요청한 1년(365일)·필요한 비밀값 없는 근거는 별도 기록 |
| Route 53 학습 Zone | Cloudflare 서비스 Record와 별개 | 비교·직접 조회 실습 완료 후 대상 승인 뒤 정리, 불필요한 월 유지 없음 |

RDS는 중지한 지 7일이 지나면 자동으로 다시 시작된다. 따라서 12개월 동안 한 번 Stop해 두는 방식은 사용할 수 없다. [RDS 중지와 재시작](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html)

상시 실행, Task만 중지, ALB·DB Instance까지 정리하고 필요한 산출물만 보관하는 안을 비교해 **장기 휴지기는 마지막 안**으로 정했다. 실행이 필요하지 않을 때 ALB·DB Instance를 남겨두지 않되, 데이터 영속성과 복원 검증을 유지하기 위한 선택이다. NAT Gateway·상시 유료 VPC Endpoint·고정 Elastic IP는 첫 구성에 추가하지 않는다. 기존 다른 프로젝트의 리소스나 계정 전체 설정은 변경하지 않는다.

Snapshot 20 GB·ECR 2 GB만 한 달 유료 보관한다는 예시는 2.10 USD·약 **3,700원**이다. 실제 보관량·Log 잔여량·KMS 요청·별도 유지 항목은 추가되며 0원 또는 확정 청구액으로 표현하지 않는다. 최대 12개월 보관하는 동안에도 매번 새 복사본을 무제한 누적하지 않는다. 기존 Snapshot·Image 삭제는 보존할 대상과 복구 기준을 확인해 별도 승인받는다.

Route 53의 별도 학습 Zone은 조회·NS·Alias 비교를 마친 뒤 정리하는 대상으로 준비한다. 공식 요금은 월 일할 계산이 아니지만 생성 후 12시간 안에 삭제한 Zone에는 보관료를 부과하지 않는 Test 조건이 있다. DNS Query 과금은 별개이며, 메인 Cloudflare 도메인의 위임·기존 Record는 바꾸지 않는다. 필요하면 실습을 연장하고 0.50 USD 보관료를 적용하며 내용을 줄여 조건에 맞추지 않는다. [Route 53 Test 조건과 요금](https://aws.amazon.com/route53/pricing/)

### 실습 종료 순서

1. 합성 학습 환경의 접수를 중단한다. Worker는 새 Job을 시작하지 않도록 끄고 진행 중 요청·Attempt 상태를 확인한 뒤 App을 종료한다. Job·예약·실패 기록을 초기화하지 않는다.
2. Service의 `desiredCount=0`과 실제 Task 종료를 확인한다. 단독 실행 Task·교체 Task와 다른 자동 시작 경로도 남지 않아야 한다. 종료 근거에 Cookie·Token·환경 변수 값을 넣지 않는다.
3. 더 이상 DB 쓰기가 없음을 확인하고 마지막 Snapshot을 만든다. 원본을 유지한 채 다른 Instance에 복원해 Ticket·Message·Job·Suggestion·Category와 Migration을 확인한다. 검증 App의 AI는 꺼 둔다.
4. 삭제할 학습용 ALB·Target Group·원본 및 복원 DB Instance를 정확한 ID·Tag로 확인해 승인받는다. 최종 Snapshot이 `available`이고 복원 검증 결과가 있는지 대조한 뒤 삭제한다. 삭제 후에도 Snapshot은 남겨두며 Public 공유하지 않는다. [RDS 삭제와 Backup](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_DeleteInstance.html)
5. 더 이상 실행 Task·ALB·DB Instance가 없는지 재조회하고 남긴 Snapshot·Image·Log·Parameter의 수량과 요금을 확인한다. 쓰지 않는 서비스 DNS Record의 정리와 실제 Cloud 비용 반영도 별도 확인한다. 삭제 승인이나 DNS 변경 승인은 이 절차의 기록만으로 대신하지 않는다.

### 다음 실습의 재개 순서

1. 필요한 DB를 검증한 Snapshot으로 복원한다. 원래 VPC·DB Subnet Group·Security Group·DB Parameter Group을 명시적으로 연결하고 Public Access를 끈다. 기본 Group이 자동으로 원래 보안 설정을 복원한다고 가정하지 않는다. 새 Endpoint·DB 인증·TLS를 확인하고 복원이 끝나기 전에는 App을 시작하지 않는다. [RDS 복원 설정](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_RestoreFromSnapshot.html)
2. 같은 Parameter 이름을 유지하되 실제 DB 계정의 Password와 저장소의 값이 맞는지 확인한다. 새 JDBC Endpoint는 Task Definition의 비밀값 없는 설정에 반영한다.
3. ALB·Target Group·HTTPS Listener와 ACM 연결을 재생성하고, 승인된 서비스 DNS Record를 새 ALB 주소로 맞춘다. ACM 검증 CNAME은 서비스 CNAME과 구분한다.
4. 검증된 ECR Digest로 새 Task를 시작한다. 처음에는 AI를 꺼서 기존 미완료 Job의 추가 호출을 막고 Health·재로그인·기존 Row·Role·CSRF를 확인한다. 메모리 Session은 새로 만들어지므로 재로그인한다.
5. 필요한 경우에만 그날 승인된 AI 실험·전체 사양 측정을 이어간다. 이전 Job의 정책·예약·처리 기한을 새 값으로 초기화하지 않는다.

영향 파일은 이 계획·주간 계획·복구 자료·10/12 노트와 Lab ECS 안내다. 10/12의 로컬 명세·권한 구조 Test 13개, JavaScript 전체 171개와 ESLint가 통과했다. AWS의 실제 IAM 평가·Secret 전달·중단·복원은 아직 실행하지 않았다. 후속 검토는 실제 보관량·실습 간격·복원 소요 시간·월 지출과 추가 AI 사양 측정이다. 자동 삭제·상시 가동·새 유료 기능은 추가하지 않았다.

이 문서는 삭제나 자동 정리를 승인하지 않는다. 기존 리소스·DB·DNS를 변경하지 않으며, 보관 기간 종료 후에도 필요한 자료와 삭제 대상을 먼저 확인한다.

## 생성 전 확인할 순서

1. 확인한 Cloudflare의 기존 Record·수정 권한·DNS-only와 ACM 검증 방법을 점검한다. 같은 이름의 기존 Record를 임의로 덮어쓰지 않는다.
2. 계정에서 사용 가능한 Region·권한과 기존 리소스의 구분을 확인한다. 계정 번호·Credential은 공개 기록에 넣지 않는다.
3. 사용할 Task·DB·Network·ALB·Secret·Log·Backup의 최소 필요 크기·수량·실행 시간·보관 기간과 권한을 비교하고 예상 총비용을 갱신한다. 3만 원에 맞추는 대신 목적을 충족하는 최소 지출안을 선택한다.
4. 월 예산 알림과 실습 종료 체크리스트를 준비한 뒤, 리소스 생성·과금·DNS 변경 범위를 승인받는다.
5. 첫 배포 → HTTPS 수직 흐름 → 장애·Rollback → Backup 복원 순서로 검증한다.

AWS Budgets는 비용을 알려주는 수단이며 지연 없는 강제 상한이 아니다. 실습 종료 시 실제 실행 리소스와 보관 비용을 따로 확인한다. [AWS Budgets 안내](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)
