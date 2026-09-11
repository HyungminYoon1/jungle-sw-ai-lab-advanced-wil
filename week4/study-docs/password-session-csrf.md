# Learning Note — PasswordEncoder·Session·Cookie·CSRF

> 작성일: 2026-09-07
> 기준: Spring Security Password Storage·Authentication Persistence·CSRF Reference

## 핵심 질문

> Password는 로그인 때 어떻게 안전하게 검증하고, Session Cookie로 이어진 인증 상태에서 CSRF Token은 무엇을 추가로 증명하는가?

## 학습 목표

- Password Hashing을 암호화와 구분하고 `encode`·`matches`의 역할을 설명한다.
- Server의 Session과 Browser의 Session Cookie에 저장되는 정보를 구분한다.
- 인증된 Session이 있어도 상태 변경 요청에 CSRF 방어가 필요한 이유를 설명한다.

## 한 문장 설명

PasswordEncoder는 원문을 복호화하지 않고 검증 가능한 형태로 바꾸며, Session Cookie는 Server의 인증 상태를 다시 찾게 하고, CSRF Token은 그 Cookie가 자동 첨부됐다는 사실만으로 상태 변경을 허용하지 않게 한다.

## PasswordEncoder

`PasswordEncoder`는 Password를 단방향으로 변환하고, 로그인 입력 원문과 저장된 Encoding이 대응하는지 `matches`로 검사한다. 암호화처럼 저장 값을 복호화해 원문을 얻는 용도가 아니다.

실습에서는 무작위 Salt를 사용하는 적응형 단방향 함수 구현을 선택한다. 같은 원문을 두 번 Encode했을 때 결과가 달라도 두 결과에 대한 `matches`가 모두 성공할 수 있다. 다만 이것은 모든 `PasswordEncoder` 구현의 보장이 아니라 선택한 Salt 기반 구현의 성질이다. 9월 11일 연장 Session의 Dependency Tree에서 Spring Security 7.1.1 해석은 확인했지만, 실제 Encoder 선택과 동작 Test는 9월 12일로 이월해 아직 `NOT_IMPLEMENTED`·`NOT_RUN`이다.

```text
회원·Fixture 준비: raw password → encode → encoded password 저장
Login: 입력 raw password + 저장 encoded password → matches → 성공 또는 실패
```

### 수식 전에 알아둘 다섯 단어

| 용어 | 이 문서에서의 뜻 |
|---|---|
| `rawPassword` | 회원가입이나 Login에서 사용자가 입력한 원문 Password |
| `candidate` | Login 때 입력한 “맞는지 확인할 Password 후보” |
| Salt | Password를 처음 저장할 때 만드는 사용자별 무작위 값; 비밀 열쇠가 아니라 같은 Password의 결과를 서로 다르게 만드는 값 |
| Digest | Password·Salt·계산 설정을 단방향 함수에 넣어 얻은 계산 결과 |
| Parameter | BCrypt Cost처럼 계산을 얼마나 어렵게 할지 정하는 Encoder 설정 |

`encoded`는 단순한 Digest와 항상 같은 뜻이 아니다. 선택한 Encoder가 정한 형식에 따라 Digest와 Salt, Algorithm 식별 정보나 Parameter 일부를 함께 표현할 수 있는 저장값이다. 어떤 정보가 문자열 안에 직접 들어가고 어떤 정보가 Encoder 설정에서 제공되는지는 구현마다 다르다.

### 설명용 가상 계산

아래 값은 실제 Password나 실제 암호 알고리즘 결과가 아니라 원리를 보여 주기 위한 가상 예시다.

```text
가짜 Password = study-password

첫 번째 encode
  새 Salt A 생성
  계산(study-password, Salt A, Cost 10) → Digest 111
  encodedA = [Algorithm][Cost 10][Salt A][Digest 111]

두 번째 encode
  새 Salt B 생성
  계산(study-password, Salt B, Cost 10) → Digest 222
  encodedB = [Algorithm][Cost 10][Salt B][Digest 222]
```

원문은 같아도 Salt가 다르므로 `encodedA`와 `encodedB`가 달라진다. Login에서 `matches(study-password, encodedA)`를 실행하면 새 Salt를 만들지 않고 `encodedA`에 사용된 Salt A와 같은 계산 설정을 사용한다.

```text
계산(study-password, Salt A, Cost 10) → Digest 111
저장된 Digest 111과 비교                    → true

계산(wrong-password, Salt A, Cost 10) → 다른 Digest
저장된 Digest 111과 비교                   → false
```

