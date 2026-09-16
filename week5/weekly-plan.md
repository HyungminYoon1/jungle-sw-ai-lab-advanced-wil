# Week 5 학습 계획 — Browser JavaScript·Frontend 상태·Test 품질

> 작성일: 2026-09-14
> 최종 수정일: 2026-09-17
> 상태: In Progress — Event Loop·Rendering 비교 통과, Promise 배경 학습 중
> 기간: 2026-09-14 ~ 2026-09-20
> 원 계획 집중 학습량: 9월 16~18일 총 20시간, 하루 최대 7시간으로 한시 확대
> 실제 소요 시간: `NOT_RECORDED` — 계획 시간을 실제 학습 시간으로 대체하지 않음
> 일정 제약: 9월 19~20일은 가족 행사로 필수 학습을 배치하지 않음
> 핵심 질문: Browser의 비동기 실행과 Rendering을 이해하면서 최소 사용자 흐름을 신뢰할 수 있게 검증할 수 있는가?

## 계획 배경

Week 4에는 Session 인증, Password 검증, Role 기반 인가와 CSRF 경계를 실제 Spring Security Filter Chain Test로 확인했다. 최종 Java Test 42개가 통과했고 WIL 블로그 게시와 포럼 등록까지 완료했다.

현재 AI Helpdesk Lab에는 Ticket 생성과 단건 조회 API가 있지만 Browser UI, 정적 Resource, Frontend Package Manifest와 Browser E2E Test는 없다. Runtime 사용자는 구현하지 않았고 `USER`·`AGENT`는 Security Integration Test 안에서만 제공한다. 따라서 실제 Browser에서 보호 API의 성공 흐름을 검증하려면 Test 전용 인증과 데이터 준비 방식을 먼저 결정해야 한다.

이번 주는 React 같은 Framework를 도입하기 전에 JavaScript 실행 순서, DOM Event, Rendering과 비동기 UI 상태를 작은 실험으로 확인한다. 그 뒤 기존 단건 조회 API에 연결 가능한 최소 화면을 만든다. 실제 Browser E2E는 Security를 비활성화하거나 Credential을 Source에 넣지 않고도 재현 가능한 조건이 준비될 때만 진행한다.

9월 15일에는 야간만 사용할 수 있으므로 처음에는 지연 회상, Event Loop 배경 학습, 기본 실행 순서 예상과 첫 관찰을 9월 14일로 당기고, 15일에는 중첩 Microtask와 Main Thread Blocking Case만 짧게 재현하기로 계획했다.

실제 9월 14일에는 Week 4 지연 회상을 한 차례 교정 뒤 통과했고, Timer Callback의 기본 순서까지 학습했다. 하지만 Promise Microtask와 현재 동기 Code의 순서를 혼동했고 후속 확인 문제, Browser·Node 실행과 Study Note 마감을 진행하지 못했다.

9월 15일에는 개인 일정이 지연되어 자정을 넘겼고 학습·실험을 진행하지 못했다. 19~20일에도 가족 행사로 학습이 제한되므로 남은 범위는 16~18일 세 날에 끝낸다.

첫 압축안은 Event Loop·Promise·DOM Event·Rendering 같은 중심 범위를 유지했지만 CORS·XSS·Coverage 해석·정적 분석을 전용 근거 없이 조건부로 남겼고, `requestAnimationFrame`, 비동기 Race, `AbortController`, Network Panel 관찰을 일정 때문에 `Deferred`했다. 사용자는 시간을 더 투입하더라도 선택한 학습 자체를 빼지 않도록 요청했다. 이에 따라 제품 화면 수는 늘리지 않되 해당 학습을 독립 Spike와 최소 UI에 다시 포함하고, 16~18일 잔여 집중 학습 예산을 16시간 30분에서 20시간으로 늘린다.

실제 9월 16일에는 단순·중첩 Microtask를 예상하고 Node.js와 Browser Console에서 실행했지만, 중첩 Microtask 원인의 최종 재설명은 날짜가 바뀐 뒤 완료했다. 9월 17일 00:55 KST까지 Main Thread Blocking과 이중 `requestAnimationFrame`·Performance Marker 비교를 완료했고 Promise는 배경 자료를 보완하는 단계에서 중단했다. Promise 이후 선택 범위는 수행하지 않았으며 삭제하지 않고 `NOT_RUN`으로 유지한다.

## Week 4 지연 회상 Gate

Week 5 구현을 시작하기 전에 자료 없이 다음 세 문장을 완성한다.

1. Browser가 후속 Request에서 보내는 것은 ______이고 Server가 복원하는 것은 ______이다.
2. 인증된 `USER`의 조회 `403`은 ______ 실패이고, 같은 USER의 Token 없는 생성 `403`은 ______ 실패다.
3. 전체 Test가 Green이어도 별도 Log 점검이 필요한 이유는 ______이다.

세 답을 설명하지 못하면 Security 구현을 다시 늘리지 않고 Week 4의 객체 흐름과 두 `403`만 30분 이내로 복습한다. 지연 회상 결과는 첫 Study Note에 `PASS`, `PASS_AFTER_CORRECTION` 또는 `REVIEW_REQUIRED`로 기록한다.

## 목표

