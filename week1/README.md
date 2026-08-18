# Week 1 — Git·Java 객체지향·JUnit

> 상태: Planned
> 기간: 2026-08-18 ~ 2026-08-22
> 핵심 학습: Git 3단계 영역, Java 객체 책임과 JUnit
> 공통 실습: AI Helpdesk Learning Lab의 Framework 없는 Ticket Domain

이번 주는 큰 Application을 시작하지 않고 Git의 변경 상태와 Java 객체의 책임을 직접 관찰한다. Ticket의 상태 전이와 담당자 할당 규칙을 순수 Java로 표현하고, 정상·경계·실패 Case를 JUnit으로 설명하는 것이 목표다.

## 핵심 질문

> Framework 없이 객체가 자신의 상태와 규칙을 지키게 만들고, 그 계약을 Test로 설명할 수 있는가?

## 범위 변경

최초 Week 1은 AgentOps Lab의 Spring·PostgreSQL·Workflow·LLM Walking Skeleton을 목표로 했다. 구현 시작 전 범위가 학습 목적에 비해 크다고 판단하여, 2026-08-18부터 선택형 기술 학습을 우선하는 계획으로 변경했다.

- [학습 우선 범위 전환 Decision](../plan/decisions/0001-learning-first-scope.md)
- [이전 Week 1 기준선](./archive/2026-08-18-agentops-baseline/README.md)
- [이전 Week 1 상세 계획](./archive/2026-08-18-agentops-baseline/weekly-plan.md)

기존 계획은 Archive에 보존하며 현재 완료 조건으로 사용하지 않는다.

## 이번 주 학습 범위

- Git Working Tree·Staging Area·Commit
- `status`, `diff`, `log`, `restore`, `revert`
- Branch, Merge·Rebase와 Conflict의 차이
- Java Class·Object, 불변 값, Collection과 Exception
- Encapsulation, Abstraction, Polymorphism과 Composition
- SOLID를 변경 영향으로 관찰하는 방법
- JUnit과 Given-When-Then

## 이번 주 비범위

- Spring Boot와 Framework 비교
- PostgreSQL, Migration과 Container
- Browser UI와 HTTP API
- LLM, Structured Output와 Tool Calling
- AgentOps Lab의 Domain·Architecture 구현

## 공개 산출물

### 현재 문서

- [주간 학습 계획](./weekly-plan.md)
- [주차 안내](./README.md)

### 실제 근거가 생길 때 추가

- Git 3단계 영역 또는 Merge·Rebase Learning Note
- Ticket 객체지향 Lab Report
- JUnit Test와 설명 가능성 점검 기록
- Week 1 WIL

Placeholder만 있는 문서는 미리 만들지 않는다.

## Week 1 Learning Evidence Gate

- [ ] Working Tree, Staging Area와 Commit의 차이를 실제 상태 변화로 설명한다.
- [ ] Merge와 Rebase의 History 차이와 공유 Branch의 위험을 설명한다.
- [ ] Ticket 상태를 외부에서 임의로 변경할 수 없게 한다.
- [ ] 허용·거부 상태 전이를 객체 규칙과 JUnit으로 검증한다.
- [ ] 상속과 Composition 중 선택한 이유를 변경 요구로 설명한다.
- [ ] AI가 보조한 부분과 직접 작성·수정·검증한 부분을 구분한다.
- [ ] 완료·부분 완료·미수행 범위를 WIL에 기록한다.
- [ ] 공개 문서와 Source에 Secret, 개인정보와 로컬 경로가 없다.

## WIL 작성 기준

WIL은 구현한 Class 목록보다 다음 내용을 중심으로 작성한다.

- 시작할 때 객체지향과 Git을 어떻게 이해하고 있었는가
- 어떤 실험에서 예상과 실제가 달랐는가
- Ticket 규칙을 객체 안에 둘 때 무엇이 달라졌는가
- Test가 요구사항과 설계를 어떻게 드러냈는가
- AI 도움 없이 직접 설명·변경할 수 있는 범위는 어디까지인가
- 다음 주 HTTP·Spring 학습 전에 남은 질문은 무엇인가

## 관련 계획

- [심화과정 12주 학습 계획](../plan/advanced-track-12-week-plan.md)
- [주차별 Roadmap](../plan/weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](../plan/learning-and-content-plan.md)
- [산출물 Template](../templates/README.md)
