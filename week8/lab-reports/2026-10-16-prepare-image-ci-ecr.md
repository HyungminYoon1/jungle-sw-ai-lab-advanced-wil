# 준비 버전 P의 원격 CI와 ECR 업로드

> 실행일: 2026-10-16 KST
> 상태: P 전체 CI·Image Build·기존 ECR 업로드·Digest 대조 완료. App·RDS·ALB 실행과 Cloud Image Rollback은 이번 범위에 포함하지 않음

## Source와 실행 범위

P는 기준 `2e2cc403f73972d5c0f87ab81342b776e7777f6b`에서 분리한 읽기 준비 버전이다. Java Enum·UI의 실패 코드 두 개만 운영 변경으로 포함하고 V1~V7·Dockerfile·POM은 유지한다. 현재 main의 후속 개인정보 처리·운영 V8을 P에 합치지 않았다.

| 대상 | Commit |
|---|---|
| P 읽기·PostgreSQL 호환 Test | `b668d9e` |
| P Container 검증·전체 업로드 Source | `77359c9779a0a9cb7f505fe4b82b7f97c5ea02be` |
| main의 RDS 복원 안내·정책·SQL 자료 | `b3577d0` |
| P를 고정해 검증·전달하는 main Workflow | `3fdbdebf020f0cfd3dc1fcaf9436e30810d9cbba` |

Lab main과 `codex/week8-rollback-prepare` Branch를 각각 Push했다. 기존 main 검증 Workflow·AWS IAM Trust/Permission·Repository Variables는 변경하지 않았다. 새 수동 Workflow는 main에서 관리하는 고정 Manifest를 읽고 P Source를 별도로 Checkout한다. Source Guard는 기준 Commit과의 계보, 변경 경로 12개, 운영 두 파일과 V8 Test Fixture의 SHA-256을 확인한다.

이 방식에서 main OIDC 조건은 실행 신원을 제한한다. Build할 Source가 자동으로 main이라는 뜻은 아니므로, P Source 고정·Test와 Image의 출처 대조를 별도로 수행한다. 임의 Branch·SHA를 실행 입력으로 받지 않는다. 설계와 재실행 방법은 [Lab의 P 전달 안내](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/blob/main/deploy/rollback/README.md)에 있다.

## 원격 검증 결과

| 검증 | 결과 |
|---|---|
| [main CI 38895311791](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/38895311791) | Java 704개·JavaScript 254개·ESLint·Image Build 성공. Publish는 일반 Push이므로 Skipped |
| [P CI·업로드 38895313033](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/38895313033) | Java 579개·JavaScript 181개·ESLint·Image Build·Publish 성공 |
| Java·JavaScript 결과 | 두 실행 모두 실패·오류/취소·건너뜀 0건 |
| Workflow 문법 | 공식 actionlint 1.7.12의 두 Workflow 검사 통과. 배포 파일은 UTF-8·BOM 없음·LF 확인 |

P 실행은 20:40:20~20:45:23 KST에 진행됐다. Java는 실제 PostgreSQL Testcontainers를 사용했고 P의 V7/V8 호환 Integration Test도 포함한다. CI에서 P를 다시 Build했으므로 앞서 미커밋 상태로 만든 로컬 Image와 ID가 같다고 가정하지 않는다. 로컬 Container·실제 HTTP 결과는 [사전 검증 보고서](./2026-10-16-image-rollback-preflight.md)에 따로 남겼다.

## 업로드한 산출물

| 항목 | 확인값 |
|---|---|
| 기존 Repository | 서울 `ai-helpdesk-learning-lab` |
| Tag | `prepare-git-77359c9779a0a9cb7f505fe4b82b7f97c5ea02be-run-38895313033-attempt-1` |
| ECR Manifest Digest | `sha256:7369d0471d58ed27add9b6a9fc1d9fb28c99e9de7e006620127fd01ecea3933b` |
| CI Local Image ID | `sha256:45901b4713dc400515e3880ad24ba28961e3c3c197f2198ff4ffe226cf133be6` |
| Platform·역할 | linux/amd64·rollback-prepare |
| 운영 Migration | V1~V7만 포함. V8·Test Fixture는 JAR에 없음 |

검증 Job이 Image를 보관 기간 1일의 Artifact로 전달했다. Publish Job은 같은 실행의 Artifact를 받아 ID·P Commit Label·Platform·역할을 확인한 다음 기존 main 전용 Role에 OIDC 인증했다. Publish Job에서는 P 코드를 실행하거나 Image를 다시 Build하지 않았다.

새 Immutable Tag로 한 번 Push하고 ECR `BatchGetImage`의 실제 Manifest Digest를 Push 결과와 대조했다. 기존 Image 삭제·Tag 덮어쓰기 요청은 하지 않았다. Evidence Artifact `prepare-ecr-evidence-38895313033-1`은 7일 보관되며, 다운로드한 JSON의 Source/Workflow Commit·Run/Attempt·Repository·Tag·Digest·역할을 다시 대조했다. 계정 번호·Credential은 이 보고서에 넣지 않는다.

전달용 Artifact의 SHA-256은 `b756269d7746c409b19b6e7684b33f99b23cbb18474d04af04a8e6db3516df0c`이며, 이는 ECR Image Manifest Digest와 다른 값이다. Evidence의 `verifiedImageReused=true`, `productionMigrationMax=7`, `cloudRuntimeVerified=false`를 확인했다. 실제 계정의 URI가 필요한 배포 설정은 기존 Repository에서 확인한 URI와 위 Digest를 조합한다.

## 이번에 변경하지 않은 것과 다음 단계

ECR에 P Image 한 개를 추가했으며 App Task·RDS·ALB·Target·DNS·Secret·IAM은 변경하지 않았다. Cloud DB에 V8을 적용하거나 AI를 호출하지 않았다. P를 Cloud에서 실행하거나 B에서 P로 복귀한 결과도 아니다.

후속 실험에서는 P의 실제 실행·DB/TLS·Target·Session·기존 업무를 확인한 뒤 후속 B 활성화와 B→P 복귀를 준비한다. 먼저 현재 DB 호환성과 Source·Image·실행 명세를 연결하고, 추가 Cloud 실행 범위를 확인한다. 기존 Image·원본 DB·Snapshot은 이번 업로드를 이유로 삭제하지 않는다.

별도 학습은 [DB와 App 서버 복구](../study-docs/database-and-application-recovery.md)에서 재시작·Image Rollback·Snapshot 복원과 Job 재개를 순서대로 읽고 핵심 질문으로 확인할 수 있다.

## 자료 검토 범위

- VERIFIED: P의 고정 Commit·기준과의 변경 경로 12개·운영 두 파일과 V8 Fixture Hash, 선택형 Workflow·Source Guard·Manifest·안전장치 Test, 복원 Policy/SQL/안내의 변경 부분과 새 학습자료를 확인했다.
- VERIFIED: 원격 두 CI의 Job·Test 집계와 다운로드한 ECR Evidence를 확인하고 Source/Workflow Commit·Tag·Digest를 대조했다. Markdown 내부 파일 링크·UTF-8·BOM 없음·LF와 고위험 Secret Literal Pattern 점검도 통과했다.
- PARTIAL: Lab의 긴 README는 관련 Week 8 설정·CI·현재 변경과 개발 규칙을 중심으로 선별했다. 미수정 과거 학습 기록 전체를 새로 감사한 결과는 아니다. main과 P의 전체 회귀 결과는 위 실제 CI로 구분한다.
