# Docker Image Build와 변경 입력별 Cache 실험

> 실행일: 2026-10-08
> 실행 환경: Local Docker Desktop, Docker Engine 29.8.0, Linux amd64
> 범위: Image Build·입력 무변경 및 Source·의존성·Layer 순서의 Cache 비교·기준선 Image와 JAR 구성 확인

## 실험 목적

JDK와 Maven으로 JAR를 만드는 단계와 JVM으로 JAR를 실행할 환경을 구분한다. 입력이 같을 때와 Java Source 또는 Maven 의존성만 바꿨을 때 어떤 단계가 재사용되는지 비교한다.

## 구성

Lab Repository의 `Dockerfile`은 Java 25 JDK 기반 `build` 단계와 Java 25 JRE 기반 `runtime` 단계로 나눴다. Maven Wrapper·POM을 먼저 복사하고 의존성을 준비한 뒤 Main Source를 복사해 패키징한다. 실행용 단계에는 완성된 JAR만 복사한다. 기반 Image는 Tag와 Digest로 지정했다.

`.dockerignore`는 필요한 입력만 허용한다. `.git`·`target`·Test Source·로컬 실험 자료는 포함하지 않으며, 허용한 디렉터리 안의 `.env`·Key·Credential 파일도 제외한다. Build 전 추적 Main 파일 100개를 대표 Credential Pattern으로 검사했고 해당 Pattern의 발견은 0건이었다.

최종 Image의 실행 사용자는 `10001:10001`, 작업 디렉터리는 `/app`, 시작 명령은 `java -jar /app/helpdesk.jar`다. `EXPOSE 8080`을 지정했지만 Host Port를 게시하거나 Helpdesk Application을 시작하지는 않았다.

## 실행 명령

같은 명령을 입력 변경 없이 두 번 실행했다.

```powershell
docker build --progress=plain --tag helpdesk:week8-build-baseline .
```

Build의 패키징 명령은 다음과 같다.

```text
./mvnw -B -ntp -DskipTests package
```

`-DskipTests`로 Test를 생략했다. 이번 `BUILD SUCCESS`는 Image 패키징의 성공이며 전체 Java Test를 다시 실행한 결과가 아니다.

## Build 결과

| 실행 | 종료 코드 | 소요 시간 | 관찰 |
|---|---:|---:|---|
| 첫 Build | 0 | 68.95초 | 기반 Image·의존성 준비, Source 86개 컴파일과 JAR 패키징 성공 |
| 입력 무변경 재Build | 0 | 1.64초 | 의존성 준비·Source 복사·패키징·실행용 JAR 복사 등이 `CACHED` |

첫 실행에는 기반 Image와 의존성 다운로드도 포함됐다. 시간 차이를 Cache만의 성능으로 환산하지 않고, 실제로 재사용된 단계의 `CACHED`를 함께 확인했다.

## Source와 의존성 변경 비교

Git 제외 `target/` 아래에 별도 Build Context를 만들었다. Dockerfile·dockerignore·POM·Maven Wrapper와 추적 Main 파일만 복사한 105개 입력을 사용했다. 먼저 복사본의 입력을 바꾸지 않고 Build해 기존 의존성 준비와 패키징 Cache가 재사용되는 것을 확인했다.

Source 변경 실험에서는 복사본의 `HelpdeskApplication.java`에 동작을 바꾸지 않는 주석 한 줄만 추가했다. 의존성 변경 실험에서는 그 주석을 원래대로 되돌리고 복사본 POM에 `org.apache.commons:commons-text:1.14.0`을 추가했다. 따라서 두 실험은 각각 기준선에 대해 한 종류의 입력만 변경했다. 실제 Lab Source와 POM은 실험 전후 SHA-256이 같았다.

각 Context 상태에서 다음 명령을 실행했다. 마지막 `.`은 해당 복사본의 Context다.

```powershell
# 입력 무변경 복사본
docker build --progress=plain --tag helpdesk:week8-cache-copy-baseline .

# Source 주석만 변경
docker build --progress=plain --tag helpdesk:week8-cache-source-change .

# Source는 기준선과 같고 POM에 실험용 의존성만 추가
docker build --progress=plain --tag helpdesk:week8-cache-dependency-change .
```

| 변경 입력 | 종료 코드 | 소요 시간 | 의존성 준비 `RUN` | 패키징 `RUN` |
|---|---:|---:|---|---|
| 복사본, 변경 없음 | 0 | 5.37초 | `CACHED` | `CACHED` |
| Java Source 주석 한 줄 | 0 | 10.75초 | `CACHED` | 다시 실행, `BUILD SUCCESS` |
| POM에 의존성 추가 | 0 | 59.24초 | 다시 실행, `BUILD SUCCESS` | 다시 실행, `BUILD SUCCESS` |

Source만 바꾸면 `COPY src/main`부터 달라지며 앞의 의존성 준비 결과는 재사용됐다. 주석이라 업무 동작은 같아도 파일 내용이 바뀌었으므로 패키징은 다시 수행했다. POM 변경에서는 해당 `COPY` 이후 두 Maven 명령을 모두 다시 실행했고, Log에 `commons-text-1.14.0.jar`의 의존성 준비가 기록됐다. 이 의존성은 실험 복사본에만 추가했다.

