# 배포 실습 리소스 정리와 복구 자료 보존

> 상태: 승인한 원본 RDS·ALB/리스너·실습 DNS·서비스 CNAME 삭제 완료. 두 수동 Snapshot·Secret·Log·Image·인증서·Target Group·네트워크 보존
> 실제 실행일: 2026-10-22 KST, 최종 결과 기록 22:46 KST

## 정리한 이유와 승인 범위

배포·실제 합성 AI·관측·Image Rollback·최신 Snapshot 복원 실험을 마쳤다. 다음 개발은 로컬에서 진행하고 완성 단계에 다시 배포하기로 했다. 서버를 상시 유지하는 대신 실행 리소스를 정리하고 복원에 필요한 자료를 보관했다.

정리 권한 준비와 실제 삭제는 따로 승인받았다. 최종 대상은 원본 `helpdesk-learning` RDS, 같은 이름의 ALB와 두 Listener, `dns-lab.hmyoon.com` Zone·TXT/Alias A, Cloudflare의 `helpdesk.hmyoon.com` 서비스 CNAME 한 개다. Target Group은 삭제 대상에서 제외했다. 실제 실행은 비Root `helpdesk-deployer`의 기존 MFA 세션으로 진행했고 추가 IAM·보안 규칙 변경은 없었다.

## 삭제 전 데이터 대조

App Task 실행/보류 0개·Service 0개를 확인했다. 원본 DB에는 psql 17.11·공개 CA·`verify-full`·TLS 1.3으로 접속했다. Password는 작성자가 직접 입력했다.

Lab의 `deploy/rds/recovery-verification.sql`을 읽기 전용 Repeatable Read Transaction에서 실행하고 COMMIT했다. SQL Hash가 10/21 복원 검증에 사용한 것과 같았고, 그때 보관한 최신 Snapshot 기준과 다음 결과가 모두 일치했다.

| 대상 | 건수와 대조 결과 |
|---|---|
| Ticket·Message·Job·Attempt | 각각 5건, 전체 Row Hash 일치 |
| Suggestion·Category | 각각 1건, 전체 Row Hash 일치 |
| Message 본문·작성자 | 5건 모두 존재, 기준과 일치 |
| Job 상태·예약 | FAILED 4건·SUCCEEDED 1건, Attempt/생성 예약 각 1·보완 예약 0 |
| Flyway | V1~V8 성공 이력 8건, 건수·Hash 일치 |
| 참조·Sequence | 검사한 참조 누락 0건과 세 Sequence 값 일치 |

이후 추가 접속은 CloudShell 유휴 종료로 SQL 실행 전에 중단됐다. 이미 완료한 대조 결과를 사용했으며 이를 두 번째 성공 실행으로 세지 않았다. 원문·작성자·암호 값은 출력 근거에 넣지 않았다. Snapshot 자체를 새 DB로 복원한 검증은 [10/21 보고서](./2026-10-21-latest-snapshot-restore.md)의 결과다.

## 실제 정리 결과

| 대상 | 실행 옵션·순서 | 최종 확인 |
|---|---|---|
| 원본 RDS | 추가 최종 Snapshot·자동 Backup 보존을 선택하지 않음. 삭제 요청 한 번 제출 | 삭제 중 안내 뒤 상세 Not Found·DB 목록 0개 |
| Route 53 TXT·Alias A | 두 Record를 각각 삭제. 기본 NS·SOA만 남은 뒤 Zone 삭제 | 두 Record 삭제 성공·호스팅 영역 목록 0개 |
| Cloudflare 서비스 CNAME | 정확한 서비스 Record 한 개만 삭제 | Dashboard에서 제거·권한 DNS 조회에 CNAME 없음 |
| ALB·리스너 | CNAME 부재 확인 뒤 기존 TTL 300초 이상 대기. 삭제 절차 시작 시 560초 경과 | ALB 삭제 성공 안내·목록 0개. 두 Listener도 함께 삭제 |

