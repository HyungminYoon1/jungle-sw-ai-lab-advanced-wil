# Learning Note — Spring JDBC와 JPA의 차이와 선택 기준

> 핵심 질문: 관계형 Database를 사용하는 두 방식은 무엇을 직접 다루고 무엇을 Framework에 맡기며, Helpdesk 예제에는 어느 쪽이 학습 목표에 맞는가?

## 결론부터 구분하기

Spring JDBC와 JPA 중 항상 더 좋은 하나는 없다. 두 방식은 관계형 Database를 다루는 추상화 수준과 개발자가 책임지는 범위가 다르다.

```text
Spring JDBC
→ SQL·Parameter·Row Mapping을 개발자가 명시
→ Connection·Statement·ResultSet 반복 처리는 Framework가 보조

JPA
→ Java Entity와 관계·생명주기를 중심으로 표현
→ Persistence Provider가 Mapping과 SQL 생성을 담당
→ 개발자는 Persistence Context와 Entity 상태를 이해해야 함
```

생성·단건 조회만 있고 Entity 관계가 없는 Helpdesk 예제에서 SQL·Constraint·Transaction과 Row Mapping을 직접 관찰하려면 Spring JDBC가 더 작은 구현으로 직접적인 근거를 만든다.

이 결론은 “JPA가 나쁘다”거나 “JDBC가 항상 빠르다”는 뜻이 아니다. 학습 질문과 Domain 형태에 맞춘 선택이다.

## 먼저 용어를 분리한다

### JDBC

JDBC는 Java Code가 관계형 Database와 통신하기 위한 표준 API다. 핵심 객체에는 `DataSource`, `Connection`, `PreparedStatement`와 `ResultSet` 등이 있다.

순수 JDBC에서는 다음 반복 작업을 직접 관리해야 한다.

```text
Connection 획득
→ PreparedStatement 생성
→ Parameter Binding
→ SQL 실행
→ ResultSet 순회
→ Java 객체로 변환
→ Resource 정리
→ SQLException 처리
```

### Spring JDBC

Spring JDBC는 JDBC를 없애는 기술이 아니라 JDBC의 반복적인 Resource 관리와 Exception 변환을 보조한다. `JdbcTemplate`은 Connection·Statement 같은 Resource의 획득과 해제, SQL 실행과 `SQLException`의 `DataAccessException` 변환을 담당한다. 개발자는 SQL·Parameter와 결과 추출에 집중한다.

```text
개발자가 명시하는 것
→ SQL
→ Parameter
→ Row Mapping

Spring JDBC가 보조하는 것
→ JDBC Resource 관리
→ Statement 실행 흐름
→ SQLException 변환
```

### JPA

JPA는 현재 Jakarta Persistence라고 부르는 Java의 Object–Relational Mapping 표준이다. JPA 자체는 Interface와 동작 규약이며 실제 동작에는 Hibernate 같은 Persistence Provider가 필요하다.

```text
Application
→ JPA API
→ Hibernate 같은 Provider
→ JDBC
→ PostgreSQL
```

JPA는 Entity를 Persistence Context에서 관리한다. 같은 영속 Identity에 대해 하나의 관리 객체를 유지하고, 관리 상태의 변경을 감지해 Transaction의 Flush 시점에 SQL로 동기화할 수 있다.

### Hibernate

Hibernate는 널리 사용되는 JPA Provider다. JPA 표준 동작을 구현하며 Hibernate 전용 기능도 제공한다. 따라서 다음 두 문장은 같은 뜻이 아니다.

```text
JPA를 사용한다.
→ 표준 Persistence API를 기준으로 Code를 작성한다.

Hibernate를 사용한다.
→ JPA 구현체로 Hibernate를 사용하거나 Hibernate 전용 API도 사용할 수 있다.
```

### Spring Data JPA

Spring Data JPA는 JPA 위에 Repository 추상화를 추가한다. Repository Interface와 Method 이름, `@Query` 등을 이용해 반복적인 Data Access Code를 줄일 수 있다.

```text
Spring Data JPA
→ JPA를 대신하는 ORM 표준이 아님
→ Hibernate를 대신하는 Provider가 아님
→ JPA 위에서 Repository 작성을 보조하는 Spring Data 모듈
```

## 같은 Ticket 흐름을 두 방식으로 비교하기

### Spring JDBC 흐름

```text
TicketApplicationService
→ TicketRepository Port
→ JdbcTicketRepository
→ JdbcTemplate
→ 명시적인 INSERT·SELECT SQL
→ PostgreSQL
```

다음은 책임을 축약한 개념 Code다.

