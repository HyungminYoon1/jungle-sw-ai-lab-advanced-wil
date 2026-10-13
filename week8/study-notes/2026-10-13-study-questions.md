# 2026-10-13 AWS 배포 신원과 Network

> 학습 회차: 10월 13일. 이어서 수행한 10월 14일의 권한·Subnet Group 실험도 이 회차에 포함한다.

이번에는 AWS에 배포할 사람의 신원과 Network를 준비하고, Private RDS 생성 단계까지 진행했다. 정책 저장과 실제 요청 허용은 다르다는 점을 구분해 정리했다. RDS 생성 요청은 거부됐으며, 어떤 조건이 맞지 않았는지는 다음 회차에서 확인해야 한다.

## 실행 설정과 AI 판단 구분

ECS/Fargate Agent는 Task Definition 같은 명시적인 설정에 따라 Container 실행을 준비한다. LLM의 추론으로 배포 대상을 결정하는 AI Agent가 아니다. Parameter를 읽을 권한이 없어 Task가 시작되지 않는 문제는 AI 추론 실패가 아니라 실행 준비 단계의 권한 문제다.

Task Definition을 등록했다고 JVM이나 Spring 객체가 만들어지는 것은 아니다. 실제 Task가 시작되고 JVM·Spring이 실행되어야 배포용 `InMemoryUserDetailsManager` 같은 객체도 만들어진다.

## Network 연결과 DB 인증

App은 먼저 RDS와 연결한 뒤 DB 사용자명·Password로 인증받는다. Security Group이 연결을 막으면 올바른 Password를 가지고 있어도 DB 인증 단계까지 도달하지 못한다. 반대로 DB가 Password 인증 실패를 반환했다면 그 DB까지 연결은 된 것이다. 이 문제를 IAM이나 Security Group의 권한 확대만으로 해결할 수는 없다.

Security Group에서 특정 IP를 출발점으로 지정하는 것과 Group을 참조하는 것은 다르다. RDS가 App Group을 허용하고 새 Task에도 같은 Group을 연결했다면, App의 Private IP가 바뀌어도 기존 규칙을 수정할 필요가 없다. App이 요청 Header에 Group 이름을 쓰는 것이 아니라 AWS에 설정된 네트워크 인터페이스와 Group의 관계로 적용된다.

이 규칙은 USER·AGENT의 Ticket 접근 권한을 검사하지 않는다. Network 연결이 허용된 뒤에도 DB 인증·SQL 권한과 Application의 인증·인가·CSRF 검증은 각각 필요하다.

## 경로와 허용 규칙

Route Table은 목적지로 전달할 경로를 정하고, Security Group은 연결 허용 규칙을 정한다. 접근 권한이 있어도 ECR까지 가는 경로가 없으면 Image를 받을 수 없다.

같은 VPC에서 App과 RDS가 서로 다른 Subnet에 있어도 내부 경로와 허용 규칙이 정상이라면 Private 주소로 연결할 수 있다. 이를 위해 RDS에 Public IP를 부여할 필요는 없다. App이 ECR·Parameter Store·외부 Provider로 연결하는 경로는 별도로 준비한다.

## 사람이 배포하는 권한

사람의 Console 배포 신원, GitHub의 Image 업로드 Role, ECS의 Execution Role과 Helpdesk의 로그인 Role은 서로 다른 주체다. 사람이 배포할 권한을 갖는 것과 ECS Agent가 Image·Secret·Log에 접근할 권한을 갖는 것을 구분한다.

Root는 제한 없이 계정에 접근하므로 일상 배포에는 별도의 신원을 준비한다. 이번에는 추가 IAM 준비 범위를 승인하고 `helpdesk-deployer` 한 명에게 제한된 정책 세 개를 연결했다. 직접 Password·MFA를 등록했고 Root 로그아웃 후 IAM 사용자로 로그인했다.

IAM 조건은 값의 겉모양만으로 연산자를 정하면 안 된다. 이번 AWS 편집기 검증에서 ECS의 `enable-execute-command` 같은 Key는 `false`를 비교하더라도 String 연산자를 요구했다. ALB Listener Protocol은 여러 값을 가진 Context Key라 `ForAllValues` 한정자가 필요했다. JSON 문법과 로컬 Test가 통과한 뒤에도 AWS가 해당 Action·Resource·Condition을 어떻게 해석하는지 확인해야 한다.

## Public과 Private Subnet

Subnet의 이름을 Public으로 짓는 것만으로 인터넷과 연결되지는 않는다. 이번에는 Public Subnet 두 개만 `0.0.0.0/0 → Internet Gateway` 경로가 있는 Table에 연결했다. Private Subnet 두 개가 사용하는 Main Table에는 VPC 내부의 `local` 경로만 남겼다.

App에 Public IP를 사용할 계획이더라도 Browser가 App의 8080으로 직접 들어오는 규칙은 허용하지 않는다. App의 Inbound Source는 ALB Group이고 RDS의 Source는 App Group이다. App의 외부 HTTPS Outbound를 허용하는 것과 외부에서 App으로 들어오는 Inbound를 허용하는 것은 반대 방향의 규칙이다.

