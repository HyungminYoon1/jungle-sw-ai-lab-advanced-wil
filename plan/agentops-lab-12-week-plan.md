# AgentOps Lab 12주 학습 및 구현 계획

> 작성일: 2026-08-18  
> 상태: Active — 현재 공식 총괄 계획  
> 최근 개정: 2026-08-18 — 일정·학습 계획과 제품 시스템 설계의 기준 문서 분리  
> 대체한 문서: [초기 심화과정 학습 계획](./archive/2026-07-29-initial-advanced-track-plan.md)  
> 대상 직무: AI/AX 개발자, Java Backend 개발자, AI Platform·LLMOps Backend 개발자  
> 전체 기간: 기술 심화 8주 + 취업 심화 4주

이 문서는 AgentOps Lab의 12주 목표, Release 순서, 핵심 Gate, 범위 조정과 최종 성공 기준을 정의한다. 주차별 실행과 학습·기술 콘텐츠 운영은 같은 저장소의 세부 계획에서 관리하고, 제품 요구사항과 시스템 설계는 별도 AgentOps Lab 제품 저장소가 관리한다.

---

## 1. 문서 역할과 권한

이 문서는 **언제 어떤 순서로 무엇을 학습·구현할지** 결정하는 총괄 계획이다. Entity, 상태 Machine, Module, 승인 정책과 운영 지표의 세부 설계는 반복하지 않는다.

| 질문 | 기준 문서 |
|---|---|
| 12주 목표, Release 순서와 Gate는 무엇인가? | 이 총괄 계획 |
| 각 주에 무엇을 학습·구현·검증하는가? | [12주 주차별 Roadmap](./weekly-roadmap.md) |
| WIL과 기술 블로그를 어떻게 작성하는가? | [학습 및 기술 콘텐츠 계획](./learning-and-content-plan.md) |
| 실제 주차별 결과와 변경은 무엇인가? | 각 `weekN`의 계획, 구현 Report와 WIL |
| 제품이 무엇을 제공해야 하는가? | 별도 제품 저장소의 `Requirements` |
| 제품을 어떤 구조로 구현하는가? | 별도 제품 저장소의 `Architecture` |
| Workflow·권한·평가 상세 기준은 무엇인가? | 별도 제품 저장소의 해당 설계 문서 |

두 저장소는 독립적으로 이동·공개될 수 있으므로 서로의 로컬 절대 경로나 상대 파일 경로를 참조하지 않는다. 교차 저장소 기준은 `저장소 이름 + 문서 제목`으로만 식별한다. 같은 저장소 안의 문서만 상대 링크를 사용한다.

제품 저장소의 기준 문서 제목은 다음과 같다.

- `Requirements`
- `Architecture`
- `Workflow Planning and Review`
- `Security and Governance`
- `Evaluation and Operations`

일정과 제품 설계가 충돌하면 기능을 임의로 구현하지 않는다. 제품 기준 문서를 먼저 검토하고 일정 변경이 필요하면 이 계획과 주차별 Roadmap에 이유와 Gate 영향을 기록한다.

---

## 2. 프로젝트 목표

AgentOps Lab의 장기 목표는 인간과 AI Agent가 함께 일하는 실제 회사의 업무, 권한, 승인, 실행, 지식, 협업과 운영을 관리하는 범용 회사 운영 Platform을 만드는 것이다.

특정 업종의 Workflow를 고정한 자동화 도구가 아니라 다음을 공통 Kernel로 제공한다.

- 회사 업무를 Work Item과 Version 관리 Workflow Plan으로 표현
- Human, Agent와 Service Actor의 책임과 Capability 구분
- AI 생성 계획의 시각적 검토, Revision, Diff와 Approval
- 실제 LLM·Tool·Connector 실행과 Side Effect 통제
- 입력, 계획, 승인, 실행, Artifact와 책임의 Audit·Provenance
- 서로 다른 Reference Application에서 같은 Kernel 계약 재사용

캐릭터 챗봇 회사는 제품 목표가 아니라 첫 번째 Reference Application이다. 두 번째 업무 유형으로 공통 Kernel의 범용성을 검증한다.

