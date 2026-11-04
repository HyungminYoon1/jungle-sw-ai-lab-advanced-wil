# 상태 변경은 무엇을 함께 저장하는가

> 기준: 2026-11-04 T05 설명 보충
> 상태: T05는 설명/문답 뒤 2026-11-04 합의. 아래 값은 저장 계약을 설명하는 가상 예시이며 실제 실행/구현 결과와 구분
> 관련 정책: [T05/T06](../../week11/customer-followup-policy-review.md#4-상태-변경-api-전에-정할-정책), [실제 문답](../study-notes/2026-11-04-study-questions.md)

## 1 먼저 무엇을 저장하는가

상태 변경에는 현재 상태와 변경 이력이라는 두 정보가 있다.

| 저장 대상 | 역할 | 이번 예시 |
|---|---|---|
| 기존 Ticket Row의 현재 상태/상태 버전 | 지금 이 문의가 어디까지 처리됐는지 조회 | IN_PROGRESS/3을 RESOLVED/4로 수정 |
| 별도 상태 변경 이력 Row | 누가 무엇을 근거로 어떤 상태를 변경했는지 기록 | 담당자 A의 해결 처리 한 건 추가 |

문의 42는 이미 접수돼 Commit된 상태다. 담당자는 A, 배정 버전은 2라고 가정한다. 관련 공식 답변 82번도 이미 별도로 Commit됐다. 고객 글은 70번까지 있고 A가 그 범위를 명시적으로 확인했으며, 더 최신 글은 없다고 가정한다.

새 요청의 UUID는 설명용으로 K라고 부른다. 실제 요청에는 유효한 UUID가 필요하다. 이 설명에서 상태 버전 3을 썼다고 해서 실제 DB에 그 필드/값이 이미 있다는 뜻은 아니다. 상태 API, 상태 버전 필드와 상태 변경 이력 테이블은 아직 구현하지 않았다.

## 2 Service에서 처리하는 순서

Browser는 문의 42의 해결 요청과 자신이 본 배정 버전 2/상태 버전 3, 선택한 고객 범위 70, 관련 답변과 사유, UUID K를 보낸다고 가정한다. 작성자 신원은 기존 원칙대로 서버의 인증 정보에서 정한다.

Service의 하나의 DB Transaction에서 다음 순서로 처리하는 안이다.

1. Ticket Row를 잠그고 현재 자료를 읽는다. 요청자의 조회 권한을 확인한다.
2. 같은 Ticket/작성자/UUID의 저장된 제출이 있으면 내용을 비교한다. 같은 제출이면 기존 결과를 반환하고, 다른 내용이면 충돌로 거부한다.
3. 새 제출이면 현재 담당자/서비스 권한, 배정 버전, 상태 버전, 허용 전이, 관련 답변과 고객 확인 범위를 검사한다. 새 고객 글이 먼저 Commit됐다면 T06에 따라 오래된 해결 요청을 거부한다.
4. Ticket의 상태를 RESOLVED, 상태 버전을 4로 UPDATE한다.
5. 상태 변경 이력을 INSERT한다. 이력에는 이전/이후 상태, 결과 버전, 인증된 Actor, 사유, 관련 공식 답변과 확인 범위, UUID 및 서버 시각을 남기는 안이다.
6. 두 쓰기를 함께 Commit한다. Transaction 경계를 정상적으로 마친 뒤 Controller가 저장 성공 응답을 만든다.

예시에서는 UPDATE 다음 INSERT로 설명했다. 두 작업은 같은 Transaction에 포함되며 이력만 별도로 Commit하지 않는다. Controller에서 DB를 직접 수정하거나 외부 AI 요청을 이 Transaction 안에 넣지 않는다.

## 3 성공하면 남는 결과

| 항목 | 처리 전 | Commit 후 |
|---|---|---|
| 현재 담당자 | A | A |
| 배정 버전 | 2 | 2 |
| 현재 상태 | IN_PROGRESS | RESOLVED |
| 상태 버전 | 3 | 4 |
| UUID K의 상태 변경 이력 | 없음 | 1건 |
| 기존 문의 원문/공식 답변 | 이미 저장됨 | 그대로 유지 |

상태 변경 이력에는 이번 변경이 IN_PROGRESS/3에서 RESOLVED/4로 진행됐다는 근거를 남긴다. 이후 재개돼 현재 상태가 달라져도 이 이력을 현재 상태로 덮어쓰지 않는다.

## 4 중간에 실패하면

Ticket UPDATE가 성공한 뒤 이력 INSERT가 실패해 Rollback됐다고 가정한다. 이때 최종 상태는 다음과 같다.

- 현재 상태는 IN_PROGRESS, 상태 버전은 3이다.
- UUID K의 상태 변경 이력은 0건이다.
- 이미 Commit된 Ticket 자체와 문의 원문, 공식 답변은 남는다.

UPDATE 한 문장의 성공은 전체 변경의 Commit 성공과 다르다. 상태 변경 이력은 Commit된 변경을 기록하는 자료이며, 실패 원인의 진단 Log와도 구분한다. 실패 진단의 보관/공개 범위는 별도 운영 정책이다.

Commit 결과를 받기 전에 DB 연결이 끊긴 경우에는 위처럼 Rollback을 확인한 것으로 단정하지 않는다. 원래 UUID와 요청 내용을 유지해 저장 여부를 확인해야 한다.

## 5 상태 버전과 배정 버전이 다른 이유

배정 버전은 책임 담당자의 변경을 구분한다. 상태 버전은 처리 상태의 변경을 구분한다. A가 계속 담당하는 동안 해결 후 재개되면 상태 버전은 4에서 5로 증가하고 배정 버전은 2를 유지하는 안이다.

예를 들어 IN_PROGRESS/3 → RESOLVED/4 → OPEN/5 → IN_PROGRESS/6으로 돌아왔어도 담당자가 A라면 배정 버전은 그대로일 수 있다. 상태 문자열이 같아졌다는 이유로 버전 3의 오래된 해결 요청을 현재 버전 6의 요청으로 받아들이지 않는다.

## 6 응답을 잃었다면

두 쓰기의 Commit은 끝났는데 Browser가 응답을 받지 못할 수 있다. UUID K와 원래 내용을 재전송했을 때 이미 같은 기록이 있으면 추가 이력이나 버전 증가 없이 기존 결과를 돌려주는 안이다. 처음 요청이 저장되지 않았다면 현재 조건을 다시 검사해 첫 저장을 할 수 있는지는 별도로 판단한다.

과거 K가 저장한 결과 버전이 4이고 현재는 다른 변경으로 6이라면 과거 이력 4와 현재 상태 6을 나누어 설명한다. 재확인했다고 현재 상태를 4로 되돌리지 않는다. 현재 조회 권한의 검사는 기존 결과 조회에도 필요하다.

## 7 기존 코드에서 볼 수 있는 같은 구조

Lab의 TicketAssignmentService는 public claim/transfer에 @Transactional을 적용하고, 내부 change에서 기존 제출/권한/버전을 검사한 뒤 repository.change와 repository.append를 호출한다. 현재 배정 갱신과 배정 이력을 함께 저장하는 기존 구조다. 이번 설명에서는 그 구조를 상태 변경에 적용하는 안을 제시했으며 새 상태 Service를 구현한 것은 아니다.

Service 메서드 본문의 return만으로 Commit 성공을 판정하지 않는다. Spring의 트랜잭션 처리가 적용되는 호출 경로와 예외의 Rollback 규칙도 확인해야 한다. Annotation을 붙였다는 사실만으로 실제 Commit/Rollback 검증을 대체하지 않는다. [Spring 트랜잭션 경계](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/tx-decl-explained.html), [@Transactional](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html), [Rollback 규칙](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html)

상태 변경의 정확한 필드, 오류/응답 형태와 재확인 순서는 T05 및 남은 정책을 검토한 뒤 기술 계약으로 정하고, 구현 후 실제 PostgreSQL에서 성공/실패/응답 유실을 확인한다.
