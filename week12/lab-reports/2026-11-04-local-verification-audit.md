# 실행 안내와 로컬 검증 근거 대조

> 기준일: 2026-11-04
> 범위: 현재 V13의 선택한 실행 절차/소스/기존 로그 대조와 ESLint 한 번의 재검증
> 구분: Java/Node/Browser를 이번에 다시 실행하지 않았으며 Push/CI/Cloud/상용 AI 실행도 없음

## 확인한 문제와 정리

상태 기능의 통합 문답 뒤, 주간 계획의 실행 안내/검증 근거 대조로 진행했다. 같은 테스트를 반복해 날짜별 과업을 채우지 않고 기존 명령/결과/한계를 먼저 확인했다.

Lab README의 과거 주차별 실행 명령과 결과는 역사 기록으로 남기고, 현재 절차를 docs/local-verification.md로 모았다. Java/Spring/PostgreSQL, Node, ESLint와 별도 Browser 세 건을 분리했다. 현재 기본 회귀는 Maven verify이며 POM에 연결한 패키징 후 검사까지 포함한다. Maven test만으로 그 두 건까지 실행한 것으로 기록하지 않는다.

Week 12 Browser는 각 실험의 임의 App Port와 격리된 Testcontainers DB를 사용한다. 예전 Week 6의 고정 Port E2E 실행법과 섞지 않는다. 실제 계정/AI Key를 넣는 수동 앱 실행과도 다른 경로다. 새 가이드는 기존 Script/계층/권한/DB 계약을 바꾸지 않는다.

주간 계획 상단의 오래된 1,173+2/Node 399 요약은 본문의 최신 1,221+2/Node 418 근거에 맞춰 갱신했다. 과거 실행 기록 자체를 최신 실행처럼 바꾸지는 않았다.

## 실행별 증거와 한계

| 실행 | 이번에 대조한 근거 | 판정 범위 |
|---|---|---|
| 앞선 Maven verify | target/week12-status-verify.log의 Surefire 1,221/Failsafe 2, 실패/오류/Skip 0와 BUILD SUCCESS | 기본 Java/실제 PostgreSQL/패키징 검사. 별도 Browser와 실제 상용 AI/Cloud의 성공은 아님 |
| 앞선 Node test | target/week12-status-node-all.log의 418/통과 418/실패·취소·Skip 0 | JS 상태 처리/도구의 통제된 사례. DB Commit의 직접 증거와 구분 |
| 상태 Browser | target/week12-status-browser.log의 한 건/BUILD SUCCESS와 실제 POST 201/409/201/200/201/201, 상태 이력 6건 | 실제 로컬 Browser/Spring/DB. Provider 상호작용 0 |
| 답변 초안/확인 재선택 Browser | target/week12-status-browser-regression.log의 두 건/BUILD SUCCESS와 각 고정 결과 | 기존 화면의 관련 두 흐름. 다른 과거 실험 전체를 재실행한 결과는 아님 |
| ESLint 재검증 | 아래 result.json의 종료 코드 0/코드 기준/시각과 0 Byte 로그 | 해당 고정 Lint 규칙 통과. 업무/DB/모델 정확도 보장은 아님 |

위 실행 수는 중복 합산하지 않는다. 집중 Java 검사는 기본 전체에 포함하고, Browser 세 건은 별도다. Log/XML의 존재나 전체 파일 수만으로 이번 명령의 실행 수를 계산하지 않는다. 남아 있는 이전 XML도 섞일 수 있기 때문이다.

전체 Java를 실행한 코드 기준은 Lab af92b61이며, 현재 감사 시작점 1eca282와의 Git Diff는 README.md/docs/ticket-status.md 두 문서뿐임을 확인했다. 새로 전체 Java를 돌렸다는 뜻은 아니다. 이 대조와 Commit 정보는 코드 범위를 설명하는 근거이며 독립적인 서명/원격 CI 증명은 아니다.

## 실제 HTTP와 실제 AI의 구분

SyntheticDeploymentPrivacyPackagedIT 전체를 읽고 POM의 Failsafe 연결과 대조했다. 합성 검사 자식 프로그램은 실제 JAR에서 실행하고, Adapter가 보내는 HTTP도 실제다. 다만 응답 서버는 테스트에서 연 127.0.0.1의 가짜 서버다. 정상 사례의 Provider/HTTP 카운터 1을 상용 AI 요청 성공 1회라고 기록하면 안 된다. 반환 Model 문자열도 가짜 응답의 일부다.

