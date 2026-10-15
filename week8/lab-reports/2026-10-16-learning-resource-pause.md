# 학습용 App·RDS 일시중지와 재개 기준

> 실행일: 2026-10-16 KST
> 승인: 미커밋 변경의 목적별 Commit과 불필요한 학습 리소스의 일시중지
> 상태: Target 0개·App Task STOPPED·실행/보류 Task 0개·Service 0개·RDS 일시적으로 중지됨 확인

## 중지한 범위

서울의 `helpdesk-learning` 리소스만 대상으로 삼았다. 기존 비Root 배포 사용자와 MFA·서울 제한을 사용했고 IAM 권한을 추가하지 않았다.

1. 기존 실행 Task의 Private IP·8080이 지정 Target Group의 정상 Target 한 개와 일치하는지 확인했다.
2. 그 Target 한 개의 등록을 해제했다. 기존 드레이닝 간격 300초를 바꾸지 않고 기다린 뒤 등록된 Target 0개·드레이닝 0개를 확인했다.
3. 기존 단독 App Task의 중지를 요청하고 마지막 상태 `STOPPED`·Container 종료 코드 143을 확인했다. 원하는 상태만 STOPPED가 된 중간 화면과 실제 종료를 구분했다.
4. 그 뒤 지정 RDS DB 한 개에 ‘일시적으로 중지’를 요청했다. 선택 사항인 추가 Snapshot 생성은 선택하지 않았다. DB 삭제·초기화·Row 수정은 하지 않았다.

RDS는 `중지 중`을 거쳐 최종 `일시적으로 중지됨`으로 바뀌었고 연결은 0개였다. ECS Cluster에서도 실행/보류 Task 0개·활성/드레이닝 Service 0개를 확인했다. 새 Task를 자동으로 유지하는 Service는 없다. Container 종료 코드만으로 모든 애플리케이션 종료 처리가 완료됐다고 추가 주장하지 않는다.

RDS Console에는 별도 `DescribeGlobalClusters` 목록 조회의 권한 오류가 남아 있었지만 지정 DB의 중지 요청은 성공했고 최종 상태도 확인했다. 이 부가 조회 오류를 해결하려고 권한을 넓히지 않았다. 조회 실패와 DB 중지 실패를 구분한다.

## 유지한 것과 남는 비용

| 대상 | 처리 |
|---|---|
| RDS 데이터·기존 저장 공간·백업 설정 | 삭제하지 않고 유지 |
| ECR Image·Task Definition·Cluster | 유지. 새 Image·Task·Service 실행 없음 |
| ALB·Listener·Target Group | 유지. Target 등록만 해제 |
| ACM·Cloudflare DNS·Network·Secret·IAM | 변경 없음 |
| CloudWatch Log | 기존 365일 보존 유지 |

ALB에는 일시정지 기능이 없으므로 이번 ‘중지’ 요청을 삭제 승인으로 확대하지 않았다. App이 없어도 ALB·해당 공인 IPv4 등의 비용은 남는다. RDS가 중지된 뒤에도 저장 공간·백업, ECR Image·Log 등의 보관 비용은 별개다. 비용을 더 줄이기 위한 ALB 삭제·재생성은 별도 승인과 재개 절차 검토가 필요하다.

RDS 중지 확인창은 **2026-10-23 00:57 KST 자동 재시작**을 안내했다. 최대 7일 뒤 자동으로 다시 켜지므로 영구적인 비용 차단으로 해석하지 않는다. 별도의 자동 중지·알림·예약 작업은 만들지 않았다. [AWS RDS 중지·자동 재시작·과금 안내](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html)

## 재개 순서

1. 비Root 로그인과 실제 RDS 상태를 확인하고 필요할 때 시작한다.
2. 사용 가능 상태를 확인한 뒤 기존 검증 Image·명세와 AI 비활성을 유지한 새 단독 Task를 실행한다. 중지된 Fargate Task를 그대로 다시 시작하는 것은 아니다.
3. 새 Task의 실제 Private IP·8080을 기존 Target Group에 등록하고 Healthy·HTTPS를 확인한다. 같은 ALB이므로 서비스 CNAME은 유지한다.
4. 재로그인하고 기존 문의를 조회해 보존 여부를 확인한다. 이번 중지 후 재조회·DB 보존의 실행 검증은 아직 하지 않았다.
5. Session 소실을 비교하는 정식 Task 교체 실험은 인증된 교체 전 기준을 새로 확보한 뒤 별도로 수행한다.

이번 비용 중지는 [Task 교체 준비](./2026-10-16-cloud-task-replacement.md)의 후속 작업이지만, 새 Task·교체 후 조회·이전 Session 거부를 검증한 결과는 아니다. 이전 Image Rollback·Snapshot 복원·전체 AI Cloud 검증도 여전히 남아 있다.

## 검토 범위

지정 ECS Task·Target Group·RDS 화면과 관련 Runtime·Edge 정책의 중지/등록 해제 범위를 확인했다. 모든 AWS 서비스·다른 프로젝트·실제 청구액을 감사한 결과가 아니다. Credential·Cookie·Token·공인 출발 IP·전체 환경 값은 읽거나 기록하지 않았다.

## Commit 전 로컬 회귀

| 검증 | 결과 |
|---|---|
| Lab 전체 Java Clean Test | 704개·실패/오류/건너뜀 0, 8분 52초 |
| Lab JavaScript 전체 | 234개·실패/취소/건너뜀 0 |
| Python 모델 실험의 정책 Unit Test | 10개 통과. 통제한 NER 출력이며 실제 모델 품질 재평가 아님 |
| ESLint 10.11.0 | 통과 |

현재 Source의 개인정보 처리·실패 저장·접속 도구·IAM 구조 Test를 확인했다. Cloud 실행 Image는 바꾸지 않았으며 실제 AI·Browser E2E·새 Image Build/Push·원격 CI는 재실행하지 않았다. Commit은 로컬에만 만들고 Push는 하지 않는다.
