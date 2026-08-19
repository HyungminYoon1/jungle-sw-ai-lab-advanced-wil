# Learning Note — Maven 빌드와 Maven Wrapper

> 작성일: 2026-08-19
> 주차: Week 1
> 학습 주제: Maven의 프로젝트 모델, 빌드 생명주기와 Gradle 비교

## 핵심 질문

> Maven은 Java 프로젝트의 소스 코드, 의존성, 테스트와 빌드 결과물을 어떤 규칙으로 관리하며 Maven Wrapper는 왜 필요한가?

## 한 문장 설명

Maven은 `pom.xml`에 선언한 프로젝트 정보와 표준 디렉터리 구조를 바탕으로, 미리 정의된 빌드 생명주기의 단계에 Plugin 작업을 연결해 컴파일·테스트·패키징·배포를 일관되게 수행하는 빌드 관리 도구다.

## Maven이 담당하는 일

Java 소스 파일은 JDK의 `javac`로 직접 컴파일할 수 있다. 하지만 실제 프로젝트에서는 컴파일 외에도 다음 작업을 반복해서 수행해야 한다.

- 외부 Library와 Test Framework의 Version을 선언하고 내려받기
- Main Source와 Test Source를 정해진 Classpath로 컴파일하기
- Unit Test를 실행하고 실패하면 Build를 중단하기
- Class와 Resource를 JAR 또는 WAR 같은 배포 가능한 산출물로 묶기
- 여러 개발 환경과 CI에서 같은 순서와 설정으로 Build하기
- 완성된 산출물을 Local 또는 Remote Repository에 게시하기

Maven은 이러한 작업을 프로젝트마다 처음부터 Script로 작성하게 하기보다 POM, 표준 디렉터리 구조, Build Lifecycle과 Plugin이라는 공통 모델로 관리한다. Maven이 JDK를 대체하는 것은 아니다. Maven이 Build의 순서와 설정을 조정하고, 실제 Java Compile은 JDK를 사용하는 Compiler Plugin이 수행한다.

## Maven의 핵심 구성 요소

| 구성 요소 | 의미 | 역할 |
|---|---|---|
| Project | Maven이 Build하고 관리하는 작업 단위 | Source, Test, Dependency와 산출물을 하나의 모델로 묶음 |
| POM | Project Object Model | 프로젝트 식별 정보, Dependency, Plugin과 Build 설정 선언 |
| Artifact | Build하거나 Repository에서 가져오는 산출물 | JAR, WAR, POM 등의 배포·의존 단위 |
| Repository | Artifact를 저장하고 조회하는 장소 | Dependency 다운로드와 완성된 Artifact 게시 |
| Lifecycle | Build가 진행되는 표준 단계의 순서 | 검증, Compile, Test, Packaging과 배포 흐름 정의 |
| Phase | Lifecycle 안의 한 단계 | `compile`, `test`, `package` 등 Build 시점 표현 |
| Plugin | Maven이 실제 작업을 수행하도록 기능을 제공하는 확장 | Compile, Test 실행, JAR 생성 등의 Goal 제공 |
| Goal | Plugin이 제공하는 구체적인 작업 | `compiler:compile`, `surefire:test`, `jar:jar` 등 |

핵심은 **Phase가 작업의 시점을 나타내고, Goal이 실제 작업을 수행한다**는 점이다. Maven은 Project의 Packaging Type과 POM 설정에 따라 적절한 Plugin Goal을 Lifecycle Phase에 연결한다.

## `pom.xml`

`pom.xml`은 Maven Project의 중심 설정 파일이다. Maven은 명령을 실행할 때 현재 디렉터리의 POM을 읽고 Project 정보와 Build 설정을 결정한다.

### 주요 정보

| POM 요소 | 의미 |
|---|---|
| `modelVersion` | POM Model의 Version |
| `groupId` | Project를 소유하거나 구분하는 조직·그룹 식별자 |
| `artifactId` | 해당 Project 또는 산출물의 이름 |
| `version` | 산출물의 Version |
| `packaging` | 만들 산출물의 유형이며 생략하면 기본값은 `jar` |
| `properties` | Java Release나 문자 Encoding처럼 재사용할 설정값 |
| `dependencies` | Project Code와 Test가 사용하는 외부 Artifact |
| `build` | Plugin, Resource와 Build 동작 설정 |

