# Week 1 — Java 객체지향·JUnit

> 상태: Completed
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
- [Encapsulation과 불변조건 Learning Note](./study-docs/learning-encapsulation-and-invariants.md) — 개념 정리, JShell 수동 검증과 JUnit 후속 검증
- [Polymorphism·Composition과 SOLID Learning Note](./study-docs/learning-polymorphism-composition-and-solid.md) — 조건문·Strategy 예상과 실제 변경 범위 비교 완료
- [Ticket 상태 전이 Lab](./study-docs/lab-ticket-state-transition.md) — 정상·거부·반례 실험과 JUnit 자동 검증 기록
- [Maven Build와 Wrapper Learning Note](./study-docs/learning-maven-build-and-wrapper.md) — Project Model, Lifecycle, Artifact와 Gradle 비교
- [JUnit과 Unit Test 설계 Learning Note](./study-docs/learning-junit-and-unit-test-design.md) — JUnit 구조, Assertion, Given–When–Then과 Test 독립성
- [Java Exception과 안전한 실패 처리 Learning Note](./study-docs/learning-java-exceptions.md) — Exception 계층, Checked·Unchecked 구분, 전파와 상태 보존
- [Java Collection과 안전한 상태 노출 Learning Note](./study-docs/learning-java-collections.md) — 자료구조 선택, Generic, 가변성, Snapshot과 읽기 전용 View
- [Ticket 객체와 JUnit 기초 학습 점검](./study-notes/2026-08-19-study-questions.md) — 객체 책임, 상태 전이 시나리오와 JUnit 실행 구조 점검
- [Java Exception·Collection과 JUnit 자동 검증 학습 점검](./study-notes/2026-08-20-study-questions.md) — Exception·Collection 설명, Ticket Test Self Review와 최종 실행 근거
- [Java 다형성·합성과 SOLID 원칙 학습 점검](./study-notes/2026-08-21-study-questions.md) — VIP Policy Diff, OCP 적용 경계와 취약 개념 설명 점검
- [Week 1 WIL](./wil.md) — 실제 학습 결과, 실패·보완 범위와 8월 24일 후속 개념 확인

### 실제 검증 근거

- AI Helpdesk Learning Lab에서 `.\mvnw.cmd clean test`로 Ticket Test 10개와 Policy 비교 Test 6개 실행
- 결과: `Failures: 0`, `Errors: 0`, `Skipped: 0`, `BUILD SUCCESS`
- Source Commit: `cdcbee0` — Ticket Unit Test 기준선, `944aede` — 대표 Exception Message 검증
- Policy 비교 Commit: `6fb3365` — NORMAL·URGENT 기준선, `3eb8b29` — VIP 확장
- 8월 20일 야간 Review: Test 이름, Exception Message와 실패 후 상태 보존을 자신의 말로 설명하고 Clean Test 재현
- 8월 21일 Review: 조건문과 Strategy의 변경 범위, OCP·LSP·DIP와 Ticket 책임 경계를 자신의 말로 설명
- 8월 24일 후속 Review: 배송비 Policy 사례에서 선언 Type과 실제 객체, Method 호출 시점의 동적 바인딩, Composition의 보유·위임, Strategy와 DI·DIP를 구분해 설명

Week 1 WIL은 2026-08-24 블로그에 게시하고 정글 LMS에 링크를 제출하여 외부 제출까지 `Completed`로 처리했다.

## Week 1 Learning Evidence Gate

- [x] Ticket 상태를 외부에서 임의로 변경할 수 없게 한다.
- [x] 허용·거부 상태 전이를 객체 규칙과 JUnit으로 검증한다.
- [x] 조건문과 Strategy·Composition 중 선택 기준을 실제 변경 요구로 설명한다.
- [x] AI가 보조한 부분과 직접 작성·수정·검증한 부분을 구분한다.
- [x] 완료·부분 완료·미수행 범위를 WIL에 기록한다.
- [x] 공개 문서와 Source에 Secret, 개인정보와 로컬 경로가 없다.

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
