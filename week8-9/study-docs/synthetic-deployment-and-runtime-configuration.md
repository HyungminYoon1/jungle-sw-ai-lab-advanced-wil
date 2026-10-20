# 합성 배포 실험과 실행 설정

## 코드와 실행 설정은 역할이 다르다

Image에는 JAR와 실행에 필요한 파일이 들어 있다. 새 Java 코드를 로컬에서 Test해도 이미 만들어진 Image의 JAR는 바뀌지 않는다. 새 코드를 배포하려면 새 Image를 Build·검증하고 ECR에 업로드한 뒤, 그 Digest를 사용하는 새 Task를 시작해야 한다.

반면 기존 코드가 읽는 Secret·시간 상한·Profile 같은 값만 바꾼다면 같은 Image를 사용할 수 있다. 새 Task의 JVM이 그 설정을 읽어 객체를 새로 만든다. 이미 실행 중인 JVM의 객체가 저절로 새 설정으로 바뀌는 것은 아니다.

현재 Class를 Container에 Mount해 Test하는 것은 그 Code와 Linux Runtime의 조합을 확인하는 방법이다. Image 안의 JAR가 같은 Code를 포함한다는 확인과는 다르다.

## 부품을 등록하는 것과 일을 시작하는 것은 다르다

Helpdesk의 구성은 각각 다른 역할을 가진다.

| 구성 | 역할 |
|---|---|
| Profile | 어떤 실행용 구성을 사용할지 선택 |
| 개인정보 구성 | 입력 제한·검사 Process·V1 검증·마스킹·Guard 조립 |
| Provider 구성 | 외부 AI에 요청할 Adapter와 필수 설정 조립 |
| Worker 구성 | DB Job을 찾아 실행하는 처리기와 Scheduler 조립 |

개인정보 구성만 켰다고 Provider나 Worker가 자동으로 활성화되지 않는다. Provider가 있어도 Worker가 꺼져 있으면 PENDING Job을 자동 처리하지 않는다. 반대로 Worker만 켰는데 필요한 Preparer나 Provider가 없으면 기동 단계에서 실패해야 한다.

## 고정 합성 입력으로 무엇을 확인하는가

배포 실행 경로와 일반 개인정보 탐지 정확도는 다른 문제다. 모델 품질을 개선하는 동안에도 실행 설정·Process·HTTP·DB 연결을 확인할 수 있도록, 별도 합성 실험 구성을 사용한다.

이 구성은 제목·본문이 정해 둔 합성 문의 한 건과 정확히 같은 경우만 허용한다. 한 글자나 공백이 달라도 거부한다. 고정 합성 이메일의 위치를 알고 있다는 사실을 이용하므로 새로운 개인정보를 찾아내는 일반 탐지기가 아니다.

```text
접수한 원문을 DB에서 읽음
  → 고정 합성 입력과 정확히 일치하는지 확인
  → 자식 검사 Process 실행·종료 확인
  → V1 JSON·위치 검증과 복사본 치환
  → Guard로 실제 전송 Body 확인
  → Provider 요청·출력 검증·제안 저장
```

허용 범위 밖 입력은 자식 검사 Process와 외부 AI를 실행하지 않는다. 허용 입력도 검사 Timeout·잘못된 응답·실행권 상실이 발생하면 기존 실패 규칙을 따른다. 합성 실험의 성공만으로 임의 고객 문의의 AI 처리를 켜서는 안 된다.

## AI를 보내지 않았는데 예약은 왜 남는가

접수 Transaction은 Ticket·Message·PENDING Job을 함께 Commit한다. Worker는 별도 Transaction에서 실행권과 호출 한도 한 회분을 예약한 뒤 개인정보 검사를 수행한다.

따라서 검사에서 거부되면 외부 HTTP 전송은 0회여도 예약은 1회로 남을 수 있다. 예약은 외부 AI가 실제로 실행됐다는 영수증이 아니라 서버가 호출 권한을 확보한 기록이다. 실패한 검사 때문에 이미 접수한 원문을 취소하거나 예약을 임의로 초기화하지 않는다.

이 실험 구성의 허용 범위 밖 입력은 기존 내부 실패 코드 `ADAPTER_CONFIGURATION_ERROR`로 기록한다. 개인정보 JSON이 잘못됐다는 뜻도, AI가 거부 응답을 보냈다는 뜻도 아니다. 일반 입력을 지원하지 않는 구성에 해당 입력이 배정됐다는 의미다.

## Heap 상한과 전체 메모리는 다르다

App JVM과 검사 자식 JVM은 서로 다른 Process다. 자식에 `-Xmx64m`을 지정하면 자식 Java Heap의 상한을 정한 것이다. 자식의 Heap 밖 메모리와 부모 App의 메모리까지 합쳐 64 MiB로 제한하는 설정이 아니다.

Task·Container 크기를 정할 때는 App·Worker·검사 Process를 함께 실행한 현재 메모리와 Peak를 확인해야 한다. CPU 제한·반복 처리·Timeout 뒤 실제 Process와 Thread 회수도 함께 관찰한다. 모델이 없는 합성 실험의 측정값은 향후 실제 모델을 넣은 구성의 사양을 보장하지 않는다.

### 모델을 어디에서 실행하는지 구분한다

