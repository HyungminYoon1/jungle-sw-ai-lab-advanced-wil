# 11/4 테스트 JVM 종료 지연과 클래스별 자원 정리

> 실행일: 2026-11-04
> Lab Source: 6348974 → ce92236 → 38af3ce
> 범위: 로컬 합성 데이터와 Docker PostgreSQL, 테스트 자원 수명만 변경
> 결과: 전체 Java 1,173건/패키지 검증 2건 통과. 이번 실행의 종료 제한 경고와 새 Dump 0건

## 관찰과 선택

기존 전체 실행은 업무 테스트가 통과해도 Surefire가 fork JVM의 종료를 30초 이상 기다렸다는 메시지를 남겼다. 최근 두 Dump의 관련 Stack을 대조했더니 main은 ApplicationShutdownHooks를 기다리고, SpringApplicationShutdownHook은 HikariPool.shutdown의 awaitTermination에서 기다렸다. 남아 있는 Hikari 연결 생성/관리 Thread도 확인했다. 전체 Thread나 모든 과거 Dump를 원인별로 분석한 것은 아니다.

클래스별 static PostgreSQL @Container는 JUnit이 종료하지만 @SpringBootTest의 Context/연결 Pool은 캐시에 더 오래 남을 수 있는 구성이었다. 기존 클래스별 DB 격리를 유지하고 @DirtiesContext(AFTER_CLASS)로 클래스 경계에서 Context를 제거/종료하는 작은 변경을 선택했다. 종료 유예 증가, 공유 DB, Spring 관리 Container Bean 전환과 비교한 선택 이유/후속 검토는 Lab docs/test-resource-lifecycle.md에 기록했다.

이 설정이 JUnit의 모든 Container Callback 순서를 보장하는 것은 아니다. 운영 종료 설정, Hikari 설정, POM, Migration V12, Service/Repository의 Commit 계약은 변경하지 않았다.

## 대표 클래스의 실패와 수정

대상은 AiRateLimitRetryIntegrationTest, AssignmentQueueConfirmationHttpIntegrationTest, CustomerMessageConfirmationHttpIntegrationTest다. ClassOwnedContextCleanupVerifier는 실행 중 Context/DataSource 참조를 확보하고 기본 dirty-context Listener 뒤에 실제 정리를 검사한다. 비밀값/연결 속성/전체 Thread Stack은 출력하지 않는다.

| 단계 | 결과와 해석 |
|---|---|
| 기존 3개 클래스 | 60건 통과. 이 작은 실행 자체에서 30초 경고를 재현한 것은 아님 |
| 정리 검사를 먼저 추가 | 63개 집계 항목 중 클래스 Callback 오류 3건. 기존 60개 업무 검사가 새로 실패했다는 뜻은 아님 |
| AFTER_CLASS 정리 추가 | 같은 60건 통과. 3개 Context 비활성/DataSource 닫힘/각 Pool Thread 0개 검사 통과 |

집중 실행에서는 HikariDataSource의 INFO만 명령 옵션으로 켰고 다음 클래스 시작 전에 Pool shutdown complete를 관찰했다. 런타임 Log 설정은 저장하지 않았다. 프로세스 전체의 성능 비교로 해석하지 않는다.

## 전체 검증과 실행 종료

같은 구성의 기본 통합 테스트 21개로 Annotation을 확장한 뒤 일반 명령을 실행했다.

```powershell
.\mvnw.cmd -B -ntp verify
```

- Surefire 1,173건과 Failsafe 패키지 검증 2건, 실패/오류/Skip 0, BUILD SUCCESS/Exit 0
- 대표 자원 검사 Marker 3건 통과
- 종료 제한 초과 메시지 0건
- 실행 전 목록과 비교한 새 dump/dumpstream 0건. 이전 Dump는 보존
- 실행 후 해당 Lab 소유 Surefire JVM 0개

수정 후 한 번의 전체 실행에서 관찰한 결과다. 향후 모든 종료 문제가 해결됐다는 보장은 아니다. 마지막 검증 뒤에는 도입한 Import의 위치만 정리했으며, Import/Annotation 외 기존 Java 본문이 같음을 별도로 검사했다.

기본 verify는 선택 실행하는 Browser/Live Experiment를 포함하지 않는다. 기존 Node 399건/Lint와 Browser 네 개/후속 강화 한 개는 이전 단위의 근거이며 이번 실행 수에 합산하지 않았다. 원격 CI/Push, Cloud 변경과 실제 외부 AI 호출은 하지 않았다.

## 근거와 확인 범위

Lab의 ignored 산출물은 target/week12-jvm-cleanup-before.log, week12-jvm-cleanup-red.log, week12-jvm-cleanup-focused-after.log, week12-jvm-cleanup-full-verify.log 및 week12-jvm-cleanup-full-evidence.json이다. XML/원문 Log 전체를 공개 문서에 복사하지 않는다.

| Source | 확인 수준 | 한계 |
|---|---|---|
| pom.xml, 신규 Verifier, Lab 자원 수명 문서 | VERIFIED | 이번 설정/검사의 전체 내용. 의존 버전은 변경하지 않음 |
| 21개 기본 통합 테스트 | PARTIAL | 수명 관련 Annotation/선언과 변경 Diff 확인. 모든 업무 본문을 새로 감사한 것은 아님 |
| 최근 두 Dump | PARTIAL | 종료 Hook/Hikari와 관련 Thread Stack을 선택 확인 |
| Lab README | PARTIAL | 현재 상태/관련 진행 문단. 과거 경고를 수정 후 결과로 덮어쓰지 않음 |
| 새 로컬 Maven 실행 | VERIFIED | 위 집계/정리 Marker/종료 메시지/새 Dump/소유 JVM을 확인 |

[학습 자료](../study-docs/test-jvm-resource-lifecycle.md)에 업무 검사, 자원 정리와 JVM 종료의 차이를 설명했다. 구현/실행은 Codex가 수행했고 사용자의 이해 완료로 바꾸어 기록하지 않는다. 다음은 이미 확보한 근거의 최종 대조와 필요한 개념 보충, 주간 기록/회고다. 실제 학습시간과 남은 주간 기술 예산은 미기록이며 다시 초기화하지 않는다.
