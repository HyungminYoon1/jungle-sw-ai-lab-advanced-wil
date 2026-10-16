# 2026-10-14 RDS 연결과 ECS HTTPS 배포

> 학습 회차: 10월 14일. 자정 이후 이어진 실습도 이 회차에 포함하며, 실제 실행일은 각 보고서에 기록했다. 남은 학습은 10월 15일에 재개한다.

오늘은 RDS Console의 권한 오류를 정리하고, 비Root로 학습 DB를 생성한 뒤 TLS 접속과 App용 DB 계정을 준비했다. Password·MFA 입력은 내가 직접 진행했고, 정책 대조와 SQL 권한 점검은 Codex와 함께 진행했다.

이어서 같은 검증 Image로 ECS Task를 실행했다. Image Pull과 JVM 시작·Log 전송은 성공했지만, 첫 Spring 기동은 App DB Password 인증에서 실패했다. psql에 사용한 App 암호로 Parameter 한 개를 직접 맞췄다. 같은 Image의 새 Task에서 JDBC 연결·Migration 7개 적용·Spring 기동이 성공했고, Task 중지와 남은 실행 0개까지 확인했다.

이어서 ACM 인증서를 발급받고 Cloudflare의 DNS 검증용 CNAME과 서비스 CNAME을 구분해 연결했다. 권한·DNS·ALB 설정은 Codex가 승인한 범위에서 진행했고, 로그인·MFA와 비밀번호 입력은 내가 직접 했다. 같은 Image의 App Task를 ALB에 연결한 뒤 HTTPS Health와 로그인 화면, 익명 API의 거부 결과를 확인했다.

현재 위치는 **Helpdesk를 Private RDS와 연결하고 ALB를 통해 HTTPS 기본 응답을 확인한 단계**다. 실제 로그인 이후의 Session·Role·CSRF, 문의 접수와 DB Row 대조는 다음 학습에서 확인한다.

## 전체 과정에서 지금 위치

| 대상 | 확인한 내용 | 이어서 확인할 것 |
|---|---|---|
| 프로그램 파일 | 검증 Image의 ECR 업로드와 실제 Task Digest 일치 | 다음 배포에서도 같은 검증 Image인지 대조 |
| 실행 환경 | Cluster·명세 등록, Parameter 전달·Image Pull·Log 전송·Spring 기동, 새 Task와 Target Healthy | 업무 요청·전체 AI 구성과 자원 |
| DB | Private RDS 생성·Project 태그와 실제 Migration 7개 적용 | API로 업무 Row 저장·조회 |
| DB 접속 | psql TLS와 암호 전달 수정 후 Java JDBC 연결 | HTTPS 요청에서 사용하는 DB 흐름 |
| 데이터 작업 | 임시 Table 생성·INSERT·조회·Rollback | API 접수 후 Ticket·Message·Job Commit |
| 사용자 접속 | ACM·두 CNAME·ALB 연결, HTTPS Health 200/UP·로그인 페이지 200·익명 API 401 | 실제 로그인·Session·Role·CSRF와 문의 접수 |
| AI 처리와 복구 | 로컬 학습 근거와 Cloud 검증을 구분 | Cloud Worker·AI·관측·재배포·DB 복원 |

앞서 Java와 PostgreSQL Test가 통과한 것과 Cloud에서 Helpdesk가 실행되는 것은 다른 결과다. Image는 프로그램 파일이고, RDS는 데이터를 저장할 서버다. Helpdesk의 JVM과 Spring을 실제로 시작해야 둘을 업무 요청으로 연결할 수 있다.

## CloudShell 접속과 Helpdesk 실행은 다르다

오늘 RDS에 접속한 Client는 CloudShell에서 실행한 `psql`이었다. App용 DB 계정으로 접속했더라도 접속 프로그램은 여전히 psql이다. 그 과정에서 Helpdesk의 Controller·Service·Repository가 실행되는 것은 아니다.

