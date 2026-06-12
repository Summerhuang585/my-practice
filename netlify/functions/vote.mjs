import { getStore } from "@netlify/blobs";
import { json } from "./lib/http.mjs";
import { applyVote } from "./lib/validate.mjs";
import { rateLimit, clientIp } from "./lib/ratelimit.mjs";

// Q&A / 留言 按讚（切換）。用 clientId 防止同一人重複灌票。
// POST body: { slug, id, clientId }
const RL = { limit: 60, windowMs: 10000 };

export default async (req) => {
  if (req.method !== "POST") return json({ error: "只接受 POST" }, 405);

  let body = {};
  try { body = await req.json(); } catch { return json({ error: "請傳入 JSON" }, 400); }

  const { slug, id, clientId } = body;
  if (!slug || !id || !clientId) return json({ error: "缺少參數" }, 400);

  const rl = await rateLimit("vote", clientId || clientIp(req), RL);
  if (!rl.allowed) {
    return json({ error: "太快了，請稍等幾秒再試 🙏" }, 429,
      { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) });
  }

  const store = getStore("checkins");
  const key = `${slug}/${id}`;
  const entry = await store.get(key, { type: "json" });
  if (!entry) return json({ error: "找不到這筆" }, 404);

  const res = applyVote(entry.voters, clientId);
  entry.voters = res.voters;
  entry.votes = res.votes;
  await store.setJSON(key, entry);
  return json({ votes: res.votes, voted: res.voted });
};
