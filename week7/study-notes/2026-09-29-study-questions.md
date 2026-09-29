# 2026-09-29 — AI 제안의 입력·출력·저장 경계

> 학습 주제: JSON 구조와 내용의 차이, AI Provider 응답의 신뢰 경계, 실패 위치별 Test 근거
> 상태: 개념 학습 진행 중 — 실제 AI Provider 호출·Suggestion 구현·PostgreSQL Test는 아직 하지 않음

## 핵심 질문

1. JSON 문법이 맞는 것, Schema를 통과하는 것, 원문에 충실한 제안인 것은 어떻게 다른가?
2. 사용자 문의 속 지시문과 Server가 AI에게 주는 지시를 왜 구분해야 하는가?
3. AI Provider의 응답은 왜 Spring Security의 인증·CSRF 검사를 새 요청처럼 받지 않으며, 그렇다고 왜 신뢰해서는 안 되는가?
4. `summary`가 문자열·길이 검사를 통과해도 HTML처럼 보일 수 있다. 이를 화면에 표시할 때 무엇을 확인해야 하는가?
5. `Suggestion 0건`이라는 결과만으로 Provider를 호출하지 않았는지 판단할 수 없는 이유는 무엇인가?
6. PostgreSQL Rollback과 브라우저의 응답 수신 실패는 이미 끝난 외부 AI 호출에 어떤 영향을 주는가?

## JSON을 읽는 것과 제안을 받아들이는 것은 다르다

나는 JSON 문법, 제안의 구조와 내용의 충실도를 다음처럼 나누어 정리했다.

```text
AI 응답 문자열
→ JSON 문법 해석
→ 필수 필드·Type·허용값·추가 필드·공백 검사
→ 구조 검증을 통과한 결과만 별도 제안으로 저장할지 판단
→ 원문 충실도는 평가 Dataset·담당자 검토로 따로 확인
```

Browser Console에서 `요약 결과: {"summary":"링크 만료"}`는 `JSON.parse`에 실패했다. 반면 `{"summary":"링크 만료","category":"ACCOUNT","priority":"NORMAL","ticketId":999}`는 JSON으로 해석됐지만 예상하지 않은 필드 `ticketId`가 있었다. 허용 필드 목록으로 검사하자 결과는 `['ticketId']`, 추가 필드 규칙 통과 여부는 `false`였다. JSON 문법 성공만으로 제안 계약을 통과한 것이 아니다.

학습용 Schema에서 `priority`가 필수라면 누락된 결과는 실패하고, 허용값이 `NORMAL`·`HIGH`라면 `URGENT`도 실패한다. 이 값들은 아직 Lab의 확정 계약이 아니다. `ticketId`는 모델이 제안할 필드가 아니라 Server가 조회한 Ticket의 ID로 결정해야 한다.

요약에 공백 한 칸만 있을 때 `minLength: 1`에 해당하는 글자 수 검사는 통과하지만, `trim()` 뒤 비어 있지 않아야 한다는 검사는 실패했다. 반대로 `<strong>긴급</strong>`은 문자열·길이 검사에 *적용되고 통과*한다. 처음에는 이런 문자열에 해당 검사가 적용되지 않는다고 받아들였지만, 정확히는 검사의 범위가 HTML 해석 위험까지 포함하지 않는 것이다. Schema를 통과해도 원문에 없는 사실을 썼다면 내용 평가에서 별도로 다뤄야 한다.

## 요청을 막는 필터와 AI 응답을 검증하는 Code는 역할이 다르다

보호된 Browser 요청은 필요한 Session·Role·CSRF 검사를 거쳐 Controller로 들어온다. Server가 AI Provider를 호출해 받은 응답은 새로운 Browser 요청이 아니므로 인증·CSRF Filter에 다시 들어가지 않는다. 한때 AI 응답도 요청과 같은 경로로 Controller에 들어온다고 생각했다. 하지만 이 응답은 Server가 시작한 외부 호출의 반환값이다.

그렇다고 Provider를 사회적으로 신뢰해서 검사를 생략하는 것은 아니다. 문의 본문에는 Prompt Injection이 들어갈 수 있고 모델 응답도 틀리거나 위험한 문자열일 수 있다. Provider 응답은 JSON·값 계약을 검증하고, AI가 정한 값으로 Ticket ID나 확정 상태를 바꾸지 않아야 한다. 일반 텍스트 요약을 Browser에 표시할 때는 `innerHTML`로 해석하지 않고 `textContent`로 넣는다. 저장 전 검사와 표시 위치에서의 안전한 처리는 서로 다른 경계다.

## 같은 `Suggestion 0건`도 원인이 다르다

현재 Ticket에는 `title`만 있다. `로그인 오류`라는 제목만으로는 문의의 상세 내용을 충실하게 요약할 근거가 부족하다. 나는 새 Ticket에 `description`을 추가하되, 기존 Row에 없던 본문은 `NULL`로 남겨두는 설계에 동의했다. `NOT NULL`을 맞추기 위해 `없음` 같은 문자열이나 제목을 본문으로 채우면 실제 사용자 입력처럼 보인다. AI가 제목에서 만든 글도 원문이 아니므로 기존 `description`에 덮어쓰지 않는다. 새 생성 요청에는 공백이 아닌 본문을 요구하고, 본문 없는 Ticket의 AI 제안 요청은 Provider 호출 전에 멈춘다.

```text
본문 없음                 → Provider 0회 → Suggestion 0건
AI가 공백 요약을 반환      → Provider 1회 → Suggestion 0건
유효 응답 뒤 DB 저장 실패  → Provider 1회 → Suggestion 0건
```

가짜 Provider·Repository를 사용한 Test에서 호출 횟수와 `save()` 호출 여부를 확인하면 이 경로들을 구분할 수 있다. 그러나 가짜 저장소의 `save()` 미호출은 실제 PostgreSQL Row가 없다는 근거가 아니다. 영속 결과는 실제 PostgreSQL Integration Test에서 Row와 기존 Ticket 상태를 조회해야 한다.

PostgreSQL Transaction을 Rollback해도 이미 완료된 AI Provider 호출은 취소되지 않는다. 또 Suggestion Commit은 성공했지만 Server의 최종 HTTP 응답을 Browser가 받지 못할 수 있다. 이때 Browser가 아는 것은 결과를 확인하지 못했다는 사실이지, 저장되지 않았다는 사실이 아니다. 따라서 실패 원인을 구분하지 않고 자동 재시도해서는 안 된다.

## 다음에 확인할 계약과 Test

- 결정한 본문 계약을 Migration·새 생성 입력·기존 Row 조회·AI 미호출 Test로 확인한다.
- Prompt·Schema v1의 필드, 허용값, 공백·추가 필드 규칙을 확정한다.
- 가짜 Provider로 입력 부족·잘못된 출력·실패를 재현하고 호출·저장 경로를 구분한다.
- 실제 PostgreSQL과 Browser에서 저장 결과와 일반 텍스트 표시를 각각 확인한다.

개념을 다시 볼 때는 [AI 제안의 신뢰 경계와 검증 근거](../study-docs/ai-suggestion-trust-boundaries.md)를 참고한다.
