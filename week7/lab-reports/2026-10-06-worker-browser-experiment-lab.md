# Browser 접수·자동 Worker·담당자 조회의 연결 실험

> 실행일: 2026-10-06
> 상태: 통제된 Provider 사전 검증과 실제 AI의 Browser·자동 Worker·PostgreSQL 연결 완료, 해당 요약의 원문 대조 2점 확인. 고정 Dataset의 후속 평가는 별도 Report에 기록
> 범위: 일회용 PostgreSQL·Loopback Server·USER/AGENT Session·접수 화면·자동 Worker·제안 조회 화면
> Provider: 무료 사전 검증은 고정 합성 응답, 실제 실행은 Spring AI·OpenAI `gpt-6-luna`의 Chat Completions
> Lab Commit: `cb0781d` — `test(ai): connect isolated browser flow to scheduled worker`

## 연결한 흐름

```text
USER 로그인 → 접수 화면의 제목·본문 입력 → Session + CSRF POST
→ Ticket·Message·Job Commit → 201
→ Scheduler → Job 실행권·호출 예약 → Provider → 출력 검증 → 제안·분류·Job 완료 Commit
→ AGENT 로그인 → 조회 버튼 → 저장된 제안을 화면에 표시
```

접수 `201`과 제안 저장 완료는 다르다. 이 실험의 최종 Ticket은 `OPEN`, Job은 `SUCCEEDED`, 제안은 `PENDING_REVIEW`다. AI가 문의를 해결하거나 공식 답변을 게시하지 않는다.

## 실행 구성과 분리

Lab의 `scripts/week7-worker-browser-live.mjs`가 Java Experiment를 선택한다. `Week7WorkerBrowserExperiment`는 기존 Application을 `postgres,local-browser`로 조립하고 명시적 Provider·Guard·검증기를 제공한다. `Verify-Week7WorkerBrowser.ps1`은 Playwright CLI의 격리 Session에서 실제 Form Login·접수 버튼·조회 버튼을 사용한다. Processor나 Worker를 Test에서 직접 호출하지 않고 기존 Scheduler가 처리한다.

새 PostgreSQL 17.6 Testcontainer와 임의 Port를 사용한다. 기존 DB·사용자 Process·Application의 일반 실행 설정·Migration은 바꾸지 않았다. 고정 합성 원문에는 로그인 복구 사실과 합성 이메일 표식이 있다. 전송 복사본의 종류별 치환과 DB 원문 보존은 기존 Guard를 사용한다.

실험 Job만 생성 1회·보완 0회 Snapshot과 요약 상한 200자를 주입한다. 일반 Job의 기본 정책이나 실패별 재시도 조건을 변경하지 않았다. 다른 입력·추가 호출을 차단하는 Test용 Provider 경계도 둔다.

AI Key는 Browser 자식 Process에 전달하지 않는다. Cookie·CSRF 값·Header·전체 Prompt는 출력하지 않는다. Screenshot만 Git 제외 `output/playwright/`에 남기고 일회용 Session 기록·Container를 종료 후 정리했다. 다른 Browser Session이나 DB를 정리하지 않았다.

## 무료 사전 검증에서 관찰한 결과

| 확인 | 실제 결과 |
|---|---|
| 익명 AI 조회 / USER AI 조회 / AGENT AI 조회 | `401` / `403` / `200` |
| 로그인한 USER의 CSRF 없는 대조 POST | `403` |
| 실제 접수 화면의 정상 POST | `201`, 실제 요청에서 Session Cookie·CSRF Header 존재 확인 |
| Worker 실행 | Scheduler Bean 활성, 통제된 Provider 호출 1회 |
| 원문·작성자 | 원문 그대로 유지, 인증 USER를 작성자로 저장 |
| DB 결과 | 생성 예약 1회, Suggestion 1건, Category 1건 |
| 업무·처리·검토 상태 | `OPEN` / `SUCCEEDED` / `PENDING_REVIEW` |
| 화면과 DB | 요약·분류·우선순위·검토 상태 일치. 원문 값 대신 안전한 비교 결과 기록 |
| 조회 전후 | 여섯 Table의 Fingerprint 동일, 새 예약·제안 생성 없음 |
| 실제 유료 HTTP 요청 | 0회 |

