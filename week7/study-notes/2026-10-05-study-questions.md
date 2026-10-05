# 2026-10-05 핵심 질문과 AI 입력·판단·저장 검증

> 상태: 10월 5일 학습 회차 마감 — 실제 Java AI→PostgreSQL 한 건 확인, Week 7은 In Progress
> 기록 기준: 10월 6일에 실행한 연장 실험도 이 학습 회차에 포함하며 Lab Report는 실제 실행일을 유지
> 주제: 전송용 복사본, 업무 사실 보존, 형식과 업무 판단, 접수·예약·결과 Transaction, 인증 작성자, Job 실행권, Spring AI의 단일 전송과 실패 분류, 자동 Worker의 남은 경계

## AI에 보내는 것은 원문이 아니라 전송용 복사본이다

외부 AI로 보내는 데이터는 DB 원문을 그대로 읽은 값이 아니라, 불필요한 민감 값을 가린 복사본이어야 한다고 정리했다. 전처리 결과가 올바르더라도 요청 생성 Code에서 원문을 다시 넣으면 외부로 전송될 수 있다. 그래서 전송 직전의 최종 요청 Body를 확인해야 한다.

AI가 반환한 요약에 연락처가 없다는 사실은 외부 전송을 막았다는 근거가 아니다. AI가 연락처를 읽고도 출력에 쓰지 않았을 수 있기 때문이다. 입력 검사와 출력 검사는 서로 다른 위치에서 확인한다.

### 핵심 질문

- 전처리 함수의 반환값이 깨끗한데 최종 요청 Body에는 원문이 들어갈 수 있는 이유는 무엇일까?
- AI 요약에 연락처가 없다는 확인과 AI에 연락처를 보내지 않았다는 확인은 어떻게 다를까?
- 원문 보관 정책과 외부 전송용 치환 정책을 구분해야 하는 이유는 무엇일까?

## 값을 가리더라도 의미까지 지우지는 않는다

전처리가 원문의 의미를 너무 많이 바꾸면 요약도 원문에 충실하기 어려워진다고 생각했다. “새 링크로 로그인에 성공했다”가 전처리 단계에서 빠졌다면 AI가 아닌 전처리부터 원인을 살펴봐야 한다. 증상·복구 사실·문의 목적은 남기고 불필요한 민감 값만 바꾼다.

Prompt Injection 방어도 의심 문장을 모두 지우는 것과 같지는 않다. 사용자가 공격 문구를 신고하는 경우도 있기 때문이다. 사용자 본문은 Server의 지시가 아니라 처리할 데이터로 구분하고, AI가 할 수 있는 후속 행동은 Server Code로 제한한다.

### 핵심 질문

- 로그인 복구 사실을 전처리에서 지웠다면 요약의 누락을 어느 단계에서 먼저 살펴봐야 할까?
- 개인정보 치환에서 보존해야 할 업무 사실은 무엇일까?
- 공격 문구를 신고한 문의와 그 문구를 Server의 명령으로 채택하는 것은 어떻게 다를까?

## 연락처의 값과 종류는 다르다

`[REDACTED]`만 쓰면 이메일인지 전화번호인지도 사라진다는 점이 궁금했다. 종류가 필요한 경우에는 `[EMAIL_REDACTED]`·`[PHONE_REDACTED]`처럼 실제 값 대신 종류를 남길 수 있다. 수단을 모르는 연락처는 `[CONTACT_REDACTED]`로 표시하며, 근거 없이 전화번호나 특정 서비스 계정으로 바꾸지 않는다.

수단을 모르는 연락처를 `[PHONE_REDACTED]`로 바꾸면 AI가 그것을 휴대폰 번호로 오인할 수 있다고 답했다. 값을 가리는 과정에서도 원문에 없던 사실을 만들지 않아야 한다.

종류를 지정해 치환하는 것과 임의의 개인정보를 탐지하는 것은 별개다. 이번 실습에서는 Server가 알고 있는 합성 값과 종류를 전처리기에 전달한다. 이 방식만으로 새로운 개인정보를 자동으로 찾아내는 것은 아니다.

같은 `[EMAIL_REDACTED]`가 두 번 나와도 원래 이메일이 같았는지는 알 수 없다. 같은 값인지 구분해야 한다면 한 입력 안에서 번호를 붙이는 별도 정책이 필요하다. 이번 구현에서는 번호를 붙이지 않았다.

### 핵심 질문

- 이메일 값을 가린 뒤 이메일이라는 종류만 남기면 어떤 맥락을 보존할 수 있을까?
- 수단을 모르는 연락처를 `[PHONE_REDACTED]`로 바꾸면 어떤 정보가 새로 만들어질까?
- 종류를 받아 치환하는 구현의 Test가 통과하면 개인정보 탐지까지 확인한 것일까?

## 전처리 결과를 실제 요청 Body에 연결한다

