# 2026-10-15 HTTPS 업무 요청과 Cloud 관측·복구

> 학습 회차: 10월 15일. 자정 이후 진행한 권한 변경도 이 회차에 포함하고, 실제 실행일은 보고서에 구분했다. 남은 학습과 실습은 10월 16일에 이어간다.

오늘은 HTTPS로 접속한 Helpdesk에서 로그인·Session·CSRF와 문의 저장을 확인했다. 이어서 CloudWatch의 Log·Metric을 읽고, App 교체와 DB 복원의 차이를 정리했다. Codex와 필요한 권한·설정을 점검했고, 로그인·MFA·암호 입력은 내가 직접 했다.

## 로그인 성공과 로그인 뒤에 열린 페이지는 다르다

로그인 뒤 `/`에서 `404`가 나와 처음에는 로그인이 안 된 것처럼 보였다. 하지만 `/`에 화면이나 API가 없다는 것과 인증 실패는 다른 문제였다. 이후 로그인 Session으로 `GET /api/csrf`가 `200`을 반환하는 것을 확인했다.

로그인 성공 여부는 Redirect의 최종 화면만 보지 않고, 인증이 필요한 요청의 결과로 확인해야 한다. 같은 이유로 USER가 AGENT 전용 Ticket 조회에서 `403`을 받았다고 로그인 실패로 판단하지 않는다. 인증과 해당 요청에 대한 인가는 별개다.

## Session Cookie와 CSRF Header의 역할

Browser는 Cookie에 담긴 Session ID를 보내고, 서버는 그 ID로 HttpSession의 인증 정보를 복원한다. CSRF Header는 Browser가 알아서 만드는 것이 아니라 JavaScript가 서버에서 받은 Header 이름과 Token을 사용해 추가한다.

실제 Session Cookie의 `Secure`·`HttpOnly`가 켜져 있고 `SameSite=Lax`인 것을 확인했다.

| 설정 | 의미 |
|---|---|
| `Secure` | Cookie를 HTTPS 요청으로 전송하도록 제한 |
| `HttpOnly` | JavaScript의 Cookie 직접 읽기를 제한. Browser의 자동 전송은 유지 |
| `SameSite=Lax` | Cross-site 전송을 제한하는 정책. 상태 변경 요청의 CSRF 검증과는 별도 |

Cloudflare의 `cf_clearance`는 Helpdesk의 로그인 Session을 나타내는 Cookie가 아니다. Cookie가 있다는 사실만 보지 않고 어떤 Cookie인지 구분해야 한다. 값은 기록하지 않았다.

같은 로그인 Session으로 CSRF Header 없이 보낸 `POST /api/tickets`는 `403`, Token을 붙인 요청은 `201`이었다. **같은 Origin이어도 Session Cookie가 자동 전송되므로 CSRF 검증은 필요하다.**

## 접수 성공과 AI 처리 성공을 나누어 확인했다

정상 접수 뒤에는 HTTP `201`과 Location Header뿐 아니라 PostgreSQL의 Row도 확인했다. 조회한 문의에는 Ticket·최초 Message·AI Job이 있었고 원문 보존 여부도 참이었다.

```text
Ticket: OPEN
Job: PENDING
current_attempt: 0
reserved_generation_count: 0
예약 Row: 0건
Suggestion Row: 0건
```

현재 Cloud 설정은 Provider·Worker가 모두 꺼져 있다. 따라서 문의는 접수됐지만 AI 작업은 아직 시작되지 않은 상태다. `PENDING`을 문의 저장 실패나 AI 처리 완료로 해석하지 않는다.

## SELECT는 Commit 전에 실행 결과를 돌려준다

CloudShell에서 읽기 전용 Transaction을 열고 SELECT를 실행했더니, Commit 전부터 결과가 표시됐다. 내가 헷갈린 것은 **SQL의 실행 시점과 쓰기 결과의 확정 시점**이었다.

SELECT는 호출했을 때 실행되어 현재 Transaction에서 볼 수 있는 데이터를 반환한다. Commit은 앞의 SELECT를 그때 시작하라는 명령이 아니다. 이번 읽기 전용 Transaction에서는 조회를 마치고 Transaction을 종료했다.

INSERT도 Commit 전에 실행되며 같은 Transaction 안에서 그 Row를 조회할 수 있다. 다만 이후 Rollback하면 그 Transaction의 INSERT는 DB에 남지 않는다. 화면에 결과가 보였다는 사실과 Commit으로 저장이 확정됐다는 사실을 구분한다.

## CloudShell의 파일과 TLS 검증

CloudShell VPC 환경이 종료되자 임시 CA 파일과 Shell 변수를 이전처럼 사용할 수 없었다. 변수 값이 비어 있으면 인증서 경로가 의도와 다르게 만들어질 수도 있었다.

