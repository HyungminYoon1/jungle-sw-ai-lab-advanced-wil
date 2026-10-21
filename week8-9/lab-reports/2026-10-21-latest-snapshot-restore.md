# 최신 AI 제안을 포함한 Snapshot 복원과 임시 DB 정리

> 상태: 최신 Snapshot의 별도 DB 복원·SQL 대조 완료. 실제 10/22에는 최종 승인 후 임시 DB 한 개만 삭제했다. 원본 DB와 두 수동 Snapshot은 보존했다.
> 학습 회차: 2026-10-21
> 실제 실행일: Snapshot·복원·SQL 대조는 2026-10-21, 임시 DB 삭제와 보존 확인은 2026-10-22 KST

## 다시 복원을 확인한 이유

10/16 Snapshot의 검증 시점에는 문의가 2건이고 AI 제안은 없었다. 이후 문의·실패 기록과 실제 AI 제안이 추가됐으므로, 최신 상태를 보관하려면 새 Snapshot의 복원 결과도 확인해야 했다. 이전 복원에서 확인한 App 전환을 반복하는 대신 이번에는 내용이 있는 Suggestion·Category까지 SQL로 대조했다.

원본 `helpdesk-learning`을 유지한 채 `helpdesk-learning-20261021-final`에서 별도 `helpdesk-learning-restore-20261021`을 만들었다. 원본을 덮어쓰거나 DB 상태를 과거로 돌리는 실험은 아니다.

## 실행 순서와 보안 조건

1. 승인한 AI 비활성 명세 `:6`의 단독 App Task 한 개를 중지했다. 10/21 20:00:11 KST에 STOPPED·Container Exit Code 143을 확인했고 새 Task는 실행하지 않았다.
2. Private CloudShell에서 psql 17.11·공개 CA Hash·`verify-full`·TLS 1.3으로 원본 DB에 접속했다. App 암호는 작성자가 직접 입력했다.
3. 같은 읽기 전용 Repeatable Read Transaction에서 기준 SQL을 실행했다. Statement Timeout 5초·Lock Timeout 2초를 유지했다.
4. 10/21 20:14 KST에 생성한 최신 Snapshot의 Available·manual·Private·원본과 같은 암호화·Project 태그를 확인했다.
5. 별도 Private DB로 복원하고 Available 뒤 같은 SQL로 대조했다. 생성 기록은 10/21 20:28 KST다.

복원 DB는 PostgreSQL 17.11·db.t4g.micro·Single-AZ·gp3 20 GiB·기존 Private Subnet Group과 RDS Security Group을 사용했다. Public Access·자동 증설·추가 유료 모니터링은 껐다. 원본 DB·기존 Snapshot·ALB·DNS·Secret 설정은 변경하지 않았다.

## 데이터 대조 결과

| 대조 대상 | 원본과 복원 DB의 결과 |
|---|---|
| Ticket·Message·Job·Attempt | 각각 5건, 건수와 전체 내용 Hash 일치 |
| Suggestion·Category | 각각 1건, 건수와 전체 내용 Hash 일치 |
| Message 본문·작성자 | 5건 모두 존재, 전체 Row Hash 일치 |
| Job 상태 | FAILED 4건·SUCCEEDED 1건으로 일치 |
| 실행·예약 | 각 Job의 current_attempt 1·생성 예약 1·보완 예약 0으로 일치 |
| 참조 누락 | 검사한 다섯 관계 모두 0건 |
| Flyway | V1~V8 성공 이력 8건, 건수와 전체 내용 Hash 일치 |
| Sequence | 검사한 세 값 일치 |

동일한 SQL의 SHA-256을 확인했고 일곱 Table의 건수·내용 Hash, Job 집계·참조·Migration·Sequence가 모두 같았다. 두 읽기 전용 Transaction은 COMMIT까지 완료했다. 원문·작성자·암호 값은 공개 기록에 넣지 않았다.

예약/Attempt 수는 DB의 실행권·호출 한도 기록이다. 실제 외부 Provider 요청 횟수의 직접 계측값으로 바꾸어 읽지 않는다. 복원된 FAILED Job은 실패 상태까지 복원된 것이며, 문의 복원 실패가 아니다.

이번에는 App을 복원 DB에 연결하거나 Worker를 켜지 않았다. 새 문의·AI 호출·Job 상태 변경도 없었다. 따라서 이번 결과는 최신 업무 데이터의 DB 복원 검증이며, 복원 DB의 App 실행·재로그인 검증은 [10/16 실험](./2026-10-16-rds-snapshot-restore.md)의 결과와 구분한다.

## 권한 준비와 삭제 결과

기존 복원 전용 정책 Version 3에 이번 Snapshot·임시 DB의 정확한 이름을 추가했다. 이후 별도 승인한 Version 4에서는 기존 삭제 문장의 Resource에 이번 임시 DB 한 개만 추가했다. MFA·서울·Project 조건과 기존 12문장·여덟 Action을 유지했고 이전 Version도 보존했다. 저장 JSON 대조와 관련 로컬 Test 40개·ESLint 통과를 기록했다. 원본 DB·Snapshot 삭제 권한은 추가하지 않았다.

실제 10/22 KST에는 삭제 직전 원본 DB와 두 수동 Snapshot의 Available, 정확한 임시 DB 이름·태그와 삭제 옵션을 다시 확인했다. 최종 승인 뒤 추가 최종 Snapshot 없이, 이 임시 DB의 자동 Backup도 보존하지 않는 설정으로 지정 DB 한 개만 삭제했다.

삭제 완료 안내와 DB 목록에 원본 `helpdesk-learning` 한 개만 사용 가능 상태로 남은 것을 확인했다. 원본 백업 화면을 다시 조회해 아래 두 수동 Snapshot도 모두 Available·manual로 보존됐음을 확인했다.

- `helpdesk-learning-20261016-recovery`
- `helpdesk-learning-20261021-final`

임시 DB의 자동 Backup 미보존은 삭제 요청 옵션으로 확인했으며 보존 Backup 목록을 별도로 조회하지는 않았다. 임시 DB 삭제는 취소할 수 없지만, 보존한 Snapshot에서 별도 DB로 다시 복원할 수 있다.

## 마감 상태와 재개 조건

마지막 확인 기준 App은 STOPPED, 원본 DB는 Available이며 ALB·실습 DNS Zone과 보관 리소스는 남아 있다. 임시 DB 삭제로 전체 비용이 멈춘 것은 아니다. 원본 자동 Backup·두 수동 Snapshot·DNS·Secret·Image·Log 365일 보존은 유지했다. 이번 복원·정리 중 Provider 호출은 0회였다.

10/22에는 최종 복습·변경분 회귀/CI 정리·장기 보관 대상 결정·통합 WIL을 이어간다. App 재실행이나 원본 DB·ALB·Zone 정리는 필요한 범위를 제시하고 별도 승인받는다. 이번 기록을 새 실행·삭제 승인으로 사용하지 않는다.

## 실행 근거

- Lab의 `deploy/iam/db-recovery.md`, Commit `18103ae`·`41a4f11`·`7666ddf`
- Git 제외 `local/evidence/2026-10-21-deployment-closeout/`의 `latest-recovery-source-baseline.json`, `latest-recovery-restored-baseline.json`, `latest-recovery-sql-comparison.json`, `recovery-delete-completed-20261022.json`과 화면 대조 기록
- [10월 21일 학습노트](../study-notes/2026-10-21-study-questions.md)
