# AgentOps Lab 학습 및 기술 콘텐츠 계획

> 작성일: 2026-08-18  
> 상태: Active  
> 대상 기간: 기술 심화 8주 + 취업 심화 4주

이 문서는 AgentOps Lab 제품 개발과 동시에 수행할 학습, WIL, 기술 블로그와 공개 근거 관리 원칙을 정의한다. 제품 일정과 Release Gate는 `AgentOps Lab 12주 학습 및 구현 계획`, 주차별 활동은 `AgentOps Lab 12주 주차별 Roadmap`을 따른다.

제품 요구사항과 시스템 설계는 별도 AgentOps Lab 제품 저장소가 관리한다. 저장소 사이에는 파일 경로를 사용하지 않고 저장소 이름과 문서 제목으로만 기준 문서를 식별한다.

## 1. 학습 목표

목표는 Tutorial을 많이 완료하는 것이 아니라 실제 제품 문제를 이해하고 직접 수정·검증·운영할 수 있는 능력을 만드는 것이다.

- Java·Spring·Database의 상태, Transaction과 동시성 원리를 설명한다.
- Web 요청, 인증·인가와 Browser Security 경계를 이해한다.
- LLM·Agent Framework와 업무 Domain 상태의 책임을 분리한다.
- Capability, Approval, Audit와 격리 실행의 보안 원리를 제품 Test로 검증한다.
- Test, Dataset, Query Plan, Trace와 사용자 행동으로 기술 판단을 평가한다.
- AI가 생성한 코드도 구현 담당자가 설명하고 작은 변경을 직접 수행한다.

## 2. 학습 방식

Top-down과 Just-in-time 학습을 사용한다.

1. 이번 주 Vertical Slice와 가장 큰 기술 위험을 정한다.
2. 구현에 필요한 개념을 목록화하고 공식 문서와 작은 Spike로 확인한다.
3. 가장 작은 사용자 흐름에 개념을 적용한다.
4. 정상·실패 경로를 Test, Metric 또는 사용자 행동으로 검증한다.
5. 선택, 실패, 한계와 다음 실험을 WIL과 관련 문서에 남긴다.

단순 강의 수강, Tutorial 복사와 AI 응답 저장은 학습 완료가 아니다. 개념을 설명하고 제품에 적용하며 실패 원인을 찾을 수 있어야 한다.

## 3. 심화과정 학습 주제 선정과 추적

심화과정에서 권장하는 모든 주제를 독립된 예제 Project로 구현하지 않는다. AgentOps Lab의 사용자 흐름, 기술 위험과 운영 문제를 실습 환경으로 사용하고, 각 주제를 다음 상태 중 하나로 관리한다.

| 상태 | 의미 | 완료 근거 |
|---|---|---|
| 제품 적용 | 현재 Release에 필요한 개념을 실제 기능과 운영 경로에 적용 | 동작하는 Vertical Slice, 자동 Test와 운영 관측 |
| 검증 Spike | 제품 선택 전에 작은 재현 실험으로 원리와 Trade-off 확인 | 질문, 조건, 결과와 선택을 담은 Experiment Note |
| 운영 실습 | Source Control, CI/CD와 장애 대응처럼 개발·운영 과정에서 학습 | 변경 이력, Review, 실행 결과와 회고 |
| 조건부 후속 | 실제 요구나 측정 결과가 선행 조건을 충족할 때 수행 | 선행 조건, 보류 이유와 재검토 시점 |
| 선정 제외 | 12주 목표와 직접 관련이 없거나 대체 기술을 선택 | 제외 이유와 영향 기록 |

주차 시작 시 해당 주제의 적용 방식과 검증 근거를 `weekly-plan`의 학습 계획에 확정한다. 구현 중 필요성이 바뀌면 학습 범위를 조용히 추가하지 않고 WIL에 상태 변경, 이유와 일정 영향을 기록한다.

