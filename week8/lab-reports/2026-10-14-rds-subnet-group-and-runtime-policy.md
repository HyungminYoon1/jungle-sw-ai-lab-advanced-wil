# RDS Subnet Group과 Runtime 권한 수정

> 실행일: 2026-10-14
> 학습 회차: 2026-10-13의 연장 실험
> 상태: Runtime 정책 적용과 DB Subnet Group 생성·태그 등록·조회 완료. DB 생성 요청은 IAM 거부, 원인 조건 대조·TLS·DB 접속은 남아 있음.

RDS Console의 Subnet Group 생성 화면에는 태그 입력란이 없었다. 기존 IAM 정책은 생성 요청에 `Project=helpdesk-learning`을 요구해 지정한 Group의 생성도 거부됐다. 이 충돌을 해결하기 위한 Runtime 정책 한 개의 변경 범위를 별도로 승인받았다.

## 생성과 사용 조건 분리

생성 시 태그를 요구하는 기존안, 서비스 전체 권한을 주는 안, 정확한 이름의 Group만 생성하고 사용 시 태그를 검사하는 안을 비교했다. 마지막 안을 선택했다.

- 이름이 `helpdesk-learning`인 Subnet Group 한 개의 생성만 허용한다.
- 생성 뒤 같은 Group에 `Project=helpdesk-learning`을 등록한다.
- DB 생성에서 Group을 사용할 때 `rds:subgrp-tag/Project`를 검사한다. DB 생성 요청 자체의 Project 태그도 유지한다.
- 태그 조회는 해당 Group 하나에만 추가한다.

