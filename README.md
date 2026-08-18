# Jungle SW AI Lab Advanced WIL

> 상태: Active  
> 시작일: 2026-08-18  
> 전체 기간: 기술 심화 8주 + 취업 심화 4주  
> 현재 단계: Week 1 Baseline

이 저장소는 AgentOps Lab을 실제 운영 가능한 Production Pilot로 발전시키는 12주 동안의 학습, 구현 계획, 판단과 검증 근거를 공개한다. 완성 기능만 나열하지 않고 무엇을 학습했고 어떤 가설을 제품에 적용했으며 Test·실험·운영 결과로 어떻게 확인했는지를 기록한다.

AgentOps Lab 제품 Source와 시스템 설계는 별도 제품 저장소가 관리한다. 이 저장소는 제품 Code를 복제하지 않고 주차별 계획, WIL, Learning Note, 구현 Report와 공개 기술 콘텐츠를 관리한다.

## 12주 목표

- 실제 LLM, PostgreSQL과 통제된 Side Effect를 사용하는 R1 Production Pilot 완성
- Human·Agent·Service의 업무, 권한, 승인, 실행과 Audit를 다루는 공통 Kernel 검증
- AI Workflow Plan의 시각적 검토, Revision, Diff와 Approval 구현
- 캐릭터 회사를 첫 Reference Application으로 사용하고 두 번째 업무로 범용성 확인
- Java·Spring·Database·Web·Security·AI Agent 개념을 제품 구현과 운영 근거로 학습
- 매주 WIL과 재현 가능한 기술 콘텐츠로 판단, 실패와 한계를 공개

## 현재 진행 상황

| 주차 | Release | 핵심 Milestone | 상태 | 공개 기록 |
|---:|---|---|---|---|
| 1 | R1 | 제품 계약, Framework 결정과 Walking Skeleton | Planned | [Week 1](./week1/README.md) |
| 2 | R1 | Work·Identity·Workflow Planning Kernel | Not Started | 주차 시작 시 추가 |
| 3 | R1 | Workflow Review·Approval과 Agent 실행 | Not Started | 주차 시작 시 추가 |
| 4 | R1 | 캐릭터 Reference Application Vertical Slice | Not Started | 주차 시작 시 추가 |
| 5 | R1 | Knowledge·평가·Security와 Pilot Feedback | Not Started | 주차 시작 시 추가 |
| 6 | R1 | Production Pilot 배포와 운영 검증 | Not Started | 주차 시작 시 추가 |
| 7 | R2 | Director 위임과 저위험 Approver Actor | Not Started | 주차 시작 시 추가 |
| 8 | R2 | Human·Agent 혼합 팀과 두 번째 업무 | Not Started | 주차 시작 시 추가 |
| 9 | R3 | Knowledge 수명주기와 Connector | Not Started | 주차 시작 시 추가 |
| 10 | R3 | 격리 Coding Runner 기반 | Not Started | 주차 시작 시 추가 |
| 11 | R3 | Runner 흐름과 운영 복원력 | Not Started | 주차 시작 시 추가 |
| 12 | R3 | 제품 안정화와 최종 근거 정리 | Not Started | 주차 시작 시 추가 |

상태는 계획만 존재하는 `Planned`, 진행 중인 `In Progress`, 완료 조건을 통과한 `Completed`, 일부만 검증한 `Partially Completed`와 진행 불가능한 `Blocked`로 구분한다.

## 문서 안내

- [12주 총괄 계획](./plan/agentops-lab-12-week-plan.md): 목표, Release 순서, Gate와 성공 기준
- [주차별 Roadmap](./plan/weekly-roadmap.md): 각 주의 학습·구현·검증 범위와 완료 조건
- [학습 및 기술 콘텐츠 계획](./plan/learning-and-content-plan.md): 학습 방식, WIL·기술 블로그와 공개 근거 원칙
- [계획 문서 안내](./plan/README.md): 문서 권한, Archive와 제품 저장소 경계
- [주차별 산출물 Template](./templates/README.md): 계획, WIL, 구현·실험 Report와 기술 글 작성 방법

## 기록 Workflow

1. 주차 시작 시 `weekly-plan`으로 목표, 학습 적용 방식과 완료 조건을 Baseline으로 확정한다.
2. 제품 Issue와 가장 작은 Vertical Slice를 구현하며 실패 Case와 검증 자료를 함께 수집한다.
3. 중요한 선택은 Decision Log, 비교·측정은 Experiment Report에 기록한다.
4. 실제 결과를 Implementation Report와 WIL에 남기고 계획과 달라진 범위를 구분한다.
5. 다른 개발자가 재사용할 수 있는 문제 해결 과정은 기술 블로그로 재구성한다.

계획은 구현 중 새로 확인한 근거에 따라 바꿀 수 있지만 Baseline을 조용히 덮어쓰지 않는다. 변경 날짜, 이유, Product Gate 영향과 뒤로 이동한 범위를 해당 주차 계획에 기록한다.

## 저장소 구조

    .
    ├── plan/        # 총괄 계획, 주차별 Roadmap과 학습·콘텐츠 원칙
    ├── templates/   # 주차별 공개 산출물 양식
    ├── week1/       # 현재 주차의 계획과 이후 생성되는 검증 근거
    └── weekN/       # 각 주차가 시작될 때 실제 산출물과 함께 추가

빈 문서나 완료되지 않은 기능을 형식적으로 공개하지 않는다. 해당 주차에 실제 산출물이 생길 때 문서와 Link를 추가한다.

## 제품 저장소와 공개 경계

- 제품 요구사항과 Architecture는 별도 AgentOps Lab 제품 저장소의 기준 문서가 관리한다.
- 두 저장소는 독립적으로 이동·공개될 수 있으므로 서로의 로컬 절대·상대 경로를 참조하지 않는다.
- 과정 전에 수행한 완전 자동화 Prototype은 12주 구현·학습 성과에 포함하지 않는다.
- Secret, Credential, 개인정보, 비공개 대화, 내부 URL과 로컬 경로를 공개하지 않는다.
- 성능·비용·품질 개선은 비교 가능한 측정 근거가 있을 때만 주장한다.
