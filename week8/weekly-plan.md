# Week 8 학습 계획 Docker와 CI에서 AWS HTTPS 배포까지

> 작성일: 2026-10-07
> 상태: Planned — 일정 수립 완료, 학습·구현·배포 시작 전
> 1차 목표 기간: 2026-10-08 목요일 ~ 2026-10-12 월요일. 미완료 항목이 남으면 Week 8 기간 연장
> 학습일: 10/8·10/9·10/10·10/12, 총 4일
> 제외일: 2026-10-11 일요일, 0시간
> 초기 순학습 시간 배분: 하루 10시간, 총 40시간. 휴식·식사와 단순 대기 시간 제외. 완료에 필요한 시간의 상한은 아님
> 모드: `DEEP_LEARNING_MODE`
> 핵심 질문: 이미 검증한 문의 접수와 AI 제안 흐름을 Cloud의 HTTPS 환경에 배포하고, 실패 원인을 찾으며 이전 실행 상태로 복구할 수 있는가?

## 계획 배경

7주차에는 Browser 접수부터 자동 Worker·실제 AI·PostgreSQL·담당자 조회까지 연결했다. 10/5 회차 이후 이틀을 더 사용해 10/7에 학습과 WIL 공개를 마쳤다. 8주차는 그 흐름을 새로운 실행 환경으로 옮기는 학습이다. 화면이나 업무 기능을 늘리지 않고, 같은 코드가 어디서 실행되며 데이터와 Secret은 어디에 남는지 확인한다.

Docker·CI·System·관측·IAM·ECS·ECR·RDS·DNS·HTTPS·복구를 모두 유지한다. 우선 4일에 집중 배치하고, 실제 이해·구현·검증 속도를 보고 필요한 만큼 기간을 연장한다. 4일에 맞추기 위해 선택한 내용을 빼지는 않는다.

40시간은 이번 배분을 위한 추정치다. 하루 10시간 안에 모두 끝난다고 보장하는 일정은 아니며, 설정 문제를 해결하는 데 시간이 들었다고 개념 설명·실패 실험·복구·복습 시간을 생략하지 않는다. 미완료 학습은 같은 Week 8 과제로 이어간다.

## 이번 주 목표

| 주제 | 설명할 내용 | 직접 확인할 근거 |
|---|---|---|
| 실행 환경 재현 | Image·Container·Process·Network·Volume의 차이 | Docker Build 비교, Compose 저장·조회와 재생성 후 Row 유지 |
| 변경 검증과 배포 | CI 성공, Image 생성, 배포 성공이 서로 다른 이유 | 실제 Actions 실패·복구, ECR Digest와 ECS 실행 Image 대조 |
| Cloud 요청 흐름 | DNS·TLS·ALB·Security·RDS와 IAM의 역할 | HTTPS 로그인·접수·AI 처리·담당자 조회, 권한·Cookie·DB 확인 |
| 장애 관찰과 복구 | Process 종료, Health 실패, AI 실패와 DB 손실의 차이 | Signal·Exit Code, CloudWatch Log·Metric, 이전 Image 복귀와 Backup 확인 |

### 빠짐없이 다룰 세부 범위

아래 항목은 4일에 모두 배치한 필수 범위다. 날짜를 넘겨도 항목 자체를 선택 과제로 낮추지 않는다.

| 학습 묶음 | 세부 개념과 구현 | 실험에서 확인할 것 | 배정일 |
|---|---|---|---|
| Docker Build | Image·Container·Layer, Dockerfile, Build Context·`.dockerignore`, Build Cache | Layer 순서와 변경 파일에 따른 Cache Hit·Miss, 같은 Source에서 실행 환경 재현 | 10/8 |
| Compose와 영속성 | Service Network·Port, 환경별 설정, Volume, 준비 완료와 시작 순서 | 실제 PostgreSQL 저장·조회, Container 교체와 Volume 유지, 같은 DB 재연결 | 10/8 |
| 배포용 실행 설정 | Provider Adapter·Worker·검증기 연결, 사용자·Role, Secret 주입 | 필수 설정 누락 시 실패, 기본 유료 호출 비활성, 허용한 구성에서 기존 업무 흐름 실행 | 10/8·10/10 |
| Linux System | Process, `/proc`, Signal·Exit Code, Graceful Shutdown, 표준 출력과 CLI Log Pipeline | 정상 종료와 강제 종료의 차이, 요청·DB Connection·Job·Session의 남은 상태 | 10/9 |
| CI와 Image 전달 | GitHub Actions Build·Test·정적 검사·Image Build, ECR Tag·Digest | 실제 CI 실패와 복구, 검증한 Commit과 배포 Image의 대응 | 10/9·10/10 |
| IAM과 Network | User·Role·Policy·최소 권한, OIDC, Task Role·Execution Role, Subnet·Security Group·Outbound | IAM 거부와 Network 차단의 차이, 필요한 권한만 추가한 뒤 성공 | 10/8·10/9·10/10 |
| Cloud와 Database | ECS Service·Task와 ECR의 책임, RDS 관리 범위, Migration·DB 접속 | 실제 RDS Row, Application 재배포 후 보존, 운영자가 여전히 책임지는 설정·데이터 | 10/10·10/12 |
| DNS와 HTTPS | Route 53, DNS 조회·검증, ACM, TLS 신뢰 사슬·종료 위치, HTTP Redirect | 올바른 Hostname의 인증서, HTTPS 요청, Secure Cookie·Session·Role·CSRF | 10/10 |
| 관측 | 구조화된 Log, Request ID·Job ID, Health, Request·Error·Latency Metric, CloudWatch | 실패 Request를 Log와 Metric에서 찾아 원인 계층 설명, Secret 노출 여부 | 10/9·10/12 |
| 복구와 마감 | 이전 Image로 Rollback, RDS Backup 보존·Snapshot 복원, 회귀·재현·비용 정리 | 앱 Version 복귀와 DB 복원 구분, 복원 DB의 실제 Row, WIL과 수직 흐름 설명 | 10/10·10/12 |

