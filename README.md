# Jungle SW AI Lab Advanced WIL

> 상태: Active
> 시작일: 2026-08-18
> 전체 기간: 기술 심화 8주 + 취업 심화 4주
> 현재 단계: Week 1·2·3·4 완료 — Week 5 부분 완료·공개 제출 완료, Week 6 Browser·PostgreSQL·Test 수직 마감 진행 중

이 저장소는 SW AI Lab 심화과정에서 선택한 기술을 학습하고, 이해가 바뀐 과정과 재현 가능한 근거를 주차별로 기록한다. 목표는 큰 제품을 기간 안에 완성하는 것이 아니라 AI/AX·Java Backend 직무에 필요한 개념을 직접 설명하고, 작은 실험과 Test로 검증하며, 필요한 범위만 서비스에 적용할 수 있는 역량을 만드는 것이다.

## 12주 목표

- Java 객체지향, Spring Backend와 PostgreSQL의 핵심 동작을 설명하고 수정한다.
- HTTP·Browser·인증·인가와 주요 Web Security 경계를 재현 실험으로 확인한다.
- 단위·통합·E2E Test의 책임을 구분하고 실패를 재현하는 Test를 작성한다.
- LLM Structured Output, 평가와 Guardrail을 고정된 입력과 실패 Case로 검증한다.
- Git의 상태 확인·안전한 복구·작은 Commit을 운영 Baseline으로 적용하고, Docker, CI, Secret 분리와 최소 운영 관측을 실제 학습 과정에서 검증한다.
- 매주 WIL을 게시하고 학습 선택, 실패, 한계와 다음 질문을 공개 근거로 남긴다.
- 기술 심화 이후에는 학습 근거를 이력서·Portfolio·면접 답변으로 전환한다.

## 공통 실습 주제

### AI Helpdesk Learning Lab

사용자가 문의를 등록하면 AI가 요약·카테고리·우선순위를 제안하고, 담당자가 제안을 확인한 뒤 상태를 변경하는 작은 Helpdesk를 공통 실습 대상으로 사용한다.

    로그인 → 문의 등록 → AI 분류 제안 → 담당자 확인 → 상태 변경 → 이력 조회

이 Lab은 Week 1~8에 많은 제품 기능을 완성하는 프로젝트가 아니다. 대신 선택한 한 수직 흐름에서는 Browser, Security, Application, PostgreSQL, AI와 배포를 실제로 연결한다. 독립 재현 실험은 원리를 이해하기 위한 준비 근거이며 실제 PostgreSQL 영속성·API 흐름·배포를 대신하지 않는다.

Week 9~12에는 취업 활동을 우선하면서 검증된 기반 위에 AI를 활용해 Portfolio 기능을 수평 확장한다. 이때 사용자는 모든 Line을 직접 작성하기보다 요구사항, Architecture, 데이터·권한·실패 경계, Acceptance Test와 운영 결과를 검토한다.

### 초기 범위

- 핵심 개념: User, Ticket, Comment와 AI Suggestion
- 인증: Session 방식 한 가지
- AI: 요약·카테고리·우선순위 Structured Output와 평가
- UI: 핵심 흐름을 확인할 수 있는 최소 Browser 화면
- 운영: Docker Compose, GitHub Actions, AWS의 한 개 실행 환경·관리형 PostgreSQL과 HTTPS

### 초기 제외 범위

- 다중 Organization, 범용 Workflow Builder와 승인 Engine
- Multi-Agent, RAG, 외부 Side Effect Connector와 격리 Runner
- Kafka, GraphQL, Database 복제·Sharding
- Kubernetes, Terraform, Auto Scaling과 무중단 배포
- LoRA, VLM과 대규모 Model 비교

제외한 항목은 실패가 아니라 선택 결과다. 핵심 학습이 완료되고 실제 필요나 측정 근거가 생길 때만 다시 검토한다.

## 현재 진행 상황

| 주차 | 핵심 학습 | 상태 | 공개 기록 |
|---:|---|---|---|
| 1 | Java 객체지향·JUnit (Git 운영 Baseline) | Completed | [Week 1](./week1/README.md) |
| 2 | HTTP·REST·Spring MVC·Layered Architecture | Completed | [Week 2](./week2/README.md) |
| 3 | PostgreSQL·Transaction·Lock·Index | Completed | [Week 3](./week3/README.md) |
| 4 | 인증·인가·Session·Web Security | Completed | [Week 4](./week4/README.md) · [WIL](./week4/wil.md) |
| 5 | Browser JavaScript·Frontend·E2E·품질 기초 | Partially Completed | [Week 5 학습 계획](./week5/weekly-plan.md) · [WIL](./week5/wil.md) |
| 6 | Browser·PostgreSQL·Test 수직 마감 | In Progress — PostgreSQL Rollback·Context 재생성과 MockMvc CSRF 근거 확보, 최소 UI·Browser E2E 미실행 | [Week 6 학습 계획](./week6/weekly-plan.md) |
| 7 | LLM Structured Output·평가·Guardrail | Not Started | 주차 시작 시 추가 |
| 8 | Docker·CI·System·AWS Cloud·HTTPS | Not Started | 주차 시작 시 추가 |
| 9 | 취업 Baseline·Portfolio 근거 정리 | Not Started | 주차 시작 시 추가 |
| 10 | 맞춤 지원·기술 면접 보완 | Not Started | 주차 시작 시 추가 |
| 11 | 면접·과제 대응과 취약 개념 재학습 | Not Started | 주차 시작 시 추가 |
| 12 | 취업 결과 정리와 최종 회고 | Not Started | 주차 시작 시 추가 |

