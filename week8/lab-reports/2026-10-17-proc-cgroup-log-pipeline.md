# JVM의 Process 메모리와 Container 메모리·Log Pipeline 관찰

> 실행일: 2026-10-17 KST
> 결과: 실제 로컬 Container의 허용된 Process 항목·cgroup 제한·합성 Log Marker와 HTTP 응답 확인

## 범위와 방법

기존 `helpdesk:week8-observation` Image에 Test 전용 `ContainerLifecycleExperiment`만 읽기 전용 Mount했다. Image ID는 `sha256:0ce6d4316688c283d9ba80aa74d088903a0100eb7af9737bf710ea02aebd6256`이다. 현재 Cloud의 P Image를 바꾸거나 운영 Endpoint를 추가한 실험이 아니다.

임시 Container 한 개를 0.25 CPU·512 MiB·읽기 전용 Root·비Root·cap-drop ALL·no-new-privileges·64 MiB tmpfs로 실행했다. Port는 Host Loopback에만 연결했다. In-memory 실행이며 실제 Credential·PostgreSQL·AI Provider/Worker는 사용하지 않았다. 다른 Project의 Container는 변경하지 않았다.

Health 200 뒤 `/proc/1/status`의 Name·State·Pid·PPid·Threads·VmRSS·VmSize만 읽었다. 전체 실행 인자·환경 변수는 조회하지 않았다. 이어 cgroup v2의 메모리·CPU 제한을 읽고, 4초 합성 요청의 시작 Marker를 CLI Pipeline으로 골라 수를 센 뒤 실제 응답도 대조했다.

## 관찰값

| 항목 | 결과 |
|---|---|
| Process | java, PID 1·PPID 0 |
| State | S (sleeping) |
| Threads | 29 |
| VmSize | 3,504,256 kB, 약 3.34 GiB의 가상 주소 공간 |
| VmRSS | 201,664 kB, 약 196.94 MiB의 Process 상주 메모리 |
| memory.current | 249,729,024바이트, 약 238.16 MiB |
| memory.max | 536,870,912바이트, 512 MiB |
| cpu.max | 25000 100000, 0.25 CPU Quota |
| 합성 시작 Marker 수 | 1 |
| 합성 요청 응답 | 200 |
| SIGTERM 뒤 Exit Code / OOMKilled | 143 / false |
| 임시 Container | 종료 뒤 제거 |

관측은 한 시점 근처의 값이며 Peak 측정이 아니다. VmSize가 512 MiB보다 크더라도 그 주소 공간 전부가 실제 RAM을 사용한다는 뜻은 아니다. Process의 RSS와 cgroup에 청구된 전체 사용량도 다르다. 이 수치를 실제 개인정보 모델·외부 AI를 함께 실행하는 구성의 자원 검증으로 바꾸어 해석하지 않는다.

## CLI Pipeline과 재현

[기존 종료 실험](./2026-10-09-process-health-and-ci-baseline.md)의 Test 전용 진입점을 사용한다. 같은 실험 Container가 실행 중일 때 허용된 항목만 읽는다. `<EXPERIMENT_CONTAINER>`는 이번에 만든 합성 실험 Container 이름으로 바꾸며 운영 Container 전체를 대상으로 실행하지 않는다.

```powershell
docker exec '<EXPERIMENT_CONTAINER>' sh -c 'while IFS= read -r line; do case "$line" in Name:*|State:*|Pid:*|PPid:*|Threads:*|VmRSS:*|VmSize:*) printf "%s\n" "$line";; esac; done < /proc/1/status'
docker exec '<EXPERIMENT_CONTAINER>' sh -c 'for file in memory.current memory.max cpu.max; do printf "%s=" "$file"; cat "/sys/fs/cgroup/$file"; done'
docker logs '<EXPERIMENT_CONTAINER>' 2>&1 |
    Select-String -Pattern '^LIFECYCLE_PROBE_REQUEST_STARTED$' |
    Measure-Object
```

시작 Marker가 1개라는 사실만으로 요청 완료·DB Commit·Job 성공을 주장하지 않는다. 이번에는 별도로 HTTP 200을 확인했으며 DB·Job은 실험 대상이 아니었다. Pipeline은 사후 선택이므로 원문·Token이 처음부터 기록되지 않도록 하는 정책을 대신하지 않는다.

AWS·RDS·App·IAM·DNS·Secret은 변경하지 않았고 실제 AI 호출은 0회다. 전체 AI의 Peak 측정, Request/Job 식별자 연결과 DB·Job 종료 결과는 남아 있다. 개념은 [Process 학습자료](../study-docs/process-health-and-ci.md)에 정리한다.
