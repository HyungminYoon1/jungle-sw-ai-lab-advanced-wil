# Week 1 학습 계획 — Git·Java 객체지향·JUnit

> 작성일: 2026-08-18
> 상태: Baseline v2
> 기간: 2026-08-18 ~ 2026-08-22
> 핵심 질문: Framework 없이 객체가 자신의 규칙을 지키고 Test로 계약을 설명할 수 있는가?

## 계획 배경

최초 기준선은 AgentOps Lab의 Walking Skeleton을 만들면서 Java·Spring·PostgreSQL·LLM·Workflow를 동시에 학습하도록 구성했다. 구현을 시작하기 전에 제품 범위가 8주 학습 목적에 비해 크고, Java와 Spring을 직접 이해하는 시간보다 통합과 AI 생성 Code 검토가 더 커질 위험을 확인했다.

따라서 이번 주부터 과정 공지의 선택형 학습 원칙에 맞춰 개념 학습, 최소 재현 실험과 설명 가능성을 우선한다. AgentOps Lab은 보류하고, AI Helpdesk Learning Lab의 순수 Java Ticket Domain만 공통 실습 대상으로 사용한다.

## 이번 주 핵심 질문

> Framework 없이 객체가 자신의 상태와 규칙을 지키게 만들고, 그 계약을 Test로 설명할 수 있는가?

## 목표

| 구분 | 목표 | 완료 근거 |
|---|---|---|
| Git | 변경이 Working Tree·Staging Area·Commit 사이에서 이동하는 과정을 설명 | 명령 전후 `status`·`diff`·`log` 관찰 Note |
| Java | Ticket 상태와 잘못된 변경을 객체가 스스로 통제 | Framework 없는 Domain Code와 실패 Case |
| 객체지향 | Encapsulation·Polymorphism·Composition을 변경 요구로 비교 | 비교 Lab Report와 Unit Test |
| Test | 정상·경계·거부 규칙을 JUnit으로 표현 | 읽을 수 있는 Given-When-Then Test |
| 설명 | AI 도움을 받은 Code도 직접 수정·설명 | 동료 질문 또는 Self Review 기록 |
| 공개 기록 | 선택, 예상, 관찰, 실패와 다음 질문 정리 | Learning Note·Lab Report·WIL |

## 작업 시간과 휴식

- 8월 18일 작업 구간: 야간 19:00~23:00
- 8월 19~22일 작업 구간: 오전 10:00~12:00, 오후 13:00~18:00, 야간 19:00~23:00
- 점심 12:00~13:00과 저녁 18:00~19:00에는 과업을 배정하지 않는다.
- 매일 한 시간 이상의 Core Time에 학습 내용을 설명하고 질문을 받는다.

일정은 분 단위로 통제하지 않는다. 예상보다 늦어지면 새 개념을 추가하지 않고 현재 질문의 실험과 설명을 먼저 끝낸다.

## 작성 시점 Baseline

| 항목 | 확인 상태 | 이번 주 조치 |
|---|---|---|
| Git | WIL 저장소 사용 가능, 학습 계획 개편 변경 존재 | 관련 문서를 검토 가능한 단위로 관리하고 실험은 별도 안전한 Branch에서 수행 |
| Java | JDK 21 설치 확인 | 순수 Java·JUnit 실습에 사용하고 실제 Version을 기록 |
| Build Tool | 전역 Maven·Gradle 설치에 의존하지 않음 | 필요할 때 한 개 Wrapper만 선택 |
| Learning Lab Source | 아직 생성하지 않음 | 문서와 Source 경계를 정한 뒤 최소 Project만 구성 |
| Spring·Database·LLM | 이번 주 비범위 | Week 2 이후 공식 호환성과 선행 학습을 확인하고 선택 |

Version을 기억에 의존해 단정하지 않는다. 실제 명령과 공식 자료로 확인하고, Credential 값은 확인하거나 출력하지 않는다.

## 우선순위와 축소 기준

### Must

- Git 3단계 영역을 실제 상태 변화로 설명
- Framework 없는 Ticket 상태 전이와 불변 조건
- 잘못된 상태 변경이 실패하는 Unit Test
- Encapsulation과 Composition 선택 이유 설명
- Week 1 WIL에 예상·관찰·실패·다음 질문 기록

### Should

- Merge와 Rebase History 비교
- 의도적인 Conflict 발생과 해결
- 절차형 분기에서 다형성 또는 Strategy로 변경한 비교
- 정적 분석 또는 Test Coverage의 의미 확인

### 먼저 줄이는 항목

