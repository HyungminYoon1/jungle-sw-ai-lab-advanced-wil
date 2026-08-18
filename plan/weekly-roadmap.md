# SW AI Lab 심화과정 12주 주차별 Roadmap

> 작성일: 2026-08-18
> 상태: Active
> 전체 기간: 기술 심화 8주 + 취업 심화 4주
> 공통 실습: AI Helpdesk Learning Lab

이 문서는 각 주의 핵심 질문, 선택한 공지 학습 주제, 최소 실험과 완료 근거를 정의한다. 전체 목표와 범위는 `SW AI Lab 심화과정 12주 학습 계획`, 학습·WIL 작성 방식은 `학습 및 기술 콘텐츠 계획`을 따른다.

## Roadmap 운영 원칙

- 한 주에는 핵심 질문 한 가지와 2~4개의 밀접한 개념만 우선한다.
- 개념을 설명하고 예상한 뒤 최소 실패·비교 실험을 먼저 수행한다.
- Helpdesk Lab 적용은 학습 질문에 필요한 최소 범위로 제한한다.
- 서비스 통합 비용이 개념 학습보다 커지면 독립 Spike로 전환한다.
- 매주 최소 한 개의 설명·Test·Trace·Query Plan·Metric 또는 평가 결과를 남긴다.
- 미완료 주제를 다음 주에 무조건 누적하지 않고 중요도와 선행 조건을 다시 판단한다.
- 기술 심화 8주 동안 AgentOps Lab 구현을 시작하지 않는다.

## 학습 항목 선택 절차

1. 이번 주 직무 역량에서 가장 중요한 질문을 정한다.
2. 공지의 관련 키워드를 `핵심 학습`, `선택 적용`, `독립 Spike`, `조건부 후속`, `선정 제외`로 구분한다.
3. 실험 전에 예상 결과와 실패 조건을 적는다.
4. 관찰 결과를 설명한 뒤 필요한 경우에만 Helpdesk Lab에 적용한다.
5. 주말에 설명 가능성, 실패 원인과 다음 질문을 WIL로 정리한다.

## 1주차 — Git·Java 객체지향·JUnit

### 핵심 질문

> Framework 없이 객체가 자신의 상태와 규칙을 지키게 만들고, 그 계약을 Test로 설명할 수 있는가?

### 핵심 학습

- Git Working Tree·Staging Area·Commit과 `status`·`diff`·`log`
- 작은 Commit, Branch와 Commit Message Convention
- Java Class·Object, 불변 값, Collection과 Exception
- Encapsulation, Abstraction, Polymorphism과 Composition
- SOLID를 규칙 암기가 아니라 변경 영향으로 판단하는 방법
- JUnit과 Given-When-Then

### 실험과 적용

- 안전한 Branch에서 Staging·Unstage·Restore·Revert 흐름 관찰
- 같은 Conflict를 Merge와 Rebase에서 재현하고 History 비교
- Framework 없는 Ticket 상태 전이와 담당자 할당 규칙 구현
- 외부에서 상태를 직접 변경할 수 있는 코드와 객체가 규칙을 지키는 코드 비교
- 분기문 기반 Policy를 작은 Strategy 또는 Composition으로 바꾸고 변경 범위 비교
- 정상·경계·잘못된 상태 전이를 JUnit으로 검증

### 완료 근거

- Git 3단계 영역과 안전한 되돌리기 방식을 설명하는 Learning Note
- Ticket Domain Unit Test와 실패 Case
- 상속·Composition 또는 분기·다형성 비교 Lab Report
- Week 1 WIL

### 이번 주 비범위

- Spring Boot, Database, Browser UI와 LLM 연동
- Design Pattern 개수 채우기
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
- Vanilla JavaScript로 Ticket 목록·상세·등록 화면 구현
- 동적 목록에서 개별 Listener와 Event Delegation 비교
- 일부 API가 실패해도 상태가 구분되는 UI 구현
- 핵심 사용자 흐름 한 개를 Browser E2E로 검증
- Domain Unit, Database Integration과 E2E가 중복 검증하지 않도록 역할 정리
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

## 6주차 — LLM Structured Output·평가·Guardrail

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
- 요약·카테고리·우선순위 Suggestion을 별도 결과로 저장
- 정상·모호·악성 입력을 포함한 작은 Versioned Dataset 구성
- 정확성, Schema 준수, Latency와 비용을 같은 조건에서 기록
- Prompt Injection 입력과 민감 정보 출력 방지 Case 확인
- Tool Calling은 실제 Side Effect 없이 허용 목록과 Argument Validation Spike로 제한

