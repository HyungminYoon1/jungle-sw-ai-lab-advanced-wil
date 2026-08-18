# AgentOps Lab 12주 주차별 Roadmap

> 작성일: 2026-08-18  
> 상태: Active  
> 전체 기간: 기술 심화 8주 + 취업 심화 4주  
> 대상 Release: R1 Production Pilot, R2 Company Expansion, R3 Operational Expansion

이 문서는 AgentOps Lab의 주차별 학습, 구현, 검증과 공개 산출물을 정의한다. Release 목표와 Gate는 `AgentOps Lab 12주 학습 및 구현 계획`을 따르고, 학습·WIL·기술 블로그 작성 방법은 `AgentOps Lab 학습 및 기술 콘텐츠 계획`을 따른다.

제품 요구사항과 시스템 설계는 별도 AgentOps Lab 제품 저장소의 `Requirements`, `Architecture`, `Workflow Planning and Review`, `Security and Governance`, `Evaluation and Operations` 문서가 관리한다. 저장소가 다르므로 이 문서에서는 제품 문서의 파일 경로를 사용하지 않고 문서 제목으로만 식별한다.

## Roadmap 운영 원칙

- 1~6주차에는 실제 사용자, LLM, PostgreSQL과 Side Effect를 사용하는 R1 Production Pilot을 완성한다.
- 7~8주차에는 R1 결함을 우선 해결한 뒤 위임, Approver Actor, 혼합 팀과 두 번째 업무 유형을 검증한다.
- 9~12주차에는 취업 활동을 우선하고 주 6~8시간 안에서 Knowledge, Connector, 격리 Runner와 운영 복원력을 확장한다.
- Gate를 통과하지 못하면 다음 기능보다 실패 원인 해결을 우선한다.
- 부분 구현을 완료로 표시하지 않고 뒤 Release로 이동한 범위와 선행 조건을 기록한다.
- 매주 공개 결과는 해당 `weekN` 디렉터리의 계획, 구현 Report, WIL과 검증 자료에 남긴다.
- 각 주차의 `심화과정 연계`는 권장 학습 주제를 제품 적용, 검증 Spike 또는 운영 실습으로 연결한 것이다. 모든 주제를 기능으로 구현하지 않으며 조건부 후속과 선정 제외 기준은 학습 및 기술 콘텐츠 계획을 따른다.

## 1주차 — 제품 계약, Web·Spring 기초와 Walking Skeleton

### 핵심 목표

제품 경계와 R1 계약을 문서화하고 Browser 또는 API부터 PostgreSQL과 실제 LLM까지 이어지는 가장 작은 실행 흐름을 만든다.

### 학습

- Java 객체·불변성, Exception과 Collection
- Spring Boot 요청 처리, DI·IoC와 Controller·Service·Repository 책임
- HTTP, Cookie·Session, CORS와 CSRF
- PostgreSQL Transaction과 Flyway
- LLM Structured Output, Tool Calling과 Agent 실행 상태
- DAG, Node·Edge, 변경 불가능한 Version과 Read Model Projection
- Spring AI와 Google ADK Java의 핵심 시나리오 비교

### 심화과정 연계

- **제품 적용:** Layered Architecture·DI/IoC, HTTP·Cookie·Session·CORS·CSRF, PostgreSQL Transaction과 LLM Structured Output을 Walking Skeleton에서 함께 검증한다.
- **운영 실습·공개 근거:** Staging·Branch·PR·Commit Convention과 GitHub Actions를 실제 저장소 운영에 적용하고 Request Trace, CI 결과와 Framework 비교 Spike를 WIL·기술 Note에 남긴다.

### 구현·검증

