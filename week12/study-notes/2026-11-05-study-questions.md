# 11/5 실패 복구, 테스트 자원 수명과 확인 기록

> 날짜: 2026-11-05 목요일
> 상태: 11/5 학습 범위 완료. 실패 복구와 테스트 자원 수명, 11/6에서 옮긴 확인과 배정 사례의 코드 대조 및 문답을 마쳤다.
> 코드 기준: Lab fe9336d. 두 작업 트리는 시작 시 Clean

## 오늘의 범위

1. 공식 답변, 명시적 확인과 상태 변경에서 실패가 어느 요청 단계에 발생했는지 대조했다.
2. 클래스별 PostgreSQL과 Spring Context, DB 연결 Pool 및 Thread의 수명을 실제 검사 코드로 살펴봤다.
3. 11/6에서 옮긴 새 고객 글, 늦은 확인, 인계와 재배정 사례의 저장 순서와 현재 상태를 대조했다.

11/4에 Lab `fe9336d`의 원격 CI가 통과했다. 11/5 학습에는 그 실행 결과와 기존 Browser 및 로컬 PostgreSQL 기록을 사용했다. WIL과 12주 회고는 11/9에 작성한다. 실제 사용 시간은 미기록이다. [11/4 최종 검토 기록](../lab-reports/2026-11-04-final-review-publication.md)

## 첫 묶음: 실패한 단계를 먼저 찾기

새 제출의 화면 처리 순서는 대략 다음과 같다. 서버의 업무 저장은 POST를 받은 뒤 별도 Service/Transaction에서 수행한다.

```text
CSRF 정보 GET
  -> 원래 제출 UUID/내용 준비
  -> 저장 POST
  -> HTTP 상태와 응답 본문 검증
  -> 저장 결과 표시
  -> 현재 상태/대화 GET
```

명시적 확인 UI는 200/201인지뿐 아니라 응답의 확인 대상과 배정 버전이 원래 제출과 맞는지도 검사한다. 응답 본문 파싱이나 이 검사가 실패하면 원래 pending을 지우지 않고 unknown-outcome으로 남긴다. 검증을 통과한 뒤에만 pending을 비우고 현재 상태를 GET한다. 이 화면 표시는 서버의 Commit을 취소하는 동작이 아니다.

상태 변경 UI도 validChange를 검사한 뒤 saved를 보존한다. 공식 답변 UI는 메시지 종류/본문/정정 대상을 대조한다. 따라서 201을 받았지만 본문을 읽지 못한 경우와 저장 응답 전체를 검증한 뒤 GET만 실패한 경우는 복구 단계가 다르다. 새 제출의 CSRF GET 실패로 저장 POST 자체를 보내지 않은 경우도 구분한다. 이전 미확인 제출이 이미 있는 경우까지 '저장한 적 없음'으로 일반화하지 않는다.

| 문항 | 사용자 답변 | 현재 상태 |
|---|---|---|
| 새 확인 POST의 201을 받았지만 본문이 깨져 파싱하지 못했다. 새 UUID로 다시 저장해도 되는가? 원래 제출은 어떻게 처리하는가? | '아니요. 원래 UUID와 제출 내용을 유지해서 저장 결과를 재확인해야 합니다.' | 원래 제출 보존/재확인을 정확히 구분 |
| 이전 미확인 제출이 없는 새 답변 시도다. CSRF GET이 503으로 실패했고 저장 POST는 전송하지 않았다. 이번 시도가 새 답변 Row를 만들었다고 볼 수 있는가? | '아니요. 저장 POST를 보내지 않았으므로 이번 시도로 새 답변 Row가 생성되지는 않습니다.' | 이번 시도의 저장 요청 전 실패를 정확히 구분 |

첫 문답 두 건의 답변을 확인했다. 일반적인 다른 실패나 이전 미확인 제출의 저장 여부까지 판정한 것으로 확대하지 않는다.

## 다음 묶음: 자원 수명을 읽기