두 AZ에 Subnet을 만든 것이 App 두 개나 Multi-AZ DB를 실행했다는 뜻은 아니다. ALB와 RDS Subnet Group이 사용할 두 AZ를 준비한 것이며, 실제 App 한 개·Single-AZ RDS의 실행 수는 별도로 정한다.

## 세 종류의 로그인과 DB 계정

AWS에 리소스를 생성하는 IAM 신원, PostgreSQL에 연결하는 DB 계정, Browser에서 로그인하는 Helpdesk USER·AGENT는 서로 다른 계정이다. USER·AGENT의 접근 허용은 Spring Security가 판단하고 Repository는 공통 App DB 계정으로 SQL을 실행한다.

Parameter Store에 DB 사용자명·Password를 넣어도 PostgreSQL 안에 계정이 자동 생성되지는 않는다. DB 관리자 접속으로 계정과 권한을 먼저 준비해야 한다. App 시작 시 Flyway를 실행하는 현재 구성에서는 자체 Schema의 테이블 생성·변경 권한도 필요하다. 관리자 전체 권한을 주는 것과는 구분한다.

Private RDS의 최초 접속에는 VPC 안에서 실행되는 SQL Client가 필요하다. 이번 관리 통로의 CloudShell은 Browser에서 터미널을 조작하지만, `psql` 자체는 VPC 환경 안에서 실행된다. 초기 설정 뒤에는 관리 통로의 임시 규칙과 권한을 제거하고 App 접속 규칙을 유지한다.

환경을 생성할 권한과 터미널을 사용할 권한도 구분한다. 환경 ID가 아직 없을 때 전체 환경의 Session을 허용하지 않고, 생성된 ID를 확인한 뒤 그 환경 하나만 사용할 수 있도록 제한한다.

환경이 목록에 나타나더라도 상태 조회나 터미널 사용 권한은 없을 수 있다. 이번에는 VPC 환경을 등록한 뒤 `GetEnvironmentStatus`에서 거부됐다. 따라서 환경 등록·상태 조회·시작·Session·실제 DB 접속을 따로 확인해야 한다. IAM 정책을 바꾸는 관리자와 SQL Client를 사용하는 배포 신원도 구분한다.

`psql`은 PostgreSQL에 SQL을 보내는 Client다. CloudShell에서 `psql --version`이 성공해도 DB 서버를 생성하거나 DB에 연결한 것은 아니다. 환경이 사용하는 Network, DB Endpoint·TLS·DB 인증과 SQL 권한을 차례로 확인해야 한다.

## 생성할 때의 태그와 사용할 때의 태그

Subnet Group 생성 화면에 태그 입력란이 없는데 생성 요청에 Project 태그를 요구하면, 의도한 학습 대상의 생성도 거부된다. 이번에는 정확한 이름의 Group만 생성하고 태그를 등록한 뒤, DB에서 그 Group을 사용할 때 저장된 태그를 검사하는 방식으로 나누었다.

나는 생성 요청의 `aws:RequestTag/Project`와 이미 저장된 Group의 `rds:subgrp-tag/Project`를 다른 값으로 구분해 두었다. Subnet Group에 태그를 등록했다고 DB 생성 요청 자체에도 그 태그가 자동으로 포함되는 것은 아니다.

기본 `default.postgres17`을 유지하는 선택과 App의 `verify-full` 연결도 별개다. DB가 TLS 연결을 요구하더라도 Client가 CA와 Endpoint 이름을 검증하는지는 실제 연결에서 확인해야 한다.

## Allow가 있어도 요청이 거부될 수 있는 이유

`rds:CreateDBInstance`가 정책에 적혀 있어도 이름·사양·태그·암호화·공개 접근 조건을 모두 만족한 요청이어야 허용된다. `no identity-based policy allows`라는 오류만 보고 Action 자체가 빠졌다고 단정하지 않고, 현재 요청과 정책의 조건을 대조해야 한다. [AWS 조건 평가](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-logic-multiple-context-keys-or-values.html)

현재 생성 폼에서 PostgreSQL 17·`db.t4g.micro`·Single-AZ·20 GiB는 확인했지만, 연결·태그 영역은 로드되지 않았다. 실제 요청의 `StorageEncrypted`·`PubliclyAccessible`·Project 태그는 아직 확인하지 못했다. 태그가 빠졌을 가능성과 확인된 원인을 같은 말로 기록하지 않기로 했다.

Console에는 서비스 조회 실패와 JavaScript 경고가 함께 나온다. 경고가 많다는 사실만으로 모두 같은 원인이라고 보거나 Helpdesk의 XSS 공격이 발생했다고 판단할 수는 없다. 실패한 작업명·응답 코드·설명을 먼저 확인하고, 요청 Body를 볼 때는 DB Password·Token을 제외해야 한다.

## 핵심 질문