| 과정 영역 | 12주 선택 범위 | 제품 적용·실험 | WIL·기술 콘텐츠 근거 | 조건부 후속·경계 |
|---|---|---|---|---|
| Git·협업 | Staging Model, Branch, Merge·Rebase, Conflict 해결, PR·Review, Reset·Revert, Commit Convention과 GitHub Actions | **운영 실습, 1~12주:** 실제 변경을 작은 Commit과 검토 가능한 단위로 관리하고 CI 실패·복구를 경험 | PR 또는 Review 기록, CI 결과, 충돌·복구가 발생한 주의 WIL과 짧은 Learning Note | Stash·Cherry-pick과 이력 변경 Reset은 실제 필요 또는 안전한 Spike로 확인하며 이력 재작성 자체를 성과로 세지 않음 |
| Web 기본 | HTTP 의미·Version, REST API, Cookie·Session·Web Storage, CORS, Cache, DNS와 HTTPS/TLS | **제품 적용, 1·4·6주:** Browser–API 요청, 인증 Cookie, 저장 위치, Header·Cache 정책과 실제 Domain 연결 검증 | Request Trace, Header·보안 Test, Browser E2E와 Production Pilot 글 | TCP·UDP, CDN은 배포 선택을 설명하는 Spike; WebSocket은 Polling으로 요구를 충족하지 못한다는 근거가 생길 때 후속 적용 |
| Frontend | Semantic HTML, CSS, 접근성, Browser Rendering, Scope·Closure·Hoisting, Event Loop, Promise·Async, Event Bubbling·Delegation, Debounce·Throttle와 Client State | **제품 적용·Spike, 4~5주:** JavaScript 실행 원리는 작은 재현과 Code Review로 확인하고 Workflow Graph 검토, Form, 비동기 상태와 반복 입력 처리에 적용 | 접근성 점검, 사용자 Journey, UI 오류·로딩 Test와 사용성 관찰 | CSR·SSR, Virtual DOM, 상태 Library와 Bundler 세부는 선택한 Client Architecture에 필요한 범위만 학습 |
| Backend | MVC·Layered Architecture, DI·IoC, Middleware, REST API·전역 오류 처리, 동기·Queue 경계, 동시성, Idempotency와 비동기 복구 | **제품 적용, 1~3·11주:** Domain 상태, Agent Run, Tool 실행과 복구 흐름에 적용 | Layer Trace, 상태 전이 Test, 중복 Delivery·부분 실패 실험과 관련 기술 글 | AOP는 관측·Transaction 등 횡단 관심사의 책임이 명확할 때만 사용하고 Cache, Load Balancing, GraphQL과 Batch는 측정된 병목이나 사용자 요구가 생길 때 후속 검토 |
| Database | 정규화, RDB·NoSQL 선택, Join, ACID·Isolation, Transaction, Index·실행 계획, Lock·Deadlock, N+1과 Connection Pool | **제품 적용·Spike, 1~2·5주:** PostgreSQL 선택 근거를 확인하고 Version 불변성, Organization 격리, 동시 승인과 조회 성능에 적용 | ERD, 실제 PostgreSQL Test, Query Plan과 변경 전·후 측정 | Replication·Sharding은 Capacity Baseline이 단일 Database 한계를 보일 때 후속 검토 |
| 객체지향 설계 | Encapsulation·Abstraction·Inheritance·Polymorphism, SOLID, Inheritance보다 Composition, 필요한 Design Pattern | **제품 적용, 1~3·7주:** Aggregate와 Port·Adapter, Policy와 Actor 책임 분리에 적용 | Module 의존성, Domain Test와 선택 근거 | Pattern 수 자체를 학습 성과로 삼지 않고 문제를 단순하게 만드는 경우에만 도입 |
| Test·품질 | Unit·Integration·E2E, Testcontainers, 회귀 Test, 정적 분석, Lint와 Coverage 해석 | **제품 적용, 1~12주:** 위험별 Test Pyramid와 Release Check 구성 | 실패 재현 Test, CI 결과, Browser E2E와 Release Gate | TDD는 Domain 규칙과 결함 재현에 선택적으로 사용하고 Coverage 수치만으로 완료를 판단하지 않음 |
| 인증·보안 | 인증과 인가, Session, Password Hashing, HTTPS, XSS·CSRF·SQL Injection, Rate Limit, Secret 관리와 최소 권한 | **제품 적용, 1~7주:** Organization 경계, Capability, Approval, Browser·Tool 보안에 적용 | Threat Model, 공격·권한 우회 Test, Audit와 운영 설정 점검 | JWT·Refresh Token·OAuth2·분산 Session·File Upload 보안은 실제 인증·배포·입력 요구가 생길 때 선택하며 Session 방식과 중복 구현하지 않음 |
| AI Native | Prompting, Structured Output, Tool Calling, LLM Evaluation, RAG, Citation과 Prompt Injection 방어 | **제품 적용, 1~5·9주:** Planner·Reviewer·Knowledge 흐름과 고정 Dataset 평가에 적용 | Prompt·Model·Dataset Version, 회귀 평가, 실패 Case와 관련 기술 글 | LoRA와 VLM은 제품 품질·비용 또는 Multimodal 요구가 확인되지 않는 한 12주 선정 제외 |
| DevOps·Cloud | Docker, GitHub Actions 기반 CI/CD, 환경·Secret 분리, 관측, 배포, Backup·Restore와 Rollback | **제품 적용, 1·6·12주:** 실제 Pilot 환경과 Release Gate에 적용 | Pipeline 결과, Dashboard, 복구 훈련, Runbook과 Production Pilot 글 | 실제 배포 Provider의 IAM·DNS·Container·Database Service만 선택; Jenkins, Orchestration, Terraform, Auto Scaling, WAF와 무중단 배포는 팀·트래픽·복구 요구가 선행될 때 후속 검토 |
| System Programming | Linux CLI·Log 분석, Process·Signal, `/proc`, Resource Limit와 종료 처리 | **제품 적용·Spike, 6·10~11주:** 서비스 종료와 Coding Runner 관측·격리 검증에 적용 | Process Tree, Signal·잔여 Process Test, Resource 사용량과 Runner Threat Model | IPC는 Runner 구조에 필요할 때 적용하고 Mini Shell·Mini VM 자체 구현은 제품 목표와 직접 연결되지 않아 선정 제외 |

