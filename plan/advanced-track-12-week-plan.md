# SW AI Lab 심화과정 12주 학습 계획

> 작성일: 2026-08-18
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

## 2. 지원 직무와 우선순위

1. **AI/AX 개발자**: LLM Application, 업무 자동화와 AI 기능 Backend
2. **Java Backend 개발자**: Spring Boot, PostgreSQL, 인증·인가, Test와 운영
3. **AI Platform·LLMOps Backend 개발자**: Model·Prompt·Tool 실행, 평가와 관측

학습 우선순위는 Java·Web·Database·Test·Security 기반을 먼저 두고 AI Native와 운영 학습을 그 위에 연결한다. 특정 Library 사용 자체보다 원리, 실패 처리와 설명 가능성을 우선한다.

## 3. 공통 실습 대상

`AI Helpdesk Learning Lab`은 반복 설정 비용을 줄이고 여러 기술을 같은 Domain에서 비교하기 위한 작은 실습 대상이다.

### 핵심 사용자 흐름

1. 사용자가 로그인한다.
2. 문의를 등록하고 다시 조회한다.
3. AI가 요약, 카테고리와 우선순위를 구조화해 제안한다.
4. 담당자가 제안을 확인하고 Ticket 상태를 변경한다.
5. 사용자는 처리 이력을 조회한다.

### 고정 범위

- User, Ticket, Comment와 AI Suggestion 이내의 Domain
- Session 인증과 사용자·담당자 권한
- PostgreSQL 한 개와 최소 Browser 화면
- Structured Output 한 개, 고정 평가 Dataset과 실패 처리
- Docker Compose, GitHub Actions와 한 개 배포 환경

### 범위 제한

- AI는 제안만 하며 외부 Side Effect를 자동 실행하지 않는다.
- 한 주에 핵심 학습 질문을 관찰하는 데 필요한 코드만 추가한다.
- 같은 기능을 여러 Framework로 완성하지 않는다.
- 제품에 맞지 않는 개념은 독립 Spike로 분리한다.
- 핵심 학습이 끝나기 전 편의 기능과 UI 장식을 추가하지 않는다.

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
| Database | 정규화, ACID, Transaction, Isolation, Lock, Index, 실행 계획과 N+1 | NoSQL 비교는 설계 Note, 복제·Sharding은 제외 |
| 인증·보안 | 인증·인가, Password Hashing, Session, XSS, CSRF, SQL Injection, Rate Limit과 Secret | JWT·OAuth2를 Session과 중복 구현하지 않음 |
| Frontend | Browser Rendering, Event Loop, Promise, Event Delegation, Loading·Error 상태 | React·SSR·전역 상태 Library는 초기 제외 |
| Test·품질 | Unit, Integration, Testcontainers, 최소 E2E, 정적 분석과 Coverage 해석 | Coverage 수치를 완료 기준으로 사용하지 않음 |
| AI Native | Prompt, Structured Output, Evaluation, Guardrail과 Prompt Injection | RAG·LoRA·VLM·Multi-Agent는 초기 제외 |
| DevOps·Cloud | Docker, Compose, CI, Secret 분리, 로그·Metric, 최소 HTTPS 배포 | Jenkins·Kubernetes·Terraform·Auto Scaling은 제외 |
| System | Linux CLI, Log, Process·Signal과 `/proc` | Mini Shell·VM과 복잡한 IPC는 선정 제외 |

## 6. 시간 배분

| 활동 | 권장 비율 | 종료 조건 |
|---|---:|---|
| 개념·도서·공식 자료 | 30% | 정의뿐 아니라 동작 흐름과 전제 조건을 설명 |
| 최소 재현 실험 | 35% | 예상, 조건, 관찰과 원인 해석이 있음 |
| Helpdesk 선택 적용 | 20% | 학습 질문에 필요한 최소 변경과 Test가 있음 |
| 설명·Review·WIL | 15% | 다른 사람이 재현할 근거와 다음 질문이 있음 |

비율은 분 단위 시간표가 아니라 구현이 학습을 압도하는지 확인하는 기준이다. 설정이나 기능 통합이 예상보다 길어지면 Lab 적용을 줄이고 독립 Spike로 전환한다.

## 7. 기술 심화 8주 목표

