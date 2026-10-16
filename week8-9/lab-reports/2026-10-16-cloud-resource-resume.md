# 기존 RDS·Image로 학습 환경 재개

> 실행일: 2026-10-16 KST
> 범위: 지정 RDS 시작, 기존 명세의 단독 Fargate Task 한 개, 기존 Target Group 재연결
> 상태: RDS 사용 가능·App RUNNING·Target Healthy·익명 HTTPS 기본 응답·AGENT 재로그인 후 기존 Ticket 1/2와 PENDING Job 조회 확인

## 시작 전과 부가 조회 오류

비Root 배포 사용자로 RDS 상세의 PostgreSQL 17.11·db.t4g.micro·일시적으로 중지됨을 확인했다. 같은 화면에 `rds:DescribeGlobalClusters`의 유효한 Allow 부재가 표시됐다.

이 API는 Aurora Global Database 클러스터 정보용이다. 현재 DB의 Password 인증이나 Row 조회가 아니다. 로컬 Runtime·Foundation·RDS Console 조회 Template과 실제 오류를 대조했으며, 모든 실제 IAM 정책을 다시 감사했다고 주장하지 않는다.

필요하지 않은 글로벌 목록 조회를 추가하는 대신 기존 `StartDBInstance` 권한으로 지정 DB를 시작했다. 오류가 남은 상태에서도 시작 요청이 받아들여졌고 최종 사용 가능 상태를 확인했다. IAM·Role·DB 계정·암호·Network 규칙은 변경하지 않았다.

## 같은 명세로 새 App Task 한 개

기존 Cluster의 실행·보류 Task 0개와 Service 0개를 확인했다. 실제 `helpdesk-learning:1`에서 256 CPU Units·512 MiB·Execution Role·Profile `postgres,deployment`, Provider·Worker 비활성과 다음 Image Digest를 확인했다.

```text
sha256:1ec1ed5b0a4853b87fac7d1ded3937cf961be19f3d6e010608019e7b55cae39b
```

Console의 일반 실행 폼에서는 `DescribeCapacityProviders`와 `ListTaskDefinitionFamilies` 조회가 거부됐다. 이 부가 목록 권한도 추가하지 않았다. 지정 실행 명세의 상세 화면에서 실행 폼을 열어 명세 1을 직접 선택하고, 기존 Fargate 시작 유형을 사용했다. 승인되지 않은 명세를 사용하거나 IAM 평가를 우회한 것이 아니다.

기존 학습 VPC·Public-a Subnet 한 개·App 전용 Security Group 한 개를 선택했다. 자동으로 선택된 다른 Subnet과 기본 Group은 실행 요청에서 제외했다. Group 자체나 규칙을 삭제한 것은 아니다. 공인 IPv4는 기존 외부 접속 경로로 사용하며 App Inbound를 넓히지 않았다. Project 태그를 지정하고 ECS Exec·추가 지표·재정의·새 Volume·Service는 추가하지 않았다.

RDS 사용 가능을 확인한 뒤 13:44 KST에 새 단독 Task `23af2468d9b646a38c41a93ce08e414a` 한 개를 실행했다. 실제 RUNNING·같은 실행 Digest·새 Private IP를 확인했다. 기존 Task를 다시 시작하거나 새 Image를 Build한 것은 아니다.

## Spring과 ALB의 준비 상태

새 Task의 Log에서 검색 입력만이 아니라 실제 Event 한 건을 확인했다. `2026-10-16T04:46:07.158Z`의 `Started HelpdeskApplication`은 Spring 기동 79.705초를 표시했다. 원문·Secret·Provider 응답을 조회하거나 출력하지 않았다.

기존 HTTP 8080 Target Group의 등록 0개를 확인하고 새 Task의 실제 Private IP·8080 한 개만 등록했다. 기동 중 Target은 Initial을 거쳐 Unhealthy·Health checks failed로 표시됐다. App RUNNING과 Target 정상 상태를 같은 의미로 취급하지 않았다.

기존 Health Check는 `/actuator/health`·성공 200·간격 30초·Timeout 5초·비정상 2회·정상 5회 연속 조건이었다. 이 값을 바꾸지 않고 기다린 뒤 실제 Target Healthy 1개·Unhealthy 0개를 확인했다. 기동 중의 일시적인 실패와 최종 준비 상태를 구분한다.

## 실제 익명 HTTPS 응답

PC의 HTTP Client에서 Cookie 사용과 자동 Redirect를 끄고 확인했다. 응답 전체·Cookie·Token은 출력하지 않았다.

| 요청 | 결과 |
|---|---|
| `/actuator/health` | HTTP 200·UP·Location 없음 |
| `/login` | HTTP 200·Location 없음 |
| `/api/tickets/1` | HTTP 401·Location 없음 |

이는 실제 HTTP 응답이며 Browser 로그인·기존 Ticket 1의 존재를 확인한 결과는 아니다. 익명 401은 Spring Security의 접근 거부다. 기존 Row 보존은 인증 후 조회로 별도 확인한다.

## AGENT 재로그인과 기존 문의 조회

작성자가 기존 AGENT Credential로 직접 로그인했다. 직후 루트 `/`는 `No static resource .`·404를 표시했지만, `/tickets.html`에서 기존 문의 조회가 성공했다. 루트 화면의 부재를 로그인 실패와 혼동하지 않는다. Credential·Cookie·CSRF 값은 읽거나 출력하지 않았다.

| Browser 조회 대상 | 실제 화면 결과 |
|---|---|
| Ticket 1 | `배포 학습 문의`·OPEN |
| Ticket 2 | `CSRF 누락 검증`·OPEN |
| Ticket 1의 AI Job | PENDING·최종 실패 코드 없음 |
| Ticket 2의 AI Job | PENDING·최종 실패 코드 없음 |

재개 전의 문의를 새 App과 인증 Session으로 읽었다. 이 단계에서는 새 Ticket을 생성하거나 AI를 호출하지 않았다. Job 예약 수·Suggestion 수·본문 보존 Boolean을 SQL로 다시 조회한 결과는 아니며, 이전 SQL 결과를 재개 후 실행으로 옮겨 적지 않는다.

실행 화면은 별도 로컬 캡처의 RDS Available/부가 조회 거부, Target Healthy, Ticket 1 조회와 Job PENDING으로 남겼다. 민감한 입력창은 캡처하지 않았다.

## 유지한 범위와 다음 확인

DB를 새로 만들거나 Snapshot에서 복원하지 않았다. 기존 RDS·DB 구조·Secret·ALB·DNS·인증서·IAM·실행 Image는 유지했다. 로컬 최신 Source의 V8·새 개인정보 구현을 이 Image에 배포하지 않았고 AI도 계속 꺼져 있다. RDS와 새 App의 실행 과금은 재개됐으며 ALB·보관 비용은 별도다.

이번 중지·재개 후 기존 Ticket·Job의 조회와 새 인증 Session 사용을 확인했다. 중지 직전의 인증된 Browser 기준을 확보한 실험은 아니므로 이전 Session 거부의 전후 비교까지 증명하지는 않는다. 현재 AGENT 조회를 다음 교체의 기준으로 사용할 수 있다. 정식 Task 교체·Session 비교, 이전 Image Rollback·별도 Snapshot 복원·전체 AI Cloud 검증은 남아 있다.
