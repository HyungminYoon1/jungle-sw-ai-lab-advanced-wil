# Learning Note — Repository Port·PostgreSQL Adapter·Migration·Testcontainers

> 핵심 질문: Application의 저장 계약을 유지하면서 In-memory 구현을 실제 PostgreSQL 구현으로 어떻게 교체하고 검증할 것인가?

## In-memory 저장소만 사용하는 출발 구조

Repository Port를 먼저 이해하기 위한 예제 구조는 다음과 같다.

```text
TicketController
    ↓
TicketApplicationService
    ↓
TicketRepository interface
    ↓
InMemoryTicketRepository
```

`TicketRepository`가 제공하는 계약은 두 개다.

```java
long save(Ticket ticket);

Optional<Ticket> findById(long id);
```

`InMemoryTicketRepository`는 `HashMap`과 `nextId`로 이 계약을 구현한다. Application Service는 구체적인 `HashMap`을 알지 않고 `TicketRepository`에만 의존한다.

이 구조의 Test는 In-memory Adapter의 계약을 검증하지만 PostgreSQL SQL·Migration·Constraint·Driver를 검증하지 않는다.

## Port와 Adapter

### Port

Port는 Application이 외부 저장소에 요구하는 동작을 표현한 계약이다. 예제에서는 `TicketRepository` Interface가 이 역할을 한다.

```text
Application의 관점
→ Ticket을 저장하고 ID를 받고 싶다.
→ ID로 Ticket을 찾고 싶다.
→ 저장 위치가 HashMap인지 PostgreSQL인지는 계약에 드러내지 않는다.
```

### Adapter

Adapter는 Port 계약을 특정 기술로 구현한다.

```text
TicketRepository Port
├─ InMemoryTicketRepository Adapter
└─ PostgreSqlTicketRepository Adapter
```

의존 관계를 그림으로 보면 다음과 같다.

```text
Web Adapter
TicketController
        │
        ▼
Application
TicketApplicationService
        │
        ▼
Port
TicketRepository
        ▲
        │ implements
        ├───────────────────────────┐
        │                           │
In-memory Adapter           PostgreSQL Adapter
HashMap                     JdbcTemplate + SQL
```

Application은 PostgreSQL Adapter를 직접 호출하지 않는다. 두 Adapter가 Application이 정의한 같은 Port를 향해 들어온다.

## Controller가 Database에 직접 접근하면 안 되는 이유

Controller의 책임은 HTTP 입력을 Application 입력으로 바꾸고 결과를 HTTP Response로 바꾸는 것이다. SQL과 Transaction 규칙까지 Controller가 가지면 다음 문제가 생긴다.

- HTTP 처리와 업무 흐름, 저장 기술이 한 Class에 섞인다.
- 같은 Use Case를 다른 입력 경로에서 재사용하기 어렵다.
- Database 없이 Application 규칙을 검증하기 어렵다.
- 저장 기술을 바꿀 때 Web Code까지 수정해야 한다.
- Transaction 경계가 여러 Controller Method에 흩어진다.

저장 기술을 교체할 때도 다음 방향을 유지한다.

```text
Controller
→ Application Service
→ Repository Port
→ PostgreSQL Adapter
```

## 두 구현을 동시에 Bean으로 만들 때 생기는 문제

`InMemoryTicketRepository`와 PostgreSQL 구현에 모두 `@Repository`를 붙이면 `TicketRepository` Type의 Bean이 두 개가 될 수 있다.

```text
TicketApplicationService(TicketRepository repository)
                           ↑
                어느 구현을 넣어야 하는가?
```

Spring이 선택할 근거가 없으면 Application Context 시작이 실패할 수 있다. 구현 Class를 작성하는 것만으로 교체가 끝나지 않는 이유다.

대표적인 선택 방법은 다음과 같다.

