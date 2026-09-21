# SW AI Lab 심화과정 12주 학습 계획

> 작성일: 2026-08-18
> 최종 수정일: 2026-09-21
> 상태: Active
> 대상 기간: 기술 심화 8주 + 취업 심화 4주
> 대상 직무: AI/AX 개발자, Java Backend 개발자, AI Platform·LLMOps Backend 개발자

이 문서는 12주의 학습 목표, 선택 범위, 운영 원칙과 성공 기준을 정의하는 최상위 계획이다. 주차별 세부 순서는 `12주 주차별 Roadmap`, 학습 증거와 공개 기록 방식은 `학습 및 기술 콘텐츠 계획`을 따른다.

## 1. 과정 목적

기술 심화 기간의 우선 목표는 큰 서비스를 완성하는 것이 아니다. 필요한 기술을 선택하고 다음 능력을 만드는 것이다.

- 개념의 동작 원리를 자신의 말로 설명한다.
- 예상과 실제 결과가 다른 최소 실험을 설계하고 원인을 찾는다.
- Framework가 숨긴 동작을 Request, Transaction, Query와 Process 수준에서 추적한다.
- 작은 코드를 직접 수정하고 실패를 재현하는 Test를 작성한다.
- 선택, Trade-off, 실패와 한계를 WIL과 기술 글로 전달한다.

Week 1~8에는 기능 종류를 넓히지 않고 선택한 기술의 수직 흐름을 실제로 연결한다. Week 9~12에는 취업 활동을 우선하면서 검증된 수직 기반 위에서 AI를 활용해 Portfolio 기능을 수평 확장한다.

## 2. 지원 직무와 우선순위

1. **AI/AX 개발자**: LLM Application, 업무 자동화와 AI 기능 Backend
2. **Java Backend 개발자**: Spring Boot, PostgreSQL, 인증·인가, Test와 운영
3. **AI Platform·LLMOps Backend 개발자**: Model·Prompt·Tool 실행, 평가와 관측

학습 우선순위는 Java·Web·Database·Test·Security 기반을 먼저 두고 AI Native와 운영 학습을 그 위에 연결한다. 특정 Library 사용 자체보다 원리, 실패 처리와 설명 가능성을 우선한다.

## 3. 공통 실습 대상

`AI Helpdesk Learning Lab`은 반복 설정 비용을 줄이고 여러 기술을 같은 Domain에서 비교하기 위한 작은 실습 대상이다.

학습용이라는 말은 실제 연결을 생략한다는 뜻이 아니다. 선택한 수직 흐름에서는 Browser, Security, Application, PostgreSQL, AI, Test와 배포가 실제로 이어져야 한다. 최소화하는 대상은 기술의 깊이가 아니라 동시에 만드는 기능의 종류다.

### 핵심 사용자 흐름

1. 사용자가 로그인한다.
2. 문의를 등록하고 다시 조회한다.
3. AI가 요약, 카테고리와 우선순위를 구조화해 제안한다.
4. 담당자가 제안을 확인하고 Ticket 상태를 변경한다.
5. 사용자는 처리 이력을 조회한다.

### Week 8 수직 흐름 목표

Week 8 종료 전에는 다음 최소 흐름을 실제 환경에서 연결하고 근거를 남긴다.

1. Browser가 HTTPS로 Session 로그인과 Ticket 요청을 보낸다.
2. Security Filter Chain이 인증·인가·CSRF를 검사한다.
3. Controller와 Application Service가 Domain 규칙을 실행한다.
4. PostgreSQL Adapter가 Migration으로 생성된 Schema에 Ticket과 검증된 AI Suggestion을 저장한다.
5. 실제 PostgreSQL Integration Test와 대표 Browser E2E가 계층 연결을 확인한다.
6. CI가 Build·Test·정적 검사를 실행하고, Container Image가 Cloud 환경에 배포된다.
7. Secret을 Source와 Log에서 분리하고 Health·Log·Metric·HTTPS·Rollback 근거를 남긴다.

### 고정 범위

- User, Ticket, Comment와 AI Suggestion 이내의 Domain
- Session 인증과 사용자·담당자 권한
- PostgreSQL Migration·Repository Adapter·Integration Test와 최소 Browser 화면
- Structured Output 한 개, 고정 평가 Dataset과 실패 처리
- Docker Compose, GitHub Actions, 한 개 Cloud 배포 환경과 HTTPS