- 사용자, 운영 경계, 성공 기준과 R1 Acceptance Criteria 초안
- Context Map, Module 책임과 핵심 Domain 용어 초안
- Workflow Plan Schema, Graph 불변 조건과 Plan·Action Approval 경계 정의
- 읽기 전용 Workflow Graph·목록·상세 Panel UI Spike
- Build, CI, Code Style, Test와 Migration 기반 구성
- Browser 또는 API → Spring → PostgreSQL Walking Skeleton
- 실제 LLM Provider 최소 호출과 실패·Timeout 저장
- Organization, User, Actor와 Work Item 최초 Migration
- Framework 비교를 이틀 안에 종료하고 선택 근거 기록

### 산출물

- Requirements·Architecture 1차 Baseline
- Framework 선택 기록과 비교 Spike
- Workflow Plan Schema·시각화 Spike
- 실행 가능한 Walking Skeleton
- 평가 Dataset 형식과 최초 5개 Case
- 1주차 WIL과 과정 제출

### 완료 조건

- 새 환경에서 사용자가 Work Item을 저장하고 다시 조회할 수 있다.
- 실제 LLM 실패와 Timeout이 성공으로 표시되지 않는다.
- 대표 Workflow의 Node, Edge, 담당자, Tool과 승인 지점을 구분할 수 있다.
- 각 Layer의 책임과 Framework 선택 이유를 구현 담당자가 설명할 수 있다.

## 2주차 — 회사 운영·Workflow Planning Kernel

### 핵심 목표

Organization, Actor, Work Item과 변경 불가능한 Workflow Plan Version을 실제 PostgreSQL 위에 구현한다.

### 학습

- Aggregate, Entity, Value Object와 상태 Machine
- Spring Security 인증·인가와 Method Security
- JPA 영속성 Context, Transaction, Lock과 N+1
- PostgreSQL Constraint, Index와 실행 계획
- Versioned Aggregate, Snapshot, Read Model과 Diff
- Unit Test와 Testcontainers의 책임

### 심화과정 연계

- **제품 적용:** 객체지향 Composition·SOLID, 인증과 인가, ACID·Isolation·Lock·N+1·Index를 Version 불변성과 Organization 격리에 적용한다.
- **검증·공개 근거:** 실제 PostgreSQL 동시성 Test, Query Plan, Domain Unit Test와 Integration Test를 2주차 WIL과 Version 관리 기술 글의 근거로 사용한다.

### 구현·검증

- Organization, Membership, Human·Agent·Service Actor와 기본 Role
- Work Item 생성·조회·상태 전이·취소와 Assignment
- Workflow Plan, Version, Node·Edge와 Work Item 연결
- 존재하지 않는 Node, 순환, 중복 식별자와 필수 필드 누락 검증
- 승인된 Version을 덮어쓰지 않는 Repository와 Version 계보
- Artifact, Provenance와 기본 Audit Event
- Server-side 인증과 Organization 소유권 검사
- Work Item과 Workflow Plan 읽기 전용 Graph·목록·상세 UI
- Domain Unit Test와 PostgreSQL Integration Test

### 산출물

- 핵심 ERD, 상태 전이표와 Graph 검증표
- 인증·인가 정책표
- Work Item·Workflow Plan API 또는 UI
- Transaction·동시성 Test와 2주차 WIL

### 완료 조건

- 허용되지 않은 상태 전이와 잘못된 Graph가 Domain에서 거부된다.
- 다른 Organization의 데이터를 읽거나 변경할 수 없다.
- 새 Version을 만들어도 이전 Version의 내용과 생성 근거가 바뀌지 않는다.
- 선택한 동시성 정책을 실제 PostgreSQL Test로 설명할 수 있다.

## 3주차 — Workflow 검토, Agent 실행, Capability와 승인

### 핵심 목표

AI 계획 생성·수정·Human Plan Approval과 실제 Agent Run·Action Approval을 하나의 안전한 실행 흐름으로 연결한다.

### 학습

- 비동기 작업, Queue와 영속 상태 Machine
- Retry, Timeout, Idempotency와 부분 성공
- RBAC와 Capability 기반 접근 통제
- Review·Revision·Plan Approval과 Action Approval의 차이
- Human-in-the-loop 중단·재개
- Tool Argument Validation과 Prompt Injection 방어