| 구분 | 목표 | 완료 근거 |
|---|---|---|
| 개념 | Call Stack, Task·Microtask, Promise·Async/Await와 Rendering 기회를 연결해 설명한다. | 실행 순서 예상·관찰 표와 자신의 설명 |
| 실험 | Event Loop 순서, Fetch 성공·HTTP 오류·Network 오류와 동적 DOM Event를 분리해 재현한다. | 독립 Spike와 실패 Case |
| 선택 적용 | Ticket ID 입력부터 Loading·Success·Not Found·Forbidden·Network Error를 구분하는 최소 화면을 만든다. | 작은 HTML·CSS·JavaScript Diff와 Test |
| Test 품질 | Unit·DOM Integration·Browser E2E가 각각 무엇을 증명하는지 구분한다. | Test 책임 표와 대표 실패 Test |
| 공개 기록 | 실제 수행 범위, E2E Gate 결과와 미수행 경계를 Week 5 WIL에 남긴다. | WIL과 재현 가능한 근거 Link |

## Baseline

| 항목 | 현재 확인 상태 | 이번 주 판단 기준 |
|---|---|---|
| WIL Repository | `main`, 계획 직전 HEAD `d84dffa`, Working Tree Clean | Week 5 계획·기록만 공개 |
| AI Helpdesk Lab | `main`, HEAD `f305708`, Working Tree Clean | UI와 Test 변경을 WIL 문서 Commit과 분리 |
| Java 회귀 | 2026-09-14 15:06 KST 일반 `clean test`, 42개 통과·실패 0·오류 0·건너뜀 0 | Frontend 변경 뒤 같은 42개 계약 유지 |
| Backend | Spring Boot 4.1.1, Java 25, In-memory Ticket Repository | 새 목록 API나 Database Adapter를 만들지 않음 |
| API | `POST /api/tickets`, `GET /api/tickets/{id}` | 단건 조회를 최소 Browser 흐름으로 선택 |
| Security | Session·Role·CSRF Test 완료, Runtime 사용자 없음 | Browser 성공 E2E 전 Test 전용 인증 Gate 필요 |
| JavaScript Runtime | Node.js 22.23.2, npm 11.12.0, Node Test Coverage Option 확인 | Version과 Coverage 실행을 기억이 아니라 실행 결과로 기록 |
| Browser | Chrome·Edge 설치 확인 | 실제 선택 Browser와 Version은 E2E 실행 시 기록 |
| Frontend 구성 | 정적 Resource·`package.json`·Browser Test Runner·ESLint Command 없음 | 필요한 최소 구성만 선택하고 설치 전 이유 기록 |

위 Baseline은 계획 시점 확인이다. 실제 학습 시작 전 두 저장소 상태와 Runtime Version을 다시 확인하며, 이후 변경이나 설치를 미리 완료한 것으로 취급하지 않는다.

## 핵심 범위 결정

### 선택한 최소 사용자 흐름

이번 주 UI의 중심은 다음 한 흐름이다.

```text
Ticket ID 입력
        ↓
조회 버튼 또는 Submit Event
        ↓
Loading 표시
        ↓
GET /api/tickets/{id}
        ↓
Success | 401 | 403 | 404 | Network Error
        ↓
서로 구분되는 화면 상태
```

목록 Endpoint를 새로 만들지 않고 기존 단건 조회 계약을 사용한다. 먼저 주입 가능한 API 경계나 Fake Response로 각 UI 상태를 재현하고, 실제 Server 연결은 Browser E2E Gate를 통과한 뒤 추가한다. Fake Response만 사용한 Test를 실제 Backend E2E라고 부르지 않는다.

### Must — Week 5 완료에 필요

- Week 4 지연 회상 Gate와 시작 Baseline 확인
- 동기 Code, Promise·`queueMicrotask`, Timer의 실행 순서 예상과 실제 비교
- `async`·`await`가 Promise 위에 만드는 제어 흐름과 오류 전달 설명
- `fetch`의 HTTP 오류와 Network 오류를 서로 다른 조건으로 처리
- Loading·Success·Empty 또는 Not Found·Forbidden·Error 상태 전이 정의
- Event Bubbling의 `target`·`currentTarget`과 Event Delegation 비교
- DOM·CSSOM·Render Tree·Layout·Paint의 기본 순서 설명
- 두 Local Origin에서 CORS 실패, Simple Request와 Preflight·허용 Header 비교
- 사용자 제공 문자열의 `textContent` Rendering과 위험한 HTML 삽입의 XSS 경계 비교
- 최소 Ticket 단건 조회 화면과 의미 있는 JavaScript Test
- Node Test Coverage로 측정 사각지대를 확인하고 높은 수치와 좋은 Test의 차이 설명
- ESLint 기반 정적 분석을 실행하고 Test·Coverage와 발견 범위 비교
- `requestAnimationFrame`·Performance Marker, 비동기 Response Race·`AbortController`, Network Panel Trace 수행
- 실제 Browser E2E 1개 또는 Gate 실패를 포함한 `Partially Completed` 판정
- Java 42개 회귀, Frontend Test 결과와 Week 5 WIL

### 복원한 확장 실험 — 일정 때문에 제외하지 않음

- `requestAnimationFrame`과 Performance Marker로 DOM 변경 뒤 Rendering 기회 관찰
- 빠르게 연속 조회했을 때 늦은 Response가 최신 화면을 덮는 Race 재현
- `AbortController`로 이전 조회 취소 비교
- 실제 Browser Network Panel에서 Request·Response와 Timing 한 번 기록

위 네 항목은 첫 압축안에서 `Deferred`했지만 학습량 재검토 뒤 16~18일 실행 계획에 복원했다. 완료 판정에는 예상·실행·관찰 또는 실패 원인 기록이 필요하며, 단순 언급으로 수행 처리하지 않는다.

