# 중지한 Cloud 환경 재개와 IAM 조회 오류

## App과 DB를 다시 켜는 의미

중지한 환경을 재개할 때는 RDS와 App Task를 같은 방식으로 다루지 않는다. RDS는 보관한 데이터와 설정을 사용해 다시 시작한다. 종료한 Fargate Task는 그대로 다시 시작하지 않고 같은 Image·명세로 새 Task를 실행한다.

새 JVM의 Controller·Service·Repository 객체는 새로 만들어진다. 기존 Ticket은 같은 RDS에서 불러올 수 있지만 이전 JVM 메모리에 있었던 로그인 Session은 복원되지 않는다. 이 차이는 설명할 수 있었으며, 실제 문의 보존은 재개 뒤 조회로 확인해야 한다.

Task가 RUNNING이어도 ALB의 Target Group에 새 Task의 Private IP·8080이 등록되지 않았다면 요청을 전달할 대상이 없다. 같은 ALB를 유지하므로 서비스 CNAME은 그대로 두고 Target 등록을 갱신한다.

## Console의 빨간 오류와 DB 장애를 구분한다

RDS 상세 화면에서 `DescribeGlobalClusters`의 허용 정책이 없다는 메시지를 봤다. 이 API는 Aurora Global Database의 클러스터 정보를 조회한다. 현재 일반 PostgreSQL DB의 Password 인증이나 SQL 조회가 아니다.

Console 한 화면은 여러 API를 호출한다. 부가 목록 조회가 거부되어도 별도로 허용된 DB 상태 조회·시작은 가능할 수 있다. 실제로 오류가 남아 있는 화면에서 지정 DB의 시작 요청이 성공했고, 이후 사용 가능 상태를 확인했다. 오류를 없애기 위해 불필요한 글로벌 조회 권한을 추가하지 않았다.

`no identity-based policy allows`는 해당 요청에 적용되는 Allow를 찾지 못했다는 뜻이다. 언제나 Action 자체가 빠졌다는 뜻으로 단정하지 않고 Resource·Condition도 함께 확인한다. 이번 부가 조회의 요청 주체는 사람이 사용하는 `helpdesk-deployer`이며 ECS Execution Role을 고칠 문제가 아니다.

## 시작 요청과 준비 완료는 다르다

RDS 시작 요청이 받아들여진 뒤에도 내부 시작 절차가 진행된다. ‘시작 중’과 ‘사용 가능’을 구분하고 DB가 준비된 다음 App Task를 실행하는 순서로 진행했다.

Image Digest·실행 명세·AI 비활성을 유지하면 프로그램을 새로 Build하지 않고도 새 실행 객체를 만들 수 있다. Source를 새로 작성하는 일과 새 JVM Process를 실행하는 일은 다르다.

이번에는 Task RUNNING 뒤에도 App 기동과 Target 회복을 기다렸다. Spring 시작 Log, Target Healthy와 실제 Health 응답은 각각 확인하는 대상이 다르다. Target이 처음 Unhealthy였다고 즉시 권한을 넓히거나 Health 기준을 낮출 필요는 없었다.

## 루트의 404와 로그인 실패는 다르다

AGENT 로그인 직후 `/`에서 404가 나왔다. 루트 화면을 구현하지 않았기 때문이며, 이어서 기존 Ticket 1·2와 각 PENDING Job을 조회할 수 있었다. 로그인 성공 여부는 이동한 화면의 유무만으로 판단하지 않고 인증이 필요한 요청의 결과로 확인한다.

처음 환경을 재개해 기존 문의를 읽은 결과는 RDS 데이터 보존을 확인하는 근거다. 그때는 중지 전 Session의 유효성을 먼저 확인하지 않았으므로 Session 소실의 전후 비교와 구분했다. 이후 복원 DB로 전환할 때에는 AGENT 조회 성공을 먼저 확인했다. 기존 App 종료·새 App의 Target Healthy 뒤 같은 화면에서 재로그인 없이 조회하자 ‘로그인이 필요합니다’가 나왔다. 전환 직전에 유효했던 로그인 상태도 새 JVM에 이어지지 않는 것을 비교할 수 있었다.