```java
long save(Ticket ticket) {
    // INSERT SQL과 Parameter를 명시하고 생성된 ID를 받는다.
}

Optional<Ticket> findById(long id) {
    // SELECT SQL을 명시한다.
    // ResultSet의 title·status를 Ticket으로 복원한다.
}
```

Java 객체를 변경한다고 SQL이 자동 실행되지는 않는다. 상태 변경을 Database에 반영하려면 명시적인 `UPDATE`가 필요하다.

### JPA 흐름

```text
TicketApplicationService
→ TicketRepository Port
→ JPA Adapter 또는 Spring Data JPA Repository
→ EntityManager와 Persistence Context
→ Hibernate 같은 Provider가 SQL 생성
→ JDBC
→ PostgreSQL
```

관리 상태의 Entity를 Transaction 안에서 변경하면 JPA Provider가 변경을 감지한다. SQL은 Java Field를 바꾼 바로 그 줄이 아니라 Flush나 Commit과 연결된 시점에 실행될 수 있다.

```java
TicketEntity ticket = entityManager.find(
        TicketEntity.class,
        id);

ticket.startProgress();

// 관리 Entity의 변경을 Provider가 감지하고
// Flush 시점에 UPDATE SQL을 실행할 수 있다.
```

이 동작을 Dirty Checking이라고 부른다. 편리하지만 SQL 실행 시점과 Query 수를 보지 않으면 실제 Database 작업을 놓칠 수 있다.

## Persistence Context와 Entity 상태

JPA를 이해하려면 Annotation보다 Entity 상태를 먼저 알아야 한다.

| 상태 | 의미 |
|---|---|
| New | 아직 영속 Identity가 없고 Persistence Context에 속하지 않은 새 객체 |
| Managed | Persistence Context가 추적하는 Entity |
| Detached | 영속 Identity는 있지만 현재 Persistence Context가 관리하지 않는 Entity |
| Removed | Transaction 반영 시 삭제될 예정인 Entity |

관리 상태의 Entity는 변경 감지 대상이지만 Detached 객체를 바꾼다고 자동으로 Database가 갱신되는 것은 아니다. 또한 `persist()` 호출과 실제 `INSERT`, Java Field 변경과 실제 `UPDATE`의 정확한 시점은 Flush와 Transaction 경계를 함께 봐야 한다.

Spring JDBC에는 이런 관리 Entity 생명주기가 없다. `RowMapper`가 만든 `Ticket`은 일반 Java 객체이며, Database 변경은 실행한 SQL로만 일어난다.

## 핵심 차이 표

| 관점 | Spring JDBC | JPA |
|---|---|---|
| 중심 모델 | SQL과 Row | Entity와 관계 |
| SQL 작성 | 개발자가 직접 작성 | Provider가 생성하며 JPQL·Criteria·Native SQL도 사용 가능 |
| Parameter | 직접 Binding | Entity·Query Parameter를 Provider가 Mapping |
| 조회 결과 | `ResultSet`을 직접 Mapping | Provider가 Entity로 Mapping |
| 객체 상태 추적 | 없음 | Persistence Context가 Managed Entity 추적 |
| 변경 반영 | 명시적 `UPDATE` | Dirty Checking과 Flush 가능 |
| 관계 처리 | Join SQL과 조립을 직접 설계 | `@OneToMany` 같은 관계 Mapping과 Fetch 전략 사용 가능 |
| SQL 예측 | Code에서 비교적 직접 보임 | 생성 SQL·Flush·Fetch 전략을 별도로 관찰해야 함 |
| 반복 Code | SQL·Mapping Code가 늘 수 있음 | 일반 CRUD와 관계 Mapping의 반복을 줄일 수 있음 |
| Database 고유 기능 | Native SQL로 직접 사용하기 쉬움 | 표준 추상화 밖 기능에는 Native Query나 Provider 기능 필요 가능 |
| 대표 위험 | SQL·Mapping 중복, 수동 Query 설계 오류 | N+1, 의도하지 않은 Flush, Lazy Loading 경계, Entity 상태 혼동 |
| 적합한 학습 | SQL·Constraint·실행 계획·Mapping | ORM·Entity 생명주기·관계·Fetch 전략 |

## JPA를 사용해도 SQL과 Schema는 사라지지 않는다

JPA를 사용하더라도 Database에는 SQL이 실행되고 Table·Index·Constraint가 필요하다. ORM이 다음 책임을 없애지는 않는다.

- Schema 설계
- `NOT NULL`·`CHECK`·Foreign Key 같은 Constraint
- Transaction 경계
- 생성된 SQL과 Query 수 확인
- Index와 실행 계획 확인
- Migration과 운영 Schema 변경

