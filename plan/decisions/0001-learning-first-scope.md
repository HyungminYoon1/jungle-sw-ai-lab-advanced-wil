# ADR-0001 — 제품 완성보다 선택형 기술 학습을 우선한다

> 상태: Accepted
> 결정일: 2026-08-18
> 검토 시점: Week 4 종료, Week 8 종료

## Context

최초 계획은 AgentOps Lab을 12주 동안 Production Pilot로 발전시키면서 Java·Spring·Database·Web·Security·AI Agent를 함께 학습하는 것이었다. 그러나 기술 심화 8주 안에 범용 Workflow, 권한·승인, 실제 LLM·Side Effect, RAG, 평가, 배포와 운영을 한 사람이 구현하면 기능 통합이 학습 시간을 압도할 가능성이 높다.

과정 공지는 모든 과제를 완료하는 대신 커리어 패스에 필요한 기술을 선택하고 우선순위를 정하도록 안내한다. 또한 AI를 적극적으로 사용하되 작성한 코드의 동작 원리를 이해하고 설명할 수 있어야 한다.

구현을 시작하기 전이므로 현재 시점의 범위 전환 비용은 낮다.

## Decision Drivers

- Java Backend·AI/AX 직무에 필요한 기반 지식을 깊게 학습할 수 있는가
- 혼자서 8주 안에 설명·수정·검증 가능한 범위인가
- 공지의 학습 과제를 재현 가능한 실험으로 수행할 수 있는가
- 매주 WIL과 기술 면접에서 사용할 구체적 근거를 남길 수 있는가
- 취업 심화 4주의 활동을 침해하지 않는가

## 검토한 선택지

### Option A — AgentOps Lab 계획 유지

차별화된 장기 제품 서사를 유지할 수 있지만 Domain과 운영 범위가 넓어 Java·Spring의 기초 이해보다 통합 구현이 앞설 위험이 크다.

### Option B — 공지의 예제 프로젝트를 각각 독립 구현

개념별 범위는 작지만 Repository와 Domain이 분산되어 반복 설정 비용이 크고 학습 근거를 하나의 흐름으로 설명하기 어렵다.

### Option C — 작은 공통 Lab과 독립 재현 실험을 병행

AI Helpdesk를 공통 관찰 대상으로 사용하되, 제품에 억지로 통합할 필요가 없는 주제는 작은 독립 실험으로 수행한다. 학습 질문과 검증 근거가 기능 수보다 우선한다.

## Final Decision

Option C를 선택한다.

- 기술 심화 8주는 Git, Java 객체지향, Web·Spring, Database, Security, Test, AI Native, DevOps·Cloud의 선택 학습에 집중한다.
- 공통 실습 주제는 `AI Helpdesk Learning Lab`으로 제한한다.
- AgentOps Lab은 별도 장기 프로젝트로 보류한다.
- 완료 기준을 Product Release가 아니라 설명, 재현 실험, Test·측정과 WIL 근거로 정의한다.

## Rationale

Helpdesk Domain은 Ticket 상태, 담당자 권한, 동시 할당, 조회 성능과 AI 분류를 자연스럽게 다루면서도 범용 Platform 설계를 요구하지 않는다. 공통 Lab을 사용하면 설정과 Domain 이해를 재사용할 수 있고, 독립 Spike를 허용하면 모든 키워드를 기능으로 만드는 Scope Creep을 막을 수 있다.

## 영향 분석

- WIL 저장소의 Root 소개, 총괄 계획, Roadmap과 Week 1 문서를 전면 개편한다.
- 기존 제품 Release 완료 기준을 Learning Evidence 중심으로 바꾼다.
- 기존 AgentOps 계획은 Archive에 보존하고 현재 경로에는 보류 상태를 명시한다.
- 별도 AgentOps Lab 저장소와 기존 설계 문서는 수정하지 않는다.

## Consequences

### 기대 효과

- 개념 학습, 직접 구현과 설명 시간을 확보한다.
- 작은 실패 실험과 비교 결과를 매주 WIL에 남길 수 있다.
- Java Backend와 AI/AX 면접에서 설명할 근거가 축적된다.
- 미완성 대형 제품보다 완료된 학습 단위가 늘어난다.

### Trade-offs와 새 위험

- AgentOps Lab의 장기 제품 Narrative와 구현 진척은 과정 중 발생하지 않는다.
- Helpdesk 기능 확장이 다시 목표가 되면 동일한 Scope 문제가 재발할 수 있다.
- 독립 실험이 단순 Tutorial 복사로 끝나지 않도록 예상, 실패와 해석을 반드시 기록해야 한다.

## Validation

- 각 주에 핵심 질문 한 가지와 최소 한 개의 재현 가능한 근거가 남는지 확인한다.
- 구현량이 아닌 설명 가능성과 실패 원인 분석으로 완료를 판단한다.
- Week 4에 학습 깊이, 진도와 Scope를 검토한다.
- Week 8에 직접 설명 가능한 개념과 Portfolio 근거를 최종 확인한다.

## Follow-up Review

- Week 4: 학습 주제 수, 실험 깊이와 Helpdesk 통합 부담 검토
- Week 8: AgentOps Lab 재검토 여부가 아니라 과정 학습 목표 달성 여부를 먼저 평가
- AgentOps Lab 재개 시: 새 기간, 최소 범위와 취업 일정 영향을 별도 Decision으로 기록
