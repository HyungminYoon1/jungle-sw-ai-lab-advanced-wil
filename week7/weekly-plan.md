# Week 7 학습 계획 — LLM Structured Output·평가·Guardrail

> 작성일: 2026-09-29
> 최종 수정일: 2026-10-01
> 상태: In Progress — 9/30 설계 토의 정리, Provider 실험·Lab 구현은 미실시
> 기간: 2026-09-29 ~ 2026-10-03
> 학습 제외일: 2026-10-04 일요일
> 권장 순학습 시간: 40시간 — 휴식·식사 시간 제외
> 모드: `DEEP_LEARNING_MODE`
> 핵심 질문: LLM의 출력을 정상적인 Domain 결과로 바로 믿지 않고, 형식·내용·보안·실패를 검증한 뒤 제안으로 저장할 수 있는가?

## 계획 배경

Week 6에는 최소 Browser UI에서 Session·CSRF를 유지하며 Ticket을 실제 PostgreSQL에 생성·조회했다. 9월 29일 기록상 Java Test 61개와 JavaScript Test 12개가 통과했고, 실제 Browser와 Database Row를 함께 확인했다. 이 결과는 AI 기능의 근거가 아니다.

현재 Ticket 입력은 `title` 하나이며 AI Provider 호출, Structured Output, Suggestion 저장 기능은 없다. Week 7에는 최초 문의 Message를 입력으로 삼아 AI 제안 한 가지만 더한다. Ticket은 대화 묶음, Message는 원문, Job은 AI 처리 상태, Suggestion은 검증된 결과로 구분한다. AI가 Ticket 상태를 자동 변경하거나 공식 답변을 게시하지 않는다.

## 이번 주 목표

| 구분 | 목표 | 완료 근거 |
|---|---|---|
| 개념 | Prompt 지시와 사용자 데이터, JSON 문법·Schema 준수·내용 정확성을 구분 | 자신의 말로 흐름을 설명하고 대표 반례에 답변 |
| 비교 실험 | Prompt-only JSON과 Provider의 Schema 강제 방식을 같은 문의에서 비교 | Prompt·Schema·Dataset Version, 실제 호출과 결과 표 |
| 평가 | 고정 Dataset과 Rubric으로 구조·분류·요약·지연·사용량을 분리 평가 | 입력별 결과, 수동 확인 항목과 실패 원인 |
| Guardrail | Prompt Injection·민감 정보·잘못된 출력을 입력·출력 경계에서 검증 | 정상·거부·누락·Timeout Test와 검증 실패 시 Suggestion 저장 없음 |
| 수직 적용 | Ticket·최초 Message의 접수 Commit과 별도 AI 처리·제안 저장 연결 | Migration·실제 PostgreSQL Integration Test·최소 Browser Trace·단일 Application 중단 복구 |
| 공개 기록 | Week 7의 이해 변화와 실제 실행 범위를 WIL로 정리 | Lab Report·Study Note·WIL, 공개 전 민감 정보 점검 |

JSON Schema가 맞는 결과라도 요약에 없는 사실을 만들어낼 수 있다. 따라서 `Schema 통과`와 `업무적으로 옳은 제안`을 같은 판정으로 취급하지 않는다.

## 시작 Baseline과 첫날 결정 Gate

Source Baseline은 2026-09-29 읽기 전용 확인 기준이다. 오른쪽 설계 항목에는 9/30 토의 결과를 반영했다. 설계 합의를 구현·Test 완료로 표시하지 않는다.

| 대상 | 현재 확인 | 첫날 결정·확인 |
|---|---|---|
| Ticket 입력 | 제목만 보관·전달 | 최초 원문을 `ticket_messages`에 저장. 기존 Row에는 원문을 임의 생성하지 않음. 새 접수는 제목·공백이 아닌 최초 Message를 요구 |
| Security | Session·Role·CSRF가 Ticket API를 보호 | 기존 `USER`·`AGENT` 접수 권한 유지. AI는 Server의 자동 처리이며 제안 조회는 `AGENT` 안으로 검토 |
| 영속성 | PostgreSQL Ticket Adapter와 Flyway V1 적용 | Ticket·최초 Message를 함께 Commit하고, AI Job·Suggestion은 원본과 책임을 분리 |
| AI 연동 | Provider·Prompt·Schema·평가 Dataset 없음 | Schema 강제 기능을 가진 Provider 한 개만 선택하고 공식 문서·호출 비용을 확인 |
| 검증 | Week 6 Java·JavaScript 회귀가 마지막 근거 | Week 7 변경 후 Unit·Provider 경계·PostgreSQL·Security·Browser 근거를 새로 확보 |

