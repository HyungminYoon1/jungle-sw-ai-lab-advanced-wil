# 배포 장애 관찰과 Application Rollback 그리고 Database 복원

배포 후 오류가 나면 이전 Image로 바꿀 것인지, 실행 설정을 고칠 것인지, DB를 복원할 것인지 구분해야 한다. 프로그램·설정·데이터가 서로 다른 곳에 있으므로 복구 방법도 다르다.

[Image 전달 자료](./image-publishing-and-ecs-execution.md)와 [Network와 HTTPS 자료](./aws-network-dns-and-https.md)의 흐름을 기준으로, 실패한 위치를 찾고 복구 결과를 확인한다.

App 재시작·Image Rollback·Snapshot 복원을 기초부터 비교하려면 [DB와 App 서버 복구](./database-and-application-recovery.md)를 먼저 읽는다. Session 소실·새 Endpoint·데이터 대조·AI Job 재개 판단을 예제와 질문으로 정리했다.

## 실행 상태와 업무 결과

| 관찰 | 확인하는 대상 |
|---|---|
| ECS Task가 `RUNNING` | 실행 단위의 상태 |
| ALB Health Check 통과 | 지정한 경로·Port·응답 조건의 점검 결과 |
| 로그인·접수 HTTP 응답 | 특정 사용자 요청의 처리 결과 |
| RDS의 Ticket·Message·Job Row | 접수 Transaction의 저장 결과 |
| Job `SUCCEEDED`와 Suggestion Row | 특정 문의의 AI 처리와 검증된 결과의 저장 |