`groupId`, `artifactId`, `version`을 합친 값을 좌표(Coordinates)라고 부른다. 예를 들어 다음 Project의 좌표는 `lab.helpdesk:ticket-domain:1.0.0`이다.

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>

    <groupId>lab.helpdesk</groupId>
    <artifactId>ticket-domain</artifactId>
    <version>1.0.0</version>
</project>
```

좌표는 이름이 같은 Artifact를 구별하고, 다른 Project가 특정 Version의 Artifact를 Dependency로 참조할 수 있게 한다.

## Maven Artifact와 Packaging — JAR, WAR, POM

Artifact는 Maven이 좌표로 식별하여 Build하거나 Repository에 저장하는 결과물이다. JAR와 WAR 같은 Binary Archive뿐 아니라 Project 정보를 담은 POM도 Artifact가 될 수 있다.

Packaging은 Project가 만들어 낼 주 Artifact의 유형과 Lifecycle Phase에 기본으로 연결할 Plugin Goal을 결정하는 POM 설정이다. 예를 들어 `jar` Packaging에서는 `package` Phase에 `jar:jar` Goal이, `war` Packaging에서는 `war:war` Goal이 기본으로 연결된다.

| Packaging | 전체 이름 | 주로 포함하는 내용 | 대표 용도 | `package` Phase의 주 결과 |
|---|---|---|---|---|
| `jar` | Java Archive | Compile된 Java Class, Resource와 Metadata | Java Library 또는 Application 배포 | `.jar` File |
| `war` | Web Application Archive | Web Resource, Web Application Class와 Dependency | Servlet 기반 Web Application 배포 | `.war` File |
| `pom` | Project Object Model | Project 관계와 Build·Dependency Metadata | Parent, Multi-Module Aggregator와 BOM | POM 자체 |

### JAR

JAR는 ZIP 형식을 기반으로 여러 File을 하나로 묶는 Java Archive 형식이다. 일반적으로 다음 내용을 포함할 수 있다.

```text
ticket-domain.jar
├── META-INF/
│   └── MANIFEST.MF
└── lab/
    └── helpdesk/
        └── ticket/
            ├── Ticket.class
            └── TicketStatus.class
```

- Compile된 `.class` File
- 설정, Image와 Message File 등의 Resource
- Archive와 실행 정보를 담는 선택적 `META-INF/MANIFEST.MF`

JAR는 다른 Project가 사용하는 Library가 될 수도 있고 독립 Application을 담을 수도 있다. 하지만 JAR 형식이라고 해서 자동으로 실행 가능한 것은 아니다. `java -jar`로 실행하려면 일반적으로 Manifest에 진입점인 `Main-Class`가 있어야 하며, 실행에 필요한 Dependency를 Classpath에서 찾을 수 있어야 한다.

Maven에서 `<packaging>`을 생략하면 기본값은 `jar`다. 이 경우 `package` Phase에 Maven JAR Plugin의 `jar:jar` Goal이 연결되어 Compile 결과와 Resource를 JAR로 묶는다.

### WAR

WAR는 Servlet 기반 Java Web Application을 배포하기 위한 Web Application Archive다. Maven WAR Plugin은 Web Resource, Compile된 Class와 필요한 Dependency를 모아 WAR를 만든다.

일반적인 WAR 내부 구조는 다음과 같다.

```text
helpdesk.war
├── index.html
└── WEB-INF/
    ├── classes/    # Compile된 Application Class와 Resource
    ├── lib/        # Application이 사용하는 Library JAR
    └── web.xml     # 필요한 경우 사용하는 배포 Descriptor
