# Learning Note — Git 운영 Baseline

> 작성일: 2026-08-19
> 주차: Week 1
> 기준: Git Reference, Pro Git

## 핵심 질문

> 현재 변경이 Working Tree·Index·Commit 중 어디에 있는지 확인하고, 보존해야 할 작업을 잃지 않으면서 다음 명령을 선택할 수 있는가?

## 운영 Baseline 적용 원칙

Git을 이미 문서와 Source 관리에 계속 사용하고 있다면 기초 명령을 반복 학습하기보다 다음 최소 역량을 짧게 진단하고 실제 작업에서 유지할 수 있다.

1. 변경 위치를 `status`와 두 종류의 `diff`로 확인한다.
2. Commit에 포함할 내용을 의도적으로 선택하고 검토한다.
3. 되돌릴 대상과 보존해야 할 범위를 먼저 판단한다.
4. 공유된 History는 함부로 다시 쓰지 않는다.
5. 설명하거나 수행하지 못한 항목만 작은 보충 Spike로 전환한다.

개념 자료를 읽은 것만으로 Git 운영 역량이 검증되는 것은 아니다. 아래 자가진단을 직접 수행한 결과와 보충이 필요한 항목은 날짜별 Study Note에 기록한다.

## 한 문장 설명

Git의 안전한 사용은 명령을 많이 외우는 것이 아니라 Working Tree·Index·HEAD의 차이를 확인하고, 보존할 변경과 공개된 History의 범위에 맞는 명령을 선택하는 것이다.

## 핵심 상태 모델

```text
Working Tree
    │  git add
    ▼
Index (Staging Area)
    │  git commit
    ▼
HEAD가 가리키는 새 Commit
```

- **Working Tree**: 현재 파일 시스템에서 보고 수정하는 파일 상태다.
- **Index**: 다음 Commit에 넣을 Snapshot을 준비하는 영역이다. 같은 파일도 일부 변경만 Staging할 수 있다.
- **HEAD**: 일반적으로 현재 Branch가 가리키는 Commit을 참조한다.
- **Remote-tracking Branch**: 원격 저장소에서 마지막으로 확인한 상태를 나타내며 Working Tree·Index와는 별도 축이다.

`git add`는 파일 이름만 예약하는 명령이 아니다. 실행한 시점의 파일 내용을 Index에 반영한다. 그 뒤 같은 파일을 다시 수정하면 하나의 파일에 Staged 변경과 Unstaged 변경이 동시에 존재할 수 있다.

## 무엇을 비교하는가

| 명령 | 비교·표시 대상 | 답하는 질문 |
|---|---|---|
| `git status` | HEAD↔Index, Index↔Working Tree와 Untracked 파일 요약 | 어떤 변경이 Staged·Unstaged·Untracked 상태인가? |
| `git diff` | Working Tree↔Index | 아직 Staging하지 않은 변경은 무엇인가? |
| `git diff --staged` | Index↔HEAD | 지금 Commit하면 포함될 변경은 무엇인가? |
| `git log --oneline --graph --decorate` | Commit Graph와 참조 | 현재 Branch와 최근 History는 어떻게 연결되는가? |

Commit 직전에는 `status`만 보고 끝내지 않고 `diff --staged`로 실제 포함 내용을 확인한다.

## 명령 선택과 안전 경계

아래 표는 일반적인 기본 흐름을 기준으로 한다. Option과 저장소 상태에 따라 영향 범위가 달라질 수 있으므로 실행 전 공식 문서와 `status`를 다시 확인한다.