| 방법 | 장점 | 주의점 |
|---|---|---|
| Profile별 Bean 구성 | Local·Test 실행 목적을 분명히 구분 가능 | 어떤 Profile이 실제 Adapter인지 문서화 필요 |
| 명시적 `@Configuration`과 `@Bean` | 조립 위치에서 선택을 한눈에 확인 가능 | Component Scan과 중복 등록 주의 |
| 조건부 Bean | 의존성·설정에 따라 자동 선택 가능 | 학습 범위보다 조건이 복잡해질 수 있음 |
| `@Primary` | 선택 충돌을 빠르게 해소 | 왜 그 구현이 기본인지 숨길 수 있음 |

실제 Runtime은 PostgreSQL, 독립적인 단위 Test는 In-memory 또는 Test Double로 나누려면 목적이 드러나는 Profile이나 명시적 Configuration을 사용한다.

## Spring JDBC와 JPA 중 하나만 선택한다

두 기술을 동시에 구현하면 학습 근거보다 중복 Code가 늘어난다.

용어, 객체 생명주기와 선택 기준의 상세 비교는 [Spring JDBC와 JPA의 차이와 선택 기준](./spring-jdbc-and-jpa-selection-guide.md)에 정리한다.

| 관점 | Spring JDBC | JPA |
|---|---|---|
| SQL | 직접 작성하고 관찰 | ORM이 생성하는 SQL이 많음 |
| Row Mapping | 직접 작성 | Entity Mapping 중심 |
| 상태 변경 | 명시적 SQL | Persistence Context·Dirty Checking 사용 가능 |
| 관계 학습 | 직접 Join·Query 설계 | Entity 관계·Fetch 전략·N+1 학습 가능 |
| 작은 생성·단건 조회 Scope | 흐름을 직접 추적하기 쉬움 | 관계가 없으면 ORM 핵심 문제를 관찰하기 어려움 |

Ticket 생성과 단건 조회만 있고 ORM 관계나 N+1을 재현할 Domain 관계가 없는 Helpdesk 예제에서는 SQL·Constraint·Transaction과 Row Mapping을 직접 관찰할 수 있다.

다음 질문으로 한 방식을 선택한다.

1. 직접 작성한 SQL과 Parameter Binding을 관찰해야 하는가?
2. JPA 관계 Mapping으로 검증할 실제 Domain 관계가 있는가?
3. 더 작은 구현으로 Migration·Constraint·Transaction 근거를 만들 수 있는 쪽은 무엇인가?
4. Port가 특정 Framework Repository Interface에 종속되지 않게 유지되는가?

## Database 행과 Domain 객체는 같은 것이 아니다

후보 Table은 최소한 다음 정보를 저장해야 한다.

```text
tickets
├─ id
├─ title
└─ status
```

하지만 Column을 그대로 Java Field에 넣는 것만으로 Mapping이 끝나는 것은 아니다.

### `Ticket`의 복원 문제

`new Ticket(title)`은 항상 `status = OPEN`으로 시작한다.

```text
Database Row
status = RESOLVED
        ↓
new Ticket(title)
        ↓
status = OPEN
```

이렇게 단순 생성하면 Database의 상태를 잃는다. 반대로 `startProgress()`와 `resolve()`를 순서대로 호출해 상태를 흉내 내면 조회 과정이 업무 명령을 다시 실행하는 꼴이 된다.

구현 전 다음 중 어떤 복원 경계를 둘지 결정해야 한다.

- 검증을 거치는 명시적 Reconstitution Factory
- 저장 상태를 받는 제한된 생성 경로
- Persistence 전용 Row Model에서 Domain으로 변환하는 Mapper

어느 방법을 택하든 잘못된 Status 문자열을 조용히 `OPEN`으로 바꾸면 안 된다. Database Constraint와 Mapping Test로 실패를 드러내야 한다.

### ID의 위치

예제의 `Ticket` Domain 객체에는 ID가 없고 `save`가 `long` ID를 반환한다. `findById` 뒤 Application Service는 조회에 사용한 ID와 반환된 `Ticket`을 조합해 `TicketResult`를 만든다.

이 계약을 그대로 유지할지, ID를 Domain Identity로 포함할지는 별도 설계 문제다. PostgreSQL을 붙인다는 이유만으로 공개 Port를 먼저 크게 바꾸지 않는다. 최소 Adapter로 기존 계약이 가능한지 먼저 검증한다.