```

WAR는 보통 Servlet Container가 구조를 해석하고 Web Application으로 실행하도록 전달하는 배포 단위다. `web.xml`은 Servlet Version과 구성 방식에 따라 필수가 아닐 수 있다.

Maven에서 `<packaging>war</packaging>`을 선언하면 `package` Phase에 Maven WAR Plugin의 `war:war` Goal이 기본으로 연결된다. 따라서 Packaging은 단순히 File 확장자를 바꾸는 값이 아니라 Build Lifecycle의 기본 동작도 함께 선택한다.

### POM

POM은 사용되는 문맥에 따라 다음 세 가지 모습으로 나타난다. 모두 Project Object Model이라는 같은 개념에 기반한다.

| 표현 | 의미 |
|---|---|
| Project Root의 `pom.xml` | 개발자가 Project 정보와 Build 설정을 작성하는 원본 문서 |
| `<packaging>pom</packaging>` | Binary Archive보다 Project 관계와 공통 Metadata 제공을 주목적으로 하는 Project 유형 |
| Repository의 `artifactId-version.pom` | 다른 Project가 좌표, Dependency와 상속 정보를 해석할 때 사용하는 POM Artifact |

`pom` Packaging의 대표 용도는 다음과 같다.

- Parent POM: 여러 Child Project가 공통 Version, Property, Dependency와 Plugin 설정을 상속받게 한다.
- Aggregator POM: `modules`에 여러 Project를 등록하여 하나의 Build에서 함께 처리한다.
- BOM(Bill of Materials): `dependencyManagement`를 이용해 관련 Dependency Version의 기준을 제공한다.

Parent와 Aggregator는 흔히 하나의 POM이 함께 담당하지만 서로 다른 책임이다. Parent는 설정을 상속시키고, Aggregator는 함께 Build할 Module을 모은다.

`pom` Packaging은 일반적으로 실행할 Java Class를 담은 JAR나 Web Application WAR를 만들지 않는다. POM Metadata 자체가 주 Artifact이며, Parent·Aggregator·BOM 같은 Project 관계를 표현하는 데 사용된다.

### Binary Artifact와 POM Metadata의 관계

JAR 또는 WAR를 Repository에 `install`하거나 `deploy`하면 해당 Binary Artifact와 Project의 POM Metadata가 같은 좌표 아래에서 함께 관리된다.

```text
lab/helpdesk/ticket-domain/1.0.0/
├── ticket-domain-1.0.0.jar
└── ticket-domain-1.0.0.pom
```

다른 Project가 JAR를 Dependency로 선언하면 Maven은 함께 저장된 POM을 읽어 그 JAR가 필요로 하는 전이 Dependency와 기타 Project 정보를 해석한다. 따라서 JAR는 실제 Code와 Resource를 제공하고, POM은 해당 Artifact를 어떻게 식별하고 사용해야 하는지 설명하는 Metadata를 제공한다.

## Convention over Configuration과 표준 디렉터리 구조

Maven은 자주 사용하는 Project 구조와 Build 동작에 기본값을 제공한다. 이처럼 Convention을 따르면 설정을 반복하지 않아도 되고, 처음 보는 Maven Project도 Source와 Test의 위치를 쉽게 예측할 수 있다.

```text
project-root/
├── pom.xml
├── src/
│   ├── main/
│   │   ├── java/
│   │   └── resources/
│   └── test/
│       ├── java/
│       └── resources/
└── target/
```

| 경로 | 용도 |
|---|---|
| `src/main/java` | Application 또는 Library의 Java Source |
| `src/main/resources` | Main Source가 사용하는 설정·Resource |
| `src/test/java` | Test Source |
| `src/test/resources` | Test가 사용하는 Resource |
| `target` | Compile 결과, Test Report와 Package 등 Build 산출물 |

다른 구조도 POM에서 설정할 수 있지만, 특별한 이유 없이 표준 구조를 바꾸면 설정량과 Project 이해 비용이 늘어난다.

## Dependency와 Plugin의 차이

Dependency와 Plugin은 모두 Artifact Repository에서 받아올 수 있지만 사용 목적이 다르다.

| 구분 | Dependency | Plugin |
|---|---|---|
| 누구를 위한 것인가 | Project의 Main Code 또는 Test Code | Build Process |
| 하는 일 | Compile·실행·Test에 필요한 Class와 API 제공 | Compile, Test 실행, Packaging 같은 Build 작업 수행 |
| POM 위치 | `dependencies` | `build/plugins` |
| 대표 개념 | Scope, 전이 Dependency, Version 충돌 | Goal, Phase Binding, Plugin 설정 |
| 예시 | JUnit, Database Driver, Logging Library | Compiler, Surefire, JAR Plugin |

JUnit은 Test Code가 사용하는 API이므로 Dependency다. 반면 Surefire Plugin은 작성된 Test를 Maven의 `test` Phase에서 찾아 실행하므로 Plugin이다.

### Dependency Scope

Scope는 Dependency가 어느 Classpath와 시점에 필요한지를 나타낸다.

| Scope | 의미 |
|---|---|
| `compile` | Main Source Compile부터 실행까지 사용되는 기본 Scope |
| `runtime` | Compile에는 필요 없지만 실행할 때 필요 |
| `test` | Test Compile과 실행에만 사용되며 배포 산출물의 일반 실행 Classpath에는 포함되지 않음 |
| `provided` | Compile에는 필요하지만 실행 환경이 제공한다고 가정 |

Maven은 직접 선언한 Dependency가 필요로 하는 다른 Dependency도 전이적으로 해석한다. 따라서 Project가 실제로 사용할 Version을 이해하려면 직접 선언뿐 아니라 전체 Dependency Tree를 함께 봐야 한다.

## Maven Build Lifecycle

Maven에는 세 가지 내장 Lifecycle이 있다.

| Lifecycle | 목적 |
|---|---|
| `default` | Project 검증, Compile, Test, Packaging과 게시 |
| `clean` | 이전 Build 산출물 제거 |
| `site` | Project 정보와 Report를 담은 Site 생성 |

`clean`은 `default` Lifecycle의 첫 Phase가 아니라 별도의 Lifecycle이다. 따라서 `mvn clean package`는 `clean` Lifecycle을 실행한 뒤 `default` Lifecycle의 `package`까지 실행한다.

### 주요 `default` Lifecycle Phase

| Phase | 의미 |
|---|---|
| `validate` | POM과 Project 정보가 Build 가능한지 확인 |
| `compile` | Main Source Compile |
| `test` | Unit Test 실행 |
| `package` | Compile 결과를 JAR, WAR 같은 배포 형식으로 묶음 |
| `verify` | Integration Test 결과나 추가 품질 기준 확인 |
| `install` | Artifact를 Local Repository에 저장하여 다른 Local Project가 사용할 수 있게 함 |
| `deploy` | Artifact를 Remote Repository에 게시하여 다른 개발자나 환경과 공유 |

Maven에서 특정 Phase를 요청하면 같은 Lifecycle에서 그 Phase 이전의 단계도 순서대로 실행한다.

```text
mvn test
validate → compile → test에 필요한 선행 단계 → test

