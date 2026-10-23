# 공식 답변과 대화 조회: 고정 ID, 중복 제출과 저장 경계

> 작성일 및 실행일: 2026-10-23 KST
> 주차: Week 10
> 영역: Backend, Database, Security, Frontend, Test
> 상태: Completed — 로컬 구현·회귀 및 마지막 화면 정리 후 Browser·패키징 재검증 완료. 작성자 복습과 운영 적용은 별도

## 질문과 범위

AI 제안과 사람이 공개하는 답변을 분리하면서, 고객은 자신의 문의만 읽고 담당자는 공식 답변과 정정을 남길 수 있는지 확인했다. [설계 문서](../official-reply-conversation-design-draft.md)의 P1~P8을 사용자와 합의한 뒤 별도 구현 요청에 따라 진행했다.

예상은 답변 Commit 뒤 고객에게 공개되고, 실패한 새 답변은 기존 문의와 AI 결과를 취소하지 않는 것이다. 같은 제출의 재전송은 중복 저장 없이 200, 새 답변은 201이며, 같은 제출 ID에 다른 내용을 넣으면 409로 거부해야 한다.

이번에는 로컬의 합성 계정 및 일회용 PostgreSQL만 사용했다. 회원가입과 Password DB, 고객 후속 메시지, 상태 변경 API, 운영 삭제 및 보관 정책, Cloud 실행과 실제 AI 호출은 포함하지 않았다. 원격 Push와 CI도 실행하지 않았다.

## 구현 전과 후

| 대상 | 구현 전 | 추가한 내용 |
|---|---|---|
| 인증과 소유권 | Session의 로그인 이름, Ticket 등록자 FK 없음 | 기존 인증 유지. Principal의 고정 UUID와 DB의 BIGINT 사용자 ID를 명시적으로 연결 |
| Message | 접수 본문과 당시 작성자 이름 | INQUIRY 또는 OFFICIAL_REPLY, 작성자 ID, 제출 UUID와 정정 대상 |
| 기존 데이터 | 과거 계정을 확인할 수 없는 문의 존재 | 임의 소유자 보충 없이 NULL 유지. AGENT 조회만 허용하고 답변 거부 |
| 대화 조회 | 저장 Port만 존재 | USER 소유권 및 AGENT 권한, 제한된 ID Cursor 조회 |
| 공식 답변 | 없음 | 새 답변 및 추가 정정, 같은 제출의 중복 방지, Commit 후 응답 |
| AI | 최초 문의 Message를 입력으로 고정 | 입력 참조와 기존 Job 유지. 답변 및 조회는 새 Job과 Provider 호출 없음 |

## 중요한 기술 결정

### 이름, 고정 계정 키와 제출 ID는 다른 목적이다

로그인 이름을 DB 소유권 키로 쓰면 이름 변경이나 재사용 때 과거 문의가 다른 사람에게 연결될 수 있다. 서버 설정의 고정 UUID를 인증 Principal에 담고, 그 UUID와 연결한 내부 BIGINT ID로 Ticket 소유권을 확인한다. 현재 이름을 매번 조회해 기존 Session의 사용자를 바꾸지 않는다.

기존 In-memory 인증은 유지했다. 인증 성공 후 Credential 제거가 다음 로그인에 영향을 주지 않도록 새로운 Principal을 반환하는 Adapter를 사용한다. 서로 다른 설정 계정에 같은 key를 지정하면 기동을 거부한다. key가 없거나 DB 연결이 없으면 이름으로 대체하지 않고 신규 접수와 답변을 거부한다.

답변의 clientRequestId는 사람을 식별하는 값이 아니다. 같은 Ticket과 작성자가 같은 제출을 재확인하기 위한 UUID다. 소유권과 작성 권한은 별도로 검사한다.

### DB 제약과 Service 검사는 서로 대신하지 않는다

V1~V8은 바꾸지 않고 V9를 추가했다. 같은 Ticket의 정정 참조는 복합 FK, 같은 제출은 부분 Unique Index로 제한한다. OFFICIAL_REPLY에는 작성자 ID와 제출 UUID가 필수다.

