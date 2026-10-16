# B 적용과 P Image 복귀 검증

> 학습 회차: 2026-10-16 KST
> 실제 실행: B 적용은 10/16, P 복귀와 최종 대조는 10/17 KST
> 상태: 완료 — B 적용과 P Image 복귀, V8·일곱 Table 건수/Hash 보존, Target Healthy·HTTPS Health UP, AGENT 재로그인 뒤 기존 문의와 새 실패 코드 두 건 조회를 확인했다. Provider·Worker는 비활성으로 유지했다.

## 변경 범위

현재 읽기 준비 P에서 새 실패 코드 처리와 V8을 포함한 B로 전환한 뒤, 같은 RDS의 V8·새 데이터를 유지한 채 P로 돌아온다. AI Provider·Worker는 계속 끄고 IAM·DNS·Secret·보안 그룹·로그 보존 설정은 변경하지 않는다. 단독 Task를 한 개씩 순차 실행하며 기존 300초 Draining을 유지한다.

이 실험의 합성 SQL은 새 실패 값의 저장·조회 호환성을 확인한다. 실제 개인정보 탐지 실패나 외부 AI 결과가 아니며 기존 Ticket·Message·Job을 실패로 바꾸지 않는다. 실제 개인정보 탐지 Adapter·전체 AI·자원 측정은 남은 학습 범위다.

## 고정 프로그램과 전달 근거

| 항목 | 확인 값 |
|---|---|
| P Source | `77359c9779a0a9cb7f505fe4b82b7f97c5ea02be` |
| P Image Digest | `sha256:7369d0471d58ed27add9b6a9fc1d9fb28c99e9de7e006620127fd01ecea3933b` |
| P 명세 | `helpdesk-learning:4` |
| B Source | `3fdbdebf020f0cfd3dc1fcaf9436e30810d9cbba` |
| B CI·전달 Run | `38910121880`, Attempt 1, 성공 |
| B Image Digest | `sha256:12a649fdea221e79038d0676191f91b9ac64cb2930b5927a0973089fbda98cfa` |
| B 명세 | `helpdesk-learning:5` |

[B Run](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/38910121880)은 고정 main Source의 실제 PostgreSQL을 포함한 Java 704개·JavaScript 254개·ESLint·Image Build를 통과했다. 같은 검증 Image를 기존 ECR에 전달했고 Publish Evidence의 Source·Tag·Digest를 확인했다. 기존 A·P Image는 삭제하지 않았다. 전달 성공과 아래의 Cloud 실행은 별도로 확인한다.

P와 B의 운영 차이는 개인정보 검사·실패 처리 연결과 V8 등 8개 파일이다. 새 실패 코드를 읽는 Java Enum과 UI는 P에 이미 포함돼 있다. 실제 P :4의 저장 JSON 전체를 DOM에서 읽고 B Digest 한 개만 바꿨다. 등록된 :5 JSON도 읽어 AWS 등록 메타데이터를 제외한 모든 입력이 후보와 일치하는지 대조했다. 원본 RDS의 전체 JDBC URL·verify-full·여섯 Parameter 참조·Execution Role·사양·Cookie 설정·AI 비활성은 유지했다.

## 전환 전 DB 기준

App 계정의 `verify-full` 접속에서 TLS 1.3을 확인했다. 검토된 접속 도구가 임시 공개 CA 파일을 복원·Hash 검증하며 Password는 작성자가 직접 입력했다. 비밀값을 명령·문서에 넣지 않았다.

기존 복원 검증 SQL의 같은 직렬화·정렬·UTC/DateStyle 설정으로 Repeatable Read·Read-only 조회를 실행했다.

| Table | Row 수 | 내용 SHA-256 |
|---|---:|---|
| tickets | 2 | `e98b0eb8f1593d9658ab9b83a671c3cd9f298f3a1e48641532ce5ce77ef21dfb` |
| ticket_messages | 2 | `c90fd9002e687e391da5a15368fae5b6d953704b3e6e1b6f712c36e88ae09976` |
| ai_suggestion_jobs | 2 | `f20c6cc9aad385a08aea2cec82482ba8a1b4d9e97893ac4779a4bac8fb05cb72` |
| ai_suggestion_attempts | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| ticket_suggestions | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| ticket_suggestion_categories | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |

Flyway 이력은 7건·최고 버전 7이며 내용 Hash는 `6dfcd8aa1cd09b0e2c31aca83fa249cfe1224a7439defb8c3a3b8fd2c9576006`이다. B의 V8 적용 뒤에는 이력 증가를 따로 확인하고 여섯 업무 Table을 같은 기준과 비교한다. 전환 직전 기존 AGENT Session으로 Ticket 1의 `배포 학습 문의`·OPEN 조회도 성공했다.

