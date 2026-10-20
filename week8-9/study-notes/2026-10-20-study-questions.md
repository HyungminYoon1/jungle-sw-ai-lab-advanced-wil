# 10월 20일 검사 실패와 배포 준비

> 상태: 학습 진행 중. 첫 로컬 통합 실패 검증을 마쳤으며 Cloud 관측·비용 확인 등은 남아 있다.

## 오늘 이어갈 범위

어제 정상 처리 뒤 자식 Process가 남지 않는 것을 확인했다. 오늘은 전체 App에서 Timeout·비정상 종료가 발생해도 자원을 정리하고, 접수 원문과 예약을 유지하며 외부 전송을 막는지부터 확인한다. 개인정보 탐지 모델·인물 관계 V2 고도화는 후속으로 유지한다.

## 설명한 개념

Timeout은 기다림의 한도가 끝났다는 뜻이지 Process가 이미 종료됐다는 뜻이 아니다. 현재 Transport는 직접 시작한 Process의 실제 종료·Pipe·보조 Thread 회수까지 확인한다.

JSON 문법이 올바른 것과 검사 실행의 성공도 다르다. 정상 JSON을 출력했더라도 종료하지 않거나 현재 계약의 정상 종료 코드 0을 만족하지 못하면 결과를 사용하지 않는다. 검사 실패가 별도 Transaction으로 접수한 Ticket·Message까지 취소하는 것은 아니다.

개념과 추가 복습 질문은 [합성 실행 학습자료](../study-docs/synthetic-deployment-and-runtime-configuration.md)에 보완했다. 아래 질문의 독립 답변은 아직 확인하지 않았다.

## 실제 실행으로 확인한 것

운영 코드 대신 Test 도구에 세 Mode를 추가했다. 같은 Main Image·0.25 CPU·512 MiB에서 정상 3건의 성공과 범위 밖 1건의 실패를 재확인했다. 별도 두 구성은 정상 JSON 뒤 대기·Exit Code 7을 각각 만들어 Timeout·비정상 종료의 최종 실패, HTTP·제안 0건과 원문·예약 보존을 확인했다. 세 실행 모두 검사 Process·개인정보 I/O Thread가 남지 않았고 OOM도 없었다.

최고 메모리는 정상 300.26 MiB·Timeout 460.54 MiB·비정상 종료 265.88 MiB였다. Timeout 구성은 처리 전부터 사용량이 높았으므로 차이를 Timeout 하나의 효과나 누수로 단정하지 않는다. 실제 모델이 없는 제한 실험의 값이며 Cloud 사양을 새로 확정하지 않았다.

관련 Java 129개·JavaScript 전체 279개가 통과했다. [실행 보고서](../lab-reports/2026-10-20-synthetic-runtime-failure-cleanup.md)에 조건·DB 결과·자원·회귀 범위를 정리했다. Provider 응답은 통제된 로컬 HTTP이며 실제 AI·AWS·Browser 결과가 아니다.

## 이어갈 배포 학습

- 현재 AWS 실행 상태·실제 비용·저장/보관량을 확인하고 새 Code의 CI·ECR 전달·Cloud Log 검증으로 이어간다. Push·리소스 변경은 승인한 실행 범위를 확인한다.
- 합성 입력의 Cloud 실제 AI는 당일 입력·호출/비용·Secret 참조·Task 명세를 별도로 확인한다. 기존 PENDING의 기한·예약은 초기화하지 않는다.
- 기존 Cloudflare DNS를 유지한 Route 53 비교, 최종 회귀·직접 설명·설정 수정·WIL과 보관 정리를 남은 순서로 유지한다.

## 이해 확인 질문

1. 정상 JSON을 출력한 검사기가 7로 종료했다면 그 결과로 외부 AI 요청을 보내도 되는가? 왜 그런가?
2. 로컬 실험의 통과가 AWS에서 실행 중인 기존 Task의 코드를 바꾸는가? 새 Code의 Cloud 검증 전에 무엇을 전달하고 교체해야 하는가?