9/29의 `description` Column 추가안은 9/30에 Ticket·Message 모델로 변경했다. 최초 문의 본문을 Ticket과 Message에 중복 보관하지 않는다. 기존 Ticket은 Message 0건으로 조회 가능하게 두고, 새 접수에는 공백이 아닌 최초 Message를 요구한다. `title`만으로 상세 요약을 평가했다고 주장하지 않으며 입력 메시지가 없으면 Provider를 호출하지 않는다.

최종 처리 방식은 B다. 접수 Commit 뒤 `201`을 먼저 응답하고 Server가 별도 AI 작업을 수행한다. AI 실패로 이미 접수한 원문을 취소하지 않는다. 수동 제안 생성 API를 필수로 두지 않는다.

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
| 자동 AI 작업·처리 상태·최소 복구 | 선택 적용 | 접수 응답 후 중단된 작업을 어떻게 찾고, 원문 보존·중복 제안 방지·호출 상한을 확인하는가? |
| Tool Calling 선택·인자 검증 | 독립 Spike | 허용 목록 밖 Tool·잘못된 인자를 실행 없이 어떻게 거부하는가? |
| RAG·Vector DB·LoRA·VLM·Multi-Agent | 선정 제외 | 이번 한 수직 흐름의 선행 조건이 아님 |
| 실제 Email·일정·게시·Ticket 자동 상태 변경 | 선정 제외 | AI 제안은 외부 Side Effect를 자동 실행하지 않음 |

Tool Calling Spike는 가짜 Tool과 허용 목록을 이용한다. 실제 외부 API나 Ticket 상태 변경을 실행하지 않는다. 최초 Message 저장은 AI 입력의 최소 수직 연결이며, 후속 대화·공식 답변·내부 메모·UI 장식·검색·Dashboard는 추가하지 않는다. Kafka·RabbitMQ와 분산 Worker 구축은 범위에 넣지 않는다.

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
3. 실제 PostgreSQL Integration Test: 기존 Ticket·Message 0건 보존, 새 접수 Ticket·최초 Message의 원자성, 접수 이후 AI 실패의 원문 유지, 유효 Suggestion 저장·복원과 Job 상태 갱신.
4. Security Test: `USER`·`AGENT` 접수 허용, 익명 보호 GET `401`, `USER` 제안 조회 `403`, CSRF 없는 접수 거부를 분리.
5. 대표 Browser Trace: 접수 `201`과 AI 완료가 다른 시점인지, 작업 상태와 안전한 제안 표시를 실제 Session·CSRF·Server·PostgreSQL 흐름에서 확인. 실제 Provider 여부를 별도로 기록.
6. 최소 복구 Test: 동일 PostgreSQL을 유지한 단일 Application 재시작에서 미완료 Job과 중복 제안·시도 횟수를 확인. 복구 계약을 먼저 정하며 외부 호출의 정확히 한 번 실행을 주장하지 않음.

## 날짜별 실행 계획

아래 표는 9/29에 잡은 날짜별 Baseline이다. 시간은 순학습 시간이며 실제 투입 시간이나 완료 근거가 아니다. 9/30에는 계약 토의를 진행했고, 그날 예정한 Provider 실험·Migration은 미실시다. 재개 순서는 아래 진행 정리를 먼저 따른다.

