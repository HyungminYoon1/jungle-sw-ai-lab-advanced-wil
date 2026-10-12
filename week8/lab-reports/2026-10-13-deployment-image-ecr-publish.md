# 배포 준비 변경을 검증하고 ECR에 Image 추가

> 실행일: 2026-10-13 KST
> 결과: 로컬·일반/수동 CI 통과, 검증 Image 한 개 추가. 기존 Image를 유지해 ECR에 총 두 개 보관
> 승인 범위: 검증 Image 한 개 추가·기존 Image 유지. App·RDS·ALB 실행은 별도 승인

## 이번 변경과 Commit

배포용 사용자 설정, RDS 공개 CA, ECS 명세와 실행 Role을 준비한 변경을 정리했다. 구현은 Lab에, 학습자료·실험 결과·계획은 WIL에 각각 Commit했다. 작은 신뢰 정책·Test 보완은 Push 전에 마지막 SSM Commit에 합쳤다.

| 저장소 | Commit | 내용 |
|---|---|---|
| Lab | `e83e2a5` | AI 비활성 상태의 문의 접수 Test |
| Lab | `da1d687` | 배포용 USER·AGENT 구성과 설정·HTTP Test |
| Lab | `59f733f` | AI 비활성 첫 실행용 ECS 명세 초안 |
| Lab | `0ffc185` | CPU·메모리 제한을 둔 배포 Image 측정 |
| Lab | `c9dc001` | RDS 공개 CA와 TLS 연결 준비 |
| Lab | `2e2cc40` | Standard Parameter Store 참조·최소 실행 권한·Trust Policy |
| WIL | `fb420b5` | Secret 전달·TLS·Image 실행·복구 학습자료 |
| WIL | `b256ca6` | 10/12 실험 보고서 다섯 개와 학습 노트 |
| WIL | `f80ed66` | 실제 AWS 설정·최소 비용 구성·1년 Log 보존 계획 |

두 저장소의 `main`에 Push했다. 업로드한 Image의 Source는 Lab Commit `2e2cc403f73972d5c0f87ab81342b776e7777f6b`로 고정했다.

## 로컬 검증

- `mvnw verify`: Java 578개 통과, 실패·오류·Skipped 0개.
- `node --test src/test/js/*.test.mjs`: JavaScript 173개 통과, 실패·취소·Skipped·TODO 0개.
- ESLint 성공.
- 두 저장소의 관련 변경에서 `git diff --check`, UTF-8 without BOM·LF, 상대 링크와 공개 파일의 비밀값·실제 계정 번호·로컬 절대 경로 점검을 통과했다.

Java 검증은 실제 PostgreSQL Testcontainers를 사용했다. Provider 관련 Test는 제어된 응답을 사용했고 실제 외부 AI는 호출하지 않았다. 로컬 Test 결과와 아래의 GitHub Actions·ECR 결과는 각각 기록한다.

## CI와 Image 전달

[일반 Push CI](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/38270080649)는 Java 578개·JavaScript 173개·ESLint·Image Build가 모두 통과했다. 실패·오류·Skipped는 0개였고 Publish Job은 `Skipped`였다.

이 실행의 성공을 확인한 뒤 같은 Source Commit의 [수동 검증·업로드 Workflow](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/38270850325)를 한 번 실행했다. `publish_image=true`로 지정했고 Run Attempt는 `1`이었다.

수동 실행도 Java·PostgreSQL·JavaScript·ESLint를 검증한 뒤 `linux/amd64` Image를 Build했다. Publish Job은 그 Image를 Artifact로 받아 Local Image ID·Source Label·Platform을 대조하고, 기존 GitHub OIDC Role로 ECR에 올렸다. Publish Job에서 다시 Build하지 않았다.

| 실제 Actions 실행 | Java | JavaScript | ESLint·Image Build | Publish |
|---|---|---|---|---|
| 일반 Push `38270080649` | 578개 통과 | 173개 통과 | 성공 | `Skipped` |
| 수동 `38270850325` | 578개 통과 | 173개 통과 | 성공 | 성공 |

