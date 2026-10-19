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

## Exit Code와 검사 결과를 구분한다

Exit Code가 7이라는 말만으로는 어떤 오류인지 알기 어려웠다. 종료 코드는 Process가 끝날 때 부모에게 남기는 정수 결과이고, 7의 뜻은 실행한 프로그램이 정한다. 이번 Test에서는 `System.exit(7)`로 검사 실패를 만들었다. 프로그램이 충돌한 것이 아니라 의도적으로 실패 결과를 보고한 경우다.

현재 검사기 계약은 0만 실행 성공으로 인정하므로, JSON이 정상이어도 7로 종료했다면 결과를 사용하지 않는다. Helpdesk App은 별도 Process이므로 검사 실패를 기록하고 계속 실행할 수 있다. 종료 코드 0과 JSON 검증을 통과했는데도 이름을 놓쳤다면, 이는 실행 완료와 별개인 탐지 정확도 문제다.

## 실행 성공과 탐지 품질을 따로 평가한다

다른 작은 한국어 개인정보 모델을 같은 합성 문의 12건으로 비교했다. 실험은 종료 코드 0으로 끝났지만, 정확한 범위·종류·보존 조건을 모두 만족한 것은 5건이었다. 4건은 Token Label 연결이 이번 Decoder 계약에 맞지 않아 거부됐다. 종료 코드 0만으로 모델이 개인정보를 정확하게 찾았다고 볼 수 없다.

이름 뒤의 `님`까지 가린 것은 과도한 마스킹이고, 이름을 그대로 노출한 것은 개인정보 탐지 누락이다. 두 결과를 같은 문제로 묶지 않는다. 일반 문구인 `제 이름`을 인명으로 잡은 오탐도 있었다. 업무 문구의 일부 보존 검사가 참이어도 모든 표현을 정확하게 보존했다는 뜻은 아니다.

이번 후보도 Main에 연결하지 않았다. 실제 결과와 자원은 [후보 비교 보고서](../lab-reports/2026-10-19-koelectra-privacy-probe.md)에 분리했고, 이름 탐지·관계 보존·추가 입력 평가와 전체 App 자원 검증을 이어가야 한다.

## 같은 이름과 동일인을 구분한다

고객과 직원의 이름이 같아도 원문이 동명이인이라고 명시했다면 서로 다른 사람으로 구분해야 한다. 다른 문의에 같은 이름이 다시 등장했다는 이유만으로 앞선 문의의 사람과 연결해서도 안 된다. 마스킹의 A·B는 문의 안의 임시 표시이지 실제 고객 ID가 아니다.

동일인인지 판단하기 어렵다고 명시했다면 이름을 가리고 관계 미확인을 유지하는 것이 적절하다. 관계 항목을 빠뜨렸다면 계약 위반으로 거부해야 한다. 명시적인 판단 보류와 누락은 다르며, 서버가 임의로 판단 보류 값을 채우지 않는다.

[인물 관계 계약 초안](../../plan/privacy-person-relations-v2-draft.md)의 구조 검증기를 V1과 분리해 구현했다. A=B·B=C인데 A≠C라고 하면 SAME의 추이 관계와 모순되므로 거부해야 한다. 반면 원문의 동명이인 정보를 모델이 일관된 SAME으로 잘못 해석한 경우는 구조 검증을 통과할 수 있으므로 모델 내용 평가에서 찾아야 한다.

## 이름을 가려도 관계는 남긴다

독립 치환기는 SAME으로 보고된 위치에 같은 `[PERSON_1]`을 쓴다. 다른 SAME 집합은 다른 표시로 구분하되, 그 사이의 DIFFERENT·UNDETERMINED도 함께 반환한다. 표시가 다르다는 이유로 미확인 관계까지 다른 사람이라고 단정하지 않는다. 이름 뒤의 `님`, 복구 사실·인원·마감 등 치환 범위 밖의 문자는 그대로 둔다.

검증과 치환에는 같은 원문 문자열을 사용한다. 원문에 서버 표시와 충돌하는 `[PERSON_`가 있으면 AI 준비 결과를 거부하고, 접수 원문을 고치거나 검사 없이 보내지 않는다. 반환값에는 이름 역변환 목록·원본 위치를 넣지 않으며 다른 문의와 신원을 연결하지 않는다.

치환 Test 37개와 기존 핵심 회귀를 합친 439개가 통과했다. [검증 보고서](../lab-reports/2026-10-19-person-relation-v2-validation.md)에 범위를 정리했다. Guard·실제 전송 Body·모델·Main 연결은 남아 있고, 이 Test가 실제 모델의 인물 관계 판단을 개선한 것은 아니다.

