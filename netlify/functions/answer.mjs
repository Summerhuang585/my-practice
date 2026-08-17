import { sessionStore, checkinStore } from "./lib/stores.mjs";
import { json } from "./lib/http.mjs";
import { entryKey } from "./lib/validate.mjs";

// 講者標記 Q&A 為「已回答 / 未回答」（需要 adminToken）
// POST body: { slug, id, adminToken, answered }
export default async (req) => {
  if (req.method !== "POST") return json({ error: "只接受 POST" }, 405);

  let body = {};
  try { body = await req.json(); } catch { return json({ error: "請傳入 JSON" }, 400); }

  const { slug, id, adminToken, answered } = body;
  if (!slug || !id || !adminToken) return json({ error: "缺少參數" }, 400);

  const session = await sessionStore().get(slug, { type: "json" });
  if (!session || session.adminToken !== adminToken) return json({ error: "沒有權限" }, 401);

  const store = checkinStore();
  const key = entryKey(slug, id);
  const entry = await store.get(key, { type: "json" });
  if (!entry) return json({ error: "找不到這筆" }, 404);

  entry.answered = answered === true;
  await store.setJSON(key, entry);
  return json({ ok: true, answered: entry.answered });
};
