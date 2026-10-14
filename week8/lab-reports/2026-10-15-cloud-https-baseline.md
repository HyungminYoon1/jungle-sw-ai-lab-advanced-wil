# ALB·App·DNS 연결과 첫 HTTPS 응답

> 실행일: 2026-10-15 — 10월 14일 학습 회차의 후속 실습
> 상태: ALB 활성·App Task RUNNING·Target Healthy. HTTPS Health 200/UP·로그인 페이지 200·익명 Ticket 조회 401 확인. 로그인 이후의 업무 요청과 Database Row 대조는 미실행

## 목적과 실행 범위

검증한 Helpdesk Image를 같은 Task Definition으로 실행하고, 기존 ACM 인증서·Cloudflare DNS·ALB를 통해 HTTPS로 접근한다. 먼저 AI를 끈 상태에서 연결을 확인한다.

- 서울의 학습용 ALB 한 개, HTTPS 443 Listener 한 개와 IP Target Group 한 개를 사용한다.
- 기존 `helpdesk-learning:1`로 Fargate 단독 Task 한 개를 실행한다. 자원은 `0.25 vCPU·512 MiB`다.
- 기존 Image Source `2e2cc403f73972d5c0f87ab81342b776e7777f6b`와 Manifest Digest `sha256:1ec1ed5b0a4853b87fac7d1ded3937cf961be19f3d6e010608019e7b55cae39b`를 사용한다.
- Provider·Worker·ECS Exec·Service 자동 재실행은 끈다. 새 AI 호출은 하지 않는다.
- App 8080은 ALB Group만, RDS 5432는 기존 App 경로만 허용한다. RDS는 비공개로 유지한다.
- 기존 Image·DNS Record·다른 프로젝트 리소스를 삭제하거나 교체하지 않는다.

첫 DB 인증 실패와 같은 Image의 복구 결과는 [앞선 ECS 기동 보고서](./2026-10-14-ecs-first-cloud-startup.md)에 있다.

## VPC 조회 권한 한 개를 적용했다

ALB 생성에 필요한 `ec2:GetSecurityGroupsForVpc`가 허용되지 않아 앞선 요청은 실패했다. 기존 정책 유지·서울 VPC 전체 조회·학습 VPC 한 개 조회를 비교했고, 승인받은 마지막 안을 Edge Version 4에 적용했다.

Resource는 학습 VPC ARN 한 개이며 MFA·서울·`Project=helpdesk-learning` 조건을 명시했다. 다른 VPC 조회·보안 그룹 규칙 변경·Secret 접근은 추가하지 않았다. 저장 정책은 15개 문장·공백 제외 5,164자로 승인안과 일치했고, 기존 14개 문장과 Version 1~3을 유지했다. 로컬 정책 Test 27개·JavaScript 전체 212개·ESLint 10.11.0은 통과했다. 이 검사와 실제 AWS 생성 결과는 별도로 확인했다.

영향 파일은 Lab의 Edge Template·정책 구조 Test·IAM 안내, ECS 안내와 WIL의 배포 계획·이 보고서다. Java Source·JAR·Image는 변경하지 않았다.

## Wizard 오류와 실제 생성 상태를 구분했다

비Root 배포 사용자로 02:05 KST에 ALB와 HTTPS 443 Listener를 생성했다. 추가 인증서를 등록하는 `AddListenerCertificates`는 거부됐고, Wizard의 자동 삭제도 거부돼 오류 화면이 남았다.

실제 상세 화면에는 ALB와 Listener가 한 개씩 있었고 기본 인증서 `helpdesk.hmyoon.com`이 이미 연결되어 있었다. Listener는 Target Group으로 전달하고 TLS 1.2/1.3 정책을 사용했다. 따라서 추가 인증서·삭제 권한을 넓히거나 생성 버튼을 다시 누르지 않고, 현재 리소스의 연결과 실제 HTTPS 응답을 확인했다.