Entity에서 Schema를 자동 추측해 생성한 결과만으로 Migration 검증을 대신할 수 없다. Spring JDBC와 JPA 어느 쪽을 선택해도 Versioned Migration과 실제 PostgreSQL Integration Test는 별도로 필요하다.

## N+1은 JPA만의 마법 같은 결함이 아니다

N+1은 한 번의 목록 조회 뒤 각 항목의 연관 데이터를 다시 조회해 Query가 반복되는 형태다.

```text
Ticket 목록 Query 1회
→ Ticket마다 Comment Query N회
→ 총 1 + N회
```

JPA에서는 객체 관계 탐색과 Lazy Loading 때문에 SQL이 Code 표면에 직접 보이지 않아 N+1을 놓치기 쉽다. 그러나 JDBC에서도 Loop 안에서 항목별 SELECT를 직접 실행하면 같은 Query 반복이 발생할 수 있다.

따라서 올바른 비교는 다음과 같다.

```text
JDBC는 N+1이 없다.                    X
JPA는 언제나 N+1이 발생한다.          X

두 방식 모두 Query 형태를 검증해야 한다. O
JPA는 Fetch 전략과 생성 SQL을 추가로 이해해야 한다. O
```

Ticket과 다른 Entity의 관계 Mapping이 없는 예제에서는 JPA N+1을 억지로 만들 필요가 없다.

## Transaction은 두 방식 모두 사용할 수 있다

Spring JDBC와 JPA 모두 Spring Transaction 관리와 함께 사용할 수 있다.

```java
@Transactional
public void someUseCase() {
    // 여러 Database 변경을 하나의 Transaction으로 묶음
}
```

차이는 Transaction 안에서 Database 변경을 표현하는 방식이다.

```text
Spring JDBC
→ 실행할 INSERT·UPDATE를 명시

JPA
→ Entity 상태 변화와 Persistence Context 동기화로 표현 가능
```

JPA를 선택했다고 Transaction이 자동으로 올바르게 설계되는 것도 아니고, JDBC를 선택했다고 Transaction을 사용할 수 없는 것도 아니다.

## Ticket 예제를 JPA Entity로 바로 바꿀 때의 비용

예제 Domain은 다음 특성을 가진다.

```text
final class Ticket
→ title은 final
→ ID Field 없음
→ 공개적인 No-arg Constructor 없음
→ 행동 Method로 상태 전이 보호
```

Jakarta Persistence Entity는 Provider가 객체를 만들고 상태를 관리할 수 있도록 Entity Class 형태에 제약을 둔다. 예제의 `Ticket`을 그대로 Entity로 Mapping하려면 Class·Constructor·Identity 설계를 변경해야 한다.

가능한 선택은 두 가지지만 둘 다 추가 판단이 필요하다.

1. Domain `Ticket` 자체를 JPA Entity 형태로 변경한다.
2. 별도 `JpaTicketEntity`와 Domain `Ticket` 사이에 Mapper를 둔다.

첫 번째는 Persistence 요구가 Domain 설계에 들어오고, 두 번째는 Entity·Domain 변환 Code가 추가된다. 이 비용이 나쁘다는 뜻은 아니지만, 관계 Mapping이 없는 생성·단건 조회 Scope에서는 JDBC의 명시적 Row Mapping보다 작은 근거를 만들지 못한다.

## 어떤 경우에 Spring JDBC가 잘 맞는가

- SQL 자체와 실행 계획을 중요한 설계 근거로 삼는다.
- Query 수와 실행 시점을 명시적으로 통제하고 싶다.
- Domain 관계가 단순하다.
- PostgreSQL 전용 SQL이나 기능을 직접 사용해야 한다.
- Row Mapping을 직접 작성해도 Scope가 작다.
- ORM 생명주기보다 SQL·Constraint·Transaction을 먼저 학습한다.

## 어떤 경우에 JPA가 잘 맞는가

- 여러 Entity 관계를 객체 Model로 다룬다.
- 일반적인 CRUD와 관계 Mapping의 반복 Code를 줄이는 이점이 크다.
- 팀이 Persistence Context·Flush·Entity 상태와 Fetch 전략을 이해한다.
- 생성 SQL과 Query 수를 지속적으로 관찰할 수 있다.
- Domain Model과 Entity Model의 결합 또는 분리 전략이 정해져 있다.

관계가 많다고 무조건 JPA가 정답인 것도 아니며, SQL이 복잡하다고 무조건 JDBC가 정답인 것도 아니다. 실제 Query·변경 패턴, 팀의 숙련도와 검증 방법을 함께 본다.

