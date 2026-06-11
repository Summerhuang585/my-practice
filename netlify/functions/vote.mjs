import { getStore } from "@netlify/blobs";

// Q&A 按讚（切換）。用 clientId 防止同一人重複灌票。
// POST body: { slug, id, clientId }
export default async (req) => {
  if (req.method !== "POST") return json({ error: "只接受 POST" }, 405);

  let body = {};
  try { body = await req.json(); } catch { return json({ error: "請傳入 JSON" }, 400); }

  const { slug, id, clientId } = body;
  if (!slug || !id || !clientId) return json({ error: "缺少參數" }, 400);

  const store = getStore("checkins");
  const key = `${slug}/${id}`;
  const entry = await store.get(key, { type: "json" });
  if (!entry) return json({ error: "找不到這筆" }, 404);

  const voters = Array.isArray(entry.voters) ? entry.voters : [];
  const i = voters.indexOf(clientId);
  let voted;
  if (i >= 0) { voters.splice(i, 1); voted = false; }
  else { voters.push(clientId); voted = true; }

  entry.voters = voters;
  entry.votes = voters.length;
  await store.setJSON(key, entry);
  return json({ votes: entry.votes, voted });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8" } });
}
