# 10월 21일 DNS 조회와 최신 Snapshot 복원

> 상태: 10/21 회차 마감. Cloud 성공·실패 관측, Route 53 조회 비교와 최신 Snapshot 복원을 확인했다. 연장 작업인 임시 DB 삭제·보존 확인은 실제 10/22 KST에 완료했다. 최종 복습·회귀 정리·장기 보관 결정·WIL은 10/22에 이어간다.

## 오늘까지 확인한 흐름

10/20에 시작해 자정 이후 실행한 실제 Cloud AI 처리는 [20일 학습노트](./2026-10-20-study-questions.md)에 남겼다. 고정 합성 문의 한 건의 접수·Worker·실제 AI·제안 저장·AGENT 조회와 AI 비활성 `:6` 복귀를 마쳤다. 오늘은 그 저장 결과를 다시 조회하고 DNS·관측·최신 백업을 확인했다. 개인정보 모델 고도화·인물 관계 V2는 계속 후속 과업이다.

| 확인한 내용 | 결과 |
|---|---|
| 기존 문의와 제안 조회 | Job 1·2는 ADAPTER_CONFIGURATION_ERROR로 FAILED, Job 5는 SUCCEEDED. 제안은 ACCOUNT·UNDETERMINED·PENDING_REVIEW |
| Cloud Log | Job 1·2의 FAILED와 Job 5의 STORED, 각각 jobId·attempt 1·Tick 경과 시간 확인 |
| Route 53 | 별도 Zone과 TXT·Alias A 생성, 생성 권한 회수, 직접 조회 성공과 일반 조회 NXDOMAIN 비교 |
| 최신 백업 | App 중지 뒤 새 Snapshot 생성, 별도 Private DB 복원과 실제 SQL 대조 |
| 데이터 보존 | 일곱 Table의 건수·Hash와 관계·Migration·Sequence 일치. 문의 5건·AI 제안 1건 포함 |
| 임시 DB 정리 | 실제 10/22 최종 승인 후 임시 DB 한 개만 삭제. 원본 DB와 두 수동 Snapshot 유지 |

이번 DNS·최신 복원·정리 과정에서는 AI를 추가 호출하지 않았다.

## 비용과 보관을 이해한 내용

DB를 중지하면 모든 비용이 없어지는 것은 아니며 Storage·Backup 보관 비용은 남는다. 20 GiB는 할당한 DB Storage다. Snapshot이 증분 방식이므로 Snapshot 개수에 20 GiB를 곱해 실제 저장량을 계산할 수 없다고 답했다.

RDS는 중지 후 7일이 지나면 자동 재시작하므로 한 번 Stop한 상태를 장기 보관 방법으로 삼을 수 없다고 답했다. 필요한 Snapshot·Image·Log·설정 보관과 실행 리소스의 유지는 따로 결정해야 한다. 실제 월간 비용은 접근 거부로 미확인이며, 조회 실패를 비용 0원으로 기록하지 않는다.

## DNS에서 확인한 차이

Route 53에 `dns-lab.hmyoon.com` Public Hosted Zone 한 개와 실습 Record 두 개를 만들었다. 권한 서버에 직접 질의하면 TXT와 ALB Alias A의 응답을 받았지만 일반 DNS 조회는 NXDOMAIN이었다. Cloudflare에 하위 Zone의 NS를 위임하지 않았기 때문이라고 설명했다.

부모 `hmyoon.com`은 Cloudflare에 그대로 두고 하위 Zone만 Route 53으로 위임할 수도 있다는 점을 이해했다. 이번에는 위임을 하지 않는 범위를 유지해 기존 서비스와 비교했다. 기존 Cloudflare NS와 `helpdesk.hmyoon.com` CNAME은 바꾸지 않았다.

DNS 응답이 있다고 HTTPS까지 되는 것은 아니다. 새 주소를 HTTPS로 사용하려면 인증서에 그 이름이 포함돼야 한다고 답했다. DNS를 변경해도 기존 응답은 남은 TTL 동안 사용될 수 있다고 답했다. [실습 보고서](../lab-reports/2026-10-21-route53-direct-query.md)에 실제 설정·조회·권한 회수를 정리했다.

## 새 Snapshot과 임시 DB가 필요했던 이유

10/16 Snapshot 이후 새 문의와 실제 AI 제안이 저장됐다. 예전 Snapshot만으로 최신 데이터를 보관했다고 할 수 없어 새 Snapshot을 만들고 복원을 확인해야 한다고 답했다.

