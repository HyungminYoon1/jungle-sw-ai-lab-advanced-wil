# 심화과정 계획 문서

이 디렉터리는 전체 12주의 학습 목표, 순서, 학습 증거와 변경 이력을 관리한다. 현재는 기술 학습 Week 1–9와 취업 우선 Week 10–12로 배치하며, 지연된 배포 과정은 Week 8–9로 통합한다.

## 현재 기준 문서

문서 사이의 내용이 다르면 다음 순서로 판단한다.

1. [심화과정 12주 학습 계획](./advanced-track-12-week-plan.md): 목표, 범위, 우선순위와 성공 기준
2. [12주 주차별 Roadmap](./weekly-roadmap.md): 주차별 핵심 질문, 실험과 완료 근거
3. [학습 및 기술 콘텐츠 계획](./learning-and-content-plan.md): 학습 방법, AI 활용, WIL과 공개 증거
4. 각 `weekN`의 Weekly Plan: 해당 주에 확정한 일정과 변경 기록

공지 Source와 실제 학습 근거의 상세 대조표는 Git에서 제외되는 로컬 검토 자료로 관리한다. 공개 계획에는 승인된 범위 결정과 필요한 요약만 남기며, `Planned`는 완료 근거로 계산하지 않는다.

## 현재 학습 일정

[Week 8–9 통합 학습 계획](../week8-9/weekly-plan.md)은 Docker·CI·System·AWS·HTTPS·AI 연결·관측·복구의 기존 범위를 유지한다. 초기 4일·40시간 배분을 넘겨 사용한 기간을 통합 명칭에 반영했으며, 미완료 과업을 완료 처리한 것은 아니다.

16일 회차는 실제 17일에 이어진 Image 복귀·psql 17·Process 관찰까지 [16일 노트](../week8-9/study-notes/2026-10-16-study-questions.md)에 합쳤다. 실제 실행 보고서는 해당 날짜를 유지한다. 당시 HTTPS 접수/SQL Row·Snapshot 별도 복원·원본 복귀·B→P와 V8/데이터 보존을 확인했으며, 이후 AI·관측·DNS 결과와 현재 잔여 과업은 아래 최신 회차를 따른다.

10/17·10/18 휴무 뒤 19일에는 메모리·HTTP/AI 지표·Log·Process 종료를 학습하고, 로컬 합성 Image의 자동 Worker·자원 실험 두 번을 확인했다. 이해 변화와 마감 기준은 [19일 노트](../week8-9/study-notes/2026-10-19-study-questions.md)에 기록했다. 실제 개인정보 모델·Cloud 실제 AI의 완료 근거와는 구분하며 V2·모델 고도화는 후속으로 둔다.

20일에는 통합 실패·자원/DB 보존과 CI·ECR·Task 전달을 확인했다. 자정 이후 실제 Cloud 합성 AI 처리·제안 저장과 비활성 복귀도 마쳤다. [20일 노트](../week8-9/study-notes/2026-10-20-study-questions.md)에 시작 회차와 실제 실행일을 구분했다.

10/21의 성공/실패 Job 관측·Route 53 조회 비교·최신 Snapshot의 일곱 Table 복원은 [21일 노트](../week8-9/study-notes/2026-10-21-study-questions.md)에 기록했다. 임시 DB 삭제·당시 원본과 두 Snapshot 보존 확인은 실제 10/22에 완료했다. 그 뒤 장기 휴지기 정리 결과는 아래 최신 상태를 따른다.

**10/22에는 최종 복습·로컬 회귀와 실제 리소스 정리를 마쳤다.** [22일 노트](../week8-9/study-notes/2026-10-22-study-questions.md)에 독립 답변 6개·기존 직접 설정 수정 근거, Java 1,014개+패키징 후 2개·JavaScript 295개·Lint와 후속 정책 55개/전체 JavaScript 303개 결과를 각각의 검사 시점으로 기록했다. Test JVM 종료 대기는 후속 점검이며 Cloud App 문제로 단정하지 않는다.