Task가 실행 중이어도 Login이나 AI 기능의 설정이 잘못될 수 있다. Health도 등록한 항목만 검사한다. 원리는 [Process와 Health 자료](./process-health-and-ci.md#health는-무엇을-알려주는가)에서 다룬다.

AI 상태 조회가 HTTP `200`을 반환해도 Body의 Job은 `FAILED`일 수 있다. 조회 자체의 성공과 AI 처리의 성공은 다른 판단이다. AI 제안은 고객에게 보낸 공식 답변이나 Ticket의 자동 해결 상태도 아니다.

## 실패한 계층부터 찾기

한 번에 한 조건을 바꾸고 정상 기준과 비교한다. 다음은 관찰별 조사 시작점이며, 응답 코드 하나로 원인을 확정하는 표는 아니다.

| 관찰 | 조사 시작점 |
|---|---|
| Domain 이름을 찾지 못함 | DNS Record·위임·Cache와 Resolver |
| TLS 인증서 경고 | 요청 Hostname·인증서·유효 기간·신뢰 사슬·Listener |
| Task가 시작되기 전에 중단 | ECS Event, Image Pull·Execution Role·Secret·Network |
| JVM 기동 중 실패 | 필수 설정·Bean 조립·Migration·DB 연결 |
| ALB가 `502`·`503`·`504` 응답 | Target 등록·응답·연결·Timeout과 ALB 기록 |
| App이 `401`·`403` 응답 | Session 복원·Role·CSRF와 Security 단계 |
| App은 접수했으나 AI Job 실패 | Job·Attempt, 개인정보 검사·Provider·출력 검증·결과 저장 |

예를 들어 Browser의 `403`만으로 권한 부족이라고 단정하면 CSRF 실패를 놓칠 수 있다. 배포에서도 Timeout만으로 Password 오류라고 단정하지 않고 연결 단계와 인증 단계를 나눈다.

## Log와 Metric을 연결하기

CloudWatch Logs는 전달한 사건 기록을 보관하고, CloudWatch Metrics는 지정한 수치의 변화를 집계한다. ECS의 Log Driver를 연결해야 Container의 표준 출력·표준 오류가 지정한 Log Group으로 전달된다. Log 보존 기간과 접근 권한도 별도 설정 대상이다. [AWS의 ECS Log 전달](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_awslogs.html)

ALB가 직접 만든 `5xx`와 Target Application이 만든 `5xx`는 다른 Metric으로 볼 수 있다. [AWS ALB Metric 설명](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html)

| Metric | 의미 |
|---|---|
| `RequestCount` | ALB가 Target을 선택할 수 있었던 요청 수. Health Check는 제외 |
| `HTTPCode_Target_4XX_Count` | Target Application이 반환한 HTTP `4xx` 수 |
| `HTTPCode_ELB_4XX_Count` | ALB가 직접 반환한 HTTP `4xx` 수 |
| `HTTPCode_ELB_5XX_Count` | ALB에서 발생한 HTTP `5xx` 수 |
| `HTTPCode_Target_5XX_Count` | Target이 반환한 HTTP `5xx` 수 |
| `TargetResponseTime` | ALB가 Target으로 보낸 뒤 응답 Header가 시작될 때까지의 시간 |

`TargetResponseTime`은 Browser가 DNS 조회를 시작해 화면을 그리기까지 걸린 전체 시간이 아니다. App의 `http.server.requests`도 AI Job의 총 처리 시간을 자동으로 나타내지는 않는다. HTTP 응답 후에 Worker가 계속 처리하기 때문이다.

개별 접수와 Worker 처리를 연결할 때는 다음 관계를 추적한다.

```text
HTTP Request ID
  → 접수한 Ticket·Message·Job의 식별자
  → Worker가 처리한 Job ID·Attempt
  → 성공 상태 또는 고정 실패 코드
```

Request ID만 검색하면 HTTP 이후의 비동기 작업을 놓칠 수 있다. 접수 시 생성한 Job과 연결하고, 오래된 Attempt의 응답을 채택했는지도 확인한다. 실제로 연결 가능한 식별자가 각 기록에 있는지 점검해야 한다.

Log에는 API Key·DB Password·Cookie·CSRF Token·원문과 Provider 응답 전체를 넣지 않는다. 오류 구분에는 검증 단계와 고정 오류 코드, 식별자·소요 시간 같은 필요한 정보만 사용한다. 전체 환경 변수나 관리 Endpoint를 공개해 진단하지 않는다.

### 기동 Log와 HTTP Metric을 차례로 읽는다

Log는 개별 사건의 기록이고 Metric은 정해진 범위의 수치 집계다. `Started HelpdeskApplication`이라는 Log와 `401` 요청 수는 서로 다른 질문에 답한다. 전자는 Spring 기동 완료 사건이며, 후자는 특정 요청들이 어떤 응답을 받았는지의 집계다.

1. **실행 대상을 고른다.** ECS Cluster 이름뿐 아니라 현재 Task·Container의 Log Stream을 확인한다. 이전 Task의 성공 기록을 현재 Task의 기동 성공으로 해석하지 않는다.
2. **기간을 맞춘다.** 기동이 하루 전이라면 최근 1시간 필터에 기동 기록이 없는 것이 자연스럽다. Log가 보이지 않을 때 기간·Stream·검색어·권한부터 확인하며 삭제나 전달 실패로 단정하지 않는다.
3. **실제 Event를 읽는다.** 기동 문구를 검색창에 넣었다고 그 사건을 확인한 것은 아니다. 검색 결과의 Event와 시각을 확인한다. 기동 완료만으로 후속 로그인·접수·AI 성공을 확정하지 않는다.
4. **알려진 HTTP 조건을 만든다.** 익명 Health는 `200`, 익명 보호 API는 `401`처럼 계약을 아는 읽기 전용 요청을 사용한다. 의도한 접근 거부는 App 장애와 다르다.
5. **응답을 만든 계층의 Metric을 고른다.** App의 `401`은 Target의 `4xx` 쪽을 살펴본다. ALB가 직접 만든 `5xx`는 ELB 오류 Metric과 연결한다. 요청 수·응답시간의 기간·Statistic·대상 Dimension도 함께 확인한다.
6. **숫자의 범위를 설명한다.** ALB Metric은 Health Check 요청을 제외하고, `RequestCount`는 Target을 선택할 수 있었던 요청을 센다. App의 HTTP 집계와 항상 일치한다고 가정하지 않는다. 별도 시점·URI·Status로 필터링하지 않은 총합을 방금 보낸 요청 수라고 해석하지 않는다. [AWS ALB Metric 기준](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-cloudwatch-metrics.html)

Metric이 아직 표시되지 않은 상태와 값이 `0`인 상태도 다르다. 수집·집계 주기, 선택한 시간 범위·대상, 실제 트래픽을 확인한 뒤 해석한다. App Metric의 AGENT 제한을 없애거나 새 유료 관측 기능을 켜는 것으로 조회 문제를 우회하지 않는다.

Monitoring 화면의 `GetMetricData` 접근 거부는 그래프를 읽는 IAM 신원의 권한부터 조사한다. Container 실행용 Execution Role이나 App의 Task Role에 조회 권한을 넣는 것으로 해결할 사안이 아니다. 읽기 권한 부족·Metric 데이터 없음·실제 오류 증가를 같은 현상으로 해석하지 않는다.

요청 그래프가 1분 간격·합계라면 각 점은 해당 1분에 집계한 요청 수다. 그래프의 한 점을 전체 표시 기간의 총합으로 읽지 않는다. Target 4xx에는 계약대로 차단한 익명 `401`·권한 없는 `403`도 포함될 수 있어, 숫자가 있다는 이유만으로 서비스 장애라고 부르지 않는다. 반대로 예상하지 못한 4xx 증가를 모두 정상 보안 동작이라고 가정하지도 않는다. 요청 조건과 App 지표·Log를 대조해야 한다.

응답의 `X-Request-Id`와 Log의 Request ID도 자동으로 같은 기능이 아니다. 필터가 Header·Request Attribute만 설정한다면 그 값이 CloudWatch에 출력됐다는 근거가 없다. 요청 Log를 실제로 남기는 위치와 Security 거부 요청까지 포함하는지, 비동기 Job과 연결할 식별자가 있는지 따로 확인한다. 특정 응답에 Header가 없다는 사실 하나로 App 전체가 중단됐다고 판단하지 않는다.

## 단독 App Task를 교체하는 순서

ALB에서 Target 등록을 해제하는 것과 App Process를 종료하는 것은 다른 작업이다. 먼저 기존 Target으로 새 요청이 전달되지 않게 하고, 처리 중인 연결이 정리되는 Draining을 확인한 뒤 App을 종료한다. 등록 해제는 Target Group·DB의 삭제가 아니다. [AWS의 등록 해제와 종료 순서](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-register-targets.html)

단일 실행·잠깐의 중단을 허용하는 실습이라면 기존 Target 등록 해제·Draining → 기존 Task 종료 → 새 Task 실행 → 새 Private IP와 App Port 등록 → Healthy·HTTPS 확인 순서로 관찰한다. 단독 Task에 수동 등록한 IP를 ECS Service가 자동으로 갱신한다고 가정하지 않는다. 같은 ALB라면 Task IP 변경만으로 서비스 DNS를 바꿀 필요는 없다.

교체 전에는 인증된 Session으로 기존 문의가 읽히는 기준을 확보한다. 교체 후 이전 Session의 거부·재로그인·동일 문의 조회를 비교한다. 교체 전부터 인증되지 않았던 Browser로는 교체 때문에 Session이 사라졌다고 증명할 수 없다. 같은 Image·명세의 새 Task 실행은 실행 객체 교체이며, 이전 Image로 되돌리는 Rollback과 구분한다.

## Application Rollback

Application Rollback은 실행할 프로그램을 이전 정상 버전으로 바꾸는 것이다. RDS를 그대로 둔 경우 이미 Commit한 Row는 그 DB에 남는다.

```text
실패한 Image B로 실행 중인 App
  → 이전 정상 Image A의 Digest와 실행 설정 선택
  → 해당 Task Definition으로 App 교체
  → 같은 RDS에 다시 연결
  → Health·재로그인·기존 문의 조회 확인
```

Rollback할 대상을 준비할 때 Image Digest만 보관하지 않는다. Task Definition·Port·활성 기능·Secret 참조·DB 접속 대상 등 실행에 필요한 구성도 연결한다. Secret의 값 자체는 공개 기록에 넣지 않는다.

이전 프로그램이 현재 Schema를 사용할 수 있어야 한다. 새 Migration이 Column을 삭제했다면 이전 Image로 바꿔도 프로그램이 정상 동작하지 않을 수 있다. Image 교체가 Flyway 이력이나 DB 내용을 자동으로 되돌리는 기능은 아니다.

복구 연습에서는 DB Schema를 바꾸지 않는 실패를 먼저 사용하면 프로그램 교체의 효과를 따로 관찰할 수 있다. 새 JVM에서 기존 메모리 Session이 사라져 재로그인이 필요한 것과, 문의 데이터가 손실된 것은 다른 결과다.

### 이전 Image와 이전 정상 Image는 다르다

오래된 Image가 Registry에 남아 있다는 사실만으로 현재 환경의 복귀 대상이 되는 것은 아니다. 현재 실행 설정에 필요한 파일·Profile·사용자 구성과 현재 DB Schema를 지원해야 한다.

예를 들어 실행 설정이 `sslmode=verify-full`과 Image 내부 CA 파일을 요구하는데 이전 Image에 그 파일이 없다면, Image Pull에 성공해도 DB 연결은 실패할 수 있다. 이를 해결하기 위해 인증서 검증을 끄는 것은 정상 버전 복귀가 아니라 보안 조건 변경이다. 필요한 배포 구성이 있는 정상 Image를 복귀 기준으로 선택한다.

Image 안에 Migration 파일이 있다는 사실과 현재 DB에 적용된 Migration 이력도 구분한다. 새 Image가 Schema를 변경했다면 이전 코드의 조회·저장, 상태값 해석과 Migration 검증이 여전히 가능한지 확인한다. 단순히 새 Column이 추가됐다는 이유만으로 모든 이전 코드와 호환된다고 가정하지 않는다.

### Task Definition 개정과 프로그램 버전은 다르다

Task Definition의 개정 번호는 실행 명세의 버전이다. 같은 Image에서 DB Endpoint나 메모리만 바꿔도 새 개정이 생길 수 있다. 따라서 명세 :2에서 :1로 돌아갔다는 사실만으로 Image Rollback을 증명할 수 없다. 교체 전후 실제 Image Digest가 무엇인지 대조해야 한다.

기준 Image A와 후보 Image B는 서로 다른 프로그램 산출물이며, 각 Digest와 대응하는 Source·검증 결과를 보관한다. 후보 실행 후 A로 복귀할 때에는 같은 RDS·접근 제한·TLS·Secret 참조와 활성 기능을 유지하고, 프로그램 변경의 결과를 따로 확인한다. 이번 구성이 단독 Task라면 ECS Service의 자동 Rollback이 아니라 승인된 수동 교체 절차를 사용한다. [ECS의 Image Digest와 배포 설명](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-type-ecs.html)

복귀 확인은 실제 Digest → Spring·DB 연결 → Target Healthy → 이전 Session 거부·재로그인 → 기존 문의·Job 조회 순서로 나눈다. HTTP Health 성공만으로 업무 데이터 보존까지 확인한 것은 아니다. 새 배포에 결함이 없어도 B → A 복귀 절차는 연습할 수 있지만, 그 결과를 실제 장애 복구나 무중단 배포 성공으로 바꾸어 기록하지 않는다.

### 읽는 프로그램을 먼저 준비하고 새 값의 저장을 나중에 활성화한다

DB Column을 삭제하지 않아도 Rollback이 깨질 수 있다. 예를 들어 이전 프로그램의 실패 코드 Enum에 `PROVIDER_REFUSED`만 있고, 새 프로그램이 `PRIVACY_SCAN_TIMEOUT`을 저장한다면 이전 프로그램은 새 문자열을 Enum으로 바꾸지 못할 수 있다. Row가 남아 있다는 사실과 이전 프로그램이 그 Row를 올바르게 읽는다는 사실은 다르다. Browser의 응답 검증기가 허용하는 코드 목록도 함께 확인한다.

이 경우에는 읽기 준비와 새 값의 쓰기를 나누어 배포할 수 있다.

1. **기존 A:** 현재 값을 읽고 저장하지만 새 실패 코드는 모른다.
2. **준비 P:** 기존 값과 명시한 새 실패 코드를 모두 읽는다. 새 실패 코드를 만들어 저장하는 처리 로직은 아직 활성화하지 않는다.
3. **후속 B:** 준비한 코드와 DB 제약을 사용해 새 실패 코드도 저장한다.

P의 기동·기존 업무·새 값 읽기를 확인한 다음 B를 배포한다. B가 새 값을 저장한 뒤의 복귀 대상은 P다. 새 값을 모르는 A로 두 단계 모두 되돌리는 것은 별도의 호환성 검증 없이 안전하다고 할 수 없다. Amazon의 Prepare·Activate 두 단계 배포도 먼저 읽기를 준비하고 이후 새 형식의 쓰기를 활성화하는 순서를 설명한다. 이 원칙을 선택했다고 다중 서버나 무중단 배포까지 구현한 것은 아니다. [Amazon의 Rollback 안전성 설명](https://aws.amazon.com/builders-library/ensuring-rollback-safety-during-deployments/)

준비 P는 어떤 문자열이나 정상값으로 받아들이는 버전이 아니다. 계약으로 정한 두 코드를 추가로 해석할 뿐, 알 수 없는 코드를 `null`·`UNDETERMINED`나 다른 실패 원인으로 바꾸지 않는다. Rollback을 쉽게 하려고 DB의 실패 사유를 덮어쓰거나 Row를 지우지도 않는다.

검증은 실제 이전 산출물과 준비·후속 산출물을 같은 PostgreSQL에 차례로 연결해 진행한다. Migration 이력 검증·새 실패 코드 조회·기존 문의와 제안 보존·Browser 계약을 확인한다. Enum의 단독 변환 확인은 이 통합 검증의 한 부분이며, Cloud Rollback 성공을 대신하지 않는다.

## Database Backup과 복원

Snapshot은 특정 시점의 DB 상태를 복구하기 위한 Backup이다. RDS Snapshot 복원은 기존 DB를 덮어쓰는 작업이 아니라 **새 DB Instance를 만드는 작업**이다. [RDS Snapshot 복원 설명](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_RestoreFromSnapshot.html)

```text
원본 RDS
  ├── Snapshot 시점의 상태 → Snapshot
  └── 그 뒤 새 문의가 추가된 현재 상태

Snapshot으로 새 RDS 복원
  → Snapshot 시점의 Row를 가진 별도 DB
  → 원본 DB와 독립된 Endpoint
```

Snapshot 뒤에 접수된 문의는 그 Snapshot만 복원한 DB에 없다. 복원 시점을 선택하는 일은 데이터의 어느 시점으로 돌아갈지 결정하는 일이다.

복원 검증은 다음 순서로 진행할 수 있다.

1. Snapshot 시점과 그 시점의 대표 Ticket·Message·Job·Suggestion 상태를 기록한다.
2. 원본을 유지한 채 별도 학습용 DB로 복원한다.
3. 새 DB의 Network·Security Group·Parameter·접속 설정을 확인한다.
4. Migration 이력과 Row·관계·상태를 실제 조회해 비교한다.
5. 별도 검증 App을 연결하고 기존 문의 조회를 확인한다.

`available`이라는 Instance 상태만으로 학습 검증을 끝내지 않는다. 복원하려던 데이터가 있고 Application이 읽을 수 있는지 확인한다. 접속할 Endpoint를 바꾸는 일은 별도 실행 설정 변경이다.

복원 DB를 확인할 때는 AI Worker를 먼저 꺼 둔다. Snapshot에 남아 있는 `PENDING`·미완료 Job 때문에 추가 외부 호출이 시작되는 것을 막기 위해서다. Job과 예약을 임의로 초기화하지 않고, 자동 처리 재개는 복원 목적과 기존 정책에 맞춰 따로 판단한다.

## 중지와 삭제 그리고 보관 비용

실행을 멈추는 것과 모든 비용이 사라지는 것은 다르다.

| 대상 | 실행을 멈출 때 확인할 것 | 남는 보관 대상 |
|---|---|---|
| ECS Service | 원하는 Task 수와 실제 남은 Task 수 | Task Definition과 ECR Image |
| ALB | Task가 없어도 ALB 자체는 남는다 | Listener·Target·인증서 연결 등의 재생성 설정 |
| RDS | DB Instance 실행 중지와 재시작 조건 | DB Storage·Snapshot·Backup |
| Log·Secret·DNS | 개수·보존 기간·사용 조건 | 기록·설정·인증서 검증 Record |

RDS를 중지해도 Storage와 Backup 등의 비용은 남으며, 연속 7일 중지하면 자동으로 다시 시작된다. 장기간 한 번 Stop해 두는 것과 실행하지 않을 때마다 비용을 관리하는 것은 다르다. [RDS 중지와 요금 조건](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html)

ALB는 실행 Task가 없는 시간에도 자체 이용 요금이 발생할 수 있다. Image·Snapshot·Log 등도 각 서비스의 보관 요금을 확인한다. 비용 계산에서는 실행 시간과 보관 기간을 나눈다. [ALB 요금](https://aws.amazon.com/elasticloadbalancing/pricing/)

DB를 삭제하는 실습은 Snapshot 생성과 별도 복원 검증, 남길 데이터 확인과 대상 승인을 먼저 갖춘다. 복구를 설명하는 것과 실제 리소스를 삭제하는 것은 다른 작업이다.

### 실습하지 않을 때 비용을 줄이는 순서

`desiredCount=0`은 ECS Service가 유지할 Task 수를 0으로 만드는 설정이다. 단독으로 실행한 Task와 다른 시작 경로까지 모두 중단했다는 뜻은 아니다. 원하는 수량뿐 아니라 실제 실행 목록도 확인한다. ALB·RDS·Image·Snapshot은 Task와 독립된 리소스이므로 따로 관리한다.

장기 휴지기는 App과 DB를 계속 실행할 때보다, 복원 가능한 데이터와 재개 설정만 남겼을 때 실행 비용을 줄일 수 있다. 이 과정에서 데이터 보존을 생략하면 비용 절감이 아니라 데이터 삭제가 된다.

```text
접수 중단·Worker의 새 작업 중단
  → 진행 중 요청·Job 확인 후 App 종료
  → DB 쓰기 중단 확인·마지막 Snapshot
  → 원본을 유지한 별도 DB 복원·Row와 Migration 검증
  → 대상 승인 뒤 ALB·DB Instance 정리
  → Snapshot·필요한 Image·Parameter·재개 설정 보관
```

마지막 Snapshot 뒤에 새 쓰기를 허용하면 그 데이터는 보관한 Snapshot에 없다. 따라서 단순히 최근 Backup이 있다는 이유로 원본을 지우지 않고, 쓰기 중단 시점과 보관 시점을 맞춘다. Snapshot은 공개 공유하지 않으며 실행 중 Job·누적 예약·처리 기한을 초기화하지 않는다.

재개는 남겨둔 실행 객체를 그대로 살리는 것이 아니라 새 실행을 구성하는 작업이다. Snapshot으로 만든 RDS는 새 Endpoint를 사용하고, 재생성한 ALB도 다른 주소를 가질 수 있다. DB 접속 설정·서비스 DNS·Target 등록을 맞추고, 새 Task에서 다시 로그인한다. ACM 검증 CNAME과 서비스 CNAME은 구분해 관리한다.

RDS 복원 시에는 원래 VPC·Subnet Group·Security Group·DB Parameter Group을 따로 지정한다. Snapshot을 골랐다고 기존 접속 제한·사용자 정의 설정이 모두 자동으로 선택되는 것은 아니다. 암호화에 필요한 Key와 Private 접근도 유지해야 한다. [RDS 복원 시 Group 설정](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_RestoreFromSnapshot.html)

복원된 미완료 Job이 추가 외부 호출을 시작하지 않도록 첫 확인은 AI 비활성으로 수행한다. 기존 Row와 로그인·Role·CSRF를 확인한 뒤 필요한 자동 처리만 별도로 재개한다. Snapshot·Image·Log의 보관료는 남으므로 휴지기 비용을 0원으로 단정하지 않는다.

## 핵심 질문

1. ALB가 직접 반환한 `5xx`와 Helpdesk가 반환한 `5xx`를 어떻게 구분할 수 있는가? 어느 Log와 Metric을 먼저 확인할 것인가?
2. App만 이전 Image로 되돌리면 같은 RDS에 접수된 문의와 Flyway Migration도 과거로 돌아가는가?
3. Snapshot 복원으로 새 DB를 만든 뒤 무엇을 조회해야 복원 성공을 확인할 수 있는가? 왜 확인용 App의 Worker는 먼저 꺼 두는가?
4. `desiredCount=0`만으로 ALB·RDS·보관 비용도 중단됐다고 말할 수 있는가? 마지막 Snapshot 뒤에도 접수를 허용하면 어떤 데이터가 사라질 수 있는가?
5. 현재 Task의 기동이 20시간 전인데 최근 1시간의 Log가 비어 있다면 먼저 무엇을 확인할 것인가? 검색창의 기동 문구와 실제 기동 Event는 무엇이 다른가?
6. 익명 API의 의도한 `401`은 정상 요청 흐름에서 발생할 수 있는가? 이 응답을 ALB 자체의 `5xx`와 같은 장애로 볼 수 있는가?
7. 이전 Image에 현재 실행 설정이 요구하는 CA 파일이나 Profile 구성이 없다면 왜 바로 복귀 대상으로 쓸 수 없는가?
8. Task Definition 개정 번호 변경과 실제 Image Digest 변경은 각각 무엇을 바꾼 것인가?
9. Image B가 DB Schema를 변경했다면 A로 돌아가기 전에 무엇을 확인해야 하는가?
10. 새 실패 코드를 B가 이미 저장했다면, 그 코드를 모르는 A와 읽기 준비를 마친 P 중 어느 버전으로 복귀해야 하는가?
11. Rollback 뒤 조회 오류를 없애려고 새 실패 코드를 다른 기존 실패 코드로 고쳐도 되는가?

## 핵심 질문 해설

1. **응답을 생성한 계층을 나눈다.** ALB의 ELB·Target 오류 Metric과 관련 기록, App의 Request Log를 대조하고 Target 연결 문제인지 업무 오류인지 찾는다.
2. **돌아가지 않는다.** 프로그램과 데이터의 복구는 별개다. 현재 Schema와 이전 코드의 호환성도 확인해야 한다.
3. **복원 시점의 실제 Row·관계·상태와 Migration 이력을 확인한다.** Worker 비활성은 복원된 미완료 Job의 외부 호출을 통제하기 위한 것이다.
4. **그럴 수 없다.** 실행 Task와 ALB·DB·Storage는 별개다. Snapshot 뒤의 새 쓰기는 해당 Snapshot에 없으므로 마지막 보관 전에 접수와 쓰기를 중단해야 한다.
5. **기간과 현재 Task의 Stream부터 확인한다.** 검색어 입력은 조회 조건일 뿐이며, 결과 Event·시각을 확인해야 기동 기록을 관찰한 것이다.
6. **발생할 수 있다.** 익명 접근을 차단하는 계약이라면 의도한 결과다. 응답 생성 계층과 요청 조건이 다르므로 ELB 장애와 나누어 본다.
7. **현재 환경에서 동작할 조건이 없기 때문이다.** 저장된 과거 산출물과 현재 DB·TLS·사용자 설정에서 확인한 정상 산출물은 다를 수 있다.
8. **실행 명세와 프로그램 산출물을 나눈다.** Endpoint만 바꿔도 명세 개정은 늘어날 수 있으므로 실제 프로그램 교체는 Digest로 확인한다.
9. **이전 코드와 현재 Schema의 호환성이다.** Migration 검증·조회·저장·상태값 처리를 확인하며 Image 복귀가 DB 변경까지 취소한다고 가정하지 않는다.
10. **검증을 마친 P다.** B가 쓴 데이터를 읽을 수 있어야 하며, 단지 더 오래된 버전이라는 이유로 A까지 되돌리지 않는다.
11. **그럴 수 없다.** 실패 원인의 의미가 바뀐다. 데이터를 고치는 대신 그 의미를 읽을 수 있는 프로그램과 검증된 배포 순서를 준비한다.
