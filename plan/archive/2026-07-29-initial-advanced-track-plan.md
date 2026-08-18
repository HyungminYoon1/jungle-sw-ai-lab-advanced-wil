# SW-AI랩 심화과정 1기 학습 계획서

> 상태: Superseded — 초기 계획 및 변경 이력 보존용  
> 현재 공식 계획: [AgentOps Lab 12주 학습 및 구현 계획](../agentops-lab-12-week-plan.md)  
> 참고: 현재 일정·범위·완료 기준은 공식 계획을 따른다.

## 1. 기본 정보

| 항목 | 내용 |
|---|---|
| 작성자 | 윤형민 |
| 진행 형태 | 개인 프로젝트 |
| 기간 | 기술 심화 8주 + 취업 심화 4주 (총 12주) |
| 목표 직무 | AI/AX 개발자, 백엔드 개발자 |
| 프로젝트명 | AgentOps Lab |
| 기술 주제 | Java 25·Spring Boot 기반 기업용 AI Agent 운영·통제 플랫폼 |
| 12주 목표 | AgentOps Lab 배포·포트폴리오 완성과 AI/AX·Java Backend 직무 맞춤 지원 100개 |

## 2. 프로젝트 소개

### 한 줄 소개

기업이 인간과 AI Agent에게 업무를 배정하면서 권한, 승인, 실행 기록과 품질을 통제할 수 있도록 하는 Agent Operations Platform을 만들고, 캐릭터 챗봇 콘텐츠 회사의 업무 흐름으로 실제 효과와 한계를 검증한다.

### 해결하려는 문제

기업이 AI Agent를 실제 업무에 활용하면 단순히 좋은 답변을 생성하는 것만으로는 부족하다.

- 어떤 Agent가 어떤 업무를 맡았는지 추적하기 어렵다.
- Agent가 사용할 수 있는 Tool과 데이터의 범위를 통제해야 한다.
- Agent 수가 늘어날수록 사람이 역할과 임시 권한을 반복해서 배치하는 비용이 커진다.
- 배포, 권한 확대와 외부 전송 같은 작업에는 사람의 승인이 필요하다.
- 작업 실패와 재시도 과정에서 같은 부수효과가 반복될 수 있다.
- 자동화가 실제로 시간과 비용을 줄였는지 판단할 근거가 부족하다.
- Agent가 만든 결과의 품질과 최종 책임을 사람이 확인할 수 있어야 한다.
- AI Agent가 적합한 결과를 만들지 못하는 업무는 인간 전문가에게 안전하게 넘겨야 한다.
- 인간과 그를 보조하는 Proxy Agent가 함께 일할 때 실제 수행자와 책임 주체가 뒤섞이지 않아야 한다.

사용자는 자연어로 업무를 요청하고 추가 정보를 제공할 수 있다. 시스템은 요청을 영속적인 Work Item으로 구조화하여 인간, AI Agent 또는 혼합 팀에 배정하고 담당자, 상태, 권한, 승인과 결과를 관리한다. 대화 기록 자체를 업무 상태의 기준 데이터로 사용하지 않는다. Spring Boot가 업무, 권한, 승인과 감사 기록의 기준 시스템이 되며 Agent Framework는 실행 도구로 제한한다.

## 3. 주제 선정 이유

나만무 프로젝트에서 Nodease라는 기업용 AI Workflow·LLMOps 플랫폼을 구현하면서 권한 기반 RAG, Workflow 실행, 감사, 비용과 보안 문제를 경험했다. 기능 범위가 넓어지면서 Domain 간 계약을 구현 전에 충분히 고정하지 못했고, 통합 과정에서 반복적으로 결함을 수정하기도 했다.

새 프로젝트는 Nodease를 Java로 복제하지 않는다. 다음 차이를 둔다.

- Workflow Graph보다 Work Item과 Agent Run을 핵심 Domain으로 사용한다.
- Agent가 실제 업무를 수행할 때 필요한 권한, 승인과 평가에 범위를 집중한다.
- AI가 처리하지 못한 업무를 인간 전문가에게 전환하고, 인간과 Proxy Agent의 협업 책임을 분리한다.
- Java 25와 Spring Boot로 객체지향 설계, Transaction, 동시성, 인증·인가와 테스트를 깊게 학습한다.
- 캐릭터 챗봇 회사를 기준 애플리케이션으로 만들어 실제 사용자 흐름과 운영 지표를 확보한다.
- 구현 기능 수보다 자동화율, 인간 개입 시간, 품질과 비용을 검증하는 데 집중한다.

## 4. 학습 목표

### Java와 Backend