POM 변경 Build의 의존성 준비 단계는 47.0초였다. 이번 Dockerfile에서는 그 단계의 다운로드 결과도 해당 Build Layer에 보관한다. 이 Layer가 재사용되지 않으면 필요한 파일의 다운로드·준비가 다시 수행될 수 있다. 전체 소요 시간에는 Network·패키징·Image 내보내기도 포함되므로, Cache 사용 여부는 해당 단계의 Log로 판정했다. [Docker Cache 무효화 기준](https://docs.docker.com/build/cache/invalidation/)

## Source 복사 순서 비교

새 Git 제외 복사본에서 POM과 Source는 원래대로 두고, Dockerfile의 `COPY src/main`만 의존성 준비 앞에 옮겼다. 먼저 변경한 순서로 Build를 완료한 뒤, 앞선 Source 실험과 같은 주석 한 줄을 추가해 다시 Build했다.

```dockerfile
COPY pom.xml ./pom.xml
COPY src/main ./src/main
RUN ./mvnw -B -ntp dependency:go-offline
RUN ./mvnw -B -ntp -DskipTests package
```

각 상태의 복사본 Context에서 다음 명령을 실행했다.

```powershell
# Source를 먼저 복사하는 순서의 기준선
docker build --progress=plain --tag helpdesk:week8-source-first-baseline .

# 같은 순서에서 Source 주석만 변경
docker build --progress=plain --tag helpdesk:week8-source-first-change .
```

| 실행 | 종료 코드 | 소요 시간 | 의존성 준비 `RUN` | 패키징 `RUN` |
|---|---:|---:|---|---|
| Source를 먼저 복사하는 순서의 첫 Build | 0 | 57.96초 | 다시 실행, `BUILD SUCCESS` | 다시 실행, `BUILD SUCCESS` |
| 같은 순서에서 Source 주석만 변경 | 0 | 63.64초 | 다시 실행, `BUILD SUCCESS` | 다시 실행, `BUILD SUCCESS` |

주석 변경 뒤에도 POM과 Wrapper 복사는 `CACHED`였지만, Source 복사부터 바뀌어 뒤의 의존성 준비까지 다시 수행됐다. 의존성 준비 단계는 47.0초였다. 원래 순서의 Source 변경 실험에서는 같은 의존성 준비가 `CACHED`였으므로, Source를 어느 위치에 복사하는지가 재사용 범위를 바꾼다는 점을 확인했다.

두 순서 모두 컴파일과 패키징에 성공했다. 의존성을 먼저 준비하는 순서는 올바른 Build를 위한 필수 순서가 아니라 Cache를 재사용하기 위한 선택이다. 실행 시간이 달라지는 데는 다운로드·실행 환경도 영향을 주므로 두 순서의 고정 성능 비율을 계산하지 않았다. 실제 Lab의 Dockerfile·Source·POM은 실험 전후 SHA-256이 같았고, 원래의 의존성 우선 순서를 유지했다.

## 기준선 Image의 실행 환경과 JAR 확인

Network와 쓰기를 제한한 일회용 점검 Container에서 Java 버전과 JAR의 존재를 확인했다. `java --version`은 Temurin 25.0.4.1을 반환했다. `mvn`과 `javac` 명령, Build 단계의 Maven Wrapper와 App Source 디렉터리는 없었다. 이 점검은 Helpdesk의 시작 명령 대신 별도 검사 명령을 사용했다.

별도의 중지 상태 점검 Container에서 JAR를 복사해 Entry 이름을 검사했다. 점검 Container는 확인 뒤 제거했으며 기존 Container와 DB는 변경하지 않았다.

| JAR 확인 항목 | 결과 |
|---|---:|
| `HelpdeskApplication.class` | 존재 |
| `Ticket.class` | 존재 |
| Application Class Entry | 114개 |
| 의존성 JAR | 92개 |
| Migration SQL | 7개 |
| Java Source Entry | 0개 |
| Maven Wrapper Entry | 0개 |
| `META-INF/maven` Metadata | 존재 |

Maven Metadata가 있다는 것은 Maven 프로그램이 JAR 안에 있다는 뜻이 아니다. Maven은 Build 도구이고, 완성된 Class를 실행하는 주체는 JVM이다. Migration SQL이 JAR에 있다는 것 역시 PostgreSQL에 적용됐다는 뜻은 아니다.

## 확인한 범위와 다음 실험

다음 표는 Image Build·Cache 비교에서 직접 확인한 범위다. 이후 실행한 HTTP·DB 결과는 [Compose 실험 보고서](./2026-10-08-compose-http-postgresql-baseline.md)에 따로 기록한다.

| 항목 | 상태 |
|---|---|
| 첫 Image Build와 입력 무변경 Cache | 실행·확인 |
| 최종 Image의 실행 설정과 JAR 구성 | 실행·확인 |
| Source 변경 뒤 Cache 비교 | 실행·확인, 의존성 준비 재사용·패키징 재실행 |
| 의존성 변경 뒤 Cache 비교 | 실행·확인, 의존성 준비·패키징 모두 재실행 |
| Layer 순서 변경 비교 | 실행·확인, Source 복사를 앞에 두면 Source 변경 시 두 Maven 명령 재실행 |
| Helpdesk Application 기동·HTTP 요청 | `NOT_RUN` |
| Compose PostgreSQL 접수·조회·Migration 적용 | `NOT_RUN` |
| DB Container 교체와 Volume 보존 | `NOT_RUN` |
| 이번 변경 뒤 전체 Java·JavaScript 회귀 | `NOT_RUN` |

입력 무변경·Source·의존성·복사 순서의 Cache 비교를 마쳤다. 이 Build 비교에서는 Test를 생략했고 Helpdesk Application은 시작하지 않았다. 이후 별도 Compose 실험에서 App 기동·Migration·접수·조회, DB 교체 후 Row·App Session 유지와 App 재시작 후 Row 보존·재로그인을 확인했다.

## 관련 자료

- [Docker Image와 Container 그리고 Compose와 Volume](../study-docs/docker-image-container-compose-volume.md)
- [Week 8 학습 계획](../weekly-plan.md)
