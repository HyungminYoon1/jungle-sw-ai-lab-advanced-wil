# HTTP 학습 노트


## 기본 개념 점검 질문

1. HTTP Request와 Response는 무엇인가?
-> HTTP Request는 Client가 Server에 원하는 처리나 Resource를 요청하는 메시지이고, HTTP Response는 Server가 처리 결과를 Client에 돌려주는 메시지이다. HTTP는 두 메시지의 구조와 의미를 정하는 Protocol이다.

2. Request Line의 Method·Target·Version은 각각 무엇인가?
-> Method는 Client가 요청하는 행동의 의미를 나타낸다. Target은 요청 대상 Resource를 식별하며, Version은 해당 HTTP/1.1 메시지에 적용되는 Protocol Version을 나타낸다.

3. Response Status는 무엇을 알려주는가?
-> Server가 Request를 처리한 결과를 표준화된 세 자리 Status Code로 알려준다. `2xx`는 성공, `4xx`는 Request나 Client 측 조건과 관련된 실패, `5xx`는 Server가 요청 수행에 실패한 경우를 나타낸다. Program은 Reason Phrase보다 Status Code를 기준으로 결과를 판단해야 한다.

4. Header와 Body는 어떤 역할을 하는가?
-> Header는 Message와 Content를 해석하거나 처리하는 데 필요한 부가 정보와 제어 정보를 전달한다. Body는 생성할 Ticket 정보나 조회된 Ticket처럼 실제로 전달하려는 Content를 담는다. HTTP/1.1 원문에서는 Header Section 뒤의 빈 줄이 Header와 Body의 경계를 표시한다.

5. Content-Type과 Accept는 어떻게 다른가?
-> `Content-Type`은 현재 Message Body가 어떤 Media Type인지 설명한다. Request의 `Content-Type`은 Client가 보내는 Body의 형식이고, Response의 `Content-Type`은 Server가 보내는 Body의 형식이다. `Accept`는 Client가 Response로 받을 수 있거나 선호하는 Media Type을 Server에 알리는 Request Header이다.

6. HTTP의 Stateless는 무엇을 의미하는가?
-> 각 Request의 의미를 다른 Request와의 자동 연결이나 보존에 의존하지 않고 독립적으로 이해할 수 있다는 뜻이다. Server가 Ticket이나 Session을 Memory·Database·Redis에 저장할 수 없다는 뜻은 아니다. 이전 상태가 필요하면 Client가 Resource ID나 Session Cookie처럼 현재 Request를 해석하는 데 필요한 정보를 다시 전달해야 한다.

7. HTTP/1.1·HTTP/2·HTTP/3와 TLS 1.2·1.3은 어떻게 다른가?
-> HTTP/1.1·HTTP/2·HTTP/3은 Request와 Response의 의미, 표현 방식과 전송 구조를 정의하는 HTTP Version이다. TLS 1.2·1.3은 통신 내용을 암호화하고 상대를 인증하며 전송 중 변조를 탐지하기 위한 보안 Protocol Version이다. HTTP와 TLS는 같은 종류의 Version이 아니며, HTTP/3은 QUIC 위에서 TLS 1.3의 보안 기능을 사용한다.

8. 현재 가장 확실하지 않은 부분은 무엇인가?
-> HTTP Message의 기본 구조와 의미는 구분할 수 있지만, Spring MVC가 실제 Request를 `DispatcherServlet`·Controller 입력으로 변환하고 Response를 만드는 과정은 아직 확실하지 않다. HTTP/2·HTTP/3의 실제 Wire 표현도 이번 학습에서는 개념 수준으로만 확인했다. Spring MVC 처리 흐름은 수요일 학습에서 별도로 확인한다.

## HTTP 메시지 구조 표시

```
POST /api/tickets HTTP/1.1
Host: localhost:8080
Content-Type: application/json
Accept: application/json

{"title":"로그인 오류"}
```

- Method: `POST`
- Request Target: `/api/tickets`
- HTTP Version: `HTTP/1.1`
- Header: `Host`, `Content-Type`, `Accept`
- Header와 Body 사이의 빈 줄: `Accept` Header 다음의 빈 줄
- Body: `{"title":"로그인 오류"}`

### 예상 Response

```http
HTTP/1.1 201 Created
Location: /api/tickets/1
Content-Type: application/json

{"id":1,"title":"로그인 오류","status":"OPEN"}
```

*201, Location, Response Content-Type을 선택한 이유:

- `201 Created`: Request 처리 결과 새로운 Ticket Resource가 생성되었음을 나타낸다.
- `Location: /api/tickets/1`: 생성된 Ticket Resource를 조회할 수 있는 URI Reference를 알려준다.
- `Content-Type: application/json`: Response Body가 JSON 형식임을 알려준다.

이 Response는 구현 전에 작성한 예상 계약이다. 실제 Server 기동과 `curl.exe` Request·Response Trace는 아직 수행하지 않았으므로 `NOT_RUN`이다.