ECS에서는 Container 안의 JVM이 Spring을 기동한다. 새 Container에 전달한 DB 설정으로 Java의 DataSource·JDBC 연결을 구성하고, Flyway가 필요한 Migration을 적용하는지 확인한다. 그 뒤 실제 API의 접수·조회와 DB Row를 대조한다.

전체 관계는 [프로그램과 DB를 연결하는 학습자료](../study-docs/cloud-database-and-application-connection.md)에 정리했다.

## Allow가 있어도 요청이 거부될 수 있다

`no identity-based policy allows`는 현재 요청에 적용되는 Allow를 찾지 못했다는 뜻이다. 정책에 Action 자체가 없을 수도 있고, Action이 있어도 Resource나 Condition이 맞지 않을 수 있다.

처음 거부된 DB 생성 이벤트에서는 서울 Region과 MFA 인증을 확인했다. 이 두 조건이 맞는다고 DB 이름·사양·태그·암호화·Public Access 조건까지 통과한 것은 아니다. 이후 생성 요청과 저장 설정을 각각 확인했지만, 앞선 거부의 구체적인 불일치 조건을 그 기록만으로 확정하지 않는다.

## 기록의 null과 요청의 누락은 다르다

CloudTrail의 `requestParameters: null`은 그 기록에서 요청 필드를 읽을 수 없다는 뜻이다. 이 값만 보고 실제 요청에 Project 태그가 없었다고 판단하면 안 된다. 기록에서 확인하지 못한 것과 서버에 보내지 않은 것은 서로 다른 사실이다.

## 설정 화면도 여러 API를 호출한다

RDS 생성 화면은 DB를 생성하기 전에 클러스터·디렉터리·키 별칭 등의 목록을 조회한다. 이번에는 `rds:DescribeDBClusters`, `ds:DescribeDirectories`, `kms:ListAliases`의 조회 거부를 확인했다.

설정 화면의 목록 조회를 허용하는 것과 DB 생성 조건을 완화하는 것은 다르다. 키 별칭을 볼 수 있어도 암호화된 값을 복호화할 수 있는 것은 아니며, 디렉터리 목록을 조회한다고 Helpdesk가 그 인증 방식을 사용하는 것도 아니다.

## 정책 저장과 실제 동작 확인

Runtime Version 4에는 확인된 세 조회만 추가했다. 크기를 줄이기 위해 `Sid` 여섯 개를 바꿨지만, 기존 Action·Resource·Condition은 유지했다. `Sid`는 문장을 식별하는 이름이며 그 이름 자체가 접근을 허용하는 규칙은 아니다.

정책 구조 Test는 작성한 조건과 금지 권한을 검사한다. AWS에 저장된 전체 정책을 대조하는 것은 그 명세가 반영됐는지 확인하는 단계다. 그 다음에 비Root 요청으로 화면 조회·DB 생성·TLS 접속을 각각 확인해야 한다.

## API 이름과 IAM Action은 따로 확인한다

CloudTrail에 나타난 API 이름을 그대로 IAM Action으로 쓰면 항상 유효하다고 생각하기 쉽다. 이번 `DescribeServerlessV2PlatformVersions`는 공식 API 문서와 서비스 참조의 `Operations`에는 있었지만, 같은 이름의 IAM `Actions`에는 없었고 AWS 편집기도 `Invalid Action`으로 표시했다.

API 문서에서 무엇을 조회하는지 확인하고, 권한 명세와 정책 검증에서 어떤 Action을 지원하는지 별도로 확인해야 한다. Aurora Serverless용 조회를 허용하기 위해 일반 PostgreSQL 실습에 넓은 권한을 추가하지 않았다. 지원되는 세 조회만 작은 보조 정책으로 분리했다.

## 정책 크기와 조건을 유지하는 방법

기존 Runtime은 공백 제외 6,130자로 한도에 가까웠다. 기존 조건을 빼서 크기를 줄이는 대신 Console 조회를 보조 정책으로 분리했다. 이 정책에도 MFA와 서울 조건을 명시했고, DB 생성 조건은 기존 Runtime에 그대로 남겼다.

