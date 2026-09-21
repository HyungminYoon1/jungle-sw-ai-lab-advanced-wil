# SW AI Lab 심화과정 12주 주차별 Roadmap

> 작성일: 2026-08-18
> 최종 수정일: 2026-09-21
> 상태: Active
> 전체 기간: 기술 심화 8주 + 취업 심화 4주
> 공통 실습: AI Helpdesk Learning Lab

이 문서는 각 주의 핵심 질문, 선택한 공지 학습 주제, 최소 실험과 완료 근거를 정의한다. 전체 목표와 범위는 `SW AI Lab 심화과정 12주 학습 계획`, 학습·WIL 작성 방식은 `학습 및 기술 콘텐츠 계획`을 따른다.

## Roadmap 운영 원칙

- 한 주에는 핵심 질문 한 가지와 2~4개의 밀접한 개념만 우선한다.
- 개념을 설명하고 예상한 뒤 최소 실패·비교 실험을 먼저 수행한다.
- Week 1~8 Helpdesk Lab 적용은 한 수직 흐름에 필요한 범위로 제한하고 수평 기능을 추가하지 않는다.
- 통합 비용이 개념 학습보다 커지면 독립 Spike로 원인을 먼저 확인하되, PostgreSQL 영속성·Security·AI 검증·배포 같은 필수 수직 연결은 생략하지 않는다.
- Week 9~12에는 취업 활동을 우선하며 AI 보조 수평 확장을 주 6시간 이내에서 수행한다.
- 매주 최소 한 개의 설명·Test·Trace·Query Plan·Metric 또는 평가 결과를 남긴다.
- 미완료 주제를 다음 주에 무조건 누적하지 않고 중요도와 선행 조건을 다시 판단한다.
- 이미 사용하는 도구는 운영 Baseline으로 짧게 진단하고, 확인된 공백만 보충한다.
- 기술 심화 8주 동안 AgentOps Lab 구현을 시작하지 않는다.

## 학습 항목 선택 절차

1. 이번 주 직무 역량에서 가장 중요한 질문을 정한다.
2. 공지의 관련 키워드를 `핵심 학습`, `운영 Baseline`, `선택 적용`, `독립 Spike`, `조건부 후속`, `선정 제외`로 구분한다.
3. 실험 전에 예상 결과와 실패 조건을 적는다.
4. 관찰 결과를 설명한 뒤 필요한 경우에만 Helpdesk Lab에 적용한다.
5. 주말에 설명 가능성, 실패 원인과 다음 질문을 WIL로 정리한다.

## 1주차 — Java 객체지향·JUnit (Git 운영 Baseline)

### 핵심 질문

> Framework 없이 객체가 자신의 상태와 규칙을 지키게 만들고, 그 계약을 Test로 설명할 수 있는가?

### Git 운영 Baseline

- Git은 별도 학습 Block을 배정하지 않고 모든 문서·Source 변경에 계속 적용한다.
- Week 1 시작 시 20~30분 자가진단으로 Working Tree·Index·HEAD를 구분하고 `status`, `diff`, `diff --staged`의 결과를 설명한다.
- 실제 변경을 검토 가능한 작은 Commit으로 나누고, 되돌릴 대상이 Working Tree·Index·공개된 Commit 중 어디에 있는지 먼저 판단한다.
- Merge·Rebase·Conflict는 자가진단에서 공백이 확인되거나 실제 협업 상황이 생길 때만 안전한 실험 Repository에서 보충한다.

### 핵심 학습

- Java Class·Object, 불변 값, Collection과 Exception
- Encapsulation, Abstraction, Polymorphism과 Composition
- SOLID를 규칙 암기가 아니라 변경 영향으로 판단하는 방법
- JUnit과 Given-When-Then

### 실험과 적용

- Framework 없는 Ticket 상태 전이와 담당자 할당 규칙 구현
- 외부에서 상태를 직접 변경할 수 있는 코드와 객체가 규칙을 지키는 코드 비교
- 분기문 기반 Policy를 작은 Strategy 또는 Composition으로 바꾸고 변경 범위 비교
- 정상·경계·잘못된 상태 전이를 JUnit으로 검증

### 완료 근거

- Ticket Domain Unit Test와 실패 Case
- 상속·Composition 또는 분기·다형성 비교 Lab Report
- Week 1 WIL

Git은 핵심 학습 완료 조건과 분리한다. 운영 Baseline의 개념·안전 경계와 자가진단 상태는 Week 1 Learning Note에 남기되, 실행하지 않은 항목은 완료로 표시하지 않는다.

### 이번 주 비범위