이번 Code와 Test는 Codex가 작성했다. `AiInputPrivacyGuard`는 합성 값과 종류를 받아 전송용 복사본을 만들고, 최종 JSON Body에 알려진 값이 남아 있으면 거부한다. 전처리 뒤 원문이 다시 섞이는 경우, 타입별 치환, 로그인 복구 사실 보존, 안전한 오류 코드와 `toString()`을 Test에 포함했다.

별도의 실험 실행기는 Java 검사기를 거친 요청 문자열을 그대로 HTTP Body로 보내도록 준비했다. 제목·본문은 요청 안에 JSON 문자열로 담기므로, 바깥 요청뿐 아니라 그 문자열을 해석한 뒤의 값도 검사한다. 전처리 함수만 확인하고 실제 전송은 다른 데이터로 하는 실수를 막기 위한 연결이다.

이 초기 실행기는 Node.js로 API를 호출하고 Java로 전처리하는 독립 실험 도구다. 이후 연결한 Spring AI Provider와는 실행 경로를 구분한다.

| 실행한 Unit Test | 결과 |
|---|---|
| `AiInputPrivacyGuardTest` | 32개 통과 |
| `AiInputPrivacyRequestBridgeTest` | 14개 통과 |
| `AiSuggestionOutputValidatorTest` | 64개 통과 |
| 기존 JavaScript Test와 실험 실행기·Prompt Test | 총 74개 통과 |

이 준비 단계에서는 Java 세 Test Class를 선택해 110개를 실행했다. JavaScript는 `node --test src/test/js/*.test.mjs`로 실행했다. 가짜 전송 함수를 사용하는 Test에서는 예산 기록이 실패하면 호출하지 않는 것과 검사한 Body를 그대로 전달하는 것을 확인했다. 이 선택 실행과 뒤에서 확인한 전체 회귀·실제 AI 저장 실험은 서로 다른 근거다.

실제 Java 전처리를 연결한 Dry run에서는 개인정보 실험 6회와 고정 Dataset 비교 52회의 요청을 준비했다. 로그인 복구 사실은 남았고, 합성 비밀번호·주소·종류 미상 연락처는 각각의 표시로 치환됐다. 이 실행에서 API 호출은 0회였다.

### 핵심 질문

- JSON 문자열 안에 다시 JSON이 들어 있다면 어느 단계의 값을 검사해야 할까?
- Java 검사기에 전달한 문자열과 HTTP로 보내는 문자열이 달라지면 어떤 문제가 생길까?
- 가짜 전송 함수로 확인한 것과 실제 AI 응답에서 확인할 것은 무엇이 다를까?

## 실제 AI 실험의 비용과 결과를 따로 확인한다

오늘 Helpdesk 실험 전체의 누적 상한을 $1로 승인했다. 논문용 전역 키와 혼동하지 않도록 Helpdesk 키가 설정된 전용 PowerShell에서 실행한다. 키 값은 문서나 결과 파일에 남기지 않는다.

새 실행기는 호출 전에 비용을 예약하고, 실행 간 누계를 Git 제외 파일에 보관한다. 응답의 사용량을 확인하지 못하면 예약을 임의로 돌려주거나 자동 재시도하지 않고 멈춘다. 이 실행기 밖에서 사용한 비용은 별도로 알려야 하며, 추정 누계는 실제 청구액과 같지 않다.

전용 PowerShell에서 개인정보 예비 실험 6회와 고정 Dataset 비교 52회를 실행했다. 전송용 입력과 결과 파일은 Codex가 대조했다. 사용량 기반 비용 추정은 합계 $0.0077이며 미정산 예약은 없었다. 6회 예비 실험과 52회 비교는 결과를 따로 보관하고 비용은 하루 누계에 함께 넣었다.

## 원인을 모르는 것과 우선순위를 모르는 것은 다르다

처음에는 로그인이 안 되는 원인을 알 수 없으므로 판단을 보류해야 한다고 생각했다. 하지만 Category는 문의 유형이고 Priority는 영향·피해·긴급성이다. 로그인 문제의 원인을 몰라도 `ACCOUNT`라는 유형은 알 수 있고, 중복 출금처럼 금전 피해가 보고됐다면 원인을 몰라도 높은 우선순위를 줄 수 있다.

실제 금전 피해가 발생한 문의는 `HIGH`로 봐야 한다고 답했다. 이것은 피해 신고를 먼저 확인하자는 판단이며, 시스템의 멱등성 결함이나 환불 완료를 사실로 정하는 것은 아니다.

### 핵심 질문

- 로그인 실패의 원인을 모른다는 사실이 문의 유형도 모른다는 뜻일까?
- 한 사람의 중복 출금 신고가 `HIGH`일 수 있는 근거는 무엇일까?
- 청구지 변경 방법 문의와 중복 출금 문의는 같은 `BILLING`인데도 왜 Priority가 다를까?

