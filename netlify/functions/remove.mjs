import { getStore } from "@netlify/blobs";

// 老師刪除一筆簽到（需要 adminToken 驗證）
// POST body: { slug, id, adminToken }
export default async (req) => {
  if (req.method !== "POST") return json({ error: "只接受 POST" }, 405);

  let body = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "請傳入 JSON" }, 400);
  }

  const { slug, id, adminToken } = body;
  if (!slug || !id || !adminToken) return json({ error: "缺少參數" }, 400);

  const sessions = getStore("sessions");
  const session = await sessions.get(slug, { type: "json" });
  if (!session || session.adminToken !== adminToken) {
    return json({ error: "沒有權限" }, 401);
  }

  const store = getStore("checkins");
  await store.delete(`${slug}/${id}`);
  return json({ ok: true });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