설정 화면에 많은 오류가 보여도 모든 오류가 DB 생성 실패의 직접 원인은 아니다. 기존 정책·Subnet 태그·서비스 연결 Role과 생성 조건을 함께 확인했고, 이후 비Root의 생성 요청 성공과 저장 설정을 각각 확인했다.

## 생성 직전의 값을 다시 확인한다

Console에서 엔진·Template·배포 옵션을 바꾸면 다른 설정이 기본값으로 다시 바뀔 수 있다. 20 GiB를 입력한 뒤 엔진을 바꾸자 Storage가 200 GiB로 돌아간 것을 확인했다. 이전에 입력했다는 기억이 아니라, 선택을 마친 뒤의 실제 값으로 정책·비용 조건을 확인해야 한다.

비Root 일반 PostgreSQL 화면에서는 연결·태그·암호화 영역을 확인했고, 기존 최소 사양과 비공개 설정을 준비했다. 화면이 표시되는 것, 설정이 맞는 것, 생성 요청이 허용되는 것, DB가 준비되어 TLS로 연결되는 것은 서로 다른 확인 단계다.

## 조회 실패를 데이터 없음으로 해석하지 않는다

DB 생성 요청은 성공했지만 글로벌 클러스터 조회의 거부가 같은 화면에 남았다. 생성 알림만 보거나 오류 개수만 세는 대신 요청별 결과를 구분해야 한다.

태그 탭의 0개 표시도 실제 태그 없음과 동일하지 않았다. 지정 DB 한 개의 조회 권한만 추가한 뒤 실제 `Project=helpdesk-learning` 태그를 확인했다. DB가 `사용 가능`이라고 표시되는 것 역시 Client의 TLS·DB 인증이나 Application 연결을 확인한 것은 아니다.

## TLS 연결과 DB 로그인을 나눈다

TLS Handshake는 접속 대상의 인증서·이름과 암호화된 연결을 검사한다. PostgreSQL의 Password 인증은 그 연결 안에서 어떤 DB 계정으로 접속할 수 있는지 확인한다. 이번에는 공개 CA·RDS Endpoint를 지정해 `verify-full`로 관리자와 App 계정의 접속을 각각 확인했다. 현재 연결의 TLS 사용은 `pg_stat_ssl`에서도 조회했다.

잘못된 Hostname을 지정하자 인증서 검사에서 거부됐다. Password를 제공하지 않는 비TLS 접속도 서버에서 `no encryption`으로 거부됐다. 이 두 실패는 Client의 서버 이름 검증과 Server의 비TLS 접속 거부를 각각 보여준다. SQL에서 `SHOW rds.force_ssl`을 읽을 수 없었다는 것만으로 TLS가 꺼졌다고 생각하지 않는다.

## 인증서 검색과 HTTPS 연결은 다른 단계다

ACM 화면의 검색에는 목록 조회와 다른 `acm:SearchCertificates` 권한이 필요했다. 검색 거부가 남아 있을 때 화면의 0개를 보고 인증서가 없다고 판단하면 안 된다. 필요한 조회 한 개만 추가한 뒤 `helpdesk-deployer`로 다시 검색했고, 그때 권한 거부 없이 0개 결과를 확인했다.

인증서를 검색할 수 있다고 발급이 끝난 것은 아니며, 인증서가 발급되어도 App의 Health나 로그인·업무 요청이 확인되는 것은 아니다. 이번에는 DNS 소유권 검증과 인증서 발급을 먼저 마친 뒤 ALB·App을 실행했다. 인증서를 기다리는 동안 실행 리소스를 켜 두지 않는 순서다.

인증서 검증용 CNAME과 `helpdesk.hmyoon.com`을 ALB로 연결하는 서비스 CNAME도 서로 다른 Record다. 이 두 설정을 구분해서 확인해야 한다.

## DNS 검증과 서비스 접속은 목적이 다르다

