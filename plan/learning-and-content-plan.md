# 심화과정 학습 및 기술 콘텐츠 계획

> 작성일: 2026-08-18
> 상태: Active
> 대상 기간: 기술 심화 8주 + 취업 심화 4주

이 문서는 개념 학습, 최소 재현 실험, Helpdesk Lab의 선택적 적용, WIL과 기술 콘텐츠의 작성 원칙을 정의한다. 전체 우선순위는 `SW AI Lab 심화과정 12주 학습 계획`, 주차별 순서는 `12주 주차별 Roadmap`을 따른다.

## 1. 학습 목표

목표는 Tutorial이나 기능을 많이 완료하는 것이 아니라 다음 행동을 반복할 수 있게 되는 것이다.

- 모르는 개념을 구체적인 질문으로 바꾼다.
- 실행 전에 예상 결과와 실패 조건을 적는다.
- 가장 작은 코드·요청·Query 또는 Process로 동작을 재현한다.
- 예상과 실제가 다른 이유를 공식 자료와 관찰 근거로 설명한다.
- 작은 변경을 직접 수행하고 Test로 회귀를 막는다.
- 언제 기술을 사용하거나 사용하지 않을지 Trade-off를 설명한다.

## 2. 학습 Cycle

각 학습 주제는 다음 순서로 진행한다.

1. **질문**: 이번 주에 답할 질문과 현재 이해를 적는다.
2. **예상**: 실행 결과, 실패 조건과 변수를 먼저 적는다.
3. **학습**: 도서, 공식 문서와 작은 예제로 핵심 흐름을 확인한다.
4. **재현**: 정상·경계·실패 Case를 최소 환경에서 실행한다.
5. **해석**: 예상과 관찰의 차이, 원인과 한계를 설명한다.
6. **선택 적용**: 도움이 될 때만 Helpdesk Lab에 최소 변경으로 적용한다.
7. **검증**: Test, Trace, Header, Query Plan, Metric 또는 평가 Dataset으로 확인한다.
8. **기록**: Learning Note에는 재사용할 개념을, Study Note에는 날짜별 이해와 진행 상태를, Lab Report에는 실행 근거를, WIL에는 주간 변화와 다음 질문을 남긴다.

강의 수강, 문서 요약, Tutorial 복사와 AI 답변 저장만으로는 Cycle을 완료하지 않는다.

## 3. 학습 항목 분류

| 상태 | 사용할 때 | 기록할 내용 |
|---|---|---|
| 핵심 학습 | 직무 기반에 필요하고 이번 주 우선순위가 높음 | 설명, 실패 재현, 검증 근거 |
| 운영 Baseline | 이미 사용하는 도구를 모든 학습 활동에 계속 적용 | 짧은 자가진단, 실제 작업 History와 필요한 보충 항목 |
| 선택 적용 | 공통 Lab에서 실제 경계를 확인할 가치가 있음 | 최소 변경, 적용 이유와 Test |
| 독립 Spike | 서비스 통합 없이 원리 비교가 더 명확함 | 가설, 변수, 관찰과 결론 |
| 조건부 후속 | 요구·측정·선행 학습이 생겨야 의미가 있음 | 선행 조건, 보류 이유와 재검토 시점 |
| 선정 제외 | 현재 기간과 직무 우선순위에 맞지 않음 | 제외 이유와 영향 |

주차 시작 시 상태를 정하고, 바뀌면 Weekly Plan의 변경 기록과 WIL에 이유를 남긴다.

## 4. 과정 공지 주제 선택 Matrix