- Spring Boot, Database, Browser UI와 LLM 연동
- Design Pattern 개수 채우기
- Git 명령 전반을 다시 수강하는 Tutorial과 필수 Merge·Rebase 비교 실험
- AgentOps Lab Domain 재사용

## 2주차 — HTTP·REST·Spring 요청 흐름

### 핵심 질문

> 하나의 HTTP 요청이 Spring의 각 Layer를 통과하는 흐름과 책임을 직접 추적할 수 있는가?

### 핵심 학습

- DNS와 TCP 연결에서 HTTP Request·Response까지의 기본 흐름
- HTTP Method, Status, Header, Content Type과 Stateless 의미
- REST Resource 설계와 일관된 오류 응답
- Spring MVC, DI·IoC와 Controller·Service·Repository 책임
- Filter·Interceptor·Exception Handler의 차이
- CORS Simple Request와 Preflight

### 실험과 적용

- `curl` 또는 Browser Network Panel로 Request·Response와 Header 관찰
- TCP Echo 또는 연결 관찰은 짧은 독립 Spike로 수행
- In-memory Repository를 사용하는 Ticket 생성·조회 API 구현
- Controller에 규칙을 둔 버전과 Application·Domain에 분리한 버전 비교
- 잘못된 입력, 존재하지 않는 Resource와 내부 오류의 응답 계약 검증
- 서로 다른 Origin에서 CORS 실패와 허용 조건 재현

### 완료 근거

- Browser 또는 Client부터 Domain까지의 Request Trace
- Layer별 책임과 금지 의존성을 설명하는 Learning Note
- 정상·4xx·5xx HTTP Test
- Week 2 WIL

### 이번 주 비범위

- 인증 구현, PostgreSQL 영속화와 AI 호출
- GraphQL, Message Queue, Cache와 Load Balancing
- 두 Backend Framework 비교 구현

## 3주차 — PostgreSQL·Transaction·Lock·Index

### 핵심 질문

> Database의 Transaction과 실행 계획이 Ticket의 일관성과 조회 성능에 어떤 영향을 주는가?

### 핵심 학습

- 정규화, Key, 관계와 Constraint
- ACID, Commit·Rollback과 Isolation Level
- 낙관적·비관적 Lock과 Deadlock
- Index, 복합 Index와 `EXPLAIN ANALYZE`
- JPA Persistence Context, Lazy Loading과 N+1
- Connection Pool의 역할과 고갈 신호

### 실험과 적용

- 중복과 갱신 이상이 있는 Table을 정규화하고 Trade-off 기록
- PostgreSQL과 Migration으로 Ticket 저장·조회 연결
- 같은 Ticket을 동시에 할당하거나 상태 변경해 Lost Update 재현
- Lock 전략 적용 전후의 결과와 실패 방식 비교
- 데이터 분포를 고정하고 Index 전후의 실행 계획 비교
- Comment 또는 담당자 조회에서 N+1을 재현하고 Query 수 확인
- Testcontainers로 실제 PostgreSQL Integration Test 작성

### 완료 근거

- ERD와 Constraint 선택 근거
- Transaction·동시성 Integration Test
- Index 전후 Query Plan과 해석
- N+1 재현·개선 기록
- Week 3 WIL

### 이번 주 비범위

- Replication, Sharding과 Production Capacity 설계
- NoSQL Service를 별도로 구현
- 측정 없는 Cache 추가

## 4주차 — 인증·인가·Web Security

> 2026-09-07 일정 조정: 이번 주는 월·금·토 3일만 사용하므로 Session 인증 수직 흐름을 필수 범위로 축소한다. 아래 원래 Roadmap 중 이월·제외 범위와 실행 순서는 [Week 4 학습 계획](../week4/weekly-plan.md)을 따른다.

### 핵심 질문

> 사용자가 누구인지 확인하는 것과 행동 권한을 검사하는 것을 분리하고, Browser 공격 경계를 재현할 수 있는가?

### 핵심 학습

- Authentication과 Authorization
- Password Hashing, Salt와 안전한 비교
- Cookie·Session, HttpOnly, Secure와 SameSite
- Server-side 권한 검사와 Role
- XSS, CSRF와 SQL Injection
- Rate Limiting과 Secret 관리
- HTTPS와 신뢰 사슬의 기본

### 실험과 적용

- 사용자와 담당자 Session 로그인 한 가지 구현
- 화면에서 버튼을 숨겨도 직접 API 호출이 가능한 실패 Case 재현
- Password 원문 저장과 안전한 Hash 저장 차이 확인
- 의도적으로 취약한 입력 처리에서 XSS·SQL Injection을 안전한 로컬 환경에서 재현
- CSRF 보호 활성·비활성 조건과 SameSite 동작 관찰
- Login Endpoint의 간단한 Rate Limit과 실패 응답 확인
- Source·Log·설정에서 Secret 값이 노출되지 않는지 점검

