# HTTPS 로그인·CSRF 접수와 실제 PostgreSQL Row

> 확인 회차: 2026-10-15
> 근거: 작성자가 Browser의 응답·Cookie 속성과 CloudShell psql의 조회 결과를 공유한 실습
> 상태: AI 비활성 HTTPS 접수·SQL Row 확인. Task 교체 뒤 보존·재로그인과 Cloud AI 처리는 별도 미실행

## 로그인과 Cookie

로그인 뒤 `/`에서 `No static resource .`의 404가 표시됐다. 이후 같은 Browser의 `GET /api/csrf`는 `200`이었으므로, 마지막 화면의 404만으로 로그인 실패라고 판단하지 않았다.

작성자가 확인한 Session Cookie 속성은 Secure·HttpOnly 활성, SameSite=Lax였다. Cloudflare의 cf_clearance와 Helpdesk의 Session Cookie를 구분했으며 Cookie·Token 값은 이 보고서에 넣지 않는다.

## 같은 Session의 접수 비교

| 요청 조건 | 작성자가 확인한 결과 |
|---|---|
| 로그인 Session·CSRF Header 없는 `POST /api/tickets` | HTTP 403·`response.ok=false` |
| CSRF Token을 조회해 Header에 붙인 정상 접수 | HTTP 201·`response.ok=true`·Location Header 존재·Ticket ID 2 |

처음 정상 접수한 Ticket 1과 후속 정상 접수한 Ticket 2를 실제 DB에서 각각 조회했다. Ticket 2의 제목은 `CSRF 누락 검증`이지만 이 Row를 만든 것은 유효한 CSRF Header를 붙여 201을 받은 요청이다. 제목과 요청의 보안 조건을 같은 것으로 해석하지 않는다.

## CloudShell에서 확인한 Row

App DB 계정으로 `sslmode=verify-full` 접속에 성공했고 TLSv1.3 연결을 확인했다. CA 파일 없음·DB Password 인증 거부를 구분해 해결한 뒤, 읽기 전용 Transaction에서 Ticket·Message·Job과 예약/제안 수를 조회했다.

| 조회 항목 | Ticket 1 | Ticket 2 |
|---|---|---|
| Ticket 제목 | 배포 학습 문의 | CSRF 누락 검증 |
| Ticket 상태 | OPEN | OPEN |
| Message ID | 1 | 2 |
| 원문 비교 `original_body_preserved` | true | true |
| 작성자 비공백 `author_present` | true | true |
| Job ID·입력 Message ID | 1·1 | 2·2 |
| Job 상태 | PENDING | PENDING |
| current_attempt | 0 | 0 |
| reserved_generation_count | 0 | 0 |
| 예약 Row 수 | 0 | 0 |
| Suggestion Row 수 | 0 | 0 |

`author_present`는 작성자가 비어 있지 않다는 확인이다. 로그인 신원과 작성자 값의 동일성을 이 Boolean만으로 검증한 것은 아니다. 원문·사용자명·Password·Cookie·CSRF 값은 출력 자료에 다시 복사하지 않았다.

현재 Cloud 명세에서 Provider·Worker가 모두 비활성인 결과와 SQL의 PENDING·예약 0건을 함께 읽는다. 이 실습은 문의 접수와 저장을 확인한 것이며 AI 처리·제안 생성 완료를 뜻하지 않는다. 전체 데이터베이스의 모든 Row를 감사한 결과도 아니다.

## SELECT와 Commit

SELECT 결과는 Commit 전부터 반환됐다. SELECT가 호출 시 실행되기 때문이며, Commit은 앞의 SELECT를 그때 시작하는 명령이 아니다. 이번 읽기 전용 조회는 쓰기를 추가하지 않았고 Commit으로 Transaction을 종료했다.

같은 Transaction에서 INSERT 결과를 조회할 수 있다는 것과 그 쓰기가 영속적으로 확정됐다는 것은 다르다. INSERT를 Rollback하면 그 Transaction의 쓰기는 취소된다. 이 개념은 별도 쓰기 실험을 이번 읽기 전용 접속에서 추가했다는 뜻이 아니다.

## 후속 교체 실습과 구분

위 결과는 기존 Task에서 접수한 시점의 근거다. 이후 Browser가 로그인을 요구했던 상태는 실제 Task를 교체하기 전이었다. 그 상태를 재시작 때문에 Session이 소실됐다는 결과로 사용할 수 없다.

교체 실습은 AGENT의 새 기준 조회부터 확보한 뒤 진행하며 현재 `NOT_RUN`이다. [교체 준비 보고서](./2026-10-16-cloud-task-replacement.md), [10월 15일 학습 노트](../study-notes/2026-10-15-study-questions.md)에 실행 상태와 개념을 나누어 기록한다.
