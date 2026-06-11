import { getStore } from "@netlify/blobs";

// 建立 / 讀取「場次」
// POST  body: { title, code?, mode, allowAnonymous, allowEmoji }
// GET   ?slug=xxx  -> 公開資訊（不含 adminToken）
const MODES = ["checkin", "message", "qa"];

export default async (req) => {
  const sessions = getStore("sessions");

  if (req.method === "POST") {
    let body = {};
    try { body = await req.json(); } catch { return json({ error: "請傳入 JSON" }, 400); }

    const title = String(body.title || "").trim().slice(0, 60);
    if (!title) return json({ error: "請填寫名稱" }, 400);

    const mode = MODES.includes(body.mode) ? body.mode : "checkin";

    let slug = String(body.code || "").trim().toLowerCase()
      .replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    if (!slug) slug = randomSlug();

    const existing = await sessions.get(slug, { type: "json" });
    if (existing) return json({ error: "這個代碼已被使用，請換一個" }, 409);

    const data = {
      slug, title, mode,
      // 簽到模式一律實名；其餘模式由講者決定是否允許匿名
      allowAnonymous: mode === "checkin" ? false : body.allowAnonymous === true,
      allowEmoji: mode === "message" ? body.allowEmoji !== false : false,
      adminToken: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    await sessions.setJSON(slug, data);
    return json(data);
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return json({ error: "缺少 slug" }, 400);
  const data = await sessions.get(slug, { type: "json" });
  if (!data) return json({ error: "找不到這個場次" }, 404);
  const { adminToken, ...pub } = data;
  return json(pub);
};

function randomSlug() { return "s-" + Math.random().toString(36).slice(2, 8); }
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