이 Matrix는 학습 항목을 늘리기 위한 Checklist가 아니다. 제품에 적용하지 않은 주제도 작은 Spike, 조건부 후속 또는 선정 제외의 근거가 명확하면 정상적인 학습 판단으로 인정한다.

## 4. 권장 시간 배분

| 기간 | 학습·Spike | 제품 구현·검증 | 운영 기준 |
|---|---:|---:|---|
| 1주차 | 50% | 50% | Architecture와 기술 선택의 불확실성 제거 |
| 2주차 | 35% | 65% | Java·Spring·DB 개념을 Domain 구현과 함께 학습 |
| 3~4주차 | 25% | 75% | Workflow, 권한, 승인과 Reference 흐름 완성 |
| 5~6주차 | 20% | 80% | 평가, Security, 성능, 배포와 사용자 검증 |
| 7~8주차 | 15% | 85% | 검증된 Kernel 위에 회사 운영 범위 확장 |
| 9~12주차 | 취업 활동 우선 | 주 6~8시간 한도 | 지원·면접을 침해하지 않는 작은 Slice만 수행 |

비율은 목표가 아니라 과도한 선행 학습이나 기능 확장을 감지하는 상한으로 사용한다.

## 5. AI 활용 원칙

- AI에게 구현을 요청하기 전에 문제, Acceptance Criteria와 변경 범위를 작성한다.
- 조사·선택지 발굴, Test Case 제안, 초안과 반복 작업에는 적극적으로 활용한다.
- Architecture, 보안 정책, 데이터 보존과 Release 판단은 근거를 검토한 사람이 책임진다.
- 큰 변경은 작은 Diff로 나누고 각 단계에서 Test와 동작을 확인한다.
- 생성된 코드의 Layer 책임, Transaction, 권한과 실패 처리를 직접 Trace한다.
- 설명하거나 수정하거나 검증할 수 없는 생성 코드는 완료로 인정하지 않는다.
- AI가 보조한 부분과 구현 담당자가 판단·수정한 부분을 공개 기록에서 구분한다.

## 6. 사전 자동화 실험 처리

본 과정 전에 수행한 완전 자동화 Prototype은 AI 코딩 에이전트의 가능성과 한계를 알아보기 위한 별도 실험이다.

- 사전 Prototype의 코드, Commit, Test와 ADR은 12주 성과에 포함하지 않는다.
- 코드를 새 제품에 그대로 복사하지 않는다.
- 확인된 실패는 위험 가설과 검증 질문으로만 사용한다.
- 같은 기능도 요구사항, 설계, 구현, Test와 운영 검증을 새로 수행해야 성과로 인정한다.
- Portfolio와 기술 글에서 사전 실험과 직접 구현 결과를 명확히 구분한다.

