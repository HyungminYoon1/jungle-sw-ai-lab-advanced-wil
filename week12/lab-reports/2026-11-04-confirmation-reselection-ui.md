# 11/4 배정 버전 충돌 뒤 확인 범위 재선택

> 실행일: 2026-11-04
> 기준: Lab 3b1395a → 구현/검증 30fb333. 로컬 Commit이며 새 원격 CI 결과는 아님
> 범위: 확인 Client/Page/HTML, Node Test와 명시적 Browser 실험. 기존 Service/Schema V12/Session/CSRF 유지
> 상태: Node 380개/Lint와 집중 Browser/PostgreSQL 3개 통과. 일반 Form 복구와 전체 주간 마감은 별도

## 바뀐 화면과 판단 근거

A가 배정 1에서 선택한 확인을 저장하기 전에 A→B→A로 배정 3이 되면, 사람과 대상이 같아도 원래 선택은 오래된 배정의 명령이다. 일반 새로고침이 새 배정을 읽었다고 그 선택의 버전을 바꾸거나 자동 제출하지 않는다.

현재 확인 Service는 활성 서비스 권한을 확인하고 같은 Ticket/작성자/UUID의 저장 기록을 먼저 찾는다. 새 기록의 배정 버전 검사는 그 다음이다. 이 순서와 오류 계약에 맞춰 POST의 409/ASSIGNMENT_VERSION_CONFLICT에만 명시적 재선택을 허용했다. 409 자체, 다른 코드와 읽을 수 없는 Body를 같은 근거로 취급하지 않는다.

충돌 뒤 원래 제출은 보관하되 제출/선택을 잠그고 재선택 버튼을 표시한다. 사용자가 버튼을 누르면 선택을 비운 뒤 현재 상태를 GET한다. 대상은 빈 상태이며 이 버튼만으로 UUID나 POST를 만들지 않는다. 현재 권한/상태를 읽고 사용자가 고객 메시지를 다시 선택해 제출할 때 새 UUID와 현재 배정 버전을 보낸다. 읽기 실패나 권한 없음 상태에서는 새 쓰기를 막는다.

연결 단절, 5xx와 모호한 오류는 원래 UUID/배정 버전/대상을 보존하는 기존 동작을 유지한다. 저장 성공 후 GET만 실패한 경우도 조회만 재시도한다. 초기화는 확인 영역에만 적용하며 공식 답변 등 다른 Form의 초안은 함께 변경하지 않는다.

영향 파일은 Lab의 `customer-confirmation-ui.mjs`, `customer-confirmation-page.mjs`, `conversation.html`과 관련 Test/실험/안내다. 기술 선택의 맥락/대안/이유와 후속 점검은 [기술 계약의 선택 기록](../customer-followup-contract-draft.md#10-기술-선택-기록과-확인-범위)과 Lab `docs/customer-message-confirmations.md`에도 남겼다. 이력 삭제나 새 보관/권한 정책은 추가하지 않았다.

## 실제 Browser와 DB의 비교

새 Testcontainer의 합성 AGENT/고객, 실제 Session/CSRF와 로컬 Spring을 사용했다. Browser가 배정 1의 대상을 고른 뒤 대기하면 Java Fixture가 기존 배정 Application Service를 호출해 A→B→A를 Commit한다. B의 Browser 로그인이나 새 운영 관리 Endpoint를 검증한 것은 아니다.

| 단계 | 실제 관찰 |
|---|---|
| 선택 이후 배정 변경 | 배정 3/A가 됐지만 선택한 버전은 1 |
| 원래 선택 제출 | 실제 HTTP 409/ASSIGNMENT_VERSION_CONFLICT. 확인 저장 없음 |
| 일반 새로고침 | 현재 버전 3 조회. 원래 선택 버전 1 유지, 선택/제출 비활성 |
| 명시적 재선택 버튼 | GET만 실행. 빈 대상과 비활성 제출 버튼 |
| 새 선택을 직접 제출 | 다른 UUID/배정 3, 실제 HTTP 201 |
| 최종 PostgreSQL | 확인 Row 한 건. 의도한 확인자/고객 Message/배정 3과 일치 |

원래 Ticket의 제목/상태/등록자/서비스, Message 본문/작성자/참조, Job/Attempt/Suggestion/Category/회원 권한과 첫 배정 이력은 보존됐다. 실험이 의도한 두 번의 인계 이력과 현재 배정 버전/담당자 변경은 별도로 대조했다. Provider 상호작용은 0회다.

다음 세 캡처를 직접 확인했다. Lab의 ignored 경로이며 원격 저장소에 넣지 않는다.

- `output/playwright/week12-confirmation-reselection-15625269325888640103/rejected-confirmation-selection.png`
- `output/playwright/week12-confirmation-reselection-15625269325888640103/empty-confirmation-reselection.png`
- `output/playwright/week12-confirmation-reselection-15625269325888640103/new-assignment-confirmation.png`

## 실행 결과와 재현

| 검사 | 결과/범위 |
|---|---|
| Node 전체 | 380개 통과/실패 0. 새 14개는 정확한 오류 코드, 모호한 실패의 제출 보존, 초기화 뒤 조회 실패/권한 거부, 늦은 응답과 실제 DOM 제어 포함 |
| ESLint/PowerShell Parser | 통과. 새 실험 Script와 수정한 응답 유실 Script의 구문 확인 |
| 집중 Browser/PostgreSQL | 새 재선택, 기존 응답 유실/GET 복구와 인계/권한 회수의 명시적 실험 3개 통과. 실패/오류/Skip 0, BUILD SUCCESS |
| 결과 미확인 회귀 | 기존 응답 유실 Browser에서도 재선택 버튼이 숨겨진 상태 확인 |

Lab에서 실행한다.

```powershell
.\mvnw.cmd -B -ntp '-Dtest=CustomerConfirmationReselectionBrowserExperiment,CustomerConfirmationRecoveryBrowserExperiment,CustomerConfirmationAuthorityBrowserExperiment' test
```

로그는 ignored `target/week12-reselection-all-node.log`, `target/week12-reselection-eslint.log`, `target/week12-reselection-browsers.log`다. 세 Browser 결과는 앞선 전체 Java 1,173+2와 합산하지 않는다. 이번 변경은 화면/검증 단위라 전체 Java와 긴 Conversation Browser는 재실행하지 않았다. 기존 전체 회귀의 테스트 JVM 종료 지연도 해결했다고 판정하지 않는다.

새 Push/CI/Image/Cloud/일반 문의 AI 실행은 없다. 모든 실험은 격리된 합성 데이터이며 개인 Browser Session과 실제 Key를 사용하지 않았다.

## 학습 기록과 남은 작업

사용자는 새 배정 3에서는 직접 범위를 다시 선택해 새 UUID로 제출하고, 409 버전 충돌 뒤에는 현재 배정을 읽고 사용자가 다시 선택하게 한다고 답했다. 두 답변은 현재 계약에 맞다. 위 코드와 실행은 Codex가 진행했으며 답변만으로 학습자가 독립 구현했다고 기록하지 않는다.

다음에는 같은 제출의 저장 결과와 현재 확인 상태를 구분하고, 공식 답변 Form의 오래된 초안/재조회 안내를 보완한다. 새 고객 글/늦은 확인/인계의 교차 흐름, 테스트 JVM 종료 점검, 최종 통합/주간 회고도 남아 있다. 실제 학습시간과 남은 기술 예산은 미기록이며 이 검증으로 초기화하지 않는다.
