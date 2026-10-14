# RDS Console 조회 권한과 생성 요청 진단

> 실행일: 2026-10-14
> 상태: CloudTrail 진단과 Runtime Version 4 적용 완료. 비Root RDS 화면 재확인·생성 조건 대조·DB 연결은 남아 있음.

일반 PostgreSQL을 선택하면 RDS 생성 화면의 연결 설정부터 리소스 로드 오류가 발생했다. DB 생성 요청의 `403`과 화면을 구성하는 목록 조회의 거부를 구분하기 위해 CloudTrail 이벤트를 확인했다.

## DB 생성 거부에서 확인한 내용

앞 회차의 `CreateDBInstance` 이벤트는 한국 시각 10월 14일 01:26:00에 기록됐다. 호출자는 `helpdesk-deployer`, Region은 서울, MFA 인증은 `true`였다. 결과는 `AccessDenied`이며 적용되는 신원 정책의 Allow가 없다는 메시지였다.

이 이벤트의 `requestParameters`와 `responseElements`는 모두 `null`이었다. 이는 기록에서 실제 생성 요청의 필드를 확인할 수 없다는 뜻이다. Project 태그가 없었다거나 암호화가 꺼졌다고 단정할 수 없다. MFA·Region이 맞더라도 Resource와 나머지 Condition이 모두 충족됐다는 뜻은 아니다. [AWS 조건 평가](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_condition-logic-multiple-context-keys-or-values.html)

## 추가로 확인한 조회 거부

RDS 화면을 열던 시점의 관련 이벤트에서 다음 거부를 확인했다. 시각은 한국 시간이다.

| Action | 시각 | 결과 |
|---|---|---|
| `rds:DescribeDBClusters` | 10/14 13:13:02 | `AccessDenied`, 신원 정책의 Allow 없음 |
| `ds:DescribeDirectories` | 10/14 13:13:06 | `AccessDenied`, 신원 정책의 Allow 없음 |
| `kms:ListAliases` | 10/14 13:13:06 | `AccessDenied`, 신원 정책의 Allow 없음 |

조회 권한이 없는 것은 확인했지만, 이 세 거부가 이전 `CreateDBInstance` 거부의 원인이라는 뜻은 아니다. 생성 화면의 조회를 복구한 뒤 DB 생성 설정을 다시 대조한다. 전체 이벤트·HAR·Credential은 공개 기록에 포함하지 않았다.

## 세 조회만 추가한 결정

현 정책을 유지하는 안, 서비스 전체 조회 권한을 추가하는 안, 확인된 세 조회만 추가하는 안을 비교했다. 마지막 안의 적용을 승인받아 기존 `helpdesk-deployer-runtime`을 갱신했다. 새 정책을 연결하거나 Root로 DB를 생성하지 않았다.

세 조회는 기존 메타데이터 문장의 `Resource: "*"`에 추가했다. Foundation의 직접 호출 MFA·서울 제한을 유지한다. 서울의 다른 프로젝트 클러스터·디렉터리·키 별칭 메타데이터도 조회 가능해지지만, Secret 값 조회·KMS 복호화·디렉터리 변경 권한은 추가하지 않는다. 디렉터리 목록 조회를 허용한 것은 Helpdesk에 Directory 인증을 도입한 것이 아니다. [RDS 권한 정의](https://docs.aws.amazon.com/service-authorization/latest/reference/list_rds.html), [Directory Service 권한 정의](https://docs.aws.amazon.com/service-authorization/latest/reference/list_ds.html), [KMS 별칭 조회 권한](https://docs.aws.amazon.com/kms/latest/developerguide/alias-access.html)

PostgreSQL·`db.t4g.micro`·Single-AZ·20 GiB·Storage 암호화·Public Access 비활성·Project 태그와 지정 Subnet Group 사용 조건은 그대로다. Foundation·Edge·Bootstrap과 기존 Role은 수정하지 않았다.

## 정책 대조와 검증

변경 전 AWS에 저장된 전체 JSON은 로컬 Version 3 명세와 일치했다. 세 Action 추가 외에는 문장 식별자 `Sid` 여섯 개만 줄였다. Action·Resource·Condition을 구조적으로 비교해 다른 권한 변경이 없는지 확인했다.

실제 계정 번호를 반영한 정책 크기는 공백 제외 6,143자에서 6,130자로 줄었고, 문장은 15개다. Managed Policy의 한도는 6,144자이며 공백은 계산에서 제외된다. [AWS IAM 정책 크기 제한](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html)

로컬 정책 구조 Test 34개, JavaScript 전체 Test 207개와 ESLint가 통과했다. AWS 편집기의 보안·오류·경고·추천도 모두 0이었다.

14:53에 기본 Version 4로 저장했다. 저장 후 전체 JSON의 내용을 수정안과 다시 대조했고, 기본 Version 4와 이전 Version 1~3의 보존을 확인했다. 연결된 엔터티는 `helpdesk-deployer` 한 명이었다. 정책 저장 후 Root에서 로그아웃했다.

변경 파일은 Lab의 `deploy/iam/deployer-runtime-policy.template.json`, `src/test/js/iam-deployer-policy.test.mjs`, `deploy/iam/README.md`다. 운영 Java·JAR·Image는 바꾸지 않았으며, 이번 권한 변경에서 Java 회귀·외부 AI 호출·DB 생성·App·ALB 실행은 하지 않았다.

## 후속 확인

1. `helpdesk-deployer`로 로그인해 일반 PostgreSQL 생성 화면의 연결·암호화·태그 영역이 표시되는지 확인한다.
2. DB 이름·사양·학습 VPC와 Private Subnet Group·Project 태그·암호화·Public Access·자동 Storage 증설·백업·비용을 대조한다.
3. 생성 요청의 조건이 맞는지 확인한 뒤 기존 승인 범위에 따라 RDS 생성과 Private TLS·DB 인증·App 계정·Migration·연결을 진행한다.

권한 수정이 저장됐다는 결과와 실제 DB 생성·연결 성공은 별도의 확인 단계다.
