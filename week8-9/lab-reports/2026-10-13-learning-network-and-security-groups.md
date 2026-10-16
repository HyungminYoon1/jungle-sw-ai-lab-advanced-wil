# 학습 VPC와 Security Group 적용

> 상태: Network 생성·설정 저장과 Console 조회 대조 완료. App·RDS·ALB 실행과 실제 연결 Test는 NOT_RUN.
> 실행일: 2026-10-13

서울의 `helpdesk-deployer` 신원으로 학습 전용 Network를 구성했다. 생성 직전 VPC·Subnet·Gateway·Route Table·Group 수량, 접근 규칙과 공인 IPv4 한 개의 AWS 반영 범위를 승인받았다. 기존 다른 리소스는 변경하지 않았으며 NAT Gateway·유료 Endpoint·Elastic IP를 만들지 않았다.

## 저장된 Network

| 대상 | 확인한 설정 |
|---|---|
| VPC | `helpdesk-learning`, `10.42.0.0/16`, `Available`. DNS 확인·Hostname 활성화 |
| Public Subnet | `helpdesk-public-a`·`c`, 서울 a·c AZ, `10.42.0.0/24`·`10.42.1.0/24`, 두 개 모두 `Available` |
| Private Subnet | `helpdesk-private-a`·`c`, 같은 두 AZ, `10.42.10.0/24`·`10.42.11.0/24`, 두 개 모두 `Available` |
| Internet Gateway | `helpdesk-learning-igw`, 지정 VPC에 `Attached` |
| Public Route Table | `helpdesk-learning-public`. `local`과 `0.0.0.0/0 → Gateway` 경로 활성, Public Subnet 두 개만 명시적 연결 |
| Main Route Table | Private 두 개의 기본 Table. `10.42.0.0/16 → local` 한 경로만 유지 |

VPC·Gateway·Security Group의 저장된 Project 태그를 읽어 대조했고 Subnet·Public Route Table 생성에도 같은 태그를 지정했다. 자동 생성 Main Table과 기본 Security Group에는 별도 태그·규칙 변경을 하지 않았다. 서비스에는 새 Group 세 개를 사용할 계획이다.

Public IP가 있는 App과 제한된 Inbound를 쓰는 안을 선택했다. Private App에 NAT나 유료 Endpoint를 추가하는 안과 비교해 첫 연결 비용과 구성 수를 줄이되, DB는 Private으로 유지하기 위한 선택이다. 두 AZ의 Subnet 준비와 실행 App 수·Single-AZ DB 수는 구분한다.

## 접근 규칙

| Group | Inbound | Outbound | 규칙 수 In/Out |
|---|---|---|---|
| `helpdesk-learning-alb` | 학습자의 현재 공인 IPv4 한 개(`/32`)에서 TCP 443 | App Group TCP 8080 | 1 / 1 |
| `helpdesk-learning-app` | ALB Group TCP 8080 | HTTPS TCP 443, RDS Group TCP 5432 | 1 / 2 |
| `helpdesk-learning-rds` | App Group TCP 5432 | 별도 시작 규칙 없음 | 1 / 0 |

새 Group의 기본 전체 Outbound를 제외하고 필요한 규칙만 저장했다. 저장 성공 후 규칙 수·포트·Source와 Destination을 대조했다. ALB의 저장된 Source가 승인한 IPv4 한 개와 일치하고 Internet 전체의 Inbound가 없는 것도 확인했다. 실제 IP와 Secret 값은 공개 기록에 넣지 않는다.

RDS의 응답 트래픽에는 Security Group의 Stateful 동작이 적용된다. Outbound 0개를 모든 응답 차단과 같은 뜻으로 해석하지 않는다. Network 허용과 DB Password·SQL 권한, Application의 USER·AGENT·CSRF 검사는 별개다. [AWS Security Group 동작](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html)

## 권한과 검증 범위

학습 VPC에서 생성·연결·DNS 설정·경로·Group 규칙 저장에 성공했다. Console이 함께 호출한 `DescribeNetworkAcls`·`DescribeNatGateways`·`DescribeCarrierGateways`는 Allow 부재로 거부됐다. 이를 이유로 정책을 확대하지 않고 사용할 수 있는 목록·개별 설정 화면에서 확인했다.

이번 결과는 Network 설정과 실제 IAM 변경 허용의 근거다. App·RDS·ALB를 실행하지 않았으므로 Browser·Packet 연결·RDS 인증과 TLS·Migration·HTTPS의 근거는 아니다. 다른 Region·Project 변경과 MFA 없는 배포 거부 Test도 남아 있다. IAM·명세 구조 Test와 이전 CI 결과는 [신원 보고서](./2026-10-13-deployer-identity-and-policies.md) 및 Image 보고서와 구분한다.

적용 후 로컬 정책 구조 Test 16개를 다시 실행해 모두 통과했다. 재개용 Manifest는 Subnet 4개·Public 연결 2개·Group 3개와 공인 IP 미저장을 확인했다. 두 저장소의 Diff와 공개 문서의 UTF-8 without BOM·LF·링크·내부 ID/절대 경로 제외 검사도 통과했다.

운영 Java Code·JAR·Image와 IAM 정책은 변경하지 않았다. 실제 Resource ID는 Lab의 Git 제외 `local/deployment/`에 재개용으로 보관하며, 공인 IP·Credential은 넣지 않는다.

## 다음 단계

Private Subnet으로 RDS를 구성하고 관리자 계정과 App DB 계정을 분리한다. 준비된 Network·기존 Parameter·검증 Image Digest를 Task Definition에 연결한 뒤 AI 비활성 첫 실행에서 TLS·Migration·로그인·접수·조회를 확인한다. ALB·ACM·DNS·HTTPS와 전체 AI·복구 검증은 이어서 진행한다.

이 보고서의 Group 세 개·RDS `1/0`은 첫 Network 적용 시점이다. 이후 별도 승인한 DB 최초 접속용 Bootstrap Group과 임시 RDS 규칙은 [관리 통로 준비 보고서](./2026-10-13-private-db-bootstrap.md)에 기록한다. 임시 규칙이 있는 동안 RDS는 `2/0`이며 초기 설정 완료 후 App 규칙 한 개만 남기는 순서로 정리한다.
