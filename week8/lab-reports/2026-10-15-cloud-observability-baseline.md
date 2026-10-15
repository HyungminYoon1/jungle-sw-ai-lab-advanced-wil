# 실제 Cloud의 기동 Log와 HTTP 응답 관찰

> 확인일: 2026-10-15, 최초 관찰 약 22:18~22:28 KST·권한 적용 및 재검증 23:18~23:23 KST
> 범위: 기존 리소스 관찰, 별도 승인한 Edge Metric 조회 권한 한 개 추가
> 상태: 현재 Task·기동 Log·HTTP 기본 응답과 ALB 요청·응답시간·Target 4xx 그래프 확인

## 먼저 확인한 현재 상태

helpdesk-deployer로 로그인한 서울 Console에서 학습용 Cluster의 Service 0개·Running Task 1개·Pending 0개를 확인했다. 단독 Task는 기존 `helpdesk-learning:1`, Fargate 0.25 vCPU·512 MiB로 실행 중이었다. 새 Task·Service·Image·관측 리소스를 만들거나 중지하지 않았다.

동일 시점의 익명 HTTPS 요청에서는 다음 결과를 확인했다. 응답 Body 전체·Header 전체·Cookie·Token은 출력하지 않았다.

| 요청 | 확인 결과 | 해석 범위 |
|---|---|---|
| `GET /actuator/health` | `200`, JSON `status=UP` | 해당 시점의 Health 결과. 전체 업무·AI 성공과 구분 |
| `GET /api/tickets/1` | `401` | 익명의 보호 API 접근 거부 |
| `GET /actuator/metrics/http.server.requests` | `401` | 익명의 관리 Metric 접근 거부 |

첫 진단에서 PowerShell 응답의 `Content`가 문자열이 아닌 `Byte[]`여서 JSON 해석이 실패했다. 그 결과를 App의 Health DOWN으로 판정하지 않았다. UTF-8로 해석한 뒤 JSON의 허용된 상태만 다시 확인해 `UP`을 확인했다.

Health 응답에는 Request ID Header가 있었지만 두 익명 `401`에는 없었다. 이는 관찰한 Header의 차이다. 해당 차이만으로 App 중단이나 ALB 오류를 결론 내리지 않는다. 로컬 Source의 `RequestIdFilter`는 Attribute·Header를 설정하며 그 자체에 요청 Log 출력은 없다. CloudWatch에서 이 Header의 Request ID까지 추적했다고 기록하지 않는다.

## 현재 Task의 기동 Log

ECS의 현재 Task에서 Log 탭을 열었다. 기본 최근 1시간에는 Log가 없었으나 Task 기동은 약 20시간 전이었다. 조회 범위를 최근 1일로 넓힌 뒤 `"Started HelpdeskApplication"`을 검색했다.

검색 결과에 실제 Log Event 1건과 기동 완료 문구가 표시되는 것을 확인했다. 검색창에 입력한 문자열만을 근거로 삼지 않았으며, 결과 Event와 현재 Task의 Stream을 확인했다. 원문·Provider 응답·Secret을 찾아 읽는 검색은 하지 않았다.

이 결과는 현재 Task의 기동 기록과 CloudWatch Log 전달·조회 경로를 확인한 것이다. 요청마다 Log가 생성되거나, Request ID와 비동기 Job이 연결되거나, 현재 AI가 성공했다는 근거는 아니다.

## ALB Metric의 실제 조회 거부

기존 학습용 ALB 한 개가 Active인 것을 확인하고 Monitoring 탭을 열었다. 대상 응답 시간·요청 그래프에서 다음 Action의 허용 정책이 없다는 오류가 표시됐다.

```text
cloudwatch:GetMetricData
no identity-based policy allows the action
```

따라서 이번에는 요청 수·오류 수·응답시간의 실제 Metric 값을 확인하지 못했다. 빈 그래프를 `0`으로 기록하거나 App 중단으로 해석하지 않는다. ECS의 Log Event 조회 권한과 CloudWatch Metric 조회 권한도 별개다.

### 최초 관찰 뒤 제시한 조치안

- 조회 주체는 helpdesk-deployer다. ECR·Parameter·Log 전달용 Execution Role이나 App의 Task Role을 수정할 사안이 아니다.
- 우선 확인된 누락 Action `cloudwatch:GetMetricData` 한 개의 읽기 허용을 검토한다. MFA·서울 Region 조건을 유지하며 다른 작업·정책·Secret·리소스 변경은 포함하지 않는다.
- 일반 CloudWatch Metric 조회는 특정 ALB 한 개의 ARN으로만 제한할 수 있다고 약속하지 않는다. AWS는 `GetMetricData`를 특정 Metric으로 제한할 수 없다고 설명한다. 허용한다면 같은 계정·서울 Region의 다른 프로젝트 Metric도 조회할 수 있는 범위를 명시해야 한다. [AWS의 조회 권한 범위 설명](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch-dashboard-sharing.html)
- 최초 관찰에서는 Root 로그인·권한 추가를 하지 않았다. 별도 승인을 받은 후 아래 범위만 적용했으며 기존 Foundation의 MFA·서울 제한, App·RDS·ALB·DNS·Image는 유지했다.

### 승인한 한 문장 적용과 배포 사용자 재검증