## 시작 기준과 먼저 연결할 부분

| 항목 | 7주차 마감 기준 | 8주차에서 할 일 |
|---|---|---|
| 업무 흐름 | 최초 Message·Job의 접수 원자성, 별도 AI 처리·제안 저장, AGENT 조회 구현 | 같은 Controller·Service·Repository 경계를 유지해 배포 |
| 회귀 근거 | Java 461개·JavaScript 145개·ESLint, 별도 실제 Browser·AI 연결 실험 | Container·CI·Cloud 변경 뒤 다시 실행하고 환경별 결과를 구분 |
| 실제 AI 실행 | 격리된 실험에서 Spring AI와 자동 Worker 연결 확인 | Test 전용 구성이 아닌 배포용 Provider·개인정보 처리·검증기·Worker 설정 연결 |
| 사용자와 Session | `local-browser`의 In-memory 사용자와 서버 메모리 Session | 학습용 배포 계정·Secret 주입을 분리하고 재시작 후 재로그인 확인 |
| 데이터 | PostgreSQL Adapter·Flyway와 같은 DB를 유지한 Process 재시작 검증 | Compose Container 재생성·Volume 유지, 같은 RDS를 유지한 Application 재배포와 Backup 확인 |
| 배포·관측 | Dockerfile·Compose·Actions Workflow와 배포용 Health·Metric은 준비 대상 | 최소 설정·Test·실제 실행을 단계별로 추가 |

현재 Worker는 활성화 설정 외에 Provider·개인정보 처리기·출력 검증기를 명시적으로 제공해야 한다. Image만 만들거나 Worker 설정값만 켜는 것으로 실제 AI 배포가 끝나지는 않는다. 배포용 설정의 누락·잘못된 조합을 안전하게 거부하고, 기본 실행이나 일반 CI가 유료 호출을 시작하지 않도록 Test를 둔다.

## 학습과 구현의 경계

### 유지할 구현 범위

- Spring Application 한 개 안에서 기존 API와 Worker를 실행하고 PostgreSQL에 저장한다.
- Browser UI와 API는 같은 Origin을 사용한다. Session·Role·CSRF 계약은 그대로 유지한다.
- 최초 문의 등록·Ticket 조회·AI 제안 조회만 대상으로 한다. AI가 Ticket 상태를 바꾸거나 공식 답변을 게시하지 않는다.
- 외부 AI 호출은 합성 문의로 검증하고 실행 전에 당일 호출 범위와 비용 조건을 확인한다. 이전 날짜의 승인을 자동으로 이어 쓰지 않는다.

### 배포 구성 초안

기존에 선택한 AWS 서비스를 사용하는 한 환경을 구성한다. ECR에 Image를 저장하고 ECS Fargate에서 Application 한 개를 실행하며, RDS PostgreSQL에 데이터를 둔다. Browser는 Route 53의 DNS와 ACM 인증서를 사용하는 ALB를 거쳐 HTTPS로 접근한다. ALB는 요청을 Application으로 전달하는 진입점이며 이번에 여러 Application으로 부하를 분산하는 기능을 학습 범위에 추가하지 않는다.

실제 리소스 생성 전에는 다음 조건을 검토해 배포 기록에 확정한다.

