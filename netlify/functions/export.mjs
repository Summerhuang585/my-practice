import { getStore } from "@netlify/blobs";

// 匯出名單 CSV（需要 adminToken）
// GET ?slug=xxx&token=adminToken
export default async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const token = url.searchParams.get("token");
  if (!slug || !token) return new Response("缺少參數", { status: 400 });

  const sessions = getStore("sessions");
  const session = await sessions.get(slug, { type: "json" });
  if (!session || session.adminToken !== token) return new Response("沒有權限", { status: 401 });

  const store = getStore("checkins");
  const { blobs } = await store.list({ prefix: `${slug}/` });
  const entries = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
  entries.sort((a, b) => a.at - b.at);

  const rows = [["序號", "名字", "內容", "讚數", "已回答", "時間"]];
  entries.forEach((e, i) => {
    rows.push([
      i + 1,
      e.name || "",
      e.message || "",
      e.votes != null ? e.votes : "",
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
    },
  });
};

function csvCell(v) {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