Server는 저장된 Digest에서 원문을 꺼내지 않는다. 사용자가 방금 제출한 후보가 있으므로, 그 후보로 같은 조건의 계산을 재현해 결과가 같은지만 확인하면 된다. 지문에서 손가락을 복원하지 않고 새로 찍은 지문과 저장된 지문을 비교하는 것과 비슷하다.

### `matches`는 왜 복호화 없이 동작하는가

단방향이라는 말은 저장 결과에서 원문을 되찾기 어렵다는 뜻이지, 같은 입력으로 계산을 다시 수행할 수 없다는 뜻이 아니다. Salt 기반 함수는 같은 원문·Salt·Algorithm Parameter를 다시 넣으면 같은 결과를 만든다. 아래 식은 BCrypt처럼 Salt와 주요 검증 정보를 저장 형식에 포함하는 구현을 단순화한 개념 모델이다.

```text
첫 번째 Encode
  saltA를 무작위 생성
  digestA = KDF(rawPassword, saltA, parameters)
  encodedA = algorithm + parameters + saltA + digestA

두 번째 Encode
  saltB를 무작위 생성
  digestB = KDF(rawPassword, saltB, parameters)
  encodedB = algorithm + parameters + saltB + digestB
```

`encodedA`와 `encodedB`에는 원문 Password가 아니라 검증에 필요한 정보와 계산 결과가 들어 있다. BCrypt를 예로 들면 Version·Cost·Salt와 Digest가 저장 문자열에 표현된다. Spring의 `DelegatingPasswordEncoder`는 `{id}`로 실제 Encoder를 선택한다. 다른 구현은 일부 Parameter를 구성된 Encoder에서 가져올 수 있으므로, 모든 `PasswordEncoder`가 완전히 같은 문자열 구조라고 일반화하지 않는다. Salt는 Password가 아니므로 숨겨야 하는 값이 아니다.

```text
matches(candidate, encodedA)
  1. encodedA의 식별 정보로 사용할 Encoder를 정한다.
  2. encodedA와 Encoder 설정에서 saltA·parameters·digestA를 얻는다.
  3. candidateDigest = KDF(candidate, saltA, parameters)를 계산한다.
  4. candidateDigest와 digestA를 안전하게 비교한다.
```

두 Encoding을 서로 비교하는 것이 아니다. `matches(rawPassword, encodedA)`와 `matches(rawPassword, encodedB)`를 독립적으로 실행한다. 올바른 원문 후보를 넣으면 첫 번째 결과는 `saltA`, 두 번째 결과는 `saltB`로 각각 다시 계산되므로 둘 다 Match한다. 틀린 후보는 같은 Salt를 사용해도 다른 Digest가 나오므로 Match하지 않는다. 새로운 Salt를 만드는 시점은 `encode`이고, 기존 결과를 확인하는 `matches`는 그 결과에 저장된 Salt를 다시 사용한다.

원문 Password는 Source·설정·Log에 남기지 않는다. Test에서만 명시적 가짜 Credential을 Fixture로 사용하고, 실행용 Credential과 분리한다. Encoding 값과 Session ID도 인증 관련 데이터이므로 공개 Log에 출력하지 않는다.

## Session과 Cookie

| 위치 | 저장·전달하는 것 | 저장하지 말아야 할 것 |
|---|---|---|
| Server Session | `SecurityContext`와 인증된 Principal·Authority를 다시 찾을 정보 | 매 요청에 필요한 원문 Password |
| Browser Cookie | Server Session을 식별하는 값 | 사용자 Role 전체와 원문 Password |

인증 성공 뒤 `SecurityContext`를 `HttpSession`과 연결하면 다음 요청에서 Browser가 Session Cookie를 보내고, Spring Security가 Server의 인증 정보를 다시 불러온다. 따라서 후속 요청은 Password를 다시 전송하지 않아도 된다.

Login Filter가 Password를 검증해 `SecurityContext`를 만들고, Repository가 이를 Session에 저장한 뒤 다음 Request의 `SecurityContextHolder`에 복원하는 전체 과정은 [Form Login과 Session 인증 과정](./session-authentication-flow.md)에서 구성요소별로 설명한다.

Cookie가 존재한다는 사실만으로 로그인 성공을 증명할 수는 없다. CSRF Token 저장, Request Cache 등 다른 이유로 Session이 생길 수 있기 때문이다. 검증 근거는 같은 Session으로 보호 API를 호출했을 때 인증 정보와 권한이 실제로 복원되는지다.

Session ID는 그 값을 가진 요청이 기존 Session으로 연결되는 Credential 역할을 한다. 실제 값은 문서나 Log에 기록하지 않는다.

## CSRF가 필요한 이유

