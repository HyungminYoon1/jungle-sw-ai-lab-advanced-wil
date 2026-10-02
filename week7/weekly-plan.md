# Week 7 학습 계획 — LLM Structured Output·평가·Guardrail

> 작성일: 2026-09-29
> 최종 수정일: 2026-10-03
> 상태: In Progress — 10/2 회차 마감. N01 예비 비교·오프라인 평가 준비·가짜 Tool 실행 확인, 남은 평가·검증·수직 구현은 10/3 오전 10시 이후 재개
> 기간: 2026-09-29 ~ 2026-10-03
> 학습 제외일: 2026-10-04 일요일
> 초기 권장 순학습 시간: 40시간 — 휴식·식사 시간 제외. 실제 투입 시간·잔여 과업의 소요 시간과는 구분
> 모드: `DEEP_LEARNING_MODE`
> 핵심 질문: LLM의 출력을 정상적인 Domain 결과로 바로 믿지 않고, 형식·내용·보안·실패를 검증한 뒤 제안으로 저장할 수 있는가?

## 계획 배경

Week 6에는 최소 Browser UI에서 Session·CSRF를 유지하며 Ticket을 실제 PostgreSQL에 생성·조회했다. 9월 29일 기록상 Java Test 61개와 JavaScript Test 12개가 통과했고, 실제 Browser와 Database Row를 함께 확인했다. 이 결과는 AI 기능의 근거가 아니다.

현재 Application의 Ticket 입력은 `title` 하나이며 Spring에 연결된 AI 호출과 Suggestion 저장 기능은 없다. 독립 스크립트로 OpenAI의 Prompt-only와 Structured Outputs 응답 두 건은 확인했다. Week 7에는 최초 문의 Message를 입력으로 삼아 AI 제안 한 가지만 더한다. Ticket은 대화 묶음, Message는 원문, Job은 AI 처리 상태, Suggestion은 검증된 결과로 구분한다. AI가 Ticket 상태를 자동 변경하거나 공식 답변을 게시하지 않는다.

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

고정 Dataset v2 초안은 실존 사용자 정보가 없는 합성 문의 13건이다. 기존 정상 4건, 모호 3건, Prompt Injection 3건, 민감 정보 취급 2건을 유지하고 복수 문제 1건을 추가한다. 정답을 억지로 하나로 정할 수 없는 Case는 `판단 보류` 기준을 Rubric에 명시한다. Prompt-only와 Schema 강제 방식을 같은 Dataset·Model 설정으로 각각 두 번 실행하는 52회 비교를 기본안으로 검토한다. 이전 48회보다 4회 늘어난 계획이다. 10월 2일 이번 비교의 비용은 $1 이내로 승인받았으며, 우선 N01에서 최대 두 번 호출한다. 전체 52회 평가는 기준을 고정한 뒤 진행하며 자동 실행하지 않는다.

| 지표 | 확인 방법 | 해석 경계 |
|---|---|---|
| Schema 준수 | 필수 필드·타입·허용값·추가 필드의 검증 통과 수 | 형식 통과가 사실성의 근거는 아님 |
| 분류·우선순위 | 사전에 작성한 분류 집합과 Priority를 비교 | 목록의 순서는 제외하고 누락·불필요한 추가, 모호한 입력의 보류를 따로 기록 |
| 요약 충실도 | 원문에 없는 사실, 핵심 누락과 민감 내용 노출을 사람이 확인 | 자동 점수만으로 정답 처리하지 않음 |
| 실패·보안 | Provider 오류·Timeout·거부, Injection과 출력 검증 실패 수 | 선택한 공격 예제의 통과가 안전성 일반 증명은 아님 |
| 지연·사용량 | 조건별 응답 시간과 Provider가 제공하는 사용량 기록 | Model·설정·실행 조건 없이 성능·비용을 일반화하지 않음 |

Prompt·Schema·Dataset은 Version을 붙여 변경 전후를 비교한다. 원문 Credential이나 실제 개인정보는 Prompt·Dataset·Log에 넣지 않는다.