### 범위 제한

- AI는 제안만 하며 외부 Side Effect를 자동 실행하지 않는다.
- Week 1~8에는 로그인·Ticket 등록·조회·AI Suggestion 확인이라는 한 수직 흐름에 필요한 코드만 추가한다.
- 같은 기능을 여러 Framework로 완성하지 않는다.
- 제품에 맞지 않는 개념은 독립 Spike로 먼저 재현하되, 선택한 수직 흐름의 필수 연결을 Spike로 대체하지 않는다.
- Week 1~8에는 Comment 확장, 검색·Pagination, 알림, Dashboard와 UI 장식을 추가하지 않는다.
- Week 9~12에는 AI가 기능 Code 초안을 만들 수 있지만, 사용자는 요구사항·Architecture·데이터·권한·실패 처리·Acceptance Test와 운영 결과를 검토한다.

## 4. 학습 항목 상태

| 상태 | 의미 | 완료 근거 |
|---|---|---|
| 핵심 학습 | 직무 기반을 위해 반드시 학습 | 설명, 최소 재현 실험, Test 또는 Trace |
| 운영 Baseline | 이미 사용하는 도구를 별도 학습 Block으로 편성하지 않고 전 과정에 적용 | 짧은 자가진단, 실제 History·Review·복구 기록 |
| 선택 적용 | 공통 Lab에서 원리를 확인할 가치가 있음 | 작은 기능, Test와 적용 전후 해석 |
| 독립 Spike | Lab에 통합하지 않고 별도 실험 | 질문, 예상, 조건, 관찰과 결론 |
| 조건부 후속 | 실제 필요나 측정 결과가 생길 때 수행 | 선행 조건과 보류 이유 |
| 선정 제외 | 8주 목표와 비용이 맞지 않음 | 제외 이유와 재검토 조건 |

모든 공지 항목을 완료하는 것은 목표가 아니다. 하지 않기로 한 이유를 설명할 수 있는 것도 학습 판단의 일부다.

운영 Baseline은 주간 핵심 학습 수에 포함하지 않는다. 자가진단에서 설명하거나 안전하게 수행하지 못한 항목만 독립 Spike 또는 조건부 후속으로 전환한다.

## 5. 선택 범위

| 영역 | 8주 선택 범위 | 초기 경계 |
|---|---|---|
| Git | 운영 Baseline: `status`·`diff`, Staging, 작은 Commit, Branch, `restore`·`revert`와 PR | Merge·Rebase·Conflict는 공백이 확인되거나 실제 필요가 있을 때만 안전한 실험 Repository에서 보충 |
| Java·객체지향 | Encapsulation, Abstraction, Polymorphism, Composition, SOLID, Exception, Collection | Pattern 개수를 성과로 삼지 않음 |
| Web·Backend | HTTP, REST, CORS, Cookie·Session, MVC, Layered Architecture, DI와 예외 처리 | GraphQL, Queue와 Load Balancing은 조건부 후속 |
| Database | 정규화, ACID, Transaction, Isolation, Lock, Index, 실행 계획, Migration, PostgreSQL Adapter와 실제 DB Integration Test | N+1·Connection Pool은 수직 흐름에서 실행 조건이 생길 때 보충하고, 복제·Sharding은 제외 |
| 인증·보안 | 인증·인가, Password Hashing, Session, XSS, CSRF와 Secret | Parameterized Query·SQL Injection과 Rate Limit은 실행 조건이 생길 때 보충하고, JWT·OAuth2를 Session과 중복 구현하지 않음 |
| Frontend | Browser Rendering, Event Loop, Promise, Event Delegation, Loading·Error 상태 | React·SSR·전역 상태 Library는 초기 제외 |
| Test·품질 | Unit, PostgreSQL Integration, Testcontainers, 최소 E2E, 정적 분석과 Coverage 해석 | Coverage 수치를 완료 기준으로 사용하지 않음 |
| AI Native | Prompt, Structured Output, Evaluation, Guardrail과 Prompt Injection | RAG·LoRA·VLM·Multi-Agent는 초기 제외 |
| DevOps·Cloud | Docker, Compose, CI, Secret 분리, Process·Log·Metric, IAM, ECS·ECR, RDS, CloudWatch, DNS와 HTTPS 배포 | Jenkins·Kubernetes·Terraform·Auto Scaling·WAF·CloudFront는 제외 |
| System | Linux CLI, Log, Process·Signal과 `/proc` | Mini Shell·VM과 복잡한 IPC는 선정 제외 |