## Schema가 맞아도 업무 판단은 틀릴 수 있다

52회 비교에서 두 방식은 모두 JSON·출력 계약을 통과했다. 하지만 각각 분류 후보는 24/26, 우선순위 후보는 20/26만 일치했다. 중복 출금 문의에서 `NORMAL`이나 `UNDETERMINED`를 반환한 결과를 보고 내용 판단 실패라고 답했다. 허용 Enum을 썼다는 것과 합의한 업무 기준에 맞게 판단했다는 것은 다르다.

서비스 이용 불가가 확인됐지만 구체적 고장 위치는 모르는 문의도 두 방식 모두 `UNDETERMINED`로 분류했다. 이번 계약에서는 넓은 기술적 이용 문제는 알 수 있으므로 `TECHNICAL`로 본다. 구체적인 Server 장애 원인을 만들어 요약에 추가하지는 않는다.

기대값을 AI의 답에 맞춰 바꾸지 않고, 합의한 판단 기준을 두 방식의 공통 Prompt에 더 명확히 넣기로 했다. Codex가 새 `prompt-v4-policy-alignment`와 Test를 작성했다. Model·Dataset·Schema·Rubric은 유지했고 이전 결과도 보존했다. Dry run 이후 실제 52회 재비교도 실행했고 두 방식 모두 형식·결정·분류·Priority 후보가 26/26 일치했다. 같은 Dataset을 보고 개선한 비교이므로 새로운 문의에서도 항상 맞는다고 일반화하지 않는다.

요약 52건의 수동 점수는 아직 정하지 않았다. Label 일치가 요약의 모든 사실을 확인해 주는 것은 아니므로, 원문과 핵심 사실을 대조하는 검토는 따로 진행한다. 실험 수치와 반복된 오류는 [AI 분류·우선순위 비교와 Prompt 보완](../lab-reports/2026-10-05-ai-output-policy-comparison.md)에 정리했다.

### 핵심 질문

- `priority: "NORMAL"`이 구조 검사를 통과하면서도 업무 판단 실패일 수 있는 이유는 무엇일까?
- 기대값은 그대로 두고 Prompt만 바꾸어 비교하면 무엇을 확인할 수 있을까?
- 잘못된 네 Case가 개선되더라도 다른 Case의 결과와 요약을 함께 확인해야 하는 이유는 무엇일까?

개념은 [AI 제안의 신뢰 경계와 검증 근거](../study-docs/ai-suggestion-trust-boundaries.md), 합의한 정책은 [AI Suggestion 계약 초안](../ai-suggestion-contract-draft.md)에 정리했다.

## 접수 데이터와 AI 실패를 분리한다

검증기가 잘못된 응답을 거부했다는 사실만으로 원문 보존까지 확인했다고 할 수는 없다. 실제 DB에서 이미 접수한 Ticket·Message가 남아 있는지를 별도로 확인해야 한다고 답했다. Suggestion INSERT가 성공했더라도 같은 결과 Transaction이 Rollback되면 최종 제안 수는 0건이다. INSERT 성공 횟수와 Commit 뒤 Row 수를 구분한다.

Provider가 거부한 응답을 유효한 `ABSTAIN`으로 바꾸면 거부 정보가 사라진다고 답했다. Timeout 역시 Provider가 실행되지 않았다는 뜻은 아니다. Commit 결과를 확인하지 못했을 때는 실제 저장 상태를 조회하고, Row가 없다는 이유만으로 외부 AI를 무조건 다시 호출하지 않는다.

문의 접수의 Ticket·Message·Job은 함께 Commit돼야 한다. Provider를 접수 Transaction 안에서 기다리면 실패가 원문 접수까지 되돌릴 수 있으므로 분리해야 한다고 정리했다. Worker는 Job의 INSERT가 아닌 Commit이 끝난 뒤 그 Job을 실행 대상으로 삼는다.

### 핵심 질문

- INSERT 성공과 Transaction Commit 성공은 어떻게 다를까?
- 출력 검증 실패 Test와 접수 원문 보존 Test가 다른 이유는 무엇일까?
- Provider 거부·유효한 판단 보류·Timeout을 같은 결과로 처리하면 어떤 정보가 사라질까?

## 작성자는 요청 Body가 아니라 서버의 인증 결과에서 가져온다

처음에는 DB에 저장된 사용자 정보를 작성자로 써야 한다고 답했다. 중요한 기준은 DB에 있었는지가 아니라 서버가 인증한 신원인지였다. 현재 로그인 계정은 `InMemoryUserDetailsManager`에 있고, 인증한 작성자 이름과 문의 데이터는 PostgreSQL에 저장할 수 있다.

