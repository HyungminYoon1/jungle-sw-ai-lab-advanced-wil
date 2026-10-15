# 같은 Image·RDS를 유지한 Cloud App Task 교체

> 학습 회차: 2026-10-15의 연속 진행
> 실제 실행: 2026-10-15~16 KST
> 상태: 권한 적용·Version 1 보관 완료. 이후 비용 중지 요청으로 기존 Target 해제·Task 종료를 수행했지만 새 Task 교체·재로그인 검증은 `NOT_RUN`

## 목적과 승인 범위

같은 Image·실행 명세·RDS를 유지한 채 단독 App Task를 교체한다. 프로그램 실행 객체와 로그인 Session의 수명, 이미 Commit한 문의의 영속성을 구분한다. 같은 Image 재실행이므로 이전 Image로 되돌리는 Rollback 실습과는 다르다.

사용자가 승인한 범위는 Edge Version 1 JSON 보관 후 삭제, 지정 Target Group의 등록 해제 권한 한 개 추가, 같은 Image·명세의 Task 한 개 교체와 기존 문의 보존·재로그인 확인이다. RDS·DB 구조·DNS·Secret은 변경하지 않는다. AI Provider·Worker도 계속 비활성으로 유지한다.

## 교체 전 실행 기준

서울의 기존 Cluster에서 Running Task 1개·Pending 0개를 확인했다. 기존 Task는 `09f3c898fbc64be0a12a49e6ccb61303`이며 `helpdesk-learning:1`·0.25 vCPU·512 MiB다. 실제 실행 Image의 Manifest Digest는 다음과 같고 10/13의 검증·업로드 보고서와 일치했다.

```text
sha256:1ec1ed5b0a4853b87fac7d1ded3937cf961be19f3d6e010608019e7b55cae39b
```

실행 명세의 Profile은 `postgres,deployment`, Provider·Worker 활성화는 모두 `false`다. 기존 학습 Target Group에는 HTTP 8080의 정상 Target 한 개가 있었다. 실제 내부 IP·Subnet·Group 식별값은 공개 보고서에 복사하지 않는다.

기존 Browser에서 Ticket 조회를 시도했을 때는 이미 로그인이 필요한 상태였다. 이를 Task 교체에 따른 Session 소실로 기록하지 않는다. AGENT로 새로 로그인해 정상 조회를 확인한 뒤 그 Session을 교체 전 기준으로 삼는다. Password·Cookie·CSRF 값은 읽거나 출력하지 않는다.

## 등록 해제 권한과 정책 보관

기존 정책은 Target 등록을 허용했지만 등록 해제는 포함하지 않았다. ALB에서 새 요청 유입을 멈추고 진행 중 연결을 정리한 뒤 App을 종료하기 위해 지정 Group의 `elasticloadbalancing:DeregisterTargets` 한 개만 추가했다. Resource는 현재 Group의 정확한 ARN 하나이고 MFA `true`·서울·Project 태그 조건을 명시했다. 다른 Group·Role·IAM 정책·리소스 삭제·Secret 접근 권한은 추가하지 않았다.

AWS 정책 버전 한도에 따라 Version 1을 Git 제외 로컬 JSON에 보관했다. 보관본의 JSON 내용이 AWS 원본 12개 문장과 일치하는 것을 확인한 뒤 승인한 Version 1만 삭제했다. 보관본을 사용해 같은 내용을 새 Version으로 다시 등록할 수 있지만 AWS에서 삭제한 Version 번호 자체를 복원한 것은 아니다.

기본 Version 6의 저장 JSON 전체를 승인안과 대조했다. 새 등록 해제 문장 한 개만 추가됐으며 기존 16개 문장은 그대로다. Version 2~5를 보존했고 총 17개 문장·공백 제외 5,766자다. AWS 편집기의 보안·오류·경고·추천은 모두 0이었다. 로컬 정책 Test 29개·JavaScript 전체 234개와 ESLint 10.11.0도 통과했다. Java·Image·원격 CI는 이번 변경에서 새로 실행하지 않았다.

Root에서 로그아웃했고 작성자가 helpdesk-deployer의 로그인·MFA 완료를 알렸다. 교체 전 AGENT 로그인 완료·기존 문의 정상 조회는 아직 확인하지 못했다. Root 로그인·MFA와 Helpdesk 로그인은 작성자가 직접 수행하며 비밀값을 읽거나 출력하지 않는다.

## 권한 준비 직후의 회차 마감

작성자의 요청으로 10월 15일 회차를 마감했다. 권한 보완 뒤 Target 등록 해제·Draining·Task 중지·추가 Task 실행은 하지 않았다. 기존 App을 중지하거나 RDS·DB 구조·DNS·Secret을 변경하지 않았다. 마지막 실제 확인의 Running Task 1개·정상 Target 1개와, 문서 마감 때의 새 실시간 조회를 같은 근거로 표현하지 않는다. App·ALB·RDS를 정리한 상태는 아니므로 실행 비용은 별도로 관리해야 한다.

정책 Version 6은 이미 적용됐으므로 재개 때 Version 1 삭제나 같은 권한 추가를 반복하지 않는다. 다음은 비용 중지 요청 전의 교체 계획이며, 이후 실행 상태는 아래 후속 절을 따른다.

1. AGENT Session으로 기존 Ticket을 조회해 교체 전 기준을 확인한다.
2. 기존 Task의 Network·실행 설정과 Target의 정확한 대상을 다시 대조한다.
3. Target 등록을 해제하고 Draining 종료를 확인한다.
4. 기존 Task의 종료를 확인한 뒤 같은 Image·명세로 새 Task 한 개를 실행한다.
5. 새 Private IP:8080을 등록하고 Target Healthy·HTTPS Health를 확인한다.
6. 이전 Session의 거부와 재로그인 후 동일 문의 조회를 비교한다.

이 목록은 아직 실행 결과가 아니다. Task 종료·교체·새 Target의 정상화·교체 후 문의 보존·교체로 인한 Session 소실은 실제 확인 뒤 갱신한다. 새 Ticket 접수·SQL 쓰기·Schema Migration 변경·외부 AI 호출·Snapshot 복원·이전 Image 복귀·Git Commit/Push는 이 준비 단계에서 하지 않았다.

개념과 이해 변화는 [10월 15일 학습 노트](../study-notes/2026-10-15-study-questions.md)에 기록한다. 실제 자정 이후의 정책 적용일은 이 보고서의 10/16 기록으로 유지한다.

## 후속: 학습 리소스 비용 중지

사용자가 Commit과 불필요한 리소스 일시중지를 요청했다. 이에 기존 Target을 해제하고 300초 드레이닝 종료·Target 0개를 확인한 뒤, 기존 Task의 실제 STOPPED를 확인했다. 새 Task는 실행하지 않았다. 이어 RDS의 일시중지를 요청했으며 상세 상태·비용·재개 기준은 [리소스 중지 보고서](./2026-10-16-learning-resource-pause.md)에 기록한다.

이는 비용을 줄이기 위한 중지다. 인증된 AGENT의 교체 전 기준·교체 후 문의 조회·Session 비교가 없으므로 Task 교체 실험을 완료 처리하지 않는다. 재개 때는 먼저 RDS와 새 App Task·Target 연결을 복구하고 재로그인한다. 그 후 정식 교체 비교를 위한 기준을 새로 확보한다. DB 구조·DNS·Secret은 변경하지 않았다.