### 이번 주에 포함하지 않음

- React, Vue, SSR, Redux·Zustand와 Bundler 최적화
- Ticket 목록·검색·수정·삭제 Backend 기능 추가
- Design System, 복잡한 Animation과 반응형 화면 완성
- PostgreSQL Adapter·Migration·Testcontainers
- 모든 API 경로의 Browser E2E
- Coverage 비율을 목표 수치로 올리기 위한 Test 추가
- XSS·CORS 전체 보안 실험을 UI 구현과 동시에 확장

### 조건부 후속

- XSS는 외부 통신·Credential 접근이 없는 격리된 최소 Page에서 무해한 DOM Marker만 사용해 `textContent`와 위험한 HTML 삽입을 비교한다. Sanitizer·Trusted Types·CSP 전체 적용은 실제 HTML 허용 요구가 생길 때 후속 검토한다.
- CORS는 두 Local Origin의 독립 Spike로 실패·Preflight·허용 Header를 확인한다. Helpdesk Runtime CORS 설정은 Frontend와 Backend를 실제로 다른 Origin에서 실행할 때만 적용한다.
- Ticket 생성 UI와 CSRF Token 전달은 단건 조회 흐름과 E2E 인증 Gate가 안정된 뒤 판단한다.

## 시간 배분

| 활동 | 계획 시간 | 종료 조건 |
|---|---:|---|
| 개념·공식 자료 | 5시간 | Event Loop·Promise·Rendering·CORS·XSS 경계를 설명 |
| 독립 Spike | 7시간 | 예상, 실제 출력·Browser 관찰과 차이 원인 기록 |
| 최소 UI·Test | 4시간 30분 | 상태별 화면, Coverage와 대표 실패 Test |
| Review·회귀·WIL | 3시간 30분 | 정적 분석·E2E·회귀와 증명 범위 기록 |

일일 집중 학습 상한은 이번 일정에 한해 7시간으로 늘린다. 시간이 부족하면 UI 장식, 추가 Backend Endpoint, WIL 문장 다듬기를 먼저 줄인다. 선택한 학습 키워드, 실패 재현과 Test 근거는 일정만을 이유로 삭제하지 않는다.

9월 14일 실제 소요 시간을 기록하지 않았으므로 이를 추정해 남은 시간에서 빼지 않는다. 9월 16일 6시간 30분, 17일 6시간 50분, 18일 6시간 40분으로 총 20시간을 배치한다. 이 시간은 집중 학습 기준이며 식사와 긴 휴식은 포함하지 않는다. 각 90분 이내 Block 사이에는 최소 10분 쉬고, 이해가 무너진 상태에서 다음 키워드로 진행하지 않는다.

## 학습 계획

| 학습 주제 | 상태 | 핵심 질문 | 방법 | 증거 |
|---|---|---|---|---|
| Event Loop | 핵심 학습 | 동기 Code, Microtask와 Timer는 왜 그 순서로 실행되는가? | [Browser JavaScript Event Loop 입문](./study-docs/browser-javascript-event-loop-basics.md)을 읽고 실행 전 순서 작성 후 Node와 Browser Console 비교 | 예상·실제 표 |
| Promise·Async/Await | 핵심 학습 | `await` 전후 Code와 Rejection은 어느 흐름으로 이동하는가? | 같은 동작을 Promise Chain과 `async` Function으로 비교 | 설명·실패 Spike |
| Fetch | 핵심 학습 | HTTP `404`와 Network 실패는 왜 같은 방식으로 잡히지 않는가? | `response.ok` 검사 유무와 Reject Case 비교 | Test·관찰 Log |
| CORS | 독립 Spike | Browser는 왜 다른 Origin의 Response 읽기를 제한하며 Preflight는 언제 필요한가? | 두 Local Origin에서 실패·허용 조건과 Header 비교 | Browser Console·Network Trace |
| UI 상태 | 선택 적용 | 비동기 Request 전후 화면 상태를 어떻게 빠짐없이 표현하는가? | 상태 표를 먼저 만들고 Rendering Function 작성 | State Matrix·Unit Test |
| XSS Rendering 경계 | 독립 Spike | Server 문자열을 DOM에 넣을 때 Code가 아니라 Text로 다루려면 무엇을 사용해야 하는가? | 격리된 Page에서 `textContent`와 위험한 HTML 삽입 비교 | 안전한 최소 재현·설명 |
| DOM Event | 핵심 학습 | 부모 Listener 하나가 동적으로 추가된 자식 Event를 어떻게 처리하는가? | 개별 Listener와 Delegation 비교 | Bubbling Spike |
| Rendering | 독립 Spike | DOM 변경은 언제 Style·Layout·Paint로 이어지는가? | 공식 자료와 DevTools 최소 관찰 | Learning Note 또는 Study Note |
| Test 책임 | 핵심 학습 | Pure Unit, DOM Integration과 실제 Browser E2E의 실패 의미는 무엇인가? | 같은 기능을 서로 다른 Boundary에서 비교 | Test 책임 표 |
| Coverage 해석 | 핵심 학습 | 실행된 Line 비율이 높아도 중요한 결함을 놓칠 수 있는 이유는 무엇인가? | Node Test Coverage와 의도적으로 약한 Test 비교 | Coverage Report·해석 Note |
| 정적 분석·Lint | 핵심 학습 | Code를 실행하지 않는 검사가 Test와 다른 문제를 어떻게 찾는가? | 최소 ESLint 설정으로 사용하지 않는 값·규칙 위반 재현 | Lint 실패·수정 결과 |
| Browser E2E | 조건부 후속 | 실제 Session·Role을 유지한 단건 조회 성공을 재현할 수 있는가? | 아래 E2E Gate 통과 뒤 Browser 1종에서 실행 | 실제 Browser 결과 또는 `NOT_RUN` |