검증 CNAME은 ACM이 도메인 소유권을 확인하는 데 사용한다. 서비스 CNAME은 Browser가 `helpdesk.hmyoon.com`으로 접속할 때 ALB 주소를 찾도록 한다. 인증서 발급이 끝나도 서비스 주소가 App으로 연결되는 작업은 따로 필요하다.

이번에는 두 Record를 Cloudflare의 DNS-only로 유지했다. Cloudflare는 주소 조회에 응답하고, HTTPS 요청은 ALB에 도착한다. ALB가 ACM 인증서로 TLS를 처리한 뒤 App의 Private IP:8080으로 요청을 전달한다. App 8080을 인터넷에 직접 공개한 것은 아니다.

## 오류 화면과 실제 리소스 상태를 함께 확인한다

ALB 생성 중 추가 인증서 등록 단계가 거부돼 Wizard에 오류가 남았다. 하지만 ALB와 Listener는 이미 생성됐고, 기본 인증서도 연결되어 있었다. 오류 한 개를 전체 생성 실패로 해석하면 같은 리소스를 다시 만들거나 불필요한 권한을 추가할 수 있다.

이번에는 상세 화면의 ALB·Listener·인증서·Target 상태를 확인하고 실제 HTTPS 응답을 점검했다. 학습 VPC 한 개의 조회 권한만 추가했으며, 추가 인증서·삭제 권한을 넓혀 오류 화면을 없애는 방식은 사용하지 않았다.

## Health와 업무 성공은 따로 확인한다

Target Healthy와 HTTPS Health의 `200 / UP`은 ALB가 App에 도달해 기대한 Health 응답을 받았다는 근거다. 로그인 페이지의 `200`도 페이지가 열렸다는 뜻이지, 사용자의 인증이 성공했다는 뜻은 아니다.

브라우저에서는 Health JSON과 빈 로그인 Form을 확인했고, 별도 익명 HTTP 점검에서는 Ticket 조회의 `401`과 Location Header 부재를 확인했다. 실제 로그인·Cookie 속성·CSRF 전달·문의 접수와 RDS Row는 아직 대조하지 않았다. 이 확인 수단들을 Browser 로그인 E2E 하나로 묶어 표현하지 않는다.

ALB와 App·RDS는 마지막 확인 시 실행 중이었다. 과업 기록을 마치는 것만으로 실행 비용이 멈추지는 않는다. Task 중지, ALB 정리, RDS 중지·보관의 범위는 구분해서 확인해야 한다.

## 이름이 비슷해도 계정의 용도는 다르다

App 암호를 설정하는 중에 마스터·deployer 암호를 떠올렸지만, 이 단계는 기존 계정으로 로그인하는 것이 아니라 새 App DB 계정에 암호를 설정하는 단계였다. 계정 이름이 무엇인지뿐 아니라 **어느 시스템에 들어갈 때 쓰는 암호인지**를 기준으로 구분한다.

| 계정 | 사용하는 곳 |
|---|---|
| `helpdesk-deployer` | AWS Console에서 학습 리소스 배포 |
| RDS 관리자 `postgres` | DB 계정·Schema 권한 준비 |
| App DB 계정 `helpdesk_app` | Helpdesk의 JDBC·현재 Flyway 실행 |
| Helpdesk USER·AGENT | Browser의 Application 로그인 |

Parameter Store에 값을 등록해도 PostgreSQL 계정이 만들어지는 것은 아니다. DB 안에 계정을 준비하고 그 암호를 App에 전달할 값과 맞춰야 한다. `\password`의 두 입력이 다르다는 메시지도 기존 Password 인증 실패가 아니라 새 암호와 확인 암호의 불일치다.

ECS Execution Role은 Agent가 AWS에서 Image·Parameter·Log를 준비할 때 사용하는 신원이다. PostgreSQL이 JDBC Client를 인증할 때 쓰는 것은 App DB 계정과 Password다. AWS 권한이 있다고 DB 로그인이 자동 허용되는 것은 아니다.

