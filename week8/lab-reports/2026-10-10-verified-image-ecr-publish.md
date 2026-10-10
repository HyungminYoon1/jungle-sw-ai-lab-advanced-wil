# 검증한 Image를 GitHub OIDC로 ECR에 업로드

> 실행일: 2026-10-10 KST
> 결과: 실제 Actions 검증·OIDC 인증·ECR Image 1건 업로드 성공
> Cloud의 Application 실행·ECS·RDS·ALB·DNS·HTTPS 배포는 이번 실험에 포함하지 않음

## 실험 목적과 승인 범위

이전 회차에 만든 ECR과 업로드 Role을 사용해 검증한 Image를 AWS에 전달했다. Workflow 수정과 실제 Image 1회 업로드를 승인받았으며, 기존 IAM 정책과 다른 프로젝트의 설정은 변경하지 않았다. ECR은 실행 프로그램이 아니라 Image를 보관하는 곳이므로, 이 단계에서 Helpdesk Process나 Controller가 AWS에서 실행되는 것은 아니다.

- Lab 변경 Commit: `77ce72cf5973559d0306b6c45b90d2b7aa926c7f`
- 구현 파일: Lab의 `.github/workflows/verify.yml`, `README.md`
- [수동 검증·업로드 실행](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/38055617775)
- [같은 Commit의 일반 Push 검증](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/38055609054)

AWS 계정 번호·실제 ARN·Credential·Registry 인증 Token은 공개 기록에 넣지 않는다. Repository Variables에는 대상 Role·Region·Repository 설정을 두었고, 장기 AWS Key나 AI Key를 추가하지 않았다.

## 검증과 업로드를 분리한 Workflow

일반 Push·PR에서는 Java·실제 PostgreSQL Testcontainers·JavaScript·ESLint를 검증하고 Image를 Build한다. `main`의 수동 실행에서 `publish_image=true`를 선택한 경우에만 별도 Publish Job으로 이어진다. Publish Job은 `needs: verify`로 앞의 성공에 의존하며, OIDC Token 요청 권한도 이 Job에만 둔다.

| 순서 | 실행 내용 | 확인한 결과 |
|---|---|---|
| 1 | Java와 PostgreSQL Testcontainers | 551개 통과, 실패·오류·Skipped 0개 |
| 2 | JavaScript Test와 ESLint | 146개 통과, ESLint 성공. 실제 AI 호출 없음 |
| 3 | `linux/amd64` Image Build | 성공. Source Commit을 Image Label에 기록 |
| 4 | Image를 `docker image save`로 전달 | 같은 실행의 Artifact를 Publish Job이 내려받음 |
| 5 | 전달받은 Image 검사 | 검증 Job의 Local Image ID·Source Commit·Platform과 일치 |
| 6 | GitHub OIDC → AWS STS | 기존 main 전용 Role의 임시 Credential 발급 성공 |
| 7 | ECR Registry 로그인 → Image Push | 1회 업로드 성공 |
| 8 | `ecr:BatchGetImage`로 재조회 | ECR의 Manifest Digest와 Docker Push Digest 일치 |

Publish Job에서 Image를 다시 Build하지 않았다. Image 전달 Artifact는 1일, 비밀값 없는 결과 JSON은 7일 보관하도록 설정했다. 일반 검증과 업로드 실행의 Concurrency Group을 나누고, 업로드 중인 실행을 후속 Push가 자동 취소하지 않도록 했다.

로컬에서는 공식 Actionlint `v1.7.12`의 다운로드 Checksum·Workflow 검사를 통과했고 JavaScript 146개도 통과했다. Java 551개와 Image Build의 이번 실행 근거는 위의 실제 Actions 결과다.

## 실제 Image 식별

ECR Console에서 업로드 전에는 활성 Image가 없었고, 업로드 뒤에는 한 건을 확인했다. 생성 시각은 22:29:22 KST, 표시된 Image 크기는 `199.04 MB`였다.

```text
Repository: ai-helpdesk-learning-lab
Platform: linux/amd64
Tag: git-77ce72cf5973559d0306b6c45b90d2b7aa926c7f-run-38055617775-attempt-1
Manifest Digest: sha256:2d9d4c3072829516f3f447596cc2853bf2c8dfde63c5f47326345fe070fde756
Local Image ID: sha256:deb53021ca148e4a35babd02d0c202cb0d97290bb994e744fe1d17a0ee29e268
```

Local Image ID와 Registry Manifest Digest는 서로 다른 대상을 식별하므로 값이 같아야 하는 것은 아니다. Local Image ID는 검증 Job에서 만든 Image와 Publish Job이 받은 Image를 비교하는 데 사용했고, Manifest Digest는 Docker Push 결과와 ECR 조회 결과를 비교하는 데 사용했다.

Immutable Tag를 덮어쓰지 않도록 Commit·Run ID·Run Attempt를 함께 넣었다. 다음 배포 단계에서는 이 Manifest Digest로 실행할 Image를 지정한다.

## 자동 업로드가 차단된 결과

같은 Commit의 일반 Push 실행은 검증·Image Build가 성공했지만 Publish Job은 `Skipped`였다. 수동 실행만 Publish Job에 진입했고, 전체 실행과 OIDC 인증·Push·Digest 대조가 성공했다. 따라서 일반 Push만으로 ECR 업로드가 시작되지 않는 조건은 실제 두 실행에서 비교했다.

다른 Branch의 OIDC 요청이나 권한이 빠진 Role의 실제 거부는 아직 별도 실험 전이다. 이번 성공을 그 실패 조건의 검증으로 대신하지 않는다.

## 비용과 다음 단계

ECR에는 이번 Image 한 건만 추가했다. Image 보관에는 Storage 비용이 발생할 수 있으며, 이번 실험에서 ECS·RDS·ALB·NAT Gateway·새 Public IP를 생성하지 않았다. DNS Record와 ACM 인증서도 변경하지 않았다. [ECR 요금 안내](https://aws.amazon.com/ecr/pricing/)

다음은 실행할 Task Definition·Execution Role·Network·RDS·Secret·HTTPS의 구성과 비용을 확정하는 단계다. Image 업로드 성공과 실제 Application 실행·로그인·문의 저장·AI 처리 성공을 나누어 확인한다. 리소스 생성은 별도 범위를 확인한 뒤 진행한다.

- [AWS 초기 설정](./2026-10-10-aws-oidc-ecr-baseline.md)
- [Image 전달과 ECS 실행 학습자료](../study-docs/image-publishing-and-ecs-execution.md)
- [주간 계획](../weekly-plan.md)
