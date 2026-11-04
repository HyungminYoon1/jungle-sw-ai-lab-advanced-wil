# 11/4 직원 업무 목록과 명시적 확인 화면

> 실행일: 2026-11-04
> 상태: 업무 목록/API 집중 검증, JavaScript, 실제 Browser/PostgreSQL과 전체 Java 회귀 통과. 학습 보충은 진행 중
> 선행: [V12 확인 저장/API](./2026-11-03-customer-message-confirmations.md), Lab f325750
> 범위: 로컬 합성 계정과 PostgreSQL. 기존 V12, Session/CSRF와 계층 구조 유지
> 구현 Commit: Lab 7e17319(업무 목록/Capability), 77a117b(선택/재확인 UI와 검증). 로컬 Commit이며 새 원격 CI 근거는 아님

## 오늘 연결하는 흐름

`/assignments.html`의 미배정/내 담당 목록에서 최신 고객 메시지와 현재 배정의 확인 지점을 읽고, 대화 화면으로 이동한다. 담당자는 읽어 온 고객 메시지를 직접 선택해 '여기까지 확인'을 기록한다. 목록/대화 조회는 확인 이력을 만들지 않으며, 확인 저장이 공식 답변이나 Ticket 해결을 대신하지 않는다.

11/3에 구현한 API를 다시 만들거나 Schema를 변경하지 않았다. 업무 목록의 Query/응답, 직원용 읽기 Capability와 확인 화면을 연결한다. 고객의 소유권만으로 직원의 확인 정보를 공개하지 않는다.

## Query와 권한

Lab 7e17319의 업무 목록은 기존 UNASSIGNED/MINE, ID 오름차순, limit+1을 유지한다. RESOLVED도 제외하지 않는다. 각 항목에 다음 다섯 필드를 추가했다.

| 필드 | 근거 |
|---|---|
| latestCustomerMessageId | 같은 Ticket의 INQUIRY/CUSTOMER_FOLLOWUP 중 가장 큰 ID |
| latestCustomerMessageAt | 그 Message의 created_at. 가장 큰 시각이나 마지막 공식 답변의 시각과 다름 |
| effectiveThroughMessageId | 현재 배정 버전의 MAX(through_message_id). 없으면 NULL |
| needsConfirmation | 최신 고객 글이 있고 현재 확인 지점이 없거나 그보다 작은 경우 |
| canConfirm | 내 담당 목록의 현재 담당자이며 고객 Message가 존재하는 경우 |

JDBC는 페이지 크기만큼 Ticket을 먼저 선택하고 한 SQL의 Snapshot에서 배정/최신 고객 글/확인 범위를 함께 투영한다. Application은 표시할 Boolean을 결정하고 Controller는 HTTP 응답만 만든다. 기존 Index를 사용하도록 구성했으며 새 Index나 속도 향상 수치를 주장하지 않는다.

대화 Capability의 canViewConfirmations는 기존 활성 서비스 직원 검사 결과다. 고객 전용 화면은 직원 확인 API를 호출하지 않는다. 직원 권한을 잃었더라도 본인 문의를 고객 자격으로 보는 경우에는 false다. Capability는 UI 안내이며 실제 확인 GET/POST의 서버 인가를 대체하지 않는다.

## 화면에서 지키는 경계

- 확인 대상은 화면에 읽어 온 고객 Message 중에서 직접 선택한다. 공식 답변은 선택지에 넣지 않고 최신 고객 글을 자동 선택하지 않는다.
- 선택 당시 배정 버전을 고정한다. 조회가 새 버전을 반환해도 기존 선택이나 결과 미확인 제출의 버전을 조용히 바꾸지 않는다.
- 결과 미확인 시 같은 UUID/배정 버전/대상으로 명시적으로 재확인한다. 새 UUID의 자동 재전송은 하지 않는다.
- 저장한 이력과 현재 확인 상태를 구분한다. POST 성공 뒤 현재 상태는 GET으로 다시 읽으며, 이 조회만 실패하면 GET만 재시도한다.
- Ticket 변경/조회 순번으로 늦은 응답을 무시하고 pagehide에서 메모리의 선택/제출/표시를 정리한다. 화면에서 무시한 응답이 이미 Commit된 기록을 취소하지는 않는다.

화면의 textContent 표시, no-store, 같은 Origin의 Session/CSRF는 유지한다. 답변/고객 후속 작성의 제출과 별도로 명시적 확인 제출을 관리한다.

## 실행 근거

| 검사 | 현재 결과 |
|---|---|
| 업무 목록 HTTP/PostgreSQL 8개 | 통과. 읽기 무변경, 최신 고객 ID/시각, MAX, 인계/재배정, RESOLVED/페이지, 역할/권한 회수와 Capability |
| 기존 배정/대화/후속 집중 75개 | 통과. 위 8개와 합쳐 83개이며 전체 회귀와 합산하지 않음 |
| JavaScript 전체 | 366개 통과. 선택 고정, 늦은 응답, 저장/조회 실패, 같은 제출과 직원/고객 표시 경계 포함 |
| ESLint | 통과 |
| 실제 Browser/PostgreSQL | 명시적 실험 1개 통과. 메시지 6건/배정 이력 4건/확인 2건과 실제 Session/CSRF 대조 |
| 전체 Java | Surefire 1,173개/Failsafe 2개, 실패/오류/Skip 0, BUILD SUCCESS. 집중 83개는 전체에 포함, 명시적 Browser 1개는 별도 |

