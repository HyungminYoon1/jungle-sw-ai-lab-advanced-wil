# 10월 8일 학습 노트 — Docker 실행 환경과 데이터·설정의 수명

## JAR와 Image는 실행 중인 프로그램이 아니다

Java Source를 컴파일하고 필요한 라이브러리와 묶으면 실행 가능한 JAR가 만들어진다. JVM이 그 JAR를 실행할 때 Controller·Service·Repository·Worker 등의 객체가 메모리에 생긴다. Application을 종료해도 JAR 파일과 PostgreSQL에 Commit한 데이터는 남지만, JVM 안의 객체는 사라진다.

Docker Image도 실행에 필요한 파일과 시작 설정을 담은 것이다. Image를 Build했다는 것만으로 Helpdesk가 요청을 처리하는 것은 아니다. Image로 Container를 만들고 시작하면, 지정한 시작 명령이 JVM을 실행한다.

처음에는 Image를 Build하는 동안 Helpdesk도 실행하는 것이라고 생각했다. `RUN`은 Build 중 명령을 실행하고, `ENTRYPOINT`는 Container가 시작할 때 실행할 명령을 지정한다는 차이를 구분했다. 이 Dockerfile의 Build 단계에서는 Maven으로 JAR를 만들고, Container를 시작할 때 `java -jar`로 Helpdesk를 실행한다.

## Container를 중지해도 모든 것이 사라지지는 않는다

Container에는 실행 설정과 파일 공간이 있고, 실행 중일 때는 그 안의 Process도 있다. Container를 Stop하면 Process는 종료되지만 Container 자체와 쓰기 계층의 파일은 남을 수 있다. 같은 Container를 다시 Start하면 그 파일 공간을 사용하면서 새 JVM을 실행한다. 기존 JVM의 `HttpSession` 객체까지 이어서 사용하는 것은 아니다.

Pause는 Process를 종료하는 Stop과 다르다. 실행을 일시 중단했다가 Unpause하면 기존 Process를 재개한다. PC를 재부팅한 뒤에는 이전 JVM 메모리가 복원되지 않으며, Container의 자동 시작 여부는 Docker Engine과 Restart Policy에 달려 있다.

같은 Image에서 Container 두 개를 만들더라도 서로 다른 실행 환경이다. 두 JVM이 같은 PostgreSQL의 Row를 조회하는 것과 메모리의 Session을 공유하는 것은 다르다. Session 공유는 별도의 저장 방식과 설정이 있어야 한다.

## 프로그램, DB 데이터, 로그인 상태의 저장 위치

처음에는 Volume에 DB가 설치되어 있으니 Volume을 유지하면 된다고 생각했다. 정확히는 PostgreSQL 프로그램은 Image에 있고, PostgreSQL이 읽고 쓰는 데이터 파일을 Volume에 보관한다. 같은 Image를 사용해도 빈 데이터 공간으로 시작하면 이전 Ticket은 없다.

| 대상 | 저장 위치 | 다시 실행할 때 |
|---|---|---|
| Helpdesk JAR·Java 실행 환경 | App Image | 같은 Image에서 다시 사용할 수 있다. |
| PostgreSQL 프로그램 | DB Image | 새 DB Container에서 실행할 수 있다. |
| Commit된 Ticket·Message·Job | PostgreSQL 데이터 Volume | 같은 Volume을 연결한 PostgreSQL에서 읽는다. |
| 로그인 사용자·`HttpSession` | 이번 구성의 App JVM 메모리 | App을 재시작하면 새로 구성하거나 다시 로그인해야 한다. |

App이 DB 데이터 파일을 직접 읽는 것도 아니다. App의 JDBC Repository가 PostgreSQL에 연결하고, PostgreSQL이 Volume의 파일을 관리한다. App Container를 교체할 때 DB Volume을 새 App에 직접 연결할 필요는 없다.

실험에서는 DB Container만 교체했을 때 같은 Volume의 Row가 남았고, 계속 실행 중인 App의 기존 AGENT Session으로 조회할 수 있었다. 반대로 DB를 유지하고 App만 Stop·Start했을 때는 Row가 남았지만, 기존 Cookie로 조회하면 `401`이었다. 재로그인한 뒤 같은 Ticket은 `200`으로 조회됐다.

처음에는 서버의 Cookie 상태가 갱신되지 않은 문제라고 생각했다. Browser 쪽에 Session ID가 남아 있어도 새 JVM에는 그 ID에 대응하는 `HttpSession`이 없다는 것이 원인이었다. 가입자 수와 Session 수가 반드시 같지는 않지만, 현재 방식에서는 유효한 여러 Session과 그 내부 객체가 App JVM의 메모리를 사용한다.