Test에 `Authentication.getName()`을 넣어야 한다고 생각했는데, Codex의 설명을 통해 실제 Controller와 Test의 역할을 구분했다. Controller가 인증 결과에서 이름을 가져와 Service에 전달하고, HTTP Test는 미리 정한 로그인 계정과 DB 작성자를 대조한다. Service에 이름을 직접 전달하는 Test만으로는 이 연결을 확인할 수 없다. USER와 AGENT 두 계정으로 확인하면 이름을 하드코딩한 실수도 잡을 수 있다.

### 핵심 질문

- Service Test에서 작성자 이름을 직접 넘기는 것과 HTTP Test에서 Session을 사용하는 것은 무엇이 다를까?
- Message의 작성자 이름 기록이 현재 요청의 Role이나 접근 권한을 결정하는 근거가 될까?

## 입력 검증과 CSRF 검증은 다른 실패다

본문이 공백뿐인 요청은 `400`, 로그인했지만 CSRF Token이 없는 요청은 `403`이라고 답했다. 두 번째를 인증 실패라고 표현했지만, 이 경우는 로그인 인증과 별개인 CSRF 검증 실패다. 계획한 HTTP 접수에서는 두 요청 모두 Service를 호출하지 않는다.

Profile도 데이터의 출처라고 표현했지만, 정확히는 어떤 Spring Bean을 생성할지 정하는 조건이다. `postgres` 전용 Service가 없는 In-memory 실행에서 그 Service를 필수 주입받으면 시작할 수 없다. 기존 In-memory 생성 실험과 PostgreSQL 접수 Controller를 분리하는 안에 동의했다.

본문 Field는 `body`, 상한은 앞뒤 공백을 제외한 2,000 Unicode Code Point로 확정했다. 길이 계산에 쓰는 복사본과 저장 원문을 구분하며 초과한 입력은 잘라 저장하지 않는다. 구현은 Codex가 작성했고, 새 HTTP Test 17개·Domain Test 4개를 포함한 전체 Java 207개·JavaScript 79개가 통과했다. 실제 Browser의 새 본문 입력과 AI Worker 처리는 아직 확인하지 않았다.

### 핵심 질문

- 로그인 인증이 성공해도 CSRF 검증이 실패할 수 있는 이유는 무엇일까?
- `getHandler()`가 있다는 사실과 Controller 메서드 본문 실행은 어떻게 다를까?
- 길이를 검사하면서도 저장 원문을 변경하지 않으려면 어떤 값을 구분해야 할까?

개념은 [HTTP 접수와 인증 작성자](../study-docs/http-receipt-and-authenticated-author.md), 실제 실행은 [PostgreSQL HTTP 접수 검증](../lab-reports/2026-10-05-ticket-receipt-http-lab.md)에 정리했다.

## 접수 Commit과 Browser의 응답 수신은 다르다

처음에는 Browser가 `201`을 받기 전에 연결이 끊겼다면 Worker도 처리하면 안 된다고 생각했다. 하지만 문제의 조건은 Ticket·Message·Job의 Commit이 이미 끝난 상태였다. DB를 기준으로 판단한다면 Browser가 응답을 받았는지와 무관하게 저장된 `PENDING` Job을 처리해야 한다. 응답 전달 실패가 완료된 Commit을 취소하지는 않는다.

반대로 Job INSERT가 실패해 접수 Transaction 전체가 Rollback됐다면 세 Row 모두 남지 않으며 Worker가 처리할 Job도 없다. 세 INSERT를 하나의 Transaction에 묶고 모두 성공했을 때 한 번 Commit하는 구조다.

## Row Lock과 처리 실행권의 수명은 다르다

Row Lock을 얻은 Worker가 Attempt를 바꾼 뒤 호출하면 된다고 답했지만, 이미 처리 중인 Worker의 실행권 기한이 남아 있다면 교체 자체가 허용되지 않는다. Row Lock은 변경 경쟁을 제어하는 장치이고, 현재 작업을 가져가도 되는지는 저장된 상태·현재 Attempt·시간·호출 한도로 판단한다.

Worker는 짧은 Transaction에서 실행권과 호출 예약을 Commit하고, DB Transaction 밖에서 Provider를 기다린다. 결과를 저장할 때 다시 현재 Attempt를 확인한다. 실행권 기한이 지났더라도 호출 한도를 모두 사용했다면 기존 정책에서는 새 호출을 허용하지 않는다고 정리했다. 실행권·예약의 DB 경계를 먼저 확인한 뒤, 단일 Processor에서 실제 Provider 호출과 결과 저장까지 연결했다. 자동 Worker의 실행·재시도·복구는 남아 있다.

## 정책은 Job에 남기고 남은 횟수는 계산한다

Job 등록 시 호출 상한·시간 제한·정책 Version을 DB에 사본으로 남기는 안에 동의했다. Application 설정을 바꾸거나 재시작해도 기존 Job의 정책과 누적 횟수는 유지하고, 새 설정은 새 Job부터 적용한다. 실행 도중 설정 변경으로 기존 Job의 한도가 늘거나 줄지 않게 하는 선택이다.

