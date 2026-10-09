# Week 8 AWS 배포와 비용 초안

> 상태: 일부 실행 — OIDC Provider·ECR·Image 업로드 Role 초기 설정 완료. ECS·RDS·ALB·DNS·HTTPS 구성은 실행 전 검토
> 요금 확인일: 2026-10-09
> 진행 반영일: 2026-10-10 — 10월 9일 학습 회차의 연장 실행 포함

## 확인한 조건

- AWS 계정과 기존 도메인이 있다.
- Region은 서울 `ap-northeast-2`로 정했다.
- 최대 12개월 동안 학습 환경을 보관하되, 실습할 때만 실행해도 된다.
- AWS 월 지출은 3만 원 이내를 목표로 한다. 외부 AI 호출은 별도 당일 승인 범위로 관리한다.
- 학습용 주소는 `helpdesk.hmyoon.com`이며 기존 DNS는 Cloudflare에서 관리한다.
- AWS Console 접근과 OIDC·ECR·Image 업로드 Role의 생성 승인을 확인하고 해당 세 항목을 구성했다. DNS 수정 권한과 나머지 배포 리소스의 생성 범위는 확인 전이다.

ECR·ECS Fargate·RDS·ALB·DNS·HTTPS·Backup 복원은 [주간 계획](./weekly-plan.md)의 학습 범위를 그대로 유지한다. 비용을 줄이기 위해 해당 학습을 다른 서비스로 대체하거나 생략하지 않는다.

## 완료한 초기 설정과 승인 범위

10월 9일 회차를 이어서 실제 10월 10일에 다음 세 항목만 생성했다. 저장된 Trust Policy와 Permission Policy를 다시 읽어 입력한 제한 조건과 일치하는지 확인했다. 자세한 실행 근거는 [OIDC·ECR 초기 설정 보고서](./lab-reports/2026-10-10-aws-oidc-ecr-baseline.md)에 남겼다.

| 항목 | 현재 설정 |
|---|---|
| ECR | 서울의 Private Repository `ai-helpdesk-learning-lab`, Immutable Tag·AES-256, Basic Scanning 유지 |
| GitHub OIDC Provider | `token.actions.githubusercontent.com`, Audience `sts.amazonaws.com` |
| Image 업로드 Role | `helpdesk-github-ecr-push`, 실제 Lab Repository의 ID 포함 Subject·`main`만 신뢰, 해당 ECR의 Push 작업만 허용 |