별도 최종 승인 뒤 원본 DB·ALB/리스너·실습 Zone/두 Record·서비스 CNAME을 삭제했다. [정리 보고서](../week8-9/lab-reports/2026-10-22-deployment-resource-closeout.md)의 두 수동 Snapshot은 개별 상세에서 Available, App Task·Service는 0개다. Secret·Log·Image·ACM/검증 CNAME·Target Group·네트워크는 보존했다. 다음 구현은 로컬에서 진행하고 필요 시 Snapshot에서 새 DB를 복원해 재배포한다. 실제 월간 비용은 미확인이고 보관 비용은 남을 수 있다.

이후 두 저장소 Push와 Lab 원격 CI, 공개 자료 및 저장소 WIL 최종 검토와 Push를 마쳤다. 블로그 작성과 포럼 업로드도 10/23 작성자 확인으로 완료 처리했다. 정리 권한 회수와 보관 비용 확인은 후속 점검이며 이번 문서 갱신으로 Push, 새 Cloud 실행이나 IAM 변경을 하지 않는다.

Week 10에는 기존 Week 9의 취업 Baseline과 맞춤 지원을 함께 진행하며 Week 11·12는 뒤로 밀지 않는다. 취업 기간의 잔여 수직 학습·Project 보완·마감 후 수평 확장은 합쳐 주 6시간 이내다. [일정 통합 결정](./decisions/0004-combined-week8-9-deployment-learning.md)을 따르며 인물 관계 V2·개인정보 모델 고도화는 이번 마감 선행 조건으로 되돌리지 않는다.

10/23에는 [공식 답변과 대화 조회 설계](../week10/official-reply-conversation-design-draft.md)의 P1~P8을 합의하고 별도 구현 요청으로 기술 계약과 V9, 고정 ID 연결, 답변·정정 API 및 대화 화면을 추가했다. 로컬 PostgreSQL과 Browser 결과는 [실행 보고서](../week10/lab-reports/2026-10-23-official-reply-conversation-lab.md)에 기록한다. [Week 10 계획](../week10/weekly-plan.md)의 24, 26일은 이미 수행한 구현을 반복하지 않고 작성자 복습과 잔여 검토에 배정한다. 10–12주차는 주간 기록을 유지하고 블로그만 한 편으로 묶는 [기록 주기 결정](./decisions/0011-combined-week10-12-blog.md)을 따른다. 이번 구현 변경의 Push·CI·Cloud 배포는 하지 않았다.

### 초기 계획과 실행 근거

[10월 8일 학습 노트](../week8-9/study-notes/2026-10-08-study-questions.md)에 Docker의 실행·저장·설정 수명과 이해 변화를 정리했다. Build Cache와 [Compose의 실제 HTTP·PostgreSQL 실험](../week8-9/lab-reports/2026-10-08-compose-http-postgresql-baseline.md)에서는 DB 교체 후 Row·App Session 유지, App 재시작 뒤 Row 보존·재로그인, 같은 Image의 설정 변경을 확인했다. 필수 값 누락·빈 문자열 검사와 기존 Worker 설정 Test도 확인했다.

10/9의 설정·마스킹·Process·실제 CI 실패·복구에 이어 10/10에는 OIDC 인증과 검증한 Image의 ECR 1회 업로드·Digest 확인을 마쳤다. 개념과 오해 수정은 [10월 10일 노트](../week8-9/study-notes/2026-10-10-study-questions.md), 실행 근거는 [ECR 업로드 보고서](../week8-9/lab-reports/2026-10-10-verified-image-ecr-publish.md)에 정리했다. 당시에는 Cloud 실행을 시작하기 전이었으며, 이후 배포용 설정과 Cloud 구성을 연결했다.