## 7. WIL과 기술 블로그의 역할

| 기록 | 대상 독자 | 목적 | 주요 내용 |
|---|---|---|---|
| 주간 WIL | 학습 과정과 진행 상황에 관심 있는 독자 | 한 주의 문제, 판단, 실패와 다음 실험 기록 | 계획 대비 결과, 학습, Blocker, AI 활용, 시스템 변화와 다음 주 판단 |
| 기술 블로그 | 같은 문제를 해결하는 개발자와 채용 담당자 | 재사용 가능한 기술 지식과 검증 결과 공유 | 문제, 대안, 원리, 실험, Test, 운영 결과, 한계와 재현 방법 |
| 제품 문서 | 사용자와 유지보수 개발자 | 제품 사용과 운영의 기준 제공 | Requirements, Architecture, Security, 운영과 Release 상태 |

주간 진행 내용을 그대로 기술 블로그로 옮기지 않는다. WIL은 시간순 학습과 판단을 보존하고 기술 블로그는 독자가 재사용할 수 있는 하나의 문제 해결 과정으로 재구성한다.

## 8. 시스템 개선 수치 기록

해당 주의 변경으로 시스템의 성능, 비용, 품질, 안정성 또는 사용성이 개선됐다고 판단한 경우에만 비교 가능한 조건의 변경 전·후 수치를 WIL에 요약한다.

- 가능한 한 같은 환경, 입력, Dataset과 설정에서 전·후를 측정한다.
- 절대값, 단위, 표본 수, 반복 횟수와 측정 조건을 함께 제시한다.
- 변화율만 단독으로 제시하지 않는다.
- 개선되지 않았거나 다른 지표가 악화된 Trade-off도 숨기지 않는다.
- 작은 사용자 표본은 백분율만 쓰지 않고 참가자 수와 원자료를 함께 표시한다.
- 상세 환경, 원본 결과와 한계는 Experiment Report 또는 기술 블로그에 기록한다.
- 개선 주장이 없는 주에는 정량 결과를 억지로 만들지 않는다.

## 9. 기술 블로그 작성 원칙

기술 블로그는 다음 구조를 기본으로 한다.

1. 해결하려는 실제 사용자·운영 문제
2. 독자가 알아야 할 최소 배경
3. 검토한 대안과 선택 기준
4. 재현 가능한 작은 실험과 관찰 결과
5. 제품에 적용한 책임 경계와 핵심 구현
6. 실패 Case와 자동 Test
7. 관련 있는 경우 성능·비용·품질·보안·운영 측정
8. 현재 방식의 한계와 다음 검증
9. 재현 방법과 공식·원본 자료

다음 공개 기준을 적용한다.

- 실제 측정 없이 시스템 향상을 단정하지 않는다.
- 코드 일부를 제시할 때 실행 Context와 실패 조건을 함께 설명한다.
- Screenshot만 근거로 사용하지 않고 Test, Dataset, Query Plan, Trace 또는 Metric을 연결한다.
- 작은 Dataset과 통제 환경의 결과를 일반화하지 않는다.
- 완료되지 않은 기능은 성공 사례가 아니라 실험·설계 초안으로 표시한다.
- AI 초안의 사실, 코드, Version과 출처를 다시 확인한다.
- 공개 후 발견한 오류는 변경 이력과 함께 수정한다.
- Secret, 개인정보, 비공개 대화, 내부 URL과 로컬 경로를 게시하지 않는다.

## 10. 12주 기술 콘텐츠 Backlog

매주 WIL을 작성하고 아래 주제의 Note와 공개 근거를 축적한다. 장문 기술 글은 검증 근거가 준비된 주제 중 6편 이상 게시하고, 나머지는 검증 전 초안이나 후속 연재로 유지한다.

