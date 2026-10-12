# 배포용 Image의 CPU와 메모리 제한 실험

> 실행일: 2026-10-12 KST
> 결과: AI 비활성 배포 Profile의 독립 실행 2회 통과
> 범위: 로컬 Container·HTTP Client·실제 PostgreSQL, Browser·Fargate 미실행

## 같은 Image에 실행 자원 제한 적용

배포 사용자 Configuration을 포함한 `helpdesk:week8-deployment-da1d687`를 그대로 사용했다. Image ID는 [앞선 Build 보고서](./2026-10-12-deployment-image-and-ecs-draft.md)와 같으며 재Build하지 않았다. 기존 Compose 검증의 HTTP·DB 확인을 재사용하고 App만 `postgres,deployment`로 바꾸는 Override를 추가했다.

```powershell
pwsh -NoProfile -File .\scripts\Verify-Week8Compose.ps1 -DeploymentResourceProbe -ImageTag helpdesk:week8-deployment-da1d687 -CpuLimit 0.25 -MemoryMiB 512 -QueryCount 30
```

실행마다 새 Project·합성 USER/AGENT·새 DB Volume을 사용했다. App의 CPU를 `0.25`, 메모리를 `512 MiB`로 제한하고 Swap은 막았다. Docker의 Memory·MemorySwap·NanoCpus와 cgroup의 Memory·Swap 상한이 실제로 적용됐는지 대조했다. PostgreSQL Container의 메모리는 이 App 상한에 포함하지 않는다.

AI Provider·Worker는 모두 껐다. 외부 AI Key를 전달하거나 유료 요청을 하지 않았으며, AWS 리소스도 생성하지 않았다. 로컬 HTTP 실험이므로 ECS Secret 전달·RDS TLS·ALB HTTPS 설정은 별도 단계다.

## 두 번의 측정 결과

| 항목 | 첫 실행 | 두 번째 실행 |
|---|---:|---:|
| App Container 시작부터 Login Page 준비 | 34.73초 | 37.63초 |
| 조회 전 전체 메모리 | 312.17 MiB | 210.98 MiB |
| 조회 후 전체 메모리 | 308.17 MiB | 211.41 MiB |
| 기동부터 측정 종료까지 최고 메모리 | 312.42 MiB | 211.43 MiB |
| OOM / OOM Kill | 0 / 0 | 0 / 0 |
| 순차 Ticket 조회 | 30 / 30 성공 | 30 / 30 성공 |
| 조회 p95 | 87.68 ms | 92.33 ms |
| 조회 최대 시간 | 89.00 ms | 92.40 ms |
| 조회 구간 CPU 제한 대기 Period | 9 | 10 |

메모리는 cgroup v2의 `memory.current`·`memory.peak`에서 읽었다. Heap뿐 아니라 파일 Cache·Native 영역과 잠깐 실행한 측정 Process도 포함한다. 최고치 두 값의 차이를 특정 원인의 효과로 단정하거나 평균값만으로 상한을 정하지 않는다. p95는 각 실행의 순차 조회 30개에 대한 nearest-rank 값이며 동시 부하나 실제 Cloud 성능의 기준값은 아니다.

CPU 제한 대기 Counter는 있었지만 요청은 모두 성공했다. 메모리 부족과 CPU 실행 대기를 구분하고 실제 응답·소요 시간을 함께 읽는다. 두 실행이 끝날 때 App은 계속 실행 중이었다. [Docker 자원 제한](https://docs.docker.com/engine/containers/resource_constraints/), [Linux Counter](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html)

## 접수와 저장도 함께 확인

두 실행 모두 Migration 7건과 App의 비관리자 DB 계정 연결을 확인했다. DB는 Host Port에 게시하지 않고 App만 Loopback의 임의 Port를 사용했다.

- 익명 Ticket 조회 `401`, USER 조회 `403`, AGENT 조회 `200`.
- 로그인 Session·CSRF를 사용한 접수 `201`, CSRF 없는 접수 `403`.
- 차단 요청 직후 Ticket·Message·Job 합계 0건, 정상 접수 뒤 각 1건.
- 원문·인증된 작성자 보존, Ticket `OPEN`, Job `PENDING`, Attempt·생성 예약·Suggestion 0건.
- 합성 Password·관찰한 Session/CSRF 값과 일치하는 Log 출력 0건.

마지막 Log 확인은 관찰한 값을 대상으로 한 검사이며 모든 민감 정보의 비노출을 포괄하지 않는다. Cookie·Token·Password·전체 설정·응답 Body는 출력하지 않았다. 해당 Project의 Container만 종료하고 DB Volume을 보존했으며 변경한 Process Environment를 복원했다.

## 도구 검증과 첫 사양 후보

새 Source·구성 보호 Test 6개를 포함한 JavaScript 전체 158개와 ESLint가 통과했다. PowerShell 문법 검사와 Counter Parser의 정상 합성 입력 1개·거부 입력 4개도 확인했다. Parser 확인은 Docker를 호출하지 않은 별도 검사다.

선택 옵션 없이 기존 `Verify-Week8Compose.ps1`도 다시 실행해 통과했다. 이 실행은 기존 기준선 Image와 `postgres,local-browser`를 사용하며 자원 측정이 아니다. Migration·접수 `201`·Role·CSRF·DB Row와 종료 후 환경 복원을 확인해 새 선택 기능을 추가한 뒤에도 기존 기본 흐름이 유지되는지 점검했다. 세 실행에서 만든 Container는 모두 중지했고 Volume은 삭제하지 않았다.

`0.25 vCPU·512 MiB`를 AI 비활성 첫 Cloud 연결의 최소 후보로 둔다. Fargate의 지원 조합이지만, 로컬 실행 통과가 Fargate 실행 성공을 대신하지는 않는다. [AWS 지원 조합](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size)

개인정보 처리기·Provider·Worker를 켠 전체 흐름, 동시 요청·장시간 사용과 Cloud Health·기동 시간을 다시 측정한다. Task Definition의 자리표시자는 전체 구성·총비용·생성 범위를 확인한 뒤 채운다. 전체 Java 회귀·ECR 업로드·Git Push는 이번 실험에서 하지 않았다.

- [실행 메모리와 CPU 학습자료](../study-docs/image-publishing-and-ecs-execution.md#실행-메모리와-cpu를-측정하기)
- [배포 계획](../deployment-plan.md)
