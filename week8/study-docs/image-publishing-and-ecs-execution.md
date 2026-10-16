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

### Workflow의 Commit과 프로그램 Source의 Commit

보통은 Workflow를 실행한 Commit과 Build할 Source의 Commit이 같지만 반드시 그래야 하는 것은 아니다. 예를 들어 main에서 관리하는 Workflow가 검토한 준비 버전 P의 특정 Commit을 별도로 Checkout해 Test·Build할 수 있다.

이때 AWS OIDC의 main 조건은 **어떤 실행 문맥이 Role을 사용할 수 있는지**를 검사한다. Checkout한 모든 파일이 main에서 왔는지나 그 Image가 안전한지를 AWS가 대신 검사하는 것은 아니다. 따라서 별도 Source를 허용하는 경로에는 정확한 Commit·기준 버전과의 관계·변경 경로·Hash 검증이 필요하다. [GitHub의 OIDC 실행 문맥](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)

학습 구성의 P 전달은 main에 고정한 Manifest가 Source를 결정한다. 임의 Branch나 SHA를 입력받지 않으며, 지정한 P의 운영 변경 두 파일과 검증 자료만 허용한다. P의 Test와 Build는 AWS 권한 없는 Job에서 수행하고, Publish Job은 그 실행의 Image Artifact를 확인한 뒤 기존 Role을 사용한다. Publish Job에서 P 코드를 실행하거나 Image를 다시 Build하지 않는다.

전달 이력에는 Workflow Commit과 P Source Commit을 따로 적는다. Image의 Revision Label은 프로그램 Source인 P Commit을 가리켜야 한다. 이전 로컬 Build와 새 CI Build는 Source의 내용이 같더라도 Label·Build 시점 등이 다를 수 있으므로, 로컬 Image ID를 새 CI Image의 Digest라고 기록하지 않는다.

## 첫 연결용 Task Definition 읽기

Lab의 `deploy/ecs/task-definition.template.json`은 AI를 끈 첫 접속용 초안이다. 실행 명세는 프로그램 파일을 다시 만드는 것이 아니라 선택한 Image에 실행 조건을 전달한다. 새 Java 코드를 넣었다면 먼저 새 Image를 검증해야 하지만, 설정값만 교체할 때는 같은 Image로 새 객체를 만들 수 있다.

| 필드 | 지정하는 것 |
|---|---|
| `image` | 검증된 ECR URI와 Manifest Digest |
| `cpu`·`memory` | Task의 실행 자원. Image 파일 크기와 다른 값 |
| `environment` | Profile·기능 활성화 같은 비밀이 아닌 실행 설정 |
| `secrets` | Credential 값 대신 Secret 저장소의 참조 |
| `executionRoleArn` | ECS Agent가 Image·Secret·Log를 준비할 때 쓰는 Role |

Task Role은 Application이 AWS API를 직접 호출할 때 필요한 권한이다. JDBC의 DB Password와 외부 AI Key만 사용하는 첫 구성에서는 Task Role을 자동으로 추가할 필요가 없다. 새로운 AWS 기능을 선택하면 그 호출 주체와 권한을 다시 확인한다.

`containerPort=8080`은 App의 수신 Port를 정한다. 이 값만으로 인터넷에서 접속할 수 있는 것은 아니다. ALB·Target Group·Subnet·Security Group 등의 실제 연결이 필요하다. Service의 실행 수와 교체 전략도 Task Definition의 필드가 아니다. [AWS Task Definition 안내](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html)

Image의 표시 Size는 프로그램 파일 계층의 크기다. 실행 중 JVM의 Heap·Metaspace·Native Buffer·Thread 등이 사용하는 메모리는 별도로 측정한다. Image 크기보다 메모리 상한이 크다는 비교만으로 실행 가능하거나 충분한 여유가 있다고 판단하지 않는다.

## 실행 메모리와 CPU를 측정하기

Image는 디스크에 저장하는 파일이고, 메모리는 실행 중인 Process가 사용하는 공간이다. JVM의 Heap에는 객체가 들어가지만 Container의 전체 메모리는 Heap보다 넓다. Class Metadata·Thread Stack·Native Buffer·파일 Cache 등도 영향을 준다. 메모리 상한을 정할 때는 기동과 실제 요청을 함께 실행해 확인한다.