- Java 25의 언어 및 Runtime 특성을 실제 프로젝트에서 활용
- Spring Boot의 의존성 주입과 계층 분리
- MVC, Layered Architecture, DI·IoC와 AOP의 책임 구분
- REST API, 일관된 오류 응답과 요청 검증
- Spring Security 기반 인증·인가
- Spring Data JPA와 PostgreSQL Transaction
- ACID, 격리 수준, Index, N+1, Connection Pool, Lock과 Deadlock
- SQL 실행 계획과 실제 병목 분석
- 상태 전이, 동시성 제어, 재시도와 멱등성
- Flyway Migration과 기존 데이터 호환성
- Testcontainers를 이용한 실제 PostgreSQL 계약 검증
- Micrometer와 OpenTelemetry 기반 관측

### 웹 기초와 Frontend

- DNS, TCP, HTTP 요청·응답과 브라우저에서 서버까지의 흐름
- HTTP Method, Status Code, Header, Cache-Control과 조건부 요청
- Same-Origin Policy, CORS와 Preflight Request
- Cookie, Session과 Web Storage의 수명·보안 특성
- Semantic HTML, Form, CSS Layout, 반응형 화면과 기본 접근성
- JavaScript Event Loop, Scope, Event와 Promise·async/await
- Browser Rendering 과정과 CSR·SSR의 차이
- `fetch`, 로딩·오류 상태와 일부 요청 실패를 견디는 화면
- Browser DevTools의 Network·Console·Performance를 이용한 진단

웹 기초는 별도의 대규모 Frontend Framework 학습으로 확장하지 않는다. 먼저 Spring MVC와 Semantic HTML·CSS·Vanilla JavaScript로 핵심 흐름을 연결하고, 화면 복잡도가 실제로 요구할 때만 Framework 도입을 별도로 판단한다.

### 웹 보안과 인증

- 인증과 인가를 구분하고 UI와 서버 API에서 각각 검증
- Session 기반 인증과 JWT의 차이를 실험한 뒤 한 방식을 선택
- Password Hashing과 암호화의 차이
- XSS, CSRF와 SQL Injection 재현 및 방어
- HTTPS/TLS, Secure·HttpOnly·SameSite Cookie
- Rate Limiting과 로그인·LLM API 비용 남용 방지
- 환경 변수와 Secret 저장 경계를 통한 Credential 보호

### AI/AX

- Structured Output을 Domain 상태와 연결
- Tool Calling과 서버 측 Capability 검사
- 여러 Agent의 역할 분담과 작업 전달
- 인간과 AI Agent가 함께 일하는 혼합 팀의 업무 편성
- 정책 상한 안의 Agent 역할·Capability 자동 배치
- 인간 전문가 요청, 작업 배정과 Proxy Delegation
- Human-in-the-loop 중단·승인·재개
- 권한 기반 Knowledge 검색, Citation과 안전한 No-evidence 처리
- Model Port와 비용·품질 특성이 다른 Model Profile 비교
- Connector Port와 핵심 업무 Tool 연동
- Agent 실행의 비용, 지연 시간과 품질 측정
- LLM-as-a-Judge와 대표 표본의 사람 검토 비교
- Prompt Injection 및 정책 우회 방어
- 격리된 코드 유지보수와 사람이 책임지는 병합·배포 경계
- AI가 적합한 업무와 사람이 맡아야 하는 업무의 경계 분석

### 개발·운영 기본기

- OOP, SOLID, 상속보다 합성과 작은 Interface 중심 설계
- 단위·통합·E2E 테스트의 역할 구분과 TDD
- 정적 분석, Lint와 Formatting
- Git Working Tree·Staging·Commit, Merge·Rebase와 Conflict 해결
- 작은 Commit, Pull Request Review, Revert와 안전한 History 관리
- Docker, GitHub Actions와 CI/CD
- Linux CLI, Process·Signal, Log와 Resource 진단
- 배포 환경의 DNS·HTTPS, 구조화된 Log, Metric과 장애 대응

기술 심화 공지의 모든 실습을 별도로 수행하지 않는다. AI/AX·Java Backend 직무와 AgentOps Lab의 핵심 흐름에 직접 필요한 항목을 우선하며, 구현·테스트·배포 기록을 학습 증거로 남긴다.

## 5. 핵심 기능

### 기업용 Agent 운영 기반