실제 Provider 비교와 검증기의 합성 응답 Test를 구분한다. 필드 누락·빈 문자열·공백 요약을 직접 넣어 차단 여부를 확인하는 것은 검증기 경계 Test이며, Model에서 그 응답이 실제로 발생했다는 근거가 아니다. 실제 생성 결과와 발생 빈도는 Provider 실험에서 별도로 기록한다.

### Test 계층별 완료 근거

1. 순수 Unit Test: Schema 이후의 Domain 값 검증, 허용값, 비어 있는 요약과 Guardrail 거부.
2. Provider 경계 Test: 성공·거부·Timeout·연결 실패·잘못된 출력 Test Double. 실제 Provider 호출 결과와 분리한다.
3. 실제 PostgreSQL Integration Test: 기존 Ticket·Message 0건 보존, 새 접수 Ticket·최초 Message의 원자성, 접수 이후 AI 실패의 원문 유지, 유효 Suggestion 저장·복원과 Job 상태 갱신.
4. Security Test: `USER`·`AGENT` 접수 허용, 익명 보호 GET `401`, `USER` 제안 조회 `403`, CSRF 없는 접수 거부를 분리.
5. 대표 Browser Trace: 접수 `201`과 AI 완료가 다른 시점인지, 작업 상태와 안전한 제안 표시를 실제 Session·CSRF·Server·PostgreSQL 흐름에서 확인. 실제 Provider 여부를 별도로 기록.
6. 최소 복구 Test: 동일 PostgreSQL을 유지한 단일 Application 재시작에서 미완료 Job과 중복 제안·시도 횟수를 확인. 복구 계약을 먼저 정하며 외부 호출의 정확히 한 번 실행을 주장하지 않음.

## 날짜별 실행 계획

아래 표는 10/2 회차 마감을 반영한 현재 실행 순서다. 시간 열은 9/29에 잡은 초기 순학습 배정이며 실제 투입 시간이나 잔여 과업을 모두 끝낼 수 있다는 추정이 아니다. 날짜가 10/3으로 넘어간 연장 구간은 10/2 학습노트에 포함하고, 실험 보고서는 실제 실행일을 유지한다. 미완료한 평가·검증·수직 구현은 10/3 오전 10시 이후 이어서 진행하며, 원래 날짜가 지났다는 이유로 과업을 완료 처리하지 않는다.

| 날짜 | 초기 배정 | 학습·실험·적용 | 종료 조건·현재 근거 |
|---|---:|---|---|
| 9/29 화 | 6시간 | Week 6 근거와 AI 미구현 경계 확인 → Prompt·Schema·신뢰 경계 기초 → 입력 본문·권한·저장 계약과 실패 Case 설계 | 자신의 말로 `출력 형식`과 `내용의 신뢰`를 구분하고, Prompt·Schema v1과 예상 Test 목록 작성 |
| 9/30 수 | 8시간 | 당초: Provider 최소 비교·실패 Test·본문 Migration. 실제: 판단 보류·자동 처리·원문 보존·Ticket/Message 계약 토의 | 개념·설계 정리. 실제 Provider 호출·Migration·새 Test는 미실시 |
| 10/1 목 | 8시간 | 실제: 비동기·Timeout·재시도·단계별 성공 토의 → Dataset·Rubric 초안과 요약 평가 → 분류·원인·Priority 구분 → 고객 입력과 AI 출력의 검증 | 학습노트와 잠정 기준 정리. 실제 Provider 호출·비교 평가·Tool Spike·Lab 구현은 미실시, 회차 종료 |
| 10/2 금 | 9시간 | 실제: 복수 Category·전체 Priority 토의 → N01 실제 예비 비교·핵심 누락 평가 → 13건·52회 평가의 오프라인 준비 → 보안·전송 최소화 방향 → 가짜 Tool Calling 실행 | 연장 구간 포함 회차 마감. JavaScript 54개 통과. 전체 고정 평가·전처리·Spring AI·Message/Job/Suggestion Migration과 수직 Test는 미실시 |
| 10/3 토 | 9시간 | 오전 10시 이후: Tool 경계 설명 확인·남은 기대값·`ABSTAIN`·예산 관리 → 고정 평가·Guardrail 실패 Test → Message·Job·Suggestion 수직 적용과 PostgreSQL Test → B 방식·최소 복구 → Security·CSRF·Browser·회귀·WIL | 10/2 잔여 과업을 삭제 없이 이월. 초기 9시간 배정으로 전체 완료를 보장하지 않으며, 실제 근거에 따라 완료·부분 완료·`NOT_RUN`을 구분 |
| **10/4 일** | **0시간** | **학습·구현·문서 작업 없음** | **휴식** |

