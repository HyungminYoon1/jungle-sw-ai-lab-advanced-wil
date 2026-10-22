# Week 8–9 WIL Docker와 AWS 배포 및 복구

> 학습 기간: 2026-10-08 ~ 2026-10-22
> 문서 수정일: 2026-10-23
> 상태: 최종 검토 완료. 핵심 실습과 검증을 마쳤으며 블로그 게시와 포럼 등록은 남음

## 학습 범위와 결과

기존 Helpdesk의 문의 접수와 AI 제안 흐름을 Docker로 실행하고 AWS의 HTTPS 환경에 배포했다. 배포 후에는 실제 문의 저장, 담당자 조회, 고정 합성 문의의 AI 처리를 확인했다. App 교체, 이전 Image 복귀, Snapshot 복원과 실습 리소스 정리까지 진행했다.

이 과정에서 프로그램 파일, 실행 중 객체와 영속 데이터가 서로 다른 수명을 가진다는 점을 배웠다. 같은 Image를 사용해도 설정에 따라 기동 결과가 달랐고, App 기동과 문의 저장, AI 처리의 성공도 각각 확인해야 했다. 배포를 한 번의 성공 여부로 보기보다 어떤 상태를 어디까지 확인했는지 구분하는 것이 중요했다.

초기에는 10/8, 10/9, 10/10, 10/12의 4일을 계획했으나 설정과 권한 구성, 실패 및 복구 검증이 연장돼 8–9주차 통합 학습으로 정리했다. 16일 회차의 자정 이후 실습은 16일 노트에 포함했고, 10/17과 10/18에는 별도 학습을 배정하지 않았다. 후속 대화와 공식 답변 등 업무 기능 확장은 이번 범위에서 제외했다.

관련 문서: [주간 계획](./weekly-plan.md), [일정 통합 결정](../plan/decisions/0004-combined-week8-9-deployment-learning.md).

## Docker와 실행 환경

Dockerfile은 JAR를 만드는 Build 단계와 실행 환경을 준비하는 Runtime 단계로 나눴다. Build에는 JDK와 Maven을 사용했고 실행 Image에는 JRE와 완성된 JAR를 넣었다. JAR에서 컴파일한 Class, 의존성 JAR와 Migration SQL을 확인했으며 Java Source와 Maven Wrapper는 포함하지 않았다.

Image를 Build한 상태와 프로그램이 실행 중인 상태도 구분했다. Image에는 실행에 필요한 정적 파일과 기본 설정이 있고, Container에서 Java 프로그램을 시작해야 JVM과 Spring 객체가 만들어졌다. 같은 Container를 다시 시작해도 이전 JVM의 메모리를 이어서 사용하는 것은 아니었다.

Cache 실험에서는 Source만 변경하면 의존성 준비 결과를 재사용하고 패키징을 다시 실행했다. POM의 의존성을 바꾸면 두 단계가 모두 재실행됐다. Source 복사를 의존성 준비 앞에 배치한 경우에는 Source 변경으로 의존성 준비까지 다시 실행됐다. 두 순서 모두 Build는 성공했으므로, 의존성 준비를 먼저 두는 이유는 Cache 재사용이었다.

Compose에서는 App과 PostgreSQL을 별도 Container로 연결했다. App의 `localhost`는 App 자신을 가리키므로 DB 서비스 이름과 내부 Port를 사용했다. DB Port는 Host에 게시하지 않았다. PostgreSQL 프로그램은 Image에서 실행하고 데이터 파일은 같은 Volume에서 읽도록 구성했다.

| 변경한 대상 | 문의 데이터 | 기존 로그인 Session |
|---|---|---|
| DB Container 교체, 같은 Volume 연결 | 유지 | App JVM이 계속 실행돼 유지 |
| 같은 App Container를 Stop한 뒤 Start | 유지 | 이전 Session 소실 |
| 같은 Image로 새 App Container 생성 | 유지 | 재로그인 필요 |

