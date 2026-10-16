# 10월 10일 학습 노트 — ECR 업로드와 Cloud 요청 흐름

오늘은 검증한 Image를 ECR에 올리는 과정과, 그 Image를 실행해 Browser의 HTTPS 요청을 처리하기까지 필요한 구성 요소를 학습했다. ECR 업로드는 실제로 확인했고, ECS·RDS·HTTPS 연결은 다음 학습에서 진행한다.

## Image를 올리는 것과 Application을 실행하는 것은 다르다

ECR은 Container Image를 보관하는 Registry다. Image가 올라가 있어도 JVM이나 Controller 객체가 만들어지는 것은 아니다. Fargate에서는 내가 EC2를 직접 운영하지 않아도 Container를 실행할 수 있지만, Task를 시작하고 Spring Application이 기동되어야 요청을 처리할 수 있다.

```text
Source → JAR → Image → ECR
                        ↓ 실행 명세에 Image와 설정 지정
                   ECS Task → Container 안의 JVM → Spring 객체
```

Task Definition은 Image·CPU·메모리·Port·Secret 등의 실행 명세이고, Task는 그 명세로 실행한 단위다. Java의 Thread가 처리하는 작업을 뜻하는 것은 아니다. Task 하나에 Container가 여러 개 들어갈 수도 있으므로 Task 수와 Container 수를 같은 값으로 보면 안 된다.

Service의 `desiredCount = 1`은 Task 한 개를 유지하겠다는 뜻이다. Task만 종료하면 Service가 대체 Task를 시작할 수 있다. 실습을 멈추려면 원하는 실행 수를 0으로 바꾸는 것과 다른 리소스의 유지 상태를 함께 봐야 한다.

새 Task의 JVM은 이전 Task의 메모리를 이어받지 않는다. `HttpSession`은 사라질 수 있지만 같은 RDS에 Commit한 Ticket은 다시 읽을 수 있다.

## OIDC 인증과 AWS 작업 권한을 구분한다

GitHub Actions에서 OIDC Token을 요청하고, AWS STS가 Trust Policy를 확인해 Role의 임시 Credential을 발급한다. 이후 ECR 작업의 허용 여부는 Permission Policy가 결정한다.

| 구분 | 확인하는 내용 |
|---|---|
| `id-token: write` | GitHub 실행에서 OIDC Token을 요청할 수 있는가 |
| Trust Policy | 이 Repository·Branch의 실행이 해당 Role을 사용할 수 있는가 |
| Permission Policy | 해당 Role이 지정한 AWS 자원에서 어떤 작업을 할 수 있는가 |

ECR 로그인 성공과 Push 성공도 다른 단계다. Registry 인증이 되어도 Image 업로드에 필요한 Action이 허용되지 않으면 Push할 수 없다. 여기서 Push는 Git Commit이 아니라 Image를 AWS Registry에 올리는 작업이다.

업로드 Role·Execution Role·Task Role도 나눠서 이해했다. GitHub의 업로드 Role은 ECR Push에 사용한다. Execution Role은 ECS가 Image를 받고 Log·지정된 Secret을 준비할 때 사용하고, Task Role은 Application 코드가 AWS API를 호출할 때 사용한다. RDS 연결에는 Network와 DB 인증 조건도 별도로 필요하다.

## Network를 통과하는 것과 사용자 권한을 통과하는 것은 다르다

Cloud에서의 요청 경로는 다음과 같이 정리했다.

```text
Browser → DNS 조회 → ALB:443 → App:8080 → RDS:5432
                               └→ 외부 AI Provider
```

App에서 DB 주소의 `localhost`를 사용하면 App 자신의 실행 환경을 찾는다. RDS에는 해당 DB의 Endpoint로 접속해야 한다.

Security Group은 Network 접근을 제한하는 방화벽 역할을 한다. ALB→App과 App→RDS의 연결을 허용한다고 USER의 AGENT 전용 API 접근까지 허용되는 것은 아니다. 사용자 인증·인가·CSRF는 Spring Security에서 따로 확인한다.

서비스 CNAME은 학습 주소를 ALB 주소에 연결하고, ACM 검증 CNAME은 Domain을 관리할 수 있음을 증명한다. 인증서를 발급받는 것과 HTTPS Listener에 연결하는 것도 다른 작업이다.

Cloudflare의 DNS-only에서는 DNS 응답 뒤 Browser가 ALB에 직접 접속한다. Proxy를 켜는 것과 별도의 Load Balancing 기능을 사용하는 것은 같지 않다. ALB는 AWS의 Application Load Balancer 서비스다.

## Health와 업무 성공을 같은 뜻으로 보면 안 된다

처음에는 Health Check가 `401` 응답을 받으면 App이 응답했으므로 검사도 성공한 것으로 생각했다. 하지만 기대 Status가 `200`이면 `401`은 Health Check 실패다. 응답한 Process가 있다는 사실과 검사 조건을 만족했다는 사실을 나눠야 한다.