횟수를 5부터 줄이는 방식과 0부터 늘리는 방식 중 무엇을 쓰는지 궁금했다. 상한과 누적 예약 횟수를 저장하고 남은 횟수를 계산하는 권장안을 승인했다. 상한 5회에서 예약 전 값이 4이면 한 번 더 예약해 5로 Commit한 뒤 그 요청을 보낸다. 다음 새 요청은 거부한다. 예약 횟수는 실제 Provider 실행 횟수와 같다고 단정하지 않으며, 전송 여부가 불명확한 예약을 임의로 되돌리지 않는다.

### 핵심 질문

- 접수 Commit 뒤 Browser가 응답을 받지 못했다면 Worker의 실행 근거는 어디에 있을까?
- Row Lock을 얻어도 현재 실행권을 교체할 수 없는 경우는 무엇일까?
- 누적 예약 횟수가 4에서 5가 됐을 때 다섯 번째 요청과 여섯 번째 요청은 어떻게 구분할까?
- Application 설정을 변경해도 기존 Job의 정책을 유지하면 어떤 혼란을 막을 수 있을까?

초기값은 전체 생성 3회·출력 보완 1회, 한 요청 대기 60초·실행권 120초·Backoff 5초·전체 처리 300초로 정했다. 전체 처리 시간은 최초 실행권 확보부터 계산하며 Queue에서 기다린 시간은 제외한다. 재시작 뒤에도 처음 정한 마감 시각과 누적 예약은 유지한다.

## 실행권 변경과 예약 원장을 함께 Commit한다

Codex가 정책 설정 객체, V3 Migration과 `AiSuggestionJobClaimService`를 구현했다. Service는 별도 Transaction에서 현재 실행권을 변경하고 예약 원장을 함께 저장한다. 예약 원장 INSERT가 실패하면 실행권·횟수 변경도 Rollback되지만, 앞서 접수한 Ticket·Message는 남는다.

두 Worker가 한 Job을 동시에 찾았을 때 한 Worker만 예약하는지, 다른 Transaction이 잠근 Job은 건너뛰는지 실제 PostgreSQL에서 확인했다. 중단 복구의 두 요청도 같은 이전 Attempt를 두 번 교체하지 못했다. Lease가 지났다는 사실만으로 일반 조회가 재호출을 예약하지는 않는다. 별도 복구 경로의 앞에는 가능한 Provider 결과 확인이 필요하다.

정책 10개, V2→V3 Migration 1개, 실행권·예약 18개의 새 Test가 통과했다. 전체 Java Clean Test는 236개, JavaScript는 79개였고 실패·오류·Skip은 없었다. 이 Test에서는 외부 AI를 호출하지 않았다. 새 Repository 객체로 같은 DB의 정책·횟수·마감 시각을 복원한 것과 실제 Application·JVM 재시작은 구분한다.

이전 Attempt의 늦은 실패와 출력 보완은 현재 Job을 변경하지 못했다. 이 실행권 단계에서는 유효한 Suggestion 저장과 Job 성공 상태의 Commit이 다음 과제였고, 이어서 아래 결과 저장 단계까지 진행했다. 예약 한도를 모두 썼다는 사실만으로 아직 현재인 마지막 Attempt의 결과까지 버리지는 않는다.

### 핵심 질문

- 실행권 변경은 성공했는데 예약 원장 INSERT가 실패했다면 Provider를 호출해도 될까?
- DB Row Lock이 해제된 뒤에도 다른 Worker가 같은 Job을 바로 실행하지 못하는 이유는 무엇일까?
- 이전 Attempt의 결과를 반영하지 않는 것과 생성 한도를 모두 쓴 현재 Attempt의 결과를 버리는 것은 어떻게 다를까?
- 일반 Queue 조회와 결과 확인 후 복구 재예약을 나누면 어떤 오해를 막을 수 있을까?

설정과 이행 기준은 [AI Suggestion 계약 초안](../ai-suggestion-contract-draft.md), Test별 근거는 [Job 정책·실행권·예약 검증](../lab-reports/2026-10-05-job-policy-and-reservation-lab.md), 개념은 [AI 비동기 처리의 생애주기](../study-docs/ai-async-processing-lifecycle.md)에 정리했다.

## 결과 저장의 Rollback과 FAILED 기록은 다르다

처음에는 제안 저장이 실패해 Rollback되면 Job도 `FAILED`가 된다고 답했다. 하지만 결과 저장 전에 `RUNNING`이 Commit된 상태라면, 새 Transaction의 제안 INSERT와 `SUCCEEDED` UPDATE가 취소된 뒤에는 이전 `RUNNING`이 남는다. Rollback은 변경을 되돌리는 것이지 업무 실패 상태를 새로 저장하는 동작은 아니었다.