MFA·서울·Private DB·Storage 암호화·`db.t4g.micro`·Single-AZ·20 GiB 제한은 바꾸지 않았다. ECS 권한과 기존 태그 등록·DB Stop·Start 조건도 그대로다. 태그 없는 Group 사용의 실제 IAM 평가는 아직 DB를 생성하지 않아 확인 전이다. [AWS RDS 권한 정의](https://servicereference.us-east-1.amazonaws.com/v1/rds/rds.json)

전용 Parameter Group 생성 대신 `default.postgres17`을 유지하기로 별도로 확인했다. PostgreSQL 17의 기본 `rds.force_ssl`은 활성화되지만, App의 `verify-full` 연결과 CA·Hostname 검증은 실제 연결에서 확인해야 한다. [AWS PostgreSQL TLS 안내](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html)

## 정책 적용

로컬 검사에서 최초 변경안이 Managed Policy의 6,144자 한도를 넘었다. 같은 대상의 생성·조회 문장을 합치고 RDS의 문장 식별자를 줄였다. 최종 적용본은 15개 문장·공백 제외 6,119자이며 권한 조건은 유지했다.

관련 정책 구조 Test 31개가 모두 통과했다. 기존 Runtime 정책의 전체 JSON을 먼저 읽어 ECS·DB 사양·태그 등록·Stop·Start 조건에 승인 밖의 변경이 없는지도 대조했다.

JavaScript 전체 204개가 실패·건너뜀 없이 통과했고 ESLint도 통과했다. Java 회귀와 Image 재Build는 이번 IAM·문서 변경에서 실행하지 않았다.

관리자 신원으로 기존 `helpdesk-deployer-runtime`의 기본 Version 2를 저장했다. 저장된 전체 JSON은 실제 계정 번호를 반영한 Template과 일치했고, 기존 Version 1은 유지했다. Root에서 로그아웃한 뒤 배포 사용자로 돌아왔다. Foundation·Edge·Bootstrap 정책과 기존 Role은 수정하지 않았다.

## Subnet Group 확인

배포 사용자로 기존 Group이 없는 것을 확인하고 한 개를 생성했다. 상세 화면에서 다음 내용을 재조회했다.

| 항목 | 저장된 설정 |
|---|---|
| 이름 | `helpdesk-learning` |
| VPC | 기존 학습 VPC |
| Subnet | `helpdesk-private-a`·`helpdesk-private-c`, 총 2개 |
| AZ | 서울 a·c |
| 네트워크 | IPv4 |
| 태그 | `Project=helpdesk-learning`, 1개 |

Public Subnet은 포함하지 않았다. 생성 성공, 태그 수정 성공과 실제 저장된 태그 Key·Value를 각각 확인했다. 실제 Resource ID와 정책·화면 근거는 Git 제외 `local/deployment/`에 보관한다.

## RDS 생성 화면의 추가 조회 거부

생성 화면에서 일반 PostgreSQL·Single-AZ·자체 Credential 관리·버스터블 Instance 계열을 선택했다. 그러나 연결 설정 영역에는 리소스 로드 오류가 나타났고 Browser 진단에서 `outposts:ListOutposts`의 `AccessDeniedException`을 확인했다. 목록 화면의 DB Cluster 조회 거부와도 구분했다. 현재 Instance 생성·Network·요금 명세는 모두 마친 상태가 아니다.

`ListOutposts`는 목록 메타데이터 조회 작업이며 개별 Resource 제한을 지원하지 않는다. 이 조회 한 개를 기존 MFA·서울 제한 아래에서 추가하도록 별도로 승인받았다. 현 정책 유지·서비스 전체 권한·목록 조회 한 개를 비교해 마지막 안을 선택했다. 서울의 다른 프로젝트 Outposts 메타데이터 조회도 가능하지만 생성·변경·삭제나 Secret 조회는 추가하지 않는다. Runtime Template·Test·안내에 반영했다. [AWS Outposts 권한 정의](https://servicereference.us-east-1.amazonaws.com/v1/outposts/outposts.json)

기존 Version 2와 대조해 조회 Action 한 개만 다름을 확인한 뒤 기본 Version 3에 저장했다. 전체 저장 JSON은 변경안과 일치하며 15개 문장·공백 제외 6,143자다. Version 1·2는 보존했고 AWS 편집기의 보안·오류·경고·추천은 모두 0이었다. 지정 사용자에 기존 네 정책의 연결이 유지됐고, MFA·서울 제한을 가진 Foundation의 전체 저장 JSON도 Template과 일치했다.

추가 Test를 포함한 정책 구조 검사 32개·JavaScript 전체 205개·ESLint가 통과했다.

Root 로그아웃 뒤 배포 사용자로 재로그인해 전체 생성 화면을 다시 열었다. 초기 Aurora 화면에서는 연결·기존 학습 VPC·Subnet Group 영역이 표시됐지만, 일반 PostgreSQL로 전환하면 연결 영역부터 같은 리소스 로드 오류가 나타났다. 비밀번호를 입력하지 않은 상태에서 한 번 새로고침한 뒤에도 재현됐다. 이번 재확인에서는 구체적인 거부 Action을 추가로 확인하지 못했다. 따라서 조회 권한 추가를 전체 화면 오류의 해결로 기록하지 않고, 원인을 모르는 다른 권한도 추가하지 않는다.

현재 폼에는 일반 PostgreSQL `17.11-R1`·`db.t4g.micro`·Single-AZ·gp3 20 GiB·자체 Credential 관리까지만 준비했다. 승인한 용량을 넘는 자동 Storage 증설은 껐다. 연결·암호화·태그·Monitoring·백업·요금 확인은 아직 마치지 못했으므로 완성된 생성 명세가 아니다. RDS 생성과 연결 검증은 대기 중이다.

이 단계까지는 Codex가 DB Credential을 입력하거나 생성 요청을 실행하지 않았다. 이후 생성 요청의 거부 응답은 아래에 따로 기록한다.

## DB 생성 요청의 거부

이후 작성자가 전달한 생성 오류에서 `rds:CreateDBInstance` 요청의 HTTP `403`과 다음 설명을 확인했다. 계정 번호와 실제 ARN은 공개 기록에서 제외한다.

```text
no identity-based policy allows the rds:CreateDBInstance action
```

현재 요청에 적용되는 신원 정책의 Allow를 찾지 못했다는 결과다. Runtime에 해당 Action은 있지만 DB 이름·Instance Class·Storage·Project 태그·암호화·Public Access 등의 조건을 함께 요구한다. 어떤 조건이 맞지 않았는지까지 이 메시지만으로 확정하지 않는다. [AWS 조건 평가](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-logic-multiple-context-keys-or-values.html)

생성 폼의 비밀값 없는 항목을 다시 조회해 이름·PostgreSQL 17·`db.t4g.micro`·Single-AZ·20 GiB를 확인했다. 연결·태그 영역은 계속 로드되지 않았으며 실제 요청의 `StorageEncrypted`·`PubliclyAccessible`·Project 태그는 확인하지 못했다. 첨부 Console 로그 445줄에는 IAM·RDS 요청 실패와 부가 조회·JavaScript 경고가 함께 있었지만, IAM 요청의 구체적인 Action이나 DB의 실패 조건은 나오지 않았다.

직접 페이로드를 확인하려던 Chrome 화면 제어는 현재 브라우저 URL을 안전하게 식별하지 못해 중단됐다. 전체 요청 Body·HAR·Password·Token을 추출하거나 공개하지 않았으며, 이 진단에서는 추가 권한 변경이나 생성 재시도를 하지 않았다. 해당 거부 요청을 DB 생성 성공이나 실제 연결 근거로 기록하지 않는다.

10/13 회차를 마감하고 원인 대조와 생성·연결은 10/14에 이어간다. 정책 구조 Test 32개·JavaScript 전체 205개·ESLint는 마감 검토에서도 통과했다. Java 회귀·Image 재Build·외부 AI 호출은 이번 권한·문서 정리에서 실행하지 않았다.

## 영향 파일과 후속 확인

Lab의 `deploy/iam/deployer-runtime-policy.template.json`, `src/test/js/iam-deployer-policy.test.mjs`, `deploy/iam/README.md`를 변경했다. 정책 구조 Test는 조건이 명세대로 작성됐는지 확인하는 것이며, 실제 생성·태그 등록·조회 결과와 구분한다.

다음은 현재 RDS 리소스·서비스 연결 Role의 상태와 실패 요청의 비밀값 없는 필드를 재조회해 IAM 조건과 대조하는 것이다. 그 뒤 생성 명세·비용·Credential 관리 방식을 확인하고 실제 TLS·DB 인증·App용 계정·Migration·연결을 진행한다. App·ALB·NAT·유료 Endpoint는 이번 정책 변경과 Group 생성에서 시작하지 않았고, 운영 Java·JAR·Image는 변경하지 않았다.
