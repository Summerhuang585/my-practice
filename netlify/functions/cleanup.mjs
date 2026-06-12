import { getStore } from "@netlify/blobs";
import { json } from "./lib/http.mjs";

// 排程清理：每天刪除超過保存期限的場次與其所有資料（含學員姓名）。
// 由 Netlify Scheduled Functions 觸發（見檔尾 config.schedule）。
export const MAX_AGE_DAYS = 30;

export default async () => {
  const sessions = getStore("sessions");
  const checkins = getStore("checkins");
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
  return json({ ok: true, removed, maxAgeDays: MAX_AGE_DAYS });
};

export const config = { schedule: "@daily" };
