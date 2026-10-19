# App 강제 종료 뒤 DB 연결과 Job 상태 관찰

> 실행일: 2026-10-19 KST
> Lab Commit: `8869de5` — `test(process): observe connection cleanup and committed job preservation`
> 결과: 별도 JVM 재시작 Class 전체 6개 통과. 운영 코드·AWS·실제 AI는 변경하거나 호출하지 않음

## 관찰할 차이

App 종료 뒤에는 DB Connection·진행 중 Transaction·앞서 Commit한 Job을 구분해야 한다. 기존 재시작 Test에 강제 종료 조건 한 개를 추가해 이 세 대상을 비교했다. [접수 Log 검증](./2026-10-19-request-job-log-correlation.md)에서 이어지는 실험이며 새 Production 동작이나 재시도 정책은 추가하지 않았다.

## 실험 순서

1. 실제 PostgreSQL 17.6 Testcontainer를 준비하고 연결 URL이 이 Test DB인지 확인한다.
2. 별도 자식 JVM에서 Ticket·Message·Job 접수와 Attempt 1의 예약을 각각 Commit한다. 이 조건의 자동 Worker와 Provider 호출은 꺼져 있다.
3. 별도 Test Transaction에서 Job Row Lock을 잡고 Ticket 제목을 변경하되 Commit하지 않는다. 열린 Transaction은 종료 관측을 위한 장치이며 실제 AI 대기 방식이 아니다.
4. 부모가 `pg_stat_activity`에서 자식의 관측용 `application_name`에 해당하는 연결 수만 조회한다. 별도 Connection의 `FOR UPDATE NOWAIT` 거부와 원래 제목 조회도 확인한다.
5. Test가 만든 정확한 자식 Process Handle에 `destroyForcibly()`를 호출한다. 같은 PostgreSQL은 계속 실행한다.
6. 연결이 0개가 되는 것을 최대 10초 범위에서 확인하고, Row Lock 획득·원래 제목·Job·Attempt·예약·원장·제안을 다시 조회한다.

자식은 API Key와 외부 Spring DB 설정을 상속하지 않는다. 원문·작성자·Password·전체 환경 변수·다른 Session의 Query는 출력하지 않는다. `application_name`은 해당 격리 DB 안에서 연결을 구분하는 표식이지 인증 신원이 아니다.

## 관찰 결과

| 대상 | 강제 종료 전 | 종료와 DB 정리 뒤 |
|---|---|---|
| 해당 JVM의 DB Connection | 10개 | 0개 |
| 다른 Connection의 Row Lock 획득 | SQLSTATE `55P03`으로 거부 | 성공 |
| 미완료 제목 변경 | 해당 Transaction에서만 변경 | 반영되지 않음, 원래 제목 유지 |
| Ticket·Message·Job | 각 1건 | 각 1건 유지 |
| Ticket / Job 상태 | `OPEN` / `RUNNING` | 동일 |
| 현재 Attempt / 생성 예약 수 | 1 / 1 | 동일 |
| Attempt 원장 / 결과 코드 | 1건 / `UNCONFIRMED` | 동일 |
| Suggestion | 0건 | 0건 |
| 원문·작성자·입력 Message 연결 | Commit된 상태 | 동일 |
| 정책 Snapshot·최초 시작·처리 기한 | 기존 값 | 동일 |

자식 JVM의 Connection Pool에 연결이 여러 개 있었지만 이 조건의 통제된 Provider 호출은 0회였다. 연결 수와 AI 호출 횟수는 같은 값이 아니다. 종료 뒤 Connection과 Row Lock이 정리돼도 Job이 자동으로 `FAILED`가 되거나 예약이 0으로 바뀌지 않았다.

```text
AI_JVM_SHUTDOWN_VERIFIED connectionsBefore=10 connectionsAfter=0 jobStatus=RUNNING attempt=1 reservations=1 suggestions=0
```

## Test 실행과 보완

```powershell
.\mvnw.cmd "-Dtest=AiSuggestionWorkerProcessRestartIntegrationTest" test
```

기존 재시작 5개와 새 종료 1개, 총 6개가 실패·오류·건너뜀 없이 통과했다. 첫 단독 실행은 Lock 거부에 대응하는 Spring 예외를 `CannotAcquireLockException`으로 한정해 실패했다. 실제로는 `UncategorizedSQLException`이 DB의 `55P03`을 감싸고 있었다. DB의 거부 원인은 맞았으므로 SQLSTATE를 직접 확인하도록 Test만 수정했다.

직전 단계의 전체 Java 724개 통과와 이번 Class 6개 재실행은 별도 결과다. 이번에는 Test 전용 자식 실행기·Integration Test와 안내만 변경했으며 전체 Java를 다시 실행한 결과로 기록하지 않는다.

## 해석과 다음 학습

이번 강제 종료는 Windows의 실제 JVM Process 종료다. Linux SIGKILL·Exit Code, RDS 장애나 Network 무응답의 즉시 감지까지 실험한 것은 아니다. DB가 연결 종료를 감지하고 정리한 결과를 관찰했다.

실제 Worker는 짧은 예약 Transaction을 Commit하고 Lock을 해제한 뒤 외부 요청을 보낸다. 새 Worker가 Lock을 얻을 수 있다는 사실만으로 재호출을 허용하지 않는다. 기존 결과·현재 Attempt·예약 한도·Lease·처리 기한·실패 유형을 확인하는 기존 정책을 유지한다.

연결·Transaction·Job 상태의 개념은 [Process 학습자료](../study-docs/process-health-and-ci.md#connection과-transaction-그리고-job-상태)에 연결한다. 현재 Cloud의 Task·AGENT App Metric·비용 확인, 실행용 개인정보 처리·전체 AI 조립과 자원 측정은 남아 있다.