10월 3일은 기존 목표 종료일이며, 이월한 평가·실험·구현과 복구 검증을 모두 마칠 수 있다는 확정은 아니다. 10/2 회차의 실제 근거와 잔여 과업을 아래 목록으로 구분했다. 초기 시간 배정을 실제 학습 시간으로 간주하지 않으며 재개 시 가용시간과 선행 조건을 확인한다. 학습 키워드를 삭제하지 않고 10/4 학습 제외는 유지한다. 블로그 게시·포럼 등록은 별도 공개 절차다.

## 계약과 평가 학습 진행 정리

- 정리한 개념: `UNDETERMINED`와 Field 누락의 차이, INSERT·Commit의 차이, 문의 접수·AI 작업·제안 검토 상태의 구분.
- 합의한 방향: Ticket은 대화 묶음, 원문은 Message에 저장, 접수 원본은 AI와 독립 보존, 최종 B 방식과 단계적 학습. 전체 Priority는 개별 문제와 보고된 누적·결합 영향으로 판단. 유효한 `ABSTAIN`은 Job `ABSTAINED`·Suggestion 0건으로 기록하며, 문의 Priority와 보안 신호를 분리하고 AI 전송용 복사본의 불필요한 민감 정보를 제거.
- 잠정안: 나머지 Job 상태·복구 정책, 구체적인 `ABSTAIN` 허용 사례, 누락 Field의 추가 생성 1회, 본문·요약 길이와 조회 표현, 전처리·탐지·원문 보관의 세부 정책.
- 실제 확인: N01의 독립 Provider 응답 두 건과 원문 대조. [최소 비교 기록](./lab-reports/2026-10-02-openai-structured-output-pilot.md).
- 미실시: 13건 전체의 고정 비교 평가, Message/Job/Suggestion Migration·Adapter, Spring AI 수직 흐름의 새 Unit·PostgreSQL·Security·Browser Test와 복구 실험.
- 준비 확인: 10/3에 10/2 미실시분을 재개해 13건·52개 최초 응답 비교 계획과 기대값 분리·예산 계산 Test를 추가. 새 Test 14개를 포함한 기존 JavaScript 41개 통과. 실제 전송·실행 간 예산 보존은 미구현.
- 독립 Spike 확인: 가짜 Tool의 정상·금지 이름·금지 인자·실행 중 실패는 각각 실행 1·0·0·1회. 새 Test 13개와 기존 41개를 함께 실행해 총 54개 통과. [실험 기록](./lab-reports/2026-10-03-tool-calling-validation-spike.md). 실제 Provider·DB 호출은 없으며 자료 없는 설명은 후속 확인.
- 학습 기록: [9/30 핵심 질문과 설계 정리](./study-notes/2026-09-30-study-questions.md). 토의 정리를 자료 없는 독립 설명이나 실제 실행 근거로 대신하지 않는다.

10/1에는 비동기 작업의 생애주기, Timeout과 결과 불명확, 재시도 간격·총 한도, 단계별 성공과 전체 완료를 정리했다. 검증된 결과가 메모리에 남아 있을 때에는 AI 재호출과 DB 저장 재시도를 구분했다.

평가 토의에서는 Schema 통과와 요약 충실도의 점수를 분리했고, A01의 정보 부족을 보존한 제안과 A03의 `HIGH` 판단을 확인했다. Category는 원인·책임 주체가 아닌 문의 유형이며, 세부 범위와 겹침 규칙은 잠정안이다. 공백 본문은 Provider 호출 전 Server에서 거부하고 Frontend는 1차 피드백을 제공하는 경계를 정리했다. 고객의 문의 본문과 AI가 생성한 `summary`, 출력 검증 실패와 명시적 판단 보류도 구분했다.