### 심화과정 연계

- **제품 적용:** Queue·Retry·Timeout·Idempotency, RBAC·Capability와 Prompt Injection 방어를 승인 후 실행되는 실제 Tool 흐름에 적용한다.
- **검증·공개 근거:** 승인 우회, 권한 상승, 악성 Tool Argument, 중복 Delivery와 부분 실패 Test를 WIL과 승인·중단·재개 기술 글에 포함한다.

### 구현·검증

- Agent Definition, Agent Run과 Step
- Model Port와 선택한 Framework Adapter
- Side Effect 권한이 없는 Planner Run의 Workflow Plan 생성
- 전체·Node별 Workflow Review와 Revision Request
- 기존 Version을 보존한 AI 재작성, 서버 검증과 의미 단위 Diff
- R1 Human Plan Approval, Content Hash와 Approval Audit
- 승인 Version만 업무 Agent Run에 연결하는 실행 Gate
- Tool Gateway, Tool Invocation과 Capability Grant
- Action Approval 대기·승인·거절·만료와 정확한 재개
- Idempotency Key와 실제 Side Effect Connector 한 개
- Correlation ID와 권한·실패·중복·만료 Test

### 산출물

- Agent Run 상태 Machine
- Workflow Review·Revision·Approval Sequence와 Version Diff
- Capability·Approval 정책표와 Tool Gateway 계약
- 실제 LLM·Tool 통합 Test와 3주차 WIL

### 완료 조건

- 승인되지 않은 Plan Version으로 업무 Run을 시작할 수 없다.
- 자동화 Actor의 자기 승인과 승인 후 Content 변경이 차단된다.
- 권한 없는 Tool 호출은 Provider 호출 전에 거부된다.
- Action Approval 전 Side Effect가 발생하지 않고 재시도해도 한 번만 실행된다.
- 입력, Version, Actor, 권한, Tool과 결과를 Audit에서 찾을 수 있다.

## 4주차 — 캐릭터 회사 Reference Application

### 핵심 목표

공통 Kernel을 변경하지 않고 캐릭터 기획부터 검수·승인·게시·대화·개선 업무까지 이어지는 첫 Vertical Slice를 완성한다.

### 학습

- Semantic HTML, CSS Layout, Form과 접근성
- JavaScript 비동기 처리와 오류·로딩 상태
- 공통 Domain과 Reference Application 분리
- LLM Output 평가와 Reviewer Pattern
- 사용자 입력과 생성·게시 Content 보안

### 심화과정 연계

- **제품 적용·Spike:** Browser Rendering, Scope·Closure·Hoisting과 Event Loop를 작은 재현으로 확인하고 Semantic HTML·접근성, Promise·Async, Event Bubbling·Delegation과 Client State를 시각적 Workflow 검토 UI에 적용한다.
- **검증·공개 근거:** 반복 입력에는 필요할 때 Debounce·Throttle을 적용하고 접근성 점검, 오류·로딩 상태 Test와 Browser E2E를 WIL·Reference Application 글에 남긴다.

### 구현·검증

- 캐릭터 Brief와 제작 Workflow Plan 생성
- 시각적 Plan 검토, Node별 수정, Diff 확인과 Human 승인
- Writer Agent 구조화 초안과 Reviewer Agent Rubric 검수
- 낮은 점수·정책 위반·불확실 결과의 Human 전환
- 게시 전 Action Approval과 실제 게시 상태 반영
- 제한된 캐릭터 대화와 신고·개선 Work Item 생성
- 실행 Node 상태를 Workflow Read Model에 반영
- 로그인부터 계획 검토·수정·승인, 제작·게시와 Audit까지 Browser E2E

### 산출물

