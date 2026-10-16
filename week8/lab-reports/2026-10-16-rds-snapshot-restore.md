# Snapshot 한 개와 별도 RDS의 복원 검증

> 실행일: 2026-10-16 KST
> 상태: 복원 DB의 SQL·App 조회와 단일 App 순차 전환·Session 전후 비교·원본 복귀 후 AGENT 재로그인 업무 조회 완료. 이후 별도 최종 승인으로 임시 DB와 해당 자동 Backup만 삭제 완료. 원본 DB·검증 Snapshot 유지

## 승인한 범위

원본 `helpdesk-learning`은 그대로 유지한다. `helpdesk-learning-20261016-recovery` Snapshot 한 개에서 `helpdesk-learning-restore-20261016` 한 개만 복원한다. PostgreSQL 17·db.t4g.micro·Single-AZ·gp3 20 GiB·비공개·암호화를 유지하고 기존 VPC·DB Subnet Group·RDS Security Group을 사용한다.

검증 App은 같은 Image·여섯 Parameter 참조를 사용하고 AI Provider·Worker·ECS Exec을 끈다. 원본 App과 동시에 두 개를 띄우지 않고 순차 전환한 뒤 원본 DB로 돌아온다. 원본 DB·Schema·Credential·DNS는 변경하지 않는다. 임시 DB 삭제는 검증 결과와 보존 대상을 확인한 뒤 별도 최종 승인을 받는다. Snapshot과 원본 DB 삭제는 이번 범위에 없다.

## IAM 적용과 현재 조회 결과

기존 Policy를 확장하는 대신 `helpdesk-deployer-db-recovery` Version 1을 새로 만들었다. 12개 Statement·여덟 RDS Action·공백 제외 4,799자로, 모든 문장에 MFA·서울 조건이 있다. AWS 편집기의 보안·오류·경고·추천은 각각 0이었다. 편집기에 넣은 JSON과 저장 후 복사한 전체 JSON을 각각 승인한 적용본과 대조해 일치했다.

연결 직전 승인을 받고 `helpdesk-deployer` 한 명에게만 연결했다. 기존 다섯 연결 정책을 유지한 총 여섯 개이며 기존 Policy Version·Execution Role·GitHub Role은 변경하지 않았다. Root 로그아웃 뒤 작성자가 비Root 로그인·MFA를 완료했다.

비Root의 원본 상세에서 DB 사용 가능과 기존 자동 Snapshot 세 개를 확인했다. 이전 `DescribeDBSnapshots` 거부는 해소됐고 승인한 수동 Snapshot 이름은 없었다. 일반 PostgreSQL 검증에 불필요한 `DescribeGlobalClusters` 거부는 추가 권한 없이 유지했다. 생성 화면에는 태그 입력란이 없었으며 원본에는 Snapshot 태그 복사가 켜져 있었다. 원본 SQL 기준을 확보한 뒤 지정 이름 한 개로 생성 요청했고, 정책 조건은 완화하지 않았다.

## 원본 데이터 기준

Lab의 `deploy/rds/recovery-verification.sql`은 Repeatable Read·Read-only Transaction에서 여섯 업무 Table과 Flyway 이력의 건수·내용 Hash, 본문/작성자 존재 건수, Job 상태·누적 예약, 참조 누락과 Identity Sequence 상태를 조회한다. 원문·작성자 이름·Credential은 출력하지 않는다. 실제 결과는 Git 제외 경로에만 보관하고 공개 문서에는 비교 결과를 정리한다.

기존 Private CloudShell 환경에서 공개 CA 검증 뒤 작성자가 App Password를 직접 입력해 접속했다. SQL은 오류 없이 끝났고 Transaction과 psql을 종료했다. `verify-full`·TLS 1.3·읽기 전용·Repeatable Read를 확인했다. 원본 Row·계정·Schema·Sequence를 변경하지 않았다.

| 원본 조회 대상 | 실제 기준 결과 |
|---|---|
| Ticket·Message·Job | 각각 2건 |
| 본문·작성자가 비어 있지 않은 Message | 각각 2건 |
| Job 상태·예약 | PENDING 2건, current_attempt·생성/보완 예약 모두 0 |
| Attempt·Suggestion·Category | 각각 0건 |
| 다섯 참조 관계의 누락 | 모두 0건 |
| Flyway | V1~V7 모두 성공 |
| Identity Sequence | Ticket·Message는 last_value=2/is_called=true, Suggestion은 1/false |