장기 Access Key는 만들지 않았다. 신규 KMS Key·Enhanced Scanning·서명·복제·Pull-through Cache는 추가하지 않았다. IAM은 추가 이용 요금 없이 제공되지만, ECR은 이후 Image 보관량과 전송량에 따른 요금이 있으므로 전체 AWS 비용이 0원이라는 뜻은 아니다. [IAM 요금 안내](https://aws.amazon.com/iam/faqs/), [ECR 요금 안내](https://aws.amazon.com/ecr/pricing/)

Image 업로드와 실제 STS 인증은 아직 실행하지 않았다. 현재 검증 Workflow에는 AWS 인증·ECR Push가 없으며, ECS·RDS·ALB·NAT Gateway·DNS Record·ACM 인증서는 생성하거나 변경하지 않았다. 자동 Image 삭제 정책도 만들지 않았다. 이 초기 설정 승인을 나머지 배포 리소스의 생성·과금·DNS 변경·삭제 승인으로 확대하지 않는다.

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

## 서울 요금에 따른 계산

무료 이용이나 Credit은 적용 여부를 모르므로 계산에서 빼지 않았다. 아래는 사용량 가정을 둔 예상치이며 청구 상한을 보장하는 장치가 아니다.

| 항목 | 단가 | 계산에 사용한 양 | 예상 USD |
|---|---:|---:|---:|
| Fargate vCPU | 0.04656 / vCPU·시간 | 1 vCPU × 60시간 | 2.7936 |
| Fargate 메모리 | 0.00511 / GB·시간 | 2 GB × 60시간 | 0.6132 |
| RDS Instance | 0.025 / 시간 | 60시간 | 1.5000 |
| ALB | 0.0225 / 시간 | 60시간 | 1.3500 |
| ALB LCU | 0.008 / LCU·시간 | 평균 1 LCU × 60시간 | 0.4800 |
| Public IPv4 | 0.005 / IP·시간 | ALB 2개·Task 1개 × 60시간 | 0.9000 |
| RDS gp3 Storage | 0.131 / GB·월 | 20 GB × 한 달 | 2.6200 |
| 유료 Backup Storage | 0.095 / GB·월 | 20 GB × 한 달 가정 | 1.9000 |
| ECR Image 보관 | 0.10 / GB·월 | 2 GB × 한 달 가정 | 0.2000 |
| Secrets Manager | 0.40 / Secret·월 | 3개 가정 | 1.2000 |
| Cloudflare의 기존 DNS 사용 | 신규 AWS Hosted Zone 없음 | 기존 도메인 유지 | 0.0000 |
| 실행·보관 소계 | | | **13.5568** |
| 별도 Route 53 학습 Zone 후보 | 0.50 / 월 | 학습용 1개를 생성할 경우 | 0.5000 |
| Route 53 실습을 포함한 소계 | | | **14.0568** |

서울의 Fargate·ALB·RDS 단가는 AWS의 공개 지역별 요금 데이터에서 확인했다. [ECS 요금 데이터](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonECS/current/ap-northeast-2/index.json), [ALB 요금 데이터](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSELB/current/ap-northeast-2/index.json), [RDS 요금 데이터](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/ap-northeast-2/index.json)

IPv4·ECR·Secret·Hosted Zone의 기준은 공식 요금 안내를 사용했다. Cloudflare의 기존 DNS에는 신규 AWS Hosted Zone 요금이 붙지 않는다. Cloudflare의 기존 계약이나 도메인 갱신 비용은 이 신규 AWS 계산에 넣지 않았다. [IPv4 요금](https://aws.amazon.com/vpc/pricing/), [ECR 요금](https://aws.amazon.com/ecr/pricing/), [Secrets Manager 요금](https://aws.amazon.com/secrets-manager/pricing/), [Route 53 요금](https://aws.amazon.com/route53/pricing/)

계산용으로 1 USD = 1,600원, 세금 10%를 가정하면 Route 53 실습을 포함한 소계는 약 **24,740원**이다. 이는 현재 환율이나 실제 세율을 확정한 값이 아니다. Log·Data Transfer·Secret API·RDS의 추가 CPU Credit·그 밖의 사용량을 위한 2 USD를 더하면 약 **28,260원**이다. 실습의 생성·기동·정리 대기 시간도 사용 시간에 넣고, 실제 세금·환율·요금과 사용량을 확인해 다시 계산한다.

60시간은 사용자 학습 시간을 제한한다는 뜻이 아니라 Cloud 리소스의 월 실행 시간에 대한 초기 계산 가정이다. ALB와 DB를 남겨 두는 시간을 포함하며, 더 오래 필요하면 가정을 먼저 바꿔 예산을 재검토한다. ALB의 IP 수와 LCU가 늘거나 Log·전송량이 여유분을 넘으면 비용도 증가한다.

같은 실행 후보를 730시간 유지하면 소계 약 99.33 USD로, 월 3만 원 조건에 맞지 않는다. Image·설정·Backup의 보관과 서버의 상시 실행을 분리하는 이유다.

## 실습하지 않을 때

| 대상 | 짧은 휴식 | 장기 보관 후보 |
|---|---|---|
| ECS Task | 실행 수를 0으로 내리면 해당 Task 실행 비용 중단 | Task Definition·Image Digest·설정 보관 |
| ALB | Task가 없어도 시간·IPv4 요금 발생 | 승인 후 삭제하고 다음 실습에서 재생성 |
| RDS Instance | 중지 가능. Storage·Backup 비용은 유지 | Snapshot 복원 검증 후, 승인받아 Instance 삭제·재생성 |
| ECR·Snapshot·Secret·DNS·Log | 보관량·개수·요청에 따른 요금 확인 | 필요한 Version·Backup·설정과 보존 기간을 따로 관리 |

RDS는 중지한 지 7일이 지나면 자동으로 다시 시작된다. 따라서 12개월 동안 한 번 Stop해 두는 방식은 사용할 수 없다. [RDS 중지와 재시작](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html)

DB를 지우기 전에는 Backup이 있다는 표시만 보지 않고 다른 Instance에 복원해 Ticket·Message·Job·Suggestion과 Migration을 확인한다. 마지막으로 기록한 상태와 복원 시점을 대조한다. 진행 중 작업을 어떻게 멈추고 마지막 Snapshot을 만들지, 이후 변경을 허용할지는 정리 전에 확정한다.

이 문서는 삭제나 자동 정리를 승인하지 않는다. 기존 리소스·DB·DNS를 변경하지 않으며, 보관 기간 종료 후에도 필요한 자료와 삭제 대상을 먼저 확인한다.

## 생성 전 확인할 순서

1. 확인한 Cloudflare의 기존 Record·수정 권한·DNS-only와 ACM 검증 방법을 점검한다. 같은 이름의 기존 Record를 임의로 덮어쓰지 않는다.
2. 계정에서 사용 가능한 Region·권한과 기존 리소스의 구분을 확인한다. 계정 번호·Credential은 공개 기록에 넣지 않는다.
3. 사용할 Task·DB·Network·ALB·Secret·Log·Backup의 수량과 권한을 확정하고 예상 비용을 갱신한다.
4. 월 예산 알림과 실습 종료 체크리스트를 준비한 뒤, 리소스 생성·과금·DNS 변경 범위를 승인받는다.
5. 첫 배포 → HTTPS 수직 흐름 → 장애·Rollback → Backup 복원 순서로 검증한다.

AWS Budgets는 비용을 알려주는 수단이며 지연 없는 강제 상한이 아니다. 실습 종료 시 실제 실행 리소스와 보관 비용을 따로 확인한다. [AWS Budgets 안내](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)
