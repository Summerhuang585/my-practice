import { test } from "node:test";
import assert from "node:assert/strict";
import {
  slugify, makeSlug, randomSuffix, cleanTitle, cleanName, cleanMessage,
  isAllowedEmoji, normalizeMode, cleanClientId, normalizeName, nameEntryId,
  safeKeyPart, entryKey, voteKey, votePrefix, partitionKeys, csvCell,
  NAME_MAX, MESSAGE_MAX, CODE_MAX, SUFFIX_LEN,
} from "../netlify/functions/lib/validate.mjs";

// 固定的假亂數，讓代碼尾碼可預期
const fakeBytes = (n) => new Uint8Array(Array.from({ length: n }, (_, i) => i));

test("slugify: 英數與 - 保留、其餘轉成 -、收斂與修邊", () => {
  assert.equal(slugify("AI-0613"), "ai-0613");
  assert.equal(slugify("0613簽到"), "0613");          // 中文略過
  assert.equal(slugify("  Hello World  "), "hello-world"); // 空白轉 -
  assert.equal(slugify("--a__b--"), "a-b");
  assert.equal(slugify("你好"), "");                  // 全中文 → 空
  assert.equal(slugify(""), "");
  assert.equal(slugify(null), "");
});

test("slugify: 截斷後不留尾巴的 -", () => {
  assert.equal(slugify("a".repeat(60)).length, CODE_MAX);
  assert.equal(slugify("a".repeat(23) + "-bbb").endsWith("-"), false);
});

test("makeSlug: 一定帶隨機尾碼，留空則自動產生", () => {
  const s = makeSlug("ai-0613", fakeBytes);
  assert.match(s, /^ai-0613-[a-z0-9]{6}$/);
  const auto = makeSlug("", fakeBytes);
  assert.match(auto, /^s-[a-z0-9]{6}$/);
  const cn = makeSlug("純中文", fakeBytes);
  assert.match(cn, /^s-[a-z0-9]{6}$/, "全中文代碼要退回自動產生");
});

test("randomSuffix: 長度正確且不含易混淆字元", () => {
  const v = randomSuffix(SUFFIX_LEN, fakeBytes);
  assert.equal(v.length, SUFFIX_LEN);
  assert.equal(/[lo01]/.test(v), false);
});

test("cleanTitle: 修邊並截斷 60 字", () => {
  assert.equal(cleanTitle("  決策者的AI戰略  "), "決策者的AI戰略");
  assert.equal(cleanTitle("x".repeat(80)).length, 60);
  assert.equal(cleanTitle(""), "");
});

test("cleanName: 實名必填、可匿名、截斷", () => {
  assert.deepEqual(cleanName("小明"), { name: "小明" });
  assert.deepEqual(cleanName("   "), { error: "請輸入名字" });
  assert.deepEqual(cleanName("", { allowAnonymous: true }), { name: "匿名" });
  assert.equal(cleanName("n".repeat(60)).name.length, NAME_MAX);
});

test("cleanMessage: 修邊並截斷 280 字", () => {
  assert.equal(cleanMessage("  hi  "), "hi");
  assert.equal(cleanMessage("m".repeat(400)).length, MESSAGE_MAX);
});

test("isAllowedEmoji: 只允許白名單", () => {
  assert.equal(isAllowedEmoji("🔥"), true);
  assert.equal(isAllowedEmoji("💩"), false);
  assert.equal(isAllowedEmoji(undefined), false);
});

test("normalizeMode: 未知模式退回 checkin", () => {
  assert.equal(normalizeMode("qa"), "qa");
  assert.equal(normalizeMode("message"), "message");
  assert.equal(normalizeMode("???"), "checkin");
  assert.equal(normalizeMode(undefined), "checkin");
});

test("cleanClientId: 只留安全字元，空的回 null", () => {
  assert.equal(cleanClientId("abc-123_XY"), "abc-123_XY");
  assert.equal(cleanClientId("a/b/../c"), "abc");     // 斜線與點會被清掉，塞不進 blob key
  assert.equal(cleanClientId("!!!"), null);
  assert.equal(cleanClientId(""), null);
  assert.equal(cleanClientId("x".repeat(200)).length, 64);
});

test("nameEntryId: 同一個名字永遠對到同一個 id（大小寫、空白不計）", () => {
  assert.equal(nameEntryId("Amy"), nameEntryId(" amy "));
  assert.equal(nameEntryId("王 小明"), nameEntryId("王  小明"));
  assert.notEqual(nameEntryId("Amy"), nameEntryId("Ben"));
  assert.match(nameEntryId("王小明"), /^n-[A-Za-z0-9_-]+$/, "只能是 blob key 安全字元");
  assert.equal(normalizeName("  A  B "), "a b");
});

test("safeKeyPart: 收斂成 blob key 可用的字元", () => {
  assert.equal(safeKeyPart("192.168.0.1"), "192.168.0.1");
  assert.equal(safeKeyPart("2001:db8::1"), "2001:db8::1"); // IPv6 的冒號是合法的
  assert.equal(safeKeyPart("a/b"), "a_b");
  assert.equal(safeKeyPart(""), "unknown");
});

test("key 佈局：項目與票分開放", () => {
  assert.equal(entryKey("s1", "e-1"), "s1/e/e-1");
  assert.equal(voteKey("s1", "e-1", "c9"), "s1/v/e-1/c9");
  assert.equal(votePrefix("s1", "e-1"), "s1/v/e-1/");
});

test("partitionKeys: 光看 key 就能分出項目、算出票數與我投過誰", () => {
  const keys = [
    "s1/e/a", "s1/e/b",
    "s1/v/a/c1", "s1/v/a/c2", "s1/v/b/c1",
    "s1/v/a/c1/extra",   // 格式不對，忽略
    "other/e/z",         // 別場的，忽略
  ];
  const { entryKeys, votes, voted } = partitionKeys(keys, "s1", "c1");
  assert.deepEqual(entryKeys, ["s1/e/a", "s1/e/b"]);
  assert.equal(votes.get("a"), 2);
  assert.equal(votes.get("b"), 1);
  assert.deepEqual([...voted].sort(), ["a", "b"]);
});

test("partitionKeys: 沒給 clientId 就沒有人是投過的", () => {
  const { voted } = partitionKeys(["s1/e/a", "s1/v/a/c1"], "s1", null);
  assert.equal(voted.size, 0);
});

test("csvCell: 跳脫引號逗號，並擋掉 Excel 公式", () => {
  assert.equal(csvCell("小明"), "小明");
  assert.equal(csvCell('說 "你好"'), '"說 ""你好"""');
  assert.equal(csvCell("a,b"), '"a,b"');
  // 這幾個開頭會被 Excel 當公式執行，要先中和掉
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("-1+2"), "'-1+2");
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(csvCell(null), "");
});
