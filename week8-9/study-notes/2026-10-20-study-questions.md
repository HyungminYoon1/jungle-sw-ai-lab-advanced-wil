# 10월 20일 검사 실패와 배포 준비

> 상태: 학습 진행 중. 첫 로컬 통합 실패 검증을 마쳤으며 Cloud 관측·비용 확인 등은 남아 있다.

## 오늘 이어갈 범위

어제 정상 처리 뒤 자식 Process가 남지 않는 것을 확인했다. 오늘은 전체 App에서 Timeout·비정상 종료가 발생해도 자원을 정리하고, 접수 원문과 예약을 유지하며 외부 전송을 막는지부터 확인한다. 개인정보 탐지 모델·인물 관계 V2 고도화는 후속으로 유지한다.

## 설명한 개념

Timeout은 기다림의 한도가 끝났다는 뜻이지 Process가 이미 종료됐다는 뜻이 아니다. 현재 Transport는 직접 시작한 Process의 실제 종료·Pipe·보조 Thread 회수까지 확인한다.

JSON 문법이 올바른 것과 검사 실행의 성공도 다르다. 정상 JSON을 출력했더라도 종료하지 않거나 현재 계약의 정상 종료 코드 0을 만족하지 못하면 결과를 사용하지 않는다. 검사 실패가 별도 Transaction으로 접수한 Ticket·Message까지 취소하는 것은 아니다.

개념과 추가 복습 질문은 [합성 실행 학습자료](../study-docs/synthetic-deployment-and-runtime-configuration.md)에 보완했다.

## 문답에서 구분한 실행 대상과 배포 산출물

처음에는 검사기의 Exit Code 7을 Helpdesk App 전체의 종료로 받아들여, App이 없어 답변을 받을 수 없으므로 외부 요청을 보내면 안 된다고 답했다. 이번에 종료된 것은 별도 검사 자식 Process이며 외부 AI 요청도 아직 보내기 전이라는 설명을 들었다. 이어진 확인에서는 부모 App이 Job 실패를 DB에 기록하고 다른 요청을 처리할 수 있다고 답했다.

새 Code의 Cloud 확인에는 Source를 전달·교체해야 한다고 답했지만 배포하는 산출물이 구체적이지 않았다. Source의 Test·Build → JAR를 포함한 Image → ECR 업로드 → 새 Task 실행 순서를 설명한 뒤, ECR 업로드만으로 기존 Task가 바뀌지 않으며 새 Image로 새 Task를 실행해야 한다고 답했다.

## 실제 실행으로 확인한 것

운영 코드 대신 Test 도구에 세 Mode를 추가했다. 같은 Main Image·0.25 CPU·512 MiB에서 정상 3건의 성공과 범위 밖 1건의 실패를 재확인했다. 별도 두 구성은 정상 JSON 뒤 대기·Exit Code 7을 각각 만들어 Timeout·비정상 종료의 최종 실패, HTTP·제안 0건과 원문·예약 보존을 확인했다. 세 실행 모두 검사 Process·개인정보 I/O Thread가 남지 않았고 OOM도 없었다.

최고 메모리는 정상 300.26 MiB·Timeout 460.54 MiB·비정상 종료 265.88 MiB였다. Timeout 구성은 처리 전부터 사용량이 높았으므로 차이를 Timeout 하나의 효과나 누수로 단정하지 않는다. 실제 모델이 없는 제한 실험의 값이며 Cloud 사양을 새로 확정하지 않았다.

관련 Java 129개·JavaScript 전체 279개가 통과했다. [실행 보고서](../lab-reports/2026-10-20-synthetic-runtime-failure-cleanup.md)에 조건·DB 결과·자원·회귀 범위를 정리했다. Provider 응답은 통제된 로컬 HTTP이며 실제 AI·AWS·Browser 결과가 아니다.

이어서 전체 로컬 `verify`의 Java 1,009개·패키징 후 2개도 통과했다. 처음 원격은 이전 Source였으므로 그 CI 성공을 새 코드의 결과로 읽지 않았다. [전달 준비](../lab-reports/2026-10-20-deployment-delivery-preflight.md)에서는 일반 Push의 검증과 수동 ECR 업로드, 업로드와 새 Task 실행을 구분했다.

사용자는 두 저장소 Push·CI와 비용 확인 후 Image 한 개의 조건부 ECR 추가를 승인했다. 비Root AWS 조회에서는 기존 Task 1개 실행·RDS 사용 가능·ALB 활성을 확인했지만 월간 누계와 예상 비용은 접근 거부로 읽지 못했다. 처음에는 ECR을 보류했고, 이후 사용자가 비용 조회를 뒤로 미루고 진행하도록 요청해 이번 한 개의 전달을 이어간다. 리소스·권한·Secret·AI 활성화는 변경하지 않았으며 비용 조회 실패를 비용 0원으로 해석하지 않는다.

첫 Push의 CI는 Java 1,009개 중 로그 검증 1개가 실패해 Image Build 전에 멈췄다. 앞선 Spring Test의 `WARN` 설정 때문에 다음 Unit Test가 기대한 `INFO` 로그를 받지 못한 문제를 같은 순서의 로컬 실행으로 재현했다. 두 로그 Test가 필요한 수준을 직접 설정하고 이전 값을 복원하도록 고쳤으며 운영 코드는 바꾸지 않았다. 수정 뒤 순서 고정 Test 28개가 통과했고 수정 Commit `d8ca65f`의 원격 CI도 Java 1,010개·패키징 후 2개·JavaScript 279개·Lint·Image Build까지 통과했다. 이는 AWS 장애나 IAM 오류의 수정과는 다른 Source 검증 단계다.

## 이어갈 배포 학습

- 현재 AWS 실행 상태·실제 비용·저장/보관량을 확인하고 새 Code의 CI·ECR 전달·Cloud Log 검증으로 이어간다. Push·리소스 변경은 승인한 실행 범위를 확인한다.
- 합성 입력의 Cloud 실제 AI는 당일 입력·호출/비용·Secret 참조·Task 명세를 별도로 확인한다. 기존 PENDING의 기한·예약은 초기화하지 않는다.
- 기존 Cloudflare DNS를 유지한 Route 53 비교, 최종 회귀·직접 설명·설정 수정·WIL과 보관 정리를 남은 순서로 유지한다.

## 이해 확인 질문

1. 정상 JSON을 출력한 검사기가 7로 종료했다면 그 결과로 외부 AI 요청을 보내도 되는가? 왜 그런가?
2. 로컬 실험의 통과가 AWS에서 실행 중인 기존 Task의 코드를 바꾸는가? 새 Code의 Cloud 검증 전에 무엇을 전달하고 교체해야 하는가?