| 상황 | 우선 선택 | 상태 변화 | 안전 경계 |
|---|---|---|---|
| 변경 위치 파악 | `git status`, `git diff`, `git diff --staged` | 없음 | 먼저 읽기 전용 명령으로 현재 상태를 확인한다. |
| 다음 Commit 내용 선택 | `git add <path>` 또는 `git add -p` | Working Tree 내용을 Index에 반영 | Secret·임시 파일과 무관한 변경이 섞이지 않았는지 다시 검토한다. |
| Staging만 취소 | `git restore --staged <path>` | 기본적으로 HEAD 기준으로 Index를 복원 | Working Tree 변경은 남지만 Commit 포함 범위가 바뀐다. |
| 추적 파일의 미Commit 변경 폐기 | `git restore <path>` | 기본적으로 Index 기준으로 Working Tree를 복원 | 저장하지 않은 변경을 덮어쓰므로 폐기 의도가 확실할 때만 사용한다. |
| 공개된 일반 Commit의 효과 취소 | `git revert <commit>` | 반대 변경을 담은 새 Commit 생성 | 기존 History를 보존한다. Merge Commit Revert는 별도 판단이 필요하다. |
| 공개 전 Local History 재구성 | `git reset` 또는 Rebase 계열 | Option에 따라 HEAD·Index·Working Tree가 달라짐 | 영향 범위를 설명할 수 있고 다른 사람이 의존하지 않는 Commit에서만 검토한다. |
| 이동한 Branch Tip 확인 | `git reflog` | 없음 | Local 참조 이동 기록이며 Backup이나 원격 복구 보장은 아니다. |

`git reset --hard`는 운영 Baseline의 일상 복구 명령으로 사용하지 않는다. Working Tree와 Index의 보존되지 않은 변경을 잃을 수 있으므로, 대상과 복구 가능성을 확인하지 않은 상태에서는 실행하지 않는다.

## `restore`·`reset`·`revert` 구분

| 명령 | 주 대상 | 기존 Commit History | 기본 판단 기준 |
|---|---|---|---|
| `restore` | Working Tree 또는 `--staged` 사용 시 Index | 바꾸지 않음 | Commit 전 파일 내용이나 Staging 상태를 되돌릴 때 |
| `reset` | 호출 형태에 따라 Index 또는 HEAD·Index·Working Tree | Branch가 가리키는 위치를 바꿀 수 있음 | 공개되지 않은 Local History를 의도적으로 재구성할 때 |
| `revert` | 지정한 Commit의 변경 효과 | 기존 Commit을 유지하고 새 Commit 추가 | 이미 공유된 변경을 추적 가능하게 취소할 때 |

판단 순서는 다음과 같다.

1. 되돌리려는 대상이 파일 내용, Staging 상태, Commit 중 무엇인지 확인한다.
2. 보존해야 할 Local 변경이 있는지 확인한다.
3. 대상 Commit을 다른 사람이 이미 가져갔는지 확인한다.
4. 읽기 전용 명령으로 예상 영향 범위를 확인한다.
5. 가장 작은 범위에 작용하고 History 정책에 맞는 명령을 선택한다.

## Merge와 Rebase의 최소 경계

- **Merge**는 두 History를 통합하며 기존 Commit의 Identity를 다시 만들지 않는다. 상황에 따라 Fast-forward 또는 Merge Commit이 생길 수 있다.
- **Rebase**는 현재 Branch의 Commit을 새 Base 위에 다시 적용하므로 새 Commit Identity가 만들어진다.
- 다른 사람이 기반으로 삼은 Commit을 Rebase하면 협업자가 중복 Commit과 충돌을 정리해야 할 수 있다.
- 따라서 이 과정에서는 Rebase를 공개되지 않은 개인 작업 Branch의 History 정리에만 우선 검토한다.

Merge·Rebase·Conflict 비교는 상태 확인·Commit 구성·복구 방법을 다루는 최소 운영 Baseline의 필수 실습이 아니다. 실제 협업에서 선택이 필요하거나 아래 진단에서 설명 공백이 확인될 때만 안전한 별도 Repository에서 수행한다.

## 20~30분 자가진단

실제 작업 Repository의 History를 실험 대상으로 사용하지 않는다. 폐기 가능한 별도 Repository나 Branch에서 다음 순서만 확인한다.

### 진단 1 — 상태 읽기

1. 추적 파일을 수정하기 전에 예상 상태를 적는다.
2. 수정 후 `status`와 `diff`를 확인한다.
3. 파일을 Staging하고 `diff --staged`를 확인한다.
4. 같은 파일을 한 번 더 수정해 Staged와 Unstaged 변경이 동시에 존재하는 상태를 설명한다.