결과 Transaction은 제안·모든 Category·Job 완료 표시를 함께 묶는다. 이 Transaction이 실패해도 앞서 Commit한 문의 원문과 호출 예약은 유지한다. `FAILED`가 필요하다면 실패 정책과 현재 Attempt를 확인한 뒤 별도 상태 변경을 Commit해야 한다.

DB가 실제로 Commit했지만 Application이 성공 응답을 받지 못한 경우에는 먼저 같은 Job의 저장 결과를 확인해야 한다고 답했다. 완료된 제안이 있다면 AI를 다시 호출하지 않는다. 저장 Rollback이 확인됐고 검증 객체가 메모리에 남아 있다면 AI가 아니라 DB 저장을 다시 시도한다. 조회마저 실패했다면 아직 저장 여부를 모르는 상태다.

### 핵심 질문

- 결과 Transaction 안에서 `SUCCEEDED`를 확인했어도 Rollback 뒤 `RUNNING`이 남는 이유는 무엇일까?
- 결과 저장 오류와 `FAILED` 상태 기록은 왜 서로 다른 작업일까?
- Commit 확인 실패를 저장 실패로 단정하면 어떤 중복 처리가 생길 수 있을까?

## 제안과 복수 분류를 함께 저장한다

배열·JSONB·별도 분류 Table 중 별도 Table로 나누는 권장안에 동의했다. `ticket_suggestions`에는 제안 한 건의 요약·우선순위·Job ID를, `ticket_suggestion_categories`에는 그 제안의 분류를 항목별로 저장한다. 두 유형으로 분류됐다고 문의나 AI 작업 자체를 두 건으로 나누는 것은 아니다.

같은 `(suggestion_id, 'ACCOUNT')`가 이미 있으면 다시 저장할 수 없는 이유는 조합의 중복을 제한하기 때문이라고 답했다. 정확히는 별도 UNIQUE가 아니라 복합 Primary Key가 그 역할을 한다. Category를 UPDATE하거나 삭제 후 다시 넣는 것은 SQL상 가능하지만, 현재 자동 처리에서는 재시도로 완료된 제안을 덮어쓰지 않는다. 저장 제약과 제안 수정 정책은 구분한다.

Codex가 V4 Migration과 결과 Service·Adapter를 작성했다. 결과 Test 18개와 Migration Test 1개가 실제 PostgreSQL에서 통과했다. 전체 Java Clean Test는 255개, JavaScript는 79개였으며 ESLint도 통과했다. 중간 SQL 성공을 확인한 뒤 오류를 발생시키자 결과 Row는 0건, Job은 `RUNNING`, 접수 원문은 그대로 남았다. 같은 검증 객체의 저장만 다시 시도한 Test에서는 호출 예약이 늘지 않았다.

이 결과 저장 Test에서는 합성 JSON을 Java 검증기에 통과시켜 저장했다. 뒤에서 실행한 실제 AI 저장 실험과 입력의 출처를 구분한다. Row 관계와 Transaction 경계를 자료 없이 설명하는 복습, 자동 Worker와 Browser 연결은 이어서 확인한다.

### 핵심 질문

- `(suggestion_id, category)`를 복합 Primary Key로 두면 서로 다른 Category와 같은 Category의 중복은 각각 어떻게 처리될까?
- 두 번째 Category INSERT가 실패하면 부모 제안과 Job 완료 표시는 어떻게 될까?
- 같은 Job의 제안 한 건이라는 DB 제약이 Provider도 한 번만 실행됐음을 뜻할까?

실제 Test와 저장 범위는 [제안 결과 저장 검증](../lab-reports/2026-10-05-suggestion-result-storage-lab.md)에 정리했다.

## Worker 전체를 Transaction으로 묶지 않는다

실행권·예약 Service와 결과 저장 Service가 `REQUIRES_NEW`를 사용하더라도 Worker 전체에 `@Transactional`을 붙이면 AI를 기다리는 동안 바깥 Transaction은 여전히 열려 있다고 답했다. 안쪽 Transaction의 Commit이 바깥 Transaction까지 종료하는 것은 아니다.

Worker는 실행권·예약 Commit, Transaction 밖의 입력 조회·전처리·Provider 호출·출력 검증, 짧은 결과 저장 Commit을 연결한다. 각각의 DB Service가 독립적으로 Commit하도록 나누되 Worker 전체에는 Transaction을 열지 않는 구조로 정리했다.

### 핵심 질문

- 안쪽 `REQUIRES_NEW`가 Commit된 뒤에도 바깥 Transaction은 왜 남아 있을까?
- Provider를 기다리는 동안 열어둘 필요가 있는 DB Transaction이 있을까?

## 재시도 주체와 호출 횟수를 구분한다