| 주차 | 중심 영역 | 주간 결과 |
|---:|---|---|
| 1 | Java 객체지향·JUnit (Git 운영 Baseline) | Framework 없는 Ticket Domain과 단위 Test, Git 자가진단 기록 |
| 2 | HTTP·REST·Spring | Request 흐름과 Layer 책임을 설명하는 최소 API |
| 3 | PostgreSQL | Transaction·Lock·Index와 Query Plan 실험 |
| 4 | 인증·보안 | Session과 권한·공격 방어 실패 Case |
| 5 | Browser·Frontend·Test | 최소 UI, 비동기 상태와 핵심 E2E |
| 6 | AI Native | Structured Output, 고정 평가와 Guardrail |
| 7 | DevOps·System | 재현 가능한 Container·CI와 Process·Log 관찰 |
| 8 | Cloud·통합 회고 | 최소 HTTPS 배포와 전체 학습 근거 정리 |

세부 학습 질문과 비범위는 [주차별 Roadmap](./weekly-roadmap.md)을 따른다.

## 8. 취업 심화 4주 목표

- 검증된 학습 근거를 직무별 이력서와 Portfolio 문장으로 전환한다.
- Java·Spring·Database·Security·AI 질문을 Lab의 실패와 판단으로 설명한다.
- 공고별 요구 역량에 맞춰 지원 자료를 조정한다.
- 코딩 Test와 면접에서 확인된 취약 개념만 작은 Spike로 다시 학습한다.
- 제품 확장은 주 6시간 이내의 보완 작업으로 제한하고 지원 일정을 침해하지 않는다.

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

- 먼저 학습 질문, 예상 동작과 모르는 부분을 작성한다.
- AI는 설명 비교, 실험 Case 제안, 초안 검토와 반복 작업에 활용한다.
- 생성 코드는 작은 Diff로 나누고 각 단계의 동작을 직접 확인한다.
- 설명하거나 수정하거나 실패를 재현할 수 없는 코드는 학습 성과에 포함하지 않는다.
- AI가 수행한 일과 학습자가 판단·수정·검증한 일을 WIL에서 구분한다.
- Secret, Credential과 민감 원문을 Prompt, Source, Log와 공개 문서에 포함하지 않는다.

## 11. Gate와 범위 조정

| 시점 | 확인 질문 | 실패 시 조정 |
|---|---|---|
| 매일 | 오늘의 실험이 핵심 질문 한 가지에 답하는가 | 기능 추가를 멈추고 실험을 더 작게 분리 |
| 매주 | 설명·재현·검증 근거가 최소 한 개 있는가 | 다음 주 새 주제보다 미해결 개념 보완 |
| Week 4 | 학습 시간이 구현·설정에 잠식되지 않았는가 | Helpdesk 적용 범위와 선택 주제 축소 |
| Week 8 | 직무 핵심 개념을 근거와 함께 설명할 수 있는가 | 완료 표현을 줄이고 취약 주제 목록화 |

## 12. 최종 산출물

- 8개의 주간 WIL과 주간 계획 대비 결과
- 핵심 개념별 Learning Note와 재현 가능한 Lab Report
- Java·Spring·PostgreSQL·Security·AI Native의 대표 실패 Test
- Query Plan, HTTP Trace, 평가 Dataset과 CI 실행 근거
- 최소 실행·배포 안내와 공개 Checklist
- 직무별 Portfolio 설명, 면접 질문과 취약 개념 목록

## 13. 최종 성공 기준

- 큰 제품을 미완성으로 남기는 대신 선택한 핵심 기술을 직접 설명·수정·검증할 수 있다.
- Helpdesk Lab의 각 변경이 어떤 학습 질문에서 시작됐는지 추적할 수 있다.
- AI 도움을 받은 범위와 직접 판단한 범위를 구분할 수 있다.
- 실패와 제외 범위를 숨기지 않고 다음 학습 조건을 설명한다.
- 공개 문서에 Secret, 개인정보, 내부 Context와 검증되지 않은 주장이 없다.
- 취업 자료에서 학습 결과를 과장하지 않고 Test·실험 근거로 설명한다.

## 관련 문서

- [12주 주차별 Roadmap](./weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](./learning-and-content-plan.md)
- [학습 우선 범위 전환 Decision](./decisions/0001-learning-first-scope.md)
- [AgentOps Lab 보류 안내](./agentops-lab-12-week-plan.md)