`CA_FILE_MISSING`이나 인증서 파일 없음은 먼저 Client의 파일·경로 준비 문제로 확인한다. CA 파일을 준비하고 나서 나온 PostgreSQL의 Password 인증 실패와는 발생 단계가 다르다. 연결을 서두르려고 `verify-full`을 끄는 대신 접속 스크립트로 CA 취득·검증·경로 준비를 다시 수행하도록 했다.

접속에 사용하는 것은 App DB 계정의 암호다. AWS deployer 암호·RDS 마스터 암호·Helpdesk 로그인 암호와 혼동하지 않는다. 암호 자체는 명령어·문서에 넣지 않는다.

## DNS와 Task의 주소를 구분한다

Cloudflare를 DNS로 그대로 사용해도 ALB와 ACM을 연결할 수 있다. 현재 서비스 CNAME은 ALB의 주소를 가리킨다. 같은 ALB를 유지한 채 App Task만 교체한다면 CNAME을 바꿀 이유는 없다.

대신 새 Task의 Private IP와 App Port를 Target Group에서 확인해야 한다. DNS가 ALB를 찾는 일과 ALB가 실제 App을 찾는 일은 서로 다른 연결이다.

학습자 `/32` 제한에 쓰는 IP는 보통 `ipconfig`에 보이는 PC의 사설 IP가 아니라 AWS에서 보이는 출발 공인 IPv4다. 접속하는 Network가 바뀌어 공인 IP가 달라지면 기존 제한에 걸릴 수 있다.

## HTTP Redirect가 할 수 있는 일

HTTP Listener가 있어도 Security Group에서 80 Port를 막으면 요청은 Listener에 도달하지 못한다. 이번에는 기존 HTTPS와 같은 학습자 IP 범위에만 80을 허용하고, ALB가 HTTPS로 `301` Redirect하는 것을 확인했다.

Redirect는 이후 HTTPS 주소로 다시 접속하게 하는 동작이다. 처음 HTTP 요청에 이미 실어 보낸 비밀번호까지 소급해 암호화하지는 못한다. 로그인 정보는 처음부터 HTTPS로 보내야 한다.

## Log와 Metric은 서로 다른 근거다

기동 Log는 개별 사건의 기록이고 Metric은 시간 범위와 집계 방식에 따른 수치다. 현재 Task의 기동이 오래전이라면 최근 1시간에 기동 Log가 없는 것이 자연스럽다. 기간을 늘려 실제 `Started HelpdeskApplication` Event를 확인했다.

ALB Monitoring은 처음에 `cloudwatch:GetMetricData` 권한이 없어 그래프를 읽지 못했다. App이 멈춘 것이 아니라 **화면을 읽는 배포 사용자의 조회 권한 문제**였다. 필요한 조회 한 개를 추가한 뒤 같은 사용자로 요청·대상 응답시간·Target 4xx 그래프를 확인했다.

- Target 4xx는 App이 반환한 4xx 집계다. 익명 요청을 계약대로 차단한 `401`도 포함될 수 있다.
- ELB 오류는 ALB가 직접 만든 응답과 연결해 확인한다.
- 데이터 없음 표시는 실제 값 `0`과 다르다.
- 1분 간격·합계의 한 점은 그 1분의 집계이지 전체 3시간의 총합이 아니다.
- HTTP 응답시간과 응답 뒤에 진행하는 AI Job의 처리 시간은 별개다.

Request ID Header가 있다고 그 값이 자동으로 Log에도 저장되는 것은 아니다. 요청과 비동기 Job을 추적하려면 실제 Log에 어떤 식별자를 남기는지 확인해야 한다.

## 개인정보 형식 검사와 탐지 정확도는 다르다

검사기가 올바른 JSON·위치 목록을 반환해도 실제 개인정보를 빠짐없이 찾았다는 뜻은 아니다. Java의 위치 검증·치환 Test와 실제 탐지 모델의 품질 평가를 나누어 보았다. 실제 한국어 NER 후보는 합성 12건 중 7건만 통과해 채택을 보류했다.

불필요한 실명은 가리되 누가 누구와 어떤 관계인지, 몇 명이 영향을 받았는지, 마감이 언제인지는 보존하는 방향으로 정했다. 여러 사람을 전부 같은 `[PERSON]`으로 바꾸면 문의의 의미가 달라질 수 있다.

`이메일`처럼 일반명사와 이름으로 해석할 수 있는 표현은 문맥이 불분명하면 일반명사로 해석한다. 그렇다고 그 문자열을 항상 탐지에서 제외하는 예외 목록을 만드는 것은 아니다. 문맥상 명확한 실명인 경우와 구분해야 한다.

