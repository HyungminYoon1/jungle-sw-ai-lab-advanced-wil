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

## 검증 결과를 어디까지 읽어야 하는가

Unit Test는 입력 제한과 개별 규칙을 확인한다. JAR를 패키징한 뒤의 Integration Test는 JAR 안의 자식 실행과 Spring 개인정보 Bean·수동 Worker Tick·실제 PostgreSQL·로컬 HTTP를 연결한다.

로컬 HTTP 서버가 정해 둔 AI 응답을 반환했다면 요청 Body와 저장 경계를 확인한 것이다. 실제 AI의 요약 품질·Provider의 실제 인증·자동 Scheduler의 주기 실행·AWS의 권한/Network까지 확인한 결과는 아니다. 각각 해당 구성으로 별도 검증한다.

## 핵심 질문

1. 로컬 Class를 Mount한 Linux Test가 통과하면 기존 ECR Image에도 새 코드가 들어간 것인가?
2. 개인정보 구성만 켜면 Provider와 Worker도 자동으로 실행되는가?
3. 외부 요청 0회인데 Attempt·예약은 1회로 남을 수 있는가? 이때 접수 원문은 어떻게 되는가?
4. 자식의 `-Xmx64m`은 App과 자식 Process를 합친 전체 메모리 상한인가?
5. 수동 Worker Tick과 로컬 HTTP Test의 성공으로 자동 Scheduler·실제 AI·Cloud 실행까지 확인했다고 말할 수 있는가?
