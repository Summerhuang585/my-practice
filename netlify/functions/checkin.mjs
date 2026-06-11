import { getStore } from "@netlify/blobs";

// 學員簽到
// POST body: { slug, name, message? }
export default async (req) => {
  if (req.method !== "POST") return json({ error: "只接受 POST" }, 405);

  let body = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "請傳入 JSON" }, 400);
  }

  const slug = String(body.slug || "").trim();
  const name = String(body.name || "").trim().slice(0, 40);
  if (!slug || !name) return json({ error: "請填寫名字" }, 400);

  const sessions = getStore("sessions");
  const session = await sessions.get(slug, { type: "json" });
  if (!session) return json({ error: "找不到這個場次" }, 404);

  const store = getStore("checkins");
  // 每筆簽到存成獨立的 blob，避免多人同時簽到時互相覆蓋
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ALLOWED_EMOJI = ["👋", "👍", "🎉", "🔥", "✏️", "❤️", "😀", "🙌"];
  const emoji = ALLOWED_EMOJI.includes(body.emoji) ? body.emoji : "";
  const entry = {
    id,
    name,
    message: session.allowMessage ? String(body.message || "").trim().slice(0, 200) : "",
    emoji,
    at: Date.now(),
  };
  await store.setJSON(`${slug}/${id}`, entry);
  return json(entry);
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
