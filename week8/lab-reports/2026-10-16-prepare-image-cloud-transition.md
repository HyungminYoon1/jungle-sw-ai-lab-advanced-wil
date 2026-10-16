# 준비 버전 P의 Cloud 전환

> 실행일: 2026-10-16 KST
> 상태: 승인한 A→P 전환 검증 완료 — 수정 명세 :4의 P Digest·원본 RDS/V7·Spring 기동·Target Healthy·HTTPS와 AGENT 재로그인 후 기존 Ticket/Job 조회를 확인했다. V8 적용·B 활성화·B→P 복귀·전체 AI는 미실행이다.

## 승인 범위와 기준

기존 A에서 P로 App만 교체한다. 원본 RDS·V7·AI Provider/Worker 비활성·0.25 vCPU/512 MiB·기존 Network/보안·TLS·Parameter 참조를 유지한다. 새 App은 한 개만 실행하며 기존 Target Draining과 A 종료 뒤 P를 시작한다. P에 문제가 생기면 기존 A Image·명세로 복귀한다.

V8 적용·Worker 활성화·외부 AI 호출·IAM/DNS/Secret 변경·기존 Image 및 검증 Snapshot 삭제는 포함하지 않는다. 이 전환은 B 활성화나 B→P Image Rollback 실험과 구분한다.

| 항목 | 기준 |
|---|---|
| A 명세 | `helpdesk-learning:1` |
| A Image Manifest Digest | `sha256:1ec1ed5b0a4853b87fac7d1ded3937cf961be19f3d6e010608019e7b55cae39b` |
| P Source | `77359c9779a0a9cb7f505fe4b82b7f97c5ea02be` |
| P Image Manifest Digest | `sha256:7369d0471d58ed27add9b6a9fc1d9fb28c99e9de7e006620127fd01ecea3933b` |
| P 수정 명세 | `helpdesk-learning:4` |
| 실행하면 안 되는 명세 | `helpdesk-learning:2`·`:3` — 삭제한 임시 DB Endpoint 참조 |

## 전환 전 확인

AWS Console에서 기존 A Task 한 개와 Healthy Target 한 개, 원본 RDS의 사용 가능 상태를 확인했다. 기준 명세의 원본 RDS Endpoint·`verify-full`·Cookie 설정·기존 Execution Role·여섯 Parameter 참조를 유지한다. 비밀값은 열거나 기록하지 않았다.

첫 :3을 준비할 때는 클립보드로 읽은 JSON을 실제 기준 :1과 같다고 취급했다. 편집기 입력과 저장본을 그 입력본에 대조했지만, 입력본 자체의 개정·원본 DB 주소를 검증하지 못했다. 이 때문에 삭제한 임시 복원 DB 주소가 :3에 포함됐다. 아래의 :3 기동 실패와 :4의 실제 기준 대조를 구분한다.

수정 :4에서는 :1의 화면에 표시된 JSON 전체를 DOM에서 직접 읽었다. 원본 ARN·개정 1·A Digest·원본 RDS의 전체 JDBC URL·AI 비활성을 먼저 확인하고 Image만 P Digest로 바꿨다. 등록 뒤 :4 JSON도 DOM에서 직접 읽어 AWS 등록 메타데이터를 제외한 모든 입력이 후보와 일치하는지 확인했다. 실제 :1과 다른 실행 입력은 Image 한 개뿐이다. 사양·Fargate 1.4.0·기존 Public-a Subnet/App 보안 그룹과 여섯 Parameter 참조를 유지하고 ECS Exec·추가 지표를 활성화하지 않는다.

Task 실행 화면의 부가 `ecs:DescribeCapacityProviders` 조회는 권한 부족으로 거부됐다. 기존과 같은 Fargate 시작 유형을 직접 선택해 실행 폼을 준비했으며 IAM 조회 권한을 추가하지 않았다. 실제 실행 성공 여부는 별도로 확인한다.

교체 전 Browser 업무 화면은 이미 ‘로그인이 필요합니다’ 상태였다. 따라서 이후 재로그인 성공과 기존 데이터 조회는 확인하되, 이번 교체가 그 Session을 소실시켰다는 직접적인 전후 비교 근거로 사용하지 않는다.

## 실행 기록

