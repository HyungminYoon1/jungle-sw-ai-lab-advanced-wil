# 개인정보 탐지 범위의 검증과 치환

실행일: 2026-10-09

## 구현

검사기가 반환한 위치·종류를 적용하는 `AiInputSpanMasker`를 별도 클래스로 만들었다. 입력은 원문의 제목·본문과 탐지 위치 목록이다. 각 위치는 Unicode Code Point 기준으로 0부터 시작하며 끝은 포함하지 않는다. Java 문자열을 자를 때는 원문에서 시작과 끝을 UTF-16 인덱스로 변환한다.

같은 필드·같은 위치·같은 종류의 중복은 한 번 치환한다. 서로 다른 범위의 겹침·포함 관계나 같은 범위의 종류 충돌은 `PRIVACY_SCAN_INVALID_RESULT`로 거부한다. 인접한 범위는 허용하며, 제목과 본문의 위치는 독립적으로 검증한다. 두 필드 모두 검증을 마친 뒤 원문의 구간과 종류별 자리표시자를 이어 붙인다.

기존 `AiInputPrivacyGuard`와 Worker는 변경하지 않았다. 새 치환기는 Spring Bean이나 Worker에 연결하지 않았으며 외부 요청·DB 접근을 하지 않는다.

Lab의 관련 파일:

- `src/main/java/lab/helpdesk/ai/input/AiInputSpanMasker.java`
- `src/test/java/lab/helpdesk/ai/input/AiInputSpanMaskerTest.java`

## Test 결과

합성 문자열과 탐지 위치 목록으로 다음을 확인했다.

| 검증 대상 | 확인한 동작 |
|---|---|
| 원문과 나머지 내용 | 원문 String과 입력 목록 유지, 로그인 복구 사실·공백·줄바꿈 보존 |
| 종류별 치환 | 확인된 종류의 자리표시자 사용, 미상 종류는 일반 자리표시자 사용 |
| 중복과 필드 | 값이 같은 별도 위치 객체도 중복 제거, 제목·본문의 같은 숫자 위치는 각각 치환 |
| 충돌과 경계 | 부분 겹침·포함·종류 충돌 거부, 인접 범위 허용, 누락·음수·역전·범위 초과 거부 |
| 위치 변환 | 이모지 앞뒤와 전체 범위에서 두 경계 변환, 여러 치환에서도 원문 위치 유지 |
| 실패와 출력 | 잘못된 항목을 버리고 부분 결과를 반환하지 않음, 고정 예외에 원문·Cause 없음, 결과 `toString()`에 내용 없음 |

새 Test는 47개, 기존 개인정보 Guard Test는 32개로 총 79개가 통과했다. 실패·오류·건너뜀은 모두 0이다. 재실행 명령은 Lab 저장소 기준이다.

```powershell
.\mvnw.cmd -B -ntp "-Dtest=AiInputSpanMaskerTest,AiInputPrivacyGuardTest" test
```

## 다음 연결

이 Test의 입력은 이미 주어진 탐지 위치다. 개인정보를 실제로 찾아내는 모델의 정확도·처리시간은 별도로 평가한다. 빈 목록을 적용하는 Test도 Timeout을 정상 검사 완료로 바꾸어도 된다는 뜻은 아니다.

Worker 연결에서는 검사 결과 JSON 검증, 검사 실패 코드의 DB 저장, 현재 Attempt 보호, 원문 보존·전송 0회·자동 재시도 차단을 함께 확인한다. 이번 실행은 범위 치환과 기존 Guard의 Unit Test이며 PostgreSQL·Browser·실제 AI·전체 회귀 실행은 포함하지 않는다.

- [개인정보 탐지와 마스킹](../study-docs/privacy-detection-and-minimal-masking.md)