1. ECS/Fargate Agent와 Helpdesk Worker는 각각 무엇을 실행하며, 외부 AI 모델과 어떻게 다른가?
2. Security Group이 App의 연결을 막는 것과 DB가 Password 인증을 거부하는 것은 실패 단계가 어떻게 다른가?
3. RDS 규칙이 App Group을 참조할 때 Task의 IP가 바뀌어도 규칙을 유지할 수 있는 이유는 무엇인가?
4. 같은 VPC의 Private RDS 연결과 Task의 ECR 연결은 어떤 경로가 각각 필요한가?
5. 사람이 가진 배포 권한을 ECS Execution Role이나 GitHub 업로드 Role로 대신하면 안 되는 이유는 무엇인가?
6. 로컬 정책 구조 Test·AWS 편집기 검증·실제 IAM 허용과 거부는 각각 어디까지 확인하는가?
7. App의 HTTPS Outbound와 Browser의 App 직접 접속 허용은 방향과 목적지가 어떻게 다른가?
8. 같은 VPC의 두 Subnet 중 하나만 Public이 될 수 있는 이유는 무엇인가?
9. Parameter Store의 DB Credential 등록과 PostgreSQL 계정 생성은 어떻게 다른가?
10. Helpdesk의 USER·AGENT가 다른 Role을 가져도 JDBC는 공통 App DB 계정을 사용할 수 있는 이유는 무엇인가?
11. CloudShell 화면을 PC에서 조작할 때 Private DB에 접속하는 `psql`은 어디에서 실행되는가?
12. 생성할 환경의 Network를 제한하는 것과 생성된 환경 하나의 터미널 사용을 제한하는 것은 어떻게 다른가?
13. 생성 요청에 포함된 태그와 이미 저장된 Subnet Group의 태그는 어떻게 다른가?
14. Policy에 `Allow`가 있어도 실제 DB 생성 요청이 거부될 수 있는 이유는 무엇인가?
15. Console의 `403`과 JavaScript 경고를 볼 때, 실제 실패 원인을 확인하려면 어떤 정보를 구분해야 하는가?
16. 정책 구조 Test·정책 저장·Subnet Group 생성·DB 기동·TLS 접속은 각각 무엇을 확인하는가?

## 적용 확인

이번 회차의 결과를 다음과 같이 나누어 기록했다. Password·MFA는 직접 등록했고, 정책·설정·Test의 작성과 검토에는 Codex의 도움을 받았다. 아래 결과를 자료 없이 모두 설명할 수 있는지는 다음 회차에서 다시 확인한다.

| 대상 | 확인한 상태 |
|---|---|
| 배포 신원 | `helpdesk-deployer`·MFA 로그인. 기존 세 정책과 임시 Bootstrap 정책, 총 네 개 연결 |
| Network | 학습 VPC·두 AZ의 Public/Private Subnet·Gateway·Route와 ALB/App/RDS Group 설정 대조 |
| DB 관리 통로 | Bootstrap Group `0/1`, 임시 규칙을 포함한 RDS Group `2/0`. 지정 CloudShell 환경의 터미널·`psql 16.15` 확인 |
| Subnet Group | `helpdesk-learning`, Private Subnet 두 개·IPv4·Project 태그 등록과 재조회 |
| Runtime 정책 | 기본 Version 3, Version 1·2 보존. 지정 사용자 연결과 저장 JSON 대조 |
| 로컬 검증 | 정책 구조 Test 32개·JavaScript 전체 205개·ESLint 통과. 이번 권한·문서 변경에서 Java 회귀·Image 재Build는 하지 않음 |
| RDS 생성 요청 | `rds:CreateDBInstance`의 `403`·Allow 미매칭 오류 확인. 실제 요청의 어느 조건이 맞지 않았는지는 미확인 |
| Cloud 실행 | RDS TLS·계정·Migration, ECS·ALB·DNS·HTTPS·전체 AI·복구는 미완료 |

자세한 설정·실행 근거는 [배포 신원](../lab-reports/2026-10-13-deployer-identity-and-policies.md), [Network](../lab-reports/2026-10-13-learning-network-and-security-groups.md), [관리 통로](../lab-reports/2026-10-13-private-db-bootstrap.md), [Subnet Group과 RDS 생성 실패](../lab-reports/2026-10-14-rds-subnet-group-and-runtime-policy.md) 보고서에 남겼다.

## 다음 학습

10월 14일에는 RDS 탭과 현재 신원·Region을 확인하고, 비밀값을 제외한 생성 요청과 IAM 조건을 대조하는 것부터 이어간다. 생성 명세·비용·허용 결과를 확인한 뒤 Private RDS의 공개 CA·`verify-full`·관리자/App 계정 분리와 Migration, AI 비활성 ECS 실행으로 진행한다.

DNS·HTTPS·전체 AI·System·관측·Rollback·Snapshot 복원·최종 회귀·복습·WIL은 같은 Week 8의 남은 학습으로 유지한다. 실패 원인이 확정되기 전에 Root로 생성하거나 포괄적인 권한으로 우회하지 않는다.
