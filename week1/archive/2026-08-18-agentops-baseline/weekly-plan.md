# Week 1 학습 및 구현 계획 — 제품 계약, Framework 결정과 Walking Skeleton

> Archive 사유: 구현 시작 전 학습 우선으로 범위를 변경하면서 대체된 최초 Week 1 기준선이다.

> 기간: 2026-08-18 ~ 2026-08-22
> 계획 상태: Archived — Baseline v1
> 계획 확정일: 2026-08-18
> 계획 Version: v1
> 대상 Release: R1 Production Pilot
> 제품 Milestone: 실제 PostgreSQL·LLM을 사용하는 가장 작은 설명 가능한 실행 흐름

## 계획 배경

AgentOps Lab은 구현 전 제품 문서 Baseline만 존재하므로 첫 주에는 Architecture와 Framework 불확실성을 먼저 줄여야 한다. 이번 주는 전체 R1을 축약 구현하는 기간이 아니라 Browser 또는 API에서 시작해 Spring, PostgreSQL과 실제 LLM으로 이어지는 가장 작은 흐름을 만들고 이후 Domain 구현의 기준을 세우는 기간이다.

8월 18일은 19시 이후부터 주간 실행 계획, 우선순위와 Issue·Board Baseline만 확정한다. 개발 환경 설정과 Code 변경은 8월 19일부터 시작하며 8월 22일 오후는 새 기능보다 통합 실패와 재현성 문제를 해결하는 Buffer로 사용한다.

제품 범위와 구조는 별도 AgentOps Lab 제품 저장소의 `Requirements`, `Architecture`, `Workflow Planning and Review`, `Security and Governance`, `Evaluation and Operations`를 따른다. 이 문서는 일정과 학습·검증 계획만 관리하며 제품 설계를 변경하지 않는다.

## 이번 주 핵심 질문

> Agent Framework를 업무 상태의 기준으로 만들지 않으면서 Browser·Spring·PostgreSQL·실제 LLM을 하나의 설명 가능한 흐름으로 연결할 수 있는가?

## 목표

| 구분 | 목표 | 완료 판단 기준 |
|---|---|---|
| 제품 | Work Item 생성·조회, 최소 Workflow Read Model과 실제 LLM 호출을 하나의 Walking Skeleton으로 연결 | 실제 PostgreSQL과 LLM을 사용하고 성공·실패 상태를 다시 조회할 수 있음 |
| 학습 | Java·Spring·HTTP·PostgreSQL·LLM·DAG의 핵심 원리를 제품 흐름에서 이해 | 요청·Transaction·Model 호출·Graph Projection을 설명하고 관련 Test를 직접 수정할 수 있음 |
| 운영 | 재현 가능한 Toolchain, Build, Migration, CI와 Secret 경계 구성 | 새 환경에서 Wrapper 기반 Build·Test·Migration이 실행되고 Secret 값이 Source·Log에 없음 |
| 공개 기록 | Framework 선택, 요청 흐름과 Walking Skeleton의 판단·실패 근거 축적 | 주차 종료 시 구현 Report, Learning Note와 WIL 초안을 작성할 근거가 준비됨 |

## 작업 시간과 휴식

- 8월 18일 작업 구간: 야간 19:00~23:00
- 8월 19~22일 작업 구간: 오전 10:00~12:00, 오후 13:00~18:00, 야간 19:00~23:00
- 점심 식사·휴식: 12:00~13:00 — 과업을 배정하지 않음
- 저녁 식사·휴식: 18:00~19:00 — 과업을 배정하지 않음
- Core Time은 오후 또는 야간 작업 구간 안에서 하루 한 시간 이상 운영하며 식사 시간을 사용하지 않음

일정은 분 단위로 통제하지 않는다. 각 작업 구간의 종료 조건을 기준으로 진행하고 예상보다 늦어진 작업은 다음 기능을 병렬로 시작하지 않고 우선순위 규칙에 따라 조정한다.

## 작성 시점 환경 Baseline

| 항목 | 확인 상태 | 이번 주 조치 |
|---|---|---|
| Git | 사용 가능, 제품 저장소 초기화 전 | 저장소 초기화, Branch·Commit Convention과 Review 방식 확정 |
| Java | JDK 21 설치, 제품 기준은 Java 25 | JDK 25 설치·선택과 Build·Test Runtime 검증 |
| Build Tool | Maven·Gradle 전역 설치 없음 | 공식 호환성을 확인해 하나를 선택하고 Wrapper로 재현 |
| Docker | CLI 사용 가능 | Engine 동작과 PostgreSQL Container 재현 확인 |
| PostgreSQL Client | 사용 가능 | Container Database 연결과 Flyway Migration 확인 |
| 제품 Code | 문서 Baseline만 존재 | 최소 Spring Application과 Module·Layer 뼈대 생성 |

