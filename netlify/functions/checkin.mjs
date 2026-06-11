import { getStore } from "@netlify/blobs";

// 學員送出一筆（簽到 / 留言 / 提問，依場次模式）
// POST body: { slug, name, message?, emoji? }
const ALLOWED_EMOJI = ["👋", "👍", "🎉", "🔥", "✏️", "❤️", "😀", "🙌"];

export default async (req) => {
  if (req.method !== "POST") return json({ error: "只接受 POST" }, 405);

  let body = {};
  try { body = await req.json(); } catch { return json({ error: "請傳入 JSON" }, 400); }

  const slug = String(body.slug || "").trim();
  if (!slug) return json({ error: "缺少 slug" }, 400);

  const sessions = getStore("sessions");
  const session = await sessions.get(slug, { type: "json" });
  if (!session) return json({ error: "找不到這個場次" }, 404);

  let name = String(body.name || "").trim().slice(0, 40);
  if (!name) {
    if (session.allowAnonymous) name = "匿名";
    else return json({ error: "請輸入名字" }, 400);
  }

  const store = getStore("checkins");

  // 簽到模式：防同名（同一個名字不能重複簽到）
  if (session.mode === "checkin") {
    const { blobs } = await store.list({ prefix: `${slug}/` });
    const existing = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    const dup = existing.some((e) => e && e.name.trim().toLowerCase() === name.toLowerCase());
    if (dup) return json({ error: "你已經簽到過了 ✅" }, 409);
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry = { id, name, at: Date.now() };

  if (session.mode !== "checkin") {
    entry.message = String(body.message || "").trim().slice(0, 280);
  }
  if (session.allowEmoji && ALLOWED_EMOJI.includes(body.emoji)) {
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

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