Browser는 대상 Site의 Cookie를 조건에 맞으면 요청에 자동으로 붙인다. 공격자가 사용자의 Password나 Session ID를 읽지 못해도, 사용자가 로그인한 상태에서 대상 Site로 상태 변경 요청을 보내도록 유도할 수 있다.

Synchronizer Token 방식은 Cookie 외에 공격자가 자동으로 붙일 수 없는 값을 요구한다.

```text
Server가 기대 CSRF Token을 준비
→ Client가 Form Field 또는 Header에 실제 Token을 명시
→ CsrfFilter가 기대 값과 실제 값을 비교
→ 일치하면 다음 Filter로 진행
→ 없거나 다르면 403으로 종료
```

Spring Security의 기본 Session 방식에서는 기대 CSRF Token을 `HttpSession`에 둘 수 있다. 실제 Token은 Form Parameter나 HTTP Header처럼 Browser가 Cross-site 요청에 자동 첨부하지 않는 위치로 보내야 한다. Cookie에 Session ID와 CSRF Token을 모두 자동 첨부하는 것만으로는 같은 방어가 되지 않는다.

## Session ID·CSRF Token·JWT는 같은 역할이 아니다

| 값 | 주된 역할 | Server가 확인하는 것 | Browser 전송 특성 |
|---|---|---|---|
| Session ID | Server-side 인증 상태를 찾는 참조 Credential | ID에 연결된 `HttpSession`과 `SecurityContext` | Cookie에 두면 조건에 따라 자동 첨부 |
| CSRF Token | 상태 변경 요청이 정상 Application Context의 별도 값을 가지고 있는지 확인 | 기대 Token과 요청의 실제 Token이 일치하는지 | Form Field나 Header에 명시적으로 추가 |
| JWT Access Token | 서명된 Claim을 전달하는 인증·인가 Credential | Signature·Issuer·Audience·Expiry와 Claim | `Authorization: Bearer` Header 또는 설계에 따라 Cookie로 전달 가능 |

JWT는 Claim을 담는 Token 형식이지 CSRF 방어 기능 자체가 아니다. CSRF 노출 여부는 Token의 형식보다 Browser가 Credential을 요청에 자동 첨부하는지에 크게 좌우된다.

- JWT를 Cookie에 저장해 자동 전송하면 Session Cookie와 마찬가지로 CSRF를 고려해야 한다.
- Client가 JWT를 `Authorization: Bearer` Header에 직접 추가하면 외부 Site가 일반 Form 요청만으로 같은 Header를 자동 첨부할 수 없으므로 CSRF 공격면은 줄어든다.
- 다만 JavaScript가 접근할 수 있는 위치에 Token을 두면 XSS로 Token이 탈취될 위험을 별도로 다뤄야 한다. JWT 선택이 Browser 보안을 자동으로 단순하게 만들지는 않는다.

### Session과 JWT 선택 기준

| 관점 | Server Session + CSRF | JWT Bearer Header |
|---|---|---|
| 인증 상태 | Server가 Session 상태 보관 | Token Claim과 Signature로 요청마다 검증 |
| Logout·강제 만료·Role 변경 반영 | Server Session을 제거하거나 갱신하기 쉬움 | 이미 발급된 Token은 만료 전까지 유효할 수 있어 별도 폐기 전략 필요 |
| 다중 Server·Service | 공유 Session 저장소 또는 Routing 전략 필요 | 검증 Key를 공유하면 여러 Resource Server가 독립적으로 검증 가능 |
| Browser의 CSRF | Cookie가 자동 첨부되므로 CSRF 방어 필요 | Header를 Client가 명시하면 CSRF 공격면 감소; Cookie 저장이면 다시 필요 |
| 추가 복잡성 | Session 수명·Cookie·CSRF 관리 | 발급·서명 Key·Claim·만료·갱신·폐기와 Token 저장 위치 관리 |

현재 Lab은 단일 Spring Application에서 Form Login부터 Session 복원, Role, `401`·`403`, CSRF까지 한 수직 흐름으로 관찰하는 것이 목표다. 분산 Resource Server 요구가 없으므로 이번 주에는 Session 방식을 사용하고 JWT는 비교 대상으로만 남긴다. 이는 Session이 항상 우월하다는 결정이 아니라 현재 학습 질문과 System 구조에 맞춘 범위 선택이다.

## 네 개념의 역할 비교