## Snapshot 시점과 App의 접속 대상

오전 10시 Snapshot을 만든 뒤 10시 5분에 문의를 접수했다면, 그 Snapshot만 복원한 DB에는 나중 문의가 없다. 원본 DB에 지금 존재하는 데이터와 Snapshot이 보관한 시점의 데이터를 구분해야 한다.

복원한 DB는 원본과 별개의 Instance이며 Endpoint도 다르다. 복원했다고 현재 App의 연결 대상이 자동으로 바뀌지는 않는다. 복원 DB를 App으로 확인하려면 그 Endpoint를 사용하는 실행 설정으로 새 App을 실행해야 한다. 원본 DB에 연결된 App은 계속 원본 데이터를 읽는다.

두 내용을 질문에 답하면서 설명할 수 있었다. 이후 원본 DB의 읽기 전용 기준 결과를 확보하고 Snapshot 한 개를 생성해 사용 가능·비공개·암호화를 확인했다. 별도 DB 복원 뒤 TLS로 접속해 원본과 같은 SQL을 실행했고, 일곱 Table의 건수와 내용 Hash가 모두 일치했다. 이어서 기존 App을 종료하고 복원 DB 주소를 쓰는 새 App 한 개를 실행했다. 새 App의 Log에서 복원 Endpoint 연결과 기존 Migration 7개 확인·Spring 시작 완료를 확인했다. Target Healthy 뒤 AGENT로 재로그인해 Ticket 1·2의 제목·OPEN과 PENDING Job을 조회했다. 원본 DB용 새 App으로 돌아온 뒤에도 재로그인해 같은 문의와 Job을 다시 조회했다. DB를 복원하는 작업과 App의 접속 대상을 바꾸는 작업을 실제 흐름으로 구분할 수 있었다.

복원된 DB에도 PENDING Job이 남아 있을 수 있다. 데이터를 확인하려는 검증 App의 Worker를 켜면 외부 AI 호출이 시작될 수 있으므로 먼저 꺼 두어야 한다. Job이나 누적 예약 수를 초기화해서 검사하는 것이 아니다.

RDS의 사용 가능 표시는 DB가 준비됐다는 뜻이지 문의 본문·작성자·관계가 모두 복원됐다는 뜻은 아니다. 실제 Row를 읽어 원본 기준과 비교해야 한다. Worker 비활성과 실제 Row 비교가 필요한 이유도 설명할 수 있었다.

## 권한 준비와 데이터 복원을 나누어 확인한다

Snapshot 목록을 읽는 권한, Snapshot을 만드는 권한과 별도 DB로 복원하는 권한은 서로 다르다. 이번에는 기존 배포 Policy를 계속 늘리는 대신 복원 전용 Policy 한 개를 별도로 연결했다. 목록 조회가 가능해진 것만으로 Snapshot 생성이나 복원까지 성공했다고 판단하지 않는다.

원본과 복원 DB의 행 개수가 같아도 본문·작성자·상태까지 같다는 뜻은 아니다. 동일한 방식으로 정렬한 행 내용의 Hash를 함께 비교하면 원문을 화면에 출력하지 않고 차이를 확인할 수 있다. Hash는 비교 도구일 뿐 개인정보가 없다는 증명이나 익명화는 아니다.

조회 SQL은 Repeatable Read·Read-only Transaction으로 실행한다. 같은 Transaction의 조회들은 일관된 기준으로 읽지만, 그것만으로 다른 연결의 쓰기까지 멈추지는 않는다. Snapshot 기준을 비교하는 동안 새 문의 접수를 하지 않고 Worker도 꺼 두어야 한다.