## App의 Schema 권한과 실제 실행은 별개다

현재 App은 같은 DataSource의 계정으로 Flyway를 실행한다. 따라서 DB 접속뿐 아니라 기존 `public` Schema에서 객체를 만들 권한도 필요하다. Superuser·다른 DB 생성·다른 계정 생성 권한까지 줄 필요는 없다.

App 계정으로 임시 Table 생성·Identity INSERT·조회를 확인한 뒤 Rollback했다. 같은 Transaction 안의 INSERT는 성공했지만 종료 후 Table·Row가 남지 않았다. 이 결과는 DB 계정의 권한과 저장 동작을 확인한 것이고, ECS에서 Helpdesk를 실행해 Migration·Ticket 저장까지 확인한 것은 아니다.

## Task 실행 상태와 Spring 기동을 나눈다

Container가 실행 중이라고 Application의 준비가 끝난 것은 아니다. 첫 Task는 JVM과 Spring 기동을 시작했지만, Flyway의 DB 인증 실패가 JDBC·Repository Bean 생성 실패로 이어졌다. Log의 바깥쪽 Bean 오류보다 원인인 `28P01`을 먼저 확인해야 한다.

`28P01`은 DB Password 인증 실패다. Execution Role에 Parameter 읽기 권한을 더 주거나 인증서 검증을 끄는 방법으로 해결할 문제가 아니다. 같은 원인이 여러 예외에서 반복된 것도 Task를 여러 번 실행했다는 뜻이 아니다.

## 같은 Image로 새 설정을 받는다

DB Password만 맞추는 작업에서는 Java 코드나 Image를 바꾸지 않았다. Parameter의 값을 맞춘 뒤 새 Task를 시작하면, ECS Agent가 변경된 값을 전달하고 새 Spring 객체가 그 설정으로 만들어진다. 기존 Task에 값이 자동 반영되는 것은 아니다.

이번에는 PostgreSQL 계정을 다시 만들거나 DB 암호를 바꾸지 않았다. 접속에 성공한 App 암호를 기준으로 지정 Parameter 한 개만 직접 저장했고, 실제 값은 문서·Log·캡처로 남기지 않았다.

## 자체 Test와 AWS의 검증도 구분한다

`awslogs-create-group: "false"`는 로컬 구조 Test에서 통과했지만 ECS Console이 거부했다. 공식 기본값에 맞춰 필드를 생략하고, Log Group을 자동 생성하지 않는 기존 범위를 유지했다. 실행 명세와 Test만 수정했으므로 Image 재Build나 IAM 권한 추가는 필요하지 않았다.

또한 VPC를 선택하자 Console이 모든 Subnet과 기본 Security Group을 자동 선택했다. 실행 직전 Public-a·App Group 한 개씩으로 다시 확인했다. 이전에 입력한 기억보다 최종 선택 상태가 중요하다.

## 핵심 질문

