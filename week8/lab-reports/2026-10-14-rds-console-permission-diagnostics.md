# RDS Console 권한과 DB 생성·TLS 접속 검증

> 실행일: 2026-10-14
> 상태: Runtime Version 4와 DB 생성 조건 유지. 비Root RDS 생성·Project 태그, Private TLS·관리자/App 계정 접속·권한 검증 완료. 이후 ECS 기동·Migration·HTTPS 결과는 별도 보고서로 연결.

일반 PostgreSQL을 선택하면 RDS 생성 화면의 연결 설정부터 리소스 로드 오류가 발생했다. DB 생성 요청의 `403`과 화면을 구성하는 목록 조회의 거부를 구분하기 위해 CloudTrail 이벤트를 확인했다.

## DB 생성 거부에서 확인한 내용

앞 회차의 `CreateDBInstance` 이벤트는 한국 시각 10월 14일 01:26:00에 기록됐다. 호출자는 `helpdesk-deployer`, Region은 서울, MFA 인증은 `true`였다. 결과는 `AccessDenied`이며 적용되는 신원 정책의 Allow가 없다는 메시지였다.

이 이벤트의 `requestParameters`와 `responseElements`는 모두 `null`이었다. 이는 기록에서 실제 생성 요청의 필드를 확인할 수 없다는 뜻이다. Project 태그가 없었다거나 암호화가 꺼졌다고 단정할 수 없다. MFA·Region이 맞더라도 Resource와 나머지 Condition이 모두 충족됐다는 뜻은 아니다. [AWS 조건 평가](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-logic-multiple-context-keys-or-values.html)

## 추가로 확인한 조회 거부

RDS 화면을 열던 시점의 관련 이벤트에서 다음 거부를 확인했다. 시각은 한국 시간이다.

| Action | 시각 | 결과 |
|---|---|---|
| `rds:DescribeDBClusters` | 10/14 13:13:02 | `AccessDenied`, 신원 정책의 Allow 없음 |
| `ds:DescribeDirectories` | 10/14 13:13:06 | `AccessDenied`, 신원 정책의 Allow 없음 |
| `kms:ListAliases` | 10/14 13:13:06 | `AccessDenied`, 신원 정책의 Allow 없음 |

조회 권한이 없는 것은 확인했지만, 이 세 거부가 이전 `CreateDBInstance` 거부의 원인이라는 뜻은 아니다. 생성 화면의 조회를 복구한 뒤 DB 생성 설정을 다시 대조한다. 전체 이벤트·HAR·Credential은 공개 기록에 포함하지 않았다.

## 세 조회만 추가한 결정

현 정책을 유지하는 안, 서비스 전체 조회 권한을 추가하는 안, 확인된 세 조회만 추가하는 안을 비교했다. 마지막 안의 적용을 승인받아 기존 `helpdesk-deployer-runtime`을 갱신했다. 새 정책을 연결하거나 Root로 DB를 생성하지 않았다.

