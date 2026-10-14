# 2026-10-14 RDS 설정 화면과 IAM 요청 검증

RDS 오류를 볼 때 화면에 나타난 `403`의 개수보다 어떤 Action이 어떤 단계에서 거부됐는지를 구분해 정리한다.

## Allow가 있어도 요청이 거부될 수 있다

`no identity-based policy allows`는 현재 요청에 적용되는 Allow를 찾지 못했다는 뜻이다. 정책에 Action 자체가 없을 수도 있고, Action이 있어도 Resource나 Condition이 맞지 않을 수 있다.

이번 DB 생성 이벤트에서는 서울 Region과 MFA 인증을 확인했다. 그러나 DB 이름·사양·태그·암호화·Public Access 조건을 모두 통과했다고 판단할 수는 없다. 각각의 조건을 실제 요청과 대조해야 한다.

## 기록의 null과 요청의 누락은 다르다

CloudTrail의 `requestParameters: null`은 그 기록에서 요청 필드를 읽을 수 없다는 뜻이다. 이 값만 보고 실제 요청에 Project 태그가 없었다고 판단하면 안 된다. 기록에서 확인하지 못한 것과 서버에 보내지 않은 것은 서로 다른 사실이다.

## 설정 화면도 여러 API를 호출한다

RDS 생성 화면은 DB를 생성하기 전에 클러스터·디렉터리·키 별칭 등의 목록을 조회한다. 이번에는 `rds:DescribeDBClusters`, `ds:DescribeDirectories`, `kms:ListAliases`의 조회 거부를 확인했다.

설정 화면의 목록 조회를 허용하는 것과 DB 생성 조건을 완화하는 것은 다르다. 키 별칭을 볼 수 있어도 암호화된 값을 복호화할 수 있는 것은 아니며, 디렉터리 목록을 조회한다고 Helpdesk가 그 인증 방식을 사용하는 것도 아니다.

## 정책 저장과 실제 동작 확인

Runtime Version 4에는 확인된 세 조회만 추가했다. 크기를 줄이기 위해 `Sid` 여섯 개를 바꿨지만, 기존 Action·Resource·Condition은 유지했다. `Sid`는 문장을 식별하는 이름이며 그 이름 자체가 접근을 허용하는 규칙은 아니다.

정책 구조 Test는 작성한 조건과 금지 권한을 검사한다. AWS에 저장된 전체 정책을 대조하는 것은 그 명세가 반영됐는지 확인하는 단계다. 그 다음에 비Root 요청으로 화면 조회·DB 생성·TLS 접속을 각각 확인해야 한다.

## 핵심 질문

1. 정책에 `rds:CreateDBInstance`가 있는데도 요청이 거부된다면 무엇을 대조해야 하는가?
2. CloudTrail의 `requestParameters`가 `null`인 것과 실제 요청에서 태그가 누락된 것은 왜 다른가?
3. `kms:ListAliases`를 허용해도 `kms:Decrypt`를 허용한 것이 아닌 이유는 무엇인가?
4. 정책 구조 Test 통과·정책 저장·생성 화면 표시·DB 생성·TLS 접속은 각각 무엇을 확인하는가?

구체적인 이벤트와 적용 결과는 [RDS 조회 권한과 생성 요청 진단](../lab-reports/2026-10-14-rds-console-permission-diagnostics.md)에 정리했다. 다음은 배포 사용자로 돌아가 생성 화면과 실제 생성 조건을 확인하는 것이다.
