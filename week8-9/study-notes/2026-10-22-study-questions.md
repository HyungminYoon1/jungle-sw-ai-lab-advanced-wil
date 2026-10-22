# 10월 22일 최종 복습·로컬 회귀와 배포 리소스 정리

> 상태: 핵심 복습 6문항·직접 설정 수정 실습·로컬 회귀, 최소 정리 권한과 실제 리소스 정리를 마쳤다. 두 수동 Snapshot·Secret·Log·Image·인증서·네트워크는 보존했다. 최신 로컬 변경의 Push·원격 CI와 통합 WIL 작성·검토·게시는 남아 있다.

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

## 정리 전에 확인한 보관 범위

비Root MFA 로그인 뒤 App·원본 RDS·두 수동 Snapshot·ALB·실습 Zone을 읽기 전용으로 확인했다. 기존 정책의 삭제 범위는 임시 DB로 제한돼 있어 원본 DB·ALB·Zone의 정리에 그대로 사용할 수 없었다. 정확한 대상·최소 권한·보존 범위를 묶어 제시한 뒤 권한 준비만 승인받았다.

- 보존 기준: 기존 두 수동 Snapshot·검증 Image와 호환 복귀 Image·설정·Parameter·ACM 검증 정보·365일 Log와 실행 기록
- 정리 대상: 원본 RDS Instance·학습 ALB/리스너·Route 53 실습 Record/Zone·서비스 CNAME. Target Group은 최종 보존 범위에 포함했다.
- 실행 전 확인: 원본 자동 Backup 미보존 옵션, 최신 데이터와 검증 Snapshot 기준의 일치, 정확한 삭제 대상·권한 범위

수동 Snapshot은 DB Instance 삭제와 별개로 남으며, 자동 Backup은 삭제할 때 선택한 보존 옵션에 따라 처리된다. [AWS RDS 삭제 안내](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_DeleteInstance.html). 실습 Zone은 기본 NS·SOA 외 Record를 먼저 정리해야 삭제할 수 있다. [AWS Route 53 삭제 안내](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/DeleteHostedZone.html).

정리 준비 때 원본 RDS·ALB의 삭제 방지는 꺼져 있었고 두 수동 Snapshot은 사용 가능했다. 실습 Zone은 NS·SOA·TXT·Alias A 네 Record가 있었다. 처음 DNSSEC 조회는 거부됐지만 최소 권한 적용 뒤 미서명·KSK 없음을 확인했다. 실제 삭제 전후의 App 실행 상태는 Task 실행/보류 0개·Service 0개로 확인했다.

## 정리용 최소 권한의 준비와 실제 적용

- 새 `helpdesk-deployer-closeout` 정책은 정확한 DB·ALB·Zone ARN에 다섯 Action을 여섯 문장으로 제한한다. Record 삭제는 실습용 TXT 이름·유형과 Alias A 이름·유형을 따로 제한하고, NS·SOA 변경이나 다른 이름·유형 조합을 허용하지 않는다.
- 모든 Allow는 MFA를 요구한다. DB·ALB는 서울이며, 글로벌 Route 53은 `us-east-1`에 한정한다. Foundation의 기존 지역 거부에는 `GetDNSSEC`·`DeleteHostedZone` 두 Action만 예외로 추가했다. 예외 자체가 Allow는 아니다.
- Root 로그인·MFA는 작성자가 직접 완료했다. 기존 Foundation Version 3의 전체 JSON과 연결 대상을 대조·보관한 뒤 새 기본 **Version 4**를 저장했다. Version 1~3과 다른 14개 문장·MFA 거부·서울 조건은 그대로다.
- 새 정리 정책 **Version 1**의 전체 저장 JSON이 검증안과 일치함을 확인하고 `helpdesk-deployer` 한 명에게만 연결했다. 실제 적용본은 **2,583자**이며 AWS 편집기의 보안·오류·경고·추천은 모두 0이었다. Foundation 적용본은 **5,509자**다.
- 정리·DNS·기존 배포·복원 Focused Test **55개**, JavaScript 전체 **303개**와 변경한 Test의 ESLint가 통과했다. 기존 Java 회귀 결과는 위 검사 시점의 결과이며 IAM 문서·정책 변경을 이유로 Java·Image Build를 다시 실행하지 않았다.
- Root를 로그아웃한 뒤 작성자가 비Root 로그인·MFA를 직접 완료했다. 비Root 신원을 확인하고 DNSSEC의 **서명하지 않음·KSK 없음**, 원본 DB와 두 수동 Snapshot의 **사용 가능**, 자동 백업 7일을 조회했다. 실제 삭제 Action을 시험 실행하지 않았다.
- Lab의 `deploy/iam/closeout.md`에 비교한 안·결정 이유·영향 파일·후속 회수·실행 전 확인 절차를 남겼다. **권한 준비 단계에서는 삭제 요청 0회**였으며, 실제 삭제는 아래 별도 최종 승인 뒤 진행했다. 권한 준비와 삭제 실행을 하나의 승인으로 취급하지 않았다.

