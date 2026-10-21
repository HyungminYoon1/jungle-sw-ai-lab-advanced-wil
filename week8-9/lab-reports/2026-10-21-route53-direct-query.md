# Route 53 실습 Zone과 DNS 조회 비교

> 상태: 실습 완료. Public Hosted Zone 한 개와 TXT·Alias A를 생성하고 직접 조회와 일반 DNS 조회를 비교했다. Cloudflare 위임과 기존 서비스는 유지했다.
> 실제 실행일: 2026-10-21 KST
> 기록 정리일: 2026-10-22 KST

## 실습 목적

Route 53에 Record를 만드는 것과 인터넷의 일반 DNS 조회가 그 Record에 도달하는 것은 다르다. 기존 `hmyoon.com`의 DNS는 Cloudflare에 둔 채, 별도 `dns-lab.hmyoon.com` Zone의 권한 서버에 직접 질의해 차이를 확인했다.

## 생성한 대상

| 대상 | 저장한 설정 |
|---|---|
| Public Hosted Zone | `dns-lab.hmyoon.com`, ID `Z079404317QHM5M3AEG4Y` |
| TXT | `proof.dns-lab.hmyoon.com`, 값 `route53-direct-query`, TTL 60초 |
| Alias A | `dns-lab.hmyoon.com` → 기존 학습 ALB. Evaluate Target Health는 false |
| 전체 Record 수 | AWS가 만든 NS·SOA 두 개와 실습 Record 두 개, 총 4개 |

Alias 변경 상태는 `INSYNC`였고 저장된 대상도 기존 ALB와 일치했다. 새 서비스나 인증서는 만들지 않았다.

## 조회 결과

| 조회 방법 | 관찰 결과 | 의미 |
|---|---|---|
| Route 53 권한 서버에 TXT 직접 질의 | `route53-direct-query` 반환 | 새 Zone에 TXT가 저장돼 있다. |
| 같은 권한 서버에 Alias A 직접 질의 | ALB의 IPv4 응답 | 새 Zone의 Alias가 응답한다. |
| 일반 Resolver에 TXT 질의 | `NXDOMAIN` | 부모 Cloudflare에 하위 Zone NS를 위임하지 않아 일반 조회가 새 Zone으로 이어지지 않는다. |

Cloudflare의 부모 NS와 `helpdesk.hmyoon.com` 서비스 CNAME은 변경 전과 같았다. 새 Alias의 DNS 응답은 `dns-lab.hmyoon.com`의 HTTPS 성공을 뜻하지 않는다. 기존 인증서는 `helpdesk.hmyoon.com`용이며, 이번 실습은 DNS 조회까지다.

## 권한 적용과 회수

서울 외 요청을 거부하는 Foundation 정책에서 필요한 글로벌 Route 53 Action만 예외로 분리했다. 이 예외 자체가 Allow는 아니므로 별도 DNS 정책에 MFA·글로벌 API Region 조건과 생성/조회 범위를 두었다. ECS·RDS·ALB의 서울 제한은 유지했다.

Zone 생성 직후 임시 생성 권한을 회수했다. 최종 Foundation은 Version 3, DNS 정책은 Version 2이며 `CreateHostedZone`을 별도 Allow와 지역 거부의 예외 양쪽에서 제거했다. 이전 Version은 보존했다. Record 생성은 지정 Zone의 위 두 이름·유형에 대한 `CREATE`만 허용하며 `UPSERT`·`DELETE`와 NS/SOA 변경은 허용하지 않는다.

AWS 편집기의 보안·오류·경고·추천은 모두 0이었고 저장된 정책 전체 JSON을 승인안과 대조했다. 비Root MFA 세션에서 생성·조회를 실행했다. 권한 회수는 저장 JSON으로 확인했으며 추가 Zone 생성 시도를 한 것은 아니다.

첫 생성 직후 상세 조회가 거부됐을 때는 목록의 새 Zone ID를 확인하고 같은 Zone을 다시 만들지 않았다. 이후 지정 Zone 조회 권한을 적용해 Record를 생성했다. Console의 부가 조회 오류와 실제 생성 결과를 구분한 사례다.

## 보관 상태와 근거

실습 Zone과 Record는 남아 있다. 조회 실습을 마쳤다고 자동 삭제하지 않으며, 보관·정리는 다음 회차에 별도 확인한다. Cloudflare NS·기존 서비스 CNAME·App·RDS·Secret과 기존 실행 Role은 이번 DNS 실습에서 변경하지 않았다.

- Lab 구현 기록: `b7a799a`, `deploy/iam/README.md`의 Route 53 두 단계 권한과 실행 결과
- Git 제외 근거: `local/evidence/2026-10-21-deployment-closeout/`의 `dns-lab-completed.json`, `dns-query-results.json`, `phase2-verification.json`과 정책/화면 대조 기록
- 개념과 다음 학습: [10월 21일 학습노트](../study-notes/2026-10-21-study-questions.md)