## Helpdesk 예제의 선택 기준

생성·단건 조회만 있는 Helpdesk 예제를 다음과 같이 판단할 수 있다.

| 질문 | 예제의 답 |
|---|---|
| 직접 SQL과 Parameter Binding을 관찰하려는가? | 그렇다. |
| Constraint·Transaction을 Code와 연결하려는가? | 그렇다. |
| 실제로 Mapping할 Entity 관계가 있는가? | 없다. |
| N+1을 재현할 관계 Query가 있는가? | 없다. |
| Domain을 JPA Entity로 바꾸는 것이 핵심 질문인가? | 아니다. |
| 생성·단건 조회에 더 작은 Adapter는 무엇인가? | Spring JDBC다. |

따라서 이 예제의 선택안은 다음과 같다.

```text
Spring JDBC
→ JdbcTemplate
→ 명시적 INSERT·SELECT
→ Parameter Binding
→ ResultSet에서 Ticket 복원
→ 실제 PostgreSQL Testcontainers Integration Test
```

Spring Data JPA와 JPA N+1은 실제 관계 Mapping과 Query 반복을 관찰할 질문이 생길 때 다룬다. 비교 목적이 아니라면 두 Adapter를 동시에 구현하지 않는다.

## 흔한 오해

| 오해 | 교정 |
|---|---|
| JPA를 쓰면 JDBC가 필요 없다. | JPA Provider도 일반적으로 JDBC를 통해 관계형 Database와 통신한다. |
| Spring Data JPA와 JPA는 같은 것이다. | Spring Data JPA는 JPA 위의 Repository 지원 모듈이다. |
| Hibernate와 JPA는 같은 것이다. | JPA는 표준이고 Hibernate는 대표적인 구현체다. |
| JPA는 SQL을 몰라도 된다. | 생성 SQL·Query 수·Index·Transaction을 검증해야 한다. |
| JDBC는 항상 더 빠르다. | 실제 SQL·Dataset·Mapping·Transaction과 측정 결과가 필요하다. |
| JPA는 항상 느리다. | 적절한 Mapping과 Query 설계에서는 생산성과 성능을 함께 얻을 수 있다. |
| JPA에만 N+1이 있다. | JDBC도 반복 SELECT를 작성하면 N+1 형태가 생긴다. |
| JPA가 Schema Migration을 대신한다. | 운영 가능한 Schema 변경 기록과 Constraint Test는 별도다. |

## 이해 점검 질문

1. Spring JDBC가 순수 JDBC보다 대신 처리하는 반복 작업은 무엇인가?
2. `JdbcTemplate`을 사용해도 개발자가 직접 결정하는 것은 무엇인가?
3. JPA와 Hibernate, Spring Data JPA는 각각 어떤 관계인가?
4. Managed Entity의 Field를 바꾼 직후 반드시 그 줄에서 `UPDATE`가 실행되는가?
5. Spring JDBC의 일반 Java 객체와 JPA Managed Entity는 상태 추적에서 무엇이 다른가?
6. JPA를 사용해도 Migration과 Constraint Test가 필요한 이유는 무엇인가?
7. 예제의 `Ticket`을 JPA Entity로 바로 Mapping할 때 어떤 설계 변경이 필요한가?
8. Helpdesk 예제에서 Spring JDBC가 더 작은 학습 근거를 만드는 이유는 무엇인가?

## 비교할 때의 한계

- 두 접근의 성능 우열은 실제 SQL·Dataset·Mapping·Transaction 조건을 측정해야 판단할 수 있다.
- JPA의 Dirty Checking과 N+1은 개념 설명만으로 입증되지 않으며, 실제 Entity 관계와 생성 SQL을 관찰해야 한다.
- 작은 생성·단건 조회 예제에 적합한 선택을 모든 Application에 일반화할 수 없다.

## 공식 참고 자료

- [Spring Framework — Using the JDBC Core Classes](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)
- [Spring Framework — Choosing an Approach for JDBC Database Access](https://docs.spring.io/spring-framework/reference/data-access/jdbc/choose-style.html)
- [Spring Framework — Introduction to ORM with Spring](https://docs.spring.io/spring-framework/reference/data-access/orm/introduction.html)
- [Jakarta Persistence 3.2 Specification](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2)
- [Jakarta Persistence 3.2 — `Entity`](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/entity)
- [Jakarta Persistence 3.2 — `EntityManager`](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/entitymanager)
- [Spring Data JPA Reference](https://docs.spring.io/spring-data/jpa/reference/)
- [Spring Data JPA — Query Methods](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html)
