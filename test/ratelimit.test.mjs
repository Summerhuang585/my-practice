import { test } from "node:test";
import assert from "node:assert/strict";
import { withinLimit, clientIp } from "../netlify/functions/lib/ratelimit-core.mjs";

test("withinLimit: 視窗內未達上限 → 允許並記錄", () => {
  const r = withinLimit([], 1000, 10000, 3);
  assert.equal(r.allowed, true);
  assert.deepEqual(r.timestamps, [1000]);
});

test("withinLimit: 達上限 → 擋下、不記錄、回 retryAfter", () => {
  const ts = [1000, 1001, 1002];
  const r = withinLimit(ts, 1003, 10000, 3);
  assert.equal(r.allowed, false);
  assert.equal(r.timestamps.length, 3, "被擋時不新增時間戳");
  assert.ok(r.retryAfterMs > 0);
});

test("withinLimit: 視窗外的舊時間戳會被丟棄", () => {
  const ts = [0, 1, 2]; // 距今超過視窗
  const r = withinLimit(ts, 100000, 10000, 3);
  assert.equal(r.allowed, true);
  assert.deepEqual(r.timestamps, [100000], "舊的清掉、只留這次");
});

test("clientIp: 依序取 nf-ip → x-forwarded-for → unknown", () => {
  const mk = (h) => ({ headers: { get: (k) => h[k] || null } });
  assert.equal(clientIp(mk({ "x-nf-client-connection-ip": "1.2.3.4" })), "1.2.3.4");
  assert.equal(clientIp(mk({ "x-forwarded-for": "5.6.7.8, 9.9.9.9" })), "5.6.7.8");
  assert.equal(clientIp(mk({})), "unknown");
});
