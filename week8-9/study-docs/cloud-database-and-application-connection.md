# AWS 배포에서 프로그램과 DB를 연결하는 순서

Helpdesk와 PostgreSQL은 서로 다른 프로그램이다. Helpdesk는 HTTP 요청을 처리하고, PostgreSQL은 데이터를 저장한다. Cloud에 배포할 때도 프로그램 파일 준비, DB 준비, Helpdesk 실행, 사용자 접속을 나누어 연결한다.

이 자료는 각 서비스의 상세 설정보다 **어떤 프로그램이 무엇에 접속하고, 어떤 계정을 사용하는지**를 먼저 설명한다.

## Image와 DB가 있어도 App은 따로 실행한다

| 대상 | 맡는 일 |
|---|---|
| ECR | Container Image를 보관한다. Image 자체는 실행 중인 프로그램이 아니다. |
| ECS Fargate | 선택한 Image와 실행 설정으로 Container를 시작한다. 그 안에서 Helpdesk의 JVM과 Spring이 실행된다. |
| RDS PostgreSQL | Helpdesk와 별도로 실행되는 DB다. App이 종료돼도 DB가 Commit한 데이터를 보관한다. |
| CloudShell | 관리자가 명령을 실행하는 환경이다. 여기서 `psql`을 실행해 DB를 관리할 수 있다. |
| Parameter Store | DB·로그인에 사용할 설정값을 보관한다. 값의 등록이 DB 계정 생성이나 App 실행을 대신하지는 않는다. |

Task Definition은 실행할 Image·자원·설정 등을 적은 명세다. 그 명세로 Task를 시작해야 Container 안에서 JVM이 실행된다. [AWS Task Definition](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html)

## CloudShell의 DB 접속과 App의 DB 접속

같은 PostgreSQL 서버에 접속해도 접속하는 Client 프로그램이 다르다.

```text
DB 관리와 접속 점검
  CloudShell의 psql ── DB 연결 ──> RDS PostgreSQL

Helpdesk의 업무 처리
  Browser ── HTTP 요청 ──> Helpdesk의 JVM
                              └── JDBC 연결 ──> RDS PostgreSQL
```

`psql`은 SQL을 직접 실행하는 Client이고, JDBC는 Java가 DB에 접속할 때 사용하는 방식이다. CloudShell에서 App용 DB 계정으로 로그인했다는 것은 `psql`이 그 계정으로 접속했다는 뜻이다. Helpdesk의 Controller·Service·Repository가 실행됐다는 뜻은 아니다.

두 Client에는 별도의 실행 환경과 Network 경로가 있다. CloudShell의 접속 성공 뒤에는 Helpdesk가 실행될 환경에서도 DB 주소·연결 경로·인증서·계정 설정을 확인해야 한다.

## 비슷한 이름의 계정을 구분한다

| 신원 | 사용하는 주체 | 확인하는 시스템 |
|---|---|---|
| `helpdesk-deployer` | AWS Console에서 배포 작업을 하는 사람 | AWS 로그인과 IAM Policy |
| ECS Execution Role | Image·설정값·Log를 준비하는 ECS Agent | AWS IAM |
| RDS 관리자 `postgres` | DB 계정과 권한을 준비하는 관리자 Client | PostgreSQL |
| App DB 계정 `helpdesk_app` | Helpdesk의 JDBC 또는 접속 점검용 psql | PostgreSQL |
| Helpdesk USER·AGENT | Browser에서 문의를 접수하거나 조회하는 사람 | Helpdesk의 Spring Security |

ECS Agent는 실행 명세에 따라 준비 작업을 수행하는 프로그램이며 AI Agent가 아니다. Execution Role은 ECR Image 읽기·지정 Parameter 읽기·Log 전송 같은 AWS 작업을 허용한다. 그 권한이 PostgreSQL Password 인증을 대신하지는 않는다. [AWS Execution Role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html)

App용 DB 계정도 Helpdesk의 `ROLE_USER`·`ROLE_AGENT`와 다르다. JDBC는 App DB 계정으로 연결하고, 고객의 조회·접수 권한은 Spring Security가 요청별로 검사한다.

`\password helpdesk_app`은 App DB 계정의 암호를 설정하는 psql 명령이다. 새 암호와 확인 암호를 입력하는 단계이지, AWS 로그인 암호나 마스터 암호를 입력해 기존 신원을 인증하는 단계가 아니다. 암호 값은 명령문·문서·Log에 적지 않는다.

## DB 접속의 네 가지 확인

