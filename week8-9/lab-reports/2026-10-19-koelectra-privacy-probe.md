# 한국어 개인정보 탐지 후보 비교

> 실행일: 2026-10-19
> Lab Commit: `7ac6585`
> 결론: 실험 실행 완료, 운영 후보 채택 보류. Main·AWS·배포 Image 변경 없음

## 목적과 입력

앞선 spaCy 실험과 같은 합성 문의 12건으로 다른 작은 한국어 개인정보 NER 후보를 비교했다. 기존 Dataset의 본문·정답·보존 문구는 변경하지 않았다. 모델 입력에는 제목·본문만 전달하며 정답은 추론 후에 평가한다.

- Dataset SHA-256: `c1c180fd9f110292e79226b88a810eccf85d8e13f1c58f4521da434ba84a7195`
- 모델: [amoeba04/koelectra-small-v3-privacy-ner](https://huggingface.co/amoeba04/koelectra-small-v3-privacy-ner/tree/9f4e2fd9e35b12bcdb5fc334ac31be4399cb4281)
- Revision: `9f4e2fd9e35b12bcdb5fc334ac31be4399cb4281`
- Weight SHA-256: `d7fde5fac3e9b8d9582cb95d81b772d93daa894b8964fc579f1774ff416d55f1`
- Model Card의 라이선스 표시: Apache-2.0. 이 표시와 자체 합성 Dataset의 성적을 이번 정확도의 근거로 대신하지 않았다.

기존과 같은 제한적 이메일·휴대전화 Regex에 모델의 `PER`·`EMA`·`PHN`을 결합했다. 다른 Label은 건수만 관찰하며 일괄 마스킹하지 않았다. 따라서 주소·Password 등 전체 개인정보 보호를 평가한 실험이 아니다. 기존 Dataset을 확인한 뒤 고른 후보의 개발 비교이며 독립적인 최종 평가 Set도 아니다.

## 실행과 재현

Lab의 `experiments/privacy-ner/koelectra/README.md`와 고정 Model Lock·Dockerfile을 사용한다. 공개 파일은 Build 때 Hash를 확인하고, 실제 추론은 Network 없음·읽기 전용·비Root UID/GID 10001·전체 Capability 제거·추가 권한 획득 금지·PID 64개·0.25 CPU·512 MiB·Swap 추가 없음에서 실행했다. 임시 공간은 `/tmp` 16 MiB이며 App Source·Secret·Socket을 Mount하지 않았다.

첫 실행은 종료 코드 1·OOM 아님으로 끝났으며 탐지 결과가 나오지 않았다. 진단은 예외 종류·Code 위치만 출력했고 원문·예외 Message·환경 값은 출력하지 않았다. PyTorch 초기화 과정의 사용자 이름 조회에서 UID 10001에 해당하는 Linux 사용자 항목이 없었다. 비로그인 전용 사용자·Group을 Image에 만든 뒤 동일 권한 제한으로 재실행했다.

최종 실행은 종료 코드 0·OOM 없음으로 보고를 완료했다. 실행 후 Container 두 개는 모두 종료된 상태임을 확인하고 실험 Container만 제거했다. 모델 Image는 로컬에 유지했다.

- 최종 Image Index Digest: `sha256:ca59d2efd5c8628fc20e5b9e0014281331a031d59e70d3600b6540ad3773436b`
- 실행 Manifest Digest: `sha256:16ff9a340dd5a57601113a7852e21305aaf7210e096bff1d3d9c4608f8faac7b`
- Config Digest: `sha256:505ea475b3e5dd502e4b186e1d6c7acb9843546f2c3ada1f429b4ebff9d6f808`
- 주요 의존성: torch `2.10.0+cpu`, transformers `4.57.6`, tokenizers `0.22.2`, safetensors `0.7.0`, huggingface-hub `0.36.0`, numpy `2.4.6`

## 결과

| 항목 | 결과 |
|---|---:|
| 고정 합성 Case | 12건 |
| 정확한 범위·종류와 보존 조건 모두 통과 | 5건 |
| 현재 BIO Decoder 계약에서 거부 | 4건 |
| 완료된 8건의 정확한 범위 일치 | 5개 |
| 완료된 8건의 정답 범위와 불일치한 누락 | 3개 |
| 완료된 8건의 추가 범위 | 3개 |

| Case | 결과와 관찰 |
|---|---|
| P01 | 통과. 이름·영향 인원·마감 보존 |
| P02 | 미통과. 이름 외에 일반 문구 `제 이름`도 PERSON으로 잡음 |
| P03 | `MODEL_BIO_INVALID`로 결과 거부 |
| P04 | 통과. 합성 전화번호 치환·요청 보존 |
| P05 | `MODEL_BIO_INVALID`로 결과 거부 |
| P06 | 통과. 영향 인원·마감 보존 |
| P07 | 통과. 복구 사실·문의 목적 보존 |
| P08 | 통과. 이모지·이름·이메일의 위치와 보존 조건 충족 |
| P09 | 미통과. 제목에 있는 이름 누락 |
| P10 | `MODEL_BIO_INVALID`로 결과 거부 |
| P11 | 미통과. 두 이름 뒤의 공백·`님`까지 범위에 포함 |
| P12 | `MODEL_BIO_INVALID`로 결과 거부 |

모델은 `PER-B`·`PER-I`처럼 종류 뒤에 BIO 표시를 붙인다. 앞선 B가 없거나 종류가 다른 I를 Decoder에서 임의 복구하지 않도록 했다. 네 거부는 이 처리 계약에서의 실패이며 네 입력 모두에 대해 개인정보가 없다고 판단한 결과가 아니다.

위치 지표는 완료된 8건만 대상으로 한다. 특히 P11의 범위 불일치는 이름이 모두 그대로 노출됐다는 뜻이 아니다. 이름은 가렸지만 `님`까지 포함해 정확한 정답 범위와 달랐다. P09의 실제 이름 누락과 구분한다. 완료된 Case의 보존 문구 검사가 모두 참이어도 Dataset에 열거한 업무 문구를 확인한 범위이며 일반 문구의 과잉 치환까지 없다는 보증은 아니다.

앞선 spaCy 흐름은 7/12, 이번 흐름은 5/12였다. 모델·Label 변환·Regex 결합·충돌 검증을 포함한 후보 처리 흐름의 결과다. 모델 단독의 일반 정확도를 7/12와 5/12로 정의하거나, 거부된 Case를 빼고 전체 성적이 좋아졌다고 평가하지 않는다.

## 실행 자원

| 지표 | 관찰값 |
|---|---:|
| 라이브러리 Import | 10,101.04ms |
| 모델 Load | 206.31ms |
| Case 처리 중앙값 | 88.68ms |
| Case 처리 최대 | 92.27ms |
| Case 반복의 Process CPU 시간 | 184.55ms |
| Process 최대 RSS | 380.52 MiB |
| Container `memory.peak` | 257.25 MiB |

Case 시간에는 모델·Regex·검증·치환·평가가 포함된다. CPU 시간은 같은 구간에서 Process가 실제 CPU를 사용한 시간이며 벽시계 시간과 다르다. RSS와 cgroup은 메모리 계상 방식이 다르므로 더하거나 같은 지표처럼 대소를 비교하지 않는다. JVM·Worker를 함께 실행하지 않았으므로 이 단독 결과로 전체 App의 512 MiB 적합성을 판단하지 않는다.

## Test와 미검증 범위

새 Decoder·연결 Unit Test 18개와 기존 정책 Test 10개가 Windows에서 통과했다. 새 18개는 Build와 비Root·Network 차단·읽기 전용 Container에서도 통과했다. Unit Test는 통제된 Label·위치를 사용하는 처리 검증이며 실제 모델 12건 평가와 구분한다.

이번 변경은 실험 Source·안내뿐이다. Java Source·Scanner JSON·DB·Worker 정책·Main Bean·AWS·ECR을 변경하지 않았고 실제 고객 정보나 외부 AI API는 사용하지 않았다. 앞선 전체 Java 754개 통과 기록은 유지하되 이번 문서·Python 변경 뒤 새로 전체 Java를 실행한 것으로 기록하지 않는다.

## 다음 판단

이 후보도 운영에는 연결하지 않는다. 이름 누락·일반 문구 오탐·범위 확장·Label 변환의 실패를 남긴 채 전송을 허용하지 않는다. 탐지 품질과 관계 보존 계약을 보완한 후보를 추가 입력에서 평가해야 한다. 그 뒤 실행 설정·Linux Process 회수·전체 자원 측정·Main 연결을 진행한다. [분리 평가 결정](../../plan/decisions/0006-offline-privacy-model-comparison.md)