- 첫 Reference Application 배포 후보
- Reference Module과 공통 Kernel 연결 문서
- Workflow Version·Diff·실행 상태를 포함한 사용자 Journey
- 4주차 회고, WIL과 과정 설문

### 완료 조건

- 캐릭터 한 개가 Brief부터 승인·게시까지 실제로 흐른다.
- Plan Approval 전 Writer가 시작되지 않고 Action Approval 전 게시되지 않는다.
- Writer와 Reviewer의 Capability가 분리된다.
- 캐릭터 규칙 없이 공통 Work Item과 Agent Run이 독립적으로 동작한다.

## 5주차 — Knowledge, 평가, Security와 사용자 피드백

### 핵심 목표

R1의 품질·보안·성능 Baseline을 만들고 구현 담당자 외 사용자의 실제 사용 문제를 수집한다.

### 학습

- Embedding, Chunk, 검색과 RAG 실패 유형
- Knowledge Version, Citation, 신선도와 접근 범위
- Dataset, Rubric, 회귀 평가와 Human Review
- Graph 정보 구조와 Workflow 검토 사용성
- XSS, CSRF, SQL Injection, Rate Limit과 Session 보안
- Index, N+1, Connection Pool과 병목 측정

### 심화과정 연계

- **제품 적용:** RAG·Citation·LLM 평가와 Web 공격 방어, Database Query 최적화를 하나의 고정 Dataset과 Pilot 사용자 흐름에서 검증한다.
- **검증·공개 근거:** Security Test, Query Plan, N+1·Pool 측정과 정상·경계·악성 입력 결과를 WIL과 평가·Security 기술 글에 공개한다.

### 구현·검증

- 제한된 Knowledge Source 수집, Version 검색과 Citation
- 고정 평가 Dataset을 정상·경계·악성 입력 포함 최소 30 Case로 확장
- Structured Output, 정책 준수, Citation, 비용과 Latency 측정
- 오류를 심은 Workflow의 발견률·수정 시간과 Revision 정확성 측정
- Prompt Injection과 악성 Tool Argument Test
- Query Plan, N+1, Index와 입력 크기·출력 Encoding 점검
- 구현 담당자 외 최소 두 명의 Pilot 사용자 관찰
- Feedback을 Bug, Usability와 Feature Request로 분류

### 산출물

- Version 관리 평가 Dataset과 평가 Report
- Workflow 검토 사용성·Revision 정확성 Report
- Threat Model·Security Test 결과와 성능 Baseline
- Pilot Feedback Backlog와 5주차 WIL

### 완료 조건

- 같은 Dataset과 Model 설정으로 평가를 다시 실행할 수 있다.
- 위험 정책 Case와 승인·실행 Version 불일치가 차단된다.
- Citation 누락과 검색 실패가 정상 응답처럼 표시되지 않는다.
- Critical 결함을 6주차 Gate의 해결 대상으로 지정한다.

## 6주차 — Production Pilot 배포와 운영 검증

### 핵심 목표

R1을 통제된 실제 환경에 배포하고 Security, 관측, Backup·Restore와 장애 대응을 검증한다.

### 학습

- Container, Process·Signal과 Graceful Shutdown
- DNS, HTTPS, Secret과 환경 분리
- Log, Metric, Trace와 Alert
- Migration, Backup, Restore, Rollback과 Incident
- 부하 Test와 Capacity Baseline

### 심화과정 연계

- **제품 적용:** Docker, Process·Signal, DNS·TLS, Secret, CI/CD와 관측·복구 개념을 실제 Pilot 배포와 Release Gate에 적용한다.
- **검증·공개 근거:** 선택한 Cloud의 최소 권한·DNS·Container·Database 설정, Header 점검, Pipeline, Dashboard와 Backup·Restore 훈련을 WIL·Production Pilot 글에 남긴다.

### 구현·검증