## Container 안의 주소와 준비 완료 조건

App Container 안의 `localhost`는 App 자신의 Network 환경을 가리킨다. 별도 DB Container에 연결하려면 같은 Compose Network의 Service 이름인 `db:5432`를 사용한다. PC에서 App으로 들어가는 Host Port와 App 내부의 `8080`도 구분해야 한다.

DB Port를 Host에 게시하지 않아도 같은 Compose Network의 App에서 DB에 연결할 수 있다. 다만 같은 Network라는 사실만으로 DB Process가 준비됐거나 접속 계정이 올바르다는 것까지 알 수는 없다.

다음 네 단계는 각각 확인 대상이 다르다.

1. PostgreSQL의 최초 초기화 SQL은 App용 DB 계정과 권한을 준비한다.
2. `pg_isready` Healthcheck는 DB가 연결을 받을 준비가 됐는지 확인한다.
3. App의 Flyway는 필요한 Table과 Migration 이력을 준비한다.
4. 접수 Service의 Transaction이 Commit되면 Ticket·Message·Job Row가 남는다.

같은 Volume을 다시 연결하면 최초 초기화 SQL이 반복 실행되지 않는다. Compose의 Password 값을 바꾸는 것만으로 기존 DB 계정의 Password가 바뀌는 것은 아니며, DB 계정과 App에 전달할 접속 설정을 함께 맞춰야 한다.

## Multi-stage Build와 Cache

Build 단계에는 JDK와 Maven Wrapper가 필요하지만, 완성된 JAR를 실행할 최종 Image에는 Java 실행 환경과 JAR를 둔다. Maven이나 Java Source가 JAR 안에 들어 있어서 실행 가능한 것이 아니라, JVM이 컴파일된 Class를 실행하는 것이다.

Build Context에 있는 파일이 모두 Image에 들어가지는 않는다. Context는 Build에서 사용할 수 있는 파일의 범위이고, `COPY`가 실제 복사할 파일을 고른다. `.gitignore`는 Git 추적을 제어하며 Docker Build의 제외 규칙은 `.dockerignore`에서 따로 관리한다.

Cache 실험에서는 POM과 Wrapper로 의존성을 먼저 준비한 뒤 Source를 복사했다. Source만 바꾸면 앞의 의존성 준비 결과를 재사용하고 패키징은 다시 수행했다. POM의 의존성을 바꾸면 두 Maven 명령을 모두 다시 실행했다.

처음에는 Source를 먼저 복사하면 의존성 준비에 문제가 생길 수 있다고 생각했다. 순서를 바꾼 비교에서도 Build는 성공했다. 의존성 준비를 앞에 두는 이유는 Source 수정 때문에 같은 준비 작업을 반복하지 않도록 Cache를 재사용하기 위해서였다.

이번 Image Build는 `-DskipTests package`로 패키징했다. JAR와 Image 생성 성공은 이번 변경 뒤 전체 Test를 다시 통과했다는 뜻이 아니다.

## 같은 Image와 다른 실행 설정

Java 코드가 바뀌면 새 JAR와 Image가 필요하다. 반면 DB 주소·CORS 허용 Origin처럼 실행 시 전달하는 설정만 바뀌면 같은 Image로 새 설정의 Container를 만들 수 있다.

처음에는 Port나 Schema가 그대로여서 설정이 유지되는 것이라고 생각했다. 실제 이유는 Container를 생성할 때 전달한 환경 변수가 그 Container의 설정으로 남기 때문이다. Host에서 값을 바꾸고 같은 Container를 Stop·Start하면 JVM과 Bean은 새로 만들어져도 기존 Container의 값을 읽는다.

비교 실험에서도 Host의 CORS 설정 변경 후 Stop·Start만 했을 때는 이전 Origin이 계속 허용됐다. 같은 Image로 App을 재생성한 뒤에야 새 Origin이 허용됐다. DB Container·Volume·Row는 그대로였다. **새 객체를 만드는 것과 새 설정을 전달하는 것은 별개의 일**이다.

## Worker 활성화와 Secret 전달

문의 접수와 AI 처리는 분리되어 있다. Worker를 끈 구성에서는 AI Key 없이 문의를 저장하고 `PENDING` Job을 남길 수 있다. 그러나 접수에 필요한 DB·로그인 설정까지 없어도 된다는 뜻은 아니다.

Compose의 필수 변수 검사에서는 DB 관리자·App Password와 USER·AGENT의 Username·Password, 총 6개를 각각 미설정·빈 문자열로 바꿨다. 12개 Case 모두 설정 해석 단계에서 거부됐다. 이 검사는 값의 존재를 확인한 것으로, 실제 DB 접속이나 Password의 유효성을 확인하는 검사는 아니다.