## 3. 현실적인 완성 수준

12주 안에 모든 기업과 규제 환경을 만족하는 범용 SaaS를 출시한다고 주장하지 않는다. 다음 경계의 Production Pilot을 목표로 한다.

- 한 개 Organization 또는 Workspace와 초대된 3~10명 규모 사용자
- 실제 LLM Provider, PostgreSQL과 최소 한 개의 실제 Side Effect Connector
- 인증·인가, Workflow 검토, 승인, Audit, 실패 처리, Backup·Restore와 관측
- 캐릭터 회사의 실제 End-to-End 흐름
- 두 번째 업무 유형의 Kernel 재사용 검증
- 구현 담당자가 설명·Test·수정하고 통제된 환경에서 운영할 수 있는 수준

대규모 Multi-tenancy, 고가용성, 규제 인증과 대규모 조직 운영은 후속 Release 목표로 유지한다.

## 4. 프로젝트 운영 전략

1. 1~6주차에는 실제 사용 가능한 R1 Production Pilot을 완성한다.
2. 7~8주차에는 R1 결함을 우선 해결한 뒤 위임, Approver Actor, 혼합 팀과 두 번째 업무를 확장한다.
3. 9~12주차에는 취업 활동을 우선하고 제한된 시간 안에서 Knowledge, Connector, 격리 Runner와 운영 복원력을 확장한다.
4. 일정 때문에 끝내지 못한 기능은 삭제하지 않고 사용자 문제, 책임 경계, 보안 요구와 Acceptance Criteria가 있는 후속 Release로 이동한다.

범위 조정은 제품 목표나 품질 기준을 낮추는 작업이 아니다. 한 시점에 병렬 구현하는 기능 수를 줄여 핵심 흐름을 먼저 운영 가능한 수준으로 만드는 작업이다.

## 5. Release 정의

| Release | 기간 | 목적 |
|---|---|---|
| R1 Production Pilot | 1~6주차 | Human Workflow 검토·승인과 실제 LLM·Database·Side Effect를 포함한 핵심 흐름 완성 |
| R2 Company Expansion | 7~8주차 | 정책 기반 위임, 저위험 Agent·Service Approval, 혼합 팀과 두 번째 업무 검증 |
| R3 Operational Expansion | 9~12주차 | 취업 활동과 병행하며 Knowledge 수명주기, Connector, 격리 Runner와 운영 복원력 확장 |
| 후속 Release | 과정 종료 후 | 규모·규제·고가용성·고급 Canvas와 전체 회사 운영 Capability 확장 |

R1 Gate를 통과하지 못하면 R2 기능보다 Blocker 해결을 우선한다. R2가 불안정하면 R3 기능 수를 줄이고 운영 품질을 복구한다.

## 6. Release별 핵심 범위

### R1 — 1~6주차

- Organization, Actor, Work Item과 Assignment
- AI Workflow Plan 생성, 읽기 전용 Graph·목록·상세
- 전체·Node별 Human 수정 지시, 새 Version과 의미 단위 Diff
- Human Plan Approval과 승인 Version 기반 업무 실행
- Agent Run, Capability, Tool Gateway와 Action Approval
- 실제 LLM, Knowledge·Citation과 실제 Side Effect Connector 한 개
- 캐릭터 Reference Application End-to-End
- 인증·인가, Audit, Security Test, 관측, Backup·Restore와 Pilot 사용자 검증

### R2 — 7~8주차

- Director Agent와 정책 기반 위임
- 저위험 Workflow 한 종류의 독립 Agent·Service Approver
- 자동화 자기 승인·Policy 자기 확장 차단과 Human 전환
- Template 기반 Agent Provisioning과 임시 Capability
- Human·Agent 혼합 Assignment, Handoff와 제한된 Collaboration
- 두 번째 Reference Application과 공통 Kernel 재사용 검증

### R3 — 9~12주차

