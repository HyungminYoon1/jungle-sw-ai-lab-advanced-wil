# Docker Image와 Container 그리고 Compose와 Volume

Docker는 Java와 PostgreSQL을 대신하는 기술이 아니다. 프로그램에 필요한 파일과 실행 환경을 Image로 묶고, 그 Image에서 격리된 실행 환경인 Container를 만든다. Helpdesk를 Container로 옮겨도 Controller·Service·Repository의 책임과 PostgreSQL의 저장 역할은 유지된다.

먼저 **실행에 필요한 파일**, **실행 중인 Process와 메모리**, **보존해야 할 데이터**를 구분한다. 이 세 가지를 구분하면 Image를 다시 만들거나 Container를 교체했을 때 무엇이 남는지도 설명할 수 있다.

## Java Source에서 실행 중인 Application까지

Java Source는 사람이 작성하는 프로그램이고, 컴파일한 Class는 JVM이 실행할 수 있는 코드다. Spring Boot의 실행 가능한 JAR에는 Application Class와 필요한 라이브러리 등이 들어간다.

```text
Java Source
    │ 컴파일과 패키징
    ▼
실행 가능한 JAR
    │ java -jar로 실행
    ▼
JVM Process
    └─ Spring ApplicationContext
       ├─ Controller와 Service
       ├─ Repository와 DB Connection
       └─ 활성화한 Worker와 관련 객체
```

Process는 운영체제에서 실행 중인 프로그램이다. JAR 파일이 디스크에 있다는 것과 Application이 실행 중이라는 것은 다르다. Java 실행 명령으로 JVM Process가 시작되어야 Spring이 메모리에 Bean을 만들고 요청을 처리할 수 있다.

### JAR에 들어가는 코드와 Maven의 역할

Java Source는 사람이 작성한 코드이고, Class는 그 Source를 컴파일한 Bytecode다. JVM은 컴파일된 코드를 실행한다. Maven은 의존성 준비·컴파일·패키징 등 Build 과정을 진행하는 도구다.

