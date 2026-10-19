# 10월 19일 메모리와 HTTP 지표 및 개인정보 검사 Process

## 메모리의 숫자가 가리키는 대상을 구분한다

`VmSize`는 가상 주소 공간이지 실제 RAM 사용량이 아니다. 512 MiB 제한에서 이 값이 3.34 GiB였다는 사실만으로 메모리 상한을 넘었다고 판단할 수 없다. Process의 실제 상주 메모리인 `VmRSS`와 Container에 계상된 `memory.current`도 구분해서 읽는다.

앞선 실험의 Container 사용량은 약 238 MiB였지만 AI 처리가 꺼져 있었다. 개인정보 검사기와 AI Worker를 함께 실행한 상태에서 실제 사용량과 최고 사용량을 측정해야 한다. 한 시점의 관찰값을 전체 기능의 자원 요구량으로 일반화하지 않는다.

## HTTP 접수와 AI 처리의 시간은 다르다

접수 HTTP 요청이 201이고 120ms가 걸렸다고 해서 AI 요약까지 120ms에 끝난 것은 아니다. 접수 Transaction으로 Ticket·Message·Job을 저장한 뒤 HTTP 응답을 반환하고, Worker는 별도로 Job을 처리한다.

같은 Job에서도 재시도가 가능하므로 `jobId`만 기록해서는 첫 실행과 다음 실행을 구분할 수 없다. `attempt`도 함께 기록한다. Request ID는 HTTP 요청을, Job ID와 Attempt는 비동기 작업과 실행 차수를 구분한다.

## 접수와 Worker를 식별자로 연결한다

이번 구현에서는 접수 Service Proxy가 정상 반환한 뒤 Request·Ticket·Message·Job ID를 기록하도록 했다. Handler 완료 Log에도 Request ID를 넣고, Scheduler는 Job·Attempt·처리 Outcome과 한 Tick의 시간을 남긴다. Service·Repository·DB Schema나 재시도 정책은 바꾸지 않았다.

원문·작성자·비밀값·전체 객체는 Log에 넣지 않는다. 할 일이 없거나 저장 재시도 시각을 기다리는 반복 조회도 제외한다. `STORAGE_PENDING`은 저장 확인·재시도가 필요한 중간 결과이며, `NOT_CURRENT`는 해당 Attempt의 결과를 채택하지 않았다는 뜻이다. 둘을 최종 성공이나 실패로 바꾸어 읽지 않는다.

## INSERT 성공과 Commit 성공을 구분해 확인한다

실제 PostgreSQL Test에서 INSERT는 끝날 수 있지만 Commit 때 FK 제약으로 실패하는 조건을 만들었다. 이때 HTTP 500, 접수한 세 종류의 Row 0건, 접수 Commit Log 없음이 함께 확인됐다. 마지막 INSERT 뒤 Service 메서드가 반환하려는 단계와 Transactional Proxy가 Commit을 마친 뒤 정상 반환한 단계는 다르다.

핵심 Test 44개와 전체 Java 724개가 통과했다. [검증 보고서](../lab-reports/2026-10-19-request-job-log-correlation.md)에 실행 범위를 정리했다. 이 결과는 로컬 구현·회귀 검증이며 AWS의 새 Log나 실제 AI 처리까지 확인한 것은 아니다.

## Log가 없다는 이유로 접수나 예약을 초기화하지 않는다

DB Commit 뒤 Log를 쓰기 전에 Process가 종료되면, 완료 Log가 없어도 Ticket·Message·Job이 남아 있을 수 있다. 재시작한 Worker가 기존 예약을 발견했을 때도 Log의 부재를 근거로 예약을 0으로 만들고 다시 호출하면 안 된다.

이어 Test 전용 자식 JVM과 실제 PostgreSQL로 연결·Lock·미완료 변경을 관찰했다. 접수와 예약을 먼저 Commit한 뒤 별도 Transaction에서 제목 변경과 Job Row Lock을 유지하고 해당 JVM만 강제 종료했다. DB 연결은 10개에서 0개로 줄고 Lock을 다시 얻을 수 있었으며 미완료 제목 변경은 반영되지 않았다. 먼저 저장한 원문·Job `RUNNING`·Attempt와 예약 1회·제안 0건은 유지됐다.

연결이 정리된 것과 업무 상태가 바뀐 것은 다르다. DB 연결 수는 Job 수나 외부 AI 호출 횟수도 아니다. 이 차이를 바탕으로 다음 Worker가 실제로 무엇을 확인해야 하는지 이어서 살펴본다. 이번 관찰은 실제 Windows JVM 강제 종료이며 Linux Signal이나 Cloud 실행 결과와 구분한다.

재시작 Class 전체 6개가 통과했다. 실행 조건과 전후 대조는 [종료 관찰 보고서](../lab-reports/2026-10-19-process-db-connection-shutdown.md)에 정리했다.

## 조회한 Job 상태와 현재 Worker 실행은 다르다

DB에서 `RUNNING`을 읽었다고 실제 Worker가 지금도 작업 중이라고 확정할 수 없다. 이 상태는 실행권을 얻은 Transaction에서 저장한 업무 상태다. 마지막 조회 요청이 `RUNNING`을 다시 저장했다는 뜻도 아니다. 현재 조회 API는 DB 상태를 읽을 뿐 Worker의 생존 여부를 직접 검사하지 않는다.

실행하던 App이 종료된 뒤 새 App이 같은 DB를 조회하면 기존 `RUNNING`이 보일 수 있다. 상태 조회가 HTTP 200이라는 사실은 조회가 성공했다는 뜻이며, 해당 AI 실행이 계속되고 있다는 근거와 구분한다.

## HTTP 평균과 MAX를 읽는다