Health가 정상이어도 AI Job은 실패할 수 있다. HTTPS 연결 성공·로그인 성공·문의 접수·AI 제안 저장 역시 각각 따로 확인해야 한다.

ALB에서 TLS를 종료하는 구성이라면 Browser→ALB는 HTTPS이고, ALB→App은 별도 연결이다. HTTPS를 사용해도 Session·Role·CSRF 검사가 없어지는 것은 아니다.

Cookie의 `Secure`는 HTTPS로만 Cookie를 보내도록 제한하는 속성이고, `HttpOnly`는 JavaScript가 Cookie 값을 직접 읽지 못하게 하는 속성이다. 처음에는 `HttpOnly`가 Browser의 Cookie 자동 전송까지 막는다고 이해했지만, 요청에 Cookie를 붙이는 동작은 계속될 수 있다. 따라서 상태 변경 요청에는 CSRF 방어도 필요하다.

## 검증한 Image를 그대로 ECR에 전달했다

오늘의 Workflow는 일반 검증과 수동 Image 업로드를 분리했다. 검증 Job에서 만든 Image를 Artifact로 전달하고, 업로드 Job에서 Image ID·Source Commit·Platform을 확인한 뒤 ECR에 올렸다. 업로드 단계에서 다시 Build하지 않았다.

Tag는 Image에 붙인 이름이고 Digest는 내용 기반 식별자다. Tag만 보고 어느 실행본인지 판단하기보다 Commit·Actions 실행·Image Digest를 함께 연결해야 한다. ECR에 새 Image를 올려도 이미 실행 중인 Task가 자동으로 새 Image로 바뀌는 것은 아니다.

| 확인한 대상 | 실제 결과 |
|---|---|
| 수동 업로드 Actions | Java 551개·JavaScript 146개·ESLint·Image Build 통과, 실제 PostgreSQL Testcontainers 실행 |
| OIDC와 ECR | 기존 main 전용 Role로 인증하고 Image를 1회 업로드 |
| Image 식별 | Docker Push 결과·ECR 조회·Console의 같은 Tag와 Manifest Digest 확인 |
| 일반 Push Actions | 검증 성공, Publish Job은 Skipped |

Workflow 수정·실행과 Console 확인은 Codex의 도움으로 진행했다. 나는 실행 단위·권한·Network·Cookie의 차이를 문답으로 확인했다. 오늘 추가한 AWS 실행 근거는 ECR Image 업로드까지이며, 실제 AI 호출이나 ECS·RDS·HTTPS 배포는 하지 않았다. 자세한 Commit·Tag·Digest와 Actions 링크는 [ECR 업로드 보고서](../lab-reports/2026-10-10-verified-image-ecr-publish.md)에 정리했다.

## 다시 설명해볼 핵심 질문

1. ECR에 Image가 있어도 Controller가 요청을 처리하지 못하는 이유는 무엇인가? Task Definition·Task·Service는 각각 무엇인가?
2. Task를 종료하는 것과 Service의 `desiredCount`를 0으로 만드는 것은 어떻게 다른가?
3. OIDC Token 요청·STS의 Role 사용·ECR 로그인·Image Push는 각각 어떤 조건을 확인하는가?
4. 업로드 Role·Execution Role·Task Role과 RDS의 Network·DB 인증을 어떻게 구분하는가?
5. Security Group 통과가 USER의 AGENT 전용 API 접근 허용을 의미하지 않는 이유는 무엇인가?
6. 서비스 CNAME·ACM 검증 CNAME·HTTPS Listener 연결은 각각 무엇을 위한 작업인가?
7. Health Check가 기대하는 `200` 대신 `401`을 받았다면, 무엇을 확인했고 무엇이 실패한 것인가?
8. `Secure`와 `HttpOnly`는 각각 무엇을 제한하는가? `HttpOnly`여도 CSRF 방어가 필요한 이유는 무엇인가?
9. 같은 Commit을 다시 Build하는 것과 검증한 Image를 전달하는 것은 어떻게 다른가? ECR Push만으로 실행 중 Task가 바뀌는가?

## 다음 학습

배포용 설정·개인정보 처리·Worker·Secret의 전체 연결을 마친 뒤, 승인한 범위에서 Network·ECS·RDS·DNS·HTTPS를 연결한다. 권한 거부·복구, 종료 중 DB·Job 상태, Cloud 관측·Application Rollback·Backup 복원과 최종 회귀·WIL도 남은 Week 8 범위로 유지한다.

- [Image 전달과 ECS 실행](../study-docs/image-publishing-and-ecs-execution.md)
- [AWS Network·DNS·HTTPS](../study-docs/aws-network-dns-and-https.md)
- [배포 장애 관찰과 복구](../study-docs/deployment-observability-and-recovery.md)
- [Week 8 주간 계획](../weekly-plan.md)