1. Human, AI Agent와 System Actor 관리
2. 사내 Human Contributor와 승인된 외부 전문가의 등록·비활성화
3. Role 및 Capability 기반 Tool 권한
4. Delegation Policy와 총괄 Agent의 제한된 Provisioning Request
5. Permission Service의 저위험 자동 적용과 고위험 인간 승인
6. Work Item 생성, 검토, 승인, 완료와 실패
7. Work Item별 영속 Collaboration Thread와 자연어·구조화 Message
8. 발언·시간·비용 한도가 있는 Agent 회의와 결과 요약
9. 승인된 협업 기록의 출처·권한 기반 Knowledge 승격
10. Staffing Request와 인간·AI 혼합 Work Assignment
11. 인간과 별도 Identity를 사용하는 Proxy Agent의 제한된 위임
12. Agent 실행과 구조화된 결과
13. Tool 실행 직전 권한 및 대상 상태 검사
14. 고위험 작업의 Human Approval Gate
15. Agent Run, Tool Invocation과 Audit 기록
16. 실제 수행자, 제출자와 사용 도구를 구분하는 결과물 Provenance
17. 실패 분류, 제한된 재시도와 중복 시작 방지
18. 격리된 저장소 변경과 Draft Pull Request 제출
19. 품질, Token, 비용, 지연 시간과 인간 개입 지표
20. 회사 정책·캐릭터 설정 문서의 권한 기반 Knowledge 검색과 Citation
21. Model Catalog와 비용 등급이 다른 Model Profile 2개 이상
22. Knowledge Retrieval Tool과 외부 Repository Connector

### 캐릭터 챗봇 회사

1. 독창적인 캐릭터 3종 기획
2. Writer, Consistency Reviewer와 Safety Reviewer Agent
3. 캐릭터 설정 Version 관리
4. 인간의 공개 승인
5. 승인 버전만 사용하는 텍스트 챗봇
6. 현재 대화 요약과 제한적인 사용자·캐릭터별 장기 Memory
7. 사용자 Memory 확인·수정·삭제·초기화
8. 사용자 신고 및 대화 삭제 요청
9. 캐릭터별 품질·비용·신고·재방문 지표
10. 지표를 근거로 한 개선 Work Item 제안
11. 챗봇의 재현 가능한 버그 또는 UI 개선 한 건
12. AI 결과 검수 실패 시 등록된 Human Contributor에게 Work Item을 재배정하고 수행·승인 이력을 기록하는 흐름

## 6. 핵심 사용자 시나리오

1. Human Owner가 총괄 Agent의 위임 정책과 자동 적용 가능한 저위험 권한을 정의한다.
2. Director Agent가 필요한 역할과 Capability 배치안을 제출하고 Permission Service가 정책 상한을 검증한다.
3. 저위험 임시 권한은 자동 발급하고 고위험 권한은 인간 승인을 기다린다.
4. Human Owner가 캐릭터 제작 목표를 등록한다.
5. Planner Agent가 목표를 구조화된 하위 Work Item으로 분해한다.
6. Character Writer Agent가 `knowledge:use` 권한이 있는 회사 정책과 Active 캐릭터 설정 문서만 검색하고 Citation과 함께 초안을 작성한다.
7. Consistency Reviewer와 Safety Reviewer가 설정 충돌 및 정책 위반을 검사한다.
8. AI가 만든 캐릭터 디자인이 기준을 충족하지 못하면 Human Owner가 인간 전문가 편성을 요청한다.
9. Director Agent가 필요한 기술, 기간, 예산 상한과 데이터 범위를 담은 Staffing Request를 제출한다.
10. 인간이 대상과 계약·보상 조건을 승인하고, 사전 등록된 인간 디자이너를 Primary Assignee로 배정한다.
11. 필요하면 별도 Identity를 가진 Proxy Agent를 Collaborator로 붙이되, Proxy는 명시적으로 위임된 범위만 사용한다.
12. 시스템은 실제 수행자, 제출자, 사용 도구와 결과물 출처를 구분해 기록하고 Director Agent가 결과와 후속 작업을 보고한다.
13. 검수 기준을 충족한 Version이 인간에게 공개 승인을 요청한다.
14. 승인된 Version만 사용자용 챗봇으로 배포된다.
15. 비공개 테스트 사용자가 대화하면 호칭·선호·약속을 구조화된 Memory 후보로 추출하고 서버 검증을 통과한 항목만 사용자·Character 범위에 저장한다.
16. 같은 사용자가 새 Conversation을 시작하면 Active Memory를 이용해 이전 대화를 이어가고, 사용자는 저장된 Memory를 확인·수정·삭제할 수 있다.
17. 사용자가 부적절한 답변을 신고하거나 Conversation과 Memory 삭제를 요청할 수 있다.
18. Operations Agent가 품질, 비용과 실패 지표를 분석하여 개선 Work Item을 제안한다.
19. 재현 가능한 버그 또는 UI 개선은 Developer·QA Agent가 격리된 Branch에서 처리하고 Repository Connector로 Draft Pull Request를 제출한다.
20. Agent는 채용·계약·보상, 위임 정책 상한, 기본 Branch 병합과 운영 배포를 최종 결정하지 않는다.