- **단일 실행:** Task 교체 시 기존 실행 종료를 확인하고 새 실행을 시작하는 중단 허용 방식을 우선한다. 분산 Session·여러 Worker와 무중단 배포는 추가하지 않는다. Session은 사라져도 Ticket·Message·Job·Suggestion은 RDS에 남아야 한다.
- **접근 제한:** 합성 데이터와 학습용 USER·AGENT만 사용한다. 학습자 접속 IP로 진입 범위를 제한하고, Application은 ALB에서만, RDS는 Application에서만 접근하도록 한다. RDS를 인터넷 전체에 공개하지 않는다.
- **사용자 설정:** Local 전용 설정을 그대로 공개 배포하지 않는다. 배포용 설정에서 사용자·Password Hashing·Role을 제공하고 필수 값이 없으면 기동을 거부한다. 회원가입·영속 사용자 관리 기능은 이번 범위에 추가하지 않는다.
- **외부 연결:** ECR·Log·Secret·AI Provider로 나가는 경로도 필요하다. Public IP와 제한된 Inbound를 쓰는 구성, Private Subnet과 NAT 등을 쓰는 구성의 비용·노출 차이를 비교하고 첫날 선택한다.
- **권한 분리:** Image·Log·Secret 주입에 쓰는 Task Execution Role과 앱 코드의 AWS 접근에 쓰는 Task Role을 구분한다. 필요한 리소스·Action만 허용한다. [AWS ECS 실행 역할](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html)

이 초안은 리소스 생성·과금·DNS 변경·외부 공개를 승인한 기록이 아니다. 사용할 계정·Region·도메인·예산·공개 범위를 확인한 뒤 실행한다.

### 이번 주에 추가하지 않을 것

후속 대화·공식 답변·검색·알림·Dashboard·UI 장식, 여러 Provider 비교, 새로운 AI 평가 Dataset은 추가하지 않는다. Kubernetes·Terraform·Auto Scaling·WAF·CloudFront·분산 Queue·전체 관측 Stack·Multi-AZ 고가용성·무중단 배포는 기존 제외 범위를 유지한다.

## 날짜별 학습 일정

각 날짜의 10시간에는 아래 상세 실험과 설명·기록 시간이 포함된다. 실험표를 별도의 추가 과제로 다시 계산하지 않는다. 외부 리소스 생성·인증서 검증 대기 중에는 독립적인 개념 학습과 문서 정리를 진행하되, 대기 시간을 실제 학습 시간으로 세지 않는다.

| 날짜 | 시간 | 중심 학습과 실험 | 하루 종료 기준 |
|---|---:|---|---|
| 10/8 목 | 10시간 | Docker·Build Cache·Compose·Volume, 배포용 설정 연결, AWS·도메인·비용 준비 | 새 Image와 Compose로 기존 수직 흐름 실행, 데이터 보존 확인, Cloud 선행 조건 정리 |
| 10/9 금 | 10시간 | Linux Process·Signal, Health·Log·Metric, Actions·IAM·ECR | 종료 차이 설명, CI 실패·복구 확인, 검증한 Image를 ECR에서 식별 |
| 10/10 토 | 10시간 | ECS·RDS·Network, Route 53·ACM·HTTPS, 실제 Browser 흐름 | Cloud HTTPS 접수부터 실제 AI 제안 조회까지 연결, 일요일 전 중지·보관 상태 확인 |
| 10/11 일 | 0시간 | 학습·구현·수동 점검·배포 작업 없음 | 보충 일정이나 WIL 작성도 배정하지 않음 |
| 10/12 월 | 10시간 | 장애 추적·재배포·Rollback·Backup, 회귀·설명·WIL | 필수 근거 최종 판정, 재현 절차와 WIL 정리, 리소스 보존·정리 결정 |

### 10월 8일 목요일 실행 환경과 데이터 보존

1. **Cloud 선행 조건 1시간:** 학습 시작 때 AWS 접근 권한·Region·비용 범위·도메인 DNS 수정 권한부터 확인한다. 사용할 Subnet·Outbound 경로와 인증서 검증 순서를 정한다. 승인된 경우 DNS·ACM 준비를 시작하고 다른 실험 중 진행 상태를 확인한다.
2. **개념 1.5시간:** Source→JAR→Image→Container→Process의 관계, Port와 Container Network, 쓰기 계층과 Volume을 설명한다. 명령을 실행하기 전에 Process·DB·Session 중 무엇이 남을지 예상한다.
3. **Docker와 Compose 실험 4시간:** Dockerfile·`.dockerignore`를 작성하고 필요한 파일만 Image에 넣는다. Source만 바꾼 Build, 의존성을 바꾼 Build, Layer 순서를 바꾼 Build의 Cache·시간을 비교한다. Application과 PostgreSQL을 Compose로 연결해 Migration·접수·조회·Volume 보존을 확인한다. 기존 DB를 지우는 대신 별도 학습용 환경에서 Container만 재생성한다.
4. **배포용 설정 2.5시간:** 기존 Provider Adapter·Worker와 USER·AGENT를 실행 설정으로 연결한다. Secret 누락·Worker 비활성·유료 호출 분리 Test를 먼저 확인한다. 통제된 Provider로 조립을 검증한 뒤 실제 호출은 승인 범위 안에서 실행한다.
5. **설명과 기록 1시간:** Container 삭제·Volume 유지·새 DB 생성의 차이를 설명한다. 학습자료는 먼저 읽고, 실험 후 핵심 설정 한 부분을 직접 바꿔 결과를 확인한다.