현 권한 유지·넓은 조회 정책·확인한 Action 한 개 추가 중 마지막 안을 승인받았다. Root 로그인·MFA는 작성자가 직접 완료했다. 기존 Edge 기본 Version 4의 전체 JSON이 Repository의 15개 문장과 일치하는 것을 확인한 뒤, `ReadSeoulMetricData` 한 문장에 `cloudwatch:GetMetricData`만 추가했다. `Resource: "*"`에 MFA `true`와 서울 `ap-northeast-2` 조건을 명시했다. 다른 프로젝트 Metric도 조회 가능하다는 범위는 숨기지 않되, 실제 관찰 대상은 학습 ALB 한 개로 유지했다.

23:18 KST에 Version 5를 기본값으로 저장했다. 저장 후 전체 JSON이 승인안과 정확히 일치했고 기존 15개 문장과 Version 1~4는 보존됐다. 적용본은 16개 문장·공백 제외 5,379자이며 AWS 편집기의 보안·오류·경고·추천은 모두 0이었다. 로컬 정책 Test 28개·JavaScript 전체 233개·ESLint 10.11.0도 통과했다. 운영 Java·Image·원격 CI는 이번 변경에서 재검증하지 않았다.

Root 로그아웃 뒤 작성자가 `helpdesk-deployer`로 로그인·MFA를 완료했다. 같은 ALB Monitoring을 다시 열어 다음 결과를 확인했다.

| 관찰 | 결과와 해석 |
|---|---|
| 조회 주체·Region | helpdesk-deployer·서울 |
| 표시 기간 | 최근 3시간·UTC 시간대. 요청 확대 화면은 1분 간격·합계 |
| 요청·대상 응답시간 | 실제 데이터가 있는 그래프 표시, 기존 GetMetricData 거부 사라짐 |
| Target 4xx | 실제 데이터 표시. App이 반환한 4xx 집계이며 개별 URI·Status 식별은 아님 |
| ELB 4xx·5xx | 해당 기간에 사용 가능한 데이터 없음. 정확한 0건으로 기록하지 않음 |

요청 그래프의 합계를 현재까지의 전체 요청 수로 확장하거나, 모든 Target 4xx를 방금 보낸 익명 401이라고 단정하지 않았다. 대상 응답시간도 Browser 전체 표시 시간이나 비동기 AI 처리 시간과 다르다. 새 Dashboard·Alarm·유료 관측 기능은 만들지 않았다. 학습 중인 권한·관측과 App의 배포 설정을 분리했다.

변경 파일은 Lab의 Edge Template·정책 Test·IAM 안내와 이 보고서·주간 계획·관측 학습자료다. Foundation·Runtime·다른 IAM 정책, App·RDS·ALB·DNS·Secret·Image는 변경하지 않았다. 다음 검토는 App Metric과 요청 조건의 대조, 별도 실행 승인을 전제로 한 재배포·복구다.

## 이번에 보완한 정책·자료

[실명 최소화와 인물 관계 정책](../../plan/decisions/0003-contextual-person-masking.md)을 기록했다. 이름/일반명사가 모호하면 일반명사로 해석하되, 문자열을 무조건 제외하는 예외 목록으로 구현하지 않는다. 검사 Timeout·JSON 오류는 이 의미 판단 정책과 구분하며 기존 전송 중단 계약을 유지한다.

현재 단일 PERSON Placeholder와 4필드 범위 계약에는 관계 보존 구현이 없다. 정책 문서를 보완했지만 Java·모델·Dataset·Scanner JSON을 바꾼 것은 아니다. 기존 Test 수와 모델 평가를 새 정책의 검증 결과로 바꾸지 않는다.

[배포 관측 자료](../study-docs/deployment-observability-and-recovery.md)에는 Task/Stream·시간 범위·실제 Event·응답 생성 계층·Metric 집계 범위를 차례로 확인하는 절차를 보완했다.

## 남은 검증

- ALB의 기간·Statistic과 App Metric을 대조해 집계 범위를 설명하기. ALB 그래프 조회는 위와 같이 확인했으며 데이터 없음과 0을 구분한다.
- AGENT로 인증한 App Metric 조회. 익명 `401` 확인과 구분한다. 내장 브라우저의 보호된 Metric URL 이동은 Client에서 차단돼 해당 화면 조회를 완료하지 못했다.
- 필요한 경우 비밀값 없는 요청 Log·비동기 Job 상관관계 구현과 실제 관찰. Header 존재만으로 완료 처리하지 않는다.
- 실제 AI 입력 처리·전체 Worker/Provider 조립과 Cloud 실행, 중단·재배포·Rollback·Snapshot 복원 및 마감.

이번 단계에서는 승인한 Edge 조회 문장 한 개 이외의 IAM 변경, Ticket 접수·SQL 쓰기·Provider 호출·Image Build/Push·RDS Migration·새 과금 리소스 생성·Network/DNS 변경·Git Commit/Push를 하지 않았다. 기존 Task와 ALB는 계속 존재하므로 학습 종료 시 비용과 중지·보관 범위를 별도로 확인해야 한다.

## 검토 범위

현재 ECS·ALB 화면, 지정 Task의 기동 Log, 익명 HTTPS 응답과 관련 `RequestIdFilter`·Security·Health/Metric 설정을 확인했다. Edge의 변경 전·후 저장 JSON 전체를 대조하고 배포 사용자의 ALB 그래프까지 확인했다. 모든 실제 IAM 정책의 재감사나 전체 배포 완료 검증은 아니다.