## 7. MVP와 제외 범위

### 6주 내 필수 MVP

- Actor, Role, Capability와 Work Item
- 사전 등록된 Human Contributor 한 명과 비활성화 흐름
- 정책 상한 안의 저위험 권한 자동 배치와 고위험 Grant 승인
- 임시 Grant의 만료·회수와 자기 권한 상승 차단
- Staffing Request와 인간·AI 혼합 Work Assignment
- 별도 Identity와 제한된 Capability를 사용하는 Proxy Delegation
- Agent Runtime 및 Structured Output
- Tool 실행 전 권한 검사
- Human Approval과 안전한 재개
- Agent Run과 Audit 기록
- 한 종류의 Knowledge 입력, Document Version, 단일 Embedding Profile과 pgvector 검색
- `knowledge:use` Capability 기반 검색, Citation과 안전한 No-evidence 처리
- Model Port와 비용·품질 특성이 다른 Model Profile 2개 이상
- Connector Port, Knowledge Retrieval Tool과 외부 Repository Connector
- 캐릭터 생성·검수·승인·배포
- 현재 Conversation Context·Summary와 제한적인 사용자·Character 장기 Memory
- 사용자 Memory 확인·수정·삭제·초기화
- AI 디자인 반려 후 인간 디자이너에게 전환하는 작업 한 건
- 인간과 Proxy의 실제 수행·제출 이력을 구분한 결과물 Provenance
- 텍스트 챗봇, 신고와 삭제 요청
- 품질·비용·지연 시간·인간 개입 측정
- 유지보수 한 건의 격리 실행·검사와 Draft Pull Request 제출
- 핵심 단위·PostgreSQL 통합·브라우저 E2E 테스트
- Docker 배포와 비공개 사용자 검증

### 이번 프로젝트에서 제외

- Nodease의 Workflow Canvas 재구현
- 다중 Source·복잡한 Source ACL·다중 Embedding Profile·Knowledge Graph를 포함한 범용 Knowledge Platform
- MVP에서 정한 Model Profile과 Connector를 넘는 광범위한 Provider·외부 시스템 지원
- 다중 기업용 Multi-tenant SaaS
- Marketplace와 사용자 제작 공개 캐릭터
- 결제, 광고와 정산
- 음성, 영상과 Live2D
- 자체 LLM 학습 및 운영
- 범용 자율 Coding Agent와 임의 Shell·저장소 접근
- Agent의 자율 채용·해고, 외부 계약, 보상과 인사 평가 결정
- 범용 인사·채용·급여·계약 관리 시스템
- 사람의 승인 없는 기본 Branch 병합, Migration과 운영 배포
- Kubernetes
- 외부 Provider까지 포함한 완전한 Exactly-once
- 전체 대화 원문의 자동 Embedding, 캐릭터 간 Memory 공유와 무기한 사용자 Memory 보존

## 8. 기술 선택

### 확정 기술

- Java 25
- Java 25를 공식 지원하는 Spring Boot 안정 버전
- Spring Security
- Spring MVC
- Spring Data JPA
- PostgreSQL
- pgvector
- Flyway
- JUnit 5, AssertJ, Mockito
- Testcontainers
- Micrometer, OpenTelemetry
- Docker, GitHub Actions

MVP Web Client는 Semantic HTML, CSS와 Vanilla JavaScript로 시작한다. SSR·CSR 비교와 핵심 흐름 구현 결과를 기준으로 Thymeleaf 또는 별도 Frontend Framework의 필요성을 1주차에 판단한다.

### 1주차 비교 후 선택

Spring AI와 Google ADK Java로 동일한 Agent 실행 시나리오를 구현한 뒤 하나만 선택한다.

비교 항목:

- Java 25와 Spring Boot 통합 안정성
- Structured Output과 Tool Calling
- Human Approval 중단·재개
- Tool 실행 전 Capability 검사
- 실행 상태 영속화
- 테스트 작성 가능성
- Framework 결합도
- Release 안정성과 운영 위험

Google ADK Java는 Preview 상태이므로 새 기능보다 안정성과 검증 가능성을 우선한다. 비교 결과가 불분명하면 Spring AI를 기본 선택으로 사용한다. 선택한 버전은 고정하고 자동으로 최신 버전을 반영하지 않는다.

## 9. 평가 계획

### 검증할 절차

동일한 고정 입력, 캐릭터 버전과 평가 기준으로 다음 절차를 비교한다.