## Lab 계획

| 순서 | Lab | 실행 전 예상 | 완료 조건 | 상태 |
|---:|---|---|---|---|
| 1 | Task·Microtask·Timer 순서 Spike | 동기 Code 후 Microtask Queue가 비워지고 다음 Task가 실행된다. | 중첩 Microtask까지 예상과 실제를 설명 | Planned |
| 2 | Promise·`async` 오류 Spike | HTTP 응답과 Network 오류는 다른 분기로 들어간다. | `response.ok` 누락 실패를 재현 | Planned |
| 3 | CORS 두 Origin Spike | Browser는 허용 Header가 없는 다른 Origin Response를 읽지 못한다. | 실패·Simple·Preflight·허용 조건을 Network에서 구분 | Planned |
| 4 | UI State Model | Boolean `loading` 하나로는 여러 결과를 표현하기 어렵다. | 상태와 허용 전이를 표와 Test로 표현 | Planned |
| 5 | Event Delegation | 부모 Listener는 Bubbling된 Event의 Target을 검사할 수 있다. | 동적 자식에서도 동작하고 잘못된 Target은 무시 | Planned |
| 6 | Rendering·XSS 경계 | DOM 문자열 삽입 API에 따라 Text와 HTML 해석이 달라진다. | 격리된 Page에서 안전한 Rendering 기준 설명 | Planned |
| 7 | Race·취소·Rendering Timing | 늦은 Response와 긴 Task가 최신 UI·Paint를 지연시킨다. | Race 재현, `AbortController`와 Rendering Marker 비교 | Planned |
| 8 | Ticket 단건 조회 UI | Request 중·성공·각 실패가 다른 화면으로 보인다. | 최소 HTML·CSS·JavaScript와 Test | Planned |
| 9 | Coverage·정적 분석 | Line 실행과 결함 검출은 같지 않고 Lint는 다른 실패를 찾는다. | Coverage 맹점과 Lint 실패·수정 근거 | Planned |
| 10 | Browser E2E Gate | Runtime 인증과 Test Data가 없으면 성공 흐름을 증명할 수 없다. | 아래 다섯 조건 판정 | Planned |
| 11 | 전체 회귀·WIL | Frontend 변경이 기존 Java 계약을 깨지 않는다. | Java 42개와 선택한 JS·Browser Test 결과 기록 | Planned |

## 실제 Browser E2E Gate

다음 조건을 모두 만족해야 실제 Browser E2E를 시작한다.

1. Browser Test Runner와 설치 Version을 명시하고, 의존성 추가 이유를 설명한다.
2. Local Server를 Test가 재현 가능하게 시작·종료하며 이미 떠 있는 임의 Process에 의존하지 않는다.
3. Test 전용 사용자와 데이터 준비가 Production Runtime 구성과 분리된다.
4. Credential 값을 Source·Console·Report에 출력하지 않고 Security·CSRF를 전역 비활성화하지 않는다.
5. Fake Route가 아니라 실제 Spring Server 응답을 받은 Test만 Backend E2E라고 기록한다.

Gate를 통과하면 Browser 한 종류에서 `AGENT Login → 존재하는 Ticket 단건 조회 → 제목·상태 표시` 한 경로만 자동화한다. Test Data 준비를 위해 새 제품 기능을 만들거나 Security를 약화해야 한다면 E2E는 `NOT_RUN`으로 남기고 Week 5를 `Partially Completed`로 판정한다.

Playwright는 후보일 뿐 아직 선택·설치하지 않았다. Node 내장 Test Runner로 Pure Logic을 먼저 검증하고, 실제 DOM·Network가 필요한 순간에만 Browser Runner 추가 비용을 판단한다.

## Test 책임 분리

| Test | 빠르게 확인할 것 | 증명하지 않는 것 |
|---|---|---|
| Pure JavaScript Unit | 상태 전이, HTTP Status Mapping, Rendering Input | 실제 DOM Event·Browser Rendering·Network |
| Browser DOM Integration | Event Bubbling, 실제 Element 변화, Loading·Error 표시 | 실제 Spring Security와 Backend 상태 |
| Browser E2E | 실제 Browser·Server·Session·HTTP를 잇는 대표 흐름 | 모든 경로, 성능과 Production 배포 |
| 기존 Java Test | Domain·Controller·Security Filter 계약 회귀 | Browser UI 동작 |

같은 Assertion을 모든 Layer에 복사하지 않는다. 하위 Test에서 충분한 상태 조합을 확인하고, Browser E2E는 사용자가 보는 대표 경로 한 개에 집중한다.

## 9월 14일 수행 기록

계획 시간은 3시간 10분이었지만 실제 소요 시간은 기록하지 않았으므로 추정해서 채우지 않는다.

