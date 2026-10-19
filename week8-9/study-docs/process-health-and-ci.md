# Process 종료, Health와 CI

Container가 실행 중이라는 것, HTTP 요청을 받을 수 있다는 것, AI Job이 성공했다는 것은 서로 다른 상태다. 배포를 이해하려면 이 상태들을 따로 볼 수 있어야 한다.

Image·Container·파일·메모리의 기본 관계는 [Docker와 Compose 자료](./docker-image-container-compose-volume.md), 설정값과 실행 객체의 관계는 [Spring 설정과 Bean 자료](./spring-settings-bean-and-secret-wiring.md)에서 이어진다.

## Container 안의 Java Process

Image의 JAR는 파일이고, `java -jar`를 실행하면 JVM Process가 생긴다. Spring은 이 Process 안에 Controller·Service·Repository와 다른 Bean을 만든다.

```text
Image의 helpdesk.jar
  → Container 시작
  → Java Process 실행
  → Spring Context와 Bean 생성
  → HTTP 요청 처리
```

Dockerfile의 `ENTRYPOINT ["java", "-jar", "/app/helpdesk.jar"]`는 중간 Shell을 거치지 않고 Java를 실행한다. 이 구성에서 Container 내부 PID 1은 Java다. Host에서 보는 Process 번호까지 1이라는 뜻은 아니다.

Linux의 `/proc/1/status`에서는 Process 이름, PID, 상태, Thread 수와 메모리 사용량을 읽을 수 있다. `State: S (sleeping)`는 작업을 기다리는 상태일 수 있으며, Container가 Stop됐다는 뜻이 아니다. `VmRSS`는 관찰 시점의 메모리 사용량이지 앞으로 필요한 최대 메모리가 아니다.

Process 환경 변수와 전체 실행 인자에는 Credential이 들어갈 수 있다. 학습에서는 필요한 상태 항목만 읽고 `/proc/<pid>/environ`이나 전체 실행 인자를 출력하지 않는다.

### 가상 주소 공간·JVM 메모리·Container 메모리

메모리 숫자를 볼 때는 무엇을 세고 있는지부터 구분한다.

| 항목 | 세는 대상 | 주의할 점 |
|---|---|---|
| `/proc/1/status`의 `VmSize` | 해당 Process의 전체 가상 주소 공간 | 확보한 주소 범위가 모두 실제 RAM에 올라온 것은 아님 |
| 같은 파일의 `VmRSS` | 해당 Process의 상주 메모리 | Java Heap만의 크기가 아니며 Container 전체 사용량도 아님 |
| cgroup의 `memory.current` | 해당 cgroup에 현재 청구된 메모리 | Process 외 File Cache·일부 Kernel 메모리 등도 포함 |
| cgroup의 `memory.max` | 해당 cgroup의 메모리 상한 | 현재 사용량이나 앞으로 필요한 최대량을 측정한 값은 아님 |