1. LLM 한 번으로 초안을 생성하는 단순 AI 절차
2. Work Item, 전문 Agent, Capability와 승인을 적용한 AgentOps 절차
3. AI 결과 반려 후 Human Contributor 또는 Proxy Agent로 인계하는 기능 검증 절차

인간 단독 수행을 기록하더라도 단일 운영자의 탐색 사례로만 표시한다. 이를 필수 성공 기준이나 인간 전문가 대비 생산성 향상의 근거로 사용하지 않는다.

### 평가 자료

- 캐릭터 3종
- 정상 대화, 설정 충돌, 안전 정책과 Prompt Injection 자동 평가 사례 30건 이상
- 위험 유형을 나누어 사람이 평가 기준 준수 여부를 확인할 대표 표본 8~10건
- 개발 과정의 합성 운영 이벤트
- AI 디자인 반려, 인간 전문가 편성, Proxy 협업과 결과물 Provenance 검증 사례
- 같은 사용자의 재방문, 사용자·Character 격리, Memory 정정·삭제와 민감정보 저장 차단 사례
- 동의받은 비공개 테스트 사용자 3명 이상의 사용성·선호도 피드백

### 주요 지표

- Agent가 인간 수정 없이 완료한 Work Item 비율
- 전체 Work Item 완료 시간과 승인 대기 시간
- Agent Run 실행 시간과 Work Item당 인간 개입·승인·거절 횟수
- 설정 일관성과 안전 정책 준수
- 대표 표본 8~10건에서 사람의 평가 기준 확인과 자동 평가가 불일치한 비율
- Work Item 및 대화당 Token과 추정 비용
- 사용자 응답 지연 시간
- 허용된 Memory의 정확한 회상과 잘못된 범위의 Memory 사용 건수
- Memory 수정·삭제 요청 반영 성공률
- 실패, 재시도, 정책 차단과 결과 불확실 횟수
- 인간 전문가 요청부터 실제 배정까지 걸린 시간
- Human Contributor 또는 Proxy Agent로의 인계 성공 여부와 결과물 Provenance 완전성
- AI에서 인간으로 재배정된 Work Item 비율과 사유

시간 지표는 Work Item 생성, Agent Run 시작, 승인 요청·결정과 완료 Event의 서버 Timestamp로 계산한다. 사람이 별도로 기록한 실제 작업 시간은 선택적인 단일 사례 자료로 분리한다. 소수 사용자의 의견이나 단일 운영자의 결과로 시장 적합성, 전문가 품질 또는 일반적인 생산성 향상을 주장하지 않는다.

## 10. 8주 일정

| 주차 | 목표 | 주요 결과물 |
|---:|---|---|
| 1주차 | 문제·Architecture·기술 기초 확정 | Spring AI·ADK Java Spike, HTTP·CORS·Session 실습, Browser–Spring 얇은 흐름, 평가 초안 |
| 2주차 | 업무·권한·지식 기반 | MVC 계층, 인증·인가, Actor·Work Item UI/API, Knowledge Version, pgvector·Transaction 계약 테스트 |
| 3주차 | 실행·승인·연동 | Model·Connector Port, Approval UI, 비동기 상태, 전역 오류 처리, Audit |
| 4주차 | 캐릭터 회사 전체 흐름 | 반응형 챗봇, 제한적 사용자 Memory, Citation 기반 생성·검수, 인간 디자이너 전환, Repository Connector와 Draft Pull Request |
| 5주차 | 품질·성능과 운영 분석 | 평가 Dataset, Index·N+1·Connection Pool 점검, 보안·부하 테스트, 지표 Dashboard |
| 6주차 | 배포와 사용자 검증 | Docker 배포, DNS·HTTPS, 핵심 E2E, Log·Metric, 장애 복구, 사용자 피드백 |
| 7주차 | 예비 기간 | 미완료 필수 범위와 결함 우선 해소 |
| 8주차 | 예비 및 정리 | 배포 안정화, 시연 영상, Architecture와 포트폴리오 완성 |

7~8주차에는 새로운 핵심 기능을 추가하지 않는다. 6주차까지 완료하지 못한 필수 기능과 검증을 먼저 처리한다.

## 11. 개발 및 검증 방법