### 진단 2 — Commit 범위 만들기

1. 서로 다른 두 의도의 변경을 준비한다.
2. 한 의도만 Staging한다.
3. `diff --staged` 결과를 한 문장으로 설명한다.
4. 하나의 의도로 설명되는 Commit을 만든다.

### 진단 3 — 복구 방법 선택

다음 상황에서 명령을 먼저 실행하지 말고 선택 이유와 보존되는 상태를 설명한다.

- 잘못 Staging했지만 Working Tree 변경은 보존해야 한다.
- 아직 Commit하지 않은 추적 파일 변경을 의도적으로 폐기한다.
- 이미 공유한 일반 Commit의 효과를 취소해야 한다.
- Local Branch Tip을 잘못 옮겨 이전 위치를 찾아야 한다.

## 통과 기준

다음을 모두 직접 수행하고 설명할 수 있으면 최소 운영 Baseline을 충족한 것으로 판단할 수 있다.

- `status`, `diff`, `diff --staged`가 서로 다른 질문에 답한다는 것을 실행 결과로 설명한다.
- 같은 파일의 Staged·Unstaged 변경을 구분한다.
- Commit 전에 포함 범위를 확인하고 의도 하나로 설명되는 Commit을 만든다.
- `restore`, `restore --staged`, `revert`의 보존 범위 차이를 설명한다.
- 공유된 History를 다시 쓰기 전에 멈추고 협업 영향을 판단한다.

한 항목이라도 설명하지 못하면 Git 전체를 다시 학습하지 않는다. 실패한 항목만 30~60분 보충하고 같은 Scenario를 다시 수행한다.

## 설명 가능성 점검

다음 질문에 문서를 보지 않고 답할 수 있어야 한다.

1. `git add` 후 같은 파일을 다시 수정하면 왜 두 종류의 Diff가 생기는가?
2. `git restore --staged`와 `git restore`는 무엇을 보존하는가?
3. 공유된 Commit을 취소할 때 `reset`보다 `revert`를 우선 고려하는 이유는 무엇인가?
4. Rebase 후 Commit ID가 달라지는 이유는 무엇인가?
5. `reflog`를 Backup으로 간주하면 안 되는 이유는 무엇인가?

## 보충 학습 선택 기준

- Baseline 진단을 통과하면 별도 Git 학습 일정을 추가하지 않는다.
- Staging·복구 판단에서 막히면 해당 상태만 작은 Scenario로 다시 확인한다.
- Merge·Rebase·Conflict는 실제 협업 필요나 설명 공백이 생길 때 조건부로 보충한다.
- PR Review와 CI 근거는 Source Repository가 준비된 뒤 실제 Workflow에서 누적한다.

## 자료 범위

이 자료는 Git의 상태 모델, 변경 확인, Commit 구성과 복구 명령의 선택 기준을 다룬다. 특정 날짜의 자가진단 상태, 실제 명령 결과, AI 활용과 다음 일정은 Weekly Plan, Study Note 또는 WIL에 기록한다.

## 참고 자료

- [Git `status` 공식 문서](https://git-scm.com/docs/git-status)
- [Git `diff` 공식 문서](https://git-scm.com/docs/git-diff)
- [Git `add` 공식 문서](https://git-scm.com/docs/git-add)
- [Git `restore` 공식 문서](https://git-scm.com/docs/git-restore)
- [Git `reset` 공식 문서](https://git-scm.com/docs/git-reset)
- [Git `revert` 공식 문서](https://git-scm.com/docs/git-revert)
- [Git `merge` 공식 문서](https://git-scm.com/docs/git-merge)
- [Git `rebase` 공식 문서](https://git-scm.com/docs/git-rebase)
- [Git `reflog` 공식 문서](https://git-scm.com/docs/git-reflog)
- [Pro Git — Rebasing](https://git-scm.com/book/en/v2/Git-Branching-Rebasing)
