# 2026-10-06 핵심 질문과 Worker 실행·복구

> 상태: 진행 중 — 재시도 시간·최종 실패 경계 확인, 대기 Job 자동 처리 구현·검증
> 주제: 자동 Worker, 실패 유형별 재시도, 현재 Attempt, 중단 복구, 제안 조회와 Browser 흐름

10월 5일 학습 회차의 연장 실험까지는 [10월 5일 학습 노트](./2026-10-05-study-questions.md)에 모았다. 실제 실행일이 10월 6일인 Java AI→PostgreSQL 실험은 해당 날짜의 [Lab Report](../lab-reports/2026-10-06-java-provider-adapter-lab.md)에 남겼다. 이번에는 그 단일 처리기를 자동으로 실행하는 Worker와 재시도 조건을 살펴봤다.

## 재시도 간격과 전체 처리 기한은 다르다

내부 Backoff가 5초이고 Provider의 `Retry-After`가 15초라면 최소 대기는 15초다. 두 값을 더하는 것이 아니라 둘 다 만족하도록 더 긴 시간을 적용한다. 이 질문에는 15초라고 답했다.

처음에는 ‘Job의 남은 처리 기한이 10초’라는 말을 충분히 기다려줘야 하는 시간으로 생각했다. 설명을 듣고, **최소 대기는 다음 호출까지 기다려야 할 시간이고, 전체 기한은 이 Job을 처리할 수 있는 마지막 시각**이라는 차이를 정리했다.

예를 들어 지금부터 10초 뒤에 Job의 기한이 끝나고, Provider가 15초 뒤부터 재요청을 허용했다면 새로운 호출을 할 수 있는 시간대가 없다. 대기를 5초로 줄이거나 재시작하면서 기한을 새로 계산해서는 안 된다.

그렇다고 이미 접수한 문의를 취소하는 것은 아니다. 접수 Commit 전에 Message·Job 저장이 실패한 경우에는 접수 전체를 Rollback하지만, **접수 Commit 뒤 AI 실패나 시간 초과는 Ticket·Message를 취소할 이유가 아니다.** AI 작업의 실패를 원문과 따로 남긴다.

## 한 번의 시도 실패와 최종 FAILED

실패 뒤 자동 재시도가 더 있는지 질문하면서 두 경우를 구분했다.

- 한 번의 요청이 실패해도 재시도 가능한 원인이고 횟수·대기·기한 조건이 남아 있다면 다음 시도를 할 수 있다.
- Job을 최종 `FAILED`로 기록했다면 일반 Worker가 다시 실행하지 않는다. Application을 재시작해도 한도나 기한을 초기화하지 않는다.

관리자의 명시적 재시도는 아직 구현하지 않았다. 그런 기능을 추가하더라도 원인 해결과 재개 조건을 별도로 정해야 하며, 새 Job을 만들어 기존 한도를 우회하는 방식과는 구분해야 한다.

## Worker가 자주 확인하는 것과 AI를 자주 호출하는 것

`AiSuggestionJobProcessor`는 한 Job의 입력 처리·AI 호출·검증·저장을 담당한다. Worker는 이 처리기를 반복 실행하고, 허용된 실패의 다음 실행 시각을 DB에 기록한다.

Worker가 매초 DB를 확인하더라도 재시도 시각이 15초 뒤라면 그 전에는 추가 AI 호출을 하지 않는다. DB의 `PENDING` 상태뿐 아니라 `next_attempt_at`, 남은 전체 횟수와 처리 기한을 만족해야 새 실행권을 얻을 수 있다.

재시도를 기다리는 동안 DB Transaction이나 Row Lock을 잡아두지 않는다. 다음 요청의 실행권·예약을 새로 확보하고 Commit한 뒤 외부 호출을 진행한다. Rate Limit 재시도는 전체 생성 예약을 늘리지만 출력 보완 횟수를 늘리지는 않는다.

## 이번 구현에서 확인한 내용

Codex가 Java Worker·선택 활성화 설정과 Test를 작성·실행했다. 자동 실행은 기본적으로 꺼져 있고, 명시적으로 활성화하면서 Provider·개인정보 Guard·출력 검증기를 제공해야 한다. 기존 Application 실행이 전역 API Key를 읽어 유료 호출을 시작하는 구조는 추가하지 않았다.