필수 Field 누락은 재생성으로 해결할 가능성이 있지만, 잘못된 API 키는 같은 설정으로 다시 요청해도 해결을 기대하기 어렵다고 답했다. Field 누락 역시 성공이 보장되는 것은 아니므로 보완 조건·횟수·기한을 확인한다. 이때 Provider의 인증 오류는 Browser 사용자의 로그인 실패와 다른 문제다.

처음에는 서버 관점에서는 한 번 호출한 것이고 AI 제공자의 자동 재시도는 막지 않되 횟수와 비용을 따로 기록하면 된다고 생각했다. 하지만 질문의 재시도는 제공자 Server 내부가 아니라 우리 Server에 설치한 SDK의 HTTP 재전송이었다. 같은 Job이고 Java 메서드도 한 번 호출했더라도 SDK가 요청을 두 번 더 보내면 외부 요청은 세 번 시도한다.

우리 SDK의 새 Model 생성 요청도 호출 예약에 포함해야 한다는 기준에 동의했다. 기본 구현에서는 SDK 자동 재시도를 끄고 Worker의 정책 경로에서 새 요청을 예약하기로 정했다. 제공자 내부 실행을 우리가 통제하거나 그 횟수를 추정해 예약에 더한다는 뜻은 아니다.

횟수·사용량을 기록하자는 생각은 유지하되, 로그는 사후 관찰이고 예약은 사전 제한이라는 차이를 정리했다. 확인하지 못한 사용량은 미확인으로 남기고 Credential·원문 Prompt·전체 응답은 출력하지 않는다. 이어서 Spring AI Adapter의 SDK 재시도·HTTP 연결 재시도·자동 Redirect를 모두 끄고, 로컬 HTTP Test에서 요청이 한 번만 전송되는지 확인했다. Worker의 조건부 재예약은 별도 과제다.

### 핵심 질문

- 같은 API 키로 반복해도 해결되지 않는 오류와 출력 보완을 시도할 수 있는 오류는 무엇이 다를까?
- Job 한 건·메서드 호출 한 번·Model 생성 HTTP 요청 횟수는 왜 같은 값이 아닐 수 있을까?
- 제공자 내부 재처리와 우리 SDK의 재전송은 어느 쪽에서 발생하는가?
- 로그를 남겨도 이미 한도를 넘겨 보낸 요청을 취소할 수 없는 이유는 무엇일까?

## 같은 429라도 기다리면 해결되는지 구분한다

크레딧 부족은 충전 전까지 재요청으로 성공을 기대할 수 없으므로 자동 재시도하면 안 된다고 답했다. 일시적인 Rate Limit에는 어떻게 대응할지 확신하지 못해 Codex의 의견을 요청했고, `Retry-After`의 최소 대기를 지킨 뒤 남은 횟수·기한·실행권을 다시 확인하는 권장안에 동의했다.

`Retry-After: 15`라면 Job의 Backoff가 5초여도 최소 15초를 기다린다. 대기 중에는 DB Transaction이나 Row Lock을 유지하지 않고, 허용된 다음 요청의 예약을 Commit한 뒤 호출한다. 기다리면 전체 처리 기한이 끝나는 경우에는 더 일찍 재요청하지 않는다.

첫 요청이 실패했다고 예약 횟수가 돌아오는 것은 아니다. 한 번 더 요청하면 전체 예약은 2회가 되며, Field 보완 요청이 아니므로 출력 보완 횟수는 증가하지 않는다. Adapter의 오류 분류·최소 대기 전달은 로컬 응답으로 확인했다. 그 정보를 DB에 기록하고 시각·횟수·기한을 확인해 다시 실행하는 자동 Worker는 아직 구현하지 않았다. 실제 AI의 Rate Limit을 관찰한 실험과도 다르다.

### 핵심 질문

- 일시적인 Rate Limit과 크레딧 부족을 HTTP Status만으로 구분할 수 있을까?
- 15초 대기를 지키면 Job 기한을 넘는 경우, 호출을 앞당겨도 될까?
- Rate Limit 재시도에서 증가시키는 횟수와 유지하는 횟수는 각각 무엇일까?

## 실제 전송 설정과 응답의 완료 여부를 확인한다

Spring AI Adapter에서도 DB 원문은 유지하고 전송용 복사본을 사용한다. 직렬화가 끝난 요청 Body를 검사해 알려진 민감 값이나 API Credential이 남으면 전송하지 않는다. 요청이 상한을 넘으면 조용히 잘라 보내지 않고 거부한다.

요청별 Timeout 옵션을 만드는 과정에서 고정한 Model 대신 Library 기본 Model이 선택되는 문제가 Test에서 드러났다. Code의 상수만 보는 것이 아니라 실제 전송 Body의 Model·Schema·출력 상한을 확인해야 하는 이유다. 고정 옵션을 복사한 뒤 Timeout만 바꾸도록 수정했다.