Version과 Framework는 기억에 의존하지 않고 공식 호환 자료와 실제 Build·핵심 Scenario로 확인한 뒤 고정한다. Credential 값은 확인·기록·출력하지 않는다.

## 우선순위와 축소 기준

### Must

- Git·JDK 25·Build Wrapper·Docker·PostgreSQL과 CI의 재현 가능한 Baseline
- Browser 또는 API → Spring → PostgreSQL Work Item 생성·조회
- 실제 LLM 호출과 성공·실패·Timeout 구분
- 대표 Workflow의 Node·Edge·담당자·Tool·승인 지점 시각화
- Spring AI와 Google ADK Java 비교 종료와 한 개 Framework 선택
- Layer 책임, Secret 경계와 핵심 실패 Case 설명

### Should

- 간단한 Browser Work Item Form
- Graph·목록·상세 사이의 Node 선택과 오류 강조
- 최초 다섯 개 평가 Case의 자동 실행 기반
- Architecture 의존성 자동 검사

### 먼저 줄이는 항목

1. UI 장식과 Graph Layout 편의 기능
2. 평가 Case 다섯 개를 넘는 확장
3. Framework 비교용 보조 Scenario
4. 비핵심 API와 Domain 필드

Must가 막힌 상태에서 Should나 새 Module을 시작하지 않는다. 실제 LLM Credential을 사용할 수 없으면 Mock으로 완료 처리하지 않고 Blocker로 기록한다.

## 권장 시간 배분

| 활동 | 계획 비율 | 종료 조건 |
|---|---:|---|
| 개념 학습·검증 Spike | 35% | 핵심 원리를 설명하고 선택에 필요한 작은 실험 결과가 있음 |
| 제품 구현 | 40% | 가장 작은 End-to-End 흐름의 Acceptance Criteria 충족 |
| Test·Security·운영 | 15% | 실패 경로, Migration, CI와 Secret 경계 검증 |
| WIL·기술 콘텐츠 | 10% | 근거를 정리하고 WIL 초안과 기술 글 Outline 작성 |

비율은 작업량 목표가 아니라 과도한 선행 학습이나 기능 확장을 감지하는 상한이다.

## 범위

### 포함

- R1 사용자·운영 경계, 성공 기준과 Week 1 Acceptance Criteria 정리
- Modular Monolith의 최소 Module·Layer 구조와 금지 의존성
- Organization, Human Actor와 Work Item의 최초 Database Migration
- Work Item 생성·조회 API와 선택적인 최소 Browser Form
- Workflow Plan Schema, DAG 불변 조건과 Read Model·시각화 Spike
- Model Port와 실제 LLM Structured Output 최소 호출
- LLM Provider 실패·Timeout의 영속 상태와 오류 응답
- Spring AI·Google ADK Java 핵심 Scenario 비교와 Decision
- Build, Code Style, Unit·Integration Test, CI와 Secret 검사 기반
- 평가 Dataset 형식과 최초 다섯 개 Case

### 이번 주에 포함하지 않음

- 완전한 로그인·Spring Security 인가와 다중 Organization 운영 UI
- Workflow Revision·Diff·Plan Approval과 Agent 업무 실행
- Capability Grant, Tool Gateway, Action Approval과 실제 Connector Side Effect
- 자유로운 Node·Edge Drag-and-drop과 실시간 공동 편집
- RAG, Production 배포, Backup·Restore와 운영 Dashboard
- 둘 이상의 Model Provider를 Production 경로에 유지하는 구현

### 후속 Release로 유지

- 인증·Organization 격리와 Planning Kernel의 완전한 Domain 구현은 Week 2에서 수행한다.
- Review·Revision·Approval과 Agent Run은 Week 3에서 수행한다.
- Reference Application Browser E2E는 Week 4에서 수행한다.
- 배포·관측·복구는 Week 6 Production Gate에서 수행한다.

## 학습 계획

