import { getStore } from "@netlify/blobs";
import { json } from "./lib/http.mjs";
import { cleanTitle, normalizeMode, makeSlug } from "./lib/validate.mjs";
import { rateLimit, clientIp } from "./lib/ratelimit.mjs";

// 建立 / 讀取 / 改名 / 刪除「場次」
// POST   建立    body: { title, code?, mode, allowAnonymous, allowEmoji }
// PUT    改名    body: { slug, adminToken, title }
// DELETE 刪除    body: { slug, adminToken }
// GET    ?slug=  公開資訊（不含 adminToken）

const CREATE_RL = { limit: 10, windowMs: 60000 }; // 每 IP 每分鐘最多建 10 場

export default async (req) => {
  const sessions = getStore("sessions");

  if (req.method === "POST") {
    const rl = await rateLimit("session", clientIp(req), CREATE_RL);
    if (!rl.allowed) {
      return json({ error: "建立太頻繁，請稍等一下再試" }, 429,
        { "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)) });
    }

    let body = {};
    try { body = await req.json(); } catch { return json({ error: "請傳入 JSON" }, 400); }

    const title = cleanTitle(body.title);
    if (!title) return json({ error: "請填寫名稱" }, 400);

    const mode = normalizeMode(body.mode);

    // 代碼一律帶隨機尾碼（代碼就是看名單的鑰匙，必須猜不到）。
    // 理論上會撞，所以試幾次；連續撞代表隨機來源有問題，寧可回錯也不要覆蓋別人的場次。
    let slug = null;
    for (let i = 0; i < 5; i++) {
      const candidate = makeSlug(body.code);
      if (!(await sessions.get(candidate, { type: "json" }))) { slug = candidate; break; }
    }
    if (!slug) return json({ error: "代碼產生失敗，請再試一次" }, 503);

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

  // 刪除整個場次（需要 adminToken），連同底下所有簽到/留言/票一起清除
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
  if (!data) return json({ error: "找不到這個場次" }, 404, { "cache-control": "no-store" });
  const { adminToken, ...pub } = data;
  // 改名後展示頁要馬上跟著變，不能被快取住
  return json(pub, 200, { "cache-control": "no-store" });
};
