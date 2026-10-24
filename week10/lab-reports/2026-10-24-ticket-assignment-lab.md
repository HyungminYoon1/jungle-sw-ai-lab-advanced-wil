# 10/24 배정과 인계 로컬 구현 기록

> 상태: 로컬 구현·전체 회귀와 최신 Browser 재검증 완료. Push/CI/Cloud 미실행
> 실행 환경: Windows, PowerShell 7, Java 25, Docker의 격리 PostgreSQL 17.6, 별도 로컬 Browser
> 범위: O1~O6, V10, 직원 배정·인계와 기존 조회/공식 답변 경로의 권한 개정

## 승인과 정책

작성자는 남은 세 정책에 동의하고 기술 설계 구체화, 작은 구현과 Test 및 적절한 단위의 Commit을 요청했다. 설계에 대한 동의와 실제 구현 요청을 구분한다. Push, AWS/ECR, Credential 변경과 실제 AI 호출은 이번 요청 범위가 아니다.

- 인계는 상대방 수락 대기 없이 Commit 즉시 적용한다.
- 같은 서비스의 활성 지원 직원은 미배정과 다른 담당자의 문의, 대화 및 배정 이력을 조회한다. 새 답변과 정정은 현재 담당자만 작성한다.
- 서비스 직원 권한을 회수하면 기존 Session이 있어도 새 직원 조회와 쓰기를 거부한다. 배정과 과거 이력은 남기고 지원관리자가 명시적으로 인계한다.
- 한 운영 조직의 여러 자사 앱을 서비스로 구분한다. 외부 조직 SaaS와 서비스별 별도 App/DB 복제는 이번 구현이 아니다.

확정 정책은 [실사용 설계](../../plan/helpdesk-operational-design-draft.md), 기술 계약과 예외는 [배정과 인계 계약](../ticket-assignment-contract-draft.md) 및 Lab의 `docs/ticket-assignment.md`를 따른다.

## 구현한 경계

| 영역 | 구현 및 이유 |
|---|---|
| 저장 구조 | 기존 V1~V9 불변. V10에 서비스, 서비스 구성원, Ticket의 현재 담당자/버전, 배정 이벤트와 답변 저장 당시 버전을 추가. 같은 서비스/문의의 복합 FK 및 제출/결과 버전 Unique 적용 |
| 초기 등록 | 신뢰한 서버 Bootstrap에서 명시적으로 최초 등록. 재시작으로 inactive 또는 변경된 Role을 되돌리지 않음. 현재 접수 경로는 서버 설정으로 선택한 한 서비스이며, 여러 제품의 고객 인증·접수 라우팅은 후속. 접수 서비스 미설정은 신규 쓰기 전 거부 |
| 구형 데이터 | service_id=NULL을 추정 매핑하지 않음. 직원 경로는 닫고 고객 자신의 대화 조회는 유지. 과거 답변 버전은 NULL 보존 |
| Application | 자기 담당하기, 현재 담당자/서비스 지원관리자의 인계, 같은 제출의 원래 이벤트와 최신 배정 분리. Controller는 입력 변환과 응답만 담당 |
| 권한 | 기존 Ticket, 대화, AI 결과 GET/HEAD도 서비스 권한을 재확인. 전역 AGENT Role만으로 우회하지 못함. 고객 소유권과 서비스 직원 권한은 별개 |
| 동시성 | Ticket FOR UPDATE 후 구성원 ID 순 FOR SHARE. 배정과 이벤트 및 새 답변은 짧은 Transaction. 권한 회수는 구성원 Row에서 직렬화. 외부 호출 없음 |
| Commit과 재확인 | 신규 배정 Commit 201, 동일 제출 200, 변경된 제출 409. 저장 실패와 Commit 실패는 배정·이력 둘 다 Rollback. 최신 배정은 원래 이벤트와 다를 수 있음 |
| 답변 | 신규 expectedAssignmentVersion 필수. 인계 뒤의 새 답변 및 A→B→A 뒤 낡은 초안 거부. 저장된 동일 결과 재확인은 권한 검사 뒤 허용. 구형 NULL 버전 호환은 저장 결과만 대상 |
| 화면 | 서비스별 미배정/내 담당 목록, 직원 선택과 인계, 이력 및 대화 연결. 50건 단위, 새로고침, textContent, 늦은 응답 무시, 결과 미확인 시 같은 UUID/대상/본문/버전 유지 |

PostgreSQL 설계 지침은 짧은 Transaction, 잠금 순서와 FK/Index 점검에 사용했다. 새 구조가 처리량이나 운영 안전성을 이미 입증했다는 뜻은 아니다. 구성원 공유 잠금 때문에 조회 Transaction은 PostgreSQL READ ONLY가 아니지만 업무 Row를 변경하지 않는다는 별도 Test를 유지했다.

## 실행과 검증

집중 실행끼리는 겹치는 Test가 있으므로 전체 수에 더하지 않는다. 아래는 각각의 실행 기준이다.

