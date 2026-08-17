import { getStore } from "@netlify/blobs";
import { withinLimit } from "./ratelimit-core.mjs";
import { safeKeyPart } from "./validate.mjs";

export { clientIp } from "./ratelimit-core.mjs";

export const RATELIMIT_STORE = "ratelimit";

// 以 Netlify Blobs 記錄每個 key 最近的請求時間戳，超過上限即擋下。
// 注意：教室常共用同一個對外 IP，因此上限刻意放寬，只攔「腳本式灌爆」。
export async function rateLimit(bucket, key, { limit, windowMs }) {
  const store = getStore(RATELIMIT_STORE);
  const id = `${safeKeyPart(bucket)}:${safeKeyPart(key)}`;
  let prev = [];
  try {
    prev = (await store.get(id, { type: "json" })) || [];
  } catch (err) {
    // 讀不到就當成沒紀錄，但要留痕，否則限流靜默失效沒人會發現
    console.warn("[ratelimit] 讀取失敗，這次不限流:", id, err?.message);
    prev = [];
  }
  const res = withinLimit(prev, Date.now(), windowMs, limit);
  try {
    await store.setJSON(id, res.timestamps, { metadata: { at: Date.now() } });
  } catch (err) {
    console.warn("[ratelimit] 寫入失敗:", id, err?.message);
  }
  return res;
}