1. 요구사항과 실패 조건을 먼저 정의한다.
2. Domain 요구사항을 재현하는 테스트를 작성한다.
3. 최소 구현으로 테스트를 통과시킨다.
4. 중복이나 실제 구조 문제가 있을 때만 Refactoring한다.
5. 단위 테스트는 Domain 판단을 검증한다.
6. Testcontainers는 실제 PostgreSQL Query, Transaction과 Lock을 검증한다.
7. Browser E2E는 캐릭터 제작부터 승인·대화·신고까지의 사용자 흐름을 검증한다.
8. 위임 상한, 자기 권한 상승, 재위임, 만료와 정책 변경을 권한 실패 시나리오에 포함한다.
9. 유지보수 Runner의 허용 경로·명령, Secret·Network 격리와 무인 병합 차단을 검증한다.
10. Human Contributor와 Proxy Agent의 Identity 분리, Capability 교집합, 만료·회수와 비활성화 이후 차단을 검증한다.
11. 실제 수행자·제출자 Provenance 위조와 Agent의 채용·계약·보상 결정 시도를 차단하는지 검증한다.
12. Knowledge 검색은 Actor 권한, Active Version, Embedding 호환성, Citation과 No-evidence를 검증한다.
13. Model과 Connector는 Capability, Credential Reference, Timeout, Retry, 비용과 Audit 계약을 검증한다.
14. HTTP Method·Status·Cache, CORS, Session과 일관된 오류 응답을 API 및 Browser에서 확인한다.
15. XSS, CSRF, SQL Injection, Rate Limit과 Secret 노출을 실패 시나리오로 검증한다.
16. Semantic HTML, 키보드 조작, 반응형 화면, 로딩·오류 상태와 JavaScript 비동기 흐름을 확인한다.
17. Index, N+1, Lock·Deadlock과 Connection Pool은 실제 PostgreSQL Query와 동시 요청으로 검증한다.
18. 승인, 중복 실행, 부분 성공, Secret 노출과 Prompt Injection을 실패 시나리오에 포함한다.
19. AI 품질은 고정 Dataset과 기록된 Model 설정으로 재현한다.
20. 사용자 Memory는 사용자·Character 격리, 허용 유형, 원본 근거, 충돌·만료·삭제와 Prompt Injection을 검증한다.

## 12. 학습 및 진척도 관리

### 매일

- GitHub Issue와 Project에서 목표와 완료 조건 관리
- 의미 단위 Commit 기록
- 학습 내용과 실패 원인 정리
- Core Time에 진행 상황과 막힌 부분 공유

### 매주

- 계획 대비 진척도 및 범위 확대 여부 확인
- 핵심 구현, 직접 검증한 범위와 AI 활용 내용을 WIL로 작성
- 월요일에 WIL URL을 `심화` 태그와 함께 제출
- 주간 회고에서 다음 주 우선순위 조정

### 과정 제출

- 1주차와 5주차 첫날 GitHub 프로젝트 제출
- 4주차와 8주차 마지막 날 설문 참여
- 개인정보, Secret과 비공개 대화 원문은 저장소와 제출물에서 제외

## 13. 최종 산출물

- 배포 가능한 AgentOps Lab
- Source Code와 실행 방법
- 요구사항, Architecture, 데이터 모델과 API 문서
- 보안, 테스트와 운영 문서
- Architecture Decision 기록
- 평가 Dataset과 재현 가능한 평가 보고서
- 단순 LLM과 AgentOps 절차의 재현 가능한 비교 결과
- 인간 업무 인계와 결과물 Provenance 기능 검증 결과
- 권한 기반 Knowledge 검색, Citation, Model 비용 비교와 Connector 실행 결과
- 비공개 사용자 테스트 결과
- 핵심 사용자 흐름 시연 영상
- 8주 WIL
- 이력서와 기술 면접용 프로젝트 정리

## 14. 취업 준비 계획

### 14.1 프로젝트 경험과 직무 연결

이 프로젝트를 통해 다음 내용을 코드와 실행 결과로 설명하는 것을 목표로 한다.

- Java 25와 Spring Boot 기반 Domain 및 Backend 설계
- Spring Security와 Capability 기반 권한
- 총괄 Agent의 자동 권한 배치를 정책 상한과 Permission Service로 제한한 설계
- Staffing Request와 Work Assignment를 이용한 인간·AI 혼합 팀 편성
- 인간과 Proxy Agent의 Identity, 권한과 책임을 분리한 설계
- 구조화된 기준 데이터와 권한 기반 RAG를 분리한 설계
- Model·Connector를 Port로 격리하고 제한된 구현으로 확장성을 검증한 방식
- Browser·HTTP·Spring MVC·PostgreSQL로 이어지는 Web 요청 전체 흐름
- 인증·인가, CORS·CSRF와 Session 보안을 실제 화면과 API에서 검증한 과정
- Index·N+1·Lock과 실행 계획을 이용해 Database 병목을 분석한 과정
- JPA, PostgreSQL Transaction, Lock과 Migration
- 재시도, 멱등성, 부분 성공과 장애 복구
- Agent Framework를 외부 Adapter로 격리한 이유
- AI Agent의 Tool 사용과 Human Approval
- 개발·QA Agent의 격리 실행과 인간 중심 병합·배포 경계
- AI 품질, 비용과 인간 개입을 함께 평가한 방법
- 실제 Database와 Browser를 포함한 테스트 전략
- 자동화할 업무와 사람이 책임질 업무를 나눈 기준

