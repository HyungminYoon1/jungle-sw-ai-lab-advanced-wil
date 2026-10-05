# HTTP 접수와 인증 작성자

문의 접수는 HTTP 입력, 현재 요청의 인증 결과, 실제 저장을 연결하는 과정이다. 같은 `201` 응답이라도 제목만 저장하는 실험과 최초 Message·Job까지 저장하는 접수는 서로 다른 검증 대상이다.

## 요청과 인증 결과의 출처

```java
receiptService.receive(
    request.title(),
    request.body(),
    authentication.getName()
);
```

제목·본문은 요청 Body에서 읽고 작성자는 서버가 인증한 `Authentication`에서 읽는다. 클라이언트가 다른 작성자나 Role을 주장해도 그것을 신원의 근거로 사용하지 않는다. 인증 계정을 메모리에 보관하는 구조에서도 문의와 작성자 이름은 영속 DB에 저장할 수 있다.

작성자 이름 Snapshot은 작성 시점에 남기는 기록이다. Session의 `SecurityContext` 전체를 Message에 저장하거나, 과거 작성자 이름만으로 현재 요청의 권한을 부여하는 것과 다르다.

## 입력 검증과 보안 필터

`@Valid @RequestBody`는 JSON을 DTO로 읽고 Bean Validation을 수행한다. `@NotBlank`는 본문 누락·빈 문자열·공백뿐인 입력을 거부한다. 보안 검사를 통과한 요청이라도 입력 검증에 실패할 수 있다.

| 상황 | 검사 위치 | 접수 Service |
|---|---|---|
| 공백 본문의 `400` | MVC의 DTO 인자 검증 | 미호출 |
| CSRF 누락의 `403` | Security Filter Chain | 미호출 |
| 정상 접수의 `201` | 인증·인가·CSRF·입력 검증 통과 후 저장 | 호출·Commit |
| 저장 실패의 `500` | Service·Repository·DB | 호출 후 Rollback |

MVC는 Controller의 Handler를 먼저 선택하고, 메서드를 호출하기 전에 인자를 검증한다. 따라서 `getHandler()`가 존재해도 Controller 메서드 본문을 실행하지 않았을 수 있다. 반대로 필터에서 차단한 요청은 MVC Handler 선택까지 도달하지 않는다. Service 호출 여부는 Spy 등의 관찰로, 최종 저장 결과는 DB 조회로 각각 확인한다. Row 0건만으로는 Service 미호출과 Rollback을 구분할 수 없다.

## 문자 수 계산과 원문 보존

본문 상한이 앞뒤 공백 제외 2,000 Unicode Code Point인 예제에서는 다음처럼 계산한다.

```java
String measuredBody = body.strip();
int count = measuredBody.codePointCount(0, measuredBody.length());
```

검사에는 `measuredBody`, 저장에는 원래 `body`를 사용한다. Java의 `String.length()`는 UTF-16 Code Unit 수이므로 `😀` 한 개를 2로 센다. Code Point 수와 Byte 수, 화면에 보이는 글자 묶음도 같은 기준은 아니다. 내부 공백은 길이에 포함한다. 초과한 원문을 조용히 자르면 정보가 손실되므로 거부한다.

Browser의 JavaScript 검사는 사용자 입력을 돕는 1차 검사다. 이를 우회할 수 있으므로 서버 DTO와 Domain에서도 규칙을 검사한다. Java `strip()`과 JavaScript `trim()`은 NBSP 등의 처리 범위가 달라 문자 계산 규칙도 맞춰야 한다. 이 문자 수 상한만으로 전체 HTTP 요청의 Byte·메모리 사용량을 제한한 것은 아니다.

## Bean과 Profile

Bean은 Spring이 생성하고 관리하는 객체다. `@Profile("postgres")`는 `postgres` Profile이 활성화됐을 때 해당 Bean을 등록하는 조건이며, 그 자체가 PostgreSQL 접속 명령은 아니다. Controller가 생성자에서 필수로 요구한 Service Bean이 없다면 Application 조립이 실패한다.

실행 모드별 구현은 Profile로 선택하되, Controller에 DB 접근이나 저장 방식별 업무 분기를 넣지 않는다. 저장 Transaction은 Application Service가 담당한다. 초기 Message·Job이 필요한 영속 접수와 제목만 저장하는 In-memory 실험을 같은 완료 상태로 표현하지 않는다.

## Service Test와 HTTP Test

`receive(title, body, "user-A")`를 직접 호출한 Test는 전달받은 작성자 이름의 저장을 확인한다. Controller가 인증 결과에서 그 이름을 읽었다는 연결은 건너뛴다.

HTTP Test는 알려진 계정으로 로그인한 Session을 사용하고 요청에는 제목·본문만 보낸다. 저장 작성자가 알려진 계정 이름과 같은지 확인한다. 서로 다른 두 계정으로 반복하면 작성자를 고정해버린 실수도 발견할 수 있다. MockMvc와 실제 DB를 사용해도 Browser의 Cookie 자동 전송과 JavaScript의 CSRF Header 첨부까지 실행한 것은 아니다.

### 핵심 질문

- 작성자를 Test에서 Service에 직접 넘기면 어떤 연결이 검증에서 빠질까?
- `400`에서도 Handler가 존재할 수 있는 이유는 무엇일까?
- 원문 길이 검사와 저장 문자열 변경은 어떻게 구분할까?
- 문의 접수의 Commit과 AI 제안 완료는 왜 다른 사건일까?
