# 2026-09-22 PostgreSQL Migration·Repository Adapter·Testcontainers Lab

> 상태: Executed
> 실행 범위: Spring JDBC Adapter, Flyway V1, PostgreSQL 17.6 Testcontainer, 생성·조회·Constraint Test
> 미실행 범위: 다중 작업 Transaction Rollback, Application 재시작 뒤 영속성, 실제 Browser E2E

## 실험 질문

1. 기존 `TicketRepository` Port를 바꾸지 않고 저장 구현만 PostgreSQL로 교체할 수 있는가?
2. Migration File이 빈 PostgreSQL에 실제로 적용되는가?
3. PostgreSQL Row의 제목과 Status를 Domain `Ticket`으로 정확히 복원할 수 있는가?
4. Java Domain 검증을 우회한 직접 SQL도 Database Constraint가 거부하는가?
5. PostgreSQL 의존성을 추가한 뒤 기존 In-memory·Security 회귀가 유지되는가?

## 변경 전 기준선

변경 전 `clean test` 결과는 다음과 같았다.

```text
Tests run: 42, Failures: 0, Errors: 0, Skipped: 0
```

이 42개는 기존 Domain·In-memory Repository·MVC·Security 근거이며 PostgreSQL 근거가 아니다.

## 기술 선택

현재 Domain에는 ORM 관계가 없고 이번 목표는 SQL·Parameter Binding·Constraint·Row Mapping을 직접 관찰하는 것이다. 따라서 Spring Data JPA와 Spring JDBC를 동시에 구현하지 않고 Spring JDBC를 선택했다.

실행에 사용한 주요 Version은 다음과 같다.

| 항목 | Version |
|---|---:|
| Spring Boot JDBC·Flyway·Testcontainers 통합 | 4.1.1 |
| Flyway | 12.4.0 |
| PostgreSQL JDBC Driver | 42.7.13 |
| Testcontainers | 2.0.5 |
| PostgreSQL Container | 17.6 Alpine |

Version은 Spring Boot Dependency Management에 맡기고 개별 Version을 `pom.xml`에 중복 고정하지 않았다. Container Image는 재현 가능한 Major·Minor Tag를 명시했다.

## Adapter 조립 경계

두 저장 구현이 동시에 Bean이 되지 않도록 Profile을 분리했다.

```text
in-memory Profile
└─ InMemoryTicketRepository

postgres Profile
└─ JdbcTicketRepository
   └─ JdbcTemplate
      └─ PostgreSQL JDBC Driver
         └─ PostgreSQL 17.6

Profile 없음
└─ 저장 Adapter를 임의로 선택하지 않고 조립 실패
```

기존 Spring Context Test는 `in-memory` Profile을 명시하고 DataSource·Flyway 자동 설정을 제외했다. PostgreSQL Integration Test만 `postgres` Profile과 Testcontainers Service Connection을 사용한다. 따라서 기존 42개 회귀가 우연히 H2나 PostgreSQL을 사용한 것으로 바뀌지 않는다. Profile을 빠뜨린 Runtime이 In-memory로 조용히 대체되는 것도 허용하지 않는다.

## Migration

Flyway V1은 다음 구조를 만든다.

```text
tickets
├─ id BIGINT IDENTITY PRIMARY KEY
├─ title TEXT NOT NULL
└─ status VARCHAR(32) NOT NULL
```

추가 `CHECK`는 공백 제목과 `OPEN`·`IN_PROGRESS`·`RESOLVED` 밖의 Status를 거부한다. Status Constraint는 저장된 현재 값의 허용 목록만 검사하며 `OPEN → RESOLVED` 같은 잘못된 변화 경로까지 검사하지 않는다. 변화 순서는 계속 `Ticket` Domain이 보호한다.

Java `String.isBlank()`와 PostgreSQL `btrim()`의 Unicode 공백 판정은 완전히 같은 계약이라고 가정하지 않는다. 이번 Constraint Test는 ASCII 공백 입력에 대한 실제 실행 근거다.

## Row 복원

새 Ticket 생성과 저장된 Ticket 복원은 목적이 다르다.

```text
새 Ticket 생성
→ new Ticket(title)
→ 초기 상태 OPEN

저장 Row 복원
→ title + 저장된 status 읽기
→ Ticket.restore(title, status)
→ 저장 당시 상태 보존
```

조회 때 `new Ticket(title)`만 사용하면 `IN_PROGRESS`나 `RESOLVED` Row도 `OPEN`으로 바뀐다. 반대로 `startProgress()`와 `resolve()`를 재생하면 복원 과정이 업무 행동처럼 보이게 된다. 그래서 유효성은 검사하되 저장된 상태를 직접 받는 명시적 복원 Factory를 추가했다.

## 실행 결과

집중 Integration Test 결과:

```text
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

확인한 Case:

| Case | 실제 결과 |
|---|---|
| `postgres` Profile의 Adapter | `JdbcTicketRepository` 선택 |
| `IN_PROGRESS` Ticket 생성·조회 | PostgreSQL 저장 후 제목·상태 복원 |
| 없는 ID 조회 | 빈 `Optional` |
| 공백 제목 직접 INSERT | Database Constraint 거부 |
| 알 수 없는 Status 직접 INSERT | Database Constraint 거부 |

Flyway Log에서는 빈 Schema를 발견하고 History Table을 생성한 뒤 Version `1 - create tickets`를 적용해 v1이 되는 것을 확인했다.

전체 회귀 결과:

```text
Tests run: 49, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

49개의 구성은 기존 42개 회귀, Domain 복원 2개, PostgreSQL Integration 5개다. 기존 Test와 PostgreSQL Test의 증명 범위를 구분한다.

## 이번 결과가 증명하는 것

- Spring Boot Context가 `postgres` Profile에서 JDBC Adapter 하나를 선택한다.
- 실제 PostgreSQL Driver와 Engine에서 Migration과 SQL이 동작한다.
- 생성 ID 반환과 Row Mapping이 현재 Port 계약을 만족한다.
- 두 Database Constraint가 실제 PostgreSQL에서 실패를 일으킨다.
- 기존 In-memory·MVC·Security 계약이 이번 변경 뒤에도 회귀하지 않았다.

## 아직 증명하지 않은 것

- 여러 SQL 작업을 하나의 Transaction으로 묶고 중간 실패 때 전부 Rollback하는 흐름
- Application 종료·재시작 뒤 외부 PostgreSQL Row가 유지되는 흐름
- Browser Session·CSRF 요청이 Controller·Application·PostgreSQL까지 이어지는 E2E
- 동시 갱신, Lock, Deadlock과 Connection Pool 동작
- 운영 Database의 Backup·복구·장애 대응

Testcontainer가 Test 뒤 제거되어도 Test 실행 중 실제 PostgreSQL을 사용했다는 근거는 유효하다. 다만 Container 재생성 뒤 데이터가 사라지는 특성을 외부 Database 영속성 실패로 해석하지 않는다.