여기서 추가 자원 검증이 필요한 모델은 Task 안에서 실행할 로컬 개인정보 탐지 모델이다. 합성 검사기는 정해 둔 이메일 위치만 반환하므로 모델 가중치를 읽거나 추론하지 않는다. 이를 실제 로컬 모델로 교체하면 모델 로딩과 추론의 RAM·CPU가 추가되므로 같은 입력 길이만으로 자원 사용량이 같다고 볼 수 없다.

반면 OpenAI API의 요약 모델은 Provider 서버에서 실행한다. Helpdesk Task가 그 모델의 가중치를 다운로드해 올리는 것은 아니다. Task에서는 HTTP 요청·응답 처리, JSON 검증과 저장에 필요한 자원을 사용한다. 외부 API를 호출하는 경우와 로컬 모델을 함께 실행하는 경우의 Task 사양을 구분해야 한다.

### 현재 사용량과 최고 사용량을 구분한다

`memory.current`는 읽는 시점의 cgroup 사용량이고, `memory.peak`는 최고 사용량이다. 부모 App과 자식 JVM이 같은 Container에 있으면 해당 cgroup이 관리하는 메모리를 함께 관찰할 수 있다. Heap 밖의 메모리와 파일 Cache도 고려해야 한다. [Linux cgroup v2 메모리 Counter](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html#memory-interface-files)

검사 자식이 종료된 뒤 현재 사용량이 줄어도 Peak는 높은 값으로 남을 수 있다. 처리 전보다 사용량이 조금 높다는 사실만으로 누수라고 단정하지 않는다. 초기화가 늦게 이루어지는 Client·JIT·Cache·아직 회수하지 않은 객체 등이 있을 수 있다. 반복 처리 추세와 실제 살아 있는 Process·Thread를 함께 확인한다.

Memory와 Memory+Swap 상한을 같은 값으로 주면 추가 Swap을 허용하지 않는 Docker 설정이 된다. 한도 안에서 한 번 성공한 결과만으로 장시간·동시 처리까지 보장하지는 않는다. [Docker 메모리와 Swap 제한](https://docs.docker.com/engine/containers/resource_constraints/#--memory-swap-details)

## 검사 결과와 실행 완료를 함께 확인한다

현재 Process Transport는 결과를 끝까지 읽고 자식의 정상 종료까지 확인해야 문자열을 반환한다. JSON을 출력했지만 stdout을 열어 둔 채 계속 실행한다면 아직 끝난 검사가 아니다. 정상 JSON 뒤 Exit Code 7로 끝나도 현재 계약의 실행 성공 조건인 0을 만족하지 못하므로 채택하지 않는다.

Timeout은 기다릴 수 있는 시간이 끝났다는 뜻이지 자식의 종료를 보장하는 명령이 아니다. 직접 시작한 Process의 실제 종료, Pipe 닫힘과 보조 Thread 회수를 확인해야 한다. 예외 하나가 발생한 것과 자원 회수가 끝난 것은 구분한다.

실패 처리는 접수와 별개다. 원래 Ticket·Message는 유지하고 현재 Job의 실패를 별도 Transaction으로 저장하며, 검사를 통과하지 않은 입력은 Provider로 보내지 않는다. 실패 저장의 Commit도 확인해야 하며 예약을 임의로 초기화하지 않는다. App이 계속 응답하는 것과 해당 AI Job이 성공한 것도 다른 판단이다.

## 검증 결과를 어디까지 읽어야 하는가

Unit Test는 입력 제한과 개별 규칙을 확인한다. JAR를 패키징한 뒤의 Integration Test는 JAR 안의 자식 실행과 Spring 개인정보 Bean·수동 Worker Tick·실제 PostgreSQL·로컬 HTTP를 연결한다.

로컬 HTTP 서버가 정해 둔 AI 응답을 반환했다면 요청 Body와 저장 경계를 확인한 것이다. 실제 AI의 요약 품질·Provider의 실제 인증·자동 Scheduler의 주기 실행·AWS의 권한/Network까지 확인한 결과는 아니다. 각각 해당 구성으로 별도 검증한다.

## 핵심 질문

1. 로컬 Class를 Mount한 Linux Test가 통과하면 기존 ECR Image에도 새 코드가 들어간 것인가?
2. 개인정보 구성만 켜면 Provider와 Worker도 자동으로 실행되는가?
3. 외부 요청 0회인데 Attempt·예약은 1회로 남을 수 있는가? 이때 접수 원문은 어떻게 되는가?
4. 자식의 `-Xmx64m`은 App과 자식 Process를 합친 전체 메모리 상한인가?
5. 수동 Worker Tick과 로컬 HTTP Test의 성공으로 자동 Scheduler·실제 AI·Cloud 실행까지 확인했다고 말할 수 있는가?
6. 로컬 개인정보 모델과 외부 OpenAI 모델은 각각 어느 서버의 RAM·CPU로 추론하는가?
7. 자식 Process가 종료됐는데 Peak가 그대로 남았다는 이유만으로 메모리 누수라고 볼 수 있는가?
8. 정상 JSON을 출력한 뒤 종료하지 않거나 Exit Code 7로 끝났다면 왜 결과를 채택할 수 없는가? Timeout 예외만으로 자원 회수를 완료 처리해도 되는가?
