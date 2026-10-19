# 인물 관계 V2 구조 검증과 관계 보존 치환

> 실행일: 2026-10-19 KST
> Lab Commit: 구조 검증 `ca37e69`, 독립 치환 `e617823`
> 결과: V2 구조 172개·치환 37개, 기존 7개 Class를 포함한 핵심 439개 통과

## 구현한 경계

`AiPrivacyScanResultV2Validator`는 기존 V1을 수정하지 않고 Version 2의 위치·등장 번호·관계표를 검증한다. 같은 사람의 반복 등장에도 위치 번호를 따로 부여하고 SAME 관계로 연결한다. 같은 이름이라는 사실만으로 동일인을 추론하거나 문의 사이에 신원을 연결하지 않는다.

명시적인 UNDETERMINED는 보존하며, 빠진 관계를 채우거나 완료하지 않은 결과를 판단 보류로 바꾸지 않는다. 잘못된 위치·중복/겹침·필드·참조·Version·관계 모순은 결과 전체를 거부한다. 응답 UTF-8 Byte·원시 항목·관계 개수를 제한하고 실제 전체 쌍 개수를 확인한다.

동일인 집합을 만든 뒤 같은 집합 안의 관계와 집합 사이의 판정이 일관되는지 확인한다. 관계 값은 수정하지 않는다. DIFFERENT는 추이적으로 확장하지 않아 A≠B·B≠C·A와 C는 미확인이라는 결과도 그대로 보존한다.

반환값은 불변 메타데이터다. 원문·JSON은 보관하지 않고 결과·항목의 문자열 표현도 내용을 숨긴다. Parser 원문·Cause를 유지하지 않는 기존 고정 오류를 사용한다.

## 독립 치환기의 동작

`AiPrivacyScanResultV2Masker.validateAndMask()`는 같은 제목·본문으로 V2 검증과 치환을 진행한다. 분리된 `ValidatedScan`을 다른 원문과 결합하는 API는 두지 않는다. Scanner 입력·응답의 대응을 유지하는 후속 Preparer 연결까지 대신 검증한 것은 아니다.

SAME 집합은 첫 등장 순서의 `[PERSON_1]` 같은 표시를 공유한다. 집합 사이의 DIFFERENT·UNDETERMINED는 생성 표시를 참조하는 불변 목록으로 반환한다. 다른 번호만으로 다른 사람이라고 추론하지 않는다. 실명 역변환 목록·원본 위치·Scanner의 등장 번호는 반환하지 않는다.

원문에 예약 접두사 `[PERSON_`가 있으면 전체 결과를 거부한다. 치환 후 제목·본문의 UTF-8 Byte 합계도 제한하며 전체 HTTP Body 상한과 구분한다. 원문의 공백·이모지·호칭·업무 사실은 검증한 범위 밖에서 그대로 유지한다. 결과의 문자열 표현은 내용을 숨긴다.

새 Test는 같은 이름의 세 관계·다른 표기의 SAME·두 SAME 집합의 명시적 관계·12개 집합의 숫자 순서, Code Point·인접/중복 범위·호출 간 독립성, 예약 표시 충돌·치환 후 정확한 Byte 경계·불변 목록을 확인했다. 원문의 동명이인을 잘못된 SAME으로 보고한 응답도 구조가 일관되면 그 판단대로 치환되므로, 모델 내용 평가가 필요하다는 경계를 유지한다.

## Test 결과