## IAM Action이 있어도 조건이 맞아야 실행된다

복원 Action을 정책에 넣었는데도 요청이 거부됐다. 정책의 Action 이름만 있는 것이 아니라 요청 대상과 조건까지 맞는 Allow가 있어야 한다. CloudTrail에 요청 옵션이 남지 않았다면 어떤 조건이 틀렸는지 단정할 수 없다. null은 내가 폼에서 그 옵션을 선택하지 않았다는 뜻도 아니다.

이번에는 모든 조건을 없애는 대신 지정 Snapshot·Subnet으로 범위가 유지되는 세 조건만 승인 후 조정했다. MFA·서울·비공개·최소 사양·용량 제한은 그대로 두었고, 비Root로 재요청해 생성 시작을 확인했다. 이 결과로 수정한 정책 조합이 요청을 허용했다는 것은 알 수 있지만, 세 조건 각각이 어떤 값으로 평가됐는지까지 알아낸 것은 아니다.

정책 편집기의 오류 0개, AWS의 복원 요청 수락과 실제 Row 일치는 서로 다른 확인이다. 문법 검사를 통과해도 실제 요청은 거부될 수 있고, DB 생성이 시작됐다고 데이터 대조가 끝난 것도 아니다.

## 기존 연결을 정리한 뒤 새 App을 실행한다

Target 등록 해제와 App 종료는 같은 작업이 아니다. Target을 빼도 기존 연결을 마무리하는 Draining 시간이 있고, App Process는 별도로 실행 중일 수 있다. 이번에는 기존 300초를 유지하고 등록 대상·Draining이 0개가 된 뒤 Task를 중지했다. 기존 Task의 STOPPED를 확인하고 새 Task 한 개를 실행했으므로 두 JVM을 동시에 운영하는 방식과 다르다.

새 Task의 RUNNING은 Spring의 모든 준비가 끝났다는 뜻이 아니다. 실제로 RUNNING 뒤에도 App이 DB에 연결하고 Flyway 이력을 확인하는 시간이 필요했다. Spring 시작 완료와 ALB의 연속 Health Check 통과를 기다리며, 준비 중인 Unhealthy를 곧바로 잘못된 DB 암호나 IAM 문제로 해석하지 않는다.

## DB를 중지해도 데이터와 비용이 모두 없어지는 것은 아니다

검증이 끝난 임시 DB는 처음에는 삭제하지 않고 중지하기로 했다. 실제로 일시적으로 중지됨과 연결 0개를 확인했다. 중지는 Instance 실행을 멈추는 것이며 데이터·설정·Storage와 Backup은 남는다. 따라서 중지 상태를 비용 0원이나 영구 정지로 이해하면 안 된다.

RDS는 연속 최대 7일만 중지할 수 있고 이후 자동으로 다시 시작한다. 중지 중에도 할당 Storage와 Backup 비용은 남는다. 이번 중지 확인창에는 10/23 자동 재시작 예정이 표시됐다. 원본 DB와 검증 Snapshot은 따로 유지한다. [AWS의 RDS 중지 안내](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html)

이후 임시 DB의 용도와 삭제 필요 여부를 확인하고, 원본 DB와 검증 Snapshot을 유지한 채 임시 DB·해당 자동 Backup만 삭제하도록 승인했다. 추가 최종 Snapshot은 만들지 않았다. 삭제 후 목록에는 사용 가능한 원본 DB 한 개만 남았고 검증 Snapshot도 사용 가능 상태로 유지됐다. 다음에 같은 복원 실험을 반복하려면 보존한 Snapshot으로 새 DB를 만들어야 한다.

## Image Rollback의 대상과 호환성

이번 복원 실험에서는 같은 Image를 유지하고 DB 접속 대상만 바꿨다. 실행 명세가 :1에서 :2로 바뀌었어도 프로그램 버전을 바꾼 것은 아니다. 다음 Image Rollback은 같은 원본 RDS를 유지한 채 실행할 프로그램을 다른 Digest의 이전 정상 Image로 교체하는 실험이다.