복원은 원본 DB를 덮어쓰는 방식이 아니라 Snapshot에서 새 DB 한 개를 만드는 방식이었다. 원본과 복원 DB에서 같은 읽기 전용 SQL을 실행했다. Ticket·Message·Job·Attempt는 각각 5건, Suggestion·Category는 각각 1건이고 Flyway V1~V8 이력은 8건이었다. 일곱 Table의 건수·전체 내용 Hash, 참조 관계·Job 상태·예약·Sequence가 모두 같았다.

이번에는 최신 Suggestion·Category까지 데이터가 있는 상태로 복원됐는지 확인했다. 복원 DB에 App을 연결하지는 않았고, 원본 App은 중지한 상태를 유지했다. App Endpoint 전환·재로그인·원본 복귀는 이미 수행한 10/16 실험과 구분한다. [복원·정리 보고서](../lab-reports/2026-10-21-latest-snapshot-restore.md)에 SQL 결과와 실제 실행일을 기록했다.

## 임시 DB 삭제와 남은 리소스

임시 DB는 복원 가능성을 확인하기 위한 복사본이며 새 업무 데이터를 넣지 않았다. 임시 DB를 삭제해도 원본 DB·Snapshot이 유지되므로 원본의 문의 5건은 남는다고 답했다.

실제 10/22에는 원본 DB와 두 Snapshot의 보존을 확인한 뒤 임시 DB 삭제를 최종 승인했다. 추가 최종 Snapshot 없이 이 임시 DB와 해당 자동 Backup을 정리하는 옵션으로 삭제했고, 목록에서 원본 DB 한 개만 사용 가능한 것을 확인했다. 두 수동 Snapshot도 Available로 남아 있다.

마지막 확인 기준 App Task는 STOPPED이며 원본 RDS·ALB·Route 53 실습 Zone과 보관 리소스는 남아 있다. 임시 DB 삭제와 전체 실습 환경 정리는 다른 작업이다. 새 ALB를 만드는 경우 Cloudflare 서비스 CNAME도 새 주소로 변경해야 한다고 답했으며, 이번에는 ALB·서비스 DNS를 변경하지 않았다.

## HTTP 성공과 AI 성공을 구분한 관측

AGENT의 AI 제안 조회는 HTTP 200이었다. 같은 조회 API의 현재 JVM Metric은 COUNT 8·TOTAL_TIME 약 0.974초로 평균 약 121.7ms였다. 이는 저장 상태를 읽는 HTTP 요청 시간이며 비동기 AI 처리 시간이 아니다. MAX 0을 전체 요청의 처리 시간이 0이라는 뜻으로 읽지 않는다.

Cloud Log의 Job 1·2는 FAILED, Job 5는 STORED였고 모두 attempt 1이었다. Job 5의 Worker Tick은 약 27.516초였다. 이 값은 Provider 단독 응답시간이 아니라 Tick 전체의 경과 시간이다. 조회 HTTP 200과 DB에 저장된 FAILED를 모순으로 보지 않고 각각 조회 성공·AI 작업 실패로 구분했다.

## 10월 22일 이어갈 내용

1. 자료 없이 배포 경로·Role·Session·AI 실패·Image 복귀와 DB 복원의 차이를 설명한다. 핵심 질문은 2~3개씩 묶고, 직접 설정 수정·검증 항목의 완료 여부도 확인한다.
2. 현재 변경분에 필요한 회귀·CI와 Source·Image 근거를 정리한다. 이미 끝낸 실제 AI·DNS·전체 복원·Rollback을 처음부터 반복하지 않는다.
3. 원본 RDS·ALB·실습 Zone과 Image·Snapshot·Log의 보관/정리 범위를 결정한다. 삭제·DNS 변경·새 실행은 별도 승인하고 월 3만 원 최대·최소 지출·Log 365일 조건을 유지한다.
4. 최신 진행상황과 재현 절차를 문서에 맞추고 통합 WIL을 작성한다. 작성자 문체 검토·블로그 게시·포럼 등록·Push는 실제 수행을 확인한 뒤 완료로 표시한다.

새 핵심 기능이나 일반 입력의 AI 활성화는 이번 마감 범위에 추가하지 않는다. 취업 우선 일정과 잔여 기술 과업 주 6시간 상한은 그대로 유지한다.