### 완료 근거

- 인증·인가 Policy 표
- 권한 우회, CSRF·XSS·SQL Injection 방어 Test
- Cookie·Session Header 관찰 Note
- 공개 가능한 간단한 Threat Model
- Week 4 WIL과 중간 Scope Review

### 이번 주 비범위

- JWT·Refresh Token·OAuth2를 Session과 함께 구현
- 분산 Session Cluster와 File Upload
- 보안 제품 수준의 침투 Test 주장

## 5주차 — Browser JavaScript·Frontend·Test 품질

### 핵심 질문

> Browser의 비동기 실행과 Rendering을 이해하면서 최소 사용자 흐름을 신뢰할 수 있게 검증할 수 있는가?

### 핵심 학습

- Call Stack, Task·Microtask Queue와 Event Loop
- Promise·Async/Await, Loading·Empty·Error 상태
- Event Bubbling과 Delegation
- DOM·CSSOM·Render Tree와 기본 Rendering 비용
- Unit·Integration·E2E Test의 책임
- Test Double, Coverage와 정적 분석의 한계

### 실험과 적용

- Event Loop 실행 순서를 예상하고 실제 결과와 비교하는 독립 Spike
- Vanilla JavaScript로 Ticket 등록·단건 조회 상태 화면 구현
- 동적 목록에서 개별 Listener와 Event Delegation 비교
- 일부 API가 실패해도 상태가 구분되는 UI 구현
- 핵심 사용자 흐름 한 개를 Browser E2E로 검증
- Domain Unit, Security Integration과 E2E가 중복 검증하지 않도록 역할 정리
- Coverage가 높지만 결함을 잡지 못하는 예와 의미 있는 실패 Test 비교

### 완료 근거

- Event Loop 예상·관찰 결과
- 최소 Browser 사용자 흐름
- Test Pyramid와 핵심 E2E 실행 결과
- 정적 분석 또는 Coverage 해석 Note
- Week 5 WIL

### 이번 주 비범위

- React, SSR, Redux·Zustand와 복잡한 Build 최적화
- 시각적 장식과 Design System
- 모든 경로의 E2E 자동화

Week 5는 Event Loop·Rendering·Promise의 일부 실행 근거를 확보했지만 Fetch 이후 UI·Test와 실제 PostgreSQL 수직 연결을 완료하지 못했다. 이 상태를 `Partially Completed`로 보존하고 Week 6에서 미완료 범위와 Week 3 PostgreSQL Adapter 보류분을 함께 마감한다.

## 6주차 — Browser·PostgreSQL·Test 수직 마감

### 핵심 질문

> Browser의 Session 요청이 실제 PostgreSQL 영속성까지 이어지고, 각 계층의 실패를 Test와 Trace로 구분할 수 있는가?

### 핵심 학습

- Promise·Async/Await, Fetch의 HTTP 오류와 Network 오류
- CORS, Event Delegation, Browser Rendering과 Loading·Error 상태
- PostgreSQL Migration과 Repository Adapter
- Transaction·Constraint와 Domain 오류 Mapping
- Testcontainers 기반 실제 Database Integration Test
- Unit·Integration·Browser E2E의 책임, Coverage와 정적 분석

### 실험과 적용

- `2xx`·`403`·`404`·Network 실패를 구분하는 최소 Ticket UI
- 두 Local Origin에서 CORS 실패·Preflight·허용 Header 비교
- In-memory와 PostgreSQL Repository 구현체를 같은 Port 뒤에서 교체
- Migration으로 Schema를 재현하고 Ticket 등록·조회·재시작 후 영속성 확인
- 실제 PostgreSQL Container에서 Constraint·Transaction 실패와 Rollback 확인
- Session Login부터 Ticket 등록·조회·PostgreSQL까지 대표 Browser 흐름 한 개 검증
- Coverage 사각지대와 Lint 실패를 각각 재현하고 Test 책임 표 작성

### 완료 근거

- Fetch·CORS·DOM Event의 예상·실행·관찰 기록
- PostgreSQL Adapter·Migration Source와 Testcontainers 실행 결과
- Local SQL 실험, In-memory Test와 실제 PostgreSQL Integration Test의 명시적 구분
- 최소 Browser UI와 대표 E2E 또는 Gate 실패가 포함된 `NOT_RUN` 기록
- Java·JavaScript 회귀 결과와 Week 6 WIL

