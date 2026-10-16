# Spring 설정과 Bean으로 Provider 연결하기

Secret은 Provider가 만들어 제공하는 값이 아니다. 실행 환경에서 제공한 값을 Spring이 읽고, Configuration이 그 값을 Provider 객체에 전달한다. Provider는 받은 인증 값을 외부 AI 요청에 사용한다. 파일 전달, 설정 읽기, 객체 생성과 실제 요청은 서로 다른 단계다.

## 파일과 설정값과 객체

다음 예시는 실제 API Key 대신 임시 합성 값을 사용하는 학습용 구성이다. `lesson.provider.key`는 이 예시의 설정 이름이며, 외부 AI SDK의 자동 설정 이름은 아니다.

```text
임시 디렉터리의 lesson.provider.key 파일
    ↓ configtree가 읽음
Spring Environment의 lesson.provider.key 설정값
    ↓ Configuration이 읽고 생성자에 전달
NonCallingProvider 객체
    ↓ Spring에 Bean으로 등록하고 다른 객체에 전달
ProviderConsumer 객체
```

| 대상 | 의미 | 이것만으로 되지 않는 것 |
|---|---|---|
| Secret 파일 | 실행 환경이 제공한 값을 담은 파일 | 파일 존재만으로 Java 객체를 만들지는 않는다. |
| Property | 이름으로 찾아 사용할 수 있는 설정값 | 값을 읽었다고 Provider가 자동 등록되지는 않는다. |
| Provider 객체 | 인증 값과 요청 기능을 사용하는 Java 객체 | 객체 생성만으로 문의를 전송하지는 않는다. |
| Bean | Spring이 관리하고 다른 객체에 전달할 수 있도록 등록한 객체 | 어떤 일을 실제 실행할지는 호출 코드와 실행 조건이 결정한다. |

`Environment`는 환경 변수·설정 파일 등에서 읽은 설정값을 이름으로 조회하는 Spring의 객체다. Secret 파일 자체를 Worker에 건네는 것과 파일을 읽은 설정값으로 Provider를 구성하는 것은 다른 일이다.

## configtree가 읽는 것

다음 설정은 지정한 디렉터리의 파일들을 Property로 읽도록 한다.

```properties
spring.config.import=configtree:/run/secrets/
```