일곱 Table의 건수·내용 SHA-256도 Git 제외 `local/deployment/rds-recovery-source-baseline-20261016.json`에 보관했다. 빈 제안 Table의 복원은 빈 상태 보존만 검증하며 실제 제안 Row의 보존까지 확대하지 않는다. Snapshot 검증 중 새 문의 접수·Worker 실행은 하지 않는다.

## Snapshot 생성과 보존 설정

Snapshot 상세에서 생성 시각 14:51 KST·원본 `helpdesk-learning`·manual·PostgreSQL 17.11·gp3 20 GiB·같은 aws/rds Key와 최종 사용 가능 상태를 확인했다. 표시된 전체 Snapshot 크기는 2.73 GiB이며, 이를 그대로 실제 유료 Backup 사용량이나 확정 청구액으로 계산하지 않는다.

Project=helpdesk-learning 태그 한 개가 복사됐다. 공유 설정을 읽기 전용으로 열어 Private 선택·Public 미선택과 다른 계정 목록의 부재를 확인하고 저장하지 않은 채 취소했다. Snapshot 공유·Key·원본 설정은 변경하지 않았다. 초기 목록의 0개·생성 중 알림에만 의존하지 않고 지정 Snapshot의 실제 상세 결과를 확인했다.

## 복원 요청 거부와 진단 경계

복원 폼의 기본값은 Multi-AZ·db.m7g.large·기본 Security Group이었다. 승인한 이름·Single-AZ·db.t4g.micro·gp3 20 GiB·기존 학습 VPC/DB Subnet Group/RDS 전용 Group·Public Access 없음·암호화·기본 PostgreSQL 17 Group·Project 태그로 맞췄다. 유료 확장 지원은 끄고 Password 인증·CA·5432를 유지했다.

최초 생성 요청은 지정 새 DB ARN에 대한 `rds:RestoreDBInstanceFromDBSnapshot`의 적용 가능한 Allow가 없다는 오류로 거부됐다. 이 Action은 저장한 정책에 있으므로 메시지만으로 Action 누락을 원인으로 단정하지 않는다. 폼 선택값·실제 요청값·IAM 평가 조건을 구분한다.

비Root의 CloudTrail 조회도 `cloudtrail:LookupEvents` Allow 부재로 거부됐다. 영구 조회 권한을 추가하지 않고 별도 승인한 Root 진단으로 해당 실패 이벤트 한 건만 읽었다. 14:58:42 KST의 Restore 요청·AccessDenied·MFA=true를 확인했지만 `requestParameters`·`responseElements`는 null이어서 정확한 불일치 조건은 알 수 없었다. null을 실제 요청의 옵션 누락으로 해석하지 않았고 전체 이벤트·Credential 식별자는 보관하거나 공개하지 않았다.

추가 승인 뒤 15:45 KST에 복원 전용 Policy의 Version 2를 기본값으로 저장했다. 지정 새 DB 문장에서 `rds:DatabaseEngine`·`rds:StorageEncrypted`·`rds:Vpc` 세 조건만 제거했다. 엔진·암호화는 지정 Snapshot, VPC는 지정 Subnet Group으로 범위를 유지하고 MFA·서울·Project·비공개·db.t4g.micro·Single-AZ·20 GiB와 다른 11문장·모든 Action/Resource는 그대로다. 저장 JSON 전체 대조가 일치했고 12문장·여덟 Action·공백 제외 4,720자, V1 보존도 확인했다. Root는 로그아웃했다. 이는 원인 확정이 아니라 제한된 가설 검증이며, 비Root 재요청에서 다시 거부되면 추가 조건 제거·Root 복원으로 우회하지 않는다.

비Root 로그인·MFA 뒤 원본 한 개만 있는 목록과 사용 가능 상태를 확인했다. 새 세션에서 복원 폼이 초기화되어 같은 승인 설정으로 다시 맞춘 다음, 지정 임시 DB 한 개를 재요청했다. 이번에는 복원 중 알림과 원본 사용 가능·임시 DB 생성 중을 확인했다. 임시 DB 구성의 엔진 17.11·db.t4g.micro·Single-AZ·gp3 20 GiB·암호화·같은 Key·자동 증설 비활성·추가 모니터링 비활성도 확인했다. 요청 수락과 SQL 데이터 보존 검증은 나누어 기록하며 세 조건 각각의 원인은 확정하지 않는다.