| 검증 | 확인 결과 |
|---|---|
| V9→V10 실제 Migration | 구형 원문과 NULL/0 상태 보존, 잘못된 서비스 참조와 중복 버전 거부, Bootstrap 재실행 시 권한 회수 보존 |
| 최초 집중 Java | Migration 1, 배정 HTTP 23, 기존 대화 24, 기존 AI 조회 36: 총 84건 통과 |
| 동시 저장 | 독립 DB 연결의 두 claim 경쟁, 첫 claim Rollback 후 대기 요청 성공. 인계와 답변의 두 Commit 순서 및 권한 회수 대기 확인 |
| 실패 | 이벤트 저장·실제 Commit 실패 및 잠금 제한, 구형 재확인, 비담당자·다른 서비스·회수된 권한, 엄격한 JSON/CSRF 검증 |
| 실제 Browser | USER A/B, AGENT A/B와 지원관리자. 담당하기→답변/정정→B 인계/답변→관리자 자기 인계/답변→고객 재로그인. DB 메시지 5건, 배정 이벤트 3건과 버전 1/1/2/3을 대조 |
| 화면 표시 | 인계 사유와 답변의 합성 HTML 공격 문구가 글자로 표시됨. 실제 공격 전체를 막았다는 일반화나 외부 AI Test로 표현하지 않음 |
| Node/Lint | JavaScript 331건과 ESLint 통과. Node의 가짜 HTTP Test는 실제 DB Commit 증거와 구분 |
| 전체 회귀 | `mvnw -B -ntp verify`: Surefire 1,068건과 패키징 후 Failsafe 2건 통과. 실패·오류·Skip 0. 첫 실행에서 구형 Test Fixture의 신원/서비스 설정과 분리된 조회 Controller 기대값을 발견해 수정 |
| 최종 보강 재검증 | 전체 회귀 뒤 배정 HTTP 25건과 명시적 Browser 1건 재실행 통과. 실제 동일 MockHttpSession의 권한 회수 및 비어 있지 않은 AI 제안/분류/Attempt 보존을 추가 확인. 전체 수에 더하지 않음 |

첫 Browser 산출물은 Lab의 무시된 `output/playwright/week10-conversation-12982907367321104025`, 최종 재실행은 `output/playwright/week10-conversation-8586726010349346930`에 있다. 두 실행의 `assignment-history.png`를 직접 확인했다. 합성 계정만 사용했고 Provider/Worker는 비활성, 실제 Provider 호출은 0회다. 실행 중 필요한 Docker Desktop을 시작했으며 사용자 Container나 Volume은 삭제하지 않았다.

## 단위별 로컬 Commit

| 저장소 | Commit | 단위 |
|---|---|---|
| WIL | `0dac6fd` | 활용 목표 및 O1~O6, 배정 기술 계약 |
| Lab | `6c84067` | V10, 구성원/배정 이벤트 저장과 Migration 검증 |
| Lab | `4118928` | 서비스 권한, claim/transfer, 답변 버전과 기존 조회 우회 방지 |
| Lab | `cfe70d9` | 최소 업무/인계 화면, Node와 실제 Browser 실험 |
| Lab | `cd572a7` | 동일 Session 회수, 실제 AI 저장 Row 보존 및 기존 회귀 Fixture 보완 |
| Lab | `2c8477a` | 실행 결과, 로컬 준비 안내와 운영 경계 |

실행 기록과 준비 안내는 별도 문서 단위로 Commit한다. 위 Commit을 원격에 Push하거나 신규 CI를 확인한 상태는 아니다. Lab의 BUILD SUCCESS는 해당 로컬 실행 근거이며 오래된 Surefire XML을 전부 합산하지 않는다. 과거 명시적 실행의 PackagedIT XML 2건이 Surefire 폴더에 남아 있어 현재 기본 실행 수보다 크게 계산될 수 있음을 확인했다.

## 확인 범위와 남은 작업

| Source | 확인 범위 |
|---|---|
| WIL 설계·계획의 관련 문서 | VERIFIED: O1~O6과 기존 P1~P8, 일정과 승인 범위를 대조·수정 |
| Lab의 관련 identity/ticket/support/security/AI 조회 코드, Migration과 Test | VERIFIED: 선택한 관련 경로를 읽고 해당 변경 및 Test 수행 |
| 두 Repository 전체 | PARTIAL: 파일 목록 및 관련 경로 선택. 전체 Code/Security Audit은 아님 |
| AWS·ECR·원격 CI·실제 AI 모델 | NOT_INSPECTED/NOT_EXECUTED: 이번 로컬 요청에서 상태 변경이나 신규 검증을 하지 않음 |

작성자는 UNIQUE와 Commit 순서의 차이, 같은 Ticket 잠금 및 책임 담당자 정책을 검토했다. 코드를 작성하고 자동 Test와 Browser 실험을 수행한 주체는 Codex다. 새 배정 구현을 작성자가 독립적으로 재현하거나 코드 문제로 설명한 증거는 아직 없다.

다음에는 실제 코드의 서비스 권한과 배정 버전, 인계/답변의 Commit 경계를 2~3개 질문으로 묶어 확인할 수 있다. 고객 후속 메시지, 개인별 인증과 계정 전체 폐기, 공개 범위가 다른 내부 문의, 알림·보관/삭제와 운영 인수는 후속 설계다. 이번 기능을 실제 고객에게 공개 가능한 서비스 전체의 완료로 표시하지 않는다.