| 과정 영역 | 상태 | 선택 학습 | 증거 | 초기 제외·후속 |
|---|---|---|---|---|
| Git·협업 | 운영 Baseline | `status`·`diff`, Staging, 작은 Commit, Branch, `restore`·`revert`, PR과 Actions | 자가진단 Note, 실제 Commit·Review·CI 결과와 복구 기록 | Merge·Rebase·Conflict·Stash·Cherry-pick은 공백 또는 실제 필요가 있을 때만 Spike |
| 객체지향 | 핵심 | Encapsulation, Abstraction, Polymorphism, Composition, SOLID와 필요한 Pattern | Domain Unit Test, 변경 전후 Diff와 설명 | Pattern 개수 채우기 제외 |
| Web 원리 | 핵심·독립 Spike | DNS·TCP 기초, HTTP, REST, Cookie·Session, CORS와 Cache | Request Trace, Header와 Network 관찰 | HTTP 버전 Benchmark, CDN·WebSocket은 조건부 |
| Backend | 핵심·선택 적용 | MVC, Layered Architecture, DI·IoC, 예외 처리, Idempotency와 동시성 | Layer Trace, HTTP Test와 책임 설명 | Queue, Cache, Load Balancing, GraphQL과 Batch는 조건부 |
| Database | 핵심·선택 적용 | 정규화, ACID, Isolation, Lock, Index, 실행 계획, N+1과 Pool | 실제 PostgreSQL Test, Query Plan과 Query 수 | Replication·Sharding 제외, NoSQL은 선택 Note |
| 인증·보안 | 핵심·선택 적용 | 인증·인가, Hashing, Session, XSS, CSRF, SQL Injection, Rate Limit과 Secret | 공격·우회 Test, Header와 Policy 표 | JWT·OAuth2·분산 Session은 중복 구현하지 않음 |
| Frontend | 선택 적용·Spike | Event Loop, Promise, Event Delegation, Browser Rendering과 UI 상태 | 실행 순서 비교, 최소 UI와 E2E | React, SSR, 전역 상태와 Bundle 최적화 제외 |
| Test·품질 | 핵심·운영 실습 | Unit, Integration, Testcontainers, E2E, 정적 분석과 Coverage 해석 | 실패 재현 Test, CI와 Test Pyramid | Coverage 수치만으로 완료 판정하지 않음 |
| AI Native | 핵심·선택 적용 | Prompt, Structured Output, Evaluation, Guardrail과 Prompt Injection | Versioned Dataset, Schema·실패 Test, 평가 결과 | RAG·LoRA·VLM·Multi-Agent 제외 |
| DevOps | 핵심·운영 실습 | Docker, Compose, CI, Secret, Health, Log와 Metric | Clean Run, CI, 장애 추적과 실행 절차 | Jenkins·Kubernetes·무중단 배포 제외 |
| Cloud | 선택 적용 | 최소 권한, DNS, HTTPS와 한 개 배포 환경 | 배포·권한·비용·복구 기록 | AWS 서비스 전체 구성, Terraform과 Auto Scaling 제외 |
| System | 독립 Spike | Linux CLI, Process·Signal, Exit Code와 `/proc` | Process 관찰, Log Pipeline과 종료 Test | Mini Shell·VM과 복잡한 IPC 제외 |

Matrix는 해야 할 일 목록이 아니다. 핵심 질문에 답하지 않는 항목은 선택하지 않는다.

Git처럼 이미 실제 작업에 사용하는 도구는 별도 반나절 학습 일정으로 편성하지 않는다. 20~30분 자가진단을 통과하면 즉시 주간 핵심 학습으로 이동하고, 설명하거나 안전하게 수행하지 못한 항목만 작은 보충 Spike로 전환한다. 평소의 상태 확인, Diff Review, 작은 Commit, PR과 복구 기록을 누적 근거로 사용한다.

## 5. 시간 배분

| 활동 | 권장 비율 | 과도함을 감지하는 신호 |
|---|---:|---|
| 개념·도서·공식 문서 | 30% | 읽은 내용을 실행·설명하지 못함 |
| 최소 재현 실험 | 35% | 실험 질문 없이 예제만 늘어남 |
| Helpdesk 선택 적용 | 20% | 설정·통합이 학습 시간의 절반을 넘음 |
| 설명·동료 Review·WIL | 15% | 결과는 있으나 왜 그런지 말하지 못함 |