### 이번 주 비범위

- Comment, 검색·Pagination, 알림, Dashboard와 UI 장식
- React·SSR·전역 상태 Library
- N+1·Connection Pool·Replication을 제품 기능과 함께 확장
- Security를 끄거나 Credential을 Source에 넣어 E2E를 통과시키는 방식

## 7주차 — LLM Structured Output·평가·Guardrail

### 핵심 질문

> LLM의 자연어 출력을 정상 Domain 결과로 바로 믿지 않고 Schema·Dataset·실패 상태로 검증할 수 있는가?

### 핵심 학습

- Prompt 역할과 입력·출력 경계
- JSON Schema 기반 Structured Output
- Provider 실패, Timeout과 Schema Validation
- 고정 Dataset, Rubric과 회귀 평가
- Prompt Injection과 입력·출력 Guardrail
- Tool Calling의 선택·Argument Validation 원리

### 실험과 적용

- 같은 문의에서 Prompt-only JSON과 강제 Structured Output 안정성 비교
- Schema와 Guardrail을 통과한 요약·카테고리·우선순위 Suggestion만 PostgreSQL에 별도 결과로 저장
- 정상·모호·악성 입력을 포함한 작은 Versioned Dataset 구성
- 정확성, Schema 준수, Latency와 비용을 같은 조건에서 기록
- Prompt Injection 입력과 민감 정보 출력 방지 Case 확인
- Tool Calling은 실제 Side Effect 없이 허용 목록과 Argument Validation Spike로 제한

### 완료 근거

- Prompt·Schema·Dataset Version
- 평가 결과와 대표 실패 Case
- Provider 실패·Timeout·Invalid Output Test
- 검증 실패 결과가 Domain 상태와 PostgreSQL을 오염시키지 않는 Integration Test
- Guardrail 한계와 Human 확인 경계
- Week 7 WIL

### 이번 주 비범위

- Multi-Agent Workflow, RAG와 Vector Database
- LoRA, VLM과 대규모 Model Benchmark
- 실제 Email·일정·게시 Side Effect

## 8주차 — DevOps·System·AWS Cloud·HTTPS 수직 배포

### 핵심 질문

> 실제 PostgreSQL을 사용하는 Helpdesk를 Container·CI·AWS·HTTPS로 재현하고, Process와 Request 실패를 Log·Metric에서 추적할 수 있는가?

### 핵심 학습

- Image·Container·Layer, Dockerfile과 Build Cache
- Docker Compose Network·Volume·환경 변수와 Application·PostgreSQL 연결
- GitHub Actions Build·Test·정적 검사와 ECR Image 전달
- Linux Process·Exit Code·Signal·Graceful Shutdown, `/proc`와 CLI Log Pipeline
- 구조화된 Log, Health Check와 최소 Request·Error·Latency Metric
- IAM User·Role·Policy와 최소 권한
- ECS·ECR Container 실행 책임과 RDS 관리형 Database 책임
- Route 53 DNS, ACM Certificate, TLS 신뢰 사슬과 HTTPS
- 환경별 Secret 분리, RDS Backup과 Application Rollback 경계

### 실험과 적용

- 새 환경에서 Docker Compose로 Application과 PostgreSQL을 실행하고 실제 저장·조회
- Dockerfile Layer 순서를 바꾸어 Cache Hit·Miss와 Build 시간을 비교
- CI의 Test 실패·복구·Image Build를 확인하고 민감 값은 출력하지 않음
- SIGTERM과 강제 종료에서 요청·Connection·Exit Code와 남은 Process 비교
- ECR Image를 ECS에 배포하고 IAM 권한 부족과 최소 권한 추가 과정을 관찰
- Application이 RDS PostgreSQL에 연결되고 재배포 뒤에도 Ticket이 유지되는지 확인
- Route 53과 ACM으로 DNS 검증·HTTPS 연결·HTTP Redirect와 Certificate를 관찰
- CloudWatch Log·Metric에서 의도적으로 발생시킨 오류 Request를 추적
- 잘못된 Application Version을 이전 Image로 되돌리고 RDS Backup·복구 책임을 문서화

### 완료 근거

- Dockerfile·Compose와 Clean Run 절차
- GitHub Actions 실패·복구 및 ECR Image 근거
- Process·Signal·Exit Code·`/proc` 관찰 Note
- IAM 최소 권한, ECS·RDS 연결과 CloudWatch 오류 추적 결과
- 공개 HTTPS Request·Certificate·DNS Trace와 실제 PostgreSQL 영속성
- Application Rollback, RDS Backup 경계, 비용·Resource 정리 Checklist
- Week 8 최종 WIL과 Portfolio용 수직 흐름 설명

