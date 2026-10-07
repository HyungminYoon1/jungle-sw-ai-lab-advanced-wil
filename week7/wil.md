# Week 7 WIL — AI 제안의 검증과 비동기 처리

> 기간: 2026-09-29 ~ 2026-10-07
> 문서 상태: 작성자 검토 완료 — 2026-10-07 블로그 게시·포럼 등록 완료 확인
> 학습 상태: Completed — Local 구현·평가·핵심 문답·최종 회귀와 공개 제출 완료
> 핵심 질문: AI의 출력을 어떻게 검증하고, 문의 원문과 분리해 안전하게 제안으로 저장할 수 있을까?

## 이번 주 요약

이번 주에는 문의 원문을 보존하면서 AI가 요약·분류·우선순위를 제안하는 흐름을 연결했다. 가장 크게 이해가 바뀐 부분은 AI 응답의 형식이 맞는 것, 내용이 원문에 충실한 것, DB에 저장된 것과 문의가 해결된 것이 모두 다른 결과라는 점이다.

같은 문의를 Prompt-only와 Structured Outputs로 비교하고, 요약의 충실도와 분류·우선순위를 따로 평가했다. Backend에서는 문의 접수와 AI 처리를 별도 Transaction으로 나누고, 재호출 전에 현재 실행권·호출 한도·저장 결과를 확인하도록 했다. 마지막에는 실제 Browser의 접수부터 자동 Worker·외부 AI·PostgreSQL·담당자 조회 화면까지 연결했다.

## 계획 대비 결과

초기에는 9/29~10/3에 마칠 계획이었지만, 10/5 회차 이후에도 구현·검증과 평가가 남아 10/6·10/7의 2일을 더 사용했다. 선택한 학습 범위는 유지하고 10/7에 회고와 공개 제출까지 마쳤다. 10/4에는 학습을 배정하지 않았다.

| 학습 범위 | 실제 결과 | 근거 |
|---|---|---|
| Structured Output 비교 | 합성 문의 13건 × 두 방식 × 두 반복, v3·v4 각각 52회 실행 | [Provider 비교](./lab-reports/2026-10-05-ai-output-policy-comparison.md) |
| 내용 평가 | v4 52건 후속 평가, v3 52건 Codex 예비 검토와 대표 문답 확인 | [v4 평가](./lab-reports/2026-10-07-ai-output-manual-review.md) · [v3 예비 평가](./lab-reports/2026-10-07-ai-output-v3-review-draft.md) |
| 입력·출력 검증 | 전송용 복사본의 알려진 합성 민감 값 치환, 전송 직전 Body 검사와 Java 출력 계약 검증 | [입력 실험](./lab-reports/2026-10-05-ai-output-policy-comparison.md) · [출력 검증](./lab-reports/2026-10-03-ai-output-validation-lab.md) |
| 인젝션 저장·실행 경계 | 실제 Spring AI·로컬 HTTP·PostgreSQL의 공격 사례 12개 통과. 거부 뒤 원문·Ticket 상태 유지, 형식만 맞는 응답은 검토 대기 | [통합 테스트](./lab-reports/2026-10-07-ai-injection-boundary-integration-lab.md) |
| 문의와 제안 저장 | Ticket·최초 Message·Job의 접수 원자성, 별도 제안·분류·Job 결과 저장 | [접수](./lab-reports/2026-10-05-ticket-receipt-http-lab.md) · [결과 저장](./lab-reports/2026-10-05-suggestion-result-storage-lab.md) |
| Worker·복구 | 예약·현재 Attempt·기한, 제한된 DB 재저장, Context와 실제 JVM 재시작 | [저장 재시도](./lab-reports/2026-10-06-validated-output-storage-retry-lab.md) · [JVM 재시작](./lab-reports/2026-10-06-worker-jvm-process-restart-lab.md) |
| Browser 수직 흐름 | Session·CSRF 접수, 자동 Worker의 실제 AI 요청 1회, PostgreSQL 저장·AGENT 화면 확인 | [연결 실험](./lab-reports/2026-10-06-worker-browser-experiment-lab.md) |
| Tool Calling 원리 | 가짜 Tool로 실행 전 거부와 실행 중 실패의 호출 횟수를 구분 | [독립 Spike](./lab-reports/2026-10-03-tool-calling-validation-spike.md) |
| 최종 품질 확인 | 공격 사례 추가 후 Java 461개 통과. 같은 날 앞선 JavaScript 145개·ESLint와 선정한 공개·Log 점검 | [최종 회귀](./lab-reports/2026-10-07-final-regression-and-exposure-review.md) |

## Schema를 통과한 것과 올바른 판단은 다르다