### 14.2 지원 목표와 기업 선정 기준

우선 지원 직무는 다음 세 범위로 정한다.

1. **AI/AX 개발자**: LLM Application, AI Agent, RAG, 업무 자동화와 AI Platform Backend를 구현하는 직무
2. **Java Backend 개발자**: Spring Boot, PostgreSQL, 인증·인가, 비동기 처리와 운영 경험을 요구하는 직무
3. **AI Platform·LLMOps Backend 개발자**: Model·Prompt·Tool 실행, 평가, 비용과 관측 기능을 다루는 직무

지원 기업은 규모와 인지도보다 다음 기준으로 선정한다.

- AI를 실제 제품이나 사내 업무에 적용하는 기업
- 신입 또는 주니어에게 기대하는 역할과 기술이 공고에 구체적으로 적힌 기업
- Java·Spring Backend, AI Application 또는 B2B SaaS 개발 경험을 활용할 수 있는 기업
- 코드 리뷰, 테스트, 배포와 운영 경험을 중요하게 평가하는 기업
- 필수 역량 중 절반 이상을 현재 경험으로 설명하고 나머지를 학습 계획으로 보완할 수 있는 기업

### 14.3 이력서와 자기소개서

- 공통 경력과 교육 경험을 관리하는 기준 이력서 한 부를 작성한다.
- AI Agent, Knowledge/RAG, 평가와 운영 경험을 강조한 AI/AX 직무용 이력서를 작성한다.
- Java 25, Spring Boot, Database, Transaction과 테스트 경험을 강조한 Backend 직무용 이력서를 작성한다.
- Nodease와 AgentOps Lab에서 해결한 문제, 맡은 역할, 수행한 행동, 결과와 한계를 프로젝트별로 정리한다.
- 검증하지 않은 성능 개선이나 생산성 향상 수치는 기재하지 않는다.
- 공고마다 핵심 요구 역량 세 가지를 선정하고 프로젝트 설명과 기술 순서를 조정한다.
- 자기소개서는 공통 문장을 반복 제출하지 않고 지원 동기, 직무 적합성, 문제 해결과 협업 사례를 기업별로 작성한다.
- GitHub README, Architecture, 실행 방법, 시연 영상과 평가 결과를 이력서의 프로젝트 링크에서 확인할 수 있게 정리한다.

### 14.4 기술 면접과 코딩 테스트

기술 면접은 단순 정의 암기보다 AgentOps Lab과 Nodease에서 내린 판단과 실패 사례를 근거로 준비한다.

- Java 언어, 객체지향, Collection, Exception, Thread와 JVM 기초
- Spring Boot, DI·IoC, MVC, AOP, Spring Security와 요청 처리 흐름
- JPA 영속성 Context, Transaction, 격리 수준, Lock, N+1과 Index
- PostgreSQL, pgvector, Query 실행 계획과 Connection Pool
- HTTP, Cookie·Session, CORS, CSRF, 인증과 인가
- 비동기 실행, 재시도, 멱등성, 부분 성공과 장애 복구
- Structured Output, Tool Calling, Agent Workflow와 Human-in-the-loop
- Knowledge/RAG, Embedding 호환성, Citation, Memory와 Prompt Injection
- AI 품질·비용·지연 시간 평가와 LLM-as-a-Judge의 한계
- 권한, 승인, 감사와 외부 부수효과를 Agent Framework 밖의 Domain에서 관리한 이유

주 1회 이상 모의 기술 면접을 실시하고 답변을 녹화하거나 문서로 남긴다. 답하지 못한 질문은 근거 자료와 코드 위치를 확인한 뒤 다시 설명한다.

코딩 테스트는 Java로 주 5일, 하루 60~90분 동안 1~2문제를 푼다. 배열·문자열, Hash, Stack·Queue, 정렬, 완전 탐색, 이분 탐색, Graph와 Dynamic Programming을 순서대로 복습한다. 실패 원인, 시간·공간 복잡도와 다시 풀 날짜를 오답 기록에 남기고 주 1회 제한 시간을 둔 모의 테스트를 실시한다.

### 14.5 9~12주차 실행 계획

기술 프로젝트는 8주차에 기능 개발을 마치고 이후 4주는 지원 활동을 우선한다. 이 기간에 프로젝트는 지원 자료의 신뢰성을 해치는 치명적 결함 수정과 배포 유지에 한해서만 다룬다.

