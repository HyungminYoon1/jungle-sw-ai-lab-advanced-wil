# 11/4 인계와 서비스 권한 회수 후 확인 재확인

> 상태: Locally Verified. 명시적 Browser/PostgreSQL 실험 1개 통과
> 기반: 기존 확인 UI/Service, 앞선 [응답 유실 실험](./2026-11-04-confirmation-recovery-browser.md)
> 검증 Commit: Lab 3b1395a. 테스트 장치/문서만 추가, 운영 코드/Schema/정책 유지

## 확인한 계약

과거에 저장한 자신의 제출 결과를 읽는 권한과 새 확인을 기록하는 권한을 나눈다. 이미 저장한 기록이라도 현재 서비스 조회 권한은 있어야 한다. 같은 UUID는 명령의 식별자이며 권한을 대신하는 Token이 아니다.

Service의 핵심 순서는 현재 서비스 권한 검사 → 기존 제출 조회/같은 내용 재확인 → 새 기록일 때 현재 담당자/버전/대상 검사다. Controller/Session/CSRF 검사를 생략한다는 뜻은 아니다. 현재 합의한 O5/O6/F11의 계약을 검증하며 보편적인 모든 제품의 정책으로 확대하지 않는다.

## 실제 Browser와 격리된 DB의 순서

| 순서 | 실제 동작 | 서버 결과와 확인 |
|---|---|---|
| A의 첫 확인 | 실제 서버 201을 받은 중계가 Browser 전달 차단 | A/배정 1의 기록이 저장됐지만 페이지는 결과 미확인 |
| B에게 인계 | 같은 A Session에서 기존 인계 API를 호출. 페이지 이동 없이 pending 유지 | 인계 201, 현재 B/배정 2 |
| A가 같은 제출 재확인 | A는 아직 활성 서비스 직원. 원래 UUID/버전/대상으로 UI 버튼 사용 | 확인 200. 배정 1의 과거 결과와 현재 배정 2의 NULL 확인 지점이 나뉘어 표시 |
| A의 새 확인 요청 | 현재 담당자가 아닌 A가 새 UUID로 HTTP POST | 403 NOT_ASSIGNEE. CSRF 누락에 의한 403과 구분 |
| A의 서비스 권한 회수 | Java Fixture가 Testcontainer URL 재확인 후 A의 membership만 비활성화하고 Commit | 짧은 Transaction/lock_timeout 2초. Commit 후에만 Browser 재개 신호 |
| 같은 Session의 과거 제출 재확인 | 테스트가 보관한 원래 제출 복사본을 같은 Browser HTTP로 전송 | 404 SUPPORT_NOT_FOUND. 기존 UUID로 조회 권한을 우회하지 못함 |
| 현재 확인 상태 조회 | 실제 화면의 상태 새로고침 버튼 사용 | 404, 현재 상태 미조회/권한 없음 안내와 확인 버튼 비활성 |

확인 POST의 실제 서버 결과는 201/200/403/404였다. 첫 201은 Application에 전달하지 않았다. 인계 요청은 별도 API의 201이며 이 네 값에 포함하지 않는다. 권한 회수 뒤에도 인증이 필요한 CSRF API는 200이었고 같은 Session을 유지했으므로 로그인 만료를 원인으로 설명하지 않는다.

권한 회수는 공개 관리 API나 운영 DB에서 수행하지 않았다. 별도 Thread/HTTP 디버그 Endpoint 없이 테스트 실행의 File Gate로 Java/Browser의 순서만 맞췄다. 과거 제출 복사본도 테스트가 가로챈 합성 명령의 메모리 값이며 제품에 영속 초안 복구 기능을 추가한 것은 아니다.

## 실제 DB 대조와 범위

권한 회수 전 확인 Row 한 건을 읽고, 거부 응답 뒤 전체 Row가 그대로인지 대조했다. 작성자는 A, 배정 버전 1, 대상은 최초 문의다. B/배정 2의 유효 지점은 NULL/확인 필요를 유지했다. 인계가 A의 확인을 B에게 복사하거나 권한 회수가 이미 Commit된 기록을 지우지 않았다.

원래 Ticket의 제목/상태/등록자/서비스, Message/Job/Attempt/Suggestion/분류, 최초 배정 이력은 실험 전 값과 일치했다. 의도한 인계로 현재 담당자/버전과 배정 이력 한 건이 추가됐고, A membership의 active만 false가 됐다. 다른 membership은 그대로였으며 Provider mock 상호작용은 없었다.

두 화면 캡처를 직접 확인했다. `historical-confirmation-current-handoff.png`는 과거 v1 기록과 현재 v2/확인 없음, `revoked-confirmation-read.png`는 권한 없음/현재 상태 미조회를 표시한다. 이미 수신한 과거 저장 결과는 화면에 남을 수 있다. 대화 자체를 재조회하지 않은 다른 Form의 Capability까지 실시간 동기화하거나 과거에 전달된 데이터를 회수한 실험으로 해석하지 않는다. 서버의 새 쓰기 인가는 매 요청마다 적용된다.

## 실행과 남은 검증

```powershell
.\mvnw.cmd -B -ntp '-Dtest=CustomerConfirmationAuthorityBrowserExperiment' test
```

PowerShell 구문 검사와 명시적 실험 1개, 실패/오류/Skip 0과 BUILD SUCCESS를 확인했다. 기본 *Test 범위 밖의 선택 실행이며 이전 Java 1,173+2/Node 366개를 재실행하거나 개수에 1을 더하지 않는다. 앞선 전체 실행의 fork JVM 종료 문제도 미해결 상태를 유지한다.

로그는 ignored `target/week12-confirmation-authority-browser.log`, 캡처는 `output/playwright/week12-confirmation-authority-15961222231612869480`에 있다. 합성 로그인/Session/CSRF와 독립 PostgreSQL을 사용했으며 실제 운영 계정/권한, Cloud/Secret/외부 AI는 변경하지 않았다. 이번 실험은 회수 Commit 뒤 시작한 요청을 검증하며, 회수 전에 인가된 Transaction이나 이미 전송 중인 응답의 소급 취소를 증명하지 않는다.

사용자는 저장/조회 실패 두 문항과 인계/권한 회수 두 문항에서 해당 계약을 적용한 선택을 했다. [학습 기록](../study-notes/2026-11-04-study-questions.md)에 답변을 남기고 독립 구현/모든 동시성의 이해 완료로 확대하지 않는다. 다음은 알려진 배정 충돌 뒤 새 선택 안내와 오래된 Form의 재조회 안내, 종료 지연/통합/회고다. 실제 학습시간은 미기록이다.