## 6. 시간 배분

| 활동 | 권장 비율 | 종료 조건 |
|---|---:|---|
| 개념·도서·공식 자료 | 30% | 정의뿐 아니라 동작 흐름과 전제 조건을 설명 |
| 최소 재현 실험 | 35% | 예상, 조건, 관찰과 원인 해석이 있음 |
| Helpdesk 선택 적용 | 20% | 학습 질문에 필요한 최소 변경과 Test가 있음 |
| 설명·Review·WIL | 15% | 다른 사람이 재현할 근거와 다음 질문이 있음 |

비율은 분 단위 시간표가 아니라 구현이 학습을 압도하는지 확인하는 기준이다. 설정이나 통합이 예상보다 길어지면 수평 기능과 UI 장식을 줄이고 독립 Spike로 원인을 먼저 확인한다. PostgreSQL 영속성, Security, AI 검증과 배포처럼 선택한 수직 흐름의 필수 연결은 Spike로 대체하지 않는다.

## 7. 기술 심화 8주 목표

| 주차 | 중심 영역 | 주간 결과 |
|---:|---|---|
| 1 | Java 객체지향·JUnit (Git 운영 Baseline) | Framework 없는 Ticket Domain과 단위 Test, Git 자가진단 기록 |
| 2 | HTTP·REST·Spring | Request 흐름과 Layer 책임을 설명하는 최소 API |
| 3 | PostgreSQL | Transaction·Lock·Index와 Query Plan 실험 |
| 4 | 인증·보안 | Session과 권한·공격 방어 실패 Case |
| 5 | Browser·Frontend·Test 기초 | Event Loop·Rendering·Promise의 실행 근거와 미완료 경계 |
| 6 | Browser·PostgreSQL·Test 수직 마감 | 최소 UI에서 Session API와 실제 PostgreSQL 영속성을 잇고 Integration·E2E 근거 확보 |
| 7 | AI Native | Structured Output, 고정 평가·Guardrail과 검증된 Suggestion 저장 |
| 8 | DevOps·System·Cloud 통합 | Container·CI·Process·관측을 거쳐 IAM·ECS·ECR·RDS·DNS·HTTPS 수직 배포 |

세부 학습 질문과 비범위는 [주차별 Roadmap](./weekly-roadmap.md)을 따른다.

## 8. 취업 심화 4주 목표

- 검증된 학습 근거를 직무별 이력서와 Portfolio 문장으로 전환한다.
- Java·Spring·Database·Security·AI 질문을 Lab의 실패와 판단으로 설명한다.
- 공고별 요구 역량에 맞춰 지원 자료를 조정한다.
- 코딩 Test와 면접에서 확인된 취약 개념만 작은 Spike로 다시 학습한다.
- AI를 활용해 Comment, 상태 변경, 검색, 알림과 Dashboard 같은 수평 기능을 빠르게 확장할 수 있다.
- 수평 확장은 주 6시간 이내의 Portfolio 작업으로 제한하고 지원·면접 일정을 침해하지 않는다.
- AI 생성 Code 전체를 직접 작성한 것으로 표현하지 않고, 사용자가 검토한 Architecture·보안·데이터·Test·운영 범위를 구분한다.

## 9. 학습 완료 기준

각 핵심 주제는 다음 중 최소 세 가지를 충족해야 `Completed`로 표시한다.

1. 핵심 동작을 자신의 말과 그림 또는 흐름으로 설명했다.
2. 정상 Case와 실패 Case를 직접 재현했다.
3. 예상과 관찰이 달랐던 이유를 기록했다.
4. Test, Query Plan, Header, Trace 또는 Metric으로 확인했다.
5. 작은 변경을 AI 도움 없이 직접 수행하고 결과를 설명했다.
6. 언제 사용하지 않을지와 Trade-off를 설명했다.

Tutorial 완료, 생성 코드량, Commit 수와 Coverage 수치만으로는 완료하지 않는다.