## 합성 SQL의 로컬 사전 검증

Lab의 `deploy/rollback/cloud-compatibility-fixture.sql`과 `RollbackCloudFixtureIntegrationTest`를 추가했다. 별도 PostgreSQL 17.6 Testcontainer에서 V7 실행 거부·V8 적용 후 새 실패 두 건 추가·기존 문의/원문/작성자/Job 내용 보존·중복 실행 거부를 확인했다. Test 1개가 실패·오류·건너뜀 없이 통과했다. 운영 Java 코드와 B Image의 고정 Source를 바꾸지 않은 별도 관리 SQL 검증이다.

제목·본문·작성자·정책 버전에서 합성 SQL 자료임을 구분한다. 두 Attempt도 표시된 검증 Row이며 실제 Provider 실행/과금 횟수로 합산하지 않는다. 새 문의·Job·Attempt를 추가할 뿐 기존 Row를 수정하거나 Suggestion을 만들지 않는다.

## 실행 진행

- 기존 P 명세 :4·Digest·원본 RDS/V7·AGENT 조회 성공을 확인했다.
- B :5의 저장 설정과 단일 Fargate 실행 폼을 대조했다. 기존 Subnet/App 그룹·공인 IP·Fargate 1.4.0·직접 Project 요청 태그를 유지하고 추가 지표·ECS Exec·Service는 활성화하지 않았다.
- 지정 P Target 한 개의 등록 해제 후 실제 Draining을 확인했다. 기존 300초 뒤 Target 0개와 P Task 종료 코드 143을 확인하고 B Task 한 개를 실행했다.
- B Task `a00ebe6675cd4035ae8b188aeb781f8d`의 명세 :5·실제 ECR Digest 일치를 확인하고 새 Private IP:8080을 기존 Target Group에 등록했다. 부가 Capacity Provider 조회 거부는 권한 추가 없이 직접 Fargate 시작 유형으로 처리했다.
- Log에서 원본 RDS 연결·Migration 8개 검증, 23:03:48 KST의 V8 적용 완료와 23:04:13의 Spring 기동을 확인했다. 기동 시간은 80.49초였다.
- V8 적용 뒤 여섯 업무 Table의 Row 수·Hash는 위 기준과 모두 일치했다. Flyway 이력은 8건이며 내용 Hash는 `632e887c17ae3e08224ce2659d47e2d310895959f819124c32745517d8630b68`이다.
- 검증한 합성 SQL의 DO·COMMIT 뒤 Ticket/Job 3과 4가 새 두 실패로 저장됐다. 두 Ticket은 OPEN, 두 Job은 FAILED·각 원래 코드·Attempt/생성 예약 1·AUTO_RETRY_BLOCKED·Suggestion 0건이다. 이 두 예약은 합성 자료이며 실제 AI 실행 이력이 아니다.
- 기존 Health 설정을 유지한 Target 한 개가 Healthy로 전환됐다. 익명 HTTPS는 Health 200/UP·로그인 200·보호 Ticket 조회 401이었다. P에서 전환 직전 성공했던 같은 Browser Session의 조회는 B에서 ‘로그인이 필요합니다’로 거부됐으며 AGENT 재로그인을 요청했다.
- 작성자의 AGENT 로그인 뒤 실제 Browser에서 Ticket 1의 JSON·OPEN과 Ticket 2의 제목·OPEN을 확인했다. UI 조회로 기존 두 Job의 PENDING·최종 실패 코드 없음, 합성 Job 3/4의 FAILED·각 원래 PRIVACY_SCAN 코드를 확인했다. 조회는 재시도나 상태 변경을 실행하지 않았다.
- CloudShell의 무입력 세션 종료 뒤 기존 VPC 환경을 재연결했다. 공개 CA를 복원·검증하고 작성자가 App 암호를 직접 입력해 다시 접속했다. DB 설정·Password·보안 그룹은 변경하지 않았다.
- 합성 자료까지 포함한 아래의 전체 Hash를 Read-only Transaction으로 확보했다. 이후 B Target `10.42.0.49:8080` 한 개의 등록을 해제하고 Draining을 확인했다. 기존 300초 뒤 등록 대상 0개, B Task의 STOPPED와 Container 종료 코드 143을 확인했다.

## P 복귀 직전의 DB 대조값