## Schema Constraint는 Domain 검증을 대체하지 않는다

Domain과 Database는 서로 다른 경계에서 잘못된 상태를 막는다.

```text
Domain 검증
→ 정상 Application 경로에서 잘못된 Ticket 생성을 빠르게 차단

Database Constraint
→ 다른 Code 경로, Migration 실수나 동시 요청이 있어도 저장 상태 보호
```

후보 Constraint는 다음과 같다.

- `id`: Primary Key와 자동 생성 전략
- `title`: `NOT NULL`과 빈 문자열 정책
- `status`: `NOT NULL`과 허용 값 제한

정확한 SQL은 Domain의 공백 판정과 Status 표현을 비교한 뒤 Migration에서 확정한다. Java의 `String.isBlank()`와 PostgreSQL의 단순 `btrim`은 모든 Unicode 공백에서 완전히 같은 계약이 아닐 수 있으므로 “Constraint가 있으니 동일하다”고 단정하지 않는다.

## Migration은 Schema 변경의 재현 기록이다

개발자가 Local Database에 수동으로 `CREATE TABLE`을 한 번 실행하면 다른 사람과 Test 환경은 그 과정을 알 수 없다. Versioned Migration은 Schema 변경을 Source로 남기고 순서대로 적용한다.

```text
빈 PostgreSQL
→ V1__create_tickets.sql 적용
→ 동일한 tickets Schema 생성
→ Migration History에 Version·Checksum 기록
```

Versioned Migration의 기본 원칙:

1. Migration File을 Version Control에 포함한다.
2. 아직 적용되지 않은 Version을 순서대로 실행한다.
3. 이미 영구 환경에 적용한 Version File을 임의 수정하지 않는다.
4. 변경이 필요하면 새 Version Migration을 추가해 앞으로 전진한다.
5. Application 시작 성공만 보지 않고 실제 Table·Constraint를 Test한다.

Migration은 Application Entity에서 Runtime마다 자동으로 DDL을 추측해 만드는 것과 목적이 다르다. Versioned Migration은 빈 Database에서 같은 Schema를 재현할 수 있어야 한다.

## Spring JDBC Adapter에서 관찰할 것

Spring의 `JdbcTemplate`은 Connection과 Statement 같은 JDBC Resource의 획득·해제를 처리하고, Application Code는 SQL·Parameter·Row Mapping에 집중하게 한다.

예상되는 책임 경계는 다음과 같다.

```text
PostgreSqlTicketRepository
├─ INSERT SQL과 Parameter Binding
├─ 생성된 ID 반환
├─ SELECT SQL
├─ ResultSet → Ticket Mapping
└─ Database Exception을 어떤 경계에서 전달·변환할지 결정
```

이 Adapter에 HTTP Status를 넣지 않는다. Database Exception을 바로 `404`나 `500`으로 결정하는 책임도 Repository에 두지 않는다. HTTP Mapping은 Web 경계, 업무상 Not Found 판정은 Application 경계에 남긴다.

SQL Parameter는 문자열을 이어 붙이지 않고 JDBC Parameter Binding을 사용한다. 이는 SQL Injection 방어뿐 아니라 Type 변환과 SQL 가독성에도 중요하다.

## Transaction은 여러 변경을 하나의 작업으로 묶는다

Transaction은 여러 Database 변경을 모두 반영하거나 모두 취소하는 경계다.

```text
BEGIN
→ 첫 번째 변경 성공
→ 두 번째 변경 실패
→ ROLLBACK
→ 첫 번째 변경도 남지 않음
```

Ticket 생성이 단일 `INSERT`인 예제에서는 “INSERT가 실패했다”는 사실만으로 부분 반영 Rollback을 충분히 보여 주기 어렵다. 의미 있는 Rollback Test에는 하나의 Use Case 안에서 둘 이상의 변경이 있거나, 성공한 변경 뒤 실패하도록 통제된 경계가 필요하다.

학습을 위해 제품에 억지 기능을 추가하지 않는다. 먼저 다음을 구분한다.