- Staging 또는 통제된 Production Pilot 배포
- HTTPS, 안전한 Cookie, CSRF와 운영 CORS
- 환경별 설정과 Secret 분리
- Health Check, 구조화 Log, 핵심 Metric과 Dashboard
- Workflow 검증 실패, Revision, 승인 시간, Run 실패와 비용 관측
- 승인 Version과 실행 Version 불일치 운영 점검
- Database Backup·Restore와 한 가지 장애 복구 훈련
- 핵심 Browser E2E와 Release Check 자동화
- Critical·High Feedback 수정과 Runbook 작성

### 산출물

- R1 Production Pilot Release와 Release Tag
- 운영 Dashboard와 시각적 Workflow Pilot 근거
- Backup·Restore·장애 훈련 기록
- R1 Gate 결과표와 6주차 WIL

### 완료 조건

- R1 Production Gate를 모두 통과한다.
- 실패한 항목을 숨기지 않고 Release Blocker로 표시한다.
- Gate 실패 시 7주차 작업의 최소 70%를 결함 해결에 먼저 사용한다.

## 7주차 — Director Agent, 위임과 Approver Actor

### 핵심 목표

R1이 안정적일 때 정책 기반 위임과 저위험 Agent·Service Plan Approval을 제한된 한 흐름에서 검증한다.

### 학습

- Delegation, 권한 상한과 임시 Capability
- 위험 기반 Approver Actor, 책임 분리, 정족수와 Human 필수 조건
- Agent Reviewer 독립성과 같은 Model의 상관 오류
- Policy Engine, Simulation과 Decision 설명 가능성
- 동적 Resource Provisioning과 Budget·Time Scope

### 심화과정 연계

- **제품 적용:** 최소 권한, 책임 분리, Composition과 Policy Pattern을 위임·승인 경계에 적용한다.
- **검증·공개 근거:** 자기 승인, 권한 상승, 상관 오류와 Human 전환 Test를 WIL과 Agent Approver 기술 글에 포함한다.

### 구현·검증

- Director Agent의 입력 계약과 Delegation Workflow Plan
- 대상 Actor, Capability, Budget과 승인 지점 시각화
- 위험별 Human·Agent·Service 허용 범위의 Version 관리 Approval Policy
- 저위험 Workflow 한 종류의 독립 Reviewer Agent 또는 Policy Service 승인
- 작성자·Approver 분리, 자기 승인과 Policy 자기 확장 차단
- Agent Definition·Model·Prompt·Knowledge·Tool·Policy Version과 Evidence Audit
- 중·고위험, 민감 데이터와 권한 확대의 Human 전환
- Template 기반 Agent Provisioning과 임시 권한 만료·회수
- 순환 위임, 무한 재위임과 중복 Provisioning 차단

### 산출물

- Delegation·Approver Actor 정책표
- Director → Plan → Approval → Provisioning → 실행 흐름
- 자기 승인·허용 Actor·Human 전환·만료·회수 Test
- 7주차 WIL

### 완료 조건

- Director는 자신이 갖지 않은 Capability를 부여할 수 없다.
- 작성자와 다른 Agent·Service가 저위험 Version만 승인할 수 있다.
- 중·고위험과 권한 확대는 자동 승인이 거부되고 Human에게 전환된다.
- 승인 Agent·Policy Version과 Evidence를 Audit에서 재구성할 수 있다.

## 8주차 — 인간·AI 혼합 팀과 두 번째 업무 유형

### 핵심 목표

Human·Agent 혼합 책임과 두 번째 업무 유형으로 공통 Kernel, Workflow Read Model과 승인 정책의 재사용성을 증명한다.

### 학습

- Human Handoff, Queue와 Ownership
- 혼합 팀의 책임·승인·대리 관계
- Collaboration Context와 결정 기록
- 두 업무의 공통 계약 재사용성 평가

### 심화과정 연계

- **제품 적용:** Queue·Ownership·Handoff와 공통 Backend 계약을 Human·Agent 혼합 팀과 두 번째 업무 유형에 재사용한다.
- **검증·공개 근거:** 두 Workflow의 Module 의존성, E2E 회귀, Handoff Audit와 재사용 비교를 WIL·범용 Kernel 기술 글에 남긴다.

