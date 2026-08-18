# Week <주차> 구현 Report — <기능 또는 Milestone>

> 상태: Draft | Verified | Released  
> 관련 Issue: <공개 Issue Link>  
> 관련 Release: <Release 또는 Tag>  
> 검증일: <YYYY-MM-DD>

## 요약

<무엇을 왜 구현했으며 현재 사용 가능한 수준이 어디까지인지 3~5문장으로 설명한다.>

## 해결하려는 사용자 문제

- 대상 사용자: <역할>
- 기존 문제: <관찰 가능한 문제>
- 기대 결과: <사용자가 얻는 가치>
- 성공 기준: <측정하거나 확인할 수 있는 기준>

## 구현 범위

### 포함

- <완료한 기능>

### 제외·유예

- <이번 구현에서 제외한 항목>
- 이동한 Release: <R2 | R3 | 후속 Release>
- 이동 이유와 선행 조건: <내용>

## 사용자 흐름

1. <사용자 행동>
2. <시스템 판단>
3. <외부 호출 또는 승인>
4. <결과와 실패 처리>

## Architecture와 책임

| Layer·Module | 책임 | 주요 변경 | 변경하지 않은 경계 |
|---|---|---|---|
| Web·API | <입력·응답 책임> | <변경> | Business Logic과 DB 직접 접근 없음 |
| Application | <Use Case·Transaction> | <변경> | <경계> |
| Domain | <상태·불변 조건> | <변경> | Framework 독립 |
| Adapter | <DB·Model·Tool·Connector> | <변경> | Port 계약 유지 |

### 핵심 설계

<상태 Machine, Sequence, Module 관계를 설명하고 공개 Diagram을 연결한다.>

## Data와 Migration

- 변경 Entity·Value Object: <내용>
- Migration: <파일 또는 Version>
- Constraint·Index: <이유와 검증>
- 기존 데이터 호환성: <결과>
- 보존·삭제 영향: <내용>

## Security와 권한

| 점검 항목 | 적용 내용 | 실패 Test 또는 근거 |
|---|---|---|
| 인증 | <적용> | <근거> |
| Server-side 인가 | <Role·Capability·Scope> | <근거> |
| Organization 격리 | <적용> | <근거> |
| 입력 검증 | <적용> | <근거> |
| 승인·Side Effect | <적용> | <근거> |
| Secret·개인정보 | <Redaction·최소 수집> | <근거> |

## Acceptance Criteria

| ID | 조건 | 검증 방법 | 결과 | 근거 |
|---|---|---|---|---|
| AC-01 | <Given·When·Then> | <Unit·Integration·E2E·사용자> | Pass | <Link> |

## Test와 검증

| 종류 | 검증 대상 | 실행 결과 | 근거 |
|---|---|---|---|
| Domain Unit | <불변 조건> | <결과> | <Link> |
| PostgreSQL Integration | <Query·Transaction·Lock> | <결과> | <Link> |
| Adapter Contract | <외부 성공·실패 계약> | <결과> | <Link> |
| Browser E2E | <사용자 흐름> | <결과> | <Link> |
| Security | <공격·권한 실패> | <결과> | <Link> |
| Resilience | <Timeout·Retry·중복·부분 실패> | <결과> | <Link> |

실행하지 않은 Test는 빈칸으로 두지 않고 미실행 이유와 계획을 기록한다.

## 운영 결과

- 배포 환경과 Release: <민감하지 않은 공개 정보>
- 주요 Metric: <요청 수, 성공·실패, Latency, 비용 등>
- Log·Trace 확인: <결과>
- Backup·Restore 또는 Rollback: <실행 여부와 결과>
- 알려진 운영 한계: <내용>

## 사용자 검증

- 참가자 역할과 수: <개인정보를 제외한 집계>
- 수행 Scenario: <내용>
- 관찰 결과: <도움 없이 완료한 단계와 막힌 지점>
- 반영한 개선: <Issue Link>

## AI 활용과 검토

| AI 활용 영역 | 생성·제안 내용 | 사람이 검토·수정한 내용 | 검증 |
|---|---|---|---|
| <조사·코드·Test·문서> | <내용> | <판단과 수정> | <Test·Review Link> |

## 알려진 한계와 다음 단계

- 현재 한계: <과장 없이 기술>
- 사용자 영향: <내용>
- 임시 대응: <내용>
- 근본 해결 목표 Release: <내용>

## 재현 방법

<공개 Repository 기준으로 필요한 Version, 명령, Fixture와 예상 결과를 설명한다. Secret 값은 포함하지 않는다.>

## 관련 자료

- Requirements: <Link>
- Decision Log: <Link>
- Experiment: <Link>
- Test·Dataset: <Link>
- WIL·기술 블로그: <Link>
