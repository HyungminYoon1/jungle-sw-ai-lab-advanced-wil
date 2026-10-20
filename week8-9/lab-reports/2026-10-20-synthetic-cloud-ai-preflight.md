# 고정 합성 문의의 Cloud AI 실험 준비

> 확인일: 2026-10-20 KST
> 결과: 기존 미완료 Job의 범위·원문 비교 기준, 실험용 설정 Test, 새 Key 등록과 지정 읽기 권한 준비 완료. 실제 AI Task 전환·호출·제안 저장·비활성 복귀는 다음 실행 단계

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

## 다음 검증 순서

1. 미완료 Job과 실행 Task를 재확인하고, 승인 범위 밖 대상이 있으면 멈춘다.
2. 같은 검증 Image·0.25 vCPU·512 MiB·기존 Network로 실험용 명세를 등록한다. 새 Key는 Secret 참조로만 전달한다.
3. 기존 Task를 정리한 뒤 단일 실험 Task를 실행한다. Provider·Worker·고정 합성 검사를 켜되 일반 입력 처리는 허용하지 않는다.
4. 재로그인 후 새 합성 문의 한 건만 접수하고 새 Job의 정책·예약·실제 요청·검증 결과·Suggestion과 AGENT 화면을 대조한다. 접수 응답이 불명확하면 재전송하지 않고 DB부터 조회한다.
5. 기존 Ticket·Message Hash와 Job 변경을 구분해 확인하고 AI 비활성 `:6`으로 복귀한다. 재로그인·문의 보존·Worker 비활성을 검증한다.

RDS 설정·Schema·DNS·기존 Secret은 이 실험의 변경 대상이 아니다. 일반 개인정보 모델과 인물 관계 V2도 활성화하지 않는다. 이번 준비 기록은 위 실행 순서의 완료 결과가 아니다.
