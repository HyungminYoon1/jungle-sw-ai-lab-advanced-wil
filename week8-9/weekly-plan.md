# Week 8–9 통합 학습 계획 Docker와 CI에서 AWS HTTPS 배포까지

> 작성일: 2026-10-07
> 최종 수정일: 2026-10-20
> 상태: In Progress — HTTPS·DB 복원과 원본 복귀, A→P·B 적용·P Image 복귀 검증 완료. V8·업무 Hash 보존과 재로그인 조회를 확인했다. 전체 AI·나머지 마감은 미완료.
> 초기 목표 기간: 2026-10-08 목요일 ~ 2026-10-12 월요일. 실제 연장을 반영해 Week 8–9 통합으로 변경
> 초기 학습일: 10/8·10/9·10/10·10/12, 총 4일
> 현재 진행: 기존 Cloud 기준에 이어 10/20 로컬 합성 구성의 통합 Timeout·비정상 종료·자원 회수를 확인했다. 개인정보 V2·모델 고도화는 후속으로 유지한다. 새 코드의 Cloud 검증·실제 비용/보관량·Cloud 실제 AI·DNS·최종 마감은 남아 있다.
> 재개 상태: 10/20 화요일 학습 진행 중. 첫 통합 실패 검증을 마쳤으며 종료일은 실제 잔여량을 보고 정한다.
> 초기 순학습 시간 배분: 하루 10시간, 총 40시간. 휴식·식사와 단순 대기 시간 제외. 완료에 필요한 시간의 상한은 아님
> 모드: `DEEP_LEARNING_MODE`
> 핵심 질문: 이미 검증한 문의 접수와 AI 제안 흐름을 Cloud의 HTTPS 환경에 배포하고, 실패 원인을 찾으며 이전 실행 상태로 복구할 수 있는가?

## 계획 배경

7주차에는 Browser 접수부터 자동 Worker·실제 AI·PostgreSQL·담당자 조회까지 연결했다. 10/5 회차 이후 이틀을 더 사용해 10/7에 학습과 WIL 공개를 마쳤다. 8–9주차는 그 흐름을 새로운 실행 환경으로 옮기는 하나의 배포 과정이다. 화면이나 업무 기능을 늘리지 않고, 같은 코드가 어디서 실행되며 데이터와 Secret은 어디에 남는지 확인한다.

Docker·CI·System·관측·IAM·ECS·ECR·RDS·DNS·HTTPS·복구를 모두 유지한다. 처음에는 4일에 집중 배치했지만 실제 이해·구현·검증에 더 많은 기간을 사용했다. 10/17의 [통합 결정](../plan/decisions/0004-combined-week8-9-deployment-learning.md)에 따라 디렉터리와 계획을 Week 8–9로 묶고 기존 세부 범위와 완료 기준은 보존한다.

40시간은 초기 배분을 위한 추정치였다. 설정 문제에 시간이 들었다고 개념 설명·실패 실험·복구·복습을 생략하지 않는다. 미완료 학습은 같은 통합 과정의 잔여로 추적하며, 기간이 지났다는 이유로 완료 처리하지 않는다.

초기 10/11의 야간 선택 재개 여부와 10/17·10/18 휴무는 당시 일정 기록으로 남긴다. **10/19 회차를 마감하고 남은 학습은 10/20에 이어간다.** 하루에 남은 전체 분량을 끝내도록 압축하지 않는다. Week 10–12의 취업 과업은 뒤로 밀지 않고, 취업 우선 기간에는 잔여 기술 학습·Project 보완·마감 후 수평 확장을 합쳐 주 6시간 이내에서 나눈다.

## 10월 19일 마감과 10월 20일 재개

19일에는 메모리·Log 문답, 기존 Cloud의 HTTP Metric과 로컬 합성 구성의 실행·자원을 확인했다. 남은 과업은 아래 순서로 20일에 이어간다. 개념을 짧게 설명하고 핵심 질문 2~3개로 이해를 확인한 뒤 작은 구현과 Test를 진행하며, 이미 확인한 로그인·복원·Image 전환 전체를 처음부터 반복하지 않는다.

19일 재개에서는 가상/실제 메모리와 전체 AI의 Peak 측정 필요, HTTP/AI 시간과 Job/Attempt 구분을 문답으로 확인했다. 접수 Commit·Handler·Worker Log의 식별자를 로컬에서 연결하고 당시 핵심 Test 44개·전체 Java 724개를 통과했다. 이어 실제 자식 JVM 강제 종료의 DB 연결·Lock 정리와 미완료 변경 취소, Commit된 Job·Attempt·예약 보존을 확인했고 재시작 Class 전체 6개가 통과했다. [학습노트](./study-notes/2026-10-19-study-questions.md)·[Log 검증](./lab-reports/2026-10-19-request-job-log-correlation.md)·[종료 관찰](./lab-reports/2026-10-19-process-db-connection-shutdown.md)에 연결한다.

이후 실제 AWS의 P Task 1개·Target Healthy·HTTPS Health UP·RDS 사용 가능, 명세의 AI 비활성과 AGENT HTTP Metric을 확인했다. 전체/Health/Job 조회의 집계 범위, 누적 Count·시간과 시간 구간 MAX, 조회 성공과 AI 성공의 차이를 구분했다. 새 Log의 Cloud 배포·대표 실패 추적·실제 누적 비용/저장량·전체 AI 자원 측정은 남아 있다.

로컬 검사 실행에는 `ProcessAiPrivacyScanner`를 추가했다. 원문의 stdin 전달·Byte/시간 제한·해당 Process와 I/O Thread 회수, PostgreSQL의 정상 저장·실패 저장·원문/예약 보존을 확인했다. 핵심 150개·최종 전체 Java 754개가 통과했으며 [실행 보고서](./lab-reports/2026-10-19-privacy-process-transport.md)와 [결정 기록](../plan/decisions/0005-local-privacy-process-transport.md)에 범위를 정리했다. 검사 응답은 Test Fixture이며 실제 모델·관계 보존 계약·Linux 실행과 Main 조립은 미완료다. AWS·실제 AI·Image는 변경하지 않았다.

이어 Exit Code의 기본 개념을 보완하고 다른 한국어 개인정보 후보를 같은 합성 12건으로 비교했다. 실제 Linux 모델 실험은 종료 코드 0·OOM 없음이었지만 후보 처리 흐름은 5건 통과·4건 BIO 거부였고 이름 누락·오탐이 남아 채택하지 않았다. 새 Decoder Test 18개와 기존 정책 Test 10개는 통과했다. [후보 비교 보고서](./lab-reports/2026-10-19-koelectra-privacy-probe.md)·[분리 평가 결정](../plan/decisions/0006-offline-privacy-model-comparison.md)에 기록한다. Linux에서 모델을 실행한 것과 Java Transport의 Linux 종료·회수, Main 연결·전체 AI 자원 검증은 다르다. 기존 Dataset·Java Main·AWS·배포 Image는 유지했다.

인물 관계 V2는 등장 번호와 SAME·DIFFERENT·UNDETERMINED를 분리한 구조 검증기와 독립 치환기까지 구현했다. 치환 Test 37개와 앞선 핵심 402개를 합친 439개가 통과했다. [V2 검증 보고서](./lab-reports/2026-10-19-person-relation-v2-validation.md)의 PostgreSQL 결과는 V1 회귀이며 V2→DB 연결이 아니다. 실제 모델 후보의 5/12 성적과 직전 전체 Java 754개도 각각의 실행 근거로 유지한다. 이후 V2 전송 연결과 모델 정확도 고도화는 아래 후속 과업으로 분리한다.

### 배포 학습으로 복귀하는 기준

8–9주차의 중심은 같은 업무 코드를 Cloud에서 실행하고 실패·관측·복구를 이해하는 것이다. 10/19 사용자 승인에 따라 인물 관계 V2와 개인정보 모델 고도화를 배포의 공통 선행 조건에서 분리한다. 기존 구현·정책·평가 결과는 보존하며 완료로 바꾸거나 버리지 않는다. [배포와 후속 고도화의 분리 결정](../plan/decisions/0009-deployment-first-and-deferred-privacy-enhancement.md)을 따른다.

최소 선행 작업은 실행할 부품의 명시적 조립, 필수 설정 누락의 기동 거부, Linux에서의 Process·Pipe·Timeout/회수, 제한 자원 아래의 동작 확인이다. 인물 관계 판정·새 Placeholder·새 모델의 일반 정확도 개선을 이 작업 앞에 계속 추가하지 않는다.

첫 선행 검증으로 기존 Process Test 24개를 실제 Linux에서 CPU 1개와 0.25개로 각각 통과했다. 관련 Windows 63개·JavaScript 전체 268개도 통과했다. [Linux 실행 보고서](./lab-reports/2026-10-19-linux-process-transport.md)에 현재 Class의 Mount 실행과 배포 Image·전체 App 검증의 차이를 정리했다.

이어 [고정 합성 전용 구성](../plan/decisions/0010-fixed-synthetic-deployment-configuration.md)의 조건부 개인정보 Bean·입력 제한·같은 JAR의 자식 실행을 연결했다. 새 Unit Test 41개와 실제 JAR·Spring 개인정보 Bean·수동 Worker Tick·PostgreSQL·로컬 HTTP의 두 Case가 통과했다. 범위 밖 입력은 외부 전송 없이 기존 실패 코드로 기록하고 원문·예약을 유지했다. 전체 Java `verify` 1,004개 + 패키징 후 2개, JavaScript 268개도 통과했다. [합성 구성 실행 보고서](./lab-reports/2026-10-19-synthetic-deployment-configuration.md)에 근거와 재검증을 정리한다. Provider·Worker의 기본 비활성과 V1 검증/Guard를 유지하며 V2·모델은 추가 연결하지 않았다.

새 Image에서 자동 Worker·합성 검사 자식·PostgreSQL·통제된 Spring AI HTTP를 연결한 자원 실험 두 번도 통과했다. 0.25 CPU·512 MiB의 최고 메모리는 310.79·290.21 MiB였고 OOM은 없었다. 각 실행의 자동 성공 3건·범위 밖 실패 1건, 원문/예약 보존·자식 회수를 확인했다. [자동 실행 자원 보고서](./lab-reports/2026-10-19-synthetic-runtime-resources.md)에 Main JAR 실행·Test 전용 Provider Factory와 일반 Provider 구성의 차이를 기록했다. 이번 관련 Java 124개·JavaScript 전체 276개도 통과했다. 마감 문답에서는 로컬 모델이 Task 메모리를 사용하며 Peak는 현재 사용량과 달리 유지될 수 있음을 설명했다. 다음은 전체 App의 고의 실패 자원 실험이며, 새 Log의 Cloud 확인·실제 비용/보관량·DNS와 실제 AI는 남은 순서로 유지한다.

실제 AI 배포 실험은 고정 합성 문의만 대상으로 분리한다. 합성 전용 구성은 허용한 입력과 실행 범위를 강제해야 하며, 임의 문의를 빈 검사기로 통과시키는 Main 기본값이 되어서는 안 된다. 통제된 검사 응답의 실행 검증과 실제 탐지 품질은 따로 기록한다. 일반 입력의 AI 활성화·실사용 개인정보 보호 완료를 이 실험의 성공으로 주장하지 않는다.

20일 첫 검증에서는 같은 Main Image의 정상·Timeout·비정상 종료를 분리 실행해 모두 통과했다. 실패 자식이 정상 JSON을 출력한 지점과 실제 종료를 대조했고 HTTP/제안 0건·원문/예약 보존·Process/Thread 회수를 확인했다. [통합 실패 보고서](./lab-reports/2026-10-20-synthetic-runtime-failure-cleanup.md)의 최고 메모리는 정상 300.26·Timeout 460.54·비정상 종료 265.88 MiB이며 OOM은 없었다. 처리 전 수치도 달라 실패 Mode 하나의 효과로 비교하지 않는다. 관련 Java 129개·JavaScript 전체 279개 통과, 실제 AI·AWS·Push/CI/ECR은 미실행이다. [20일 노트](./study-notes/2026-10-20-study-questions.md)의 설명과 이해 확인 질문에서 이어간다.

기존 V1 JSON·위치 검증과 Known Fragment Guard, 실패 시 외부 전송 중단, Ticket·Message·예약·현재 Attempt 보존은 유지한다. 전체 AI 연결 전에 필요한 최소 구성과 실제 전송 직전 Body 검사는 확인하되, V2를 먼저 연결할 의무는 없다. 외부 AI·AWS 변경은 그날의 실행 범위와 비용을 별도로 확인한다.

| 순서 | 배포 학습과 구현 | 현재 근거와 다음 확인 |
|---|---|---|
| 1. Linux 실행과 회수 | 기존 Process 24개를 CPU 1개·0.25개에서 각각 통과. 정상/비정상·Timeout·중단·다른 Process 보존·회수 확인 | 이 독립 실행 Gate는 확인. Spring App·Worker·실제 모델·DB를 포함한 전체 실행/자원은 2~3번에서 검증 |
| 2. 최소 실행 설정 | 합성 전용 입력 제한·검사 JAR/시간 필수 설정·V1 Preparer/Guard Bean을 구현. Unit 41개·패키징 후 PG 2개 통과 | Provider·Worker 스위치는 별도 유지. 로컬 자동 실행은 3번에서 확인. 일반 Provider Configuration/실제 Key·Cloud 실제 AI는 5번에 남음 |
| 3. 전체 조립과 자원 | 19일 정상 처리 두 번에 이어 20일 정상·고의 Timeout·비정상 종료의 전체 App 검증 통과. 0.25 CPU/512 MiB·OOM 없음, 실패의 원문/예약 보존·HTTP 0회·Process/Thread 회수 확인 | 로컬 합성 구성의 이 단계는 확인. Test 전용 실패 Scanner·통제된 HTTP를 사용했으며 일반 Provider/실제 Key·Cloud는 5번에 남음. 실제 모델·장기 부하의 자원으로 확대하지 않음 |
| 4. Cloud 관측과 비용 | 새 Request/Job Log·대표 실패·HTTP/AI 지표와 실제 과금·저장/보관 비용 확인 | 확인한 Task·Target·RDS 기준을 재확인하며 전체 복원·Rollback을 반복하지 않음. 새 배포는 CI·Image Digest·기존 승인 범위 확인 후 실행 |
| 5. Cloud 실제 AI | 합성 전용 구성·검증 Image/명세·Secret 참조·필요 사양 확인 후 실제 AI·RDS·AGENT 화면 연결 | 당일 호출 범위/비용·리소스 변경 승인 후 진행. 임의 사용자 원문은 대상에서 제외하고 기존 PENDING의 기한·예약을 초기화하지 않음 |
| 6. DNS 비교 | 기존 Cloudflare 서비스 DNS는 유지하고 Route 53 Hosted Zone·NS·Alias와 직접 조회를 별도 실험 | 기존 메인 DNS 이전 없이 책임을 비교. 새 Zone 등 유료 리소스 생성은 범위·비용 승인 뒤 실행 |
| 7. 최종 마감 | 변경 Code의 Local/CI 회귀·Cloud Browser 재검증, 자료 없는 설명·직접 설정 수정·재현/비용/보관 검토·통합 WIL | 실제 결과와 미완료 상태를 유지. 블로그/포럼은 작성자 확인 뒤 각각 완료 처리 |

4번과 6번처럼 독립적으로 가능한 배포 실험은 앞선 설정·자원 검증과 병행할 수 있다. 5번 전에는 1~3번에서 그 실험 구성의 실행·입력 범위·전송 검사를 확인한다. 후보 모델의 채택 보류를 해제하거나 개인정보 검사를 생략한 것으로 기록하지 않는다.

### 10월 20일 재개 순서

1. **전체 App의 실패와 회수 완료:** 기존 합성 Image·통제된 Provider 구성에서 정상·고의 Timeout·비정상 종료 세 실행을 마쳤다. 실패 Job·원문·예약·전송 0회와 Process/Thread 회수를 실제 PostgreSQL·cgroup에서 확인했다. 결과와 제한은 위 보고서를 따른다.
2. **Cloud 관측과 비용:** 현재 Task·Target·RDS와 실행/보관 비용을 먼저 확인한다. 새 Log를 확인할 배포는 변경 검토·Push·CI·ECR 전달·정확한 Digest와 실행 범위를 확인한 뒤 진행한다. Request/Job/Attempt와 대표 실패를 추적하고 실제 사용량·365일 Log 보관 등 남는 비용을 정리한다.
3. **합성 입력의 실제 AI 배포:** 앞선 실행 조건을 충족하면 별도 승인한 입력·호출/비용·Secret 참조·Task 명세로 실제 AI·RDS·AGENT 화면을 확인한다. 로컬 응답 Fixture나 기존 P 배포본의 Health를 이 결과로 바꾸어 기록하지 않는다. 일반 입력과 개인정보 모델 고도화는 활성화하지 않는다.
4. **DNS와 최종 마감:** Cloudflare DNS를 유지한 Route 53 비교·별도 조회, 변경 Code의 Local/CI·Cloud Browser 회귀, 자료 없는 설명·설정 수정과 WIL을 이어간다. 유료 리소스 생성·게시·삭제는 각각의 실행 범위를 확인한다.

20일은 남은 학습을 재개하는 날이지 모든 항목의 완료 기한이 아니다. 1번을 마쳤고 다음은 2번의 현재 Cloud 상태·비용과 새 Log 검증 준비다. 이후는 선행 조건·승인·실제 가용시간에 맞춰 나눈다. 취업 우선 일정과 주간 기술 과업 6시간 상한을 유지하며, 추가 날짜는 회차 마감 때 조정한다. 이번 로컬 검증에서는 AWS 실행 리소스·권한·Secret을 변경하거나 실제 AI를 호출하지 않았다.

### 배포 마감 이후의 후속 과업

| 후속 과업 | 보존한 결과 | 재개할 때 확인할 것 |
|---|---|---|
| 인물 관계 V2 연결 | 독립 구조 검증·치환과 439개 핵심 회귀 | Guard와 생성 표시의 충돌, 관계를 잃지 않는 Provider 입력, 실제 전송 Body·DB/Worker 회귀 |
| 개인정보 모델 고도화 | 기존 두 후보의 고정 합성 평가·누락/오탐과 채택 보류 | 명시적 채택 기준·일반화 평가·관계 보존·License/의존성·모델을 포함한 전체 자원 |

