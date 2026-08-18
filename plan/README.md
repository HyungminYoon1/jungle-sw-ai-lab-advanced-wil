# AgentOps Lab 계획 문서

이 디렉터리는 AgentOps Lab의 12주 총괄 계획, 주차별 Roadmap, 학습·기술 콘텐츠 운영과 이전 계획의 변경 이력을 관리한다. 제품 요구사항과 시스템 설계는 별도 AgentOps Lab 제품 저장소가 관리한다.

## 문서 기준

- [현재 공식 총괄 계획](./agentops-lab-12-week-plan.md): 12주 목표, Release 순서, Gate, 범위 조정과 성공 기준
- [12주 주차별 Roadmap](./weekly-roadmap.md): 매주 학습·구현·검증할 Vertical Slice, 산출물과 완료 조건
- [학습 및 기술 콘텐츠 계획](./learning-and-content-plan.md): 학습 방식, AI 활용, WIL·기술 블로그, 측정과 공개 근거 원칙
- [초기 심화과정 학습 계획](./archive/2026-07-29-initial-advanced-track-plan.md): 최초 계획과 이후 변경 내용을 비교하기 위한 이력 보존 문서

Release 순서와 Gate가 다르면 현재 공식 총괄 계획을 기준으로 하고, 주차별 세부 실행은 Roadmap을 따른다. 학습·공개 기록 방식은 학습 및 기술 콘텐츠 계획을 따른다. `archive` 아래의 문서는 참고 자료이며 현재 계획의 근거 문서로 직접 사용하지 않는다.

## 제품 저장소와의 경계

제품 저장소는 `Requirements`, `Architecture`, `Workflow Planning and Review`, `Security and Governance`, `Evaluation and Operations` 문서를 기준으로 제품 범위와 시스템 설계를 관리한다.

두 저장소는 독립적으로 Clone·이동·공개될 수 있으므로 서로의 로컬 절대 경로나 상대 파일 경로를 참조하지 않는다. 교차 저장소 문서는 저장소 이름과 문서 제목으로만 식별한다. 이 디렉터리 안의 문서끼리는 상대 링크를 사용한다.

## 파일명 규칙

- 영문 소문자와 숫자를 사용하고 단어는 하이픈(`-`)으로 구분한다.
- 현재 적용되는 문서는 `plan` 바로 아래에 둔다.
- 대체된 문서는 `archive`로 이동하고 파일명 앞에 작성일(`YYYY-MM-DD`)을 붙인다.
- 문서를 이동하거나 이름을 바꾸면 해당 문서를 참조하는 상대 경로 링크도 함께 수정한다.
