# 주차별 산출물 Template 안내

이 폴더는 week1부터 week12까지 공개할 학습·구현 산출물의 기본 양식을 제공한다. 각 문서는 진행 상황을 나열하는 데 그치지 않고, 문제·판단·검증·한계를 일반 독자가 재현 가능한 형태로 전달하는 것을 목표로 한다.

## 기본 사용 방법

1. 주차를 시작할 때 week-readme.md를 해당 weekN 폴더의 README.md로 복사한다.
2. weekly-plan.md를 해당 weekN 폴더에 같은 이름으로 복사하고 주간 Baseline 계획을 확정한다.
3. 매주 implementation-report.md, learning-note.md와 wil.md를 작성한다.
4. 중요한 선택이나 비교 실험이 있으면 decision-log.md와 experiment-report.md를 복사해 주제에 맞게 이름을 바꾼다.
5. 기술 블로그로 발전시킬 주제는 technical-blog.md를 사용한다.
6. 9~12주차에는 employment-summary.md로 공개 가능한 취업 활동을 집계한다.
7. 게시하거나 Commit하기 전에 public-release-checklist.md를 확인한다.
8. 작성 안내용 Placeholder와 사용하지 않는 Section은 공개 전에 정리한다.

과정 안내는 WIL 작성 시간 자체를 정하지 않고 매주 월요일에 해당 주의 블로그 URL을 제출하도록 요구한다. 이 저장소에서는 주차 종료일까지 WIL 본문을 작성하고 다음 월요일에 게시·제출하는 운영 기준을 사용한다. 실제 작성 완료일과 게시·제출일은 WIL에 각각 기록한다.

## 필수·선택 산출물

| 양식 | 사용 빈도 | 복사 후 권장 이름 | 목적 |
|---|---|---|---|
| week-readme.md | 매주 필수 | README.md | 해당 주차의 요약, 상태와 공개 산출물 Index |
| weekly-plan.md | 매주 필수 | weekly-plan.md | 제품·학습·구현·기술 콘텐츠 계획과 변경 이력 |
| implementation-report.md | 매주 필수 | implementation-report.md | 제품 구현과 검증 결과 |
| learning-note.md | 매주 한 개 이상 | learning-주제.md | 핵심 개념과 제품 적용 과정 |
| wil.md | 매주 필수 | wil.md | 한 주의 문제, 판단, 실패와 다음 계획 |
| public-release-checklist.md | 매주 필수 | public-release-checklist.md | 공개 전 보안·품질 검토 |
| decision-log.md | 중요한 결정마다 | decisions/ADR-NNN-주제.md | 선택지, 결정, 이유와 영향 |
| experiment-report.md | 비교·성능·장애 실험마다 | experiments/EXP-NNN-주제.md | 재현 가능한 가설과 결과 |
| technical-blog.md | 검증된 주제가 있을 때 | blog/주제.md | 공개 장문 기술 글 초안 |
| employment-summary.md | 9~12주차 | employment-summary.md | 개인정보를 제외한 취업 활동 요약 |

## 권장 주차 폴더 구조

weekN 폴더는 다음 구조를 기준으로 필요한 항목만 추가한다.

    weekN/
    ├── README.md
    ├── weekly-plan.md
    ├── implementation-report.md
    ├── learning-주제.md
    ├── wil.md
    ├── public-release-checklist.md
    ├── decisions/
    ├── experiments/
    ├── blog/
    └── assets/

빈 폴더나 빈 문서를 형식적으로 만들지 않는다. 실제 산출물이 생길 때 추가한다.

## 문서별 책임

- README는 해당 주차의 빠른 진입점, 결과 요약과 산출물 링크만 제공한다.
- Weekly Plan은 주초에 제품·학습·구현 계획을 Baseline으로 확정하고 이후 변경 이유를 기록한다.
- Implementation Report는 무엇을 만들었고 어떻게 검증했는지 설명한다.
- Learning Note는 개념을 이해하고 적용한 과정을 다룬다.
- Decision Log는 왜 해당 선택을 했는지 보존한다.
- Experiment Report는 주장을 뒷받침하는 재현 가능한 증거를 남긴다.
- WIL은 모든 내용을 반복하지 않고 한 주의 변화와 학습을 요약한다.
- Technical Blog는 다른 개발자가 재사용할 수 있는 문제 해결 지식으로 재구성한다.

## 계획과 결과의 분리

- Weekly Plan은 주차 시작 전에 작성하고 Baseline 확정 이후 조용히 덮어쓰지 않는다.
- 계획이 바뀌면 날짜, 이유, Product Gate 영향과 이동한 Release를 변경 기록에 남긴다.
- Implementation Report는 실제 구현·Test·운영 결과만 기록한다.
- WIL은 계획 대비 차이, 학습한 내용, 실패와 다음 주 판단을 다룬다.
- README는 위 문서들을 반복하지 않고 현재 상태와 Link를 제공한다.

## 공개 작성 기준

- 문서는 사용자와 AI 사이의 대화 맥락 없이 독립적으로 이해되어야 한다.
- 로컬 절대 경로, Secret, Credential, Token, 개인정보와 비공개 URL을 포함하지 않는다.
- 구현하지 않은 기능을 완료로 표현하지 않는다.
- 측정하지 않은 성능, 비용과 생산성 개선을 단정하지 않는다.
- Code, Test, Dataset, Diagram, Query Plan, Metric 또는 Trace를 근거로 연결한다.
- 사전 자동화 Prototype과 해당 주차에 직접 구현·검증한 결과를 구분한다.
- 외부 자료와 코드의 출처, License와 Version을 확인한다.
- Markdown Link는 Repository-relative 경로를 우선한다.

## Placeholder 규칙

양식의 꺾쇠 Placeholder는 실제 내용으로 교체한다.

- 예: <주차>, <기간>, <기능명>, <근거 Link>
- 확인되지 않은 내용은 추정으로 채우지 않고 미확정 상태와 확인 방법을 적는다.
- 적용되지 않는 Section은 “해당 없음”을 남발하지 말고 삭제한다.