HTTP `200`도 제안 저장의 충분한 조건은 아니다. Provider의 명시적 거부, 잘린 출력과 잘못된 응답 Envelope를 먼저 구분하고, 완료된 Model 출력에 JSON·Field·값 검증을 적용한다. 거부를 `ABSTAIN`으로, Timeout을 미실행으로 바꾸지 않는다.

### 핵심 질문

- Code에 원하는 Model 이름이 있어도 최종 요청 Body를 확인해야 하는 이유는 무엇일까?
- HTTP `200`을 받았지만 출력이 완료되지 않았다면 제안을 저장해도 될까?
- 종류별 치환과 알려진 값 검사가 일반 개인정보 탐지를 대신하지 못하는 이유는 무엇일까?

## 실행 성공은 종료 코드와 실제 결과로 확인한다

Java 실험 실행기에서 Windows의 `PATHEXT`가 자식 Process에 전달되지 않아 Maven이 실행되지 않는 문제가 있었다. 종료 코드는 `0`인데 기대한 Maven 출력이 없었다. 필요한 Windows 변수를 전달하고, 비용 예약 전에 API Key 없는 Maven 기동 점검을 하도록 수정됐다.

이번 문제를 통해 종료 코드 하나만으로 실행 성공을 판단하면 안 된다는 점을 확인했다. 이전 불명 예약은 삭제하거나 0원으로 바꾸지 않고 보존했다. 실행기의 수동 기동 복구와 실제 Job의 재시도 정책도 서로 다른 절차다.

## 실제 AI 응답을 PostgreSQL 제안으로 저장했다

Helpdesk 전용 PowerShell에서 합성 문의 한 건을 실행했다. 실제 실행일은 10월 6일이지만 10월 5일 학습의 연장으로 정리한다. Spring AI Provider는 HTTP 요청 1회로 `200` 응답을 받았고, 검증 뒤 PostgreSQL에 Suggestion 1건·Category 1건이 저장됐다. Job은 `SUCCEEDED`였으며 접수한 Message 원문은 그대로 유지됐다. 별도 Live Test도 한 건 통과했다.

실행기 원장의 `reservationsMade = 2`는 이전 기동과 이번 기동의 비용 예약이다. 이번 Job의 `reservedGenerationCount = 1`, 확인한 HTTP 전송 1회와는 다른 수치다. 이전 비용이 미확인인 상태에서 이번 사용량을 알게 됐다고 하루 전체 비용까지 확인한 것은 아니다.

이번 실험은 접수 Service를 실행한 뒤 `processNextPending()`을 한 번 직접 호출했다. Processor는 예약 Commit·입력 조회·전송용 복사본·Provider 호출·출력 검증·결과 저장을 연결한다. 자동 Worker는 실행 가능한 Job을 찾아 이 처리를 시작하고, 실패 후 대기·한도·기한·현재 Attempt를 확인해 다음 행동을 정해야 한다.

### 핵심 질문

- Job `SUCCEEDED`, 제안 `PENDING_REVIEW`, Ticket `OPEN`은 왜 동시에 성립할 수 있을까?
- 실험 실행기 예약 두 번과 Job 생성 예약 한 번은 왜 모순되지 않을까?
- Processor를 한 번 직접 실행한 것과 자동 Worker의 실행·중단 복구는 무엇이 다를까?

## 회차 마감과 10월 6일에 이어갈 내용

마지막 전체 무료 회귀는 Java Clean Test 318개·JavaScript 104개와 ESLint 통과다. Adapter HTTP Test 44개와 실제 PostgreSQL의 통제된 Provider 처리 Test 19개가 포함된다. 실제 AI를 호출한 Live Test 한 건은 이 회귀와 별도로 실행했다. 구현·Test Code는 Codex가 작성했고, 나는 정책을 검토하고 전용 PowerShell에서 실제 실험을 실행했다.

10월 5일 회차는 여기서 마감한다. 다음 학습에서는 이미 확인한 정상 저장을 반복하는 대신 아래 남은 범위를 이어간다.

1. 자동 Worker의 실행과 실패 유형별 대기·조건부 재예약, 현재 Attempt·횟수·전체 기한 확인.
2. 같은 PostgreSQL을 유지한 Application 중단·재시작과 미완료 Job 복구.
3. AGENT의 작업 상태·제안 조회, Session·Role·CSRF를 유지하는 최소 Browser 흐름.
4. 요약·Injection 수동 평가, 핵심 개념의 독립 설명, 최종 회귀·노출 점검과 WIL 작성·게시·포럼 등록.

마지막에 제시된 Backoff·`Retry-After`·전체 처리 기한 질문에는 아직 답하지 않았다. [10월 6일 재개 질문](./2026-10-06-study-questions.md)에서 이어서 확인한다. 실제 Java 연결과 기동 오류의 재현 근거는 [10월 6일 실험 보고서](../lab-reports/2026-10-06-java-provider-adapter-lab.md)에 정리했다.