로그는 Lab의 ignored `target/week12-staff-queue-focused.log`, `week12-staff-all-node.log`, `week12-staff-eslint.log`에 있다. 테스트용 PostgreSQL URL이 맞는지 확인한 뒤 합성 Fixture만 초기화했다. Provider/Worker는 비활성이다.

첫 Browser 시도는 마지막 인계 후 화면까지 캡처했지만 Child Process의 6분 완료 제한에 걸려 실패했다. 이 시도만으로 DB 대조/통과를 주장하지 않는다. UI/DB Assertion은 그대로 두고 실험의 완료 제한만 8분으로 늘린 재검증이 통과했다. Suite 실행 시간은 386.2초이며 이 수치는 접수 HTTP/Job 처리시간이나 실제 학습시간이 아니다. 검사기/Job의 기한 설정도 변경하지 않았다.

실제 Browser는 직원 업무 목록의 확인 필요 표시/대화 링크, 빈 초기 선택, 공식 답변을 제외한 고객 대상 두 개, CSRF 누락의 403을 확인했다. 합성 사례의 배정 v3에서는 첫 문의 #1만 선택해 확인하고 후속 글 #6을 확인 필요로 남겼다. B에게 인계한 v4에서는 현재 확인 지점이 NULL인 화면을 확인한 다음 B가 #6까지 명시적으로 기록했다. 처음 담당자의 기록을 B에게 복사하지 않았다.

Java는 실제 PostgreSQL에서 두 확인 Row의 배정 버전 3/4, 대상 ID와 확인자 ID를 대조했다. 기존 문의/후속 본문과 작성자, 공식 답변의 배정 버전 1/1/2/3, Ticket OPEN, 기존 PENDING Job 한 건, 예약/Attempt/Suggestion 0건도 확인했다. Provider mock 상호작용은 없었다. 직원 확인 상태는 고객 화면에 숨겨졌고 입력한 HTML 형태의 합성 본문은 텍스트로만 표시됐다.

최종 캡처 `conversation-confirmation.png`와 `conversation-confirmation-handoff.png`를 직접 확인했다. 산출물은 Lab ignored 경로 `output/playwright/week10-conversation-11844117093680501753`에 있다. 이 실제 UI/DB 검증과 Node의 응답 유실/늦은 응답 Test Double은 서로 다른 근거다.

전체 회귀에서는 기존과 같이 `[ERROR] Surefire is going to kill self fork JVM. The exit has elapsed 30 seconds after System.exit(0).`가 한 번 남았다. Test 실패/오류 0과 빌드 성공은 확인했지만 테스트 JVM 종료 문제는 해결하지 않았다. 앞의 Browser Child Process 제한 보완과 별개로 후속 점검한다. 전체 로그는 ignored `target/week12-staff-full-verify.log`이며, 이전 11/3 결과와 합산하지 않는다.

## 학습과 후속

오늘의 핵심 질문은 인계 후 새 담당자의 확인 범위와, 30번을 선택한 뒤 31번이 도착했을 때의 처리다. 사용자는 첫 질문에 'B도 30번까지 확인', 둘째에는 '잘 모르겠습니다.'라고 답했다. 변형 질문에는 설계 차이라면 개념/대안과 선택 이유를 먼저 설명하라고 요청했고, 12/13 범위에는 아직 모르겠다고 답했다. [실제 문답](../study-notes/2026-11-04-study-questions.md)과 [확인 지점 학습 자료](../study-docs/confirmation-checkpoint-and-assignment.md)에 팀 공통/사람별/배정별 대안과 현재 F11의 추천 이유를 보완했다. 배정별 초기화는 보편적인 프레임워크 규칙이 아니며, 현재 합의한 설계의 동작이다. 구현/Test 통과로 이해 완료를 대신하지 않는다.

실제 학습시간/남은 기술 예산은 미기록이다. 이 초기 보고서 시점에는 권한 회수/조회 실패/응답 유실의 추가 Browser 검증, 테스트 JVM 종료 지연, 최종 통합/회고를 다음 단위로 남겼다. 상태 변경/재개 정책과 운영 계정/보관/일반 문의 AI는 이 기능으로 확정하지 않는다.

이 초기 검증 시점의 확인 화면은 POST 거부/충돌에서도 보수적으로 원래 제출을 유지했다. 이후 [재선택 UI 검증](./2026-11-04-confirmation-reselection-ui.md)에서 정확한 배정 버전 충돌에만 명시적 초기화/GET/새 선택을 추가했다. 응답 유실과 권한 변경도 각각 후속 Browser 보고서로 검증했다. 초기 결과와 이후 결과를 합산하거나 초기 구현에 소급하지 않는다.