| 계획 | 실제 결과 | 판정 | 이월 |
|---|---|---|---|
| Week 4 지연 회상 세 문장 | Session 객체 이름을 한 차례 교정한 뒤 인증 복원, 두 `403`, Test와 Log 점검의 차이를 설명 | `PASS_AFTER_CORRECTION` | 없음 |
| Event Loop 입문 자료 | Call Stack·현재 동기 실행·Timer Task·Microtask의 기본 설명을 진행했으나 문서 전체 학습은 확인하지 않음 | `PARTIAL` | 9월 15일 핵심 문장 회상 |
| 세 Code Example 분류·예상 | Timer Case의 출력 순서는 맞혔지만 등록과 Callback 실행을 혼동했고, Promise Case는 `D`보다 `C`가 먼저라고 잘못 예상 | `REVIEW_REQUIRED` | 9월 15일 단순 Case부터 재확인 |
| Browser Console·Node 실행 | 실행하지 않음 | `NOT_RUN` | 9월 15일 실행 |
| 오개념·결과 기록 | 대화 근거를 Study Note로 옮겼지만 사용자의 최종 요약은 미작성 | `PARTIAL` | 9월 15일 마감 |

자료를 생성하거나 정답 설명을 읽은 사실은 Event Loop 학습 완료 근거가 아니다. 9월 14일 Event Loop 범위는 `Partially Completed`로 유지한다.

## 9월 15일 실행 결과

개인 일정이 지연되어 계획한 야간 90분을 확보하지 못했고 자정을 넘겼다. 문답, Browser·Node 실행과 새 학습 기록은 모두 진행하지 않았다.

판정: `NOT_RUN — SCHEDULE_CONSTRAINT`

9월 14일에서 이월한 Event Loop 기본 순서 교정과 원래 15일 범위였던 중첩 Microtask·Main Thread Blocking은 9월 16일 Block에 합친다.

## 9월 16~18일 복원 실행 계획

### 9월 16일 — Event Loop·Promise·Fetch·CORS와 상태 모델

집중 학습 상한: 6시간 30분

| 순서 | 시간 | 내용 | 종료 조건 |
|---:|---:|---|---|
| 1 | 20분 | Timer 등록·Callback, 단순 Microtask 순서 재회상 | `X → Z → Y`, `A → D → C → B`를 Queue 변화로 설명 |
| 2 | 35분 | Browser Console·Node 기본 Case 실행 | 실행 전 예상, 실제 출력과 환경을 기록 |
| 3 | 40분 | 중첩 Microtask 실행 | Queue가 빌 때까지 처리되는 과정 설명 |
| 4 | 50분 | 0.5초 동기 Blocking, `requestAnimationFrame`·Performance Marker | Main Thread 점유와 Rendering 기회 차이 관찰 |
| 5 | 70분 | Promise Executor, Chain과 `async`·`await` | 동기 부분, Microtask Continuation과 Rejection 흐름 설명 |
| 6 | 50분 | Fetch의 HTTP 오류·Network 오류 비교 | `response.ok` 검사와 Promise Reject 조건 구분 |
| 7 | 60분 | 두 Local Origin CORS Spike | 차단·Simple·Preflight·허용 Header를 Network에서 구분 |
| 8 | 45분 | Ticket 조회 UI 상태 모델 | Loading·Success·Not Found·Forbidden·Network Error 전이표 |
| 9 | 20분 | Study Note 마감 | 예상·관찰·오답 원인과 독립 재설명 판정 기록 |

앞의 단순 Microtask 순서를 독립적으로 설명하지 못하면 중첩 Case로 넘어가지 않는다. CORS Spike는 Helpdesk 인증 설정을 임의로 약화하지 않고 독립된 두 Local Origin으로 먼저 실패 조건을 재현한다.

### 9월 17일 — DOM Event·Rendering·XSS와 비동기 Race

집중 학습 상한: 6시간 50분

| 순서 | 시간 | 내용 | 종료 조건 |
|---:|---:|---|---|
| 1 | 60분 | Event Bubbling·`target`·`currentTarget`·Delegation | 동적 자식을 부모 Listener로 처리하는 이유 설명 |
| 2 | 45분 | DOM·CSSOM·Render Tree·Layout·Paint | DOM 변경과 실제 Paint 시점을 구분 |
| 3 | 30분 | Pure Unit·DOM Integration·Browser E2E 책임 설계 | 같은 Assertion을 중복하지 않는 Test 책임 표 |
| 4 | 90분 | 기존 단건 조회 API용 최소 HTML·CSS·JavaScript | Loading과 성공·실패 상태가 서로 다르게 표시됨 |
| 5 | 45분 | 무해한 DOM Marker만 쓰는 격리된 XSS Rendering Spike | `textContent`와 위험한 HTML 해석 차이·방어 경계 설명 |
| 6 | 45분 | 느린 이전 Response가 최신 UI를 덮는 Race 재현 | 완료 순서와 화면 상태가 어긋나는 실패 관찰 |
| 7 | 35분 | `AbortController`로 이전 조회 취소 | Race 완화 전후 동작과 한계 비교 |
| 8 | 45분 | 상태 전이와 대표 실패 JavaScript Test | HTTP Status Mapping과 Network 실패 Test 통과 |
| 9 | 15분 | Study Note | 구현보다 먼저 설명할 수 없었던 지점 기록 |

새 목록 API, Frontend Framework와 Design System은 만들지 않는다. 동적 목록은 Event Delegation 학습용 독립 Spike로 만들고 제품 Endpoint를 추가하지 않는다. 최소 UI가 늦어지면 Style을 줄이고 상태 구분·XSS 경계·Test를 보존한다.

### 9월 18일 — Coverage·정적 분석·E2E·통합 검증

집중 학습 상한: 6시간 40분