HttpSession은 App JVM 메모리에, 문의는 PostgreSQL에 저장했기 때문에 두 상태의 수명이 달랐다. App 재시작 후 기존 Cookie로는 인증되지 않았지만 재로그인하면 같은 문의를 조회할 수 있었다. 같은 Image로 프로그램을 다시 실행하는 것과 이전 실행 상태를 복원하는 것은 달랐다. 재시작 뒤에도 필요한 데이터는 Process 메모리와 별도로 보관해야 하는 이유를 확인했다.

실행 기록: [Image Build와 Cache](./lab-reports/2026-10-08-docker-image-build-and-cache-baseline.md), [Compose와 PostgreSQL](./lab-reports/2026-10-08-compose-http-postgresql-baseline.md).

## CI와 실제 배포의 확인 범위

GitHub Actions에서 Java Test와 실제 PostgreSQL Testcontainers, JavaScript Test, ESLint를 실행하고 통과한 뒤 Image를 Build했다. 일반 Push는 여기까지 수행했고, ECR 업로드는 별도 수동 실행으로 분리했다.

Publish Job은 같은 실행에서 검증한 Image를 전달받아 재Build 없이 업로드했다. Source Commit, ECR Manifest Digest와 실제 Task의 Image Digest를 대조해 검증한 프로그램과 실행한 프로그램을 연결했다. ECR 업로드와 Cloud App 실행은 각각 별도로 확인했다.

Fargate에서는 Task Definition에 Image, 자원과 Secret 참조를 지정한 뒤 Task를 시작했다. 실행 명세 등록만으로는 JVM이 시작되지 않았고, Task를 실행한 뒤 Spring 기동을 확인했다. 이 과정에서 ECS Task를 Container 실행 단위로 정리했으며 Thread의 작업이나 AI Agent와도 구분했다.

GitHub의 AWS 접근에는 장기 Access Key 대신 OIDC를 사용했다. Trust Policy에서 허용할 Repository와 Branch를 제한하고, Permission Policy에는 지정 ECR Repository의 업로드 권한을 뒀다.

| 권한을 사용한 주체 | 이번 실습에서 맡은 역할 |
|---|---|
| GitHub 업로드 Role | ECR에 검증 Image 전달 |
| ECS Execution Role | Image Pull, Parameter 읽기, Log 전달 |
| Task Role | App 실행 중 AWS API 접근. 이번 구성에서는 별도 사용하지 않음 |
| 배포 사용자 | MFA 후 승인한 학습 리소스의 설정, 실행과 조회 |

수동 배포 작업은 서울 Region과 MFA를 기본 조건으로 제한했다. 필요한 글로벌 DNS 작업은 별도 예외로 다뤘다. Console에서는 부가 목록 조회 거부와 실제 생성 요청 거부가 함께 나타나, 오류 개수보다 Action과 대상, 조건 및 실제 리소스 상태를 대조했다.

CI 통과는 정해둔 Test와 Build가 성공했다는 근거였고, 실제 배포 환경의 설정과 연결까지 보장하지는 않았다. Digest는 검증한 Image와 실행한 Image를 연결하는 기준이었으며, 그 프로그램이 Cloud에서 제대로 동작하는지는 기동 Log와 HTTP 응답, DB Row로 따로 확인할 수 있었다.

실행 기록: [첫 ECR 전달](./lab-reports/2026-10-10-verified-image-ecr-publish.md), [후속 Image 전달](./lab-reports/2026-10-20-ecr-image-publication.md).

## 실행 설정과 DB 연결

첫 Fargate Task는 Image를 받고 JVM을 실행했지만 PostgreSQL의 `28P01` 오류로 기동에 실패했다. JDBC 초기화 실패가 Spring Bean 생성 오류로 이어졌으며, 원인은 App DB Password 인증이었다. DB가 인증 오류를 응답한 경우를 연결 이전의 Network 차단과 구분했다.

