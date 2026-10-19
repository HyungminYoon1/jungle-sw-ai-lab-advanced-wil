# ADR 0010 고정 합성 입력의 최소 배포 구성

> 상태: Accepted — 로컬 구현. Cloud 활성화는 별도 승인
> 결정일: 2026-10-19
> 상위 기준: [배포 검증과 개인정보 고도화 분리](./0009-deployment-first-and-deferred-privacy-enhancement.md)

## Context

Linux Process 실행 검증을 마쳤지만 Main에 사용할 개인정보 Preparer 조립은 없었다. 실제 모델 후보는 채택하지 않았고 V2도 후속 과업이다. 배포 검증을 이어가면서 임의 문의를 빈 정상 검사로 통과시키지 않는 최소 구성이 필요했다.

## 검토한 선택지

- 일반 탐지 모델을 채택할 때까지 모든 배포 검증 보류: 독립적인 실행 설정·관측·자원 학습까지 지연된다.
- 전체 입력에 통제된 빈 검사 응답 제공: 일반 문의가 보호된 것처럼 외부로 나갈 수 있어 제외한다.
- 고정 합성 입력 한 건만 허용하는 별도 구성: 실행 경로를 확인하되 일반 개인정보 탐지와 구분할 수 있다.

## Decision

세 번째 안을 사용한다. `postgres,deployment,synthetic-ai` Profile과 `helpdesk.ai.synthetic-scan.enabled=true`를 모두 요구한다. Provider·Worker의 기존 스위치와 Secret 요구사항은 별개로 유지하며 자동 활성화하지 않는다.

제목·본문 전체가 Source의 고정 합성 Case와 정확히 일치해야 한다. 정규화·공백 보정·부분 일치·요청이 고른 허용 목록은 쓰지 않는다. 범위 밖 입력은 자식 Process 실행 전에 거부하고, 자식도 같은 제한을 다시 확인한다. 본문을 임의로 축약하거나 접수 원문을 바꾸지 않는다.

자식은 검토한 현재 Boot JAR 안의 전용 Java Main이다. Spring App을 다시 시작하지 않고, 고정 합성 이메일 위치 한 건만 V1 JSON으로 반환한다. 모델·추가 Python 환경·범용 Shell 명령은 넣지 않는다. 기존 Transport의 stdin·응답/오류 읽기 상한·환경 변수 비복사·종료/회수를 사용하고 V1 검증·치환·Known Fragment Guard·최종 전송 Body 검사를 유지한다.

JAR 절대 경로·검사 시간·회수 시간을 필수 설정으로 요구한다. 잘못된 값은 원문이나 Cause 없는 고정 기동 오류로 거부한다. JAR의 필수 Class 존재 검사는 Artifact 서명·전체 무결성 확인이 아니며, 배포할 Image의 검증 이력·Digest 대조도 필요하다.

허용 범위 밖 입력은 기존 Processor의 `ADAPTER_CONFIGURATION_ERROR`를 사용한다. 이는 해당 실험 구성의 처리 범위를 벗어났다는 뜻이며 검사 JSON 오류나 Timeout으로 바꾸지 않는다. 새 실패 Enum·DB Migration은 추가하지 않는다. 명확한 일반 입력 분류가 필요해지면 별도 계약으로 검토한다.

접수 Commit 뒤 Claim 예약이 먼저 끝나므로 외부 호출이 0회여도 Attempt·예약 1회가 남을 수 있다. 이를 0으로 되돌리거나 Ticket·Message를 취소하지 않는다. Job 최종 실패 뒤 반복 Polling으로 자동 재호출하지 않는다. Cloud 활성화 전에는 기존 PENDING 입력을 먼저 확인하고 처리 범위를 별도로 승인받는다.

## Rationale

일반 모델 정확도 고도화를 추가하지 않고도 설정·자식 실행·출력 검증·HTTP·DB 연결을 확인할 수 있다. 합성 Case에서의 성공을 실제 고객 데이터의 보호 완료로 확대하지 않으며, 기본 실행의 AI 비활성을 유지한다.

## Affected Files

- Lab: `ai/input/synthetic/`의 입력 제한·자식 Main·조건부 Bean, 해당 Unit Test·패키징 후 PostgreSQL IT, Maven Failsafe 설정·README
- WIL: 통합 주간 계획·학습노트·합성 배포 개념 자료·실행 보고서·이 결정 기록
- Controller·업무 Service·Job 정책·기존 V1/V2·DB Schema·AWS/IAM/DNS/Secret은 변경하지 않음

## Follow-up Review

`test`의 Unit 검증과 패키징 뒤 `verify`의 실제 자식 JAR·Spring 개인정보 Bean·수동 Worker Tick·PostgreSQL·Loopback HTTP를 구분한다. 자동 Scheduler·Provider Bean을 포함한 전체 실행, CPU/메모리 Peak, 새 Image의 Linux 실행·CI·ECR·Cloud·실제 AI는 별도 확인한다. `-Xmx64m`으로 App 전체 메모리를 판단하지 않는다.

V2와 일반 모델 정확도 고도화는 계속 후속으로 남긴다. 기존 호출 한도·기한·실행권·원문 보존·최소 비용·별도 Cloud 승인 원칙도 유지한다.

## 로컬 자원 검증 구성

실제 유료 AI·새 Main URL 설정 대신 Test 전용 Factory의 기존 Loopback 생성자를 사용한다. 같은 Spring AI Adapter를 제공하되 일반 Provider Configuration과 실제 Key는 사용하지 않는다. 자동 Worker·V1 Preparer·자식 프로그램·업무 계층은 Image의 Main JAR를 그대로 실행한다. Test Launcher와 Bridge만 별도로 Mount해 Main 코드나 배포용 기본 구성을 변경하지 않는다.

실행마다 새 Project·새 PostgreSQL·합성 Secret 파일을 사용한다. App과 DB는 외부 경로 없는 내부 Network 한 개에만 연결하고 Host Port는 공개하지 않는다. 실행 전에 Network·CPU/Memory 제한·실험 소유권을 검증한다. 끝난 뒤 해당 Project의 Container·Network와 합성 Secret 파일만 제거하고 DB Volume·Image는 보존한다. 이 선택은 원문이나 기존 사용자의 데이터를 정리하는 절차가 아니다.

Service 직접 접수의 합성 작성자 보존과 자동 Scheduler·로컬 HTTP·자원 검증을 확인한다. Browser 인증 작성자 선택·실제 AI·RDS TLS·일반 개인정보 모델 품질은 각자의 검증 범위로 유지한다. 자원 결과는 App cgroup 기준이며 별도 PostgreSQL Container의 메모리를 포함하지 않는다.
