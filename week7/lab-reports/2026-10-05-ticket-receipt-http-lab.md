# PostgreSQL HTTP 접수와 인증 작성자 검증

> 실행일: 2026-10-05
> 결과: HTTP Integration Test 17개·Domain 길이 Test 4개 통과. 전체 Java Clean Test 207개·JavaScript 79개와 ESLint 통과

기존 접수 Service를 PostgreSQL의 `POST /api/tickets`에 연결했다. 이번 검증은 실제 Spring Security Filter Chain·MVC·Service·JDBC·PostgreSQL을 사용하며 요청 전달에는 MockMvc를 사용했다. 실제 Browser의 Cookie 전송·화면 표시나 외부 AI 호출은 실행하지 않았다.

## 입력과 작성자

새 접수는 `title`과 `body`를 받는다. 본문이 없거나 공백뿐이면 `400`이며, 앞뒤 Java `String.strip()` 공백을 제외한 길이가 2,000 Unicode Code Point를 넘으면 잘라 저장하지 않고 거부한다. DTO와 Domain이 같은 길이 계산을 사용한다. `😀` 2,000개는 UTF-16 길이가 4,000이어도 통과하며 원문 앞뒤 공백도 그대로 저장된다. 내부 공백은 길이에 포함한다.

작성자는 Controller가 `Authentication.getName()`에서 가져온다. Test에서 서로 다른 USER·AGENT 계정으로 Form Login을 수행하고 그 Session으로 제목·본문만 보냈다. DB의 작성자 이름이 각 로그인 계정과 같은지 확인했으며, Test가 Service에 작성자 이름을 직접 주는 방식과 구분했다. 요청에 다른 작성자·Role을 추가해도 저장된 작성자는 로그인한 USER였다. 사용자 인증 정보는 In-memory이고 문의 데이터는 PostgreSQL에 저장된다.

## 응답과 저장 결과

| 요청 또는 실패 | 응답 | 접수 Service | Transaction 종료 뒤 새 Row |
|---|---:|---|---|
| USER·AGENT, 정상 본문, 유효 CSRF | 201 | 호출 | Ticket·Message·PENDING Job 각 1건 |
| 본문 누락·null·공백·길이 초과 | 400 | 미호출 | 세 Table 모두 0건 |
| 로그인한 USER, CSRF 누락·불일치 | 403 | 미호출 | 세 Table 모두 0건 |
| 익명, 유효 CSRF | 401 | 미호출 | 세 Table 모두 0건 |
| Message INSERT 실패 | 500 | 호출 후 Rollback | 세 Table 모두 0건 |
| Message 저장 뒤 Job INSERT 실패 | 500 | 호출 후 Rollback | 세 Table 모두 0건 |

정상 요청은 원문·작성자·Message의 Ticket ID와 Job의 입력 Message 연결, `PENDING` 상태를 확인했다. `Location`은 생성한 Ticket ID를 가리킨다. 응답 Body는 기존 `id`·`title`·`status`를 유지하며 `201`은 AI 완료를 뜻하지 않는다. USER 조회의 `403`과 AGENT 조회의 `200`도 유지했다.

본문 검증의 `400`에서는 MVC가 Handler를 선택한 뒤 인자를 검증한다. `getHandler()`가 존재한다는 것과 Controller 메서드 본문을 실행했다는 것은 다르다. Service Spy의 호출 0회와 실제 DB Row 0건을 함께 확인했다. CSRF·인증 필터의 거부에서는 Handler가 없다.

## 실행 모드와 안전한 로그

공통 조회는 `TicketController`, In-memory 제목 전용 생성은 `InMemoryTicketCreationController`, PostgreSQL 접수는 `TicketReceiptController`가 담당한다. 접수 Service를 모든 Profile의 Controller에 필수 주입하면 In-memory 실행에서 해당 Bean이 없어 기동에 실패한다. Controller 내부의 Profile 분기와 In-memory Message·Job 저장소 추가 대신, 승인한 Profile별 생성 Controller 분리안을 적용했다. 기존 In-memory 회귀 Test도 통과했다.

Test DB는 Testcontainer 연결임을 확인한 뒤 비운다. 실제 접속한 Testcontainer의 Message·Job Table에 임시 `CHECK (false) NOT VALID`를 적용해 INSERT 실패를 만들고, Test 종료 시 제약을 제거했다. 로컬 학습 DB의 데이터는 삭제하지 않았다.

DB 오류의 Exception·Cause에는 실패 Row가 포함될 수 있다. 기존 Stack Trace 출력 대신 고정 코드와 예외 종류만 기록하도록 변경했다. Message INSERT 실패 Test에서 합성 원문과 `Failing row contains`가 Log에 없는 것을 확인했다. MockMvc의 요청·응답 자동 출력도 꺼 로그인 입력과 CSRF 값이 실패 보고에 복사되지 않게 했다.

## 실행한 검증

```powershell
.\mvnw.cmd clean test
node --test --test-reporter=spec src/test/js/*.test.mjs
npx --yes eslint@10.11.0 src/main/resources/static/*.mjs src/test/js/*.test.mjs scripts/week7*.mjs
```

- Java: 207개, 실패·오류·건너뜀 0. 새 HTTP Test는 17개, Domain 길이 Test는 4개다.
- JavaScript: 79개, 실패·건너뜀 0. 새 본문 전달·검증 Test 5개를 포함한다.
- ESLint와 `git diff --check`: 통과.
- 실제 PostgreSQL 17.6 Testcontainer에 Flyway V1·V2를 적용했다. 변경을 위해 Docker Desktop을 시작했고 Testcontainer는 Test 종료 시 정리됐다.

이번 길이 제한은 Application의 입력 계약이다. V2의 기존 DB CHECK를 Unicode 공백·2,000 Code Point 규칙으로 교체하거나 전체 요청 Byte 상한을 추가하지 않았다. 큰 요청의 자원 제한은 별도 검토 대상이다. Worker·현재 Attempt·호출 예약·Suggestion 저장과 새 UI의 실제 Browser E2E가 다음 단계로 남아 있다.