후속 과업은 일반 입력의 AI 처리를 확장하기 전에 검토한다. 배포 학습의 남은 관측·DNS·회귀·WIL을 이 고도화 때문에 계속 미루지 않는다. Week 10–12 취업 일정과 Project 주 6시간 상한을 유지하며 후속 시작 날짜는 자동 확정하지 않는다.

**완료한 기준선:** HTTPS 로그인·Role·CSRF 접수/SQL Row, 별도 Snapshot/RDS의 SQL/App 복원·원본 복귀, A→P→B→P와 V8/업무 Hash·원래 실패 코드 보존, psql 17.11 TLS와 로컬 Process/Log 관찰이다. 복원·Rollback은 필요 변경의 회귀 범위로만 확인하며 새 전체 재실험을 자동 배정하지 않는다.

휴무는 실행 리소스가 자동 중지됐다는 뜻이 아니다. 이번 문서 정리에서는 AWS·AI·DNS·Secret·권한을 변경하지 않으며, 다음 실행 전 보관 비용과 필요한 중지/재개 범위를 확인한다. 학습 범위·보안 조건·월 3만 원은 상한이라는 최소 비용 원칙을 유지한다.

## 통합 과정 목표

| 주제 | 설명할 내용 | 직접 확인할 근거 |
|---|---|---|
| 실행 환경 재현 | Image·Container·Process·Network·Volume의 차이 | Docker Build 비교, Compose 저장·조회와 재생성 후 Row 유지 |
| 변경 검증과 배포 | CI 성공, Image 생성, 배포 성공이 서로 다른 이유 | 실제 Actions 실패·복구, ECR Digest와 ECS 실행 Image 대조 |
| Cloud 요청 흐름 | DNS·TLS·ALB·Security·RDS와 IAM의 역할 | HTTPS 로그인·접수·AI 처리·담당자 조회, 권한·Cookie·DB 확인 |
| 장애 관찰과 복구 | Process 종료, Health 실패, AI 실패와 DB 손실의 차이 | Signal·Exit Code, CloudWatch Log·Metric, 이전 Image 복귀와 Backup 확인 |

### 빠짐없이 다룰 세부 범위

아래 항목은 4일에 모두 배치한 필수 범위다. 날짜를 넘겨도 항목 자체를 선택 과제로 낮추지 않는다.

| 학습 묶음 | 세부 개념과 구현 | 실험에서 확인할 것 | 초기 배정일 |
|---|---|---|---|
| Docker Build | Image·Container·Layer, Dockerfile, Build Context·`.dockerignore`, Build Cache | Layer 순서와 변경 파일에 따른 Cache Hit·Miss, 같은 Source에서 실행 환경 재현 | 10/8 |
| Compose와 영속성 | Service Network·Port, 환경별 설정, Volume, 준비 완료와 시작 순서 | 실제 PostgreSQL 저장·조회, Container 교체와 Volume 유지, 같은 DB 재연결 | 10/8 |
| 배포용 실행 설정 | Provider Adapter·Worker·검증기 연결, 사용자·Role, Secret 주입 | 필수 설정 누락 시 실패, 기본 유료 호출 비활성, 허용한 구성에서 기존 업무 흐름 실행 | 10/9 우선, Cloud 연결 시 재검증 |
| Linux System | Process, `/proc`, Signal·Exit Code, Graceful Shutdown, 표준 출력과 CLI Log Pipeline | 정상 종료와 강제 종료의 차이, 요청·DB Connection·Job·Session의 남은 상태 | 10/9 |
| CI와 Image 전달 | GitHub Actions Build·Test·정적 검사·Image Build, ECR Tag·Digest | 실제 CI 실패와 복구, 검증한 Commit과 배포 Image의 대응 | 10/9 착수, 10/10 배포 전 마감 |
| IAM과 Network | User·Role·Policy·최소 권한, OIDC, Task Role·Execution Role, Subnet·Security Group·Outbound | IAM 거부와 Network 차단의 차이, 필요한 권한만 추가한 뒤 성공 | 10/9 선행 조건 확인, 10/10 적용 |
| Cloud와 Database | ECS Service·Task와 ECR의 책임, RDS 관리 범위, Migration·DB 접속 | 실제 RDS Row, Application 재배포 후 보존, 운영자가 여전히 책임지는 설정·데이터 | 10/11 야간 또는 10/12부터, 선행 조립·승인 후 |
| DNS와 HTTPS | Route 53, DNS 조회·검증, ACM, TLS 신뢰 사슬·종료 위치, HTTP Redirect | 올바른 Hostname의 인증서, HTTPS 요청, Secure Cookie·Session·Role·CSRF | Cloud 연결 뒤 진행. 초기 10/10 첫 연결 목표는 미달성 |
| 관측 | 구조화된 Log, Request ID·Job ID, Health, Request·Error·Latency Metric, CloudWatch | 실패 Request를 Log와 Metric에서 찾아 원인 계층 설명, Secret 노출 여부 | 10/9·10/12 |
| 복구와 마감 | 이전 Image로 Rollback, RDS Backup 보존·Snapshot 복원, 회귀·재현·비용 정리 | 앱 Version 복귀와 DB 복원 구분, 복원 DB의 실제 Row, WIL과 수직 흐름 설명 | 10/10·10/12 |

## 시작 기준과 먼저 연결할 부분

| 항목 | 7주차 마감 기준 | 8–9주차 통합 과정에서 할 일 |
|---|---|---|
| 업무 흐름 | 최초 Message·Job의 접수 원자성, 별도 AI 처리·제안 저장, AGENT 조회 구현 | 같은 Controller·Service·Repository 경계를 유지해 배포 |
| 회귀 근거 | Java 461개·JavaScript 145개·ESLint, 별도 실제 Browser·AI 연결 실험 | Container·CI·Cloud 변경 뒤 다시 실행하고 환경별 결과를 구분 |
| 실제 AI 실행 | 격리된 실험에서 Spring AI와 자동 Worker 연결 확인 | 입력 범위를 강제한 합성 전용 배포 실험에서 Provider·검증/Guard·Worker·Secret 연결. 일반 입력의 개인정보 품질은 후속 Gate |
| 사용자와 Session | `local-browser`의 In-memory 사용자와 서버 메모리 Session | 학습용 배포 계정·Secret 주입을 분리하고 재시작 후 재로그인 확인 |
| 데이터 | PostgreSQL Adapter·Flyway와 같은 DB를 유지한 Process 재시작 검증 | Compose Container 재생성·Volume 유지, 같은 RDS를 유지한 Application 재배포와 Backup 확인 |
| 배포·관측 | Dockerfile·Compose, 최소 Health·HTTP Metric·종료 설정과 로컬 Test 확인. 실제 Actions 실패·복구·OIDC 인증·ECR 업로드 확인 | 권한 거부·Cloud 실행·관측과 HTTPS 검증을 이어간다 |

현재 Worker는 활성화 설정 외에 Provider·개인정보 처리기·출력 검증기를 명시적으로 제공해야 한다. Image만 만들거나 Worker 설정값만 켜는 것으로 실제 AI 배포가 끝나지는 않는다. 배포용 설정의 누락·잘못된 조합을 안전하게 거부하고, 기본 실행이나 일반 CI가 유료 호출을 시작하지 않도록 Test를 둔다.

## 학습과 구현의 경계

### 유지할 구현 범위

- Spring Application 한 개 안에서 기존 API와 Worker를 실행하고 PostgreSQL에 저장한다.
- Browser UI와 API는 같은 Origin을 사용한다. Session·Role·CSRF 계약은 그대로 유지한다.
- 최초 문의 등록·Ticket 조회·AI 제안 조회만 대상으로 한다. AI가 Ticket 상태를 바꾸거나 공식 답변을 게시하지 않는다.
- 외부 AI 호출은 합성 문의로 검증하고 실행 전에 당일 호출 범위와 비용 조건을 확인한다. 이전 날짜의 승인을 자동으로 이어 쓰지 않는다.

### 배포 구성 초안

기존에 선택한 AWS 서비스를 사용하는 한 환경을 구성한다. ECR에 Image를 저장하고 ECS Fargate에서 Application 한 개를 실행하며, RDS PostgreSQL에 데이터를 둔다. 사용자가 확인한 `helpdesk.hmyoon.com`의 DNS는 기존 Cloudflare에 유지하고, ACM 인증서를 사용하는 ALB로 직접 HTTPS 접속하는 DNS-only 구성을 우선 검토한다. Route 53의 Hosted Zone·NS·Alias 비교와 별도 DNS 조회 실습은 유지한다. ALB는 요청을 Application으로 전달하는 진입점이며 이번에 여러 Application으로 부하를 분산하는 기능을 학습 범위에 추가하지 않는다.

서울 `ap-northeast-2`, 최대 12개월 보관·월 지출 상한 3만 원·실습할 때만 실행하는 조건을 확인했다. 3만 원은 사용할 목표액이 아니라 최대 금액이다. Application·학습·보안·영속성의 목적을 충족하면서 크기·수량·실행 시간·보관 비용을 최소화한다. [AWS 배포·비용 초안](./deployment-plan.md)에 비용 선택 기준과 월 60시간의 초기 계산을 구분해 정리했다. 60시간이나 초기 보관량을 모두 사용할 필요는 없다. 사용량·실제 환율·세금·접근 권한·DNS 변경 범위와 생성 범위는 실행 전에 확정한다.

실제 리소스 생성 전에는 다음 조건을 검토해 배포 기록에 확정한다.

- **단일 실행:** Task 교체 시 기존 실행 종료를 확인하고 새 실행을 시작하는 중단 허용 방식을 우선한다. 분산 Session·여러 Worker와 무중단 배포는 추가하지 않는다. Session은 사라져도 Ticket·Message·Job·Suggestion은 RDS에 남아야 한다.
- **접근 제한:** 합성 데이터와 학습용 USER·AGENT만 사용한다. 학습자 접속 IP로 진입 범위를 제한하고, Application은 ALB에서만, RDS는 Application에서만 접근하도록 한다. RDS를 인터넷 전체에 공개하지 않는다.
- **사용자 설정:** Local 전용 설정을 그대로 공개 배포하지 않는다. 배포용 설정에서 사용자·Password Hashing·Role을 제공하고 필수 값이 없으면 기동을 거부한다. 회원가입·영속 사용자 관리 기능은 이번 범위에 추가하지 않는다.
- **외부 연결:** ECR·Log·Secret·AI Provider로 나가는 경로도 필요하다. Public IP와 제한된 Inbound를 쓰는 구성, Private Subnet과 NAT 등을 쓰는 구성의 비용·노출 차이를 비교하고 리소스 생성 전에 선택한다.
- **권한 분리:** Image·Log·Secret 주입에 쓰는 Task Execution Role과 앱 코드의 AWS 접근에 쓰는 Task Role을 구분한다. 필요한 리소스·Action만 허용한다. [AWS ECS 실행 역할](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html)

OIDC Provider·ECR·업로드 Role은 초기 설정 승인을 받아 생성했다. 이 승인은 나머지 ECS·RDS·ALB·Secret·DNS·HTTPS 구성이나 삭제·외부 공개까지 포함하지 않는다. 사용할 수량·권한·예산·공개 범위를 확인한 뒤 남은 생성 범위를 따로 확정한다.

### 통합 과정에서 추가하지 않을 것

후속 대화·공식 답변·검색·알림·Dashboard·UI 장식, 여러 Provider 비교, 새로운 AI 평가 Dataset은 추가하지 않는다. Kubernetes·Terraform·Auto Scaling·WAF·CloudFront·분산 Queue·전체 관측 Stack·Multi-AZ 고가용성·무중단 배포는 기존 제외 범위를 유지한다.

인물 관계 V2의 Guard/Provider 연결과 개인정보 모델의 추가 비교·정확도 개선도 현재 배포 마감의 선행 과업으로 추가하지 않는다. 기존 보호 규칙을 없애는 것이 아니라, 제한된 합성 배포 실험과 일반 입력으로의 확장을 분리한다.

## 학습 회차별 실행 기록

이 절은 각 회차 당시의 계획·확인 결과를 보존한다. 이후 완료된 복원·Image 전환 등을 당시의 미실행 상태로 읽지 않으며, 현재 잔여 과업은 앞의 ‘10월 19일 마감과 10월 20일 재개’를 따른다.

[10월 16일 노트](./study-notes/2026-10-16-study-questions.md)에 자정을 넘겨 이어진 psql·DB Engine·Migration 버전과 메모리 관찰까지 통합했다. [psql 전환 보고서](./lab-reports/2026-10-17-cloudshell-psql17.md)는 Private 경로를 유지한 공식 Client 분리와 실제 접속·Hash 대조, [Process 관찰 보고서](./lab-reports/2026-10-17-proc-cgroup-log-pipeline.md)는 Test 전용 로컬 JVM의 VmSize/RSS·cgroup 제한·Log Marker와 HTTP 결과를 기록한다. 두 실험의 실제 실행일은 10/17로 유지한다. 현재 JavaScript 전체 262개·ESLint가 통과했다. 원격 CI·추가 Push·Image 업로드는 이 회차에서 실행하지 않았다.

[10월 8일 학습 노트](./study-notes/2026-10-08-study-questions.md)에 이번 회차의 개념과 이해 변화를 정리했다. 학습 회차는 10/8로 묶고, 실제 실험의 실행일은 각 보고서의 10/8~10/9 기록을 유지한다.

[10월 9일 학습 노트](./study-notes/2026-10-09-study-questions.md)는 설정·Bean, 개인정보 탐지·치환, 종료 Signal·Health·CI와 AWS 권한의 이해 변화를 개념별로 정리했다. 자정을 넘긴 AWS 설정은 같은 학습 회차에 포함하되 실제 실행일 10/10을 별도 보고서에 남긴다.

[10월 10일 학습 노트](./study-notes/2026-10-10-study-questions.md)는 ECR·Task·Service, OIDC·Role, Network·DNS·TLS와 Cookie의 차이를 정리했다. Health의 기대 Status와 `HttpOnly`를 잘못 이해했던 부분을 수정했고, 실제 ECR 업로드와 아직 시작하지 않은 Cloud 실행을 구분했다.

10/12에는 Provider 의존성 누락과 AI 비활성 접수의 결과를 먼저 예상하고 Focused Test 43개를 확인했다. Provider 18개·Worker 설정 7개·Security·MockMvc·실제 PostgreSQL 접수 18개가 통과했다. 새 접수 Case에서 `201`, Ticket·Message·Job 각 1건, Job `PENDING`·예약 0건과 Provider·Worker·Scheduler 부재를 함께 확인했다. [10/12 노트](./study-notes/2026-10-12-study-questions.md)와 [실행 보고서](./lab-reports/2026-10-12-disabled-ai-receipt-and-wiring-tests.md)에 개념과 결과를 나누었다. 배포용 사용자·개인정보 처리기·Secret·Worker의 전체 연결과 Cloud 실행은 계속 남아 있다. 다음은 ECS의 Secret 전달·실행 Role과 배포용 설정이다.

