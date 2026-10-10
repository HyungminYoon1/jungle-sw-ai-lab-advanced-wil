# 배포 장애 관찰과 Application Rollback 그리고 Database 복원

배포 후 오류가 나면 이전 Image로 바꿀 것인지, 실행 설정을 고칠 것인지, DB를 복원할 것인지 구분해야 한다. 프로그램·설정·데이터가 서로 다른 곳에 있으므로 복구 방법도 다르다.

[Image 전달 자료](./image-publishing-and-ecs-execution.md)와 [Network와 HTTPS 자료](./aws-network-dns-and-https.md)의 흐름을 기준으로, 실패한 위치를 찾고 복구 결과를 확인한다.

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

## 핵심 질문

1. ALB가 직접 반환한 `5xx`와 Helpdesk가 반환한 `5xx`를 어떻게 구분할 수 있는가? 어느 Log와 Metric을 먼저 확인할 것인가?
2. App만 이전 Image로 되돌리면 같은 RDS에 접수된 문의와 Flyway Migration도 과거로 돌아가는가?
3. Snapshot 복원으로 새 DB를 만든 뒤 무엇을 조회해야 복원 성공을 확인할 수 있는가? 왜 확인용 App의 Worker는 먼저 꺼 두는가?

## 핵심 질문 해설

1. **응답을 생성한 계층을 나눈다.** ALB의 ELB·Target 오류 Metric과 관련 기록, App의 Request Log를 대조하고 Target 연결 문제인지 업무 오류인지 찾는다.
2. **돌아가지 않는다.** 프로그램과 데이터의 복구는 별개다. 현재 Schema와 이전 코드의 호환성도 확인해야 한다.
3. **복원 시점의 실제 Row·관계·상태와 Migration 이력을 확인한다.** Worker 비활성은 복원된 미완료 Job의 외부 호출을 통제하기 위한 것이다.