| 학습 주제 | 적용 방식 | 필요한 이유 | 학습 방법 | 제품 적용 지점 | 검증 증거 |
|---|---|---|---|---|---|
| Git 3단계 영역·Branch·Commit Convention·CI | 운영 실습 | 첫 Commit부터 검토·복구 가능한 이력 필요 | 실제 저장소에서 Status·Diff·Staging·작은 Commit과 CI 관찰 | 제품 저장소 전체 | Commit·Review·CI 결과와 Learning Note |
| Java 객체·불변성·Exception·Collection | 제품 적용 | Domain 값과 실패를 Framework 밖에서 명확히 표현해야 함 | 작은 Code Spike 후 Work Item·Workflow 값에 적용 | work·planning Domain | Unit Test와 직접 설명 |
| Spring MVC·DI/IoC·Layered Architecture | 제품 적용 | Controller·Application·Domain·Adapter 책임 혼합 방지 | 요청 흐름 Trace와 의존성 교체 Test | Work Item 생성·조회 Use Case | Request Sequence와 Architecture Test |
| HTTP·REST·Cookie·Session·CORS·CSRF | 제품 적용·Spike | Browser 경계와 이후 인증 방식을 잘못 고정하지 않기 위해 필요 | Request·Response와 Header를 관찰하고 최소 정책만 적용 | Web·API Layer | HTTP Test와 Header 관찰 Note |
| PostgreSQL Transaction·Constraint·Flyway | 제품 적용 | Work Item과 LLM 실행 상태를 Memory가 아닌 기준 상태로 보존 | Migration 재현, 실패 Rollback과 Constraint Test | Persistence Adapter | Testcontainers Integration Test와 Migration Log |
| Structured Output·Tool Calling·실행 상태 | 제품 적용 | LLM Text를 정상 Domain 상태로 오인하지 않아야 함 | 실제 호출, Schema 오류·Provider 실패·Timeout 재현 | Model Port와 최소 호출 Use Case | Adapter Contract·Integration Test |
| DAG·불변 Version·Read Model Projection | 제품 적용 | Browser Graph가 두 번째 업무 상태가 되는 것을 방지 | Graph Fixture, 순환·누락 실패와 Projection Spike | planning Domain·Read Model | Graph 검증표와 UI Spike |
| Spring AI·Google ADK Java | 검증 Spike | 핵심 Domain을 Framework에 종속시키지 않을 Adapter 선택 필요 | 같은 Structured Output·Timeout Scenario를 작은 Spike로 비교 | integration Model Adapter | 비교표, 실행 결과와 Decision Log |

학습은 별도 Tutorial 완성으로 끝내지 않는다. 각 주제가 제품의 어느 책임에 적용됐고 어떤 Test 또는 실패 관찰로 이해가 바뀌었는지 기록한다.

## 구현 계획

| 순서 | Vertical Slice | Acceptance Criteria | 주요 위험 | 검증 방법 | 상태 |
|---:|---|---|---|---|---|
| 0 | Repository·Toolchain Baseline | 새 Terminal에서 선택한 Java와 Wrapper로 Build·Test가 실행됨 | Java 25·Framework 호환성, 환경 의존 | Version 확인, Clean Build와 CI | Planned |
| 1 | Spring·PostgreSQL Walking Skeleton | Health와 Database 연결이 정상·실패를 구분하고 Migration이 재현됨 | Local에서만 동작, 설정·Secret 노출 | Container 재생성, Migration·구성 Test | Planned |
| 2 | Work Item 생성·조회 | 유효한 요청은 실제 DB에 저장되고 ID로 다시 조회되며 잘못된 입력은 예측 가능한 4xx가 됨 | Controller Business Logic, Transaction 누락 | Domain Unit·PostgreSQL Integration·HTTP Test | Planned |
| 3 | Workflow Plan 계약과 검증 | 대표 Plan을 읽을 수 있고 존재하지 않는 Node, 중복 ID, 자기 Edge와 순환을 거부함 | JSON만 저장하고 Domain 검증 누락 | Schema·Graph Unit Test와 Fixture | Planned |
| 4 | Workflow Read Model UI Spike | Node, Edge, 담당 Actor 유형, Tool과 승인 지점을 Graph·목록·상세에서 구분함 | Browser가 별도 상태 소유 | 같은 Server Read Model 사용과 수동·Browser 검증 | Planned |
| 5 | 실제 LLM 최소 호출 | Structured Output 성공과 Schema 오류·Provider 실패·Timeout이 서로 다른 영속 상태로 조회됨 | Secret·원문 Log 노출, Framework 결합 | Adapter Contract, 실제 Integration과 Redaction 점검 | Planned |
| 6 | 통합·재현 검증 | 새 환경에서 Build·Migration·Work Item·LLM·Workflow 대표 흐름을 다시 실행할 수 있음 | 마지막 날 수동 수정 의존 | Clean Setup, CI와 Week 1 Gate Review | Planned |