Git 운영 Baseline은 위 핵심 주제 완료 기준을 별도로 적용하지 않는다. 실제 변경에서 상태를 확인하고 Diff를 검토해 작은 Commit을 만들며, 상황에 맞는 안전한 복구 방식을 설명할 수 있으면 Baseline을 충족한 것으로 본다. Merge·Rebase History 비교는 필수 완료 조건이 아니다.

## 10. AI 활용 원칙

- Week 1~8은 `DEEP_LEARNING_MODE`다. 먼저 학습 질문, 예상 동작과 모르는 부분을 작성하고, 핵심 Code를 직접 추적·수정하며 실패를 재현한다.
- `DEEP_LEARNING_MODE`에서 AI는 설명 비교, 실험 Case 제안, 초안 검토와 반복 작업에 활용한다. 생성 Code는 작은 Diff로 나누고 각 단계의 동작을 직접 확인한다.
- 설명하거나 수정하거나 실패를 재현할 수 없는 생성 Code는 Week 1~8 학습 성과에 포함하지 않는다.
- Week 9~12는 `AI_ASSISTED_PRODUCTIZATION_MODE`다. AI가 수평 기능을 빠르게 구현할 수 있지만, 사용자는 전체 Architecture, Module 책임, 데이터 흐름, 권한, 실패 처리, Acceptance Test와 운영 결과를 이해하고 승인한다.
- AI가 수행한 일과 학습자가 판단·수정·검증한 일을 WIL에서 구분한다.
- Secret, Credential과 민감 원문을 Prompt, Source, Log와 공개 문서에 포함하지 않는다.

## 11. Gate와 범위 조정

| 시점 | 확인 질문 | 실패 시 조정 |
|---|---|---|
| 매일 | 오늘의 실험이 핵심 질문 한 가지에 답하는가 | 기능 추가를 멈추고 실험을 더 작게 분리 |
| 매주 | 설명·재현·검증 근거가 최소 한 개 있는가 | 다음 주 새 주제보다 미해결 개념 보완 |
| Week 4 | 학습 시간이 구현·설정에 잠식되지 않았는가 | Helpdesk 적용 범위와 선택 주제 축소 |
| Week 8 | Browser부터 PostgreSQL·AI·Cloud HTTPS까지 최소 수직 흐름이 실제로 연결됐는가 | 미실행 항목을 `Partially Completed`로 남기고 Week 9 수평 기능 추가를 중단한 채 핵심 결함만 주 6시간 이내에서 보완 |

## 12. 최종 산출물

- 8개의 주간 WIL과 주간 계획 대비 결과
- 핵심 개념별 Learning Note와 재현 가능한 Lab Report
- Java·Spring·PostgreSQL·Security·AI Native의 대표 실패 Test
- Query Plan, HTTP Trace, 평가 Dataset과 CI 실행 근거
- 최소 실행·배포 안내와 공개 Checklist
- 직무별 Portfolio 설명, 면접 질문과 취약 개념 목록

## 13. 최종 성공 기준

- 큰 제품을 미완성으로 남기는 대신 선택한 핵심 기술을 직접 설명·수정·검증할 수 있다.
- Week 8까지 기능 수는 작아도 실제 PostgreSQL 영속성, Security, AI 검증, CI와 HTTPS 배포가 연결된 수직 흐름이 있다.
- Helpdesk Lab의 각 변경이 어떤 학습 질문에서 시작됐는지 추적할 수 있다.
- AI 도움을 받은 범위와 직접 판단한 범위를 구분할 수 있다.
- 실패와 제외 범위를 숨기지 않고 다음 학습 조건을 설명한다.
- 공개 문서에 Secret, 개인정보, 내부 Context와 검증되지 않은 주장이 없다.
- 취업 자료에서 학습 결과를 과장하지 않고 Test·실험 근거로 설명한다.

## 관련 문서

- [12주 주차별 Roadmap](./weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](./learning-and-content-plan.md)
- [학습 우선 범위 전환 Decision](./decisions/0001-learning-first-scope.md)
- [깊은 수직 학습과 AI 보조 수평 확장 Decision](./decisions/0002-depth-first-ai-assisted-expansion.md)
- [AgentOps Lab 보류 안내](./agentops-lab-12-week-plan.md)