공백 요약 예제는 실제 Model 관찰이 아닌 합성 경계 사례로 정리했다. 요약 누락·빈 문자열·공백 문자열의 발생 빈도나 Prompt 개선 효과를 측정한 것은 아니다. 이번 문답까지를 10/1 회차로 마감하며 남은 내용은 10/2에 재개한다. 초기 배정 시간은 실제 투입 시간을 뜻하지 않는다.

- [10/1 핵심 질문과 이해 변화](./study-notes/2026-10-01-study-questions.md)
- [AI 비동기 처리의 생애주기](./study-docs/ai-async-processing-lifecycle.md)
- [AI 제안 평가 Dataset과 Rubric 초안](./ai-suggestion-evaluation-draft.md): 정상 4건·모호 3건·Injection 3건·민감 정보 취급 2건에 복수 문제 1건을 추가한 v2 초안. 기대값과 채점 기준은 검토 중이며 실제 생성 결과가 아니다.

10/2에는 Category를 단순 키워드가 아니라 해결을 요청한 문제의 유형으로 구분했다. 복수 `categories` 목록과 Ticket 자동 분리 금지, 별도의 미분류 문제에 한해 알려진 유형과 `UNDETERMINED`를 병기하는 규칙에 합의했다. 같은 유형의 여러 문제는 분류 목록에서 중복을 제거해도 요약에서는 보존한다. 중복 출금의 `HIGH` 판단은 금전 피해에 근거하며 멱등성 결함을 확정한 것은 아니라는 점도 정리했다. 이후 개별 문제의 최고값뿐 아니라 문의 전체의 누적·결합 영향을 보는 Priority 기준을 합의했다. 출력 구조는 v2 그대로이며 논리적 계약과 Rubric은 `v2.1-draft`로 구분한다. [10/2 핵심 질문과 계약 정리](./study-notes/2026-10-02-study-questions.md)

최소 비교는 사용자가 Helpdesk 전용 PowerShell에서 OpenAI `gpt-6-luna`에 N01을 두 방식으로 각각 한 번씩 호출했다. 두 응답은 HTTP 200과 공통 JSON·계약 검증을 통과했다. 원문 대조에서는 첫 요약의 로그인 성공 사실 누락을 확인하고, 보완한 Rubric으로 0점·2점을 기록했다. 자동 내용 채점이나 독립적인 블라인드 평가는 아니다. 준비 단계의 합성 응답 Test 15개와 기존 UI Test 12개, 총 27개 통과 기록과 실제 Provider 결과는 구분한다.

사용자가 승인한 $1은 10/2 Helpdesk API 실험 전체의 누적 상한이다. 예비 두 건의 사용량 기반 비용 추정 합계는 $0.0001895이며 실제 청구액과는 다르다. Dry run의 $0.00295725는 호출 전 계획용 추정치였다. 현재 Pilot에는 실행 간 누계나 하루 한도를 강제하는 기능이 없으므로 추가 호출 전 예산 관리 방식을 확인한다. 전체 고정 평가·Spring AI 연결·Migration·PostgreSQL 저장 Test는 미실시다.

### 10/2 회차 마감과 10/3 재개 순서

10/2의 연장 구간에는 이전 N01 Pilot을 보존하고 새 공통 Prompt·13건 Dataset·52개 비교 계획을 별도로 구성했다. 가짜 Tool Calling의 네 결과와 JavaScript Test 54개도 확인했다. 실제 전체 평가와 수직 적용은 미실시이며, 기대값·구체적인 `ABSTAIN` 사례·누적 예산 관리의 미결정 부분은 유지한다. 10/3 오전 10시 이후 다음 과업부터 재개한다. 10/4에는 과업을 배정하지 않고 선택한 학습 범위도 삭제하지 않는다.

