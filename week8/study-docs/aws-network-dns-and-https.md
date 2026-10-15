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

### 학습자 IP와 ipconfig의 주소는 무엇이 다른가

학습자 IP 제한은 **허용한 출발 IP에서만 ALB에 연결하도록 하는 조치**다. Browser가 ALB에 직접 연결하는 IPv4 구성에서는 인터넷에서 보이는 공인 출발 IP를 허용한다. 보통 공유기를 사용하는 PC의 사설 IPv4를 등록하는 것은 아니다.

다음 주소는 설명용 예이며 실제 학습자의 주소가 아니다.

```text
PC의 사설 IPv4           공유기·통신사의 NAT          인터넷의 ALB
192.168.0.10 ──────────> 공인 IPv4 203.0.113.25 ─────> 출발 IP 확인

허용 규칙의 예: TCP 443, Source 203.0.113.25/32
               TCP 80,  Source 203.0.113.25/32
```

NAT는 통신에 사용하는 주소를 변환한다. ALB가 보는 출발 IP는 이 예에서 `192.168.0.10`이 아니라 `203.0.113.25`다. `/32`는 단일 IPv4 주소를 뜻하며, PC 한 대나 사용자 한 명을 식별한다는 뜻은 아니다. [AWS의 단일 IP 허용 규칙](https://docs.aws.amazon.com/vpc/latest/userguide/security-group-rules.html#security-group-rule-components)

`ipconfig`는 PC의 각 Network Adapter에 설정된 IPv4·IPv6·Subnet Mask·Gateway 등을 보여준다. 집이나 회사의 일반적인 공유기 환경에서 보이는 IPv4는 사설 주소인 경우가 많지만, 출력된 모든 주소가 사설 주소라고 단정하지 않는다. 인터넷으로 나갈 때 보이는 공인 출발 IP는 별도로 확인한다. [Microsoft ipconfig 설명](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/ipconfig)

같은 공유기나 회사망의 여러 기기가 같은 공인 IPv4를 공유할 수 있다. 따라서 IP 제한은 접속 범위를 줄이는 방어이고, 로그인·Role 검사를 대체하지 않는다.

학습 장소 이동·모바일 Hotspot·VPN·통신사의 주소 재할당으로 공인 출발 IP가 바뀌면 기존 `/32` 규칙으로 새 연결이 허용되지 않을 수 있다. 이때는 새 출발 IP를 확인하고 승인한 범위에서 ALB의 80·443 규칙을 함께 갱신한다. 접속이 안 된다는 이유로 인터넷 전체를 허용하거나 App·DB의 접근 범위를 넓히지 않는다.

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

AWS에 App을 배포했다고 DNS까지 Route 53으로 옮길 필요는 없다. 기존 Cloudflare DNS에서 서비스 이름을 ALB의 DNS 이름에 연결해 사용할 수 있다.

## App Task만 교체하면 무엇을 바꿔야 할까

**같은 ALB를 유지한다면 서비스 CNAME은 그대로 두고, Target Group에 등록된 App의 주소를 새 Task에 맞춘다.** DNS가 알려주는 대상과 ALB가 요청을 전달하는 대상은 서로 다르다.

| 설정 | 연결하는 대상 | 하는 일 |
|---|---|---|
| Cloudflare의 서비스 CNAME | 서비스 Domain → ALB의 DNS 이름 | Browser가 접속할 ALB를 찾게 한다 |
| ALB의 Listener와 전달 규칙 | HTTPS `443` 요청 → Target Group | ALB가 받은 요청을 어느 Group으로 넘길지 정한다 |
| Target Group의 등록된 Target | Task의 Private IP와 App Port | 실제 요청을 처리할 App의 주소를 지정한다 |

Listener는 요청을 받는 Protocol·Port와 처리 규칙을 갖고, 그 규칙의 전달 대상이 Target Group이다. Fargate의 `ip` Target에는 Task의 Private IP와 `8080` 같은 App Port를 등록한다. [AWS Listener와 Target Group 설명](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-target-groups.html)

다음은 같은 ALB와 Target Group을 유지하면서 App만 교체하는 예다. 주소는 실제 값이 아닌 자리표시자다.

```text
DNS 설정 — 교체 전후 동일
  helpdesk.example.com ── CNAME ──> <ALB_DNS_NAME>

교체 전 요청 경로
  Browser ── HTTPS 443 ──> 같은 ALB ── 같은 Target Group ──> Task A의 Private IP:8080

교체 후 요청 경로
  Browser ── HTTPS 443 ──> 같은 ALB ── 같은 Target Group ──> Task B의 Private IP:8080
                                                              ↑ 등록 대상 갱신
```

새 Task의 IP는 이전과 달라질 수 있으므로 실제 주소를 확인해야 한다. 새 App을 시작했더라도 Target Group에 이전 주소만 남아 있다면, Browser는 ALB를 찾아가도 새 App으로 연결되지 않을 수 있다. 이때 고칠 것은 CNAME이 아니라 Target 등록이다.

### Target 등록은 누가 갱신하는가

- **단독 Task로 실행하는 구성:** 운영자나 배포 Script가 새 Task의 IP·Port 등록과 이전 Target의 등록 해제를 처리한다. Task를 시작했다는 사실만으로 ALB 연결까지 자동으로 만들어지는 것은 아니다.
- **ALB 연결을 설정한 ECS Service 구성:** ECS가 Service의 Task 생성·종료에 따라 Target 등록과 해제를 관리한다. 이 동작에는 ECS의 Service-linked Role이 사용된다. [AWS ECS와 ALB 연동 설명](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/alb.html)

Target 등록 해제와 Task 중지는 별개다. 등록을 해제했다고 JVM이 종료되는 것은 아니므로, 교체할 때는 Target 목록·Health Check와 실제 Task 실행 목록을 각각 확인한다. 새 App의 로그인·문의 조회도 이어서 확인한다.

Task 교체로 새 JVM이 시작되면 이전 JVM 메모리의 `HttpSession`은 이어지지 않는다. 반면 같은 RDS를 사용한다면 이미 Commit한 Ticket·Message·Job은 그대로 조회할 수 있다. **Target 연결을 바꾸는 일, 재로그인하는 일, DB 데이터를 유지하는 일은 각각 다른 문제다.**

ALB 자체를 새로 만들어 DNS 이름도 달라졌다면 서비스 CNAME의 대상을 새 ALB 이름으로 변경해야 한다. App Task만 교체하는 경우와 구분한다. ACM 검증용 CNAME은 App Task의 주소를 가리키는 Record가 아니므로 Task 교체 때문에 바꾸지 않는다.

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

### HTTP Listener에서 Redirect가 일어나는 순서

HTTPS Listener가 있다고 HTTP 요청까지 자동으로 처리되는 것은 아니다. HTTP `80`으로 보낸 연결을 받으려면 해당 Port의 Network 허용과 Listener가 모두 필요하다.

```text
① Browser ── HTTP 80 ──> ALB
   Security Group이 출발 IP·Port 허용 → HTTP Listener가 요청 수신

② ALB ── 301 + Location: https://helpdesk.example.com/tickets.html ──> Browser
   HTTP Listener의 Redirect 규칙 실행

③ Browser ── 새로운 HTTPS 443 요청 ──> ALB ──> Target Group ──> App
```

ALB의 Redirect 규칙에서 목적지 Protocol을 `HTTPS`, Port를 `443`, Status를 `HTTP_301`로 지정할 수 있다. Host·Path·Query를 유지하면 같은 자원의 HTTPS 주소로 이동한다. HTTP Listener는 이 구성에서 App으로 요청을 전달하지 않고 Redirect 응답을 보낸다. [AWS Redirect Action 설명](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/rule-action-types.html#redirect-actions)

Security Group이 80번 연결을 차단하면 HTTP Listener가 요청을 받아 `301`을 반환할 수 없다. 반대로 80번을 허용한 것만으로 Redirect가 생기는 것도 아니므로 Listener의 동작까지 확인한다.

검증할 때는 비밀값이 없는 GET을 사용하고, 자동 Redirect를 끈 HTTP Client에서 첫 응답의 `301`과 `Location`을 확인한다. 이후 해당 HTTPS 주소의 응답을 따로 확인한다. 자동으로 이동한 뒤의 최종 `200`만 보면 중간 Redirect 응답을 놓칠 수 있다.

## App과 RDS 사이의 TLS

Browser가 HTTPS로 접속했다고 App과 DB 사이까지 암호화된 것은 아니다. App은 DB 연결을 시작하는 별도의 Client이며, JDBC Client가 RDS의 서버 인증서를 확인한다.

```text
Browser ── HTTPS ──> ALB ── HTTP ──> App ── DB TLS ──> RDS
             │                                 │
     Browser가 ALB 인증서 확인         JDBC가 RDS 인증서 확인
```

서버 인증서는 접속한 서버의 이름과 공개키 등을 담는다. CA는 인증서를 서명하는 인증기관이고, 신뢰할 Root CA의 공개 인증서는 그 서명을 확인하는 기준이다. 공개 CA 인증서는 Password나 Private Key가 아니므로 검토한 파일을 Image에 포함할 수 있다. 실제 DB 계정의 비밀값과 같은 방법으로 취급하지 않는다. [RDS의 CA와 공개 Bundle](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)

pgJDBC의 `sslmode=verify-full`은 암호화뿐 아니라 인증서 사슬과 접속 Hostname을 확인한다. `sslrootcert`는 신뢰할 CA 파일 위치다. Helpdesk의 실행 명세는 다음 형태로 둘을 지정한다.

```text
jdbc:postgresql://<RDS_ENDPOINT>:5432/<DB_NAME>?sslmode=verify-full&sslrootcert=/app/certs/rds-ca-bundle.pem
```

`sslmode=require`는 pgJDBC에서 암호화를 요구하지만 서버 인증서를 모두 받아들이므로, 서버 신원 검증과 같지 않다. 연결 오류가 나면 CA·Hostname·파일 읽기·서버 설정을 확인하고 검증을 끄지 않는다. TLS 성공 뒤에도 DB 사용자 인증과 SQL 권한 확인이 필요하다. [pgJDBC SSL 모드](https://jdbc.postgresql.org/documentation/ssl/)

CA 파일이 있어도 App 사용자가 읽을 수 없으면 사용할 수 없다. Linux에서는 파일의 읽기 권한과 부모 디렉터리의 통과 권한을 함께 확인한다. Node의 공개 CA 파일 검사와 실제 Image 안의 비Root 읽기를 구분하고, 마지막으로 실제 RDS의 TLS 연결을 확인한다. 공개 파일의 Hash 일치는 파일 전달 확인이지 접속한 DB 서버 검증이 아니다.

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
4. Browser의 HTTPS 자물쇠가 App→RDS 연결도 TLS라는 뜻인가? 두 연결에서 인증서를 확인하는 Client는 누구인가?
5. `sslmode=require`와 `verify-full`의 차이는 무엇이며, 공개 CA 파일과 DB Password는 왜 구분해야 하는가?
6. Cloudflare DNS와 같은 ALB를 유지하면서 App Task만 교체한다면, 서비스 CNAME과 Target Group 중 무엇을 갱신해야 하는가?
7. 새 Task를 시작하면 ALB의 Target 등록도 항상 자동으로 갱신되는가? 단독 Task와 ECS Service는 무엇이 다른가?
8. ALB 자체를 새로 만들어 DNS 이름이 달라졌다면 어떤 Record를 바꿔야 하는가? ACM 검증용 CNAME도 App 주소에 맞춰 바꾸는가?
9. ALB의 학습자 IPv4 제한에는 보통 PC의 사설 주소와 인터넷에서 보이는 공인 출발 주소 중 무엇을 사용하는가? `/32`가 사용자 한 명을 뜻하는가?
10. ALB의 443만 허용한 상태에서 HTTP 80 요청에 `301`을 보낼 수 있는가? 나중에 HTTPS로 이동하면 앞서 HTTP로 보낸 Password도 보호되는가?

## 핵심 질문 해설

1. **권한 확대부터 하지 않는다.** 목적지 이름·Port, VPC 경로, App Outbound·DB Inbound와 DB 준비 상태를 먼저 확인한다. 연결 뒤의 DB 인증·권한은 다시 구분한다.
2. **서비스 연결과 Domain 검증이다.** DNS-only에서는 Cloudflare가 DNS 조회에 응답하고, HTTP 요청은 Browser에서 ALB로 간다.
3. **ALB에서 종료된다.** App까지의 연결은 별도다. HTTPS는 통신 보호이며, 로그인 인증·작업 인가·CSRF 검증은 Application이 계속 수행한다.
4. **별도 연결이다.** Browser는 ALB의 인증서를, App의 JDBC Client는 RDS의 인증서를 확인한다.
5. **암호화와 서버 신원 검증의 차이다.** pgJDBC의 `require`만으로는 서버 신원을 검증하지 않는다. 공개 CA는 서명을 확인할 기준이며 DB Password는 사용자 인증용 비밀값이다.
6. **Target Group의 등록 대상을 새 Task의 실제 IP·Port에 맞춘다.** 서비스 CNAME은 여전히 같은 ALB 이름을 가리키므로 유지한다. DNS를 Route 53으로 옮길 필요도 없다.
7. **항상 자동은 아니다.** 단독 Task는 운영자나 Script가 등록·해제를 처리하고, ALB 연결을 설정한 ECS Service는 ECS가 이를 관리한다.
8. **서비스 CNAME의 대상을 새 ALB의 DNS 이름으로 바꾼다.** ACM 검증용 CNAME은 Domain 검증을 위한 별도 Record이므로 App 주소로 바꾸지 않는다.
9. **ALB가 직접 받는 연결의 공인 출발 IPv4를 사용한다.** `/32`는 단일 주소다. 같은 인터넷 출구를 공유하는 여러 사람이 통과할 수 있으므로 로그인·인가를 계속 적용한다. 출발 주소가 바뀌면 허용 규칙도 다시 확인한다.
10. **둘 다 아니다.** HTTP 연결을 받으려면 80번의 Network 허용과 Listener가 필요하다. Redirect는 새 HTTPS 요청을 안내할 뿐, 이미 보낸 HTTP 요청을 소급해 암호화하지 않는다.

## 함께 읽을 자료

- [Image 전달과 ECS 실행](./image-publishing-and-ecs-execution.md)
- [배포 장애 관찰과 복구](./deployment-observability-and-recovery.md)