실제 PostgreSQL과 통제된 Provider 응답으로 재시도 전 추가 예약 없음, 한도·기한 준수, 원문 보존, 최종 실패 제외와 경쟁 실행을 확인했다. 같은 DB를 유지한 새 Spring Context에서 대기 중 Job을 처리하고 재시도 시각·누적 횟수·원래 기한을 이어가는 것도 검증했다.

이는 같은 JVM에서 Spring Context를 새로 만든 Test다. 실제 JVM Process 중단·재시작, 결과 불명 `RUNNING`의 자동 복구와 새 Worker의 실제 AI 호출은 다음 단계에서 따로 확인한다. 앞선 실제 AI 저장 한 건의 근거는 그대로 유지한다.

최종 회귀는 Java 349개·JavaScript 104개와 ESLint가 통과했다. 새 Test는 31개이며 이번 유료 AI 호출은 0회다. 구체적인 조건과 Row Assertion은 [Worker Lab Report](../lab-reports/2026-10-06-worker-rate-limit-and-context-restart-lab.md)에 모았다.

## 핵심 질문

1. 내부 Backoff가 5초이고 Provider의 `Retry-After`가 15초라면, 최소 몇 초 뒤 새 요청을 시도할 수 있을까?
2. Job의 전체 처리 기한이 10초밖에 남지 않았다면 대기를 줄여 호출해도 될까? 새 호출을 중단할 때 이미 접수한 Ticket·Message도 취소해야 할까?
3. 대기 조건을 만족한 뒤에도 현재 Attempt·남은 한도·전체 기한을 다시 확인해야 하는 이유는 무엇일까?
4. 일시적인 Rate Limit과 크레딧 부족이 모두 `429`일 수 있는데도 같은 재시도 규칙을 사용하지 않는 이유는 무엇일까?
5. Worker가 매초 DB를 확인하는 것과 같은 Job을 매초 AI에 보내는 것은 왜 다른가?
6. 최종 `FAILED`와 다음 시도를 기다리는 `PENDING`은 어떻게 다른가?

1번은 답변으로 확인했고, 2번은 설명을 듣고 접수·AI 실패의 경계를 확인했다. 나머지와 전체 흐름의 독립 설명은 이어서 복습한다.

## 자동 실행과 중단 복구의 핵심 질문

- Processor를 직접 한 번 호출한 실험에서 자동 Worker가 추가로 맡아야 하는 일은 무엇일까?
- 접수 Commit 뒤 Application이 종료됐을 때 재시작한 Worker는 실행 근거를 어디에서 찾을까?
- `RUNNING`과 실행권 기한 만료만으로 Provider 미실행을 단정할 수 없는 이유는 무엇일까?
- 이전 Attempt의 늦은 응답이 현재 Job과 제안을 바꾸지 못하도록 어느 저장 경계에서 확인해야 할까?
- 메모리에 검증된 객체가 남은 저장 재시도와 Process 종료 후 복구는 어떤 점이 다를까?

## 조회·Browser·평가에서 확인할 질문

- AGENT의 상태·제안 조회가 새 AI 호출을 시작하면 안 되는 이유는 무엇일까?
- Browser가 접수 `201`을 받은 시점과 Job `SUCCEEDED`를 확인한 시점은 무엇이 다를까?
- Session·Role·CSRF Test와 실제 Browser 흐름은 각각 무엇을 확인할까?
- 구조·Category·Priority 후보 일치가 요약의 핵심 사실 보존까지 확인해 주지는 않는 이유는 무엇일까?
- 제안 문자열을 `textContent`로 표시해야 하는 이유와 Source·Log에 남기지 않아야 할 값은 무엇일까?

Week 7의 남은 순서와 완료 기준은 [주간 계획](../weekly-plan.md)을 따른다. 결과 불명 복구·AGENT 조회·Browser·수동 내용 평가와 WIL은 이어서 진행한다.

관련 개념: [AI 비동기 처리의 생애주기](../study-docs/ai-async-processing-lifecycle.md), [Provider Adapter와 HTTP 재시도](../study-docs/ai-provider-adapter-and-http-retries.md), [HTTP 접수와 인증 작성자](../study-docs/http-receipt-and-authenticated-author.md).