이후 Secret을 읽는 주체별 Role, Key 교체와 같은 Image의 새 객체 생성, Network·DB 인증·SQL 권한과 Security Group 참조를 문답으로 확인했다. 별도의 `deployment` 사용자 구성과 Test 26개를 추가했고 기존 관련 Test를 포함한 Focused 실행 72개가 통과했다. Main 사용자 Bean과 실제 PostgreSQL을 사용한 MockMvc의 접수·Session·Role·CSRF·`PENDING`을 확인했다. [배포 사용자 보고서](./lab-reports/2026-10-12-deployment-users-and-receipt-tests.md)와 [구성 결정](./deployment-plan.md#배포용-사용자-구성-결정)에 결과를 정리했다. 다음은 Task Definition의 실행 설정과 최소 구성·비용·생성 범위 확인이며, 개인정보 처리기·Provider·Worker 전체 조립과 실제 Cloud·HTTPS 검증도 남아 있다.

변경한 Main Source `da1d687`로 로컬 Image를 Build하고 JAR의 새 Configuration을 확인했으며, 첫 연결용 ECS 실행 명세 초안을 작성했다. 새 구조 Test 6개를 포함한 JavaScript 전체 152개가 통과했다. CPU·Memory·Cloud 참조·TLS 신뢰 설정은 미확정이며 Image의 표시 Size만으로 실행 사양을 정하지 않는다. [Image와 명세 보고서](./lab-reports/2026-10-12-deployment-image-and-ecs-draft.md)에 결과를 정리한다. ECR 재업로드·ECS·RDS·HTTPS 실행은 아직 미수행이다.

이후 같은 Image를 `postgres,deployment`·AI 비활성으로 실행하고 `0.25 CPU·512 MiB` 제한을 적용했다. 독립 실행 두 번에서 로그인·CSRF·접수·실제 PostgreSQL 저장과 순차 조회 30회씩이 통과했다. 최고 메모리는 312.42 MiB·211.43 MiB, OOM·OOM Kill은 0회였다. 새 Source 보호 Test 6개를 포함해 JavaScript 전체 158개가 통과했다. [자원 측정 보고서](./lab-reports/2026-10-12-deployment-resource-probe.md)의 결과를 첫 연결 사양 후보로 사용하고, 전체 AI·동시 부하와 실제 Cloud 조건은 추가 측정한다. 전체 Java 회귀를 다시 실행한 결과는 아니다.

RDS 연결 준비에서는 공식 서울 공개 CA를 Runtime Image에 제공하고 ECS 초안의 `verify-full`·CA 경로를 명시했다. 처음 비Root 읽기는 부모 디렉터리의 `444` 권한 때문에 실패했고, Root 소유 디렉터리 `0555`·파일 `0444`로 보완한 재Build에서 파일 Hash·권한·읽기가 확인됐다. [공개 CA 보고서](./lab-reports/2026-10-12-rds-public-ca-and-image-preparation.md)에 결과를 정리했다. CA·명세 관련 13개를 포함한 JavaScript 전체 165개와 ESLint가 통과했다. 실제 RDS TLS·Cloud 구성·ECR 새 Image 업로드·개인정보 탐지기와 전체 Worker 조립은 계속 남아 있다.

같은 날 비용을 확인한 뒤 Standard Parameter Store를 선택했다. 첫 App은 서울의 Standard SecureString 여섯 개·Standard Throughput·`aws/ssm`을 사용한다. Lab의 명세를 지정 SSM ARN 형태로 보완하고 Execution Role의 해당 ECR Pull·지정 Log Stream 전송·여섯 Parameter 읽기 권한 초안과 Test를 추가했다. 명세·권한 구조 Test 13개, JavaScript 전체 171개와 ESLint가 통과했다. 이후 작성자가 Console에서 여섯 Parameter를 등록하고 이름·Type·Tier를 확인했다. 실제 값은 읽거나 기록하지 않았다. 이어 Trust 조건 Test 두 개를 추가해 JavaScript 전체 173개·ESLint를 확인하고 별도 승인을 받아 전용 Execution Role을 생성했다. 연결 정책 한 개와 저장된 Trust·Permission JSON의 초안 일치를 확인했다. Agent 읽기·Container 전달과 실제 Cloud 실행은 다음 단계다. [Secret 저장소 결정](./deployment-plan.md#secret-저장소-결정)을 따른다.

Log Group은 작성자가 초기 7일안 대신 1년 보존을 지정해 서울의 `/ecs/helpdesk-learning` 하나를 Standard 클래스·365일 보존으로 생성했다. 생성 후 이름·클래스·12개월 보존 표시를 확인했다. 실제 Task의 출력 전달은 아직 실행하지 않았으며 1년 동안의 누적 저장량도 최소 비용 검토에 포함한다. [Log 보존 결정](./deployment-plan.md#log-보존-결정)에 선택과 확인 범위를 정리했다.

실습 종료 후 비용 최소화 요청도 반영했다. 장기 휴지기는 마지막 Snapshot·별도 복원 검증 뒤 승인한 ALB·DB Instance를 정리하고 필요한 Image·Snapshot·Standard Parameter를 보관하는 순서로 준비한다. [중단·재개 절차](./deployment-plan.md#실습하지-않을-때의-보관과-재개)에 접수·Worker 중단, 실제 Task 종료, 최종 보관 시점과 재개 설정을 정리했다. 삭제·DNS 변경은 실행하지 않았으며 실제 Cloud·HTTPS·전체 AI·복구 완료 기준은 유지한다.

2026-10-08에는 Image·Container·Process, 쓰기 계층·Volume·Network, Build Context·Cache와 시작 준비 조건을 학습했다. [Docker·Compose·Volume 학습자료](./study-docs/docker-image-container-compose-volume.md)에 JAR와 Maven의 역할, Multi-stage Build, 두 Maven 명령의 Cache 조건과 핵심 질문·해설을 보완했다. Docker Desktop의 Linux Engine에서 첫 Helpdesk Image Build와 입력 무변경 재Build, 최종 Image와 JAR의 구성을 확인했다. 별도 복사본에서는 Source만 변경할 때 의존성 준비는 재사용되고 패키징은 다시 실행됐으며, POM의 의존성을 변경하면 두 단계가 모두 다시 실행됐다. 실제 Source와 POM은 변경하지 않았다. 결과는 [Image Build와 변경 입력별 Cache 실험](./lab-reports/2026-10-08-docker-image-build-and-cache-baseline.md)에 기록한다.

복사 순서 비교에서는 Source를 의존성 준비 앞에 두어도 Build는 성공했고, 그 순서에서 Source를 바꾸면 두 Maven 명령이 모두 다시 실행됐다. 의존성 준비를 앞에 두는 이유가 오류 방지가 아니라 Cache 재사용이라는 점을 구분했다. Image 패키징은 Test를 생략했다.

이후 새 Compose Project에서 App과 PostgreSQL을 실행했다. 별도 App DB 계정의 연결과 Flyway Migration 7건, 실제 HTTP의 로그인·접수·조회와 Ticket·Message·PENDING Job 각 1건을 확인했다. 같은 Session의 CSRF 없는 접수는 `403`·저장 0건, 정상 접수는 `201`, USER 조회는 `403`·AGENT 조회는 `200`이었다. 이 실행은 `.NET HttpClient`를 사용했고 Worker는 꺼 두었으며, 결과는 [Compose의 HTTP·PostgreSQL 실험](./lab-reports/2026-10-08-compose-http-postgresql-baseline.md)에 기록한다.

두 번째 독립 실행에서는 DB Container만 교체해 ID 변경과 같은 Volume·Migration 이력·Row 보존을 확인했다. App의 Container ID와 실행 시작 시각은 같았으며, 기존 AGENT Session으로 같은 Ticket을 재조회해 `200`을 받았다. PostgreSQL 프로그램은 Image, DB 데이터 파일은 Volume, Session은 App JVM에 있다는 구분을 자료에 보완했다.

세 번째 독립 실행에서는 같은 DB를 유지하고 App만 Stop 후 Start했다. App Container ID는 같고 실행 시작 시각은 달랐으며 DB·Volume·Migration과 Ticket·Message·Job Row는 그대로였다. 기존 Cookie를 보관한 Client는 조회 `401`, AGENT 재로그인 뒤 같은 Ticket 조회 `200`을 받았다. 메모리 Session의 수명과 Session 수에 따른 메모리 사용도 학습자료에 보완했다. 각 실행의 Container는 검증 뒤 중지하고 Volume은 보존했다. 이 Compose 실험에서는 Browser E2E와 전체 회귀를 실행하지 않았다. 이후 10/9의 회귀·CI 결과는 아래에 별도로 기록한다.

10/8 학습에 이어 10/9에는 같은 Image에서 실행 설정을 바꾸는 비교와 공통 검증 함수의 회귀를 확인했다. Host의 CORS 허용 Origin을 바꿔도 같은 Container의 Stop·Start는 이전 설정을 유지했고, App을 재생성하면 새 설정을 적용했다. 서버의 OPTIONS 응답·허용 Header, 동일 Image ID와 DB·Volume·Row 보존으로 비교했으며, 기존 App 재시작 옵션과 설정 변경 옵션을 함께 실행해 통과했다. Java Source·JAR·Image는 수정하지 않았고 실제 AI와 Browser JavaScript는 실행하지 않았다.

별도의 Compose 설정 검사에서는 필수 변수 6개를 각각 미설정·빈 문자열로 바꾼 12개 Case가 모두 거부됐다. 기존 Worker 설정 Test 7개도 재실행해 기본 비활성과 Provider 객체 없는 활성 구성의 기동 실패 등을 확인했다. 이 검사는 Container·PostgreSQL·실제 AI를 실행하지 않았다. 문의 접수에 필요한 설정과 비활성 AI 기능의 설정을 구분하는 내용을 학습자료에 보완했다. 배포용 Provider·개인정보 처리기·검증기·Worker 연결과 Cloud Secret 전달 검증은 남아 있다.

10/9에는 [Spring 설정과 Bean의 연결 자료](./study-docs/spring-settings-bean-and-secret-wiring.md)를 추가하고, 임시 파일의 Config Tree 읽기·Provider 객체 전달·설정 누락·공백·Bean 미등록·기능 비활성을 비교하는 학습용 Test 5개를 확인했다. 기존 Worker 설정 7개와 함께 통과했다. 학습용 Provider는 요청 메서드 호출을 금지하며 실제 Key·DB·외부 AI를 사용하지 않는다. 이 결과는 작은 Context의 설정·객체 조립 근거이며, 배포용 Provider 구성이나 Compose Secret Mount의 완료 근거는 아니다.

이어서 Main의 Provider 등록 설정을 추가했다. 별도 활성화 값·필수 Helpdesk Key·명시적 요약 상한을 사용하고, 기존 개인정보 처리기를 주입받는다. Provider 등록과 Worker 실행은 별개이며 기본 비활성은 유지한다. 새 설정 Test 18개와 관련 기존 Test를 합쳐 170개가 통과했고 실제 AI 호출은 0회였다.

별도 Compose의 [합성 Secret Mount 실험](./lab-reports/2026-10-09-synthetic-secret-mount-and-provider-wiring.md)에서는 같은 Image에 다른 합성 파일을 연결한 두 Case, 필수 값 누락·공백, 기능 비활성의 총 5개 Case가 통과했다. 비특권 사용자의 파일 읽기·읽기 전용 Mount·Config Tree 값 일치·실제 Main Provider 등록과 주입을 확인했다. 네트워크를 차단하고 Worker를 껐으며 DB·실제 AI는 사용하지 않았다. 관련 Test 170개도 다시 통과했다. 실험 Container와 임시 파일은 정리했다. 기본 App Compose의 실행용 Secret·개인정보 처리기·Worker·DB 연결은 남아 있다.

개인정보 처리에서는 알려진 문자열 치환과 임의의 개인정보 탐지가 다르다는 점을 확인했다. 검사기가 문의 전체를 다시 쓰는 대신 위치·종류를 반환하고 Java가 해당 부분만 치환하는 설계 방향을 선택했다. [개인정보 탐지와 마스킹 자료](./study-docs/privacy-detection-and-minimal-masking.md)에 범위 검증·위치 단위·원문 보존을 정리했다.

10/9 문답에서는 본문 밖의 위치를 임의로 보정하지 않고 전송을 중단하는 이유, 치환 뒤 위치가 밀리는 문제, 형식 검사와 탐지 정확도의 차이, Code Point 위치를 Java 인덱스로 변환하는 이유를 확인했다. 작성자는 탐지 위치 목록의 초기 중복·겹침 정책을 승인했다. 같은 입력 필드의 위치·종류가 모두 같으면 중복을 제거하고 한 번 치환하며, 서로 다른 범위의 겹침·포함 관계나 같은 범위의 종류 충돌은 외부 전송을 중단한다. 범위를 임의로 합치거나 종류를 추측해 문의 내용을 바꾸지 않기 위한 선택이다. 이미 접수한 Ticket·Message는 유지한다.

이어서 로컬 검사기의 Timeout과 외부 Provider 응답의 Timeout을 같은 실패로 기록하면 원인을 구분할 수 없다는 점을 확인했다. 작성자는 `PRIVACY_SCAN_TIMEOUT`·`PRIVACY_SCAN_INVALID_RESULT`의 초기 실패 처리 정책을 승인했다. 두 경우 모두 외부 전송을 중단하고 접수한 Ticket·Message를 유지하며, 현재 Attempt의 Job을 `FAILED`로 기록한다. 자동 재시도는 하지 않는다. 검사 재시도는 외부 AI 재호출과 별도 정책으로 다루며, 읽기 전용 조회도 이를 시작하지 않는다.

범위 위치는 원문 기준 Unicode Code Point로 정하고, 별도 Main 클래스 `AiInputSpanMasker`와 Unit Test를 구현했다. 시작·끝을 Java 인덱스로 변환하고, 필드별 중복 제거·겹침 거부·원문 구간 조립을 적용한다. 새 Test 47개와 기존 개인정보 Guard Test 32개, 총 79개가 실패·오류·건너뜀 없이 통과했다. 결과는 [개인정보 범위 검증과 치환 Test](./lab-reports/2026-10-09-ai-input-span-masking-unit-tests.md)에 기록한다.

기존 `AiInputPrivacyGuard`와 Worker의 실행 동작은 변경하지 않았다. 새 치환기는 감지된 위치를 적용하는 함수이며 개인정보 탐지 모델이나 검사 실패의 Job 저장까지 구현한 것은 아니다. 새 실패 코드의 Java Enum·DB 제약·조회와 UI 허용값, 현재 Attempt 확인과 자동 복구 차단은 구현·검증할 대상이다. 기존 예약과 정책 Snapshot을 유지한다. 한국어 탐지 모델 선정·검사 결과의 JSON 검증·실행용 연결은 후속 검토·구현 대상이며, 추가 검사 재시도 정책은 확정하지 않았다.

10/15 후속 구현에서는 두 개인정보 실패 코드와 V8·조회·UI 허용값을 맞추고, 현재 Attempt의 재시도 차단과 최종 실패를 하나의 Transaction으로 저장하는 경계를 추가했다. 새 PostgreSQL Test 9개와 관련 조회를 포함한 Focused 65개, 전체 Java Clean 589개·JavaScript 232개·변경 UI ESLint가 통과했다. [실패 저장 보고서](./lab-reports/2026-10-15-privacy-scan-failure-persistence.md)에 원문·예약 보존과 반복 Polling/조회 무변경을 정리했다. 이 구현은 실제 검사기를 호출하거나 Processor에서 실패를 자동 분류하는 연결이 아니며, 해당 실행용 조립과 Cloud V8 적용은 계속 남아 있다.

이어서 완료 표시와 위치 목록을 함께 받는 `{completed, spans}` 계약을 정하고, JSON 검증기와 기존 위치 치환기를 연결했다. 새 Unit Test 84개와 기존 치환·Guard를 포함한 163개가 통과했다. 완료된 탐지 0건과 검사 미완료를 구분하며, 타입 자동 변환·잘못된 위치·충돌은 거부한다. 이 단계에서는 전체 회귀를 재실행하지 않고 다음 Processor 연결까지 진행했다.

후속 구현에서는 `AiPrivacyScanner` Port·`AiScannedInputPreparer`와 Processor를 연결했다. Timeout·잘못된 결과를 전용 실패 기록 경계로 전달하고, 스캔 뒤 현재 Attempt·Lease·잔여 시간을 재확인한다. Main에는 빈 검사기를 추가하지 않았다. 전처리기 Unit 12개·Pipeline Integration 15개·Worker 설정 8개와 전체 Java Clean 701개·JavaScript 232개가 통과했다. 실제 한국어 탐지 모델·로컬 실행 Adapter의 제한 시간/자원 회수·Main Bean·Cloud 연결은 여전히 남아 있다. 가짜 검사 응답·로컬 HTTP의 통과를 탐지 정확도나 실제 AI 배포 완료로 해석하지 않는다.

실제 탐지의 1차 후보로 CPU용 한국어 NER `ko_core_news_sm` 3.8.0의 개발사 Metadata·라이선스를 확인한 뒤, 사용자 승인으로 입력 종류 PERSON을 추가했다. 별도 Container에서 합성 12건을 실제 추론해 7건만 통과했으며 이름 누락·일반 문구 오탐 때문에 배포용 채택을 보류했다. [모델 평가 보고서](./lab-reports/2026-10-15-korean-privacy-ner-probe.md)에 Java Focused 178개·Python Unit 10개와 실제 모델의 품질·시간·메모리를 구분한다. 업무 인원·마감을 지워 탐지 실패를 숨기지 않고, 다른 탐지 후보와 문맥 정책은 같은 기준으로 평가한다. 모델 평가만으로 Main 연결·Job별 Timeout·Cloud 검증을 완료 처리하거나 AWS Task 크기를 변경하지 않는다.

이후 실명은 업무에 불필요한 경우 가리되 인물 관계를 보존하고, 이름/일반명사의 판단이 불분명하면 일반명사로 해석하는 [정책 결정](../plan/decisions/0003-contextual-person-masking.md)을 승인받았다. 현재 단일 PERSON Placeholder는 관계를 표현하지 않으므로 실행 구현과 구분한다. 모델·Dataset·JSON·AWS는 이 정책 정리에서 변경하지 않는다. 이름 탐지 개선과 독립적으로 가능한 Cloud 관측·복구 학습을 이어가며, 실제 AI 전송 전 필요한 입력 처리·실행 제한은 남은 범위로 유지한다.

Cloud 관측에서는 실제 Running Task 1개·Service 0개, 현재 Task의 기동 완료 Log Event와 익명 Health `200/UP`·보호 API/Metric `401`을 확인했다. 최초 ALB Monitoring은 `cloudwatch:GetMetricData` 허용 부재로 거부됐다. 범위를 설명하고 별도 승인받아 Edge 기본 Version 5에 MFA·서울 조건의 조회 한 개만 추가했다. 기존 15개 문장과 Version 1~4를 보존했고, 비Root MFA 로그인 뒤 요청·대상 응답시간·Target 4xx 그래프의 실제 데이터를 확인했다. ELB 오류의 데이터 없음은 0건으로 기록하지 않았다. [관측 보고서](./lab-reports/2026-10-15-cloud-observability-baseline.md)에 로컬 정책 Test 28개·JavaScript 233개 통과와 AWS 적용·그래프 결과를 구분했다. 다른 IAM 정책·실행 설정은 유지하며 App Metric·전체 AI·복구 검증은 이어간다.

이어 같은 Image·명세·RDS의 Task 교체를 준비했다. 기존 Task의 Digest·0.25 vCPU/512 MiB·Profile·AI 비활성과 정상 Target 한 개를 대조했다. 승인한 지정 Group의 `DeregisterTargets` 한 개만 MFA·서울·Project 조건으로 Edge 기본 Version 6에 추가했다. Version 1은 Git 제외 JSON과 AWS 원본의 일치를 확인한 뒤 삭제했고 Version 2~5와 기존 16개 문장을 보존했다. 정책 Test 29개·JavaScript 전체 234개·ESLint가 통과했다. Root는 로그아웃했고 작성자가 비Root 로그인·MFA 완료를 알렸다. 교체 전 AGENT 로그인·기준 조회는 아직 확인하지 못했으며 실제 등록 해제·Draining·Task 교체는 `NOT_RUN`이다. [교체 준비 보고서](./lab-reports/2026-10-16-cloud-task-replacement.md)의 실제 적용일은 10/16으로 유지한다.

[10월 15일 학습 노트](./study-notes/2026-10-15-study-questions.md)에 로그인 뒤 404와 인증, Cookie/CSRF·접수와 Job, SELECT/Commit, DNS/Target·Redirect, 개인정보 탐지 품질·Log/Metric과 App/DB 복구의 이해 변화를 정리했다. 10/15 회차를 마감하고 남은 학습은 10/16에 이어간다. 내용은 줄이지 않으며 마지막 확인 시 남은 실행 리소스의 비용도 재개 시 먼저 확인한다.

[HTTPS 접수·SQL Row 보고서](./lab-reports/2026-10-15-cloud-session-csrf-and-postgres.md)는 작성자가 공유한 Cookie 속성·접수 403/201·Ticket 1/2의 실제 SQL 결과를 묶는다. 로컬 MockMvc·JavaScript 회귀와 Cloud의 실제 처리 결과를 구분하며, 이 결과를 아직 미실행인 Task 교체 후 보존 검증으로 바꾸지 않는다.

초기에는 AWS 계정·도메인·서울 Region·비용 조건과 OIDC/ECR의 생성 범위부터 확인했다. 이후 별도 승인으로 Private RDS·ECS·ALB·ACM과 Cloudflare CNAME·HTTP Redirect를 구성했다. 이 초기 승인 기록을 아직 DNS 권한·배포 구성이 모두 미정이라는 현재 상태로 읽지 않는다. 추가 리소스·삭제·실제 AI는 해당 범위를 따로 확인한다.

배포 학습을 우선하기 위해 개인정보 탐지 모델의 추가 연결과 별개로 Process·관측·CI를 진행했다. [Process·Health·CI 자료](./study-docs/process-health-and-ci.md)를 추가하고, Main에 최소 Health·AGENT 전용 HTTP Metric과 HTTP 종료 유예를 설정했다. 실제 HTTP에서 Security가 거부한 `401` 요청도 Metric에 기록됐다. 관리 상세·환경 변수·Dump는 공개하지 않았다.

[로컬 관측·종료 보고서](./lab-reports/2026-10-09-process-health-and-ci-baseline.md)에 Java 회귀 551개·JavaScript 145개·ESLint·Image Build와 3개 종료 Case를 기록했다. 충분한 종료 대기에서는 합성 요청이 `200`으로 완료됐고, 1초 대기와 SIGKILL에서는 연결이 끊겼다. SIGTERM의 Exit Code `143`을 잘못된 실패로 보지 않도록 기대값을 고쳤다. 이 실험은 실제 Container·JVM·HTTP의 근거이며 DB·Job의 전체 종료 결과는 아직 확인 전이다.

Lab의 Workflow와 관련 변경은 Commit·Push했고 실제 GitHub Actions에서 정상·실패·복구를 비교했다. 최초에는 Ubuntu Runner에서 Windows Shell 선택에 의존한 Test 두 개가 실패했다. Shell 선택을 Test에서 주입하도록 분리한 뒤 Java 551개·JavaScript 146개·ESLint·Image Build가 통과했다. 별도 Branch에서 공백 제목 거부 조건을 제거해 UI Test 세 개 실패·Image Build Skipped를 관찰하고, 조건 복원 뒤 성공했다. main에 오류·복구 실험 Commit은 합치지 않았다. 10/9의 마지막 main 검증 `0908f81`도 성공했으며 실행 링크는 [CI 보고서](./lab-reports/2026-10-09-process-health-and-ci-baseline.md)에 남겼다. 당시 Workflow에는 AWS 인증·ECR Push·ECS 배포가 없었다.

회차를 이어 실제 10/10에는 Private ECR `ai-helpdesk-learning-lab`, GitHub OIDC Provider와 `helpdesk-github-ecr-push` Role을 생성했다. Trust Policy는 조회한 실제 Repository의 ID 포함 Subject·main·Audience로, Permission Policy는 해당 ECR의 Push 작업으로 제한했다. Immutable Tag·AES-256·Basic Scanning을 사용하고 장기 Key·신규 KMS·Enhanced Scanning은 추가하지 않았다. 저장된 정책을 다시 읽어 대조한 결과는 [AWS 초기 설정 보고서](./lab-reports/2026-10-10-aws-oidc-ecr-baseline.md)에 기록했다.

10/10에는 Lab Commit `77ce72c`에서 일반 검증과 수동 Publish Job을 분리했다. 실제 Actions의 Java 551개·JavaScript 146개·ESLint·Image Build가 통과했고, 검증한 Image를 재Build하지 않고 OIDC 인증으로 ECR에 1회 업로드했다. Docker Push와 ECR 조회의 Manifest Digest가 같았으며 Console에서도 같은 Tag·Digest의 Image 한 건을 확인했다. 일반 Push 실행은 Publish Job을 건너뛰었다. [ECR 업로드 보고서](./lab-reports/2026-10-10-verified-image-ecr-publish.md)에 Commit·Tag·Digest와 실행 링크를 기록했다. 기존 IAM 정책은 유지했고 권한 거부 실험·ECS·RDS·ALB·DNS·ACM 구성은 남아 있다.

10/13에는 배포 준비 변경을 목적별로 Commit·Push한 뒤 Lab `2e2cc40`의 일반 CI와 수동 검증·업로드가 통과했다. 두 실행의 Java 578개·JavaScript 173개·ESLint·Image Build를 확인했고 ECR에 검증 Image 한 개를 추가했다. Console에는 이전 Image와 새 Image 총 두 개가 남아 있다. [10/13 업로드 보고서](./lab-reports/2026-10-13-deployment-image-ecr-publish.md)에 식별 정보를 기록했으며 App·RDS·ALB 실행과 DNS 변경은 하지 않았다.

같은 날 별도 승인을 받아 배포용 IAM 사용자 한 명·정책 세 개를 생성·연결하고, Password·MFA 직접 등록 후 `helpdesk-deployer`로 로그인했다. 서울의 학습 VPC·두 AZ의 Public/Private Subnet 네 개·Gateway·Public Route Table·Security Group 세 개를 적용했다. Public 두 개의 Internet 경로와 Private 두 개의 `local` 경로, ALB→App 8080·App→RDS 5432 및 학습자 IPv4 한 개의 ALB 443 진입 제한을 확인했다. NAT·유료 Endpoint·Elastic IP와 실행 App·RDS·ALB는 만들지 않았다. [신원 보고서](./lab-reports/2026-10-13-deployer-identity-and-policies.md)와 [Network 보고서](./lab-reports/2026-10-13-learning-network-and-security-groups.md)에 저장된 설정 확인과 실제 연결 미실행을 구분했다. 다음은 Private RDS·관리자/App DB 계정 분리·실행 명세와 AI 비활성 첫 연결이다.

Private DB에 최초 접속할 관리 통로도 별도로 승인받았다. 임시 Bootstrap Group 한 개와 RDS의 추가 5432 규칙을 저장했으며, App 규칙은 유지했다. CloudShell 전용 권한은 생성 단계와 정확한 환경 ID의 Session 허용 단계로 분리했다. 생성 단계 정책 적용과 기존 세 정책의 보존을 확인한 뒤 배포 사용자로 VPC 환경 한 개를 등록했다. 환경 ID 확인 후 관리자 신원으로 해당 ID의 정책을 기본 Version 2에 적용하고 전체 JSON의 일치와 Version 1 보존을 대조했다. 배포 사용자로 돌아와 실제 터미널·psql을 실행하고 환경 상세의 VPC·Subnet·Group을 대조했다. 실제 RDS 생성·공개 CA·DB 접속과 App 실행은 다음 단계다. [관리 통로 준비 보고서](./lab-reports/2026-10-13-private-db-bootstrap.md)에 현재 적용 범위와 정리 절차를 남긴다.

이어 DB Subnet Group의 Private Subnet 두 개·태그를 확인하고 Runtime 정책의 기본 Version 3을 저장된 JSON과 대조했다. 이후 작성자가 시도한 RDS 생성 요청은 `rds:CreateDBInstance`의 적용 가능한 Allow가 없다는 `403`으로 거부됐다. 실제 요청의 어느 Resource·Condition이 맞지 않았는지는 아직 확인하지 못했다. 전체 Payload를 읽거나 비밀값을 기록하지 않았고, 브라우저 URL을 확실히 식별할 수 없어 Payload 확인을 중단했다. [RDS 준비·거부 보고서](./lab-reports/2026-10-14-rds-subnet-group-and-runtime-policy.md)에 실제 실행일을 유지한다. 정책 관련 로컬 Test 32개와 JavaScript 전체 205개·ESLint가 통과했지만, AWS의 생성·연결 성공 근거는 아니다.

### 10월 13일 회차 마감 시점의 상태

현재는 로컬 실행·CI·ECR 전달에 이어 배포 신원·Network·DB 관리 통로와 Subnet Group까지 확인한 상태다. RDS 생성 요청의 IAM 거부를 해결해야 실제 DB·Application 연결로 넘어갈 수 있다. 완료 체크의 개수를 전체 학습 진도율로 환산하지 않는다. 준비·배포·복구는 필요한 시간과 검증 난도가 다르다.

| 묶음 | 현재 확인한 것 | 남은 것 |
|---|---|---|
| Docker·Compose | Cache 비교, 실제 PostgreSQL 저장·Container 교체 후 Row 보존, App 재시작과 재로그인 | Cloud에서 같은 데이터·Session 수명 재확인 |
| 배포 설정·자원 | Main USER·AGENT, AI 비활성 접수·DB 저장, 최소 사양 후보, 공개 CA·명세 준비 | ECS의 실제 설정 전달·TLS 연결, 전체 AI를 포함한 추가 측정 |
| CI·ECR | `2e2cc40`의 CI Java 578개·JavaScript 173개·ESLint·Build, 새 Image 추가·이전 Image 유지. 후속 정책 변경의 로컬 JavaScript 전체 205개·ESLint 통과 | 후속 변경의 원격 CI, 실행 Task와 검증 Digest의 실제 대조 |
| AWS 선행 설정 | 기존 OIDC·SSM·Execution Role·Log Group, 비Root 사용자와 정책 4개, 학습 Network·CloudShell VPC·DB Subnet Group·Runtime V3 확인 | RDS 생성 거부의 실제 요청 조건 확인, DB 계정·TLS·Migration, ECS·ALB·DNS·ACM과 실제 연결 |
| 전체 AI 연결 | 검사 결과 JSON·범위 치환·실패 기록·Processor 연결을 통제된 응답과 실제 PostgreSQL·로컬 Provider HTTP로 확인 | 실제 한국어 탐지 모델·실행 Adapter·Main Bean, 전체 AI·Secret의 배포용 조립·자원 측정·Cloud 검증 |
| 관측·종료 | 로컬 Health·HTTP Metric, Signal과 진행 중 HTTP 요청 비교 | CLI Log Pipeline, DB·Session·Job 종료 결과, CloudWatch의 요청·Job·오류 추적 |
| 복구·마감 | 중단·재개·최소 비용과 보관 절차 | Cloud 재배포·Rollback·별도 Snapshot 복원, 최종 회귀·자료 없는 재설명·WIL 공개 |

학습 회차와 실행 날짜는 구분한다. [10/13 노트](./study-notes/2026-10-13-study-questions.md)에 개념과 이해 변화를 정리하고, 자정 이후 Subnet Group·Runtime 정책·생성 거부 근거는 10/14 보고서에 유지한다. 남은 과업은 10/14에 이어간다.

### 회차 마감에 따른 일정 조정

Docker·Compose의 기초와 저장·재시작·설정 비교까지 진행했다. 초기 첫날에 함께 배정했던 배포용 Provider·Secret 조립과 Cloud 실행 조건 확인은 마치지 못했으므로 다음 학습의 앞부분으로 옮긴다. 10/9에는 설정 읽기·Main Provider 등록과 별도 Compose의 합성 파일 제공까지 검증했다. 기본 App의 개인정보 처리기·실행용 Secret·Worker·DB를 함께 연결하는 실험은 남아 있다.

10/9 회차에서 실제 CI 실패·복구와 AWS 초기 설정까지 진행했고, 10/10에는 OIDC 인증·ECR Image 전달을 확인했다. 다음 학습은 같은 기본 실험을 반복하기보다 배포용 전체 조립과 Cloud Network·Database·HTTPS 연결로 이어간다. Process의 DB·Job 종료 상태, 권한 거부 실험·Log 연결·Cloud 관측·Rollback·Backup 복원도 남은 분량으로 유지한다.

10/10 학습 마감 때 남은 과업을 10/11 야간 또는 10/12에 재개하기로 했다. 당시 AWS 실행 근거는 ECR의 Image 한 건까지였다. 10/12 회차에는 배포용 설정·Image·자원·CA와 SSM·Execution Role·Log Group을 준비하고 새 검증 Image를 추가했다. 10/13의 RDS 생성 거부 뒤 10/14 회차에는 DB 생성·TLS·계정, 같은 Image의 ECS 기동과 HTTPS 기본 응답을 확인했다. 10/15 회차에는 실제 접수·업무 Row·HTTP Redirect·Cloud 관측과 Task 교체의 권한 준비까지 진행했다. 미실행 교체·복구·전체 AI와 남은 실험은 10/16에 이어간다. 기존 승인을 벗어나는 권한 변경·리소스 생성과 DNS 변경은 별도로 확인한다.

| 과업 | 현재 상태 | 다음 배치 |
|---|---|---|
| Image·Cache·Compose·Volume·Session 수명 | 로컬 Build·실제 HTTP·PostgreSQL 실험과 문답 확인 | 같은 실험을 처음부터 반복하지 않고 Process·배포 실험의 기준으로 사용 |
| 필수 값·Worker 기본 비활성 | Compose 누락·빈 문자열 12개 거부, 기존 Spring 설정 Test 7개 통과 | 배포용 정상 조립·Secret 누락·실제 실행의 추가 Test와 구분 |
| 배포용 Provider·개인정보 처리기·검증기·Worker·Secret | Provider·검증기 등록과 합성 파일 Mount·Main 조립 확인. 기본 App의 개인정보 처리기·실행용 Secret·전체 연결 미완료 | Process·CI와 Cloud 설정 준비를 병행. 실제 AI 수직 흐름 전에는 남은 조립을 완료하고 별도 호출 승인 |
| 개인정보 탐지 위치의 범위 검증과 치환 | Code Point·JSON·Processor·실패 기록의 로컬 검증. 실제 NER 후보는 합성 12건 중 7건 통과로 채택 보류 | 배포 학습과 병행해 실제 탐지 Adapter·관계 보존·Main 연결·전체 AI 자원/Cloud 검증을 완료. 검사를 생략하지 않음 |
| Cloud 권한·DNS·Region·구성·비용 조건 | Private RDS·TLS·Migration·ACM·CNAME·HTTPS 접수/SQL Row·301, Task 교체와 실제 Image 복귀 확인 | Route 53 별도 학습·종료 비용 확인. 새 리소스·삭제는 별도 승인 |
| Process·관측·CI·IAM·ECR | 실제 CI·ECR·실행 Digest·Cloud 기동 Log/ALB 그래프, 로컬 Signal 비교·`/proc`/cgroup·합성 Log Pipeline 확인 | DB·Job 종료 상태, Request/Job 연결과 App Metric·대표 실패의 추가 관측. 로컬 합성 Marker를 전체 추적으로 확대하지 않음 |
| Cloud·HTTPS·복구·회귀·WIL | HTTPS 접수/Row·Task/Session 비교·Snapshot 별도 복원·원본 복귀·B→P와 V8/업무 Hash 보존 완료 | 전체 AI 조립·관계 보존 마스킹·Cloud AI/자원 검증, 나머지 관측·Route 53·최종 회귀·복습·WIL 유지 |

이월한 시간을 기존 하루 배정에 무조건 더해 끝내는 일정으로 보지 않는다. 아래 주제별 시간은 초기 예상 분량을 유지한 것이며, 실제 날짜별 배치는 선행 조건과 하루 종료 때의 잔여량을 기준으로 조정한다. 설정 구현이 길어지면 Process·CI의 시작이 밀리고, CI가 미완료면 Cloud 시작도 밀린다. 뒤의 학습을 삭제하거나 복구·WIL 시간을 줄이지 않는다.

## 날짜별 학습 일정

하루 10시간은 초기 배분 기준이다. 아래 표는 현재 회차별 진행과 다음 재개 순서이며, 상세 주제의 실험표는 별도 추가 과제로 다시 계산하지 않는다. 전날 미완료 항목은 다음 학습일의 앞부분에 두고 그만큼 뒤의 시작을 옮긴다. 외부 리소스 생성·인증서 검증 대기 중에는 독립적인 개념 학습과 문서 정리를 진행하되, 대기 시간을 실제 학습 시간으로 세지 않는다.

| 날짜 | 시간 | 중심 학습과 실험 | 하루 종료 기준 |
|---|---:|---|---|
| 10/8 목 회차 | 초기 10시간 | Docker·Build Cache·Compose·Volume·Session·설정 비교와 필수 값 검사 | 해당 로컬 실험과 학습 노트 정리. 배포용 조립·Cloud 선행 조건은 미완료로 이월 |
| 10/9 금 회차 | 10시간 기준 | Provider·합성 Secret·범위 치환 → Process·Health·Metric → 실제 CI 실패·복구 → OIDC·ECR 초기 설정 | 해당 근거와 노트 정리. AWS 생성의 실제 실행일은 10/10. 전체 AI 조립·실제 Push·DB·Job 종료 검증은 남음 |
| 10/10 토 회차 | 초기 10시간 배정 | ECR·ECS·IAM·Network·DNS·TLS·Cookie 개념, 실제 OIDC 인증·검증 Image의 ECR 1회 업로드와 Digest 확인 | 해당 근거와 노트 정리. ECS·RDS·HTTPS 연결은 미수행으로 이월 |
| 10/11 일 | 낮 제외·야간 선택 | 야간에 재개하면 배포용 전체 조립·남은 권한 실험·Cloud 구성 승인부터 진행 | 고정 분량은 배정하지 않음. 재개하지 않으면 같은 순서를 월요일로 이동 |
| 10/12 월 회차 | 초기 10시간 기준 | 배포 사용자·AI 비활성 접수·실행 명세·자원·CA, Parameter·Execution Role·Log 보존, 전체 회귀·CI·새 Image 전달 | 노트·보고서 정리. 자정 이후 검증·업로드는 실제 실행일 10/13 유지. Cloud·전체 AI·복구는 이월 |
| 10/13 화 회차 | 실제 진행 분량 기록 | 비Root 신원·학습 Network·CloudShell 관리 통로 → DB Subnet Group·Runtime 정책 대조 → RDS 생성 거부 확인 | 노트·실행 보고서 정리. 실제 DB·App 연결은 미수행, 요청과 정책의 불일치 항목은 미확인 |
| 10/14 수 회차 | 실제 진행 분량 기록 | RDS 조회·생성 조건 대조, Private TLS·App 계정 → ECS의 DB 인증 실패·설정 수정·Migration → ACM·ALB·DNS·HTTPS 기본 응답 | 회차 노트·보고서 정리. 자정 이후 실제 실행일은 10/15 유지. 실제 로그인·업무 Row·전체 AI·복구는 이월 |
| 10/15 목 회차 | 실제 진행 분량 기록 | HTTPS 로그인·Cookie·CSRF 접수/SQL Row, HTTP 301·개인정보 검증/후보 평가·Cloud Log/Metric, Task 교체 권한 준비 | 10/15 노트·보고서 정리. 자정 이후 Version 6의 실제 적용일은 10/16 유지. Task 교체·재로그인 미실행 |
| 10/16 금 회차와 연장 실습 | 실제 진행 분량 기록 | 중지 환경 재개·Snapshot 별도 복원·원본 복귀·B→P/V8 보존 → psql 17·Process/Log 관찰 | 실제 실행일 17일은 보고서에 두고 16일 노트에 통합. 메모리/Log 설명 검증·전체 AI·남은 관측/마감은 미완료 |
| 10/17 토·10/18 일 | 휴무 | 새 학습·구현·평가 배정 없음 | 16일 회차의 기록 정리와 실행 보고서 날짜를 별도 학습일로 세지 않음 |
| 10/19 월 회차 | 실제 진행 분량 기록 | 메모리/HTTP/Job·Log 문답, 종료 관찰·Linux Process 검증 → 합성 전용 구성·새 Image·자동 Worker·자원 측정 두 번 | 마지막 메모리/Peak 문답 확인·노트 정리. V2·모델 고도화는 후속, 통합 고의 실패·새 코드 Cloud·비용/DNS·마감은 이월 |
| 10/20 화 진행 중 | 취업 우선·주간 기술 과업 6시간 안에서 배치 | 통합 Timeout·비정상 종료 후 자원/DB 확인 완료. 다음은 현재 Cloud 상태·비용과 새 코드 관측 → 승인한 합성 AI → DNS·회귀·복습·WIL | 실제 결과와 남은 분량을 갱신. 전부를 하루에 압축하지 않고 미완료는 다음 회차로 유지 |

### 10월 8일 목요일 실행 환경과 데이터 보존

아래는 처음 배정한 분량이다. 개념·Docker·Compose 실험은 이번 회차에서 진행했으며, 1번의 미확인 Cloud 조건과 4번의 미완료 배포용 조립은 10/9 첫 순서로 옮겼다. 완료한 기초 실험을 다시 하루 분량으로 배정하지 않는다.

1. **Cloud 선행 조건 1시간:** 학습 시작 때 AWS 접근 권한·Region·비용 범위·도메인 DNS 수정 권한부터 확인한다. 사용할 Subnet·Outbound 경로와 인증서 검증 순서를 정한다. 승인된 경우 DNS·ACM 준비를 시작하고 다른 실험 중 진행 상태를 확인한다.
2. **개념 1.5시간:** Source→JAR→Image→Container→Process의 관계, Port와 Container Network, 쓰기 계층과 Volume을 설명한다. 명령을 실행하기 전에 Process·DB·Session 중 무엇이 남을지 예상한다.
3. **Docker와 Compose 실험 4시간:** Dockerfile·`.dockerignore`를 작성하고 필요한 파일만 Image에 넣는다. Source만 바꾼 Build, 의존성을 바꾼 Build, Layer 순서를 바꾼 Build의 Cache·시간을 비교한다. Application과 PostgreSQL을 Compose로 연결해 Migration·접수·조회·Volume 보존을 확인한다. 기존 DB를 지우는 대신 별도 학습용 환경에서 Container만 재생성한다.
4. **배포용 설정 2.5시간:** 기존 Provider Adapter·Worker와 USER·AGENT를 실행 설정으로 연결한다. Secret 누락·Worker 비활성·유료 호출 분리 Test를 먼저 확인한다. 통제된 Provider로 조립을 검증한 뒤 실제 호출은 승인 범위 안에서 실행한다.
5. **설명과 기록 1시간:** Container 삭제·Volume 유지·새 DB 생성의 차이를 설명한다. 학습자료는 먼저 읽고, 실험 후 핵심 설정 한 부분을 직접 바꿔 결과를 확인한다.

Compose의 시작 순서와 Database의 준비 완료를 구분한다. Health Check와 의존 조건을 사용하되 기동 뒤의 DB 장애·재연결은 별도로 확인한다. [Docker Compose 시작 순서](https://docs.docker.com/compose/how-tos/startup-order/)

#### 필수 실험과 남길 결과

| 실험 | 진행 순서 | 확인할 결과 |
|---|---|---|
| Image 재현과 Cache | 최초 Build → Source 한 곳 변경 → 재Build → 의존성·Layer 순서를 각각 바꾸어 비교 | 어떤 Layer가 재사용되었는지와 걸린 시간. Cache가 빨라지는 이유를 Dockerfile 순서로 설명 |
| Compose 연결 | 새 학습용 환경에서 DB 준비 → Migration → 로그인·접수·조회 | App 내부의 DB 주소와 Host의 접속 주소 구분, Migration 이력과 실제 Ticket·Message·Job Row |
| 데이터 보존 | 같은 Volume을 두고 DB Container 교체 → App 재연결 → 같은 ID 조회 | Container가 바뀌어도 남는 Row와 App 종료 시 사라지는 Session 구분. Volume 삭제 명령은 사용하지 않음 |
| 실행 설정 분리 | 기본 설정·필수 Secret 누락·명시적 Worker 활성 구성을 각각 Test | 기본 CI에서 실제 외부 AI 호출 0회, 잘못된 배포 구성의 안전한 실패, 합의한 구성에서 처리 성공 |

마무리 질문:

- Image에 포함할 파일과 실행 시 주입할 Secret을 왜 나누는가?
- App Container와 DB Container에서 `localhost`가 각각 가리키는 곳은 어디인가?
- 같은 DB를 유지하고 App Container를 재생성한 뒤 Ticket은 남았는데 다시 로그인해야 하는 이유는 무엇인가?

### 10월 9일 금요일 Process와 CI

**이월 과업과 배포 우선순위:** 배포용 설정 연결의 초기 배정 2.5시간과 Cloud 선행 조건의 초기 배정 1시간을 유지한다. Provider 등록·합성 Secret·위치 치환 이후에는 Process·관측·CI와 Cloud 준비를 먼저 병행한다. 개인정보 탐지 모델의 추가 검토 때문에 배포 학습 전체를 멈추지 않는다. 핵심 질문은 2~3개씩 묶고 통상적인 구현은 바로 진행한다. 전체 AI 수직 흐름 전에 남은 실행용 조립을 끝내며, 잔여 과업은 10/10 Cloud 작업보다 먼저 배치한다.

1. **Process 실험 2.5시간:** Linux 환경에서 `ps`·`/proc/<pid>/status`·Exit Code·표준 출력을 관찰한다. SIGTERM과 강제 종료를 비교하고, 진행 중 요청·Job과 DB Connection이 어떻게 되는지 설명한다. Graceful Shutdown과 대기 시간을 실행 환경에 맞춰 설정·기록한다. Secret이 들어갈 수 있는 Process 환경 변수나 전체 실행 인자는 출력하지 않는다.
2. **관측 2시간:** 구조화된 Log와 최소 Health·Request 수·오류·응답시간을 확인한다. CLI Pipeline으로 합성 요청의 Log를 필터링·집계하고, Request ID·Job ID로 요청과 비동기 처리를 연결한다. Credential·Cookie·CSRF·원문은 Log에 넣지 않는다. Health 상세·환경 변수·Heap Dump·관리 기능을 공개하지 않는다.
3. **CI 3시간:** 실제 GitHub Actions에서 Java Build·PostgreSQL Integration Test·JavaScript Test·ESLint·Image Build를 연결한다. 학습용 실패를 넣어 중단 지점을 관찰하고 복구한다. Testcontainers의 실제 PostgreSQL을 H2나 건너뛴 Test로 바꾸지 않는다. 실제 AI 호출은 기본 CI에서 제외한다.
4. **IAM과 ECR 1.5시간:** 사람의 접근, Actions의 배포 권한, ECS의 실행 권한을 구분한다. 승인된 리소스에 한정해 OIDC와 ECR Push를 연결하고 Commit과 Image Digest를 기록한다. 배포는 자동 Push만으로 시작되지 않도록 승인 단계를 둔다.
5. **설명과 기록 1시간:** Build 성공·Test 성공·Image Push·Service Health가 각각 무엇을 증명하는지 설명한다.

Actions는 장기 AWS Key 저장 대신 OIDC의 단기 자격 증명을 사용하는 방향으로 구성한다. 실제 Repository·Branch 또는 Environment의 `sub`와 `aud`를 제한하며 예제의 값을 그대로 복사하지 않는다. [GitHub의 AWS OIDC 안내](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)

#### 필수 실험과 남길 결과

| 실험 | 진행 순서 | 확인할 결과 |
|---|---|---|
| 종료 방식 비교 | 동일한 합성 요청·Job 조건 준비 → 정상 종료 요청 → 재개 → 강제 종료와 비교 | 종료 대기·Process 생존 여부·Exit Code·DB 상태. SIGTERM 전송 자체와 실제 정상 종료를 구분 |
| Log와 Metric | 정상 요청과 의도한 오류 요청 전송 → CLI로 해당 Log 추적 → 요청 수·오류·지연 확인 | 한 Request의 기록과 여러 Request를 합산한 Metric의 차이, HTTP 응답과 AI Job 결과의 차이 |
| CI 차단 | 격리된 학습 변경에서 Test 실패 → 실제 Workflow 실패 확인 → 수정 후 재실행 | 실패한 검사 이후 Image 배포 경로가 차단되는지, 실제 PostgreSQL Test 실행 여부, 복구한 Commit |
| 최소 권한 | 필요한 ECR Action이 없는 학습용 Role로 시도 → 거부 확인 → 필요한 리소스·Action만 허용 | 거부 원인과 허용 범위. 편의를 위해 Administrator 권한으로 우회하지 않음 |
| 배포 대상 식별 | 성공한 CI의 Image를 ECR에서 확인 → Commit·Tag·Digest 대조 | 다음 날 ECS에서 실행할 정확한 Image와 CI 실행 기록 |

마무리 질문:

- Container에 종료 Signal을 보냈는데도 Process가 남는다면 무엇부터 확인하는가?
- 요청 `201`과 그 뒤 AI Job의 `FAILED`는 왜 동시에 성립할 수 있는가?
- CI가 성공했다는 사실만으로 Cloud에서 정상 응답한다고 말할 수 있는가?

### 10월 10일 토요일 Cloud와 HTTPS 수직 연결

실제 CI 실패·복구와 AWS 초기 설정에 이어 OIDC 인증·ECR Push·Commit·Digest 대응을 확인했다. 아래는 초기 10/10 배정 분량이며, 오늘은 Image 업로드까지 마감했다. 아래 Cloud 실험은 10/11 야간 또는 10/12부터 남은 권한 거부 실험·전체 배포용 조립·접근·비용 조건을 확인한 뒤 이어간다.

1. **Network와 IAM 1시간:** Browser→ALB→Application→RDS, Application→AI의 경로를 그린다. IAM 거부와 Security Group·DNS·DB 인증 실패를 구분한다.
2. **ECS와 RDS 3시간:** 승인한 구성으로 학습용 RDS·ECS를 연결한다. Migration 상태와 실제 DB 연결을 확인하고 ECR의 검증된 Digest를 배포한다. 필요한 Secret만 주입하며 배포 설정이나 Log에서 값을 출력하지 않는다.
3. **DNS와 HTTPS 1.5시간:** DNS 조회·인증서 이름과 신뢰 사슬·ALB HTTPS Listener·HTTP Redirect를 관찰한다. TLS가 종료되는 위치와 ALB 이후 내부 통신을 구분한다. 인증서 경고를 무시해 통과시키지 않는다. [ALB HTTPS Listener](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html)
4. **실제 Browser 확인 2시간:** HTTPS에서 로그인·Session Cookie의 Secure/HttpOnly/SameSite·CSRF 전달을 확인한다. 접수 `201`, CSRF 누락 `403`, 익명 조회 `401`, USER 조회 `403`, AGENT 조회 `200`을 대조한다. 실제 Worker·AI·RDS·담당자 화면의 결과와 원문 보존을 확인한다. Cookie·Token은 값이 아닌 존재·속성만 기록한다.
5. **Backup와 중단·재개 준비 1.5시간:** Backup 보존 설정·Snapshot과 후속 복구 실험 준비를 확인한다. 자동 Worker의 추가 유료 호출을 막고, 실습을 중단할 때 무엇을 중지·보관할지 승인된 절차로 처리한다. 다른 프로젝트의 리소스는 건드리지 않는다.
6. **설명과 기록 1시간:** DNS·TLS·인증·인가·DB·AI 중 각 결과를 어느 계층에서 확인했는지 설명한다.

초기 토요일 종료 목표였던 첫 HTTPS 수직 연결은 아직 실행하지 않았다. ECR Image 보관까지 완료한 상태에서 학습을 마쳤으며, 선행 구현·Cloud 생성·인증서 검증을 재개 순서에 포함한다. 복구·회귀·WIL이 남는 경우 해당 분량을 Week 8 연장 과제로 유지한다.

#### 필수 실험과 남길 결과

| 실험 | 진행 순서 | 확인할 결과 |
|---|---|---|
| 실행 Image와 DB | ECR Digest 지정 → ECS Task 시작 → Migration 확인 → 실제 접수 | 실행 Task의 Image 대응, RDS의 Ticket·Message·Job Row, Source와 배포본의 일치 |
| DNS와 TLS | 도메인 조회 → ACM 검증 상태 확인 → HTTPS 연결 → HTTP 접근과 비교 | 도메인이 향하는 진입점, 인증서 Hostname·신뢰 사슬, Redirect 위치와 TLS 종료 위치 |
| 보안 계약 | HTTPS 로그인 → Token 조회 → CSRF 없는 접수와 유효한 접수 비교 → 세 Role의 조회 | `401`·두 종류의 `403`·`201`·`200`, Cookie 속성, 실제 요청의 CSRF Header 존재 |
| AI 수직 흐름 | 접수 Commit → Worker 처리 → 검증된 Suggestion 저장 → AGENT 조회 | 원문 보존, Job·Suggestion과 화면 일치, Ticket은 `OPEN` 유지. HTTP 조회 성공과 AI 처리 성공을 따로 판정 |
| 실습 중단·재개 | 필요한 실행 근거·Backup 확보 → Worker와 학습용 실행 리소스 상태 정리 | 무엇이 중지되고 무엇이 남아 과금되는지, 재개에 필요한 설정과 보존 데이터 |

마무리 질문:

- DNS 조회 성공·TLS 연결 성공·로그인 성공·DB 저장 성공은 각각 무엇을 확인한 것인가?
- ECS가 Image를 받는 권한과 앱이 RDS에 접속하는 조건은 어떻게 다른가?
- HTTPS를 적용해도 Session·Role·CSRF 검사가 필요한 이유는 무엇인가?

### 10월 14일 재개 순서

10/13 회차 마감 뒤 아래 순서로 10/14 학습을 진행했다. Source `2e2cc40`의 CI·새 Image Build·ECR 업로드와 승인한 IAM·Network·관리 통로·Subnet Group을 기준으로, RDS·ECS·HTTPS를 연결했다. 이후 실행 코드가 바뀌면 해당 변경을 검증하고 새 Image를 전달한다.

첫 배포는 합의한 AI 비활성 단계부터 진행한다. 개인정보 탐지기 구현 때문에 ECS·RDS·HTTPS 학습 전체를 멈추지 않되, 전체 AI 조립과 검증은 최종 완료 기준에 그대로 남긴다.

1. **RDS 설정과 조회 확인:** 비Root 생성·사용 가능·저장 설정·Project 태그 확인은 완료했다. 지정 DB의 태그 조회만 MFA·서울 조건으로 보조 정책 Version 2에 추가하고 기존 Version 1·다른 정책·생성 조건은 유지했다. 앞선 생성 거부의 구체적인 불일치 조건은 당시 기록으로 확정하지 않으며, 생성 요청을 반복하거나 글로벌 클러스터·Snapshot 조회를 확대하지 않는다. [종합 진단 보고서](./lab-reports/2026-10-14-rds-console-permission-diagnostics.md)의 결과에서 이어간다.
2. **Private DB와 AI 비활성 첫 Cloud 실행:** DB 생성 뒤 관리 통로의 공개 CA·`verify-full` 접속, 관리자/App DB 계정 분리·권한·Migration을 확인한다. 검증 Digest·Profile·Execution Role·Parameter·Log·CPU·Memory·Network의 실제 참조와 실행 범위를 확인하고 ECS에서 Image를 실행한다. Agent의 Parameter 전달·Log, 로그인·Session·CSRF·접수 `201`과 Ticket·Message·`PENDING` Job을 대조한다. Provider 호출은 0회여야 한다. IAM·Network·DB 인증 실패를 구분하는 거부·복구 실험도 유지한다.
   - **진행 결과:** `helpdesk-learning:1`과 `0.25 vCPU·512 MiB`의 단독 Task에서 Image Pull·Log 전달을 확인했다. 첫 DB 인증 `28P01` 뒤 지정 암호 Parameter 한 개만 맞췄고, 같은 Image·명세의 추가 Task에서 JDBC·Migration 7개·Spring 기동이 성공했다. 기동 확인 뒤 Task는 중지했다. API·Health·Browser 확인과 업무 Row 대조는 다음 단계다. [Cloud 기동 보고서](./lab-reports/2026-10-14-ecs-first-cloud-startup.md)
3. **DNS·HTTPS와 실제 Browser:** Cloudflare DNS-only·ACM·ALB·HTTP Redirect를 연결해 도메인·인증서·TLS 종료를 확인한다. HTTPS 로그인과 Cookie 속성, 익명 `401`·USER 조회 `403`·AGENT 조회 `200`, CSRF 없는 접수 `403`·정상 접수 `201`을 확인한다. Route 53 Hosted Zone·NS·Alias 비교와 별도 DNS 조회 실습도 유지한다.
   - **진행 결과:** ACM 발급과 Cloudflare 검증 CNAME을 먼저 확인한 뒤, Edge Version 4의 지정 VPC 조회를 적용해 ALB·새 Task를 실행했다. 서비스 CNAME은 DNS-only로 연결했고 Target Healthy·HTTPS Health 200/UP·로그인 화면 200·익명 API 401을 확인했다. 실제 로그인·접수와 80 Redirect는 미실행이다. [HTTPS 연결 보고서](./lab-reports/2026-10-15-cloud-https-baseline.md)
4. **전체 AI 조립·실행·자원:** 실제 개인정보 탐지기, 검사 결과 JSON·위치 검증과 치환을 연결한다. `PRIVACY_SCAN_TIMEOUT`·`PRIVACY_SCAN_INVALID_RESULT`의 Java·Migration·조회·UI 연결, 현재 Attempt·원문 보존·외부 미전송·자동 복구 차단을 검증한다. Provider·출력 검증기·Worker·실행용 Secret을 연결해 통제된 Provider부터 확인하고, 그날 승인한 실제 AI로 RDS 저장·AGENT 화면을 대조한다. 개인정보 검사·Worker를 포함한 CPU·메모리도 다시 측정한다.
5. **System·장애 관찰·복구:** `/proc`·CLI Log Pipeline과 Request/Job 연결, CloudWatch Log·Health·요청 수·오류·응답시간을 확인한다. 종료 중 DB·Session·Job, 같은 RDS를 유지한 재배포·재로그인, 정상 Cloud 기준 Image로의 Rollback과 별도 DB Snapshot 복원을 검증한다. 기존 ECR Image 보관을 실제 Cloud Rollback 성공 근거로 대신하지 않는다.
6. **최종 회귀와 공개 마감:** 변경 Code의 Local·CI 회귀와 Cloud HTTPS Browser 흐름을 재검증한다. 자료 없이 핵심 흐름·대표 실패를 설명하고 설정 한 부분을 직접 수정해 확인한다. 재현·최소 비용·리소스 정리 기록과 WIL을 검토한 뒤 블로그·포럼 등록을 진행한다. 외부 게시·삭제는 확인 없이 실행하지 않는다.

10/14 회차는 HTTPS 기본 응답까지 확인하고 마감한다. DB 생성은 기존 보안 조건으로 성공했지만, 앞선 거부의 구체적인 불일치 조건을 당시 기록만으로 확정하지 않는다. 남은 과업은 10/15에 아래 순서로 이어간다.

### 10월 15일 재개 순서

1. **실행 상태와 비용:** 단독 Task·ALB·RDS와 현재 Target 등록을 확인한다. 마지막 확인 시 모두 실행 중이었으며 아직 중지·삭제하지 않았다. 사용하지 않을 때의 중지·보관·정리 범위와 비용을 확인한다. 새로운 실행·권한·삭제는 기존 승인 범위를 넘기지 않는다.
2. **Browser 보안과 실제 DB:** Helpdesk USER·AGENT의 실제 로그인, Cookie의 Secure·HttpOnly·SameSite 속성, CSRF 없는 접수 403·정상 접수 201과 익명 401·USER 조회 403·AGENT 조회 200을 확인한다. Ticket·Message·PENDING Job Row·예약 0건을 SQL로 대조하고, 자동 외부 호출 부재는 Provider·Worker의 실행 설정과 나누어 확인한다. Cookie·CSRF 값은 출력하지 않는다. 접수와 SQL Row의 기초 확인은 진행했으며 후속 전체 AI 회귀에서도 보안 계약을 유지한다.
3. **DNS의 남은 실험:** Route 53 Hosted Zone·NS·Alias 비교와 별도 조회를 유지한다. HTTP Redirect는 승인한 기존 443과 동일한 학습자 `/32`의 80 허용과 301 Listener를 추가해 실제 응답을 확인했다. [Redirect 보고서](./lab-reports/2026-10-15-alb-http-https-redirect.md)에 기록했으며 메인 도메인의 DNS·App·RDS·IAM은 변경하지 않았다.
4. **전체 AI와 실행 자원:** 개인정보 탐지기·위치 치환·실패 코드의 DB/조회/UI·Provider·검증기·Worker·Secret을 연결한다. 통제된 Provider로 정상·실패를 먼저 확인하고 당일 승인한 실제 AI로 RDS·화면을 대조한다. 전체 구성의 CPU·메모리도 측정한다.
5. **관측과 복구:** `/proc`·CLI Log Pipeline·Request/Job 추적과 CloudWatch Log·Health·요청 수·오류·지연을 확인한다. 종료 중 DB·Session·Job, 같은 RDS를 유지한 재배포·재로그인, 이전 정상 Image 복귀와 별도 Snapshot 복원을 검증한다.
6. **최종 마감:** Local·CI·Cloud 회귀, 자료 없는 핵심 설명, 직접 설정 수정·검증과 재현·비용 기록을 마친 뒤 WIL을 검토한다. 블로그 게시·포럼 등록·리소스 삭제는 별도 확인한다.

이 순서는 15일 하루 안에 모두 끝내라는 시간 상한이 아니다. 학습량을 줄이거나 미실행 항목을 완료 처리하지 않으며, 필요한 시간이 남으면 같은 Week 8 기간을 연장한다.

### 10월 15일 회차 마감과 10월 16일 재개

15일에는 HTTPS 로그인·Cookie·CSRF 접수/SQL Row와 HTTP 301, 로컬 개인정보 검증·실제 후보 평가와 Cloud 관측을 진행했다. 자정 이후 Edge V6·Version 1 JSON 보관과 삭제를 마쳤지만, 사용자가 마감을 요청해 실제 Target 등록 해제·Task 중지/교체·재로그인은 실행하지 않았다. [10/15 노트](./study-notes/2026-10-15-study-questions.md)와 [실제 10/16 교체 준비 보고서](./lab-reports/2026-10-16-cloud-task-replacement.md)에 회차와 실행일을 구분한다.

권한 준비 직후에는 아래 순서를 계획했다. 이후 비용 중지 요청에 따른 실제 상태와 먼저 필요한 복구는 다음 ‘리소스 일시중지’ 절을 따른다. 전체 분량을 하루에 강제하거나 미실행 실험을 삭제하지 않는다.

1. **현재 상태와 교체 전 기준:** 비Root 로그인·현재 Task/Target·비용을 다시 확인한다. AGENT로 기존 문의가 읽히는 새 기준을 확보한다. 이미 인증되지 않았던 Browser 상태를 교체 때문에 Session이 사라진 결과로 기록하지 않는다. Edge V6 적용·Version 1 정리는 반복하지 않는다.
2. **승인한 Task 한 개 교체:** 같은 Image Digest·`helpdesk-learning:1`·RDS·AI 비활성을 유지한다. 기존 Target 등록 해제·Draining → 기존 Task 종료 → 새 Task 한 개 → 새 Private IP:8080 등록·Healthy 순서로 검증한다. 기존 문의 보존·이전 Session 거부·재로그인 후 재조회를 확인한다. RDS·Schema·DNS·Secret은 변경하지 않는다. 같은 Image 재실행을 이전 Image Rollback으로 부르지 않는다.
3. **실제 복구와 남은 배포 실험:** 이전 정상 Image 복귀와 Schema 호환성, 별도 Snapshot 복원·실제 Row·접속 설정을 확인한다. Route 53의 별도 Zone/조회와 `/proc`·CLI Log Pipeline·Request/Job 연결·App Metric 등 미완료 실험을 유지한다. 추가 리소스·복원 비용·삭제·새 권한은 해당 범위를 확인한 뒤 실행한다.
4. **전체 AI 연결과 자원:** 개인정보 탐지 후보·실행 Adapter의 Timeout/자원 회수·Main Bean·관계 보존을 완성한다. 원문·예약·현재 Attempt·외부 미전송·실패 기록을 검증하고 Provider·검증기·Worker·Secret을 연결한다. 합성 입력의 실제 AI는 그날의 호출 범위·비용 조건을 확인하며, 전체 CPU·메모리와 Cloud 결과를 측정한다.
5. **회귀·설명·마감:** Local·CI·Cloud HTTPS를 다시 검증하고 자료 없이 흐름·실패·복구를 설명한다. WIL·게시/포럼, 최종 Snapshot·보관·정리는 실제 완료와 별도 승인에 따라 기록한다. 마지막 확인 시 App·ALB·RDS가 남아 있으며 문서 마감은 실행 중지나 비용 중단이 아니다.

### 10월 16일 리소스 일시중지

별도 요청으로 기존 Target 한 개를 해제하고 300초 Draining 종료·Target 0개를 확인한 뒤 App Task의 실제 STOPPED·실행/보류 Task 0개·Service 0개를 확인했다. 이어 RDS 한 개의 최종 ‘일시적으로 중지됨’·연결 0개를 확인했다. 추가 Snapshot·새 Task·AI 호출·권한 변경은 하지 않았다. [중지 보고서](./lab-reports/2026-10-16-learning-resource-pause.md)에 최종 상태·남는 비용·재개 순서를 기록한다.

ALB는 중지 기능이 없어 유지했다. RDS 저장/백업·ECR Image·Log 보관과 ALB·공인 IPv4 비용은 별도로 남으며, RDS 확인창은 10/23 00:57 KST 자동 재시작을 안내했다. 이번 요청은 리소스 삭제·자동 중지 예약의 승인이 아니다.

다음 실습은 RDS 시작/사용 가능 확인 → 같은 검증 Image·명세의 새 Task → 새 Private IP:8080 등록/Healthy → HTTPS·재로그인·기존 문의 조회부터 이어간다. 실제 중지 뒤 데이터 보존·Session 비교는 아직 검증하지 않았다. 정식 Task 교체 비교의 인증 기준은 복구 후 새로 확보한다. 이전 Image 복귀·Snapshot 복원·전체 AI·Route 53·System·관측·회귀·WIL의 범위는 그대로 남긴다.

### 10월 16일 중지 환경 재개 결과

위 일시중지 이후 RDS 사용 가능 → 같은 검증 Image·명세의 새 단독 Task 한 개 → 실제 Private IP:8080 등록/Target Healthy → HTTPS 기본 응답 → AGENT 재로그인·기존 문의 조회 순서로 재개했다. Ticket 1·2는 OPEN, 각 AI Job은 PENDING으로 조회됐다. DB·Schema·DNS·Secret·IAM은 변경하지 않았고 AI도 켜지 않았다. [재개 보고서](./lab-reports/2026-10-16-cloud-resource-resume.md)와 [10/16 노트](./study-notes/2026-10-16-study-questions.md)에 실행과 개념을 구분했다.

재개 전 인증 Session의 유효성을 확보한 전후 비교는 아니므로 정식 Session 소실 실험은 남긴다. 현재 AGENT 조회를 교체 기준으로 사용할 수 있다. 같은 Image 재실행을 이전 Image Rollback으로 바꾸어 기록하지 않는다. 다음은 Session 전후 비교·이전 Image 복귀와 별도 Snapshot 복원의 차이를 설명하고 필요한 실행 범위·비용·승인을 확인하는 단계다. 남은 Route 53·System/관측·개인정보 검사 Adapter·전체 AI·자원 측정·회귀·WIL은 생략하지 않는다.

복원 학습에서는 Snapshot 시점·새 Endpoint, Worker 비활성과 실제 Row 비교를 설명할 수 있음을 확인했다. Lab의 별도 복원 Policy·실행/정리 안내와 로컬 구조 Test를 준비했다. 관련 38개와 SQL Source 보호를 합친 Focused 41개·JavaScript 전체 246개·ESLint가 통과했다. 이후 승인한 복원 전용 Policy Version 1을 AWS에서 검증·생성하고 별도 연결 승인을 받아 지정 사용자 한 명에게 연결했다. 기존 다섯 정책·Role은 유지했다. 비Root에서 원본 SQL 기준과 지정 Snapshot의 Available·비공개·암호화·태그를 확인했다. 최초 복원 요청의 IAM 거부 뒤 승인한 Root 단건 진단으로 정확한 불일치 조건은 확인하지 못했다. 추가 승인한 세 조건만 V2에서 조정하고 V1·지정 Snapshot/Subnet·나머지 보안/비용 제한은 보존했다. Root 로그아웃·비Root MFA 후 같은 임시 DB 한 개의 재요청은 수락됐고 사용 가능·보안 설정·TLS와 일곱 Table의 원본 건수/Hash 일치를 확인했다. 같은 Image의 App 명세 :2는 JDBC Host만 바꿔 등록했다. 이후 단일 App 순차 전환·Session 전후 비교·AGENT 재로그인·원본 복귀와 업무 조회까지 완료했다. 임시 DB는 중지 후 별도 최종 승인으로 삭제했으며 원본 DB와 검증 Snapshot은 유지했다. [복원 실행 보고서](./lab-reports/2026-10-16-rds-snapshot-restore.md)에 단계별 결과를 기록한다. V2 변경 뒤 전체 246개·ESLint도 다시 통과했다. 승인 외 조건 변경·Root로 복원 실행·원본 DB/Snapshot 삭제·AI 호출은 하지 않았다.

### 10월 12일 이후 실패 추적과 복구

10/16에는 기준 Source `2e2cc40`의 별도 `codex/week8-rollback-prepare` Branch에서 읽기 준비 P를 구성했다. 운영 변경은 새 실패 코드 두 개의 Java Enum·UI 허용값뿐이며 V8은 Test Fixture로 분리했다. 로컬 PostgreSQL V7/V8의 P 기동·기존 데이터 보존·새 실패 코드 HTTP 200/FAILED 조회·신규 접수와 보안 계약을 확인했다. 관련 Java 56개·JAR 포장에 이어 P Docker Image를 빌드하고, 0.25 vCPU·512 MiB의 실제 Container/JVM·HTTP로 같은 호환 흐름과 재로그인을 검증했다. 추가 안전장치 Test를 포함한 P JavaScript 전체 181개·ESLint도 통과했다. V8은 외부 Test 단계에서만 적용하고 정상 P 실행 때 Mount·추가 설정을 제거했다. 실제 Browser·AI·후속 B·Cloud Rollback과는 구분하며 [P 사전 검증 보고서](./lab-reports/2026-10-16-image-rollback-preflight.md)에 결과를 기록했다.

이후 승인한 Commit·Push와 P의 원격 CI·ECR 전달을 완료했다. main의 고정 Manifest에서 P `77359c9`만 선택해 전체 Java 579개·JavaScript 181개·ESLint·Image Build를 통과한 동일 Image 한 개를 기존 ECR에 추가했다. main의 별도 CI도 Java 704개·JavaScript 254개·ESLint·Build에 성공했다. 기존 main Workflow·IAM과 App·RDS·ALB·DNS·Secret은 이 전달 단계에서 변경하지 않았다. [P CI·ECR 보고서](./lab-reports/2026-10-16-prepare-image-ci-ecr.md)에 두 Commit·Run·Tag·Digest를 연결했다.

별도 승인한 A→P Cloud 전환도 완료했다. 요청 태그 누락과 잘못된 임시 DB 주소의 :3 기동 실패 때에는 A로 복귀했고, 실제 기준 :1에서 Image만 바꾼 수정 :4를 다시 대조해 실행했다. 원본 RDS·V7·AI 비활성을 유지한 P의 실제 Digest·Spring 기동·Target Healthy·HTTPS를 확인했다. AGENT 재로그인 후 Ticket 1/2가 OPEN이고 각 Job이 PENDING인 것을 읽기 전용으로 조회했다. IAM·DNS·Secret은 변경하지 않았으며 :2·:3은 재실행하지 않는다. [P Cloud 전환 보고서](./lab-reports/2026-10-16-prepare-image-cloud-transition.md)에 실제 실패·복귀와 최종 결과를 구분했다. 이어진 B 적용과 P 복귀 결과는 아래에 정리한다.

이어 승인한 B→P 실험도 완료했다. 고정 B `3fdbdeb`의 Java 704개·JavaScript 254개·Lint·Build와 동일 Image ECR 전달을 확인하고, 실제 P :4에서 Image만 바꾼 :5를 대조했다. 기존 P의 300초 Draining·종료 코드 143 뒤 단일 B가 기동했다. 원본 RDS의 V8 적용·기존 여섯 Table의 Hash 보존·Target Healthy·HTTPS를 확인했다. 별도 합성 SQL은 로컬 PostgreSQL Test를 통과한 뒤 새 실패 두 건만 추가했으며 실제 AI 실행 자료가 아니다. B의 AGENT 조회 뒤 같은 300초 정리·B STOPPED를 확인하고 P :4 한 개로 복귀했다. 10/17 KST의 P 기동·Target Healthy·HTTPS Health UP과 재로그인 후 기존 문의/Job·새 실패 코드 조회까지 확인했다. 복귀 전·P 기동 뒤·인증 조회 뒤 일곱 Table 건수/Hash가 모두 같았다. [B→P 실행 보고서](./lab-reports/2026-10-16-image-rollback-cloud.md)에 결과와 합성 자료 범위를 기록한다. IAM·DNS·Secret·보안 그룹은 변경하지 않았고 Provider·Worker도 켜지 않았다. 전체 AI·자원 측정·최종 회귀·WIL은 남아 있다.

아래는 초기에 배정한 복구·마감 분량이다. 복원과 Image Rollback은 16일 회차에 검증했으므로 전체를 다시 수행하는 일정이 아니다. 남은 관측·회귀·설명·WIL은 19일 이후 현재 재개 순서와 취업 우선 시간 경계 안에서 배치한다.

1. **재개와 장애 관찰 2시간:** 중지한 환경을 복원하고, 학습용 권한 부족 또는 DB 연결 설정 실패를 한 번에 하나씩 재현한다. CloudWatch의 Log·Health·Request/Error/Latency Metric을 대조한다. Application 오류와 ALB가 반환한 오류를 구분하며 공개 고의 실패 API를 추가하지 않는다.
2. **Rollback과 Backup 3시간:** 같은 RDS를 유지한 Task 교체 후 기존 Ticket·Job·제안이 남는지 확인한다. DB Schema를 바꾸지 않은 학습용 실패 배포를 이전 정상 Image Digest로 되돌린다. Snapshot은 원본을 덮어쓰지 않는 별도 임시 DB로 복원해 대표 Row를 확인하고, 앱 Version 복귀와 DB 복구의 차이를 기록한다. 복원용 추가 리소스 비용도 사전 승인 범위에 포함한다.
3. **최종 회귀 2시간:** 변경한 Code의 Java·JavaScript·정적 검사와 실제 CI 결과를 확인한다. Cloud HTTPS Browser 흐름을 다시 실행하고 Image·DB·화면의 대응을 기록한다. Process 재시작으로 Session이 사라져 재로그인하는 것과 문의 데이터 손실을 구분한다.
4. **설명과 WIL 2.5시간:** 대표 실패 하나를 자료 없이 설명하고 핵심 설정 한 부분을 직접 수정해 검증한다. 성공·실패·원인·복구를 WIL과 재현 절차로 정리한다. 블로그 초안 검토·게시·포럼 등록 시간을 포함하되 외부 게시는 작성자 확인 뒤 진행한다.
5. **마감 0.5시간:** 보존할 데이터·Snapshot·실행 근거를 확인하고, 학습용 리소스의 중지·삭제·유지 결정을 기록한다. 유지 비용과 담당할 후속 정리 시점을 남긴다.

#### 필수 실험과 남길 결과

| 실험 | 진행 순서 | 확인할 결과 |
|---|---|---|
| 장애 위치 찾기 | 정상 기준 확보 → 학습 환경에서 권한 또는 DB 연결 조건 하나 변경 → 요청 → 원상 복구 | 변경 조건·응답·Health·Log·Metric의 관계. 서로 다른 실패를 한 번에 만들지 않음 |
| 같은 DB로 재배포 | Ticket·Message·Job·Suggestion의 ID와 상태 기록 → App만 교체 → 재로그인·재조회 | 기존 Row 보존과 새 Process 생성. Session 소멸을 DB 손실로 오해하지 않음 |
| Application Rollback | 이전 정상 Digest 기록 → DB Schema를 바꾸지 않는 실패 Version 배포 → 이전 Digest 복귀 | Health와 기존 API 흐름 회복. Image Rollback이 DB Migration을 되돌리는 기능은 아니라는 점 |
| Database 복원 | 복원 기준 시점과 대표 Row 기록 → Snapshot을 별도 DB로 복원 → 원본과 비교 | 실제 복원된 Row·관계·상태, Snapshot 이후 데이터의 차이. Backup 생성 성공만으로 복원 성공을 대신하지 않음 |
| 회귀와 설명 | Local·CI 검사 → Cloud Browser 재검증 → 요청 흐름과 대표 실패를 자료 없이 설명 | 환경별 실행 결과, 직접 설명·수정한 설정, 남은 미완료 항목 |

마무리 질문:

- 이전 Image로 돌아왔는데 데이터까지 과거 상태로 돌아가지 않는 이유는 무엇인가?
- Snapshot 시점 이후 접수된 문의는 그 Snapshot을 복원한 DB에 존재하는가?
- HTTPS 요청 한 건과 뒤따르는 Worker 처리가 실패했을 때 어떤 순서로 근거를 찾는가?

## 비용과 공개 전 확인

10/9의 이월 과업에서 다음 항목을 확인하고, 막힌 항목은 즉시 일정에 반영한다. 설정을 쉽게 끝내려고 권한이나 공개 범위를 넓히지는 않는다.

| 확인 항목 | 결정할 내용 |
|---|---|
| AWS 계정과 권한 | 비Root·MFA와 기존 Execution Role 유지. Runtime V4·조회 보조 V2·Edge V6 적용, 기존 DB 생성 조건 유지. Edge V1 JSON 보관 후 삭제·V2~5 보존. Task Role은 실제 AWS API 사용 여부에 맞춰 결정 |
| 도메인 | `helpdesk.hmyoon.com`의 비수출 ACM·두 CNAME·DNS-only와 동일 Source 제한의 HTTP 301 확인. Route 53 별도 학습 Zone·조회는 생성 범위/비용 확인 후 진행 |
| 과금 | 최대 12개월 보관·월 지출 상한 3만 원·실습 시 실행 조건 확인. 목적을 충족하는 최소 비용안을 비교하고 ECS·RDS·ALB·IPv4·보관량·잔여 비용을 실제 필요량으로 갱신 |
| AI 호출 | Helpdesk 전용 Key의 존재만 확인. 배포 실험의 입력·횟수·당일 비용 조건 확인 |
| 자료 공개 | 합성 문의만 사용하고 Credential·Cookie·Token·실사용자 원문·내부 주소가 근거 파일에 섞이지 않는지 확인 |

무료 이용 대상 여부나 이전 AI 비용 승인을 근거로 AWS 과금을 승인한 것으로 보지 않는다. AWS Budgets 알림에는 지연이 있을 수 있으므로 강제 지출 상한으로 취급하지 않는다. [AWS Budgets 안내](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)

실습을 중단하기 전에 실행·보관 리소스를 구분한다. 10/10까지 이번 배포 학습에서 만든 실행 리소스는 없고, ECR에 Image 한 건을 보관했다. Image 보관 비용은 남으므로 중단을 비용 0원과 같은 뜻으로 보지 않는다. 후속 실습에서 RDS를 중지해도 Storage·Backup 비용은 남을 수 있고, 중지 7일 뒤에는 자동 재시작될 수 있다. ALB·Log·Snapshot 등도 별도로 확인한다. 삭제와 Backup 보존도 서로 다른 상태다. [RDS 중지와 과금 안내](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html)

## 필요한 자료와 기록

학습을 시작할 때 기본 개념부터 설명한다. 낯선 설정을 먼저 맞히게 하기보다, 흐름 설명→작은 예측→실행→자기 말로 설명하는 순서로 진행한다.

질문은 핵심 개념·정책 2~3개를 묶어 진행한다. 반복적인 실행 요청을 요구하지 않고, 학습 범위 안의 통상적인 구현·Test는 바로 이어간다. 리소스 생성·과금·DNS 변경·삭제와 Secret 위험은 별도 확인한다.

- `study-docs/`: Docker·Compose, Process·Signal, CI·IAM, DNS·TLS·Cloud 복구 자료를 해당 주제 시작 전에 준비한다. 날짜·진도는 넣지 않고 기존 자료와 겹치는 내용은 링크한다.

  - [IAM OIDC ECR 권한과 배포 Role](./study-docs/iam-oidc-ecr-and-deployment-roles.md): Trust Policy·Permission Policy, 임시 Credential 발급과 Image 업로드·실행 권한을 구분한다.
  - [검증한 Image를 ECR에서 ECS로 전달하기](./study-docs/image-publishing-and-ecs-execution.md): 실제 OIDC 인증·Push, Commit·Tag·Digest와 Task Definition·Task·Service의 연결을 순서대로 이해한다.
  - [AWS 배포에서 프로그램과 DB를 연결하는 순서](./study-docs/cloud-database-and-application-connection.md): Image·CloudShell·App·RDS의 역할, 여러 계정과 Secret 전달·TLS·Migration을 한 흐름으로 연결한다.
  - [AWS Network와 DNS 그리고 HTTPS 요청 흐름](./study-docs/aws-network-dns-and-https.md): VPC·Subnet·Route·Security Group, DNS·ACM·ALB와 TLS 종료, Session·CSRF의 역할을 나눈다.
  - [배포 장애 관찰과 복구](./study-docs/deployment-observability-and-recovery.md): ALB·App·Job의 실패를 Log·Metric에서 구분하고, Application Rollback과 별도 DB 복원·비용 관리를 이해한다.
  - [DB와 App 서버 복구](./study-docs/database-and-application-recovery.md): 같은 Image의 재시작·Image Rollback·Snapshot 복원을 예제로 비교하고 Session·Row·Migration·AI 재개와 정리 판단을 복습한다.
- `study-notes/`: 각 학습일의 핵심 질문과 오해를 수정한 내용을 1인칭으로 정리한다. 대화 전체를 옮긴 로그는 남기지 않는다.

  - [10월 8일 노트](./study-notes/2026-10-08-study-questions.md): 실행·저장·설정의 수명, Cache와 Secret 전달의 이해 변화와 핵심 질문
  - [10월 9일 노트](./study-notes/2026-10-09-study-questions.md): 설정·마스킹·종료·Health·CI와 AWS 권한, 오해 수정과 핵심 질문
  - [10월 10일 노트](./study-notes/2026-10-10-study-questions.md): ECR·Task·Role·Network·TLS와 Cookie, Health·HttpOnly의 오해 수정과 실제 Image 업로드
  - [10월 12일 노트](./study-notes/2026-10-12-study-questions.md): Provider 조립 실패와 AI 비활성 접수의 예측·검증, 비용 상한과 최소 지출 기준
  - [10월 13일 노트](./study-notes/2026-10-13-study-questions.md): IAM·Network·관리 통로, 생성 요청과 정책 조건, Console 오류 구분과 다음 학습
  - [10월 14일 노트](./study-notes/2026-10-14-study-questions.md): RDS·TLS·App DB 계정, ECS의 DB 인증 복구, 두 CNAME·ALB·HTTPS와 Health/업무 성공 구분
  - [10월 15일 노트](./study-notes/2026-10-15-study-questions.md): Session/CSRF·접수/SQL Row, SELECT/Commit·Redirect, 개인정보 품질·Log/Metric과 App/DB 복구, 16일 재개 기준
  - [10월 16일 노트](./study-notes/2026-10-16-study-questions.md): Snapshot 별도 복원·원본 복귀, A/P/B의 읽기 호환성과 실제 Image Rollback, 연장 구간의 psql·Process 메모리·Log 관찰
  - [10월 19일 노트](./study-notes/2026-10-19-study-questions.md): 메모리·HTTP/AI 시간·Log 식별자·Process 종료, 합성 전용 자동 Worker와 자원 검증, 20일 재개 기준
  - [10월 20일 노트](./study-notes/2026-10-20-study-questions.md): 정상 JSON과 실행 완료·실제 자원 회수의 차이, 통합 실패 검증과 다음 Cloud 단계
- `lab-reports/`: 실행 환경·명령·예상·결과·실패 원인과 재현 방법을 묶는다. 로컬·CI·Cloud 근거는 구분한다.
  - [실제 CI 실패·복구](./lab-reports/2026-10-09-process-health-and-ci-baseline.md): 최초 운영체제 의존 실패와 별도 Branch의 UI 오류·복구, main 검증
  - [AWS OIDC·ECR 초기 설정](./lab-reports/2026-10-10-aws-oidc-ecr-baseline.md): 초기 생성·정책 대조와 당시 미실행 상태, 후속 업로드 보고서 연결
  - [검증 Image의 실제 ECR 업로드](./lab-reports/2026-10-10-verified-image-ecr-publish.md): 일반 검증·수동 Publish 분리, 실제 OIDC 인증·Image 1건 업로드와 Commit·Tag·Digest 대조
  - [AI 비활성 접수와 Provider 조립](./lab-reports/2026-10-12-disabled-ai-receipt-and-wiring-tests.md): Focused Test 43개, 실제 PostgreSQL의 접수 `201`·`PENDING`·예약 0건과 실행 객체 부재
  - [배포용 사용자 구성과 접수](./lab-reports/2026-10-12-deployment-users-and-receipt-tests.md): Main 사용자 Bean과 설정·로그인·Session·Role·CSRF·실제 PostgreSQL, Focused Test 72개
  - [배포 Image와 ECS 명세 초안](./lab-reports/2026-10-12-deployment-image-and-ecs-draft.md): 새 로컬 Image·JAR 확인, AI 비활성 실행 명세와 JavaScript 전체 152개
  - [배포 Image의 실행 자원 측정](./lab-reports/2026-10-12-deployment-resource-probe.md): CPU·메모리 제한 아래 접수·로그인·조회와 Container 자원 관찰
  - [RDS 공개 CA와 Image 준비](./lab-reports/2026-10-12-rds-public-ca-and-image-preparation.md): 공개 Root CA 확인, 최종 Image 포함과 `verify-full` 연결 준비
  - [배포 준비 변경의 CI·ECR 업로드](./lab-reports/2026-10-13-deployment-image-ecr-publish.md): 두 저장소 Commit·Push, Java 578개·JavaScript 173개 CI 통과, 검증 Image 한 개 추가와 기존 Image 유지
  - [배포 신원과 정책](./lab-reports/2026-10-13-deployer-identity-and-policies.md): 사용자·MFA·최소 권한과 저장된 Foundation 정책 대조
  - [학습 Network와 Security Group](./lab-reports/2026-10-13-learning-network-and-security-groups.md): Public/Private 경로와 ALB→App→RDS 규칙 확인
  - [Private DB 관리 통로](./lab-reports/2026-10-13-private-db-bootstrap.md): 제한된 CloudShell VPC 환경·정책·psql 준비, 실제 DB 접속과 구분
  - [DB Subnet Group·Runtime 정책·RDS 생성 거부](./lab-reports/2026-10-14-rds-subnet-group-and-runtime-policy.md): 10/13 회차 연장 구간의 실제 실행일·확인 결과와 요청 조건 미확인
  - [ECS 첫 기동과 DB 암호 전달 수정](./lab-reports/2026-10-14-ecs-first-cloud-startup.md): 실제 Task의 검증 Digest·Log·DB 인증 실패와 같은 Image의 JDBC·Flyway·Spring 기동 성공
  - [ALB·App·DNS와 HTTPS 기본 응답](./lab-reports/2026-10-15-cloud-https-baseline.md): 10/14 회차의 연장 실습. 실제 10/15의 Edge V4·Target Healthy·브라우저 화면·익명 HTTP 결과
  - [HTTPS 로그인·CSRF 접수와 실제 DB Row](./lab-reports/2026-10-15-cloud-session-csrf-and-postgres.md): 작성자가 확인한 Cookie 속성·접수 403/201·Ticket 1/2의 원문/작성자 존재·PENDING/예약 0건과 SELECT/Commit
  - [ALB의 HTTP → HTTPS 301 Redirect](./lab-reports/2026-10-15-alb-http-https-redirect.md): 기존 443과 같은 학습자 Source의 80 허용·새 Redirect Listener·실제 301/Location과 HTTPS 기본 응답 유지
  - [개인정보 검사 실패의 저장과 조회](./lab-reports/2026-10-15-privacy-scan-failure-persistence.md): 로컬 V8·원문/예약 보존·현재 Attempt·실패 기록 Rollback·읽기 전용 조회와 Worker 확인. 실제 검사기·Cloud 조립과 구분
  - [PERSON 계약과 실제 한국어 NER 평가](./lab-reports/2026-10-15-korean-privacy-ner-probe.md): PERSON 치환·업무 사실 보존과 고정 합성 12건의 실제 CPU 평가. 이름 누락·일반 문구 오탐으로 후보 채택 보류, 배포용 Adapter와 구분
  - [실제 Cloud의 기동 Log와 HTTP 관측](./lab-reports/2026-10-15-cloud-observability-baseline.md): 현재 Task의 기동 Event·익명 응답, Edge V5의 최소 조회 적용 뒤 실제 ALB 그래프 확인
  - [같은 Image·RDS의 Task 교체 준비](./lab-reports/2026-10-16-cloud-task-replacement.md): Edge V6·V1 보관/삭제·V2~5 보존과 교체 전 기준. 실제 Draining·교체·재로그인은 NOT_RUN으로 16일 이월
  - [실제 Image Rollback](./lab-reports/2026-10-16-image-rollback-cloud.md): B의 V8 적용·합성 새 실패 코드, P 복귀 뒤 일곱 Table과 인증 조회 보존
  - [Private CloudShell psql 17](./lab-reports/2026-10-17-cloudshell-psql17.md): 공식 Client 분리·기존 16 보존, RDS 17.11 TLS·Schema/Hash 대조
  - [Process·cgroup·Log Pipeline](./lab-reports/2026-10-17-proc-cgroup-log-pipeline.md): 실제 로컬 JVM 수치와 Container 제한, 합성 시작 Marker/HTTP 응답
  - [합성 구성의 자동 Worker와 자원 측정](./lab-reports/2026-10-19-synthetic-runtime-resources.md): 새 Main JAR Image·통제된 Provider·실제 PostgreSQL의 독립 실행 두 번, 자원·원문/예약 보존과 남은 통합 실패 실험
  - [합성 App의 통합 실패와 자원 회수](./lab-reports/2026-10-20-synthetic-runtime-failure-cleanup.md): 정상·Timeout·비정상 종료의 전체 App 실행 세 건, 실패의 HTTP 0회·원문/예약 보존과 Process/Thread 회수
- `wil.md`: Week 8–9의 통합 결과와 이해 변화, 직접 판단한 부분과 AI 도움을 받은 부분을 한 회고에 정리한다. 미완료 결과를 먼저 완료로 작성하지 않는다.
- Lab Repository: Dockerfile·Compose·Workflow·배포 설정·관련 Test·실행/복구 안내를 관리한다. WIL과 구현 변경은 별도 Commit으로 나눈다.

## 완료 체크

각 핵심 주제는 설명·예측/실패 재현·Test/Trace 등 최소 세 가지를 충족하고, 그중 하나는 실제 실행 근거여야 한다. 부분 검증만 한 묶음은 완료로 체크하지 않는다.

- [x] Image·Container·Layer·Volume·Network를 설명하고 Layer 순서에 따른 Cache 비교와 Compose 재생성 후 DB 보존을 확인했다.
- [ ] 배포용 사용자·Provider·Worker·Secret 설정과 누락·기본 비활성 조건을 검증했다.
- [ ] Process·`/proc`·SIGTERM·강제 종료·Exit Code·Graceful Shutdown을 관찰하고 CLI Log Pipeline과 DB·Session·Job의 결과를 설명했다.
- [x] 실제 GitHub Actions의 Build·Test·정적 검사·Image Build와 Test 실패·복구를 확인했다.
- [x] 실제 OIDC 인증·ECR Image 업로드와 Commit·Tag·Digest 대응을 확인했다.
- [ ] IAM User·Role·Policy·최소 권한과 Network 접근 경계를 설명하고, 권한 거부·복구와 같은 Image의 ECS 실행을 확인했다.
- [x] 실제 RDS Migration·저장·조회와 Application 재배포 뒤 Row 보존을 확인했다.
- [ ] DNS·ACM·HTTPS·Redirect와 안전한 Cookie·Session·Role·CSRF를 실제 Browser에서 확인했다.
- [ ] 실제 Cloud의 접수·Worker·AI·제안 저장·AGENT 조회를 연결하고 원문·Ticket 상태를 유지했다.
- [ ] CloudWatch에서 대표 실패의 Log·Health·요청 수·오류·응답시간을 추적했다.
- [x] 이전 Image로 복귀하고 Backup 설정·별도 DB 복원 결과와 데이터 보존을 확인했다.
- [ ] 최종 회귀·공개 문서·Secret 노출 점검, 재현 절차와 비용·리소스 정리 기록이 있다.
- [ ] WIL을 작성자 표현으로 검토했다. 블로그 게시와 포럼 등록은 실제 확인 뒤 각각 완료 처리한다.

## 진도 점검과 기간 연장

초기 4일 계획의 첫 마감 목표는 10/12였으나 선택 범위를 유지하며 더 진행했다. 현재는 Week 8–9 통합 과정으로 관리하고, 매 학습 회차 종료 때 실제 완료·잔여량·다음 필요한 시간을 확인한다.

| 점검 시점 | 확인할 것 | 부족할 때 조정 |
|---|---|---|
| 10/8 회차 마감 | Compose 실행·영속성·설정 비교는 확인. 배포용 Provider·Secret과 Cloud 선행 조건은 미완료 | 10/9 첫 순서로 배치 완료. 그 뒤 Process·CI·Cloud도 선행 조건에 따라 이동하며 범위는 유지 |
| 10/9 회차 마감 | 설정·마스킹·Process·실제 CI 실패·복구, AWS OIDC·ECR 초기 설정 확인 | 실제 Image 전달·전체 AI 조립·DB·Job 종료 상태는 남음. 10/10은 OIDC 인증·ECR 전달부터 시작하고 뒤의 배포·복구 시간을 재산정 |
| 10/10 종료 | OIDC 인증·검증 Image의 ECR 1회 업로드·Digest 확인 완료. ECS·RDS·HTTPS는 미수행 | 10/11 야간 또는 10/12에 전체 조립·구성 승인부터 재개. 뒤의 복구·회귀·WIL은 없애지 않고 연장 대상으로 기록 |
| 10/12 종료 | 배포용 사용자·Image·자원·CA의 로컬 검증, Standard Parameter·Execution Role·365일 Log Group 구성 확인 | Cloud 실행·전체 AI 조립·HTTPS·복구는 남아 Week 8 연장. 범위는 유지하고 리소스 실행은 별도 승인 |
| 10/13 Image 전달 | 10/12 회차의 연장 구간에서 두 저장소 목적별 Commit·Push, 일반/수동 CI 통과와 검증 Image 한 개 추가. 이전 Image 유지 | 남은 학습은 10/13 재개. 구성·비용과 별도 실행 승인 뒤 AI 비활성 App·RDS·ALB 연결·HTTPS부터 확인하고 전체 AI·관측·복구 유지 |
| 10/13 회차 마감 | IAM·학습 Network·관리 통로·DB Subnet Group·Runtime V3 확인. RDS 생성 요청은 IAM 거부, 실제 불일치 조건은 미확인 | 10/14 요청·정책 대조부터 재개. Private TLS·DB 계정·AI 비활성 App 뒤 HTTPS·전체 AI·관측·복구·마감 유지 |
| 10/14 DB·ECS 연결 | RDS·TLS·App 계정 준비, Cluster·명세 등록. 첫 DB 인증 실패 뒤 지정 암호 Parameter 수정으로 같은 Image의 JDBC·Migration 7개·Spring 기동 성공. Task 중지 | 다음은 HTTPS·Health·Session·Role·CSRF·접수/조회·업무 Row. 전체 AI·관측·재배포·DB 복원과 마감 범위 유지 |
| 10/14 회차 마감 | 연장 실습에서 ACM·두 CNAME·ALB·새 App Task를 연결. Target Healthy·Health 200/UP·로그인 페이지 200·익명 API 401 확인 | 10/15 실제 로그인·보안 계약·접수/SQL Row부터 재개. 마지막 확인 시 실행 리소스가 남아 있으므로 비용과 중지·정리 범위를 먼저 확인 |
| 10/15 회차 마감 | HTTPS 접수·SQL Row·HTTP 301·Cloud 관측 확인. 개인정보 후보 채택 보류, Edge V6의 교체 권한 준비 완료 | 10/16 새 AGENT 기준 조회·승인한 Task 교체부터. 이전 Image 복귀·별도 복원·전체 AI·남은 관측/DNS·최종 회귀와 WIL 유지 |
| 10/16 회차와 연장 실습 마감 | Snapshot 복원·원본 복귀·B→P/V8·업무 Hash/코드 보존, psql 17·Process 수치 확인 | 17/18 휴무 뒤 19일 재개. 설명 미검증·실제 개인정보 처리/전체 AI·남은 관측/DNS·마감은 통합 과정의 잔여로 유지 |
| 10/19 회차 마감 | 메모리·HTTP/AI·Log 문답, 로컬 종료·Linux 검증과 합성 전용 Image의 자동 Worker·자원 두 번 확인. 실제 모델/Cloud 전체 AI 완료와 구분 | 사용자 요청으로 20일 재개. 첫 과업은 통합 고의 실패·자원/DB 확인이며 새 코드 Cloud·실제 비용/보관량·합성 AI·DNS·마감 유지. V2·모델 고도화는 후속 |

연장은 이미 허용한 진행 방식이므로, 시간이 부족하다는 이유로 다시 학습 범위를 줄이는 안을 만들지 않는다. 다만 추가 날짜를 임의로 확정하지는 않는다. 필요해진 학습·구현·검증 시간과 Cloud 대기를 구분해 제시하고, 실제 사용할 수 있는 날짜에 남은 순서를 배치한다. 하루 10시간을 넘겨야만 계획을 지킨 것으로 평가하지 않는다.

10/11 일요일 낮에는 과업을 배정하지 않고, 야간은 작성자가 선택한 재개 후보로만 둔다. 야간에 진행하지 않으면 10/12부터 같은 순서를 이어간다. 도메인·계정·권한·비용 승인이 늦어지면 로컬 실험과 CI 학습을 먼저 하되 이를 Cloud 배포 완료로 대체하지 않는다. 설정 작업이 오래 걸려도 개념 설명·실패 실험·Backup 복원·복습을 생략하지 않는다.

통합 과정은 `In Progress`로 유지하고 미수행은 `NOT_RUN`, 일부만 확인한 항목은 부분 완료로 구분한다. Week 8–9라는 이름은 실제 기간을 반영한 것이며 완료 기준을 바꾼 것이 아니다. Week 10에는 초기 Week 9의 취업 Baseline과 맞춤 지원을 합치고 Week 11·12 및 전체 12주 틀을 자동 연장하지 않는다. 취업 기간의 잔여 수직 학습·Project 보완·마감 후 확장은 합쳐 주 6시간 이내다. 수직 Gate를 통과하기 전에는 새 수평 기능을 시작하지 않는다.

## 계획 변경 기록

| 날짜 | 변경 전 | 변경 후 | 이유와 영향 |
|---|---|---|---|
| 2026-10-07 | Week 7의 10/7 마감 후 Week 8 세부 일정 미정 | 10/8~10/12 중 10/11 제외, 4일·순학습 40시간 기준 | 사용자 기간 지정. 기존 DevOps·System·Cloud·HTTPS 범위 유지, 첫 Cloud 연결은 10/10 목표, 10/12 복구·최종 검증·WIL 마감 |
| 2026-10-07 | 기간을 미리 늘리는 대안과 4일 집중안 검토 | 우선 4일에 전체 내용을 배치하고, 부족하면 같은 Week 8 기간을 연장 | 사용자가 4일 우선 진행·필요 시 연장·내용 유지 요청. 세부 키워드·실험·복습 질문을 추가하고 일일 점검·연장 기준 명시 |
| 2026-10-09 | 10/8에 배포용 조립·Cloud 준비까지 마치고 10/9부터 Process·CI 진행 | 10/8 회차의 로컬 근거·노트 정리, 미완료 Provider·Secret·Cloud 조건을 10/9 앞부분으로 이동 | 사용자 회차 마감·계획 갱신 요청. 10/10은 잔여 CI·IAM·ECR부터, 10/12는 잔여 배포부터 진행. 10/11 제외와 전 학습 범위 유지, 복구·회귀·WIL 미완료 시 Week 8 연장 |
| 2026-10-09 | 개인정보 처리기 연결을 마친 뒤 Process·관측·CI 진행 | 배포를 우선해 독립적으로 검증 가능한 Process·관측·CI를 병행, 질문 2~3개 묶음 | 사용자 배포 중심 지도 요청. Main Health·Metric·종료 설정, 로컬 회귀·종료 비교와 Workflow 작성. 전체 AI 연결·Cloud·복구 학습 범위는 유지 |
| 2026-10-09 | Region·예산·실행 기간 미확정 | 서울·월 3만 원·최대 12개월 보관·실습 시 실행 조건으로 비용 초안 작성 | 사용자가 실행 조건 확인. 상시 가동 대신 실행과 보관 비용을 나누며 생성·DNS 변경·리소스 삭제 승인은 별도로 확인 |
| 2026-10-09 | DNS 서비스·학습 주소 미확정, 실제 배포도 Route 53을 사용한다는 초안 | `helpdesk.hmyoon.com`·기존 Cloudflare DNS 유지 후보, Route 53 비교·별도 조회 실습 유지 | 사용자 DNS 정보 확인. 메인 도메인 이전 없이 DNS·ACM·ALB 학습, Proxy 기능은 첫 배포 경로에 추가하지 않음. Record 변경·Zone 생성은 별도 승인 |
| 2026-10-10 | 실제 Actions·IAM·ECR 모두 미수행으로 표시 | 10/9 회차의 CI 정상·실패·복구와 실제 10/10 OIDC·ECR·업로드 Role 생성 반영. 다음은 STS 인증·Image 전달부터 | 사용자 회차 기록·문서·Commit 요청. 초기 생성 승인과 나머지 배포 승인을 구분하며, 개인정보 실행용 연결·종료 중 DB·Job·Cloud·HTTPS·복구 범위 유지 |
| 2026-10-10 | 10/10 첫 HTTPS 연결 목표, 10/11 전체 제외·10/12 복구·마감 배정 | 실제 OIDC·ECR 업로드와 개념 학습을 정리하고 마감. 잔여 과업은 10/11 야간 또는 10/12부터 순서대로 진행 | 사용자 종료·재개 요청. 일요일 낮 제외·야간 선택적 재개로 변경. 전 학습 범위 유지, 월요일 안에 미완료면 Week 8 기간 연장. 나머지 Cloud 생성·DNS 변경은 별도 승인 |
| 2026-10-12 | 월 3만 원 이내의 초기 비용 예시, 상한과 지출 목표의 차이가 불명확할 수 있음 | 월 3만 원은 최대 금액으로 명시하고, 목적을 충족하는 최소 크기·수량·실행·보관 비용으로 선택 | 사용자 비용 조건 명확화. 기존 사용량 가정은 권장 지출액이 아님. 학습·보안·영속성·복원 검증은 유지하며, 리소스 생성·삭제·DNS 변경 승인은 확대하지 않음 |
| 2026-10-12 | Secret 저장소·권한 미정, 초기 Secrets Manager·큰 App 비용 가정 | Standard SecureString 6개·기본 처리량·`aws/ssm`, 지정 Parameter 읽기 권한 초안. AI 비활성 첫 최소 사양으로 비용 갱신 | 사용자 권장안 승인. 실제 값 등록·Role 연결·Cloud 실행은 구분하고 보안·영속성·전체 AI 검증을 생략하지 않음 |
| 2026-10-12 | 중지·장기 보관의 대안만 제시 | 장기 휴지기는 최종 Snapshot·별도 복원 검증 뒤 승인한 ALB·DB Instance 정리와 필요한 산출물 보관, 새 Endpoint·DNS·Task로 재개 | 사용자 최소 비용 구성 요청. 실행·보관 비용을 줄이되 자동 삭제·범위 확대·학습 생략은 하지 않음 |
| 2026-10-12 | CloudWatch Log 7일 보존 후보, 실제 Group 미생성 | 서울 `/ecs/helpdesk-learning` 하나를 Standard 클래스·365일 보존으로 생성하고 목록 확인 | 사용자 1년 보존 요청·생성 승인. 월 비용 상한은 유지하고 누적 저장량을 검토하며, 실제 Task 출력 전달은 후속 검증 |
| 2026-10-13 | 배포 준비 변경 미Push, ECR에 이전 Image 한 개 | 목적별 Commit·Push와 CI 후 검증 Image 한 개 추가. 기존 Image 유지, 실제 Cloud 실행은 별도 승인 | 사용자 범위 지정. CI Java 578개·JavaScript 173개와 ECR Digest·두 Image 보관 확인. 남은 전체 학습 범위와 최소 비용 원칙 유지 |
| 2026-10-13 | 재개 날짜가 10/11 야간 또는 10/12로 남아 있고 새 Image 전달이 일부 미래 과업으로 표시 | 10/12 회차를 마감해 노트에 반영, 잔여 과업은 10/13 재개. AI 비활성 첫 Cloud·HTTPS 뒤 전체 AI·관측·복구 순서로 명시 | 사용자의 기록·재개 요청. 실제 CI·업로드일은 10/13 유지. 모든 선택 학습 유지, 실행 리소스·유료 AI·DNS 변경·삭제 승인은 별도 확인 |
| 2026-10-14 | 10/13 첫 Cloud·HTTPS 연결을 목표로 진행 | 10/13 회차의 IAM·Network·관리 통로·Subnet Group과 RDS 생성 거부를 기록하고, 잔여 과업은 10/14 요청·정책 대조부터 재개 | 사용자의 마감·기록·Commit 요청. 자정 이후 실제 실행일은 보고서에 유지. 불일치 조건을 추측하거나 권한을 넓히지 않고 전체 학습 범위 유지 |
| 2026-10-15 | RDS·ECS 첫 기동 확인, HTTPS 연결과 업무 요청 미완료 | 10/14 회차의 ACM·DNS·ALB/App·HTTPS 기본 응답까지 기록하고 실제 로그인·업무 Row 등 잔여 과업을 10/15로 이월 | 사용자 회차 마감·기록·Commit 요청. 실제 실행일은 보고서에 유지. 전 학습 범위·최소 비용·승인 경계를 유지하고 Week 8은 In Progress |
| 2026-10-16 | 10/15에 업무 접수·Cloud 관측·전체 AI·복구를 이어가던 상태 | 10/15 노트를 작성하고 실제 교체 전 중단 지점을 기록. 미실행 Task 교체·재로그인과 나머지 전체 범위를 10/16으로 이동 | 사용자 기록·재개 요청. 정책 V6 적용·V1 보관/삭제는 완료, V2~5 유지. Task·DB·DNS·Secret은 변경하지 않고 당일 문서 작업만 진행. 학습량과 최소 비용 원칙 유지 |
| 2026-10-17 | DB 복원 뒤 A→P→B 전환, 관리 Client 16·서버 17의 차이 | P Image 복귀·V8/데이터 보존 확인, 공식 psql 17 분리·실제 TLS 접속과 로컬 Process/Log 관찰 | 사용자 Client만 교체·목적별 Commit·학습 계속 요청. RDS/IAM/Network는 그대로 두며 전체 AI·남은 관측·Route 53·마감 범위 유지. 추가 Push·Cloud 활성화는 하지 않음 |
| 2026-10-17 | Week 8만 연장, 17일 별도 노트와 학습일 표시 | Week 8–9·`week8-9`로 통합, 16일 연장 회차에 노트 통합·실제 실행일 보존. 17/18 휴무·19일 재개 | 사용자 기간·폴더·계획 조정 요청. 전 학습 범위와 미완료 상태 유지, Week 10 취업 Baseline 합류·Week 11/12 유지. 경로 이동·상위 계획·재개 순서를 목적별 수정/Commit |
| 2026-10-19 | V2 인물 관계·개인정보 모델 고도화가 전체 AI 배포의 선행 작업으로 확대됨 | V2·모델 고도화는 후속으로 보존하고 Linux 실행/회수·최소 조립·자원·관측/비용·합성 전용 AI 배포로 복귀 | 사용자 분리·계획 수정 승인. 기존 V1 검증/Guard·실패 시 전송 중단·원문/예약/실행권 보존, 일반 입력 비활성과 별도 비용·AWS 승인 유지 |
| 2026-10-19 | 19일 재개 순서에 로컬 합성 자동 실행·자원과 남은 Cloud 과업이 함께 배정됨 | 자동 실행·자원 두 번과 마지막 개념 문답을 기록하고, 미완료 과업은 20일 통합 고의 실패 실험부터 재개 | 사용자 회차 마감·노트/계획 갱신 요청. 학습 범위와 취업 우선·주 6시간 상한 유지. 새 Push·CI/ECR·AWS·실제 AI를 완료 처리하지 않음 |
| 2026-10-20 | 통합 고의 실패·자원 검증이 첫 잔여 과업 | 같은 Main Image의 정상·Timeout·비정상 종료 검증 세 건 통과. 다음은 현재 Cloud 상태·비용과 새 코드 관측 준비 | 사용자 학습 재개 요청. Test 도구만 변경하고 운영 코드·AWS는 유지. V2·모델 고도화는 후속, 실제 AI·원격 CI/ECR·Cloud 마감은 미완료 |

## 관련 기준

- [12주 학습 계획](../plan/advanced-track-12-week-plan.md)
- [주차별 Roadmap](../plan/weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](../plan/learning-and-content-plan.md)
- [깊은 수직 학습 범위 결정](../plan/decisions/0002-depth-first-ai-assisted-expansion.md)
- [8–9주차 통합과 취업 일정 조정](../plan/decisions/0004-combined-week8-9-deployment-learning.md)
- [배포 검증과 개인정보 후속 고도화 분리](../plan/decisions/0009-deployment-first-and-deferred-privacy-enhancement.md)
- [Week 7 완료 결과](../week7/wil.md)
- [10월 14일 RDS 조회 권한과 생성 요청 진단](./lab-reports/2026-10-14-rds-console-permission-diagnostics.md)