작성자가 DB 로그인에 성공한 App 암호를 지정 Parameter에 다시 등록한 뒤 같은 Image와 같은 Task Definition으로 새 Task를 실행했다. 이후 JDBC 연결, Flyway Migration 7개와 Spring 기동이 성공했다. DB 계정과 권한, Security Group, Java 코드와 Image는 변경하지 않았다.

App 기동 실패가 곧 코드 결함을 의미하지는 않았다. 이번에는 같은 프로그램에 올바른 암호를 전달하는 것으로 복구됐다. Spring의 객체 생성 오류로 드러났더라도 원인은 그 안에서 시도한 DB 인증에 있었으므로, 겉으로 보이는 오류와 먼저 실패한 원인을 구분하는 것이 중요했다.

이 실험에서는 코드 변경과 실행 설정 변경을 별도로 적용했다. 기존 Parameter의 암호나 API Key 값만 바꾸면 같은 Image로 새 Task를 실행해 변경된 값을 받을 수 있었다. Java Configuration 코드가 바뀌면 새 Image가 필요했고, 자원이나 Secret 참조는 Task Definition, Subnet과 Security Group은 Task 실행 시 Network 설정에서 다뤘다.

외부 AI 서비스와 App 내부 Provider 객체도 구분했다. Provider 객체는 Task 시작 시 전달받은 설정으로 생성됐으며, 이미 실행 중인 객체가 Parameter 변경을 자동 반영하는 구성은 아니었다. Bean 등록 여부와 외부 서비스의 실제 인증 성공도 각각 확인할 대상이었다.

실행 기록: [첫 Cloud 기동과 DB 인증 복구](./lab-reports/2026-10-14-ecs-first-cloud-startup.md), [Network 구성](./lab-reports/2026-10-13-learning-network-and-security-groups.md).

## DNS와 HTTPS

실습 당시에는 Cloudflare DNS가 ALB 주소를 안내하고, HTTPS 요청은 ALB를 거쳐 App으로 전달되도록 구성했다. App은 별도의 Private RDS에 연결했다.

```text
DNS 조회: Cloudflare DNS → ALB 주소
업무 요청: Browser → ALB HTTPS 443 → App Private IP:8080 → Private RDS
```

서비스 Record는 DNS-only였으므로 Cloudflare가 HTTP 요청을 Proxy하지 않았다. 따라서 해당 요청이 Cloudflare Proxy의 HTTP 접속 기록에 없는 것을 실제 접속 0건으로 해석하지 않았다.

ACM의 검증 CNAME은 도메인 소유 확인에, 서비스 CNAME은 ALB 주소 안내에 사용했다. 같은 ALB에서 Task만 교체했을 때는 서비스 CNAME을 유지하고 Target Group에 새 Task의 Private IP와 8080을 등록했다.

ALB 접근은 학습자의 공인 IPv4 범위로 제한했다. App 8080은 ALB Security Group에서만 접근하게 하고 DB는 비공개로 뒀으며, DB 관리 통로는 별도로 준비했다. 학습 Network가 바뀌면 공인 IP 허용 범위도 다시 확인해야 했다. IAM 권한, Network 연결, DB 인증과 SQL 권한은 서로 다른 조건으로 점검했다.

HTTP 80에는 기존 443과 같은 IP 제한을 적용하고 HTTPS로 301 Redirect했다. Redirect가 이미 HTTP로 보낸 Password까지 보호하는 것은 아니므로 로그인 요청은 처음부터 HTTPS를 사용해야 했다.

Browser→ALB HTTPS와 App→RDS TLS는 각각 구성했다. RDS는 공개 CA와 `verify-full`로 인증서 및 Endpoint 이름을 확인했다. 관리 도구인 psql은 17.x로 맞췄으며 RDS 서버 버전 변경과는 분리했다.

Route 53은 기존 Cloudflare DNS를 유지한 채 하위 Zone과 TXT, Alias A로 실습했다. 권한 서버 직접 조회는 응답했지만 일반 Resolver에서는 `NXDOMAIN`이었다. 부모에서 NS를 위임하지 않은 결과였으며, Alias의 DNS 응답과 HTTPS 인증서 이름 일치도 별개의 확인 항목이었다.

