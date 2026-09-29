# Week 7 학습 계획 — LLM Structured Output·평가·Guardrail

> 작성일: 2026-09-29
> 상태: Baseline — 계획 확정, 실행 근거는 날짜별 기록에서 확인
> 기간: 2026-09-29 ~ 2026-10-03
> 학습 제외일: 2026-10-04 일요일
> 권장 순학습 시간: 40시간 — 휴식·식사 시간 제외
> 모드: `DEEP_LEARNING_MODE`
> 핵심 질문: LLM의 출력을 정상적인 Domain 결과로 바로 믿지 않고, 형식·내용·보안·실패를 검증한 뒤 제안으로 저장할 수 있는가?

## 계획 배경

Week 6에는 최소 Browser UI에서 Session·CSRF를 유지하며 Ticket을 실제 PostgreSQL에 생성·조회했다. 9월 29일 기록상 Java Test 61개와 JavaScript Test 12개가 통과했고, 실제 Browser와 Database Row를 함께 확인했다. 이 결과는 AI 기능의 근거가 아니다.

현재 Ticket 입력은 `title` 하나이며 AI Provider 호출, Structured Output, Suggestion 저장 기능은 없다. Week 7에는 기존 수직 흐름에 AI 제안 한 가지만 더한다. 문의 요약·카테고리·우선순위를 제안하되 AI가 Ticket 상태를 자동 변경하지 않으며, 검증과 담당자 확인의 경계를 분명히 한다.

## 이번 주 목표

| 구분 | 목표 | 완료 근거 |
|---|---|---|
| 개념 | Prompt 지시와 사용자 데이터, JSON 문법·Schema 준수·내용 정확성을 구분 | 자신의 말로 흐름을 설명하고 대표 반례에 답변 |
| 비교 실험 | Prompt-only JSON과 Provider의 Schema 강제 방식을 같은 문의에서 비교 | Prompt·Schema·Dataset Version, 실제 호출과 결과 표 |
| 평가 | 고정 Dataset과 Rubric으로 구조·분류·요약·지연·사용량을 분리 평가 | 입력별 결과, 수동 확인 항목과 실패 원인 |
| Guardrail | Prompt Injection·민감 정보·잘못된 출력을 입력·출력 경계에서 검증 | 정상·거부·누락·Timeout Test와 실패 시 저장 없음 |
| 수직 적용 | 검증을 통과한 AI Suggestion만 Ticket과 분리해 PostgreSQL에 저장 | Migration·실제 PostgreSQL Integration Test·최소 Browser Trace |
| 공개 기록 | Week 7의 이해 변화와 실제 실행 범위를 WIL로 정리 | Lab Report·Study Note·WIL, 공개 전 민감 정보 점검 |

JSON Schema가 맞는 결과라도 요약에 없는 사실을 만들어낼 수 있다. 따라서 `Schema 통과`와 `업무적으로 옳은 제안`을 같은 판정으로 취급하지 않는다.

## 시작 Baseline과 첫날 결정 Gate

2026-09-29 읽기 전용 확인 기준이다. 아래 상태는 Week 7 실행 결과가 아니다.

| 대상 | 현재 확인 | 첫날 결정·확인 |
|---|---|---|
| Ticket 입력 | 제목만 보관·전달 | `description` 추가 결정. 기존 Row의 본문 부재는 `NULL`로 보존하고, 새 생성 입력은 공백이 아닌 본문을 요구. 구현·Test는 미실시 |
| Security | Session·Role·CSRF가 Ticket API를 보호 | AI 제안 생성·조회 권한과 실패 Status 계약을 정함. 기본안은 담당자 `AGENT`만 사용 |
| 영속성 | PostgreSQL Ticket Adapter와 Flyway V1 적용 | Suggestion을 별도 Table에 저장하고 Ticket 상태와 분리할 방법 결정 |
| AI 연동 | Provider·Prompt·Schema·평가 Dataset 없음 | Schema 강제 기능을 가진 Provider 한 개만 선택하고 공식 문서·호출 비용을 확인 |
| 검증 | Week 6 Java·JavaScript 회귀가 마지막 근거 | Week 7 변경 후 Unit·Provider 경계·PostgreSQL·Security·Browser 근거를 새로 확보 |