ALB의 활성 상태와 도메인의 HTTPS 응답을 확인했다. HTTP 80·WAF·CloudFront·Global Accelerator는 추가하지 않았다.

## DNS와 App 대상을 연결했다

Cloudflare의 기존 인증서 검증 CNAME은 그대로 유지했다. 서비스 이름 `helpdesk.hmyoon.com`에는 새 ALB의 DNS 이름을 가리키는 CNAME 한 개를 DNS-only·TTL Auto로 추가했다. DNS-only이므로 이번 HTTPS 연결은 Cloudflare Proxy를 통과하지 않고 ALB로 향한다.

App Task는 기존 Public-a Subnet·App Group 한 개와 공인 IPv4를 사용해 RUNNING이 됐다. ALB의 대상에는 공인 IP가 아니라 Task의 Private IP와 Port 8080을 등록했다. 등록 대상은 한 개이며 `/actuator/health`의 성공 코드 200을 기준으로 Healthy가 됐다. [AWS Health Check](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html)

```text
Browser → helpdesk.hmyoon.com의 DNS 조회 → ALB 주소
Browser → ALB HTTPS 443 → Target Group → App Private IP:8080
App → 기존 Private RDS
```

이번 실행은 ECS Service가 아닌 단독 Task다. Task 교체 시 Private IP가 달라질 수 있어 대상 등록도 다시 확인해야 한다.

## 실제 응답

| 점검 대상 | 수단 | 확인 결과 |
|---|---|---|
| ALB | AWS Console | 활성, HTTPS 443 Listener 한 개·기본 ACM 인증서 연결 |
| App | ECS Console | 기존 명세의 단독 Task RUNNING |
| Target | AWS Console | Private IP:8080 한 개, Healthy |
| HTTPS Health | 실제 Browser | `{"status":"UP"}` 표시, 인증서 경고 우회 없음 |
| HTTPS 로그인 페이지 | 실제 Browser | 빈 로그인 Form 표시. 로그인 제출은 하지 않음 |
| `GET /actuator/health` | 익명 HTTP Client | 200, Health UP, Location Header 없음 |
| `GET /login` | 익명 HTTP Client | 200, 로그인 Form·CSRF Field 존재, Location Header 없음 |
| `GET /api/tickets/1` | 익명 HTTP Client | 401, Location Header 없음 |

내장 브라우저의 보호된 API 주소창 이동은 Client 제한으로 완료하지 못했다. 해당 Status는 별도 HTTP Client가 확인한 결과이며 Browser 로그인 E2E로 기록하지 않는다. Cookie·CSRF·Password와 전체 Header는 출력하지 않았다.

HTTPS 연결과 익명 요청의 거부를 확인했지만, 로그인 성공·Session 복원·Role별 조회·CSRF 포함 접수·업무 Row의 SQL 대조는 아직 하지 않았다. Health UP만으로 AI 처리나 모든 업무 기능의 성공을 판단하지 않는다.

## 현재 실행 비용과 다음 확인

App·ALB·RDS는 실행 중이다. App과 공인 IPv4 한 개는 약 `$0.0192/시간`, ALB와 IPv4 두 개는 약 `$0.0325/시간`이며 ALB LCU가 추가된다. 기존 RDS 실행·Storage·Image·Log·세금·전송 비용은 별개다. 월 3만 원은 상한이며 이 비용을 채우는 목표가 아니다. 단가는 [배포 계획의 비용표](../deployment-plan.md#첫-연결의-비용-예시)를 기준으로 한다.

다음은 실제 Browser의 로그인·Session Cookie 속성·Role·CSRF·접수/조회와 SQL Row를 함께 확인하는 것이다. 전체 AI·자원 관측·재배포·이전 Image 복귀·Snapshot 복원도 Week 8 범위에 남아 있다. 실습 종료 때 Task 중지와 ALB·DB 정리의 정확한 승인 범위를 확인하며, 이번 실행에서 자동 삭제는 하지 않았다.
