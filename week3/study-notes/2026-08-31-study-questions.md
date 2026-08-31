# 2026-08-31 — Week 2 복습·WIL 제출과 Week 3 시작 기준선

> 작성일: 2026-08-31
> 목적: Week 2 오류·공통 처리 흐름을 복습하고 WIL 제출, Java·Maven·전체 Test와 PostgreSQL 시작 환경을 확인한다.
> 상태: Completed

---

## 오늘의 질문

> Week 2 학습을 근거와 함께 마감하고 Week 3 Database 학습을 시작할 수 있는가?

## 시작할 때의 이해

- HTTP 요청이 Controller에 도달하기 전에도 역직렬화, Type 변환과 Validation이 일어난다는 큰 흐름은 설명할 수 있었다.
- `ExceptionHandlerExceptionResolver`, `ResponseEntityExceptionHandler`와 개별 Handler Method의 이름은 자료 없이 즉시 구분하기 어려웠다.
- Filter·Interceptor·Exception Handler의 역할은 구분할 수 있었지만 `preHandle()`, `postHandle()`과 `afterCompletion()`의 실행 시점은 추가 교정이 필요했다.
- PostgreSQL 17이 설치된 것으로 알고 있었지만 정확한 Version, Service와 접속 대기 상태는 실제 명령으로 확인하지 않은 상태였다.

## Week 2 복습 결과

### 요청 실패 위치

| 요청 | DTO 생성 | Controller Method | Service·Repository | 발생 Exception·결과 |
|---|---|---|---|---|
| 정상 JSON, 공백 제목 | 생성됨 | 실행되지 않음 | 호출되지 않음 | `@Valid`·`@NotBlank` 검증 실패 → `MethodArgumentNotValidException` → `400` |
| 닫는 중괄호가 없는 JSON | 생성되지 않음 | 실행되지 않음 | 호출되지 않음 | `HttpMessageNotReadableException` → `400` |
| `GET /api/tickets/abc` | 해당 없음 | 실행되지 않음 | 호출되지 않음 | `MethodArgumentTypeMismatchException` → `400` |
| `GET /api/tickets/999` | 해당 없음 | 실행됨 | Service와 Repository 모두 호출됨 | Repository의 `Optional.empty()`를 Service가 `TicketNotFoundException`으로 해석 → `404` |

공백 제목은 JSON 문법이 올바르므로 `CreateTicketRequest`가 먼저 생성된다. 이후 Bean Validation에서 거부되므로 Domain `Ticket`은 생성되지 않고 Repository의 저장 상태도 바뀌지 않는다. 잘못된 JSON은 `HttpMessageConverter`가 Request Body를 DTO로 바꾸지 못하므로 Validation까지 도달하지 않는다.

### Application Exception이 HTTP 오류 응답이 되는 흐름

```text
TicketNotFoundException 발생
→ ExceptionHandlerExceptionResolver가 처리 Method 탐색
→ TicketApiExceptionHandler.handleTicketNotFound() 호출
→ ProblemDetail 생성·반환
→ HttpMessageConverter가 Response Body로 직렬화
→ Client가 404 응답 수신
```

`ExceptionHandlerExceptionResolver`는 `HandlerExceptionResolver`의 구현 중 하나로 `@ExceptionHandler` Method를 찾고 실행한다. `TicketApiExceptionHandler`는 `ResponseEntityExceptionHandler`를 상속하여 Spring MVC 기본 Exception을 재정의하고, 직접 만든 `TicketNotFoundException`은 별도의 `@ExceptionHandler` Method로 처리한다.

- DTO Validation 실패: `handleMethodArgumentNotValid()`
- 잘못된 JSON: `handleHttpMessageNotReadable()`
- Path Variable Type 불일치: `handleTypeMismatch()`
- 존재하지 않는 단건 Ticket: `handleTicketNotFound()`

### Filter·Interceptor·Exception Handler

| 요구사항 | 책임 위치 | 이유 |
|---|---|---|
| 모든 요청에 Request ID 부여 | Filter | Servlet 요청 경계에서 DispatcherServlet보다 앞서 공통 처리할 수 있음 |
| 선택된 Controller Method 이름과 실행 시간 기록 | Interceptor | `HandlerMethod` 정보와 Controller 실행 전후 시점을 사용할 수 있음 |
| Application Exception을 HTTP 오류로 변환 | Exception Handler | Application 실패를 Web 오류 계약으로 변환하는 책임임 |