| 기간 | 지원 활동 | 면접·학습 활동 | 결과물 |
|---|---|---|---|
| 9주차 | 목표 공고 20개 분석, 이력서 2종과 프로젝트 기술서 확정, 맞춤 지원 20개 | Java·Spring 핵심 질문 정리, 코딩 테스트 진단 | 기준 이력서, AI/AX·Backend 이력서, 공고 분석표 |
| 10주차 | 전주 결과를 반영해 맞춤 지원 25개, 자기소개서 사례 정리 | Database·Web·보안 면접 준비, 모의 면접 1회 | 자기소개서 사례 모음, 기술 면접 답변 1차 |
| 11주차 | 맞춤 지원 30개, 서류·과제·면접 일정 대응 | 동시성·분산 실행·AI Agent 면접 준비, 모의 면접 1회 | 프로젝트 Q&A, 코딩 테스트 오답 기록 |
| 12주차 | 맞춤 지원 25개로 누적 100개 달성, 미응답·불합격 원인 분류 | 취약 주제 보완, 실전 면접과 코딩 테스트 대응 | 지원 결과 보고, 이력서 최종본과 다음 4주 계획 |

지원 수를 채우기 위해 직무와 무관한 공고에 같은 서류를 반복 제출하지 않는다. 채용 일정에 따라 주차별 개수는 조정할 수 있지만 누적 목표, 변경 이유와 결과는 기록한다.

### 14.6 지원 활동 기록과 개선

지원 관리표에는 다음 항목을 기록한다.

- 기업, 직무, 공고 URL과 지원일
- 필수·우대 역량과 내 경험의 연결 근거
- 사용한 이력서 및 자기소개서 Version
- 서류, 과제, 코딩 테스트와 면접 진행 상태
- 불합격·보류·합격 결과와 확인 가능한 피드백
- 다음 행동과 일정

매주 지원 수뿐 아니라 맞춤 작성 비율, 서류 통과율, 코딩 테스트·면접 전환율과 반복해서 부족했던 역량을 확인한다. 표본이 적을 때는 수치를 일반화하지 않고 이력서와 학습 계획을 조정하는 참고 자료로만 사용한다.

## 15. 알려진 위험과 대응

| 위험 | 대응 |
|---|---|
| 공통 Agent 기반과 캐릭터 사업 기능을 동시에 과도하게 확장함 | Knowledge·Model·Connector는 명시한 MVP 계약까지만 구현하고 나머지는 후속 범위로 유지 |
| Agent Framework 비교에 시간이 과도하게 사용됨 | 1주차 종료 시 하나를 선택하고 비교를 중단 |
| Google ADK Java Preview 변경 위험 | Adapter 격리, 버전 고정, 계약 테스트, Spring AI 기본 대안 |
| 캐릭터 회사 구현에 집중해 공통 기반이 약해짐 | 공통 Kernel의 인수 조건을 먼저 구현 |
| 공통화를 과도하게 설계해 사용자 흐름이 늦어짐 | 캐릭터 회사에 필요한 기능만 공통화 |
| 위임 정책 오류로 Agent 권한이 과도하게 확대됨 | 기본 거부, 정책 상한, 자기 권한 상승 차단과 적용 직전 재검증 |
| 인간과 Proxy Agent의 Identity가 뒤섞여 책임 소재가 불명확해짐 | 별도 Identity, 명시적 Proxy Delegation, 실제 수행자·제출자 Provenance 기록 |
| 외부 전문가의 개인정보, 계약과 결과물 권리 처리 범위가 과도해짐 | MVP는 사전 등록된 한 명의 Contributor 배정으로 제한하고 실제 계약·급여 처리는 제외 |
| 비신뢰 저장소 코드가 Host 또는 Secret에 접근함 | 단일 저장소, 허용 경로·명령과 폐기 가능한 격리 Runner |
| 모델의 추측·민감정보·Prompt Injection이 장기 Memory로 남음 | 허용 유형과 원본 Message를 검증하고 사용자·Character 격리, Version, 만료와 사용자 삭제를 강제 |
| 평가가 주관적인 인상에 머묾 | 고정 Dataset의 검증 가능한 계약, 대표 표본 검토와 Event 기반 수치 사용 |
| 실제 사용자를 충분히 확보하지 못함 | 최소 3명의 피드백을 탐색적 사용성 자료로 제한하고 합성 데이터와 구분 |
| 공지의 많은 기술 키워드를 모두 별도 실습해 프로젝트가 분산됨 | 핵심 사용자 흐름에서 필요한 기술만 선택하고 구현·테스트 결과를 학습 증거로 사용 |
| 일정 지연 | 6주 필수 구현, 7~8주 예비 기간 및 새 기능 금지 |