세 조회는 기존 메타데이터 문장의 `Resource: "*"`에 추가했다. Foundation의 직접 호출 MFA·서울 제한을 유지한다. 서울의 다른 프로젝트 클러스터·디렉터리·키 별칭 메타데이터도 조회 가능해지지만, Secret 값 조회·KMS 복호화·디렉터리 변경 권한은 추가하지 않는다. 디렉터리 목록 조회를 허용한 것은 Helpdesk에 Directory 인증을 도입한 것이 아니다. [RDS 권한 정의](https://docs.aws.amazon.com/service-authorization/latest/reference/list_rds.html), [Directory Service 권한 정의](https://docs.aws.amazon.com/service-authorization/latest/reference/list_ds.html), [KMS 별칭 조회 권한](https://docs.aws.amazon.com/kms/latest/developerguide/alias-access.html)

PostgreSQL·`db.t4g.micro`·Single-AZ·20 GiB·Storage 암호화·Public Access 비활성·Project 태그와 지정 Subnet Group 사용 조건은 그대로다. Foundation·Edge·Bootstrap과 기존 Role은 수정하지 않았다.

## 정책 대조와 검증

변경 전 AWS에 저장된 전체 JSON은 로컬 Version 3 명세와 일치했다. 세 Action 추가 외에는 문장 식별자 `Sid` 여섯 개만 줄였다. Action·Resource·Condition을 구조적으로 비교해 다른 권한 변경이 없는지 확인했다.

실제 계정 번호를 반영한 정책 크기는 공백 제외 6,143자에서 6,130자로 줄었고, 문장은 15개다. Managed Policy의 한도는 6,144자이며 공백은 계산에서 제외된다. [AWS IAM 정책 크기 제한](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html)

로컬 정책 구조 Test 34개, JavaScript 전체 Test 207개와 ESLint가 통과했다. AWS 편집기의 보안·오류·경고·추천도 모두 0이었다.

14:53에 기본 Version 4로 저장했다. 저장 후 전체 JSON의 내용을 수정안과 다시 대조했고, 기본 Version 4와 이전 Version 1~3의 보존을 확인했다. 연결된 엔터티는 `helpdesk-deployer` 한 명이었다. 정책 저장 후 Root에서 로그아웃했다.

변경 파일은 Lab의 `deploy/iam/deployer-runtime-policy.template.json`, `src/test/js/iam-deployer-policy.test.mjs`, `deploy/iam/README.md`다. 운영 Java·JAR·Image는 바꾸지 않았으며, 이번 권한 변경에서 Java 회귀·외부 AI 호출·DB 생성·App·ALB 실행은 하지 않았다.

## 조회 권한과 DB 생성 조건을 함께 점검

Version 4 적용 뒤 16:21:21의 이벤트에서 네 RDS 조회 거부를 추가로 확인했다. `DescribeCertificates`, `DescribeDBSecurityGroups`, `DescribeDBClusterParameterGroups`, `DescribeServerlessV2PlatformVersions`이며 모두 `AccessDenied`였다. 앞서 허용한 클러스터·디렉터리·키 별칭 조회에는 같은 화면 조회 시점의 오류 코드가 없었다.

기존 Foundation·Runtime·Edge의 전체 JSON은 적용 명세와 일치했다. Bootstrap에는 RDS 생성 권한이 없었고 지정 사용자에게 별도 권한 경계도 없었다. Subnet Group의 학습 VPC·Private Subnet 두 개·Project 태그를 재확인했다. 서울의 DB Instance·Cluster는 모두 0개였으며, `AWSServiceRoleForRDS`는 목록에 없었다. 첫 RDS 생성에 필요한 이 Role의 생성 권한은 기존 Foundation에 한정되어 있다. Role이 아직 없다는 사실만으로 생성 거부의 원인이라고 판단하지 않았다.

DB 생성은 이름·PostgreSQL·`db.t4g.micro`·Single-AZ·20 GiB·암호화·비공개·Project 태그와 지정 Group 조건을 모두 대조해야 한다. DB Resource의 허용뿐 아니라 참조하는 Subnet·Parameter·Option Group의 허용도 함께 확인한다. 기존 생성 조건은 수정하지 않았다.

## RDS Console 조회를 작은 보조 정책으로 분리

Runtime을 다시 확장하는 안, 서비스 전체 조회를 허용하는 안, 작은 보조 정책으로 분리하는 안을 비교했다. Runtime의 크기는 이미 6,130자여서, 기존 네 정책을 유지하고 보조 정책 한 개를 추가하는 안을 승인받았다.

네 조회를 넣은 초안에서는 AWS 편집기가 `rds:DescribeServerlessV2PlatformVersions`를 `Invalid Action`으로 표시했다. 공식 서비스 참조의 `Operations`에는 이 API가 있지만 `Actions`에는 같은 이름이 없었고, 별도 IAM 권한 매핑은 확인되지 않았다. 이 API는 Aurora Serverless v2용 조회다. 이번 일반 PostgreSQL 구성에서는 이를 제외해 승인 범위를 세 조회로 좁혔으며, 다른 권한이나 와일드카드로 대체하지 않았다. [RDS 서비스 참조](https://servicereference.us-east-1.amazonaws.com/v1/rds/rds.json), [Aurora Serverless v2 조회 API](https://docs.aws.amazon.com/AmazonRDS/latest/APIReference/API_DescribeServerlessV2PlatformVersions.html)

`helpdesk-deployer-rds-console-read`에는 인증서·DB Security Group·Cluster Parameter Group 조회 세 개만 넣었다. 허용 조건은 MFA `true`·서울 Region이며, `Resource: "*"`이므로 서울의 다른 프로젝트 관련 메타데이터도 조회할 수 있다. Secret 값 조회·DB Row 조회·리소스 변경은 추가하지 않았다. 보조 정책의 조건과 기존 Foundation의 거부 규칙을 함께 유지한다.

18:40에 Version 1을 생성했다. 저장된 전체 JSON은 세 조회 Template과 일치했고 공백 제외 326자였다. AWS 편집기의 보안·오류·경고·추천은 모두 0이었다. 지정 사용자 한 명에게 연결한 뒤 기존 네 정책과 새 조회 정책, 총 다섯 개의 직접 연결을 확인했다. 새 집중 정책 구조 Test는 23개 통과했다. 적용 뒤 Root를 로그아웃하고 배포 사용자 로그인 화면을 준비했다. 이 단계에서 DB 생성·App·ALB 실행은 하지 않았다.

영향 파일은 Lab의 `deploy/iam/deployer-rds-console-read-policy.template.json`, `src/test/js/iam-deployer-policy.test.mjs`, `deploy/iam/README.md`와 이 보고서·학습 노트·배포/주간 계획이다. 후속 검토는 일반 PostgreSQL 화면의 실제 동작이며, 제외한 Serverless 조회의 거부가 해당 흐름을 막는지도 확인한다.

## 비Root PostgreSQL 생성 화면 확인

`helpdesk-deployer` 로그인 뒤 새 RDS 화면에서 신원을 확인했다. 일반 PostgreSQL로 전환한 후 이전에 로드하지 못하던 연결·태그·추가 구성 영역이 표시됐다. 제외한 Aurora Serverless 조회를 허용하지 않고도 이 구성 화면을 진행할 수 있었다. 비용 위젯의 조회 실패까지 해결한 것은 아니며 비용 조회 권한은 추가하지 않았다.

Console 기본값은 큰 인스턴스·큰 Storage·추가 모니터링을 선택할 수 있어, 엔진·Template·배포 옵션 변경을 마친 뒤 최종 설정을 다시 대조했다. 일부 변경 뒤 Storage 값이 다시 200 GiB로 바뀐 것을 확인해 20 GiB로 다시 맞췄다. 이전 단계에서 값을 입력했다는 사실보다 생성 직전의 값이 중요하다.

| 항목 | 생성 전 확인한 설정 |
|---|---|
| Instance·엔진 | `helpdesk-learning`, 일반 PostgreSQL `17.11-R1` |
| 사양·가용성 | `db.t4g.micro`, Single-AZ Instance 1개 |
| Storage | gp3 20 GiB, 자동 증설 비활성 |
| Network | 학습 VPC·Private Subnet Group, IPv4, Public Access 비활성 |
| Security Group | `helpdesk-learning-rds` 한 개. 기본 Group은 제외 |
| 태그 | `Project=helpdesk-learning` |
| 암호화·Group | 기본 `aws/rds` 키의 Storage 암호화 활성, `default.postgres17`, `default:postgres-17` |
| Credential | 자체 관리·암호 인증. 암호 자동 생성·Secrets Manager 관리 비활성 |
| 추가 비용 기능 | RDS Proxy·Enhanced Monitoring·세부 DB/쿼리 지표 수집·교차 Region 백업 복제 비활성 |
| 백업 | 자동 백업 활성·기본 7일 보존, Snapshot 태그 복사 활성 |
| 초기 DB | `helpdesk` |

초기 DB는 App에서 사용할 이름을 명확히 하기 위해 `helpdesk`로 준비했다. 관리자가 사용하는 DB와 App용 계정·권한을 준비하는 작업은 분리한다. 자동 백업은 기존 7일 기본값을 유지해 복구 학습을 이어가며, Backup 사용량과 요금은 실제 보관량으로 확인한다.

생성 Resource와 기존 Runtime의 `CreatePrivateDb`·`UseTaggedSubnet`·`UseDefaultGroups` 조건을 대조했다. 실제 외부 요청의 IAM 결과는 생성 응답으로 확인한다. 새 마스터 암호의 입력·확인·생성 제출은 작성자에게 인계했으며, 암호 값·전체 요청 Body·HAR는 읽거나 기록하지 않았다.

## 생성 요청 성공과 별도 조회 거부

작성자가 새 마스터 암호를 직접 입력하고 생성 요청을 제출했다. Console의 생성 중 알림과 Instance 목록에서 `helpdesk-learning` 한 개·PostgreSQL·`db.t4g.micro`·`ap-northeast-2a`·Multi-AZ `아니요`를 확인했다. 기존 DB 생성 조건을 완화하거나 Root로 생성하지 않았다.

같은 목록에는 `rds:DescribeGlobalClusters`의 Allow 부재가 표시됐다. 글로벌 클러스터 목록 조회의 거부이며, 지정 PostgreSQL Instance의 생성 요청 성공과 동시에 나타날 수 있다. 이번에는 그 조회 권한을 추가하지 않고 Instance 상세로 이동했다. 생성 요청 성공·생성 중 상태·준비 완료·실제 접속은 각각 구분한다.

## 사용 가능 상태와 저장된 구성 확인

생성 시간은 19:10이며, 이어 Instance의 `사용 가능` 상태를 확인했다. 저장된 구성은 PostgreSQL 17.11·DB 이름 `helpdesk`·`db.t4g.micro`·Single-AZ·gp3 20 GiB·암호화 활성·자동 증설 비활성이었다. 기본 Parameter/Option Group, Database Insights 표준·DB/쿼리 상세 지표 및 Enhanced Monitoring 비활성도 확인했다. 생성 도중 `Configuring-enhanced-monitoring` 상태가 잠시 나타났지만, 그 상태 이름만으로 해당 기능이 활성화됐다고 판단하지 않고 저장 설정을 확인했다.

연결 정보에는 학습 VPC·기존 Private Subnet 두 개·`helpdesk-learning-rds`·Public Access `아니요`·포트 5432·RDS CA가 표시됐다. 자동 백업은 7일이며 Snapshot 태그 복사가 활성화되어 있고 다른 Region 복제는 없었다. 최근 복원 시각의 표시는 실제 Snapshot 복원 Test를 수행했다는 근거가 아니다.

태그 탭은 0개로 표시됐으나 Browser 진단에서는 지정 DB의 `rds:ListTagsForResource` 거부를 확인했다. 당시 Runtime의 태그 조회는 Subnet Group 한 개만 허용했다. 이 화면만으로 실제 DB에 태그가 없다고 확정할 수 없어 지정 DB 한 개의 조회 권한 추가안을 제시했다. 적용과 실제 Project 태그 재조회는 다음 항목에서 확인했다.

## 지정 DB의 태그 조회 추가와 확인

지정 DB의 태그 조회 한 가지만 추가하는 범위를 승인받았다. 보조 정책에 `rds:ListTagsForResource`를 서울의 `db:helpdesk-learning` ARN 한 개로 제한한 별도 문장을 추가했고 MFA `true`·서울 조건을 유지했다. 기존 세 메타데이터 조회·Runtime Version 4·다른 정책과 DB 생성 조건은 바꾸지 않았다.

현 상태 유지·전체 RDS 태그 조회·지정 DB만 조회하는 안 중 마지막 안을 선택했다. 생성된 DB의 Project 태그를 확인하는 데 필요한 최소 범위이며, 글로벌 클러스터·Snapshot·다른 DB·Secret 조회와 변경 권한은 추가하지 않았다. 영향 파일은 Lab의 보조 정책 Template·구조 Test·IAM 안내와 이 보고서다.

19:54에 기본 Version 2로 저장했고 Version 1을 보존했다. 저장된 전체 JSON은 수정안과 일치하며 공백 제외 598자·두 문장이다. AWS 편집기의 보안·오류·경고·추천은 모두 0, 관련 로컬 정책 구조 Test는 36개 통과했다. 정책 연결 대상은 기존 배포 사용자 한 명이다.

Root를 로그아웃하고 `helpdesk-deployer`로 MFA 로그인한 뒤 태그 한 개 `Project=helpdesk-learning`을 확인했다. 이전의 0개 표시는 조회 권한 거부 상태에서 나타난 값이었다. 태그를 다시 등록하거나 DB를 재생성하지 않았다.

## Private TLS와 두 DB 계정의 접속

기존 `helpdesk-db-bootstrap` VPC 환경을 다시 사용했고 `psql 16.15`를 확인했다. 인터넷 기본 경로·NAT·유료 Endpoint·새 EC2·AWS Credential 전달을 추가하지 않았다. 공개 서울 RDS CA만 새 임시 디렉터리에 붙여 넣고 저장소 Manifest의 SHA-256과 일치하는지 확인했다. 첫 파일 전달은 `mktemp` 명령의 자리표시자를 실제 결과 경로로 잘못 읽어 실패했다. 생성 결과의 실제 경로를 대조한 뒤 다시 전달했으며, Hash 확인 전에는 접속하지 않았다.

`openssl s_client`의 PostgreSQL Handshake에서 `TLSv1.3`·`TLS_AES_256_GCM_SHA384`·인증서 검증 `OK`·RDS Endpoint의 Hostname 일치를 확인했다. 그 뒤 `sslmode=verify-full`·같은 CA를 지정한 psql로 관리자 인증에 성공했다. 새 Password의 입력·확인·제출과 기존 Password 인증은 작성자가 직접 수행했다. Password·Hash·전체 환경 변수는 읽거나 기록하지 않았다.

현재 SQL의 `SHOW rds.force_ssl`은 `unrecognized configuration parameter`를 반환했다. 기본 Parameter Group 화면의 값도 확인하지 못했으므로 이 명령이나 0개 목록을 실제 설정값의 근거로 사용하지 않는다. 대신 Password를 전달하지 않는 별도 비TLS 접속을 시도했고 서버의 `no pg_hba.conf ... no encryption` 거부를 확인했다. 기존 App 접속과 JDBC 초안의 `verify-full`은 유지했다. 잘못된 Hostname을 지정한 별도 TLS 검사도 `hostname mismatch`·인증서 검증 실패로 거부됐다. 서버의 비TLS 거부와 Client의 이름·인증서 검증은 서로 다른 검사다. [AWS PostgreSQL TLS 안내](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html)

## App 계정과 Schema 권한 준비

대상 DB가 `helpdesk`이고 현재 연결이 TLS라는 것을 조회했다. `public`의 Table은 0개였고 `helpdesk_app` 계정은 없었다. 기존 Parameter의 사용자명이 이 계정과 일치한다는 확인과 권한 준비 승인을 받은 뒤 계정 생성·PUBLIC Schema 권한 제거·DB `CONNECT`·Schema `USAGE/CREATE` 부여를 한 Transaction으로 Commit했다. Superuser·DB/Role 생성·Replication·RLS 우회와 관리 Role 멤버십은 주지 않았다.

Schema나 Migration 신원을 새로 분리하는 안과 기존 `public`·같은 App DataSource로 Flyway를 실행하는 안을 비교해 후자를 유지했다. 기존 JDBC SQL과 Migration은 Schema 이름을 지정하지 않으며 로컬 계정 구성도 `public`을 사용한다. 현재 JAR·Image·JDBC 설정을 바꾸지 않고 필요한 권한을 준비하는 선택이다. 운영 환경의 DDL·DML 신원 분리는 후속 검토로 남긴다. 영향 파일은 Lab의 DB Bootstrap 안내와 이 보고서·학습 노트·주간/배포 계획이다.

`\password`로 App 암호를 직접 설정하고 관리자 접속을 종료했다. App 암호는 AWS Console 로그인·RDS 마스터 암호와 다른 용도이며, 기존 `/helpdesk/learning/db/password`에 등록한 값으로 맞췄다. 첫 입력의 불일치는 새 암호와 확인 암호가 서로 달랐다는 뜻이었고, 기존 신원 인증 실패로 해석하지 않았다. Parameter 값을 읽어 비교하지 않았다.

App 계정의 실제 `verify-full` 로그인도 통과했다. 현재 신원·TLS 사용·LOGIN·DB 접속·Schema 사용/생성은 `true`, Superuser·DB/Role 생성·Replication·RLS 우회·Role 멤버십은 모두 `false`였다. 같은 Transaction에서 새 임시 Table·Identity INSERT 1건·조회 1건을 확인한 뒤 Rollback했으며, `to_regclass(...) IS NULL`은 `true`였다. 임시 Table·Row는 남지 않았고 고객 데이터는 사용하지 않았다. 이 실험은 App DB 권한 점검이며 ECS에서 Helpdesk를 실행하거나 Flyway Migration·Ticket 저장을 검증한 결과가 아니다.

## 후속 확인

1. 지정 DB 태그 조회·TLS·관리자/App 계정과 권한 점검은 완료했다. 생성 요청은 다시 보내지 않는다.
2. 이후 같은 Image의 ECS Task에서 DB 인증 실패를 지정 Parameter 수정으로 해결했고 JDBC·Migration 7개·Spring 기동을 확인했다. [ECS 기동 보고서](./2026-10-14-ecs-first-cloud-startup.md)에서 실행 결과를 따로 기록한다.
3. 연장 실습의 ACM·DNS·ALB와 HTTPS 기본 응답은 [실제 10월 15일 보고서](./2026-10-15-cloud-https-baseline.md)에 있다. 실제 로그인·접수/조회·업무 Row 대조는 15일 재개 과업이다. 관리 통로의 정리 여부와 대상은 별도 확인한다.

권한 수정이 저장됐다는 결과와 실제 DB 생성·연결 성공은 별도의 확인 단계다.
