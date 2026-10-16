# PERSON 마스킹 계약과 실제 한국어 NER 평가

> 실행일: 2026-10-15
> 결과: PERSON 치환 구현·Test 통과. 실제 모델은 고정 합성 사례 12건 중 7건만 통과해 배포용 채택 보류
> 범위: 로컬 CPU 모델 실험. App·PostgreSQL·Browser·Cloud·유료 AI 호출과 연결하지 않음

## 이번에 결정한 것

### 사람 이름은 가리고 업무 사실은 보존한다

- **배경:** 일반 NER는 사람 이름뿐 아니라 수량·날짜·시각·기관·장소도 탐지한다. 이를 모두 지우면 영향 인원과 마감 시각처럼 문의 대응에 필요한 사실이 사라진다.
- **검토한 안:** 기존 연락처 종류로 이름을 대체, 모든 개체를 일괄 마스킹, 이름 전용 종류를 추가하고 업무 사실을 보존.
- **결정:** 사용자가 승인한 `SensitiveType.PERSON`·`[PERSON_REDACTED]`를 추가한다. 전송용 복사본에서 확인한 이름 범위만 가리며 DB 원문은 유지한다. AI 출력의 업무 Category는 변경하지 않는다.
- **근거:** 개인정보의 종류와 문의의 사실을 구분한다. 숫자·날짜를 무조건 통과시키는 정책도 아니다. 전화번호·생년월일 등은 별도 문맥과 탐지 정책이 필요하다.
- **영향 파일:** Lab의 `AiInputPrivacyGuard.java`, `AiScannedInputPreparerTest.java`, `README.md`, 모델 실험 디렉터리와 개인정보 학습자료.
- **후속 검토:** 실제 탐지 누락·과도한 마스킹, 실행 시간·자원과 배포용 Adapter의 제한·정리를 별도로 확인한다.

### 실제 모델 평가와 배포용 연결을 분리한다

- **배경:** 통제한 위치를 가리는 Test는 실제 모델의 이름 탐지 능력을 확인하지 않는다.
- **검토한 안:** Unit Test 통과 후 바로 Main 연결, 모델에게 기대값까지 전달, 입력과 정답을 분리한 독립 평가.
- **결정:** 모델에는 각 합성 Case의 제목·본문만 전달한다. 모델 실행 뒤 기대 위치와 비교한다. 실험 코드는 Java 서버를 바꾸지 않는 별도 Python Container로 둔다.
- **근거:** 정답 유출 없이 탐지 품질을 확인하고, 모델 설치가 App·Secret·다른 프로젝트의 환경에 영향을 주지 않게 한다.
- **영향 파일:** Lab의 `experiments/privacy-ner/`.
- **후속 검토:** 아래 누락·오탐이 확인돼 이 후보는 배포용 검사기로 채택하지 않는다. 기대값을 모델 출력에 맞춰 바꾸거나 사례별 예외를 덧붙여 통과시키지 않는다. 다른 후보·문맥 규칙을 평가하더라도 같은 기준과 미사용 검증 입력을 유지한다.

## 실행 환경

