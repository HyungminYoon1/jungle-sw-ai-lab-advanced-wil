# AWS Network와 DNS 그리고 HTTPS 요청 흐름

Browser가 서버를 찾는 일, 연결이 허용되는 일, 통신이 암호화되는 일, 사용자의 권한을 확인하는 일은 서로 다르다. DNS·Network·TLS·Spring Security가 각각 어느 부분을 맡는지 알면 배포 오류를 순서대로 찾을 수 있다.

아래는 Cloudflare를 DNS-only로 사용하고, ALB가 HTTPS를 받은 뒤 Helpdesk로 전달하는 **학습 구성의 예**다. 실제 리소스의 주소와 배치는 배포 설정에서 정한다.

## 먼저 전체 경로 보기

```text
주소 찾기
  Browser가 사용하는 DNS Resolver
    → DNS Cache 또는 권한 있는 DNS 서버 조회
    → helpdesk.example.com에 연결된 ALB 주소 확인

접속과 업무 처리
  Browser
    ── HTTPS 443 ──> ALB
                       ── HTTP 8080 ──> Helpdesk Task
                                          ── DB 연결 5432 ──> Private RDS
                                          ── HTTPS 443 ──> 외부 AI Provider
```

DNS Resolver는 이름에 대응하는 주소를 찾아주는 서버다. 권한 있는 DNS 서버는 해당 Domain의 공식 Record를 제공한다. Cache에 유효한 결과가 있으면 모든 DNS 서버를 매 요청마다 다시 조회하지는 않는다.

Browser는 RDS에 직접 접속하지 않는다. Helpdesk가 DB를 조회해 HTTP 응답을 만들고, Browser는 그 응답을 읽는다. Worker의 AI 요청도 Browser가 아니라 Helpdesk 서버에서 외부로 보내는 별도의 연결이다.

## VPC와 Subnet 그리고 Route Table

VPC는 AWS에 구성하는 논리적으로 분리된 Network다. Subnet은 그 안에서 IP 주소 범위를 나눈 부분이며 하나의 Availability Zone에 속한다. Availability Zone은 Region 안의 분리된 운영 구역이다.

Route Table은 **목적지 주소로 가는 경로**를 정한다. Security Group은 **어떤 연결을 허용할지**를 정한다. 길이 있어도 허용되지 않을 수 있고, 허용 규칙이 있어도 길이 없으면 연결되지 않는다.

| 대상 | 주요 의미 |
|---|---|
| Public Subnet | Internet Gateway로 직접 나가는 Route가 있는 Subnet |
| Private Subnet | Internet Gateway로 직접 나가는 Route가 없는 Subnet |
| Internet Gateway | VPC와 인터넷을 연결하는 구성 요소 |
| NAT Gateway | Private 주소의 Resource가 외부로 연결을 시작하고 응답을 받게 하는 수단 |
| VPC Endpoint | 지원하는 AWS 서비스에 Private 경로로 접근하는 수단 |