사전 Source 비교에서 10/10 Image에는 현재 명세가 요구하는 RDS CA 파일과 배포 사용자 Configuration이 없음을 확인했다. 단순히 오래된 Image라는 이유로 복귀 대상으로 선택할 수 없다. Cloud에서 기동·로그인·업무 조회를 확인한 Image를 기준으로 보존하고, 후속 후보와 현재 DB·실행 설정의 호환성을 점검하는 순서가 필요하다.

이어진 문답에서는 명세의 개정 번호가 바뀌어도 Digest가 같으면 프로그램 버전은 같고, 같은 RDS에 Commit된 Ticket은 Image를 되돌려도 남는다고 답했다. Image와 실행 명세, DB의 수명을 구분한 것이다.

추가 점검에서는 Column 삭제 없이도 새 실패 코드 때문에 읽기 호환성이 깨질 수 있는 사례를 확인했다. 현재 Cloud Image의 고정 Source Enum은 두 개인정보 검사 실패 코드를 모르지만 후속 Source의 V8은 그 값의 저장을 허용한다. 고정 Source Enum의 JShell 확인에서도 기존 코드는 변환됐고 새 두 코드는 거부됐다. 전체 구버전 App의 PostgreSQL 연결이나 Cloud 오류를 재현한 결과는 아니다.

새 값을 읽는 준비 버전 P를 먼저 마련하고, 그 뒤 새 값을 저장하는 B를 배포하는 순서를 다뤘다. B가 새 값을 저장했다면 P로 복귀해야 하는 이유를 ‘새 실패 코드를 읽을 수 있기 때문’이라고 답했다. 실패 코드를 다른 값으로 바꾸면 실제 원인을 왜곡하므로 안 된다는 점도 설명했다. 새 값을 모르는 맨 처음 버전 A까지 바로 돌아갈 수 있는 것은 아니다.

이후 별도 P Worktree에서 Java Enum과 UI의 읽기만 바꿔 로컬 PostgreSQL을 검증했다. 운영 Migration은 V7까지 두고 V8을 Test Fixture로 적용했다. P가 V8 DB에서도 기동해 두 새 실패를 HTTP 200·Job FAILED·원래 코드로 조회했고, 기존 원문·작성자·대기/성공/실패·예약·제안이 조회 전후 유지됐다. 같은 JVM의 Spring Context를 새로 만든 실험이며 실제 Process 교체나 Browser E2E로 확대하지 않는다. AI는 호출하지 않았고 새 실패 데이터는 합성 Fixture로 만들었다.

Flyway에는 DB가 V8인데 프로그램의 최신 Migration이 V7이라는 경고가 있었다. 기본 Future 처리로 기동됐다는 사실과 프로그램이 새 Row를 올바르게 읽는다는 사실은 다르다. 로컬에서는 기동과 실제 데이터/API 조회를 함께 확인했다. 이 결과와 뒤의 Cloud 전환은 별개의 검증이다.

## Image 빌드와 실행 검증은 다르다

P를 Docker Image로 만들고 로컬 Container에서도 실행했다. 먼저 Image에서 JAR를 꺼내 운영 Migration이 V1~V7뿐인지, 새 실패 코드를 읽는 Enum·UI와 공개 CA 파일이 제대로 포함됐는지 확인했다. 파일이 들어 있다는 확인과 프로그램을 실제 실행해 요청을 처리한다는 확인은 별개다.

같은 P Image를 V7 DB와 V8 DB에서 실행해 로그인·CSRF·접수·조회가 동작하는지 확인했다. V8은 로컬 Test 단계에만 외부에서 적용하고 그 설정을 제거한 뒤 P를 다시 실행했다. 따라서 P에 새 값을 쓰는 기능이나 V8 파일을 넣어 호환되는 것처럼 만든 실험이 아니다. 새 실패 두 건은 실제 AI가 만든 결과가 아니라 검증용 SQL 데이터다.