이 증거는 패키징된 검사 프로그램/전처리/Adapter/DB 연결과 허용 범위 밖 입력의 외부 전송 거부를 검증한다. 실제 모델의 개인정보 탐지 정확도나 요약 품질은 별도 평가 대상이다. 상용 AI를 사용했던 과거 실험을 이번에 재실행한 것도 아니다.

## 빈 Lint 로그를 보완한 실행

기존 target/week12-status-eslint.log는 0 Byte였다. 앞선 명령의 성공 기록이 있어도 빈 파일 자체만으로 실행 여부/성공을 입증할 수는 없다. 그래서 기존 Java/Node/Browser를 반복하지 않고 ESLint만 한 번 실행했다.

- 실행 기준: Lab 1eca282fc5b80faa7dce78413e79562ba629c71a, 시작 시 작업 트리 Clean
- 명령: npx.cmd --yes --package eslint@10.11.0 eslint src/main/resources/static/*.mjs src/test/js/*.mjs
- 결과: exitCode=0, passed=true, 로그 0 Byte
- 메타데이터: Lab의 target/verification-audit-20261104-dcfd36ca/result.json
- 함께 기록한 값: 명령/Commit/작업 트리 상태/시작·종료 UTC 시각/종료 코드/로그 크기

환경변수 값/목록, 개인 암호, Cookie/CSRF/API Key는 기록하지 않았다. target은 Git에서 제외한 로컬 생성물이며 clean 시 사라진다. 공개 기록에는 결과/조건/한계를 정리하고 필요한 실행 증거는 별도로 보존한다. 이 문서의 신규 검증은 Lint 한 번이며 기존 418개나 1,221+2개를 다시 수행한 것으로 세지 않는다.

작성한 문서는 변경 Markdown 8개를 대상으로 UTF-8/BOM 없음/LF, 코드 펜스, 상대 링크 193개와 앵커 19개를 검사했다. PowerShell 예제 5개도 구문 오류 0건을 확인했다. 이는 문서/구문 검사이며 예제의 Java/Node/Browser 명령을 이번에 실행했다는 뜻은 아니다.

## 소스 확인 범위

| 대상 | 범위 |
|---|---|
| Lab docs/ticket-status.md와 새 docs/local-verification.md | VERIFIED. 현재 계약/절차/한계 전체 |
| SyntheticDeploymentPrivacyPackagedIT | VERIFIED. 두 사례와 JAR/HTTP/DB/정리 흐름 전체. 비밀값은 가이드에 옮기지 않음 |
| POM/README | PARTIAL. Java 기준, Failsafe 설정과 현재/과거 실행 요구사항 절을 선택. README 전체 최신화가 아님 |
| Browser 세 클래스/Script | PARTIAL. 대상/ProcessBuilder/PowerShell 경로/격리 DB/Provider 검증과 기존 기록 연결. 이번 감사에서 실험 전체를 다시 실행하지 않음 |
| 기존 Log/Report | PARTIAL. 성공·개수·고정 증거 줄만 선택해 대조. Raw Log 전체 검토/재실행과 구분 |
| AWS/상용 AI/CI/과거 모든 Browser 실험 | NOT_INSPECTED. 이번 감사 범위 밖 |

## 다음 학습과 마감

새 글이 먼저 Commit된 경우의 선택 대상/최신 글/명시적 확인 검사, 해결이 먼저 Commit된 경우의 RESOLVED 유지/새 글 확인 필요에 사용자가 정확히 답했다. [학습 기록](../study-notes/2026-11-04-study-questions.md)에 답변을 남겼으며 모든 구현을 혼자 재현했다고 판정하지 않는다.

다음에는 로컬 가짜 AI 서버의 HTTP 요청 수와 실제 상용 AI, 빈 Log와 종료 코드/실행 기준의 차이를 두 문항으로 확인한다. 남은 마감 산출물은 주간 WIL, 12주 회고, 10~12주 통합 블로그 초안과 다음 단계 계획이다. 제한 Pilot의 출시 조건은 후속으로 유지하고 새 기능/인프라를 이번 감사의 선행 조건으로 늘리지 않는다. 실제 학습 시간은 미기록이며 기존 주간 기준을 초기화하지 않는다.