권한을 연결하면 사용자는 지정 대상의 삭제를 실행할 수 있다. **삭제 직전 확인은 작업 절차에서 지키는 승인 경계이지, IAM이 사람의 확인을 대신 강제하는 기능은 아니다.** 원본 RDS의 추가 최종 Snapshot·자동 Backup은 보존하지 않고 두 기존 수동 Snapshot을 유지하는 옵션을 최종 확인했다.

## 원본 데이터와 Snapshot 기준 대조

Private CloudShell에서 psql 17.11·`verify-full`·TLS 1.3으로 원본 DB에 접속했다. 읽기 전용 Repeatable Read Transaction에서 기준 SQL을 실행하고 COMMIT까지 완료했다. 10/21 최신 Snapshot을 복원해 확인했던 기준과 아래 결과가 일치했다.

- Ticket·Message·Job·Attempt 각각 5건, Suggestion·Category 각각 1건의 전체 Row Hash
- Job FAILED 4건·SUCCEEDED 1건, 각 Job의 Attempt·생성 예약 1·보완 예약 0
- Flyway V1~V8·참조 누락 0·검사한 Sequence 값

추가 접속 시도는 유휴 종료로 SQL을 다시 실행하지 못했다. 이미 COMMIT까지 마친 대조 결과를 사용했으며 실패한 재접속을 새 검증으로 기록하지 않았다. 원문·작성자·Password 값은 공개 자료에 넣지 않았다.

## 실제 리소스 정리 결과

다음 개발은 로컬에서 진행하고 필요할 때 다시 배포하는 방향을 확인한 뒤, 지정 대상의 실제 삭제를 승인했다. 실행은 비Root `helpdesk-deployer`로 진행했다.

| 대상 | 정리 결과 |
|---|---|
| 원본 RDS `helpdesk-learning` | 추가 최종 Snapshot·자동 Backup 보존 없이 삭제. 상세의 Not Found·DB 목록 0개 확인 |
| ALB·HTTP/HTTPS 리스너 | 서비스 CNAME 삭제와 TTL 대기 뒤 삭제. 삭제 완료 안내·ALB 목록 0개 확인 |
| Route 53 실습 Zone | TXT·Alias A를 한 건씩 삭제하고 NS·SOA만 남았음을 확인한 뒤 Zone 삭제 |
| Cloudflare 서비스 CNAME | `helpdesk.hmyoon.com` 한 개만 삭제. 부모 NS·다른 서비스·ACM 검증 CNAME 유지 |
| 수동 Snapshot 두 개 | `helpdesk-learning-20261016-recovery`·`helpdesk-learning-20261021-final` 모두 개별 상세에서 manual·Available |

서비스 CNAME이 권한 DNS에서 사라진 것을 확인하고 기존 TTL 300초 이상 기다렸다. ALB 삭제 절차를 시작할 때는 560초 이상 지난 상태였다. DNS 응답 Cache가 남아 있는 동안 ALB부터 없애지 않는 순서다.