FK만으로 정정 대상이 공식 답변인지 알 수는 없다. Application Service가 같은 Ticket에 저장된 OFFICIAL_REPLY인지 검사한다. 고객 문의, 다른 Ticket의 답변과 없는 ID는 400이며, 기존 제출의 본문이나 정정 대상 변경은 409다.

같은 Ticket의 모든 Message 쓰기는 Message ID를 발급하기 전에 Ticket Row를 잠근다. 두 쓰기의 Commit 순서가 뒤집혀 ID Cursor가 늦게 Commit된 답변을 놓치지 않도록 한 것이다. Transaction 중 외부 AI나 HTTP를 기다리지 않으며 성능 향상 수치는 측정하지 않았다.

### 성공 응답과 화면의 안전한 처리는 별도다

Service의 Transaction이 Commit된 뒤 Controller가 201 또는 재전송 200을 반환한다. 본문은 원문 그대로 저장하되 화면에서는 textContent로 표시한다. DB에 저장할 수 있다는 사실이 HTML로 실행해도 된다는 뜻은 아니다.

POST 결과가 미확인이면 화면 안에서 같은 UUID와 정확히 같은 내용으로 명시적 재확인을 한다. 자동 재전송하지 않으며 미확인 내용을 고친 뒤 같은 제출로 보내지도 않는다. Ticket 변경과 늦은 응답을 구분하고, 페이지를 떠날 때 이전 대화 및 초안을 지운다. 페이지를 떠나 제출 ID를 잃은 경우까지 중복 방지를 보장하지 않으며 이 한계를 화면에도 안내했다.

## API 계약

| 요청 또는 조건 | 결과 |
|---|---|
| GET /api/tickets/{id}/messages | 자기 문의의 USER 또는 AGENT. afterId 기본 0, limit 기본 50·최대 100 |
| POST /api/tickets/{id}/replies | AGENT 및 유효 CSRF. body, clientRequestId와 선택적 correctsMessageId만 허용 |
| 새 답변 또는 정정 | Commit 후 201. Ticket 상태는 OPEN/IN_PROGRESS/RESOLVED 모두 유지 |
| 동일 제출과 동일 내용 | 기존 Row의 200. 새 답변 없음 |
| 동일 제출의 본문 또는 대상 변경 | 409 REPLY_REQUEST_CONFLICT |
| USER의 타인 또는 미확인 등록자 문의 | 없는 문의와 같은 404 |
| 익명 API / USER 답변 / CSRF 누락 | 각각 401 / 403 / 403. 익명 POST의 CSRF 누락은 403이 먼저일 수 있음 |
| 등록자 미확인 문의에 AGENT 답변 | 409 REQUESTER_UNCONFIRMED |
| 잘못된 입력·정정 대상 / 저장·Commit 실패 | 안전한 400 / 500. 원문·내부 SQL·Credential은 응답 및 Log에 넣지 않음 |

조회 응답에는 내부 사용자 ID나 작성자 이름을 넣지 않는다. canReply는 화면 표시를 위한 서버 계산값이며 POST의 권한 검사를 대체하지 않는다. 기존 Ticket 및 AI 제안 API는 AGENT 전용이다.

## 환경과 작은 구현 단위

Windows, PowerShell 7, Java 25, Maven Wrapper 3.9.16, Spring Boot 4.1.1 및 PostgreSQL 17.6 Testcontainer를 사용했다. Browser는 저장소의 Playwright CLI 0.1.21 방식으로 실행했다. Docker가 꺼져 있어 기존 승인에 따라 Desktop을 실행했으며, 기존 사용자 Container나 Volume은 삭제하지 않았다.

| Lab Commit | 단위 |
|---|---|
| 93b5bee | V9, 고정 계정 연결과 기존 인증 Adapter, Migration 및 identity Test |
| 4470921 | 접수 Actor와 소유권, 대화·답변 API 및 권한, 중복·정정·실패 Test |
| 373fa1e | 중복 설정 key 거부, 저장된 AI 결과 보존 Test, V9 이후 회귀 Fixture 보완 |
| edd2427 | 대화·답변 화면, 미확인 제출 및 페이지 이탈 정리, 실제 Browser와 최종 검증 기록 |

