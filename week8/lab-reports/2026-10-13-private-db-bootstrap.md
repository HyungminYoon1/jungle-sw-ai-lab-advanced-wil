# Private DB의 최초 접속 관리 통로

> 실행일: 2026-10-13
> 상태: 임시 Network·CloudShell VPC 환경 한 개 등록·지정 환경 정책 적용과 실제 터미널·psql 준비 확인 완료. RDS 생성·공개 CA 준비·DB 접속은 대기.

Private RDS에 App DB 계정을 처음 준비하기 위해 CloudShell VPC 환경 한 개의 관리 경로를 선택했다. 임시 권한·Group·RDS 규칙과 사용 후 정리 범위를 별도로 승인받았다. RDS·App·ALB 실행과 DB Credential 입력은 이 준비 범위에 포함하지 않는다.

## 적용한 Network

| 대상 | 저장된 설정 |
|---|---|
| Bootstrap Group | `helpdesk-learning-db-bootstrap`, 학습 VPC, Inbound 0개 |
| Bootstrap Outbound | RDS Group의 TCP 5432 한 개. Internet 전체 Outbound 없음 |
| Bootstrap 태그 | `Project=helpdesk-learning`, `Purpose=db-bootstrap` |
| RDS Inbound | 기존 App Group TCP 5432 유지, Bootstrap Group TCP 5432 추가 |
| RDS 규칙 수 | Inbound 2개·Outbound 0개 |

생성·규칙 저장 뒤 실제 이름·VPC·태그·포트·Source·Destination과 규칙 수를 다시 읽어 대조했다. 기존 App 규칙은 같은 규칙 ID와 설명을 유지했으며 추가 작업은 Bootstrap 규칙 한 개였다. ALB·App의 접근 규칙과 기존 Route Table은 변경하지 않았다.

실제 Resource ID와 정리 대상은 Lab의 Git 제외 `local/deployment/`에 보관한다. 공개 기록에 계정 번호·공인 IP·Credential·실제 Resource ID는 넣지 않는다.

## 임시 권한 설계

Lab의 `deployer-db-bootstrap-policy.template.json`은 기존 세 정책과 별도로 사용한다. 최초 적용에서는 정확한 VPC·Private Subnet·Bootstrap Group의 환경 생성만 허용하고, 환경 ID 확인 뒤 정확한 환경 ARN 하나의 상태 조회·시작·Session·중지·정리를 추가한다. 다른 환경의 터미널을 허용하는 `environment/*`는 사용하지 않는다.

직접 호출의 MFA와 서울 제한을 유지한다. ENI는 지정 Subnet·Group에서 CloudShell 태그를 가진 대상으로 제한하고, 사용 허가·정리도 같은 Subnet·VPC 조건을 둔다. Group 정리는 Bootstrap의 정확한 ARN·Project·Purpose 태그를 함께 요구한다.