1. 평가 준비 마무리: 합성 입력 13건의 기대 사실·분류 집합과 Category 범위·겹침 기준을 확인한다. 전체 Priority와 핵심 누락의 보완 기준을 적용하고, Case별 기대값은 Model 입력과 분리한다. 본 평가 전에 기준을 고정한다.
2. 최소 비교 정리: 실제 두 응답과 형식·수동 내용 판정을 구분한다. 예비 호출의 이전 Version은 보존하고 새 계약·Rubric·Prompt에 맞춘 본 평가와 분리한다.
3. 고정 평가: Dataset·Rubric·Prompt·Schema Version과 실행 조건, 하루 누적 호출 예산 관리를 맞춘 뒤 구조·분류·요약·실패·지연·사용량을 나눠 기록한다. 기본안은 13건 × 2방식 × 2반복이며 결합 영향의 추가 Case 편입은 별도 검토다.
4. Guardrail·경계 Test: 필드 누락·빈 문자열·공백·허용값 위반과 Provider 실패를 합성 응답 또는 Test Double로 분리한다. 실제 Provider 관찰과 혼합하지 않으며 잘못된 제안 저장 없음과 원문 보존의 검증 범위를 기록한다.
5. Tool Calling 설명 확인: 가짜 Spike의 Code·Test 실행은 완료했다. 허용하지 않은 인자를 실행 전에 거부하는 이유와 Provider 요청 횟수·Tool 실행 횟수의 차이를 자료 없이 설명하는 것은 남아 있다. 실제 외부 작업이나 Ticket 상태 변경은 추가하지 않는다.

10/2에 승인받은 $1은 해당 일자의 누적 상한이며 10/3의 새 호출 예산으로 자동 갱신하지 않는다. 현재 준비 Code는 실제 전송과 실행 간 누계 보존을 지원하지 않는다. 유료 본 평가 전에 해당 일자의 호출 범위·상한과 누계 관리 방식을 확인한다.

현재 논리적 출력 초안으로 평가 자료를 준비하는 것과 그 초안을 Lab 구현 계약으로 확정하는 것은 다르다. 구체적인 `ABSTAIN` 허용 사례처럼 남은 미결정 부분의 기대값을 임의로 확정하지 않는다. Job 등록·재시도·복구 세부 계약은 구현 전에 검토하고, 평가 준비와 독립적인 최소 AI 비교까지 모두 막는 선행 조건으로 확대하지 않는다.

평가 준비와 독립적인 최소 비교 이후 Lab 수직 적용은 다음 순서로 진행한다. 후속 대화 기능을 추가하거나 기존 AI 평가·Guardrail 범위를 줄이지 않는다.

1. Job 등록의 Commit 경계·처리 상태·중단 판정·재시도 상한·입력/조회 API를 검토하고 핵심 개념을 다시 설명한다.
2. 최소 비교에서 확인한 Provider의 Structured Output·비용·민감 정보 취급과 입력·출력 조건을 Lab 경계에 적용한다.
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
- 상태: 설계 합의. Lab의 Spring AI 연결·Message/Job/Suggestion Migration·새 수직 Test는 미실시. 독립 Provider 예비 호출 두 건은 별도 근거다.

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
| 10/2로 이월한 실험 때문에 수직 구현·검증이 밀림 | 10/2 종료 시 비교 실험·선행 계약·Migration·Test의 실제 완료 범위를 점검해 10/3 순서를 조정한다. 미실행 Gate를 완료로 바꾸거나 10/4에 학습을 배정하지 않는다. |

## 산출물과 Project Card

