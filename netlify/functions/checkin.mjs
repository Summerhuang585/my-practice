import { getStore } from "@netlify/blobs";
import { json } from "./lib/http.mjs";
import { cleanName, cleanMessage, isAllowedEmoji, isDuplicateName } from "./lib/validate.mjs";
import { rateLimit, clientIp } from "./lib/ratelimit.mjs";

// 學員送出一筆（簽到 / 留言 / 提問，依場次模式）
// POST body: { slug, name, message?, emoji? }
const RL = { limit: 40, windowMs: 10000 }; // 每 IP 10 秒上限（放寬，僅擋灌爆）

export default async (req) => {
  if (req.method !== "POST") return json({ error: "只接受 POST" }, 405);

  const rl = await rateLimit("checkin", clientIp(req), RL);
  if (!rl.allowed) {
    return json({ error: "太快了，請稍等幾秒再試 🙏" }, 429,
      { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) });
  }

  let body = {};
  try { body = await req.json(); } catch { return json({ error: "請傳入 JSON" }, 400); }

  const slug = String(body.slug || "").trim();
  if (!slug) return json({ error: "缺少 slug" }, 400);

  const sessions = getStore("sessions");
  const session = await sessions.get(slug, { type: "json" });
  if (!session) return json({ error: "找不到這個場次" }, 404);

  const nameRes = cleanName(body.name, { allowAnonymous: session.allowAnonymous });
  if (nameRes.error) return json({ error: nameRes.error }, 400);
  const name = nameRes.name;

  const store = getStore("checkins");

  // 簽到模式：防同名（同一個名字不能重複簽到）
  if (session.mode === "checkin") {
    const { blobs } = await store.list({ prefix: `${slug}/` });
    const existing = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    if (isDuplicateName(existing, name)) return json({ error: "你已經簽到過了 ✅" }, 409);
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry = { id, name, at: Date.now() };

  if (session.mode !== "checkin") {
    entry.message = cleanMessage(body.message);
  }
  if (session.allowEmoji && isAllowedEmoji(body.emoji)) {
    entry.emoji = body.emoji;
  }
  if (session.mode === "qa") {
    entry.votes = 0;
    entry.voters = [];
    entry.answered = false;
  }

  await store.setJSON(`${slug}/${id}`, entry);
  return json(entry);
};