| 주차 | 제품 Milestone | 연계 학습 개념 | 핵심 학습 질문 | 기술 블로그 가제 | 공개 근거 |
|---:|---|---|---|---|---|
| 1 | Walking Skeleton·Workflow 계약 | Layered Architecture·DI/IoC, HTTP·Session·CORS, Git·CI, Structured Output | Framework, Plan과 업무 상태의 책임은 어떻게 나뉘는가? | Agent Framework를 업무·계획 상태의 기준으로 두지 않은 이유 | 비교 Spike, Request Trace, CI, Plan Schema와 Sequence |
| 2 | Work·Identity·Planning Kernel | Aggregate·Composition, ACID·Isolation·Lock·Index, 인증·인가, Unit·Integration Test | Version과 Transaction은 계획 불변 조건을 어떻게 지키는가? | AI Workflow를 Version 관리 Domain으로 다루기 | ERD, Graph Test, Diff, PostgreSQL 동시성·Query Plan 실험 |
| 3 | 계획 검토·실행·승인 | Queue·Retry·Idempotency, RBAC·Capability, Prompt Injection 방어 | 계획 수정과 실행 Side Effect를 어떻게 분리해 통제하는가? | Human Plan Approval과 Agent Run 중단·재개 | 승인 우회 Test, Audit, 중복 실행과 악성 Tool 입력 결과 |
| 4 | Character Reference | Semantic HTML·접근성, Event Loop·Async·Event Delegation, Client State와 Content 보안 | 업종 기능과 공통 Kernel을 어떻게 분리하는가? | 시각적 Workflow 검토를 포함한 Reference Application | Module 의존성, Browser E2E, 접근성·비동기 상태 Test |
| 5 | Knowledge·평가·Security | RAG·Citation·LLM 평가, XSS·CSRF·SQL Injection·Rate Limit, N+1·Pool·Query Plan | LLM 품질을 어떻게 재현 가능하게 측정하는가? | 평가 Case로 RAG·Citation·Prompt Injection 검증하기 | Dataset, Security·평가 Report, Query Plan과 실패 사례 |
| 6 | Production Pilot | Docker·Process·Signal, DNS·TLS·Secret, CI/CD·관측, Backup·Restore | Demo와 운영 가능한 Pilot의 차이는 무엇인가? | AI Agent Demo를 Production Pilot로 전환하며 검증한 것 | Release Checklist, Header·Metric, Pipeline과 복구 훈련 |
| 7 | 위임·Approver Actor | 최소 권한·책임 분리, Policy·Composition, 공격 Test | Agent 승인이 자기 승인·권한 상승이 되지 않게 하려면? | 위험 기반 Agent Approver와 Director 위임 상한 | Policy, 권한 상승 공격 Test와 Human 전환 Audit |
| 8 | 혼합 팀·두 번째 업무 | Queue·Ownership·Handoff, 공통 계약과 E2E 회귀 | 공통 Kernel의 범용성을 어떻게 증명하는가? | 두 회사 Workflow로 검증한 Human·AI 운영 Kernel | 재사용 비교, Handoff 기록과 두 Workflow E2E |
| 9 | Knowledge 수명주기 | Version·Rollback, Connector 동기화, 고정 Dataset 회귀 평가 | 검색 이후 지식 승인·Version·폐기를 어떻게 운영하는가? | Knowledge Promotion과 Rollback | Version 전후 평가, 접근 통제와 동기화 Test |
| 10 | 격리 Runner 기반 | Linux Process·Signal·`/proc`, Filesystem·Network와 Resource Limit | AI 생성 코드를 어디까지 안전하게 실행하는가? | Coding Runner Sandbox와 최소 권한 Threat Model | 격리 구조, Process Tree, 악성 입력과 Resource Limit |
| 11 | Runner·복원력 | Queue·Lease·Heartbeat, Idempotency·Reconciliation, 장애 관측 | At-least-once 실행의 외부 중복을 어떻게 막는가? | Agent Run Idempotency와 Reconciliation | 장애 주입, Trace, 중복 방지와 Resource Metric |
| 12 | 안정화·회고 | 회귀·E2E·정적 분석, 성능·비용 Baseline, 복구와 Release 운영 | 어떤 근거로 결과를 제품이라고 부를 수 있는가? | 범용 회사 운영 Platform Production Pilot 회고 | Gate, CI, 사용자 Feedback, 운영 수치, 한계와 Roadmap |

기술 글은 관련 Acceptance Criteria와 Test가 준비된 후 게시한다. 일정이 지연된 주제는 억지로 게시하지 않고 검증 전 초안으로 유지한다.