실행 기록: [HTTPS 연결](./lab-reports/2026-10-15-cloud-https-baseline.md), [Route 53 조회 비교](./lab-reports/2026-10-21-route53-direct-query.md).

## 로그인과 비동기 작업 관측

로그인 직후 `/`에서 404가 나왔지만 같은 Session의 `/api/csrf`는 200이었다. 루트 리소스 부재와 인증 실패를 구분한 사례였다. Session Cookie는 Secure와 HttpOnly가 활성화돼 있었고 SameSite는 Lax였다. HttpOnly는 JavaScript의 Cookie 읽기를 제한하며 Browser의 자동 전송을 막는 속성은 아니었다.

같은 로그인 Session에서 CSRF Header 없는 접수는 403, 유효한 Header가 있는 접수는 201이었다. RDS에서 Ticket과 Message, 원문과 작성자 저장을 확인했다. AI를 끈 당시의 Job은 PENDING이었고 예약과 제안은 0건이었다.

요청 추적에는 `requestId`, 비동기 작업에는 `jobId`와 `attempt`를 사용했다. 새 Task에서 처리한 HTTPS 응답의 요청 ID와 CloudWatch Handler 완료 Log를 대조했다. 접수 HTTP 시간과 AI 처리 시간을 분리했고, Worker Tick에도 Claim과 검사, 외부 호출 및 저장 시간이 함께 포함된다는 점을 정리했다.

Job FAILED를 정상 조회한 HTTP 200은 조회 성공이었다. Health UP이나 DB의 RUNNING 상태만으로 AI 성공 또는 Worker의 현재 실행을 판단할 수는 없었다. RUNNING은 마지막으로 Commit된 상태이므로 Log 시각과 실행권, 기한을 함께 봐야 했다. Metric도 집계 기간과 Statistic을 확인했고 조회 거부나 데이터 부재를 정확한 0으로 기록하지 않았다.

관측값은 대상과 시점을 함께 알아야 해석할 수 있었다. 특히 접수 응답이 빠르다는 것과 AI 처리가 빠르다는 것은 다른 이야기였다. HTTP 요청, 비동기 Job과 외부 호출의 시간을 나눠 봐야 어느 구간에서 지연이나 실패가 발생했는지 좁힐 수 있었다.

실행 기록: [Session과 CSRF 접수](./lab-reports/2026-10-15-cloud-session-csrf-and-postgres.md), [Task 교체와 Cloud Log](./lab-reports/2026-10-20-ai-disabled-task-replacement.md).

## 검사 Process 종료와 자원

개인정보 검사기를 별도 Process로 실행하면서 종료와 자원 회수를 함께 검증했다. SIGTERM은 종료 요청, SIGKILL은 강제 종료로 구분했다. Timeout 결과를 반환한 뒤에도 검사 자식이 남을 수 있어 해당 요청에서 시작한 Process와 I/O Thread까지 회수하도록 했다.

Timeout은 기다림을 끝내는 조건이지 작업 종료를 보장하는 장치가 아니었다. 실패 처리에서는 오류 응답뿐 아니라 시작했던 작업과 사용하던 자원이 실제로 정리됐는지도 확인해야 했다.

검사기가 정상 JSON을 출력한 뒤 Exit Code 7로 끝나는 Case는 거부했다. 이번 계약의 정상 종료 코드는 0이었으며, 출력 형식과 종료 결과를 함께 확인했다. 7이라는 값 자체를 모든 프로그램에 공통된 오류로 해석하지는 않았다.

로컬 HTTP Provider와 실제 PostgreSQL을 연결한 실패 Test에서 Timeout과 비정상 종료 후 Provider 요청과 제안은 0건이었다. 접수 원문과 예약은 유지됐다. 예약을 검사 전에 Commit하므로 예약 1건과 전송 0회가 함께 존재할 수 있었다.