화면은 ‘AI 제안 생성 완료·담당자 검토 대기’를 표시했다. 요약은 HTML 요소로 해석하지 않고 일반 문자열로 표시한다. 이 고정 응답의 화면 확인을 실제 모델 요약 평가로 기록하지 않는다.

## 검증과 수정

- 전체 Java `clean test`: 449개 통과, 실패·오류·건너뜀 0, Surefire XML 45개.
- 별도 무료 Browser Experiment: 1개 통과. 일반 Java 회귀와 별도 실행했다.
- 새 실행기 Test 12개 포함 JavaScript: 145개 통과, 실패·취소·건너뜀 0.
- ESLint 10.11.0: 오류 0.
- 무료 사전 실행에서 CORS 필수 설정 누락과 Windows Browser 실행 구성을 보완했다. 수정 후 실제 접수·조회 Form을 포함한 흐름을 다시 통과했다. 유료 호출은 없었다.

무료 사전 검증에서는 실제 Browser·PostgreSQL·자동 Worker를 실행하고 Provider 응답만 통제했다. 이후 같은 연결을 실제 AI로 실행한 결과는 아래에 따로 기록한다. 기존 Java 449개·JavaScript 145개의 무료 회귀와 별도 Live Experiment 한 건을 합쳐 회귀 Test 수로 표시하지 않는다.

## 실제 AI를 연결한 실행 결과

사용자가 Helpdesk 전용 PowerShell에서 `--live --confirm-helpdesk-key --confirm-synthetic --confirm-cost-limit-waiver --day 2026-10-06`으로 실행했다. 전달받은 결과를 Git 제외 Local Report와 별도 JUnit XML, AGENT 화면 Screenshot에 대조했다. `LIVE_WORKER_BROWSER_POSTGRES`·`COMPLETED`·`completed: true`이며 Live JUnit은 1개 통과, 실패·오류·건너뜀 0이다.

| 확인 | 실제 AI 실행 결과 |
|---|---|
| 접수 / CSRF 없는 대조 요청 | `201` / `403` |
| 익명 / USER / AGENT의 제안 조회 | `401` / `403` / `200` |
| 자동 처리 | 기존 Scheduler로 Worker 실행, Provider 호출 1회·생성 HTTP 요청 1회·Provider HTTP `200` |
| 원문·작성자 | 원문 보존, 인증 USER를 작성자로 저장 |
| DB 저장 | 생성 예약 1회, Suggestion 1건, Category 1건 |
| 상태 | Ticket `OPEN`, Job `SUCCEEDED`, 제안 `PENDING_REVIEW` |
| Browser 요청 | Session Cookie·CSRF Header 존재 확인, 값은 출력하지 않음 |
| 화면·DB·조회 | 저장된 값과 화면 일치, 조회 전후 여섯 Table 변화 없음 |
| 사용량 | 입력 1,169·출력 57 Token |
| 해당 호출 비용 추정 | `$0.000174625`, 기존 실행기의 보수적 단가 기준. 실제 청구액·하루 총액과 다름 |
| 내용 평가 | 사용자가 원문 대조에서 핵심 누락·추측이 없다고 확인해 기존 Rubric으로 요약 2점. 실행 당시 Report의 `manualContentReview: NOT_SCORED`는 원본 그대로 유지 |

앞선 Java Live 실험은 Processor를 직접 한 번 호출했다. 이번에는 USER의 실제 접수 화면부터 자동 Worker와 실제 AI, PostgreSQL 저장, AGENT의 조회 화면까지 이어졌다. 기존 Source·운영 설정·일반 Job 정책을 변경하거나 유료 실행을 다시 반복하지 않았다.

### 원문과 실제 화면의 요약

합성 문의 제목은 ‘로그인 링크 만료 이유 문의’다. 본문은 다음과 같다. 이메일 표식은 실제 개인정보가 아닌 실험용 값이며 Provider에는 Guard가 만든 치환 복사본을 전달했다.

> 제 계정에서 로그인 링크가 만료됐습니다. 새 링크로 로그인에는 성공했습니다. 급한 문의는 아니며 만료 이유를 알고 싶습니다. 이메일 <합성_이메일>.

실제 AGENT 화면의 요약은 다음과 같다.

> 로그인 링크가 만료됐지만 새 링크로 로그인에 성공했으며, 만료 이유를 문의합니다. 급한 문의는 아닙니다.

