# 2026-10-06 핵심 질문과 Worker 실행·복구

> 상태: 학습 재개 예정 — 아래 질문의 답변·구현·실행 결과는 아직 기록하지 않음
> 주제: 자동 Worker, 실패 유형별 재시도, 현재 Attempt, 중단 복구, 제안 조회와 Browser 흐름

10월 5일 학습 회차의 연장 실험까지는 [10월 5일 학습 노트](./2026-10-05-study-questions.md)에 모았다. 실제 실행일이 10월 6일인 Java AI→PostgreSQL 실험은 해당 날짜의 [Lab Report](../lab-reports/2026-10-06-java-provider-adapter-lab.md)에 남겼다. 이 노트는 다음 학습 회차에서 확인할 질문부터 시작한다.

## 먼저 확인할 재시도 질문

1. 내부 Backoff가 5초이고 Provider의 `Retry-After`가 15초라면, 최소 몇 초 뒤 새 요청을 시도할 수 있을까?
2. Job의 전체 처리 기한이 10초밖에 남지 않았다면 대기를 줄여 호출해도 될까? 새 호출을 중단할 때 이미 접수한 Ticket·Message도 취소해야 할까?
3. 대기 조건을 만족한 뒤에도 현재 Attempt·남은 한도·전체 기한을 다시 확인해야 하는 이유는 무엇일까?
4. 일시적인 Rate Limit과 크레딧 부족이 모두 `429`일 수 있는데도 같은 재시도 규칙을 사용하지 않는 이유는 무엇일까?

질문 1·2는 이전 회차 마지막에 제시됐지만 아직 답하지 않았다. 설명을 읽은 것과 자료 없이 답한 것은 구분해 기록한다.

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

이후 답변·구현·Test·Browser 관찰을 확인한 범위만 이 노트에 추가한다. Week 7의 남은 순서와 완료 기준은 [주간 계획](../weekly-plan.md)을 따른다.

관련 개념: [AI 비동기 처리의 생애주기](../study-docs/ai-async-processing-lifecycle.md), [Provider Adapter와 HTTP 재시도](../study-docs/ai-provider-adapter-and-http-retries.md), [HTTP 접수와 인증 작성자](../study-docs/http-receipt-and-authenticated-author.md).
