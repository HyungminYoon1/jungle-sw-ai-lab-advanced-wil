# 10월 22일 최종 복습과 로컬 회귀

> 상태: 핵심 복습 6문항과 직접 설정 수정 실습 근거를 확인했다. Java·JavaScript·ESLint의 로컬 회귀는 통과했다. 최신 Commit의 원격 CI·장기 보관/정리·통합 WIL은 이어서 진행한다.

## 자료 없이 답한 핵심 개념

| 상황 | 작성자가 설명한 내용 | 확인 |
|---|---|---|
| API Key만 변경 | Image 재Build 없이 변경된 Key를 받는 새 Task를 실행한다. | 통과 |
| 문의 201 뒤 AI FAILED·조회 200 | 문의를 취소하지 않는다. 200은 상태 조회 성공이며 AI 처리 성공과 다르다. | 통과 |
| B에서 P Image로 복귀 | DB는 V8을 유지하고 문의도 남는다. 이전 JVM 메모리의 Session은 새 App으로 이어지지 않는다. | 통과 |
| JVM 시작 전 ssm:GetParameters 거부 | Execution Role을 점검한다. Image 재Build로 해결할 문제가 아니다. | 통과 |
| PostgreSQL Password 인증 실패 | DB에 도달한 뒤 거부된 것이므로 DB 계정과 전달한 암호를 확인한다. | 통과 |
| 장기 휴지기 | RDS는 중지 후 7일 뒤 자동 재시작한다. Snapshot·Image·설정·Log는 보존하고 ALB·RDS·실습 Zone은 정리를 검토한다. | 통과 |

새로운 기본 개념 문답을 더 늘리지 않고 최종 복습을 마감한다. 개인정보 모델 고도화·인물 관계 V2는 후속 과업으로 유지한다.

## 직접 설정 수정 실습

[10/14 실제 실행 기록](../lab-reports/2026-10-14-ecs-first-cloud-startup.md)을 대조했다. 작성자는 DB 로그인에 성공한 App 암호를 지정 Parameter에 직접 다시 등록했다. 이후 같은 Image·같은 Task Definition의 새 Task에서 JDBC 인증·Migration·Spring 기동이 성공했다.

코드와 Image를 바꾸지 않고 실행 설정을 수정해 결과를 확인한 실습이다. 이 근거로 직접 설정 수정 항목을 확인하며, 마감을 위해 새 설정 변경을 만들지는 않는다. 암호 값은 기록하지 않는다.

## 현재 Source의 로컬 회귀

Lab HEAD `7666ddf`에서 기존 Workflow의 검사 명령을 실행했다. 검사 Process의 외부 AI 활성화는 끄고 Key를 제거했으며 실제 Cloud 리소스는 변경하지 않았다. Docker Engine은 기존 자동 시작 승인에 따라 기동했다.

| 검사 | 결과 |
|---|---|
| 배포/IAM·복원 SQL·합성 설정 Focused Test | 57개 통과 |
| JavaScript 전체 | 295개·실패/취소/건너뜀 0 |
| ESLint 10.11.0 | 통과 |
| Maven Surefire | 1,014개·실패/오류/건너뜀 0 |
| 패키징 후 Failsafe | 2개·실패/오류/건너뜀 0 |
| Maven verify | BUILD SUCCESS, 총 8분 27초 |

Maven 종료 시에는 Test JVM이 System.exit(0) 뒤 30초 안에 끝나지 않아 Surefire가 정리한 기록도 남았다. 덤프에서 main은 종료 Hook을 기다리고, SpringApplicationShutdownHook은 Hikari 연결 풀의 ThreadPool 종료를 기다리고 있었다. 기능 검사 통과와 Test JVM의 자연스러운 종료 완료를 구분하며, 원인과 재현 범위는 후속 점검으로 남긴다. 이 기록으로 Cloud App에도 같은 문제가 있다고 판단하지 않는다. 검사 뒤 Testcontainers 표식의 실행 Container는 0개였고, 관련 Timeout 설정이나 운영 코드는 변경하지 않았다.

## 로컬 결과와 원격 CI

GitHub에서 확인한 Lab 원격 main은 `d8ca65f`다. 일반 Push Run `39397231695`와 수동 Image 전달 Run `39398031412`는 성공했지만 이번 로컬 HEAD의 결과는 아니다. 로컬에는 그 이후 Commit 5개가 있다.

두 Commit 사이에 운영 Java·pom.xml·Dockerfile·Workflow 변경은 없고, 배포 설정·정책·Test·문서가 바뀌었다. 따라서 정책/문서를 전달하기 위해 새 Image가 반드시 필요한 것은 아니다. 최신 변경의 원격 CI는 별도 Push 승인 뒤 확인한다. 기존 ECR Image·Task·AI는 이번 로컬 검사로 교체하거나 실행하지 않았다.

## 보관과 정리 검토

다음 단계는 비Root MFA 로그인 뒤 App·원본 RDS·두 수동 Snapshot·ALB·실습 Zone의 현재 상태를 읽기 전용으로 확인하는 것이다. 기존 정책의 삭제 범위는 임시 DB로 제한돼 있으므로 원본 DB·ALB·Zone의 정리에 사용할 수 있다고 가정하지 않는다. 현재 상태·정확한 대상·필요한 최소 권한과 보존할 Backup 옵션을 묶어 제시하고 별도 승인받는다.

- 보존 기준: 기존 두 수동 Snapshot·검증 Image와 호환 복귀 Image·설정·Parameter·ACM 검증 정보·365일 Log와 실행 기록
- 정리 검토: 원본 RDS Instance·학습 ALB/Target Group·Route 53 실습 Record/Zone·사용하지 않는 서비스 CNAME
- 별도 결정: 원본 자동 Backup 보존 여부, 삭제 직전 최신 데이터와 Snapshot의 일치, 각 대상의 삭제 방지·권한 범위

수동 Snapshot은 DB Instance 삭제와 별개로 남으며, 자동 Backup은 삭제할 때 선택한 보존 옵션에 따라 처리된다. [AWS RDS 삭제 안내](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_DeleteInstance.html). 실습 Zone은 기본 NS·SOA 외 Record를 먼저 정리해야 삭제할 수 있다. [AWS Route 53 삭제 안내](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/DeleteHostedZone.html).

실제 리소스 삭제·DNS 변경·권한 변경·Push는 아직 하지 않았다. 정리 후에는 남긴 복구 자료와 재개 절차를 확인하고 통합 WIL을 작성한다. 블로그·포럼은 작성자 검토와 실제 게시/등록 뒤 각각 완료 처리한다.