| 단계 | 상태 |
|---|---|
| IAM 검증·생성·지정 사용자 연결 | 완료 |
| 비Root Snapshot 목록 조회 | 완료 |
| 원본 SQL 기준 결과 | 완료 |
| 지정 Snapshot 생성·비공개/암호화 확인 | 완료·Project 태그와 외부 공유 대상 없음 확인 |
| 지정 임시 RDS 복원·TLS·Row 대조 | 완료·Available/Private/암호화·verify-full/TLS 1.3·일곱 Table 건수/Hash 일치 |
| 복원 DB용 App 명세 | :2 등록·JDBC Host만 변경, 같은 Image/여섯 Secret 참조/나머지 설정 확인. 원본 App 종료 뒤 한 개 실행 |
| 단일 App 순차 전환·재로그인·원본 복귀 | 완료·두 전환에서 기존 Session 거부, AGENT 재로그인 뒤 Ticket 1/2·OPEN·PENDING Job 확인 |
| 임시 DB 정리 | 중지 후 별도 최종 승인으로 삭제 완료. 추가 최종 Snapshot·자동 Backup 보존 없음. 원본 DB·검증 Snapshot 유지 |

## 복원 DB의 실제 결과

임시 DB의 생성 시각은 15:54 KST이며 이후 사용 가능을 확인했다. 엔진 17.11·db.t4g.micro·Single-AZ·gp3 20 GiB·같은 aws/rds 암호화·자동 증설 비활성·표준 모니터링·향상된 모니터링 비활성, 기존 VPC/Private DB Subnet Group/RDS 전용 Group과 Project 태그를 확인했다. 기본 PostgreSQL 17 Group을 사용하며 Storage 초기화 안내는 별도로 남아 있었다.

기존 Private CloudShell과 접속 Helper를 사용했다. 공개 CA Hash 검증 후 작성자가 App 암호를 직접 입력했고 `helpdesk_app`으로 `helpdesk`에 verify-full·TLS 1.3 접속했다. 원본과 동일한 SQL을 Read-only·Repeatable Read로 실행하고 정상 종료했다.

| 비교 항목 | 복원 결과 |
|---|---|
| 일곱 Table의 건수·내용 SHA-256 | 원본과 모두 일치 |
| Ticket·Message·Job | 각각 2건 |
| 본문·작성자 존재 | 각각 2건 |
| Job 상태·실행 Attempt·생성/보완 예약 | PENDING 2건, 모두 0 |
| Attempt·Suggestion·Category | 각각 0건 |
| 다섯 참조 누락·Flyway V1~V7·세 Sequence | 원본과 일치 |

비교 근거는 Lab의 Git 제외 `local/deployment/rds-recovery-restored-baseline-20261016.json`에 보관했다. 원문·작성자·Secret 값을 공개하지 않았다. 원래 비어 있던 제안 Table은 빈 상태 보존을 확인한 것이며, 새 Suggestion 생성이나 외부 AI 호출을 실시하지 않았다.

순차 App 검증용으로 `helpdesk-learning:2`를 등록했다. :1의 실제 JSON에서 JDBC Host만 복원 Endpoint로 바꿨으며 등록된 JSON 전체가 준비본과 일치했다. Image Digest·여섯 Parameter 참조·Execution Role·256 CPU/512 MiB·Profile·AI/Worker 비활성과 나머지 설정은 같다. 실제 전환 직전에도 등록된 JSON을 다시 대조했다.

## 로그인 기준과 순차 App 전환

전환 전 AGENT 전용 조회에서 Ticket 1의 Job `PENDING`을 확인했다. 로그인 직후 `/`의 404는 미구현 루트 화면의 응답이며, 보호된 조회 성공으로 인증 상태를 따로 확인했다.

그보다 앞서 `/login`의 403도 관찰했다. 새 로그인 폼의 Method·Action·CSRF 필드 존재와 단일 App/Target을 확인하고, 존재하지 않는 진단용 계정으로 한 번 시도했을 때에는 `/login?error`의 자격 증명 오류로 처리됐다. 이후 작성자가 실제 AGENT로 로그인해 보호된 조회에 성공했다. 이전 403의 정확한 원인은 확정하지 않았으며, 진단용 계정의 실패를 실제 AGENT의 암호 오류로 기록하지 않는다. 보안 설정·DB 계정·Secret은 변경하지 않았다.