1. Pattern 추가 구현
2. Ticket Comment와 부가 Domain
3. UI, API와 영속화
4. Build·CI 고도화
5. AgentOps 관련 설계 재검토

Must가 끝나지 않은 상태에서 Should나 다음 주 기술을 시작하지 않는다.

## 권장 시간 배분

| 활동 | 계획 비율 | 종료 조건 |
|---|---:|---|
| 개념·도서·공식 자료 | 30% | Git 상태와 객체 책임을 자신의 말로 설명 |
| 최소 재현 실험 | 35% | 예상·실행·관찰·원인 기록 |
| Ticket Domain 선택 적용 | 20% | 학습 질문에 필요한 최소 Code와 Test |
| 설명·Review·WIL | 15% | 동료 질문 반영과 다음 질문 정리 |

## 학습 범위

### 포함

- Git Working Tree, Staging Area, Commit과 안전한 되돌리기
- Branch, Merge·Rebase, Conflict와 History
- Java Class·Object, 불변 값, Collection과 Exception
- Encapsulation, Abstraction, Polymorphism과 Composition
- SRP·OCP·DIP를 변경 영향으로 관찰
- Ticket 상태 전이, 담당자 할당과 잘못된 변경 거부
- JUnit, Given-When-Then과 실패 메시지

### 포함하지 않음

- Spring MVC, DI Container와 Web Server
- PostgreSQL, JPA와 Transaction
- Browser JavaScript와 Frontend
- 실제 LLM Provider와 AI Framework
- Multi-Agent, Workflow, Approval과 RAG

### 조건부 후속

- Factory·Observer 등 추가 Pattern은 실제 변경 문제를 단순하게 할 때만 적용한다.
- Test Coverage 도구는 핵심 Test가 먼저 작성된 뒤 사각지대 확인에만 사용한다.
- GitHub Actions는 Source Repository와 Test가 준비되면 운영 실습으로 추가한다.

## 학습 계획

| 학습 주제 | 상태 | 질문 | 방법 | 증거 |
|---|---|---|---|---|
| Git 3단계 영역 | 핵심 학습 | 변경은 현재 어느 영역에 있는가? | 명령 전후 `status`·`diff` 관찰 | Learning Note |
| Merge·Rebase | 독립 Spike | 같은 변경의 History가 어떻게 달라지는가? | 같은 Branch Scenario 비교 | Graph와 결론 |
| Encapsulation | 핵심 학습 | 객체가 잘못된 상태를 스스로 막는가? | 직접 변경 가능 Code와 Method 기반 Code 비교 | Unit Test |
| Polymorphism·Composition | 핵심 학습 | 새 Policy가 기존 Code 수정 범위를 줄이는가? | 분기와 Strategy·Composition 비교 | Diff와 설명 |
| SOLID | 선택 적용 | 원칙이 실제 변경을 단순하게 하는가? | 한 가지 변경 요구를 전후 구조에 적용 | Lab Report |
| JUnit | 핵심 학습 | Test가 규칙과 실패 이유를 읽히게 하는가? | 정상·경계·거부 Case | Test 실행 결과 |

## Lab 계획

| 순서 | Lab | 질문 | 완료 조건 | 상태 |
|---:|---|---|---|---|
| 0 | Source·Toolchain 최소 Baseline | 새 Terminal에서 같은 Test를 실행할 수 있는가? | 선택한 Wrapper로 Test 실행 | Planned |
| 1 | Git 상태 변화 | 변경이 세 영역 사이에서 어떻게 이동하는가? | 명령과 관찰 결과 기록 | Planned |
| 2 | Ticket Encapsulation | 외부가 상태를 임의로 바꿀 수 있는가? | 허용 Method만 상태 변경 | Planned |
| 3 | 상태 전이와 Exception | 잘못된 전이를 예측 가능하게 거부하는가? | 실패 Type·Message와 Test | Planned |
| 4 | Policy 비교 | 분기와 다형성의 변경 비용은 어떻게 다른가? | 같은 요구를 두 구조에 적용해 비교 | Planned |
| 5 | Review와 설명 | Code를 보지 않고 흐름과 선택을 설명할 수 있는가? | 질문·수정 기록과 WIL 근거 | Planned |

## 일정