상태는 `Planned`, `In Progress`, `Completed`, `Partially Completed`와 `Blocked`로 구분한다. 많은 코드를 작성했더라도 설명·재현·검증 근거가 없으면 완료로 표시하지 않는다.

Git은 별도 심화 학습 주차를 차지하는 핵심 주제가 아니라 모든 주차에 적용하는 운영 Baseline이다. Week 1에서 짧은 자가진단으로 상태 확인·변경 검토·안전한 복구 역량을 점검하고, 공백이 확인되거나 실제 협업 문제가 생길 때만 필요한 주제를 보충한다.

## 문서 안내

- [12주 총괄 학습 계획](./plan/advanced-track-12-week-plan.md): 목표, 범위, 운영 원칙과 성공 기준
- [주차별 Roadmap](./plan/weekly-roadmap.md): 8주 기술 학습과 4주 취업 심화 순서
- [학습 및 기술 콘텐츠 계획](./plan/learning-and-content-plan.md): 학습 방법, 증거, WIL과 AI 활용 원칙
- [Week 4 3일 Session 인증 학습 계획](./week4/weekly-plan.md): 공지 검토 결과를 반영한 범위 결정, 실행 순서와 이월 조건
- [Week 4 WIL](./week4/wil.md): Session 인증·Role·CSRF의 이해 변화, Test와 Log 점검 및 게시 근거
- [Week 5 Browser JavaScript 학습 계획](./week5/weekly-plan.md): Event Loop·DOM·비동기 UI 상태와 실제 Browser E2E Gate
- [Week 5 WIL](./week5/wil.md): Event Loop·Rendering·Promise의 이해 변화와 Week 6 이월 경계
- [Week 6 Browser·PostgreSQL 수직 마감 계획](./week6/weekly-plan.md): 실제 영속성, 최소 UI와 계층별 Test를 연결하는 일정
- [깊은 수직 학습과 AI 보조 수평 확장 Decision](./plan/decisions/0002-depth-first-ai-assisted-expansion.md): Week 1~8과 Week 9~12의 구현 모드
- [AgentOps Lab 보류 안내](./plan/agentops-lab-12-week-plan.md): 과정 이후 별도로 검토할 장기 프로젝트
- [계획 문서 안내](./plan/README.md): 현재 기준 문서와 Archive
- [산출물 Template](./templates/README.md): Weekly Plan, Lab Report, Learning Note와 WIL 작성 방법

## 학습 기록 Workflow

1. 주차 시작 시 핵심 질문 한 가지와 선택한 공지 학습 주제를 정한다.
2. 개념을 학습하고 예상 결과를 먼저 적은 뒤 가장 작은 실패·비교 실험을 수행한다.
3. 관찰 결과를 설명하고 한 수직 흐름에 필요한 최소 기능만 Helpdesk Lab에 실제로 연결한다.
4. Test, Trace, Query Plan, Header, Metric 또는 직접 설명으로 이해를 검증한다.
5. 실패와 범위 변경을 숨기지 않고 Lab Report·Learning Note와 WIL에 남긴다.

계획 변경은 기존 기준선을 조용히 덮어쓰지 않는다. 변경 날짜, 이유, 학습 질문과 다음 주 영향이 남도록 기록한다.

## 저장소 구조

    .
    ├── plan/        # 12주 총괄 계획, 주차별 Roadmap과 학습 원칙
    ├── templates/   # 공개 학습 산출물 양식
    ├── week1/       # Java 객체지향·JUnit 계획, WIL과 학습 근거
    │   └── study-docs/  # 개념별 Learning Note와 운영 Baseline 점검 기록
    ├── week2/       # HTTP·REST·Spring 요청 흐름 계획과 이후 학습 근거
    ├── week3/       # PostgreSQL·Transaction·Lock·Index 계획과 이후 학습 근거
    ├── week4/       # 인증·인가·Session·CSRF의 3일 축소 계획
    └── weekN/       # 해당 주차에 실제 산출물이 생길 때 추가

실습 Source는 별도 `ai-helpdesk-learning-lab` 저장소에서 관리한다. 이 WIL 저장소에는 주차별 계획, 실험 결과, Learning Note, WIL과 공개 가능한 근거를 남긴다.

## 공개 경계

- Secret, Credential, 개인정보, 비공개 대화, 내부 URL과 로컬 경로를 공개하지 않는다.
- 과정 전 자동화 Prototype과 이번 과정에서 직접 학습·수정·검증한 결과를 구분한다.
- 측정하지 않은 성능·비용·품질 개선을 주장하지 않는다.
- AI가 만든 결과를 그대로 학습 성과로 표시하지 않고 직접 검토·설명한 범위를 기록한다.
- 보류한 AgentOps Lab은 현재 심화과정의 완료 조건이나 주차 일정에 포함하지 않는다.
