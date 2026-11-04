# 11/4 새 고객 글과 확인의 교차 흐름

> 실행일: 2026-11-04
> Source: Lab a02c196 → 6348974. 기존 재선택 Browser 실험의 강화와 문서만 변경
> 범위: 로컬 합성 계정/Session/CSRF/PostgreSQL. 운영 코드/Schema V12와 기존 업무 정책 유지
> 결과: 강화한 명시적 Browser 한 개 통과. 이전 Node/전체 Java/다른 Browser 결과와 합산하지 않음

## 이미 있는 근거부터 대조

계획의 '교차 실행'을 새 업무 로직이 없는 상태로 해석하지 않았다. 아래 서버 소스와 [11/3 실제 실행 보고서](./2026-11-03-customer-message-confirmations.md)를 대조했다. 업무 목록의 8개 검증은 [11/4 초기 직원 화면 보고서](./2026-11-04-staff-confirmation-ui.md)에 있다.

| 경계 | 기존 코드/기록 | 이번에 추가한 근거 |
|---|---|---|
| 새 글이 확인보다 먼저 Commit | CustomerMessageConfirmationHttpIntegrationTest의 명시 대상 유지 Case | Browser 선택 → 새 고객 글 Commit → 원래 확인 POST 순서 |
| 확인이 새 글보다 먼저 Commit | 같은 Class의 확인/새 글 Lock 대기 Case. 확인 응답과 다음 조회의 상태 구분 | 소스/기존 보고서 검토. 이번 Browser에서 잠금 경합으로 재실행한 것은 아님 |
| 확인과 인계의 두 Commit 순서 | 같은 Class의 이전 배정 이력 보존/기다리던 옛 담당자 거부 Case | 기존 근거 검토. 강화한 Browser의 A→B→A 설정은 순차 Service 호출 |
| 늦은 작은 확인과 MAX | 같은 Class와 AssignmentQueueConfirmationHttpIntegrationTest의 두 확인 이력/최대 대상 ID | 기존 근거 검토. 이번 실험에 새 작은 확인을 만들지는 않음 |
| 업무 목록의 새 글/배정 범위 | Queue Class의 새 고객 ID/확인 필요, 인계/재배정 목록 Case | 기존 소스/보고서 검토. 이번 Browser에서 업무 목록 UI를 새로 검증한 것은 아님 |

위 서버의 42개와 Queue의 8개는 이전 실행 기록이다. 이번에 그 수를 다시 통과했거나 새 실행 수로 늘렸다고 기록하지 않는다. 서버의 실제 경합 테스트는 `pg_stat_activity`의 Lock 대기를 확인한 뒤 선행 Transaction을 Commit한다. 아래 Browser의 파일 Gate는 다른 종류의 순서 제어다.

## 강화한 Browser 순서

기존 CustomerConfirmationReselectionBrowserExperiment/PowerShell Script에 두 번째 Gate를 추가했다. 합성 AGENT가 배정 1의 대상을 고른 뒤 Fixture에서 A→B→A/배정 3을 Commit하는 원래 흐름은 유지했다. 오래된 확인 409, 명시적 초기화/GET/빈 선택도 계속 검사한다.

1. Browser가 배정 3에서 원래 문의 1번을 새로 선택하고 대기한다.
2. 격리 DB URL을 다시 검증한 Java Fixture가 기존 고객 후속 Service로 글 2번을 Commit한다.
3. Commit 후 전달한 파일 신호를 확인한 Browser가 원래 선택을 POST한다.
4. 실제 201의 확인 대상은 1번이다. 현재 Projection과 후속 GET은 확인 지점 1, 최신 고객 글 2, 확인 필요 true다.
5. 일반 대화 GET으로 2번을 읽어 와도 대상 선택은 빈 상태, 저장 버튼은 비활성이다. 자동 선택/확인은 없다.

확인 POST는 원래 버전 충돌과 새 저장의 두 번, 409/201이고 최종 확인 Row는 배정 3/대상 1/의도한 담당자 한 건이다. 새 고객 Row도 정확히 한 건이며 같은 Ticket/원문/고정 작성자 ID와 CUSTOMER_FOLLOWUP 종류, NULL 정정/답변 버전을 대조했다.

기존 원문 Row 전체와 Ticket의 제목/상태/등록자/서비스, 첫 배정 이력, Job/Attempt/Suggestion/Category/회원 권한 Snapshot은 유지됐다. 두 번의 인계가 현재 배정 3을 만들었으며 새 고객 글과 확인은 문의 상태를 바꾸지 않았다. Provider 상호작용은 0회다.

고객 글은 합성 Fixture의 Application Service 호출이며 고객 Browser 로그인/작성 화면의 새 검증은 아니다. 이 순서는 고객 Commit을 끝낸 뒤 확인 POST를 시작하므로 두 Transaction이 Lock을 두고 겹친다는 주장은 하지 않는다. 테스트 전용 Gate 외에 운영 Endpoint나 정책을 추가하지 않았다.

## 실행과 관찰

```powershell
.\mvnw.cmd -B -ntp '-Dtest=CustomerConfirmationReselectionBrowserExperiment' test
```

강화한 기존 실험 한 개가 실패/오류/Skip 0, BUILD SUCCESS로 통과했다. PowerShell Parser도 통과했다. ignored 로그는 Lab `target/week12-confirmation-late-message-browser.log`다. Node 399개/Lint와 앞의 Browser 네 개는 이전 답변 초안 복구 단위의 결과이며 이번에 재실행하지 않았다. 전체 Java 1,173+2와 기존 JVM 종료 문제도 별개다.

네 캡처 생성은 자동 확인했고 아래 두 후반 화면을 직접 검토했다.

- `output/playwright/week12-confirmation-reselection-7338762114334069799/new-assignment-confirmation.png`
- `output/playwright/week12-confirmation-reselection-7338762114334069799/new-customer-after-selection.png`

Source 확인은 서버 확인/Queue 테스트, 수정한 Java/PowerShell 실험과 위 11/3 보고서를 VERIFIED로 두었다. README는 관련 진행 문단만 PARTIAL로 검토했다. 전체 저장소 감사/운영 부하/실제 고객/원격 CI/Cloud/AI 검증은 범위가 아니다. 파일은 UTF-8 without BOM/LF를 유지하며 실제 AI Key/운영 Secret/개인 Browser Session을 사용하지 않았다.

## 학습과 다음 단계

사용자는 이전 정정 답변 재확인을 추가 Row 0/저장 배정 3으로 답했고, 초안 폐기 뒤 GET 503에서는 담당자/버전/권한부터 다시 확인해야 한다고 답했다. [학습 기록](../study-notes/2026-11-04-study-questions.md)에 실제 답변을 남겼다. 이 테스트 보완과 실행은 Codex가 수행했다.

다음 두 문항은 확인 저장 성공과 새 글의 확인 필요, POST 자료를 읽은 시점과 후속 GET의 시점 차이를 다룬다. [학습 자료 14절](../study-docs/confirmation-checkpoint-and-assignment.md#14-확인-저장-성공과-새-글의-확인-필요는-함께-성립한다)에 설명을 보완했으며 답변은 대기 중이다. 이어서 필요한 통합/재현 안내와 테스트 JVM 종료 점검, 주간/최종 회고를 진행한다. 실제 학습시간/남은 기술 예산은 미기록이고 새로운 정책/재배포 승인으로 확대하지 않는다.
