import { getStore } from "@netlify/blobs";
import { json } from "./lib/http.mjs";
import { slugify, cleanTitle, normalizeMode } from "./lib/validate.mjs";

// 建立 / 讀取 / 改名 / 刪除「場次」
// POST   建立    body: { title, code?, mode, allowAnonymous, allowEmoji }
// PUT    改名    body: { slug, adminToken, title }
// DELETE 刪除    body: { slug, adminToken }
// GET    ?slug=  公開資訊（不含 adminToken）

export default async (req) => {
  const sessions = getStore("sessions");

  if (req.method === "POST") {
    let body = {};
    try { body = await req.json(); } catch { return json({ error: "請傳入 JSON" }, 400); }

    const title = cleanTitle(body.title);
    if (!title) return json({ error: "請填寫名稱" }, 400);

    const mode = normalizeMode(body.mode);

    let slug = slugify(body.code);
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

  // 修改場次名稱（需要 adminToken）
  if (req.method === "PUT") {
    let body = {};
    try { body = await req.json(); } catch { return json({ error: "請傳入 JSON" }, 400); }
    const { slug, adminToken } = body;
    const title = cleanTitle(body.title);
    if (!slug || !adminToken) return json({ error: "缺少參數" }, 400);
    if (!title) return json({ error: "請填寫名稱" }, 400);
    const data = await sessions.get(slug, { type: "json" });
    if (!data || data.adminToken !== adminToken) return json({ error: "沒有權限" }, 401);
    data.title = title;
    await sessions.setJSON(slug, data);
    const { adminToken: _t, ...pub } = data;
    return json(pub);
  }

  // 刪除整個場次（需要 adminToken），連同底下所有簽到/留言一起清除
  if (req.method === "DELETE") {
    let body = {};
    try { body = await req.json(); } catch { return json({ error: "請傳入 JSON" }, 400); }
    const { slug, adminToken } = body;
    if (!slug || !adminToken) return json({ error: "缺少參數" }, 400);
    const data = await sessions.get(slug, { type: "json" });
    if (!data || data.adminToken !== adminToken) return json({ error: "沒有權限" }, 401);
    const store = getStore("checkins");
    const { blobs } = await store.list({ prefix: `${slug}/` });
    await Promise.all(blobs.map((b) => store.delete(b.key)));
    await sessions.delete(slug);
    return json({ ok: true, deleted: slug });
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
