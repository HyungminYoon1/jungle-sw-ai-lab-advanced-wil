# Week 1 — Java 객체지향·JUnit

> 상태: In Progress
> 기간: 2026-08-18 ~ 2026-08-22
> 핵심 학습: Java 객체 책임과 JUnit
> 운영 Baseline: Git 상태 확인·Diff Review·안전한 복구
> 공통 실습: AI Helpdesk Learning Lab의 Framework 없는 Ticket Domain

이번 주는 큰 Application을 시작하지 않고 Java 객체의 책임을 직접 관찰한다. Ticket의 상태 전이와 담당자 할당 규칙을 순수 Java로 표현하고, 정상·경계·실패 Case를 JUnit으로 설명하는 것이 목표다. Git은 별도 심화 주제가 아니라 실제 학습 변경을 안전하고 검토 가능하게 관리하는 운영 Baseline으로 적용한다.

## 핵심 질문

> Framework 없이 객체가 자신의 상태와 규칙을 지키게 만들고, 그 계약을 Test로 설명할 수 있는가?

## 범위 변경

최초 Week 1은 AgentOps Lab의 Spring·PostgreSQL·Workflow·LLM Walking Skeleton을 목표로 했다. 구현 시작 전 범위가 학습 목적에 비해 크다고 판단하여, 2026-08-18부터 선택형 기술 학습을 우선하는 계획으로 변경했다.

- [학습 우선 범위 전환 Decision](../plan/decisions/0001-learning-first-scope.md)
- [이전 Week 1 기준선](./archive/2026-08-18-agentops-baseline/README.md)
- [이전 Week 1 상세 계획](./archive/2026-08-18-agentops-baseline/weekly-plan.md)

기존 계획은 Archive에 보존하며 현재 완료 조건으로 사용하지 않는다.

2026-08-19에는 Git 기초에 별도 학습 시간을 배정하는 대신 짧은 자가진단과 실제 저장소 작업으로 역량을 확인하도록 범위를 다시 조정했다. Merge·Rebase·Conflict는 필수 일정에서 제외하고, 공백이나 실제 필요가 확인될 때만 보충한다.

## 이번 주 핵심 학습 범위

- Java Class·Object, 불변 값, Collection과 Exception
- Encapsulation, Abstraction, Polymorphism과 Composition
- SOLID를 변경 영향으로 관찰하는 방법
- JUnit과 Given-When-Then

## Git 운영 Baseline

- Working Tree·Index·HEAD를 구분하고 `status`, `diff`, `diff --staged` 결과를 해석한다.
- 실제 변경을 작은 Commit으로 나누고 Commit 전에 포함 범위를 검토한다.
- 되돌릴 대상이 아직 Commit되지 않은 변경인지, Staging된 변경인지, 공개된 Commit인지 먼저 판단한다.
- Merge·Rebase·Conflict는 자가진단에서 공백이 드러나거나 실제 협업 상황이 생길 때만 안전한 환경에서 보충한다.
- 개념과 자가진단 기준은 [Git 운영 Baseline Learning Note](./study-docs/learning-git-operational-baseline.md)에 기록한다.

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
- [Git 운영 Baseline Learning Note](./study-docs/learning-git-operational-baseline.md) — 개념 정리 완료, 자가진단 실행 전
- [Encapsulation과 불변조건 Learning Note](./study-docs/learning-encapsulation-and-invariants.md) — 개념 정리와 JShell 수동 검증
- [Ticket 상태 전이 Lab](./study-docs/lab-ticket-state-transition.md) — 정상·거부·반례 실험 기록
- [Maven Build와 Wrapper Learning Note](./study-docs/learning-maven-build-and-wrapper.md) — Project Model, Lifecycle, Artifact와 Gradle 비교
- [JUnit과 Unit Test 설계 Learning Note](./study-docs/learning-junit-and-unit-test-design.md) — JUnit 구조, Assertion, Given–When–Then과 Test 독립성
- [Ticket 객체와 JUnit 기초 학습 점검](./study-docs/study-questions.md) — 객체 책임, 상태 전이 시나리오와 JUnit 실행 구조 점검

### 실제 근거가 생길 때 추가

- JUnit Test 실행 결과
- Week 1 WIL

Placeholder만 있는 문서는 미리 만들지 않는다.

## Week 1 Learning Evidence Gate

- [x] Ticket 상태를 외부에서 임의로 변경할 수 없게 한다.
- [ ] 허용·거부 상태 전이를 객체 규칙과 JUnit으로 검증한다.
- [ ] 상속과 Composition 중 선택한 이유를 변경 요구로 설명한다.
- [ ] AI가 보조한 부분과 직접 작성·수정·검증한 부분을 구분한다.
- [ ] 완료·부분 완료·미수행 범위를 WIL에 기록한다.
- [ ] 공개 문서와 Source에 Secret, 개인정보와 로컬 경로가 없다.

### Git 운영 Baseline 점검

- [ ] 변경이 Working Tree와 Index 중 어디에 있는지 `status`와 두 종류의 `diff`로 확인한다.
- [ ] Commit 전 포함 범위를 검토하고 하나의 의도로 설명되는 변경만 Staging한다.
- [ ] `restore`, `restore --staged`와 `revert`의 대상·영향 차이를 설명한다.
- [ ] 점검에서 공백이 발견되면 해당 항목만 보충하고 결과를 Learning Note에 갱신한다.

이 점검은 Week 1 핵심 학습 완료를 막는 별도 Gate가 아니다. Merge·Rebase 비교 실험도 기본 완료 조건에 포함하지 않는다.

## WIL 작성 기준

WIL은 구현한 Class 목록보다 다음 내용을 중심으로 작성한다.

- 시작할 때 객체지향을 어떻게 이해하고 있었는가
- Git 운영 Baseline 점검에서 실제로 보완할 공백이 있었는가
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