## 배포 학습과 개인정보 고도화를 구분한다

8–9주차의 중심은 기존 기능의 배포·실행 설정·관측·복구다. 이름 탐지 정확도와 관계 V2 설계로 배포 학습이 계속 밀리는 것은 목표와 맞지 않아 후속 과업으로 분리했다. 기존 보호 정책을 없애는 대신, 고정 합성 입력의 제한된 배포 실험과 일반 입력으로의 확장을 구분한다.

먼저 같은 Process Test를 Linux에서 실행했다. CPU 1개와 0.25개, 512 MiB 제한에서 각각 24개가 통과했다. Timeout·호출 중단 뒤 소유 Process와 보조 Thread를 정리하고 다른 Process는 남기는 조건도 확인했다. 모델을 더 정확하게 만드는 작업이 아니라, 실행 환경을 바꿨을 때 기존 실행 제어가 동작하는지 확인한 것이다.

이번 실행은 현재 컴파일 Class를 읽기 전용으로 Mount했다. 기존 Image의 JAR에 새 코드가 포함됐다는 확인과는 다르다. 28.988초·42.016초도 각 JVM 기동과 Test 24개 전체 시간이지 개인정보 검사 한 번의 시간은 아니다. [Linux 실행 보고서](../lab-reports/2026-10-19-linux-process-transport.md)에 조건과 재현 명령을 정리했다. 전체 Spring App·Worker·모델의 자원 검증은 별도로 남아 있다.

## 합성 전용 실행 구성을 연결한다

새 코드를 포함한 배포에는 새 Image와 Task가 필요하다. 현재 Class를 Mount한 Test를 통과했다고 기존 ECR Image까지 바뀌는 것은 아니다. AI 전송을 거부하는 경우에도 먼저 Commit한 Ticket·Message는 유지해야 한다고 설명할 수 있었다.

배포에 필요한 최소 구성은 `postgres,deployment,synthetic-ai` Profile과 별도 활성 값이 모두 있을 때만 등록했다. 제목·본문 전체가 고정 합성 문의와 정확히 일치해야 하며, 범위 밖 입력은 자식 Process 실행 전에 거부한다. Provider와 Worker는 별도 활성 설정이므로 개인정보 Bean 등록만으로 자동 호출이 시작되지 않는다.

고정 합성 이메일 위치를 반환하는 자식 Java 프로그램을 같은 JAR에 넣었다. 실제 탐지 모델을 채택한 것이 아니라 실행 경로를 확인하기 위한 구성이다. V1 JSON·위치 검증과 Guard는 유지했고 V2는 연결하지 않았다.

새 Unit Test 41개와 패키징한 JAR·Spring 개인정보 Bean·수동 Worker Tick·실제 PostgreSQL·로컬 HTTP를 연결한 두 Case가 통과했다. 허용한 문의는 이메일이 가려진 요청과 제안 1건을 확인했다. 범위 밖 문의는 HTTP 0회·제안 0건이고, 원문·작성자·Ticket OPEN·Attempt/예약 1회가 남았다. 반복 Tick에서도 새 호출은 없었다.

예약과 실제 호출은 다른 기록이다. 개인정보 검사 전에 한 회분 예약을 Commit했기 때문에 검사에서 거부돼도 예약이 남을 수 있다. 이를 초기화하거나 접수 원문을 취소하지 않는다. 허용 범위 밖 입력은 기존 내부 `ADAPTER_CONFIGURATION_ERROR`로 기록하며 JSON 오류나 Timeout으로 바꾸지 않는다.

자식의 `-Xmx64m`은 자식 Heap의 상한이다. App JVM과 자식의 Heap 밖 메모리까지 합친 Task 전체 상한은 아니다. 다음은 새 Image에서 전체 실행 조립과 자원을 확인하는 단계다. [합성 구성 학습자료](../study-docs/synthetic-deployment-and-runtime-configuration.md)와 [구성 결정](../../plan/decisions/0010-fixed-synthetic-deployment-configuration.md)에 개념과 적용 범위를 정리했다.

전체 `verify`는 Java 1,004개와 패키징 후 2개, JavaScript는 268개가 통과했다. 마지막으로 Provider 호출 횟수와 HTTP 횟수를 각각 확인하도록 통합 Test 두 Case를 보강해 다시 통과했다. [실행 보고서](../lab-reports/2026-10-19-synthetic-deployment-configuration.md)에 Windows 자식 JVM·수동 Tick·로컬 응답과 미실행 Linux Image·전체 자동 조립·실제 AI·Cloud를 구분했다.

## 모델 실행 위치와 전체 자원을 구분한다

