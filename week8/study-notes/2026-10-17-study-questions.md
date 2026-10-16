# 10월 17일 — 접속 도구의 버전과 실행 중 메모리 구분

## psql을 맞추는 것과 RDS를 변경하는 것은 다르다

이번에는 RDS를 그대로 두고 관리용 psql만 17.11로 맞췄다. psql은 내가 SQL을 입력하는 Client이고, PostgreSQL 17.11은 RDS 서버 프로그램이며, V8은 Helpdesk의 Schema 변경 이력이다. 같은 버전 번호 체계가 아니다.

Private CloudShell의 인터넷을 열거나 DB를 공개하는 대신, 로컬에서 공식 Client만 준비해 별도 경로에서 사용했다. 기본 psql 16.15도 남아 있다. 파일 준비 후 실제 Password 입력은 내가 직접 했고, Client 17.11·서버 17.11·TLS 1.3과 `\d` 실행을 확인했다. 기존 일곱 Table의 건수와 Hash도 같았다.

CloudShell VPC 세션은 영구 작업 공간이 아니다. 세션이 끝나면 임시 Client·CA·PATH를 다시 준비해야 한다. 암호를 스크립트에 적어 자동 로그인시키는 방식과는 구분한다. [실행 보고서](../lab-reports/2026-10-17-cloudshell-psql17.md)

## 다음으로 구분할 메모리 숫자

Codex가 같은 로컬 JVM에서 Process와 Container의 수치를 비교했다. VmSize는 약 3.34 GiB, VmRSS는 약 197 MiB, Container의 memory.current는 약 238 MiB였고 상한은 512 MiB였다.

VmSize는 가상 주소 공간이므로 전부 실제 RAM에 올라와 있다는 뜻은 아니다. JVM RSS는 Process의 상주 메모리이며 Container 전체 사용량도 아니다. 지금의 사용량이 낮다는 사실만으로 개인정보 모델과 AI 처리를 추가한 구성의 Peak까지 확인한 것은 아니다. 이 구분을 다음 문답에서 직접 설명해 볼 예정이다.

합성 요청의 시작 Marker는 Log Pipeline에서 1개였고 실제 응답도 별도로 200을 확인했다. 시작 기록을 찾는 것과 요청 완료·DB 저장·AI 성공의 확인은 서로 다르다. DB와 AI는 이번 로컬 실험에 포함하지 않았다. [관찰 보고서](../lab-reports/2026-10-17-proc-cgroup-log-pipeline.md)

## 핵심 질문

1. psql만 17로 바꿨을 때 App의 JDBC Driver·RDS Engine·Flyway V8도 바뀌는가?
2. 새 CloudShell 세션에서 CA 파일이 없어졌다면 TLS 검증을 끄는 대신 무엇을 다시 준비해야 하는가?
3. VmSize가 512 MiB보다 큰 것만으로 Container의 실제 메모리 상한 초과를 단정할 수 있는가?
4. JVM의 VmRSS와 Container의 memory.current가 다른 이유는 무엇인가?
5. 시작 Marker 1개만으로 요청 완료·DB 저장까지 판단할 수 있는가?

psql 전환과 재접속 정리는 마쳤다. 전체 AI 조립·관계 보존 마스킹·Cloud AI 실행·전체 자원 측정과 남은 관측·최종 회귀·WIL은 완료한 것으로 바꾸지 않는다.