이번에는 Spring Context만 새로 만든 것이 아니라 실제 Container와 JVM을 바꿨다. DB Process와 Volume은 그대로 두었으므로 문의·작성자·제안은 남았고, 이전 JVM의 Session은 사라져 재로그인이 필요했다. 같은 Image를 쓰더라도 실행 객체와 메모리까지 이어지는 것은 아니라는 점을 다시 확인했다.

App은 0.25 vCPU·512 MiB로 제한했고 AI Provider와 Worker는 껐다. 이 결과는 기본 접수·조회 흐름의 로컬 실행 근거이며 전체 AI 처리의 자원 검증이나 AWS 배포 완료를 뜻하지 않는다. AWS 리소스는 변경하지 않았다.

## CI의 실행 신원과 프로그램 Source를 구분하기

준비 P의 읽기 변경과 Container 검증은 두 Commit으로 나누어 기록했다. 원격 CI는 main이 관리하는 Manifest에서 지정 P Commit을 선택하고 그 Source를 따로 검사했다. AWS의 main OIDC 조건은 Role을 사용하는 실행의 신원을 확인하는 것이지 Image 안의 모든 코드가 main인지 대신 확인하는 것은 아니다.

그래서 Workflow Commit과 프로그램 Source Commit을 나누어 기록하고, P의 Test·Image Label·전달 Artifact·ECR Digest가 이어지는지 확인했다. P 전체 Java 579개·JavaScript 181개가 통과한 Image를 업로드했고, main 전체 회귀는 Java 704개·JavaScript 254개로 따로 확인했다. Publish 단계에서는 다시 Build하지 않았다.

ECR에 Image가 저장됐다고 App 서버가 그 Image를 실행하는 것은 아니다. 이 전달 단계에서는 P 산출물만 업로드했고 App·DB·ALB를 바꾸지 않았다. DB와 App 복구의 개념은 [별도 학습자료](../study-docs/database-and-application-recovery.md)로 정리했다.

## 같은 프로그램도 실행 설정이 다르면 기동에 실패한다

P 전환에서는 Image뿐 아니라 실행 명세의 출처와 DB 주소도 확인해야 한다는 점을 배웠다. 처음 사용한 :3에는 삭제한 임시 복원 DB 주소가 남아 있어 DB 연결 단계에서 실패했다. 이를 P 코드의 오류나 DB Password 오류와 혼동하지 않는다. A로 복귀한 뒤 실제 기준 :1의 JSON에서 Image만 바꾼 :4를 검증해 다시 실행했다.

태그가 명세에 있다는 사실과 실행 요청에 태그가 포함됐다는 사실도 같지 않았다. 기존 IAM 조건이 요구한 요청 태그를 직접 넣어 해결했으며 권한을 넓히지 않았다. 입력 폼이나 클립보드만 믿지 않고, 등록된 명세와 실제 Task가 사용하는 설정을 대조해야 한다.

수정한 P는 원본 RDS의 V7에 연결됐고 추가 Migration 없이 기동했다. Target Healthy와 HTTPS를 확인한 뒤 AGENT로 직접 재로그인했다. 기존 Ticket 1·2의 제목과 OPEN 상태, 각 Job의 PENDING을 다시 읽을 수 있었다. AI Provider와 Worker는 계속 꺼 두었다. 읽기 준비 P의 배포와 새 값을 저장하는 B의 활성화·B→P 복귀는 서로 다른 단계임을 구분한다. 상세 실행은 [P Cloud 전환 보고서](../lab-reports/2026-10-16-prepare-image-cloud-transition.md)에 남긴다.

## B의 DB 변경과 P 복귀를 구분하기

