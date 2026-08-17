import { sessionStore, checkinStore, rateLimitStore } from "./lib/stores.mjs";
import { json } from "./lib/http.mjs";

// 排程清理：每天刪除超過保存期限的場次與其所有資料（含學員姓名）。
// 由 Netlify Scheduled Functions 觸發（見檔尾 config.schedule）。
export const MAX_AGE_DAYS = 30;
export const RATELIMIT_MAX_AGE_MS = 60 * 60 * 1000; // 限流紀錄留 1 小時就夠

export default async () => {
  const sessions = sessionStore();
  const checkins = checkinStore();
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  const { blobs } = await sessions.list();
  let removed = 0;
  for (const b of blobs) {
    const s = await sessions.get(b.key, { type: "json" });
    if (s && typeof s.createdAt === "number" && s.createdAt < cutoff) {
      const { blobs: entries } = await checkins.list({ prefix: `${s.slug}/` });
      await Promise.all(entries.map((e) => checkins.delete(e.key)));
      await sessions.delete(b.key);
      removed++;
    }
  }

  // 限流紀錄以前只寫不刪，每個來過的 IP 留一筆到天荒地老。
  const rlRemoved = await sweepRateLimit();
  return json({ ok: true, removed, rateLimitRemoved: rlRemoved, maxAgeDays: MAX_AGE_DAYS });
};

async function sweepRateLimit() {
  const store = rateLimitStore();
  const cutoff = Date.now() - RATELIMIT_MAX_AGE_MS;
  let n = 0;
  try {
    const { blobs } = await store.list();
    for (const b of blobs) {
      const stamps = await store.get(b.key, { type: "json" }).catch(() => null);
      const last = Array.isArray(stamps) && stamps.length ? Math.max(...stamps) : 0;
      if (last < cutoff) { await store.delete(b.key); n++; }
    }
  } catch (err) {
    console.warn("[cleanup] 清限流紀錄失敗:", err?.message);
  }
  return n;
}

export const config = { schedule: "@daily" };
