import assert from "node:assert/strict";
import test from "node:test";

// 의도적으로 잘못된 예제: 401은 login-required여야 한다.
function buggyStatusLabel(status) {
    return status === 401 ? "forbidden" : "success";
}

test("약한 검증은 잘못된 결과도 통과시킨다", () => {
    assert.ok(buggyStatusLabel(401));
    assert.ok(buggyStatusLabel(200));
});

test("정확한 기대값 검증은 같은 결함을 발견한다", () => {
    assert.throws(() => {
        assert.equal(buggyStatusLabel(401), "login-required");
    }, { code: "ERR_ASSERTION" });
});
