import { getStore } from "@netlify/blobs";
import { withinLimit } from "./ratelimit-core.mjs";

export { clientIp } from "./ratelimit-core.mjs";

// 以 Netlify Blobs 記錄每個 key 最近的請求時間戳，超過上限即擋下。
// 注意：教室常共用同一個對外 IP，因此上限刻意放寬，只攔「腳本式灌爆」。
export async function rateLimit(bucket, key, { limit, windowMs }) {
  const store = getStore("ratelimit");
  const id = `${bucket}:${key}`;
  let prev = [];
  try { prev = (await store.get(id, { type: "json" })) || []; } catch { prev = []; }
  const res = withinLimit(prev, Date.now(), windowMs, limit);
  try { await store.setJSON(id, res.timestamps); } catch { /* 限流盡力而為，不擋正常流程 */ }
  return res;
}