| 개념 | 답하는 질문 | 대표 실패 |
|---|---|---|
| PasswordEncoder | 입력 Password가 저장된 Credential과 대응하는가 | Login 실패 |
| Session | 이전 인증 성공을 후속 요청에서 어떻게 복원하는가 | 유효 Session 없음 → 인증 필요 |
| Authorization | 복원된 사용자가 이 행동을 할 수 있는가 | 권한 부족 → `403` |
| CSRF | Browser가 보낸 상태 변경 요청이 의도된 Client 흐름에서 왔는가 | Token 없음·불일치 → `403` |

CSRF Token은 사용자의 신원을 확인하지 않고 Role도 부여하지 않는다. 반대로 인증·인가에 성공했어도 CSRF 검사 대상 요청이 Token을 통과하지 못하면 Controller에 도달하지 않는다.

## Form Login과 Test 경계

- 기본 Form Login은 `POST /login`에 사용자 이름과 Password Parameter를 제출한다.
- Login Form 자체도 상태를 바꾸므로 유효한 CSRF Token이 필요하다.
- 기본 성공·실패 Handler는 Redirect를 사용할 수 있다. 이 결과를 보호 API의 `401`·`403`과 섞지 않는다.
- Spring Security MockMvc의 `formLogin()` 지원은 Login Parameter와 유효한 CSRF Token을 포함한 요청을 만드는 데 사용할 수 있다.
- 안전하지 않은 Method의 정상 흐름 Test에는 `csrf()`, 실패 Test에는 Token 누락 또는 잘못된 Token을 명시한다.

## Cookie 속성의 경계

| 속성 | 줄이는 위험 | 보장하지 않는 것 |
|---|---|---|
| `HttpOnly` | JavaScript가 Cookie 값을 직접 읽는 위험 | XSS가 사용자의 Browser에서 요청을 실행하는 것 전체 |
| `Secure` | Cookie가 평문 HTTP로 전송되는 위험 | 로컬 HTTP에서 실제 HTTPS 전송 조건 검증 |
| `SameSite` | 일부 Cross-site 요청에 Cookie가 첨부되는 위험 | 모든 CSRF 시나리오와 잘못된 Server 권한 정책 해결 |

실제 Cookie 속성과 인증 전후 Session ID 변화는 실행 환경에서 관찰한 뒤 기록한다. 개념 설명만으로 Runtime 결과를 주장하지 않는다.

## 실패·반례와 자주 발생하는 오해

| 오해·잘못된 사용 | 수정된 이해 |
|---|---|
| Hash 결과가 다르면 같은 Password가 아니다. | Salt 기반 Encoding은 결과가 달라도 `matches`로 같은 원문을 검증할 수 있다. |
| Hash는 복호화해서 비교한다. | 원문과 저장된 Encoding을 단방향 검증 함수로 비교한다. |
| `JSESSIONID` 안에 사용자 Role이 들어 있다. | Cookie는 보통 Server Session을 찾는 식별 값이고 인증 정보는 Server 쪽에 있다. |
| Session Cookie가 있으므로 요청은 사용자가 의도했다. | Browser가 Cookie를 자동 첨부하므로 상태 변경에는 별도 CSRF 증거가 필요하다. |
| CSRF를 끄면 POST Test가 간단해진다. | 학습할 방어 경계를 제거한 것이므로 누락·정상 Token을 분리해 Test한다. |

## 학습 점검 질문

1. 같은 Password를 두 번 Encode한 결과가 다른데도 두 `matches`가 성공할 수 있는 이유는 무엇인가?
2. Browser의 Session Cookie와 Server의 `SecurityContext`는 각각 무슨 역할을 하는가?
3. 공격자가 Session ID를 모르는 상황에서도 CSRF 요청이 가능한 이유는 무엇인가?
4. CSRF `403`과 Role 부족 `403`을 Test 조건으로 어떻게 구분할 것인가?
5. JWT를 Cookie로 보내는 경우와 `Authorization` Header로 보내는 경우의 CSRF 위험은 왜 다른가?

## 자료 범위

- 포함: Password 검증, 단일 Server Session, Session Cookie, Synchronizer Token과 MockMvc Test 경계, Session과 JWT의 개념 비교
- 포함하지 않음: JWT·OAuth2 구현, Redis 분산 Session, HTTPS Runtime 검증, XSS·CORS 구현과 Rate Limiting

## 참고 자료

- [Spring Security — Password Storage](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html)
- [Spring Security — Persisting Authentication](https://docs.spring.io/spring-security/reference/servlet/authentication/persistence.html)
- [Spring Security — CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)
- [Spring Security — OAuth 2.0 Resource Server JWT](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html)
- [RFC 7519 — JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519.html)
- [RFC 6750 — Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750.html)
- [Spring Security Test — CSRF](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/csrf.html)
- [Spring Security Test — Form Login](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/form-login.html)