원본 RDS의 자동 Backup 미보존은 삭제 옵션으로 확인했고 보존 Backup 목록을 별도로 조회하지는 않았다. 삭제 중 일반 PostgreSQL과 무관한 `DescribeGlobalClusters` 조회 거부가 남았지만 이를 해결하려고 권한을 추가하지 않았다.

## 보존한 것과 확인 방법

- 수동 Snapshot `helpdesk-learning-20261016-recovery`·`helpdesk-learning-20261021-final`: 원본 삭제 후 두 개별 상세에서 manual·Available 확인
- 기존 Secret/Parameter·CloudWatch Log와 365일 보존·ECR Image·Task Definition·Role: 변경하지 않음
- ACM 인증서와 DNS 검증 CNAME·Cloudflare 부모 NS/다른 서비스 Record: 유지
- Target Group·VPC·Subnet·Security Group 등 네트워크: 변경하지 않음

Snapshot 목록은 0개로 표시됐지만 각 상세는 Available이었다. 목록과 상세가 다른 이유는 확정하지 않았다. CloudShell의 직접 API 조회는 임시 인증정보 발급 오류로 끝났고 일반 CloudShell 환경 준비도 거부됐다. 조회를 위해 IAM을 넓히지 않고 두 개별 상세를 보존 확인 근거로 사용했다.

원본 DB 삭제는 원본의 문의가 계속 실행 DB에 남아 있다는 뜻이 아니다. 원본 Instance는 없어졌고 문의·AI 제안·실패 기록은 검증한 Snapshot에 보존했다. 다시 사용하려면 Snapshot에서 새 DB를 복원해야 한다.

## 다음 개발과 재배포

1. 다음 구현·회귀는 로컬에서 진행한다. 문서 마감만을 위해 Cloud를 다시 만들지 않는다.
2. 배포가 필요하면 최신 검증 Snapshot에서 새 Private RDS를 복원하고 보안 그룹·TLS·계정·업무 Row·V8을 확인한다.
3. 새 Endpoint를 실행 명세에 반영한다. Code 변경이 있으면 검증한 새 Image를 전달하고, 설정만 바뀌었으면 같은 검증 Image를 사용할 수 있다.
4. 새 ALB·HTTPS/Redirect Listener와 보존 Target Group·ACM을 연결하고 서비스 CNAME을 새 ALB 주소로 맞춘다. 부모 NS·ACM 검증 CNAME은 별개다.
5. AI 비활성 단일 Task의 새 Private IP:8080을 등록한 뒤 Healthy·HTTPS·재로그인·기존 문의/제안·Role·CSRF를 확인한다. 기존 Session은 복원되지 않는다.

새 실행·비용·DNS 변경은 그때 범위를 확인한다. Job·Attempt·예약을 초기화하거나 과거 AI 활성 명세를 그대로 실행하지 않는다. 추가 실제 AI 실험은 별도 입력·호출 범위를 정한다.

## 비용과 남은 마감

주요 실행 리소스는 정리했지만 Snapshot·Image·Log 보관 비용은 남을 수 있다. 이전 요금 예시를 실제 청구액으로 바꾸어 적거나 비용 0원으로 기록하지 않았다. 정리 정책의 연결 해제·Foundation의 두 DNS 예외 회수, 실제 보관 비용은 후속 점검이다. 이번 삭제 실행에서는 IAM을 바꾸지 않았다.

핵심 배포 실험은 끝났으며 남은 주간 마감은 최신 로컬 변경의 원격 CI·공개 자료/재현 절차 확인·통합 WIL 작성/검토/게시다. 인물 관계 V2·개인정보 모델 고도화·일반 입력의 AI 활성화는 후속으로 유지한다.

## 실행 근거

- Lab `deploy/iam/closeout.md`, `deploy/ecs/README.md`, `deploy/rds/recovery-verification.sql`
- Git 제외 `local/evidence/2026-10-22-closeout-inventory/`의 `pre-delete-db-comparison.json`, `cleanup-results.json`과 삭제·Snapshot 개별 상세 화면
- [10월 22일 학습노트](../study-notes/2026-10-22-study-questions.md)