10/12에는 배포 사용자·AI 비활성 접수·자원·공개 CA를 확인하고 Standard Parameter 여섯 개·Execution Role·365일 Log Group을 준비했다. 연장 구간의 실제 10/13에는 Java 578개·JavaScript 173개·ESLint·Image Build의 로컬/CI 검증과 새 ECR Image 추가를 확인했다. [10월 12일 노트](../week8-9/study-notes/2026-10-12-study-questions.md)와 [10월 13일 실행 보고서](../week8-9/lab-reports/2026-10-13-deployment-image-ecr-publish.md)에 회차와 실행일을 나누었다. 이후 별도 실행 승인으로 AI 비활성 첫 Cloud·HTTPS 연결을 진행했다.

10/14 회차에서는 비Root RDS 생성·Private verify-full·App DB 권한과 Migration 7개, DB 인증 실패의 설정 복구를 확인했다. 자정 이후 같은 회차에서 ACM·Cloudflare 검증/서비스 CNAME·ALB와 새 App Task를 연결해 HTTPS Health 200/UP·로그인 페이지 200·익명 API 401을 확인했다. [10월 14일 노트](../week8-9/study-notes/2026-10-14-study-questions.md)에 개념을, [실제 10월 15일 보고서](../week8-9/lab-reports/2026-10-15-cloud-https-baseline.md)에 실행일과 확인 수단을 기록했다. 당시 남았던 로그인·업무 Row·복원은 후속 회차에서 검증했으며, 현재 잔여 과업은 위 통합 계획을 기준으로 확인한다.

## 범위 결정

- [학습 우선 범위 전환 Decision](./decisions/0001-learning-first-scope.md)
- [깊은 수직 학습과 AI 보조 수평 확장 Decision](./decisions/0002-depth-first-ai-assisted-expansion.md)
- [8–9주차 통합과 취업 일정 조정](./decisions/0004-combined-week8-9-deployment-learning.md)
- [배포 검증과 개인정보 고도화 분리](./decisions/0009-deployment-first-and-deferred-privacy-enhancement.md)
- [고정 합성 입력의 최소 배포 구성](./decisions/0010-fixed-synthetic-deployment-configuration.md)
- [10–12주차 통합 블로그와 주간 기록 유지](./decisions/0011-combined-week10-12-blog.md)
- [AgentOps Lab 보류 안내](./agentops-lab-12-week-plan.md)

AI Helpdesk Learning Lab은 공지 학습 주제를 관찰하는 공통 실습 대상이다. 수직 학습에서는 기능 수보다 Browser·Security·Application·PostgreSQL·AI·배포의 실제 연결을 우선한다. 독립 실험은 PostgreSQL 영속성·API 흐름·배포를 대체하지 않는다. 수직 마감 전에는 수평 확장을 시작하지 않고, Week 10–12에는 취업 활동을 우선하면서 필요한 AI 보조 확장만 수행한다.

## Archive

`archive`에는 대체된 계획을 보존한다. Archive 문서는 당시 판단과 변경 이력을 확인하기 위한 자료이며 현재 일정이나 완료 기준으로 사용하지 않는다.

- [2026-07-29 초기 심화과정 계획](./archive/2026-07-29-initial-advanced-track-plan.md)
- [2026-08-18 AgentOps Lab 12주 계획](./archive/2026-08-18-agentops-lab-12-week-plan.md)
- [2026-08-18 AgentOps Lab 주차별 Roadmap](./archive/2026-08-18-agentops-lab-weekly-roadmap.md)
- [2026-08-18 AgentOps Lab 학습·콘텐츠 계획](./archive/2026-08-18-agentops-lab-learning-and-content-plan.md)

## 파일명과 변경 규칙

- 영문 소문자와 숫자를 사용하고 단어는 하이픈으로 구분한다.
- 현재 적용되는 문서는 `plan` 바로 아래에 둔다.
- 중요한 범위·정책 변경은 `decisions`에 Context, 선택지, 결정, 이유와 재검토 조건을 기록한다.
- 대체된 문서는 작성일을 붙여 `archive`로 이동한다.
- Baseline을 조용히 덮어쓰지 않고 변경 이유와 영향 범위를 남긴다.
- Archive 이외의 상대 링크는 실제 현재 문서를 가리켜야 한다.