Linux의 cgroup은 Container에 적용한 자원 상한과 사용량을 관리한다. `memory.current`는 현재 사용량, `memory.peak`는 해당 cgroup에서 기록한 최고 사용량이다. `memory.events`의 `oom`·`oom_kill`은 메모리 부족과 그로 인한 Process 종료를 구분하는 Counter다. 이 값은 JVM Heap만의 측정값이 아니다. [Linux cgroup 메모리 안내](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html#memory)

`docker stats`의 Linux 메모리 표시값은 Cache 일부를 빼서 계산한다. 따라서 그 화면에서 읽은 값과 cgroup 전체 사용량이 다를 수 있다. 잠깐 확인한 현재 사용량을 기동부터의 최고치라고 부르지 않는다. [Docker stats 안내](https://docs.docker.com/reference/cli/docker/container/stats/)

CPU가 부족하면 계산할 차례를 더 기다려 기동·요청 처리 시간이 늘 수 있다. CPU 제한 때문에 실행을 잠시 늦추는 것을 Throttling이라고 한다. 메모리 부족과 다른 현상이며 CPU Throttling이 있었다는 사실만으로 요청 실패라고 판단하지 않는다. 실제 응답과 처리 시간도 함께 확인한다. [Docker 자원 제한](https://docs.docker.com/engine/containers/resource_constraints/)

메모리와 CPU를 무제한으로 실행한 뒤 작은 Task에서도 같을 것이라 예상하는 대신, 후보 사양의 제한을 먼저 적용한다. Swap이 부족한 RAM을 대신해 결과를 바꾸지 않도록 조건도 명시한다. 순차 조회 몇 번이 통과하더라도 Worker·개인정보 검사·동시 요청·Session 증가·장시간 사용을 포함한 전체 실행 여유를 증명한 것은 아니다.

Fargate Linux는 CPU·Memory의 지원 조합을 사용해야 한다. 예를 들어 `0.25 vCPU`에서는 `512 MiB`를 선택할 수 있지만 `0.5 vCPU`에서는 최소 `1 GiB`가 필요하다. App을 작은 구성으로 검증할 수 있다면 큰 사양을 먼저 선택할 이유는 없으며, 필요한 흐름과 처리 시간을 만족하는 후보를 비용과 함께 비교한다. [AWS 지원 조합](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size)

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
4. Image의 표시 Size와 Task의 `memory`는 같은 대상을 측정하는가? 새 Task에 넣을 `image` Digest는 어디에서 확인해야 하는가?
5. Container의 전체 메모리와 JVM Heap은 왜 다르며, 현재 사용량과 최고 사용량은 무엇이 다른가?
6. CPU Throttling과 메모리 부족은 같은 현상인가? AI를 끈 순차 조회만으로 전체 AI Task의 사양까지 확정할 수 있는가?
7. main OIDC 인증을 통과하면 Image의 모든 Source도 main 코드라고 보증되는가? P를 별도로 Build했다면 어떤 두 Commit을 나누어 기록해야 하는가?

## 핵심 질문 해설

1. **아직 인증된 것은 아니다.** 실제 OIDC Role 사용 요청을 STS가 허용한 뒤 해당 실행에 임시 Credential이 발급된다.
2. **다시 Build했다는 사실만으로 같다고 할 수 없다.** Build 입력과 결과가 달라질 수 있으므로 검사한 Commit과 업로드된 Digest를 연결하고, 배포에서는 그 결과물을 사용한다.
3. **Push는 Image 저장, Task 실행은 실행 단위의 시작, 접수 성공은 업무 요청의 처리 결과다.** 마지막 단계에서는 HTTP 응답과 실제 DB의 Ticket·Message·Job Commit을 함께 확인한다.
4. **파일 계층과 실행 메모리이므로 다르다.** 실행 메모리는 대표 작업을 포함해 별도로 측정하며, 배포 Digest는 검증 뒤 업로드한 ECR Manifest와 대조한다. Local Image ID만으로 이를 대신하지 않는다.
5. **Heap 밖의 메모리와 Cache도 사용한다.** 현재 값은 관찰 시점의 사용량이고 최고치는 기동 중 일시적인 증가까지 포함해 기록한 값이다.
6. **서로 다르다.** CPU는 실행 시간을 제한하고 메모리는 사용할 공간을 제한한다. 전체 AI 사양은 개인정보 검사·Provider·Worker와 실제 실행 조건을 포함해 다시 측정한다.
7. **아니다.** OIDC는 실행 신원을 확인한다. 별도 Source는 따로 고정·검증하고 Workflow Commit과 실제 P Source Commit을 구분해 Image와 연결한다.

## 함께 읽을 자료

- [AWS Network와 DNS 그리고 HTTPS 요청 흐름](./aws-network-dns-and-https.md)
- [배포 장애 관찰과 복구](./deployment-observability-and-recovery.md)