입력 계약은 `description` 필드 한 개를 추가하는 것으로 정했다. `title`만으로 긴 문의의 요약과 우선순위를 평가했다고 주장하지 않는다. 기존 Ticket Row의 본문 부재는 `NULL`로 보존하고, 새 Ticket 생성 요청에는 공백이 아닌 본문을 요구한다. 본문 없는 Ticket의 AI 제안 요청은 Provider 호출 전에 중단한다. 같은 기능을 여러 AI Framework로 중복 구현하지 않는다.

Prompt·Schema·권한·저장·실패 응답은 [AI Suggestion 계약 초안](./ai-suggestion-contract-draft.md)에서 질문을 통해 검토한다. 초안의 잠정 값은 Lab 구현 계약으로 아직 확정하지 않았다.

Provider 자격 증명은 Server 측 설정에만 둔다. 값 자체는 Console·Test Report·Source·WIL에 출력하지 않는다. Provider를 실제로 호출할 수 없는 경우 Test Double 근거와 실제 호출 `NOT_RUN`을 구분하며 Week 7 AI 연동을 완료로 표시하지 않는다.

## 학습 범위와 경계

| 항목 | 분류 | 질문·실험 |
|---|---|---|
| Prompt의 역할과 입력·출력 신뢰 경계 | 핵심 학습 | 사용자 문의 속 명령을 Server 지시와 왜 구분해야 하는가? |
| JSON Schema·Structured Output | 핵심 학습 | JSON 문법 성공, Schema 통과, 의미상 올바름은 어떻게 다른가? |
| Provider 실패·Timeout·거부·Invalid Output | 핵심 학습 | 어디서 실패하며 어떤 결과가 Database에 남지 않아야 하는가? |
| 고정 Dataset·Rubric·회귀 평가 | 핵심 학습 | 같은 입력과 설정에서 무엇을 비교해야 품질 판단이 가능한가? |
| Prompt Injection·입력/출력 Guardrail | 핵심 학습 | Prompt 지시만으로 막을 수 없는 실패를 Code와 권한 경계에서 어떻게 제한하는가? |
| 검증된 Suggestion의 PostgreSQL 저장 | 선택 적용 | AI 결과를 Ticket의 확정 상태와 분리해 어떻게 복원·조회하는가? |
| Tool Calling 선택·인자 검증 | 독립 Spike | 허용 목록 밖 Tool·잘못된 인자를 실행 없이 어떻게 거부하는가? |
| RAG·Vector DB·LoRA·VLM·Multi-Agent | 선정 제외 | 이번 한 수직 흐름의 선행 조건이 아님 |
| 실제 Email·일정·게시·Ticket 자동 상태 변경 | 선정 제외 | AI 제안은 외부 Side Effect를 자동 실행하지 않음 |

Tool Calling Spike는 가짜 Tool과 허용 목록을 이용한다. 실제 외부 API나 Ticket 상태 변경을 실행하지 않는다. UI 장식·검색·Comment·Dashboard도 추가하지 않는다.

## 평가·검증 설계

고정 Dataset 초안은 실존 사용자 정보가 없는 합성 문의 12건이다. 정상 4건, 모호 3건, Prompt Injection 3건, 민감 정보 취급 2건으로 시작한다. 정답을 억지로 하나로 정할 수 없는 Case는 `판단 보류` 기준을 Rubric에 명시한다. Prompt-only와 Schema 강제 방식을 같은 Dataset·Model 설정으로 각각 두 번 실행하는 48회 이내 비교를 기본안으로 하되, 실제 호출 전 Provider 비용과 한도를 확인한다.