- `week7/study-docs/`: 필요한 기본 개념 자료. 날짜·진도·실행 상태를 섞지 않는다.
  - [AI API 응답과 Structured Outputs](./study-docs/structured-output-api-basics.md): API의 바깥 응답과 Model 출력, 전송용 Schema와 공통 검증기의 구분.
  - [Tool Calling — 호출 요청과 실제 실행](./study-docs/tool-calling-validation-and-execution.md): 허용 목록·인자 검증, 실행 전 거부와 실행 중 실패, 자동 재시도와의 구분.
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
- [x] 실제 Provider에서 Prompt-only와 Schema 강제 응답을 같은 조건으로 비교했다. N01·방식별 1회인 예비 비교이며 전체 고정 평가와 구분한다.
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
| 2026-10-02 | 10/1 회차의 연장 답변을 별도 날짜의 복습으로 표현 | 이어지는 학습을 같은 10/1 회차로 기록하고, 미실시 Dataset·Rubric·실제 비교·Tool Spike부터 진행 | 사용자의 학습 회차 결정 | 기존 날짜별 Baseline과 전체 범위는 유지. 실제 호출·평가는 실행 뒤에만 완료로 표시 |
| 2026-10-02 | 10/1 회차의 잔여 과업을 같은 회차에서 계속 진행할 예정 | 문답과 개념 정리까지 10/1 기록으로 마감하고, 미실시 평가·Provider 비교·Guardrail·Tool Spike·수직 구현은 10/2부터 재개 | 사용자의 재개 날짜 결정 | 학습 범위와 10/4 제외는 유지. 초기 시간 배정과 실제 진도를 구분하며 10/2 종료 시 잔여 과업 재점검 |
| 2026-10-02 | 단일 `category`·Dataset 12건·48회 비교 초안 | 복수 `categories` 목록·Ticket 자동 분리 금지, Dataset v2 13건·52회 비교 후보 | 독립적인 복수 문제를 분류에서 보존한다는 사용자 승인 | 기존 12건은 유지. Schema·저장 복원·평가 기준을 함께 수정하고 추가 4회의 호출·비용 한도는 실행 전에 확인 |
| 2026-10-02 | N01 비교 준비와 전체 Priority 미결정 | 실제 응답 두 건 확인·핵심 누락의 수동 평가·누적 및 결합 영향을 보는 Priority 기준 합의 | 사용자 실행 출력과 학습 문답의 판단을 반영 | 계약·Rubric `v2.1-draft`, 기존 출력 구조·13건 유지. 예비 결과는 별도 기록하며 본 평가·Spring 수직 적용은 미실시 |
| 2026-10-03 | N01 예비 코드만 있으며 10/2의 전체 비교가 미실시 | 13건·52개 계획·공통 Prompt·평가자 기대값 분리와 예산 계산 Test 준비 | 사용자가 10/2 미실시분 재개를 요청 | 새 준비 Test 14개 포함 JavaScript 41개 통과. 실제 전송·하루 누계 보존·수직 저장은 미구현, 10/4 제외와 원래 학습 범위 유지 |
| 2026-10-03 | 보안 의심 입력과 문의 Priority, 전송 전 민감 정보 처리의 기준 미결정 | 문의 Priority와 보안 신호를 분리하고 AI 전송용 복사본에서 불필요한 민감 정보 제거 | 사용자 제안과 분리·최소화 방향 승인 | 출력 계약·13건 Dataset·학습 범위는 유지. 전처리·탐지와 실제 경계 Test는 후속 작업 |
| 2026-10-03 | 가짜 Tool Calling Spike 미실시 | 허용 이름·빈 인자·Server 대상 고정과 검증 거부·실행 실패를 독립 실험 | 실행 횟수와 AI 재요청의 혼동을 작은 Code로 확인 | Spike Test 13개 포함 JavaScript 54개 통과. 실제 AI·DB·Ticket 변경 없음. 자료 없는 설명과 수직 구현 Gate는 남김 |
| 2026-10-03 | 10/2 잔여 평가·검증·수직 구현을 계속 진행 | 연장 구간을 포함해 10/2 회차를 마감하고 미실시 과업을 10/3 오전 10시 이후로 이월 | 사용자가 현재 기록·커밋과 다음 재개 시점을 요청 | 범위·완료 Gate·10/4 제외 유지. 새 호출 예산은 자동 갱신하지 않으며 미실행 과업은 완료 처리하지 않음 |

## 관련 기준

- [심화과정 12주 학습 계획](../plan/advanced-track-12-week-plan.md)
- [주차별 Roadmap](../plan/weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](../plan/learning-and-content-plan.md)
- [Week 6 완료 근거](../week6/weekly-plan.md)
