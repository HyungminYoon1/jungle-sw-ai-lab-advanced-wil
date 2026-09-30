# 0002. Week 1~8 깊은 수직 학습과 Week 9~12 AI 보조 수평 확장

> 상태: Accepted
> 결정일: 2026-09-21

## Context

AI Helpdesk Learning Lab은 기술 심화 공지의 선택 기술을 같은 Domain에서 반복 학습하기 위한 대상이다. 제품 기능 수를 늘리는 데 집중하면 핵심 기술을 설명·재현·검증하는 시간이 줄어들지만, 학습용이라는 이유로 실제 PostgreSQL 영속성, API 계층 연결과 배포를 생략하면 공지가 요구하는 “실제로 활용할 수 있는 수준”과 라이브 서비스 경험을 충족하지 못한다.

Week 5까지 Event Loop·Rendering·Promise, Session Security와 PostgreSQL SQL 실험 근거는 생겼지만 PostgreSQL Repository Adapter·Migration·Testcontainers Integration Test, 최소 Browser UI와 실제 배포는 아직 완료되지 않았다.

## Options Considered

### 1. 독립 Spike만 유지하고 Service 통합을 생략

- 장점: 각 개념을 작게 재현하기 쉽다.
- 단점: Browser부터 Database·Cloud까지 이어지는 실제 수직 흐름을 검증하지 못한다.

### 2. Week 1~8부터 많은 제품 기능을 함께 구현

- 장점: 화면과 기능 수가 빠르게 늘어난다.
- 단점: 검색·알림·Dashboard 같은 수평 기능이 핵심 기술 학습과 실패 분석 시간을 잠식한다.

### 3. Week 1~8은 좁고 깊은 수직 흐름, Week 9~12는 AI 보조 수평 확장

- 장점: 선택 기술의 실제 연결과 근거를 먼저 확보하고, 이후 검증된 기반 위에서 Portfolio 기능을 빠르게 넓힐 수 있다.
- 단점: Week 8 전까지 PostgreSQL·AI·배포 통합을 끝내기 위한 엄격한 범위 관리와 충분한 학습 시간이 필요하다.

## Decision

Option 3을 선택한다.

### Week 1~8 — `DEEP_LEARNING_MODE`

- 로그인, Ticket 등록·조회와 AI Suggestion 확인이라는 한 수직 흐름만 구현한다.
- Browser·HTTPS·Session Security·Controller·Application·Domain·PostgreSQL Adapter·AI 검증·CI·Cloud 배포를 실제로 연결한다.
- PostgreSQL Migration, Repository Adapter와 Testcontainers Integration Test는 필수 수직 근거다.
- 핵심 Code를 직접 추적·수정하고 정상·실패 Case를 실행한다.
- 독립 Spike는 원리를 분리해 이해하기 위한 준비 근거이며 필수 Service 통합을 대체하지 않는다.
- Comment 확장, 검색·Pagination, 알림, Dashboard와 UI 장식은 추가하지 않는다.

### Week 9~12 — `AI_ASSISTED_PRODUCTIZATION_MODE`

- 취업 활동을 우선하고 수평 기능 확장은 주 6시간 이내의 Portfolio 작업으로 제한한다.
- AI가 Module 단위 Code 초안을 빠르게 구현할 수 있다.
- 사용자는 요구사항, Architecture, 데이터 흐름, 권한, 실패 처리, Acceptance Test, 배포와 운영 결과를 이해하고 승인한다.
- AI가 작성한 모든 Line을 직접 구현·숙지했다고 주장하지 않는다.
- Security·데이터 영속성·외부 Side Effect와 운영 변경은 Test와 실행 근거 없이 인수하지 않는다.

## Week Mapping

| 주차 | 중심 범위 |
|---:|---|
| 5 | Browser·Frontend·Test 기초와 실제 부분 완료 경계 |
| 6 | Browser·PostgreSQL·Test 수직 마감 |
| 7 | AI Native 검증과 Suggestion 저장 |
| 8 | Docker·CI·System·AWS Cloud·HTTPS 수직 배포 |
| 9~12 | 취업 활동과 AI 보조 수평 Productization |

