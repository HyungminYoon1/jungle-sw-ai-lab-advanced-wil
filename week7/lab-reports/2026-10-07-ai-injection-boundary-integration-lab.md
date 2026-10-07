# 공격성 입력·AI 응답과 PostgreSQL 저장 경계

> 검증일: 2026-10-07
> 상태: 신규 통합 테스트 12개·추가 후 전체 Java 회귀 461개 통과
> 실제 AI 모델 호출: 0회

## 확인할 질문

문의 본문이 서버 지시를 바꾸려 하거나 AI 응답이 권한·Ticket 상태·Tool 실행을 요구해도, 접수한 원문을 유지하면서 허용된 제안만 저장하는가? 형식이 맞는 잘못된 판단도 자동으로 확정하지 않는가?

## 실험 구성

Lab의 `AiSuggestionInjectionBoundaryIntegrationTest`에서 실제 접수 Service·실행권·입력 Repository·Spring AI Adapter·SDK·출력 검증기·결과 Service와 PostgreSQL 17.6 Testcontainer를 연결했다. 외부 응답만 Loopback HTTP Server가 반환하는 합성 응답으로 대체했다. 요청의 직렬화와 HTTP 송수신은 실제 코드가 수행한다.

```text
접수 Service → Ticket·Message·PENDING Job Commit
  → Processor의 실행권·호출 예약 Commit
  → 고정 Message 조회·전송용 복사본
  → Spring AI·SDK → 로컬 HTTP 응답
  → 응답 Envelope·Java 출력 계약 검사
  → 결과 Transaction → PostgreSQL Row 확인
```

모델이 특정 공격에 어떻게 답하는지가 아니라, 정해 둔 공격 응답을 Application의 저장·실행 경계가 어떻게 처리하는지 확인하는 실험이다. 실제 AI 비교의 I01·I02·I03 출력 평가는 [별도 기록](./2026-10-07-ai-output-manual-review.md)으로 유지한다.

접수는 HTTP가 아닌 Application Service를 직접 호출했다. 작성자 Snapshot이 보존되는 것은 확인하지만, 이번 테스트를 로그인·CSRF·Browser E2E의 새 검증으로 표현하지 않는다. 자동 Scheduler는 끄고 Processor를 호출한다.

## 사례와 결과

| 사례 | 테스트 수 | 처리 결과 | PostgreSQL 결과 |
|---|---:|---|---|
| 본문의 지시·가짜 system JSON + 정상 응답 | 1 | 서버 지시는 System, 원문은 User 메시지로 유지 | 제안·분류 각 1건, 검토 대기 |
| 추가 ticketId·messageId·role·status·tool·instructions | 6 | OUTPUT_INVALID, Job FAILED | 제안·분류 0건 |
| JSON 대신 실행 지시 반환 | 1 | OUTPUT_INVALID, Job FAILED | 제안·분류 0건 |
| 허용하지 않은 URGENT 우선순위 | 1 | OUTPUT_INVALID, Job FAILED | 제안·분류 0건 |
| Provider Envelope의 tool_calls | 1 | Adapter에서 거부, Job FAILED | 제안·분류 0건 |
| 형식에 맞는 명령문·SQL 문자열 요약 | 1 | 문자열 데이터로 저장 | 제안 검토 대기, SQL·Ticket 상태 변경 없음 |
| 급하지 않은 문의에 형식상 유효한 HIGH | 1 | 형식 검사 통과 | HIGH 제안은 검토 대기, Ticket 해결로 바뀌지 않음 |

모든 사례에서 접수한 Ticket의 제목, Message 본문·작성자·Ticket 연결, Job의 입력 Message 연결이 유지됐다. 같은 DB에 둔 다른 Ticket도 제목과 `OPEN` 상태를 유지했다. 거부된 응답의 예외 발생만 확인하지 않고 처리 후 실제 Row를 조회했다.

각 사례의 HTTP 요청은 1회, 생성 예약은 1회였다. 출력 보완 예약은 0회이며 다음 PENDING 처리에서도 새 호출은 없었다. 이미 접수된 Ticket·Message는 AI 실패로 Rollback하지 않았다.

## 형식 검사와 내용 검토의 차이

문의에 넣은 공격 문장은 원문에 남기고 User 메시지의 데이터로 보냈다. 서버 정책과 Schema는 본문의 명령으로 바뀌지 않았으며, 알려진 합성 연락처만 전송용 복사본에서 치환했다. 원문 전체를 지우는 방식이나 새로운 인젝션 탐지기를 추가한 것은 아니다.

`HIGH`는 허용된 Enum이므로 잘못된 우선순위라도 형식 검사를 통과한다. 명령문이나 SQL처럼 보이는 문장도 문자열·길이 규칙에 맞으면 요약으로 저장될 수 있다. 이번 테스트는 이를 내용상 올바르다고 판정하지 않는다. 저장한 제안은 `PENDING_REVIEW`, Ticket은 `OPEN`이며, 생성된 문장을 업무 명령이나 SQL로 실행하지 않는다.

이 사례는 Schema 검사·실행 경계·담당자 검토가 서로 다른 역할이라는 것을 보여준다. [OpenAI Docs의 입력·지시 분리와 실행 제한](https://developers.openai.com/api/docs/guides/agent-builder-safety), [공격성 입력 테스트 안내](https://developers.openai.com/api/docs/guides/safety-best-practices#adversarial-testing)를 참고해 사례를 구성했다.

## 실행과 변경 범위

```powershell
.\mvnw.cmd "-Dtest=AiSuggestionInjectionBoundaryIntegrationTest" test
.\mvnw.cmd test
```

신규 12개는 실패·오류·건너뜀 0개로 통과했다. 테스트의 자격 증명은 합성 Fixture 값이며, 자식 실행 Process에 실제 AI Key·Live 승인 변수를 전달하지 않았다. 로그 전체 대신 Test 집계만 확인했다.

DB 초기화 전에 JDBC 연결이 이 테스트의 격리된 PostgreSQL Container인지 확인했다. 기존 사용자 DB·Container를 삭제하거나 초기화하지 않았다. 운영 Source·Prompt·Migration·정책은 변경하지 않고 테스트와 설명 문서만 추가했다.

추가 후 전체 Java Suite를 다시 실행해 461개, 실패·오류·건너뜀 0개와 `BUILD SUCCESS`를 확인했다. Surefire의 46개 Test Suite XML 집계도 같은 결과였다. 새 테스트와 README 외의 Lab 파일은 변경하지 않았다. 같은 날 앞서 확인한 JavaScript 145개·ESLint 결과와 새 Java 실행은 [전체 회귀 기록](./2026-10-07-final-regression-and-exposure-review.md)에 구분해 남겼다.