| 지표 | 확인 방법 | 해석 경계 |
|---|---|---|
| Schema 준수 | 필수 필드·타입·허용값·추가 필드의 검증 통과 수 | 형식 통과가 사실성의 근거는 아님 |
| 분류·우선순위 | 사전에 작성한 기준 Label과 비교 | 모호한 입력의 보류·불일치를 따로 기록 |
| 요약 충실도 | 원문에 없는 사실, 핵심 누락과 민감 내용 노출을 사람이 확인 | 자동 점수만으로 정답 처리하지 않음 |
| 실패·보안 | Provider 오류·Timeout·거부, Injection과 출력 검증 실패 수 | 선택한 공격 예제의 통과가 안전성 일반 증명은 아님 |
| 지연·사용량 | 조건별 응답 시간과 Provider가 제공하는 사용량 기록 | Model·설정·실행 조건 없이 성능·비용을 일반화하지 않음 |

Prompt·Schema·Dataset은 Version을 붙여 변경 전후를 비교한다. 원문 Credential이나 실제 개인정보는 Prompt·Dataset·Log에 넣지 않는다.

### Test 계층별 완료 근거

1. 순수 Unit Test: Schema 이후의 Domain 값 검증, 허용값, 비어 있는 요약과 Guardrail 거부.
2. Provider 경계 Test: 성공·거부·Timeout·연결 실패·잘못된 출력 Test Double. 실제 Provider 호출 결과와 분리한다.
3. 실제 PostgreSQL Integration Test: 기존 Ticket Row의 `description IS NULL` 보존·조회, 유효 Suggestion의 별도 저장·복원, Foreign Key·Migration, 실패 시 Row와 Ticket 상태 불변.
4. Security Test: 익명 `401`, 권한 없는 `USER`의 `403`, `AGENT`의 허용 요청, CSRF 없는 상태 변경 거부.
5. 대표 Browser Trace: 실제 Session·CSRF·Server·PostgreSQL 흐름에서 제안 생성·표시를 확인. AI 호출의 실제 여부를 별도로 표시한다.

## 날짜별 실행 계획

아래 시간은 순학습 시간이며 긴 Block 사이의 휴식·식사는 별도다. 계획만 작성하거나 Card를 생성한 것을 실행 근거로 삼지 않는다.

| 날짜 | 시간 | 학습·실험·적용 | 일일 종료 조건 |
|---|---:|---|---|
| 9/29 화 | 6시간 | Week 6 근거와 AI 미구현 경계 확인 → Prompt·Schema·신뢰 경계 기초 → 입력 본문·권한·저장 계약과 실패 Case 설계 | 자신의 말로 `출력 형식`과 `내용의 신뢰`를 구분하고, Prompt·Schema v1과 예상 Test 목록 작성 |
| 9/30 수 | 8시간 | Provider 한 개의 공식 Structured Output 방식 확인 → Prompt-only와 Schema 강제 최소 비교 → Provider 실패 Test → 필요한 Ticket 본문·Migration 최소 변경 | 실제 호출과 Test Double 결과를 구분한 비교 기록, 본문 호환·실패 Test |
| 10/1 목 | 8시간 | 12건 Dataset·Rubric 확정 → 동일 조건 비교 평가 → 수동 내용 확인 → Tool Calling 허용 목록·인자 검증 Spike | Versioned 평가 결과와 대표 오답·거부·모호 Case, Side Effect 없는 Tool Spike |
| 10/2 금 | 9시간 | Injection·민감 출력·길이 경계와 Guardrail Test → AI Provider·Application·Suggestion Repository 연결 → 실제 PostgreSQL Migration·실패 Test | 유효 제안만 별도 저장, 실패 출력은 저장하지 않음, Ticket 상태 불변 |
| 10/3 토 | 9시간 | `AGENT` 권한·CSRF → 최소 Browser 제안 표시와 실제 Trace → Java·JavaScript 회귀·민감 정보 점검 → 자료 없는 설명·Lab Report·WIL 초안 | 정상·실패의 계층별 근거와 Week 7 완료/부분 완료 판정 |
| **10/4 일** | **0시간** | **학습·구현·문서 작업 없음** | **휴식** |

Week 7 학습과 WIL 초안은 10월 3일에 마친다. 과정의 월요일 블로그 게시·포럼 등록은 사용자의 별도 공개 절차이며, 게시 전에는 완료로 표시하지 않는다.