Interceptor의 시작 시각은 `preHandle()`에서 Request 속성에 저장하고 종료 시각은 `afterCompletion()`에서 계산한다. `preHandle()`만 `boolean`을 반환하며 `false`이면 이후 Handler 실행을 중단한다. `postHandle()`은 `void`이고 예외가 발생한 흐름에서는 호출되지 않을 수 있으므로 최종 Status와 예외 흐름까지 관찰하는 종료 지점으로 사용하지 않았다.

시작 시각을 Singleton Interceptor의 가변 필드에 저장하면 동시에 처리되는 요청들이 같은 필드를 덮어쓸 수 있다. 요청마다 독립적인 Request 속성에 저장해야 각 요청의 경과 시간을 구분할 수 있다.

## WIL 게시와 외부 제출

- Week 2 WIL 로컬 원고의 제목과 내용을 다시 확인하고 상태를 `게시 완료`로 변경했다.
- 블로그 게시와 정글 포럼 등록은 사용자가 완료했다고 확인했다.
- 공개 게시물 URL과 정글 포럼 등록 화면은 현재 대화에 제공되지 않아 Codex가 외부 상태를 독립적으로 재확인하지는 않았다.

따라서 WIL 작성·제출은 사용자 확인 기준으로 `Completed`이며, 외부 공개 상태의 독립 검증과는 구분한다.

## Java·Maven·전체 Test 직접 확인

새 PowerShell 실행 문맥에서 다음 명령을 실행했다.

```powershell
java --version
javac --version
.\mvnw.cmd --version
.\mvnw.cmd clean test
```

확인 결과는 다음과 같다.

```text
Java Runtime: Temurin OpenJDK 25.0.4
javac: 25.0.4
Maven Wrapper 실행 Maven: 3.9.16
Tests run: 33
Failures: 0
Errors: 0
Skipped: 0
BUILD SUCCESS
Finished at: 2026-08-31T20:35:13+09:00
```

예상하지 못한 Repository 실패를 재현하는 Test에서 의도한 Stack Trace가 Server Log에 출력됐고 Mockito 동적 Agent 관련 경고도 나타났다. 두 출력 모두 Test 실패는 아니었으며 최종 33개 Test가 모두 통과했다. 이 결과는 현재 Source의 컴파일과 자동 Test 계약을 확인하지만 실제 Server Port를 연 `curl` 호출이나 PostgreSQL 연동을 증명하지는 않는다.

## PostgreSQL 17 시작 환경 직접 확인

Credential 값을 조회하거나 출력하지 않고 Version, Windows Service와 로컬 접속 대기 상태만 확인했다.

```text
psql: PostgreSQL 17.7
Windows Service: postgresql-x64-17
Service Status: Running
Start Type: Automatic
localhost:5432: accepting connections
pg_isready exit code: 0
```

여기까지 확인한 내용은 PostgreSQL 17.7 Server가 로컬 Port에서 연결을 받을 준비가 됐다는 뜻이다. 다음 항목은 아직 확인하거나 구현하지 않았다.

- 사용자 인증과 기본 `postgres` Database 접속: `VERIFIED`
- 학습용 Database·Schema 존재 여부: `NOT_CHECKED`
- Spring Application에서 PostgreSQL 연결: `NOT_IMPLEMENTED`
- PostgreSQL Driver·JPA·Migration·Testcontainers: `NOT_IMPLEMENTED`
- Schema·Transaction·Lock·Index SQL 실험: `NOT_RUN`

사용자가 Password를 Command나 문서에 기록하지 않고 `psql` Password Prompt를 통해 인증했다. 접속 후 `SELECT current_database();`에서 기본 `postgres` Database를, `SELECT version();`에서 실제 Server가 `PostgreSQL 17.7 on x86_64-windows`임을 확인했다. 따라서 “PostgreSQL 17 설치·Server 실행과 인증 접속 기준선 확보”는 완료했지만 “학습용 Database·Schema 구성”이나 “Helpdesk의 PostgreSQL 영속화 완료”로 해석하면 안 된다.

## Constraint·SQL 기초 선행 학습

PostgreSQL 시작 환경을 확인한 뒤 9월 1일 계획의 일부인 SQL·Constraint 개념을 먼저 점검했다.