### 구현·검증

- Staffing Request와 Human Contributor 수락·거절·완료
- Human·Agent Work Assignment와 Handoff
- 사용자 소유 Proxy Agent와 Delegation Scope
- Work Item 중심 Collaboration Thread
- Human·Agent 소유권과 승인 지점을 Workflow Graph에 표시
- 제한된 Agent Meeting, Decision과 Action Item
- 고객 문의 분류 → 초안 → 승인 → 전달의 두 번째 Reference 흐름
- 동일한 Plan Review·Revision·Approval과 Read Model 재사용 검증
- 기술 심화 결과와 Portfolio 1차 정리

### 산출물

- 혼합 팀 End-to-End Scenario와 두 번째 Reference Application
- 두 Workflow의 Kernel·Read Model 재사용 비교 Report
- 기술 심화 최종 제출·시연과 8주차 회고·WIL

### 완료 조건

- Work Item 안에서 Human·Agent 책임과 현재 소유자를 구분할 수 있다.
- Handoff 전후 권한과 책임이 Audit에 남는다.
- 두 번째 업무가 새 Canvas나 업종 조건문 없이 공통 계약을 재사용한다.
- 저위험 Agent·Service 승인이 정책 범위 안에서만 동작한다.

## 9주차 — 취업 시작, Knowledge 수명주기와 Connector

### 핵심 목표

취업 활동을 우선하면서 Knowledge의 승인·승격·폐기와 제한된 Connector 동기화를 완성한다.

### 취업·학습

- AI/AX·Java Backend 이력서와 지원 기준 확정
- Java Coding Test와 기술 면접 학습 시작
- Knowledge Promotion, Expiry, Rollback과 Connector 동기화 이해

### 심화과정 연계

- **제품 적용:** Version·Rollback, Connector 동기화와 LLM 회귀 평가를 Knowledge 수명주기에 적용한다.
- **검증·공개 근거:** 같은 Dataset의 변경 전·후 결과, 접근 통제와 동기화 실패 Test를 WIL·Knowledge 운영 기술 글에 남긴다.

### 구현·검증

- Knowledge 승인·승격·만료·폐기와 Version Rollback
- Citation·접근 범위와 Connector 동기화 상태 검증
- 변경 전·후 응답을 같은 Dataset으로 평가
- R1·R2 운영 결함 우선 수정

### 산출물·완료 조건

- 맞춤 지원 누적 25회와 결과 기록
- Knowledge 변경 전·후 재현 평가와 한 개 Connector 동기화
- 취업 활동과 구현 시간이 주간 상한 안에 유지됨
- 9주차 WIL

## 10주차 — 취업 병행, 격리 Coding Runner 기반

### 핵심 목표

Coding Runner의 Trust Boundary와 최소 권한 기반을 만들되 격리 안전성을 입증하기 전에는 Production에서 비활성으로 둔다.

### 취업·학습

- 맞춤 지원과 면접 준비 지속
- Process, Filesystem, Network, CPU·Memory·Time 격리
- Sandbox 위협 모델과 Resource Limit

### 심화과정 연계

- **제품 적용·Spike:** Linux Process·Signal·`/proc`, Filesystem·Network 경계와 Resource Limit을 Coding Runner 격리에서 검증한다.
- **검증·공개 근거:** Process Tree, Host 접근, 잔여 Process와 자원 고갈 Test를 WIL·Runner Threat Model 글에 남긴다. Mini Shell·Mini VM 자체 구현은 제품 요구가 아니므로 수행하지 않는다.

### 구현·검증

- Run Request, Workspace Snapshot과 Artifact 계약
- 허용 Command·Network·Filesystem 정책
- CPU, Memory, Process와 실행 시간 제한
- Host File 접근, 잔여 Process와 악성 입력 Test
- 실행 결과와 Audit 저장, Production Feature Flag 비활성