이 경로에 `lesson.provider.key`라는 파일이 있다면 파일 이름이 Property 이름이 되고, 파일 내용이 값이 된다. Container 안의 `/run/secrets/`에 파일을 제공하는 것은 Docker·Compose의 역할이고, `configtree:`를 해석해 설정으로 읽는 것은 Spring Boot의 역할이다. [Spring Boot Configuration Tree](https://docs.spring.io/spring-boot/reference/features/external-config.html#features.external-config.files.configtree)

Config Tree 디렉터리가 없는 경우와, 디렉터리는 있지만 필요한 Property 파일이 없는 경우도 구분한다. `optional:configtree:`의 `optional:`은 읽을 위치가 없어도 계속 시작하도록 하는 설정이지, 기능에 필요한 값의 누락을 모두 허용하는 설정은 아니다. 필요한 값의 검사는 그 기능을 구성하는 코드에서도 수행한다.

## Configuration이 Provider를 만드는 과정

학습용 Test의 Provider 등록 메서드는 다음과 같다.

```java
@Bean
AiSuggestionProvider lessonProvider(Environment environment) {
    String key = environment.getRequiredProperty(KEY_PROPERTY);
    if (key.isBlank()) {
        throw new IllegalStateException("LESSON_PROVIDER_KEY_REQUIRED");
    }
    return new NonCallingProvider(key);
}
```

`KEY_PROPERTY`에는 `lesson.provider.key`라는 설정 이름이 있다. 실제 비밀값을 Source에 적은 것이 아니다.

1. `@Bean`은 메서드가 반환할 객체를 Spring에 등록하도록 한다.
2. Spring은 설정을 읽을 수 있는 `Environment`를 매개변수에 전달한다.
3. `getRequiredProperty`는 지정한 이름의 값을 조회한다. 필요한 값이 없으면 객체 생성이 실패한다.
4. 값이 공백뿐인 경우도 별도로 거부한다. 이름이 존재하는 것과 사용할 수 있는 값인 것은 다르다.
5. `new NonCallingProvider(key)`가 값을 받는 Java 객체를 만든다.
6. 반환한 객체가 Provider Bean으로 등록된다.

여기서 값을 제공하는 것은 `Environment`이고, Provider는 그 값을 받는 쪽이다. Java Class 파일만 있어도 객체가 저절로 생성되거나 Bean으로 등록되는 것은 아니다. [Spring의 Bean 등록](https://docs.spring.io/spring-framework/reference/core/beans/java/bean-annotation.html)

Bean으로 등록하지 않았다는 것이 Java 객체가 어디에도 존재하지 않는다는 뜻은 아니다. 직접 `new`로 만든 객체가 Spring 관리 밖에 있을 수도 있다. 중요한 것은 Spring이 의존성 주입에 사용할 수 있는 객체로 등록됐는지다. 이 예시에서는 `@Bean` 메서드의 반환으로 생성과 등록을 연결한다.

## 다른 객체가 Provider를 받는 과정

Provider를 사용하는 학습용 객체는 다음 메서드로 구성한다.

```java
@Bean
ProviderConsumer lessonConsumer(AiSuggestionProvider provider) {
    return new ProviderConsumer(provider);
}
```

이 메서드는 Provider를 새로 만드는 코드가 아니다. Spring은 등록된 객체 중 `AiSuggestionProvider` 타입으로 사용할 수 있는 객체를 찾아 `provider` 자리에 전달한다. 메서드가 그 참조로 Consumer를 만든다.

Provider Bean이 없으면 이 의존성을 해결하지 못해 Context의 기동에 실패한다. 이것은 외부 AI가 API Key를 거부한 상황이 아니다. 아직 필요한 Java 객체를 조립하지 못한 단계다. Provider Bean이 여러 개라면 어떤 객체를 사용할지도 명확하게 지정해야 한다.

실제 Helpdesk에서는 Processor가 Provider를 받는다. Worker가 선택한 Job을 Processor가 처리하고, 그 안에서 Provider의 `generate(...)`를 호출한다. 등록과 주입은 객체를 사용할 준비를 하는 과정이고, 메서드 호출은 실제 일을 실행하는 과정이다.

첫 메서드에서 만든 Provider와 두 번째 메서드의 `provider` 매개변수는 같은 객체를 가리킨다. `new ProviderConsumer(provider)`가 새로 만드는 것은 Consumer이며, Consumer는 기존 Provider의 참조를 보관한다. Provider와 Consumer가 서로 다른 객체라는 사실과, Consumer에 전달된 Provider가 기존 객체라는 사실은 동시에 성립한다.

## 실제 Provider 등록 설정

Lab의 `AiSuggestionProviderConfiguration`은 `postgres` Profile과 `helpdesk.ai.provider.enabled=true`에서 기존 `SpringAiOpenAiSuggestionProvider`를 Bean으로 등록한다. Provider를 구성하는 설정과 Worker를 실행하는 설정은 따로 둔다.

| 설정 이름 | 역할 |
|---|---|
| `helpdesk.ai.provider.enabled` | 실제 Provider와 출력 검증기의 등록 여부. 생략하거나 `false`이면 등록하지 않는다. |
| `helpdesk.ai.provider.key` | Provider가 사용할 Helpdesk 전용 인증 값. 활성 구성에서는 필수다. |
| `helpdesk.ai.provider.max-summary-code-points` | Prompt와 출력 검증기에 함께 전달하는 양의 정수 상한. 자동 기본값 없이 명시한다. |
| `helpdesk.ai.worker.enabled` | 등록된 의존성을 사용하는 Worker·Scheduler의 활성화 여부 |

Key는 `Environment`에서 이름으로 조회해 생성자에 전달한다. 전역 `OPENAI_API_KEY`를 대체 값으로 읽지 않는다. Key가 없거나 공백뿐이면 고정 오류 코드로 기동을 거부한다. 값이 있다는 검사만으로 외부 AI의 인증 성공까지 알 수는 없다.

요약 상한은 `ProviderLimits` 객체로 만들고 Provider와 검증기에 같은 값을 전달한다. Test의 200자를 실행 기본값으로 자동 선택하지 않는다. 숫자로 해석할 수 없는 설정을 거부할 때도 잘못 입력한 값과 Parser 예외 Cause를 출력하지 않는다.

개인정보 처리기 `AiInputPrivacyGuard`는 별도로 등록한 Bean을 받아야 한다. 설정이 없다고 빈 처리기를 만들어 검사를 생략하지 않는다. 기존 Guard는 지정한 민감 문자열만 처리하므로 어떤 값과 타입을 제공할지는 실행 입력에 맞게 정해야 한다.

Provider를 등록하고 Worker를 꺼 두면 객체는 준비되지만 자동 Job 처리는 시작하지 않는다. 두 활성화 값을 모두 켠 경우에도 DB와 개인정보 처리기 등 나머지 의존성을 갖춰야 한다. Context 종료 시에는 Provider의 `close()`를 호출해 HTTP Client 자원을 정리한다.

`AiSuggestionProviderConfigurationTest`는 임시 합성 파일을 Config Tree로 읽어 실제 Main Configuration을 실행한다. 기본 비활성·다른 Profile·Key 누락·공백·전역 Key 대체 금지·상한 검증·개인정보 처리기 미등록을 비교한다. 정상 구성에서도 Provider의 HTTP 시도 횟수는 0이다. `optional:configtree:`로 없는 위치를 허용하더라도 활성 Provider의 필수 Key 검사는 그대로 수행된다.

## 설정 실패와 요청 실패

| 상황 | 실패하거나 결정되는 단계 | 의미 |
|---|---|---|
| 필수 설정값이 없음 | Provider 객체 생성 | 사용할 인증 값을 구성하지 못했다. |
| 설정값은 있으나 필요한 Provider Bean 없음 | 객체 의존성 조립 | Processor 등에 전달할 객체가 없다. |
| 필요한 객체가 모두 있지만 Worker 비활성 | 자동 처리의 실행 조건 | 설정만으로 Job 처리가 시작되지 않는다. |
| 실제 요청 뒤 Provider가 인증을 거부 | 외부 HTTP 요청과 응답 처리 | 객체는 구성됐지만 외부 인증에 실패했다. |

Worker와 Provider를 모두 끈 구성에서는 AI 설정이 없어도 문의 접수를 유지할 수 있다. 다만 DB·로그인처럼 접수 자체에 필요한 설정은 갖춰야 한다. 반대로 Worker를 명시적으로 켠 구성에서는 필요한 Provider·개인정보 처리기·출력 검증기와 설정을 모두 제공해야 한다.

## Compose가 파일을 제공하는 단계

Compose의 `secrets`는 지정한 Service에 파일을 제공한다. 파일을 제공한 것만으로 환경 변수가 생기거나 Provider가 등록되지는 않는다. Container의 `/run/secrets/helpdesk.ai.provider.key`를 Spring이 `configtree:`로 읽으면 파일 이름은 Property 이름, 내용은 그 값이 된다. Configuration은 그 값을 Provider 생성자에 전달한다. [Docker Compose Secrets](https://docs.docker.com/compose/how-tos/use-secrets/), [Spring Boot Config Tree](https://docs.spring.io/spring-boot/reference/features/external-config.html#features.external-config.files.configtree)

같은 Image를 사용해도 실행할 때 다른 파일을 연결하면 서로 다른 설정으로 객체를 만들 수 있다. 비밀값을 Java Source·JAR·Image에 넣지 않는 이유다. 로컬 Compose의 파일 기반 Secret은 Host 파일을 Mount하는 방식이므로, 원본 파일의 접근 권한과 보관도 관리해야 한다. `secrets`라는 이름이 붙었다고 파일이 암호화되거나 AWS Secrets Manager처럼 관리되는 것은 아니다.

확인 대상은 다음처럼 나눈다.

| 확인 대상 | 확인할 내용 |
|---|---|
| 파일 제공 | 해당 Service에만 파일이 연결됐는가? 실행 사용자에게 읽기 권한이 있는가? 읽기 전용인가? |
| 설정 읽기 | `Environment`의 Property 값이 제공한 파일과 일치하는가? |
| 객체 조립 | Main Configuration이 Provider를 등록하고, 필요한 객체에 같은 참조를 전달하는가? |
| 업무 실행 | Worker가 Job을 처리하고 실제 AI 요청·출력 검증·DB 저장을 수행하는가? |

파일 제공·설정 읽기·객체 조립은 외부 요청 없이 확인할 수 있다. Lab의 `compose.secret-probe.yaml`과 `ComposeSecretMountExperiment`는 네트워크를 차단하고 Worker를 끈 별도 실험이다. 실제 Main의 Provider 등록 설정을 사용하되 개인정보 처리기는 합성 Test Fixture로 제공한다. `postgres` Profile도 등록 조건으로만 사용하며, DB 구성을 등록하지 않는 작은 Context에서는 DB 접속이 생기지 않는다.

Secret 파일을 교체하는 일과 기존 Provider의 설정을 바꾸는 일도 다르다. 현재 Provider는 생성할 때 Key를 HTTP Client에 전달하며, 파일 변경을 감지해 Client의 인증 값을 다시 설정하는 로직은 없다. 새 Key를 적용하려면 파일 제공을 바꾸고 Provider를 다시 만들어야 한다. 새 설정으로 Application을 다시 시작하는 방법을 사용할 수 있다.

## ECS가 Secret을 환경 변수로 전달하는 경우

로컬 Compose의 파일과 Config Tree는 설정을 전달하는 한 방법이다. ECS에서는 Task Definition의 `secrets`에 참조한 값을 ECS Agent가 가져와 Container의 환경 변수로 전달할 수도 있다. 이때 파일이나 `configtree:`가 꼭 필요한 것은 아니다. [ECS의 Secret 환경 변수 전달](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-secrets-manager.html)

```text
Secret 저장소
  → ECS Agent가 Execution Role로 읽음
  → 새 Container의 환경 변수
  → Spring Environment
  → Configuration이 Provider 객체 생성
```

`HELPDESK_AI_PROVIDER_KEY`는 환경 변수 이름이며 값은 기록하지 않는다. Spring의 환경 변수 Property 조회로 `helpdesk.ai.provider.key`를 읽어 기존 Provider 생성자에 전달할 수 있다. 값의 전달 방식을 바꿔도 개인정보 처리기·검증기 등의 Bean 의존성이 없어지는 것은 아니다.

ECS Agent가 값을 가져오는 구성에서는 Execution Role에 해당 Secret 읽기 권한을 부여한다. Java가 AWS SDK로 직접 가져오는 구성이라면 Task Role을 사용한다. 두 방식을 구분해 Application에 필요하지 않은 읽기 권한을 추가하지 않는다. [ECS Execution Role](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html)

저장소의 Secret을 바꿔도 이미 실행 중인 Container에 새 값이 자동 주입되지는 않는다. 새 Task를 시작해야 하며, Task Definition이 특정 과거 Version을 고정했는지도 확인한다. 기존 Provider 역시 생성 시 받은 Key를 HTTP Client에 설정한다. Key만 바꿀 때 Source·Image를 다시 Build할 필요는 없지만 새 실행 설정으로 객체를 구성해야 한다.

환경 변수 주입은 비밀값을 Java가 읽을 수 있게 하는 방법이지 Process·관리자·Debug 도구에서도 숨기는 방법은 아니다. 환경 변수·Task 설정·Log를 통째로 출력하지 않는다. 전달 이름·참조·권한과 값의 존재만 확인한다.

## Parameter Store와 Secrets Manager

AWS Systems Manager의 Parameter Store는 설정을 이름과 값의 쌍으로 보관한다. 여기서 Parameter는 Java 메서드의 매개변수가 아니라 저장소의 설정 항목이다. 일반 문자열은 `String`, 암호화해 보관할 민감한 값은 `SecureString`으로 구분한다. `SecureString`의 암호화·복호화에는 AWS KMS를 사용한다. [Parameter Store 암호화](https://docs.aws.amazon.com/systems-manager/latest/userguide/secure-string-parameter-kms-encryption.html)

Secrets Manager도 비밀값을 보관하지만 자동 교체 같은 Secret 관리 기능을 제공한다. 저장소의 항목 수와 ECS에 전달할 환경 변수 수는 같지 않을 수 있다. Secrets Manager의 JSON 한 항목에서 여러 Field를 참조하는 구성과, Parameter Store에서 설정마다 별도 Parameter를 참조하는 구성을 구분한다.

| 대상 | 보관하는 것 | 값을 사용하는 단계 |
|---|---|---|
| Parameter Store의 `SecureString` | 암호화한 설정값 | 허용된 읽기 요청에서 복호화해 전달 |
| Task Definition의 `secrets.valueFrom` | Parameter나 Secret의 참조 | ECS Agent가 시작 준비 중 읽음 |
| 새 Container의 환경 변수 | App이 읽을 수 있는 값 | Spring이 Property로 조회 |
| Java 객체 | 생성 시 받은 설정과 실행 기능 | 실제 DB 연결·사용자 인증·Provider 요청에 사용 |

예를 들어 `SPRING_DATASOURCE_PASSWORD`는 전달할 환경 변수 이름이고 `valueFrom`에는 Parameter의 ARN 같은 참조를 넣는다. ARN은 해당 자원의 식별자이지 Password가 아니다. Parameter Store가 비밀값을 암호화해 보관해도 App이 사용하려면 읽을 수 있는 값으로 전달돼야 하므로, Process 환경과 Log를 보호하는 책임이 없어진 것은 아니다.

ECS Agent가 Parameter Store를 읽는 방식에서는 Execution Role의 `ssm:GetParameters` 권한을 필요한 Parameter로 제한한다. 현재 App이 AWS SDK로 저장소를 직접 읽는 구조가 아니라면 Task Role에 같은 권한을 추가하지 않는다. Customer-managed KMS Key를 선택한 경우에는 해당 Key의 복호화 권한도 별도로 확인한다. [ECS Parameter Store 전달과 권한](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html#task-execution-secrets)

필요한 Parameter를 읽지 못하면 ECS의 실행 준비가 실패할 수 있다. 이를 기본 Password로 대체해 App을 시작하거나 외부 AI 인증 실패로 기록하지 않는다. 실제 실행에서는 Container 시작 여부와 실패한 작업·단계를 먼저 확인한다.

### Standard SecureString을 전달하는 순서

이름·Type·Tier·Key는 서로 다른 설정이다. `/helpdesk/learning/db/password`는 항목의 이름, `SecureString`은 암호화 저장 Type, `Standard`는 Tier, `aws/ssm`은 AWS 관리 KMS Key다. 이름에 `password`를 넣는 것만으로 암호화가 되는 것은 아니다. Standard Parameter는 값의 크기 한도도 확인해야 한다. [Parameter Tier](https://docs.aws.amazon.com/systems-manager/latest/userguide/parameter-store-advanced-parameters.html)

```text
Parameter Store
  /helpdesk/learning/db/password = 암호화해 보관한 값
      ↓ Execution Role의 지정 Parameter 읽기 허용
ECS Agent
      ↓ 새 Container 시작 시 환경 변수에 전달
SPRING_DATASOURCE_PASSWORD
      ↓ Spring이 DataSource에 설정
JDBC 연결
      ↓ PostgreSQL이 DB 계정의 Password를 확인
```

Task Definition에는 값 대신 `arn:aws:ssm:REGION:ACCOUNT_ID:parameter/helpdesk/learning/db/password`와 같은 참조를 적는다. IAM Policy의 `Resource`도 같은 대상을 가리키되 모든 Parameter의 읽기나 수정·삭제를 허용하지 않는다. 이 참조와 환경 변수 이름은 공개 예제로 설명할 수 있지만 실제 값은 출력하지 않는다.

Agent의 읽기 권한은 PostgreSQL의 인증 권한이 아니다. Parameter를 읽어 환경 변수로 전달했더라도 DB의 실제 계정·Password가 다르면 JDBC 인증이 실패한다. 반대로 DB Password가 맞더라도 Agent의 읽기가 거부되면 필요한 실행 설정을 준비하지 못한다.

Standard 저장과 Standard Throughput API에는 추가 요금이 없지만 KMS 요청은 별도의 사용량이다. 같은 계정의 다른 프로젝트가 무료 요청량을 사용했을 수도 있다. 계정 전체의 Higher Throughput 설정을 확인하고, 비용을 줄이려는 이유로 다른 프로젝트의 처리량 설정을 임의로 변경하지 않는다. [Parameter Store 요금](https://aws.amazon.com/systems-manager/pricing/#Parameter_Store), [KMS 요금](https://aws.amazon.com/kms/pricing/)

## 저장소의 값과 대상 시스템의 Password

Parameter Store의 DB Password를 교체하는 일과 PostgreSQL 사용자의 실제 Password를 교체하는 일은 다르다. 전자는 App이 사용할 접속 설정을 바꾸고, 후자는 DB가 인증할 값을 바꾼다. 두 값이 맞지 않으면 새 Task가 설정을 잘 읽어도 DB 인증에 실패한다.

이미 실행 중인 Task의 환경 변수·DataSource·사용자 Bean도 저장소 변경만으로 자동 갱신되지 않는다. 대상 시스템의 변경과 새 Task의 설정 적용을 맞춰야 하며, Key·Password 값만 바뀌었다면 Image를 다시 Build할 필요는 없다. [ECS 시작 시 값 전달](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/secrets-envvar-ssm-paramstore.html)

## 배포용 로그인 사용자와 DB 사용자의 분리

Helpdesk의 `deployment` Profile은 실행 설정으로 학습용 USER·AGENT를 구성한다. 함께 활성화하는 `postgres`는 Ticket 저장소를 선택한다. Profile은 객체의 등록 조건이며, 활성화 이름만으로 DB 접속이나 AWS 배포 성공까지 결정되지는 않는다. [Spring의 Profile과 Property](https://docs.spring.io/spring-framework/reference/core/beans/environment.html)

| 로그인 설정 | 환경 변수 이름 |
|---|---|
| `helpdesk.deployment.user.username` | `HELPDESK_DEPLOYMENT_USER_USERNAME` |
| `helpdesk.deployment.user.password` | `HELPDESK_DEPLOYMENT_USER_PASSWORD` |
| `helpdesk.deployment.agent.username` | `HELPDESK_DEPLOYMENT_AGENT_USERNAME` |
| `helpdesk.deployment.agent.password` | `HELPDESK_DEPLOYMENT_AGENT_PASSWORD` |

Configuration은 네 값을 읽고 기존 PasswordEncoder로 Hash를 만들어 `InMemoryUserDetailsManager`를 구성한다. USER에는 `ROLE_USER`, AGENT에는 `ROLE_USER`·`ROLE_AGENT`를 부여한다. 사용자를 메모리에 보관하는 것과 Ticket을 PostgreSQL에 저장하는 것은 독립된 선택이다. [Spring Security의 메모리 사용자 저장소](https://docs.spring.io/spring-security/reference/servlet/authentication/passwords/in-memory.html)

필수 값이 없거나 공백뿐이면 기동을 거부한다. Local 설정이나 기본 계정으로 대체하지 않으며, 두 계정의 이름은 대소문자를 무시해도 구분되어야 한다. `postgres` 없이 사용하거나 `local-browser`·`in-memory`를 함께 켠 경우도 거부한다. 회원가입·영속 사용자 관리 대신 제한된 학습용 계정을 제공하는 구성이다.

Browser가 보내는 로그인 Password는 Spring Security가 사용자 Hash와 비교한다. JDBC의 `spring.datasource.username`·`spring.datasource.password`는 Application이 PostgreSQL에 연결할 때 사용하는 값이며, Helpdesk의 USER·AGENT 로그인 계정과 다르다.

UserDetails에는 Hash를 설정하지만 Process 환경 변수에 전달한 원문 Password까지 없애는 것은 아니다. 값을 Log·Source·전체 환경 변수 출력에 남기지 않는다. 새 실행 환경의 값으로 사용자 Bean을 다시 만들 수 있으므로 Password만 교체할 때 Image의 코드를 바꿀 필요는 없다.

새 Configuration 코드를 추가하거나 Role 배정 코드를 수정했다면 Java Source가 바뀐 것이므로 JAR·Image를 다시 Build해야 한다. Password 값만 교체하는 경우와 구분한다.

## 파일 전달과 객체 조립을 검증하는 Test

Lab의 `ConfigTreeProviderWiringTest`는 `@TempDir`에 임시 합성 값을 쓰고, 실제 Config Data 읽기를 적용한 작은 Spring Context를 실행한다. 실제 API Key나 외부 HTTP Client는 사용하지 않는다.

`ApplicationContextRunner`는 선택한 Configuration으로 작은 Context를 구성한다. `ConfigDataApplicationContextInitializer`는 설정 파일과 `spring.config.import`를 읽어 `Environment`에 반영하도록 한다. 이 조합은 실제 설정 읽기를 확인하면서 Web Server와 Database를 시작하지 않는 데 사용한다. [Spring Boot Test Utilities](https://docs.spring.io/spring-boot/reference/testing/test-utilities.html)

확인할 Case는 다음과 같다.

| Case | 준비 조건 | 기대 결과 |
|---|---|---|
| 값과 Bean이 모두 있음 | 파일 읽기 + Provider 등록 + Consumer 등록 | 같은 Provider가 Consumer에 전달된다. 생성만으로 호출되지는 않는다. |
| 파일만 읽음 | 설정값은 존재하지만 Consumer만 등록 | Provider 의존성을 해결하지 못해 기동 실패 |
| 값 누락 | Provider 등록 구성 활성, 필요한 파일 없음 | 필수 설정 조회에서 기동 실패 |
| 공백 값 | Property 파일은 있지만 공백뿐 | 값 검사에서 기동 실패 |
| 기능 비활성 | 학습용 구성과 실제 Worker를 비활성화 | 해당 객체를 요구하지 않으며 Worker·Scheduler가 등록되지 않음 |

학습용 Provider는 `generate(...)`가 호출되면 Test가 실패하도록 만들었다. 설정 읽기와 객체 전달을 확인하는 Test에서 실수로 외부 작업을 실행하지 않기 위해서다. 전달된 값의 비교도 Boolean으로 확인하며 값 자체를 Assertion 실패 메시지에 출력하지 않는다. 학습용 Configuration은 `@TestConfiguration`으로 구분한다.

```powershell
.\mvnw.cmd "-Dtest=ConfigTreeProviderWiringTest,AiSuggestionWorkerConfigurationTest" test
```

이 Test의 임시 파일은 실제 Compose Secret Mount를 시험하는 것이 아니다. Container의 파일 제공·읽기 권한은 Compose 실행에서, 설정 읽기·Bean 조립은 이 작은 Context에서 확인할 수 있다. 실제 Worker의 DB 처리와 외부 AI 요청은 각 흐름에 맞는 Test에서 확인한다.

## 핵심 질문

1. Provider가 비밀값을 제공하는 객체라고 설명하면 어느 방향을 반대로 이해한 것인가?
2. 설정값이 `Environment`에 있어도 Provider Bean이 없으면 왜 기동에 실패할 수 있는가?
3. `new Provider(...)`, Bean 등록, 다른 객체에 주입, `generate(...)` 호출은 각각 어떤 일인가?
4. `@Bean` 메서드의 `AiSuggestionProvider provider` 매개변수는 새 객체 생성 명령인가?
5. Provider Bean이 있어도 Worker가 비활성이라면 `PENDING` Job이 자동 처리되는가?
6. `optional:configtree:`는 기능에 필요한 API Key의 누락까지 허용한다는 뜻인가?
7. 설정 조립 Test가 성공한 것만으로 실제 Secret Mount나 AI 요청 성공을 알 수 있는가?
8. 첫 `@Bean` 메서드가 만든 Provider와 다른 메서드의 `provider` 매개변수, 그 메서드가 만든 Consumer는 각각 같은 객체인가?
9. Provider 등록과 Worker 실행을 나누는 이유는 무엇이며, Provider를 켜고 Worker를 꺼 두면 무엇까지 준비되는가?
10. Secret 파일을 교체하면 이미 만들어진 Provider의 인증 값도 자동으로 바뀌는가?
11. `deployment`와 `postgres`는 각각 어떤 객체를 선택하며, 메모리 사용자 저장소를 쓰면 Ticket도 메모리에 저장되는가?
12. Browser 로그인 계정과 JDBC의 DB 계정은 같은 신원인가? 환경 변수의 원문 Password도 Hashing 뒤 자동으로 사라지는가?
13. Parameter Store의 값, `valueFrom` 참조, Container 환경 변수와 Java 객체는 각각 무엇인가?
14. ECS가 필수 Parameter를 읽지 못한 경우와, App이 읽은 Password를 DB가 거부한 경우는 왜 다른 실패인가?
15. Parameter Store에서 DB Password만 바꾸면 PostgreSQL 사용자의 Password와 기존 Task도 자동 변경되는가?

## 핵심 질문 해설

1. **Provider는 값을 받는 쪽이다.** 실행 환경이 값을 제공하고 Spring 설정이 읽으며 Configuration이 Provider 객체에 전달한다.
2. **값과 객체는 다르기 때문이다.** Processor가 요구하는 것은 설정 문자열이 아니라 `AiSuggestionProvider` 객체다. 그 객체를 등록해야 의존성을 해결할 수 있다.
3. **생성은 객체 만들기, 등록은 Spring 관리 대상으로 제공하기, 주입은 다른 객체에 참조 전달하기, 호출은 해당 메서드 실행하기다.** 어느 앞 단계도 다음 단계의 업무 성공을 대신하지 않는다.
4. **아니다.** Spring이 등록된 Provider를 찾아 메서드에 전달하도록 요구한 것이다.
5. **자동 처리되지 않는다.** 객체를 사용할 준비가 되어 있어도 Worker의 실행 조건이 꺼져 있으면 Job을 자동으로 실행하지 않는다.
6. **아니다.** 읽을 위치가 없어도 계속할 수 있다는 뜻이다. 활성화한 기능의 필수 값 검사는 별도로 수행한다.
7. **알 수 없다.** 설정과 객체 전달, Container의 파일 접근, 실제 업무·외부 요청은 서로 다른 확인 대상이다.
8. **Provider와 매개변수가 가리키는 객체는 같고 Consumer는 다르다.** 새 Consumer는 기존 Provider의 참조를 전달받는다.
9. **객체를 사용할 준비와 자동 작업 실행은 별개이기 때문이다.** Provider와 검증기를 구성할 수 있지만 Worker·Scheduler가 비활성이므로 자동 Job 처리와 외부 요청은 시작하지 않는다.
10. **현재 구현에서는 바뀌지 않는다.** Provider를 만들 때 받은 Key를 HTTP Client에 설정하며, 파일 변경을 감지해 다시 적용하는 로직은 없다. 새 설정으로 Provider를 다시 만들어야 한다.
11. **사용자 구성과 Ticket 저장소를 선택한다.** `deployment`는 로그인용 메모리 사용자 Bean, `postgres`는 PostgreSQL Adapter를 선택한다. Ticket의 영속성은 사용자 저장소와 별개다.
12. **서로 다르고 원문도 자동으로 사라지지 않는다.** Browser 로그인은 Spring Security, JDBC의 사용자명·Password는 PostgreSQL이 확인한다. UserDetails의 Hash와 Process 설정의 원문은 서로 다른 위치다.
13. **보관된 값·식별 참조·실행 설정·그 설정을 사용하는 객체다.** 참조를 적는 것이 비밀값이나 Java 객체를 Image에 넣는 것은 아니다.
14. **실행 준비와 DB 인증 단계가 다르다.** Agent의 읽기 거부는 App 실행 전의 문제일 수 있고, DB 인증 거부는 App이 연결을 시작해 DB에 도달한 뒤의 문제다.
15. **자동 변경되지 않는다.** DB의 실제 인증 값과 App의 접속 설정을 일치시키고 새 Task로 적용해야 한다.

## 함께 읽을 자료

- [Docker 실행 설정과 Secret 전달](./docker-image-container-compose-volume.md#실행-설정과-secret의-분리)
- Lab 저장소의 `src/test/java/lab/helpdesk/ai/processing/ConfigTreeProviderWiringTest.java`
- Lab 저장소의 `src/main/java/lab/helpdesk/ai/provider/AiSuggestionProviderConfiguration.java`와 `src/test/java/lab/helpdesk/ai/provider/AiSuggestionProviderConfigurationTest.java`
- [합성 Secret Mount와 Provider 등록 실험](../lab-reports/2026-10-09-synthetic-secret-mount-and-provider-wiring.md)