자식 `-Xmx64m`이 App 전체 메모리를 제한하느냐는 질문에는 아니라고 답했다. 합성 검사기의 측정값으로 실제 모델까지 포함한 Task 사양을 확정할 수 있느냐는 질문에는 아직 잘 모르겠다고 답했다.

추가 설명에서는 모델의 실행 위치부터 구분했다. Task 안에서 실행할 로컬 개인정보 탐지 모델은 해당 Task의 RAM·CPU를 사용한다. 외부 OpenAI 요약 모델은 Provider 서버에서 실행하며 가중치를 Helpdesk Task에 올리지 않는다. 합성 검사기는 정해 둔 위치만 반환하므로 로컬 모델의 로딩·추론 자원이 빠져 있다.

새 Image에서 자동 Worker·합성 검사 자식 JVM·PostgreSQL을 연결한 독립 실험 두 번을 진행했다. 외부 AI 대신 로컬 응답을 사용했다. 각 실행에서 문의 세 건은 자동 성공하고 범위 밖 한 건은 전송 없이 실패했다. 원문·합성 작성자·예약은 유지했다. Service 직접 접수이므로 인증 작성자 선택이나 Browser 흐름을 새로 검증한 것은 아니다.

0.25 CPU·512 MiB에서 최고 메모리는 310.79·290.21 MiB였고 OOM은 없었다. 처리 뒤 검사 자식 Process와 개인정보 I/O Thread도 남지 않았다. 현재 사용량이 줄어도 Peak는 이전 최고값으로 남을 수 있고, 처리 전후의 차이만으로 메모리 누수나 개선 효과를 단정하지 않는다.

실제 값과 측정 범위는 [자원 실행 보고서](../lab-reports/2026-10-19-synthetic-runtime-resources.md), 실행 위치·메모리 해석은 [개념 자료](../study-docs/synthetic-deployment-and-runtime-configuration.md)에 정리했다. Java 관련 회귀 124개·JavaScript 전체 276개도 통과했다. 이번에는 전체 Java·원격 CI·실제 AI·AWS를 다시 실행하지 않았다.

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
14. Exit Code 7의 의미는 어디서 정하는가? 종료 코드 0만으로 개인정보 탐지까지 정확했다고 판단할 수 있는가?
15. 이름 누락과 이름 뒤의 `님`까지 가린 결과는 왜 다른 문제인가? 거부된 Case를 빼고 전체 탐지 품질이 좋아졌다고 말해도 되는가?
16. 명시적인 UNDETERMINED와 관계 항목 누락은 각각 어떻게 처리해야 하는가?
17. A=B·B=C·A≠C인 관계표와 원문에 맞지 않는 일관된 SAME은 각각 어떤 검증에서 문제를 확인할 수 있는가?
18. 다른 치환 표시와 UNDETERMINED가 함께 있다면 무엇을 알고 무엇은 모르는 상태인가? 후속 치환이 표시를 바꾸면 관계표도 그대로 읽을 수 있는가?
19. 현재 Class를 읽기 전용 Mount해 Linux Test에 성공했다면, 기존 ECR Image 안의 JAR도 새 Code를 포함한다고 말할 수 있는가?
20. JVM 기동과 24개 Test 전체의 시간을 개인정보 검사 1회의 Timeout 설정에 그대로 사용해도 되는가?
21. 개인정보 Bean을 등록하면 Provider와 Worker도 자동으로 실행되는가?
22. 검사 거부로 외부 요청이 0회인데도 Attempt·예약은 1회로 남을 수 있는가? 접수 원문도 취소해야 하는가?
23. 자식 JVM의 `-Xmx64m`만으로 App·자식을 합친 전체 메모리 상한을 판단할 수 있는가?
24. 로컬 개인정보 모델과 외부 OpenAI 모델의 추론 자원은 각각 어디에서 사용되는가?
25. 합성 검사기의 Peak로 실제 로컬 모델을 포함한 사양을 확정할 수 있는가? 현재 메모리와 Peak의 차이는 무엇인가?

## 이어갈 학습

다음은 남은 통합 Timeout/비정상 종료의 자원 확인, 새 Log의 Cloud 검증과 실제 비용·보관량, 남은 DNS·회귀·WIL이다. 새 Image의 합성 구성에서는 자동 Worker·자식 정상 실행과 자원을 확인했지만 일반 Provider Configuration/실제 Key·로컬 개인정보 모델·실제 AI·Cloud의 결과와는 구분한다. V1 검증·Guard·실패 차단을 유지하며 V2·모델 고도화는 후속으로 남긴다. 새 Push·CI/ECR·Cloud 변경은 실행 범위를 확인한 뒤 진행하며 복원·Image Rollback 전체를 처음부터 반복하지 않는다.