최종 Lab Source는 `edd24278683b9e9042109b3658c03f6c75dbfe30`이다. 새 Commit은 아직 원격에 없으므로 존재하지 않는 공개 Source 링크를 만들지 않는다. 주요 구현 경로는 Lab의 `docs/official-replies.md`, `src/main/java/lab/helpdesk/identity/`, `src/main/java/lab/helpdesk/ticket/` 아래 Application·Repository·Web, `src/main/resources/db/migration/V9__add_conversations_and_durable_identities.sql` 및 `src/main/resources/static/conversation*.mjs`다.

## 실제 검증

| 검증 | 관찰 |
|---|---|
| 대화 HTTP 24 Case | 상태 3종 유지, Role·소유권·HEAD·CSRF, 엄격한 입력, 정정 대상, 길이, 페이지 제한, 재전송과 동시 제출, 저장 및 Commit 실패 통과 |
| 이미 저장된 AI 제안 보존 | 실제 결과 Service로 제안·Category·SUCCEEDED Job 저장 후 답변 INSERT 뒤 실패. 기존 결과 객체·Attempt Row·문의 원문 동일 |
| Migration 및 identity | V8의 본문·상태와 미확인 등록자 보존. 고정 key 재연결과 이름 재사용 격리, 동일 key 설정 거부 |
| 전체 Java | mvnw verify: Surefire 1,042개 및 패키징 후 Failsafe 2개 통과. 실패·오류·Skip 0 |
| JavaScript와 Lint | Node 316개 통과. ESLint 통과. 새 대화 13 Case는 응답 계약, Race, 미확인 제출 및 페이지 이탈 정리를 포함 |
| 실제 Browser와 DB | USER A 접수201 → AGENT 답변201·정정201 → USER B 조회404 → USER A 재로그인 및 조회200. DB의 문의·답변·정정 총3건, Ticket OPEN, Job PENDING, 예약0, 제안0, Provider0. 마지막 화면 보완 뒤 같은 흐름과 패키징 후 2개를 다시 통과 |
| 렌더링 | img처럼 생긴 공격성 합성 본문은 문자로 표시. 실제 img 생성0, 스크립트 실행 신호 없음. 정정 참조 표시와 원래 본문 유지 |

Session Cookie와 CSRF Header는 실제 요청에서 존재 여부만 확인했다. 값과 Credential은 출력하지 않았다. Browser는 독립된 합성 USER 두 명과 AGENT를 사용했으며 AI는 비활성이다. 이 실행은 실제 AI 품질이나 운영 보안 전체의 증명이 아니다.

스크린샷은 로컬의 무시되는 `output/playwright/week10-conversation-*/conversation-agent.png`에 생성하고 화면을 확인했다. 공개 저장소에 Cookie, Browser 상태 파일이나 원시 Log를 추가하지 않았다.

## 실패를 발견하고 수정한 과정

1. 첫 전체 회귀에서는 1,040개 중 역사적 V8 Migration Test 한 건이 오류였다. V8까지 적용한 뒤 제한 없이 validate하여 새 V9의 미적용을 실패로 본 경우다. 그 Test의 검증 대상을 V8로 명시했으며 V1~V8 SQL은 수정하지 않았다. 이후 전체 1,042개가 통과했다.
2. Browser 첫 실행은 OPEN 단계에서 실패했다. Credential을 전달하지 않도록 줄인 실행 환경에서 ProgramFiles까지 빠져 설치된 Chrome을 찾지 못한 경우였다. 비밀값이 아닌 Windows 설치 경로 변수만 허용 목록에 추가한 뒤 실제 흐름을 통과했다.
3. 페이지 이탈 정리 Test를 추가한 뒤 Lint가 Node의 URL 전역을 거부했다. 전역 허용을 넓히지 않고 node:url을 명시적으로 import해 해결했다.