구현이 오래 걸리면 학습 시간을 줄이지 않고 적용 범위를 줄인다. 한 주의 산출물 수가 많아져 기록이 학습을 방해하면 핵심 Lab Report 한 개와 WIL만 남긴다.

## 6. 주제 완료 기준

핵심 학습 주제는 다음 Checklist 중 최소 세 개와, 그중 하나 이상의 실행 근거를 충족해야 한다.

- [ ] 개념의 목적, 동작 흐름과 전제 조건을 설명했다.
- [ ] 정상 결과와 대표 실패를 재현했다.
- [ ] 예상과 달랐던 관찰을 기록하고 원인을 설명했다.
- [ ] Test, Trace, Header, Query Plan, Metric 또는 Dataset 결과가 있다.
- [ ] 작은 변형 요구를 직접 구현하거나 수정했다.
- [ ] 대안과 사용하지 않을 조건을 설명했다.
- [ ] 동료 질문 또는 스스로 만든 면접 질문에 답했다.

`Partially Completed`는 실패가 아니라 근거가 부족하거나 질문 일부만 답한 상태다. 남은 질문과 재검토 조건을 기록한다.

운영 Baseline은 핵심 학습의 `3개 Checklist` Gate를 적용하지 않는다. 자가진단 결과와 실제 작업 근거가 있으면 `확인`, 개념 정리만 있고 직접 실행·설명이 없으면 `실행 점검 전`, 공백이 발견되면 `보충 필요`로 기록한다.

## 7. AI 활용 원칙

- AI에게 질문하기 전에 현재 이해, 예상과 구체적인 막힘을 적는다.
- 한 번에 전체 기능을 요청하지 않고 설명, 실험, Test와 작은 Diff로 나눈다.
- AI가 제시한 사실과 Library 사용법은 공식 자료 또는 실제 실행으로 확인한다.
- 생성 코드는 Layer 책임, 상태 변경, Transaction, 권한과 실패 흐름을 직접 Trace한다.
- 핵심 규칙의 작은 변형을 직접 작성해 이해 여부를 확인한다.
- 설명하거나 수정하거나 Test로 실패를 재현할 수 없는 생성 코드는 완료로 인정하지 않는다.
- WIL에는 AI가 한 일과 학습자가 선택·수정·검증한 일을 구분한다.
- Secret, 개인정보, 비공개 원문과 내부 URL을 Prompt나 공개 산출물에 넣지 않는다.

## 8. Learning Note·Study Note와 Lab Report

| 문서 | 목적 | 핵심 내용 |
|---|---|---|
| Learning Note | 재사용 가능한 개념 자료 제공 | 정의, 핵심 흐름, 최소 예, 대표적인 오해와 사용 경계 |
| Study Note | 날짜별 학습 과정과 현재 상태 보존 | 질문, 자신의 답변, 이해 변화, 실행 상태, AI 활용과 다음 학습 |
| Lab Report | 실행 가능한 실습과 관찰 보존 | 질문, 예상, 환경, 절차, 결과, 해석과 재현 |
| Experiment Report | 변수와 비교 조건이 중요한 실험 | 가설, 통제, 측정과 유효성 한계 |
| Decision Log | 중요한 범위·기술 선택 보존 | Context, 선택지, 결정, 이유와 재검토 |

`study-docs/`의 Learning Note에는 개인의 이해 상태, `NOT_RUN`·`NOT_IMPLEMENTED` 같은 실행 상태, AI 활용과 다음 일정을 넣지 않는다. 이러한 날짜별 정보는 `study-notes/`의 Study Note에 기록한다. 실제 명령, Test, Trace와 관찰 결과를 다른 사람이 재현할 필요가 있으면 Lab Report로 분리한다.

단순한 실습은 Lab Report를 사용한다. 성능·품질 비교처럼 변수 통제가 중요할 때만 Experiment Report를 추가한다.

## 9. WIL과 기술 블로그