예를 들어 512 MiB 제한에서 `VmSize`가 3.34 GiB이고 `VmRSS`가 197 MiB여도 곧바로 모순은 아니다. 주소 공간을 예약한 것과 실제 메모리를 사용하는 것은 다르다. 같은 시점 근처의 Container 사용량이 238 MiB라면 JVM의 RSS와도 구분해 읽는다. 서로 다른 관찰은 읽는 시각도 조금씩 다를 수 있다. [Linux Process 상태](https://man7.org/linux/man-pages/man5/proc_pid_status.5.html), [cgroup v2 메모리](https://docs.kernel.org/admin-guide/cgroup-v2.html#memory)

Linux의 값에서 `/proc`의 kB는 통상 1024바이트 단위이며 cgroup 메모리 값은 바이트다. 단위를 맞춘 뒤 비교한다. Container 사용량이 지금 238 MiB라는 사실은 실제 AI·개인정보 모델을 함께 실행해도 512 MiB 안에 들어간다는 보장이 아니다. 실제 조합에서 시작·처리·실패·종료 중 Peak를 관찰해야 한다.

CPU의 `cpu.max`가 `25000 100000`이면 100,000마이크로초 주기당 25,000마이크로초의 CPU 시간을 허용한다. 평균적으로 0.25 CPU에 해당하는 Quota이지 메모리 0.25개나 특정 물리 Core 한 개의 소유권이 아니다. [cgroup v2 CPU](https://docs.kernel.org/admin-guide/cgroup-v2.html#cpu)

### Log Pipeline은 필요한 사건만 골라 읽는 과정

Pipeline의 `|`는 앞 명령의 출력을 다음 명령의 입력으로 전달한다. 예를 들어 **민감 정보가 없는 Test 전용 합성 실험**에서 시작 Marker의 수를 셀 수 있다.

```powershell
docker logs '<EXPERIMENT_CONTAINER>' 2>&1 |
    Select-String -Pattern '^LIFECYCLE_PROBE_REQUEST_STARTED$' |
    Measure-Object
```

`docker logs`가 표준 출력·오류를 가져오고, `Select-String`이 정확히 일치하는 Marker만 고르며, `Measure-Object`가 그 수를 센다. Marker 1개는 그 기록이 한 번 관찰됐다는 뜻이다. 요청 완료·DB Commit·AI 성공까지 증명하지 않으므로 실제 응답·DB 상태·Job 결과를 따로 확인한다.

이는 Log를 수집한 뒤 고르는 것이지 민감 정보가 처음부터 Log에 기록되지 않았다는 보장이 아니다. 실제 문의 원문·Password·Token·환경 변수는 애초에 Log에 넣지 않는다. 원격 업무 Log 전체를 내려받는 대신 허용된 식별자와 필요한 사건으로 조회 범위를 좁힌다.

## SIGTERM과 SIGKILL

### 이름과 Signal의 뜻

Signal은 Linux 운영체제가 실행 중인 Process에 전달하는 알림이다. 종료와 같은 사건을 Process에 알리는 수단이며, Browser가 보내는 HTTP 요청과는 다르다.

이름의 `SIG`는 Signal을 뜻한다. `TERM`은 Termination, 즉 종료를 뜻하고, `KILL`은 강제 종료를 나타낸다. `SIGTERM`과 `SIGKILL`은 Java 함수 이름이나 Docker 명령어가 아니라 서로 다른 Signal의 이름이다.

| Signal | 의미 | Application이 종료 처리를 할 기회 |
|---|---|---|
| SIGTERM | 종료를 요청한다 | 종료 Hook과 정리 작업을 실행할 수 있다 |
| SIGKILL | 운영체제가 즉시 종료한다 | 종료 Hook을 실행할 수 없다 |

SIGTERM의 기본 동작도 종료다. 다만 프로그램이 종료 Signal을 처리하는 코드를 마련할 수 있다는 점이 SIGKILL과 다르다. SIGKILL은 프로그램이 받아서 무시하거나 정리 코드를 실행하는 방식으로 처리할 수 없다. [Linux Signal 설명](https://man7.org/linux/man-pages/man7/signal.7.html)

### 누가 누구에게 전달하는가

Docker로 실행한 Helpdesk에서는 다음 관계로 이해할 수 있다.

```text
사용자가 PowerShell에서 docker stop 실행
  → Docker Engine이 종료를 요청
  → Linux 운영체제가 Container의 주 Process에 SIGTERM 전달
  → 이 구성의 Java Process가 종료 처리를 시작
```

Docker는 실행 중인 Container를 관리하고, Java는 Container 안에서 Helpdesk를 실행하는 Process다. `docker stop`은 Helpdesk Controller의 종료 API를 호출하는 방식이 아니다.

JVM의 종료 Hook은 JVM이 종료될 때 실행하도록 등록한 정리 코드다. Spring은 이를 통해 Context를 닫고 서버와 관리 중인 객체를 정리한다. 정리를 하도록 만든 코드와 설정이 있어야 하며, SIGTERM 자체가 모든 작업을 성공시키는 것은 아니다.

`docker stop`은 기본적으로 SIGTERM을 보낸 뒤 기다린다. 제한 시간까지 Process가 종료되지 않으면 SIGKILL로 강제 종료한다. `docker kill`은 기본적으로 곧바로 SIGKILL을 보낸다. [Docker Stop 안내](https://docs.docker.com/reference/cli/docker/container/stop/), [Docker Kill 안내](https://docs.docker.com/reference/cli/docker/container/kill/)

### Graceful Shutdown은 처리 중인 요청을 마칠 기회

Spring Boot의 Graceful Shutdown은 새 요청 수락을 중단하고, 이미 처리 중인 HTTP 요청이 끝나기를 기다리는 기능이다. Tomcat에서는 새 연결을 받는 단계에서 차단한다. 대기 시간은 `spring.lifecycle.timeout-per-shutdown-phase`로 설정한다. [Spring Boot Graceful Shutdown](https://docs.spring.io/spring-boot/reference/web/graceful-shutdown.html)

```text
4초가 필요한 요청을 처리 중
  → SIGTERM 수신
  → 진행 중 요청 완료를 기다림
  → HTTP 응답 전달
  → Context 종료와 Process 종료
```

### Spring의 대기 시간과 Docker의 대기 시간

서로 다른 두 제한 시간을 구분해야 한다.

| 설정 | 기다리는 주체 | 기다리는 대상 |
|---|---|---|
| Spring의 HTTP 종료 유예 20초 | JVM 안의 Spring 서버 종료 처리 | 이미 처리 중인 HTTP 요청의 완료 |
| Docker의 Container 종료 유예 1초 | Docker Engine | Container의 주 Process가 종료되는 것 |

Spring의 20초 설정은 요청을 20초 동안 실행시키라는 뜻이 아니다. 종료할 때 진행 중인 요청을 마칠 기회를 주는 최대 대기 시간이다. Docker의 제한은 이보다 바깥에 있으며, Spring이 계속 기다리는 중이어도 Process를 강제로 종료할 수 있다.

Signal을 받는 시점에 요청을 마치기까지 **4초가 더 필요한 상황**에서 Docker가 1초만 기다린다고 가정한다.

```text
종료 요청 후 0초: SIGTERM 전달 → Spring이 진행 중 요청을 기다리기 시작
종료 요청 후 1초: 아직 Process가 실행 중 → Docker가 SIGKILL 전달
종료 요청 후 4초: 원래 응답을 마칠 예정이었지만 Process가 이미 종료됨
```

이 요청은 정상 응답을 마칠 수 없다. Spring이 20초를 허용했어도 바깥에서 1초 후 Process를 종료했기 때문이다. Docker가 충분히 기다리고 다른 문제가 없다면, 요청은 남은 4초 동안 처리된 뒤 응답하고 종료할 수 있다.

종료 유예는 반드시 그 시간만큼 기다리는 고정 지연이 아니다. 정리가 먼저 끝나면 그보다 일찍 종료한다. Spring 내부 설정은 종료 단계별 제한이므로 전체 종료가 정확히 20초 안에 끝난다는 뜻도 아니다.

### Exit Code를 읽는 방법

Linux의 OpenJDK는 SIGTERM 처리 시 `128 + 15 = 143`으로 종료할 수 있다. 종료 Hook을 마친 경우에도 이 값이 나올 수 있다. `143`을 무조건 Application 실패로 분류하면 안 된다. [OpenJDK의 종료 Signal 처리](https://github.com/openjdk/jdk/blob/jdk-25-ga/src/java.base/unix/classes/java/lang/Terminator.java)

SIGKILL 종료에서는 흔히 `128 + 9 = 137`이 관찰된다. 다만 `137`만 보고 메모리 부족이라고 판단하지 않는다. 보낸 Signal·종료 제한·`OOMKilled`·요청 결과를 함께 확인해야 한다.

정리 작업의 성공은 Exit Code가 `0`인지뿐 아니라, 진행 중 요청이 끝났는지와 필요한 상태가 보존됐는지로 확인한다.

## Process 종료와 데이터의 수명

Process가 종료되면 JVM 메모리의 Bean과 `HttpSession`은 사라진다. 다른 프로그램인 PostgreSQL에 Commit한 Row까지 함께 사라지는 것은 아니다.

AI Job의 경우 HTTP 요청이 끝난 뒤에도 Worker가 처리 중일 수 있다. HTTP Graceful Shutdown만 켰다고 모든 Job이 성공하거나 외부 AI 호출이 취소되는 것은 아니다. 재시작한 Worker는 DB에 남은 Job·Attempt·예약·제안 상태를 읽고 기존 복구 정책을 적용해야 한다.

연결이 끊겼다는 사실만으로 DB Commit 여부를 단정하지 않는다. 이미 Commit한 Row인지, 아직 처리 중인 Transaction인지 DB에서 확인한다. 외부 AI의 실행과 DB Transaction도 하나의 원자적 작업이 아니다.

### Connection과 Transaction 그리고 Job 상태

DB Connection은 Application과 PostgreSQL이 SQL을 주고받는 연결이다. 하나의 JVM이 Connection Pool에 여러 연결을 준비하고 재사용할 수 있다. 연결 10개는 사용자 10명·Job 10개·AI 호출 10회를 뜻하지 않는다.

Transaction은 여러 DB 변경을 함께 Commit하거나 Rollback하는 단위다. PostgreSQL이 끊어진 연결을 정리하면 진행 중이던 Transaction의 미완료 변경도 취소되고 그 Transaction의 Row Lock이 풀린다. 앞선 다른 Transaction에서 이미 Commit한 Row는 유지된다. [PostgreSQL Transaction](https://www.postgresql.org/docs/17/tutorial-transactions.html), [Row Lock의 수명](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)

Job의 `RUNNING`은 Application이 DB에 기록한 업무 상태다. JVM의 Process 상태나 연결 상태와 같은 값이 아니므로 Worker가 종료된 뒤에도 남을 수 있다. DB는 App의 연결이 끊겼다는 이유만으로 이 업무 상태를 자동 변경하지 않는다.

| 대상 | App 강제 종료 뒤의 의미 |
|---|---|
| App의 DB Connection | DB가 종료를 감지하고 정리 |
| 진행 중 Transaction의 변경·Row Lock | 변경은 취소되고 Lock 해제 |
| 앞서 Commit한 Ticket·Message·Job·예약 | Row와 저장한 상태 유지 |
| `RUNNING` Job | 자동 성공·실패가 아니라 기존 복구 정책으로 판단할 대상 |

관측에는 `pg_stat_activity`의 `application_name` 같은 표식을 사용할 수 있다. 표식은 연결을 구분하기 위한 값이며 인증이나 권한 증명이 아니다. 연결 수만 필요하다면 다른 Session의 Query·원문·사용자 정보를 함께 출력하지 않는다. [PostgreSQL 연결 관측](https://www.postgresql.org/docs/17/monitoring-stats.html#MONITORING-PG-STAT-ACTIVITY-VIEW)

Row Lock 해제와 다음 Provider 호출 허가는 별개다. 재시작한 Worker는 기존 결과·Job 상태·현재 Attempt·예약 한도·Lease·처리 기한·실패별 재시도 정책을 확인해야 한다. 관측 Test가 Lock을 일부러 유지한 것과 달리 실제 Worker는 예약 Transaction을 Commit해 Lock을 풀고 외부 AI를 호출한다.

## Health는 무엇을 알려주는가

Health는 등록된 점검 항목을 통해 Application의 현재 상태를 알려주는 Endpoint다. Endpoint는 상태를 조회하는 HTTP 주소이고, Health Indicator는 개별 점검을 수행하는 객체다. DB 연결 점검이나 디스크 여유 공간 점검 등이 여기에 해당한다. 최소 응답은 다음과 같다.

```json
{"status":"UP"}
```

`UP`은 이 Endpoint에 포함된 점검 항목을 종합한 결과다. DB만의 준비 상태라는 뜻은 아니다. DB 점검이 등록돼 있다면 그 결과도 포함되지만, DB를 사용하지 않는 In-memory 실행에서도 Health는 `UP`일 수 있다. 등록하지 않은 기능까지 자동으로 점검하는 것은 아니다.

Health를 조회할 때마다 실제 AI를 호출해 모든 문의를 처리해 보는 것도 아니다. 서버와 DB는 정상인데 한 AI Job은 Provider 거부 때문에 `FAILED`일 수 있다. 반대로 AI 제안이 과거에 저장돼 있어도 현재 서버가 요청을 받지 못할 수 있다.

### Health와 AI Job 상태는 서로 다른 대상

| 상태 | 판단 대상 | 예 |
|---|---|---|
| Health `UP` | 현재 등록된 서버 점검 항목 | 서버가 Health 요청에 응답하고 등록된 점검이 정상 |
| Job `FAILED` | 특정 Message의 AI 처리 | 응답 파싱·검증 실패 등을 정책에 따라 최종 실패로 기록 |
| Job `SUCCEEDED` | 특정 Message의 제안 생성·저장 | 검증된 제안과 성공 상태의 DB Commit 완료 |

Helpdesk의 성공 상태 이름은 `SUCCESS`가 아니라 `SUCCEEDED`다. AI 응답 수신만으로는 이 상태가 되지 않는다. 다음 처리가 이어져야 한다.

```text
AI 응답 수신
  → JSON 파싱과 출력 계약 검증
  → 현재 Job·Attempt의 실행권 확인
  → 제안 저장과 Job의 SUCCEEDED 갱신
  → 같은 결과 Transaction의 Commit
```

DB 저장이 실패하면 응답을 받았다는 사실만으로 성공 처리하지 않는다. 저장 재시도와 최종 실패 여부는 별도 정책을 따른다. 유효한 판단 보류는 `ABSTAINED`로 구분하며, AI가 응답했다는 사실이 요약 내용의 정확성을 보장하지도 않는다.

ALB는 Health 응답으로 요청을 보낼 대상을 점검한다. 그러므로 Health에 Login이나 CSRF Token을 요구하면 점검기가 정상 서버를 사용할 수 없는 대상으로 판단할 수 있다.

Helpdesk의 기본 구성은 `GET`·`HEAD /actuator/health`만 익명으로 허용하고, 상태값만 반환한다. Health 상세·구성요소·환경 변수·Heap Dump·관리 기능은 공개하지 않는다. [Spring Boot Actuator Endpoint](https://docs.spring.io/spring-boot/reference/actuator/endpoints.html)

## Log와 Metric

Log는 개별 사건을 기록하고, Metric은 여러 요청의 수와 시간을 집계한다.

| 관찰 수단 | 확인할 내용 |
|---|---|
| Request Log | 어떤 요청이 언제 어떤 결과로 끝났는가 |
| Job Log | 어느 Job·Attempt를 처리했고 어느 단계에서 실패했는가 |
| HTTP Metric | 요청 수, Status별 요청 수, 처리 시간 |

`http.server.requests`의 Timer는 요청 수와 처리 시간을 측정한다. Status가 `401`이나 `500`인 요청을 선택하면 해당 Status의 수와 시간을 볼 수 있다. 전체 요청 수가 없다면 오류 수만으로 오류 비율을 계산할 수 없다.

Security에서 거부된 요청은 Controller에 도달하지 않는다. Controller의 Interceptor만 관찰하면 이 요청을 놓칠 수 있으므로 HTTP 요청 전체의 집계도 필요하다.

Helpdesk는 `GET /actuator/metrics/http.server.requests`만 AGENT에게 허용한다. 익명은 `401`, USER는 `403`이고, 다른 관리 Endpoint는 AGENT도 사용할 수 없다. 이 Metric은 현재 JVM의 집계다. Process를 재시작하면 이전 집계를 자동으로 이어 가지 않으며 장기 관측은 별도 저장이 필요하다.

### Request ID로 접수와 Worker Log 연결하기

HTTP 요청이 끝난 뒤 Worker가 실행되므로 Request ID 하나만으로 전체 처리를 구분할 수는 없다. 접수 기록에서 Request와 Job을 연결하고, Worker에서는 Job과 실행 차수를 기록한다.

| 식별자 | 구분하는 대상 |
|---|---|
| `requestId` | 개별 HTTP 요청 |
| `ticketId`·`messageId` | 접수한 문의와 원문 메시지 |
| `jobId`·`attempt` | 특정 AI 작업과 실행권을 확보한 차수 |

Helpdesk는 다음 세 종류의 Event를 구분한다. Log는 필요한 Field만 선택한 `key=value` 형식이며 전체 객체를 출력하지 않는다.

| Event | 기록하는 시점과 의미 |
|---|---|
| `TICKET_RECEIPT_COMMITTED` | HTTP Controller가 Transactional Service Proxy의 정상 반환을 받은 뒤 Request·Ticket·Message·Job ID를 연결 |
| `HANDLER_COMPLETED` | MVC Interceptor의 완료 시점에 Request ID·Handler·HTTP Status·`elapsedNanos` 기록 |
| `AI_WORKER_TICK_RESULT` | 한 Worker Tick이 반환한 Job ID·Attempt·Outcome·`tickElapsedNanos` 기록 |

`@Transactional` Service 안에서 마지막 INSERT를 마쳤어도 Proxy의 Commit이 실패할 수 있다. 따라서 접수 완료 Log를 Service 메서드의 `return` 직전에 남기지 않는다. 현재 HTTP 경로는 Controller에 바깥 Transaction을 두지 않으므로 Service Proxy가 정상 반환했을 때 접수 Commit이 끝나 있다. 이 기록은 Browser가 응답을 수신했다는 뜻은 아니다.

다음은 실행 순서를 보여주는 예시다. 숫자는 실제 측정값이 아니다.

```text
event=TICKET_RECEIPT_COMMITTED requestId=550e8400-e29b-41d4-a716-446655440000 ticketId=7 messageId=31 jobId=90
event=HANDLER_COMPLETED requestId=550e8400-e29b-41d4-a716-446655440000 handler=TicketReceiptController#create status=201 elapsedNanos=120000000
event=AI_WORKER_TICK_RESULT jobId=90 attempt=1 outcome=STORAGE_PENDING tickElapsedNanos=8000000000
event=AI_WORKER_TICK_RESULT jobId=90 attempt=1 outcome=STORED tickElapsedNanos=20000000
```

Handler가 걸린 120ms와 Worker Tick의 시간은 서로 다른 측정이다. Handler 시간에는 Security 이전 단계·Network 왕복이 모두 포함되지 않는다. Tick이 저장만 재시도했다면 그 시간도 Provider 호출 시간이나 대기·여러 Tick을 합친 Job 전체 처리 시간이 아니다.

Worker의 `outcome`은 DB의 `job.status`와 구분한다. `STORAGE_PENDING`은 저장 결과를 확인하거나 같은 검증 객체의 저장을 재시도해야 한다는 뜻이다. `STORED`는 결과 Service의 Commit 성공 또는 저장된 성공 결과의 재확인을 거쳐 반환한다. `NOT_CURRENT`는 해당 Attempt의 결과를 채택하지 않았다는 뜻이지 현재 Job이 실패했다는 뜻이 아니다. 실패 코드와 최종 상태는 Job 조회로 확인한다.

할 일이 없는 `NO_JOB`과 저장 재시도 시각을 기다리는 `STORAGE_RETRY_WAITING` Tick은 기록하지 않는다. 예외가 나면 원문 Message·Cause 대신 기존 고정 경고 `AI_WORKER_TICK_FAILED`만 남긴다. Request ID도 Client Header를 그대로 신뢰하지 않고 서버가 만든 UUID를 사용한다.

MVC에 도달하기 전에 Security가 거부한 요청에는 Handler 완료 Log가 없을 수 있다. HTTP 전체의 Status별 집계는 `http.server.requests`에서 확인한다. 또한 DB Commit과 Log 출력은 하나의 Transaction이 아니다. Commit 직후 Process가 종료되면 Row는 있어도 그 다음 Log는 없을 수 있으므로, Log가 없다는 이유로 재접수·재호출하지 않고 DB 상태부터 확인한다.

## CI에서 확인하는 것

CI는 Continuous Integration, 즉 지속적 통합이다. 변경한 코드를 공통 저장소에 자주 합치고 Build·Test 등의 자동 검사로 문제를 확인하는 개발 방식이다. GitHub에서만 가능한 기능은 아니며, GitHub Actions는 CI를 실행하는 도구 중 하나다. [GitHub의 CI 설명](https://docs.github.com/en/actions/get-started/continuous-integration)

### Workflow와 Runner의 역할

Workflow는 어떤 사건에 어떤 명령을 실행할지 정한 자동화 절차다. Repository의 `.github/workflows/`에 YAML 파일로 작성한다. Runner는 그 명령을 실행하는 컴퓨터다. Helpdesk의 검증 Workflow에서는 Ubuntu Runner가 Source를 내려받고 Java·Node.js와 Docker를 사용해 검사를 수행한다.

Job은 검사를 묶는 실행 단위이고, Step은 그 안의 개별 작업이다. 현재 검증 구성은 하나의 Job 안에 Source 가져오기, 실행 도구 준비, 각 검사와 Image Build를 순서대로 둔다. Actions의 Job은 DB에 저장하는 Helpdesk의 AI Job과 별개다. CI Runner도 고객의 요청을 계속 처리하는 배포 서버가 아니다. [GitHub Actions 구성 요소](https://docs.github.com/en/actions/get-started/understand-github-actions)

Helpdesk의 GitHub Actions 검증 흐름은 다음과 같다.

```text
Commit의 Source 가져오기
  → Java Build와 Test·PostgreSQL Integration Test
  → JavaScript Test
  → ESLint
  → Docker Image Build
```

앞의 검사가 실패하면 다음 Image Build를 실행하지 않는다. 실제 PostgreSQL Test를 H2로 바꾸거나 건너뛰어 성공으로 만들지 않는다. 일반 CI에는 API Key를 제공하지 않고 실제 AI 호출과 자동 Worker는 비활성화한다. [GitHub Actions의 Maven 검증](https://docs.github.com/en/actions/tutorials/build-and-test-code/java-with-maven)

### Java 프로젝트에서도 JavaScript를 검사하는 이유

Helpdesk의 JAR에는 Java 백엔드의 Class뿐 아니라 HTML·JavaScript 파일도 들어 있다. 서버는 이 파일들을 Browser에 전달하고, Browser는 JavaScript를 실행해 요청을 보내고 결과를 표시한다. JavaScript가 Java로 변환되는 것은 아니다. Java를 컴파일하고 Test하는 명령만으로 Browser용 JavaScript의 로직까지 검증되지는 않으므로 별도 검사를 둔다.

`node --test src/test/js/*.test.mjs`는 Node.js에서 JavaScript Test를 실행한다. UI Unit Test는 실제 Browser용 모듈을 가져오되 서버 응답과 화면 표시 객체를 Test가 준비한 대체 객체로 제공한다. HTTP 오류에 맞는 UI 상태, 잘못된 응답 거부, CSRF Header 구성과 오래된 응답 무시 등을 확인한다. 같은 명령에는 AI 실험 스크립트의 호출 계획·검증·예산 계산 등도 포함되므로 모든 JavaScript Test가 UI Test인 것은 아니다.

Node.js의 Unit Test는 실제 Browser의 Cookie 전송·CORS 판단·화면 렌더링을 확인하는 Browser E2E와 다르다. CSRF Header를 구성하는 코드를 검사한 결과와 실제 Browser에서 그 Header가 Server에 도달한 결과도 구분한다. [Node.js Test Runner](https://nodejs.org/api/test.html)

### Test 실패가 뒤의 Image Build를 막는 과정

검사 명령은 종료 코드로 실행 결과를 알린다. Test 실패로 명령이 0이 아닌 코드로 끝나면 해당 Step도 실패한다. 같은 Job의 일반적인 후속 Step은 앞의 Step이 성공했을 때 실행되므로, 현재 구성에서는 JavaScript Test 실패 뒤 ESLint와 Docker Image Build가 건너뛰어진다. [GitHub Actions의 기본 성공 조건](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions)

Java 검사는 통과했지만 JavaScript Test가 실패했다면 예상 결과는 다음과 같다.

| Step | 예상 상태 | 의미 |
|---|---|---|
| Java Build와 Test | Success | 해당 Java 검사가 통과했다 |
| JavaScript Test | Failure | JavaScript의 실제 결과가 Test의 기대와 달랐다 |
| ESLint | Skipped | 앞의 Step 실패로 실행하지 않았다 |
| Docker Image Build | Skipped | 이 실행에서는 검증을 통과한 Image를 만들지 않았다 |

예를 들어 격리된 학습 Branch에서 빈 제목을 허용하도록 `isTicket`을 잘못 수정한다. 기존 Test는 빈 제목을 거부해야 한다고 기대하므로 실패해야 한다. 실제 Actions에서 실패한 Test와 건너뛴 Image Build를 확인하고, 코드를 바로잡은 뒤 새 Commit의 검사가 통과하는지 비교한다. Test의 기대값을 잘못된 동작에 맞춰 바꾸는 것이 아니라 검사 대상의 오류를 고친다.

`continue-on-error`나 `always()`를 사용하면 실패 뒤에도 작업을 실행하도록 만들 수 있다. 검사와 배포를 서로 다른 Job으로 나눌 때도 검사 Job에 대한 의존 관계를 명시해야 한다. 검증 Workflow가 실패했다는 사실만으로 모든 별도 배포나 Git Push가 자동으로 금지되는 것은 아니다.

Test·Image Build로 끝나는 검증과 ECR Push·ECS 배포는 서로 다른 단계다. Image를 만든 뒤에는 ECR에 저장된 Digest와 ECS에서 실행하는 Digest를 대조하고, Cloud의 설정·DB·HTTPS 요청을 별도로 확인한다.

CI에서 사용한 설정과 배포 환경의 설정은 다를 수 있다. 같은 Image라도 Secret 누락, DB 연결 차단, 권한 부족, DNS·인증서 설정 오류 때문에 실제 서비스가 실패할 수 있다. Helpdesk의 배포 후보는 EC2 서버를 직접 관리하는 방식이 아니라 ECS Fargate에서 Container를 실행하고 RDS에 데이터를 두는 방식이다.

## 핵심 질문

1. SIGTERM과 SIGKILL은 각각 어떤 뜻이며, 종료 정리 코드를 실행할 기회는 어떻게 다른가?
2. 요청을 마치기까지 4초가 남았는데 Docker가 SIGTERM 후 1초만 기다린다면, Spring의 20초 종료 유예만으로 요청을 끝낼 수 있는가?
3. Health가 `UP`인데 AI Job은 `FAILED`일 수 있는가? AI 응답 수신과 Job의 `SUCCEEDED`는 어떻게 다른가?
4. CI에서 Test와 Image Build가 성공했다면, AWS에서 HTTPS 접속도 성공했다고 말할 수 있는가?
5. 512 MiB 제한에서 `VmSize`가 3.34 GiB라면 반드시 메모리 상한 위반인가? `VmRSS`와 `memory.current`는 무엇이 다른가?
6. Log에서 요청 시작 Marker를 한 번 찾았다는 사실만으로 응답 완료·DB 저장·AI 성공까지 확인한 것인가?
7. 접수 Service의 마지막 INSERT 성공과 Service Proxy의 정상 반환 사이에는 어떤 실패가 가능한가? 접수 Commit Log는 어느 쪽에서 남겨야 하는가?
8. `STORAGE_PENDING`·`STORED`·`NOT_CURRENT`는 각각 무엇을 뜻하는가? Worker Tick의 시간은 Job 전체의 처리 시간인가?
9. Commit Log가 없다는 사실만으로 접수 Row가 없다고 판단하거나 Provider를 다시 호출해도 되는가?
10. 하나의 App에 DB Connection이 10개라면 Provider도 10번 호출한 것인가? Connection·Transaction·Job은 각각 무엇인가?
11. App 종료 뒤 Row Lock이 풀렸다면 다음 Worker가 바로 Provider를 호출해도 되는가? `RUNNING` Row만으로 Worker가 지금 살아 있다고 판단할 수 있는가?