## 기술 콘텐츠 계획

- WIL 핵심: 문서 Baseline을 실제 Walking Skeleton으로 바꾸며 확인한 기술 선택과 실패
- WIL 작성 완료 목표: 2026-08-22
- WIL 게시·제출 목표: 2026-08-24 월요일
- 기술 블로그 가제: Agent Framework를 회사 업무 상태의 기준으로 두지 않은 이유
- 연계 학습 개념: Layered Architecture·DI/IoC, Port·Adapter, Structured Output와 영속 실행 상태
- 학습 적용 방식: 제품 적용 + Framework 비교 Spike
- 예상 독자: AI Agent 기능을 실제 Backend Domain에 통합하려는 개발자
- 공개 근거: 비교 Spike, Request Sequence, Model Port Contract, 실패·Timeout Test와 Workflow Schema
- 발행 상태: Note — Week 1에는 근거와 Outline을 만들고 장문 게시 여부는 검증 후 결정

과정 안내는 작성 시점을 정하지 않고 매주 월요일 WIL URL 제출을 요구한다. 따라서 토요일에 본문을 완료하고 다음 월요일에 게시·제출한다.

## 일정

점심 12:00~13:00과 저녁 18:00~19:00에는 과업을 배정하지 않는다. 아래 일정은 오전·오후·야간의 주요 결과만 정하며 세부 시간표로 사용하지 않는다.

| 날짜 | 오전 | 오후 | 야간 | 일일 종료 조건 | 상태 |
|---|---|---|---|---|---|
| 8월 18일 화요일 | 작업 없음 | 작업 없음 | 문서 기준 확인, Must·Should·축소 순서, 일자별 실행 순서와 Issue·Board Baseline 확정 | 주간 Baseline과 19일 환경 설정 Checklist가 확정되고 환경 설정·Code 변경은 시작하지 않음 | Planned |
| 8월 19일 수요일 | Git·JDK 25·Build Wrapper·Docker·PostgreSQL 설정과 빈 Application Build 검증 | Java 객체·Exception, Spring 요청 흐름·DI/IoC와 Layer 책임 학습, 최소 Application·Flyway 기반 구성 | Organization·Actor·Work Item Migration과 생성·조회 흐름, HTTP·Transaction Test와 CI 구성 | 실제 DB Work Item 생성·조회와 핵심 Test가 Local·CI에서 실행됨 | Planned |
| 8월 20일 목요일 | Transaction·Constraint와 DAG·불변 Version·Projection 학습 | Workflow Plan Schema, 대표 Fixture와 Graph 불변 조건 구현 | 같은 Read Model 기반 Graph·목록·상세 UI Spike와 실패 Case Test | 대표 Workflow를 시각적으로 읽고 잘못된 Graph를 서버가 거부함 | Planned |
| 8월 21일 금요일 | Structured Output·Tool Calling·Timeout 학습과 두 Framework 핵심 Scenario 비교 | Model Port와 실제 LLM 최소 호출, 결과·실패 상태 저장 | Framework 선택 Decision, Schema 오류·Provider 실패·Timeout Test와 평가 Case 다섯 개 정리 | 하나의 Framework를 선택하고 실제 LLM 성공·실패가 재현됨 | Planned |
| 8월 22일 토요일 | 새 환경 Clean Build·Migration·CI와 핵심 흐름 재현 | 신규 기능을 시작하지 않고 통합 Blocker, Architecture 경계와 실패 Test 수정 | Week 1 Gate Review, 구현 Report·Learning Note·WIL 본문과 기술 글 Outline 정리 | Gate 결과와 미완료 범위가 근거와 함께 공개 문서 초안에 반영됨 | Planned |

매일 시작 시 Board와 Blocker를 갱신하고 종료 전 동작 확인, 작은 Commit과 필요한 Decision·Issue를 남긴다.

## 위험과 대응

