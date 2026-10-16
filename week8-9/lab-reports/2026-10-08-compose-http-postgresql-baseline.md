# Compose에서 App과 PostgreSQL 연결

> 실행일: 2026-10-08~2026-10-09
> 결과: `LOCAL_COMPOSE_HTTP_POSTGRES`, `PASS`

## 확인할 내용

Docker Image 안의 JAR를 실제 Container에서 실행하고, 별도 PostgreSQL Container에 문의를 저장한다. DB 연결 준비·Migration·HTTP 접수·Row 저장을 각각 확인한다.

이번 실행은 PowerShell의 `.NET HttpClient`로 HTTP 요청을 보냈다. 실제 App·Spring Security·JDBC·PostgreSQL을 연결했으며 Browser JavaScript는 실행하지 않았다.

## 구성

| 항목 | 설정 |
|---|---|
| App Image | 앞서 Build한 `helpdesk:week8-build-baseline`, Java 25 실행 환경 |
| DB Image | PostgreSQL 17.6, 검증한 Digest 고정 |
| Profile | `postgres,local-browser` |
| App의 DB 주소 | `jdbc:postgresql://db:5432/helpdesk_local` |
| Host 공개 Port | App만 `127.0.0.1`의 빈 Port로 게시. DB Port는 게시하지 않음 |
| DB 저장 공간 | 새 Compose Project의 Named Volume → `/var/lib/postgresql/data` |
| 사용자 | 실행기에 생성한 합성 USER·AGENT, Credential 값은 출력하지 않음 |
| AI 처리 | Worker 비활성화, API Key 전달 없음 |

기존 Container·DB와 섞이지 않도록 새 Project를 만들었다. App은 PostgreSQL 관리자 계정이 아닌 `helpdesk_app` 계정으로 접속했다. 이 계정에는 Superuser·DB 생성·Role 생성 권한이 없다. App이 Flyway를 실행하므로 Schema 사용·생성 권한은 부여했다. Migration 전용 계정과 Runtime 계정의 추가 분리는 운영 구성에서 검토한다.

