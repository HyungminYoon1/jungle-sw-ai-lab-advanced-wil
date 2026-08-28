# 2026-08-29 — Filter·Interceptor·Exception Handler 최소 복습 기록

> 작성일: 2026-08-29
> 목적: 늦어진 학습 시간을 고려해 공통 요청 처리 경계와 Interceptor Callback 차이만 확인하고, 구현·최종 검증은 8월 30일 복구 일정으로 분리한다.
> 상태: Partially Completed — 오늘 정한 최소 개념 Gate는 통과했지만 Exception 숙련, 새 Terminal 재현과 Week 2 WIL 정리는 남았다.

---

## 오늘의 범위 조정

학습자료를 한 번 읽었지만 개념과 이름이 바로 기억나지 않아 소크라테스식 질문을 이어가기로 했다. 다만 시작 시각이 늦어 다음 축소 순서를 적용했다.

1. CORS Code와 Preflight 실험을 보류한다.
2. Filter·Interceptor는 개념 비교만 남기고 구현하지 않는다.
3. 오늘은 Callback 차이와 세 가지 선택 문제만 확인한다.
4. Exception 추가 복습, 전체 실행 재현과 WIL은 8월 30일로 이동한다.

## Interceptor Callback 점검

Controller가 정상 반환한 경우뿐 아니라 Exception이 발생한 경우까지 포함하여 실행 시간을 측정하려면 종료 시각 계산을 `afterCompletion()`에 두어야 한다고 답했다.

그 이유는 다음과 같다.

- `postHandle()`: Handler가 정상 실행된 경우에만 호출된다.
- `afterCompletion()`: 요청 처리 완료 뒤 호출되므로 성공과 실패 흐름을 함께 관찰하는 데 적합하다.

단, 해당 Interceptor의 `preHandle()`이 정상 완료되고 `true`를 반환해야 `afterCompletion()`이 호출된다. Exception Resolver가 이미 처리한 Exception은 `afterCompletion()`의 `ex` 인수에 나타나지 않을 수 있으므로 오류 판단을 `ex` 하나에만 의존하지 않고 최종 HTTP Status도 함께 관찰해야 한다.

```text
preHandle()
→ 시작 시각을 Request 속성에 저장

afterCompletion()
→ 종료 시각 계산
→ 최종 HTTP Status와 소요 시간 관찰
```

## 세 구성요소 선택 점검

다음 세 문제를 모두 올바르게 구분했다.

| 요구사항 | 선택 | 이유 |
|---|---|---|
| 모든 요청에 Request ID 부여 | Filter | Servlet 수준의 넓은 요청 범위에서 적용 |
| 선택된 Controller Method 이름을 포함한 실행 시간 측정 | Interceptor | Handler 정보를 사용할 수 있음 |
| `TicketNotFoundException`을 `404 ProblemDetail`로 변환 | Exception Handler | Application 실패를 HTTP 오류 계약으로 변환 |

오늘 기억할 기준은 다음 세 문장으로 제한했다.

```text
모든 요청의 바깥쪽 처리 → Filter
선택된 Controller 전후 처리 → Interceptor
Exception을 HTTP 오류로 변환 → Exception Handler
```

## 실행·구현 경계

- Lab Source 변경: 없음
- Filter·Interceptor 구현: `NOT_IMPLEMENTED`
- Filter·Interceptor Test: `NOT_RUN`
- CORS·Preflight: `NOT_RUN` — 주간 축소 순서에 따라 보류
- Java·Maven Version 재확인: `NOT_RUN`
- 전체 29개 Clean Test 재현: `NOT_RUN`
- Application 기동과 실제 HTTP Trace 재현: `NOT_RUN`

8월 27일에 확보한 Test·Trace 근거를 오늘 다시 실행한 것처럼 표현하지 않는다.

## 오늘의 종료 판단

오늘 정한 최소 개념 Gate는 통과했다. 새로운 Production Class를 추가하는 것보다 세 구성요소의 선택 이유를 말할 수 있는 상태를 우선했다.

Exception 이름과 전체 전파 순서는 아직 `Partially Completed`로 유지한다. Week 2 전체 완료 처리도 보류한다.

## 8월 30일 복구 일정

1. 자료를 보지 않고 Filter·Interceptor·Exception Handler 선택 기준을 다시 답한다.
2. Exception 발생·전파·Handler 선택·응답 직렬화를 짧게 복습한다.
3. `TicketApplicationService`, `TicketController`와 `TicketApiExceptionHandler` Source를 다시 추적한다.
4. 새 Terminal에서 Java·Maven Version과 전체 29개 Clean Test를 재현한다.
5. 실제 HTTP Trace는 최종 근거에 공백이 있을 때만 필요한 범위를 다시 실행한다.
6. 8월 28~30일 Study Note와 Week 2 WIL에 완료·부분 완료·미수행 범위를 기록한다.

CORS는 복구 일정의 필수 항목이 아니다. 핵심 Gate와 WIL 정리를 끝낸 뒤 시간이 남을 때만 수행한다.

## AI 활용 경계

- AI 보조: 오늘 범위 축소, Callback 조건 교정과 선택 문제 제시
- 직접 수행: `afterCompletion()` 선택 이유와 세 상황의 구성요소 판단
- 다음 직접 수행: 새 Terminal 실행, Source 재설명과 Week 2 완료 범위 최종 판단