원본 Target의 등록을 해제한 뒤 기존 300초 Deregistration Delay를 유지했다. 등록 대상과 Draining이 모두 0개인 것을 확인하고 원본 Task를 중지했다. 17:47 KST에 STOPPED를 확인한 다음 `helpdesk-learning:2`로 복원 App 한 개만 실행했다. 기존 Public-a Subnet·App 전용 Security Group·Fargate 1.4.0·256 CPU/512 MiB·Project 태그를 사용했고, ECS Exec과 추가 모니터링은 켜지 않았다. 새 Private IP의 8080만 기존 Target Group에 등록했다.

새 Task의 RUNNING과 지정 Image Digest를 확인했다. Spring은 `postgres,deployment` Profile로 기동했고 실제 복원 Endpoint의 `verify-full` 연결과 Flyway V1~V7 검증·추가 Migration 없음이 Log에 나타났다. 17:49 KST에 Spring 시작 완료, 이후 기존 기준을 유지한 Target Healthy 한 개와 HTTPS Health `UP`을 확인했다.

전환 전 보호된 조회가 성공했던 같은 Browser에서 로그아웃·Cookie 삭제·재로그인 없이 다시 조회했을 때 ‘로그인이 필요합니다’가 표시됐다. 전환 전 유효했던 로그인 상태가 새 App으로 이어지지 않는 전후 비교를 확보했다. 이어서 새 로그인 폼에서 작성자가 AGENT로 직접 재로그인했다. Ticket 1·2의 Job은 모두 `PENDING`·실패 코드 없음이었고, Ticket 조회 화면에서도 각각 `배포 학습 문의`·`CSRF 누락 검증`과 `OPEN`을 확인했다.

복원 Endpoint로 연결한 App과 실제 Browser의 조회 결과를 함께 확인한 뒤 복원 App Target을 등록 해제했다. 기존 300초 Draining과 Target 0개를 확인하고 검증 Task를 종료했다. STOPPED 확인 뒤 18:01 KST에 원본 실행 명세 :1의 App 한 개만 실행했다. 새 Private IP의 8080을 기존 Target Group에 등록했고 같은 Digest·기존 Subnet/Group·ECS Exec 비활성을 확인했다. 새 Image나 명세를 만들거나 원본 DB·Secret·DNS를 수정하지 않았다.

원본 Endpoint의 `verify-full` 연결과 Flyway V1~V7·추가 Migration 없음, 18:02 KST의 Spring 시작 완료를 확인했다. 원본 복귀 Task는 RUNNING이며 18:05 KST에 단일 Target Healthy를 확인했다. 검증 App에서 로그인했던 같은 Browser로 재로그인 없이 Ticket을 조회했을 때 다시 ‘로그인이 필요합니다’가 나왔다. 원본 DB용 새 JVM으로 돌아와도 종료한 검증 JVM의 Session이 이어지지 않는 결과다. 작성자가 AGENT로 직접 재로그인한 뒤 Ticket 1·2의 기존 제목·OPEN과 두 Job의 PENDING·실패 코드 없음을 다시 조회했다. 원본 복귀 검증까지 완료했다.

| 순서 | 실행 명세·DB | Browser 확인 |
|---|---|---|
| 전환 전 원본 App | :1·원본 RDS | AGENT 전용 조회 성공으로 기존 Session 유효성 확인 |
| 검증 App | :2·복원 RDS | 기존 Session 거부, AGENT 재로그인 뒤 Ticket 1/2·OPEN·PENDING Job 확인 |
| 원본 복귀 App | :1·원본 RDS | 기동·Target Healthy·기존 Session 거부, AGENT 재로그인 뒤 Ticket 1/2·OPEN·PENDING Job 확인 |

## 임시 DB의 중지와 이후 승인한 삭제

정리 전 전체 수동 Snapshot 목록에는 0개가 표시됐지만, 원본 DB의 백업 표와 지정 Snapshot 상세에서 검증 Snapshot의 수동·사용 가능·기존 Key 보존을 재확인했다. 전체 목록만으로 삭제됐다고 판단하지 않았으며 표시 차이의 원인은 확정하지 않았다. 이 확인을 위해 IAM 권한을 추가하거나 Snapshot을 다시 만들지 않았다.

임시 DB 한 개의 삭제 확인창을 준비했지만, 최종 질문에서 작성자는 ‘삭제하지 않고 임시 DB만 중지’를 선택했다. 삭제창을 취소했고 삭제 요청은 보내지 않았다. 기존 검증 Snapshot을 유지하며 추가 Snapshot 없이 지정 임시 DB만 중지 요청했다. Console에서 중지 중을 거쳐 18:22 KST에 ‘일시적으로 중지됨’·연결 0개를 확인했다. 중지 뒤에도 원본 App의 Ticket 2 Job 조회가 PENDING으로 성공했고 기존 단일 Target은 Healthy였다. 원본 App·RDS·ALB·DNS·Secret과 원본의 7일 자동 Backup은 유지한다.