mvn package
validate → compile → test → package에 필요한 선행 단계 → package

mvn verify
validate → compile → test → package → verify에 필요한 선행 단계 → verify
```

위 화살표는 핵심 Phase를 단순화해 표현한 것이다. 실제 `default` Lifecycle에는 Resource 처리, Test Source Compile, Integration Test 준비와 같은 중간 Phase가 더 있다.

### Phase와 Goal 직접 호출

다음 두 명령은 관점이 다르다.

```text
mvn package
mvn compiler:compile
```

- `mvn package`는 Lifecycle Phase를 요청하므로 `package`까지의 선행 Phase가 실행된다.
- `mvn compiler:compile`은 Compiler Plugin의 특정 Goal을 직접 요청한다.

일반적인 Build에서는 Phase를 호출해 전체 Build 흐름을 유지하고, 특정 Plugin 기능만 독립적으로 사용할 이유가 있을 때 Goal을 직접 호출한다.

## Maven Wrapper

Maven Wrapper는 Project가 지정한 Maven Version을 사용해 Build를 시작하도록 돕는 실행 진입점이다. 개발자가 각자 전역 Maven을 설치하고 Version을 맞추는 대신, Project에 포함된 Wrapper Script로 Build를 실행한다.

| 파일 | 역할 |
|---|---|
| `mvnw` | Linux와 macOS 등 POSIX Shell 환경에서 사용하는 실행 Script |
| `mvnw.cmd` | Windows Command Prompt와 PowerShell에서 사용하는 실행 Script |
| `.mvn/wrapper/maven-wrapper.properties` | 내려받아 사용할 Maven Distribution의 URL과 검증 정보 등 Wrapper 설정 |

실행 흐름은 다음과 같다.

```text
mvnw 또는 mvnw.cmd 실행
        ↓