분류는 `ACCOUNT`, 우선순위는 `NORMAL`이다. Codex의 사전 대조에서는 로그인 복구·문의 목적·급하지 않다는 사실이 보존됐고, 원문에 없는 만료 원인이 추가되지 않은 것을 확인했다. 합성 이메일 표식도 요약에 없다. 이어서 사용자가 원문과 실제 요약을 대조하고 핵심 사실 누락이나 근거 없는 추측이 없다고 답했다. 기존 Rubric의 2점 조건에 해당하므로 이 요약은 2점으로 기록한다. 10월 7일 문답에서는 로그인 관련 내용이 `ACCOUNT`의 근거라는 답변을 확인했다. `NORMAL`은 로그인 복구뿐 아니라 ‘급한 문의는 아니다’라는 명시적 정보도 근거로 삼는다고 보완했다. [후속 복습 노트](../study-notes/2026-10-07-study-questions.md)에 구분을 남겼다. 출력 형식과 내용 평가는 나눠 진행한다. [OpenAI Structured Outputs의 오류 처리 설명](https://developers.openai.com/api/docs/guides/structured-outputs#handling-mistakes)

이번 학습에서 한 요약을 평가한 것과 Application의 담당자 검토 상태는 구분한다. Ticket은 여전히 `OPEN`이고 제안도 `PENDING_REVIEW`이며 이번 문답으로 DB 상태를 변경하지 않았다. 실행 당시 Local Report는 수정하지 않고 후속 수동 평가를 이 문서에 남긴다. 이 한 건은 고정 Dataset의 두 방식 비교와 별도이며 그 평가 분모에 합치지 않는다. 이후 분류·우선순위 확인, 고정 Dataset의 요약·Injection 평가와 핵심 문답, [Week 7 WIL](../wil.md)을 10/7에 마무리했다.

## 비용 승인과 원장

사용자는 당일 총비용 제한 없이 추가 호출을 승인했다. 실행기는 기존 원장에 `costLimitWaiver`를 기록하고 이전 비용 미확인·사용량·보류 금액·횟수를 유지한다. 기존 `limitUsd`는 이전 승인 기록이고 현재 Report는 `costLimitEnforced: false`다. 진행 중 예약을 지우거나 다른 날짜에 승인을 자동 적용하지 않는다. 비용 승인과 Job의 생성 예약·Attempt·기한은 구분한다.

이번 실제 실행 뒤 진행 중 예약은 없고 원장은 차단 상태가 아니다. 기존 비용 미확인은 유지하므로 `dailyEstimateComplete: false`·`dailyEstimatedTotalUsd: null`을 그대로 기록한다. 이전 `heldEstimatedUsd`도 지우지 않았다. 원장의 누적 예약 3건은 앞선 기동 복구·실제 Java 호출을 포함한 이력이며, 이번 Job의 Provider 호출 3회를 뜻하지 않는다.

## 점검한 Source 범위

- VERIFIED: 새 실행기·Browser 도구·Java 실험 조립·선택 Experiment·실행기 Test, 공유 비용 원장과 자식 환경 전달, 접수·조회 HTML/Page, Profile Security·CORS·Worker 설정·Scheduler·Policy·Guard·Provider 조립과 결과 Service.
- PARTIAL: 기존 Ticket Client는 접수·CSRF 경로를 중심으로 대조하고 전체 JavaScript Test를 실행했다. 기존 전체 기능·운영 배포를 새로 Audit한 것은 아니다. WIL 계약·계획·노트는 이번 연결·승인·현재 상태 구간을 선택해 갱신했다.

실제 실행 결과 추가 점검은 Local Report·Live JUnit XML·Screenshot, 실행기와 Java 실험의 판정 코드를 VERIFIED로 기록한다. 일회용 Container는 실험 종료 시 정리됐으며 운영 DB·전체 Dataset 수동 채점·운영 배포를 새로 검증한 것은 아니다.

관련 기록: [최소 AI 화면](./2026-10-06-agent-ai-suggestion-ui-lab.md), [앞선 실제 Java Provider 한 건](./2026-10-06-java-provider-adapter-lab.md), [10월 6일 학습노트](../study-notes/2026-10-06-study-questions.md).