자원 실험은 실제 탐지 모델 대신 고정 합성 검사 프로그램을 사용했다. App과 검사 자식을 포함한 Container를 0.25 vCPU, 512 MiB로 제한해 다음 값을 관찰했다. 세 실행 모두 OOM은 없었다.

| 검사 Mode | 최고 메모리 |
|---|---:|
| 정상 | 300.26 MiB |
| Timeout | 460.54 MiB |
| 비정상 종료 | 265.88 MiB |

`VmSize`는 가상 주소 공간이므로 실제 RAM 사용량과 구분했다. cgroup의 현재 사용량과 Peak도 나눠 봤으며, 사용량이 줄어도 기록된 Peak는 유지될 수 있었다. Mode별 처리 전 사용량도 달라 표의 차이를 실패 종류만의 효과로 계산하지 않았다. 실제 개인정보 모델을 포함한 용량 측정은 후속으로 남겼다.

실행 기록: [검사 실패와 자원 회수](./lab-reports/2026-10-20-synthetic-runtime-failure-cleanup.md).

## Image 복귀와 DB 복원

### Image Rollback

기존 버전 A에서 준비 버전 P를 거쳐 B를 적용하고, 다시 P로 복귀했다. P에는 새 실패 코드를 읽는 Enum과 UI를 먼저 포함했고 B에는 새 실패 처리와 Schema Migration V8을 적용했다. V7과 V8은 PostgreSQL 엔진 버전이 아니라 Flyway의 Schema 변경 버전이었다.

```text
A / V7 → P / V7 → B / V8 → P / V8
```

B에서 새 실패 두 건을 합성 SQL로 저장한 뒤 P로 돌아와 기존 문의와 새 실패 코드를 조회했다. 일곱 Table의 건수와 내용 Hash는 유지됐고, DB를 V7으로 되돌리거나 원래 실패 코드를 다른 값으로 바꾸지 않았다. 이 두 Row는 실제 AI 실패가 아니라 조회 호환성 검증 자료였다.

프로그램을 이전 Image로 실행해도 DB는 변경된 Schema와 데이터를 유지했다. Image 복귀는 DB 변경을 취소하는 작업이 아니었으며, 이전 Image가 있다는 사실만으로 안전한 복귀가 가능하지는 않았다. 새 Schema와 데이터를 이전 프로그램도 읽을 수 있도록 준비하는 것이 복귀 경로의 일부였다. Task 교체 후에는 새 JVM에서 재로그인하고 같은 RDS의 문의를 다시 조회했다.

### Snapshot 복원

DB 복원은 원본을 유지하면서 Snapshot에서 별도 Private DB를 만드는 방식으로 진행했다. 초기 실험에서는 App을 복원 DB로 연결해 재로그인과 문의 조회를 확인한 뒤 원본으로 돌아왔다. 이후 실제 AI 제안이 생긴 상태에서는 최신 Snapshot을 다시 만들고 DB 내용 대조에 집중했다.

| 최신 원본과 복원 DB의 대조 대상 | 결과 |
|---|---|
| Ticket, Message, Job, Attempt | 각각 5건, 전체 내용 Hash 일치 |
| Suggestion, Category | 각각 1건, 전체 내용 Hash 일치 |
| Message 본문과 작성자 | 5건 모두 존재, 전체 Row Hash 일치 |
| Flyway | V1~V8 성공 이력 8건, Hash 일치 |
| 참조와 Sequence | 검사한 참조 누락 0건, 세 Sequence 값 일치 |

동일한 읽기 전용 SQL로 일곱 Table을 대조했다. 최신 복원 실험에서는 App과 Worker를 연결하지 않았고, 검증 후 임시 DB는 삭제했다. Snapshot 이후에 저장된 문의와 제안은 이전 Snapshot에 포함되지 않으므로 최신 상태의 복원도 별도로 확인했다.

Snapshot이 존재하는 것과 필요한 상태를 복구할 수 있는 것은 다른 문제였다. 실제로 별도 DB에 복원해 내용과 참조, Sequence를 비교해야 복원된 범위를 알 수 있었다. App 복구에는 DB 내용뿐 아니라 새 Endpoint 연결과 재로그인도 필요했다. 프로그램과 DB의 복구 절차를 나눠 확인한 이유였다.