| 확인 | 묻는 내용 |
|---|---|
| Network | 이 Client에서 RDS의 5432 Port까지 연결할 수 있는가? |
| TLS | 연결이 암호화되고, 접속 대상의 인증서와 이름이 맞는가? |
| DB 인증 | PostgreSQL이 이 DB 계정의 Password를 받아들이는가? |
| DB 권한 | 인증된 계정이 필요한 Schema와 Table에서 작업할 수 있는가? |

Security Group이 통과해도 잘못된 DB Password는 거부될 수 있다. Password가 맞아도 Table 생성 권한이 없을 수 있다. 실패한 단계의 설정을 확인해야 한다.

`sslmode=verify-full`은 암호화와 함께 서버 인증서·Hostname을 확인한다. 공개 CA 인증서는 서버 인증서를 확인하는 기준이고, Password는 DB 사용자 인증에 쓰는 비밀값이다. 둘은 서로 대체할 수 없다. [RDS PostgreSQL TLS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html), [pgJDBC SSL](https://jdbc.postgresql.org/documentation/ssl/)

## Parameter Store의 값은 어떻게 App에 전달되는가

Helpdesk의 첫 배포 구성은 다음 방식으로 DB 설정을 전달한다.

```text
Parameter Store의 DB 사용자명과 Password
    ↓ ECS Agent가 Execution Role로 읽음
새 Container의 환경 변수
    ↓ Spring이 설정을 읽음
DataSource와 JDBC Client
    ↓ PostgreSQL 계정으로 TLS 연결
RDS의 helpdesk DB
```

DataSource는 Java가 DB 연결을 얻을 때 사용하는 객체다. Task Definition에는 실제 Password 대신 Parameter 참조를 적고, ECS Agent가 새 Container를 시작할 때 그 값을 전달한다. [ECS Parameter 전달](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-ssm-paramstore.html)

Parameter Store에 보관한 Password와 PostgreSQL 계정에 설정한 Password는 일치해야 한다. 값을 저장한 것만으로 DB의 Password가 변경되거나 기존 Task의 설정이 갱신되지는 않는다. 상세한 설정 전달은 [Spring 설정과 Bean 자료](./spring-settings-bean-and-secret-wiring.md#standard-securestring을-전달하는-순서)에서 이어진다.

### 값 변경과 Image 변경을 구분한다

DB Password만 변경했다면 JAR의 코드와 Image 파일은 그대로다. 새 Task를 시작할 때 ECS Agent가 변경된 값을 전달하고, 새 JVM의 Spring 객체가 그 설정으로 만들어진다. 실행 중인 Task에는 Parameter 변경이 자동 반영되지 않는다. [Secret 변경 뒤 새 Task 실행](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-ssm-paramstore.html)

```text
같은 Image + 같은 Task Definition + 갱신한 Parameter
    ↓ 새 Task 시작
새 환경 변수 → 새 DataSource → DB Password 인증
```

Parameter Store의 암호만 고치거나 DB의 암호만 고쳐서 두 값이 달라지면 인증은 여전히 실패한다. 알고 있는 올바른 App 암호를 기준으로 일치시키며, 암호 자체를 출력해서 비교하지 않는다.

## Task 실행과 Spring 준비 완료를 구분한다

ECS의 `RUNNING`은 Container의 실행 상태다. 그 안에서 Spring이 DB 연결이나 Bean 조립에 실패하면, 업무 요청을 처리할 준비를 마치지 못한 채 Process가 종료될 수 있다.

| 관찰 | 의미와 다음 확인 |
|---|---|
| Image Pull 성공 | ECR에서 실행 파일을 받았다. Spring 기동 성공은 다음 확인이다. |
| Parameter 전달 뒤 JVM 시작 | 실행 준비를 진행했다. 전달된 Password가 DB에서 유효한지는 따로 검사한다. |
| PostgreSQL `28P01` | DB Password 인증이 거부됐다. Execution Role 권한을 넓히는 대신 DB 계정·전달 설정을 확인한다. |
| Flyway 적용·Spring 기동 완료 | DB 연결과 기동을 마쳤다. 실제 접수·조회·Browser 보안 흐름은 다음 확인이다. |

`28P01`의 공식 이름은 `invalid_password`다. Spring의 바깥쪽 오류가 `Bean 생성 실패`라고 표시되더라도, 연결된 예외의 원인이 DB 인증 실패인지 확인해야 한다. 같은 원인이 여러 예외에 반복된 Log를 별개의 실행 횟수로 세지 않는다. [PostgreSQL 오류 코드](https://www.postgresql.org/docs/17/errcodes-appendix.html)

## Schema 권한과 Migration

Schema는 DB 안의 Table·Sequence 등을 묶는 이름 공간이다. `public`이라는 Schema 이름은 인터넷 공개 설정이라는 뜻이 아니다. [PostgreSQL Schema](https://www.postgresql.org/docs/17/ddl-schemas.html)

현재 Helpdesk는 같은 DataSource의 계정으로 Flyway를 실행한다. Flyway는 저장소의 Migration SQL을 DB에 적용해 필요한 Table 등을 준비하는 도구다. 따라서 App 계정에는 DB `CONNECT`뿐 아니라 기존 `public` Schema의 `USAGE`·`CREATE`도 필요하다. Schema 사용 권한만으로 모든 Table의 데이터 접근 권한까지 생기는 것은 아니며, 객체의 권한과 소유권도 구분한다.

DB 관리자는 App 계정과 Schema 권한을 준비하고, App은 기동 중 Migration을 실행한 뒤 Service·Repository의 업무 SQL을 처리한다. DB 접속만 가능한 계정과 Migration까지 실행할 계정에 필요한 권한은 다를 수 있다.

임시 Table 생성·INSERT·SELECT를 같은 Transaction에서 확인한 뒤 Rollback하면 실제 SQL 작업을 시험하면서 Table·Row를 남기지 않을 수 있다. 이 점검과 Flyway의 실제 Migration 적용, Helpdesk를 통한 Ticket 저장은 각각 다른 확인이다.

## 사용자 요청까지 연결하는 순서

1. 검사한 Source로 Image를 만들고 ECR에 보관한다.
2. DB 주소·계정·TLS·권한을 준비한다.
3. Task의 Image·Execution Role·설정 참조·Network를 정하고 Helpdesk를 실행한다.
4. Spring 기동·DB 연결·Flyway와 API 접수·조회를 확인한다.
5. ALB·DNS·HTTPS를 연결하고 Browser의 로그인·Session·Role·CSRF를 확인한다.
6. Provider·개인정보 처리기·Worker를 연결해 별도의 AI 처리와 제안 저장을 확인한다.

Helpdesk의 첫 Cloud 연결은 Provider·Worker를 끈 구성이다. 인증·CSRF를 통과한 문의가 접수되면 Ticket·Message·Job을 Commit하고 `201`을 반환한다. Job은 `PENDING`으로 남고 자동 AI 호출은 시작하지 않는다. 이후 전체 AI 구성을 별도로 연결한다.

## 핵심 질문

1. ECR에 Image가 있고 RDS가 실행 중이라면 Helpdesk의 Controller도 이미 실행 중인가?
2. CloudShell에서 App DB 계정으로 접속한 것과 Helpdesk의 JDBC 접속은 무엇이 다른가?
3. Execution Role의 Parameter 읽기 권한과 PostgreSQL Password 인증은 같은 검사인가?
4. Parameter Store에 DB Password를 등록하면 PostgreSQL 계정도 만들어지는가?
5. 현재 App 계정에 Schema 생성 권한이 필요한 이유는 무엇인가?
6. AI를 끈 첫 배포에서 정상 접수한 Job은 어떤 상태이며 자동 호출은 몇 회인가?
7. DB Password만 바꾼 뒤 같은 Image를 사용할 수 있는 이유와 새 Task가 필요한 이유는 무엇인가?
8. Task가 `RUNNING`인데 Spring의 DB 인증이 실패했다면 App이 업무 요청을 처리할 준비를 마쳤다고 볼 수 있는가?

## 질문 해설

1. 아니다. Helpdesk를 실행할 Task를 시작하고 JVM·Spring이 기동해야 한다.
2. 접속하는 Client와 실행 환경이 다르다. 같은 계정으로 psql 접속이 성공해도 Java의 설정·Network·인증서 전달은 따로 확인한다.
3. 아니다. 전자는 ECS Agent의 AWS API 권한이고, 후자는 DB가 Client의 접속 신원을 확인하는 과정이다.
4. 아니다. 설정값 보관과 DB 계정 생성은 서로 다른 작업이다.
5. 같은 App DataSource 계정으로 Flyway를 실행해 Table 등을 만들기 때문이다.
6. `PENDING`이며 자동 호출은 0회다. 이 구성에서는 Provider·Worker가 비활성이다.
7. 실행 코드는 바뀌지 않고 설정값만 바뀌기 때문이다. ECS의 환경 변수 Secret은 Task 시작 시 전달되므로 새 Task로 변경된 값을 받아야 한다.
8. 아니다. Container 실행 상태와 Application 준비 완료를 구분하고, 원인 Log와 Spring 기동·업무 요청 결과를 확인한다.

## 함께 읽을 자료

- [검증한 Image를 ECR에서 ECS로 전달하기](./image-publishing-and-ecs-execution.md)
- [Spring 설정과 Bean으로 Provider 연결하기](./spring-settings-bean-and-secret-wiring.md)
- [AWS Network와 DNS 그리고 HTTPS 요청 흐름](./aws-network-dns-and-https.md)