| Table | Row 수 | 내용 SHA-256 |
|---|---:|---|
| tickets | 4 | `544cd998a44fd829a33bad8ad4186fc8890a2c29112b96711c88bdd64f0fdfc8` |
| ticket_messages | 4 | `c8f455e3ce26134fb6cca8ec1d079595e8a1334f0e5234bee63a7a80f161e01c` |
| ai_suggestion_jobs | 4 | `bf20ce61b516a77a19d20e20a2add6f3ba3742f2ab7c6a0c4ee640f9c335e5a7` |
| ai_suggestion_attempts | 2 | `00807371d8d37083eab1eb1b69a379aebd1652bfe6ca7074833ce02998090a35` |
| ticket_suggestions | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| ticket_suggestion_categories | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |
| flyway_schema_history | 8 | `632e887c17ae3e08224ce2659d47e2d310895959f819124c32745517d8630b68` |

CloudShell 도구는 psql 16.15, RDS는 PostgreSQL 17.11로 주 버전 차이 경고가 있었다. SQL 실행·결과 표시는 더 새 서버에서도 동작할 수 있지만 `\d` 계열 등 도구 명령은 실패할 수 있으므로, 장기 관리 도구는 psql 17.x로 맞추는 안을 제시했다. 이번에는 도구 설치나 RDS 변경 없이 위 SQL 조회를 수행했으며 TLS 1.3 연결도 확인했다. [PostgreSQL psql 호환성 안내](https://www.postgresql.org/docs/17/app-psql.html#APP-PSQL-NOTES)

## P 복귀 결과

기존 P 명세 :4의 실행 폼에서 Task 한 개·Fargate 1.4.0·같은 Subnet/App 보안 그룹·Project 요청 태그를 다시 대조했다. B의 STOPPED 뒤 새 P Task `83c5e0d0bf2a42ce98a130136bc814d7` 한 개를 실행했다. 실제 Container의 Digest가 위 P와 같았고 새 Private IP `10.42.0.250:8080`을 같은 Target Group에 등록했다.

10/17 00:06:39 KST의 Log에서 원본 RDS의 verify-full JDBC URL 연결을 확인했다. Flyway는 현재 DB 버전 8이 P의 최신 Migration 7보다 높다고 경고했지만 추가 Migration 없이 기동을 이어갔다. 00:07:06에 Spring 시작을 마쳤고 기동 시간은 81.706초였다. 이후 기존 Health 기준으로 Target 한 개가 Healthy가 됐으며, 공개 HTTPS의 `/actuator/health`에서도 `{"status":"UP"}`을 확인했다. 경고 자체가 업무 조회 성공의 근거는 아니므로 아래의 Row·Browser 대조를 함께 수행했다.

P 기동 뒤 일곱 Table의 건수와 내용 Hash가 위 복귀 직전 값과 모두 일치했다. B에서 유효했던 Browser Session으로 새 조회를 실행하자 ‘로그인이 필요합니다’가 나왔고, 작성자가 기존 AGENT로 직접 재로그인했다.

| P에서 조회한 대상 | 결과 |
|---|---|
| 기존 Ticket 1 | 배포 학습 문의·OPEN |
| 기존 Ticket 2 | CSRF 누락 검증·OPEN |
| 기존 Job 1/2 | PENDING·최종 실패 코드 없음 |
| 합성 Job 3 | FAILED·PRIVACY_SCAN_TIMEOUT |
| 합성 Job 4 | FAILED·PRIVACY_SCAN_INVALID_RESULT |

인증된 조회를 모두 마친 뒤 같은 Read-only SQL을 한 번 더 실행했다. 일곱 Table의 건수와 Hash가 다시 모두 일치했다. P로 프로그램을 복귀해도 V8·원문·작성자·Job·새 실패 값은 남았으며 조회가 재시도나 상태 변경을 시작하지 않았다.

최종 상태는 원본 RDS V8과 단일 P Task :4다. IAM·DNS·Secret·보안 그룹·로그 보존은 바꾸지 않았고, 외부 AI 호출과 실제 개인정보 검사기는 실행하지 않았다. A·P·B Image와 원본 RDS·검증 Snapshot을 유지한다. 합성 자료도 남겨 두었으며 삭제나 추가 접수는 이번 검증에 포함하지 않는다.

화면 증빙은 Lab의 Git 제외 경로 `local/deployment/bp-cloud/`에 보관했다. `p-return-session-rejected.png`, `p-return-timeout-read.png`, `p-return-invalid-read.png`, `p-return-existing-ticket2.png`에서 P 전환 뒤 Session 거부·새 실패 값·기존 문의를 확인할 수 있다.