| 위험 | 조기 신호 | 대응 | 상태 |
|---|---|---|---|
| Java 25·Spring·Build Tool 호환성 | 첫날 Clean Build 실패 또는 Preview 의존 필요 | 공식 호환성 확인, 안정 Version·Wrapper 고정, 핵심 Domain에 Preview 사용 금지 | Open |
| Framework 비교 장기화 | 8월 21일 오후에도 두 Integration 경로를 유지 | 핵심 Scenario 결과로 하나를 선택하고 다른 Spike 제거 | Open |
| Java·Spring 이해보다 생성 Code가 앞섬 | 요청·Transaction 흐름을 설명하거나 Test를 수정하지 못함 | 변경 축소, 직접 Trace와 핵심 규칙 재작성 | Open |
| LLM Credential·Provider 문제 | 실제 호출을 실행하지 못하거나 Timeout 재현 불가 | Secret 존재만 확인하고 Provider Blocker 기록, Mock으로 완료 표시 금지 | Open |
| Scope 과다 | Work Item 흐름 전 여러 Module·UI가 동시에 시작됨 | Must 우선, Should와 UI 편의 기능 순서대로 제거 | Open |
| Browser Graph가 별도 상태 소유 | Fixture와 실행 API의 Version·Node가 불일치 | Server Read Model 한 개를 사용하고 일치 Test 추가 | Open |
| Secret·민감 원문 노출 | Config·Log·Test Fixture에 Key나 원문 포함 | Source·Log Redaction, Secret Scan과 공개 Checklist 적용 | Open |

## 계획된 산출물

| 산출물 | 목표 시점 | 초기 상태 |
|---|---|---|
| [주차 안내](./README.md) | 주차 시작 | 작성 완료 |
| [주간 학습 및 구현 계획](./weekly-plan.md) | 주차 시작 | Baseline |
| Implementation Report | 8월 22일 | 실제 구현 후 생성 |
| Java·Spring 또는 Transaction Learning Note | 학습 적용 후 | 근거 확보 시 생성 |
| Framework 비교 Experiment·Decision | 8월 21일 | Spike 결과 확보 시 생성 |
| WIL | 8월 22일 작성, 8월 24일 게시·제출 | 결과 확보 시 생성 |
| 공개 산출물 Checklist | 공개 직전 | 검토 시 생성 |
| 기술 블로그 Outline·초안 | 8월 22일 | 검증 근거에 따라 생성 |

## 주간 완료 Gate

- [ ] 새 환경에서 Work Item을 실제 PostgreSQL에 저장하고 다시 조회할 수 있다.
- [ ] 실제 LLM의 Provider 실패와 Timeout이 성공으로 표시되지 않는다.
- [ ] 대표 Workflow의 Node, Edge, 담당자, Tool과 승인 지점을 구분할 수 있다.
- [ ] 각 Layer의 책임과 선택한 Framework의 이유를 구현 담당자가 설명할 수 있다.
- [ ] Build, Test와 Migration이 Wrapper·Container·CI에서 재현된다.
- [ ] Secret과 민감 원문이 Source, Log와 공개 자료에 없다.
- [ ] 구현·부분 구현·미구현 범위와 다음 주 우선순위를 구분했다.
- [ ] Implementation Report, Learning Note와 WIL에 실제 근거를 연결했다.
- [ ] 공개 Checklist를 통과했다.

## 계획 변경 기록

Baseline 확정 이후 범위를 조용히 바꾸지 않는다. 변경이 필요하면 이유, Product Gate 영향과 이동한 주차·Release를 기록한다.

| 날짜 | 변경 전 | 변경 후 | 이유 | Gate·Release 영향 | 승인·근거 |
|---|---|---|---|---|---|
| 2026-08-18 | 주차별 Roadmap의 Week 1 범위 | 가용 일정, 식사 시간, Must·Should·축소 기준을 포함한 Baseline v1 | 첫날 가용 시간이 짧고 Toolchain이 초기 상태임 | R1 범위는 유지하고 Week 1 실행 순서만 구체화 | 계획 승인과 환경 점검 결과 |

## 관련 기준

- [당시 12주 총괄 계획](../../../plan/archive/2026-08-18-agentops-lab-12-week-plan.md)
- [당시 주차별 Roadmap](../../../plan/archive/2026-08-18-agentops-lab-weekly-roadmap.md)
- [당시 학습 및 기술 콘텐츠 계획](../../../plan/archive/2026-08-18-agentops-lab-learning-and-content-plan.md)
- 제품 기준: 별도 AgentOps Lab 제품 저장소의 `Requirements`, `Architecture`, `Workflow Planning and Review`, `Security and Governance`, `Evaluation and Operations`