### 산출물·완료 조건

- 맞춤 지원 누적 50회
- Runner Threat Model과 격리 구조
- 파괴적 Test 결과와 Production 비활성 근거
- 10주차 WIL

## 11주차 — 취업 병행, Runner 흐름과 운영 복원력

### 핵심 목표

격리 기반 위에 제한된 Coding 업무 한 종류를 연결하고 At-least-once 실행의 중복과 부분 실패를 복구한다.

### 취업·학습

- 맞춤 지원과 모의 면접 지속
- Queue, Lease, Heartbeat, Idempotency와 Reconciliation
- 외부 Side Effect 중복 방지와 장애 진단

### 심화과정 연계

- **제품 적용:** Queue·Lease·Heartbeat, Idempotency·Reconciliation과 운영 관측을 At-least-once Runner 흐름에 적용한다.
- **검증·공개 근거:** 중복 Delivery, Timeout, Process 중단과 부분 성공을 주입하고 Trace·Resource Metric·복구 결과를 WIL과 복원력 기술 글에 남긴다.

### 구현·검증

- 승인된 Coding 업무 한 종류의 실행 흐름
- Queue, Lease·Heartbeat와 중단 Run 탐지
- 중복 Delivery, Timeout과 부분 성공 장애 주입
- Test Result·Artifact와 승인 후 Draft 변경 흐름
- Runner 실패율, 소요 시간과 Resource 사용량 관측
- R1·R2 운영 결함 회귀 Test

### 산출물·완료 조건

- 맞춤 지원 누적 75회
- Coding Runner End-to-End Scenario와 Reconciliation 기록
- 중복 실행에서도 외부 결과가 중복되지 않는 Test
- 11주차 WIL

## 12주차 — 취업 목표 완료와 제품 안정화

### 핵심 목표

취업 목표를 마무리하고 검증된 기능의 회귀 평가, 운영 문서와 Portfolio 근거를 확정한다.

### 취업·학습

- 맞춤 지원 누적 100회 완료
- Coding Test 오답과 면접 질문 정리
- 지원 결과 분석과 다음 실행 계획 작성

### 심화과정 연계

- **제품 적용·운영 실습:** Unit·Integration·E2E·Security 회귀, 정적 분석·Lint, CI/CD, 성능·비용 Baseline과 복구 절차를 최종 Release 판단에 사용한다.
- **검증·공개 근거:** Coverage 수치만으로 완료를 판단하지 않고 Release Gate, 실패 이력, 사용자 Feedback과 운영 수치를 최종 WIL·회고 글에 함께 공개한다.

### 구현·검증

- Critical·High 결함 우선 수정
- 핵심 Workflow 전체 회귀 평가와 Security Test
- 성능·비용 Baseline과 운영 한계 갱신
- Backup·Restore·Rollback과 장애 대응 재확인
- Architecture·Requirements·구현 상태 일치 검토
- 완료·부분 구현·후속 Release 구분과 시연 자료 정리

### 산출물·완료 조건

- 맞춤 지원 100회와 결과 분석
- 안정화 Release와 R1·R2·R3 Gate 결과
- 알려진 제한과 후속 Roadmap
- 직접 구현·검증한 범위가 명확한 Portfolio
- 12주차 WIL과 최종 회고

## 주차별 변경 관리

- 매주 시작 시 `weekly-plan` Template으로 Baseline을 확정한다.
- 계획 변경은 날짜, 변경 전·후, 이유, Gate 영향과 새 Release를 기록한다.
- 주차 완료 조건과 실제 결과가 다르면 WIL과 구현 Report에 차이를 남긴다.
- Product Gate를 통과하지 못한 기능은 완료로 표시하지 않는다.
- 시스템 개선을 주장하는 변경이 있을 때만 비교 가능한 조건의 전·후 수치를 기록한다.