`PutCredentials`와 파일 전송 URL을 명시적으로 거부하며 Secret 조회·Access Key·임의 IAM 수정·유료 Network·실행 리소스 생성 권한은 추가하지 않는다. SQL Client는 DB Credential을 별도로 입력받으며 AWS Console의 인증정보를 Shell에 제공할 필요는 없다. [AWS CloudShell 권한 안내](https://docs.aws.amazon.com/cloudshell/latest/userguide/sec-auth-with-identities.html)

CloudShell VPC 저장 공간은 임시다. 접속용 공개 CA와 도구를 확인한 뒤 DB 생성·연결을 별도로 진행한다. 인터넷 경로가 없는 환경에서 도구 설치를 위해 NAT를 자동 추가하지 않는다. [CloudShell VPC의 제약](https://docs.aws.amazon.com/cloudshell/latest/userguide/using-cshell-in-vpc.html)

## 생성 단계 정책 적용

관리자 신원으로 `helpdesk-deployer-db-bootstrap`을 생성하고 `helpdesk-deployer`에게 직접 연결했다. 기존 Foundation·Runtime·Edge 세 정책은 유지했으며 저장된 사용자 화면에는 네 정책이 표시됐다. 이 단계에는 환경 하나의 Session 허용 문장을 제외한 10개 문장을 적용했다.

AWS 편집기의 보안·오류·경고·추천은 모두 0이었다. 저장된 전체 JSON을 실제 Network 값으로 치환한 Template과 대조해 일치를 확인했다. 공백을 제외한 JSON 길이는 3,990자다. 처음 생성 시 Description의 세미콜론이 허용 문자 검사에서 거부돼 설명만 수정했고, 권한 내용은 바꾸지 않았다.

Root 로그인은 이 임시 정책을 적용하기 위한 것이었다. 이미 저장한 RDS Inbound를 다시 편집하지 않았으며, 연결 확인 뒤 Root에서 로그아웃했다. CloudShell 환경은 배포 사용자로 생성하고, 생성된 ID를 확인한 뒤 같은 정책에 해당 환경의 Session 권한을 추가한다.

## VPC 환경 등록과 상태 조회

`helpdesk-deployer`와 서울 Region을 확인한 뒤 생성 폼에서 학습 VPC·`helpdesk-private-a`·Bootstrap Group 한 개를 선택했다. 이름은 `helpdesk-db-bootstrap`으로 등록했고 환경 목록에 같은 이름의 VPC 환경 한 개가 표시됐다.

기본 환경 생성은 `cloudshell:CreateEnvironment`의 허용 부재로 거부됐다. 등록한 VPC 환경에서는 별도의 `cloudshell:GetEnvironmentStatus`가 해당 환경 ARN에 대해 거부됐다. 오류 상세에서 환경 ID를 확인하고, 저장된 환경을 다시 열었을 때 같은 ID를 가리키는 것도 대조했다. 환경 등록과 상태 조회·터미널 사용은 서로 다른 IAM 작업이다.

확인한 ID 하나를 반영한 전체 정책은 11개 문장·공백 제외 4,395자다. 관리자 신원으로 같은 임시 정책의 기본 Version 2에 적용했고, 저장된 전체 JSON이 준비한 정책과 일치하는 것을 확인했다. AWS 편집기의 보안·오류·경고·추천은 모두 0이었으며 기존 Version 1은 유지했다. 전체 환경을 허용하는 `environment/*`는 없고 AWS 인증정보의 Shell 전달 금지도 유지했다.

관리자 로그아웃 뒤 배포 사용자·서울 Region을 다시 확인하고 저장된 환경을 열었다. 이전 상태 조회 거부 대신 초기화를 거쳐 실제 터미널 프롬프트가 나타났다. 환경의 `View details`에서 VPC·Private Subnet·Bootstrap Group이 준비한 실제 ID와 모두 일치하는 것을 확인했다.

터미널에서 DB 연결 없이 `psql --version`을 실행해 `psql (PostgreSQL) 16.15`를 확인했다. 이는 SQL 접속용 Client가 준비됐다는 결과이며 PostgreSQL 서버가 생성되거나 DB 인증이 성공했다는 뜻은 아니다. RDS 생성·공개 CA 준비·TLS·DB 계정 설정은 이어서 진행한다. ENI 자체의 ID·정리 상태는 별도 목록에서 확인한다.

## 검증과 다음 단계

새 정책 Test 12개와 기존 정책 Test 16개가 모두 통과했다. 이는 JSON·Size·Condition·생성/Session 분리와 권한 경계의 로컬 구조 검사다. 두 단계의 AWS 편집기 검증·정책 저장, 사용자 연결과 배포 사용자의 VPC 환경 등록·Network 대조·터미널·psql 실행을 확인했다. ENI 개별 확인과 실제 DB 연결은 남아 있다.

JavaScript 전체 201개가 실패·건너뜀 없이 통과했고 ESLint도 통과했다. 새 Test의 `URL` import 누락을 보완한 뒤 다시 확인했다. 두 저장소의 Diff와 변경 문서의 UTF-8 without BOM·LF·상대 링크·공개 식별자 제외 검사도 통과했다. Java 회귀와 Image 재Build는 이번 IAM·문서 변경에서 다시 실행하지 않았다.

배포 사용자는 자기 권한을 수정할 수 없으므로 지정 환경의 정책은 관리자 신원으로 적용했다. 다음은 별도로 승인할 RDS 생성과 공개 CA·TLS·DB 계정 준비다. 초기 DB 설정과 실제 App 연결 확인이 끝나면 환경·ENI, RDS의 임시 규칙, Bootstrap Group과 임시 정책을 순서대로 정리한다. 기존 세 정책과 App·RDS·ALB Group은 유지한다.

운영 Java·JAR·Image는 변경하지 않았고 외부 AI도 호출하지 않았다.
