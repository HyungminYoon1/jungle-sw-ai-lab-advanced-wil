# 고정 합성 문의의 Cloud AI 실행과 복귀

> 학습 회차: 2026-10-20, 연장 실행일: 2026-10-21 KST
> 결과: 실험 명세 :7의 실제 AI 처리·Suggestion 저장·AGENT 조회와 기존 원문 Hash 보존 확인. 실험 Task 중지 뒤 AI 비활성 :6의 기동·Target Healthy·DB 보존·이전 Session 거부와 재로그인 조회까지 완료했다.

## 실행 범위

새 Job 선택 기능을 추가하는 안과, 기존 합성 문의 두 건의 입력 거부를 허용하고 원문을 유지하는 안을 구분했다. 사용자는 후자를 승인했다. 문의 보존은 Ticket·Message의 원문과 작성자가 유지되는 것이며 Job 상태 불변과는 다르다.

기존 Worker는 Claim·예약을 Commit한 뒤 입력을 검사한다. 따라서 Ticket 1·2의 Job은 외부 전송 없이 `FAILED`·예약 증가가 생길 수 있다. 기존 한도·기한·원장을 초기화하지 않고 결과를 따로 기록한다.

실제 요청 대상은 Source와 정확히 같은 고정 합성 문의 한 건이다. 새 Job에는 생성 한도 1회·보완 0회를 적용하고 실패해도 추가 호출하지 않는다. 이 한도는 해당 Job의 정책이며 Task 전체의 공통 호출 Counter가 아니다. 미완료 Job을 사전 조회하고 Ticket 1·2 외 대상이 있으면 AI를 켜기 전에 멈추는 조건을 둔다.

## RDS 사전 조회

기존 Private CloudShell 관리 환경에서 psql 17.11·CA 검증·`sslmode=verify-full`로 접속했다. TLS 1.3 연결 뒤 짧은 읽기 전용 Transaction에서 ID·상태·예약과 기존 Row의 Hash만 확인했다. 원문·작성자 이름·암호는 출력하지 않았다.

| 대상 | 조회 결과 |
|---|---|
| 미완료 Job 전체 | 2건 |
| Ticket 1·2 외 미완료 Job | 0건 |
| Job 1 / Ticket 1 | PENDING, Attempt 0, 예약 0, 처리 시작 전 |
| Job 2 / Ticket 2 | PENDING, Attempt 0, 예약 0, 처리 시작 전 |
| 기존 Ticket 비교 기준 | 2건과 Row Hash 확보 |
| 기존 Message 비교 기준 | 2건과 본문·작성자를 포함한 Row Hash 확보 |

비밀번호는 작성자가 직접 입력했다. 조회 후 Commit·접속 종료를 확인했으며 SQL 쓰기나 RDS 설정·Schema 변경은 하지 않았다. 실행 전 대상이 달라졌는지는 다시 확인한다.

## 설정과 로컬 Test

Lab `e01ed83`에 부분 Container 설정·Parameter 읽기 정책 초안과 결합 Test를 추가했다. 기존 Main·JAR·Dockerfile은 바꾸지 않아 새 Image를 만들지 않는다. 현재 실행 명세 `:6`의 실제 설정을 기준으로 이름별로 병합하며, 기존 JDBC·Cookie·Log·여섯 Secret 참조를 유지한다.

| 로컬 검증 | 결과 |
|---|---|
| Java Surefire | 1,014개 통과 |
| 패키징 후 Failsafe | 2개 통과 |
| JavaScript | 286개 통과 |
| ESLint·Diff 확인 | 통과 |

실제 Environment 이름의 Spring 설정 결합, 생성 1회·보완 0회, 필수 설정·일반 Key 자동 대체 없음, 기존 여섯 참조 보존을 확인했다. 이 Test의 Provider는 통제된 구성이고 실제 AI를 호출하지 않았다.

## Key와 읽기 권한

사용자가 서울의 `/helpdesk/learning/ai/provider-key` 한 개를 Standard·SecureString·기존 `alias/aws/ssm`으로 직접 등록했다. 목록에서 정확한 이름·유형·등급을 확인했고 비밀값은 열지 않았다. 기존 여섯 Parameter는 수정하지 않았다.

