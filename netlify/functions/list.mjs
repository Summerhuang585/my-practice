import { checkinStore } from "./lib/stores.mjs";
import { json } from "./lib/http.mjs";
import { partitionKeys, cleanClientId } from "./lib/validate.mjs";

// 取得某場次所有項目（含票數）
// GET ?slug=xxx&cid=<clientId 選填，用來標記「我投過哪些」>
export default async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return json({ error: "缺少 slug" }, 400, { "cache-control": "no-store" });
  const cid = cleanClientId(url.searchParams.get("cid"));

  const store = checkinStore();
  const { blobs } = await store.list({ prefix: `${slug}/` });

  // 票是一人一票一個 blob，光看 key 就能算數量，不用再讀內容
  const { entryKeys, votes, voted } = partitionKeys(blobs.map((b) => b.key), slug, cid);

  const entries = (await Promise.all(entryKeys.map((k) => store.get(k, { type: "json" }))))
    .filter(Boolean)
    .map((e) => ({
      id: e.id,
      name: e.name,
      message: e.message,
      emoji: e.emoji,
      answered: e.answered,
      at: e.at,
      votes: votes.get(e.id) || 0,
      voted: voted.has(e.id),
      // cid 是裝置識別碼，不對外送出
    }));

  entries.sort((a, b) => a.at - b.at); // 依送出時間排序
  return json({ count: entries.length, entries }, 200, { "cache-control": "no-store" });
};