| 순서 | 시간 | 내용 | 종료 조건 |
|---:|---:|---|---|
| 1 | 20분 | Event Loop·Fetch·Event Delegation 지연 회상 | 자료 없이 핵심 흐름 설명 |
| 2 | 30분 | 최소 UI·JavaScript Test 미완료분 마감 | 대표 성공·실패 Test와 증명 범위 확정 |
| 3 | 45분 | Node Test Coverage 측정과 맹점 Case | 높은 Line Coverage가 결함 검출을 보장하지 않음을 재현 |
| 4 | 45분 | 최소 ESLint 설정·실패·수정 | Test와 다른 정적 검사 발견 범위 설명 |
| 5 | 30분 | Browser Network Panel Trace | Request·Response·Timing과 실행 환경 기록 |
| 6 | 30분 | 실제 Backend Browser E2E Gate 판정 | 다섯 조건을 각각 `PASS` 또는 실패 사유로 기록 |
| 7 | 60분 | 실제 Backend E2E 또는 격리된 Browser UI E2E | 실제 Server 여부를 구분한 `RUN·PASS` 또는 `NOT_RUN` 근거 |
| 8 | 40분 | Java·JavaScript 전체 회귀 | Test 수·실패·오류·건너뜀과 실행 환경 기록 |
| 9 | 75분 | Week 5 WIL 작성·검토 | 실제 수행·교정·미수행 경계가 드러나는 초안 |
| 10 | 25분 | Secret·경로 점검과 최종 판정 | 완료·부분 완료·이월 항목 확정 |

Gate를 통과하면 실제 Spring Server 흐름을 검증한다. Gate가 실패해도 Browser 자동화 자체의 학습을 빼지 않고 통제된 Test Double 경계의 UI 흐름을 실행하되, 이를 실제 Backend E2E로 부르지 않는다. Backend E2E는 정확히 `NOT_RUN`으로 기록한다. 외부 블로그 게시와 포럼 등록은 별도 확인이 필요한 작업이며 이번 학습 계획의 자동 완료 조건에 포함하지 않는다.

### Cut Line

- 공지 기반 선택 키워드와 복원한 네 확장 실험은 일정만을 이유로 삭제하지 않는다.
- 시간이 부족하면 UI Style, 추가 화면·Endpoint, WIL 문장 다듬기를 먼저 줄인다.
- Package·도구 설정은 최소화하되 Coverage와 ESLint 실행 근거는 생략하지 않는다.
- E2E Gate가 실패하면 Security를 끄거나 Source에 Credential을 넣지 않는다. 격리된 UI E2E와 실제 Backend E2E의 명칭·근거를 분리한다.
- 18일 안에 Must가 끝나지 않으면 Week 5를 `Partially Completed`로 판정하고 다음 학습 가능일로 명시적으로 이월한다.
- 미완료분을 19~20일 가족 행사 시간에 자동 배치하지 않는다.

## 9월 16~17일 실제 진행 기록

실제 소요 시간은 측정하지 않았으므로 계획 시간에서 역산하지 않는다.

### 9월 16일

| 범위 | 실제 결과 | 판정 |
|---|---|---|
| 단순 Task·Microtask·Timer | 실행 전 예상과 Node.js·Browser Console 출력 일치 | `PASS` |
| 중첩 Microtask | `A → E → B → C → D` 예상·Node.js·Browser 실행, 다음 Task 문자 한 차례 교정 | `RUN_PASS_AFTER_CORRECTION` |
| 중첩 Microtask 원인 설명 | Browser 실행은 완료했지만 Queue 소진 원인의 최종 재설명은 날짜 경계 뒤로 넘어감 | `REVIEW_REQUIRED_AT_DATE_BOUNDARY` |
| Main Thread Blocking·Rendering | 미실시 | `NOT_RUN` |
| Promise·Fetch·CORS·UI 상태 모델 | 미실시 | `NOT_RUN` |

상세 근거: [9월 16일 Study Note](./study-notes/2026-09-16-study-questions.md)

### 9월 17일 00:55 KST 종료 요청 시점

| 범위 | 실제 결과 | 판정 |
|---|---|---|
| 중첩 Microtask 원인 | 새 Microtask까지 Queue가 빌 때까지 처리한 뒤 다음 Task를 선택한다고 재설명 | `PASS_AFTER_TERMINOLOGY_CORRECTION` |
| 기본 Main Thread Blocking | DOM은 `작업 중 → 완료`, 화면은 `대기 → 완료`로 관찰 | `RUN_PASS` |
| 이중 `requestAnimationFrame` | 화면 `대기 → 작업 중 → 완료`, Callback Marker 간격 4.8ms·Blocking 1000.0ms 관찰 | `RUN_PASS` |
| Performance Marker 해석 | Marker 간격과 Paint 시각을 같은 근거로 취급하지 않음 | `PASS` |
| Promise 상태·`resolve`·`then` | 외부 검색 답변을 제공했으나 의미를 이해하지 못했다고 명시, 자료 보완 | `EXTERNAL_SOURCE_ANSWER_NOT_ASSESSED` |
| Promise Runtime·Fetch 이후 선택 범위 | 미실시 | `NOT_RUN` |

상세 근거: [9월 17일 Study Note](./study-notes/2026-09-17-study-questions.md)

사용자는 자정 직후 학습을 중단하고 잠든 뒤 이어서 진행하기로 했다. 재개 시 Promise의 세 역할을 검색 없이 설명하는 Gate부터 시작한다. 선택한 학습 범위는 줄이지 않되, 실제 9월 17일 학습 뒤에도 18일까지 끝나지 않으면 Cut Line에 따라 `Partially Completed`와 명시적 이월을 사용한다.