[기존 자원 수명 자료](../study-docs/test-jvm-resource-lifecycle.md)를 실제 ClassOwnedContextCleanupVerifier와 연결한다. Spring의 테스트 Context는 캐시로 클래스 이후에도 남을 수 있고, AFTER_CLASS의 DirtiesContext는 클래스가 끝날 때 Context를 캐시에서 제거하고 닫게 한다. 클래스별 독립 DB를 사용하는 이번 Fixture에서 선택한 정리 방식이며 모든 테스트에 붙이는 보편 규칙으로 일반화하지 않는다.

대표 세 클래스의 검사는 캡처해 둔 Context가 비활성인지, HikariDataSource가 닫혔는지, 해당 Pool 이름의 살아 있는 관리 Thread가 0인지 각각 확인한다. 이 검사는 모든 OS 프로세스/DB 자원의 종료나 운영 ECS Task의 SIGTERM 처리를 증명하지 않는다. 업무 데이터 검증, 클래스별 자원 검사와 테스트 JVM 종료 관찰을 별도 근거로 읽는다.

[보완한 실제 코드 설명](../study-docs/test-jvm-resource-lifecycle.md#실제-코드에서-객체와-시점을-연결하기)에서 다음을 순서대로 연결한다. Spring Context는 테스트 JVM 안에서 Service/Repository/DataSource 등의 객체를 관리한다. 이번 설정은 같은 클래스의 메서드 사이에서는 Context를 재사용하고 클래스 종료 시 정리한다. Verifier는 미리 저장한 실제 Context/Pool 참조를 검사하며 새 객체를 만들어 이전 자원의 정리를 추정하지 않는다.

| 두 번째 묶음 | 사용자 답변 | 현재 상태 |
|---|---|---|
| AFTER_CLASS 설정만 있는 같은 클래스의 테스트 A/B에서 A 직후 Context를 닫고 B에서 새로 만들어야 하는가? | 답변 대신 개념의 자세한 설명을 요청 | 미평가. 기초 설명 뒤 다시 확인 |
| Pool의 isClosed는 true지만 최대 2초 대기 후에도 해당 Pool의 관리 Thread가 한 개 남았다. 현재 자원 검사 전체를 통과시켜야 하는가? | 답변 대신 개념의 자세한 설명을 요청 | 미평가. 기초 설명 뒤 다시 확인 |

사용자는 '무슨 말인지 이해하지 못했습니다. 필요시 학습 자료를 생성하고 저에게 해당 개념에 대해 자세하게 설명해주세요'라고 요청했다. 이를 두 문항의 오답으로 기록하지 않는다. 테스트 클래스/메서드와 JVM부터 시작해 Context의 객체 관리, Pool의 연결 재사용, 클래스 종료 시점과 Thread를 순서대로 설명하는 [기초자료](../study-docs/spring-test-resources-basics.md)를 추가했다.

기초 설명 뒤에는 같은 Pool을 계속 쓸 때의 종료 시점과 Pool 종료/Commit된 Row의 차이부터 확인했다. 이어서 실제 종료 상태와 검사 대상을 다뤘다.

### 기초 설명 뒤 받은 답변

| 문항 | 사용자 답변 | 확인한 이해 |
|---|---|---|
| 검사 B도 같은 Pool을 사용할 예정일 때 A 직후 Pool 전체를 닫는 것이 적절한가? | '아니요. Pool을 재사용해야 합니다.' | 남은 검사에서 사용할 자원을 유지해야 함을 구분 |
| Pool 전체를 닫으면 이미 Commit된 Ticket Row도 삭제되는가? | '아니요. Pool은 Repository의 객체를 DB에 연결하기 위한 객체입니다. 그것을 제거한다고 이미 DB에 커밋된 데이터가 삭제되지는 않습니다.' | 연결 관리 자원과 DB에 저장된 데이터를 구분 |

두 답변은 핵심 방향이 맞다. Pool은 Repository가 사용할 DB 연결을 빌려주고 반납받아 재사용하도록 관리한다고 용어를 보충한다. Pool의 종료와 객체 메모리의 즉시 제거를 같은 뜻으로 확정하지 않는다. 상세 Thread 검사나 운영 종료를 이해/검증한 것으로 확대하지 않는다.

### 종료 상태와 실제 검사 대상

다음 설명은 [기초자료 7절](../study-docs/spring-test-resources-basics.md#7-isclosed가-true인데-왜-별도-검사를-하나)과 실제 Verifier를 연결한다. HikariDataSource의 종료 상태와 식별한 관리 Thread 수를 따로 읽는다. 또한 테스트에 사용한 Pool A와 새로 만든 Pool B는 서로 다른 객체이므로 B의 종료만으로 A의 정리를 증명할 수 없다. 이 때문에 Verifier는 사용하던 객체의 참조를 미리 보관한다.

| 다음 문항 | 사용자 답변 | 현재 상태 |
|---|---|---|
| Context는 비활성, Pool의 isClosed는 true지만 2초 대기 뒤 해당 Pool의 관리 Thread가 한 개 남았다. 전체 자원 검사를 통과시켜도 되는가? | '아니요. 해당 Pool의 관리 Thread가 남아 있으므로 자원 정리가 완료되지 않았습니다.' | 이번 검사의 Thread 수 조건과 전체 정리를 구분 |
| 테스트에 Pool A를 사용했다. 새 Pool B를 만들어 닫고 B의 종료를 확인하면 A의 자원 정리도 증명되는가? | '아니요. 테스트에서 실제 사용한 Pool A의 종료를 확인해야 합니다.' | 실제 사용한 객체를 검사해야 함을 구분 |

두 답변은 맞다. 새 Test 실행이나 모든 JVM/운영 자원의 정리 검증을 수행했다는 뜻은 아니다.

### Thread의 역할과 재사용에 대한 추가 질문

사용자는 여기서 지칭하는 Thread가 무엇이며 왜 정리하는지, Pool처럼 재사용하면 안 되는 것인지 질문했다. 이를 재사용 불가에 대한 확정된 오해나 정책 선택으로 기록하지 않는다.

[기초자료 6절](../study-docs/spring-test-resources-basics.md#6-thread는-왜-나오는가)에 프로세스 안의 실행 흐름, Hikari 관리 Thread와 Thread Pool을 보충했다. 사용 기간 동안의 Thread 재사용과 자원 사용이 끝난 뒤의 실행기 종료를 구분한다. 종료된 Thread를 다시 start하는 것과 살아 있는 Thread가 여러 작업을 실행하는 것도 구분한다.

Java 25 공식 Thread/ThreadPoolExecutor 문서와 Hikari 7.0.2의 실행기 생성/종료 및 외부 실행기 소유권 분기를 대조했다. 테스트 Fixture를 공유 실행기 구조로 변경하거나 Thread를 강제 종료하는 코드는 추가하지 않았다.

| 적용 문항 | 사용자 답변 | 현재 상태 |
|---|---|---|
| 같은 Context/Pool로 다음 테스트도 수행한다. 직전 테스트가 끝났다는 이유로 해당 Pool의 관리 Thread를 종료해야 하는가? | '아니요. 다음 테스트도 같은 Pool을 사용하므로 관리 Thread도 유지해야 합니다.' | 사용 중인 Pool/관리 Thread의 재사용을 구분 |
| 클래스가 끝나 독립 Pool A의 사용을 마쳤다. A의 관리 작업/Thread를 그대로 남겨두면 새 Pool B에 자동으로 재사용되는가? | '아니요. Pool A의 관리 Thread가 새 Pool B에 자동으로 재사용되지는 않습니다.' | 독립 자원의 수명과 자동 재사용 불가를 구분 |

사용 기간 동안의 재사용과 기간 종료 뒤 정리를 두 문항에 적용했다. 이어 실제 검사 코드가 세는 Thread와 운영 종료에 필요한 근거를 확인했다. [실제 검사의 범위](../study-docs/test-jvm-resource-lifecycle.md#실제-검사-코드가-확인하는-범위)

### 자원 수명 학습의 마지막 적용

Verifier는 Context/Pool 참조를 확인하고, 해당 Pool 이름과 콜론으로 시작하는 살아 있는 관리 Thread를 센다. 다른 Pool의 Thread를 강제 종료하거나 이 검사 하나로 운영 App의 종료를 판정하지 않는다. 이 설명은 기존 코드의 대조이며 새 Test 실행은 아니다.

11/4의 [기존 CI 41839824046](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/actions/runs/41839824046) Log에서 대표 세 클래스의 TEST_CLASS_CONTEXT_CLEANUP 표시를 선택해 확인했다. 세 표시 모두 contextInactive/dataSourceClosed가 true, poolThreads가 0이었다. Lab의 ignored target/publication-20261104/ci-41839824046.log에서 해당 형식만 추출했으며 전체 Log를 새로 감사하거나 CI/테스트를 재실행한 것은 아니다. 이를 운영 App 종료의 관찰로 해석하지 않는다.

| 마지막 적용 문항 | 사용자 답변 | 현재 상태 |
|---|---|---|
| Pool A의 Context/Pool은 닫혔고 A의 관리 Thread는 0개다. 계속 사용 중인 Pool B의 관리 Thread가 남아 있다면 A의 검사를 실패시키거나 B를 강제 종료해야 하는가? | '아니요. Pool A의 정리는 완료됐고, 사용 중인 Pool B의 Thread는 유지해야 합니다.' | 검사 대상과 계속 사용하는 자원의 범위를 구분 |
| 이 로컬 테스트의 자원 검사가 통과하면 운영 App이 SIGTERM을 받았을 때의 종료까지 검증했다고 기록해도 되는가? | '아니요. 운영 App의 SIGTERM 종료는 별도로 검증해야 합니다.' | 로컬 검사와 운영 종료의 검증 범위를 구분 |

두 답변을 확인하여 11/5에 계획한 실패 복구와 자원 수명 학습을 마쳤다. 이어서 11/6에 예정했던 현재 배정과 조회 시점의 사례를 살펴봤다.

### 현재 배정과 확인 지점을 함께 읽기

JdbcCustomerMessageConfirmationRepository의 current는 Ticket의 담당자와 배정 버전, 그 배정의 최대 확인 대상과 최신 고객 Message ID를 한 SELECT에서 읽는다. CustomerMessageConfirmationService는 그 결과로 확인 필요 여부와 호출자의 새 확인 가능 여부를 계산한다. Read Committed에서 이 SELECT는 문장이 시작할 때의 스냅샷을 사용한다. [PostgreSQL 17의 Read Committed 설명](https://www.postgresql.org/docs/17/transaction-iso.html#XACT-READ-COMMITTED)

기존 통합 테스트에서는 A/배정 1의 확인을 저장한 다음 조회 서비스가 실제 current SQL을 실행하기 직전에 대기시킨다. 그 사이 B/배정 2로 인계를 Commit하고 조회를 진행한다. 검사하는 값은 배정 버전 2, 유효 확인 지점 NULL, A의 canConfirm false다. 기존 [11/4 확인 교차 흐름 보고서](../lab-reports/2026-11-04-confirmation-cross-flow.md)와 구분하여 이번 설명에 쓰인 소스 및 가상 예시를 [학습 자료 15절](../study-docs/confirmation-checkpoint-and-assignment.md#15-배정과-확인-지점이-같은-시점의-값이어야-하는-이유)에 연결했다.

| 선행 학습 문항 | 사용자 답변 | 현재 상태 |
|---|---|---|
| A는 배정 1에서 80번까지 확인했다. 현재 B는 배정 2에서 71번까지 확인했고 최신 고객 글은 81번이다. 같은 서비스에서 조회 권한을 유지한 A가 읽으면 유효 확인 지점과 A의 canConfirm은 무엇인가? | '유효한 최종 확인 지점은 71번이고, A는 현재 담당자가 아니므로 `canConfirm`은 false입니다.' | 현재 배정의 확인 지점과 호출자의 확인 가능 여부를 정확히 구분 |
| 그 SELECT가 시작된 뒤 B가 81번까지 확인하고 Commit했다. 진행 중이던 조회와 그 Commit 이후 시작한 다음 조회의 needsConfirmation은 각각 무엇인가? | 'B가 진행 중이던 조회(71번 이후 번호)의 `needsConfirmation`은 true이고, Commit 뒤 시작한 다음 조회(81번 이후 번호의 조회)의 `needsConfirmation`은 false일 것 같습니다.' | true와 false가 맞다. 두 조회의 호출자는 A이며 B는 확인을 저장한다. 두 조회가 비교하는 최신 고객 글은 81번이고 확인 지점이 71에서 81로 바뀐다. |

두 GET은 같은 문의의 확인 상태를 읽는다. 답변에 적은 메시지 번호는 페이지의 시작점이 아니라 각 SELECT에 보이는 유효 확인 지점이다.

### 두 저장이 실제로 겹쳤다는 근거

새 글을 INSERT한 트랜잭션을 열어 둔 채 확인을 시작하는 기존 통합 테스트를 읽었다. 테스트는 격리 DB의 pg_stat_activity에서 다른 세션의 Lock 대기를 관찰한 뒤 첫 트랜잭션이 Commit되도록 대기를 푼다. Browser 검사는 새 글의 Commit 신호를 받은 뒤 원래 대상을 POST해 저장 결과와 화면을 확인한다. [학습 자료 16절](../study-docs/confirmation-checkpoint-and-assignment.md#16-두-저장이-실제로-겹쳤다는-근거)

| 적용 문항 | 사용자 답변 | 현재 상태 |
|---|---|---|
| 고객 글 INSERT 후 첫 트랜잭션을 열어 뒀다. 뒤의 확인 작업이 아직 완료되지 않았다는 사실만으로 DB 잠금 대기를 판단할 수 있는가? 무엇을 관찰해야 하는가? | '무슨 말인지 이해하지 못했습니다. 트랜잭션을 열어 두더라도 DB잠금은 꼭 필요한 경우 row 단위로만 제한적으로 해야 하는 것이 아닌가요?' | 코드에서 두 저장이 같은 Ticket 행을 잠그는 이유와 테스트의 대기 관찰을 설명 |
| Browser가 1번을 선택한 뒤 2번 글의 Commit 신호를 받았고, 그제야 1번을 POST하여 201과 확인 지점 1, 확인 필요 true를 받았다. 무엇이 검증됐으며, DB 잠금 대기까지 관찰한 흐름인가? | 201을 2번 글 저장의 응답으로 이해했고 `needsConfirmation=true`를 새 2번 글의 확인 필요로 해석했다. '1번 확인을 제출'하는 의미를 질문했다. | 2번의 확인 필요 의미는 맞다. 이 201의 요청은 1번까지 확인한 이력을 만드는 POST다. |

### 11/6 세미나 반영과 확인 요청 보충

사용자가 11/6 세미나 일정으로 그날의 학습을 11/5에 진행해 달라고 요청했다. 새 고객 글, 늦은 확인, 인계와 재배정의 범위와 계획 배분 60분을 11/5에 합쳤다. 11/5는 계획 120분, 11/6은 세미나 일정 0분이며 주간 총 360분으로 계산한다. 실제 사용 시간은 미기록이다. [주간 계획](../weekly-plan.md)

후속 글과 확인은 `access.ticket(ticketId, true)`를 통해 같은 `tickets` 행을 `FOR UPDATE`로 잠근다. 테스트는 첫 작업이 그 잠금을 보유한 동안 후속 작업을 시작한 뒤 PostgreSQL의 `wait_event_type = 'Lock'`을 관찰한다. Browser에서는 먼저 고객 글 2번을 Commit하고 그 다음에 `throughMessageId=1`인 확인 POST를 보낸다. 이 응답의 201은 확인 이력 생성이고 `needsConfirmation=true`는 최신 글 2가 확인 지점 1보다 뒤에 있다는 뜻이다. [학습 자료 17절](../study-docs/confirmation-checkpoint-and-assignment.md#17-같은-ticket-행을-잠그고-두-종류의-기록을-저장하기)

이동한 범위의 기존 검증으로 두 Commit 순서, 작은 확인의 늦은 저장과 배정별 MAX, 이전 담당자의 대기 뒤 거부와 A→B→A 재배정을 대조했다. 인계 충돌 뒤 다시 선택하는 화면과 선택 이후 새 고객 글이 저장된 화면은 11/4 Browser 결과에 연결한다. [11/4 확인 교차 흐름 보고서](../lab-reports/2026-11-04-confirmation-cross-flow.md)

| 적용 문항 | 사용자 답변 | 현재 상태 |
|---|---|---|
| Ticket 10의 글 저장이 `tickets.id=10`을 잠근 동안 Ticket 20의 확인 저장은 그 행 잠금 때문에 기다려야 하는가? | '아니요. Ticket 20은 별도의 행을 잠그므로 Ticket 10의 행 잠금 때문에 기다릴 필요는 없습니다.' | 특정 Ticket 행 잠금의 범위를 정확히 설명 |
| 같은 배정에서 2번까지의 확인이 Commit된 뒤 별도 UUID로 1번까지의 확인도 201을 받았다. 추가되는 행의 종류와 현재 유효 확인 지점은 무엇인가? | '1번까지 확인했다는 이력이 한 건 추가되고, 같은 배정에서 가장 큰 확인 대상은 2번이므로 유효 확인 지점은 2번입니다.' | 확인 POST가 만든 이력과 배정별 MAX를 정확히 구분 |

이 문답으로 11/5에 배정한 학습과 세미나 때문에 옮긴 범위를 마쳤다. 사용자의 마감 요청에 따라 이날 학습을 종료했다. 남은 계획은 11/7 최종 검증 근거 대조 60분, 11/8 실행 안내와 설계 설명 30분, 11/9 WIL과 회고 등 마감 자료 정리 45분이다. 합계 135분은 계획 배분이다. [날짜별 학습 및 구현 계획](../weekly-plan.md#날짜별-학습-및-구현)

공식 근거는 [Spring Context 캐시](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/caching.html)와 [DirtiesContext](https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-dirtiescontext.html)다. 11/5 열람한 참조 페이지는 Framework 7.0.10을 표시하며 프로젝트 의존성을 변경한 것이 아니다.

## 소스 대조와 검증 범위

| 소스 | 확인 범위 | 판정 |
|---|---|---|
| 주간 계획, 기존 테스트 자원 수명 자료/계약 | 현재 일정과 자원 정리 설명 | VERIFIED |
| Lab conversation-ui.mjs/customer-confirmation-ui.mjs/ticket-status-ui.mjs | 전체 파일의 저장/응답 검증/재확인/현재 조회 분기 | VERIFIED |
| Lab ClassOwnedContextCleanupVerifier.java | 전체 파일의 참조 캡처/클래스 종료 후 실제 자원 검사 | VERIFIED |
| Lab CustomerMessageConfirmationHttpIntegrationTest.java | 클래스 Fixture, 자원 검사, 두 Commit 순서, 늦은 작은 확인 및 인계/재배정 | PARTIAL, 클래스의 선택 사례와 대기 검사 함수 |
| Lab CustomerMessageConfirmationController.java | POST가 반환하는 상태와 확인 이력/현재 상태의 응답 형식 | VERIFIED, 파일 전체 |
| Lab TicketConversationService.java, SupportAccess.java 및 JdbcSupportRepository.java | 고객 글과 확인이 Ticket 행 잠금을 요청하는 경로 | PARTIAL, 해당 메서드와 SQL |
| Lab JdbcCustomerMessageConfirmationRepository.java 및 CustomerMessageConfirmationService.java | 현재 배정/확인 지점 조회, 호출자별 canConfirm과 needsConfirmation 계산 | VERIFIED: 두 파일의 소스 대조 |
| 관련 Node Test | 잘못된 성공 본문/원래 제출 보존/GET만 재시도와 관련된 선택 사례 | PARTIAL: 해당 검사 파일의 모든 사례를 새로 감사한 것은 아님 |
| 나머지 구현 및 운영 | 오늘 새 코드 감사/실행 범위 아님 | NOT_INSPECTED |

이번 학습의 근거는 위 소스 대조, 11/4까지의 실행 기록과 실제 문답이다. 11/7에는 이 근거를 12주차 완료 기준에 맞춰 최종 대조한다.