## Ticket 본문 계약 결정

- 배경: 현재 Ticket에는 제목만 있다. 기존 Row에는 사용자가 작성한 본문이 없지만, AI 요약에는 실제 문의 내용이 필요하다.
- 비교한 방법: 제목을 본문으로 복사하거나 `없음` 같은 대체 문자열을 채우는 방법은 부재를 실제 본문처럼 보이게 한다. AI로 본문을 생성해 과거 Row에 채우는 방법도 사용자 원문과 생성 결과의 출처를 섞는다.
- 결정: Migration에서는 `description`을 처음부터 `NOT NULL`로 강제하지 않고 기존 Row의 `NULL`을 유지한다. 새 Ticket 생성 경로는 공백이 아닌 본문을 요구하고, 기존 Row는 계속 조회한다. 본문 없는 Ticket으로 AI 제안을 요청하면 Provider 호출 전에 거부한다. 실제 근거가 있는 본문을 모든 Row에 마련할 수 있을 때만 `NOT NULL`을 재검토한다.
- 적용 대상: Ticket 생성 요청·Domain·Repository 복원·Browser 입력·Migration·관련 Test. AI가 만든 글이 필요해도 사용자 `description`에 원문처럼 덮어쓰지 않는다.
- 후속 검증: 기존 Row가 있는 PostgreSQL에서 Migration과 조회, 새 생성 요청의 공백 거부, 본문 없는 Ticket의 Provider 호출 0회와 Suggestion 미저장을 각각 확인한다. `NULL`은 허용하면서 공백 문자열은 거부할 DB 제약은 구현 시 Test와 함께 확정한다.
- 상태: 설계 결정만 완료. Lab Source 변경, Migration 적용, Provider 호출과 Test는 아직 하지 않았다.

## 실행 중 판단할 정책·저장 경계

- 입력 본문: 위 결정대로 `description`을 추가한다. 기존 Row의 `NULL`과 새 요청의 필수 입력을 구분하며 대체 문자열·AI 생성 본문으로 임의 Backfill하지 않는다.
- Provider: 한 개만 선택하고 Model·Schema 지원 범위, 호출 실패, 사용량과 비용 한도를 확인한다.
- Suggestion: 검증을 통과해 저장돼도 확정 판단이 아니다. 담당자 확인 전 상태와 저장할 최소 Metadata를 정하고 Ticket 상태를 자동 변경하지 않는다.
- 권한: 제안 생성·조회는 기본적으로 `AGENT`에게만 열고 `USER`·익명·CSRF 실패를 Test한다. 기존 Security 계약과 충돌하면 구현 전에 재검토한다.
- 보관: 평가용 합성 입력과 Runtime 문의를 구분한다. 원문 Prompt·Provider 전체 응답·Credential을 무조건 저장하거나 Log에 남기지 않는다.

비교 선택지, 최종 결정, 이유와 영향을 Lab 구현 전에 기록한다. 데이터 보관·권한·외부 Provider 사용에서 합의가 필요한 변경은 임의로 확대하지 않는다.

## 위험과 Cut Line

| 위험 | 대응 |
|---|---|
| Provider 연결·비용 때문에 실험이 지연 | 실제 호출 범위와 비용 한도를 먼저 정한다. Test Double로 실패 경계를 학습하되 실제 AI 완료로 대체하지 않는다. |
| AI 응답이 JSON Schema를 통과하지만 내용이 틀림 | Dataset Rubric과 Human 검토를 별도로 적용한다. Schema 점수만으로 품질을 주장하지 않는다. |
| 통합 구현이 학습을 압도 | UI 장식·추가 화면·복수 Provider를 줄인다. 평가·Guardrail·실제 PostgreSQL 수직 연결은 삭제하지 않는다. |
| Prompt Injection이 출력 또는 행동을 오염 | 사용자 입력을 명령으로 승격하지 않고, 출력 검증과 Side Effect 금지를 Code 경계에서 적용한다. |
| 토요일 검증이 밀림 | 금요일까지 Migration·저장 실패 Test를 끝낸다. 미실행 Gate는 `NOT_RUN`으로 남기고 10/4에 학습을 배정하지 않는다. |