## 권장 일정

| 날짜 | 학습·예상 | 실험·적용 | 종료 조건 | 상태 |
|---|---|---|---|---|
| 9월 14일 월요일 | Week 4 지연 회상, Call Stack·Task·Microtask 입문 | Timer·Promise 기본 Case 예상, 실행은 미실시 | 회상은 통과, Event Loop는 교정 중 | `Partially Completed` |
| 9월 15일 화요일 야간 | 개인 일정 지연 | 문답·실행 없음 | 학습 미실시를 숨기지 않고 이월 | `NOT_RUN` |
| 9월 16일 수요일 | Event Loop·Promise·Async/Await·Fetch·CORS | 실제로는 Event Loop 기본·중첩 Browser·Node 실행까지 수행 | 중첩 원인 재설명은 날짜 경계 뒤 완료 | `Partially Completed` |
| 9월 17일 목요일 | DOM Event·Rendering·XSS·Race | 00:55까지 Blocking·이중 `requestAnimationFrame` 완료, Promise 배경 학습 중 | 잠든 뒤 Promise 역할 Gate부터 재개 | `In Progress` |
| 9월 18일 금요일 | Coverage·정적 분석·E2E·통합 회상 | 원 계획과 미완료 선택 범위를 실제 가능 시간에 따라 계속 수행 | 미완료를 삭제하지 않고 실제 결과로 최종 판정 | Planned — 범위 유지 |
| 9월 19일 토요일 | 가족 행사 | 필수 학습 배치 없음 | 일정 보호 | No Required Work |
| 9월 20일 일요일 | 가족 행사 | 필수 학습 배치 없음 | 일정 보호 | No Required Work |

16~18일의 미완료분을 19~20일로 자동 이동하지 않는다. 실제 수행일과 계획일이 다르면 Study Note에 둘 다 기록한다. 실제 학습 시간이 기록되지 않았으므로 계획 시간을 채운 것으로 간주하지 않으며, 잠든 뒤 확보 가능한 시간을 확인한 다음 18일까지의 완료 가능성을 다시 판정한다.

## 위험과 대응

| 위험 | 조기 신호 | 대응 | 상태 |
|---|---|---|---|
| Frontend Toolchain 확대 | 첫 화면 전에 Package·Config가 계속 늘어남 | Vanilla JavaScript와 Node 내장 Test부터 시작 | Open |
| Backend 기능 확대 | 목록·검색·사용자 저장소 구현이 UI보다 먼저 커짐 | 기존 단건 조회만 사용하고 E2E Gate로 분리 | Open |
| Security 우회 | E2E를 위해 CSRF·인가를 끄려 함 | 실행 중단 후 Test 전용 인증 경계 재설계 | Open |
| Mock를 E2E로 오인 | Browser가 실제 Server에 Request하지 않음 | Fake DOM Test와 Backend E2E 명칭 분리 | Open |
| 비동기 Race | 이전 Response가 최신 화면을 덮음 | 9월 17일 Spike로 재현하고 `AbortController` 적용 전후 비교 | Planned |
| UI 장식 과다 | CSS 작업이 핵심 실험보다 길어짐 | 상태 구분에 필요한 최소 Style만 유지 | Open |
| Coverage 목표화 | 의미 없는 Line 실행 Test가 증가 | 대표 실패와 Boundary 설명을 완료 기준으로 사용 | Open |

## 계획된 산출물

| 산출물 | 목적 | 생성 조건 | 상태 |
|---|---|---|---|
| `week5/weekly-plan.md` | 범위·Baseline·E2E Gate | Week 5 시작 | Ready |
| [Browser JavaScript Event Loop 입문](./study-docs/browser-javascript-event-loop-basics.md) | 배경지식 없이 실행 순서를 추적하기 위한 기초 자료 | 9월 14일 일정 당김 | Ready — 학습 여부는 별도 확인 |
| [JavaScript Promise와 Async/Await 기초](./study-docs/javascript-promise-async-await-basics.md) | Promise 상태·역할·Chain 선행 개념 | `resolve`·`then` 의미를 이해하지 못함 | Ready — 독립 재설명 `NOT_RUN` |
| [9월 14일 Study Note](./study-notes/2026-09-14-study-questions.md) | 실제 답변·교정과 미실시 범위 기록 | 9월 14일 Session 종료 | Recorded — Event Loop `REVIEW_REQUIRED` |
| [9월 16일 Study Note](./study-notes/2026-09-16-study-questions.md) | Event Loop 예상·Node.js·Browser 실행 | 9월 16일 Session | Recorded — 날짜 경계에서 원인 설명 이월 |
| [9월 17일 Study Note](./study-notes/2026-09-17-study-questions.md) | Rendering 비교와 Promise 배경 학습 | 9월 17일 00:55 종료 요청 | Recorded — Promise `BACKGROUND_LEARNING` |
| 날짜별 후속 Study Note | 예상·답변·관찰·교정 기록 | 각 후속 학습 Session | Planned |
| Rendering Learning Note | 재사용 가능한 Rendering 설명 | 입문 자료와 실제 관찰만으로 설명이 부족할 때 | Conditional |
| Browser UI Lab Report | UI 상태와 Test Boundary 근거 | 최소 UI 실행 뒤 | Planned |
| Week 5 WIL | 이해 변화·실패·E2E 상태 | 주말 실제 결과 | Planned |

## Learning Evidence Gate

