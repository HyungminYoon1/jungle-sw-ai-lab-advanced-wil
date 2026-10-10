# 검증한 Image를 ECR에서 ECS로 전달하기

Image를 만드는 컴퓨터와 그 Image로 Helpdesk를 실행하는 컴퓨터는 다르다. GitHub Actions Runner는 코드를 검사하고 Image를 만들며, ECR은 Image를 보관한다. ECS Fargate는 선택한 Image로 Container를 시작한다.

이 자료에서는 **검증한 코드가 어떤 Image가 되었고, 그중 무엇을 서버에서 실행하는지** 연결한다. IAM의 기본 개념과 OIDC 인증은 [IAM과 배포 Role 자료](./iam-oidc-ecr-and-deployment-roles.md), Build와 Test는 [CI 자료](./process-health-and-ci.md#ci에서-확인하는-것)를 먼저 읽는다.

## 코드 전달과 사용자 요청은 다른 흐름

배포할 때는 코드와 Image가 이동한다. 사용자가 접속할 때는 이미 실행 중인 Application에 HTTP 요청이 들어온다.

```text
코드와 Image 전달
  Git Commit
    → Actions Runner에서 Test와 Build
    → Container Image 생성
    → ECR에 Image Push
    → ECS가 Image Pull
    → 새 Container에서 JVM과 Spring 실행

사용자 요청
  Browser
    → ALB
    → 실행 중인 Helpdesk
    → PostgreSQL
```

ECR은 고객의 Ticket 조회를 처리하지 않는다. Actions Runner도 고객의 요청을 계속 받는 서버가 아니다. 업로드를 끝내고 Runner가 종료되어도, ECR의 Image와 ECS에서 실행 중인 Task는 서로의 수명에 따라 남는다.

## ECS에서 구분할 대상

| 대상 | 하는 일 | Helpdesk에서의 의미 |
|---|---|---|
| ECR Repository | Container Image를 보관한다 | 실행할 프로그램 파일을 가져오는 곳 |
| ECS Cluster | Task와 Service를 관리하는 논리적 묶음이다 | Application 실행을 관리할 범위 |
| Task Definition | Image·CPU·메모리·Port·설정·Role 등의 실행 구성을 정의한다 | Container를 어떻게 시작할지 적은 실행 명세 |
| Task | Task Definition으로 시작한 실제 실행 단위다 | Container 안에서 Helpdesk JVM이 실행되는 단위 |
| Service | 원하는 수의 Task를 유지하고 교체한다 | Helpdesk Task를 계속 실행하도록 관리하는 설정 |
| Fargate | Task를 실행할 컴퓨팅 환경을 AWS가 제공한다 | 직접 EC2의 운영체제와 Docker Engine을 관리하지 않고 Container 실행 |

Task Definition을 등록했다고 JVM이 시작되지는 않는다. 그 정의를 사용해 Task를 시작해야 한다. Task Definition의 Revision은 실행 명세의 버전이며 Git Commit과 별개의 번호다. [AWS Task Definition 설명](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html)

Service의 `desiredCount=1`은 Task 한 개를 유지하려는 설정이다. 관리 중인 Task 하나만 수동으로 종료하면 Service가 대체 Task를 시작할 수 있다. 실습을 쉬기 위해 실행 수를 줄이는 일과 Task 하나를 종료하는 일을 구분해야 한다. [AWS ECS Service 설명](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs_services.html)

`desiredCount=1`만으로 배포 도중에도 Task가 반드시 한 개만 실행되는 것은 아니다. 교체 시 허용할 동시 실행 수는 배포 설정에서 따로 정한다. 단일 JVM의 Session을 사용하는 학습 구성에서는 교체 중단과 재로그인을 고려한다.

## Role 생성과 실제 인증

AWS Console에 업로드 Role이 존재하는 것은 사용할 신원과 규칙을 준비한 상태다. 그 사실만으로 Actions Runner가 AWS에 인증된 것은 아니다.

실제 실행에서는 다음 단계가 필요하다.

1. 해당 Actions Job이 GitHub에 OIDC Token을 요청할 권한을 갖는다.
2. GitHub가 현재 Repository와 실행 문맥을 나타내는 Token을 발급한다.
3. AWS STS가 Token과 Role의 Trust Policy를 확인한다.
4. 허용되면 Runner가 임시 AWS Credential을 받는다.
5. 그 Credential로 ECR 인증과 업로드 작업을 요청한다.

OIDC Token, STS Credential, ECR Registry 인증 Token은 서로 다른 값이다. 어느 값도 Source나 Log에 출력하지 않는다. `id-token: write`는 첫 단계의 권한이며, Image 업로드 허용은 AWS Policy가 결정한다. [GitHub AWS OIDC 안내](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)

Trust Policy가 `main` Branch 문맥만 허용하는데 Job에 Environment를 추가하면 Subject 형식이 달라질 수 있다. Workflow의 편집과 Trust 조건을 함께 확인하며, 인증 실패를 없애려고 허용 Repository나 Branch를 통째로 넓히지 않는다.

## Commit과 Tag 그리고 Digest

세 값은 같은 버전을 서로 다른 관점에서 나타낸다.

| 값 | 식별하는 것 | 예 |
|---|---|---|
| Git Commit SHA | Git에 기록한 Source 상태 | `<COMMIT_SHA>` |
| Image Tag | Registry에서 Image를 찾는 이름 | `git-<COMMIT_SHA>-run-<RUN_ID>-attempt-<RUN_ATTEMPT>` |
| Image Digest | Registry의 Image Manifest 또는 Index 내용 | `sha256:<IMAGE_DIGEST>` |

Tag에 Commit SHA를 넣는 것은 사람이 출처를 찾기 위한 이름 규칙이다. Commit SHA가 Image Digest로 변환되는 것은 아니다. CI가 검사한 Commit, Build 결과와 업로드된 Digest의 관계를 함께 남겨야 한다.

같은 Commit을 다시 Build해도 바뀐 Base Image나 Build 입력 때문에 결과가 달라질 수 있다. 따라서 배포할 때 코드를 다시 Build하는 대신, 검사 후 업로드한 Image를 선택하고 Digest로 식별한다. Digest 참조의 형태는 다음과 같다. [Docker Image Digest 설명](https://docs.docker.com/dhi/explore/security-concepts/digests/)

```text
Tag로 찾기
  <ECR_REPOSITORY_URI>:git-<COMMIT_SHA>-run-<RUN_ID>-attempt-<RUN_ATTEMPT>

Digest로 지정하기
  <ECR_REPOSITORY_URI>@sha256:<IMAGE_DIGEST>
```

로컬의 Image ID와 Registry Manifest Digest는 같은 대상을 Hash한 값이 아닐 수 있다. 여러 Platform을 묶은 Image Index와 `linux/amd64`용 개별 Manifest의 Digest도 서로 다르다. 비교할 때는 값의 종류와 실행 Platform을 맞춘다. 숫자가 다르다는 이유만으로 다른 코드가 배포됐다고 단정하지 않는다. [Docker의 Multi Platform Manifest 설명](https://docs.docker.com/dhi/explore/security-concepts/digests/#multi-platform-images-and-manifests)

ECR의 Immutable Tag는 같은 Tag를 덮어쓰지 못하게 한다. 이미 사용한 Tag로 새 Push를 시도하면 충돌할 수 있다. 재실행에서는 기존 업로드 결과와 새 Build의 관계를 확인하거나 실행별 Tag를 사용하며, 오류를 없애려고 기존 Image를 무작정 삭제하지 않는다. [ECR Tag 불변 설정](https://docs.aws.amazon.com/AmazonECR/latest/userguide/image-tag-mutability.html)

Tag 예시의 `RUN_ID`는 Workflow 실행, `RUN_ATTEMPT`는 그 실행의 재시도 번호다. Actions에서 같은 실행을 다시 실행하면 `GITHUB_RUN_ID`는 유지되고 `GITHUB_RUN_ATTEMPT`가 증가한다. 다시 Build한 결과에 새 이름을 줄 때는 두 값을 함께 사용할 수 있다. [GitHub 실행 식별 변수](https://docs.github.com/en/actions/reference/workflows-and-actions/variables)

## 검증과 업로드와 배포의 연결

검증·업로드·배포를 나눈 구성은 다음처럼 이해할 수 있다. 이는 단계의 연결 예이며 그대로 실행하는 Workflow 파일은 아니다.

```text
검증 Job
  Java와 실제 PostgreSQL Test
  JavaScript Test와 정적 검사
  Image Build → 전달용 Artifact 저장
          ↓ 검증한 Image를 다음 단계로 전달
Image 업로드 Job
  전달받은 Image의 ID·Commit·Platform 확인
  OIDC 인증 → ECR Push → Digest 확인
          ↓ 실행 설정과 배포 범위 확인
Cloud 배포
  Task Definition에 Image Digest와 실행 설정 지정
  Task 시작 → Spring 기동 → DB와 Health 확인
          ↓
Browser에서 실제 업무 흐름 확인
```

검증과 업로드를 별도 Job으로 나누면 성공 의존 관계를 명시해야 한다. 별도 Workflow로 나누면 다른 Branch나 오래된 Commit의 검사 결과를 잘못 연결하지 않도록 출처를 확인한다. 일반 Test Job에는 AWS 인증 권한이나 실제 AI Key가 필요하지 않다.

이 예에서는 업로드 Job에서 다시 Build하지 않고 검증 단계가 만든 Image를 그대로 전달한다. 같은 Commit을 다시 Build하는 것과 같은 Image를 전달하는 것은 다르다. Artifact를 받을 때도 원래 Image의 식별 정보와 실행 Platform을 대조한다.

배포 기록에는 Commit·CI 실행·Tag·Registry Digest·실행 Platform·Task Definition Revision과 실행 Task의 Image 정보를 연결한다. Image 자체에는 DB Password·AI Key를 넣지 않는다. 실행 설정과 Secret의 주입은 [Spring 설정과 Bean 자료](./spring-settings-bean-and-secret-wiring.md)에서 다룬다.

## 실패한 단계 찾기

| 관찰 | 먼저 확인할 단계 |
|---|---|
| OIDC Role 사용 거부 | Token 요청 권한, Audience·Subject, Trust Policy |
| Registry 인증 성공 뒤 Push 거부 | 업로드 Action, 대상 Repository, Tag 충돌 여부 |
| ECR에 Image가 있지만 Task의 Pull 실패 | Execution Role과 ECR까지의 Network 경로 |
| Image Pull 뒤 Process 기동 실패 | Image·CPU Architecture·시작 명령·필수 실행 설정 |
| Task는 실행 중인데 실제 접속 실패 | ALB·Target·Port·Network·Application Health |

Registry에 파일이 있다는 것과 프로그램이 실행된다는 것을 나누면, 실패한 단계의 설정만 확인할 수 있다.

## 핵심 질문

1. 업로드 Role과 ECR Repository를 만들었다면 Actions Runner가 이미 AWS에 인증된 것인가? 임시 Credential은 언제 발급되는가?
2. 같은 Commit의 검사 결과가 있는데 배포 직전에 다시 Build한다면, 이전에 확인한 Image와 같다고 확신할 수 있는가?
3. ECR Push 성공, Task 실행, HTTPS 문의 접수 성공은 각각 무엇을 확인한 것인가?

## 핵심 질문 해설

1. **아직 인증된 것은 아니다.** 실제 OIDC Role 사용 요청을 STS가 허용한 뒤 해당 실행에 임시 Credential이 발급된다.
2. **다시 Build했다는 사실만으로 같다고 할 수 없다.** Build 입력과 결과가 달라질 수 있으므로 검사한 Commit과 업로드된 Digest를 연결하고, 배포에서는 그 결과물을 사용한다.
3. **Push는 Image 저장, Task 실행은 실행 단위의 시작, 접수 성공은 업무 요청의 처리 결과다.** 마지막 단계에서는 HTTP 응답과 실제 DB의 Ticket·Message·Job Commit을 함께 확인한다.

## 함께 읽을 자료

- [AWS Network와 DNS 그리고 HTTPS 요청 흐름](./aws-network-dns-and-https.md)
- [배포 장애 관찰과 복구](./deployment-observability-and-recovery.md)