## 산출물과 Project Card

- `week7/study-docs/`: 필요한 기본 개념 자료. 날짜·진도·실행 상태를 섞지 않는다.
- `week7/study-notes/`: 날짜별 핵심 질문, 처음의 이해와 수정된 설명.
- `week7/lab-reports/`: 비교 조건·실제 호출·Test·Database·Browser 관찰.
- `week7/wil.md`: 완료·부분 완료·미실행과 이해 변화. 게시·포럼 등록은 별도 확인.
- Helpdesk Lab: Prompt·Schema·Dataset Version, AI 경계, Suggestion Migration·Adapter·Test. WIL 문서와 별도 Repository·Commit으로 관리.

GitHub Project에는 다음 다섯 Card를 계획한다. 첫 Card만 `Ready`, 선행 조건이 있는 나머지는 `Backlog`로 시작한다. 실제 학습·실험을 시작하기 전 `In progress`로 올리지 않는다.

1. 입력·Schema 계약과 Structured Output 비교
2. Versioned Dataset·Rubric 평가와 Tool Calling Spike
3. Prompt Injection·Guardrail·Provider 실패 Test
4. AI Suggestion PostgreSQL 저장과 실패 원자성
5. Security·Browser 수직 검증·전체 회귀·WIL

## Week 7 완료 Gate

- [ ] Prompt 지시, 사용자 데이터, Model 출력과 Application 검증의 경계를 자신의 말로 설명했다.
- [ ] 실제 Provider에서 Prompt-only와 Schema 강제 응답을 같은 조건으로 비교했다.
- [ ] Versioned Dataset·Rubric과 구조·내용·실패·지연·사용량 결과가 있다.
- [ ] 대표 Injection·민감 출력·Provider 실패를 재현하고 제한한 경계를 설명했다.
- [ ] 검증된 제안만 실제 PostgreSQL에 별도 저장하며 실패 시 Ticket 상태가 보존된다.
- [ ] 기존 Ticket Row의 본문 부재를 보존하며 조회하고, 새 요청의 공백 본문과 본문 없는 Ticket의 AI 호출을 각각 거부하는 Test가 있다.
- [ ] Security·CSRF와 최소 Browser 흐름을 실제 Test·Trace로 확인했다.
- [ ] Side Effect 없는 Tool Calling Spike의 허용 목록·인자 검증을 설명했다.
- [ ] 전체 회귀와 Secret·Log·공개 문서 점검 결과를 기록했다.
- [ ] AI가 작성한 부분과 직접 판단·수정·검증한 부분을 WIL에서 구분했다.
- [ ] 미실행 항목을 완료로 표현하지 않았고 10/4에 학습을 배정하지 않았다.

## 계획 변경 기록

| 날짜 | 변경 전 | 변경 후 | 이유 | 영향 |
|---|---|---|---|---|
| 2026-09-29 | 9/29~10/4 순학습 40시간 초안 | 9/29~10/3 순학습 40시간, 10/4 학습 제외 | 사용자 일정 결정 | 선택한 AI Native 범위는 유지하고 금요일까지 PostgreSQL 저장 Test, 토요일까지 수직 검증·WIL 초안을 마침 |
| 2026-09-29 | Ticket 본문 추가 여부와 기존 Row 처리 미결정 | `description` 추가, 기존 Row `NULL` 보존, 새 입력 필수, 본문 없으면 AI 미호출 | 없는 원문을 대체 문자열이나 AI 생성 글로 채우면 출처와 의미가 달라짐 | Migration·API·Domain·Repository·Browser·Test 계약을 분리해 구현 |

## 관련 기준

- [심화과정 12주 학습 계획](../plan/advanced-track-12-week-plan.md)
- [주차별 Roadmap](../plan/weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](../plan/learning-and-content-plan.md)
- [Week 6 완료 근거](../week6/weekly-plan.md)
