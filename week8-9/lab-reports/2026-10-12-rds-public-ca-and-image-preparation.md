# RDS 공개 CA와 Image 파일 권한 확인

> 실행일: 2026-10-12 KST
> 결과: 공개 CA·실행 명세 Test, 로컬 재Build와 비Root 파일 읽기 통과
> Cloud 상태: RDS 생성·TLS 연결·ECR 업로드 미수행

## 공개 인증서와 비밀값의 구분

AWS의 공식 [서울 RDS CA 묶음](https://truststore.pki.rds.amazonaws.com/ap-northeast-2/ap-northeast-2-bundle.pem)을 HTTPS로 가져왔다. 공개 Root CA 3개만 포함하며 Private Key는 없다. 파일 SHA-256은 `913fb5b814f17af79d4c1622584a8d0ceddf5b0d76fe353d0c7d1186cdd6b229`이고 Lab의 Manifest에 공식 취득 위치·확인일·Image 경로와 함께 기록했다.

ECC384·RSA2048·RSA4096 G1의 서울 Root CA인지, 공개 CA 형식·자체 서명과 현재 유효 기간을 확인했다. 자체 서명 확인만으로 출처를 증명하는 것은 아니며, 공식 HTTPS 취득 위치와 검토한 파일 Hash를 함께 유지한다.

DB Password와 외부 AI Key는 넣지 않았다. 공개 CA 한 파일만 Build Context에 허용하고 나머지 PEM·Key·환경 파일 제외 규칙을 유지했다. Runtime에서 JDBC의 `sslrootcert`로 참조하며 JVM 전체 Truststore는 변경하지 않는다.

## Build 성공 뒤 비Root 읽기에서 찾은 실패

작업 트리의 변경으로 `helpdesk:week8-rds-tls-preflight`를 로컬 Build했다. Source Label을 현재 Commit으로 표시하거나 ECR에 업로드하지 않았다. Java Source·JAR는 바뀌지 않아 Cache를 사용하고 Runtime의 CA 복사를 새로 수행했다.

첫 파일 복사의 `--chmod=0444`가 새 부모 디렉터리에도 적용됐다. 실제 사용자 `10001:10001`의 읽기는 `Permission denied`였고 디렉터리 Mode가 `444`임을 확인했다. Source·인증서 형식 Test와 Build가 성공하더라도 실제 파일 읽기는 실패할 수 있었다.

CA 파일을 Root 소유 `0444`로 두고, 부모 디렉터리는 Root 소유 `0555`로 명시했다. 파일을 바꿀 소유 권한 없이 비Root App이 디렉터리를 통과해 읽을 수 있게 했다. 재Build 후 Network 없는 임시 Container에서 파일 Hash가 일치했고 두 Mode·소유자도 확인했다. Helpdesk JVM·DB는 시작하지 않았으며 검사 Container는 종료 후 제거했다.

| 확인 | 결과 |
|---|---|
| Image Platform·기본 사용자 | `linux/amd64`, `10001:10001` |
| 부모 디렉터리 Mode·소유자 | `555 0:0` |
| 공개 CA 파일 Mode·소유자 | `444 0:0` |
| Image 파일과 Manifest의 Hash | 일치 |
| 검사 Network·App·DB 실행 | 없음 |

## 실행 명세와 Test

ECS 초안의 JDBC URL에 `sslmode=verify-full`과 `/app/certs/rds-ca-bundle.pem`을 명시했다. 실제 RDS Endpoint·DB 이름, Role·Secret 등 Cloud 참조는 미확정 값으로 남겼다. pgJDBC의 인증서 사슬·Hostname 검증을 요구하는 설정이며, 검증을 생략하는 Factory나 낮은 SSL 모드로 대체하지 않는다. [pgJDBC 안내](https://jdbc.postgresql.org/documentation/ssl/)

```powershell
node --test src/test/js/rds-public-ca-bundle.test.mjs src/test/js/ecs-task-definition-template.test.mjs
docker build --platform linux/amd64 --tag helpdesk:week8-rds-tls-preflight .
docker run --pull never --rm --network none --entrypoint sha256sum helpdesk:week8-rds-tls-preflight /app/certs/rds-ca-bundle.pem
docker run --pull never --rm --network none --entrypoint stat helpdesk:week8-rds-tls-preflight -c '%a %u:%g' /app/certs /app/certs/rds-ca-bundle.pem
```

권한 수정 뒤 최종 재실행에서 CA·명세 Test 13개를 포함한 전체 JavaScript 165개와 ESLint가 통과했다. 이전 전체 회귀를 이번 Build에서 새로 수행한 것으로 합산하지 않는다. 전체 Java 회귀는 이번 변경에서 다시 실행하지 않았다.

실제 RDS가 선택한 CA·서버 인증서·Hostname·TLS 사용은 RDS 연결 후 검증한다. 기존 ECR Image에는 이번 파일이 없으므로 배포 전에 새로운 CI Image 검증·승인된 업로드·Digest 대조가 필요하다. 파일 준비를 RDS TLS 연결 성공으로 표현하지 않는다.

- [DB TLS 학습자료](../study-docs/aws-network-dns-and-https.md#app과-rds-사이의-tls)
- [배포 계획](../deployment-plan.md)