- Knowledge 승인·승격·만료·폐기와 Rollback
- 제한된 Connector 동기화와 Reconciliation
- 격리 Coding Runner의 Trust Boundary와 제한 업무
- Queue, Lease, Idempotency, 장애 복구와 운영 안정화
- 취업 지원 100회, 면접 준비와 검증 근거 중심 Portfolio 완성

R1·R2·R3의 상세 기능 계약은 제품 저장소의 `Requirements`를 기준으로 한다.

---

## 7. 12주 Milestone 요약

| 주차 | Release | 핵심 Milestone | 주요 공개 근거 |
|---:|---|---|---|
| 1 | R1 | 제품 계약, Framework 결정과 Walking Skeleton | 비교 Spike, Architecture Baseline, 최초 E2E |
| 2 | R1 | Work·Identity·Workflow Planning Kernel | ERD, 상태·Graph Test, Transaction 실험 |
| 3 | R1 | Workflow Review·Revision·Approval과 Agent 실행 | Version Diff, 승인 우회·중복 실행 Test, Audit |
| 4 | R1 | 캐릭터 Reference Application Vertical Slice | Browser E2E, Module 경계와 사용자 Journey |
| 5 | R1 | Knowledge·평가·Security와 Pilot Feedback | Dataset, 평가·Security·사용성 Report |
| 6 | R1 | Production Pilot 배포와 운영 검증 | Release Gate, Dashboard, Backup·Restore 훈련 |
| 7 | R2 | Director 위임과 저위험 Agent·Service Approver | Policy, 자기 승인 공격 Test, Human 전환 Audit |
| 8 | R2 | 혼합 팀과 두 번째 업무 유형 | Kernel 재사용 Report, Handoff와 Generality Gate |
| 9 | R3 | Knowledge 수명주기와 Connector | Version 전후 평가와 접근 통제 Test |
| 10 | R3 | 격리 Coding Runner 기반 | Threat Model, 악성 입력과 Resource Limit Test |
| 11 | R3 | Runner 흐름과 운영 복원력 | 장애 주입, Reconciliation과 중복 방지 Test |
| 12 | R3 | 제품 안정화와 취업 목표 완료 | 전체 Gate, 사용자 Feedback, Portfolio와 Roadmap |

상세 학습, 구현, 산출물과 완료 조건은 [12주 주차별 Roadmap](./weekly-roadmap.md)에 있다.

---

## 8. 절대 줄이지 않는 것

- 실제 사용자 흐름
- 실제 PostgreSQL과 실제 LLM 호출
- 인증, Server-side 인가와 Organization 격리
- Workflow Plan Version, 시각적 검토, Human Revision·Diff·R1 Plan Approval
- 승인 Plan Version과 실행 Version의 일치
- Capability와 위험 Side Effect의 Action Approval
- Audit와 Artifact Provenance
- 실패 처리, Idempotency, Backup·Restore
- 핵심 자동 Test와 배포 관측
- 사용자 Feedback과 구현 담당자의 설명 가능성

이 항목을 Mock이나 문서만으로 대체하면 Production Pilot이 아니라 Demo다.

## 9. 먼저 줄이는 것

1. 같은 종류의 Provider·Connector 수
2. Character, 보조 화면과 Workflow 변형 수
3. Canvas Drag-and-drop, Layout 저장, 실시간 협업과 대형 Graph 편의 기능
4. 자동화 Policy 조합 수와 관리 화면 편의 기능
5. Meeting 참여 Agent 수와 복잡한 협업 방식
6. Runner가 허용하는 업무·Command 수
7. 대규모 부하, Multi-region과 고가용성

줄인 기능은 삭제하지 않고 목표 Release, 선행 조건과 Acceptance Criteria가 있는 Backlog로 유지한다.

## 10. 기능 이동 규칙

- R1 Gate 미통과 항목은 새 기능보다 항상 우선한다.
- 기능을 다음 Release로 이동할 때 이유, 위험, 선행 조건과 새 완료 시점을 기록한다.
- 부분 구현을 완료로 표시하지 않는다.
- UI에 노출된 기능은 실제로 동작하거나 명확히 비활성 상태여야 한다.
- 안전성을 입증하지 못한 Connector와 Runner는 Production에서 비활성으로 둔다.
- 후속 Release 이동은 목표 삭제가 아니라 검증 순서 변경이다.

