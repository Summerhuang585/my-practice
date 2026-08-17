import { sessionStore, checkinStore } from "./lib/stores.mjs";
import { partitionKeys, csvCell } from "./lib/validate.mjs";

// 匯出名單 CSV（需要 adminToken）
// GET ?slug=xxx，token 放在 x-admin-token 標頭。
// 不放網址是刻意的：網址會留在瀏覽器歷史與伺服器日誌裡，等於權杖外流。
export default async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const token = req.headers.get("x-admin-token");
  if (!slug || !token) return new Response("缺少參數", { status: 400 });

  const session = await sessionStore().get(slug, { type: "json" });
  if (!session || session.adminToken !== token) return new Response("沒有權限", { status: 401 });

  const store = checkinStore();
  const { blobs } = await store.list({ prefix: `${slug}/` });
  const { entryKeys, votes } = partitionKeys(blobs.map((b) => b.key), slug);
  const entries = (await Promise.all(entryKeys.map((k) => store.get(k, { type: "json" }))))
    .filter(Boolean)
    .sort((a, b) => a.at - b.at);

  const rows = [["序號", "名字", "內容", "愛心數", "已回答", "時間"]];
  entries.forEach((e, i) => {
    rows.push([
      i + 1,
      e.name || "",
      e.message || "",
      session.mode === "checkin" ? "" : (votes.get(e.id) || 0),
      e.answered === true ? "是" : (session.mode === "qa" ? "否" : ""),
      new Date(e.at).toLocaleString("zh-TW", { hour12: false }),
    ]);
  });

  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const fname = `checkin-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response("﻿" + csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fname}"`,
      "cache-control": "no-store",
    },
  });
};