Worker 활성화 값이 `true`라고 필요한 Provider 객체가 자동으로 생기는 것도 아니다. Spring이 Provider·개인정보 처리기·출력 검증기와 Worker를 조립할 수 있어야 한다. 기존 설정 Test에서도 Provider 객체가 없는 활성 구성의 기동 실패를 확인했다.

AI Key는 PostgreSQL이 아니라 AI에 요청하는 App에만 제공해야 한다. Image에 Key를 넣으면 Image와 함께 전달될 수 있으므로 실행할 때 따로 주입한다. Secret 파일을 App에 제공해도 그 자체로 AI 호출이 가능해지는 것은 아니다.

연결할 단계는 **파일 제공 → Spring 설정으로 읽기 → Provider 객체에 전달하기**다. Compose의 Secret 기능은 파일을 제공하고, Spring의 `configtree:` 같은 설정 읽기 방식은 파일 값을 Property로 읽는다. Provider를 등록하는 Configuration은 그 값을 실제 Provider 객체에 전달해야 한다. 이 배포용 연결은 다음 구현에서 확인할 부분이다.

## 이번에 확인한 실험

| 실험 | 확인한 결과 |
|---|---|
| Image Build·Cache 비교 | 입력 무변경·Source 변경·POM 변경·복사 순서에 따른 재사용과 재실행, 최종 Image의 JRE·JAR 구성 |
| Compose 실제 HTTP·PostgreSQL | Migration 7건, 정상 접수 `201`·Ticket·Message·Job 각 1건, CSRF 누락 `403`·저장 0건, USER 조회 `403`·AGENT 조회 `200` |
| DB 교체와 App 재시작 | 같은 Volume의 Row 보존, App을 유지한 경우 Session 유지, App 재시작 뒤 재로그인 필요 |
| 실행 설정 비교 | 같은 Container 재시작은 기존 값 유지, 같은 Image의 새 Container는 새 값 적용 |
| 설정 검사 | 필수 값 누락·빈 문자열 12개 거부, 기존 Spring Worker 설정 Test 7개 통과 |

실행 결과는 Codex가 구성한 최소 실험과 함께 확인했고, 저장 위치와 수명·예상 결과는 문답으로 구분했다. 이번 Compose 요청은 실제 HTTP Client를 사용했으며 Browser E2E나 실제 AI 호출은 진행하지 않았다. 실행 날짜·명령·상세 결과는 [Image Build 보고서](../lab-reports/2026-10-08-docker-image-build-and-cache-baseline.md)와 [Compose 보고서](../lab-reports/2026-10-08-compose-http-postgresql-baseline.md)에 정리했다.

## 다시 설명해볼 핵심 질문

1. JAR·Image가 디스크에 있다는 것과 JVM이 실행 중이라는 것은 어떻게 다른가?
2. 같은 Container의 Stop·Start에서 파일과 `HttpSession`은 각각 어떻게 되는가?
3. 같은 Image를 사용하는 두 App이 같은 DB를 조회해도 Session은 자동으로 공유되지 않는 이유는 무엇인가?
4. DB Container만 교체할 때 같은 Volume이 필요한 이유와, 새 App에 그 Volume을 직접 연결하지 않는 이유는 무엇인가?
5. `localhost`·Compose의 `db:5432`·Host 게시 Port는 각각 어느 실행 환경의 주소인가?
6. DB Healthcheck·최초 초기화·Flyway·접수 Commit은 각각 무엇을 확인하거나 변경하는가?
7. Source만 바꾼 Build와 POM을 바꾼 Build에서 Cache 재사용 범위가 다른 이유는 무엇인가?
8. Host의 환경 변수를 바꾼 뒤 App을 Stop·Start하는 것만으로 새 설정이 적용되지 않는 이유는 무엇인가?
9. Worker 비활성 구성에서 AI Key는 없어도 되지만, DB 연결 설정은 필요한 이유는 무엇인가?
10. Secret 파일을 App에 제공한 뒤 Spring 설정과 Provider 객체에는 어떤 연결이 더 필요한가?

## 다음 학습

배포용 Provider·개인정보 처리기·검증기·Worker와 Secret 읽기 구성을 연결하고, 정상 구성과 누락된 설정을 구분하는 Test를 추가한다. 이어서 Process·Signal·종료 처리, CI·IAM·Cloud·HTTPS·관측·복구를 진행한다. 남은 범위와 일정은 [Week 8 주간 계획](../weekly-plan.md)을 따른다.