AGENT 로그인 뒤 기존 P 배포본의 `http.server.requests`를 확인했다. 각 조회 시점의 전체 요청은 15,633회·평균 약 2.61ms, Health GET 200은 15,608회, Job 조회 GET 200은 6회·평균 약 110.04ms였다. 대부분이 짧은 Health 조회인 전체 평균을 특정 업무 API의 평균으로 사용하면 안 된다.

Job 조회를 한 번 더 실행하자 횟수는 6회에서 7회, 누적 시간은 약 660.22ms에서 720.78ms로 바뀌었다. 추가된 약 60.56ms는 Job 상태 조회 HTTP의 서버 처리 시간이다. 읽힌 Job 1은 `PENDING`이고 제안은 없었으므로 AI 생성 시간으로 해석하지 않는다.

처음 `MAX=0`을 보고 측정이 실패해 `null` 대신 0이 들어간 것일 수 있다고 추측했다. 하지만 `COUNT`·`TOTAL_TIME`은 누적값이고 `MAX`는 최근 시간 구간의 최대값이므로 기록 범위가 다르다. 과거 기록이 누적값에 남아 있어도 최근 측정값이 만료되면 MAX는 0이 될 수 있다. 새 조회 뒤 MAX는 약 60.56ms였다. [Micrometer Timer 설명](https://docs.micrometer.io/micrometer/reference/concepts/timers.html)

HTTP 지표의 `SUCCESS`와 AI Job의 성공도 다르다. 상태 조회가 HTTP 200으로 `FAILED`를 반환할 수 있으므로 HTTP 오류율만으로 AI 실패율까지 알 수 없다. 이번 AWS 확인에서는 Task 1개 실행·P Image, ALB Target Healthy·HTTPS Health UP·RDS 사용 가능과 명세의 Provider/Worker 비활성을 확인했다. 새 로컬 Log Code를 Cloud에 배포한 결과는 아니다. 누적 실제 비용·저장량 검토는 남아 있다.

## Timeout과 실제 검사 종료를 구분한다

Timeout 오류가 나도 검사 Process가 계속 실행 중이라면 자원 회수는 끝난 것이 아니다. 종료할 대상은 이번 검사 요청에서 직접 시작한 Process이며, 같은 이름의 다른 Python·Java Process를 모두 종료해서는 안 된다.

이 경계를 `ProcessAiPrivacyScanner`로 구현했다. 원문은 표준 입력의 JSON으로 전달하고 표준 출력·표준 오류는 별도로 읽는다. 입력·응답 크기와 실행 시간을 제한하며, 실패 시 직접 만든 Process의 실제 종료와 Stream·보조 Thread 회수를 확인한다. JSON을 출력했더라도 비정상 종료하거나 제한 시간 안에 끝나지 않으면 결과를 채택하지 않는다.

실제 자식 JVM은 통제된 검사 응답을 만드는 Fixture였다. 이를 PostgreSQL 처리 흐름에 연결해 정상 저장과 Timeout·잘못된 응답의 실패 저장, 원문·예약 보존·외부 전송 차단을 확인했다. 실제 탐지 모델의 정확도 검증과 Main Bean 조립은 별도로 남아 있다. [실행 보고서](../lab-reports/2026-10-19-privacy-process-transport.md)에 핵심 150개·전체 Java 754개 통과와 실행 범위를 정리했다.

## 핵심 질문

1. 가상 주소 공간이 3.34 GiB라면 512 MiB Container가 반드시 메모리 상한을 위반한 것인가?
2. AI 비활성 App의 현재 사용량으로 개인정보 검사·AI Worker가 포함된 전체 기능의 메모리를 판단할 수 있는가?
3. HTTP 접수 시간과 Worker Tick 시간, Job 전체 처리 시간은 무엇이 다른가?
4. 같은 Job의 여러 실행을 구분하려면 어떤 식별자를 함께 기록해야 하는가?
5. Service의 마지막 INSERT가 끝났어도 왜 Commit 실패가 가능한가? 접수 완료 Log는 언제 남겨야 하는가?
6. Commit 직후 Log를 쓰기 전에 Process가 종료되면, 완료 Log가 없다는 이유로 접수 Row도 없다고 볼 수 있는가?
7. 재시작 후에는 어떤 DB 상태를 확인해야 하며, Log가 없다는 이유로 예약 횟수를 초기화하거나 외부 AI를 다시 호출해도 되는가?
8. Connection 10개는 Job 10개나 Provider 10회 호출을 뜻하는가?
9. App 종료 뒤 Lock이 풀린 것과 다음 Worker가 외부 호출 권한을 얻은 것은 같은가?
10. DB의 `RUNNING`과 조회 HTTP 200만으로 해당 Worker가 살아 있다고 판단할 수 있는가?
11. 누적 횟수·시간이 남아 있는데 MAX가 0일 수 있는 이유는 무엇인가? 전체 HTTP 평균을 업무 API의 평균으로 사용할 수 있는가?
12. HTTP `SUCCESS`와 `job.status=FAILED`는 왜 동시에 나올 수 있는가?
13. Timeout 예외만으로 검사 자원 회수가 끝났다고 볼 수 있는가? 왜 직접 만든 Process만 종료해야 하는가?

## 이어갈 학습

실제 탐지 모델과 관계 보존 계약·실행 설정을 검토하고 Linux 종료·Main Bean 조립·전체 AI 자원 측정을 이어간다. Cloud 실행 상태와 AGENT HTTP Metric의 이번 근거는 유지하되 새 Log의 배포·대표 실패 추적과 실제 비용 검토는 남아 있다. 복원·Image Rollback의 기존 검증을 처음부터 반복하지 않는다.
