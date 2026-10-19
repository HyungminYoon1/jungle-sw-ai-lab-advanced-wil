# 10월 19일 메모리 수치와 HTTP 및 AI 작업의 Log

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

## 핵심 질문

1. 가상 주소 공간이 3.34 GiB라면 512 MiB Container가 반드시 메모리 상한을 위반한 것인가?
2. AI 비활성 App의 현재 사용량으로 개인정보 검사·AI Worker가 포함된 전체 기능의 메모리를 판단할 수 있는가?
3. HTTP 접수 시간과 Worker Tick 시간, Job 전체 처리 시간은 무엇이 다른가?
4. 같은 Job의 여러 실행을 구분하려면 어떤 식별자를 함께 기록해야 하는가?
5. Service의 마지막 INSERT가 끝났어도 왜 Commit 실패가 가능한가? 접수 완료 Log는 언제 남겨야 하는가?
6. Commit 직후 Log를 쓰기 전에 Process가 종료되면, 완료 Log가 없다는 이유로 접수 Row도 없다고 볼 수 있는가?
7. 재시작 후에는 어떤 DB 상태를 확인해야 하며, Log가 없다는 이유로 예약 횟수를 초기화하거나 외부 AI를 다시 호출해도 되는가?

## 이어갈 학습

Log의 부재와 DB 상태의 차이부터 설명해보고, 종료 중 DB Connection·Job·Attempt·예약을 관찰한다. 현재 Cloud 실행 상태·AGENT App Metric·비용을 확인하고 개인정보 처리 Adapter와 전체 AI 자원 측정을 이어간다. 복원·Image Rollback의 기존 검증을 처음부터 반복하지 않는다.