Compose의 시작 순서와 Database의 준비 완료를 구분한다. Health Check와 의존 조건을 사용하되 기동 뒤의 DB 장애·재연결은 별도로 확인한다. [Docker Compose 시작 순서](https://docs.docker.com/compose/how-tos/startup-order/)

#### 필수 실험과 남길 결과

| 실험 | 진행 순서 | 확인할 결과 |
|---|---|---|
| Image 재현과 Cache | 최초 Build → Source 한 곳 변경 → 재Build → 의존성·Layer 순서를 각각 바꾸어 비교 | 어떤 Layer가 재사용되었는지와 걸린 시간. Cache가 빨라지는 이유를 Dockerfile 순서로 설명 |
| Compose 연결 | 새 학습용 환경에서 DB 준비 → Migration → 로그인·접수·조회 | App 내부의 DB 주소와 Host의 접속 주소 구분, Migration 이력과 실제 Ticket·Message·Job Row |
| 데이터 보존 | 같은 Volume을 두고 DB Container 교체 → App 재연결 → 같은 ID 조회 | Container가 바뀌어도 남는 Row와 App 종료 시 사라지는 Session 구분. Volume 삭제 명령은 사용하지 않음 |
| 실행 설정 분리 | 기본 설정·필수 Secret 누락·명시적 Worker 활성 구성을 각각 Test | 기본 CI에서 실제 외부 AI 호출 0회, 잘못된 배포 구성의 안전한 실패, 합의한 구성에서 처리 성공 |

마무리 질문:

- Image에 포함할 파일과 실행 시 주입할 Secret을 왜 나누는가?
- App Container와 DB Container에서 `localhost`가 각각 가리키는 곳은 어디인가?
- Container 재생성 후 Ticket은 남았는데 다시 로그인해야 하는 이유는 무엇인가?

### 10월 9일 금요일 Process와 CI

1. **Process 실험 2.5시간:** Linux 환경에서 `ps`·`/proc/<pid>/status`·Exit Code·표준 출력을 관찰한다. SIGTERM과 강제 종료를 비교하고, 진행 중 요청·Job과 DB Connection이 어떻게 되는지 설명한다. Graceful Shutdown과 대기 시간을 실행 환경에 맞춰 설정·기록한다. Secret이 들어갈 수 있는 Process 환경 변수나 전체 실행 인자는 출력하지 않는다.
2. **관측 2시간:** 구조화된 Log와 최소 Health·Request 수·오류·응답시간을 확인한다. CLI Pipeline으로 합성 요청의 Log를 필터링·집계하고, Request ID·Job ID로 요청과 비동기 처리를 연결한다. Credential·Cookie·CSRF·원문은 Log에 넣지 않는다. Health 상세·환경 변수·Heap Dump·관리 기능을 공개하지 않는다.
3. **CI 3시간:** 실제 GitHub Actions에서 Java Build·PostgreSQL Integration Test·JavaScript Test·ESLint·Image Build를 연결한다. 학습용 실패를 넣어 중단 지점을 관찰하고 복구한다. Testcontainers의 실제 PostgreSQL을 H2나 건너뛴 Test로 바꾸지 않는다. 실제 AI 호출은 기본 CI에서 제외한다.
4. **IAM과 ECR 1.5시간:** 사람의 접근, Actions의 배포 권한, ECS의 실행 권한을 구분한다. 승인된 리소스에 한정해 OIDC와 ECR Push를 연결하고 Commit과 Image Digest를 기록한다. 배포는 자동 Push만으로 시작되지 않도록 승인 단계를 둔다.
5. **설명과 기록 1시간:** Build 성공·Test 성공·Image Push·Service Health가 각각 무엇을 증명하는지 설명한다.

Actions는 장기 AWS Key 저장 대신 OIDC의 단기 자격 증명을 사용하는 방향으로 구성한다. 실제 Repository·Branch 또는 Environment의 `sub`와 `aud`를 제한하며 예제의 값을 그대로 복사하지 않는다. [GitHub의 AWS OIDC 안내](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)

#### 필수 실험과 남길 결과

| 실험 | 진행 순서 | 확인할 결과 |
|---|---|---|
| 종료 방식 비교 | 동일한 합성 요청·Job 조건 준비 → 정상 종료 요청 → 재개 → 강제 종료와 비교 | 종료 대기·Process 생존 여부·Exit Code·DB 상태. SIGTERM 전송 자체와 실제 정상 종료를 구분 |
| Log와 Metric | 정상 요청과 의도한 오류 요청 전송 → CLI로 해당 Log 추적 → 요청 수·오류·지연 확인 | 한 Request의 기록과 여러 Request를 합산한 Metric의 차이, HTTP 응답과 AI Job 결과의 차이 |
| CI 차단 | 격리된 학습 변경에서 Test 실패 → 실제 Workflow 실패 확인 → 수정 후 재실행 | 실패한 검사 이후 Image 배포 경로가 차단되는지, 실제 PostgreSQL Test 실행 여부, 복구한 Commit |
| 최소 권한 | 필요한 ECR Action이 없는 학습용 Role로 시도 → 거부 확인 → 필요한 리소스·Action만 허용 | 거부 원인과 허용 범위. 편의를 위해 Administrator 권한으로 우회하지 않음 |
| 배포 대상 식별 | 성공한 CI의 Image를 ECR에서 확인 → Commit·Tag·Digest 대조 | 다음 날 ECS에서 실행할 정확한 Image와 CI 실행 기록 |

마무리 질문:

- Container에 종료 Signal을 보냈는데도 Process가 남는다면 무엇부터 확인하는가?
- 요청 `201`과 그 뒤 AI Job의 `FAILED`는 왜 동시에 성립할 수 있는가?
- CI가 성공했다는 사실만으로 Cloud에서 정상 응답한다고 말할 수 있는가?

### 10월 10일 토요일 Cloud와 HTTPS 수직 연결

1. **Network와 IAM 1시간:** Browser→ALB→Application→RDS, Application→AI의 경로를 그린다. IAM 거부와 Security Group·DNS·DB 인증 실패를 구분한다.
2. **ECS와 RDS 3시간:** 승인한 구성으로 학습용 RDS·ECS를 연결한다. Migration 상태와 실제 DB 연결을 확인하고 ECR의 검증된 Digest를 배포한다. 필요한 Secret만 주입하며 배포 설정이나 Log에서 값을 출력하지 않는다.
3. **DNS와 HTTPS 1.5시간:** DNS 조회·인증서 이름과 신뢰 사슬·ALB HTTPS Listener·HTTP Redirect를 관찰한다. TLS가 종료되는 위치와 ALB 이후 내부 통신을 구분한다. 인증서 경고를 무시해 통과시키지 않는다. [ALB HTTPS Listener](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html)
4. **실제 Browser 확인 2시간:** HTTPS에서 로그인·Session Cookie의 Secure/HttpOnly/SameSite·CSRF 전달을 확인한다. 접수 `201`, CSRF 누락 `403`, 익명 조회 `401`, USER 조회 `403`, AGENT 조회 `200`을 대조한다. 실제 Worker·AI·RDS·담당자 화면의 결과와 원문 보존을 확인한다. Cookie·Token은 값이 아닌 존재·속성만 기록한다.
5. **Backup와 일요일 준비 1.5시간:** Backup 보존 설정·Snapshot과 월요일 복구 실험 준비를 확인한다. 자동 Worker의 추가 유료 호출을 막고, 일요일에 무엇을 중지·보관할지 승인된 절차로 처리한다. 다른 프로젝트의 리소스는 건드리지 않는다.
6. **설명과 기록 1시간:** DNS·TLS·인증·인가·DB·AI 중 각 결과를 어느 계층에서 확인했는지 설명한다.

토요일 종료 목표는 첫 HTTPS 수직 연결이다. 월요일까지 첫 배포를 미루는 일정으로 잡지 않는다. 다만 Cloud 생성·인증서 검증 대기 시간은 확정할 수 없으므로 목요일 준비 때부터 진행 상태를 확인한다.

#### 필수 실험과 남길 결과

| 실험 | 진행 순서 | 확인할 결과 |
|---|---|---|
| 실행 Image와 DB | ECR Digest 지정 → ECS Task 시작 → Migration 확인 → 실제 접수 | 실행 Task의 Image 대응, RDS의 Ticket·Message·Job Row, Source와 배포본의 일치 |
| DNS와 TLS | 도메인 조회 → ACM 검증 상태 확인 → HTTPS 연결 → HTTP 접근과 비교 | 도메인이 향하는 진입점, 인증서 Hostname·신뢰 사슬, Redirect 위치와 TLS 종료 위치 |
| 보안 계약 | HTTPS 로그인 → Token 조회 → CSRF 없는 접수와 유효한 접수 비교 → 세 Role의 조회 | `401`·두 종류의 `403`·`201`·`200`, Cookie 속성, 실제 요청의 CSRF Header 존재 |
| AI 수직 흐름 | 접수 Commit → Worker 처리 → 검증된 Suggestion 저장 → AGENT 조회 | 원문 보존, Job·Suggestion과 화면 일치, Ticket은 `OPEN` 유지. HTTP 조회 성공과 AI 처리 성공을 따로 판정 |
| 일요일 제외 | 필요한 실행 근거·Backup 확보 → Worker와 학습용 실행 리소스 상태 정리 | 무엇이 중지되고 무엇이 남아 과금되는지, 월요일 재개에 필요한 설정과 보존 데이터 |

마무리 질문:

- DNS 조회 성공·TLS 연결 성공·로그인 성공·DB 저장 성공은 각각 무엇을 확인한 것인가?
- ECS가 Image를 받는 권한과 앱이 RDS에 접속하는 조건은 어떻게 다른가?
- HTTPS를 적용해도 Session·Role·CSRF 검사가 필요한 이유는 무엇인가?

### 10월 12일 월요일 실패 추적과 복구

1. **재개와 장애 관찰 2시간:** 중지한 환경을 복원하고, 학습용 권한 부족 또는 DB 연결 설정 실패를 한 번에 하나씩 재현한다. CloudWatch의 Log·Health·Request/Error/Latency Metric을 대조한다. Application 오류와 ALB가 반환한 오류를 구분하며 공개 고의 실패 API를 추가하지 않는다.
2. **Rollback과 Backup 3시간:** 같은 RDS를 유지한 Task 교체 후 기존 Ticket·Job·제안이 남는지 확인한다. DB Schema를 바꾸지 않은 학습용 실패 배포를 이전 정상 Image Digest로 되돌린다. Snapshot은 원본을 덮어쓰지 않는 별도 임시 DB로 복원해 대표 Row를 확인하고, 앱 Version 복귀와 DB 복구의 차이를 기록한다. 복원용 추가 리소스 비용도 사전 승인 범위에 포함한다.
3. **최종 회귀 2시간:** 변경한 Code의 Java·JavaScript·정적 검사와 실제 CI 결과를 확인한다. Cloud HTTPS Browser 흐름을 다시 실행하고 Image·DB·화면의 대응을 기록한다. Process 재시작으로 Session이 사라져 재로그인하는 것과 문의 데이터 손실을 구분한다.
4. **설명과 WIL 2.5시간:** 대표 실패 하나를 자료 없이 설명하고 핵심 설정 한 부분을 직접 수정해 검증한다. 성공·실패·원인·복구를 WIL과 재현 절차로 정리한다. 블로그 초안 검토·게시·포럼 등록 시간을 포함하되 외부 게시는 작성자 확인 뒤 진행한다.
5. **마감 0.5시간:** 보존할 데이터·Snapshot·실행 근거를 확인하고, 학습용 리소스의 중지·삭제·유지 결정을 기록한다. 유지 비용과 담당할 후속 정리 시점을 남긴다.

#### 필수 실험과 남길 결과

| 실험 | 진행 순서 | 확인할 결과 |
|---|---|---|
| 장애 위치 찾기 | 정상 기준 확보 → 학습 환경에서 권한 또는 DB 연결 조건 하나 변경 → 요청 → 원상 복구 | 변경 조건·응답·Health·Log·Metric의 관계. 서로 다른 실패를 한 번에 만들지 않음 |
| 같은 DB로 재배포 | Ticket·Message·Job·Suggestion의 ID와 상태 기록 → App만 교체 → 재로그인·재조회 | 기존 Row 보존과 새 Process 생성. Session 소멸을 DB 손실로 오해하지 않음 |
| Application Rollback | 이전 정상 Digest 기록 → DB Schema를 바꾸지 않는 실패 Version 배포 → 이전 Digest 복귀 | Health와 기존 API 흐름 회복. Image Rollback이 DB Migration을 되돌리는 기능은 아니라는 점 |
| Database 복원 | 복원 기준 시점과 대표 Row 기록 → Snapshot을 별도 DB로 복원 → 원본과 비교 | 실제 복원된 Row·관계·상태, Snapshot 이후 데이터의 차이. Backup 생성 성공만으로 복원 성공을 대신하지 않음 |
| 회귀와 설명 | Local·CI 검사 → Cloud Browser 재검증 → 요청 흐름과 대표 실패를 자료 없이 설명 | 환경별 실행 결과, 직접 설명·수정한 설정, 남은 미완료 항목 |

마무리 질문:

- 이전 Image로 돌아왔는데 데이터까지 과거 상태로 돌아가지 않는 이유는 무엇인가?
- Snapshot 시점 이후 접수된 문의는 그 Snapshot을 복원한 DB에 존재하는가?
- HTTPS 요청 한 건과 뒤따르는 Worker 처리가 실패했을 때 어떤 순서로 근거를 찾는가?

## 비용과 공개 전 확인

목요일에 다음 항목을 확인하고, 막힌 항목은 즉시 일정에 반영한다. 설정을 쉽게 끝내려고 권한이나 공개 범위를 넓히지는 않는다.

| 확인 항목 | 결정할 내용 |
|---|---|
| AWS 계정과 권한 | 학습용 계정·Region, 기존 리소스와의 구분, 필요한 Role·Action과 승인자 |
| 도메인 | 기존 도메인의 학습용 Subdomain을 우선 검토. 신규 구매·Hosted Zone·DNS 변경은 별도 확인 |
| 과금 | ECS·RDS·ALB·IPv4·NAT 또는 Endpoint·Log·Secret·DNS·Backup의 예상 비용과 보존 기간 |
| AI 호출 | Helpdesk 전용 Key의 존재만 확인. 배포 실험의 입력·횟수·당일 비용 조건 확인 |
| 자료 공개 | 합성 문의만 사용하고 Credential·Cookie·Token·실사용자 원문·내부 주소가 근거 파일에 섞이지 않는지 확인 |

무료 이용 대상 여부나 이전 AI 비용 승인을 근거로 AWS 과금을 승인한 것으로 보지 않는다. AWS Budgets 알림에는 지연이 있을 수 있으므로 강제 지출 상한으로 취급하지 않는다. [AWS Budgets 안내](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)

일요일을 비워 두기 위한 리소스 처리는 토요일에 한다. RDS를 중지해도 Storage·Backup 비용은 남을 수 있고, 중지 7일 뒤에는 자동 재시작될 수 있다. ALB·Log·Snapshot 등도 별도로 확인한다. 중지와 비용 0원, 삭제와 Backup 보존은 서로 다른 상태다. [RDS 중지와 과금 안내](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html)

## 필요한 자료와 기록

학습을 시작할 때 기본 개념부터 설명한다. 낯선 설정을 먼저 맞히게 하기보다, 흐름 설명→작은 예측→실행→자기 말로 설명하는 순서로 진행한다.

- `study-docs/`: Docker·Compose, Process·Signal, CI·IAM, DNS·TLS·Cloud 복구 자료를 해당 주제 시작 전에 준비한다. 날짜·진도는 넣지 않고 기존 자료와 겹치는 내용은 링크한다.
- `study-notes/`: 10/8·10/9·10/10·10/12의 핵심 질문과 오해를 수정한 내용을 1인칭으로 정리한다. 대화 전체를 옮긴 로그는 남기지 않는다.
- `lab-reports/`: 실행 환경·명령·예상·결과·실패 원인과 재현 방법을 묶는다. 로컬·CI·Cloud 근거는 구분한다.
- `wil.md`: 주간 결과와 이해 변화, 직접 판단한 부분과 AI 도움을 받은 부분을 정리한다. 실제 결과가 생긴 뒤 작성한다.
- Lab Repository: Dockerfile·Compose·Workflow·배포 설정·관련 Test·실행/복구 안내를 관리한다. WIL과 구현 변경은 별도 Commit으로 나눈다.

## 완료 체크

각 핵심 주제는 설명·예측/실패 재현·Test/Trace 등 최소 세 가지를 충족하고, 그중 하나는 실제 실행 근거여야 한다. 아래 항목은 계획일 뿐 현재 완료를 뜻하지 않는다.

- [ ] Image·Container·Layer·Volume·Network를 설명하고 Layer 순서에 따른 Cache 비교와 Compose 재생성 후 DB 보존을 확인했다.
- [ ] 배포용 사용자·Provider·Worker·Secret 설정과 누락·기본 비활성 조건을 검증했다.
- [ ] Process·`/proc`·SIGTERM·강제 종료·Exit Code·Graceful Shutdown을 관찰하고 CLI Log Pipeline과 DB·Session·Job의 결과를 설명했다.
- [ ] 실제 GitHub Actions의 Build·Test·정적 검사 실패와 복구, ECR Digest를 확인했다.
- [ ] IAM User·Role·Policy·최소 권한과 Network 접근 경계를 설명하고, 권한 거부·복구와 같은 Image의 ECS 실행을 확인했다.
- [ ] 실제 RDS Migration·저장·조회와 Application 재배포 뒤 Row 보존을 확인했다.
- [ ] DNS·ACM·HTTPS·Redirect와 안전한 Cookie·Session·Role·CSRF를 실제 Browser에서 확인했다.
- [ ] 실제 Cloud의 접수·Worker·AI·제안 저장·AGENT 조회를 연결하고 원문·Ticket 상태를 유지했다.
- [ ] CloudWatch에서 대표 실패의 Log·Health·요청 수·오류·응답시간을 추적했다.
- [ ] 이전 Image로 복귀하고 Backup 설정·별도 DB 복원 결과와 데이터 보존을 확인했다.
- [ ] 최종 회귀·공개 문서·Secret 노출 점검, 재현 절차와 비용·리소스 정리 기록이 있다.
- [ ] WIL을 작성자 표현으로 검토했다. 블로그 게시와 포럼 등록은 실제 확인 뒤 각각 완료 처리한다.

## 진도 점검과 기간 연장

4일 집중 계획을 먼저 실행한다. 10/12는 첫 마감 목표이며, 필수 학습이 남아 있는데 날짜만 맞춰 완료 처리하는 기한은 아니다. 매일 종료 때 완료한 항목, 남은 항목, 지연 원인, 다음에 필요한 시간을 확인한다.

| 점검 시점 | 확인할 것 | 부족할 때 조정 |
|---|---|---|
| 10/8 종료 | Compose 실행·영속성, 배포용 설정, 계정·DNS·비용 선행 조건 | 문제 해결 시간을 다음 날 앞에 배치하고 그만큼 밀린 항목을 남김. Provider 연결이나 개념 복습을 삭제하지 않음 |
| 10/9 종료 | Process·관측 실험, 실제 CI 실패·복구, 배포할 Image | CI만 성공한 상태를 배포 완료로 보지 않음. 토요일 Cloud 실험의 선행 조건과 남은 시간을 재산정 |
| 10/10 종료 | 실제 HTTPS 수직 흐름, 일요일 중지·보관 상태 | 미완료 배포를 월요일 앞부분에 이어서 배치. 뒤의 복구·회귀·WIL은 없애지 않고 연장 대상으로 기록 |
| 10/12 종료 | 전체 완료 체크와 직접 설명, 복구·회귀·공개 제출 | 필수 항목이 남으면 Week 8을 계속 진행. 남은 항목별 예상 시간과 실제 가용일을 바탕으로 추가 일정을 정함 |

연장은 이미 허용한 진행 방식이므로, 시간이 부족하다는 이유로 다시 학습 범위를 줄이는 안을 만들지 않는다. 다만 추가 날짜를 임의로 확정하지는 않는다. 필요해진 학습·구현·검증 시간과 Cloud 대기를 구분해 제시하고, 실제 사용할 수 있는 날짜에 남은 순서를 배치한다. 하루 10시간을 넘겨야만 계획을 지킨 것으로 평가하지 않는다.

10/11 일요일은 보충일로 사용하지 않는다. 도메인·계정·권한·비용 승인이 늦어지면 로컬 실험과 CI 학습을 먼저 하되 이를 Cloud 배포 완료로 대체하지 않는다. 설정 작업이 오래 걸려도 개념 설명·실패 실험·Backup 복원·복습을 생략하지 않는다.

기간을 연장하는 동안 Week 8은 `In Progress`로 유지하고, 각 미수행 실험은 `NOT_RUN`, 일부만 검증한 항목은 부분 완료로 구분한다. 남은 내용을 Week 9 학습으로 이름만 바꾸어 넘기지 않는다. Week 9~12의 취업 우선 원칙은 유지하며, Week 8의 실제 종료일에 맞춰 후속 일정의 날짜만 조정한다. 기존 상위 계획의 완료 기준을 충족하기 전에는 수평 기능 확장을 시작하지 않는다.

## 계획 변경 기록

| 날짜 | 변경 전 | 변경 후 | 이유와 영향 |
|---|---|---|---|
| 2026-10-07 | Week 7의 10/7 마감 후 Week 8 세부 일정 미정 | 10/8~10/12 중 10/11 제외, 4일·순학습 40시간 기준 | 사용자 기간 지정. 기존 DevOps·System·Cloud·HTTPS 범위 유지, 첫 Cloud 연결은 10/10 목표, 10/12 복구·최종 검증·WIL 마감 |
| 2026-10-07 | 기간을 미리 늘리는 대안과 4일 집중안 검토 | 우선 4일에 전체 내용을 배치하고, 부족하면 같은 Week 8 기간을 연장 | 사용자가 4일 우선 진행·필요 시 연장·내용 유지 요청. 세부 키워드·실험·복습 질문을 추가하고 일일 점검·연장 기준 명시 |

## 관련 기준

- [12주 학습 계획](../plan/advanced-track-12-week-plan.md)
- [주차별 Roadmap](../plan/weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](../plan/learning-and-content-plan.md)
- [깊은 수직 학습 범위 결정](../plan/decisions/0002-depth-first-ai-assisted-expansion.md)
- [Week 7 완료 결과](../week7/wil.md)