### 완료 근거

- Prompt·Schema·Dataset Version
- 평가 결과와 대표 실패 Case
- Provider 실패·Timeout·Invalid Output Test
- Guardrail 한계와 Human 확인 경계
- Week 6 WIL

### 이번 주 비범위

- Multi-Agent Workflow, RAG와 Vector Database
- LoRA, VLM과 대규모 Model Benchmark
- 실제 Email·일정·게시 Side Effect

## 7주차 — Docker·CI·관측·Linux Process

### 핵심 질문

> 다른 환경에서도 같은 방식으로 실행하고, 실패한 Process와 Request의 단서를 로그·Metric에서 찾을 수 있는가?

### 핵심 학습

- Image·Container·Layer와 Dockerfile
- Docker Compose Network, Volume과 환경 변수
- GitHub Actions의 Build·Test·정적 검사
- 구조화된 Log, Health Check와 최소 Metric
- Linux Process, Exit Code, Signal과 Graceful Shutdown
- `ps`, `top`, `kill`, Log Pipeline과 `/proc`

### 실험과 적용

- Application과 PostgreSQL을 Compose로 재현
- Layer 순서에 따른 Build Cache 차이 관찰
- Pull Request 또는 Push에서 Test가 실패·성공하는 CI 확인
- Secret은 CI Secret 또는 환경 변수로만 주입하고 값은 출력하지 않음
- SIGTERM과 강제 종료에서 종료 흐름과 남은 Process 확인
- Log를 CLI Pipeline으로 집계하고 오류 요청을 추적
- 필요한 최소 Request 수·오류·Latency Metric 관찰

### 완료 근거

- 새 환경 실행 절차
- CI 실패·복구 결과
- Process·Signal·Exit Code 관찰 Note
- Log·Metric 기반 실패 추적 예
- Week 7 WIL

### 이번 주 비범위

- Jenkins, Kubernetes와 무중단 배포
- Prometheus·Grafana·Loki 전체 Stack을 목표로 삼기
- Mini Shell, Mini VM과 복잡한 IPC

## 8주차 — 최소 Cloud·HTTPS·통합 복습

### 핵심 질문

> 선택한 학습 결과를 공개 가능한 환경에서 재현하고, 이해한 범위와 남은 한계를 정확히 설명할 수 있는가?

### 핵심 학습

- 최소 권한과 환경별 Secret 분리
- DNS Record, TLS Certificate와 HTTPS
- 관리형 실행 환경과 Database의 책임 경계
- 배포·Rollback·Backup의 기본
- 전체 학습 근거의 연결과 설명 가능성

### 실험과 적용

- 비용과 운영 부담을 먼저 확인하고 한 개 환경에만 최소 배포
- 공개 Domain이 필요할 때 DNS와 HTTPS 흐름 관찰
- 불필요한 공개 Port와 권한 제거
- 장애 또는 잘못된 배포를 이전 Version으로 되돌리는 절차 확인
- 실행 방법, 범위, 알려진 한계와 비용을 문서화
- Week 1~7의 취약 개념을 재실험하고 새 기능은 시작하지 않음

### 완료 근거

- 최소 배포·실행 안내와 공개 Checklist
- HTTPS·권한·Secret 점검 결과
- 선택한 핵심 학습의 대표 Test·Trace·Query Plan·평가 Link
- 8주 최종 WIL과 Portfolio용 학습 요약

### 이번 주 비범위

- ECS·ECR·RDS·WAF·CloudFront·Terraform을 모두 구성
- Auto Scaling과 고가용성 검증 주장
- AgentOps Lab 재개

## 9주차 — 취업 Baseline과 근거 전환

### 핵심 질문

> 학습한 기술을 기능 나열이 아니라 문제·행동·검증·한계로 설명할 수 있는가?

### 활동

- 직무별 기준 이력서와 Portfolio 설명 정리
- Helpdesk Lab의 직접 구현·AI 보조·미구현 범위 구분
- Java·Spring·Database·Security·AI 면접 질문 Baseline
- Coding Test와 지원 활동 추적 방식 확정

### 완료 근거

- 직무별 Project 설명과 대표 근거 Link
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
