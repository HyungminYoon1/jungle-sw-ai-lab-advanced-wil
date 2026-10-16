# RDS는 유지하고 Private CloudShell의 psql만 17로 맞추기

> 실행일: 2026-10-17 KST
> 결과: 실제 psql 17.11·RDS 17.11·TLS 1.3·SQL/메타 명령·일곱 Table Hash 불변 확인

## 변경 범위

RDS의 PostgreSQL 17.11과 CloudShell의 기본 psql 16.15 사이에서 Major Version 경고가 있었다. 사용자는 RDS를 그대로 두고 Client만 17.x로 맞추도록 요청했다.

App·RDS Engine·Schema V8·계정·Password·Secret·IAM·Security Group·DNS는 변경하지 않았다. psql의 실제 Password 입력은 작성자가 직접 진행했다. 이 접속에서 DB 쓰기나 실제 AI 호출은 없었다.

## 공식 Client만 별도 준비

로컬 Docker에서 AWS 공식 AL2023 Base Digest와 Release `2023.12.20260930`, 패키지 `postgresql17-17.11-1.amzn2023.0.1`을 고정했다. Client와 전용 Library RPM의 서명이 유효함을 확인했고 DB Server 패키지는 사용하지 않았다.

추출한 Archive에는 Wrapper·psql 실행 파일·전용 libpq·저작권 고지, 총 네 파일만 있다. 크기는 458,696바이트, SHA-256은 `16827170ff4ddc53a47e555b8993b912734109d2bc851cf72293260e863b24d4`다. 실행 파일·Archive는 Git 제외 `local/tools/`에 보관하고 Builder·Manifest·생성기·Test만 관리한다. 로컬에서는 비Root·읽기 전용 Root·Network 차단 Container에서도 실제 Client의 17.11 실행을 확인했다.

Private CloudShell의 인터넷 경로는 열지 않았다. 공개 파일을 작은 부분으로 전달하고 Hash를 다시 확인한 뒤 `/tmp/helpdesk-psql17-*`에만 복구했다. 현재 Shell의 PATH를 바꿔 사용하며 원래 `/usr/bin/psql` 16.15는 그대로 남겼다. 전역 Library와 시스템 패키지도 덮어쓰지 않았다. [Lab 준비 안내](https://github.com/HyungminYoon1/ai-helpdesk-learning-lab/tree/main/deploy/cloudshell)

## 실제 접속 결과

| 확인 | 결과 |
|---|---|
| 선택한 Client의 `psql --version` | PostgreSQL 17.11 |
| 기존 `/usr/bin/psql --version` | PostgreSQL 16.15 보존 |
| `verify-full` 접속·App Password 인증 | 성공 |
| `SHOW server_version` | 17.11 |
| 현재 연결의 `pg_stat_ssl` | ssl=true, TLSv1.3 |
| 이전 Major Version 경고 | 새 접속에서 없음 |
| `\d public.tickets` | id·title·status 구조 조회 성공 |
| Flyway 이력 | V8 유지 |
| 일곱 Table 건수·내용 Hash | B→P 복귀 뒤 기준과 모두 일치 |
| 접속 종료 | 확인 뒤 `\q`, DB Session 종료 |

대조한 Table은 tickets·ticket_messages·ai_suggestion_jobs·ai_suggestion_attempts·ticket_suggestions·ticket_suggestion_categories·flyway_schema_history다. 건수는 각각 4·4·4·2·0·0·8이다. 합성 실패 두 건과 Attempt Fixture는 실제 Provider 호출이 아니다. 상세 기준 Hash는 [Image Rollback 보고서](./2026-10-16-image-rollback-cloud.md)를 따른다.

## 재현 과정에서 보완한 점

전체 준비 명령은 620,871자로 한 번 붙여 넣었을 때 잘렸다. 불완전한 입력은 실행하지 않고 취소했다. 이후 줄 경계를 보존한 20,000자 이하 32부분으로 전달해 실제 실행에 성공했다. 생성기에 `--part-count`·`--part N`을 추가하고, 전체 CLI 출력의 재조합이 원본과 정확히 같은지도 확인했다. 가장 큰 부분은 19,976자다.

접속 생성기는 psql 17.x가 아니면 CA 복구·DB 접속 전에 `PSQL17_REQUIRED`로 중단한다. 기존 CA Hash·TLS 서버 이름 검증·읽기 전용 기본값은 유지한다. VPC 세션 종료 뒤 Client·CA·PATH가 사라질 수 있으므로 준비 절차를 재실행한다.

## 검사 결과와 남은 범위

- Client/접속 생성기 Focused Test 26개, 전체 JavaScript Test 262개: 실패·건너뜀 0.
- ESLint 통과. 실제 Archive의 32개 CLI 출력 재조합도 일치.
- 앞서 분리한 B→P SQL Fixture의 실제 PostgreSQL Integration Test 1개도 재통과했다.
- Lab 구현 Commit은 `d0a55ce`다. 기존 Fixture는 `b663e59`로 별도 Commit했다.
- 이 회차에서는 Java 전체 회귀·원격 CI·Push·ECR 업로드를 새로 실행하지 않았다. main의 CI 명령에 새 생성기 Lint를 포함했지만 실행 결과는 로컬이다.

관리 도구 호환성 정리는 끝났으며 전체 AI 조립·Cloud 실행·Peak 자원 측정과 나머지 관측·마감 학습은 계속 남아 있다.