두 실행 모두 실패·오류·Skipped Test는 0개였다. 수동 실행에서는 Image 전달·식별 대조·OIDC 인증·Push·ECR Digest 재조회와 Runner의 Registry 로그아웃까지 성공했다.

## 새 Image 식별

```text
Repository: ai-helpdesk-learning-lab
Source Commit: 2e2cc403f73972d5c0f87ab81342b776e7777f6b
Platform: linux/amd64
Tag: git-2e2cc403f73972d5c0f87ab81342b776e7777f6b-run-38270850325-attempt-1
Manifest Digest: sha256:1ec1ed5b0a4853b87fac7d1ded3937cf961be19f3d6e010608019e7b55cae39b
Local Image ID: sha256:5bf87ead32fb62c05d153f55dd7fca57167c7851d452e9c6dd75a7bf83c78831
```

검증 Job과 Publish Job의 Local Image ID가 일치했고, Docker Push 결과와 ECR 재조회·Console의 Manifest Digest도 일치했다. 두 종류의 ID가 서로 같은 값이어야 하는 것은 아니다. 검증 Image 재사용은 `verifiedImageReused: true`, Cloud 실행 검증은 `cloudRuntimeVerified: false`로 기록됐다.

Console의 새 Image 생성 시각은 `2026-10-13 00:36:04 KST`, 표시 크기는 `199.05 MB`였다. 계정 번호·실제 Registry URI·Credential은 공개 기록에서 제외하고, 결과 JSON과 화면은 Git 제외 로컬 경로에 보관했다.

## 기존 Image 유지

업로드 전 ECR Console의 Image 목록에서 기존 Image 한 개를 확인했다.

```text
Repository: ai-helpdesk-learning-lab
Tag: git-77ce72cf5973559d0306b6c45b90d2b7aa926c7f-run-38055617775-attempt-1
Manifest Digest: sha256:2d9d4c3072829516f3f447596cc2853bf2c8dfde63c5f47326345fe070fde756
```

새 Image는 기존 Tag를 덮어쓰지 않고 별도의 Immutable Tag로 추가했다. 업로드 후 Console을 새로고침해 Image가 두 개이며 기존·새 Tag와 Digest가 함께 남아 있음을 확인했다. 기존 Image 삭제·자동 정리 정책 변경은 하지 않았다.

## 실행 범위와 다음 단계

이번 승인에는 ECS Task·Service, RDS·ALB 실행과 DNS·ACM 변경이 포함되지 않는다. Secret 값을 읽거나 새 Credential을 만들지 않고 기존 업로드 Role의 권한도 늘리지 않는다.

실제로 이번 실행에서 위 리소스의 생성·실행이나 DNS 변경, 기존 Image 삭제는 하지 않았다. ECR에는 검증 Image 하나만 추가했다.

ECR에 Image가 저장되어도 Cloud에서 Helpdesk가 실행된 것은 아니다. 첫 실행은 AI 비활성 명세로 준비하며, RDS·TLS·Network·로그인·Cookie·CSRF와 전체 AI 조립·복구는 후속 학습에서 확인한다. 실제 실행 리소스와 비용은 별도 범위를 승인받은 뒤 진행한다.

## 확인한 Source

| 지정 Source | 확인 범위 | 상태 |
|---|---|---|
| WIL 저장소 | 이번 변경의 학습자료·보고서·노트·주간/배포 계획, 이전 ECR 보고서 | `PARTIAL` — 저장소 전체가 아닌 관련 문서 점검 |
| Lab 저장소 | 배포 변경 전체, Build·CI·Docker·실행 명세·정책과 관련 Test | `PARTIAL` — 저장소 전체가 아닌 이번 릴리스 변경 점검 |

위 범위에서 선택한 변경 파일과 Workflow는 모두 읽어 확인했다. 공개 CA는 PEM 본문을 출력하지 않고 전체 인증서의 구조·Hash·유효기간 등을 Test로 검사했다.

- [이전 ECR 업로드](./2026-10-10-verified-image-ecr-publish.md)
- [배포 계획](../deployment-plan.md)
- [주간 계획](../weekly-plan.md)
