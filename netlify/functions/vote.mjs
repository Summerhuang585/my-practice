import { sessionStore, checkinStore } from "./lib/stores.mjs";
import { json } from "./lib/http.mjs";
import { cleanClientId, entryKey, voteKey, votePrefix } from "./lib/validate.mjs";
import { rateLimit, clientIp } from "./lib/ratelimit.mjs";

// 對某一則按 ❤️（再按一次取消）
// POST body: { slug, id, clientId }
//
// 一人一票 = 一個獨立的 blob（key 帶投票人），不是把票數寫回同一筆資料。
// 這樣兩個人同時按也不會互相蓋掉（先前的做法是讀出來改完寫回去，會掉票）。
const RL = { limit: 60, windowMs: 10000 };

export default async (req) => {
  if (req.method !== "POST") return json({ error: "只接受 POST" }, 405);

  // 限流的 key 用來源 IP，不能用前端送來的 clientId：那是它自己給的，換一組就繞過了
  const rl = await rateLimit("vote", clientIp(req), RL);
  if (!rl.allowed) {
    return json({ error: "按太快了，請稍等幾秒再試" }, 429,
      { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) });
  }

  let body = {};
  try { body = await req.json(); } catch { return json({ error: "請傳入 JSON" }, 400); }

  const slug = String(body.slug || "").trim();
  const id = String(body.id || "").trim();
  const clientId = cleanClientId(body.clientId);
  if (!slug || !id || !clientId) return json({ error: "缺少參數" }, 400);

  const session = await sessionStore().get(slug, { type: "json" });
  if (!session) return json({ error: "找不到這個場次" }, 404);
  if (session.mode === "checkin") return json({ error: "這個場次不開放按讚" }, 400);

  const store = checkinStore();
  const entry = await store.get(entryKey(slug, id), { type: "json" });
  if (!entry) return json({ error: "找不到這筆" }, 404);

  const key = voteKey(slug, id, clientId);
  const mine = await store.getMetadata(key);
  let voted;
  if (mine) { await store.delete(key); voted = false; }
  else { await store.setJSON(key, { at: Date.now() }); voted = true; }

  const { blobs } = await store.list({ prefix: votePrefix(slug, id) });
  return json({ votes: blobs.length, voted });
};