첫 실패 회귀에는 이전에도 관찰한 Surefire JVM 종료 지연이 있었고, 이후 전체 실행은 BUILD SUCCESS였다. Testcontainer 종료 뒤 남아 있는 Hikari 연결의 경고와 기존 종료 지연의 원인 진단은 별도 후속이다. 운영 Pool 설정을 근거 없이 바꾸거나 원인까지 해결했다고 기록하지 않는다.

## 재현

Lab Root에서 Docker Engine과 Java 25를 준비한다. 외부 DB나 실제 API Key를 설정할 필요는 없다.

```powershell
.\mvnw.cmd -B -ntp verify
node --test --test-reporter=dot 'src/test/js/*.test.mjs'
npx --yes --package 'eslint@10.11.0' eslint 'src/main/resources/static/*.mjs' 'src/test/js/*.mjs'
```

실제 Browser는 별도 명시 실행이다. PowerShell 7, Node 및 Chrome이 필요하다. Test가 일회용 계정과 DB를 준비하고 자체 Browser Session만 닫으며 실제 Credential을 요구하지 않는다.

```powershell
.\mvnw.cmd -B -ntp '-Dtest=ConversationBrowserExperiment' verify
```

일반 verify는 18:38 KST에, 마지막 화면 정리 후 명시적 Browser 및 패키징 재검증은 18:41 KST에 BUILD SUCCESS였다. 일반 Java 1,042개에는 이 Browser 실험을 합산하지 않는다. 기존 target에 남은 과거 XML의 건수를 전부 더해 이번 실행 수로 쓰지 않는다.

## AI 활용, 검토 범위와 남은 학습

사용자는 공개와 권한, 상태 분리, 정정, 고정 ID와 구형 데이터, 재전송 및 인증 범위의 P1~P8을 결정했다. Codex가 기술 설계, 구현 및 Test 작성과 실행, 화면 확인을 수행했다. 이를 사용자가 직접 모든 Code를 작성하거나 새 코드의 동작을 이미 설명한 것으로 표현하지 않는다.

이번 Source 검토 범위는 다음과 같다.

| Source | 상태 | 한계 |
|---|---|---|
| 새 identity, 대화 Domain·Service·Repository·Controller·DTO, V9, 대화 화면과 신규 Test | VERIFIED | 관련 파일 작성 및 전체 검토, 명시한 로컬 실행. 운영 배포 검증은 아님 |
| 기존 Security·접수 및 AI 최초 입력 조회의 변경 파일 | VERIFIED | 변경 책임과 회귀 검토. 기존 정책과 SQL V1~V8은 유지 |
| Lab README와 과거 계획·배포 문서 | PARTIAL | 현재 범위와 개발 규칙, 관련 결정만 선택. 역사적 배포 절차 전수 검토 아님 |
| 그 밖의 Lab 전체 | NOT_INSPECTED | 전체 코드 보안 감사나 모든 외부 Runner 실행을 하지 않음 |

PostgreSQL 설계 점검 지침은 FK 및 Unique와 짧은 Transaction 경계를 확인하는 데 사용했다. Supabase나 RLS로 바꾸지 않았으며 Index 성능을 측정한 결과는 아니다. Browser 지침은 기존 Windows CLI 방식과 전용 Session·로컬 산출물로 검증하도록 적용했다.

다음 복습은 세 가지면 충분하다. 아직 답변을 받지 않았으므로 이해 완료로 체크하지 않는다.

1. 이름이 같아도 고정 account key가 달라지면 이전 문의를 볼 수 없는 이유는 무엇인가?
2. 답변 Commit은 끝났는데 Browser 응답만 잃었다면 왜 같은 제출 UUID로 재확인해야 하는가?
3. 새 정정 답변이 실패하거나 Rollback되면 기존 문의, 기존 답변과 AI 제안은 어떻게 되는가?

계정 관리, 고객 후속 메시지, 운영 삭제·보관, Cross-tab 즉시 로그아웃, 실제 배포 및 자원 재측정은 후속으로 남긴다. 다음 작업은 [주간 계획](../weekly-plan.md)의 실제 가용시간 안에서 복습과 필요한 수정만 진행한다.