### 이번 주 비범위

- Jenkins, Kubernetes, Blue-Green·Canary와 무중단 배포
- Prometheus·Grafana·Loki 전체 Stack
- Auto Scaling, WAF, CloudFront, Terraform과 Multi-AZ 고가용성 검증
- Mini Shell, Mini VM과 복잡한 IPC
- Comment·검색·알림·Dashboard 같은 수평 기능
- AgentOps Lab 재개

## 9주차 — 취업 Baseline과 근거 전환

### 핵심 질문

> 학습한 기술을 기능 나열이 아니라 문제·행동·검증·한계로 설명할 수 있는가?

### 활동

- 직무별 기준 이력서와 Portfolio 설명 정리
- Helpdesk Lab의 직접 구현·AI 보조·미구현 범위 구분
- Java·Spring·Database·Security·AI 면접 질문 Baseline
- Coding Test와 지원 활동 추적 방식 확정
- 취업 근거에 도움이 되는 Comment·상태 변경·검색·알림·Dashboard 중 필요한 기능만 AI로 수평 확장
- AI 생성 Code는 요구사항·Module 책임·데이터·권한·실패·Acceptance Test를 검토한 뒤 인수하고 주 6시간을 넘기지 않음

### 완료 근거

- 직무별 Project 설명과 대표 근거 Link
- AI 보조 구현 범위와 사용자가 직접 검토·판단한 범위
- 취약 개념 목록과 보완 순서
- 주간 취업 활동 요약과 WIL

## 10주차 — 맞춤 지원과 기술 면접 보완

### 핵심 질문

> 공고가 요구하는 역량을 현재 근거로 설명하고 부족한 부분만 학습할 수 있는가?

### 활동

- 공고별 핵심 역량을 선정하고 맞춤 지원
- 예상 질문을 Helpdesk 실험과 연결해 답변
- 면접에서 설명이 막힌 개념 한두 개를 작은 Spike로 보완
- 지원·응답 결과를 기준으로 이력서 문장 수정

### 완료 근거

- 맞춤 지원 기록과 변경한 근거
- 모의 면접 Feedback
- 보완 Spike와 Learning Note

## 11주차 — 면접·과제 대응과 취약 개념 재학습

### 핵심 질문

> 실제 면접·과제에서 드러난 약점을 재현 가능한 학습 질문으로 바꿀 수 있는가?

### 활동

- 면접, 과제와 Coding Test 일정 우선
- 반복되는 오답과 기술 질문 분류
- 가장 중요한 취약 개념을 최소 실험으로 재학습
- 새로운 대형 기능 대신 결함, 문서와 재현성만 보완

### 완료 근거

- 오답·질문 분류와 수정된 답변
- 재학습 전후 설명 비교
- 취업 활동 요약

## 12주차 — 최종 회고와 다음 단계

### 핵심 질문

> 12주 동안 실제로 이해·검증한 범위와 앞으로 학습할 범위를 정직하게 구분할 수 있는가?

### 활동

- 지원, 면접, Coding Test와 Portfolio 결과 정리
- 학습 목표별 `Completed`, `Partially Completed`, `Deferred` 판정
- 공개 문서, Secret과 개인정보 최종 점검
- 다음 4~8주의 취업·학습 계획 작성
- AgentOps Lab은 가용 시간과 새 Scope가 있을 때만 별도 재검토

### 완료 근거

- 12주 최종 회고
- 직무별 근거와 취약 주제 목록
- 후속 학습·취업 계획

## 주차별 변경 관리

Weekly Plan의 Baseline 이후 학습 항목을 조용히 추가하거나 완료로 바꾸지 않는다. 변경할 때는 날짜, 변경 전·후, 이유, 핵심 질문과 다음 주 영향을 기록한다.

| 날짜 | 변경 | 이유 | 영향 |
|---|---|---|---|
| 2026-09-21 | Week 5 미완료와 PostgreSQL Adapter를 Week 6에서 수직 마감하고, AI Native를 Week 7, DevOps·System·AWS Cloud·HTTPS를 Week 8로 재배치 | 기술 심화 공지는 선택 기술을 실제 활용 가능한 수준과 라이브 서비스 흐름으로 연결하도록 요구하며, 수평 기능보다 수직 깊이를 우선한다는 사용자 결정 | Week 1~8은 `DEEP_LEARNING_MODE`, Week 9~12는 취업 우선 `AI_ASSISTED_PRODUCTIZATION_MODE`로 운영 |
