import { sessionStore, checkinStore } from "./lib/stores.mjs";
import { json } from "./lib/http.mjs";
import { entryKey, votePrefix } from "./lib/validate.mjs";

// 講者刪除一筆（需要 adminToken 驗證），連同這筆的票一起清掉
// POST body: { slug, id, adminToken }
export default async (req) => {
  if (req.method !== "POST") return json({ error: "只接受 POST" }, 405);

  let body = {};
  try { body = await req.json(); } catch { return json({ error: "請傳入 JSON" }, 400); }

  const { slug, id, adminToken } = body;
  if (!slug || !id || !adminToken) return json({ error: "缺少參數" }, 400);

  const session = await sessionStore().get(slug, { type: "json" });
  if (!session || session.adminToken !== adminToken) return json({ error: "沒有權限" }, 401);

  const store = checkinStore();
  const { blobs } = await store.list({ prefix: votePrefix(slug, id) });
  await Promise.all(blobs.map((b) => store.delete(b.key)));
  await store.delete(entryKey(slug, id));
  return json({ ok: true });
};
