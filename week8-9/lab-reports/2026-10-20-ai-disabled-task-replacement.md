# AI 비활성 상태의 새 Image 기동과 Task 교체

> 실행일: 2026-10-20 KST
> 결과: 새 Task 한 개로 교체·Healthy·AGENT 재로그인·기존 Ticket/Job 조회·Cloud Log 대조 완료

## 변경 범위와 순서

사용자는 이번에 ECR에 올린 Image로 Task 한 개를 교체하고 재로그인·기존 문의 보존·Cloud Log를 확인하도록 승인했다. RDS·DB 구조·DNS·Secret은 변경하지 않으며 AI Provider와 Worker는 계속 비활성으로 유지한다.

1. 기존 실행 명세와 새 Image의 Digest를 대조한다.
2. Image만 바꾼 새 실행 명세를 등록하고 Task 한 개를 시작한다.
3. 기동 Log와 새 Target의 Healthy를 확인한다.
4. 기존 Target을 제외하고 기존 Task를 중지한다.
5. AGENT 재로그인 뒤 같은 문의·Job을 조회하고 새 Task의 요청 Log를 대조한다.

새 Task가 준비되기 전에는 기존 Target을 유지한다. 문제가 생기면 기존 Task를 다시 연결할 수 있도록 기존 명세·Image는 남긴다. 교체 중에만 두 Task가 잠시 실행되며 ECS Service를 새로 만들지 않는다.

## Image와 실행 명세

| 항목 | 기존 | 새 실행 |
|---|---|---|
| Task Definition | `helpdesk-learning:4` | `helpdesk-learning:6` |
| Image Manifest Digest | `sha256:7369d0471d58ed27add9b6a9fc1d9fb28c99e9de7e006620127fd01ecea3933b` | `sha256:0f53c6ce5532d44b4a0b3e8123c27498aeb466539ee02f00326eb111c9e9296a` |
| CPU·Memory | 0.25 vCPU·512 MiB | 동일 |
| Profile | `postgres,deployment` | 동일 |
| AI Provider·Worker | 모두 비활성 | 동일 |
| Secret | 기존 Parameter 여섯 개 참조 | 참조 동일, 값 조회·변경 없음 |

새 Source는 `d8ca65f3d0bab2a04ec554f7b5e8251b5f8d25a5`이며 [ECR 전달 보고서](./2026-10-20-ecr-image-publication.md)의 검증 산출물을 사용했다. 등록 뒤 Console의 JSON을 다시 읽어 메타데이터를 제외한 실행 설정을 비교했고, Container Image 외에는 기존 명세와 같은 것을 확인했다. 새 Task의 실행 Image Digest도 대조했다.

기존 Public Subnet 한 개·App Security Group 한 개·Fargate 1.4.0·기존 Log Group을 유지했다. 기본 Security Group이나 다른 Subnet을 추가하지 않았다. Task Role·ECS Exec·유료 추가 모니터링도 활성화하지 않았다.

## 기동 Log에서 확인한 것

새 Task는 `RUNNING`이며 Cloud Log에서 다음을 확인했다.

- PostgreSQL 연결 Pool 시작 완료
- `verify-full` 연결 설정과 PostgreSQL 17.11
- Flyway의 현재 Schema Version 8, 적용할 추가 Migration 없음
- `Started HelpdeskApplication`

새 Source와 기존 Source의 Migration 디렉터리에도 차이가 없었다. 이 확인을 위해 DB Schema나 Row를 수정하지 않았다.

Cluster의 일반 실행 화면에서는 Capacity Provider와 Task Definition Family의 보조 목록 조회가 거부됐다. IAM 권한을 늘리는 대신 등록한 명세의 실행 메뉴에서 Family·Revision을 지정하고 Fargate Launch Type으로 시작했다.

## Target 전환과 기존 Task 중지