- P 명세 `:3` 등록과 저장 JSON 대조를 완료했다.
- 기존 A의 지정 Target 한 개를 등록 해제하고 Draining을 확인했다. 기존 지연은 300초이며 값을 변경하지 않았다.
- Draining 완료 뒤 기존 A의 실제 중지 상태·종료 코드 143, Cluster의 실행/보류 Task 0개를 확인했다.
- 첫 P 실행은 `ecs:RunTask`의 Allow 부재로 거부됐다. 새 Task의 JVM·Spring 실패가 아니다. 승인한 복구 절차로 A 명세 `:1`의 실행을 요청했지만 같은 거부가 발생했다.
- 실행 폼에서 명세의 태그 전파만 선택하고 직접 요청 태그는 넣지 않았다. 저장소의 기존 RunTask 허용문은 `aws:RequestTag/Project=helpdesk-learning`을 요구한다. 태그 전파를 끄고 실행 요청에 Project 태그를 명시하자 A Task가 수락됐다. IAM 정책을 수정하지 않았다.
- 새 A Task의 기존 Digest·원본 DB 명세와 Healthy Target을 확인했다. 익명 HTTPS의 Health 200/UP·로그인 200·Ticket 조회 401로 접속 복구를 확인했다. 이 복귀 확인에는 인증 후 업무 조회를 포함하지 않는다.
- P 실행 폼에도 같은 직접 지정 Project 태그를 넣고 정확한 값을 대조했다. 복구한 A의 Target Draining 뒤 P 전환을 재시도했다.
- 태그를 보완한 :3의 실행 요청은 수락됐다. 실제 P Digest의 Task를 확인했지만 Spring은 Flyway 연결 단계에서 삭제한 임시 DB Host를 찾지 못해 `UnknownHostException`으로 실패했다. Task는 종료 코드 1로 끝났으며 해당 실행에서 DB 연결·Migration은 진행되지 않았다.
- 실패 P의 Target을 해제하고 기존 :1의 새 A Task 한 개를 실행했다. P는 이미 종료된 상태여서 JVM을 동시에 실행하지 않았다. A Target Healthy와 HTTPS Health 200/UP을 다시 확인했다. 원본 RDS·DB 구조·Secret·IAM·DNS는 바꾸지 않았다.
- 실제 :1을 DOM에서 읽어 검증한 수정 :4를 등록했다. 등록된 :4의 전체 실행 입력과 원본 RDS 주소를 다시 대조하고, 직접 지정 Project 태그를 포함한 실행 폼을 준비했다. A Target의 기존 300초 Draining 뒤 :4를 실행했다.
- 마지막 A Target의 Draining 완료·Target 0개와 A Task의 종료 코드 143을 확인한 뒤 :4의 P Task 한 개를 실행했다. 실제 실행 명세 :4와 ECR의 P Manifest Digest 일치를 확인하고 새 Task의 Private IP:8080을 지정 Target Group에 등록했다.

## 수정 P의 기동과 HTTPS

CloudWatch에서 원본 RDS의 Hikari 연결 완료, Migration 7개 검증 성공, 현재 Schema 버전 7, 추가 Migration 불필요를 확인했다. Spring은 22:26:24 KST에 78.783초의 기동 시간으로 시작했다. 실제 Task가 사용한 Image Digest는 위 P 값과 일치한다.

| 익명 HTTPS 확인 | 결과 |
|---|---|
| `/actuator/health` | 200, `status=UP` |
| `/login` | 200 |
| `/api/tickets/1` | 401 |
| `/ai-suggestion-ui.mjs` | 200, 검증한 P Source와 SHA-256 일치 |

제공된 UI 파일의 SHA-256은 `c422b100e9d7a26e06c15a4f696c3b041098d666f74d1313e76d729bbb1c8920`이며 P Manifest의 해당 파일과 같다. 이는 Image·Task 정보와 별도로 실제 HTTPS에서 P의 정적 파일이 제공되는지 확인한 결과다.

App 기동 중에는 ALB Target이 Unhealthy였다. 기존 설정인 `/actuator/health`·200, 정상 임계값 5회·비정상 임계값 2회·30초 간격·5초 Timeout을 바꾸지 않고 기다린 뒤 P의 Target 한 개가 Healthy이고 Draining 대상은 0개인 것을 확인했다.

## 재로그인 후 기존 업무 조회

작성자가 기존 AGENT로 직접 로그인한 뒤, 실제 HTTPS UI의 조회 버튼으로 기존 Ticket 두 건과 각각의 AI Job을 읽었다. 새 문의 생성·AI 재시도·Ticket 상태 변경은 하지 않았다.

| 조회 대상 | 확인 결과 |
|---|---|
| Ticket 1 | `배포 학습 문의`, `OPEN` |
| Ticket 2 | `CSRF 누락 검증`, `OPEN` |
| Ticket 1의 AI Job | `PENDING`, 최종 실패 코드 없음 |
| Ticket 2의 AI Job | `PENDING`, 최종 실패 코드 없음 |

현재 실행 중인 App은 `helpdesk-learning:4`의 P이며, 원본 RDS·V7과 AI Provider/Worker 비활성을 유지했다. P에서 기존 업무를 다시 읽을 수 있음을 확인했으며, SQL Row/Hash와 예약 원장 건수의 재조회는 이번 전환에 포함하지 않았다. 업무 조회와 Target Healthy 화면의 근거는 Lab의 Git 제외 경로 `local/deployment/rollback-prepare-cloud/`에 보관한다.

A의 Image·원본 DB·검증 Snapshot은 유지했다. 후속 B의 Cloud 실행과 V8에서 새 실패를 저장한 뒤 P로 복귀하는 실험은 다음 단계다. 이번 A→P 준비 전환을 B→P Rollback 완료로 기록하지 않는다.

## 입력 확인에서 주의한 점

Console의 키보드 기반 입력 과정에서 태그·IP 주소에 한글 잔여 문자가 붙는 현상이 있었다. 잘못된 IP는 등록 폼에서 거부됐으며 그 주소를 Target으로 등록하지 않았다. 같은 브라우저의 DOM 기반 입력·클릭으로 바꾸고 실제 입력값을 읽어 정확한 태그와 Task의 Private IP:8080을 대조했다. 수정 JSON 편집기에도 조합 문자가 남아 첫 저장 시도는 Client 문법 검사에서 거부됐다. 조합을 종료하고 다시 입력한 뒤 :4 등록과 저장 JSON의 전체 대조를 완료했다. Password·Token·Cookie는 읽거나 출력하지 않았다.

클립보드의 문자열은 복사 완료 표시만으로 출처를 확정하지 않는다. 실제 명세의 DOM JSON에서 ARN·개정과 원본 Endpoint를 먼저 확인한 뒤, Image 변경 외의 차이가 없는지 비교한다.

관련 Source/CI/ECR 근거는 [P CI·ECR 보고서](./2026-10-16-prepare-image-ci-ecr.md), 로컬 V7/V8 결과는 [사전 호환성 보고서](./2026-10-16-image-rollback-preflight.md)에 있다.