실행 기록: [Image 복귀](./lab-reports/2026-10-16-image-rollback-cloud.md), [최신 Snapshot 복원](./lab-reports/2026-10-21-latest-snapshot-restore.md).

## 실제 Cloud AI 실행

고정 합성 문의 한 건만 처리하는 설정으로 실제 Provider와 Worker를 연결했다. 실행 Image의 Source는 `d8ca65f`, 사양은 0.25 vCPU와 512 MiB였다. 새 Job에는 생성 한도 1회와 보완 0회를 적용했다.

Ticket, Message와 Job은 각각 ID 5로 생성됐고 Job은 SUCCEEDED가 됐다. Suggestion과 Category는 각각 1건 저장됐으며 AGENT 화면에서 요약과 분류 ACCOUNT, 우선순위 UNDETERMINED, 검토 상태 PENDING_REVIEW를 조회했다. Ticket은 OPEN을 유지했다.

기존 Job 1/2는 Claim과 예약 이후 합성 입력 범위 검사에서 거부돼 FAILED로 바뀌었다. 기존 Ticket과 Message의 내용 Hash는 유지됐다. 문의 원문 보존과 Job 상태 불변을 별도로 다뤄야 하는 사례였다.

실험 후에는 Provider와 Worker를 끈 명세 :6으로 돌아와 재로그인하고 기존 문의와 제안을 조회했다. 저장된 제안을 다시 보여주는 데 새 AI 호출은 필요하지 않았다.

Cloud 실행에서는 실제 Provider 설정과 단일 시도 Transport, 생성 한도 및 저장 결과를 확인했다. 예약 건수를 외부 HTTP 횟수로 계산하지 않았으며 원격 HTTP Status, Token 사용량과 전송 Body의 별도 계측은 수행하지 않았다.

실행 기록: [합성 문의의 실제 AI 처리와 복귀](./lab-reports/2026-10-20-synthetic-cloud-ai-preflight.md).

## 리소스 정리와 재개

비용은 월 3만 원을 최대 금액으로 두고 실습 목적에 필요한 범위에서 최소화하기로 했다. RDS는 Stop 후 7일 자동 재시작과 Storage 비용이 있어 중지만으로 장기 보관하지 않았다.

서비스를 계속 실행하는 것과 나중에 재개할 수 있도록 보관하는 것은 달랐다. 실행 비용을 줄이려면 어떤 리소스를 없애도 되는지와 복구에 무엇이 필요한지를 함께 판단해야 했다. 최신 Snapshot의 복원을 먼저 검증한 것은 이 결정을 위한 근거였다.

10/22에 최신 Snapshot의 복원 결과와 원본 데이터를 대조한 뒤 원본 RDS, ALB와 두 Listener, Route 53 실습 Zone과 TXT/Alias A, Cloudflare 서비스 CNAME을 삭제했다. 서비스 CNAME이 권한 DNS에서 사라진 것을 확인하고 기존 TTL 이상 기다린 뒤 ALB를 정리했다.

수동 Snapshot 두 개, Secret, 365일 Log, ECR Image, ACM과 검증 CNAME, Target Group과 Network, Role 및 실행 명세는 보존했다. 실행 리소스 정리 후에도 보관 비용은 남을 수 있으며 실제 청구액은 확인하지 못했다.

다음 개발은 로컬에서 진행하기로 했다. Cloud가 필요하면 최신 검증 Snapshot에서 새 Private DB를 복원하고 새 Endpoint를 반영해야 한다. 새 ALB를 만들면 서비스 CNAME을 갱신하고 새 Task의 Private IP:8080을 등록해야 한다. 재개 시에는 AI를 끄고 TLS, 재로그인, 기존 문의와 제안, 권한 및 CSRF부터 확인할 계획이다.

