import { test } from "node:test";
import assert from "node:assert/strict";
import {
  slugify, cleanTitle, cleanName, cleanMessage, isAllowedEmoji,
  normalizeMode, isDuplicateName, applyVote, NAME_MAX, MESSAGE_MAX,
} from "../netlify/functions/lib/validate.mjs";

test("slugify: 英數與 - 保留、其餘轉成 -、收斂與修邊", () => {
  assert.equal(slugify("AI-0613"), "ai-0613");
  assert.equal(slugify("0613簽到"), "0613");          // 中文略過
  assert.equal(slugify("  Hello World  "), "hello-world"); // 空白轉 -
  assert.equal(slugify("--a__b--"), "a-b");
  assert.equal(slugify("你好"), "");                  // 全中文 → 空
  assert.equal(slugify(""), "");
  assert.equal(slugify(null), "");
});

test("slugify: 上限 40 字", () => {
  assert.equal(slugify("a".repeat(60)).length, 40);
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

test("isDuplicateName: 大小寫/空白不計", () => {
  const existing = [{ name: "Amy" }, { name: " 小明 " }];
  assert.equal(isDuplicateName(existing, "amy"), true);
  assert.equal(isDuplicateName(existing, "小明"), true);
  assert.equal(isDuplicateName(existing, "Ben"), false);
  assert.equal(isDuplicateName([], "Amy"), false);
});

test("applyVote: 切換投票、計數正確、不影響原陣列", () => {
  const start = ["a"];
  const r1 = applyVote(start, "b");
  assert.deepEqual(r1, { voters: ["a", "b"], votes: 2, voted: true });
  assert.deepEqual(start, ["a"], "原陣列不被修改");

  const r2 = applyVote(["a", "b"], "a");
  assert.deepEqual(r2, { voters: ["b"], votes: 1, voted: false });

  const r3 = applyVote(undefined, "x");
  assert.deepEqual(r3, { voters: ["x"], votes: 1, voted: true });
});