| 기록 | 목적 | 독자가 얻는 것 |
|---|---|---|
| 주간 WIL | 한 주의 학습 과정, 실패와 다음 판단 보존 | 무엇을 왜 선택했고 이해가 어떻게 바뀌었는지 |
| 기술 블로그 | 하나의 문제를 재사용 가능한 지식으로 재구성 | 원리, 재현 방법, 대안, Test와 한계 |

WIL은 일기식 작업 목록이 아니라 계획 대비 결과와 이해 변화가 중심이다. 기술 블로그는 WIL을 그대로 복사하지 않고 한 가지 문제와 재현 가능한 결론으로 다시 구성한다.

## 10. 주간 WIL 질문

1. 이번 주 핵심 질문은 무엇이었는가?
2. 시작할 때 무엇을 알고 있다고 생각했고 무엇을 예상했는가?
3. 어떤 자료와 최소 실험으로 확인했는가?
4. 예상과 실제가 달랐던 부분은 무엇인가?
5. 어떤 Test·Trace·Query Plan·Metric 또는 평가 결과가 근거인가?
6. Helpdesk에 적용했다면 왜 필요했고, 적용하지 않았다면 왜 분리했는가?
7. AI가 수행한 일과 직접 판단·수정·검증한 일은 무엇인가?
8. 완료·부분 완료·제외한 범위는 무엇인가?
9. 다음 주에 이어갈 질문은 무엇인가?

## 11. 인정되는 학습 증거

- 질문과 예상이 먼저 기록된 최소 재현 실험
- 실패를 재현하고 원인을 설명하는 Test
- HTTP Request·Response Trace와 Header 관찰
- 실제 PostgreSQL Query Plan, Lock·Transaction 결과와 Query 수
- Process, Signal, Exit Code와 Log 분석
- Versioned Prompt·Schema·Dataset과 평가 결과
- 직접 수행한 Code Review, 동료 질문과 설명 수정
- 선택, 실패, 한계와 다음 질문이 있는 WIL

Tutorial 완료 화면, AI 대화 원문, 생성 코드량, Commit 수와 Test 개수는 그 자체로 학습 증거가 아니다.

## 12. 운영 Rhythm

### 기술 심화 1~8주

- 매일 오전: 전날 관찰, 오늘의 질문 한 가지와 Blocker 공유
- 오전 학습 Block: 도서·공식 자료와 예상 작성
- 오후 실험 Block: 최소 재현, 실패 Case와 해석
- 선택 적용 Block: 필요한 경우에만 Helpdesk에 작은 변경
- Core Time: 동료에게 설명하고 반례·질문을 받음
- 종료 전: 실행 확인, 날짜별 Study Note와 Weekly Plan 갱신, 작은 Commit
- 주말: 새 기능을 줄이고 Lab Report·WIL과 다음 질문 정리
- 월요일: 전주 WIL 게시

### 취업 심화 9~12주

- 공고 분석, 맞춤 지원, 후속 연락과 면접 일정을 우선한다.
- 매일 Coding Test 또는 기술 면접 학습 Block을 둔다.
- 실제 질문에서 드러난 약점만 작은 Spike로 다시 학습한다.
- Project 보완은 주 6시간 이내로 제한하고 새 대형 기능을 시작하지 않는다.

## 13. 공개 Definition of Done

- 일반 독자가 대화 Context 없이 목적과 결과를 이해할 수 있다.
- 계획, 실제 결과와 남은 질문을 구분했다.
- 완료·부분 완료·제외 상태와 이유가 있다.
- Test, Trace, Query Plan, Metric, Dataset 또는 설명 검증 근거가 있다.
- 측정하지 않은 성능·품질·비용 향상을 주장하지 않는다.
- AI 활용과 직접 판단·수정·검증한 범위를 구분한다.
- Secret, 개인정보, 내부 URL과 로컬 경로가 없다.
- UTF-8, 저장소 줄바꿈 규칙과 유효한 상대 Link를 지킨다.

## 관련 문서

- [심화과정 12주 학습 계획](./advanced-track-12-week-plan.md)
- [12주 주차별 Roadmap](./weekly-roadmap.md)
- [산출물 Template](../templates/README.md)
