# IAM OIDC ECR 권한과 배포 Role

GitHub Actions가 Source를 읽고 Image를 만들 수 있어도 AWS에 그 Image를 올릴 권한까지 생기지는 않는다. ECR에 올릴 때는 AWS가 요청자의 신원과 권한을 따로 확인한다.

이 흐름에서는 먼저 **어떤 실행이 Role을 사용할 수 있는지**, 그다음 **그 Role로 어떤 AWS 작업을 할 수 있는지**를 구분한다. CI의 Workflow·Runner와 Image Build는 [Process와 CI 자료](./process-health-and-ci.md#ci에서-확인하는-것)에서 이어진다.

## IAM User Role Policy

IAM은 AWS 자원에 접근하는 신원과 권한을 관리하는 서비스다. User와 Role은 신원을 표현하고, Policy는 허용하거나 거부할 작업을 정한다.

| 개념 | 의미 | 예 |
|---|---|---|
| IAM User | AWS 계정 안에 만드는 사용자 신원 | 별도의 인증 수단을 가진 사용자 |
| IAM Role | 허용된 주체가 맡아 사용할 수 있는 AWS 신원 | GitHub Actions의 ECR 업로드용 Role |
| Policy | 작업·대상·조건에 대한 허용 또는 거부 규칙 | 특정 ECR Repository에 Image 업로드 허용 |

Role을 사용한다는 것은 Java 객체를 주입받는다는 뜻이 아니다. 허용된 주체가 AWS에 Role 사용을 요청하고, 발급된 임시 Credential로 그 Role의 권한을 사용한다는 뜻이다. 이 과정을 **Assume Role**이라고 부른다. Role 자체에는 고정된 Password나 장기 Access Key를 두지 않는다. [AWS IAM Role 설명](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html)

Helpdesk의 `USER`·`AGENT`는 Application 안의 권한이다. Ticket API 접근을 정하는 Spring Security Role과 AWS 자원 접근을 정하는 IAM Role은 별개다. Helpdesk에서 AGENT로 로그인했다고 ECR에 Image를 올릴 수 있는 것은 아니다.

## Role의 두 정책

GitHub Actions용 Role을 예로 들면 두 정책은 서로 다른 질문에 답한다.

| 정책 | 결정하는 것 | 예 |
|---|---|---|
| Trust Policy 신뢰 정책 | 누가 이 Role을 사용할 수 있는가 | 지정한 GitHub Repository의 허용된 실행만 Role 사용 |
| Permission Policy 권한 정책 | 사용한 Role로 무엇을 할 수 있는가 | 지정한 ECR Repository에 Image 업로드 |

Trust Policy가 통과해도 모든 AWS 작업이 허용되는 것은 아니다. ECR 업로드용 Role에 RDS 삭제 권한을 부여하지 않았다면, 그 Role로 Database를 삭제할 수 없어야 한다. 반대로 업로드 권한이 있는 Role이라도 Trust Policy가 거부한 실행은 그 Role을 사용할 수 없다. [AWS의 Trust Policy와 Permission Policy 설명](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html#id_roles_terms-and-concepts)

실제 AWS 요청에는 다른 Policy도 적용될 수 있다. 명시적인 `Deny`나 조직의 제한 등이 있다면 Role의 `Allow`만으로 이를 무시할 수 없다. [AWS Policy 평가](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html)

## GitHub Actions에서 AWS로 인증하는 순서

OIDC는 OpenID Connect다. 여기서는 GitHub가 Workflow 실행의 신원을 증명하고, AWS가 그 증명을 확인해 임시 Credential을 발급하는 데 사용한다. 장기 AWS Access Key를 GitHub Secret에 저장하는 방식과 다르다. [GitHub의 AWS OIDC 안내](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)

```text
GitHub Actions Runner
  1. GitHub에 현재 실행의 OIDC Token 발급 요청
  2. Token과 사용할 Role을 AWS STS에 전달
       → Token의 유효성과 Role의 Trust Policy 조건 확인
       → 허용되면 Role의 임시 AWS Credential 발급
  3. 임시 Credential로 ECR 인증과 Image 업로드 요청
       → 해당 작업·Repository에 대한 권한 확인
       → 허용된 Image 업로드 실행
```

STS는 Security Token Service다. `AssumeRoleWithWebIdentity` 요청에 대해 임시 Access Key ID·Secret Access Key·Session Token을 반환한다. GitHub의 OIDC Token은 실행 신원을 증명하는 값이고, STS의 Credential은 AWS 요청에 사용하는 값이므로 같은 것이 아니다. 임시 값도 비밀값이며 Source나 Log에 출력하지 않는다. [AWS STS 설명](https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRoleWithWebIdentity.html)

## GitHub 권한과 AWS 권한

아래는 Workflow 권한 부분만 나타낸 예다.

```yaml
permissions:
  contents: read
  id-token: write
```

`contents: read`는 GitHub Repository의 Source를 읽는 데 사용한다. `id-token: write`는 실행이 GitHub에 OIDC Token을 요청할 수 있도록 한다. 이름에 `write`가 있어도 ECR Image 업로드나 RDS 수정 권한을 주는 설정은 아니다. AWS 권한은 AWS 쪽 Role과 Policy에서 정한다. [GitHub의 OIDC Token 권한 설명](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws#adding-permissions-settings)

일반 Test Job과 AWS에 접근하는 Job의 권한도 분리한다. AWS 인증이 필요한 Job에만 Token 요청 권한을 두고, 어떤 Branch·Environment의 실행을 AWS가 신뢰할지 별도로 정한다.

## Trust Policy에서 확인할 신원

Token 안의 개별 정보를 Claim이라고 부른다. AWS가 GitHub OIDC 실행을 구분할 때 중요한 정보는 다음과 같다.

| Claim | 확인하는 것 | GitHub Actions에서 AWS에 연결할 때의 의미 |
|---|---|---|
| `iss` Issuer | 누가 Token을 발급했는가 | GitHub OIDC Provider |
| `aud` Audience | 누구를 위한 Token인가 | 공식 AWS 인증 Action을 사용하면 `sts.amazonaws.com` |
| `sub` Subject | 어떤 실행의 신원인가 | Repository와 Branch 또는 Environment 등 |

AWS에는 GitHub OIDC Provider를 등록하고, Role의 Trust Policy에는 허용할 `aud`와 `sub` 조건을 둔다. GitHub가 발급했다는 사실만으로 모든 Repository를 신뢰하지 않는다. [GitHub AWS OIDC 설정](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws#configuring-the-role-and-trust-policy)

Subject의 대표적인 형태는 다음과 같다. `OWNER`·`REPO`·ID·Environment 이름은 설명용 자리표시자다.

```text
Branch를 포함하는 형태:
repo:OWNER/REPO:ref:refs/heads/main

변경되지 않는 소유자와 Repository ID를 함께 포함하는 형태:
repo:OWNER@OWNER_ID/REPO@REPO_ID:ref:refs/heads/main

Environment를 포함하는 형태:
repo:OWNER/REPO:environment:ENVIRONMENT_NAME
```

Repository의 Subject 설정에 따라 ID가 함께 들어갈 수 있다. 이름만 있는 예제를 그대로 복사하기보다 실제 Subject 형식에 맞춰 조건을 작성한다. ID가 포함되는 Repository는 Environment 형식에도 같은 ID 정보가 포함된다. [GitHub Subject 형식](https://docs.github.com/en/actions/reference/security/oidc#immutable-subject-claims)

Job이 GitHub Environment를 사용하면 Subject의 실행 문맥은 Branch 대신 Environment로 표현된다. 이 경우 Environment의 배포 규칙으로 허용 Branch와 승인 조건을 함께 제한한다. Branch 형식만 허용한 Trust Policy에 Environment Job을 연결하면 조건이 맞지 않을 수 있다. [GitHub Environment의 Subject](https://docs.github.com/en/actions/reference/security/oidc#filtering-for-a-specific-environment), [GitHub Environment 보호 규칙](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws#configuring-the-role-and-trust-policy)

## ECR 업로드에 필요한 권한

ECR은 Container Image를 보관하는 Registry 서비스다. GitHub에서 Build한 Image를 ECR에 저장하는 것이 Push이고, 실행 환경이 이를 내려받는 것이 Pull이다. Push가 성공했다는 것은 Image가 저장됐다는 뜻이지 Helpdesk가 실행됐다는 뜻은 아니다.

권한 정책에서는 `Action`으로 작업을, `Resource`로 대상을 정한다. ARN은 Amazon Resource Name으로, 특정 AWS 자원을 식별하는 이름이다. ECR Repository ARN은 다음 형태로 표현할 수 있다.

```text
arn:aws:ecr:REGION:ACCOUNT_ID:repository/REPOSITORY_NAME
```

AWS가 제시하는 특정 Repository의 Push 권한 예는 다음 작업을 포함한다.

| Action | 하는 일 | Resource 범위 |
|---|---|---|
| `ecr:GetAuthorizationToken` | Registry 인증 Token 받기 | `*` |
| `ecr:BatchCheckLayerAvailability` | 이미 저장된 Layer 확인 | 지정 Repository ARN |
| `ecr:InitiateLayerUpload` | Layer 업로드 시작 | 지정 Repository ARN |
| `ecr:UploadLayerPart` | Layer 내용 업로드 | 지정 Repository ARN |
| `ecr:CompleteLayerUpload` | Layer 업로드 마무리 | 지정 Repository ARN |
| `ecr:PutImage` | Image Manifest와 Tag 등록 | 지정 Repository ARN |
| `ecr:BatchGetImage` | Image Manifest 조회 | 지정 Repository ARN |

`GetAuthorizationToken`은 특정 Repository ARN으로 제한하는 작업이 아니므로 `Resource: "*"`를 사용한다. 이 한 작업의 `*`가 모든 ECR 작업이나 RDS 삭제를 허용하는 것은 아니다. Layer·Image 작업은 대상 Repository로 제한한다. Registry 인증이 성공해도 업로드 작업 권한이 빠져 있다면 Push는 실패할 수 있다. [AWS의 ECR Push 권한 예](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-push-iam.html)

## Image 전달과 Application 실행의 Role

Image를 올리는 주체, 내려받아 Container를 준비하는 주체, Container 안의 Application은 서로 다르다.

```text
GitHub Actions
  → 업로드용 Role로 ECR에 Image Push

ECS Fargate의 실행 준비
  → Execution Role로 ECR에서 Image Pull
  → Container 실행과 지정된 Log 전송

Container 안의 Helpdesk
  → Application이 AWS API를 직접 호출할 때 Task Role 사용
```

| Role | 권한을 사용하는 주체 | 대표 작업 |
|---|---|---|
| Actions의 Image 업로드용 Role | GitHub Actions 실행 | ECR에 Image Push |
| ECS Task Execution Role | ECS·Fargate Agent | Image Pull, CloudWatch Log 전송, Task 설정에 지정된 Secret 가져오기 |
| ECS Task Role | Container 안의 Application Code | S3 등 필요한 AWS API 호출 |

Execution Role의 Credential은 Application이 직접 사용하는 Credential이 아니다. Application Code가 AWS API를 호출할 때는 Task Role의 권한을 사용한다. ECR Pull에 성공했다고 Application에 ECR Push나 RDS 삭제 권한을 줄 필요는 없다. [AWS Execution Role 설명](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html), [AWS Task Role 설명](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)

Secret을 누가 읽는지도 구분한다. ECS가 Task 설정의 Secret을 가져와 Container에 전달하면 Execution Role에 해당 Secret 접근 권한이 필요하다. Java Code가 Secrets Manager API를 직접 호출해 읽는다면 Task Role에 그 권한이 필요하다.

외부 AI Provider에 보내는 API Key는 AI Provider가 확인한다. PostgreSQL의 사용자명·Password를 사용하는 DB 연결은 PostgreSQL이 확인한다. 이 인증을 Task Role이 자동으로 대신하지는 않는다. RDS IAM Database 인증은 별도로 선택하고 구성하는 다른 방식이다. [AWS RDS 인증 방식](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html)

## 실패한 위치를 구분하기

다른 허용 정책이 없는 상황에서 다음 조건을 비교한다.

| 조건 | 막히는 위치 | 확인할 내용 |
|---|---|---|
| OIDC Token 요청 권한이 없음 | GitHub Token 요청 | 해당 Job의 `id-token` 권한 |
| Token의 Subject가 허용 조건과 다름 | Role 사용 요청 | Provider·Audience·Subject와 Trust Policy |
| Role은 사용했지만 Push 작업 권한이 없음 | ECR 업로드 | 요청한 Action과 Repository ARN |
| ECR Push는 성공했지만 Execution Role에 Pull 권한이 없음 | ECS의 Image 준비 | 업로드 Role이 아니라 Execution Role |

권한이 맞아도 Network 경로가 차단되면 AWS 서비스에 연결하지 못할 수 있다. 권한 거부와 연결 실패를 같은 문제로 취급하지 않는다. 오류를 없애기 위해 관리자 권한을 통째로 붙이기보다 거부된 작업과 대상을 먼저 확인한다.

## 핵심 질문

1. `contents: read`와 `id-token: write`만으로 ECR Push가 허용되는가? AWS에서 추가로 어떤 결정을 내려야 하는가?
2. Trust Policy가 `main` 실행만 허용하는데 다른 Branch가 Role 사용을 요청한다면, ECR 업로드 권한이 있어도 그 Role을 사용할 수 있는가?
3. Role 사용은 성공했지만 `GetAuthorizationToken`만 허용되어 있다면 Registry 인증 성공만으로 Push 성공까지 예상할 수 있는가?
4. GitHub Actions의 업로드 Role, ECS Execution Role, Application의 Task Role은 각각 누가 사용하는가?
