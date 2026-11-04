# 11/4 공식 답변 초안 복구와 미확인 정정의 재확인

> 실행일: 2026-11-04
> 기준: Lab 30fb333 → 화면/Node e2b7482 → Browser/안내 a02c196. 모두 로컬 Commit
> 범위: Conversation Client/Page/HTML과 Test. 기존 Service/Controller/Repository/Schema V12/Session/CSRF 유지
> 상태: Node 399개/Lint와 집중 Browser/PostgreSQL 4개 통과. 전체 회귀/원격 CI/출시 완료와 구분

## 해결한 화면 문제

배정 1에서 시작한 답변 초안은 A→B→A의 배정 3을 조회해도 원래 버전을 유지한다. 자동 최신화를 막는 기존 계약은 유지하되 새 초안을 시작할 방법을 연결했다.

아직 제출하지 않았고 현재 조회한 버전이 다른 초안은 새 POST 전에 막는다. 이미 보낸 답변도 409/ASSIGNMENT_VERSION_CONFLICT가 명확하면 초안 검토를 제공한다. 사용자가 '기존 초안 버리고 현재 배정 다시 조회'를 누르면 본문/정정 선택을 비우고 GET만 한다. 현재 권한/배정을 읽은 뒤 사용자가 빈 Form에서 작성해 제출할 때 새 UUID가 만들어진다. GET 실패로 새 쓰기 권한이 생기지는 않는다.

결과 미확인 답변은 이 초기화를 허용하지 않는다. 원래 UUID/본문/정정 대상/버전을 보존하고 본문/선택을 읽기 전용으로 두어 같은 제출을 재확인한다. 다른 409나 오류 코드 해석 실패도 명확한 버전 거부로 취급하지 않는다. 고객 후속 제출이 미확인인 동안에도 답변 초안 초기화로 그 제출을 없애지 않는다.

일반 대화 재조회는 정정 선택을 유지한다. 재선택했던 공식 답변이 다시 읽은 첫 페이지에 없어도 대상 ID를 지우지 않는다. 실제 정정 대상의 종류/같은 Ticket 여부는 서버에서 검사한다. 초안을 비우는 동작은 DB Message 삭제나 Rollback이 아니다.

