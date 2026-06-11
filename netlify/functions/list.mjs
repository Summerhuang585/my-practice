import { getStore } from "@netlify/blobs";

// 取得某場次所有簽到
// GET ?slug=xxx
export default async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return json({ error: "缺少 slug" }, 400);

  const store = getStore("checkins");
  const { blobs } = await store.list({ prefix: `${slug}/` });
  const entries = (
    await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))
  ).filter(Boolean);

  entries.sort((a, b) => a.at - b.at); // 依簽到時間排序
  return json({ count: entries.length, entries });
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