- 단일 Statement 실패가 Row를 남기지 않는 Constraint Test
- 여러 Statement가 한 업무 단위로 묶이는 Transaction Rollback Test

실제 Use Case가 없는 상태라면 인위적인 Test Fixture를 Production 기능처럼 포장하지 않고 Lab 전용 재현임을 명시한다.

## Testcontainers가 증명하는 것

Testcontainers는 Test 실행 중 실제 PostgreSQL Container를 시작해 Application Code가 실제 PostgreSQL Protocol과 SQL 동작을 사용하도록 한다.

```text
JUnit
→ PostgreSQL Container 시작
→ Connection 정보 제공
→ Migration 적용
→ Repository Test 실행
→ Container 종료
```

In-memory Fake와 다른 점:

- PostgreSQL의 실제 SQL 문법을 사용한다.
- PostgreSQL Constraint와 Transaction 동작을 검증한다.
- Row Mapping과 Driver 설정 오류를 발견할 수 있다.
- 알려진 초기 상태로 반복 실행할 수 있다.

Testcontainers Test가 증명하지 않는 것도 있다.

- Production Database 운영 설정 전체
- 장시간 보존, Backup과 복구
- 실제 Network Latency와 장애 조치
- 배포 환경의 Secret 주입이 올바르다는 사실

Container가 Test 뒤 제거되더라도 Test 중 실제 PostgreSQL을 사용했다는 점은 유효하다. 다만 이것을 외부 영구 Database 운영 근거로 확대하지 않는다.

## Test 계층별 증명 범위

| Test | 실제로 증명하는 것 | 증명하지 못하는 것 |
|---|---|---|
| Domain Unit Test | Ticket 상태 전이와 불변식 | SQL·Migration·Driver |
| In-memory Repository Test | In-memory 구현의 Port 동작 | PostgreSQL 문법·Constraint |
| PostgreSQL Repository Integration Test | Migration·SQL·Row Mapping·Constraint | Controller·Security 전체 |
| Security Integration Test | Filter Chain·Session·Role·CSRF 계약 | 실제 PostgreSQL을 쓰지 않으면 영속성 |
| Browser E2E | 실제 조립된 Browser→Security→DB 흐름 | 검증하지 않은 장애·운영 환경 전체 |

같은 `save`·`findById` 계약을 In-memory와 PostgreSQL Adapter에 공통으로 적용할 수 있으면 구현 차이를 비교하기 좋다. 다만 Fake에 맞춘 느슨한 계약 때문에 PostgreSQL 실패를 숨기지 않도록 실제 Database 전용 Case도 둔다.

## 최소 Integration Test 목록

다음은 PostgreSQL Adapter를 검증하기 위한 최소 Test 목록이다.

### Migration

- 빈 PostgreSQL에 Migration이 자동 적용된다.
- `tickets` Table과 핵심 Constraint가 존재한다.
- 이미 적용한 Migration을 다시 시작해도 중복 생성하지 않는다.

### Repository 정상 흐름

- `OPEN` Ticket을 저장하면 생성 ID를 받는다.
- 저장한 ID로 조회하면 Title과 Status가 보존된다.
- 존재하지 않는 ID는 `Optional.empty()`다.
- `IN_PROGRESS`·`RESOLVED` 상태를 저장·조회할 계약이 있다면 상태가 보존된다.

### 실패 흐름

- 허용되지 않은 Status는 Database가 거부한다.
- 잘못된 Title이 Domain 또는 Database의 의도한 경계에서 거부된다.
- SQL·Mapping 실패를 다른 실패와 구분한다.
- 의미 있는 복수 변경이 있을 때 실패 후 부분 데이터가 남지 않는다.

### 조립과 영속성

- 실제 Runtime 조립에서 PostgreSQL Adapter 하나가 선택된다.
- 같은 Database를 유지한 채 Application을 다시 시작해도 저장한 Ticket을 조회한다.
- 이 결과를 Testcontainers Container 재생성 뒤 데이터 보존과 혼동하지 않는다.

## 구현 순서

