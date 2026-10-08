# 심화과정 계획 문서

이 디렉터리는 기술 심화 8주와 취업 심화 4주의 학습 목표, 주차별 순서, 학습 증거와 변경 이력을 관리한다.

## 현재 기준 문서

문서 사이의 내용이 다르면 다음 순서로 판단한다.

1. [심화과정 12주 학습 계획](./advanced-track-12-week-plan.md): 목표, 범위, 우선순위와 성공 기준
2. [12주 주차별 Roadmap](./weekly-roadmap.md): 주차별 핵심 질문, 실험과 완료 근거
3. [학습 및 기술 콘텐츠 계획](./learning-and-content-plan.md): 학습 방법, AI 활용, WIL과 공개 증거
4. 각 `weekN`의 Weekly Plan: 해당 주에 확정한 일정과 변경 기록

공지 Source와 실제 학습 근거의 상세 대조표는 Git에서 제외되는 로컬 검토 자료로 관리한다. 공개 계획에는 승인된 범위 결정과 필요한 요약만 남기며, `Planned`는 완료 근거로 계산하지 않는다.

## 현재 학습 일정

[Week 8 학습 계획](../week8/weekly-plan.md)은 2026-10-08~2026-10-12 중 일요일 10/11을 제외한 4일에 우선 집중한다. Docker·CI·System·AWS Cloud·HTTPS·복구 전 범위의 초기 배분은 순학습 40시간이며, 시간이 부족하면 내용을 줄이지 않고 같은 Week 8 기간을 연장한다.

[10월 8일 학습 노트](../week8/study-notes/2026-10-08-study-questions.md)에 Docker의 실행·저장·설정 수명과 이해 변화를 정리했다. Build Cache와 [Compose의 실제 HTTP·PostgreSQL 실험](../week8/lab-reports/2026-10-08-compose-http-postgresql-baseline.md)에서는 DB 교체 후 Row·App Session 유지, App 재시작 뒤 Row 보존·재로그인, 같은 Image의 설정 변경을 확인했다. 필수 값 누락·빈 문자열 검사와 기존 Worker 설정 Test도 확인했다. 다음 학습은 미완료 배포용 Provider·Secret 연결과 Cloud 조건 확인부터 시작한다. 이어 Process·CI·IAM·ECR·Cloud를 진행하며, 선행 작업이 지연되면 뒤의 날짜를 옮기되 HTTPS·복구·회귀·WIL 범위는 유지한다.

## 범위 결정

- [학습 우선 범위 전환 Decision](./decisions/0001-learning-first-scope.md)
- [깊은 수직 학습과 AI 보조 수평 확장 Decision](./decisions/0002-depth-first-ai-assisted-expansion.md)
- [AgentOps Lab 보류 안내](./agentops-lab-12-week-plan.md)

AI Helpdesk Learning Lab은 공지 학습 주제를 관찰하는 공통 실습 대상이다. Week 1~8에는 수평 기능 수보다 Browser·Security·Application·PostgreSQL·AI·배포를 잇는 수직 깊이를 우선한다. 독립 실험은 원리를 분리해 확인하기 위한 근거이며 PostgreSQL 영속성·API 흐름·배포 같은 선택 수직 연결을 대체하지 않는다. Week 9~12에는 취업 활동을 우선하면서 AI 보조 수평 확장을 별도 모드로 수행한다.

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