## Consequences

- Week 5 미완료 항목과 Week 3 PostgreSQL Adapter 보류분을 Week 6에서 함께 회수한다.
- Week 8 Cloud 선택 범위에 IAM, ECS, ECR, RDS, CloudWatch, DNS와 HTTPS를 포함한다.
- Auto Scaling, WAF, CloudFront, Terraform, Kubernetes와 전체 관측 Stack은 이번 8주 수직 흐름에서 제외한다.
- Week 8 Gate를 통과하지 못하면 상태를 `Partially Completed`로 기록하고 Week 9 수평 기능 추가를 중단한다. 핵심 결함 보완만 주 6시간 이내에서 수행한다.
- 실행하지 않은 PostgreSQL Integration, Browser E2E와 Cloud 결과를 완료로 표현하지 않는다.

## Affected Files

- `README.md`
- `plan/README.md`
- `plan/advanced-track-12-week-plan.md`
- `plan/weekly-roadmap.md`
- `plan/learning-and-content-plan.md`
- `week5/weekly-plan.md`
- `week6/weekly-plan.md`
- `week7/weekly-plan.md`
- `week7/ai-suggestion-contract-draft.md`
- `week7/study-docs/ai-suggestion-trust-boundaries.md`

## Follow-up Review

- Week 6 종료: 실제 PostgreSQL 영속성과 Browser API 흐름 확인
- Week 7 종료: Structured Output·Dataset·Guardrail과 저장 경계 확인
- Week 8 종료: CI·Container·AWS·HTTPS·관측·E2E Gate 최종 판정
- Week 9 시작: 수평 확장 허용 여부와 주 6시간 상한 확인

## 2026-09-30 범위 명확화 — 최초 Message와 자동 AI 처리

### Context와 선택지

Ticket을 하나의 문의 주제와 상태를 관리하는 컨테이너로 두고, 고객 문의와 공식 답변을 Message로 연결하는 방향을 검토했다. Ticket의 `description`과 Message에 원문을 중복 저장하는 안보다 최초 문의부터 Message로 저장하는 안이 이후 대화 모델과 일관된다.

AI 호출까지 접수 Transaction에 묶는 안, 접수 후 수동으로 AI 실행을 요청하는 안, 접수 Commit 뒤 서버가 자동 처리하는 안을 비교했다. AI 실패로 고객 문의를 취소하지 않고, 사용자가 별도 실행 요청을 하지 않아도 제안이 생성되는 마지막 방식을 목표로 합의했다.

### Decision과 이유

- Week 7에서는 Ticket·최초 Message 저장, AI 처리 상태와 Suggestion 분리, 접수 성공 후 서버의 자동 AI 처리만 연결한다.
- 최초 Ticket·Message는 같은 Transaction에 저장하고, AI 호출·검증·결과 저장 실패와 독립적으로 보존한다.
- 기본 AI 정상·실패 흐름을 먼저 검증한 뒤, 접수 Commit·201 응답 후 자동 처리와 단일 Application·PostgreSQL의 최소 중단 복구로 발전시킨다. 처리 중단으로 영구 대기하는 문제를 다루되 분산 Queue·Worker 운영까지 확장하지 않는다.
- 후속 고객 메시지·공식 답변의 작성·조회 UI는 Week 9 이후 수평 확장으로 남긴다. 최초 Message 분리는 새로운 대화 기능 추가가 아니라 AI 입력 원문을 저장하는 경계의 정리다.

### 영향과 후속 검토

상위 계획과 Week 7 계획·계약 초안·학습자료에 이 구분을 반영한다. 작업 등록과 접수 Commit 사이의 누락 방지, 상태 전이, 재시도 한도, 중단 복구와 중복 제안 방지의 구체 계약은 다음 학습에서 검토한다. 기존 USER·AGENT 권한 계약은 변경하지 않는다. 이번 합의는 설계 방향이며 구현·실제 Provider 호출·PostgreSQL 검증 완료를 의미하지 않는다.