검사 Timeout·잘못된 결과는 외부 전송을 중단하는 실패이고, 유효한 결과의 해석이 모호한 경우와 다르다. 실패 기록도 Transaction이 Commit되어야 DB에 남는다. 이미 접수한 원문은 유지한다. 관계 보존 정책과 실제 모델·실행 Adapter 구현은 아직 같은 완료 상태가 아니다.

## App 교체와 DB 복원은 다르다

이전 Image로 돌아가는 것은 그 프로그램으로 새 JVM을 실행하는 일이다. 같은 RDS를 사용한다면 새 버전에서 이미 Commit한 문의는 남는다. 이전 Image를 실행해도 삭제한 DB Column이 자동으로 복구되지는 않는다. 이전 코드가 현재 Schema와 호환되는지도 확인해야 한다.

App 교체에서는 ALB의 새 요청 유입을 먼저 멈추고 진행 중 연결이 정리되기를 기다린다. 이 과정이 Draining이다. Target 등록 해제는 App 종료가 아니며, App 종료도 Target Group·RDS 삭제와는 별개다.

첫 실습은 같은 Image·명세·RDS의 Task 교체로 정했다. 이전 Image로 되돌리는 Rollback은 그다음 별도 실험이다. 등록 해제 권한과 정책 보관까지 준비했지만, 실제 Draining·Task 교체·재로그인 검증은 아직 하지 않았다.

## 핵심 질문

1. 로그인 뒤 `/`에서 404가 나와도 인증 실패로 바로 판단할 수 없는 이유는 무엇인가?
2. `HttpOnly`는 JavaScript의 읽기와 Browser의 Cookie 전송 중 무엇을 제한하는가?
3. 같은 로그인 Session으로 보낸 POST가 CSRF Header 유무에 따라 403·201로 달라지는 이유는 무엇인가?
4. 접수한 Job이 `PENDING`·예약 0건일 때 문의 저장과 AI 처리에 대해 각각 무엇을 확인한 것인가?
5. SELECT 결과가 Commit 전에 보여도 되는 이유는 무엇인가? 같은 Transaction의 INSERT를 Rollback하면 어떻게 되는가?
6. CA 파일 없음·DB Password 거부·Security Group 차단은 왜 같은 접속 실패가 아닌가?
7. 같은 ALB를 두고 Task만 바꿀 때 DNS와 Target 등록에서 각각 무엇을 유지·갱신하는가?
8. HTTP 301은 왜 이미 HTTP로 전송한 비밀번호를 보호하지 못하는가?
9. Log Event·Target 4xx·데이터 없음·AI 처리 지연은 각각 어떤 질문에 답하는가?
10. 탐지 결과 JSON과 위치가 올바르다는 것만으로 개인정보를 정확히 찾았다고 할 수 있는가?
11. 사람 이름을 가리는 것과 사람 간 관계·업무 사실을 보존하는 것을 어떻게 함께 만족시킬 것인가?
12. App을 이전 Image로 되돌려도 이미 Commit한 문의와 삭제된 Column이 자동으로 되돌아가지 않는 이유는 무엇인가?

## 다음에 이어갈 내용

당초에는 AGENT의 기준 조회 뒤 Task 교체를 진행하기로 했다. 이후 비용 중지 요청으로 기존 Target과 App을 중지하고 RDS 중지를 요청했으므로, 재개 때 RDS·새 Task·Target 연결을 먼저 복구하고 재로그인한다. 현재 Browser Session이 이미 인증되지 않았던 결과를 교체에 따른 Session 소실로 잘못 기록하지 않는다. 실제 상태는 [리소스 중지 기록](../lab-reports/2026-10-16-learning-resource-pause.md)과 구분한다.

이어 정식 Task 교체·Session 비교, 이전 정상 Image 복귀·별도 Snapshot 복원, 남은 관측·전체 AI 조립과 Cloud 검증·Route 53 실습·최종 회귀와 WIL을 진행한다. 학습 범위는 줄이지 않는다. App·RDS 중지와 별개로 ALB·저장 공간·Log 등의 비용은 남는다.

실행 근거는 [HTTPS 접수와 실제 DB Row](../lab-reports/2026-10-15-cloud-session-csrf-and-postgres.md), [HTTP Redirect](../lab-reports/2026-10-15-alb-http-https-redirect.md), [Cloud 관측](../lab-reports/2026-10-15-cloud-observability-baseline.md), [개인정보 실패 기록](../lab-reports/2026-10-15-privacy-scan-failure-persistence.md), [실제 NER 평가](../lab-reports/2026-10-15-korean-privacy-ner-probe.md), [Task 교체 준비](../lab-reports/2026-10-16-cloud-task-replacement.md)에 구분해 정리했다.