- `NOT NULL`은 `NULL`만 거부하며 빈 문자열이나 공백 문자열을 자동으로 거부하지 않는다.
- `CHECK (btrim(title) <> '')`는 앞뒤 공백을 제거한 제목이 빈 문자열인지 검사한다. `CHECK` 표현식이 `FALSE`이면 저장을 거부하지만, `NULL`에 대한 결과가 `UNKNOWN`이면 별도의 `NOT NULL` 없이 통과할 수 있다.
- `CHECK (status IN (...))`는 현재 저장하려는 상태 값의 허용 여부를 검사할 뿐 `OPEN → IN_PROGRESS → RESOLVED` 같은 상태 전이 순서를 검증하지 않는다. 전이 규칙은 현재 `Ticket` Domain이 보호한다.
- `PRIMARY KEY`는 Row 식별 값의 고유성과 `NOT NULL`을 함께 보장한다.
- PostgreSQL의 일반 `UNIQUE`는 여러 `NULL`을 허용할 수 있으며, `NULLS NOT DISTINCT`를 선택하면 `NULL`도 중복 값처럼 취급한다.
- `FOREIGN KEY`는 존재하지 않는 부모 Row 참조를 거부하지만, 참조 Column에 `NOT NULL`이 없으면 `NULL` 자체는 허용할 수 있다.
- 기본 참조 동작에서는 자식 Row가 남아 있을 때 부모 삭제가 거부된다. `ON DELETE SET NULL`은 이력을 남길 수 있지만 원래 Ticket 식별자를 잃는 Trade-off가 있으므로 감사 이력 요구사항을 먼저 정해야 한다.

[PostgreSQL SQL 기초 문법](../study-docs/learning-postgresql-sql-basics.md)을 개념 자료로 작성하고, PostgreSQL 전용 DDL은 Migration·Database Adapter 경계에 두며 Domain·Service·Repository Port와 분리해야 한다는 이식성 경계도 정리했다.

이 단계는 질문과 문서로 개념을 확인한 근거다. 실제 Table 생성, Constraint 실패 SQL과 정규화 전후 비교는 실행하지 않았으므로 `NOT_RUN`이다.

## 학습 결과와 검증 경계

- 완료: Week 2 오류 흐름과 Filter·Interceptor·Exception Handler 책임 복습
- 완료: Week 2 WIL 게시와 정글 포럼 등록에 대한 사용자 확인
- 완료: Java·javac·Maven Version과 전체 33개 Clean Test 직접 재현
- 완료: PostgreSQL 17.7 Version, Service 실행, `localhost:5432` 접속 대기와 기본 Database 인증 접속 확인
- 미확인: 외부 WIL URL과 포럼 등록 화면의 독립 확인
- 완료: SQL·Constraint 기초 개념 점검과 재사용 학습 자료 작성
- 미수행: 학습용 Database·Schema, Constraint 실패를 포함한 SQL 실험과 Spring Application 연결

오늘의 종료 조건은 확인한 상태와 확인하지 않은 상태를 구분하는 것이므로 `Completed`로 판단한다. 일부 Constraint 개념은 선행 학습했지만 SQL 실행 근거는 없으므로 Schema·Constraint Lab의 완료로 보지 않는다.

## AI 활용과 직접 확인 범위

- AI 보조: 복습 질문, 오답 교정, 실행 결과의 검증 경계 구분과 문서 정리
- 사용자 직접 수행: Week 2 WIL 작성·게시, 정글 포럼 등록, 이전 환경·Test 확인과 PostgreSQL Password Prompt 인증 접속
- Codex 직접 확인: 로컬 WIL 원고, Java·javac·Maven Version, 전체 Clean Test, PostgreSQL Version·Service·`pg_isready`
- 독립 확인하지 못한 부분: 외부 게시물과 정글 포럼 등록 상태

## 다음 학습

- 관계·Key·1~3NF와 `NOT NULL`·`UNIQUE`·`CHECK` Constraint의 실제 SQL 결과를 Ticket Schema 예시로 재현한다.
- 기본 `postgres` Database가 아닌 별도의 학습용 Database 존재 여부를 먼저 조회하고, 없으면 생성한 뒤 현재 연결 대상을 확인한다.
- 비정규 Ticket 장부의 중복·삽입·갱신·삭제 이상을 예측한 뒤 정규화 Schema와 실패 SQL로 비교한다.
- Spring Driver·JPA 적용은 핵심 SQL 실험을 설명할 수 있게 된 뒤 판단한다.