DB 계정 초기화 Script와 App의 Migration을 구분했다. 전자는 빈 DB의 최초 초기화에 실행되고, 후자는 App이 시작할 때 Migration 이력을 확인해 필요한 SQL을 적용한다. [PostgreSQL Image 초기화](https://github.com/docker-library/docs/blob/master/postgres/README.md), [Compose 시작 조건](https://docs.docker.com/compose/how-tos/startup-order/)

## 실행과 결과

Lab Repository에서 다음 실행기를 사용했다.

```powershell
pwsh -NoProfile -File .\scripts\Verify-Week8Compose.ps1
```

| 확인 항목 | 실제 결과 |
|---|---|
| App 기동 | Container의 `/login` 응답 `200` |
| Flyway | 성공 Migration 7건, 최종 Version 7 |
| App DB 연결 | `helpdesk_app`의 실제 PostgreSQL 연결 확인 |
| 익명 Ticket 조회 | `401`, Login Redirect Header 없음 |
| USER Login | Form의 CSRF를 포함한 Login `302` 뒤 같은 Session의 `/api/csrf` `200` |
| CSRF 없는 USER 접수 | `403`, Ticket·Message·Job 합계 0건 |
| CSRF Header가 있는 USER 접수 | `201`, Location Header 존재, Ticket ID 1·`OPEN` |
| USER Ticket 조회 | `403` |
| AGENT Ticket 조회 | `200`, 접수 응답과 같은 제목 |

Login의 `302`만으로 인증 성공을 판단하지 않고, 후속 요청에서 같은 Session으로 인증 상태가 복원되는지도 확인했다. 두 접수 요청은 같은 USER Session과 동일한 제목·본문을 사용했고, 정상 요청에만 응답에서 받은 CSRF Header 이름과 Token을 붙였다.

DB에서는 다음을 확인했다.

| Table | Row 수와 상태 |
|---|---|
| `tickets` | 1건, `OPEN` |
| `ticket_messages` | 1건, 원문과 로그인한 작성자 보존 |
| `ai_suggestion_jobs` | 1건, `PENDING`, Attempt·생성 예약 수 0 |
| `ai_suggestion_attempts` | 0건 |
| `ticket_suggestions` | 0건 |
| `ticket_suggestion_categories` | 0건 |

Worker를 끈 상태이므로 Job이 `PENDING`인 것은 예상한 결과다. 접수 Transaction과 PostgreSQL 저장을 확인했으며, 이 실행에서 AI 생성·제안 저장은 하지 않았다.

## DB Container 교체와 같은 Volume 연결

첫 실행과 다른 새 Project에서 같은 접수·조회 검증을 진행한 뒤, 그 실행의 DB Container만 교체했다.

```powershell
pwsh -NoProfile -File .\scripts\Verify-Week8Compose.ps1 -RecreateDatabase
```

교체에는 `up -d --no-deps --force-recreate --wait --wait-timeout 90 db`를 사용했다. 기존 사용자 환경이나 첫 실행의 Container는 건드리지 않았고, 새 실험의 DB만 정상 종료·교체했다. 같은 Volume과 PostgreSQL Image를 유지했다.

| 확인 항목 | 실제 결과 |
|---|---|
| DB Container ID | 교체 전후 서로 다름 |
| DB 데이터 Volume | 교체 전후 같은 Named Volume |
| 저장한 Ticket ID 1 | 같은 제목·`OPEN` 상태 유지 |
| Message·Job | 원문·인증 작성자 유지, Job `PENDING`, 각 1건 |
| Migration 이력 | 성공 7건·Version 7 유지 |
| App Container ID·실행 시작 시각 | 교체 전후 같음, App 재시작 없음 |
| 기존 AGENT Session의 재조회 | 재로그인 없이 같은 Ticket 조회 `200` |
| 실행 결과 | `PASS`, `sameVolumeAndRowsPreserved: true` |

PostgreSQL 프로그램은 Image에서 새로 실행됐고, 저장한 데이터는 같은 Volume의 파일에서 읽었다. 로그인 Session은 DB Volume이 아니라 계속 실행 중인 App JVM에 남아 있었다. DB 재기동 중 요청의 실패 횟수·응답 시간이나 무중단 동작을 측정한 실험은 아니다.

## App 재시작과 이전 로그인 Session

세 번째 새 Project에서는 접수·조회 검증 뒤 DB를 그대로 실행해 둔 채 App만 중지하고 시작했다.

```powershell
pwsh -NoProfile -File .\scripts\Verify-Week8Compose.ps1 -RestartApplication
```

해당 Project에 `stop --timeout 20 app`과 `start app`을 순서대로 실행했다. Container를 삭제·교체한 것이 아니라 같은 App Container에서 JVM을 다시 실행한 것이다. [Compose Stop](https://docs.docker.com/reference/cli/docker/compose/stop/), [Compose Start](https://docs.docker.com/reference/cli/docker/compose/start/)

| 확인 항목 | 실제 결과 |
|---|---|
| App Container ID | 중지·시작 전후 같음 |
| App 실행 시작 시각 | 달라짐, 새로운 실행 |
| DB Container ID·실행 시작 시각 | 전후 같음, DB 중지·재시작 없음 |
| DB Volume·Migration 이력 | 같은 Volume, 성공 7건·Version 7 유지 |
| Ticket·Message·Job | 각각 1건, 같은 ID·원문·인증 작성자·`OPEN`·`PENDING` 유지 |
| 기존 Cookie를 보관한 AGENT Client의 조회 | `401`, Login Redirect Header 없음 |
| AGENT 재로그인 뒤 조회 | 새 Session ID, 같은 Ticket ID 1 조회 `200` |
| AI Attempt·Suggestion·Category | 모두 0건, Worker 비활성 유지 |
| 실행 결과 | `PASS`, `sameAppContainerNewExecution: true`, `sameVolumeAndRowsAfterAppRestart: true` |

재시작 전의 `JSESSIONID`가 같은 CookieContainer에 남아 있음을 먼저 확인하고, Cookie 자동 전송을 켠 같은 HttpClient로 보호된 GET을 보냈다. 인증을 복원하지 못해 `401`을 받은 뒤 AGENT로 다시 로그인했고, 같은 DB Row를 조회했다. DB 데이터 보존과 메모리 로그인 Session의 소멸을 서로 다른 결과로 확인했다.

App의 Host Port는 자동 배정한 `61122`에서 재시작 뒤 `61195`로 달라졌다. 실행기가 Port를 다시 조회해 요청 주소를 바꾸었으므로, 이전 주소의 연결 실패를 인증 실패로 기록하지 않았다. 재시작 뒤 확인한 `401`과 재로그인 뒤의 `200`은 모두 새 주소의 실제 HTTP 응답이다.

## 같은 Image에서 App 실행 설정 변경

별도 새 Project에서 CORS 허용 Origin 설정을 바꿔 Stop·Start와 Container 재생성을 비교했다. 비밀값 변경 대신 기존 허용 Origin과 새 시험용 Origin을 사용했고, 허용 목록을 늘리지 않고 교체했다.

```powershell
pwsh -NoProfile -File .\scripts\Verify-Week8Compose.ps1 -RecreateApplicationWithSettings
```

Cookie 전송을 끈 HttpClient로 `/api/tickets`의 JSON POST를 위한 사전 `OPTIONS`를 보냈다. 서버가 반환한 Status와 `Access-Control-Allow-Origin`을 함께 검사했다.

| 단계 | 기존 Origin의 OPTIONS | 새 Origin의 OPTIONS |
|---|---|---|
| 최초 실행 | `200`, 기존 Origin과 일치하는 허용 Header | `403`, 허용 Header 없음 |
| Host의 설정 변경 후 같은 App Stop·Start | `200`, 기존 Origin 허용 유지 | `403`, 새 Origin 거부 유지 |
| 같은 Image로 App 재생성 | `403`, 기존 Origin 거부 | `200`, 새 Origin과 일치하는 허용 Header |

재생성에는 해당 Project의 `up -d --no-deps --no-build --force-recreate app`을 사용했다. 같은 Container를 Stop·Start한 단계에서는 ID가 같고 실행 시작 시각이 바뀌었다. 재생성 단계에서는 App Container ID가 달라졌지만, 두 Container가 참조하는 실제 Image ID는 같았다. Image를 다시 Build하지 않고 새 설정을 적용했다.

DB Container ID·실행 시작 시각·Volume은 전 과정에서 그대로였다. Ticket·Message·PENDING Job 각 1건과 원문·인증 작성자, Migration 7건도 유지됐다. 기존 Cookie의 조회는 `401`, AGENT 재로그인 뒤 같은 ID의 Ticket 조회는 `200`이었다.

서버의 CORS 응답 설정을 실제 HTTP로 확인한 실험이다. Browser JavaScript의 응답 접근 제한이나 실제 Browser E2E를 실행한 결과는 아니다. DB 계정 Password를 변경한 실험도 아니다.

10/9에는 공통 HTTP 준비 확인 함수 변경 후 기존 App 재시작 비교와 새 설정 비교를 함께 반복해 통과했다.

```powershell
pwsh -NoProfile -File .\scripts\Verify-Week8Compose.ps1 -RestartApplication -RecreateApplicationWithSettings
```

## 필수 설정 누락과 Worker 구성 검증

10/9에는 Container 실행과 별도로 Compose의 필수 값 검사를 수행했다.

```powershell
pwsh -NoProfile -File .\scripts\Verify-Week8RequiredSettings.ps1
.\mvnw.cmd "-Dtest=AiSuggestionWorkerConfigurationTest" test
```

설정 실행기는 자식 Process에 합성 값만 준비하고 `docker compose config --quiet`를 사용한다. 기본 `.env` 읽기를 비활성화하고 외부 환경 파일 지정도 제거했다. 호출한 PowerShell의 환경 변수는 변경하지 않으며 전체 설정과 오류 원문은 출력하지 않는다. [Compose 환경 파일 설정](https://docs.docker.com/compose/how-tos/environment-variables/envvars/)

| 확인 항목 | 실제 결과 |
|---|---|
| 합성 필수 값을 모두 제공한 기준 구성 | 설정 해석 통과 |
| DB 관리자·App Password, USER·AGENT Username·Password의 6개 변수 각각 미설정 | 6건 모두 해당 변수의 필수 값 오류로 거부 |
| 같은 6개 변수 각각 빈 문자열 | 6건 모두 해당 변수의 필수 값 오류로 거부 |
| Compose 설정 검사 | `LOCAL_COMPOSE_REQUIRED_SETTINGS`, `PASS`, Container 시작 없음 |
| 기존 Spring Worker 설정 Test 재실행 | 7개 통과, 실패·오류·건너뜀 0 |
| Worker 활성 설정 없음 또는 `false` | Worker 미등록, 해당 Test Context 시작 성공 |
| `in-memory` Profile에서 Worker 활성 값 `true` | PostgreSQL 전용 Worker 미등록 |
| `postgres`에서 Worker 활성, Provider 객체 미제공 | Provider Bean 부재로 Context 기동 실패 확인 |

Spring Test는 필요한 일부 의존성을 Mock으로 제공한 설정 검사이며 PostgreSQL과 실제 AI를 사용하지 않았다. Compose 검사는 미설정·빈 문자열의 거부를 확인한 것으로 Password 유효성이나 접속 성공을 증명하지 않는다. Worker를 끄고 AI Key 없이 접수·저장한 실제 HTTP·DB 결과는 앞의 Compose 실행에서 확인했다. 배포용 Provider·Worker 조립은 아직 남아 있다.

## 종료와 Secret 점검

각 실행의 App·DB Container는 검증 뒤 중지했다. Named Volume은 삭제하지 않아 합성 문의 Row가 남아 있다. 각 실험 밖의 기존 Project와 앞선 실행의 Container는 교체하지 않았다. App 재시작과 설정 변경 실행도 종료 후 별도 Docker 조회에서 App·DB 모두 `exited`, 해당 Volume의 존재를 확인했다.

각 실행에서 생성한 네 Password와 검사 대상으로 수집한 CSRF Token·Session ID를 Container Log와 대조했으며 일치한 값은 0개였다. App 재시작 실행에서는 USER·AGENT 로그인과 AGENT 재로그인에서 수집한 값까지 검사했다. Log·Cookie·Token 자체는 출력하지 않았다. 검사 대상은 해당 실행에서 알고 있는 실제 값이며, 모든 민감정보를 탐지하는 검사는 아니다.

실행 전에 있던 Process 환경 변수는 복원했다. 비밀값을 Source·Image·공개 문서에 넣거나 `.env` 파일로 저장하지 않았다. Runtime 환경 변수는 Container 설정에 남으므로 Docker 관리자에게도 감추는 Secret 저장소라고 보지는 않는다.

## 다음 실험

| 항목 | 현재 상태 |
|---|---|
| DB Container 교체, 같은 Volume·Row 보존, App 재연결 | 실행·확인, 기존 AGENT Session의 조회 `200` |
| App 재시작 뒤 Session 소멸과 DB Row 보존 비교 | 실행·확인, 기존 Cookie의 조회 `401`, 재로그인 뒤 같은 Ticket 조회 `200` |
| 같은 Image의 실행 설정 변경과 서버 CORS 응답 | 실행·확인, Stop·Start는 이전 설정 유지, 재생성은 새 설정 적용 |
| 로컬 Compose 필수 값 미설정·빈 문자열 거부와 기존 Worker 설정 Test | 실행·확인, 12개 거부 Case와 Spring 설정 Test 7개 통과 |
| 배포용 Provider·개인정보 처리기·검증기·Worker 연결 | 미구현 |
| Compose 환경의 Browser E2E·Browser의 CORS 응답 접근 제한 | `NOT_RUN` |
| 이번 변경 뒤 전체 Java·JavaScript 회귀 | `NOT_RUN` |
| Cloud 배포·HTTPS | `NOT_RUN` |

다음에는 배포용 Provider·Worker 연결과 Secret 전달 방식을 구성하고 검증한다. Cloud 리소스 생성·과금·DNS 변경은 별도 확인 뒤 진행한다. Volume 삭제 명령은 사용하지 않는다.
