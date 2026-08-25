# 주차별 학습 산출물 Template 안내

이 디렉터리는 Week 1부터 Week 12까지 공개할 학습 계획, 실험, 설명과 회고의 기본 양식을 제공한다. 모든 Template을 매주 채우는 것이 목표가 아니다. 학습 질문에 답하는 데 필요한 가장 작은 문서만 선택한다.

## 기본 사용 방법

1. 주차 시작 시 `week-readme.md`와 `weekly-plan.md`를 복사해 핵심 질문과 범위를 확정한다.
2. 날짜별 질문, 자신의 답변과 진행 상태는 `study-note.md`에 기록한다.
3. 반복해서 참고할 개념 설명은 `learning-note.md`, 직접 실행한 실습은 `lab-report.md`로 정리한다.
4. 변수 통제가 필요한 비교 실험에만 `experiment-report.md`를 추가한다.
5. 주말에 실제 결과를 근거로 `wil.md`를 작성한다.
6. 공개 전에 `public-release-checklist.md`로 Secret·개인정보·주장과 Link를 확인한다.

Placeholder만 채운 빈 문서는 만들지 않는다. 실제 학습 근거가 생긴 시점에 필요한 문서만 추가한다.

## 필수·선택 산출물

| Template | 사용 시점 | 권장 파일명 | 책임 |
|---|---|---|---|
| week-readme.md | 매주 필수 | README.md | 해당 주의 질문, 상태와 공개 산출물 Index |
| weekly-plan.md | 매주 필수 | weekly-plan.md | 학습 범위, 실험, 일정, Evidence Gate와 변경 기록 |
| lab-report.md | 실습 결과가 있을 때 | lab-주제.md | 질문·예상·절차·관찰·해석과 재현 방법 |
| learning-note.md | 재사용할 개념 설명이 필요할 때 | study-docs/learning-주제.md | 동작 원리, 예, 오해와 사용 경계를 설명하는 학습 자료 |
| study-note.md | 날짜별 학습 기록이 필요할 때 | study-notes/YYYY-MM-DD-study-questions.md | 자신의 질문·답변, 이해 상태, 실행 결과와 다음 학습 |
| wil.md | 매주 필수 | wil.md | 계획 대비 결과, 이해 변화, 실패와 다음 질문 |
| experiment-report.md | 비교·측정 시 선택 | experiment-주제.md | 가설, 변수·통제, 결과와 유효성 한계 |
| decision-log.md | 중요한 선택 시 선택 | decision-NNNN-주제.md | Context, 선택지, 결정, 이유와 재검토 |
| technical-blog.md | 재사용 가능한 글 작성 시 | technical-주제.md | 하나의 문제와 재현 가능한 기술 지식 |
| public-release-checklist.md | 공개 직전 | public-release-checklist.md | Secret·개인정보·정확성·근거 검토 |
| employment-summary.md | Week 9~12 선택 | employment-summary.md | 지원·면접·Coding Test 활동과 학습 Feedback |

매주 필수 본문은 Weekly Plan과 WIL이다. Learning Note, Study Note와 Lab Report는 모두 강제하지 않으며, 실제 학습 근거를 가장 잘 보존하는 형식을 고른다.

## 권장 주차 폴더 구조

    weekN/
    ├── README.md
    ├── weekly-plan.md
    ├── study-docs/
    │   └── learning-<topic>.md
    ├── study-notes/
    │   └── <YYYY-MM-DD>-study-questions.md
    ├── lab-<topic>.md
    ├── experiment-<topic>.md
    ├── wil.md
    └── public-release-checklist.md

실제 산출물이 없는 파일은 생략한다. Screenshot, Log와 Dataset을 공개할 때는 민감 정보와 재현에 필요한 최소 범위를 먼저 점검한다.

## 문서별 선택 기준

### Learning Note

- 특정 날짜의 진도와 분리하여 개념의 목적과 동작을 설명하는 것이 중심이다.
- 정의, 동작 흐름, 최소 예와 대표적인 오해를 공식 자료에 근거해 정리한다.
- 언제 사용하거나 사용하지 않을지 경계를 포함한다.
- 개인의 이해 상태, 실행 여부, AI 활용과 다음 일정은 기록하지 않는다.

### Study Note

- 하루 동안 다룬 질문, 자신의 답변과 이해 변화를 기록한다.
- 실행 전 예상과 실제 관찰, 완료·진행 중·`NOT_RUN` 같은 검증 상태를 구분한다.
- AI가 도운 범위, 직접 확인한 범위와 다음 학습을 기록한다.

### Lab Report

- 직접 실행한 코드, 요청, Query 또는 Process의 관찰이 중심이다.
- 실행 전에 예상 결과와 실패 조건을 기록한다.
- 다른 사람이 같은 결과를 확인할 재현 절차를 포함한다.

### Experiment Report

- 두 접근, 설정 또는 Version을 비교한다.
- 독립·통제 변수와 측정 조건이 결과 해석에 중요하다.
- 성능·품질 개선을 주장할 때 비교 조건과 한계를 남긴다.

### WIL

- 한 주의 작업 목록이 아니라 계획 대비 결과와 이해 변화가 중심이다.
- 실패·부분 완료·제외한 범위를 숨기지 않는다.
- AI가 수행한 일과 직접 판단·수정·검증한 일을 구분한다.

## 계획과 결과의 분리

- Weekly Plan은 주초 Baseline이며 이후 변경은 변경 기록에 추가한다.
- Learning Note는 날짜와 진행 상황에 의존하지 않는 재사용 가능한 개념 자료로 유지한다.
- Study Note는 날짜별 질문, 답변, 이해 상태와 실제 진행 결과를 기록한다.
- Lab Report는 직접 실행한 절차, 관찰과 재현 방법을 기록한다.
- WIL은 주말의 실제 결과를 바탕으로 작성한다.
- 계획했던 항목을 수행하지 않았으면 Weekly Plan 또는 Study Note에서 삭제하지 않고 상태와 이유를 남긴다.
- 다음 주로 이동한 주제는 중요도와 선행 조건을 다시 판단한다.

## 공개 작성 기준

- 일반 독자가 대화 Context 없이 질문, 조건과 결과를 이해할 수 있어야 한다.
- Source Repository를 연결할 때 공개 URL과 Commit·Tag를 사용하고 로컬 경로를 넣지 않는다.
- Secret, Credential, 개인정보, 비공개 대화와 내부 URL을 포함하지 않는다.
- 측정하지 않은 성능·비용·품질 개선을 주장하지 않는다.
- 과정 전 Prototype과 이번 과정에서 직접 학습·검증한 결과를 구분한다.
- AI 생성 결과를 그대로 자신의 이해나 성과로 표현하지 않는다.
- 실패, 반례, 유효성 한계와 사용하지 않을 조건을 기록한다.

## Placeholder 규칙

- `<...>` Placeholder는 실제 값으로 교체한다.
- 해당하지 않는 Section은 이유가 분명하면 삭제할 수 있다.
- 예시 수치와 명령을 실제 결과처럼 남기지 않는다.
- 근거가 준비되지 않은 Link는 만들지 않는다.