```text
1. Port와 Domain 복원 문제 확인
        ↓
2. Spring JDBC / JPA 선택
        ↓
3. Bean 선택과 실행 환경 조립 방법 결정
        ↓
4. 최소 의존성과 PostgreSQL Driver 추가
        ↓
5. 첫 Versioned Migration 작성
        ↓
6. PostgreSQL Adapter 작성
        ↓
7. 실제 PostgreSQL Integration Test
        ↓
8. Constraint·Mapping·Transaction 실패 Test
        ↓
9. In-memory Application 회귀
        ↓
10. 실제 Runtime·Browser 수직 흐름 연결
```

Driver, Flyway와 Testcontainers의 정확한 Artifact 조합은 사용하는 Spring Boot Version의 공식 문서에서 확인한다. 기억에 의존해 Version을 직접 고정하지 않는다.

## 설계 질문

1. `TicketRepository`는 Port인가, PostgreSQL 전용 Interface인가?
2. `TicketApplicationService`가 `JdbcTemplate`을 직접 가져서는 안 되는 이유는 무엇인가?
3. 두 Repository 구현이 모두 Bean이면 어떤 문제가 생기는가?
4. 예제 Domain에서 Spring JDBC가 JPA보다 작은 학습 근거를 만드는 이유는 무엇인가?
5. Database의 `RESOLVED` Row를 `new Ticket(title)`만으로 복원하면 어떤 정보가 사라지는가?
6. Migration File과 수동 `CREATE TABLE`은 재현성에서 무엇이 다른가?
7. In-memory Repository Test가 통과해도 Testcontainers Test가 필요한 이유는 무엇인가?
8. 단일 `INSERT` 실패와 여러 변경의 Transaction Rollback은 무엇이 다른가?

## 흔한 오해

| 오해 | 교정 |
|---|---|
| Interface가 있으면 PostgreSQL 연결도 끝났다. | Port만 있고 실제 Adapter·Driver·Migration은 별도다. |
| In-memory Test 통과는 실제 Database 근거다. | PostgreSQL SQL·Constraint·Transaction은 실제 PostgreSQL에서 검증한다. |
| JPA가 더 고급이므로 언제나 더 적합하다. | 학습 질문과 Domain 관계에 맞춰 JDBC 또는 JPA 하나를 선택한다. |
| `@Repository` 구현을 하나 더 만들면 자동 교체된다. | 같은 Port Bean이 둘이면 명시적 선택이 필요하다. |
| Row를 읽어 생성자에 넣으면 Domain 복원이 끝난다. | 예제 생성자는 Status를 `OPEN`으로 초기화하므로 복원 경계가 필요하다. |
| Migration 적용 성공이면 모든 Constraint가 맞다. | 실제 Constraint 정상·실패 Case를 Test해야 한다. |
| Testcontainers는 Fake Database다. | Container 안에서 실제 PostgreSQL Engine이 실행된다. |
| Container Test 통과는 Production 운영 검증이다. | 실제 SQL 통합 근거이지 운영 전체 근거는 아니다. |

## 검증 근거를 구분하는 원칙

- 설계 문서와 Adapter 실행 근거는 다르다.
- 의존성 추가는 PostgreSQL 연결 근거가 아니다.
- Migration File 작성은 빈 Database 적용 근거가 아니다.
- Testcontainers 설정은 Integration Test 통과 근거가 아니다.
- In-memory Test와 PostgreSQL Integration Test는 검증 대상이 다르다.
- Test 결과에는 Test 수·실패·오류·건너뜀과 사용한 Database 종류를 함께 기록한다.

## 공식 참고 자료

- [Spring Boot — SQL Databases](https://docs.spring.io/spring-boot/reference/data/sql.html)
- [Spring Framework — Using the JDBC Core Classes](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)
- [Spring Boot — Testcontainers](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html)
- [Testcontainers for Java — PostgreSQL Module](https://java.testcontainers.org/modules/databases/postgres/)
- [Testcontainers for Java — Database Containers](https://java.testcontainers.org/modules/databases/)
- [Flyway — Versioned Migrations](https://documentation.red-gate.com/fd/versioned-migrations-273973333.html)
- [PostgreSQL — Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL — Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
