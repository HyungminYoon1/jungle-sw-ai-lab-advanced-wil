# Week 1 — 제품 계약, Framework 결정과 Walking Skeleton

> 기간: 2026-08-18 ~ 2026-08-22  
> 상태: Planned  
> 대상 Release: R1 Production Pilot  
> Product Gate: Week 1 Baseline Gate

이 주차는 기능 수를 늘리기보다 AgentOps Lab의 제품 경계, 개발 환경과 기술 선택의 불확실성을 줄이고 가장 작은 실제 실행 흐름을 만드는 기간이다. 실제 PostgreSQL에 Work Item을 저장·조회하고 실제 LLM의 성공·실패 상태를 보존하며 대표 Workflow를 시각적으로 확인할 수 있는 Walking Skeleton을 목표로 한다.

세부 학습·구현 순서와 변경 기준은 [주간 학습 및 구현 계획](./weekly-plan.md)에서 관리한다.

## 핵심 질문

> Agent Framework를 업무 상태의 기준으로 만들지 않으면서 Browser·Spring·PostgreSQL·실제 LLM을 하나의 설명 가능한 흐름으로 연결할 수 있는가?

## 현재 상태

| 영역 | 목표 | 현재 결과 | 상태 | 근거 |
|---|---|---|---|---|
| 제품 | Work Item 저장·조회와 최소 LLM·Workflow 흐름 | 구현 시작 전 | Planned | [주간 계획](./weekly-plan.md) |
| 학습 | Java·Spring·HTTP·PostgreSQL·LLM·DAG 핵심 개념을 제품에 적용 | 학습 시작 전 | Planned | [주간 계획](./weekly-plan.md) |
| Test·운영 | Build·Migration·CI 재현과 실패·Timeout 검증 | 구성 시작 전 | Planned | [주간 계획](./weekly-plan.md) |
| 기술 콘텐츠 | Week 1 WIL, Learning Note와 Framework 선택 글의 근거 축적 | 자료 수집 전 | Planned | [주간 계획](./weekly-plan.md) |

## 공개 산출물

### 현재 문서

- [주간 학습 및 구현 계획](./weekly-plan.md)

### 실제 근거가 생길 때 추가할 문서

- `implementation-report.md`: 구현 범위와 Test 결과
- `learning-*.md`: 핵심 개념과 제품 적용 과정
- `decisions/ADR-*.md`: Framework와 주요 기술 선택
- `experiments/EXP-*.md`: 비교·실패·성능 실험
- `wil.md`: 주간 결과와 회고
- `public-release-checklist.md`: 공개 전 보안·품질 확인
- `blog/*.md`: 검증 근거가 준비된 기술 글 초안

빈 문서와 근거 없는 Placeholder는 만들지 않고 실제 활동이 시작될 때 Template을 사용한다.

## Week 1 Baseline Gate

| 완료 조건 | 현재 상태 | 판단 근거 |
|---|---|---|
| 새 환경에서 Work Item을 PostgreSQL에 저장하고 다시 조회할 수 있다. | Pending | 주차 종료 시 구현 Report에서 판정 |
| 실제 LLM 실패와 Timeout이 성공으로 기록되지 않는다. | Pending | Adapter·Integration Test로 판정 |
| 대표 Workflow의 Node, Edge, 담당자, Tool과 승인 지점을 구분할 수 있다. | Pending | Graph·목록·상세 UI Spike로 판정 |
| 구현 담당자가 Layer 책임과 Framework 선택 이유를 설명할 수 있다. | Pending | Learning Note·Decision Log와 Review로 판정 |

완료 조건을 통과하지 못하면 `Completed`로 표시하지 않고 원인, 영향과 다음 주 우선순위를 기록한다.

## 계획 단계의 비범위

- 완전한 로그인·인가와 Organization 운영 화면
- Workflow Plan Revision·Diff·Approval과 업무 Agent 실행
- 실제 Connector Side Effect와 Action Approval
- 자유로운 Drag-and-drop 편집과 실시간 협업
- 다중 Model Provider, Production 배포와 고가용성

이 항목은 제품 목표에서 제거하지 않으며 예정된 주차와 Release에서 구현한다.

## WIL 작성·게시 기준

과정 안내에는 WIL 작성 시각은 없고 매주 월요일 URL 제출이 명시되어 있다. Week 1 WIL은 8월 22일까지 본문을 작성하고 8월 24일 월요일에 게시·제출한다.

## 관련 계획

- [12주 총괄 계획](../plan/agentops-lab-12-week-plan.md)
- [주차별 Roadmap](../plan/weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](../plan/learning-and-content-plan.md)
- [저장소 안내](../README.md)

## 주차 이동

- 이전 주차: 없음
- 다음 주차: Week 2 — 회사 운영·Workflow Planning Kernel