## 11. 제품 개발과 콘텐츠 발행 Workflow

1. Feature Issue를 만들 때 연결할 콘텐츠 질문과 필요한 근거를 정한다.
2. 설계 중 대안, Decision과 Diagram을 축적한다.
3. 구현 중 성공 화면보다 실패 Case, Test와 관측 자료를 우선 수집한다.
4. Feature Gate 통과 후 글의 결론과 공개 가능한 근거를 확정한다.
5. 초안의 기술 정확성, 재현성, 공개 적합성과 문장 품질을 별도로 검토한다.
6. 게시한 글에 관련 공개 Code, Test, Dataset 또는 Report를 연결한다.
7. 제품 변경으로 글이 오래되면 Version과 수정 일자를 표시한다.

4주차부터 기술 콘텐츠 제작 자체도 Work Item으로 등록한다. 기획, 초안, 기술 검수, 승인과 게시를 제품의 실제 업무 흐름으로 실행한다.

## 12. 인정되는 학습 증거

- 문제와 반증 가능한 가설이 있는 작은 Spike
- 구현 담당자가 작성·검토한 설계와 Decision Log
- 실패를 재현하고 원인을 설명하는 Test
- 실제 Query Plan, Trace, Metric과 장애 분석
- 사용자 Feedback에서 시작된 개선 Issue와 결과
- 직접 설명한 Code Review 기록
- 문제, 선택, 실패와 다음 실험을 담은 WIL

Tutorial 완료, AI 대화 기록, 생성 코드량과 Test 개수는 그 자체로 학습 증거가 아니다.

## 13. 주간 WIL 질문

매주 WIL은 다음 질문에 답한다.

1. 이번 주 실제 사용자 문제는 무엇이었는가?
2. 어떤 개념이 부족했고 무엇을 학습했는가?
3. 선택지와 Trade-off는 무엇이었는가?
4. 어떤 Test, Metric 또는 사용자 행동으로 검증했는가?
5. 시스템 개선을 주장한 변경이 있다면 비교 조건의 전·후 수치와 Trade-off는 무엇인가?
6. 실패하거나 예상과 달랐던 점은 무엇인가?
7. AI가 수행한 일과 구현 담당자가 판단·수정한 일은 무엇인가?
8. 다음 주 가장 큰 위험 한 가지는 무엇인가?

5번은 모든 주에 수치를 강제하지 않는다. 관련 개선을 주장할 때만 기록하고 그 외에는 생략한다.

## 14. 운영 Rhythm

### 기술 심화 1~8주

- 매일 오전 10시 전: 전날 결과, 오늘의 핵심 목표와 Blocker 갱신
- 첫 Core Time 1시간: 가장 큰 기술 위험 또는 Blocker 해결
- 오전: 필요한 개념과 작은 Spike
- 오후: 한 개 Vertical Slice, Test와 Review
- 종료 전: 동작 확인, 작은 Commit과 Decision·Issue 갱신
- 주 1회: Dataset 회귀와 운영 지표 점검
- 주 1회: 사용자 시연 또는 팀 Review
- 월요일: 전주 WIL 게시

### 취업 심화 9~12주

- 오전 우선: 공고 분석, 맞춤 지원과 후속 연락
- 매일 60~90분: Java Coding Test 또는 기술 면접
- 주 4회 60~90분 또는 주말 3시간: Project 확장·운영 Block
- 긴급 Production 결함이 아니면 지원·면접 시간을 침해하지 않는다.
- 지원 활동과 제품 작업을 같은 Board의 별도 Lane으로 추적한다.

## 15. 공개 Definition of Done

- 일반 독자가 대화 Context 없이 문서를 이해할 수 있다.
- 구현·부분 구현·미구현 범위를 구분했다.
- Test, Dataset, Metric, Trace 또는 사용자 검증 근거가 있다.
- 측정하지 않은 성능·품질 향상을 주장하지 않는다.
- 실패, 한계와 다음 검증을 포함한다.
- AI 활용과 구현 담당자의 판단·수정을 구분한다.
- Secret, 개인정보, 내부 URL과 로컬 경로가 없다.
- 상대 링크는 같은 저장소 안에서만 사용하고 실제 대상을 가리킨다.
- UTF-8과 저장소의 줄바꿈 규칙을 지킨다.