Spring Boot의 실행 가능한 JAR에는 Application Class·실행에 필요한 라이브러리·Resource 등이 들어간다. 기본 패키징에서 Java Source나 Maven 프로그램을 그대로 JAR에 넣는 것은 아니다. [Spring Boot JAR 구조](https://docs.spring.io/spring-boot/specification/executable-jar/nested-jars.html)

- `BOOT-INF/classes`: Application Class와 Resource
- `BOOT-INF/lib`: 의존성 라이브러리 JAR
- `META-INF/maven`: 포함될 수 있는 POM 등 Build Metadata. Maven 실행 프로그램 자체가 아님

완성된 JAR를 실행할 때 Maven이 필요 없는 이유는 JAR 안에 Maven이 있기 때문이 아니다. 이미 컴파일과 패키징을 마쳤으므로 JVM이 그 결과물을 실행할 수 있기 때문이다. Java 실행 환경은 별도로 필요하다.

## Image와 Container의 차이

App Image에는 Java Runtime, JAR, 필요한 기본 파일과 시작 명령을 담을 수 있다. Image는 실행에 사용할 패키지이며, 실행 중인 JVM의 메모리를 담은 것이 아니다. 만들어진 Image 자체는 불변이며 파일을 바꾸려면 새 Image를 만든다. [Docker Image 개념](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-an-image/)

```text
App Image
├─ Java Runtime
├─ helpdesk.jar
└─ 시작 명령: java -jar helpdesk.jar
       │
       ├─ Container A 실행
       │  └─ JVM A와 Spring 객체 A
       │
       └─ Container B 실행
          └─ JVM B와 Spring 객체 B
```

같은 Image를 사용해도 A와 B는 별도의 실행이다. Controller 객체, 메모리의 Session과 Worker 객체도 서로 다르다. 같은 PostgreSQL에 접속하도록 설정하면 두 Application이 DB Row를 공유할 수 있지만, 이것은 JVM 메모리를 공유하는 것과 다르다.

두 App이 같은 DB에 연결됐다고 `HttpSession`까지 자동으로 공유하지는 않는다. Session을 공유하려면 Session 데이터를 공통 저장소에 보관하고 읽도록 별도로 구성해야 한다.

Container에는 격리된 Process와 파일·Network 환경이 있다. Linux Container는 각자 완전한 운영체제와 Kernel을 설치하는 VM과 달리, 실행 기반의 Linux Kernel을 공유한다. Windows에서 Docker Desktop으로 Linux Container를 실행할 때는 Linux 실행 기반을 사용한다. [Docker Container 개념](https://docs.docker.com/get-started/docker-concepts/the-basics/what-is-a-container/)

Container를 생성하면 사용할 Image·파일 공간·실행 설정 등을 갖는 Container가 만들어진다. 아직 시작하지 않았거나 이미 중지한 Container도 존재할 수 있다. 이것은 Application Process가 실행 중이라는 뜻이 아니다. Container 자체의 별도 업무 프로그램과 Helpdesk 프로그램이 반드시 둘 다 실행되어야 하는 것도 아니다. Helpdesk의 주 실행 Process는 JVM으로 구성할 수 있다.

Image Build 과정의 컴파일·Test 명령도 Process를 실행할 수 있다. 다만 Build가 끝나 Image가 만들어졌다는 사실만으로 Helpdesk가 계속 실행되며 HTTP 요청을 받는 것은 아니다.

## Stop과 Start 그리고 Pause

`Stop`과 `Pause`는 다르다. Stop은 Container의 주 Process를 종료한다. Pause는 Process를 종료하지 않고 실행을 일시 중단한다. [Container Stop](https://docs.docker.com/reference/cli/docker/container/stop/), [Container Pause](https://docs.docker.com/reference/cli/docker/container/pause/)

| 작업 | JVM과 메모리 객체 | Container의 쓰기 계층에 저장한 파일 |
|---|---|---|
| 실행 중인 Container를 Stop | JVM 종료, 메모리의 객체 사라짐 | Container를 제거하지 않았다면 남음 |
| 중지한 같은 Container를 Start | 새 JVM과 새 Spring 객체 생성 | 같은 쓰기 계층의 파일 사용 |
| 실행 중인 Container를 Pause | Process와 메모리는 유지하되 실행 중단 | 그대로 유지 |
| Pause한 Container를 Unpause | 중단했던 Process의 실행 재개 | 그대로 유지 |
| 중지한 Container를 Remove | 실행 중인 JVM 없음 | 해당 Container의 쓰기 계층 제거 |

예를 들어 Container A의 쓰기 계층에 `result.txt`를 저장하고 JVM 메모리에 `HttpSession`을 만들었다고 하자. A를 Stop한 뒤 같은 A를 Start하면 `result.txt`는 남아 있지만, 이전 `HttpSession` 객체는 없다. 새 JVM이 이전 JVM의 객체를 이어받는 것이 아니다. [Container 저장 공간](https://docs.docker.com/engine/storage/)

```text
Container A 실행
    ├─ 쓰기 계층: result.txt
    └─ JVM 1 메모리: HttpSession 1
             │ Stop 후 같은 Container Start
             ▼
Container A 다시 실행
    ├─ 같은 쓰기 계층: result.txt 유지
    └─ JVM 2 메모리: 새 객체 생성, HttpSession 1 없음
```

PC를 재부팅해도 이전 JVM의 메모리 객체가 복원되지는 않는다. 디스크에 보관하고 별도로 삭제하지 않은 Image·Container의 파일 공간·Volume은 남을 수 있지만, Process는 새로 실행해야 한다.

재부팅 후 모든 Container가 자동으로 실행되는 것도 아니다. Docker Engine이 시작되어야 하며 Restart Policy에 따라 동작이 달라진다. 기본값인 `no`는 자동 재시작을 하지 않는다. `always`는 Engine이 다시 시작될 때 Container를 시작하고, `unless-stopped`는 사용자가 중지한 Container를 자동으로 다시 시작하지 않는다. [Container 자동 시작 정책](https://docs.docker.com/engine/containers/start-containers-automatically/)

## Docker CLI와 Engine

터미널에서 사용하는 `docker`는 명령을 전달하는 Client다. Docker Engine은 Image와 Container를 관리하고 실제 실행을 담당한다. CLI가 설치되어 있어도 Engine이 꺼져 있으면 Container를 시작할 수 없다.

```text
PowerShell의 docker 명령
    → Docker Engine에 요청
    → Image Build 또는 Container 실행
```

`docker version`의 Client 정보만 확인하는 것과 Server 정보까지 확인하는 것은 다르다. Docker Compose 역시 Engine을 통해 Container를 실행한다.

## App와 PostgreSQL을 따로 실행하는 구조

다음은 App와 DB를 분리하는 Compose 구성의 예다. `app`과 `db`는 Service 이름이다.

```text
Browser
    │ HTTP 요청
    ▼
App Container
    └─ JVM Process
       ├─ Security Filter와 HttpSession
       ├─ Controller → Service
       ├─ JdbcTicketRepository ────────┐
       └─ 활성화한 AI Worker          │ JDBC 연결
                                      ▼
                               PostgreSQL Container
                                   └─ PostgreSQL Process
                                      └─ DB 파일
                                         └─ 연결한 Volume에 보관
```

Worker를 App 내부에서 실행하도록 설계했다면 Docker가 Worker를 별도 서버로 바꾸지 않는다. App Container 안의 같은 JVM에서 Worker가 실행되고, App Process가 종료되면 Worker도 종료된다.

Repository의 DB 선택과 사용자 인증 정보의 저장 방식도 별개다. 인증 사용자를 메모리에 보관한다고 Ticket이 자동으로 In-memory Repository에 저장되는 것은 아니다. 어떤 Bean을 구성하고 어떤 DB에 연결했는지가 저장 위치를 결정한다.

Port·Adapter·Migration의 상세 개념은 [PostgreSQL 저장 경계 자료](../../week6/study-docs/persistence-port-adapter-migration-testcontainers.md)를 참고한다.

## Container의 쓰기 계층과 Volume

Container는 Image 위에 자신의 쓰기 계층을 갖는다. 실행 중 이 계층에 만든 파일은 Image를 바꾸지 않는다. Container를 제거하면 그 Container의 쓰기 계층도 제거된다.

Volume은 개별 Container의 수명과 분리된 저장 공간이다. PostgreSQL이 사용하는 데이터 디렉터리에 Volume을 연결하면, 같은 Volume을 연결한 새 DB Container에서 기존 DB 파일을 사용할 수 있다. [Docker 데이터 보존](https://docs.docker.com/get-started/docker-concepts/running-containers/persisting-container-data/)

Volume은 첨부 파일에만 쓰는 공간이 아니다. PostgreSQL의 Row도 최종적으로 PostgreSQL이 관리하는 DB 파일에 저장되므로, DB 파일의 저장 위치를 보존해야 한다.

이 구성에서는 Volume에 PostgreSQL 프로그램을 설치하는 것이 아니다. 실행 프로그램과 데이터, 로그인 상태를 다음처럼 구분한다.

| 대상 | 있는 위치 | DB Container만 교체할 때 |
|---|---|---|
| PostgreSQL 실행 프로그램 | PostgreSQL Image | 같은 Image에서 새 Process를 실행한다 |
| Table·Row 등 DB 상태를 담은 파일 | 데이터 디렉터리에 연결한 Volume | 같은 Volume을 연결해 기존 파일을 읽는다 |
| 로그인한 사용자의 `HttpSession` | App JVM의 메모리 | App JVM을 유지하면 Session도 유지된다 |

따라서 Ticket이 남는 이유는 같은 Image를 사용하거나 Volume에 DB 프로그램을 설치해서가 아니라, Commit된 데이터를 담은 파일을 보존해 다시 사용하기 때문이다. [Volume과 Container의 수명](https://docs.docker.com/engine/storage/volumes/)

DB 재시작 중에는 JDBC 연결이 끊겨 DB 요청이 실패할 수 있다. App의 Session이 유지된다는 것과 DB 조회가 중단 없이 계속 성공한다는 것은 다르다.

App Container 교체와 DB Container 교체를 구분한다.

- **App만 교체**한다면 새 App이 기존 PostgreSQL에 JDBC로 연결하면 된다. App이 PostgreSQL의 데이터 Volume을 직접 읽거나 연결할 필요는 없다.
- **DB Container를 교체**한다면 새 PostgreSQL Process가 기존 DB 파일을 사용할 수 있어야 한다. 기존 DB Container를 종료·제거한 뒤, 보존한 같은 Volume을 새 DB Container에 연결하는 방식으로 구성할 수 있다.

```text
DB Container A → Volume의 PostgreSQL 데이터 디렉터리
        │ A 종료·제거, Volume은 보존
        ▼
DB Container B → 같은 Volume의 기존 DB 파일 사용
```

같은 PostgreSQL Image만 사용하고 새 저장 공간을 연결하면 이전 Ticket은 나타나지 않는다. Image는 PostgreSQL 실행에 필요한 파일을 제공하고, 이전에 저장한 Ticket Row는 데이터 디렉터리에 있기 때문이다. 기존 데이터 디렉터리를 재사용할 때는 PostgreSQL 버전과 파일 형식의 호환성도 확인한다.

| 변경 | 메모리의 Session | Commit된 Ticket Row |
|---|---|---|
| App Process만 종료하고 다시 실행 | App 메모리에만 저장했다면 사라짐 | 같은 PostgreSQL을 유지하면 남음 |
| DB Container를 정상 중지한 뒤 같은 Container 시작 | 별도로 실행 중인 App의 Session은 DB Container에 저장된 것이 아님 | 같은 DB 파일을 사용하면 남음 |
| DB 파일을 쓰기 계층에만 둔 Container 제거·교체 | App의 Session 저장과 별개 | 새 Container는 기존 DB 파일을 갖지 않음 |
| DB Container 제거·교체, 같은 Volume 유지·재연결 | App의 Session 저장과 별개 | 호환되는 PostgreSQL과 데이터 디렉터리를 사용하면 다시 조회 가능 |

Volume은 JVM 메모리를 보존하지 않는다. 따라서 DB Row가 남아 있어도 App을 다시 실행하면 재로그인이 필요할 수 있다. 또한 Volume 자체를 삭제하면 연결했던 DB 데이터도 잃는다. Container 교체 실험과 Volume 삭제 실험을 혼동하지 않는다.

### App 재시작 뒤 Cookie가 있어도 로그인해야 하는 이유

Session을 App JVM의 메모리에만 저장하는 구성에서는 App 재시작 뒤 이전 인증 상태를 이어받지 않는다. Client의 Cookie에는 Session ID만 있고, 그 ID에 대응하는 `HttpSession`과 `SecurityContext`는 이전 JVM에 있었다.

```text
재시작 전
Client의 JSESSIONID → App JVM 1의 HttpSession
                       └─ SecurityContext → Authentication(AGENT)

App Stop 후 같은 Container Start
Client의 기존 JSESSIONID → App JVM 2에는 대응하는 이전 HttpSession 없음
                           → 로그인 인증을 복원하지 못함
                           → 보호된 Ticket GET: 401

다시 로그인한 뒤
Client의 새 JSESSIONID → App JVM 2의 새 HttpSession
                         └─ SecurityContext → Authentication(AGENT)
                         → 같은 PostgreSQL의 Ticket GET: 200
```

`401`은 Ticket이 사라졌다는 뜻이 아니다. 인증을 복원하지 못해 Controller에 도달하지 못한 것이다. 다시 로그인하면 새로운 Session으로 인증·인가를 통과하고, Repository가 같은 PostgreSQL의 기존 Row를 조회한다.

이때 Cookie를 지웠거나 그 값을 갱신하지 않아서만 실패하는 것은 아니다. Cookie가 남아 있어도 Server에 대응하는 인증 상태가 없으면 복원할 수 없다. Container ID가 같은 것과 JVM 실행이 같은 것도 구분한다. Compose의 `stop`은 Container를 제거하지 않고, `start`는 기존 Container를 다시 시작한다. [Compose Stop](https://docs.docker.com/reference/cli/docker/compose/stop/), [Compose Start](https://docs.docker.com/reference/cli/docker/compose/start/)

### 유효한 Session 수와 메모리 사용

메모리 Session 방식에서 유효한 Session이 1만 개라면 Server는 그 Session들과 내부에 저장한 객체들을 관리한다. Tomcat은 활성 Session을 Session ID로 찾을 수 있는 자료구조에 보관한다. Session 수만큼 JVM이나 Application 전체를 새로 만드는 것은 아니다. [Tomcat Session 관리 객체](https://tomcat.apache.org/tomcat-11.0-doc/api/org/apache/catalina/session/ManagerBase.html)

가입자 1만 명과 유효한 Session 1만 개는 다르다. 로그인하지 않은 가입자는 로그인 Session이 없을 수 있고, 한 사람이 서로 다른 Browser나 기기에서 여러 Session을 만들 수도 있다. 로그인하지 않은 요청도 CSRF나 원래 요청 저장을 위해 Session을 만들 수 있다.

메모리 사용량은 Session 수뿐 아니라 각 Session에 넣은 정보의 크기에 따라 달라진다. 큰 조회 결과를 계속 넣는 대신 필요한 정보만 보관하고, 만료·로그아웃 시 Session을 정리한다. Session 1만 개의 실제 메모리 사용량은 측정해야 알 수 있다.

여러 App이 Session을 공유하거나 App 재시작 뒤에도 로그인 상태를 유지하려면 별도 저장 방식을 구성해야 한다. Spring Session은 Redis·JDBC 같은 저장소와 연결할 수 있다. Redis 역시 메모리를 사용하므로 저장소를 옮기는 것이 데이터 보관 비용을 없애는 것은 아니다. [Spring Session](https://docs.spring.io/spring-session/reference/index.html)

## localhost와 Service 이름 그리고 Port

`localhost`는 명령이나 프로그램이 실행되는 Network 환경의 자기 자신을 가리킨다. App Container 안에서 `localhost:5432`로 접속하면 별도 DB Container가 아니라 App Container 쪽을 찾는다.

PC의 Browser에서 사용하는 `localhost`는 PC를, App Container에서 사용하는 `localhost`는 App의 Network 환경을, 별도 DB Container에서 사용하는 `localhost`는 DB의 Network 환경을 가리킨다. 서로 다른 Network 환경의 `localhost`를 같은 목적지로 생각하면 안 된다.

Compose의 같은 Network에 `app`과 `db` Service를 연결했다면 App에서는 DB의 Service 이름으로 접속할 수 있다. 예를 들어 DB가 `5432`에서 연결을 받으면 `jdbc:postgresql://db:5432/helpdesk` 같은 주소를 사용한다. Browser와 App의 DB 접속 주소는 관점이 다르다. [Compose Network의 Service 이름](https://docs.docker.com/compose/how-tos/networking/)

이 JDBC 주소에서 `db`는 접속할 Host 이름, `5432`는 PostgreSQL의 Port, `helpdesk`는 Database 이름이다. `jdbc:postgresql:`은 JDBC의 PostgreSQL 연결 형식을 나타내며 Host 이름이 아니다.

```text
Host의 Browser
    → 127.0.0.1:18081
    → App Container의 8080

App Container
    → db:5432
    → PostgreSQL Container의 5432
```

Port Publishing은 Host의 특정 Port로 들어온 연결을 Container의 Port로 전달하는 설정이다. `127.0.0.1:18081:8080`은 Host IP, Host Port, Container Port 순서다. 로컬 학습에서 Host IP를 `127.0.0.1`로 제한하면 기본적으로 모든 인터페이스에 게시하는 경우와 노출 범위가 다르다. Dockerfile의 `EXPOSE 8080`만으로 Host Port가 게시되지는 않는다. [Docker Port 게시](https://docs.docker.com/get-started/docker-concepts/running-containers/publishing-ports/)

따라서 PC의 Browser는 `http://127.0.0.1:18081`에 접속하지만, App은 Container 안에서 `8080`으로 요청을 받는다. 두 Port 번호가 같아야 하는 것은 아니다.

## Dockerfile의 Build 명령과 시작 명령

Dockerfile에는 어떤 기반 Image를 쓰고 어떤 파일을 넣으며 무엇을 실행할지 적는다. 대표적으로 `FROM`은 기반 Image, `COPY`는 파일 복사, `RUN`은 Build 중 실행할 명령, `ENTRYPOINT`나 `CMD`는 Container의 시작 명령을 정의한다.

| 명령 | 역할 | 시점 |
|---|---|---|
| `FROM` | 기반 Image 지정 | Build |
| `COPY` | 지정한 파일을 Image의 파일 공간으로 복사 | Build |
| `RUN` | 명령 실행 결과로 Image를 구성 | 해당 Build 단계를 실행할 때 |
| `ENTRYPOINT` | Container에서 시작할 프로그램 지정 | Build 때 설정을 기록하고 Container 시작 때 실행 |
| `CMD` | 기본 명령 또는 `ENTRYPOINT`에 전달할 기본 인자 지정 | Build 때 설정을 기록하고 Container 시작 때 사용 |

다음은 Java가 준비되어 있고 JAR도 `/app/helpdesk.jar`에 복사했다는 가정 아래의 Dockerfile 일부다. 완전한 Dockerfile은 아니다.

```dockerfile
RUN java -version
ENTRYPOINT ["java", "-jar", "/app/helpdesk.jar"]
```

`RUN java -version`은 Build에서 Java 버전을 확인한다. 다만 해당 단계의 Cache를 재사용하면 명령을 다시 실행하지 않을 수 있다. `ENTRYPOINT`는 이 시점에 Helpdesk를 실행하는 대신 시작 명령을 Image에 기록한다. 그 명령을 사용하는 Container를 시작하면 JVM과 Spring 객체가 만들어진다. [Dockerfile RUN과 ENTRYPOINT](https://docs.docker.com/reference/dockerfile/)

반대로 `RUN java -jar /app/helpdesk.jar`를 쓰면 Build 도중 Helpdesk를 실행한다. 계속 요청을 기다리는 서버라면 명령이 끝나지 않아 Build도 완료되지 않을 수 있다. Application의 실행 시점에 맞춰 시작 명령을 지정해야 한다.

### Multi-stage Build에서 JAR만 복사하기

Multi-stage Build는 하나의 Dockerfile에서 여러 Build 단계를 정의하고 필요한 결과물만 다음 단계에 복사하는 방식이다. `FROM`으로 새 단계를 시작하며 `AS build`처럼 이름을 붙일 수 있다. [Docker Multi-stage Build](https://docs.docker.com/build/building/multi-stage/)

Java Application에서는 다음처럼 역할을 나눌 수 있다.

1. **Build 단계:** JDK·Maven·Source를 사용해 실행 가능한 JAR를 만든다.
2. **실행용 Image 단계:** Java 실행 환경을 준비하고 Build 단계의 JAR만 복사한다.

다음은 `build` 단계에서 `/workspace/target/helpdesk.jar`를 만들었다고 가정한 복사 명령이다.

```dockerfile
COPY --from=build /workspace/target/helpdesk.jar /app/helpdesk.jar
```

`--from=build`는 Host의 Build Context가 아니라 이름이 `build`인 단계에서 파일을 가져오라는 뜻이다. 새 실행용 단계가 별도의 기반 Image에서 시작하면, 앞 단계의 Maven·Source·다운로드 Cache를 모두 가져오는 것이 아니다. 이 명령은 지정한 JAR만 복사한다.

두 단계는 Helpdesk 서버 두 개를 계속 실행한다는 뜻이 아니다. Image를 만드는 과정을 나눈 것이며, 완성된 Image의 시작 명령으로 JVM을 실행한다. 최종 Image에 Maven이 없어도 Java 실행 환경과 완성된 JAR가 있으면 Application 코드를 실행할 수 있다.

패키징 과정에서 Test를 생략했다면 Image Build 성공은 Test 통과가 아니다. Testcontainers가 필요한 Test는 Docker Engine에 접근할 수 있는 검증 환경에서 별도로 실행하고, 실행한 결과와 생략한 검사를 구분한다.

## Build Context와 COPY

Build Context는 Build가 접근할 수 있는 파일의 범위다. `docker build .`의 마지막 `.`은 현재 디렉터리를 Context로 지정한다. `.dockerignore`는 이 범위에서 제외할 파일을 정한다. `.gitignore`에만 적었다고 Docker Build에서도 자동으로 제외되는 것은 아니다. [Build Context와 dockerignore](https://docs.docker.com/build/concepts/context/)

예를 들어 다음 디렉터리에서 Build한다고 하자. `.env`는 파일 이름만 표시한 것이며 비밀값을 예제에 넣지 않는다.

```text
build-example/
├─ Dockerfile
├─ .dockerignore
├─ helpdesk.jar
├─ notes.txt
└─ .env
```

```powershell
docker build -t helpdesk:study .
```

`-t helpdesk:study`는 만들어질 Image에 이름과 Tag를 붙인다. 마지막 `.`은 현재 디렉터리가 Build Context라는 뜻이다.

Dockerfile에 다음 `COPY`만 있다면 `helpdesk.jar`를 복사한다. Context 안에 `notes.txt`도 있다는 이유만으로 그 파일이 Image에 자동으로 들어가지는 않는다.

```dockerfile
COPY helpdesk.jar /app/helpdesk.jar
```

`COPY . /app/`처럼 넓은 범위를 복사하면 Context에서 제외하지 않은 파일도 함께 들어갈 수 있다. `.env` 등 비밀값이 있는 파일은 `.dockerignore`에서 제외하고, 실제로 필요한 파일만 복사한다. `.gitignore`는 Git 추적 여부를, `.dockerignore`는 Build Context에서 제외할 파일을 다룬다.

## Build Cache와 명령 순서

Build Cache는 이전 Build 단계의 결과를 재사용하는 기능이다. 같은 입력으로 이미 만든 결과가 있으면 해당 단계를 다시 실행하지 않고 사용할 수 있다.

Maven의 의존성은 Spring 등 Application이 사용하는 라이브러리다. `pom.xml`에는 어떤 의존성이 필요한지 등의 설정이 있고, Java Source에는 Application 코드가 있다. 이 둘의 변경 빈도에 맞춰 복사와 Build 순서를 나눌 수 있다.

다음은 단일 Build 흐름을 이해하기 위한 순서다. 실제로 실행한 Dockerfile의 결과를 나타내는 것은 아니다.

```text
1. pom.xml 등 의존성 준비에 필요한 입력 복사
2. Maven 의존성 준비
3. Java Source 복사
4. 컴파일과 패키징
```

기반 Image와 다른 Build 설정이 같고, 필요한 Cache도 있다는 조건에서 다음처럼 생각할 수 있다.

| 바뀐 입력 | 앞 단계의 재사용 | 다시 평가하는 범위 |
|---|---|---|
| 변경 없음 | 기존 단계 결과 재사용 가능 | Cache가 없는 단계 등 |
| Java Source만 변경 | 1과 2의 결과 재사용 가능 | 3부터 뒤의 단계 |
| `pom.xml` 변경 | 그 파일을 사용하는 단계부터 Cache 무효화 | 1부터 뒤의 단계 |

반대로 Java Source까지 처음에 모두 복사하면 Source 변경이 뒤의 의존성 준비 단계에도 영향을 준다. 변경이 적은 입력을 앞에 두면 자주 바뀌는 Source 때문에 의존성 준비를 반복하는 일을 줄일 수 있다. [Build Cache 무효화](https://docs.docker.com/build/cache/invalidation/)

실제 Build에서는 전체 시간뿐 아니라 어느 단계가 `CACHED`였는지도 확인한다. Cache를 재사용했다는 것은 이전 결과를 사용했다는 뜻이며, 라이브러리가 최신인지 또는 Application이 올바르게 동작하는지를 판단하는 Test는 아니다.

### 두 Maven 명령이 다시 실행되는 조건

다음 순서에서는 의존성 준비와 Source 컴파일을 분리한다. Maven Wrapper는 이 명령들보다 앞에서 복사했다고 가정한다.

```dockerfile
COPY pom.xml ./pom.xml
RUN ./mvnw -B -ntp dependency:go-offline

COPY src/main ./src/main
RUN ./mvnw -B -ntp -DskipTests package
```

`dependency:go-offline`은 필요한 라이브러리와 Build 플러그인을 미리 준비한다. `package`는 Source를 컴파일하고 실행 가능한 JAR를 만든다. `-DskipTests`는 Test 실행을 생략하는 설정이다.

Java Source만 바뀌면 첫 번째 `RUN`까지의 입력은 그대로다. 따라서 의존성 준비 결과를 재사용하고, 변경된 Source를 복사한 다음 패키징을 다시 수행한다. 반대로 `pom.xml`에 의존성을 추가하면 그 파일을 복사하는 단계부터 입력이 달라지므로 두 `RUN`을 모두 다시 실행한다.

`RUN` 명령의 문자열이 같더라도 앞 단계의 결과가 달라졌다면 같은 Build 입력이 아니다. Docker는 Java 코드의 의미를 분석해 Cache를 판단하지 않는다. 동작을 바꾸지 않는 Source 주석만 수정해도 `COPY src/main`의 입력이 달라져 패키징을 다시 수행할 수 있다.

의존성을 먼저 준비하는 순서는 Cache 효율을 위한 것이지, Source를 먼저 복사하면 Build가 실패한다는 규칙은 아니다. 이 예제에서 Source 복사를 의존성 준비 앞에 두어도 필요한 POM과 Wrapper가 있으므로 Build할 수 있다. 다만 Source 변경으로 의존성 준비까지 다시 실행하게 된다. 불필요한 재실행과 실행 오류는 구분한다.

## Compose와 준비 완료

Compose는 여러 Service의 Image·Network·Port·Volume·설정을 YAML로 정의하고 함께 실행·관리한다. Compose 자체가 Ticket을 저장하지는 않는다. Ticket 저장은 App의 Repository와 PostgreSQL이 수행한다. [여러 Container와 Compose](https://docs.docker.com/get-started/docker-concepts/running-containers/multi-container-applications/)

DB Process를 시작했다는 것과 DB가 연결을 받을 준비가 됐다는 것도 다르다. 시작 순서만 맞추지 말고 Healthcheck 등으로 준비 완료 조건을 확인해야 한다. DB 연결 준비, Migration 성공, HTTP 요청 처리와 AI 처리 성공은 각각 확인한다. [Compose 시작 순서와 Healthcheck](https://docs.docker.com/compose/how-tos/startup-order/)

단순한 `depends_on`은 의존하는 Container를 먼저 시작하지만, PostgreSQL의 초기화 완료까지 기다린다는 뜻은 아니다. Healthcheck는 Container 안에서 검사 명령을 실행해 상태를 확인한다. DB의 준비 상태를 검사하는 Healthcheck를 정의했다면 다음 조건으로 App의 시작을 기다릴 수 있다.

```yaml
services:
  app:
    depends_on:
      db:
        condition: service_healthy
```

이 설정은 DB의 Healthcheck가 통과한 뒤 App을 시작한다. 같은 Network에 있다는 것, DB가 연결을 받는다는 것, 접속 계정이 유효하다는 것은 각각 다른 조건이다. DB 연결 준비를 검사하는 Healthcheck가 통과해도 App의 Migration과 Ticket 저장까지 성공한 것은 아니다.

시작 뒤 DB가 중단되는 경우도 따로 생각해야 한다. 이 시작 조건만으로 실행 중인 App의 DB 오류 처리·재연결이나 자동 복구가 구현되지는 않는다.

### DB 초기화와 Flyway 그리고 Row 저장

DB 연결을 받을 수 있다는 것과 Application에 필요한 Table이 있다는 것은 다르다. PostgreSQL Image의 초기화 SQL과 App의 Flyway도 서로 다른 일을 한다.

| 단계 | 담당하는 구성 | 확인하는 결과 |
|---|---|---|
| 빈 DB의 최초 초기화 | PostgreSQL Image의 Init Script | DB 계정과 Schema 접근 권한 |
| DB 연결 준비 | `pg_isready` Healthcheck | PostgreSQL이 연결을 받을 준비가 되었는가 |
| App의 Schema 준비 | Flyway Migration | `tickets` 등 Table과 Migration 이력 |
| 문의 접수 | Controller → Service → JDBC Repository → PostgreSQL | Transaction이 Commit한 Ticket·Message·Job Row |

`pg_isready`가 성공해도 접속 Password가 맞거나 `tickets` Table이 존재한다는 뜻은 아니다. 실제 App 계정의 연결과 Migration 결과를 따로 확인한다. [PostgreSQL 연결 준비 검사](https://www.postgresql.org/docs/17/app-pg-isready.html)

로컬 Compose 구성에서 DB 초기화 SQL은 관리자 계정으로 App 전용 계정을 만들고, App은 그 계정으로 Flyway와 JDBC를 실행한다. App이 Flyway를 실행하므로 Schema에 Table을 만들 권한도 필요하다. Superuser 권한을 주지 않는 것과 읽기·쓰기 권한만 주는 것은 같은 말이 아니다.

PostgreSQL Image의 `/docker-entrypoint-initdb.d` Script는 빈 데이터 디렉터리의 최초 초기화에 사용한다. 같은 Volume을 다시 연결하면 기존 계정·Password·Table을 유지하며 초기화 SQL을 다시 실행하지 않는다. YAML의 Password를 바꾼다는 것만으로 기존 DB 계정 Password도 바뀌지는 않는다. [공식 PostgreSQL Image 초기화](https://github.com/docker-library/docs/blob/master/postgres/README.md)

Session 저장과 Ticket 저장의 위치도 분리한다. `local-browser`의 사용자 인증 객체와 `HttpSession`은 App JVM의 메모리에 있고, `postgres` Profile의 Ticket·Message·Job은 PostgreSQL에 있다. DB Container만 교체하고 App JVM을 유지하는 실험과 App을 재시작하는 실험은 Session에 미치는 영향이 다르다.

## 실행 설정과 Secret의 분리

같은 App Image에 환경별 DB 주소·사용자 인증 설정·Worker 활성화 여부 등을 실행 시 전달할 수 있다. 운영할 환경이 바뀐다는 이유만으로 비밀값을 JAR나 Image에 넣을 필요는 없다.

API Key·DB Password는 Source·Dockerfile·Build Argument·Image Layer에 넣지 않고 실행 환경의 Secret 전달 방식을 사용한다. 파일을 뒤의 Layer에서 지워도 앞 Layer에 포함한 비밀값이 안전하게 사라지는 것은 아니다. `.dockerignore`와 복사할 파일의 범위를 함께 확인한다. [Docker Secret Build 검사](https://docs.docker.com/reference/build-checks/secrets-used-in-arg-or-env/)

설정을 검사할 때는 값이 존재하는지만 확인한다. 환경 변수를 확장한 전체 `docker compose config`나 Container의 전체 환경 정보는 비밀값을 노출할 수 있으므로 공개 Log에 출력하지 않는다.

### Image 변경과 실행 설정 변경

Java 코드를 수정해 JAR가 바뀌면 새 코드를 포함한 Image를 만들어야 한다. 반면 DB 주소나 실행 시 주입하는 Password만 바뀌었다면, 그 설정을 Image에 포함하지 않은 구성에서는 같은 Image를 사용할 수 있다.

Container를 만들 때 환경 변수 등 실행 설정도 지정한다. 같은 Container를 Stop 후 Start하는 것은 기존 설정으로 새 Process를 시작하는 것이므로, Host의 환경 변수를 바꿨다는 이유만으로 기존 Container의 설정까지 갱신되지는 않는다. 변경한 설정으로 App Container를 재생성하면 같은 Image에서 새 설정을 사용할 수 있다. Compose의 `up`은 Service 설정 변경을 감지하면 해당 Container를 재생성한다. [Compose 설정 변경과 재생성](https://docs.docker.com/reference/cli/docker/compose/up/)

DB 계정의 Password 변경과 App의 접속 Password 전달도 별개다. 먼저 DB에서 계정 Password를 변경했다면 App에도 새 접속 값을 주입해야 한다. App 설정만 바꾸는 것은 DB 계정 Password를 바꾸는 작업이 아니다. 기존 DB와 Volume을 유지하면서 App의 설정만 변경할 수 있다.

### Host의 설정과 Container의 설정

Host에서 환경 변수를 준비하는 것과 Container에 그 값을 전달하는 것은 별개다. Compose의 `environment`에서 해당 변수를 참조해야 Container를 생성할 때 전달할 수 있다. Shell에 변수가 있다는 것만으로 모든 Container에 자동으로 전달되지는 않는다. [Compose 환경 변수 전달](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/)

이 흐름에는 세 단계가 있다.

1. Host에서 실행에 사용할 값을 준비한다.
2. Compose가 설정을 읽어 Container의 환경 변수를 지정한다.
3. Container에서 JVM을 시작하면 Spring의 `Environment`가 전달된 설정을 읽고 관련 Bean을 구성한다.

예를 들어 `LocalBrowserCorsConfiguration`은 시작할 때 허용 Origin을 읽어 CORS 설정 객체를 만든다. 같은 Container를 Stop 후 Start하면 새 JVM과 새 Bean을 만들지만, 그 객체를 구성하는 입력은 여전히 기존 Container의 환경 변수다. 따라서 **객체를 새로 만드는 것과 새 설정을 전달하는 것은 다른 일**이다.

| 단계 | Container | JVM과 Bean | 적용되는 설정 |
|---|---|---|---|
| 기존 실행 | 기존 Container | 기존 객체 | 생성할 때 전달한 설정 |
| Host의 값 변경 후 Stop·Start | 같은 Container | 새 객체 | 기존 Container에 보관된 설정 |
| 새 설정으로 Container 재생성 | 새 Container, 같은 Image 사용 가능 | 새 객체 | 새 Container에 전달한 설정 |

환경 변수로 전달했다고 비밀값이 자동으로 감춰지는 것은 아니다. Container 관리 권한이 있는 사람에게 값이 노출될 수 있다. 비밀값을 Image에서 분리하는 것과 접근을 제한한 Secret 저장·전달 방식을 구성하는 것도 구분한다. Docker는 민감한 정보에 환경 변수 대신 Secret 기능을 사용하도록 안내한다. [Docker 환경 변수와 Secret 안내](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/)

### 필수 설정과 선택 기능

설정이 없을 때 무조건 Application 전체를 실행하거나 거부하는 것은 아니다. 활성화한 기능에 필요한 설정인지 먼저 구분한다. PostgreSQL에 문의를 저장하려면 DB 연결이 필요하지만, AI Worker를 끈 실행에는 AI Provider가 필요하지 않다.

Compose에서 `${VAR:?error}`를 사용하면 변수가 없거나 빈 문자열일 때 설정 해석을 거부한다. 이 검사는 Container를 시작하기 전에 할 수 있다. 변수가 존재한다는 검사이므로 Password가 올바른지, DB에 접속할 수 있는지까지 확인하지는 않는다. 공백만 있는 값도 별도의 검증 대상이다. [Compose 필수 값 문법](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)

| 구성 | 필요한 조건과 동작 |
|---|---|
| PostgreSQL 접수인데 필수 DB Password 미설정 | Compose 설정 해석을 거부한다. App을 시작하지 않는다. |
| Worker 비활성, DB·로그인 설정 정상 | AI Key 없이 접수·조회할 수 있다. 접수한 Job은 `PENDING`으로 남는다. |
| Worker 활성, Provider 객체 없음 | Spring이 필요한 객체를 조립하지 못해 기동에 실패한다. 활성화 값만으로 Provider가 만들어지지 않는다. |

Helpdesk의 Worker 구성은 `postgres` Profile과 `helpdesk.ai.worker.enabled=true`를 함께 사용하며 Provider·개인정보 처리기·출력 검증기를 명시적으로 받는다. Worker 비활성 구성과, Worker를 켰지만 필요한 객체가 없는 구성은 서로 다르다.

문의 접수는 Ticket·Message·Job을 하나의 Transaction으로 저장한다. AI 처리는 그 Commit 뒤에 별도로 진행하므로 Provider 실패가 이미 접수한 원문을 취소하지 않는다. AI 결과도 고객에게 보낸 공식 답변이 아니라 담당자가 검토할 제안이다.

### Secret 파일과 Application 설정 연결

Secret 파일을 Container에서 읽을 수 있다는 것과 Application이 그 값을 실제로 사용하는 것은 다르다. 파일을 제공한 뒤에도 설정을 읽고 객체에 전달하는 연결이 필요하다.

1. **Docker·Compose:** 필요한 Service에만 Secret 파일을 제공한다. AI Key는 AI 요청을 보내는 App에 제공하고 PostgreSQL에는 제공하지 않는다.
2. **Spring 설정 읽기:** 파일 내용을 Application의 Property로 읽는다. 예를 들어 `spring.config.import=configtree:/run/secrets/`는 해당 디렉터리의 파일 이름을 Property 이름, 파일 내용을 값으로 읽는 방식이다.
3. **Provider 구성:** Configuration이 필요한 Property를 읽어 Provider 생성자에 전달하고 Bean을 등록한다. Worker가 그 Provider를 사용하도록 개인정보 처리기·출력 검증기와 함께 조립한다.

위의 `configtree:`는 연결 원리를 설명하는 예다. 실제로는 활성화할 기능, 파일 이름·읽기 권한과 필수 값 검사를 함께 정해야 한다. Worker를 끈 구성과 실제 Provider를 활성화하는 구성의 요구 설정도 구분한다. 파일만 연결하거나 Worker 값만 `true`로 설정하는 것으로 Provider가 자동 등록되는 것은 아니다. [Compose Secret 제공](https://docs.docker.com/compose/how-tos/use-secrets/), [Spring Boot Configuration Tree](https://docs.spring.io/spring-boot/reference/features/external-config.html#features.external-config.files.configtree)

Secret 파일 방식도 모든 접근을 차단하는 것은 아니다. 필요한 Service에만 읽기를 허용하고 Host의 원본 파일·Docker 관리 권한·Application Log를 함께 관리해야 한다. 파일 내용이나 이를 읽은 Property의 값은 출력하지 않는다.

파일 읽기·설정값·Provider Bean 등록의 차이와 작은 설정 Test는 [Spring 설정과 Bean으로 Provider 연결하기](./spring-settings-bean-and-secret-wiring.md)에서 이어서 다룬다.

## 핵심 질문

1. App Image가 만들어졌지만 App을 실행하지 않았다면 Controller와 Worker는 HTTP 요청을 처리하거나 Job을 처리하고 있는가?
2. 같은 Image에서 Container 두 개를 실행하고 같은 PostgreSQL에 연결하면 두 JVM의 `HttpSession`도 자동으로 공유되는가?
3. 쓰기 계층에 `result.txt`가 있고 JVM 메모리에 `HttpSession`이 있다. Stop 후 같은 Container를 Start한 경우와 Pause 후 Unpause한 경우에 각각 무엇이 남는가?
4. PC 재부팅 뒤 이전 JVM 객체가 복원되는가? 보존한 Container는 반드시 자동으로 시작되는가?
5. App Container만 교체할 때 기존 PostgreSQL의 Volume을 새 App에 직접 연결해야 하는가?
6. DB Container를 교체하면서 같은 PostgreSQL Image와 빈 저장 공간을 사용하면 이전 Ticket이 조회되는가?
7. App Container에서 `localhost:5432`와 `db:5432`는 각각 어디를 찾는가?
8. Port 설정이 `127.0.0.1:18081:8080`이면 PC Browser와 App은 각각 어떤 Port를 사용하는가?
9. `RUN java -jar /app/helpdesk.jar`와 `ENTRYPOINT ["java", "-jar", "/app/helpdesk.jar"]`의 실행 시점은 어떻게 다른가?
10. Build Context에 JAR와 `notes.txt`가 있어도 `COPY helpdesk.jar /app/helpdesk.jar`만 썼다면 두 파일이 모두 Image에 들어가는가?
11. `.env`를 `.gitignore`에만 적으면 Docker Build에서도 자동으로 제외되는가?
12. Source만 바꿨는데 의존성 준비 단계도 다시 실행됐다면 Dockerfile의 어떤 순서를 살펴봐야 하는가?
13. Container가 실행 중이라는 사실만으로 Migration·접수·AI 처리 성공을 알 수 있는가?
14. 완성된 JAR를 실행할 때 Maven과 Java Source가 필요 없는 이유는 무엇이며, 코드를 실행하는 주체는 무엇인가?
15. 새 기반 Image에서 시작한 실행용 단계의 `COPY --from=build`는 앞 단계의 파일을 모두 가져오는가?
16. `service_healthy`는 어떤 시점까지 App의 시작을 기다리며, 그 조건만으로 Ticket 저장 성공까지 알 수 있는가?
17. 위처럼 POM과 Source를 나누어 복사했을 때 Source만 바꾼 경우와 POM에 의존성을 추가한 경우, 두 Maven `RUN`은 각각 어떻게 달라지는가?
18. Source의 주석만 수정해 Application 동작이 같아도 패키징을 다시 실행할 수 있는 이유는 무엇인가?
19. 의존성 준비보다 Source 복사를 앞에 두면 Build가 반드시 실패하는가? 원래 순서를 권장하는 이유는 무엇인가?
20. PostgreSQL Image의 초기화 SQL, `pg_isready`, Flyway, 접수 Transaction은 각각 무엇을 확인하거나 저장하는가?
21. 같은 Volume을 다시 연결할 때 Compose의 DB Password 설정만 바꾸면 기존 계정 Password도 자동으로 바뀌는가?
22. DB Container만 교체하고 같은 Volume을 연결할 때, PostgreSQL 프로그램·Ticket 데이터·로그인 Session은 각각 어디에서 오는가?
23. 같은 App Container를 Stop 후 Start했을 때 Cookie와 Ticket Row가 남아 있어도 보호된 GET이 `401`인 이유는 무엇인가?
24. 가입자 수와 유효한 Session 수는 왜 다르며, Session 1만 개가 JVM 1만 개를 뜻하지 않는 이유는 무엇인가?
25. DB에서 계정 Password를 변경했고 Java 코드는 그대로다. App에 새 접속 Password를 주입하려면 Image 재Build, 기존 Container Stop 후 Start, 새 설정의 Container 재생성 중 무엇을 해야 하는가?
26. Host의 설정을 바꾼 뒤 같은 Container를 Stop·Start하면 새 JVM과 새 Bean을 만들면서도 이전 설정을 사용할 수 있는 이유는 무엇인가?
27. DB·로그인 설정은 정상이고 Worker를 끈 실행에서 AI Key가 없다면 문의 접수까지 막아야 하는가? 접수 뒤 Job은 어떤 상태인가?
28. `docker compose config --quiet`가 통과하면 DB 연결과 Ticket 저장도 성공했다고 볼 수 있는가?
29. Worker 활성화 값은 `true`인데 Provider 객체가 없다면 왜 정상적인 AI 처리 구성이라고 할 수 없는가?
30. Secret 파일을 App에 제공한 것만으로 Java Provider가 API Key를 사용한다고 볼 수 있는가?
31. AI Key는 App과 PostgreSQL 중 어디에 제공하며, Secret 파일 방식에서도 관리해야 할 접근 경계는 무엇인가?

## 핵심 질문 해설

1. **아니다.** Image에는 실행에 필요한 파일과 설정이 있다. Container에서 JVM을 시작해야 Spring 객체가 만들어지고 요청이나 Job을 처리할 수 있다.
2. **자동으로 공유되지 않는다.** 두 JVM의 메모리는 별개다. DB Row를 함께 보는 것과 `HttpSession`의 저장 방식을 공통 저장소로 구성하는 것은 다른 일이다.
3. **Stop 후 Start에서는 파일은 남고 이전 객체는 사라진다.** 같은 Container의 쓰기 계층을 사용하지만 JVM은 새로 실행한다. Pause 후 Unpause에서는 기존 Process와 메모리 객체를 유지한 채 실행을 재개한다.
4. **이전 JVM 객체는 복원되지 않는다.** 디스크의 파일을 보존하는 것과 메모리를 보존하는 것은 다르다. 자동 시작 여부는 Docker Engine 실행과 Restart Policy에 달려 있다.
5. **아니다.** 새 App은 기존 PostgreSQL에 JDBC로 연결한다. DB 파일은 PostgreSQL이 읽고 쓰며 App에 직접 연결하지 않는다.
6. **조회되지 않는다.** Image가 같아도 이전 데이터 디렉터리가 없다. DB Container 교체 시 기존 Volume을 보존·재연결하거나 백업에서 복원해야 한다.
7. **`localhost`는 App 자신의 Network 환경, `db`는 Compose의 DB Service다.** 이 예에서는 App과 DB가 같은 Compose Network에 연결되어 있다.
8. **PC Browser는 `18081`, App은 `8080`을 사용한다.** Host의 게시 Port로 받은 연결을 Container의 Port로 전달한다.
9. **`RUN`은 Build 단계에서 실행하고 `ENTRYPOINT`는 Container 시작 명령을 지정한다.** 서버를 `RUN`으로 시작하면 종료되지 않는 서버 때문에 Build가 계속 기다릴 수 있다. Cache 재사용 시에는 해당 `RUN`을 다시 실행하지 않을 수 있다.
10. **아니다.** Context는 접근 가능한 파일의 범위이고, `COPY`는 그중 복사할 대상을 지정한다. 이 예에서는 JAR만 복사한다.
11. **자동으로 제외되지 않는다.** `.dockerignore`에서 제외하고 Dockerfile의 복사 범위도 확인해야 한다.
12. **Source 복사가 의존성 준비보다 앞에 있는지 확인한다.** Source 변경으로 앞의 단계가 바뀌면 뒤의 단계도 다시 평가된다. 의존성 준비 입력과 Source 복사를 분리하면 앞부분을 재사용하기 쉽다.
13. **알 수 없다.** Process 실행, DB 준비, Migration, HTTP 접수와 AI Job 처리는 서로 다른 확인 대상이다. 각 흐름에 맞는 요청·Test·DB 결과를 확인해야 한다.
14. **이미 컴파일과 패키징을 마쳤기 때문이다.** Maven이 JAR 안에 있어서가 아니다. JAR의 컴파일된 코드를 실행하는 주체는 JVM이며 Java 실행 환경은 필요하다.
15. **지정한 파일만 가져온다.** 예시 명령은 `build` 단계에서 만든 JAR를 복사한다. Maven·Source·Build Cache까지 자동으로 최종 Image에 들어가는 것은 아니다.
16. **DB의 Healthcheck가 통과할 때까지 기다린다.** DB 연결 준비 검사와 App의 Migration·HTTP 접수·실제 저장은 다른 확인 대상이다. 기동 뒤 DB 장애의 처리도 별도로 구성한다.
17. **Source만 변경하면 의존성 준비는 Cache를 재사용하고 패키징은 다시 실행한다.** POM에 의존성을 추가하면 그 파일을 복사하는 단계부터 바뀌므로 두 Maven 명령을 모두 다시 실행한다. 기반 Image·Wrapper 등 다른 입력이 같고 해당 Cache가 있는 조건이다.
18. **Cache는 코드의 의미가 아니라 Build 입력에 따라 판단하기 때문이다.** 주석 변경도 Source 파일 내용의 변경이다. Source 복사가 바뀌면 그 결과를 사용하는 뒤의 패키징 단계도 다시 평가한다.
19. **반드시 실패하는 것은 아니다.** 이 예제의 의존성 준비는 필요한 POM과 Wrapper로 수행할 수 있다. 의존성 준비를 Source 복사 앞에 두는 이유는 자주 바뀌는 Source 때문에 같은 의존성 준비를 반복하지 않도록 Cache를 재사용하기 위해서다.
20. **계정 초기화·연결 준비·Schema 준비·실제 Row 저장을 나누어 본다.** 앞 단계의 성공이 뒤 단계의 성공까지 증명하지 않는다. App 계정의 연결, Migration 이력과 접수 뒤 DB Row를 각 단계에 맞게 확인한다.
21. **자동으로 바뀌지 않는다.** 기존 데이터 디렉터리를 사용하는 PostgreSQL은 최초 초기화를 다시 하지 않는다. 기존 계정의 Password 변경은 DB에서 별도로 처리해야 한다.
22. **프로그램은 Image, Ticket 데이터는 Volume, Session은 유지한 App JVM에 있다.** 새 PostgreSQL Process가 기존 DB 파일을 읽는 것이다. App까지 재시작하면 메모리에만 있던 Session은 사라지지만, 같은 DB 파일의 Commit된 Ticket은 다시 조회할 수 있다.
23. **새 JVM에는 이전 Session ID에 대응하는 로그인 상태가 없기 때문이다.** Client의 Cookie가 있어도 인증을 복원하지 못하므로 Controller 전에 `401`로 거부된다. 다시 로그인하면 새 Session으로 같은 DB의 기존 Ticket을 조회할 수 있다.
24. **계정마다 Session이 하나씩 고정되는 것이 아니기 때문이다.** 한 사용자가 여러 Session을 가질 수 있고, Session이 없는 가입자도 있다. 하나의 JVM이 여러 Session과 그 안의 객체들을 관리하므로 Session마다 JVM을 만드는 것이 아니다.
25. **같은 Image에서 새 설정의 App Container를 재생성한다.** Password를 실행 시 주입하는 구성이라면 Image 재Build는 필요 없다. 기존 Container를 Stop 후 Start하는 것만으로 생성 당시 환경 변수가 바뀌지는 않는다. DB의 기존 Row와 Volume은 유지하고 App의 연결·재로그인·조회 결과를 확인한다.
26. **새 객체를 구성하는 입력이 기존 Container의 설정이기 때문이다.** Host의 값 변경만으로 기존 Container의 환경 변수가 갱신되지는 않는다. Compose가 새 값을 전달해 Container를 재생성해야 새 JVM이 그 설정을 읽을 수 있다.
27. **막지 않는다.** 문의 접수와 AI 처리는 분리된 작업이며, 비활성 Worker는 Provider를 호출하지 않는다. 접수 Transaction이 Commit되면 원문과 `PENDING` Job이 남는다. DB 연결처럼 접수에 필요한 설정은 별도로 갖춰야 한다.
28. **아니다.** Compose 파일의 설정 해석·구성 검증이 통과한 것이다. 실제 DB 계정 연결·Migration·HTTP 접수와 Row 저장은 실행해 따로 확인한다.
29. **활성화 설정과 객체 제공은 다른 일이기 때문이다.** 설정값은 Worker 구성을 적용할 조건이며, 실제 처리는 Provider 등 필요한 객체에 의존한다. 이 구성에서 Provider를 제공하지 않으면 Spring이 기동에 실패한다.
30. **아니다.** 파일을 Spring의 Property로 읽고 Configuration에서 Provider 객체에 전달해야 한다. Docker의 파일 제공, Spring의 설정 읽기, Provider Bean 등록은 서로 다른 단계다.
31. **AI에 요청하는 App에만 제공한다.** PostgreSQL은 AI Key를 필요로 하지 않는다. 파일을 읽을 Service·사용자, Host 원본 파일과 Docker 관리 권한을 제한하고 비밀값이 Log에 남지 않도록 확인한다.
