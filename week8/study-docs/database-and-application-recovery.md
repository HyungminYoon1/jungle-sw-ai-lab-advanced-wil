# DB와 App 서버 복구

Helpdesk에 문제가 생겼다고 해서 프로그램과 데이터를 모두 과거로 돌릴 필요는 없다. 먼저 **잘못된 것이 실행 중인 App인지, 실행 설정인지, 저장된 데이터인지**를 나눈다. 이 구분에 따라 App 재시작, Image Rollback, DB 복원 중 필요한 작업을 선택한다.

이 자료는 복구의 기본 개념부터 App과 DB를 연결해 확인하는 순서까지 설명한다. 실제 리소스 이름·실행 결과는 학습노트와 실습 보고서에서 확인하고, 여기서는 복구 원리와 판단 기준을 익힌다.

## 1 프로그램과 데이터는 어디에 있는가

```text
ECR의 Image                  실행 중인 App Task              별도 RDS
  JAR와 공개 CA 파일     →     JVM과 Spring 객체       →       Ticket·Message·Job
  프로그램의 재료              Controller·Service              Attempt·Suggestion
                              메모리 HttpSession              Flyway 적용 이력
```

Image는 실행에 필요한 파일을 보관한다. Task를 시작하면 새 JVM에서 Spring 객체가 만들어진다. App을 종료하면 메모리 객체는 사라지지만, 별도 RDS에 Commit한 Row는 그 이유만으로 사라지지 않는다.

현재 학습 구성의 로그인 Session은 App JVM 메모리에 있다. Browser의 `JSESSIONID` Cookie는 Session을 찾기 위한 식별자이며 사용자 인증 상태 전체를 담은 복원 파일이 아니다. 새 JVM에 이전 Session이 없다면 Cookie가 Browser에 남아 있어도 다시 로그인해야 한다. 외부 Session 저장소를 사용하는 설계는 이 구성과 다르다.

## 2 세 가지 복구 방법을 구분한다

| 방법 | 바꾸는 것 | 같은 RDS의 기존 Row | 로그인 Session |
|---|---|---|---|
| 같은 Image로 새 App 실행 | 실행 객체와 JVM | 그대로 남는다 | 현재 메모리 Session은 새로 로그인해야 한다 |
| Image Rollback | 실행할 프로그램 버전 | 자동으로 과거로 돌아가지 않는다 | 새 JVM에서는 재로그인한다 |
| Snapshot으로 DB 복원 | 특정 시점 데이터를 가진 새 DB 생성 | 원본은 유지되고 복원 DB가 따로 생긴다 | DB 복원만으로 App의 Session이 복원되지는 않는다 |

설정만 잘못됐다면 설정을 바로잡고 같은 Image로 새 Task를 실행할 수 있다. Java 코드나 Image 안의 공개 CA 파일을 바꿨다면 새 Image가 필요하다. Parameter Store의 Password를 수정한 것만으로 이미 실행 중인 Container의 환경 변수가 바뀌지는 않는다.

### 상황으로 고르기

- JVM만 종료됐고 데이터와 프로그램이 정상이라면 같은 Image로 새 App을 실행한다.
- 새 프로그램의 결함으로 요청이 실패하고 DB는 정상이라면, 현재 DB와 호환되는 이전 정상 Image로 복귀한다.
- 잘못된 데이터 삭제·변경을 복구해야 한다면, 보관한 Backup과 복구 시점을 검토한다.
- `28P01`이 발생했다면 PostgreSQL Password 인증부터 확인한다. IAM 권한을 넓히거나 TLS 검증을 끄는 방식으로 해결하지 않는다.

## 3 같은 Image로 App을 다시 실행하기

단독 Fargate Task가 중지됐으면 새 Task를 시작한다. Task Definition은 실행 명세이며 그것을 등록했다고 App이 시작된 것은 아니다. 중지된 Fargate Task 자체를 다시 시작하는 작업도 아니다.

실행 중인 단독 App을 교체하는 순서는 다음과 같다.