maven-wrapper.properties 확인
        ↓
지정한 Maven Distribution이 없으면 다운로드
        ↓
해당 Maven으로 pom.xml 해석
        ↓
요청한 Phase 또는 Goal 실행
```

Wrapper 관련 파일을 Version Control에 함께 저장하면 개발자와 CI가 동일한 Maven Version으로 Build를 시작할 수 있다.

### POM, Wrapper와 JDK의 책임 구분

| 대상 | 고정하거나 정의하는 것 | 정의하지 않는 것 |
|---|---|---|
| `pom.xml` | Project 정보, Dependency, Plugin, Java Compile 목표와 Build 동작 | Maven 실행 파일 자체의 설치 |
| Maven Wrapper | 사용할 Maven Distribution과 실행 방식 | JDK 설치 자체 |
| JDK | Java Compiler와 JVM 제공 | Project Dependency와 Maven Lifecycle |

Wrapper가 Maven Version을 맞춰 주더라도 Maven을 실행할 호환 JDK는 환경에 별도로 준비되어야 한다. 또한 POM에 Java Release를 선언하는 것과 해당 JDK가 실제로 설치되어 있는 것은 서로 다른 문제다.

## Java `package`와 Maven `package`의 차이

같은 단어를 사용하지만 의미가 전혀 다르다.

| 용어 | 의미 | 예시 |
|---|---|---|
| Java Package | Class와 Interface의 Namespace를 구성하는 언어 개념 | `package lab.helpdesk.ticket;` |
| Maven `package` Phase | Compile된 Code를 JAR·WAR 등의 Artifact로 만드는 Build 단계 | `mvn package` |

Java Package는 Source Code의 이름 공간과 접근 구조를 다루고, Maven `package`는 Build 결과물을 묶는 시점을 나타낸다.

## Maven과 Gradle의 공통점

Maven과 Gradle은 모두 JVM Project에서 널리 사용하는 Build Automation 도구이며 다음 기능을 제공한다.

- Project Source Compile과 Test 실행
- 외부 Repository를 통한 Dependency 해석
- JAR, WAR 등의 Artifact 생성
- Plugin을 통한 기능 확장
- Multi-Module 또는 Multi-Project Build
- Wrapper를 통한 Build Tool Version의 재현
- Java Project의 표준적인 `src/main/java`, `src/test/java` 구조 사용

따라서 둘의 차이는 "무엇을 Build할 수 있는가"보다 "Build를 어떤 모델로 표현하고 확장하는가"에서 더 분명하게 나타난다.

## Maven과 Gradle의 차이점

| 비교 기준 | Maven | Gradle |
|---|---|---|
| Build Model | 미리 정의된 선형 Lifecycle Phase에 Plugin Goal을 연결 | 서로 의존하는 Task로 Directed Acyclic Graph를 구성 |
| Build Script | XML 기반의 선언적 `pom.xml` | Kotlin 또는 Groovy DSL 기반의 `build.gradle.kts`·`build.gradle` |
| 실행 단위 | `compile`, `test`, `package` 같은 Phase와 Plugin Goal | `compileJava`, `test`, `build` 같은 Task |
| 기본 흐름 | 요청한 Phase까지 표준 순서로 진행 | 요청한 Task와 그 Task가 의존하는 Task를 Graph에서 선택해 실행 |
| Convention | 표준 Lifecycle과 Directory Layout의 규칙이 강하고 Project 간 형태가 비교적 일정 | Plugin이 Convention을 제공하지만 Task와 Build Logic을 더 자유롭게 구성 가능 |
| 확장 방식 | Plugin Goal을 Phase에 Binding하거나 직접 호출 | Plugin과 Custom Task를 추가하고 Task 간 의존 관계를 구성 |
| Dependency 구분 | `compile`, `runtime`, `test`, `provided` 등의 Scope | `implementation`, `api`, `runtimeOnly`, `testImplementation` 등의 Configuration |
| Build 최적화 모델 | Lifecycle과 Plugin 동작을 중심으로 Build | Task의 입력·출력을 이용한 증분 Build, Build Cache와 병렬 실행 기능을 중심으로 최적화 가능 |
| Wrapper | `mvnw`, `mvnw.cmd` | `gradlew`, `gradlew.bat` |

Gradle도 Maven의 표준 Directory Layout과 Maven 호환 Repository를 사용할 수 있다. 반대로 두 도구의 Build 흐름은 동일하지 않다. Maven의 `package` Phase를 Gradle의 단일 Task와 기계적으로 일대일 대응시키기보다, 최종 산출물을 만들기 위해 어떤 Task Graph가 실행되는지 확인해야 한다.

### 선택 기준

| 상황 | Maven이 잘 맞는 이유 | Gradle이 잘 맞는 이유 |
|---|---|---|
| 표준적인 Java Project | 정해진 Lifecycle과 Convention으로 설정과 실행 흐름을 예측하기 쉬움 | Java Plugin의 Convention을 사용하면서 필요한 부분만 확장 가능 |
| Build 규칙이 단순하고 일관성이 중요함 | POM을 보면 Project 정보와 표준 Build 흐름을 비교적 일정하게 파악 가능 | 자유도를 제한해 사용한다면 일관된 Convention 구성 가능 |
| 복잡한 Custom Build 절차 | Plugin 개발과 Phase Binding이 필요할 수 있음 | Task를 정의하고 관계를 Graph로 표현하기 쉬움 |
| 큰 Multi-Project Build와 반복 Build 최적화 | Reactor와 Module 구조로 관리 가능 | Task 기반 증분 실행, Cache와 병렬 실행을 세밀하게 활용 가능 |

어느 도구가 항상 더 좋다고 결론 내릴 수는 없다. 표준성, 기존 생태계, 팀 경험, Build Logic의 복잡성, 실행 시간과 유지보수 비용을 함께 보고 선택해야 한다. 특히 성능은 Project 구조와 Plugin·Cache 설정에 영향을 받으므로 도구 이름만으로 단정하지 않는다.

## 자주 혼동하는 내용

- Maven은 Dependency만 내려받는 도구가 아니라 Project Model과 전체 Build Lifecycle을 관리하는 도구다.
- `mvn install`은 Maven을 운영체제에 설치하는 명령이 아니다. Build한 Artifact를 Local Repository에 저장하는 Phase다.
- `mvn deploy`는 Application을 Server에 실행한다는 일반적인 의미가 아니다. Maven에서는 Artifact를 Remote Repository에 게시하는 Phase다.
- `mvn package`는 Java의 `package` 선언과 관계없이 Build 산출물을 만드는 Phase다.
- Maven Wrapper는 Maven Version을 재현하지만 JDK 설치까지 대신하지 않는다.
- POM에 Dependency를 선언하는 것과 Plugin을 선언하는 것은 목적과 Classpath가 다르다.
- Maven과 Gradle의 명령 이름이 비슷해도 내부 Build Model과 실행 단위는 다르다.

## 참고 자료

- [Apache Maven — What is Maven?](https://maven.apache.org/what-is-maven)
- [Apache Maven — Introduction to the POM](https://maven.apache.org/guides/introduction/introduction-to-the-pom.html)
- [Apache Maven — Introduction to the Build Lifecycle](https://maven.apache.org/guides/introduction/introduction-to-the-lifecycle.html)
- [Apache Maven — Introduction to the Standard Directory Layout](https://maven.apache.org/guides/introduction/introduction-to-the-standard-directory-layout.html)
- [Apache Maven — POM Reference](https://maven.apache.org/pom.html)
- [Apache Maven — Maven WAR Plugin](https://maven.apache.org/plugins/maven-war-plugin/)
- [Apache Maven — Maven Wrapper](https://maven.apache.org/tools/wrapper/)
- [Oracle JDK 25 — JAR File Specification](https://docs.oracle.com/en/java/javase/25/docs/specs/jar/jar.html)
- [Gradle User Manual — Build Lifecycle](https://docs.gradle.org/current/userguide/build_lifecycle.html)
- [Gradle User Manual — Migrating Builds From Apache Maven](https://docs.gradle.org/current/userguide/migrating_from_maven.html)