Snapshot 목록은 0개로 표시됐지만 두 개별 상세에서는 사용 가능했다. 목록만 보고 Backup이 없어졌다고 판단하지 않았고 차이의 원인은 확정하지 않았다. CloudShell의 직접 API 조회도 임시 인증정보 발급 오류로 완료하지 못해 개별 상세를 보존 근거로 남겼다. 자동 Backup 미보존은 삭제 옵션으로 확인했으며 별도 Backup 목록 조회는 하지 않았다.

Secret·Log 365일·ECR Image·ACM 인증서와 검증 CNAME·Target Group·VPC/보안 그룹·Role·Task Definition은 변경하지 않았다. 주요 실행 리소스는 정리했지만 Snapshot·Image·Log의 보관 비용은 남을 수 있다. 실제 청구액은 조회하지 않았다. [정리 실행 보고서](../lab-reports/2026-10-22-deployment-resource-closeout.md)에 데이터 대조·삭제·보존 근거를 모았다.

## 다음 개발과 Cloud 재배포

삭제한 RDS는 Start로 되살릴 수 없다. 다음 기능 개발과 Test는 로컬에서 진행하고, Cloud 배포가 필요할 때 최신 검증 Snapshot에서 새 Private DB를 복원한다. 새 Endpoint·TLS·계정을 확인한 뒤 ALB·서비스 CNAME·Task 설정을 맞추고 새 Private IP:8080을 보존 Target Group에 등록한다. 처음에는 AI를 끄고 재로그인·기존 문의/제안·Role·CSRF를 확인한다.

기존 Image·설정·Snapshot을 보관하는 것과 서비스를 계속 실행하는 것은 다르다. 새 코드가 없다면 같은 검증 Image를 사용할 수 있지만, 삭제한 Endpoint를 참조하는 실행 명세는 그대로 재사용하지 않는다.

## Cloudflare에 HTTP 접속 기록이 없는 이유

작성자는 Cloudflare에 `helpdesk.hmyoon.com`의 접속 기록이 보이지 않는 이유를 질문했다. 일반 DNS 조회와 현재 Cloudflare 권한 DNS 서버의 직접 조회에서 모두 기존 ALB 주소의 CNAME을 받았다. 부모 도메인의 NS도 계속 Cloudflare였다.

이 응답은 기존 **DNS only** 경로와 일치한다. Cloudflare는 주소를 안내하지만 Browser의 HTTP/HTTPS 요청은 ALB로 직접 가므로, Cloudflare의 Proxy 기반 HTTP 접속·보안 이벤트 로그에는 이 요청이 기록되지 않는다. [Cloudflare Proxy 상태 설명](https://developers.cloudflare.com/dns/proxy-status/)

DNS 조회 통계는 별개이며 DNS Cache 때문에 웹 접속 한 번마다 권한 DNS 조회가 발생하지도 않는다. 따라서 Cloudflare에 HTTP 로그가 없다는 사실을 실제 접속 0건이나 App 장애로 해석하지 않는다. 이 원인을 확인할 때 Cloudflare의 Log 화면 자체를 읽거나 Proxy·ALB 접근 규칙을 변경하지 않았다. 이후 실제 정리 단계에서 서비스 CNAME 한 개만 삭제했다.

## 다음 순서

리소스 정리와 재배포 안내를 문서에 반영하고 적절한 단위로 로컬 Commit을 남긴다. Lab의 정리·DNS·기존 배포·복원 정책 Test 55개는 문서 반영 뒤 다시 통과했다. Java·Image Build·Cloud 재실험을 새로 실행한 결과는 아니다.

8–9주차의 남은 마감은 최신 Commit의 Push·원격 CI, 공개 문서/Secret 노출·재현 절차 최종 점검, 통합 WIL 작성·검토와 블로그·포럼 등록이다. 정리 권한 회수와 실제 보관 비용 확인은 별도 후속 점검으로 남긴다. 개인정보 모델·인물 관계 V2는 배포 마감의 선행 과업으로 되돌리지 않는다.