처음에는 AI 응답도 Browser 요청처럼 인증·CSRF 필터를 거쳐 Controller로 들어온다고 생각했다. 이번 실습에서는 문의 접수와 AI 처리를 분리하기 위해 Worker가 Provider Adapter를 통해 요청을 보내고 서버 내부 HTTP Client가 응답을 받도록 설계했다. Java·Spring이 강제하는 구조는 아니다. Spring AI로 외부 AI 호출과 Schema 형식 요청을 구성하고, 받은 결과는 앱의 출력 검증과 현재 실행권 확인을 거쳐 제안으로 저장했다.

JSON 문법, 필요한 Field·Type·허용값, 요약의 내용은 각각 따로 확인했다. 실제 중복 출금과 환불 요청을 정확히 요약했어도 `priority: "NORMAL"`이면 합의한 금전 피해 기준의 `HIGH`와 맞지 않는다. `NORMAL` 자체는 허용된 Enum이므로 Schema 검사는 통과한다. 요약 2점과 잘못된 우선순위가 동시에 존재할 수 있었다.

정보 부족도 구분했다. `UNDETERMINED`는 해당 항목을 판단하기 어렵다는 유효한 값이지 누락된 Field를 대신 채우는 기본값이 아니다. `OTHER`는 내용을 이해했지만 정한 분류 범주 밖이라는 뜻이다. 유효한 `ABSTAIN`은 제안을 만들지 않되 Job에 판단 보류 결과를 남긴다. Provider 거부나 출력 검증 실패를 이 상태로 바꾸면 실패 이유가 사라진다.

Schema를 통과한 요약도 외부 서비스에서 받은 데이터이며 여전히 검증 대상이라고 설명했다. Server의 형식·저장 조건 검사와 원문 대조·담당자 판단을 구분하고, AI 결과는 공식 답변이 아닌 검토 대기 제안으로 다룬다.

## 평가 기준도 문의의 의미에 맞아야 한다

요약은 원문을 그대로 복사하는 작업이 아니다. 빠진 정보 때문에 현재 상태나 대응 방향을 오해하는지가 중요했다. 로그인 링크가 만료됐지만 새 링크로 로그인에 성공했다면, 복구 사실을 빼고 현재 로그인 장애처럼 요약해서는 안 된다.

반대로 원인을 만들어내지 않고 로그인 불가·중복 출금과 확인·환불 요청을 모두 남겼다면, ‘원인은 모르겠습니다’라는 문장이 없다는 이유만으로 0점을 주는 것은 타당하지 않다고 질문했다. 이 토의를 바탕으로 정해 둔 단어의 존재보다 문의의 의미와 대응에 필요한 정보를 보는 v2.2 기준을 적용했다.

고정 Dataset의 두 방식은 같은 제목·본문과 공통 지시를 받았다. 실제 실행 Model은 `gpt-6-luna`였고, 보완 Prompt에는 합의한 금전 피해·이용 장애 기준을 명확히 적었다. Dataset과 기대값은 유지했다.

| 지표 | v3 Prompt-only | v3 Structured Outputs | v4 Prompt-only | v4 Structured Outputs |
|---|---:|---:|---:|---:|
| JSON·출력 계약 통과 | 26/26 | 26/26 | 26/26 | 26/26 |
| 기대 분류 집합 일치 | 24/26 | 24/26 | 26/26 | 26/26 |
| 기대 우선순위 일치 | 20/26 | 20/26 | 26/26 | 26/26 |
| 후속 기준의 요약 2점 | 23/26 | 22/26 | 25/26 | 25/26 |

v3의 전체 요약 점수는 Codex의 예비 판정이며 나는 대표 응답을 확인했다. v4는 Codex와 원문을 대조하며 평가했고, 내가 제시한 판정과 지도 채점의 출처를 Report에 구분했다. 원본 응답과 실행 당시 `NOT_SCORED`는 보존하고 후속 평가를 따로 남겼다.

보완 Prompt의 요약은 2점 50건·1점 2건이었다. 1점 두 건은 핵심 사실은 남았지만 급한 문의가 아니라는 중요한 부수 정보가 빠진 경우다. 두 방식의 점수 분포는 같았으므로 Structured Outputs가 더 좋은 요약을 만든다고 결론 내리지 않았다. Prompt 보완 뒤의 변화도 이번 고정 Dataset에서 관찰한 회귀 결과로 정리했다.

## 문의 접수와 AI 처리를 분리했다

Ticket은 대화 묶음, Message는 원문, Job은 AI 처리 상태, Suggestion은 검증된 제안으로 구분했다. 이번 구현에서는 최초 문의만 저장하고 처리한다.

```text
Session·Role·CSRF를 통과한 문의 접수 요청
  └─ [접수 Transaction] Ticket + 최초 Message + PENDING Job → Commit
       ├─ 접수 API: 201 응답
       └─ Worker: 실행권·호출 예약 Commit → 외부 AI → 출력 검증
                    └─ [결과 Transaction] 제안 + 분류 + Job SUCCEEDED → Commit
```