새 Task의 Private IP와 8080을 기존 Target Group에 등록하고 Healthy를 확인했다. 이어 기존 Task의 Target 한 개만 등록 해제했다. 기존 연결의 Draining을 기다린 뒤 새 Target 한 개만 Healthy로 남은 것을 확인하고 기존 Task를 중지했다. 최종 Cluster 조회는 실행 중 1개·보류 중 0개였으며 새 명세 `:6`의 Task가 실행 중이었다. 기존 Task는 실제 `STOPPED` 상태와 종료 코드 143을 확인했다.

Target Group·Listener·Health Check·Security Group 설정은 변경하지 않았다. 기존 명세와 Image도 삭제하지 않았다.

## AGENT 재로그인과 기존 문의 조회

기존 Session은 교체 전부터 만료돼 있었다. 교체 전 로그인 완료 응답 후에도 첫 API 조회는 ‘로그인이 필요합니다’로 나왔다. 따라서 이번 실행을 기존 Session의 소실 시점을 증명한 실험으로 기록하지 않는다.

새 Target 전환 뒤 사용자가 AGENT로 다시 로그인했다. 로그인 후 `/`의 404가 나왔지만 이어진 보호 API 조회는 성공했다. 재로그인 후 다음 필드를 기존 기록과 대조했다.

| Ticket ID | 제목 | Ticket 상태 | AI Job 상태 | 최종 실패 코드 |
|---|---|---|---|---|
| 1 | 배포 학습 문의 | `OPEN` | `PENDING` | 없음 |
| 2 | CSRF 누락 검증 | `OPEN` | `PENDING` | 없음 |

접수·수정·재시도 요청은 보내지 않고 단건 조회만 사용했다. 위 확인 범위는 Ticket·Job API에 표시되는 필드이며, Message 본문·작성자의 SQL Hash를 다시 대조한 결과는 아니다.

## HTTPS 응답과 Cloud Log 대조

Cookie를 보내지 않는 별도 HTTPS `GET /tickets.html`의 응답은 200이었다. 응답의 `X-Request-Id`는 `fc85ac18-ea27-4a55-bdcb-ae2de54651bf`였으며 새 Task의 Log에서 같은 값을 찾았다.

```text
event=HANDLER_COMPLETED
requestId=fc85ac18-ea27-4a55-bdcb-ae2de54651bf
handler=ResourceHttpRequestHandler
status=200
elapsedNanos=3625104
```

Log 시각은 2026-10-20 18:58:18 KST다. 단순 기동 메시지만 본 것이 아니라 새 Task가 실제 HTTPS 요청을 처리한 기록까지 연결했다. Handler 시간은 해당 정적 요청의 값이며 전체 네트워크 지연이나 AI Job 처리 시간은 아니다.

처음 UUID만 입력했을 때는 검색 결과가 0건이었다. 하이픈을 포함한 UUID를 큰따옴표로 감싼 정확한 문구로 바꾸자 같은 이벤트가 조회됐다. [CloudWatch 필터 문법](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/FilterAndPatternSyntax.html)은 영숫자 외의 문자를 포함하는 검색어를 큰따옴표로 감싸도록 안내한다. 검색 결과 0건을 Log 미생성으로 단정하지 않는다.

## 최종 유지 상태와 다음 범위

- 새 Image의 App Task 한 개 실행, 기존 Task 중지, 새 Target 한 개 Healthy
- AI Provider·Worker 비활성 유지
- RDS·Schema·DNS·Secret·IAM 변경 없음
- 기동 Log와 실제 요청의 Cloud Log 수집 확인

화면 증거는 Git에서 제외되는 `local/evidence/2026-10-20-task-replacement/`에 보관했다. 이번 결과는 AI 비활성 배포의 확인이다. 합성 입력의 실제 AI·검사기 활성화와 실행 사양 검증은 별도 승인·명세 확인 후 이어간다. 기존 PENDING Job의 기한이나 호출 예약을 초기화하지 않는다.