1. 정책에 `rds:CreateDBInstance`가 있는데도 요청이 거부된다면 무엇을 대조해야 하는가?
2. CloudTrail의 `requestParameters`가 `null`인 것과 실제 요청에서 태그가 누락된 것은 왜 다른가?
3. `kms:ListAliases`를 허용해도 `kms:Decrypt`를 허용한 것이 아닌 이유는 무엇인가?
4. 정책 구조 Test 통과·정책 저장·생성 화면 표시·DB 생성·TLS 접속은 각각 무엇을 확인하는가?
5. 공식 API 문서에 이름이 있다는 것만으로 같은 이름의 IAM Action이 유효하다고 판단할 수 있는가?
6. Console 조회를 보조 정책으로 분리할 때 기존 MFA·Region·생성 조건을 어떻게 유지하는가?
7. 엔진을 바꾸기 전에 20 GiB를 입력했어도 생성 직전 Storage 값을 다시 확인해야 하는 이유는 무엇인가?
8. DB 생성 성공과 글로벌 목록 조회 거부가 동시에 나타날 수 있는 이유는 무엇인가?
9. 태그 탭에 0개가 표시돼도 실제 태그 누락으로 확정할 수 없는 경우는 무엇인가?
10. TLS Handshake 성공과 PostgreSQL Password 인증 성공은 각각 무엇을 확인하는가?
11. AWS 배포 사용자·DB 관리자·App DB 계정·Browser 로그인 사용자는 왜 분리하는가?
12. Parameter Store의 값 등록만으로 PostgreSQL 계정이 준비됐다고 볼 수 없는 이유는 무엇인가?
13. 현재 App 계정에 `public` Schema의 생성 권한이 필요한 이유와, Superuser 권한이 필요하지 않은 이유는 무엇인가?
14. 임시 INSERT 성공 뒤 Rollback하여 Table이 남지 않았다는 결과와 실제 Helpdesk의 Migration 성공은 왜 다른 근거인가?
15. App용 DB 계정으로 psql 로그인이 성공했어도 Helpdesk의 Controller가 실행된 것은 아닌 이유는 무엇인가?
16. 첫 ECS 배포에서 AI를 꺼 두면 정상 문의 접수 응답·Job 상태·자동 Provider 호출 횟수는 각각 무엇인가?
17. Image Pull·JVM 시작은 성공했는데 DB `28P01`이 발생했다면, 어떤 단계가 실패한 것인가?
18. DB Password만 바꿀 때 Image 재Build는 필요 없지만 새 Task는 필요한 이유가 무엇인가?
19. 자체 Template Test를 통과했는데 ECS Console이 등록을 거부할 수 있는 이유는 무엇인가?
20. ACM 화면의 0개 표시와 검색 권한 거부가 함께 나타나면 왜 인증서 없음으로 확정할 수 없는가?
21. 인증서 검색 성공·DNS 소유권 검증·ALB Health·로그인 성공은 각각 무엇을 확인하는가?
22. 인증서 검증용 CNAME과 서비스 주소를 연결하는 CNAME은 어떻게 다른가?
23. DNS-only에서 HTTPS 요청은 Cloudflare Proxy와 ALB 중 어디에 도착하는가?
24. ALB 생성 Wizard에 오류가 있어도 일부 리소스가 이미 만들어졌을 수 있는 이유는 무엇이며, 재시도 전에 무엇을 확인해야 하는가?
25. ALB 대상에 Task의 공인 IP가 아니라 Private IP:8080을 등록하는 이유는 무엇인가?
26. Health 200/UP·로그인 페이지 200·익명 API 401 중 실제 로그인 성공을 증명하는 결과가 있는가?
27. 단독 Task가 교체되면 Target 등록에서 무엇을 다시 확인해야 하는가?

## 다음 학습의 순서

10월 15일에는 Helpdesk USER·AGENT의 실제 로그인부터 이어간다. Session Cookie의 속성, CSRF 없는 접수 `403`과 정상 접수 `201`, USER 조회 `403`과 AGENT 조회 `200`을 비교하고 Ticket·Message·Job Row를 SQL로 대조한다. Provider·Worker는 아직 꺼 두며, 정상 접수한 Job은 `PENDING`, 자동 호출은 0회가 목표다.

그 뒤 개인정보 탐지·실패 상태·Provider·Worker의 전체 연결, Cloud 관측·재배포·이전 Image 복귀·별도 DB 복원과 WIL을 이어간다. Route 53 비교·조회와 HTTP Redirect 등 남은 실험도 유지한다. 15일 하루에 끝내기 위해 분량을 줄이지 않는다.

구체적인 이벤트와 적용 결과는 [RDS 권한과 DB 생성·TLS 접속 검증](../lab-reports/2026-10-14-rds-console-permission-diagnostics.md), [ECS 첫 기동과 DB 인증 진단](../lab-reports/2026-10-14-ecs-first-cloud-startup.md), [실제 10월 15일 HTTPS 연결 보고서](../lab-reports/2026-10-15-cloud-https-baseline.md)에 정리했다.
