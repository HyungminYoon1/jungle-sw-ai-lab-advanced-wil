# 검증한 main Image의 ECR 전달

> 실행일: 2026-10-20 KST
> Source: `d8ca65f3d0bab2a04ec554f7b5e8251b5f8d25a5`
> 결과: 기존 ECR에 Image 한 개 추가·Digest 대조 완료. 실행 Task·DB·ALB는 변경하지 않음

## 승인과 실행 범위

사용자는 두 저장소의 변경을 Push하고 CI를 확인한 뒤 검증 Image 한 개를 기존 ECR에 추가하도록 승인했다. Billing 조회가 거부돼 처음에는 업로드를 보류했지만, 이후 비용 조회를 뒤로 미루고 진행하도록 요청했다. 이번 한 개의 전달에서만 비용 조회를 선행 조건으로 두지 않았으며 실제 누계는 여전히 미확인이다.

기존 Image는 유지하고 App·RDS·ALB·IAM·DNS·Secret·AI 활성화는 변경하지 않았다. Root를 사용하거나 새 Role·Repository를 만들지 않았으며, 기존 main 전용 GitHub OIDC와 서울의 `ai-helpdesk-learning-lab`을 사용했다. [전달 전 확인과 CI 실패 복구](./2026-10-20-deployment-delivery-preflight.md)는 별도 기록을 따른다.

## Source와 검증 실행

먼저 [일반 Push CI 39397231695](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/39397231695)의 성공과 원격 main·로컬 HEAD가 같은 Source인지 대조했다. WIL의 학습자료·노트·계획도 목적별 Commit으로 Push한 뒤 `verify.yml`을 `main`, `publish_image=true`로 한 번 실행했다.

[수동 전달 Run 39398031412](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/39398031412)는 자기 Verify Job에서 다시 검증·Build한 Image를 Publish Job에 전달했다. 일반 Push CI의 Image를 전달했다고 기록하지 않는다.

| 확인 | 수동 전달 Run의 결과 |
|---|---|
| Source | `d8ca65f3d0bab2a04ec554f7b5e8251b5f8d25a5` |
| Java Surefire | 1,010개·실패/오류/건너뜀 0 |
| 패키징 후 Failsafe | 2개·실패/오류/건너뜀 0 |
| JavaScript | 279개·실패/취소/건너뜀 0 |
| ESLint·Image Build | 모두 성공 |
| Verify Job | 4분 22초 |
| Publish Job | 1분, 18:10:08 KST 완료 |
| 실제 AI·새 Cloud App | 실행하지 않음 |

## ECR에서 확인한 산출물

| 항목 | 값 |
|---|---|
| Region·Repository | `ap-northeast-2` · `ai-helpdesk-learning-lab` |
| Tag | `git-d8ca65f3d0bab2a04ec554f7b5e8251b5f8d25a5-run-39398031412-attempt-1` |
| ECR Manifest Digest | `sha256:0f53c6ce5532d44b4a0b3e8123c27498aeb466539ee02f00326eb111c9e9296a` |
| Verify Job의 Local Image ID | `sha256:db3534d607cb69e2389fbdff0699de862bee78fc48149efc2b63c983833ef4bd` |
| Platform | `linux/amd64` |
| 검증 Image 재사용 | `verifiedImageReused: true` |
| Cloud Runtime 검증 | `cloudRuntimeVerified: false` |

Publish Job은 전달받은 Image의 ID·Source Label·Platform을 AWS 인증 전에 대조했다. 재Build 없이 Tag를 붙여 한 번 Push했고 Push 결과의 Manifest Digest와 ECR `BatchGetImage` 조회 Digest가 같았다. Local Image ID와 Registry Manifest Digest는 다른 식별값이므로 바꾸어 사용하지 않는다.

`ecr-image-evidence-39398031412-1` Artifact의 JSON도 내려받아 Source·Run·Attempt·Repository·Tag·Digest·Platform·재사용 여부를 다시 대조했다. 공개 기록에는 계정 번호·Role ARN·Credential을 넣지 않았다. 전달 Image Artifact는 기존 Workflow의 1일, 비밀값 없는 Evidence는 7일 보존을 유지했고 Runner의 Registry Login 정리도 성공했다. 기존 Image 삭제·Tag 덮어쓰기·수동 재실행은 하지 않았다.

## 다음 Cloud 검증

이번 결과는 Source 검증과 Image 보관·전달의 근거다. 17:49 KST에 읽은 기존 실행 Image는 `sha256:7369d0471d58ed27add9b6a9fc1d9fb28c99e9de7e006620127fd01ecea3933b`였고 이번에는 Task를 교체하지 않았다. 새 Request/Job Log·합성 실행 구성이 실제 AWS에서 동작했다고 보지 않는다.

다음 단계는 이번 Manifest Digest와 현재 Task Definition을 대조하고, 별도 승인한 범위에서 AI 비활성을 유지한 새 Task로 실행해 Health·재로그인·기존 문의 조회와 새 Request Log를 확인하는 것이다. Worker·실제 AI 활성화는 그 뒤의 별도 합성 실험으로 남긴다. RDS Schema·원문·Job 예약·Secret·DNS를 임의로 바꾸지 않는다.