1. 현재 Image Digest·실행 명세·DB Endpoint·기능 활성 상태를 기록하고, 로그인한 AGENT로 기존 문의를 조회한다.
2. 기존 Target의 등록을 해제하고 Draining이 끝난 뒤 기존 Task를 종료한다.
3. 검증한 Image와 같은 DB를 사용하는 새 Task를 실행한다.
4. 새 Task의 Private IP와 App Port를 Target Group에 등록하고 Healthy를 확인한다.
5. 기존 Session으로 보호된 조회가 거부되는지 확인한 뒤 재로그인하고 같은 문의·Job을 조회한다.

이 순서는 단일 App·일시 중단을 허용하는 실습 방식이다. ECS Service가 Task를 관리하는 환경에서는 Service의 배포·Target 등록 동작을 사용하므로 수동 단독 Task와 구분한다. [AWS의 Target 등록 해제 설명](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html#deregistration-delay)

같은 ALB를 유지하면 Task의 Private IP가 바뀌었다는 이유만으로 서비스 CNAME을 바꾸지 않는다. 반대로 ALB를 새로 만들었다면 DNS 대상도 다시 확인해야 한다.

## 4 이전 Image로 돌아가기 전에 확인하기

Image Rollback은 실패한 새 프로그램을 이전 정상 프로그램으로 바꾸는 일이다. 같은 RDS를 사용한다면 새 프로그램이 이미 Commit한 Ticket과 Migration 이력은 남는다.

예를 들어 새 Image B를 실행한 동안 Ticket 8을 접수했다면, 이전 Image P로 바꿔도 Ticket 8은 RDS에 남는다. 다만 P가 현재 DB 구조와 상태값을 해석할 수 있어야 실제 조회도 성공한다.

### Column을 삭제하지 않아도 호환성이 깨질 수 있다

기존 A가 `PROVIDER_REFUSED`만 알고 있는데 B가 `PRIVACY_SCAN_TIMEOUT`을 저장한다고 가정하자. Column과 Row가 그대로여도 A의 Enum 변환이나 Browser 응답 검증기가 새 문자열을 거부할 수 있다.

이 문제를 줄이기 위해 읽기 준비와 새 값 쓰기를 나눈다.

```text
A  기존 값만 읽고 쓴다
  ↓
P  기존 값과 지정한 새 값을 모두 읽는다
   새 값을 만들어 저장하는 기능은 아직 활성화하지 않는다
  ↓
B  준비한 계약으로 새 값도 저장한다
  ↓ 문제가 생기면
P  B가 저장한 값을 읽을 수 있는 준비 버전으로 복귀한다
```

B가 새 값을 저장했다면 기본 복귀 대상은 검증한 P다. 새 값을 모르는 A까지 돌아가려면 별도의 호환성 판단이 필요하다. 실패 코드를 기존의 다른 코드로 덮어써 조회를 통과시키면 실제 실패 원인이 바뀌므로 그렇게 하지 않는다. [Amazon의 Prepare와 Activate 원칙](https://aws.amazon.com/builders-library/ensuring-rollback-safety-during-deployments/)

### Migration 기동 성공과 업무 호환성은 다르다

Flyway는 Migration 파일과 적용 이력을 검증한다. DB에 적용된 버전이 프로그램에 포함된 최신 파일보다 높은 경우에는 설정에 따라 기동이 허용될 수도 있다. 그것이 해당 프로그램의 모든 조회·저장이 정상이라는 판정은 아니다.

준비 P는 지정한 후속 Schema에 연결해 기동·기존 상태·새 실패 코드·접수·보안을 함께 확인한다. 적용한 Migration 파일을 고치거나 이력을 지워 이전 버전처럼 꾸미지 않는다. Image를 바꿔도 삭제된 Column이 자동으로 생기지는 않는다.

### 관리 도구와 DB 엔진 및 Schema 버전은 다르다

다음 세 번호는 서로 다른 대상을 나타낸다.

| 표시 예 | 버전을 가진 대상 | 바꾸면 달라지는 것 |
|---|---|---|
| psql 16.15 | 사람이 SQL을 입력하는 접속 도구 | SQL 입력·결과 표시와 도구의 부가 명령 |
| PostgreSQL 17.11 | RDS에서 동작하는 DB 엔진 | DB 서버 프로그램 |
| Flyway V8 | Helpdesk가 적용한 Migration 이력 | 애플리케이션의 테이블·제약 등 Schema |

`psql major version 16, server major version 17` 경고는 도구가 서버보다 이전 주 버전이라는 뜻이다. DB가 중단됐다거나 TLS 접속에 실패했다는 뜻은 아니다. 일반 SQL 실행·결과 표시는 동작할 수 있지만, `\d` 계열처럼 서버의 내부 목록을 읽는 도구 명령은 실패할 수 있다. 관리 도구의 주 버전을 서버와 같은 17로 맞추는 것이 좋으며, 이 경고를 없애려고 정상 DB를 16으로 낮출 필요는 없다. [PostgreSQL의 psql 호환성 안내](https://www.postgresql.org/docs/17/app-psql.html#APP-PSQL-NOTES)

Spring App은 psql이 아니라 JDBC Driver로 DB와 통신한다. 관리용 psql만 교체하는 일은 App Image 교체나 Flyway 이력 변경과 별개다. 반대로 App Image를 되돌려도 DB 엔진과 이미 적용한 V8이 자동으로 이전 버전으로 돌아가지는 않는다.

Private CloudShell에서 Client를 맞추려고 DB를 공개하거나 인터넷 경로를 새로 열 필요는 없다. 인터넷을 사용할 수 있는 로컬 환경에서 공식 Client를 준비한 뒤 검증한 파일만 전달하고, 기존 도구는 보존한 채 별도 경로에서 실행할 수 있다. Hash와 실행 Version을 확인하는 절차도 필요하다.

CloudShell VPC 환경의 파일·Shell 변수는 영구 저장 상태가 아니다. 세션이 끝나면 준비했던 Client·CA·PATH가 사라질 수 있다. 따라서 도구·공개 CA를 다시 준비하는 절차와 Password 직접 입력을 분리해 재현한다. Client 준비 완료는 DB 인증 성공과 다르며, 접속한 뒤 서버 버전·TLS·SQL 조회를 따로 확인한다.

## 5 Snapshot으로 DB를 복원하기

Snapshot은 특정 시점의 DB 상태를 보관한 Backup이다. RDS의 Snapshot 복원은 기존 DB를 덮어쓰는 작업이 아니라 **새 DB Instance를 만드는 작업**이다. 새 Instance에는 별도 Endpoint가 생긴다. [AWS의 Snapshot 복원 설명](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_RestoreFromSnapshot.html)

다음은 가상의 복구 시점 예시다.

```text
10:00 Snapshot 생성       Ticket 7까지 존재
10:10 Ticket 8 접수       원본 DB에는 7과 8이 존재
10:20 잘못된 데이터 변경

10:00 Snapshot으로 복원한 별도 DB
  → Ticket 7은 존재
  → Snapshot 뒤에 접수된 Ticket 8은 존재하지 않음
```

따라서 복원 뒤 누락되는 데이터를 먼저 파악한다. 자동 Backup·Transaction Log와 보존 범위가 준비돼 있다면 RDS의 Point-in-time Recovery로 지정 시점 복구를 검토할 수도 있다. 이것도 별도 DB를 만드는 복구이며, Snapshot을 선택한 실습과 같은 작업은 아니다. [AWS의 시점 복구 설명](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PIT.html)

복구에서 자주 쓰는 두 표현도 이 예시로 구분할 수 있다. **RPO**는 장애 전에 잃어도 되는 데이터의 시간 범위에 대한 목표이고, **RTO**는 서비스를 다시 제공할 때까지 허용할 복구 시간의 목표다. Snapshot이 있다고 두 목표를 충족하는 것은 아니다. 마지막 보관 시점과 실제 복원·기동·업무 확인에 걸린 시간이 목표에 맞아야 한다. [AWS의 복구 목표 설명](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/plan-for-disaster-recovery-dr.html)

## 6 복원 DB가 준비된 뒤 확인하기

복원된 DB가 `available`이면 DB를 사용할 수 있지만, 복원하려던 업무 데이터가 올바른지는 별도로 확인한다. 다음 순서로 점검한다.

1. **연결 대상과 보안:** 새 Endpoint·VPC·Subnet Group·Security Group·암호화·DB Parameter Group을 확인한다. 원본의 접속 제한이 모두 자동으로 선택됐다고 가정하지 않는다.
2. **TLS와 계정:** App 계정으로 `verify-full` 접속을 확인한다. CA 파일의 존재·Hash, Endpoint와 인증서 이름, 실제 DB Password를 나누어 점검한다. Password를 명령 인자나 Log에 넣지 않는다.
3. **Schema:** Flyway의 버전·성공·Checksum을 원본 기준과 비교한다.
4. **업무 Row:** Ticket·Message·Job·Attempt·Suggestion·Category의 건수·관계·상태와 원문·작성자 보존을 비교한다.
5. **다음 쓰기:** Identity Sequence가 기존 ID와 충돌하지 않을 상태인지 확인한다. 읽기 전용 대조에서는 `nextval`·`setval`로 Sequence를 움직이지 않는다.

같은 Row 수만으로 내용까지 같다고 할 수는 없다. 고정된 직렬화·정렬 조건으로 계산한 내용 Hash를 함께 비교하면 원문·작성자·상태 변경을 찾는 데 도움이 된다. 빈 Suggestion Table 두 개의 일치는 빈 상태 보존을 확인한 것이지, 성공 제안 데이터의 복원까지 시험한 것은 아니다.

전체 메시지나 Password를 진단 Log로 출력할 필요는 없다. 최소 권한 계정·읽기 전용 Transaction으로 필요한 존재 여부·건수·관계·Hash를 확인한다. 복구용 관리자 권한과 App의 평소 DB 권한도 분리해서 생각한다.

### SELECT 결과가 COMMIT 전에 보이는 이유

`SELECT`는 실행할 때 결과를 돌려준다. `COMMIT`은 조회 결과를 화면에 표시하는 명령이 아니라 현재 Transaction을 성공적으로 끝내는 명령이다.

읽기 전용 Transaction에서 조회한 뒤 `ROLLBACK`해도 이전에 다른 Transaction이 Commit한 Ticket은 지워지지 않는다. 반대로 현재 Transaction에서 INSERT한 Row를 조회한 뒤 `ROLLBACK`하면 그 INSERT는 취소된다. **결과를 한 번 봤다는 사실과 쓰기를 최종 확정했다는 사실은 다르다.**

## 7 App을 복원 DB로 연결하기

DB를 복원했다고 현재 App의 JDBC URL이 자동으로 바뀌지는 않는다. 검증한 같은 Image에 새 DB Endpoint를 전달해 새 App을 실행하고, 그 App이 복원 데이터를 읽는지 확인해야 한다.

```text
원본 DB의 기준 데이터 확보
  → Snapshot으로 별도 DB 복원
  → TLS·Schema·Row 대조
  → 같은 Image에 복원 Endpoint를 전달한 새 App 실행
  → 새 Target 등록·재로그인·기존 문의 조회
  → 검증 App 종료 후 원본 Endpoint의 App으로 복귀
```

Snapshot에는 DB 계정과 그 시점의 인증 정보도 포함되지만, 외부 Parameter Store 값까지 함께 되돌리는 것은 아니다. Snapshot 뒤 DB Password를 바꿨다면 복원 DB의 인증 정보와 현재 주입할 값이 다를 수 있다. 일치 여부를 확인하되 비밀값 자체를 출력하거나 원본 계정을 임의로 변경하지 않는다.

## 8 복원한 Job을 바로 실행하면 안 되는 이유

AI Provider와 Worker는 복원 확인 동안 끈다. Snapshot에 있는 PENDING·RUNNING Job을 바로 처리하면 외부 호출이나 중복 제안 저장이 시작될 수 있다.

특히 DB를 과거로 복원해도 외부 AI가 이미 수행한 요청과 과금까지 되돌아가지는 않는다. Snapshot 이후에 기록됐던 예약·처리 결과가 복원 DB에는 없을 수도 있다. 제안이 없다는 이유만으로 미호출이라고 판단하거나 Attempt·누적 예약을 0으로 초기화하면 안 된다.

자동 처리 재개 전에는 현재 정책·원래 처리 기한·현재 Attempt·실행권·예약·기존 저장 결과와 가능한 외부 요청 기록을 대조한다. 이것이 확인되지 않으면 자동 재호출 대신 보류·관리자 검토 등 승인한 복구 정책을 따른다.

## 9 임시 DB를 정리하기

복원 검증용 DB는 원본 DB를 대체한 운영 DB가 아니다. 원본으로 정상 복귀했고 새 업무 데이터를 넣지 않았으며 검증 Snapshot이 남아 있다면, 중복 DB를 계속 유지할 필요가 있는지 판단한다.

RDS를 중지해도 Storage·Backup 비용은 남고 연속 7일 뒤 자동 재시작한다. 삭제하면 Instance는 사라지므로, 정확한 대상을 확인하고 원본·남길 Snapshot·자동 Backup 처리·추가 최종 Snapshot 여부를 정한 뒤 승인된 범위만 정리한다. 원본 DB를 삭제하거나 검증 Snapshot을 공개하는 작업과 혼동하지 않는다. [AWS의 중지 조건](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html)

## 핵심 질문

1. 같은 Image로 새 App을 실행했는데 Ticket은 보이고 재로그인이 필요하다면 모순인가?
2. 새 Image에서 Ticket을 추가한 뒤 이전 Image로 바꾸면 그 Ticket도 사라지는가?
3. 새 실패 문자열을 이미 저장했다면 A와 읽기 준비 P 중 무엇을 복귀 대상으로 검토해야 하는가?
4. DB가 `available`이면 원문·작성자·제안의 복원을 모두 확인한 것인가?
5. Snapshot 뒤에 접수된 문의는 해당 Snapshot만 복원한 DB에도 있는가?
6. 같은 Image에서 DB Endpoint만 바꿨다면 Image Rollback을 수행한 것인가?
7. 읽기 전용 조회 후 ROLLBACK하면 기존에 Commit된 Ticket도 지워지는가?
8. 복원 DB에 제안·예약이 없다는 이유만으로 AI를 다시 호출해도 되는가?
9. 임시 DB를 중지하면 실행 비용과 보관 비용이 모두 없어지는가?
10. psql 버전 경고를 없애기 위해 RDS 엔진이나 Flyway 이력까지 이전 버전으로 바꿔야 하는가?

## 질문 해설

1. **모순이 아니다.** 문의는 RDS, 현재 Session은 이전 App의 JVM 메모리에 있었다.
2. **사라지지 않는다.** 같은 RDS에 Commit한 데이터는 Image 교체와 별개다. 이전 프로그램의 해석 가능성은 확인해야 한다.
3. **새 값을 읽는 P다.** P의 현재 Schema·파일·실행 설정·업무 조회까지 검증한다.
4. **아니다.** TLS·Migration·실제 Row와 관계, App 조회를 나누어 확인한다.
5. **없다.** 필요한 복구 시점과 이후 데이터를 어떻게 보존할지 먼저 판단한다.
6. **아니다.** 같은 프로그램의 연결 대상과 실행 명세가 바뀐 것이다.
7. **지워지지 않는다.** 이번 읽기를 끝내는 일과 과거에 확정한 쓰기를 취소하는 일은 다르다.
8. **안 된다.** 외부 호출은 DB 복원으로 취소되지 않는다. 누락된 이력·실행권·정책을 확인한다.
9. **아니다.** Storage·Backup과 자동 재시작을 고려하고 보존·삭제를 선택한다.
10. **아니다.** 접속 도구의 주 버전을 서버에 맞추는 문제다. DB 엔진·Schema·App Image의 버전과 구분한다.

## 이어서 읽기

- [배포 장애 관찰과 복구](./deployment-observability-and-recovery.md): Log·Metric에서 실패한 계층 찾기
- [검증한 Image를 ECR에서 ECS로 전달하기](./image-publishing-and-ecs-execution.md): Commit·Tag·Digest와 실행 명세
- [프로그램과 Cloud DB 연결](./cloud-database-and-application-connection.md): 계정·Secret·TLS·JDBC