B는 새 개인정보 검사 실패 코드 두 개를 저장할 수 있도록 V8을 적용한다. 이번 V8은 기존 Row를 바꾸지 않고 허용 코드만 늘린다. 실제 B 기동 전후의 여섯 업무 Table 건수·내용 Hash가 모두 같고 Flyway 이력만 7건에서 8건으로 늘어난 것을 확인했다.

P로 돌아갈 때 DB도 V7로 되돌리는 것은 아니다. V8과 B 단계에서 추가한 Row를 남겨 놓고 P가 그 값을 올바르게 조회하는지가 핵심이다. 그래서 아직 새 값을 읽지 못하는 A가 아니라 읽기 준비를 마친 P를 복귀 대상으로 사용한다.

이번에 추가한 Ticket/Job 3·4는 새 실패 값을 조회하기 위한 별도의 합성 SQL 자료다. 실제 개인정보 검사나 AI 호출이 실패한 기록이 아니며, 포함된 Attempt도 실제 API 사용량으로 계산하지 않는다. 기존 문의를 실패로 바꾸거나 실제 Worker를 켜지 않고 저장·조회 호환성을 확인하는 범위다. B와 복귀한 P 모두에서 기존 문의·두 PENDING Job과 합성 Job 3·4의 원래 실패 코드를 조회했다. P 기동 뒤와 인증 조회 뒤에도 V8 이력을 포함한 일곱 Table의 건수·Hash가 복귀 직전과 같았다. 기존 JVM의 Session은 이어지지 않아 P에서도 재로그인했다. P로 돌아가는 것은 프로그램 교체이지 DB를 V7로 되돌리는 일이 아님을 실제 흐름에서 확인했다. P 복귀·최종 대조의 실제 실행일은 10/17 KST이며, 학습 회차는 이 노트로 이어서 정리한다. 상세는 [B→P 실행 보고서](../lab-reports/2026-10-16-image-rollback-cloud.md)에 있다.

## 접속 도구와 DB 및 Schema의 버전을 구분하기

`psql 16.15, server 17.11` 경고는 접속 도구와 DB 엔진의 주 버전이 다르다는 뜻이다. DB 자체가 고장 났다는 메시지가 아니다. 일반 SQL 조회는 동작할 수 있지만 `\d` 같은 도구 명령의 호환성에는 주의해야 한다. 관리 도구를 psql 17.x로 맞추는 안과 정상 RDS의 엔진을 바꾸는 작업은 별개다. 이번에는 SQL 대조를 진행했으며 도구를 설치하거나 DB 엔진을 변경하지 않았다.