---

## 11. 주차별 Gate

| Gate | 판단 질문 | 실패 시 행동 |
|---|---|---|
| 2주차 Kernel Gate | Work Item, Actor, Workflow Plan Version과 Organization 격리가 실제 DB에서 안전한가? | Agent 기능을 늦추고 Domain·DB·Graph 불변 조건 해결 |
| 4주차 Vertical Slice Gate | Human이 실제 LLM Plan을 시각적으로 검토·수정·승인하고 승인 Version대로 실행·게시할 수 있는가? | Knowledge·보조 UI 확장을 멈추고 핵심 흐름 복구 |
| 6주차 Production Gate | 배포, Security, 일관성, 복구, 관측과 Pilot 사용이 가능한가? | 7주차 대부분을 Release Blocker 해결에 사용 |
| 8주차 Generality Gate | 두 번째 업무가 공통 Kernel을 재사용하고 저위험 Agent·Service Approval이 Policy 안에서만 동작하는가? | 공통화·승인 통제 원인을 수정하고 R3 범위 축소 |
| 12주차 Evidence Gate | 직접 구현·검증한 범위와 한계를 근거로 설명할 수 있는가? | 과장된 표기를 제거하고 검증된 결과만 Portfolio에 사용 |

세부 Acceptance Criteria와 Test 방법은 제품 저장소의 `Requirements`와 `Evaluation and Operations`가 관리한다.

---

## 12. 학습과 공개 기록 원칙

- 구현 중심의 Just-in-time 학습을 사용한다.
- 학습은 설명, 작은 실험, 제품 적용, Test와 운영 관측으로 검증한다.
- 설명하거나 수정하거나 Test할 수 없는 AI 생성 코드는 완료로 인정하지 않는다.
- 매주 WIL을 작성하고 검증 자료가 준비된 장문 기술 글 6편 이상을 게시한다.
- 시스템 개선을 주장하는 변경이 있을 때만 비교 가능한 조건의 전·후 수치를 기록한다.
- 사전 완전 자동화 Prototype은 12주 학습·제품 성과로 계산하지 않는다.
- 공개 문서는 대화 Context, Secret, 개인정보, 내부 URL과 로컬 경로 없이 이해할 수 있어야 한다.

상세 원칙과 12주 콘텐츠 Backlog는 [학습 및 기술 콘텐츠 계획](./learning-and-content-plan.md)에 있다.

## 13. 운영 Rhythm 요약

### 기술 심화 1~8주

- 매일 오전 10시 전 Daily Scrum과 Board 갱신
- 첫 Core Time 1시간에 가장 큰 기술 위험 해결
- 오전 개념·Spike, 오후 Vertical Slice·Test·Review
- 매주 Dataset 회귀, 사용자 시연 또는 팀 Review
- 월요일 전주 WIL 게시

### 취업 심화 9~12주

- 오전 공고 분석·맞춤 지원 우선
- 매일 Java Coding Test 또는 기술 면접 준비
- 제품 구현은 주 6~8시간 상한
- 긴급 Production 결함이 아니면 지원·면접 시간을 침해하지 않음

---

## 14. 주요 프로젝트 위험

| 위험 | 조기 신호 | 대응 |
|---|---|---|
| Platform과 Reference 기능 과다 병렬 구현 | 여러 Module이 시작됐지만 E2E 없음 | R1 한 흐름과 Gate 우선 |
| AI 생성 코드가 이해 범위를 넘음 | 변경 이유·Test 실패를 설명하지 못함 | 변경 축소, 직접 Trace, 핵심 재작성 |
| Java·Spring 학습 부족 | Annotation으로만 해결하고 Transaction·Security를 모름 | 작은 Spike와 제품 Test로 재현 |
| Framework 비교 장기화 | 1주차 후에도 복수 Framework 유지 | 이틀 뒤 하나 선택하고 Adapter 계약만 유지 |
| Character 기능이 제품 목표를 대체 | 공통 Module에 업종 조건문 증가 | Reference Module 격리와 두 번째 업무 검증 |
| 기능 수와 Production 품질 교환 | Mock·수동 DB 수정·승인 우회가 필요 | R1 필수 조건 보호와 기능 이동 |
| 사용자 확보 실패 | 5주차까지 개발자 단독 Test | 3주차부터 Pilot 일정 확보 |
| 문서와 구현 불일치 | 완료 표시 기능이 배포에서 실패 | Release마다 Test, Gate와 상태 갱신 |
| 취업 일정 충돌 | 지원 수가 밀리고 구현 시간이 증가 | 주간 상한과 작은 Slice 유지 |