Job 등록이 실패하면 같은 Transaction의 Ticket·Message도 Rollback해야 한다. 반면 접수 Commit 이후의 AI 실패는 이미 받은 문의를 취소하는 이유가 아니다. Worker가 처리할 기준도 Browser의 `201` 수신 여부가 아니라 DB에 Commit된 Job이다. 외부 AI를 기다리는 동안 DB Transaction이나 Job Row Lock을 계속 잡고 있지는 않는다.

Message의 작성자는 Browser가 주장한 이름이 아니라 `Authentication.getName()`에서 얻는다. Job에는 입력 Message ID를 고정해 두므로, 접수 후 새 메시지가 생겨도 처리할 원문이 바뀌지 않는다. AI가 반환한 ID나 Role을 이 근거 대신 사용하지 않는다.

## 재시도는 같은 작업을 무조건 한 번 더 하는 것이 아니다

호출 한도 예약과 실제 Provider 실행은 다르다. 예약을 Commit한 직후 Process가 종료되면 전송 여부를 확인하지 못할 수 있다. DB 기록을 지우거나 횟수를 초기화하지 않고, 실패 종류·현재 Attempt·기한·한도를 확인해 허용된 복구만 진행한다.

Worker B가 새로운 Attempt의 실행권을 얻었다면 A의 늦은 정상 응답도 저장하지 않는다. 기준은 어느 응답이 먼저 왔는지가 아니라 지금 누가 해당 Job의 결과를 반영할 수 있는가다. 반대로 생성 한도 소진은 새 AI 호출을 막는 조건이지, 현재 Attempt의 유효한 결과 저장까지 막는 조건은 아니다.

제안 저장 중 오류가 나면 먼저 같은 Job의 Commit 결과를 조회한다. 이미 저장됐으면 그 결과를 사용하고, 아직 저장되지 않았으며 검증 객체가 현재 Process에 남아 있다면 DB 저장만 다시 시도한다. 이 재저장은 새 Provider 호출이나 생성 예약을 소비하지 않는다. Process가 종료돼 객체까지 사라진 상황은 메모리 객체의 저장 재시도와 구분했다.

이 규칙은 실제 PostgreSQL의 Rollback·경쟁 저장·중복 제안 방지 Test와 서로 다른 JVM Process의 재시작 Test로 확인했다. DB는 두 Process 사이에 계속 유지했다.

## 실제 화면에서도 세 가지 상태를 나눴다

Browser 실험에서는 USER가 Session Cookie와 CSRF Header로 접수하고, 자동 Worker가 실제 AI를 호출한 뒤 AGENT 화면에서 저장된 제안을 조회했다. 정상 접수는 `201`, CSRF 없는 대조 POST는 `403`이었다. 제안 조회는 익명 `401`·USER `403`·AGENT `200`으로 구분됐다.

최종 DB에는 원문이 보존됐고 제안·분류가 각각 1건 남았다. 상태는 Ticket `OPEN`, Job `SUCCEEDED`, 제안 `PENDING_REVIEW`였다. 화면도 ‘AI 제안 생성 완료·담당자 검토 대기’를 표시했다.

Job이 `FAILED`여도 그 상태를 정상적으로 조회하면 HTTP 응답은 `200`이다. 따라서 `response.ok`만 보고 AI 작업이 성공했다고 표시하면 안 된다. 조회 성공, AI 처리 결과, 담당자 검토와 문의 해결을 따로 보게 됐다.

## 입력·출력과 실행 경계를 따로 확인했다

민감 정보는 원문 DB를 바꾸지 않고 외부 전송용 복사본에서 처리했다. 종류를 아는 값은 종류를 남겨 치환하고, 최종 요약뿐 아니라 전송 직전 요청 Body도 확인했다. 실험에서는 알려진 합성 값을 사용했다.

프롬프트 인젝션에는 의심 문장을 찾아 삭제하는 별도 탐지기를 만들지 않았다. 대신 서버 정책은 `SystemMessage`, 문의 제목·본문은 `UserMessage`로 분리하고, 문의 안의 명령은 따르지 않도록 지시했다. 응답은 정한 네 Field로 제한하고 Java 검증기를 거쳐 제안으로 저장한다. AI 응답으로 Tool을 실행하거나 Ticket 상태를 변경하는 경로는 연결하지 않았다.