| 날짜 | 시간 | 학습·실험·적용 | 일일 종료 조건 |
|---|---:|---|---|
| 9/29 화 | 6시간 | Week 6 근거와 AI 미구현 경계 확인 → Prompt·Schema·신뢰 경계 기초 → 입력 본문·권한·저장 계약과 실패 Case 설계 | 자신의 말로 `출력 형식`과 `내용의 신뢰`를 구분하고, Prompt·Schema v1과 예상 Test 목록 작성 |
| 9/30 수 | 8시간 | 당초: Provider 최소 비교·실패 Test·본문 Migration. 실제: 판단 보류·자동 처리·원문 보존·Ticket/Message 계약 토의 | 개념·설계 정리. 실제 Provider 호출·Migration·새 Test는 미실시 |
| 10/1 목 | 8시간 | 12건 Dataset·Rubric 확정 → 동일 조건 비교 평가 → 수동 내용 확인 → Tool Calling 허용 목록·인자 검증 Spike | Versioned 평가 결과와 대표 오답·거부·모호 Case, Side Effect 없는 Tool Spike |
| 10/2 금 | 9시간 | Injection·Guardrail → 최초 Message·AI Provider·Suggestion 연결 → 실제 PostgreSQL 실패 Test. 단계별 선행 조건을 먼저 확인 | 기본 처리 성공·실패와 원문 보존 근거 |
| 10/3 토 | 9시간 | B 방식·최소 복구 → 권한·CSRF·Browser Trace → 전체 회귀·민감 정보 점검 → 자료 없는 설명·WIL | 정상·실패·복구의 계층별 근거와 완료/부분 완료 판정 |
| **10/4 일** | **0시간** | **학습·구현·문서 작업 없음** | **휴식** |

10월 3일은 기존 목표 종료일이며, 9/30 미실시 범위와 추가 복구 검증을 모두 마칠 수 있다는 확정은 아니다. 재개 시 실제 가용시간과 선행 조건을 점검해 날짜별 배분을 다시 조정한다. 학습 키워드를 조용히 삭제하지 않고 10/4 학습 제외는 유지한다. 블로그 게시·포럼 등록은 별도 공개 절차다.

## 9/30 진행 정리와 재개 순서

- 정리한 개념: `UNDETERMINED`와 Field 누락의 차이, INSERT·Commit의 차이, 문의 접수·AI 작업·제안 검토 상태의 구분.
- 합의한 방향: Ticket은 대화 묶음, 원문은 Message에 저장, 접수 원본은 AI와 독립 보존, 최종 B 방식과 단계적 학습.
- 잠정안: 다섯 Job 상태, `ABSTAIN` 기록 방식, 누락 Field의 추가 생성 1회, 본문·요약 길이와 조회 표현.
- 미실시: Provider 선택·실제 호출·비교 평가, Message/Job/Suggestion Migration·Adapter, 새 Unit·PostgreSQL·Security·Browser Test와 복구 실험.
- 학습 기록: [9/30 핵심 질문과 설계 정리](./study-notes/2026-09-30-study-questions.md). 토의 정리를 자료 없는 독립 설명이나 실제 실행 근거로 대신하지 않는다.

재개는 다음 순서로 진행한다. 후속 대화 기능을 추가하거나 기존 AI 평가·Guardrail 범위를 줄이지 않는다.

1. Job 등록의 Commit 경계·처리 상태·중단 판정·재시도 상한·입력/조회 API를 검토하고 핵심 개념을 다시 설명한다.
2. Provider 한 개의 공식 Structured Output·비용·민감 정보 취급을 확인하고 Prompt-only 최소 비교를 실행한다.
3. 이미 Commit된 입력을 사용한 기본 AI 처리 Test에서 정상·Invalid Output·Provider 실패·제안 저장 실패를 분리한다.
4. B 방식으로 연결한 뒤 단일 Application·PostgreSQL의 최소 중단 복구와 중복 제안 방지를 확인한다.
5. Dataset·Rubric·Guardrail·Tool Calling Spike·Security·Browser·회귀·WIL의 남은 Gate를 실제 근거로 확인한다.

## Ticket·Message 계약 결정