`helpdesk-ecs-execution`의 Inline 정책 `helpdesk-execution-minimum`에는 `ReadSyntheticAiProviderKey` 한 문장만 추가했다. Action은 `ssm:GetParameters`, Resource는 새 Parameter의 정확한 ARN 한 개다. 저장된 JSON을 다시 읽어 원래 네 문장과 새 한 문장이 각각 사전 확인 내용과 일치함을 검증했다. Task Role·배포 사용자 권한·Trust Policy·새 KMS 권한은 변경하지 않았다.

준비 과정에만 Root를 사용하고 로그아웃했다. 이어질 실행·검증은 `helpdesk-deployer`로 진행한다. 값이 저장됐다는 사실은 실제 Provider 인증 성공과 다르며, Key 전달·인증은 실행 단계에서 확인한다.

## 적용한 검증 순서

1. 미완료 Job과 실행 Task를 재확인하고, 승인 범위 밖 대상이 있으면 멈춘다.
2. 같은 검증 Image·0.25 vCPU·512 MiB·기존 Network로 실험용 명세를 등록한다. 새 Key는 Secret 참조로만 전달한다.
3. 기존 Task를 정리한 뒤 단일 실험 Task를 실행한다. Provider·Worker·고정 합성 검사를 켜되 일반 입력 처리는 허용하지 않는다.
4. 재로그인 후 새 합성 문의 한 건만 접수하고 새 Job의 정책·예약·실제 요청·검증 결과·Suggestion과 AGENT 화면을 대조한다. 접수 응답이 불명확하면 재전송하지 않고 DB부터 조회한다.
5. 기존 Ticket·Message Hash와 Job 변경을 구분해 확인하고 AI 비활성 `:6`으로 복귀한다. 재로그인·문의 보존·Worker 비활성을 검증한다.

RDS 설정·Schema·DNS·기존 Secret은 이 실험의 변경 대상이 아니다. 일반 개인정보 모델과 인물 관계 V2도 활성화하지 않는다.

## 실험 Task 실행

실행 직전의 읽기 전용 SQL에서도 미완료 Job은 Ticket 1·2의 두 건뿐이었다. 명세 `:6`에 승인한 설정과 새 Key 참조를 병합해 `:7`을 등록했다. 등록 JSON 전체를 DOM에서 읽고 Environment 순서 차이만 정규화해 입력과 대조했다. Image Digest는 `sha256:0f53c6ce5532d44b4a0b3e8123c27498aeb466539ee02f00326eb111c9e9296a`로 유지했다.

기존 Task의 종료 코드 143·STOPPED를 확인한 뒤 실험 Task 한 개를 실행했다. 첫 요청에서는 명세의 태그 전파만 선택해 `aws:RequestTag/Project` 조건을 충족하지 못했다. 이전 실행 기록에 있던 주의점을 놓친 반복 실수였다. IAM은 변경하지 않고 전파를 끈 뒤 요청 태그 `Project=helpdesk-learning`을 직접 넣자 실행이 수락됐다. 부가 Capacity Provider 조회 거부도 권한 추가 없이 Fargate 시작 유형의 직접 선택으로 처리했다.

실제 명세 `:7`·검증 Digest·0.25 vCPU/512 MiB·Fargate 1.4.0·기존 Public-a/App 보안 그룹을 확인했다. Spring은 10/20 23:51:22 KST에 시작했고 원본 RDS의 V8에서 추가 Migration은 없었다. 새 Private IP:8080을 지정 Target Group에 등록해 Healthy를 확인했다. ECS Exec·Service 자동 재실행·추가 지표는 켜지 않았다.

기존 Job 1·2는 각각 Attempt 1·예약 1과 `FAILED / ADAPTER_CONFIGURATION_ERROR`로 바뀌었다. 이는 현재 합성 입력 계약 밖의 원문을 거부한 결과다. 문의 원문이나 예약을 초기화하지 않았다.

## 합성 문의와 실제 저장 결과

작성자가 AGENT로 로그인한 뒤 기존 Ticket 1을 조회했다. 이어 실제 HTTPS 화면의 생성 버튼을 한 번만 눌러 아래 합성 문의를 접수했다.

```text
제목: 합성 배포 검증 문의
본문: 로그인 링크가 만료됐지만 새 링크로 로그인에 성공했습니다. 합성 연락처 a@b.invalid로 안내를 요청합니다.
```