실제 AI 비교에서는 우선순위 변경·추가 Field·상태 변경을 요구한 세 Case를 넣어 출력을 대조했다. 다만 `HIGH`처럼 허용된 값으로 판단을 왜곡하거나 요약에 잘못된 내용을 넣는 문제는 형식 검사로 구분할 수 없다. 그래서 제안은 검토 대기로 남기고 원문과 비교한다. 개인정보 치환, Schema 검사, 안전한 화면 표시는 각각 다른 문제를 다룬다. [OpenAI 안전 설계 안내](https://developers.openai.com/api/docs/guides/agent-builder-safety)

저장한 요약을 화면에 넣을 때에는 `textContent`로 표시한다. 문자열·길이 규칙을 통과했다는 사실만으로 `innerHTML`에 넣어도 안전한 것은 아니다. AI가 만든 문자열도 외부 데이터라는 점은 저장 이후에도 그대로다.

이 경계는 합성 공격 응답을 실제 Java·PostgreSQL 흐름에 넣어 추가로 확인했다. 추가 Field·잘못된 JSON·Enum·Tool 호출 응답은 거부한 뒤 제안·분류 0건을 확인했고, 접수 원문과 원래 Ticket·다른 Ticket의 상태는 유지됐다. 형식상 유효한 잘못된 HIGH와 명령문 요약도 검토 대기 제안으로만 저장됐다. AI 응답은 로컬 HTTP Fixture가 반환했으며 실제 AI 비교와는 다른 테스트다.

Tool Calling은 실제 외부 작업과 분리한 가짜 Tool 실험으로 확인했다. 허용하지 않은 함수·인자는 실행 전에 거부하므로 호출 0회였고, 허용된 함수가 실행 도중 실패하면 호출 1회였다. 출력 Field를 보완하는 정책과 실제 작업을 다시 실행하는 정책은 같지 않다. 실제 Tool 권한 검사·외부 Side Effect 연결은 이번 Spike에 넣지 않았다.

## Test와 AI 활용

10월 7일 전체 회귀 테스트에서 Java 449개·JavaScript 145개와 ESLint가 통과했다. 이후 공격 사례 12개를 추가하고 Java 전체 Suite를 다시 실행해 461개 통과를 확인했다. 기존 기능과 새 구현이 함께 정상 동작하는지 확인하는 테스트다. 이 Suite의 Provider 응답은 통제했고 새 실제 AI 호출은 0회였다. 10월 6일의 실제 Browser·AI 연결 실험과, 독립 평가 실행기의 Dataset 비교는 별도 근거로 남겼다.

Code·Test 구현과 반복 수정, 자료·문서 초안은 Codex의 도움을 받았다. 나는 문의 원문 보존, Transaction 분리, 작성자 결정, 판단 보류, 현재 Attempt와 재시도 조건을 토의하고 검토했다. 전용 PowerShell에서 실제 실험을 실행하고 원문·요약을 비교했으며, 이해가 부족한 부분은 문답으로 다시 확인했다. 구현 Code를 모두 손으로 작성한 성과와는 구분한다.

평가 지표와 구체적인 예시로 판정 기준을 맞추는 방법은 [OpenAI Docs의 평가 안내](https://developers.openai.com/api/docs/guides/evaluation-best-practices)를 참고했다. 이번 평가에서는 형식·분류·우선순위·요약 충실도와 판정 출처를 나누어 기록했다.

## 회고와 다음 주

자연스러운 요약이 곧 올바른 업무 판단은 아니었다. `NORMAL`이 Schema를 통과하면서도 정책에는 맞지 않을 수 있고, DB에 제안이 저장돼도 문의는 아직 해결되지 않았다. ‘성공’이라는 말을 어느 단계의 결과인지 구체적으로 설명하는 것이 이번 주의 핵심이었다.

다음에는 Code를 더 늘리기보다 대표 실패 한 가지의 Test·DB Row·화면을 함께 보고 내 말로 설명하는 방식으로 학습하겠다. 7주차 WIL은 내 표현에 맞게 검토·수정한 뒤 블로그에 게시하고 포럼에 등록했다.

Week 8은 현재 수직 흐름을 대상으로 Container·Compose·CI·Process 종료·관측과 Cloud·HTTPS를 학습한다. 로그인 계정은 아직 메모리 구성이고, 이번 근거는 Local 실행이다. 후속 대화·공식 답변·검색·Dashboard 같은 수평 확장은 Week 9 이후로 남긴다.

## 공개 기록

- 블로그 게시·포럼 등록: 완료. 2026-10-07 작성자 확인을 반영했다.
- 게시 URL은 이 기록에 아직 첨부하지 않았다.

관련 기록: [Week 7 계획](./weekly-plan.md), [10월 7일 핵심 질문](./study-notes/2026-10-07-study-questions.md), [AI 비동기 처리의 생애주기](./study-docs/ai-async-processing-lifecycle.md), [AI 제안의 신뢰 경계](./study-docs/ai-suggestion-trust-boundaries.md).