실행 기록: [리소스 정리와 복구 자료 보존](./lab-reports/2026-10-22-deployment-resource-closeout.md).

## 검증 결과

10/22 Push CI에서 Source `832b1b74ab7666a5bf50c9aa702b14f97b517d59`의 최종 성공을 확인했다.

| 검사 | 결과 |
|---|---|
| Java Surefire, 실제 PostgreSQL Testcontainers 포함 | 1,014개 통과, 실패와 오류 및 건너뜀 0 |
| 패키징 후 Failsafe | 2개 통과, 실패와 오류 및 건너뜀 0 |
| JavaScript | 303개 통과, 실패 0 |
| ESLint, Docker Image Build | 통과 |
| ECR Publish | 일반 Push 조건에 따라 건너뜀 |

Test JVM이 `System.exit(0)` 뒤 30초 안에 끝나지 않아 Surefire가 정리한 기록도 남았다. 기능 Test는 통과했지만 종료 지연 원인은 후속 점검으로 남겼다.

이 CI는 실제 AI와 AWS App 실행을 포함하지 않았다. Cloud에 사용한 Image Source `d8ca65f`와 이후 정책, Test 및 문서 변경의 검증 Source를 구분했다. WIL 저장소에는 별도 CI Workflow가 없어 상대 링크, UTF-8, 줄바꿈과 대표 Secret Pattern을 로컬에서 점검했다.

근거: [Push CI Run 39794075525](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/39794075525).

## 범위 조정과 남은 과업

인물 관계 V2와 개인정보 모델 고도화는 배포 마감에서 분리했다. 기존 전송 차단과 원문 보존 정책은 유지하면서 설정 조립, Linux 실행, Timeout 회수와 제한 자원 검증을 먼저 마쳤다. 일반 입력의 AI 활성화는 별도로 검토하기로 했다.

학습 범위를 조정할 때도 배포에 필요한 실패 처리와 탐지 모델의 품질 개선을 구분할 필요가 있었다. 검사 실패 시 전송을 막고 자원을 회수하는 것은 이번 배포의 선행 조건이었지만, 탐지 정확도를 높이는 작업까지 같은 완료 조건으로 묶으면 배포 검증을 계속 미루게 됐다.

남은 작업은 다음과 같다.

- 블로그 초안의 작성자 검토, 공개 자료 및 재현 절차 점검, 게시와 포럼 등록
- 정리 권한과 Route 53 예외 회수, 보관량과 실제 비용 확인
- Test JVM 종료 지연 원인, 예약 원장의 결과 기록과 외부 호출 계측 보완
- 인물 관계 V2 연결, 탐지 품질과 관계 보존 개선

취업 우선 일정과 기술 과업 주 6시간 범위는 유지했다. 문서 마감을 위해 Cloud를 다시 실행하지 않고, 남은 구현은 필요한 범위부터 로컬에서 이어가기로 했다.

관련 결정: [배포 검증과 개인정보 고도화 분리](../plan/decisions/0009-deployment-first-and-deferred-privacy-enhancement.md).

## 학습 확인과 AI 활용

최종 복습에서는 설정 변경과 Image 재Build, Execution Role, DB 인증, HTTP 조회와 AI 결과, Image 복귀와 DB 복원, Session과 영속 데이터의 차이를 점검했다. 직접 설정을 수정한 사례는 DB Password Parameter 재등록 후 같은 Image의 새 Task 기동으로 확인했다.

Codex는 Dockerfile과 설정, Test 및 실행 도구 구현, 자료 초안과 Console 검증을 지원했다. 작성자는 핵심 문답과 원문 보존, 실패 정책, 권한과 복구 및 보관 범위를 검토하고 배포 중심의 범위 조정을 요청했다. 로그인과 MFA, 암호와 Key 입력, 지정 설정 수정과 Browser 및 SQL 결과 확인은 직접 진행했다.

관련 문서: [최종 복습 기록](./study-notes/2026-10-22-study-questions.md), [학습 및 콘텐츠 원칙](../plan/learning-and-content-plan.md).