시스템 보안·일관성·운영 위험은 제품 저장소의 전문 설계 문서가 관리한다.

---

## 15. 12주 최종 산출물

### 제품

- 실제 배포된 AgentOps Lab Production Pilot
- 캐릭터 회사와 두 번째 Reference Application
- 시각적 Workflow Review·Revision·Diff·Approval
- 실제 LLM Provider와 실제 Connector
- Capability, Approval, Audit, 평가와 운영 Dashboard
- 검증된 범위의 위임, 혼합 팀, Knowledge와 Runner 기능

### Engineering 근거

- Requirements, Architecture와 전문 설계 문서
- API, 상태 Machine, ERD와 Migration
- Threat Model, 권한·Approval Policy와 Security Test
- 평가 Dataset·Report, 성능·비용 Baseline
- 배포, Backup·Restore, Incident와 Rollback Runbook
- 중요한 Decision과 Release별 구현 상태

### 학습·Portfolio

- 12주 WIL과 장문 기술 글 6편 이상
- 실험, Test, Metric, 사용자 Feedback과 운영 근거
- Java·Spring·Database·Web·Security·AI Agent 면접 자료
- 시연 영상과 재현 가능한 실행 안내
- 사전 Prototype과 직접 구현 범위를 구분한 기여 설명

### 취업

- AI/AX·Java Backend 이력서
- 공고 분석과 맞춤 지원 누적 100회
- Coding Test 오답과 모의 면접 결과
- 지원 결과 분석과 다음 실행 계획

## 16. 최종 성공 기준

다음 질문에 근거를 가지고 답할 수 있어야 한다.

1. 실제 사용자가 회사 업무를 Work Item으로 등록하고 Human 또는 Agent에게 맡길 수 있는가?
2. Human이 AI Workflow를 시각적으로 이해하고 수정·비교·승인할 수 있는가?
3. 실행과 결과가 Policy상 허용된 Approver Actor가 승인한 정확한 Plan Version에 연결되는가?
4. AI 행동이 Capability와 Approval 범위 안에서만 실행되는가?
5. 실패, 중복 요청과 재시작에도 업무와 Side Effect가 일관적인가?
6. 결과를 Plan, 입력, Knowledge, Model, Tool, Approval과 Actor까지 추적할 수 있는가?
7. 운영자가 배포, 관측, Backup, Restore와 장애 대응을 수행할 수 있는가?
8. Character가 한 사례일 뿐이고 다른 업무가 같은 Kernel을 재사용하는가?
9. 미구현 Capability가 책임 경계와 Acceptance Criteria가 있는 후속 Release로 남아 있는가?
10. AI 작성 부분을 포함한 핵심 코드를 구현 담당자가 설명·Test·수정·운영할 수 있는가?
11. 12주 동안 직접 수행한 판단과 검증을 공개 근거로 제시할 수 있는가?
12. 취업 지원 100회와 기술 면접 준비를 함께 완료했는가?

이 기준을 만족하면 결과는 Toy Project가 아니라 범용 회사 운영 제품으로 확장할 수 있는 구조와 실제 운영 증거를 갖춘 Production Pilot이다.

---

## 관련 계획 문서

- [12주 주차별 Roadmap](./weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](./learning-and-content-plan.md)
- [계획 문서 안내](./README.md)
- [초기 심화과정 학습 계획](./archive/2026-07-29-initial-advanced-track-plan.md)