- [x] Week 4 지연 회상 결과를 기록했다.
- [x] Event Loop 실행 순서를 실행 전에 예상했다.
- [x] Task·Microtask·Rendering의 관찰 결과와 예상 차이를 설명했다.
- [ ] Promise·Async/Await와 Fetch 오류 경계를 실패 Case로 확인했다.
- [ ] 두 Origin의 CORS 실패·Preflight·허용 Header 차이를 관찰했다.
- [ ] Loading·Success·Not Found·Forbidden·Network Error 상태를 구분했다.
- [ ] `textContent`와 위험한 HTML 삽입의 XSS 경계를 재현하고 설명했다.
- [ ] Event Delegation이 동적 Element에서도 동작하는 이유를 설명했다.
- [ ] Response Race를 재현하고 `AbortController` 적용 전후를 비교했다.
- [x] `requestAnimationFrame`·Performance Marker 관찰을 기록했다.
- [ ] Browser Network Panel 관찰을 기록했다.
- [ ] Pure Unit·DOM Integration·Browser E2E의 증명 범위를 구분했다.
- [ ] Coverage 수치와 결함 검출의 차이, ESLint와 Test의 발견 범위를 설명했다.
- [ ] 실제 Browser E2E를 실행했거나 Gate 실패와 `NOT_RUN`을 기록했다.
- [ ] 기존 Java Test와 선택한 JavaScript Test 결과를 남겼다.
- [ ] AI 도움 없이 작은 JavaScript 변경과 관련 Test를 수행했다.
- [ ] Secret·개인정보·내부 URL과 로컬 절대 경로가 공개 자료에 없다.
- [ ] Week 5 WIL에 완료·부분 완료·미수행 범위를 기록했다.

## 계획 변경 기록

Baseline 이후 학습 항목을 조용히 추가하거나 삭제하지 않는다.

| 날짜 | 변경 전 | 변경 후 | 이유 | 영향 | 근거 |
|---|---|---|---|---|---|
| 2026-09-14 | Roadmap의 목록·상세·등록 UI와 E2E 전체 후보 | 기존 단건 조회 중심의 상태 UI, E2E는 인증·데이터 Gate 뒤 한 경로 | 현재 목록 API·Runtime 사용자가 없고 제품 기능보다 Browser 원리와 Test 경계를 우선 | Gate 미통과 시 Week 5는 `Partially Completed` | Source·환경 Baseline |
| 2026-09-14 | 9월 15일에 지연 회상과 Event Loop 첫 Spike | 배경 학습·기본 예상·첫 관찰을 14일로 이동, 15일은 야간 90분 재현으로 축소 | 사용자가 15일에는 야간만 가능하다고 알림 | Promise·Fetch 이후 일정은 유지하고 15일 Scope 증가 방지 | 사용자 일정 |
| 2026-09-15 | 14일에 Event Loop 입문·예상·첫 실행 완료 | 지연 회상만 완료, Event Loop는 교정 중, Browser·Node 실행 `NOT_RUN` | 날짜가 바뀌기 전에 14일 계획을 마치지 못함 | 15일 90분은 이월 Must 우선, 원래 중첩·Blocking은 16일로 이동 | 9월 14일 문답 기록 |
| 2026-09-16 | 15일 야간 이월 학습 뒤 19~20일 마감 | 15일 `NOT_RUN`, 남은 Must를 16~18일 5시간 30분씩 배치, 19~20일 필수 과업 없음 | 개인 일정 지연과 가족 행사 | Should 전체 Deferred, E2E는 Gate 조건 유지 | 사용자 일정 |
| 2026-09-16 | 공지 기반 CORS·XSS·Coverage·정적 분석이 약하고 네 Should가 Deferred인 16시간 30분 압축안 | 선택 키워드와 네 확장 실험을 모두 복원하고 잔여 집중 학습을 20시간으로 확대 | 시간을 더 투입하더라도 선택한 학습 자체를 빼지 말라는 사용자 요청 | 하루 상한을 한시적으로 7시간으로 높이고 제품 기능·UI 장식만 축소 | 사용자 결정·공지 Coverage 재대조 |
| 2026-09-17 | 9월 16일에 Promise·Fetch·CORS·상태 모델까지 수행 | Event Loop·Rendering 비교까지만 실제 완료, Promise는 선행 개념부터 재학습 | 출력 문제를 풀 배경지식이 부족하고 검색 답변의 의미를 이해하지 못함 | 선택 범위는 유지하되 현재 상태를 `Partially Completed`·`NOT_RUN`으로 분리, 수면 뒤 재개 | 9월 16·17일 Study Note |

## 공식 학습 자료 Baseline

- [MDN — JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop)
- [MDN — Using microtasks](https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide)
- [MDN — async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)
- [MDN — Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [MDN — Cross-Origin Resource Sharing](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
- [MDN — Event bubbling](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling)
- [MDN — Critical rendering path](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Critical_rendering_path)
- [MDN — `innerHTML` Security considerations](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML#security_considerations)
- [Node.js 22 — Collecting code coverage](https://nodejs.org/docs/latest-v22.x/api/test.html#collecting-code-coverage)
- [ESLint — Getting Started](https://eslint.org/docs/latest/use/getting-started)
- [Playwright — Web server](https://playwright.dev/docs/test-webserver)

## 관련 기준

- [심화과정 12주 학습 계획](../plan/advanced-track-12-week-plan.md)
- [주차별 Roadmap](../plan/weekly-roadmap.md)
- [학습 및 기술 콘텐츠 계획](../plan/learning-and-content-plan.md)
- [Week 4 WIL](../week4/wil.md)