Route의 `0.0.0.0/0`은 모든 IPv4 목적지를 뜻한다. 이 Route를 추가했다고 모든 접속을 허용한 것은 아니다. Security Group의 허용 규칙과 Resource의 주소 조건은 별도로 적용된다. 같은 VPC의 내부 주소 간 통신에는 기본 Local Route를 사용할 수 있다. [AWS Route Table 설명](https://docs.aws.amazon.com/vpc/latest/userguide/subnet-route-tables.html)

Public Subnet에 놓았다는 사실만으로 인터넷 접속이 완성되지는 않는다. IPv4의 일반적인 Fargate 인터넷 연결에서는 Public IP·Internet Gateway Route·허용된 Outbound가 함께 필요하다. Private Task의 외부 연결은 NAT나 필요한 VPC Endpoint 등을 별도로 구성한다. [AWS Fargate Network 설명](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html)

ECR용 VPC Endpoint가 있다고 일반 외부 AI까지 연결되는 것은 아니다. 접속 대상마다 경로가 있어야 하며 NAT·Endpoint·Public IP의 비용과 접근 범위도 따로 비교한다.

## Fargate Task의 주소와 RDS 주소

Fargate의 `awsvpc` 구성에서는 Task에 Network Interface와 Private IP가 제공된다. ALB는 Task의 Private IP와 Application Port로 요청을 전달한다. 따라서 Fargate를 연결하는 Target Group의 Target Type은 `ip`를 사용한다. [AWS Task Network와 Target Type](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-task-networking.html)

Target Group은 ALB가 요청을 전달할 대상들과 Health Check 설정을 묶는 단위다. Task를 교체하면 IP가 바뀔 수 있으므로 Browser가 Task IP를 직접 주소로 사용하기보다 ALB를 진입점으로 둔다.

App이 RDS에 연결할 때는 RDS Endpoint의 이름과 `5432` Port, Database 이름을 사용한다. 다음은 주소 형태를 설명하는 자리표시자다.

```text
jdbc:postgresql://<RDS_ENDPOINT>:5432/<DATABASE_NAME>
```

App 안의 `localhost`는 별도 RDS를 가리키지 않는다. DB 주소와 별개로 DB 사용자·Password·Schema 권한과 DB 연결의 TLS 설정도 필요하다. Task Role이 존재한다는 사실만으로 PostgreSQL 로그인이 되는 것은 아니다. [IAM과 DB 인증의 구분](./iam-oidc-ecr-and-deployment-roles.md#image-전달과-application-실행의-role)

## Security Group으로 세 경계 나누기

Security Group은 Resource에 연결하는 Network 허용 규칙이다. 다음 표는 Inbound를 나누는 예다. 다른 연결된 Group이나 규칙까지 확인해야 실제 노출 범위를 알 수 있다.

| 대상 Group | 들어오는 Port | 허용할 출발점 |
|---|---:|---|
| ALB Group | TCP 443 | 학습자가 사용하는 Public IP 범위 |
| ALB Group | TCP 80 | HTTP Redirect를 제공할 경우 같은 학습자 IP 범위 |
| App Group | TCP 8080 | ALB Group |
| DB Group | TCP 5432 | App Group |

`App Group`을 출발점으로 허용한다는 것은 관련 Network Interface의 Group을 참조하는 것이지, 로그인 Role이 USER인지 AGENT인지 검사하는 것이 아니다. Security Group은 Ticket의 소유권이나 CSRF Token을 읽지 않는다.

Outbound도 맞춰야 한다. ALB에서 App의 `8080`, App에서 DB의 `5432`, Task에서 Image·Secret·Log·AI를 위한 외부 연결 경로가 필요하다. Security Group은 Stateful이므로 허용된 연결의 응답을 위해 반대 방향의 새 연결 허용을 그대로 반복할 필요는 없다. [AWS Security Group 설명](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html)

App에 Public IP가 있어도 App Inbound를 ALB에서만 허용할 수 있다. 반대로 Private RDS라는 이름만으로 안전해지는 것은 아니므로 Public Access·Route·Group을 함께 확인한다. IPv4와 IPv6 규칙도 별개의 범위다.

## DNS Record는 주소를 알려준다

서비스 주소 연결과 인증서 검증은 서로 다른 DNS Record를 사용한다.

| Record 용도 | 이름과 대상의 형태 | 목적 |
|---|---|---|
| 서비스 연결 CNAME | `helpdesk.example.com` → `<ALB_DNS_NAME>` | 서비스 이름을 ALB 주소에 연결 |
| ACM 검증 CNAME | `<ACM_RECORD_NAME>` → `<ACM_RECORD_VALUE>` | Domain을 관리할 수 있음을 ACM에 증명 |

CNAME은 한 이름이 다른 이름을 참조하게 한다. HTTP `302`처럼 Browser에게 다른 Page로 이동하라는 응답은 아니다. ALB를 CNAME으로 연결해도 Browser가 요청한 이름은 `helpdesk.example.com`이므로 인증서도 그 이름에 맞아야 한다.

ACM은 DNS 검증 Record로 Domain 통제 여부를 확인한다. 외부 DNS 서비스에도 이 Record를 등록할 수 있다. 서비스 CNAME만 만들었다고 인증서 검증까지 끝나는 것은 아니며, 자동 갱신에 필요한 검증 Record를 유지한다. [ACM DNS 검증](https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html)

DNS-only에서는 Cloudflare가 주소 조회에 응답하지만 HTTP·HTTPS를 Proxy하지 않는다. 실제 요청은 Browser에서 ALB로 간다. Proxied에서는 Cloudflare가 HTTP 경로에 들어오므로 TLS·접근 제한·Cache의 관찰 대상도 달라진다. Domain 검증용 Record는 Proxy하지 않는다. [Cloudflare Proxy 상태 설명](https://developers.cloudflare.com/dns/proxy-status/)

### Route 53의 Hosted Zone과 NS와 Alias

Hosted Zone은 특정 Domain에 대한 DNS Record 묶음이다. Public Hosted Zone을 생성했다고 인터넷의 Resolver가 자동으로 그 Zone을 사용하는 것은 아니다. 부모 Domain이나 등록기관의 NS 설정이 해당 Name Server로 조회를 위임해야 한다.

메인 Domain은 기존 DNS에 두고 별도 Subdomain만 Route 53으로 위임할 수도 있다. 위임 전에도 지정한 Name Server에 직접 질의해 Record 응답을 관찰할 수 있지만, 일반 Resolver의 결과와는 구분한다. [AWS Subdomain 위임 설명](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/dns-routing-traffic-for-subdomains.html)

Route 53의 Alias는 ALB 같은 지원 대상에 이름을 연결하는 AWS의 Record 기능이다. Domain 최상위에도 사용할 수 있다는 점 등이 일반 CNAME과 다르다. Cloudflare에 CNAME을 둔다고 Route 53의 Alias를 사용하는 것은 아니다. [Route 53과 ALB 연결](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-to-elb-load-balancer.html)

## HTTPS와 인증서 그리고 TLS 종료

HTTPS는 HTTP를 TLS로 보호해 전달하는 방식이다. Browser는 서버의 인증서 이름·유효 기간·신뢰 사슬 등을 확인하고 암호화된 연결을 만든다. 신뢰 사슬은 서버 인증서에서 중간 인증기관을 거쳐 Browser가 신뢰하는 인증기관으로 이어지는 관계다. [ALB 인증서 설명](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/https-listener-certificates.html)

Listener는 ALB가 어느 Port와 Protocol로 연결을 받을지 정한다. HTTPS Listener에는 인증서를 연결한다. ALB에서 TLS를 종료한다는 것은 ALB가 Browser와 암호화된 연결을 맺고 요청을 복호화한 뒤, 별도의 연결로 App에 전달한다는 뜻이다. [ALB HTTPS Listener](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-https-listener.html)

```text
Browser ── TLS로 보호된 HTTPS ──> ALB
                                  │ TLS 종료
                                  └── HTTP 또는 별도 HTTPS ──> App
```

ALB→App을 HTTP로 구성하면 해당 구간까지 TLS로 암호화되는 것은 아니다. Network 접근 제한과 암호화는 다른 조치다. App→RDS의 TLS와 서버 신뢰 확인도 Browser→ALB의 HTTPS와 별도로 정한다.

ALB에 사용할 ACM 인증서는 해당 ALB의 Region에 준비한다. 인증서 발급과 Listener 연결, DNS 연결을 모두 확인하며 인증서 경고를 무시하고 접속 성공으로 취급하지 않는다. [ACM의 Region별 사용](https://docs.aws.amazon.com/acm/latest/userguide/acm-overview.html)

HTTP→HTTPS Redirect는 HTTP 요청에 `Location`을 포함한 Redirect 응답을 보내 Browser가 새 HTTPS 요청을 하게 하는 동작이다. 이미 HTTP로 보낸 Password를 소급해 보호하지는 않으므로, 로그인과 상태 변경은 처음부터 HTTPS 주소를 사용한다.

## ALB 뒤에서 원래 HTTPS 요청을 알기

ALB→App이 HTTP이면 App의 직접 연결만 보고는 Browser가 HTTPS로 접속했는지 알 수 없다. ALB는 `X-Forwarded-Proto: https` 같은 Header로 원래 연결 정보를 전달한다. App은 신뢰하는 Proxy에서 받은 정보를 해석해 Redirect 주소와 보안 처리를 구성할 수 있다. [ALB Forwarded Header 설명](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/x-forwarded-headers.html)

Spring Boot는 `server.forward-headers-strategy`의 `NATIVE`나 `FRAMEWORK` 등으로 이를 처리할 수 있다. 실제 서버와 신뢰할 Proxy에 맞춰 선택해야 하며, 임의의 Client가 만든 Header를 모두 신뢰해서는 안 된다. ALB를 우회해 App에 직접 들어오는 연결도 제한한다. [Spring Boot Proxy 설정](https://docs.spring.io/spring-boot/how-to/webserver.html#howto.webserver.use-behind-a-proxy-server)

## HTTPS 이후에도 Session과 CSRF가 필요하다

HTTPS는 통신을 보호한다. 누가 로그인했고 어떤 Ticket 작업을 할 수 있는지, 요청이 올바른 상태 변경인지까지 대신 판단하지 않는다.

| 항목 | 역할 |
|---|---|
| Session Cookie의 `JSESSIONID` | Browser가 Server의 Session을 찾는 식별자를 보낸다 |
| Cookie의 `Secure` | 해당 Cookie를 HTTPS 연결에 보내도록 제한한다 |
| Cookie의 `HttpOnly` | JavaScript가 Cookie 값을 직접 읽지 못하게 한다 |
| Cookie의 `SameSite` | Cross-site 상황의 Cookie 전송을 제한한다 |
| CSRF Token Header | JavaScript가 받은 Token을 상태 변경 요청에 명시적으로 붙인다 |
| Spring Security의 Authorization | 인증된 사용자가 요청한 작업을 할 수 있는지 결정한다 |

UI와 API를 같은 Origin에서 제공하면 그 요청에는 CORS 허용 처리가 필요하지 않다. 그래도 Cookie 기반 인증의 상태 변경에는 CSRF 방어가 필요하다. SameSite도 CSRF 검증을 무조건 생략하게 하는 설정은 아니다.

Cookie 속성의 설정과 실제 Browser가 전송하는 결과를 함께 확인한다. 값은 기록하지 않는다. App을 새 JVM으로 교체하면 메모리의 `HttpSession`은 사라질 수 있지만, 같은 RDS에 Commit한 Ticket까지 지워지는 것은 아니다. 기존 Session 수명은 [Docker와 Session 자료](./docker-image-container-compose-volume.md#app-재시작-뒤-cookie가-있어도-로그인해야-하는-이유)에서 이어진다.

## 핵심 질문

1. App에서 RDS로 연결이 Timeout이라면 IAM Role에 관리자 권한을 주는 것이 해결책인가? 어떤 경로와 조건부터 확인해야 하는가?
2. 서비스 CNAME과 ACM 검증 CNAME은 각각 무엇을 위한 Record인가? DNS-only에서는 Cloudflare가 로그인 요청을 받는가?
3. Browser→ALB가 HTTPS이고 ALB→App이 HTTP라면 어디에서 TLS가 종료되는가? HTTPS가 USER·AGENT 권한과 CSRF 검사를 대신하는가?

## 핵심 질문 해설

1. **권한 확대부터 하지 않는다.** 목적지 이름·Port, VPC 경로, App Outbound·DB Inbound와 DB 준비 상태를 먼저 확인한다. 연결 뒤의 DB 인증·권한은 다시 구분한다.
2. **서비스 연결과 Domain 검증이다.** DNS-only에서는 Cloudflare가 DNS 조회에 응답하고, HTTP 요청은 Browser에서 ALB로 간다.
3. **ALB에서 종료된다.** App까지의 연결은 별도다. HTTPS는 통신 보호이며, 로그인 인증·작업 인가·CSRF 검증은 Application이 계속 수행한다.

## 함께 읽을 자료

- [Image 전달과 ECS 실행](./image-publishing-and-ecs-execution.md)
- [배포 장애 관찰과 복구](./deployment-observability-and-recovery.md)
