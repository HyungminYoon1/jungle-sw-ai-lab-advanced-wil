# GitHub OIDC와 ECR 초기 설정

> 학습 회차: 2026-10-09
> 실제 실행일: 2026-10-10 KST
> 결과: AWS Console에서 세 항목 생성과 저장된 정책 확인. STS 인증·Image Push·Application 배포는 미수행

## 목적과 실행 범위

GitHub Actions에서 장기 AWS Key 없이 학습용 Image를 올릴 준비를 했다. 사용자의 비용 최소화·초기 설정 승인을 받아 Codex가 Console을 조작했으며, 기존 리소스와 다른 프로젝트의 설정은 유지했다.

| 생성 항목 | 설정과 확인 |
|---|---|
| Private ECR | 서울 `ap-northeast-2`, 이름 `ai-helpdesk-learning-lab`, 01:29 KST 생성 |
| OIDC Provider | GitHub의 `token.actions.githubusercontent.com`, Audience `sts.amazonaws.com` |
| IAM Role | `helpdesk-github-ecr-push`, 01:36 KST 생성, 기본 최대 Session 1시간 |

AWS 계정 번호·실제 ARN·Credential은 공개 기록에 넣지 않는다. Root의 MFA 활성화와 활성 Access Key 부재를 확인했으며 장기 Key는 새로 만들지 않았다. Console 로그인과 CLI 인증 설정은 별개다.

## 실제 Repository Subject로 Trust Policy 제한

GitHub의 OIDC Subject 설정을 읽어 `use_immutable_subject: true`와 소유자·Repository ID가 포함된 형식을 확인했다. 이름만 쓰는 예제를 그대로 적용하지 않고, 현재 Lab Repository의 정확한 Subject에 `:ref:refs/heads/main`을 붙여 `StringEquals`로 제한했다. [GitHub AWS OIDC 안내](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)

공개용으로 ID를 자리표시자로 나타내면 다음 구조다. 저장한 정책에는 조회한 실제 ID를 사용했다.

```text
Principal: 등록한 GitHub OIDC Provider
Action: sts:AssumeRoleWithWebIdentity
aud: sts.amazonaws.com
sub: repo:HyungminYoon1@<OWNER_ID>/ai-helpdesk-learning-lab@<REPO_ID>:ref:refs/heads/main
```

Role 생성 후 Trust Policy를 다시 읽어 Provider·Action·Audience·Subject가 지정한 값과 일치하는지 확인했다. 다른 Branch나 GitHub Environment에서 실제 거부되는지 시험한 것은 아니다. Environment를 사용하는 Job으로 바꾸면 Subject 형식과 보호 규칙도 다시 검토해야 한다.

## Permission Policy는 한 Repository의 Push로 제한

Role에는 `HelpdeskEcrPushOnly` Inline Policy 한 개를 두고 관리자·ECR 전체 접근 Policy는 붙이지 않았다.

| 작업 | 허용 대상 |
|---|---|
| `ecr:BatchCheckLayerAvailability` | 학습용 ECR Repository |
| `ecr:InitiateLayerUpload`·`ecr:UploadLayerPart`·`ecr:CompleteLayerUpload` | 같은 Repository |
| `ecr:PutImage`·`ecr:BatchGetImage` | 같은 Repository |
| `ecr:GetAuthorizationToken` | `Resource: "*"`, 요청 Region은 서울로 제한 |

Registry 인증 작업은 특정 Repository ARN으로 한정하는 API가 아니므로 `*`를 사용한다. Layer·Image 작업의 Resource는 `arn:aws:ecr:ap-northeast-2:<AWS_ACCOUNT_ID>:repository/ai-helpdesk-learning-lab` 한 개다. 인증 Token을 받을 권한과 모든 Repository에 Push할 권한을 혼동하지 않는다. [AWS의 특정 Repository Push 권한](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-push-iam.html)

입력한 Policy와 저장 후 Console에서 읽은 JSON이 일치하는 것을 확인했다. 아직 실제 STS 임시 Credential 발급이나 Push의 성공·거부는 실행하지 않았다.

## 선택한 설정과 비용 경계

| 검토 대상 | 선택 | 이유와 후속 확인 |
|---|---|---|
| 장기 Key와 OIDC | GitHub OIDC | 장기 AWS Credential을 Repository Secret에 두지 않음. 실제 Workflow 연결은 다음 단계 |
| Tag 변경 허용 | Immutable, 예외 없음 | 같은 Tag를 덮어쓰기보다 Commit별 Tag·Digest로 배포본 식별 |
| AES-256와 KMS | AES-256 | 신규 KMS Key와 추가 과금 경로를 만들지 않음 |
| Basic와 Enhanced Scanning | 기존 Basic 유지 | Inspector Enhanced를 추가하지 않음. Scan-on-push는 활성화하지 않았으며 검사 결과는 아직 없음 |
| Image 정리 | 자동 삭제 정책 미설정 | 아직 Push하지 않음. 보관할 Version과 정리 대상을 먼저 결정 |

AES-256·Tag 설정은 Repository 생성 화면과 상세에서 확인했다. 서명·복제·Pull-through Cache도 추가하지 않았다. [ECR Repository 설정](https://docs.aws.amazon.com/AmazonECR/latest/userguide/repository-create.html)

ECS·RDS·ALB·NAT Gateway·새 Public IP를 만들지 않았고, DNS Record나 ACM 인증서도 변경하지 않았다. ECR 생성 자체를 월 예산 달성이나 배포 완료의 근거로 삼지는 않는다. Image 보관·실행·Backup 비용은 [배포 계획](../deployment-plan.md)에서 별도로 관리한다.

## 다음 검증

1. 성공한 검증 Commit에서 명시적으로 실행하는 Image 업로드 Workflow를 준비한다. OIDC 권한은 AWS 접근 Job에만 둔다.
2. 실제 STS 인증·ECR Push를 실행하고 Commit·Tag·Digest를 대조한다. 허용되지 않은 조건의 거부도 별도로 확인한다.
3. ECS Execution Role과 Application Task Role을 구분하고, Network·RDS·Secret·ALB·DNS·HTTPS의 구성과 비용을 확정한 뒤 생성 범위를 확인한다.

관련 구현 파일은 Lab의 `.github/workflows/verify.yml`이다. 초기 설정 당시에는 Java·JavaScript·ESLint·Image Build만 실행했다. 같은 날 뒤이어 진행한 실제 OIDC 인증·Image 업로드 결과는 [검증한 Image의 ECR 업로드 보고서](./2026-10-10-verified-image-ecr-publish.md)에 분리해 기록한다.

- [IAM·OIDC·ECR 학습자료](../study-docs/iam-oidc-ecr-and-deployment-roles.md)
- [Process·Health·실제 CI 보고서](./2026-10-09-process-health-and-ci-baseline.md)
