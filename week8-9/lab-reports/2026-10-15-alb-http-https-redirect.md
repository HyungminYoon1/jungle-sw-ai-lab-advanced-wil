# ALB의 HTTP → HTTPS 301 Redirect 설정과 검증

> 실행일: 2026-10-15
> 상태: 승인한 ALB 인바운드 규칙과 HTTP Listener 설정 완료. 실제 HTTP `301`·Location·HTTPS 기본 응답 확인

## 승인한 범위

기존 학습용 ALB에 HTTP 진입을 추가하되 접속자 범위는 넓히지 않았다.

- 기존 HTTPS 443의 학습자 공인 IPv4 `/32`와 정확히 같은 Source에 TCP 80 규칙 한 개를 추가했다. 실제 IP 값은 공개 문서에 기록하지 않는다.
- 같은 ALB에 HTTP 80 Listener 한 개를 추가했다. 기본 동작은 같은 Host·Path·Query의 HTTPS 443으로 `HTTP_301` Redirect다.
- 새 Listener에는 기존 식별 규칙인 `Project=helpdesk-learning` 태그를 사용했다.
- App·RDS·DNS·IAM 정책·기존 HTTPS Listener는 변경하지 않았다. Task 교체·AI 호출·리소스 삭제도 하지 않았다.

앞선 연결 상태는 [첫 HTTPS 응답 보고서](./2026-10-15-cloud-https-baseline.md)에 있다. 이 보고서는 그 이후의 Redirect 설정과 익명 HTTP 확인만 다룬다.

## 변경 전후 설정

서울 Region의 기존 비Root 배포 사용자로 AWS Console에서 설정했다. Root 전환이나 IAM 권한 추가 없이 완료했다.

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| ALB Security Group 인바운드 | 학습자 `/32`의 TCP 443 한 개 | 기존 443 유지 + 같은 `/32`의 TCP 80 한 개 |
| ALB Security Group 아웃바운드 | 기존 App 경로 한 개 | 변경하지 않음 |
| HTTPS 443 Listener | 기존 ACM 인증서·Target Group 전달 | 같은 Listener·인증서·전달 대상 유지 |
| HTTP 80 Listener | 없음 | HTTPS 443으로 301 Redirect |

규칙 저장 전 미리 보기에서 TCP 80의 새 규칙 한 개만 생성되고 기존 443 변경은 없는지 확인했다. 저장 후 인바운드는 두 개, 아웃바운드는 한 개였다. Listener도 기존 HTTPS와 새 HTTP의 두 개였다.

HTTP Listener의 기본 동작은 다음과 같이 표시됐다.

```text
Redirect: HTTPS://#{host}:443/#{path}?#{query}
Status: HTTP_301
```

따라서 HTTP 요청은 ALB에서 Redirect 응답을 받고, Client가 새 HTTPS 요청을 보내면 기존 HTTPS Listener와 App 경로를 사용한다. 서비스 CNAME이나 App의 Port를 바꾸는 작업이 아니다.

## 실제 HTTP 응답

PC의 `.NET HttpClient`로 비밀값이 없는 익명 GET을 보냈다. `AllowAutoRedirect=false`와 `UseCookies=false`를 사용했고, Password·Cookie·CSRF Token·전체 Header는 출력하지 않았다.

| 요청 | 변경 전 | 변경 후 |
|---|---|---|
| HTTP `/actuator/health?redirect_probe=week8` | 8초 제한 내 HTTP 응답 없음 | 301, 같은 Host·Path·Query의 HTTPS Location |
| HTTPS `/actuator/health?redirect_probe=week8` | 200, Health `UP` | 200, Health `UP` |
| HTTP `/tickets.html?redirect_probe=week8` | 별도 요청하지 않음 | 301, 같은 Host·Path·Query의 HTTPS Location |
| HTTPS `/login` | 이 실행의 변경 전 대조에서는 생략 | 200, Location 없음 |
| HTTPS `/api/tickets/1` | 이 실행의 변경 전 대조에서는 생략 | 401, Location 없음 |

두 HTTP 응답의 Location을 URI로 해석해 `https`, Port 443, 원래 Host와 Path·Query가 모두 일치하는지 확인했고 두 건 모두 통과했다. Location에서 기본 Port `:443`의 문자열이 생략돼도 HTTPS의 기본 Port 443으로 해석된다.

이 결과는 실제 HTTP Client의 응답 근거다. Browser가 자동으로 이동한 화면을 이 실행에서 관찰했다는 뜻은 아니다. 이번 검증에서 새 로그인·문의 생성·DB Row 조회·Worker 처리는 실행하지 않았다.

## 학습에서 구분한 내용

- 학습자 IP는 이 직접 연결 구성에서 ALB가 보는 공인 출발 IPv4다. 일반적인 공유기 환경에서 `ipconfig`에 보이는 PC의 사설 IPv4와 구분한다.
- `/32`는 주소 한 개를 뜻한다. 같은 공인 IP를 공유하는 다른 기기도 접속할 수 있으므로 IP 제한은 사용자 인증을 대신하지 않는다.
- 장소 이동이나 VPN 등으로 공인 출발 주소가 바뀌면 새 연결이 차단될 수 있다. 새 주소 확인과 별도 승인 없이 허용 범위를 넓히지 않는다.
- Security Group에서 80번 연결이 차단되면 ALB가 그 HTTP 요청에 301을 반환할 수 없다. 반대로 Network 허용만으로 Redirect가 만들어지지도 않는다.
- Redirect는 새 HTTPS 요청을 안내한다. 이미 HTTP로 전송한 Password를 보호하지 않으므로 로그인은 처음부터 HTTPS에서 진행한다.

개념과 핵심 질문은 [Network·DNS·HTTPS 학습자료](../study-docs/aws-network-dns-and-https.md)에 정리했다.

## 유지한 실행 범위

새 ALB·App·DB를 추가하지 않았으며 기존 실행 리소스를 중지하거나 삭제하지도 않았다. 기존 실행·Storage·Log 등의 비용은 계속 발생할 수 있다. 이번 변경을 전체 AI 배포·Task 교체 복구·Database 복원 완료로 기록하지 않는다.
