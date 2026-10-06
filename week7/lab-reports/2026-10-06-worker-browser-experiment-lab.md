# Browser 접수·자동 Worker·담당자 조회의 연결 실험

> 실행일: 2026-10-06
> 상태: 통제된 Provider의 실제 Browser Experiment 통과, 실제 AI 모드 준비
> 범위: 일회용 PostgreSQL·Loopback Server·USER/AGENT Session·접수 화면·자동 Worker·제안 조회 화면
> Provider: 무료 검증은 고정 합성 응답. 같은 흐름의 실제 유료 Provider는 NOT_RUN
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

## 관찰한 결과

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

실제 Browser·PostgreSQL·자동 Worker는 실행했다. Provider 응답만 통제된 값이다. 실제 AI와 같은 구성의 실행, 요약의 원문 대조·수동 채점과 Week 7 WIL은 이어서 수행한다.

## 비용 승인과 원장

사용자는 당일 총비용 제한 없이 추가 호출을 승인했다. 실행기는 기존 원장에 `costLimitWaiver`를 기록하고 이전 비용 미확인·사용량·보류 금액·횟수를 유지한다. 기존 `limitUsd`는 이전 승인 기록이고 현재 Report는 `costLimitEnforced: false`다. 진행 중 예약을 지우거나 다른 날짜에 승인을 자동 적용하지 않는다. 비용 승인과 Job의 생성 예약·Attempt·기한은 구분한다.

## 점검한 Source 범위

- VERIFIED: 새 실행기·Browser 도구·Java 실험 조립·선택 Experiment·실행기 Test, 공유 비용 원장과 자식 환경 전달, 접수·조회 HTML/Page, Profile Security·CORS·Worker 설정·Scheduler·Policy·Guard·Provider 조립과 결과 Service.
- PARTIAL: 기존 Ticket Client는 접수·CSRF 경로를 중심으로 대조하고 전체 JavaScript Test를 실행했다. 기존 전체 기능·운영 배포를 새로 Audit한 것은 아니다. WIL 계약·계획·노트는 이번 연결·승인·현재 상태 구간을 선택해 갱신했다.

관련 기록: [최소 AI 화면](./2026-10-06-agent-ai-suggestion-ui-lab.md), [앞선 실제 Java Provider 한 건](./2026-10-06-java-provider-adapter-lab.md), [10월 6일 학습노트](../study-notes/2026-10-06-study-questions.md).
