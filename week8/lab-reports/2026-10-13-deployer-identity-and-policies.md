# 배포용 IAM 신원과 정책 적용

> 상태: 사용자·정책 생성과 저장본 대조, Password·MFA 등록·비Root 로그인 완료. 실제 배포 권한 검증은 진행 중.
> 적용일: 2026-10-13

## 목적과 승인 범위

Root 대신 학습용 배포 신원을 준비했다. 사용자 `helpdesk-deployer` 한 명과 Customer-managed Policy 세 개의 생성·연결을 승인받았다. 기존 Role 변경·AdministratorAccess·Access Key·직접 Secret 값 조회·리소스 삭제는 제외했다. Password와 MFA 등록은 본인이 수행한다.

Foundation은 MFA·서울·학습 Network·지정 Execution Role 전달, Runtime은 ECS·Private RDS, Edge는 ALB·ACM·지정 Image와 Log 조회를 담당한다. 일부 목록·Describe API의 Region 전체 메타데이터 조회 범위를 적용 전에 설명했다. ECS·RDS·ELB의 지정 서비스 연결 Role 세 개를 생성할 수 있는 예외도 함께 승인받았다.

공개 Template은 Lab의 `deploy/iam/`에 두고 Account ID는 자리표시자로 유지한다. 실제 계정 정보·Password·MFA Seed·Token은 공개 기록에 넣지 않는다.

## 확인 결과

| 대상 | 결과 |
|---|---|
| 사용자 | `helpdesk-deployer` 한 명 생성 |
| 연결 정책 | `helpdesk-deployer-foundation`·`runtime`·`edge` 세 개만 직접 연결 |
| 저장된 JSON | 세 정책 모두 실제 Account ID를 반영한 Template과 전체 내용 일치 |
| 기존 Role | 수정하지 않음 |
| Console Password | 본인 등록 뒤 활성화 확인 |
| MFA / Access Key | MFA 1개, Access Key 0개 |
| Console 신원 | Root 로그아웃 후 `helpdesk-deployer` 로그인, 서울 Region 전환 확인 |
| 서비스 연결 Role | 생성 권한만 허용. Role 자체는 아직 생성하지 않음 |
| App·RDS·ALB / DNS | 실행·변경하지 않음 |

## 검증을 나눈 기준

| 검증 | 결과와 범위 |
|---|---|
| 정책 구조 Focused Test | 16개 통과. JSON·Size·Action·Resource·Condition 검사 |
| JavaScript 전체 회귀 | 189개 통과 |
| ESLint / Diff 검사 | 통과 |
| AWS 편집기 | 세 정책의 보안·오류·경고·제안 모두 0 |
| Console 저장·연결 확인 | 생성 성공, 정책 세 개 연결과 저장된 JSON 일치 확인 |
| MFA 등록·IAM 로그인 | 완료. 등록 상태와 Console 신원 확인 |
| 실제 IAM 평가 | 지정 학습 Network 생성·연결·규칙 저장 성공. ACL·NAT·Carrier Gateway 목록 조회는 Allow 부재로 거부. 다른 Region/Project·MFA 없는 배포 거부 검증은 남아 있음 |
| Cloud 배포·DB·HTTPS | NOT_RUN |

처음 AWS 편집기에서 ECS Feature Key의 Type 경고 10개와 ALB Listener Protocol의 집합 한정자 오류 2개가 나왔다. ECS Key는 String 비교로, Listener Protocol은 집합 연산자로 수정하고 회귀 Test를 추가했다. 로컬 Test의 통과와 AWS가 Context Key를 해석하는 검증은 구분했다.

이 변경은 배포 정책·Test·문서에 한정된다. Java 운영 Code와 JAR·Image는 바꾸지 않았으며 새 Image를 업로드하지 않았다.

## 다음 확인

1. MFA 없는 배포, 다른 Region·Project 변경 거부와 지정 학습 대상 허용을 확인한다. 정책 저장 성공을 실제 권한 평가 성공으로 대신하지 않는다.
2. 완료한 [Network 설정](./2026-10-13-learning-network-and-security-groups.md)에 App·RDS·ALB를 연결해 실제 동작을 확인한다. Network만 준비한 상태를 Cloud Application 실행으로 기록하지 않는다.
3. AI 비활성 첫 App·Private RDS·ALB를 준비하고 Parameter 전달·TLS·Migration·Session·CSRF·접수·조회와 HTTPS를 검증한다.

권한이 부족하면 거부된 Action·Resource·Condition을 확인한다. 승인 밖의 권한을 자동 추가하거나 전체 서비스 관리 권한으로 대체하지 않는다.