| 확인 대상 | 결과 |
|---|---|
| 접수 | Ticket 5·Message 5·Job 5, OPEN |
| 접수 Log | 10/21 00:02:56 KST, Commit 뒤 Handler 201, 약 0.928초 |
| 새 Job 정책 | cloud-synthetic-once-v1, 생성 한도 1·보완 0 |
| 처리 | Attempt 1·예약 1, SUCCEEDED, 실패 코드 없음 |
| Worker Log | 00:03:24 KST, jobId=5·attempt=1·outcome=STORED, Tick 약 27.516초 |
| 제안 | Suggestion 1건·Category 1건, ACCOUNT·UNDETERMINED·PENDING_REVIEW |
| 문의 보존 | 새 본문 일치·작성자 존재, Ticket 1·2와 Message 1·2의 기존 Row Hash 유지 |
| 전체 Row 수 | Ticket 5건·Message 5건·Suggestion 1건 |

저장된 요약은 “로그인 링크가 만료됐으나 새 링크로 로그인에 성공했으며, 합성 연락처로 안내를 요청합니다.”였다. AGENT 화면과 DB에서 같은 요약·분류·우선순위·검토 상태를 확인했다. 화면은 ‘AI 제안 생성 완료·담당자 검토 대기’를 표시했으며 Ticket을 자동으로 해결 처리하지 않았다.

접수 HTTP 시간과 Worker Tick 시간은 서로 다른 구간이다. Tick에는 Claim·검사·외부 호출·저장이 포함되므로 27.516초를 AI 공급자 단독 응답시간이라고 읽지 않는다. 이번 Cloud Log에는 원격 HTTP Status·Token 사용량을 별도로 남기지 않았다. 예약 1건은 실제 외부 HTTP 횟수의 직접 계측값이 아니다. 실행 명세의 실제 Provider와 단일 시도 Transport, 생성 한도·자동 재시도 없음, 저장 결과를 함께 확인한 실험이다.

예약 원장의 `result_code`는 Job 1·2·5 모두 `UNCONFIRMED`였다. 최종 Job의 FAILED/SUCCEEDED와 Suggestion은 별도 저장 필드이므로 원장의 이 값만으로 최종 결과를 판단하지 않는다. 코드의 결과 기록 범위를 후속 관측 보완 항목으로 남긴다. 출력 요약에 연락처가 없다는 사실만으로 외부 전송 전 마스킹 전체를 증명하지도 않는다. 일반 개인정보 탐지 정확도와 실제 전송 Body의 별도 계측은 이번 성공 결과에 포함하지 않는다.

## AI 비활성 복귀

제안 확인 뒤 추가 접수·AI 재호출 없이 실험 Target을 해제하고 Task의 실제 STOPPED·종료 코드 143을 확인했다. 같은 Image·원본 RDS·기존 Network로 명세 `:6`의 단일 Task를 실행했다. Provider·Worker는 false이며 새 AI Key 참조도 이 명세에는 없다. 10/21 00:09:02 KST의 Spring 시작·V8 유지·추가 Migration 없음을 확인하고 새 Private IP:8080을 등록했다.

복귀 Target 한 개의 Healthy·Draining 0개를 확인했다. 이전 Session으로 Job을 조회하자 ‘로그인이 필요합니다’가 표시됐다. 읽기 전용 SQL에서는 기존 Ticket·Message Hash, 전체 Ticket/Message 각 5건·Suggestion 1건, Job 1·2의 최종 실패와 Job 5의 SUCCEEDED·예약 1이 그대로였다.

작성자가 기존 AGENT로 다시 로그인한 뒤 실제 화면에서 Ticket 1·2의 제목과 OPEN을 조회했다. 담당자 화면에서는 Job 1·2의 `FAILED / ADAPTER_CONFIGURATION_ERROR`, Job 5의 SUCCEEDED와 저장된 요약·ACCOUNT·UNDETERMINED·PENDING_REVIEW를 다시 확인했다. 10/21 00:17~00:18 KST의 새 Task Log에도 Ticket 조회 두 건과 AI 상태·제안 조회 세 건의 Handler 200이 남았다. 이번 재조회에서는 문의 생성·AI 재시도·업무 상태 변경을 하지 않았다.

복귀 명세는 Provider·Worker 비활성을 유지한다. 이미 저장한 제안은 DB 조회만으로 표시되며, 이를 보여주려고 AI를 다시 호출하지 않는다. 이로써 합성 문의 한 건의 Cloud 실행과 비활성 복귀 범위의 검증을 마쳤다.

실행 근거는 Git 제외 경로 `local/evidence/2026-10-20-synthetic-ai-preflight/`에 보관한다. 로컬 Test 결과는 설정 준비의 근거이며, 위 Cloud 실행과 구분한다.
