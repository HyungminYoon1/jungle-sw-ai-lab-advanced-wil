# 배포용 Image Build와 ECS 실행 명세 초안

> 실행일: 2026-10-12 KST
> 결과: 로컬 Image Build·JAR 확인, JavaScript 전체 152개 통과
> Cloud 상태: ECR 업로드·Task Definition 등록·ECS 실행 미수행

## 변경 Source로 새 Image 만들기

배포용 Java Configuration을 포함한 Commit `da1d687040cd14351409255d82a4aa99ef1ce34a`의 깨끗한 작업 트리에서 Build했다. Key 값만 교체하는 경우와 달리 새 코드가 필요하므로 JAR·Image를 다시 만들었다.

```powershell
docker build --platform linux/amd64 --label org.opencontainers.image.revision=da1d687040cd14351409255d82a4aa99ef1ce34a --tag helpdesk:week8-deployment-da1d687 .
```

POM·Wrapper 복사와 `dependency:go-offline`은 Cache를 재사용했다. Source 복사와 `-DskipTests package`는 다시 실행됐고 `BUILD SUCCESS`였다. 패키징 단계는 Test를 생략하며, 앞선 Focused Java Test 72개와 구분한다.

| 확인 항목 | 결과 |
|---|---|
| Local Image ID | `sha256:98c7ccee900a4979af156f3b2df7a84c86a5f3d226122868b1b0dc7f48c68a79` |
| Platform | `linux/amd64` |
| Source Label | Build한 Commit과 일치 |
| 표시 Size | 631,868,561 bytes, 약 602.6 MiB |
| 실행 사용자 | 기존 비Root 설정 유지 |
| Main의 배포 사용자 Class | JAR 안에 존재 |
| Main의 Local 사용자 Class | JAR 안에 존재, Profile로 등록을 구분 |
| Test Class | Main 패키지에 0개 |

네트워크 없는 임시 Container를 생성하되 시작하지 않고 JAR만 복사해 Class Entry를 확인했다. 임시 Container·JAR는 정리했고 Image는 보관했다. JVM·DB·Worker는 이 검사에서 실행하지 않았다. 표시 Size는 Image 파일 계층의 크기이며 JVM 실행 메모리나 ECR의 실제 과금 보관량으로 그대로 사용하지 않는다. Local ID도 ECR의 검증된 Manifest Digest로 대체하지 않는다.

## 첫 Cloud 연결의 명세

Lab의 `deploy/ecs/task-definition.template.json`과 안내를 추가했다. 초기 접수 검증은 `postgres,deployment`와 AI Provider·Worker 비활성으로 진행한다. 비밀값은 일반 Environment나 Image에 넣지 않고 `secrets.valueFrom`의 참조로 구분한다.

CPU·Memory·검증 ECR URI와 Digest·Execution Role·TLS JDBC URL·Secret·Log Group은 자리표시자로 남겼다. 여섯 Credential 참조가 유료 Secret 여섯 개라는 뜻은 아니다. Secret 저장 방식·수량·최소 권한·CPU·메모리는 비용과 실행 측정 뒤 확정한다. 실제 값의 로컬 복사본은 Lab의 Git 제외 경로 `local/deployment/`에서 관리한다.

Forwarded Header·Secure/HttpOnly/SameSite Cookie는 실행 설정 후보이며 실제 Binding·ALB·Browser 검증은 후속 단계다. RDS CA 신뢰 설정도 아직 준비 전이다. Task Definition 밖의 Service·Subnet·Security Group·ALB·ACM·DNS가 함께 필요하다.

## 구조 Test 결과

```powershell
node --test src/test/js/*.test.mjs
```

새 ECS 초안 Test 6개를 포함한 JavaScript 전체 152개가 통과했다. 실패·건너뜀·취소 0개다. 새 Case는 Fargate·Network·Port, Profile·AI 비활성, Credential 참조, Cookie 설정 JSON과 미확정 값·Log 조건을 검사한다. AWS의 전체 Schema 검증이나 실제 리소스·Secret 접근 검증은 아니다.

최초 ESLint에서는 새 Test의 전역 `URL` 참조가 `no-undef`로 거부됐다. 기존 Lint 규칙을 넓히는 대신 `node:url`에서 명시적으로 import하도록 고쳤다. 수정 뒤 JavaScript 전체 152개와 전체 ESLint가 통과했다. ECR 업로드·AWS 리소스 생성·외부 AI 호출·Git Push는 하지 않았다.

- [사용자 구성과 접수 Test](./2026-10-12-deployment-users-and-receipt-tests.md)
- [Image와 ECS 학습자료](../study-docs/image-publishing-and-ecs-execution.md)
- [배포 구성 결정](../deployment-plan.md)