| 날짜 | 오전 | 오후 | 야간 | 일일 종료 조건 | 상태 |
|---|---|---|---|---|---|
| 8월 18일 화요일 | 작업 없음 | 작업 없음 | 범위 전환, 핵심 질문과 Week 1 Baseline 확정 | AgentOps 구현이 중단되고 새 학습 범위가 문서화됨 | Completed |
| 8월 19일 수요일 | Git 3단계 영역 학습·실험 | Java Class·Object·Encapsulation 학습 | 최소 Source 구성과 Ticket 불변 조건 | Git 상태와 객체 책임을 예제로 설명 | Planned |
| 8월 20일 목요일 | Exception·Collection과 상태 전이 | JUnit 정상·경계·거부 Test | 실패 메시지와 Test 이름 Review | 잘못된 Ticket 전이가 Test에서 명확히 거부됨 | Planned |
| 8월 21일 금요일 | Polymorphism·Composition·SOLID 학습 | 분기와 Policy 구조 비교 | Merge·Rebase·Conflict Spike와 동료 설명 | 변경 요구에서 선택한 구조의 차이를 설명 | Planned |
| 8월 22일 토요일 | 전체 Test 재현과 취약 개념 재실험 | 새 기능 없이 Review·정리 | Lab Report·Learning Note·WIL 작성 | Gate 결과와 미완료 질문이 근거와 함께 기록됨 | Planned |

## 위험과 대응

| 위험 | 조기 신호 | 대응 | 상태 |
|---|---|---|---|
| Helpdesk 기능 확장 | Comment·UI·Database를 먼저 추가하려 함 | Ticket 상태와 Test 외 기능 중단 | Open |
| Pattern 수집 | 문제 없이 Pattern Class가 늘어남 | 변경 요구가 없는 Pattern 제외 | Open |
| AI 생성 Code 과다 | 흐름을 설명하거나 작은 변형을 직접 못함 | 변경 축소, 직접 재작성과 질문 Review | Open |
| Git 실험의 실제 History 영향 | 공유 Branch에서 Rebase·Reset을 시도 | 안전한 실험 Branch·Repository에서만 수행 | Open |
| 설정 시간 과다 | Build 설정이 반나절 이상 걸림 | 최소 Wrapper와 단일 Module로 축소 | Open |
| 기록 과다 | Template 작성이 실험보다 길어짐 | 핵심 Lab Report 한 개와 WIL만 작성 | Open |

## 계획된 산출물

| 산출물 | 목표 시점 | 초기 상태 |
|---|---|---|
| [주차 안내](./README.md) | 주차 시작 | 작성 완료 |
| [주간 학습 계획](./weekly-plan.md) | 주차 시작 | Baseline v2 |
| Git 또는 객체지향 Learning Note | 핵심 실험 후 | 근거 확보 시 생성 |
| Ticket 객체지향 Lab Report | 8월 22일 | 실제 실행 후 생성 |
| Week 1 WIL | 8월 22일 작성, 다음 월요일 게시 | 실제 결과 후 생성 |
| 공개 Checklist | 게시 직전 | 검토 시 생성 |

## 주간 Learning Evidence Gate

- [ ] Git 3단계 영역을 실제 상태 변화로 설명한다.
- [ ] Merge와 Rebase의 History 차이와 안전 경계를 설명한다.
- [ ] Ticket 객체가 잘못된 상태를 스스로 거부한다.
- [ ] 정상·경계·거부 규칙이 읽을 수 있는 JUnit Test로 검증된다.
- [ ] Composition 또는 다형성 선택을 변경 요구로 설명한다.
- [ ] 핵심 Code의 작은 변경을 직접 수행하고 Test를 수정한다.
- [ ] 예상과 실제가 달랐던 사례를 한 개 이상 기록한다.
- [ ] AI 활용과 직접 판단·수정·검증한 범위를 구분한다.
- [ ] 완료·부분 완료·미수행 범위와 다음 주 질문을 WIL에 남긴다.
- [ ] Secret, 개인정보와 로컬 경로가 공개 자료에 없다.

## 계획 변경 기록

| 날짜 | 변경 전 | 변경 후 | 이유 | 학습·일정 영향 | 승인·근거 |
|---|---|---|---|---|---|
| 2026-08-18 | AgentOps Lab Walking Skeleton과 Java·Spring·PostgreSQL·LLM·DAG 병행 | Git·Java 객체지향·JUnit과 Framework 없는 Ticket Domain | 단독 구현 범위가 학습 시간을 압도할 위험, 과정 목적에 맞춘 학습 우선 | AgentOps 구현 보류, Week 1 기술 수와 Integration 제거 | 사용자 승인, [ADR-0001](../plan/decisions/0001-learning-first-scope.md) |

## 관련 기준

- [심화과정 12주 학습 계획](../plan/advanced-track-12-week-plan.md)
- [주차별 Roadmap](../plan/weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](../plan/learning-and-content-plan.md)
- [이전 Week 1 기준선](./archive/2026-08-18-agentops-baseline/weekly-plan.md)