모델은 Explosion의 [ko_core_news_sm 3.8.0](https://github.com/explosion/spacy-models/releases/tag/ko_core_news_sm-3.8.0), 라이브러리는 spaCy 3.8.16이다. 모델의 `PS` Label만 승인된 `PERSON`으로 옮기고, 제한적인 EMAIL·PHONE 규칙을 함께 사용했다. 날짜·시각·수량·기관·장소 Label은 일괄 치환하지 않았다. 주소·생년월일·비밀번호 전부를 탐지하는 구현이 아니다.

모델은 `CC BY-SA 4.0`, spaCy는 MIT로 구분한다. 원본 Weight를 수정·재학습하지 않았고 Wheel의 원래 License·출처 파일을 Image 안에 유지했다. 모델을 배포물에 포함할 때의 의무는 별도 검토 대상이다.

| 항목 | 고정값·실행 조건 |
|---|---|
| Model Wheel SHA-256 | `15486b93a22ec8ee43f787390afdb4e2086851573eb12b69dd2c4f2a95b3e0a4` |
| Python Base Image | `python:3.11-slim-bookworm@sha256:0a310eeecf4e1f5a0743f9a6520c90c88d089c903ca5fd283f501e3a805f5f89` |
| 마지막 측정 Image Manifest | `sha256:5cf08db933496b6db445051ae04b53cb22da116c1e04609183e7023d894eae98` |
| 마지막 측정 Image Config | `sha256:4773b7d4c5948779867af1c1f3729049fcbc2bfbf73cc84cbe03b28bd6259f8a` |
| 실행 | Docker Desktop Linux Engine, `linux/amd64`, CPU 0.25·Memory 512 MiB |
| 격리 | Network 없음·읽기 전용 Root·비Root·Capability 제거·PID 64 상한 |
| 전체 실험 제한 | 60초·종료 유예 5초. Job별 검사 Timeout·취소 구현이 아님 |
| 입력 | 고정 합성 12건. 예시 이름·`.invalid` 이메일·합성 휴대전화 |

Wheel Hash는 개발사 HTTPS Release에서 내려받은 파일의 계산값이다. 해당 GitHub Asset의 별도 Digest는 없었으므로 독립된 서명 검증으로 표현하지 않는다. Base Image·직접 의존성·모델 Hash는 고정했고 전이 의존성은 아래 설치 Version과 실험 Image로 식별한다. 배포용 전체 Lock은 아직 준비하지 않았다.

전역 Python 패키지를 바꾸거나 App Source·환경 파일·Secret·Docker Socket을 Container에 넣지 않았다. 모델 설치 Build에는 공개 패키지 다운로드를 사용했지만 추론 실행 중 네트워크는 차단했다. 실험 Container는 `--rm`으로 제거했고 로컬 실험 Image와 공개 Wheel Cache는 남아 있다.

## 결과

Java의 Guard·범위 치환·JSON·전처리기 Focused Test는 **178개**가 실패·오류·건너뜀 없이 통과했다. 새 PERSON Case는 이름 위치를 통제하며 업무 인원·마감·요청 문장과 원문 보존을 확인한다. 실제 모델의 위치 탐지는 이 Java Test의 범위가 아니다.

Python의 정책·연결 Unit Test **10개**도 통과했다. 여기서 사용하는 NER는 Test Double이다. 별도로 실행한 실제 모델은 두 번 모두 아래와 같은 탐지 집계를 냈다. 마지막 실행은 CPU 계측 이름을 전체 Case Loop 범위에 맞게 정리한 뒤 재실행한 것이다. 입력·기대값·탐지 정책은 바꾸지 않았다.

| Case | 내용 | 정확한 범위·종류·보존 모두 통과 | 관찰 |
|---|---|---|---|
| P01 | 이름·20명 영향·18시 마감 | 실패 | 이름 `홍길동` 탐지 누락 |
| P02 | 이름·로그인 복구 사실 | 통과 | 이름 치환, 복구 사실 보존 |
| P03 | 이름·이메일 | 실패 | 이름 뒤 `입니다`까지 포함, 일반 문구 `이메일은`을 PERSON으로 오탐 |
| P04 | 표준 휴대전화·마감 | 통과 | PHONE 탐지·마감 보존 |
| P05 | 표준 이메일·긴급하지 않음 | 통과 | EMAIL 탐지·사실 보존 |
| P06 | 업무 영향 인원·마감 | 통과 | 수량·마감 보존 |
| P07 | 로그인 복구 후 문의 | 통과 | 복구와 문의 목적 보존 |
| P08 | 이모지·이름·이메일 | 실패 | 이름 누락, `이메일은` 오탐 |
| P09 | 제목의 이름·본문의 마감 | 통과 | 제목의 PERSON 탐지·본문 보존 |
| P10 | 지사·영향 인원·마감 | 통과 | 일반 장소·업무 사실 보존 |
| P11 | 서로 다른 두 이름 | 실패 | 두 이름 중 `홍길동` 누락 |
| P12 | `help [at] example.invalid` | 실패 | 비표준 이메일 누락, `이메일은` 오탐 |

**7/12는 이 고정 합성 Case의 통과 수이며 일반적인 정확도가 아니다.** 서로 다른 이름·문장·개인정보 종류의 실제 분포를 대표하지 않는다. 탐지 JSON과 범위가 잘못돼 중단된 Case는 0건이었지만, 정확한 범위 기준 TP 7·FN 5·FP 4가 나왔다. 이름 뒤 문구까지 포함한 하나의 경계 오류는 FN과 FP에 각각 집계되므로 FN 5를 서로 다른 개인정보 5개가 모두 노출됐다는 뜻으로 읽지 않는다.

중요한 실패는 형식 검사로 드러나지 않았다. P01은 `completed=true, spans=[]`라 형식상 정상이어도 이름이 남는다. P03은 범위가 존재하는 위치를 가리키지만 일반 문구를 잘못 가린다. 이 모델을 바로 연결하면 개인정보 누락과 문의 내용 훼손을 모두 만들 수 있다.

### 실행 자원 관찰

마지막 실제 실행 한 번의 값이다. Import·Load는 Wall Time, Scan은 제목·본문의 규칙/NER 실행과 결과 검증을 포함한다. 별도의 통계적 성능 보장으로 해석하지 않는다.

| 지표 | 값 |
|---|---|
| spaCy Import | 2,687.45 ms |
| Model Load | 1,019.07 ms |
| 12 Case Scan 중앙값 / 최댓값 | 1.78 / 76.44 ms |
| 전체 Case Loop CPU 시간 | 24.58 ms. 탐지·검증·치환·정답 비교 포함 |
| Process `ru_maxrss` | 210.57 MiB |
| Container `memory.peak` | 179.91 MiB |

Process RSS와 cgroup Memory Peak는 수집 범위·계측 방식이 다른 값이며 서로 대체하거나 단순 합산하지 않는다. JVM·App·Worker는 함께 실행하지 않았다. 이 수치만으로 기존 512 MiB ECS Task에 추가할 수 있다고 판단하거나 Task 크기를 변경하지 않는다.

## 재현

Lab Repository Root에서 실행한다. 합성 Dataset과 기대값은 실험 디렉터리 안에 있으며 실행 중 외부 입력을 받지 않는다.

```powershell
python -B -m unittest discover -s experiments/privacy-ner -p test_probe.py
docker build --platform linux/amd64 -t helpdesk-privacy-ner-probe:local experiments/privacy-ner
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 64 --cpus 0.25 --memory 512m --memory-swap 512m helpdesk-privacy-ner-probe:local
```

Unit Test나 Build가 실패하면 다음 명령으로 진행하지 않는다. 모델 실험의 Exit Code 0은 측정이 끝나 결과 JSON을 반환했다는 뜻이다. 결과의 Case 실패를 품질 통과로 바꾸지 않는다. 출력에는 원문·개체 문자열 없이 Case ID·위치·종류·집계·의존성 Version·자원 수치만 담는다.

Java의 PERSON 변경 검증 명령은 다음과 같다.

```powershell
.\mvnw.cmd -B -ntp "-Dtest=AiInputPrivacyGuardTest,AiInputSpanMaskerTest,AiPrivacyScanResultValidatorTest,AiScannedInputPreparerTest" test
```

### 마지막 실행의 설치 Version

```text
spacy=3.8.16; ko_core_news_sm=3.8.0; thinc=8.3.13; numpy=2.4.6
blis=1.3.3; cymem=2.0.13; murmurhash=1.0.15; preshed=3.0.13; srsly=2.5.4
catalogue=2.0.10; confection=1.3.3; weasel=1.0.0; wasabi=1.1.3
spacy-legacy=3.0.12; spacy-loggers=1.0.5; cloudpathlib=0.26.0
pydantic=2.14.1; pydantic_core=2.50.1; annotated-types=0.8.0
typing_extensions=4.16.0; typing-inspection=0.4.4; annotated-doc=0.0.5
requests=2.34.2; urllib3=2.8.0; charset-normalizer=3.5.2; idna=3.20
certifi=2026.7.22; httpx=0.28.1; httpcore=1.0.9; h11=0.16.0; anyio=4.15.1
typer=0.27.3; click=8.5.0; shellingham=1.5.4; rich=15.0.0
markdown-it-py=4.2.0; mdurl=0.1.2; Pygments=2.21.0
Jinja2=3.1.6; MarkupSafe=3.0.4; smart_open=8.0.3; wrapt=2.5.1
packaging=26.3; tqdm=4.70.1; wheel=0.46.3; setuptools=79.0.1; pip=24.0
```

## 다음 구현 경계

실제 탐지 후보를 재평가한 뒤에 Main의 `AiPrivacyScanner` Adapter·Bean과 응답 읽기 상한·Job별 Timeout/취소·자원 회수를 연결한다. 기존 Java 검증·치환과 실패 저장 경계를 생략하지 않는다. 탐지 누락을 `PRIVACY_SCAN_INVALID_RESULT`로 자동 판별한 것도 아니며, 채택하지 않은 모델을 Main의 기본 경로로 등록하지 않는다.

이번 PERSON 변경에는 DB Migration이 필요하지 않다. 개인정보 종류는 전송 전 범위 치환 계약이며 AI Category나 DB의 제안 분류를 늘리지 않았기 때문이다. 앞선 실패 코드용 V8은 별도 변경이며 실제 RDS에는 아직 적용하지 않았다.

외부 AI·실제 Provider Key·AWS 설정·Cloud Image·RDS는 변경하지 않았다. 전체 Java 701개·JavaScript 232개는 PERSON 추가 전의 회귀 결과다. PERSON 추가 뒤에는 Java Focused 178개와 Python Unit 10개·실제 모델 평가를 실행했으며, 전체 회귀·CI·Commit·Push는 이번 단계에서 하지 않았다.

## 관련 자료와 검토 범위

- [개인정보 탐지와 원문을 보존하는 마스킹](../study-docs/privacy-detection-and-minimal-masking.md)
- [실패 저장·JSON·Processor 연결의 실행 보고서](./2026-10-15-privacy-scan-failure-persistence.md)

모델 실험의 코드·고정 Dataset·직접 의존성·Dockerfile·사용 안내와 PERSON 변경을 확인했다. 주간 계획·Lab README는 개인정보 계약과 이번 실행에 해당하는 절을 선택해 확인했으며, Repository 전체 검토나 Week 8 완료 판정이 아니다.