Flyway의 V8은 PostgreSQL 17.11과 다른 번호다. 전자는 Helpdesk의 테이블 변경 이력이고 후자는 DB 서버 프로그램의 버전이다. P Image를 실행해도 이 둘이 자동으로 이전 상태가 되지 않는다. Spring App이 사용하는 JDBC Driver와 사람이 접속할 때 사용하는 psql도 구분한다. [복구 학습자료의 버전 설명](../study-docs/database-and-application-recovery.md#관리-도구와-db-엔진-및-schema-버전은-다르다)

## 핵심 질문

1. 새 Task가 RUNNING인데 Target이 0개라면 DNS와 Target 등록 중 무엇을 확인해야 하는가?
2. 같은 RDS의 Ticket과 이전 JVM의 로그인 Session은 재개 후 각각 어떻게 되는가?
3. `DescribeGlobalClusters`가 거부됐다는 것만으로 PostgreSQL Password가 틀렸다고 말할 수 있는가?
4. DB 시작 요청 성공·DB 사용 가능·App RUNNING·Target Healthy·업무 조회 성공은 각각 무엇을 확인하는가?
5. 로그인 직후 루트가 404여도 AGENT 전용 조회가 성공한다면, 로그인 실패와 화면 미구현 중 무엇을 구분해야 하는가?
6. Snapshot 뒤에 접수한 문의는 그 Snapshot만 복원한 DB에도 존재하는가?
7. 새 DB를 복원한 것과 현재 App의 DB 접속 대상을 변경한 것은 왜 별개의 작업인가?
8. 복원한 PENDING Job이 있는 App의 Worker를 켜면 데이터 조회 외에 어떤 일이 시작될 수 있는가?
9. 복원 DB의 사용 가능 표시와 실제 문의 본문·작성자 보존은 어떻게 나누어 확인하는가?
10. 같은 행 개수와 같은 행 내용은 어떻게 다르며, 내용 Hash를 함께 비교하는 이유는 무엇인가?
11. 읽기 전용 Transaction을 시작하면 다른 App의 쓰기도 자동으로 차단되는가?
12. IAM 정책에 Action이 있는데도 `no identity-based policy allows`가 나올 수 있는 이유는 무엇인가?
13. 편집기 오류 0개·복원 요청 수락·복원 DB의 실제 Row 일치는 각각 무엇을 확인하는가?
14. Target 등록 해제·Draining 종료·Task STOPPED는 왜 서로 다른 확인인가?
15. 새 Task가 RUNNING인데 App 기동이나 Target Health를 더 기다려야 할 수 있는 이유는 무엇인가?
16. 임시 RDS를 중지해도 남는 데이터·비용은 무엇이며, 7일 뒤 어떤 일이 발생하는가?
17. Task Definition 개정 번호가 바뀌어도 같은 Image라면 프로그램 버전의 Rollback이라고 할 수 있는가?
18. 이전 Image에 현재 TLS 연결에 필요한 CA 파일이 없다면 Image Pull 성공만으로 정상 복귀를 기대할 수 있는가?
19. Image A로 되돌리되 같은 RDS를 유지한다면 Image B에서 이미 Commit한 문의와 DB Schema는 어떻게 되는가?
20. Column을 삭제하지 않았어도 새 Enum 값의 저장 때문에 이전 프로그램의 조회가 실패할 수 있는가?
21. 읽기 준비 P 뒤 새 값 저장 B를 배포했다면, B에서 복귀할 기준은 맨 처음 A인가 P인가?
22. P의 Image에 V8이 없는데 V8 DB에서 기동했다는 사실만으로 모든 미래 Schema와 호환된다고 할 수 있는가?
23. 같은 Image로 JVM을 교체할 때 DB Row는 유지되지만 로그인 Session은 사라질 수 있는 이유는 무엇인가?
24. 로컬 Image 실행·실제 HTTP 확인과 AWS의 RDS TLS·ALB·Browser 확인은 각각 무엇을 검증하는가?
25. Workflow가 main에서 실행됐어도 P Source를 별도로 고정·검증해야 하는 이유는 무엇인가?
26. CI의 Image ID·전달 Artifact Hash·ECR Manifest Digest는 같은 대상을 식별하는가?
27. 복원한 DB에 AI 예약이 없다고 바로 AI를 재호출하면 안 되는 이유는 무엇인가?
28. 올바른 Image를 실행했어도 실행 명세가 삭제한 DB 주소를 가리킨다면 어느 단계에서 실패할 수 있는가?
29. 명세의 태그와 실행 요청 태그가 IAM 조건에서 같은 의미인지 어떻게 확인해야 하는가?
30. psql 16.15·PostgreSQL 17.11·Flyway V8은 각각 무엇의 버전인가?
31. 관리 도구의 주 버전 경고를 해결하려고 정상 RDS를 이전 버전으로 낮춰야 하는가?
32. P로 복귀한 뒤에도 V8의 새 실패 코드와 기존 업무 Hash를 다시 확인하는 이유는 무엇인가?

실제 Task·Target·HTTPS와 기존 문의의 재개 후 결과는 실행 보고서에 따로 정리한다. 준비한 설정이나 시작 요청만으로 재개 검증 전체를 완료 처리하지 않는다.
