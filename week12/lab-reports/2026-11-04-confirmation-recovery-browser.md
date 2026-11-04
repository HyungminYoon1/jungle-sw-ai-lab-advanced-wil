# 11/4 확인 응답 유실과 저장 후 조회 실패의 Browser 재현

> 상태: Locally Verified. 명시적 Browser/PostgreSQL 실험 1개 통과
> 기반: Lab 77a117b의 기존 확인 화면. 추가 검증 Commit 86cee1d
> 변경: 테스트 장치/검증 문서만 추가. 운영 코드/Schema/업무 정책은 유지

## 학습 질문과 실제 실패 조건

확인 기록을 저장하는 POST와 현재 상태를 읽는 GET은 서로 다른 요청이다. POST 성공 응답을 정상 수신한 뒤 GET만 실패한 경우와, POST 응답 자체를 받지 못한 경우를 구분한다.

기존 Node Test Double의 근거에 더해 실제 Browser/Session/CSRF → Spring → PostgreSQL을 연결했다. [Playwright의 요청/응답 중계](https://playwright.dev/docs/network#modify-responses)에서 실제 서버 응답을 받은 후 Browser의 fetch에 전달하지 않는 조건을 주입했다. 성공 JSON을 임의로 만들어 DB 저장을 대신하는 방식은 아니다.

첫 실패는 서버가 실제 201을 반환한 뒤 테스트 중계에서 route.abort()를 호출했다. 이 실험에서는 이미 Commit된 경우를 의도적으로 재현했다. 이를 모든 연결 단절이 Commit 이후에 발생한다는 주장이나 DB Commit ACK 장애의 직접 재현으로 확대하지 않는다.

## 진행 순서와 관찰

| 순서 | 서버/Browser 동작 | 확인한 결과 |
|---|---|---|
| 준비 | 새 Testcontainer에 합성 고객/담당자, 최초 문의/후속 글, 담당 배정과 원래 Job 준비 | Testcontainer URL을 확인한 뒤 Fixture 저장. Worker/Provider 비활성 |
| 첫 확인 POST | 서버의 실제 201 후 Browser 전달 차단 | 화면은 저장 여부 미확인. 원래 UUID/배정 버전/대상을 유지하고 대상 변경을 잠금 |
| 현재 상태 GET | 화면에서 명시적으로 새로고침 | 지점은 첫 고객 글로 갱신되지만 해당 제출의 pending은 유지. 특정 UUID의 저장 결과와 현재 지점을 혼동하지 않음 |
| 같은 제출 재확인 POST | 원래 내용/UUID/버전/대상을 재전송 | 실제 서버 200. 첫 두 POST의 JSON이 동일하며 후속 글은 확인 필요로 남음 |
| 새 대상의 확인 POST | 별도 UUID로 후속 글까지 확인 | 실제 서버 201을 Browser에 전달. 다음 현재 상태 GET만 중계에서 차단 |
| GET 복구 | 화면의 상태 새로고침 버튼 사용 | 저장 완료/현재 상태 미조회 안내 후 GET으로 복구. 확인 POST는 총 3회 그대로 |

첫 201은 페이지의 Application이 수신하지 못했고 두 번째 200과 세 번째 201은 정상 수신했다. 따라서 '서버 응답 201/200/201'을 Browser가 세 응답을 모두 받았다는 뜻으로 해석하지 않는다.

## DB와 화면의 대조

실험 종료 후 실제 PostgreSQL에서 확인 Row 두 건을 직접 조회했다. 대상은 최초 문의/후속 글, 배정 버전은 각각 1, 작성자는 실제 합성 담당자 ID였고 제출 UUID는 두 종류였다. 서버의 201/200/201 계약과 이 최종 Row 대조로 같은 제출 재확인에서 중복 Row가 생기지 않은 것을 확인했다. 단계마다 별도 SQL COUNT를 실행한 실험은 아니다.

Ticket/Message/배정 이력/Job/Attempt/Suggestion/분류의 전체 Row Snapshot은 실험 전과 일치했다. 확인을 저장/재확인하거나 상태를 조회해도 기존 문의 원문, 작성자, 담당자, Job 입력/예약과 제안이 바뀌지 않았다. Provider mock 상호작용은 없었다.

실제 화면에서 저장 여부 미확인, 저장 완료/조회 실패, 현재 상태 복구의 세 캡처를 확인했다. 산출물은 ignored `output/playwright/week12-confirmation-recovery-10067190386004999263`의 `unknown-confirmation.png`, `saved-refresh-failed.png`, `recovered-confirmation.png`다. 개인 로그인/Secret/기존 Browser 세션을 사용하지 않았다.

## 실행과 검증 범위

```powershell
# Lab 저장소. Docker, PowerShell 7, Node/npx와 Chrome 필요
.\mvnw.cmd -B -ntp '-Dtest=CustomerConfirmationRecoveryBrowserExperiment' test
```

새 Java 실험과 PowerShell CLI 스크립트만 추가했다. PowerShell 구문 검사, 명시적 실험 1개와 BUILD SUCCESS를 확인했다. 로그는 ignored `target/week12-confirmation-recovery-browser.log`에 있다. Child Process의 환경은 필요한 System 경로와 합성 자격 정보만 전달하며 출력은 Stage/Count/Boolean으로 제한했다.

앞선 Java 1,173+2/Node 366개를 이번에 다시 실행하지 않았고 새 기본 회귀 수에 1을 더하지 않는다. 이 실험은 기본 *Test 명명 범위에 포함되지 않는 선택 실행이다. 앞선 전체 회귀의 fork JVM 종료 문제를 이 집중 실행으로 해결했다고도 하지 않는다. 이 단위의 원격 CI/Push/Cloud/실제 AI 근거는 없다.

## 이해 점검과 다음 작업

사용자는 설계 비교 뒤 이해했다고 말하고 다음 학습을 요청했다. 두 실패 상황에서 다음 요청을 선택하는 문항은 [학습 기록](../study-notes/2026-11-04-study-questions.md)에 분리한다. 테스트 결과를 학습자의 독립적인 판단이나 실행으로 기록하지 않는다.

응답 유실/저장 후 GET 실패의 Browser 근거는 확보했다. 직원 권한 변경의 추가 Browser, 알려진 충돌 뒤 새 선택을 시작하는 안내, 테스트 JVM 종료 지연과 최종 통합/회고는 남아 있다. 실제 학습시간과 남은 기술 예산은 미기록이며 새 시간 예산을 자동 부여하지 않는다.