중지 확인창에는 10/23 18:12 KST 자동 재시작 예정과 Storage·Backup 비용이 남는다는 안내가 있었다. 중지는 장기 무료 보관이 아니다. AWS는 DB Instance를 연속 최대 7일 중지하며 이후 자동으로 시작한다. 중지 중에도 할당 Storage와 Backup 비용은 남는다. [AWS RDS 중지 안내](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html)

이후 작성자가 임시 DB의 용도와 보관 비용을 확인하고 삭제로 선택을 변경했다. 삭제 직전 화면에서 대상 `helpdesk-learning-restore-20261016`, 최종 Snapshot 미생성·자동 Backup 미보존을 제시했고, 해당 설정의 최종 승인을 받은 뒤 한 번만 삭제 요청했다. 비Root 사용자로 삭제 중을 확인하고 목록을 새로 고쳐 임시 DB가 사라지고 원본 `helpdesk-learning` 한 개만 사용 가능 상태로 남은 것을 확인했다. 지정 검증 Snapshot의 상세를 다시 열어 manual·사용 가능 상태도 확인했다. 원본 DB·Snapshot·App·DNS·Secret·IAM은 변경하지 않았다.

자동 Backup 미보존은 삭제 요청의 선택값으로 확인했다. 별도 보존 Backup 목록을 통한 재대조는 하지 않았으며, 미보존 시 같은 Region의 해당 자동 Backup을 삭제하는 AWS 동작과 구분해 기록한다. 검증 Snapshot은 기존 수동 Snapshot으로 유지한다. 삭제한 임시 Instance와 그 자동 Backup은 원상 복구 대상으로 남기지 않았지만, 보존한 검증 Snapshot으로 별도 Instance를 다시 복원할 수 있다. [RDS 삭제와 Backup 보존](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_DeleteInstance.html)

삭제 후 기존 Browser의 보호된 조회에서는 ‘로그인이 필요합니다’가 나왔다. 이때 업무 Row 재조회는 완료하지 못했으며 임시 DB 삭제가 Session 거부의 원인이라고 단정하지 않는다. 기존 원본 Task는 같은 명세·Digest로 유지했다. 이후 Task 교체 실험의 인증 기준은 AGENT 재로그인으로 새로 확보해야 한다.

## 검증 범위와 비용

다음 Image Rollback의 사전 검토로 10/10·10/13 ECR 업로드 보고서와 두 고정 Source Commit을 비교했다. 10/10의 `77ce72c`에는 현재 Dockerfile이 제공하는 `/app/certs/rds-ca-bundle.pem`과 `DeploymentSecurityConfiguration`이 없다. 따라서 지금 명세의 Image만 그 Digest로 바꾸는 것은 정상 복귀 대상이라고 가정할 수 없다. 이 비교는 Source의 정적 검토이며 실제 Rollback 실행은 아니다. 현재 Cloud에서 기동·인증·업무 조회를 확인한 `2e2cc40` Image를 복귀 기준으로 보존하고, 호환되는 후속 후보를 검증하는 순서가 필요하다. 새 Image 업로드·Task 변경은 아직 하지 않았다.

정책 Test 38개와 SQL Source 보호 Test 3개, 총 41개가 통과했다. V2 변경 뒤에도 JavaScript 전체 246개를 재실행해 실패·건너뜀 0개를 확인했고 ESLint 10.11.0도 통과했다. Java 회귀는 이번 단계에서 재실행하지 않았다. 원본 SQL의 실제 실행과 로컬 구조 검증을 구분하며, Snapshot·복원 성공은 해당 AWS 결과로 별도 확인한다.

기존 원본 RDS·App·ALB 실행과 보관 비용은 유지된다. App은 원본 → 복원 → 원본 순서로 이전 Task 종료 뒤 한 개씩만 실행했다. 임시 DB는 중지 뒤 최종 승인으로 삭제했으므로 해당 Instance의 7일 뒤 자동 재시작 대상도 남지 않는다. 원본 DB·검증 Snapshot·Image·Log 등 보존한 대상의 비용은 별개다. 이번 복원 실험이 끝나도 이전 Image Rollback·전체 AI 배포·남은 Week 8 범위가 완료된 것은 아니며 전체 비용을 0원으로 기록하지 않는다.