- 배경: 제목만 있는 현재 Ticket에 실제 AI 입력이 필요하다. 최초 문의와 후속 답변을 별도 모델로 만들면 원문 저장 방식이 비대칭이 된다.
- 선택지: Ticket의 `description`과 별도 답변 Table, 또는 대화를 묶는 Ticket과 최초 문의·답변을 저장하는 Message.
- 결정: Ticket·Message 1:N 모델을 채택한다. 최초 원문은 Message에만 저장하며, 새 접수는 Ticket과 최초 Message를 같은 Transaction으로 Commit한다. 기존 Ticket에는 없는 메시지를 임의 생성하지 않는다.
- 권한·범위: 기존 `USER`·`AGENT` 접수 권한은 유지한다. 최초 Message 입력·AI 연결만 이번 주 구현하며, 고객의 자기 대화 조회·후속 메시지·공식 답변 기능은 이후 별도 계약이다.
- 적용 대상: 생성 요청·Application·Domain·Repository·Browser 입력·Migration·관련 Test와 AI 입력 조회. Job 등록·복구의 구체적인 Commit 경계는 검토 중이다.
- 후속 검증: 기존 Ticket 조회·Message 0건, 새 접수 원자성, AI 실패 뒤 Ticket·Message 유지, 같은 입력의 제안 저장·작업 상태를 실제 PostgreSQL에서 확인한다.
- 상태: 설계 합의. Lab 구현·Migration 적용·Provider 호출·새 Test는 미실시.

## 실행 중 판단할 정책·저장 경계

- 입력 원문: 위 결정대로 최초 Message를 추가한다. 기존 Ticket의 Message 부재와 새 요청의 필수 입력을 구분하며 임의 Backfill하지 않는다.
- Provider: 한 개만 선택하고 Model·Schema 지원 범위, 호출 실패, 사용량과 비용 한도를 확인한다.
- Suggestion: 검증을 통과해 저장돼도 확정 판단이 아니다. 담당자 확인 전 상태와 저장할 최소 Metadata를 정하고 Ticket 상태를 자동 변경하지 않는다.
- 자동 처리·권한: 접수 Commit·응답 뒤 Server가 AI를 수행한다. 제안 조회는 `AGENT` 안으로 검토하며, USER 접수를 제안 조회의 `403`과 혼동하지 않는다. Job 상태·복구 조건은 구현 전에 확정한다.
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
- [ ] 검증된 제안만 실제 PostgreSQL에 별도 저장하며 AI 실패 시 접수 완료된 Ticket·최초 Message가 보존된다.
- [ ] 기존 Ticket의 Message 부재를 보존하며 조회하고, 새 요청의 공백 본문·최초 Message 저장 실패와 입력 없는 AI 미호출 Test가 있다.
- [ ] 접수 응답과 AI 완료를 분리하고, 최소 작업 상태·중단 복구·같은 Job의 중복 제안 방지를 실제 근거로 확인했다.
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
| 2026-09-30 | `description` 추가와 수동 제안 생성 API 초안 | Ticket·Message 모델, 접수 Commit·응답 이후 자동 AI 처리 B | 사용자가 원본 문의의 독립 보존과 대화 묶음 모델을 선택 | 최초 메시지·자동 처리의 수직 흐름만 추가. 후속 대화 기능은 이후 범위 |
| 2026-09-30 | Provider 비교·Migration을 진행할 예정 | 실제로는 계약 토의 진행, 실행 항목은 미실시로 유지 | 입력·Transaction·처리 상태를 먼저 검토 | 다음 재개에서 선행 계약부터 처리하며 시간 배분을 다시 점검 |
| 2026-09-30 | AI 수직 연결에 복구 범위 미명시 | 기본 처리 Test → B 연결 → 단일 Application·PostgreSQL의 최소 복구 | 비동기 실행과 복구를 구분하고 단계별 실패를 이해 | AI 평가·Guardrail 범위 유지. 분산 Worker·Message Broker는 제외 |

## 관련 기준

- [심화과정 12주 학습 계획](../plan/advanced-track-12-week-plan.md)
- [주차별 Roadmap](../plan/weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](../plan/learning-and-content-plan.md)
- [Week 6 완료 근거](../week6/weekly-plan.md)