| Class | 실행 수 | 확인 범위 |
|---|---:|---|
| AiPrivacyScanResultV2ValidatorTest | 172 | 새 V2의 구조·범위·관계표·상한·V1/V2 구분 |
| AiPrivacyScanResultV2MaskerTest | 37 | SAME 표시 공유·명시적 미확인·문자 보존·표시 충돌·치환 후 Byte 상한 |
| AiPrivacyScanResultValidatorTest | 85 | 기존 V1 응답과 치환 계약 |
| AiInputSpanMaskerTest | 48 | 기존 위치 치환·Unicode·중복/겹침 |
| AiInputPrivacyGuardTest | 32 | 기존 Known Fragment 처리·전송 Body 검사 |
| AiScannedInputPreparerTest | 13 | 기존 V1 검사→검증→치환→Guard 연결 |
| ProcessAiPrivacyScannerTest | 24 | 실제 Windows 자식 JVM·Pipe·중단/회수 |
| AiPrivacyScanPipelineIntegrationTest | 20 | 기존 V1·실제 PostgreSQL·통제된 Loopback HTTP |
| AiSuggestionWorkerConfigurationTest | 8 | 기존 Worker 조립·필수 구성 거부 |
| 합계 | 439 | 실패·오류·건너뜀 0 |

V2는 세 등장 위치의 관계표 27가지 전체, 두 동일인 집합 간의 일관성, 역방향·중복 쌍, 숫자 순서의 m1~m12, 이모지의 Code Point 위치, 완전 중복과 충돌, 필드/타입·참조·누락·상한을 확인했다. 모든 값은 통제한 합성 입력이다.

원문이 동명이인이라고 명시했는데 Scanner가 일관된 SAME을 보낸 경우도 넣었다. 구조 검증은 이를 통과시킨다. 이는 검증기가 원문을 이해해 판정한 것이 아니라 Scanner가 보고한 구조만 확인한다는 경계를 보여준다. 내용 평가에서는 실패해야 한다.

## 실행 명령과 시각

```powershell
.\mvnw.cmd -B -ntp "-Dtest=AiPrivacyScanResultV2MaskerTest,AiPrivacyScanResultV2ValidatorTest,AiPrivacyScanResultValidatorTest,AiInputSpanMaskerTest,AiInputPrivacyGuardTest,AiScannedInputPreparerTest,ProcessAiPrivacyScannerTest,AiPrivacyScanPipelineIntegrationTest,AiSuggestionWorkerConfigurationTest" test
```

구조 검증 단계는 19:46:20 KST에 29.161초로 402개를 통과했다. 치환기 추가 후 최종 실행은 20:05:36 KST에 35.970초로 끝났다. Surefire XML의 9개 Class·439개와 실패/오류/건너뜀 0을 별도로 확인했으며 Testcontainers 실행 Container도 남아 있지 않았다. 앞선 254개·399개는 네 사람 관계 Case를 추가하기 전 단계다.

Mockito의 동적 Agent 경고와 필수 Bean이 없는 조건의 예상 Context 기동 실패 Log가 있었다. Test는 그 거부 조건을 확인해 통과했으며 운영 App 기동 실패나 실제 AI 요청 실패로 해석하지 않는다.

## 연결하지 않은 경계

새 V2는 Spring Bean·Preparer·Provider·DB 흐름에 연결하지 않았다. 실제 모델·상용 AI·Browser·AWS·배포 Image도 실행하거나 바꾸지 않았다. 위 PostgreSQL 20개는 V1 회귀이지 V2 결과의 DB 저장 검증이 아니다.

이번 실행은 핵심 회귀이며 전체 Java Test를 재실행한 결과는 아니다. 직전 전체 754개는 V2 추가 전 근거로 유지한다. 앞선 모델 후보의 5/12 성적도 이 구조 검증기 때문에 개선됐다고 기록하지 않는다.

다음은 Known Fragment Guard가 새 표시를 바꾸지 않도록 하는 검증과 관계를 보존하는 Provider 입력·전송 직전 Body 검증이다. [V2 계약 초안](../../plan/privacy-person-relations-v2-draft.md)·[구조 검증 결정](../../plan/decisions/0007-person-relation-v2-validation.md)·[치환 결정](../../plan/decisions/0008-person-relation-v2-masking.md)에 검토 범위를 연결한다.