대안과 선택 이유는 [기술 계약](../customer-followup-contract-draft.md#10-기술-선택-기록과-확인-범위)과 Lab `docs/ticket-assignment.md`에 기록했다. 새 보관/권한/운영 계정/AI 정책을 추가하지 않았다.

## 실제 Browser와 PostgreSQL

새 Testcontainer와 합성 고객/AGENT, 한 Browser Session과 실제 CSRF를 사용했다. 문의/첫 공식 답변은 기존 Application Service로 준비했고 A→B→A 인계도 같은 Service의 Transaction으로 Commit했다. B의 Browser 인증이나 운영 관리 Endpoint를 새로 검증한 것은 아니다.

| 순서 | 실제 HTTP/화면 | DB 의미 |
|---|---|---|
| 배정 1의 초안 선택 후 배정 3으로 변경 | 원래 답변 POST 409/정확한 버전 충돌 | 새 Message 없음 |
| 일반 재조회 | 원래 본문/정정 선택과 잠긴 초안 유지 | 쓰기 없음 |
| 명시적 초안 초기화 | GET만 실행, 빈 본문/일반 안내 선택 | 쓰기 없음 |
| 새로 작성한 답변 | 다른 UUID/배정 3의 POST 201 | 새 OFFICIAL_REPLY 한 건 |
| 기존 답변의 정정 | 실제 201/Commit 뒤 테스트 중계에서 응답 전달 차단 | 정정 OFFICIAL_REPLY 한 건 추가 |
| 현재 배정 5로 변경 후 대화 GET | 원래 미확인 본문/정정/제출 유지. 초기화 버튼 없음 | 기존 저장 버전 3을 변경하지 않음 |
| 같은 제출 명시적 재확인 | 실제 POST 200/같은 Message ID | 추가 Message 0건 |

네 POST의 서버 상태는 409/201/201/200이었다. 새 답변은 총 두 건이며 둘 다 배정 3으로 저장됐다. 정정은 원래 공식 답변을 참조한다. 원래 문의와 첫 답변의 전체 Row, Ticket의 제목/상태/등록자/서비스, 첫 배정 이력과 Job/Attempt/Suggestion/Category/회원 권한 Snapshot은 유지됐다. 의도한 네 인계로 현재 배정은 5/A, 배정 이력은 총 다섯 건이다. 확인 Row는 0건이며 Provider 상호작용도 0회다.

다음 네 캡처를 직접 확인했다. 경로는 Lab의 ignored 산출물이며 저장소에 올리지 않는다.

- `output/playwright/week12-reply-draft-review-1988891125028659838/rejected-reply-draft.png`
- `output/playwright/week12-reply-draft-review-1988891125028659838/empty-reviewed-reply-draft.png`
- `output/playwright/week12-reply-draft-review-1988891125028659838/unknown-reply-after-reassignment.png`
- `output/playwright/week12-reply-draft-review-1988891125028659838/reply-reconfirmed-without-duplicate.png`

## 실패 재현과 수정

첫 복합 실행에서는 기존 확인 Browser 세 개가 통과했지만 새 답변 실험은 실패했다. 좁은 진단 재실행에서도 실패했고, 단계를 고정 코드로 기록해 정정 선택에서 멈췄음을 확인했다. 성공한 답변의 초안을 비우면서 읽어 온 정정 후보 목록까지 삭제한 것이 원인이었다.

후보 유지 검사를 Node에서 실패로 재현한 뒤 저장 성공 시 현재 선택만 비우도록 수정했다. 명시적 초안 폐기/다른 Ticket 선택은 후보도 비우며, 새 조회가 목록을 다시 구성한다. 고친 뒤 최종 복합 실행 네 개가 모두 통과했다. 최초 실패와 진단 실행을 통과로 바꾸거나 최종 수에 합산하지 않는다.

## 검사와 재현 범위

| 검사 | 결과 |
|---|---|
| Node 전체 | 399개 통과/실패 0. 직전 380개에서 새 19개와 기존 오래된 초안 기대값 한 개 보완 |
| 대화 Client/Page 집중 | 41개. 위 전체에 포함하며 합산하지 않음 |
| ESLint/PowerShell Parser | 통과 |
| 집중 Browser/PostgreSQL | 새 답변 초안과 기존 확인의 응답 유실/권한/재선택, 총 4개. 실패/오류/Skip 0, BUILD SUCCESS |

Lab에서 실행한다.

```powershell
.\mvnw.cmd -B -ntp '-Dtest=ReplyDraftReviewBrowserExperiment,CustomerConfirmationReselectionBrowserExperiment,CustomerConfirmationRecoveryBrowserExperiment,CustomerConfirmationAuthorityBrowserExperiment' test
```

로그는 ignored `target/week12-reply-review-all-node.log`, `target/week12-reply-review-eslint.log`, `target/week12-reply-review-browsers-final.log`다. 기본 `*Test` 실행에 포함되지 않는 명시적 Browser 실험이며 로컬 Docker/Node/PowerShell 7/Chrome이 필요하다. 앞선 전체 Java 1,173+2나 긴 Conversation Browser는 재실행하지 않았다. 전체 회귀의 기존 JVM 종료 지연도 해결한 것으로 보지 않는다.

Source 확인: 공식 답변/배정 계약, 수정한 Client/Page/HTML/Node/실험과 관련 Service/오류 Handler는 VERIFIED다. README는 현재 상태/실행 규칙 등 관련 부분만 PARTIAL로 검토했다. 전체 저장소 감사나 보안/성능/운영 계정 검증은 범위가 아니다. 실제 Key/개인 Browser Session/Cloud/새 CI/Push는 사용하거나 수행하지 않았다.

## 학습과 다음 범위

사용자는 첫 요청이 서버에 도착하지 않은 같은 UUID의 첫 저장을 201/추가 확인 1건으로 답했고, GET의 30번은 다른 UUID의 결과일 수 있어 특정 제출의 저장 증거가 아니라고 답했다. 두 답변을 현재 계약에 맞게 적용한 것으로 [학습 기록](../study-notes/2026-11-04-study-questions.md)에 남겼다. 이 구현과 실행은 Codex가 수행했다.

검증 직후 제시한 답변 초안의 두 문항은 [학습 기록](../study-notes/2026-11-04-study-questions.md)에서 실제 답변을 이어 기록한다. 다음은 새 고객 글/확인/인계의 교차 흐름과 기존 근거 대조, 테스트 JVM 종료 지연, 최종 통합/재현 안내와 회고다. 실제 학습시간/남은 기술 예산은 미기록이다. 상태/재개 API, 운영 계정과 보관/삭제, 일반 문의 AI와 최종 재배포는 기존 후속 조건을 유지한다.
