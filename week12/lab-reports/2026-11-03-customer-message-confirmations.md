# 담당자의 명시적 확인 API 검증

> 일자: 2026-11-03
> 상태: 저장/API의 집중 및 전체 로컬 검증 완료. 직원 표시/확인 버튼/새 Browser 흐름은 다음 단위
> Source: Lab 저장 구조 80e5de9, 확인 API 6b3ba1d, Flyway V12
> 기준: [기술 계약](../customer-followup-contract-draft.md), [확인 지점 학습 자료](../study-docs/confirmation-checkpoint-and-assignment.md)

## 구현 범위

V1~V11은 그대로 두고 V12에 ticket_customer_message_confirmations를 추가했다. 확인자와 제출 UUID, 같은 Ticket의 배정 버전/고객 메시지를 참조한다. 원래 문의나 답변/배정/AI Row는 변경하지 않는다. 일반 수정/삭제나 만료/TTL, 과거 확인의 자동 생성은 없다.

같은 Ticket/현재 배정의 MAX(through_message_id)를 유효 확인 지점으로 사용한다. 확인 기록 ID/recorded_at/마지막 Commit으로 고르지 않는다. 늦은 작은 확인도 이력으로 남긴다. 인계와 A→B→A는 각각 별도 배정의 범위이며 과거 확인을 새 담당자의 확인으로 복사하지 않는다.

GET /api/tickets/{ticketId}/customer-message-confirmations/current는 직원 전용 상태 조회다. POST /api/tickets/{ticketId}/customer-message-confirmations는 명시한 대상까지만 확인을 남긴다. 현재 서비스 권한, 새 제출의 현재 담당자/배정 버전, 고객 Message 종류/같은 Ticket을 검사한다. SUPERVISOR도 자신에게 인계한 뒤 새 확인을 남긴다.

새 제출은 Commit 후 201, 동일 UUID/버전/대상은 200과 새 기록 0건, 변경은 409다. 과거 제출의 confirmation과 현재 배정의 currentConfirmation을 나누어 반환한다. 권한이 회수된 직원은 UUID를 알고 있어도 재확인할 수 없다.

Ticket 잠금→membership 공유 잠금의 기존 순서를 지키고 기한은 2초다. 새 고객 글과 인계도 같은 Ticket 잠금을 사용한다. 현재 상태는 한 SQL에서 배정/최신 고객 ID/배정별 확인 범위를 함께 읽는다. GET은 확인 기록을 쓰지 않으며 공유 잠금 때문에 DB의 read-only Transaction으로 표시하지 않았다.

## 실제 실행

```powershell
.\mvnw.cmd -B -ntp '-Dtest=CustomerMessageConfirmationHttpIntegrationTest,CustomerMessageConfirmationMigrationIntegrationTest' test
.\mvnw.cmd -B -ntp verify
```

| 검사 | 결과와 근거 |
|---|---|
| HTTP/실제 PostgreSQL 42개 | 모두 통과. 권한/CSRF/고정 ID, MAX/이력 보존, 인계/재배정/재확인, 같은 UUID 동시 제출, 입력 Byte/형식/대상, 실제 잠금과 Commit 실패 |
| V11→V12 Migration 1개 | 기존 업무/사용자/서비스 Row 보존, 필수 값/Unique/FK와 같은 Ticket의 배정·Message 참조 확인 |
| 전체 Java | Surefire 1,165개/패키징 후 Failsafe 2개, 실패/오류/Skip 0, BUILD SUCCESS. 집중 43개는 전체 수에 포함 |
| Provider/Worker | 비활성. 새 HTTP Test의 Provider mock 상호작용 없음 |
| JavaScript/Browser | 이번 단위에서 변경/새 실행 없음. 이전 345개/Browser 결과는 이전 목록/고객 작성 화면의 근거 |

새 확인 전 기존 공식 답변/고객 후속 글/배정/확인과 비어 있지 않은 AI 제안·분류·Attempt를 준비했다. INSERT 뒤 강제 실패를 주입한 뒤 기존 Table의 Row 값을 대조했다. 별도 지연 FK 위반 Trigger는 실제 Commit에서 실패하도록 하며 HTTP가 201을 반환하지 않는 것을 확인했다.

## 교차 실행에서 확인한 경계

- 확인이 먼저 Commit되고 새 고객 글이 나중에 저장되면, 확인 응답은 그때 본 지점까지만 담고 이후 조회는 새 글의 확인 필요를 반환했다.
- 새 고객 글이 먼저 Commit돼도 기다리던 확인은 명시한 이전 대상까지만 기록했다. 최신 메시지로 자동 확대하지 않았다.
- 확인이 먼저 Commit되고 인계되면 기록은 이전 배정에 남고 새 배정의 지점은 NULL이었다. 인계가 먼저 Commit되면 기다리던 이전 담당자의 새 확인은 거부됐다.
- membership 회수가 먼저 Commit되면 기다리던 확인은 거부됐다. 확인이 먼저 Commit되면 그 기록은 보존되고 이후 회수된 직원의 조회/재확인은 거부됐다.
- 조회의 권한 검사 뒤 현재 상태 SQL 전에 인계를 끼워 넣어 새 배정과 그 배정의 NULL 지점이 함께 반환되는 것을 확인했다.

단순 지연 시간 추측 대신 PostgreSQL의 실제 Lock 대기를 관찰한 뒤 선행 Transaction을 Commit하도록 제어했다. 이 결과는 합성 격리 DB의 계약/동시성 근거이며 운영 부하나 모든 장애 순서를 증명하는 것은 아니다.

## 설명과 검증의 구분

사용자는 80번이라는 결과를 맞혔지만 '유효기간이 지났다'는 이유와 확인 기록 ID/대상 ID, 인계 후 범위에는 추가 설명을 요청하거나 다른 예상을 했다. 학습 자료를 보완했다. 이후 새 30/20 사례에서 현재 30을 유지하고 20 기록은 감사를 위한 처리 이력으로 보존한다고 답했다. Codex는 이력이 실행 로그에만 남는 것이 아니라 DB 확인 테이블에 저장됨을 명시했다. 인계 후 범위의 재설명 검증은 아직 진행 중이며 테스트 통과를 모든 이해의 완료나 독립 구현으로 기록하지 않는다.

현재 Runtime Probe의 Schema 기대값은 12로 맞췄지만 예전 메모리/CPU 측정은 재실행하지 않았다. 이 로컬 검증 시점에는 Push/원격 CI, Image/AWS/Secret/실제 AI를 진행하지 않았으며 이후 저장소 공개/CI 결과는 [전달 기록](./2026-11-03-documentation-publication.md)에서 구분한다. 직원 업무 목록의 최신 고객 표시, 확인 버튼과 Browser 실험은 다음 단위다. 실제 학습시간과 남은 기술 예산은 미기록이다.

이번 전체 실행에서도 Surefire fork JVM 종료 제한 경고가 나왔다. 앞선 목록/화면 실행에서 나온 같은 문구와 구분해 실행 로그에 보존했으며, 원인이 해결됐다고 주장하지 않는다. Test 결과/패키징 성공과 테스트 프로세스 종료 지연은 별도 판정이다.
